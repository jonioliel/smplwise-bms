import{au as ts,cc as q,ch as es,p,q as h,i as Wt,L as ss,aw as is,az as os,av as ns,n as M,r as m,a as Be,_ as J,x as Ve,R as P,ak as k,ci as rs,cj as as,bB as ls,a7 as ds,ck as ut,cl as _t,cm as hs,cn as cs,X as D,br as Y,co as us,cf as ee,cp as ps,ce as gs,c9 as fs,ca as ms,cq as vs,cd as se,cr as ws,cs as bs,ct as ie,cu as oe,cv as ys,cw as ks,cb as $s,e as xs}from"./index-Cif9Bwbo.js";import{l as ne}from"./live-Btg6_tvB.js";import{o as _s}from"./architect-request-dialog-BJ-q06K_.js";import"./sw-chip-LnJ0vnss.js";import{s as Ss,m as re,a as Ds,c as Is,b as zs,d as Ms,M as Ps,e as Cs,f as Os,g as A,h as Ts,i as X,j as As,r as ae,k as Ls,l as Es,n as js,o as Ns,p as Fs}from"./sw-plan-canvas-BfQAfCqg.js";import{d as C,p as L,a as lt,e as x,O as Ht,c as Ue,g as it,o as ot,h as We,i as bt,j as Zt,k as Rs,l as Zs,m as yt,G as Gt,n as Gs,q as St,r as Bs,t as le,u as de,v as Vs,x as Us,y as Ws,z as Hs,A as Ks,B as qs,C as Js,E as he,F as Dt,H as Ys,I as Xs,J as Qs,K as ti,L as pt,M as U,N as ei,P as si,Q as ii,R as It,S as ce,T as ue,U as oi,V as ni,W as ri,X as ai,Y as li,Z as pe,_ as Q,$ as di,a0 as hi,a1 as ci,a2 as ui,a3 as tt,a4 as et,a5 as pi,a6 as st,a7 as ge,a8 as fe,a9 as gi,aa as fi,ab as mi,ac as vi,ad as wi,ae as bi,af as yi,ag as ki,ah as $i,ai as me,aj as xi,ak as _i,al as Si,am as zt,an as Di,ao as Ii,ap as zi,aq as Mi,ar as ve,as as Pi,at as Ci,au as we,av as Oi,aw as Ti,ax as Ai,ay as Li,az as be,aA as Mt,aB as W,aC as Ei,aD as ji,aE as Ni,aF as Fi,w as N,aG as ye,aH as Ri,aI as Pt,aJ as ke,aK as Zi,aL as He,aM as Gi,aN as Ct,aO as Bi,aP as Vi,aQ as $e,aR as Ui,s as Wi,aS as Hi,aT as Ki,aU as qi,aV as Ji}from"./shared-space-V3Y9z7Js.js";import{p as Bt,d as Yi,b as xe,c as Xi,u as Qi,a as to,e as eo,f as so,r as io,l as oo,g as no,s as ro,h as ao,i as lo,j as ho,Z as _e,z as co}from"./zones-BW7MOxo9.js";import{p as uo,a as _,b as po,G as go,c as I,D as Se,d as De,r as fo,e as mo,f as gt,g as vo,h as wo,i as Ot,j as Ie,k as bo,l as Tt,m as yo,n as ko,o as $o,S as xo,q as _o,C as So,s as ze,t as Do,u as Io,v as zo,w as Mo,x as Po,y as Co,z as Oo,M as At,A as To,B as Ao,E as Lo,F as Eo,H as jo,I as No,J as Fo,K as Ro,L as Zo,N as Go,O as Bo,P as Vo,Q as Uo,R as Wo,T as Ho,U as Ko}from"./plan-studio-panel-DFhXStGm.js";import{s as qo,g as Jo,f as Me,h as Yo,p as Xo,l as Qo,j as tn,k as en,m as sn,d as on,e as nn,c as rn,n as an,o as ln,q as dn,r as hn,t as ft,b as cn,u as un,v as pn}from"./geometry-Cb00dx_Q.js";import{t as gn,f as fn,r as Pe,d as mn,w as Ce,a as mt,m as vn,b as wn,e as bn}from"./candidates-rbOww-Gr.js";import{p as Oe,o as Lt}from"./connector-targets-C4syL9wK.js";import{l as yn,c as kn,i as j,d as $n,e as xn,f as _n,a as Sn}from"./plan-catalog-CwJX8Dtt.js";import{r as Dn,A as In,a as zn}from"./material-resolve-DEw4kfIA.js";import{D as Te}from"./sun-C6tBcKaa.js";import{s as Mn}from"./memo--2Ckk42J.js";import"./sw-logo-art-Va6y_cIM.js";const Pn="ghost-wall",Cn="ghost-door",kt=[.4,3],Ae=.12,On=.25,Tn="door_tool",at=(t,e,s)=>Math.min(s,Math.max(e,t)),Vt=t=>Math.round(t*1e3)/1e3;function dt(t,e,s,i){return Zt(t,s,i)*x(e).scale}function An(t,e,s,i,o){const{scale:n}=x(t),r=e.width_px!=null?Vt(at(e.width_px*n,kt[0],kt[1])):Ht.door.width_m,a=e.new_wall?{polyline:e.new_wall.polyline.map(d=>[d[0],d[1]]),thickness_m:Vt(at(e.new_wall.thickness_px*n,.05,.6))||o.thickness_m}:null,l={found:e.found,note:e.note,warning:e.warning,wallId:e.wall_id,newWall:a,t:e.t,width_m:r,hinge:e.hinge,swing:e.swing,confidence:e.confidence};return Kt(t,l,s,i)}function Z(t,e,s){return e.wallId?t.walls.find(i=>i.id===e.wallId)??null:e.newWall?{id:Pn,level_id:C(t),polyline:e.newWall.polyline,thickness_m:e.newWall.thickness_m||s?.thickness_m||.15,height_m:null,base_z_m:0,kind:s?.kind??"interior",confidence:1,source:"manual",locked:!1,external_ids:{}}:null}function Kt(t,e,s,i){const o=Z(t,e);if(!o)return e;if(e.newWall){const[a,l]=[e.newWall.polyline[0],e.newWall.polyline[e.newWall.polyline.length-1]],d=a[0]+(l[0]-a[0])*e.t,c=a[1]+(l[1]-a[1])*e.t,u=(l[0]-a[0])*s,v=(l[1]-a[1])*i,w=Math.hypot(u,v)||1,b=x(t).scale,$=e.width_m/2/b,S=u/w,y=v/w,E=Xe=>{let Jt=$+Ae/b,Yt=Number.POSITIVE_INFINITY;const Qe=Math.max(e.newWall.thickness_m,.2)/b;for(const ct of t.walls)if(!(ct.polyline.length<2))for(const Xt of[ct.polyline[0],ct.polyline[ct.polyline.length-1]]){const Qt=(Xt[0]-d)*s,te=(Xt[1]-c)*i,$t=(Qt*S+te*y)*Xe,xt=Math.abs(Qt*y-te*S);$t>=$&&$t<=$+(Ae+On)/b&&xt<=Qe&&xt<Yt&&(Jt=$t,Yt=xt)}return Jt},V=E(1),G=E(-1),ht=[d-S*G/s,c-y*G/i],Ye=[d+S*V/s,c+y*V/i];return{...e,t:G/(G+V),newWall:{...e.newWall,polyline:[ht,Ye]}}}const[n,r]=ot(e.width_m,dt(o,t,s,i));return{...e,t:at(e.t,n,r)}}function Ln(t,e,s){const i=Z(t,e,s);if(!i)return null;const o={id:Cn,wall_id:i.id,t:e.t,kind:"door",width_m:e.width_m,height_m:Ht.door.height_m,sill_m:0,swing:e.swing,hinge:e.hinge,anchor_ref:null,confidence:e.confidence,source:"manual",external_ids:{}};return{...t,walls:[i],openings:[o],labels:[],objects:[],connectors:[]}}function En(t,e,s,i){const o=Z(t,e);if(!o)return null;const n=dt(o,t,s,i),r=n>0?e.width_m/2/n:0;return[L(o,e.t-r,s,i),L(o,e.t+r,s,i)]}function jn(t,e,s,i){const o=Z(t,e),n=En(t,e,s,i);if(!o||!n)return[];const r=lt(o,e.t,s,i),a=[r[1],-r[0]],l=e.swing==="double"||e.swing==="sliding",c=(l?e.hinge==="start":e.swing==="left")?1:-1,{scale:u}=x(t),v=e.width_m/u,w=e.hinge==="start"?n[0]:n[1],b=l||e.hinge==="start"?n[1]:n[0],$=(G,ht)=>[G[0]+a[0]*ht/s,G[1]+a[1]*ht/i],S=[(n[0][0]+n[1][0])/2,(n[0][1]+n[1][1])/2],y=[{id:"width",at:b,label:"רוחב הדלת: גרירה לאורך הקיר"}],E=e.hinge==="start"?-1:1,V=Math.max(14,.3*v);return l||y.push({id:"hinge",at:[w[0]+r[0]*E*V/s,w[1]+r[1]*E*V/i],label:"החלף צד ציר"}),y.push({id:"swing",at:$(S,c*Math.max(18,.5*v)),label:l?"החלף את צד הפתיחה":"החלף כיוון פתיחה"}),y}function Ke(t){return{...t,hinge:t.hinge==="start"?"end":"start"}}function Nn(t){return t.swing==="double"||t.swing==="sliding"?Ke(t):{...t,swing:t.swing==="left"?"right":t.swing==="right"?"left":t.swing}}function Fn(t,e,s,i,o){const n=Z(t,e);if(!n)return e;const r=L(n,e.t,i,o),a=lt(n,e.t,i,o),l=Math.abs((s[0]-r[0])*i*a[0]+(s[1]-r[1])*o*a[1]);let d=at(2*l*x(t).scale,kt[0],kt[1]);return e.newWall||(d=Math.min(d,dt(n,t,i,o))),Kt(t,{...e,width_m:Vt(d)},i,o)}function Rn(t,e,s,i,o,n){let r=t,a=e.wallId;if(!a){if(!e.newWall)return null;const v=Ue(r,e.newWall.polyline,{thickness_m:e.newWall.thickness_m||o.thickness_m,kind:o.kind});r=it(v.doc,v.id,{external_ids:{origin:Tn},...n&&n!==C(v.doc)?{level_id:n}:{}}),a=v.id}const l=r.walls.find(v=>v.id===a);if(!l)return null;const[d,c]=ot(e.width_m,dt(l,r,s,i)),u=We(r,a,at(e.t,d,c),"door");return{doc:bt(u.doc,u.id,{width_m:e.width_m,swing:e.swing,hinge:e.hinge}),openingId:u.id,wallId:a}}function Zn(t,e,s,i){const o=e.wallId?t.walls.find(l=>l.id===e.wallId):null;if(!o)return null;const n=dt(o,t,s,i);let r=null,a=Number.POSITIVE_INFINITY;for(const l of t.openings){if(l.wall_id!==o.id)continue;const d=Math.abs(l.t-e.t)*n;d<Math.max(l.width_m,e.width_m)/2&&d<a&&(r=l,a=d)}return r}function Gn(t,e,s,i,o,n){const r=lt(e,s,o,n),a=L(e,s,o,n),l=(i[0]-a[0])*o*r[1]+(i[1]-a[1])*n*-r[0]>0;return Kt(t,{found:"default",note:"ברירת מחדל - בדוק",warning:null,wallId:e.id,newWall:null,t:s,width_m:Ht.door.width_m,hinge:"start",swing:l?"left":"right",confidence:.2},o,n)}function Bn(t,e,s,i,o){const n=Z(t,e);if(!n)return!1;const r=L(n,e.t,i,o),a=lt(n,e.t,i,o),l=(s[0]-r[0])*i,d=(s[1]-r[1])*o,c=e.width_m/x(t).scale;return Math.abs(l*a[0]+d*a[1])<=c/2&&Math.abs(l*a[1]-d*a[0])<=c}const Et={white:"לבן",tint:"גוון לכל חדר",none:"ללא מילוי"};async function Vn(t,e){const s=await ts(`plan-versions/${t}/stylize`,e);return{...s,source_url:q(s.source_url)+`?v=${Date.now()}`,stylized_url:q(s.stylized_url)+`?v=${Date.now()}`}}const Un=(t,e)=>es(`plan-versions/${t}`,{render_mode:e}),vt=["walls","openings","rooms","objects","labels","connectors","levels","circuits","groups"];function Le(t,e){if(!t)return"";const s=new Date(t);return Number.isNaN(s.getTime())?"":s.toLocaleString(e==="en"?"en-GB":"he-IL",{dateStyle:"short",timeStyle:"short"})}function Wn(t,e){if(t.diff.same)return h`<div class="pkg-line" data-pkg-nochange>${_("noChanges",e)}</div>`;const s=Object.keys(t.diff.collections).sort((i,o)=>vt.indexOf(i)+99*+(vt.indexOf(i)<0)-(vt.indexOf(o)+99*+(vt.indexOf(o)<0)));return h`<ul class="pkg-list" data-pkg-diff>
    ${s.map(i=>{const o=t.diff.collections[i],n=[o.added.length?`${_("added",e)} ${o.added.length}`:"",o.removed.length?`${_("removed",e)} ${o.removed.length}`:"",o.changed.length?`${_("changed",e)} ${o.changed.length}`:""].filter(Boolean);return h`<li data-pkg-coll=${i}><strong>${po(i,e)}</strong> <span>${n.join(" · ")}</span></li>`})}
    ${t.diff.calibration_changed?h`<li data-pkg-calibration>${_("calibration",e)}</li>`:p}
  </ul>`}function Hn(t,e){const s=t.entities,o=[["cameras",_("missing",e),s.anchors_missing.map(a=>a.name||a.resource_id)],["unplaced",_("unplaced",e),s.anchors_unplaced.map(a=>a.name||a.resource_id)],["rooms",_("rooms",e),s.rooms_missing],["switches",_("switches",e),s.switches_missing],["items",_("items",e),s.items_missing]].filter(([,,a])=>a.length),n=s.items_added.length?h`<li data-pkg-items-added><strong>${_("itemsAdded",e)}</strong> <bdi>${s.items_added.join(", ")}</bdi></li>`:p,r=s.items_differ.length?h`<li data-pkg-items-differ><strong>${_("itemsDiffer",e)}</strong> <bdi>${s.items_differ.join(", ")}</bdi></li>`:p;return!o.length&&n===p&&r===p?p:h`<div class="pkg-sec" data-pkg-missing>
    <div class="pkg-h">${_("missing",e)}</div>
    <ul class="pkg-list">
      ${o.map(([a,l,d])=>h`<li data-pkg-missing-kind=${a}><strong>${a==="cameras"?_("cameras",e):l}</strong> <bdi>${d.slice(0,12).join(", ")}${d.length>12?` +${d.length-12}`:""}</bdi></li>`)}
      ${n}${r}
    </ul>
  </div>`}function Kn(t,e){const s=uo(),i=t.preview,o=!!i&&(i.origin.trust!=="installation"||!!i.origin.retired_key),n=!!i&&!t.busy&&(!o||t.acceptForeign),r=!i&&t.foreign?t.foreign:null;return h`<sw-dialog open wide heading=${_("title",s)} subheading=${t.file.name} data-pkg-dialog ?locked=${t.busy==="import"} @close=${()=>e.cancel()}>
    <div class="modes" role="group" aria-label=${_("mode",s)}>
      ${["replace","merge"].map(a=>h`<button class=${t.mode===a?"on":""} aria-pressed=${t.mode===a} data-pkg-mode=${a} ?disabled=${!!t.busy} @click=${()=>e.setMode(a)}>${_(a,s)}</button>`)}
    </div>
    ${t.busy==="check"?h`<div class="note" data-pkg-checking>${_("checking",s)}</div>`:p}
    ${t.error?h`<div class="err" data-pkg-error>${t.error}</div>`:p}
    ${r?h`<div class="pkg-sec" data-pkg-origin data-pkg-gate>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${r.floor_name??""}</bdi> · ${_(r.stage==="draft"?"draft":"published",s)} · <bdi>${Le(r.generated_at,s)}</bdi></div>
            <div class="pkg-line warn" data-pkg-trust=${r.trust}>${_("signedForeign",s)}</div>
          </div>
          <label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${t.acceptForeign} ?disabled=${!!t.busy} @change=${a=>e.setAcceptForeign(a.target.checked)} /> ${_("trustForeign",s)}</label>`:p}
    ${i?h`<div class="pkg-sec" data-pkg-origin>
            <div class="pkg-h">${_("source",s)}</div>
            <div class="pkg-line"><bdi>${i.origin.floor_name??""}</bdi> · ${_(i.origin.stage==="draft"?"draft":"published",s)} · <bdi>${Le(i.origin.generated_at,s)}</bdi></div>
            <div class="pkg-line ${o?"warn":"ok"}" data-pkg-trust=${i.origin.trust}>${_(o?"signedForeign":"signedHere",s)}</div>
          </div>
          <div class="pkg-sec">
            <div class="pkg-h">${_("changes",s)}</div>
            ${Wn(i,s)}
            ${i.warnings.includes("other_drawing")?h`<div class="pkg-line warn" data-pkg-other-drawing>${_("otherDrawing",s)}</div>`:p}
            ${i.warnings.includes("newer_app_version")?h`<div class="pkg-line warn" data-pkg-newer>${_("newerApp",s)}</div>`:p}
            ${i.issue_count?h`<div class="pkg-line" data-pkg-issues>${_("issues",s)}: ${i.issue_count}</div>`:p}
          </div>
          ${Hn(i,s)}
          ${o?h`<label class="pkg-trust"><input type="checkbox" data-pkg-accept-foreign .checked=${t.acceptForeign} @change=${a=>e.setAcceptForeign(a.target.checked)} /> ${_("trustForeign",s)}</label>`:p}`:p}
    <sw-button slot="footer" variant="ghost" data-pkg-cancel ?disabled=${t.busy==="import"} @click=${()=>e.cancel()}>${_("cancel",s)}</sw-button>
    <sw-button slot="footer" icon="download" data-pkg-confirm ?disabled=${!n} @click=${()=>n&&e.confirm()}>${t.busy==="import"?_("importing",s):_("importDraft",s)}</sw-button>
  </sw-dialog>`}const qn=Wt`
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
`,Jn=t=>ss(`floors/${t}/images`),Yn=(t,e,s)=>{const i=new FormData;return i.append("variant",e),i.append("file",s,s.name||`${e}.png`),is(`floors/${t}/images`,i)},Xn=(t,e)=>os(`floors/${t}/images/${e}`),Qn=(t,e,s)=>ns(`floors/${t}/images/layout`,s===void 0?{corners:e}:{corners:e,opacity:s}),tr=t=>t?q(t.url):null;var er=Object.defineProperty,sr=Object.getOwnPropertyDescriptor,O=(t,e,s,i)=>{for(var o=i>1?void 0:i?sr(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&er(e,s,o),o};const ir=["פינה שמאלית-עליונה","פינה ימנית-עליונה","פינה ימנית-תחתונה","פינה שמאלית-תחתונה"];let z=class extends Be{constructor(){super(...arguments),this.planWidth=1e3,this.planHeight=700,this.planUrl=null,this.showPlan=!0,this.imageUrl=null,this.corners=[[0,0],[1,0],[1,1],[0,1]],this.opacity=.7,this.rooms=[],this.walls=[],this.disabled=!1,this.drag=null}willUpdate(){this.style.setProperty("--ar",`${this.planWidth} / ${this.planHeight}`)}toPlan(t){const e=this.getBoundingClientRect();return{x:(t.clientX-e.left)/e.width*this.planWidth,y:(t.clientY-e.top)/e.height*this.planHeight}}down(t,e,s){if(this.disabled||t.button!==0)return;t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId);const i=this.toPlan(t);this.drag={kind:e,index:s,startX:i.x,startY:i.y,start:this.corners.map(o=>[o[0],o[1]])}}move(t){const e=this.drag;if(!e)return;const s=this.toPlan(t),i=(s.x-e.startX)/this.planWidth,o=(s.y-e.startY)/this.planHeight,n=e.kind==="body"?Ss(e.start,i,o):re(e.start,e.index,{x:e.start[e.index][0]+i,y:e.start[e.index][1]+o});this.emit(n)}up(){this.drag=null}key(t,e){if(this.disabled)return;const s=t.shiftKey?10:1,i=t.key==="ArrowLeft"?-s:t.key==="ArrowRight"?s:0,o=t.key==="ArrowUp"?-s:t.key==="ArrowDown"?s:0;if(!i&&!o)return;t.preventDefault();const n=this.corners[e];this.emit(re(this.corners,e,{x:n[0]+i/this.planWidth,y:n[1]+o/this.planHeight}))}emit(t){this.corners=t,this.dispatchEvent(new CustomEvent("corners-change",{detail:{corners:t},bubbles:!0,composed:!0}))}render(){const t=this.planWidth,e=this.planHeight,s=Ds(this.corners,t,e),i=this.corners.map(r=>`${(r[0]*t).toFixed(1)},${(r[1]*e).toFixed(1)}`).join(" "),o=Math.max(t,e)*.012,n=Is(this.corners,t,e);return h`<svg viewBox=${`0 0 ${t} ${e}`} role="application" aria-label="יישור תמונת הקומה" @pointermove=${this.move} @pointerup=${this.up} @pointercancel=${this.up}>
      ${this.planUrl&&this.showPlan?J`<image href=${this.planUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity="0.35" />`:p}
      ${this.imageUrl?J`<image data-align-image href=${this.imageUrl} x="0" y="0" width=${t} height=${e} preserveAspectRatio="none" opacity=${this.opacity} transform=${zs(s)} />`:p}
      ${this.rooms.map(r=>J`<polygon class="room" points=${r.polygon.map(a=>`${(a.x*t).toFixed(1)},${(a.y*e).toFixed(1)}`).join(" ")} />`)}
      ${this.walls.map(r=>J`<line class="wall" x1=${(r[0][0]*t).toFixed(1)} y1=${(r[0][1]*e).toFixed(1)} x2=${(r[1][0]*t).toFixed(1)} y2=${(r[1][1]*e).toFixed(1)} />`)}
      <polygon class="frame" points=${i} />
      <polygon class="body" data-align-body points=${i} @pointerdown=${r=>this.down(r,"body",-1)} />
      ${this.corners.map((r,a)=>(Ms(s,a===0?{x:0,y:0}:a===1?{x:t,y:0}:a===2?{x:t,y:e}:{x:0,y:e}),J`<circle class="handle" data-align-handle=${a} tabindex=${this.disabled?-1:0} role="slider" aria-label=${ir[a]} aria-valuetext=${`${Math.round(r[0]*100)}%, ${Math.round(r[1]*100)}%`}
          cx=${(r[0]*t).toFixed(1)} cy=${(r[1]*e).toFixed(1)} r=${o.toFixed(1)} @pointerdown=${l=>this.down(l,"corner",a)} @keydown=${l=>this.key(l,a)} />`))}
    </svg>
    ${n>.002?h`<div class="res" data-align-residual>סטייה ${(n*100).toFixed(1)}% - תמונה בפרספקטיבה; היישור מקורב</div>`:p}`}};z.styles=Wt`
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
  `;O([M({type:Number})],z.prototype,"planWidth",2);O([M({type:Number})],z.prototype,"planHeight",2);O([M()],z.prototype,"planUrl",2);O([M({type:Boolean})],z.prototype,"showPlan",2);O([M()],z.prototype,"imageUrl",2);O([M({attribute:!1})],z.prototype,"corners",2);O([M({type:Number})],z.prototype,"opacity",2);O([M({attribute:!1})],z.prototype,"rooms",2);O([M({attribute:!1})],z.prototype,"walls",2);O([M({type:Boolean})],z.prototype,"disabled",2);O([m()],z.prototype,"drag",2);z=O([Ve("sw-floor-image-align")],z);const qt={maxDistance:.35,fovWeight:.5,maxSuggestions:3},or=3;function qe(t){const e=qt,s=(i,o,n,r)=>typeof i=="number"&&Number.isFinite(i)&&i>=o&&i<=n?i:r;return{maxDistance:s(t?.maxDistance,1e-6,1,e.maxDistance),fovWeight:s(t?.fovWeight,0,1,e.fovWeight),maxSuggestions:Math.round(s(t?.maxSuggestions,1,or,e.maxSuggestions))}}const nt=(t,e)=>({x:t.x,y:t.y/e});function nr(t,e,s){const i=s.x-e.x,o=s.y-e.y,n=i*i+o*o;if(n===0)return Math.hypot(t.x-e.x,t.y-e.y);const r=Math.max(0,Math.min(1,((t.x-e.x)*i+(t.y-e.y)*o)/n));return Math.hypot(t.x-(e.x+r*i),t.y-(e.y+r*o))}function rr(t,e,s=1){if(e.length<3)return 1/0;if(Bt(t,e))return 0;const i=nt(t,s);let o=1/0;for(let n=0;n<e.length;n++)o=Math.min(o,nr(i,nt(e[n],s),nt(e[(n+1)%e.length],s)));return o}function ar(t){const e=[];let s=0,i=0;for(let o=0;o<t.length;o++){const n=t[o],r=t[(o+1)%t.length];e.push(n,{x:(n.x+r.x)/2,y:(n.y+r.y)/2}),s+=n.x,i+=n.y}return e.push({x:s/t.length,y:i/t.length}),e}function lr(t,e,s=1){const i=nt(t,s),o=nt(e,s);return(Math.atan2(o.x-i.x,-(o.y-i.y))*180/Math.PI+360)%360}function dr(t,e,s,i,o=1){const n=ar(i),r=Math.max(0,Math.min(360,s))/2;let a=0;for(const l of n){if(Math.hypot(l.x-t.x,(l.y-t.y)/o)<1e-9){a++;continue}Math.abs((lr(t,l,o)-e+540)%360-180)<=r+1e-9&&a++}return a/n.length}function hr(t,e,s={},i={}){const o=qe({...qt,...s}),n=i.aspect&&i.aspect>0?i.aspect:1;if(t.polygon.length<3)return[];const r=new Set(i.exclude??[]),a=[];for(const l of e){if(r.has(l.id)||l.floorId!==t.floorId||t.levelId&&l.levelId&&t.levelId!==l.levelId)continue;const d=rr(l.position,t.polygon,n);if(d>o.maxDistance)continue;const c=l.fovDeg!=null&&l.fovDeg>0?dr(l.position,l.rotationDeg,l.fovDeg,t.polygon,n):null;if(c!==null&&c===0&&o.fovWeight>=1)continue;const u=d/o.maxDistance+(c===null?0:o.fovWeight*(1-c));a.push({id:l.id,distance:d,inside:d===0,facing:c,score:u})}return a.sort((l,d)=>l.score-d.score||l.distance-d.distance||(l.id<d.id?-1:1)),a.slice(0,o.maxSuggestions)}function cr(t,e){const s=new Map((e.circuits??[]).map(o=>[o.id,o.power_w])),i={...t,connectors:e.connectors??t.connectors,circuits:t.circuits.map(o=>s.has(o.id)?{...o,power_w:s.get(o.id)}:o)};if(!e.shared_spaces?.length&&!t.shared_spaces?.length)return i;for(const o of Je){const n=(i[o]??[]).filter(a=>!yt(a)),r=(e[o]??[]).filter(a=>yt(a));i[o]=[...n,...r]}return i.shared_spaces=e.shared_spaces,i}const Je=["walls","openings","objects","labels","circuits","groups","levels"],Ut=["connectors",...Je];function R(t,e){const s=t[e]??[];return e==="connectors"?s:s.filter(i=>yt(i))}function jt(t,e){return e==="connectors"?[]:(t[e]??[]).filter(s=>!yt(s))}function ur(t){return`המדרגות ב${[...new Set(t.map(s=>s.name))].join(" וב")} לא עודכנו - אין לך הרשאת עריכה שם`}const Ee=(t,e)=>JSON.stringify(t)===JSON.stringify(e),pr=t=>{const{far:e,...s}=t;return JSON.stringify(s)},rt=t=>new Map(t.map(e=>[e.id,pr(e)]));function gr(t,e,s){const i=new Set([...Object.keys(t),...Object.keys(s)]);for(const r of i)if(r!=="shared_spaces"){if(Ut.includes(r)){if(!Ee(jt(t,r),jt(s,r)))return null}else if(!Ee(t[r],s[r]))return null}let o=!1;const n={...e,shared_spaces:s.shared_spaces};for(const r of Ut){const a=rt(R(t,r)),l=rt(R(e,r)),d=rt(R(s,r)),c=[...new Set([...a.keys(),...l.keys(),...d.keys()])],u=new Set(c.filter($=>a.get($)!==l.get($))),v=c.filter($=>a.get($)!==d.get($));if(v.some($=>u.has($)))return null;v.length&&(o=!0);const w=new Map(R(e,r).map($=>[$.id,$])),b=R(s,r).flatMap($=>u.has($.id)?w.has($.id)?[w.get($.id)]:[]:[$]);for(const $ of R(e,r))u.has($.id)&&!d.has($.id)&&b.push($);n[r]=[...jt(e,r),...b]}return o?n:null}function fr(t,e){const s=new Map;for(const i of Ut){const o=rt(R(t,i)),n=rt(R(e,i)),r=[...new Set([...o.keys(),...n.keys()])].filter(a=>o.get(a)!==n.get(a));r.length&&s.set(i,new Set(r))}return s}function je(t,e,s){if(!s.size)return t;const i={...t,shared_spaces:e.shared_spaces??t.shared_spaces};for(const[o,n]of s){const r=new Map((e[o]??[]).map(d=>[d.id,d])),a=(t[o]??[]).flatMap(d=>n.has(d.id)?r.has(d.id)?[r.get(d.id)]:[]:[d]),l=new Set(a.map(d=>d.id));for(const d of e[o]??[])n.has(d.id)&&!l.has(d.id)&&a.push(d);i[o]=a}return i}const mr={load:t=>Jo(t,{draft:!0}),save:(t,e,s)=>qo(t,e,s)};class vr{constructor(e,s=mr,i=2e3){this.host=e,this.api=s,this.delayMs=i,this.doc=null,this.revision=0,this.hash=null,this.publishedHash=null,this.issues=[],this.copyCandidates=[],this.saveState="idle",this.error="",this.claimed=new Map,this.sharedPending=[],this.onNotice=null,this.versionId=null,this.base=null,this.rebased=!1,this.undoStack=[],this.redoStack=[],this.dirty=!1,this.inflight=null,this.conflicted=!1,this.loadToken=0,this.loaded=0,e.addController(this)}hostConnected(){}hostDisconnected(){clearTimeout(this.timer)}get canUndo(){return this.undoStack.length>0}get canRedo(){return this.redoStack.length>0}get hasConflict(){return this.conflicted}get pendingPublish(){const e=this.doc;return e&&this.sharedPending.some(s=>(s.changes??0)>0)?!0:!e||!this.hash||this.hash===this.publishedHash?!1:this.publishedHash!==null||e.walls.length>0||e.openings.length>0||e.labels.length>0||e.objects.length>0||e.connectors.length>0}async load(e){clearTimeout(this.timer);const s=++this.loadToken;let i;try{i=await this.api.load(e)}catch(o){if(s===this.loadToken)throw o;return}s===this.loadToken&&(this.loaded=s,this.versionId=e,this.apply(i),this.doc=i.doc,this.base=i.doc,this.rebased=!1,this.copyCandidates=i.copy_candidates??[],this.undoStack=[],this.redoStack=[],this.dirty=!1,this.conflicted=!1,this.saveState="idle",this.error="",this.host.requestUpdate())}commit(e){if(!this.doc)return;const s=Rs(this.doc,e);this.claimed=s.claimed,e=s.doc,this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.change(e)}undo(){const e=this.undoStack.pop();!e||!this.doc||(this.redoStack.push(this.doc),this.change(e))}redo(){const e=this.redoStack.pop();!e||!this.doc||(this.undoStack.push(this.doc),this.change(e))}adopt(e){return!this.doc||!this.versionId||e.doc.plan_version_id!==this.versionId||this.dirty||this.inflight?!1:(clearTimeout(this.timer),this.undoStack=[...this.undoStack.slice(-59),this.doc],this.redoStack=[],this.apply(e),this.doc=e.doc,this.base=e.doc,this.dirty=!1,this.conflicted=!1,this.saveState="saved",this.error="",this.host.requestUpdate(),!0)}async flush(){clearTimeout(this.timer);let e=!1;for(;;){if(this.inflight){await this.inflight;continue}if(!this.dirty||this.conflicted||e&&this.saveState==="error")break;e=!0,this.inflight=this.saveOnce(),await this.inflight,this.inflight=null}return!this.dirty&&this.saveState!=="error"}change(e){this.doc=e,this.dirty=!0,clearTimeout(this.timer),this.conflicted||(this.saveState!=="saving"&&(this.saveState="pending"),this.timer=setTimeout(()=>void this.flush(),this.delayMs)),this.host.requestUpdate()}apply(e){this.revision=e.geometry.revision,this.hash=e.geometry.doc_hash,this.publishedHash=e.published_hash,this.issues=e.issues,this.sharedPending=e.shared_pending??[];const s=e.twins_skipped??[];s.length&&this.onNotice?.(ur(s))}async rebase(e,s){if(!this.base||this.rebased)return!1;let i;try{i=await this.api.load(e)}catch{return!1}if(s!==this.loaded||!this.doc)return!1;const o=gr(this.base,this.doc,i.doc);if(!o)return!1;this.rebased=!0;const n=fr(this.base,i.doc);return this.undoStack=this.undoStack.map(r=>je(r,i.doc,n)),this.redoStack=this.redoStack.map(r=>je(r,i.doc,n)),this.apply(i),this.base=i.doc,this.doc=o,this.dirty=!0,this.saveState="pending",this.error="",!0}async saveOnce(){const e=this.doc,s=this.versionId,i=this.loaded;if(!e||!s){this.dirty=!1;return}this.dirty=!1,this.saveState="saving",this.host.requestUpdate();try{const o=Zs(this.base,e),n=await this.api.save(s,o.length?{...e,shared_deleted:o}:e,this.revision);if(i!==this.loaded)return;this.apply(n),n.doc&&(this.base=n.doc),this.rebased=!1,this.doc===e&&n.doc&&(this.doc=cr(e,n.doc)),this.saveState=this.dirty?"pending":"saved",this.error=""}catch(o){if(i!==this.loaded)return;if(this.dirty=!0,o instanceof P&&o.code==="stale_revision"){if(await this.rebase(s,i))return;this.conflicted=!0}this.saveState="error",this.error=this.conflicted?"הקומה עודכנה מקומה אחרת או במקום אחר; טען מחדש את העורך כדי לא לדרוס שינוי (שינויים שלא נשמרו כאן לא יישמרו).":k(o)}finally{this.host.requestUpdate()}}}var wr=Object.defineProperty,br=Object.getOwnPropertyDescriptor,f=(t,e,s,i)=>{for(var o=i>1?void 0:i?br(e,s):e,n=t.length-1,r;n>=0;n--)(r=t[n])&&(o=(i?r(e,s,o):r(o))||o);return i&&o&&wr(e,s,o),o};const Ne=15e3,Fe=t=>t instanceof DOMException&&(t.name==="TimeoutError"||t.name==="AbortError")?"השרת לא ענה בזמן":k(t),wt=["var(--sw-hue-7)","var(--sw-hue-6)","var(--sw-hue-1)","var(--sw-hue-4)","var(--sw-hue-5)","var(--sw-hue-2)"],yr=[{id:"select",icon:"target",label:"בחירה וגרירה",ready:!0},{id:"camera",icon:"camera",label:"הוספת מצלמה",ready:!0},{id:"lights",icon:"light",label:"הוספת תאורה (מפסקים)",ready:!0},{id:"entity",icon:"plus",label:"התקן אחר",ready:!0},{id:"zones",icon:"map",label:"חדרים ואזורים",ready:!0},{id:"structure",icon:"wall",label:"מבנה: קירות, דלתות וחלונות",ready:!0},{id:"library",icon:"grid",label:"ספריית עצמים",ready:!0},{id:"connectors",icon:"stairs",label:"מפלסים ומחברים",ready:!0},{id:"circuits",icon:"bolt",label:"מעגלי תאורה",ready:!0},{id:"calibrate",icon:"scale",label:"כיול קנה מידה",ready:!0},{id:"walk",icon:"route",label:"עמדות סיור",ready:!0},{id:"measure",icon:"ruler",label:"מדידת מרחק ושטח",ready:!0},{id:"detect",icon:"sparkle",label:"זיהוי אוטומטי של קירות ופתחים",ready:!0},{id:"layers",icon:"layers",label:"שכבות",ready:!0}],Nt=["structure","library","connectors","circuits","calibrate","walk","measure","detect"],B={a:null,b:null,metres:"",result:"",warning:"",pairs:[]},T=Object.freeze([]),kr=1e3,$r=["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"],Re=t=>{try{const e=JSON.parse(localStorage.getItem(t)??"[]");return Array.isArray(e)?e.filter(s=>typeof s=="string"):[]}catch{return[]}},xr=t=>{try{const e=Number(localStorage.getItem(`sw.editor.gridStep.${t}`));return{on:localStorage.getItem(`sw.editor.grid.${t}`)==="1",stepM:He.includes(e)?e:Gt}}catch{return{on:!1,stepM:Gt}}},Ze=(t,e)=>{try{localStorage.setItem(t,JSON.stringify(e.slice(0,40)))}catch{}},H=t=>Math.round(t*1e3)/1e3,F=10,Ft=14,_r=6,Rt=(t,e)=>`${I(t,"קיר אחד","קירות")}, ${I(e,"פתח אחד","פתחים")}`,Ge=[{id:"cameras",label:"מצלמות"},{id:"doors",label:"דלתות ומנעולים"},{id:"lights",label:"תאורה ומתגים"},{id:"sensors",label:"חיישנים"}],Sr={asset:"קובץ",page:"עמוד",rotation:"סיבוב",crop:"חיתוך",width_px:"רוחב",height_px:"גובה"},K=t=>t?$s(new Date(t)):"";let g=class extends Be{constructor(){super(...arguments),this.floorId="",this.presetEntity="",this.presetCandidates="",this.presetZone="",this.bundle=null,this.anchors=[],this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId=null,this.tool="select",this.panMode=!1,this.shortcutsOpen=!1,this.layers=new Set(["cameras","doors","lights","sensors"]),this.planImage=!0,this.grid={on:!1,stepM:Gt},this.guides=[],this.placing=null,this.entQ="",this.entResults=null,this.entBusy=!1,this.lightsAll=!1,this.busy=!1,this.error="",this.info="",this.pkgImport=null,this.stylizing=!1,this.stylized=null,this.stylizeOpts={strength:"medium",keepLines:!1,roomFill:"white"},this.zones=[],this.versions=[],this.geomVersions=[],this.areas=[],this.floorImages=null,this.alignDraft=null,this.alignShowPlan=!0,this.imageBusy=!1,this.imageNote="",this.diff=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.lastEdit=null,this.candidates=null,this.detecting=!1,this.detectStrength="medium",this.replaceAuto=!0,this.drawing=null,this.showZones=!0,this.zoneBusy=!1,this.studio=new vr(this),this.studioVersion=null,this.studioMode="wall",this.curveDraft=null,this.curveRedo=[],this.glassDraw={...go},this.doorGhost=null,this.doorAsking=!1,this.doorToken=0,this.wallDefaults={thickness_m:.2,kind:"interior"},this.geomSel=null,this.multi=[],this.zonePreview=null,this.zoneSaving=!1,this.multiNote="",this.multiCache=null,this.geomPreview=null,this.nudgeBurst=null,this.library=null,this.libLookup=null,this.libQ="",this.libCategory=null,this.libRecent=Re("sw.studio.recent"),this.libFav=Re("sw.studio.fav"),this.placingItem=null,this.bindOffer=null,this.dupId=null,this.bindRefused=new Set,this.phone=window.matchMedia("(max-width: 767px)"),this.arrayDialog=null,this.groupDelete=null,this.customDialog=null,this.levelFilter=null,this.levelDialog=null,this.matStyle=rs(),this.walkArmed=null,this.walkFocus=null,this.site={...Te,known:!1},this.matMemo=null,this.connMode=null,this.connStart=null,this.linkTargets=[],this.sharedLevels=!0,this.shareDlg=null,this.linkTargetsFor=null,this.stairShape="straight",this.twinDelete=null,this.linkConfirm=null,this.linkBusy=!1,this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,this.circuitTimer=0,this.wallDraft=null,this.lastDrawClick=null,this.hover=null,this.calib={...B},this.measurePts=[],this.geomDiff=null,this.showEstimates=!0,this.camSuggestCfg=qt,this.camSuggestions=null,this.zoneCamera=null,this.zoneCameraFor=null,this.detectOpts={walls:!0,openings:!0,strength:.6,replaceAuto:!0,hollow:!0},this.detectRun={busy:!1,startedAt:0,elapsed:0,error:"",timedOut:!1,limitS:null},this.detectToken=0,this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.candStatesShown=null,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null,this.narrow=!1,this.onNarrow=()=>this.narrow=this.phone.matches,this.entTimer=0,this.entSeq=0,this.infoTimer=0,this.errorTimer=0,this.memos=new Map,this.dragMoveFrame=0,this.dragMovePending=null,this.onKey=t=>this.handleKey(t),this.anchorPosCache=null,this.guideCache=null}connectedCallback(){super.connectedCallback(),this.studio.onNotice=t=>{this.flash(t,7e3)},this.load(),window.addEventListener("keydown",this.onKey),this.narrow=this.phone.matches,this.phone.addEventListener("change",this.onNarrow),this.presetEntity&&(this.tool="entity",this.entQ=this.presetEntity,this.searchEntities())}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),this.phone.removeEventListener("change",this.onNarrow),clearInterval(this.elapsedTimer),window.clearTimeout(this.infoTimer),window.clearTimeout(this.errorTimer),this.infoTimer=this.errorTimer=0,this.cancelDragMove(),this.studio.flush()}async realign(t){if(!(!this.bundle||this.busy)){this.busy=!0;try{const e=await as(this.bundle.floorId,t);this.error=e.moved||!e.skipped?"":`${e.skipped} פריטים לא ניתנים ליישור אוטומטי (שרטוט אחר) — בדוק אותם ולחץ "אשר מיקומים".`,await this.load()}catch(e){this.error=k(e)}finally{this.busy=!1}}}async load(){this.error="";try{const t=await ls(this.floorId||"f0",!0),e=!this.bundle||this.bundle.floorId!==t.floorId;if(e){this.levelFilter=null,this.linkTargets=[],this.linkTargetsFor=null;try{this.planImage=localStorage.getItem(`sw.editor.background.${t.floorId}`)!=="0"}catch{this.planImage=!0}this.grid=xr(t.floorId)}this.bundle=t,this.loadStudio(t),this.loadLibraryFor(t),ds().then(s=>{this.sharedLevels=s["map.shared_levels"]!=="hide",this.camSuggestCfg=qe({maxDistance:Number(s["plan.camsuggest_distance"])/100,fovWeight:Number(s["plan.camsuggest_fov"])/100,maxSuggestions:Number(s["plan.camsuggest_count"])}),this.showEstimates=s["plan.estimates"]!=="false";const i=Number(s["site.latitude"]),o=Number(s["site.longitude"]),n=s["site.latitude"]!==null&&s["site.latitude"]!==void 0&&Number.isFinite(i)&&Number.isFinite(o);this.site=n?{latitude:i,longitude:o,known:n}:{...Te,known:!1},e&&this.bundle===t&&(this.levelFilter=Gs(s["plan.levels"],t))}).catch(()=>{}),this.anchors=t.anchors.filter(s=>s.resource_type!=="camera"||ut("nvr")||_t(s.camera)).map(s=>({...s,position:{...s.position}})),this.zones=t.zones,this.loadVersions(),this.selectedZoneId&&!this.zones.some(s=>s.id===this.selectedZoneId)&&(this.selectedZoneId=null),this.presetZone&&this.zones.some(s=>s.id===this.presetZone)&&(this.selectedZoneId=this.presetZone,this.selectedId=null),this.presetZone="",this.dirty=new Set,this.undo=[],this.redo=[],this.selectedId&&!this.anchors.some(s=>s.id===this.selectedId)&&(this.selectedId=null)}catch(t){this.error=k(t)}}get selected(){return this.anchors.find(t=>t.id===this.selectedId)}layerOf(t){return t.resource_type==="camera"?"cameras":t.layer_id==="doors"?"doors":t.layer_id==="lights"?"lights":"sensors"}memo(t,e,s){const i=this.memos.get(t);if(i&&Mn(i.keys,e))return i.value;const o=s();return this.memos.set(t,{keys:e,value:o}),o}get markers(){return this.memo("markers",[this.anchors,this.layers,this.studio.doc,this.activeLevel,this.bundle?.source],()=>this.buildMarkers())}buildMarkers(){return this.anchors.filter(t=>this.layers.has(this.layerOf(t))&&this.onLevel(t)).map(t=>({id:t.id,kind:t.resource_type==="camera"?"camera":cs(t.layer_id,t.entity?.domain),label:this.anchorName(t),x:t.position.x,y:t.position.y,rotation:t.rotation_degrees,fov:t.field_of_view_degrees??void 0,radius:t.coverage_radius??void 0,polygon:t.coverage_polygon?t.coverage_polygon.map(([e,s])=>({x:e,y:s})):void 0,labelPos:t.label_pos??void 0,level:t.level_id??null,state:t.resource_type==="camera"?this.bundle?.source==="demo"?"live":hs(t):"neutral"}))}anchorName(t){return t.resource_type==="camera"?t.camera?.name??t.label??t.resource_id:t.label??t.entity?.name??t.resource_id}get selectedZone(){return this.zones.find(t=>t.id===this.selectedZoneId)}get planZones(){return this.showZones?this.memo("planZones",[this.zones,this.zonePreview,this.candidates],()=>this.buildPlanZones()):T}buildPlanZones(){const t=this.zonePreview,e=this.zones.map(i=>({id:i.id,name:i.name,kind:i.kind,color:i.color,polygon:t?.[i.id]??i.polygon,labelPos:i.label_pos,chip:St(i.shared)})),s=(this.candidates??[]).map((i,o)=>({id:`cand-${o}`,name:i.include?i.name:"",color:i.include?wt[o%wt.length]:"var(--sw-offline)",polygon:i.polygon,candidate:!0}));return[...e,...s]}async detect(){const t=this.bundle;if(t){if(t.source==="demo"){this.info="נתוני הדגמה: הזיהוי עובד מול השרת.";return}this.detecting=!0,this.error="";try{const e=await Yi(t.floorId,this.detectStrength);this.candidates=e.rooms.map((s,i)=>({polygon:s.polygon,name:`חדר ${i+1}`,kind:"room",include:!0})),this.selectedZoneId=null,this.selectedId=null,this.flash(e.rooms.length?`${e.rooms.length} חדרים זוהו · תן שמות ושמור`:"לא זוהו חדרים סגורים; נסה עוצמה אחרת או צייר אזור ידנית",5e3)}catch(e){this.error=k(e)}finally{this.detecting=!1}}}setCandidate(t,e){this.candidates&&(this.candidates=this.candidates.map((s,i)=>i===t?{...s,...e}:s))}async acceptCandidates(){const t=this.bundle,e=(this.candidates??[]).filter(s=>s.include);if(!(!t||!e.length)){this.zoneBusy=!0,this.error="";try{const s=await xe(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name,kind:i.kind})),this.replaceAuto);this.candidates=null,this.zones=s.zones,this.flash(`${s.created.length} חדרים נשמרו`,3e3)}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}}startDrawing(){this.drawing=[],this.placing=null,this.candidates=null,this.selectedZoneId=null,this.selectedId=null}addDraftPoint(t,e){const s=this.drawing,i=this.bundle;if(!(!s||!i)){if(s.length>=3){const o=this.canvas?.zoom??1;if(Math.hypot((t-s[0].x)*i.width*o,(e-s[0].y)*i.height*o)<12){this.finishDrawing();return}}this.drawing=[...s,{x:+t.toFixed(4),y:+e.toFixed(4)}]}}async finishDrawing(){const t=this.drawing,e=this.bundle;if(!(!t||!e||t.length<3)){if(e.source==="demo"){this.info="נתוני הדגמה: השמירה עובדת מול השרת.",this.drawing=null;return}this.zoneBusy=!0,this.error="";try{const s=await Xi(e.floorId,{name:`אזור ${this.zones.length+1}`,kind:"zone",polygon:t});this.drawing=null,this.zones=[...this.zones,s],this.selectedZoneId=s.id,this.flash("האזור נוצר · תן לו שם",3e3)}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}}async patchZone(t,e){if(this.bundle?.source!=="demo"){this.zoneBusy=!0,this.error="";try{const s=await this.sendZonePatch(t,e);s==="conflict"?(this.error="האזור השתנה בינתיים על ידי עורך אחר; נטען מחדש בלי לדרוס.",await this.load()):s!=="ok"&&(this.error=s)}finally{this.zoneBusy=!1}}}async sendZonePatch(t,e){try{const s=t.shared?.role==="mirror",i=await Qi(t.id,{revision:t.revision,...e},AbortSignal.timeout(Ne),s?this.bundle?.floorId:void 0);return this.zones=this.zones.map(o=>o.id===i.id?s?{...i,polygon:e.polygon??o.polygon,level_id:o.level_id,shared:o.shared,floor_id:o.floor_id}:{...i,shared:o.shared}:o),"ok"}catch(s){return s instanceof P&&s.status===409?"conflict":Fe(s)}}async removeZone(t){if(this.bundle?.source==="demo")return;if(t.shared?.role==="mirror")return this.unshare(t,this.bundle.floorId);const e=t.shared?.role==="home",s=(t.shared?.floors??[]).map(i=>D(i.name)).join(", ");if(window.confirm(e?`למחוק את "${t.name}"?
החדר משותף עם ${s}. המחיקה תבטל את השיתוף, תסיר את חברי החלל ותמחק את האזור. המצלמות והישויות לא נמחקות.`:`למחוק את "${t.name}"? המצלמות והישויות בקומה לא מושפעות.`)){this.zoneBusy=!0,this.error="";try{const i=await this.sendZoneDelete(t,e);i!=="ok"?this.error=i:e&&await this.reloadShared()}finally{this.zoneBusy=!1}}}async sendZoneDelete(t,e=!1){try{return await to(t.id,AbortSignal.timeout(Ne),e),this.zones=this.zones.filter(s=>s.id!==t.id),this.selectedZoneId===t.id&&(this.selectedZoneId=null),"ok"}catch(s){return Fe(s)}}async unshare(t,e){const s=t.shared?.role==="mirror"?t.shared.home_floor_name:t.shared?.floors?.find(i=>i.floor_id===e)?.name??"";if(window.confirm(`לבטל את השיתוף של "${t.name}"? התוכן של החדר יישאר רק ב${t.shared?.role==="mirror"?s:"קומה הזו"}${t.shared?.role==="mirror"?" ולא יוצג כאן":` ולא יוצג ב${s}`}, והמצלמות וההתקנים שלו יפסיקו להיות משותפים. מה שהוסר בזמן השיתוף (התוכן הכפול) לא יחזור.`)){this.zoneBusy=!0,this.error="";try{await eo(t.id,e),this.selectedZoneId=null,await this.reloadShared()}catch(i){this.error=k(i)}finally{this.zoneBusy=!1}}}async gotoHomeFloor(t){const e=t.shared;!e||e.role!=="mirror"||!e.home_floor_id||this.dirty.size&&!await this.save()||await this.studio.flush()&&Y(`/explore/floors/${e.home_floor_id}/edit`,{zone:e.zone_id})}async setShareMember(t,e,s){if(!(this.dirty.size&&!await this.save())){this.zoneBusy=!0,this.error="";try{s?await so(e,t.resource_type,t.resource_id):await io(e,t.resource_type,t.resource_id),this.flash(s?"נוסף לחלל המשותף: מוצג בשתי הקומות":"הוסר מהחלל המשותף: מוצג רק בקומה שלו",4e3),await this.reloadShared()}catch(i){this.error=k(i)}finally{this.zoneBusy=!1}}}async reloadShared(){await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0)}async openShare(t){const e=this.bundle;if(!(!e||!e.planVersionId||e.source==="demo")){this.shareDlg={zone:t,floors:[],floorId:"",homeHere:!0,otherZones:[],otherZoneId:"",duplicateId:null,preview:null,busy:!0,error:""};try{const s=e.floorLevel??0,i=[...(await Me(e.planVersionId)).floors].sort((o,n)=>Math.abs(o.level-s)-Math.abs(n.level-s)||o.level-n.level);this.shareDlg={...this.shareDlg,floors:i,busy:!1},i.length&&await this.pickShareFloor(i[0].floor_id)}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:k(s)}}}}async pickShareFloor(t){const e=this.shareDlg,s=this.bundle;if(!e||!s)return;const i=e.floors.find(r=>r.floor_id===t),o=s.floorLevel??0,n=i?o<=i.level:!0;this.shareDlg={...e,floorId:t,homeHere:n,preview:null,duplicateId:null,error:"",busy:!0};try{const r=(await oo(t)).zones.filter(l=>!l.shared),a=r.find(l=>l.name.trim()===e.zone.name.trim())??null;this.shareDlg={...this.shareDlg,otherZones:r,otherZoneId:a?.id??r[0]?.id??"",duplicateId:a?.id??null,busy:!1},await this.previewShareNow()}catch(r){this.shareDlg={...this.shareDlg,busy:!1,error:k(r)}}}shareRequest(){const t=this.shareDlg,e=this.bundle;return!t||!e||!t.floorId?null:t.homeHere?{zoneId:t.zone.id,body:{floor_id:t.floorId,duplicate_zone_id:t.duplicateId,auto:t.duplicateId===null}}:t.otherZoneId?{zoneId:t.otherZoneId,body:{floor_id:e.floorId,duplicate_zone_id:t.zone.id,auto:!1}}:null}async previewShareNow(){const t=this.shareRequest();if(t){this.shareDlg={...this.shareDlg,busy:!0,error:""};try{const e=await no(t.zoneId,t.body);this.shareDlg={...this.shareDlg,preview:e,busy:!1}}catch(e){this.shareDlg={...this.shareDlg,preview:null,busy:!1,error:k(e)}}}}async applyShare(){const t=this.shareRequest(),e=this.shareDlg;if(!(!t||!e?.preview)){if(!await this.studio.flush()){this.shareDlg={...e,error:"שמור את טיוטת המבנה לפני השיתוף."};return}this.shareDlg={...e,busy:!0,error:""};try{const s=e.homeHere?{...t.body,duplicate_zone_id:e.preview.duplicate?.zone_id??null,auto:!1}:t.body;await ro(t.zoneId,s),this.shareDlg=null,this.selectedZoneId=null,this.flash("החדר משותף עכשיו לשתי הקומות",4e3),await this.reloadShared()}catch(s){this.shareDlg={...this.shareDlg,busy:!1,error:k(s)}}}}renderShareDialog(){const t=this.shareDlg,e=this.bundle;if(!t||!e)return p;const s=t.floors.find(l=>l.floor_id===t.floorId),i=t.preview,o=(l,d,c)=>l?I(l,d,c):"",n=i?[o(i.remove.objects,"עצם אחד","עצמים"),o(i.remove.walls,"קיר פנימי אחד (ציור כפול של המגרש)","קירות פנימיים (ציור כפול של המגרש)"),o(i.remove.openings,"פתח אחד","פתחים"),o(i.remove.labels,"תווית אחת","תוויות"),o(i.remove.connectors,"מחבר אחד","מחברים")].filter(Boolean):[],r={member:"משותף - נשאר במקומו",drop_duplicate:"עותק כפול - יוסר",kept:"מוצב גם במקום אחר בקומה של החדר - נשאר, לא משותף"},a=i?i.other_floor.name:"";return h`<sw-dialog open heading="הפוך לחלל משותף" subheading=${t.zone.name} data-share-dialog @close=${()=>this.shareDlg=null}>
      <div class="note">חלל משותף הוא חדר אחד ששייך לשתי קומות (חלל בגובה כפול): כל קומה שומרת את המתאר והקירות שלה, התוכן נשמר פעם אחת, מוצג בשתי הקומות ואפשר לערוך אותו משתיהן.</div>
      ${t.floors.length?h`<sw-field label="הקומה השנייה"><select data-share-floor @change=${l=>this.pickShareFloor(l.target.value)}>${t.floors.map(l=>h`<option value=${l.floor_id} ?selected=${l.floor_id===t.floorId}>${D(l.name)}</option>`)}</select></sw-field>`:t.busy?p:h`<div class="err">אין בבניין קומה נוספת שמותר לך לערוך.</div>`}
      ${s?h`<sw-field label="איפה הרצפה של החדר" hint="ברירת המחדל: הקומה התחתונה (המגרש)"><select data-share-home @change=${l=>{this.shareDlg={...this.shareDlg,homeHere:l.target.value==="here",preview:null},this.previewShareNow()}}>
            <option value="here" ?selected=${t.homeHere}>${`בקומה הזו (${D(e.floorName)})`}</option>
            <option value="there" ?selected=${!t.homeHere}>${`ב${D(s.name)}`}</option>
          </select></sw-field>
          ${t.homeHere?h`<sw-field label=${`החדר הכפול ב${D(s.name)}`}><select data-share-duplicate @change=${l=>{const d=l.target.value;this.shareDlg={...this.shareDlg,duplicateId:d==="__auto"?null:d==="__none"?"":d},this.previewShareNow()}}>
                <option value="__auto" ?selected=${t.duplicateId===null}>${i?.duplicate?`זוהה אוטומטית: ${i.duplicate.name}`:"ללא - המתאר ייבנה מהחדר הזה"}</option>
                ${t.otherZones.map(l=>h`<option value=${l.id} ?selected=${t.duplicateId===l.id}>${l.name}</option>`)}
              </select></sw-field>`:h`<sw-field label=${`החדר ב${D(s.name)} שיישאר`}><select data-share-other-zone @change=${l=>{this.shareDlg={...this.shareDlg,otherZoneId:l.target.value},this.previewShareNow()}}>
                ${t.otherZones.map(l=>h`<option value=${l.id} ?selected=${t.otherZoneId===l.id}>${l.name}</option>`)}
              </select></sw-field>`}`:p}
      ${t.busy?h`<div class="note">מחשב…</div>`:p}
      ${i?h`<div class="share-preview" data-share-preview>
            <div class="kv"><span class="k">הרצפה</span><span>${D(`${i.zone.floor_name}`)} · "${i.zone.name}"</span></div>
            <div class="kv"><span class="k">המתאר ב${D(a)}</span><span data-share-outline>${i.outline.kept?`"${i.duplicate?.name??""}" נשאר - עם ${I(i.boundary_walls_kept.length,"הקיר שלאורכו","הקירות שלאורכו")}`:"ייבנה מהחדר הזה"}</span></div>
            <div class="kv"><span class="k">יוסר מ${D(a)}</span><span data-share-removed>${n.length?n.join(", "):"שום דבר"}</span></div>
            <div class="kv"><span class="k">מצלמות והתקנים</span><span data-share-anchors>${i.anchors.length?i.anchors.map(l=>h`<div>${l.name??l.resource_id} · ${r[l.action]??l.action}</div>`):"אין"}</span></div>
            ${i.aligned?p:h`<div class="err" data-share-alignment>ודא את יישור הקומות: המתאר של הקומה התחתונה לא נופל בתוך המתאר של העליונה.</div>`}
            <div class="note">${i.same_frame?"לשתי התוכניות אותה מסגרת: החדר יוצג באותו מקום.":"לתוכניות מסגרות שונות: החדר יותאם למקום של החדר הכפול לפי המטרים."} כל קומה שומרת את המתאר והקירות שלה; התוכן (טריבונות, סימוני מגרש, עצמים) נשמר בקומת הרצפה ומוצג בשתיהן. שינוי מהקומה השנייה מתפרסם עם פרסום של כל אחת מהן.</div>
          </div>`:p}
      ${t.error?h`<div class="err">${t.error}</div>`:p}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.shareDlg=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-share-apply ?disabled=${!i||t.busy} @click=${()=>this.applyShare()}>שתף את החדר</sw-button>
    </sw-dialog>`}renderZoneShare(t){const e=this.bundle;if(!e||e.source==="demo")return p;const s=t.shared;return s?.role==="mirror"?h`<div class="shared-box" data-zone-shared="mirror"><span class="chip">${St(s)}</span>
        <div class="note" data-zone-created-on>האזור נוצר ב${D(s.home_floor_name)} — מחק אותו שם, או בטל שיתוף כאן</div>
        ${s.home_floor_name===Bs?p:h`<sw-button size="sm" variant="ghost" data-zone-goto-home ?disabled=${this.zoneBusy} @click=${()=>this.gotoHomeFloor(t)}>עבור ל${D(s.home_floor_name)}</sw-button>`}
        <div class="note">חלל משותף עם ${D(s.home_floor_name)}: המתאר והקירות כאן הם של הקומה הזו; התוכן (טריבונות, סימונים, עצמים) נשמר שם ומוצג בשתי הקומות, ועריכה שלו כאן מופיעה בשתיהן.</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?h`<sw-button size="sm" variant="ghost" data-zone-unshare ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,e.floorId)}>בטל שיתוף</sw-button>`:p}</div>`:s?.role==="home"?h`<div class="shared-box" data-zone-shared="home"><span class="chip">${St(s)}</span>
        <div class="note">משותף עם ${(s.floors??[]).map(i=>D(i.name)).join(", ")}: התוכן של החדר מוצג גם שם.</div>
        <sw-share-members .zoneId=${s.zone_id} @members-changed=${()=>void this.reloadShared()}></sw-share-members>
        ${e.permissions.structure?(s.floors??[]).map(i=>h`<sw-button size="sm" variant="ghost" data-zone-unshare=${i.floor_id} ?disabled=${this.zoneBusy} @click=${()=>this.unshare(t,i.floor_id)}>בטל שיתוף עם ${D(i.name)}</sw-button>`):p}</div>`:e.permissions.structure?h`<div class="btns"><sw-button size="sm" icon="floor" data-zone-share ?disabled=${this.zoneBusy} title="חדר ששייך לשתי קומות - חלל בגובה כפול" @click=${()=>this.openShare(t)}>הפוך לחלל משותף</sw-button></div>`:p}renderSharedHint(){const t=this.studio.doc,e=this.selected;let s="";if(e?.shared)s=`חלל משותף · השינוי יופיע גם ב${D(e.shared.home_floor_name)}`;else if(e&&t)s=le(t,null,[e.position.x,e.position.y]);else if(this.geomSel&&t){const d=de(t,this.geomSel.id);s=d?le(t,d,Vs(d)):""}const i=!!this.bundle?.permissions.structure,o=e?.resource_type==="camera",n=e?e.room_candidate?h`<div class="shared-hint" data-share-candidate><sw-icon name="floor" size=${14}></sw-icon>${o?"מצלמה בתוך החלל המשותף שאינה חברה בו - הוסף?":"התקן בתוך החלל המשותף שאינו חבר בו - הוסף?"}
          ${i?h`<sw-button size="sm" variant="ghost" data-share-member-add ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.room_candidate,!0)}>הוסף לחלל המשותף</sw-button>`:p}</div>`:(e.shared_member||e.shared)&&i?h`<div class="btns"><sw-button size="sm" variant="ghost" data-share-member-remove ?disabled=${this.zoneBusy} @click=${()=>this.setShareMember(e,e.shared_member??e.shared.zone_id,!1)}>הסר מהחלל המשותף</sw-button></div>`:p:p,r=this.geomSel&&t?de(t,this.geomSel.id):null,a=r&&(this.geomSel?.kind==="object"||this.geomSel?.kind==="label")?Us(t,r):null,l=a&&r?h`<label class="shared-hint" data-shared-content-toggle><input type="checkbox" .checked=${r.shared_space_id===a} ?disabled=${!this.bundle?.permissions.structure}
          @change=${d=>this.setSharedContent(r.id,d.target.checked?a:null)} /> חלק מהחלל המשותף (מוצג גם בקומה השנייה)</label>`:p;return h`${s?h`<div class="shared-hint" data-shared-hint><sw-icon name="floor" size=${14}></sw-icon>${s}</div>`:p}${n}${l}`}setSharedContent(t,e){const s=this.studio.doc;if(!s)return;const i=o=>o.map(n=>{if(n.id!==t)return n;const{shared_space_id:r,...a}=n;return e?{...a,shared_space_id:e}:a});this.studio.commit({...s,objects:i(s.objects),labels:i(s.labels)})}snapshot(){this.undo=[...this.undo.slice(-40),this.anchors.map(t=>({...t,position:{...t.position}}))],this.redo=[]}apply(t,e){this.snapshot(),this.lastEdit="pins",this.anchors=this.anchors.map(s=>s.id===t?{...s,...e,position:e.position??s.position}:s),this.dirty=new Set(this.dirty).add(t)}nudge(t,e){const s=this.selected;s&&this.apply(s.id,{position:{x:+Math.min(1,Math.max(0,s.position.x+t)).toFixed(4),y:+Math.min(1,Math.max(0,s.position.y+e)).toFixed(4)}})}doUndo(){const t=this.undo[this.undo.length-1];t&&(this.redo=[...this.redo,this.anchors],this.undo=this.undo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}doRedo(){const t=this.redo[this.redo.length-1];t&&(this.undo=[...this.undo,this.anchors],this.redo=this.redo.slice(0,-1),this.anchors=t,this.dirty=new Set(this.anchors.map(e=>e.id)))}handleKey(t){const e=t.composedPath()[0],s=e&&(e.tagName==="INPUT"||e.tagName==="TEXTAREA"||e.tagName==="SELECT"||e.isContentEditable);if(t.key==="Escape"){if(this.shortcutsOpen){this.shortcutsOpen=!1;return}if(this.doorGhost||this.doorAsking){this.dropDoorGhost();return}if(this.pkgImport){this.pkgImport.busy!=="import"&&(this.pkgImport=null);return}if(this.arrayDialog||this.groupDelete||this.customDialog){this.arrayDialog=null,this.groupDelete=null,this.customDialog=null;return}if(this.connStart){this.connStart=null;return}if(this.tool==="circuits"&&this.circuitPlacing){this.circuitPlacing=null;return}if(this.tool==="circuits"&&this.membersMode){this.membersMode=!1;return}if(this.tool==="detect"){this.detectAsk?this.detectAsk=null:this.pickTool("select");return}this.placingItem?this.placingItem=null:this.bindOffer?this.bindOffer=null:this.wallDraft?(this.wallDraft=null,this.hover=null):this.curveDraft?(this.curveDraft=null,this.curveRedo=[],this.hover=null):this.tool==="measure"&&this.measurePts.length?this.measurePts=[]:this.tool==="calibrate"&&this.calib.a?this.calib={...B}:this.tool==="walk"&&this.walkArmed?this.walkArmed=null:this.drawing?this.drawing=null:this.placing?this.placing=null:this.candidates?this.candidates=null:this.panMode?this.panMode=!1:(this.selectedId=null,this.selectedZoneId=null,this.zoneVertexSel=null,this.geomSel=null,this.multi=[]);return}if(s||this.arrayDialog||this.groupDelete||this.customDialog||this.shortcutsOpen||this.pkgImport||this.panMode||this.multiOn&&this.handleMultiKey(t))return;if(t.code==="KeyD"&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.startMarkDoor();return}const i={KeyC:"curve",KeyR:"curved",KeyG:"glass"};if(i[t.code]&&!t.ctrlKey&&!t.metaKey&&!t.altKey&&!t.shiftKey&&this.bundle?.permissions.structure&&this.studio.doc&&!this.phone.matches&&!this.detectBusy){t.preventDefault(),this.wallDraft&&this.wallDraft.length>=2&&this.finishWall(),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.tool!=="structure"&&this.pickTool("structure"),this.studioMode=i[t.code],this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null;return}if((this.studioOn||this.selectGeomOn)&&this.handleStudioKey(t))return;if(t.key==="Enter"&&this.drawing){t.preventDefault(),this.finishDrawing();return}if((t.key==="Delete"||t.key==="Backspace")&&!this.selected&&this.selectedZone){t.preventDefault();const n=this.selectedZone,r=this.zoneVertexSel;if(r&&r.zoneId===n.id&&r.index<n.polygon.length){if(n.polygon.length<=3){this.flash("לאזור נשארו שלוש פינות: אי אפשר להסיר עוד פינה",3e3);return}this.zoneVertexSel=null,this.patchZone(n,{polygon:n.polygon.filter((a,l)=>l!==r.index)});return}this.removeZone(n);return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="z"){t.preventDefault(),t.shiftKey?this.redoAny():this.undoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="y"){t.preventDefault(),this.redoAny();return}if((t.ctrlKey||t.metaKey)&&t.key.toLowerCase()==="s"){t.preventDefault(),this.save();return}if(!this.selected)return;const o=t.shiftKey?.01:.002;t.key==="ArrowLeft"?(t.preventDefault(),this.nudge(-o,0)):t.key==="ArrowRight"?(t.preventDefault(),this.nudge(o,0)):t.key==="ArrowUp"?(t.preventDefault(),this.nudge(0,-o)):t.key==="ArrowDown"?(t.preventDefault(),this.nudge(0,o)):(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.removeSelected())}async save(){if(!this.bundle||this.bundle.source==="demo")return this.info="נתוני הדגמה: השינויים נשמרים רק במסך זה.",this.dirty=new Set,!0;if(!this.dirty.size)return!0;this.busy=!0,this.error="";let t=!1;try{for(const e of this.dirty){const s=this.anchors.find(i=>i.id===e);if(s)try{const i=await us(e,{revision:s.revision,x:s.position.x,y:s.position.y,rotation_degrees:s.rotation_degrees,field_of_view_degrees:s.field_of_view_degrees,label:s.label,coverage_radius:s.coverage_radius??null,coverage_polygon:s.coverage_polygon??null,label_pos:s.label_pos??"auto",level_id:s.level_id??"",mount_height_m:s.mount_height_m??null,tilt_deg:s.tilt_deg??null},s.shared?this.bundle.floorId:void 0);this.anchors=this.anchors.map(o=>o.id===e?{...o,revision:i.revision}:o)}catch(i){if(i instanceof P&&i.code==="stale_revision")t=!0;else throw i}}return t?(this.error="חלק מהפריטים השתנו בינתיים על ידי עורך אחר; המפה נטענה מחדש בלי לדרוס את השינוי שלו.",await this.load(),!1):(this.dirty=new Set,this.flash("המיקומים נשמרו",2500),!0)}catch(e){return this.error=k(e),!1}finally{this.busy=!1}}async place(t,e){const s=this.placing;if(!s||!this.bundle)return;if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הוספה עובדת מול השרת.",this.placing=null;return}if(this.dirty.size&&!await this.save())return;this.busy=!0,this.error="";const i=this.activeLevel?{level_id:this.activeLevel}:{};try{const o=s.kind==="camera"?await ee(this.bundle.floorId,{resource_type:"camera",resource_id:s.camera.id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:90,...i}):await ee(this.bundle.floorId,{resource_type:"ha_entity",resource_id:s.entity.entity_id,x:t,y:e,rotation_degrees:0,field_of_view_degrees:null,...i});this.placing=null,await this.load(),this.selectedId=o.id,this.tool="select",this.flash(`${this.anchorName(o)} הוצב · גרור לדיוק, קבע כיוון בידיות`,4e3)}catch(o){this.error=k(o)}finally{this.busy=!1}}async removeSelected(){const t=this.selected;if(!(!t||!this.bundle)){if(this.bundle.source==="demo"){this.info="נתוני הדגמה: הסרה עובדת מול השרת.";return}if(window.confirm(`להסיר את "${this.anchorName(t)}" מהמפה? המקור עצמו לא נמחק.`)){this.busy=!0,this.error="";try{await ps(t.id,t.shared?this.bundle.floorId:void 0),this.selectedId=null,await this.load()}catch(e){this.error=k(e)}finally{this.busy=!1}}}}async loadVersions(){const t=this.bundle;if(!t||t.source==="demo"||!t.permissions.edit){this.versions=[],this.geomVersions=[];return}this.loadSideData(t);try{this.versions=(await gs(t.floorId)).versions}catch{this.versions=[]}}async publish(){const t=this.bundle;if(!t?.planVersionId||this.dirty.size&&!await this.save())return;if(!await this.studio.flush()){this.error=this.studio.error;return}if(this.error="",t.planStatus==="published"){await this.openGeomDiff(t.planVersionId);return}let e=this.versions.find(s=>s.id===t.planVersionId);if(e||(await this.loadVersions(),e=this.versions.find(s=>s.id===t.planVersionId)),!e){this.error="לא נמצאה טיוטה לפרסום — טען מחדש";return}await this.openDiff("publish",e)}async openGeomDiff(t){this.geomDiff={versionId:t,data:null,error:"",skip:[]};try{const e=await Yo(t);this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:e,error:"",skip:[]})}catch(e){this.geomDiff?.versionId===t&&(this.geomDiff={versionId:t,data:null,error:k(e),skip:[]})}}async confirmGeomPublish(){const t=this.bundle,e=this.geomDiff;if(!(!t||!e?.data)){this.busy=!0;try{const s=await Xo(e.versionId,e.skip);this.geomDiff=null;const i=(s.shared_published??[]).length>0;this.flash(s.unchanged&&!i?"אין שינוי לפרסום":i?"המבנה פורסם, כולל השינויים בחלל המשותף; הצופים רואים אותם עכשיו":"המבנה פורסם; הצופים רואים אותו עכשיו",4e3),await this.loadStudio(t,!0)}catch(s){this.geomDiff={...e,error:k(s)}}finally{this.busy=!1}}}async openDiff(t,e){this.diff={mode:t,version:e,data:null,error:""};try{const s=await fs(e.id);this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:s,error:""})}catch(s){this.diff?.version.id===e.id&&(this.diff={mode:t,version:e,data:null,error:k(s)})}}async confirmDiff(){const t=this.diff;if(!t?.data||t.mode==="compare")return;const e=t.version.id===this.bundle?.planVersionId;this.busy=!0,this.error="";try{if(e&&!await this.studio.flush()){this.diff={...t,error:this.studio.error};return}t.mode==="publish"?(await ms(t.version.id),this.info="הגרסה פורסמה; הצופים רואים אותה עכשיו"):(await vs(t.version.id,t.version.revision,t.data.from?.id??null),this.info="הגרסה שוחזרה ופורסמה מחדש; העוגנים נשמרו");const s=this.info;this.diff=null,await this.load(),this.bundle&&await this.loadStudio(this.bundle,!0),this.info===s&&this.flash(s,4e3)}catch(s){this.diff={...t,error:k(s)},s instanceof P&&s.status===409&&this.loadVersions(),e&&s instanceof P&&s.code==="geometry_invalid"&&(this.pickTool("structure"),this.studioMode="select")}finally{this.busy=!1}}async searchEntities(){if(this.bundle?.source==="demo")return;const t=++this.entSeq;this.entBusy=!0;try{const e=this.tool==="lights",s=this.lightsAll,i=await se({q:this.entQ||void 0,domain:e&&!s?"switch":void 0,limit:e?200:40});if(t!==this.entSeq)return;this.entResults=e?i.entities.filter(o=>o.domain==="switch"||s&&o.domain==="light").slice(0,60):i.entities}catch(e){if(t!==this.entSeq)return;this.error=k(e),this.entResults=[]}finally{t===this.entSeq&&(this.entBusy=!1)}}onEntQuery(t){this.entQ=t,window.clearTimeout(this.entTimer),this.entTimer=window.setTimeout(()=>void this.searchEntities(),250)}async stylize(t,e){if(!this.bundle?.planVersionId||this.bundle.source==="demo")return;const s=this.stylizeOpts;(t!==void 0||e!==void 0)&&(this.stylizeOpts={...s,strength:t??s.strength,keepLines:e??s.keepLines}),this.stylizing=!0,this.error="";try{this.stylized=await Vn(this.bundle.planVersionId,{strength:this.stylizeOpts.strength,keep_lines:this.stylizeOpts.keepLines,room_fill:this.stylizeOpts.roomFill})}catch(i){this.error=k(i)}finally{this.stylizing=!1}}async useRender(t){if(this.bundle?.planVersionId){this.busy=!0,this.error="";try{await Un(this.bundle.planVersionId,t),this.stylized=null,await this.load(),this.flash(t==="stylized"?"המפה מציגה עכשיו את שפת Arx":"המפה מציגה את תוכנית המקור",3e3)}catch(e){this.error=k(e)}finally{this.busy=!1}}}get detectBusy(){return this.detectRun.busy||this.tool==="detect"&&this.busy}setPlanImage(t,e){this.planImage=e;try{localStorage.setItem(`sw.editor.background.${t}`,e?"1":"0")}catch{}}setGrid(t,e){this.grid={...this.grid,...e};try{localStorage.setItem(`sw.editor.grid.${t}`,this.grid.on?"1":"0"),localStorage.setItem(`sw.editor.gridStep.${t}`,String(this.grid.stepM))}catch{}}gridPx(t){return this.grid.on?Ws(this.grid.stepM,x(t).scale):0}gridPoint(t){const e=this.bundle,s=this.studio.doc;return e&&s?Hs(t,this.gridPx(s),e.width,e.height):t}get anchorPositions(){const t=this.anchorPosCache;if(t&&t.anchors===this.anchors)return t.positions;const e=Object.fromEntries(this.anchors.map(s=>[`${s.resource_type}:${s.resource_id}`,{x:s.position.x,y:s.position.y,rotation:s.rotation_degrees}]));return this.anchorPosCache={anchors:this.anchors,positions:e},e}alignTargets(t,e){const s=this.bundle,i=[t,e,this.activeLevel,this.anchorPositions,s?.width,s?.height],o=this.guideCache;if(o&&o.key.length===i.length&&o.key.every((u,v)=>u===i[v]))return o.targets;const n=this.activeLevel,r=C(t),{scale:a}=x(t),l=Ks(t,this.anchorPositions),d=s?l.objects.filter(u=>u.id!==e&&(n===null||(u.level_id||r)===n)).map(u=>qs(u,s.width,s.height,a)):[],c=Js(d);return this.guideCache={key:i,targets:c},c}pickTool(t){this.detectBusy&&t!==this.tool||(this.dropDoorGhost(),this.tool=t,this.placing=null,this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,this.geomPreview=null,this.placingItem=null,this.bindOffer=null,this.connMode=null,this.connStart=null,this.membersMode=!1,this.circuitPlacing=null,this.circuitNew=null,t==="connectors"&&this.loadLinkTargets(),t==="structure"&&this.phone.matches&&(Se.includes(this.studioMode)||this.studioMode==="curve")&&(this.studioMode="select"),t!=="structure"&&(this.geomSel=null),this.multi=[],this.zoneSaving||(this.zonePreview=null),Nt.includes(t)&&(this.selectedZoneId=null,this.zoneVertexSel=null),t!=="measure"&&(this.measurePts=[]),t!=="calibrate"&&(this.calib={...B}),t!=="walk"&&(this.walkArmed=null,this.walkFocus=null),t!=="detect"&&(this.candSel=null,this.detectAsk=null),(t==="entity"||t==="lights")&&(this.entResults=null,this.searchEntities()))}async loadStudio(t,e=!1){if(t.source!=="api"||!t.planVersionId||!t.permissions.structure||!e&&this.studioVersion===t.planVersionId)return!1;this.studioVersion=t.planVersionId;try{return!await this.studio.flush()&&!(e&&this.studio.hasConflict)?(this.studioVersion=null,this.error=this.studio.error,!1):(await this.studio.load(t.planVersionId),this.geomSel=null,this.multi=[],this.geomPreview=null,this.wallDraft=null,this.calib={...B},this.measurePts=[],this.cands&&this.cands.result.version_id!==t.planVersionId&&this.discardCandidates(),this.presetCandidates==="dxf"&&this.takeDxf(t.planVersionId),!0)}catch(s){return this.studioVersion=null,this.error=k(s),!1}}async loadLibraryFor(t){if(t.source==="api")try{const e=await yn(t.catalogRevision);this.library=e,this.libLookup=kn(e)}catch(e){this.error=k(e)}}placeOpts(t){const e=this.activeLevel??C(t);return{levelId:e,ceilingM:t.levels.find(s=>s.id===e)?.ceiling_height_m??2.8}}get activeLevel(){const t=this.levelFilter;return t&&this.studio.doc?.levels.some(e=>e.id===t)?t:null}shownWalls(t){const e=this.activeLevel;return e?t.walls.filter(s=>s.level_id===e):t.walls}setLevelFilter(t){this.levelFilter=t;const e=this.studio.doc;if(this.geomSel&&e&&!he(e,this.geomSel.id,t)&&(this.geomSel=null),this.multi.length&&e){const s=new Set(Dt(e,this.zones,t).map(i=>i.id));this.setSelection(this.multiItems.filter(i=>s.has(i.id)))}}followLevel(t,e){this.geomSel?.id===t&&this.activeLevel!==null&&this.activeLevel!==e&&(this.levelFilter=e)}openNewLevel(){this.levelDialog={id:null,name:"",elevation:-1.2,ceiling:3,isDefault:!1,makeDefault:!1,error:""}}openLevelEdit(t){const e=this.studio.doc?.levels.find(s=>s.id===t);e&&(this.levelDialog={id:t,name:e.name,elevation:e.elevation_m,ceiling:e.ceiling_height_m,isDefault:e.is_default,makeDefault:!1,error:""})}submitLevel(){const t=this.studio.doc,e=this.levelDialog;!t||!e||(e.id===null?this.createLevel(t,e):this.saveLevel(t,e.id,e))}createLevel(t,e){if(t.levels.some(i=>i.elevation_m===e.elevation)){this.levelDialog={...e,error:"כבר יש מפלס בגובה הזה"};return}const s=Ys(t,e.name,e.elevation,e.ceiling);this.studio.commit(s.doc),this.lastEdit="structure",this.levelDialog=null,this.setLevelFilter(s.id),this.flash(`המפלס "${e.name}" נוסף; פריטים חדשים יוצבו בו`,4e3)}saveLevel(t,e,s){const i=t.levels.find(r=>r.id===e);if(!i){this.levelDialog=null;return}const o=r=>Math.round(r*1e3)/1e3,n={name:s.name.trim(),elevation_m:o(s.elevation),ceiling_height_m:o(s.ceiling),...s.makeDefault&&!i.is_default?{is_default:!0}:{}};if(t.levels.some(r=>r.id!==e&&r.elevation_m===n.elevation_m)){this.levelDialog={...s,error:"כבר יש מפלס בגובה הזה"};return}this.levelDialog=null,!(n.name===i.name&&n.elevation_m===i.elevation_m&&n.ceiling_height_m===i.ceiling_height_m&&!n.is_default)&&(this.studio.commit(Xs(t,e,n)),this.lastEdit="structure",this.flash(n.is_default?`המפלס "${n.name}" עודכן והוא המפלס הראשי עכשיו`:`המפלס "${n.name}" עודכן`,4e3))}deleteLevel(){const t=this.studio.doc,e=this.levelDialog;if(!t||!e?.id)return;const s=t.levels.find(o=>o.id===e.id);if(!s){this.levelDialog=null;return}const i=Qs(t,s.id);if(!i){const o=ti(t,s.id),n=[...s.is_default?["זה המפלס הראשי - הפוך מפלס אחר לראשי קודם"]:[],...o>0?[`יש בו עוד ${I(o,"פריט אחד","פריטים")} (קירות, תוויות, עצמים או מחברים) - העבר או מחק אותם קודם`]:[]];this.levelDialog={...e,error:`אי אפשר למחוק את המפלס: ${n.join("; ")}.`};return}this.studio.commit(i),this.lastEdit="structure",this.levelDialog=null,this.levelFilter===s.id&&this.setLevelFilter(null),this.flash(`המפלס "${s.name}" נמחק (ביטול: Ctrl+Z)`,4e3)}async loadLinkTargets(t=!1){const e=this.bundle;if(!(!e||e.source!=="api"||!e.planVersionId)&&!(!t&&this.linkTargetsFor===e.planVersionId)){this.linkTargetsFor=e.planVersionId;try{this.linkTargets=(await Me(e.planVersionId)).floors}catch{this.linkTargetsFor=null}}}async linkTo(t,e,s,i=!1){const o=this.bundle;if(o?.planVersionId){this.linkBusy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const n=await Qo(o.planVersionId,t,e,s,i);await this.loadStudio(o,!0),this.geomSel={id:t,kind:"connector"};const r=this.linkTargets.find(l=>l.floor_id===n.target.floor_id),a=`${r?.name??"הקומה השנייה"} · ${r?.levels.find(l=>l.id===n.target.level_id)?.name??""}`;this.flash(n.target.placement==="centred"?`המדרגות קושרו אל ${a}. לשתי הקומות אין מסגרת משותפת, לכן בקומה השנייה הן נוצרו במרכז התוכנית: מקם את המדרגות בקומה השנייה.`:n.target.placement==="aligned"&&n.target.frame==="size"?`המחבר קושר אל ${a}; בקומה השנייה הוא הונח באותו מקום בתוכנית (לשתי התוכניות אותן מידות): ודא את המיקום בקומה השנייה.`:`המחבר קושר אל ${a}; הוא מופיע בטיוטה של שתי הקומות באותו מזהה`,7e3)}catch(n){this.error=k(n)}finally{this.linkBusy=!1}}}setTarget(t,e){const s=this.studio.doc,i=s?.connectors.find(r=>r.id===t),o=Oe(e);if(!s||!i||!o)return;const n=Lt(s,i);if(n&&o.floorId!==n){this.linkConfirm={kind:o.floorId?"relink":"unlink",id:t,value:e,target:De(s.levels,i)};return}this.applyTarget(t,e)}applyTarget(t,e,s=!1){const i=this.studio.doc,o=i?.connectors.find(a=>a.id===t),n=Oe(e);if(!i||!o||!n)return;if(n.floorId){this.linkTo(t,n.floorId,n.levelId,s);return}const r=Lt(i,o);this.edit(a=>pt(a,t,{level_to:n.levelId,floor_ids:[],far:null,origin_floor_id:void 0})),r&&this.dropTwin(t,r)}confirmLink(t){const e=this.linkConfirm;this.linkConfirm=null,t&&e&&this.applyTarget(e.id,e.value,e.kind==="relink")}async dropTwin(t,e){const s=this.bundle;if(s?.planVersionId)try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await tn(s.planVersionId,t,e);this.flash(i.removed?"המחבר נמחק גם בקומה השנייה":"בקומה השנייה לא נמצא מחבר תאום",4e3)}catch(i){this.error=k(i)}}removeConnector(t){const e=this.studio.doc,s=e?.connectors.find(o=>o.id===t);if(!e||!s)return;const i=Lt(e,s);if(i){this.twinDelete={id:t,floorId:i,target:De(e.levels,s),canBoth:this.linkTargets.some(o=>o.floor_id===i)};return}this.edit(o=>U(o,t)),this.geomSel=null}confirmTwinDelete(t){const e=this.twinDelete;this.twinDelete=null,e&&(this.edit(s=>U(s,e.id)),this.geomSel=null,t&&e.canBoth&&this.dropTwin(e.id,e.floorId))}connectorView(t){return{doc:t,saveState:this.studio.saveState,linkTargets:this.linkTargets,linkBusy:this.linkBusy,stairShape:this.stairShape,phone:this.phone.matches}}connectorActions(){const t=this.bundle,e=()=>this.studio.doc?x(this.studio.doc).scale:1;return{setMode:s=>{this.connMode=s,this.connStart=null,this.geomSel=null},select:s=>this.geomSel={id:s,kind:"connector"},patch:(s,i)=>this.edit(o=>pt(o,s,i)),remove:s=>this.removeConnector(s),setTarget:(s,i)=>this.setTarget(s,i),setStairShape:s=>{this.stairShape=s,this.connStart=null},patchStair:(s,i)=>{t&&this.edit(o=>{const n=o.connectors.find(r=>r.id===s);return n?pt(o,s,ii(n,i,t.width,t.height,e())):o})},rotate:s=>{t&&this.edit(i=>si(i,s,90,t.width,t.height))},setFloorHeight:s=>this.edit(i=>({...i,floor_height_m:s})),confirmPlacement:s=>this.edit(i=>ei(i,s))}}renderConnectorTool(t){const e=this.studio.doc;return e?fo({...this.connectorView(e),mode:this.connMode,start:this.connStart,sel:this.geomSel?.kind==="connector"?e.connectors.find(s=>s.id===this.geomSel.id):void 0},this.connectorActions()):h`<sw-card heading="מפלסים ומחברים"><div class="note">${t.source==="demo"?"נתוני הדגמה: המחברים עובדים מול השרת.":this.error||"טוען…"}</div></sw-card>`}drawConnector(t,e,s,i){const o=this.bundle,n=this.placeOpts(t).levelId;if(e!=="stairs"||!o)return It(t,e,s,i,n,null);const r=x(t).scale,a=Math.hypot((i[0]-s[0])*o.width,(i[1]-s[1])*o.height)*r,l=Math.max(1,Math.min(qi,Math.round(a/Ji)));if(this.stairShape==="straight"){const d=It(t,e,s,i,n,null);return{doc:pt(d.doc,d.id,{shape:"straight",turn:"none",flights:[{steps:l}],landing_depth_m:null}),id:d.id}}return ce(t,{shape:this.stairShape,start:s,dir:[(i[0]-s[0])*o.width,(i[1]-s[1])*o.height],flights:[l,l],width_m:1.2,going_m:a/l,levelFrom:n,levelTo:null},o.width,o.height,r)}placeStairItem(t,e,s){const i=this.bundle,o=ue[e];if(!i||!o)return;const n=x(t).scale,r=this.placeOpts(t).levelId,a=o.shape?ce(t,{shape:o.shape,start:s,flights:o.flights,width_m:o.width_m,levelFrom:r,levelTo:null,kind:o.kind},i.width,i.height,n):It(t,o.kind,s,[s[0],Math.max(0,s[1]-o.width_m/n/i.height)],r,null);this.studio.commit(a.doc),this.lastEdit="structure",this.remember(e),this.pickTool("connectors"),this.geomSel={id:a.id,kind:"connector"},this.flash('המדרגות הונחו כמחבר: בחר ב"מחבר אל" לאיזה מפלס או קומה הן מובילות',5e3)}async searchSwitches(t){try{const[e,s]=await Promise.all(["switch","light"].map(o=>se({domain:o,q:t||void 0,limit:40}))),i=[...e.entities,...s.entities].filter(o=>o.domain==="switch"||o.domain==="light").slice(0,40);this.circuitNew&&this.circuitNew.q===t&&(this.circuitNew={...this.circuitNew,results:i})}catch(e){this.error=k(e)}}willUpdate(){const t=this.studio.doc;this.zoneCameraFor!==this.selectedZoneId&&this.loadZoneCamera(this.selectedZoneId);const e=this.geomSel?this.studio.claimed.get(this.geomSel.id):void 0;e&&t&&!oi(t).has(this.geomSel.id)&&(this.geomSel={...this.geomSel,id:e}),this.circuitSel&&t&&!t.circuits.some(s=>s.id===this.circuitSel)&&(this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null)}createCircuit(){const t=this.studio.doc,e=this.circuitNew;if(!t||!e?.entity)return;const s=ni(t,e.name,e.entity.entity_id,e.color);this.studio.commit(s.doc),this.lastEdit="structure",this.circuitNew=null,this.circuitSel=s.id,this.membersMode=!0,this.circuitPlacing=null,this.flash("המעגל נוצר: לחץ על המנורות שלו",4e3)}renderCircuitTool(t){const e=this.studio.doc,s=this.library;return e?mo({doc:e,sel:e.circuits.find(i=>i.id===this.circuitSel),membersMode:this.membersMode,power:i=>Bi(e,i,o=>s?j(s,o):void 0),creating:this.circuitNew,saveState:this.studio.saveState,colors:Ct,lamps:s?s.items.filter(i=>i.role==="light"):[],placing:this.circuitPlacing},{select:i=>{this.circuitSel=i,this.membersMode=!1,this.circuitPlacing=null},startNew:()=>{this.circuitNew={name:"",q:"",results:[],entity:null,color:Ct[e.circuits.length%Ct.length],busy:!1},this.searchSwitches("")},cancelNew:()=>this.circuitNew=null,setNew:i=>{this.circuitNew&&(this.circuitNew={...this.circuitNew,...i},i.q!==void 0&&(window.clearTimeout(this.circuitTimer),this.circuitTimer=window.setTimeout(()=>void this.searchSwitches(i.q??""),250)))},create:()=>this.createCircuit(),patch:(i,o)=>this.edit(n=>Gi(n,i,o)),toggleMembers:()=>{this.membersMode=!this.membersMode,this.membersMode||(this.circuitPlacing=null)},remove:i=>{this.edit(o=>U(o,i)),this.circuitSel=null,this.membersMode=!1,this.circuitPlacing=null},armLamp:i=>{!this.membersMode||!this.circuitSel||(this.circuitPlacing=i)}}):h`<sw-card heading="מעגלי תאורה"><div class="note">${t.source==="demo"?"נתוני הדגמה: המעגלים עובדים מול השרת.":this.error||"טוען…"}</div></sw-card>`}onLevel(t){const e=this.studio.doc,s=this.activeLevel;return!s||!e?!0:ri(e,t.level_id,s)}remember(t){this.libRecent=[t,...this.libRecent.filter(e=>e!==t)].slice(0,12),Ze("sw.studio.recent",this.libRecent)}placeItem(t){const e=this.studio.doc,s=this.placingItem;if(!e||!s)return;if(ue[s.id]){this.placeStairItem(e,s.id,this.gridPoint(t));return}const i=ai(e,s,this.gridPoint(t),this.placeOpts(e));this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.id,kind:"object"},this.remember(s.id),this.offerBinding(i.id),this.phone.matches&&(this.placingItem=null)}placeCircuitLamp(t){const e=this.studio.doc,s=this.circuitPlacing,i=this.circuitSel;if(!e||!s||!i)return;const o=li(e,s,this.gridPoint(t),this.placeOpts(e),i);this.studio.commit(o.doc),this.lastEdit="structure",this.geomSel={id:o.id,kind:"object"},this.phone.matches&&(this.circuitPlacing=null)}onItemDrop(t){const e=t.dataTransfer?.getData("text/x-sw-item"),s=this.canvas,i=this.library;if(!e||!s||!i)return;t.preventDefault();const o=j(i,e);if(!o)return;const n=s.getBoundingClientRect(),r=s.toPlan(t.clientX-n.left,t.clientY-n.top);this.placingItem=o,this.placeItem([r.x,r.y]),this.phone.matches||(this.placingItem=null)}offerBinding(t){const e=this.bundle,s=this.studio.doc,i=this.library;if(this.bindOffer=null,!e||!s||!i)return;const o=s.objects.find(d=>d.id===t),n=o?j(i,o.item_id):void 0;if(!o||!n||!n.anchor_kinds.length||o.anchor_ref||this.bindRefused.has(t))return;const{scale:r}=x(s),a=new Set(s.objects.filter(d=>d.anchor_ref).map(d=>`${d.anchor_ref.resource_type}:${d.anchor_ref.resource_id}`));let l=null;for(const d of this.anchors){if(a.has(`${d.resource_type}:${d.resource_id}`)||!this.onLevel(d))continue;const c=d.resource_type==="camera"?"camera":d.entity?.domain??d.resource_id.split(".")[0];if(!n.anchor_kinds.includes(c))continue;const u=pe(o.position,[d.position.x,d.position.y],e.width,e.height,r);u<=Ri&&(!l||u<l.d)&&(l={a:d,d:u})}l&&(this.bindOffer={objectId:t,anchor:l.a})}bindObject(t,e){this.edit(s=>Q(s,t,{anchor_ref:{resource_type:e.resource_type,resource_id:e.resource_id},position:[e.position.x,e.position.y],rotation_deg:e.rotation_degrees})),this.bindOffer=null,this.flash(`העצם הוא עכשיו הגוף של ${this.anchorName(e)}`,3e3)}openArray(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(r=>r.id===t),o=i&&s?j(s,i.item_id):void 0;if(!e||!i)return;if(this.phone.matches){this.flash("מערכים זמינים בדסקטופ בלבד",3e3);return}const n=o?di(o):{spacingX:H(i.size.w_m+.05),spacingY:H(i.size.d_m+.45)};this.arrayDialog={objectId:t,item:o,rows:2,cols:4,spacingX:n.spacingX,spacingY:n.spacingY,directionDeg:i.rotation_deg,max:hi,error:""}}createArray(){const t=this.bundle,e=this.studio.doc,s=this.arrayDialog;if(!t||!e||!s)return;const i=ci(e,s.objectId,s,t.width,t.height,x(e).scale);if(!i){this.arrayDialog={...s,error:"לא ניתן ליצור את המערך (העצם כבר במערך, או שיש יותר מדי עצמים)"};return}this.arrayDialog=null,this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.groupId,kind:"group"},this.flash(`${i.ids.length} עצמים במערך אחד`,4e3)}deleteGroup(t){const e=this.groupDelete;this.groupDelete=null,e&&(this.edit(s=>ui(s,e,t)),this.geomSel=null)}openCustom(t){const e=this.studio.doc,s=this.library,i=e?.objects.find(n=>n.id===t);if(!e||!s||!i)return;const o=j(s,i.item_id);this.customDialog={objectId:t,nameHe:o?`${o.names.he} (מותאם)`:"",nameEn:o?.names.en??"",category:o?.category??"storage",shape:o?.shape??"box",icon:o?.icon??"box",color:o?.color_token??"object",size:{...i.size},basedOn:o?o.custom?o.based_on:o.id:null,busy:!1,error:"",params:JSON.parse(JSON.stringify(i.params)),z:o&&o.z_ref==="ceiling"?o.z_m:i.z_m}}async createCustom(){const t=this.customDialog,e=this.bundle;if(!(!t||!e)){this.customDialog={...t,busy:!0,error:""};try{const s=await $n({based_on:t.basedOn,names:{he:t.nameHe.trim(),en:t.nameEn.trim()},category:t.category,shape:t.shape,icon:t.icon,color_token:t.color,size:t.size,z_m:t.z,params:t.params});this.customDialog=null,await this.loadLibraryFor(e),this.remember(s.id),this.libCategory="recent",this.libQ="",this.flash(`הפריט "${s.names.he}" נוסף לספרייה`,4e3)}catch(s){this.customDialog={...t,busy:!1,error:k(s)}}}}async importLibrary(t){const e=this.bundle;if(e)try{let s;try{s=JSON.parse(await t.text())}catch{s=null}if(s?.format!=="smplwise-catalog-1"||!Array.isArray(s.items))throw new Error("הקובץ אינו ייצוא של ספרייה מותאמת (smplwise-catalog-1)");const i=await xn(s.items);await this.loadLibraryFor(e),this.flash(`${i.imported} יובאו, ${i.replaced} הוחלפו`,4e3)}catch(s){this.error=s instanceof Error&&!(s instanceof P)?s.message:k(s)}}get catalogLookup(){return this.libLookup}get studioOn(){return Nt.includes(this.tool)&&!!this.studio.doc}get studioPlacing(){return!this.studioOn||this.tool==="detect"?!1:this.tool==="library"?!!this.placingItem:this.tool==="connectors"?!!this.connMode:this.tool==="walk"?!!this.walkArmed:this.tool==="circuits"?!!this.circuitPlacing&&!!this.circuitSel:this.tool!=="structure"||this.studioMode!=="select"&&this.studioMode!=="curve"}get geomDragMode(){return this.studio.doc?this.tool==="select"?this.bundle?.permissions.structure&&!this.placing&&!this.drawing?"all":"none":this.tool==="library"?this.placingItem?"none":"objects":this.tool==="connectors"?this.connMode?"none":"objects":this.tool==="circuits"?this.circuitPlacing?"none":"objects":this.tool!=="structure"?"none":this.studioMode==="select"||this.studioMode==="curve"?"all":this.wallDraft||this.curveDraft?"none":"items":"none"}get geomSelectMode(){return this.tool==="structure"&&(this.studioMode==="select"||this.studioMode==="curve")||this.tool==="select"}get selectGeomOn(){return this.tool==="select"&&!!this.geomSel&&!!this.studio.doc&&!this.selectedId}get undoTarget(){return this.studioOn?this.studio.canUndo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canUndo&&(this.lastEdit==="structure"||!this.undo.length)?"structure":this.undo.length?"pins":null}get redoTarget(){return this.studioOn?this.studio.canRedo?"structure":null:this.tool==="select"&&this.studio.doc&&this.studio.canRedo&&(this.lastEdit==="structure"||!this.redo.length)?"structure":this.redo.length?"pins":null}undoAny(){const t=this.undoTarget;t==="structure"?(this.studio.undo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doUndo(),this.lastEdit="pins")}redoAny(){const t=this.redoTarget;t==="structure"?(this.studio.redo(),this.geomSel=null,this.multi=[],this.lastEdit="structure",this.dropOrphanGhost()):t==="pins"&&(this.doRedo(),this.lastEdit="pins")}get issueIds(){const t=this.studio.issues;return this.memo("issueIds",[t],()=>t.filter(e=>e.severity==="error"&&e.id).map(e=>e.id))}edit(t){const e=this.studio.doc;if(!e)return;const s=t(e);s===e||JSON.stringify(s)===JSON.stringify(e)||(this.studio.commit(s),this.lastEdit="structure")}snap(t,e,s){const i=this.bundle,o=this.studio.doc;return!i||!o?t:tt(t,e,this.shownWalls(o),i.width,i.height,{tolPx:F/(this.canvas?.zoom??1),free:s})}snapDraw(t,e,s){const i=this.bundle,o=e.length>=3?e[0]:null;return i&&o&&Math.hypot((t[0]-o[0])*i.width,(t[1]-o[1])*i.height)*(this.canvas?.zoom??1)<=F?o:this.snap(t,e.at(-1)??null,s)}openingAt(t,e,s){const i=this.wallLengthM(e,t),o=_r/(this.canvas?.zoom??1)*x(t).scale;let n=null,r=Number.POSITIVE_INFINITY;for(const a of t.openings){const l=a.wall_id===e.id?Math.abs(a.t-s)*i:Number.POSITIVE_INFINITY;l<=a.width_m/2+o&&l<r&&(n=a,r=l)}return n}onPlanHover(t,e,s,i=!1){const o=this.bundle,n=this.studio.doc;if(!o||!n||!this.studioPlacing||i){this.hover=null;return}const r=[t,e];if(this.tool==="library"||this.tool==="circuits")this.hover=this.gridPoint(r);else if(this.tool==="connectors")this.hover=this.snap(r,null,!0);else if(this.tool==="calibrate")this.hover=this.snap(r,null,!0);else if(this.tool==="walk")this.hover=r;else if(this.tool==="measure")this.hover=this.snap(r,this.measurePts.at(-1)??null,s);else if(this.straightDrawing)this.hover=this.snapDraw(r,this.wallDraft??[],s);else if(this.curveDrawing)this.hover=this.snapCurve(r,this.curveDraft??[],s);else if(this.studioMode==="label")this.hover=r;else if(this.studioMode==="markdoor")this.hover=null;else{const a=et(r,this.shownWalls(n),o.width,o.height,Ft/(this.canvas?.zoom??1));this.hover=a&&!this.openingAt(n,a.wall,a.t)?L(a.wall,a.t,o.width,o.height):null}}studioClick(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return;const n=[t,e];if(this.tool==="library"){this.placingItem&&this.placeItem(n);return}if(this.tool==="circuits"){this.circuitPlacing&&this.circuitSel&&this.placeCircuitLamp(n);return}if(this.tool==="connectors"){if(!this.connMode)return;const w=this.snap(n,null,!0);if(!this.connStart){this.connStart=w;return}const b=this.drawConnector(o,this.connMode,this.connStart,w);this.connStart=null,this.studio.commit(b.doc),this.lastEdit="structure",this.geomSel={id:b.id,kind:"connector"};return}if(this.tool==="walk"){this.placeWalkPosition(o,n);return}if(this.tool==="calibrate"){const w=this.snap(n,null,!0),b=this.calib;this.calib=!b.a||b.b?{...B,a:w}:{...b,b:w};return}if(this.tool==="measure"){this.measurePts=[...this.measurePts,this.snap(n,this.measurePts.at(-1)??null,s)];return}const r=this.studioMode,a=this.canvas?.zoom??1;if(this.curveDrawing){this.curveClick(n,s);return}if(this.straightDrawing){const w=this.wallDraft??[],b=this.snapDraw(n,w,s),$=S=>!!S&&Math.hypot((S[0]-n[0])*i.width,(S[1]-n[1])*i.height)*a<8;if(w.length&&($(w[w.length-1])||$(this.lastDrawClick))){this.finishWall();return}if(w.length>=3&&b===w[0]){this.wallDraft=[...w,w[0]],this.finishWall();return}this.wallDraft=[...w,b],this.lastDrawClick=n;return}if(r==="curve"||r==="wall"||r==="curved"||r==="glass")return;if(r==="label"){const w=pi(o,n,"תווית"),b=this.placeOpts(o).levelId;this.studio.commit(b===C(o)?w.doc:st(w.doc,w.id,{level_id:b})),this.lastEdit="structure",this.geomSel={id:w.id,kind:"label"};return}if(r==="select")return;if(r==="markdoor"){this.markDoorClick(n);return}const l=et(n,this.shownWalls(o),i.width,i.height,Ft/a);if(!l){this.flash("לחץ על קיר כדי להציב פתח",2500);return}const d=this.openingAt(o,l.wall,l.t);if(d){this.onGeomSelect(d.id,"opening");return}const[c,u]=ot(Vi(r).width_m,this.wallLengthM(l.wall,o)),v=We(o,l.wall.id,Math.min(u,Math.max(c,l.t)),r);this.studio.commit(v.doc),this.lastEdit="structure",this.geomSel={id:v.id,kind:"opening"}}startMarkDoor(){const t=this.wallDraft;t&&t.length>=2?(this.finishWall(),this.flash("הקיר שבציור נשמר; סמן דלת פעיל")):t&&this.flash("נקודת הקיר שהתחלת בוטלה; סמן דלת פעיל"),this.curveDraft&&this.curveDraft.length>=2&&this.finishCurve(!1),this.curveDraft=null,this.curveRedo=[],this.tool!=="structure"&&this.pickTool("structure"),this.studioMode="markdoor",this.wallDraft=null,this.hover=null}flash(t,e=3500){this.info=t,window.clearTimeout(this.infoTimer),this.infoTimer=window.setTimeout(()=>{this.infoTimer=0,this.info===t&&(this.info="")},e)}flashError(t,e=3500){this.error=t,window.clearTimeout(this.errorTimer),this.errorTimer=window.setTimeout(()=>{this.errorTimer=0,this.error===t&&(this.error="")},e)}dropOrphanGhost(){const t=this.studio.doc;this.doorGhost&&t&&!Z(t,this.doorGhost)&&(this.dropDoorGhost(),this.flash("הקיר של ההצעה הוסר; ההצעה בוטלה"))}selectExisting(t){const e=this.studio.doc,s=this.bundle,i=e&&s?Zn(e,t,s.width,s.height):null;return i?(this.doorGhost=null,this.geomSel={id:i.id,kind:"opening"},this.flash("כאן כבר יש דלת: היא נבחרה"),!0):!1}dropDoorGhost(){this.doorToken++,this.doorGhost=null,this.doorAsking=!1}async markDoorClick(t){const e=this.bundle;if(!e||!this.studio.doc||this.doorAsking)return;const s=e.width,i=e.height;if(this.doorGhost){const l=Bn(this.studio.doc,this.doorGhost,t,s,i);if(this.acceptDoorGhost(),l)return}const o=this.studio.doc,n=this.canvas?.zoom??1,r=et(t,this.shownWalls(o),s,i,Ft/n);if(e.source!=="api"||!e.planVersionId){if(!r){this.flash("לחץ על קיר כדי להציב דלת",2500);return}const l=Gn(o,r.wall,r.t,t,s,i);this.selectExisting(l)||(this.doorGhost=l);return}const a=++this.doorToken;this.doorAsking=!0;try{await this.studio.flush();const l=this.activeLevel,d=await en(e.planVersionId,{x:+t[0].toFixed(5),y:+t[1].toFixed(5),...r?{wall_id:r.wall.id}:{},...l?{level_id:l}:{}}),c=this.studio.doc;if(a!==this.doorToken||!c||this.tool!=="structure"||this.studioMode!=="markdoor")return;const u=An(c,d,s,i,this.wallDefaults);if(!Z(c,u)){this.flash("הקיר של ההצעה לא נמצא בטיוטה; שמור ונסה שוב",4e3);return}this.selectExisting(u)||(this.doorGhost=u)}catch(l){if(a!==this.doorToken)return;this.flash(l instanceof P&&l.code==="door_proposal_timeout"?"ההצעה לא חושבה בזמן; לחץ שוב":k(l),4500)}finally{a===this.doorToken&&(this.doorAsking=!1)}}acceptDoorGhost(){const t=this.doorGhost,e=this.studio.doc,s=this.bundle;if(this.doorGhost=null,!t||!e||!s||this.selectExisting(t))return;const i=Rn(e,t,s.width,s.height,this.wallDefaults,this.placeOpts(e).levelId);i&&(this.studio.commit(i.doc),this.lastEdit="structure",this.geomSel={id:i.openingId,kind:"opening"})}onGhostHandle(t){const e=this.doorGhost,s=this.studio.doc,i=this.bundle;!e||!s||!i||(t.id==="accept"?this.acceptDoorGhost():t.id==="hinge"?this.doorGhost=Ke(e):t.id==="swing"?this.doorGhost=Nn(e):t.id==="width"&&t.x!==void 0&&t.y!==void 0&&(this.doorGhost=Fn(s,e,[t.x,t.y],i.width,i.height)))}renderMarkDoorHint(){const t=this.doorGhost;if(this.doorAsking)return h`<div class="placing-hint" data-mark-door-hint="asking"><span>מחפש את הדלת בשרטוט…</span></div>`;if(!t)return h`<div class="placing-hint" data-mark-door-hint="idle"><span>סמן דלת: לחץ על סמל הדלת בתוכנית · Esc לביטול</span></div>`;const e=gt(t.width_m,x(this.studio.doc).estimated,this.showEstimates);return h`<div class="placing-hint bindbar" data-mark-door-hint="ghost" data-ghost-found=${t.found}><span><b data-ghost-note-text>${t.note}</b> · ${e}${t.warning?h` · <span data-ghost-warning>${t.warning}</span>`:p}
      <button data-ghost-accept-btn @click=${()=>this.acceptDoorGhost()}>אשר (Enter)</button><button data-ghost-cancel-btn @click=${()=>this.dropDoorGhost()}>בטל (Esc)</button></span></div>`}finishWall(){const t=this.wallDraft;this.wallDraft=null,this.hover=null;const e=this.studio.doc;if(!e||!t||t.length<2)return;const s=Ue(e,t,this.drawDefaults);this.commitNewWall(e,s)}commitNewWall(t,e){const s=this.placeOpts(t).levelId;let i=s===C(t)?e.doc:it(e.doc,e.id,{level_id:s});if(this.studioMode==="glass"){const o=i.walls.find(n=>n.id===e.id);o?.glazing&&o.glazing.panel_width_m!==this.glassDraw.panel_width_m&&(i=it(i,e.id,{glazing:{...o.glazing,panel_width_m:this.glassDraw.panel_width_m}}))}this.studio.commit(i),this.lastEdit="structure",this.geomSel={id:e.id,kind:"wall"}}get drawDefaults(){return this.studioMode==="glass"?{kind:"glass",thickness_m:this.glassDraw.thickness_m}:this.wallDefaults}get straightDrawing(){return this.tool==="structure"&&(this.studioMode==="wall"||this.studioMode==="glass"&&!this.glassDraw.curved)}get curveDrawing(){return this.tool==="structure"&&(this.studioMode==="curved"||this.studioMode==="glass"&&this.glassDraw.curved)}snapCurve(t,e,s){const i=this.bundle,o=this.studio.doc;if(!i||!o)return t;const n=this.canvas?.zoom??1,r=e.length>=3?e[0]:null;if(r&&Math.hypot((t[0]-r[0])*i.width,(t[1]-r[1])*i.height)*n<=F)return r;if(s)return t;const a=tt(t,null,this.shownWalls(o),i.width,i.height,{tolPx:F/n,free:!0});return a===t?this.gridPoint(t):a}curveClick(t,e){const s=this.bundle;if(!s)return;const i=this.curveDraft??[],o=this.canvas?.zoom??1,n=this.snapCurve(t,i,e),r=a=>!!a&&Math.hypot((a[0]-t[0])*s.width,(a[1]-t[1])*s.height)*o<8;if(i.length&&(r(i[i.length-1])||r(this.lastDrawClick))){this.finishCurve(!1);return}if(i.length>=3&&n===i[0]){this.finishCurve(!0);return}i.length>=Ps||(this.curveDraft=[...i,n],this.curveRedo=[],this.lastDrawClick=t)}finishCurve(t){const e=this.curveDraft,s=this.bundle,i=this.studio.doc;if(this.curveDraft=null,this.curveRedo=[],this.hover=null,this.lastDrawClick=null,!e||!s||!i)return;const o=e.length>=2?Cs(i,e,t,this.drawDefaults,s.width,s.height):null;o&&this.commitNewWall(i,o)}curveUndoPoint(){const t=this.curveDraft;t?.length&&(this.curveRedo=[...this.curveRedo,t[t.length-1]],this.curveDraft=t.length>1?t.slice(0,-1):null,this.lastDrawClick=null,this.curveDraft||(this.hover=null))}curveRedoPoint(){const t=this.curveRedo[this.curveRedo.length-1];t&&(this.curveRedo=this.curveRedo.slice(0,-1),this.curveDraft=[...this.curveDraft??[],t])}curveLive(t){const e=this.curveDraft,s=this.studio.doc;return!this.curveDrawing||!e?.length||!s?null:this.memo("curveLive",[e,s,this.hover,t.width,t.height],()=>this.buildCurveLive(t,e,s))}buildCurveLive(t,e,s){const i=this.hover,o=!!i&&e.length>=3&&i===e[0],n=i&&!o?[...e,i]:e;return{...Os(n,o,t.width,t.height,x(s).scale),count:e.length}}renderCurveHint(t){const e=this.curveLive(t),s=this.studio.doc;if(!e||!s)return p;const{estimated:i}=x(s),o=Number.isFinite(e.minRadiusM)?gt(e.minRadiusM,i,this.showEstimates):A("straightLine"),n=this.studioMode==="glass"?vo("tool"):A("draft");return h`<div class="placing-hint bindbar float" data-curve-hint=${e.count}><span>${n}: ${e.count} ${A("points")} · ${A("length")} <b data-curve-length>${gt(e.lengthM,i,this.showEstimates)}</b> · ${A("minRadius")} <b data-curve-radius>${o}</b>${e.count>=3?h` · ${A("closeHint")}`:p}
      <button data-curve-finish ?disabled=${e.count<2} @click=${()=>this.finishCurve(!1)}>${A("finish")} (Enter)</button><button data-curve-undo @click=${()=>this.curveUndoPoint()}>${A("undoPoint")}</button><button data-curve-cancel @click=${()=>{this.curveDraft=null,this.curveRedo=[],this.hover=null}}>Esc</button></span></div>`}movedCurvePoint(t,e,s,i,o){const n=this.bundle;if(!n||s<0)return null;const r=this.canvas?.zoom??1;let a=i;if(!o){const u=tt(i,null,this.shownWalls(t).filter(v=>v.id!==e.id),n.width,n.height,{tolPx:F/r,free:!0});a=u===i?this.gridPoint(i):u}const l=Ts(t,e.id,s,a,n.width,n.height),d=l.walls.find(u=>u.id===e.id),c=d?ge(d):null;return{doc:l,vertex:c?.[Math.min(s,c.length-1)]??0}}onCanvasSelect(t){const e=t.kind==="wall"&&t.vertex!==void 0&&this.curveDrawing&&!this.curveDraft?this.studio.doc?.walls.find(s=>s.id===t.id):void 0;if(e&&t.vertex!==void 0&&X(e,t.vertex)>=0){const s=e.polyline[t.vertex];this.curveDraft=[[s[0],s[1]]],this.curveRedo=[],this.lastDrawClick=null;return}this.onGeomSelect(t.id,t.kind,t.vertex,!!t.add,t.segment)}onGeomSelect(t,e,s,i=!1,o){if(i&&this.multiOn&&s===void 0&&(e==="wall"||e==="object")){this.toggleSelection({id:t,kind:e});return}if(this.tool==="circuits"&&this.membersMode&&e==="object"&&this.circuitSel){const n=this.studio.doc,r=this.library,a=n?.objects.find(c=>c.id===t),l=a&&r?j(r,a.item_id):void 0;if(l&&!fe(l)){this.flash(`${l.names.he} אינו גוף תאורה`,2500);return}const d=this.circuitSel;this.edit(c=>gi(c,d,t));return}e==="object"&&this.tool!=="library"&&this.tool!=="select"&&this.pickTool("library"),e==="connector"&&this.tool!=="connectors"&&this.tool!=="select"&&this.pickTool("connectors"),e==="connector"&&this.tool==="select"&&this.loadLinkTargets(),this.zoneVertexSel=null,this.geomSel=o!==void 0?{id:t,kind:e,segment:o}:s===void 0?{id:t,kind:e}:{id:t,kind:e,vertex:s},this.multi=[],this.selectedId=null,this.selectedZoneId=null,e!=="object"&&e!=="group"&&(this.bindOffer=null)}onZoneSelect(t,e){if(!(this.placing||this.drawing||this.studioPlacing||this.tool==="detect"||t.startsWith("cand-"))){if(this.tool==="structure"||this.tool==="library"){this.geomSel=null;return}if(e&&this.multiOn){this.toggleSelection({id:t,kind:"zone"});return}this.selectedZoneId!==t&&(this.zoneVertexSel=null),this.selectedZoneId=t,this.selectedId=null,this.geomSel=null,this.multi=[]}}get multiOn(){return this.tool==="select"&&this.geomDragMode==="all"&&!this.phone.matches}get multiItems(){const t=this.studio.doc;if(!this.multi.length||!t)return[];const e=this.multiCache;if(e&&e.multi===this.multi&&e.doc===t&&e.zones===this.zones)return e.items;const s=new Set(t.walls.map(r=>r.id)),i=new Set(t.objects.map(r=>r.id)),o=new Set(this.zones.map(r=>r.id)),n=this.multi.filter(r=>(r.kind==="wall"?s:r.kind==="object"?i:o).has(r.id));return this.multiCache={multi:this.multi,doc:t,zones:this.zones,items:n},n}get highlightIds(){const t=this.studio.doc;if(this.geomSel?.kind==="group")return t?.groups.find(s=>s.id===this.geomSel.id)?.member_ids??T;if(this.tool==="circuits"&&this.circuitSel)return t?.circuits.find(s=>s.id===this.circuitSel)?.member_ids??T;const e=this.multiShown;return e.length?this.memo("highlightIds",[e],()=>e.map(s=>s.id)):T}get multiShown(){const t=this.tool==="select"?this.multiItems:[];return t.length>=2?t:[]}selectionItems(){if(this.multi.length)return this.multiItems;const t=this.geomSel;return t&&(t.kind==="wall"||t.kind==="object")?[{id:t.id,kind:t.kind}]:this.selectedZoneId?[{id:this.selectedZoneId,kind:"zone"}]:[]}setSelection(t){if(this.multiNote="",this.selectedId=null,this.zoneVertexSel=null,this.bindOffer=null,t.length>=2){this.multi=t,this.geomSel=null,this.selectedZoneId=null;return}this.multi=[];const e=t[0];this.geomSel=e&&e.kind!=="zone"?{id:e.id,kind:e.kind}:null,this.selectedZoneId=e?.kind==="zone"?e.id:null}toggleSelection(t){this.setSelection(fi(this.selectionItems(),t))}get pickableZones(){return this.showZones?this.zones:[]}onGeomBox(t){const e=this.studio.doc,s=this.bundle;if(!this.multiOn||!e||!s)return;const i=mi(e,this.pickableZones,t,this.activeLevel,s.width,s.height,x(e).scale);if(!t.add){this.setSelection(i);return}const o=this.selectionItems(),n=new Set(o.map(r=>r.id));this.setSelection([...o,...i.filter(r=>!n.has(r.id))])}selectAll(){const t=this.studio.doc;t&&this.setSelection(Dt(t,this.pickableZones,this.activeLevel))}multiDragged(t,e){if(!this.multiMember(e))return null;const s=this.multiShown,i=s.filter(b=>b.kind!=="zone").map(b=>b.id),o=new Map(this.zones.map(b=>[b.id,b])),n=s.filter(b=>b.kind==="zone").map(b=>o.get(b.id)).filter(b=>!!b),r=this.bundle,a=o.get(e.id)?.polygon[0],l=e.kind==="object"?t.objects.find(b=>b.id===e.id)?.position:e.kind==="wall"?t.walls.find(b=>b.id===e.id)?.polyline[0]:a&&[a.x,a.y],d=e.ctrl?0:this.gridPx(t),[c,u]=r&&l&&d?vi(l,e.x-e.sx,e.y-e.sy,d,r.width,r.height):[e.x-e.sx,e.y-e.sy],[v,w]=wi(t,i,c,u,n.map(b=>b.polygon));return{doc:yi(t,i,v,w),zones:Object.fromEntries(n.map(b=>[b.id,bi(b.polygon,v,w)]))}}multiMember(t){return(t.kind==="object"||t.kind==="wall"||t.kind==="zone")&&this.multiShown.some(e=>e.id===t.id)}async commitZoneMoves(t){const e=this.multi,s=new Map(this.zones.map(d=>[d.id,d])),i=Object.entries(t).map(([d,c])=>({z:s.get(d),polygon:c})).filter(d=>!!d.z&&JSON.stringify(d.z.polygon)!==JSON.stringify(d.polygon));if(!i.length||this.bundle?.source==="demo"){this.zonePreview=null;return}this.zonePreview=t,this.zoneSaving=!0;let o=[];try{o=(await Promise.allSettled(i.map(c=>this.sendZonePatch(c.z,{polygon:c.polygon})))).map(c=>c.status==="fulfilled"?c.value:k(c.reason))}finally{this.zonePreview=null,this.zoneSaving=!1}const n=i.map((d,c)=>({id:d.z.id,why:o[c]})).filter(d=>d.why!=="ok");if(!n.length)return;const r=n.some(d=>d.why==="conflict");r&&await this.load();const a=r?"אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש":n[0].why;if(this.error=`${n.length} מתוך ${i.length} אזורים לא הוזזו (${a}). שאר הבחירה זזה; האזורים שלא זזו נבחרו לבדם - גרור אותם למקומם (ביטול ב-Ctrl+Z מחזיר רק קירות ועצמים, לא אזורים)`,this.tool!=="select"||this.multi!==e)return;const l=new Set(this.zones.map(d=>d.id));this.setSelection(n.filter(d=>l.has(d.id)).map(d=>({id:d.id,kind:"zone"})))}async deleteMulti(){const t=this.multiShown;if(!t.length||!this.studio.doc||this.zoneSaving)return;const e=new Map(this.zones.map(u=>[u.id,u])),s=t.filter(u=>u.kind==="zone").map(u=>e.get(u.id)).filter(u=>!!u),i=this.bundle?.source==="demo",o=t.length-s.length,n=s.length===1?`את "${s[0].name}"`:`${s.length} אזורים`,r=o?`למחוק ${n} יחד עם ${I(o,"הפריט האחר שנבחר","הפריטים האחרים שנבחרו")}?`:`למחוק ${n}?`;if(s.length&&!i&&!window.confirm(`${r} מחיקת אזור אינה ניתנת לביטול; המצלמות והישויות בקומה לא מושפעות.`))return;const a=t.filter(u=>u.kind!=="zone").map(u=>u.id);if(a.length&&this.edit(u=>ki(u,a)),this.setSelection([]),!s.length)return;if(i){this.flash("נתוני הדגמה: אזורים נמחקים רק מול השרת.",3e3);return}this.zoneBusy=!0,this.error="";let l=[];try{const u=await Promise.allSettled(s.map(v=>this.sendZoneDelete(v)));l=s.map((v,w)=>({z:v,why:u[w].status==="fulfilled"?u[w].value:k(u[w].reason)})).filter(v=>v.why!=="ok")}finally{this.zoneBusy=!1}if(!l.length)return;this.error=`${l.length} מתוך ${s.length} אזורים לא נמחקו (${l[0].why}); הם נבחרו שוב כדי לנסות שוב`;const d=new Set(this.zones.map(u=>u.id)),c=!this.multi.length&&!this.geomSel&&!this.selectedZoneId&&!this.selectedId;this.tool==="select"&&c&&this.setSelection(l.filter(u=>d.has(u.z.id)).map(u=>({id:u.z.id,kind:"zone"})))}duplicateMulti(){const t=this.bundle,e=this.studio.doc,s=this.multiShown.filter(o=>o.kind==="object").map(o=>o.id);if(!t||!e||!s.length||this.zoneSaving)return;const i=$i(e,s,t.width,t.height,x(e).scale);i.ids.length&&(this.edit(()=>i.doc),this.setSelection(i.ids.map(o=>({id:o,kind:"object"}))))}handleMultiKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();return e&&!t.shiftKey&&!t.altKey&&(t.code==="KeyA"||s==="a")?(t.preventDefault(),this.selectAll(),!0):this.multiShown.length<2||this.geomPreview||this.zoneSaving?!1:t.key==="Delete"||t.key==="Backspace"?(t.preventDefault(),this.deleteMulti(),!0):e&&s==="d"?(t.preventDefault(),this.duplicateMulti(),!0):!1}renderMultiPanel(){const t=this.multiShown,e=this.studio.doc,s=i=>t.filter(o=>o.kind===i).length;return wo({walls:s("wall"),objects:s("object"),zones:s("zone"),busy:this.zoneBusy||this.zoneSaving,saveState:this.studio.saveState,tags:me(e,this.zones,t),levels:e.levels,circuits:e.circuits,lights:this.lightIds(e,t).length,note:this.multiNote,alignable:this.alignIds(e,t).length},{duplicate:()=>this.duplicateMulti(),remove:()=>void this.deleteMulti(),clear:()=>this.setSelection([]),addTag:i=>void this.bulkTag(i,!0),removeTag:i=>void this.bulkTag(i,!1),setLevel:i=>void this.bulkLevel(i),joinCircuit:i=>this.bulkCircuit(i),align:i=>this.bulkAlign(i),distribute:i=>this.bulkAlign(i)})}alignIds(t,e){const s=new Map(t.objects.map(i=>[i.id,i]));return e.filter(i=>i.kind==="object"&&s.has(i.id)&&!s.get(i.id).anchor_ref).map(i=>i.id)}bulkAlign(t){const e=this.studio.doc,s=this.bundle,i=this.multiShown;if(!e||!s||i.length<2||this.zoneSaving)return;const o=this.alignIds(e,i),{scale:n}=x(e),r=t==="x"||t==="y"?xi(e,o,t,s.width,s.height,n):_i(e,o,t,s.width,s.height,n),a=new Map(e.objects.map(c=>[c.id,c])),l=r.objects.filter(c=>a.get(c.id)!==c).length;this.edit(()=>r);const d=t==="x"?"פיזור לרוחב":t==="y"?"פיזור לגובה":"יישור";this.multiNote=l?`${d}: ${I(l,"עצם אחד זז","עצמים זזו")} (ביטול ב-Ctrl+Z)`:`${d}: העצמים כבר במקומם, שום דבר לא זז`}lightIds(t,e){const s=this.library;if(!s)return[];const i=new Map(t.objects.map(o=>[o.id,o]));return e.filter(o=>{const n=o.kind==="object"?i.get(o.id):void 0;return!!n&&fe(j(s,n.item_id))}).map(o=>o.id)}async patchZones(t,e){const s=t.map(o=>({z:o,body:e(o)})).filter(o=>o.body!==null);if(!s.length)return{sent:0,failed:[]};this.zoneBusy=!0,this.zoneSaving=!0;let i=[];try{const o=await Promise.allSettled(s.map(n=>this.sendZonePatch(n.z,n.body)));i=s.map((n,r)=>({z:n.z,why:o[r].status==="fulfilled"?o[r].value:k(o[r].reason)})).filter(n=>n.why!=="ok")}finally{this.zoneBusy=!1,this.zoneSaving=!1}if(i.some(o=>o.why==="conflict")){const o=this.multiNote;await this.load(),this.multiNote=o}return{sent:s.length,failed:i}}multiZones(t){const e=new Map(this.zones.map(s=>[s.id,s]));return{zs:t.filter(s=>s.kind==="zone").map(s=>e.get(s.id)).filter(s=>!!s),demo:this.bundle?.source==="demo"}}zoneFailText(t){if(!t.failed.length)return"";const e=t.failed.some(s=>s.why==="conflict")?"אזור השתנה בינתיים על ידי עורך אחר ונטען מחדש":t.failed[0].why;return` · ${t.failed.length} מתוך ${t.sent} אזורים לא עודכנו (${e})`}async bulkTag(t,e){const s=this.studio.doc,i=this.multiShown;if(!s||i.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,n=new Set(i.filter(y=>y.kind!=="zone").map(y=>y.id)),r=[...n],{zs:a,demo:l}=this.multiZones(i),d=y=>e&&(y?.length??0)>=zt&&Pt(y,t)===y,c=[...s.walls,...s.objects].filter(y=>n.has(y.id)&&d(y.tags)).length+a.filter(y=>d(y.tags)).length,u=Si(s,r,t,e),v=new Map([...s.walls,...s.objects].map(y=>[y.id,y])),w=[...u.walls,...u.objects].filter(y=>n.has(y.id)&&v.get(y.id)!==y).length;this.edit(()=>u);const b=y=>{const E=e?ke(y.tags,t):Pt(y.tags,t);return E===y.tags||!y.tags&&!E.length?null:{tags:E}},$=l?{sent:0,failed:[]}:await this.patchZones(a,b);if(this.multi!==o)return;const S=w+$.sent-$.failed.length;this.multiNote=(e?`התגית "${t}" נוספה ל־${S} מתוך ${i.length} פריטים`:`התגית "${t}" הוסרה מ־${S} פריטים`)+(c?` · ${I(c,"פריט אחד","פריטים")} כבר עם ${zt} תגיות`:"")+(l&&a.length?" · נתוני הדגמה: אזורים נשמרים רק מול השרת":"")+this.zoneFailText($)}async bulkLevel(t){const e=this.studio.doc,s=this.multiShown,i=e?.levels.find(y=>y.id===t);if(!e||!i||s.length<2||this.zoneBusy||this.zoneSaving)return;const o=this.multi,n=s.filter(y=>y.kind!=="zone").map(y=>y.id),r=C(e),{zs:a,demo:l}=this.multiZones(s),d=new Set(n),c=[...e.walls,...e.objects].filter(y=>d.has(y.id)&&y.level_id!==t).length,u=this.activeLevel!==null&&this.activeLevel!==t,v=y=>(y.level_id||r)!==t;this.edit(y=>Di(y,n,t));const w=l?{sent:0,failed:[]}:await this.patchZones(a,y=>v(y)?{level_id:t}:null);if(this.multi!==o)return;const b=new Set(l?a.filter(v).map(y=>y.id):w.failed.map(y=>y.z.id));b.size&&this.setSelection(this.multiItems.filter(y=>!b.has(y.id))),u&&(this.levelFilter=t);const $=c+w.sent-w.failed.length,S=`${I($,"פריט אחד הועבר","פריטים הועברו")} למפלס "${i.name}"`+(l&&a.length?" · נתוני הדגמה: אזורים נשמרים רק מול השרת":"")+this.zoneFailText(w)+(b.size?` · ${I(b.size,"האזור שלא הועבר הוצא מהבחירה","האזורים שלא הועברו הוצאו מהבחירה")}`:"");this.multiNote=S,w.failed.length&&(this.error=S)}bulkCircuit(t){const e=this.studio.doc,s=this.multiShown,i=e?.circuits.find(a=>a.id===t);if(!e||!i||s.length<2)return;const o=new Set(this.lightIds(e,s)),n=Ii(e,t,s.filter(a=>a.kind==="object").map(a=>a.id),a=>o.has(a.id));this.edit(()=>n.doc);const r=s.length-n.added.length;this.multiNote=r?`${n.added.length} מתוך ${s.length} פריטים שנבחרו נוספו למעגל "${i.name}"; ${I(r,"האחר אינו גוף תאורה","האחרים אינם גופי תאורה")}`:`${I(n.added.length,"גוף תאורה אחד נוסף","גופי תאורה נוספו")} למעגל "${i.name}"`}get shownTags(){const t=this.studio.doc;return t?this.memo("shownTags",[t,this.zones,this.showZones,this.activeLevel],()=>me(t,this.pickableZones,Dt(t,this.pickableZones,this.activeLevel))):T}selectByTag(t){const e=this.studio.doc;if(!e||(this.tool!=="select"&&this.pickTool("select"),!this.multiOn))return;const s=zi(e,this.pickableZones,t,this.activeLevel);this.setSelection(s),s.length||this.flash(`אין פריטים עם התגית "${t}" במפלס המוצג`,3e3)}wallLengthM(t,e){const s=this.bundle;return s?Zt(t,s.width,s.height)*x(e).scale:0}dragged(t,e){const s=this.bundle;if(!s||e.kind==="zone")return null;const i=[e.x,e.y];if(e.kind==="object"||e.kind==="object-duplicate"){const r=t.objects.find(w=>w.id===e.id);if(!r)return null;if(r.anchor_ref)return{doc:t,sel:{id:e.id,kind:"object"}};const a=[r.position[0]+e.x-e.sx,r.position[1]+e.y-e.sy],l=this.geomSel?.kind==="group"&&r.group_id===this.geomSel.id?r.group_id:null,d=this.canvas?.zoom??1,c=e.ctrl?{gridPx:0,tolPx:0}:{gridPx:this.gridPx(t),tolPx:l?0:Zi/d},u=Mi(r,a,c.tolPx?this.alignTargets(t,e.kind==="object"?e.id:""):[],c,s.width,s.height,x(t).scale),v=u.position;if(e.kind==="object-duplicate"){this.dupId??=ve();const w=Pi(t,e.id,v,this.dupId);return{doc:w.doc,sel:{id:w.id,kind:"object"},guides:u.guides}}return l?{doc:Ci(t,l,v[0]-r.position[0],v[1]-r.position[1]),sel:{id:l,kind:"group"}}:{doc:we(t,e.id,v),sel:{id:e.id,kind:"object"},guides:u.guides}}if(e.kind==="object-rotate"){const r=t.objects.find(a=>a.id===e.id);return!r||r.anchor_ref?null:{doc:Q(t,e.id,{rotation_deg:Oi(r,i,s.width,s.height,e.shift?15:1)}),sel:{id:e.id,kind:"object"}}}if(e.kind==="object-stretch"){const r=t.objects.find(l=>l.id===e.id);if(!r)return null;const a=Ti(r,e.index%4,i,s.width,s.height,x(t).scale,e.shift);return{doc:Q(t,e.id,{size:a}),sel:{id:e.id,kind:"object"}}}if(e.kind==="connector-vertex"){const r=t.connectors.find(a=>a.id===e.id);return!r||Ot(r)?null:{doc:Ai(t,e.id,e.index,this.snap(i,null,!0)),sel:{id:e.id,kind:"connector"}}}if(e.kind==="connector"){const r=t.connectors.find(a=>a.id===e.id);return!r||Ot(r)?null:{doc:Li(t,e.id,e.x-e.sx,e.y-e.sy),sel:{id:e.id,kind:"connector"}}}if(e.kind==="wall"){const r=t.walls.find(a=>a.id===e.id);return r?{doc:be(t,r.id,...this.wallDelta(t,r,e)),sel:{id:r.id,kind:"wall"}}:null}if(e.kind==="segment")return{doc:As(t,e.id,e.index,[e.x,e.y],s.width,s.height),sel:{id:e.id,kind:"wall",segment:e.index}};if(e.kind==="curve-point"||e.kind==="vertex"&&t.walls.some(r=>r.id===e.id&&X(r,e.index)>=0)){const r=t.walls.find(l=>l.id===e.id),a=r?this.movedCurvePoint(t,r,X(r,e.index),[e.x,e.y],e.ctrl):null;return a?{doc:a.doc,sel:{id:e.id,kind:"wall",vertex:a.vertex}}:null}if(e.kind==="vertex"){const r=t.walls.find(S=>S.id===e.id);if(!r)return null;const a=r.polyline,l=a.length-1,d=Mt(a),c=d&&e.index===l?0:e.index,u=d?l:a.length,v=d?[(c+u-1)%u,c,(c+1)%u]:[c-1,c,c+1],w={...r,polyline:a.slice(0,u).filter((S,y)=>!v.includes(y)),bulges:void 0},b=[...t.walls.filter(S=>S.id!==e.id),w],$=tt(i,c>0?a[c-1]:null,b,s.width,s.height,{tolPx:F/(this.canvas?.zoom??1),free:!0});return{doc:d&&c===0?W(W(t,e.id,0,$),e.id,l,$):W(t,e.id,c,$),sel:{id:e.id,kind:"wall",vertex:c}}}if(e.kind==="opening"){const r={id:e.id,kind:"opening"},a=t.openings.find(w=>w.id===e.id),l=a&&t.walls.find(w=>w.id===a.wall_id),d=a&&l?et(i,[l],s.width,s.height,Number.POSITIVE_INFINITY):null,c=a&&l?et([e.sx,e.sy],[l],s.width,s.height,Number.POSITIVE_INFINITY):null;if(!a||!l||!d||!c)return{doc:t,sel:r};const[u,v]=ot(a.width_m,this.wallLengthM(l,t));return{doc:bt(t,e.id,{t:Math.min(v,Math.max(u,a.t+d.t-c.t))}),sel:r}}const o=t.labels.find(r=>r.id===e.id),n={id:e.id,kind:"label"};return o?{doc:st(t,e.id,{position:[o.position[0]+e.x-e.sx,o.position[1]+e.y-e.sy]}),sel:n}:{doc:t,sel:n}}wallDelta(t,e,s){const i=this.bundle;let o=s.x-s.sx,n=s.y-s.sy;if(!i)return[o,n];s.shift&&(Math.abs(o*i.width)>=Math.abs(n*i.height)?n=0:o=0);const r=this.shownWalls(t).filter(u=>u.id!==e.id),a=F/(this.canvas?.zoom??1);let l=null,d=Number.POSITIVE_INFINITY;const c=Mt(e.polyline)?e.polyline.slice(0,-1):e.polyline;for(const u of c){const v=[u[0]+o,u[1]+n],w=tt(v,null,r,i.width,i.height,{tolPx:a,free:!0}),b=[w[0]-v[0],w[1]-v[1]],$=Math.hypot(b[0]*i.width,b[1]*i.height);$>0&&$<d&&(l=b,d=$)}return l&&!s.shift?(o+=l[0],n+=l[1]):l&&n===0?o+=l[0]:l&&(n+=l[1]),[o,n]}queueDragMove(t){this.dragMovePending=t,!this.dragMoveFrame&&(this.dragMoveFrame=requestAnimationFrame(()=>{this.dragMoveFrame=0;const e=this.dragMovePending;this.dragMovePending=null,e&&this.onGeomDragMove(e)}))}cancelDragMove(){this.dragMoveFrame&&cancelAnimationFrame(this.dragMoveFrame),this.dragMoveFrame=0,this.dragMovePending=null}onGeomDragMove(t){const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.geomPreview=null;return}const s=e?this.multiDragged(e,t):null;if(s){this.geomPreview=s.doc,this.zonePreview=s.zones,this.guides=[];return}const i=e?this.dragged(e,t):null;this.geomPreview=i?.doc??null,this.guides=i?.guides??[],i&&this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex)}onGeomDrag(t){this.geomPreview=null,this.guides=[];const e=this.studio.doc;if(this.zoneSaving&&this.multiMember(t)){this.flash("האזורים של ההזזה הקודמת עדיין נשמרים; גרור שוב בעוד רגע",3e3);return}const s=e?this.multiDragged(e,t):null;if(s){this.edit(()=>s.doc),this.commitZoneMoves(s.zones);return}const i=e?this.dragged(e,t):null;this.guideCache=null,i&&(this.edit(()=>i.doc),this.onGeomSelect(i.sel.id,i.sel.kind,i.sel.vertex),this.dupId=null,i.sel.kind==="object"&&this.offerBinding(i.sel.id))}nudgeGeom(t){const e=this.geomSel,s=this.bundle,i=this.studio.doc;if(!e||!s||!i||this.geomPreview||this.wallDraft||t.ctrlKey||t.metaKey||t.altKey)return!1;const{scale:o,estimated:n}=x(i),r=n?(t.shiftKey?.01:.002)*s.width:(t.shiftKey?.1:.01)/o;let a,l=e.id;if(e.kind==="opening"){const c=i.openings.find(y=>y.id===e.id),u=c&&i.walls.find(y=>y.id===c.wall_id),v=u?Zt(u,s.width,s.height):0;if(!c||!u||!(v>0))return!1;const[w,b]=lt(u,c.t,s.width,s.height),$=Math.abs(w)>=Math.abs(b);let S=0;if($&&t.key==="ArrowRight"?S=Math.sign(w):$&&t.key==="ArrowLeft"?S=-Math.sign(w):!$&&t.key==="ArrowDown"?S=Math.sign(b):!$&&t.key==="ArrowUp"&&(S=-Math.sign(b)),t.preventDefault(),!S)return!0;a=bt(i,c.id,{t:Ei(c.t,S*r/v,ot(c.width_m,this.wallLengthM(u,i)))})}else{const c=(t.key==="ArrowRight"?r:t.key==="ArrowLeft"?-r:0)/s.width,u=(t.key==="ArrowDown"?r:t.key==="ArrowUp"?-r:0)/s.height;if(e.kind==="object"){const v=i.objects.find(w=>w.id===e.id);if(!v||v.anchor_ref)return!1;a=we(i,v.id,[v.position[0]+c,v.position[1]+u])}else if(e.kind==="label"){const v=i.labels.find(w=>w.id===e.id);if(!v)return!1;a=st(i,v.id,{position:[v.position[0]+c,v.position[1]+u]})}else{const v=i.walls.find(b=>b.id===e.id),w=e.vertex;if(!this.geomSelectMode||!v)return!1;if(w===void 0)a=be(i,v.id,c,u),l=`${v.id}:all`;else{if(!v.polyline[w])return!1;const b=[v.polyline[w][0]+c,v.polyline[w][1]+u],$=v.polyline.length-1,S=X(v,w);if(S>=0){const y=this.movedCurvePoint(i,v,S,b,!0);if(!y)return!1;a=y.doc,this.geomSel={id:v.id,kind:"wall",vertex:y.vertex}}else a=Mt(v.polyline)&&w===0?W(W(i,v.id,0,b),v.id,$,b):W(i,v.id,w,b);l=`${v.id}:${S>=0?`p${S}`:w}`}}}t.preventDefault();const d=c=>JSON.stringify(e.kind==="opening"?c.openings.find(u=>u.id===e.id):e.kind==="label"?c.labels.find(u=>u.id===e.id):e.kind==="object"?c.objects.find(u=>u.id===e.id):c.walls.find(u=>u.id===e.id));return d(a)!==d(i)&&this.commitNudge(l,a),!0}commitNudge(t,e){const s=this.studio.doc;if(!s)return;const i=performance.now(),o=this.nudgeBurst;o&&o.key===t&&o.doc===s&&i-o.at<kr&&this.studio.canUndo&&this.studio.undo(),this.studio.commit(e),this.lastEdit="structure",this.nudgeBurst={key:t,doc:e,at:i}}handleStudioKey(t){const e=t.ctrlKey||t.metaKey,s=t.key.toLowerCase();if(t.key==="Enter"&&this.doorGhost)return t.preventDefault(),this.acceptDoorGhost(),!0;if(t.key==="Enter"&&this.wallDraft)return t.preventDefault(),this.finishWall(),!0;if(t.key==="Enter"&&this.curveDraft)return t.preventDefault(),this.finishCurve(!1),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.curveDraft)return t.preventDefault(),this.curveUndoPoint(),!0;if((t.ctrlKey||t.metaKey)&&this.curveDraft&&(t.key.toLowerCase()==="z"||t.key.toLowerCase()==="y"))return t.preventDefault(),t.key.toLowerCase()==="y"||t.shiftKey?this.curveRedoPoint():this.curveUndoPoint(),!0;if((t.key==="Backspace"||t.key==="Delete")&&this.wallDraft)return t.preventDefault(),this.wallDraft=this.wallDraft.length>1?this.wallDraft.slice(0,-1):null,this.lastDrawClick=null,!0;if(this.tool==="detect"&&(t.key==="Delete"||t.key==="Backspace")&&this.candSel)return t.preventDefault(),(this.candStates[this.candSel]??"accepted")==="accepted"&&this.toggleCandidate(this.candSel),!0;if(this.detectBusy&&e&&(s==="z"||s==="y"))return!0;if((t.key==="Delete"||t.key==="Backspace")&&this.geomSel){t.preventDefault();const{id:i,kind:o,vertex:n}=this.geomSel;if(o==="group")return this.groupDelete=i,!0;const r=o==="connector"?this.studio.doc?.connectors.find(d=>d.id===i):void 0;if(r&&Ot(r))return this.flash("המחבר נגזר מעצם: מוחקים או עורכים את העצם עצמו",4e3),!0;if(r&&r.floor_ids.length)return this.removeConnector(i),!0;const a=o==="wall"&&n!==void 0?this.studio.doc?.walls.find(d=>d.id===i):void 0,l=a&&n!==void 0?X(a,n):-1;if(a&&l>=0&&this.bundle){const d=this.bundle,c=this.studio.doc,u=c?ae(c,i,l,d.width,d.height):null;return u&&this.edit(()=>u.doc),this.geomSel=u&&!u.wallRemoved?{id:i,kind:o}:null,!0}if(o==="wall"&&n!==void 0&&this.geomSelectMode){const d=this.studio.doc,c=d?ji(d,i,n):null;return c&&this.edit(()=>c.doc),this.geomSel=c&&!c.wallRemoved?{id:i,kind:o}:null,!0}return this.edit(d=>U(d,i)),this.geomSel=null,!0}return e&&s==="d"&&this.geomSel?.kind==="object"&&(this.tool==="library"||this.tool==="select")&&this.studio.doc&&!this.geomPreview?(t.preventDefault(),this.duplicateSel(this.geomSel.id),!0):$r.includes(t.key)&&(this.tool==="structure"||this.tool==="library"||this.tool==="select")&&this.nudgeGeom(t)?!0:e&&(s==="z"||s==="y")?(t.preventDefault(),s==="y"||t.shiftKey?this.redoAny():this.undoAny(),!0):e&&s==="s"?(t.preventDefault(),this.studio.flush(),this.tool==="select"&&this.dirty.size&&this.save(),!0):!1}duplicateSel(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;const i=Ni(s,t,e.width,e.height,x(s).scale);i.id!==t&&(this.edit(()=>i.doc),this.geomSel={id:i.id,kind:"object"})}focusGeom(t){const e=this.bundle,s=this.studio.doc;if(!e||!s)return;this.activeLevel!==null&&!he(s,t,this.activeLevel)&&(this.levelFilter=null),this.multi=[];const i=s.walls.find(c=>c.id===t),o=s.openings.find(c=>c.id===t),n=s.labels.find(c=>c.id===t),r=o?s.walls.find(c=>c.id===o.wall_id):void 0,a=s.objects.find(c=>c.id===t),l=i?L(i,.5,e.width,e.height):o&&r?L(r,o.t,e.width,e.height):n?n.position:a?a.position:null;if(a){this.pickTool("library"),this.geomSel={id:t,kind:"object"},l&&this.canvas?.centerOn(l[0],l[1]);return}const d=s.connectors.find(c=>c.id===t);if(d){this.pickTool("connectors"),this.geomSel={id:t,kind:"connector"};const c=d.polyline[Math.floor(d.polyline.length/2)];c&&this.canvas?.centerOn(c[0],c[1]);return}this.tool="structure",this.studioMode="select",this.wallDraft=null,this.geomSel=i?{id:t,kind:"wall"}:o?{id:t,kind:"opening"}:n?{id:t,kind:"label"}:null,l&&this.canvas?.centerOn(Math.min(1,Math.max(0,l[0])),Math.min(1,Math.max(0,l[1])))}async copyStructure(t){const e=this.bundle;if(e?.planVersionId){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}await sn(e.planVersionId,t),await this.loadStudio(e,!0)&&this.flash("המבנה הועתק לטיוטה; בדוק מיקומים ופרסם",4e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}takeDxf(t){const e=gn(t);this.presetCandidates="",e&&(this.showCandidates(e,"dxf"),this.pickTool("detect"))}showCandidates(t,e){const s=this.studio.doc;let i=fn(t);if(s&&e==="detect"){const{scale:o}=x(s);(i.scaleMPerPx===null||Math.abs(i.scaleMPerPx-o)>o*1e-6)&&(i=Pe(i,o))}this.cands={set:i,result:t,source:e},this.candStates=mn(i),this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}async runDetect(){const e=this.bundle?.planVersionId;if(!e||this.detectRun.busy||this.busy||!this.detectOpts.walls)return;const s=++this.detectToken,i=this.detectRun.limitS,o=Date.now();this.detectRun={busy:!0,startedAt:o,elapsed:0,error:"",timedOut:!1,limitS:i};const n=()=>s===this.detectToken&&this.bundle?.planVersionId===e;clearInterval(this.elapsedTimer),this.elapsedTimer=setInterval(()=>{const r=Math.floor((Date.now()-o)/1e3);s===this.detectToken&&r!==this.detectRun.elapsed&&(this.detectRun={...this.detectRun,elapsed:r})},1e3);try{if(!await this.studio.flush()){n()&&(this.error=this.studio.error);return}if(!n())return;const r=this.detectOpts.openings?["walls","openings"]:["walls"],a=this.detectOpts,l=await on(e,{targets:r,strength:a.strength,hollow_walls:a.hollow!==!1,section_lines:a.sectionLines!==!1,join_gaps:a.joinGaps!==!1,steps_regions:a.stepsRegions!==!1,columns:a.columns!==!1});if(!n()||l.version_id!==e)return;this.showCandidates(l,"detect"),this.detectRun={busy:!1,startedAt:0,elapsed:Math.round((Date.now()-o)/1e3),error:"",timedOut:!1,limitS:i}}catch(r){if(!n())return;const a=r instanceof P&&r.code==="detect_timeout",l=r instanceof P?Number(r.body.details?.timeout_s):NaN,d=a&&l>0?l:i;this.detectRun={busy:!1,startedAt:0,elapsed:0,timedOut:a,limitS:d,error:a?`הזיהוי לא הסתיים${d?` תוך ${d} שניות`:" בזמן"}. נסה שוב בעוצמת ניקוי נמוכה יותר (תוכנית גדולה או סריקה רועשת לוקחות זמן).`:k(r)}}finally{s===this.detectToken&&(clearInterval(this.elapsedTimer),this.detectRun.busy&&(this.detectRun={...this.detectRun,busy:!1}))}}toggleCandidate(t){const e=this.cands?.set;if(!e||this.busy)return;const s=(this.candStates[t]??"accepted")==="accepted"?"rejected":"accepted",i={...this.candStates,[t]:s};if(s==="rejected")for(const o of e.openings)o.wall_id===t&&(i[o.id]="rejected");else{const o=e.openings.find(n=>n.id===t);o&&(i[o.wall_id]="accepted")}this.candStates=i,this.candSel=t,this.detectAsk=null}acceptRule(t){const e=this.cands?.set;if(!e||this.busy)return;const s=new Set(Ce(e,t));this.candStates=Object.fromEntries(mt(e).map(i=>[i,s.has(i)?"accepted":"rejected"])),this.detectAsk=null}get shownCandStates(){const t=this.cands?.set.objects??[];if(!t.length)return this.candStates;const e=this.candStatesShown;if(e&&e.states===this.candStates&&e.objects===t&&e.on===this.candObjectsOn)return e.shown;const s=this.candObjectsOn?"accepted":"rejected",i={...this.candStates,...Object.fromEntries(t.map(o=>[o.id,s]))};return this.candStatesShown={states:this.candStates,objects:t,on:this.candObjectsOn,shown:i},i}get acceptedCandidateIds(){const t=this.cands?.set;if(!t)return[];const e=Ce(t,mt(t).filter(s=>(this.candStates[s]??"accepted")==="accepted"));return this.candObjectsOn?[...e,...t.objects.map(s=>s.id)]:e}focusCandidate(t){const e=this.bundle,s=this.cands?.set;if(!e||!s)return;this.candSel=t;const i=s.walls.find(a=>a.id===t),o=s.openings.find(a=>a.id===t),n=o?s.walls.find(a=>a.id===o.wall_id):void 0,r=i?L(i,.5,e.width,e.height):n&&o?L(n,o.t,e.width,e.height):null;r&&this.canvas?.centerOn(Math.min(1,Math.max(0,r[0])),Math.min(1,Math.max(0,r[1])))}onCandidateDrag(t){const e=this.cands;if(!e||this.narrow||this.busy)return;const s=vn(e.set,t.id,t.index,[t.x,t.y]);if(s===e.set)return;const i=s.walls.find(o=>o.id===t.id);i&&(this.cands={...e,set:s},this.candEdits={...this.candEdits,[t.id]:{polyline:i.polyline}},this.candSel=t.id)}discardCandidates(){this.cands=null,this.candStates={},this.candSel=null,this.candEdits={},this.candObjectsOn=!0,this.hintApplied=!1,this.detectAsk=null,this.detectErr=null}setSources(t){return new Set([...t.walls,...t.openings,...t.objects].map(e=>e.source))}acceptedSources(){const t=this.cands,e=new Set(this.acceptedCandidateIds),s=new Set;if(!t)return s;for(const i of[...t.set.walls,...t.set.openings,...t.set.objects])e.has(i.id)&&s.add(i.source);return s}replacedIn(t,e){const s=a=>e.has(a.source)&&a.locked!==!0,i=new Set(t.walls.filter(s).map(a=>a.id)),o=new Set(t.walls.filter(a=>!s(a)).map(a=>a.id));let n=0,r=0;for(const a of t.openings)s(a)&&!o.has(a.wall_id)?n+=1:i.has(a.wall_id)&&(r+=1);return{walls:i.size,openings:n,objects:t.objects.filter(s).length,manual:r}}replacePlan(t){if(!this.detectOpts.replaceAuto)return null;const e=this.replacedIn(t,this.acceptedSources());return e.walls+e.openings+e.objects>0?e:null}confirmCandidates(){const t=this.cands,e=this.studio.doc;if(!t||!e||!this.acceptedCandidateIds.length||this.busy)return;const s=this.replacePlan(e);if(s){this.detectAsk={existing:{walls:s.walls,openings:s.openings,objects:s.objects},manualOnAuto:s.manual};return}this.sendAccept()}async sendAccept(){const t=this.bundle,e=this.cands,s=this.acceptedCandidateIds,i=t?.planVersionId;if(!t||!i||!e||!s.length||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="",this.detectErr=null;try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o()||!this.studio.doc)return;const n=this.replacePlan(this.studio.doc)!==null,r=new Set(s),a=Object.fromEntries(Object.entries(this.candEdits).filter(([c])=>r.has(c))),l=await nn(i,{accepted:s,edits:a,replace_auto:n,candidates:{walls:e.set.walls,openings:e.set.openings,objects:e.set.objects},base_revision:this.studio.revision,detector:e.result.detector});if(o()||(this.studio.adopt(l)||await this.loadStudio(t,!0),o()))return;const d=l.merge;this.discardCandidates(),this.geomSel=null,this.flash(`${I(s.length,"פריט אחד נוסף","פריטים נוספו")} לטיוטת המבנה${d?.removed_auto?` · ${d.removed_auto} קודמים הוחלפו`:""}${d?.removed_manual_openings?` · ${I(d.removed_manual_openings,"פתח ידני אחד הוסר","פתחים ידניים הוסרו")} עם הקירות שלהם`:""}; בדוק ופרסם`,6e3)}catch(n){if(o())return;const r=this.acceptErrorOf(n);this.detectErr=r,r.ids.length&&this.focusCandidate(r.ids[0])}finally{this.busy=!1,this.detectAsk=null}}acceptErrorOf(t){const e=this.cands?.set,s=new Set(e?[...mt(e),...e.objects.map(d=>d.id)]:[]);if(!(t instanceof P))return{code:"network",message:k(t),ids:[],issues:[],stale:!1};const i=t.body.details??{},o=Array.isArray(i.ids)?i.ids.filter(d=>typeof d=="string"):[],r=(Array.isArray(i.issues)?i.issues:[]).filter(d=>typeof d=="object"&&d!==null).map(d=>({id:typeof d.id=="string"?d.id:null,message:typeof d.message=="string"?d.message:"בעיה במבנה"})),a=[...new Set([...o,...r.map(d=>d.id).filter(d=>!!d)])].filter(d=>s.has(d)),l={stale_revision:"טיוטת המבנה השתנתה בינתיים (עריכה בחלון אחר). טען את הטיוטה מחדש ואשר שוב; המועמדים נשארים.",unknown_candidate:"מועמד שסומן לאישור לא נמצא בין המועמדים שנשלחו; הרץ זיהוי מחדש.",orphan_opening:"פתח סומן לאישור בלי הקיר שלו: קבל גם את הקיר או דחה את הפתח.",candidate_source:"מועמד בלי מקור אוטומטי או מיובא נשלח לאישור; הרץ זיהוי מחדש.",duplicate_candidate:"אותו מועמד נשלח פעמיים; הרץ זיהוי מחדש.",candidate_shape:"צורת מועמד שגויה (למשל פתח בלי מזהה קיר); דחה את המסומנים ברשימה ונסה שוב.",geometry_structure:"המועמדים שנבחרו יוצרים מבנה לא תקין, ודבר לא נשמר. דחה או תקן את המסומנים ונסה שוב."};return{code:t.code,message:l[t.code]??k(t),ids:a,issues:r,stale:t.code==="stale_revision"}}async reloadForDetect(){const t=this.bundle;if(!(!t||this.busy)){this.busy=!0;try{await this.loadStudio(t,!0)&&(this.detectErr=null)}finally{this.busy=!1}}}get canEstimate(){return this.studio.doc?.dimensions.calibration?.status!=="measured"}rescaleCandidates(){const t=this.studio.doc,e=this.cands;t&&e&&e.source==="detect"&&(this.cands={...e,set:Pe(e.set,x(t).scale)})}async applyCalibHint(){const t=this.bundle,e=this.cands,s=e?.result.calibration_hint,i=t?.planVersionId;if(!t||!i||!e||!s||this.busy)return;const o=()=>this.bundle?.planVersionId!==i;this.busy=!0,this.error="";try{if(!await this.studio.flush()){o()||(this.error=this.studio.error);return}if(o())return;if(!this.canEstimate){this.error="לתוכנית כבר יש כיול מדוד; ההערכה לא הוחלה.";return}const n=await rn(i,s.scale_m_per_px,s.reason);if(o()||!this.bundle||(this.bundle={...this.bundle,scaleMPerPx:n.scale_m_per_px},!await this.loadStudio(this.bundle,!0)||o()))return;this.rescaleCandidates(),this.hintApplied=!0,this.flash(`קנה מידה משוער נשמר: ≈ ${Ie(n.scale_m_per_px)}`,4e3)}catch(n){if(o()||!this.bundle)return;n instanceof P&&n.code==="calibration_measured"?(this.error="לתוכנית כבר יש כיול מדוד (כנראה מחלון אחר); הערכה לא מחליפה אותו. המידות לפי הכיול הקיים.",await this.loadStudio(this.bundle,!0)&&!o()&&this.rescaleCandidates()):this.error=k(n)}finally{this.busy=!1}}async importDxfRooms(){const t=this.bundle,e=this.cands?.result.rooms??[];if(!(!t||!e.length||this.busy)){this.busy=!0;try{const s=await xe(t.floorId,e.map(i=>({polygon:i.polygon,name:i.name})),!1);this.zones=s.zones,this.cands=this.cands?{...this.cands,result:{...this.cands.result,rooms:[]}}:null,this.flash(`${I(e.length,"חדר אחד נוסף","חדרים נוספו")} כאזורים; תן להם שמות בכלי "חדרים ואזורים"`,4e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}renderDetectTool(t){const e=this.studio.doc;if(!e||!t.planVersionId)return h`<sw-card heading="זיהוי אוטומטי" data-detect-panel><div class="note">${t.source==="demo"?"נתוני הדגמה: הזיהוי עובד מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=this.cands;return bo({opts:this.detectOpts,run:this.detectRun,cands:o?{source:o.source,set:o.set,states:this.candStates,sel:this.candSel,hint:o.result.calibration_hint,existingAuto:this.replacedIn(e,this.setSources(o.set)),elapsedMs:o.result.elapsed_ms??null,rooms:o.result.rooms?.length??0,ifc:o.result.ifc??null}:null,acceptedCount:this.acceptedCandidateIds.length,objectsOn:this.candObjectsOn,hintApplied:this.hintApplied,canEstimate:this.canEstimate,busy:this.busy,narrow:this.narrow,estimated:i,showEstimates:this.showEstimates,scale:s,autoInDraft:e.walls.filter(n=>n.source==="auto").length+e.openings.filter(n=>n.source==="auto").length,ask:this.detectAsk,acceptError:this.detectErr},{setOpts:n=>{this.detectOpts=n,this.detectAsk=null},run:()=>void this.runDetect(),retryLighter:()=>{this.detectOpts={...this.detectOpts,strength:Wo(this.detectOpts.strength)},this.runDetect()},acceptAll:()=>{o&&this.acceptRule(mt(o.set))},acceptAbove:n=>{o&&this.acceptRule(bn(o.set,n))},acceptKinds:n=>{o&&this.acceptRule(wn(o.set,n))},rejectAll:()=>{this.acceptRule([]),this.busy||(this.candObjectsOn=!1)},toggle:n=>this.toggleCandidate(n),focus:n=>this.focusCandidate(n),setObjects:n=>{this.candObjectsOn=n,this.detectAsk=null},confirm:()=>this.confirmCandidates(),confirmReplace:()=>void this.sendAccept(),cancelReplace:()=>this.detectAsk=null,reload:()=>void this.reloadForDetect(),discard:()=>this.discardCandidates(),applyHint:()=>void this.applyCalibHint(),importRooms:()=>void this.importDxfRooms()})}exportJson(){const t=this.studio.doc;if(!t)return;const e=URL.createObjectURL(new Blob([JSON.stringify(t,null,2)],{type:"application/json"})),s=document.createElement("a");s.href=e,s.download=`plan-structure-${t.plan_version_id}.json`,s.click(),setTimeout(()=>URL.revokeObjectURL(e),1e3)}async importIfc(t){const e=this.bundle;if(!e?.planVersionId||this.busy)return;const s=e.planVersionId;this.busy=!0,this.error="",this.info=Tt("reading");try{if(!await this.studio.flush()){this.error=this.studio.error;return}const i=await an(s,t,{levelId:this.activeLevel??void 0});if(this.bundle?.planVersionId!==s)return;this.showCandidates(i,"ifc"),this.pickTool("detect");const o=i.walls.length+i.openings.length+(i.objects?.length??0)+(i.rooms?.length??0);this.flash(o?Tt("loaded"):Tt("nothing"),4e3)}catch(i){this.info="",this.error=k(i)}finally{this.busy=!1}}async exportPackage(t=!1){const e=this.bundle;if(!(!e?.planVersionId||this.busy)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const{blob:s,name:i}=await ln(e.planVersionId,!0,{dxf:t}),o=URL.createObjectURL(s),n=document.createElement("a");n.href=o,n.download=i,n.click(),setTimeout(()=>URL.revokeObjectURL(o),1e3),this.flash(_("saved"),3e3)}catch(s){this.error=k(s)}finally{this.busy=!1}}}async startPackageImport(t){if(this.bundle?.planVersionId){if(!await this.studio.flush()){this.error=this.studio.error;return}this.pkgImport={file:t,mode:"replace",preview:null,busy:null,error:"",acceptForeign:!1,foreign:null},await this.previewPackage("replace")}}async previewPackage(t){const e=this.pkgImport,s=this.bundle?.planVersionId;if(!(!e||!s||e.busy)){this.pkgImport={...e,mode:t,busy:"check",error:"",preview:e.mode===t?e.preview:null};try{const i=await dn(s,e.file,t,e.acceptForeign);this.pkgImport?.file===e.file&&(this.pkgImport={...this.pkgImport,preview:i,busy:null})}catch(i){const o=i instanceof P&&i.code==="package_foreign"?i.body.details?.origin??null:null;this.pkgImport?.file===e.file&&(this.pkgImport=o?{...this.pkgImport,preview:null,busy:null,error:"",foreign:o,acceptForeign:!1}:{...this.pkgImport,preview:null,busy:null,error:k(i)})}}}setPackageTrust(t){const e=this.pkgImport;e&&(this.pkgImport={...e,acceptForeign:t},t&&!e.preview&&e.foreign&&this.previewPackage(e.mode))}async confirmPackageImport(){const t=this.pkgImport,e=this.bundle;if(!(!t?.preview||!e?.planVersionId||t.busy)){this.pkgImport={...t,busy:"import",error:""};try{await hn(e.planVersionId,t.file,t.preview,t.acceptForeign),this.pkgImport=null,await this.loadStudio(e,!0)&&this.flash(_("imported"),4e3)}catch(s){this.pkgImport?.file===t.file&&(this.pkgImport={...this.pkgImport,busy:null,error:k(s)})}}}renderStructurePanel(t,e=!1){const s=this.studio.doc,i=t.planVersionId;return!s||!i?h`<sw-card heading="מבנה"><div class="note">${t.source==="demo"?"נתוני הדגמה: ציור המבנה עובד מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`:yo({doc:this.geomPreview??s,W:t.width,H:t.height,mode:e?"select":this.studioMode,wallDefaults:this.wallDefaults,glassDraw:this.glassDraw,sel:this.geomSel,saveState:this.studio.saveState,saveError:this.studio.error,compact:e,conflict:this.studio.hasConflict,issues:this.studio.issues,copyCandidates:this.studio.copyCandidates,exportSvg:ft(i,"svg",{draft:!0}),exportPng:ft(i,"png",{draft:!0}),exportDxf:ft(i,"dxf",{draft:!0}),exportIfc:ft(i,"ifc",{draft:!0}),busy:this.busy,showEstimates:this.showEstimates,levels:s.levels,phone:this.phone.matches,entityChoices:this.memo("entityChoices",[this.anchors],()=>this.anchors.filter(o=>o.resource_type==="ha_entity"&&/^(binary_sensor|cover|lock)\./.test(o.resource_id)).map(o=>({id:o.resource_id,name:o.label||o.entity?.name||o.resource_id})).sort((o,n)=>o.name<n.name?-1:o.name>n.name?1:0)),materials:this.resolvedMaterials(this.geomPreview??s),materialStyle:this.matStyle},{setMaterial:(o,n,r)=>this.edit(a=>N($e(a,o,n,r))),setMaterialStyle:o=>this.matStyle=o,setMode:o=>{if((Se.includes(o)||o==="curve")&&this.phone.matches){this.flash("ציור קירות זמין בדסקטופ בלבד; בטלפון אפשר להציב ולהזיז עצמים בודדים",4e3);return}this.studioMode=o,this.dropDoorGhost(),this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null,o!=="select"&&o!=="curve"&&(this.geomSel?.vertex!==void 0||this.geomSel?.segment!==void 0)&&(this.geomSel={id:this.geomSel.id,kind:this.geomSel.kind})},setWallDefaults:o=>{this.wallDefaults=o},setGlassDraw:o=>{o.curved!==this.glassDraw.curved&&(this.wallDraft=null,this.curveDraft=null,this.curveRedo=[],this.hover=null),this.glassDraw=o},addCurvePoint:o=>{const n=this.studio.doc,r=n?Fs(n,o,t.width,t.height):null;if(!r)return;this.edit(()=>r.doc);const a=this.studio.doc?.walls.find(d=>d.id===o),l=a?ge(a):null;this.geomSel={id:o,kind:"wall",...l?{vertex:l[r.k]}:{}}},removeCurvePoint:(o,n)=>{const r=this.studio.doc,a=r?ae(r,o,n,t.width,t.height):null;a&&(this.edit(()=>a.doc),this.geomSel=a.wallRemoved?null:{id:o,kind:"wall"})},patchWall:(o,n)=>this.edit(r=>it(r,o,n)),patchOpening:(o,n)=>this.edit(r=>bt(r,o,n)),patchLabel:(o,n)=>this.edit(r=>st(r,o,n)),remove:o=>{this.edit(n=>U(n,o)),this.geomSel=null},focus:o=>this.focusGeom(o),copyFrom:o=>void this.copyStructure(o),exportJson:()=>this.exportJson(),exportPackage:o=>void this.exportPackage(o===!0),importPackage:o=>void this.startPackageImport(o),importIfc:o=>void this.importIfc(o),reload:()=>void this.loadStudio(t,!0),calibrate:()=>this.pickTool("calibrate"),retry:async()=>{await this.studio.flush()&&this.loadStudio(t)},setLevel:(o,n)=>{this.edit(r=>r.walls.some(a=>a.id===o)?it(r,o,{level_id:n}):st(r,o,{level_id:n})),this.followLevel(o,n)},setSegmentRadius:(o,n,r)=>{const a=x(s).scale;if(r===null)return this.edit(c=>js(c,o,n,t.width,t.height));const l=this.studio.doc,d=l?Ns(l,o,n,r,a,t.width,t.height):null;d?this.edit(()=>d):this.flashError(A("radiusTooSmall"))},roundCorner:(o,n,r)=>{const a=this.studio.doc,l=a?Es(a,o,n,r,x(a).scale,t.width,t.height):null;if(!l)return this.flashError(A("cornerCannot"));this.edit(()=>l),this.geomSel={id:o,kind:"wall"}},say:o=>{this.flash(o,4e3)}})}renderLibraryTool(t,e=!1){const s=this.studio.doc,i=this.library;if(!s||!i||!t.planVersionId)return h`<sw-card heading="ספריית עצמים"><div class="note">${t.source==="demo"?"נתוני הדגמה: הספרייה נטענת מהשרת.":this.error||"טוען את הספרייה…"}</div></sw-card>`;const{estimated:o}=x(s),n=t.permissions.structure,r=this.geomSel?.kind==="object"?s.objects.find(d=>d.id===this.geomSel.id):void 0,a=d=>{const c=d.anchor_ref&&this.anchors.find(u=>u.resource_type===d.anchor_ref.resource_type&&u.resource_id===d.anchor_ref.resource_id);return c?this.anchorName(c):null},l=this.geomSel?.kind==="group"?s.groups.find(d=>d.id===this.geomSel.id):void 0;return h`${l?ko(l,j(i,String(l.params.item_id??"")),{select:d=>this.geomSel={id:d,kind:"object"},askDelete:d=>this.groupDelete=d}):p}${r?$o({o:r,item:j(i,r.item_id),levels:s.levels,doc:s,estimated:o,showEstimates:this.showEstimates,anchorName:a(r),phone:this.phone.matches,canManage:n,lib_category:d=>i.categories.find(c=>c.id===d.category)?.he??d.category,materialDefault:this.resolvedMaterials(s).objects[r.id]??"plastic",materialStyle:this.matStyle},{setMaterial:(d,c)=>this.edit(u=>N($e(u,"objects",d,c))),setMaterialStyle:d=>this.matStyle=d,patch:(d,c)=>{this.edit(u=>Q(u,d,c)),c.level_id!==void 0&&this.followLevel(d,c.level_id)},unbind:d=>this.edit(c=>Q(c,d,{anchor_ref:null})),remove:d=>{this.edit(c=>U(c,d)),this.geomSel=null},array:d=>this.openArray(d),custom:d=>this.openCustom(d),duplicate:d=>this.duplicateSel(d),selectGroup:d=>this.geomSel={id:d,kind:"group"}}):p}
    ${e?h`<div class="note" data-studio-save=${this.studio.saveState}>${xo[this.studio.saveState]}</div>`:_o({lib:i,q:this.libQ,category:this.libCategory,recent:this.libRecent,favorites:this.libFav,placing:this.placingItem,saveState:this.studio.saveState,phone:this.phone.matches,exportHref:_n(),canManage:n},{setQuery:d=>this.libQ=d,setCategory:d=>this.libCategory=d,pick:d=>{this.placingItem=this.placingItem?.id===d.id?null:d,this.geomSel=null,this.bindOffer=null},toggleFavorite:d=>{this.libFav=this.libFav.includes(d)?this.libFav.filter(c=>c!==d):[...this.libFav,d],Ze("sw.studio.fav",this.libFav)},importFile:d=>void this.importLibrary(d),cancelPlacing:()=>this.placingItem=null})}`}get rulers(){const t=this.bundle,e=this.studio.doc;if(!t||!e)return T;const s=[t,e,this.tool,this.hover,this.connStart,this.connMode,this.walkArmed,this.walkFocus,this.activeLevel,this.calib,this.measurePts,this.showEstimates];return this.memo("rulers",s,()=>this.buildRulers(t,e))}buildRulers(t,e){const{scale:s,estimated:i}=x(e),o=(n,r)=>gt(pe(n,r,t.width,t.height,s),i,this.showEstimates);if(this.tool==="connectors"&&this.connStart&&this.hover)return[{a:this.connStart,b:this.hover,label:this.connMode?So[this.connMode]:"",tone:"muted"}];if(this.tool==="walk"){const n=this.activeLevel,r=(e.walk_positions??[]).filter(a=>!n||a.level_id===n).map(a=>({...ze(a,t.width,t.height),label:a.name,tone:this.walkFocus===a.id?"accent":"muted"}));return this.walkArmed&&this.hover&&r.push({...ze({x:this.hover[0],y:this.hover[1],heading_deg:0},t.width,t.height),label:"",tone:"accent"}),r}if(this.tool==="calibrate"){const{a:n,b:r,metres:a}=this.calib,l=r??this.hover;return!n||!l?[]:[{a:n,b:l,label:r?parseFloat(a)>0?`${a} מ׳`:"? מ׳":"",tone:r?"accent":"muted"}]}if(this.tool==="measure"){const n=this.measurePts,r=this.hover&&n.length?[...n,this.hover]:n,a=[];for(let l=1;l<r.length;l++)a.push({a:r[l-1],b:r[l],label:o(r[l-1],r[l]),tone:l>n.length-1?"muted":"accent"});return n.length>=3&&a.push({a:n[n.length-1],b:n[0],label:"",tone:"muted"}),a}return[]}addCalibPair(){const{a:t,b:e,metres:s,pairs:i}=this.calib,o=parseFloat(s);!t||!e||!(o>0)||i.length>=3||(this.calib={...this.calib,a:null,b:null,metres:"",pairs:[...i,{a:t,b:e,metres:o}]})}async saveCalibration(){const t=this.bundle,{a:e,b:s,metres:i,pairs:o}=this.calib,n=parseFloat(i),r=[...o,...e&&s&&n>0?[{a:e,b:s,metres:n}]:[]];if(!(!t?.planVersionId||!r.length)){this.busy=!0,this.error="";try{if(!await this.studio.flush()){this.error=this.studio.error;return}const a=await cn(t.planVersionId,r);await this.loadStudio(t,!0);const l=r.length>1&&a.residual_pct!==null?` · ${r.length} זוגות, סטייה ${a.residual_pct.toFixed(1)}%`:"";this.calib={...B,result:`קנה המידה נשמר: ${Ie(a.scale_m_per_px)}${l}`,warning:a.warning??""}}catch(a){this.error=k(a)}finally{this.busy=!1}}}async loadSideData(t){t.planVersionId&&t.permissions.structure?un(t.planVersionId).then(e=>{this.bundle===t&&(this.geomVersions=e.versions)},()=>{this.geomVersions=[]}):this.geomVersions=[],ws(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.areas=e.areas)},()=>{this.areas=[]}),Jn(t.floorId).then(e=>{this.bundle?.floorId===t.floorId&&(this.floorImages=e,this.alignDraft=null)},()=>{this.floorImages=null})}async rollbackStructure(t){const e=this.bundle;if(!(!e?.planVersionId||!t.id)&&window.confirm(`לשחזר את המבנה שפורסם ב-${K(t.published_at)}? המבנה הנוכחי נשמר בהיסטוריה.`)){this.busy=!0,this.error="";try{await pn(e.planVersionId,t.id),this.flash("המבנה שוחזר ופורסם; הצופים רואים אותו עכשיו",4e3),await this.loadStudio(e,!0),await this.loadVersions()}catch(s){this.error=k(s)}finally{this.busy=!1}}}renderStructureHistory(t){if(!t.permissions.structure||!this.geomVersions.length)return p;const e=s=>[s.walls?`${s.walls} קירות`:"",s.openings?`${s.openings} פתחים`:"",s.objects?`${s.objects} עצמים`:"",s.connectors?`${s.connectors} מחברים`:""].filter(Boolean).join(" · ")||"מבנה ריק";return h`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית המבנה<span class="muted">כל פרסום של קירות, פתחים ועצמים נשמר; שחזור מפרסם מחדש גרסה מהארכיון כגרסה חדשה</span></span></div>
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
      </div>`}async uploadImage(t,e){const s=this.bundle,i=e.files?.[0];if(e.value="",!(!s||!i)){this.imageBusy=!0,this.imageNote="";try{await Yn(s.floorId,t,i),this.imageNote=t==="off"?"תמונת הקומה נשמרה":"תמונת התאורה נשמרה",await this.loadSideData(s),await this.load()}catch(o){this.imageNote=k(o)}finally{this.imageBusy=!1}}}async removeImage(t){const e=this.bundle;if(!(!e||!window.confirm(t==="off"?"להסיר את תמונת הקומה?":"להסיר את תמונת התאורה?"))){this.imageBusy=!0;try{await Xn(e.floorId,t),this.imageNote="התמונה הוסרה",await this.loadSideData(e),await this.load()}catch(s){this.imageNote=k(s)}finally{this.imageBusy=!1}}}async saveAlignment(){const t=this.bundle,e=this.alignDraft;if(!(!t||!e)){this.imageBusy=!0;try{const s=await Qn(t.floorId,e.corners,e.opacity);this.floorImages=this.floorImages?{...this.floorImages,layout:s}:this.floorImages,this.alignDraft=null,this.imageNote="היישור נשמר",await this.load()}catch(s){this.imageNote=k(s)}finally{this.imageBusy=!1}}}alignWalls(t){const e=this.studio.doc;return this.memo("alignWalls",[e,t.width,t.height],()=>e?.walls.map(s=>Fi(s,t.width,t.height)).flatMap(s=>s.slice(1).map((i,o)=>[[s[o][0],s[o][1]],[i[0],i[1]]]))??[])}renderFloorImages(t){if(t.source==="demo"||!t.permissions.edit||this.phone.matches)return p;const e=this.floorImages,s=e?.images.off??null,i=e?.images.on??null,o=e?.layout,n=this.alignDraft??(o?{corners:o.corners,opacity:o.opacity}:null),r=!!this.alignDraft,a=(l,d,c,u)=>h`<div class="row" data-floor-image-row=${l}>
      <span class="lbl">${c}<span class="muted">${d?`${d.width}×${d.height} · ${Math.round(d.bytes/1024)} KB`:u}</span></span>
      <span class="btns" style="margin:0">
        <label class="upl"><input type="file" accept="image/png,image/jpeg" data-floor-image-input=${l} ?disabled=${this.imageBusy} @change=${v=>void this.uploadImage(l,v.target)} /><sw-button size="sm" icon="upload" ?disabled=${this.imageBusy} @click=${v=>v.currentTarget.closest("label")?.querySelector("input")?.click()}>${d?"החלף":"העלה"}</sw-button></label>
        ${d?h`<sw-button size="sm" variant="ghost" icon="trash" data-floor-image-delete=${l} ?disabled=${this.imageBusy} @click=${()=>void this.removeImage(l)}>הסר</sw-button>`:p}
      </span>
    </div>`;return h`<sw-card heading="תמונת הקומה" subheading="תמונה של הקומה מכל מקור (הדמיה, תוכנית צבעונית, צילום מודל); ממוקמת פעם אחת ומוצגת במפה מתחת למצבי החדרים" data-floor-images>
      ${a("off",s,"תמונה בסיסית","PNG או JPEG עד 12 MB; מוצגת תמיד")}
      ${a("on",i,"תמונה עם תאורה","אופציונלי: אותה תמונה עם אורות; מוצגת רק בחדרים שהתאורה בהם דלוקה")}
      ${s||i?h`<div class="row" style="margin-block-start:8px"><span class="lbl">יישור על התוכנית<span class="muted">גרור את הפינות אל פינות הקומה בתוכנית (או את התמונה כולה); מקשי החצים מכוונים פינה מסומנת</span></span>
            <label class="chk"><input type="checkbox" .checked=${this.alignShowPlan} @change=${l=>this.alignShowPlan=l.target.checked} /> הצג את תוכנית הרקע</label></div>
          <sw-floor-image-align data-floor-image-align .planWidth=${t.width} .planHeight=${t.height} .planUrl=${t.imageUrl} .showPlan=${this.alignShowPlan} .imageUrl=${tr(s??i)}
            .corners=${n?.corners??[[0,0],[1,0],[1,1],[0,1]]} .opacity=${n?.opacity??1} .rooms=${this.zones.map(l=>({id:l.id,polygon:l.polygon}))} .walls=${this.alignWalls(t)} ?disabled=${this.imageBusy}
            @corners-change=${l=>this.alignDraft={corners:l.detail.corners,opacity:n?.opacity??1}}></sw-floor-image-align>
          <div class="two">
            <sw-field label="שקיפות התמונה במפה"><input type="range" min="0.2" max="1" step="0.05" data-ltr data-floor-image-opacity .value=${String(n?.opacity??1)} @input=${l=>this.alignDraft={corners:n?.corners??[[0,0],[1,0],[1,1],[0,1]],opacity:parseFloat(l.target.value)}} /></sw-field>
            <div class="btns" style="align-items:flex-end">
              <sw-button variant="primary" size="sm" icon="check" data-floor-image-save ?disabled=${!r||this.imageBusy} @click=${()=>void this.saveAlignment()}>שמור יישור</sw-button>
              <sw-button variant="ghost" size="sm" data-floor-image-reset ?disabled=${this.imageBusy||!r&&Ls(o?.corners)} @click=${()=>this.alignDraft={corners:[[0,0],[1,0],[1,1],[0,1]],opacity:1}}>אפס</sw-button>
            </div>
          </div>`:p}
      ${this.imageNote?h`<div class="note" data-floor-image-note role="status">${this.imageNote}</div>`:p}
      <div class="note">התמונה נשמרת במתקן בלבד ונכללת בגיבוי; שום דבר לא נשלח החוצה. תמונה בפרספקטיבה (צילום) מיושרת בקירוב - עדיף רינדור ישר מלמעלה או איזומטרי.</div>
    </sw-card>`}renderCalibrate(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="כיול קנה מידה"><div class="note">${t.source==="demo"?"נתוני הדגמה: הכיול עובד מול השרת.":"טוען…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=this.calib,n=o.a&&o.b?Math.hypot((o.b[0]-o.a[0])*t.width,(o.b[1]-o.a[1])*t.height):null,r=a=>Math.hypot((a.b[0]-a.a[0])*t.width,(a.b[1]-a.a[1])*t.height);return h`${Do({a:o.a,b:o.b,metres:o.metres,pixels:n,scale:s,estimated:i,showEstimates:this.showEstimates,result:o.result,warning:o.warning,busy:this.busy,pairs:o.pairs.map(a=>({metres:a.metres,pixels:r(a)}))},a=>{this.calib={...this.calib,metres:a}},()=>void this.saveCalibration(),()=>{this.calib={...B}},()=>this.addCalibPair(),a=>{this.calib={...this.calib,pairs:this.calib.pairs.filter((l,d)=>d!==a)}})}${Io({northDeg:e.north_deg??null,site:this.site,nowMs:Date.now(),disabled:!t.permissions.structure},{set:a=>this.edit(l=>N(Ui(l,a)))})}`}resolvedMaterials(t){const e=this.library;if(this.matMemo&&this.matMemo.doc===t&&this.matMemo.lib===e)return this.matMemo.out;const s=Dn(t,e?Sn(e):void 0);return this.matMemo={doc:t,lib:e,out:s},s}renderRoomMaterial(t){const e=this.studio.doc,s=this.bundle;if(!e||!s?.permissions.structure||s.source!=="api")return p;const i=e.rooms.find(a=>a.id===t.id),o=this.resolvedMaterials(e),n=t.level_id??C(e),r=o.rooms[t.id]?.floor??o.levels[n]?.floor??"concrete";return zo({key:`rooms:${t.id}`,label:"חומר הרצפה",host:"floor",value:i?.floor_material_id??null,defaultId:r,style:this.matStyle},{pick:a=>this.edit(l=>N(Wi(l.rooms.some(d=>d.id===t.id)?l:{...l,rooms:[...l.rooms,{id:t.id,level_id:t.level_id??null}]},"rooms",t.id,"floor_material_id",a))),setStyle:a=>this.matStyle=a})}placeWalkPosition(t,e){const s=this.walkArmed;if(!s)return;const i=t.walk_positions??[],o=s==="new"?null:i.find(r=>r.id===s),n=o?{...o,x:H(e[0]),y:H(e[1])}:{id:ve(),name:Mo(i),x:H(e[0]),y:H(e[1]),level_id:this.activeLevel??C(t),heading_deg:0};this.edit(r=>N(ye(r,n))),this.walkArmed=null,this.walkFocus=n.id,this.hover=null}renderWalkTool(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="עמדות סיור"><div class="note">${t.source==="demo"?"נתוני הדגמה: העמדות נשמרות מול השרת.":this.error||"טוען את טיוטת המבנה…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e),o=(n,r)=>this.edit(a=>{const l=(a.walk_positions??[]).find(d=>d.id===n);return l?N(ye(a,r(l))):a});return Po({positions:e.walk_positions??[],levels:e.levels,W:t.width,H:t.height,scale:s,estimated:i&&this.showEstimates,armed:this.walkArmed,focused:this.walkFocus,disabled:!t.permissions.structure},{arm:n=>{this.walkArmed=n,this.hover=null},rename:(n,r)=>{r.trim()&&o(n,a=>({...a,name:r}))},setLevel:(n,r)=>o(n,a=>({...a,level_id:r})),setHeading:(n,r)=>o(n,a=>({...a,heading_deg:r})),setDefault:n=>o(n,r=>({...r,is_default:!r.is_default})),move:(n,r)=>this.edit(a=>N(Ki(a,n,r))),remove:n=>{this.edit(r=>N(Hi(r,n))),this.walkFocus===n&&(this.walkFocus=null),this.walkArmed===n&&(this.walkArmed=null)},goTo:n=>{const r=(this.studio.doc?.walk_positions??[]).find(a=>a.id===n);r&&(this.activeLevel!==null&&this.activeLevel!==r.level_id&&(this.levelFilter=r.level_id),this.walkFocus=n,this.canvas?.centerOn(r.x,r.y))}})}renderMeasure(t){const e=this.studio.doc;if(!e)return h`<sw-card heading="מדידה"><div class="note">${t.source==="demo"?"נתוני הדגמה: המדידה עובדת מול השרת.":"טוען…"}</div></sw-card>`;const{scale:s,estimated:i}=x(e);return Co(this.measurePts,t.width,t.height,s,i,this.showEstimates,()=>{this.measurePts=[]})}renderCoverage(t){const e=t.coverage_polygon,s=t.coverage_radius??0,i=Math.round((s||.1)*100),o=()=>{const n=t.field_of_view_degrees??90,r=s||.1,a=this.bundle&&this.bundle.height?this.bundle.width/this.bundle.height:1,l=[[t.position.x,t.position.y]],d=Math.max(3,Math.round(n/15));for(let c=0;c<=d;c++){const u=(t.rotation_degrees-n/2+n*c/d-90)*Math.PI/180;l.push([+Math.max(0,Math.min(1,t.position.x+Math.cos(u)*r)).toFixed(4),+Math.max(0,Math.min(1,t.position.y+Math.sin(u)*r*a)).toFixed(4)])}this.apply(t.id,{coverage_polygon:l})};return h`<div class="row" data-coverage style="flex-direction:column;align-items:stretch;gap:6px">
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
    </div>`}renderMount(t,e){const s=In[zn(t)],i=(o,n,r)=>{if(o.trim()==="")return null;const a=Number(o);return Number.isFinite(a)?Math.min(r,Math.max(n,a)):null};return h`<div class="two" data-anchor-3d>
      <sw-field label="גובה התקנה (מ׳)" hint=${`ברירת מחדל ${s.mount_height_m} מ׳ · לתצוגת התלת-ממד`}><input type="number" step="0.1" min="0" max="30" data-ltr data-anchor-mount placeholder=${String(s.mount_height_m)} .value=${ne(t.mount_height_m==null?"":String(t.mount_height_m))} @change=${o=>this.apply(t.id,{mount_height_m:i(o.target.value,0,30)})} /></sw-field>
      ${e?h`<sw-field label="הטיה (°)" hint=${`ברירת מחדל ${s.tilt_deg}° · חיובי = מטה`}><input type="number" step="any" min="-90" max="90" data-ltr data-anchor-tilt placeholder=${String(s.tilt_deg)} .value=${ne(t.tilt_deg==null?"":String(t.tilt_deg))} @change=${o=>this.apply(t.id,{tilt_deg:i(o.target.value,-90,90)})} /></sw-field>`:p}
    </div>`}renderCameraInspector(t){const e=t.camera,s=t.field_of_view_degrees??0;return h`<sw-card heading="הגדרות מצלמה" subheading="גרירה במפה, ידיות לכיוון ולשדה הראייה, או הזנה מדויקת">
      <div class="kv"><span class="k">מצלמה</span><strong>${this.anchorName(t)}</strong></div>
      <div class="kv"><span class="k">מקור</span><span class=${e&&_t(e)?"":"ltr"}>${e?bs(e):t.resource_id}</span></div>
      <sw-field label="כיוון מבט (°)" style="margin-block-start:10px"><input type="number" step="1" min="0" max="359" data-ltr .value=${String(Math.round(t.rotation_degrees))} @change=${i=>this.apply(t.id,{rotation_degrees:(Number(i.target.value)%360+360)%360})} /></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(i.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${i=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(i.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-anchor-level @change=${i=>this.apply(t.id,{level_id:i.target.value||null})}>${this.studio.doc.levels.map(i=>h`<option value=${i.id} ?selected=${(t.level_id??C(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:p}
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
      ${e?h`<div class="kv"><span class="k">מצב עכשיו</span><span>${ie(e)}</span></div><div class="kv"><span class="k">סוג</span><span>${oe(e.domain)}</span></div>`:p}
      <sw-field label="שכבה" style="margin-block-start:8px"><select @change=${s=>this.apply(t.id,{layer_id:s.target.value})}>${Ge.filter(s=>s.id!=="cameras").map(s=>h`<option value=${s.id} ?selected=${t.layer_id===s.id}>${s.label}</option>`)}</select></sw-field>
      <div class="two">
        <sw-field label="מיקום X (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.x*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:Math.min(1,Math.max(0,Number(s.target.value)/100)),y:t.position.y}})} /></sw-field>
        <sw-field label="מיקום Y (%)"><input type="number" step="0.1" min="0" max="100" data-ltr .value=${(t.position.y*100).toFixed(1)} @change=${s=>this.apply(t.id,{position:{x:t.position.x,y:Math.min(1,Math.max(0,Number(s.target.value)/100))}})} /></sw-field>
      </div>
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-anchor-level @change=${s=>this.apply(t.id,{level_id:s.target.value||null})}>${this.studio.doc.levels.map(s=>h`<option value=${s.id} ?selected=${(t.level_id??C(this.studio.doc))===s.id}>${s.name}</option>`)}</select></sw-field>`:p}
      <sw-field label="שם במפה (ידני)"><input data-entity-name placeholder=${e?.name??t.resource_id} .value=${t.label??""} @change=${s=>this.apply(t.id,{label:s.target.value.trim()||null})} /></sw-field>
      <sw-field label="מיקום התווית"><select data-label-pos @change=${s=>this.apply(t.id,{label_pos:s.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([s,i])=>h`<option value=${s} ?selected=${(t.label_pos??"auto")===s}>${i}</option>`)}</select></sw-field>
      ${this.renderMount(t,!1)}
      <div class="note">ריק = השם המקורי${e?.name?` („${e.name}“)`:""}. השם הידני מוצג במפה, ברשימת הצד ובכרטיס.</div>
      <div class="note" style="margin-block-start:6px">revision ${t.revision}${this.dirty.has(t.id)?" · שינויים לא שמורים":""}</div>
      <div style="display:flex;gap:8px;margin-block-start:10px;flex-wrap:wrap">
        <sw-button variant="primary" size="sm" icon="check" ?disabled=${!this.dirty.size||this.busy} @click=${()=>this.save()}>שמירת מיקום</sw-button>
        <sw-button size="sm" variant="danger" icon="trash" ?disabled=${this.busy} @click=${()=>this.removeSelected()}>הסר מהמפה</sw-button>
      </div>
    </sw-card>`}renderToolPanel(t){const e=new Set(this.anchors.map(s=>s.resource_id));if(this.tool==="structure")return this.renderStructurePanel(t);if(this.tool==="library")return this.renderLibraryTool(t);if(this.tool==="connectors")return this.renderConnectorTool(t);if(this.tool==="circuits")return this.renderCircuitTool(t);if(this.tool==="calibrate")return this.renderCalibrate(t);if(this.tool==="walk")return this.renderWalkTool(t);if(this.tool==="measure")return this.renderMeasure(t);if(this.tool==="detect")return this.renderDetectTool(t);if(this.tool==="camera"){const s=ys(t.cameras,ut("nvr")).filter(i=>!e.has(i.id));return h`<sw-card heading="הוספת מצלמה" subheading="בחר מצלמה ואז לחץ על התוכנית במקום המבוקש">
        ${s.length?h`<div class="list">${s.map(i=>h`<button class=${this.placing?.kind==="camera"&&this.placing.camera.id===i.id?"on":""} @click=${()=>this.placing={kind:"camera",camera:i}}><span>${i.name}</span><span class=${_t(i)?"":"ltr"}>${ks(i)}</span></button>`)}</div>`:h`<div class="note">${t.cameras.length?"כל המצלמות הרשומות כבר מוצבות על הקומה.":"אין מצלמות רשומות עדיין; הגילוי מה־NVR רץ אוטומטית."}</div><div style="margin-block-start:8px"><sw-button size="sm" @click=${()=>Y("/system/devices")}>למצלמות</sw-button></div>`}
      </sw-card>`}if(this.tool==="entity"||this.tool==="lights"){const s=this.tool==="lights",i=(this.entResults??[]).filter(o=>!e.has(o.entity_id));return h`<sw-card heading=${s?"הוספת תאורה":"הוספת התקן אחר"} subheading=${s?"מפסקים (switch) מהקטלוג; לחץ על התוכנית להצבה. השם ניתן לשינוי אחרי ההצבה.":"כל ישות אחרת בקטלוג (דלתות, חיישנים, מזגנים…) ואז לחיצה על התוכנית"} data-tool-panel=${this.tool}>
        <sw-field><input type="search" placeholder=${s?"חיפוש מפסק לפי שם או אזור":"חיפוש לפי שם, entity_id או אזור"} data-ltr .value=${this.entQ} @input=${o=>this.onEntQuery(o.target.value)} /></sw-field>
        ${s?h`<label class="note" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-lights-all .checked=${this.lightsAll} @change=${o=>{this.lightsAll=o.target.checked,this.searchEntities()}} /> להציג גם ישויות light (נורות חכמות)</label>`:p}
        ${t.source==="demo"?h`<div class="note">נתוני הדגמה: החיפוש עובד מול השרת.</div>`:this.entBusy&&!this.entResults?h`<div class="note">מחפש…</div>`:i.length?h`<div class="list">${i.map(o=>h`<button class=${this.placing?.kind==="entity"&&this.placing.entity.entity_id===o.entity_id?"on":""} @click=${()=>this.placing={kind:"entity",entity:o}}><span>${o.name||o.original_name||o.entity_id}<div class="note" style="margin:0">${oe(o.domain)}${o.area_name?` · ${o.area_name}`:""} · ${ie(o)}</div></span><span class="ltr">${o.entity_id}</span></button>`)}</div>`:h`<div class="note">${this.entResults?"לא נמצאו ישויות (או שכולן כבר מוצבות).":""}</div>`}
      </sw-card>`}return this.tool==="layers"?h`<sw-card heading="שכבות" subheading="מה מוצג בעורך (לא משפיע על הצופים)">
        <div class="layerlist">${Ge.filter(s=>s.id!=="cameras"||ut("cameras_available")).map(s=>h`<label><input type="checkbox" .checked=${this.layers.has(s.id)} @change=${i=>{const o=new Set(this.layers);i.target.checked?o.add(s.id):o.delete(s.id),this.layers=o}} /> ${s.label} <span class="note">(${this.anchors.filter(i=>this.layerOf(i)===s.id).length})</span></label>`)}
          <label><input type="checkbox" .checked=${this.showZones} @change=${s=>this.showZones=s.target.checked} /> חדרים ואזורים <span class="note">(${this.zones.length})</span></label>
          ${t.imageUrl?h`<label><input type="checkbox" data-plan-background .checked=${this.planImage} @change=${s=>this.setPlanImage(t.floorId,s.target.checked)} /> תמונת התוכנית <span class="note">(${this.planImage?"מתחת לשרטוט":"מוסתרת, רקע נקי"})</span></label>`:p}</div>
        ${this.studio.doc?Oo({...this.grid,steps:He,estimated:x(this.studio.doc).estimated,showEstimates:this.showEstimates},s=>this.setGrid(t.floorId,{on:s}),s=>this.setGrid(t.floorId,{stepM:s})):p}
      </sw-card>`:this.tool==="zones"?this.renderZonesPanel(t):this.tool==="select"&&this.multiShown.length&&this.studio.doc?this.renderMultiPanel():this.tool==="select"&&this.geomSel&&this.studio.doc?h`${this.renderSelectionPanel(t)}${this.multiOn?h`<div class="note" data-multi-hint>${At}</div>`:p}`:h`<sw-card heading="מאפיינים"><div class="note" data-select-hint>${t.permissions.structure&&this.studio.doc?"לחץ על סיכה, קיר, פתח, תווית, עצם או אזור במפה כדי לבחור ולערוך אותם, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה: סיכה, פתח, תווית ועצם מיד, קיר ואזור אחרי שנבחרו. הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור.":"בחר סיכה במפה כדי לערוך אותה, או הוסף מצלמה / ישות מסרגל הכלים. גרירה מזיזה; הידיות על המצלמה הנבחרת קובעות כיוון ושדה ראייה. הצבה יוצרת Binding בלבד ואינה משנה תצורת מקור."}</div>${this.multiOn?h`<div class="note" data-multi-hint>${At}</div>`:p}</sw-card>`}renderSelectionPanel(t){const e=this.geomSel,s=this.studio.doc;if(!e||!s)return p;if(e.kind==="object"||e.kind==="group")return this.renderLibraryTool(t,!0);if(e.kind==="connector"){const i=s.connectors.find(o=>o.id===e.id);return i?To({...this.connectorView(s),sel:i},{...this.connectorActions(),setMode:()=>{}}):p}return this.renderStructurePanel(t,!0)}loadZoneCamera(t){this.zoneCameraFor=t,this.zoneCamera=null,this.camSuggestions=null,!(!t||this.bundle?.source==="demo")&&ao(t).then(e=>{this.zoneCameraFor===t&&(this.zoneCamera=e)},()=>{})}askCameraSuggestions(t){const e=this.bundle;if(!e)return;const s=this.anchors.filter(o=>o.resource_type==="camera").map(o=>({id:o.id,floorId:o.floor_id,levelId:o.level_id??null,position:o.position,rotationDeg:o.rotation_degrees,fovDeg:o.field_of_view_degrees})),i={id:t.id,floorId:t.floor_id,levelId:t.level_id??null,polygon:t.polygon};this.camSuggestions={zoneId:t.id,items:hr(i,s,this.camSuggestCfg,{aspect:e.height?e.width/e.height:1,exclude:this.zoneCamera?.anchor_id?[this.zoneCamera.anchor_id]:[]})}}async setZoneCamera(t,e){this.zoneBusy=!0,this.error="";try{const s=e?await lo(t.id,e):await ho(t.id);this.zoneCameraFor===t.id&&(this.zoneCamera=s),this.camSuggestions=null}catch(s){this.error=k(s)}finally{this.zoneBusy=!1}}renderCameraSuggest(t){const e=this.bundle;if(!e||e.source==="demo"||t.shared?.role==="mirror")return p;const s=this.zoneCamera?.anchor_id?this.anchors.find(r=>r.id===this.zoneCamera.anchor_id):void 0,i=this.camSuggestions?.zoneId===t.id?this.camSuggestions.items:null,o=this.anchors.some(r=>r.resource_type==="camera"),n=r=>r===0?"בתוך האזור":`במרחק ${Math.max(1,Math.round(r*100))}%`;return h`<div class="cam-suggest" data-cam-suggest>
      ${s?h`<div class="kv" data-zone-camera><span class="k">מצלמת האזור</span><span>${D(this.anchorName(s))}</span></div>`:p}
      ${e.permissions.edit&&o?h`<div class="btns"><sw-button size="sm" icon="camera" data-cam-suggest-ask ?disabled=${this.zoneBusy} @click=${()=>this.askCameraSuggestions(t)}>הצע מצלמה קרובה</sw-button>${s?h`<sw-button size="sm" variant="ghost" data-cam-suggest-clear ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,null)}>הסר קישור</sw-button>`:p}</div>`:p}
      ${i?i.length?h`<div class="cam-sug-list" data-cam-suggest-list>${i.map(r=>{const a=this.anchors.find(l=>l.id===r.id);return h`<div class="cam-sug" data-cam-suggestion=${r.id}>
                <span class="cam-sug-name">${a?D(this.anchorName(a)):r.id}<span class="note" style="margin:0">${n(r.distance)}${r.facing===null?" · ללא שדה ראייה":r.facing>=.5?" · פונה לאזור":" · לא פונה לאזור"}</span></span>
                <sw-button size="sm" variant="primary" icon="check" data-cam-suggest-accept ?disabled=${this.zoneBusy} @click=${()=>this.setZoneCamera(t,r.id)}>קבל</sw-button>
              </div>`})}</div>`:h`<div class="note" data-cam-suggest-none>אין מצלמה בקרבת האזור בטווח שהוגדר בהגדרות &gt; מפה</div>`:p}
    </div>`}renderZoneInspector(t){const e=this.anchors.filter(i=>i.resource_type==="camera"&&Bt(i.position,t.polygon)),s=this.anchors.filter(i=>i.resource_type!=="camera"&&Bt(i.position,t.polygon));return h`<div class="zone-insp" data-zone-inspector>
      <sw-field label="שם"><input .value=${t.name} placeholder="למשל: לובי, מחסן, חדר ישיבות" @change=${i=>this.patchZone(t,{name:i.target.value})} /></sw-field>
      <div class="two">
        <sw-field label="סוג"><select @change=${i=>this.patchZone(t,{kind:i.target.value})}>${_e.map(i=>h`<option value=${i.id} ?selected=${t.kind===i.id}>${i.label}</option>`)}</select></sw-field>
        <sw-field label="צבע"><input type="color" data-ltr .value=${t.color} @change=${i=>this.patchZone(t,{color:i.target.value})} /></sw-field>
      </div>
      <sw-field label="מיקום שם החדר"><select data-zone-label-pos @change=${i=>this.patchZone(t,{label_pos:i.target.value})}>${[["auto","אוטומטי"],["top","מעל"],["bottom","מתחת"],["left","משמאל"],["right","מימין"]].map(([i,o])=>h`<option value=${i} ?selected=${(t.label_pos??"auto")===i}>${o}</option>`)}</select></sw-field>
      ${this.renderRoomMaterial(t)}
      ${(this.studio.doc?.levels.length??0)>1?h`<sw-field label="מפלס"><select data-zone-level @change=${i=>this.patchZone(t,{level_id:i.target.value})}>${this.studio.doc.levels.map(i=>h`<option value=${i.id} ?selected=${(t.level_id??C(this.studio.doc))===i.id}>${i.name}</option>`)}</select></sw-field>`:p}
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
    </div>`}renderZoneTags(t){const e=s=>{s!==t.tags&&!(t.tags===void 0&&!s.length)&&this.patchZone(t,{tags:s})};return Ao({chips:(t.tags??[]).map(s=>({tag:s})),full:(t.tags?.length??0)>=zt,disabled:this.zoneBusy||this.bundle?.source==="demo"},s=>e(ke(t.tags,s)),s=>e(Pt(t.tags,s)))}renderZonesPanel(t){const e=this.candidates,s=this.selectedZone;return h`<sw-card heading="חדרים ואזורים" subheading="זיהוי מהתוכנית או ציור ידני; השמות מופיעים במפה">
      ${e?h`<div class="note">${e.length} חדרים זוהו · סמן, תן שם ושמור. הפוליגונים מוצגים במפה בקו מקווקו.</div>
            <div class="candlist">${e.map((i,o)=>h`<div class="cand" data-candidate><input type="checkbox" .checked=${i.include} aria-label="כלול" @change=${n=>this.setCandidate(o,{include:n.target.checked})} /><i class="sw" style="background:${wt[o%wt.length]}"></i><input class="name" .value=${i.name} placeholder="שם החדר" aria-label="שם החדר" @input=${n=>this.setCandidate(o,{name:n.target.value})} /><select aria-label="סוג" @change=${n=>this.setCandidate(o,{kind:n.target.value})}>${_e.map(n=>h`<option value=${n.id} ?selected=${i.kind===n.id}>${n.label}</option>`)}</select></div>`)}</div>
            ${this.zones.some(i=>i.source==="auto")?h`<label class="chk"><input type="checkbox" .checked=${this.replaceAuto} @change=${i=>this.replaceAuto=i.target.checked} /> החלף את החדרים שזוהו אוטומטית בעבר (${this.zones.filter(i=>i.source==="auto").length})</label>`:p}
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.zoneBusy||!e.some(i=>i.include)} @click=${()=>this.acceptCandidates()}>שמור ${e.filter(i=>i.include).length} חדרים</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.candidates=null}>בטל</sw-button></div>`:this.drawing?h`<div class="note">לחץ על התוכנית להוספת פינות (${this.drawing.length} עד כה). לחיצה על הפינה הראשונה או Enter סוגרים את הצורה · Esc לביטול.</div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.drawing.length<3||this.zoneBusy} @click=${()=>this.finishDrawing()}>סיים אזור</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.drawing=null}>בטל</sw-button></div>`:h`<div class="row"><span class="lbl">זיהוי חדרים מהתוכנית<span class="muted">עיבוד מקומי של הקירות (ללא AI); החדרים מוצעים ואתה נותן להם שמות</span></span><select aria-label="עוצמת זיהוי" @change=${i=>this.detectStrength=i.target.value}><option value="light" ?selected=${this.detectStrength==="light"}>קל</option><option value="medium" ?selected=${this.detectStrength==="medium"}>בינוני</option><option value="strong" ?selected=${this.detectStrength==="strong"}>חזק</option></select></div>
            <div class="btns"><sw-button variant="primary" size="sm" icon="map" ?disabled=${this.detecting||t.source==="demo"||t.planStatus==="none"} @click=${()=>this.detect()}>${this.detecting?"מזהה…":"זהה חדרים"}</sw-button><sw-button size="sm" icon="edit" ?disabled=${this.zoneBusy} @click=${()=>this.startDrawing()}>צייר אזור</sw-button></div>`}
      ${this.zones.length?h`<div class="note" style="margin-block-start:10px">${this.zones.length} אזורים בקומה · לחיצה בוחרת במפה</div>
            <div class="list">${this.zones.map(i=>h`<button class=${i.id===this.selectedZoneId?"on":""} data-zone-row @click=${()=>{this.selectedZoneId=i.id===this.selectedZoneId?null:i.id,this.selectedId=null}}><span><i class="sw" style="background:${i.color}"></i>${i.name}</span><span class="note" style="margin:0">${co(i.kind)}${i.source==="auto"?" · אוטומטי":""}</span></button>`)}</div>`:e||this.drawing?p:h`<div class="note" style="margin-block-start:10px">עדיין אין חדרים או אזורים בקומה.</div>`}
      ${s?this.renderZoneInspector(s):p}
    </sw-card>`}renderVersionCard(t){const e=this.stylized;return h`<sw-card heading="גרסת תוכנית" subheading=${t.planStatus==="draft"?"טיוטה: צופים רואים את הגרסה הקודמת":t.planStatus==="published"?"גרסה מפורסמת":"אין תוכנית"}>
      ${t.planStatus==="none"?p:h`<div class="row"><span class="lbl">תצוגת המפה<span class="muted">${t.renderMode==="stylized"?"שפת Arx (עיבוד אוטומטי של המקור)":"תוכנית המקור כפי שהועלתה"}</span></span>${t.renderMode==="stylized"?h`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("source")}>הצג מקור</sw-button>`:t.stylizedAvailable?h`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>הצג שפת Arx</sw-button>`:p}</div>
          <div class="row"><span class="lbl">עיבוד לשפת Arx<span class="muted">בחר מה להשאיר מהתוכנית; המקור נשמר תמיד</span></span></div>
          <div class="two" data-stylize-opts>
            <sw-field label="עוצמת ניקוי"><select aria-label="עוצמת ניקוי" @change=${s=>this.stylizeOpts={...this.stylizeOpts,strength:s.target.value}}><option value="light" ?selected=${this.stylizeOpts.strength==="light"}>קל · קירות דקים נשמרים</option><option value="medium" ?selected=${this.stylizeOpts.strength==="medium"}>בינוני · קירות כפולים מאוחדים</option><option value="strong" ?selected=${this.stylizeOpts.strength==="strong"}>חזק · מדרגות וריהוט לגושים</option></select></sw-field>
            <sw-field label="מילוי חדרים"><select aria-label="מילוי חדרים" @change=${s=>this.stylizeOpts={...this.stylizeOpts,roomFill:s.target.value}}>${Object.keys(Et).map(s=>h`<option value=${s} ?selected=${this.stylizeOpts.roomFill===s}>${Et[s]}</option>`)}</select></sw-field>
          </div>
          <label class="chk"><input type="checkbox" .checked=${this.stylizeOpts.keepLines} @change=${s=>this.stylizeOpts={...this.stylizeOpts,keepLines:s.target.checked}} /> ריהוט, דלתות וקווים דקים מהתוכנית (בגוון עדין)</label>
          <div class="btns"><sw-button variant="primary" size="sm" icon="image" ?disabled=${this.stylizing||t.source==="demo"} @click=${()=>this.stylize()}>${this.stylizing?"מעבד…":"עבד תצוגה מקדימה"}</sw-button></div>
          ${e?h`<div class="compare" style="margin-block-start:8px"><div><div class="note">מקור</div><img src=${e.source_url} alt="תוכנית מקור" /></div><div><div class="note" data-stylize-caption>שפת Arx · ${e.rooms} חדרים · ${Et[e.room_fill]??e.room_fill} · ${e.keep_lines?"עם קווים דקים":"ללא קווים דקים"}</div><img src=${e.stylized_url} alt="שפת Arx" /></div></div>
              <div style="display:flex;gap:8px;margin-block-start:8px"><sw-button variant="primary" size="sm" icon="check" ?disabled=${this.busy} @click=${()=>this.useRender("stylized")}>השתמש בתוצאה</sw-button><sw-button variant="ghost" size="sm" @click=${()=>this.stylized=null}>סגור</sw-button></div>
              <div class="note" style="margin-block-start:6px">עיבוד תמונה מקומי (ללא AI וללא שליחה החוצה): קירות וחדרים מזוהים לפי עובי הקווים; חדרים אינם מזוהים בשמם. אפשר לחזור למקור בכל רגע.</div>`:p}`}
      ${this.renderVersionHistory(t)}
      ${this.renderStructureHistory(t)}
      <div style="margin-block-start:8px"><sw-button size="sm" icon="upload" @click=${()=>Y(`/explore/floors/${t.floorId}/import`)}>ייבוא תוכנית חדשה</sw-button></div>
    </sw-card>
    ${this.renderFloorImages(t)}`}renderVersionHistory(t){return this.versions.length?h`<div class="row" style="margin-block-start:10px"><span class="lbl">היסטוריית גרסאות<span class="muted">כל פרסום נשמר; אפשר להשוות ולשחזר גרסה מהארכיון בלי לאבד עוגנים</span></span></div>
      <div class="vlist" data-version-list>
        ${this.versions.map(e=>{const s=e.id===t.planVersionId,i=e.status==="published"?"recorded":e.status==="draft"?"partial":"neutral",o=e.status==="published"?"מפורסמת":e.status==="draft"?"טיוטה":"ארכיון";return h`<div class="vrow ${s?"cur":""}" data-version-row data-version-id=${e.id} data-version-status=${e.status}>
            <img src=${q(e.image_url)} alt="" loading="lazy" />
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
              <div><div class="note">${e.from?`מפורסמת · ${K(e.from.published_at??e.from.created_at)}`:"אין גרסה מפורסמת"}</div>${e.from?h`<img src=${q(e.from.image_url)} alt="הגרסה המפורסמת" />`:h`<div class="note">—</div>`}</div>
              <div><div class="note">${t.mode==="rollback"?"לשחזור":"חדשה"} · ${K(e.to.published_at??e.to.created_at)}</div><img src=${q(e.to.image_url)} alt="הגרסה החדשה" /></div>
            </div>
            <div class="dsum" data-diff-summary>
              ${e.from?e.geometry.same?h`<sw-badge kind="recorded" label="גאומטריה זהה"></sw-badge>`:h`<sw-badge kind="partial" label=${`שינוי: ${e.geometry.changes.map(a=>Sr[a.field]??a.field).join(", ")}`}></sw-badge>`:h`<sw-badge kind="neutral" label="פרסום ראשון"></sw-badge>`}
              <span>${e.anchors.total} פריטים מוצבים · ${e.anchors.carried} עוברים כמו שהם · ${e.anchors.needs_alignment} ידרשו יישור</span>
            </div>
            ${i?h`<div class="note" data-diff-structure>המבנה של הטיוטה (${Rt(i.walls.length,i.openings.length)}) יפורסם יחד עם הגרסה${o?"; יש בו שגיאות שחוסמות את הפרסום עד לתיקון: ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה":""}.</div>`:p}
            ${e.anchors.items.length?h`<div class="ditems" data-diff-items>${e.anchors.items.map(a=>h`<div><span>${a.resource_type==="camera"?"מצלמה":"ישות"} · ${a.name}</span><span class=${a.outcome==="carried"?"":"err"}>${a.outcome==="carried"?"עובר":"יישור נדרש"}</span></div>`)}</div>`:p}
            ${e.anchors.needs_alignment?h`<div class="note">פריטים שידרשו יישור נשארים במקומם על גרסת התוכנית הקודמת ומסומנים במפה; שום פריט לא מוזז למיקום מומצא.</div>`:p}`:h`<div class="note">טוען השוואה…</div>`}
      <sw-button slot="footer" variant="ghost" @click=${()=>this.diff=null}>${t.mode==="compare"?"סגור":"ביטול"}</sw-button>
      ${t.mode!=="compare"&&e?h`<sw-button slot="footer" variant="primary" icon=${t.mode==="publish"?"check":"history"} data-diff-confirm ?disabled=${this.busy||o} @click=${()=>this.confirmDiff()}>${t.mode==="publish"?"פרסם גרסה":"שחזר ופרסם"}</sw-button>`:p}
    </sw-dialog>`}renderGeomDiffDialog(){const t=this.geomDiff;if(!t)return p;const e=t.data,s=e?e.issues.filter(o=>o.severity==="error"):[],i=e?Object.entries(e.diff.collections):[];return h`<sw-dialog open heading="פרסום המבנה" subheading="מה ישתנה לצופים במפה" data-geom-diff @close=${()=>this.geomDiff=null}>
      ${t.error?h`<div class="err" data-geom-diff-error>${t.error}</div>`:p}
      ${e?h`<div class="ditems" data-geom-diff-rows>
              ${i.length?i.map(([o,n])=>h`<div><span>${Lo[o]??o}</span><span>${n.added.length} נוספו · ${n.changed.length} שונו · ${n.removed.length} הוסרו</span></div>`):h`<div><span>אין שינוי בפריטים</span></div>`}
              ${e.diff.calibration_changed?h`<div><span>כיול</span><span>קנה המידה השתנה</span></div>`:p}
              ${(e.shared_pending??[]).filter(o=>o.invalid||(o.changes??0)>0).map(o=>h`<div data-geom-shared-pending>
                <span>כולל שינויים בחלל המשותף${o.home_floor_name?` (${D(o.home_floor_name)})`:""}</span>
                <span>${o.invalid?o.items?.length?`${I(o.items.length,"פריט אחד לא מוכן","פריטים לא מוכנים")} לפרסום`:"התוכן של החלל המשותף לא תקין - הפרסום ייחסם":I(o.changes??0,"שינוי אחד","שינויים")}</span>
              </div>
              ${o.invalid&&o.items?.length?h`<div class="note" data-geom-shared-invalid>${o.items.map(n=>h`<div>${n.id.split(":").pop()} · ${n.message}</div>`)}
                <label><input type="checkbox" data-geom-shared-skip .checked=${t.skip.length>0} @change=${n=>{this.geomDiff={...t,skip:n.target.checked?o.items.map(r=>r.id):[]}}} /> פרסם בלי הפריטים האלה (הם יישארו כמו שפורסמו)</label></div>`:p}`)}
            </div>
            <div class="note">${e.published_counts?`כעת: ${Rt(e.published_counts.walls,e.published_counts.openings)}`:"פרסום ראשון של מבנה"} · אחרי הפרסום: ${Rt(e.counts.walls,e.counts.openings)}</div>
            ${s.length?h`<div class="err" data-geom-diff-error>${I(s.length,"שגיאה חוסמת אחת","שגיאות חוסמות")} בטיוטה: הפרסום חסום עד לתיקון. ראה את הסימון האדום על המפה ואת רשימת הבעיות של המבנה.</div>`:p}`:t.error?p:h`<div class="note">טוען השוואה…</div>`}
      <sw-button slot="footer" variant="ghost" data-geom-cancel @click=${()=>this.geomDiff=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" icon="check" data-geom-publish ?disabled=${this.busy||!e||s.length>0||(e.shared_pending??[]).some(o=>o.invalid&&!(o.items?.length&&t.skip.length))} @click=${()=>this.confirmGeomPublish()}>פרסם מבנה</sw-button>
    </sw-dialog>`}render(){const t=this.bundle;if(this.error&&!t)return h`<sw-page heading="עורך תוכנית"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-page>`;if(!t)return h`<sw-page heading="עורך תוכנית"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const e=this.selected,s=this.dirty.size,i=this.anchors.filter(n=>n.resource_type==="camera").length,o=this.anchors.length-i;return h`
      <sw-page heading="עורך תוכנית" subheading=${`${t.buildingName} · ${t.floorName} · ${t.planStatus==="draft"?"טיוטה":t.planStatus==="published"?"תוכנית מפורסמת":"אין תוכנית"} · העוגנים נשמרים בנפרד מתמונת המקור${t.source==="demo"?" · נתוני הדגמה":""}`} crumbs=${`אתרים | ${t.siteName} | ${t.buildingName} | ${t.floorName}`} wide>
        ${t.permissions.publish&&(t.planStatus==="draft"||this.studio.pendingPublish)?h`<sw-button slot="actions" variant="primary" icon="check" data-publish ?disabled=${this.busy} @click=${()=>this.publish()}>${t.planStatus==="draft"?"פרסום גרסה":"פרסום המבנה"}</sw-button>`:p}
        <sw-button slot="actions" icon="eye" @click=${()=>Y(`/explore/floors/${t.floorId}`)}>תצוגה מקדימה</sw-button>
        <sw-button slot="actions" ?disabled=${!s||this.busy} icon="check" @click=${()=>this.save()}>${s?`שמירה (${s})`:"הכל שמור"}</sw-button>
        <sw-button slot="actions" variant="ghost" icon="history" ?disabled=${!this.undo.length} @click=${()=>this.doUndo()}>ביטול שינוי</sw-button>
        ${t.planStatus==="none"?h`<sw-state-panel icon="map" state="empty" heading="לקומה אין תוכנית" hint="העלה תוכנית קודם; אחר כך אפשר להציב מצלמות וישויות."><div style="margin-block-start:10px"><sw-button variant="primary" icon="upload" @click=${()=>Y(`/explore/floors/${t.floorId}/import`)}>העלאת תוכנית</sw-button> <sw-button variant="ghost" icon="mail" data-architect-request @click=${()=>_s()}>בקשה לאדריכל</sw-button></div></sw-state-panel>`:h`<div class="layout">
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
                ${this.studio.doc&&t.permissions.structure?h`<div class="levelbar">${Eo(this.studio.doc.levels.filter(n=>this.sharedLevels||!n.shared),this.activeLevel,n=>this.setLevelFilter(n),()=>this.openNewLevel(),n=>this.openLevelEdit(n))}${this.phone.matches?p:h`<sw-chip data-grid-chip icon="grid" ?selected=${this.grid.on} aria-pressed=${this.grid.on?"true":"false"} title="רשת עזר: גרירה והצבה של עצם נצמדות אליה (המרווח בכלי השכבות)" @click=${()=>this.setGrid(t.floorId,{on:!this.grid.on})}>רשת</sw-chip>`}${!this.phone.matches&&this.shownTags.length?jo(this.shownTags,n=>this.selectByTag(n)):p}</div>`:p}
                <div class="rail" role="toolbar" aria-label="כלי עריכה">
                  ${yr.filter(n=>n.id!=="camera"||ut("cameras_available")).map(n=>h`<button class=${n.id===this.tool?"on":""} data-tool=${n.id} ?disabled=${!n.ready||Nt.includes(n.id)&&!t.permissions.structure||this.detectBusy&&n.id!==this.tool} title=${n.label} aria-label=${n.label} aria-pressed=${n.id===this.tool} @click=${()=>this.pickTool(n.id)}><sw-icon .name=${n.icon} size=${18}></sw-icon></button>`)}
                  <hr />
                  <button title="ביטול (Ctrl+Z)" aria-label="ביטול" data-rail-undo ?disabled=${this.detectBusy||!this.undoTarget} @click=${()=>this.undoAny()}><sw-icon name="history" size=${18}></sw-icon></button>
                  <button title="בצע שוב (Ctrl+Y)" aria-label="בצע שוב" data-rail-redo ?disabled=${this.detectBusy||!this.redoTarget} @click=${()=>this.redoAny()}><sw-icon name="refresh" size=${18}></sw-icon></button>
                </div>
                <sw-plan-canvas editable alwaysLabel .placing=${!!this.placing||!!this.drawing||this.studioPlacing} .planWidth=${t.width} .planHeight=${t.height} .plan=${t.planSvg} .imageUrl=${t.imageUrl} .hideImage=${!this.planImage} .markers=${this.markers} .selectedId=${this.selectedId}
                  .zones=${this.planZones} .selectedZoneId=${this.selectedZoneId} .selectedZoneVertex=${this.zoneVertexSel&&this.zoneVertexSel.zoneId===this.selectedZoneId?this.zoneVertexSel.index:null} .draftPoints=${this.drawing??T}
                  .geometry=${this.geomPreview??this.studio.doc} .geomDrag=${this.geomDragMode} .structureLevel=${this.activeLevel} .selectedGeomId=${this.geomSel?.id??null} .highlightIds=${this.highlightIds} .selectedVertex=${this.geomSel?.vertex??null} .issueIds=${this.issueIds}
                  .cornerSnapPx=${this.straightDrawing||this.curveDrawing?F:0}
                  .curveHandles=${this.tool==="structure"&&this.studioMode==="curve"} .selectedSegment=${this.geomSel?.segment??null} .arcPreview=${this.curveLive(t)?.path??T}
                  .curveDraft=${this.curveDraft??T} .curvePointHandles=${this.geomSelectMode&&this.studioMode!=="curve"||this.tool==="select"||this.curveDrawing&&!this.curveDraft}
                  .wallDraft=${this.wallDraft??T} .hoverPoint=${this.studioPlacing?this.hover:null} .rulers=${this.rulers} .gridStep=${this.studio.doc?this.gridPx(this.studio.doc):0} .guides=${this.guides} .catalog=${this.catalogLookup}
                  .ghost=${this.doorGhost&&this.studio.doc?Ln(this.studio.doc,this.doorGhost,this.wallDefaults):null} .ghostNote=${this.doorGhost?.note??""} .ghostWarn=${!!this.doorGhost&&(this.doorGhost.found==="default"||!!this.doorGhost.warning)}
                  .ghostHandles=${this.doorGhost&&this.studio.doc?jn(this.studio.doc,this.doorGhost,t.width,t.height):T} @ghost-handle=${n=>this.onGhostHandle(n.detail)}
                  .candidates=${this.tool==="detect"&&this.cands?this.cands.set:null} .candidateStates=${this.shownCandStates} .selectedCandidateId=${this.candSel} .candidateEditable=${this.tool==="detect"&&!this.narrow&&!this.busy}
                  @candidate-select=${n=>this.toggleCandidate(n.detail.id)}
                  @candidate-drag=${n=>this.onCandidateDrag(n.detail)} .anchorPositions=${this.anchorPositions}
                  @plan-hover=${n=>this.onPlanHover(n.detail.x,n.detail.y,n.detail.shift,!!n.detail.item)}
                  .multiDrag=${this.multiShown.length>=2&&this.geomDragMode==="all"} .marquee=${this.multiOn} .panMode=${this.panMode}
                  @geom-box=${n=>this.onGeomBox(n.detail)}
                  @geom-select=${n=>this.onCanvasSelect(n.detail)}
                  @geom-drag-move=${n=>this.queueDragMove(n.detail)}
                  @geom-drag-cancel=${()=>{this.cancelDragMove(),this.geomPreview=null,this.guides=[],this.guideCache=null,this.zoneSaving||(this.zonePreview=null),this.dupId=null}}
                  @geom-drag=${n=>{this.cancelDragMove(),this.onGeomDrag(n.detail)}}
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
                ${this.tool==="circuits"&&this.membersMode?this.circuitPlacing?h`<div class="placing-hint" data-circuit-placing><span>${No(this.circuitPlacing)}</span></div>`:h`<div class="placing-hint"><span>לחץ על מנורה כדי להוסיף או להסיר אותה מהמעגל · Esc לסיום</span></div>`:p}
                ${this.bindOffer?h`<div class="placing-hint bindbar" data-bind-offer><span>העצם ליד ${this.anchorName(this.bindOffer.anchor)} — להפוך אותו לגוף של הישות?
                    <button data-bind-accept @click=${()=>this.bindObject(this.bindOffer.objectId,this.bindOffer.anchor)}>הצמד לישות</button><button data-bind-dismiss @click=${()=>{this.bindRefused.add(this.bindOffer.objectId),this.bindOffer=null}}>לא</button></span></div>`:p}
                ${this.tool==="structure"&&this.studioMode==="markdoor"&&this.studio.doc?this.renderMarkDoorHint():p}
                ${this.curveDraft?this.renderCurveHint(t):p}
                ${this.wallDraft?h`<div class="placing-hint float" data-wall-hint><span>ציור קיר: ${this.wallDraft.length} נקודות · Enter או לחיצה חוזרת על הנקודה האחרונה מסיימים · לחיצה על הנקודה הראשונה סוגרת מתאר · Esc לביטול</span></div>`:p}
                <div class="legend"><span><i></i>מצלמות · ${i}</span><span><i class="ent"></i>התקנים · ${o}</span><span><i class="zone"></i>אזורים · ${this.zones.length}</span></div>
              </div>
              <div class="props">
                ${this.renderSharedHint()}
                ${e?e.resource_type==="camera"?this.renderCameraInspector(e):this.renderEntityInspector(e):this.selectedZone&&this.tool!=="zones"?h`<sw-card heading="אזור" subheading=${this.selectedZone.name}>${this.renderZoneInspector(this.selectedZone)}</sw-card>${this.multiOn?h`<div class="note" data-multi-hint>${At}</div>`:p}`:this.renderToolPanel(t)}
                ${(e||this.selectedZone&&this.tool!=="zones")&&this.tool!=="select"?this.renderToolPanel(t):p}
                ${this.renderVersionCard(t)}
              </div>
            </div>`}
        ${this.renderDiffDialog()}
        ${this.renderGeomDiffDialog()}
        ${this.arrayDialog?Fo(this.arrayDialog,n=>this.arrayDialog={...this.arrayDialog,error:"",...n},()=>this.createArray(),()=>this.arrayDialog=null):p}
        ${this.twinDelete?Ro(this.twinDelete.target,this.twinDelete.canBoth,()=>this.confirmTwinDelete(!0),()=>this.confirmTwinDelete(!1),()=>this.twinDelete=null):p}
        ${this.linkConfirm?Zo(this.linkConfirm.kind,this.linkConfirm.target,()=>this.confirmLink(!0),()=>this.confirmLink(!1)):p}
        ${this.groupDelete?Go(this.studio.doc?.groups.find(n=>n.id===this.groupDelete)?.member_ids.length??0,()=>this.deleteGroup(!0),()=>this.deleteGroup(!1),()=>this.groupDelete=null):p}
        ${this.customDialog&&this.library?Bo(this.customDialog,this.library,n=>this.customDialog={...this.customDialog,...n},()=>void this.createCustom(),()=>this.customDialog=null):p}
        ${this.levelDialog?Vo(this.levelDialog,{change:n=>this.levelDialog={...this.levelDialog,...n},submit:()=>this.submitLevel(),cancel:()=>this.levelDialog=null,remove:()=>this.deleteLevel()}):p}
        ${this.shortcutsOpen?Uo(()=>this.shortcutsOpen=!1):p}
        ${this.pkgImport?Kn(this.pkgImport,{setMode:n=>void this.previewPackage(n),setAcceptForeign:n=>this.setPackageTrust(n),confirm:()=>void this.confirmPackageImport(),cancel:()=>{this.pkgImport?.busy!=="import"&&(this.pkgImport=null)}}):p}
        ${this.renderShareDialog()}
      </sw-page>
    `}};g.styles=[Wt`
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
  `,Ho,qn,Ko];f([M()],g.prototype,"floorId",2);f([M()],g.prototype,"presetEntity",2);f([M()],g.prototype,"presetCandidates",2);f([M()],g.prototype,"presetZone",2);f([m()],g.prototype,"bundle",2);f([m()],g.prototype,"anchors",2);f([m()],g.prototype,"dirty",2);f([m()],g.prototype,"undo",2);f([m()],g.prototype,"redo",2);f([m()],g.prototype,"selectedId",2);f([m()],g.prototype,"tool",2);f([m()],g.prototype,"panMode",2);f([m()],g.prototype,"shortcutsOpen",2);f([m()],g.prototype,"layers",2);f([m()],g.prototype,"planImage",2);f([m()],g.prototype,"grid",2);f([m()],g.prototype,"guides",2);f([m()],g.prototype,"placing",2);f([m()],g.prototype,"entQ",2);f([m()],g.prototype,"entResults",2);f([m()],g.prototype,"entBusy",2);f([m()],g.prototype,"lightsAll",2);f([m()],g.prototype,"busy",2);f([m()],g.prototype,"error",2);f([m()],g.prototype,"info",2);f([m()],g.prototype,"pkgImport",2);f([m()],g.prototype,"stylizing",2);f([m()],g.prototype,"stylized",2);f([m()],g.prototype,"stylizeOpts",2);f([m()],g.prototype,"zones",2);f([m()],g.prototype,"versions",2);f([m()],g.prototype,"geomVersions",2);f([m()],g.prototype,"areas",2);f([m()],g.prototype,"floorImages",2);f([m()],g.prototype,"alignDraft",2);f([m()],g.prototype,"alignShowPlan",2);f([m()],g.prototype,"imageBusy",2);f([m()],g.prototype,"imageNote",2);f([m()],g.prototype,"diff",2);f([m()],g.prototype,"selectedZoneId",2);f([m()],g.prototype,"zoneVertexSel",2);f([m()],g.prototype,"lastEdit",2);f([m()],g.prototype,"candidates",2);f([m()],g.prototype,"detecting",2);f([m()],g.prototype,"detectStrength",2);f([m()],g.prototype,"replaceAuto",2);f([m()],g.prototype,"drawing",2);f([m()],g.prototype,"showZones",2);f([m()],g.prototype,"zoneBusy",2);f([xs("sw-plan-canvas")],g.prototype,"canvas",2);f([m()],g.prototype,"studioMode",2);f([m()],g.prototype,"curveDraft",2);f([m()],g.prototype,"glassDraw",2);f([m()],g.prototype,"doorGhost",2);f([m()],g.prototype,"doorAsking",2);f([m()],g.prototype,"wallDefaults",2);f([m()],g.prototype,"geomSel",2);f([m()],g.prototype,"multi",2);f([m()],g.prototype,"zonePreview",2);f([m()],g.prototype,"zoneSaving",2);f([m()],g.prototype,"multiNote",2);f([m()],g.prototype,"geomPreview",2);f([m()],g.prototype,"library",2);f([m()],g.prototype,"libQ",2);f([m()],g.prototype,"libCategory",2);f([m()],g.prototype,"libRecent",2);f([m()],g.prototype,"libFav",2);f([m()],g.prototype,"placingItem",2);f([m()],g.prototype,"bindOffer",2);f([m()],g.prototype,"arrayDialog",2);f([m()],g.prototype,"groupDelete",2);f([m()],g.prototype,"customDialog",2);f([m()],g.prototype,"levelFilter",2);f([m()],g.prototype,"levelDialog",2);f([m()],g.prototype,"matStyle",2);f([m()],g.prototype,"walkArmed",2);f([m()],g.prototype,"walkFocus",2);f([m()],g.prototype,"site",2);f([m()],g.prototype,"connMode",2);f([m()],g.prototype,"connStart",2);f([m()],g.prototype,"linkTargets",2);f([m()],g.prototype,"sharedLevels",2);f([m()],g.prototype,"shareDlg",2);f([m()],g.prototype,"stairShape",2);f([m()],g.prototype,"twinDelete",2);f([m()],g.prototype,"linkConfirm",2);f([m()],g.prototype,"linkBusy",2);f([m()],g.prototype,"circuitSel",2);f([m()],g.prototype,"membersMode",2);f([m()],g.prototype,"circuitPlacing",2);f([m()],g.prototype,"circuitNew",2);f([m()],g.prototype,"wallDraft",2);f([m()],g.prototype,"hover",2);f([m()],g.prototype,"calib",2);f([m()],g.prototype,"measurePts",2);f([m()],g.prototype,"geomDiff",2);f([m()],g.prototype,"showEstimates",2);f([m()],g.prototype,"camSuggestCfg",2);f([m()],g.prototype,"camSuggestions",2);f([m()],g.prototype,"zoneCamera",2);f([m()],g.prototype,"detectOpts",2);f([m()],g.prototype,"detectRun",2);f([m()],g.prototype,"cands",2);f([m()],g.prototype,"candStates",2);f([m()],g.prototype,"candSel",2);f([m()],g.prototype,"candEdits",2);f([m()],g.prototype,"candObjectsOn",2);f([m()],g.prototype,"hintApplied",2);f([m()],g.prototype,"detectAsk",2);f([m()],g.prototype,"detectErr",2);f([m()],g.prototype,"narrow",2);g=f([Ve("explore-plan-editor")],g);export{g as ExplorePlanEditor};
//# sourceMappingURL=explore-plan-editor-L36f1OAG.js.map
