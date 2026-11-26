import{F as as,cb as tt,aV as Q,bE as rs,cy as Mt,A as g,b as c,ae as E,eD as ls,j as Xt,bg as ds,bG as hs,cd as cs,bw as us,z as P,k as v,a as qe,ai as et,m as Ye,c as O,q as k,b4 as ps,gD as gs,rt as fs,aN as ms,p as vs,bp as vt,lA as Ct,eW as bs,eX as ws,aj as I,a8 as st,r4 as ys,ps as re,ru as $s,pr as ks,aS as xs,aT as _s,rv as Ss,a_ as le,rw as Ds,rx as Is,b0 as de,b1 as he,ry as zs,rz as Ms,aU as Cs,e3 as Ps}from"./index-C0HbI5eb.js";import{l as ce}from"./live-D8eEcMTc.js";import{o as Os}from"./architect-request-dialog-C3zjPH_r.js";import"./sw-chip-CfSrDCNZ.js";import{g as Ts,h as ue,i as As,j as Ls,k as Es,l as Ns,M as js,n as Fs,o as Rs,c as N,q as Zs,f as it,r as Gs,t as pe,u as Bs,v as Vs,w as Ws,x as Us,y as Hs}from"./sw-plan-canvas-D53dX8Cf.js";import{t as M}from"./map-B7OhCpBA.js";import{d as T,a7 as j,b0 as pt,m as S,b1 as Qt,Y as Je,b2 as lt,aZ as dt,b3 as Xe,b4 as _t,aJ as Ht,b5 as Ks,b6 as qs,b7 as St,b8 as Kt,i as Ys,V as Pt,b9 as Js,ba as ge,bb as fe,bc as Xs,bd as Qs,be as ti,bf as ei,ai as si,bg as ii,bh as oi,bi as me,bj as Ot,bk as ni,bl as ai,bm as ri,bn as li,bo as bt,bp as K,bq as di,br as hi,bs as ci,bt as Tt,bu as ve,bv as be,bw as ui,bx as pi,T as gi,by as fi,bz as mi,bA as we,bB as ot,bC as vi,bD as bi,bE as wi,bF as yi,bG as nt,bH as at,bI as $i,bJ as rt,a1 as ye,bK as $e,bL as ki,bM as xi,bN as _i,bO as Si,bP as Di,am as Ii,bQ as zi,bR as Mi,bS as Ci,bT as ke,bU as Pi,bV as Oi,bW as Ti,av as At,bX as Ai,bY as Li,bZ as Ei,b_ as Ni,b$ as xe,c0 as ji,c1 as Fi,c2 as _e,c3 as Ri,c4 as Zi,c5 as Gi,c6 as Bi,c7 as Se,a2 as Lt,c8 as q,c9 as Vi,ca as Wi,cb as Ui,E as Hi,Q as Z,cc as De,cd as Ki,aC as Et,aD as Ie,ce as qi,cf as Qe,cg as Yi,ch as Nt,ci as Ji,aM as Xi,cj as ze,ck as Qi,P as to,cl as eo,cm as so,aG as io,cn as oo}from"./shared-space-604dPS0X.js";import{p as qt,d as no,b as Me,f as ao,u as ro,a as lo,g as ho,e as co,r as uo,l as po,h as go,s as fo,i as mo,j as vo,k as bo,Z as Ce,z as wo}from"./zones-B0mm6fMF.js";import{p as yo,a as _,b as $o,s as ko,d as xo,G as _o,t as n,c as z,D as Pe,e as Oe,f as So,g as Do,h as wt,i as Io,j as zo,k as jt,l as Te,m as Mo,n as Ft,o as Co,q as Po,u as Oo,S as To,v as Ao,C as Lo,w as Ae,x as Eo,y as No,z as jo,A as Fo,B as Ro,E as Zo,F as Go,M as Rt,H as Bo,I as Vo,J as Wo,r as Uo,K as Ho,L as Ko,N as qo,O as Yo,P as Jo,Q as Xo,R as Qo,T as tn,U as en,V as sn}from"./plan-editor-DsDcmYhU.js";import{s as on,g as nn,j as Le,k as an,p as rn,l as ln,m as dn,n as hn,o as cn,d as un,h as pn,e as gn,q as fn,r as mn,t as vn,u as bn,v as yt,f as wn,w as yn,x as $n}from"./geometry-B4cSqp3y.js";import{r as kn,i as xn,w as _n}from"./floor-view-shared-Bs1PYPaM.js";import{t as Sn,f as Dn,r as Ee,e as In,w as Ne,a as $t,m as zn,g as Mn,h as Cn,j as Pn,k as On}from"./candidates-NB611TtS.js";import{p as je,o as Zt}from"./connector-targets-IzrVjgcP.js";import{c as Tn,b as An,i as R,d as Ln,e as En,f as Nn,l as jn}from"./plan-catalog-DqlW_jsL.js";import{r as Fn,A as Rn,d as Zn}from"./material-resolve-Cc8RSvBu.js";import{D as Fe}from"./sun-CfmgisfR.js";import{s as Gn}from"./memo-CyxK7byc.js";import{c as Y}from"./confirm-dialog-CEi4gaw7.js";import{T as Bn}from"./toast-controller-BPX0Tkjm.js";import"./sw-logo-art-PLtEZJxU.js";import"./media-Cqgoi_EQ.js";import"./webgl-DaWE85eB.js";import"./quality-ladder-DHVfCAjZ.js";const Vn="ghost-wall",Wn="ghost-door",Dt=[.4,3],Re=.12,Un=.25,Hn="door_tool",ut=(t,e,s)=>Math.min(s,Math.max(e,t)),Yt=t=>Math.round(t*1e3)/1e3;function gt(t,e,s,i){return Ht(t,s,i)*S(e).scale}function Kn(t,e,s,i,o){const{scale:a}=S(t),r=e.width_px!=null?Yt(ut(e.width_px*a,Dt[0],Dt[1])):Qt.door.width_m,l=e.new_wall?{polyline:e.new_wall.polyline.map(h=>[h[0],h[1]]),thickness_m:Yt(ut(e.new_wall.thickness_px*a,.05,.6))||o.thickness_m}:null,d={found:e.found,note:e.note,warning:e.warning,wallId:e.wall_id,newWall:l,t:e.t,width_m:r,hinge:e.hinge,swing:e.swing,confidence:e.confidence};return te(t,d,s,i)}function V(t,e,s){return e.wallId?t.walls.find(i=>i.id===e.wallId)??null:e.newWall?{id:Vn,level_id:T(t),polyline:e.newWall.polyline,thickness_m:e.newWall.thickness_m||s?.thickness_m||.15,height_m:null,base_z_m:0,kind:s?.kind??"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}:null}function te(t,e,s,i){const o=V(t,e);if(!o)return e;if(e.newWall){const[l,d]=[e.newWall.polyline[0],e.newWall.polyline[e.newWall.polyline.length-1]],h=l[0]+(d[0]-l[0])*e.t,u=l[1]+(d[1]-l[1])*e.t,p=(d[0]-l[0])*s,b=(d[1]-l[1])*i,w=Math.hypot(p,b)||1,y=S(t).scale,x=e.width_m/2/y,D=p/w,$=b/w,F=os=>{let se=x+Re/y,ie=Number.POSITIVE_INFINITY;const ns=Math.max(e.newWall.thickness_m,.2)/y;for(const mt of t.walls)if(!(mt.polyline.length<2))for(const oe of[mt.polyline[0],mt.polyline[mt.polyline.length-1]]){const ne=(oe[0]-h)*s,ae=(oe[1]-u)*i,It=(ne*D+ae*$)*os,zt=Math.abs(ne*$-ae*D);It>=x&&It<=x+(Re+Un)/y&&zt<=ns&&zt<ie&&(se=It,ie=zt)}return se},H=F(1),W=F(-1),ft=[h-D*W/s,u-$*W/i],is=[h+D*H/s,u+$*H/i];return{...e,t:W/(W+H),newWall:{...e.newWall,polyline:[ft,is]}}}const[a,r]=dt(e.width_m,gt(o,t,s,i));return{...e,t:ut(e.t,a,r)}}function qn(t,e,s){const i=V(t,e,s);if(!i)return null;const o={id:Wn,wall_id:i.id,t:e.t,kind:"door",width_m:e.width_m,height_m:Qt.door.height_m,sill_m:0,swing:e.swing,hinge:e.hinge,anchor_ref:null,confidence:e.confidence,source:"manual",external_ids:{}};return{...t,walls:[i],openings:[o],labels:[],objects:[],connectors:[]}}function Yn(t,e,s,i){const o=V(t,e);if(!o)return null;const a=gt(o,t,s,i),r=a>0?e.width_m/2/a:0;return[j(o,e.t-r,s,i),j(o,e.t+r,s,i)]}function Jn(t,e,s,i){const o=V(t,e),a=Yn(t,e,s,i);if(!o||!a)return[];const r=pt(o,e.t,s,i),l=[r[1],-r[0]],d=e.swing==="double"||e.swing==="sliding",u=(d?e.hinge==="start":e.swing==="left")?1:-1,{scale:p}=S(t),b=e.width_m/p,w=e.hinge==="start"?a[0]:a[1],y=d||e.hinge==="start"?a[1]:a[0],x=(W,ft)=>[W[0]+l[0]*ft/s,W[1]+l[1]*ft/i],D=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2],$=[{id:"width",at:y,label:M("רוחב הדלת: גרירה לאורך הקיר")}],F=e.hinge==="start"?-1:1,H=Math.max(14,.3*b);return d||$.push({id:"hinge",at:[w[0]+r[0]*F*H/s,w[1]+r[1]*F*H/i],label:M("החלף צד ציר")}),$.push({id:"swing",at:x(D,u*Math.max(18,.5*b)),label:d?M("החלף את צד הפתיחה"):M("החלף כיוון פתיחה")}),$}function ts(t){return{...t,hinge:t.hinge==="start"?"end":"start"}}function Xn(t){return t.swing==="double"||t.swing==="sliding"?ts(t):{...t,swing:t.swing==="left"?"right":t.swing==="right"?"left":t.swing}}function Qn(t,e,s,i,o){const a=V(t,e);if(!a)return e;const r=j(a,e.t,i,o),l=pt(a,e.t,i,o),d=Math.abs((s[0]-r[0])*i*l[0]+(s[1]-r[1])*o*l[1]);let h=ut(2*d*S(t).scale,Dt[0],Dt[1]);return e.newWall||(h=Math.min(h,gt(a,t,i,o))),te(t,{...e,width_m:Yt(h)},i,o)}function ta(t,e,s,i,o,a){let r=t,l=e.wallId;if(!l){if(!e.newWall)return null;const b=Je(r,e.newWall.polyline,{thickness_m:e.newWall.thickness_m||o.thickness_m,kind:o.kind});r=lt(b.doc,b.id,{external_ids:{origin:Hn},...a&&a!==T(b.doc)?{level_id:a}:{}}),l=b.id}const d=r.walls.find(b=>b.id===l);if(!d)return null;const[h,u]=dt(e.width_m,gt(d,r,s,i)),p=Xe(r,l,ut(e.t,h,u),"door");return{doc:_t(p.doc,p.id,{width_m:e.width_m,swing:e.swing,hinge:e.hinge}),openingId:p.id,wallId:l}}function ea(t,e,s,i){const o=e.wallId?t.walls.find(d=>d.id===e.wallId):null;if(!o)return null;const a=gt(o,t,s,i);let r=null,l=Number.POSITIVE_INFINITY;for(const d of t.openings){if(d.wall_id!==o.id)continue;const h=Math.abs(d.t-e.t)*a;h<Math.max(d.width_m,e.width_m)/2&&h<l&&(r=d,l=h)}return r}function sa(t,e,s,i,o,a){const r=pt(e,s,o,a),l=j(e,s,o,a),d=(i[0]-l[0])*o*r[1]+(i[1]-l[1])*a*-r[0]>0;return te(t,{found:"default",note:M("ברירת מחדל - בדוק"),warning:null,wallId:e.id,newWall:null,t:s,width_m:Qt.door.width_m,hinge:"start",swing:d?"left":"right",confidence:.2},o,a)}function ia(t,e,s,i,o){const a=V(t,e);if(!a)return!1;const r=j(a,e.t,i,o),l=pt(a,e.t,i,o),d=(s[0]-r[0])*i,h=(s[1]-r[1])*o,u=e.width_m/S(t).scale;return Math.abs(d*l[0]+h*l[1])<=u/2&&Math.abs(d*l[1]-h*l[0])<=u}const Gt={white:Mt("לבן"),tint:Mt("גוון לכל חדר"),none:Mt("ללא מילוי")};async function oa(t,e){const s=await as(tt`plan-versions/${t}/stylize`,e);return{...s,source_url:Q(s.source_url)+`?v=${Date.now()}`,stylized_url:Q(s.stylized_url)+`?v=${Date.now()}`}}const na=(t,e)=>rs(tt`plan-versions/${t}`,{render_mode:e}),kt=["walls","openings","rooms","objects","labels","connectors","levels","circuits","groups"];function Ze(t,e){if(!t)return"";const s=new Date(t);return Number.isNaN(s.getTime())?"":s.toLocaleString(ls(e),{dateStyle:"short",timeStyle:"short"})}function aa(t,e){if(t.diff.same)return c`<div class="pkg-line" data-pkg-nochange>${_("noChanges",e)}</div>`;const s=Object.keys(t.diff.collections).sort((i,o)=>kt.indexOf(i)+99*+(kt.indexOf(i)<0)-(kt.indexOf(o)+99*+(kt.indexOf(o)<0)));return c`<ul class="pkg-list" data-pkg-diff>
    ${s.map(i=>{const o=t.diff.collections[i],a=[o.added.length?`${_("added",e)} ${o.added.length}`:"",o.removed.length?`${_("removed",e)} ${o.removed.length}`:"",o.changed.length?`${_("changed",e)} ${o.changed.length}`:""].filter(Boolean);return c`<li data-pkg-coll=${i}><strong>${$o(i,e)}</strong> <span>${a.join(" · ")}</span></li>`})}
    ${t.diff.calibration_changed?c`<li data-pkg-calibration>${_("calibration",e)}</li>`:g}
  </ul>`}function ra(t,e){const s=t.entities,o=[["cameras",_("missing",e),s.anchors_missing.map(l=>l.name||l.resource_id)],["unplaced",_("unplaced",e),s.anchors_unplaced.map(l=>l.name||l.resource_id)],["rooms",_("rooms",e),s.rooms_missing],["switches",_("switches",e),s.switches_missing],["items",_("items",e),s.items_missing]].filter(([,,l])=>l.length),a=s.items_added.length?c`<li data-pkg-items-added><strong>${_("itemsAdded",e)}</strong> <bdi>${s.items_added.join(", ")}</bdi></li>`:g,r=s.items_differ.length?c`<li data-pkg-items-differ><strong>${_("itemsDiffer",e)}</strong> <bdi>${s.items_differ.join(", ")}</bdi></li>`:g;return!o.length&&a===g&&r===g?g:c`<div class="pkg-sec" data-pkg-missing>
    <div class="pkg-h">${_("missing",e)}</div>
    <ul class="pkg-list">
      ${o.map(([l,d,h])=>c`<li data-pkg-missing-kind=${l}><strong>${l==="cameras"?_("cameras",e):d}</strong> <bdi>${h.slice(0,12).join(", ")}${h.length>12?` +${h.length-12}`:""}</bdi></li>`)}
      ${a}${r}
    </ul>
  </div>`}function la(t,e){const s=yo(),i=t.preview,o=!!i&&(i.origin.trust!=="installation"||!!i.origin.retired_key),a=!!i&&!t.busy&&(!o||t.acceptForeign),r=!i&&t.foreign?t.foreign:null;return c`<sw-dialog open wide heading=${_("title",s)} subheading=${t.file.name} data-pkg-dialog ?locked=${t.busy==="import"} @close=${()=>e.cancel()}>
    <div class="modes" role="group" aria-label=${_("mode",s)}>
      ${["replace","merge"].map(l=>c`<button class=${t.mode===l?"on":""} aria-pressed=${t.mode===l} data-pkg-mode=${l} ?disabled=${!!t.busy} @click=${()=>e.setMode(l)}>${_(l,s)}</button>`)}
    </div>
    ${t.busy==="check"?c`<div class="note" data-pkg-checking>${_("checking",s)}</div>`:g}
    ${t.error?c`<div class="err" data-pkg-error>${t.error}</div>`:g}
    ${r?c`<div class="pkg-sec" data-pkg-origin data-pkg-gate>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${r.floor_name??""}</bdi> · ${_(r.stage==="draft"?"draft":"published",s)} · <bdi>${Ze(r.generated_at,s)}</bdi></div>
            <div class="pkg-line warn" data-pkg-trust=${r.trust}>${_("signedForeign",s)}</div>
          </div>
          <label class="pkg-trust"><sw-toggle size="sm" labelHidden in-label label=${_("trustForeign",s)} data-pkg-accept-foreign .checked=${t.acceptForeign} ?disabled=${!!t.busy} @change=${l=>e.setAcceptForeign(E(l))}></sw-toggle> ${_("trustForeign",s)}</label>`:g}
    ${i?c`<div class="pkg-sec" data-pkg-origin>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${i.origin.floor_name??""}</bdi> · ${_(i.origin.stage==="draft"?"draft":"published",s)} · <bdi>${Ze(i.origin.generated_at,s)}</bdi></div>
            <div class="pkg-line ${o?"warn":"ok"}" data-pkg-trust=${i.origin.trust}>${_(o?"signedForeign":"signedHere",s)}</div>
          </div>
          <div class="pkg-sec">
            <div class="pkg-h">${_("changes",s)}</div>
            ${aa(i,s)}
            ${i.warnings.includes("other_drawing")?c`<div class="pkg-line warn" data-pkg-other-drawing>${_("otherDrawing",s)}</div>`:g}
            ${i.warnings.includes("newer_app_version")?c`<div class="pkg-line warn" data-pkg-newer>${_("newerApp",s)}</div>`:g}
            ${i.issue_count?c`<div class="pkg-line" data-pkg-issues>${_("issues",s)}: ${i.issue_count}</div>`:g}
          </div>
          ${ra(i,s)}
          ${o?c`<label class="pkg-trust"><sw-toggle size="sm" labelHidden in-label label=${_("trustForeign",s)} data-pkg-accept-foreign .checked=${t.acceptForeign} @change=${l=>e.setAcceptForeign(E(l))}></sw-toggle> ${_("trustForeign",s)}</label>`:g}`:g}
    <sw-button slot="footer" variant="ghost" data-pkg-cancel ?disabled=${t.busy==="import"} @click=${()=>e.cancel()}>${_("cancel",s)}</sw-button>
    <sw-button slot="footer" icon="download" data-pkg-confirm ?disabled=${!a} @click=${()=>a&&e.confirm()}>${t.busy==="import"?_("importing",s):_("importDraft",s)}</sw-button>
  </sw-dialog>`}const da=Xt`
  .pkg-sec {
    display: grid;
    gap: 4px;
  }
  .pkg-h {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-semibold);
  }
  .pkg-line {
    font-size: var(--sw-fs-sm);
  }
  .pkg-line.warn {
    color: var(--sw-warning-text);
  }
  .pkg-line.ok {
    color: var(--sw-text-2);
  }
  .pkg-list {
    margin: 0;
    padding-inline-start: 18px;
    display: grid;
    gap: 2px;
    font-size: var(--sw-fs-sm);
  }
  .pkg-trust {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
  }
  .exports label.btnlink {
    display: inline-flex;
    align-items: center;
  }
`,ha=t=>ds(tt`floors/${t}/images`),ca=(t,e,s)=>{const i=new FormData;return i.append("variant",e),i.append("file",s,s.name||`${e}.png`),hs(tt`floors/${t}/images`,i)},ua=(t,e)=>cs(tt`floors/${t}/images/${e}`),pa=(t,e,s)=>us(tt`floors/${t}/images/layout`,s===void 0?{corners:e}:{corners:e,opacity:s}),ga=t=>t?Q(t.url):null;var fa=Object.defineProperty,ma=Object.getOwnPropertyDescriptor,A=(t,e,s,i)=>{for(var o=i>1?void 0:i?ma(e,s):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&fa(e,s,o),o};const va=[M("פינה שמאלית-עליונה"),M("פינה ימנית-עליונה"),M("פינה ימנית-תחתונה"),M("פינה שמאלית-תחתונה")];let C=class extends qe{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.planUrl=null,this.showPlan=!0,this.imageUrl=null,this.corners=[[0,0],[1,0],[1,1],[0,1]],this.opacity=.7,this.rooms=[],this.walls=[],this.disabled=!1,this.drag=null}willUpdate(){this.style.setProperty("--ar",`${this.planWidth} / ${this.planHeight}`)}toPlan(t){const e=this.getBoundingClientRect();return{x:(t.clientX-e.left)/e.width*this.planWidth,y:(t.clientY-e.top)/e.height*this.planHeight}}down(t,e,s){if(this.disabled||t.button!==0)return;t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId);const i=this.toPlan(t);this.drag={kind:e,index:s,startX:i.x,startY:i.y,start:this.corners.map(o=>[o[0],o[1]])}}move(t){const e=this.drag;if(!e)return;const s=this.toPlan(t),i=(s.x-e.startX)/this.planWidth,o=(s.y-e.startY)/this.planHeight,a=e.kind==="body"?Ts(e.start,i,o):ue(e.start,e.index,{x:e.start[e.index][0]+i,y:e.start[e.index][1]+o});this.emit(a)}up(){this.drag=null}key(t,e){if(this.disabled)return;const s=t.shiftKey?10:1,i=t.key==="ArrowLeft"?-s:t.key==="ArrowRight"?s:0,o=t.key==="ArrowUp"?-s:t.key==="ArrowDown"?s:0;if(!i&&!o)return;t.preventDefault();const a=this.corners[e];this.emit(ue(this.corners,e,{x:a[0]+i/this.planWidth,y:a[1]+o/this.planHeight}))}emit(t){this.corners=t,this.dispatchEvent(new CustomEvent("corners-change",{detail:{corners:t},bubbles:!0,composed:!0}))}render(){const t=this.planWidth,e=this.planHeight,s=As(this.corners,t,e),i=this.corners.map(r=>`${(r[0]*t).toFixed(1)},${(r[1]*e).toFixed(1)}`).join(" "),o=Math.max(t,e)*.012,a=Ls(this.corners,t,e);return c`<svg viewBox=${`0 0 ${t} ${e}`} role="application" aria-label=${M("יישור תמונת הקומה")} @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up}>
      ${this.planUrl&&this.showPlan?et`<image href=${this.planUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity="0.35" />`:g}
      ${this.imageUrl?et`<image data-align-image href=${this.imageUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity=${this.opacity} transform=${Es(s)} />`:g}
      ${this.rooms.map(r=>et`<polygon class="room" points=${r.polygon.map(l=>`${(l.x*t).toFixed(1)},${(l.y*e).toFixed(1)}`).join(" ")} />`)}
      ${this.walls.map(r=>et`<line class="wall" x1=${(r[0][0]*t).toFixed(1)} y1=${(r[0][1]*e).toFixed(1)} x2=${(r[1][0]*t).toFixed(1)} y2=${(r[1][1]*e).toFixed(1)} />`)}
      <polygon class="frame" points=${i} />
      <polygon class="body" data-align-body points=${i} @pointerdown=${r=>this.down(r,"body",-1)} />
      ${this.corners.map((r,l)=>(Ns(s,l===0?{x:0,y:0}:l===1?{x:t,y:0}:l===2?{x:t,y:e}:{x:0,y:e}),et`<circle class="handle" data-align-handle=${l} tabindex=${this.disabled?-1:0} role="slider" aria-label=${va[l]} aria-valuetext=${`${Math.round(r[0]*100)}%, ${Math.round(r[1]*100)}%`}
          cx=${(r[0]*t).toFixed(1)} cy=${(r[1]*e).toFixed(1)} r=${o.toFixed(1)} @pointerdown=${d=>this.down(d,"corner",l)} @keydown=${d=>this.key(d,l)} />`))}
    </svg>
    ${a>.002?c`<div class="res" data-align-residual>${M("סטייה {pct}% - תמונה בפרספקטיבה; היישור מקורב",{pct:(a*100).toFixed(1)})}</div>`:g}`}};C.styles=Xt`
    :host {
      display: block;
      position: relative;
      inline-size: 100%;
      aspect-ratio: var(--ar, 3 / 2);
      max-block-size: 60vh;
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      overflow: hidden;
      touch-action: none;
      direction: ltr;
    }
    svg {
      display: block;
      inline-size: 100%;
      block-size: 100%;
    }
    .room {
      fill: var(--sw-map-room-fill);
      fill-opacity: 0.35;
      stroke: var(--sw-map-structure);
      stroke-width: 1.5;
      vector-effect: non-scaling-stroke;
    }
    .wall {
      stroke: var(--sw-map-structure);
      stroke-width: 3;
      vector-effect: non-scaling-stroke;
      stroke-linecap: round;
    }
    .frame {
      fill: none;
      stroke: var(--sw-accent);
      stroke-width: 1.5;
      stroke-dasharray: 6 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .body {
      fill: transparent;
      cursor: move;
    }
    .handle {
      fill: var(--sw-surface);
      stroke: var(--sw-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: grab;
    }
    .handle:focus-visible {
      outline: none;
      stroke: var(--sw-text);
      stroke-width: 3;
    }
    :host([disabled]) .handle,
    :host([disabled]) .body {
      cursor: default;
    }
    .res {
      position: absolute;
      inset-inline-end: 8px;
      inset-block-end: 6px;
      font-size: 11px;
      color: var(--sw-text-2);
      background: var(--sw-menu-surface);
      padding: 2px 6px;
      border-radius: 4px;
      direction: rtl;
    }
  `;A([P({type:Number})],C.prototype,"planWidth",2);A([P({type:Number})],C.prototype,"planHeight",2);A([P()],C.prototype,"planUrl",2);A([P({type:Boolean})],C.prototype,"showPlan",2);A([P()],C.prototype,"imageUrl",2);A([P({attribute:!1})],C.prototype,"corners",2);A([P({type:Number})],C.prototype,"opacity",2);A([P({attribute:!1})],C.prototype,"rooms",2);A([P({attribute:!1})],C.prototype,"walls",2);A([P({type:Boolean})],C.prototype,"disabled",2);A([v()],C.prototype,"drag",2);C=A([Ye("sw-floor-image-align")],C);const ee={maxDistance:.35,fovWeight:.5,maxSuggestions:3},ba=3;function es(t){const e=ee,s=(i,o,a,r)=>typeof i=="number"&&Number.isFinite(i)&&i>=o&&i<=a?i:r;return{maxDistance:s(t?.maxDistance,1e-6,1,e.maxDistance),fovWeight:s(t?.fovWeight,0,1,e.fovWeight),maxSuggestions:Math.round(s(t?.maxSuggestions,1,ba,e.maxSuggestions))}}const ht=(t,e)=>({x:t.x,y:t.y/e});function wa(t,e,s){const i=s.x-e.x,o=s.y-e.y,a=i*i+o*o;if(a===0)return Math.hypot(t.x-e.x,t.y-e.y);const r=Math.max(0,Math.min(1,((t.x-e.x)*i+(t.y-e.y)*o)/a));return Math.hypot(t.x-(e.x+r*i),t.y-(e.y+r*o))}function ya(t,e,s=1){if(e.length<3)return 1/0;if(qt(t,e))return 0;const i=ht(t,s);let o=1/0;for(let a=0;a<e.length;a++)o=Math.min(o,wa(i,ht(e[a],s),ht(e[(a+1)%e.length],s)));return o}function $a(t){const e=[];let s=0,i=0;for(let o=0;o<t.length;o++){const a=t[o],r=t[(o+1)%t.length];e.push(a,{x:(a.x+r.x)/2,y:(a.y+r.y)/2}),s+=a.x,i+=a.y}return e.push({x:s/t.length,y:i/t.length}),e}function ka(t,e,s=1){const i=ht(t,s),o=ht(e,s);return(Math.atan2(o.x-i.x,-(o.y-i.y))*180/Math.PI+360)%360}function xa(t,e,s,i,o=1){const a=$a(i),r=Math.max(0,Math.min(360,s))/2;let l=0;for(const d of a){if(Math.hypot(d.x-t.x,(d.y-t.y)/o)<1e-9){l++;continue}Math.abs((ka(t,d,o)-e+540)%360-180)<=r+1e-9&&l++}return l/a.length}function _a(t,e,s={},i={}){const o=es({...ee,...s}),a=i.aspect&&i.aspect>0?i.aspect:1;if(t.polygon.length<3)return[];const r=new Set(i.exclude??[]),l=[];for(const d of e){if(r.has(d.id)||d.floorId!==t.floorId||t.levelId&&d.levelId&&t.levelId!==d.levelId)continue;const h=ya(d.position,t.polygon,a);if(h>o.maxDistance)continue;const u=d.fovDeg!=null&&d.fovDeg>0?xa(d.position,d.rotationDeg,d.fovDeg,t.polygon,a):null;if(u!==null&&u===0&&o.fovWeight>=1)continue;const p=h/o.maxDistance+(u===null?0:o.fovWeight*(1-u));l.push({id:d.id,distance:h,inside:h===0,facing:u,score:p})}return l.sort((d,h)=>d.score-h.score||d.distance-h.distance||(d.id<h.id?-1:1)),l.slice(0,o.maxSuggestions)}function Sa(t,e){const s=new Map((e.circuits??[]).map(o=>[o.id,o.power_w])),i={...t,connectors:e.connectors??t.connectors,circuits:t.circuits.map(o=>s.has(o.id)?{...o,power_w:s.get(o.id)}:o)};if(!e.shared_spaces?.length&&!t.shared_spaces?.length)return i;for(const o of ss){const a=(i[o]??[]).filter(l=>!St(l)),r=(e[o]??[]).filter(l=>St(l));i[o]=[...a,...r]}return i.shared_spaces=e.shared_spaces,i}const ss=["walls","openings","objects","labels","circuits","groups","levels"],Jt=["connectors",...ss];function B(t,e){const s=t[e]??[];return e==="connectors"?s:s.filter(i=>St(i))}function Bt(t,e){return e==="connectors"?[]:(t[e]??[]).filter(s=>!St(s))}function Da(t){const e=[...new Set(t.map(s=>s.name))];return M("המדרגות ב{floors} לא עודכנו - אין לך הרשאת עריכה שם",{floors:e.join(M(" וב"))})}const Ge=(t,e)=>JSON.stringify(t)===JSON.stringify(e),Ia=t=>{const{far:e,...s}=t;return JSON.stringify(s)},ct=t=>new Map(t.map(e=>[e.id,Ia(e)]));function za(t,e,s){const i=new Set([...Object.keys(t),...Object.keys(s)]);for(const r of i)if(r!=="shared_spaces"){if(Jt.includes(r)){if(!Ge(Bt(t,r),Bt(s,r)))return null}else if(!Ge(t[r],s[r]))return null}let o=!1;const a={...e,shared_spaces:s.shared_spaces};for(const r of Jt){const l=ct(B(t,r)),d=ct(B(e,r)),h=ct(B(s,r)),u=[...new Set([...l.keys(),...d.keys(),...h.keys()])],p=new Set(u.filter(x=>l.get(x)!==d.get(x))),b=u.filter(x=>l.get(x)!==h.get(x));if(b.some(x=>p.has(x)))return null;b.length&&(o=!0);const w=new Map(B(e,r).map(x=>[x.id,x])),y=B(s,r).flatMap(x=>p.has(x.id)?w.has(x.id)?[w.get(x.id)]:[]:[x]);for(const x of B(e,r))p.has(x.id)&&!h.has(x.id)&&y.push(x);a[r]=[...Bt(e,r),...y]}return o?a:null}function Ma(t,e){const s=new Map;for(const i of Jt){const o=ct(B(t,i)),a=ct(B(e,i)),r=[...new Set([...o.keys(),...a.keys()])].filter(l=>o.get(l)!==a.get(l));r.length&&s.set(i,new Set(r))}return s}function Be(t,e,s){if(!s.size)return t;const i={...t,shared_spaces:e.shared_spaces??t.shared_spaces};for(const[o,a]of s){const r=new Map((e[o]??[]).map(h=>[h.id,h])),l=(t[o]??[]).flatMap(h=>a.has(h.id)?r.has(h.id)?[r.get(h.id)]:[]:[h]),d=new Set(l.map(h=>h.id));for(const h of e[o]??[])a.has(h.id)&&!d.has(h.id)&&l.push(h);i[o]=l}return i}const Ca={load:t=>nn(t,{draft:!0}),save:(t,e,s)=>on(t,e,s)};class Pa{constructor(e,s=Ca,i=2e3){this.host=e,this.api=s,this.delayMs=i,this.doc=null,this.revision=0,this.hash=null,this.publishedHash=null,this.issues=[],this.copyCandidates=[],this.saveState="idle",this.error="",this.claimed=new Map,this.sharedPending=[],this.onNotice=null,this.versionId=null,this.base=null,this.rebased=!1,this.undoStack=[],this.redoStack=[],this.dirty=!1,this.inflight=null,this.conflicted=!1,this.loadToken=0,this.loaded=0,e.addController(this)}hostConnected(){}hostDisconnected(){clearTimeout(this.timer)}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}get hasConflict(){return this.conflicted}get pendingPublish(){const e=this.doc;return e&&this.sharedPending.some(s=>(s.changes??0)>0)?!0:!e||!this.hash||this.hash===this.publishedHash?!1:this.publishedHash!==null||e.walls.length>0||e.openings.length>0||e.labels.length>0||e.objects.length>0||e.connectors.length>0}async load(e){clearTimeout(this.timer);const s=++this.loadToken;let i;try{i=await this.api.load(e)}catch(o){if(s===this.loadToken)throw o;return}s===this.loadToken&&(this.loaded=s,this.versionId=e,this.apply(i),this.doc=i.doc,this.base=i.doc,this.rebased=!1,this.copyCandidates=i.copy_candidates??[],this.undoStack=[],this.redoStack=[],this.dirty=!1,this.conflicted=!1,this.saveState="idle",this.error="",this.host.requestUpdate())}commit(e){if(!this.doc)return;const s=Ks(this.doc,e);this.claimed=s.claimed,e=s.doc,this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.change(e)}undo(){const e=this.undoStack.pop();!e||!this.doc||(this.redoStack.push(this.doc),this.change(e))}redo(){const e=this.redoStack.pop();!e||!this.doc||(this.undoStack.push(this.doc),this.change(e))}adopt(e){return!this.doc||!this.versionId||e.doc.plan_version_id!==this.versionId||this.dirty||this.inflight?!1:(clearTimeout(this.timer),this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.apply(e),this.doc=e.doc,this.base=e.doc,this.dirty=!1,this.conflicted=!1,this.saveState="saved",this.error="",this.host.requestUpdate(),!0)}async flush(){clearTimeout(this.timer);let e=!1;for(;;){if(this.inflight){await this.inflight;continue}if(!this.dirty||this.conflicted||e&&this.saveState==="error")break;e=!0,this.inflight=this.saveOnce(),await this.inflight,this.inflight=null}return!this.dirty&&this.saveState!=="error"}change(e){this.doc=e,this.dirty=!0,clearTimeout(this.timer),this.conflicted||(this.saveState!=="saving"&&(this.saveState="pending"),this.timer=setTimeout(()=>void this.flush(),this.delayMs)),this.host.requestUpdate()}apply(e){this.revision=e.geometry.revision,this.hash=e.geometry.doc_hash,this.publishedHash=e.published_hash,this.issues=e.issues,this.sharedPending=e.shared_pending??[];const s=e.twins_skipped??[];s.length&&this.onNotice?.(Da(s))}async rebase(e,s){if(!this.base||this.rebased)return!1;let i;try{i=await this.api.load(e)}catch{return!1}if(s!==this.loaded||!this.doc)return!1;const o=za(this.base,this.doc,i.doc);if(!o)return!1;this.rebased=!0;const a=Ma(this.base,i.doc);return this.undoStack=this.undoStack.map(r=>Be(r,i.doc,a)),this.redoStack=this.redoStack.map(r=>Be(r,i.doc,a)),this.apply(i),this.base=i.doc,this.doc=o,this.dirty=!0,this.saveState="pending",this.error="",!0}async saveOnce(){const e=this.doc,s=this.versionId,i=this.loaded;if(!e||!s){this.dirty=!1;return}this.dirty=!1,this.saveState="saving",this.host.requestUpdate();try{const o=qs(this.base,e),a=await this.api.save(s,o.length?{...e,shared_deleted:o}:e,this.revision);if(i!==this.loaded)return;this.apply(a),a.doc&&(this.base=a.doc),this.rebased=!1,this.doc===e&&a.doc&&(this.doc=Sa(e,a.doc)),this.saveState=this.dirty?"pending":"saved",this.error=""}catch(o){if(i!==this.loaded)return;if(this.dirty=!0,o instanceof O&&o.code==="stale_revision"){if(await this.rebase(s,i))return;this.conflicted=!0}this.saveState="error",this.error=this.conflicted?M("הקומה עודכנה מקומה אחרת או במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי (שינויים שלא נשמרו כאן לא יישמרו)."):k(o)}finally{this.host.requestUpdate()}}}const Oa=[Xt`
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100%;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 16px;
      min-block-size: 560px;
      flex: 1;
    }
    .mapwrap {
      position: relative;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      overflow: hidden;
      background: var(--sw-surface);
      min-block-size: 520px;
      box-shadow: var(--sw-shadow-1);
      display: flex;
      flex-direction: column;
    }
    .mapwrap sw-plan-canvas {
      flex: 1;
    }
    .rail {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 64px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      /* the HUD panels over the plan are opaque (owner 2026-10-13, styles/menu-surface.ts): the tool rail, the floor chip, the level bar and the legend */
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-2);
      padding: 5px;
      z-index: var(--sw-z-map-ui);
    }
    .rail button {
      display: grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .rail button.on {
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .rail button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .rail hr {
      border: 0;
      border-block-start: 1px solid var(--sw-border);
      margin: 2px 4px;
    }
    .floorchip {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-start: 12px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      z-index: var(--sw-z-map-ui);
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      background: var(--sw-surface);
    }
    .bar .grow {
      flex: 1;
    }
    /* T085 pan/help: the hand-tool toggle and the shortcuts-help button live in the top bar, not the vertical rail (an
     * absolute overlay whose height is capped by the legend below it) - a row that grows in normal flow instead. The
     * hand tool is a modifier over whatever tool is active, not a content tool of its own, so its "on" state gets an
     * amber tone rather than the rail's blue accent, keeping it visually distinct from a selected tool. */
    .bar button.icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      inline-size: 26px;
      block-size: 26px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      flex-shrink: 0;
    }
    .bar button.icon.on {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text); /* POLISH4 WP6 (D28): the bare warning hue read ~2:1 on its own wash in light; the ink is >= 4.5:1 */
      border-color: var(--sw-warning);
    }
    .bar button.icon:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .autosave {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .autosave i {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--sw-live);
    }
    .autosave.dirty i {
      background: var(--sw-stale);
    }
    .placing-hint {
      position: absolute;
      inset-inline: 0;
      inset-block-end: 14px;
      display: flex;
      justify-content: center;
      pointer-events: none;
      z-index: var(--sw-z-map-ui);
    }
    /* WALLP: the drawing hints (a wall, a curved wall) float at the bottom of the window: the map column grows with the
       side panel, so its own bottom edge is often below the fold (a tablet in landscape never saw the live length,
       radius and the finish button) */
    .placing-hint.float {
      position: fixed;
      inset-block-end: 16px;
      pointer-events: none; /* only the pill takes the pointer: the strip beside it stays the map's */
    }
    .placing-hint.float.bindbar span {
      pointer-events: auto;
      max-inline-size: calc(100vw - 32px);
    }
    .placing-hint span {
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-pill);
      padding: 6px 14px;
      font-size: var(--sw-fs-sm);
      box-shadow: var(--sw-shadow-2);
    }
    .legend {
      position: absolute;
      inset-inline-start: 12px;
      inset-block-end: 12px;
      display: flex;
      gap: 12px;
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      padding: 5px 10px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      z-index: var(--sw-z-map-ui);
    }
    .legend i {
      display: inline-block;
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      margin-inline-end: 5px;
      background: var(--sw-accent);
    }
    .legend i.ent {
      background: var(--sw-live);
    }
    .props {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .err {
      color: var(--sw-danger);
    }
    /* T085 pan/help: the keyboard-shortcuts dialog's grouped list */
    .shortcuts-group h4 {
      margin: 10px 0 4px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .shortcuts-group:first-child h4 {
      margin-block-start: 0;
    }
    .shortcuts-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 4px 0;
      font-size: var(--sw-fs-xs);
    }
    .shortcuts-row kbd {
      flex: 0 0 auto;
      min-inline-size: 84px;
      text-align: center;
      font: inherit;
      font-size: var(--sw-fs-xs);
      direction: ltr;
      color: var(--sw-text-2);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-xs);
      padding: 2px 6px;
      background: var(--sw-surface-2);
    }
    .shortcuts-row span {
      color: var(--sw-text-2);
    }
    /* R5-MAPS-297 (impeccable bolder, HOMEFABLE pattern): the plan is the hero (shadow 2), the tool rail a raised panel whose active tool is
       the accent FIELD (a disabled tool dims by its ink, never by fading the box); the save state is a filled pill (saved = the success field,
       unsaved = the stale field) instead of a 7 px dot beside grey text; the legend in the body ink with 10 px dots; keys and values in the
       side cards read at a glance. Press on pointer-down; hover only with a fine pointer. */
    .mapwrap {
      box-shadow: var(--sw-shadow-2);
      /* loop 2: the map ground a tone step down (the desk), the plan sheet floats, the rail and chips read as raised */
      --sw-map-bg: var(--sw-surface-3);
    }
    .rail {
      box-shadow: var(--sw-shadow-3);
    }
    .rail button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .rail button.on {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .rail button:active:not(:disabled),
    .bar button.icon:active:not(:disabled),
    .list button:active {
      transform: scale(var(--sw-press-scale));
    }
    .bar button.icon {
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    /* POLISH4 WP6 (D12 / D13): hover lives only under a fine pointer - the tool rail, the bar's icon keys and the side lists never keep a
       sticky wash after a tap on a tablet (it replaces the ungated :hover + (hover: none) undo pair); the active key keeps its own fill */
    @media (hover: hover) and (pointer: fine) {
      .rail button:hover:not(.on):not(:disabled) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
      .bar button.icon:hover:not(.on):not(:disabled) {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
      .list button:hover:not(.on) {
        background: var(--sw-accent-soft);
        border-color: var(--sw-accent);
      }
    }
    .bar {
      font-size: var(--sw-fs-sm);
    }
    .autosave {
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
      font-weight: var(--sw-fw-semibold);
    }
    .autosave.dirty {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
    }
    .autosave i,
    .autosave.dirty i {
      background: currentColor;
    }
    /* a HUD panel keeps the opaque menu surface (owner 2026-10-13, unit-menu-lint): the chip's weight comes from a 2 px accent edge and the
       accent ink, not from an accent fill */
    .floorchip {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      background: var(--sw-menu-surface);
      border: 2px solid var(--sw-accent);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-2);
    }
    .floorchip sw-icon {
      color: inherit;
    }
    .legend {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-2);
    }
    .legend i {
      inline-size: 12px;
      block-size: 12px;
    }
    .autosave {
      font-size: var(--sw-fs-sm);
      padding: 4px 12px;
    }
    .list button {
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    .list button.on {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-accent-text);
    }
    /* a circuit row's colour as a 10 px dot in front of the name, not a 4 px coloured side edge (impeccable "side-tab") */
    .list button[data-circuit-row]::before {
      content: '';
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      background: var(--kc, var(--sw-accent));
      flex: none;
    }
    .list button[data-circuit-row] > span:first-of-type {
      flex: 1;
      min-inline-size: 0;
    }
    .kv {
      font-weight: var(--sw-fw-medium);
    }
    .kv .k {
      font-weight: var(--sw-fw-regular);
    }
    .row .lbl {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .row .muted {
      font-weight: var(--sw-fw-regular);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-block-size: 260px;
      overflow: auto;
    }
    .list button {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
      text-align: start;
    }
    .list button.on {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
    }
    .kv {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .kv .k {
      color: var(--sw-text-3);
    }
    /* CAMSUGGEST138-295: at most three rows, so the zone panel keeps fitting the viewport */
    .cam-sug {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .cam-sug-name {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    /* CR-009: a room shown on two floors */
    .shared-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      margin-block-end: 8px;
      border: 1px dashed var(--sw-accent);
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .shared-box {
      display: grid;
      gap: 6px;
      justify-items: start;
      padding: 8px 0;
    }
    .shared-box .chip {
      padding: 1px 8px;
      border: 1px dashed var(--sw-accent);
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .share-preview {
      display: grid;
      gap: 4px;
      margin-block: 8px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .row .lbl {
      display: flex;
      flex-direction: column;
    }
    .row .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    input[type='range'] {
      inline-size: 100%;
      accent-color: var(--sw-accent);
    }
    .cand {
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .cand input.name {
      inline-size: 100%;
      min-inline-size: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xs);
      padding: 4px 6px;
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
    }
    .cand select {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-xs);
      padding: 3px 4px;
      font: inherit;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    i.sw {
      display: inline-block;
      inline-size: 12px;
      block-size: 12px;
      border-radius: var(--sw-r-2xs);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-text) 15%, transparent);
      margin-inline-end: 6px;
      vertical-align: -2px;
    }
    .btns {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 10px;
    }
    /* K88: the floor-image upload buttons (the file input stays hidden behind the button) */
    .upl {
      display: inline-flex;
    }
    .upl input[type='file'] {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      opacity: 0;
      pointer-events: none;
    }
    .chk {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: 8px;
    }
    .legend i.zone {
      border-radius: var(--sw-r-2xs);
      background: var(--sw-accent);
      opacity: 0.45;
    }
    .layerlist label {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
    }
    ${ps}
    .compare {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .vlist {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 320px;
      overflow: auto;
      margin-block-start: 6px;
    }
    .vrow {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      grid-template-areas: "img meta" "img acts";
      gap: 4px 8px;
      align-items: center;
      padding: 6px 8px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      font-size: var(--sw-fs-xs);
    }
    .vrow.cur {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
    }
    .vrow img {
      grid-area: img;
      inline-size: 56px;
      block-size: 40px;
      object-fit: cover;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-map-bg);
      border: 1px solid var(--sw-border);
    }
    .vrow .meta {
      grid-area: meta;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .vrow .acts {
      grid-area: acts;
      display: flex;
      gap: 4px;
      justify-content: flex-end;
    }
    .vrow .acts:empty {
      display: none;
    }
    .dsum {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .ditems {
      display: flex;
      flex-direction: column;
      max-block-size: 160px;
      overflow: auto;
      font-size: var(--sw-fs-xs);
    }
    .ditems div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 3px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .compare img {
      inline-size: 100%;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-map-bg);
    }
    .bindbar {
      pointer-events: auto;
    }
    .bindbar button {
      margin-inline-start: 8px;
      /* POLISH4 WP6 (D13): the key sits on the toast-coloured hint pill, so it takes the toast ink (was white / white 60 % literals) */
      border: 1px solid color-mix(in srgb, var(--sw-toast-text) 60%, transparent);
      background: transparent;
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-pill);
      padding: 2px 10px;
      font: inherit;
      cursor: pointer;
    }
    .levelbar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      position: absolute;
      left: 50%; /* physical: in RTL inset-inline-start is the right edge, and the -50% shift pushed the bar off the canvas's left */
      transform: translateX(-50%);
      inset-block-start: 12px;
      z-index: var(--sw-z-map-ui);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-2xl); /* a pill on one row; a rounded card, not a blob, when a narrow canvas wraps it */
      padding: 4px 8px;
      box-shadow: var(--sw-shadow-1);
      max-inline-size: 60%;
    }
    @media (max-width: 1023px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .props {
        order: 2;
      }
    }
    /* POLISH4 WP6 (D13): a phone gets the canvas at most 70 % of the screen tall (it was a fixed 520 / 560 px floor that pushed the
       properties a full screen down), the tighter phone gap and the medium radius of a phone card */
    @media (max-width: 767px) {
      .layout {
        gap: 12px;
        min-block-size: 0;
      }
      .mapwrap {
        min-block-size: min(520px, 70dvh);
        border-radius: var(--sw-r-md);
      }
    }
    /* POLISH4 WP6 (D13): a finger gets a larger key on the bar's 26 px icon buttons (the tool rail is already 38 px) */
    @media (pointer: coarse) {
      .bar button.icon {
        position: relative;
        inline-size: var(--sw-ctl-h-lg);
        block-size: var(--sw-ctl-h-lg);
      }
      /* A11Y-R4-LEFTOVERS-2380: the drawn key stays --sw-ctl-h-lg (36 / 40 px, so the bar does not grow on a tablet); an invisible layer
       * brings the hit area to 44 px. It reaches at most 4 px past the key, and the bar's gap is 8 px, so two neighbours never overlap. */
      .bar button.icon::after {
        content: '';
        position: absolute;
        inset: min(0px, calc((var(--sw-ctl-h-lg) - 44px) / 2));
      }
    }
  `,ko,da,xo];var Ta=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,m=(t,e,s,i)=>{for(var o=i>1?void 0:i?Aa(e,s):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&Ta(e,s,o),o};const Ve=15e3,We=t=>t instanceof DOMException&&(t.name==="TimeoutError"||t.name==="AbortError")?n("השרת לא ענה בזמן"):k(t),xt=["var(--sw-hue-7)","var(--sw-hue-6)","var(--sw-hue-1)","var(--sw-hue-4)","var(--sw-hue-5)","var(--sw-hue-2)"],La=[{id:"select",icon:"target",label:n("בחירה וגרירה"),ready:!0},{id:"camera",icon:"camera",label:n("הוספת מצלמה"),ready:!0},{id:"lights",icon:"light",label:n("הוספת תאורה (מפסקים)"),ready:!0},{id:"entity",icon:"plus",label:n("התקן אחר"),ready:!0},{id:"zones",icon:"map",label:n("חדרים ואזורים"),ready:!0},{id:"structure",icon:"wall",label:n("מבנה: קירות, דלתות וחלונות"),ready:!0},{id:"library",icon:"grid",label:n("ספריית עצמים"),ready:!0},{id:"connectors",icon:"stairs",label:n("מפלסים ומחברים"),ready:!0},{id:"circuits",icon:"bolt",label:n("מעגלי תאורה"),ready:!0},{id:"calibrate",icon:"scale",label:n("כיול קנה מידה"),ready:!0},{id:"walk",icon:"route",label:n("עמדות סיור"),ready:!0},{id:"measure",icon:"ruler",label:n("מדידת מרחק ושטח"),ready:!0},{id:"detect",icon:"sparkle",label:n("זיהוי אוטומטי של קירות ופתחים"),ready:!0},{id:"layers",icon:"layers",label:n("שכבות"),ready:!0}],Vt=["structure","library","connectors","circuits","calibrate","walk","measure","detect"],U={a:null,b:null,metres:"",result:"",warning:"",pairs:[]},L=Object.freeze([]),Ea=1e3,Na=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"],Ue=t=>{try{const e=JSON.parse(localStorage.getItem(t)??"[]");return Array.isArray(e)?e.filter(s=>typeof s=="string"):[]}catch{return[]}},ja=t=>{try{const e=Number(localStorage.getItem(`sw.editor.gridStep.${t}`));return{on:localStorage.getItem(`sw.editor.grid.${t}`)==="1",stepM:Qe.includes(e)?e:Kt}}catch{return{on:!1,stepM:Kt}}},He=(t,e)=>{try{localStorage.setItem(t,JSON.stringify(e.slice(0,40)))}catch{}},J=t=>Math.round(t*1e3)/1e3,G=10,Wt=14,Fa=6,Ut=(t,e)=>`${z(t,n("קיר אחד"),n("קירות"))}, ${z(e,n("פתח אחד"),n("פתחים"))}`,Ke=[{id:"cameras",label:n("מצלמות")},{id:"doors",label:n("דלתות ומנעולים")},{id:"lights",label:n("תאורה ומתגים")},{id:"sensors",label:n("חיישנים")}],Ra={asset:n("קובץ"),page:n("עמוד"),rotation:n("סיבוב"),crop:n("חיתוך"),width_px:n("רוחב"),height_px:n("גובה")},X=t=>t?Cs(new Date(t)):"";let f=class extends qe{constructor(){super(...arguments),this.floorId="",this.presetEntity="",this.presetCandidates="",this.presetZone="",this.bundle=null,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.panMode=!1,this.shortcutsOpen=!1,this.layers=new Set(["cameras","doors","lights","sensors"]),this.planImage=!0,this.grid={on:!1,stepM:Kt},this.guides=[],this.placing=null,this.entQ="",this.entBuilding=null,this.entMeta=null,this.entResults=null,this.entBusy=!1,this.lightsAll=!1,this.busy=!1,this.error="",this.toaster=new Bn(this,{ms:3500}),this.pkgImport=null,this.stylizing=!1,this.stylized=null,this.stylizeOpts={strength:"medium",keepLines:!1,roomFill:"white"},this.zones=[],this.versions=[],this.geomVersions=[],this.areas=[],this.floorImages=null,this.alignDraft=null,this.alignShowPlan=!0,this.imageBusy=!1,this.imageNote="",this.diff=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.lastEdit=null,this.candidates=null,this.detecting=!1,this.detectStrength="medium",this.replaceAuto=!0,this.drawing=null,this.showZones=!0,this.zoneBusy=!1,this.studio=new Pa(this),this.studioVersion=null,this.studioMode="wall",this.curveDraft=null,this.curveRedo=[],this.glassDraw={..._o},this.doorGhost=null,this.doorAsking=!1,this.doorToken=0,this.wallDefaults={thickness_m:.2,kind:"interior"},this.geomSel=null,this.multi=[],this.zonePreview=null,this.zoneSaving=!1,this.multiNote="",this.multiCache=null,this.geomPreview=null,this.nudgeBurst=null,this.library=null,this.libLookup=null,this.libQ="",this.libCategory=null,this.libRecent=Ue("sw.studio.recent"),this.libFav=Ue("sw.studio.fav"),this.placingItem=null,this.bindOffer=null,this.dupId=null,this.bindRefused=new Set,this.phone=window.matchMedia("(max-width: 767px)"),this.arrayDialog=null,this.groupDelete=null,this.customDialog=null,this.levelFilter=null,this.levelDialog=null,this.matStyle=gs(),this.walkArmed=null,this.walkFocus=null,this.site={...Fe,known:!1},this.matMemo=null,this.connMode=null,this.connStart=null,this.linkTargets=[],this.sharedLevels=!0,this.shareDlg=null,this.linkTargetsFor=null,this.stairShape="straight",this.twinDelete=null,this.linkConfirm=null,this.linkBusy=!1,this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,this.circuitTimer=0,this.wallDraft=null,this.lastDrawClick=null,this.hover=null,this.calib={...U},this.measurePts=[],this.geomDiff=null,this.showEstimates=!0,this.camSuggestCfg=ee,this.camSuggestions=null,this.zoneCamera=null,this.zoneCameraFor=null,this.detectOpts={walls:!0,openings:!0,strength:.6,replaceAuto:!0,hollow:!0},this.detectRun={busy:!1,startedAt:0,elapsed:0,error:"",timedOut:!1,limitS:null},this.detectToken=0,this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.candStatesShown=null,this.hintApplied=!1,this.detectAsk=null,this.removeAutoAsk=!1,this.detectErr=null,this.narrow=!1,this.onNarrow=()=>this.narrow=this.phone.matches,this.entTimer=0,this.entSeq=0,this.errorTimer=0,this.memos=new Map,this.dragMoveFrame=0,this.dragMovePending=null,this.onKey=t=>this.handleKey(t),this.anchorPosCache=null,this.guideCache=null}get info(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.studio.onNotice=t=>{this.flash(t,7e3)},this.load(),window.addEventListener("keydown",this.onKey),this.narrow=this.phone.matches,this.phone.addEventListener("change",this.onNarrow),this.presetEntity&&(this.tool="entity",this.entQ=this.presetEntity,this.searchEntities())}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.phone.removeEventListener("change",this.onNarrow),clearInterval(this.elapsedTimer),window.clearTimeout(this.errorTimer),this.errorTimer=0,window.clearTimeout(this.entTimer),window.clearTimeout(this.circuitTimer),this.entTimer=this.circuitTimer=0,this.cancelDragMove(),this.studio.flush()}async realign(t){if(!(!this.bundle||this.busy)){this.busy=!0;try{const e=await fs(this.bundle.floorId,t);this.error=e.moved||!e.skipped?"":n('{skipped} פריטים לא ניתנים ליישור אוטומטי (שרטוט אחר) — בדוק אותם ולחץ "אשר מיקומים".',{skipped:e.skipped}),await this.load()}catch(e){this.error=k(e)}finally{this.busy=!1}}}async load(){this.error="";try{const t=await ms(this.floorId||"f0",!0),e=!this.bundle||this.bundle.floorId!==t.floorId;e&&(this.levelFilter=null,this.linkTargets=[],this.linkTargetsFor=null,this.planImage=kn("editor",t.floorId),this.grid=ja(t.floorId)),this.bundle=t,this.loadStudio(t),this.loadLibraryFor(t),vs().then(s=>{this.sharedLevels=s["map.shared_levels"]!=="hide",this.camSuggestCfg=es({maxDistance:Number(s["plan.camsuggest_distance"])/100,fovWeight:Number(s["plan.camsuggest_fov"])/100,maxSuggestions:Number(s["plan.camsuggest_count"])}),this.showEstimates=s["plan.estimates"]!=="false";const i=Number(s["site.latitude"]),o=Number(s["site.longitude"]),a=s["site.latitude"]!==null&&s["site.latitude"]!==void 0&&Number.isFinite(i)&&Number.isFinite(o);this.site=a?{latitude:i,longitude:o,known:a}:{...Fe,known:!1},e&&this.bundle===t&&(this.levelFilter=Ys(s["plan.levels"],t))}).catch(()=>{}),this.anchors=t.anchors.filter(s=>s.resource_type!=="camera"||vt("nvr")||Ct(s.camera)).map(s=>({...s,position:{...s.position}})),this.zones=t.zones,this.loadVersions(),this.selectedZoneId&&!this.zones.some(s=>s.id===this.selectedZoneId)&&(this.selectedZoneId=null),this.presetZone&&this.zones.some(s=>s.id===this.presetZone)&&(this.selectedZoneId=this.presetZone,this.selectedId=null),this.presetZone="",this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(s=>s.id===this.selectedId)&&(this.selectedId=null)}catch(t){this.error=k(t)}}get selected(){return this.anchors.find(t=>t.id===this.selectedId)}layerOf(t){return t.resource_type==="camera"?"cameras":t.layer_id==="doors"?"doors":t.layer_id==="lights"?"lights":"sensors"}memo(t,e,s){const i=this.memos.get(t);if(i&&Gn(i.keys,e))return i.value;const o=s();return this.memos.set(t,{keys:e,value:o}),o}get markers(){return this.memo("markers",[this.anchors,this.layers,this.studio.doc,this.activeLevel,this.bundle?.source],()=>this.buildMarkers())}buildMarkers(){return this.anchors.filter(t=>this.layers.has(this.layerOf(t))&&this.onLevel(t)).map(t=>({id:t.id,kind:t.resource_type==="camera"?"camera":ws(t.layer_id,t.entity?.domain),label:this.anchorName(t),x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,radius:t.coverage_radius??void 0,polygon:t.coverage_polygon?t.coverage_polygon.map(([e,s])=>({x:e,y:s})):void 0,labelPos:t.label_pos??void 0,level:t.level_id??null,state:t.resource_type==="camera"?this.bundle?.source==="demo"?"live":bs(t):"neutral"}))}anchorName(t){return t.resource_type==="camera"?t.camera?.name??t.label??t.resource_id:t.label??t.entity?.name??t.resource_id}get selectedZone(){return this.zones.find(t=>t.id===this.selectedZoneId)}get planZones(){return this.showZones?this.memo("planZones",[this.zones,this.zonePreview,this.candidates],()=>this.buildPlanZones()):L}buildPlanZones(){const t=this.zonePreview,e=this.zones.map(i=>({id:i.id,name:i.name,kind:i.kind,color:i.color,polygon:t?.[i.id]??i.polygon,labelPos:i.label_pos,chip:Pt(i.shared)})),s=(this.candidates??[]).map((i,o)=>({id:`cand-${o}`,name:i.include?i.name:"",color:i.include?xt[o%xt.length]:"var(--sw-offline)",polygon:i.polygon,candidate:!0}));return[...e,...s]}async detect(){const t=this.bundle;if(t){if(t.source==="demo"){this.toaster.show(n("נתוני הדגמה: הזיהוי עובד מול השרת."),{ms:0});return}this.detecting=!0,this.error="";try{const e=await no(t.floorId,this.detectStrength);this.candidates=e.rooms.map((s,i)=>({polygon:s.polygon,name:n("חדר {v}",{v:i+1}),kind:"room",include:!0})),this.selectedZoneId=null,this.selectedId=null,this.flash(e.rooms.length?n("{roomsCount} חדרים זוהו · תן שמות ושמור",{roomsCount:e.rooms.length}):n("לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית"),5e3)}catch(e){this.error=k(e)}finally{this.detecting=!1}}}setCandidate(t,e){this.candidates&&(this.candidates=this.candidates.map((s,i)=>i===t?{...s,...e}:s))}async acceptCandidates(){const t=this.bundle,e=(this.candidates??[]).filter(s=>s.include);if(!(!t||!e.length)){this.zoneBusy=!0,this.error="";try{const s=await Me(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name,kind:i.kind})),this.replaceAuto);this.candidates=null,this.zones=s.zones,this.flash(n("{createdCount} חדרים נשמרו",{createdCount:s.created.length}),3e3)}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}}startDrawing(){this.drawing=[],this.placing=null,this.candidates=null,this.selectedZoneId=null,this.selectedId=null}addDraftPoint(t,e){const s=this.drawing,i=this.bundle;if(!(!s||!i)){if(s.length>=3){const o=this.canvas?.zoom??1;if(Math.hypot((t-s[0].x)*i.width*o,(e-s[0].y)*i.height*o)<12){this.finishDrawing();return}}this.drawing=[...s,{x:+t.toFixed(4),y:+e.toFixed(4)}]}}async finishDrawing(){const t=this.drawing,e=this.bundle;if(!(!t||!e||t.length<3)){if(e.source==="demo"){this.toaster.show(n("נתוני הדגמה: השמירה עובדת מול השרת."),{ms:0}),this.drawing=null;return}this.zoneBusy=!0,this.error="";try{const s=await ao(e.floorId,{name:n("אזור {v}",{v:this.zones.length+1}),kind:"zone",polygon:t});this.drawing=null,this.zones=[...this.zones,s],this.selectedZoneId=s.id,this.flash(n("האזור נוצר · תן לו שם"),3e3)}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}}async patchZone(t,e){if(this.bundle?.source!=="demo"){this.zoneBusy=!0,this.error="";try{const s=await this.sendZonePatch(t,e);s==="conflict"?(this.error=n("האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס."),await this.load()):s!=="ok"&&(this.error=s)}finally{this.zoneBusy=!1}}}async sendZonePatch(t,e){try{const s=t.shared?.role==="mirror",i=await ro(t.id,{revision:t.revision,...e},AbortSignal.timeout(Ve),s?this.bundle?.floorId:void 0);return this.zones=this.zones.map(o=>o.id===i.id?s?{...i,polygon:e.polygon??o.polygon,level_id:o.level_id,shared:o.shared,floor_id:o.floor_id}:{...i,shared:o.shared}:o),"ok"}catch(s){return s instanceof O&&s.status===409?"conflict":We(s)}}async removeZone(t){if(this.bundle?.source==="demo")return;if(t.shared?.role==="mirror")return this.unshare(t,this.bundle.floorId);const e=t.shared?.role==="home",s=(t.shared?.floors??[]).map(i=>I(i.name)).join(", ");if(await Y({body:e?n(`למחוק את "{name}"?
החדר משותף עם {names}. המחיקה תבטל את השיתוף, תסיר את חברי החלל ותמחק את האזור. המצלמות והישויות לא נמחקות.`,{name:t.name,names:s}):n('למחוק את "{name}"? המצלמות והישויות בקומה לא מושפעות.',{name:t.name}),danger:!0})){this.zoneBusy=!0,this.error="";try{const i=await this.sendZoneDelete(t,e);i!=="ok"?this.error=i:e&&await this.reloadShared()}finally{this.zoneBusy=!1}}}async sendZoneDelete(t,e=!1){try{return await lo(t.id,AbortSignal.timeout(Ve),e),this.zones=this.zones.filter(s=>s.id!==t.id),this.selectedZoneId===t.id&&(this.selectedZoneId=null),"ok"}catch(s){return We(s)}}async unshare(t,e){const s=t.shared?.role==="mirror"?t.shared.home_floor_name:t.shared?.floors?.find(i=>i.floor_id===e)?.name??"";if(await Y({body:n('לבטל את השיתוף של "{name}"? התוכן של החדר יישאר רק ב{v}{v2}, והמצלמות וההתקנים שלו יפסיקו להיות משותפים. מה שהוסר בזמן השיתוף (התוכן הכפול) לא יחזור.',{name:t.name,v:t.shared?.role==="mirror"?s:n("קומה הזו"),v2:t.shared?.role==="mirror"?n(" ולא יוצג כאן"):n(" ולא יוצג ב{name}",{name:s})}),danger:!0})){this.zoneBusy=!0,this.error="";try{await ho(t.id,e),this.selectedZoneId=null,await this.reloadShared()}catch(i){this.error=k(i)}finally{this.zoneBusy=!1}}}async gotoHomeFloor(t){const e=t.shared;!e||e.role!=="mirror"||!e.home_floor_id||this.dirty.size&&!await this.save()||await this.studio.flush()&&st(`/explore/floors/${e.home_floor_id}/edit`,{zone:e.zone_id})}async setShareMember(t,e,s){if(!(this.dirty.size&&!await this.save())){this.zoneBusy=!0,this.error="";try{s?await co(e,t.resource_type,t.resource_id):await uo(e,t.resource_type,t.resource_id),this.flash(s?n("נוסף לחלל המשותף: מוצג בשתי הקומות"):n("הוסר מהחלל המשותף: מוצג רק בקומה שלו"),4e3),await this.reloadShared()}catch(i){this.error=k(i)}finally{this.zoneBusy=!1}}}async reloadShared(){await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0)}async openShare(t){const e=this.bundle;if(!(!e||!e.planVersionId||e.source==="demo")){this.shareDlg={zone:t,floors:[],floorId:"",homeHere:!0,otherZones:[],otherZoneId:"",duplicateId:null,preview:null,busy:!0,error:""};try{const s=e.floorLevel??0,i=[...(await Le(e.planVersionId)).floors].sort((o,a)=>Math.abs(o.level-s)-Math.abs(a.level-s)||o.level-a.level);this.shareDlg={...this.shareDlg,floors:i,busy:!1},i.length&&await this.pickShareFloor(i[0].floor_id)}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:k(s)}}}}async pickShareFloor(t){const e=this.shareDlg,s=this.bundle;if(!e||!s)return;const i=e.floors.find(r=>r.floor_id===t),o=s.floorLevel??0,a=i?o<=i.level:!0;this.shareDlg={...e,floorId:t,homeHere:a,preview:null,duplicateId:null,error:"",busy:!0};try{const r=(await po(t)).zones.filter(d=>!d.shared),l=r.find(d=>d.name.trim()===e.zone.name.trim())??null;this.shareDlg={...this.shareDlg,otherZones:r,otherZoneId:l?.id??r[0]?.id??"",duplicateId:l?.id??null,busy:!1},await this.previewShareNow()}catch(r){this.shareDlg={...this.shareDlg,busy:!1,error:k(r)}}}shareRequest(){const t=this.shareDlg,e=this.bundle;return!t||!e||!t.floorId?null:t.homeHere?{zoneId:t.zone.id,body:{floor_id:t.floorId,duplicate_zone_id:t.duplicateId,auto:t.duplicateId===null}}:t.otherZoneId?{zoneId:t.otherZoneId,body:{floor_id:e.floorId,duplicate_zone_id:t.zone.id,auto:!1}}:null}async previewShareNow(){const t=this.shareRequest();if(t){this.shareDlg={...this.shareDlg,busy:!0,error:""};try{const e=await go(t.zoneId,t.body);this.shareDlg={...this.shareDlg,preview:e,busy:!1}}catch(e){this.shareDlg={...this.shareDlg,preview:null,busy:!1,error:k(e)}}}}async applyShare(){const t=this.shareRequest(),e=this.shareDlg;if(!(!t||!e?.preview)){if(!await this.studio.flush()){this.shareDlg={...e,error:n("שמור את טיוטת המבנה לפני השיתוף.")};return}this.shareDlg={...e,busy:!0,error:""};try{const s=e.homeHere?{...t.body,duplicate_zone_id:e.preview.duplicate?.zone_id??null,auto:!1}:t.body;await fo(t.zoneId,s),this.shareDlg=null,this.selectedZoneId=null,this.flash(n("החדר משותף עכשיו לשתי הקומות"),4e3),await this.reloadShared()}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:k(s)}}}}renderShareDialog(){const t=this.shareDlg,e=this.bundle;if(!t||!e)return g;const s=t.floors.find(d=>d.floor_id===t.floorId),i=t.preview,o=(d,h,u)=>d?z(d,h,u):"",a=i?[o(i.remove.objects,n("עצם אחד"),n("עצמים")),o(i.remove.walls,n("קיר פנימי אחד (ציור כפול של המגרש)"),n("קירות פנימיים (ציור כפול של המגרש)")),o(i.remove.openings,n("פתח אחד"),n("פתחים")),o(i.remove.labels,n("תווית אחת"),n("תוויות")),o(i.remove.connectors,n("מחבר אחד"),n("מחברים"))].filter(Boolean):[],r={member:n("משותף - נשאר במקומו"),drop_duplicate:n("עותק כפול - יוסר"),kept:n("מוצב גם במקום אחר בקומה של החדר - נשאר, לא משותף")},l=i?i.other_floor.name:"";return c`<sw-dialog open heading=${n("הפוך לחלל משותף")} subheading=${t.zone.name} data-share-dialog @close=${()=>this.shareDlg=null}>
      <div class="note">${n("חלל משותף הוא חדר אחד ששייך לשתי קומות (חלל בגובה כפול): כל קומה שומרת את המתאר והקירות שלה, התוכן נשמר פעם אחת, מוצג בשתי הקומות ואפשר לערוך אותו משתיהן.")}</div>
      ${t.floors.length?c`<sw-field label=${n("הקומה השנייה")}><select data-share-floor @change=${d=>this.pickShareFloor(d.target.value)}>${t.floors.map(d=>c`<option value=${d.floor_id} ?selected=${d.floor_id===t.floorId}>${I(d.name)}</option>`)}</select></sw-field>`:t.busy?g:c`<div class="err">${n("אין בבניין קומה נוספת שמותר לך לערוך.")}</div>`}
      ${s?c`<sw-field label=${n("איפה הרצפה של החדר")} hint=${n("ברירת המחדל: הקומה התחתונה (המגרש)")}><select data-share-home @change=${d=>{this.shareDlg={...this.shareDlg,homeHere:d.target.value==="here",preview:null},this.previewShareNow()}}>
            <option value="here" ?selected=${t.homeHere}>${n("בקומה הזו ({bidi})",{bidi:I(e.floorName)})}</option>
            <option value="there" ?selected=${!t.homeHere}>${n("ב{bidi}",{bidi:I(s.name)})}</option>
          </select></sw-field>
          ${t.homeHere?c`<sw-field label=${n("החדר הכפול ב{bidi}",{bidi:I(s.name)})}><select data-share-duplicate @change=${d=>{const h=d.target.value;this.shareDlg={...this.shareDlg,duplicateId:h==="__auto"?null:h==="__none"?"":h},this.previewShareNow()}}>
                <option value="__auto" ?selected=${t.duplicateId===null}>${i?.duplicate?n("זוהה אוטומטית: {name}",{name:i.duplicate.name}):n("ללא - המתאר ייבנה מהחדר הזה")}</option>
                ${t.otherZones.map(d=>c`<option value=${d.id} ?selected=${t.duplicateId===d.id}>${d.name}</option>`)}
              </select></sw-field>`:c`<sw-field label=${n("החדר ב{bidi} שיישאר",{bidi:I(s.name)})}><select data-share-other-zone @change=${d=>{this.shareDlg={...this.shareDlg,otherZoneId:d.target.value},this.previewShareNow()}}>
                ${t.otherZones.map(d=>c`<option value=${d.id} ?selected=${t.otherZoneId===d.id}>${d.name}</option>`)}
              </select></sw-field>`}`:g}
      ${t.busy?c`<div class="note">${n("מחשב…")}</div>`:g}
      ${i?c`<div class="share-preview" data-share-preview>
            <div class="kv"><span class="k">${n("הרצפה")}</span><span>${I(`${i.zone.floor_name}`)} · "${i.zone.name}"</span></div>
            <div class="kv"><span class="k">${n("המתאר ב{bidi}",{bidi:I(l)})}</span><span data-share-outline>${i.outline.kept?n('"{v}" נשאר - עם {countLabel}',{v:i.duplicate?.name??"",countLabel:z(i.boundary_walls_kept.length,n("הקיר שלאורכו"),n("הקירות שלאורכו"))}):n("ייבנה מהחדר הזה")}</span></div>
            <div class="kv"><span class="k">${n("יוסר מ{bidi}",{bidi:I(l)})}</span><span data-share-removed>${a.length?a.join(", "):n("שום דבר")}</span></div>
            <div class="kv"><span class="k">${n("מצלמות והתקנים")}</span><span data-share-anchors>${i.anchors.length?i.anchors.map(d=>c`<div>${d.name??d.resource_id} · ${r[d.action]??d.action}</div>`):n("אין")}</span></div>
            ${i.aligned?g:c`<div class="err" data-share-alignment>${n("ודא את יישור הקומות: המתאר של הקומה התחתונה לא נופל בתוך המתאר של העליונה.")}</div>`}
            <div class="note">${n("{v} כל קומה שומרת את המתאר והקירות שלה; התוכן (טריבונות, סימוני מגרש, עצמים) נשמר בקומת הרצפה ומוצג בשתיהן. שינוי מהקומה השנייה מתפרסם עם פרסום של כל אחת מהן.",{v:i.same_frame?n("לשתי התוכניות אותה מסגרת: החדר יוצג באותו מקום."):n("לתוכניות מסגרות שונות: החדר יותאם למקום של החדר הכפול לפי המטרים.")})}</div>
          </div>`:g}
      ${t.error?c`<div class="err">${t.error}</div>`:g}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.shareDlg=null}>${n("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-share-apply ?disabled=${!i||t.busy} @click=${()=>this.applyShare()}>${n("שתף את החדר")}</sw-button>
    </sw-dialog>`}renderZoneShare(t){const e=this.bundle;if(!e||e.source==="demo")return g;const s=t.shared;return s?.role==="mirror"?c`<div class="shared-box" data-zone-shared="mirror"><span class="chip">${Pt(s)}</span>
        <div class="note" data-zone-created-on>${n("האזור נוצר ב{bidi} — מחק אותו שם, או בטל שיתוף כאן",{bidi:I(s.home_floor_name)})}</div>
        ${s.home_floor_name===Js?g:c`<sw-button size="sm" variant="ghost" data-zone-goto-home ?disabled=${this.zoneBusy} @click=${()=>this.gotoHomeFloor(t)}>${n("עבור ל{bidi}",{bidi:I(s.home_floor_name)})}</sw-button>`}
        <div class="note">${n("חלל משותף עם {bidi}: המתאר והקירות כאן הם של הקומה הזו; התוכן (טריבונות, סימונים, עצמים) נשמר שם ומוצג בשתי הקומות, ועריכה שלו כאן מופיעה בשתיהן.",{bidi:I(s.home_floor_name)})}</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?c`<sw-button size="sm" variant="ghost" data-zone-unshare ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,e.floorId)}>${n("בטל שיתוף")}</sw-button>`:g}</div>`:s?.role==="home"?c`<div class="shared-box" data-zone-shared="home"><span class="chip">${Pt(s)}</span>
        <div class="note">${n("משותף עם {join}: התוכן של החדר מוצג גם שם.",{join:(s.floors??[]).map(i=>I(i.name)).join(", ")})}</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?(s.floors??[]).map(i=>c`<sw-button size="sm" variant="ghost" data-zone-unshare=${i.floor_id} ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,i.floor_id)}>${n("בטל שיתוף עם {bidi}",{bidi:I(i.name)})}</sw-button>`):g}</div>`:e.permissions.structure?c`<div class="btns"><sw-button size="sm" icon="floor" data-zone-share ?disabled=${this.zoneBusy} title=${n("חדר ששייך לשתי קומות - חלל בגובה כפול")} @click=${()=>this.openShare(t)}>${n("הפוך לחלל משותף")}</sw-button></div>`:g}renderSharedHint(){const t=this.studio.doc,e=this.selected;let s="";if(e?.shared)s=n("חלל משותף · השינוי יופיע גם ב{bidi}",{bidi:I(e.shared.home_floor_name)});else if(e&&t)s=ge(t,null,[e.position.x,e.position.y]);else if(this.geomSel&&t){const h=fe(t,this.geomSel.id);s=h?ge(t,h,Xs(h)):""}const i=!!this.bundle?.permissions.structure,o=e?.resource_type==="camera",a=e?e.room_candidate?c`<div class="shared-hint" data-share-candidate><sw-icon name="floor" size=${14}></sw-icon>${o?n("מצלמה בתוך החלל המשותף שאינה חברה בו - הוסף?"):n("התקן בתוך החלל המשותף שאינו חבר בו - הוסף?")}
          ${i?c`<sw-button size="sm" variant="ghost" data-share-member-add ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.room_candidate,!0)}>${n("הוסף לחלל המשותף")}</sw-button>`:g}</div>`:(e.shared_member||e.shared)&&i?c`<div class="btns"><sw-button size="sm" variant="ghost" data-share-member-remove ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.shared_member??e.shared.zone_id,!1)}>${n("הסר מהחלל המשותף")}</sw-button></div>`:g:g,r=this.geomSel&&t?fe(t,this.geomSel.id):null,l=r&&(this.geomSel?.kind==="object"||this.geomSel?.kind==="label")?Qs(t,r):null,d=l&&r?c`<label class="shared-hint" data-shared-content-toggle><sw-toggle size="sm" labelHidden in-label label=${n("חלק מהחלל המשותף (מוצג גם בקומה השנייה)")} .checked=${r.shared_space_id===l} ?disabled=${!this.bundle?.permissions.structure}
          @change=${h=>this.setSharedContent(r.id,E(h)?l:null)}></sw-toggle> ${n("חלק מהחלל המשותף (מוצג גם בקומה השנייה)")}</label>`:g;return c`${s?c`<div class="shared-hint" data-shared-hint><sw-icon name="floor" size=${14}></sw-icon>${s}</div>`:g}${a}${d}`}setSharedContent(t,e){const s=this.studio.doc;if(!s)return;const i=o=>o.map(a=>{if(a.id!==t)return a;const{shared_space_id:r,...l}=a;return e?{...l,shared_space_id:e}:l});this.studio.commit({...s,objects:i(s.objects),labels:i(s.labels)})}snapshot(){this.undo=[...this.undo.slice(-40),this.anchors.map(t=>({...t,position:{...t.position}}))],this.redo=[]}apply(t,e){this.snapshot(),this.lastEdit="pins",this.anchors=this.anchors.map(s=>s.id===t?{...s,...e,position:e.position??s.position}:s),this.dirty=new Set(this.dirty).add(t)}nudge(t,e){const s=this.selected;s&&this.apply(s.id,{position:{x:+Math.min(1,Math.max(0,s.position.x+t)).toFixed(4),y:+Math.min(1,Math.max(0,s.position.y+e)).toFixed(4)}})}doUndo(){const t=this.undo[this.undo.length-1];t&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}doRedo(){const t=this.redo[this.redo.length-1];t&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}handleKey(t){const e=t.composedPath()[0],s=xn(e);if(t.key==="Escape"){if(this.shortcutsOpen){this.shortcutsOpen=!1;return}if(this.doorGhost||this.doorAsking){this.dropDoorGhost();return}if(this.pkgImport){this.pkgImport.busy!=="import"&&(this.pkgImport=null);return}if(this.arrayDialog||this.groupDelete||this.customDialog){this.arrayDialog=null,this.groupDelete=null,this.customDialog=null;return}if(this.connStart){this.connStart=null;return}if(this.tool==="circuits"&&this.circuitPlacing){this.circuitPlacing=null;return}if(this.tool==="circuits"&&this.membersMode){this.membersMode=!1;return}if(this.tool==="detect"){this.detectAsk?this.detectAsk=null:this.pickTool("select");return}this.placingItem?this.placingItem=null:this.bindOffer?this.bindOffer=null:this.wallDraft?(this.wallDraft=null,this.hover=null):this.curveDraft?(this.curveDraft=null,this.curveRedo=[],this.hover=null):this.tool==="measure"&&this.measurePts.length?this.measurePts=[]:this.tool==="calibrate"&&this.calib.a?this.calib={...U}:this.tool==="walk"&&this.walkArmed?this.walkArmed=null:this.drawing?this.drawing=null:this.placing?this.placing=null:this.candidates?this.candidates=null:this.panMode?this.panMode=!1:(this.selectedId=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[]);return}if(s||this.arrayDialog||this.groupDelete||this.customDialog||this.shortcutsOpen||this.pkgImport||this.panMode||this.multiOn&&this.handleMultiKey(t))return;if(t.code==="KeyD"&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.startMarkDoor();return}const i={KeyC:"curve",KeyR:"curved",KeyG:"glass"};if(i[t.code]&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.wallDraft&&this.wallDraft.length>=2&&this.finishWall(),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.tool!=="structure"&&this.pickTool("structure"),this.studioMode=i[t.code],this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null;return}if((this.studioOn||this.selectGeomOn)&&this.handleStudioKey(t))return;if(t.key==="Enter"&&this.drawing){t.preventDefault(),this.finishDrawing();return}if((t.key==="Delete"||t.key==="Backspace")&&!this.selected&&this.selectedZone){t.preventDefault();const a=this.selectedZone,r=this.zoneVertexSel;if(r&&r.zoneId===a.id&&r.index<a.polygon.length){if(a.polygon.length<=3){this.flash(n("לאזור נשארו שלוש פינות: אי אפשר להסיר עוד פינה"),3e3);return}this.zoneVertexSel=null,this.patchZone(a,{polygon:a.polygon.filter((l,d)=>d!==r.index)});return}this.removeZone(a);return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="z"){t.preventDefault(),t.shiftKey?this.redoAny():this.undoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="y"){t.preventDefault(),this.redoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="s"){t.preventDefault(),this.save();return}if(!this.selected)return;const o=t.shiftKey?.01:.002;t.key==="ArrowLeft"?(t.preventDefault(),this.nudge(-o,0)):t.key==="ArrowRight"?(t.preventDefault(),this.nudge(o,0)):t.key==="ArrowUp"?(t.preventDefault(),this.nudge(0,-o)):t.key==="ArrowDown"?(t.preventDefault(),this.nudge(0,o)):(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.removeSelected())}async save(){if(!this.bundle||this.bundle.source==="demo")return this.toaster.show(n("נתוני הדגמה: השינויים נשמרים רק במסך זה."),{ms:0}),this.dirty=new Set,!0;if(!this.dirty.size)return!0;this.busy=!0,this.error="";let t=!1;try{for(const e of this.dirty){const s=this.anchors.find(i=>i.id===e);if(s)try{const i=await ys(e,{revision:s.revision,x:s.position.x,y:s.position.y,rotation_degrees:s.rotation_degrees,field_of_view_degrees:s.field_of_view_degrees,label:s.label,coverage_radius:s.coverage_radius??null,coverage_polygon:s.coverage_polygon??null,label_pos:s.label_pos??"auto",level_id:s.level_id??"",mount_height_m:s.mount_height_m??null,tilt_deg:s.tilt_deg??null},s.shared?this.bundle.floorId:void 0);this.anchors=this.anchors.map(o=>o.id===e?{...o,revision:i.revision}:o)}catch(i){if(i instanceof O&&i.code==="stale_revision")t=!0;else throw i}}return t?(this.error=n("חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו."),await this.load(),!1):(this.dirty=new Set,this.flash(n("המיקומים נשמרו"),2500),!0)}catch(e){return this.error=k(e),!1}finally{this.busy=!1}}async place(t,e){const s=this.placing;if(!s||!this.bundle)return;if(this.bundle.source==="demo"){this.toaster.show(n("נתוני הדגמה: הוספה עובדת מול השרת."),{ms:0}),this.placing=null;return}if(this.dirty.size&&!await this.save())return;this.busy=!0,this.error="";const i=this.activeLevel?{level_id:this.activeLevel}:{};try{const o=s.kind==="camera"?await re(this.bundle.floorId,{resource_type:"camera",resource_id:s.camera.id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:90,...i}):await re(this.bundle.floorId,{resource_type:"ha_entity",resource_id:s.entity.entity_id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:null,...i});this.placing=null,await this.load(),this.selectedId=o.id,this.tool="select",this.flash(n("{anchorName} הוצב · גרור לדיוק, קבע כיוון בידיות",{anchorName:this.anchorName(o)}),4e3)}catch(o){this.error=k(o)}finally{this.busy=!1}}async removeSelected(){const t=this.selected;if(!(!t||!this.bundle)){if(this.bundle.source==="demo"){this.toaster.show(n("נתוני הדגמה: הסרה עובדת מול השרת."),{ms:0});return}if(await Y({body:n('להסיר את "{anchorName}" מהמפה? המקור עצמו לא נמחק.',{anchorName:this.anchorName(t)}),danger:!0})){this.busy=!0,this.error="";try{await $s(t.id,t.shared?this.bundle.floorId:void 0),this.selectedId=null,await this.load()}catch(e){this.error=k(e)}finally{this.busy=!1}}}}async loadVersions(){const t=this.bundle;if(!t||t.source==="demo"||!t.permissions.edit){this.versions=[],this.geomVersions=[];return}this.loadSideData(t);try{this.versions=(await ks(t.floorId)).versions}catch{this.versions=[]}}async publish(){const t=this.bundle;if(!t?.planVersionId||this.dirty.size&&!await this.save())return;if(!await this.studio.flush()){this.error=this.studio.error;return}if(this.error="",t.planStatus==="published"){await this.openGeomDiff(t.planVersionId);return}let e=this.versions.find(s=>s.id===t.planVersionId);if(e||(await this.loadVersions(),e=this.versions.find(s=>s.id===t.planVersionId)),!e){this.error=n("לא נמצאה טיוטה לפרסום — טען מחדש");return}await this.openDiff("publish",e)}async openGeomDiff(t){this.geomDiff={versionId:t,data:null,error:"",skip:[]};try{const e=await an(t);this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:e,error:"",skip:[]})}catch(e){this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:null,error:k(e),skip:[]})}}async confirmGeomPublish(){const t=this.bundle,e=this.geomDiff;if(!(!t||!e?.data)){this.busy=!0;try{const s=await rn(e.versionId,e.skip);this.geomDiff=null;const i=(s.shared_published??[]).length>0;this.flash(s.unchanged&&!i?n("אין שינוי לפרסום"):i?n("המבנה פורסם, כולל השינויים בחלל המשותף; הצופים רואים אותם עכשיו"):n("המבנה פורסם; הצופים רואים אותו עכשיו"),4e3),await this.loadStudio(t,!0)}catch(s){this.geomDiff={...e,error:k(s)}}finally{this.busy=!1}}}async openDiff(t,e){this.diff={mode:t,version:e,data:null,error:""};try{const s=await xs(e.id);this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:s,error:""})}catch(s){this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:null,error:k(s)})}}async confirmDiff(){const t=this.diff;if(!t?.data||t.mode==="compare")return;const e=t.version.id===this.bundle?.planVersionId;this.busy=!0,this.error="";try{if(e&&!await this.studio.flush()){this.diff={...t,error:this.studio.error};return}t.mode==="publish"?(await _s(t.version.id),this.toaster.show(n("הגרסה פורסמה; הצופים רואים אותה עכשיו"),{ms:0})):(await Ss(t.version.id,t.version.revision,t.data.from?.id??null),this.toaster.show(n("הגרסה שוחזרה ופורסמה מחדש; העוגנים נשמרו"),{ms:0}));const s=this.info;this.diff=null,await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0),this.info===s&&this.flash(s,4e3)}catch(s){this.diff={...t,error:k(s)},s instanceof O&&s.status===409&&this.loadVersions(),e&&s instanceof O&&s.code==="geometry_invalid"&&(this.pickTool("structure"),this.studioMode="select")}finally{this.busy=!1}}async searchEntities(){if(this.bundle?.source==="demo")return;const t=++this.entSeq;this.entBusy=!0;try{const e=this.tool==="lights",s=this.lightsAll,i=this.entBuilding??this.bundle?.buildingId??"",o=await le({q:this.entQ||void 0,domain:e&&!s?"switch":void 0,limit:e?200:40,building:i||void 0});if(t!==this.entSeq)return;this.entMeta=o.building_filter??null,this.entResults=e?o.entities.filter(a=>a.domain==="switch"||s&&a.domain==="light").slice(0,60):o.entities}catch(e){if(t!==this.entSeq)return;this.error=k(e),this.entResults=[]}finally{t===this.entSeq&&(this.entBusy=!1)}}onEntQuery(t){this.entQ=t,window.clearTimeout(this.entTimer),this.entTimer=window.setTimeout(()=>void this.searchEntities(),250)}async stylize(t,e){if(!this.bundle?.planVersionId||this.bundle.source==="demo")return;const s=this.stylizeOpts;(t!==void 0||e!==void 0)&&(this.stylizeOpts={...s,strength:t??s.strength,keepLines:e??s.keepLines}),this.stylizing=!0,this.error="";try{this.stylized=await oa(this.bundle.planVersionId,{strength:this.stylizeOpts.strength,keep_lines:this.stylizeOpts.keepLines,room_fill:this.stylizeOpts.roomFill})}catch(i){this.error=k(i)}finally{this.stylizing=!1}}async useRender(t){if(this.bundle?.planVersionId){this.busy=!0,this.error="";try{await na(this.bundle.planVersionId,t),this.stylized=null,await this.load(),this.flash(t==="stylized"?n("המפה מציגה עכשיו את שפת Arx"):n("המפה מציגה את תוכנית המקור"),3e3)}catch(e){this.error=k(e)}finally{this.busy=!1}}}get detectBusy(){return this.detectRun.busy||this.tool==="detect"&&this.busy}setPlanImage(t,e){this.planImage=e,_n("editor",t,e)}setGrid(t,e){this.grid={...this.grid,...e};try{localStorage.setItem(`sw.editor.grid.${t}`,this.grid.on?"1":"0"),localStorage.setItem(`sw.editor.gridStep.${t}`,String(this.grid.stepM))}catch{}}gridPx(t){return this.grid.on?ti(this.grid.stepM,S(t).scale):0}gridPoint(t){const e=this.bundle,s=this.studio.doc;return e&&s?ei(t,this.gridPx(s),e.width,e.height):t}get anchorPositions(){const t=this.anchorPosCache;if(t&&t.anchors===this.anchors)return t.positions;const e=Object.fromEntries(this.anchors.map(s=>[`${s.resource_type}:${s.resource_id}`,{x:s.position.x,y:s.position.y,rotation:s.rotation_degrees}]));return this.anchorPosCache={anchors:this.anchors,positions:e},e}alignTargets(t,e){const s=this.bundle,i=[t,e,this.activeLevel,this.anchorPositions,s?.width,s?.height],o=this.guideCache;if(o&&o.key.length===i.length&&o.key.every((p,b)=>p===i[b]))return o.targets;const a=this.activeLevel,r=T(t),{scale:l}=S(t),d=si(t,this.anchorPositions),h=s?d.objects.filter(p=>p.id!==e&&(a===null||(p.level_id||r)===a)).map(p=>ii(p,s.width,s.height,l)):[],u=oi(h);return this.guideCache={key:i,targets:u},u}pickTool(t){this.detectBusy&&t!==this.tool||(this.dropDoorGhost(),this.tool=t,this.placing=null,this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,this.geomPreview=null,this.placingItem=null,this.bindOffer=null,this.connMode=null,this.connStart=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,t==="connectors"&&this.loadLinkTargets(),t==="structure"&&this.phone.matches&&(Pe.includes(this.studioMode)||this.studioMode==="curve")&&(this.studioMode="select"),t!=="structure"&&(this.geomSel=null),this.multi=[],this.zoneSaving||(this.zonePreview=null),Vt.includes(t)&&(this.selectedZoneId=null,this.zoneVertexSel=null),t!=="measure"&&(this.measurePts=[]),t!=="calibrate"&&(this.calib={...U}),t!=="walk"&&(this.walkArmed=null,this.walkFocus=null),t!=="detect"&&(this.candSel=null,this.detectAsk=null),(t==="entity"||t==="lights")&&(this.entResults=null,this.searchEntities()))}async loadStudio(t,e=!1){if(t.source!=="api"||!t.planVersionId||!t.permissions.structure||!e&&this.studioVersion===t.planVersionId)return!1;this.studioVersion=t.planVersionId;try{return!await this.studio.flush()&&!(e&&this.studio.hasConflict)?(this.studioVersion=null,this.error=this.studio.error,!1):(await this.studio.load(t.planVersionId),this.geomSel=null,this.multi=[],this.geomPreview=null,this.wallDraft=null,this.calib={...U},this.measurePts=[],this.cands&&this.cands.result.version_id!==t.planVersionId&&this.discardCandidates(),this.presetCandidates==="dxf"&&this.takeDxf(t.planVersionId),!0)}catch(s){return this.studioVersion=null,this.error=k(s),!1}}async loadLibraryFor(t){if(t.source==="api")try{const e=await Tn(t.catalogRevision);this.library=e,this.libLookup=An(e)}catch(e){this.error=k(e)}}placeOpts(t){const e=this.activeLevel??T(t);return{levelId:e,ceilingM:t.levels.find(s=>s.id===e)?.ceiling_height_m??2.8}}get activeLevel(){const t=this.levelFilter;return t&&this.studio.doc?.levels.some(e=>e.id===t)?t:null}shownWalls(t){const e=this.activeLevel;return e?t.walls.filter(s=>s.level_id===e):t.walls}setLevelFilter(t){this.levelFilter=t;const e=this.studio.doc;if(this.geomSel&&e&&!me(e,this.geomSel.id,t)&&(this.geomSel=null),this.multi.length&&e){const s=new Set(Ot(e,this.zones,t).map(i=>i.id));this.setSelection(this.multiItems.filter(i=>s.has(i.id)))}}followLevel(t,e){this.geomSel?.id===t&&this.activeLevel!==null&&this.activeLevel!==e&&(this.levelFilter=e)}openNewLevel(){this.levelDialog={id:null,name:"",elevation:-1.2,ceiling:3,isDefault:!1,makeDefault:!1,error:""}}openLevelEdit(t){const e=this.studio.doc?.levels.find(s=>s.id===t);e&&(this.levelDialog={id:t,name:e.name,elevation:e.elevation_m,ceiling:e.ceiling_height_m,isDefault:e.is_default,makeDefault:!1,error:""})}submitLevel(){const t=this.studio.doc,e=this.levelDialog;!t||!e||(e.id===null?this.createLevel(t,e):this.saveLevel(t,e.id,e))}createLevel(t,e){if(t.levels.some(i=>i.elevation_m===e.elevation)){this.levelDialog={...e,error:n("כבר יש מפלס בגובה הזה")};return}const s=ni(t,e.name,e.elevation,e.ceiling);this.studio.commit(s.doc),this.lastEdit="structure",this.levelDialog=null,this.setLevelFilter(s.id),this.flash(n('המפלס "{name}" נוסף; פריטים חדשים יוצבו בו',{name:e.name}),4e3)}saveLevel(t,e,s){const i=t.levels.find(r=>r.id===e);if(!i){this.levelDialog=null;return}const o=r=>Math.round(r*1e3)/1e3,a={name:s.name.trim(),elevation_m:o(s.elevation),ceiling_height_m:o(s.ceiling),...s.makeDefault&&!i.is_default?{is_default:!0}:{}};if(t.levels.some(r=>r.id!==e&&r.elevation_m===a.elevation_m)){this.levelDialog={...s,error:n("כבר יש מפלס בגובה הזה")};return}this.levelDialog=null,!(a.name===i.name&&a.elevation_m===i.elevation_m&&a.ceiling_height_m===i.ceiling_height_m&&!a.is_default)&&(this.studio.commit(ai(t,e,a)),this.lastEdit="structure",this.flash(a.is_default?n('המפלס "{name}" עודכן והוא המפלס הראשי עכשיו',{name:a.name}):n('המפלס "{name}" עודכן',{name:a.name}),4e3))}deleteLevel(){const t=this.studio.doc,e=this.levelDialog;if(!t||!e?.id)return;const s=t.levels.find(o=>o.id===e.id);if(!s){this.levelDialog=null;return}const i=ri(t,s.id);if(!i){const o=li(t,s.id),a=[...s.is_default?[n("זה המפלס הראשי - הפוך מפלס אחר לראשי קודם")]:[],...o>0?[n("יש בו עוד {countLabel} (קירות, תוויות, עצמים או מחברים) - העבר או מחק אותם קודם",{countLabel:z(o,n("פריט אחד"),n("פריטים"))})]:[]];this.levelDialog={...e,error:n("אי אפשר למחוק את המפלס: {join}.",{join:a.join("; ")})};return}this.studio.commit(i),this.lastEdit="structure",this.levelDialog=null,this.levelFilter===s.id&&this.setLevelFilter(null),this.flash(n('המפלס "{name}" נמחק (ביטול: Ctrl+Z)',{name:s.name}),4e3)}async loadLinkTargets(t=!1){const e=this.bundle;if(!(!e||e.source!=="api"||!e.planVersionId)&&!(!t&&this.linkTargetsFor===e.planVersionId)){this.linkTargetsFor=e.planVersionId;try{this.linkTargets=(await Le(e.planVersionId)).floors}catch{this.linkTargetsFor=null}}}async linkTo(t,e,s,i=!1){const o=this.bundle;if(o?.planVersionId){this.linkBusy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const a=await ln(o.planVersionId,t,e,s,i);await this.loadStudio(o,!0),this.geomSel={id:t,kind:"connector"};const r=this.linkTargets.find(d=>d.floor_id===a.target.floor_id),l=`${r?.name??n("הקומה השנייה")} · ${r?.levels.find(d=>d.id===a.target.level_id)?.name??""}`;this.flash(a.target.placement==="centred"?n("המדרגות קושרו אל {where}. לשתי הקומות אין מסגרת משותפת, לכן בקומה השנייה הן נוצרו במרכז התוכנית: מקם את המדרגות בקומה השנייה.",{where:l}):a.target.placement==="aligned"&&a.target.frame==="size"?n("המחבר קושר אל {where}; בקומה השנייה הוא הונח באותו מקום בתוכנית (לשתי התוכניות אותן מידות): ודא את המיקום בקומה השנייה.",{where:l}):n("המחבר קושר אל {where}; הוא מופיע בטיוטה של שתי הקומות באותו מזהה",{where:l}),7e3)}catch(a){this.error=k(a)}finally{this.linkBusy=!1}}}setTarget(t,e){const s=this.studio.doc,i=s?.connectors.find(r=>r.id===t),o=je(e);if(!s||!i||!o)return;const a=Zt(s,i);if(a&&o.floorId!==a){this.linkConfirm={kind:o.floorId?"relink":"unlink",id:t,value:e,target:Oe(s.levels,i)};return}this.applyTarget(t,e)}applyTarget(t,e,s=!1){const i=this.studio.doc,o=i?.connectors.find(l=>l.id===t),a=je(e);if(!i||!o||!a)return;if(a.floorId){this.linkTo(t,a.floorId,a.levelId,s);return}const r=Zt(i,o);this.edit(l=>bt(l,t,{level_to:a.levelId,floor_ids:[],far:null,origin_floor_id:void 0})),r&&this.dropTwin(t,r)}confirmLink(t){const e=this.linkConfirm;this.linkConfirm=null,t&&e&&this.applyTarget(e.id,e.value,e.kind==="relink")}async dropTwin(t,e){const s=this.bundle;if(s?.planVersionId)try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await dn(s.planVersionId,t,e);this.flash(i.removed?n("המחבר נמחק גם בקומה השנייה"):n("בקומה השנייה לא נמצא מחבר תאום"),4e3)}catch(i){this.error=k(i)}}removeConnector(t){const e=this.studio.doc,s=e?.connectors.find(o=>o.id===t);if(!e||!s)return;const i=Zt(e,s);if(i){this.twinDelete={id:t,floorId:i,target:Oe(e.levels,s),canBoth:this.linkTargets.some(o=>o.floor_id===i)};return}this.edit(o=>K(o,t)),this.geomSel=null}confirmTwinDelete(t){const e=this.twinDelete;this.twinDelete=null,e&&(this.edit(s=>K(s,e.id)),this.geomSel=null,t&&e.canBoth&&this.dropTwin(e.id,e.floorId))}connectorView(t){return{doc:t,saveState:this.studio.saveState,linkTargets:this.linkTargets,linkBusy:this.linkBusy,stairShape:this.stairShape,phone:this.phone.matches}}connectorActions(){const t=this.bundle,e=()=>this.studio.doc?S(this.studio.doc).scale:1;return{setMode:s=>{this.connMode=s,this.connStart=null,this.geomSel=null},select:s=>this.geomSel={id:s,kind:"connector"},patch:(s,i)=>this.edit(o=>bt(o,s,i)),remove:s=>this.removeConnector(s),setTarget:(s,i)=>this.setTarget(s,i),setStairShape:s=>{this.stairShape=s,this.connStart=null},patchStair:(s,i)=>{t&&this.edit(o=>{const a=o.connectors.find(r=>r.id===s);return a?bt(o,s,ci(a,i,t.width,t.height,e())):o})},rotate:s=>{t&&this.edit(i=>hi(i,s,90,t.width,t.height))},setFloorHeight:s=>this.edit(i=>({...i,floor_height_m:s})),confirmPlacement:s=>this.edit(i=>di(i,s))}}renderConnectorTool(t){const e=this.studio.doc;return e?So({...this.connectorView(e),mode:this.connMode,start:this.connStart,sel:this.geomSel?.kind==="connector"?e.connectors.find(s=>s.id===this.geomSel.id):void 0},this.connectorActions()):c`<sw-card heading=${n("מפלסים ומחברים")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: המחברים עובדים מול השרת."):this.error||n("טוען…")}</div></sw-card>`}drawConnector(t,e,s,i){const o=this.bundle,a=this.placeOpts(t).levelId;if(e!=="stairs"||!o)return Tt(t,e,s,i,a,null);const r=S(t).scale,l=Math.hypot((i[0]-s[0])*o.width,(i[1]-s[1])*o.height)*r,d=Math.max(1,Math.min(io,Math.round(l/oo)));if(this.stairShape==="straight"){const h=Tt(t,e,s,i,a,null);return{doc:bt(h.doc,h.id,{shape:"straight",turn:"none",flights:[{steps:d}],landing_depth_m:null}),id:h.id}}return ve(t,{shape:this.stairShape,start:s,dir:[(i[0]-s[0])*o.width,(i[1]-s[1])*o.height],flights:[d,d],width_m:1.2,going_m:l/d,levelFrom:a,levelTo:null},o.width,o.height,r)}placeStairItem(t,e,s){const i=this.bundle,o=be[e];if(!i||!o)return;const a=S(t).scale,r=this.placeOpts(t).levelId,l=o.shape?ve(t,{shape:o.shape,start:s,flights:o.flights,width_m:o.width_m,levelFrom:r,levelTo:null,kind:o.kind},i.width,i.height,a):Tt(t,o.kind,s,[s[0],Math.max(0,s[1]-o.width_m/a/i.height)],r,null);this.studio.commit(l.doc),this.lastEdit="structure",this.remember(e),this.pickTool("connectors"),this.geomSel={id:l.id,kind:"connector"},this.flash(n('המדרגות הונחו כמחבר: בחר ב"מחבר אל" לאיזה מפלס או קומה הן מובילות'),5e3)}async searchSwitches(t){try{const[e,s]=await Promise.all(["switch","light"].map(o=>le({domain:o,q:t||void 0,limit:40}))),i=[...e.entities,...s.entities].filter(o=>o.domain==="switch"||o.domain==="light").slice(0,40);this.circuitNew&&this.circuitNew.q===t&&(this.circuitNew={...this.circuitNew,results:i})}catch(e){this.error=k(e)}}willUpdate(){const t=this.studio.doc;this.zoneCameraFor!==this.selectedZoneId&&this.loadZoneCamera(this.selectedZoneId);const e=this.geomSel?this.studio.claimed.get(this.geomSel.id):void 0;e&&t&&!ui(t).has(this.geomSel.id)&&(this.geomSel={...this.geomSel,id:e}),this.circuitSel&&t&&!t.circuits.some(s=>s.id===this.circuitSel)&&(this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null)}createCircuit(){const t=this.studio.doc,e=this.circuitNew;if(!t||!e?.entity)return;const s=pi(t,e.name,e.entity.entity_id,e.color);this.studio.commit(s.doc),this.lastEdit="structure",this.circuitNew=null,this.circuitSel=s.id,this.membersMode=!0,this.circuitPlacing=null,this.flash(n("המעגל נוצר: לחץ על המנורות שלו"),4e3)}renderCircuitTool(t){const e=this.studio.doc,s=this.library;return e?Do({doc:e,sel:e.circuits.find(i=>i.id===this.circuitSel),membersMode:this.membersMode,power:i=>Ji(e,i,o=>s?R(s,o):void 0),creating:this.circuitNew,saveState:this.studio.saveState,colors:Nt,lamps:s?s.items.filter(i=>i.role==="light"):[],placing:this.circuitPlacing},{select:i=>{this.circuitSel=i,this.membersMode=!1,this.circuitPlacing=null},startNew:()=>{this.circuitNew={name:"",q:"",results:[],entity:null,color:Nt[e.circuits.length%Nt.length],busy:!1},this.searchSwitches("")},cancelNew:()=>this.circuitNew=null,setNew:i=>{this.circuitNew&&(this.circuitNew={...this.circuitNew,...i},i.q!==void 0&&(window.clearTimeout(this.circuitTimer),this.circuitTimer=window.setTimeout(()=>void this.searchSwitches(i.q??""),250)))},create:()=>this.createCircuit(),patch:(i,o)=>this.edit(a=>Yi(a,i,o)),toggleMembers:()=>{this.membersMode=!this.membersMode,this.membersMode||(this.circuitPlacing=null)},remove:i=>{this.edit(o=>K(o,i)),this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null},armLamp:i=>{!this.membersMode||!this.circuitSel||(this.circuitPlacing=i)}}):c`<sw-card heading=${n("מעגלי תאורה")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: המעגלים עובדים מול השרת."):this.error||n("טוען…")}</div></sw-card>`}onLevel(t){const e=this.studio.doc,s=this.activeLevel;return!s||!e?!0:gi(e,t.level_id,s)}remember(t){this.libRecent=[t,...this.libRecent.filter(e=>e!==t)].slice(0,12),He("sw.studio.recent",this.libRecent)}placeItem(t){const e=this.studio.doc,s=this.placingItem;if(!e||!s)return;if(be[s.id]){this.placeStairItem(e,s.id,this.gridPoint(t));return}const i=fi(e,s,this.gridPoint(t),this.placeOpts(e));this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.id,kind:"object"},this.remember(s.id),this.offerBinding(i.id),this.phone.matches&&(this.placingItem=null)}placeCircuitLamp(t){const e=this.studio.doc,s=this.circuitPlacing,i=this.circuitSel;if(!e||!s||!i)return;const o=mi(e,s,this.gridPoint(t),this.placeOpts(e),i);this.studio.commit(o.doc),this.lastEdit="structure",this.geomSel={id:o.id,kind:"object"},this.phone.matches&&(this.circuitPlacing=null)}onItemDrop(t){const e=t.dataTransfer?.getData("text/x-sw-item"),s=this.canvas,i=this.library;if(!e||!s||!i)return;t.preventDefault();const o=R(i,e);if(!o)return;const a=s.getBoundingClientRect(),r=s.toPlan(t.clientX-a.left,t.clientY-a.top);this.placingItem=o,this.placeItem([r.x,r.y]),this.phone.matches||(this.placingItem=null)}offerBinding(t){const e=this.bundle,s=this.studio.doc,i=this.library;if(this.bindOffer=null,!e||!s||!i)return;const o=s.objects.find(h=>h.id===t),a=o?R(i,o.item_id):void 0;if(!o||!a||!a.anchor_kinds.length||o.anchor_ref||this.bindRefused.has(t))return;const{scale:r}=S(s),l=new Set(s.objects.filter(h=>h.anchor_ref).map(h=>`${h.anchor_ref.resource_type}:${h.anchor_ref.resource_id}`));let d=null;for(const h of this.anchors){if(l.has(`${h.resource_type}:${h.resource_id}`)||!this.onLevel(h))continue;const u=h.resource_type==="camera"?"camera":h.entity?.domain??h.resource_id.split(".")[0];if(!a.anchor_kinds.includes(u))continue;const p=we(o.position,[h.position.x,h.position.y],e.width,e.height,r);p<=Ki&&(!d||p<d.d)&&(d={a:h,d:p})}d&&(this.bindOffer={objectId:t,anchor:d.a})}bindObject(t,e){this.edit(s=>ot(s,t,{anchor_ref:{resource_type:e.resource_type,resource_id:e.resource_id},position:[e.position.x,e.position.y],rotation_deg:e.rotation_degrees})),this.bindOffer=null,this.flash(n("העצם הוא עכשיו הגוף של {anchorName}",{anchorName:this.anchorName(e)}),3e3)}openArray(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(r=>r.id===t),o=i&&s?R(s,i.item_id):void 0;if(!e||!i)return;if(this.phone.matches){this.flash(n("מערכים זמינים בדסקטופ בלבד"),3e3);return}const a=o?vi(o):{spacingX:J(i.size.w_m+.05),spacingY:J(i.size.d_m+.45)};this.arrayDialog={objectId:t,item:o,rows:2,cols:4,spacingX:a.spacingX,spacingY:a.spacingY,directionDeg:i.rotation_deg,max:bi,error:""}}createArray(){const t=this.bundle,e=this.studio.doc,s=this.arrayDialog;if(!t||!e||!s)return;const i=wi(e,s.objectId,s,t.width,t.height,S(e).scale);if(!i){this.arrayDialog={...s,error:n("לא ניתן ליצור את המערך (העצם כבר במערך, או שיש יותר מדי עצמים)")};return}this.arrayDialog=null,this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.groupId,kind:"group"},this.flash(n("{idsCount} עצמים במערך אחד",{idsCount:i.ids.length}),4e3)}deleteGroup(t){const e=this.groupDelete;this.groupDelete=null,e&&(this.edit(s=>yi(s,e,t)),this.geomSel=null)}openCustom(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(a=>a.id===t);if(!e||!s||!i)return;const o=R(s,i.item_id);this.customDialog={objectId:t,nameHe:o?`${o.names.he} (מותאם)`:"",nameEn:o?.names.en??"",category:o?.category??"storage",shape:o?.shape??"box",icon:o?.icon??"box",color:o?.color_token??"object",size:{...i.size},basedOn:o?o.custom?o.based_on:o.id:null,busy:!1,error:"",params:JSON.parse(JSON.stringify(i.params)),z:o&&o.z_ref==="ceiling"?o.z_m:i.z_m}}async createCustom(){const t=this.customDialog,e=this.bundle;if(!(!t||!e)){this.customDialog={...t,busy:!0,error:""};try{const s=await Ln({based_on:t.basedOn,names:{he:t.nameHe.trim(),en:t.nameEn.trim()},category:t.category,shape:t.shape,icon:t.icon,color_token:t.color,size:t.size,z_m:t.z,params:t.params});this.customDialog=null,await this.loadLibraryFor(e),this.remember(s.id),this.libCategory="recent",this.libQ="",this.flash(n('הפריט "{he}" נוסף לספרייה',{he:s.names.he}),4e3)}catch(s){this.customDialog={...t,busy:!1,error:k(s)}}}}async importLibrary(t){const e=this.bundle;if(e)try{let s;try{s=JSON.parse(await t.text())}catch{s=null}if(s?.format!=="smplwise-catalog-1"||!Array.isArray(s.items))throw new Error(n("הקובץ אינו ייצוא של ספרייה מותאמת (smplwise-catalog-1)"));const i=await En(s.items);await this.loadLibraryFor(e),this.flash(n("{imported} יובאו, {replaced} הוחלפו",{imported:i.imported,replaced:i.replaced}),4e3)}catch(s){this.error=s instanceof Error&&!(s instanceof O)?s.message:k(s)}}get catalogLookup(){return this.libLookup}get studioOn(){return Vt.includes(this.tool)&&!!this.studio.doc}get studioPlacing(){return!this.studioOn||this.tool==="detect"?!1:this.tool==="library"?!!this.placingItem:this.tool==="connectors"?!!this.connMode:this.tool==="walk"?!!this.walkArmed:this.tool==="circuits"?!!this.circuitPlacing&&!!this.circuitSel:this.tool!=="structure"||this.studioMode!=="select"&&this.studioMode!=="curve"}get geomDragMode(){return this.studio.doc?this.tool==="select"?this.bundle?.permissions.structure&&!this.placing&&!this.drawing?"all":"none":this.tool==="library"?this.placingItem?"none":"objects":this.tool==="connectors"?this.connMode?"none":"objects":this.tool==="circuits"?this.circuitPlacing?"none":"objects":this.tool!=="structure"?"none":this.studioMode==="select"||this.studioMode==="curve"?"all":this.wallDraft||this.curveDraft?"none":"items":"none"}get geomSelectMode(){return this.tool==="structure"&&(this.studioMode==="select"||this.studioMode==="curve")||this.tool==="select"}get selectGeomOn(){return this.tool==="select"&&!!this.geomSel&&!!this.studio.doc&&!this.selectedId}get undoTarget(){return this.studioOn?this.studio.canUndo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canUndo&&(this.lastEdit==="structure"||!this.undo.length)?"structure":this.undo.length?"pins":null}get redoTarget(){return this.studioOn?this.studio.canRedo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canRedo&&(this.lastEdit==="structure"||!this.redo.length)?"structure":this.redo.length?"pins":null}undoAny(){const t=this.undoTarget;t==="structure"?(this.studio.undo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doUndo(),this.lastEdit="pins")}redoAny(){const t=this.redoTarget;t==="structure"?(this.studio.redo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doRedo(),this.lastEdit="pins")}get issueIds(){const t=this.studio.issues;return this.memo("issueIds",[t],()=>t.filter(e=>e.severity==="error"&&e.id).map(e=>e.id))}edit(t){const e=this.studio.doc;if(!e)return;const s=t(e);s===e||JSON.stringify(s)===JSON.stringify(e)||(this.studio.commit(s),this.lastEdit="structure")}snap(t,e,s){const i=this.bundle,o=this.studio.doc;return!i||!o?t:nt(t,e,this.shownWalls(o),i.width,i.height,{tolPx:G/(this.canvas?.zoom??1),free:s})}snapDraw(t,e,s){const i=this.bundle,o=e.length>=3?e[0]:null;return i&&o&&Math.hypot((t[0]-o[0])*i.width,(t[1]-o[1])*i.height)*(this.canvas?.zoom??1)<=G?o:this.snap(t,e.at(-1)??null,s)}openingAt(t,e,s){const i=this.wallLengthM(e,t),o=Fa/(this.canvas?.zoom??1)*S(t).scale;let a=null,r=Number.POSITIVE_INFINITY;for(const l of t.openings){const d=l.wall_id===e.id?Math.abs(l.t-s)*i:Number.POSITIVE_INFINITY;d<=l.width_m/2+o&&d<r&&(a=l,r=d)}return a}onPlanHover(t,e,s,i=!1){const o=this.bundle,a=this.studio.doc;if(!o||!a||!this.studioPlacing||i){this.hover=null;return}const r=[t,e];if(this.tool==="library"||this.tool==="circuits")this.hover=this.gridPoint(r);else if(this.tool==="connectors")this.hover=this.snap(r,null,!0);else if(this.tool==="calibrate")this.hover=this.snap(r,null,!0);else if(this.tool==="walk")this.hover=r;else if(this.tool==="measure")this.hover=this.snap(r,this.measurePts.at(-1)??null,s);else if(this.straightDrawing)this.hover=this.snapDraw(r,this.wallDraft??[],s);else if(this.curveDrawing)this.hover=this.snapCurve(r,this.curveDraft??[],s);else if(this.studioMode==="label")this.hover=r;else if(this.studioMode==="markdoor")this.hover=null;else{const l=at(r,this.shownWalls(a),o.width,o.height,Wt/(this.canvas?.zoom??1));this.hover=l&&!this.openingAt(a,l.wall,l.t)?j(l.wall,l.t,o.width,o.height):null}}studioClick(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return;const a=[t,e];if(this.tool==="library"){this.placingItem&&this.placeItem(a);return}if(this.tool==="circuits"){this.circuitPlacing&&this.circuitSel&&this.placeCircuitLamp(a);return}if(this.tool==="connectors"){if(!this.connMode)return;const w=this.snap(a,null,!0);if(!this.connStart){this.connStart=w;return}const y=this.drawConnector(o,this.connMode,this.connStart,w);this.connStart=null,this.studio.commit(y.doc),this.lastEdit="structure",this.geomSel={id:y.id,kind:"connector"};return}if(this.tool==="walk"){this.placeWalkPosition(o,a);return}if(this.tool==="calibrate"){const w=this.snap(a,null,!0),y=this.calib;this.calib=!y.a||y.b?{...U,a:w}:{...y,b:w};return}if(this.tool==="measure"){this.measurePts=[...this.measurePts,this.snap(a,this.measurePts.at(-1)??null,s)];return}const r=this.studioMode,l=this.canvas?.zoom??1;if(this.curveDrawing){this.curveClick(a,s);return}if(this.straightDrawing){const w=this.wallDraft??[],y=this.snapDraw(a,w,s),x=D=>!!D&&Math.hypot((D[0]-a[0])*i.width,(D[1]-a[1])*i.height)*l<8;if(w.length&&(x(w[w.length-1])||x(this.lastDrawClick))){this.finishWall();return}if(w.length>=3&&y===w[0]){this.wallDraft=[...w,w[0]],this.finishWall();return}this.wallDraft=[...w,y],this.lastDrawClick=a;return}if(r==="curve"||r==="wall"||r==="curved"||r==="glass")return;if(r==="label"){const w=$i(o,a,n("תווית")),y=this.placeOpts(o).levelId;this.studio.commit(y===T(o)?w.doc:rt(w.doc,w.id,{level_id:y})),this.lastEdit="structure",this.geomSel={id:w.id,kind:"label"};return}if(r==="select")return;if(r==="markdoor"){this.markDoorClick(a);return}const d=at(a,this.shownWalls(o),i.width,i.height,Wt/l);if(!d){this.flash(n("לחץ על קיר כדי להציב פתח"),2500);return}const h=this.openingAt(o,d.wall,d.t);if(h){this.onGeomSelect(h.id,"opening");return}const[u,p]=dt(Xi(r).width_m,this.wallLengthM(d.wall,o)),b=Xe(o,d.wall.id,Math.min(p,Math.max(u,d.t)),r);this.studio.commit(b.doc),this.lastEdit="structure",this.geomSel={id:b.id,kind:"opening"}}startMarkDoor(){const t=this.wallDraft;t&&t.length>=2?(this.finishWall(),this.flash(n("הקיר שבציור נשמר; סמן דלת פעיל"))):t&&this.flash(n("נקודת הקיר שהתחלת בוטלה; סמן דלת פעיל")),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.curveDraft=null,this.curveRedo=[],this.tool!=="structure"&&this.pickTool("structure"),this.studioMode="markdoor",this.wallDraft=null,this.hover=null}flash(t,e=3500){this.toaster.show(t,{ms:e})}flashError(t,e=3500){this.error=t,window.clearTimeout(this.errorTimer),this.errorTimer=window.setTimeout(()=>{this.errorTimer=0,this.error===t&&(this.error="")},e)}dropOrphanGhost(){const t=this.studio.doc;this.doorGhost&&t&&!V(t,this.doorGhost)&&(this.dropDoorGhost(),this.flash(n("הקיר של ההצעה הוסר; ההצעה בוטלה")))}selectExisting(t){const e=this.studio.doc,s=this.bundle,i=e&&s?ea(e,t,s.width,s.height):null;return i?(this.doorGhost=null,this.geomSel={id:i.id,kind:"opening"},this.flash(n("כאן כבר יש דלת: היא נבחרה")),!0):!1}dropDoorGhost(){this.doorToken++,this.doorGhost=null,this.doorAsking=!1}async markDoorClick(t){const e=this.bundle;if(!e||!this.studio.doc||this.doorAsking)return;const s=e.width,i=e.height;if(this.doorGhost){const d=ia(this.studio.doc,this.doorGhost,t,s,i);if(this.acceptDoorGhost(),d)return}const o=this.studio.doc,a=this.canvas?.zoom??1,r=at(t,this.shownWalls(o),s,i,Wt/a);if(e.source!=="api"||!e.planVersionId){if(!r){this.flash(n("לחץ על קיר כדי להציב דלת"),2500);return}const d=sa(o,r.wall,r.t,t,s,i);this.selectExisting(d)||(this.doorGhost=d);return}const l=++this.doorToken;this.doorAsking=!0;try{await this.studio.flush();const d=this.activeLevel,h=await hn(e.planVersionId,{x:+t[0].toFixed(5),y:+t[1].toFixed(5),...r?{wall_id:r.wall.id}:{},...d?{level_id:d}:{}}),u=this.studio.doc;if(l!==this.doorToken||!u||this.tool!=="structure"||this.studioMode!=="markdoor")return;const p=Kn(u,h,s,i,this.wallDefaults);if(!V(u,p)){this.flash(n("הקיר של ההצעה לא נמצא בטיוטה; שמור ונסה שוב"),4e3);return}this.selectExisting(p)||(this.doorGhost=p)}catch(d){if(l!==this.doorToken)return;this.flash(d instanceof O&&d.code==="door_proposal_timeout"?n("ההצעה לא חושבה בזמן; לחץ שוב"):k(d),4500)}finally{l===this.doorToken&&(this.doorAsking=!1)}}acceptDoorGhost(){const t=this.doorGhost,e=this.studio.doc,s=this.bundle;if(this.doorGhost=null,!t||!e||!s||this.selectExisting(t))return;const i=ta(e,t,s.width,s.height,this.wallDefaults,this.placeOpts(e).levelId);i&&(this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.openingId,kind:"opening"})}onGhostHandle(t){const e=this.doorGhost,s=this.studio.doc,i=this.bundle;!e||!s||!i||(t.id==="accept"?this.acceptDoorGhost():t.id==="hinge"?this.doorGhost=ts(e):t.id==="swing"?this.doorGhost=Xn(e):t.id==="width"&&t.x!==void 0&&t.y!==void 0&&(this.doorGhost=Qn(s,e,[t.x,t.y],i.width,i.height)))}renderMarkDoorHint(){const t=this.doorGhost;if(this.doorAsking)return c`<div class="placing-hint" data-mark-door-hint="asking"><span>${n("מחפש את הדלת בשרטוט…")}</span></div>`;if(!t)return c`<div class="placing-hint" data-mark-door-hint="idle"><span>${n("סמן דלת: לחץ על סמל הדלת בתוכנית · Esc לביטול")}</span></div>`;const e=wt(t.width_m,S(this.studio.doc).estimated,this.showEstimates);return c`<div class="placing-hint bindbar" data-mark-door-hint="ghost" data-ghost-found=${t.found}><span><b data-ghost-note-text>${t.note}</b> · ${e}${t.warning?c` · <span data-ghost-warning>${t.warning}</span>`:g}
      <button data-ghost-accept-btn @click=${()=>this.acceptDoorGhost()}>${n("אשר (Enter)")}</button><button data-ghost-cancel-btn @click=${()=>this.dropDoorGhost()}>${n("בטל (Esc)")}</button></span></div>`}finishWall(){const t=this.wallDraft;this.wallDraft=null,this.hover=null;const e=this.studio.doc;if(!e||!t||t.length<2)return;const s=Je(e,t,this.drawDefaults);this.commitNewWall(e,s)}commitNewWall(t,e){const s=this.placeOpts(t).levelId;let i=s===T(t)?e.doc:lt(e.doc,e.id,{level_id:s});if(this.studioMode==="glass"){const o=i.walls.find(a=>a.id===e.id);o?.glazing&&o.glazing.panel_width_m!==this.glassDraw.panel_width_m&&(i=lt(i,e.id,{glazing:{...o.glazing,panel_width_m:this.glassDraw.panel_width_m}}))}this.studio.commit(i),this.lastEdit="structure",this.geomSel={id:e.id,kind:"wall"}}get drawDefaults(){return this.studioMode==="glass"?{kind:"glass",thickness_m:this.glassDraw.thickness_m}:this.wallDefaults}get straightDrawing(){return this.tool==="structure"&&(this.studioMode==="wall"||this.studioMode==="glass"&&!this.glassDraw.curved)}get curveDrawing(){return this.tool==="structure"&&(this.studioMode==="curved"||this.studioMode==="glass"&&this.glassDraw.curved)}snapCurve(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return t;const a=this.canvas?.zoom??1,r=e.length>=3?e[0]:null;if(r&&Math.hypot((t[0]-r[0])*i.width,(t[1]-r[1])*i.height)*a<=G)return r;if(s)return t;const l=nt(t,null,this.shownWalls(o),i.width,i.height,{tolPx:G/a,free:!0});return l===t?this.gridPoint(t):l}curveClick(t,e){const s=this.bundle;if(!s)return;const i=this.curveDraft??[],o=this.canvas?.zoom??1,a=this.snapCurve(t,i,e),r=l=>!!l&&Math.hypot((l[0]-t[0])*s.width,(l[1]-t[1])*s.height)*o<8;if(i.length&&(r(i[i.length-1])||r(this.lastDrawClick))){this.finishCurve(!1);return}if(i.length>=3&&a===i[0]){this.finishCurve(!0);return}i.length>=js||(this.curveDraft=[...i,a],this.curveRedo=[],this.lastDrawClick=t)}finishCurve(t){const e=this.curveDraft,s=this.bundle,i=this.studio.doc;if(this.curveDraft=null,this.curveRedo=[],this.hover=null,this.lastDrawClick=null,!e||!s||!i)return;const o=e.length>=2?Fs(i,e,t,this.drawDefaults,s.width,s.height):null;o&&this.commitNewWall(i,o)}curveUndoPoint(){const t=this.curveDraft;t?.length&&(this.curveRedo=[...this.curveRedo,t[t.length-1]],this.curveDraft=t.length>1?t.slice(0,-1):null,this.lastDrawClick=null,this.curveDraft||(this.hover=null))}curveRedoPoint(){const t=this.curveRedo[this.curveRedo.length-1];t&&(this.curveRedo=this.curveRedo.slice(0,-1),this.curveDraft=[...this.curveDraft??[],t])}curveLive(t){const e=this.curveDraft,s=this.studio.doc;return!this.curveDrawing||!e?.length||!s?null:this.memo("curveLive",[e,s,this.hover,t.width,t.height],()=>this.buildCurveLive(t,e,s))}buildCurveLive(t,e,s){const i=this.hover,o=!!i&&e.length>=3&&i===e[0],a=i&&!o?[...e,i]:e;return{...Rs(a,o,t.width,t.height,S(s).scale),count:e.length}}renderCurveHint(t){const e=this.curveLive(t),s=this.studio.doc;if(!e||!s)return g;const{estimated:i}=S(s),o=Number.isFinite(e.minRadiusM)?wt(e.minRadiusM,i,this.showEstimates):N("straightLine"),a=this.studioMode==="glass"?Io("tool"):N("draft");return c`<div class="placing-hint bindbar float" data-curve-hint=${e.count}><span>${a}: ${e.count} ${N("points")} · ${N("length")} <b data-curve-length>${wt(e.lengthM,i,this.showEstimates)}</b> · ${N("minRadius")} <b data-curve-radius>${o}</b>${e.count>=3?c` · ${N("closeHint")}`:g}
      <button data-curve-finish ?disabled=${e.count<2} @click=${()=>this.finishCurve(!1)}>${N("finish")} (Enter)</button><button data-curve-undo @click=${()=>this.curveUndoPoint()}>${N("undoPoint")}</button><button data-curve-cancel @click=${()=>{this.curveDraft=null,this.curveRedo=[],this.hover=null}}>Esc</button></span></div>`}movedCurvePoint(t,e,s,i,o){const a=this.bundle;if(!a||s<0)return null;const r=this.canvas?.zoom??1;let l=i;if(!o){const p=nt(i,null,this.shownWalls(t).filter(b=>b.id!==e.id),a.width,a.height,{tolPx:G/r,free:!0});l=p===i?this.gridPoint(i):p}const d=Zs(t,e.id,s,l,a.width,a.height),h=d.walls.find(p=>p.id===e.id),u=h?ye(h):null;return{doc:d,vertex:u?.[Math.min(s,u.length-1)]??0}}onCanvasSelect(t){const e=t.kind==="wall"&&t.vertex!==void 0&&this.curveDrawing&&!this.curveDraft?this.studio.doc?.walls.find(s=>s.id===t.id):void 0;if(e&&t.vertex!==void 0&&it(e,t.vertex)>=0){const s=e.polyline[t.vertex];this.curveDraft=[[s[0],s[1]]],this.curveRedo=[],this.lastDrawClick=null;return}this.onGeomSelect(t.id,t.kind,t.vertex,!!t.add,t.segment)}onGeomSelect(t,e,s,i=!1,o){if(i&&this.multiOn&&s===void 0&&(e==="wall"||e==="object")){this.toggleSelection({id:t,kind:e});return}if(this.tool==="circuits"&&this.membersMode&&e==="object"&&this.circuitSel){const a=this.studio.doc,r=this.library,l=a?.objects.find(u=>u.id===t),d=l&&r?R(r,l.item_id):void 0;if(d&&!$e(d)){this.flash(n("{he} אינו גוף תאורה",{he:d.names.he}),2500);return}const h=this.circuitSel;this.edit(u=>ki(u,h,t));return}e==="object"&&this.tool!=="library"&&this.tool!=="select"&&this.pickTool("library"),e==="connector"&&this.tool!=="connectors"&&this.tool!=="select"&&this.pickTool("connectors"),e==="connector"&&this.tool==="select"&&this.loadLinkTargets(),this.zoneVertexSel=null,this.geomSel=o!==void 0?{id:t,kind:e,segment:o}:s===void 0?{id:t,kind:e}:{id:t,kind:e,vertex:s},this.multi=[],this.selectedId=null,this.selectedZoneId=null,e!=="object"&&e!=="group"&&(this.bindOffer=null)}onZoneSelect(t,e){if(!(this.placing||this.drawing||this.studioPlacing||this.tool==="detect"||t.startsWith("cand-"))){if(this.tool==="structure"||this.tool==="library"){this.geomSel=null;return}if(e&&this.multiOn){this.toggleSelection({id:t,kind:"zone"});return}this.selectedZoneId!==t&&(this.zoneVertexSel=null),this.selectedZoneId=t,this.selectedId=null,this.geomSel=null,this.multi=[]}}get multiOn(){return this.tool==="select"&&this.geomDragMode==="all"&&!this.phone.matches}get multiItems(){const t=this.studio.doc;if(!this.multi.length||!t)return[];const e=this.multiCache;if(e&&e.multi===this.multi&&e.doc===t&&e.zones===this.zones)return e.items;const s=new Set(t.walls.map(r=>r.id)),i=new Set(t.objects.map(r=>r.id)),o=new Set(this.zones.map(r=>r.id)),a=this.multi.filter(r=>(r.kind==="wall"?s:r.kind==="object"?i:o).has(r.id));return this.multiCache={multi:this.multi,doc:t,zones:this.zones,items:a},a}get highlightIds(){const t=this.studio.doc;if(this.geomSel?.kind==="group")return t?.groups.find(s=>s.id===this.geomSel.id)?.member_ids??L;if(this.tool==="circuits"&&this.circuitSel)return t?.circuits.find(s=>s.id===this.circuitSel)?.member_ids??L;const e=this.multiShown;return e.length?this.memo("highlightIds",[e],()=>e.map(s=>s.id)):L}get multiShown(){const t=this.tool==="select"?this.multiItems:[];return t.length>=2?t:[]}selectionItems(){if(this.multi.length)return this.multiItems;const t=this.geomSel;return t&&(t.kind==="wall"||t.kind==="object")?[{id:t.id,kind:t.kind}]:this.selectedZoneId?[{id:this.selectedZoneId,kind:"zone"}]:[]}setSelection(t){if(this.multiNote="",this.selectedId=null,this.zoneVertexSel=null,this.bindOffer=null,t.length>=2){this.multi=t,this.geomSel=null,this.selectedZoneId=null;return}this.multi=[];const e=t[0];this.geomSel=e&&e.kind!=="zone"?{id:e.id,kind:e.kind}:null,this.selectedZoneId=e?.kind==="zone"?e.id:null}toggleSelection(t){this.setSelection(xi(this.selectionItems(),t))}get pickableZones(){return this.showZones?this.zones:[]}onGeomBox(t){const e=this.studio.doc,s=this.bundle;if(!this.multiOn||!e||!s)return;const i=_i(e,this.pickableZones,t,this.activeLevel,s.width,s.height,S(e).scale);if(!t.add){this.setSelection(i);return}const o=this.selectionItems(),a=new Set(o.map(r=>r.id));this.setSelection([...o,...i.filter(r=>!a.has(r.id))])}selectAll(){const t=this.studio.doc;t&&this.setSelection(Ot(t,this.pickableZones,this.activeLevel))}multiDragged(t,e){if(!this.multiMember(e))return null;const s=this.multiShown,i=s.filter(y=>y.kind!=="zone").map(y=>y.id),o=new Map(this.zones.map(y=>[y.id,y])),a=s.filter(y=>y.kind==="zone").map(y=>o.get(y.id)).filter(y=>!!y),r=this.bundle,l=o.get(e.id)?.polygon[0],d=e.kind==="object"?t.objects.find(y=>y.id===e.id)?.position:e.kind==="wall"?t.walls.find(y=>y.id===e.id)?.polyline[0]:l&&[l.x,l.y],h=e.ctrl?0:this.gridPx(t),[u,p]=r&&d&&h?Si(d,e.x-e.sx,e.y-e.sy,h,r.width,r.height):[e.x-e.sx,e.y-e.sy],[b,w]=Di(t,i,u,p,a.map(y=>y.polygon));return{doc:zi(t,i,b,w),zones:Object.fromEntries(a.map(y=>[y.id,Ii(y.polygon,b,w)]))}}multiMember(t){return(t.kind==="object"||t.kind==="wall"||t.kind==="zone")&&this.multiShown.some(e=>e.id===t.id)}async commitZoneMoves(t){const e=this.multi,s=new Map(this.zones.map(h=>[h.id,h])),i=Object.entries(t).map(([h,u])=>({z:s.get(h),polygon:u})).filter(h=>!!h.z&&JSON.stringify(h.z.polygon)!==JSON.stringify(h.polygon));if(!i.length||this.bundle?.source==="demo"){this.zonePreview=null;return}this.zonePreview=t,this.zoneSaving=!0;let o=[];try{o=(await Promise.allSettled(i.map(u=>this.sendZonePatch(u.z,{polygon:u.polygon})))).map(u=>u.status==="fulfilled"?u.value:k(u.reason))}finally{this.zonePreview=null,this.zoneSaving=!1}const a=i.map((h,u)=>({id:h.z.id,why:o[u]})).filter(h=>h.why!=="ok");if(!a.length)return;const r=a.some(h=>h.why==="conflict");r&&await this.load();const l=r?n("אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש"):a[0].why;if(this.error=n("{failedCount} מתוך {movesCount} אזורים לא הוזזו ({why}). שאר הבחירה זזה; האזורים שלא זזו נבחרו לבדם - גרור אותם למקומם (ביטול ב-Ctrl+Z מחזיר רק קירות ועצמים, לא אזורים)",{failedCount:a.length,movesCount:i.length,why:l}),this.tool!=="select"||this.multi!==e)return;const d=new Set(this.zones.map(h=>h.id));this.setSelection(a.filter(h=>d.has(h.id)).map(h=>({id:h.id,kind:"zone"})))}async deleteMulti(){const t=this.multiShown;if(!t.length||!this.studio.doc||this.zoneSaving)return;const e=new Map(this.zones.map(p=>[p.id,p])),s=t.filter(p=>p.kind==="zone").map(p=>e.get(p.id)).filter(p=>!!p),i=this.bundle?.source==="demo",o=t.length-s.length,a=s.length===1?n('את "{name}"',{name:s[0].name}):n("{zsCount} אזורים",{zsCount:s.length}),r=o?n("למחוק {zonesText} יחד עם {countLabel}?",{zonesText:a,countLabel:z(o,n("הפריט האחר שנבחר"),n("הפריטים האחרים שנבחרו"))}):n("למחוק {zonesText}?",{zonesText:a});if(s.length&&!i&&!await Y({body:n("{ask} מחיקת אזור אינה ניתנת לביטול; המצלמות והישויות בקומה לא מושפעות.",{ask:r}),danger:!0}))return;const l=t.filter(p=>p.kind!=="zone").map(p=>p.id);if(l.length&&this.edit(p=>Mi(p,l)),this.setSelection([]),!s.length)return;if(i){this.flash(n("נתוני הדגמה: אזורים נמחקים רק מול השרת."),3e3);return}this.zoneBusy=!0,this.error="";let d=[];try{const p=await Promise.allSettled(s.map(b=>this.sendZoneDelete(b)));d=s.map((b,w)=>({z:b,why:p[w].status==="fulfilled"?p[w].value:k(p[w].reason)})).filter(b=>b.why!=="ok")}finally{this.zoneBusy=!1}if(!d.length)return;this.error=n("{failedCount} מתוך {zsCount} אזורים לא נמחקו ({why}); הם נבחרו שוב כדי לנסות שוב",{failedCount:d.length,zsCount:s.length,why:d[0].why});const h=new Set(this.zones.map(p=>p.id)),u=!this.multi.length&&!this.geomSel&&!this.selectedZoneId&&!this.selectedId;this.tool==="select"&&u&&this.setSelection(d.filter(p=>h.has(p.z.id)).map(p=>({id:p.z.id,kind:"zone"})))}duplicateMulti(){const t=this.bundle,e=this.studio.doc,s=this.multiShown.filter(o=>o.kind==="object").map(o=>o.id);if(!t||!e||!s.length||this.zoneSaving)return;const i=Ci(e,s,t.width,t.height,S(e).scale);i.ids.length&&(this.edit(()=>i.doc),this.setSelection(i.ids.map(o=>({id:o,kind:"object"}))))}handleMultiKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();return e&&!t.shiftKey&&!t.altKey&&(t.code==="KeyA"||s==="a")?(t.preventDefault(),this.selectAll(),!0):this.multiShown.length<2||this.geomPreview||this.zoneSaving?!1:t.key==="Delete"||t.key==="Backspace"?(t.preventDefault(),this.deleteMulti(),!0):e&&s==="d"?(t.preventDefault(),this.duplicateMulti(),!0):!1}renderMultiPanel(){const t=this.multiShown,e=this.studio.doc,s=i=>t.filter(o=>o.kind===i).length;return zo({walls:s("wall"),objects:s("object"),zones:s("zone"),busy:this.zoneBusy||this.zoneSaving,saveState:this.studio.saveState,tags:ke(e,this.zones,t),levels:e.levels,circuits:e.circuits,lights:this.lightIds(e,t).length,note:this.multiNote,alignable:this.alignIds(e,t).length},{duplicate:()=>this.duplicateMulti(),remove:()=>void this.deleteMulti(),clear:()=>this.setSelection([]),addTag:i=>void this.bulkTag(i,!0),removeTag:i=>void this.bulkTag(i,!1),setLevel:i=>void this.bulkLevel(i),joinCircuit:i=>this.bulkCircuit(i),align:i=>this.bulkAlign(i),distribute:i=>this.bulkAlign(i)})}alignIds(t,e){const s=new Map(t.objects.map(i=>[i.id,i]));return e.filter(i=>i.kind==="object"&&s.has(i.id)&&!s.get(i.id).anchor_ref).map(i=>i.id)}bulkAlign(t){const e=this.studio.doc,s=this.bundle,i=this.multiShown;if(!e||!s||i.length<2||this.zoneSaving)return;const o=this.alignIds(e,i),{scale:a}=S(e),r=t==="x"||t==="y"?Pi(e,o,t,s.width,s.height,a):Oi(e,o,t,s.width,s.height,a),l=new Map(e.objects.map(u=>[u.id,u])),d=r.objects.filter(u=>l.get(u.id)!==u).length;this.edit(()=>r);const h=t==="x"?n("פיזור לרוחב"):t==="y"?n("פיזור לגובה"):n("יישור");this.multiNote=d?n("{action}: {countLabel} (ביטול ב-Ctrl+Z)",{action:h,countLabel:z(d,n("עצם אחד זז"),n("עצמים זזו"))}):n("{action}: העצמים כבר במקומם, שום דבר לא זז",{action:h})}lightIds(t,e){const s=this.library;if(!s)return[];const i=new Map(t.objects.map(o=>[o.id,o]));return e.filter(o=>{const a=o.kind==="object"?i.get(o.id):void 0;return!!a&&$e(R(s,a.item_id))}).map(o=>o.id)}async patchZones(t,e){const s=t.map(o=>({z:o,body:e(o)})).filter(o=>o.body!==null);if(!s.length)return{sent:0,failed:[]};this.zoneBusy=!0,this.zoneSaving=!0;let i=[];try{const o=await Promise.allSettled(s.map(a=>this.sendZonePatch(a.z,a.body)));i=s.map((a,r)=>({z:a.z,why:o[r].status==="fulfilled"?o[r].value:k(o[r].reason)})).filter(a=>a.why!=="ok")}finally{this.zoneBusy=!1,this.zoneSaving=!1}if(i.some(o=>o.why==="conflict")){const o=this.multiNote;await this.load(),this.multiNote=o}return{sent:s.length,failed:i}}multiZones(t){const e=new Map(this.zones.map(s=>[s.id,s]));return{zs:t.filter(s=>s.kind==="zone").map(s=>e.get(s.id)).filter(s=>!!s),demo:this.bundle?.source==="demo"}}zoneFailText(t){if(!t.failed.length)return"";const e=t.failed.some(s=>s.why==="conflict")?n("אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש"):t.failed[0].why;return n(" · {failedCount} מתוך {sent} אזורים לא עודכנו ({why})",{failedCount:t.failed.length,sent:t.sent,why:e})}async bulkTag(t,e){const s=this.studio.doc,i=this.multiShown;if(!s||i.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,a=new Set(i.filter($=>$.kind!=="zone").map($=>$.id)),r=[...a],{zs:l,demo:d}=this.multiZones(i),h=$=>e&&($?.length??0)>=At&&Et($,t)===$,u=[...s.walls,...s.objects].filter($=>a.has($.id)&&h($.tags)).length+l.filter($=>h($.tags)).length,p=Ti(s,r,t,e),b=new Map([...s.walls,...s.objects].map($=>[$.id,$])),w=[...p.walls,...p.objects].filter($=>a.has($.id)&&b.get($.id)!==$).length;this.edit(()=>p);const y=$=>{const F=e?Ie($.tags,t):Et($.tags,t);return F===$.tags||!$.tags&&!F.length?null:{tags:F}},x=d?{sent:0,failed:[]}:await this.patchZones(l,y);if(this.multi!==o)return;const D=w+x.sent-x.failed.length;this.multiNote=(e?n('התגית "{tag}" נוספה ל־{changed} מתוך {itemsCount} פריטים',{tag:t,changed:D,itemsCount:i.length}):n('התגית "{tag}" הוסרה מ־{changed} פריטים',{tag:t,changed:D}))+(u?n(" · {countLabel} כבר עם {TAG_MAX_COUNT} תגיות",{countLabel:z(u,n("פריט אחד"),n("פריטים")),TAG_MAX_COUNT:At}):"")+(d&&l.length?n(" · נתוני הדגמה: אזורים נשמרים רק מול השרת"):"")+this.zoneFailText(x)}async bulkLevel(t){const e=this.studio.doc,s=this.multiShown,i=e?.levels.find($=>$.id===t);if(!e||!i||s.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,a=s.filter($=>$.kind!=="zone").map($=>$.id),r=T(e),{zs:l,demo:d}=this.multiZones(s),h=new Set(a),u=[...e.walls,...e.objects].filter($=>h.has($.id)&&$.level_id!==t).length,p=this.activeLevel!==null&&this.activeLevel!==t,b=$=>($.level_id||r)!==t;this.edit($=>Ai($,a,t));const w=d?{sent:0,failed:[]}:await this.patchZones(l,$=>b($)?{level_id:t}:null);if(this.multi!==o)return;const y=new Set(d?l.filter(b).map($=>$.id):w.failed.map($=>$.z.id));y.size&&this.setSelection(this.multiItems.filter($=>!y.has($.id))),p&&(this.levelFilter=t);const x=u+w.sent-w.failed.length,D=n('{countLabel} למפלס "{name}"',{countLabel:z(x,n("פריט אחד הועבר"),n("פריטים הועברו")),name:i.name})+(d&&l.length?n(" · נתוני הדגמה: אזורים נשמרים רק מול השרת"):"")+this.zoneFailText(w)+(y.size?` · ${z(y.size,n("האזור שלא הועבר הוצא מהבחירה"),n("האזורים שלא הועברו הוצאו מהבחירה"))}`:"");this.multiNote=D,w.failed.length&&(this.error=D)}bulkCircuit(t){const e=this.studio.doc,s=this.multiShown,i=e?.circuits.find(l=>l.id===t);if(!e||!i||s.length<2)return;const o=new Set(this.lightIds(e,s)),a=Li(e,t,s.filter(l=>l.kind==="object").map(l=>l.id),l=>o.has(l.id));this.edit(()=>a.doc);const r=s.length-a.added.length;this.multiNote=r?n('{addedCount} מתוך {itemsCount} פריטים שנבחרו נוספו למעגל "{name}"; {countLabel}',{addedCount:a.added.length,itemsCount:s.length,name:i.name,countLabel:z(r,n("האחר אינו גוף תאורה"),n("האחרים אינם גופי תאורה"))}):n('{countLabel} למעגל "{name}"',{countLabel:z(a.added.length,n("גוף תאורה אחד נוסף"),n("גופי תאורה נוספו")),name:i.name})}get shownTags(){const t=this.studio.doc;return t?this.memo("shownTags",[t,this.zones,this.showZones,this.activeLevel],()=>ke(t,this.pickableZones,Ot(t,this.pickableZones,this.activeLevel))):L}selectByTag(t){const e=this.studio.doc;if(!e||(this.tool!=="select"&&this.pickTool("select"),!this.multiOn))return;const s=Ei(e,this.pickableZones,t,this.activeLevel);this.setSelection(s),s.length||this.flash(n('אין פריטים עם התגית "{tag}" במפלס המוצג',{tag:t}),3e3)}wallLengthM(t,e){const s=this.bundle;return s?Ht(t,s.width,s.height)*S(e).scale:0}dragged(t,e){const s=this.bundle;if(!s||e.kind==="zone")return null;const i=[e.x,e.y];if(e.kind==="object"||e.kind==="object-duplicate"){const r=t.objects.find(w=>w.id===e.id);if(!r)return null;if(r.anchor_ref)return{doc:t,sel:{id:e.id,kind:"object"}};const l=[r.position[0]+e.x-e.sx,r.position[1]+e.y-e.sy],d=this.geomSel?.kind==="group"&&r.group_id===this.geomSel.id?r.group_id:null,h=this.canvas?.zoom??1,u=e.ctrl?{gridPx:0,tolPx:0}:{gridPx:this.gridPx(t),tolPx:d?0:qi/h},p=Ni(r,l,u.tolPx?this.alignTargets(t,e.kind==="object"?e.id:""):[],u,s.width,s.height,S(t).scale),b=p.position;if(e.kind==="object-duplicate"){this.dupId??=xe();const w=ji(t,e.id,b,this.dupId);return{doc:w.doc,sel:{id:w.id,kind:"object"},guides:p.guides}}return d?{doc:Fi(t,d,b[0]-r.position[0],b[1]-r.position[1]),sel:{id:d,kind:"group"}}:{doc:_e(t,e.id,b),sel:{id:e.id,kind:"object"},guides:p.guides}}if(e.kind==="object-rotate"){const r=t.objects.find(l=>l.id===e.id);return!r||r.anchor_ref?null:{doc:ot(t,e.id,{rotation_deg:Ri(r,i,s.width,s.height,e.shift?15:1)}),sel:{id:e.id,kind:"object"}}}if(e.kind==="object-stretch"){const r=t.objects.find(d=>d.id===e.id);if(!r)return null;const l=Zi(r,e.index%4,i,s.width,s.height,S(t).scale,e.shift);return{doc:ot(t,e.id,{size:l}),sel:{id:e.id,kind:"object"}}}if(e.kind==="connector-vertex"){const r=t.connectors.find(l=>l.id===e.id);return!r||jt(r)?null:{doc:Gi(t,e.id,e.index,this.snap(i,null,!0)),sel:{id:e.id,kind:"connector"}}}if(e.kind==="connector"){const r=t.connectors.find(l=>l.id===e.id);return!r||jt(r)?null:{doc:Bi(t,e.id,e.x-e.sx,e.y-e.sy),sel:{id:e.id,kind:"connector"}}}if(e.kind==="wall"){const r=t.walls.find(l=>l.id===e.id);return r?{doc:Se(t,r.id,...this.wallDelta(t,r,e)),sel:{id:r.id,kind:"wall"}}:null}if(e.kind==="segment")return{doc:Gs(t,e.id,e.index,[e.x,e.y],s.width,s.height),sel:{id:e.id,kind:"wall",segment:e.index}};if(e.kind==="curve-point"||e.kind==="vertex"&&t.walls.some(r=>r.id===e.id&&it(r,e.index)>=0)){const r=t.walls.find(d=>d.id===e.id),l=r?this.movedCurvePoint(t,r,it(r,e.index),[e.x,e.y],e.ctrl):null;return l?{doc:l.doc,sel:{id:e.id,kind:"wall",vertex:l.vertex}}:null}if(e.kind==="vertex"){const r=t.walls.find(D=>D.id===e.id);if(!r)return null;const l=r.polyline,d=l.length-1,h=Lt(l),u=h&&e.index===d?0:e.index,p=h?d:l.length,b=h?[(u+p-1)%p,u,(u+1)%p]:[u-1,u,u+1],w={...r,polyline:l.slice(0,p).filter((D,$)=>!b.includes($)),bulges:void 0},y=[...t.walls.filter(D=>D.id!==e.id),w],x=nt(i,u>0?l[u-1]:null,y,s.width,s.height,{tolPx:G/(this.canvas?.zoom??1),free:!0});return{doc:h&&u===0?q(q(t,e.id,0,x),e.id,d,x):q(t,e.id,u,x),sel:{id:e.id,kind:"wall",vertex:u}}}if(e.kind==="opening"){const r={id:e.id,kind:"opening"},l=t.openings.find(w=>w.id===e.id),d=l&&t.walls.find(w=>w.id===l.wall_id),h=l&&d?at(i,[d],s.width,s.height,Number.POSITIVE_INFINITY):null,u=l&&d?at([e.sx,e.sy],[d],s.width,s.height,Number.POSITIVE_INFINITY):null;if(!l||!d||!h||!u)return{doc:t,sel:r};const[p,b]=dt(l.width_m,this.wallLengthM(d,t));return{doc:_t(t,e.id,{t:Math.min(b,Math.max(p,l.t+h.t-u.t))}),sel:r}}const o=t.labels.find(r=>r.id===e.id),a={id:e.id,kind:"label"};return o?{doc:rt(t,e.id,{position:[o.position[0]+e.x-e.sx,o.position[1]+e.y-e.sy]}),sel:a}:{doc:t,sel:a}}wallDelta(t,e,s){const i=this.bundle;let o=s.x-s.sx,a=s.y-s.sy;if(!i)return[o,a];s.shift&&(Math.abs(o*i.width)>=Math.abs(a*i.height)?a=0:o=0);const r=this.shownWalls(t).filter(p=>p.id!==e.id),l=G/(this.canvas?.zoom??1);let d=null,h=Number.POSITIVE_INFINITY;const u=Lt(e.polyline)?e.polyline.slice(0,-1):e.polyline;for(const p of u){const b=[p[0]+o,p[1]+a],w=nt(b,null,r,i.width,i.height,{tolPx:l,free:!0}),y=[w[0]-b[0],w[1]-b[1]],x=Math.hypot(y[0]*i.width,y[1]*i.height);x>0&&x<h&&(d=y,h=x)}return d&&!s.shift?(o+=d[0],a+=d[1]):d&&a===0?o+=d[0]:d&&(a+=d[1]),[o,a]}queueDragMove(t){this.dragMovePending=t,!this.dragMoveFrame&&(this.dragMoveFrame=requestAnimationFrame(()=>{this.dragMoveFrame=0;const e=this.dragMovePending;this.dragMovePending=null,e&&this.onGeomDragMove(e)}))}cancelDragMove(){this.dragMoveFrame&&cancelAnimationFrame(this.dragMoveFrame),this.dragMoveFrame=0,this.dragMovePending=null}onGeomDragMove(t){const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.geomPreview=null;return}const s=e?this.multiDragged(e,t):null;if(s){this.geomPreview=s.doc,this.zonePreview=s.zones,this.guides=[];return}const i=e?this.dragged(e,t):null;this.geomPreview=i?.doc??null,this.guides=i?.guides??[],i&&this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex)}onGeomDrag(t){this.geomPreview=null,this.guides=[];const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.flash(n("האזורים של ההזזה הקודמת עדיין נשמרים; גרור שוב בעוד רגע"),3e3);return}const s=e?this.multiDragged(e,t):null;if(s){this.edit(()=>s.doc),this.commitZoneMoves(s.zones);return}const i=e?this.dragged(e,t):null;this.guideCache=null,i&&(this.edit(()=>i.doc),this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex),this.dupId=null,i.sel.kind==="object"&&this.offerBinding(i.sel.id))}nudgeGeom(t){const e=this.geomSel,s=this.bundle,i=this.studio.doc;if(!e||!s||!i||this.geomPreview||this.wallDraft||t.ctrlKey||t.metaKey||t.altKey)return!1;const{scale:o,estimated:a}=S(i),r=a?(t.shiftKey?.01:.002)*s.width:(t.shiftKey?.1:.01)/o;let l,d=e.id;if(e.kind==="opening"){const u=i.openings.find($=>$.id===e.id),p=u&&i.walls.find($=>$.id===u.wall_id),b=p?Ht(p,s.width,s.height):0;if(!u||!p||!(b>0))return!1;const[w,y]=pt(p,u.t,s.width,s.height),x=Math.abs(w)>=Math.abs(y);let D=0;if(x&&t.key==="ArrowRight"?D=Math.sign(w):x&&t.key==="ArrowLeft"?D=-Math.sign(w):!x&&t.key==="ArrowDown"?D=Math.sign(y):!x&&t.key==="ArrowUp"&&(D=-Math.sign(y)),t.preventDefault(),!D)return!0;l=_t(i,u.id,{t:Vi(u.t,D*r/b,dt(u.width_m,this.wallLengthM(p,i)))})}else{const u=(t.key==="ArrowRight"?r:t.key==="ArrowLeft"?-r:0)/s.width,p=(t.key==="ArrowDown"?r:t.key==="ArrowUp"?-r:0)/s.height;if(e.kind==="object"){const b=i.objects.find(w=>w.id===e.id);if(!b||b.anchor_ref)return!1;l=_e(i,b.id,[b.position[0]+u,b.position[1]+p])}else if(e.kind==="label"){const b=i.labels.find(w=>w.id===e.id);if(!b)return!1;l=rt(i,b.id,{position:[b.position[0]+u,b.position[1]+p]})}else{const b=i.walls.find(y=>y.id===e.id),w=e.vertex;if(!this.geomSelectMode||!b)return!1;if(w===void 0)l=Se(i,b.id,u,p),d=`${b.id}:all`;else{if(!b.polyline[w])return!1;const y=[b.polyline[w][0]+u,b.polyline[w][1]+p],x=b.polyline.length-1,D=it(b,w);if(D>=0){const $=this.movedCurvePoint(i,b,D,y,!0);if(!$)return!1;l=$.doc,this.geomSel={id:b.id,kind:"wall",vertex:$.vertex}}else l=Lt(b.polyline)&&w===0?q(q(i,b.id,0,y),b.id,x,y):q(i,b.id,w,y);d=`${b.id}:${D>=0?`p${D}`:w}`}}}t.preventDefault();const h=u=>JSON.stringify(e.kind==="opening"?u.openings.find(p=>p.id===e.id):e.kind==="label"?u.labels.find(p=>p.id===e.id):e.kind==="object"?u.objects.find(p=>p.id===e.id):u.walls.find(p=>p.id===e.id));return h(l)!==h(i)&&this.commitNudge(d,l),!0}commitNudge(t,e){const s=this.studio.doc;if(!s)return;const i=performance.now(),o=this.nudgeBurst;o&&o.key===t&&o.doc===s&&i-o.at<Ea&&this.studio.canUndo&&this.studio.undo(),this.studio.commit(e),this.lastEdit="structure",this.nudgeBurst={key:t,doc:e,at:i}}handleStudioKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();if(t.key==="Enter"&&this.doorGhost)return t.preventDefault(),this.acceptDoorGhost(),!0;if(t.key==="Enter"&&this.wallDraft)return t.preventDefault(),this.finishWall(),!0;if(t.key==="Enter"&&this.curveDraft)return t.preventDefault(),this.finishCurve(!1),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.curveDraft)return t.preventDefault(),this.curveUndoPoint(),!0;if((t.ctrlKey||t.metaKey)&&this.curveDraft&&(t.key.toLowerCase()==="z"||t.key.toLowerCase()==="y"))return t.preventDefault(),t.key.toLowerCase()==="y"||t.shiftKey?this.curveRedoPoint():this.curveUndoPoint(),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.wallDraft)return t.preventDefault(),this.wallDraft=this.wallDraft.length>1?this.wallDraft.slice(0,-1):null,this.lastDrawClick=null,!0;if(this.tool==="detect"&&(t.key==="Delete"||t.key==="Backspace")&&this.candSel)return t.preventDefault(),(this.candStates[this.candSel]??"accepted")==="accepted"&&this.toggleCandidate(this.candSel),!0;if(this.detectBusy&&e&&(s==="z"||s==="y"))return!0;if((t.key==="Delete"||t.key==="Backspace")&&this.geomSel){t.preventDefault();const{id:i,kind:o,vertex:a}=this.geomSel;if(o==="group")return this.groupDelete=i,!0;const r=o==="connector"?this.studio.doc?.connectors.find(h=>h.id===i):void 0;if(r&&jt(r))return this.flash(n("המחבר נגזר מעצם: מוחקים או עורכים את העצם עצמו"),4e3),!0;if(r&&r.floor_ids.length)return this.removeConnector(i),!0;const l=o==="wall"&&a!==void 0?this.studio.doc?.walls.find(h=>h.id===i):void 0,d=l&&a!==void 0?it(l,a):-1;if(l&&d>=0&&this.bundle){const h=this.bundle,u=this.studio.doc,p=u?pe(u,i,d,h.width,h.height):null;return p&&this.edit(()=>p.doc),this.geomSel=p&&!p.wallRemoved?{id:i,kind:o}:null,!0}if(o==="wall"&&a!==void 0&&this.geomSelectMode){const h=this.studio.doc,u=h?Wi(h,i,a):null;return u&&this.edit(()=>u.doc),this.geomSel=u&&!u.wallRemoved?{id:i,kind:o}:null,!0}return this.edit(h=>K(h,i)),this.geomSel=null,!0}return e&&s==="d"&&this.geomSel?.kind==="object"&&(this.tool==="library"||this.tool==="select")&&this.studio.doc&&!this.geomPreview?(t.preventDefault(),this.duplicateSel(this.geomSel.id),!0):Na.includes(t.key)&&(this.tool==="structure"||this.tool==="library"||this.tool==="select")&&this.nudgeGeom(t)?!0:e&&(s==="z"||s==="y")?(t.preventDefault(),s==="y"||t.shiftKey?this.redoAny():this.undoAny(),!0):e&&s==="s"?(t.preventDefault(),this.studio.flush(),this.tool==="select"&&this.dirty.size&&this.save(),!0):!1}duplicateSel(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;const i=Ui(s,t,e.width,e.height,S(s).scale);i.id!==t&&(this.edit(()=>i.doc),this.geomSel={id:i.id,kind:"object"})}focusGeom(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;this.activeLevel!==null&&!me(s,t,this.activeLevel)&&(this.levelFilter=null),this.multi=[];const i=s.walls.find(u=>u.id===t),o=s.openings.find(u=>u.id===t),a=s.labels.find(u=>u.id===t),r=o?s.walls.find(u=>u.id===o.wall_id):void 0,l=s.objects.find(u=>u.id===t),d=i?j(i,.5,e.width,e.height):o&&r?j(r,o.t,e.width,e.height):a?a.position:l?l.position:null;if(l){this.pickTool("library"),this.geomSel={id:t,kind:"object"},d&&this.canvas?.centerOn(d[0],d[1]);return}const h=s.connectors.find(u=>u.id===t);if(h){this.pickTool("connectors"),this.geomSel={id:t,kind:"connector"};const u=h.polyline[Math.floor(h.polyline.length/2)];u&&this.canvas?.centerOn(u[0],u[1]);return}this.tool="structure",this.studioMode="select",this.wallDraft=null,this.geomSel=i?{id:t,kind:"wall"}:o?{id:t,kind:"opening"}:a?{id:t,kind:"label"}:null,d&&this.canvas?.centerOn(Math.min(1,Math.max(0,d[0])),Math.min(1,Math.max(0,d[1])))}async copyStructure(t){const e=this.bundle;if(e?.planVersionId){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}await cn(e.planVersionId,t),await this.loadStudio(e,!0)&&this.flash(n("המבנה הועתק לטיוטה; בדוק מיקומים ופרסם"),4e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}takeDxf(t){const e=Sn(t);this.presetCandidates="",e&&(this.showCandidates(e,"dxf"),this.pickTool("detect"))}showCandidates(t,e){const s=this.studio.doc;let i=Dn(t);if(s&&e==="detect"){const{scale:o}=S(s);(i.scaleMPerPx===null||Math.abs(i.scaleMPerPx-o)>o*1e-6)&&(i=Ee(i,o))}this.cands={set:i,result:t,source:e},this.candStates=In(i),this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}async runDetect(){const e=this.bundle?.planVersionId;if(!e||this.detectRun.busy||this.busy||!this.detectOpts.walls)return;const s=++this.detectToken,i=this.detectRun.limitS,o=Date.now();this.detectRun={busy:!0,startedAt:o,elapsed:0,error:"",timedOut:!1,limitS:i};const a=()=>s===this.detectToken&&this.bundle?.planVersionId===e;clearInterval(this.elapsedTimer),this.elapsedTimer=setInterval(()=>{const r=Math.floor((Date.now()-o)/1e3);s===this.detectToken&&r!==this.detectRun.elapsed&&(this.detectRun={...this.detectRun,elapsed:r})},1e3);try{if(!await this.studio.flush()){a()&&(this.error=this.studio.error);return}if(!a())return;const r=this.detectOpts.openings?["walls","openings"]:["walls"],l=this.detectOpts,d=await un(e,{targets:r,strength:l.strength,hollow_walls:l.hollow!==!1,section_lines:l.sectionLines!==!1,join_gaps:l.joinGaps!==!1,steps_regions:l.stepsRegions!==!1,columns:l.columns!==!1});if(!a()||d.version_id!==e)return;this.showCandidates(d,"detect"),this.detectRun={busy:!1,startedAt:0,elapsed:Math.round((Date.now()-o)/1e3),error:"",timedOut:!1,limitS:i}}catch(r){if(!a())return;const l=r instanceof O&&r.code==="detect_timeout",d=r instanceof O?Number(r.body.details?.timeout_s):NaN,h=l&&d>0?d:i;this.detectRun={busy:!1,startedAt:0,elapsed:0,timedOut:l,limitS:h,error:l?n("הזיהוי לא הסתיים{v}. נסה שוב בעוצמת ניקוי נמוכה יותר (תוכנית גדולה או סריקה רועשת לוקחות זמן).",{v:h?n(" תוך {limit} שניות",{limit:h}):n(" בזמן")}):k(r)}}finally{s===this.detectToken&&(clearInterval(this.elapsedTimer),this.detectRun.busy&&(this.detectRun={...this.detectRun,busy:!1}))}}toggleCandidate(t){const e=this.cands?.set;if(!e||this.busy)return;const s=(this.candStates[t]??"accepted")==="accepted"?"rejected":"accepted",i={...this.candStates,[t]:s};if(s==="rejected")for(const o of e.openings)o.wall_id===t&&(i[o.id]="rejected");else{const o=e.openings.find(a=>a.id===t);o&&(i[o.wall_id]="accepted")}this.candStates=i,this.candSel=t,this.detectAsk=null}acceptRule(t){const e=this.cands?.set;if(!e||this.busy)return;const s=new Set(Ne(e,t));this.candStates=Object.fromEntries($t(e).map(i=>[i,s.has(i)?"accepted":"rejected"])),this.detectAsk=null}get shownCandStates(){const t=this.cands?.set.objects??[];if(!t.length)return this.candStates;const e=this.candStatesShown;if(e&&e.states===this.candStates&&e.objects===t&&e.on===this.candObjectsOn)return e.shown;const s=this.candObjectsOn?"accepted":"rejected",i={...this.candStates,...Object.fromEntries(t.map(o=>[o.id,s]))};return this.candStatesShown={states:this.candStates,objects:t,on:this.candObjectsOn,shown:i},i}get acceptedCandidateIds(){const t=this.cands?.set;if(!t)return[];const e=Ne(t,$t(t).filter(s=>(this.candStates[s]??"accepted")==="accepted"));return this.candObjectsOn?[...e,...t.objects.map(s=>s.id)]:e}focusCandidate(t){const e=this.bundle,s=this.cands?.set;if(!e||!s)return;this.candSel=t;const i=s.walls.find(l=>l.id===t),o=s.openings.find(l=>l.id===t),a=o?s.walls.find(l=>l.id===o.wall_id):void 0,r=i?j(i,.5,e.width,e.height):a&&o?j(a,o.t,e.width,e.height):null;r&&this.canvas?.centerOn(Math.min(1,Math.max(0,r[0])),Math.min(1,Math.max(0,r[1])))}onCandidateDrag(t){const e=this.cands;if(!e||this.narrow||this.busy)return;const s=zn(e.set,t.id,t.index,[t.x,t.y]);if(s===e.set)return;const i=s.walls.find(o=>o.id===t.id);i&&(this.cands={...e,set:s},this.candEdits={...this.candEdits,[t.id]:{polyline:i.polyline}},this.candSel=t.id)}discardCandidates(){this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}setSources(t){return new Set([...t.walls,...t.openings,...t.objects].map(e=>e.source))}acceptedSources(){const t=this.cands,e=new Set(this.acceptedCandidateIds),s=new Set;if(!t)return s;for(const i of[...t.set.walls,...t.set.openings,...t.set.objects])e.has(i.id)&&s.add(i.source);return s}replacedIn(t,e){const s=l=>e.has(l.source)&&l.locked!==!0,i=new Set(t.walls.filter(s).map(l=>l.id)),o=new Set(t.walls.filter(l=>!s(l)).map(l=>l.id));let a=0,r=0;for(const l of t.openings)s(l)&&!o.has(l.wall_id)?a+=1:i.has(l.wall_id)&&(r+=1);return{walls:i.size,openings:a,objects:t.objects.filter(s).length,manual:r}}replacePlan(t){if(!this.detectOpts.replaceAuto)return null;const e=this.replacedIn(t,this.acceptedSources());return e.walls+e.openings+e.objects>0?e:null}confirmCandidates(){const t=this.cands,e=this.studio.doc;if(!t||!e||!this.acceptedCandidateIds.length||this.busy)return;const s=this.replacePlan(e);if(s){this.detectAsk={existing:{walls:s.walls,openings:s.openings,objects:s.objects},manualOnAuto:s.manual};return}this.sendAccept()}async sendAccept(){const t=this.bundle,e=this.cands,s=this.acceptedCandidateIds,i=t?.planVersionId;if(!t||!i||!e||!s.length||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="",this.detectErr=null;try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o()||!this.studio.doc)return;const a=this.replacePlan(this.studio.doc)!==null,r=new Set(s),l=Object.fromEntries(Object.entries(this.candEdits).filter(([u])=>r.has(u))),d=await pn(i,{accepted:s,edits:l,replace_auto:a,candidates:{walls:e.set.walls,openings:e.set.openings,objects:e.set.objects},base_revision:this.studio.revision,detector:e.result.detector});if(o()||(this.studio.adopt(d)||await this.loadStudio(t,!0),o()))return;const h=d.merge;this.discardCandidates(),this.geomSel=null,this.flash(n("{countLabel} לטיוטת המבנה{v}{v2}; בדוק ופרסם",{countLabel:z(s.length,n("פריט אחד נוסף"),n("פריטים נוספו")),v:h?.removed_auto?n(" · {removed_auto} קודמים הוחלפו",{removed_auto:h.removed_auto}):"",v2:h?.removed_manual_openings?n(" · {countLabel} עם הקירות שלהם",{countLabel:z(h.removed_manual_openings,n("פתח ידני אחד הוסר"),n("פתחים ידניים הוסרו"))}):""}),6e3)}catch(a){if(o())return;const r=this.acceptErrorOf(a);this.detectErr=r,r.ids.length&&this.focusCandidate(r.ids[0])}finally{this.busy=!1,this.detectAsk=null}}acceptErrorOf(t){const e=this.cands?.set,s=new Set(e?[...$t(e),...e.objects.map(h=>h.id)]:[]);if(!(t instanceof O))return{code:"network",message:k(t),ids:[],issues:[],stale:!1};const i=t.body.details??{},o=Array.isArray(i.ids)?i.ids.filter(h=>typeof h=="string"):[],r=(Array.isArray(i.issues)?i.issues:[]).filter(h=>typeof h=="object"&&h!==null).map(h=>({id:typeof h.id=="string"?h.id:null,message:typeof h.message=="string"?h.message:n("בעיה במבנה")})),l=[...new Set([...o,...r.map(h=>h.id).filter(h=>!!h)])].filter(h=>s.has(h)),d={stale_revision:n("טיוטת המבנה השתנתה בינתיים (עריכה בחלון אחר). טען את הטיוטה מחדש ואשר שוב; המועמדים נשארים."),unknown_candidate:n("מועמד שסומן לאישור לא נמצא בין המועמדים שנשלחו; הרץ זיהוי מחדש."),orphan_opening:n("פתח סומן לאישור בלי הקיר שלו: קבל גם את הקיר או דחה את הפתח."),candidate_source:n("מועמד בלי מקור אוטומטי או מיובא נשלח לאישור; הרץ זיהוי מחדש."),duplicate_candidate:n("אותו מועמד נשלח פעמיים; הרץ זיהוי מחדש."),candidate_shape:n("צורת מועמד שגויה (למשל פתח בלי מזהה קיר); דחה את המסומנים ברשימה ונסה שוב."),geometry_structure:n("המועמדים שנבחרו יוצרים מבנה לא תקין, ודבר לא נשמר. דחה או תקן את המסומנים ונסה שוב.")};return{code:t.code,message:d[t.code]??k(t),ids:l,issues:r,stale:t.code==="stale_revision"}}async reloadForDetect(){const t=this.bundle;if(!(!t||this.busy)){this.busy=!0;try{await this.loadStudio(t,!0)&&(this.detectErr=null)}finally{this.busy=!1}}}get canEstimate(){return this.studio.doc?.dimensions.calibration?.status!=="measured"}rescaleCandidates(){const t=this.studio.doc,e=this.cands;t&&e&&e.source==="detect"&&(this.cands={...e,set:Ee(e.set,S(t).scale)})}async applyCalibHint(){const t=this.bundle,e=this.cands,s=e?.result.calibration_hint,i=t?.planVersionId;if(!t||!i||!e||!s||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="";try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o())return;if(!this.canEstimate){this.error=n("לתוכנית כבר יש כיול מדוד; ההערכה לא הוחלה.");return}const a=await gn(i,s.scale_m_per_px,s.reason);if(o()||!this.bundle||(this.bundle={...this.bundle,scaleMPerPx:a.scale_m_per_px},!await this.loadStudio(this.bundle,!0)||o()))return;this.rescaleCandidates(),this.hintApplied=!0,this.flash(n("קנה מידה משוער נשמר: ≈ {fmtScale}",{fmtScale:Te(a.scale_m_per_px)}),4e3)}catch(a){if(o()||!this.bundle)return;a instanceof O&&a.code==="calibration_measured"?(this.error=n("לתוכנית כבר יש כיול מדוד (כנראה מחלון אחר); הערכה לא מחליפה אותו. המידות לפי הכיול הקיים."),await this.loadStudio(this.bundle,!0)&&!o()&&this.rescaleCandidates()):this.error=k(a)}finally{this.busy=!1}}async importDxfRooms(){const t=this.bundle,e=this.cands?.result.rooms??[];if(!(!t||!e.length||this.busy)){this.busy=!0;try{const s=await Me(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name})),!1);this.zones=s.zones,this.cands=this.cands?{...this.cands,result:{...this.cands.result,rooms:[]}}:null,this.flash(n('{countLabel} כאזורים; תן להם שמות בכלי "חדרים ואזורים"',{countLabel:z(e.length,n("חדר אחד נוסף"),n("חדרים נוספו"))}),4e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}renderDetectTool(t){const e=this.studio.doc;if(!e||!t.planVersionId)return c`<sw-card heading=${n("זיהוי אוטומטי")} data-detect-panel><div class="note">${t.source==="demo"?n("נתוני הדגמה: הזיהוי עובד מול השרת."):this.error||n("טוען את טיוטת המבנה…")}</div></sw-card>`;const{scale:s,estimated:i}=S(e),o=this.cands;return Mo({opts:this.detectOpts,run:this.detectRun,cands:o?{source:o.source,set:o.set,states:this.candStates,sel:this.candSel,hint:o.result.calibration_hint,existingAuto:this.replacedIn(e,this.setSources(o.set)),elapsedMs:o.result.elapsed_ms??null,rooms:o.result.rooms?.length??0,ifc:o.result.ifc??null}:null,acceptedCount:this.acceptedCandidateIds.length,objectsOn:this.candObjectsOn,hintApplied:this.hintApplied,canEstimate:this.canEstimate,busy:this.busy,narrow:this.narrow,estimated:i,showEstimates:this.showEstimates,scale:s,autoInDraft:e.walls.filter(a=>a.source==="auto").length+e.openings.filter(a=>a.source==="auto").length,autoRemovable:Mn(e),removeAutoAsk:this.removeAutoAsk,ask:this.detectAsk,acceptError:this.detectErr},{setOpts:a=>{this.detectOpts=a,this.detectAsk=null},run:()=>void this.runDetect(),retryLighter:()=>{this.detectOpts={...this.detectOpts,strength:sn(this.detectOpts.strength)},this.runDetect()},acceptAll:()=>{o&&this.acceptRule($t(o.set))},acceptAbove:a=>{o&&this.acceptRule(On(o.set,a))},acceptKinds:a=>{o&&this.acceptRule(Pn(o.set,a))},rejectAll:()=>{this.acceptRule([]),this.busy||(this.candObjectsOn=!1)},toggle:a=>this.toggleCandidate(a),focus:a=>this.focusCandidate(a),setObjects:a=>{this.candObjectsOn=a,this.detectAsk=null},confirm:()=>this.confirmCandidates(),confirmReplace:()=>void this.sendAccept(),cancelReplace:()=>this.detectAsk=null,reload:()=>void this.reloadForDetect(),discard:()=>this.discardCandidates(),applyHint:()=>void this.applyCalibHint(),importRooms:()=>void this.importDxfRooms(),removeAuto:a=>{a==="confirm"&&this.edit(r=>Cn(r).doc),this.removeAutoAsk=a==="ask"}})}exportJson(){const t=this.studio.doc;if(!t)return;const e=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:"application/json"})),s=document.createElement("a");s.href=e,s.download=`plan-structure-${t.plan_version_id}.json`,s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}async importIfc(t){const e=this.bundle;if(!e?.planVersionId||this.busy)return;const s=e.planVersionId;this.busy=!0,this.error="",this.toaster.show(Ft("reading"),{ms:0});try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await fn(s,t,{levelId:this.activeLevel??void 0});if(this.bundle?.planVersionId!==s)return;this.showCandidates(i,"ifc"),this.pickTool("detect");const o=i.walls.length+i.openings.length+(i.objects?.length??0)+(i.rooms?.length??0);this.flash(o?Ft("loaded"):Ft("nothing"),4e3)}catch(i){this.toaster.clear(),this.error=k(i)}finally{this.busy=!1}}async exportPackage(t=!1){const e=this.bundle;if(!(!e?.planVersionId||this.busy)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const{blob:s,name:i}=await mn(e.planVersionId,!0,{dxf:t}),o=URL.createObjectURL(s),a=document.createElement("a");a.href=o,a.download=i,a.click(),setTimeout(()=>URL.revokeObjectURL(o),1e3),this.flash(_("saved"),3e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}async startPackageImport(t){if(this.bundle?.planVersionId){if(!await this.studio.flush()){this.error=this.studio.error;return}this.pkgImport={file:t,mode:"replace",preview:null,busy:null,error:"",acceptForeign:!1,foreign:null},await this.previewPackage("replace")}}async previewPackage(t){const e=this.pkgImport,s=this.bundle?.planVersionId;if(!(!e||!s||e.busy)){this.pkgImport={...e,mode:t,busy:"check",error:"",preview:e.mode===t?e.preview:null};try{const i=await vn(s,e.file,t,e.acceptForeign);this.pkgImport?.file===e.file&&(this.pkgImport={...this.pkgImport,preview:i,busy:null})}catch(i){const o=i instanceof O&&i.code==="package_foreign"?i.body.details?.origin??null:null;this.pkgImport?.file===e.file&&(this.pkgImport=o?{...this.pkgImport,preview:null,busy:null,error:"",foreign:o,acceptForeign:!1}:{...this.pkgImport,preview:null,busy:null,error:k(i)})}}}setPackageTrust(t){const e=this.pkgImport;e&&(this.pkgImport={...e,acceptForeign:t},t&&!e.preview&&e.foreign&&this.previewPackage(e.mode))}async confirmPackageImport(){const t=this.pkgImport,e=this.bundle;if(!(!t?.preview||!e?.planVersionId||t.busy)){this.pkgImport={...t,busy:"import",error:""};try{await bn(e.planVersionId,t.file,t.preview,t.acceptForeign),this.pkgImport=null,await this.loadStudio(e,!0)&&this.flash(_("imported"),4e3)}catch(s){this.pkgImport?.file===t.file&&(this.pkgImport={...this.pkgImport,busy:null,error:k(s)})}}}renderStructurePanel(t,e=!1){const s=this.studio.doc,i=t.planVersionId;return!s||!i?c`<sw-card heading=${n("מבנה")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: ציור המבנה עובד מול השרת."):this.error||n("טוען את טיוטת המבנה…")}</div></sw-card>`:Co({doc:this.geomPreview??s,W:t.width,H:t.height,mode:e?"select":this.studioMode,wallDefaults:this.wallDefaults,glassDraw:this.glassDraw,sel:this.geomSel,saveState:this.studio.saveState,saveError:this.studio.error,compact:e,conflict:this.studio.hasConflict,issues:this.studio.issues,copyCandidates:this.studio.copyCandidates,exportSvg:yt(i,"svg",{draft:!0}),exportPng:yt(i,"png",{draft:!0}),exportDxf:yt(i,"dxf",{draft:!0}),exportIfc:yt(i,"ifc",{draft:!0}),busy:this.busy,showEstimates:this.showEstimates,levels:s.levels,phone:this.phone.matches,entityChoices:this.memo("entityChoices",[this.anchors],()=>this.anchors.filter(o=>o.resource_type==="ha_entity"&&/^(binary_sensor|cover|lock)\./.test(o.resource_id)).map(o=>({id:o.resource_id,name:o.label||o.entity?.name||o.resource_id})).sort((o,a)=>o.name<a.name?-1:o.name>a.name?1:0)),materials:this.resolvedMaterials(this.geomPreview??s),materialStyle:this.matStyle},{setMaterial:(o,a,r)=>this.edit(l=>Z(ze(l,o,a,r))),setMaterialStyle:o=>this.matStyle=o,setMode:o=>{if((Pe.includes(o)||o==="curve")&&this.phone.matches){this.flash(n("ציור קירות זמין בדסקטופ בלבד; בטלפון אפשר להציב ולהזיז עצמים בודדים"),4e3);return}this.studioMode=o,this.dropDoorGhost(),this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,o!=="select"&&o!=="curve"&&(this.geomSel?.vertex!==void 0||this.geomSel?.segment!==void 0)&&(this.geomSel={id:this.geomSel.id,kind:this.geomSel.kind})},setWallDefaults:o=>{this.wallDefaults=o},setGlassDraw:o=>{o.curved!==this.glassDraw.curved&&(this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null),this.glassDraw=o},addCurvePoint:o=>{const a=this.studio.doc,r=a?Hs(a,o,t.width,t.height):null;if(!r)return;this.edit(()=>r.doc);const l=this.studio.doc?.walls.find(h=>h.id===o),d=l?ye(l):null;this.geomSel={id:o,kind:"wall",...d?{vertex:d[r.k]}:{}}},removeCurvePoint:(o,a)=>{const r=this.studio.doc,l=r?pe(r,o,a,t.width,t.height):null;l&&(this.edit(()=>l.doc),this.geomSel=l.wallRemoved?null:{id:o,kind:"wall"})},patchWall:(o,a)=>this.edit(r=>lt(r,o,a)),patchOpening:(o,a)=>this.edit(r=>_t(r,o,a)),patchLabel:(o,a)=>this.edit(r=>rt(r,o,a)),remove:o=>{this.edit(a=>K(a,o)),this.geomSel=null},focus:o=>this.focusGeom(o),copyFrom:o=>void this.copyStructure(o),exportJson:()=>this.exportJson(),exportPackage:o=>void this.exportPackage(o===!0),importPackage:o=>void this.startPackageImport(o),importIfc:o=>void this.importIfc(o),reload:()=>void this.loadStudio(t,!0),calibrate:()=>this.pickTool("calibrate"),retry:()=>{this.studio.flush().then(o=>{o&&this.loadStudio(t)}).catch(o=>{this.error=k(o)})},setLevel:(o,a)=>{this.edit(r=>r.walls.some(l=>l.id===o)?lt(r,o,{level_id:a}):rt(r,o,{level_id:a})),this.followLevel(o,a)},setSegmentRadius:(o,a,r)=>{const l=S(s).scale;if(r===null)return this.edit(u=>Ws(u,o,a,t.width,t.height));const d=this.studio.doc,h=d?Us(d,o,a,r,l,t.width,t.height):null;h?this.edit(()=>h):this.flashError(N("radiusTooSmall"))},roundCorner:(o,a,r)=>{const l=this.studio.doc,d=l?Vs(l,o,a,r,S(l).scale,t.width,t.height):null;if(!d)return this.flashError(N("cornerCannot"));this.edit(()=>d),this.geomSel={id:o,kind:"wall"}},say:o=>{this.flash(o,4e3)}})}renderLibraryTool(t,e=!1){const s=this.studio.doc,i=this.library;if(!s||!i||!t.planVersionId)return c`<sw-card heading=${n("ספריית עצמים")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: הספרייה נטענת מהשרת."):this.error||n("טוען את הספרייה…")}</div></sw-card>`;const{estimated:o}=S(s),a=t.permissions.structure,r=this.geomSel?.kind==="object"?s.objects.find(h=>h.id===this.geomSel.id):void 0,l=h=>{const u=h.anchor_ref&&this.anchors.find(p=>p.resource_type===h.anchor_ref.resource_type&&p.resource_id===h.anchor_ref.resource_id);return u?this.anchorName(u):null},d=this.geomSel?.kind==="group"?s.groups.find(h=>h.id===this.geomSel.id):void 0;return c`${d?Po(d,R(i,String(d.params.item_id??"")),{select:h=>this.geomSel={id:h,kind:"object"},askDelete:h=>this.groupDelete=h}):g}${r?Oo({o:r,item:R(i,r.item_id),levels:s.levels,doc:s,estimated:o,showEstimates:this.showEstimates,anchorName:l(r),phone:this.phone.matches,canManage:a,lib_category:h=>i.categories.find(u=>u.id===h.category)?.he??h.category,materialDefault:this.resolvedMaterials(s).objects[r.id]??"plastic",materialStyle:this.matStyle},{setMaterial:(h,u)=>this.edit(p=>Z(ze(p,"objects",h,u))),setMaterialStyle:h=>this.matStyle=h,patch:(h,u)=>{this.edit(p=>ot(p,h,u)),u.level_id!==void 0&&this.followLevel(h,u.level_id)},unbind:h=>this.edit(u=>ot(u,h,{anchor_ref:null})),remove:h=>{this.edit(u=>K(u,h)),this.geomSel=null},array:h=>this.openArray(h),custom:h=>this.openCustom(h),duplicate:h=>this.duplicateSel(h),selectGroup:h=>this.geomSel={id:h,kind:"group"}}):g}
    ${e?c`<div class="note" data-studio-save=${this.studio.saveState}>${To[this.studio.saveState]}</div>`:Ao({lib:i,q:this.libQ,category:this.libCategory,recent:this.libRecent,favorites:this.libFav,placing:this.placingItem,saveState:this.studio.saveState,phone:this.phone.matches,exportHref:Nn(),canManage:a},{setQuery:h=>this.libQ=h,setCategory:h=>this.libCategory=h,pick:h=>{this.placingItem=this.placingItem?.id===h.id?null:h,this.geomSel=null,this.bindOffer=null},toggleFavorite:h=>{this.libFav=this.libFav.includes(h)?this.libFav.filter(u=>u!==h):[...this.libFav,h],He("sw.studio.fav",this.libFav)},importFile:h=>void this.importLibrary(h),cancelPlacing:()=>this.placingItem=null})}`}get rulers(){const t=this.bundle,e=this.studio.doc;if(!t||!e)return L;const s=[t,e,this.tool,this.hover,this.connStart,this.connMode,this.walkArmed,this.walkFocus,this.activeLevel,this.calib,this.measurePts,this.showEstimates];return this.memo("rulers",s,()=>this.buildRulers(t,e))}buildRulers(t,e){const{scale:s,estimated:i}=S(e),o=(a,r)=>wt(we(a,r,t.width,t.height,s),i,this.showEstimates);if(this.tool==="connectors"&&this.connStart&&this.hover)return[{a:this.connStart,b:this.hover,label:this.connMode?Lo[this.connMode]:"",tone:"muted"}];if(this.tool==="walk"){const a=this.activeLevel,r=(e.walk_positions??[]).filter(l=>!a||l.level_id===a).map(l=>({...Ae(l,t.width,t.height),label:l.name,tone:this.walkFocus===l.id?"accent":"muted"}));return this.walkArmed&&this.hover&&r.push({...Ae({x:this.hover[0],y:this.hover[1],heading_deg:0},t.width,t.height),label:"",tone:"accent"}),r}if(this.tool==="calibrate"){const{a,b:r,metres:l}=this.calib,d=r??this.hover;return!a||!d?[]:[{a,b:d,label:r?parseFloat(l)>0?n("{metres} מ׳",{metres:l}):n("? מ׳"):"",tone:r?"accent":"muted"}]}if(this.tool==="measure"){const a=this.measurePts,r=this.hover&&a.length?[...a,this.hover]:a,l=[];for(let d=1;d<r.length;d++)l.push({a:r[d-1],b:r[d],label:o(r[d-1],r[d]),tone:d>a.length-1?"muted":"accent"});return a.length>=3&&l.push({a:a[a.length-1],b:a[0],label:"",tone:"muted"}),l}return[]}addCalibPair(){const{a:t,b:e,metres:s,pairs:i}=this.calib,o=parseFloat(s);!t||!e||!(o>0)||i.length>=3||(this.calib={...this.calib,a:null,b:null,metres:"",pairs:[...i,{a:t,b:e,metres:o}]})}async saveCalibration(){const t=this.bundle,{a:e,b:s,metres:i,pairs:o}=this.calib,a=parseFloat(i),r=[...o,...e&&s&&a>0?[{a:e,b:s,metres:a}]:[]];if(!(!t?.planVersionId||!r.length)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const l=await wn(t.planVersionId,r);await this.loadStudio(t,!0);const d=r.length>1&&l.residual_pct!==null?n(" · {allCount} זוגות, סטייה {residual_pct}%",{allCount:r.length,residual_pct:l.residual_pct.toFixed(1)}):"";this.calib={...U,result:n("קנה המידה נשמר: {fmtScale}{residual}",{fmtScale:Te(l.scale_m_per_px),residual:d}),warning:l.warning??""}}catch(l){this.error=k(l)}finally{this.busy=!1}}}async loadSideData(t){t.planVersionId&&t.permissions.structure?yn(t.planVersionId).then(e=>{this.bundle===t&&(this.geomVersions=e.versions)},()=>{this.geomVersions=[]}):this.geomVersions=[],Ds(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.areas=e.areas)},()=>{this.areas=[]}),ha(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.floorImages=e,this.alignDraft=null)},()=>{this.floorImages=null})}async rollbackStructure(t){const e=this.bundle;if(!(!e?.planVersionId||!t.id)&&await Y({body:n("לשחזר את המבנה שפורסם ב-{fmtWhen}? המבנה הנוכחי נשמר בהיסטוריה.",{fmtWhen:X(t.published_at)})})){this.busy=!0,this.error="";try{await $n(e.planVersionId,t.id),this.flash(n("המבנה שוחזר ופורסם; הצופים רואים אותו עכשיו"),4e3),await this.loadStudio(e,!0),await this.loadVersions()}catch(s){this.error=k(s)}finally{this.busy=!1}}}renderStructureHistory(t){if(!t.permissions.structure||!this.geomVersions.length)return g;const e=s=>[s.walls?n("{walls} קירות",{walls:s.walls}):"",s.openings?n("{openings} פתחים",{openings:s.openings}):"",s.objects?n("{objects} עצמים",{objects:s.objects}):"",s.connectors?n("{connectors} מחברים",{connectors:s.connectors}):""].filter(Boolean).join(" · ")||n("מבנה ריק");return c`<div class="row" style="margin-block-start:10px"><span class="lbl">${n("היסטוריית המבנה")}<span class="muted">${n("כל פרסום של קירות, פתחים ועצמים נשמר; שחזור מפרסם מחדש גרסה מהארכיון כגרסה חדשה")}</span></span></div>
      <div class="vlist" data-geom-version-list>
        ${this.geomVersions.map(s=>c`<div class="vrow ${s.status==="published"?"cur":""}" data-geom-version-row data-geom-version-id=${s.id??""} data-geom-version-status=${s.status}>
          <div class="meta">
            <span><sw-badge kind=${s.status==="published"?"recorded":"neutral"} label=${s.status==="published"?n("מפורסם"):n("ארכיון")}></sw-badge> <span class="ltr">${X(s.published_at??s.created_at)}</span>${s.archived_at?c` <span class="note">${n("עד {fmtWhen}",{fmtWhen:X(s.archived_at)})}</span>`:g}</span>
            <span class="note">${e(s.counts)}${s.published_by?` · ${s.published_by}`:""}</span>
          </div>
          <div class="acts">
            ${s.status==="archived"&&t.permissions.publish?c`<sw-button size="sm" icon="history" data-geom-rollback ?disabled=${this.busy} @click=${()=>void this.rollbackStructure(s)}>${n("שחזר מבנה")}</sw-button>`:g}
          </div>
        </div>`)}
      </div>`}async uploadImage(t,e){const s=this.bundle,i=e.files?.[0];if(e.value="",!(!s||!i)){this.imageBusy=!0,this.imageNote="";try{await ca(s.floorId,t,i),this.imageNote=t==="off"?n("תמונת הקומה נשמרה"):n("תמונת התאורה נשמרה"),await this.loadSideData(s),await this.load()}catch(o){this.imageNote=k(o)}finally{this.imageBusy=!1}}}async removeImage(t){const e=this.bundle;if(!(!e||!await Y({body:t==="off"?n("להסיר את תמונת הקומה?"):n("להסיר את תמונת התאורה?"),danger:!0}))){this.imageBusy=!0;try{await ua(e.floorId,t),this.imageNote=n("התמונה הוסרה"),await this.loadSideData(e),await this.load()}catch(s){this.imageNote=k(s)}finally{this.imageBusy=!1}}}async saveAlignment(){const t=this.bundle,e=this.alignDraft;if(!(!t||!e)){this.imageBusy=!0;try{const s=await pa(t.floorId,e.corners,e.opacity);this.floorImages=this.floorImages?{...this.floorImages,layout:s}:this.floorImages,this.alignDraft=null,this.imageNote=n("היישור נשמר"),await this.load()}catch(s){this.imageNote=k(s)}finally{this.imageBusy=!1}}}alignWalls(t){const e=this.studio.doc;return this.memo("alignWalls",[e,t.width,t.height],()=>e?.walls.map(s=>Hi(s,t.width,t.height)).flatMap(s=>s.slice(1).map((i,o)=>[[s[o][0],s[o][1]],[i[0],i[1]]]))??[])}renderFloorImages(t){if(t.source==="demo"||!t.permissions.edit||this.phone.matches)return g;const e=this.floorImages,s=e?.images.off??null,i=e?.images.on??null,o=e?.layout,a=this.alignDraft??(o?{corners:o.corners,opacity:o.opacity}:null),r=!!this.alignDraft,l=(d,h,u,p)=>c`<div class="row" data-floor-image-row=${d}>
      <span class="lbl">${u}<span class="muted">${h?`${h.width}×${h.height} · ${Math.round(h.bytes/1024)} KB`:p}</span></span>
      <span class="btns" style="margin:0">
        <label class="upl"><input type="file" accept="image/png,image/jpeg" data-floor-image-input=${d} ?disabled=${this.imageBusy} @change=${b=>void this.uploadImage(d,b.target)} /><sw-button size="sm" icon="upload" ?disabled=${this.imageBusy} @click=${b=>b.currentTarget.closest("label")?.querySelector("input")?.click()}>${h?n("החלף"):n("העלה")}</sw-button></label>
        ${h?c`<sw-button size="sm" variant="ghost" icon="trash" data-floor-image-delete=${d} ?disabled=${this.imageBusy} @click=${()=>void this.removeImage(d)}>${n("הסר")}</sw-button>`:g}
      </span>
    </div>`;return c`<sw-card heading=${n("תמונת הקומה")} subheading=${n("תמונה של הקומה מכל מקור (הדמיה, תוכנית צבעונית, צילום מודל); ממוקמת פעם אחת ומוצגת במפה מתחת למצבי החדרים")} data-floor-images>
      ${l("off",s,n("תמונה בסיסית"),n("PNG או JPEG עד 12 MB; מוצגת תמיד"))}
      ${l("on",i,n("תמונה עם תאורה"),n("אופציונלי: אותה תמונה עם אורות; מוצגת רק בחדרים שהתאורה בהם דלוקה"))}
      ${s||i?c`<div class="row" style="margin-block-start:8px"><span class="lbl">${n("יישור על התוכנית")}<span class="muted">${n("גרור את הפינות אל פינות הקומה בתוכנית (או את התמונה כולה); מקשי החצים מכוונים פינה מסומנת")}</span></span>
            <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${n("הצג את תוכנית הרקע")} .checked=${this.alignShowPlan} @change=${d=>this.alignShowPlan=E(d)}></sw-toggle> ${n("הצג את תוכנית הרקע")}</label></div>
          <sw-floor-image-align data-floor-image-align .planWidth=${t.width} .planHeight=${t.height} .planUrl=${t.imageUrl} .showPlan=${this.alignShowPlan} .imageUrl=${ga(s??i)}
            .corners=${a?.corners??[[0,0],[1,0],[1,1],[0,1]]} .opacity=${a?.opacity??1} .rooms=${this.zones.map(d=>({id:d.id,polygon:d.polygon}))} .walls=${this.alignWalls(t)} ?disabled=${this.imageBusy}
            @corners-change=${d=>this.alignDraft={corners:d.detail.corners,opacity:a?.opacity??1}}></sw-floor-image-align>
          <div class="two">
            <sw-field label=${n("שקיפות התמונה במפה")}><input type="range" min="0.2" max="1" step="0.05" data-ltr data-floor-image-opacity .value=${String(a?.opacity??1)} @input=${d=>this.alignDraft={corners:a?.corners??[[0,0],[1,0],[1,1],[0,1]],opacity:parseFloat(d.target.value)}} /></sw-field>
            <div class="btns" style="align-items:flex-end">
              <sw-button variant="primary" size="sm" icon="check" data-floor-image-save ?disabled=${!r||this.imageBusy} @click=${()=>void this.saveAlignment()}>${n("שמור יישור")}</sw-button>
              <sw-button variant="ghost" size="sm" data-floor-image-reset ?disabled=${this.imageBusy||!r&&Bs(o?.corners)} @click=${()=>this.alignDraft={corners:[[0,0],[1,0],[1,1],[0,1]],opacity:1}}>${n("אפס")}</sw-button>
            </div>
          </div>`:g}
      ${this.imageNote?c`<div class="note" data-floor-image-note role="status">${this.imageNote}</div>`:g}
      <div class="note">${n("התמונה נשמרת במתקן בלבד ונכללת בגיבוי; שום דבר לא נשלח החוצה. תמונה בפרספקטיבה (צילום) מיושרת בקירוב - עדיף רינדור ישר מלמעלה או איזומטרי.")}</div>
    </sw-card>`}renderCalibrate(t){const e=this.studio.doc;if(!e)return c`<sw-card heading=${n("כיול קנה מידה")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: הכיול עובד מול השרת."):n("טוען…")}</div></sw-card>`;const{scale:s,estimated:i}=S(e),o=this.calib,a=o.a&&o.b?Math.hypot((o.b[0]-o.a[0])*t.width,(o.b[1]-o.a[1])*t.height):null,r=l=>Math.hypot((l.b[0]-l.a[0])*t.width,(l.b[1]-l.a[1])*t.height);return c`${Eo({a:o.a,b:o.b,metres:o.metres,pixels:a,scale:s,estimated:i,showEstimates:this.showEstimates,result:o.result,warning:o.warning,busy:this.busy,pairs:o.pairs.map(l=>({metres:l.metres,pixels:r(l)}))},l=>{this.calib={...this.calib,metres:l}},()=>void this.saveCalibration(),()=>{this.calib={...U}},()=>this.addCalibPair(),l=>{this.calib={...this.calib,pairs:this.calib.pairs.filter((d,h)=>h!==l)}})}${No({northDeg:e.north_deg??null,site:this.site,nowMs:Date.now(),disabled:!t.permissions.structure},{set:l=>this.edit(d=>Z(Qi(d,l)))})}`}resolvedMaterials(t){const e=this.library;if(this.matMemo&&this.matMemo.doc===t&&this.matMemo.lib===e)return this.matMemo.out;const s=Fn(t,e?jn(e):void 0);return this.matMemo={doc:t,lib:e,out:s},s}renderRoomMaterial(t){const e=this.studio.doc,s=this.bundle;if(!e||!s?.permissions.structure||s.source!=="api")return g;const i=e.rooms.find(l=>l.id===t.id),o=this.resolvedMaterials(e),a=t.level_id??T(e),r=o.rooms[t.id]?.floor??o.levels[a]?.floor??"concrete";return jo({key:`rooms:${t.id}`,label:n("חומר הרצפה"),host:"floor",value:i?.floor_material_id??null,defaultId:r,style:this.matStyle},{pick:l=>this.edit(d=>Z(to(d.rooms.some(h=>h.id===t.id)?d:{...d,rooms:[...d.rooms,{id:t.id,level_id:t.level_id??null}]},"rooms",t.id,"floor_material_id",l))),setStyle:l=>this.matStyle=l})}placeWalkPosition(t,e){const s=this.walkArmed;if(!s)return;const i=t.walk_positions??[],o=s==="new"?null:i.find(r=>r.id===s),a=o?{...o,x:J(e[0]),y:J(e[1])}:{id:xe(),name:Fo(i),x:J(e[0]),y:J(e[1]),level_id:this.activeLevel??T(t),heading_deg:0};this.edit(r=>Z(De(r,a))),this.walkArmed=null,this.walkFocus=a.id,this.hover=null}renderWalkTool(t){const e=this.studio.doc;if(!e)return c`<sw-card heading=${n("עמדות סיור")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: העמדות נשמרות מול השרת."):this.error||n("טוען את טיוטת המבנה…")}</div></sw-card>`;const{scale:s,estimated:i}=S(e),o=(a,r)=>this.edit(l=>{const d=(l.walk_positions??[]).find(h=>h.id===a);return d?Z(De(l,r(d))):l});return Ro({positions:e.walk_positions??[],levels:e.levels,W:t.width,H:t.height,scale:s,estimated:i&&this.showEstimates,armed:this.walkArmed,focused:this.walkFocus,disabled:!t.permissions.structure},{arm:a=>{this.walkArmed=a,this.hover=null},rename:(a,r)=>{r.trim()&&o(a,l=>({...l,name:r}))},setLevel:(a,r)=>o(a,l=>({...l,level_id:r})),setHeading:(a,r)=>o(a,l=>({...l,heading_deg:r})),setDefault:a=>o(a,r=>({...r,is_default:!r.is_default})),move:(a,r)=>this.edit(l=>Z(so(l,a,r))),remove:a=>{this.edit(r=>Z(eo(r,a))),this.walkFocus===a&&(this.walkFocus=null),this.walkArmed===a&&(this.walkArmed=null)},goTo:a=>{const r=(this.studio.doc?.walk_positions??[]).find(l=>l.id===a);r&&(this.activeLevel!==null&&this.activeLevel!==r.level_id&&(this.levelFilter=r.level_id),this.walkFocus=a,this.canvas?.centerOn(r.x,r.y))}})}renderMeasure(t){const e=this.studio.doc;if(!e)return c`<sw-card heading=${n("מדידה")}><div class="note">${t.source==="demo"?n("נתוני הדגמה: המדידה עובדת מול השרת."):n("טוען…")}</div></sw-card>`;const{scale:s,estimated:i}=S(e);return Zo(this.measurePts,t.width,t.height,s,i,this.showEstimates,()=>{this.measurePts=[]})}renderCoverage(t){const e=t.coverage_polygon,s=t.coverage_radius??0,i=Math.round((s||.1)*100),o=()=>{const a=t.field_of_view_degrees??90,r=s||.1,l=this.bundle&&this.bundle.height?this.bundle.width/this.bundle.height:1,d=[[t.position.x,t.position.y]],h=Math.max(3,Math.round(a/15));for(let u=0;u<=h;u++){const p=(t.rotation_degrees-a/2+a*u/h-90)*Math.PI/180;d.push([+Math.max(0,Math.min(1,t.position.x+Math.cos(p)*r)).toFixed(4),+Math.max(0,Math.min(1,t.position.y+Math.sin(p)*r*l)).toFixed(4)])}this.apply(t.id,{coverage_polygon:d})};return c`<div class="row" data-coverage style="flex-direction:column;align-items:stretch;gap:6px">
      <span class="lbl">${n("שטח כיסוי{v}",{v:e?n(" · מצולע ידני"):""})}<span class="muted">${e?n("{polyCount} נקודות · גרירה מזיזה, לחיצה על נקודת אמצע מוסיפה, לחיצה כפולה מסירה",{polyCount:e.length}):n("שני מחוונים נפרדים לגמרי זה מזה: רוחב (כמה ימינה ושמאלה, שווה לשני הצדדים) ומרחק (עד איפה המצלמה רואה). אפשר גם לגרור את הידיות על המפה.")}</span></span>
      ${e?g:c`<label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-width>${n("רוחב")}
          <input type="range" min="10" max="180" step="1" style="flex:1" .value=${String(Math.round(t.field_of_view_degrees??90))} aria-label=${n("רוחב שדה הראייה")} @input=${a=>this.apply(t.id,{field_of_view_degrees:Number(a.target.value)})} />
          <span class="ltr" style="min-inline-size:64px">${n("{v}° לכל צד",{v:Math.round((t.field_of_view_degrees??90)/2)})}</span></label>
        <label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-distance>${n("מרחק")}
          <input type="range" min="2" max="100" step="1" style="flex:1" .value=${String(i)} aria-label=${n("מרחק ראייה")} @input=${a=>this.apply(t.id,{coverage_radius:Number(a.target.value)/100})} />
          <input type="number" step="1" min="2" max="100" data-ltr data-coverage-radius style="inline-size:56px" .value=${String(i)} aria-label=${n("מרחק ראייה, אחוז מדויק")} @change=${a=>this.apply(t.id,{coverage_radius:Math.min(1,Math.max(.02,Number(a.target.value)/100))})} />
          <span class="ltr" style="min-inline-size:24px">%</span></label>`}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${e?c`<sw-button size="sm" icon="undo" data-coverage-cone @click=${()=>this.apply(t.id,{coverage_polygon:null})}>${n("חזרה לקשת")}</sw-button>`:c`${s?c`<sw-button size="sm" variant="ghost" @click=${()=>this.apply(t.id,{coverage_radius:null})}>${n("מרחק לברירת מחדל")}</sw-button>`:g}
            <sw-button size="sm" icon="edit" data-coverage-polygon @click=${o}>${n("כיסוי ידני (מצולע)")}</sw-button>`}
      </div>
    </div>`}renderMount(t,e){const s=Rn[Zn(t)],i=(o,a,r)=>{if(o.trim()==="")return null;const l=Number(o);return Number.isFinite(l)?Math.min(r,Math.max(a,l)):null};return c`<div class="two" data-anchor-3d>
      <sw-field label=${n("גובה התקנה (מ׳)")} hint=${n("ברירת מחדל {mount_height_m} מ׳ · לתצוגת התלת-ממד",{mount_height_m:s.mount_height_m})}><input type="number" step="0.1" min="0" max="30" data-ltr data-anchor-mount placeholder=${String(s.mount_height_m)} .value=${ce(t.mount_height_m==null?"":String(t.mount_height_m))} @change=${o=>this.apply(t.id,{mount_height_m:i(o.target.value,0,30)})} /></sw-field>
      ${e?c`<sw-field label=${n("הטיה (°)")} hint=${n("ברירת מחדל {tilt_deg}° · חיובי = מטה",{tilt_deg:s.tilt_deg})}><input type="number" step="any" min="-90" max="90" data-ltr data-anchor-tilt placeholder=${String(s.tilt_deg)} .value=${ce(t.tilt_deg==null?"":String(t.tilt_deg))} @change=${o=>this.apply(t.id,{tilt_deg:i(o.target.value,-90,90)})} /></sw-field>`:g}
    </div>`}renderCameraInspector(t){const e=t.camera,s=t.field_of_view_degrees??0;return c`<sw-card heading=${n("הגדרות מצלמה")} subheading=${n("גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת")}>
      <div class="kv"><span class="k">${n("מצלמה")}</span><strong>${this.anchorName(t)}</strong></div>
      <div class="kv"><span class="k">${n("מקור")}</span><span class=${e&&Ct(e)?"":"ltr"}>${e?Is(e):t.resource_id}</span></div>
      <sw-field label=${n("כיוון מבט (°)")} style="margin-block-start:10px"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(t.rotation_degrees))} @change=${i=>this.apply(t.id,{rotation_degrees:(Number(i.target.value)%360+360)%360})} /></sw-field>
      <div class="two">
        <sw-field label=${n("מיקום X (%)")}><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(i.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label=${n("מיקום Y (%)")}><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(i.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?c`<sw-field label=${n("מפלס")}><select data-anchor-level @change=${i=>this.apply(t.id,{level_id:i.target.value||null})}>${this.studio.doc.levels.map(i=>c`<option value=${i.id} ?selected=${(t.level_id??T(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:g}
      <sw-field label=${n("תווית (אופציונלי)")}><input .value=${t.label??""} @change=${i=>this.apply(t.id,{label:i.target.value||null})} /></sw-field>
      <sw-field label=${n("מיקום התווית")}><select data-label-pos @change=${i=>this.apply(t.id,{label_pos:i.target.value})}>${[["auto",n("אוטומטי")],["top",n("מעל")],["bottom",n("מתחת")],["left",n("משמאל")],["right",n("מימין")]].map(([i,o])=>c`<option value=${i} ?selected=${(t.label_pos??"auto")===i}>${o}</option>`)}</select></sw-field>
      ${this.renderMount(t,!0)}
      ${s?this.renderCoverage(t):g}
      <div class="row"><span class="lbl">${n("הצג כיסוי משוער")}<span class="muted">${n("זווית לתכנון, לא מדידת כיסוי בפועל")}</span></span><sw-toggle ?checked=${!!s} label=${s?n("מוצג"):n("מוסתר")} @click=${()=>this.apply(t.id,{field_of_view_degrees:s?null:90})}></sw-toggle></div>
      <div class="row"><span class="lbl">${n("0° = למעלה, עם כיוון השעון")}<span class="muted">${n("שינוי כיוון במפה אינו פקודת PTZ למצלמה")}</span></span></div>
      <div class="note" style="margin-block-start:6px">${n("revision {revision}{v} · חצים = הזזה עדינה (Shift = גדולה) · Delete = הסרה",{revision:t.revision,v:this.dirty.has(t.id)?n(" · שינויים לא שמורים"):""})}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>${n("שמירת מיקום")}</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>${n("הסר מהמפה")}</sw-button>
      </div>
    </sw-card>`}renderEntityInspector(t){const e=t.entity;return c`<sw-card heading=${n("הגדרות ישות")} subheading=${n("הצבה בלבד; שליטה דורשת הרשאה נפרדת")}>
      <div class="kv"><span class="k">${n("ישות")}</span><strong>${this.anchorName(t)}</strong></div>
      <div class="kv"><span class="k">${n("מזהה")}</span><span class="ltr">${t.resource_id}</span></div>
      ${e?c`<div class="kv"><span class="k">${n("מצב עכשיו")}</span><span>${de(e)}</span></div><div class="kv"><span class="k">${n("סוג")}</span><span>${he(e.domain)}</span></div>`:g}
      <sw-field label=${n("שכבה")} style="margin-block-start:8px"><select @change=${s=>this.apply(t.id,{layer_id:s.target.value})}>${Ke.filter(s=>s.id!=="cameras").map(s=>c`<option value=${s.id} ?selected=${t.layer_id===s.id}>${s.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label=${n("מיקום X (%)")}><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(s.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label=${n("מיקום Y (%)")}><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(s.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?c`<sw-field label=${n("מפלס")}><select data-anchor-level @change=${s=>this.apply(t.id,{level_id:s.target.value||null})}>${this.studio.doc.levels.map(s=>c`<option value=${s.id} ?selected=${(t.level_id??T(this.studio.doc))===s.id}>${s.name}</option>`)}</select></sw-field>`:g}
      <sw-field label=${n("שם במפה (ידני)")}><input data-entity-name placeholder=${e?.name??t.resource_id} .value=${t.label??""} @change=${s=>this.apply(t.id,{label:s.target.value.trim()||null})} /></sw-field>
      <sw-field label=${n("מיקום התווית")}><select data-label-pos @change=${s=>this.apply(t.id,{label_pos:s.target.value})}>${[["auto",n("אוטומטי")],["top",n("מעל")],["bottom",n("מתחת")],["left",n("משמאל")],["right",n("מימין")]].map(([s,i])=>c`<option value=${s} ?selected=${(t.label_pos??"auto")===s}>${i}</option>`)}</select></sw-field>
      ${this.renderMount(t,!1)}
      <div class="note">${n("ריק = השם המקורי{v}. השם הידני מוצג במפה, ברשימת הצד ובכרטיס.",{v:e?.name?` („${e.name}“)`:""})}</div>
      <div class="note" style="margin-block-start:6px">revision ${t.revision}${this.dirty.has(t.id)?n(" · שינויים לא שמורים"):""}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>${n("שמירת מיקום")}</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>${n("הסר מהמפה")}</sw-button>
      </div>
    </sw-card>`}renderToolPanel(t){const e=new Set(this.anchors.map(s=>s.resource_id));if(this.tool==="structure")return this.renderStructurePanel(t);if(this.tool==="library")return this.renderLibraryTool(t);if(this.tool==="connectors")return this.renderConnectorTool(t);if(this.tool==="circuits")return this.renderCircuitTool(t);if(this.tool==="calibrate")return this.renderCalibrate(t);if(this.tool==="walk")return this.renderWalkTool(t);if(this.tool==="measure")return this.renderMeasure(t);if(this.tool==="detect")return this.renderDetectTool(t);if(this.tool==="camera"){const s=zs(t.cameras,vt("nvr")).filter(i=>!e.has(i.id));return c`<sw-card heading=${n("הוספת מצלמה")} subheading=${n("בחר מצלמה ואז לחץ על התוכנית במקום המבוקש")}>
        ${s.length?c`<div class="list">${s.map(i=>c`<button class=${this.placing?.kind==="camera"&&this.placing.camera.id===i.id?"on":""} @click=${()=>this.placing={kind:"camera",camera:i}}><span>${i.name}</span><span class=${Ct(i)?"":"ltr"}>${Ms(i)}</span></button>`)}</div>`:c`<div class="note">${t.cameras.length?n("כל המצלמות הרשומות כבר מוצבות על הקומה."):n("אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית.")}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>st("/system/devices")}>${n("למצלמות")}</sw-button></div>`}
      </sw-card>`}if(this.tool==="entity"||this.tool==="lights"){const s=this.tool==="lights",i=(this.entResults??[]).filter(o=>!e.has(o.entity_id));return c`<sw-card heading=${s?n("הוספת תאורה"):n("הוספת התקן אחר")} subheading=${s?n("מפסקים (switch) מהקטלוג; לחץ על התוכנית להצבה. השם ניתן לשינוי אחרי ההצבה."):n("כל ישות אחרת בקטלוג (דלתות, חיישנים, מזגנים…) ואז לחיצה על התוכנית")} data-tool-panel=${this.tool}>
        <sw-field><input type="search" placeholder=${s?n("חיפוש מפסק לפי שם או אזור"):n("חיפוש לפי שם, entity_id או אזור")} data-ltr .value=${this.entQ} @input=${o=>this.onEntQuery(o.target.value)} /></sw-field>
        ${this.entMeta?c`<sw-building-filter data-ent-building .filter=${this.entMeta} value=${this.entMeta.building??""}
          @building-change=${o=>{this.entBuilding=o.detail.value,this.searchEntities()}}></sw-building-filter>`:g}
        ${s?c`<label class="note" style="display:flex;gap:6px;align-items:center"><sw-toggle size="sm" labelHidden in-label label=${n("להציג גם ישויות light (נורות חכמות)")} data-lights-all .checked=${this.lightsAll} @change=${o=>{this.lightsAll=E(o),this.searchEntities()}}></sw-toggle> ${n("להציג גם ישויות light (נורות חכמות)")}</label>`:g}
        ${t.source==="demo"?c`<div class="note">${n("נתוני הדגמה: החיפוש עובד מול השרת.")}</div>`:this.entBusy&&!this.entResults?c`<div class="note">${n("מחפש…")}</div>`:i.length?c`<div class="list">${i.map(o=>c`<button class=${this.placing?.kind==="entity"&&this.placing.entity.entity_id===o.entity_id?"on":""} @click=${()=>this.placing={kind:"entity",entity:o}}><span>${o.name||o.original_name||o.entity_id}<div class="note" style="margin:0">${he(o.domain)}${o.area_name?` · ${o.area_name}`:""} · ${de(o)}</div></span><span class="ltr">${o.entity_id}</span></button>`)}</div>`:c`<div class="note">${this.entResults?n("לא נמצאו ישויות (או שכולן כבר מוצבות)."):""}</div>`}
      </sw-card>`}return this.tool==="layers"?c`<sw-card heading=${n("שכבות")} subheading=${n("מה מוצג בעורך (לא משפיע על הצופים)")}>
        <div class="layerlist">${Ke.filter(s=>s.id!=="cameras"||vt("cameras_available")).map(s=>c`<label><sw-toggle size="sm" labelHidden in-label label=${s.label} .checked=${this.layers.has(s.id)} @change=${i=>{const o=new Set(this.layers);E(i)?o.add(s.id):o.delete(s.id),this.layers=o}}></sw-toggle> ${s.label} <span class="note">(${this.anchors.filter(i=>this.layerOf(i)===s.id).length})</span></label>`)}
          <label><sw-toggle size="sm" labelHidden in-label label=${n("חדרים ואזורים")} .checked=${this.showZones} @change=${s=>this.showZones=E(s)}></sw-toggle> ${n("חדרים ואזורים")} <span class="note">(${this.zones.length})</span></label>
          ${t.imageUrl?c`<label><sw-toggle size="sm" labelHidden in-label label=${n("תמונת התוכנית")} data-plan-background .checked=${this.planImage} @change=${s=>this.setPlanImage(t.floorId,E(s))}></sw-toggle> ${n("תמונת התוכנית")} <span class="note">(${this.planImage?n("מתחת לשרטוט"):n("מוסתרת, רקע נקי")})</span></label>`:g}</div>
        ${this.studio.doc?Go({...this.grid,steps:Qe,estimated:S(this.studio.doc).estimated,showEstimates:this.showEstimates},s=>this.setGrid(t.floorId,{on:s}),s=>this.setGrid(t.floorId,{stepM:s})):g}
      </sw-card>`:this.tool==="zones"?this.renderZonesPanel(t):this.tool==="select"&&this.multiShown.length&&this.studio.doc?this.renderMultiPanel():this.tool==="select"&&this.geomSel&&this.studio.doc?c`${this.renderSelectionPanel(t)}${this.multiOn?c`<div class="note" data-multi-hint>${Rt}</div>`:g}`:c`<sw-card heading=${n("מאפיינים")}><div class="note" data-select-hint>${t.permissions.structure&&this.studio.doc?n("לחץ על סיכה, קיר, פתח, תווית, עצם או אזור במפה כדי לבחור ולערוך אותם, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה: סיכה, פתח, תווית ועצם מיד, קיר ואזור אחרי שנבחרו. הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור."):n("בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.")}</div>${this.multiOn?c`<div class="note" data-multi-hint>${Rt}</div>`:g}</sw-card>`}renderSelectionPanel(t){const e=this.geomSel,s=this.studio.doc;if(!e||!s)return g;if(e.kind==="object"||e.kind==="group")return this.renderLibraryTool(t,!0);if(e.kind==="connector"){const i=s.connectors.find(o=>o.id===e.id);return i?Bo({...this.connectorView(s),sel:i},{...this.connectorActions(),setMode:()=>{}}):g}return this.renderStructurePanel(t,!0)}loadZoneCamera(t){this.zoneCameraFor=t,this.zoneCamera=null,this.camSuggestions=null,!(!t||this.bundle?.source==="demo")&&mo(t).then(e=>{this.zoneCameraFor===t&&(this.zoneCamera=e)},()=>{})}askCameraSuggestions(t){const e=this.bundle;if(!e)return;const s=this.anchors.filter(o=>o.resource_type==="camera").map(o=>({id:o.id,floorId:o.floor_id,levelId:o.level_id??null,position:o.position,rotationDeg:o.rotation_degrees,fovDeg:o.field_of_view_degrees})),i={id:t.id,floorId:t.floor_id,levelId:t.level_id??null,polygon:t.polygon};this.camSuggestions={zoneId:t.id,items:_a(i,s,this.camSuggestCfg,{aspect:e.height?e.width/e.height:1,exclude:this.zoneCamera?.anchor_id?[this.zoneCamera.anchor_id]:[]})}}async setZoneCamera(t,e){this.zoneBusy=!0,this.error="";try{const s=e?await vo(t.id,e):await bo(t.id);this.zoneCameraFor===t.id&&(this.zoneCamera=s),this.camSuggestions=null}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}renderCameraSuggest(t){const e=this.bundle;if(!e||e.source==="demo"||t.shared?.role==="mirror")return g;const s=this.zoneCamera?.anchor_id?this.anchors.find(r=>r.id===this.zoneCamera.anchor_id):void 0,i=this.camSuggestions?.zoneId===t.id?this.camSuggestions.items:null,o=this.anchors.some(r=>r.resource_type==="camera"),a=r=>r===0?n("בתוך האזור"):n("במרחק {v}%",{v:Math.max(1,Math.round(r*100))});return c`<div class="cam-suggest" data-cam-suggest>
      ${s?c`<div class="kv" data-zone-camera><span class="k">${n("מצלמת האזור")}</span><span>${I(this.anchorName(s))}</span></div>`:g}
      ${e.permissions.edit&&o?c`<div class="btns"><sw-button size="sm" icon="camera" data-cam-suggest-ask ?disabled=${this.zoneBusy} @click=${()=>this.askCameraSuggestions(t)}>${n("הצע מצלמה קרובה")}</sw-button>${s?c`<sw-button size="sm" variant="ghost" data-cam-suggest-clear ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,null)}>${n("הסר קישור")}</sw-button>`:g}</div>`:g}
      ${i?i.length?c`<div class="cam-sug-list" data-cam-suggest-list>${i.map(r=>{const l=this.anchors.find(d=>d.id===r.id);return c`<div class="cam-sug" data-cam-suggestion=${r.id}>
                <span class="cam-sug-name">${l?I(this.anchorName(l)):r.id}<span class="note" style="margin:0">${a(r.distance)}${r.facing===null?n(" · ללא שדה ראייה"):r.facing>=.5?n(" · פונה לאזור"):n(" · לא פונה לאזור")}</span></span>
                <sw-button size="sm" variant="primary" icon="check" data-cam-suggest-accept ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,r.id)}>${n("קבל")}</sw-button>
              </div>`})}</div>`:c`<div class="note" data-cam-suggest-none>${n("אין מצלמה בקרבת האזור בטווח שהוגדר בהגדרות")} &gt; ${n("מפה")}</div>`:g}
    </div>`}renderZoneInspector(t){const e=this.anchors.filter(i=>i.resource_type==="camera"&&qt(i.position,t.polygon)),s=this.anchors.filter(i=>i.resource_type!=="camera"&&qt(i.position,t.polygon));return c`<div class="zone-insp" data-zone-inspector>
      <sw-field label=${n("שם")}><input .value=${t.name} placeholder=${n("למשל: לובי, מחסן, חדר ישיבות")} @change=${i=>this.patchZone(t,{name:i.target.value})} /></sw-field>
      <div class="two">
        <sw-field label=${n("סוג")}><select @change=${i=>this.patchZone(t,{kind:i.target.value})}>${Ce.map(i=>c`<option value=${i.id} ?selected=${t.kind===i.id}>${i.label}</option>`)}</select></sw-field>
        <sw-field label=${n("צבע")}><input type="color" data-ltr .value=${t.color} @change=${i=>this.patchZone(t,{color:i.target.value})} /></sw-field>
      </div>
      <sw-field label=${n("מיקום שם החדר")}><select data-zone-label-pos @change=${i=>this.patchZone(t,{label_pos:i.target.value})}>${[["auto",n("אוטומטי")],["top",n("מעל")],["bottom",n("מתחת")],["left",n("משמאל")],["right",n("מימין")]].map(([i,o])=>c`<option value=${i} ?selected=${(t.label_pos??"auto")===i}>${o}</option>`)}</select></sw-field>
      ${this.renderRoomMaterial(t)}
      ${(this.studio.doc?.levels.length??0)>1?c`<sw-field label=${n("מפלס")}><select data-zone-level @change=${i=>this.patchZone(t,{level_id:i.target.value})}>${this.studio.doc.levels.map(i=>c`<option value=${i.id} ?selected=${(t.level_id??T(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:g}
      ${this.areas.length?c`<sw-field label=${n("אזור בעץ ההתקנים")} hint=${t.area_id&&!this.areas.some(i=>i.area_id===t.area_id)?n("האזור המקושר כבר לא קיים"):n('"הצג על המפה" מהעץ ומדף האזור מגיע לחדר הזה; לחיצה על החדר במפה פותחת את האזור')}>
            <select data-zone-area ?disabled=${this.zoneBusy} @change=${i=>this.patchZone(t,{area_id:i.target.value})}>
              <option value="" ?selected=${!t.area_id}>${n("ללא קישור")}</option>
              ${this.areas.map(i=>c`<option value=${i.area_id} ?selected=${t.area_id===i.area_id}>${I(i.name)}${i.floor_name?` · ${I(i.floor_name)}`:""}</option>`)}
            </select></sw-field>`:g}
      ${this.renderZoneTags(t)}
      ${this.renderZoneShare(t)}
      ${this.renderCameraSuggest(t)}
      <div class="kv"><span class="k">${n("מצלמות באזור")}</span><span>${e.length?e.map(i=>this.anchorName(i)).join(", "):n("אין")}</span></div>
      <div class="kv"><span class="k">${n("התקנים באזור")}</span><span>${s.length?n("{entsCount} ישויות",{entsCount:s.length}):n("אין")}</span></div>
      <div class="row"><span class="lbl">${n("הכללה בחיפוש מרחבי")}<span class="muted">${n("זמין לחוקי התראה ולחיפוש לפי מקום")}</span></span><sw-toggle ?checked=${t.searchable} label=${t.searchable?n("כלול"):n("לא כלול")} @click=${()=>this.patchZone(t,{searchable:!t.searchable})}></sw-toggle></div>
      <div class="note">${n("{polygonCount} פינות · {v} · revision {revision}",{polygonCount:t.polygon.length,v:t.source==="auto"?n("זוהה אוטומטית מהתוכנית"):n("צויר ידנית"),revision:t.revision})}</div>
      <div class="note" data-zone-hint>${n("גרור פינה כדי לשנות צורה, גרור נקודת אמצע כדי להוסיף פינה, גרור את הגוף כדי להזיז; Delete על פינה מסיר אותה")}</div>
      <div class="note">${n("אזור במפה הוא הקשר מרחבי בלבד: אינו אזור זיהוי במצלמה ואינו מסכת פרטיות, ואינו משנה תצורת NVR.")}</div>
      <div class="btns">${t.shared?.role==="mirror"?g:c`<sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.zoneBusy} @click=${()=>this.removeZone(t)}>${n("מחק אזור")}</sw-button>`}<sw-button size="sm" variant="ghost" @click=${()=>this.selectedZoneId=null}>${n("סגור")}</sw-button></div>
    </div>`}renderZoneTags(t){const e=s=>{s!==t.tags&&!(t.tags===void 0&&!s.length)&&this.patchZone(t,{tags:s})};return Vo({chips:(t.tags??[]).map(s=>({tag:s})),full:(t.tags?.length??0)>=At,disabled:this.zoneBusy||this.bundle?.source==="demo"},s=>e(Ie(t.tags,s)),s=>e(Et(t.tags,s)))}renderZonesPanel(t){const e=this.candidates,s=this.selectedZone;return c`<sw-card heading=${n("חדרים ואזורים")} subheading=${n("זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה")}>
      ${e?c`<div class="note">${n("{candsCount} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.",{candsCount:e.length})}</div>
            <div class="candlist">${e.map((i,o)=>c`<div class="cand" data-candidate><input type="checkbox" .checked=${i.include} aria-label=${n("כלול")} @change=${a=>this.setCandidate(o,{include:a.target.checked})} /><i class="sw" style="background:${xt[o%xt.length]}"></i><input class="name" .value=${i.name} placeholder=${n("שם החדר")} aria-label=${n("שם החדר")} @input=${a=>this.setCandidate(o,{name:a.target.value})} /><select aria-label=${n("סוג")} @change=${a=>this.setCandidate(o,{kind:a.target.value})}>${Ce.map(a=>c`<option value=${a.id} ?selected=${i.kind===a.id}>${a.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some(i=>i.source==="auto")?c`<label class="chk"><sw-toggle size="sm" labelHidden in-label label=${n("החלף את החדרים שזוהו אוטומטית בעבר")} .checked=${this.replaceAuto} @change=${i=>this.replaceAuto=E(i)}></sw-toggle> ${n("החלף את החדרים שזוהו אוטומטית בעבר ({n})",{n:this.zones.filter(i=>i.source==="auto").length})}</label>`:g}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy||!e.some(i=>i.include)} @click=${()=>this.acceptCandidates()}>${n("שמור {n} חדרים",{n:e.filter(i=>i.include).length})}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.candidates=null}>${n("בטל")}</sw-button></div>`:this.drawing?c`<div class="note">${n("לחץ על התוכנית להוספת פינות ({drawingCount} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.",{drawingCount:this.drawing.length})}</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length<3||this.zoneBusy} @click=${()=>this.finishDrawing()}>${n("סיים אזור")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.drawing=null}>${n("בטל")}</sw-button></div>`:c`<div class="row"><span class="lbl">${n("זיהוי חדרים מהתוכנית")}<span class="muted">${n("עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות")}</span></span><select aria-label=${n("עוצמת זיהוי")} @change=${i=>this.detectStrength=i.target.value}><option value="light" ?selected=${this.detectStrength==="light"}>${n("קל")}</option><option value="medium" ?selected=${this.detectStrength==="medium"}>${n("בינוני")}</option><option value="strong" ?selected=${this.detectStrength==="strong"}>${n("חזק")}</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting||t.source==="demo"||t.planStatus==="none"} @click=${()=>this.detect()}>${this.detecting?n("מזהה…"):n("זהה חדרים")}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${()=>this.startDrawing()}>${n("צייר אזור")}</sw-button></div>`}
      ${this.zones.length?c`<div class="note" style="margin-block-start:10px">${n("{zonesCount} אזורים בקומה · לחיצה בוחרת במפה",{zonesCount:this.zones.length})}</div>
            <div class="list">${this.zones.map(i=>c`<button class=${i.id===this.selectedZoneId?"on":""} data-zone-row @click=${()=>{this.selectedZoneId=i.id===this.selectedZoneId?null:i.id,this.selectedId=null}}><span><i class="sw" style="background:${i.color}"></i>${i.name}</span><span class="note" style="margin:0">${wo(i.kind)}${i.source==="auto"?n(" · אוטומטי"):""}</span></button>`)}</div>`:e||this.drawing?g:c`<div class="note" style="margin-block-start:10px">${n("עדיין אין חדרים או אזורים בקומה.")}</div>`}
      ${s?this.renderZoneInspector(s):g}
    </sw-card>`}renderVersionCard(t){const e=this.stylized;return c`<sw-card heading=${n("גרסת תוכנית")} subheading=${t.planStatus==="draft"?n("טיוטה: צופים רואים את הגרסה הקודמת"):t.planStatus==="published"?n("גרסה מפורסמת"):n("אין תוכנית")}>
      ${t.planStatus==="none"?g:c`<div class="row"><span class="lbl">${n("תצוגת המפה")}<span class="muted">${t.renderMode==="stylized"?n("שפת Arx (עיבוד אוטומטי של המקור)"):n("תוכנית המקור כפי שהועלתה")}</span></span>${t.renderMode==="stylized"?c`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("source")}>${n("הצג מקור")}</sw-button>`:t.stylizedAvailable?c`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>${n("הצג שפת Arx")}</sw-button>`:g}</div>
          <div class="row"><span class="lbl">${n("עיבוד לשפת Arx")}<span class="muted">${n("בחר מה להשאיר מהתוכנית; המקור נשמר תמיד")}</span></span></div>
          <div class="two" data-stylize-opts>
            <sw-field label=${n("עוצמת ניקוי")}><select aria-label=${n("עוצמת ניקוי")} @change=${s=>this.stylizeOpts={...this.stylizeOpts,strength:s.target.value}}><option value="light" ?selected=${this.stylizeOpts.strength==="light"}>${n("קל · קירות דקים נשמרים")}</option><option value="medium" ?selected=${this.stylizeOpts.strength==="medium"}>${n("בינוני · קירות כפולים מאוחדים")}</option><option value="strong" ?selected=${this.stylizeOpts.strength==="strong"}>${n("חזק · מדרגות וריהוט לגושים")}</option></select></sw-field>
            <sw-field label=${n("מילוי חדרים")}><select aria-label=${n("מילוי חדרים")} @change=${s=>this.stylizeOpts={...this.stylizeOpts,roomFill:s.target.value}}>${Object.keys(Gt).map(s=>c`<option value=${s} ?selected=${this.stylizeOpts.roomFill===s}>${Gt[s]}</option>`)}</select></sw-field>
          </div>
          <label class="chk"><sw-toggle size="sm" labelHidden in-label label=${n("ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)")} .checked=${this.stylizeOpts.keepLines} @change=${s=>this.stylizeOpts={...this.stylizeOpts,keepLines:E(s)}}></sw-toggle> ${n("ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)")}</label>
          <div class="btns"><sw-button variant="primary" size="sm" icon="image" ?disabled=${this.stylizing||t.source==="demo"} @click=${()=>this.stylize()}>${this.stylizing?n("מעבד…"):n("עבד תצוגה מקדימה")}</sw-button></div>
          ${e?c`<div class="compare" style="margin-block-start:8px"><div><div class="note">${n("מקור")}</div><img src=${e.source_url} alt=${n("תוכנית מקור")} /></div><div><div class="note" data-stylize-caption>${n("שפת Arx · {rooms} חדרים · {v} · {v2}",{rooms:e.rooms,v:Gt[e.room_fill]??e.room_fill,v2:e.keep_lines?n("עם קווים דקים"):n("ללא קווים דקים")})}</div><img src=${e.stylized_url} alt=${n("שפת Arx")} /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>${n("השתמש בתוצאה")}</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.stylized=null}>${n("סגור")}</sw-button></div>
              <div class="note" style="margin-block-start:6px">${n("עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.")}</div>`:g}`}
      ${this.renderVersionHistory(t)}
      ${this.renderStructureHistory(t)}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>st(`/explore/floors/${t.floorId}/import`)}>${n("ייבוא תוכנית חדשה")}</sw-button></div>
    </sw-card>
    ${this.renderFloorImages(t)}`}renderVersionHistory(t){return this.versions.length?c`<div class="row" style="margin-block-start:10px"><span class="lbl">${n("היסטוריית גרסאות")}<span class="muted">${n("כל פרסום נשמר; אפשר להשוות ולשחזר גרסה מהארכיון בלי לאבד עוגנים")}</span></span></div>
      <div class="vlist" data-version-list>
        ${this.versions.map(e=>{const s=e.id===t.planVersionId,i=e.status==="published"?"recorded":e.status==="draft"?"partial":"neutral",o=e.status==="published"?n("מפורסמת"):e.status==="draft"?n("טיוטה"):n("ארכיון");return c`<div class="vrow ${s?"cur":""}" data-version-row data-version-id=${e.id} data-version-status=${e.status}>
            <img src=${Q(e.image_url)} alt="" loading="lazy" />
            <div class="meta">
              <span><sw-badge kind=${i} label=${o}></sw-badge> <span class="ltr">${X(e.published_at??e.created_at)}</span></span>
              <span class="note">${n("{width_px}×{height_px}{v}{v2} · {v3} פריטים{v4}",{width_px:e.width_px,height_px:e.height_px,v:e.rotation?n(" · סיבוב {rotation}°",{rotation:e.rotation}):"",v2:e.crop?n(" · חיתוך"):"",v3:e.anchors_on??0,v4:e.notes?` · ${e.notes}`:""})}</span>
            </div>
            <div class="acts">
              ${e.status!=="published"?c`<sw-button size="sm" variant="ghost" data-version-compare ?disabled=${this.busy} @click=${()=>this.openDiff(e.status==="draft"&&t.permissions.publish?"publish":"compare",e)}>${n("השווה")}</sw-button>`:g}
              ${e.status==="archived"&&t.permissions.publish?c`<sw-button size="sm" icon="history" data-version-rollback ?disabled=${this.busy} @click=${()=>this.openDiff("rollback",e)}>${n("שחזר")}</sw-button>`:g}
            </div>
          </div>`})}
      </div>`:g}renderDiffDialog(){const t=this.diff;if(!t)return g;const e=t.data,s=t.mode==="publish"&&t.version.id===this.bundle?.planVersionId?this.studio.doc:null,i=s&&(s.walls.length||s.openings.length||s.labels.length||s.objects.length||s.connectors.length)?s:null,o=!!i&&this.studio.issues.some(l=>l.severity==="error"),a=t.mode==="publish"?n("פרסום גרסה"):t.mode==="rollback"?n("שחזור גרסה מהארכיון"):n("השוואת גרסאות"),r=t.mode==="publish"?n("מה ישתנה לצופים ומה יקרה לפריטים המוצבים"):t.mode==="rollback"?n("הגרסה תפורסם מחדש כעותק חדש; הגרסה הנוכחית תעבור לארכיון"):n("מול הגרסה המפורסמת");return c`<sw-dialog open heading=${a} subheading=${r} data-diff-dialog @close=${()=>this.diff=null}>
      ${t.error?c`<div class="err" data-diff-error>${t.error}</div>`:g}
      ${e?c`<div class="compare">
              <div><div class="note">${e.from?n("מפורסמת · {fmtWhen}",{fmtWhen:X(e.from.published_at??e.from.created_at)}):n("אין גרסה מפורסמת")}</div>${e.from?c`<img src=${Q(e.from.image_url)} alt=${n("הגרסה המפורסמת")} />`:c`<div class="note">—</div>`}</div>
              <div><div class="note">${t.mode==="rollback"?n("לשחזור"):n("חדשה")} · ${X(e.to.published_at??e.to.created_at)}</div><img src=${Q(e.to.image_url)} alt=${n("הגרסה החדשה")} /></div>
            </div>
            <div class="dsum" data-diff-summary>
              ${e.from?e.geometry.same?c`<sw-badge kind="recorded" label=${n("גאומטריה זהה")}></sw-badge>`:c`<sw-badge kind="partial" label=${n("שינוי: {join}",{join:e.geometry.changes.map(l=>Ra[l.field]??l.field).join(", ")})}></sw-badge>`:c`<sw-badge kind="neutral" label=${n("פרסום ראשון")}></sw-badge>`}
              <span>${n("{total} פריטים מוצבים · {carried} עוברים כמו שהם · {needs_alignment} ידרשו יישור",{total:e.anchors.total,carried:e.anchors.carried,needs_alignment:e.anchors.needs_alignment})}</span>
            </div>
            ${i?c`<div class="note" data-diff-structure>${n("המבנה של הטיוטה ({wallsAndOpenings}) יפורסם יחד עם הגרסה{v}.",{wallsAndOpenings:Ut(i.walls.length,i.openings.length),v:o?n("; יש בו שגיאות שחוסמות את הפרסום עד לתיקון: ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה"):""})}</div>`:g}
            ${e.anchors.items.length?c`<div class="ditems" data-diff-items>${e.anchors.items.map(l=>c`<div><span>${l.resource_type==="camera"?n("מצלמה"):n("ישות")} · ${l.name}</span><span class=${l.outcome==="carried"?"":"err"}>${l.outcome==="carried"?n("עובר"):n("יישור נדרש")}</span></div>`)}</div>`:g}
            ${e.anchors.needs_alignment?c`<div class="note">${n("פריטים שידרשו יישור נשארים במקומם על גרסת התוכנית הקודמת ומסומנים במפה; שום פריט לא מוזז למיקום מומצא.")}</div>`:g}`:c`<div class="note">${n("טוען השוואה…")}</div>`}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.diff=null}>${t.mode==="compare"?n("סגור"):n("ביטול")}</sw-button>
      ${t.mode!=="compare"&&e?c`<sw-button slot="footer" variant="primary" icon=${t.mode==="publish"?"check":"history"} data-diff-confirm ?disabled=${this.busy||o} @click=${()=>this.confirmDiff()}>${t.mode==="publish"?n("פרסם גרסה"):n("שחזר ופרסם")}</sw-button>`:g}
    </sw-dialog>`}renderGeomDiffDialog(){const t=this.geomDiff;if(!t)return g;const e=t.data,s=e?e.issues.filter(o=>o.severity==="error"):[],i=e?Object.entries(e.diff.collections):[];return c`<sw-dialog open heading=${n("פרסום המבנה")} subheading=${n("מה ישתנה לצופים במפה")} data-geom-diff @close=${()=>this.geomDiff=null}>
      ${t.error?c`<div class="err" data-geom-diff-error>${t.error}</div>`:g}
      ${e?c`<div class="ditems" data-geom-diff-rows>
              ${i.length?i.map(([o,a])=>c`<div><span>${Wo[o]??o}</span><span>${n("{addedCount} נוספו · {changedCount} שונו · {removedCount} הוסרו",{addedCount:a.added.length,changedCount:a.changed.length,removedCount:a.removed.length})}</span></div>`):c`<div><span>${n("אין שינוי בפריטים")}</span></div>`}
              ${e.diff.calibration_changed?c`<div><span>${n("כיול")}</span><span>${n("קנה המידה השתנה")}</span></div>`:g}
              ${(e.shared_pending??[]).filter(o=>o.invalid||(o.changes??0)>0).map(o=>c`<div data-geom-shared-pending>
                <span>${n("כולל שינויים בחלל המשותף{v}",{v:o.home_floor_name?` (${I(o.home_floor_name)})`:""})}</span>
                <span>${o.invalid?o.items?.length?n("{countLabel} לפרסום",{countLabel:z(o.items.length,n("פריט אחד לא מוכן"),n("פריטים לא מוכנים"))}):n("התוכן של החלל המשותף לא תקין - הפרסום ייחסם"):z(o.changes??0,n("שינוי אחד"),n("שינויים"))}</span>
              </div>
              ${o.invalid&&o.items?.length?c`<div class="note" data-geom-shared-invalid>${o.items.map(a=>c`<div>${a.id.split(":").pop()} · ${a.message}</div>`)}
                <label><sw-toggle size="sm" labelHidden in-label label=${n("פרסם בלי הפריטים האלה (הם יישארו כמו שפורסמו)")} data-geom-shared-skip .checked=${t.skip.length>0} @change=${a=>{this.geomDiff={...t,skip:E(a)?o.items.map(r=>r.id):[]}}}></sw-toggle> ${n("פרסם בלי הפריטים האלה (הם יישארו כמו שפורסמו)")}</label></div>`:g}`)}
            </div>
            <div class="note">${n("{v} · אחרי הפרסום: {wallsAndOpenings}",{v:e.published_counts?n("כעת: {wallsAndOpenings}",{wallsAndOpenings:Ut(e.published_counts.walls,e.published_counts.openings)}):n("פרסום ראשון של מבנה"),wallsAndOpenings:Ut(e.counts.walls,e.counts.openings)})}</div>
            ${s.length?c`<div class="err" data-geom-diff-error>${n("{countLabel} בטיוטה: הפרסום חסום עד לתיקון. ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה.",{countLabel:z(s.length,n("שגיאה חוסמת אחת"),n("שגיאות חוסמות"))})}</div>`:g}`:t.error?g:c`<div class="note">${n("טוען השוואה…")}</div>`}
      <sw-button slot="footer" variant="ghost" data-geom-cancel @click=${()=>this.geomDiff=null}>${n("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-geom-publish ?disabled=${this.busy||!e||s.length>0||(e.shared_pending??[]).some(o=>o.invalid&&!(o.items?.length&&t.skip.length))} @click=${()=>this.confirmGeomPublish()}>${n("פרסם מבנה")}</sw-button>
    </sw-dialog>`}render(){const t=this.bundle;if(this.error&&!t)return c`<sw-page heading=${n("עורך תוכנית")}><sw-state-panel state="error" hint=${this.error} actionLabel=${n("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!t)return c`<sw-page heading=${n("עורך תוכנית")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.selected,s=this.dirty.size,i=this.anchors.filter(a=>a.resource_type==="camera").length,o=this.anchors.length-i;return c`
      <sw-page heading=${n("עורך תוכנית")} subheading=${n("{buildingName} · {floorName} · {v} · העוגנים נשמרים בנפרד מתמונת המקור{v2}",{buildingName:t.buildingName,floorName:t.floorName,v:t.planStatus==="draft"?n("טיוטה"):t.planStatus==="published"?n("תוכנית מפורסמת"):n("אין תוכנית"),v2:t.source==="demo"?n(" · נתוני הדגמה"):""})} crumbs=${n("אתרים | {siteName} | {buildingName} | {floorName}",{siteName:t.siteName,buildingName:t.buildingName,floorName:t.floorName})} wide>
        ${t.permissions.publish&&(t.planStatus==="draft"||this.studio.pendingPublish)?c`<sw-button slot="actions" variant="primary" icon="check" data-publish ?disabled=${this.busy} @click=${()=>this.publish()}>${t.planStatus==="draft"?n("פרסום גרסה"):n("פרסום המבנה")}</sw-button>`:g}
        <sw-button slot="actions" icon="eye" @click=${()=>st(`/explore/floors/${t.floorId}`)}>${n("תצוגה מקדימה")}</sw-button>
        <sw-button slot="actions" ?disabled=${!s||this.busy} icon="check" @click=${()=>this.save()}>${s?n("שמירה ({dirty})",{dirty:s}):n("הכל שמור")}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}>${n("ביטול שינוי")}</sw-button>
        ${t.planStatus==="none"?c`<sw-state-panel icon="map" state="empty" heading=${n("לקומה אין תוכנית")} hint=${n("העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות.")}><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>st(`/explore/floors/${t.floorId}/import`)}>${n("העלאת תוכנית")}</sw-button> <sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>Os()}>${n("בקשה לאדריכל")}</sw-button></div></sw-state-panel>`:c`<div class="layout">
              <div class="mapwrap">
                <div class="bar">
                  <span class="autosave ${s?"dirty":""}"><i></i>${s?n("{dirty} שינויים לא שמורים",{dirty:s}):n("הכל שמור")}</span>
                  ${this.info?c`<span style="color:var(--sw-success-text)">${this.info}</span>`:g}
                  ${this.error?c`<span class="err">${this.error}</span>`:g}
                  <span class="grow"></span>
                  ${t.needsAlignment?c`<sw-badge kind="partial" label=${n("פריטים מגרסת תוכנית קודמת — בדוק מיקומים")}></sw-badge>
                    <sw-button size="sm" data-realign-crop ?disabled=${this.busy} title=${n("כשהגרסה החדשה היא חיתוך אחר של אותו שרטוט, המיקומים מחושבים דרך שני החיתוכים")} @click=${()=>this.realign("crop")}>${n("יישר לפי החיתוך")}</sw-button>
                    <sw-button size="sm" variant="ghost" data-realign-accept ?disabled=${this.busy} title=${n("אחרי בדיקה בעין: הפריטים נרשמים על הגרסה הנוכחית כפי שהם")} @click=${()=>this.realign("accept")}>${n("אשר מיקומים")}</sw-button>`:g}
                  <span>${n("גרירה מזיזה · גלגלת = זום · ידיות = כיוון ושדה ראייה")}</span>
                  ${this.phone.matches?g:c`<button class="icon ${this.panMode?"on":""}" data-tool-pan ?disabled=${this.detectBusy} title=${n("יד: הזזת התוכנית קבועה - כל גרירה מזיזה, עד לחיצה חוזרת או Esc")} aria-label=${n("מצב הזזה (יד)")} aria-pressed=${this.panMode} @click=${()=>this.panMode=!this.panMode}><sw-icon name="hand" size=${15}></sw-icon></button>
                        <button class="icon" data-tool-help title=${n("קיצורי מקלדת")} aria-label=${n("קיצורי מקלדת")} @click=${()=>this.shortcutsOpen=!0}><sw-icon name="help" size=${15}></sw-icon></button>`}
                </div>
                <div class="floorchip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
                ${this.studio.doc&&t.permissions.structure?c`<div class="levelbar">${Uo(this.studio.doc.levels.filter(a=>this.sharedLevels||!a.shared),this.activeLevel,a=>this.setLevelFilter(a),()=>this.openNewLevel(),a=>this.openLevelEdit(a))}${this.phone.matches?g:c`<sw-chip data-grid-chip icon="grid" ?selected=${this.grid.on} aria-pressed=${this.grid.on?"true":"false"} title=${n("רשת עזר: גרירה והצבה של עצם נצמדות אליה (המרווח בכלי השכבות)")} @click=${()=>this.setGrid(t.floorId,{on:!this.grid.on})}>${n("רשת")}</sw-chip>`}${!this.phone.matches&&this.shownTags.length?Ho(this.shownTags,a=>this.selectByTag(a)):g}</div>`:g}
                <div class="rail" role="toolbar" aria-label=${n("כלי עריכה")}>
                  ${La.filter(a=>a.id!=="camera"||vt("cameras_available")).map(a=>c`<button class=${a.id===this.tool?"on":""} data-tool=${a.id} ?disabled=${!a.ready||Vt.includes(a.id)&&!t.permissions.structure||this.detectBusy&&a.id!==this.tool} title=${a.label} aria-label=${a.label} aria-pressed=${a.id===this.tool} @click=${()=>this.pickTool(a.id)}><sw-icon .name=${a.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title=${n("ביטול (Ctrl+Z)")} aria-label=${n("ביטול")} data-rail-undo ?disabled=${this.detectBusy||!this.undoTarget} @click=${()=>this.undoAny()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title=${n("בצע שוב (Ctrl+Y)")} aria-label=${n("בצע שוב")} data-rail-redo ?disabled=${this.detectBusy||!this.redoTarget} @click=${()=>this.redoAny()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing||!!this.drawing||this.studioPlacing} .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .selectedZoneVertex=${this.zoneVertexSel&&this.zoneVertexSel.zoneId===this.selectedZoneId?this.zoneVertexSel.index:null} .draftPoints=${this.drawing??L}
                  .geometry=${this.geomPreview??this.studio.doc} .geomDrag=${this.geomDragMode} .structureLevel=${this.activeLevel} .selectedGeomId=${this.geomSel?.id??null} .highlightIds=${this.highlightIds} .selectedVertex=${this.geomSel?.vertex??null} .issueIds=${this.issueIds}
                  .cornerSnapPx=${this.straightDrawing||this.curveDrawing?G:0}
                  .curveHandles=${this.tool==="structure"&&this.studioMode==="curve"} .selectedSegment=${this.geomSel?.segment??null} .arcPreview=${this.curveLive(t)?.path??L}
                  .curveDraft=${this.curveDraft??L} .curvePointHandles=${this.geomSelectMode&&this.studioMode!=="curve"||this.tool==="select"||this.curveDrawing&&!this.curveDraft}
                  .wallDraft=${this.wallDraft??L} .hoverPoint=${this.studioPlacing?this.hover:null} .rulers=${this.rulers} .gridStep=${this.studio.doc?this.gridPx(this.studio.doc):0} .guides=${this.guides} .catalog=${this.catalogLookup}
                  .ghost=${this.doorGhost&&this.studio.doc?qn(this.studio.doc,this.doorGhost,this.wallDefaults):null} .ghostNote=${this.doorGhost?.note??""} .ghostWarn=${!!this.doorGhost&&(this.doorGhost.found==="default"||!!this.doorGhost.warning)}
                  .ghostHandles=${this.doorGhost&&this.studio.doc?Jn(this.studio.doc,this.doorGhost,t.width,t.height):L} @ghost-handle=${a=>this.onGhostHandle(a.detail)}
                  .candidates=${this.tool==="detect"&&this.cands?this.cands.set:null} .candidateStates=${this.shownCandStates} .selectedCandidateId=${this.candSel} .candidateEditable=${this.tool==="detect"&&!this.narrow&&!this.busy}
                  @candidate-select=${a=>this.toggleCandidate(a.detail.id)}
                  @candidate-drag=${a=>this.onCandidateDrag(a.detail)} .anchorPositions=${this.anchorPositions}
                  @plan-hover=${a=>this.onPlanHover(a.detail.x,a.detail.y,a.detail.shift,!!a.detail.item)}
                  .multiDrag=${this.multiShown.length>=2&&this.geomDragMode==="all"} .marquee=${this.multiOn} .panMode=${this.panMode}
                  @geom-box=${a=>this.onGeomBox(a.detail)}
                  @geom-select=${a=>this.onCanvasSelect(a.detail)}
                  @geom-drag-move=${a=>this.queueDragMove(a.detail)}
                  @geom-drag-cancel=${()=>{this.cancelDragMove(),this.geomPreview=null,this.guides=[],this.guideCache=null,this.zoneSaving||(this.zonePreview=null),this.dupId=null}}
                  @geom-drag=${a=>{this.cancelDragMove(),this.onGeomDrag(a.detail)}}
                  @zone-select=${a=>this.onZoneSelect(a.detail.id,!!a.detail.add)}
                  @zone-edit=${a=>{const r=this.zones.find(l=>l.id===a.detail.id);this.zoneVertexSel=null,r&&this.patchZone(r,{polygon:a.detail.polygon})}}
                  @zone-vertex-select=${a=>{a.detail.id===this.selectedZoneId&&(this.zoneVertexSel={zoneId:a.detail.id,index:a.detail.index})}}
                  @marker-select=${a=>{this.placing||this.drawing||this.studioPlacing||this.tool==="detect"||(this.selectedId=a.detail.id,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[])}}
                  @marker-move=${a=>{this.tool!=="detect"&&(this.apply(a.detail.id,{position:{x:+a.detail.x.toFixed(4),y:+a.detail.y.toFixed(4)}}),this.selectedId=a.detail.id,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[])}}
                  @marker-orient=${a=>this.apply(a.detail.id,{rotation_degrees:a.detail.rotation,field_of_view_degrees:a.detail.fov})}
                  @marker-coverage=${a=>this.apply(a.detail.id,a.detail.polygon?{coverage_polygon:a.detail.polygon.map(r=>[r.x,r.y])}:{coverage_radius:a.detail.radius})}
                  @plan-click=${a=>this.tool==="detect"?this.candSel=null:this.drawing?this.addDraftPoint(a.detail.x,a.detail.y):this.studioPlacing?this.studioClick(a.detail.x,a.detail.y,!!a.detail.shift):this.place(a.detail.x,a.detail.y)} @dragover=${a=>{a.dataTransfer?.types.includes("text/x-sw-item")&&a.preventDefault()}} @drop=${a=>this.onItemDrop(a)}></sw-plan-canvas>
                ${this.placing?c`<div class="placing-hint"><span>${n("לחץ על התוכנית כדי להציב את {v} · Esc לביטול",{v:this.placing.kind==="camera"?this.placing.camera.name:this.placing.entity.name||this.placing.entity.entity_id})}</span></div>`:g}
                ${this.drawing?c`<div class="placing-hint"><span>${n("ציור אזור: לחץ להוספת פינות ({drawingCount}) · לחיצה על הפינה הראשונה או Enter מסיימים · Esc לביטול",{drawingCount:this.drawing.length})}</span></div>`:g}
                ${this.placingItem&&!this.bindOffer?c`<div class="placing-hint"><span>${n("לחץ על התוכנית כדי להציב {he} · Esc לביטול",{he:this.placingItem.names.he})}</span></div>`:g}
                ${this.connMode?c`<div class="placing-hint"><span>${n("{v} · Esc לביטול",{v:this.connStart?n("לחץ על הנקודה השנייה"):n("לחץ על הנקודה הראשונה")})}</span></div>`:g}
                ${this.tool==="circuits"&&this.membersMode?this.circuitPlacing?c`<div class="placing-hint" data-circuit-placing><span>${Ko(this.circuitPlacing)}</span></div>`:c`<div class="placing-hint"><span>${n("לחץ על מנורה כדי להוסיף או להסיר אותה מהמעגל · Esc לסיום")}</span></div>`:g}
                ${this.bindOffer?c`<div class="placing-hint bindbar" data-bind-offer><span>${n("העצם ליד {anchorName} — להפוך אותו לגוף של הישות?",{anchorName:this.anchorName(this.bindOffer.anchor)})}
                    <button data-bind-accept @click=${()=>this.bindObject(this.bindOffer.objectId,this.bindOffer.anchor)}>${n("הצמד לישות")}</button><button data-bind-dismiss @click=${()=>{this.bindRefused.add(this.bindOffer.objectId),this.bindOffer=null}}>${n("לא")}</button></span></div>`:g}
                ${this.tool==="structure"&&this.studioMode==="markdoor"&&this.studio.doc?this.renderMarkDoorHint():g}
                ${this.curveDraft?this.renderCurveHint(t):g}
                ${this.wallDraft?c`<div class="placing-hint float" data-wall-hint><span>${n("ציור קיר: {wallDraftCount} נקודות · Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים · לחיצה על הנקודה הראשונה סוגרת מתאר · Esc לביטול",{wallDraftCount:this.wallDraft.length})}</span></div>`:g}
                <div class="legend"><span><i></i>${n("מצלמות · {cams}",{cams:i})}</span><span><i class="ent"></i>${n("התקנים · {ents}",{ents:o})}</span><span><i class="zone"></i>${n("אזורים · {zonesCount}",{zonesCount:this.zones.length})}</span></div>
              </div>
              <div class="props">
                ${this.renderSharedHint()}
                ${e?e.resource_type==="camera"?this.renderCameraInspector(e):this.renderEntityInspector(e):this.selectedZone&&this.tool!=="zones"?c`<sw-card heading=${n("אזור")} subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>${this.multiOn?c`<div class="note" data-multi-hint>${Rt}</div>`:g}`:this.renderToolPanel(t)}
                ${(e||this.selectedZone&&this.tool!=="zones")&&this.tool!=="select"?this.renderToolPanel(t):g}
                ${this.renderVersionCard(t)}
              </div>
            </div>`}
        ${this.renderDiffDialog()}
        ${this.renderGeomDiffDialog()}
        ${this.arrayDialog?qo(this.arrayDialog,a=>this.arrayDialog={...this.arrayDialog,error:"",...a},()=>this.createArray(),()=>this.arrayDialog=null):g}
        ${this.twinDelete?Yo(this.twinDelete.target,this.twinDelete.canBoth,()=>this.confirmTwinDelete(!0),()=>this.confirmTwinDelete(!1),()=>this.twinDelete=null):g}
        ${this.linkConfirm?Jo(this.linkConfirm.kind,this.linkConfirm.target,()=>this.confirmLink(!0),()=>this.confirmLink(!1)):g}
        ${this.groupDelete?Xo(this.studio.doc?.groups.find(a=>a.id===this.groupDelete)?.member_ids.length??0,()=>this.deleteGroup(!0),()=>this.deleteGroup(!1),()=>this.groupDelete=null):g}
        ${this.customDialog&&this.library?Qo(this.customDialog,this.library,a=>this.customDialog={...this.customDialog,...a},()=>void this.createCustom(),()=>this.customDialog=null):g}
        ${this.levelDialog?tn(this.levelDialog,{change:a=>this.levelDialog={...this.levelDialog,...a},submit:()=>this.submitLevel(),cancel:()=>this.levelDialog=null,remove:()=>this.deleteLevel()}):g}
        ${this.shortcutsOpen?en(()=>this.shortcutsOpen=!1):g}
        ${this.pkgImport?la(this.pkgImport,{setMode:a=>void this.previewPackage(a),setAcceptForeign:a=>this.setPackageTrust(a),confirm:()=>void this.confirmPackageImport(),cancel:()=>{this.pkgImport?.busy!=="import"&&(this.pkgImport=null)}}):g}
        ${this.renderShareDialog()}
      </sw-page>
    `}};f.styles=Oa;m([P()],f.prototype,"floorId",2);m([P()],f.prototype,"presetEntity",2);m([P()],f.prototype,"presetCandidates",2);m([P()],f.prototype,"presetZone",2);m([v()],f.prototype,"bundle",2);m([v()],f.prototype,"anchors",2);m([v()],f.prototype,"dirty",2);m([v()],f.prototype,"undo",2);m([v()],f.prototype,"redo",2);m([v()],f.prototype,"selectedId",2);m([v()],f.prototype,"tool",2);m([v()],f.prototype,"panMode",2);m([v()],f.prototype,"shortcutsOpen",2);m([v()],f.prototype,"layers",2);m([v()],f.prototype,"planImage",2);m([v()],f.prototype,"grid",2);m([v()],f.prototype,"guides",2);m([v()],f.prototype,"placing",2);m([v()],f.prototype,"entQ",2);m([v()],f.prototype,"entBuilding",2);m([v()],f.prototype,"entMeta",2);m([v()],f.prototype,"entResults",2);m([v()],f.prototype,"entBusy",2);m([v()],f.prototype,"lightsAll",2);m([v()],f.prototype,"busy",2);m([v()],f.prototype,"error",2);m([v()],f.prototype,"pkgImport",2);m([v()],f.prototype,"stylizing",2);m([v()],f.prototype,"stylized",2);m([v()],f.prototype,"stylizeOpts",2);m([v()],f.prototype,"zones",2);m([v()],f.prototype,"versions",2);m([v()],f.prototype,"geomVersions",2);m([v()],f.prototype,"areas",2);m([v()],f.prototype,"floorImages",2);m([v()],f.prototype,"alignDraft",2);m([v()],f.prototype,"alignShowPlan",2);m([v()],f.prototype,"imageBusy",2);m([v()],f.prototype,"imageNote",2);m([v()],f.prototype,"diff",2);m([v()],f.prototype,"selectedZoneId",2);m([v()],f.prototype,"zoneVertexSel",2);m([v()],f.prototype,"lastEdit",2);m([v()],f.prototype,"candidates",2);m([v()],f.prototype,"detecting",2);m([v()],f.prototype,"detectStrength",2);m([v()],f.prototype,"replaceAuto",2);m([v()],f.prototype,"drawing",2);m([v()],f.prototype,"showZones",2);m([v()],f.prototype,"zoneBusy",2);m([Ps("sw-plan-canvas")],f.prototype,"canvas",2);m([v()],f.prototype,"studioMode",2);m([v()],f.prototype,"curveDraft",2);m([v()],f.prototype,"glassDraw",2);m([v()],f.prototype,"doorGhost",2);m([v()],f.prototype,"doorAsking",2);m([v()],f.prototype,"wallDefaults",2);m([v()],f.prototype,"geomSel",2);m([v()],f.prototype,"multi",2);m([v()],f.prototype,"zonePreview",2);m([v()],f.prototype,"zoneSaving",2);m([v()],f.prototype,"multiNote",2);m([v()],f.prototype,"geomPreview",2);m([v()],f.prototype,"library",2);m([v()],f.prototype,"libQ",2);m([v()],f.prototype,"libCategory",2);m([v()],f.prototype,"libRecent",2);m([v()],f.prototype,"libFav",2);m([v()],f.prototype,"placingItem",2);m([v()],f.prototype,"bindOffer",2);m([v()],f.prototype,"arrayDialog",2);m([v()],f.prototype,"groupDelete",2);m([v()],f.prototype,"customDialog",2);m([v()],f.prototype,"levelFilter",2);m([v()],f.prototype,"levelDialog",2);m([v()],f.prototype,"matStyle",2);m([v()],f.prototype,"walkArmed",2);m([v()],f.prototype,"walkFocus",2);m([v()],f.prototype,"site",2);m([v()],f.prototype,"connMode",2);m([v()],f.prototype,"connStart",2);m([v()],f.prototype,"linkTargets",2);m([v()],f.prototype,"sharedLevels",2);m([v()],f.prototype,"shareDlg",2);m([v()],f.prototype,"stairShape",2);m([v()],f.prototype,"twinDelete",2);m([v()],f.prototype,"linkConfirm",2);m([v()],f.prototype,"linkBusy",2);m([v()],f.prototype,"circuitSel",2);m([v()],f.prototype,"membersMode",2);m([v()],f.prototype,"circuitPlacing",2);m([v()],f.prototype,"circuitNew",2);m([v()],f.prototype,"wallDraft",2);m([v()],f.prototype,"hover",2);m([v()],f.prototype,"calib",2);m([v()],f.prototype,"measurePts",2);m([v()],f.prototype,"geomDiff",2);m([v()],f.prototype,"showEstimates",2);m([v()],f.prototype,"camSuggestCfg",2);m([v()],f.prototype,"camSuggestions",2);m([v()],f.prototype,"zoneCamera",2);m([v()],f.prototype,"detectOpts",2);m([v()],f.prototype,"detectRun",2);m([v()],f.prototype,"cands",2);m([v()],f.prototype,"candStates",2);m([v()],f.prototype,"candSel",2);m([v()],f.prototype,"candEdits",2);m([v()],f.prototype,"candObjectsOn",2);m([v()],f.prototype,"hintApplied",2);m([v()],f.prototype,"detectAsk",2);m([v()],f.prototype,"removeAutoAsk",2);m([v()],f.prototype,"detectErr",2);m([v()],f.prototype,"narrow",2);f=m([Ye("explore-plan-editor")],f);export{f as ExplorePlanEditor};
