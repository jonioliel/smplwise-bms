import{ax as g,i as k,b as n,jR as s,A as p,k as _,bG as Le,bH as Pe,cE as Ee,zL as Ne,g as R,j as u,zM as Te,n as $,zN as Ce,zO as Ie,zP as Ae,zQ as Re,zR as Be,zS as He,zT as Ue,zU as je,zV as Fe,zW as We,zX as Me,zY as Ge,dH as H,zZ as Ve,z_ as qe,a as ye,z$ as Ye,A0 as Xe,sE as Ke,A1 as J,sD as pe,sF as Qe,A2 as Je,sR as Ze,sQ as et,A3 as tt,A4 as st,e1 as at,A5 as it,A6 as ot,A7 as lt,A8 as nt,A9 as Z,Aa as rt,Ab as he,sG as ee,Ac as dt,Ad as ct,Ae as pt,Af as ht,Ag as ut,Ah as vt,ej as ue,j_ as bt,sO as gt,sL as ft,Ai as mt,Aj as $t,Ak as wt,bh as yt}from"./index-CPuzFb4-.js";import{a as kt}from"./settings-BBKucUsS.js";import"./sw-table-8Ffab9oO.js";import{qrSvg as _t}from"./sw-second-factor-BExvw44f.js";import{$ as xt,X as St,_ as Dt,W as Ot,aa as zt,ab as ke,V as Lt,ac as Pt,ad as Et,ae as Nt,af as Tt,ag as Ct,ah as It,ai as te,aj as At,a3 as Rt,ak as Bt,al as Ht,am as Ut,an as jt,ao as Ft,ap as Wt,q as Mt,aq as Gt,ar as Vt}from"./transit-logic-C-J7tGXg.js";import"./compose-dialog-C8r7tM9h.js";import{n as x}from"./styles-DzdZ29NI.js";import{t as qt,i as Yt,b as v,w as Xt,R as F,j as W,k as Kt,W as Qt,l as Jt,n as N,f as M,D as G}from"./model-DxWrLNtq.js";import{a as Zt}from"./activate-keys-CrBsenYs.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";var es=Object.defineProperty,ts=Object.getOwnPropertyDescriptor,_e=(e,t,a,o)=>{for(var l=o>1?void 0:o?ts(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&es(t,a,l),l};let V=class extends k{emit(e){this.dispatchEvent(new CustomEvent("display-change",{detail:e,bubbles:!0,composed:!0}))}render(){if(!this.display)return n``;const e=xt(this.display),t=St(this.display),a=Dt.map(i=>[i,s(`saver_${i}`)]),o=[["a",s("logos_a")],["b",s("logos_b")],["c",s("logos_c")]],l=Ot(this.display)!=="c";return n`<div class="r">
      <div class="fld"><span class="lbl">${s("saverLabel")}</span><sw-segmented data-saver-seg value=${e} @change=${i=>this.emit({saver:i.detail.value})}
        .options=${a.map(([i,r])=>({value:i,label:r,attrs:{"data-saver":i}}))}></sw-segmented></div>
      <div class="fld"><span class="lbl">${s("logosLabel")}</span><sw-segmented data-logos-seg value=${t} ?disabled=${l} @change=${i=>this.emit({logos:i.detail.value})}
        .options=${o.map(([i,r])=>({value:i,label:r,attrs:{"data-logos":i}}))}></sw-segmented>
        ${l?n`<span class="hint">${s("logosOnlyHeaderC")}</span>`:p}</div>
    </div>`}};V.styles=[x];_e([g({attribute:!1})],V.prototype,"display",2);V=_e([_("notice-display-saver")],V);var ss=Object.defineProperty,as=Object.getOwnPropertyDescriptor,Y=(e,t,a,o)=>{for(var l=o>1?void 0:o?as(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&ss(t,a,l),l};const is=[{key:"header",seg:"header",label:"headerLabel",values:Lt,text:e=>s(`header_${e}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:Pt,text:e=>s(`updated_${e}`)},{key:"space",seg:"space",label:"spaceLabel",values:Et,text:e=>s(`space_${e}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:Nt,text:e=>s(`nightLogo_${e}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:Tt,text:e=>e===0?s("weatherDays_0"):e===1?s("weatherDays_1"):s("weatherDays_n",{n:e})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:Ct,text:e=>s(`idleLogo_${e}`)}];let T=class extends k{constructor(){super(...arguments),this.defaults=zt,this.mode="board"}emit(e,t){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:t},bubbles:!0,composed:!0}))}row(e,t,a,o,l){const i=this.mode==="board",r=e.key==="space"&&a==="c"||i&&e.key==="night_logo"&&!o||i&&e.key==="weather_days"&&!l,d=e.text(this.defaults[e.key]),c=e.key==="space"&&r?s("spaceOnlyOneRow"):i&&t===null?s("tvDefaultNow",{v:d}):"";return n`<div class="fld"><span class="lbl">${s(e.label)}</span>
      <sw-segmented label=${s(e.label)} data-seg=${e.seg} value=${t===null?"__default__":String(t)} ?disabled=${r}
        @change=${h=>{if(h.detail.value==="__default__")this.emit(e.key,null);else{const w=e.values.find(O=>String(O)===h.detail.value);w!==void 0&&this.emit(e.key,w)}}}
        .options=${[...i?[{value:"__default__",label:s("tvUseDefault"),title:d,attrs:{"data-v":"default"}}]:[],...e.values.map(h=>({value:String(h),label:e.text(h),attrs:{"data-v":String(h)}}))]}></sw-segmented>
      ${c?n`<span class="hint" data-default-note>${c}</span>`:p}</div>`}render(){const e=this.mode==="board";if(e&&!this.display)return n``;const t=this.display??{},a=z=>e?t[z]??null:this.defaults[z],o=e?ke(t,this.defaults):this.defaults,l=!!t.blocks?.company_logo,i=!!t.blocks?.weather,[r,d,c,h,w,O]=is.map(z=>this.row(z,a(z.key),o.header,l,i));return n`<div class="r">${r}${d}</div><div class="r">${c}${h}</div><div class="r">${w}${O}</div>`}};T.styles=[x];Y([g({attribute:!1})],T.prototype,"display",2);Y([g({attribute:!1})],T.prototype,"defaults",2);Y([g()],T.prototype,"mode",2);T=Y([_("notice-display-layout")],T);var os=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,X=(e,t,a,o)=>{for(var l=o>1?void 0:o?ls(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&os(t,a,l),l};const ns=[{key:"design",seg:"design",label:"designLabel",values:At},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:Rt},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:Bt},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:Ht},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:Ut},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:jt},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:Ft},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:Wt}],rs={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},ve=(e,t)=>s(`${rs[e]}${t}`);let C=class extends k{constructor(){super(...arguments),this.defaults=It,this.mode="board"}emit(e,t){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:t},bubbles:!0,composed:!0}))}row(e,t,a){const o=this.mode==="board",l=e.key==="live_bg"||e.key==="systems_status"||e.key==="urgent_screen",i=o&&e.key!=="design"&&!l&&!a,r=ve(e.key,this.defaults[e.key]),d=e.key==="board_layout"&&!o?s("boardLayoutDefaultLabel"):s(e.label),c=i?s("v2Only"):o&&t===null?s("tvDefaultNow",{v:r}):"";return n`<div class="fld"><span class="lbl">${d}</span>
      <sw-segmented label=${d} data-seg=${e.seg} value=${t===null?"__default__":t} ?disabled=${i}
        @change=${h=>this.emit(e.key,h.detail.value==="__default__"?null:h.detail.value)}
        .options=${[...o?[{value:"__default__",label:s("tvUseDefault"),title:r,attrs:{"data-v":"default"}}]:[],...e.values.map(h=>({value:h,label:ve(e.key,h),attrs:{"data-v":h}}))]}></sw-segmented>
      ${c?n`<span class="hint" data-default-note>${c}</span>`:p}</div>`}render(){const e=this.mode==="board";if(e&&!this.display)return n``;const t=this.display??{},a=B=>e?t[B]??null:this.defaults[B],l=(e?te(t,this.defaults):this.defaults).design==="v2",[i,r,d,c,h,w,O,z]=ns.map(B=>this.row(B,a(B.key),l));return n`<div class="r" data-tv2>${i}${r}</div><div class="r">${d}${c}</div><div class="r">${h}</div><div class="r" data-lobby>${w}${O}</div><div class="r">${z}</div>`}};C.styles=[x];X([g({attribute:!1})],C.prototype,"display",2);X([g({attribute:!1})],C.prototype,"defaults",2);X([g()],C.prototype,"mode",2);C=X([_("notice-display-design")],C);const ds=["rows","drop"],cs=[0,1,2,3,4,5],se={portrait_chips:"drop",safe_margin:0},xe=e=>e==="rows"||e==="drop",Se=e=>typeof e=="number"&&Number.isInteger(e)&&e>=0&&e<=5;function ps(e,t){const a=e?.[t];return t==="portrait_chips"?xe(a)?a:null:Se(a)?a:null}function hs(e){return{portrait_chips:xe(e?.portrait_chips)?e.portrait_chips:se.portrait_chips,safe_margin:Se(e?.safe_margin)?e.safe_margin:se.safe_margin}}function us(e,t){return e==="portrait_chips"?[t==="drop"?"portraitChips_drop":"portraitChips_rows"]:t===0?["safeMargin_0"]:["safeMargin_pct",{n:t}]}var vs=Object.defineProperty,bs=Object.getOwnPropertyDescriptor,K=(e,t,a,o)=>{for(var l=o>1?void 0:o?bs(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&vs(t,a,l),l};const be=(e,t)=>{const[a,o]=us(e,t);return s(a,o)};let I=class extends k{constructor(){super(...arguments),this.defaults=se,this.mode="board"}emit(e,t){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:t},bubbles:!0,composed:!0}))}row(e,t,a,o,l){const i=this.mode==="board",r=i?ps(this.display,e):this.defaults[e],d=be(e,this.defaults[e]);return n`<div class="fld" data-tv-fit=${e}><span class="lbl">${o}</span>
      <sw-segmented label=${o} data-seg=${t} value=${r===null?"__default__":String(r)}
        @change=${c=>{if(c.detail.value==="__default__")this.emit(e,null);else{const h=a.find(w=>String(w)===c.detail.value);h!==void 0&&this.emit(e,h)}}}
        .options=${[...i?[{value:"__default__",label:s("tvUseDefault"),title:d,attrs:{"data-v":"default"}}]:[],...a.map(c=>({value:String(c),label:be(e,c),attrs:{"data-v":String(c)}}))]}></sw-segmented>
      ${i&&r===null?n`<span class="hint" data-default-note>${s("tvDefaultNow",{v:d})}</span>`:p}
      <span class="hint">${l}</span></div>`}render(){return this.mode==="board"&&!this.display?n``:n`<div class="r" data-tv-fit-rows>
      ${this.row("portrait_chips","portrait-chips",ds,s("portraitChipsLabel"),s("portraitChipsHint"))}
      ${this.row("safe_margin","safe-margin",cs,s("safeMarginLabel"),s("safeMarginHint"))}</div>`}};I.styles=[x];K([g({attribute:!1})],I.prototype,"display",2);K([g({attribute:!1})],I.prototype,"defaults",2);K([g()],I.prototype,"mode",2);I=K([_("notice-display-fit")],I);const re={orderHint:"הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.",moveUp:"הזזה למעלה: {k}",moveDown:"הזזה למטה: {k}",noSource:"אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.",sourcesTitle:"מקורות לסמלי החניה וחדר הכושר",sourcesHint:"הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.",parkingLabel:"חניה",parkingHint:"מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.",gymLabel:"חדר כושר",gymHint:"מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.",pick:"בחירת ישות",add:"הוספה",remove:"הסרה",removeOne:"הסרה: {n}",none:"לא נבחרה ישות",noCandidates:"אין ישויות מתאימות",max:"עד {n} ישויות",gone:"לא נמצאה",invert:"הפוך",invertOne:"הפוך: {n}",invertParking:"הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס).",invertGym:"הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי."},De=Le("en","i18n/notice-chips","en"),gs={he:re,en:De};function m(e,t,a=Ne()){const o=gs[a][e]??re[e]??e;return Ee(o,t)}Pe("i18n/notice-chips",{he:re,en:De});const de=["elevators","generator","parking","gym"],ae=8,fs=e=>de.includes(e);function ce(e){return[...new Set((e??[]).filter(fs))]}function ms(e){const t=ce(e),a=de.filter(o=>!t.includes(o));return[...t.map((o,l)=>({kind:o,on:!0,pos:l,count:t.length})),...a.map(o=>({kind:o,on:!1,pos:-1,count:t.length}))]}function $s(e,t,a){const o=ce(e).filter(l=>l!==t);return a?[...o,t]:o}function ge(e,t,a){const o=ce(e),l=o.indexOf(t),i=l+a;return l<0||i<0||i>=o.length||([o[l],o[i]]=[o[i],o[l]]),o}function ws(e,t){return!t||e!=="parking"&&e!=="gym"?!1:!t[e]?.length}function ys(e,t){return!t||e.includes(t)||e.length>=ae?[...e]:[...e,t]}function ks(e,t){return e.filter(a=>a!==t)}function _s(e,t){return(e??[]).filter(a=>!t.includes(a.entity_id))}const xs=["binary_sensor","input_boolean","switch","schedule"];function ie(e){return xs.includes(e.split(".")[0]??"")}function Ss(e,t,a,o){const l=new Set(t.filter(i=>i!==a));return o&&l.add(a),e.filter(i=>l.has(i)&&ie(i))}function Ds(e,t){return(e??[]).find(a=>a.entity_id===t)?.name??null}var Os=Object.defineProperty,zs=Object.getOwnPropertyDescriptor,Q=(e,t,a,o)=>{for(var l=o>1?void 0:o?zs(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Os(t,a,l),l};const Ls={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let A=class extends k{constructor(){super(...arguments),this.value=[],this.show=!0,this.sources=null}emit(e){this.dispatchEvent(new CustomEvent("info-change",{detail:[...e],bubbles:!0,composed:!0}))}render(){const e=this.value.length>0,t=ms(this.value);return n`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${a=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:a.target.checked,bubbles:!0,composed:!0}))}>${s("infoShow")}</label>
      <p class="help" data-info-help>${s("infoOldBoards")}</p>
      <label class="ck"><input type="checkbox" .checked=${e} @change=${a=>this.emit(a.target.checked?[...de]:[])}>${s("blkInfo")}</label>
      <ol class="ord" data-info-order>${t.map(a=>{const o=s(Ls[a.kind]);return n`<li data-info-row=${a.kind} data-on=${String(a.on)}>
          <label class="ck"><input type="checkbox" data-info=${a.kind} .checked=${a.on} @change=${l=>this.emit($s(this.value,a.kind,l.target.checked))}>${o}</label>
          ${a.on?n`<button type="button" class="mv up" data-info-up=${a.kind} aria-label=${m("moveUp",{k:o})} title=${m("moveUp",{k:o})} ?disabled=${a.pos<=0}
              @click=${()=>this.emit(ge(this.value,a.kind,-1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${a.kind} aria-label=${m("moveDown",{k:o})} title=${m("moveDown",{k:o})} ?disabled=${a.pos>=a.count-1}
              @click=${()=>this.emit(ge(this.value,a.kind,1))}><sw-icon name="chevron" size="14"></sw-icon></button>`:p}
          ${a.on&&ws(a.kind,this.sources)?n`<span class="note" data-info-no-source=${a.kind}>${m("noSource")}</span>`:p}
        </li>`})}</ol>
      <p class="hint" data-info-order-hint>${s("infoIconsOnly")}. ${m("orderHint")}</p>
    </div>`}};A.styles=R`
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
  `;Q([g({attribute:!1})],A.prototype,"value",2);Q([g({type:Boolean})],A.prototype,"show",2);Q([g({attribute:!1})],A.prototype,"sources",2);A=Q([_("notice-display-info")],A);var Ps=Object.defineProperty,Es=Object.getOwnPropertyDescriptor,E=(e,t,a,o)=>{for(var l=o>1?void 0:o?Es(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Ps(t,a,l),l};let D=class extends k{constructor(){super(...arguments),this.parking=[],this.gym=[],this.candidates={},this.inverted={},this.disabled=!1,this.pick={parking:"",gym:""}}emit(e,t){this.send({[`${e}_entities`]:t})}send(e){this.dispatchEvent(new CustomEvent("info-sources-change",{detail:e,bubbles:!0,composed:!0}))}one(e){const t=e==="parking"?this.parking:this.gym,a=this.candidates[e]??[],o=_s(a,t),l=t.length>=ae,i=m(e==="parking"?"parkingLabel":"gymLabel"),r=this.inverted[e]??[],d=m(e==="parking"?"invertParking":"invertGym"),c=`ns-src-${e}`;return n`<div class="src fld" data-info-source=${e}>
      <label for=${c}>${i}</label>
      ${t.length?n`<ul class="picked" data-info-source-list>${t.map(h=>{const w=Ds(a,h);return n`<li class=${w===null?"gone":""} data-info-source-item=${h}><span>${w??m("gone")}</span>
          ${ie(h)?n`<label class="inv" title=${d}><input type="checkbox" data-info-source-invert
            aria-label=${m("invertOne",{n:w??m("gone")})} .checked=${r.includes(h)} ?disabled=${this.disabled}
            @change=${O=>this.send({[`${e}_inverted`]:Ss(t,r,h,O.target.checked)})}>${m("invert")}</label>`:p}
          <button type="button" aria-label=${m("removeOne",{n:w??m("gone")})} ?disabled=${this.disabled} @click=${()=>this.emit(e,ks(t,h))}>${m("remove")}</button></li>`})}</ul>`:n`<span class="mut" data-info-source-none>${m("none")}</span>`}
      <div class="row">
        <select id=${c} class="inp" data-info-source-pick .value=${this.pick[e]} ?disabled=${this.disabled||l||!o.length}
          @change=${h=>this.pick={...this.pick,[e]:h.target.value}}>
          <option value="">${o.length?m("pick"):m("noCandidates")}</option>
          ${o.map(h=>n`<option value=${h.entity_id}>${h.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled||l||!this.pick[e]}
          @click=${()=>{const h=this.pick[e];this.pick={...this.pick,[e]:""},this.emit(e,ys(t,h))}}>${m("add")}</button>
        ${l?n`<span class="mut">${m("max",{n:ae})}</span>`:p}
      </div>
      <span class="hint">${m(e==="parking"?"parkingHint":"gymHint")}</span>
      ${t.some(ie)?n`<span class="hint" data-info-source-invert-hint>${d}</span>`:p}
    </div>`}render(){return n`<div class="srcs" data-info-sources>
      <span class="lbl">${m("sourcesTitle")}</span>
      <span class="hint">${m("sourcesHint")}</span>
      ${this.one("parking")}
      ${this.one("gym")}
    </div>`}};D.styles=[x,R`
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
  `];E([g({attribute:!1})],D.prototype,"parking",2);E([g({attribute:!1})],D.prototype,"gym",2);E([g({attribute:!1})],D.prototype,"candidates",2);E([g({attribute:!1})],D.prototype,"inverted",2);E([g({type:Boolean})],D.prototype,"disabled",2);E([u()],D.prototype,"pick",2);D=E([_("notice-info-sources")],D);var Ns=Object.defineProperty,Ts=Object.getOwnPropertyDescriptor,S=(e,t,a,o)=>{for(var l=o>1?void 0:o?Ts(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Ns(t,a,l),l};let y=class extends k{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await Te(this.boardId)}catch(e){this.err=$(e)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(e){this.err="",this.confirming=!1,this.dlg={id:e.id,title:e.title,text:e.text,seconds:e.seconds?String(e.seconds):"",boards:[...e.boards],hasImage:e.has_image,removeImage:!1,file:null}}set(e){this.dlg&&(this.dlg={...this.dlg,...e})}async save(){const e=this.dlg;if(!e||!e.title.trim())return;const t=e.seconds.trim()===""?null:Number(e.seconds);this.busy=!0,this.err="";try{const a={title:e.title.trim(),text:e.text.trim(),seconds:t,board_ids:e.boards};let o=e.id;o?await Ce(o,a):o=(await Ie(a)).id,e.file?await Ae(o,e.file):e.removeImage&&e.hasImage&&await Re(o),this.dlg=null,await this.load(),this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}async removeSlide(){const e=this.dlg;if(e?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await Be(e.id),this.dlg=null,await this.load(),this.changed()}catch(t){this.err=$(t)}finally{this.busy=!1,this.confirming=!1}}}async photo(e,t=!1){this.busy=!0,this.err="";try{const a=t?e?await He(this.boardId,e):await Ue(this.boardId):e?await je(this.boardId,e):await Fe(this.boardId);this.doc={...this.doc??a,photo:a.photo,photo_night:a.photo_night},this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}pickBoard(e){const t=this.dlg;t&&this.set({boards:t.boards.includes(e)?t.boards.filter(a=>a!==e):[...t.boards,e]})}dialog(){const e=this.dlg;if(!e)return n`<sw-dialog></sw-dialog>`;const t=this.doc?.seconds.min??6,a=this.doc?.seconds.max??120,o=e.file?e.file.name:e.hasImage&&!e.removeImage?s("slidePicture"):s("slideNoPicture");return n`<sw-dialog open data-slide-dialog heading=${e.id?s("slideEditTitle"):s("slideNew")} @close=${()=>this.dlg=null}>
      <div class="form">
        <div class="fld"><label for="sl-title">${s("slideTitle")}</label><input id="sl-title" class="inp" maxlength="80" .value=${e.title} @input=${l=>this.set({title:l.target.value})}></div>
        <div class="fld"><label for="sl-text">${s("slideText")}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${e.text} @input=${l=>this.set({text:l.target.value})}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${s("slideSeconds")}</label><input id="sl-sec" class="inp short num" type="number" min=${t} max=${a} .value=${e.seconds} @input=${l=>this.set({seconds:l.target.value})}></div>
          <div class="fld"><span class="lbl">${s("slidePicture")}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${()=>this.renderRoot.querySelector("[data-slide-file]").click()}>${s("slidePick")}</sw-button>
              <span class="nm">${o}</span>
              ${e.file||e.hasImage&&!e.removeImage?n`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${()=>this.set({file:null,removeImage:!0})}>${s("slideRemovePicture")}</sw-button>`:p}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${l=>this.set({file:l.target.files?.[0]??null,removeImage:!1})}></div></div>
        </div>
        ${this.boards.length>1?n`<div class="fld"><span class="lbl">${s("slideBoards")}</span>
          <div class="chips" data-slide-boards>${this.boards.map(l=>n`<button class="pick" aria-pressed=${String(e.boards.includes(l.id))} data-slide-board=${l.id} @click=${()=>this.pickBoard(l.id)}>${l.name}</button>`)}</div></div>`:p}
      </div>
      ${this.err?n`<p class="err" role="alert" data-slide-error>${this.err}</p>`:p}
      ${e.id?n`<sw-button slot="footer" variant=${this.confirming?"danger":"ghost"} ?disabled=${this.busy} data-slide-delete @click=${()=>this.removeSlide()}>${this.confirming?s("slideDeleteConfirm"):s("slideDelete")}</sw-button>`:n`<sw-button slot="footer" variant="ghost" @click=${()=>this.dlg=null}>${s("cancel")}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy||!e.title.trim()} data-slide-save @click=${()=>this.save()}>${s("save")}</sw-button>
    </sw-dialog>`}render(){if(!this.display)return n``;const e=this.doc?.slides??[],t=this.doc?.limit??10,a=this.display.rotate_s||12,o=e.reduce((r,d)=>r+(d.seconds||a),0),l=this.doc?.photo,i=this.doc?.photo_night;return n`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(r.target.checked)}>${s("slidesBlock")}</label>
          <span class="st num" data-slides-count>${s("slidesCount",{n:e.length,s:o})}</span></div>
        <div class="slides" data-slide-grid>${e.map(r=>n`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?n`<img alt="" src=${We(r)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${s("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${e.length>=t} title=${s("slideLimit",{n:t})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${s("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?n`<div class="blk" data-photo-block><span class="ck"><b>${s("photoBlock")}</b></span>
        <div class="photo"><div class="th">${l?.has?n`<img alt="" data-photo-img src=${Me(this.boardId,l.stamp)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${l?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${l?.has?n`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${s("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const d=r.target,c=d.files?.[0];d.value="",c&&this.photo(c)}}></div>
        ${!this.dlg&&this.err?n`<p class="err" role="alert" data-photo-error>${this.err}</p>`:p}</div>`:p}
      ${this.lux?n`<div class="blk" data-photo-night-block><span class="ck"><b>${s("photoNightBlock")}</b></span><span class="hint">${s("photoNightHint")}</span>
        <div class="photo"><div class="th">${i?.has?n`<img alt="" data-photo-night-img src=${Ge(this.boardId,i.stamp)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${i?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${i?.has?n`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${s("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const d=r.target,c=d.files?.[0];d.value="",c&&this.photo(c,!0)}}></div></div>`:p}
      ${this.dialog()}`}emitPromo(e){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:e}},bubbles:!0,composed:!0}))}};y.styles=[x,R`
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
    `];S([g({attribute:!1})],y.prototype,"display",2);S([g({attribute:!1})],y.prototype,"boardId",2);S([g({type:Boolean})],y.prototype,"lux",2);S([g({attribute:!1})],y.prototype,"boards",2);S([u()],y.prototype,"doc",2);S([u()],y.prototype,"dlg",2);S([u()],y.prototype,"err",2);S([u()],y.prototype,"busy",2);S([u()],y.prototype,"confirming",2);y=S([_("notice-display-slides")],y);var Cs=Object.defineProperty,Is=Object.getOwnPropertyDescriptor,U=(e,t,a,o)=>{for(var l=o>1?void 0:o?Is(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Cs(t,a,l),l};let L=class extends k{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await qt()}catch{this.failed=!0}}get scr(){return Mt(this.display)}emit(e){const t=(this.t?.config.stops??[]).map(o=>o.code),a=Yt(this.scr,e,t);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:a},bubbles:!0,composed:!0}))}render(){if(!this.display)return n``;const e=this.scr,t=this.t?.config.stops??[],a=!!this.t?.config.enabled&&t.length>0,o=document.documentElement.lang?.startsWith("en")?"en":"he",l=[["side",v("lay_side"),v("lay_side_hint")],["strip",v("lay_strip"),v("lay_strip_hint")],["slide",v("lay_slide"),v("lay_slide_hint")]],i=[["auto",v("grp_auto")],["always",v("grp_always")],["never",v("grp_never")]],r=Xt(e.window_min),d=e.stops.length?e.stops:t.map(c=>c.code);return n`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${e.enabled} @change=${c=>this.emit({enabled:c.target.checked})}><b>${v("scrTitle")}</b> - ${v("scrShow")}</label>
      ${a?p:n`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?v("forbiddenHint"):v("scrOffModule")}</span>
        <a href="#/system/transit">${v("scrGo")}</a></div>`}
      ${e.enabled&&a?n`
        <div class="sub" data-transit-stops>
          <span>${v("scrStops")}</span>
          ${t.map(c=>n`<label class="ck"><input type="checkbox" data-transit-stop=${c.code} .checked=${H(d.includes(c.code))}
            @change=${()=>this.emit({stops:Kt(e.stops,c.code,t.map(h=>h.code))})}>${c.name||c.catalogue_name||c.code}</label>`)}
          ${e.stops.length===0?n`<span class="hint">${v("scrStopsAll")}</span>`:p}
        </div>
        ${this.v2Layout?p:n`<div class="sub"><span>${v("scrLayout")}</span><sw-segmented data-transit-layout value=${e.layout} @change=${c=>this.emit({layout:c.detail.value})}
          .options=${l.map(([c,h,w])=>({value:c,label:h,title:w,attrs:{"data-layout":c}}))}></sw-segmented></div>`}
        <div class="sub"><span>${v("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(e.window_min):"free"} @change=${c=>{const h=c.target.value;this.emit({window_min:h==="free"?45:Number(h)})}}>${Qt.map(c=>n`<option value=${String(c)} ?selected=${r==="list"&&e.window_min===c}>${Jt(c,o)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${v("scrWindowFree")}</option></select>
          ${r==="free"?n`<input class="inp short num" type="number" data-transit-window-free min=${N[0]} max=${N[1]} step="1" .value=${H(String(e.window_min))}
            title=${v("scrFree",{a:N[0],b:N[1]})}
            @change=${c=>this.emit({window_min:M(c.target.value,N[0],N[1],e.window_min)})}>`:p}
        </div>
        <div class="sub"><span>${v("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${F[0]} max=${F[1]} step="1" .value=${H(String(e.rows))}
          @change=${c=>this.emit({rows:M(c.target.value,F[0],F[1],e.rows)})}>
          <span>${v("scrGroup")}</span><select class="inp" data-transit-group .value=${e.group} @change=${c=>this.emit({group:c.target.value})}>
            ${i.map(([c,h])=>n`<option value=${c} ?selected=${e.group===c}>${h}</option>`)}</select></div>
        <div class="sub"><span>${v("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${W[0]} max=${W[1]} step="1"
          placeholder=${v("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${H(e.refresh_s==null?"":String(e.refresh_s))}
          @change=${c=>{const h=c.target.value.trim();this.emit({refresh_s:h===""?null:M(h,W[0],W[1],20)})}}>
          <span>${v("scrDistance")}</span><select class="inp" data-transit-distance .value=${e.show_distance==null?"inherit":e.show_distance?"on":"off"} @change=${c=>{const h=c.target.value;this.emit({show_distance:h==="inherit"?null:h==="on"})}}>${[["inherit",v("scrDistInherit")],["on",v("scrDistOn")],["off",v("scrDistOff")]].map(([c,h])=>n`<option value=${c} ?selected=${(e.show_distance==null?"inherit":e.show_distance?"on":"off")===c}>${h}</option>`)}</select></div>
        ${(this.v2Layout??e.layout)==="slide"?n`<div class="sub"><span>${v("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${G[0]} max=${G[1]} step="1" .value=${H(String(e.dwell_s))}
          @change=${c=>this.emit({dwell_s:M(c.target.value,G[0],G[1],e.dwell_s)})}></div>`:p}
      `:p}
    </div>`}};L.styles=[x,R`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];U([g({attribute:!1})],L.prototype,"display",2);U([g({attribute:!1})],L.prototype,"v2Layout",2);U([u()],L.prototype,"t",2);U([u()],L.prototype,"failed",2);L=U([_("notice-display-transit")],L);const oe=40,le=12,As="image/png,image/jpeg",Rs=3e5;function fe(e){return e.map(t=>({id:t.id,name:t.name,url:t.url,enabled:t.enabled!==!1,has_logo:!!t.has_logo,logo_url:t.logo_url||"",custom:!!t.custom}))}function Bs(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1}}function Hs(e){const t=e.trim();if(!t||t.length>400||/[\s\\]/.test(t))return!1;let a;try{a=new URL(t)}catch{return!1}if(a.protocol!=="https:"||a.username||a.password||a.port&&a.port!=="443")return!1;const o=a.hostname.toLowerCase();return!o.includes(".")||o==="localhost"||o.endsWith(".local")||o.endsWith(".localhost")||o.endsWith(".internal")?!1:/^[0-9.]+$/.test(o)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(o):!o.startsWith("[")}function Oe(e){const t=new Set;return e.map(a=>{const o=a.name.trim();if(!o||o.length>oe)return"name";if(!Hs(a.url))return"url";const l=a.url.trim();return t.has(l)?"dup":(t.add(l),"")})}function me(e){return e.length<=le&&Oe(e).every(t=>t==="")}function $e(e,t,a){if(t===a||t<0||a<0||t>=e.length||a>=e.length)return e;const o=e.slice();return o.splice(a,0,o.splice(t,1)[0]),o}function ne(e){return e.map(t=>({...t.id?{id:t.id}:{},name:t.name.trim(),url:t.url.trim(),enabled:t.enabled}))}function we(e,t){return JSON.stringify(ne(e))!==JSON.stringify(ne(t))||e.some(a=>a.custom)}function Us(e,t){const a=t.find(o=>e.id&&o.id===e.id||o.url===e.url);return a?{name:a.name,logo:a.logo_url||"",known:!a.custom}:{name:e.name,logo:"",known:!1}}function js(e,t=24){const a=e.trim();return a.length<=t?a:a.slice(0,t-1)+"…"}var Fs=Object.defineProperty,Ws=Object.getOwnPropertyDescriptor,j=(e,t,a,o)=>{for(var l=o>1?void 0:o?Ws(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Fs(t,a,l),l};let P=class extends k{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=fe(this.sources),(!we(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(e=>({...e}))))}say(e){this.dispatchEvent(new CustomEvent("ns-message",{detail:e,bubbles:!0,composed:!0}))}applyAnswer(e,t){const a=this.rows;this.fromProp=e.sources,this.saved=fe(e.sources),this.rows=t?this.saved.map(o=>{const l=a.find(i=>i.id===o.id);return l?{...l,has_logo:o.has_logo,logo_url:o.logo_url,custom:o.custom}:{...o}}).concat(a.filter(o=>!o.id)):this.saved.map(o=>({...o})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:e.sources,bubbles:!0,composed:!0}))}set(e,t){this.rows=this.rows.map((a,o)=>o===e?{...a,...t}:a)}async save(){if(!(this.busy||!me(this.rows))){this.busy=!0;try{this.applyAnswer(await Ve(ne(this.rows)),!1),this.say(s("nsSaved"))}catch(e){this.say($(e))}finally{this.busy=!1}}}async logo(e,t){const a=this.rows[e];if(!(!t||!a?.id||this.busy)){if(t.size>Rs){this.say(s("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await qe(a.id,t),!0)}catch(o){this.say(o instanceof ye&&o.status===422?s("nsLogoFile"):$(o))}finally{this.busy=!1}}}async dropLogo(e){const t=this.rows[e];if(!(!t?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Ye(t.id),!0)}catch(a){this.say($(a))}finally{this.busy=!1}}}rowHtml(e,t,a){const o=this.rows.length-1,l=!!e.id&&!this.busy,i=e.has_logo?s("nsLogoReplace"):s("nsLogoUpload");return n`<div class="row" data-ns-row=${e.id||"new"} data-off=${e.enabled?"0":"1"} data-bad=${a?"1":"0"}>
      <div class="lg" data-ns-logo>${e.has_logo&&e.logo_url?n`<img alt="" src=${e.logo_url}>`:n`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${oe} .value=${e.name} placeholder=${s("nsName")} aria-label=${s("nsName")} @input=${r=>this.set(t,{name:r.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${e.url} placeholder="https://" aria-label=${s("nsUrl")} @input=${r=>this.set(t,{url:r.target.value})}>
      <div class="tools">
        ${e.custom?n`<span class="chip">${s("nsCustomTag")}</span>`:p}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${e.enabled} @change=${r=>this.set(t,{enabled:r.target.checked})}>${s("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!l} title=${e.id?i:s("nsLogoSaveFirst")} aria-label=${i}
          @click=${r=>r.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${As} @change=${r=>{const d=r.target;this.logo(t,d.files?.[0]),d.value=""}}>
        ${e.has_logo?n`<button class="ib" type="button" data-ns-logo-del ?disabled=${!l} title=${s("nsLogoRemove")} aria-label=${s("nsLogoRemove")} @click=${()=>this.dropLogo(t)}><sw-icon name="close" size="14"></sw-icon></button>`:p}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${t===0} title=${s("nsUp")} aria-label=${s("nsUp")} @click=${()=>this.rows=$e(this.rows,t,t-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${t===o} title=${s("nsDown")} aria-label=${s("nsDown")} @click=${()=>this.rows=$e(this.rows,t,t+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${s("nsDelete")} aria-label=${s("nsDelete")} @click=${()=>this.rows=this.rows.filter((r,d)=>d!==t)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${a?n`<span class="err" data-ns-err=${a}>${a==="name"?s("nsErrName",{n:oe}):a==="url"?s("nsErrUrl"):s("nsErrDup")}</span>`:p}
    </div>`}render(){const e=Oe(this.rows),t=we(this.rows,this.saved);return n`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${s("nsCard")}</h2><span class="chip num">${s("nsCount",{n:this.rows.length,m:le})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=le} @click=${()=>this.rows=[...this.rows,Bs()]}>${s("nsAdd")}</sw-button></div>
      ${this.rows.length?n`<div class="list" data-ns-list>${this.rows.map((a,o)=>this.rowHtml(a,o,e[o]))}</div>`:n`<span class="mut">${s("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${t?n`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(a=>({...a}))}>${s("nsDiscard")}</sw-button>`:p}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!t||!me(this.rows)||this.busy} @click=${()=>this.save()}>${s("nsSave")}</sw-button></div>
    </div>`}};P.styles=[x,R`
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
    `];j([g({attribute:!1})],P.prototype,"sources",2);j([u()],P.prototype,"rows",2);j([u()],P.prototype,"saved",2);j([u()],P.prototype,"busy",2);P=j([_("notice-news-sources")],P);var Ms=Object.defineProperty,Gs=Object.getOwnPropertyDescriptor,ze=(e,t,a,o)=>{for(var l=o>1?void 0:o?Gs(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Ms(t,a,l),l};let q=class extends k{constructor(){super(...arguments),this.value="hide"}render(){return n`<div class="fld"><label for="ns-home-empty">${s("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${e=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:e.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${s("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${s("dHomeEmptyLine")}</option></select></div>`}};q.styles=[x];ze([g()],q.prototype,"value",2);q=ze([_("notice-home-empty")],q);var Vs=Object.defineProperty,qs=Object.getOwnPropertyDescriptor,f=(e,t,a,o)=>{for(var l=o>1?void 0:o?qs(t,a):t,i=e.length-1,r;i>=0;i--)(r=e[i])&&(l=(o?r(t,a,l):r(l))||l);return o&&l&&Vs(t,a,l),l};let b=class extends k{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(e){e.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(e=>{e.value!==e.dataset.v&&(e.value=e.dataset.v??"")})}say(e){this.toast=e,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Xe(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(e){e instanceof ye&&e.status===403?this.forbidden=!0:this.error=$(e)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{this.boards=(await Ke()).boards}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await J(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await pe("all")).notices}catch{this.notices=[]}}catch(e){this.error=$(e)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const e=await Qe();this.floors=e.floors,this.groups=e.groups,this.roles=e.roles}catch{}}}newNotice(e=""){const t=this.s.settings;this.compose=e?Je(new Date,t.default_days,t.default_severity,e):Ze(new Date,t.default_days,t.default_severity)}editNotice(e){const t=this.notices.find(a=>a.id===e);t&&(this.compose=et(t))}async composed(e){this.compose=null,this.say(e.detail.message);try{this.notices=(await pe("all")).notices}catch{}if(this.detail)try{this.detail=await J(this.detail.board.id)}catch(t){this.say($(t))}this.loadBoards()}composeDialog(){return n`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${e=>this.composed(e)}></notice-compose>`}async patchSettings(e,t=s("saved")){try{const a=await tt(e);this.s&&(this.s={...this.s,settings:a.settings}),"enabled"in e&&(st(a.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(t)}catch(a){this.say($(a))}}render(){return this.forbidden?n`<sw-page heading=${s("setTitle")}><sw-state-panel state="forbidden" heading=${s("forbidden")} hint=${s("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?n`<sw-page heading=${s("setTitle")}><sw-state-panel state="error" heading=${s("saveError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?n`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast?n`<div class="toast" role="status" ${at()}>${this.toast}</div>`:p}`:n`<sw-page heading=${s("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const e=this.s,t=e.settings,a=e.can;return n`
      <div class="top"><div><h1>${s("setTitle")}</h1><p class="sub">${s("setSub")}</p></div><span class="sp"></span>
        ${t.enabled&&a.manage?n`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=it}>${s("allNotices")}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${()=>this.newNotice()}>${s("newNotice")}</sw-button></div>`:p}</div>
      ${t.enabled?p:n`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offBody")}
          actionLabel=${a.configure?s("turnOn"):""} @action=${()=>this.patchSettings({enabled:!0})}></sw-state-panel>`}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${s("moduleCard")}</h2><span class="sp"></span>
          <sw-toggle .checked=${t.enabled} ?disabled=${!a.configure} label=${t.enabled?s("moduleOn"):s("moduleOff")} data-module-switch
            @change=${o=>this.patchSettings({enabled:o.detail.checked})}></sw-toggle></div>
          <dl class="kv"><dt>${s("kvWrite")}</dt><dd>${s("kvWriteV")} <span class="mut ltr">(notices.manage)</span></dd><dt>${s("kvPush")}</dt><dd>${s("kvPushV")} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${s("kvBoards")}</dt><dd>${s("kvBoardsV")} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${a.configure?this.defaultsCard():p}
      </div>
      ${a.configure?n`<notice-news-sources .sources=${t.news_sources} @ns-message=${o=>this.say(o.detail)}
        @news-sources-change=${o=>this.s={...this.s,settings:{...this.s.settings,news_sources:o.detail}}}></notice-news-sources>`:p}
      ${t.enabled&&a.boards?n`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${s("boardsCard")}</h2><span class="chip num">${s("boardsCount",{n:this.boards.length,m:t.boards_max})}</span><span class="sp"></span>
          ${a.configure?n`<label class="ck"><input type="checkbox" .checked=${t.boards_remote} @change=${o=>this.patchSettings({boards_remote:o.target.checked})}>${s("dRemote")}</label>`:p}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length>=t.boards_max} @click=${()=>this.openCreate()}>${s("newBoard")}</sw-button></div>
        ${this.boards.length?n`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map(o=>this.boardCard(o))}</div>`:n`<sw-state-panel icon="wall" state="empty" heading=${s("noBoards")} hint=${s("boardsEmpty")} actionLabel=${s("firstBoard")} @action=${()=>this.openCreate()}></sw-state-panel>`}
      </div>`:p}
      ${t.enabled&&a.boards?this.tvDefaultsCard():p}`}tvDefaults(){return Gt(this.s?.settings.tv_defaults)}tvDefaultsCard(){return n`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${s("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${s("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return Vt(this.s?.settings.tv2_defaults)}tvFitDefaults(){return hs(this.s?.settings.tv2_defaults)}async saveTvDefaults(e){try{const t=await ot(e);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:t.tv_defaults,...t.tv2_defaults?{tv2_defaults:t.tv2_defaults}:{}}}),this.say(s("saved"))}catch(t){this.say($(t))}}defaultsCard(){const e=this.s,t=e.settings;return n`<div class="panel" data-defaults-card><div class="hd"><h2>${s("defaultsCard")}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${s("dDays")}</label><div class="sum"><sw-field class="short"><input id="ns-days" class="num" type="number" min="1" max="90" .value=${String(t.default_days)}
          @change=${a=>this.patchSettings({default_days:Number(a.target.value)})}></sw-field><span class="mut">${s("dDaysUnit")}</span></div></div>
        <div class="fld"><label for="ns-sev">${s("dSeverity")}</label><sw-field><select id="ns-sev" data-v=${t.default_severity} @change=${a=>this.patchSettings({default_severity:a.target.value})}>
          <option value="info">${s("sevInfo")}</option><option value="alert">${s("sevAlert")}</option></select></sw-field></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${s("dReads")}</label><sw-field><select id="ns-reads" data-v=${t.reads_names?"names":"counts"} @change=${a=>this.patchSettings({reads_names:a.target.value==="names"})}>
          <option value="names">${s("dReadsNames")}</option><option value="counts">${s("dReadsCounts")}</option></select></sw-field></div>
        <div class="fld"><label for="ns-ret">${s("dRetention")}</label><sw-field><select id="ns-ret" data-v=${String(t.retention_days)}
          @change=${a=>this.patchSettings({retention_days:Number(a.target.value)})}>
          ${lt(t.retention_days).map(a=>n`<option value=${String(a.value)}>${a.label}</option>`)}</select></sw-field></div>
        <notice-home-empty .value=${t.home_empty??"hide"} @home-empty-change=${a=>this.patchSettings({home_empty:a.detail})}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${s("dPush")}</label><sw-field><select id="ns-push" data-v=${t.push_default}
          @change=${a=>this.patchSettings({push_default:a.target.value})}>
          <option value="by_severity">${s("dPushSev")}</option><option value="always">${s("dPushAlways")}</option><option value="never">${s("dPushNever")}</option></select></sw-field>
          <span class="hint">${s("dPushHint")}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${s("dWeather")}</label><sw-field><select id="ns-wx" data-v=${t.weather_entity} @change=${a=>this.patchSettings({weather_entity:a.target.value})}>
          <option value="">${s("dWeatherNone")}</option>${e.weather_entities.map(a=>n`<option value=${a.entity_id}>${a.name}</option>`)}</select></sw-field></div>
        <div class="fld"><label for="ns-bn">${s("dBuilding")}</label><sw-field><input id="ns-bn" maxlength="60" .value=${t.building_name} placeholder=${e.building_fallback}
          @change=${a=>this.patchSettings({building_name:a.target.value})}></sw-field><span class="hint">${s("dBuildingHint",{name:e.building_fallback||"-"})}</span></div>
      </div>
      <notice-info-sources .parking=${t.parking_entities??[]} .gym=${t.gym_entities??[]} .candidates=${e.info_entities??{}}
        .inverted=${{parking:t.parking_inverted??[],gym:t.gym_inverted??[]}}
        @info-sources-change=${a=>this.patchSettings(a.detail)}></notice-info-sources>
      <div class="fld"><label for="ns-origin">${s("dOrigin")}</label><sw-field><input id="ns-origin" class="ltr" maxlength="220" .value=${t.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${a=>this.patchSettings({boards_origin:a.target.value})}></sw-field><span class="hint">${s("dOriginHint")}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${s("dConnTotal")}</label><sw-field class="short"><input id="ns-ctot" class="num" type="number" min="4" max="256" data-conn-total .value=${String(t.conn_total)}
          @change=${a=>this.patchSettings({conn_total:Number(a.target.value)})}></sw-field></div>
        <div class="fld"><label for="ns-cadr">${s("dConnPerAddr")}</label><sw-field class="short"><input id="ns-cadr" class="num" type="number" min="1" max="64" data-conn-per-address .value=${String(t.conn_per_address)}
          @change=${a=>this.patchSettings({conn_per_address:Number(a.target.value)})}></sw-field></div>
      </div>
      <label class="ck" data-places-tree-setting><input type="checkbox" .checked=${t.show_places_tree!==!1} @change=${a=>this.patchSettings({show_places_tree:a.target.checked})}>${s("dPlacesTree")}</label>
      <label class="ck"><input type="checkbox" .checked=${t.news_custom} @change=${a=>this.patchSettings({news_custom:a.target.checked})}>${s("dCustomFeeds")}</label>
      <div class="fld"><span class="lbl">${s("companyLogo")}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${s("logoWhere")}</a></div>
    </div></div>`}seenBadge(e,t=!1){const a=nt(e,Date.now()),o=a==="online"?"ok":a==="off"?"off":"unk",l=a==="online"?s("bOnline"):a==="off"?s("bDisabled"):a==="never"?s("bNever"):s("bIdle");return t?n`<span class="chip" data-tone=${o==="ok"?"ok":o==="unk"?"warn":p}>${l}</span>`:n`<span class="badge" data-look=${o}>${l}</span>`}summary(e){const t=e.display;if(!t)return"";const a=s(t.template===1?"tpl1":t.template===2?"tpl2":"tpl3"),o=s(t.theme==="day"?"themeDay":t.theme==="night"?"themeNight":"orAuto");return`${a} · ${o} · ${t.rotate_s} ${s("seconds")}`}boardsTable(){const e=[{key:"state",label:s("bState"),kind:"status",render:t=>this.seenBadge(t,!0)},{key:"name",label:s("bName"),kind:"truncate",cellTitle:t=>t.name,render:t=>n`<span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span>`},{key:"slug",label:s("bAddress"),kind:"muted",render:t=>n`<bdi dir="ltr">/b/${t.slug}</bdi>`},{key:"items",label:s("bItems"),kind:"num",render:t=>String(t.item_count??0)},{key:"seen",label:s("bSeen"),kind:"muted",render:t=>Z(t.last_seen_at,Date.now())},{key:"act",label:"",kind:"actions",render:t=>this.rowActions(t)}];return n`<sw-table class="t" bare data-boards-table rowKey="slug" .columns=${e} .rows=${this.boards}
      .rowAttrs=${t=>({"data-board":String(t.slug)})}
      @row-select=${t=>this.goBoard(t.detail.row)}></sw-table>`}rowActions(e){const t=a=>o=>{o.stopPropagation(),a()};return n`${e.enabled?p:n`<sw-button size="sm" data-activate @click=${t(()=>void this.activate(e))}>${s("activate")}</sw-button>`}
      ${this.canCopyLink()?n`<sw-button size="sm" data-copy-link @click=${t(()=>void this.copyLink(e))}>${s("copyLink")}</sw-button>`:p}
      <sw-button size="sm" @click=${t(()=>this.goBoard(e))}>${s("open")}</sw-button>`}canCopyLink(){const e=this.s?.can;return!!(e?.configure&&e.boards)}async copyLink(e){if(!e.has_stored_link){this.confirmRotate={board:e,copy:!0,legacy:!0};return}try{const t=await rt(e.id);this.link={board:e,token:t.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(e,t.token)).then(()=>this.say(s("copied")),()=>{})}catch(t){this.say($(t))}}async activate(e){try{await he(e.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===e.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(s("saved"))}catch(t){this.say($(t))}}boardCard(e){return n`<div class="card" tabindex="0" role="link" data-board-card=${e.slug} @click=${()=>this.goBoard(e)} @keydown=${Zt(()=>this.goBoard(e))}><div class="row">${this.seenBadge(e)}<span class="ltr mut">/b/${e.slug}</span></div><span class="t1">${e.name}</span><span class="t2">${this.summary(e)}</span></div>`}goBoard(e){location.hash=`${ee}/${encodeURIComponent(e.id)}`}openCreate(){this.creating={name:"",slug:dt("board",this.boards.map(e=>e.slug)),err:""}}createDialog(){const e=this.creating;return n`<sw-dialog ?open=${!!e} heading=${s("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${e?n`<div class="form">
        <div class="fld"><label for="nb-name">${s("bName")}</label><sw-field><input id="nb-name" maxlength="60" .value=${e.name} @input=${t=>this.creating={...e,name:t.target.value,err:""}}></sw-field></div>
        <div class="fld"><label for="nb-slug">${s("bSlug")}</label><sw-field><input id="nb-slug" class="ltr" maxlength="40" .value=${e.slug} @input=${t=>this.creating={...e,slug:t.target.value.toLowerCase(),err:""}}></sw-field><span class="hint">${s("bSlugHint")}</span></div>
        ${e.err?n`<span class="err" role="alert">${e.err}</span>`:p}</div>`:p}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${s("newBoard")}</sw-button></sw-dialog>`}async create(){const e=this.creating;if(e){if(!e.name.trim()){this.creating={...e,err:s("bName")};return}if(!ct(e.slug)){this.creating={...e,err:s("bSlugHint")};return}try{const t=await pt({name:e.name.trim(),slug:e.slug});this.creating=null,this.link={board:t.board,token:t.token,rotated:!1},await this.loadBoards()}catch(t){this.creating={...e,err:$(t)}}}}linkUrl(e,t){return ht(e.slug,t,this.s?.settings.boards_origin||void 0)}linkDialog(){const e=this.link,t=e?this.linkUrl(e.board,e.token):"";return n`<sw-dialog ?open=${!!e} heading=${e?s("linkTitle",{name:e.board.name}):""} subheading=${e?.rotated?s("linkSub"):s("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${e?n`<div class="form">
        <div class="link"><code data-board-link>${t}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(t)}>${s("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${_t(t,148)}</div><p class="hint">${s("linkHint")}</p></div>
        ${this.s?.settings.boards_remote?p:n`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${s("linkLan")}</span></div>`}
      </div>`:p}
      <sw-button slot="footer" variant="primary" @click=${()=>this.link=null}>${s("done")}</sw-button></sw-dialog>`}async copy(e){try{await navigator.clipboard.writeText(e),this.say(s("copied"))}catch{this.say(e)}}boardPage(){const e=this.detail,t=e.board,a=[{id:"general",label:s("tabGeneral")},{id:"display",label:s("tabDisplay")},{id:"notices",label:`${s("tabNotices")} (${e.notices.length})`}];return n`
      <div class="top"><div><h1>${t.name}</h1><p class="sub"><a href=${ee}>${s("back")}</a> · <span class="ltr">/b/${t.slug}</span> · ${Z(t.last_seen_at,Date.now())}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("openTv")}</sw-button>
          ${this.canCopyLink()?n`<sw-button icon="copy" data-copy-link @click=${()=>void this.copyLink(t)}>${s("copyLink")}</sw-button>`:p}
          <sw-button icon="refresh" data-rotate @click=${()=>this.confirmRotate={board:t,copy:!1}}>${s("newLink")}</sw-button>
          <sw-toggle .checked=${t.enabled} label=${s("boardEnabled")} @change=${o=>this.saveBoard({enabled:o.detail.checked})}></sw-toggle>
        </div></div>
      <sw-tabs .items=${a} active=${this.tab} panel="board-panel" @change=${o=>this.tab=o.detail.id}></sw-tabs>
      <div class="stack" id="board-panel">${this.tab==="general"?this.generalTab():this.tab==="display"?this.displayTab():this.noticesTab()}</div>`}generalTab(){const e=this.detail.board,t=this.draft;return n`<div class="two">
      <div class="panel"><div class="hd"><h2>${s("tabGeneral")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty&&this.nameDraft===e.name} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${s("bName")}</label><sw-field><input id="bg-name" maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}></sw-field></div>
            <div class="fld"><label for="bg-slug">${s("bSlug")}</label><sw-field><input id="bg-slug" class="ltr" .value=${e.slug} disabled></sw-field></div></div>
          <div class="r">${this.placeField(t.place)}
            <div class="fld"><label for="bg-lang">${s("lang")}</label><sw-field><select id="bg-lang" data-v=${t.lang} @change=${a=>this.setD({lang:a.target.value})}><option value="he">עברית</option><option value="en">English</option></select></sw-field></div></div>
          <dl class="kv"><dt>${s("kvTemplate")}</dt><dd>${this.summary(e)}</dd><dt>${s("bItems")}</dt><dd class="num">${this.detail.notices.length}</dd>
            <dt>${s("kvSeen")}</dt><dd>${Z(e.last_seen_at,Date.now())}</dd><dt>${s("kvCreated")}</dt><dd class="num">${(e.created_at||"").slice(0,10)}</dd>
            <dt>${s("kvRotated")}</dt><dd class="num">${(e.token_rotated_at||"").slice(0,10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${()=>this.confirmDelete=!0}>${s("deleteBoard")}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("bAddress")}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(e,"••••••••••••••••••••••••••••••••")}</code></div>
        <p class="hint">${s("linkOnce")} ${s("linkHint")}</p>
        ${e.has_stored_link===!1?n`<p class="hint" data-link-pending>${s("linkPending")}</p>`:p}
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:e,copy:!1}}>${s("newLink")}</sw-button></div></div>
    </div>`}placeField(e){const t=ut(this.floors);if(!t.length)return n`<div class="fld"><label for="bg-place">${s("place")}</label><sw-field><input id="bg-place" maxlength="60" .value=${e} @input=${l=>this.setD({place:l.target.value})}></sw-field></div>`;const a=!!e&&!t.includes(e),o=this.placeOther||a?"__other":e;return n`<div class="fld"><label for="bg-place">${s("place")}</label>
      <sw-field><select id="bg-place" data-place-select data-v=${o} @change=${l=>{const i=l.target.value;this.placeOther=i==="__other",this.placeOther||this.setD({place:i})}}><option value="">-</option>${t.map(l=>n`<option value=${l}>${l}</option>`)}<option value="__other">${s("placeOther")}</option></select></sw-field>
      ${o==="__other"?n`<sw-field><input data-place-text maxlength="60" aria-label=${s("place")} .value=${e} @input=${l=>this.setD({place:l.target.value})}></sw-field>`:p}</div>`}setD(e){this.draft&&(this.draft={...this.draft,...e,blocks:{...this.draft.blocks,...e.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(e=!0){const t=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${e?"embed=1&":""}preview=${t}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(e){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:e},location.origin),this.sendToTvs&&this.detail)try{await vt(this.detail.board.id,e==="toggle"?"pause":e)}catch(t){this.say($(t))}}displayTab(){const e=this.draft,t=[{n:1,t:s("tpl1"),dsc:s("tpl1d")},{n:2,t:s("tpl2"),dsc:s("tpl2d")},{n:3,t:s("tpl3"),dsc:s("tpl3d")}],a=e.layout==="portrait",o=this.s.settings,l=this.detail.notices.filter(i=>i.state==="active");return n`<div class="disp">
      <div class="panel"><div class="hd"><h2>${s("tplCard")}</h2><span class="sp"></span><span class="chip" data-look="acc">${s("tplLive")}</span></div>
        <div class="tpls" data-tpls>${t.map(i=>n`<button class="tpl" data-tpl=${i.n} aria-pressed=${String(e.template===i.n)} @click=${()=>this.setD({template:i.n})}>
          <div class="sch t${i.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${i.t}</b><span>${i.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${s("preview")}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("fullScreen")}</sw-button></div>
        <div class="prev ${a?"port":""}"><iframe data-preview title=${s("preview")} src=${this.previewSrc()} @load=${()=>this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${()=>this.cmd("prev")}>${s("prev")}</sw-button><sw-button size="sm" @click=${()=>this.cmd("toggle")}>${s("pauseToggle")}</sw-button>
          <sw-button size="sm" @click=${()=>this.cmd("next")}>${s("next")}</sw-button><label class="ck"><input type="checkbox" .checked=${this.sendToTvs} @change=${i=>this.sendToTvs=i.target.checked}>${s("sendToTvs")}</label>
          <span class="hint">${s("remoteHint")}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${s("theme")}</span><sw-segmented label=${s("theme")} data-theme-seg value=${e.theme} @change=${i=>this.setD({theme:i.detail.value})}
            .options=${["day","night","auto"].map(i=>({value:i,label:s(i==="day"?"themeDay":i==="night"?"themeNight":"themeAuto")}))}></sw-segmented></div>
            <div class="fld"><span class="lbl">${s("orient")}</span><sw-segmented label=${s("orient")} value=${e.layout} @change=${i=>this.setD({layout:i.detail.value})}
            .options=${["auto","landscape","portrait"].map(i=>({value:i,label:s(i==="auto"?"orAuto":i==="landscape"?"orLand":"orPort")}))}></sw-segmented></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${s("dayHours")}</label><sw-field><input id="bd-dh" class="ltr" placeholder="07:00-19:00" .value=${e.day_hours} @change=${i=>this.setD({day_hours:i.target.value.trim()})}></sw-field><span class="hint">${s("dayHoursHint")}</span></div>
            <div class="fld"><label for="bd-fs">${s("fontSize")}</label><sw-field><select id="bd-fs" data-v=${e.font_size} @change=${i=>this.setD({font_size:i.target.value})}>
              <option value="s">${s("fsS")}</option><option value="m">${s("fsM")}</option><option value="l">${s("fsL")}</option></select></sw-field></div></div>
          <div class="fld"><label class="ck"><input type="checkbox" .checked=${e.night.enabled} @change=${i=>this.setD({night:{...e.night,enabled:i.target.checked}})}>${s("nightDim")}</label>
            ${e.night.enabled?n`<div class="sum">${s("nightFrom")}<sw-field class="short"><input class="ltr" type="time" lang=${ue()} .value=${e.night.from} @change=${i=>this.setD({night:{...e.night,from:i.target.value}})}></sw-field>
              ${s("nightTo")}<sw-field class="short"><input class="ltr" type="time" lang=${ue()} .value=${e.night.to} @change=${i=>this.setD({night:{...e.night,to:i.target.value}})}></sw-field>
              ${s("nightLevel")}<sw-field class="short"><select data-v=${String(e.night.dim)} @change=${i=>this.setD({night:{...e.night,dim:Number(i.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(i=>n`<option value=${String(i)}>${Math.round(i*100)}%</option>`)}</select></sw-field></div>`:p}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${e.burn_in.shift} @change=${i=>this.setD({burn_in:{shift:i.target.checked}})}>${s("burnIn")}</label>
            <label class="ck"><input type="checkbox" .checked=${e.blocks.company_logo} @change=${i=>this.setD({blocks:{...e.blocks,company_logo:i.target.checked}})}>${s("companyLogo")}</label>
            <label class="ck"><input type="checkbox" checked disabled>${s("smplwiseLogo")}</label></div>
          <notice-display-design .display=${e} .defaults=${this.tv2Defaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-design>
          <notice-display-fit .display=${e} .defaults=${this.tvFitDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-fit>
          <notice-display-layout .display=${e} .defaults=${this.tvDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-layout>
          <notice-display-saver .display=${ke(e,this.tvDefaults())} @display-change=${i=>this.setD(i.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("whatShown")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${e.blocks.clock} @change=${i=>this.setD({blocks:{...e.blocks,clock:i.target.checked}})}>${s("blkClock")}</label>
            <div class="sub"><label class="ck"><input type="checkbox" .checked=${e.blocks.hebdate} @change=${i=>this.setD({blocks:{...e.blocks,hebdate:i.target.checked}})}>${s("blkHebdate")}</label>
              <label class="ck"><input type="checkbox" .checked=${e.blocks.welcome} @change=${i=>this.setD({blocks:{...e.blocks,welcome:i.target.checked}})}>${s("blkWelcome")}</label></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${e.blocks.weather} @change=${i=>this.setD({blocks:{...e.blocks,weather:i.target.checked}})}>${s("blkWeather")}</label>
            <div class="sub">${o.weather_entity?n`<span class="ltr mut">${o.weather_entity}</span>`:n`<span class="mut">${s("blkWeatherNoEntity")}</span>`}
              <span>${s("hoursAhead")}</span><sw-field class="short"><select data-v=${String(e.weather.hours)} @change=${i=>this.setD({weather:{hours:Number(i.target.value)}})}>${[3,5,8].map(i=>n`<option value=${String(i)}>${i}</option>`)}</select></sw-field></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${e.blocks.news} @change=${i=>this.setD({blocks:{...e.blocks,news:i.target.checked}})}>${s("blkNews")}</label>
            <div class="sub">${e.news.feeds.map((i,r)=>{const d=Us(i,o.news_sources);return n`<div class="feed" data-feed=${i.url}>${d.logo?n`<img class="flg" alt="" src=${d.logo}>`:n`<sw-icon name="link" size="12"></sw-icon>`}<b>${js(d.name)}</b>${d.known?p:n`<span class="chip">${s("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" @click=${()=>this.setD({news:{...e.news,feeds:e.news.feeds.filter((c,h)=>h!==r)}})}>${s("remove")}</sw-button></div>`})}
              <sw-field class="short"><select data-v=${this.feedPick} @change=${i=>this.feedPick=i.target.value}><option value="">${s("feedPick")}</option>
                ${o.news_sources.filter(i=>i.enabled!==!1).map(i=>n`<option value=${i.url}>${i.name}${i.custom?" · "+s("nsCustomTag"):""}</option>`)}${o.news_custom?n`<option value="custom">${s("feedCustom")}</option>`:p}</select></sw-field>
              ${this.feedPick==="custom"?n`<sw-field><input class="ltr" placeholder="https://" .value=${this.feedUrl} @input=${i=>this.feedUrl=i.target.value}></sw-field>`:p}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick||e.news.feeds.length>=6} @click=${()=>this.addFeed()}>${s("add")}</sw-button>
              <span>${s("speed")}</span><sw-segmented label=${s("speed")} value=${e.news.speed} @change=${i=>this.setD({news:{...e.news,speed:i.detail.value}})}
                .options=${["slow","normal","fast"].map(i=>({value:i,label:s(i==="slow"?"spSlow":i==="normal"?"spNormal":"spFast")}))}></sw-segmented></div></div>
          <notice-display-info .value=${e.blocks.info} .show=${e.blocks.info_show!==!1} .sources=${o.parking_entities?{parking:o.parking_entities,gym:o.gym_entities??[]}:null} @info-show-change=${i=>this.setD({blocks:{...e.blocks,info_show:i.detail}})} @info-change=${i=>this.setD({blocks:{...e.blocks,info:i.detail}})}></notice-display-info>
          <div class="blk"><span class="ck"><b>${s("blkNotices")}</b></span><span class="hint">${l.length} ${s("kpiActive")}</span>
            <div class="sub"><span>${s("mode")}</span><sw-segmented label=${s("mode")} data-mode-seg value=${e.mode} @change=${i=>this.setD({mode:i.detail.value})}
              .options=${["rotation","all","focus"].map(i=>({value:i,label:s(i==="rotation"?"modeRotation":i==="all"?"modeAll":"modeFocus"),attrs:{"data-mode":i}}))}></sw-segmented></div>
            <div class="sub"><span>${s("rotateEvery")}</span><sw-field class="short"><input class="num" type="number" min="6" max="60" step="1" data-rot .value=${String(e.rotate_s)}
              @change=${i=>this.setD({rotate_s:Math.max(6,Math.min(60,Math.round(Number(i.target.value)||12)))})}></sw-field><span>${s("seconds")}</span><span class="hint">${s("rotateHint")}</span></div>
            <div class="sub"><span>${s("urgent")}</span><sw-field><select data-urg data-v=${e.urgent==="band"?"stage":e.urgent} @change=${i=>this.setD({urgent:i.target.value})}>
              <option value="stage">${s("urgStage")}</option><option value="stay">${s("urgStay")}</option><option value="full">${s("urgFull")}</option></select></sw-field></div>
            <div class="sub"><span>${s("hold")}</span><sw-field><select data-hold data-v=${e.hold} @change=${i=>this.setD({hold:i.target.value})}>
              <option value="">${s("holdNone")}</option>${l.map(i=>n`<option value=${i.id}>${i.title}</option>`)}</select></sw-field><span class="hint">${s("holdHint")}</span></div>
            <p class="hint">${s("dwellNote")}</p></div>
          <notice-display-transit .display=${e} .v2Layout=${(i=>i.design==="v2"?i.board_layout:null)(te(e,this.tv2Defaults()))} @display-change=${i=>this.setD(i.detail)}></notice-display-transit>
          <notice-display-slides .display=${e} .lux=${["gallery","concierge","stone"].includes(te(e,this.tv2Defaults()).design)} .boardId=${this.detail.board.id} .boards=${this.boards} @display-change=${i=>this.setD(i.detail)} @slides-changed=${()=>this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`}addFeed(){const e=this.draft;if(!e)return;const t=this.feedPick,a=this.s.settings.news_sources.find(l=>l.url===t),o=a?{id:a.id,name:a.name,url:a.url}:t==="custom"&&this.feedUrl.startsWith("https://")?{name:new URL(this.feedUrl).hostname,url:this.feedUrl}:null;!o||e.news.feeds.some(l=>l.url===o.url)||(this.setD({news:{...e.news,feeds:[...e.news.feeds,o]},blocks:{...e.blocks,news:!0}}),this.feedPick="",this.feedUrl="")}noticesTab(){const e=this.detail,t=new Set(e.notices.map(d=>d.id)),a=this.notices.filter(d=>!t.has(d.id)&&(d.state==="active"||d.state==="scheduled"||d.state==="draft")),o=!!this.s?.can.manage,l=d=>o&&this.notices.some(c=>c.id===d&&c.state!=="archived"&&c.state!=="expired"),i=d=>d.state!=="active"?void 0:d.severity==="critical"?"bad":d.severity==="alert"?"warn":"info",r=[{key:"sev",label:s("colState"),kind:"status",render:d=>n`<span class="chip" data-tone=${i(d)??p}>${s(bt[d.severity])}${d.pinned?" · "+s("pinned"):""}</span>`},{key:"title",label:s("colNotice"),kind:"truncate",cellTitle:d=>d.title,render:d=>n`<span class="t1">${d.title}</span>`},{key:"window",label:s("colWindow"),kind:"muted",render:d=>gt(d)},{key:"act",label:"",kind:"actions",render:d=>n`${l(d.id)?n`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(d.id)}>${s("edit")}</sw-button>`:p}
          <sw-button size="sm" @click=${()=>this.removeItem(d.id)}>${s("removeFromBoard")}</sw-button>`}];return n`<div class="panel flush">
      <div class="toolbar"><h2>${s("boardNotices")}</h2><span class="chip num">${e.notices.filter(d=>d.state==="active").length} ${s("kpiActive")}</span><span class="sp"></span>
        ${a.length?n`<sw-field class="short"><select data-add-notice @change=${d=>this.addItem(d.target.value)}><option value="">${s("addToBoard")}…</option>
          ${a.map(d=>n`<option value=${d.id}>${d.title}</option>`)}</select></sw-field>`:p}
        ${o?n`<sw-button variant="primary" icon="plus" data-board-compose @click=${()=>this.newNotice(e.board.id)}>${s("newForBoard")}</sw-button>`:p}</div>
      ${e.notices.length?n`<sw-table class="t" bare static-rows data-board-notices .columns=${r} .rows=${e.notices}
          .rowAttrs=${d=>({"data-board-notice":String(d.id),"data-look":d.state==="active"?ft[d.severity]:"off"})}></sw-table>`:n`<sw-state-panel icon="inbox" state="empty" heading=${s("boardEmpty")}
            actionLabel=${o?s("newForBoard"):""} @action=${()=>this.newNotice(e.board.id)}></sw-state-panel>`}
    </div>`}async addItem(e){!e||!this.detail||await this.setItems([...this.detail.notices.map(t=>t.id),e])}async removeItem(e){this.detail&&await this.setItems(this.detail.notices.map(t=>t.id).filter(t=>t!==e))}async setItems(e){try{await mt(this.detail.board.id,e),this.detail=await J(this.detail.board.id),this.say(s("saved"))}catch(t){this.say($(t))}}async saveBoard(e){if(this.detail)try{const t=await he(this.detail.board.id,e);this.detail={...this.detail,board:t.board},this.draft=structuredClone(t.board.display??this.draft),this.dirty=!1,this.say(s("saved")),this.loadBoards()}catch(t){this.say($(t))}}async saveAll(){const e={};this.draft&&this.dirty&&(e.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(e.name=this.nameDraft.trim()),await this.saveBoard(e)}async rotate(e,t){try{const a=await $t(e.id);this.link={board:a.board,token:a.token,rotated:!0},this.detail?.board.id===a.board.id&&(this.detail={...this.detail,board:a.board}),this.loadBoards(),t&&navigator.clipboard?.writeText(this.linkUrl(a.board,a.token)).then(()=>this.say(s("copied")),()=>{})}catch(a){this.say($(a))}}rotateDialog(){const e=this.confirmRotate;return n`<sw-dialog ?open=${!!e} heading=${e?s("copyAsk",{name:e.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      ${e?.legacy?n`<p data-no-stored-link>${s("noStoredLink")}</p>`:p}
      <p>${s("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${()=>{const t=this.confirmRotate;this.confirmRotate=null,t&&this.rotate(t.board,t.copy)}}>${s("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return n`<sw-dialog ?open=${this.confirmDelete} heading=${s("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${s("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${s("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await wt(this.detail.board.id),this.confirmDelete=!1,location.hash=ee,await this.loadBoards()}catch(e){this.say($(e))}}};b.styles=[yt,kt,x,R`
      /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (one field look for the whole
         form); the short fields (days, connections, the night hours, the dim level, the forecast hours, the feed and notice pickers) keep
         their 90 px */
      sw-field.short { inline-size: 90px; }
      /* CR-CMP2-TABLES-REST-2470 (owner N10): the boards and a board's notices are the shared table inside their panel (no second card,
         never wider than the panel; the module's 10 / 12 px cells) */
      sw-table.t { --sw-table-min: 0; --sw-table-cell-pad: 10px 12px; }
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
      .link code { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; direction: ltr; text-align: start; font-size: var(--sw-fs-xs); color: var(--sw-text); }
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
    `];f([g()],b.prototype,"boardId",2);f([u()],b.prototype,"s",2);f([u()],b.prototype,"boards",2);f([u()],b.prototype,"error",2);f([u()],b.prototype,"forbidden",2);f([u()],b.prototype,"toast",2);f([u()],b.prototype,"creating",2);f([u()],b.prototype,"link",2);f([u()],b.prototype,"detail",2);f([u()],b.prototype,"tab",2);f([u()],b.prototype,"draft",2);f([u()],b.prototype,"dirty",2);f([u()],b.prototype,"nameDraft",2);f([u()],b.prototype,"notices",2);f([u()],b.prototype,"feedPick",2);f([u()],b.prototype,"feedUrl",2);f([u()],b.prototype,"confirmDelete",2);f([u()],b.prototype,"confirmRotate",2);f([u()],b.prototype,"placeOther",2);f([u()],b.prototype,"sendToTvs",2);f([u()],b.prototype,"compose",2);f([u()],b.prototype,"floors",2);f([u()],b.prototype,"groups",2);f([u()],b.prototype,"roles",2);b=f([_("system-notices")],b);export{b as SystemNotices};
