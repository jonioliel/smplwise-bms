import{mM as te,e as n,fi as X,C as re,E as Y,F as E,G as c,a as M,S as le,p as l,f as g,j as x,R as _,A as p,H as I,q as k,bv as ke,bU as be,h as rt,nd as Rt,x as Ie,mf as At,m as Ue,mh as S,nz as lt,mV as Zt,oY as Jt,mZ as dt,nx as Qt,mU as es,oZ as ot,nn as Ce,o_ as ts,o$ as ss,p0 as as,p1 as ct,nc as y,p2 as is,p3 as ns,p4 as rs,p5 as ls,p6 as ds,p7 as os,p8 as cs,i as B,b6 as ps,ba as st,g as Ht,p9 as us,v as he,pa as f,pb as hs,pc as ms,d as O,b as bs,o as vs,pd as pt,r as $s,J as fs,av as we,ae as gs,b7 as ys,fj as ws,pe as _s,pf as ks,pg as Xe,s as xs,dG as Be,ph as Ss,pi as Le,pj as Ds,nD as z,l as ut,pk as Cs,pl as Ns,hO as Ts,hQ as ht,dQ as Os,D as Es}from"./index-DqJBc8eX.js";import{b as Mt,B as Ps,L as zs}from"./tickets-board-BwexvRKJ.js";import{a4 as Ls,S as Rs,X as As,a1 as Fe,a5 as Hs,a6 as Ms,a7 as Is,m as pe,a as v,w as js,p as mt,q as Ne,E as qs,a8 as Us,d as Bs}from"./drawer-model-C9MLXsgt.js";import{t as Z}from"./settings-styles-DJq3kB69.js";import{d as Fs,i as Ye,a as C,l as Gs,I as Ws,n as bt,e as vt,g as Ks}from"./intake-model-BJOTFkLM.js";import{createBinding as Vs,revokeBinding as Xs}from"./access-CloU-baO.js";import{a as Ys}from"./media-page-VuCH0fjN.js";import{i as Zs,r as Js,S as Qs,v as ea}from"./settings-tabs-CcQjb9O6.js";import{H as ta,o as Ge,I as sa,V as aa,J as ia,K as na}from"./overview-model-CZ6DxOQ6.js";import"./sw-logo-art-Va6y_cIM.js";import"./lead-reserve-5y14kc2C.js";function ra(e,t,s){const a=Ls(e?.detail_tab)??"overview",i=Rs(e?.drawer_size)??"wide",r=As(e?.phone_sheet)??"full",d=(o,u,h,$,R,P)=>n`<span class="seg" role="radiogroup" aria-label=${te(o)}>${u.map(T=>n`<button type="button" role="radio" aria-pressed=${String(h===T)} aria-checked=${String(h===T)}
      data-ui-drawer=${`${R}:${T}`} ?disabled=${t} @click=${()=>s({[P]:T})}>${$(T)}</button>`)}</span>`;return n`
    <div class="row" data-setting="detail_tab"><span class="lbl">${te("setDrawerTab")}<span class="muted">${te("setDrawerTabSub")}</span></span>
      ${d("setDrawerTab",Hs,a,o=>te(`tab_${o}`),"tab","detail_tab")}</div>
    <div class="row" data-setting="drawer_size"><span class="lbl">${te("setDrawerSize")}<span class="muted">${te("setDrawerSizeSub")}</span></span>
      ${d("setDrawerSize",Ms,i,o=>te(`size_${o}`),"size","drawer_size")}</div>
    <div class="row" data-setting="phone_sheet"><span class="lbl">${te("setPhoneSheet")}<span class="muted">${te("setPhoneSheetSub")}</span></span>
      ${d("setPhoneSheet",Is,r,o=>te(`ps_${o}`),"sheet","phone_sheet")}</div>
    ${la(e,t,s)}`}function la(e,t,s){const a=e?.camera_viewfinder===!0,i=r=>n`<button type="button" role="radio" aria-pressed=${String(a===r)} aria-checked=${String(a===r)}
    data-ui-drawer=${`camera_viewfinder:${r?"on":"off"}`} ?disabled=${t} @click=${()=>s({camera_viewfinder:r})}>${Fe(r?"set_on":"set_off")}</button>`;return n`<div class="row" data-setting="camera_viewfinder"><span class="lbl">${Fe("set_label")}<span class="muted">${Fe("set_sub")}</span></span>
    <span class="seg" role="radiogroup" aria-label=${Fe("set_label")}>${i(!1)}${i(!0)}</span></div>`}const da={min:1,h:60,d:1440},oa=365*24*60,Ve=["unassigned_after_min","link_unopened_min","ack_within_min","stuck_after_min","stuck_waiting_min","resolve_within_min","remind_every_min"],Ae=["max_reminders","manager_alert_after_steps"];function ca(e){return e==null||!Number.isFinite(e)||e<=0?null:e%1440===0?{value:e/1440,unit:"d"}:e%60===0?{value:e/60,unit:"h"}:{value:e,unit:"min"}}function pa(e,t){const s=e.trim();if(!s)return null;if(!/^\d{1,6}$/.test(s))return Number.NaN;const a=Number(s)*da[t];return a>=1&&a<=oa?a:Number.NaN}function ua(e){const t=e.trim();if(!/^\d{1,2}$/.test(t))return Number.NaN;const s=Number(t);return s<=10?s:Number.NaN}function H(e,t,s){const a=e.trim();if(!/^-?\d{1,4}$/.test(a))return Number.NaN;const i=Number(a);return i>=t&&i<=s?i:Number.NaN}const $t=/^([01]\d|2[0-3]):[0-5]\d$/;function It(e,t){return!$t.test(e)||!$t.test(t)?"time":e<t?null:"order"}function ha(e,t){const s=t.link_sliding_days??e.sliding_days,a=Math.max(t.link_cap_days??e.cap_days,s);return{sliding_days:s,cap_days:a,grace_hours:t.link_grace_hours??e.grace_hours}}function ma(e,t){const s={},a=[];for(const i of Ve){const r=t[i];if(!r)continue;const d=pa(r.raw,r.unit);Number.isNaN(d)?a.push(i):d!==e[i]&&(s[i]=d)}for(const i of Ae){const r=t[i];if(r===void 0)continue;const d=ua(r);Number.isNaN(d)?a.push(i):d!==e[i]&&(s[i]=d)}return{changes:s,invalid:a}}var ba=Object.defineProperty,va=Object.getOwnPropertyDescriptor,Ee=(e,t,s,a)=>{for(var i=a>1?void 0:a?va(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&ba(t,s,i),i};const $a=["min","h","d"];let ve=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.readonly=!1,this.drafts={},this.busy=!1,this.error=""}stored(e){return Object.fromEntries([...Ve,...Ae].map(t=>[t,e[t]]))}cell(e,t){const s=this.drafts[e.priority_id]?.[t];if(s)return s;const a=ca(e[t]);return a?{raw:String(a.value),unit:a.unit}:{raw:"",unit:t==="link_unopened_min"||t==="resolve_within_min"?"h":"min"}}set(e,t,s){const a=this.cell(e,t);this.drafts={...this.drafts,[e.priority_id]:{...this.drafts[e.priority_id],[t]:{...a,...s}}}}setCounter(e,t,s){this.drafts={...this.drafts,[e.priority_id]:{...this.drafts[e.priority_id],[t]:s}}}analysis(){const e=[],t=new Set;for(const s of this.dept.sla){const a=this.drafts[s.priority_id];if(!a)continue;const{changes:i,invalid:r}=ma(this.stored(s),a);for(const d of r)t.add(`${s.priority_id}:${d}`);Object.keys(i).length&&e.push({priority_id:s.priority_id,revision:s.revision,...i})}return{rows:e,invalid:t}}async save(){const{rows:e,invalid:t}=this.analysis();if(t.size){this.error=l("slaInvalid");return}if(!(!e.length||this.busy)){this.busy=!0,this.error="";try{const s=await g().saveSla(this.dept.id,e);this.drafts={},this.dispatchEvent(new CustomEvent("dept-changed",{detail:{dept:s,saved:!0},bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof x&&s.status===409?l("slaStale"):_(s),s instanceof x&&s.status===409&&(this.drafts={},this.dispatchEvent(new CustomEvent("dept-reload",{bubbles:!0,composed:!0})))}finally{this.busy=!1}}}durationInput(e,t,s){const a=this.cell(e,t),i=s.has(`${e.priority_id}:${t}`),r=`${l(`sla_${t}`)} · ${e.priority_name}`;return n`<span class="cell">
      <input class="in" inputmode="numeric" maxlength="6" aria-label=${r} placeholder=${l("slaOff")} aria-invalid=${String(i)} ?disabled=${this.readonly||this.busy}
        data-sla=${`${e.priority_key}:${t}`} .value=${a.raw} @input=${d=>this.set(e,t,{raw:d.target.value})} />
      <select class="in" aria-label=${`${r} · ${l("unit_h")}`} ?disabled=${this.readonly||this.busy} data-sla-unit=${`${e.priority_key}:${t}`}
        @change=${d=>this.set(e,t,{unit:d.target.value})}>
        ${$a.map(d=>n`<option value=${d} ?selected=${a.unit===d}>${l(`unit_${d}`)}</option>`)}
      </select></span>`}counterInput(e,t,s){const a=this.drafts[e.priority_id]?.[t]??String(e[t]);return n`<input class="in num" inputmode="numeric" maxlength="2" aria-label=${`${l(`sla_${t}`)} · ${e.priority_name}`}
      aria-invalid=${String(s.has(`${e.priority_id}:${t}`))} ?disabled=${this.readonly||this.busy} data-sla=${`${e.priority_key}:${t}`} .value=${a}
      @input=${i=>this.setCounter(e,t,i.target.value)} />`}render(){const{rows:e,invalid:t}=this.analysis(),s=e.length>0||t.size>0,a=[...Ve,...Ae];return n`
      <div class="gridwrap" data-sla-grid>
        <table class="sla">
          <thead><tr><th></th>${this.dept.sla.map(i=>n`<th data-sla-col=${i.priority_key}>${i.priority_name}</th>`)}</tr></thead>
          <tbody>${a.map(i=>n`<tr data-sla-row=${i}>
            <td class="pn">${l(`sla_${i}`)}</td>
            ${this.dept.sla.map(r=>n`<td>${Ae.includes(i)?this.counterInput(r,i,t):this.durationInput(r,i,t)}</td>`)}
          </tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards" data-sla-cards>${this.dept.sla.map(i=>n`<div class="pcard" data-sla-card=${i.priority_key}>
        <h4>${i.priority_name}</h4>
        ${Ve.map(r=>n`<div class="pr"><span>${l(`sla_${r}`)}</span>${this.durationInput(i,r,t)}</div>`)}
        ${Ae.map(r=>n`<div class="pr"><span>${l(`sla_${r}`)}</span>${this.counterInput(i,r,t)}</div>`)}
      </div>`)}</div>
      ${this.readonly?p:n`<div class="foot">
        <sw-button variant="primary" size="sm" data-sla-save ?disabled=${!s||this.busy} @click=${()=>void this.save()}>${l("save")}</sw-button>
        ${s?n`<sw-button size="sm" variant="ghost" data-sla-cancel ?disabled=${this.busy} @click=${()=>{this.drafts={},this.error=""}}>${l("cancel")}</sw-button>`:p}
        <span class="grow"></span>
        ${this.error?n`<span class="msg err" role="alert" data-sla-error>${this.error}</span>`:n`<span class="muted">${s?l("unsaved"):l("slaEmptyIsOff")}</span>`}
      </div>`}`}};ve.styles=[X,Z,Y`
    :host {
      display: block;
      min-inline-size: 0;
    }
  `,re];Ee([E({attribute:!1})],ve.prototype,"dept",2);Ee([E({type:Boolean})],ve.prototype,"readonly",2);Ee([c()],ve.prototype,"drafts",2);Ee([c()],ve.prototype,"busy",2);Ee([c()],ve.prototype,"error",2);ve=Ee([I("tickets-sla-grid")],ve);var fa=Object.defineProperty,ga=Object.getOwnPropertyDescriptor,de=(e,t,s,a)=>{for(var i=a>1?void 0:a?ga(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&fa(t,s,i),i};const ya=["info","alert","critical"],wa=["urgent","high","normal","low"],_a={links:{sliding_days:14,cap_days:90,grace_hours:24},send_hours:{from:"07:00",to:"21:00"},urgent_is_critical:!0};let K=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.directory=null,this.installation=null,this.dr={},this.catSel="",this.tplOpen="",this.tplDraft=null,this.busy=!1,this.deleting=!1}willUpdate(e){const t=e.get("dept");t&&t.id!==this.dept.id&&(this.deleting=!1,this.dr={},this.catSel="",this.tplOpen="",this.tplDraft=null)}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}set(e){this.dr={...this.dr,...e}}async act(e,t){if(!this.busy){this.busy=!0;try{const s=await e();s&&this.emit("dept-changed",{dept:s}),t?.(),this.emit("notice",{ok:l("setSaved")}),this.emit("dept-reload")}catch(s){this.emit("notice",{error:_(s)}),s instanceof x&&s.status===409&&this.emit("dept-reload")}finally{this.busy=!1}}}patchDept(e,t){return this.act(()=>g().patchDepartment(this.dept.id,{...e,revision:this.dept.revision}),t)}get inst(){return this.installation??_a}basicsCard(){const e=this.dept,t=this.dr.name??e.name,s=this.dr.description??e.description,a=this.dr.reopen_days??String(e.reopen_days);return n`<sw-card heading=${e.name} subheading=${`${e.key} · ${l("depOpenTickets",{n:e.open_tickets})}`} data-dept=${e.id} data-card="dept-basics">
      <div class="row"><span class="lbl">${l("depName")}</span>
        <span class="end"><input class="in" maxlength="40" data-dept-name .value=${t} @input=${i=>this.set({name:i.target.value})} />
          <sw-button size="sm" ?disabled=${this.busy||!t.trim()||t.trim()===e.name} data-dept-rename @click=${()=>void this.patchDept({name:t.trim()},()=>this.set({name:void 0}))}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${l("depDescription")}</span>
        <span class="end"><input class="in" maxlength="200" data-dept-description .value=${s} @input=${i=>this.set({description:i.target.value})} />
          <sw-button size="sm" ?disabled=${this.busy||s.trim()===e.description} data-dept-description-save @click=${()=>void this.patchDept({description:s.trim()},()=>this.set({description:void 0}))}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${l("depActive")}</span>
        <sw-toggle label=${l("depActive")} labelHidden .checked=${e.active} ?disabled=${this.busy} data-dept-active @change=${i=>void this.patchDept({active:i.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${l("depOpenToAll")}<span class="muted">${l("depOpenToAllSub")}</span></span>
        <sw-toggle label=${l("depOpenToAll")} labelHidden .checked=${e.open_to_all} ?disabled=${this.busy} data-dept-open @change=${i=>void this.patchDept({open_to_all:i.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${l("depReopenDays")}</span>
        <span class="end"><input class="in num" type="number" min="1" max="90" data-dept-reopen .value=${a} @input=${i=>this.set({reopen_days:i.target.value})} />
          <sw-button size="sm" ?disabled=${this.busy||Number(a)===e.reopen_days||Number.isNaN(H(a,1,90))} @click=${()=>void this.patchDept({reopen_days:Number(a)},()=>this.set({reopen_days:void 0}))}>${l("save")}</sw-button></span></div>
      ${this.categoriesRow()}
      ${this.membersRow()}
      <div class="row"><span class="lbl"></span><sw-button size="sm" variant="danger" data-dept-delete ?disabled=${this.busy||this.deleting} @click=${()=>this.deleting=!0}>${l("depDelete")}</sw-button></div>
      ${this.deleting?this.deleteConfirm(e):p}
    </sw-card>`}deleteConfirm(e){const t=e.open_tickets>0;return n`<div class="danger" role="group" data-dept-delete-confirm data-open=${e.open_tickets} data-members=${e.members.length}>
      <b>${l("depDeleteAsk",{name:e.name})}</b>
      ${t?n`<span data-dept-delete-blocked>${l("depDeleteBlocked",{n:e.open_tickets})}</span>`:n`<span>${l("depDeleteMembers",{n:e.members.length})}</span><span>${l("depDeleteRestorable")}</span>`}
      <span class="chipsrow">
        ${t?p:n`<sw-button size="sm" variant="danger" data-dept-delete-ok ?disabled=${this.busy} @click=${()=>void this.removeDepartment()}>${l("depDelete")}</sw-button>`}
        <sw-button size="sm" variant="ghost" data-dept-delete-cancel @click=${()=>this.deleting=!1}>${l("ctCancel")}</sw-button></span>
    </div>`}async removeDepartment(){if(!this.busy){this.deleting=!1,this.busy=!0;try{await g().deleteDepartment(this.dept.id),this.emit("dept-deleted",{id:this.dept.id}),this.emit("notice",{ok:l("setSaved")})}catch(e){this.emit("notice",{error:_(e)})}finally{this.busy=!1}}}catDraft(e){return this.dr.cat??{parent:e.parent_id??"",prio:e.default_priority_id??"",domains:(e.domains??[]).join(", ")}}categoriesRow(){const e=this.dept,t=e.categories.filter(o=>o.active),s=t.find(o=>o.id===this.catSel),a=s?this.catDraft(s):null,i=a?a.domains.split(",").map(o=>o.trim()).filter(Boolean):[],r=i.some(o=>!/^[a-z][a-z0-9_]{0,39}$/.test(o))||i.length>20,d=o=>o.parent_id?t.find(u=>u.id===o.parent_id)?.name:null;return n`<div class="row stack"><span class="lbl">${l("depCategories")}</span>
      <div class="chipsrow" data-dept-categories>${t.length?t.map(o=>n`<span class="tag">
        <button type="button" class="tag" aria-pressed=${String(this.catSel===o.id)} data-cat=${o.id} @click=${()=>{this.catSel=this.catSel===o.id?"":o.id,this.set({cat:void 0})}}>${d(o)?`${k(d(o)??"")} ‹ `:""}${k(o.name)}</button>
        <button type="button" class="rm" aria-label=${`${l("depRemove")} ${o.name}`} data-cat-remove=${o.id} ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteCategory(o.id))}>×</button></span>`):n`<span class="muted">${l("depCatNone")}</span>`}</div>
      ${s&&a?n`<div class="fields" data-cat-editor=${s.id}>
        <label class="fld">${l("catParent")}<select class="in" data-cat-parent @change=${o=>this.set({cat:{...a,parent:o.target.value}})}>
          <option value="" ?selected=${!a.parent}>${l("catNoParent")}</option>
          ${t.filter(o=>o.id!==s.id&&!o.parent_id).map(o=>n`<option value=${o.id} ?selected=${a.parent===o.id}>${o.name}</option>`)}
        </select></label>
        <label class="fld">${l("catDefaultPrio")}<select class="in" data-cat-prio @change=${o=>this.set({cat:{...a,prio:o.target.value}})}>
          <option value="" ?selected=${!a.prio}>${l("catNoPrio")}</option>
          ${e.priorities.filter(o=>o.active).map(o=>n`<option value=${o.id} ?selected=${a.prio===o.id}>${o.name}</option>`)}
        </select></label>
        <label class="fld">${l("catDomains")}<input class="in" dir="ltr" maxlength="400" data-cat-domains aria-invalid=${String(r)} placeholder="climate, fan" .value=${a.domains}
          @input=${o=>this.set({cat:{...a,domains:o.target.value}})} /><span>${l("catDomainsSub")}</span></label>
      </div>
      <div class="add"><sw-button size="sm" variant="primary" data-cat-save ?disabled=${this.busy||r}
        @click=${()=>void this.act(()=>g().patchCategory(s.id,{parent_id:a.parent||null,default_priority_id:a.prio||null,domains:i}),()=>this.set({cat:void 0}))}>${l("save")}</sw-button></div>`:p}
      <div class="add"><input class="in" maxlength="60" data-cat-new placeholder=${l("depCatAdd")} .value=${this.dr.category??""} @input=${o=>this.set({category:o.target.value})} />
        <sw-button size="sm" icon="plus" ?disabled=${this.busy||!(this.dr.category??"").trim()} data-cat-add @click=${()=>void this.act(()=>g().createCategory(e.id,(this.dr.category??"").trim()),()=>this.set({category:""}))}>${l("depMemberAdd")}</sw-button></div>
    </div>`}membersRow(){const e=this.dept,t=[...(this.directory?.users??[]).filter(s=>!e.members.some(a=>a.kind==="user"&&a.id===s.id)).map(s=>({v:`user:${s.id}`,label:s.name})),...(this.directory?.groups??[]).filter(s=>!e.members.some(a=>a.kind==="group"&&a.id===s.id)).map(s=>({v:`group:${s.id}`,label:`${s.name} (${l("depGroupTag")})`}))];return n`<div class="row stack"><span class="lbl">${l("depMembers")}${e.can_edit_members?p:n`<span class="muted">${l("depMembersLocked")}</span>`}</span>
      <div class="people" data-dept-members>${e.members.length?ke(e.members,s=>`${s.kind}:${s.id}`,s=>n`<div class="person" data-member=${`${s.kind}:${s.id}`}>
        <span class="who">${k(s.name)}${s.kind==="group"?n` <span class="tag">${l("depGroupTag")}</span>`:p}</span>
        <span class="seg" role="radiogroup" aria-label=${s.name}>${["manager","member"].map(a=>n`<button type="button" role="radio" aria-pressed=${String(s.role===a)} aria-checked=${String(s.role===a)} ?disabled=${this.busy||!e.can_edit_members||s.role===a} data-member-role=${a} @click=${()=>void this.act(()=>g().putMember(e.id,s.kind,s.id,a))}>${a==="manager"?l("depManager"):l("depMember")}</button>`)}</span>
        ${s.role==="manager"&&e.can_edit_members?n`<sw-toggle label=${l("depNotifyNew")} .checked=${s.notify_new} ?disabled=${this.busy} data-member-notify
          @change=${a=>void this.act(()=>g().putMember(e.id,s.kind,s.id,s.role,a.detail.checked))}></sw-toggle>`:p}
        ${e.can_edit_members?n`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteMember(e.id,s.kind,s.id))}>${l("depRemove")}</button>`:p}
      </div>`):n`<span class="muted">${l("depNoMembers")}</span>`}</div>
      ${e.can_edit_members?n`<div class="add">
        <select class="in" data-member-pick aria-label=${l("depMemberPick")} @change=${s=>this.set({member:s.target.value})}>
          <option value="" ?selected=${!this.dr.member}>${l("depMemberPick")}</option>
          ${t.map(s=>n`<option value=${s.v} ?selected=${this.dr.member===s.v}>${s.label}</option>`)}
        </select>
        <select class="in" data-member-new-role aria-label=${l("depMembers")} @change=${s=>this.set({role:s.target.value})}>
          <option value="member" ?selected=${(this.dr.role??"member")==="member"}>${l("depMember")}</option>
          <option value="manager" ?selected=${this.dr.role==="manager"}>${l("depManager")}</option>
        </select>
        <sw-button size="sm" icon="plus" ?disabled=${this.busy||!this.dr.member} data-member-add @click=${()=>{const[s,...a]=(this.dr.member??"").split(":");this.act(()=>g().putMember(e.id,s,a.join(":"),this.dr.role??"member"),()=>this.set({member:""}))}}>${l("depMemberAdd")}</sw-button>
      </div>`:p}</div>`}prioritiesCard(){const e=this.dept;return n`<sw-card heading=${l("depPriorities")} data-card="dept-priorities">
      ${e.priorities.map(t=>n`<div class="row" data-prio=${t.key}>
        <span class="end start">
          <input class="in" maxlength="30" aria-label=${`${l("depPrioName")} · ${t.name}`} data-prio-name=${t.key} .value=${t.name}
            @change=${s=>{const a=s.target.value.trim();a&&a!==t.name&&this.act(()=>g().patchPriority(t.id,{name:a}))}} />
          <select class="in" aria-label=${`${l("depPrioSeverity")} · ${t.name}`} data-prio-severity=${t.key} ?disabled=${this.busy}
            @change=${s=>void this.act(()=>g().patchPriority(t.id,{notify_severity:s.target.value}))}>
            ${ya.map(s=>n`<option value=${s} ?selected=${t.severity===s}>${l(`sev_${s}`)}</option>`)}
          </select></span>
        <span class="end">
          ${t.is_default?n`<span class="tag ok" data-prio-default=${t.key}>${l("depDefault")}</span>`:n`<button type="button" class="rc" data-prio-make-default=${t.key} ?disabled=${this.busy||!t.active} @click=${()=>void this.act(()=>g().patchPriority(t.id,{is_default:!0}))}>${l("depMakeDefault")}</button>`}
          <sw-toggle label=${l("depPrioActive")} .checked=${t.active} ?disabled=${this.busy||t.is_default} data-prio-active=${t.key}
            @change=${s=>void this.act(()=>g().patchPriority(t.id,{active:s.detail.checked}))}></sw-toggle>
        </span></div>`)}
    </sw-card>`}policyCard(){const e=this.dept,t=e.overrides,s=this.inst,a=e.auto_close_after_days,i=this.dr.autoDays??String(a??3),r=t.link_sliding_days!==null||t.link_cap_days!==null||t.link_grace_hours!==null||this.dr.links!==void 0,d=ha(s.links,t),o=this.dr.links??{sliding:String(d.sliding_days),cap:String(d.cap_days),grace:String(d.grace_hours)},u=H(o.sliding,1,90),h=H(o.cap,7,365),$=H(o.grace,0,168),R=Number.isNaN(u)||Number.isNaN(h)||Number.isNaN($)?"range":h<u?"below_sliding":null,P=t.send_hours!==null||this.dr.hours!==void 0,T=this.dr.hours??t.send_hours??s.send_hours,ee=It(T.from,T.to),ce=t.urgent_is_critical;return n`<sw-card heading=${l("depPolicy")} data-card="dept-policy">
      <div class="row"><span class="lbl">${l("depHistory")}<span class="muted">${l("depHistorySub")}</span></span>
        <sw-toggle label=${l("depHistory")} labelHidden .checked=${e.share_history_external} ?disabled=${this.busy} data-dept-history
          @change=${m=>void this.patchDept({share_history_external:m.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${l("depAutoClose")}<span class="muted">${l("depAutoCloseSub")}</span></span>
        <span class="end">${a!==null?n`<span class="unit"><span class="muted">${l("depAutoCloseDays")}</span>
            <input class="in num" type="number" min="1" max="30" data-dept-autoclose-days aria-label=${l("depAutoCloseDays")} aria-invalid=${String(Number.isNaN(H(i,1,30)))} .value=${i}
              @input=${m=>this.set({autoDays:m.target.value})} />
            <sw-button size="sm" ?disabled=${this.busy||Number(i)===a||Number.isNaN(H(i,1,30))} data-dept-autoclose-save
              @click=${()=>void this.patchDept({auto_close_after_days:Number(i)},()=>this.set({autoDays:void 0}))}>${l("save")}</sw-button></span>`:p}
          <sw-toggle label=${l("depAutoClose")} labelHidden .checked=${a!==null} ?disabled=${this.busy} data-dept-autoclose
            @change=${m=>void this.patchDept({auto_close_after_days:m.detail.checked?Number.isNaN(H(i,1,30))?3:Number(i):null},()=>this.set({autoDays:void 0}))}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${l("depUrgent")}</span>
        <span class="seg" role="radiogroup" aria-label=${l("depUrgent")}>${[null,!0,!1].map(m=>n`<button type="button" role="radio"
          aria-pressed=${String(ce===m)} aria-checked=${String(ce===m)} ?disabled=${this.busy} data-dept-urgent=${m===null?"inherit":String(m)}
          @click=${()=>ce!==m&&void this.patchDept({urgent_is_critical:m})}>${m===null?l("depUrgentInherit",{v:s.urgent_is_critical?l("yes"):l("no")}):m?l("yes"):l("no")}</button>`)}</span></div>
      <div class="row stack" data-dept-links-row><span class="lbl">${l("depLinks")}<span class="muted">${l("depLinksSub",{s:s.links.sliding_days,c:s.links.cap_days,g:s.links.grace_hours})}</span></span>
        <div class="add"><sw-toggle label=${l("depOwn")} .checked=${r} ?disabled=${this.busy} data-dept-links-own
          @change=${m=>{m.detail.checked?this.set({links:{sliding:String(d.sliding_days),cap:String(d.cap_days),grace:String(d.grace_hours)}}):this.patchDept({link_sliding_days:null,link_cap_days:null,link_grace_hours:null},()=>this.set({links:void 0}))}}></sw-toggle></div>
        ${r?n`<div class="fields">
          <label class="fld">${l("setLinksSliding")} (${l("unit_d")})<input class="in num" type="number" min="1" max="90" data-dept-link="sliding" aria-invalid=${String(Number.isNaN(u)||R==="below_sliding")} .value=${o.sliding} @input=${m=>this.set({links:{...o,sliding:m.target.value}})} /></label>
          <label class="fld">${l("setLinksCap")} (${l("unit_d")})<input class="in num" type="number" min="7" max="365" data-dept-link="cap" aria-invalid=${String(Number.isNaN(h)||R==="below_sliding")} .value=${o.cap} @input=${m=>this.set({links:{...o,cap:m.target.value}})} /></label>
          <label class="fld">${l("setLinksGrace")} (${l("unit_h")})<input class="in num" type="number" min="0" max="168" data-dept-link="grace" aria-invalid=${String(Number.isNaN($))} .value=${o.grace} @input=${m=>this.set({links:{...o,grace:m.target.value}})} /></label>
        </div>
        <div class="add"><sw-button size="sm" variant="primary" data-dept-links-save ?disabled=${this.busy||!!R||!this.dr.links}
          @click=${()=>void this.patchDept({link_sliding_days:u,link_cap_days:h,link_grace_hours:$},()=>this.set({links:void 0}))}>${l("save")}</sw-button>
          ${R&&this.dr.links?n`<span class="field-error">${l(`err_${R}`)}</span>`:p}</div>`:p}
      </div>
      <div class="row stack" data-dept-hours-row><span class="lbl">${l("depHours")}<span class="muted">${l("depHoursSub",{from:s.send_hours.from,to:s.send_hours.to})}</span></span>
        <div class="add"><sw-toggle label=${l("depOwn")} .checked=${P} ?disabled=${this.busy} data-dept-hours-own
          @change=${m=>{m.detail.checked?this.set({hours:{...t.send_hours??s.send_hours}}):this.patchDept({send_hours:null},()=>this.set({hours:void 0}))}}></sw-toggle></div>
        ${P?n`<div class="add">
          <input class="in time" type="time" lang=${be()} data-dept-hours="from" aria-label=${l("depHours")} aria-invalid=${String(!!ee)} .value=${T.from} @input=${m=>this.set({hours:{...T,from:m.target.value}})} />
          <span class="muted">${l("hoursTo")}</span>
          <input class="in time" type="time" lang=${be()} data-dept-hours="to" aria-label=${`${l("depHours")} · ${l("hoursTo")}`} aria-invalid=${String(!!ee)} .value=${T.to} @input=${m=>this.set({hours:{...T,to:m.target.value}})} />
          <sw-button size="sm" variant="primary" data-dept-hours-save ?disabled=${this.busy||!!ee||!this.dr.hours}
            @click=${()=>void this.patchDept({send_hours:{from:T.from,to:T.to}},()=>this.set({hours:void 0}))}>${l("save")}</sw-button>
          ${ee?n`<span class="field-error">${l(`err_${ee}`)}</span>`:p}
        </div>`:p}
      </div>
    </sw-card>`}openTpl(e){if(e&&this.tplOpen===e.id){this.tplOpen="",this.tplDraft=null;return}this.tplOpen=e?e.id:"new",this.tplDraft={name:e?.name??"",title:e?.title??"",body:e?.body??"",category_id:e?.category_id??"",priority_key:e?.priority_key??""}}tplForm(e){const t=this.tplDraft,s=r=>this.tplDraft={...t,...r},a={name:t.name.trim(),title:t.title.trim(),body:t.body.trim(),category_id:t.category_id||null,priority_key:t.priority_key||null},i=()=>{this.tplOpen="",this.tplDraft=null};return n`<div class="fields" data-tpl-form=${e?.id??"new"}>
        <label class="fld">${l("tplName")}<input class="in" maxlength="60" data-tpl-name .value=${t.name} @input=${r=>s({name:r.target.value})} /></label>
        <label class="fld">${l("tplTitle")}<input class="in" maxlength="120" data-tpl-title .value=${t.title} @input=${r=>s({title:r.target.value})} /></label>
        <label class="fld">${l("tplCategory")}<select class="in" data-tpl-category @change=${r=>s({category_id:r.target.value})}>
          <option value="" ?selected=${!t.category_id}>${l("tplAny")}</option>
          ${this.dept.categories.filter(r=>r.active).map(r=>n`<option value=${r.id} ?selected=${t.category_id===r.id}>${r.name}</option>`)}</select></label>
        <label class="fld">${l("tplPriority")}<select class="in" data-tpl-priority @change=${r=>s({priority_key:r.target.value})}>
          <option value="" ?selected=${!t.priority_key}>${l("tplAny")}</option>
          ${wa.map(r=>n`<option value=${r} ?selected=${t.priority_key===r}>${this.dept.priorities.find(d=>d.key===r)?.name??r}</option>`)}</select></label>
      </div>
      <label class="fld">${l("tplBody")}<textarea class="in" maxlength="4000" data-tpl-body .value=${t.body} @input=${r=>s({body:r.target.value})}></textarea></label>
      <div class="add">
        <sw-button size="sm" variant="primary" data-tpl-save ?disabled=${this.busy||!t.name.trim()}
          @click=${()=>void this.act(()=>e?g().patchTemplate(e.id,{...a,revision:e.revision}):g().createTemplate(this.dept.id,a),i)}>${l("save")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${i}>${l("cancel")}</sw-button>
        ${e?n`<span class="grow"></span><sw-button size="sm" variant="danger" data-tpl-delete ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteTemplate(e.id),i)}>${l("depRemove")}</sw-button>`:p}
      </div>`}templatesCard(){const e=this.dept.templates;return n`<sw-card heading=${l("tplCard")} data-card="dept-templates">
      <div class="stack">
        ${e.length?e.map(t=>n`<div class="tpl" data-tpl=${t.id}>
          <div class="tplhead"><span class="nm">${k(t.name)}</span>
            <span class="end"><sw-toggle label=${l("tplActive")} .checked=${t.active} ?disabled=${this.busy} data-tpl-active
              @change=${s=>void this.act(()=>g().patchTemplate(t.id,{active:s.detail.checked,revision:t.revision}))}></sw-toggle>
              <sw-button size="sm" variant="ghost" data-tpl-edit @click=${()=>this.openTpl(t)}>${l("depEdit")}</sw-button></span></div>
          ${this.tplOpen===t.id&&this.tplDraft?this.tplForm(t):t.title?n`<span class="muted">${t.title}</span>`:p}
        </div>`):n`<span class="muted">${l("tplNone")}</span>`}
        ${this.tplOpen==="new"&&this.tplDraft?n`<div class="tpl" data-tpl="new">${this.tplForm(null)}</div>`:n`<div class="add"><sw-button size="sm" icon="plus" data-tpl-new ?disabled=${this.busy||e.length>=50} @click=${()=>this.openTpl(null)}>${l("tplNew")}</sw-button></div>`}
      </div>
    </sw-card>`}render(){return this.dept?n`
      ${this.basicsCard()}
      ${this.policyCard()}
      <sw-card heading=${l("slaCard")} data-card="dept-sla"><tickets-sla-grid .dept=${this.dept}></tickets-sla-grid></sw-card>
      ${this.prioritiesCard()}
      ${this.templatesCard()}`:p}};K.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .danger {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px 12px;
      border-radius: var(--sw-r-md);
      background: var(--sw-danger-soft);
      font-size: var(--sw-fs-sm);
      overflow-wrap: anywhere;
    }
  `,re];de([E({attribute:!1})],K.prototype,"dept",2);de([E({attribute:!1})],K.prototype,"directory",2);de([E({attribute:!1})],K.prototype,"installation",2);de([c()],K.prototype,"dr",2);de([c()],K.prototype,"catSel",2);de([c()],K.prototype,"tplOpen",2);de([c()],K.prototype,"tplDraft",2);de([c()],K.prototype,"busy",2);de([c()],K.prototype,"deleting",2);K=de([I("tickets-dept-editor")],K);const ka=/^https:\/\/([a-z0-9.-]+)(\/[a-z][a-z0-9-]{1,31})?\/?$/,xa=/^[a-z0-9][a-z0-9_-]{0,31}$/;function ft(e,t="t"){const s=ka.exec(e.trim().toLowerCase());if(!s)return"";const a=s[2]??(xa.test(t)?`/${t}`:"/t");return`https://${s[1]}${a}/#…`}const Sa=/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/,Da=/^[+(]?[0-9][0-9 ()-]{5,24}$/;function jt(e){const t=e.trim();if(t==="")return!0;if(t.length>80)return!1;if(Sa.test(t))return!0;const s=(t.match(/[0-9]/g)??[]).length;return Da.test(t)&&s>=7&&s<=15}function qt(e){const t=e.trim();if(t==="")return!0;if(t.length>200||/[\s{}<>"'\\\u0000-\u001f\u007f]/.test(t))return!1;try{const s=new URL(t);return s.protocol==="https:"&&s.hostname!==""&&s.username===""&&s.password===""}catch{return!1}}function Ca(e,t){if(!jt(t.contact)||!qt(t.link))return null;const s={};return t.contact.trim()!==(e?.contact??"")&&(s.contact=t.contact.trim()),t.link.trim()!==(e?.link??"")&&(s.link=t.link.trim()),Object.keys(s).length?s:null}var Na=Object.defineProperty,Ta=Object.getOwnPropertyDescriptor,j=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ta(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Na(t,s,i),i};const Oa={base_url:"",trusted_proxy_cidrs:["172.30.32.0/23"],client_ip_header:"cf-connecting-ip",theme:"light",path_prefix:"support",legacy_t_paths:!0},Ea=["light","dark","auto"],Pa=["cf-connecting-ip","x-forwarded-for"];let L=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.doc=null,this.busy=!1,this.remote=!1,this.saveError="",this.health=null,this.org=null,this.privContact=null,this.privLink=null,this.address=null,this.cidrs=null,this.pathPrefix=null,this.months=null,this.probe=null,this.probing=!1,this.advanced=!1}connectedCallback(){super.connectedCallback(),this.loadHealth()}willUpdate(e){if(e.has("doc")){const t=e.get("doc");t&&this.doc&&t.revision!==this.doc.revision&&(this.org=null,this.address=null,this.cidrs=null,this.pathPrefix=null,this.months=null,this.loadHealth())}}async loadHealth(){try{this.health=await rt().health()}catch(e){e instanceof x&&e.status===403||(this.health=null)}}get pub(){return{...Oa,...this.doc?.public??{}}}save(e){this.dispatchEvent(new CustomEvent("save-doc",{detail:{patch:e},bubbles:!0,composed:!0}))}async runProbe(){if(!this.probing){this.probing=!0,this.probe=null;try{const e=this.address??this.pub.base_url;this.probe=await rt().probe(e===this.pub.base_url?void 0:e)}catch(e){this.dispatchEvent(new CustomEvent("notice",{detail:{error:_(e)},bubbles:!0,composed:!0}))}finally{this.probing=!1}}}probeLine(){const e=this.probe;if(!e)return p;const t=e.result==="reachable"&&(e.listener?.header_ok??!0),s=e.result==="wrong_answer"&&e.code==="not_routed"?"probe_not_routed":`probe_${e.result}`,a=[Rt.includes(s)?l(s):l("probe_unreachable")];return e.result==="reachable"&&e.listener&&!e.listener.seen&&a.push(l("probe_not_seen")),e.result==="reachable"&&e.listener&&e.listener.seen&&!e.listener.header_ok&&a.push(l("probe_header_missing")),n`<div class=${`probe ${t?"ok":"bad"}`} role="status" data-probe-result=${e.result}>${a.join(" · ")}</div>`}stateRow(){const e=this.health,t=e?.missing??[];return n`<div class="row"><span class="lbl">${l("pubStatus")}</span>
      <span class="state" data-public-state=${t.length?"missing":e?"ready":"unknown"}>
        ${e&&!t.length?n`<span class="tag ok">${l("pubReady")}</span>`:p}
        ${t.map(s=>n`<span class="tag warn" data-missing=${s}>${l(`pubMissing_${s}`)}</span>`)}
        ${e?n`<span class="tag" data-links-live>${l("pubLiveLinks",{n:e.links.live})}</span>`:p}
        ${e&&e.links.live_staff?n`<span class="tag" data-links-live-staff>${l("pubLiveStaff",{n:e.links.live_staff})}</span>`:p}
      </span></div>`}portalRows(){const e={enabled:!1,closed_months:2,require_confirmed_number:!0,rfqs:!1,technician_requests:!1,...this.doc?.vendor_portal??{}},t=this.months??String(e.closed_months),s=Number(t),a=Number.isInteger(s)&&s>=1&&s<=24,i=(r,d,o)=>n`<div class="row"><span class="lbl">${d}</span>
      <span class="seg" role="radiogroup" aria-label=${d}>${[!0,!1].map(u=>n`<button type="button" role="radio"
        aria-checked=${String(e[r]===u)} aria-pressed=${String(e[r]===u)} data-vp=${o} data-on=${String(u)} ?disabled=${this.busy}
        @click=${()=>{e[r]!==u&&this.save({vendor_portal:{[r]:u}})}}>${l(u?"vpOn":"vpOff")}</button>`)}</span></div>`;return n`${i("enabled",l("vpLabel"),"enabled")}
      <div class="hint" data-vp-note>${l("vpNote")}</div>
      <div class="row stack"><span class="lbl">${l("vpMonths")}</span>
        <div class="line"><input class="in" type="number" min="1" max="24" step="1" inputmode="numeric" data-vp-months aria-label=${l("vpMonths")}
          .value=${t} @input=${r=>this.months=r.target.value} />
          <sw-button size="sm" variant="primary" data-vp-months-save ?disabled=${this.busy||!a||s===e.closed_months}
            @click=${()=>this.save({vendor_portal:{closed_months:s}})}>${l("save")}</sw-button></div></div>
      ${i("require_confirmed_number",l("vpConfirmed"),"confirmed")}
      <div class="hint" data-vp-confirmed-note>${l("vpConfirmedNote")}</div>
      ${i("rfqs",l("vpRfqs"),"rfqs")}
      <div class="hint" data-vp-rfqs-note>${l("vpRfqsNote")}</div>
      ${i("technician_requests",l("vpTechs"),"techs")}
      <div class="hint" data-vp-techs-note>${l("vpTechsNote")}</div>`}render(){const e=this.pub,t=this.org??this.doc?.organization_name??"",s=this.address??e.base_url,a=this.doc?.privacy,i=this.privContact??a?.contact??"",r=this.privLink??a?.link??"",d=jt(i)&&qt(r),o=Ca(a,{contact:i,link:r}),u=this.pathPrefix??e.path_prefix??"support",h=/^https:\/\/[^/]+\/[^/]/.test(s.trim()),$=this.health?.links.live??0,R=u.trim().replace(/^\//,""),P=R!==(e.path_prefix??"support"),T=/^\/?(?:t|[a-z0-9][a-z0-9_-]{1,31})$/.test(u.trim()),ee=this.cidrs??e.trusted_proxy_cidrs.join(`
`),ce=ee.split(/[\s,]+/).map(m=>m.trim()).filter(Boolean);return n`<sw-card heading=${l("pubCard")} subheading=${l("pubSub")} data-card="public">
      ${this.stateRow()}
      <div class="row stack"><span class="lbl">${l("pubOrg")}</span>
        <div class="line"><input class="in" maxlength="80" data-public-org aria-label=${l("pubOrg")} .value=${t} @input=${m=>this.org=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-org-save ?disabled=${this.busy||t.trim()===(this.doc?.organization_name??"")}
            @click=${()=>this.save({organization_name:t.trim()})}>${l("save")}</sw-button></div></div>
      <div class="row stack"><span class="lbl">${l("pubPrivContact")}</span>
        <div class="line"><input class="in" dir="ltr" maxlength="80" autocomplete="off" data-public-priv-contact aria-label=${l("pubPrivContact")} .value=${i}
          @input=${m=>this.privContact=m.target.value} /></div>
        <span class="lbl">${l("pubPrivLink")}</span>
        <div class="line"><input class="in" type="url" dir="ltr" maxlength="200" inputmode="url" autocomplete="off" data-public-priv-link aria-label=${l("pubPrivLink")} .value=${r}
          @input=${m=>this.privLink=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-priv-save ?disabled=${this.busy||!d||o===null}
            @click=${()=>{o&&this.save({privacy:o})}}>${l("save")}</sw-button></div>
        <div class="hint" data-public-priv-note>${l("pubPrivNote")}</div>
        ${d?p:n`<div class="probe bad" role="alert" data-public-priv-bad>${l("pubPrivBad")}</div>`}</div>
      <div class="row"><span class="lbl">${l("pubTheme")}</span>
        <span class="seg" role="radiogroup" aria-label=${l("pubTheme")}>${Ea.map(m=>n`<button type="button" role="radio"
          aria-checked=${String(e.theme===m)} aria-pressed=${String(e.theme===m)} data-public-theme=${m} ?disabled=${this.busy}
          @click=${()=>{e.theme!==m&&this.save({public:{theme:m}})}}>${l(m==="light"?"pubThemeLight":m==="dark"?"pubThemeDark":"pubThemeAuto")}</button>`)}</span></div>
      <div class="hint" data-public-theme-note>${l("pubThemeNote")}</div>
      ${this.portalRows()}
      <div class="row stack"><span class="lbl">${l("pubAddress")}</span>
        <div class="line"><input class="in" type="url" dir="ltr" maxlength="300" inputmode="url" autocomplete="off" data-public-address aria-label=${l("pubAddress")}
          placeholder=${l("pubAddressHint")} ?readonly=${this.remote} .value=${s} @input=${m=>{this.address=m.target.value,this.probe=null}} />
          <sw-button size="sm" variant="primary" data-public-address-save ?disabled=${this.busy||this.remote||s.trim()===e.base_url}
            @click=${()=>this.save({public:{base_url:s.trim()}})}>${l("save")}</sw-button>
          <sw-button size="sm" data-public-probe ?disabled=${this.probing||this.remote||!s.trim()} @click=${()=>void this.runProbe()}>${this.probing?"…":l("pubProbe")}</sw-button></div>
        <div class="hint" data-public-address-note>${l("pubAddressNote")}</div>
        ${ft(s,u.trim().replace(/^\//,""))?n`<div class="hint" dir="ltr" data-public-sample>${l("pubSampleLink",{url:ft(s,u.trim().replace(/^\//,""))})}</div>`:p}
        ${this.remote?n`<div class="hint" data-public-local-only>${l("pubLocalOnly")}</div>`:p}
        ${this.saveError?n`<div class="probe bad" role="alert" data-public-save-error>${this.saveError}</div>`:p}
        ${this.probe?this.probeLine():p}</div>
      <div class="row stack"><span class="lbl">${l("pubPrefix")}</span>
        <div class="line"><input class="in" dir="ltr" maxlength="33" autocomplete="off" data-public-prefix aria-label=${l("pubPrefix")} ?readonly=${this.remote||h}
          .value=${u} @input=${m=>this.pathPrefix=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-prefix-save ?disabled=${this.busy||this.remote||!T||h||!P}
            @click=${()=>this.save({public:{path_prefix:R,...$>0?{confirm_live_links:!0}:{}}})}>${l("save")}</sw-button></div>
        <div class="hint" data-public-prefix-step>${l("pubPrefixStep")}</div>
        <div class="hint" data-public-prefix-note>${l("pubPrefixNote",{p:T?u.trim().replace(/^\//,""):"support"})}</div>
        ${P&&T&&$>0?n`<div class="probe bad" role="alert" data-public-prefix-live>${l("pubPrefixLive",{n:$})}</div>`:p}
        ${h?n`<div class="hint" data-public-prefix-address>${l("pubPrefixAddress")}</div>`:p}
        ${T?p:n`<div class="probe bad" role="alert" data-public-prefix-bad>${l("pubPrefixBad")}</div>`}</div>
      <div class="row"><button type="button" class="fold" aria-expanded=${String(this.advanced)} aria-controls="public-advanced" data-public-advanced
        @click=${()=>this.advanced=!this.advanced}>${l("pubAdvanced")}</button></div>
      ${this.advanced?n`<div id="public-advanced" data-public-advanced-body>
        <div class="row stack"><span class="lbl">${l("pubTrusted")}</span>
          <textarea class="in" dir="ltr" rows="3" data-public-cidrs aria-label=${l("pubTrusted")} ?readonly=${this.remote} .value=${ee} @input=${m=>this.cidrs=m.target.value}></textarea>
          <div class="foot"><sw-button size="sm" variant="primary" data-public-cidrs-save ?disabled=${this.busy||this.remote||ce.length>8||ce.join(",")===e.trusted_proxy_cidrs.join(",")}
            @click=${()=>this.save({public:{trusted_proxy_cidrs:ce}})}>${l("save")}</sw-button></div></div>
        <div class="row"><span class="lbl">${l("pubClientHeader")}</span>
          <span class="seg" role="radiogroup" aria-label=${l("pubClientHeader")}>${Pa.map(m=>n`<button type="button" role="radio" dir="ltr"
            aria-checked=${String(e.client_ip_header===m)} aria-pressed=${String(e.client_ip_header===m)} data-public-header=${m} ?disabled=${this.busy||this.remote}
            @click=${()=>this.save({public:{client_ip_header:m}})}>${m}</button>`)}</span></div>
        <div class="row"><span class="lbl">${l("pubLegacyT")}</span>
          <span class="seg" role="radiogroup" aria-label=${l("pubLegacyT")}>${[!0,!1].map(m=>n`<button type="button" role="radio"
            aria-checked=${String((e.legacy_t_paths??!0)===m)} aria-pressed=${String((e.legacy_t_paths??!0)===m)} data-public-legacy=${String(m)} ?disabled=${this.busy||this.remote}
            @click=${()=>{(e.legacy_t_paths??!0)!==m&&this.save({public:{legacy_t_paths:m}})}}>${l(m?"pubLegacyOn":"pubLegacyOff")}</button>`)}</span></div>
        <div class="hint" data-public-legacy-note>${l("pubLegacyTNote")}</div>
      </div>`:p}
    </sw-card>`}};L.styles=[X,Z,Y`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
    .line .in {
      flex: 1 1 220px;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .state {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .probe {
      font-size: var(--sw-fs-sm);
    }
    .probe.ok {
      color: var(--sw-success-text);
    }
    .probe.bad {
      color: var(--sw-warning-text);
    }
    .fold {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 36px;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .fold::before {
      content: '▸';
    }
    .fold:dir(rtl)::before {
      content: '◂';
    }
    .fold[aria-expanded='true']::before {
      content: '▾';
    }
    textarea.in {
      font-family: var(--sw-font-mono);
    }
  `,re];j([E({attribute:!1})],L.prototype,"doc",2);j([E({type:Boolean})],L.prototype,"busy",2);j([E({type:Boolean})],L.prototype,"remote",2);j([E({attribute:!1})],L.prototype,"saveError",2);j([c()],L.prototype,"health",2);j([c()],L.prototype,"org",2);j([c()],L.prototype,"privContact",2);j([c()],L.prototype,"privLink",2);j([c()],L.prototype,"address",2);j([c()],L.prototype,"cidrs",2);j([c()],L.prototype,"pathPrefix",2);j([c()],L.prototype,"months",2);j([c()],L.prototype,"probe",2);j([c()],L.prototype,"probing",2);j([c()],L.prototype,"advanced",2);L=j([I("tickets-public-card")],L);const za=400,gt=[6,0,1,2,3,4,5],at=[0,1,2,3,6],La=["calendar","working"],Ra=["wall","working"],He={enabled:!1,weekdays:[...at],start:"08:00",end:"17:00",days:{},holidays:[],hold_internal:!0,auto_close:"calendar",link_unopened:"wall",departments:{}},_e=/^([01]\d|2[0-3]):[0-5]\d$/,Aa=/^[0-6]$/;function Ut(e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return!1;const[s,a,i]=[Number(t[1]),Number(t[2]),Number(t[3])],r=new Date(Date.UTC(s,a-1,i));return r.getUTCFullYear()===s&&r.getUTCMonth()===a-1&&r.getUTCDate()===i}function Ha(){return{...He,weekdays:[...at],days:{},holidays:[],departments:{}}}function Ma(e){const t={};if(!e||typeof e!="object"||Array.isArray(e))return t;for(const[s,a]of Object.entries(e)){const i=a;Aa.test(s)&&i&&typeof i.start=="string"&&typeof i.end=="string"&&_e.test(i.start)&&_e.test(i.end)&&i.start<i.end&&(t[s]={start:i.start,end:i.end})}return t}function Ia(e){if(!e||typeof e!="object"||Array.isArray(e))return Ha();const t=e,a=Array.isArray(t.weekdays)&&t.weekdays.length>0&&t.weekdays.every(h=>Number.isInteger(h)&&h>=0&&h<=6)?[...new Set(t.weekdays)].sort((h,$)=>h-$):[...at],i=(h,$)=>typeof h=="string"&&_e.test(h)?h:$;let r=i(t.start,He.start),d=i(t.end,He.end);r>=d&&([r,d]=[He.start,He.end]);const o=Array.isArray(t.holidays)?[...new Set(t.holidays.filter(h=>typeof h=="string"&&Ut(h)))].sort():[],u=t.departments&&typeof t.departments=="object"&&!Array.isArray(t.departments)?t.departments:{};return{enabled:t.enabled===!0,weekdays:a,start:r,end:d,days:Ma(t.days),holidays:o,hold_internal:t.hold_internal!==!1,auto_close:t.auto_close==="working"?"working":"calendar",link_unopened:t.link_unopened==="working"?"working":"wall",departments:{...u}}}function Je(e){if(e.weekdays.length===0)return"weekdays";if(!_e.test(e.start)||!_e.test(e.end))return"time";if(e.start>=e.end)return"order";for(const t of Object.values(e.days)){if(!_e.test(t.start)||!_e.test(t.end))return"time";if(t.start>=t.end)return"order"}return null}function ja(e){if(e.enabled){const t=Je(e);if(t)return t;if(e.holidays.length>za)return"holidays_many"}for(const t of Object.keys(e.departments))if(it(e.departments[t])==="own"&&Je(nt(e,t)))return"dept";return null}function qa(e,t){return e.includes(t)?e.filter(s=>s!==t):[...e,t].sort((s,a)=>s-a)}function Ua(e,t){return e.days[String(t)]??{start:e.start,end:e.end}}function yt(e,t,s,a){const i={...e.days};return s===e.start&&a===e.end?delete i[String(t)]:i[String(t)]={start:s,end:a},{...e,days:i}}function wt(e,t,s){const a={};for(const[i,r]of Object.entries(e.days))(r.start!==t||r.end!==s)&&(a[i]=r);return{...e,start:t,end:s,days:a}}function it(e){return e?e.enabled===!1?"always":e.enabled===!0||e.weekdays||e.start||e.end||e.days?"own":"inherit":"inherit"}function nt(e,t){const s=e.departments[t];if(!s||it(s)!=="own")return{weekdays:e.weekdays,start:e.start,end:e.end,days:e.days};const a=s.weekdays||s.start||s.end||s.days;return{weekdays:s.weekdays??e.weekdays,start:s.start??e.start,end:s.end??e.end,days:a?s.days??{}:e.days}}function Ba(e,t,s){const a={...e.departments};if(s==="inherit")delete a[t];else if(s==="always")a[t]={enabled:!1};else{const i=nt({...e,departments:{}},t);a[t]={enabled:!0,weekdays:[...i.weekdays],start:i.start,end:i.end,days:{...i.days}}}return a}function Fa(e,t,s){return{...e.departments,[t]:{enabled:!0,weekdays:[...s.weekdays].sort((a,i)=>a-i),start:s.start,end:s.end,days:{...s.days}}}}function Ga(e){const t=new Set,s=[];for(const a of e.split(/[\s,;]+/).map(i=>i.trim()).filter(Boolean)){const i=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(a),r=i?`${i[3]}-${i[2].padStart(2,"0")}-${i[1].padStart(2,"0")}`:a;Ut(r)?t.add(r):s.push(a)}return{dates:[...t].sort(),bad:s}}function Wa(e){return e.join(`
`)}function Ka(e){return Object.fromEntries(Object.entries(e).sort(([t],[s])=>t.localeCompare(s)))}function Qe(e){return{enabled:e.enabled,weekdays:[...e.weekdays].sort((t,s)=>t-s),start:e.start,end:e.end,days:Ka(e.days),holidays:[...e.holidays].sort(),hold_internal:e.hold_internal,auto_close:e.auto_close,link_unopened:e.link_unopened,departments:e.departments}}function Va(e,t){return JSON.stringify(Qe(e))===JSON.stringify(Qe(t))}const Xa={card:"שעות עבודה",cardSub:"מתי נספרים הזמנים של {tickets} תקועות, איחורים ותזכורות",enabled:"ספירה לפי שעות עבודה",enabledSub:"כבוי: הזמנים נספרים ברציפות, בכל שעה ביממה",days:"ימי עבודה",hours:"שעות עבודה",hoursSub:"בשעון המקומי של המערכת",to:"עד",holidays:"ימי חופש וחגים",holidaysSub:"תאריך בכל שורה, למשל 21.10.2026. בימים האלה לא נספר זמן",holidaysCount:"{n} ימים",note:"הספירה חלה על זמני תקועה, איחור ותזכורות. שליחת הודעות לספקים ממשיכה לפי שעות השליחה שלהם",save:"שמירה",d0:"שני",d1:"שלישי",d2:"רביעי",d3:"חמישי",d4:"שישי",d5:"שבת",d6:"ראשון",err_weekdays:"יש לבחור לפחות יום עבודה אחד",err_time:"שעה לא תקינה",err_order:"שעת הסיום חייבת להיות אחרי שעת ההתחלה (אין משמרת חוצת חצות)",err_holidays_many:"עד 400 ימי חופש",err_bad_dates:"תאריך לא תקין: {list}",err_dept:"בדקו את שעות העבודה של המחלקות",holdInternal:"תזכורות והתראות מחוץ לשעות העבודה",holdInternalSub:"מופעל: תזכורת פנימית או התראה למנהלים שמגיעה מחוץ לשעות העבודה מחכה לפתיחה הבאה",autoClose:"סגירה אוטומטית של {ticket} שבוצעה",autoCloseSub:"ימים רגילים (כמו עד היום) או זמן עבודה: כל יום הוא אורך יום העבודה",ac_calendar:"ימים רגילים",ac_working:"זמן עבודה",linkClock:"קישור שלא נפתח אצל הספק",linkClockSub:"השעון של הספק: ברירת המחדל סופרת ברציפות ולא לפי שעות העבודה",lc_wall:"ברציפות",lc_working:"שעות עבודה",dayHours:"שעות לכל יום",dayHoursSub:"שנו את השעות של יום מסוים, למשל שישי קצר",depts:"שעות עבודה לפי מחלקה",deptsSub:"כמו ההגדרה הכללית, ברציפות, או שעות משלה",dm_inherit:"כללי",dm_always:"ברציפות",dm_own:"שעות משלה",deptMode:"שעות עבודה של {name}"},Ya={card:"Working hours",cardSub:"When the timers of stuck and overdue {tickets} and reminders count",enabled:"Count in working hours",enabledSub:"Off: timers run around the clock",days:"Working days",hours:"Working hours",hoursSub:"In the system's local time",to:"to",holidays:"Holidays and days off",holidaysSub:"One date per line, e.g. 2026-10-21. No time counts on these days",holidaysCount:"{n} days",note:"Applies to stuck, overdue and reminder timers. Messages to vendors still follow their send hours",save:"Save",d0:"Mon",d1:"Tue",d2:"Wed",d3:"Thu",d4:"Fri",d5:"Sat",d6:"Sun",err_weekdays:"Choose at least one working day",err_time:"Invalid time",err_order:"The end must be after the start (no shift across midnight)",err_holidays_many:"At most 400 days off",err_bad_dates:"Invalid date: {list}",err_dept:"Check the departments' working hours",holdInternal:"Reminders and alerts outside working hours",holdInternalSub:"On: an internal reminder or manager alert that falls outside working hours waits for the next opening",autoClose:"Automatic close of a finished {ticket}",autoCloseSub:"Calendar days (as before) or working time: each day is the length of the working day",ac_calendar:"Calendar days",ac_working:"Working time",linkClock:"Vendor link not opened",linkClockSub:"The vendor's clock: by default it counts around the clock, not working hours",lc_wall:"Around the clock",lc_working:"Working hours",dayHours:"Hours per day",dayHoursSub:"Change the hours of one day, for example a short Friday",depts:"Working hours per department",deptsSub:"Like the general setting, around the clock, or its own hours",dm_inherit:"General",dm_always:"Around the clock",dm_own:"Own hours",deptMode:"Working hours of {name}"};function Za(e,t=Ie()){return(t==="en"?Ya[e]:void 0)??Xa[e]}function w(e,t){const s=Ie(),a=At(Za(e,s),s);return t?a.replace(/\{(\w+)\}/g,(i,r)=>r in t?String(t[r]):i):a}var Ja=Object.defineProperty,Qa=Object.getOwnPropertyDescriptor,Pe=(e,t,s,a)=>{for(var i=a>1?void 0:a?Qa(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Ja(t,s,i),i};const ei=["inherit","always","own"];let $e=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.doc=null,this.busy=!1,this.draft=null,this.holidayText=null,this.departments=[]}connectedCallback(){super.connectedCallback(),g().departments().then(e=>this.departments=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))).catch(()=>{})}willUpdate(e){if(e.has("doc")){const t=e.get("doc");(!t||!this.doc||t.revision!==this.doc.revision)&&(this.draft=null,this.holidayText=null)}}get stored(){return Ia(this.doc?.calendar)}get cur(){return this.draft??this.stored}set(e){this.draft={...this.cur,...e}}save(e){const t={calendar:Qe(e)};this.dispatchEvent(new CustomEvent("save-doc",{detail:{patch:t},bubbles:!0,composed:!0}))}editor(e,t,s){const a=Je(e),i=(r,d,o,u)=>n`<input class="in time" type="time" lang=${be()} data-wc-time=${u} aria-label=${d}
      aria-invalid=${String(a==="order"||a==="time")} .value=${r} @input=${h=>o(h.target.value)} />`;return n`
      <div class="row stack"><span class="lbl">${w("days")}</span>
        <div class="days" role="group" aria-label=${w("days")}>${gt.map(r=>n`<button type="button" aria-pressed=${String(e.weekdays.includes(r))} data-wc-day=${`${s}${r}`}
          ?disabled=${this.busy} @click=${()=>t({...e,weekdays:qa(e.weekdays,r)})}>${w(`d${r}`)}</button>`)}</div></div>
      <div class="row"><span class="lbl">${w("hours")}<span class="muted">${w("hoursSub")}</span></span>
        <span class="times">${i(e.start,w("hours"),r=>t(wt(e,r,e.end)),`${s}start`)}
          <span class="muted">${w("to")}</span>
          ${i(e.end,`${w("hours")} · ${w("to")}`,r=>t(wt(e,e.start,r)),`${s}end`)}</span></div>
      <div class="row stack"><span class="lbl">${w("dayHours")}<span class="muted">${w("dayHoursSub")}</span></span>
        ${gt.filter(r=>e.weekdays.includes(r)).map(r=>{const d=Ua(e,r);return n`<div class="dayrow" data-wc-dayrow=${`${s}${r}`}><span class="dn">${w(`d${r}`)}</span>
            ${i(d.start,`${w(`d${r}`)}`,o=>t(yt(e,r,o,d.end)),`${s}d${r}start`)}
            <span class="muted">${w("to")}</span>
            ${i(d.end,`${w(`d${r}`)} · ${w("to")}`,o=>t(yt(e,r,d.start,o)),`${s}d${r}end`)}</div>`})}</div>`}seg(e,t,s,a,i,r,d){return n`<div class="row"><span class="lbl">${e}<span class="muted">${t}</span></span>
      <span class="seg" role="radiogroup" aria-label=${e}>${a.map(o=>n`<button type="button" role="radio" aria-pressed=${String(i===o)} aria-checked=${String(i===o)}
        data-wc-seg=${`${s}:${o}`} ?disabled=${this.busy} @click=${()=>d(o)}>${r(o)}</button>`)}</span></div>`}deptRows(e){return this.departments.length?n`<div class="row stack"><span class="lbl">${w("depts")}<span class="muted">${w("deptsSub")}</span></span>
      ${this.departments.map(t=>{const s=it(e.departments[t.id]);return n`<div class="nested" data-wc-dept=${t.id}>
          ${this.seg(t.name,"",`dept-${t.id}`,ei,s,a=>w(`dm_${a}`),a=>this.set({departments:Ba(e,t.id,a)}))}
          ${s==="own"?this.editor(nt(e,t.id),a=>this.set({departments:Fa(e,t.id,a)}),`dept-${t.id}-`):p}
        </div>`})}</div>`:p}render(){if(!this.doc)return p;const e=this.cur,t=this.holidayText??Wa(e.holidays),s=Ga(t),a={...e,holidays:s.dates},i=ja(a),r=!Va(a,this.stored),d=!!i||e.enabled&&s.bad.length>0;return n`<sw-card heading=${w("card")} subheading=${w("cardSub")} data-card="work-calendar">
      <div class="row"><span class="lbl">${w("enabled")}<span class="muted">${w("enabledSub")}</span></span>
        <sw-toggle label=${w("enabled")} labelHidden .checked=${e.enabled} ?disabled=${this.busy} data-wc-enabled
          @change=${o=>this.set({enabled:o.detail.checked})}></sw-toggle></div>
      ${e.enabled?n`
        ${this.editor(e,o=>this.set({weekdays:o.weekdays,start:o.start,end:o.end,days:o.days}),"")}
        <div class="row stack"><span class="lbl">${w("holidays")}<span class="muted">${w("holidaysSub")}</span></span>
          <textarea class="in" rows="4" dir="ltr" data-wc-holidays aria-label=${w("holidays")} aria-invalid=${String(s.bad.length>0||i==="holidays_many")}
            .value=${t} @input=${o=>this.holidayText=o.target.value}></textarea>
          <div class="hint" data-wc-holidays-count>${w("holidaysCount",{n:s.dates.length})}</div></div>
        <div class="row"><span class="lbl">${w("holdInternal")}<span class="muted">${w("holdInternalSub")}</span></span>
          <sw-toggle label=${w("holdInternal")} labelHidden .checked=${e.hold_internal} ?disabled=${this.busy} data-wc-hold
            @change=${o=>this.set({hold_internal:o.detail.checked})}></sw-toggle></div>
        ${this.seg(w("autoClose"),w("autoCloseSub"),"auto_close",La,e.auto_close,o=>w(o==="working"?"ac_working":"ac_calendar"),o=>this.set({auto_close:o}))}
        ${this.seg(w("linkClock"),w("linkClockSub"),"link_unopened",Ra,e.link_unopened,o=>w(o==="working"?"lc_working":"lc_wall"),o=>this.set({link_unopened:o}))}`:p}
      ${this.deptRows(e)}
      ${i?n`<div class="row"><span class="field-error" role="alert" data-wc-error=${i}>${w(`err_${i}`)}</span></div>`:p}
      ${e.enabled&&s.bad.length?n`<div class="row"><span class="field-error" role="alert" data-wc-error="bad_dates">${w("err_bad_dates",{list:s.bad.slice(0,5).join(", ")})}</span></div>`:p}
      <div class="row"><span class="hint">${w("note")}</span></div>
      <div class="foot"><sw-button variant="primary" size="sm" data-wc-save ?disabled=${!r||d||this.busy}
        @click=${()=>this.save(a)}>${w("save")}</sw-button></div>
    </sw-card>`}};$e.styles=[X,Z,Y`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .days {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .days button {
      min-block-size: var(--sw-touch-desktop);
      min-inline-size: 56px;
      padding-inline: 12px;
      border: 1px solid var(--dv-border, var(--sw-border-strong));
      border-radius: var(--dv-radius-control, var(--sw-r-sm));
      background: var(--dv-surface-2, var(--sw-surface));
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .days button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .days button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .times {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .dayrow {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      min-block-size: 44px;
    }
    .dayrow .dn {
      min-inline-size: 64px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .nested {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding-inline-start: 16px;
      border-inline-start: 2px solid var(--dv-border, var(--sw-border));
    }
    /* GATE-FIX-2270: a department's mode row already sits inside the departments well (R5-SYSTEM-297 made every .row a well):
       no second well around it, and its three keys (now 16/600) move under the department's name when the row is too narrow,
       instead of being cut (320 px) or leaving the well (1024 px) */
    .nested .row {
      flex-wrap: wrap;
      padding-inline: 0;
      background: transparent;
    }
    @media (max-width: 767px) {
      .nested {
        padding-inline-start: 10px;
      }
      .nested .seg button {
        padding-inline: 8px;
      }
    }
    textarea.in {
      inline-size: 100%;
      box-sizing: border-box;
      font-family: var(--sw-font-mono);
      direction: ltr;
      text-align: start;
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .field-error {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
  `,re];Pe([E({attribute:!1})],$e.prototype,"doc",2);Pe([E({type:Boolean})],$e.prototype,"busy",2);Pe([c()],$e.prototype,"draft",2);Pe([c()],$e.prototype,"holidayText",2);Pe([c()],$e.prototype,"departments",2);$e=Pe([I("tickets-work-calendar-card")],$e);const Bt={title:"דוחות לספקים",toContacts:"שליחת דוחות לאנשי קשר חיצוניים",email:"שליחה גם במייל",documents:"מסמך בקישור זמני",hours:"תוקף הקישור",hoursUnit:"שעות",opens:"הורדות לקישור",opensUnit:"פעמים",save:"שמירה",saved:"נשמר",failed:"השמירה נכשלה"},ti={title:"Reports to vendors",toContacts:"Send reports to external contacts",email:"Also send by e-mail",documents:"Document by temporary link",hours:"Link validity",hoursUnit:"hours",opens:"Downloads per link",opensUnit:"times",save:"Save",saved:"Saved",failed:"Saving failed"},si={title:"التقارير إلى الموردين",toContacts:"إرسال التقارير إلى جهات اتصال خارجية",email:"الإرسال أيضًا بالبريد الإلكتروني",documents:"مستند برابط مؤقت",hours:"مدة صلاحية الرابط",hoursUnit:"ساعة",opens:"عدد التنزيلات لكل رابط",opensUnit:"مرات",save:"حفظ",saved:"تم الحفظ",failed:"فشل الحفظ"},ai={title:"Отчёты поставщикам",toContacts:"Отправка отчётов внешним контактам",email:"Отправлять также по e-mail",documents:"Документ по временной ссылке",hours:"Срок действия ссылки",hoursUnit:"ч",opens:"Загрузок на ссылку",opensUnit:"раз",save:"Сохранить",saved:"Сохранено",failed:"Не удалось сохранить"};function ii(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const ni={he:Bt,en:ti,ar:si,ru:ai};function me(e,t=ii()){return ni[t][e]??Bt[e]??e}const _t={document_hours:72,document_max_opens:5},Ft={document_hours:[1,168],document_max_opens:[1,20]};function ri(e){return!e||typeof e!="object"?null:{to_contacts:e.to_contacts===!0,email:e.email===!0,documents:e.documents===!0,document_hours:Number.isInteger(e.document_hours)?e.document_hours:_t.document_hours,document_max_opens:Number.isInteger(e.document_max_opens)?e.document_max_opens:_t.document_max_opens}}function Gt(e,t){if(!/^\d{1,4}$/.test(e.trim()))return null;const s=Number(e),[a,i]=Ft[t];return s>=a&&s<=i?s:null}function li(e){return e.to_contacts}function di(e){return e.to_contacts&&e.documents}function kt(e,t,s){const a=Gt(s,t);return a===null||a===e[t]?null:{[t]:a}}var oi=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,je=(e,t,s,a)=>{for(var i=a>1?void 0:a?ci(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&oi(t,s,i),i};let xe=class extends M{constructor(){super(...arguments),this.doc=null,this.busy=!1,this.hoursDraft="",this.opensDraft=""}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}get current(){return ri(this.doc?.reports)}async load(){try{this.doc=await g().settings(),this.sync()}catch(e){e instanceof x&&(e.status===403||e.status===404)||this.notice({error:_(e)})}}sync(){const e=this.current;e&&(this.hoursDraft=String(e.document_hours),this.opensDraft=String(e.document_max_opens))}async save(e){if(!(!this.doc||this.busy)){this.busy=!0;try{this.doc=await g().saveInstallation(this.doc.revision,{reports:e}),this.sync(),this.notice({ok:me("saved")})}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}toggle(e,t,s,a,i){return n`<div class="row"><span class="lbl">${me(e)}</span>
      <sw-toggle label=${me(e)} labelHidden .checked=${s} ?disabled=${this.busy||a} data-reports=${i}
        @change=${r=>void this.save({[t]:r.detail.checked})}></sw-toggle></div>`}numberRow(e,t,s,a,i,r){const d=Gt(a,s)!==null,[o,u]=Ft[s],h=$=>s==="document_hours"?this.hoursDraft=$:this.opensDraft=$;return n`<div class="row"><span class="lbl">${me(e)}</span>
      <span class="end"><input class="in num short" type="number" min=${o} max=${u} .value=${a} ?disabled=${this.busy||r} data-reports=${s}
        aria-invalid=${String(!d)} aria-label=${me(e)} @input=${$=>h($.target.value)} />
        <span class="muted">${me(t)}</span>
        <sw-button size="sm" ?disabled=${this.busy||r||kt(i,s,a)===null} data-reports-save=${s}
          @click=${()=>{const $=kt(i,s,a);$&&this.save($)}}>${me("save")}</sw-button></span></div>`}render(){const e=this.current;if(!e)return p;const t=!li(e),s=!di(e);return n`<sw-card heading=${me("title")} data-card="reports-settings">
      ${this.toggle("toContacts","to_contacts",e.to_contacts,!1,"to_contacts")}
      ${this.toggle("email","email",e.email,t,"email")}
      ${this.toggle("documents","documents",e.documents,t,"documents")}
      ${this.numberRow("hours","hoursUnit","document_hours",this.hoursDraft,e,s)}
      ${this.numberRow("opens","opensUnit","document_max_opens",this.opensDraft,e,s)}
    </sw-card>`}};xe.styles=[X,Z,Y`
    :host { display: block; min-inline-size: 0; }
    input.in.short { inline-size: 6em; }
  `];je([c()],xe.prototype,"doc",2);je([c()],xe.prototype,"busy",2);je([c()],xe.prototype,"hoursDraft",2);je([c()],xe.prototype,"opensDraft",2);xe=je([I("tickets-reports-settings")],xe);var pi=Object.defineProperty,ui=Object.getOwnPropertyDescriptor,J=(e,t,s,a)=>{for(var i=a>1?void 0:a?ui(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&pi(t,s,i),i};const xt=[{key:"coalesce_min",label:"coalesce"},{key:"sender_per_day",label:"perDay"},{key:"sender_per_week",label:"perWeek"},{key:"installation_per_hour",label:"perHour"},{key:"installation_per_day",label:"perDayAll"},{key:"open_max",label:"openMax"},{key:"draft_ttl_days",label:"ttl"},{key:"rejected_keep_days",label:"keep"},{key:"block_days",label:"blockDays"},{key:"unlisted_reply_per_day",label:"unlistedPerDay"}],Te=5;let F=class extends M{constructor(){super(...arguments),this.doc=null,this.meta=null,this.busy=!1,this.drafts={},this.known=[],this.knownAllowed=!1,this.page=0,this.fName="",this.fPhone="",this.fOrg=""}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}get s(){return Fs(this.doc?.intake)}async load(){try{this.doc=await g().settings();const e=this.s;if(e){this.drafts=Object.fromEntries(xt.map(t=>[t.key,String(e[t.key])]));try{this.meta=await g().meta()}catch{}await this.loadKnown()}}catch(e){e instanceof x&&(e.status===403||e.status===404)||this.notice({error:_(e)})}}async loadKnown(){try{this.known=(await Ye.known()).known,this.knownAllowed=!0,this.page*Te>=this.known.length&&(this.page=Math.max(0,Math.ceil(this.known.length/Te)-1))}catch{this.known=[],this.knownAllowed=!1}}async save(e){if(!(!this.doc||this.busy)){this.busy=!0;try{this.doc=await g().saveInstallation(this.doc.revision,{intake:e}),this.notice({ok:C("saved")})}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}toggle(e,t,s,a=!1){return n`<div class="row"><span class="lbl">${C(e)}</span>
      <sw-toggle label=${C(e)} labelHidden .checked=${s} ?disabled=${this.busy||a} data-intake=${t}
        @change=${i=>void this.save({[t]:i.detail.checked})}></sw-toggle></div>`}numberRow(e,t,s,a){const i=this.drafts[e]??String(s[e]),r=Gs(i,e)!==null,[d,o]=Ws[e];return n`<div class="row"><span class="lbl">${C(t)}</span>
      <span class="end"><input class="in num short" type="number" min=${d} max=${o} .value=${i} ?disabled=${this.busy||a} data-intake-num=${e}
        aria-invalid=${String(!r)} aria-label=${C(t)} @input=${u=>this.drafts={...this.drafts,[e]:u.target.value}} />
        <sw-button size="sm" ?disabled=${this.busy||a||bt(s,e,i)===null} data-intake-save=${e}
          @click=${()=>{const u=bt(s,e,i);u&&this.save(u)}}>${C("saveSetting")}</sw-button></span></div>`}async addKnown(){if(!(this.busy||!this.fName.trim()||!vt(this.fPhone))){this.busy=!0;try{await Ye.addKnown({display_name:this.fName.trim(),phone:this.fPhone.trim(),org:this.fOrg.trim()}),this.fName=this.fPhone=this.fOrg="",await this.loadKnown(),this.notice({ok:C("added")})}catch(e){this.notice({error:e instanceof x&&e.status===409?C("alreadyListed"):_(e)})}finally{this.busy=!1}}}async removeKnown(e){if(!this.busy){this.busy=!0;try{await Ye.removeKnown(e),await this.loadKnown(),this.notice({ok:C("removed")})}catch(t){this.notice({error:_(t)}),await this.loadKnown()}finally{this.busy=!1}}}knownCard(){if(!this.knownAllowed)return p;const e=this.page*Te,t=this.known.slice(e,e+Te);return n`<sw-card heading=${C("knownTitle")} data-card="intake-known">
      <div class="addrow">
        <input data-known="name" maxlength="80" dir="auto" placeholder=${C("name")} aria-label=${C("name")} .value=${this.fName} @input=${s=>this.fName=s.target.value} />
        <input data-known="phone" type="tel" inputmode="tel" maxlength="24" dir="ltr" placeholder=${C("phone")} aria-label=${C("phone")} .value=${this.fPhone} @input=${s=>this.fPhone=s.target.value} />
        <input data-known="org" maxlength="80" dir="auto" placeholder=${C("org")} aria-label=${C("org")} .value=${this.fOrg} @input=${s=>this.fOrg=s.target.value} />
        <sw-button size="sm" variant="primary" data-known-add ?disabled=${this.busy||!this.fName.trim()||!vt(this.fPhone)} @click=${()=>void this.addKnown()}>${C("add")}</sw-button>
      </div>
      ${t.length?t.map(s=>n`<div class="row" data-known-row=${s.id}><span class="nm" dir="auto">${s.display_name}${s.org?` · ${s.org}`:""}</span>
        <bdi dir="ltr" class="muted">${s.phone_masked}</bdi>
        <sw-button size="sm" ?disabled=${this.busy} data-known-remove @click=${()=>void this.removeKnown(s)}>${C("remove")}</sw-button></div>`):n`<div class="muted" data-known-empty>${C("knownEmpty")}</div>`}
      ${this.known.length>Te?n`<div class="row"><sw-button size="sm" ?disabled=${this.page===0} @click=${()=>this.page-=1}>${C("prev")}</sw-button>
        <span class="muted">${e+1}-${e+t.length} ${C("of")} ${this.known.length}</span>
        <sw-button size="sm" ?disabled=${e+Te>=this.known.length} @click=${()=>this.page+=1}>${C("next")}</sw-button></div>`:p}
    </sw-card>`}render(){const e=this.s;if(!e)return p;const t=!Ks(e),s=this.meta?.departments??[];return n`<sw-card heading=${C("setTitle")} data-card="intake-settings">
      ${this.toggle("enabled","enabled",e.enabled)}
      ${this.toggle("whatsapp","whatsapp",e.whatsapp,t)}
      <div class="row"><span class="lbl">${C("defaultDept")}</span>
        <select class="in" data-intake="default_department" aria-label=${C("defaultDept")} ?disabled=${this.busy||t}
          @change=${a=>void this.save({default_department:a.target.value})}>
          <option value="">${C("pickDept")}</option>${s.map(a=>n`<option value=${a.id} ?selected=${a.id===e.default_department}>${a.name}</option>`)}</select></div>
      ${this.toggle("approvalReply","approval_reply",e.approval_reply,t)}
      ${this.toggle("unlistedReply","unlisted_reply",e.unlisted_reply,t)}
      <div class="row"><span class="lbl">${C("classifier")}</span>
        <sw-toggle label=${C("classifier")} labelHidden .checked=${e.classifier==="rules"} ?disabled=${this.busy||t} data-intake="classifier"
          @change=${a=>void this.save({classifier:a.detail.checked?"rules":"off"})}></sw-toggle></div>
      <div class="grid2">${xt.map(a=>this.numberRow(a.key,a.label,e,t))}</div>
    </sw-card>${this.knownCard()}`}};F.styles=[X,Z,Y`
    :host { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: 0; }
    input.in.short { inline-size: 6em; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--sw-s-4); }
    @media (max-width: 720px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
    .addrow { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: end; padding-block: var(--sw-s-2); }
    .addrow input, select.in { padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; }
    .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `];J([c()],F.prototype,"doc",2);J([c()],F.prototype,"meta",2);J([c()],F.prototype,"busy",2);J([c()],F.prototype,"drafts",2);J([c()],F.prototype,"known",2);J([c()],F.prototype,"knownAllowed",2);J([c()],F.prototype,"page",2);J([c()],F.prototype,"fName",2);J([c()],F.prototype,"fPhone",2);J([c()],F.prototype,"fOrg",2);F=J([I("tickets-intake-settings")],F);var hi=Object.defineProperty,mi=Object.getOwnPropertyDescriptor,ge=(e,t,s,a)=>{for(var i=a>1?void 0:a?mi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&hi(t,s,i),i};let ae=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.view=null,this.failed="",this.forbidden=!1,this.busy=!1,this.windowDraft="",this.showDepts=!1,this.fullPhones=null}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.view=await pe().channel(),this.windowDraft=String(this.view.whatsapp.reply_window_h),g().settings().then(e=>this.fullPhones=e.directory?!!e.directory.managers_full_phones:null).catch(()=>{})}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}async saveFullPhones(e){if(!this.busy){this.busy=!0;try{const t=await g().settings(),s=await g().saveInstallation(t.revision,{directory:{managers_full_phones:e}});this.fullPhones=!!s.directory?.managers_full_phones,this.notice({ok:v("saved")})}catch(t){this.notice({error:_(t)})}finally{this.busy=!1,this.load()}}}async save(e){const t=this.view;if(!(!t||this.busy)){this.busy=!0;try{this.view=await pe().saveChannel(t.revision,e),this.windowDraft=String(this.view.whatsapp.reply_window_h),this.notice({ok:v("saved")})}catch(s){this.notice({error:_(s)}),s instanceof x&&s.status===409&&await this.load()}finally{this.busy=!1}}}stateLabel(e){return v(`state_${e}`)||e}accountLabel(e){return e?this.view?.accounts.find(t=>t.key===e)?.label??e.replace(/^entry:/,"").slice(0,8):v("chUseNone")}warningText(e){switch(e.code){case"required_unmapped":return v("warn_required_unmapped");case"account_down":return v("warn_account_down",{state:this.stateLabel(e.state??"unknown")});case"shared_outside":return v("warn_shared_outside");case"shared_module":return v("warn_shared_module",{module:e.module??""});default:return e.code}}whatsappCard(e){const t=Number(this.windowDraft),s=Number.isInteger(t)&&t>=1&&t<=336;return n`<sw-card heading=${v("chCard")} data-card="channel-whatsapp">
      <div class="row"><span class="lbl">${v("chEnabled")}<span class="muted">${v("chEnabledSub")}</span></span>
        <sw-toggle label=${v("chEnabled")} labelHidden .checked=${e.whatsapp.enabled} ?disabled=${this.busy} data-channel-enabled
          @change=${a=>void this.save({whatsapp:{enabled:a.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${v("chButtons")}<span class="muted">${v("chButtonsSub")}</span></span>
        <sw-toggle label=${v("chButtons")} labelHidden .checked=${e.whatsapp.use_buttons} ?disabled=${this.busy} data-channel-buttons
          @change=${a=>void this.save({whatsapp:{use_buttons:a.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${v("chWindow")}</span>
        <span class="end"><input class="in num short" type="number" min="1" max="336" data-channel-window aria-invalid=${String(!s)} .value=${this.windowDraft}
          @input=${a=>this.windowDraft=a.target.value} /><span class="muted">${v("chWindowUnit")}</span>
          <sw-button size="sm" ?disabled=${this.busy||!s||t===e.whatsapp.reply_window_h} data-channel-window-save
            @click=${()=>void this.save({whatsapp:{reply_window_h:t}})}>${v("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${v("chEmail")}<span class="muted">${v("chEmailSub")}</span></span>
        <sw-toggle label=${v("chEmail")} labelHidden .checked=${e.email_fallback} ?disabled=${this.busy} data-channel-email
          @change=${a=>void this.save({email_fallback:a.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${v("chMailServer")}</span>
        <span class="val" data-mail-state=${e.email.configured?"ok":"missing"}>${e.email.configured?v("chMailOk"):v("chMailMissing")}</span></div>
      <div class="row"><span class="lbl">${l("otpSettingTitle")}<span class="muted">${l("otpSettingHint")}</span></span>
        <sw-toggle label=${l("otpSettingTitle")} labelHidden .checked=${!!e.phone_verify?.required} ?disabled=${this.busy} data-channel-phone-verify
          @change=${a=>void this.save({phone_verify:{required:a.detail.checked}})}></sw-toggle></div>
      ${this.fullPhones===null?p:n`<div class="row"><span class="lbl">${l("dmFullPhones")}<span class="muted">${l("dmFullPhonesHint")}</span></span>
        <sw-toggle label=${l("dmFullPhones")} labelHidden .checked=${this.fullPhones} ?disabled=${this.busy} data-channel-managers-full-phones
          @change=${a=>void this.saveFullPhones(a.detail.checked)}></sw-toggle></div>`}
    </sw-card>`}usesCard(e){const t=e.uses.find(s=>s.departments&&s.departments.length)?.departments??[];return n`<sw-card heading=${v("chUsesCard")} data-card="channel-uses">
      ${e.uses.map(s=>n`<div class="row" data-use=${s.key}><span class="lbl">${s.label}</span>
        <span class="val">${s.value?k(this.accountLabel(s.value)):s.inherits_label&&s.resolved?v("chUseInherit",{label:s.inherits_label}):k(this.accountLabel(s.resolved))}</span></div>`)}
      ${t.length?n`<div class="row"><span class="lbl">
          <button type="button" class="linkish" data-channel-depts aria-expanded=${String(this.showDepts)} @click=${()=>this.showDepts=!this.showDepts}>${v("chDepartments",{n:t.length})}</button></span></div>
        ${this.showDepts?t.map(s=>n`<div class="row" data-use-dept=${s.id}><span class="lbl">${k(s.name)}</span>
          <span class="val">${k(this.accountLabel(s.resolved))}</span></div>`):p}`:p}
      ${e.warnings.map(s=>n`<div class="warn" data-warning=${s.code} data-severity=${s.severity}>${this.warningText(s)}</div>`)}
      <div class="foot"><sw-button size="sm" variant="ghost" data-channel-manage @click=${()=>{window.location.hash=e.accounts_href||"#/system/messaging-accounts"}}>${v("chManage")}</sw-button></div>
    </sw-card>`}accountsCard(e){const t=e.accounts.filter(s=>s.ticket);return t.length?n`<sw-card heading=${v("chAccountsCard")} data-card="channel-accounts">
      ${t.map(s=>n`<div class="row" data-account=${s.key}>
        <span class="lbl">${k(s.label)}<span class="muted">${s.last_ok_at?v("chLastOk",{when:js(s.last_ok_at)}):v("chNeverOk")}
          · ${v("chToday",{n:s.sends_24h,max:s.per_day??"-"})}</span></span>
        <span class="chipstate" data-state=${s.state}>${this.stateLabel(s.state)}</span></div>`)}
    </sw-card>`:p}healthCard(e){const t=Object.values(e.health.outbox.depth).reduce((r,d)=>r+d,0),s=Object.values(e.health.inbound.last_24h).reduce((r,d)=>r+d,0),a=e.health.outbox.oldest_open_s,i=a==null?"-":a<3600?`${Math.max(1,Math.round(a/60))}′`:`${Math.round(a/3600)}h`;return n`<sw-card heading=${v("chHealthCard")} data-card="channel-health">
      <div class="nums">
        <div class="tile" data-health="waiting"><span class="muted">${v("chWaiting")}</span><b>${t}</b></div>
        <div class="tile" data-health="oldest"><span class="muted">${v("chOldest")}</span><b>${i}</b></div>
        <div class="tile" data-health="replies"><span class="muted">${v("chReplies")}</span><b>${s}</b></div>
        <div class="tile" data-health="listen"><span class="muted">${v("chReplyListen")}</span><b>${e.inbound.wanted?v("chOn"):v("chOff")}</b></div>
      </div>
    </sw-card>`}render(){if(this.forbidden)return n`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.view;return e?n`<div class="stack cols" data-channel-settings>${this.whatsappCard(e)}${this.usesCard(e)}${this.accountsCard(e)}${this.healthCard(e)}<tickets-reports-settings></tickets-reports-settings><tickets-intake-settings></tickets-intake-settings></div>`:n`<sw-state-panel state="loading"></sw-state-panel>`}};ae.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .chipstate {
      display: inline-flex;
      align-items: center;
      gap: var(--sw-s-1);
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      white-space: nowrap;
    }
    .chipstate[data-state='connected'] {
      color: var(--sw-success-text);
    }
    .chipstate[data-state='disconnected'],
    .chipstate[data-state='missing'] {
      color: var(--sw-danger-text);
    }
    .warn {
      display: flex;
      gap: var(--sw-s-2);
      align-items: flex-start;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .warn[data-severity='red'] {
      border-color: var(--sw-danger);
      color: var(--sw-danger-text);
    }
    .warn[data-severity='amber'] {
      border-color: var(--sw-warning);
    }
    .nums {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: var(--sw-s-2);
    }
    .tile {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .tile b {
      font-size: var(--sw-fs-lg);
    }
    input.in.short {
      inline-size: 6em;
    }
    .linkish {
      background: none;
      border: 0;
      padding: 0;
      font: inherit;
      color: var(--sw-accent-text);
      cursor: pointer;
    }
  `,re];ge([c()],ae.prototype,"view",2);ge([c()],ae.prototype,"failed",2);ge([c()],ae.prototype,"forbidden",2);ge([c()],ae.prototype,"busy",2);ge([c()],ae.prototype,"windowDraft",2);ge([c()],ae.prototype,"showDepts",2);ge([c()],ae.prototype,"fullPhones",2);ae=ge([I("tickets-channel-settings")],ae);var bi=Object.defineProperty,vi=Object.getOwnPropertyDescriptor,oe=(e,t,s,a)=>{for(var i=a>1?void 0:a?vi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&bi(t,s,i),i};let V=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.view=null,this.forbidden=!1,this.failed="",this.purpose="assign",this.tplLang="he",this.dept="",this.draft=null,this.preview=null,this.busy=!1,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.view=await pe().templates(),this.refreshPreview(this.current?.body??this.starter())}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}get current(){return this.view?.items.find(e=>e.purpose===this.purpose&&e.lang===this.tplLang&&(e.department_id??"")===this.dept)}starter(){return this.view?.starters[this.purpose]?.[this.tplLang]??this.view?.starters[this.purpose]?.he??""}choose(e){e.purpose&&(this.purpose=e.purpose),e.lang&&(this.tplLang=e.lang),e.dept!==void 0&&(this.dept=e.dept),this.draft=null,this.preview=null,this.refreshPreview(this.current?.body??this.starter())}onDraft(e){this.draft=e,window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.refreshPreview(e),350)}async refreshPreview(e){if(!e.trim()){this.preview=null;return}const t=++this.seq;try{const s=await pe().previewTemplate({purpose:this.purpose,lang:this.tplLang,body:e});t===this.seq&&(this.preview=s)}catch{t===this.seq&&(this.preview=null)}}insert(e){const t=this.renderRoot.querySelector("textarea"),s=this.draft??"",a=`{${e}}`;if(!t){this.onDraft(s+a);return}const i=t.selectionStart??s.length,r=s.slice(0,i)+a+s.slice(t.selectionEnd??i);this.onDraft(r),this.updateComplete.then(()=>{t.focus(),t.setSelectionRange(i+a.length,i+a.length)})}async act(e){if(!this.busy){this.busy=!0;try{await e(),this.view=await pe().templates(),this.draft=null,this.notice({ok:v("saved")}),this.refreshPreview(this.current?.body??this.starter())}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}save(){const e=this.draft??"",t=this.current;this.act(()=>t?pe().patchTemplate(t.id,{body:e,revision:t.revision}):pe().createTemplate({department_id:this.dept||null,purpose:this.purpose,lang:this.tplLang,body:e}))}problemText(e){return v(`tp_${e}`)||e}picker(e){return n`<div class="pick" data-template-picker>
      <label class="fld">${v("tplPurpose")}<select class="in" data-template-purpose @change=${t=>this.choose({purpose:t.target.value})}>
        ${e.purposes.map(t=>n`<option value=${t} ?selected=${t===this.purpose}>${mt(t)}</option>`)}</select></label>
      <span class="seg" role="radiogroup" aria-label=${v("tplLang")}>${e.langs.map(t=>n`<button type="button" role="radio" aria-pressed=${String(t===this.tplLang)}
        aria-checked=${String(t===this.tplLang)} data-template-lang=${t} @click=${()=>this.choose({lang:t})}>${v(`lang_${t}`)}</button>`)}</span>
      <label class="fld">${v("tplDept")}<select class="in" data-template-dept @change=${t=>this.choose({dept:t.target.value})}>
        <option value="" ?selected=${!this.dept}>${v("tplAllDepts")}</option>
        ${e.departments.map(t=>n`<option value=${t.id} ?selected=${t.id===this.dept}>${k(t.name)}</option>`)}</select></label>
    </div>`}editor(e){const t=this.current,s=this.draft??t?.body??this.starter(),a=this.draft!==null,i=this.tplLang==="he"||this.tplLang==="ar"?"rtl":"ltr",r=this.preview,d=a&&r?r.problems:[];return n`<sw-card heading=${`${mt(this.purpose)} · ${v(`lang_${this.tplLang}`)}`} data-card="template-editor"
        data-template-state=${t?t.active?"custom":"inactive":"starter"}>
      <div class="row"><span class="lbl"><span class="badge">${t?t.active?v("tplCustom"):v("tplInactive"):v("tplStarter")}</span></span>
        ${t&&!a?n`<sw-toggle label=${v("tplCustom")} labelHidden .checked=${t.active} ?disabled=${this.busy} data-template-active
          @change=${o=>void this.act(()=>pe().patchTemplate(t.id,{active:o.detail.checked,revision:t.revision}))}></sw-toggle>`:p}</div>
      ${a?n`<textarea class="in" dir=${i} maxlength="1500" data-template-body .value=${s}
            @input=${o=>this.onDraft(o.target.value)}></textarea>
          <div class="row"><span class="lbl">${v("tplFields")}</span></div>
          <div class="fields" data-template-fields>${e.placeholders.filter(o=>this.purpose==="code"?!e.rules.code_forbidden.includes(o):o!=="code").map(o=>n`<button type="button" data-field=${o} @click=${()=>this.insert(o)}>{${o}}</button>`)}</div>`:n`<div class="text" dir=${i} data-template-text>${s}</div>`}
      ${d.length?n`<ul class="problems" data-template-problems>${d.map(o=>n`<li data-problem=${o.code}>${this.problemText(o.code)}</li>`)}</ul>`:p}
      ${r&&r.text?n`<div class="row"><span class="lbl">${v("tplPreview")}<span class="muted">${v("tplLength",{n:r.length,max:r.max})}</span></span></div>
        <div class="text" dir=${i} data-template-preview>${r.text}</div>`:p}
      <div class="foot">
        ${a?n`<sw-button size="sm" variant="primary" data-template-save ?disabled=${this.busy||!s.trim()||d.length>0} @click=${()=>this.save()}>${v("save")}</sw-button>
          <sw-button size="sm" variant="ghost" data-template-cancel ?disabled=${this.busy} @click=${()=>{this.draft=null,this.refreshPreview(t?.body??this.starter())}}>${v("tplCancel")}</sw-button>`:n`<sw-button size="sm" data-template-edit ?disabled=${this.busy} @click=${()=>this.onDraft(s)}>${t?v("tplEdit"):v("tplNew")}</sw-button>
          ${t?n`<sw-button size="sm" variant="ghost" data-template-delete ?disabled=${this.busy} @click=${()=>void this.act(()=>pe().deleteTemplate(t.id))}>${v("tplDelete")}</sw-button>`:p}`}
      </div>
    </sw-card>`}render(){if(this.forbidden)return n`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.view;return e?n`<div class="stack" data-message-templates>${this.picker(e)}${this.editor(e)}</div>`:n`<sw-state-panel state="loading"></sw-state-panel>`}};V.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .pick {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2) var(--sw-s-3);
      align-items: center;
    }
    .pick select.in {
      min-inline-size: 10em;
    }
    .text {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.5;
    }
    textarea.in {
      inline-size: 100%;
      min-block-size: 9em;
      resize: vertical;
      box-sizing: border-box;
      font: inherit;
      line-height: 1.5;
    }
    .fields {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-1);
    }
    .fields button {
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 2px 8px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      direction: ltr;
    }
    .problems {
      margin: 0;
      padding-inline-start: 1.2em;
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .badge {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border);
      color: var(--sw-text-2);
    }
  `,re];oe([c()],V.prototype,"view",2);oe([c()],V.prototype,"forbidden",2);oe([c()],V.prototype,"failed",2);oe([c()],V.prototype,"purpose",2);oe([c()],V.prototype,"tplLang",2);oe([c()],V.prototype,"dept",2);oe([c()],V.prototype,"draft",2);oe([c()],V.prototype,"preview",2);oe([c()],V.prototype,"busy",2);V=oe([I("tickets-message-templates")],V);var $i=Object.defineProperty,fi=Object.getOwnPropertyDescriptor,ye=(e,t,s,a)=>{for(var i=a>1?void 0:a?fi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&$i(t,s,i),i};const gi={vat:["0","50"],window:["1","90"],max:["1","999999999"],flag:["0","999999999"],retention:["730","3650"]};let ie=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.doc=null,this.depts=null,this.failed="",this.forbidden=!1,this.busy=!1,this.drafts={},this.deptWindow={}}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.doc=await Ue().settings(),this.drafts={}}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e);return}try{this.depts=await Ue().departments(),this.deptWindow={}}catch{this.depts=null}}async save(e){const t=this.doc;if(!(!t||this.busy)){this.busy=!0;try{this.doc=await Ue().saveSettings(t.revision,e),this.drafts={},this.notice({ok:S("setSaved")})}catch(s){this.notice({error:_(s)}),s instanceof x&&s.status===409&&await this.load()}finally{this.busy=!1}}}async saveDept(e,t){if(!this.busy){this.busy=!0;try{this.depts=await Ue().saveDepartment(e.id,t);const s={...this.deptWindow};delete s[e.id],this.deptWindow=s,this.notice({ok:S("setSaved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}}shown(e,t){const s=this.drafts[e];if(s!==void 0)return s;switch(e){case"vat":return Zt(t.vat_rate_bp);case"window":return String(t.claim_window_days);case"max":return lt(t.max_claim_total_minor);case"flag":return lt(t.review_flag_above_minor);case"retention":return String(t.retention_days)}}current(e,t){switch(e){case"vat":return t.vat_rate_bp;case"window":return t.claim_window_days;case"max":return t.max_claim_total_minor;case"flag":return t.review_flag_above_minor;case"retention":return t.retention_days}}numRow(e,t,s,a=""){const i=this.shown(e,s),r=Jt(e,i),d={vat:"vat_rate_bp",window:"claim_window_days",max:"max_claim_total_minor",flag:"review_flag_above_minor",retention:"retention_days"}[e],[o,u]=gi[e];return n`<div class="row"><span class="lbl">${t}${a?n`<span class="muted">${a}</span>`:p}</span>
      <span class="end"><input class="in num" inputmode="decimal" dir="ltr" data-costs-field=${e} aria-invalid=${String(r===null)} .value=${i}
        @input=${h=>this.drafts={...this.drafts,[e]:h.target.value}} />
        <sw-button size="sm" data-costs-save=${e} ?disabled=${this.busy||r===null||r===this.current(e,s)}
          @click=${()=>r!==null&&void this.save({[d]:r})}>${S("save")}</sw-button></span>
      ${r===null?n`<span class="err" role="status">${S("rangeErr",{min:o,max:u})}</span>`:p}</div>`}modeSeg(e,t,s,a){const i=s?[null,...dt]:dt;return n`<span class="seg" role="radiogroup" aria-label=${S("setMode")}>${i.map(r=>n`<button type="button" role="radio" ?disabled=${this.busy}
      aria-checked=${String(e===r)} aria-pressed=${String(e===r)} data-costs-mode=${`${a}:${r??"default"}`}
      @click=${()=>t(r)}>${r?S(`m_${r}`):S("ctCostClaimDefault")}</button>`)}</span>`}installationCard(e){const t=Qt.filter(s=>!e.currencies.includes(s));return n`<sw-card heading=${S("setCard")} data-card="costs-installation">
      <div class="row"><span class="lbl">${S("setMode")}<span class="muted">${S("setModeSub")}</span></span>${this.modeSeg(e.mode,s=>{s&&this.save({mode:s})},!1,"installation")}</div>
      <div class="row"><span class="lbl">${S("setCurrency")}<span class="muted">${S("setCurrenciesHint")}</span></span>
        <span class="chipsrow" data-costs-currencies>${e.currencies.map((s,a)=>n`<button type="button" class="rc" aria-pressed="true" data-costs-currency=${s}
          ?disabled=${this.busy||e.currencies.length===1} title=${S("removeFile")}
          @click=${()=>void this.save({currencies:e.currencies.filter(i=>i!==s)})}>${a===0?n`<b>${s}</b>`:s}</button>`)}</span></div>
      ${t.length?n`<div class="row"><span class="lbl">${S("setMoreCurrencies")}</span>
        <span class="chipsrow">${ke(t,s=>s,s=>n`<button type="button" class="rc" aria-pressed="false" data-costs-add-currency=${s}
          ?disabled=${this.busy||e.currencies.length>=5} @click=${()=>void this.save({currencies:[...e.currencies,s]})}>${s}</button>`)}</span></div>`:p}
      ${this.numRow("vat",S("setVat"),e)}
      ${this.numRow("window",S("setWindow"),e)}
      <div class="row"><span class="lbl">${S("setRequireInvoice")}</span>
        <sw-toggle label=${S("setRequireInvoice")} labelHidden .checked=${e.require_invoice} ?disabled=${this.busy} data-costs-toggle="require_invoice"
          @change=${s=>void this.save({require_invoice:s.detail.checked})}></sw-toggle></div>
      ${this.numRow("max",S("setMax"),e,S("setAmountsHint"))}
      ${this.numRow("flag",S("setFlag"),e)}
      ${this.numRow("retention",S("setRetention"),e)}
    </sw-card>`}departmentsCard(e){return n`<sw-card heading=${S("setDeptCard")} subheading=${S("setDeptHint")} data-card="costs-departments">
      ${e.departments.filter(t=>t.active).map(t=>{const a=this.deptWindow[t.id]??(t.claim_window_days===null?"":String(t.claim_window_days)),i=a.trim()===""?null:/^\d{1,3}$/.test(a.trim())&&Number(a)>=1&&Number(a)<=90?Number(a):void 0;return n`<div class="row stack" data-costs-dept=${t.id}><span class="lbl">${k(t.name)}</span>
          <div class="line">${this.modeSeg(t.cost_claim,r=>void this.saveDept(t,{cost_claim:r,claim_window_days:t.claim_window_days}),!0,t.id)}
            <span class="end"><span class="muted">${S("setDeptWindow")}</span>
              <input class="in num" inputmode="numeric" dir="ltr" data-costs-dept-window=${t.id} placeholder=${String(e.installation.claim_window_days)} aria-invalid=${String(i===void 0)} .value=${a}
                @input=${r=>this.deptWindow={...this.deptWindow,[t.id]:r.target.value}} />
              <sw-button size="sm" data-costs-dept-save=${t.id} ?disabled=${this.busy||i===void 0||i===t.claim_window_days}
                @click=${()=>{i!==void 0&&this.saveDept(t,{cost_claim:t.cost_claim,claim_window_days:i})}}>${S("save")}</sw-button></span></div></div>`})}
    </sw-card>`}kindChips(e,t,s,a,i){const r=e??t;return n`<span class="chipsrow" role="group" aria-label=${Ne("kindsFold")} data-kinds-row=${s}>
      ${i?n`<button type="button" class="rc" aria-pressed=${String(e===null)} data-kinds-default=${s} ?disabled=${this.busy||e===null}
        @click=${()=>a(null)}>${Ne("kindsDefault")}</button>`:p}
      ${es.map(d=>n`<button type="button" class="rc" aria-pressed=${String(r.includes(d))} data-kind=${`${s}:${d}`}
        ?disabled=${this.busy||d==="labor"} title=${d==="labor"?Ne("kindsFixed"):""} @click=${()=>a(qs(r,d))}>${S(`k_${d}`)}</button>`)}
    </span>`}kindsCard(e){const t=e.allowed_line_kinds??["labor","parts"],s=this.depts;return n`<sw-card heading=${Ne("kindsFold")} subheading=${Ne("setKindsHint")} data-card="costs-kinds">
      <div class="row stack" data-kinds-installation><span class="lbl">${Ne("kindsInstallation")}</span>
        ${this.kindChips(t,t,"installation",a=>{a&&this.save({allowed_line_kinds:a})},!1)}</div>
      ${s?s.departments.filter(a=>a.active).map(a=>n`<div class="row stack" data-kinds-dept=${a.id}><span class="lbl">${k(a.name)}</span>
        ${this.kindChips(a.allowed_line_kinds??null,t,a.id,i=>void this.saveDept(a,{cost_claim:a.cost_claim,claim_window_days:a.claim_window_days,allowed_line_kinds:i}),!0)}</div>`):p}
    </sw-card>`}render(){if(this.forbidden)return n`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.doc;return e?n`<div class="stack cols" data-costs-settings>${this.installationCard(e.costs)}${this.depts?this.departmentsCard(this.depts):p}${this.kindsCard(e.costs)}</div>`:n`<sw-state-panel state="loading"></sw-state-panel>`}};ie.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .line {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
  `,re];ye([c()],ie.prototype,"doc",2);ye([c()],ie.prototype,"depts",2);ye([c()],ie.prototype,"failed",2);ye([c()],ie.prototype,"forbidden",2);ye([c()],ie.prototype,"busy",2);ye([c()],ie.prototype,"drafts",2);ye([c()],ie.prototype,"deptWindow",2);ie=ye([I("tickets-costs-settings")],ie);var yi=Object.defineProperty,wi=Object.getOwnPropertyDescriptor,Q=(e,t,s,a)=>{for(var i=a>1?void 0:a?wi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&yi(t,s,i),i};const _i={required:"err_required",too_long:"err_too_long",duplicate:"err_duplicate",address:"err_address",url:"err_url",coords:"err_coords",inactive_default:"err_inactive_default",area:"err_area"};let G=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.data=null,this.depts=[],this.areas=null,this.failed="",this.forbidden=!1,this.busy=!1,this.editing="",this.draft=ot(),this.tried=!1,this.serverErr={}}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.data=await Ce().admin()}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e);return}try{this.areas=await Ce().planAreas()}catch{this.areas=null}try{const e=await g().departments();this.depts=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))}catch{this.depts=[]}}open(e){const t=this.data?.locations.find(s=>s.id===e);this.editing=e,this.draft=t?ts(t):ot(this.data?.locations.length??0),this.tried=!1,this.serverErr={}}set(e,t){this.draft={...this.draft,[e]:t},this.serverErr={}}problems(){return{...ss(this.draft,this.data?.locations??[],this.editing==="new"?null:this.editing),...this.serverErr}}takeServer(e){if(!(e instanceof x))return!1;if(e.code==="location_name_taken")return this.serverErr={name:"duplicate"},!0;const t=e.body.details?.fields??[],s={};for(const a of t){const i=as(a.code);if(!i)continue;const r=a.field==="lat"||a.field==="lng"?"coords":a.field==="is_default"?"default":a.field;s[r]=r==="street"&&i==="required"?"address":i}return this.serverErr=s,Object.keys(s).length>0}async save(){if(this.tried=!0,!Object.keys(this.problems()).length){this.busy=!0;try{const e=Ce(),t=this.data?.locations.find(s=>s.id===this.editing);this.data=this.editing==="new"?await e.create(ct(this.draft)):await e.update(this.editing,ct(this.draft,t?.revision)),this.editing="",this.notice({ok:y("saved")})}catch(e){this.takeServer(e)||this.notice({error:_(e)})}finally{this.busy=!1}}}async patch(e,t){this.busy=!0;try{this.data=await Ce().update(e.id,{...t,revision:e.revision}),this.notice({ok:y("saved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}async removeLocation(e){if(window.confirm(y("confirmRemove",{name:e.name}))){this.busy=!0;try{this.data=await Ce().remove(e.id),this.notice({ok:y("removed")})}catch(t){this.notice({error:t instanceof x&&t.code==="location_in_use"?y("err_in_use"):_(t)})}finally{this.busy=!1}}}async setDept(e,t){this.busy=!0;try{this.data=await Ce().setDepartmentDefault(e,t||null),this.notice({ok:y("saved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}err(e,t){const s=e[t];return(this.tried||this.serverErr[t])&&s?n`<span class="err" role="alert" data-location-err=${t}>${y(_i[s])}</span>`:p}areaField(e){if(this.areas===null&&!this.draft.plan_zone_id)return p;const t=this.draft.plan_zone_id;return n`<label class="fld wide">${y("fArea")}
      <select class="in" data-location-field="plan_zone_id" ?disabled=${this.busy} @change=${s=>this.set("plan_zone_id",s.target.value)}>
        <option value="" ?selected=${!t}>${y("areaNone")}</option>
        ${is(this.areas,t).map(s=>n`<option value=${s.id} ?selected=${s.id===t}>${s.missing?y("areaMissing"):k(s.label)}</option>`)}
      </select>${this.err(e,"plan_zone_id")}</label>`}areaName(e){const t=this.areas?.find(s=>s.zone_id===e.plan_zone_id);return t?ns(t):""}editor(){const e=this.draft,t=this.problems(),s=i=>String(!!(this.tried&&t[i])),a=(i,r,d,o=!1,u="")=>n`<label class=${`fld${o?" wide":""}`}>${y(r)}
      <input class="in" data-location-field=${i} maxlength=${d} placeholder=${u} aria-invalid=${s(i)} .value=${e[i]}
        @input=${h=>this.set(i,h.target.value)} />${this.err(t,i)}</label>`;return n`<div class="editor" data-location-editor=${this.editing}>
      ${a("name","fName",ds)}
      <label class="fld">${y("fSort")}<input class="in num" inputmode="numeric" dir="ltr" data-location-field="sort_order" .value=${e.sort_order}
        @input=${i=>this.set("sort_order",i.target.value)} /></label>
      ${a("street","fStreet",os)}
      ${a("city","fCity",cs)}
      ${a("details","fDetails",rs,!0,y("fDetailsPh"))}
      <div class="fld wide"><span>${y("fCoords")}</span><div class="pair">
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lat" aria-label=${y("fLat")} placeholder=${y("fLat")} aria-invalid=${s("coords")} .value=${e.lat}
          @input=${i=>this.set("lat",i.target.value)} />
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lng" aria-label=${y("fLng")} placeholder=${y("fLng")} aria-invalid=${s("coords")} .value=${e.lng}
          @input=${i=>this.set("lng",i.target.value)} /></div>${this.err(t,"coords")}</div>
      ${this.areaField(t)}
      <div class="checks wide">
        <label><input type="checkbox" data-location-field="active" .checked=${e.active} @change=${i=>this.set("active",i.target.checked)} /> ${y("fActive")}</label>
        <label><input type="checkbox" data-location-field="is_default" .checked=${e.is_default} @change=${i=>this.set("is_default",i.target.checked)} /> ${y("fDefault")}</label>
        ${this.err(t,"default")}
      </div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-location-save ?disabled=${this.busy} @click=${()=>void this.save()}>${y("save")}</sw-button>
        <sw-button size="sm" data-location-cancel ?disabled=${this.busy} @click=${()=>this.editing=""}>${y("cancel")}</sw-button>
      </div>
    </div>`}row(e){return this.editing===e.id?this.editor():n`<div class="loc" data-location=${e.id} ?data-inactive=${!e.active}>
      <span class="txt"><b>${k(e.name)} ${e.is_default?n`<span class="chip" data-location-default>${y("defaultChip")}</span>`:p}
        ${e.active?p:n`<span class="chip" data-location-inactive>${y("inactiveChip")}</span>`}</b>
        <small>${k([ls(e),e.details].filter(Boolean).join(" · "))}</small>
        ${e.plan_zone_id&&this.areaName(e)?n`<small data-location-area>${k(y("areaLinked",{name:this.areaName(e)}))}</small>`:p}
        ${e.references?n`<small data-location-refs>${y("inUse",{n:e.references})}</small>`:p}</span>
      ${e.nav_url?n`<a class="nav" href=${e.nav_url} target="_blank" rel="noopener noreferrer" data-location-nav>${y("navigate")}</a>`:p}
      <span class="acts">
        <sw-button size="sm" data-location-edit=${e.id} ?disabled=${this.busy||!!this.editing} @click=${()=>this.open(e.id)}>${y("edit")}</sw-button>
        ${e.active&&!e.is_default?n`<sw-button size="sm" data-location-make-default=${e.id} ?disabled=${this.busy} @click=${()=>void this.patch(e,{is_default:!0})}>${y("makeDefault")}</sw-button>`:p}
        <sw-button size="sm" data-location-toggle=${e.id} ?disabled=${this.busy} @click=${()=>void this.patch(e,{active:!e.active})}>${e.active?y("deactivate"):y("activate")}</sw-button>
        ${e.references?p:n`<sw-button size="sm" data-location-remove=${e.id} ?disabled=${this.busy} @click=${()=>void this.removeLocation(e)}>${y("remove")}</sw-button>`}
      </span>
    </div>`}deptCard(e){const t=e.locations.filter(s=>s.active);return!this.depts.length||!t.length?p:n`<sw-card heading=${y("deptTitle")} subheading=${y("deptSub")} data-card="locations-departments">
      ${this.depts.map(s=>n`<div class="row" data-location-dept=${s.id}><span class="lbl">${k(s.name)}</span>
        <span class="end"><select class="in" aria-label=${`${y("deptTitle")} · ${s.name}`} ?disabled=${this.busy} @change=${a=>void this.setDept(s.id,a.target.value)}>
          <option value="" ?selected=${!e.department_defaults[s.id]}>${y("deptNone")}</option>
          ${t.map(a=>n`<option value=${a.id} ?selected=${e.department_defaults[s.id]===a.id}>${k(a.name)}</option>`)}
        </select></span></div>`)}
    </sw-card>`}render(){if(this.forbidden)return n`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${()=>void this.load()}>${y("retry")}</sw-button></sw-state-panel>`;const e=this.data;if(!e)return n`<sw-state-panel state="loading" heading=${y("loading")}></sw-state-panel>`;const t=e.locations.length>=e.max;return n`<sw-card heading=${y("title")} subheading=${y("sub")} data-card="locations">
      ${e.locations.length||this.editing==="new"?p:n`<div class="row" data-locations-empty><span class="lbl">${y("empty")}</span></div>`}
      ${ke(e.locations,s=>s.id,s=>this.row(s))}
      ${this.editing==="new"?this.editor():n`<div class="row"><sw-button size="sm" data-location-add ?disabled=${this.busy||!!this.editing||t}
        @click=${()=>this.open("new")}>${y("add")}</sw-button></div>`}
    </sw-card>
    ${this.deptCard(e)}`}};G.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .loc {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .loc:last-child {
      border-block-end: 0;
    }
    .loc .txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 220px;
      min-inline-size: 0;
    }
    .loc .txt small {
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .loc[data-inactive] .txt b {
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      padding: 10px 0;
    }
    .editor .wide {
      grid-column: 1 / -1;
    }
    .editor .pair {
      display: flex;
      gap: 8px;
    }
    .editor .pair input {
      flex: 1 1 0;
      min-inline-size: 0;
    }
    .editor .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .chip {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
    }
    a.nav {
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 640px) {
      .editor {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,re];Q([c()],G.prototype,"data",2);Q([c()],G.prototype,"depts",2);Q([c()],G.prototype,"areas",2);Q([c()],G.prototype,"failed",2);Q([c()],G.prototype,"forbidden",2);Q([c()],G.prototype,"busy",2);Q([c()],G.prototype,"editing",2);Q([c()],G.prototype,"draft",2);Q([c()],G.prototype,"tried",2);Q([c()],G.prototype,"serverErr",2);G=Q([I("tickets-locations-settings")],G);const Wt={max_rules:50,hard_daily_max:200,default_daily:20,hold_max_min:1440,name_max:80,title_max:120,description_max:2e3,placeholders:["alert","details","place","source","since"]};function ki(e,t){return{id:null,name:"",enabled:!0,source:e[0]?.key??"",subject_id:"",hold_min:"0",department_id:t[0]?.id??"",priority_id:"",category_id:"",title:"{alert} - {place}",description:"{details}",on_clear:"comment",daily_limit:""}}function xi(e){return{id:e.id,name:e.name,enabled:e.enabled,source:e.source,subject_id:e.subject_id??"",hold_min:String(e.hold_min??0),department_id:e.department_id,priority_id:e.priority_id??"",category_id:e.category_id??"",title:e.title,description:e.description??"",on_clear:e.on_clear,daily_limit:e.daily_limit==null?"":String(e.daily_limit)}}function Me(e){const t=e.trim();return t===""?null:/^-?\d+$/.test(t)?Number(t):Number.NaN}function Kt(e,t){return typeof e=="number"&&Number.isInteger(e)&&e>=1?e:t}function et(e,t,s){const a=Me(e);return a===null?s?null:"required":Number.isNaN(a)?"integer":a>=1&&a<=t?null:"range"}function tt(e,t){let s=0;for(;s<e.length;){const a=e[s];if(a==="{"){if(e[s+1]==="{"){s+=2;continue}const i=e.indexOf("}",s);if(i<0)return!1;const r=e.slice(s+1,i);if(!t.includes(r))return!1;s=i+1;continue}if(a==="}"){if(e[s+1]==="}"){s+=2;continue}return!1}s+=1}return!0}function Si(e,t){const s=t.bounds,a={},i=e.name.trim();i?i.length>s.name_max&&(a.name="too_long"):a.name="required",t.sources.some(h=>h.key===e.source)||(a.source="unknown"),e.subject_id.trim().length>200&&(a.subject_id="too_long");const r=Me(e.hold_min);(r===null||Number.isNaN(r)||r<0||r>s.hold_max_min)&&(a.hold_min="range");const d=t.departments.find(h=>h.id===e.department_id);d||(a.department_id="unknown"),e.priority_id&&!d?.priorities.some(h=>h.id===e.priority_id)&&(a.priority_id="unknown"),e.category_id&&!d?.categories.some(h=>h.id===e.category_id)&&(a.category_id="unknown");const o=e.title.trim();o?o.length>s.title_max?a.title="too_long":tt(o,s.placeholders)||(a.title="placeholder"):a.title="required",e.description.length>s.description_max?a.description="too_long":tt(e.description,s.placeholders)||(a.description="placeholder");const u=et(e.daily_limit,s.hard_daily_max,!0);return u&&(a.daily_limit=u),a}function St(e){return{id:e.id,name:e.name.trim(),enabled:e.enabled,source:e.source,subject_id:e.subject_id.trim(),hold_min:Me(e.hold_min)??0,department_id:e.department_id,priority_id:e.priority_id||null,category_id:e.category_id||null,title:e.title.trim(),description:e.description,on_clear:e.on_clear,daily_limit:Me(e.daily_limit)}}function Dt(e){const{id:t,name:s,enabled:a,source:i,subject_id:r,hold_min:d,department_id:o,priority_id:u,category_id:h,title:$,description:R,on_clear:P,daily_limit:T}=e;return{id:t,name:s,enabled:a,source:i,subject_id:r,hold_min:d,department_id:o,priority_id:u,category_id:h,title:$,description:R,on_clear:P,daily_limit:T}}function Ct(e,t){const s={},a=["name","source","subject_id","hold_min","department_id","priority_id","category_id","title","description","on_clear","daily_limit"],i=["required","too_long","placeholder","range","integer","unknown","choice"];for(const r of e){const d=/^(?:rules\[(\d+)\]|rule)\.(\w+)$/.exec(r.field);if(!d||d[1]!==void 0&&t!==null&&Number(d[1])!==t)continue;const o=d[2];a.includes(o)&&(s[o]=i.includes(r.code)?r.code:"unknown")}return s}function Di(e,t){return e.find(s=>s.key===t)?.label??""}const Ci={load:()=>Ht("tickets/rules"),save:e=>st("tickets/rules",e),test:e=>ps("tickets/rules/test",{rule:e})},Ni=[{key:"sensor.leak",label:"דליפת מים",category:"safety",subject:"entity"},{key:"device.unavailable",label:"התקן לא זמין",category:"device_faults",subject:"entity"},{key:"camera.offline",label:"מצלמה לא זמינה",category:"device_faults",subject:"camera"},{key:"opening.left_open",label:"דלת / חלון נשארו פתוחים",category:"doors",subject:"entity"}],Vt=[{id:"dept-maintenance",name:"אחזקה",priorities:[{id:"p-normal",name:"רגיל",is_default:!0},{id:"p-high",name:"גבוה",is_default:!1}],categories:[{id:"c-plumbing",name:"אינסטלציה"}]},{id:"dept-cleaning",name:"ניקיון",priorities:[{id:"p2-normal",name:"רגיל",is_default:!0}],categories:[]}],A={revision:2,enabled:!0,daily:20,seq:2,rules:[{id:"rule-demo-1",name:"דליפת מים לאחזקה",enabled:!0,source:"sensor.leak",subject_id:"",hold_min:2,department_id:"dept-maintenance",priority_id:"p-high",category_id:"c-plumbing",title:"{alert} - {place}",description:"{details}",on_clear:"comment",daily_limit:null,effective_limit:20,today_created:3,limit_reached:!1,suppressed_today:0,last_fired_at:"2026-10-19T07:12:00Z"},{id:"rule-demo-2",name:"מצלמה לא זמינה",enabled:!0,source:"camera.offline",subject_id:"",hold_min:15,department_id:"dept-maintenance",priority_id:null,category_id:null,title:"{alert}: {place}",description:"",on_clear:"comment_close",daily_limit:2,effective_limit:2,today_created:2,limit_reached:!0,suppressed_today:1,last_fired_at:"2026-10-19T09:40:00Z"}]};function Nt(){return{revision:A.revision,enabled:A.enabled,daily_limit_default:A.daily,day:"2026-10-19",sources:Ni,departments:Vt,bounds:Wt,rules:A.rules.map(e=>{const t=Kt(e.daily_limit,A.daily);return{...structuredClone(e),effective_limit:t,limit_reached:e.today_created>=t}})}}function Tt(e,t,s,a={}){return new x(e,{code:t,user_message:s,retryable:!1,correlation_id:"demo",details:a})}const Ti={load:async()=>Nt(),save:async e=>{if(e.revision!==A.revision)throw Tt(409,"rules_stale","הכללים השתנו בינתיים. טענו מחדש.",{revision:A.revision});const t=e.rules.findIndex(a=>!tt(a.title,Wt.placeholders));if(t>=0)throw Tt(422,"validation","ערך לא תקין.",{fields:[{field:`rules[${t}].title`,code:"placeholder"}]});const s=new Map(A.rules.map(a=>[a.id,a]));return A.rules=e.rules.map(a=>{const i=a.id?s.get(a.id):void 0,r=i?i.id:`rule-demo-${++A.seq}`;return{...a,id:r,effective_limit:0,today_created:i?.today_created??0,limit_reached:!1,suppressed_today:i?.suppressed_today??0,last_fired_at:i?.last_fired_at??null}}),A.enabled=e.enabled,A.daily=e.daily_limit_default,A.revision+=1,Nt()},test:async e=>{const t=A.rules.find(u=>u.id===e.id),s=Kt(e.daily_limit,A.daily),a=t?.today_created??0,i=A.enabled?e.enabled?a>=s?"suppressed":"create":"rule_off":"rules_off",r={alert:"דליפת מים",details:"חיישן מים מטבח דיווח על מים.",place:"קומה 1",source:"דליפת מים",since:"19/10/2026 09:30"},d=u=>u.replace(/\{(\w+)\}/g,(h,$)=>r[$]??h),o=Vt.find(u=>u.id===e.department_id);return{would:i,matches:1,held:1,effective_limit:s,today_created:a,sample_values:!1,alerts:[{title:"דליפת מים",place:"קומה 1",first_at:"2026-10-19T06:30:00Z",held:!0}],preview:{title:d(e.title),description:d(e.description),department:o?.name??"",priority:o?.priorities.find(u=>u.id===e.priority_id)?.name??o?.priorities.find(u=>u.is_default)?.name??""}}}};function Ze(){return B()?Ci:Ti}const Ot={tab:"פתיחה אוטומטית",title:"פתיחת {tickets} אוטומטית מהתראות",sub:"כלל פותח {ticket} {f:אחת|m:אחד} במחלקה כשהתראה נשארת פעילה, ומוסיף הערה כשהיא מסתיימת. פרטי ההתראה נכנסים ל{ticket} וגלויים לחברי המחלקה.",master:"פתיחה אוטומטית פעילה",masterSub:"כיבוי עוצר מיד את כל הכללים.",defaultLimit:"מקסימום ליום לכל כלל (ברירת מחדל)",defaultLimitSub:"בין 1 ל-{max}. כלל יכול לקבוע ערך משלו.",saveSettings:"שמירה",empty:"עדיין אין כללים. בלי כללים לא נפתח דבר.",add:"הוספת כלל",edit:"עריכה",remove:"מחיקה",enable:"הפעלה",disable:"השבתה",test:"בדיקת כלל",save:"שמירה",cancel:"ביטול",perDay:"{n} ליום",perDayDefault:"{n} ליום (ברירת מחדל)",today:"היום: {n}",limitReached:"הגיע למקסימום היום",disabledChip:"מושבת",invalidChip:"דורש תיקון",sourceGone:"מקור לא זמין",fName:"שם הכלל",fSource:"כשההתראה",fSubject:"רק עבור (מזהה, לא חובה)",fSubjectPh:"למשל binary_sensor.leak_kitchen",fHold:"פעילה לפחות (דקות)",fDept:"פתיחה במחלקה",fPriority:"עדיפות",fPriorityDefault:"ברירת המחדל של המחלקה",fCategory:"קטגוריה",fCategoryNone:"ללא",fTitle:"כותרת",fDescription:"תיאור",fPlaceholders:"אפשר להשתמש ב:",fOnClear:"כשההתראה מסתיימת",onClearComment:"להוסיף הערה",onClearClose:"להוסיף הערה ולסגור אם עוד לא {f:טופלה|m:טופל}",fLimit:"מקסימום ליום",fLimitPh:"ברירת מחדל ({n})",fEnabled:"פעיל",err_required:"שדה חובה",err_too_long:"הטקסט ארוך מדי",err_placeholder:"משתנה לא מוכר בטקסט",err_range:"מחוץ לטווח המותר",err_integer:"נא להזין מספר שלם",err_unknown:"הבחירה אינה זמינה",err_choice:"בחירה לא תקינה",saved:"הכללים נשמרו",removed:"הכלל נמחק",confirmRemove:'למחוק את הכלל "{name}"?',stale:"הכללים השתנו בינתיים. נטענו מחדש.",loading:"טוען כללים",retry:"נסו שוב",dryTitle:"תוצאת בדיקה",dryClose:"סגירה",dryMatches:"התראות פעילות שתואמות: {n} (מתוכן {held} כבר אחרי זמן ההמתנה)",drySample:"אין התראה פעילה כרגע - התצוגה עם ערכי דוגמה.",dryNone:"אין התראות פעילות שתואמות כרגע",would_create:"{f:תיפתח|m:ייפתח} {ticket} עכשיו",would_absorb:"יש כבר {ticket} {f:פתוחה|m:פתוח} להתראה הזו - תתווסף הערה",would_suppressed:"הכלל הגיע למקסימום היום - לא {f:תיפתח|m:ייפתח} {ticket}",would_wait_hold:"ההתראה עוד לא פעילה מספיק זמן",would_nothing:"לא יקרה דבר כרגע",would_already_handled:"ההתראות הפעילות כבר טופלו על ידי הכלל",would_rule_off:"הכלל מושבת",would_rules_off:"הפתיחה האוטומטית כבויה",dryPreview:"כך {f:תיראה|m:ייראה} {the_ticket}",dryDept:"מחלקה",dryPriority:"עדיפות",dryLimit:"היום {today} מתוך {limit}"},Oi={tab:"Automatic opening",title:"Open {tickets} automatically from alerts",sub:"A rule opens one {ticket} in a department while an alert stays active, and adds a note when it ends. The alert details go into the {ticket} and are visible to the department members.",master:"Automatic opening on",masterSub:"Turning it off stops every rule at once.",defaultLimit:"Maximum per day per rule (default)",defaultLimitSub:"Between 1 and {max}. A rule may set its own value.",saveSettings:"Save",empty:"No rules yet. Without rules nothing is opened.",add:"Add rule",edit:"Edit",remove:"Delete",enable:"Enable",disable:"Disable",test:"Test rule",save:"Save",cancel:"Cancel",perDay:"{n} per day",perDayDefault:"{n} per day (default)",today:"Today: {n}",limitReached:"Daily maximum reached",disabledChip:"Disabled",invalidChip:"Needs fixing",sourceGone:"Source unavailable",fName:"Rule name",fSource:"When the alert",fSubject:"Only for (id, optional)",fSubjectPh:"e.g. binary_sensor.leak_kitchen",fHold:"Active for at least (minutes)",fDept:"Open in department",fPriority:"Priority",fPriorityDefault:"Department default",fCategory:"Category",fCategoryNone:"None",fTitle:"Title",fDescription:"Description",fPlaceholders:"You can use:",fOnClear:"When the alert ends",onClearComment:"Add a note",onClearClose:"Add a note and close if nobody took it",fLimit:"Maximum per day",fLimitPh:"Default ({n})",fEnabled:"Enabled",err_required:"Required",err_too_long:"The text is too long",err_placeholder:"Unknown placeholder in the text",err_range:"Out of the allowed range",err_integer:"Enter a whole number",err_unknown:"This choice is not available",err_choice:"Invalid choice",saved:"Rules saved",removed:"Rule deleted",confirmRemove:'Delete the rule "{name}"?',stale:"The rules changed meanwhile. Reloaded.",loading:"Loading rules",retry:"Try again",dryTitle:"Test result",dryClose:"Close",dryMatches:"Matching active alerts: {n} ({held} past the waiting time)",drySample:"No active alert now - the preview uses sample values.",dryNone:"No matching active alerts now",would_create:"A {ticket} would open now",would_absorb:"A {ticket} is already open for this alert - a note would be added",would_suppressed:"The rule reached its daily maximum - no {ticket} would open",would_wait_hold:"The alert has not been active long enough yet",would_nothing:"Nothing would happen now",would_already_handled:"The rule already handled the active alerts",would_rule_off:"The rule is disabled",would_rules_off:"Automatic opening is off",dryPreview:"The {ticket} would look like this",dryDept:"Department",dryPriority:"Priority",dryLimit:"Today {today} of {limit}"};function b(e,t){const s=(Ie()==="en"?Oi[e]:Ot[e])??Ot[e],a=t?s.replace(/\{(\w+)\}/g,(i,r)=>r in t?String(t[r]):i):s;return us(a)?At(a):a}var Ei=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,W=(e,t,s,a)=>{for(var i=a>1?void 0:a?Pi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Ei(t,s,i),i};const Et={required:"err_required",too_long:"err_too_long",placeholder:"err_placeholder",range:"err_range",integer:"err_integer",unknown:"err_unknown",choice:"err_choice"};let q=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.doc=null,this.failed="",this.forbidden=!1,this.busy=!1,this.editing="",this.draft=null,this.tried=!1,this.serverErr={},this.limitText="",this.limitTried=!1,this.dryFor="",this.dry=null}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.take(await Ze().load())}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}take(e){this.doc=e,this.limitText=String(e.daily_limit_default),this.limitTried=!1}async saveDoc(e,t){const s=this.doc;if(!s)return!1;this.busy=!0;try{return this.take(await Ze().save({revision:s.revision,enabled:t.enabled??s.enabled,daily_limit_default:t.daily??s.daily_limit_default,rules:e})),this.notice({ok:b(t.ok)}),!0}catch(a){if(a instanceof x&&a.code==="rules_stale")await this.load(),this.notice({error:b("stale")});else if(a instanceof x&&a.status===422){const i=a.body.details?.fields??[];this.serverErr=Ct(i,t.index??null),Object.keys(this.serverErr).length||this.notice({error:_(a)})}else this.notice({error:_(a)});return!1}finally{this.busy=!1}}current(){return(this.doc?.rules??[]).map(Dt)}open(e){const t=this.doc;if(!t)return;const s=t.rules.find(a=>a.id===e);this.editing=e,this.draft=s?xi(s):ki(t.sources,t.departments),this.tried=!1,this.serverErr={},this.closeDry()}close(){this.editing="",this.draft=null,this.closeDry()}set(e,t){if(!this.draft)return;const s={...this.draft,[e]:t};e==="department_id"&&(s.priority_id="",s.category_id=""),this.draft=s,this.serverErr={}}problems(){return!this.draft||!this.doc?{}:{...Si(this.draft,this.doc),...this.serverErr}}async saveRule(){if(this.tried=!0,!this.draft||Object.keys(this.problems()).length)return;const e=St(this.draft),t=this.current();let s=t.findIndex(a=>a.id===this.editing);s<0?(t.push({...e,id:null}),s=t.length-1):t[s]=e,await this.saveDoc(t,{index:s,ok:"saved"})&&this.close()}async toggleRule(e){await this.saveDoc(this.current().map(t=>t.id===e.id?{...t,enabled:!e.enabled}:t),{ok:"saved"})}async removeRule(e){window.confirm(b("confirmRemove",{name:e.name}))&&await this.saveDoc(this.current().filter(t=>t.id!==e.id),{ok:"removed"})&&this.editing===e.id&&this.close()}async setMaster(e){await this.saveDoc(this.current(),{enabled:e,ok:"saved"})}async saveLimit(){this.limitTried=!0;const e=this.doc;!e||et(this.limitText,e.bounds.hard_daily_max,!1)||await this.saveDoc(this.current(),{daily:Me(this.limitText)??e.daily_limit_default,ok:"saved"})}async test(e,t){this.busy=!0;try{this.dry=await Ze().test(t),this.dryFor=e}catch(s){s instanceof x&&s.status===422&&this.draft?(this.tried=!0,this.serverErr=Ct(s.body.details?.fields??[],null)):this.notice({error:_(s)})}finally{this.busy=!1}}testDraft(){this.tried=!0,!(!this.draft||Object.keys(this.problems()).length)&&this.test(this.editing,St(this.draft))}closeDry(){this.dry=null,this.dryFor=""}err(e,t){const s=e[t];return(this.tried||this.serverErr[t])&&s?n`<span class="err" role="alert" data-rule-err=${t}>${b(Et[s])}</span>`:p}dryPanel(){const e=this.dry;if(!e)return p;const t=`would_${e.would}`;return n`<div class="dry" role="status" data-rule-dry=${this.dryFor} data-dry-outcome=${e.would}>
      <div><small>${b("dryTitle")}</small></div>
      <div><b data-dry-would>${b(t)}</b></div>
      <div><small>${e.matches?b("dryMatches",{n:e.matches,held:e.held}):b("dryNone")}</small></div>
      ${e.alerts.length?n`<div><small data-dry-alerts>${e.alerts.map(s=>k([s.title,s.place].filter(Boolean).join(" · "))).join(" | ")}</small></div>`:p}
      ${e.sample_values?n`<div><small data-dry-sample>${b("drySample")}</small></div>`:p}
      <div><small>${b("dryPreview")}</small></div>
      <div class="pv" data-dry-preview><b>${k(e.preview.title)}</b>${e.preview.description?n`<br />${k(e.preview.description)}`:p}</div>
      <div><small>${b("dryDept")}: ${k(e.preview.department)} · ${b("dryPriority")}: ${k(e.preview.priority)} · ${b("dryLimit",{today:e.today_created,limit:e.effective_limit})}</small></div>
      <div><sw-button size="sm" data-dry-close @click=${()=>this.closeDry()}>${b("dryClose")}</sw-button></div>
    </div>`}editor(e){const t=this.draft,s=this.problems(),a=u=>String(!!((this.tried||this.serverErr[u])&&s[u])),i=e.departments.find(u=>u.id===t.department_id),r=e.sources.some(u=>u.key===t.source)?e.sources:[{key:t.source,label:b("sourceGone"),category:"",subject:""},...e.sources],d=u=>h=>this.set(u,h.target.value),o=u=>h=>this.set(u,h.target.value);return n`<div class="editor" data-rule-editor=${this.editing}>
      <label class="fld wide">${b("fName")}<input class="in" data-rule-field="name" maxlength=${e.bounds.name_max} aria-invalid=${a("name")} .value=${t.name}
        @input=${o("name")} />${this.err(s,"name")}</label>
      <label class="fld">${b("fSource")}<select class="in" data-rule-field="source" aria-invalid=${a("source")} @change=${d("source")}>
        ${r.map(u=>n`<option value=${u.key} ?selected=${u.key===t.source}>${u.label}</option>`)}</select>${this.err(s,"source")}</label>
      <label class="fld">${b("fHold")}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="hold_min" aria-invalid=${a("hold_min")} .value=${t.hold_min}
        @input=${o("hold_min")} />${this.err(s,"hold_min")}</label>
      <label class="fld wide">${b("fSubject")}<input class="in" dir="ltr" data-rule-field="subject_id" maxlength="200" placeholder=${b("fSubjectPh")}
        aria-invalid=${a("subject_id")} .value=${t.subject_id} @input=${o("subject_id")} />${this.err(s,"subject_id")}</label>
      <label class="fld">${b("fDept")}<select class="in" data-rule-field="department_id" aria-invalid=${a("department_id")} @change=${d("department_id")}>
        ${i?p:n`<option value="" selected>—</option>`}
        ${e.departments.map(u=>n`<option value=${u.id} ?selected=${u.id===t.department_id}>${k(u.name)}</option>`)}</select>${this.err(s,"department_id")}</label>
      <label class="fld">${b("fPriority")}<select class="in" data-rule-field="priority_id" aria-invalid=${a("priority_id")} @change=${d("priority_id")}>
        <option value="" ?selected=${!t.priority_id}>${b("fPriorityDefault")}</option>
        ${(i?.priorities??[]).map(u=>n`<option value=${u.id} ?selected=${u.id===t.priority_id}>${k(u.name)}</option>`)}</select>${this.err(s,"priority_id")}</label>
      ${i?.categories.length?n`<label class="fld">${b("fCategory")}<select class="in" data-rule-field="category_id" aria-invalid=${a("category_id")} @change=${d("category_id")}>
        <option value="" ?selected=${!t.category_id}>${b("fCategoryNone")}</option>
        ${i.categories.map(u=>n`<option value=${u.id} ?selected=${u.id===t.category_id}>${k(u.name)}</option>`)}</select>${this.err(s,"category_id")}</label>`:p}
      <label class="fld">${b("fLimit")}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="daily_limit" placeholder=${b("fLimitPh",{n:e.daily_limit_default})}
        aria-invalid=${a("daily_limit")} .value=${t.daily_limit} @input=${o("daily_limit")} />${this.err(s,"daily_limit")}</label>
      <label class="fld wide">${b("fTitle")}<input class="in" data-rule-field="title" maxlength=${e.bounds.title_max} aria-invalid=${a("title")} .value=${t.title}
        @input=${o("title")} />${this.err(s,"title")}</label>
      <label class="fld wide">${b("fDescription")}<textarea class="in" data-rule-field="description" maxlength=${e.bounds.description_max} aria-invalid=${a("description")}
        .value=${t.description} @input=${o("description")}></textarea>${this.err(s,"description")}<span class="hint" data-rule-placeholders>${b("fPlaceholders")} <span dir="ltr">${e.bounds.placeholders.map(u=>`{${u}}`).join(" ")}</span></span></label>
      <label class="fld wide">${b("fOnClear")}<select class="in" data-rule-field="on_clear" @change=${d("on_clear")}>
        <option value="comment" ?selected=${t.on_clear==="comment"}>${b("onClearComment")}</option>
        <option value="comment_close" ?selected=${t.on_clear==="comment_close"}>${b("onClearClose")}</option></select></label>
      <div class="checks wide"><label><input type="checkbox" data-rule-field="enabled" .checked=${t.enabled}
        @change=${u=>this.set("enabled",u.target.checked)} /> ${b("fEnabled")}</label></div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-rule-save ?disabled=${this.busy} @click=${()=>void this.saveRule()}>${b("save")}</sw-button>
        <sw-button size="sm" data-rule-test-draft ?disabled=${this.busy} @click=${()=>this.testDraft()}>${b("test")}</sw-button>
        <sw-button size="sm" data-rule-cancel ?disabled=${this.busy} @click=${()=>this.close()}>${b("cancel")}</sw-button>
      </div>
      ${this.dryFor===this.editing?n`<div class="wide">${this.dryPanel()}</div>`:p}
    </div>`}row(e,t){if(this.editing===t.id)return this.editor(e);const s=e.departments.find(r=>r.id===t.department_id),a=Di(e.sources,t.source)||b("sourceGone"),i=t.daily_limit==null?b("perDayDefault",{n:t.effective_limit}):b("perDay",{n:t.effective_limit});return n`<div class="rule" data-rule=${t.id} ?data-off=${!t.enabled||!e.enabled}>
      <span class="txt"><b>${k(t.name)}
        ${t.enabled?p:n`<span class="chip" data-rule-disabled>${b("disabledChip")}</span>`}
        ${t.invalid?n`<span class="chip bad" data-rule-invalid>${b("invalidChip")}</span>`:p}
        ${t.limit_reached?n`<span class="chip warn" data-rule-limit-reached>${b("limitReached")}</span>`:p}</b>
        <small>${a} · ${k(s?.name??"—")}</small>
        <small><span data-rule-limit>${i}</span> · <span data-rule-today>${b("today",{n:t.today_created})}</span></small></span>
      <span class="acts">
        <sw-button size="sm" data-rule-edit=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>this.open(t.id)}>${b("edit")}</sw-button>
        <sw-button size="sm" data-rule-test=${t.id} ?disabled=${this.busy||!!this.editing||!!t.invalid} @click=${()=>void this.test(t.id,Dt(t))}>${b("test")}</sw-button>
        <sw-button size="sm" data-rule-toggle=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>void this.toggleRule(t)}>${t.enabled?b("disable"):b("enable")}</sw-button>
        <sw-button size="sm" data-rule-remove=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>void this.removeRule(t)}>${b("remove")}</sw-button>
      </span>
    </div>
    ${this.dryFor===t.id?this.dryPanel():p}`}render(){if(this.forbidden)return n`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return n`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${()=>void this.load()}>${b("retry")}</sw-button></sw-state-panel>`;const e=this.doc;if(!e)return n`<sw-state-panel state="loading" heading=${b("loading")}></sw-state-panel>`;const t=this.limitTried?et(this.limitText,e.bounds.hard_daily_max,!1):null,s=e.rules.length>=e.bounds.max_rules;return n`<sw-card heading=${b("title")} subheading=${b("sub")} data-card="ticket-rules-settings">
      <div class="row"><span class="lbl">${b("master")}<span class="muted">${b("masterSub")}</span></span>
        <span class="end"><sw-toggle label=${b("master")} labelHidden .checked=${e.enabled} ?disabled=${this.busy} data-rules-master
          @change=${a=>void this.setMaster(a.detail.checked)}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${b("defaultLimit")}<span class="muted">${b("defaultLimitSub",{max:e.bounds.hard_daily_max})}</span></span>
        <span class="end"><input class="in num" inputmode="numeric" dir="ltr" data-rules-default-limit aria-label=${b("defaultLimit")}
          aria-invalid=${String(!!t)} .value=${this.limitText} @input=${a=>this.limitText=a.target.value} />
          <sw-button size="sm" data-rules-default-save ?disabled=${this.busy||this.limitText===String(e.daily_limit_default)}
            @click=${()=>void this.saveLimit()}>${b("saveSettings")}</sw-button>
          ${t?n`<span class="err" role="alert" data-rules-default-err>${b(Et[t])}</span>`:p}</span></div>
    </sw-card>
    <sw-card data-card="ticket-rules">
      ${e.rules.length||this.editing==="new"?p:n`<div class="row" data-rules-empty><span class="lbl">${b("empty")}</span></div>`}
      ${ke(e.rules,a=>a.id,a=>this.row(e,a))}
      ${this.editing==="new"?this.editor(e):n`<div class="row"><sw-button size="sm" data-rule-add ?disabled=${this.busy||!!this.editing||s||!e.departments.length}
        @click=${()=>this.open("new")}>${b("add")}</sw-button></div>`}
    </sw-card>`}};q.styles=[X,Z,Y`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .rule {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
    }
    .rule .txt {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1 1 240px;
      min-inline-size: 0;
    }
    .rule .txt small {
      color: var(--sw-text-3);
      overflow-wrap: anywhere;
    }
    .rule[data-off] .txt b {
      color: var(--sw-text-3);
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      font-size: var(--sw-fs-xs);
      padding: 1px 8px;
      border-radius: 999px;
      background: var(--sw-surface-2);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .chip.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .chip.bad {
      color: var(--sw-danger);
    }
    .editor {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 12px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .editor .wide {
      grid-column: 1 / -1;
    }
    .editor .hint {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .editor .checks {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      align-items: center;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    .dry {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      margin-block: 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
      min-inline-size: 0;
    }
    .dry b[data-dry-would] {
      font-size: var(--sw-fs-md);
    }
    .dry .pv {
      padding: 8px 10px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }
    .dry small {
      color: var(--sw-text-3);
    }
    @media (max-width: 640px) {
      .editor {
        grid-template-columns: minmax(0, 1fr);
      }
      .rule .acts {
        inline-size: 100%;
      }
    }
  `,re];W([c()],q.prototype,"doc",2);W([c()],q.prototype,"failed",2);W([c()],q.prototype,"forbidden",2);W([c()],q.prototype,"busy",2);W([c()],q.prototype,"editing",2);W([c()],q.prototype,"draft",2);W([c()],q.prototype,"tried",2);W([c()],q.prototype,"serverErr",2);W([c()],q.prototype,"limitText",2);W([c()],q.prototype,"limitTried",2);W([c()],q.prototype,"dryFor",2);W([c()],q.prototype,"dry",2);q=W([I("tickets-rules-settings")],q);var zi=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,qe=(e,t,s,a)=>{for(var i=a>1?void 0:a?Li(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&zi(t,s,i),i};let Oe=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.busy=!1,this.error=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents"}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await Mt().saveSettings(this.doc.revision,e);this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}seg(e,t,s,a,i){const r=this.doc?.ui?.[e]??Ps[e];return n`<div class="row"><span class="lbl">${he(t)}<span class="muted">${he(s)}</span></span>
      <span class="seg" role="radiogroup" aria-label=${he(t)}>${a.map(d=>n`<button type="button" role="radio" aria-pressed=${String(r===d)} aria-checked=${String(r===d)} data-ui-board=${`${String(e)}:${String(d)}`}
        ?disabled=${this.disabled||this.busy} @click=${()=>void this.save({ui:{[e]:d}})}>${he(`${i}${String(d)}`)}</button>`)}</span></div>`}handledRow(){const e=this.doc?.ui?.handled_days??7;return n`<div class="row"><span class="lbl">${he("setHandledDays")}<span class="muted">${he("setHandledDaysSub")}</span></span>
      <span class="seg" role="radiogroup" aria-label=${he("setHandledDays")}>${[1,7,30].map(t=>n`<button type="button" role="radio" aria-pressed=${String(e===t)} aria-checked=${String(e===t)} data-ui-board=${`handled_days:${t}`}
        ?disabled=${this.disabled||this.busy} @click=${()=>void this.save({ui:{handled_days:t}})}>${he(`hd_${t}`)}</button>`)}</span></div>`}render(){return n`
      ${this.seg("board_floors","setBoardFloors","setBoardFloorsSub",["tree","chips","chips_tree"],"bf_")}
      ${this.seg("grouping","setGrouping","setGroupingSub",["no_status_filter","always","never"],"g_")}
      ${this.seg("closed_strip","setClosedStrip","setClosedStripSub",["all","week","hidden"],"cs_")}
      ${this.handledRow()}
      ${this.error?n`<div class="row"><span class="field-error" role="alert" data-board-settings-error>${this.error}</span></div>`:""}`}};qe([E({attribute:!1})],Oe.prototype,"doc",2);qe([E({type:Boolean})],Oe.prototype,"disabled",2);qe([c()],Oe.prototype,"busy",2);qe([c()],Oe.prototype,"error",2);Oe=qe([I("ticket-board-settings")],Oe);const Ri=["now","digest","off"],Xt=["push","email","whatsapp"],Pt=/^([01]\d|2[0-3]):[0-5]\d$/;function Ai(e,t,s){return e[t]?.[s]??(t==="*"?void 0:e["*"]?.[s])??"now"}function Hi(e,t){return e===t?null:t}function Mi(e,t,s,a){const i={};for(const[d,o]of Object.entries(e))i[d]={...o};const r={...i[t]??{}};return a===null||a==="now"&&t==="*"?delete r[s]:r[s]=a,Object.keys(r).length?i[t]=r:delete i[t],i}function Ii(e,t){const s=e.departments??{},a=s[t]??{},i=t==="*"?{}:s["*"]??{},r=a.recipients??i.recipients,d={};for(const o of Xt){const u=a.channels?.[o],h=i.channels?.[o];d[o]=u?{value:u,inherited:!1}:{value:h??"inherit",inherited:!!h}}return{digestTime:t!=="*"&&a.digest_time||e.digest_time,timeInherited:t==="*"||!a.digest_time,recipients:r?{managers:r.managers,users:[...r.users],roles:[...r.roles]}:{managers:!0,users:[],roles:[]},recipientsInherited:!a.recipients,channels:d}}function Re(e,t,s,a){const i={};for(const[d,o]of Object.entries(e??{}))i[d]={...o};const r={...i[t]??{}};return a===void 0||s==="channels"&&!Object.keys(a).length?delete r[s]:r[s]=a,Object.keys(r).length?i[t]=r:delete i[t],i}function ji(e,t,s){const a={...e??{}};return s==="inherit"?delete a[t]:a[t]=s,a}function zt(e,t){return e.includes(t)?e.filter(s=>s!==t):[...e,t]}function qi(e,t){return`${e}/${t}`}function Ui(e,t,s){const a={...e??{}};return s==="inherit"?delete a[t]:a[t]=s,a}var Bi=Object.defineProperty,Fi=Object.getOwnPropertyDescriptor,ue=(e,t,s,a)=>{for(var i=a>1?void 0:a?Fi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Bi(t,s,i),i};let ne=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.meta=null,this.dept="*",this.busy=!1,this.error="",this.time=null,this.deptTime=null}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents",this.loadMeta(!0)}loadMeta(e){Ht("tickets/settings/notify-matrix").then(t=>this.meta=t).catch(t=>{e&&(this.error=`${f("loadError")}: ${_(t)}`)})}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await st("tickets/settings",{revision:this.doc.revision,notify:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0})),this.time=null,this.deptTime=null,this.loadMeta(!1)}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}get off(){return this.disabled||this.busy}toggle(e,t,s,a,i){return n`<div class="row"><span class="lbl">${e}<span class="muted">${t}</span></span>
      <sw-toggle label=${e} labelHidden .checked=${s} ?disabled=${this.off} data-notify=${a}
        @change=${r=>void this.save({[i]:r.detail.checked})}></sw-toggle></div>`}seg(e,t,s,a,i,r){return n`<span class="seg" role="radiogroup" aria-label=${e}>${t.map(d=>n`<button type="button" role="radio"
      aria-pressed=${String(s===d)} aria-checked=${String(s===d)} data-notify-cell=${i(d)} ?disabled=${this.off}
      @click=${()=>r(d)}>${a(d)}</button>`)}</span>`}pick(e,t){const s=Ai(t,this.dept,e.key),a=this.dept==="*"||t[this.dept]?.[e.key]!==void 0,i=Ri.filter(o=>o!=="digest"||e.digest),r={now:f("modeNow"),digest:f("modeDigest"),off:f("modeOff")},d=hs(e.key,e.label);return n`<div class="row" data-notify-source=${e.key}><span class="lbl">${d}<span class="muted">${[e.assignee?f("assigneeTag"):"",e.sla?f("slaTag"):"",a?"":f("inherited")].filter(Boolean).join(" · ")}</span></span>
      ${this.seg(d,i,s,o=>r[o],o=>`${e.key}:${o}`,o=>void this.save({matrix:Mi(t,this.dept,e.key,Hi(s,o))}))}</div>`}chips(e,t,s){const a=e==="users"?this.meta?.users??[]:this.meta?.roles??[],i=t[e],r=u=>a.find(h=>h.id===u)?.name??u,d=u=>void this.save({departments:Re(s.departments,this.dept,"recipients",{...t,[e]:u})}),o=f(e==="users"?"recUsers":"recRoles");return n`<div class="row"><span class="lbl">${o}</span>
      <span class="end nm-chips" data-notify-pick=${e}>
        ${i.map(u=>n`<span class="nm-chip">${r(u)}<button type="button" class="nm-x" aria-label=${f("remove",{name:r(u)})}
          ?disabled=${this.off} @click=${()=>d(zt(i,u))}>×</button></span>`)}
        <select class="in" aria-label=${f(e==="users"?"addUser":"addRole")} ?disabled=${this.off} data-notify-add=${e}
          @change=${u=>{const h=u.target;h.value&&d(zt(i,h.value)),h.value=""}}>
          <option value="">${f(e==="users"?"addUser":"addRole")}</option>
          ${a.filter(u=>!i.includes(u.id)).map(u=>n`<option value=${u.id}>${u.name}</option>`)}
        </select></span></div>`}deptSection(e){const t=Ii(e,this.dept),s=(e.departments??{})[this.dept]??{},a=this.deptTime??(this.dept!=="*"&&s.digest_time?s.digest_time:""),i=this.deptTime!==null&&(this.deptTime===""||Pt.test(this.deptTime))&&this.deptTime!==(s.digest_time??""),r=t.recipients,d=Xt.filter(o=>this.meta?.channels.includes(o));return n`
      ${this.dept!=="*"&&e.digest_enabled?n`<div class="row"><span class="lbl">${f("deptTime")}<span class="muted">${f("deptTimeSub",{time:e.digest_time})}</span></span>
        <span class="end"><input class="in time" type="time" lang=${be()} aria-label=${f("deptTime")} data-notify-dept-time .value=${a} ?disabled=${this.off}
          @input=${o=>this.deptTime=o.target.value} />
          <sw-button size="sm" variant="primary" data-notify-dept-time-save ?disabled=${!i||this.off}
            @click=${()=>void this.save({departments:Re(e.departments,this.dept,"digest_time",this.deptTime||void 0)})}>${f("save")}</sw-button></span></div>`:p}
      ${e.digest_enabled?n`
        <div class="row"><span class="lbl">${f("recipients")}<span class="muted">${f("recipientsSub")}${this.dept!=="*"&&t.recipientsInherited?` · ${f("inherited")}`:""}</span></span>
          ${this.dept!=="*"&&!t.recipientsInherited?n`<sw-button size="sm" variant="ghost" data-notify-rec-inherit ?disabled=${this.off}
            @click=${()=>void this.save({departments:Re(e.departments,this.dept,"recipients",void 0)})}>${f("backToStar")}</sw-button>`:p}</div>
        <div class="row"><span class="lbl">${f("recManagers")}</span>
          <sw-toggle label=${f("recManagers")} labelHidden .checked=${r.managers} ?disabled=${this.off} data-notify-rec-managers
            @change=${o=>void this.save({departments:Re(e.departments,this.dept,"recipients",{...r,managers:o.detail.checked})})}></sw-toggle></div>
        ${this.chips("users",r,e)}
        ${this.chips("roles",r,e)}`:p}
      <div class="row"><span class="lbl">${f("channels")}<span class="muted">${f("channelsSub")}</span></span></div>
      <div class="row"><span class="lbl">${f("chInapp")}</span><span class="muted" data-notify-inapp>${f("chInappAlways")}</span></div>
      ${d.map(o=>{const u=t.channels[o],h=s.channels?.[o]??"inherit",$=f(`ch_${o}`),R=P=>P==="inherit"?u.inherited?`${f("inherited")}: ${f(u.value==="on"?"chOn":"chOff")}`:f("chInherit"):f(P==="on"?"chOn":"chOff");return n`<div class="row" data-notify-channel=${o}><span class="lbl">${$}</span>
          ${this.seg($,["inherit","on","off"],h,R,P=>`ch-${o}:${P}`,P=>void this.save({departments:Re(e.departments,this.dept,"channels",ji(s.channels,o,P))}))}</div>`})}`}slaSection(e){const t=this.meta?.departments.find(i=>i.id===this.dept);if(!t||!t.priorities.length)return p;const s=e.sla_urgent??{},a=i=>f(i==="inherit"?"slaInherit":i==="immediate"?"slaImmediate":"slaMatrix");return n`<div class="row"><span class="lbl">${f("sla")}<span class="muted">${f("slaSub")}</span></span></div>
      ${t.priorities.map(i=>{const r=qi(t.id,i.id),d=s[r]??"inherit";return n`<div class="row" data-notify-sla=${i.id}><span class="lbl">${i.name}</span>
          ${this.seg(i.name,["inherit","immediate","matrix"],d,a,o=>`sla-${i.id}:${o}`,o=>void this.save({sla_urgent:Ui(s,r,o)}))}</div>`})}`}render(){const e=this.doc?.notify;if(!e)return p;const t=this.time??e.digest_time,s=this.time!==null&&this.time!==e.digest_time&&Pt.test(this.time),a=this.meta?f("pending",{n:this.meta.pending}):"";return n`
      ${this.toggle(f("matrixOn"),f("matrixOnSub"),e.matrix_enabled,"matrix-enabled","matrix_enabled")}
      ${this.toggle(f("digestOn"),f("digestOnSub"),e.digest_enabled,"digest-enabled","digest_enabled")}
      ${this.toggle(f("urgent"),f("urgentSub"),e.urgent_immediate??!0,"urgent-immediate","urgent_immediate")}
      <div class="row"><span class="lbl">${f("siteTime")}<span class="muted">${[f("siteTimeSub"),a].filter(Boolean).join(" · ")}</span></span>
        <span class="end"><input class="in time" type="time" lang=${be()} aria-label=${f("siteTime")} data-notify-time .value=${t} ?disabled=${this.off}
          @input=${i=>this.time=i.target.value} />
          <sw-button size="sm" variant="primary" data-notify-time-save ?disabled=${!s||this.busy} @click=${()=>void this.save({digest_time:this.time})}>${f("save")}</sw-button></span></div>
      ${e.matrix_enabled&&this.meta?n`
        <div class="row"><span class="lbl">${f("dept")}</span>
          <select class="in" aria-label=${f("dept")} data-notify-dept .value=${this.dept}
            @change=${i=>{this.dept=i.target.value,this.deptTime=null}}>
            <option value="*">${f("allDepts")}</option>
            ${this.meta.departments.map(i=>n`<option value=${i.id} ?selected=${this.dept===i.id}>${i.name}${i.pending?` (${i.pending})`:""}</option>`)}
          </select></div>
        ${this.deptSection(e)}
        <div class="row"><span class="lbl">${f("events")}</span></div>
        ${this.meta.sources.map(i=>this.pick(i,e.matrix))}
        ${this.dept!=="*"?this.slaSection(e):p}`:p}
      ${this.error?n`<div class="row"><span class="field-error" role="alert" data-notify-error>${this.error}</span></div>`:p}`}};ue([E({attribute:!1})],ne.prototype,"doc",2);ue([E({type:Boolean})],ne.prototype,"disabled",2);ue([c()],ne.prototype,"meta",2);ue([c()],ne.prototype,"dept",2);ue([c()],ne.prototype,"busy",2);ue([c()],ne.prototype,"error",2);ue([c()],ne.prototype,"time",2);ue([c()],ne.prototype,"deptTime",2);ne=ue([I("ticket-notify-matrix")],ne);const Gi={card:"ביקורי ספקים והגעה לאתר",enabled:"ביקורי ספקים",enabledSub:"ביקור מתוכנן לכל ספק חיצוני, זיהוי ספק שלא הגיע והתראה למנהל",publicArrival:'כפתור "הגעתי" בדף הספק',publicArrivalSub:"הספק לוחץ פעם אחת בדף שלו; לחיצה היא דיווח שלו ולא הוכחת נוכחות, והדף לא פותח שום דלת",claimCounts:"דיווח הספק נחשב הגעה",claimCountsSub:'כבוי: הדיווח נשאר "דווח" עד שמנהל מאשר',offer:"הפניה לבקשת קוד כניסה אחרי ההגעה",offerSub:'כבוי כברירת מחדל. הבקשה עצמה עוברת תמיד אישור של מנהל; דורש שכרטיס "כניסה לאתר" זמין',notifyVendor:"תזכורת לספק שלא הגיע",notifyVendorSub:"כבוי כברירת מחדל; ההודעה נשלחת רק בשעות השליחה המותרות",grace:"סבלנות אחרי סוף החלון",graceSub:"דקות עד שביקור נחשב כלא הגיע (0–240)",early:"הכפתור נפתח לפני החלון",earlySub:"דקות לפני תחילת החלון (0–720)",save:"שמירה",minutes:"דק׳",errRange:"ערך מחוץ לטווח"},Wi={card:"Vendor visits and arrival on site",enabled:"Vendor visits",enabledSub:"A planned visit for each outside vendor, detection of a vendor who did not arrive, and an alert to the manager",publicArrival:'"I have arrived" button on the vendor page',publicArrivalSub:"The vendor taps once on his page; the tap is his own report, not proof of presence, and the page never opens a door",claimCounts:"The vendor report counts as an arrival",claimCountsSub:'Off: the report stays "reported" until a manager confirms',offer:"Point to the entry-code request after arrival",offerSub:'Off by default. The request itself always needs a manager approval; needs the "Site access" card to be available',notifyVendor:"Reminder to a vendor who did not arrive",notifyVendorSub:"Off by default; sent only within the allowed send hours",grace:"Grace after the window ends",graceSub:"Minutes before a visit counts as missed (0-240)",early:"The button opens before the window",earlySub:"Minutes before the window starts (0-720)",save:"Save",minutes:"min",errRange:"Value out of range"};function se(e){return Ie()==="en"?Wi[e]:Gi[e]}var Ki=Object.defineProperty,Vi=Object.getOwnPropertyDescriptor,ze=(e,t,s,a)=>{for(var i=a>1?void 0:a?Vi(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&Ki(t,s,i),i};const Xi=[{key:"grace_min",label:"grace",sub:"graceSub",lo:0,hi:240},{key:"early_min",label:"early",sub:"earlySub",lo:0,hi:720}],Yi=[{key:"enabled",label:"enabled",sub:"enabledSub"},{key:"public_arrival",label:"publicArrival",sub:"publicArrivalSub"},{key:"claim_counts",label:"claimCounts",sub:"claimCountsSub"},{key:"offer_access_request",label:"offer",sub:"offerSub"},{key:"notify_vendor_on_miss",label:"notifyVendor",sub:"notifyVendorSub"}],Zi={enabled:!0,public_arrival:!0,claim_counts:!0,offer_access_request:!1,notify_vendor_on_miss:!1,grace_min:60,early_min:60};let Se=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.draft={},this.busy=!1,this.error=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents"}get cur(){return{...Zi,...this.doc?.visits??{}}}get off(){return this.disabled||this.busy}async save(e,t){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const s=await st("tickets/settings",{revision:this.doc.revision,visits:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:s,bubbles:!0,composed:!0})),t?.()}catch(s){this.error=s instanceof x?s.body.user_message||_(s):_(s)}finally{this.busy=!1}}}render(){if(!this.doc)return n`${p}`;const e=this.cur,t=Xi.map(i=>{const r=this.draft[i.key]??String(e[i.key]);return{...i,raw:r,v:H(r,i.lo,i.hi)}}),s=t.some(i=>Number.isNaN(i.v)),a=t.some(i=>i.v!==e[i.key]);return n`
      ${Yi.map(i=>n`<div class="row"><span class="lbl">${se(i.label)}<span class="muted">${se(i.sub)}</span></span>
        <sw-toggle label=${se(i.label)} labelHidden .checked=${e[i.key]} ?disabled=${this.off} data-vs=${i.key}
          @change=${r=>void this.save({[i.key]:r.detail.checked})}></sw-toggle></div>`)}
      ${t.map(i=>n`<div class="row"><span class="lbl">${se(i.label)}<span class="muted">${se(i.sub)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${i.lo} max=${i.hi} data-vs-num=${i.key} aria-label=${se(i.label)} aria-invalid=${String(Number.isNaN(i.v))}
          ?disabled=${this.off} .value=${i.raw} @input=${r=>this.draft={...this.draft,[i.key]:r.target.value}} /><span class="muted">${se("minutes")}</span></span></div>`)}
      <div class="row"><span class="end"><sw-button size="sm" variant="primary" data-vs-save ?disabled=${s||!a||this.off}
        @click=${()=>void this.save({grace_min:t[0].v,early_min:t[1].v},()=>this.draft={})}>${se("save")}</sw-button>
        ${s?n`<span class="field-error">${se("errRange")}</span>`:p}</span></div>
      ${this.error?n`<div class="row"><span class="field-error" role="alert">${this.error}</span></div>`:p}`}};ze([E({attribute:!1})],Se.prototype,"doc",2);ze([E({type:Boolean})],Se.prototype,"disabled",2);ze([c()],Se.prototype,"draft",2);ze([c()],Se.prototype,"busy",2);ze([c()],Se.prototype,"error",2);Se=ze([I("ticket-visits-settings")],Se);const Ji={qReminder:"תזכורת על שאלת ספק שלא נענתה",qReminderSub:"כמה שעות אחרי השאלה (0 = בלי תזכורת; פעם אחת לכל שאלה)",qBadgeAll:"מספר השאלות הממתינות גם לצופה בכל המחלקות",qBadgeAllSub:"כבוי - רק מי שמנהל את הבקשה רואה את המספר בניווט. הטקסט של השאלות אינו מוצג.",anSetting:"הודעת אישור לספק שזכה",anSettingSub:"נוסח קבוע: ההצעה אושרה ומחייבת, ועל הספק להודיע מראש דרך הקישור אם הוא דוחה את העבודה",anMode_confirm:"באישור המנהל (ברירת מחדל)",anMode_auto:"אוטומטית עם כל אישור",anMode_off:"לא לשלוח",ppLateHours:'הודעת דחייה "באיחור"',ppLateHoursSub:'הודעה שנמסרה פחות משעות אלה לפני המועד המתוכנן (או אחריו) מסומנת "באיחור" למנהלים. 0 = רק אחרי תחילת המועד. סימון בלבד, לא חסימה'},Qi={qReminder:"Reminder for an unanswered vendor question",qReminderSub:"Hours after the question (0 = no reminder; once per question)",qBadgeAll:"Pending-questions count for viewers of all departments",qBadgeAllSub:"Off - only a manager of the request sees the count in the navigation. The questions text is never shown.",anSetting:"Approval notice to the selected vendor",anSettingSub:"A fixed text: the quote is approved and binding, and the vendor must notify in advance through the link if he postpones the work",anMode_confirm:"When the manager confirms (default)",anMode_auto:"Automatically with every approval",anMode_off:"Do not send",ppLateHours:'"Late" postponement notice',ppLateHoursSub:'A notice given less than this many hours before the scheduled date (or after it) is tagged "late" for the managers. 0 = only after the start. A tag only, never a block'};function U(e){return Ie()==="en"?Qi[e]:Ji[e]}function Lt(e){const s=`p_${String(e??"").replace(/^tickets\./,"").replace(/\./g,"_")}`;return Rt.includes(s)?l(s):ms.includes(s)?S(s):Us.includes(s)?Bs(s):String(e??"")}var en=Object.defineProperty,tn=Object.getOwnPropertyDescriptor,De=(e,t,s,a)=>{for(var i=a>1?void 0:a?tn(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&en(t,s,i),i};let fe=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.busy=!1,this.error="",this.departments=[],this.bad=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents",g().departments().then(e=>this.departments=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))).catch(()=>g().meta().then(e=>this.departments=e.departments.map(t=>({id:t.id,name:t.name}))).catch(()=>{}))}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await Mt().saveSettings(this.doc.revision,{ui:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}seg(e,t,s,a,i,r){return n`<div class="row"><span class="lbl">${O(t)}<span class="muted">${O(s)}</span></span>
      <span class="seg" role="radiogroup" aria-label=${O(t)}>${a.map(d=>n`<button type="button" role="radio" aria-pressed=${String(i===d)} aria-checked=${String(i===d)} data-ui-overview=${`${e}:${d}`}
        ?disabled=${this.disabled||this.busy} @click=${()=>void this.save({[e]:d})}>${O(`${r}${d}`)}</button>`)}</span></div>`}onBusy(e,t){const s=e.target,a=ta(s.value),i=Ge(this.doc?.ui);if(a===void 0||t===null&&a===null){this.bad=t??"*";return}if(this.bad="",t===null){a!==i.busy&&this.save({dash_busy:a});return}const r={...i.busyByDept};a===null?delete r[t]:r[t]=a,JSON.stringify(r)!==JSON.stringify(i.busyByDept)&&this.save({dash_busy_departments:r})}alertRows(){const e=Ge(this.doc?.ui),t=a=>`${String(a).padStart(2,"0")}:00`,s=a=>{const i=na(a.target.value);if(i===void 0){this.bad="stuck";return}this.bad="",i!==e.deptStuck&&this.save({dash_dept_stuck:i})};return n`<div class="row"><span class="lbl">${O("setDigestHour")}<span class="muted">${O("setDigestHourSub")}</span></span>
        <select class="num-in" style="inline-size:auto;min-inline-size:104px;text-align:start" aria-label=${O("setDigestHour")} data-digest-hour ?disabled=${this.disabled||this.busy}
          @change=${a=>void this.save({dash_digest_hour:Number(a.target.value)})}>
          ${Array.from({length:24},(a,i)=>n`<option value=${i} ?selected=${i===e.digestHour}>${t(i)}</option>`)}
        </select></div>
      <div class="row"><span class="lbl">${O("setDeptStuck")}<span class="muted">${O("setDeptStuckSub")}</span></span>
        <input type="text" inputmode="numeric" maxlength="3" size="4" class="num-in" .value=${String(e.deptStuck)} aria-label=${O("setDeptStuck")}
          aria-invalid=${String(this.bad==="stuck")} data-dept-stuck ?disabled=${this.disabled||this.busy} @change=${s} /></div>
      ${this.bad==="stuck"?n`<div class="row"><span class="field-error" role="alert" data-dept-stuck-error>${O("setDeptStuckInvalid")}</span></div>`:p}`}busyRows(){const e=Ge(this.doc?.ui),t=(s,a,i)=>n`<input type="text" inputmode="numeric" maxlength="2" size="3" class="num-in" .value=${a}
      placeholder=${s===null?"":String(e.busy)} aria-label=${i} aria-invalid=${String(this.bad===(s??"*"))} data-busy-input=${s??"*"}
      ?disabled=${this.disabled||this.busy} @change=${r=>this.onBusy(r,s)} />`;return n`<div class="row"><span class="lbl">${O("setBusy")}<span class="muted">${O("setBusySub")}</span></span>${t(null,String(e.busy),O("setBusy"))}</div>
      ${this.departments.length?n`<div class="row" data-busy-departments><span class="lbl">${O("setBusyDept")}<span class="muted">${O("setBusyDeptSub")}</span></span>
        <span class="busy-depts">${this.departments.map(s=>n`<label class="busy-dept"><span>${k(s.name)}</span>${t(s.id,e.busyByDept[s.id]?String(e.busyByDept[s.id]):"",`${O("setBusyDept")} · ${s.name}`)}</label>`)}</span></div>`:p}
      ${this.bad&&this.bad!=="stuck"?n`<div class="row"><span class="field-error" role="alert" data-busy-error>${O("setBusyInvalid")}</span></div>`:p}`}render(){const e=Ge(this.doc?.ui);return n`
      ${this.seg("dash_handler_numbers","setHandlerNumbers","setHandlerNumbersSub",sa,e.handlerNumbers,"hn_")}
      ${this.seg("dash_vendors","setVendors","setVendorsSub",aa,e.vendors,"vd_")}
      ${this.busyRows()}
      ${this.seg("dash_compare","setCompare","setCompareSub",ia,e.compare,"cp_")}
      ${this.alertRows()}
      ${this.error?n`<div class="row"><span class="field-error" role="alert" data-overview-settings-error>${this.error}</span></div>`:p}`}};De([E({attribute:!1})],fe.prototype,"doc",2);De([E({type:Boolean})],fe.prototype,"disabled",2);De([c()],fe.prototype,"busy",2);De([c()],fe.prototype,"error",2);De([c()],fe.prototype,"departments",2);De([c()],fe.prototype,"bad",2);fe=De([I("ticket-overview-settings")],fe);var sn=Object.defineProperty,an=Object.getOwnPropertyDescriptor,N=(e,t,s,a)=>{for(var i=a>1?void 0:a?an(t,s):t,r=e.length-1,d;r>=0;r--)(d=e[r])&&(i=(a?d(t,s,i):d(i))||i);return a&&i&&sn(t,s,i),i};const nn=[{key:"max_files",label:"stVuFiles",max:10,mb:!1},{key:"max_uploads",label:"stVuUploads",max:30,mb:!1},{key:"max_image_mb",label:"stVuImage",max:8,mb:!0},{key:"max_doc_mb",label:"stVuDoc",max:10,mb:!0},{key:"max_total_mb",label:"stVuTotal",max:50,mb:!0}],rn=Qs,We=["view","create","manage","external","all_departments","configure"],Ke=["external","all_departments","configure"];let D=class extends M{constructor(){super(...arguments),this.bubbleSkin=new le(this),this.tab="general",this.enabled=null,this.switching=!1,this.doc=null,this.names=null,this.draft=null,this.moreLangs=!1,this.departments=null,this.deletedDepts=[],this.installation=null,this.selected="",this.directory=null,this.holders=null,this.holdersBy="person",this.permsFailed=!1,this.grantUser="",this.grantScope="installation:*",this.grantUntil="",this.scopes=null,this.busy=!1,this.error="",this.publicError="",this.ok="",this.newDept={name:"",key:""},this.instDraft={},this.vuDraft={},this.okTimer=0,this.offNames=null,this.live=new zs(()=>{!this.enabled||this.busy||(this.tab==="departments"?this.loadDepartments().catch(()=>{}):this.tab==="permissions"&&this.holders&&g().holders().then(e=>this.holders=e).catch(()=>{}))}),this.onHash=()=>{if(window.location.hash.startsWith("#/system/tickets")){const e=this.tab;this.readTab(),e!==this.tab&&this.loadTab()}},this.onDeptChanged=e=>{const t=e.detail.dept;this.departments=(this.departments??[]).map(s=>s.id===t.id?t:s),e.detail.saved&&this.say(l("setSaved"))},this.onDeptDeleted=e=>{this.departments=(this.departments??[]).filter(t=>t.id!==e.detail.id),this.selected=this.departments[0]?.id??"",this.loadDepartments().catch(()=>{})},this.onNotice=e=>{e.detail.error?this.fail(e.detail.error):e.detail.ok&&this.say(e.detail.ok)}}connectedCallback(){super.connectedCallback(),bs(this),this.readTab(),window.addEventListener("hashchange",this.onHash),this.offNames=vs(()=>this.requestUpdate()),this.live.start(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),window.clearTimeout(this.okTimer),this.live.stop(),this.offNames?.()}readTab(){const e=new URLSearchParams(window.location.hash.split("?")[1]??"").get("tab");if(e==="contacts"){queueMicrotask(()=>window.location.replace(`${pt}?seg=vendors`));return}this.tab=Zs(e)?e:"general"}onTabKey(e,t){const s=Js(e.key,t.indexOf(this.tab),t.length,getComputedStyle(this).direction==="rtl");s!==null&&(e.preventDefault(),this.setTab(t[s]),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-settings-tab="${t[s]}"]`)?.focus()))}setTab(e){this.tab=rn.includes(e)?e:"general",$s("/system/tickets",this.tab==="general"?void 0:new URLSearchParams({tab:this.tab})),this.loadTab()}say(e){this.ok=e,this.error="",window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",3e3)}fail(e){this.ok="",this.error=typeof e=="string"?e:_(e)}async load(){this.error="";try{if(B()){const e=await fs(!0);this.enabled=String(e["tickets.enabled"]??"false")==="true"}else this.enabled=!0}catch(e){this.enabled=!1,this.fail(e)}this.enabled&&await this.loadTab()}async loadDepartments(){const e=await g().departments();this.departments=e.departments,this.deletedDepts=e.deleted??[],this.installation=e.installation??null,e.departments.some(t=>t.id===this.selected)||(this.selected=e.departments[0]?.id??"")}async loadTab(){if(this.enabled)try{if(this.tab==="general"){const e=await g().module();this.names={...e.name,revision:e.name_revision},this.draft||(this.draft=structuredClone(e.name)),(!B()||we("system.configure"))&&(this.doc=await g().settings())}else this.tab==="departments"?(await this.loadDepartments(),this.directory||(this.directory=await g().directory())):this.tab==="display"?(!B()||we("system.configure"))&&(this.doc=await g().settings()):this.tab==="channel"||this.tab==="messages"||this.tab==="costs"||this.tab==="locations"||this.tab==="rules"||(this.permsFailed=!1,this.error="",this.holders=await g().holders(),this.directory||(this.directory=await g().directory()),this.scopes||this.loadScopes())}catch(e){this.tab==="permissions"&&(this.permsFailed=!0,console.error("tickets permissions tab: load failed",e instanceof x?`api ${e.status}`:e instanceof Error?e.name:typeof e)),e instanceof x&&e.status===403?this.error=l("setNoPermission"):this.fail(e)}}async loadScopes(){const e=[{type:"installation",id:"*",label:l("permScopeAll")}];try{const t=await gs();for(const s of t.sites){e.push({type:"site",id:s.id,label:s.name});for(const a of s.buildings??[]){e.push({type:"building",id:a.id,label:`${s.name} ‹ ${a.name}`});for(const i of a.floors??[])e.push({type:"floor",id:i.id,label:`${s.name} ‹ ${a.name} ‹ ${i.name}`})}}}catch{}this.scopes=e}async setEnabled(e){this.switching=!0,this.error="";try{B()&&(await ys("settings",{"tickets.enabled":String(e)}),ws()),this.enabled=e,_s({"tickets.enabled":String(e)}),this.say(l("setSaved")),e&&await this.loadTab()}catch(t){this.fail(t)}finally{this.switching=!1}}nameError(e,t){const s=this.draft?.[e][t]??"";if(t==="module"&&!s.trim())return"";const a=ks(s);return a?l(`nameErr_${a}`):""}setName(e,t){this.draft&&(this.draft={...this.draft,[e]:{...this.draft[e],...t}})}async saveName(){const e=this.draft;if(!(!e||this.busy)){for(const t of Xe)if(this.nameError(t,"one")||this.nameError(t,"many")||this.nameError(t,"module"))return;this.busy=!0,this.error="";try{const t=await g().saveName(this.names?.revision??0,e);this.names=t;const{revision:s,...a}=t;this.draft=structuredClone(a),xs(a),this.say(l("setSaved"))}catch(t){if(this.fail(t),t instanceof x&&t.status===409){const s=await g().module().catch(()=>null);s&&(this.names={...s.name,revision:s.name_revision})}}finally{this.busy=!1}}}async saveDoc(e,t){if(!this.doc||this.busy)return;this.busy=!0,this.error="";const s=e.public!==void 0;s&&(this.publicError="");try{this.doc=await g().saveInstallation(this.doc.revision,e),t?.(),this.say(l("setSaved"))}catch(a){this.fail(a),s&&(this.publicError=this.error),a instanceof x&&a.status===409&&(this.doc=await g().settings().catch(()=>this.doc))}finally{this.busy=!1}}longPressRow(){const e=this.doc?.device_long_press??"sheet";return n`<div class="row" data-long-press><span class="lbl">${Be("setLongPress")}<span class="muted">${Be("setLongPressSub")}</span></span>
      <span class="seg" role="radiogroup" aria-label=${Be("setLongPress")}>${["sheet","menu"].map(t=>n`<button type="button" role="radio" aria-pressed=${String(e===t)} aria-checked=${String(e===t)} data-long-press-mode=${t} ?disabled=${this.busy} @click=${()=>void this.saveLongPress(t)}>${Be(`lp_${t}`)}</button>`)}</span></div>`}async saveLongPress(e){!this.doc||this.doc.device_long_press===e||await this.saveDoc({device_long_press:e},()=>Ss(this.doc?.device_long_press??e))}nameRow(e){const t=this.draft?.[e]??Le[e],s=!B()||we("tickets.configure"),a=this.nameError(e,"one"),i=this.nameError(e,"many"),r=this.nameError(e,"module"),d=Ds[e].filter(Boolean);return n`<div class="names" data-name-lang=${e} dir=${e==="en"||e==="ru"?"ltr":"rtl"}>
      <label>${l("setNameModule")}<input class="in" maxlength="30" data-name-module=${e} aria-invalid=${String(!!r)} ?disabled=${!s} .value=${t.module??""} @input=${o=>this.setName(e,{module:o.target.value})} />${r?n`<span class="field-error">${r}</span>`:p}</label>
      <label>${l("setNameOne")}<input class="in" maxlength="30" data-name-one=${e} aria-invalid=${String(!!a)} ?disabled=${!s} .value=${t.one} @input=${o=>this.setName(e,{one:o.target.value})} />${a?n`<span class="field-error">${a}</span>`:p}</label>
      <label>${l("setNameMany")}<input class="in" maxlength="30" data-name-many=${e} aria-invalid=${String(!!i)} ?disabled=${!s} .value=${t.many} @input=${o=>this.setName(e,{many:o.target.value})} />${i?n`<span class="field-error">${i}</span>`:p}</label>
      ${d.length?n`<label>${l("setNameGender")}<span class="seg" role="radiogroup" aria-label=${l("setNameGender")}>${d.map(o=>n`<button type="button" role="radio" aria-pressed=${String(t.gender===o)} aria-checked=${String(t.gender===o)} data-name-gender=${`${e}:${o}`} ?disabled=${!s} @click=${()=>this.setName(e,{gender:o})}>${l(`setGender_${o}`)}</button>`)}</span></label>`:n`<span></span>`}
    </div>`}linksCard(e){const t=e.links??{sliding_days:14,cap_days:90,grace_hours:24},s=this.instDraft,a={sliding:s.sliding??String(t.sliding_days),cap:s.cap??String(t.cap_days),grace:s.grace??String(t.grace_hours)},i=H(a.sliding,1,90),r=H(a.cap,7,365),d=H(a.grace,0,168),o=Number.isNaN(i)||Number.isNaN(r)||Number.isNaN(d)?"range":r<i?"below_sliding":null,u=i!==t.sliding_days||r!==t.cap_days||d!==t.grace_hours,h=($,R,P,T,ee,ce,m)=>n`
      <div class="row"><span class="lbl">${l(R)}<span class="muted">${l(P)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${ee} max=${ce} data-inst-link=${$} aria-label=${l(R)} aria-invalid=${String(m)} .value=${a[$]}
          @input=${Yt=>this.instDraft={...this.instDraft,[$]:Yt.target.value}} /><span class="muted">${l(T)}</span></span></div>`;return n`<sw-card heading=${l("setLinksCard")} data-card="links">
      ${h("sliding","setLinksSliding","setLinksSlidingSub","unit_d",1,90,Number.isNaN(i)||o==="below_sliding")}
      ${h("cap","setLinksCap","setLinksCapSub","unit_d",7,365,Number.isNaN(r)||o==="below_sliding")}
      ${h("grace","setLinksGrace","setLinksGraceSub","unit_h",0,168,Number.isNaN(d))}
      <div class="foot"><sw-button variant="primary" size="sm" data-inst-links-save ?disabled=${!u||!!o||this.busy}
        @click=${()=>void this.saveDoc({links:{sliding_days:i,cap_days:r,grace_hours:d}},()=>this.instDraft={...this.instDraft,sliding:void 0,cap:void 0,grace:void 0})}>${l("save")}</sw-button>
        ${o?n`<span class="field-error">${l(`err_${o}`)}</span>`:p}</div>
    </sw-card>`}hoursCard(e){const t=e.send_hours??{from:"07:00",to:"21:00"},s=this.instDraft.from??t.from,a=this.instDraft.to??t.to,i=It(s,a),r=s!==t.from||a!==t.to;return n`<sw-card heading=${l("setHoursCard")} data-card="hours">
      <div class="row"><span class="lbl">${l("setHoursRow")}<span class="muted">${l("setHoursRowSub")}</span></span>
        <span class="end"><input class="in time" type="time" lang=${be()} data-inst-hours="from" aria-label=${l("setHoursRow")} aria-invalid=${String(!!i)} .value=${s} @input=${d=>this.instDraft={...this.instDraft,from:d.target.value}} />
          <span class="muted">${l("hoursTo")}</span>
          <input class="in time" type="time" lang=${be()} data-inst-hours="to" aria-label=${`${l("setHoursRow")} · ${l("hoursTo")}`} aria-invalid=${String(!!i)} .value=${a} @input=${d=>this.instDraft={...this.instDraft,to:d.target.value}} /></span></div>
      <div class="row"><span class="lbl">${l("setUrgent")}<span class="muted">${l("setUrgentSub")}</span></span>
        <sw-toggle label=${l("setUrgent")} labelHidden .checked=${e.urgent_is_critical??!0} ?disabled=${this.busy} data-inst-urgent
          @change=${d=>void this.saveDoc({urgent_is_critical:d.detail.checked})}></sw-toggle></div>
      <!-- TKSET-POLISH-2331: the hours' save sits in the card's footer like the link card's (it saves the two time fields only; the switch saves at once) -->
      <div class="foot"><sw-button size="sm" variant="primary" data-inst-hours-save ?disabled=${!r||!!i||this.busy}
          @click=${()=>void this.saveDoc({send_hours:{from:s,to:a}},()=>this.instDraft={...this.instDraft,from:void 0,to:void 0})}>${l("save")}</sw-button>
        ${i?n`<span class="field-error">${l(`err_${i}`)}</span>`:p}</div>
    </sw-card>`}rfqTermsCard(e){const t=e.rfq?.schedule_arrival===!0,s=e.rfq?.arrival_reminder_hours??24,a=this.instDraft.arrHours??String(s),i=H(a,0,168),r=e.rfq?.question_reminder_hours??24,d=this.instDraft.qHours??String(r),o=H(d,0,168),u=e.rfq?.question_badge_all_viewers===!0;return n`<sw-card heading=${z("stRfqCard")} data-card="rfq-terms">
      <div class="row"><span class="lbl">${z("stScheduleArrival")}<span class="muted">${z("stScheduleArrivalSub")}</span></span>
        <sw-toggle label=${z("stScheduleArrival")} labelHidden .checked=${t} ?disabled=${this.busy} data-inst-schedule-arrival
          @change=${h=>void this.saveDoc({rfq:{schedule_arrival:h.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${z("stArrivalHours")}<span class="muted">${z("stArrivalHoursSub")}</span></span>
        <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-arrival-hours aria-label=${z("stArrivalHours")} aria-invalid=${String(Number.isNaN(i))} .value=${a}
          @input=${h=>this.instDraft={...this.instDraft,arrHours:h.target.value}} /><span class="muted">${l("unit_h")}</span>
          <sw-button size="sm" variant="primary" data-inst-arrival-save ?disabled=${Number.isNaN(i)||i===s||this.busy}
            @click=${()=>void this.saveDoc({rfq:{arrival_reminder_hours:i}},()=>this.instDraft={...this.instDraft,arrHours:void 0})}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${U("qReminder")}<span class="muted">${U("qReminderSub")}</span></span>
        <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-question-hours aria-label=${U("qReminder")} aria-invalid=${String(Number.isNaN(o))} .value=${d}
          @input=${h=>this.instDraft={...this.instDraft,qHours:h.target.value}} /><span class="muted">${l("unit_h")}</span>
          <sw-button size="sm" variant="primary" data-inst-question-save ?disabled=${Number.isNaN(o)||o===r||this.busy}
            @click=${()=>void this.saveDoc({rfq:{question_reminder_hours:o}},()=>this.instDraft={...this.instDraft,qHours:void 0})}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${U("qBadgeAll")}<span class="muted">${U("qBadgeAllSub")}</span></span>
        <sw-toggle label=${U("qBadgeAll")} labelHidden .checked=${u} ?disabled=${this.busy} data-inst-question-badge-all
          @change=${h=>void this.saveDoc({rfq:{question_badge_all_viewers:h.detail.checked}})}></sw-toggle></div>
      ${this.instalmentHoursRow(e)}
      ${this.awardNoticeRow(e)}
      ${this.lateHoursRow(e)}
    </sw-card>`}lateHoursRow(e){const t=e.rfq?.postpone_late_hours??24,s=this.instDraft.lateHours??String(t),a=H(s,0,720);return n`<div class="row"><span class="lbl">${U("ppLateHours")}<span class="muted">${U("ppLateHoursSub")}</span></span>
      <span class="unit"><input class="in num" type="number" min="0" max="720" data-inst-postpone-late aria-label=${U("ppLateHours")}
        aria-invalid=${String(Number.isNaN(a))} .value=${s}
        @input=${i=>this.instDraft={...this.instDraft,lateHours:i.target.value}} /><span class="muted">${l("unit_h")}</span>
        <sw-button size="sm" variant="primary" data-inst-postpone-late-save ?disabled=${Number.isNaN(a)||a===t||this.busy}
          @click=${()=>void this.saveDoc({rfq:{postpone_late_hours:a}},()=>this.instDraft={...this.instDraft,lateHours:void 0})}>${l("save")}</sw-button></span></div>`}awardNoticeRow(e){const t=e.rfq?.award_notice??"confirm";return n`<div class="row"><span class="lbl">${U("anSetting")}<span class="muted">${U("anSettingSub")}</span></span>
      <select class="in" data-inst-award-notice aria-label=${U("anSetting")} ?disabled=${this.busy}
        @change=${s=>void this.saveDoc({rfq:{award_notice:s.target.value}})}>
        ${["confirm","auto","off"].map(s=>n`<option value=${s} ?selected=${t===s}>${U(`anMode_${s}`)}</option>`)}
      </select></div>`}instalmentHoursRow(e){const t=e.rfq?.instalment_reminder_hours??24,s=this.instDraft.insHours??String(t),a=H(s,0,168);return n`<div class="row"><span class="lbl">${z("stInstalmentHours")}<span class="muted">${z("stInstalmentHoursSub")}</span></span>
      <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-instalment-hours aria-label=${z("stInstalmentHours")}
        aria-invalid=${String(Number.isNaN(a))} .value=${s}
        @input=${i=>this.instDraft={...this.instDraft,insHours:i.target.value}} /><span class="muted">${l("unit_h")}</span>
        <sw-button size="sm" variant="primary" data-inst-instalment-save ?disabled=${Number.isNaN(a)||a===t||this.busy}
          @click=${()=>void this.saveDoc({rfq:{instalment_reminder_hours:a}},()=>this.instDraft={...this.instDraft,insHours:void 0})}>${l("save")}</sw-button></span></div>`}generalTab(){const e=!B()||we("system.configure"),t=!B()||we("tickets.configure"),s=!B()||we("tickets.configure")||ut("tickets.manage"),a=this.draft?.he??Le.he,i=!!this.draft&&!!this.names&&Xe.some($=>JSON.stringify(this.draft?.[$])!==JSON.stringify(this.names?.[$])),r=a.one||Le.he.one,d=a.many||Le.he.many,o=["{module}","{ticket} {f:חדשה|m:חדש}","{the_tickets} {f:פתוחות|m:פתוחים}"].map($=>Cs($,{one:r,many:d,gender:a.gender,module:a.module?.trim()||Ns("he",r,d)})),u=n`<sw-card heading=${l("setModuleCard")} data-card="module">
        <div class="row"><span class="lbl">${l("setModuleSwitch")}<span class="muted">${l("setModuleSwitchSub")}</span></span>
          <sw-toggle label=${l("setModuleSwitch")} labelHidden .checked=${!!this.enabled} ?disabled=${!e||this.switching} data-tickets-enabled @change=${$=>void this.setEnabled($.detail.checked)}></sw-toggle></div>
        ${this.enabled&&this.draft?n`<div class="row stack" data-name-editor>
          <span class="lbl">${l("setName")}<span class="muted">${l("setNameSub")}</span></span>
          ${this.nameRow("he")}
          <div class="preview" data-name-preview aria-label=${l("setNamePreview")}>${o.map($=>n`<span class="tag acc">${k($)}</span>`)}</div>
          <div class="chipsrow"><button type="button" class="rc" aria-pressed=${String(this.moreLangs)} data-name-more @click=${()=>this.moreLangs=!this.moreLangs}>${l("setNameOtherLangs")}</button></div>
          ${this.moreLangs?Xe.filter($=>$!=="he").map($=>n`<div class="lang">${l(`lang_${$}`)}</div>${this.nameRow($)}`):p}
          ${t?n`<div class="foot"><sw-button variant="primary" size="sm" data-name-save ?disabled=${!i||this.busy} @click=${()=>void this.saveName()}>${l("save")}</sw-button>
            <sw-button size="sm" variant="ghost" data-name-default ?disabled=${this.busy} @click=${()=>this.draft=structuredClone(Le)}>${l("setNameDefault")}</sw-button></div>`:p}
        </div>`:p}
        ${this.enabled?p:n`<div class="row"><span class="muted" data-module-off>${l("setModuleOff")}</span></div>`}
      </sw-card>`,h=this.enabled&&s?n`<sw-card heading=${l("setHandlersCard")} data-card="handlers-link">
        <div class="row"><span class="lbl">${l("hdSeg_handlers")} · ${l("hdSeg_vendors")} · ${l("hdSeg_contacts")}</span>
          <a class="btnlink" href=${pt} data-to-handlers>${l("setHandlersOpen")}</a></div>
      </sw-card>`:p;return this.enabled&&this.doc&&e?n`<div class="sgrid" data-settings-cols>
      <div class="col">
        ${u}
        ${h}
        <tickets-public-card .doc=${this.doc} ?busy=${this.busy} ?remote=${Ts()} .saveError=${this.publicError} @save-doc=${$=>void this.saveDoc($.detail.patch)}
          @notice=${this.onNotice}></tickets-public-card>
      </div>
      <div class="col">
        ${this.linksCard(this.doc)}
        ${this.hoursCard(this.doc)}
        ${B()&&e?n`<sw-card heading=${f("card")} data-card="notify-matrix">
          <ticket-notify-matrix .doc=${this.doc} ?disabled=${this.busy} @doc-changed=${$=>{this.doc=$.detail,this.say(l("setSaved"))}}></ticket-notify-matrix>
        </sw-card>`:p}
        <tickets-work-calendar-card .doc=${this.doc} ?busy=${this.busy} @save-doc=${$=>void this.saveDoc($.detail.patch)}></tickets-work-calendar-card>
        ${B()&&e?n`<sw-card heading=${se("card")} data-card="visits-settings">
          <ticket-visits-settings .doc=${this.doc} ?disabled=${this.busy} @doc-changed=${$=>{this.doc=$.detail,this.say(l("setSaved"))}}></ticket-visits-settings>
        </sw-card>`:p}
        ${this.rfqTermsCard(this.doc)}
        ${this.vendorUploadsCard(this.doc)}
      </div>
    </div>`:n`<div class="sgrid one" data-settings-cols><div class="col">${u}${h}</div></div>`}vendorUploadsCard(e){const t=e.rfq?.vendor_uploads,s={max_files:t?.max_files??5,max_uploads:t?.max_uploads??10,max_image_mb:t?.max_image_mb??8,max_doc_mb:t?.max_doc_mb??10,max_total_mb:t?.max_total_mb??20},a=nn.map(o=>{const u=this.vuDraft[o.key]??String(s[o.key]);return{...o,raw:u,n:H(u,1,o.max)}}),i=a.some(o=>Number.isNaN(o.n))||a[1].n<a[0].n,r=a.some(o=>o.n!==s[o.key]),d=Object.fromEntries(a.map(o=>[o.key,o.n]));return n`<sw-card heading=${z("stVendorUploads")} data-card="rfq-vendor-uploads">
      <div class="row"><span class="lbl">${z("stVendorUploadsOn")}<span class="muted">${z("stVendorUploadsOnSub")}</span></span>
        <sw-toggle label=${z("stVendorUploadsOn")} labelHidden .checked=${t?.enabled===!0} ?disabled=${this.busy} data-inst-vendor-uploads
          @change=${o=>void this.saveDoc({rfq:{vendor_uploads:{enabled:o.detail.checked}}})}></sw-toggle></div>
      ${a.map(o=>n`<div class="row"><span class="lbl">${z(o.label)}<span class="muted">${z("stVuMax",{n:o.max})}</span></span>
        <span class="unit"><input class="in num" type="number" min="1" max=${o.max} data-inst-vu=${o.key} aria-label=${z(o.label)} aria-invalid=${String(Number.isNaN(o.n))}
          .value=${o.raw} @input=${u=>this.vuDraft={...this.vuDraft,[o.key]:u.target.value}} />${o.mb?n`<span class="muted">MB</span>`:p}</span></div>`)}
      <div class="foot"><sw-button size="sm" variant="primary" data-inst-vu-save ?disabled=${i||!r||this.busy}
        @click=${()=>void this.saveDoc({rfq:{vendor_uploads:d}},()=>this.vuDraft={})}>${l("save")}</sw-button>
        ${a[1].n<a[0].n?n`<span class="field-error">${z("stVuUploadsBelow")}</span>`:p}</div>
    </sw-card>`}displayTab(){if(!this.doc)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.doc;return n`<div class="sgrid" data-settings-cols data-display-tab>
      <div class="col">
        <sw-card heading=${l("u6CardOpen")} data-card="display">
          <div class="row"><span class="lbl">${l("setDetail")}<span class="muted">${l("setDetailSub")}</span></span>
            <span class="seg" role="radiogroup" aria-label=${l("setDetail")}>${["drawer","fullscreen","drawer_fullscreen"].map(t=>n`<button type="button" role="radio" aria-pressed=${String(e.ui.detail===t)} aria-checked=${String(e.ui.detail===t)} data-ui-detail=${t} ?disabled=${this.busy} @click=${()=>void this.saveDoc({ui:{detail:t}})}>${l(`d_${t}`)}</button>`)}</span></div>
          <div class="row"><span class="lbl">${l("setNewTicket")}<span class="muted">${l("setNewTicketSub")}</span></span>
            <span class="seg" role="radiogroup" aria-label=${l("setNewTicket")}>${["sheet","dialog"].map(t=>n`<button type="button" role="radio" aria-pressed=${String(e.ui.new_ticket===t)} aria-checked=${String(e.ui.new_ticket===t)} data-ui-new=${t} ?disabled=${this.busy} @click=${()=>void this.saveDoc({ui:{new_ticket:t}})}>${l(`n_${t}`)}</button>`)}</span></div>
          ${this.requestDrawerRows(e)}
        </sw-card>
      </div>
      <div class="col">
        <sw-card heading=${l("u6CardBoard")} data-card="display-board">
          <ticket-board-settings .doc=${e} ?disabled=${this.busy} @doc-changed=${t=>{this.doc=t.detail,this.say(l("setSaved"))}}></ticket-board-settings>
        </sw-card>
        <sw-card heading=${l("u6CardDevice")} data-card="display-device">${this.longPressRow()}</sw-card>
        <sw-card heading=${O("setCard")} data-card="display-overview">
          <ticket-overview-settings .doc=${e} ?disabled=${this.busy} @doc-changed=${t=>{this.doc=t.detail,this.say(l("setSaved"))}}></ticket-overview-settings>
        </sw-card>
      </div>
    </div>`}requestDrawerRows(e){return e.ui.detail_tab===void 0?p:ra(e.ui,this.busy,t=>void this.saveDoc({ui:t}))}async addDepartment(){const e=this.newDept.name.trim();if(!(!e||this.busy)){this.busy=!0;try{const t=await g().createDepartment({name:e});this.departments=[...this.departments??[],t],this.selected=t.id,this.newDept={name:"",key:""},this.say(l("setSaved")),this.loadDepartments().catch(()=>{})}catch(t){this.fail(t)}finally{this.busy=!1}}}async restoreDepartment(e){if(!this.busy){this.busy=!0;try{const t=await g().restoreDepartment(e);await this.loadDepartments(),this.selected=t.id,this.say(l("depRestored"))}catch(t){this.fail(t)}finally{this.busy=!1}}}deletedCard(){return this.deletedDepts.length?n`<sw-card data-card="dept-deleted"><details data-dept-deleted>
      <summary>${l("depDeletedList")} · ${this.deletedDepts.length}</summary>
      <div class="people">${ke(this.deletedDepts,e=>e.id,e=>n`<div class="person" data-dept-deleted-item=${e.id}>
        <span class="who">${k(e.name)} <span class="muted">${ht(new Date(e.deleted_at))}</span></span>
        <sw-button size="sm" data-dept-restore=${e.id} ?disabled=${this.busy} @click=${()=>void this.restoreDepartment(e.id)}>${l("depRestore")}</sw-button>
      </div>`)}</div>
    </details></sw-card>`:p}departmentsTab(){if(!this.departments)return n`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.departments.find(t=>t.id===this.selected)??null;return n`<div class="split" data-dept-split>
      <div class="stack">
        <sw-card heading=${l("depListTitle")} data-card="dept-list">
          ${this.departments.length?n`<div class="dlist" role="list">${ke(this.departments,t=>t.id,t=>n`<button type="button" role="listitem" class=${`ditem ${t.active?"":"off"}`}
            aria-current=${String(t.id===this.selected)} data-dept-item=${t.id} @click=${()=>this.selected=t.id}>
            <span class="txt"><span class="nm">${k(t.name)}</span>
              <span class="sub">${l("depSummary",{c:t.categories.filter(s=>s.active).length,p:t.priorities.filter(s=>s.active).length,m:t.members.length})}</span></span>
            ${t.active?p:n`<span class="tag">${l("depInactive")}</span>`}</button>`)}</div>`:n`<sw-state-panel icon="ticket" state="empty" heading=${l("depNone")}></sw-state-panel>`}
          <div class="foot">
            <input class="in" maxlength="40" data-dept-new-name placeholder=${l("depName")} aria-label=${l("depAdd")} .value=${this.newDept.name} @input=${t=>this.newDept={...this.newDept,name:t.target.value}}
              @keydown=${t=>{t.key==="Enter"&&this.addDepartment()}} />
            <sw-button size="sm" variant="primary" icon="plus" data-dept-add ?disabled=${this.busy||!this.newDept.name.trim()} @click=${()=>void this.addDepartment()}>${l("depNewShort")}</sw-button>
          </div>
        </sw-card>
        ${this.deletedCard()}
      </div>
      ${e?n`<tickets-dept-editor .dept=${e} .directory=${this.directory} .installation=${this.installation}
        @dept-changed=${this.onDeptChanged} @dept-deleted=${this.onDeptDeleted} @notice=${this.onNotice} @dept-reload=${()=>void this.loadDepartments().catch(()=>{})}></tickets-dept-editor>`:p}
    </div>`}grantOf(e,t){return this.holders?.users.find(s=>s.id===e)?.grants.find(s=>s.via==="grant"&&s.role_id===`tickets_${t}`)}async toggleGrant(e,t){const s=this.grantUser;if(!(!s||this.busy)){this.busy=!0;try{const a=`tickets_${e}`;if(t){const[i,...r]=this.grantScope.split(":"),d=this.grantUntil?new Date(`${this.grantUntil}T23:59:59`).toISOString().replace(/\.\d+Z$/,"Z"):null;await Vs({subject_kind:"user",subject_id:s,role_id:a,scope_type:i,scope_id:r.join(":"),...d?{expires_at:d}:{}})}else{const i=this.grantOf(s,e);i&&await Xs(i.binding_id)}this.holders=await g().holders(),this.say(l("setSaved"))}catch(a){this.fail(a)}finally{this.busy=!1}}}viaText(e){const t=e.via==="grant"?l("via_grant"):e.via==="group"?l("via_group",{group:e.group_name??""}):l("via_role",{role:e.role_name}),s=e.scope_type!=="installation"?` · ${l("permScope",{scope:e.scope_name||e.scope_id||"–"})}`:"",a=e.expires_at?` · ${l("permUntil",{date:ht(new Date(e.expires_at))})}`:"";return t+s+a}matrixCard(){const e=this.holders?.roles??[];return e.length?n`<sw-card heading=${l("permHolders")} data-card="matrix">
      <div class="gridwrap" data-perm-matrix>
        <table class="matrix">
          <thead><tr><th>${l("permMatrixRole")}</th>${We.map(t=>n`<th>${l(`p_${t}`)}${Ke.includes(t)?n`<br /><span class="tag warn">${l("sensitive")}</span>`:p}</th>`)}</tr></thead>
          <tbody>${e.map(t=>n`<tr data-role=${t.id}><td>${k(t.name??t.id)}${t.builtin?p:n` <span class="tag">${l("permCustom")}</span>`}</td>
            ${We.map(s=>t.permissions.includes(`tickets.${s}`)?n`<td class="yes" aria-label=${l("yes")}><sw-icon name="check" size="18"></sw-icon></td>`:n`<td class="no" aria-label=${l("no")}><sw-icon name="minus" size="16"></sw-icon></td>`)}</tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards">${e.map(t=>n`<div class="pcard" data-role-card=${t.id}><h4>${k(t.name??t.id)}</h4>
        <div class="chipsrow">${(t.permissions??[]).length?(t.permissions??[]).map(s=>n`<span class="tag">${Lt(s)}</span>`):n`<span class="muted">–</span>`}</div></div>`)}</div>
      <div class="foot"><a href="#/system/access" data-to-roles>${l("permToRoles")}</a></div>
    </sw-card>`:n``}holdersCard(){const e=this.holders,t=Lt,s=n`${e.users.length?n`<div class="people">${ke(e.users,i=>i.id,i=>n`<div class="person" data-holder=${i.id}>
        <span class="who">${k(i.name??i.id)}${i.active?p:n` <span class="tag warn">${l("permInactive")}</span>`}</span>
        ${i.grants.map(r=>n`<span class="chipsrow">${r.permissions.map(d=>n`<span class=${`tag ${Ke.includes(d.replace(/^tickets\./,""))?"warn":""}`}>${t(d)}</span>`)}${r.effect==="deny"?n`<span class="tag warn">${l("permDeny")}</span>`:p}<span class="via">${this.viaText(r)}</span></span>`)}
      </div>`)}</div>`:n`<span class="muted">${l("permNone")}</span>`}`,a=n`<div class="people">${We.map(i=>{const r=e.users.filter(d=>d.grants.some(o=>o.effect==="allow"&&o.permissions.includes(`tickets.${i}`)));return n`<div class="person" data-holder-perm=${i}><span class="who">${l(`p_${i}`)}${Ke.includes(i)?n` <span class="tag warn">${l("sensitive")}</span>`:p}</span>
        <span class="chipsrow">${r.length?r.map(d=>n`<span class="tag">${k(d.name??d.id)}</span>`):n`<span class="muted">${l("permNobody")}</span>`}</span></div>`})}</div>`;return n`<sw-card heading=${l("permPeople")} data-card="holders">
      <span class="seg sm" slot="actions" role="radiogroup" aria-label=${l("permPeople")}>
        ${["person","perm"].map(i=>n`<button type="button" role="radio" aria-pressed=${String(this.holdersBy===i)} aria-checked=${String(this.holdersBy===i)} data-holders-by=${i} @click=${()=>this.holdersBy=i}>${i==="person"?l("permByPerson"):l("permByPerm")}</button>`)}</span>
      ${this.holdersBy==="person"?s:a}
      <div class="foot"><a href="#/system/access" data-to-users>${l("permToUsers")}</a></div>
    </sw-card>`}grantCard(){const e=!B()||ut("rbac.assign"),t=new Date().toISOString().slice(0,10);return n`<sw-card heading=${l("permGrantCard")} data-card="grant">
      ${e?n`
        <div class="row"><span class="lbl">${l("permGrantUser")}</span>
          <select class="in" data-grant-user aria-label=${l("permGrantPick")} @change=${s=>this.grantUser=s.target.value}>
            <option value="" ?selected=${!this.grantUser}>${l("permGrantPick")}</option>
            ${(this.directory?.users??[]).map(s=>n`<option value=${s.id} ?selected=${s.id===this.grantUser}>${s.name}</option>`)}
          </select></div>
        ${this.grantUser?n`
          <div class="row"><span class="lbl">${l("permGrantScope")}</span>
            <select class="in" data-grant-scope aria-label=${l("permGrantScope")} @change=${s=>this.grantScope=s.target.value}>
              ${(this.scopes??[{type:"installation",id:"*",label:l("permScopeAll")}]).map(s=>n`<option value=${`${s.type}:${s.id}`} ?selected=${this.grantScope===`${s.type}:${s.id}`}>${s.label}</option>`)}
            </select></div>
          <div class="row"><span class="lbl">${l("permGrantUntil")}</span>
            <input class="in" type="date" lang=${be()} min=${t} data-grant-until aria-label=${l("permGrantUntil")} .value=${this.grantUntil} @input=${s=>this.grantUntil=s.target.value} /></div>
          <div class="chipsrow" data-grant-perms>${We.map(s=>{const a=this.grantOf(this.grantUser,s);return n`<button type="button" class="rc" aria-pressed=${String(!!a)} data-grant=${s} ?disabled=${this.busy} title=${a?this.viaText(a):""} @click=${()=>void this.toggleGrant(s,!a)}><sw-icon name=${a?"check":"plus"} size="16"></sw-icon>${l(`p_${s}`)}${Ke.includes(s)?` · ${l("sensitive")}`:""}</button>`})}</div>`:p}`:n`<div class="row"><span class="muted">${l("permGrantNoAssign")}</span><a href="#/system/access">${l("permToUsers")}</a></div>`}
    </sw-card>`}permissionsTab(){if(this.permsFailed)return this.permsError();if(!this.holders)return n`<sw-state-panel state="loading"></sw-state-panel>`;try{return n`<div class="sgrid" data-settings-cols><div class="col">${this.matrixCard()}</div><div class="col">${this.holdersCard()}${this.grantCard()}</div></div>`}catch(e){return console.error("tickets permissions tab: render failed",e instanceof Error?e.name:typeof e),this.permsError()}}permsError(){return n`<sw-state-panel state="error" heading=${l("permLoadFailed")} data-perms-error>
      <sw-button size="sm" data-perms-retry @click=${()=>{this.permsFailed=!1,this.holders=null,this.loadTab()}}>${l("permRetry")}</sw-button>
    </sw-state-panel>`}render(){const e=l("area");if(this.enabled===null)return n`<div class="page" data-tickets-settings><div class="ttl lead-head"><div class="crumbs">הגדרות</div><h1>${e}</h1></div><sw-state-panel state="loading"></sw-state-panel></div>`;const t={general:l("setTabGeneral"),departments:l("setTabDepartments"),locations:y("tab"),display:l("u6TabDisplay"),channel:v("tabChannel"),messages:v("tabTemplates"),costs:S("setTab"),rules:b("tab"),permissions:l("setTabPermissions")},s=ea({api:B(),can:we}).map(r=>({id:r,label:t[r]})),a=this.enabled?n`<div class="stabs"><div class="seg sm" role="tablist" aria-label=${e} data-tickets-settings-tabs @keydown=${r=>this.onTabKey(r,s.map(d=>d.id))}>${s.map(r=>n`<button type="button" role="tab"
      aria-selected=${String(this.tab===r.id)} tabindex=${this.tab===r.id?"0":"-1"} data-settings-tab=${r.id} @click=${()=>this.setTab(r.id)}>${r.label}</button>`)}</div></div>`:p,i=!this.enabled||this.tab==="general"?this.generalTab():this.tab==="departments"?this.departmentsTab():this.tab==="display"?this.displayTab():this.tab==="channel"?n`<tickets-channel-settings @notice=${this.onNotice}></tickets-channel-settings>`:this.tab==="messages"?n`<tickets-message-templates @notice=${this.onNotice}></tickets-message-templates>`:this.tab==="costs"?n`<tickets-costs-settings @notice=${this.onNotice}></tickets-costs-settings>`:this.tab==="locations"?n`<tickets-locations-settings @notice=${this.onNotice}></tickets-locations-settings>`:this.tab==="rules"?n`<tickets-rules-settings @notice=${this.onNotice}></tickets-rules-settings>`:this.permissionsTab();return n`<div class="page" data-tickets-settings data-tab=${this.tab}>
      ${a}
      <div class="ttl lead-head"><div class="crumbs">הגדרות</div><h1>${e}</h1><div class="sub">${l("setSub")}</div></div>
      <div class="tbody">${i}</div>
      ${this.error?n`<div class="toast bad" role="alert" data-tickets-settings-error><sw-icon name="warning" size="18"></sw-icon><span class="tx">${this.error}</span>
        <button type="button" class="x" aria-label=${Os("actions.close")} data-tickets-settings-error-close @click=${()=>this.error=""}><sw-icon name="close" size="16"></sw-icon></button></div>`:this.ok?n`<div class="toast" role="status" data-tickets-settings-ok><sw-icon name="check" size="18"></sw-icon><span class="tx">${this.ok}</span></div>`:p}
    </div>`}};D.styles=[re,...Es,Ys,X,Z,Y`
    :host {
      --sw-card-bg: var(--mm-sheen), var(--dv-surface);
      --sw-card-radius: var(--sw-r-2xl);
      --sw-card-shadow: var(--dv-shadow-1);
      --sw-card-blur: var(--dv-surface-blur);
      --sw-card-pad: 16px 20px;
      --sw-card-title-fs: var(--sw-fs-lg);
      --sw-card-title-fw: 700;
      --sw-seg-border: transparent;
      --sw-seg-radius: 999px;
      --sw-seg-btn-radius: 999px;
      --sw-seg-track: var(--dv-surface-3);
      --sw-seg-pad: 3px;
      --sw-seg-gap: 2px;
      --sw-seg-h: var(--sw-touch-desktop);
      --sw-seg-divider: 0 solid transparent;
      --sw-seg-on-bg: var(--mm-seg-thumb);
      --sw-seg-on-fg: var(--dv-text);
      --sw-seg-on-shadow: var(--dv-shadow-control);
    }
    /* MGRDASH: the "busy" threshold fields of the manager overview card (tickets/overview-settings.ts) */
    .num-in {
      inline-size: 4.5em;
      min-block-size: 36px;
      box-sizing: border-box;
      padding-inline: 10px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--dv-border-strong);
      background: var(--dv-surface-2);
      color: var(--dv-text);
      font: inherit;
      text-align: center;
      font-variant-numeric: tabular-nums;
    }
    .num-in[aria-invalid='true'] {
      border-color: var(--dv-danger);
    }
    .busy-depts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      justify-content: flex-end;
    }
    .busy-dept {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .page {
      max-inline-size: 1320px;
      margin-inline: auto;
      inline-size: 100%;
      box-sizing: border-box;
      gap: 16px;
    }
    .stabs {
      position: sticky;
      inset-block-start: 0;
      z-index: 15;
      display: flex;
      justify-content: center;
      padding: 12px 0 4px;
      pointer-events: none;
    }
    .stabs .seg {
      pointer-events: auto;
      overflow-x: auto;
      scrollbar-width: none;
      max-inline-size: 100%;
      box-shadow: var(--dv-shadow-1);
    }
    .stabs .seg::-webkit-scrollbar {
      display: none;
    }
    .stabs .seg button {
      min-block-size: 40px;
      padding-inline: 18px;
    }
    .ttl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: flex-start;
      padding-inline-end: var(--sw-float-reserve, 0px);
    }
    .ttl .crumbs {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .ttl h1 {
      font-size: var(--sw-fs-3xl);
    }
    .ttl .sub {
      font-size: var(--sw-fs-md);
      color: var(--dv-text-2);
    }
    .sgrid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      align-items: start;
      min-inline-size: 0;
    }
    .sgrid.one {
      grid-template-columns: minmax(0, 640px);
    }
    .sgrid > .col {
      display: flex;
      flex-direction: column;
      gap: 18px;
      min-inline-size: 0;
    }
    .split,
    .stack {
      max-inline-size: none;
    }
    /* TKSET-POLISH-2331: the tab body is its own size container - the two card columns need ~1000 px of the PAGE (not of the shell
       around it): at 1024 the shell container was still above 900 px while each column was ~420 px, and a row's label broke one word
       per line beside its segmented control. Below 1000 px of the body the cards take one column. */
    .tbody {
      container: tkset / inline-size;
      min-inline-size: 0;
    }
    @container tkset (max-width: 999px) {
      .sgrid,
      .sgrid.one {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    /* a number field keeps its unit on its own line ("24 שעות", never the unit under the field) */
    .unit {
      flex-wrap: nowrap;
    }
    /* the card's own actions in its header (the holders' person / permission switch) instead of a row with an empty label */
    sw-card .seg[slot='actions'] {
      flex: none;
    }
    sw-card[data-card='holders'] {
      --sw-card-head-wrap: wrap;
    }
    /* the permissions matrix: drawn marks instead of text glyphs; "no" is quiet, "yes" carries the success tone */
    .matrix td.yes sw-icon {
      color: var(--sw-success-text);
    }
    .matrix td.no sw-icon {
      color: var(--sw-text-3);
    }
    [data-grant] {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    [data-grant] sw-icon {
      flex: none;
    }
    /* the save receipt and the error of any card: a toast at the bottom of the viewport (the card that was saved may be far below the
       title, where the old inline line sat out of sight). The error stays until it is dismissed or the next action starts. */
    .toast sw-icon {
      flex: none;
      color: var(--sw-success);
    }
    /* A11Y-POLISHED-2342: the bare danger red read 2.8-3.0:1 on the light scheme's toast pill (domus, tesla); the shared failure icon
       recipe of styles/media-page.ts (the danger ink mixed toward the toast's own ink) holds >= 4.3:1 light and >= 3.3:1 dark */
    .toast.bad .ic,
    .toast.bad sw-icon {
      color: color-mix(in srgb, var(--sw-danger) 70%, var(--sw-toast-text));
    }
    .toast .tx {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .toast .x {
      display: inline-grid;
      place-items: center;
      flex: none;
      inline-size: 32px;
      block-size: 32px;
      margin-inline: 4px -8px;
      border: 0;
      border-radius: var(--sw-r-pill);
      background: transparent;
      color: inherit;
      cursor: pointer;
      position: relative;
    }
    .toast .x::after {
      content: '';
      position: absolute;
      inset: -6px;
    }
    .toast .x:hover {
      background: color-mix(in srgb, currentColor 12%, transparent);
    }
    .toast .x:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    /* TKNOTIFMATRIX: the picked users / roles of a department's digest (tickets/notify-matrix.ts, light DOM) */
    .nm-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
    }
    .nm-chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding-inline: 10px 4px;
      min-block-size: 32px;
      border-radius: 999px;
      background: var(--dv-surface-3);
      color: var(--dv-text);
      font-size: var(--sw-fs-sm);
    }
    .nm-x {
      inline-size: 28px;
      block-size: 28px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--dv-text-2);
      font: inherit;
      cursor: pointer;
    }
    .nm-x:hover {
      background: var(--dv-surface-2);
      color: var(--dv-text);
    }
    details[data-dept-deleted] summary {
      cursor: pointer;
      min-block-size: 44px;
      display: flex;
      align-items: center;
      font-weight: var(--sw-fw-medium);
    }
    .btnlink {
      display: inline-flex;
      align-items: center;
      flex: none;
      min-block-size: 44px;
      padding-inline: 16px;
      border-radius: var(--dv-radius-control);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface-2);
      color: var(--dv-accent-text);
      font-weight: var(--sw-fw-medium);
      text-decoration: none;
    }
    .btnlink:hover {
      border-color: var(--dv-accent);
    }
    /* a narrow page: the seven tabs wrap onto rows instead of scrolling sideways (nothing hidden behind a scroll) */
    @container (max-width: 900px) {
      /* integ/291: the bubble skin's own ".seg" rule (999 px pill, higher specificity) used to win here; with nine tabs the wrapped
         strip is three rows high at 320 px and that pill corner reached the text of the last row's end buttons (layout guard: "text
         in the rounded corner"). The wrapped strip keeps this rule's radius in the bubble skin too. */
      .stabs .seg,
      :host([data-skin='bubble']) .stabs .seg {
        flex-wrap: wrap;
        overflow: visible;
        justify-content: center;
        border-radius: var(--sw-r-xl);
      }
      .stabs .seg button {
        flex: 1 1 auto;
      }
    }
    @media (max-width: 767px) {
      .page {
        padding: 0 14px 26px;
      }
      .stabs {
        justify-content: stretch;
      }
      .stabs .seg {
        inline-size: 100%;
      }
      /* TKGATEFIX4: the display tab's choices on a phone - the row stacks, so the segmented control takes the line and its options
         share it; an option's text may wrap (the glass sheet's .seg button is nowrap, and "מגירה + מסך מלא" pushed the third option
         13-20 px out of its track at 320 px) */
      [data-display-tab] .row .seg {
        inline-size: 100%;
      }
      [data-display-tab] .row .seg button {
        flex: 1 1 0;
        min-inline-size: 0;
        padding-inline: 8px;
        white-space: normal;
        text-align: center;
        line-height: 1.25;
      }
    }
  `];N([c()],D.prototype,"tab",2);N([c()],D.prototype,"enabled",2);N([c()],D.prototype,"switching",2);N([c()],D.prototype,"doc",2);N([c()],D.prototype,"names",2);N([c()],D.prototype,"draft",2);N([c()],D.prototype,"moreLangs",2);N([c()],D.prototype,"departments",2);N([c()],D.prototype,"deletedDepts",2);N([c()],D.prototype,"installation",2);N([c()],D.prototype,"selected",2);N([c()],D.prototype,"directory",2);N([c()],D.prototype,"holders",2);N([c()],D.prototype,"holdersBy",2);N([c()],D.prototype,"permsFailed",2);N([c()],D.prototype,"grantUser",2);N([c()],D.prototype,"grantScope",2);N([c()],D.prototype,"grantUntil",2);N([c()],D.prototype,"scopes",2);N([c()],D.prototype,"busy",2);N([c()],D.prototype,"error",2);N([c()],D.prototype,"publicError",2);N([c()],D.prototype,"ok",2);N([c()],D.prototype,"newDept",2);N([c()],D.prototype,"instDraft",2);N([c()],D.prototype,"vuDraft",2);D=N([I("system-tickets")],D);export{D as SystemTickets};
//# sourceMappingURL=system-tickets-BscgETpW.js.map
