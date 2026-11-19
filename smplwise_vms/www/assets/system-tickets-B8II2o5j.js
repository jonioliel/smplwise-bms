import{b as r,aU as le,cx as Je,g as X,ax as O,j as c,i as M,aL as de,o as l,m as g,a as x,n as _,A as p,k as I,a6 as k,bd as xe,ek as ve,DV as Bt,bG as Ce,bH as Ue,bD as hs,cC as ms,fO as Ft,a2 as B,bm as bs,br as lt,b5 as Kt,eH as dt,kG as vs,kH as $s,hr as fs,bx as me,DZ as f,D_ as gs,c6 as ws,D$ as mt,cJ as ys,p as _s,aA as _e,R as ks,bn as xs,dM as Ss,E0 as Ds,E1 as Cs,E2 as Qe,ey as Ns,pI as Ke,E3 as Ts,gF as Ae,E4 as Es,a3 as bt,E5 as Os,E6 as Ps,mp as zs,e$ as vt,bA as Ls,dF as $t,ez as Rs}from"./index-BdSK43oz.js";import{b as Gt,B as As,L as Hs}from"./tickets-board-BcF6VRA7.js";import{a4 as Ms,S as Is,X as js,a1 as Ge,a5 as qs,a6 as Us,a7 as Bs,m as ue,a as v,w as Fs,p as ft,q as Te,E as Ks,a8 as Gs,d as Vs}from"./drawer-model-BrhPaWN_.js";import{d as se}from"./drawer-text-XRTX9Bm-.js";import{F as Ws,U as Xs,V as Ys,i as et,a as C,W as Zs,X as Js,Y as gt,Z as wt,_ as Qs}from"./table-model-OVxLICgD.js";import{l as He}from"./list-text-BX_Ag0K8.js";import{s as Y}from"./settings-Co3BHT1u.js";import{t as Z}from"./settings-styles-NUb978Ob.js";import{t as yt}from"./tickets-s4-ByiiXPY5.js";import{ticketCostsApi as Ve,COST_MODES as _t,CURRENCIES as ea,LINE_KINDS as ta}from"./tickets-costs-C_cDSXY_.js";import{c as S,b as kt,k as sa,z as aa,A as ia}from"./cost-model-9tzoAv12.js";import{i as xt,t as Ee,j as na,k as ra,m as la,q as St,a as w,r as da,u as oa,D as ca,b as pa,N as ua,S as ha,C as ma}from"./org-locations-text-DouZba9b.js";import{createBinding as ba,revokeBinding as va}from"./access-DChoB2Nk.js";import{a as $a}from"./automations-glass-Bjeogezg.js";import{m as fa}from"./media-page-Bba1E437.js";import{a as ga}from"./glass-BQ4jQ_Ld.js";import{r as z}from"./rfq-text-CEevXjXG.js";import{H as wa,o as We,I as ya,V as _a,J as ka,K as xa}from"./overview-model-CZ6DxOQ6.js";import{o as E}from"./overview-text-AdS-jz3o.js";import{t as Sa}from"./chip-selected-Cy9V7LYD.js";import"./sw-logo-art-PLtEZJxU.js";import"./tickets-costs-mock-C0MNIRvL.js";import"./bytes-QYSxC3WX.js";import"./pad-CImDeuHV.js";import"./lead-reserve-_yBql0OS.js";function Da(e,t,s){const a=Ms(e?.detail_tab)??"overview",i=Is(e?.drawer_size)??"wide",n=js(e?.phone_sheet)??"full",o=(d,u,h,$,R,P)=>r`<sw-segmented radio label=${se(d)} value=${h} ?disabled=${t} @change=${T=>s({[P]:T.detail.value})}
      .options=${u.map(T=>({value:T,label:$(T),attrs:{"data-ui-drawer":`${R}:${T}`}}))}></sw-segmented>`;return r`
    <div class="row" data-setting="detail_tab"><span class="lbl">${se("setDrawerTab")}<span class="muted">${se("setDrawerTabSub")}</span></span>
      ${o("setDrawerTab",qs,a,d=>se(`tab_${d}`),"tab","detail_tab")}</div>
    <div class="row" data-setting="drawer_size"><span class="lbl">${se("setDrawerSize")}<span class="muted">${se("setDrawerSizeSub")}</span></span>
      ${o("setDrawerSize",Us,i,d=>se(`size_${d}`),"size","drawer_size")}</div>
    <div class="row" data-setting="phone_sheet"><span class="lbl">${se("setPhoneSheet")}<span class="muted">${se("setPhoneSheetSub")}</span></span>
      ${o("setPhoneSheet",Bs,n,d=>se(`ps_${d}`),"sheet","phone_sheet")}</div>
    ${Ca(e,t,s)}`}function Ca(e,t,s){const a=e?.camera_viewfinder===!0;return r`<div class="row" data-setting="camera_viewfinder"><span class="lbl">${Ge("set_label")}<span class="muted">${Ge("set_sub")}</span></span>
    <sw-segmented radio label=${Ge("set_label")} value=${a?"on":"off"} ?disabled=${t} @change=${i=>s({camera_viewfinder:i.detail.value==="on"})}
      .options=${[!1,!0].map(i=>({value:i?"on":"off",label:Ge(i?"set_on":"set_off"),attrs:{"data-ui-drawer":`camera_viewfinder:${i?"on":"off"}`}}))}></sw-segmented></div>`}function Na(e,t,s){const a=Ws(e?.table_mid_width),i=n=>n==="sentence"?He("tmSentence"):He("tmDepartment");return r`<div class="row" data-setting="table_mid_width"><span class="lbl">${He("setTableMid")}<span class="muted">${He("setTableMidSub")}</span></span>
    <sw-segmented radio label=${He("setTableMid")} value=${a} ?disabled=${t} @change=${n=>s({table_mid_width:n.detail.value})}
      .options=${Xs.map(n=>({value:n,label:i(n),attrs:{"data-ui-table-mid":n}}))}></sw-segmented></div>`}const Ta={min:1,h:60,d:1440},Ea=365*24*60,Ze=["unassigned_after_min","link_unopened_min","ack_within_min","stuck_after_min","stuck_waiting_min","resolve_within_min","remind_every_min"],Ie=["max_reminders","manager_alert_after_steps"];function Oa(e){return e==null||!Number.isFinite(e)||e<=0?null:e%1440===0?{value:e/1440,unit:"d"}:e%60===0?{value:e/60,unit:"h"}:{value:e,unit:"min"}}function Pa(e,t){const s=e.trim();if(!s)return null;if(!/^\d{1,6}$/.test(s))return Number.NaN;const a=Number(s)*Ta[t];return a>=1&&a<=Ea?a:Number.NaN}function za(e){const t=e.trim();if(!/^\d{1,2}$/.test(t))return Number.NaN;const s=Number(t);return s<=10?s:Number.NaN}function H(e,t,s){const a=e.trim();if(!/^-?\d{1,4}$/.test(a))return Number.NaN;const i=Number(a);return i>=t&&i<=s?i:Number.NaN}const Dt=/^([01]\d|2[0-3]):[0-5]\d$/;function Vt(e,t){return!Dt.test(e)||!Dt.test(t)?"time":e<t?null:"order"}function La(e,t){const s=t.link_sliding_days??e.sliding_days,a=Math.max(t.link_cap_days??e.cap_days,s);return{sliding_days:s,cap_days:a,grace_hours:t.link_grace_hours??e.grace_hours}}function Ra(e,t){const s={},a=[];for(const i of Ze){const n=t[i];if(!n)continue;const o=Pa(n.raw,n.unit);Number.isNaN(o)?a.push(i):o!==e[i]&&(s[i]=o)}for(const i of Ie){const n=t[i];if(n===void 0)continue;const o=za(n);Number.isNaN(o)?a.push(i):o!==e[i]&&(s[i]=o)}return{changes:s,invalid:a}}var Aa=Object.defineProperty,Ha=Object.getOwnPropertyDescriptor,ze=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ha(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Aa(t,s,i),i};const Ma=["min","h","d"];let $e=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.readonly=!1,this.drafts={},this.busy=!1,this.error=""}stored(e){return Object.fromEntries([...Ze,...Ie].map(t=>[t,e[t]]))}cell(e,t){const s=this.drafts[e.priority_id]?.[t];if(s)return s;const a=Oa(e[t]);return a?{raw:String(a.value),unit:a.unit}:{raw:"",unit:t==="link_unopened_min"||t==="resolve_within_min"?"h":"min"}}set(e,t,s){const a=this.cell(e,t);this.drafts={...this.drafts,[e.priority_id]:{...this.drafts[e.priority_id],[t]:{...a,...s}}}}setCounter(e,t,s){this.drafts={...this.drafts,[e.priority_id]:{...this.drafts[e.priority_id],[t]:s}}}analysis(){const e=[],t=new Set;for(const s of this.dept.sla){const a=this.drafts[s.priority_id];if(!a)continue;const{changes:i,invalid:n}=Ra(this.stored(s),a);for(const o of n)t.add(`${s.priority_id}:${o}`);Object.keys(i).length&&e.push({priority_id:s.priority_id,revision:s.revision,...i})}return{rows:e,invalid:t}}async save(){const{rows:e,invalid:t}=this.analysis();if(t.size){this.error=l("slaInvalid");return}if(!(!e.length||this.busy)){this.busy=!0,this.error="";try{const s=await g().saveSla(this.dept.id,e);this.drafts={},this.dispatchEvent(new CustomEvent("dept-changed",{detail:{dept:s,saved:!0},bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof x&&s.status===409?l("slaStale"):_(s),s instanceof x&&s.status===409&&(this.drafts={},this.dispatchEvent(new CustomEvent("dept-reload",{bubbles:!0,composed:!0})))}finally{this.busy=!1}}}durationInput(e,t,s){const a=this.cell(e,t),i=s.has(`${e.priority_id}:${t}`),n=`${l(`sla_${t}`)} · ${e.priority_name}`;return r`<span class="cell">
      <input class="in" inputmode="numeric" maxlength="6" aria-label=${n} placeholder=${l("slaOff")} aria-invalid=${String(i)} ?disabled=${this.readonly||this.busy}
        data-sla=${`${e.priority_key}:${t}`} .value=${a.raw} @input=${o=>this.set(e,t,{raw:o.target.value})} />
      <select class="in" aria-label=${`${n} · ${l("unit_h")}`} ?disabled=${this.readonly||this.busy} data-sla-unit=${`${e.priority_key}:${t}`}
        @change=${o=>this.set(e,t,{unit:o.target.value})}>
        ${Ma.map(o=>r`<option value=${o} ?selected=${a.unit===o}>${l(`unit_${o}`)}</option>`)}
      </select></span>`}counterInput(e,t,s){const a=this.drafts[e.priority_id]?.[t]??String(e[t]);return r`<input class="in num" inputmode="numeric" maxlength="2" aria-label=${`${l(`sla_${t}`)} · ${e.priority_name}`}
      aria-invalid=${String(s.has(`${e.priority_id}:${t}`))} ?disabled=${this.readonly||this.busy} data-sla=${`${e.priority_key}:${t}`} .value=${a}
      @input=${i=>this.setCounter(e,t,i.target.value)} />`}render(){const{rows:e,invalid:t}=this.analysis(),s=e.length>0||t.size>0,a=[...Ze,...Ie];return r`
      <div class="gridwrap" data-sla-grid>
        <table class="sla">
          <thead><tr><th></th>${this.dept.sla.map(i=>r`<th data-sla-col=${i.priority_key}>${i.priority_name}</th>`)}</tr></thead>
          <tbody>${a.map(i=>r`<tr data-sla-row=${i}>
            <td class="pn">${l(`sla_${i}`)}</td>
            ${this.dept.sla.map(n=>r`<td>${Ie.includes(i)?this.counterInput(n,i,t):this.durationInput(n,i,t)}</td>`)}
          </tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards" data-sla-cards>${this.dept.sla.map(i=>r`<div class="pcard" data-sla-card=${i.priority_key}>
        <h4>${i.priority_name}</h4>
        ${Ze.map(n=>r`<div class="pr"><span>${l(`sla_${n}`)}</span>${this.durationInput(i,n,t)}</div>`)}
        ${Ie.map(n=>r`<div class="pr"><span>${l(`sla_${n}`)}</span>${this.counterInput(i,n,t)}</div>`)}
      </div>`)}</div>
      ${this.readonly?p:r`<div class="foot">
        <sw-button variant="primary" size="sm" data-sla-save ?disabled=${!s||this.busy} @click=${()=>void this.save()}>${l("save")}</sw-button>
        ${s?r`<sw-button size="sm" variant="ghost" data-sla-cancel ?disabled=${this.busy} @click=${()=>{this.drafts={},this.error=""}}>${l("cancel")}</sw-button>`:p}
        <span class="grow"></span>
        ${this.error?r`<span class="msg err" role="alert" data-sla-error>${this.error}</span>`:r`<span class="muted">${s?l("unsaved"):l("slaEmptyIsOff")}</span>`}
      </div>`}`}};$e.styles=[Y,Z,X`
    ${Je}
  `,le];ze([O({attribute:!1})],$e.prototype,"dept",2);ze([O({type:Boolean})],$e.prototype,"readonly",2);ze([c()],$e.prototype,"drafts",2);ze([c()],$e.prototype,"busy",2);ze([c()],$e.prototype,"error",2);$e=ze([I("tickets-sla-grid")],$e);var Ia=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,oe=(e,t,s,a)=>{for(var i=a>1?void 0:a?ja(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Ia(t,s,i),i};const qa=["info","alert","critical"],Ua=["urgent","high","normal","low"],Ba={links:{sliding_days:14,cap_days:90,grace_hours:24},send_hours:{from:"07:00",to:"21:00"},urgent_is_critical:!0};let V=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.directory=null,this.installation=null,this.dr={},this.catSel="",this.tplOpen="",this.tplDraft=null,this.busy=!1,this.deleting=!1}willUpdate(e){const t=e.get("dept");t&&t.id!==this.dept.id&&(this.deleting=!1,this.dr={},this.catSel="",this.tplOpen="",this.tplDraft=null)}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}set(e){this.dr={...this.dr,...e}}async act(e,t){if(!this.busy){this.busy=!0;try{const s=await e();s&&this.emit("dept-changed",{dept:s}),t?.(),this.emit("notice",{ok:l("setSaved")}),this.emit("dept-reload")}catch(s){this.emit("notice",{error:_(s)}),s instanceof x&&s.status===409&&this.emit("dept-reload")}finally{this.busy=!1}}}patchDept(e,t){return this.act(()=>g().patchDepartment(this.dept.id,{...e,revision:this.dept.revision}),t)}get inst(){return this.installation??Ba}basicsCard(){const e=this.dept,t=this.dr.name??e.name,s=this.dr.description??e.description,a=this.dr.reopen_days??String(e.reopen_days);return r`<sw-card heading=${e.name} subheading=${`${e.key} · ${l("depOpenTickets",{n:e.open_tickets})}`} data-dept=${e.id} data-card="dept-basics">
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
    </sw-card>`}deleteConfirm(e){const t=e.open_tickets>0;return r`<div class="danger" role="group" data-dept-delete-confirm data-open=${e.open_tickets} data-members=${e.members.length}>
      <b>${l("depDeleteAsk",{name:e.name})}</b>
      ${t?r`<span data-dept-delete-blocked>${l("depDeleteBlocked",{n:e.open_tickets})}</span>`:r`<span>${l("depDeleteMembers",{n:e.members.length})}</span><span>${l("depDeleteRestorable")}</span>`}
      <span class="chipsrow">
        ${t?p:r`<sw-button size="sm" variant="danger" data-dept-delete-ok ?disabled=${this.busy} @click=${()=>void this.removeDepartment()}>${l("depDelete")}</sw-button>`}
        <sw-button size="sm" variant="ghost" data-dept-delete-cancel @click=${()=>this.deleting=!1}>${l("ctCancel")}</sw-button></span>
    </div>`}async removeDepartment(){if(!this.busy){this.deleting=!1,this.busy=!0;try{await g().deleteDepartment(this.dept.id),this.emit("dept-deleted",{id:this.dept.id}),this.emit("notice",{ok:l("setSaved")})}catch(e){this.emit("notice",{error:_(e)})}finally{this.busy=!1}}}catDraft(e){return this.dr.cat??{parent:e.parent_id??"",prio:e.default_priority_id??"",domains:(e.domains??[]).join(", ")}}categoriesRow(){const e=this.dept,t=e.categories.filter(d=>d.active),s=t.find(d=>d.id===this.catSel),a=s?this.catDraft(s):null,i=a?a.domains.split(",").map(d=>d.trim()).filter(Boolean):[],n=i.some(d=>!/^[a-z][a-z0-9_]{0,39}$/.test(d))||i.length>20,o=d=>d.parent_id?t.find(u=>u.id===d.parent_id)?.name:null;return r`<div class="row stack"><span class="lbl">${l("depCategories")}</span>
      <div class="chipsrow" data-dept-categories>${t.length?t.map(d=>r`<span class="tag">
        <button type="button" class="tag" aria-pressed=${String(this.catSel===d.id)} data-cat=${d.id} @click=${()=>{this.catSel=this.catSel===d.id?"":d.id,this.set({cat:void 0})}}>${o(d)?`${k(o(d)??"")} ‹ `:""}${k(d.name)}</button>
        <button type="button" class="rm" aria-label=${`${l("depRemove")} ${d.name}`} data-cat-remove=${d.id} ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteCategory(d.id))}>×</button></span>`):r`<span class="muted">${l("depCatNone")}</span>`}</div>
      ${s&&a?r`<div class="fields" data-cat-editor=${s.id}>
        <label class="fld">${l("catParent")}<select class="in" data-cat-parent @change=${d=>this.set({cat:{...a,parent:d.target.value}})}>
          <option value="" ?selected=${!a.parent}>${l("catNoParent")}</option>
          ${t.filter(d=>d.id!==s.id&&!d.parent_id).map(d=>r`<option value=${d.id} ?selected=${a.parent===d.id}>${d.name}</option>`)}
        </select></label>
        <label class="fld">${l("catDefaultPrio")}<select class="in" data-cat-prio @change=${d=>this.set({cat:{...a,prio:d.target.value}})}>
          <option value="" ?selected=${!a.prio}>${l("catNoPrio")}</option>
          ${e.priorities.filter(d=>d.active).map(d=>r`<option value=${d.id} ?selected=${a.prio===d.id}>${d.name}</option>`)}
        </select></label>
        <label class="fld">${l("catDomains")}<input class="in" dir="ltr" maxlength="400" data-cat-domains aria-invalid=${String(n)} placeholder="climate, fan" .value=${a.domains}
          @input=${d=>this.set({cat:{...a,domains:d.target.value}})} /><span>${l("catDomainsSub")}</span></label>
      </div>
      <div class="add"><sw-button size="sm" variant="primary" data-cat-save ?disabled=${this.busy||n}
        @click=${()=>void this.act(()=>g().patchCategory(s.id,{parent_id:a.parent||null,default_priority_id:a.prio||null,domains:i}),()=>this.set({cat:void 0}))}>${l("save")}</sw-button></div>`:p}
      <div class="add"><input class="in" maxlength="60" data-cat-new placeholder=${l("depCatAdd")} .value=${this.dr.category??""} @input=${d=>this.set({category:d.target.value})} />
        <sw-button size="sm" icon="plus" ?disabled=${this.busy||!(this.dr.category??"").trim()} data-cat-add @click=${()=>void this.act(()=>g().createCategory(e.id,(this.dr.category??"").trim()),()=>this.set({category:""}))}>${l("depMemberAdd")}</sw-button></div>
    </div>`}membersRow(){const e=this.dept,t=[...(this.directory?.users??[]).filter(s=>!e.members.some(a=>a.kind==="user"&&a.id===s.id)).map(s=>({v:`user:${s.id}`,label:s.name})),...(this.directory?.groups??[]).filter(s=>!e.members.some(a=>a.kind==="group"&&a.id===s.id)).map(s=>({v:`group:${s.id}`,label:`${s.name} (${l("depGroupTag")})`}))];return r`<div class="row stack"><span class="lbl">${l("depMembers")}${e.can_edit_members?p:r`<span class="muted">${l("depMembersLocked")}</span>`}</span>
      <div class="people" data-dept-members>${e.members.length?xe(e.members,s=>`${s.kind}:${s.id}`,s=>r`<div class="person" data-member=${`${s.kind}:${s.id}`}>
        <span class="who">${k(s.name)}${s.kind==="group"?r` <span class="tag">${l("depGroupTag")}</span>`:p}</span>
        <sw-segmented radio label=${s.name} value=${s.role} ?disabled=${this.busy||!e.can_edit_members}
        @change=${a=>{const i=a.detail.value;i!==s.role&&this.act(()=>g().putMember(e.id,s.kind,s.id,i))}}
        .options=${["manager","member"].map(a=>({value:a,label:a==="manager"?l("depManager"):l("depMember"),disabled:s.role===a,attrs:{"data-member-role":a}}))}></sw-segmented>
        ${s.role==="manager"&&e.can_edit_members?r`<sw-toggle label=${l("depNotifyNew")} .checked=${s.notify_new} ?disabled=${this.busy} data-member-notify
          @change=${a=>void this.act(()=>g().putMember(e.id,s.kind,s.id,s.role,a.detail.checked))}></sw-toggle>`:p}
        ${e.can_edit_members?r`<button type="button" class="rm" data-member-remove ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteMember(e.id,s.kind,s.id))}>${l("depRemove")}</button>`:p}
      </div>`):r`<span class="muted">${l("depNoMembers")}</span>`}</div>
      ${e.can_edit_members?r`<div class="add">
        <select class="in" data-member-pick aria-label=${l("depMemberPick")} @change=${s=>this.set({member:s.target.value})}>
          <option value="" ?selected=${!this.dr.member}>${l("depMemberPick")}</option>
          ${t.map(s=>r`<option value=${s.v} ?selected=${this.dr.member===s.v}>${s.label}</option>`)}
        </select>
        <select class="in" data-member-new-role aria-label=${l("depMembers")} @change=${s=>this.set({role:s.target.value})}>
          <option value="member" ?selected=${(this.dr.role??"member")==="member"}>${l("depMember")}</option>
          <option value="manager" ?selected=${this.dr.role==="manager"}>${l("depManager")}</option>
        </select>
        <sw-button size="sm" icon="plus" ?disabled=${this.busy||!this.dr.member} data-member-add @click=${()=>{const[s,...a]=(this.dr.member??"").split(":");this.act(()=>g().putMember(e.id,s,a.join(":"),this.dr.role??"member"),()=>this.set({member:""}))}}>${l("depMemberAdd")}</sw-button>
      </div>`:p}</div>`}prioritiesCard(){const e=this.dept;return r`<sw-card heading=${l("depPriorities")} data-card="dept-priorities">
      ${e.priorities.map(t=>r`<div class="row" data-prio=${t.key}>
        <span class="end start">
          <input class="in" maxlength="30" aria-label=${`${l("depPrioName")} · ${t.name}`} data-prio-name=${t.key} .value=${t.name}
            @change=${s=>{const a=s.target.value.trim();a&&a!==t.name&&this.act(()=>g().patchPriority(t.id,{name:a}))}} />
          <select class="in" aria-label=${`${l("depPrioSeverity")} · ${t.name}`} data-prio-severity=${t.key} ?disabled=${this.busy}
            @change=${s=>void this.act(()=>g().patchPriority(t.id,{notify_severity:s.target.value}))}>
            ${qa.map(s=>r`<option value=${s} ?selected=${t.severity===s}>${l(`sev_${s}`)}</option>`)}
          </select></span>
        <span class="end">
          ${t.is_default?r`<span class="tag ok" data-prio-default=${t.key}>${l("depDefault")}</span>`:r`<button type="button" class="rc" data-prio-make-default=${t.key} ?disabled=${this.busy||!t.active} @click=${()=>void this.act(()=>g().patchPriority(t.id,{is_default:!0}))}>${l("depMakeDefault")}</button>`}
          <sw-toggle label=${l("depPrioActive")} .checked=${t.active} ?disabled=${this.busy||t.is_default} data-prio-active=${t.key}
            @change=${s=>void this.act(()=>g().patchPriority(t.id,{active:s.detail.checked}))}></sw-toggle>
        </span></div>`)}
    </sw-card>`}policyCard(){const e=this.dept,t=e.overrides,s=this.inst,a=e.auto_close_after_days,i=this.dr.autoDays??String(a??3),n=t.link_sliding_days!==null||t.link_cap_days!==null||t.link_grace_hours!==null||this.dr.links!==void 0,o=La(s.links,t),d=this.dr.links??{sliding:String(o.sliding_days),cap:String(o.cap_days),grace:String(o.grace_hours)},u=H(d.sliding,1,90),h=H(d.cap,7,365),$=H(d.grace,0,168),R=Number.isNaN(u)||Number.isNaN(h)||Number.isNaN($)?"range":h<u?"below_sliding":null,P=t.send_hours!==null||this.dr.hours!==void 0,T=this.dr.hours??t.send_hours??s.send_hours,ee=Vt(T.from,T.to),pe=t.urgent_is_critical;return r`<sw-card heading=${l("depPolicy")} data-card="dept-policy">
      <div class="row"><span class="lbl">${l("depHistory")}<span class="muted">${l("depHistorySub")}</span></span>
        <sw-toggle label=${l("depHistory")} labelHidden .checked=${e.share_history_external} ?disabled=${this.busy} data-dept-history
          @change=${m=>void this.patchDept({share_history_external:m.detail.checked})}></sw-toggle></div>
      <div class="row"><span class="lbl">${l("depAutoClose")}<span class="muted">${l("depAutoCloseSub")}</span></span>
        <span class="end">${a!==null?r`<span class="unit"><span class="muted">${l("depAutoCloseDays")}</span>
            <input class="in num" type="number" min="1" max="30" data-dept-autoclose-days aria-label=${l("depAutoCloseDays")} aria-invalid=${String(Number.isNaN(H(i,1,30)))} .value=${i}
              @input=${m=>this.set({autoDays:m.target.value})} />
            <sw-button size="sm" ?disabled=${this.busy||Number(i)===a||Number.isNaN(H(i,1,30))} data-dept-autoclose-save
              @click=${()=>void this.patchDept({auto_close_after_days:Number(i)},()=>this.set({autoDays:void 0}))}>${l("save")}</sw-button></span>`:p}
          <sw-toggle label=${l("depAutoClose")} labelHidden .checked=${a!==null} ?disabled=${this.busy} data-dept-autoclose
            @change=${m=>void this.patchDept({auto_close_after_days:m.detail.checked?Number.isNaN(H(i,1,30))?3:Number(i):null},()=>this.set({autoDays:void 0}))}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${l("depUrgent")}</span>
        <sw-segmented radio label=${l("depUrgent")} value=${pe===null?"inherit":String(pe)} ?disabled=${this.busy}
          @change=${m=>{const te=m.detail.value==="inherit"?null:m.detail.value==="true";pe!==te&&this.patchDept({urgent_is_critical:te})}}
          .options=${[null,!0,!1].map(m=>({value:m===null?"inherit":String(m),label:m===null?l("depUrgentInherit",{v:s.urgent_is_critical?l("yes"):l("no")}):m?l("yes"):l("no"),attrs:{"data-dept-urgent":m===null?"inherit":String(m)}}))}></sw-segmented></div>
      <div class="row stack" data-dept-links-row><span class="lbl">${l("depLinks")}<span class="muted">${l("depLinksSub",{s:s.links.sliding_days,c:s.links.cap_days,g:s.links.grace_hours})}</span></span>
        <div class="add"><sw-toggle label=${l("depOwn")} .checked=${n} ?disabled=${this.busy} data-dept-links-own
          @change=${m=>{m.detail.checked?this.set({links:{sliding:String(o.sliding_days),cap:String(o.cap_days),grace:String(o.grace_hours)}}):this.patchDept({link_sliding_days:null,link_cap_days:null,link_grace_hours:null},()=>this.set({links:void 0}))}}></sw-toggle></div>
        ${n?r`<div class="fields">
          <label class="fld">${l("setLinksSliding")} (${l("unit_d")})<input class="in num" type="number" min="1" max="90" data-dept-link="sliding" aria-invalid=${String(Number.isNaN(u)||R==="below_sliding")} .value=${d.sliding} @input=${m=>this.set({links:{...d,sliding:m.target.value}})} /></label>
          <label class="fld">${l("setLinksCap")} (${l("unit_d")})<input class="in num" type="number" min="7" max="365" data-dept-link="cap" aria-invalid=${String(Number.isNaN(h)||R==="below_sliding")} .value=${d.cap} @input=${m=>this.set({links:{...d,cap:m.target.value}})} /></label>
          <label class="fld">${l("setLinksGrace")} (${l("unit_h")})<input class="in num" type="number" min="0" max="168" data-dept-link="grace" aria-invalid=${String(Number.isNaN($))} .value=${d.grace} @input=${m=>this.set({links:{...d,grace:m.target.value}})} /></label>
        </div>
        <div class="add"><sw-button size="sm" variant="primary" data-dept-links-save ?disabled=${this.busy||!!R||!this.dr.links}
          @click=${()=>void this.patchDept({link_sliding_days:u,link_cap_days:h,link_grace_hours:$},()=>this.set({links:void 0}))}>${l("save")}</sw-button>
          ${R&&this.dr.links?r`<span class="field-error">${l(`err_${R}`)}</span>`:p}</div>`:p}
      </div>
      <div class="row stack" data-dept-hours-row><span class="lbl">${l("depHours")}<span class="muted">${l("depHoursSub",{from:s.send_hours.from,to:s.send_hours.to})}</span></span>
        <div class="add"><sw-toggle label=${l("depOwn")} .checked=${P} ?disabled=${this.busy} data-dept-hours-own
          @change=${m=>{m.detail.checked?this.set({hours:{...t.send_hours??s.send_hours}}):this.patchDept({send_hours:null},()=>this.set({hours:void 0}))}}></sw-toggle></div>
        ${P?r`<div class="add">
          <input class="in time" type="time" lang=${ve()} data-dept-hours="from" aria-label=${l("depHours")} aria-invalid=${String(!!ee)} .value=${T.from} @input=${m=>this.set({hours:{...T,from:m.target.value}})} />
          <span class="muted">${l("hoursTo")}</span>
          <input class="in time" type="time" lang=${ve()} data-dept-hours="to" aria-label=${`${l("depHours")} · ${l("hoursTo")}`} aria-invalid=${String(!!ee)} .value=${T.to} @input=${m=>this.set({hours:{...T,to:m.target.value}})} />
          <sw-button size="sm" variant="primary" data-dept-hours-save ?disabled=${this.busy||!!ee||!this.dr.hours}
            @click=${()=>void this.patchDept({send_hours:{from:T.from,to:T.to}},()=>this.set({hours:void 0}))}>${l("save")}</sw-button>
          ${ee?r`<span class="field-error">${l(`err_${ee}`)}</span>`:p}
        </div>`:p}
      </div>
    </sw-card>`}openTpl(e){if(e&&this.tplOpen===e.id){this.tplOpen="",this.tplDraft=null;return}this.tplOpen=e?e.id:"new",this.tplDraft={name:e?.name??"",title:e?.title??"",body:e?.body??"",category_id:e?.category_id??"",priority_key:e?.priority_key??""}}tplForm(e){const t=this.tplDraft,s=n=>this.tplDraft={...t,...n},a={name:t.name.trim(),title:t.title.trim(),body:t.body.trim(),category_id:t.category_id||null,priority_key:t.priority_key||null},i=()=>{this.tplOpen="",this.tplDraft=null};return r`<div class="fields" data-tpl-form=${e?.id??"new"}>
        <label class="fld">${l("tplName")}<input class="in" maxlength="60" data-tpl-name .value=${t.name} @input=${n=>s({name:n.target.value})} /></label>
        <label class="fld">${l("tplTitle")}<input class="in" maxlength="120" data-tpl-title .value=${t.title} @input=${n=>s({title:n.target.value})} /></label>
        <label class="fld">${l("tplCategory")}<select class="in" data-tpl-category @change=${n=>s({category_id:n.target.value})}>
          <option value="" ?selected=${!t.category_id}>${l("tplAny")}</option>
          ${this.dept.categories.filter(n=>n.active).map(n=>r`<option value=${n.id} ?selected=${t.category_id===n.id}>${n.name}</option>`)}</select></label>
        <label class="fld">${l("tplPriority")}<select class="in" data-tpl-priority @change=${n=>s({priority_key:n.target.value})}>
          <option value="" ?selected=${!t.priority_key}>${l("tplAny")}</option>
          ${Ua.map(n=>r`<option value=${n} ?selected=${t.priority_key===n}>${this.dept.priorities.find(o=>o.key===n)?.name??n}</option>`)}</select></label>
      </div>
      <label class="fld">${l("tplBody")}<textarea class="in" maxlength="4000" data-tpl-body .value=${t.body} @input=${n=>s({body:n.target.value})}></textarea></label>
      <div class="add">
        <sw-button size="sm" variant="primary" data-tpl-save ?disabled=${this.busy||!t.name.trim()}
          @click=${()=>void this.act(()=>e?g().patchTemplate(e.id,{...a,revision:e.revision}):g().createTemplate(this.dept.id,a),i)}>${l("save")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${i}>${l("cancel")}</sw-button>
        ${e?r`<span class="grow"></span><sw-button size="sm" variant="danger" data-tpl-delete ?disabled=${this.busy} @click=${()=>void this.act(()=>g().deleteTemplate(e.id),i)}>${l("depRemove")}</sw-button>`:p}
      </div>`}templatesCard(){const e=this.dept.templates;return r`<sw-card heading=${l("tplCard")} data-card="dept-templates">
      <div class="stack">
        ${e.length?e.map(t=>r`<div class="tpl" data-tpl=${t.id}>
          <div class="tplhead"><span class="nm">${k(t.name)}</span>
            <span class="end"><sw-toggle label=${l("tplActive")} .checked=${t.active} ?disabled=${this.busy} data-tpl-active
              @change=${s=>void this.act(()=>g().patchTemplate(t.id,{active:s.detail.checked,revision:t.revision}))}></sw-toggle>
              <sw-button size="sm" variant="ghost" data-tpl-edit @click=${()=>this.openTpl(t)}>${l("depEdit")}</sw-button></span></div>
          ${this.tplOpen===t.id&&this.tplDraft?this.tplForm(t):t.title?r`<span class="muted">${t.title}</span>`:p}
        </div>`):r`<span class="muted">${l("tplNone")}</span>`}
        ${this.tplOpen==="new"&&this.tplDraft?r`<div class="tpl" data-tpl="new">${this.tplForm(null)}</div>`:r`<div class="add"><sw-button size="sm" icon="plus" data-tpl-new ?disabled=${this.busy||e.length>=50} @click=${()=>this.openTpl(null)}>${l("tplNew")}</sw-button></div>`}
      </div>
    </sw-card>`}render(){return this.dept?r`
      ${this.basicsCard()}
      ${this.policyCard()}
      <sw-card heading=${l("slaCard")} data-card="dept-sla"><tickets-sla-grid .dept=${this.dept}></tickets-sla-grid></sw-card>
      ${this.prioritiesCard()}
      ${this.templatesCard()}`:p}};V.styles=[Y,Z,X`
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
  `,le];oe([O({attribute:!1})],V.prototype,"dept",2);oe([O({attribute:!1})],V.prototype,"directory",2);oe([O({attribute:!1})],V.prototype,"installation",2);oe([c()],V.prototype,"dr",2);oe([c()],V.prototype,"catSel",2);oe([c()],V.prototype,"tplOpen",2);oe([c()],V.prototype,"tplDraft",2);oe([c()],V.prototype,"busy",2);oe([c()],V.prototype,"deleting",2);V=oe([I("tickets-dept-editor")],V);const Fa=/^https:\/\/([a-z0-9.-]+)(\/[a-z][a-z0-9-]{1,31})?\/?$/,Ka=/^[a-z0-9][a-z0-9_-]{0,31}$/;function Ct(e,t="t"){const s=Fa.exec(e.trim().toLowerCase());if(!s)return"";const a=s[2]??(Ka.test(t)?`/${t}`:"/t");return`https://${s[1]}${a}/#…`}const Ga=/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/,Va=/^[+(]?[0-9][0-9 ()-]{5,24}$/;function Wt(e){const t=e.trim();if(t==="")return!0;if(t.length>80)return!1;if(Ga.test(t))return!0;const s=(t.match(/[0-9]/g)??[]).length;return Va.test(t)&&s>=7&&s<=15}function Xt(e){const t=e.trim();if(t==="")return!0;if(t.length>200||/[\s{}<>"'\\\u0000-\u001f\u007f]/.test(t))return!1;try{const s=new URL(t);return s.protocol==="https:"&&s.hostname!==""&&s.username===""&&s.password===""}catch{return!1}}function Wa(e,t){if(!Wt(t.contact)||!Xt(t.link))return null;const s={};return t.contact.trim()!==(e?.contact??"")&&(s.contact=t.contact.trim()),t.link.trim()!==(e?.link??"")&&(s.link=t.link.trim()),Object.keys(s).length?s:null}var Xa=Object.defineProperty,Ya=Object.getOwnPropertyDescriptor,j=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ya(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Xa(t,s,i),i};const Za={base_url:"",trusted_proxy_cidrs:["172.30.32.0/23"],client_ip_header:"cf-connecting-ip",theme:"light",path_prefix:"support",legacy_t_paths:!0},Ja=["light","dark","auto"],Qa=["cf-connecting-ip","x-forwarded-for"];let L=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.doc=null,this.busy=!1,this.remote=!1,this.saveError="",this.health=null,this.org=null,this.privContact=null,this.privLink=null,this.address=null,this.cidrs=null,this.pathPrefix=null,this.months=null,this.probe=null,this.probing=!1,this.advanced=!1}connectedCallback(){super.connectedCallback(),this.loadHealth()}willUpdate(e){if(e.has("doc")){const t=e.get("doc");t&&this.doc&&t.revision!==this.doc.revision&&(this.org=null,this.address=null,this.cidrs=null,this.pathPrefix=null,this.months=null,this.loadHealth())}}async loadHealth(){try{this.health=await yt().health()}catch(e){e instanceof x&&e.status===403||(this.health=null)}}get pub(){return{...Za,...this.doc?.public??{}}}save(e){this.dispatchEvent(new CustomEvent("save-doc",{detail:{patch:e},bubbles:!0,composed:!0}))}async runProbe(){if(!this.probing){this.probing=!0,this.probe=null;try{const e=this.address??this.pub.base_url;this.probe=await yt().probe(e===this.pub.base_url?void 0:e)}catch(e){this.dispatchEvent(new CustomEvent("notice",{detail:{error:_(e)},bubbles:!0,composed:!0}))}finally{this.probing=!1}}}probeLine(){const e=this.probe;if(!e)return p;const t=e.result==="reachable"&&(e.listener?.header_ok??!0),s=e.result==="wrong_answer"&&e.code==="not_routed"?"probe_not_routed":`probe_${e.result}`,a=[Bt.includes(s)?l(s):l("probe_unreachable")];return e.result==="reachable"&&e.listener&&!e.listener.seen&&a.push(l("probe_not_seen")),e.result==="reachable"&&e.listener&&e.listener.seen&&!e.listener.header_ok&&a.push(l("probe_header_missing")),r`<div class=${`probe ${t?"ok":"bad"}`} role="status" data-probe-result=${e.result}>${a.join(" · ")}</div>`}stateRow(){const e=this.health,t=e?.missing??[];return r`<div class="row"><span class="lbl">${l("pubStatus")}</span>
      <span class="state" data-public-state=${t.length?"missing":e?"ready":"unknown"}>
        ${e&&!t.length?r`<span class="tag ok">${l("pubReady")}</span>`:p}
        ${t.map(s=>r`<span class="tag warn" data-missing=${s}>${l(`pubMissing_${s}`)}</span>`)}
        ${e?r`<span class="tag" data-links-live>${l("pubLiveLinks",{n:e.links.live})}</span>`:p}
        ${e&&e.links.live_staff?r`<span class="tag" data-links-live-staff>${l("pubLiveStaff",{n:e.links.live_staff})}</span>`:p}
      </span></div>`}portalRows(){const e={enabled:!1,closed_months:2,require_confirmed_number:!0,rfqs:!1,technician_requests:!1,...this.doc?.vendor_portal??{}},t=this.months??String(e.closed_months),s=Number(t),a=Number.isInteger(s)&&s>=1&&s<=24,i=(n,o,d)=>r`<div class="row"><span class="lbl">${o}</span>
      <sw-segmented radio label=${o} value=${String(e[n])} ?disabled=${this.busy}
        @change=${u=>{const h=u.detail.value==="true";e[n]!==h&&this.save({vendor_portal:{[n]:h}})}}
        .options=${[!0,!1].map(u=>({value:String(u),label:l(u?"vpOn":"vpOff"),attrs:{"data-vp":d,"data-on":String(u)}}))}></sw-segmented></div>`;return r`${i("enabled",l("vpLabel"),"enabled")}
      <div class="hint" data-vp-note>${l("vpNote")}</div>
      <div class="row stack"><span class="lbl">${l("vpMonths")}</span>
        <div class="line"><input class="in" type="number" min="1" max="24" step="1" inputmode="numeric" data-vp-months aria-label=${l("vpMonths")}
          .value=${t} @input=${n=>this.months=n.target.value} />
          <sw-button size="sm" variant="primary" data-vp-months-save ?disabled=${this.busy||!a||s===e.closed_months}
            @click=${()=>this.save({vendor_portal:{closed_months:s}})}>${l("save")}</sw-button></div></div>
      ${i("require_confirmed_number",l("vpConfirmed"),"confirmed")}
      <div class="hint" data-vp-confirmed-note>${l("vpConfirmedNote")}</div>
      ${i("rfqs",l("vpRfqs"),"rfqs")}
      <div class="hint" data-vp-rfqs-note>${l("vpRfqsNote")}</div>
      ${i("technician_requests",l("vpTechs"),"techs")}
      <div class="hint" data-vp-techs-note>${l("vpTechsNote")}</div>`}render(){const e=this.pub,t=this.org??this.doc?.organization_name??"",s=this.address??e.base_url,a=this.doc?.privacy,i=this.privContact??a?.contact??"",n=this.privLink??a?.link??"",o=Wt(i)&&Xt(n),d=Wa(a,{contact:i,link:n}),u=this.pathPrefix??e.path_prefix??"support",h=/^https:\/\/[^/]+\/[^/]/.test(s.trim()),$=this.health?.links.live??0,R=u.trim().replace(/^\//,""),P=R!==(e.path_prefix??"support"),T=/^\/?(?:t|[a-z0-9][a-z0-9_-]{1,31})$/.test(u.trim()),ee=this.cidrs??e.trusted_proxy_cidrs.join(`
`),pe=ee.split(/[\s,]+/).map(m=>m.trim()).filter(Boolean);return r`<sw-card heading=${l("pubCard")} subheading=${l("pubSub")} data-card="public">
      ${this.stateRow()}
      <div class="row stack"><span class="lbl">${l("pubOrg")}</span>
        <div class="line"><input class="in" maxlength="80" data-public-org aria-label=${l("pubOrg")} .value=${t} @input=${m=>this.org=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-org-save ?disabled=${this.busy||t.trim()===(this.doc?.organization_name??"")}
            @click=${()=>this.save({organization_name:t.trim()})}>${l("save")}</sw-button></div></div>
      <div class="row stack"><span class="lbl">${l("pubPrivContact")}</span>
        <div class="line"><input class="in" dir="ltr" maxlength="80" autocomplete="off" data-public-priv-contact aria-label=${l("pubPrivContact")} .value=${i}
          @input=${m=>this.privContact=m.target.value} /></div>
        <span class="lbl">${l("pubPrivLink")}</span>
        <div class="line"><input class="in" type="url" dir="ltr" maxlength="200" inputmode="url" autocomplete="off" data-public-priv-link aria-label=${l("pubPrivLink")} .value=${n}
          @input=${m=>this.privLink=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-priv-save ?disabled=${this.busy||!o||d===null}
            @click=${()=>{d&&this.save({privacy:d})}}>${l("save")}</sw-button></div>
        <div class="hint" data-public-priv-note>${l("pubPrivNote")}</div>
        ${o?p:r`<div class="probe bad" role="alert" data-public-priv-bad>${l("pubPrivBad")}</div>`}</div>
      <div class="row"><span class="lbl">${l("pubTheme")}</span>
        <sw-segmented radio label=${l("pubTheme")} value=${e.theme} ?disabled=${this.busy}
          @change=${m=>{const te=m.detail.value;e.theme!==te&&this.save({public:{theme:te}})}}
          .options=${Ja.map(m=>({value:m,label:l(m==="light"?"pubThemeLight":m==="dark"?"pubThemeDark":"pubThemeAuto"),attrs:{"data-public-theme":m}}))}></sw-segmented></div>
      <div class="hint" data-public-theme-note>${l("pubThemeNote")}</div>
      ${this.portalRows()}
      <div class="row stack"><span class="lbl">${l("pubAddress")}</span>
        <div class="line"><input class="in" type="url" dir="ltr" maxlength="300" inputmode="url" autocomplete="off" data-public-address aria-label=${l("pubAddress")}
          placeholder=${l("pubAddressHint")} ?readonly=${this.remote} .value=${s} @input=${m=>{this.address=m.target.value,this.probe=null}} />
          <sw-button size="sm" variant="primary" data-public-address-save ?disabled=${this.busy||this.remote||s.trim()===e.base_url}
            @click=${()=>this.save({public:{base_url:s.trim()}})}>${l("save")}</sw-button>
          <sw-button size="sm" data-public-probe ?disabled=${this.probing||this.remote||!s.trim()} @click=${()=>void this.runProbe()}>${this.probing?"…":l("pubProbe")}</sw-button></div>
        <div class="hint" data-public-address-note>${l("pubAddressNote")}</div>
        ${Ct(s,u.trim().replace(/^\//,""))?r`<div class="hint" dir="ltr" data-public-sample>${l("pubSampleLink",{url:Ct(s,u.trim().replace(/^\//,""))})}</div>`:p}
        ${this.remote?r`<div class="hint" data-public-local-only>${l("pubLocalOnly")}</div>`:p}
        ${this.saveError?r`<div class="probe bad" role="alert" data-public-save-error>${this.saveError}</div>`:p}
        ${this.probe?this.probeLine():p}</div>
      <div class="row stack"><span class="lbl">${l("pubPrefix")}</span>
        <div class="line"><input class="in" dir="ltr" maxlength="33" autocomplete="off" data-public-prefix aria-label=${l("pubPrefix")} ?readonly=${this.remote||h}
          .value=${u} @input=${m=>this.pathPrefix=m.target.value} />
          <sw-button size="sm" variant="primary" data-public-prefix-save ?disabled=${this.busy||this.remote||!T||h||!P}
            @click=${()=>this.save({public:{path_prefix:R,...$>0?{confirm_live_links:!0}:{}}})}>${l("save")}</sw-button></div>
        <div class="hint" data-public-prefix-step>${l("pubPrefixStep")}</div>
        <div class="hint" data-public-prefix-note>${l("pubPrefixNote",{p:T?u.trim().replace(/^\//,""):"support"})}</div>
        ${P&&T&&$>0?r`<div class="probe bad" role="alert" data-public-prefix-live>${l("pubPrefixLive",{n:$})}</div>`:p}
        ${h?r`<div class="hint" data-public-prefix-address>${l("pubPrefixAddress")}</div>`:p}
        ${T?p:r`<div class="probe bad" role="alert" data-public-prefix-bad>${l("pubPrefixBad")}</div>`}</div>
      <div class="row"><button type="button" class="fold" aria-expanded=${String(this.advanced)} aria-controls="public-advanced" data-public-advanced
        @click=${()=>this.advanced=!this.advanced}>${l("pubAdvanced")}</button></div>
      ${this.advanced?r`<div id="public-advanced" data-public-advanced-body>
        <div class="row stack"><span class="lbl">${l("pubTrusted")}</span>
          <textarea class="in" dir="ltr" rows="3" data-public-cidrs aria-label=${l("pubTrusted")} ?readonly=${this.remote} .value=${ee} @input=${m=>this.cidrs=m.target.value}></textarea>
          <div class="foot"><sw-button size="sm" variant="primary" data-public-cidrs-save ?disabled=${this.busy||this.remote||pe.length>8||pe.join(",")===e.trusted_proxy_cidrs.join(",")}
            @click=${()=>this.save({public:{trusted_proxy_cidrs:pe}})}>${l("save")}</sw-button></div></div>
        <div class="row"><span class="lbl">${l("pubClientHeader")}</span>
          <sw-segmented radio label=${l("pubClientHeader")} value=${e.client_ip_header} ?disabled=${this.busy||this.remote}
            @change=${m=>this.save({public:{client_ip_header:m.detail.value}})}
            .options=${Qa.map(m=>({value:m,label:m,attrs:{dir:"ltr","data-public-header":m}}))}></sw-segmented></div>
        <div class="row"><span class="lbl">${l("pubLegacyT")}</span>
          <sw-segmented radio label=${l("pubLegacyT")} value=${String(e.legacy_t_paths??!0)} ?disabled=${this.busy||this.remote}
            @change=${m=>{const te=m.detail.value==="true";(e.legacy_t_paths??!0)!==te&&this.save({public:{legacy_t_paths:te}})}}
            .options=${[!0,!1].map(m=>({value:String(m),label:l(m?"pubLegacyOn":"pubLegacyOff"),attrs:{"data-public-legacy":String(m)}}))}></sw-segmented></div>
        <div class="hint" data-public-legacy-note>${l("pubLegacyTNote")}</div>
      </div>`:p}
    </sw-card>`}};L.styles=[Y,Z,X`
    ${Je}
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
  `,le];j([O({attribute:!1})],L.prototype,"doc",2);j([O({type:Boolean})],L.prototype,"busy",2);j([O({type:Boolean})],L.prototype,"remote",2);j([O({attribute:!1})],L.prototype,"saveError",2);j([c()],L.prototype,"health",2);j([c()],L.prototype,"org",2);j([c()],L.prototype,"privContact",2);j([c()],L.prototype,"privLink",2);j([c()],L.prototype,"address",2);j([c()],L.prototype,"cidrs",2);j([c()],L.prototype,"pathPrefix",2);j([c()],L.prototype,"months",2);j([c()],L.prototype,"probe",2);j([c()],L.prototype,"probing",2);j([c()],L.prototype,"advanced",2);L=j([I("tickets-public-card")],L);const ei=400,Nt=[6,0,1,2,3,4,5],ot=[0,1,2,3,6],ti=["calendar","working"],si=["wall","working"],je={enabled:!1,weekdays:[...ot],start:"08:00",end:"17:00",days:{},holidays:[],hold_internal:!0,auto_close:"calendar",link_unopened:"wall",departments:{}},ke=/^([01]\d|2[0-3]):[0-5]\d$/,ai=/^[0-6]$/;function Yt(e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(e);if(!t)return!1;const[s,a,i]=[Number(t[1]),Number(t[2]),Number(t[3])],n=new Date(Date.UTC(s,a-1,i));return n.getUTCFullYear()===s&&n.getUTCMonth()===a-1&&n.getUTCDate()===i}function ii(){return{...je,weekdays:[...ot],days:{},holidays:[],departments:{}}}function ni(e){const t={};if(!e||typeof e!="object"||Array.isArray(e))return t;for(const[s,a]of Object.entries(e)){const i=a;ai.test(s)&&i&&typeof i.start=="string"&&typeof i.end=="string"&&ke.test(i.start)&&ke.test(i.end)&&i.start<i.end&&(t[s]={start:i.start,end:i.end})}return t}function ri(e){if(!e||typeof e!="object"||Array.isArray(e))return ii();const t=e,a=Array.isArray(t.weekdays)&&t.weekdays.length>0&&t.weekdays.every(h=>Number.isInteger(h)&&h>=0&&h<=6)?[...new Set(t.weekdays)].sort((h,$)=>h-$):[...ot],i=(h,$)=>typeof h=="string"&&ke.test(h)?h:$;let n=i(t.start,je.start),o=i(t.end,je.end);n>=o&&([n,o]=[je.start,je.end]);const d=Array.isArray(t.holidays)?[...new Set(t.holidays.filter(h=>typeof h=="string"&&Yt(h)))].sort():[],u=t.departments&&typeof t.departments=="object"&&!Array.isArray(t.departments)?t.departments:{};return{enabled:t.enabled===!0,weekdays:a,start:n,end:o,days:ni(t.days),holidays:d,hold_internal:t.hold_internal!==!1,auto_close:t.auto_close==="working"?"working":"calendar",link_unopened:t.link_unopened==="working"?"working":"wall",departments:{...u}}}function st(e){if(e.weekdays.length===0)return"weekdays";if(!ke.test(e.start)||!ke.test(e.end))return"time";if(e.start>=e.end)return"order";for(const t of Object.values(e.days)){if(!ke.test(t.start)||!ke.test(t.end))return"time";if(t.start>=t.end)return"order"}return null}function li(e){if(e.enabled){const t=st(e);if(t)return t;if(e.holidays.length>ei)return"holidays_many"}for(const t of Object.keys(e.departments))if(ct(e.departments[t])==="own"&&st(pt(e,t)))return"dept";return null}function di(e,t){return e.includes(t)?e.filter(s=>s!==t):[...e,t].sort((s,a)=>s-a)}function oi(e,t){return e.days[String(t)]??{start:e.start,end:e.end}}function Tt(e,t,s,a){const i={...e.days};return s===e.start&&a===e.end?delete i[String(t)]:i[String(t)]={start:s,end:a},{...e,days:i}}function Et(e,t,s){const a={};for(const[i,n]of Object.entries(e.days))(n.start!==t||n.end!==s)&&(a[i]=n);return{...e,start:t,end:s,days:a}}function ct(e){return e?e.enabled===!1?"always":e.enabled===!0||e.weekdays||e.start||e.end||e.days?"own":"inherit":"inherit"}function pt(e,t){const s=e.departments[t];if(!s||ct(s)!=="own")return{weekdays:e.weekdays,start:e.start,end:e.end,days:e.days};const a=s.weekdays||s.start||s.end||s.days;return{weekdays:s.weekdays??e.weekdays,start:s.start??e.start,end:s.end??e.end,days:a?s.days??{}:e.days}}function ci(e,t,s){const a={...e.departments};if(s==="inherit")delete a[t];else if(s==="always")a[t]={enabled:!1};else{const i=pt({...e,departments:{}},t);a[t]={enabled:!0,weekdays:[...i.weekdays],start:i.start,end:i.end,days:{...i.days}}}return a}function pi(e,t,s){return{...e.departments,[t]:{enabled:!0,weekdays:[...s.weekdays].sort((a,i)=>a-i),start:s.start,end:s.end,days:{...s.days}}}}function ui(e){const t=new Set,s=[];for(const a of e.split(/[\s,;]+/).map(i=>i.trim()).filter(Boolean)){const i=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(a),n=i?`${i[3]}-${i[2].padStart(2,"0")}-${i[1].padStart(2,"0")}`:a;Yt(n)?t.add(n):s.push(a)}return{dates:[...t].sort(),bad:s}}function hi(e){return e.join(`
`)}function mi(e){return Object.fromEntries(Object.entries(e).sort(([t],[s])=>t.localeCompare(s)))}function at(e){return{enabled:e.enabled,weekdays:[...e.weekdays].sort((t,s)=>t-s),start:e.start,end:e.end,days:mi(e.days),holidays:[...e.holidays].sort(),hold_internal:e.hold_internal,auto_close:e.auto_close,link_unopened:e.link_unopened,departments:e.departments}}function bi(e,t){return JSON.stringify(at(e))===JSON.stringify(at(t))}const Zt={card:"שעות עבודה",cardSub:"מתי נספרים הזמנים של {tickets} תקועות, איחורים ותזכורות",enabled:"ספירה לפי שעות עבודה",enabledSub:"כבוי: הזמנים נספרים ברציפות, בכל שעה ביממה",days:"ימי עבודה",hours:"שעות עבודה",hoursSub:"בשעון המקומי של המערכת",to:"עד",holidays:"ימי חופש וחגים",holidaysSub:"תאריך בכל שורה, למשל 21.10.2026. בימים האלה לא נספר זמן",holidaysCount:"{n} ימים",note:"הספירה חלה על זמני תקועה, איחור ותזכורות. שליחת הודעות לספקים ממשיכה לפי שעות השליחה שלהם",save:"שמירה",d0:"שני",d1:"שלישי",d2:"רביעי",d3:"חמישי",d4:"שישי",d5:"שבת",d6:"ראשון",err_weekdays:"יש לבחור לפחות יום עבודה אחד",err_time:"שעה לא תקינה",err_order:"שעת הסיום חייבת להיות אחרי שעת ההתחלה (אין משמרת חוצת חצות)",err_holidays_many:"עד 400 ימי חופש",err_bad_dates:"תאריך לא תקין: {list}",err_dept:"בדקו את שעות העבודה של המחלקות",holdInternal:"תזכורות והתראות מחוץ לשעות העבודה",holdInternalSub:"מופעל: תזכורת פנימית או התראה למנהלים שמגיעה מחוץ לשעות העבודה מחכה לפתיחה הבאה",autoClose:"סגירה אוטומטית של {ticket} שבוצעה",autoCloseSub:"ימים רגילים (כמו עד היום) או זמן עבודה: כל יום הוא אורך יום העבודה",ac_calendar:"ימים רגילים",ac_working:"זמן עבודה",linkClock:"קישור שלא נפתח אצל הספק",linkClockSub:"השעון של הספק: ברירת המחדל סופרת ברציפות ולא לפי שעות העבודה",lc_wall:"ברציפות",lc_working:"שעות עבודה",dayHours:"שעות לכל יום",dayHoursSub:"שנו את השעות של יום מסוים, למשל שישי קצר",depts:"שעות עבודה לפי מחלקה",deptsSub:"כמו ההגדרה הכללית, ברציפות, או שעות משלה",dm_inherit:"כללי",dm_always:"ברציפות",dm_own:"שעות משלה",deptMode:"שעות עבודה של {name}"},Jt=Ce("en","tickets/work-calendar-text","en"),vi=hs(Zt,Jt),y=vi.t;Ue("tickets/work-calendar-text",{he:Zt,en:Jt});var $i=Object.defineProperty,fi=Object.getOwnPropertyDescriptor,Le=(e,t,s,a)=>{for(var i=a>1?void 0:a?fi(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&$i(t,s,i),i};const gi=["inherit","always","own"];let fe=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.doc=null,this.busy=!1,this.draft=null,this.holidayText=null,this.departments=[]}connectedCallback(){super.connectedCallback(),g().departments().then(e=>this.departments=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))).catch(()=>{})}willUpdate(e){if(e.has("doc")){const t=e.get("doc");(!t||!this.doc||t.revision!==this.doc.revision)&&(this.draft=null,this.holidayText=null)}}get stored(){return ri(this.doc?.calendar)}get cur(){return this.draft??this.stored}set(e){this.draft={...this.cur,...e}}save(e){const t={calendar:at(e)};this.dispatchEvent(new CustomEvent("save-doc",{detail:{patch:t},bubbles:!0,composed:!0}))}editor(e,t,s){const a=st(e),i=(n,o,d,u)=>r`<input class="in time" type="time" lang=${ve()} data-wc-time=${u} aria-label=${o}
      aria-invalid=${String(a==="order"||a==="time")} .value=${n} @input=${h=>d(h.target.value)} />`;return r`
      <div class="row stack"><span class="lbl">${y("days")}</span>
        <div class="days" role="group" aria-label=${y("days")}>${Nt.map(n=>r`<button type="button" aria-pressed=${String(e.weekdays.includes(n))} data-wc-day=${`${s}${n}`}
          ?disabled=${this.busy} @click=${()=>t({...e,weekdays:di(e.weekdays,n)})}>${y(`d${n}`)}</button>`)}</div></div>
      <div class="row"><span class="lbl">${y("hours")}<span class="muted">${y("hoursSub")}</span></span>
        <span class="times">${i(e.start,y("hours"),n=>t(Et(e,n,e.end)),`${s}start`)}
          <span class="muted">${y("to")}</span>
          ${i(e.end,`${y("hours")} · ${y("to")}`,n=>t(Et(e,e.start,n)),`${s}end`)}</span></div>
      <div class="row stack"><span class="lbl">${y("dayHours")}<span class="muted">${y("dayHoursSub")}</span></span>
        ${Nt.filter(n=>e.weekdays.includes(n)).map(n=>{const o=oi(e,n);return r`<div class="dayrow" data-wc-dayrow=${`${s}${n}`}><span class="dn">${y(`d${n}`)}</span>
            ${i(o.start,`${y(`d${n}`)}`,d=>t(Tt(e,n,d,o.end)),`${s}d${n}start`)}
            <span class="muted">${y("to")}</span>
            ${i(o.end,`${y(`d${n}`)} · ${y("to")}`,d=>t(Tt(e,n,o.start,d)),`${s}d${n}end`)}</div>`})}</div>`}seg(e,t,s,a,i,n,o){return r`<div class="row"><span class="lbl">${e}<span class="muted">${t}</span></span>
      <sw-segmented radio label=${e} value=${i} ?disabled=${this.busy} @change=${d=>o(d.detail.value)}
        .options=${a.map(d=>({value:d,label:n(d),attrs:{"data-wc-seg":`${s}:${d}`}}))}></sw-segmented></div>`}deptRows(e){return this.departments.length?r`<div class="row stack"><span class="lbl">${y("depts")}<span class="muted">${y("deptsSub")}</span></span>
      ${this.departments.map(t=>{const s=ct(e.departments[t.id]);return r`<div class="nested" data-wc-dept=${t.id}>
          ${this.seg(t.name,"",`dept-${t.id}`,gi,s,a=>y(`dm_${a}`),a=>this.set({departments:ci(e,t.id,a)}))}
          ${s==="own"?this.editor(pt(e,t.id),a=>this.set({departments:pi(e,t.id,a)}),`dept-${t.id}-`):p}
        </div>`})}</div>`:p}render(){if(!this.doc)return p;const e=this.cur,t=this.holidayText??hi(e.holidays),s=ui(t),a={...e,holidays:s.dates},i=li(a),n=!bi(a,this.stored),o=!!i||e.enabled&&s.bad.length>0;return r`<sw-card heading=${y("card")} subheading=${y("cardSub")} data-card="work-calendar">
      <div class="row"><span class="lbl">${y("enabled")}<span class="muted">${y("enabledSub")}</span></span>
        <sw-toggle label=${y("enabled")} labelHidden .checked=${e.enabled} ?disabled=${this.busy} data-wc-enabled
          @change=${d=>this.set({enabled:d.detail.checked})}></sw-toggle></div>
      ${e.enabled?r`
        ${this.editor(e,d=>this.set({weekdays:d.weekdays,start:d.start,end:d.end,days:d.days}),"")}
        <div class="row stack"><span class="lbl">${y("holidays")}<span class="muted">${y("holidaysSub")}</span></span>
          <textarea class="in" rows="4" dir="ltr" data-wc-holidays aria-label=${y("holidays")} aria-invalid=${String(s.bad.length>0||i==="holidays_many")}
            .value=${t} @input=${d=>this.holidayText=d.target.value}></textarea>
          <div class="hint" data-wc-holidays-count>${y("holidaysCount",{n:s.dates.length})}</div></div>
        <div class="row"><span class="lbl">${y("holdInternal")}<span class="muted">${y("holdInternalSub")}</span></span>
          <sw-toggle label=${y("holdInternal")} labelHidden .checked=${e.hold_internal} ?disabled=${this.busy} data-wc-hold
            @change=${d=>this.set({hold_internal:d.detail.checked})}></sw-toggle></div>
        ${this.seg(y("autoClose"),y("autoCloseSub"),"auto_close",ti,e.auto_close,d=>y(d==="working"?"ac_working":"ac_calendar"),d=>this.set({auto_close:d}))}
        ${this.seg(y("linkClock"),y("linkClockSub"),"link_unopened",si,e.link_unopened,d=>y(d==="working"?"lc_working":"lc_wall"),d=>this.set({link_unopened:d}))}`:p}
      ${this.deptRows(e)}
      ${i?r`<div class="row"><span class="field-error" role="alert" data-wc-error=${i}>${y(`err_${i}`)}</span></div>`:p}
      ${e.enabled&&s.bad.length?r`<div class="row"><span class="field-error" role="alert" data-wc-error="bad_dates">${y("err_bad_dates",{list:s.bad.slice(0,5).join(", ")})}</span></div>`:p}
      <div class="row"><span class="hint">${y("note")}</span></div>
      <div class="foot"><sw-button variant="primary" size="sm" data-wc-save ?disabled=${!n||o||this.busy}
        @click=${()=>this.save(a)}>${y("save")}</sw-button></div>
    </sw-card>`}};fe.styles=[Y,Z,X`
    ${Je}
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
      .nested sw-segmented {
        --sw-seg-key-pad: 8px;
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
  `,le];Le([O({attribute:!1})],fe.prototype,"doc",2);Le([O({type:Boolean})],fe.prototype,"busy",2);Le([c()],fe.prototype,"draft",2);Le([c()],fe.prototype,"holidayText",2);Le([c()],fe.prototype,"departments",2);fe=Le([I("tickets-work-calendar-card")],fe);const ut={title:"דוחות לספקים",toContacts:"שליחת דוחות לאנשי קשר חיצוניים",email:"שליחה גם במייל",documents:"מסמך בקישור זמני",hours:"תוקף הקישור",hoursUnit:"שעות",opens:"הורדות לקישור",opensUnit:"פעמים",save:"שמירה",saved:"נשמר",failed:"השמירה נכשלה"},Qt=Ce("en","i18n/vendor-reports","en"),es=Ce("ar","i18n/vendor-reports","ar"),ts=Ce("ru","i18n/vendor-reports","ru");function wi(){return ms(["en","ar","ru"])}const yi={he:ut,en:Qt,ar:es,ru:ts};function be(e,t=wi()){return yi[t][e]??ut[e]??e}Ue("i18n/vendor-reports",{he:ut,en:Qt,ar:es,ru:ts});const Ot={document_hours:72,document_max_opens:5},ss={document_hours:[1,168],document_max_opens:[1,20]};function _i(e){return!e||typeof e!="object"?null:{to_contacts:e.to_contacts===!0,email:e.email===!0,documents:e.documents===!0,document_hours:Number.isInteger(e.document_hours)?e.document_hours:Ot.document_hours,document_max_opens:Number.isInteger(e.document_max_opens)?e.document_max_opens:Ot.document_max_opens}}function as(e,t){if(!/^\d{1,4}$/.test(e.trim()))return null;const s=Number(e),[a,i]=ss[t];return s>=a&&s<=i?s:null}function ki(e){return e.to_contacts}function xi(e){return e.to_contacts&&e.documents}function Pt(e,t,s){const a=as(s,t);return a===null||a===e[t]?null:{[t]:a}}var Si=Object.defineProperty,Di=Object.getOwnPropertyDescriptor,Be=(e,t,s,a)=>{for(var i=a>1?void 0:a?Di(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Si(t,s,i),i};let Se=class extends M{constructor(){super(...arguments),this.doc=null,this.busy=!1,this.hoursDraft="",this.opensDraft=""}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}get current(){return _i(this.doc?.reports)}async load(){try{this.doc=await g().settings(),this.sync()}catch(e){e instanceof x&&(e.status===403||e.status===404)||this.notice({error:_(e)})}}sync(){const e=this.current;e&&(this.hoursDraft=String(e.document_hours),this.opensDraft=String(e.document_max_opens))}async save(e){if(!(!this.doc||this.busy)){this.busy=!0;try{this.doc=await g().saveInstallation(this.doc.revision,{reports:e}),this.sync(),this.notice({ok:be("saved")})}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}toggle(e,t,s,a,i){return r`<div class="row"><span class="lbl">${be(e)}</span>
      <sw-toggle label=${be(e)} labelHidden .checked=${s} ?disabled=${this.busy||a} data-reports=${i}
        @change=${n=>void this.save({[t]:n.detail.checked})}></sw-toggle></div>`}numberRow(e,t,s,a,i,n){const o=as(a,s)!==null,[d,u]=ss[s],h=$=>s==="document_hours"?this.hoursDraft=$:this.opensDraft=$;return r`<div class="row"><span class="lbl">${be(e)}</span>
      <span class="end"><input class="in num short" type="number" min=${d} max=${u} .value=${a} ?disabled=${this.busy||n} data-reports=${s}
        aria-invalid=${String(!o)} aria-label=${be(e)} @input=${$=>h($.target.value)} />
        <span class="muted">${be(t)}</span>
        <sw-button size="sm" ?disabled=${this.busy||n||Pt(i,s,a)===null} data-reports-save=${s}
          @click=${()=>{const $=Pt(i,s,a);$&&this.save($)}}>${be("save")}</sw-button></span></div>`}render(){const e=this.current;if(!e)return p;const t=!ki(e),s=!xi(e);return r`<sw-card heading=${be("title")} data-card="reports-settings">
      ${this.toggle("toContacts","to_contacts",e.to_contacts,!1,"to_contacts")}
      ${this.toggle("email","email",e.email,t,"email")}
      ${this.toggle("documents","documents",e.documents,t,"documents")}
      ${this.numberRow("hours","hoursUnit","document_hours",this.hoursDraft,e,s)}
      ${this.numberRow("opens","opensUnit","document_max_opens",this.opensDraft,e,s)}
    </sw-card>`}};Se.styles=[Y,Z,X`
    ${Je}
    input.in.short { inline-size: 6em; }
  `];Be([c()],Se.prototype,"doc",2);Be([c()],Se.prototype,"busy",2);Be([c()],Se.prototype,"hoursDraft",2);Be([c()],Se.prototype,"opensDraft",2);Se=Be([I("tickets-reports-settings")],Se);var Ci=Object.defineProperty,Ni=Object.getOwnPropertyDescriptor,J=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ni(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Ci(t,s,i),i};const zt=[{key:"coalesce_min",label:"coalesce"},{key:"sender_per_day",label:"perDay"},{key:"sender_per_week",label:"perWeek"},{key:"installation_per_hour",label:"perHour"},{key:"installation_per_day",label:"perDayAll"},{key:"open_max",label:"openMax"},{key:"draft_ttl_days",label:"ttl"},{key:"rejected_keep_days",label:"keep"},{key:"block_days",label:"blockDays"},{key:"unlisted_reply_per_day",label:"unlistedPerDay"}],Oe=5;let F=class extends M{constructor(){super(...arguments),this.doc=null,this.meta=null,this.busy=!1,this.drafts={},this.known=[],this.knownAllowed=!1,this.page=0,this.fName="",this.fPhone="",this.fOrg=""}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}get s(){return Ys(this.doc?.intake)}async load(){try{this.doc=await g().settings();const e=this.s;if(e){this.drafts=Object.fromEntries(zt.map(t=>[t.key,String(e[t.key])]));try{this.meta=await g().meta()}catch{}await this.loadKnown()}}catch(e){e instanceof x&&(e.status===403||e.status===404)||this.notice({error:_(e)})}}async loadKnown(){try{this.known=(await et.known()).known,this.knownAllowed=!0,this.page*Oe>=this.known.length&&(this.page=Math.max(0,Math.ceil(this.known.length/Oe)-1))}catch{this.known=[],this.knownAllowed=!1}}async save(e){if(!(!this.doc||this.busy)){this.busy=!0;try{this.doc=await g().saveInstallation(this.doc.revision,{intake:e}),this.notice({ok:C("saved")})}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}toggle(e,t,s,a=!1){return r`<div class="row"><span class="lbl">${C(e)}</span>
      <sw-toggle label=${C(e)} labelHidden .checked=${s} ?disabled=${this.busy||a} data-intake=${t}
        @change=${i=>void this.save({[t]:i.detail.checked})}></sw-toggle></div>`}numberRow(e,t,s,a){const i=this.drafts[e]??String(s[e]),n=Zs(i,e)!==null,[o,d]=Js[e];return r`<div class="row"><span class="lbl">${C(t)}</span>
      <span class="end"><input class="in num short" type="number" min=${o} max=${d} .value=${i} ?disabled=${this.busy||a} data-intake-num=${e}
        aria-invalid=${String(!n)} aria-label=${C(t)} @input=${u=>this.drafts={...this.drafts,[e]:u.target.value}} />
        <sw-button size="sm" ?disabled=${this.busy||a||gt(s,e,i)===null} data-intake-save=${e}
          @click=${()=>{const u=gt(s,e,i);u&&this.save(u)}}>${C("saveSetting")}</sw-button></span></div>`}async addKnown(){if(!(this.busy||!this.fName.trim()||!wt(this.fPhone))){this.busy=!0;try{await et.addKnown({display_name:this.fName.trim(),phone:this.fPhone.trim(),org:this.fOrg.trim()}),this.fName=this.fPhone=this.fOrg="",await this.loadKnown(),this.notice({ok:C("added")})}catch(e){this.notice({error:e instanceof x&&e.status===409?C("alreadyListed"):_(e)})}finally{this.busy=!1}}}async removeKnown(e){if(!this.busy){this.busy=!0;try{await et.removeKnown(e),await this.loadKnown(),this.notice({ok:C("removed")})}catch(t){this.notice({error:_(t)}),await this.loadKnown()}finally{this.busy=!1}}}knownCard(){if(!this.knownAllowed)return p;const e=this.page*Oe,t=this.known.slice(e,e+Oe);return r`<sw-card heading=${C("knownTitle")} data-card="intake-known">
      <div class="addrow">
        <input data-known="name" maxlength="80" dir="auto" placeholder=${C("name")} aria-label=${C("name")} .value=${this.fName} @input=${s=>this.fName=s.target.value} />
        <input data-known="phone" type="tel" inputmode="tel" maxlength="24" dir="ltr" placeholder=${C("phone")} aria-label=${C("phone")} .value=${this.fPhone} @input=${s=>this.fPhone=s.target.value} />
        <input data-known="org" maxlength="80" dir="auto" placeholder=${C("org")} aria-label=${C("org")} .value=${this.fOrg} @input=${s=>this.fOrg=s.target.value} />
        <sw-button size="sm" variant="primary" data-known-add ?disabled=${this.busy||!this.fName.trim()||!wt(this.fPhone)} @click=${()=>void this.addKnown()}>${C("add")}</sw-button>
      </div>
      ${t.length?t.map(s=>r`<div class="row" data-known-row=${s.id}><span class="nm" dir="auto">${s.display_name}${s.org?` · ${s.org}`:""}</span>
        <bdi dir="ltr" class="muted">${s.phone_masked}</bdi>
        <sw-button size="sm" ?disabled=${this.busy} data-known-remove @click=${()=>void this.removeKnown(s)}>${C("remove")}</sw-button></div>`):r`<div class="muted" data-known-empty>${C("knownEmpty")}</div>`}
      ${this.known.length>Oe?r`<div class="row"><sw-button size="sm" ?disabled=${this.page===0} @click=${()=>this.page-=1}>${C("prev")}</sw-button>
        <span class="muted">${e+1}-${e+t.length} ${C("of")} ${this.known.length}</span>
        <sw-button size="sm" ?disabled=${e+Oe>=this.known.length} @click=${()=>this.page+=1}>${C("next")}</sw-button></div>`:p}
    </sw-card>`}render(){const e=this.s;if(!e)return p;const t=!Qs(e),s=this.meta?.departments??[];return r`<sw-card heading=${C("setTitle")} data-card="intake-settings">
      ${this.toggle("enabled","enabled",e.enabled)}
      ${this.toggle("whatsapp","whatsapp",e.whatsapp,t)}
      <div class="row"><span class="lbl">${C("defaultDept")}</span>
        <select class="in" data-intake="default_department" aria-label=${C("defaultDept")} ?disabled=${this.busy||t}
          @change=${a=>void this.save({default_department:a.target.value})}>
          <option value="">${C("pickDept")}</option>${s.map(a=>r`<option value=${a.id} ?selected=${a.id===e.default_department}>${a.name}</option>`)}</select></div>
      ${this.toggle("approvalReply","approval_reply",e.approval_reply,t)}
      ${this.toggle("unlistedReply","unlisted_reply",e.unlisted_reply,t)}
      <div class="row"><span class="lbl">${C("classifier")}</span>
        <sw-toggle label=${C("classifier")} labelHidden .checked=${e.classifier==="rules"} ?disabled=${this.busy||t} data-intake="classifier"
          @change=${a=>void this.save({classifier:a.detail.checked?"rules":"off"})}></sw-toggle></div>
      <div class="grid2">${zt.map(a=>this.numberRow(a.key,a.label,e,t))}</div>
    </sw-card>${this.knownCard()}`}};F.styles=[Y,Z,X`
    :host { display: flex; flex-direction: column; gap: var(--sw-s-3); min-inline-size: 0; }
    input.in.short { inline-size: 6em; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 var(--sw-s-4); }
    @media (max-width: 720px) { .grid2 { grid-template-columns: minmax(0, 1fr); } }
    .addrow { display: flex; flex-wrap: wrap; gap: var(--sw-s-2); align-items: end; padding-block: var(--sw-s-2); }
    .addrow input, select.in { padding: 6px 8px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: inherit; font: inherit; }
    .nm { flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `];J([c()],F.prototype,"doc",2);J([c()],F.prototype,"meta",2);J([c()],F.prototype,"busy",2);J([c()],F.prototype,"drafts",2);J([c()],F.prototype,"known",2);J([c()],F.prototype,"knownAllowed",2);J([c()],F.prototype,"page",2);J([c()],F.prototype,"fName",2);J([c()],F.prototype,"fPhone",2);J([c()],F.prototype,"fOrg",2);F=J([I("tickets-intake-settings")],F);var Ti=Object.defineProperty,Ei=Object.getOwnPropertyDescriptor,we=(e,t,s,a)=>{for(var i=a>1?void 0:a?Ei(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Ti(t,s,i),i};let ie=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.view=null,this.failed="",this.forbidden=!1,this.busy=!1,this.windowDraft="",this.showDepts=!1,this.fullPhones=null}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.view=await ue().channel(),this.windowDraft=String(this.view.whatsapp.reply_window_h),g().settings().then(e=>this.fullPhones=e.directory?!!e.directory.managers_full_phones:null).catch(()=>{})}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}async saveFullPhones(e){if(!this.busy){this.busy=!0;try{const t=await g().settings(),s=await g().saveInstallation(t.revision,{directory:{managers_full_phones:e}});this.fullPhones=!!s.directory?.managers_full_phones,this.notice({ok:v("saved")})}catch(t){this.notice({error:_(t)})}finally{this.busy=!1,this.load()}}}async save(e){const t=this.view;if(!(!t||this.busy)){this.busy=!0;try{this.view=await ue().saveChannel(t.revision,e),this.windowDraft=String(this.view.whatsapp.reply_window_h),this.notice({ok:v("saved")})}catch(s){this.notice({error:_(s)}),s instanceof x&&s.status===409&&await this.load()}finally{this.busy=!1}}}stateLabel(e){return v(`state_${e}`)||e}accountLabel(e){return e?this.view?.accounts.find(t=>t.key===e)?.label??e.replace(/^entry:/,"").slice(0,8):v("chUseNone")}warningText(e){switch(e.code){case"required_unmapped":return v("warn_required_unmapped");case"account_down":return v("warn_account_down",{state:this.stateLabel(e.state??"unknown")});case"shared_outside":return v("warn_shared_outside");case"shared_module":return v("warn_shared_module",{module:e.module??""});default:return e.code}}whatsappCard(e){const t=Number(this.windowDraft),s=Number.isInteger(t)&&t>=1&&t<=336;return r`<sw-card heading=${v("chCard")} data-card="channel-whatsapp">
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
      ${this.fullPhones===null?p:r`<div class="row"><span class="lbl">${l("dmFullPhones")}<span class="muted">${l("dmFullPhonesHint")}</span></span>
        <sw-toggle label=${l("dmFullPhones")} labelHidden .checked=${this.fullPhones} ?disabled=${this.busy} data-channel-managers-full-phones
          @change=${a=>void this.saveFullPhones(a.detail.checked)}></sw-toggle></div>`}
    </sw-card>`}usesCard(e){const t=e.uses.find(s=>s.departments&&s.departments.length)?.departments??[];return r`<sw-card heading=${v("chUsesCard")} data-card="channel-uses">
      ${e.uses.map(s=>r`<div class="row" data-use=${s.key}><span class="lbl">${s.label}</span>
        <span class="val">${s.value?k(this.accountLabel(s.value)):s.inherits_label&&s.resolved?v("chUseInherit",{label:s.inherits_label}):k(this.accountLabel(s.resolved))}</span></div>`)}
      ${t.length?r`<div class="row"><span class="lbl">
          <button type="button" class="linkish" data-channel-depts aria-expanded=${String(this.showDepts)} @click=${()=>this.showDepts=!this.showDepts}>${v("chDepartments",{n:t.length})}</button></span></div>
        ${this.showDepts?t.map(s=>r`<div class="row" data-use-dept=${s.id}><span class="lbl">${k(s.name)}</span>
          <span class="val">${k(this.accountLabel(s.resolved))}</span></div>`):p}`:p}
      ${e.warnings.map(s=>r`<div class="warn" data-warning=${s.code} data-severity=${s.severity}>${this.warningText(s)}</div>`)}
      <div class="foot"><sw-button size="sm" variant="ghost" data-channel-manage @click=${()=>{window.location.hash=e.accounts_href||"#/system/messaging-accounts"}}>${v("chManage")}</sw-button></div>
    </sw-card>`}accountsCard(e){const t=e.accounts.filter(s=>s.ticket);return t.length?r`<sw-card heading=${v("chAccountsCard")} data-card="channel-accounts">
      ${t.map(s=>r`<div class="row" data-account=${s.key}>
        <span class="lbl">${k(s.label)}<span class="muted">${s.last_ok_at?v("chLastOk",{when:Fs(s.last_ok_at)}):v("chNeverOk")}
          · ${v("chToday",{n:s.sends_24h,max:s.per_day??"-"})}</span></span>
        <span class="chipstate" data-state=${s.state}>${this.stateLabel(s.state)}</span></div>`)}
    </sw-card>`:p}healthCard(e){const t=Object.values(e.health.outbox.depth).reduce((n,o)=>n+o,0),s=Object.values(e.health.inbound.last_24h).reduce((n,o)=>n+o,0),a=e.health.outbox.oldest_open_s,i=a==null?"-":a<3600?`${Math.max(1,Math.round(a/60))}′`:`${Math.round(a/3600)}h`;return r`<sw-card heading=${v("chHealthCard")} data-card="channel-health">
      <div class="nums">
        <div class="tile" data-health="waiting"><span class="muted">${v("chWaiting")}</span><b>${t}</b></div>
        <div class="tile" data-health="oldest"><span class="muted">${v("chOldest")}</span><b>${i}</b></div>
        <div class="tile" data-health="replies"><span class="muted">${v("chReplies")}</span><b>${s}</b></div>
        <div class="tile" data-health="listen"><span class="muted">${v("chReplyListen")}</span><b>${e.inbound.wanted?v("chOn"):v("chOff")}</b></div>
      </div>
    </sw-card>`}render(){if(this.forbidden)return r`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return r`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.view;return e?r`<div class="stack cols" data-channel-settings>${this.whatsappCard(e)}${this.usesCard(e)}${this.accountsCard(e)}${this.healthCard(e)}<tickets-reports-settings></tickets-reports-settings><tickets-intake-settings></tickets-intake-settings></div>`:r`<sw-state-panel state="loading"></sw-state-panel>`}};ie.styles=[Y,Z,X`
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
  `,le];we([c()],ie.prototype,"view",2);we([c()],ie.prototype,"failed",2);we([c()],ie.prototype,"forbidden",2);we([c()],ie.prototype,"busy",2);we([c()],ie.prototype,"windowDraft",2);we([c()],ie.prototype,"showDepts",2);we([c()],ie.prototype,"fullPhones",2);ie=we([I("tickets-channel-settings")],ie);var Oi=Object.defineProperty,Pi=Object.getOwnPropertyDescriptor,ce=(e,t,s,a)=>{for(var i=a>1?void 0:a?Pi(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Oi(t,s,i),i};let W=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.view=null,this.forbidden=!1,this.failed="",this.purpose="assign",this.tplLang="he",this.dept="",this.draft=null,this.preview=null,this.busy=!1,this.timer=0,this.seq=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.view=await ue().templates(),this.refreshPreview(this.current?.body??this.starter())}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}get current(){return this.view?.items.find(e=>e.purpose===this.purpose&&e.lang===this.tplLang&&(e.department_id??"")===this.dept)}starter(){return this.view?.starters[this.purpose]?.[this.tplLang]??this.view?.starters[this.purpose]?.he??""}choose(e){e.purpose&&(this.purpose=e.purpose),e.lang&&(this.tplLang=e.lang),e.dept!==void 0&&(this.dept=e.dept),this.draft=null,this.preview=null,this.refreshPreview(this.current?.body??this.starter())}onDraft(e){this.draft=e,window.clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.refreshPreview(e),350)}async refreshPreview(e){if(!e.trim()){this.preview=null;return}const t=++this.seq;try{const s=await ue().previewTemplate({purpose:this.purpose,lang:this.tplLang,body:e});t===this.seq&&(this.preview=s)}catch{t===this.seq&&(this.preview=null)}}insert(e){const t=this.renderRoot.querySelector("textarea"),s=this.draft??"",a=`{${e}}`;if(!t){this.onDraft(s+a);return}const i=t.selectionStart??s.length,n=s.slice(0,i)+a+s.slice(t.selectionEnd??i);this.onDraft(n),this.updateComplete.then(()=>{t.focus(),t.setSelectionRange(i+a.length,i+a.length)})}async act(e){if(!this.busy){this.busy=!0;try{await e(),this.view=await ue().templates(),this.draft=null,this.notice({ok:v("saved")}),this.refreshPreview(this.current?.body??this.starter())}catch(t){this.notice({error:_(t)}),t instanceof x&&t.status===409&&await this.load()}finally{this.busy=!1}}}save(){const e=this.draft??"",t=this.current;this.act(()=>t?ue().patchTemplate(t.id,{body:e,revision:t.revision}):ue().createTemplate({department_id:this.dept||null,purpose:this.purpose,lang:this.tplLang,body:e}))}problemText(e){return v(`tp_${e}`)||e}picker(e){return r`<div class="pick" data-template-picker>
      <label class="fld">${v("tplPurpose")}<select class="in" data-template-purpose @change=${t=>this.choose({purpose:t.target.value})}>
        ${e.purposes.map(t=>r`<option value=${t} ?selected=${t===this.purpose}>${ft(t)}</option>`)}</select></label>
      <sw-segmented radio label=${v("tplLang")} value=${this.tplLang} @change=${t=>this.choose({lang:t.detail.value})}
        .options=${e.langs.map(t=>({value:t,label:v(`lang_${t}`),attrs:{"data-template-lang":t}}))}></sw-segmented>
      <label class="fld">${v("tplDept")}<select class="in" data-template-dept @change=${t=>this.choose({dept:t.target.value})}>
        <option value="" ?selected=${!this.dept}>${v("tplAllDepts")}</option>
        ${e.departments.map(t=>r`<option value=${t.id} ?selected=${t.id===this.dept}>${k(t.name)}</option>`)}</select></label>
    </div>`}editor(e){const t=this.current,s=this.draft??t?.body??this.starter(),a=this.draft!==null,i=this.tplLang==="he"||this.tplLang==="ar"?"rtl":"ltr",n=this.preview,o=a&&n?n.problems:[];return r`<sw-card heading=${`${ft(this.purpose)} · ${v(`lang_${this.tplLang}`)}`} data-card="template-editor"
        data-template-state=${t?t.active?"custom":"inactive":"starter"}>
      <div class="row"><span class="lbl"><span class="badge">${t?t.active?v("tplCustom"):v("tplInactive"):v("tplStarter")}</span></span>
        ${t&&!a?r`<sw-toggle label=${v("tplCustom")} labelHidden .checked=${t.active} ?disabled=${this.busy} data-template-active
          @change=${d=>void this.act(()=>ue().patchTemplate(t.id,{active:d.detail.checked,revision:t.revision}))}></sw-toggle>`:p}</div>
      ${a?r`<textarea class="in" dir=${i} maxlength="1500" data-template-body .value=${s}
            @input=${d=>this.onDraft(d.target.value)}></textarea>
          <div class="row"><span class="lbl">${v("tplFields")}</span></div>
          <div class="fields" data-template-fields>${e.placeholders.filter(d=>this.purpose==="code"?!e.rules.code_forbidden.includes(d):d!=="code").map(d=>r`<button type="button" data-field=${d} @click=${()=>this.insert(d)}>{${d}}</button>`)}</div>`:r`<div class="text" dir=${i} data-template-text>${s}</div>`}
      ${o.length?r`<ul class="problems" data-template-problems>${o.map(d=>r`<li data-problem=${d.code}>${this.problemText(d.code)}</li>`)}</ul>`:p}
      ${n&&n.text?r`<div class="row"><span class="lbl">${v("tplPreview")}<span class="muted">${v("tplLength",{n:n.length,max:n.max})}</span></span></div>
        <div class="text" dir=${i} data-template-preview>${n.text}</div>`:p}
      <div class="foot">
        ${a?r`<sw-button size="sm" variant="primary" data-template-save ?disabled=${this.busy||!s.trim()||o.length>0} @click=${()=>this.save()}>${v("save")}</sw-button>
          <sw-button size="sm" variant="ghost" data-template-cancel ?disabled=${this.busy} @click=${()=>{this.draft=null,this.refreshPreview(t?.body??this.starter())}}>${v("tplCancel")}</sw-button>`:r`<sw-button size="sm" data-template-edit ?disabled=${this.busy} @click=${()=>this.onDraft(s)}>${t?v("tplEdit"):v("tplNew")}</sw-button>
          ${t?r`<sw-button size="sm" variant="ghost" data-template-delete ?disabled=${this.busy} @click=${()=>void this.act(()=>ue().deleteTemplate(t.id))}>${v("tplDelete")}</sw-button>`:p}`}
      </div>
    </sw-card>`}render(){if(this.forbidden)return r`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return r`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.view;return e?r`<div class="stack" data-message-templates>${this.picker(e)}${this.editor(e)}</div>`:r`<sw-state-panel state="loading"></sw-state-panel>`}};W.styles=[Y,Z,X`
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
  `,le];ce([c()],W.prototype,"view",2);ce([c()],W.prototype,"forbidden",2);ce([c()],W.prototype,"failed",2);ce([c()],W.prototype,"purpose",2);ce([c()],W.prototype,"tplLang",2);ce([c()],W.prototype,"dept",2);ce([c()],W.prototype,"draft",2);ce([c()],W.prototype,"preview",2);ce([c()],W.prototype,"busy",2);W=ce([I("tickets-message-templates")],W);var zi=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,ye=(e,t,s,a)=>{for(var i=a>1?void 0:a?Li(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&zi(t,s,i),i};const Ri={vat:["0","50"],window:["1","90"],max:["1","999999999"],flag:["0","999999999"],retention:["730","3650"]};let ne=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.doc=null,this.depts=null,this.failed="",this.forbidden=!1,this.busy=!1,this.drafts={},this.deptWindow={}}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.doc=await Ve().settings(),this.drafts={}}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e);return}try{this.depts=await Ve().departments(),this.deptWindow={}}catch{this.depts=null}}async save(e){const t=this.doc;if(!(!t||this.busy)){this.busy=!0;try{this.doc=await Ve().saveSettings(t.revision,e),this.drafts={},this.notice({ok:S("setSaved")})}catch(s){this.notice({error:_(s)}),s instanceof x&&s.status===409&&await this.load()}finally{this.busy=!1}}}async saveDept(e,t){if(!this.busy){this.busy=!0;try{this.depts=await Ve().saveDepartment(e.id,t);const s={...this.deptWindow};delete s[e.id],this.deptWindow=s,this.notice({ok:S("setSaved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}}shown(e,t){const s=this.drafts[e];if(s!==void 0)return s;switch(e){case"vat":return sa(t.vat_rate_bp);case"window":return String(t.claim_window_days);case"max":return kt(t.max_claim_total_minor);case"flag":return kt(t.review_flag_above_minor);case"retention":return String(t.retention_days)}}current(e,t){switch(e){case"vat":return t.vat_rate_bp;case"window":return t.claim_window_days;case"max":return t.max_claim_total_minor;case"flag":return t.review_flag_above_minor;case"retention":return t.retention_days}}numRow(e,t,s,a=""){const i=this.shown(e,s),n=aa(e,i),o={vat:"vat_rate_bp",window:"claim_window_days",max:"max_claim_total_minor",flag:"review_flag_above_minor",retention:"retention_days"}[e],[d,u]=Ri[e];return r`<div class="row"><span class="lbl">${t}${a?r`<span class="muted">${a}</span>`:p}</span>
      <span class="end"><input class="in num" inputmode="decimal" dir="ltr" data-costs-field=${e} aria-invalid=${String(n===null)} .value=${i}
        @input=${h=>this.drafts={...this.drafts,[e]:h.target.value}} />
        <sw-button size="sm" data-costs-save=${e} ?disabled=${this.busy||n===null||n===this.current(e,s)}
          @click=${()=>n!==null&&void this.save({[o]:n})}>${S("save")}</sw-button></span>
      ${n===null?r`<span class="err" role="status">${S("rangeErr",{min:d,max:u})}</span>`:p}</div>`}modeSeg(e,t,s,a){const i=s?[null,..._t]:_t;return r`<sw-segmented radio label=${S("setMode")} value=${e??"default"} ?disabled=${this.busy}
      @change=${n=>t(n.detail.value==="default"?null:n.detail.value)}
      .options=${i.map(n=>({value:n??"default",label:n?S(`m_${n}`):S("ctCostClaimDefault"),attrs:{"data-costs-mode":`${a}:${n??"default"}`}}))}></sw-segmented>`}installationCard(e){const t=ea.filter(s=>!e.currencies.includes(s));return r`<sw-card heading=${S("setCard")} data-card="costs-installation">
      <div class="row"><span class="lbl">${S("setMode")}<span class="muted">${S("setModeSub")}</span></span>${this.modeSeg(e.mode,s=>{s&&this.save({mode:s})},!1,"installation")}</div>
      <div class="row"><span class="lbl">${S("setCurrency")}<span class="muted">${S("setCurrenciesHint")}</span></span>
        <span class="chipsrow" data-costs-currencies>${e.currencies.map((s,a)=>r`<button type="button" class="rc" aria-pressed="true" data-costs-currency=${s}
          ?disabled=${this.busy||e.currencies.length===1} title=${S("removeFile")}
          @click=${()=>void this.save({currencies:e.currencies.filter(i=>i!==s)})}>${a===0?r`<b>${s}</b>`:s}</button>`)}</span></div>
      ${t.length?r`<div class="row"><span class="lbl">${S("setMoreCurrencies")}</span>
        <span class="chipsrow">${xe(t,s=>s,s=>r`<button type="button" class="rc" aria-pressed="false" data-costs-add-currency=${s}
          ?disabled=${this.busy||e.currencies.length>=5} @click=${()=>void this.save({currencies:[...e.currencies,s]})}>${s}</button>`)}</span></div>`:p}
      ${this.numRow("vat",S("setVat"),e)}
      ${this.numRow("window",S("setWindow"),e)}
      <div class="row"><span class="lbl">${S("setRequireInvoice")}</span>
        <sw-toggle label=${S("setRequireInvoice")} labelHidden .checked=${e.require_invoice} ?disabled=${this.busy} data-costs-toggle="require_invoice"
          @change=${s=>void this.save({require_invoice:s.detail.checked})}></sw-toggle></div>
      ${this.numRow("max",S("setMax"),e,S("setAmountsHint"))}
      ${this.numRow("flag",S("setFlag"),e)}
      ${this.numRow("retention",S("setRetention"),e)}
    </sw-card>`}departmentsCard(e){return r`<sw-card heading=${S("setDeptCard")} subheading=${S("setDeptHint")} data-card="costs-departments">
      ${e.departments.filter(t=>t.active).map(t=>{const a=this.deptWindow[t.id]??(t.claim_window_days===null?"":String(t.claim_window_days)),i=a.trim()===""?null:/^\d{1,3}$/.test(a.trim())&&Number(a)>=1&&Number(a)<=90?Number(a):void 0;return r`<div class="row stack" data-costs-dept=${t.id}><span class="lbl">${k(t.name)}</span>
          <div class="line">${this.modeSeg(t.cost_claim,n=>void this.saveDept(t,{cost_claim:n,claim_window_days:t.claim_window_days}),!0,t.id)}
            <span class="end"><span class="muted">${S("setDeptWindow")}</span>
              <input class="in num" inputmode="numeric" dir="ltr" data-costs-dept-window=${t.id} placeholder=${String(e.installation.claim_window_days)} aria-invalid=${String(i===void 0)} .value=${a}
                @input=${n=>this.deptWindow={...this.deptWindow,[t.id]:n.target.value}} />
              <sw-button size="sm" data-costs-dept-save=${t.id} ?disabled=${this.busy||i===void 0||i===t.claim_window_days}
                @click=${()=>{i!==void 0&&this.saveDept(t,{cost_claim:t.cost_claim,claim_window_days:i})}}>${S("save")}</sw-button></span></div></div>`})}
    </sw-card>`}kindChips(e,t,s,a,i){const n=e??t;return r`<span class="chipsrow" role="group" aria-label=${Te("kindsFold")} data-kinds-row=${s}>
      ${i?r`<button type="button" class="rc" aria-pressed=${String(e===null)} data-kinds-default=${s} ?disabled=${this.busy||e===null}
        @click=${()=>a(null)}>${Te("kindsDefault")}</button>`:p}
      ${ta.map(o=>r`<button type="button" class="rc" aria-pressed=${String(n.includes(o))} data-kind=${`${s}:${o}`}
        ?disabled=${this.busy||o==="labor"} title=${o==="labor"?Te("kindsFixed"):""} @click=${()=>a(Ks(n,o))}>${S(`k_${o}`)}</button>`)}
    </span>`}kindsCard(e){const t=e.allowed_line_kinds??["labor","parts"],s=this.depts;return r`<sw-card heading=${Te("kindsFold")} subheading=${Te("setKindsHint")} data-card="costs-kinds">
      <div class="row stack" data-kinds-installation><span class="lbl">${Te("kindsInstallation")}</span>
        ${this.kindChips(t,t,"installation",a=>{a&&this.save({allowed_line_kinds:a})},!1)}</div>
      ${s?s.departments.filter(a=>a.active).map(a=>r`<div class="row stack" data-kinds-dept=${a.id}><span class="lbl">${k(a.name)}</span>
        ${this.kindChips(a.allowed_line_kinds??null,t,a.id,i=>void this.saveDept(a,{cost_claim:a.cost_claim,claim_window_days:a.claim_window_days,allowed_line_kinds:i}),!0)}</div>`):p}
    </sw-card>`}render(){if(this.forbidden)return r`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return r`<sw-state-panel state="error" heading=${this.failed}></sw-state-panel>`;const e=this.doc;return e?r`<div class="stack cols" data-costs-settings>${this.installationCard(e.costs)}${this.depts?this.departmentsCard(this.depts):p}${this.kindsCard(e.costs)}</div>`:r`<sw-state-panel state="loading"></sw-state-panel>`}};ne.styles=[Y,Z,X`
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
  `,le];ye([c()],ne.prototype,"doc",2);ye([c()],ne.prototype,"depts",2);ye([c()],ne.prototype,"failed",2);ye([c()],ne.prototype,"forbidden",2);ye([c()],ne.prototype,"busy",2);ye([c()],ne.prototype,"drafts",2);ye([c()],ne.prototype,"deptWindow",2);ne=ye([I("tickets-costs-settings")],ne);var Ai=Object.defineProperty,Hi=Object.getOwnPropertyDescriptor,Q=(e,t,s,a)=>{for(var i=a>1?void 0:a?Hi(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Ai(t,s,i),i};const Mi={required:"err_required",too_long:"err_too_long",duplicate:"err_duplicate",address:"err_address",url:"err_url",coords:"err_coords",inactive_default:"err_inactive_default",area:"err_area"};let K=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.data=null,this.depts=[],this.areas=null,this.failed="",this.forbidden=!1,this.busy=!1,this.editing="",this.draft=xt(),this.tried=!1,this.serverErr={}}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.data=await Ee().admin()}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e);return}try{this.areas=await Ee().planAreas()}catch{this.areas=null}try{const e=await g().departments();this.depts=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))}catch{this.depts=[]}}open(e){const t=this.data?.locations.find(s=>s.id===e);this.editing=e,this.draft=t?na(t):xt(this.data?.locations.length??0),this.tried=!1,this.serverErr={}}set(e,t){this.draft={...this.draft,[e]:t},this.serverErr={}}problems(){return{...ra(this.draft,this.data?.locations??[],this.editing==="new"?null:this.editing),...this.serverErr}}takeServer(e){if(!(e instanceof x))return!1;if(e.code==="location_name_taken")return this.serverErr={name:"duplicate"},!0;const t=e.body.details?.fields??[],s={};for(const a of t){const i=la(a.code);if(!i)continue;const n=a.field==="lat"||a.field==="lng"?"coords":a.field==="is_default"?"default":a.field;s[n]=n==="street"&&i==="required"?"address":i}return this.serverErr=s,Object.keys(s).length>0}async save(){if(this.tried=!0,!Object.keys(this.problems()).length){this.busy=!0;try{const e=Ee(),t=this.data?.locations.find(s=>s.id===this.editing);this.data=this.editing==="new"?await e.create(St(this.draft)):await e.update(this.editing,St(this.draft,t?.revision)),this.editing="",this.notice({ok:w("saved")})}catch(e){this.takeServer(e)||this.notice({error:_(e)})}finally{this.busy=!1}}}async patch(e,t){this.busy=!0;try{this.data=await Ee().update(e.id,{...t,revision:e.revision}),this.notice({ok:w("saved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}async removeLocation(e){if(await Ft({body:w("confirmRemove",{name:e.name}),danger:!0})){this.busy=!0;try{this.data=await Ee().remove(e.id),this.notice({ok:w("removed")})}catch(t){this.notice({error:t instanceof x&&t.code==="location_in_use"?w("err_in_use"):_(t)})}finally{this.busy=!1}}}async setDept(e,t){this.busy=!0;try{this.data=await Ee().setDepartmentDefault(e,t||null),this.notice({ok:w("saved")})}catch(s){this.notice({error:_(s)})}finally{this.busy=!1}}err(e,t){const s=e[t];return(this.tried||this.serverErr[t])&&s?r`<span class="err" role="alert" data-location-err=${t}>${w(Mi[s])}</span>`:p}areaField(e){if(this.areas===null&&!this.draft.plan_zone_id)return p;const t=this.draft.plan_zone_id;return r`<label class="fld wide">${w("fArea")}
      <select class="in" data-location-field="plan_zone_id" ?disabled=${this.busy} @change=${s=>this.set("plan_zone_id",s.target.value)}>
        <option value="" ?selected=${!t}>${w("areaNone")}</option>
        ${da(this.areas,t).map(s=>r`<option value=${s.id} ?selected=${s.id===t}>${s.missing?w("areaMissing"):k(s.label)}</option>`)}
      </select>${this.err(e,"plan_zone_id")}</label>`}areaName(e){const t=this.areas?.find(s=>s.zone_id===e.plan_zone_id);return t?oa(t):""}editor(){const e=this.draft,t=this.problems(),s=i=>String(!!(this.tried&&t[i])),a=(i,n,o,d=!1,u="")=>r`<label class=${`fld${d?" wide":""}`}>${w(n)}
      <input class="in" data-location-field=${i} maxlength=${o} placeholder=${u} aria-invalid=${s(i)} .value=${e[i]}
        @input=${h=>this.set(i,h.target.value)} />${this.err(t,i)}</label>`;return r`<div class="editor" data-location-editor=${this.editing}>
      ${a("name","fName",ua)}
      <label class="fld">${w("fSort")}<input class="in num" inputmode="numeric" dir="ltr" data-location-field="sort_order" .value=${e.sort_order}
        @input=${i=>this.set("sort_order",i.target.value)} /></label>
      ${a("street","fStreet",ha)}
      ${a("city","fCity",ma)}
      ${a("details","fDetails",ca,!0,w("fDetailsPh"))}
      <div class="fld wide"><span>${w("fCoords")}</span><div class="pair">
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lat" aria-label=${w("fLat")} placeholder=${w("fLat")} aria-invalid=${s("coords")} .value=${e.lat}
          @input=${i=>this.set("lat",i.target.value)} />
        <input class="in" inputmode="decimal" dir="ltr" data-location-field="lng" aria-label=${w("fLng")} placeholder=${w("fLng")} aria-invalid=${s("coords")} .value=${e.lng}
          @input=${i=>this.set("lng",i.target.value)} /></div>${this.err(t,"coords")}</div>
      ${this.areaField(t)}
      <div class="checks wide">
        <label><input type="checkbox" data-location-field="active" .checked=${e.active} @change=${i=>this.set("active",i.target.checked)} /> ${w("fActive")}</label>
        <label><input type="checkbox" data-location-field="is_default" .checked=${e.is_default} @change=${i=>this.set("is_default",i.target.checked)} /> ${w("fDefault")}</label>
        ${this.err(t,"default")}
      </div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-location-save ?disabled=${this.busy} @click=${()=>void this.save()}>${w("save")}</sw-button>
        <sw-button size="sm" data-location-cancel ?disabled=${this.busy} @click=${()=>this.editing=""}>${w("cancel")}</sw-button>
      </div>
    </div>`}row(e){return this.editing===e.id?this.editor():r`<div class="loc" data-location=${e.id} ?data-inactive=${!e.active}>
      <span class="txt"><b>${k(e.name)} ${e.is_default?r`<span class="chip" data-location-default>${w("defaultChip")}</span>`:p}
        ${e.active?p:r`<span class="chip" data-location-inactive>${w("inactiveChip")}</span>`}</b>
        <small>${k([pa(e),e.details].filter(Boolean).join(" · "))}</small>
        ${e.plan_zone_id&&this.areaName(e)?r`<small data-location-area>${k(w("areaLinked",{name:this.areaName(e)}))}</small>`:p}
        ${e.references?r`<small data-location-refs>${w("inUse",{n:e.references})}</small>`:p}</span>
      ${e.nav_url?r`<a class="nav" href=${e.nav_url} target="_blank" rel="noopener noreferrer" data-location-nav>${w("navigate")}</a>`:p}
      <span class="acts">
        <sw-button size="sm" data-location-edit=${e.id} ?disabled=${this.busy||!!this.editing} @click=${()=>this.open(e.id)}>${w("edit")}</sw-button>
        ${e.active&&!e.is_default?r`<sw-button size="sm" data-location-make-default=${e.id} ?disabled=${this.busy} @click=${()=>void this.patch(e,{is_default:!0})}>${w("makeDefault")}</sw-button>`:p}
        <sw-button size="sm" data-location-toggle=${e.id} ?disabled=${this.busy} @click=${()=>void this.patch(e,{active:!e.active})}>${e.active?w("deactivate"):w("activate")}</sw-button>
        ${e.references?p:r`<sw-button size="sm" data-location-remove=${e.id} ?disabled=${this.busy} @click=${()=>void this.removeLocation(e)}>${w("remove")}</sw-button>`}
      </span>
    </div>`}deptCard(e){const t=e.locations.filter(s=>s.active);return!this.depts.length||!t.length?p:r`<sw-card heading=${w("deptTitle")} subheading=${w("deptSub")} data-card="locations-departments">
      ${this.depts.map(s=>r`<div class="row" data-location-dept=${s.id}><span class="lbl">${k(s.name)}</span>
        <span class="end"><select class="in" aria-label=${`${w("deptTitle")} · ${s.name}`} ?disabled=${this.busy} @change=${a=>void this.setDept(s.id,a.target.value)}>
          <option value="" ?selected=${!e.department_defaults[s.id]}>${w("deptNone")}</option>
          ${t.map(a=>r`<option value=${a.id} ?selected=${e.department_defaults[s.id]===a.id}>${k(a.name)}</option>`)}
        </select></span></div>`)}
    </sw-card>`}render(){if(this.forbidden)return r`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return r`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${()=>void this.load()}>${w("retry")}</sw-button></sw-state-panel>`;const e=this.data;if(!e)return r`<sw-state-panel state="loading" heading=${w("loading")}></sw-state-panel>`;const t=e.locations.length>=e.max;return r`<sw-card heading=${w("title")} subheading=${w("sub")} data-card="locations">
      ${e.locations.length||this.editing==="new"?p:r`<div class="row" data-locations-empty><span class="lbl">${w("empty")}</span></div>`}
      ${xe(e.locations,s=>s.id,s=>this.row(s))}
      ${this.editing==="new"?this.editor():r`<div class="row"><sw-button size="sm" data-location-add ?disabled=${this.busy||!!this.editing||t}
        @click=${()=>this.open("new")}>${w("add")}</sw-button></div>`}
    </sw-card>
    ${this.deptCard(e)}`}};K.styles=[Y,Z,X`
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
  `,le];Q([c()],K.prototype,"data",2);Q([c()],K.prototype,"depts",2);Q([c()],K.prototype,"areas",2);Q([c()],K.prototype,"failed",2);Q([c()],K.prototype,"forbidden",2);Q([c()],K.prototype,"busy",2);Q([c()],K.prototype,"editing",2);Q([c()],K.prototype,"draft",2);Q([c()],K.prototype,"tried",2);Q([c()],K.prototype,"serverErr",2);K=Q([I("tickets-locations-settings")],K);const is={max_rules:50,hard_daily_max:200,default_daily:20,hold_max_min:1440,name_max:80,title_max:120,description_max:2e3,placeholders:["alert","details","place","source","since"]};function Ii(e,t){return{id:null,name:"",enabled:!0,source:e[0]?.key??"",subject_id:"",hold_min:"0",department_id:t[0]?.id??"",priority_id:"",category_id:"",title:"{alert} - {place}",description:"{details}",on_clear:"comment",daily_limit:""}}function ji(e){return{id:e.id,name:e.name,enabled:e.enabled,source:e.source,subject_id:e.subject_id??"",hold_min:String(e.hold_min??0),department_id:e.department_id,priority_id:e.priority_id??"",category_id:e.category_id??"",title:e.title,description:e.description??"",on_clear:e.on_clear,daily_limit:e.daily_limit==null?"":String(e.daily_limit)}}function qe(e){const t=e.trim();return t===""?null:/^-?\d+$/.test(t)?Number(t):Number.NaN}function ns(e,t){return typeof e=="number"&&Number.isInteger(e)&&e>=1?e:t}function it(e,t,s){const a=qe(e);return a===null?s?null:"required":Number.isNaN(a)?"integer":a>=1&&a<=t?null:"range"}function nt(e,t){let s=0;for(;s<e.length;){const a=e[s];if(a==="{"){if(e[s+1]==="{"){s+=2;continue}const i=e.indexOf("}",s);if(i<0)return!1;const n=e.slice(s+1,i);if(!t.includes(n))return!1;s=i+1;continue}if(a==="}"){if(e[s+1]==="}"){s+=2;continue}return!1}s+=1}return!0}function qi(e,t){const s=t.bounds,a={},i=e.name.trim();i?i.length>s.name_max&&(a.name="too_long"):a.name="required",t.sources.some(h=>h.key===e.source)||(a.source="unknown"),e.subject_id.trim().length>200&&(a.subject_id="too_long");const n=qe(e.hold_min);(n===null||Number.isNaN(n)||n<0||n>s.hold_max_min)&&(a.hold_min="range");const o=t.departments.find(h=>h.id===e.department_id);o||(a.department_id="unknown"),e.priority_id&&!o?.priorities.some(h=>h.id===e.priority_id)&&(a.priority_id="unknown"),e.category_id&&!o?.categories.some(h=>h.id===e.category_id)&&(a.category_id="unknown");const d=e.title.trim();d?d.length>s.title_max?a.title="too_long":nt(d,s.placeholders)||(a.title="placeholder"):a.title="required",e.description.length>s.description_max?a.description="too_long":nt(e.description,s.placeholders)||(a.description="placeholder");const u=it(e.daily_limit,s.hard_daily_max,!0);return u&&(a.daily_limit=u),a}function Lt(e){return{id:e.id,name:e.name.trim(),enabled:e.enabled,source:e.source,subject_id:e.subject_id.trim(),hold_min:qe(e.hold_min)??0,department_id:e.department_id,priority_id:e.priority_id||null,category_id:e.category_id||null,title:e.title.trim(),description:e.description,on_clear:e.on_clear,daily_limit:qe(e.daily_limit)}}function Rt(e){const{id:t,name:s,enabled:a,source:i,subject_id:n,hold_min:o,department_id:d,priority_id:u,category_id:h,title:$,description:R,on_clear:P,daily_limit:T}=e;return{id:t,name:s,enabled:a,source:i,subject_id:n,hold_min:o,department_id:d,priority_id:u,category_id:h,title:$,description:R,on_clear:P,daily_limit:T}}function At(e,t){const s={},a=["name","source","subject_id","hold_min","department_id","priority_id","category_id","title","description","on_clear","daily_limit"],i=["required","too_long","placeholder","range","integer","unknown","choice"];for(const n of e){const o=/^(?:rules\[(\d+)\]|rule)\.(\w+)$/.exec(n.field);if(!o||o[1]!==void 0&&t!==null&&Number(o[1])!==t)continue;const d=o[2];a.includes(d)&&(s[d]=i.includes(n.code)?n.code:"unknown")}return s}function Ui(e,t){return e.find(s=>s.key===t)?.label??""}const Bi={load:()=>Kt("tickets/rules"),save:e=>lt("tickets/rules",e),test:e=>bs("tickets/rules/test",{rule:e})},Fi=[{key:"sensor.leak",label:"דליפת מים",category:"safety",subject:"entity"},{key:"device.unavailable",label:"התקן לא זמין",category:"device_faults",subject:"entity"},{key:"camera.offline",label:"מצלמה לא זמינה",category:"device_faults",subject:"camera"},{key:"opening.left_open",label:"דלת / חלון נשארו פתוחים",category:"doors",subject:"entity"}],rs=[{id:"dept-maintenance",name:"אחזקה",priorities:[{id:"p-normal",name:"רגיל",is_default:!0},{id:"p-high",name:"גבוה",is_default:!1}],categories:[{id:"c-plumbing",name:"אינסטלציה"}]},{id:"dept-cleaning",name:"ניקיון",priorities:[{id:"p2-normal",name:"רגיל",is_default:!0}],categories:[]}],A={revision:2,enabled:!0,daily:20,seq:2,rules:[{id:"rule-demo-1",name:"דליפת מים לאחזקה",enabled:!0,source:"sensor.leak",subject_id:"",hold_min:2,department_id:"dept-maintenance",priority_id:"p-high",category_id:"c-plumbing",title:"{alert} - {place}",description:"{details}",on_clear:"comment",daily_limit:null,effective_limit:20,today_created:3,limit_reached:!1,suppressed_today:0,last_fired_at:"2026-10-19T07:12:00Z"},{id:"rule-demo-2",name:"מצלמה לא זמינה",enabled:!0,source:"camera.offline",subject_id:"",hold_min:15,department_id:"dept-maintenance",priority_id:null,category_id:null,title:"{alert}: {place}",description:"",on_clear:"comment_close",daily_limit:2,effective_limit:2,today_created:2,limit_reached:!0,suppressed_today:1,last_fired_at:"2026-10-19T09:40:00Z"}]};function Ht(){return{revision:A.revision,enabled:A.enabled,daily_limit_default:A.daily,day:"2026-10-19",sources:Fi,departments:rs,bounds:is,rules:A.rules.map(e=>{const t=ns(e.daily_limit,A.daily);return{...structuredClone(e),effective_limit:t,limit_reached:e.today_created>=t}})}}function Mt(e,t,s,a={}){return new x(e,{code:t,user_message:s,retryable:!1,correlation_id:"demo",details:a})}const Ki={load:async()=>Ht(),save:async e=>{if(e.revision!==A.revision)throw Mt(409,"rules_stale","הכללים השתנו בינתיים. טענו מחדש.",{revision:A.revision});const t=e.rules.findIndex(a=>!nt(a.title,is.placeholders));if(t>=0)throw Mt(422,"validation","ערך לא תקין.",{fields:[{field:`rules[${t}].title`,code:"placeholder"}]});const s=new Map(A.rules.map(a=>[a.id,a]));return A.rules=e.rules.map(a=>{const i=a.id?s.get(a.id):void 0,n=i?i.id:`rule-demo-${++A.seq}`;return{...a,id:n,effective_limit:0,today_created:i?.today_created??0,limit_reached:!1,suppressed_today:i?.suppressed_today??0,last_fired_at:i?.last_fired_at??null}}),A.enabled=e.enabled,A.daily=e.daily_limit_default,A.revision+=1,Ht()},test:async e=>{const t=A.rules.find(u=>u.id===e.id),s=ns(e.daily_limit,A.daily),a=t?.today_created??0,i=A.enabled?e.enabled?a>=s?"suppressed":"create":"rule_off":"rules_off",n={alert:"דליפת מים",details:"חיישן מים מטבח דיווח על מים.",place:"קומה 1",source:"דליפת מים",since:"19/10/2026 09:30"},o=u=>u.replace(/\{(\w+)\}/g,(h,$)=>n[$]??h),d=rs.find(u=>u.id===e.department_id);return{would:i,matches:1,held:1,effective_limit:s,today_created:a,sample_values:!1,alerts:[{title:"דליפת מים",place:"קומה 1",first_at:"2026-10-19T06:30:00Z",held:!0}],preview:{title:o(e.title),description:o(e.description),department:d?.name??"",priority:d?.priorities.find(u=>u.id===e.priority_id)?.name??d?.priorities.find(u=>u.is_default)?.name??""}}}};function tt(){return B()?Bi:Ki}const rt={tab:"פתיחה אוטומטית",title:"פתיחת {tickets} אוטומטית מהתראות",sub:"כלל פותח {ticket} {f:אחת|m:אחד} במחלקה כשהתראה נשארת פעילה, ומוסיף הערה כשהיא מסתיימת. פרטי ההתראה נכנסים ל{ticket} וגלויים לחברי המחלקה.",master:"פתיחה אוטומטית פעילה",masterSub:"כיבוי עוצר מיד את כל הכללים.",defaultLimit:"מקסימום ליום לכל כלל (ברירת מחדל)",defaultLimitSub:"בין 1 ל-{max}. כלל יכול לקבוע ערך משלו.",saveSettings:"שמירה",empty:"עדיין אין כללים. בלי כללים לא נפתח דבר.",add:"הוספת כלל",edit:"עריכה",remove:"מחיקה",enable:"הפעלה",disable:"השבתה",test:"בדיקת כלל",save:"שמירה",cancel:"ביטול",perDay:"{n} ליום",perDayDefault:"{n} ליום (ברירת מחדל)",today:"היום: {n}",limitReached:"הגיע למקסימום היום",disabledChip:"מושבת",invalidChip:"דורש תיקון",sourceGone:"מקור לא זמין",fName:"שם הכלל",fSource:"כשההתראה",fSubject:"רק עבור (מזהה, לא חובה)",fSubjectPh:"למשל binary_sensor.leak_kitchen",fHold:"פעילה לפחות (דקות)",fDept:"פתיחה במחלקה",fPriority:"עדיפות",fPriorityDefault:"ברירת המחדל של המחלקה",fCategory:"קטגוריה",fCategoryNone:"ללא",fTitle:"כותרת",fDescription:"תיאור",fPlaceholders:"אפשר להשתמש ב:",fOnClear:"כשההתראה מסתיימת",onClearComment:"להוסיף הערה",onClearClose:"להוסיף הערה ולסגור אם עוד לא {f:טופלה|m:טופל}",fLimit:"מקסימום ליום",fLimitPh:"ברירת מחדל ({n})",fEnabled:"פעיל",err_required:"שדה חובה",err_too_long:"הטקסט ארוך מדי",err_placeholder:"משתנה לא מוכר בטקסט",err_range:"מחוץ לטווח המותר",err_integer:"נא להזין מספר שלם",err_unknown:"הבחירה אינה זמינה",err_choice:"בחירה לא תקינה",saved:"הכללים נשמרו",removed:"הכלל נמחק",confirmRemove:'למחוק את הכלל "{name}"?',stale:"הכללים השתנו בינתיים. נטענו מחדש.",loading:"טוען כללים",retry:"נסו שוב",dryTitle:"תוצאת בדיקה",dryClose:"סגירה",dryMatches:"התראות פעילות שתואמות: {n} (מתוכן {held} כבר אחרי זמן ההמתנה)",drySample:"אין התראה פעילה כרגע - התצוגה עם ערכי דוגמה.",dryNone:"אין התראות פעילות שתואמות כרגע",would_create:"{f:תיפתח|m:ייפתח} {ticket} עכשיו",would_absorb:"יש כבר {ticket} {f:פתוחה|m:פתוח} להתראה הזו - תתווסף הערה",would_suppressed:"הכלל הגיע למקסימום היום - לא {f:תיפתח|m:ייפתח} {ticket}",would_wait_hold:"ההתראה עוד לא פעילה מספיק זמן",would_nothing:"לא יקרה דבר כרגע",would_already_handled:"ההתראות הפעילות כבר טופלו על ידי הכלל",would_rule_off:"הכלל מושבת",would_rules_off:"הפתיחה האוטומטית כבויה",dryPreview:"כך {f:תיראה|m:ייראה} {the_ticket}",dryDept:"מחלקה",dryPriority:"עדיפות",dryLimit:"היום {today} מתוך {limit}"},ls=Ce("en","tickets/rules-text","en"),Gi=rt,Vi=ls;function b(e,t){const s=(dt()==="en"?ls[e]:rt[e])??rt[e],a=vs(s,t);return $s(a)?fs(a):a}Ue("tickets/rules-text",{he:Gi,en:Vi});var Wi=Object.defineProperty,Xi=Object.getOwnPropertyDescriptor,G=(e,t,s,a)=>{for(var i=a>1?void 0:a?Xi(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Wi(t,s,i),i};const It={required:"err_required",too_long:"err_too_long",placeholder:"err_placeholder",range:"err_range",integer:"err_integer",unknown:"err_unknown",choice:"err_choice"};let q=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.doc=null,this.failed="",this.forbidden=!1,this.busy=!1,this.editing="",this.draft=null,this.tried=!1,this.serverErr={},this.limitText="",this.limitTried=!1,this.dryFor="",this.dry=null}connectedCallback(){super.connectedCallback(),this.load()}notice(e){this.dispatchEvent(new CustomEvent("notice",{detail:e,bubbles:!0,composed:!0}))}async load(){this.failed="";try{this.take(await tt().load())}catch(e){e instanceof x&&e.status===403?this.forbidden=!0:this.failed=_(e)}}take(e){this.doc=e,this.limitText=String(e.daily_limit_default),this.limitTried=!1}async saveDoc(e,t){const s=this.doc;if(!s)return!1;this.busy=!0;try{return this.take(await tt().save({revision:s.revision,enabled:t.enabled??s.enabled,daily_limit_default:t.daily??s.daily_limit_default,rules:e})),this.notice({ok:b(t.ok)}),!0}catch(a){if(a instanceof x&&a.code==="rules_stale")await this.load(),this.notice({error:b("stale")});else if(a instanceof x&&a.status===422){const i=a.body.details?.fields??[];this.serverErr=At(i,t.index??null),Object.keys(this.serverErr).length||this.notice({error:_(a)})}else this.notice({error:_(a)});return!1}finally{this.busy=!1}}current(){return(this.doc?.rules??[]).map(Rt)}open(e){const t=this.doc;if(!t)return;const s=t.rules.find(a=>a.id===e);this.editing=e,this.draft=s?ji(s):Ii(t.sources,t.departments),this.tried=!1,this.serverErr={},this.closeDry()}close(){this.editing="",this.draft=null,this.closeDry()}set(e,t){if(!this.draft)return;const s={...this.draft,[e]:t};e==="department_id"&&(s.priority_id="",s.category_id=""),this.draft=s,this.serverErr={}}problems(){return!this.draft||!this.doc?{}:{...qi(this.draft,this.doc),...this.serverErr}}async saveRule(){if(this.tried=!0,!this.draft||Object.keys(this.problems()).length)return;const e=Lt(this.draft),t=this.current();let s=t.findIndex(a=>a.id===this.editing);s<0?(t.push({...e,id:null}),s=t.length-1):t[s]=e,await this.saveDoc(t,{index:s,ok:"saved"})&&this.close()}async toggleRule(e){await this.saveDoc(this.current().map(t=>t.id===e.id?{...t,enabled:!e.enabled}:t),{ok:"saved"})}async removeRule(e){await Ft({body:b("confirmRemove",{name:e.name}),danger:!0})&&await this.saveDoc(this.current().filter(t=>t.id!==e.id),{ok:"removed"})&&this.editing===e.id&&this.close()}async setMaster(e){await this.saveDoc(this.current(),{enabled:e,ok:"saved"})}async saveLimit(){this.limitTried=!0;const e=this.doc;!e||it(this.limitText,e.bounds.hard_daily_max,!1)||await this.saveDoc(this.current(),{daily:qe(this.limitText)??e.daily_limit_default,ok:"saved"})}async test(e,t){this.busy=!0;try{this.dry=await tt().test(t),this.dryFor=e}catch(s){s instanceof x&&s.status===422&&this.draft?(this.tried=!0,this.serverErr=At(s.body.details?.fields??[],null)):this.notice({error:_(s)})}finally{this.busy=!1}}testDraft(){this.tried=!0,!(!this.draft||Object.keys(this.problems()).length)&&this.test(this.editing,Lt(this.draft))}closeDry(){this.dry=null,this.dryFor=""}err(e,t){const s=e[t];return(this.tried||this.serverErr[t])&&s?r`<span class="err" role="alert" data-rule-err=${t}>${b(It[s])}</span>`:p}dryPanel(){const e=this.dry;if(!e)return p;const t=`would_${e.would}`;return r`<div class="dry" role="status" data-rule-dry=${this.dryFor} data-dry-outcome=${e.would}>
      <div><small>${b("dryTitle")}</small></div>
      <div><b data-dry-would>${b(t)}</b></div>
      <div><small>${e.matches?b("dryMatches",{n:e.matches,held:e.held}):b("dryNone")}</small></div>
      ${e.alerts.length?r`<div><small data-dry-alerts>${e.alerts.map(s=>k([s.title,s.place].filter(Boolean).join(" · "))).join(" | ")}</small></div>`:p}
      ${e.sample_values?r`<div><small data-dry-sample>${b("drySample")}</small></div>`:p}
      <div><small>${b("dryPreview")}</small></div>
      <div class="pv" data-dry-preview><b>${k(e.preview.title)}</b>${e.preview.description?r`<br />${k(e.preview.description)}`:p}</div>
      <div><small>${b("dryDept")}: ${k(e.preview.department)} · ${b("dryPriority")}: ${k(e.preview.priority)} · ${b("dryLimit",{today:e.today_created,limit:e.effective_limit})}</small></div>
      <div><sw-button size="sm" data-dry-close @click=${()=>this.closeDry()}>${b("dryClose")}</sw-button></div>
    </div>`}editor(e){const t=this.draft,s=this.problems(),a=u=>String(!!((this.tried||this.serverErr[u])&&s[u])),i=e.departments.find(u=>u.id===t.department_id),n=e.sources.some(u=>u.key===t.source)?e.sources:[{key:t.source,label:b("sourceGone"),category:"",subject:""},...e.sources],o=u=>h=>this.set(u,h.target.value),d=u=>h=>this.set(u,h.target.value);return r`<div class="editor" data-rule-editor=${this.editing}>
      <label class="fld wide">${b("fName")}<input class="in" data-rule-field="name" maxlength=${e.bounds.name_max} aria-invalid=${a("name")} .value=${t.name}
        @input=${d("name")} />${this.err(s,"name")}</label>
      <label class="fld">${b("fSource")}<select class="in" data-rule-field="source" aria-invalid=${a("source")} @change=${o("source")}>
        ${n.map(u=>r`<option value=${u.key} ?selected=${u.key===t.source}>${u.label}</option>`)}</select>${this.err(s,"source")}</label>
      <label class="fld">${b("fHold")}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="hold_min" aria-invalid=${a("hold_min")} .value=${t.hold_min}
        @input=${d("hold_min")} />${this.err(s,"hold_min")}</label>
      <label class="fld wide">${b("fSubject")}<input class="in" dir="ltr" data-rule-field="subject_id" maxlength="200" placeholder=${b("fSubjectPh")}
        aria-invalid=${a("subject_id")} .value=${t.subject_id} @input=${d("subject_id")} />${this.err(s,"subject_id")}</label>
      <label class="fld">${b("fDept")}<select class="in" data-rule-field="department_id" aria-invalid=${a("department_id")} @change=${o("department_id")}>
        ${i?p:r`<option value="" selected>—</option>`}
        ${e.departments.map(u=>r`<option value=${u.id} ?selected=${u.id===t.department_id}>${k(u.name)}</option>`)}</select>${this.err(s,"department_id")}</label>
      <label class="fld">${b("fPriority")}<select class="in" data-rule-field="priority_id" aria-invalid=${a("priority_id")} @change=${o("priority_id")}>
        <option value="" ?selected=${!t.priority_id}>${b("fPriorityDefault")}</option>
        ${(i?.priorities??[]).map(u=>r`<option value=${u.id} ?selected=${u.id===t.priority_id}>${k(u.name)}</option>`)}</select>${this.err(s,"priority_id")}</label>
      ${i?.categories.length?r`<label class="fld">${b("fCategory")}<select class="in" data-rule-field="category_id" aria-invalid=${a("category_id")} @change=${o("category_id")}>
        <option value="" ?selected=${!t.category_id}>${b("fCategoryNone")}</option>
        ${i.categories.map(u=>r`<option value=${u.id} ?selected=${u.id===t.category_id}>${k(u.name)}</option>`)}</select>${this.err(s,"category_id")}</label>`:p}
      <label class="fld">${b("fLimit")}<input class="in num" inputmode="numeric" dir="ltr" data-rule-field="daily_limit" placeholder=${b("fLimitPh",{n:e.daily_limit_default})}
        aria-invalid=${a("daily_limit")} .value=${t.daily_limit} @input=${d("daily_limit")} />${this.err(s,"daily_limit")}</label>
      <label class="fld wide">${b("fTitle")}<input class="in" data-rule-field="title" maxlength=${e.bounds.title_max} aria-invalid=${a("title")} .value=${t.title}
        @input=${d("title")} />${this.err(s,"title")}</label>
      <label class="fld wide">${b("fDescription")}<textarea class="in" data-rule-field="description" maxlength=${e.bounds.description_max} aria-invalid=${a("description")}
        .value=${t.description} @input=${d("description")}></textarea>${this.err(s,"description")}<span class="hint" data-rule-placeholders>${b("fPlaceholders")} <span dir="ltr">${e.bounds.placeholders.map(u=>`{${u}}`).join(" ")}</span></span></label>
      <label class="fld wide">${b("fOnClear")}<select class="in" data-rule-field="on_clear" @change=${o("on_clear")}>
        <option value="comment" ?selected=${t.on_clear==="comment"}>${b("onClearComment")}</option>
        <option value="comment_close" ?selected=${t.on_clear==="comment_close"}>${b("onClearClose")}</option></select></label>
      <div class="checks wide"><label><input type="checkbox" data-rule-field="enabled" .checked=${t.enabled}
        @change=${u=>this.set("enabled",u.target.checked)} /> ${b("fEnabled")}</label></div>
      <div class="acts wide">
        <sw-button size="sm" variant="primary" data-rule-save ?disabled=${this.busy} @click=${()=>void this.saveRule()}>${b("save")}</sw-button>
        <sw-button size="sm" data-rule-test-draft ?disabled=${this.busy} @click=${()=>this.testDraft()}>${b("test")}</sw-button>
        <sw-button size="sm" data-rule-cancel ?disabled=${this.busy} @click=${()=>this.close()}>${b("cancel")}</sw-button>
      </div>
      ${this.dryFor===this.editing?r`<div class="wide">${this.dryPanel()}</div>`:p}
    </div>`}row(e,t){if(this.editing===t.id)return this.editor(e);const s=e.departments.find(n=>n.id===t.department_id),a=Ui(e.sources,t.source)||b("sourceGone"),i=t.daily_limit==null?b("perDayDefault",{n:t.effective_limit}):b("perDay",{n:t.effective_limit});return r`<div class="rule" data-rule=${t.id} ?data-off=${!t.enabled||!e.enabled}>
      <span class="txt"><b>${k(t.name)}
        ${t.enabled?p:r`<span class="chip" data-rule-disabled>${b("disabledChip")}</span>`}
        ${t.invalid?r`<span class="chip bad" data-rule-invalid>${b("invalidChip")}</span>`:p}
        ${t.limit_reached?r`<span class="chip warn" data-rule-limit-reached>${b("limitReached")}</span>`:p}</b>
        <small>${a} · ${k(s?.name??"—")}</small>
        <small><span data-rule-limit>${i}</span> · <span data-rule-today>${b("today",{n:t.today_created})}</span></small></span>
      <span class="acts">
        <sw-button size="sm" data-rule-edit=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>this.open(t.id)}>${b("edit")}</sw-button>
        <sw-button size="sm" data-rule-test=${t.id} ?disabled=${this.busy||!!this.editing||!!t.invalid} @click=${()=>void this.test(t.id,Rt(t))}>${b("test")}</sw-button>
        <sw-button size="sm" data-rule-toggle=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>void this.toggleRule(t)}>${t.enabled?b("disable"):b("enable")}</sw-button>
        <sw-button size="sm" data-rule-remove=${t.id} ?disabled=${this.busy||!!this.editing} @click=${()=>void this.removeRule(t)}>${b("remove")}</sw-button>
      </span>
    </div>
    ${this.dryFor===t.id?this.dryPanel():p}`}render(){if(this.forbidden)return r`<sw-state-panel state="forbidden"></sw-state-panel>`;if(this.failed)return r`<sw-state-panel state="error" heading=${this.failed}><sw-button size="sm" @click=${()=>void this.load()}>${b("retry")}</sw-button></sw-state-panel>`;const e=this.doc;if(!e)return r`<sw-state-panel state="loading" heading=${b("loading")}></sw-state-panel>`;const t=this.limitTried?it(this.limitText,e.bounds.hard_daily_max,!1):null,s=e.rules.length>=e.bounds.max_rules;return r`<sw-card heading=${b("title")} subheading=${b("sub")} data-card="ticket-rules-settings">
      <div class="row"><span class="lbl">${b("master")}<span class="muted">${b("masterSub")}</span></span>
        <span class="end"><sw-toggle label=${b("master")} labelHidden .checked=${e.enabled} ?disabled=${this.busy} data-rules-master
          @change=${a=>void this.setMaster(a.detail.checked)}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${b("defaultLimit")}<span class="muted">${b("defaultLimitSub",{max:e.bounds.hard_daily_max})}</span></span>
        <span class="end"><input class="in num" inputmode="numeric" dir="ltr" data-rules-default-limit aria-label=${b("defaultLimit")}
          aria-invalid=${String(!!t)} .value=${this.limitText} @input=${a=>this.limitText=a.target.value} />
          <sw-button size="sm" data-rules-default-save ?disabled=${this.busy||this.limitText===String(e.daily_limit_default)}
            @click=${()=>void this.saveLimit()}>${b("saveSettings")}</sw-button>
          ${t?r`<span class="err" role="alert" data-rules-default-err>${b(It[t])}</span>`:p}</span></div>
    </sw-card>
    <sw-card data-card="ticket-rules">
      ${e.rules.length||this.editing==="new"?p:r`<div class="row" data-rules-empty><span class="lbl">${b("empty")}</span></div>`}
      ${xe(e.rules,a=>a.id,a=>this.row(e,a))}
      ${this.editing==="new"?this.editor(e):r`<div class="row"><sw-button size="sm" data-rule-add ?disabled=${this.busy||!!this.editing||s||!e.departments.length}
        @click=${()=>this.open("new")}>${b("add")}</sw-button></div>`}
    </sw-card>`}};q.styles=[Y,Z,X`
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
  `,le];G([c()],q.prototype,"doc",2);G([c()],q.prototype,"failed",2);G([c()],q.prototype,"forbidden",2);G([c()],q.prototype,"busy",2);G([c()],q.prototype,"editing",2);G([c()],q.prototype,"draft",2);G([c()],q.prototype,"tried",2);G([c()],q.prototype,"serverErr",2);G([c()],q.prototype,"limitText",2);G([c()],q.prototype,"limitTried",2);G([c()],q.prototype,"dryFor",2);G([c()],q.prototype,"dry",2);q=G([I("tickets-rules-settings")],q);var Yi=Object.defineProperty,Zi=Object.getOwnPropertyDescriptor,Fe=(e,t,s,a)=>{for(var i=a>1?void 0:a?Zi(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&Yi(t,s,i),i};let Pe=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.busy=!1,this.error=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents"}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await Gt().saveSettings(this.doc.revision,e);this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}seg(e,t,s,a,i){const n=this.doc?.ui?.[e]??As[e];return r`<div class="row"><span class="lbl">${me(t)}<span class="muted">${me(s)}</span></span>
      <sw-segmented radio label=${me(t)} value=${String(n)} ?disabled=${this.disabled||this.busy}
        @change=${o=>{const d=a.find(u=>String(u)===o.detail.value);d!==void 0&&this.save({ui:{[e]:d}})}}
        .options=${a.map(o=>({value:String(o),label:me(`${i}${String(o)}`),attrs:{"data-ui-board":`${String(e)}:${String(o)}`}}))}></sw-segmented></div>`}handledRow(){const e=this.doc?.ui?.handled_days??7;return r`<div class="row"><span class="lbl">${me("setHandledDays")}<span class="muted">${me("setHandledDaysSub")}</span></span>
      <sw-segmented radio label=${me("setHandledDays")} value=${String(e)} ?disabled=${this.disabled||this.busy}
        @change=${t=>void this.save({ui:{handled_days:Number(t.detail.value)}})}
        .options=${[1,7,30].map(t=>({value:String(t),label:me(`hd_${t}`),attrs:{"data-ui-board":`handled_days:${t}`}}))}></sw-segmented></div>`}render(){return r`
      ${this.seg("board_floors","setBoardFloors","setBoardFloorsSub",["tree","chips","chips_tree"],"bf_")}
      ${this.seg("grouping","setGrouping","setGroupingSub",["no_status_filter","always","never"],"g_")}
      ${this.seg("closed_strip","setClosedStrip","setClosedStripSub",["all","week","hidden"],"cs_")}
      ${this.handledRow()}
      ${this.error?r`<div class="row"><span class="field-error" role="alert" data-board-settings-error>${this.error}</span></div>`:""}`}};Fe([O({attribute:!1})],Pe.prototype,"doc",2);Fe([O({type:Boolean})],Pe.prototype,"disabled",2);Fe([c()],Pe.prototype,"busy",2);Fe([c()],Pe.prototype,"error",2);Pe=Fe([I("ticket-board-settings")],Pe);const Ji=["now","digest","off"],ds=["push","email","whatsapp"],jt=/^([01]\d|2[0-3]):[0-5]\d$/;function Qi(e,t,s){return e[t]?.[s]??(t==="*"?void 0:e["*"]?.[s])??"now"}function en(e,t){return e===t?null:t}function tn(e,t,s,a){const i={};for(const[o,d]of Object.entries(e))i[o]={...d};const n={...i[t]??{}};return a===null||a==="now"&&t==="*"?delete n[s]:n[s]=a,Object.keys(n).length?i[t]=n:delete i[t],i}function sn(e,t){const s=e.departments??{},a=s[t]??{},i=t==="*"?{}:s["*"]??{},n=a.recipients??i.recipients,o={};for(const d of ds){const u=a.channels?.[d],h=i.channels?.[d];o[d]=u?{value:u,inherited:!1}:{value:h??"inherit",inherited:!!h}}return{digestTime:t!=="*"&&a.digest_time||e.digest_time,timeInherited:t==="*"||!a.digest_time,recipients:n?{managers:n.managers,users:[...n.users],roles:[...n.roles]}:{managers:!0,users:[],roles:[]},recipientsInherited:!a.recipients,channels:o}}function Me(e,t,s,a){const i={};for(const[o,d]of Object.entries(e??{}))i[o]={...d};const n={...i[t]??{}};return a===void 0||s==="channels"&&!Object.keys(a).length?delete n[s]:n[s]=a,Object.keys(n).length?i[t]=n:delete i[t],i}function an(e,t,s){const a={...e??{}};return s==="inherit"?delete a[t]:a[t]=s,a}function qt(e,t){return e.includes(t)?e.filter(s=>s!==t):[...e,t]}function nn(e,t){return`${e}/${t}`}function rn(e,t,s){const a={...e??{}};return s==="inherit"?delete a[t]:a[t]=s,a}var ln=Object.defineProperty,dn=Object.getOwnPropertyDescriptor,he=(e,t,s,a)=>{for(var i=a>1?void 0:a?dn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&ln(t,s,i),i};let re=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.meta=null,this.dept="*",this.busy=!1,this.error="",this.time=null,this.deptTime=null}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents",this.loadMeta(!0)}loadMeta(e){Kt("tickets/settings/notify-matrix").then(t=>this.meta=t).catch(t=>{e&&(this.error=`${f("loadError")}: ${_(t)}`)})}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await lt("tickets/settings",{revision:this.doc.revision,notify:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0})),this.time=null,this.deptTime=null,this.loadMeta(!1)}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}get off(){return this.disabled||this.busy}toggle(e,t,s,a,i){return r`<div class="row"><span class="lbl">${e}<span class="muted">${t}</span></span>
      <sw-toggle label=${e} labelHidden .checked=${s} ?disabled=${this.off} data-notify=${a}
        @change=${n=>void this.save({[i]:n.detail.checked})}></sw-toggle></div>`}seg(e,t,s,a,i,n){return r`<sw-segmented radio label=${e} value=${s} ?disabled=${this.off} @change=${o=>n(o.detail.value)}
      .options=${t.map(o=>({value:o,label:a(o),attrs:{"data-notify-cell":i(o)}}))}></sw-segmented>`}pick(e,t){const s=Qi(t,this.dept,e.key),a=this.dept==="*"||t[this.dept]?.[e.key]!==void 0,i=Ji.filter(d=>d!=="digest"||e.digest),n={now:f("modeNow"),digest:f("modeDigest"),off:f("modeOff")},o=gs(e.key,e.label);return r`<div class="row" data-notify-source=${e.key}><span class="lbl">${o}<span class="muted">${[e.assignee?f("assigneeTag"):"",e.sla?f("slaTag"):"",a?"":f("inherited")].filter(Boolean).join(" · ")}</span></span>
      ${this.seg(o,i,s,d=>n[d],d=>`${e.key}:${d}`,d=>void this.save({matrix:tn(t,this.dept,e.key,en(s,d))}))}</div>`}chips(e,t,s){const a=e==="users"?this.meta?.users??[]:this.meta?.roles??[],i=t[e],n=u=>a.find(h=>h.id===u)?.name??u,o=u=>void this.save({departments:Me(s.departments,this.dept,"recipients",{...t,[e]:u})}),d=f(e==="users"?"recUsers":"recRoles");return r`<div class="row"><span class="lbl">${d}</span>
      <span class="end nm-chips" data-notify-pick=${e}>
        ${i.map(u=>r`<span class="nm-chip">${n(u)}<button type="button" class="nm-x" aria-label=${f("remove",{name:n(u)})}
          ?disabled=${this.off} @click=${()=>o(qt(i,u))}>×</button></span>`)}
        <select class="in" aria-label=${f(e==="users"?"addUser":"addRole")} ?disabled=${this.off} data-notify-add=${e}
          @change=${u=>{const h=u.target;h.value&&o(qt(i,h.value)),h.value=""}}>
          <option value="">${f(e==="users"?"addUser":"addRole")}</option>
          ${a.filter(u=>!i.includes(u.id)).map(u=>r`<option value=${u.id}>${u.name}</option>`)}
        </select></span></div>`}deptSection(e){const t=sn(e,this.dept),s=(e.departments??{})[this.dept]??{},a=this.deptTime??(this.dept!=="*"&&s.digest_time?s.digest_time:""),i=this.deptTime!==null&&(this.deptTime===""||jt.test(this.deptTime))&&this.deptTime!==(s.digest_time??""),n=t.recipients,o=ds.filter(d=>this.meta?.channels.includes(d));return r`
      ${this.dept!=="*"&&e.digest_enabled?r`<div class="row"><span class="lbl">${f("deptTime")}<span class="muted">${f("deptTimeSub",{time:e.digest_time})}</span></span>
        <span class="end"><input class="in time" type="time" lang=${ve()} aria-label=${f("deptTime")} data-notify-dept-time .value=${a} ?disabled=${this.off}
          @input=${d=>this.deptTime=d.target.value} />
          <sw-button size="sm" variant="primary" data-notify-dept-time-save ?disabled=${!i||this.off}
            @click=${()=>void this.save({departments:Me(e.departments,this.dept,"digest_time",this.deptTime||void 0)})}>${f("save")}</sw-button></span></div>`:p}
      ${e.digest_enabled?r`
        <div class="row"><span class="lbl">${f("recipients")}<span class="muted">${f("recipientsSub")}${this.dept!=="*"&&t.recipientsInherited?` · ${f("inherited")}`:""}</span></span>
          ${this.dept!=="*"&&!t.recipientsInherited?r`<sw-button size="sm" variant="ghost" data-notify-rec-inherit ?disabled=${this.off}
            @click=${()=>void this.save({departments:Me(e.departments,this.dept,"recipients",void 0)})}>${f("backToStar")}</sw-button>`:p}</div>
        <div class="row"><span class="lbl">${f("recManagers")}</span>
          <sw-toggle label=${f("recManagers")} labelHidden .checked=${n.managers} ?disabled=${this.off} data-notify-rec-managers
            @change=${d=>void this.save({departments:Me(e.departments,this.dept,"recipients",{...n,managers:d.detail.checked})})}></sw-toggle></div>
        ${this.chips("users",n,e)}
        ${this.chips("roles",n,e)}`:p}
      <div class="row"><span class="lbl">${f("channels")}<span class="muted">${f("channelsSub")}</span></span></div>
      <div class="row"><span class="lbl">${f("chInapp")}</span><span class="muted" data-notify-inapp>${f("chInappAlways")}</span></div>
      ${o.map(d=>{const u=t.channels[d],h=s.channels?.[d]??"inherit",$=f(`ch_${d}`),R=P=>P==="inherit"?u.inherited?`${f("inherited")}: ${f(u.value==="on"?"chOn":"chOff")}`:f("chInherit"):f(P==="on"?"chOn":"chOff");return r`<div class="row" data-notify-channel=${d}><span class="lbl">${$}</span>
          ${this.seg($,["inherit","on","off"],h,R,P=>`ch-${d}:${P}`,P=>void this.save({departments:Me(e.departments,this.dept,"channels",an(s.channels,d,P))}))}</div>`})}`}slaSection(e){const t=this.meta?.departments.find(i=>i.id===this.dept);if(!t||!t.priorities.length)return p;const s=e.sla_urgent??{},a=i=>f(i==="inherit"?"slaInherit":i==="immediate"?"slaImmediate":"slaMatrix");return r`<div class="row"><span class="lbl">${f("sla")}<span class="muted">${f("slaSub")}</span></span></div>
      ${t.priorities.map(i=>{const n=nn(t.id,i.id),o=s[n]??"inherit";return r`<div class="row" data-notify-sla=${i.id}><span class="lbl">${i.name}</span>
          ${this.seg(i.name,["inherit","immediate","matrix"],o,a,d=>`sla-${i.id}:${d}`,d=>void this.save({sla_urgent:rn(s,n,d)}))}</div>`})}`}render(){const e=this.doc?.notify;if(!e)return p;const t=this.time??e.digest_time,s=this.time!==null&&this.time!==e.digest_time&&jt.test(this.time),a=this.meta?f("pending",{n:this.meta.pending}):"";return r`
      ${this.toggle(f("matrixOn"),f("matrixOnSub"),e.matrix_enabled,"matrix-enabled","matrix_enabled")}
      ${this.toggle(f("digestOn"),f("digestOnSub"),e.digest_enabled,"digest-enabled","digest_enabled")}
      ${this.toggle(f("urgent"),f("urgentSub"),e.urgent_immediate??!0,"urgent-immediate","urgent_immediate")}
      <div class="row"><span class="lbl">${f("siteTime")}<span class="muted">${[f("siteTimeSub"),a].filter(Boolean).join(" · ")}</span></span>
        <span class="end"><input class="in time" type="time" lang=${ve()} aria-label=${f("siteTime")} data-notify-time .value=${t} ?disabled=${this.off}
          @input=${i=>this.time=i.target.value} />
          <sw-button size="sm" variant="primary" data-notify-time-save ?disabled=${!s||this.busy} @click=${()=>void this.save({digest_time:this.time})}>${f("save")}</sw-button></span></div>
      ${e.matrix_enabled&&this.meta?r`
        <div class="row"><span class="lbl">${f("dept")}</span>
          <select class="in" aria-label=${f("dept")} data-notify-dept .value=${this.dept}
            @change=${i=>{this.dept=i.target.value,this.deptTime=null}}>
            <option value="*">${f("allDepts")}</option>
            ${this.meta.departments.map(i=>r`<option value=${i.id} ?selected=${this.dept===i.id}>${i.name}${i.pending?` (${i.pending})`:""}</option>`)}
          </select></div>
        ${this.deptSection(e)}
        <div class="row"><span class="lbl">${f("events")}</span></div>
        ${this.meta.sources.map(i=>this.pick(i,e.matrix))}
        ${this.dept!=="*"?this.slaSection(e):p}`:p}
      ${this.error?r`<div class="row"><span class="field-error" role="alert" data-notify-error>${this.error}</span></div>`:p}`}};he([O({attribute:!1})],re.prototype,"doc",2);he([O({type:Boolean})],re.prototype,"disabled",2);he([c()],re.prototype,"meta",2);he([c()],re.prototype,"dept",2);he([c()],re.prototype,"busy",2);he([c()],re.prototype,"error",2);he([c()],re.prototype,"time",2);he([c()],re.prototype,"deptTime",2);re=he([I("ticket-notify-matrix")],re);const os={card:"ביקורי ספקים והגעה לאתר",enabled:"ביקורי ספקים",enabledSub:"ביקור מתוכנן לכל ספק חיצוני, זיהוי ספק שלא הגיע והתראה למנהל",publicArrival:'כפתור "הגעתי" בדף הספק',publicArrivalSub:"הספק לוחץ פעם אחת בדף שלו; לחיצה היא דיווח שלו ולא הוכחת נוכחות, והדף לא פותח שום דלת",claimCounts:"דיווח הספק נחשב הגעה",claimCountsSub:'כבוי: הדיווח נשאר "דווח" עד שמנהל מאשר',offer:"הפניה לבקשת קוד כניסה אחרי ההגעה",offerSub:'כבוי כברירת מחדל. הבקשה עצמה עוברת תמיד אישור של מנהל; דורש שכרטיס "כניסה לאתר" זמין',notifyVendor:"תזכורת לספק שלא הגיע",notifyVendorSub:"כבוי כברירת מחדל; ההודעה נשלחת רק בשעות השליחה המותרות",grace:"סבלנות אחרי סוף החלון",graceSub:"דקות עד שביקור נחשב כלא הגיע (0–240)",early:"הכפתור נפתח לפני החלון",earlySub:"דקות לפני תחילת החלון (0–720)",save:"שמירה",minutes:"דק׳",errRange:"ערך מחוץ לטווח"},cs=Ce("en","tickets/visits-settings-text","en");function ae(e){return dt()==="en"?cs[e]:os[e]}Ue("tickets/visits-settings-text",{he:os,en:cs});var on=Object.defineProperty,cn=Object.getOwnPropertyDescriptor,Re=(e,t,s,a)=>{for(var i=a>1?void 0:a?cn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&on(t,s,i),i};const pn=[{key:"grace_min",label:"grace",sub:"graceSub",lo:0,hi:240},{key:"early_min",label:"early",sub:"earlySub",lo:0,hi:720}],un=[{key:"enabled",label:"enabled",sub:"enabledSub"},{key:"public_arrival",label:"publicArrival",sub:"publicArrivalSub"},{key:"claim_counts",label:"claimCounts",sub:"claimCountsSub"},{key:"offer_access_request",label:"offer",sub:"offerSub"},{key:"notify_vendor_on_miss",label:"notifyVendor",sub:"notifyVendorSub"}],hn={enabled:!0,public_arrival:!0,claim_counts:!0,offer_access_request:!1,notify_vendor_on_miss:!1,grace_min:60,early_min:60};let De=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.draft={},this.busy=!1,this.error=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents"}get cur(){return{...hn,...this.doc?.visits??{}}}get off(){return this.disabled||this.busy}async save(e,t){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const s=await lt("tickets/settings",{revision:this.doc.revision,visits:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:s,bubbles:!0,composed:!0})),t?.()}catch(s){this.error=s instanceof x?s.body.user_message||_(s):_(s)}finally{this.busy=!1}}}render(){if(!this.doc)return r`${p}`;const e=this.cur,t=pn.map(i=>{const n=this.draft[i.key]??String(e[i.key]);return{...i,raw:n,v:H(n,i.lo,i.hi)}}),s=t.some(i=>Number.isNaN(i.v)),a=t.some(i=>i.v!==e[i.key]);return r`
      ${un.map(i=>r`<div class="row"><span class="lbl">${ae(i.label)}<span class="muted">${ae(i.sub)}</span></span>
        <sw-toggle label=${ae(i.label)} labelHidden .checked=${e[i.key]} ?disabled=${this.off} data-vs=${i.key}
          @change=${n=>void this.save({[i.key]:n.detail.checked})}></sw-toggle></div>`)}
      ${t.map(i=>r`<div class="row"><span class="lbl">${ae(i.label)}<span class="muted">${ae(i.sub)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${i.lo} max=${i.hi} data-vs-num=${i.key} aria-label=${ae(i.label)} aria-invalid=${String(Number.isNaN(i.v))}
          ?disabled=${this.off} .value=${i.raw} @input=${n=>this.draft={...this.draft,[i.key]:n.target.value}} /><span class="muted">${ae("minutes")}</span></span></div>`)}
      <div class="row"><span class="end"><sw-button size="sm" variant="primary" data-vs-save ?disabled=${s||!a||this.off}
        @click=${()=>void this.save({grace_min:t[0].v,early_min:t[1].v},()=>this.draft={})}>${ae("save")}</sw-button>
        ${s?r`<span class="field-error">${ae("errRange")}</span>`:p}</span></div>
      ${this.error?r`<div class="row"><span class="field-error" role="alert">${this.error}</span></div>`:p}`}};Re([O({attribute:!1})],De.prototype,"doc",2);Re([O({type:Boolean})],De.prototype,"disabled",2);Re([c()],De.prototype,"draft",2);Re([c()],De.prototype,"busy",2);Re([c()],De.prototype,"error",2);De=Re([I("ticket-visits-settings")],De);const ps={qReminder:"תזכורת על שאלת ספק שלא נענתה",qReminderSub:"כמה שעות אחרי השאלה (0 = בלי תזכורת; פעם אחת לכל שאלה)",qBadgeAll:"מספר השאלות הממתינות גם לצופה בכל המחלקות",qBadgeAllSub:"כבוי - רק מי שמנהל את הבקשה רואה את המספר בניווט. הטקסט של השאלות אינו מוצג.",anSetting:"הודעת אישור לספק שזכה",anSettingSub:"נוסח קבוע: ההצעה אושרה ומחייבת, ועל הספק להודיע מראש דרך הקישור אם הוא דוחה את העבודה",anMode_confirm:"באישור המנהל (ברירת מחדל)",anMode_auto:"אוטומטית עם כל אישור",anMode_off:"לא לשלוח",ppLateHours:'הודעת דחייה "באיחור"',ppLateHoursSub:'הודעה שנמסרה פחות משעות אלה לפני המועד המתוכנן (או אחריו) מסומנת "באיחור" למנהלים. 0 = רק אחרי תחילת המועד. סימון בלבד, לא חסימה'},us=Ce("en","tickets/rfq-settings-text","en");function U(e){return dt()==="en"?us[e]:ps[e]}Ue("tickets/rfq-settings-text",{he:ps,en:us});const ht=["general","departments","locations","display","channel","messages","costs","rules","permissions"];function mn(e){return!!e&&ht.includes(e)}function bn(e){const t=!e.api||e.can("system.configure"),s=!e.api||e.can("tickets.configure");return ht.filter(a=>a==="display"||a==="channel"||a==="costs"||a==="rules"?t:a==="messages"||a==="locations"?s:!0)}function Ut(e){const s=`p_${String(e??"").replace(/^tickets\./,"").replace(/\./g,"_")}`;return Bt.includes(s)?l(s):ia.includes(s)?S(s):Gs.includes(s)?Vs(s):String(e??"")}var vn=Object.defineProperty,$n=Object.getOwnPropertyDescriptor,Ne=(e,t,s,a)=>{for(var i=a>1?void 0:a?$n(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&vn(t,s,i),i};let ge=class extends M{constructor(){super(...arguments),this.doc=null,this.disabled=!1,this.busy=!1,this.error="",this.departments=[],this.bad=""}createRenderRoot(){return this}connectedCallback(){super.connectedCallback(),this.style.display="contents",g().departments().then(e=>this.departments=e.departments.filter(t=>t.active).map(t=>({id:t.id,name:t.name}))).catch(()=>g().meta().then(e=>this.departments=e.departments.map(t=>({id:t.id,name:t.name}))).catch(()=>{}))}async save(e){if(!(!this.doc||this.busy)){this.busy=!0,this.error="";try{const t=await Gt().saveSettings(this.doc.revision,{ui:e});this.dispatchEvent(new CustomEvent("doc-changed",{detail:t,bubbles:!0,composed:!0}))}catch(t){this.error=t instanceof x?t.body.user_message||_(t):_(t)}finally{this.busy=!1}}}seg(e,t,s,a,i,n){return r`<div class="row"><span class="lbl">${E(t)}<span class="muted">${E(s)}</span></span>
      <sw-segmented radio label=${E(t)} value=${i} ?disabled=${this.disabled||this.busy} @change=${o=>void this.save({[e]:o.detail.value})}
        .options=${a.map(o=>({value:o,label:E(`${n}${o}`),attrs:{"data-ui-overview":`${e}:${o}`}}))}></sw-segmented></div>`}onBusy(e,t){const s=e.target,a=wa(s.value),i=We(this.doc?.ui);if(a===void 0||t===null&&a===null){this.bad=t??"*";return}if(this.bad="",t===null){a!==i.busy&&this.save({dash_busy:a});return}const n={...i.busyByDept};a===null?delete n[t]:n[t]=a,JSON.stringify(n)!==JSON.stringify(i.busyByDept)&&this.save({dash_busy_departments:n})}alertRows(){const e=We(this.doc?.ui),t=a=>`${String(a).padStart(2,"0")}:00`,s=a=>{const i=xa(a.target.value);if(i===void 0){this.bad="stuck";return}this.bad="",i!==e.deptStuck&&this.save({dash_dept_stuck:i})};return r`<div class="row"><span class="lbl">${E("setDigestHour")}<span class="muted">${E("setDigestHourSub")}</span></span>
        <select class="num-in" style="inline-size:auto;min-inline-size:104px;text-align:start" aria-label=${E("setDigestHour")} data-digest-hour ?disabled=${this.disabled||this.busy}
          @change=${a=>void this.save({dash_digest_hour:Number(a.target.value)})}>
          ${Array.from({length:24},(a,i)=>r`<option value=${i} ?selected=${i===e.digestHour}>${t(i)}</option>`)}
        </select></div>
      <div class="row"><span class="lbl">${E("setDeptStuck")}<span class="muted">${E("setDeptStuckSub")}</span></span>
        <input type="text" inputmode="numeric" maxlength="3" size="4" class="num-in" .value=${String(e.deptStuck)} aria-label=${E("setDeptStuck")}
          aria-invalid=${String(this.bad==="stuck")} data-dept-stuck ?disabled=${this.disabled||this.busy} @change=${s} /></div>
      ${this.bad==="stuck"?r`<div class="row"><span class="field-error" role="alert" data-dept-stuck-error>${E("setDeptStuckInvalid")}</span></div>`:p}`}busyRows(){const e=We(this.doc?.ui),t=(s,a,i)=>r`<input type="text" inputmode="numeric" maxlength="2" size="3" class="num-in" .value=${a}
      placeholder=${s===null?"":String(e.busy)} aria-label=${i} aria-invalid=${String(this.bad===(s??"*"))} data-busy-input=${s??"*"}
      ?disabled=${this.disabled||this.busy} @change=${n=>this.onBusy(n,s)} />`;return r`<div class="row"><span class="lbl">${E("setBusy")}<span class="muted">${E("setBusySub")}</span></span>${t(null,String(e.busy),E("setBusy"))}</div>
      ${this.departments.length?r`<div class="row" data-busy-departments><span class="lbl">${E("setBusyDept")}<span class="muted">${E("setBusyDeptSub")}</span></span>
        <span class="busy-depts">${this.departments.map(s=>r`<label class="busy-dept"><span>${k(s.name)}</span>${t(s.id,e.busyByDept[s.id]?String(e.busyByDept[s.id]):"",`${E("setBusyDept")} · ${s.name}`)}</label>`)}</span></div>`:p}
      ${this.bad&&this.bad!=="stuck"?r`<div class="row"><span class="field-error" role="alert" data-busy-error>${E("setBusyInvalid")}</span></div>`:p}`}render(){const e=We(this.doc?.ui);return r`
      ${this.seg("dash_handler_numbers","setHandlerNumbers","setHandlerNumbersSub",ya,e.handlerNumbers,"hn_")}
      ${this.seg("dash_vendors","setVendors","setVendorsSub",_a,e.vendors,"vd_")}
      ${this.busyRows()}
      ${this.seg("dash_compare","setCompare","setCompareSub",ka,e.compare,"cp_")}
      ${this.alertRows()}
      ${this.error?r`<div class="row"><span class="field-error" role="alert" data-overview-settings-error>${this.error}</span></div>`:p}`}};Ne([O({attribute:!1})],ge.prototype,"doc",2);Ne([O({type:Boolean})],ge.prototype,"disabled",2);Ne([c()],ge.prototype,"busy",2);Ne([c()],ge.prototype,"error",2);Ne([c()],ge.prototype,"departments",2);Ne([c()],ge.prototype,"bad",2);ge=Ne([I("ticket-overview-settings")],ge);var fn=Object.defineProperty,gn=Object.getOwnPropertyDescriptor,N=(e,t,s,a)=>{for(var i=a>1?void 0:a?gn(t,s):t,n=e.length-1,o;n>=0;n--)(o=e[n])&&(i=(a?o(t,s,i):o(i))||i);return a&&i&&fn(t,s,i),i};const wn=[{key:"max_files",label:"stVuFiles",max:10,mb:!1},{key:"max_uploads",label:"stVuUploads",max:30,mb:!1},{key:"max_image_mb",label:"stVuImage",max:8,mb:!0},{key:"max_doc_mb",label:"stVuDoc",max:10,mb:!0},{key:"max_total_mb",label:"stVuTotal",max:50,mb:!0}],yn=ht,Xe=["view","create","manage","external","all_departments","configure"],Ye=["external","all_departments","configure"];let D=class extends M{constructor(){super(...arguments),this.bubbleSkin=new de(this),this.tab="general",this.enabled=null,this.switching=!1,this.doc=null,this.names=null,this.draft=null,this.moreLangs=!1,this.departments=null,this.deletedDepts=[],this.installation=null,this.selected="",this.directory=null,this.holders=null,this.holdersBy="person",this.permsFailed=!1,this.grantUser="",this.grantScope="installation:*",this.grantUntil="",this.scopes=null,this.busy=!1,this.error="",this.publicError="",this.ok="",this.newDept={name:"",key:""},this.instDraft={},this.vuDraft={},this.okTimer=0,this.offNames=null,this.live=new Hs(()=>{!this.enabled||this.busy||(this.tab==="departments"?this.loadDepartments().catch(()=>{}):this.tab==="permissions"&&this.holders&&g().holders().then(e=>this.holders=e).catch(()=>{}))}),this.onHash=()=>{if(window.location.hash.startsWith("#/system/tickets")){const e=this.tab;this.readTab(),e!==this.tab&&this.loadTab()}},this.onDeptChanged=e=>{const t=e.detail.dept;this.departments=(this.departments??[]).map(s=>s.id===t.id?t:s),e.detail.saved&&this.say(l("setSaved"))},this.onDeptDeleted=e=>{this.departments=(this.departments??[]).filter(t=>t.id!==e.detail.id),this.selected=this.departments[0]?.id??"",this.loadDepartments().catch(()=>{})},this.onNotice=e=>{e.detail.error?this.fail(e.detail.error):e.detail.ok&&this.say(e.detail.ok)}}connectedCallback(){super.connectedCallback(),ga(this),this.readTab(),window.addEventListener("hashchange",this.onHash),this.offNames=ws(()=>this.requestUpdate()),this.live.start(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),window.clearTimeout(this.okTimer),this.live.stop(),this.offNames?.()}readTab(){const e=new URLSearchParams(window.location.hash.split("?")[1]??"").get("tab");if(e==="contacts"){queueMicrotask(()=>window.location.replace(`${mt}?seg=vendors`));return}this.tab=mn(e)?e:"general"}setTab(e){this.tab=yn.includes(e)?e:"general",ys("/system/tickets",this.tab==="general"?void 0:new URLSearchParams({tab:this.tab})),this.loadTab()}say(e){this.ok=e,this.error="",window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",3e3)}fail(e){this.ok="",this.error=typeof e=="string"?e:_(e)}async load(){this.error="";try{if(B()){const e=await _s(!0);this.enabled=String(e["tickets.enabled"]??"false")==="true"}else this.enabled=!0}catch(e){this.enabled=!1,this.fail(e)}this.enabled&&await this.loadTab()}async loadDepartments(){const e=await g().departments();this.departments=e.departments,this.deletedDepts=e.deleted??[],this.installation=e.installation??null,e.departments.some(t=>t.id===this.selected)||(this.selected=e.departments[0]?.id??"")}async loadTab(){if(this.enabled)try{if(this.tab==="general"){const e=await g().module();this.names={...e.name,revision:e.name_revision},this.draft||(this.draft=structuredClone(e.name)),(!B()||_e("system.configure"))&&(this.doc=await g().settings())}else this.tab==="departments"?(await this.loadDepartments(),this.directory||(this.directory=await g().directory())):this.tab==="display"?(!B()||_e("system.configure"))&&(this.doc=await g().settings()):this.tab==="channel"||this.tab==="messages"||this.tab==="costs"||this.tab==="locations"||this.tab==="rules"||(this.permsFailed=!1,this.error="",this.holders=await g().holders(),this.directory||(this.directory=await g().directory()),this.scopes||this.loadScopes())}catch(e){this.tab==="permissions"&&(this.permsFailed=!0,console.error("tickets permissions tab: load failed",e instanceof x?`api ${e.status}`:e instanceof Error?e.name:typeof e)),e instanceof x&&e.status===403?this.error=l("setNoPermission"):this.fail(e)}}async loadScopes(){const e=[{type:"installation",id:"*",label:l("permScopeAll")}];try{const t=await ks();for(const s of t.sites){e.push({type:"site",id:s.id,label:s.name});for(const a of s.buildings??[]){e.push({type:"building",id:a.id,label:`${s.name} ‹ ${a.name}`});for(const i of a.floors??[])e.push({type:"floor",id:i.id,label:`${s.name} ‹ ${a.name} ‹ ${i.name}`})}}}catch{}this.scopes=e}async setEnabled(e){this.switching=!0,this.error="";try{B()&&(await xs("settings",{"tickets.enabled":String(e)}),Ss()),this.enabled=e,Ds({"tickets.enabled":String(e)}),this.say(l("setSaved")),e&&await this.loadTab()}catch(t){this.fail(t)}finally{this.switching=!1}}nameError(e,t){const s=this.draft?.[e][t]??"";if(t==="module"&&!s.trim())return"";const a=Cs(s);return a?l(`nameErr_${a}`):""}setName(e,t){this.draft&&(this.draft={...this.draft,[e]:{...this.draft[e],...t}})}async saveName(){const e=this.draft;if(!(!e||this.busy)){for(const t of Qe)if(this.nameError(t,"one")||this.nameError(t,"many")||this.nameError(t,"module"))return;this.busy=!0,this.error="";try{const t=await g().saveName(this.names?.revision??0,e);this.names=t;const{revision:s,...a}=t;this.draft=structuredClone(a),Ns(a),this.say(l("setSaved"))}catch(t){if(this.fail(t),t instanceof x&&t.status===409){const s=await g().module().catch(()=>null);s&&(this.names={...s.name,revision:s.name_revision})}}finally{this.busy=!1}}}async saveDoc(e,t){if(!this.doc||this.busy)return;this.busy=!0,this.error="";const s=e.public!==void 0;s&&(this.publicError="");try{this.doc=await g().saveInstallation(this.doc.revision,e),t?.(),this.say(l("setSaved"))}catch(a){this.fail(a),s&&(this.publicError=this.error),a instanceof x&&a.status===409&&(this.doc=await g().settings().catch(()=>this.doc))}finally{this.busy=!1}}longPressRow(){const e=this.doc?.device_long_press??"sheet";return r`<div class="row" data-long-press><span class="lbl">${Ke("setLongPress")}<span class="muted">${Ke("setLongPressSub")}</span></span>
      <sw-segmented radio label=${Ke("setLongPress")} value=${e} ?disabled=${this.busy} @change=${t=>void this.saveLongPress(t.detail.value)}
        .options=${["sheet","menu"].map(t=>({value:t,label:Ke(`lp_${t}`),attrs:{"data-long-press-mode":t}}))}></sw-segmented></div>`}async saveLongPress(e){!this.doc||this.doc.device_long_press===e||await this.saveDoc({device_long_press:e},()=>Ts(this.doc?.device_long_press??e))}nameRow(e){const t=this.draft?.[e]??Ae[e],s=!B()||_e("tickets.configure"),a=this.nameError(e,"one"),i=this.nameError(e,"many"),n=this.nameError(e,"module"),o=Es[e].filter(Boolean);return r`<div class="names" data-name-lang=${e} dir=${e==="en"||e==="ru"?"ltr":"rtl"}>
      <label>${l("setNameModule")}<input class="in" maxlength="30" data-name-module=${e} aria-invalid=${String(!!n)} ?disabled=${!s} .value=${t.module??""} @input=${d=>this.setName(e,{module:d.target.value})} />${n?r`<span class="field-error">${n}</span>`:p}</label>
      <label>${l("setNameOne")}<input class="in" maxlength="30" data-name-one=${e} aria-invalid=${String(!!a)} ?disabled=${!s} .value=${t.one} @input=${d=>this.setName(e,{one:d.target.value})} />${a?r`<span class="field-error">${a}</span>`:p}</label>
      <label>${l("setNameMany")}<input class="in" maxlength="30" data-name-many=${e} aria-invalid=${String(!!i)} ?disabled=${!s} .value=${t.many} @input=${d=>this.setName(e,{many:d.target.value})} />${i?r`<span class="field-error">${i}</span>`:p}</label>
      ${o.length?r`<label>${l("setNameGender")}<sw-segmented radio label=${l("setNameGender")} value=${t.gender??""} ?disabled=${!s}
        @change=${d=>this.setName(e,{gender:d.detail.value})}
        .options=${o.map(d=>({value:d,label:l(`setGender_${d}`),attrs:{"data-name-gender":`${e}:${d}`}}))}></sw-segmented></label>`:r`<span></span>`}
    </div>`}linksCard(e){const t=e.links??{sliding_days:14,cap_days:90,grace_hours:24},s=this.instDraft,a={sliding:s.sliding??String(t.sliding_days),cap:s.cap??String(t.cap_days),grace:s.grace??String(t.grace_hours)},i=H(a.sliding,1,90),n=H(a.cap,7,365),o=H(a.grace,0,168),d=Number.isNaN(i)||Number.isNaN(n)||Number.isNaN(o)?"range":n<i?"below_sliding":null,u=i!==t.sliding_days||n!==t.cap_days||o!==t.grace_hours,h=($,R,P,T,ee,pe,m)=>r`
      <div class="row"><span class="lbl">${l(R)}<span class="muted">${l(P)}</span></span>
        <span class="unit"><input class="in num" type="number" min=${ee} max=${pe} data-inst-link=${$} aria-label=${l(R)} aria-invalid=${String(m)} .value=${a[$]}
          @input=${te=>this.instDraft={...this.instDraft,[$]:te.target.value}} /><span class="muted">${l(T)}</span></span></div>`;return r`<sw-card heading=${l("setLinksCard")} data-card="links">
      ${h("sliding","setLinksSliding","setLinksSlidingSub","unit_d",1,90,Number.isNaN(i)||d==="below_sliding")}
      ${h("cap","setLinksCap","setLinksCapSub","unit_d",7,365,Number.isNaN(n)||d==="below_sliding")}
      ${h("grace","setLinksGrace","setLinksGraceSub","unit_h",0,168,Number.isNaN(o))}
      <div class="foot"><sw-button variant="primary" size="sm" data-inst-links-save ?hidden=${!u} ?disabled=${!u||!!d||this.busy}
        @click=${()=>void this.saveDoc({links:{sliding_days:i,cap_days:n,grace_hours:o}},()=>this.instDraft={...this.instDraft,sliding:void 0,cap:void 0,grace:void 0})}>${l("save")}</sw-button>
        ${d?r`<span class="field-error">${l(`err_${d}`)}</span>`:p}</div>
    </sw-card>`}hoursCard(e){const t=e.send_hours??{from:"07:00",to:"21:00"},s=this.instDraft.from??t.from,a=this.instDraft.to??t.to,i=Vt(s,a),n=s!==t.from||a!==t.to;return r`<sw-card heading=${l("setHoursCard")} data-card="hours">
      <div class="row"><span class="lbl">${l("setHoursRow")}<span class="muted">${l("setHoursRowSub")}</span></span>
        <span class="end"><input class="in time" type="time" lang=${ve()} data-inst-hours="from" aria-label=${l("setHoursRow")} aria-invalid=${String(!!i)} .value=${s} @input=${o=>this.instDraft={...this.instDraft,from:o.target.value}} />
          <span class="muted">${l("hoursTo")}</span>
          <input class="in time" type="time" lang=${ve()} data-inst-hours="to" aria-label=${`${l("setHoursRow")} · ${l("hoursTo")}`} aria-invalid=${String(!!i)} .value=${a} @input=${o=>this.instDraft={...this.instDraft,to:o.target.value}} /></span></div>
      <div class="row"><span class="lbl">${l("setUrgent")}<span class="muted">${l("setUrgentSub")}</span></span>
        <sw-toggle label=${l("setUrgent")} labelHidden .checked=${e.urgent_is_critical??!0} ?disabled=${this.busy} data-inst-urgent
          @change=${o=>void this.saveDoc({urgent_is_critical:o.detail.checked})}></sw-toggle></div>
      <!-- TKSET-POLISH-2331: the hours' save sits in the card's footer like the link card's (it saves the two time fields only; the switch saves at once) -->
      <div class="foot"><sw-button size="sm" variant="primary" data-inst-hours-save ?hidden=${!n} ?disabled=${!n||!!i||this.busy}
          @click=${()=>void this.saveDoc({send_hours:{from:s,to:a}},()=>this.instDraft={...this.instDraft,from:void 0,to:void 0})}>${l("save")}</sw-button>
        ${i?r`<span class="field-error">${l(`err_${i}`)}</span>`:p}</div>
    </sw-card>`}rfqTermsCard(e){const t=e.rfq?.schedule_arrival===!0,s=e.rfq?.arrival_reminder_hours??24,a=this.instDraft.arrHours??String(s),i=H(a,0,168),n=e.rfq?.question_reminder_hours??24,o=this.instDraft.qHours??String(n),d=H(o,0,168),u=e.rfq?.question_badge_all_viewers===!0;return r`<sw-card heading=${z("stRfqCard")} data-card="rfq-terms">
      <div class="row"><span class="lbl">${z("stScheduleArrival")}<span class="muted">${z("stScheduleArrivalSub")}</span></span>
        <sw-toggle label=${z("stScheduleArrival")} labelHidden .checked=${t} ?disabled=${this.busy} data-inst-schedule-arrival
          @change=${h=>void this.saveDoc({rfq:{schedule_arrival:h.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${z("stArrivalHours")}<span class="muted">${z("stArrivalHoursSub")}</span></span>
        <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-arrival-hours aria-label=${z("stArrivalHours")} aria-invalid=${String(Number.isNaN(i))} .value=${a}
          @input=${h=>this.instDraft={...this.instDraft,arrHours:h.target.value}} /><span class="muted">${l("unit_h")}</span>
          <sw-button size="sm" variant="primary" data-inst-arrival-save ?hidden=${i===s} ?disabled=${Number.isNaN(i)||i===s||this.busy}
            @click=${()=>void this.saveDoc({rfq:{arrival_reminder_hours:i}},()=>this.instDraft={...this.instDraft,arrHours:void 0})}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${U("qReminder")}<span class="muted">${U("qReminderSub")}</span></span>
        <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-question-hours aria-label=${U("qReminder")} aria-invalid=${String(Number.isNaN(d))} .value=${o}
          @input=${h=>this.instDraft={...this.instDraft,qHours:h.target.value}} /><span class="muted">${l("unit_h")}</span>
          <sw-button size="sm" variant="primary" data-inst-question-save ?hidden=${d===n} ?disabled=${Number.isNaN(d)||d===n||this.busy}
            @click=${()=>void this.saveDoc({rfq:{question_reminder_hours:d}},()=>this.instDraft={...this.instDraft,qHours:void 0})}>${l("save")}</sw-button></span></div>
      <div class="row"><span class="lbl">${U("qBadgeAll")}<span class="muted">${U("qBadgeAllSub")}</span></span>
        <sw-toggle label=${U("qBadgeAll")} labelHidden .checked=${u} ?disabled=${this.busy} data-inst-question-badge-all
          @change=${h=>void this.saveDoc({rfq:{question_badge_all_viewers:h.detail.checked}})}></sw-toggle></div>
      ${this.instalmentHoursRow(e)}
      ${this.awardNoticeRow(e)}
      ${this.lateHoursRow(e)}
    </sw-card>`}lateHoursRow(e){const t=e.rfq?.postpone_late_hours??24,s=this.instDraft.lateHours??String(t),a=H(s,0,720);return r`<div class="row"><span class="lbl">${U("ppLateHours")}<span class="muted">${U("ppLateHoursSub")}</span></span>
      <span class="unit"><input class="in num" type="number" min="0" max="720" data-inst-postpone-late aria-label=${U("ppLateHours")}
        aria-invalid=${String(Number.isNaN(a))} .value=${s}
        @input=${i=>this.instDraft={...this.instDraft,lateHours:i.target.value}} /><span class="muted">${l("unit_h")}</span>
        <sw-button size="sm" variant="primary" data-inst-postpone-late-save ?hidden=${a===t} ?disabled=${Number.isNaN(a)||a===t||this.busy}
          @click=${()=>void this.saveDoc({rfq:{postpone_late_hours:a}},()=>this.instDraft={...this.instDraft,lateHours:void 0})}>${l("save")}</sw-button></span></div>`}awardNoticeRow(e){const t=e.rfq?.award_notice??"confirm";return r`<div class="row"><span class="lbl">${U("anSetting")}<span class="muted">${U("anSettingSub")}</span></span>
      <select class="in" data-inst-award-notice aria-label=${U("anSetting")} ?disabled=${this.busy}
        @change=${s=>void this.saveDoc({rfq:{award_notice:s.target.value}})}>
        ${["confirm","auto","off"].map(s=>r`<option value=${s} ?selected=${t===s}>${U(`anMode_${s}`)}</option>`)}
      </select></div>`}instalmentHoursRow(e){const t=e.rfq?.instalment_reminder_hours??24,s=this.instDraft.insHours??String(t),a=H(s,0,168);return r`<div class="row"><span class="lbl">${z("stInstalmentHours")}<span class="muted">${z("stInstalmentHoursSub")}</span></span>
      <span class="unit"><input class="in num" type="number" min="0" max="168" data-inst-instalment-hours aria-label=${z("stInstalmentHours")}
        aria-invalid=${String(Number.isNaN(a))} .value=${s}
        @input=${i=>this.instDraft={...this.instDraft,insHours:i.target.value}} /><span class="muted">${l("unit_h")}</span>
        <sw-button size="sm" variant="primary" data-inst-instalment-save ?hidden=${a===t} ?disabled=${Number.isNaN(a)||a===t||this.busy}
          @click=${()=>void this.saveDoc({rfq:{instalment_reminder_hours:a}},()=>this.instDraft={...this.instDraft,insHours:void 0})}>${l("save")}</sw-button></span></div>`}generalTab(){const e=!B()||_e("system.configure"),t=!B()||_e("tickets.configure"),s=!B()||_e("tickets.configure")||bt("tickets.manage"),a=this.draft?.he??Ae.he,i=!!this.draft&&!!this.names&&Qe.some($=>JSON.stringify(this.draft?.[$])!==JSON.stringify(this.names?.[$])),n=a.one||Ae.he.one,o=a.many||Ae.he.many,d=["{module}","{ticket} {f:חדשה|m:חדש}","{the_tickets} {f:פתוחות|m:פתוחים}"].map($=>Os($,{one:n,many:o,gender:a.gender,module:a.module?.trim()||Ps("he",n,o)})),u=r`<sw-card heading=${l("setModuleCard")} data-card="module">
        <div class="row"><span class="lbl">${l("setModuleSwitch")}<span class="muted">${l("setModuleSwitchSub")}</span></span>
          <sw-toggle label=${l("setModuleSwitch")} labelHidden .checked=${!!this.enabled} ?disabled=${!e||this.switching} data-tickets-enabled @change=${$=>void this.setEnabled($.detail.checked)}></sw-toggle></div>
        ${this.enabled&&this.draft?r`<div class="row stack" data-name-editor>
          <span class="lbl">${l("setName")}<span class="muted">${l("setNameSub")}</span></span>
          ${this.nameRow("he")}
          <div class="preview" data-name-preview aria-label=${l("setNamePreview")}>${d.map($=>r`<span class="tag acc">${k($)}</span>`)}</div>
          <div class="chipsrow"><button type="button" class="rc" aria-pressed=${String(this.moreLangs)} data-name-more @click=${()=>this.moreLangs=!this.moreLangs}>${l("setNameOtherLangs")}</button></div>
          ${this.moreLangs?Qe.filter($=>$!=="he").map($=>r`<div class="lang">${l(`lang_${$}`)}</div>${this.nameRow($)}`):p}
          ${t?r`<div class="foot"><sw-button variant="primary" size="sm" data-name-save ?hidden=${!i} ?disabled=${!i||this.busy} @click=${()=>void this.saveName()}>${l("save")}</sw-button>
            <sw-button size="sm" variant="ghost" data-name-default ?disabled=${this.busy} @click=${()=>this.draft=structuredClone(Ae)}>${l("setNameDefault")}</sw-button></div>`:p}
        </div>`:p}
        ${this.enabled?p:r`<div class="row"><span class="muted" data-module-off>${l("setModuleOff")}</span></div>`}
      </sw-card>`,h=this.enabled&&s?r`<sw-card heading=${l("setHandlersCard")} data-card="handlers-link">
        <div class="row"><span class="lbl">${l("hdSeg_handlers")} · ${l("hdSeg_vendors")} · ${l("hdSeg_contacts")}</span>
          <a class="btnlink" href=${mt} data-to-handlers>${l("setHandlersOpen")}</a></div>
      </sw-card>`:p;return this.enabled&&this.doc&&e?r`<div class="sgrid" data-settings-cols>
      <div class="col">
        ${u}
        ${h}
        <tickets-public-card .doc=${this.doc} ?busy=${this.busy} ?remote=${zs()} .saveError=${this.publicError} @save-doc=${$=>void this.saveDoc($.detail.patch)}
          @notice=${this.onNotice}></tickets-public-card>
      </div>
      <div class="col">
        ${this.linksCard(this.doc)}
        ${this.hoursCard(this.doc)}
        ${B()&&e?r`<sw-card heading=${f("card")} data-card="notify-matrix">
          <ticket-notify-matrix .doc=${this.doc} ?disabled=${this.busy} @doc-changed=${$=>{this.doc=$.detail,this.say(l("setSaved"))}}></ticket-notify-matrix>
        </sw-card>`:p}
        <tickets-work-calendar-card .doc=${this.doc} ?busy=${this.busy} @save-doc=${$=>void this.saveDoc($.detail.patch)}></tickets-work-calendar-card>
        ${B()&&e?r`<sw-card heading=${ae("card")} data-card="visits-settings">
          <ticket-visits-settings .doc=${this.doc} ?disabled=${this.busy} @doc-changed=${$=>{this.doc=$.detail,this.say(l("setSaved"))}}></ticket-visits-settings>
        </sw-card>`:p}
        ${this.rfqTermsCard(this.doc)}
        ${this.vendorUploadsCard(this.doc)}
      </div>
    </div>`:r`<div class="sgrid one" data-settings-cols><div class="col">${u}${h}</div></div>`}vendorUploadsCard(e){const t=e.rfq?.vendor_uploads,s={max_files:t?.max_files??5,max_uploads:t?.max_uploads??10,max_image_mb:t?.max_image_mb??8,max_doc_mb:t?.max_doc_mb??10,max_total_mb:t?.max_total_mb??20},a=wn.map(d=>{const u=this.vuDraft[d.key]??String(s[d.key]);return{...d,raw:u,n:H(u,1,d.max)}}),i=a.some(d=>Number.isNaN(d.n))||a[1].n<a[0].n,n=a.some(d=>d.n!==s[d.key]),o=Object.fromEntries(a.map(d=>[d.key,d.n]));return r`<sw-card heading=${z("stVendorUploads")} data-card="rfq-vendor-uploads">
      <div class="row"><span class="lbl">${z("stVendorUploadsOn")}<span class="muted">${z("stVendorUploadsOnSub")}</span></span>
        <sw-toggle label=${z("stVendorUploadsOn")} labelHidden .checked=${t?.enabled===!0} ?disabled=${this.busy} data-inst-vendor-uploads
          @change=${d=>void this.saveDoc({rfq:{vendor_uploads:{enabled:d.detail.checked}}})}></sw-toggle></div>
      ${a.map(d=>r`<div class="row"><span class="lbl">${z(d.label)}<span class="muted">${z("stVuMax",{n:d.max})}</span></span>
        <span class="unit"><input class="in num" type="number" min="1" max=${d.max} data-inst-vu=${d.key} aria-label=${z(d.label)} aria-invalid=${String(Number.isNaN(d.n))}
          .value=${d.raw} @input=${u=>this.vuDraft={...this.vuDraft,[d.key]:u.target.value}} />${d.mb?r`<span class="muted">MB</span>`:p}</span></div>`)}
      <div class="foot"><sw-button size="sm" variant="primary" data-inst-vu-save ?hidden=${!n} ?disabled=${i||!n||this.busy}
        @click=${()=>void this.saveDoc({rfq:{vendor_uploads:o}},()=>this.vuDraft={})}>${l("save")}</sw-button>
        ${a[1].n<a[0].n?r`<span class="field-error">${z("stVuUploadsBelow")}</span>`:p}</div>
    </sw-card>`}displayTab(){if(!this.doc)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.doc;return r`<div class="sgrid" data-settings-cols data-display-tab>
      <div class="col">
        <sw-card heading=${l("u6CardOpen")} data-card="display">
          <div class="row"><span class="lbl">${l("setDetail")}<span class="muted">${l("setDetailSub")}</span></span>
            <sw-segmented radio label=${l("setDetail")} value=${e.ui.detail} ?disabled=${this.busy} @change=${t=>void this.saveDoc({ui:{detail:t.detail.value}})}
              .options=${["drawer","fullscreen","drawer_fullscreen"].map(t=>({value:t,label:l(`d_${t}`),attrs:{"data-ui-detail":t}}))}></sw-segmented></div>
          <div class="row"><span class="lbl">${l("setNewTicket")}<span class="muted">${l("setNewTicketSub")}</span></span>
            <sw-segmented radio label=${l("setNewTicket")} value=${e.ui.new_ticket} ?disabled=${this.busy} @change=${t=>void this.saveDoc({ui:{new_ticket:t.detail.value}})}
              .options=${["sheet","dialog"].map(t=>({value:t,label:l(`n_${t}`),attrs:{"data-ui-new":t}}))}></sw-segmented></div>
          ${this.requestDrawerRows(e)}
        </sw-card>
      </div>
      <div class="col">
        <sw-card heading=${l("u6CardBoard")} data-card="display-board">
          <ticket-board-settings .doc=${e} ?disabled=${this.busy} @doc-changed=${t=>{this.doc=t.detail,this.say(l("setSaved"))}}></ticket-board-settings>
        </sw-card>
        <sw-card heading=${l("u6CardDevice")} data-card="display-device">${this.longPressRow()}</sw-card>
        <sw-card heading=${E("setCard")} data-card="display-overview">
          <ticket-overview-settings .doc=${e} ?disabled=${this.busy} @doc-changed=${t=>{this.doc=t.detail,this.say(l("setSaved"))}}></ticket-overview-settings>
        </sw-card>
      </div>
    </div>`}requestDrawerRows(e){if(e.ui.detail_tab===void 0)return p;const t=s=>void this.saveDoc({ui:s});return r`${Da(e.ui,this.busy,t)}${Na(e.ui,this.busy,t)}`}async addDepartment(){const e=this.newDept.name.trim();if(!(!e||this.busy)){this.busy=!0;try{const t=await g().createDepartment({name:e});this.departments=[...this.departments??[],t],this.selected=t.id,this.newDept={name:"",key:""},this.say(l("setSaved")),this.loadDepartments().catch(()=>{})}catch(t){this.fail(t)}finally{this.busy=!1}}}async restoreDepartment(e){if(!this.busy){this.busy=!0;try{const t=await g().restoreDepartment(e);await this.loadDepartments(),this.selected=t.id,this.say(l("depRestored"))}catch(t){this.fail(t)}finally{this.busy=!1}}}deletedCard(){return this.deletedDepts.length?r`<sw-card data-card="dept-deleted"><details data-dept-deleted>
      <summary>${l("depDeletedList")} · ${this.deletedDepts.length}</summary>
      <div class="people">${xe(this.deletedDepts,e=>e.id,e=>r`<div class="person" data-dept-deleted-item=${e.id}>
        <span class="who">${k(e.name)} <span class="muted">${vt(new Date(e.deleted_at))}</span></span>
        <sw-button size="sm" data-dept-restore=${e.id} ?disabled=${this.busy} @click=${()=>void this.restoreDepartment(e.id)}>${l("depRestore")}</sw-button>
      </div>`)}</div>
    </details></sw-card>`:p}departmentsTab(){if(!this.departments)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.departments.find(t=>t.id===this.selected)??null;return r`<div class="split" data-dept-split>
      <div class="stack">
        <sw-card heading=${l("depListTitle")} data-card="dept-list">
          ${this.departments.length?r`<div class="dlist" role="list">${xe(this.departments,t=>t.id,t=>r`<button type="button" role="listitem" class=${`ditem ${t.active?"":"off"}`}
            aria-current=${String(t.id===this.selected)} data-dept-item=${t.id} @click=${()=>this.selected=t.id}>
            <span class="txt"><span class="nm">${k(t.name)}</span>
              <span class="sub">${l("depSummary",{c:t.categories.filter(s=>s.active).length,p:t.priorities.filter(s=>s.active).length,m:t.members.length})}</span></span>
            ${t.active?p:r`<span class="tag">${l("depInactive")}</span>`}</button>`)}</div>`:r`<sw-state-panel icon="ticket" state="empty" heading=${l("depNone")}></sw-state-panel>`}
          <div class="foot">
            <input class="in" maxlength="40" data-dept-new-name placeholder=${l("depName")} aria-label=${l("depAdd")} .value=${this.newDept.name} @input=${t=>this.newDept={...this.newDept,name:t.target.value}}
              @keydown=${t=>{t.key==="Enter"&&this.addDepartment()}} />
            <sw-button size="sm" variant="primary" icon="plus" data-dept-add ?disabled=${this.busy||!this.newDept.name.trim()} @click=${()=>void this.addDepartment()}>${l("depNewShort")}</sw-button>
          </div>
        </sw-card>
        ${this.deletedCard()}
      </div>
      ${e?r`<tickets-dept-editor .dept=${e} .directory=${this.directory} .installation=${this.installation}
        @dept-changed=${this.onDeptChanged} @dept-deleted=${this.onDeptDeleted} @notice=${this.onNotice} @dept-reload=${()=>void this.loadDepartments().catch(()=>{})}></tickets-dept-editor>`:p}
    </div>`}grantOf(e,t){return this.holders?.users.find(s=>s.id===e)?.grants.find(s=>s.via==="grant"&&s.role_id===`tickets_${t}`)}async toggleGrant(e,t){const s=this.grantUser;if(!(!s||this.busy)){this.busy=!0;try{const a=`tickets_${e}`;if(t){const[i,...n]=this.grantScope.split(":"),o=this.grantUntil?Ls(new Date(`${this.grantUntil}T23:59:59`)):null;await ba({subject_kind:"user",subject_id:s,role_id:a,scope_type:i,scope_id:n.join(":"),...o?{expires_at:o}:{}})}else{const i=this.grantOf(s,e);i&&await va(i.binding_id)}this.holders=await g().holders(),this.say(l("setSaved"))}catch(a){this.fail(a)}finally{this.busy=!1}}}viaText(e){const t=e.via==="grant"?l("via_grant"):e.via==="group"?l("via_group",{group:e.group_name??""}):l("via_role",{role:e.role_name}),s=e.scope_type!=="installation"?` · ${l("permScope",{scope:e.scope_name||e.scope_id||"–"})}`:"",a=e.expires_at?` · ${l("permUntil",{date:vt(new Date(e.expires_at))})}`:"";return t+s+a}matrixCard(){const e=this.holders?.roles??[];return e.length?r`<sw-card heading=${l("permHolders")} data-card="matrix">
      <div class="gridwrap" data-perm-matrix>
        <table class="matrix">
          <thead><tr><th>${l("permMatrixRole")}</th>${Xe.map(t=>r`<th>${l(`p_${t}`)}${Ye.includes(t)?r`<br /><span class="tag warn">${l("sensitive")}</span>`:p}</th>`)}</tr></thead>
          <tbody>${e.map(t=>r`<tr data-role=${t.id}><td>${k(t.name??t.id)}${t.builtin?p:r` <span class="tag">${l("permCustom")}</span>`}</td>
            ${Xe.map(s=>t.permissions.includes(`tickets.${s}`)?r`<td class="yes" aria-label=${l("yes")}><sw-icon name="check" size="18"></sw-icon></td>`:r`<td class="no" aria-label=${l("no")}><sw-icon name="minus" size="16"></sw-icon></td>`)}</tr>`)}</tbody>
        </table>
      </div>
      <div class="pcards">${e.map(t=>r`<div class="pcard" data-role-card=${t.id}><h4>${k(t.name??t.id)}</h4>
        <div class="chipsrow">${(t.permissions??[]).length?(t.permissions??[]).map(s=>r`<span class="tag">${Ut(s)}</span>`):r`<span class="muted">–</span>`}</div></div>`)}</div>
      <div class="foot"><a href="#/system/access" data-to-roles>${l("permToRoles")}</a></div>
    </sw-card>`:r``}holdersCard(){const e=this.holders,t=Ut,s=r`${e.users.length?r`<div class="people">${xe(e.users,i=>i.id,i=>r`<div class="person" data-holder=${i.id}>
        <span class="who">${k(i.name??i.id)}${i.active?p:r` <span class="tag warn">${l("permInactive")}</span>`}</span>
        ${i.grants.map(n=>r`<span class="chipsrow">${n.permissions.map(o=>r`<span class=${`tag ${Ye.includes(o.replace(/^tickets\./,""))?"warn":""}`}>${t(o)}</span>`)}${n.effect==="deny"?r`<span class="tag warn">${l("permDeny")}</span>`:p}<span class="via">${this.viaText(n)}</span></span>`)}
      </div>`)}</div>`:r`<span class="muted">${l("permNone")}</span>`}`,a=r`<div class="people">${Xe.map(i=>{const n=e.users.filter(o=>o.grants.some(d=>d.effect==="allow"&&d.permissions.includes(`tickets.${i}`)));return r`<div class="person" data-holder-perm=${i}><span class="who">${l(`p_${i}`)}${Ye.includes(i)?r` <span class="tag warn">${l("sensitive")}</span>`:p}</span>
        <span class="chipsrow">${n.length?n.map(o=>r`<span class="tag">${k(o.name??o.id)}</span>`):r`<span class="muted">${l("permNobody")}</span>`}</span></div>`})}</div>`;return r`<sw-card heading=${l("permPeople")} data-card="holders">
      <sw-segmented radio size="sm" slot="actions" label=${l("permPeople")} value=${this.holdersBy} @change=${i=>this.holdersBy=i.detail.value}
        .options=${["person","perm"].map(i=>({value:i,label:i==="person"?l("permByPerson"):l("permByPerm"),attrs:{"data-holders-by":i}}))}></sw-segmented>
      ${this.holdersBy==="person"?s:a}
      <div class="foot"><a href="#/system/access" data-to-users>${l("permToUsers")}</a></div>
    </sw-card>`}grantCard(){const e=!B()||bt("rbac.assign"),t=new Date().toISOString().slice(0,10);return r`<sw-card heading=${l("permGrantCard")} data-card="grant">
      ${e?r`
        <div class="row"><span class="lbl">${l("permGrantUser")}</span>
          <select class="in" data-grant-user aria-label=${l("permGrantPick")} @change=${s=>this.grantUser=s.target.value}>
            <option value="" ?selected=${!this.grantUser}>${l("permGrantPick")}</option>
            ${(this.directory?.users??[]).map(s=>r`<option value=${s.id} ?selected=${s.id===this.grantUser}>${s.name}</option>`)}
          </select></div>
        ${this.grantUser?r`
          <div class="row"><span class="lbl">${l("permGrantScope")}</span>
            <select class="in" data-grant-scope aria-label=${l("permGrantScope")} @change=${s=>this.grantScope=s.target.value}>
              ${(this.scopes??[{type:"installation",id:"*",label:l("permScopeAll")}]).map(s=>r`<option value=${`${s.type}:${s.id}`} ?selected=${this.grantScope===`${s.type}:${s.id}`}>${s.label}</option>`)}
            </select></div>
          <div class="row"><span class="lbl">${l("permGrantUntil")}</span>
            <input class="in" type="date" lang=${ve()} min=${t} data-grant-until aria-label=${l("permGrantUntil")} .value=${this.grantUntil} @input=${s=>this.grantUntil=s.target.value} /></div>
          <div class="chipsrow" data-grant-perms>${Xe.map(s=>{const a=this.grantOf(this.grantUser,s);return r`<button type="button" class="rc" aria-pressed=${String(!!a)} data-grant=${s} ?disabled=${this.busy} title=${a?this.viaText(a):""} @click=${()=>void this.toggleGrant(s,!a)}><sw-icon name=${a?"check":"plus"} size="16"></sw-icon>${l(`p_${s}`)}${Ye.includes(s)?` · ${l("sensitive")}`:""}</button>`})}</div>`:p}`:r`<div class="row"><span class="muted">${l("permGrantNoAssign")}</span><a href="#/system/access">${l("permToUsers")}</a></div>`}
    </sw-card>`}permissionsTab(){if(this.permsFailed)return this.permsError();if(!this.holders)return r`<sw-state-panel state="loading"></sw-state-panel>`;try{return r`<div class="sgrid" data-settings-cols><div class="col">${this.matrixCard()}</div><div class="col">${this.holdersCard()}${this.grantCard()}</div></div>`}catch(e){return console.error("tickets permissions tab: render failed",e instanceof Error?e.name:typeof e),this.permsError()}}permsError(){return r`<sw-state-panel state="error" heading=${l("permLoadFailed")} data-perms-error>
      <sw-button size="sm" data-perms-retry @click=${()=>{this.permsFailed=!1,this.holders=null,this.loadTab()}}>${l("permRetry")}</sw-button>
    </sw-state-panel>`}render(){const e=l("area");if(this.enabled===null)return r`<sw-page wide class="page" data-tickets-settings heading=${e} crumbs=${$t("הגדרות")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t={general:l("setTabGeneral"),departments:l("setTabDepartments"),locations:w("tab"),display:l("u6TabDisplay"),channel:v("tabChannel"),messages:v("tabTemplates"),costs:S("setTab"),rules:b("tab"),permissions:l("setTabPermissions")},s=bn({api:B(),can:_e}).map(n=>({id:n,label:t[n]})),a=this.enabled?r`<sw-tabs class="stabs" variant="underline" group-label=${e} data-tickets-settings-tabs .items=${s} .active=${this.tab}
      @change=${n=>this.setTab(n.detail.id)}></sw-tabs>`:p,i=!this.enabled||this.tab==="general"?this.generalTab():this.tab==="departments"?this.departmentsTab():this.tab==="display"?this.displayTab():this.tab==="channel"?r`<tickets-channel-settings @notice=${this.onNotice}></tickets-channel-settings>`:this.tab==="messages"?r`<tickets-message-templates @notice=${this.onNotice}></tickets-message-templates>`:this.tab==="costs"?r`<tickets-costs-settings @notice=${this.onNotice}></tickets-costs-settings>`:this.tab==="locations"?r`<tickets-locations-settings @notice=${this.onNotice}></tickets-locations-settings>`:this.tab==="rules"?r`<tickets-rules-settings @notice=${this.onNotice}></tickets-rules-settings>`:this.permissionsTab();return r`<sw-page wide class="page" data-tickets-settings data-tab=${this.tab} heading=${e} crumbs=${$t("הגדרות")} subheading=${l("setSub")}>
      ${a}
      <div class="tbody">${i}</div>
      ${this.error?r`<div class="toast bad" role="alert" data-tickets-settings-error><sw-icon name="warning" size="18"></sw-icon><span class="tx">${this.error}</span>
        <button type="button" class="x" aria-label=${Rs("actions.close")} data-tickets-settings-error-close @click=${()=>this.error=""}><sw-icon name="close" size="16"></sw-icon></button></div>`:this.ok?r`<div class="toast" role="status" data-tickets-settings-ok><sw-icon name="check" size="18"></sw-icon><span class="tx">${this.ok}</span></div>`:p}
    </sw-page>`}};D.styles=[le,...$a,fa,Y,Z,X`
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
      /* AUDIT30-C-TICKETS (#3, #4, Q3 option 1): the chosen key of every segment on this page (the name's gender, the long press) is
         the Blue Wash pair - in dark the old light thumb under --dv-text read white on white (1:1) */
      --sw-seg-on-bg: var(--sw-accent-soft);
      /* SYS-AUDIT-QUICKFIX-2437 (audit round 30, finding 3): the label on the thumb is the thumb's own ink (--mm-seg-fg-on, POLISH2-295),
         as on every other glass segment - --dv-text is near-white in dark and the chosen tab / gender read white on white (1:1). In
         light both are --dv-text (no change). */
      --sw-seg-on-fg: var(--sw-accent-text);
      --sw-seg-on-shadow: none;
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
    /* AUDIT30-C-TICKETS (#18): the tabs are the underline row of sw-tabs (the centred sticky glass pill is gone: its chosen tab read
       white on white in dark, finding 3) */
    .stabs {
      display: block;
      min-inline-size: 0;
    }
    /* AUDIT30-C-TICKETS (#16, Q11 option 1): a card's save key shows only when the card has a change; its footer (the hairline and the
       room) goes with it */
    .foot:not(:has(> :not([hidden]))) {
      display: none;
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
    sw-card sw-segmented[slot='actions'] {
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
    @media (max-width: 767px) {
      .page {
        padding: 0 14px 26px;
      }
      /* TKGATEFIX4: the display tab's choices on a phone - the row stacks, so the segmented control takes the line and its options
         share it; an option's text may wrap (the glass sheet's .seg button is nowrap, and "מגירה + מסך מלא" pushed the third option
         13-20 px out of its track at 320 px) */
      [data-display-tab] .row sw-segmented {
        display: flex;
        inline-size: 100%;
      }
      [data-display-tab] .row sw-segmented::part(key) {
        flex: 1 1 0;
        min-inline-size: 0;
        padding-inline: 8px;
        white-space: normal;
        text-align: center;
        line-height: 1.25;
      }
    }
  `,Sa];N([c()],D.prototype,"tab",2);N([c()],D.prototype,"enabled",2);N([c()],D.prototype,"switching",2);N([c()],D.prototype,"doc",2);N([c()],D.prototype,"names",2);N([c()],D.prototype,"draft",2);N([c()],D.prototype,"moreLangs",2);N([c()],D.prototype,"departments",2);N([c()],D.prototype,"deletedDepts",2);N([c()],D.prototype,"installation",2);N([c()],D.prototype,"selected",2);N([c()],D.prototype,"directory",2);N([c()],D.prototype,"holders",2);N([c()],D.prototype,"holdersBy",2);N([c()],D.prototype,"permsFailed",2);N([c()],D.prototype,"grantUser",2);N([c()],D.prototype,"grantScope",2);N([c()],D.prototype,"grantUntil",2);N([c()],D.prototype,"scopes",2);N([c()],D.prototype,"busy",2);N([c()],D.prototype,"error",2);N([c()],D.prototype,"publicError",2);N([c()],D.prototype,"ok",2);N([c()],D.prototype,"newDept",2);N([c()],D.prototype,"instDraft",2);N([c()],D.prototype,"vuDraft",2);D=N([I("system-tickets")],D);export{D as SystemTickets};
