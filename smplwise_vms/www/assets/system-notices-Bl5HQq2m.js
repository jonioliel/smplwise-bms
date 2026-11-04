import{F as g,a as y,e as l,rv as e,A as c,H as k,rw as Lt,E as C,G as h,rx as Pt,R as m,ry as Nt,rz as zt,rA as Et,rB as Tt,rC as Ct,rD as It,rE as Rt,rF as Bt,rG as At,rH as Ht,rI as Ut,rJ as Ft,rK as b,rL as jt,rM as Wt,j as wt,rN as Mt,rO as Gt,rP as Vt,rQ as Z,rR as dt,rS as qt,rT as Yt,rU as Xt,rV as Kt,rW as Jt,rX as Zt,cL as Qt,rY as ts,rZ as ss,r_ as es,r$ as as,s0 as Q,s1 as is,s2 as ct,s3 as tt,s4 as os,s5 as ns,s6 as ls,s7 as rs,s8 as ds,s9 as cs,sa as ps,bO as pt,sb as ht,sc as hs,sd as us,se as bs,sf as vs,sg as gs,cM as fs,ru as ms}from"./index-D2ApsviK.js";import{_ as $s,W as ws,Z as ys,V as ks,a9 as xs,aa as yt,U as _s,ab as Ss,ac as Ds,ad as Os,ae as Ls,af as Ps,ag as Ns,ah as st,ai as zs,a2 as Es,aj as Ts,ak as Cs,al as Is,am as Rs,an as Bs,ao as As,p as Hs,ap as Us,aq as Fs}from"./transit-logic-DnpTAyzC.js";import"./compose-dialog-BW-2zKj-.js";import{n as x}from"./styles-3sf1yPmv.js";import{l as A}from"./live-DxGooPDr.js";import{t as js,s as Ws,w as Ms,R as F,a as j,b as Gs,W as Vs,c as qs,d as P,e as W,D as M}from"./model-9ena4hpv.js";import"./sw-logo-art-Va6y_cIM.js";var Ys=Object.defineProperty,Xs=Object.getOwnPropertyDescriptor,kt=(t,s,a,o)=>{for(var n=o>1?void 0:o?Xs(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ys(s,a,n),n};let G=class extends y{emit(t){this.dispatchEvent(new CustomEvent("display-change",{detail:t,bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=$s(this.display),s=ws(this.display),a=ys.map(i=>[i,e(`saver_${i}`)]),o=[["a",e("logos_a")],["b",e("logos_b")],["c",e("logos_c")]],n=ks(this.display)!=="c";return l`<div class="r">
      <div class="fld"><span class="lbl">${e("saverLabel")}</span><div class="seg" data-saver-seg>${a.map(([i,r])=>l`<button data-saver=${i} aria-pressed=${String(t===i)} @click=${()=>this.emit({saver:i})}>${r}</button>`)}</div></div>
      <div class="fld"><span class="lbl">${e("logosLabel")}</span><div class="seg" data-logos-seg>${o.map(([i,r])=>l`<button data-logos=${i} aria-pressed=${String(s===i)} ?disabled=${n} @click=${()=>this.emit({logos:i})}>${r}</button>`)}</div>
        ${n?l`<span class="hint">${e("logosOnlyHeaderC")}</span>`:c}</div>
    </div>`}};G.styles=[x];kt([g({attribute:!1})],G.prototype,"display",2);G=kt([k("notice-display-saver")],G);var Ks=Object.defineProperty,Js=Object.getOwnPropertyDescriptor,q=(t,s,a,o)=>{for(var n=o>1?void 0:o?Js(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ks(s,a,n),n};const Zs=[{key:"header",seg:"header",label:"headerLabel",values:_s,text:t=>e(`header_${t}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:Ss,text:t=>e(`updated_${t}`)},{key:"space",seg:"space",label:"spaceLabel",values:Ds,text:t=>e(`space_${t}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:Os,text:t=>e(`nightLogo_${t}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:Ls,text:t=>t===0?e("weatherDays_0"):t===1?e("weatherDays_1"):e("weatherDays_n",{n:t})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:Ps,text:t=>e(`idleLogo_${t}`)}];let N=class extends y{constructor(){super(...arguments),this.defaults=xs,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a,o,n){const i=this.mode==="board",r=t.key==="space"&&a==="c"||i&&t.key==="night_logo"&&!o||i&&t.key==="weather_days"&&!n,p=t.text(this.defaults[t.key]),d=t.key==="space"&&r?e("spaceOnlyOneRow"):i&&s===null?e("tvDefaultNow",{v:p}):"";return l`<div class="fld"><span class="lbl">${e(t.label)}</span>
      <div class="seg" data-seg=${t.seg}>
        ${i?l`<button data-v="default" aria-pressed=${String(s===null)} ?disabled=${r} title=${p} @click=${()=>this.emit(t.key,null)}>${e("tvUseDefault")}</button>`:c}
        ${t.values.map(u=>l`<button data-v=${String(u)} aria-pressed=${String(s===u)} ?disabled=${r} @click=${()=>this.emit(t.key,u)}>${t.text(u)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const s=this.display??{},a=D=>t?s[D]??null:this.defaults[D],o=t?yt(s,this.defaults):this.defaults,n=!!s.blocks?.company_logo,i=!!s.blocks?.weather,[r,p,d,u,R,J]=Zs.map(D=>this.row(D,a(D.key),o.header,n,i));return l`<div class="r">${r}${p}</div><div class="r">${d}${u}</div><div class="r">${R}${J}</div>`}};N.styles=[x];q([g({attribute:!1})],N.prototype,"display",2);q([g({attribute:!1})],N.prototype,"defaults",2);q([g()],N.prototype,"mode",2);N=q([k("notice-display-layout")],N);var Qs=Object.defineProperty,te=Object.getOwnPropertyDescriptor,Y=(t,s,a,o)=>{for(var n=o>1?void 0:o?te(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Qs(s,a,n),n};const se=[{key:"design",seg:"design",label:"designLabel",values:zs},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:Es},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:Ts},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:Cs},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:Is},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:Rs},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:Bs},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:As}],ee={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},ut=(t,s)=>e(`${ee[t]}${s}`);let z=class extends y{constructor(){super(...arguments),this.defaults=Ns,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a){const o=this.mode==="board",n=t.key==="live_bg"||t.key==="systems_status"||t.key==="urgent_screen",i=o&&t.key!=="design"&&!n&&!a,r=ut(t.key,this.defaults[t.key]),p=t.key==="board_layout"&&!o?e("boardLayoutDefaultLabel"):e(t.label),d=i?e("v2Only"):o&&s===null?e("tvDefaultNow",{v:r}):"";return l`<div class="fld"><span class="lbl">${p}</span>
      <div class="seg" data-seg=${t.seg}>
        ${o?l`<button data-v="default" aria-pressed=${String(s===null)} ?disabled=${i} title=${r} @click=${()=>this.emit(t.key,null)}>${e("tvUseDefault")}</button>`:c}
        ${t.values.map(u=>l`<button data-v=${u} aria-pressed=${String(s===u)} ?disabled=${i} @click=${()=>this.emit(t.key,u)}>${ut(t.key,u)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const s=this.display??{},a=B=>t?s[B]??null:this.defaults[B],n=(t?st(s,this.defaults):this.defaults).design==="v2",[i,r,p,d,u,R,J,D]=se.map(B=>this.row(B,a(B.key),n));return l`<div class="r" data-tv2>${i}${r}</div><div class="r">${p}${d}</div><div class="r">${u}</div><div class="r" data-lobby>${R}${J}</div><div class="r">${D}</div>`}};z.styles=[x];Y([g({attribute:!1})],z.prototype,"display",2);Y([g({attribute:!1})],z.prototype,"defaults",2);Y([g()],z.prototype,"mode",2);z=Y([k("notice-display-design")],z);const ae=["rows","drop"],ie=[0,1,2,3,4,5],et={portrait_chips:"drop",safe_margin:0},xt=t=>t==="rows"||t==="drop",_t=t=>typeof t=="number"&&Number.isInteger(t)&&t>=0&&t<=5;function oe(t,s){const a=t?.[s];return s==="portrait_chips"?xt(a)?a:null:_t(a)?a:null}function ne(t){return{portrait_chips:xt(t?.portrait_chips)?t.portrait_chips:et.portrait_chips,safe_margin:_t(t?.safe_margin)?t.safe_margin:et.safe_margin}}function le(t,s){return t==="portrait_chips"?[s==="drop"?"portraitChips_drop":"portraitChips_rows"]:s===0?["safeMargin_0"]:["safeMargin_pct",{n:s}]}var re=Object.defineProperty,de=Object.getOwnPropertyDescriptor,X=(t,s,a,o)=>{for(var n=o>1?void 0:o?de(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&re(s,a,n),n};const bt=(t,s)=>{const[a,o]=le(t,s);return e(a,o)};let E=class extends y{constructor(){super(...arguments),this.defaults=et,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a,o,n){const i=this.mode==="board",r=i?oe(this.display,t):this.defaults[t],p=bt(t,this.defaults[t]);return l`<div class="fld" data-tv-fit=${t}><span class="lbl">${o}</span>
      <div class="seg" role="group" aria-label=${o} data-seg=${s}>
        ${i?l`<button type="button" data-v="default" aria-pressed=${String(r===null)} title=${p} @click=${()=>this.emit(t,null)}>${e("tvUseDefault")}</button>`:c}
        ${a.map(d=>l`<button type="button" data-v=${String(d)} aria-pressed=${String(r===d)} @click=${()=>this.emit(t,d)}>${bt(t,d)}</button>`)}</div>
      ${i&&r===null?l`<span class="hint" data-default-note>${e("tvDefaultNow",{v:p})}</span>`:c}
      <span class="hint">${n}</span></div>`}render(){return this.mode==="board"&&!this.display?l``:l`<div class="r" data-tv-fit-rows>
      ${this.row("portrait_chips","portrait-chips",ae,e("portraitChipsLabel"),e("portraitChipsHint"))}
      ${this.row("safe_margin","safe-margin",ie,e("safeMarginLabel"),e("safeMarginHint"))}</div>`}};E.styles=[x];X([g({attribute:!1})],E.prototype,"display",2);X([g({attribute:!1})],E.prototype,"defaults",2);X([g()],E.prototype,"mode",2);E=X([k("notice-display-fit")],E);const St={orderHint:"הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.",moveUp:"הזזה למעלה: {k}",moveDown:"הזזה למטה: {k}",noSource:"אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.",sourcesTitle:"מקורות לסמלי החניה וחדר הכושר",sourcesHint:"הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.",parkingLabel:"חניה",parkingHint:"מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.",gymLabel:"חדר כושר",gymHint:"מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.",pick:"בחירת ישות",add:"הוספה",remove:"הסרה",removeOne:"הסרה: {n}",none:"לא נבחרה ישות",noCandidates:"אין ישויות מתאימות",max:"עד {n} ישויות",gone:"לא נמצאה"},ce={orderHint:"The order of this list is the order of the chips on the board and their priority: when the row has no room, a healthy chip lower in the list is hidden first. A fault stays to the end.",moveUp:"Move up: {k}",moveDown:"Move down: {k}",noSource:"No source, the chip is not shown. Pick a source in the notice-board settings.",sourcesTitle:"Sources of the parking and gym chips",sourcesHint:"The chip shows the state only (a word and a colour), never the entity name. With no entity picked the chip is not shown.",parkingLabel:"Parking",parkingHint:"A number = free spaces (summed over the entities). An occupied / free sensor = one space (on = taken). A list = its option as written.",gymLabel:"Gym",gymHint:"A switch or a schedule: on = open, off = closed. An occupancy sensor: in use / free, never a number of people. A list = its option as written.",pick:"Pick an entity",add:"Add",remove:"Remove",removeOne:"Remove: {n}",none:"No entity picked",noCandidates:"No suitable entities",max:"Up to {n} entities",gone:"Not found"},pe={he:St,en:ce};function $(t,s,a=Lt()){const o=pe[a][t]??St[t]??t;return s?o.replace(/\{(\w+)\}/g,(n,i)=>i in s?String(s[i]):n):o}const lt=["elevators","generator","parking","gym"],at=8,he=t=>lt.includes(t);function rt(t){return[...new Set((t??[]).filter(he))]}function ue(t){const s=rt(t),a=lt.filter(o=>!s.includes(o));return[...s.map((o,n)=>({kind:o,on:!0,pos:n,count:s.length})),...a.map(o=>({kind:o,on:!1,pos:-1,count:s.length}))]}function be(t,s,a){const o=rt(t).filter(n=>n!==s);return a?[...o,s]:o}function vt(t,s,a){const o=rt(t),n=o.indexOf(s),i=n+a;return n<0||i<0||i>=o.length||([o[n],o[i]]=[o[i],o[n]]),o}function ve(t,s){return!s||t!=="parking"&&t!=="gym"?!1:!s[t]?.length}function ge(t,s){return!s||t.includes(s)||t.length>=at?[...t]:[...t,s]}function fe(t,s){return t.filter(a=>a!==s)}function me(t,s){return(t??[]).filter(a=>!s.includes(a.entity_id))}function $e(t,s){return(t??[]).find(a=>a.entity_id===s)?.name??null}var we=Object.defineProperty,ye=Object.getOwnPropertyDescriptor,K=(t,s,a,o)=>{for(var n=o>1?void 0:o?ye(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&we(s,a,n),n};const ke={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let T=class extends y{constructor(){super(...arguments),this.value=[],this.show=!0,this.sources=null}emit(t){this.dispatchEvent(new CustomEvent("info-change",{detail:[...t],bubbles:!0,composed:!0}))}render(){const t=this.value.length>0,s=ue(this.value);return l`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${a=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:a.target.checked,bubbles:!0,composed:!0}))}>${e("infoShow")}</label>
      <p class="help" data-info-help>${e("infoOldBoards")}</p>
      <label class="ck"><input type="checkbox" .checked=${t} @change=${a=>this.emit(a.target.checked?[...lt]:[])}>${e("blkInfo")}</label>
      <ol class="ord" data-info-order>${s.map(a=>{const o=e(ke[a.kind]);return l`<li data-info-row=${a.kind} data-on=${String(a.on)}>
          <label class="ck"><input type="checkbox" data-info=${a.kind} .checked=${a.on} @change=${n=>this.emit(be(this.value,a.kind,n.target.checked))}>${o}</label>
          ${a.on?l`<button type="button" class="mv up" data-info-up=${a.kind} aria-label=${$("moveUp",{k:o})} title=${$("moveUp",{k:o})} ?disabled=${a.pos<=0}
              @click=${()=>this.emit(vt(this.value,a.kind,-1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${a.kind} aria-label=${$("moveDown",{k:o})} title=${$("moveDown",{k:o})} ?disabled=${a.pos>=a.count-1}
              @click=${()=>this.emit(vt(this.value,a.kind,1))}><sw-icon name="chevron" size="14"></sw-icon></button>`:c}
          ${a.on&&ve(a.kind,this.sources)?l`<span class="note" data-info-no-source=${a.kind}>${$("noSource")}</span>`:c}
        </li>`})}</ol>
      <p class="hint" data-info-order-hint>${e("infoIconsOnly")}. ${$("orderHint")}</p>
    </div>`}};T.styles=C`
    :host { display: block; }
    .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
    .ck { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .help { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sub { display: flex; gap: 8px 16px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .ord { display: grid; gap: 4px; padding-inline-start: 22px; margin: 0; list-style: none; padding-block: 0; }
    .ord li { display: flex; align-items: center; gap: 6px 10px; flex-wrap: wrap; min-block-size: 32px; }
    .ord .ck { min-inline-size: 120px; }
    .mv { display: inline-grid; place-items: center; inline-size: 28px; block-size: 28px; padding: 0; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md);
      background: var(--sw-surface-2); color: var(--sw-text-2); cursor: pointer; }
    .mv:hover:not(:disabled) { color: var(--sw-text); }
    .mv:disabled { opacity: 0.4; cursor: default; }
    .mv:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
    .mv.up sw-icon { transform: rotate(-90deg); }
    .mv.down sw-icon { transform: rotate(90deg); }
    .note { font-size: var(--sw-fs-xs); color: var(--sw-warning-text); }
    .hint { margin: 0; padding-inline-start: 22px; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
  `;K([g({attribute:!1})],T.prototype,"value",2);K([g({type:Boolean})],T.prototype,"show",2);K([g({attribute:!1})],T.prototype,"sources",2);T=K([k("notice-display-info")],T);var xe=Object.defineProperty,_e=Object.getOwnPropertyDescriptor,I=(t,s,a,o)=>{for(var n=o>1?void 0:o?_e(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&xe(s,a,n),n};let S=class extends y{constructor(){super(...arguments),this.parking=[],this.gym=[],this.candidates={},this.disabled=!1,this.pick={parking:"",gym:""}}emit(t,s){this.dispatchEvent(new CustomEvent("info-sources-change",{detail:{[`${t}_entities`]:s},bubbles:!0,composed:!0}))}one(t){const s=t==="parking"?this.parking:this.gym,a=this.candidates[t]??[],o=me(a,s),n=s.length>=at,i=$(t==="parking"?"parkingLabel":"gymLabel"),r=`ns-src-${t}`;return l`<div class="src fld" data-info-source=${t}>
      <label for=${r}>${i}</label>
      ${s.length?l`<ul class="picked" data-info-source-list>${s.map(p=>{const d=$e(a,p);return l`<li class=${d===null?"gone":""} data-info-source-item=${p}><span>${d??$("gone")}</span>
          <button type="button" aria-label=${$("removeOne",{n:d??$("gone")})} ?disabled=${this.disabled} @click=${()=>this.emit(t,fe(s,p))}>${$("remove")}</button></li>`})}</ul>`:l`<span class="mut" data-info-source-none>${$("none")}</span>`}
      <div class="row">
        <select id=${r} class="inp" data-info-source-pick .value=${this.pick[t]} ?disabled=${this.disabled||n||!o.length}
          @change=${p=>this.pick={...this.pick,[t]:p.target.value}}>
          <option value="">${o.length?$("pick"):$("noCandidates")}</option>
          ${o.map(p=>l`<option value=${p.entity_id}>${p.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled||n||!this.pick[t]}
          @click=${()=>{const p=this.pick[t];this.pick={...this.pick,[t]:""},this.emit(t,ge(s,p))}}>${$("add")}</button>
        ${n?l`<span class="mut">${$("max",{n:at})}</span>`:c}
      </div>
      <span class="hint">${$(t==="parking"?"parkingHint":"gymHint")}</span>
    </div>`}render(){return l`<div class="srcs" data-info-sources>
      <span class="lbl">${$("sourcesTitle")}</span>
      <span class="hint">${$("sourcesHint")}</span>
      ${this.one("parking")}
      ${this.one("gym")}
    </div>`}};S.styles=[x,C`
    :host { display: block; }
    .srcs { display: grid; gap: 12px; }
    .src { display: grid; gap: 6px; }
    .picked { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .picked li { display: inline-flex; align-items: center; gap: 4px; padding-block: 2px; padding-inline: 10px 4px; border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .picked li.gone { color: var(--sw-text-3); }
    .picked button { font: inherit; font-size: var(--sw-fs-xs); border: 0; background: transparent; color: var(--sw-text-2); cursor: pointer;
      padding: 2px 6px; border-radius: var(--sw-r-md); }
    .picked button:hover:not(:disabled) { color: var(--sw-text); }
    .picked button:focus-visible, .add:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
    .row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .row select { min-inline-size: 0; flex: 1 1 200px; max-inline-size: 360px; }
    .add { font: inherit; font-size: var(--sw-fs-sm); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); background: var(--sw-surface-2);
      color: var(--sw-text); padding: 5px 12px; cursor: pointer; }
    .add:disabled { opacity: 0.5; cursor: default; }
    .mut { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
  `];I([g({attribute:!1})],S.prototype,"parking",2);I([g({attribute:!1})],S.prototype,"gym",2);I([g({attribute:!1})],S.prototype,"candidates",2);I([g({type:Boolean})],S.prototype,"disabled",2);I([h()],S.prototype,"pick",2);S=I([k("notice-info-sources")],S);var Se=Object.defineProperty,De=Object.getOwnPropertyDescriptor,_=(t,s,a,o)=>{for(var n=o>1?void 0:o?De(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Se(s,a,n),n};let w=class extends y{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await Pt(this.boardId)}catch(t){this.err=m(t)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(t){this.err="",this.confirming=!1,this.dlg={id:t.id,title:t.title,text:t.text,seconds:t.seconds?String(t.seconds):"",boards:[...t.boards],hasImage:t.has_image,removeImage:!1,file:null}}set(t){this.dlg&&(this.dlg={...this.dlg,...t})}async save(){const t=this.dlg;if(!t||!t.title.trim())return;const s=t.seconds.trim()===""?null:Number(t.seconds);this.busy=!0,this.err="";try{const a={title:t.title.trim(),text:t.text.trim(),seconds:s,board_ids:t.boards};let o=t.id;o?await Nt(o,a):o=(await zt(a)).id,t.file?await Et(o,t.file):t.removeImage&&t.hasImage&&await Tt(o),this.dlg=null,await this.load(),this.changed()}catch(a){this.err=m(a)}finally{this.busy=!1}}async removeSlide(){const t=this.dlg;if(t?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await Ct(t.id),this.dlg=null,await this.load(),this.changed()}catch(s){this.err=m(s)}finally{this.busy=!1,this.confirming=!1}}}async photo(t,s=!1){this.busy=!0,this.err="";try{const a=s?t?await It(this.boardId,t):await Rt(this.boardId):t?await Bt(this.boardId,t):await At(this.boardId);this.doc={...this.doc??a,photo:a.photo,photo_night:a.photo_night},this.changed()}catch(a){this.err=m(a)}finally{this.busy=!1}}pickBoard(t){const s=this.dlg;s&&this.set({boards:s.boards.includes(t)?s.boards.filter(a=>a!==t):[...s.boards,t]})}dialog(){const t=this.dlg;if(!t)return l`<sw-dialog></sw-dialog>`;const s=this.doc?.seconds.min??6,a=this.doc?.seconds.max??120,o=t.file?t.file.name:t.hasImage&&!t.removeImage?e("slidePicture"):e("slideNoPicture");return l`<sw-dialog open data-slide-dialog heading=${t.id?e("slideEditTitle"):e("slideNew")} @close=${()=>this.dlg=null}>
      <div class="form">
        <div class="fld"><label for="sl-title">${e("slideTitle")}</label><input id="sl-title" class="inp" maxlength="80" .value=${t.title} @input=${n=>this.set({title:n.target.value})}></div>
        <div class="fld"><label for="sl-text">${e("slideText")}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${t.text} @input=${n=>this.set({text:n.target.value})}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${e("slideSeconds")}</label><input id="sl-sec" class="inp short num" type="number" min=${s} max=${a} .value=${t.seconds} @input=${n=>this.set({seconds:n.target.value})}></div>
          <div class="fld"><span class="lbl">${e("slidePicture")}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${()=>this.renderRoot.querySelector("[data-slide-file]").click()}>${e("slidePick")}</sw-button>
              <span class="nm">${o}</span>
              ${t.file||t.hasImage&&!t.removeImage?l`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${()=>this.set({file:null,removeImage:!0})}>${e("slideRemovePicture")}</sw-button>`:c}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${n=>this.set({file:n.target.files?.[0]??null,removeImage:!1})}></div></div>
        </div>
        ${this.boards.length>1?l`<div class="fld"><span class="lbl">${e("slideBoards")}</span>
          <div class="chips" data-slide-boards>${this.boards.map(n=>l`<button class="pick" aria-pressed=${String(t.boards.includes(n.id))} data-slide-board=${n.id} @click=${()=>this.pickBoard(n.id)}>${n.name}</button>`)}</div></div>`:c}
      </div>
      ${this.err?l`<p class="err" role="alert" data-slide-error>${this.err}</p>`:c}
      ${t.id?l`<sw-button slot="footer" variant=${this.confirming?"danger":"ghost"} ?disabled=${this.busy} data-slide-delete @click=${()=>this.removeSlide()}>${this.confirming?e("slideDeleteConfirm"):e("slideDelete")}</sw-button>`:l`<sw-button slot="footer" variant="ghost" @click=${()=>this.dlg=null}>${e("cancel")}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy||!t.title.trim()} data-slide-save @click=${()=>this.save()}>${e("save")}</sw-button>
    </sw-dialog>`}render(){if(!this.display)return l``;const t=this.doc?.slides??[],s=this.doc?.limit??10,a=this.display.rotate_s||12,o=t.reduce((r,p)=>r+(p.seconds||a),0),n=this.doc?.photo,i=this.doc?.photo_night;return l`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(r.target.checked)}>${e("slidesBlock")}</label>
          <span class="st num" data-slides-count>${e("slidesCount",{n:t.length,s:o})}</span></div>
        <div class="slides" data-slide-grid>${t.map(r=>l`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?l`<img alt="" src=${Ht(r)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${e("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${t.length>=s} title=${e("slideLimit",{n:s})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${e("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?l`<div class="blk" data-photo-block><span class="ck"><b>${e("photoBlock")}</b></span>
        <div class="photo"><div class="th">${n?.has?l`<img alt="" data-photo-img src=${Ut(this.boardId,n.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${n?.has?e("photoReplace"):e("photoUpload")}</sw-button>
          ${n?.has?l`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${e("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const p=r.target,d=p.files?.[0];p.value="",d&&this.photo(d)}}></div>
        ${!this.dlg&&this.err?l`<p class="err" role="alert" data-photo-error>${this.err}</p>`:c}</div>`:c}
      ${this.lux?l`<div class="blk" data-photo-night-block><span class="ck"><b>${e("photoNightBlock")}</b></span><span class="hint">${e("photoNightHint")}</span>
        <div class="photo"><div class="th">${i?.has?l`<img alt="" data-photo-night-img src=${Ft(this.boardId,i.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${i?.has?e("photoReplace"):e("photoUpload")}</sw-button>
          ${i?.has?l`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${e("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const p=r.target,d=p.files?.[0];p.value="",d&&this.photo(d,!0)}}></div></div>`:c}
      ${this.dialog()}`}emitPromo(t){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:t}},bubbles:!0,composed:!0}))}};w.styles=[x,C`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .st { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
      .slides { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; padding-inline-start: 22px; }
      .slide { display: grid; gap: 4px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); overflow: hidden; background: var(--sw-surface); font-size: var(--sw-fs-sm); padding: 0; font: inherit; color: inherit; text-align: start; }
      .slide .im { aspect-ratio: 16 / 9; display: grid; place-items: center; color: var(--sw-text-3); background: var(--sw-surface-3); overflow: hidden; }
      .slide .im img { inline-size: 100%; block-size: 100%; object-fit: cover; display: block; }
      .slide .im.add { border: 2px dashed var(--sw-border-strong); }
      .slide .cap { padding: 4px 8px 8px; display: flex; justify-content: space-between; gap: 6px; align-items: center; min-inline-size: 0; }
      .slide .cap b { color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      button.slide.add { cursor: pointer; }
      button.slide.add:disabled { opacity: 0.5; cursor: default; }
      .photo { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .photo .th { inline-size: 120px; aspect-ratio: 16 / 9; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface-3); overflow: hidden; display: grid; place-items: center; color: var(--sw-text-3); }
      .photo .th img { inline-size: 100%; block-size: 100%; object-fit: cover; }
      input[type='file'] { display: none; }
      .file { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
      .file .nm { color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 28ch; }
    `];_([g({attribute:!1})],w.prototype,"display",2);_([g({attribute:!1})],w.prototype,"boardId",2);_([g({type:Boolean})],w.prototype,"lux",2);_([g({attribute:!1})],w.prototype,"boards",2);_([h()],w.prototype,"doc",2);_([h()],w.prototype,"dlg",2);_([h()],w.prototype,"err",2);_([h()],w.prototype,"busy",2);_([h()],w.prototype,"confirming",2);w=_([k("notice-display-slides")],w);var Oe=Object.defineProperty,Le=Object.getOwnPropertyDescriptor,H=(t,s,a,o)=>{for(var n=o>1?void 0:o?Le(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Oe(s,a,n),n};let O=class extends y{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await js()}catch{this.failed=!0}}get scr(){return Hs(this.display)}emit(t){const s=(this.t?.config.stops??[]).map(o=>o.code),a=Ws(this.scr,t,s);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:a},bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=this.scr,s=this.t?.config.stops??[],a=!!this.t?.config.enabled&&s.length>0,o=document.documentElement.lang?.startsWith("en")?"en":"he",n=[["side",b("lay_side"),b("lay_side_hint")],["strip",b("lay_strip"),b("lay_strip_hint")],["slide",b("lay_slide"),b("lay_slide_hint")]],i=[["auto",b("grp_auto")],["always",b("grp_always")],["never",b("grp_never")]],r=Ms(t.window_min),p=t.stops.length?t.stops:s.map(d=>d.code);return l`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${t.enabled} @change=${d=>this.emit({enabled:d.target.checked})}><b>${b("scrTitle")}</b> - ${b("scrShow")}</label>
      ${a?c:l`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?b("forbiddenHint"):b("scrOffModule")}</span>
        <a href="#/system/transit">${b("scrGo")}</a></div>`}
      ${t.enabled&&a?l`
        <div class="sub" data-transit-stops>
          <span>${b("scrStops")}</span>
          ${s.map(d=>l`<label class="ck"><input type="checkbox" data-transit-stop=${d.code} .checked=${A(p.includes(d.code))}
            @change=${()=>this.emit({stops:Gs(t.stops,d.code,s.map(u=>u.code))})}>${d.name||d.catalogue_name||d.code}</label>`)}
          ${t.stops.length===0?l`<span class="hint">${b("scrStopsAll")}</span>`:c}
        </div>
        ${this.v2Layout?c:l`<div class="sub"><span>${b("scrLayout")}</span><div class="seg" data-transit-layout>${n.map(([d,u,R])=>l`<button data-layout=${d} title=${R} aria-pressed=${String(t.layout===d)} @click=${()=>this.emit({layout:d})}>${u}</button>`)}</div></div>`}
        <div class="sub"><span>${b("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(t.window_min):"free"} @change=${d=>{const u=d.target.value;this.emit({window_min:u==="free"?45:Number(u)})}}>${Vs.map(d=>l`<option value=${String(d)} ?selected=${r==="list"&&t.window_min===d}>${qs(d,o)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${b("scrWindowFree")}</option></select>
          ${r==="free"?l`<input class="inp short num" type="number" data-transit-window-free min=${P[0]} max=${P[1]} step="1" .value=${A(String(t.window_min))}
            title=${b("scrFree",{a:P[0],b:P[1]})}
            @change=${d=>this.emit({window_min:W(d.target.value,P[0],P[1],t.window_min)})}>`:c}
        </div>
        <div class="sub"><span>${b("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${F[0]} max=${F[1]} step="1" .value=${A(String(t.rows))}
          @change=${d=>this.emit({rows:W(d.target.value,F[0],F[1],t.rows)})}>
          <span>${b("scrGroup")}</span><select class="inp" data-transit-group .value=${t.group} @change=${d=>this.emit({group:d.target.value})}>
            ${i.map(([d,u])=>l`<option value=${d} ?selected=${t.group===d}>${u}</option>`)}</select></div>
        <div class="sub"><span>${b("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${j[0]} max=${j[1]} step="1"
          placeholder=${b("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${A(t.refresh_s==null?"":String(t.refresh_s))}
          @change=${d=>{const u=d.target.value.trim();this.emit({refresh_s:u===""?null:W(u,j[0],j[1],20)})}}>
          <span>${b("scrDistance")}</span><select class="inp" data-transit-distance .value=${t.show_distance==null?"inherit":t.show_distance?"on":"off"} @change=${d=>{const u=d.target.value;this.emit({show_distance:u==="inherit"?null:u==="on"})}}>${[["inherit",b("scrDistInherit")],["on",b("scrDistOn")],["off",b("scrDistOff")]].map(([d,u])=>l`<option value=${d} ?selected=${(t.show_distance==null?"inherit":t.show_distance?"on":"off")===d}>${u}</option>`)}</select></div>
        ${(this.v2Layout??t.layout)==="slide"?l`<div class="sub"><span>${b("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${M[0]} max=${M[1]} step="1" .value=${A(String(t.dwell_s))}
          @change=${d=>this.emit({dwell_s:W(d.target.value,M[0],M[1],t.dwell_s)})}></div>`:c}
      `:c}
    </div>`}};O.styles=[x,C`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];H([g({attribute:!1})],O.prototype,"display",2);H([g({attribute:!1})],O.prototype,"v2Layout",2);H([h()],O.prototype,"t",2);H([h()],O.prototype,"failed",2);O=H([k("notice-display-transit")],O);const it=40,ot=12,Pe="image/png,image/jpeg",Ne=3e5;function gt(t){return t.map(s=>({id:s.id,name:s.name,url:s.url,enabled:s.enabled!==!1,has_logo:!!s.has_logo,logo_url:s.logo_url||"",custom:!!s.custom}))}function ze(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1}}function Ee(t){const s=t.trim();if(!s||s.length>400||/[\s\\]/.test(s))return!1;let a;try{a=new URL(s)}catch{return!1}if(a.protocol!=="https:"||a.username||a.password||a.port&&a.port!=="443")return!1;const o=a.hostname.toLowerCase();return!o.includes(".")||o==="localhost"||o.endsWith(".local")||o.endsWith(".localhost")||o.endsWith(".internal")?!1:/^[0-9.]+$/.test(o)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(o):!o.startsWith("[")}function Dt(t){const s=new Set;return t.map(a=>{const o=a.name.trim();if(!o||o.length>it)return"name";if(!Ee(a.url))return"url";const n=a.url.trim();return s.has(n)?"dup":(s.add(n),"")})}function ft(t){return t.length<=ot&&Dt(t).every(s=>s==="")}function mt(t,s,a){if(s===a||s<0||a<0||s>=t.length||a>=t.length)return t;const o=t.slice();return o.splice(a,0,o.splice(s,1)[0]),o}function nt(t){return t.map(s=>({...s.id?{id:s.id}:{},name:s.name.trim(),url:s.url.trim(),enabled:s.enabled}))}function $t(t,s){return JSON.stringify(nt(t))!==JSON.stringify(nt(s))||t.some(a=>a.custom)}function Te(t,s){const a=s.find(o=>t.id&&o.id===t.id||o.url===t.url);return a?{name:a.name,logo:a.logo_url||"",known:!a.custom}:{name:t.name,logo:"",known:!1}}function Ce(t,s=24){const a=t.trim();return a.length<=s?a:a.slice(0,s-1)+"…"}var Ie=Object.defineProperty,Re=Object.getOwnPropertyDescriptor,U=(t,s,a,o)=>{for(var n=o>1?void 0:o?Re(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ie(s,a,n),n};let L=class extends y{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=gt(this.sources),(!$t(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(t=>({...t}))))}say(t){this.dispatchEvent(new CustomEvent("ns-message",{detail:t,bubbles:!0,composed:!0}))}applyAnswer(t,s){const a=this.rows;this.fromProp=t.sources,this.saved=gt(t.sources),this.rows=s?this.saved.map(o=>{const n=a.find(i=>i.id===o.id);return n?{...n,has_logo:o.has_logo,logo_url:o.logo_url,custom:o.custom}:{...o}}).concat(a.filter(o=>!o.id)):this.saved.map(o=>({...o})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:t.sources,bubbles:!0,composed:!0}))}set(t,s){this.rows=this.rows.map((a,o)=>o===t?{...a,...s}:a)}async save(){if(!(this.busy||!ft(this.rows))){this.busy=!0;try{this.applyAnswer(await jt(nt(this.rows)),!1),this.say(e("nsSaved"))}catch(t){this.say(m(t))}finally{this.busy=!1}}}async logo(t,s){const a=this.rows[t];if(!(!s||!a?.id||this.busy)){if(s.size>Ne){this.say(e("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await Wt(a.id,s),!0)}catch(o){this.say(o instanceof wt&&o.status===422?e("nsLogoFile"):m(o))}finally{this.busy=!1}}}async dropLogo(t){const s=this.rows[t];if(!(!s?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Mt(s.id),!0)}catch(a){this.say(m(a))}finally{this.busy=!1}}}rowHtml(t,s,a){const o=this.rows.length-1,n=!!t.id&&!this.busy,i=t.has_logo?e("nsLogoReplace"):e("nsLogoUpload");return l`<div class="row" data-ns-row=${t.id||"new"} data-off=${t.enabled?"0":"1"} data-bad=${a?"1":"0"}>
      <div class="lg" data-ns-logo>${t.has_logo&&t.logo_url?l`<img alt="" src=${t.logo_url}>`:l`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${it} .value=${t.name} placeholder=${e("nsName")} aria-label=${e("nsName")} @input=${r=>this.set(s,{name:r.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${t.url} placeholder="https://" aria-label=${e("nsUrl")} @input=${r=>this.set(s,{url:r.target.value})}>
      <div class="tools">
        ${t.custom?l`<span class="chip">${e("nsCustomTag")}</span>`:c}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${t.enabled} @change=${r=>this.set(s,{enabled:r.target.checked})}>${e("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!n} title=${t.id?i:e("nsLogoSaveFirst")} aria-label=${i}
          @click=${r=>r.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${Pe} @change=${r=>{const p=r.target;this.logo(s,p.files?.[0]),p.value=""}}>
        ${t.has_logo?l`<button class="ib" type="button" data-ns-logo-del ?disabled=${!n} title=${e("nsLogoRemove")} aria-label=${e("nsLogoRemove")} @click=${()=>this.dropLogo(s)}><sw-icon name="close" size="14"></sw-icon></button>`:c}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${s===0} title=${e("nsUp")} aria-label=${e("nsUp")} @click=${()=>this.rows=mt(this.rows,s,s-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${s===o} title=${e("nsDown")} aria-label=${e("nsDown")} @click=${()=>this.rows=mt(this.rows,s,s+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${e("nsDelete")} aria-label=${e("nsDelete")} @click=${()=>this.rows=this.rows.filter((r,p)=>p!==s)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${a?l`<span class="err" data-ns-err=${a}>${a==="name"?e("nsErrName",{n:it}):a==="url"?e("nsErrUrl"):e("nsErrDup")}</span>`:c}
    </div>`}render(){const t=Dt(this.rows),s=$t(this.rows,this.saved);return l`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${e("nsCard")}</h2><span class="chip num">${e("nsCount",{n:this.rows.length,m:ot})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=ot} @click=${()=>this.rows=[...this.rows,ze()]}>${e("nsAdd")}</sw-button></div>
      ${this.rows.length?l`<div class="list" data-ns-list>${this.rows.map((a,o)=>this.rowHtml(a,o,t[o]))}</div>`:l`<span class="mut">${e("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${s?l`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(a=>({...a}))}>${e("nsDiscard")}</sw-button>`:c}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!s||!ft(this.rows)||this.busy} @click=${()=>this.save()}>${e("nsSave")}</sw-button></div>
    </div>`}};L.styles=[x,C`
      .list { display: grid; gap: 8px; max-block-size: min(52vh, 460px); overflow: auto; padding-inline-end: 2px; overscroll-behavior: contain; }
      .row { display: grid; grid-template-columns: 64px minmax(120px, 1fr) minmax(160px, 1.6fr) auto; gap: 8px 10px; align-items: center; padding: 8px 10px;
        border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); }
      .row[data-off='1'] { opacity: 0.62; }
      .row[data-bad='1'] { border-color: var(--sw-danger); }
      .lg { inline-size: 64px; block-size: 40px; border-radius: var(--sw-r-md); background: #fff; border: 1px solid var(--sw-border); display: grid; place-items: center; overflow: hidden; color: var(--sw-text-3); }
      .lg img { max-inline-size: 100%; max-block-size: 100%; object-fit: contain; }
      .tools { display: inline-flex; align-items: center; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
      .tools .sp { inline-size: 6px; }
      .ib { font: inherit; border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-md); inline-size: 30px; block-size: 30px;
        display: inline-grid; place-items: center; cursor: pointer; padding: 0; }
      .ib:hover:not(:disabled) { color: var(--sw-text); border-color: var(--sw-text-3); }
      .ib:disabled { opacity: 0.4; cursor: default; }
      .ib:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; }
      .up sw-icon { transform: rotate(180deg); }
      .err { grid-column: 2 / -1; }
      .foot { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-start: 10px; }
      .foot .sp { flex: 1; }
      .file { display: none; }
      @media (max-width: 767px) {
        .row { grid-template-columns: 64px minmax(0, 1fr); }
        .row .url, .row .tools, .err { grid-column: 1 / -1; }
        .tools { justify-content: flex-start; }
      }
    `];U([g({attribute:!1})],L.prototype,"sources",2);U([h()],L.prototype,"rows",2);U([h()],L.prototype,"saved",2);U([h()],L.prototype,"busy",2);L=U([k("notice-news-sources")],L);var Be=Object.defineProperty,Ae=Object.getOwnPropertyDescriptor,Ot=(t,s,a,o)=>{for(var n=o>1?void 0:o?Ae(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Be(s,a,n),n};let V=class extends y{constructor(){super(...arguments),this.value="hide"}render(){return l`<div class="fld"><label for="ns-home-empty">${e("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${t=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:t.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${e("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${e("dHomeEmptyLine")}</option></select></div>`}};V.styles=[x];Ot([g()],V.prototype,"value",2);V=Ot([k("notice-home-empty")],V);var He=Object.defineProperty,Ue=Object.getOwnPropertyDescriptor,f=(t,s,a,o)=>{for(var n=o>1?void 0:o?Ue(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&He(s,a,n),n};let v=class extends y{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(t){t.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(t=>{t.value!==t.dataset.v&&(t.value=t.dataset.v??"")})}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Gt(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(t){t instanceof wt&&t.status===403?this.forbidden=!0:this.error=m(t)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{this.boards=(await Vt()).boards}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await Z(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await dt("all")).notices}catch{this.notices=[]}}catch(t){this.error=m(t)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const t=await qt();this.floors=t.floors,this.groups=t.groups,this.roles=t.roles}catch{}}}newNotice(t=""){const s=this.s.settings;this.compose=t?Yt(new Date,s.default_days,s.default_severity,t):Xt(new Date,s.default_days,s.default_severity)}editNotice(t){const s=this.notices.find(a=>a.id===t);s&&(this.compose=Kt(s))}async composed(t){this.compose=null,this.say(t.detail.message);try{this.notices=(await dt("all")).notices}catch{}if(this.detail)try{this.detail=await Z(this.detail.board.id)}catch(s){this.say(m(s))}this.loadBoards()}composeDialog(){return l`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${t=>this.composed(t)}></notice-compose>`}async patchSettings(t,s=e("saved")){try{const a=await Jt(t);this.s&&(this.s={...this.s,settings:a.settings}),"enabled"in t&&(Zt(a.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(s)}catch(a){this.say(m(a))}}render(){return this.forbidden?l`<sw-page heading=${e("setTitle")}><sw-state-panel state="forbidden" heading=${e("forbidden")} hint=${e("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?l`<sw-page heading=${e("setTitle")}><sw-state-panel state="error" heading=${e("saveError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?l`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast?l`<div class="toast" role="status" ${Qt()}>${this.toast}</div>`:c}`:l`<sw-page heading=${e("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const t=this.s,s=t.settings,a=t.can;return l`
      <div class="top"><div><h1>${e("setTitle")}</h1><p class="sub">${e("setSub")}</p></div><span class="sp"></span>
        ${s.enabled&&a.manage?l`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=ts}>${e("allNotices")}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${()=>this.newNotice()}>${e("newNotice")}</sw-button></div>`:c}</div>
      ${s.enabled?c:l`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${e("off")} hint=${e("offBody")}
          actionLabel=${a.configure?e("turnOn"):""} @action=${()=>this.patchSettings({enabled:!0})}></sw-state-panel>`}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${e("moduleCard")}</h2><span class="sp"></span>
          <sw-toggle .checked=${s.enabled} ?disabled=${!a.configure} label=${s.enabled?e("moduleOn"):e("moduleOff")} data-module-switch
            @change=${o=>this.patchSettings({enabled:o.detail.checked})}></sw-toggle></div>
          <dl class="kv"><dt>${e("kvWrite")}</dt><dd>${e("kvWriteV")} <span class="mut ltr">(notices.manage)</span></dd><dt>${e("kvPush")}</dt><dd>${e("kvPushV")} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${e("kvBoards")}</dt><dd>${e("kvBoardsV")} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${a.configure?this.defaultsCard():c}
      </div>
      ${a.configure?l`<notice-news-sources .sources=${s.news_sources} @ns-message=${o=>this.say(o.detail)}
        @news-sources-change=${o=>this.s={...this.s,settings:{...this.s.settings,news_sources:o.detail}}}></notice-news-sources>`:c}
      ${s.enabled&&a.boards?l`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${e("boardsCard")}</h2><span class="chip num">${e("boardsCount",{n:this.boards.length,m:s.boards_max})}</span><span class="sp"></span>
          ${a.configure?l`<label class="ck"><input type="checkbox" .checked=${s.boards_remote} @change=${o=>this.patchSettings({boards_remote:o.target.checked})}>${e("dRemote")}</label>`:c}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length>=s.boards_max} @click=${()=>this.openCreate()}>${e("newBoard")}</sw-button></div>
        ${this.boards.length?l`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map(o=>this.boardCard(o))}</div>`:l`<sw-state-panel icon="wall" state="empty" heading=${e("noBoards")} hint=${e("boardsEmpty")} actionLabel=${e("firstBoard")} @action=${()=>this.openCreate()}></sw-state-panel>`}
      </div>`:c}
      ${s.enabled&&a.boards?this.tvDefaultsCard():c}`}tvDefaults(){return Us(this.s?.settings.tv_defaults)}tvDefaultsCard(){return l`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${e("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${e("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return Fs(this.s?.settings.tv2_defaults)}tvFitDefaults(){return ne(this.s?.settings.tv2_defaults)}async saveTvDefaults(t){try{const s=await ss(t);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:s.tv_defaults,...s.tv2_defaults?{tv2_defaults:s.tv2_defaults}:{}}}),this.say(e("saved"))}catch(s){this.say(m(s))}}defaultsCard(){const t=this.s,s=t.settings;return l`<div class="panel" data-defaults-card><div class="hd"><h2>${e("defaultsCard")}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${e("dDays")}</label><div class="sum"><input id="ns-days" class="inp short num" type="number" min="1" max="90" .value=${String(s.default_days)}
          @change=${a=>this.patchSettings({default_days:Number(a.target.value)})}><span class="mut">${e("dDaysUnit")}</span></div></div>
        <div class="fld"><label for="ns-sev">${e("dSeverity")}</label><select id="ns-sev" class="inp" data-v=${s.default_severity} @change=${a=>this.patchSettings({default_severity:a.target.value})}>
          <option value="info">${e("sevInfo")}</option><option value="alert">${e("sevAlert")}</option></select></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${e("dReads")}</label><select id="ns-reads" class="inp" data-v=${s.reads_names?"names":"counts"} @change=${a=>this.patchSettings({reads_names:a.target.value==="names"})}>
          <option value="names">${e("dReadsNames")}</option><option value="counts">${e("dReadsCounts")}</option></select></div>
        <div class="fld"><label for="ns-ret">${e("dRetention")}</label><select id="ns-ret" class="inp" data-v=${String(s.retention_days)}
          @change=${a=>this.patchSettings({retention_days:Number(a.target.value)})}>
          ${es(s.retention_days).map(a=>l`<option value=${String(a.value)}>${a.label}</option>`)}</select></div>
        <notice-home-empty .value=${s.home_empty??"hide"} @home-empty-change=${a=>this.patchSettings({home_empty:a.detail})}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${e("dPush")}</label><select id="ns-push" class="inp" data-v=${s.push_default}
          @change=${a=>this.patchSettings({push_default:a.target.value})}>
          <option value="by_severity">${e("dPushSev")}</option><option value="always">${e("dPushAlways")}</option><option value="never">${e("dPushNever")}</option></select>
          <span class="hint">${e("dPushHint")}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${e("dWeather")}</label><select id="ns-wx" class="inp" data-v=${s.weather_entity} @change=${a=>this.patchSettings({weather_entity:a.target.value})}>
          <option value="">${e("dWeatherNone")}</option>${t.weather_entities.map(a=>l`<option value=${a.entity_id}>${a.name}</option>`)}</select></div>
        <div class="fld"><label for="ns-bn">${e("dBuilding")}</label><input id="ns-bn" class="inp" maxlength="60" .value=${s.building_name} placeholder=${t.building_fallback}
          @change=${a=>this.patchSettings({building_name:a.target.value})}><span class="hint">${e("dBuildingHint",{name:t.building_fallback||"-"})}</span></div>
      </div>
      <notice-info-sources .parking=${s.parking_entities??[]} .gym=${s.gym_entities??[]} .candidates=${t.info_entities??{}}
        @info-sources-change=${a=>this.patchSettings(a.detail)}></notice-info-sources>
      <div class="fld"><label for="ns-origin">${e("dOrigin")}</label><input id="ns-origin" class="inp ltr" maxlength="220" .value=${s.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${a=>this.patchSettings({boards_origin:a.target.value})}><span class="hint">${e("dOriginHint")}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${e("dConnTotal")}</label><input id="ns-ctot" class="inp short num" type="number" min="4" max="256" data-conn-total .value=${String(s.conn_total)}
          @change=${a=>this.patchSettings({conn_total:Number(a.target.value)})}></div>
        <div class="fld"><label for="ns-cadr">${e("dConnPerAddr")}</label><input id="ns-cadr" class="inp short num" type="number" min="1" max="64" data-conn-per-address .value=${String(s.conn_per_address)}
          @change=${a=>this.patchSettings({conn_per_address:Number(a.target.value)})}></div>
      </div>
      <label class="ck" data-places-tree-setting><input type="checkbox" .checked=${s.show_places_tree!==!1} @change=${a=>this.patchSettings({show_places_tree:a.target.checked})}>${e("dPlacesTree")}</label>
      <label class="ck"><input type="checkbox" .checked=${s.news_custom} @change=${a=>this.patchSettings({news_custom:a.target.checked})}>${e("dCustomFeeds")}</label>
      <div class="fld"><span class="lbl">${e("companyLogo")}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${e("logoWhere")}</a></div>
    </div></div>`}seenBadge(t){const s=as(t,Date.now()),a=s==="online"?"ok":s==="off"?"off":"unk",o=s==="online"?e("bOnline"):s==="off"?e("bDisabled"):s==="never"?e("bNever"):e("bIdle");return l`<span class="badge" data-look=${a}>${o}</span>`}summary(t){const s=t.display;if(!s)return"";const a=e(s.template===1?"tpl1":s.template===2?"tpl2":"tpl3"),o=e(s.theme==="day"?"themeDay":s.theme==="night"?"themeNight":"orAuto");return`${a} · ${o} · ${s.rotate_s} ${e("seconds")}`}boardsTable(){return l`<table class="t"><thead><tr><th>${e("bState")}</th><th>${e("bName")}</th><th>${e("bAddress")}</th><th>${e("bItems")}</th><th>${e("bSeen")}</th><th></th></tr></thead><tbody>
      ${this.boards.map(t=>l`<tr class="go" tabindex="0" data-board=${t.slug} @click=${()=>this.goBoard(t)} @keydown=${s=>s.key==="Enter"&&this.goBoard(t)}>
        <td>${this.seenBadge(t)}</td><td><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></td>
        <td class="ltr mut">/b/${t.slug}</td><td class="num">${t.item_count??0}</td><td class="num mut">${Q(t.last_seen_at,Date.now())}</td>
        <td class="act">${this.rowActions(t)}</td></tr>`)}
      </tbody></table>`}rowActions(t){const s=a=>o=>{o.stopPropagation(),a()};return l`${t.enabled?c:l`<sw-button size="sm" data-activate @click=${s(()=>void this.activate(t))}>${e("activate")}</sw-button>`}
      ${this.canCopyLink()?l`<sw-button size="sm" data-copy-link @click=${s(()=>void this.copyLink(t))}>${e("copyLink")}</sw-button>`:c}
      <sw-button size="sm" @click=${s(()=>this.goBoard(t))}>${e("open")}</sw-button>`}canCopyLink(){const t=this.s?.can;return!!(t?.configure&&t.boards)}async copyLink(t){if(!t.has_stored_link){this.confirmRotate={board:t,copy:!0,legacy:!0};return}try{const s=await is(t.id);this.link={board:t,token:s.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(t,s.token)).then(()=>this.say(e("copied")),()=>{})}catch(s){this.say(m(s))}}async activate(t){try{await ct(t.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===t.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(e("saved"))}catch(s){this.say(m(s))}}boardCard(t){return l`<div class="card" @click=${()=>this.goBoard(t)}><div class="row">${this.seenBadge(t)}<span class="ltr mut">/b/${t.slug}</span></div><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></div>`}goBoard(t){location.hash=`${tt}/${encodeURIComponent(t.id)}`}openCreate(){this.creating={name:"",slug:os("board",this.boards.map(t=>t.slug)),err:""}}createDialog(){const t=this.creating;return l`<sw-dialog ?open=${!!t} heading=${e("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${t?l`<div class="form">
        <div class="fld"><label for="nb-name">${e("bName")}</label><input id="nb-name" class="inp" maxlength="60" .value=${t.name} @input=${s=>this.creating={...t,name:s.target.value,err:""}}></div>
        <div class="fld"><label for="nb-slug">${e("bSlug")}</label><input id="nb-slug" class="inp ltr" maxlength="40" .value=${t.slug} @input=${s=>this.creating={...t,slug:s.target.value.toLowerCase(),err:""}}><span class="hint">${e("bSlugHint")}</span></div>
        ${t.err?l`<span class="err" role="alert">${t.err}</span>`:c}</div>`:c}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${e("newBoard")}</sw-button></sw-dialog>`}async create(){const t=this.creating;if(t){if(!t.name.trim()){this.creating={...t,err:e("bName")};return}if(!ns(t.slug)){this.creating={...t,err:e("bSlugHint")};return}try{const s=await ls({name:t.name.trim(),slug:t.slug});this.creating=null,this.link={board:s.board,token:s.token,rotated:!1},await this.loadBoards()}catch(s){this.creating={...t,err:m(s)}}}}linkUrl(t,s){return rs(t.slug,s,this.s?.settings.boards_origin||void 0)}linkDialog(){const t=this.link,s=t?this.linkUrl(t.board,t.token):"";return l`<sw-dialog ?open=${!!t} heading=${t?e("linkTitle",{name:t.board.name}):""} subheading=${t?.rotated?e("linkSub"):e("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${t?l`<div class="form">
        <div class="link"><code data-board-link>${s}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(s)}>${e("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${ds(s,148)}</div><p class="hint">${e("linkHint")}</p></div>
        ${this.s?.settings.boards_remote?c:l`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${e("linkLan")}</span></div>`}
      </div>`:c}
      <sw-button slot="footer" variant="primary" @click=${()=>this.link=null}>${e("done")}</sw-button></sw-dialog>`}async copy(t){try{await navigator.clipboard.writeText(t),this.say(e("copied"))}catch{this.say(t)}}boardPage(){const t=this.detail,s=t.board,a=[{id:"general",label:e("tabGeneral")},{id:"display",label:e("tabDisplay")},{id:"notices",label:`${e("tabNotices")} (${t.notices.length})`}];return l`
      <div class="top"><div><h1>${s.name}</h1><p class="sub"><a href=${tt}>${e("back")}</a> · <span class="ltr">/b/${s.slug}</span> · ${Q(s.last_seen_at,Date.now())}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${e("openTv")}</sw-button>
          ${this.canCopyLink()?l`<sw-button icon="copy" data-copy-link @click=${()=>void this.copyLink(s)}>${e("copyLink")}</sw-button>`:c}
          <sw-button icon="refresh" data-rotate @click=${()=>this.confirmRotate={board:s,copy:!1}}>${e("newLink")}</sw-button>
          <sw-toggle .checked=${s.enabled} label=${e("boardEnabled")} @change=${o=>this.saveBoard({enabled:o.detail.checked})}></sw-toggle>
        </div></div>
      <sw-tabs .items=${a} active=${this.tab} panel="board-panel" @change=${o=>this.tab=o.detail.id}></sw-tabs>
      <div class="stack" id="board-panel">${this.tab==="general"?this.generalTab():this.tab==="display"?this.displayTab():this.noticesTab()}</div>`}generalTab(){const t=this.detail.board,s=this.draft;return l`<div class="two">
      <div class="panel"><div class="hd"><h2>${e("tabGeneral")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty&&this.nameDraft===t.name} @click=${()=>this.saveAll()}>${e("save")}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${e("bName")}</label><input id="bg-name" class="inp" maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}></div>
            <div class="fld"><label for="bg-slug">${e("bSlug")}</label><input id="bg-slug" class="inp ltr" .value=${t.slug} disabled></div></div>
          <div class="r">${this.placeField(s.place)}
            <div class="fld"><label for="bg-lang">${e("lang")}</label><select id="bg-lang" class="inp" data-v=${s.lang} @change=${a=>this.setD({lang:a.target.value})}><option value="he">עברית</option><option value="en">English</option></select></div></div>
          <dl class="kv"><dt>${e("kvTemplate")}</dt><dd>${this.summary(t)}</dd><dt>${e("bItems")}</dt><dd class="num">${this.detail.notices.length}</dd>
            <dt>${e("kvSeen")}</dt><dd>${Q(t.last_seen_at,Date.now())}</dd><dt>${e("kvCreated")}</dt><dd class="num">${(t.created_at||"").slice(0,10)}</dd>
            <dt>${e("kvRotated")}</dt><dd class="num">${(t.token_rotated_at||"").slice(0,10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${()=>this.confirmDelete=!0}>${e("deleteBoard")}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${e("bAddress")}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(t,"••••••••••••••••••••••••••••••••")}</code></div>
        <p class="hint">${e("linkOnce")} ${e("linkHint")}</p>
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:t,copy:!1}}>${e("newLink")}</sw-button></div></div>
    </div>`}placeField(t){const s=cs(this.floors);if(!s.length)return l`<div class="fld"><label for="bg-place">${e("place")}</label><input id="bg-place" class="inp" maxlength="60" .value=${t} @input=${n=>this.setD({place:n.target.value})}></div>`;const a=!!t&&!s.includes(t),o=this.placeOther||a?"__other":t;return l`<div class="fld"><label for="bg-place">${e("place")}</label>
      <select id="bg-place" class="inp" data-place-select data-v=${o} @change=${n=>{const i=n.target.value;this.placeOther=i==="__other",this.placeOther||this.setD({place:i})}}><option value="">-</option>${s.map(n=>l`<option value=${n}>${n}</option>`)}<option value="__other">${e("placeOther")}</option></select>
      ${o==="__other"?l`<input class="inp" data-place-text maxlength="60" aria-label=${e("place")} .value=${t} @input=${n=>this.setD({place:n.target.value})}>`:c}</div>`}setD(t){this.draft&&(this.draft={...this.draft,...t,blocks:{...this.draft.blocks,...t.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(t=!0){const s=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${t?"embed=1&":""}preview=${s}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(t){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:t},location.origin),this.sendToTvs&&this.detail)try{await ps(this.detail.board.id,t==="toggle"?"pause":t)}catch(s){this.say(m(s))}}displayTab(){const t=this.draft,s=[{n:1,t:e("tpl1"),dsc:e("tpl1d")},{n:2,t:e("tpl2"),dsc:e("tpl2d")},{n:3,t:e("tpl3"),dsc:e("tpl3d")}],a=t.layout==="portrait",o=this.s.settings,n=this.detail.notices.filter(i=>i.state==="active");return l`<div class="disp">
      <div class="panel"><div class="hd"><h2>${e("tplCard")}</h2><span class="sp"></span><span class="chip" data-look="acc">${e("tplLive")}</span></div>
        <div class="tpls" data-tpls>${s.map(i=>l`<button class="tpl" data-tpl=${i.n} aria-pressed=${String(t.template===i.n)} @click=${()=>this.setD({template:i.n})}>
          <div class="sch t${i.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${i.t}</b><span>${i.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${e("preview")}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${e("fullScreen")}</sw-button></div>
        <div class="prev ${a?"port":""}"><iframe data-preview title=${e("preview")} src=${this.previewSrc()} @load=${()=>this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${()=>this.cmd("prev")}>${e("prev")}</sw-button><sw-button size="sm" @click=${()=>this.cmd("toggle")}>${e("pauseToggle")}</sw-button>
          <sw-button size="sm" @click=${()=>this.cmd("next")}>${e("next")}</sw-button><label class="ck"><input type="checkbox" .checked=${this.sendToTvs} @change=${i=>this.sendToTvs=i.target.checked}>${e("sendToTvs")}</label>
          <span class="hint">${e("remoteHint")}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${e("theme")}</span><div class="seg" data-theme-seg>${["day","night","auto"].map(i=>l`<button aria-pressed=${String(t.theme===i)} @click=${()=>this.setD({theme:i})}>${e(i==="day"?"themeDay":i==="night"?"themeNight":"themeAuto")}</button>`)}</div></div>
            <div class="fld"><span class="lbl">${e("orient")}</span><div class="seg">${["auto","landscape","portrait"].map(i=>l`<button aria-pressed=${String(t.layout===i)} @click=${()=>this.setD({layout:i})}>${e(i==="auto"?"orAuto":i==="landscape"?"orLand":"orPort")}</button>`)}</div></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${e("dayHours")}</label><input id="bd-dh" class="inp ltr" placeholder="07:00-19:00" .value=${t.day_hours} @change=${i=>this.setD({day_hours:i.target.value.trim()})}><span class="hint">${e("dayHoursHint")}</span></div>
            <div class="fld"><label for="bd-fs">${e("fontSize")}</label><select id="bd-fs" class="inp" data-v=${t.font_size} @change=${i=>this.setD({font_size:i.target.value})}>
              <option value="s">${e("fsS")}</option><option value="m">${e("fsM")}</option><option value="l">${e("fsL")}</option></select></div></div>
          <div class="fld"><label class="ck"><input type="checkbox" .checked=${t.night.enabled} @change=${i=>this.setD({night:{...t.night,enabled:i.target.checked}})}>${e("nightDim")}</label>
            ${t.night.enabled?l`<div class="sum">${e("nightFrom")}<input class="inp short ltr" type="time" lang=${pt()} .value=${t.night.from} @change=${i=>this.setD({night:{...t.night,from:i.target.value}})}>
              ${e("nightTo")}<input class="inp short ltr" type="time" lang=${pt()} .value=${t.night.to} @change=${i=>this.setD({night:{...t.night,to:i.target.value}})}>
              ${e("nightLevel")}<select class="inp short" data-v=${String(t.night.dim)} @change=${i=>this.setD({night:{...t.night,dim:Number(i.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(i=>l`<option value=${String(i)}>${Math.round(i*100)}%</option>`)}</select></div>`:c}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${t.burn_in.shift} @change=${i=>this.setD({burn_in:{shift:i.target.checked}})}>${e("burnIn")}</label>
            <label class="ck"><input type="checkbox" .checked=${t.blocks.company_logo} @change=${i=>this.setD({blocks:{...t.blocks,company_logo:i.target.checked}})}>${e("companyLogo")}</label>
            <label class="ck"><input type="checkbox" checked disabled>${e("smplwiseLogo")}</label></div>
          <notice-display-design .display=${t} .defaults=${this.tv2Defaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-design>
          <notice-display-fit .display=${t} .defaults=${this.tvFitDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-fit>
          <notice-display-layout .display=${t} .defaults=${this.tvDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-layout>
          <notice-display-saver .display=${yt(t,this.tvDefaults())} @display-change=${i=>this.setD(i.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${e("whatShown")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${()=>this.saveAll()}>${e("save")}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.clock} @change=${i=>this.setD({blocks:{...t.blocks,clock:i.target.checked}})}>${e("blkClock")}</label>
            <div class="sub"><label class="ck"><input type="checkbox" .checked=${t.blocks.hebdate} @change=${i=>this.setD({blocks:{...t.blocks,hebdate:i.target.checked}})}>${e("blkHebdate")}</label>
              <label class="ck"><input type="checkbox" .checked=${t.blocks.welcome} @change=${i=>this.setD({blocks:{...t.blocks,welcome:i.target.checked}})}>${e("blkWelcome")}</label></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.weather} @change=${i=>this.setD({blocks:{...t.blocks,weather:i.target.checked}})}>${e("blkWeather")}</label>
            <div class="sub">${o.weather_entity?l`<span class="ltr mut">${o.weather_entity}</span>`:l`<span class="mut">${e("blkWeatherNoEntity")}</span>`}
              <span>${e("hoursAhead")}</span><select class="inp short" data-v=${String(t.weather.hours)} @change=${i=>this.setD({weather:{hours:Number(i.target.value)}})}>${[3,5,8].map(i=>l`<option value=${String(i)}>${i}</option>`)}</select></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.news} @change=${i=>this.setD({blocks:{...t.blocks,news:i.target.checked}})}>${e("blkNews")}</label>
            <div class="sub">${t.news.feeds.map((i,r)=>{const p=Te(i,o.news_sources);return l`<div class="feed" data-feed=${i.url}>${p.logo?l`<img class="flg" alt="" src=${p.logo}>`:l`<sw-icon name="link" size="12"></sw-icon>`}<b>${Ce(p.name)}</b>${p.known?c:l`<span class="chip">${e("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" @click=${()=>this.setD({news:{...t.news,feeds:t.news.feeds.filter((d,u)=>u!==r)}})}>${e("remove")}</sw-button></div>`})}
              <select class="inp short" data-v=${this.feedPick} @change=${i=>this.feedPick=i.target.value}><option value="">${e("feedPick")}</option>
                ${o.news_sources.filter(i=>i.enabled!==!1).map(i=>l`<option value=${i.url}>${i.name}${i.custom?" · "+e("nsCustomTag"):""}</option>`)}${o.news_custom?l`<option value="custom">${e("feedCustom")}</option>`:c}</select>
              ${this.feedPick==="custom"?l`<input class="inp ltr" placeholder="https://" .value=${this.feedUrl} @input=${i=>this.feedUrl=i.target.value}>`:c}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick||t.news.feeds.length>=6} @click=${()=>this.addFeed()}>${e("add")}</sw-button>
              <span>${e("speed")}</span><div class="seg">${["slow","normal","fast"].map(i=>l`<button aria-pressed=${String(t.news.speed===i)} @click=${()=>this.setD({news:{...t.news,speed:i}})}>${e(i==="slow"?"spSlow":i==="normal"?"spNormal":"spFast")}</button>`)}</div></div></div>
          <notice-display-info .value=${t.blocks.info} .show=${t.blocks.info_show!==!1} .sources=${o.parking_entities?{parking:o.parking_entities,gym:o.gym_entities??[]}:null} @info-show-change=${i=>this.setD({blocks:{...t.blocks,info_show:i.detail}})} @info-change=${i=>this.setD({blocks:{...t.blocks,info:i.detail}})}></notice-display-info>
          <div class="blk"><span class="ck"><b>${e("blkNotices")}</b></span><span class="hint">${n.length} ${e("kpiActive")}</span>
            <div class="sub"><span>${e("mode")}</span><div class="seg" data-mode-seg>${["rotation","all","focus"].map(i=>l`<button aria-pressed=${String(t.mode===i)} data-mode=${i} @click=${()=>this.setD({mode:i})}>${e(i==="rotation"?"modeRotation":i==="all"?"modeAll":"modeFocus")}</button>`)}</div></div>
            <div class="sub"><span>${e("rotateEvery")}</span><input class="inp short num" type="number" min="6" max="60" step="1" data-rot .value=${String(t.rotate_s)}
              @change=${i=>this.setD({rotate_s:Math.max(6,Math.min(60,Math.round(Number(i.target.value)||12)))})}><span>${e("seconds")}</span><span class="hint">${e("rotateHint")}</span></div>
            <div class="sub"><span>${e("urgent")}</span><select class="inp" data-urg data-v=${t.urgent==="band"?"stage":t.urgent} @change=${i=>this.setD({urgent:i.target.value})}>
              <option value="stage">${e("urgStage")}</option><option value="stay">${e("urgStay")}</option><option value="full">${e("urgFull")}</option></select></div>
            <div class="sub"><span>${e("hold")}</span><select class="inp" data-hold data-v=${t.hold} @change=${i=>this.setD({hold:i.target.value})}>
              <option value="">${e("holdNone")}</option>${n.map(i=>l`<option value=${i.id}>${i.title}</option>`)}</select><span class="hint">${e("holdHint")}</span></div>
            <p class="hint">${e("dwellNote")}</p></div>
          <notice-display-transit .display=${t} .v2Layout=${(i=>i.design==="v2"?i.board_layout:null)(st(t,this.tv2Defaults()))} @display-change=${i=>this.setD(i.detail)}></notice-display-transit>
          <notice-display-slides .display=${t} .lux=${["gallery","concierge","stone"].includes(st(t,this.tv2Defaults()).design)} .boardId=${this.detail.board.id} .boards=${this.boards} @display-change=${i=>this.setD(i.detail)} @slides-changed=${()=>this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`}addFeed(){const t=this.draft;if(!t)return;const s=this.feedPick,a=this.s.settings.news_sources.find(n=>n.url===s),o=a?{id:a.id,name:a.name,url:a.url}:s==="custom"&&this.feedUrl.startsWith("https://")?{name:new URL(this.feedUrl).hostname,url:this.feedUrl}:null;!o||t.news.feeds.some(n=>n.url===o.url)||(this.setD({news:{...t.news,feeds:[...t.news.feeds,o]},blocks:{...t.blocks,news:!0}}),this.feedPick="",this.feedUrl="")}noticesTab(){const t=this.detail,s=new Set(t.notices.map(i=>i.id)),a=this.notices.filter(i=>!s.has(i.id)&&(i.state==="active"||i.state==="scheduled"||i.state==="draft")),o=!!this.s?.can.manage,n=i=>o&&this.notices.some(r=>r.id===i&&r.state!=="archived"&&r.state!=="expired");return l`<div class="panel flush">
      <div class="toolbar"><h2>${e("boardNotices")}</h2><span class="chip num">${t.notices.filter(i=>i.state==="active").length} ${e("kpiActive")}</span><span class="sp"></span>
        ${a.length?l`<select class="inp short" data-add-notice @change=${i=>this.addItem(i.target.value)}><option value="">${e("addToBoard")}…</option>
          ${a.map(i=>l`<option value=${i.id}>${i.title}</option>`)}</select>`:c}
        ${o?l`<sw-button variant="primary" icon="plus" data-board-compose @click=${()=>this.newNotice(t.board.id)}>${e("newForBoard")}</sw-button>`:c}</div>
      ${t.notices.length?l`<table class="t"><thead><tr><th>${e("colState")}</th><th>${e("colNotice")}</th><th>${e("colWindow")}</th><th></th></tr></thead><tbody>
        ${t.notices.map(i=>l`<tr data-look=${i.state==="active"?ht[i.severity]:"off"} data-board-notice=${i.id}><td><span class="badge" data-look=${i.state==="active"?ht[i.severity]:"off"}>${e(hs[i.severity])}${i.pinned?" · "+e("pinned"):""}</span></td>
          <td><span class="t1">${i.title}</span></td><td class="num mut">${us(i)}</td>
          <td class="act">${n(i.id)?l`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(i.id)}>${e("edit")}</sw-button>`:c}
            <sw-button size="sm" @click=${()=>this.removeItem(i.id)}>${e("removeFromBoard")}</sw-button></td></tr>`)}</tbody></table>`:l`<sw-state-panel icon="inbox" state="empty" heading=${e("boardEmpty")}
            actionLabel=${o?e("newForBoard"):""} @action=${()=>this.newNotice(t.board.id)}></sw-state-panel>`}
    </div>`}async addItem(t){!t||!this.detail||await this.setItems([...this.detail.notices.map(s=>s.id),t])}async removeItem(t){this.detail&&await this.setItems(this.detail.notices.map(s=>s.id).filter(s=>s!==t))}async setItems(t){try{await bs(this.detail.board.id,t),this.detail=await Z(this.detail.board.id),this.say(e("saved"))}catch(s){this.say(m(s))}}async saveBoard(t){if(this.detail)try{const s=await ct(this.detail.board.id,t);this.detail={...this.detail,board:s.board},this.draft=structuredClone(s.board.display??this.draft),this.dirty=!1,this.say(e("saved")),this.loadBoards()}catch(s){this.say(m(s))}}async saveAll(){const t={};this.draft&&this.dirty&&(t.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(t.name=this.nameDraft.trim()),await this.saveBoard(t)}async rotate(t,s){try{const a=await vs(t.id);this.link={board:a.board,token:a.token,rotated:!0},this.detail?.board.id===a.board.id&&(this.detail={...this.detail,board:a.board}),this.loadBoards(),s&&navigator.clipboard?.writeText(this.linkUrl(a.board,a.token)).then(()=>this.say(e("copied")),()=>{})}catch(a){this.say(m(a))}}rotateDialog(){const t=this.confirmRotate;return l`<sw-dialog ?open=${!!t} heading=${t?e("copyAsk",{name:t.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      ${t?.legacy?l`<p data-no-stored-link>${e("noStoredLink")}</p>`:c}
      <p>${e("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${()=>{const s=this.confirmRotate;this.confirmRotate=null,s&&this.rotate(s.board,s.copy)}}>${e("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return l`<sw-dialog ?open=${this.confirmDelete} heading=${e("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${e("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${e("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await gs(this.detail.board.id),this.confirmDelete=!1,location.hash=tt,await this.loadBoards()}catch(t){this.say(m(t))}}};v.styles=[fs,ms,x,C`
      .tpls { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; }
      .tpl { font: inherit; text-align: start; display: grid; gap: 6px; padding: 10px; border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); background: var(--sw-surface-2); color: var(--sw-text); cursor: pointer; }
      .tpl[aria-pressed='true'] { border-color: var(--sw-accent); box-shadow: inset 0 0 0 1px var(--sw-accent); background: var(--sw-accent-soft); }
      .tpl b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
      .tpl span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
      .sch { aspect-ratio: 16 / 9; border-radius: var(--sw-r-sm); background: var(--sw-surface-3); display: grid; grid-template-rows: 1fr 5fr 1fr; gap: 3px; padding: 5px; }
      .sch i { display: block; border-radius: var(--sw-r-2xs); background: var(--sw-border-strong); }
      .sch .row { display: grid; gap: 3px; }
      .sch i.acc { background: var(--sw-accent); opacity: 0.6; }
      .sch.t1 .row { grid-template-columns: 6fr 4fr; }
      .sch.t2 { background: linear-gradient(180deg, var(--sw-accent-soft), var(--sw-surface-3)); }
      .sch.t2 .row { grid-template-columns: 4fr 5fr; }
      .sch.t3 { grid-template-rows: 1.4fr 3.6fr 1fr; }
      .prev { position: relative; inline-size: 100%; aspect-ratio: 16 / 9; border-radius: var(--sw-r-lg); overflow: hidden; border: 1px solid var(--sw-border); background: var(--sw-surface-3); }
      .prev.port { aspect-ratio: 9 / 16; max-inline-size: 320px; }
      .prev iframe { position: absolute; inset: 0; inline-size: 100%; block-size: 100%; border: 0; }
      .disp { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .blocks { display: grid; gap: 10px; }
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .blk:last-child { border-block-end: 0; padding-block-end: 0; }
      .blk .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .feed { display: flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); }
      .feed .flg { inline-size: 36px; block-size: 22px; object-fit: contain; background: #fff; border: 1px solid var(--sw-border); border-radius: var(--sw-r-sm, 4px); padding: 1px 3px; box-sizing: border-box; }
      .feed .u { color: var(--sw-text-3); font-size: var(--sw-fs-xs); direction: ltr; unicode-bidi: isolate; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-inline-size: 260px; }
      .link { display: flex; gap: 8px; align-items: center; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); border: 1px solid var(--sw-border); }
      .link code { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; direction: ltr; text-align: left; font-size: var(--sw-fs-xs); color: var(--sw-text); }
      .qr { background: var(--sw-surface-solid); padding: 6px; border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); line-height: 0; }
      .alert { display: flex; gap: 8px; align-items: flex-start; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
      .ctl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block-start: 8px; }
      .stack { display: grid; gap: 14px; }
      @media (max-width: 1023px) { .disp { grid-template-columns: minmax(0, 1fr); } }
      /* POLISH4-WP8: a template tile gives on pointer-down, shows hover only on a fine pointer and a focus ring on the keyboard; on a phone
         the saved / failed toast clears the bottom bar */
      .tpl { transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color); }
      .tpl:active { transform: scale(var(--sw-press-scale)); }
      .tpl:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
      @media (hover: hover) and (pointer: fine) { .tpl:hover:not([aria-pressed='true']) { border-color: var(--sw-border-strong); } }
      @media (prefers-reduced-motion: reduce) { .tpl { transition-duration: 0ms; } .tpl:active { transform: none; } }
      @media (max-width: 767px) {
        .toast { inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 16px + env(safe-area-inset-bottom, 0px)); max-inline-size: calc(100% - 32px); }
        .feed .u { max-inline-size: 100%; }
      }
    `];f([g()],v.prototype,"boardId",2);f([h()],v.prototype,"s",2);f([h()],v.prototype,"boards",2);f([h()],v.prototype,"error",2);f([h()],v.prototype,"forbidden",2);f([h()],v.prototype,"toast",2);f([h()],v.prototype,"creating",2);f([h()],v.prototype,"link",2);f([h()],v.prototype,"detail",2);f([h()],v.prototype,"tab",2);f([h()],v.prototype,"draft",2);f([h()],v.prototype,"dirty",2);f([h()],v.prototype,"nameDraft",2);f([h()],v.prototype,"notices",2);f([h()],v.prototype,"feedPick",2);f([h()],v.prototype,"feedUrl",2);f([h()],v.prototype,"confirmDelete",2);f([h()],v.prototype,"confirmRotate",2);f([h()],v.prototype,"placeOther",2);f([h()],v.prototype,"sendToTvs",2);f([h()],v.prototype,"compose",2);f([h()],v.prototype,"floors",2);f([h()],v.prototype,"groups",2);f([h()],v.prototype,"roles",2);v=f([k("system-notices")],v);export{v as SystemNotices};
//# sourceMappingURL=system-notices-Bl5HQq2m.js.map
