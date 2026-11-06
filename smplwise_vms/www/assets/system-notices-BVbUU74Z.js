import{F as g,a as y,e as l,ry as e,A as c,H as k,rz as Pt,E as R,G as u,rA as Nt,T as $,rB as zt,rC as Et,rD as Tt,rE as Ct,rF as It,rG as Rt,rH as Bt,rI as At,rJ as Ht,rK as Ut,rL as Ft,rM as jt,rN as v,rO as Wt,rP as Gt,j as yt,rQ as Mt,rR as Vt,rS as qt,rT as Z,rU as ct,rV as Yt,rW as Xt,rX as Kt,rY as Jt,rZ as Zt,r_ as Qt,cM as ts,r$ as ss,s0 as es,s1 as as,s2 as is,s3 as Q,s4 as os,s5 as pt,s6 as tt,s7 as ns,s8 as ls,s9 as rs,sa as ds,sb as cs,sc as ps,sd as hs,bP as ht,se as ut,sf as us,sg as vs,sh as bs,si as gs,sj as fs,cN as ms,rx as $s}from"./index-BKxQRAkH.js";import{_ as ws,W as ys,Z as ks,V as xs,a9 as _s,aa as kt,U as Ss,ab as Ds,ac as Os,ad as Ls,ae as Ps,af as Ns,ag as zs,ah as st,ai as Es,a2 as Ts,aj as Cs,ak as Is,al as Rs,am as Bs,an as As,ao as Hs,p as Us,ap as Fs,aq as js}from"./transit-logic-DnpTAyzC.js";import"./compose-dialog-D84-Tjwt.js";import{n as _}from"./styles-zZycbSVN.js";import{l as H}from"./live-DX8eJUDH.js";import{t as Ws,s as Gs,w as Ms,R as j,a as W,b as Vs,W as qs,c as Ys,d as z,e as G,D as M}from"./model-B8Ha5C3p.js";import"./sw-logo-art-Va6y_cIM.js";var Xs=Object.defineProperty,Ks=Object.getOwnPropertyDescriptor,xt=(t,s,a,o)=>{for(var n=o>1?void 0:o?Ks(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Xs(s,a,n),n};let V=class extends y{emit(t){this.dispatchEvent(new CustomEvent("display-change",{detail:t,bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=ws(this.display),s=ys(this.display),a=ks.map(i=>[i,e(`saver_${i}`)]),o=[["a",e("logos_a")],["b",e("logos_b")],["c",e("logos_c")]],n=xs(this.display)!=="c";return l`<div class="r">
      <div class="fld"><span class="lbl">${e("saverLabel")}</span><div class="seg" data-saver-seg>${a.map(([i,r])=>l`<button data-saver=${i} aria-pressed=${String(t===i)} @click=${()=>this.emit({saver:i})}>${r}</button>`)}</div></div>
      <div class="fld"><span class="lbl">${e("logosLabel")}</span><div class="seg" data-logos-seg>${o.map(([i,r])=>l`<button data-logos=${i} aria-pressed=${String(s===i)} ?disabled=${n} @click=${()=>this.emit({logos:i})}>${r}</button>`)}</div>
        ${n?l`<span class="hint">${e("logosOnlyHeaderC")}</span>`:c}</div>
    </div>`}};V.styles=[_];xt([g({attribute:!1})],V.prototype,"display",2);V=xt([k("notice-display-saver")],V);var Js=Object.defineProperty,Zs=Object.getOwnPropertyDescriptor,Y=(t,s,a,o)=>{for(var n=o>1?void 0:o?Zs(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Js(s,a,n),n};const Qs=[{key:"header",seg:"header",label:"headerLabel",values:Ss,text:t=>e(`header_${t}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:Ds,text:t=>e(`updated_${t}`)},{key:"space",seg:"space",label:"spaceLabel",values:Os,text:t=>e(`space_${t}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:Ls,text:t=>e(`nightLogo_${t}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:Ps,text:t=>t===0?e("weatherDays_0"):t===1?e("weatherDays_1"):e("weatherDays_n",{n:t})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:Ns,text:t=>e(`idleLogo_${t}`)}];let E=class extends y{constructor(){super(...arguments),this.defaults=_s,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a,o,n){const i=this.mode==="board",r=t.key==="space"&&a==="c"||i&&t.key==="night_logo"&&!o||i&&t.key==="weather_days"&&!n,h=t.text(this.defaults[t.key]),d=t.key==="space"&&r?e("spaceOnlyOneRow"):i&&s===null?e("tvDefaultNow",{v:h}):"";return l`<div class="fld"><span class="lbl">${e(t.label)}</span>
      <div class="seg" data-seg=${t.seg}>
        ${i?l`<button data-v="default" aria-pressed=${String(s===null)} ?disabled=${r} title=${h} @click=${()=>this.emit(t.key,null)}>${e("tvUseDefault")}</button>`:c}
        ${t.values.map(p=>l`<button data-v=${String(p)} aria-pressed=${String(s===p)} ?disabled=${r} @click=${()=>this.emit(t.key,p)}>${t.text(p)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const s=this.display??{},a=O=>t?s[O]??null:this.defaults[O],o=t?kt(s,this.defaults):this.defaults,n=!!s.blocks?.company_logo,i=!!s.blocks?.weather,[r,h,d,p,x,B]=Qs.map(O=>this.row(O,a(O.key),o.header,n,i));return l`<div class="r">${r}${h}</div><div class="r">${d}${p}</div><div class="r">${x}${B}</div>`}};E.styles=[_];Y([g({attribute:!1})],E.prototype,"display",2);Y([g({attribute:!1})],E.prototype,"defaults",2);Y([g()],E.prototype,"mode",2);E=Y([k("notice-display-layout")],E);var te=Object.defineProperty,se=Object.getOwnPropertyDescriptor,X=(t,s,a,o)=>{for(var n=o>1?void 0:o?se(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&te(s,a,n),n};const ee=[{key:"design",seg:"design",label:"designLabel",values:Es},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:Ts},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:Cs},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:Is},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:Rs},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:Bs},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:As},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:Hs}],ae={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},vt=(t,s)=>e(`${ae[t]}${s}`);let T=class extends y{constructor(){super(...arguments),this.defaults=zs,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a){const o=this.mode==="board",n=t.key==="live_bg"||t.key==="systems_status"||t.key==="urgent_screen",i=o&&t.key!=="design"&&!n&&!a,r=vt(t.key,this.defaults[t.key]),h=t.key==="board_layout"&&!o?e("boardLayoutDefaultLabel"):e(t.label),d=i?e("v2Only"):o&&s===null?e("tvDefaultNow",{v:r}):"";return l`<div class="fld"><span class="lbl">${h}</span>
      <div class="seg" data-seg=${t.seg}>
        ${o?l`<button data-v="default" aria-pressed=${String(s===null)} ?disabled=${i} title=${r} @click=${()=>this.emit(t.key,null)}>${e("tvUseDefault")}</button>`:c}
        ${t.values.map(p=>l`<button data-v=${p} aria-pressed=${String(s===p)} ?disabled=${i} @click=${()=>this.emit(t.key,p)}>${vt(t.key,p)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const s=this.display??{},a=A=>t?s[A]??null:this.defaults[A],n=(t?st(s,this.defaults):this.defaults).design==="v2",[i,r,h,d,p,x,B,O]=ee.map(A=>this.row(A,a(A.key),n));return l`<div class="r" data-tv2>${i}${r}</div><div class="r">${h}${d}</div><div class="r">${p}</div><div class="r" data-lobby>${x}${B}</div><div class="r">${O}</div>`}};T.styles=[_];X([g({attribute:!1})],T.prototype,"display",2);X([g({attribute:!1})],T.prototype,"defaults",2);X([g()],T.prototype,"mode",2);T=X([k("notice-display-design")],T);const ie=["rows","drop"],oe=[0,1,2,3,4,5],et={portrait_chips:"drop",safe_margin:0},_t=t=>t==="rows"||t==="drop",St=t=>typeof t=="number"&&Number.isInteger(t)&&t>=0&&t<=5;function ne(t,s){const a=t?.[s];return s==="portrait_chips"?_t(a)?a:null:St(a)?a:null}function le(t){return{portrait_chips:_t(t?.portrait_chips)?t.portrait_chips:et.portrait_chips,safe_margin:St(t?.safe_margin)?t.safe_margin:et.safe_margin}}function re(t,s){return t==="portrait_chips"?[s==="drop"?"portraitChips_drop":"portraitChips_rows"]:s===0?["safeMargin_0"]:["safeMargin_pct",{n:s}]}var de=Object.defineProperty,ce=Object.getOwnPropertyDescriptor,K=(t,s,a,o)=>{for(var n=o>1?void 0:o?ce(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&de(s,a,n),n};const bt=(t,s)=>{const[a,o]=re(t,s);return e(a,o)};let C=class extends y{constructor(){super(...arguments),this.defaults=et,this.mode="board"}emit(t,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:s},bubbles:!0,composed:!0}))}row(t,s,a,o,n){const i=this.mode==="board",r=i?ne(this.display,t):this.defaults[t],h=bt(t,this.defaults[t]);return l`<div class="fld" data-tv-fit=${t}><span class="lbl">${o}</span>
      <div class="seg" role="group" aria-label=${o} data-seg=${s}>
        ${i?l`<button type="button" data-v="default" aria-pressed=${String(r===null)} title=${h} @click=${()=>this.emit(t,null)}>${e("tvUseDefault")}</button>`:c}
        ${a.map(d=>l`<button type="button" data-v=${String(d)} aria-pressed=${String(r===d)} @click=${()=>this.emit(t,d)}>${bt(t,d)}</button>`)}</div>
      ${i&&r===null?l`<span class="hint" data-default-note>${e("tvDefaultNow",{v:h})}</span>`:c}
      <span class="hint">${n}</span></div>`}render(){return this.mode==="board"&&!this.display?l``:l`<div class="r" data-tv-fit-rows>
      ${this.row("portrait_chips","portrait-chips",ie,e("portraitChipsLabel"),e("portraitChipsHint"))}
      ${this.row("safe_margin","safe-margin",oe,e("safeMarginLabel"),e("safeMarginHint"))}</div>`}};C.styles=[_];K([g({attribute:!1})],C.prototype,"display",2);K([g({attribute:!1})],C.prototype,"defaults",2);K([g()],C.prototype,"mode",2);C=K([k("notice-display-fit")],C);const Dt={orderHint:"הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.",moveUp:"הזזה למעלה: {k}",moveDown:"הזזה למטה: {k}",noSource:"אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.",sourcesTitle:"מקורות לסמלי החניה וחדר הכושר",sourcesHint:"הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.",parkingLabel:"חניה",parkingHint:"מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.",gymLabel:"חדר כושר",gymHint:"מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.",pick:"בחירת ישות",add:"הוספה",remove:"הסרה",removeOne:"הסרה: {n}",none:"לא נבחרה ישות",noCandidates:"אין ישויות מתאימות",max:"עד {n} ישויות",gone:"לא נמצאה",invert:"הפוך",invertOne:"הפוך: {n}",invertParking:"הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס).",invertGym:"הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי."},pe={orderHint:"The order of this list is the order of the chips on the board and their priority: when the row has no room, a healthy chip lower in the list is hidden first. A fault stays to the end.",moveUp:"Move up: {k}",moveDown:"Move down: {k}",noSource:"No source, the chip is not shown. Pick a source in the notice-board settings.",sourcesTitle:"Sources of the parking and gym chips",sourcesHint:"The chip shows the state only (a word and a colour), never the entity name. With no entity picked the chip is not shown.",parkingLabel:"Parking",parkingHint:"A number = free spaces (summed over the entities). An occupied / free sensor = one space (on = taken). A list = its option as written.",gymLabel:"Gym",gymHint:"A switch or a schedule: on = open, off = closed. An occupancy sensor: in use / free, never a number of people. A list = its option as written.",pick:"Pick an entity",add:"Add",remove:"Remove",removeOne:"Remove: {n}",none:"No entity picked",noCandidates:"No suitable entities",max:"Up to {n} entities",gone:"Not found",invert:"Invert",invertOne:"Invert: {n}",invertParking:"Invert: for a sensor or switch where on = free (instead of on = taken).",invertGym:"Invert: for a switch or sensor where on = closed, or an occupancy sensor where on = free."},he={he:Dt,en:pe};function m(t,s,a=Pt()){const o=he[a][t]??Dt[t]??t;return s?o.replace(/\{(\w+)\}/g,(n,i)=>i in s?String(s[i]):n):o}const rt=["elevators","generator","parking","gym"],at=8,ue=t=>rt.includes(t);function dt(t){return[...new Set((t??[]).filter(ue))]}function ve(t){const s=dt(t),a=rt.filter(o=>!s.includes(o));return[...s.map((o,n)=>({kind:o,on:!0,pos:n,count:s.length})),...a.map(o=>({kind:o,on:!1,pos:-1,count:s.length}))]}function be(t,s,a){const o=dt(t).filter(n=>n!==s);return a?[...o,s]:o}function gt(t,s,a){const o=dt(t),n=o.indexOf(s),i=n+a;return n<0||i<0||i>=o.length||([o[n],o[i]]=[o[i],o[n]]),o}function ge(t,s){return!s||t!=="parking"&&t!=="gym"?!1:!s[t]?.length}function fe(t,s){return!s||t.includes(s)||t.length>=at?[...t]:[...t,s]}function me(t,s){return t.filter(a=>a!==s)}function $e(t,s){return(t??[]).filter(a=>!s.includes(a.entity_id))}const we=["binary_sensor","input_boolean","switch","schedule"];function it(t){return we.includes(t.split(".")[0]??"")}function ye(t,s,a,o){const n=new Set(s.filter(i=>i!==a));return o&&n.add(a),t.filter(i=>n.has(i)&&it(i))}function ke(t,s){return(t??[]).find(a=>a.entity_id===s)?.name??null}var xe=Object.defineProperty,_e=Object.getOwnPropertyDescriptor,J=(t,s,a,o)=>{for(var n=o>1?void 0:o?_e(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&xe(s,a,n),n};const Se={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let I=class extends y{constructor(){super(...arguments),this.value=[],this.show=!0,this.sources=null}emit(t){this.dispatchEvent(new CustomEvent("info-change",{detail:[...t],bubbles:!0,composed:!0}))}render(){const t=this.value.length>0,s=ve(this.value);return l`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${a=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:a.target.checked,bubbles:!0,composed:!0}))}>${e("infoShow")}</label>
      <p class="help" data-info-help>${e("infoOldBoards")}</p>
      <label class="ck"><input type="checkbox" .checked=${t} @change=${a=>this.emit(a.target.checked?[...rt]:[])}>${e("blkInfo")}</label>
      <ol class="ord" data-info-order>${s.map(a=>{const o=e(Se[a.kind]);return l`<li data-info-row=${a.kind} data-on=${String(a.on)}>
          <label class="ck"><input type="checkbox" data-info=${a.kind} .checked=${a.on} @change=${n=>this.emit(be(this.value,a.kind,n.target.checked))}>${o}</label>
          ${a.on?l`<button type="button" class="mv up" data-info-up=${a.kind} aria-label=${m("moveUp",{k:o})} title=${m("moveUp",{k:o})} ?disabled=${a.pos<=0}
              @click=${()=>this.emit(gt(this.value,a.kind,-1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${a.kind} aria-label=${m("moveDown",{k:o})} title=${m("moveDown",{k:o})} ?disabled=${a.pos>=a.count-1}
              @click=${()=>this.emit(gt(this.value,a.kind,1))}><sw-icon name="chevron" size="14"></sw-icon></button>`:c}
          ${a.on&&ge(a.kind,this.sources)?l`<span class="note" data-info-no-source=${a.kind}>${m("noSource")}</span>`:c}
        </li>`})}</ol>
      <p class="hint" data-info-order-hint>${e("infoIconsOnly")}. ${m("orderHint")}</p>
    </div>`}};I.styles=R`
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
  `;J([g({attribute:!1})],I.prototype,"value",2);J([g({type:Boolean})],I.prototype,"show",2);J([g({attribute:!1})],I.prototype,"sources",2);I=J([k("notice-display-info")],I);var De=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,N=(t,s,a,o)=>{for(var n=o>1?void 0:o?Oe(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&De(s,a,n),n};let D=class extends y{constructor(){super(...arguments),this.parking=[],this.gym=[],this.candidates={},this.inverted={},this.disabled=!1,this.pick={parking:"",gym:""}}emit(t,s){this.send({[`${t}_entities`]:s})}send(t){this.dispatchEvent(new CustomEvent("info-sources-change",{detail:t,bubbles:!0,composed:!0}))}one(t){const s=t==="parking"?this.parking:this.gym,a=this.candidates[t]??[],o=$e(a,s),n=s.length>=at,i=m(t==="parking"?"parkingLabel":"gymLabel"),r=this.inverted[t]??[],h=m(t==="parking"?"invertParking":"invertGym"),d=`ns-src-${t}`;return l`<div class="src fld" data-info-source=${t}>
      <label for=${d}>${i}</label>
      ${s.length?l`<ul class="picked" data-info-source-list>${s.map(p=>{const x=ke(a,p);return l`<li class=${x===null?"gone":""} data-info-source-item=${p}><span>${x??m("gone")}</span>
          ${it(p)?l`<label class="inv" title=${h}><input type="checkbox" data-info-source-invert
            aria-label=${m("invertOne",{n:x??m("gone")})} .checked=${r.includes(p)} ?disabled=${this.disabled}
            @change=${B=>this.send({[`${t}_inverted`]:ye(s,r,p,B.target.checked)})}>${m("invert")}</label>`:c}
          <button type="button" aria-label=${m("removeOne",{n:x??m("gone")})} ?disabled=${this.disabled} @click=${()=>this.emit(t,me(s,p))}>${m("remove")}</button></li>`})}</ul>`:l`<span class="mut" data-info-source-none>${m("none")}</span>`}
      <div class="row">
        <select id=${d} class="inp" data-info-source-pick .value=${this.pick[t]} ?disabled=${this.disabled||n||!o.length}
          @change=${p=>this.pick={...this.pick,[t]:p.target.value}}>
          <option value="">${o.length?m("pick"):m("noCandidates")}</option>
          ${o.map(p=>l`<option value=${p.entity_id}>${p.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled||n||!this.pick[t]}
          @click=${()=>{const p=this.pick[t];this.pick={...this.pick,[t]:""},this.emit(t,fe(s,p))}}>${m("add")}</button>
        ${n?l`<span class="mut">${m("max",{n:at})}</span>`:c}
      </div>
      <span class="hint">${m(t==="parking"?"parkingHint":"gymHint")}</span>
      ${s.some(it)?l`<span class="hint" data-info-source-invert-hint>${h}</span>`:c}
    </div>`}render(){return l`<div class="srcs" data-info-sources>
      <span class="lbl">${m("sourcesTitle")}</span>
      <span class="hint">${m("sourcesHint")}</span>
      ${this.one("parking")}
      ${this.one("gym")}
    </div>`}};D.styles=[_,R`
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
    .inv { display: inline-flex; align-items: center; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); cursor: pointer; padding-inline: 4px; }
    .inv input { margin: 0; accent-color: var(--sw-accent); }
    .inv:has(input:focus-visible) { outline: var(--sw-focus-w, 2px) solid var(--sw-focus); outline-offset: 1px; border-radius: var(--sw-r-md); }
  `];N([g({attribute:!1})],D.prototype,"parking",2);N([g({attribute:!1})],D.prototype,"gym",2);N([g({attribute:!1})],D.prototype,"candidates",2);N([g({attribute:!1})],D.prototype,"inverted",2);N([g({type:Boolean})],D.prototype,"disabled",2);N([u()],D.prototype,"pick",2);D=N([k("notice-info-sources")],D);var Le=Object.defineProperty,Pe=Object.getOwnPropertyDescriptor,S=(t,s,a,o)=>{for(var n=o>1?void 0:o?Pe(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Le(s,a,n),n};let w=class extends y{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await Nt(this.boardId)}catch(t){this.err=$(t)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(t){this.err="",this.confirming=!1,this.dlg={id:t.id,title:t.title,text:t.text,seconds:t.seconds?String(t.seconds):"",boards:[...t.boards],hasImage:t.has_image,removeImage:!1,file:null}}set(t){this.dlg&&(this.dlg={...this.dlg,...t})}async save(){const t=this.dlg;if(!t||!t.title.trim())return;const s=t.seconds.trim()===""?null:Number(t.seconds);this.busy=!0,this.err="";try{const a={title:t.title.trim(),text:t.text.trim(),seconds:s,board_ids:t.boards};let o=t.id;o?await zt(o,a):o=(await Et(a)).id,t.file?await Tt(o,t.file):t.removeImage&&t.hasImage&&await Ct(o),this.dlg=null,await this.load(),this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}async removeSlide(){const t=this.dlg;if(t?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await It(t.id),this.dlg=null,await this.load(),this.changed()}catch(s){this.err=$(s)}finally{this.busy=!1,this.confirming=!1}}}async photo(t,s=!1){this.busy=!0,this.err="";try{const a=s?t?await Rt(this.boardId,t):await Bt(this.boardId):t?await At(this.boardId,t):await Ht(this.boardId);this.doc={...this.doc??a,photo:a.photo,photo_night:a.photo_night},this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}pickBoard(t){const s=this.dlg;s&&this.set({boards:s.boards.includes(t)?s.boards.filter(a=>a!==t):[...s.boards,t]})}dialog(){const t=this.dlg;if(!t)return l`<sw-dialog></sw-dialog>`;const s=this.doc?.seconds.min??6,a=this.doc?.seconds.max??120,o=t.file?t.file.name:t.hasImage&&!t.removeImage?e("slidePicture"):e("slideNoPicture");return l`<sw-dialog open data-slide-dialog heading=${t.id?e("slideEditTitle"):e("slideNew")} @close=${()=>this.dlg=null}>
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
    </sw-dialog>`}render(){if(!this.display)return l``;const t=this.doc?.slides??[],s=this.doc?.limit??10,a=this.display.rotate_s||12,o=t.reduce((r,h)=>r+(h.seconds||a),0),n=this.doc?.photo,i=this.doc?.photo_night;return l`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(r.target.checked)}>${e("slidesBlock")}</label>
          <span class="st num" data-slides-count>${e("slidesCount",{n:t.length,s:o})}</span></div>
        <div class="slides" data-slide-grid>${t.map(r=>l`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?l`<img alt="" src=${Ut(r)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${e("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${t.length>=s} title=${e("slideLimit",{n:s})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${e("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?l`<div class="blk" data-photo-block><span class="ck"><b>${e("photoBlock")}</b></span>
        <div class="photo"><div class="th">${n?.has?l`<img alt="" data-photo-img src=${Ft(this.boardId,n.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${n?.has?e("photoReplace"):e("photoUpload")}</sw-button>
          ${n?.has?l`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${e("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const h=r.target,d=h.files?.[0];h.value="",d&&this.photo(d)}}></div>
        ${!this.dlg&&this.err?l`<p class="err" role="alert" data-photo-error>${this.err}</p>`:c}</div>`:c}
      ${this.lux?l`<div class="blk" data-photo-night-block><span class="ck"><b>${e("photoNightBlock")}</b></span><span class="hint">${e("photoNightHint")}</span>
        <div class="photo"><div class="th">${i?.has?l`<img alt="" data-photo-night-img src=${jt(this.boardId,i.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${i?.has?e("photoReplace"):e("photoUpload")}</sw-button>
          ${i?.has?l`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${e("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const h=r.target,d=h.files?.[0];h.value="",d&&this.photo(d,!0)}}></div></div>`:c}
      ${this.dialog()}`}emitPromo(t){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:t}},bubbles:!0,composed:!0}))}};w.styles=[_,R`
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
    `];S([g({attribute:!1})],w.prototype,"display",2);S([g({attribute:!1})],w.prototype,"boardId",2);S([g({type:Boolean})],w.prototype,"lux",2);S([g({attribute:!1})],w.prototype,"boards",2);S([u()],w.prototype,"doc",2);S([u()],w.prototype,"dlg",2);S([u()],w.prototype,"err",2);S([u()],w.prototype,"busy",2);S([u()],w.prototype,"confirming",2);w=S([k("notice-display-slides")],w);var Ne=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,U=(t,s,a,o)=>{for(var n=o>1?void 0:o?ze(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ne(s,a,n),n};let L=class extends y{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await Ws()}catch{this.failed=!0}}get scr(){return Us(this.display)}emit(t){const s=(this.t?.config.stops??[]).map(o=>o.code),a=Gs(this.scr,t,s);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:a},bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=this.scr,s=this.t?.config.stops??[],a=!!this.t?.config.enabled&&s.length>0,o=document.documentElement.lang?.startsWith("en")?"en":"he",n=[["side",v("lay_side"),v("lay_side_hint")],["strip",v("lay_strip"),v("lay_strip_hint")],["slide",v("lay_slide"),v("lay_slide_hint")]],i=[["auto",v("grp_auto")],["always",v("grp_always")],["never",v("grp_never")]],r=Ms(t.window_min),h=t.stops.length?t.stops:s.map(d=>d.code);return l`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${t.enabled} @change=${d=>this.emit({enabled:d.target.checked})}><b>${v("scrTitle")}</b> - ${v("scrShow")}</label>
      ${a?c:l`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?v("forbiddenHint"):v("scrOffModule")}</span>
        <a href="#/system/transit">${v("scrGo")}</a></div>`}
      ${t.enabled&&a?l`
        <div class="sub" data-transit-stops>
          <span>${v("scrStops")}</span>
          ${s.map(d=>l`<label class="ck"><input type="checkbox" data-transit-stop=${d.code} .checked=${H(h.includes(d.code))}
            @change=${()=>this.emit({stops:Vs(t.stops,d.code,s.map(p=>p.code))})}>${d.name||d.catalogue_name||d.code}</label>`)}
          ${t.stops.length===0?l`<span class="hint">${v("scrStopsAll")}</span>`:c}
        </div>
        ${this.v2Layout?c:l`<div class="sub"><span>${v("scrLayout")}</span><div class="seg" data-transit-layout>${n.map(([d,p,x])=>l`<button data-layout=${d} title=${x} aria-pressed=${String(t.layout===d)} @click=${()=>this.emit({layout:d})}>${p}</button>`)}</div></div>`}
        <div class="sub"><span>${v("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(t.window_min):"free"} @change=${d=>{const p=d.target.value;this.emit({window_min:p==="free"?45:Number(p)})}}>${qs.map(d=>l`<option value=${String(d)} ?selected=${r==="list"&&t.window_min===d}>${Ys(d,o)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${v("scrWindowFree")}</option></select>
          ${r==="free"?l`<input class="inp short num" type="number" data-transit-window-free min=${z[0]} max=${z[1]} step="1" .value=${H(String(t.window_min))}
            title=${v("scrFree",{a:z[0],b:z[1]})}
            @change=${d=>this.emit({window_min:G(d.target.value,z[0],z[1],t.window_min)})}>`:c}
        </div>
        <div class="sub"><span>${v("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${j[0]} max=${j[1]} step="1" .value=${H(String(t.rows))}
          @change=${d=>this.emit({rows:G(d.target.value,j[0],j[1],t.rows)})}>
          <span>${v("scrGroup")}</span><select class="inp" data-transit-group .value=${t.group} @change=${d=>this.emit({group:d.target.value})}>
            ${i.map(([d,p])=>l`<option value=${d} ?selected=${t.group===d}>${p}</option>`)}</select></div>
        <div class="sub"><span>${v("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${W[0]} max=${W[1]} step="1"
          placeholder=${v("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${H(t.refresh_s==null?"":String(t.refresh_s))}
          @change=${d=>{const p=d.target.value.trim();this.emit({refresh_s:p===""?null:G(p,W[0],W[1],20)})}}>
          <span>${v("scrDistance")}</span><select class="inp" data-transit-distance .value=${t.show_distance==null?"inherit":t.show_distance?"on":"off"} @change=${d=>{const p=d.target.value;this.emit({show_distance:p==="inherit"?null:p==="on"})}}>${[["inherit",v("scrDistInherit")],["on",v("scrDistOn")],["off",v("scrDistOff")]].map(([d,p])=>l`<option value=${d} ?selected=${(t.show_distance==null?"inherit":t.show_distance?"on":"off")===d}>${p}</option>`)}</select></div>
        ${(this.v2Layout??t.layout)==="slide"?l`<div class="sub"><span>${v("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${M[0]} max=${M[1]} step="1" .value=${H(String(t.dwell_s))}
          @change=${d=>this.emit({dwell_s:G(d.target.value,M[0],M[1],t.dwell_s)})}></div>`:c}
      `:c}
    </div>`}};L.styles=[_,R`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];U([g({attribute:!1})],L.prototype,"display",2);U([g({attribute:!1})],L.prototype,"v2Layout",2);U([u()],L.prototype,"t",2);U([u()],L.prototype,"failed",2);L=U([k("notice-display-transit")],L);const ot=40,nt=12,Ee="image/png,image/jpeg",Te=3e5;function ft(t){return t.map(s=>({id:s.id,name:s.name,url:s.url,enabled:s.enabled!==!1,has_logo:!!s.has_logo,logo_url:s.logo_url||"",custom:!!s.custom}))}function Ce(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1}}function Ie(t){const s=t.trim();if(!s||s.length>400||/[\s\\]/.test(s))return!1;let a;try{a=new URL(s)}catch{return!1}if(a.protocol!=="https:"||a.username||a.password||a.port&&a.port!=="443")return!1;const o=a.hostname.toLowerCase();return!o.includes(".")||o==="localhost"||o.endsWith(".local")||o.endsWith(".localhost")||o.endsWith(".internal")?!1:/^[0-9.]+$/.test(o)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(o):!o.startsWith("[")}function Ot(t){const s=new Set;return t.map(a=>{const o=a.name.trim();if(!o||o.length>ot)return"name";if(!Ie(a.url))return"url";const n=a.url.trim();return s.has(n)?"dup":(s.add(n),"")})}function mt(t){return t.length<=nt&&Ot(t).every(s=>s==="")}function $t(t,s,a){if(s===a||s<0||a<0||s>=t.length||a>=t.length)return t;const o=t.slice();return o.splice(a,0,o.splice(s,1)[0]),o}function lt(t){return t.map(s=>({...s.id?{id:s.id}:{},name:s.name.trim(),url:s.url.trim(),enabled:s.enabled}))}function wt(t,s){return JSON.stringify(lt(t))!==JSON.stringify(lt(s))||t.some(a=>a.custom)}function Re(t,s){const a=s.find(o=>t.id&&o.id===t.id||o.url===t.url);return a?{name:a.name,logo:a.logo_url||"",known:!a.custom}:{name:t.name,logo:"",known:!1}}function Be(t,s=24){const a=t.trim();return a.length<=s?a:a.slice(0,s-1)+"…"}var Ae=Object.defineProperty,He=Object.getOwnPropertyDescriptor,F=(t,s,a,o)=>{for(var n=o>1?void 0:o?He(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ae(s,a,n),n};let P=class extends y{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=ft(this.sources),(!wt(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(t=>({...t}))))}say(t){this.dispatchEvent(new CustomEvent("ns-message",{detail:t,bubbles:!0,composed:!0}))}applyAnswer(t,s){const a=this.rows;this.fromProp=t.sources,this.saved=ft(t.sources),this.rows=s?this.saved.map(o=>{const n=a.find(i=>i.id===o.id);return n?{...n,has_logo:o.has_logo,logo_url:o.logo_url,custom:o.custom}:{...o}}).concat(a.filter(o=>!o.id)):this.saved.map(o=>({...o})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:t.sources,bubbles:!0,composed:!0}))}set(t,s){this.rows=this.rows.map((a,o)=>o===t?{...a,...s}:a)}async save(){if(!(this.busy||!mt(this.rows))){this.busy=!0;try{this.applyAnswer(await Wt(lt(this.rows)),!1),this.say(e("nsSaved"))}catch(t){this.say($(t))}finally{this.busy=!1}}}async logo(t,s){const a=this.rows[t];if(!(!s||!a?.id||this.busy)){if(s.size>Te){this.say(e("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await Gt(a.id,s),!0)}catch(o){this.say(o instanceof yt&&o.status===422?e("nsLogoFile"):$(o))}finally{this.busy=!1}}}async dropLogo(t){const s=this.rows[t];if(!(!s?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Mt(s.id),!0)}catch(a){this.say($(a))}finally{this.busy=!1}}}rowHtml(t,s,a){const o=this.rows.length-1,n=!!t.id&&!this.busy,i=t.has_logo?e("nsLogoReplace"):e("nsLogoUpload");return l`<div class="row" data-ns-row=${t.id||"new"} data-off=${t.enabled?"0":"1"} data-bad=${a?"1":"0"}>
      <div class="lg" data-ns-logo>${t.has_logo&&t.logo_url?l`<img alt="" src=${t.logo_url}>`:l`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${ot} .value=${t.name} placeholder=${e("nsName")} aria-label=${e("nsName")} @input=${r=>this.set(s,{name:r.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${t.url} placeholder="https://" aria-label=${e("nsUrl")} @input=${r=>this.set(s,{url:r.target.value})}>
      <div class="tools">
        ${t.custom?l`<span class="chip">${e("nsCustomTag")}</span>`:c}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${t.enabled} @change=${r=>this.set(s,{enabled:r.target.checked})}>${e("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!n} title=${t.id?i:e("nsLogoSaveFirst")} aria-label=${i}
          @click=${r=>r.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${Ee} @change=${r=>{const h=r.target;this.logo(s,h.files?.[0]),h.value=""}}>
        ${t.has_logo?l`<button class="ib" type="button" data-ns-logo-del ?disabled=${!n} title=${e("nsLogoRemove")} aria-label=${e("nsLogoRemove")} @click=${()=>this.dropLogo(s)}><sw-icon name="close" size="14"></sw-icon></button>`:c}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${s===0} title=${e("nsUp")} aria-label=${e("nsUp")} @click=${()=>this.rows=$t(this.rows,s,s-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${s===o} title=${e("nsDown")} aria-label=${e("nsDown")} @click=${()=>this.rows=$t(this.rows,s,s+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${e("nsDelete")} aria-label=${e("nsDelete")} @click=${()=>this.rows=this.rows.filter((r,h)=>h!==s)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${a?l`<span class="err" data-ns-err=${a}>${a==="name"?e("nsErrName",{n:ot}):a==="url"?e("nsErrUrl"):e("nsErrDup")}</span>`:c}
    </div>`}render(){const t=Ot(this.rows),s=wt(this.rows,this.saved);return l`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${e("nsCard")}</h2><span class="chip num">${e("nsCount",{n:this.rows.length,m:nt})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=nt} @click=${()=>this.rows=[...this.rows,Ce()]}>${e("nsAdd")}</sw-button></div>
      ${this.rows.length?l`<div class="list" data-ns-list>${this.rows.map((a,o)=>this.rowHtml(a,o,t[o]))}</div>`:l`<span class="mut">${e("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${s?l`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(a=>({...a}))}>${e("nsDiscard")}</sw-button>`:c}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!s||!mt(this.rows)||this.busy} @click=${()=>this.save()}>${e("nsSave")}</sw-button></div>
    </div>`}};P.styles=[_,R`
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
    `];F([g({attribute:!1})],P.prototype,"sources",2);F([u()],P.prototype,"rows",2);F([u()],P.prototype,"saved",2);F([u()],P.prototype,"busy",2);P=F([k("notice-news-sources")],P);var Ue=Object.defineProperty,Fe=Object.getOwnPropertyDescriptor,Lt=(t,s,a,o)=>{for(var n=o>1?void 0:o?Fe(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&Ue(s,a,n),n};let q=class extends y{constructor(){super(...arguments),this.value="hide"}render(){return l`<div class="fld"><label for="ns-home-empty">${e("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${t=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:t.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${e("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${e("dHomeEmptyLine")}</option></select></div>`}};q.styles=[_];Lt([g()],q.prototype,"value",2);q=Lt([k("notice-home-empty")],q);var je=Object.defineProperty,We=Object.getOwnPropertyDescriptor,f=(t,s,a,o)=>{for(var n=o>1?void 0:o?We(s,a):s,i=t.length-1,r;i>=0;i--)(r=t[i])&&(n=(o?r(s,a,n):r(n))||n);return o&&n&&je(s,a,n),n};let b=class extends y{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(t){t.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(t=>{t.value!==t.dataset.v&&(t.value=t.dataset.v??"")})}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Vt(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(t){t instanceof yt&&t.status===403?this.forbidden=!0:this.error=$(t)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{this.boards=(await qt()).boards}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await Z(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await ct("all")).notices}catch{this.notices=[]}}catch(t){this.error=$(t)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const t=await Yt();this.floors=t.floors,this.groups=t.groups,this.roles=t.roles}catch{}}}newNotice(t=""){const s=this.s.settings;this.compose=t?Xt(new Date,s.default_days,s.default_severity,t):Kt(new Date,s.default_days,s.default_severity)}editNotice(t){const s=this.notices.find(a=>a.id===t);s&&(this.compose=Jt(s))}async composed(t){this.compose=null,this.say(t.detail.message);try{this.notices=(await ct("all")).notices}catch{}if(this.detail)try{this.detail=await Z(this.detail.board.id)}catch(s){this.say($(s))}this.loadBoards()}composeDialog(){return l`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${t=>this.composed(t)}></notice-compose>`}async patchSettings(t,s=e("saved")){try{const a=await Zt(t);this.s&&(this.s={...this.s,settings:a.settings}),"enabled"in t&&(Qt(a.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(s)}catch(a){this.say($(a))}}render(){return this.forbidden?l`<sw-page heading=${e("setTitle")}><sw-state-panel state="forbidden" heading=${e("forbidden")} hint=${e("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?l`<sw-page heading=${e("setTitle")}><sw-state-panel state="error" heading=${e("saveError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?l`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast?l`<div class="toast" role="status" ${ts()}>${this.toast}</div>`:c}`:l`<sw-page heading=${e("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const t=this.s,s=t.settings,a=t.can;return l`
      <div class="top"><div><h1>${e("setTitle")}</h1><p class="sub">${e("setSub")}</p></div><span class="sp"></span>
        ${s.enabled&&a.manage?l`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=ss}>${e("allNotices")}</sw-button>
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
      ${s.enabled&&a.boards?this.tvDefaultsCard():c}`}tvDefaults(){return Fs(this.s?.settings.tv_defaults)}tvDefaultsCard(){return l`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${e("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${e("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return js(this.s?.settings.tv2_defaults)}tvFitDefaults(){return le(this.s?.settings.tv2_defaults)}async saveTvDefaults(t){try{const s=await es(t);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:s.tv_defaults,...s.tv2_defaults?{tv2_defaults:s.tv2_defaults}:{}}}),this.say(e("saved"))}catch(s){this.say($(s))}}defaultsCard(){const t=this.s,s=t.settings;return l`<div class="panel" data-defaults-card><div class="hd"><h2>${e("defaultsCard")}</h2></div><div class="form">
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
          ${as(s.retention_days).map(a=>l`<option value=${String(a.value)}>${a.label}</option>`)}</select></div>
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
        .inverted=${{parking:s.parking_inverted??[],gym:s.gym_inverted??[]}}
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
    </div></div>`}seenBadge(t){const s=is(t,Date.now()),a=s==="online"?"ok":s==="off"?"off":"unk",o=s==="online"?e("bOnline"):s==="off"?e("bDisabled"):s==="never"?e("bNever"):e("bIdle");return l`<span class="badge" data-look=${a}>${o}</span>`}summary(t){const s=t.display;if(!s)return"";const a=e(s.template===1?"tpl1":s.template===2?"tpl2":"tpl3"),o=e(s.theme==="day"?"themeDay":s.theme==="night"?"themeNight":"orAuto");return`${a} · ${o} · ${s.rotate_s} ${e("seconds")}`}boardsTable(){return l`<table class="t"><thead><tr><th>${e("bState")}</th><th>${e("bName")}</th><th>${e("bAddress")}</th><th>${e("bItems")}</th><th>${e("bSeen")}</th><th></th></tr></thead><tbody>
      ${this.boards.map(t=>l`<tr class="go" tabindex="0" data-board=${t.slug} @click=${()=>this.goBoard(t)} @keydown=${s=>s.key==="Enter"&&this.goBoard(t)}>
        <td>${this.seenBadge(t)}</td><td><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></td>
        <td class="ltr mut">/b/${t.slug}</td><td class="num">${t.item_count??0}</td><td class="num mut">${Q(t.last_seen_at,Date.now())}</td>
        <td class="act">${this.rowActions(t)}</td></tr>`)}
      </tbody></table>`}rowActions(t){const s=a=>o=>{o.stopPropagation(),a()};return l`${t.enabled?c:l`<sw-button size="sm" data-activate @click=${s(()=>void this.activate(t))}>${e("activate")}</sw-button>`}
      ${this.canCopyLink()?l`<sw-button size="sm" data-copy-link @click=${s(()=>void this.copyLink(t))}>${e("copyLink")}</sw-button>`:c}
      <sw-button size="sm" @click=${s(()=>this.goBoard(t))}>${e("open")}</sw-button>`}canCopyLink(){const t=this.s?.can;return!!(t?.configure&&t.boards)}async copyLink(t){if(!t.has_stored_link){this.confirmRotate={board:t,copy:!0,legacy:!0};return}try{const s=await os(t.id);this.link={board:t,token:s.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(t,s.token)).then(()=>this.say(e("copied")),()=>{})}catch(s){this.say($(s))}}async activate(t){try{await pt(t.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===t.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(e("saved"))}catch(s){this.say($(s))}}boardCard(t){return l`<div class="card" @click=${()=>this.goBoard(t)}><div class="row">${this.seenBadge(t)}<span class="ltr mut">/b/${t.slug}</span></div><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></div>`}goBoard(t){location.hash=`${tt}/${encodeURIComponent(t.id)}`}openCreate(){this.creating={name:"",slug:ns("board",this.boards.map(t=>t.slug)),err:""}}createDialog(){const t=this.creating;return l`<sw-dialog ?open=${!!t} heading=${e("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${t?l`<div class="form">
        <div class="fld"><label for="nb-name">${e("bName")}</label><input id="nb-name" class="inp" maxlength="60" .value=${t.name} @input=${s=>this.creating={...t,name:s.target.value,err:""}}></div>
        <div class="fld"><label for="nb-slug">${e("bSlug")}</label><input id="nb-slug" class="inp ltr" maxlength="40" .value=${t.slug} @input=${s=>this.creating={...t,slug:s.target.value.toLowerCase(),err:""}}><span class="hint">${e("bSlugHint")}</span></div>
        ${t.err?l`<span class="err" role="alert">${t.err}</span>`:c}</div>`:c}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${e("newBoard")}</sw-button></sw-dialog>`}async create(){const t=this.creating;if(t){if(!t.name.trim()){this.creating={...t,err:e("bName")};return}if(!ls(t.slug)){this.creating={...t,err:e("bSlugHint")};return}try{const s=await rs({name:t.name.trim(),slug:t.slug});this.creating=null,this.link={board:s.board,token:s.token,rotated:!1},await this.loadBoards()}catch(s){this.creating={...t,err:$(s)}}}}linkUrl(t,s){return ds(t.slug,s,this.s?.settings.boards_origin||void 0)}linkDialog(){const t=this.link,s=t?this.linkUrl(t.board,t.token):"";return l`<sw-dialog ?open=${!!t} heading=${t?e("linkTitle",{name:t.board.name}):""} subheading=${t?.rotated?e("linkSub"):e("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${t?l`<div class="form">
        <div class="link"><code data-board-link>${s}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(s)}>${e("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${cs(s,148)}</div><p class="hint">${e("linkHint")}</p></div>
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
        ${t.has_stored_link===!1?l`<p class="hint" data-link-pending>${e("linkPending")}</p>`:c}
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:t,copy:!1}}>${e("newLink")}</sw-button></div></div>
    </div>`}placeField(t){const s=ps(this.floors);if(!s.length)return l`<div class="fld"><label for="bg-place">${e("place")}</label><input id="bg-place" class="inp" maxlength="60" .value=${t} @input=${n=>this.setD({place:n.target.value})}></div>`;const a=!!t&&!s.includes(t),o=this.placeOther||a?"__other":t;return l`<div class="fld"><label for="bg-place">${e("place")}</label>
      <select id="bg-place" class="inp" data-place-select data-v=${o} @change=${n=>{const i=n.target.value;this.placeOther=i==="__other",this.placeOther||this.setD({place:i})}}><option value="">-</option>${s.map(n=>l`<option value=${n}>${n}</option>`)}<option value="__other">${e("placeOther")}</option></select>
      ${o==="__other"?l`<input class="inp" data-place-text maxlength="60" aria-label=${e("place")} .value=${t} @input=${n=>this.setD({place:n.target.value})}>`:c}</div>`}setD(t){this.draft&&(this.draft={...this.draft,...t,blocks:{...this.draft.blocks,...t.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(t=!0){const s=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${t?"embed=1&":""}preview=${s}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(t){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:t},location.origin),this.sendToTvs&&this.detail)try{await hs(this.detail.board.id,t==="toggle"?"pause":t)}catch(s){this.say($(s))}}displayTab(){const t=this.draft,s=[{n:1,t:e("tpl1"),dsc:e("tpl1d")},{n:2,t:e("tpl2"),dsc:e("tpl2d")},{n:3,t:e("tpl3"),dsc:e("tpl3d")}],a=t.layout==="portrait",o=this.s.settings,n=this.detail.notices.filter(i=>i.state==="active");return l`<div class="disp">
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
            ${t.night.enabled?l`<div class="sum">${e("nightFrom")}<input class="inp short ltr" type="time" lang=${ht()} .value=${t.night.from} @change=${i=>this.setD({night:{...t.night,from:i.target.value}})}>
              ${e("nightTo")}<input class="inp short ltr" type="time" lang=${ht()} .value=${t.night.to} @change=${i=>this.setD({night:{...t.night,to:i.target.value}})}>
              ${e("nightLevel")}<select class="inp short" data-v=${String(t.night.dim)} @change=${i=>this.setD({night:{...t.night,dim:Number(i.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(i=>l`<option value=${String(i)}>${Math.round(i*100)}%</option>`)}</select></div>`:c}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${t.burn_in.shift} @change=${i=>this.setD({burn_in:{shift:i.target.checked}})}>${e("burnIn")}</label>
            <label class="ck"><input type="checkbox" .checked=${t.blocks.company_logo} @change=${i=>this.setD({blocks:{...t.blocks,company_logo:i.target.checked}})}>${e("companyLogo")}</label>
            <label class="ck"><input type="checkbox" checked disabled>${e("smplwiseLogo")}</label></div>
          <notice-display-design .display=${t} .defaults=${this.tv2Defaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-design>
          <notice-display-fit .display=${t} .defaults=${this.tvFitDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-fit>
          <notice-display-layout .display=${t} .defaults=${this.tvDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-layout>
          <notice-display-saver .display=${kt(t,this.tvDefaults())} @display-change=${i=>this.setD(i.detail)}></notice-display-saver>
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
            <div class="sub">${t.news.feeds.map((i,r)=>{const h=Re(i,o.news_sources);return l`<div class="feed" data-feed=${i.url}>${h.logo?l`<img class="flg" alt="" src=${h.logo}>`:l`<sw-icon name="link" size="12"></sw-icon>`}<b>${Be(h.name)}</b>${h.known?c:l`<span class="chip">${e("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" @click=${()=>this.setD({news:{...t.news,feeds:t.news.feeds.filter((d,p)=>p!==r)}})}>${e("remove")}</sw-button></div>`})}
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
        ${t.notices.map(i=>l`<tr data-look=${i.state==="active"?ut[i.severity]:"off"} data-board-notice=${i.id}><td><span class="badge" data-look=${i.state==="active"?ut[i.severity]:"off"}>${e(us[i.severity])}${i.pinned?" · "+e("pinned"):""}</span></td>
          <td><span class="t1">${i.title}</span></td><td class="num mut">${vs(i)}</td>
          <td class="act">${n(i.id)?l`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(i.id)}>${e("edit")}</sw-button>`:c}
            <sw-button size="sm" @click=${()=>this.removeItem(i.id)}>${e("removeFromBoard")}</sw-button></td></tr>`)}</tbody></table>`:l`<sw-state-panel icon="inbox" state="empty" heading=${e("boardEmpty")}
            actionLabel=${o?e("newForBoard"):""} @action=${()=>this.newNotice(t.board.id)}></sw-state-panel>`}
    </div>`}async addItem(t){!t||!this.detail||await this.setItems([...this.detail.notices.map(s=>s.id),t])}async removeItem(t){this.detail&&await this.setItems(this.detail.notices.map(s=>s.id).filter(s=>s!==t))}async setItems(t){try{await bs(this.detail.board.id,t),this.detail=await Z(this.detail.board.id),this.say(e("saved"))}catch(s){this.say($(s))}}async saveBoard(t){if(this.detail)try{const s=await pt(this.detail.board.id,t);this.detail={...this.detail,board:s.board},this.draft=structuredClone(s.board.display??this.draft),this.dirty=!1,this.say(e("saved")),this.loadBoards()}catch(s){this.say($(s))}}async saveAll(){const t={};this.draft&&this.dirty&&(t.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(t.name=this.nameDraft.trim()),await this.saveBoard(t)}async rotate(t,s){try{const a=await gs(t.id);this.link={board:a.board,token:a.token,rotated:!0},this.detail?.board.id===a.board.id&&(this.detail={...this.detail,board:a.board}),this.loadBoards(),s&&navigator.clipboard?.writeText(this.linkUrl(a.board,a.token)).then(()=>this.say(e("copied")),()=>{})}catch(a){this.say($(a))}}rotateDialog(){const t=this.confirmRotate;return l`<sw-dialog ?open=${!!t} heading=${t?e("copyAsk",{name:t.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      ${t?.legacy?l`<p data-no-stored-link>${e("noStoredLink")}</p>`:c}
      <p>${e("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${()=>{const s=this.confirmRotate;this.confirmRotate=null,s&&this.rotate(s.board,s.copy)}}>${e("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return l`<sw-dialog ?open=${this.confirmDelete} heading=${e("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${e("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${e("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${e("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await fs(this.detail.board.id),this.confirmDelete=!1,location.hash=tt,await this.loadBoards()}catch(t){this.say($(t))}}};b.styles=[ms,$s,_,R`
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
    `];f([g()],b.prototype,"boardId",2);f([u()],b.prototype,"s",2);f([u()],b.prototype,"boards",2);f([u()],b.prototype,"error",2);f([u()],b.prototype,"forbidden",2);f([u()],b.prototype,"toast",2);f([u()],b.prototype,"creating",2);f([u()],b.prototype,"link",2);f([u()],b.prototype,"detail",2);f([u()],b.prototype,"tab",2);f([u()],b.prototype,"draft",2);f([u()],b.prototype,"dirty",2);f([u()],b.prototype,"nameDraft",2);f([u()],b.prototype,"notices",2);f([u()],b.prototype,"feedPick",2);f([u()],b.prototype,"feedUrl",2);f([u()],b.prototype,"confirmDelete",2);f([u()],b.prototype,"confirmRotate",2);f([u()],b.prototype,"placeOther",2);f([u()],b.prototype,"sendToTvs",2);f([u()],b.prototype,"compose",2);f([u()],b.prototype,"floors",2);f([u()],b.prototype,"groups",2);f([u()],b.prototype,"roles",2);b=f([k("system-notices")],b);export{b as SystemNotices};
//# sourceMappingURL=system-notices-BVbUU74Z.js.map
