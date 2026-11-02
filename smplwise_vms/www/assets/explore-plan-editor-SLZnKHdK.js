import{b6 as Xe,b5 as H,b7 as Qe,A as p,e as h,E as Vt,g as ts,b8 as es,b9 as ss,ba as is,F as M,G as m,a as Ze,w as q,H as Be,j as P,R as $,bb as os,bc as ns,at as rs,J as as,bd as kt,be as ls,bf as ds,q as D,aj as J,bg as hs,bh as Qt,bi as cs,bj as us,b2 as ps,b3 as fs,bk as gs,bl as te,bm as ms,bn as ee,bo as se,b4 as vs,bp as ws}from"./index-DmgaojPZ.js";import{l as ie}from"./live-BKWPXK8F.js";import{o as bs}from"./architect-request-dialog-BC74ZZz8.js";import"./sw-chip-9iGUQ_k2.js";import{s as ys,m as oe,a as $s,c as ks,b as xs,d as _s,M as Ss,e as Ds,f as Is,g as O,h as zs,i as Y,j as Ms,r as ne,k as Ps,l as Ts,n as Cs,o as Os,p as As}from"./sw-plan-canvas-DdFocf21.js";import{d as T,p as A,w as at,e as x,O as Ut,a as Ge,b as st,o as it,c as Ve,g as vt,h as Ft,i as Es,s as Ls,j as wt,G as Rt,k as js,l as xt,m as Ns,n as re,q as ae,r as Fs,t as Rs,u as Zs,v as Bs,x as Gs,y as Vs,z as Us,A as le,B as _t,C as Ws,E as Ks,F as Hs,H as qs,I as ct,J as V,K as Js,L as Ys,M as Xs,N as St,P as de,S as he,Q as Qs,R as ti,T as ei,U as si,V as ii,W as ce,X,Y as oi,Z as ni,_ as ri,$ as ai,a0 as Q,a1 as tt,a2 as li,a3 as et,a4 as ue,a5 as pe,a6 as di,a7 as hi,a8 as ci,a9 as ui,aa as pi,ab as fi,ac as gi,ad as mi,ae as vi,af as fe,ag as wi,ah as bi,ai as yi,aj as Dt,ak as $i,al as ki,am as xi,an as _i,ao as ge,ap as Si,aq as Di,ar as me,as as Ii,at as zi,au as Mi,av as Pi,aw as ve,ax as It,ay as U,az as Ti,aA as Ci,aB as Oi,aC as Ai,aD as j,aE as we,aF as Ei,aG as zt,aH as be,aI as Li,aJ as Ue,aK as ji,aL as Mt,aM as Ni,aN as Fi,aO as ye,aP as Ri,aQ as Zi,aR as Bi,aS as Gi,aT as Vi,aU as Ui}from"./shared-space-CV0PloDF.js";import{p as Zt,d as Wi,a as $e,c as Ki,u as Hi,b as qi,e as Ji,f as Yi,r as Xi,l as Qi,g as to,s as eo,h as so,i as io,j as oo,Z as ke,z as no}from"./zones-C66a_V0C.js";import{p as ro,a as _,b as ao,G as lo,c as I,D as xe,d as _e,r as ho,e as co,f as ut,g as uo,h as po,i as Pt,j as Se,k as fo,l as Tt,m as go,n as mo,o as vo,S as wo,q as bo,C as yo,s as De,t as $o,u as ko,v as xo,w as _o,x as So,y as Do,z as Io,M as Ct,A as zo,B as Mo,E as Po,F as To,H as Co,I as Oo,J as Ao,K as Eo,L as Lo,N as jo,O as No,P as Fo,Q as Ro,R as Zo,T as Bo,U as Go}from"./plan-studio-panel-_9315dx5.js";import{s as Vo,g as Uo,b as Ie,c as Wo,p as Ko,l as Ho,d as qo,e as Jo,f as Yo,h as Xo,j as Qo,k as tn,m as en,n as sn,o as on,q as nn,r as pt,t as rn,u as an,v as ln}from"./geometry-CDTYeH-V.js";import{t as dn,f as hn,r as ze,d as cn,w as Me,a as ft,m as un,b as pn,c as fn}from"./candidates-CS7-ly_Q.js";import{p as Pe,o as Ot}from"./connector-targets-Cw_oqhYV.js";import{l as gn,a as mn,i as L,c as vn,b as wn,e as bn,d as yn}from"./plan-catalog-B_6ytCDa.js";import{r as $n,A as kn,a as xn}from"./material-resolve-eAGORPjC.js";import{D as Te}from"./sun-D-xXkfn5.js";import"./sw-logo-art-Va6y_cIM.js";const _n="ghost-wall",Sn="ghost-door",bt=[.4,3],Ce=.12,Dn=.25,In="door_tool",rt=(t,e,s)=>Math.min(s,Math.max(e,t)),Bt=t=>Math.round(t*1e3)/1e3;function lt(t,e,s,i){return Ft(t,s,i)*x(e).scale}function zn(t,e,s,i,o){const{scale:n}=x(t),r=e.width_px!=null?Bt(rt(e.width_px*n,bt[0],bt[1])):Ut.door.width_m,a=e.new_wall?{polyline:e.new_wall.polyline.map(l=>[l[0],l[1]]),thickness_m:Bt(rt(e.new_wall.thickness_px*n,.05,.6))||o.thickness_m}:null,d={found:e.found,note:e.note,warning:e.warning,wallId:e.wall_id,newWall:a,t:e.t,width_m:r,hinge:e.hinge,swing:e.swing,confidence:e.confidence};return Wt(t,d,s,i)}function R(t,e,s){return e.wallId?t.walls.find(i=>i.id===e.wallId)??null:e.newWall?{id:_n,level_id:T(t),polyline:e.newWall.polyline,thickness_m:e.newWall.thickness_m||s?.thickness_m||.15,height_m:null,base_z_m:0,kind:s?.kind??"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}:null}function Wt(t,e,s,i){const o=R(t,e);if(!o)return e;if(e.newWall){const[a,d]=[e.newWall.polyline[0],e.newWall.polyline[e.newWall.polyline.length-1]],l=a[0]+(d[0]-a[0])*e.t,c=a[1]+(d[1]-a[1])*e.t,u=(d[0]-a[0])*s,v=(d[1]-a[1])*i,w=Math.hypot(u,v)||1,b=x(t).scale,k=e.width_m/2/b,S=u/w,y=v/w,E=Je=>{let Ht=k+Ce/b,qt=Number.POSITIVE_INFINITY;const Ye=Math.max(e.newWall.thickness_m,.2)/b;for(const ht of t.walls)if(!(ht.polyline.length<2))for(const Jt of[ht.polyline[0],ht.polyline[ht.polyline.length-1]]){const Yt=(Jt[0]-l)*s,Xt=(Jt[1]-c)*i,yt=(Yt*S+Xt*y)*Je,$t=Math.abs(Yt*y-Xt*S);yt>=k&&yt<=k+(Ce+Dn)/b&&$t<=Ye&&$t<qt&&(Ht=yt,qt=$t)}return Ht},G=E(1),Z=E(-1),dt=[l-S*Z/s,c-y*Z/i],qe=[l+S*G/s,c+y*G/i];return{...e,t:Z/(Z+G),newWall:{...e.newWall,polyline:[dt,qe]}}}const[n,r]=it(e.width_m,lt(o,t,s,i));return{...e,t:rt(e.t,n,r)}}function Mn(t,e,s){const i=R(t,e,s);if(!i)return null;const o={id:Sn,wall_id:i.id,t:e.t,kind:"door",width_m:e.width_m,height_m:Ut.door.height_m,sill_m:0,swing:e.swing,hinge:e.hinge,anchor_ref:null,confidence:e.confidence,source:"manual",external_ids:{}};return{...t,walls:[i],openings:[o],labels:[],objects:[],connectors:[]}}function Pn(t,e,s,i){const o=R(t,e);if(!o)return null;const n=lt(o,t,s,i),r=n>0?e.width_m/2/n:0;return[A(o,e.t-r,s,i),A(o,e.t+r,s,i)]}function Tn(t,e,s,i){const o=R(t,e),n=Pn(t,e,s,i);if(!o||!n)return[];const r=at(o,e.t,s,i),a=[r[1],-r[0]],d=e.swing==="double"||e.swing==="sliding",c=(d?e.hinge==="start":e.swing==="left")?1:-1,{scale:u}=x(t),v=e.width_m/u,w=e.hinge==="start"?n[0]:n[1],b=d||e.hinge==="start"?n[1]:n[0],k=(Z,dt)=>[Z[0]+a[0]*dt/s,Z[1]+a[1]*dt/i],S=[(n[0][0]+n[1][0])/2,(n[0][1]+n[1][1])/2],y=[{id:"width",at:b,label:"רוחב הדלת: גרירה לאורך הקיר"}],E=e.hinge==="start"?-1:1,G=Math.max(14,.3*v);return d||y.push({id:"hinge",at:[w[0]+r[0]*E*G/s,w[1]+r[1]*E*G/i],label:"החלף צד ציר"}),y.push({id:"swing",at:k(S,c*Math.max(18,.5*v)),label:d?"החלף את צד הפתיחה":"החלף כיוון פתיחה"}),y}function We(t){return{...t,hinge:t.hinge==="start"?"end":"start"}}function Cn(t){return t.swing==="double"||t.swing==="sliding"?We(t):{...t,swing:t.swing==="left"?"right":t.swing==="right"?"left":t.swing}}function On(t,e,s,i,o){const n=R(t,e);if(!n)return e;const r=A(n,e.t,i,o),a=at(n,e.t,i,o),d=Math.abs((s[0]-r[0])*i*a[0]+(s[1]-r[1])*o*a[1]);let l=rt(2*d*x(t).scale,bt[0],bt[1]);return e.newWall||(l=Math.min(l,lt(n,t,i,o))),Wt(t,{...e,width_m:Bt(l)},i,o)}function An(t,e,s,i,o,n){let r=t,a=e.wallId;if(!a){if(!e.newWall)return null;const v=Ge(r,e.newWall.polyline,{thickness_m:e.newWall.thickness_m||o.thickness_m,kind:o.kind});r=st(v.doc,v.id,{external_ids:{origin:In},...n&&n!==T(v.doc)?{level_id:n}:{}}),a=v.id}const d=r.walls.find(v=>v.id===a);if(!d)return null;const[l,c]=it(e.width_m,lt(d,r,s,i)),u=Ve(r,a,rt(e.t,l,c),"door");return{doc:vt(u.doc,u.id,{width_m:e.width_m,swing:e.swing,hinge:e.hinge}),openingId:u.id,wallId:a}}function En(t,e,s,i){const o=e.wallId?t.walls.find(d=>d.id===e.wallId):null;if(!o)return null;const n=lt(o,t,s,i);let r=null,a=Number.POSITIVE_INFINITY;for(const d of t.openings){if(d.wall_id!==o.id)continue;const l=Math.abs(d.t-e.t)*n;l<Math.max(d.width_m,e.width_m)/2&&l<a&&(r=d,a=l)}return r}function Ln(t,e,s,i,o,n){const r=at(e,s,o,n),a=A(e,s,o,n),d=(i[0]-a[0])*o*r[1]+(i[1]-a[1])*n*-r[0]>0;return Wt(t,{found:"default",note:"ברירת מחדל - בדוק",warning:null,wallId:e.id,newWall:null,t:s,width_m:Ut.door.width_m,hinge:"start",swing:d?"left":"right",confidence:.2},o,n)}function jn(t,e,s,i,o){const n=R(t,e);if(!n)return!1;const r=A(n,e.t,i,o),a=at(n,e.t,i,o),d=(s[0]-r[0])*i,l=(s[1]-r[1])*o,c=e.width_m/x(t).scale;return Math.abs(d*a[0]+l*a[1])<=c/2&&Math.abs(d*a[1]-l*a[0])<=c}const At={white:"לבן",tint:"גוון לכל חדר",none:"ללא מילוי"};async function Nn(t,e){const s=await Xe(`plan-versions/${t}/stylize`,e);return{...s,source_url:H(s.source_url)+`?v=${Date.now()}`,stylized_url:H(s.stylized_url)+`?v=${Date.now()}`}}const Fn=(t,e)=>Qe(`plan-versions/${t}`,{render_mode:e}),gt=["walls","openings","rooms","objects","labels","connectors","levels","circuits","groups"];function Oe(t,e){if(!t)return"";const s=new Date(t);return Number.isNaN(s.getTime())?"":s.toLocaleString(e==="en"?"en-GB":"he-IL",{dateStyle:"short",timeStyle:"short"})}function Rn(t,e){if(t.diff.same)return h`<div class="pkg-line" data-pkg-nochange>${_("noChanges",e)}</div>`;const s=Object.keys(t.diff.collections).sort((i,o)=>gt.indexOf(i)+99*+(gt.indexOf(i)<0)-(gt.indexOf(o)+99*+(gt.indexOf(o)<0)));return h`<ul class="pkg-list" data-pkg-diff>
    ${s.map(i=>{const o=t.diff.collections[i],n=[o.added.length?`${_("added",e)} ${o.added.length}`:"",o.removed.length?`${_("removed",e)} ${o.removed.length}`:"",o.changed.length?`${_("changed",e)} ${o.changed.length}`:""].filter(Boolean);return h`<li data-pkg-coll=${i}><strong>${ao(i,e)}</strong> <span>${n.join(" · ")}</span></li>`})}
    ${t.diff.calibration_changed?h`<li data-pkg-calibration>${_("calibration",e)}</li>`:p}
  </ul>`}function Zn(t,e){const s=t.entities,o=[["cameras",_("missing",e),s.anchors_missing.map(a=>a.name||a.resource_id)],["unplaced",_("unplaced",e),s.anchors_unplaced.map(a=>a.name||a.resource_id)],["rooms",_("rooms",e),s.rooms_missing],["switches",_("switches",e),s.switches_missing],["items",_("items",e),s.items_missing]].filter(([,,a])=>a.length),n=s.items_added.length?h`<li data-pkg-items-added><strong>${_("itemsAdded",e)}</strong> <bdi>${s.items_added.join(", ")}</bdi></li>`:p,r=s.items_differ.length?h`<li data-pkg-items-differ><strong>${_("itemsDiffer",e)}</strong> <bdi>${s.items_differ.join(", ")}</bdi></li>`:p;return!o.length&&n===p&&r===p?p:h`<div class="pkg-sec" data-pkg-missing>
    <div class="pkg-h">${_("missing",e)}</div>
    <ul class="pkg-list">
      ${o.map(([a,d,l])=>h`<li data-pkg-missing-kind=${a}><strong>${a==="cameras"?_("cameras",e):d}</strong> <bdi>${l.slice(0,12).join(", ")}${l.length>12?` +${l.length-12}`:""}</bdi></li>`)}
      ${n}${r}
    </ul>
  </div>`}function Bn(t,e){const s=ro(),i=t.preview,o=!!i&&(i.origin.trust!=="installation"||!!i.origin.retired_key),n=!!i&&!t.busy&&(!o||t.acceptForeign),r=!i&&t.foreign?t.foreign:null;return h`<sw-dialog open wide heading=${_("title",s)} subheading=${t.file.name} data-pkg-dialog ?locked=${t.busy==="import"} @close=${()=>e.cancel()}>
    <div class="modes" role="group" aria-label=${_("mode",s)}>
      ${["replace","merge"].map(a=>h`<button class=${t.mode===a?"on":""} aria-pressed=${t.mode===a} data-pkg-mode=${a} ?disabled=${!!t.busy} @click=${()=>e.setMode(a)}>${_(a,s)}</button>`)}
    </div>
    ${t.busy==="check"?h`<div class="note" data-pkg-checking>${_("checking",s)}</div>`:p}
    ${t.error?h`<div class="err" data-pkg-error>${t.error}</div>`:p}
    ${r?h`<div class="pkg-sec" data-pkg-origin data-pkg-gate>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${r.floor_name??""}</bdi> · ${_(r.stage==="draft"?"draft":"published",s)} · <bdi>${Oe(r.generated_at,s)}</bdi></div>
            <div class="pkg-line warn" data-pkg-trust=${r.trust}>${_("signedForeign",s)}</div>
          </div>
          <label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${t.acceptForeign} ?disabled=${!!t.busy} @change=${a=>e.setAcceptForeign(a.target.checked)} /> ${_("trustForeign",s)}</label>`:p}
    ${i?h`<div class="pkg-sec" data-pkg-origin>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${i.origin.floor_name??""}</bdi> · ${_(i.origin.stage==="draft"?"draft":"published",s)} · <bdi>${Oe(i.origin.generated_at,s)}</bdi></div>
            <div class="pkg-line ${o?"warn":"ok"}" data-pkg-trust=${i.origin.trust}>${_(o?"signedForeign":"signedHere",s)}</div>
          </div>
          <div class="pkg-sec">
            <div class="pkg-h">${_("changes",s)}</div>
            ${Rn(i,s)}
            ${i.warnings.includes("other_drawing")?h`<div class="pkg-line warn" data-pkg-other-drawing>${_("otherDrawing",s)}</div>`:p}
            ${i.warnings.includes("newer_app_version")?h`<div class="pkg-line warn" data-pkg-newer>${_("newerApp",s)}</div>`:p}
            ${i.issue_count?h`<div class="pkg-line" data-pkg-issues>${_("issues",s)}: ${i.issue_count}</div>`:p}
          </div>
          ${Zn(i,s)}
          ${o?h`<label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${t.acceptForeign} @change=${a=>e.setAcceptForeign(a.target.checked)} /> ${_("trustForeign",s)}</label>`:p}`:p}
    <sw-button slot="footer" variant="ghost" data-pkg-cancel ?disabled=${t.busy==="import"} @click=${()=>e.cancel()}>${_("cancel",s)}</sw-button>
    <sw-button slot="footer" icon="download" data-pkg-confirm ?disabled=${!n} @click=${()=>n&&e.confirm()}>${t.busy==="import"?_("importing",s):_("importDraft",s)}</sw-button>
  </sw-dialog>`}const Gn=Vt`
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
`,Vn=t=>ts(`floors/${t}/images`),Un=(t,e,s)=>{const i=new FormData;return i.append("variant",e),i.append("file",s,s.name||`${e}.png`),es(`floors/${t}/images`,i)},Wn=(t,e)=>ss(`floors/${t}/images/${e}`),Kn=(t,e,s)=>is(`floors/${t}/images/layout`,s===void 0?{corners:e}:{corners:e,opacity:s}),Hn=t=>t?H(t.url):null;var qn=Object.defineProperty,Jn=Object.getOwnPropertyDescriptor,C=(t,e,s,i)=>{for(var o=i>1?void 0:i?Jn(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&qn(e,s,o),o};const Yn=["פינה שמאלית-עליונה","פינה ימנית-עליונה","פינה ימנית-תחתונה","פינה שמאלית-תחתונה"];let z=class extends Ze{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.planUrl=null,this.showPlan=!0,this.imageUrl=null,this.corners=[[0,0],[1,0],[1,1],[0,1]],this.opacity=.7,this.rooms=[],this.walls=[],this.disabled=!1,this.drag=null}willUpdate(){this.style.setProperty("--ar",`${this.planWidth} / ${this.planHeight}`)}toPlan(t){const e=this.getBoundingClientRect();return{x:(t.clientX-e.left)/e.width*this.planWidth,y:(t.clientY-e.top)/e.height*this.planHeight}}down(t,e,s){if(this.disabled||t.button!==0)return;t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId);const i=this.toPlan(t);this.drag={kind:e,index:s,startX:i.x,startY:i.y,start:this.corners.map(o=>[o[0],o[1]])}}move(t){const e=this.drag;if(!e)return;const s=this.toPlan(t),i=(s.x-e.startX)/this.planWidth,o=(s.y-e.startY)/this.planHeight,n=e.kind==="body"?ys(e.start,i,o):oe(e.start,e.index,{x:e.start[e.index][0]+i,y:e.start[e.index][1]+o});this.emit(n)}up(){this.drag=null}key(t,e){if(this.disabled)return;const s=t.shiftKey?10:1,i=t.key==="ArrowLeft"?-s:t.key==="ArrowRight"?s:0,o=t.key==="ArrowUp"?-s:t.key==="ArrowDown"?s:0;if(!i&&!o)return;t.preventDefault();const n=this.corners[e];this.emit(oe(this.corners,e,{x:n[0]+i/this.planWidth,y:n[1]+o/this.planHeight}))}emit(t){this.corners=t,this.dispatchEvent(new CustomEvent("corners-change",{detail:{corners:t},bubbles:!0,composed:!0}))}render(){const t=this.planWidth,e=this.planHeight,s=$s(this.corners,t,e),i=this.corners.map(r=>`${(r[0]*t).toFixed(1)},${(r[1]*e).toFixed(1)}`).join(" "),o=Math.max(t,e)*.012,n=ks(this.corners,t,e);return h`<svg viewBox=${`0 0 ${t} ${e}`} role="application" aria-label="יישור תמונת הקומה" @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up}>
      ${this.planUrl&&this.showPlan?q`<image href=${this.planUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity="0.35" />`:p}
      ${this.imageUrl?q`<image data-align-image href=${this.imageUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity=${this.opacity} transform=${xs(s)} />`:p}
      ${this.rooms.map(r=>q`<polygon class="room" points=${r.polygon.map(a=>`${(a.x*t).toFixed(1)},${(a.y*e).toFixed(1)}`).join(" ")} />`)}
      ${this.walls.map(r=>q`<line class="wall" x1=${(r[0][0]*t).toFixed(1)} y1=${(r[0][1]*e).toFixed(1)} x2=${(r[1][0]*t).toFixed(1)} y2=${(r[1][1]*e).toFixed(1)} />`)}
      <polygon class="frame" points=${i} />
      <polygon class="body" data-align-body points=${i} @pointerdown=${r=>this.down(r,"body",-1)} />
      ${this.corners.map((r,a)=>(_s(s,a===0?{x:0,y:0}:a===1?{x:t,y:0}:a===2?{x:t,y:e}:{x:0,y:e}),q`<circle class="handle" data-align-handle=${a} tabindex=${this.disabled?-1:0} role="slider" aria-label=${Yn[a]} aria-valuetext=${`${Math.round(r[0]*100)}%, ${Math.round(r[1]*100)}%`}
          cx=${(r[0]*t).toFixed(1)} cy=${(r[1]*e).toFixed(1)} r=${o.toFixed(1)} @pointerdown=${d=>this.down(d,"corner",a)} @keydown=${d=>this.key(d,a)} />`))}
    </svg>
    ${n>.002?h`<div class="res" data-align-residual>סטייה ${(n*100).toFixed(1)}% - תמונה בפרספקטיבה; היישור מקורב</div>`:p}`}};z.styles=Vt`
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
  `;C([M({type:Number})],z.prototype,"planWidth",2);C([M({type:Number})],z.prototype,"planHeight",2);C([M()],z.prototype,"planUrl",2);C([M({type:Boolean})],z.prototype,"showPlan",2);C([M()],z.prototype,"imageUrl",2);C([M({attribute:!1})],z.prototype,"corners",2);C([M({type:Number})],z.prototype,"opacity",2);C([M({attribute:!1})],z.prototype,"rooms",2);C([M({attribute:!1})],z.prototype,"walls",2);C([M({type:Boolean})],z.prototype,"disabled",2);C([m()],z.prototype,"drag",2);z=C([Be("sw-floor-image-align")],z);const Kt={maxDistance:.35,fovWeight:.5,maxSuggestions:3},Xn=3;function Ke(t){const e=Kt,s=(i,o,n,r)=>typeof i=="number"&&Number.isFinite(i)&&i>=o&&i<=n?i:r;return{maxDistance:s(t?.maxDistance,1e-6,1,e.maxDistance),fovWeight:s(t?.fovWeight,0,1,e.fovWeight),maxSuggestions:Math.round(s(t?.maxSuggestions,1,Xn,e.maxSuggestions))}}const ot=(t,e)=>({x:t.x,y:t.y/e});function Qn(t,e,s){const i=s.x-e.x,o=s.y-e.y,n=i*i+o*o;if(n===0)return Math.hypot(t.x-e.x,t.y-e.y);const r=Math.max(0,Math.min(1,((t.x-e.x)*i+(t.y-e.y)*o)/n));return Math.hypot(t.x-(e.x+r*i),t.y-(e.y+r*o))}function tr(t,e,s=1){if(e.length<3)return 1/0;if(Zt(t,e))return 0;const i=ot(t,s);let o=1/0;for(let n=0;n<e.length;n++)o=Math.min(o,Qn(i,ot(e[n],s),ot(e[(n+1)%e.length],s)));return o}function er(t){const e=[];let s=0,i=0;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length];e.push(n,{x:(n.x+r.x)/2,y:(n.y+r.y)/2}),s+=n.x,i+=n.y}return e.push({x:s/t.length,y:i/t.length}),e}function sr(t,e,s=1){const i=ot(t,s),o=ot(e,s);return(Math.atan2(o.x-i.x,-(o.y-i.y))*180/Math.PI+360)%360}function ir(t,e,s,i,o=1){const n=er(i),r=Math.max(0,Math.min(360,s))/2;let a=0;for(const d of n){if(Math.hypot(d.x-t.x,(d.y-t.y)/o)<1e-9){a++;continue}Math.abs((sr(t,d,o)-e+540)%360-180)<=r+1e-9&&a++}return a/n.length}function or(t,e,s={},i={}){const o=Ke({...Kt,...s}),n=i.aspect&&i.aspect>0?i.aspect:1;if(t.polygon.length<3)return[];const r=new Set(i.exclude??[]),a=[];for(const d of e){if(r.has(d.id)||d.floorId!==t.floorId||t.levelId&&d.levelId&&t.levelId!==d.levelId)continue;const l=tr(d.position,t.polygon,n);if(l>o.maxDistance)continue;const c=d.fovDeg!=null&&d.fovDeg>0?ir(d.position,d.rotationDeg,d.fovDeg,t.polygon,n):null;if(c!==null&&c===0&&o.fovWeight>=1)continue;const u=l/o.maxDistance+(c===null?0:o.fovWeight*(1-c));a.push({id:d.id,distance:l,inside:l===0,facing:c,score:u})}return a.sort((d,l)=>d.score-l.score||d.distance-l.distance||(d.id<l.id?-1:1)),a.slice(0,o.maxSuggestions)}function nr(t,e){const s=new Map((e.circuits??[]).map(o=>[o.id,o.power_w])),i={...t,connectors:e.connectors??t.connectors,circuits:t.circuits.map(o=>s.has(o.id)?{...o,power_w:s.get(o.id)}:o)};if(!e.shared_spaces?.length&&!t.shared_spaces?.length)return i;for(const o of He){const n=(i[o]??[]).filter(a=>!wt(a)),r=(e[o]??[]).filter(a=>wt(a));i[o]=[...n,...r]}return i.shared_spaces=e.shared_spaces,i}const He=["walls","openings","objects","labels","circuits","groups","levels"],Gt=["connectors",...He];function F(t,e){const s=t[e]??[];return e==="connectors"?s:s.filter(i=>wt(i))}function Et(t,e){return e==="connectors"?[]:(t[e]??[]).filter(s=>!wt(s))}function rr(t){return`המדרגות ב${[...new Set(t.map(s=>s.name))].join(" וב")} לא עודכנו - אין לך הרשאת עריכה שם`}const Ae=(t,e)=>JSON.stringify(t)===JSON.stringify(e),ar=t=>{const{far:e,...s}=t;return JSON.stringify(s)},nt=t=>new Map(t.map(e=>[e.id,ar(e)]));function lr(t,e,s){const i=new Set([...Object.keys(t),...Object.keys(s)]);for(const r of i)if(r!=="shared_spaces"){if(Gt.includes(r)){if(!Ae(Et(t,r),Et(s,r)))return null}else if(!Ae(t[r],s[r]))return null}let o=!1;const n={...e,shared_spaces:s.shared_spaces};for(const r of Gt){const a=nt(F(t,r)),d=nt(F(e,r)),l=nt(F(s,r)),c=[...new Set([...a.keys(),...d.keys(),...l.keys()])],u=new Set(c.filter(k=>a.get(k)!==d.get(k))),v=c.filter(k=>a.get(k)!==l.get(k));if(v.some(k=>u.has(k)))return null;v.length&&(o=!0);const w=new Map(F(e,r).map(k=>[k.id,k])),b=F(s,r).flatMap(k=>u.has(k.id)?w.has(k.id)?[w.get(k.id)]:[]:[k]);for(const k of F(e,r))u.has(k.id)&&!l.has(k.id)&&b.push(k);n[r]=[...Et(e,r),...b]}return o?n:null}function dr(t,e){const s=new Map;for(const i of Gt){const o=nt(F(t,i)),n=nt(F(e,i)),r=[...new Set([...o.keys(),...n.keys()])].filter(a=>o.get(a)!==n.get(a));r.length&&s.set(i,new Set(r))}return s}function Ee(t,e,s){if(!s.size)return t;const i={...t,shared_spaces:e.shared_spaces??t.shared_spaces};for(const[o,n]of s){const r=new Map((e[o]??[]).map(l=>[l.id,l])),a=(t[o]??[]).flatMap(l=>n.has(l.id)?r.has(l.id)?[r.get(l.id)]:[]:[l]),d=new Set(a.map(l=>l.id));for(const l of e[o]??[])n.has(l.id)&&!d.has(l.id)&&a.push(l);i[o]=a}return i}const hr={load:t=>Uo(t,{draft:!0}),save:(t,e,s)=>Vo(t,e,s)};class cr{constructor(e,s=hr,i=2e3){this.host=e,this.api=s,this.delayMs=i,this.doc=null,this.revision=0,this.hash=null,this.publishedHash=null,this.issues=[],this.copyCandidates=[],this.saveState="idle",this.error="",this.claimed=new Map,this.sharedPending=[],this.onNotice=null,this.versionId=null,this.base=null,this.rebased=!1,this.undoStack=[],this.redoStack=[],this.dirty=!1,this.inflight=null,this.conflicted=!1,this.loadToken=0,this.loaded=0,e.addController(this)}hostConnected(){}hostDisconnected(){clearTimeout(this.timer)}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}get hasConflict(){return this.conflicted}get pendingPublish(){const e=this.doc;return e&&this.sharedPending.some(s=>(s.changes??0)>0)?!0:!e||!this.hash||this.hash===this.publishedHash?!1:this.publishedHash!==null||e.walls.length>0||e.openings.length>0||e.labels.length>0||e.objects.length>0||e.connectors.length>0}async load(e){clearTimeout(this.timer);const s=++this.loadToken;let i;try{i=await this.api.load(e)}catch(o){if(s===this.loadToken)throw o;return}s===this.loadToken&&(this.loaded=s,this.versionId=e,this.apply(i),this.doc=i.doc,this.base=i.doc,this.rebased=!1,this.copyCandidates=i.copy_candidates??[],this.undoStack=[],this.redoStack=[],this.dirty=!1,this.conflicted=!1,this.saveState="idle",this.error="",this.host.requestUpdate())}commit(e){if(!this.doc)return;const s=Es(this.doc,e);this.claimed=s.claimed,e=s.doc,this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.change(e)}undo(){const e=this.undoStack.pop();!e||!this.doc||(this.redoStack.push(this.doc),this.change(e))}redo(){const e=this.redoStack.pop();!e||!this.doc||(this.undoStack.push(this.doc),this.change(e))}adopt(e){return!this.doc||!this.versionId||e.doc.plan_version_id!==this.versionId||this.dirty||this.inflight?!1:(clearTimeout(this.timer),this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.apply(e),this.doc=e.doc,this.base=e.doc,this.dirty=!1,this.conflicted=!1,this.saveState="saved",this.error="",this.host.requestUpdate(),!0)}async flush(){clearTimeout(this.timer);let e=!1;for(;;){if(this.inflight){await this.inflight;continue}if(!this.dirty||this.conflicted||e&&this.saveState==="error")break;e=!0,this.inflight=this.saveOnce(),await this.inflight,this.inflight=null}return!this.dirty&&this.saveState!=="error"}change(e){this.doc=e,this.dirty=!0,clearTimeout(this.timer),this.conflicted||(this.saveState!=="saving"&&(this.saveState="pending"),this.timer=setTimeout(()=>void this.flush(),this.delayMs)),this.host.requestUpdate()}apply(e){this.revision=e.geometry.revision,this.hash=e.geometry.doc_hash,this.publishedHash=e.published_hash,this.issues=e.issues,this.sharedPending=e.shared_pending??[];const s=e.twins_skipped??[];s.length&&this.onNotice?.(rr(s))}async rebase(e,s){if(!this.base||this.rebased)return!1;let i;try{i=await this.api.load(e)}catch{return!1}if(s!==this.loaded||!this.doc)return!1;const o=lr(this.base,this.doc,i.doc);if(!o)return!1;this.rebased=!0;const n=dr(this.base,i.doc);return this.undoStack=this.undoStack.map(r=>Ee(r,i.doc,n)),this.redoStack=this.redoStack.map(r=>Ee(r,i.doc,n)),this.apply(i),this.base=i.doc,this.doc=o,this.dirty=!0,this.saveState="pending",this.error="",!0}async saveOnce(){const e=this.doc,s=this.versionId,i=this.loaded;if(!e||!s){this.dirty=!1;return}this.dirty=!1,this.saveState="saving",this.host.requestUpdate();try{const o=Ls(this.base,e),n=await this.api.save(s,o.length?{...e,shared_deleted:o}:e,this.revision);if(i!==this.loaded)return;this.apply(n),n.doc&&(this.base=n.doc),this.rebased=!1,this.doc===e&&n.doc&&(this.doc=nr(e,n.doc)),this.saveState=this.dirty?"pending":"saved",this.error=""}catch(o){if(i!==this.loaded)return;if(this.dirty=!0,o instanceof P&&o.code==="stale_revision"){if(await this.rebase(s,i))return;this.conflicted=!0}this.saveState="error",this.error=this.conflicted?"הקומה עודכנה מקומה אחרת או במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי (שינויים שלא נשמרו כאן לא יישמרו).":$(o)}finally{this.host.requestUpdate()}}}var ur=Object.defineProperty,pr=Object.getOwnPropertyDescriptor,g=(t,e,s,i)=>{for(var o=i>1?void 0:i?pr(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&ur(e,s,o),o};const Le=15e3,je=t=>t instanceof DOMException&&(t.name==="TimeoutError"||t.name==="AbortError")?"השרת לא ענה בזמן":$(t),mt=["#2767ED","#22A06B","#F59E0B","#8B5CF6","#0EA5E9","#EC4899","#14B8A6","#F97316"],fr=[{id:"select",icon:"target",label:"בחירה וגרירה",ready:!0},{id:"camera",icon:"camera",label:"הוספת מצלמה",ready:!0},{id:"lights",icon:"light",label:"הוספת תאורה (מפסקים)",ready:!0},{id:"entity",icon:"plus",label:"התקן אחר",ready:!0},{id:"zones",icon:"map",label:"חדרים ואזורים",ready:!0},{id:"structure",icon:"wall",label:"מבנה: קירות, דלתות וחלונות",ready:!0},{id:"library",icon:"grid",label:"ספריית עצמים",ready:!0},{id:"connectors",icon:"stairs",label:"מפלסים ומחברים",ready:!0},{id:"circuits",icon:"bolt",label:"מעגלי תאורה",ready:!0},{id:"calibrate",icon:"scale",label:"כיול קנה מידה",ready:!0},{id:"walk",icon:"route",label:"עמדות סיור",ready:!0},{id:"measure",icon:"ruler",label:"מדידת מרחק ושטח",ready:!0},{id:"detect",icon:"sparkle",label:"זיהוי אוטומטי של קירות ופתחים",ready:!0},{id:"layers",icon:"layers",label:"שכבות",ready:!0}],Lt=["structure","library","connectors","circuits","calibrate","walk","measure","detect"],B={a:null,b:null,metres:"",result:"",warning:"",pairs:[]},gr=1e3,mr=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"],Ne=t=>{try{const e=JSON.parse(localStorage.getItem(t)??"[]");return Array.isArray(e)?e.filter(s=>typeof s=="string"):[]}catch{return[]}},vr=t=>{try{const e=Number(localStorage.getItem(`sw.editor.gridStep.${t}`));return{on:localStorage.getItem(`sw.editor.grid.${t}`)==="1",stepM:Ue.includes(e)?e:Rt}}catch{return{on:!1,stepM:Rt}}},Fe=(t,e)=>{try{localStorage.setItem(t,JSON.stringify(e.slice(0,40)))}catch{}},W=t=>Math.round(t*1e3)/1e3,N=10,jt=14,wr=6,Nt=(t,e)=>`${I(t,"קיר אחד","קירות")}, ${I(e,"פתח אחד","פתחים")}`,Re=[{id:"cameras",label:"מצלמות"},{id:"doors",label:"דלתות ומנעולים"},{id:"lights",label:"תאורה ומתגים"},{id:"sensors",label:"חיישנים"}],br={asset:"קובץ",page:"עמוד",rotation:"סיבוב",crop:"חיתוך",width_px:"רוחב",height_px:"גובה"},K=t=>t?vs(new Date(t)):"";let f=class extends Ze{constructor(){super(...arguments),this.floorId="",this.presetEntity="",this.presetCandidates="",this.presetZone="",this.bundle=null,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.panMode=!1,this.shortcutsOpen=!1,this.layers=new Set(["cameras","doors","lights","sensors"]),this.planImage=!0,this.grid={on:!1,stepM:Rt},this.guides=[],this.placing=null,this.entQ="",this.entResults=null,this.entBusy=!1,this.lightsAll=!1,this.busy=!1,this.error="",this.info="",this.pkgImport=null,this.stylizing=!1,this.stylized=null,this.stylizeOpts={strength:"medium",keepLines:!1,roomFill:"white"},this.zones=[],this.versions=[],this.geomVersions=[],this.areas=[],this.floorImages=null,this.alignDraft=null,this.alignShowPlan=!0,this.imageBusy=!1,this.imageNote="",this.diff=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.lastEdit=null,this.candidates=null,this.detecting=!1,this.detectStrength="medium",this.replaceAuto=!0,this.drawing=null,this.showZones=!0,this.zoneBusy=!1,this.studio=new cr(this),this.studioVersion=null,this.studioMode="wall",this.curveDraft=null,this.curveRedo=[],this.glassDraw={...lo},this.doorGhost=null,this.doorAsking=!1,this.doorToken=0,this.wallDefaults={thickness_m:.2,kind:"interior"},this.geomSel=null,this.multi=[],this.zonePreview=null,this.zoneSaving=!1,this.multiNote="",this.multiCache=null,this.geomPreview=null,this.nudgeBurst=null,this.library=null,this.libLookup=null,this.libQ="",this.libCategory=null,this.libRecent=Ne("sw.studio.recent"),this.libFav=Ne("sw.studio.fav"),this.placingItem=null,this.bindOffer=null,this.dupId=null,this.bindRefused=new Set,this.phone=window.matchMedia("(max-width: 767px)"),this.arrayDialog=null,this.groupDelete=null,this.customDialog=null,this.levelFilter=null,this.levelDialog=null,this.matStyle=os(),this.walkArmed=null,this.walkFocus=null,this.site={...Te,known:!1},this.matMemo=null,this.connMode=null,this.connStart=null,this.linkTargets=[],this.sharedLevels=!0,this.shareDlg=null,this.linkTargetsFor=null,this.stairShape="straight",this.twinDelete=null,this.linkConfirm=null,this.linkBusy=!1,this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,this.circuitTimer=0,this.wallDraft=null,this.lastDrawClick=null,this.hover=null,this.calib={...B},this.measurePts=[],this.geomDiff=null,this.showEstimates=!0,this.camSuggestCfg=Kt,this.camSuggestions=null,this.zoneCamera=null,this.zoneCameraFor=null,this.detectOpts={walls:!0,openings:!0,strength:.6,replaceAuto:!0,hollow:!0},this.detectRun={busy:!1,startedAt:0,elapsed:0,error:"",timedOut:!1,limitS:null},this.detectToken=0,this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.candStatesShown=null,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null,this.narrow=!1,this.onNarrow=()=>this.narrow=this.phone.matches,this.entTimer=0,this.onKey=t=>this.handleKey(t),this.anchorPosCache=null,this.guideCache=null}connectedCallback(){super.connectedCallback(),this.studio.onNotice=t=>{this.info=t,setTimeout(()=>this.info="",7e3)},this.load(),window.addEventListener("keydown",this.onKey),this.narrow=this.phone.matches,this.phone.addEventListener("change",this.onNarrow),this.presetEntity&&(this.tool="entity",this.entQ=this.presetEntity,this.searchEntities())}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.phone.removeEventListener("change",this.onNarrow),clearInterval(this.elapsedTimer),this.studio.flush()}async realign(t){if(!(!this.bundle||this.busy)){this.busy=!0;try{const e=await ns(this.bundle.floorId,t);this.error=e.moved||!e.skipped?"":`${e.skipped} פריטים לא ניתנים ליישור אוטומטי (שרטוט אחר) — בדוק אותם ולחץ "אשר מיקומים".`,await this.load()}catch(e){this.error=$(e)}finally{this.busy=!1}}}async load(){this.error="";try{const t=await rs(this.floorId||"f0",!0),e=!this.bundle||this.bundle.floorId!==t.floorId;if(e){this.levelFilter=null,this.linkTargets=[],this.linkTargetsFor=null;try{this.planImage=localStorage.getItem(`sw.editor.background.${t.floorId}`)!=="0"}catch{this.planImage=!0}this.grid=vr(t.floorId)}this.bundle=t,this.loadStudio(t),this.loadLibraryFor(t),as().then(s=>{this.sharedLevels=s["map.shared_levels"]!=="hide",this.camSuggestCfg=Ke({maxDistance:Number(s["plan.camsuggest_distance"])/100,fovWeight:Number(s["plan.camsuggest_fov"])/100,maxSuggestions:Number(s["plan.camsuggest_count"])}),this.showEstimates=s["plan.estimates"]!=="false";const i=Number(s["site.latitude"]),o=Number(s["site.longitude"]),n=s["site.latitude"]!==null&&s["site.latitude"]!==void 0&&Number.isFinite(i)&&Number.isFinite(o);this.site=n?{latitude:i,longitude:o,known:n}:{...Te,known:!1},e&&this.bundle===t&&(this.levelFilter=js(s["plan.levels"],t))}).catch(()=>{}),this.anchors=t.anchors.filter(s=>s.resource_type!=="camera"||kt("nvr")).map(s=>({...s,position:{...s.position}})),this.zones=t.zones,this.loadVersions(),this.selectedZoneId&&!this.zones.some(s=>s.id===this.selectedZoneId)&&(this.selectedZoneId=null),this.presetZone&&this.zones.some(s=>s.id===this.presetZone)&&(this.selectedZoneId=this.presetZone,this.selectedId=null),this.presetZone="",this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(s=>s.id===this.selectedId)&&(this.selectedId=null)}catch(t){this.error=$(t)}}get selected(){return this.anchors.find(t=>t.id===this.selectedId)}layerOf(t){return t.resource_type==="camera"?"cameras":t.layer_id==="doors"?"doors":t.layer_id==="lights"?"lights":"sensors"}get markers(){return this.anchors.filter(t=>this.layers.has(this.layerOf(t))&&this.onLevel(t)).map(t=>({id:t.id,kind:t.resource_type==="camera"?"camera":ds(t.layer_id,t.entity?.domain),label:this.anchorName(t),x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,radius:t.coverage_radius??void 0,polygon:t.coverage_polygon?t.coverage_polygon.map(([e,s])=>({x:e,y:s})):void 0,labelPos:t.label_pos??void 0,level:t.level_id??null,state:t.resource_type==="camera"?this.bundle?.source==="demo"?"live":ls(t):"neutral"}))}anchorName(t){return t.resource_type==="camera"?t.camera?.name??t.label??t.resource_id:t.label??t.entity?.name??t.resource_id}get selectedZone(){return this.zones.find(t=>t.id===this.selectedZoneId)}get planZones(){if(!this.showZones)return[];const t=this.zonePreview,e=this.zones.map(i=>({id:i.id,name:i.name,kind:i.kind,color:i.color,polygon:t?.[i.id]??i.polygon,labelPos:i.label_pos,chip:xt(i.shared)})),s=(this.candidates??[]).map((i,o)=>({id:`cand-${o}`,name:i.include?i.name:"",color:i.include?mt[o%mt.length]:"#9AA3B5",polygon:i.polygon,candidate:!0}));return[...e,...s]}async detect(){const t=this.bundle;if(t){if(t.source==="demo"){this.info="נתוני הדגמה: הזיהוי עובד מול השרת.";return}this.detecting=!0,this.error="";try{const e=await Wi(t.floorId,this.detectStrength);this.candidates=e.rooms.map((s,i)=>({polygon:s.polygon,name:`חדר ${i+1}`,kind:"room",include:!0})),this.selectedZoneId=null,this.selectedId=null,this.info=e.rooms.length?`${e.rooms.length} חדרים זוהו · תן שמות ושמור`:"לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית",setTimeout(()=>this.info="",5e3)}catch(e){this.error=$(e)}finally{this.detecting=!1}}}setCandidate(t,e){this.candidates&&(this.candidates=this.candidates.map((s,i)=>i===t?{...s,...e}:s))}async acceptCandidates(){const t=this.bundle,e=(this.candidates??[]).filter(s=>s.include);if(!(!t||!e.length)){this.zoneBusy=!0,this.error="";try{const s=await $e(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name,kind:i.kind})),this.replaceAuto);this.candidates=null,this.zones=s.zones,this.info=`${s.created.length} חדרים נשמרו`,setTimeout(()=>this.info="",3e3)}catch(s){this.error=$(s)}finally{this.zoneBusy=!1}}}startDrawing(){this.drawing=[],this.placing=null,this.candidates=null,this.selectedZoneId=null,this.selectedId=null}addDraftPoint(t,e){const s=this.drawing,i=this.bundle;if(!(!s||!i)){if(s.length>=3){const o=this.canvas?.zoom??1;if(Math.hypot((t-s[0].x)*i.width*o,(e-s[0].y)*i.height*o)<12){this.finishDrawing();return}}this.drawing=[...s,{x:+t.toFixed(4),y:+e.toFixed(4)}]}}async finishDrawing(){const t=this.drawing,e=this.bundle;if(!(!t||!e||t.length<3)){if(e.source==="demo"){this.info="נתוני הדגמה: השמירה עובדת מול השרת.",this.drawing=null;return}this.zoneBusy=!0,this.error="";try{const s=await Ki(e.floorId,{name:`אזור ${this.zones.length+1}`,kind:"zone",polygon:t});this.drawing=null,this.zones=[...this.zones,s],this.selectedZoneId=s.id,this.info="האזור נוצר · תן לו שם",setTimeout(()=>this.info="",3e3)}catch(s){this.error=$(s)}finally{this.zoneBusy=!1}}}async patchZone(t,e){if(this.bundle?.source!=="demo"){this.zoneBusy=!0,this.error="";try{const s=await this.sendZonePatch(t,e);s==="conflict"?(this.error="האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס.",await this.load()):s!=="ok"&&(this.error=s)}finally{this.zoneBusy=!1}}}async sendZonePatch(t,e){try{const s=t.shared?.role==="mirror",i=await Hi(t.id,{revision:t.revision,...e},AbortSignal.timeout(Le),s?this.bundle?.floorId:void 0);return this.zones=this.zones.map(o=>o.id===i.id?s?{...i,polygon:e.polygon??o.polygon,level_id:o.level_id,shared:o.shared,floor_id:o.floor_id}:{...i,shared:o.shared}:o),"ok"}catch(s){return s instanceof P&&s.status===409?"conflict":je(s)}}async removeZone(t){if(this.bundle?.source==="demo")return;if(t.shared?.role==="mirror")return this.unshare(t,this.bundle.floorId);const e=t.shared?.role==="home",s=(t.shared?.floors??[]).map(i=>D(i.name)).join(", ");if(window.confirm(e?`למחוק את "${t.name}"?
החדר משותף עם ${s}. המחיקה תבטל את השיתוף, תסיר את חברי החלל ותמחק את האזור. המצלמות והישויות לא נמחקות.`:`למחוק את "${t.name}"? המצלמות והישויות בקומה לא מושפעות.`)){this.zoneBusy=!0,this.error="";try{const i=await this.sendZoneDelete(t,e);i!=="ok"?this.error=i:e&&await this.reloadShared()}finally{this.zoneBusy=!1}}}async sendZoneDelete(t,e=!1){try{return await qi(t.id,AbortSignal.timeout(Le),e),this.zones=this.zones.filter(s=>s.id!==t.id),this.selectedZoneId===t.id&&(this.selectedZoneId=null),"ok"}catch(s){return je(s)}}async unshare(t,e){const s=t.shared?.role==="mirror"?t.shared.home_floor_name:t.shared?.floors?.find(i=>i.floor_id===e)?.name??"";if(window.confirm(`לבטל את השיתוף של "${t.name}"? התוכן של החדר יישאר רק ב${t.shared?.role==="mirror"?s:"קומה הזו"}${t.shared?.role==="mirror"?" ולא יוצג כאן":` ולא יוצג ב${s}`}, והמצלמות וההתקנים שלו יפסיקו להיות משותפים. מה שהוסר בזמן השיתוף (התוכן הכפול) לא יחזור.`)){this.zoneBusy=!0,this.error="";try{await Ji(t.id,e),this.selectedZoneId=null,await this.reloadShared()}catch(i){this.error=$(i)}finally{this.zoneBusy=!1}}}async gotoHomeFloor(t){const e=t.shared;!e||e.role!=="mirror"||!e.home_floor_id||this.dirty.size&&!await this.save()||await this.studio.flush()&&J(`/explore/floors/${e.home_floor_id}/edit`,{zone:e.zone_id})}async setShareMember(t,e,s){if(!(this.dirty.size&&!await this.save())){this.zoneBusy=!0,this.error="";try{s?await Yi(e,t.resource_type,t.resource_id):await Xi(e,t.resource_type,t.resource_id),this.info=s?"נוסף לחלל המשותף: מוצג בשתי הקומות":"הוסר מהחלל המשותף: מוצג רק בקומה שלו",setTimeout(()=>this.info="",4e3),await this.reloadShared()}catch(i){this.error=$(i)}finally{this.zoneBusy=!1}}}async reloadShared(){await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0)}async openShare(t){const e=this.bundle;if(!(!e||!e.planVersionId||e.source==="demo")){this.shareDlg={zone:t,floors:[],floorId:"",homeHere:!0,otherZones:[],otherZoneId:"",duplicateId:null,preview:null,busy:!0,error:""};try{const s=e.floorLevel??0,i=[...(await Ie(e.planVersionId)).floors].sort((o,n)=>Math.abs(o.level-s)-Math.abs(n.level-s)||o.level-n.level);this.shareDlg={...this.shareDlg,floors:i,busy:!1},i.length&&await this.pickShareFloor(i[0].floor_id)}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:$(s)}}}}async pickShareFloor(t){const e=this.shareDlg,s=this.bundle;if(!e||!s)return;const i=e.floors.find(r=>r.floor_id===t),o=s.floorLevel??0,n=i?o<=i.level:!0;this.shareDlg={...e,floorId:t,homeHere:n,preview:null,duplicateId:null,error:"",busy:!0};try{const r=(await Qi(t)).zones.filter(d=>!d.shared),a=r.find(d=>d.name.trim()===e.zone.name.trim())??null;this.shareDlg={...this.shareDlg,otherZones:r,otherZoneId:a?.id??r[0]?.id??"",duplicateId:a?.id??null,busy:!1},await this.previewShareNow()}catch(r){this.shareDlg={...this.shareDlg,busy:!1,error:$(r)}}}shareRequest(){const t=this.shareDlg,e=this.bundle;return!t||!e||!t.floorId?null:t.homeHere?{zoneId:t.zone.id,body:{floor_id:t.floorId,duplicate_zone_id:t.duplicateId,auto:t.duplicateId===null}}:t.otherZoneId?{zoneId:t.otherZoneId,body:{floor_id:e.floorId,duplicate_zone_id:t.zone.id,auto:!1}}:null}async previewShareNow(){const t=this.shareRequest();if(t){this.shareDlg={...this.shareDlg,busy:!0,error:""};try{const e=await to(t.zoneId,t.body);this.shareDlg={...this.shareDlg,preview:e,busy:!1}}catch(e){this.shareDlg={...this.shareDlg,preview:null,busy:!1,error:$(e)}}}}async applyShare(){const t=this.shareRequest(),e=this.shareDlg;if(!(!t||!e?.preview)){if(!await this.studio.flush()){this.shareDlg={...e,error:"שמור את טיוטת המבנה לפני השיתוף."};return}this.shareDlg={...e,busy:!0,error:""};try{const s=e.homeHere?{...t.body,duplicate_zone_id:e.preview.duplicate?.zone_id??null,auto:!1}:t.body;await eo(t.zoneId,s),this.shareDlg=null,this.selectedZoneId=null,this.info="החדר משותף עכשיו לשתי הקומות",setTimeout(()=>this.info="",4e3),await this.reloadShared()}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:$(s)}}}}renderShareDialog(){const t=this.shareDlg,e=this.bundle;if(!t||!e)return p;const s=t.floors.find(d=>d.floor_id===t.floorId),i=t.preview,o=(d,l,c)=>d?I(d,l,c):"",n=i?[o(i.remove.objects,"עצם אחד","עצמים"),o(i.remove.walls,"קיר פנימי אחד (ציור כפול של המגרש)","קירות פנימיים (ציור כפול של המגרש)"),o(i.remove.openings,"פתח אחד","פתחים"),o(i.remove.labels,"תווית אחת","תוויות"),o(i.remove.connectors,"מחבר אחד","מחברים")].filter(Boolean):[],r={member:"משותף - נשאר במקומו",drop_duplicate:"עותק כפול - יוסר",kept:"מוצב גם במקום אחר בקומה של החדר - נשאר, לא משותף"},a=i?i.other_floor.name:"";return h`<sw-dialog open heading="הפוך לחלל משותף" subheading=${t.zone.name} data-share-dialog @close=${()=>this.shareDlg=null}>
      <div class="note">חלל משותף הוא חדר אחד ששייך לשתי קומות (חלל בגובה כפול): כל קומה שומרת את המתאר והקירות שלה, התוכן נשמר פעם אחת, מוצג בשתי הקומות ואפשר לערוך אותו משתיהן.</div>
      ${t.floors.length?h`<sw-field label="הקומה השנייה"><select data-share-floor @change=${d=>this.pickShareFloor(d.target.value)}>${t.floors.map(d=>h`<option value=${d.floor_id} ?selected=${d.floor_id===t.floorId}>${D(d.name)}</option>`)}</select></sw-field>`:t.busy?p:h`<div class="err">אין בבניין קומה נוספת שמותר לך לערוך.</div>`}
      ${s?h`<sw-field label="איפה הרצפה של החדר" hint="ברירת המחדל: הקומה התחתונה (המגרש)"><select data-share-home @change=${d=>{this.shareDlg={...this.shareDlg,homeHere:d.target.value==="here",preview:null},this.previewShareNow()}}>
            <option value="here" ?selected=${t.homeHere}>${`בקומה הזו (${D(e.floorName)})`}</option>
            <option value="there" ?selected=${!t.homeHere}>${`ב${D(s.name)}`}</option>
          </select></sw-field>
          ${t.homeHere?h`<sw-field label=${`החדר הכפול ב${D(s.name)}`}><select data-share-duplicate @change=${d=>{const l=d.target.value;this.shareDlg={...this.shareDlg,duplicateId:l==="__auto"?null:l==="__none"?"":l},this.previewShareNow()}}>
                <option value="__auto" ?selected=${t.duplicateId===null}>${i?.duplicate?`זוהה אוטומטית: ${i.duplicate.name}`:"ללא - המתאר ייבנה מהחדר הזה"}</option>
                ${t.otherZones.map(d=>h`<option value=${d.id} ?selected=${t.duplicateId===d.id}>${d.name}</option>`)}
              </select></sw-field>`:h`<sw-field label=${`החדר ב${D(s.name)} שיישאר`}><select data-share-other-zone @change=${d=>{this.shareDlg={...this.shareDlg,otherZoneId:d.target.value},this.previewShareNow()}}>
                ${t.otherZones.map(d=>h`<option value=${d.id} ?selected=${t.otherZoneId===d.id}>${d.name}</option>`)}
              </select></sw-field>`}`:p}
      ${t.busy?h`<div class="note">מחשב…</div>`:p}
      ${i?h`<div class="share-preview" data-share-preview>
            <div class="kv"><span class="k">הרצפה</span><span>${D(`${i.zone.floor_name}`)} · "${i.zone.name}"</span></div>
            <div class="kv"><span class="k">המתאר ב${D(a)}</span><span data-share-outline>${i.outline.kept?`"${i.duplicate?.name??""}" נשאר - עם ${I(i.boundary_walls_kept.length,"הקיר שלאורכו","הקירות שלאורכו")}`:"ייבנה מהחדר הזה"}</span></div>
            <div class="kv"><span class="k">יוסר מ${D(a)}</span><span data-share-removed>${n.length?n.join(", "):"שום דבר"}</span></div>
            <div class="kv"><span class="k">מצלמות והתקנים</span><span data-share-anchors>${i.anchors.length?i.anchors.map(d=>h`<div>${d.name??d.resource_id} · ${r[d.action]??d.action}</div>`):"אין"}</span></div>
            ${i.aligned?p:h`<div class="err" data-share-alignment>ודא את יישור הקומות: המתאר של הקומה התחתונה לא נופל בתוך המתאר של העליונה.</div>`}
            <div class="note">${i.same_frame?"לשתי התוכניות אותה מסגרת: החדר יוצג באותו מקום.":"לתוכניות מסגרות שונות: החדר יותאם למקום של החדר הכפול לפי המטרים."} כל קומה שומרת את המתאר והקירות שלה; התוכן (טריבונות, סימוני מגרש, עצמים) נשמר בקומת הרצפה ומוצג בשתיהן. שינוי מהקומה השנייה מתפרסם עם פרסום של כל אחת מהן.</div>
          </div>`:p}
      ${t.error?h`<div class="err">${t.error}</div>`:p}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.shareDlg=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-share-apply ?disabled=${!i||t.busy} @click=${()=>this.applyShare()}>שתף את החדר</sw-button>
    </sw-dialog>`}renderZoneShare(t){const e=this.bundle;if(!e||e.source==="demo")return p;const s=t.shared;return s?.role==="mirror"?h`<div class="shared-box" data-zone-shared="mirror"><span class="chip">${xt(s)}</span>
        <div class="note" data-zone-created-on>האזור נוצר ב${D(s.home_floor_name)} — מחק אותו שם, או בטל שיתוף כאן</div>
        ${s.home_floor_name===Ns?p:h`<sw-button size="sm" variant="ghost" data-zone-goto-home ?disabled=${this.zoneBusy} @click=${()=>this.gotoHomeFloor(t)}>עבור ל${D(s.home_floor_name)}</sw-button>`}
        <div class="note">חלל משותף עם ${D(s.home_floor_name)}: המתאר והקירות כאן הם של הקומה הזו; התוכן (טריבונות, סימונים, עצמים) נשמר שם ומוצג בשתי הקומות, ועריכה שלו כאן מופיעה בשתיהן.</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?h`<sw-button size="sm" variant="ghost" data-zone-unshare ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,e.floorId)}>בטל שיתוף</sw-button>`:p}</div>`:s?.role==="home"?h`<div class="shared-box" data-zone-shared="home"><span class="chip">${xt(s)}</span>
        <div class="note">משותף עם ${(s.floors??[]).map(i=>D(i.name)).join(", ")}: התוכן של החדר מוצג גם שם.</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?(s.floors??[]).map(i=>h`<sw-button size="sm" variant="ghost" data-zone-unshare=${i.floor_id} ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,i.floor_id)}>בטל שיתוף עם ${D(i.name)}</sw-button>`):p}</div>`:e.permissions.structure?h`<div class="btns"><sw-button size="sm" icon="floor" data-zone-share ?disabled=${this.zoneBusy} title="חדר ששייך לשתי קומות - חלל בגובה כפול" @click=${()=>this.openShare(t)}>הפוך לחלל משותף</sw-button></div>`:p}renderSharedHint(){const t=this.studio.doc,e=this.selected;let s="";if(e?.shared)s=`חלל משותף · השינוי יופיע גם ב${D(e.shared.home_floor_name)}`;else if(e&&t)s=re(t,null,[e.position.x,e.position.y]);else if(this.geomSel&&t){const l=ae(t,this.geomSel.id);s=l?re(t,l,Fs(l)):""}const i=!!this.bundle?.permissions.structure,o=e?.resource_type==="camera",n=e?e.room_candidate?h`<div class="shared-hint" data-share-candidate><sw-icon name="floor" size=${14}></sw-icon>${o?"מצלמה בתוך החלל המשותף שאינה חברה בו - הוסף?":"התקן בתוך החלל המשותף שאינו חבר בו - הוסף?"}
          ${i?h`<sw-button size="sm" variant="ghost" data-share-member-add ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.room_candidate,!0)}>הוסף לחלל המשותף</sw-button>`:p}</div>`:(e.shared_member||e.shared)&&i?h`<div class="btns"><sw-button size="sm" variant="ghost" data-share-member-remove ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.shared_member??e.shared.zone_id,!1)}>הסר מהחלל המשותף</sw-button></div>`:p:p,r=this.geomSel&&t?ae(t,this.geomSel.id):null,a=r&&(this.geomSel?.kind==="object"||this.geomSel?.kind==="label")?Rs(t,r):null,d=a&&r?h`<label class="shared-hint" data-shared-content-toggle><input type="checkbox" .checked=${r.shared_space_id===a} ?disabled=${!this.bundle?.permissions.structure}
          @change=${l=>this.setSharedContent(r.id,l.target.checked?a:null)} /> חלק מהחלל המשותף (מוצג גם בקומה השנייה)</label>`:p;return h`${s?h`<div class="shared-hint" data-shared-hint><sw-icon name="floor" size=${14}></sw-icon>${s}</div>`:p}${n}${d}`}setSharedContent(t,e){const s=this.studio.doc;if(!s)return;const i=o=>o.map(n=>{if(n.id!==t)return n;const{shared_space_id:r,...a}=n;return e?{...a,shared_space_id:e}:a});this.studio.commit({...s,objects:i(s.objects),labels:i(s.labels)})}snapshot(){this.undo=[...this.undo.slice(-40),this.anchors.map(t=>({...t,position:{...t.position}}))],this.redo=[]}apply(t,e){this.snapshot(),this.lastEdit="pins",this.anchors=this.anchors.map(s=>s.id===t?{...s,...e,position:e.position??s.position}:s),this.dirty=new Set(this.dirty).add(t)}nudge(t,e){const s=this.selected;s&&this.apply(s.id,{position:{x:+Math.min(1,Math.max(0,s.position.x+t)).toFixed(4),y:+Math.min(1,Math.max(0,s.position.y+e)).toFixed(4)}})}doUndo(){const t=this.undo[this.undo.length-1];t&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}doRedo(){const t=this.redo[this.redo.length-1];t&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}handleKey(t){const e=t.composedPath()[0],s=e&&(e.tagName==="INPUT"||e.tagName==="TEXTAREA"||e.tagName==="SELECT"||e.isContentEditable);if(t.key==="Escape"){if(this.shortcutsOpen){this.shortcutsOpen=!1;return}if(this.doorGhost||this.doorAsking){this.dropDoorGhost();return}if(this.pkgImport){this.pkgImport.busy!=="import"&&(this.pkgImport=null);return}if(this.arrayDialog||this.groupDelete||this.customDialog){this.arrayDialog=null,this.groupDelete=null,this.customDialog=null;return}if(this.connStart){this.connStart=null;return}if(this.tool==="circuits"&&this.circuitPlacing){this.circuitPlacing=null;return}if(this.tool==="circuits"&&this.membersMode){this.membersMode=!1;return}if(this.tool==="detect"){this.detectAsk?this.detectAsk=null:this.pickTool("select");return}this.placingItem?this.placingItem=null:this.bindOffer?this.bindOffer=null:this.wallDraft?(this.wallDraft=null,this.hover=null):this.curveDraft?(this.curveDraft=null,this.curveRedo=[],this.hover=null):this.tool==="measure"&&this.measurePts.length?this.measurePts=[]:this.tool==="calibrate"&&this.calib.a?this.calib={...B}:this.tool==="walk"&&this.walkArmed?this.walkArmed=null:this.drawing?this.drawing=null:this.placing?this.placing=null:this.candidates?this.candidates=null:this.panMode?this.panMode=!1:(this.selectedId=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[]);return}if(s||this.arrayDialog||this.groupDelete||this.customDialog||this.shortcutsOpen||this.pkgImport||this.panMode||this.multiOn&&this.handleMultiKey(t))return;if(t.code==="KeyD"&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.startMarkDoor();return}const i={KeyC:"curve",KeyR:"curved",KeyG:"glass"};if(i[t.code]&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.wallDraft&&this.wallDraft.length>=2&&this.finishWall(),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.tool!=="structure"&&this.pickTool("structure"),this.studioMode=i[t.code],this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null;return}if((this.studioOn||this.selectGeomOn)&&this.handleStudioKey(t))return;if(t.key==="Enter"&&this.drawing){t.preventDefault(),this.finishDrawing();return}if((t.key==="Delete"||t.key==="Backspace")&&!this.selected&&this.selectedZone){t.preventDefault();const n=this.selectedZone,r=this.zoneVertexSel;if(r&&r.zoneId===n.id&&r.index<n.polygon.length){if(n.polygon.length<=3){this.info="לאזור נשארו שלוש פינות: אי אפשר להסיר עוד פינה",setTimeout(()=>this.info="",3e3);return}this.zoneVertexSel=null,this.patchZone(n,{polygon:n.polygon.filter((a,d)=>d!==r.index)});return}this.removeZone(n);return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="z"){t.preventDefault(),t.shiftKey?this.redoAny():this.undoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="y"){t.preventDefault(),this.redoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="s"){t.preventDefault(),this.save();return}if(!this.selected)return;const o=t.shiftKey?.01:.002;t.key==="ArrowLeft"?(t.preventDefault(),this.nudge(-o,0)):t.key==="ArrowRight"?(t.preventDefault(),this.nudge(o,0)):t.key==="ArrowUp"?(t.preventDefault(),this.nudge(0,-o)):t.key==="ArrowDown"?(t.preventDefault(),this.nudge(0,o)):(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.removeSelected())}async save(){if(!this.bundle||this.bundle.source==="demo")return this.info="נתוני הדגמה: השינויים נשמרים רק במסך זה.",this.dirty=new Set,!0;if(!this.dirty.size)return!0;this.busy=!0,this.error="";let t=!1;try{for(const e of this.dirty){const s=this.anchors.find(i=>i.id===e);if(s)try{const i=await hs(e,{revision:s.revision,x:s.position.x,y:s.position.y,rotation_degrees:s.rotation_degrees,field_of_view_degrees:s.field_of_view_degrees,label:s.label,coverage_radius:s.coverage_radius??null,coverage_polygon:s.coverage_polygon??null,label_pos:s.label_pos??"auto",level_id:s.level_id??"",mount_height_m:s.mount_height_m??null,tilt_deg:s.tilt_deg??null},s.shared?this.bundle.floorId:void 0);this.anchors=this.anchors.map(o=>o.id===e?{...o,revision:i.revision}:o)}catch(i){if(i instanceof P&&i.code==="stale_revision")t=!0;else throw i}}return t?(this.error="חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.",await this.load(),!1):(this.dirty=new Set,this.info="המיקומים נשמרו",setTimeout(()=>this.info="",2500),!0)}catch(e){return this.error=$(e),!1}finally{this.busy=!1}}async place(t,e){const s=this.placing;if(!s||!this.bundle)return;if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.",this.placing=null;return}if(this.dirty.size&&!await this.save())return;this.busy=!0,this.error="";const i=this.activeLevel?{level_id:this.activeLevel}:{};try{const o=s.kind==="camera"?await Qt(this.bundle.floorId,{resource_type:"camera",resource_id:s.camera.id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:90,...i}):await Qt(this.bundle.floorId,{resource_type:"ha_entity",resource_id:s.entity.entity_id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:null,...i});this.placing=null,await this.load(),this.selectedId=o.id,this.tool="select",this.info=`${this.anchorName(o)} הוצב · גרור לדיוק, קבע כיוון בידיות`,setTimeout(()=>this.info="",4e3)}catch(o){this.error=$(o)}finally{this.busy=!1}}async removeSelected(){const t=this.selected;if(!(!t||!this.bundle)){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הסרה עובדת מול השרת.";return}if(window.confirm(`להסיר את "${this.anchorName(t)}" מהמפה? המקור עצמו לא נמחק.`)){this.busy=!0,this.error="";try{await cs(t.id,t.shared?this.bundle.floorId:void 0),this.selectedId=null,await this.load()}catch(e){this.error=$(e)}finally{this.busy=!1}}}}async loadVersions(){const t=this.bundle;if(!t||t.source==="demo"||!t.permissions.edit){this.versions=[],this.geomVersions=[];return}this.loadSideData(t);try{this.versions=(await us(t.floorId)).versions}catch{this.versions=[]}}async publish(){const t=this.bundle;if(!t?.planVersionId||this.dirty.size&&!await this.save())return;if(!await this.studio.flush()){this.error=this.studio.error;return}if(this.error="",t.planStatus==="published"){await this.openGeomDiff(t.planVersionId);return}let e=this.versions.find(s=>s.id===t.planVersionId);if(e||(await this.loadVersions(),e=this.versions.find(s=>s.id===t.planVersionId)),!e){this.error="לא נמצאה טיוטה לפרסום — טען מחדש";return}await this.openDiff("publish",e)}async openGeomDiff(t){this.geomDiff={versionId:t,data:null,error:"",skip:[]};try{const e=await Wo(t);this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:e,error:"",skip:[]})}catch(e){this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:null,error:$(e),skip:[]})}}async confirmGeomPublish(){const t=this.bundle,e=this.geomDiff;if(!(!t||!e?.data)){this.busy=!0;try{const s=await Ko(e.versionId,e.skip);this.geomDiff=null;const i=(s.shared_published??[]).length>0;this.info=s.unchanged&&!i?"אין שינוי לפרסום":i?"המבנה פורסם, כולל השינויים בחלל המשותף; הצופים רואים אותם עכשיו":"המבנה פורסם; הצופים רואים אותו עכשיו",setTimeout(()=>this.info="",4e3),await this.loadStudio(t,!0)}catch(s){this.geomDiff={...e,error:$(s)}}finally{this.busy=!1}}}async openDiff(t,e){this.diff={mode:t,version:e,data:null,error:""};try{const s=await ps(e.id);this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:s,error:""})}catch(s){this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:null,error:$(s)})}}async confirmDiff(){const t=this.diff;if(!t?.data||t.mode==="compare")return;const e=t.version.id===this.bundle?.planVersionId;this.busy=!0,this.error="";try{if(e&&!await this.studio.flush()){this.diff={...t,error:this.studio.error};return}t.mode==="publish"?(await fs(t.version.id),this.info="הגרסה פורסמה; הצופים רואים אותה עכשיו"):(await gs(t.version.id,t.version.revision,t.data.from?.id??null),this.info="הגרסה שוחזרה ופורסמה מחדש; העוגנים נשמרו"),this.diff=null,await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0),setTimeout(()=>this.info="",4e3)}catch(s){this.diff={...t,error:$(s)},s instanceof P&&s.status===409&&this.loadVersions(),e&&s instanceof P&&s.code==="geometry_invalid"&&(this.pickTool("structure"),this.studioMode="select")}finally{this.busy=!1}}async searchEntities(){if(this.bundle?.source!=="demo"){this.entBusy=!0;try{const t=this.tool==="lights",e=await te({q:this.entQ||void 0,domain:t&&!this.lightsAll?"switch":void 0,limit:t?200:40});this.entResults=t?e.entities.filter(s=>s.domain==="switch"||this.lightsAll&&s.domain==="light").slice(0,60):e.entities}catch(t){this.error=$(t),this.entResults=[]}finally{this.entBusy=!1}}}onEntQuery(t){this.entQ=t,window.clearTimeout(this.entTimer),this.entTimer=window.setTimeout(()=>void this.searchEntities(),250)}async stylize(t,e){if(!this.bundle?.planVersionId||this.bundle.source==="demo")return;const s=this.stylizeOpts;(t!==void 0||e!==void 0)&&(this.stylizeOpts={...s,strength:t??s.strength,keepLines:e??s.keepLines}),this.stylizing=!0,this.error="";try{this.stylized=await Nn(this.bundle.planVersionId,{strength:this.stylizeOpts.strength,keep_lines:this.stylizeOpts.keepLines,room_fill:this.stylizeOpts.roomFill})}catch(i){this.error=$(i)}finally{this.stylizing=!1}}async useRender(t){if(this.bundle?.planVersionId){this.busy=!0,this.error="";try{await Fn(this.bundle.planVersionId,t),this.stylized=null,await this.load(),this.info=t==="stylized"?"המפה מציגה עכשיו את שפת Arx":"המפה מציגה את תוכנית המקור",setTimeout(()=>this.info="",3e3)}catch(e){this.error=$(e)}finally{this.busy=!1}}}get detectBusy(){return this.detectRun.busy||this.tool==="detect"&&this.busy}setPlanImage(t,e){this.planImage=e;try{localStorage.setItem(`sw.editor.background.${t}`,e?"1":"0")}catch{}}setGrid(t,e){this.grid={...this.grid,...e};try{localStorage.setItem(`sw.editor.grid.${t}`,this.grid.on?"1":"0"),localStorage.setItem(`sw.editor.gridStep.${t}`,String(this.grid.stepM))}catch{}}gridPx(t){return this.grid.on?Zs(this.grid.stepM,x(t).scale):0}gridPoint(t){const e=this.bundle,s=this.studio.doc;return e&&s?Bs(t,this.gridPx(s),e.width,e.height):t}get anchorPositions(){const t=this.anchorPosCache;if(t&&t.anchors===this.anchors)return t.positions;const e=Object.fromEntries(this.anchors.map(s=>[`${s.resource_type}:${s.resource_id}`,{x:s.position.x,y:s.position.y,rotation:s.rotation_degrees}]));return this.anchorPosCache={anchors:this.anchors,positions:e},e}alignTargets(t,e){const s=this.bundle,i=[t,e,this.activeLevel,this.anchorPositions,s?.width,s?.height],o=this.guideCache;if(o&&o.key.length===i.length&&o.key.every((u,v)=>u===i[v]))return o.targets;const n=this.activeLevel,r=T(t),{scale:a}=x(t),d=Gs(t,this.anchorPositions),l=s?d.objects.filter(u=>u.id!==e&&(n===null||(u.level_id||r)===n)).map(u=>Vs(u,s.width,s.height,a)):[],c=Us(l);return this.guideCache={key:i,targets:c},c}pickTool(t){this.detectBusy&&t!==this.tool||(this.dropDoorGhost(),this.tool=t,this.placing=null,this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,this.geomPreview=null,this.placingItem=null,this.bindOffer=null,this.connMode=null,this.connStart=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,t==="connectors"&&this.loadLinkTargets(),t==="structure"&&this.phone.matches&&(xe.includes(this.studioMode)||this.studioMode==="curve")&&(this.studioMode="select"),t!=="structure"&&(this.geomSel=null),this.multi=[],this.zoneSaving||(this.zonePreview=null),Lt.includes(t)&&(this.selectedZoneId=null,this.zoneVertexSel=null),t!=="measure"&&(this.measurePts=[]),t!=="calibrate"&&(this.calib={...B}),t!=="walk"&&(this.walkArmed=null,this.walkFocus=null),t!=="detect"&&(this.candSel=null,this.detectAsk=null),(t==="entity"||t==="lights")&&(this.entResults=null,this.searchEntities()))}async loadStudio(t,e=!1){if(t.source!=="api"||!t.planVersionId||!t.permissions.structure||!e&&this.studioVersion===t.planVersionId)return!1;this.studioVersion=t.planVersionId;try{return!await this.studio.flush()&&!(e&&this.studio.hasConflict)?(this.studioVersion=null,this.error=this.studio.error,!1):(await this.studio.load(t.planVersionId),this.geomSel=null,this.multi=[],this.geomPreview=null,this.wallDraft=null,this.calib={...B},this.measurePts=[],this.cands&&this.cands.result.version_id!==t.planVersionId&&this.discardCandidates(),this.presetCandidates==="dxf"&&this.takeDxf(t.planVersionId),!0)}catch(s){return this.studioVersion=null,this.error=$(s),!1}}async loadLibraryFor(t){if(t.source==="api")try{const e=await gn(t.catalogRevision);this.library=e,this.libLookup=mn(e)}catch(e){this.error=$(e)}}placeOpts(t){const e=this.activeLevel??T(t);return{levelId:e,ceilingM:t.levels.find(s=>s.id===e)?.ceiling_height_m??2.8}}get activeLevel(){const t=this.levelFilter;return t&&this.studio.doc?.levels.some(e=>e.id===t)?t:null}shownWalls(t){const e=this.activeLevel;return e?t.walls.filter(s=>s.level_id===e):t.walls}setLevelFilter(t){this.levelFilter=t;const e=this.studio.doc;if(this.geomSel&&e&&!le(e,this.geomSel.id,t)&&(this.geomSel=null),this.multi.length&&e){const s=new Set(_t(e,this.zones,t).map(i=>i.id));this.setSelection(this.multiItems.filter(i=>s.has(i.id)))}}followLevel(t,e){this.geomSel?.id===t&&this.activeLevel!==null&&this.activeLevel!==e&&(this.levelFilter=e)}openNewLevel(){this.levelDialog={id:null,name:"",elevation:-1.2,ceiling:3,isDefault:!1,makeDefault:!1,error:""}}openLevelEdit(t){const e=this.studio.doc?.levels.find(s=>s.id===t);e&&(this.levelDialog={id:t,name:e.name,elevation:e.elevation_m,ceiling:e.ceiling_height_m,isDefault:e.is_default,makeDefault:!1,error:""})}submitLevel(){const t=this.studio.doc,e=this.levelDialog;!t||!e||(e.id===null?this.createLevel(t,e):this.saveLevel(t,e.id,e))}createLevel(t,e){if(t.levels.some(i=>i.elevation_m===e.elevation)){this.levelDialog={...e,error:"כבר יש מפלס בגובה הזה"};return}const s=Ws(t,e.name,e.elevation,e.ceiling);this.studio.commit(s.doc),this.lastEdit="structure",this.levelDialog=null,this.setLevelFilter(s.id),this.info=`המפלס "${e.name}" נוסף; פריטים חדשים יוצבו בו`,setTimeout(()=>this.info="",4e3)}saveLevel(t,e,s){const i=t.levels.find(r=>r.id===e);if(!i){this.levelDialog=null;return}const o=r=>Math.round(r*1e3)/1e3,n={name:s.name.trim(),elevation_m:o(s.elevation),ceiling_height_m:o(s.ceiling),...s.makeDefault&&!i.is_default?{is_default:!0}:{}};if(t.levels.some(r=>r.id!==e&&r.elevation_m===n.elevation_m)){this.levelDialog={...s,error:"כבר יש מפלס בגובה הזה"};return}this.levelDialog=null,!(n.name===i.name&&n.elevation_m===i.elevation_m&&n.ceiling_height_m===i.ceiling_height_m&&!n.is_default)&&(this.studio.commit(Ks(t,e,n)),this.lastEdit="structure",this.info=n.is_default?`המפלס "${n.name}" עודכן והוא המפלס הראשי עכשיו`:`המפלס "${n.name}" עודכן`,setTimeout(()=>this.info="",4e3))}deleteLevel(){const t=this.studio.doc,e=this.levelDialog;if(!t||!e?.id)return;const s=t.levels.find(o=>o.id===e.id);if(!s){this.levelDialog=null;return}const i=Hs(t,s.id);if(!i){const o=qs(t,s.id),n=[...s.is_default?["זה המפלס הראשי - הפוך מפלס אחר לראשי קודם"]:[],...o>0?[`יש בו עוד ${I(o,"פריט אחד","פריטים")} (קירות, תוויות, עצמים או מחברים) - העבר או מחק אותם קודם`]:[]];this.levelDialog={...e,error:`אי אפשר למחוק את המפלס: ${n.join("; ")}.`};return}this.studio.commit(i),this.lastEdit="structure",this.levelDialog=null,this.levelFilter===s.id&&this.setLevelFilter(null),this.info=`המפלס "${s.name}" נמחק (ביטול: Ctrl+Z)`,setTimeout(()=>this.info="",4e3)}async loadLinkTargets(t=!1){const e=this.bundle;if(!(!e||e.source!=="api"||!e.planVersionId)&&!(!t&&this.linkTargetsFor===e.planVersionId)){this.linkTargetsFor=e.planVersionId;try{this.linkTargets=(await Ie(e.planVersionId)).floors}catch{this.linkTargetsFor=null}}}async linkTo(t,e,s,i=!1){const o=this.bundle;if(o?.planVersionId){this.linkBusy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const n=await Ho(o.planVersionId,t,e,s,i);await this.loadStudio(o,!0),this.geomSel={id:t,kind:"connector"};const r=this.linkTargets.find(d=>d.floor_id===n.target.floor_id),a=`${r?.name??"הקומה השנייה"} · ${r?.levels.find(d=>d.id===n.target.level_id)?.name??""}`;this.info=n.target.placement==="centred"?`המדרגות קושרו אל ${a}. לשתי הקומות אין מסגרת משותפת, לכן בקומה השנייה הן נוצרו במרכז התוכנית: מקם את המדרגות בקומה השנייה.`:n.target.placement==="aligned"&&n.target.frame==="size"?`המחבר קושר אל ${a}; בקומה השנייה הוא הונח באותו מקום בתוכנית (לשתי התוכניות אותן מידות): ודא את המיקום בקומה השנייה.`:`המחבר קושר אל ${a}; הוא מופיע בטיוטה של שתי הקומות באותו מזהה`,setTimeout(()=>this.info="",7e3)}catch(n){this.error=$(n)}finally{this.linkBusy=!1}}}setTarget(t,e){const s=this.studio.doc,i=s?.connectors.find(r=>r.id===t),o=Pe(e);if(!s||!i||!o)return;const n=Ot(s,i);if(n&&o.floorId!==n){this.linkConfirm={kind:o.floorId?"relink":"unlink",id:t,value:e,target:_e(s.levels,i)};return}this.applyTarget(t,e)}applyTarget(t,e,s=!1){const i=this.studio.doc,o=i?.connectors.find(a=>a.id===t),n=Pe(e);if(!i||!o||!n)return;if(n.floorId){this.linkTo(t,n.floorId,n.levelId,s);return}const r=Ot(i,o);this.edit(a=>ct(a,t,{level_to:n.levelId,floor_ids:[],far:null,origin_floor_id:void 0})),r&&this.dropTwin(t,r)}confirmLink(t){const e=this.linkConfirm;this.linkConfirm=null,t&&e&&this.applyTarget(e.id,e.value,e.kind==="relink")}async dropTwin(t,e){const s=this.bundle;if(s?.planVersionId)try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await qo(s.planVersionId,t,e);this.info=i.removed?"המחבר נמחק גם בקומה השנייה":"בקומה השנייה לא נמצא מחבר תאום",setTimeout(()=>this.info="",4e3)}catch(i){this.error=$(i)}}removeConnector(t){const e=this.studio.doc,s=e?.connectors.find(o=>o.id===t);if(!e||!s)return;const i=Ot(e,s);if(i){this.twinDelete={id:t,floorId:i,target:_e(e.levels,s),canBoth:this.linkTargets.some(o=>o.floor_id===i)};return}this.edit(o=>V(o,t)),this.geomSel=null}confirmTwinDelete(t){const e=this.twinDelete;this.twinDelete=null,e&&(this.edit(s=>V(s,e.id)),this.geomSel=null,t&&e.canBoth&&this.dropTwin(e.id,e.floorId))}connectorView(t){return{doc:t,saveState:this.studio.saveState,linkTargets:this.linkTargets,linkBusy:this.linkBusy,stairShape:this.stairShape,phone:this.phone.matches}}connectorActions(){const t=this.bundle,e=()=>this.studio.doc?x(this.studio.doc).scale:1;return{setMode:s=>{this.connMode=s,this.connStart=null,this.geomSel=null},select:s=>this.geomSel={id:s,kind:"connector"},patch:(s,i)=>this.edit(o=>ct(o,s,i)),remove:s=>this.removeConnector(s),setTarget:(s,i)=>this.setTarget(s,i),setStairShape:s=>{this.stairShape=s,this.connStart=null},patchStair:(s,i)=>{t&&this.edit(o=>{const n=o.connectors.find(r=>r.id===s);return n?ct(o,s,Xs(n,i,t.width,t.height,e())):o})},rotate:s=>{t&&this.edit(i=>Ys(i,s,90,t.width,t.height))},setFloorHeight:s=>this.edit(i=>({...i,floor_height_m:s})),confirmPlacement:s=>this.edit(i=>Js(i,s))}}renderConnectorTool(t){const e=this.studio.doc;return e?ho({...this.connectorView(e),mode:this.connMode,start:this.connStart,sel:this.geomSel?.kind==="connector"?e.connectors.find(s=>s.id===this.geomSel.id):void 0},this.connectorActions()):h`<sw-card heading="מפלסים ומחברים"><div class="note">${t.source==="demo"?"נתוני הדגמה: המחברים עובדים מול השרת.":this.error||"טוען…"}</div></sw-card>`}drawConnector(t,e,s,i){const o=this.bundle,n=this.placeOpts(t).levelId;if(e!=="stairs"||!o)return St(t,e,s,i,n,null);const r=x(t).scale,a=Math.hypot((i[0]-s[0])*o.width,(i[1]-s[1])*o.height)*r,d=Math.max(1,Math.min(Vi,Math.round(a/Ui)));if(this.stairShape==="straight"){const l=St(t,e,s,i,n,null);return{doc:ct(l.doc,l.id,{shape:"straight",turn:"none",flights:[{steps:d}],landing_depth_m:null}),id:l.id}}return de(t,{shape:this.stairShape,start:s,dir:[(i[0]-s[0])*o.width,(i[1]-s[1])*o.height],flights:[d,d],width_m:1.2,going_m:a/d,levelFrom:n,levelTo:null},o.width,o.height,r)}placeStairItem(t,e,s){const i=this.bundle,o=he[e];if(!i||!o)return;const n=x(t).scale,r=this.placeOpts(t).levelId,a=o.shape?de(t,{shape:o.shape,start:s,flights:o.flights,width_m:o.width_m,levelFrom:r,levelTo:null,kind:o.kind},i.width,i.height,n):St(t,o.kind,s,[s[0],Math.max(0,s[1]-o.width_m/n/i.height)],r,null);this.studio.commit(a.doc),this.lastEdit="structure",this.remember(e),this.pickTool("connectors"),this.geomSel={id:a.id,kind:"connector"},this.info='המדרגות הונחו כמחבר: בחר ב"מחבר אל" לאיזה מפלס או קומה הן מובילות',setTimeout(()=>this.info="",5e3)}async searchSwitches(t){try{const[e,s]=await Promise.all(["switch","light"].map(o=>te({domain:o,q:t||void 0,limit:40}))),i=[...e.entities,...s.entities].filter(o=>o.domain==="switch"||o.domain==="light").slice(0,40);this.circuitNew&&this.circuitNew.q===t&&(this.circuitNew={...this.circuitNew,results:i})}catch(e){this.error=$(e)}}willUpdate(){const t=this.studio.doc;this.zoneCameraFor!==this.selectedZoneId&&this.loadZoneCamera(this.selectedZoneId);const e=this.geomSel?this.studio.claimed.get(this.geomSel.id):void 0;e&&t&&!Qs(t).has(this.geomSel.id)&&(this.geomSel={...this.geomSel,id:e}),this.circuitSel&&t&&!t.circuits.some(s=>s.id===this.circuitSel)&&(this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null)}createCircuit(){const t=this.studio.doc,e=this.circuitNew;if(!t||!e?.entity)return;const s=ti(t,e.name,e.entity.entity_id,e.color);this.studio.commit(s.doc),this.lastEdit="structure",this.circuitNew=null,this.circuitSel=s.id,this.membersMode=!0,this.circuitPlacing=null,this.info="המעגל נוצר: לחץ על המנורות שלו",setTimeout(()=>this.info="",4e3)}renderCircuitTool(t){const e=this.studio.doc,s=this.library;return e?co({doc:e,sel:e.circuits.find(i=>i.id===this.circuitSel),membersMode:this.membersMode,power:i=>Ni(e,i,o=>s?L(s,o):void 0),creating:this.circuitNew,saveState:this.studio.saveState,colors:Mt,lamps:s?s.items.filter(i=>i.role==="light"):[],placing:this.circuitPlacing},{select:i=>{this.circuitSel=i,this.membersMode=!1,this.circuitPlacing=null},startNew:()=>{this.circuitNew={name:"",q:"",results:[],entity:null,color:Mt[e.circuits.length%Mt.length],busy:!1},this.searchSwitches("")},cancelNew:()=>this.circuitNew=null,setNew:i=>{this.circuitNew&&(this.circuitNew={...this.circuitNew,...i},i.q!==void 0&&(window.clearTimeout(this.circuitTimer),this.circuitTimer=window.setTimeout(()=>void this.searchSwitches(i.q??""),250)))},create:()=>this.createCircuit(),patch:(i,o)=>this.edit(n=>ji(n,i,o)),toggleMembers:()=>{this.membersMode=!this.membersMode,this.membersMode||(this.circuitPlacing=null)},remove:i=>{this.edit(o=>V(o,i)),this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null},armLamp:i=>{!this.membersMode||!this.circuitSel||(this.circuitPlacing=i)}}):h`<sw-card heading="מעגלי תאורה"><div class="note">${t.source==="demo"?"נתוני הדגמה: המעגלים עובדים מול השרת.":this.error||"טוען…"}</div></sw-card>`}onLevel(t){const e=this.studio.doc,s=this.activeLevel;return!s||!e?!0:ei(e,t.level_id,s)}remember(t){this.libRecent=[t,...this.libRecent.filter(e=>e!==t)].slice(0,12),Fe("sw.studio.recent",this.libRecent)}placeItem(t){const e=this.studio.doc,s=this.placingItem;if(!e||!s)return;if(he[s.id]){this.placeStairItem(e,s.id,this.gridPoint(t));return}const i=si(e,s,this.gridPoint(t),this.placeOpts(e));this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.id,kind:"object"},this.remember(s.id),this.offerBinding(i.id),this.phone.matches&&(this.placingItem=null)}placeCircuitLamp(t){const e=this.studio.doc,s=this.circuitPlacing,i=this.circuitSel;if(!e||!s||!i)return;const o=ii(e,s,this.gridPoint(t),this.placeOpts(e),i);this.studio.commit(o.doc),this.lastEdit="structure",this.geomSel={id:o.id,kind:"object"},this.phone.matches&&(this.circuitPlacing=null)}onItemDrop(t){const e=t.dataTransfer?.getData("text/x-sw-item"),s=this.canvas,i=this.library;if(!e||!s||!i)return;t.preventDefault();const o=L(i,e);if(!o)return;const n=s.getBoundingClientRect(),r=s.toPlan(t.clientX-n.left,t.clientY-n.top);this.placingItem=o,this.placeItem([r.x,r.y]),this.phone.matches||(this.placingItem=null)}offerBinding(t){const e=this.bundle,s=this.studio.doc,i=this.library;if(this.bindOffer=null,!e||!s||!i)return;const o=s.objects.find(l=>l.id===t),n=o?L(i,o.item_id):void 0;if(!o||!n||!n.anchor_kinds.length||o.anchor_ref||this.bindRefused.has(t))return;const{scale:r}=x(s),a=new Set(s.objects.filter(l=>l.anchor_ref).map(l=>`${l.anchor_ref.resource_type}:${l.anchor_ref.resource_id}`));let d=null;for(const l of this.anchors){if(a.has(`${l.resource_type}:${l.resource_id}`)||!this.onLevel(l))continue;const c=l.resource_type==="camera"?"camera":l.entity?.domain??l.resource_id.split(".")[0];if(!n.anchor_kinds.includes(c))continue;const u=ce(o.position,[l.position.x,l.position.y],e.width,e.height,r);u<=Ei&&(!d||u<d.d)&&(d={a:l,d:u})}d&&(this.bindOffer={objectId:t,anchor:d.a})}bindObject(t,e){this.edit(s=>X(s,t,{anchor_ref:{resource_type:e.resource_type,resource_id:e.resource_id},position:[e.position.x,e.position.y],rotation_deg:e.rotation_degrees})),this.bindOffer=null,this.info=`העצם הוא עכשיו הגוף של ${this.anchorName(e)}`,setTimeout(()=>this.info="",3e3)}openArray(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(r=>r.id===t),o=i&&s?L(s,i.item_id):void 0;if(!e||!i)return;if(this.phone.matches){this.info="מערכים זמינים בדסקטופ בלבד",setTimeout(()=>this.info="",3e3);return}const n=o?oi(o):{spacingX:W(i.size.w_m+.05),spacingY:W(i.size.d_m+.45)};this.arrayDialog={objectId:t,item:o,rows:2,cols:4,spacingX:n.spacingX,spacingY:n.spacingY,directionDeg:i.rotation_deg,max:ni,error:""}}createArray(){const t=this.bundle,e=this.studio.doc,s=this.arrayDialog;if(!t||!e||!s)return;const i=ri(e,s.objectId,s,t.width,t.height,x(e).scale);if(!i){this.arrayDialog={...s,error:"לא ניתן ליצור את המערך (העצם כבר במערך, או שיש יותר מדי עצמים)"};return}this.arrayDialog=null,this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.groupId,kind:"group"},this.info=`${i.ids.length} עצמים במערך אחד`,setTimeout(()=>this.info="",4e3)}deleteGroup(t){const e=this.groupDelete;this.groupDelete=null,e&&(this.edit(s=>ai(s,e,t)),this.geomSel=null)}openCustom(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(n=>n.id===t);if(!e||!s||!i)return;const o=L(s,i.item_id);this.customDialog={objectId:t,nameHe:o?`${o.names.he} (מותאם)`:"",nameEn:o?.names.en??"",category:o?.category??"storage",shape:o?.shape??"box",icon:o?.icon??"box",color:o?.color_token??"object",size:{...i.size},basedOn:o?o.custom?o.based_on:o.id:null,busy:!1,error:"",params:JSON.parse(JSON.stringify(i.params)),z:o&&o.z_ref==="ceiling"?o.z_m:i.z_m}}async createCustom(){const t=this.customDialog,e=this.bundle;if(!(!t||!e)){this.customDialog={...t,busy:!0,error:""};try{const s=await vn({based_on:t.basedOn,names:{he:t.nameHe.trim(),en:t.nameEn.trim()},category:t.category,shape:t.shape,icon:t.icon,color_token:t.color,size:t.size,z_m:t.z,params:t.params});this.customDialog=null,await this.loadLibraryFor(e),this.remember(s.id),this.libCategory="recent",this.libQ="",this.info=`הפריט "${s.names.he}" נוסף לספרייה`,setTimeout(()=>this.info="",4e3)}catch(s){this.customDialog={...t,busy:!1,error:$(s)}}}}async importLibrary(t){const e=this.bundle;if(e)try{let s;try{s=JSON.parse(await t.text())}catch{s=null}if(s?.format!=="smplwise-catalog-1"||!Array.isArray(s.items))throw new Error("הקובץ אינו ייצוא של ספרייה מותאמת (smplwise-catalog-1)");const i=await wn(s.items);await this.loadLibraryFor(e),this.info=`${i.imported} יובאו, ${i.replaced} הוחלפו`,setTimeout(()=>this.info="",4e3)}catch(s){this.error=s instanceof Error&&!(s instanceof P)?s.message:$(s)}}get catalogLookup(){return this.libLookup}get studioOn(){return Lt.includes(this.tool)&&!!this.studio.doc}get studioPlacing(){return!this.studioOn||this.tool==="detect"?!1:this.tool==="library"?!!this.placingItem:this.tool==="connectors"?!!this.connMode:this.tool==="walk"?!!this.walkArmed:this.tool==="circuits"?!!this.circuitPlacing&&!!this.circuitSel:this.tool!=="structure"||this.studioMode!=="select"&&this.studioMode!=="curve"}get geomDragMode(){return this.studio.doc?this.tool==="select"?this.bundle?.permissions.structure&&!this.placing&&!this.drawing?"all":"none":this.tool==="library"?this.placingItem?"none":"objects":this.tool==="connectors"?this.connMode?"none":"objects":this.tool==="circuits"?this.circuitPlacing?"none":"objects":this.tool!=="structure"?"none":this.studioMode==="select"||this.studioMode==="curve"?"all":this.wallDraft||this.curveDraft?"none":"items":"none"}get geomSelectMode(){return this.tool==="structure"&&(this.studioMode==="select"||this.studioMode==="curve")||this.tool==="select"}get selectGeomOn(){return this.tool==="select"&&!!this.geomSel&&!!this.studio.doc&&!this.selectedId}get undoTarget(){return this.studioOn?this.studio.canUndo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canUndo&&(this.lastEdit==="structure"||!this.undo.length)?"structure":this.undo.length?"pins":null}get redoTarget(){return this.studioOn?this.studio.canRedo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canRedo&&(this.lastEdit==="structure"||!this.redo.length)?"structure":this.redo.length?"pins":null}undoAny(){const t=this.undoTarget;t==="structure"?(this.studio.undo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doUndo(),this.lastEdit="pins")}redoAny(){const t=this.redoTarget;t==="structure"?(this.studio.redo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doRedo(),this.lastEdit="pins")}get issueIds(){return this.studio.issues.filter(t=>t.severity==="error"&&t.id).map(t=>t.id)}edit(t){const e=this.studio.doc;if(!e)return;const s=t(e);s===e||JSON.stringify(s)===JSON.stringify(e)||(this.studio.commit(s),this.lastEdit="structure")}snap(t,e,s){const i=this.bundle,o=this.studio.doc;return!i||!o?t:Q(t,e,this.shownWalls(o),i.width,i.height,{tolPx:N/(this.canvas?.zoom??1),free:s})}snapDraw(t,e,s){const i=this.bundle,o=e.length>=3?e[0]:null;return i&&o&&Math.hypot((t[0]-o[0])*i.width,(t[1]-o[1])*i.height)*(this.canvas?.zoom??1)<=N?o:this.snap(t,e.at(-1)??null,s)}openingAt(t,e,s){const i=this.wallLengthM(e,t),o=wr/(this.canvas?.zoom??1)*x(t).scale;let n=null,r=Number.POSITIVE_INFINITY;for(const a of t.openings){const d=a.wall_id===e.id?Math.abs(a.t-s)*i:Number.POSITIVE_INFINITY;d<=a.width_m/2+o&&d<r&&(n=a,r=d)}return n}onPlanHover(t,e,s,i=!1){const o=this.bundle,n=this.studio.doc;if(!o||!n||!this.studioPlacing||i){this.hover=null;return}const r=[t,e];if(this.tool==="library"||this.tool==="circuits")this.hover=this.gridPoint(r);else if(this.tool==="connectors")this.hover=this.snap(r,null,!0);else if(this.tool==="calibrate")this.hover=this.snap(r,null,!0);else if(this.tool==="walk")this.hover=r;else if(this.tool==="measure")this.hover=this.snap(r,this.measurePts.at(-1)??null,s);else if(this.straightDrawing)this.hover=this.snapDraw(r,this.wallDraft??[],s);else if(this.curveDrawing)this.hover=this.snapCurve(r,this.curveDraft??[],s);else if(this.studioMode==="label")this.hover=r;else if(this.studioMode==="markdoor")this.hover=null;else{const a=tt(r,this.shownWalls(n),o.width,o.height,jt/(this.canvas?.zoom??1));this.hover=a&&!this.openingAt(n,a.wall,a.t)?A(a.wall,a.t,o.width,o.height):null}}studioClick(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return;const n=[t,e];if(this.tool==="library"){this.placingItem&&this.placeItem(n);return}if(this.tool==="circuits"){this.circuitPlacing&&this.circuitSel&&this.placeCircuitLamp(n);return}if(this.tool==="connectors"){if(!this.connMode)return;const w=this.snap(n,null,!0);if(!this.connStart){this.connStart=w;return}const b=this.drawConnector(o,this.connMode,this.connStart,w);this.connStart=null,this.studio.commit(b.doc),this.lastEdit="structure",this.geomSel={id:b.id,kind:"connector"};return}if(this.tool==="walk"){this.placeWalkPosition(o,n);return}if(this.tool==="calibrate"){const w=this.snap(n,null,!0),b=this.calib;this.calib=!b.a||b.b?{...B,a:w}:{...b,b:w};return}if(this.tool==="measure"){this.measurePts=[...this.measurePts,this.snap(n,this.measurePts.at(-1)??null,s)];return}const r=this.studioMode,a=this.canvas?.zoom??1;if(this.curveDrawing){this.curveClick(n,s);return}if(this.straightDrawing){const w=this.wallDraft??[],b=this.snapDraw(n,w,s),k=S=>!!S&&Math.hypot((S[0]-n[0])*i.width,(S[1]-n[1])*i.height)*a<8;if(w.length&&(k(w[w.length-1])||k(this.lastDrawClick))){this.finishWall();return}if(w.length>=3&&b===w[0]){this.wallDraft=[...w,w[0]],this.finishWall();return}this.wallDraft=[...w,b],this.lastDrawClick=n;return}if(r==="curve"||r==="wall"||r==="curved"||r==="glass")return;if(r==="label"){const w=li(o,n,"תווית"),b=this.placeOpts(o).levelId;this.studio.commit(b===T(o)?w.doc:et(w.doc,w.id,{level_id:b})),this.lastEdit="structure",this.geomSel={id:w.id,kind:"label"};return}if(r==="select")return;if(r==="markdoor"){this.markDoorClick(n);return}const d=tt(n,this.shownWalls(o),i.width,i.height,jt/a);if(!d){this.info="לחץ על קיר כדי להציב פתח",setTimeout(()=>this.info="",2500);return}const l=this.openingAt(o,d.wall,d.t);if(l){this.onGeomSelect(l.id,"opening");return}const[c,u]=it(Fi(r).width_m,this.wallLengthM(d.wall,o)),v=Ve(o,d.wall.id,Math.min(u,Math.max(c,d.t)),r);this.studio.commit(v.doc),this.lastEdit="structure",this.geomSel={id:v.id,kind:"opening"}}startMarkDoor(){const t=this.wallDraft;t&&t.length>=2?(this.finishWall(),this.flash("הקיר שבציור נשמר; סמן דלת פעיל")):t&&this.flash("נקודת הקיר שהתחלת בוטלה; סמן דלת פעיל"),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.curveDraft=null,this.curveRedo=[],this.tool!=="structure"&&this.pickTool("structure"),this.studioMode="markdoor",this.wallDraft=null,this.hover=null}flash(t,e=3500){this.info=t,setTimeout(()=>{this.info===t&&(this.info="")},e)}flashError(t,e=3500){this.error=t,setTimeout(()=>{this.error===t&&(this.error="")},e)}dropOrphanGhost(){const t=this.studio.doc;this.doorGhost&&t&&!R(t,this.doorGhost)&&(this.dropDoorGhost(),this.flash("הקיר של ההצעה הוסר; ההצעה בוטלה"))}selectExisting(t){const e=this.studio.doc,s=this.bundle,i=e&&s?En(e,t,s.width,s.height):null;return i?(this.doorGhost=null,this.geomSel={id:i.id,kind:"opening"},this.flash("כאן כבר יש דלת: היא נבחרה"),!0):!1}dropDoorGhost(){this.doorToken++,this.doorGhost=null,this.doorAsking=!1}async markDoorClick(t){const e=this.bundle;if(!e||!this.studio.doc||this.doorAsking)return;const s=e.width,i=e.height;if(this.doorGhost){const d=jn(this.studio.doc,this.doorGhost,t,s,i);if(this.acceptDoorGhost(),d)return}const o=this.studio.doc,n=this.canvas?.zoom??1,r=tt(t,this.shownWalls(o),s,i,jt/n);if(e.source!=="api"||!e.planVersionId){if(!r){this.info="לחץ על קיר כדי להציב דלת",setTimeout(()=>this.info="",2500);return}const d=Ln(o,r.wall,r.t,t,s,i);this.selectExisting(d)||(this.doorGhost=d);return}const a=++this.doorToken;this.doorAsking=!0;try{await this.studio.flush();const d=this.activeLevel,l=await Jo(e.planVersionId,{x:+t[0].toFixed(5),y:+t[1].toFixed(5),...r?{wall_id:r.wall.id}:{},...d?{level_id:d}:{}}),c=this.studio.doc;if(a!==this.doorToken||!c||this.tool!=="structure"||this.studioMode!=="markdoor")return;const u=zn(c,l,s,i,this.wallDefaults);if(!R(c,u)){this.info="הקיר של ההצעה לא נמצא בטיוטה; שמור ונסה שוב",setTimeout(()=>this.info="",4e3);return}this.selectExisting(u)||(this.doorGhost=u)}catch(d){if(a!==this.doorToken)return;this.info=d instanceof P&&d.code==="door_proposal_timeout"?"ההצעה לא חושבה בזמן; לחץ שוב":$(d),setTimeout(()=>this.info="",4500)}finally{a===this.doorToken&&(this.doorAsking=!1)}}acceptDoorGhost(){const t=this.doorGhost,e=this.studio.doc,s=this.bundle;if(this.doorGhost=null,!t||!e||!s||this.selectExisting(t))return;const i=An(e,t,s.width,s.height,this.wallDefaults,this.placeOpts(e).levelId);i&&(this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.openingId,kind:"opening"})}onGhostHandle(t){const e=this.doorGhost,s=this.studio.doc,i=this.bundle;!e||!s||!i||(t.id==="accept"?this.acceptDoorGhost():t.id==="hinge"?this.doorGhost=We(e):t.id==="swing"?this.doorGhost=Cn(e):t.id==="width"&&t.x!==void 0&&t.y!==void 0&&(this.doorGhost=On(s,e,[t.x,t.y],i.width,i.height)))}renderMarkDoorHint(){const t=this.doorGhost;if(this.doorAsking)return h`<div class="placing-hint" data-mark-door-hint="asking"><span>מחפש את הדלת בשרטוט…</span></div>`;if(!t)return h`<div class="placing-hint" data-mark-door-hint="idle"><span>סמן דלת: לחץ על סמל הדלת בתוכנית · Esc לביטול</span></div>`;const e=ut(t.width_m,x(this.studio.doc).estimated,this.showEstimates);return h`<div class="placing-hint bindbar" data-mark-door-hint="ghost" data-ghost-found=${t.found}><span><b data-ghost-note-text>${t.note}</b> · ${e}${t.warning?h` · <span data-ghost-warning>${t.warning}</span>`:p}
      <button data-ghost-accept-btn @click=${()=>this.acceptDoorGhost()}>אשר (Enter)</button><button data-ghost-cancel-btn @click=${()=>this.dropDoorGhost()}>בטל (Esc)</button></span></div>`}finishWall(){const t=this.wallDraft;this.wallDraft=null,this.hover=null;const e=this.studio.doc;if(!e||!t||t.length<2)return;const s=Ge(e,t,this.drawDefaults);this.commitNewWall(e,s)}commitNewWall(t,e){const s=this.placeOpts(t).levelId;let i=s===T(t)?e.doc:st(e.doc,e.id,{level_id:s});if(this.studioMode==="glass"){const o=i.walls.find(n=>n.id===e.id);o?.glazing&&o.glazing.panel_width_m!==this.glassDraw.panel_width_m&&(i=st(i,e.id,{glazing:{...o.glazing,panel_width_m:this.glassDraw.panel_width_m}}))}this.studio.commit(i),this.lastEdit="structure",this.geomSel={id:e.id,kind:"wall"}}get drawDefaults(){return this.studioMode==="glass"?{kind:"glass",thickness_m:this.glassDraw.thickness_m}:this.wallDefaults}get straightDrawing(){return this.tool==="structure"&&(this.studioMode==="wall"||this.studioMode==="glass"&&!this.glassDraw.curved)}get curveDrawing(){return this.tool==="structure"&&(this.studioMode==="curved"||this.studioMode==="glass"&&this.glassDraw.curved)}snapCurve(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return t;const n=this.canvas?.zoom??1,r=e.length>=3?e[0]:null;if(r&&Math.hypot((t[0]-r[0])*i.width,(t[1]-r[1])*i.height)*n<=N)return r;if(s)return t;const a=Q(t,null,this.shownWalls(o),i.width,i.height,{tolPx:N/n,free:!0});return a===t?this.gridPoint(t):a}curveClick(t,e){const s=this.bundle;if(!s)return;const i=this.curveDraft??[],o=this.canvas?.zoom??1,n=this.snapCurve(t,i,e),r=a=>!!a&&Math.hypot((a[0]-t[0])*s.width,(a[1]-t[1])*s.height)*o<8;if(i.length&&(r(i[i.length-1])||r(this.lastDrawClick))){this.finishCurve(!1);return}if(i.length>=3&&n===i[0]){this.finishCurve(!0);return}i.length>=Ss||(this.curveDraft=[...i,n],this.curveRedo=[],this.lastDrawClick=t)}finishCurve(t){const e=this.curveDraft,s=this.bundle,i=this.studio.doc;if(this.curveDraft=null,this.curveRedo=[],this.hover=null,this.lastDrawClick=null,!e||!s||!i)return;const o=e.length>=2?Ds(i,e,t,this.drawDefaults,s.width,s.height):null;o&&this.commitNewWall(i,o)}curveUndoPoint(){const t=this.curveDraft;t?.length&&(this.curveRedo=[...this.curveRedo,t[t.length-1]],this.curveDraft=t.length>1?t.slice(0,-1):null,this.lastDrawClick=null,this.curveDraft||(this.hover=null))}curveRedoPoint(){const t=this.curveRedo[this.curveRedo.length-1];t&&(this.curveRedo=this.curveRedo.slice(0,-1),this.curveDraft=[...this.curveDraft??[],t])}curveLive(t){const e=this.curveDraft,s=this.studio.doc;if(!this.curveDrawing||!e?.length||!s)return null;const i=this.hover,o=!!i&&e.length>=3&&i===e[0],n=i&&!o?[...e,i]:e;return{...Is(n,o,t.width,t.height,x(s).scale),count:e.length}}renderCurveHint(t){const e=this.curveLive(t),s=this.studio.doc;if(!e||!s)return p;const{estimated:i}=x(s),o=Number.isFinite(e.minRadiusM)?ut(e.minRadiusM,i,this.showEstimates):O("straightLine"),n=this.studioMode==="glass"?uo("tool"):O("draft");return h`<div class="placing-hint bindbar float" data-curve-hint=${e.count}><span>${n}: ${e.count} ${O("points")} · ${O("length")} <b data-curve-length>${ut(e.lengthM,i,this.showEstimates)}</b> · ${O("minRadius")} <b data-curve-radius>${o}</b>${e.count>=3?h` · ${O("closeHint")}`:p}
      <button data-curve-finish ?disabled=${e.count<2} @click=${()=>this.finishCurve(!1)}>${O("finish")} (Enter)</button><button data-curve-undo @click=${()=>this.curveUndoPoint()}>${O("undoPoint")}</button><button data-curve-cancel @click=${()=>{this.curveDraft=null,this.curveRedo=[],this.hover=null}}>Esc</button></span></div>`}movedCurvePoint(t,e,s,i,o){const n=this.bundle;if(!n||s<0)return null;const r=this.canvas?.zoom??1;let a=i;if(!o){const u=Q(i,null,this.shownWalls(t).filter(v=>v.id!==e.id),n.width,n.height,{tolPx:N/r,free:!0});a=u===i?this.gridPoint(i):u}const d=zs(t,e.id,s,a,n.width,n.height),l=d.walls.find(u=>u.id===e.id),c=l?ue(l):null;return{doc:d,vertex:c?.[Math.min(s,c.length-1)]??0}}onCanvasSelect(t){const e=t.kind==="wall"&&t.vertex!==void 0&&this.curveDrawing&&!this.curveDraft?this.studio.doc?.walls.find(s=>s.id===t.id):void 0;if(e&&t.vertex!==void 0&&Y(e,t.vertex)>=0){const s=e.polyline[t.vertex];this.curveDraft=[[s[0],s[1]]],this.curveRedo=[],this.lastDrawClick=null;return}this.onGeomSelect(t.id,t.kind,t.vertex,!!t.add,t.segment)}onGeomSelect(t,e,s,i=!1,o){if(i&&this.multiOn&&s===void 0&&(e==="wall"||e==="object")){this.toggleSelection({id:t,kind:e});return}if(this.tool==="circuits"&&this.membersMode&&e==="object"&&this.circuitSel){const n=this.studio.doc,r=this.library,a=n?.objects.find(c=>c.id===t),d=a&&r?L(r,a.item_id):void 0;if(d&&!pe(d)){this.info=`${d.names.he} אינו גוף תאורה`,setTimeout(()=>this.info="",2500);return}const l=this.circuitSel;this.edit(c=>di(c,l,t));return}e==="object"&&this.tool!=="library"&&this.tool!=="select"&&this.pickTool("library"),e==="connector"&&this.tool!=="connectors"&&this.tool!=="select"&&this.pickTool("connectors"),e==="connector"&&this.tool==="select"&&this.loadLinkTargets(),this.zoneVertexSel=null,this.geomSel=o!==void 0?{id:t,kind:e,segment:o}:s===void 0?{id:t,kind:e}:{id:t,kind:e,vertex:s},this.multi=[],this.selectedId=null,this.selectedZoneId=null,e!=="object"&&e!=="group"&&(this.bindOffer=null)}onZoneSelect(t,e){if(!(this.placing||this.drawing||this.studioPlacing||this.tool==="detect"||t.startsWith("cand-"))){if(this.tool==="structure"||this.tool==="library"){this.geomSel=null;return}if(e&&this.multiOn){this.toggleSelection({id:t,kind:"zone"});return}this.selectedZoneId!==t&&(this.zoneVertexSel=null),this.selectedZoneId=t,this.selectedId=null,this.geomSel=null,this.multi=[]}}get multiOn(){return this.tool==="select"&&this.geomDragMode==="all"&&!this.phone.matches}get multiItems(){const t=this.studio.doc;if(!this.multi.length||!t)return[];const e=this.multiCache;if(e&&e.multi===this.multi&&e.doc===t&&e.zones===this.zones)return e.items;const s=new Set(t.walls.map(r=>r.id)),i=new Set(t.objects.map(r=>r.id)),o=new Set(this.zones.map(r=>r.id)),n=this.multi.filter(r=>(r.kind==="wall"?s:r.kind==="object"?i:o).has(r.id));return this.multiCache={multi:this.multi,doc:t,zones:this.zones,items:n},n}get multiShown(){const t=this.tool==="select"?this.multiItems:[];return t.length>=2?t:[]}selectionItems(){if(this.multi.length)return this.multiItems;const t=this.geomSel;return t&&(t.kind==="wall"||t.kind==="object")?[{id:t.id,kind:t.kind}]:this.selectedZoneId?[{id:this.selectedZoneId,kind:"zone"}]:[]}setSelection(t){if(this.multiNote="",this.selectedId=null,this.zoneVertexSel=null,this.bindOffer=null,t.length>=2){this.multi=t,this.geomSel=null,this.selectedZoneId=null;return}this.multi=[];const e=t[0];this.geomSel=e&&e.kind!=="zone"?{id:e.id,kind:e.kind}:null,this.selectedZoneId=e?.kind==="zone"?e.id:null}toggleSelection(t){this.setSelection(hi(this.selectionItems(),t))}get pickableZones(){return this.showZones?this.zones:[]}onGeomBox(t){const e=this.studio.doc,s=this.bundle;if(!this.multiOn||!e||!s)return;const i=ci(e,this.pickableZones,t,this.activeLevel,s.width,s.height,x(e).scale);if(!t.add){this.setSelection(i);return}const o=this.selectionItems(),n=new Set(o.map(r=>r.id));this.setSelection([...o,...i.filter(r=>!n.has(r.id))])}selectAll(){const t=this.studio.doc;t&&this.setSelection(_t(t,this.pickableZones,this.activeLevel))}multiDragged(t,e){if(!this.multiMember(e))return null;const s=this.multiShown,i=s.filter(b=>b.kind!=="zone").map(b=>b.id),o=new Map(this.zones.map(b=>[b.id,b])),n=s.filter(b=>b.kind==="zone").map(b=>o.get(b.id)).filter(b=>!!b),r=this.bundle,a=o.get(e.id)?.polygon[0],d=e.kind==="object"?t.objects.find(b=>b.id===e.id)?.position:e.kind==="wall"?t.walls.find(b=>b.id===e.id)?.polyline[0]:a&&[a.x,a.y],l=e.ctrl?0:this.gridPx(t),[c,u]=r&&d&&l?ui(d,e.x-e.sx,e.y-e.sy,l,r.width,r.height):[e.x-e.sx,e.y-e.sy],[v,w]=pi(t,i,c,u,n.map(b=>b.polygon));return{doc:gi(t,i,v,w),zones:Object.fromEntries(n.map(b=>[b.id,fi(b.polygon,v,w)]))}}multiMember(t){return(t.kind==="object"||t.kind==="wall"||t.kind==="zone")&&this.multiShown.some(e=>e.id===t.id)}async commitZoneMoves(t){const e=this.multi,s=new Map(this.zones.map(l=>[l.id,l])),i=Object.entries(t).map(([l,c])=>({z:s.get(l),polygon:c})).filter(l=>!!l.z&&JSON.stringify(l.z.polygon)!==JSON.stringify(l.polygon));if(!i.length||this.bundle?.source==="demo"){this.zonePreview=null;return}this.zonePreview=t,this.zoneSaving=!0;let o=[];try{o=(await Promise.allSettled(i.map(c=>this.sendZonePatch(c.z,{polygon:c.polygon})))).map(c=>c.status==="fulfilled"?c.value:$(c.reason))}finally{this.zonePreview=null,this.zoneSaving=!1}const n=i.map((l,c)=>({id:l.z.id,why:o[c]})).filter(l=>l.why!=="ok");if(!n.length)return;const r=n.some(l=>l.why==="conflict");r&&await this.load();const a=r?"אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש":n[0].why;if(this.error=`${n.length} מתוך ${i.length} אזורים לא הוזזו (${a}). שאר הבחירה זזה; האזורים שלא זזו נבחרו לבדם - גרור אותם למקומם (ביטול ב-Ctrl+Z מחזיר רק קירות ועצמים, לא אזורים)`,this.tool!=="select"||this.multi!==e)return;const d=new Set(this.zones.map(l=>l.id));this.setSelection(n.filter(l=>d.has(l.id)).map(l=>({id:l.id,kind:"zone"})))}async deleteMulti(){const t=this.multiShown;if(!t.length||!this.studio.doc||this.zoneSaving)return;const e=new Map(this.zones.map(u=>[u.id,u])),s=t.filter(u=>u.kind==="zone").map(u=>e.get(u.id)).filter(u=>!!u),i=this.bundle?.source==="demo",o=t.length-s.length,n=s.length===1?`את "${s[0].name}"`:`${s.length} אזורים`,r=o?`למחוק ${n} יחד עם ${I(o,"הפריט האחר שנבחר","הפריטים האחרים שנבחרו")}?`:`למחוק ${n}?`;if(s.length&&!i&&!window.confirm(`${r} מחיקת אזור אינה ניתנת לביטול; המצלמות והישויות בקומה לא מושפעות.`))return;const a=t.filter(u=>u.kind!=="zone").map(u=>u.id);if(a.length&&this.edit(u=>mi(u,a)),this.setSelection([]),!s.length)return;if(i){this.info="נתוני הדגמה: אזורים נמחקים רק מול השרת.",setTimeout(()=>this.info="",3e3);return}this.zoneBusy=!0,this.error="";let d=[];try{const u=await Promise.allSettled(s.map(v=>this.sendZoneDelete(v)));d=s.map((v,w)=>({z:v,why:u[w].status==="fulfilled"?u[w].value:$(u[w].reason)})).filter(v=>v.why!=="ok")}finally{this.zoneBusy=!1}if(!d.length)return;this.error=`${d.length} מתוך ${s.length} אזורים לא נמחקו (${d[0].why}); הם נבחרו שוב כדי לנסות שוב`;const l=new Set(this.zones.map(u=>u.id)),c=!this.multi.length&&!this.geomSel&&!this.selectedZoneId&&!this.selectedId;this.tool==="select"&&c&&this.setSelection(d.filter(u=>l.has(u.z.id)).map(u=>({id:u.z.id,kind:"zone"})))}duplicateMulti(){const t=this.bundle,e=this.studio.doc,s=this.multiShown.filter(o=>o.kind==="object").map(o=>o.id);if(!t||!e||!s.length||this.zoneSaving)return;const i=vi(e,s,t.width,t.height,x(e).scale);i.ids.length&&(this.edit(()=>i.doc),this.setSelection(i.ids.map(o=>({id:o,kind:"object"}))))}handleMultiKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();return e&&!t.shiftKey&&!t.altKey&&(t.code==="KeyA"||s==="a")?(t.preventDefault(),this.selectAll(),!0):this.multiShown.length<2||this.geomPreview||this.zoneSaving?!1:t.key==="Delete"||t.key==="Backspace"?(t.preventDefault(),this.deleteMulti(),!0):e&&s==="d"?(t.preventDefault(),this.duplicateMulti(),!0):!1}renderMultiPanel(){const t=this.multiShown,e=this.studio.doc,s=i=>t.filter(o=>o.kind===i).length;return po({walls:s("wall"),objects:s("object"),zones:s("zone"),busy:this.zoneBusy||this.zoneSaving,saveState:this.studio.saveState,tags:fe(e,this.zones,t),levels:e.levels,circuits:e.circuits,lights:this.lightIds(e,t).length,note:this.multiNote,alignable:this.alignIds(e,t).length},{duplicate:()=>this.duplicateMulti(),remove:()=>void this.deleteMulti(),clear:()=>this.setSelection([]),addTag:i=>void this.bulkTag(i,!0),removeTag:i=>void this.bulkTag(i,!1),setLevel:i=>void this.bulkLevel(i),joinCircuit:i=>this.bulkCircuit(i),align:i=>this.bulkAlign(i),distribute:i=>this.bulkAlign(i)})}alignIds(t,e){const s=new Map(t.objects.map(i=>[i.id,i]));return e.filter(i=>i.kind==="object"&&s.has(i.id)&&!s.get(i.id).anchor_ref).map(i=>i.id)}bulkAlign(t){const e=this.studio.doc,s=this.bundle,i=this.multiShown;if(!e||!s||i.length<2||this.zoneSaving)return;const o=this.alignIds(e,i),{scale:n}=x(e),r=t==="x"||t==="y"?wi(e,o,t,s.width,s.height,n):bi(e,o,t,s.width,s.height,n),a=new Map(e.objects.map(c=>[c.id,c])),d=r.objects.filter(c=>a.get(c.id)!==c).length;this.edit(()=>r);const l=t==="x"?"פיזור לרוחב":t==="y"?"פיזור לגובה":"יישור";this.multiNote=d?`${l}: ${I(d,"עצם אחד זז","עצמים זזו")} (ביטול ב-Ctrl+Z)`:`${l}: העצמים כבר במקומם, שום דבר לא זז`}lightIds(t,e){const s=this.library;if(!s)return[];const i=new Map(t.objects.map(o=>[o.id,o]));return e.filter(o=>{const n=o.kind==="object"?i.get(o.id):void 0;return!!n&&pe(L(s,n.item_id))}).map(o=>o.id)}async patchZones(t,e){const s=t.map(o=>({z:o,body:e(o)})).filter(o=>o.body!==null);if(!s.length)return{sent:0,failed:[]};this.zoneBusy=!0,this.zoneSaving=!0;let i=[];try{const o=await Promise.allSettled(s.map(n=>this.sendZonePatch(n.z,n.body)));i=s.map((n,r)=>({z:n.z,why:o[r].status==="fulfilled"?o[r].value:$(o[r].reason)})).filter(n=>n.why!=="ok")}finally{this.zoneBusy=!1,this.zoneSaving=!1}if(i.some(o=>o.why==="conflict")){const o=this.multiNote;await this.load(),this.multiNote=o}return{sent:s.length,failed:i}}multiZones(t){const e=new Map(this.zones.map(s=>[s.id,s]));return{zs:t.filter(s=>s.kind==="zone").map(s=>e.get(s.id)).filter(s=>!!s),demo:this.bundle?.source==="demo"}}zoneFailText(t){if(!t.failed.length)return"";const e=t.failed.some(s=>s.why==="conflict")?"אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש":t.failed[0].why;return` · ${t.failed.length} מתוך ${t.sent} אזורים לא עודכנו (${e})`}async bulkTag(t,e){const s=this.studio.doc,i=this.multiShown;if(!s||i.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,n=new Set(i.filter(y=>y.kind!=="zone").map(y=>y.id)),r=[...n],{zs:a,demo:d}=this.multiZones(i),l=y=>e&&(y?.length??0)>=Dt&&zt(y,t)===y,c=[...s.walls,...s.objects].filter(y=>n.has(y.id)&&l(y.tags)).length+a.filter(y=>l(y.tags)).length,u=yi(s,r,t,e),v=new Map([...s.walls,...s.objects].map(y=>[y.id,y])),w=[...u.walls,...u.objects].filter(y=>n.has(y.id)&&v.get(y.id)!==y).length;this.edit(()=>u);const b=y=>{const E=e?be(y.tags,t):zt(y.tags,t);return E===y.tags||!y.tags&&!E.length?null:{tags:E}},k=d?{sent:0,failed:[]}:await this.patchZones(a,b);if(this.multi!==o)return;const S=w+k.sent-k.failed.length;this.multiNote=(e?`התגית "${t}" נוספה ל־${S} מתוך ${i.length} פריטים`:`התגית "${t}" הוסרה מ־${S} פריטים`)+(c?` · ${I(c,"פריט אחד","פריטים")} כבר עם ${Dt} תגיות`:"")+(d&&a.length?" · נתוני הדגמה: אזורים נשמרים רק מול השרת":"")+this.zoneFailText(k)}async bulkLevel(t){const e=this.studio.doc,s=this.multiShown,i=e?.levels.find(y=>y.id===t);if(!e||!i||s.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,n=s.filter(y=>y.kind!=="zone").map(y=>y.id),r=T(e),{zs:a,demo:d}=this.multiZones(s),l=new Set(n),c=[...e.walls,...e.objects].filter(y=>l.has(y.id)&&y.level_id!==t).length,u=this.activeLevel!==null&&this.activeLevel!==t,v=y=>(y.level_id||r)!==t;this.edit(y=>$i(y,n,t));const w=d?{sent:0,failed:[]}:await this.patchZones(a,y=>v(y)?{level_id:t}:null);if(this.multi!==o)return;const b=new Set(d?a.filter(v).map(y=>y.id):w.failed.map(y=>y.z.id));b.size&&this.setSelection(this.multiItems.filter(y=>!b.has(y.id))),u&&(this.levelFilter=t);const k=c+w.sent-w.failed.length,S=`${I(k,"פריט אחד הועבר","פריטים הועברו")} למפלס "${i.name}"`+(d&&a.length?" · נתוני הדגמה: אזורים נשמרים רק מול השרת":"")+this.zoneFailText(w)+(b.size?` · ${I(b.size,"האזור שלא הועבר הוצא מהבחירה","האזורים שלא הועברו הוצאו מהבחירה")}`:"");this.multiNote=S,w.failed.length&&(this.error=S)}bulkCircuit(t){const e=this.studio.doc,s=this.multiShown,i=e?.circuits.find(a=>a.id===t);if(!e||!i||s.length<2)return;const o=new Set(this.lightIds(e,s)),n=ki(e,t,s.filter(a=>a.kind==="object").map(a=>a.id),a=>o.has(a.id));this.edit(()=>n.doc);const r=s.length-n.added.length;this.multiNote=r?`${n.added.length} מתוך ${s.length} פריטים שנבחרו נוספו למעגל "${i.name}"; ${I(r,"האחר אינו גוף תאורה","האחרים אינם גופי תאורה")}`:`${I(n.added.length,"גוף תאורה אחד נוסף","גופי תאורה נוספו")} למעגל "${i.name}"`}get shownTags(){const t=this.studio.doc;return t?fe(t,this.pickableZones,_t(t,this.pickableZones,this.activeLevel)):[]}selectByTag(t){const e=this.studio.doc;if(!e||(this.tool!=="select"&&this.pickTool("select"),!this.multiOn))return;const s=xi(e,this.pickableZones,t,this.activeLevel);this.setSelection(s),s.length||(this.info=`אין פריטים עם התגית "${t}" במפלס המוצג`,setTimeout(()=>this.info="",3e3))}wallLengthM(t,e){const s=this.bundle;return s?Ft(t,s.width,s.height)*x(e).scale:0}dragged(t,e){const s=this.bundle;if(!s||e.kind==="zone")return null;const i=[e.x,e.y];if(e.kind==="object"||e.kind==="object-duplicate"){const r=t.objects.find(w=>w.id===e.id);if(!r)return null;if(r.anchor_ref)return{doc:t,sel:{id:e.id,kind:"object"}};const a=[r.position[0]+e.x-e.sx,r.position[1]+e.y-e.sy],d=this.geomSel?.kind==="group"&&r.group_id===this.geomSel.id?r.group_id:null,l=this.canvas?.zoom??1,c=e.ctrl?{gridPx:0,tolPx:0}:{gridPx:this.gridPx(t),tolPx:d?0:Li/l},u=_i(r,a,c.tolPx?this.alignTargets(t,e.kind==="object"?e.id:""):[],c,s.width,s.height,x(t).scale),v=u.position;if(e.kind==="object-duplicate"){this.dupId??=ge();const w=Si(t,e.id,v,this.dupId);return{doc:w.doc,sel:{id:w.id,kind:"object"},guides:u.guides}}return d?{doc:Di(t,d,v[0]-r.position[0],v[1]-r.position[1]),sel:{id:d,kind:"group"}}:{doc:me(t,e.id,v),sel:{id:e.id,kind:"object"},guides:u.guides}}if(e.kind==="object-rotate"){const r=t.objects.find(a=>a.id===e.id);return!r||r.anchor_ref?null:{doc:X(t,e.id,{rotation_deg:Ii(r,i,s.width,s.height,e.shift?15:1)}),sel:{id:e.id,kind:"object"}}}if(e.kind==="object-stretch"){const r=t.objects.find(d=>d.id===e.id);if(!r)return null;const a=zi(r,e.index%4,i,s.width,s.height,x(t).scale,e.shift);return{doc:X(t,e.id,{size:a}),sel:{id:e.id,kind:"object"}}}if(e.kind==="connector-vertex"){const r=t.connectors.find(a=>a.id===e.id);return!r||Pt(r)?null:{doc:Mi(t,e.id,e.index,this.snap(i,null,!0)),sel:{id:e.id,kind:"connector"}}}if(e.kind==="connector"){const r=t.connectors.find(a=>a.id===e.id);return!r||Pt(r)?null:{doc:Pi(t,e.id,e.x-e.sx,e.y-e.sy),sel:{id:e.id,kind:"connector"}}}if(e.kind==="wall"){const r=t.walls.find(a=>a.id===e.id);return r?{doc:ve(t,r.id,...this.wallDelta(t,r,e)),sel:{id:r.id,kind:"wall"}}:null}if(e.kind==="segment")return{doc:Ms(t,e.id,e.index,[e.x,e.y],s.width,s.height),sel:{id:e.id,kind:"wall",segment:e.index}};if(e.kind==="curve-point"||e.kind==="vertex"&&t.walls.some(r=>r.id===e.id&&Y(r,e.index)>=0)){const r=t.walls.find(d=>d.id===e.id),a=r?this.movedCurvePoint(t,r,Y(r,e.index),[e.x,e.y],e.ctrl):null;return a?{doc:a.doc,sel:{id:e.id,kind:"wall",vertex:a.vertex}}:null}if(e.kind==="vertex"){const r=t.walls.find(S=>S.id===e.id);if(!r)return null;const a=r.polyline,d=a.length-1,l=It(a),c=l&&e.index===d?0:e.index,u=l?d:a.length,v=l?[(c+u-1)%u,c,(c+1)%u]:[c-1,c,c+1],w={...r,polyline:a.slice(0,u).filter((S,y)=>!v.includes(y)),bulges:void 0},b=[...t.walls.filter(S=>S.id!==e.id),w],k=Q(i,c>0?a[c-1]:null,b,s.width,s.height,{tolPx:N/(this.canvas?.zoom??1),free:!0});return{doc:l&&c===0?U(U(t,e.id,0,k),e.id,d,k):U(t,e.id,c,k),sel:{id:e.id,kind:"wall",vertex:c}}}if(e.kind==="opening"){const r={id:e.id,kind:"opening"},a=t.openings.find(w=>w.id===e.id),d=a&&t.walls.find(w=>w.id===a.wall_id),l=a&&d?tt(i,[d],s.width,s.height,Number.POSITIVE_INFINITY):null,c=a&&d?tt([e.sx,e.sy],[d],s.width,s.height,Number.POSITIVE_INFINITY):null;if(!a||!d||!l||!c)return{doc:t,sel:r};const[u,v]=it(a.width_m,this.wallLengthM(d,t));return{doc:vt(t,e.id,{t:Math.min(v,Math.max(u,a.t+l.t-c.t))}),sel:r}}const o=t.labels.find(r=>r.id===e.id),n={id:e.id,kind:"label"};return o?{doc:et(t,e.id,{position:[o.position[0]+e.x-e.sx,o.position[1]+e.y-e.sy]}),sel:n}:{doc:t,sel:n}}wallDelta(t,e,s){const i=this.bundle;let o=s.x-s.sx,n=s.y-s.sy;if(!i)return[o,n];s.shift&&(Math.abs(o*i.width)>=Math.abs(n*i.height)?n=0:o=0);const r=this.shownWalls(t).filter(u=>u.id!==e.id),a=N/(this.canvas?.zoom??1);let d=null,l=Number.POSITIVE_INFINITY;const c=It(e.polyline)?e.polyline.slice(0,-1):e.polyline;for(const u of c){const v=[u[0]+o,u[1]+n],w=Q(v,null,r,i.width,i.height,{tolPx:a,free:!0}),b=[w[0]-v[0],w[1]-v[1]],k=Math.hypot(b[0]*i.width,b[1]*i.height);k>0&&k<l&&(d=b,l=k)}return d&&!s.shift?(o+=d[0],n+=d[1]):d&&n===0?o+=d[0]:d&&(n+=d[1]),[o,n]}onGeomDragMove(t){const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.geomPreview=null;return}const s=e?this.multiDragged(e,t):null;if(s){this.geomPreview=s.doc,this.zonePreview=s.zones,this.guides=[];return}const i=e?this.dragged(e,t):null;this.geomPreview=i?.doc??null,this.guides=i?.guides??[],i&&this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex)}onGeomDrag(t){this.geomPreview=null,this.guides=[];const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.info="האזורים של ההזזה הקודמת עדיין נשמרים; גרור שוב בעוד רגע",setTimeout(()=>this.info="",3e3);return}const s=e?this.multiDragged(e,t):null;if(s){this.edit(()=>s.doc),this.commitZoneMoves(s.zones);return}const i=e?this.dragged(e,t):null;this.guideCache=null,i&&(this.edit(()=>i.doc),this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex),this.dupId=null,i.sel.kind==="object"&&this.offerBinding(i.sel.id))}nudgeGeom(t){const e=this.geomSel,s=this.bundle,i=this.studio.doc;if(!e||!s||!i||this.geomPreview||this.wallDraft||t.ctrlKey||t.metaKey||t.altKey)return!1;const{scale:o,estimated:n}=x(i),r=n?(t.shiftKey?.01:.002)*s.width:(t.shiftKey?.1:.01)/o;let a,d=e.id;if(e.kind==="opening"){const c=i.openings.find(y=>y.id===e.id),u=c&&i.walls.find(y=>y.id===c.wall_id),v=u?Ft(u,s.width,s.height):0;if(!c||!u||!(v>0))return!1;const[w,b]=at(u,c.t,s.width,s.height),k=Math.abs(w)>=Math.abs(b);let S=0;if(k&&t.key==="ArrowRight"?S=Math.sign(w):k&&t.key==="ArrowLeft"?S=-Math.sign(w):!k&&t.key==="ArrowDown"?S=Math.sign(b):!k&&t.key==="ArrowUp"&&(S=-Math.sign(b)),t.preventDefault(),!S)return!0;a=vt(i,c.id,{t:Ti(c.t,S*r/v,it(c.width_m,this.wallLengthM(u,i)))})}else{const c=(t.key==="ArrowRight"?r:t.key==="ArrowLeft"?-r:0)/s.width,u=(t.key==="ArrowDown"?r:t.key==="ArrowUp"?-r:0)/s.height;if(e.kind==="object"){const v=i.objects.find(w=>w.id===e.id);if(!v||v.anchor_ref)return!1;a=me(i,v.id,[v.position[0]+c,v.position[1]+u])}else if(e.kind==="label"){const v=i.labels.find(w=>w.id===e.id);if(!v)return!1;a=et(i,v.id,{position:[v.position[0]+c,v.position[1]+u]})}else{const v=i.walls.find(b=>b.id===e.id),w=e.vertex;if(!this.geomSelectMode||!v)return!1;if(w===void 0)a=ve(i,v.id,c,u),d=`${v.id}:all`;else{if(!v.polyline[w])return!1;const b=[v.polyline[w][0]+c,v.polyline[w][1]+u],k=v.polyline.length-1,S=Y(v,w);if(S>=0){const y=this.movedCurvePoint(i,v,S,b,!0);if(!y)return!1;a=y.doc,this.geomSel={id:v.id,kind:"wall",vertex:y.vertex}}else a=It(v.polyline)&&w===0?U(U(i,v.id,0,b),v.id,k,b):U(i,v.id,w,b);d=`${v.id}:${S>=0?`p${S}`:w}`}}}t.preventDefault();const l=c=>JSON.stringify(e.kind==="opening"?c.openings.find(u=>u.id===e.id):e.kind==="label"?c.labels.find(u=>u.id===e.id):e.kind==="object"?c.objects.find(u=>u.id===e.id):c.walls.find(u=>u.id===e.id));return l(a)!==l(i)&&this.commitNudge(d,a),!0}commitNudge(t,e){const s=this.studio.doc;if(!s)return;const i=performance.now(),o=this.nudgeBurst;o&&o.key===t&&o.doc===s&&i-o.at<gr&&this.studio.canUndo&&this.studio.undo(),this.studio.commit(e),this.lastEdit="structure",this.nudgeBurst={key:t,doc:e,at:i}}handleStudioKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();if(t.key==="Enter"&&this.doorGhost)return t.preventDefault(),this.acceptDoorGhost(),!0;if(t.key==="Enter"&&this.wallDraft)return t.preventDefault(),this.finishWall(),!0;if(t.key==="Enter"&&this.curveDraft)return t.preventDefault(),this.finishCurve(!1),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.curveDraft)return t.preventDefault(),this.curveUndoPoint(),!0;if((t.ctrlKey||t.metaKey)&&this.curveDraft&&(t.key.toLowerCase()==="z"||t.key.toLowerCase()==="y"))return t.preventDefault(),t.key.toLowerCase()==="y"||t.shiftKey?this.curveRedoPoint():this.curveUndoPoint(),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.wallDraft)return t.preventDefault(),this.wallDraft=this.wallDraft.length>1?this.wallDraft.slice(0,-1):null,this.lastDrawClick=null,!0;if(this.tool==="detect"&&(t.key==="Delete"||t.key==="Backspace")&&this.candSel)return t.preventDefault(),(this.candStates[this.candSel]??"accepted")==="accepted"&&this.toggleCandidate(this.candSel),!0;if(this.detectBusy&&e&&(s==="z"||s==="y"))return!0;if((t.key==="Delete"||t.key==="Backspace")&&this.geomSel){t.preventDefault();const{id:i,kind:o,vertex:n}=this.geomSel;if(o==="group")return this.groupDelete=i,!0;const r=o==="connector"?this.studio.doc?.connectors.find(l=>l.id===i):void 0;if(r&&Pt(r))return this.info="המחבר נגזר מעצם: מוחקים או עורכים את העצם עצמו",setTimeout(()=>this.info="",4e3),!0;if(r&&r.floor_ids.length)return this.removeConnector(i),!0;const a=o==="wall"&&n!==void 0?this.studio.doc?.walls.find(l=>l.id===i):void 0,d=a&&n!==void 0?Y(a,n):-1;if(a&&d>=0&&this.bundle){const l=this.bundle,c=this.studio.doc,u=c?ne(c,i,d,l.width,l.height):null;return u&&this.edit(()=>u.doc),this.geomSel=u&&!u.wallRemoved?{id:i,kind:o}:null,!0}if(o==="wall"&&n!==void 0&&this.geomSelectMode){const l=this.studio.doc,c=l?Ci(l,i,n):null;return c&&this.edit(()=>c.doc),this.geomSel=c&&!c.wallRemoved?{id:i,kind:o}:null,!0}return this.edit(l=>V(l,i)),this.geomSel=null,!0}return e&&s==="d"&&this.geomSel?.kind==="object"&&(this.tool==="library"||this.tool==="select")&&this.studio.doc&&!this.geomPreview?(t.preventDefault(),this.duplicateSel(this.geomSel.id),!0):mr.includes(t.key)&&(this.tool==="structure"||this.tool==="library"||this.tool==="select")&&this.nudgeGeom(t)?!0:e&&(s==="z"||s==="y")?(t.preventDefault(),s==="y"||t.shiftKey?this.redoAny():this.undoAny(),!0):e&&s==="s"?(t.preventDefault(),this.studio.flush(),this.tool==="select"&&this.dirty.size&&this.save(),!0):!1}duplicateSel(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;const i=Oi(s,t,e.width,e.height,x(s).scale);i.id!==t&&(this.edit(()=>i.doc),this.geomSel={id:i.id,kind:"object"})}focusGeom(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;this.activeLevel!==null&&!le(s,t,this.activeLevel)&&(this.levelFilter=null),this.multi=[];const i=s.walls.find(c=>c.id===t),o=s.openings.find(c=>c.id===t),n=s.labels.find(c=>c.id===t),r=o?s.walls.find(c=>c.id===o.wall_id):void 0,a=s.objects.find(c=>c.id===t),d=i?A(i,.5,e.width,e.height):o&&r?A(r,o.t,e.width,e.height):n?n.position:a?a.position:null;if(a){this.pickTool("library"),this.geomSel={id:t,kind:"object"},d&&this.canvas?.centerOn(d[0],d[1]);return}const l=s.connectors.find(c=>c.id===t);if(l){this.pickTool("connectors"),this.geomSel={id:t,kind:"connector"};const c=l.polyline[Math.floor(l.polyline.length/2)];c&&this.canvas?.centerOn(c[0],c[1]);return}this.tool="structure",this.studioMode="select",this.wallDraft=null,this.geomSel=i?{id:t,kind:"wall"}:o?{id:t,kind:"opening"}:n?{id:t,kind:"label"}:null,d&&this.canvas?.centerOn(Math.min(1,Math.max(0,d[0])),Math.min(1,Math.max(0,d[1])))}async copyStructure(t){const e=this.bundle;if(e?.planVersionId){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}await Yo(e.planVersionId,t),await this.loadStudio(e,!0)&&(this.info="המבנה הועתק לטיוטה; בדוק מיקומים ופרסם",setTimeout(()=>this.info="",4e3))}catch(s){this.error=$(s)}finally{this.busy=!1}}}takeDxf(t){const e=dn(t);this.presetCandidates="",e&&(this.showCandidates(e,"dxf"),this.pickTool("detect"))}showCandidates(t,e){const s=this.studio.doc;let i=hn(t);if(s&&e==="detect"){const{scale:o}=x(s);(i.scaleMPerPx===null||Math.abs(i.scaleMPerPx-o)>o*1e-6)&&(i=ze(i,o))}this.cands={set:i,result:t,source:e},this.candStates=cn(i),this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}async runDetect(){const e=this.bundle?.planVersionId;if(!e||this.detectRun.busy||this.busy||!this.detectOpts.walls)return;const s=++this.detectToken,i=this.detectRun.limitS,o=Date.now();this.detectRun={busy:!0,startedAt:o,elapsed:0,error:"",timedOut:!1,limitS:i};const n=()=>s===this.detectToken&&this.bundle?.planVersionId===e;clearInterval(this.elapsedTimer),this.elapsedTimer=setInterval(()=>{const r=Math.floor((Date.now()-o)/1e3);s===this.detectToken&&r!==this.detectRun.elapsed&&(this.detectRun={...this.detectRun,elapsed:r})},1e3);try{if(!await this.studio.flush()){n()&&(this.error=this.studio.error);return}if(!n())return;const r=this.detectOpts.openings?["walls","openings"]:["walls"],a=this.detectOpts,d=await Xo(e,{targets:r,strength:a.strength,hollow_walls:a.hollow!==!1,section_lines:a.sectionLines!==!1,join_gaps:a.joinGaps!==!1,steps_regions:a.stepsRegions!==!1,columns:a.columns!==!1});if(!n()||d.version_id!==e)return;this.showCandidates(d,"detect"),this.detectRun={busy:!1,startedAt:0,elapsed:Math.round((Date.now()-o)/1e3),error:"",timedOut:!1,limitS:i}}catch(r){if(!n())return;const a=r instanceof P&&r.code==="detect_timeout",d=r instanceof P?Number(r.body.details?.timeout_s):NaN,l=a&&d>0?d:i;this.detectRun={busy:!1,startedAt:0,elapsed:0,timedOut:a,limitS:l,error:a?`הזיהוי לא הסתיים${l?` תוך ${l} שניות`:" בזמן"}. נסה שוב בעוצמת ניקוי נמוכה יותר (תוכנית גדולה או סריקה רועשת לוקחות זמן).`:$(r)}}finally{s===this.detectToken&&(clearInterval(this.elapsedTimer),this.detectRun.busy&&(this.detectRun={...this.detectRun,busy:!1}))}}toggleCandidate(t){const e=this.cands?.set;if(!e||this.busy)return;const s=(this.candStates[t]??"accepted")==="accepted"?"rejected":"accepted",i={...this.candStates,[t]:s};if(s==="rejected")for(const o of e.openings)o.wall_id===t&&(i[o.id]="rejected");else{const o=e.openings.find(n=>n.id===t);o&&(i[o.wall_id]="accepted")}this.candStates=i,this.candSel=t,this.detectAsk=null}acceptRule(t){const e=this.cands?.set;if(!e||this.busy)return;const s=new Set(Me(e,t));this.candStates=Object.fromEntries(ft(e).map(i=>[i,s.has(i)?"accepted":"rejected"])),this.detectAsk=null}get shownCandStates(){const t=this.cands?.set.objects??[];if(!t.length)return this.candStates;const e=this.candStatesShown;if(e&&e.states===this.candStates&&e.objects===t&&e.on===this.candObjectsOn)return e.shown;const s=this.candObjectsOn?"accepted":"rejected",i={...this.candStates,...Object.fromEntries(t.map(o=>[o.id,s]))};return this.candStatesShown={states:this.candStates,objects:t,on:this.candObjectsOn,shown:i},i}get acceptedCandidateIds(){const t=this.cands?.set;if(!t)return[];const e=Me(t,ft(t).filter(s=>(this.candStates[s]??"accepted")==="accepted"));return this.candObjectsOn?[...e,...t.objects.map(s=>s.id)]:e}focusCandidate(t){const e=this.bundle,s=this.cands?.set;if(!e||!s)return;this.candSel=t;const i=s.walls.find(a=>a.id===t),o=s.openings.find(a=>a.id===t),n=o?s.walls.find(a=>a.id===o.wall_id):void 0,r=i?A(i,.5,e.width,e.height):n&&o?A(n,o.t,e.width,e.height):null;r&&this.canvas?.centerOn(Math.min(1,Math.max(0,r[0])),Math.min(1,Math.max(0,r[1])))}onCandidateDrag(t){const e=this.cands;if(!e||this.narrow||this.busy)return;const s=un(e.set,t.id,t.index,[t.x,t.y]);if(s===e.set)return;const i=s.walls.find(o=>o.id===t.id);i&&(this.cands={...e,set:s},this.candEdits={...this.candEdits,[t.id]:{polyline:i.polyline}},this.candSel=t.id)}discardCandidates(){this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}setSources(t){return new Set([...t.walls,...t.openings,...t.objects].map(e=>e.source))}acceptedSources(){const t=this.cands,e=new Set(this.acceptedCandidateIds),s=new Set;if(!t)return s;for(const i of[...t.set.walls,...t.set.openings,...t.set.objects])e.has(i.id)&&s.add(i.source);return s}replacedIn(t,e){const s=a=>e.has(a.source)&&a.locked!==!0,i=new Set(t.walls.filter(s).map(a=>a.id)),o=new Set(t.walls.filter(a=>!s(a)).map(a=>a.id));let n=0,r=0;for(const a of t.openings)s(a)&&!o.has(a.wall_id)?n+=1:i.has(a.wall_id)&&(r+=1);return{walls:i.size,openings:n,objects:t.objects.filter(s).length,manual:r}}replacePlan(t){if(!this.detectOpts.replaceAuto)return null;const e=this.replacedIn(t,this.acceptedSources());return e.walls+e.openings+e.objects>0?e:null}confirmCandidates(){const t=this.cands,e=this.studio.doc;if(!t||!e||!this.acceptedCandidateIds.length||this.busy)return;const s=this.replacePlan(e);if(s){this.detectAsk={existing:{walls:s.walls,openings:s.openings,objects:s.objects},manualOnAuto:s.manual};return}this.sendAccept()}async sendAccept(){const t=this.bundle,e=this.cands,s=this.acceptedCandidateIds,i=t?.planVersionId;if(!t||!i||!e||!s.length||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="",this.detectErr=null;try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o()||!this.studio.doc)return;const n=this.replacePlan(this.studio.doc)!==null,r=new Set(s),a=Object.fromEntries(Object.entries(this.candEdits).filter(([c])=>r.has(c))),d=await Qo(i,{accepted:s,edits:a,replace_auto:n,candidates:{walls:e.set.walls,openings:e.set.openings,objects:e.set.objects},base_revision:this.studio.revision,detector:e.result.detector});if(o()||(this.studio.adopt(d)||await this.loadStudio(t,!0),o()))return;const l=d.merge;this.discardCandidates(),this.geomSel=null,this.info=`${I(s.length,"פריט אחד נוסף","פריטים נוספו")} לטיוטת המבנה${l?.removed_auto?` · ${l.removed_auto} קודמים הוחלפו`:""}${l?.removed_manual_openings?` · ${I(l.removed_manual_openings,"פתח ידני אחד הוסר","פתחים ידניים הוסרו")} עם הקירות שלהם`:""}; בדוק ופרסם`,setTimeout(()=>this.info="",6e3)}catch(n){if(o())return;const r=this.acceptErrorOf(n);this.detectErr=r,r.ids.length&&this.focusCandidate(r.ids[0])}finally{this.busy=!1,this.detectAsk=null}}acceptErrorOf(t){const e=this.cands?.set,s=new Set(e?[...ft(e),...e.objects.map(l=>l.id)]:[]);if(!(t instanceof P))return{code:"network",message:$(t),ids:[],issues:[],stale:!1};const i=t.body.details??{},o=Array.isArray(i.ids)?i.ids.filter(l=>typeof l=="string"):[],r=(Array.isArray(i.issues)?i.issues:[]).filter(l=>typeof l=="object"&&l!==null).map(l=>({id:typeof l.id=="string"?l.id:null,message:typeof l.message=="string"?l.message:"בעיה במבנה"})),a=[...new Set([...o,...r.map(l=>l.id).filter(l=>!!l)])].filter(l=>s.has(l)),d={stale_revision:"טיוטת המבנה השתנתה בינתיים (עריכה בחלון אחר). טען את הטיוטה מחדש ואשר שוב; המועמדים נשארים.",unknown_candidate:"מועמד שסומן לאישור לא נמצא בין המועמדים שנשלחו; הרץ זיהוי מחדש.",orphan_opening:"פתח סומן לאישור בלי הקיר שלו: קבל גם את הקיר או דחה את הפתח.",candidate_source:"מועמד בלי מקור אוטומטי או מיובא נשלח לאישור; הרץ זיהוי מחדש.",duplicate_candidate:"אותו מועמד נשלח פעמיים; הרץ זיהוי מחדש.",candidate_shape:"צורת מועמד שגויה (למשל פתח בלי מזהה קיר); דחה את המסומנים ברשימה ונסה שוב.",geometry_structure:"המועמדים שנבחרו יוצרים מבנה לא תקין, ודבר לא נשמר. דחה או תקן את המסומנים ונסה שוב."};return{code:t.code,message:d[t.code]??$(t),ids:a,issues:r,stale:t.code==="stale_revision"}}async reloadForDetect(){const t=this.bundle;if(!(!t||this.busy)){this.busy=!0;try{await this.loadStudio(t,!0)&&(this.detectErr=null)}finally{this.busy=!1}}}get canEstimate(){return this.studio.doc?.dimensions.calibration?.status!=="measured"}rescaleCandidates(){const t=this.studio.doc,e=this.cands;t&&e&&e.source==="detect"&&(this.cands={...e,set:ze(e.set,x(t).scale)})}async applyCalibHint(){const t=this.bundle,e=this.cands,s=e?.result.calibration_hint,i=t?.planVersionId;if(!t||!i||!e||!s||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="";try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o())return;if(!this.canEstimate){this.error="לתוכנית כבר יש כיול מדוד; ההערכה לא הוחלה.";return}const n=await tn(i,s.scale_m_per_px,s.reason);if(o()||!this.bundle||(this.bundle={...this.bundle,scaleMPerPx:n.scale_m_per_px},!await this.loadStudio(this.bundle,!0)||o()))return;this.rescaleCandidates(),this.hintApplied=!0,this.info=`קנה מידה משוער נשמר: ≈ ${Se(n.scale_m_per_px)}`,setTimeout(()=>this.info="",4e3)}catch(n){if(o()||!this.bundle)return;n instanceof P&&n.code==="calibration_measured"?(this.error="לתוכנית כבר יש כיול מדוד (כנראה מחלון אחר); הערכה לא מחליפה אותו. המידות לפי הכיול הקיים.",await this.loadStudio(this.bundle,!0)&&!o()&&this.rescaleCandidates()):this.error=$(n)}finally{this.busy=!1}}async importDxfRooms(){const t=this.bundle,e=this.cands?.result.rooms??[];if(!(!t||!e.length||this.busy)){this.busy=!0;try{const s=await $e(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name})),!1);this.zones=s.zones,this.cands=this.cands?{...this.cands,result:{...this.cands.result,rooms:[]}}:null,this.info=`${I(e.length,"חדר אחד נוסף","חדרים נוספו")} כאזורים; תן להם שמות בכלי "חדרים ואזורים"`,setTimeout(()=>this.info="",4e3)}catch(s){this.error=$(s)}finally{this.busy=!1}}}renderDetectTool(t){const e=this.studio.doc;if(!e||!t.planVersionId)return h`<sw-card heading="זיהוי אוטומטי" data-detect-panel><div class="note">${t.source==="demo"?"נתוני הדגמה: הזיהוי עובד מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=this.cands;return fo({opts:this.detectOpts,run:this.detectRun,cands:o?{source:o.source,set:o.set,states:this.candStates,sel:this.candSel,hint:o.result.calibration_hint,existingAuto:this.replacedIn(e,this.setSources(o.set)),elapsedMs:o.result.elapsed_ms??null,rooms:o.result.rooms?.length??0,ifc:o.result.ifc??null}:null,acceptedCount:this.acceptedCandidateIds.length,objectsOn:this.candObjectsOn,hintApplied:this.hintApplied,canEstimate:this.canEstimate,busy:this.busy,narrow:this.narrow,estimated:i,showEstimates:this.showEstimates,scale:s,autoInDraft:e.walls.filter(n=>n.source==="auto").length+e.openings.filter(n=>n.source==="auto").length,ask:this.detectAsk,acceptError:this.detectErr},{setOpts:n=>{this.detectOpts=n,this.detectAsk=null},run:()=>void this.runDetect(),retryLighter:()=>{this.detectOpts={...this.detectOpts,strength:Zo(this.detectOpts.strength)},this.runDetect()},acceptAll:()=>{o&&this.acceptRule(ft(o.set))},acceptAbove:n=>{o&&this.acceptRule(fn(o.set,n))},acceptKinds:n=>{o&&this.acceptRule(pn(o.set,n))},rejectAll:()=>{this.acceptRule([]),this.busy||(this.candObjectsOn=!1)},toggle:n=>this.toggleCandidate(n),focus:n=>this.focusCandidate(n),setObjects:n=>{this.candObjectsOn=n,this.detectAsk=null},confirm:()=>this.confirmCandidates(),confirmReplace:()=>void this.sendAccept(),cancelReplace:()=>this.detectAsk=null,reload:()=>void this.reloadForDetect(),discard:()=>this.discardCandidates(),applyHint:()=>void this.applyCalibHint(),importRooms:()=>void this.importDxfRooms()})}exportJson(){const t=this.studio.doc;if(!t)return;const e=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:"application/json"})),s=document.createElement("a");s.href=e,s.download=`plan-structure-${t.plan_version_id}.json`,s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}async importIfc(t){const e=this.bundle;if(!e?.planVersionId||this.busy)return;const s=e.planVersionId;this.busy=!0,this.error="",this.info=Tt("reading");try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await en(s,t,{levelId:this.activeLevel??void 0});if(this.bundle?.planVersionId!==s)return;this.showCandidates(i,"ifc"),this.pickTool("detect");const o=i.walls.length+i.openings.length+(i.objects?.length??0)+(i.rooms?.length??0);this.info=o?Tt("loaded"):Tt("nothing"),setTimeout(()=>this.info="",4e3)}catch(i){this.info="",this.error=$(i)}finally{this.busy=!1}}async exportPackage(t=!1){const e=this.bundle;if(!(!e?.planVersionId||this.busy)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const{blob:s,name:i}=await sn(e.planVersionId,!0,{dxf:t}),o=URL.createObjectURL(s),n=document.createElement("a");n.href=o,n.download=i,n.click(),setTimeout(()=>URL.revokeObjectURL(o),1e3),this.info=_("saved"),setTimeout(()=>this.info="",3e3)}catch(s){this.error=$(s)}finally{this.busy=!1}}}async startPackageImport(t){if(this.bundle?.planVersionId){if(!await this.studio.flush()){this.error=this.studio.error;return}this.pkgImport={file:t,mode:"replace",preview:null,busy:null,error:"",acceptForeign:!1,foreign:null},await this.previewPackage("replace")}}async previewPackage(t){const e=this.pkgImport,s=this.bundle?.planVersionId;if(!(!e||!s||e.busy)){this.pkgImport={...e,mode:t,busy:"check",error:"",preview:e.mode===t?e.preview:null};try{const i=await on(s,e.file,t,e.acceptForeign);this.pkgImport?.file===e.file&&(this.pkgImport={...this.pkgImport,preview:i,busy:null})}catch(i){const o=i instanceof P&&i.code==="package_foreign"?i.body.details?.origin??null:null;this.pkgImport?.file===e.file&&(this.pkgImport=o?{...this.pkgImport,preview:null,busy:null,error:"",foreign:o,acceptForeign:!1}:{...this.pkgImport,preview:null,busy:null,error:$(i)})}}}setPackageTrust(t){const e=this.pkgImport;e&&(this.pkgImport={...e,acceptForeign:t},t&&!e.preview&&e.foreign&&this.previewPackage(e.mode))}async confirmPackageImport(){const t=this.pkgImport,e=this.bundle;if(!(!t?.preview||!e?.planVersionId||t.busy)){this.pkgImport={...t,busy:"import",error:""};try{await nn(e.planVersionId,t.file,t.preview,t.acceptForeign),this.pkgImport=null,await this.loadStudio(e,!0)&&(this.info=_("imported"),setTimeout(()=>this.info="",4e3))}catch(s){this.pkgImport?.file===t.file&&(this.pkgImport={...this.pkgImport,busy:null,error:$(s)})}}}renderStructurePanel(t,e=!1){const s=this.studio.doc,i=t.planVersionId;return!s||!i?h`<sw-card heading="מבנה"><div class="note">${t.source==="demo"?"נתוני הדגמה: ציור המבנה עובד מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`:go({doc:this.geomPreview??s,W:t.width,H:t.height,mode:e?"select":this.studioMode,wallDefaults:this.wallDefaults,glassDraw:this.glassDraw,sel:this.geomSel,saveState:this.studio.saveState,saveError:this.studio.error,compact:e,conflict:this.studio.hasConflict,issues:this.studio.issues,copyCandidates:this.studio.copyCandidates,exportSvg:pt(i,"svg",{draft:!0}),exportPng:pt(i,"png",{draft:!0}),exportDxf:pt(i,"dxf",{draft:!0}),exportIfc:pt(i,"ifc",{draft:!0}),busy:this.busy,showEstimates:this.showEstimates,levels:s.levels,phone:this.phone.matches,entityChoices:this.anchors.filter(o=>o.resource_type==="ha_entity"&&/^(binary_sensor|cover|lock)\./.test(o.resource_id)).map(o=>({id:o.resource_id,name:o.label||o.entity?.name||o.resource_id})).sort((o,n)=>o.name<n.name?-1:o.name>n.name?1:0),materials:this.resolvedMaterials(this.geomPreview??s),materialStyle:this.matStyle},{setMaterial:(o,n,r)=>this.edit(a=>j(ye(a,o,n,r))),setMaterialStyle:o=>this.matStyle=o,setMode:o=>{if((xe.includes(o)||o==="curve")&&this.phone.matches){this.info="ציור קירות זמין בדסקטופ בלבד; בטלפון אפשר להציב ולהזיז עצמים בודדים",setTimeout(()=>this.info="",4e3);return}this.studioMode=o,this.dropDoorGhost(),this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,o!=="select"&&o!=="curve"&&(this.geomSel?.vertex!==void 0||this.geomSel?.segment!==void 0)&&(this.geomSel={id:this.geomSel.id,kind:this.geomSel.kind})},setWallDefaults:o=>{this.wallDefaults=o},setGlassDraw:o=>{o.curved!==this.glassDraw.curved&&(this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null),this.glassDraw=o},addCurvePoint:o=>{const n=this.studio.doc,r=n?As(n,o,t.width,t.height):null;if(!r)return;this.edit(()=>r.doc);const a=this.studio.doc?.walls.find(l=>l.id===o),d=a?ue(a):null;this.geomSel={id:o,kind:"wall",...d?{vertex:d[r.k]}:{}}},removeCurvePoint:(o,n)=>{const r=this.studio.doc,a=r?ne(r,o,n,t.width,t.height):null;a&&(this.edit(()=>a.doc),this.geomSel=a.wallRemoved?null:{id:o,kind:"wall"})},patchWall:(o,n)=>this.edit(r=>st(r,o,n)),patchOpening:(o,n)=>this.edit(r=>vt(r,o,n)),patchLabel:(o,n)=>this.edit(r=>et(r,o,n)),remove:o=>{this.edit(n=>V(n,o)),this.geomSel=null},focus:o=>this.focusGeom(o),copyFrom:o=>void this.copyStructure(o),exportJson:()=>this.exportJson(),exportPackage:o=>void this.exportPackage(o===!0),importPackage:o=>void this.startPackageImport(o),importIfc:o=>void this.importIfc(o),reload:()=>void this.loadStudio(t,!0),calibrate:()=>this.pickTool("calibrate"),retry:async()=>{await this.studio.flush()&&this.loadStudio(t)},setLevel:(o,n)=>{this.edit(r=>r.walls.some(a=>a.id===o)?st(r,o,{level_id:n}):et(r,o,{level_id:n})),this.followLevel(o,n)},setSegmentRadius:(o,n,r)=>{const a=x(s).scale;if(r===null)return this.edit(c=>Cs(c,o,n,t.width,t.height));const d=this.studio.doc,l=d?Os(d,o,n,r,a,t.width,t.height):null;l?this.edit(()=>l):this.flashError(O("radiusTooSmall"))},roundCorner:(o,n,r)=>{const a=this.studio.doc,d=a?Ts(a,o,n,r,x(a).scale,t.width,t.height):null;if(!d)return this.flashError(O("cornerCannot"));this.edit(()=>d),this.geomSel={id:o,kind:"wall"}},say:o=>{this.info=o,setTimeout(()=>this.info===o?this.info="":void 0,4e3)}})}renderLibraryTool(t,e=!1){const s=this.studio.doc,i=this.library;if(!s||!i||!t.planVersionId)return h`<sw-card heading="ספריית עצמים"><div class="note">${t.source==="demo"?"נתוני הדגמה: הספרייה נטענת מהשרת.":this.error||"טוען את הספרייה…"}</div></sw-card>`;const{estimated:o}=x(s),n=t.permissions.structure,r=this.geomSel?.kind==="object"?s.objects.find(l=>l.id===this.geomSel.id):void 0,a=l=>{const c=l.anchor_ref&&this.anchors.find(u=>u.resource_type===l.anchor_ref.resource_type&&u.resource_id===l.anchor_ref.resource_id);return c?this.anchorName(c):null},d=this.geomSel?.kind==="group"?s.groups.find(l=>l.id===this.geomSel.id):void 0;return h`${d?mo(d,L(i,String(d.params.item_id??"")),{select:l=>this.geomSel={id:l,kind:"object"},askDelete:l=>this.groupDelete=l}):p}${r?vo({o:r,item:L(i,r.item_id),levels:s.levels,doc:s,estimated:o,showEstimates:this.showEstimates,anchorName:a(r),phone:this.phone.matches,canManage:n,lib_category:l=>i.categories.find(c=>c.id===l.category)?.he??l.category,materialDefault:this.resolvedMaterials(s).objects[r.id]??"plastic",materialStyle:this.matStyle},{setMaterial:(l,c)=>this.edit(u=>j(ye(u,"objects",l,c))),setMaterialStyle:l=>this.matStyle=l,patch:(l,c)=>{this.edit(u=>X(u,l,c)),c.level_id!==void 0&&this.followLevel(l,c.level_id)},unbind:l=>this.edit(c=>X(c,l,{anchor_ref:null})),remove:l=>{this.edit(c=>V(c,l)),this.geomSel=null},array:l=>this.openArray(l),custom:l=>this.openCustom(l),duplicate:l=>this.duplicateSel(l),selectGroup:l=>this.geomSel={id:l,kind:"group"}}):p}
    ${e?h`<div class="note" data-studio-save=${this.studio.saveState}>${wo[this.studio.saveState]}</div>`:bo({lib:i,q:this.libQ,category:this.libCategory,recent:this.libRecent,favorites:this.libFav,placing:this.placingItem,saveState:this.studio.saveState,phone:this.phone.matches,exportHref:bn(),canManage:n},{setQuery:l=>this.libQ=l,setCategory:l=>this.libCategory=l,pick:l=>{this.placingItem=this.placingItem?.id===l.id?null:l,this.geomSel=null,this.bindOffer=null},toggleFavorite:l=>{this.libFav=this.libFav.includes(l)?this.libFav.filter(c=>c!==l):[...this.libFav,l],Fe("sw.studio.fav",this.libFav)},importFile:l=>void this.importLibrary(l),cancelPlacing:()=>this.placingItem=null})}`}get rulers(){const t=this.bundle,e=this.studio.doc;if(!t||!e)return[];const{scale:s,estimated:i}=x(e),o=(n,r)=>ut(ce(n,r,t.width,t.height,s),i,this.showEstimates);if(this.tool==="connectors"&&this.connStart&&this.hover)return[{a:this.connStart,b:this.hover,label:this.connMode?yo[this.connMode]:"",tone:"muted"}];if(this.tool==="walk"){const n=this.activeLevel,r=(e.walk_positions??[]).filter(a=>!n||a.level_id===n).map(a=>({...De(a,t.width,t.height),label:a.name,tone:this.walkFocus===a.id?"accent":"muted"}));return this.walkArmed&&this.hover&&r.push({...De({x:this.hover[0],y:this.hover[1],heading_deg:0},t.width,t.height),label:"",tone:"accent"}),r}if(this.tool==="calibrate"){const{a:n,b:r,metres:a}=this.calib,d=r??this.hover;return!n||!d?[]:[{a:n,b:d,label:r?parseFloat(a)>0?`${a} מ׳`:"? מ׳":"",tone:r?"accent":"muted"}]}if(this.tool==="measure"){const n=this.measurePts,r=this.hover&&n.length?[...n,this.hover]:n,a=[];for(let d=1;d<r.length;d++)a.push({a:r[d-1],b:r[d],label:o(r[d-1],r[d]),tone:d>n.length-1?"muted":"accent"});return n.length>=3&&a.push({a:n[n.length-1],b:n[0],label:"",tone:"muted"}),a}return[]}addCalibPair(){const{a:t,b:e,metres:s,pairs:i}=this.calib,o=parseFloat(s);!t||!e||!(o>0)||i.length>=3||(this.calib={...this.calib,a:null,b:null,metres:"",pairs:[...i,{a:t,b:e,metres:o}]})}async saveCalibration(){const t=this.bundle,{a:e,b:s,metres:i,pairs:o}=this.calib,n=parseFloat(i),r=[...o,...e&&s&&n>0?[{a:e,b:s,metres:n}]:[]];if(!(!t?.planVersionId||!r.length)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const a=await rn(t.planVersionId,r);await this.loadStudio(t,!0);const d=r.length>1&&a.residual_pct!==null?` · ${r.length} זוגות, סטייה ${a.residual_pct.toFixed(1)}%`:"";this.calib={...B,result:`קנה המידה נשמר: ${Se(a.scale_m_per_px)}${d}`,warning:a.warning??""}}catch(a){this.error=$(a)}finally{this.busy=!1}}}async loadSideData(t){t.planVersionId&&t.permissions.structure?an(t.planVersionId).then(e=>{this.bundle===t&&(this.geomVersions=e.versions)},()=>{this.geomVersions=[]}):this.geomVersions=[],ms(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.areas=e.areas)},()=>{this.areas=[]}),Vn(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.floorImages=e,this.alignDraft=null)},()=>{this.floorImages=null})}async rollbackStructure(t){const e=this.bundle;if(!(!e?.planVersionId||!t.id)&&window.confirm(`לשחזר את המבנה שפורסם ב-${K(t.published_at)}? המבנה הנוכחי נשמר בהיסטוריה.`)){this.busy=!0,this.error="";try{await ln(e.planVersionId,t.id),this.info="המבנה שוחזר ופורסם; הצופים רואים אותו עכשיו",setTimeout(()=>this.info="",4e3),await this.loadStudio(e,!0),await this.loadVersions()}catch(s){this.error=$(s)}finally{this.busy=!1}}}renderStructureHistory(t){if(!t.permissions.structure||!this.geomVersions.length)return p;const e=s=>[s.walls?`${s.walls} קירות`:"",s.openings?`${s.openings} פתחים`:"",s.objects?`${s.objects} עצמים`:"",s.connectors?`${s.connectors} מחברים`:""].filter(Boolean).join(" · ")||"מבנה ריק";return h`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית המבנה<span class="muted">כל פרסום של קירות, פתחים ועצמים נשמר; שחזור מפרסם מחדש גרסה מהארכיון כגרסה חדשה</span></span></div>
      <div class="vlist" data-geom-version-list>
        ${this.geomVersions.map(s=>h`<div class="vrow ${s.status==="published"?"cur":""}" data-geom-version-row data-geom-version-id=${s.id??""} data-geom-version-status=${s.status}>
          <div class="meta">
            <span><sw-badge kind=${s.status==="published"?"recorded":"neutral"} label=${s.status==="published"?"מפורסם":"ארכיון"}></sw-badge> <span class="ltr">${K(s.published_at??s.created_at)}</span>${s.archived_at?h` <span class="note">עד ${K(s.archived_at)}</span>`:p}</span>
            <span class="note">${e(s.counts)}${s.published_by?` · ${s.published_by}`:""}</span>
          </div>
          <div class="acts">
            ${s.status==="archived"&&t.permissions.publish?h`<sw-button size="sm" icon="history" data-geom-rollback ?disabled=${this.busy} @click=${()=>void this.rollbackStructure(s)}>שחזר מבנה</sw-button>`:p}
          </div>
        </div>`)}
      </div>`}async uploadImage(t,e){const s=this.bundle,i=e.files?.[0];if(e.value="",!(!s||!i)){this.imageBusy=!0,this.imageNote="";try{await Un(s.floorId,t,i),this.imageNote=t==="off"?"תמונת הקומה נשמרה":"תמונת התאורה נשמרה",await this.loadSideData(s),await this.load()}catch(o){this.imageNote=$(o)}finally{this.imageBusy=!1}}}async removeImage(t){const e=this.bundle;if(!(!e||!window.confirm(t==="off"?"להסיר את תמונת הקומה?":"להסיר את תמונת התאורה?"))){this.imageBusy=!0;try{await Wn(e.floorId,t),this.imageNote="התמונה הוסרה",await this.loadSideData(e),await this.load()}catch(s){this.imageNote=$(s)}finally{this.imageBusy=!1}}}async saveAlignment(){const t=this.bundle,e=this.alignDraft;if(!(!t||!e)){this.imageBusy=!0;try{const s=await Kn(t.floorId,e.corners,e.opacity);this.floorImages=this.floorImages?{...this.floorImages,layout:s}:this.floorImages,this.alignDraft=null,this.imageNote="היישור נשמר",await this.load()}catch(s){this.imageNote=$(s)}finally{this.imageBusy=!1}}}renderFloorImages(t){if(t.source==="demo"||!t.permissions.edit||this.phone.matches)return p;const e=this.floorImages,s=e?.images.off??null,i=e?.images.on??null,o=e?.layout,n=this.alignDraft??(o?{corners:o.corners,opacity:o.opacity}:null),r=!!this.alignDraft,a=(l,c,u,v)=>h`<div class="row" data-floor-image-row=${l}>
      <span class="lbl">${u}<span class="muted">${c?`${c.width}×${c.height} · ${Math.round(c.bytes/1024)} KB`:v}</span></span>
      <span class="btns" style="margin:0">
        <label class="upl"><input type="file" accept="image/png,image/jpeg" data-floor-image-input=${l} ?disabled=${this.imageBusy} @change=${w=>void this.uploadImage(l,w.target)} /><sw-button size="sm" icon="upload" ?disabled=${this.imageBusy} @click=${w=>w.currentTarget.closest("label")?.querySelector("input")?.click()}>${c?"החלף":"העלה"}</sw-button></label>
        ${c?h`<sw-button size="sm" variant="ghost" icon="trash" data-floor-image-delete=${l} ?disabled=${this.imageBusy} @click=${()=>void this.removeImage(l)}>הסר</sw-button>`:p}
      </span>
    </div>`,d=this.studio.doc?.walls.map(l=>Ai(l,t.width,t.height)).flatMap(l=>l.slice(1).map((c,u)=>[[l[u][0],l[u][1]],[c[0],c[1]]]))??[];return h`<sw-card heading="תמונת הקומה" subheading="תמונה של הקומה מכל מקור (הדמיה, תוכנית צבעונית, צילום מודל); ממוקמת פעם אחת ומוצגת במפה מתחת למצבי החדרים" data-floor-images>
      ${a("off",s,"תמונה בסיסית","PNG או JPEG עד 12 MB; מוצגת תמיד")}
      ${a("on",i,"תמונה עם תאורה","אופציונלי: אותה תמונה עם אורות; מוצגת רק בחדרים שהתאורה בהם דלוקה")}
      ${s||i?h`<div class="row" style="margin-block-start:8px"><span class="lbl">יישור על התוכנית<span class="muted">גרור את הפינות אל פינות הקומה בתוכנית (או את התמונה כולה); מקשי החצים מכוונים פינה מסומנת</span></span>
            <label class="chk"><input type="checkbox" .checked=${this.alignShowPlan} @change=${l=>this.alignShowPlan=l.target.checked} /> הצג את תוכנית הרקע</label></div>
          <sw-floor-image-align data-floor-image-align .planWidth=${t.width} .planHeight=${t.height} .planUrl=${t.imageUrl} .showPlan=${this.alignShowPlan} .imageUrl=${Hn(s??i)}
            .corners=${n?.corners??[[0,0],[1,0],[1,1],[0,1]]} .opacity=${n?.opacity??1} .rooms=${this.zones.map(l=>({id:l.id,polygon:l.polygon}))} .walls=${d} ?disabled=${this.imageBusy}
            @corners-change=${l=>this.alignDraft={corners:l.detail.corners,opacity:n?.opacity??1}}></sw-floor-image-align>
          <div class="two">
            <sw-field label="שקיפות התמונה במפה"><input type="range" min="0.2" max="1" step="0.05" data-ltr data-floor-image-opacity .value=${String(n?.opacity??1)} @input=${l=>this.alignDraft={corners:n?.corners??[[0,0],[1,0],[1,1],[0,1]],opacity:parseFloat(l.target.value)}} /></sw-field>
            <div class="btns" style="align-items:flex-end">
              <sw-button variant="primary" size="sm" icon="check" data-floor-image-save ?disabled=${!r||this.imageBusy} @click=${()=>void this.saveAlignment()}>שמור יישור</sw-button>
              <sw-button variant="ghost" size="sm" data-floor-image-reset ?disabled=${this.imageBusy||!r&&Ps(o?.corners)} @click=${()=>this.alignDraft={corners:[[0,0],[1,0],[1,1],[0,1]],opacity:1}}>אפס</sw-button>
            </div>
          </div>`:p}
      ${this.imageNote?h`<div class="note" data-floor-image-note role="status">${this.imageNote}</div>`:p}
      <div class="note">התמונה נשמרת במתקן בלבד ונכללת בגיבוי; שום דבר לא נשלח החוצה. תמונה בפרספקטיבה (צילום) מיושרת בקירוב - עדיף רינדור ישר מלמעלה או איזומטרי.</div>
    </sw-card>`}renderCalibrate(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="כיול קנה מידה"><div class="note">${t.source==="demo"?"נתוני הדגמה: הכיול עובד מול השרת.":"טוען…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=this.calib,n=o.a&&o.b?Math.hypot((o.b[0]-o.a[0])*t.width,(o.b[1]-o.a[1])*t.height):null,r=a=>Math.hypot((a.b[0]-a.a[0])*t.width,(a.b[1]-a.a[1])*t.height);return h`${$o({a:o.a,b:o.b,metres:o.metres,pixels:n,scale:s,estimated:i,showEstimates:this.showEstimates,result:o.result,warning:o.warning,busy:this.busy,pairs:o.pairs.map(a=>({metres:a.metres,pixels:r(a)}))},a=>{this.calib={...this.calib,metres:a}},()=>void this.saveCalibration(),()=>{this.calib={...B}},()=>this.addCalibPair(),a=>{this.calib={...this.calib,pairs:this.calib.pairs.filter((d,l)=>l!==a)}})}${ko({northDeg:e.north_deg??null,site:this.site,nowMs:Date.now(),disabled:!t.permissions.structure},{set:a=>this.edit(d=>j(Ri(d,a)))})}`}resolvedMaterials(t){const e=this.library;if(this.matMemo&&this.matMemo.doc===t&&this.matMemo.lib===e)return this.matMemo.out;const s=$n(t,e?yn(e):void 0);return this.matMemo={doc:t,lib:e,out:s},s}renderRoomMaterial(t){const e=this.studio.doc,s=this.bundle;if(!e||!s?.permissions.structure||s.source!=="api")return p;const i=e.rooms.find(a=>a.id===t.id),o=this.resolvedMaterials(e),n=t.level_id??T(e),r=o.rooms[t.id]?.floor??o.levels[n]?.floor??"concrete";return xo({key:`rooms:${t.id}`,label:"חומר הרצפה",host:"floor",value:i?.floor_material_id??null,defaultId:r,style:this.matStyle},{pick:a=>this.edit(d=>j(Zi(d.rooms.some(l=>l.id===t.id)?d:{...d,rooms:[...d.rooms,{id:t.id,level_id:t.level_id??null}]},"rooms",t.id,"floor_material_id",a))),setStyle:a=>this.matStyle=a})}placeWalkPosition(t,e){const s=this.walkArmed;if(!s)return;const i=t.walk_positions??[],o=s==="new"?null:i.find(r=>r.id===s),n=o?{...o,x:W(e[0]),y:W(e[1])}:{id:ge(),name:_o(i),x:W(e[0]),y:W(e[1]),level_id:this.activeLevel??T(t),heading_deg:0};this.edit(r=>j(we(r,n))),this.walkArmed=null,this.walkFocus=n.id,this.hover=null}renderWalkTool(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="עמדות סיור"><div class="note">${t.source==="demo"?"נתוני הדגמה: העמדות נשמרות מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=(n,r)=>this.edit(a=>{const d=(a.walk_positions??[]).find(l=>l.id===n);return d?j(we(a,r(d))):a});return So({positions:e.walk_positions??[],levels:e.levels,W:t.width,H:t.height,scale:s,estimated:i&&this.showEstimates,armed:this.walkArmed,focused:this.walkFocus,disabled:!t.permissions.structure},{arm:n=>{this.walkArmed=n,this.hover=null},rename:(n,r)=>{r.trim()&&o(n,a=>({...a,name:r}))},setLevel:(n,r)=>o(n,a=>({...a,level_id:r})),setHeading:(n,r)=>o(n,a=>({...a,heading_deg:r})),setDefault:n=>o(n,r=>({...r,is_default:!r.is_default})),move:(n,r)=>this.edit(a=>j(Gi(a,n,r))),remove:n=>{this.edit(r=>j(Bi(r,n))),this.walkFocus===n&&(this.walkFocus=null),this.walkArmed===n&&(this.walkArmed=null)},goTo:n=>{const r=(this.studio.doc?.walk_positions??[]).find(a=>a.id===n);r&&(this.activeLevel!==null&&this.activeLevel!==r.level_id&&(this.levelFilter=r.level_id),this.walkFocus=n,this.canvas?.centerOn(r.x,r.y))}})}renderMeasure(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="מדידה"><div class="note">${t.source==="demo"?"נתוני הדגמה: המדידה עובדת מול השרת.":"טוען…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e);return Do(this.measurePts,t.width,t.height,s,i,this.showEstimates,()=>{this.measurePts=[]})}renderCoverage(t){const e=t.coverage_polygon,s=t.coverage_radius??0,i=Math.round((s||.1)*100),o=()=>{const n=t.field_of_view_degrees??90,r=s||.1,a=this.bundle&&this.bundle.height?this.bundle.width/this.bundle.height:1,d=[[t.position.x,t.position.y]],l=Math.max(3,Math.round(n/15));for(let c=0;c<=l;c++){const u=(t.rotation_degrees-n/2+n*c/l-90)*Math.PI/180;d.push([+Math.max(0,Math.min(1,t.position.x+Math.cos(u)*r)).toFixed(4),+Math.max(0,Math.min(1,t.position.y+Math.sin(u)*r*a)).toFixed(4)])}this.apply(t.id,{coverage_polygon:d})};return h`<div class="row" data-coverage style="flex-direction:column;align-items:stretch;gap:6px">
      <span class="lbl">שטח כיסוי${e?" · מצולע ידני":""}<span class="muted">${e?`${e.length} נקודות · גרירה מזיזה, לחיצה על נקודת אמצע מוסיפה, לחיצה כפולה מסירה`:"שני מחוונים נפרדים לגמרי זה מזה: רוחב (כמה ימינה ושמאלה, שווה לשני הצדדים) ומרחק (עד איפה המצלמה רואה). אפשר גם לגרור את הידיות על המפה."}</span></span>
      ${e?p:h`<label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-width>רוחב
          <input type="range" min="10" max="180" step="1" style="flex:1" .value=${String(Math.round(t.field_of_view_degrees??90))} aria-label="רוחב שדה הראייה" @input=${n=>this.apply(t.id,{field_of_view_degrees:Number(n.target.value)})} />
          <span class="ltr" style="min-inline-size:64px">${Math.round((t.field_of_view_degrees??90)/2)}° לכל צד</span></label>
        <label class="note" style="display:flex;gap:8px;align-items:center" data-coverage-distance>מרחק
          <input type="range" min="2" max="100" step="1" style="flex:1" .value=${String(i)} aria-label="מרחק ראייה" @input=${n=>this.apply(t.id,{coverage_radius:Number(n.target.value)/100})} />
          <input type="number" step="1" min="2" max="100" data-ltr data-coverage-radius style="inline-size:56px" .value=${String(i)} aria-label="מרחק ראייה, אחוז מדויק" @change=${n=>this.apply(t.id,{coverage_radius:Math.min(1,Math.max(.02,Number(n.target.value)/100))})} />
          <span class="ltr" style="min-inline-size:24px">%</span></label>`}
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${e?h`<sw-button size="sm" icon="undo" data-coverage-cone @click=${()=>this.apply(t.id,{coverage_polygon:null})}>חזרה לקשת</sw-button>`:h`${s?h`<sw-button size="sm" variant="ghost" @click=${()=>this.apply(t.id,{coverage_radius:null})}>מרחק לברירת מחדל</sw-button>`:p}
            <sw-button size="sm" icon="edit" data-coverage-polygon @click=${o}>כיסוי ידני (מצולע)</sw-button>`}
      </div>
    </div>`}renderMount(t,e){const s=kn[xn(t)],i=(o,n,r)=>{if(o.trim()==="")return null;const a=Number(o);return Number.isFinite(a)?Math.min(r,Math.max(n,a)):null};return h`<div class="two" data-anchor-3d>
      <sw-field label="גובה התקנה (מ׳)" hint=${`ברירת מחדל ${s.mount_height_m} מ׳ · לתצוגת התלת-ממד`}><input type="number" step="0.1" min="0" max="30" data-ltr data-anchor-mount placeholder=${String(s.mount_height_m)} .value=${ie(t.mount_height_m==null?"":String(t.mount_height_m))} @change=${o=>this.apply(t.id,{mount_height_m:i(o.target.value,0,30)})} /></sw-field>
      ${e?h`<sw-field label="הטיה (°)" hint=${`ברירת מחדל ${s.tilt_deg}° · חיובי = מטה`}><input type="number" step="any" min="-90" max="90" data-ltr data-anchor-tilt placeholder=${String(s.tilt_deg)} .value=${ie(t.tilt_deg==null?"":String(t.tilt_deg))} @change=${o=>this.apply(t.id,{tilt_deg:i(o.target.value,-90,90)})} /></sw-field>`:p}
    </div>`}renderCameraInspector(t){const e=t.camera,s=t.field_of_view_degrees??0;return h`<sw-card heading="הגדרות מצלמה" subheading="גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת">
      <div class="kv"><span class="k">מצלמה</span><strong>${this.anchorName(t)}</strong></div>
      <div class="kv"><span class="k">מקור</span><span class="ltr">${e?`NVR · ch ${e.channel}`:t.resource_id}</span></div>
      <sw-field label="כיוון מבט (°)" style="margin-block-start:10px"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(t.rotation_degrees))} @change=${i=>this.apply(t.id,{rotation_degrees:(Number(i.target.value)%360+360)%360})} /></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(i.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(i.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-anchor-level @change=${i=>this.apply(t.id,{level_id:i.target.value||null})}>${this.studio.doc.levels.map(i=>h`<option value=${i.id} ?selected=${(t.level_id??T(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:p}
      <sw-field label="תווית (אופציונלי)"><input .value=${t.label??""} @change=${i=>this.apply(t.id,{label:i.target.value||null})} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${i=>this.apply(t.id,{label_pos:i.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([i,o])=>h`<option value=${i} ?selected=${(t.label_pos??"auto")===i}>${o}</option>`)}</select></sw-field>
      ${this.renderMount(t,!0)}
      ${s?this.renderCoverage(t):p}
      <div class="row"><span class="lbl">הצג כיסוי משוער<span class="muted">זווית לתכנון, לא מדידת כיסוי בפועל</span></span><sw-toggle ?checked=${!!s} label=${s?"מוצג":"מוסתר"} @click=${()=>this.apply(t.id,{field_of_view_degrees:s?null:90})}></sw-toggle></div>
      <div class="row"><span class="lbl">0° = למעלה, עם כיוון השעון<span class="muted">שינוי כיוון במפה אינו פקודת PTZ למצלמה</span></span></div>
      <div class="note" style="margin-block-start:6px">revision ${t.revision}${this.dirty.has(t.id)?" · שינויים לא שמורים":""} · חצים = הזזה עדינה (Shift = גדולה) · Delete = הסרה</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`}renderEntityInspector(t){const e=t.entity;return h`<sw-card heading="הגדרות ישות" subheading="הצבה בלבד; שליטה דורשת הרשאה נפרדת">
      <div class="kv"><span class="k">ישות</span><strong>${this.anchorName(t)}</strong></div>
      <div class="kv"><span class="k">מזהה</span><span class="ltr">${t.resource_id}</span></div>
      ${e?h`<div class="kv"><span class="k">מצב עכשיו</span><span>${ee(e)}</span></div><div class="kv"><span class="k">סוג</span><span>${se(e.domain)}</span></div>`:p}
      <sw-field label="שכבה" style="margin-block-start:8px"><select @change=${s=>this.apply(t.id,{layer_id:s.target.value})}>${Re.filter(s=>s.id!=="cameras").map(s=>h`<option value=${s.id} ?selected=${t.layer_id===s.id}>${s.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(s.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(s.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-anchor-level @change=${s=>this.apply(t.id,{level_id:s.target.value||null})}>${this.studio.doc.levels.map(s=>h`<option value=${s.id} ?selected=${(t.level_id??T(this.studio.doc))===s.id}>${s.name}</option>`)}</select></sw-field>`:p}
      <sw-field label="שם במפה (ידני)"><input data-entity-name placeholder=${e?.name??t.resource_id} .value=${t.label??""} @change=${s=>this.apply(t.id,{label:s.target.value.trim()||null})} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${s=>this.apply(t.id,{label_pos:s.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([s,i])=>h`<option value=${s} ?selected=${(t.label_pos??"auto")===s}>${i}</option>`)}</select></sw-field>
      ${this.renderMount(t,!1)}
      <div class="note">ריק = השם המקורי${e?.name?` („${e.name}“)`:""}. השם הידני מוצג במפה, ברשימת הצד ובכרטיס.</div>
      <div class="note" style="margin-block-start:6px">revision ${t.revision}${this.dirty.has(t.id)?" · שינויים לא שמורים":""}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`}renderToolPanel(t){const e=new Set(this.anchors.map(s=>s.resource_id));if(this.tool==="structure")return this.renderStructurePanel(t);if(this.tool==="library")return this.renderLibraryTool(t);if(this.tool==="connectors")return this.renderConnectorTool(t);if(this.tool==="circuits")return this.renderCircuitTool(t);if(this.tool==="calibrate")return this.renderCalibrate(t);if(this.tool==="walk")return this.renderWalkTool(t);if(this.tool==="measure")return this.renderMeasure(t);if(this.tool==="detect")return this.renderDetectTool(t);if(this.tool==="camera"){const s=t.cameras.filter(i=>!e.has(i.id));return h`<sw-card heading="הוספת מצלמה" subheading="בחר מצלמה ואז לחץ על התוכנית במקום המבוקש">
        ${s.length?h`<div class="list">${s.map(i=>h`<button class=${this.placing?.kind==="camera"&&this.placing.camera.id===i.id?"on":""} @click=${()=>this.placing={kind:"camera",camera:i}}><span>${i.name}</span><span class="ltr">ch ${i.channel} · ${i.status}</span></button>`)}</div>`:h`<div class="note">${t.cameras.length?"כל המצלמות הרשומות כבר מוצבות על הקומה.":"אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית."}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>J("/system/devices")}>למצלמות</sw-button></div>`}
      </sw-card>`}if(this.tool==="entity"||this.tool==="lights"){const s=this.tool==="lights",i=(this.entResults??[]).filter(o=>!e.has(o.entity_id));return h`<sw-card heading=${s?"הוספת תאורה":"הוספת התקן אחר"} subheading=${s?"מפסקים (switch) מהקטלוג; לחץ על התוכנית להצבה. השם ניתן לשינוי אחרי ההצבה.":"כל ישות אחרת בקטלוג (דלתות, חיישנים, מזגנים…) ואז לחיצה על התוכנית"} data-tool-panel=${this.tool}>
        <sw-field><input type="search" placeholder=${s?"חיפוש מפסק לפי שם או אזור":"חיפוש לפי שם, entity_id או אזור"} data-ltr .value=${this.entQ} @input=${o=>this.onEntQuery(o.target.value)} /></sw-field>
        ${s?h`<label class="note" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-lights-all .checked=${this.lightsAll} @change=${o=>{this.lightsAll=o.target.checked,this.searchEntities()}} /> להציג גם ישויות light (נורות חכמות)</label>`:p}
        ${t.source==="demo"?h`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`:this.entBusy&&!this.entResults?h`<div class="note">מחפש…</div>`:i.length?h`<div class="list">${i.map(o=>h`<button class=${this.placing?.kind==="entity"&&this.placing.entity.entity_id===o.entity_id?"on":""} @click=${()=>this.placing={kind:"entity",entity:o}}><span>${o.name||o.original_name||o.entity_id}<div class="note" style="margin:0">${se(o.domain)}${o.area_name?` · ${o.area_name}`:""} · ${ee(o)}</div></span><span class="ltr">${o.entity_id}</span></button>`)}</div>`:h`<div class="note">${this.entResults?"לא נמצאו ישויות (או שכולן כבר מוצבות).":""}</div>`}
      </sw-card>`}return this.tool==="layers"?h`<sw-card heading="שכבות" subheading="מה מוצג בעורך (לא משפיע על הצופים)">
        <div class="layerlist">${Re.filter(s=>s.id!=="cameras"||kt("nvr")).map(s=>h`<label><input type="checkbox" .checked=${this.layers.has(s.id)} @change=${i=>{const o=new Set(this.layers);i.target.checked?o.add(s.id):o.delete(s.id),this.layers=o}} /> ${s.label} <span class="note">(${this.anchors.filter(i=>this.layerOf(i)===s.id).length})</span></label>`)}
          <label><input type="checkbox" .checked=${this.showZones} @change=${s=>this.showZones=s.target.checked} /> חדרים ואזורים <span class="note">(${this.zones.length})</span></label>
          ${t.imageUrl?h`<label><input type="checkbox" data-plan-background .checked=${this.planImage} @change=${s=>this.setPlanImage(t.floorId,s.target.checked)} /> תמונת התוכנית <span class="note">(${this.planImage?"מתחת לשרטוט":"מוסתרת, רקע נקי"})</span></label>`:p}</div>
        ${this.studio.doc?Io({...this.grid,steps:Ue,estimated:x(this.studio.doc).estimated,showEstimates:this.showEstimates},s=>this.setGrid(t.floorId,{on:s}),s=>this.setGrid(t.floorId,{stepM:s})):p}
      </sw-card>`:this.tool==="zones"?this.renderZonesPanel(t):this.tool==="select"&&this.multiShown.length&&this.studio.doc?this.renderMultiPanel():this.tool==="select"&&this.geomSel&&this.studio.doc?h`${this.renderSelectionPanel(t)}${this.multiOn?h`<div class="note" data-multi-hint>${Ct}</div>`:p}`:h`<sw-card heading="מאפיינים"><div class="note" data-select-hint>${t.permissions.structure&&this.studio.doc?"לחץ על סיכה, קיר, פתח, תווית, עצם או אזור במפה כדי לבחור ולערוך אותם, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה: סיכה, פתח, תווית ועצם מיד, קיר ואזור אחרי שנבחרו. הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.":"בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור."}</div>${this.multiOn?h`<div class="note" data-multi-hint>${Ct}</div>`:p}</sw-card>`}renderSelectionPanel(t){const e=this.geomSel,s=this.studio.doc;if(!e||!s)return p;if(e.kind==="object"||e.kind==="group")return this.renderLibraryTool(t,!0);if(e.kind==="connector"){const i=s.connectors.find(o=>o.id===e.id);return i?zo({...this.connectorView(s),sel:i},{...this.connectorActions(),setMode:()=>{}}):p}return this.renderStructurePanel(t,!0)}loadZoneCamera(t){this.zoneCameraFor=t,this.zoneCamera=null,this.camSuggestions=null,!(!t||this.bundle?.source==="demo")&&so(t).then(e=>{this.zoneCameraFor===t&&(this.zoneCamera=e)},()=>{})}askCameraSuggestions(t){const e=this.bundle;if(!e)return;const s=this.anchors.filter(o=>o.resource_type==="camera").map(o=>({id:o.id,floorId:o.floor_id,levelId:o.level_id??null,position:o.position,rotationDeg:o.rotation_degrees,fovDeg:o.field_of_view_degrees})),i={id:t.id,floorId:t.floor_id,levelId:t.level_id??null,polygon:t.polygon};this.camSuggestions={zoneId:t.id,items:or(i,s,this.camSuggestCfg,{aspect:e.height?e.width/e.height:1,exclude:this.zoneCamera?.anchor_id?[this.zoneCamera.anchor_id]:[]})}}async setZoneCamera(t,e){this.zoneBusy=!0,this.error="";try{const s=e?await io(t.id,e):await oo(t.id);this.zoneCameraFor===t.id&&(this.zoneCamera=s),this.camSuggestions=null}catch(s){this.error=$(s)}finally{this.zoneBusy=!1}}renderCameraSuggest(t){const e=this.bundle;if(!e||e.source==="demo"||t.shared?.role==="mirror")return p;const s=this.zoneCamera?.anchor_id?this.anchors.find(r=>r.id===this.zoneCamera.anchor_id):void 0,i=this.camSuggestions?.zoneId===t.id?this.camSuggestions.items:null,o=this.anchors.some(r=>r.resource_type==="camera"),n=r=>r===0?"בתוך האזור":`במרחק ${Math.max(1,Math.round(r*100))}%`;return h`<div class="cam-suggest" data-cam-suggest>
      ${s?h`<div class="kv" data-zone-camera><span class="k">מצלמת האזור</span><span>${D(this.anchorName(s))}</span></div>`:p}
      ${e.permissions.edit&&o?h`<div class="btns"><sw-button size="sm" icon="camera" data-cam-suggest-ask ?disabled=${this.zoneBusy} @click=${()=>this.askCameraSuggestions(t)}>הצע מצלמה קרובה</sw-button>${s?h`<sw-button size="sm" variant="ghost" data-cam-suggest-clear ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,null)}>הסר קישור</sw-button>`:p}</div>`:p}
      ${i?i.length?h`<div class="cam-sug-list" data-cam-suggest-list>${i.map(r=>{const a=this.anchors.find(d=>d.id===r.id);return h`<div class="cam-sug" data-cam-suggestion=${r.id}>
                <span class="cam-sug-name">${a?D(this.anchorName(a)):r.id}<span class="note" style="margin:0">${n(r.distance)}${r.facing===null?" · ללא שדה ראייה":r.facing>=.5?" · פונה לאזור":" · לא פונה לאזור"}</span></span>
                <sw-button size="sm" variant="primary" icon="check" data-cam-suggest-accept ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,r.id)}>קבל</sw-button>
              </div>`})}</div>`:h`<div class="note" data-cam-suggest-none>אין מצלמה בקרבת האזור בטווח שהוגדר בהגדרות &gt; מפה</div>`:p}
    </div>`}renderZoneInspector(t){const e=this.anchors.filter(i=>i.resource_type==="camera"&&Zt(i.position,t.polygon)),s=this.anchors.filter(i=>i.resource_type!=="camera"&&Zt(i.position,t.polygon));return h`<div class="zone-insp" data-zone-inspector>
      <sw-field label="שם"><input .value=${t.name} placeholder="למשל: לובי, מחסן, חדר ישיבות" @change=${i=>this.patchZone(t,{name:i.target.value})} /></sw-field>
      <div class="two">
        <sw-field label="סוג"><select @change=${i=>this.patchZone(t,{kind:i.target.value})}>${ke.map(i=>h`<option value=${i.id} ?selected=${t.kind===i.id}>${i.label}</option>`)}</select></sw-field>
        <sw-field label="צבע"><input type="color" data-ltr .value=${t.color} @change=${i=>this.patchZone(t,{color:i.target.value})} /></sw-field>
      </div>
      <sw-field label="מיקום שם החדר"><select data-zone-label-pos @change=${i=>this.patchZone(t,{label_pos:i.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([i,o])=>h`<option value=${i} ?selected=${(t.label_pos??"auto")===i}>${o}</option>`)}</select></sw-field>
      ${this.renderRoomMaterial(t)}
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-zone-level @change=${i=>this.patchZone(t,{level_id:i.target.value})}>${this.studio.doc.levels.map(i=>h`<option value=${i.id} ?selected=${(t.level_id??T(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:p}
      ${this.areas.length?h`<sw-field label="אזור בעץ ההתקנים" hint=${t.area_id&&!this.areas.some(i=>i.area_id===t.area_id)?"האזור המקושר כבר לא קיים":'"הצג על המפה" מהעץ ומדף האזור מגיע לחדר הזה; לחיצה על החדר במפה פותחת את האזור'}>
            <select data-zone-area ?disabled=${this.zoneBusy} @change=${i=>this.patchZone(t,{area_id:i.target.value})}>
              <option value="" ?selected=${!t.area_id}>ללא קישור</option>
              ${this.areas.map(i=>h`<option value=${i.area_id} ?selected=${t.area_id===i.area_id}>${D(i.name)}${i.floor_name?` · ${D(i.floor_name)}`:""}</option>`)}
            </select></sw-field>`:p}
      ${this.renderZoneTags(t)}
      ${this.renderZoneShare(t)}
      ${this.renderCameraSuggest(t)}
      <div class="kv"><span class="k">מצלמות באזור</span><span>${e.length?e.map(i=>this.anchorName(i)).join(", "):"אין"}</span></div>
      <div class="kv"><span class="k">התקנים באזור</span><span>${s.length?`${s.length} ישויות`:"אין"}</span></div>
      <div class="row"><span class="lbl">הכללה בחיפוש מרחבי<span class="muted">זמין לחוקי התראה ולחיפוש לפי מקום</span></span><sw-toggle ?checked=${t.searchable} label=${t.searchable?"כלול":"לא כלול"} @click=${()=>this.patchZone(t,{searchable:!t.searchable})}></sw-toggle></div>
      <div class="note">${t.polygon.length} פינות · ${t.source==="auto"?"זוהה אוטומטית מהתוכנית":"צויר ידנית"} · revision ${t.revision}</div>
      <div class="note" data-zone-hint>גרור פינה כדי לשנות צורה, גרור נקודת אמצע כדי להוסיף פינה, גרור את הגוף כדי להזיז; Delete על פינה מסיר אותה</div>
      <div class="note">אזור במפה הוא הקשר מרחבי בלבד: אינו אזור זיהוי במצלמה ואינו מסכת פרטיות, ואינו משנה תצורת NVR.</div>
      <div class="btns">${t.shared?.role==="mirror"?p:h`<sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.zoneBusy} @click=${()=>this.removeZone(t)}>מחק אזור</sw-button>`}<sw-button size="sm" variant="ghost" @click=${()=>this.selectedZoneId=null}>סגור</sw-button></div>
    </div>`}renderZoneTags(t){const e=s=>{s!==t.tags&&!(t.tags===void 0&&!s.length)&&this.patchZone(t,{tags:s})};return Mo({chips:(t.tags??[]).map(s=>({tag:s})),full:(t.tags?.length??0)>=Dt,disabled:this.zoneBusy||this.bundle?.source==="demo"},s=>e(be(t.tags,s)),s=>e(zt(t.tags,s)))}renderZonesPanel(t){const e=this.candidates,s=this.selectedZone;return h`<sw-card heading="חדרים ואזורים" subheading="זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה">
      ${e?h`<div class="note">${e.length} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.</div>
            <div class="candlist">${e.map((i,o)=>h`<div class="cand" data-candidate><input type="checkbox" .checked=${i.include} aria-label="כלול" @change=${n=>this.setCandidate(o,{include:n.target.checked})} /><i class="sw" style="background:${mt[o%mt.length]}"></i><input class="name" .value=${i.name} placeholder="שם החדר" aria-label="שם החדר" @input=${n=>this.setCandidate(o,{name:n.target.value})} /><select aria-label="סוג" @change=${n=>this.setCandidate(o,{kind:n.target.value})}>${ke.map(n=>h`<option value=${n.id} ?selected=${i.kind===n.id}>${n.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some(i=>i.source==="auto")?h`<label class="chk"><input type="checkbox" .checked=${this.replaceAuto} @change=${i=>this.replaceAuto=i.target.checked} /> החלף את החדרים שזוהו אוטומטית בעבר (${this.zones.filter(i=>i.source==="auto").length})</label>`:p}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy||!e.some(i=>i.include)} @click=${()=>this.acceptCandidates()}>שמור ${e.filter(i=>i.include).length} חדרים</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.candidates=null}>בטל</sw-button></div>`:this.drawing?h`<div class="note">לחץ על התוכנית להוספת פינות (${this.drawing.length} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length<3||this.zoneBusy} @click=${()=>this.finishDrawing()}>סיים אזור</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.drawing=null}>בטל</sw-button></div>`:h`<div class="row"><span class="lbl">זיהוי חדרים מהתוכנית<span class="muted">עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות</span></span><select aria-label="עוצמת זיהוי" @change=${i=>this.detectStrength=i.target.value}><option value="light" ?selected=${this.detectStrength==="light"}>קל</option><option value="medium" ?selected=${this.detectStrength==="medium"}>בינוני</option><option value="strong" ?selected=${this.detectStrength==="strong"}>חזק</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting||t.source==="demo"||t.planStatus==="none"} @click=${()=>this.detect()}>${this.detecting?"מזהה…":"זהה חדרים"}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${()=>this.startDrawing()}>צייר אזור</sw-button></div>`}
      ${this.zones.length?h`<div class="note" style="margin-block-start:10px">${this.zones.length} אזורים בקומה · לחיצה בוחרת במפה</div>
            <div class="list">${this.zones.map(i=>h`<button class=${i.id===this.selectedZoneId?"on":""} data-zone-row @click=${()=>{this.selectedZoneId=i.id===this.selectedZoneId?null:i.id,this.selectedId=null}}><span><i class="sw" style="background:${i.color}"></i>${i.name}</span><span class="note" style="margin:0">${no(i.kind)}${i.source==="auto"?" · אוטומטי":""}</span></button>`)}</div>`:e||this.drawing?p:h`<div class="note" style="margin-block-start:10px">עדיין אין חדרים או אזורים בקומה.</div>`}
      ${s?this.renderZoneInspector(s):p}
    </sw-card>`}renderVersionCard(t){const e=this.stylized;return h`<sw-card heading="גרסת תוכנית" subheading=${t.planStatus==="draft"?"טיוטה: צופים רואים את הגרסה הקודמת":t.planStatus==="published"?"גרסה מפורסמת":"אין תוכנית"}>
      ${t.planStatus==="none"?p:h`<div class="row"><span class="lbl">תצוגת המפה<span class="muted">${t.renderMode==="stylized"?"שפת Arx (עיבוד אוטומטי של המקור)":"תוכנית המקור כפי שהועלתה"}</span></span>${t.renderMode==="stylized"?h`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("source")}>הצג מקור</sw-button>`:t.stylizedAvailable?h`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>הצג שפת Arx</sw-button>`:p}</div>
          <div class="row"><span class="lbl">עיבוד לשפת Arx<span class="muted">בחר מה להשאיר מהתוכנית; המקור נשמר תמיד</span></span></div>
          <div class="two" data-stylize-opts>
            <sw-field label="עוצמת ניקוי"><select aria-label="עוצמת ניקוי" @change=${s=>this.stylizeOpts={...this.stylizeOpts,strength:s.target.value}}><option value="light" ?selected=${this.stylizeOpts.strength==="light"}>קל · קירות דקים נשמרים</option><option value="medium" ?selected=${this.stylizeOpts.strength==="medium"}>בינוני · קירות כפולים מאוחדים</option><option value="strong" ?selected=${this.stylizeOpts.strength==="strong"}>חזק · מדרגות וריהוט לגושים</option></select></sw-field>
            <sw-field label="מילוי חדרים"><select aria-label="מילוי חדרים" @change=${s=>this.stylizeOpts={...this.stylizeOpts,roomFill:s.target.value}}>${Object.keys(At).map(s=>h`<option value=${s} ?selected=${this.stylizeOpts.roomFill===s}>${At[s]}</option>`)}</select></sw-field>
          </div>
          <label class="chk"><input type="checkbox" .checked=${this.stylizeOpts.keepLines} @change=${s=>this.stylizeOpts={...this.stylizeOpts,keepLines:s.target.checked}} /> ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)</label>
          <div class="btns"><sw-button variant="primary" size="sm" icon="image" ?disabled=${this.stylizing||t.source==="demo"} @click=${()=>this.stylize()}>${this.stylizing?"מעבד…":"עבד תצוגה מקדימה"}</sw-button></div>
          ${e?h`<div class="compare" style="margin-block-start:8px"><div><div class="note">מקור</div><img src=${e.source_url} alt="תוכנית מקור" /></div><div><div class="note" data-stylize-caption>שפת Arx · ${e.rooms} חדרים · ${At[e.room_fill]??e.room_fill} · ${e.keep_lines?"עם קווים דקים":"ללא קווים דקים"}</div><img src=${e.stylized_url} alt="שפת Arx" /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>השתמש בתוצאה</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.stylized=null}>סגור</sw-button></div>
              <div class="note" style="margin-block-start:6px">עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.</div>`:p}`}
      ${this.renderVersionHistory(t)}
      ${this.renderStructureHistory(t)}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>J(`/explore/floors/${t.floorId}/import`)}>ייבוא תוכנית חדשה</sw-button></div>
    </sw-card>
    ${this.renderFloorImages(t)}`}renderVersionHistory(t){return this.versions.length?h`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית גרסאות<span class="muted">כל פרסום נשמר; אפשר להשוות ולשחזר גרסה מהארכיון בלי לאבד עוגנים</span></span></div>
      <div class="vlist" data-version-list>
        ${this.versions.map(e=>{const s=e.id===t.planVersionId,i=e.status==="published"?"recorded":e.status==="draft"?"partial":"neutral",o=e.status==="published"?"מפורסמת":e.status==="draft"?"טיוטה":"ארכיון";return h`<div class="vrow ${s?"cur":""}" data-version-row data-version-id=${e.id} data-version-status=${e.status}>
            <img src=${H(e.image_url)} alt="" loading="lazy" />
            <div class="meta">
              <span><sw-badge kind=${i} label=${o}></sw-badge> <span class="ltr">${K(e.published_at??e.created_at)}</span></span>
              <span class="note">${e.width_px}×${e.height_px}${e.rotation?` · סיבוב ${e.rotation}°`:""}${e.crop?" · חיתוך":""} · ${e.anchors_on??0} פריטים${e.notes?` · ${e.notes}`:""}</span>
            </div>
            <div class="acts">
              ${e.status!=="published"?h`<sw-button size="sm" variant="ghost" data-version-compare ?disabled=${this.busy} @click=${()=>this.openDiff(e.status==="draft"&&t.permissions.publish?"publish":"compare",e)}>השווה</sw-button>`:p}
              ${e.status==="archived"&&t.permissions.publish?h`<sw-button size="sm" icon="history" data-version-rollback ?disabled=${this.busy} @click=${()=>this.openDiff("rollback",e)}>שחזר</sw-button>`:p}
            </div>
          </div>`})}
      </div>`:p}renderDiffDialog(){const t=this.diff;if(!t)return p;const e=t.data,s=t.mode==="publish"&&t.version.id===this.bundle?.planVersionId?this.studio.doc:null,i=s&&(s.walls.length||s.openings.length||s.labels.length||s.objects.length||s.connectors.length)?s:null,o=!!i&&this.studio.issues.some(a=>a.severity==="error"),n=t.mode==="publish"?"פרסום גרסה":t.mode==="rollback"?"שחזור גרסה מהארכיון":"השוואת גרסאות",r=t.mode==="publish"?"מה ישתנה לצופים ומה יקרה לפריטים המוצבים":t.mode==="rollback"?"הגרסה תפורסם מחדש כעותק חדש; הגרסה הנוכחית תעבור לארכיון":"מול הגרסה המפורסמת";return h`<sw-dialog open heading=${n} subheading=${r} data-diff-dialog @close=${()=>this.diff=null}>
      ${t.error?h`<div class="err" data-diff-error>${t.error}</div>`:p}
      ${e?h`<div class="compare">
              <div><div class="note">${e.from?`מפורסמת · ${K(e.from.published_at??e.from.created_at)}`:"אין גרסה מפורסמת"}</div>${e.from?h`<img src=${H(e.from.image_url)} alt="הגרסה המפורסמת" />`:h`<div class="note">—</div>`}</div>
              <div><div class="note">${t.mode==="rollback"?"לשחזור":"חדשה"} · ${K(e.to.published_at??e.to.created_at)}</div><img src=${H(e.to.image_url)} alt="הגרסה החדשה" /></div>
            </div>
            <div class="dsum" data-diff-summary>
              ${e.from?e.geometry.same?h`<sw-badge kind="recorded" label="גאומטריה זהה"></sw-badge>`:h`<sw-badge kind="partial" label=${`שינוי: ${e.geometry.changes.map(a=>br[a.field]??a.field).join(", ")}`}></sw-badge>`:h`<sw-badge kind="neutral" label="פרסום ראשון"></sw-badge>`}
              <span>${e.anchors.total} פריטים מוצבים · ${e.anchors.carried} עוברים כמו שהם · ${e.anchors.needs_alignment} ידרשו יישור</span>
            </div>
            ${i?h`<div class="note" data-diff-structure>המבנה של הטיוטה (${Nt(i.walls.length,i.openings.length)}) יפורסם יחד עם הגרסה${o?"; יש בו שגיאות שחוסמות את הפרסום עד לתיקון: ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה":""}.</div>`:p}
            ${e.anchors.items.length?h`<div class="ditems" data-diff-items>${e.anchors.items.map(a=>h`<div><span>${a.resource_type==="camera"?"מצלמה":"ישות"} · ${a.name}</span><span class=${a.outcome==="carried"?"":"err"}>${a.outcome==="carried"?"עובר":"יישור נדרש"}</span></div>`)}</div>`:p}
            ${e.anchors.needs_alignment?h`<div class="note">פריטים שידרשו יישור נשארים במקומם על גרסת התוכנית הקודמת ומסומנים במפה; שום פריט לא מוזז למיקום מומצא.</div>`:p}`:h`<div class="note">טוען השוואה…</div>`}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.diff=null}>${t.mode==="compare"?"סגור":"ביטול"}</sw-button>
      ${t.mode!=="compare"&&e?h`<sw-button slot="footer" variant="primary" icon=${t.mode==="publish"?"check":"history"} data-diff-confirm ?disabled=${this.busy||o} @click=${()=>this.confirmDiff()}>${t.mode==="publish"?"פרסם גרסה":"שחזר ופרסם"}</sw-button>`:p}
    </sw-dialog>`}renderGeomDiffDialog(){const t=this.geomDiff;if(!t)return p;const e=t.data,s=e?e.issues.filter(o=>o.severity==="error"):[],i=e?Object.entries(e.diff.collections):[];return h`<sw-dialog open heading="פרסום המבנה" subheading="מה ישתנה לצופים במפה" data-geom-diff @close=${()=>this.geomDiff=null}>
      ${t.error?h`<div class="err" data-geom-diff-error>${t.error}</div>`:p}
      ${e?h`<div class="ditems" data-geom-diff-rows>
              ${i.length?i.map(([o,n])=>h`<div><span>${Po[o]??o}</span><span>${n.added.length} נוספו · ${n.changed.length} שונו · ${n.removed.length} הוסרו</span></div>`):h`<div><span>אין שינוי בפריטים</span></div>`}
              ${e.diff.calibration_changed?h`<div><span>כיול</span><span>קנה המידה השתנה</span></div>`:p}
              ${(e.shared_pending??[]).filter(o=>o.invalid||(o.changes??0)>0).map(o=>h`<div data-geom-shared-pending>
                <span>כולל שינויים בחלל המשותף${o.home_floor_name?` (${D(o.home_floor_name)})`:""}</span>
                <span>${o.invalid?o.items?.length?`${I(o.items.length,"פריט אחד לא מוכן","פריטים לא מוכנים")} לפרסום`:"התוכן של החלל המשותף לא תקין - הפרסום ייחסם":I(o.changes??0,"שינוי אחד","שינויים")}</span>
              </div>
              ${o.invalid&&o.items?.length?h`<div class="note" data-geom-shared-invalid>${o.items.map(n=>h`<div>${n.id.split(":").pop()} · ${n.message}</div>`)}
                <label><input type="checkbox" data-geom-shared-skip .checked=${t.skip.length>0} @change=${n=>{this.geomDiff={...t,skip:n.target.checked?o.items.map(r=>r.id):[]}}} /> פרסם בלי הפריטים האלה (הם יישארו כמו שפורסמו)</label></div>`:p}`)}
            </div>
            <div class="note">${e.published_counts?`כעת: ${Nt(e.published_counts.walls,e.published_counts.openings)}`:"פרסום ראשון של מבנה"} · אחרי הפרסום: ${Nt(e.counts.walls,e.counts.openings)}</div>
            ${s.length?h`<div class="err" data-geom-diff-error>${I(s.length,"שגיאה חוסמת אחת","שגיאות חוסמות")} בטיוטה: הפרסום חסום עד לתיקון. ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה.</div>`:p}`:t.error?p:h`<div class="note">טוען השוואה…</div>`}
      <sw-button slot="footer" variant="ghost" data-geom-cancel @click=${()=>this.geomDiff=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-geom-publish ?disabled=${this.busy||!e||s.length>0||(e.shared_pending??[]).some(o=>o.invalid&&!(o.items?.length&&t.skip.length))} @click=${()=>this.confirmGeomPublish()}>פרסם מבנה</sw-button>
    </sw-dialog>`}render(){const t=this.bundle;if(this.error&&!t)return h`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!t)return h`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.selected,s=this.dirty.size,i=this.anchors.filter(n=>n.resource_type==="camera").length,o=this.anchors.length-i;return h`
      <sw-page heading="עורך תוכנית" subheading=${`${t.buildingName} · ${t.floorName} · ${t.planStatus==="draft"?"טיוטה":t.planStatus==="published"?"תוכנית מפורסמת":"אין תוכנית"} · העוגנים נשמרים בנפרד מתמונת המקור${t.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${t.siteName} | ${t.buildingName} | ${t.floorName}`} wide>
        ${t.permissions.publish&&(t.planStatus==="draft"||this.studio.pendingPublish)?h`<sw-button slot="actions" variant="primary" icon="check" data-publish ?disabled=${this.busy} @click=${()=>this.publish()}>${t.planStatus==="draft"?"פרסום גרסה":"פרסום המבנה"}</sw-button>`:p}
        <sw-button slot="actions" icon="eye" @click=${()=>J(`/explore/floors/${t.floorId}`)}>תצוגה מקדימה</sw-button>
        <sw-button slot="actions" ?disabled=${!s||this.busy} icon="check" @click=${()=>this.save()}>${s?`שמירה (${s})`:"הכל שמור"}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}>ביטול שינוי</sw-button>
        ${t.planStatus==="none"?h`<sw-state-panel icon="map" state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>J(`/explore/floors/${t.floorId}/import`)}>העלאת תוכנית</sw-button> <sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>bs()}>בקשה לאדריכל</sw-button></div></sw-state-panel>`:h`<div class="layout">
              <div class="mapwrap">
                <div class="bar">
                  <span class="autosave ${s?"dirty":""}"><i></i>${s?`${s} שינויים לא שמורים`:"הכל שמור"}</span>
                  ${this.info?h`<span style="color:var(--sw-success-text)">${this.info}</span>`:p}
                  ${this.error?h`<span class="err">${this.error}</span>`:p}
                  <span class="grow"></span>
                  ${t.needsAlignment?h`<sw-badge kind="partial" label="פריטים מגרסת תוכנית קודמת — בדוק מיקומים"></sw-badge>
                    <sw-button size="sm" data-realign-crop ?disabled=${this.busy} title="כשהגרסה החדשה היא חיתוך אחר של אותו שרטוט, המיקומים מחושבים דרך שני החיתוכים" @click=${()=>this.realign("crop")}>יישר לפי החיתוך</sw-button>
                    <sw-button size="sm" variant="ghost" data-realign-accept ?disabled=${this.busy} title="אחרי בדיקה בעין: הפריטים נרשמים על הגרסה הנוכחית כפי שהם" @click=${()=>this.realign("accept")}>אשר מיקומים</sw-button>`:p}
                  <span>גרירה מזיזה · גלגלת = זום · ידיות = כיוון ושדה ראייה</span>
                  ${this.phone.matches?p:h`<button class="icon ${this.panMode?"on":""}" data-tool-pan ?disabled=${this.detectBusy} title="יד: הזזת התוכנית קבועה - כל גרירה מזיזה, עד לחיצה חוזרת או Esc" aria-label="מצב הזזה (יד)" aria-pressed=${this.panMode} @click=${()=>this.panMode=!this.panMode}><sw-icon name="hand" size=${15}></sw-icon></button>
                        <button class="icon" data-tool-help title="קיצורי מקלדת" aria-label="קיצורי מקלדת" @click=${()=>this.shortcutsOpen=!0}><sw-icon name="help" size=${15}></sw-icon></button>`}
                </div>
                <div class="floorchip"><sw-icon name="building" size=${14}></sw-icon>${t.floorName}</div>
                ${this.studio.doc&&t.permissions.structure?h`<div class="levelbar">${To(this.studio.doc.levels.filter(n=>this.sharedLevels||!n.shared),this.activeLevel,n=>this.setLevelFilter(n),()=>this.openNewLevel(),n=>this.openLevelEdit(n))}${this.phone.matches?p:h`<sw-chip data-grid-chip icon="grid" ?selected=${this.grid.on} aria-pressed=${this.grid.on?"true":"false"} title="רשת עזר: גרירה והצבה של עצם נצמדות אליה (המרווח בכלי השכבות)" @click=${()=>this.setGrid(t.floorId,{on:!this.grid.on})}>רשת</sw-chip>`}${!this.phone.matches&&this.shownTags.length?Co(this.shownTags,n=>this.selectByTag(n)):p}</div>`:p}
                <div class="rail" role="toolbar" aria-label="כלי עריכה">
                  ${fr.filter(n=>n.id!=="camera"||kt("nvr")).map(n=>h`<button class=${n.id===this.tool?"on":""} data-tool=${n.id} ?disabled=${!n.ready||Lt.includes(n.id)&&!t.permissions.structure||this.detectBusy&&n.id!==this.tool} title=${n.label} aria-label=${n.label} aria-pressed=${n.id===this.tool} @click=${()=>this.pickTool(n.id)}><sw-icon .name=${n.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title="ביטול (Ctrl+Z)" aria-label="ביטול" data-rail-undo ?disabled=${this.detectBusy||!this.undoTarget} @click=${()=>this.undoAny()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title="בצע שוב (Ctrl+Y)" aria-label="בצע שוב" data-rail-redo ?disabled=${this.detectBusy||!this.redoTarget} @click=${()=>this.redoAny()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing||!!this.drawing||this.studioPlacing} .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .selectedZoneVertex=${this.zoneVertexSel&&this.zoneVertexSel.zoneId===this.selectedZoneId?this.zoneVertexSel.index:null} .draftPoints=${this.drawing??[]}
                  .geometry=${this.geomPreview??this.studio.doc} .geomDrag=${this.geomDragMode} .structureLevel=${this.activeLevel} .selectedGeomId=${this.geomSel?.id??null} .highlightIds=${this.geomSel?.kind==="group"?this.studio.doc?.groups.find(n=>n.id===this.geomSel.id)?.member_ids??[]:this.tool==="circuits"&&this.circuitSel?this.studio.doc?.circuits.find(n=>n.id===this.circuitSel)?.member_ids??[]:this.multiShown.map(n=>n.id)} .selectedVertex=${this.geomSel?.vertex??null} .issueIds=${this.issueIds}
                  .cornerSnapPx=${this.straightDrawing||this.curveDrawing?N:0}
                  .curveHandles=${this.tool==="structure"&&this.studioMode==="curve"} .selectedSegment=${this.geomSel?.segment??null} .arcPreview=${this.curveLive(t)?.path??[]}
                  .curveDraft=${this.curveDraft??[]} .curvePointHandles=${this.geomSelectMode&&this.studioMode!=="curve"||this.tool==="select"||this.curveDrawing&&!this.curveDraft}
                  .wallDraft=${this.wallDraft??[]} .hoverPoint=${this.studioPlacing?this.hover:null} .rulers=${this.rulers} .gridStep=${this.studio.doc?this.gridPx(this.studio.doc):0} .guides=${this.guides} .catalog=${this.catalogLookup}
                  .ghost=${this.doorGhost&&this.studio.doc?Mn(this.studio.doc,this.doorGhost,this.wallDefaults):null} .ghostNote=${this.doorGhost?.note??""} .ghostWarn=${!!this.doorGhost&&(this.doorGhost.found==="default"||!!this.doorGhost.warning)}
                  .ghostHandles=${this.doorGhost&&this.studio.doc?Tn(this.studio.doc,this.doorGhost,t.width,t.height):[]} @ghost-handle=${n=>this.onGhostHandle(n.detail)}
                  .candidates=${this.tool==="detect"&&this.cands?this.cands.set:null} .candidateStates=${this.shownCandStates} .selectedCandidateId=${this.candSel} .candidateEditable=${this.tool==="detect"&&!this.narrow&&!this.busy}
                  @candidate-select=${n=>this.toggleCandidate(n.detail.id)}
                  @candidate-drag=${n=>this.onCandidateDrag(n.detail)} .anchorPositions=${this.anchorPositions}
                  @plan-hover=${n=>this.onPlanHover(n.detail.x,n.detail.y,n.detail.shift,!!n.detail.item)}
                  .multiDrag=${this.multiShown.length>=2&&this.geomDragMode==="all"} .marquee=${this.multiOn} .panMode=${this.panMode}
                  @geom-box=${n=>this.onGeomBox(n.detail)}
                  @geom-select=${n=>this.onCanvasSelect(n.detail)}
                  @geom-drag-move=${n=>this.onGeomDragMove(n.detail)}
                  @geom-drag-cancel=${()=>{this.geomPreview=null,this.guides=[],this.guideCache=null,this.zoneSaving||(this.zonePreview=null),this.dupId=null}}
                  @geom-drag=${n=>this.onGeomDrag(n.detail)}
                  @zone-select=${n=>this.onZoneSelect(n.detail.id,!!n.detail.add)}
                  @zone-edit=${n=>{const r=this.zones.find(a=>a.id===n.detail.id);this.zoneVertexSel=null,r&&this.patchZone(r,{polygon:n.detail.polygon})}}
                  @zone-vertex-select=${n=>{n.detail.id===this.selectedZoneId&&(this.zoneVertexSel={zoneId:n.detail.id,index:n.detail.index})}}
                  @marker-select=${n=>{this.placing||this.drawing||this.studioPlacing||this.tool==="detect"||(this.selectedId=n.detail.id,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[])}}
                  @marker-move=${n=>{this.tool!=="detect"&&(this.apply(n.detail.id,{position:{x:+n.detail.x.toFixed(4),y:+n.detail.y.toFixed(4)}}),this.selectedId=n.detail.id,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[])}}
                  @marker-orient=${n=>this.apply(n.detail.id,{rotation_degrees:n.detail.rotation,field_of_view_degrees:n.detail.fov})}
                  @marker-coverage=${n=>this.apply(n.detail.id,n.detail.polygon?{coverage_polygon:n.detail.polygon.map(r=>[r.x,r.y])}:{coverage_radius:n.detail.radius})}
                  @plan-click=${n=>this.tool==="detect"?this.candSel=null:this.drawing?this.addDraftPoint(n.detail.x,n.detail.y):this.studioPlacing?this.studioClick(n.detail.x,n.detail.y,!!n.detail.shift):this.place(n.detail.x,n.detail.y)} @dragover=${n=>{n.dataTransfer?.types.includes("text/x-sw-item")&&n.preventDefault()}} @drop=${n=>this.onItemDrop(n)}></sw-plan-canvas>
                ${this.placing?h`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב את ${this.placing.kind==="camera"?this.placing.camera.name:this.placing.entity.name||this.placing.entity.entity_id} · Esc לביטול</span></div>`:p}
                ${this.drawing?h`<div class="placing-hint"><span>ציור אזור: לחץ להוספת פינות (${this.drawing.length}) · לחיצה על הפינה הראשונה או Enter מסיימים · Esc לביטול</span></div>`:p}
                ${this.placingItem&&!this.bindOffer?h`<div class="placing-hint"><span>לחץ על התוכנית כדי להציב ${this.placingItem.names.he} · Esc לביטול</span></div>`:p}
                ${this.connMode?h`<div class="placing-hint"><span>${this.connStart?"לחץ על הנקודה השנייה":"לחץ על הנקודה הראשונה"} · Esc לביטול</span></div>`:p}
                ${this.tool==="circuits"&&this.membersMode?this.circuitPlacing?h`<div class="placing-hint" data-circuit-placing><span>${Oo(this.circuitPlacing)}</span></div>`:h`<div class="placing-hint"><span>לחץ על מנורה כדי להוסיף או להסיר אותה מהמעגל · Esc לסיום</span></div>`:p}
                ${this.bindOffer?h`<div class="placing-hint bindbar" data-bind-offer><span>העצם ליד ${this.anchorName(this.bindOffer.anchor)} — להפוך אותו לגוף של הישות?
                    <button data-bind-accept @click=${()=>this.bindObject(this.bindOffer.objectId,this.bindOffer.anchor)}>הצמד לישות</button><button data-bind-dismiss @click=${()=>{this.bindRefused.add(this.bindOffer.objectId),this.bindOffer=null}}>לא</button></span></div>`:p}
                ${this.tool==="structure"&&this.studioMode==="markdoor"&&this.studio.doc?this.renderMarkDoorHint():p}
                ${this.curveDraft?this.renderCurveHint(t):p}
                ${this.wallDraft?h`<div class="placing-hint float" data-wall-hint><span>ציור קיר: ${this.wallDraft.length} נקודות · Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים · לחיצה על הנקודה הראשונה סוגרת מתאר · Esc לביטול</span></div>`:p}
                <div class="legend"><span><i></i>מצלמות · ${i}</span><span><i class="ent"></i>התקנים · ${o}</span><span><i class="zone"></i>אזורים · ${this.zones.length}</span></div>
              </div>
              <div class="props">
                ${this.renderSharedHint()}
                ${e?e.resource_type==="camera"?this.renderCameraInspector(e):this.renderEntityInspector(e):this.selectedZone&&this.tool!=="zones"?h`<sw-card heading="אזור" subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>${this.multiOn?h`<div class="note" data-multi-hint>${Ct}</div>`:p}`:this.renderToolPanel(t)}
                ${(e||this.selectedZone&&this.tool!=="zones")&&this.tool!=="select"?this.renderToolPanel(t):p}
                ${this.renderVersionCard(t)}
              </div>
            </div>`}
        ${this.renderDiffDialog()}
        ${this.renderGeomDiffDialog()}
        ${this.arrayDialog?Ao(this.arrayDialog,n=>this.arrayDialog={...this.arrayDialog,error:"",...n},()=>this.createArray(),()=>this.arrayDialog=null):p}
        ${this.twinDelete?Eo(this.twinDelete.target,this.twinDelete.canBoth,()=>this.confirmTwinDelete(!0),()=>this.confirmTwinDelete(!1),()=>this.twinDelete=null):p}
        ${this.linkConfirm?Lo(this.linkConfirm.kind,this.linkConfirm.target,()=>this.confirmLink(!0),()=>this.confirmLink(!1)):p}
        ${this.groupDelete?jo(this.studio.doc?.groups.find(n=>n.id===this.groupDelete)?.member_ids.length??0,()=>this.deleteGroup(!0),()=>this.deleteGroup(!1),()=>this.groupDelete=null):p}
        ${this.customDialog&&this.library?No(this.customDialog,this.library,n=>this.customDialog={...this.customDialog,...n},()=>void this.createCustom(),()=>this.customDialog=null):p}
        ${this.levelDialog?Fo(this.levelDialog,{change:n=>this.levelDialog={...this.levelDialog,...n},submit:()=>this.submitLevel(),cancel:()=>this.levelDialog=null,remove:()=>this.deleteLevel()}):p}
        ${this.shortcutsOpen?Ro(()=>this.shortcutsOpen=!1):p}
        ${this.pkgImport?Bn(this.pkgImport,{setMode:n=>void this.previewPackage(n),setAcceptForeign:n=>this.setPackageTrust(n),confirm:()=>void this.confirmPackageImport(),cancel:()=>{this.pkgImport?.busy!=="import"&&(this.pkgImport=null)}}):p}
        ${this.renderShareDialog()}
      </sw-page>
    `}};f.styles=[Vt`
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
    .rail button:hover {
      background: var(--sw-surface-3);
      color: var(--sw-text);
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
    .bar button.icon:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
    .bar button.icon.on {
      background: var(--sw-warning-soft);
      color: var(--sw-warning);
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
      border-radius: 999px;
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
    @media (hover: none) {
      .rail button:hover:not(.on) {
        background: transparent;
        color: var(--sw-text-2);
      }
      .bar button.icon:hover:not(.on) {
        background: var(--sw-surface);
        color: var(--sw-text-2);
      }
      .list button:hover:not(.on) {
        background: var(--sw-surface);
        border-color: var(--sw-border);
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
      font-size: var(--sw-fs-sm);
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
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-regular);
    }
    .row .lbl {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading);
    }
    .row .muted {
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-2);
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
    .list button:hover,
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
      border-radius: 999px;
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
      border-radius: 3px;
      box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.15);
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
      border-radius: 2px;
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
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
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
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: transparent;
      color: #fff;
      border-radius: 999px;
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
  `,Bo,Gn,Go];g([M()],f.prototype,"floorId",2);g([M()],f.prototype,"presetEntity",2);g([M()],f.prototype,"presetCandidates",2);g([M()],f.prototype,"presetZone",2);g([m()],f.prototype,"bundle",2);g([m()],f.prototype,"anchors",2);g([m()],f.prototype,"dirty",2);g([m()],f.prototype,"undo",2);g([m()],f.prototype,"redo",2);g([m()],f.prototype,"selectedId",2);g([m()],f.prototype,"tool",2);g([m()],f.prototype,"panMode",2);g([m()],f.prototype,"shortcutsOpen",2);g([m()],f.prototype,"layers",2);g([m()],f.prototype,"planImage",2);g([m()],f.prototype,"grid",2);g([m()],f.prototype,"guides",2);g([m()],f.prototype,"placing",2);g([m()],f.prototype,"entQ",2);g([m()],f.prototype,"entResults",2);g([m()],f.prototype,"entBusy",2);g([m()],f.prototype,"lightsAll",2);g([m()],f.prototype,"busy",2);g([m()],f.prototype,"error",2);g([m()],f.prototype,"info",2);g([m()],f.prototype,"pkgImport",2);g([m()],f.prototype,"stylizing",2);g([m()],f.prototype,"stylized",2);g([m()],f.prototype,"stylizeOpts",2);g([m()],f.prototype,"zones",2);g([m()],f.prototype,"versions",2);g([m()],f.prototype,"geomVersions",2);g([m()],f.prototype,"areas",2);g([m()],f.prototype,"floorImages",2);g([m()],f.prototype,"alignDraft",2);g([m()],f.prototype,"alignShowPlan",2);g([m()],f.prototype,"imageBusy",2);g([m()],f.prototype,"imageNote",2);g([m()],f.prototype,"diff",2);g([m()],f.prototype,"selectedZoneId",2);g([m()],f.prototype,"zoneVertexSel",2);g([m()],f.prototype,"lastEdit",2);g([m()],f.prototype,"candidates",2);g([m()],f.prototype,"detecting",2);g([m()],f.prototype,"detectStrength",2);g([m()],f.prototype,"replaceAuto",2);g([m()],f.prototype,"drawing",2);g([m()],f.prototype,"showZones",2);g([m()],f.prototype,"zoneBusy",2);g([ws("sw-plan-canvas")],f.prototype,"canvas",2);g([m()],f.prototype,"studioMode",2);g([m()],f.prototype,"curveDraft",2);g([m()],f.prototype,"glassDraw",2);g([m()],f.prototype,"doorGhost",2);g([m()],f.prototype,"doorAsking",2);g([m()],f.prototype,"wallDefaults",2);g([m()],f.prototype,"geomSel",2);g([m()],f.prototype,"multi",2);g([m()],f.prototype,"zonePreview",2);g([m()],f.prototype,"zoneSaving",2);g([m()],f.prototype,"multiNote",2);g([m()],f.prototype,"geomPreview",2);g([m()],f.prototype,"library",2);g([m()],f.prototype,"libQ",2);g([m()],f.prototype,"libCategory",2);g([m()],f.prototype,"libRecent",2);g([m()],f.prototype,"libFav",2);g([m()],f.prototype,"placingItem",2);g([m()],f.prototype,"bindOffer",2);g([m()],f.prototype,"arrayDialog",2);g([m()],f.prototype,"groupDelete",2);g([m()],f.prototype,"customDialog",2);g([m()],f.prototype,"levelFilter",2);g([m()],f.prototype,"levelDialog",2);g([m()],f.prototype,"matStyle",2);g([m()],f.prototype,"walkArmed",2);g([m()],f.prototype,"walkFocus",2);g([m()],f.prototype,"site",2);g([m()],f.prototype,"connMode",2);g([m()],f.prototype,"connStart",2);g([m()],f.prototype,"linkTargets",2);g([m()],f.prototype,"sharedLevels",2);g([m()],f.prototype,"shareDlg",2);g([m()],f.prototype,"stairShape",2);g([m()],f.prototype,"twinDelete",2);g([m()],f.prototype,"linkConfirm",2);g([m()],f.prototype,"linkBusy",2);g([m()],f.prototype,"circuitSel",2);g([m()],f.prototype,"membersMode",2);g([m()],f.prototype,"circuitPlacing",2);g([m()],f.prototype,"circuitNew",2);g([m()],f.prototype,"wallDraft",2);g([m()],f.prototype,"hover",2);g([m()],f.prototype,"calib",2);g([m()],f.prototype,"measurePts",2);g([m()],f.prototype,"geomDiff",2);g([m()],f.prototype,"showEstimates",2);g([m()],f.prototype,"camSuggestCfg",2);g([m()],f.prototype,"camSuggestions",2);g([m()],f.prototype,"zoneCamera",2);g([m()],f.prototype,"detectOpts",2);g([m()],f.prototype,"detectRun",2);g([m()],f.prototype,"cands",2);g([m()],f.prototype,"candStates",2);g([m()],f.prototype,"candSel",2);g([m()],f.prototype,"candEdits",2);g([m()],f.prototype,"candObjectsOn",2);g([m()],f.prototype,"hintApplied",2);g([m()],f.prototype,"detectAsk",2);g([m()],f.prototype,"detectErr",2);g([m()],f.prototype,"narrow",2);f=g([Be("explore-plan-editor")],f);export{f as ExplorePlanEditor};
//# sourceMappingURL=explore-plan-editor-SLZnKHdK.js.map
