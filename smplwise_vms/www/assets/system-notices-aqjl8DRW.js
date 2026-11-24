import{aw as v,i as _,b as o,lr as t,A as p,k as x,bE as Ce,bF as Ee,cW as Ne,xc as Te,g as A,a0 as w,j as u,xd as Pe,m as $,xe as Be,xf as Ie,xg as Re,xh as Ae,xi as He,xj as Fe,xk as We,xl as Ue,xm as je,xn as Me,xo as Ge,xp as qe,xq as Ve,xr as Ye,a as ke,xs as Xe,xt as V,xu as Ke,qn as Je,xv as ee,qm as he,qo as Qe,xw as Ze,qA as es,qz as ss,xx as ts,xy as as,dS as is,xz as ls,xA as ns,xB as os,xC as rs,xD as ds,xE as ue,qp as se,xF as cs,xG as ps,xH as hs,xI as us,xJ as bs,xK as gs,e6 as be,lA as vs,qx as fs,qu as ms,xL as $s,xM as ws,xN as ys,bf as ks}from"./index-DD6xpkEV.js";import{a as _s}from"./settings-Cl1syeZQ.js";import"./sw-table-JCPs9pBi.js";import{qrSvg as xs}from"./sw-second-factor-DsxMsB47.js";import{$ as Ss,X as Ds,_ as Os,W as zs,aa as Ls,ab as _e,V as Cs,ac as Es,ad as Ns,ae as Ts,af as Ps,ag as Bs,ah as Is,ai as te,aj as Rs,a3 as As,ak as Hs,al as Fs,am as Ws,an as Us,ao as js,ap as Ms,q as Gs,aq as qs,ar as Vs}from"./transit-logic-C-J7tGXg.js";import"./compose-dialog-C9tb-Dnm.js";import{n as S}from"./styles-CnNmiUdL.js";import{l as F}from"./live-DwhQkxYL.js";import{t as Ys,i as Xs,b,w as Ks,R as j,j as M,k as Js,W as Qs,l as Zs,n as T,f as G,D as q}from"./model-4tu5mvd0.js";import{a as et}from"./activate-keys-CrBsenYs.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";var st=Object.defineProperty,tt=Object.getOwnPropertyDescriptor,xe=(e,s,a,l)=>{for(var n=l>1?void 0:l?tt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&st(s,a,n),n};let Y=class extends _{emit(e){this.dispatchEvent(new CustomEvent("display-change",{detail:e,bubbles:!0,composed:!0}))}render(){if(!this.display)return o``;const e=Ss(this.display),s=Ds(this.display),a=Os.map(i=>[i,t(`saver_${i}`)]),l=[["a",t("logos_a")],["b",t("logos_b")],["c",t("logos_c")]],n=zs(this.display)!=="c";return o`<div class="r">
      <div class="fld"><span class="lbl">${t("saverLabel")}</span><sw-segmented data-saver-seg value=${e} @change=${i=>this.emit({saver:i.detail.value})}
        .options=${a.map(([i,r])=>({value:i,label:r,attrs:{"data-saver":i}}))}></sw-segmented></div>
      <div class="fld"><span class="lbl">${t("logosLabel")}</span><sw-segmented data-logos-seg value=${s} ?disabled=${n} @change=${i=>this.emit({logos:i.detail.value})}
        .options=${l.map(([i,r])=>({value:i,label:r,attrs:{"data-logos":i}}))}></sw-segmented>
        ${n?o`<span class="hint">${t("logosOnlyHeaderC")}</span>`:p}</div>
    </div>`}};Y.styles=[S];xe([v({attribute:!1})],Y.prototype,"display",2);Y=xe([x("notice-display-saver")],Y);var at=Object.defineProperty,it=Object.getOwnPropertyDescriptor,K=(e,s,a,l)=>{for(var n=l>1?void 0:l?it(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&at(s,a,n),n};const lt=[{key:"header",seg:"header",label:"headerLabel",values:Cs,text:e=>t(`header_${e}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:Es,text:e=>t(`updated_${e}`)},{key:"space",seg:"space",label:"spaceLabel",values:Ns,text:e=>t(`space_${e}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:Ts,text:e=>t(`nightLogo_${e}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:Ps,text:e=>e===0?t("weatherDays_0"):e===1?t("weatherDays_1"):t("weatherDays_n",{n:e})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:Bs,text:e=>t(`idleLogo_${e}`)}];let P=class extends _{constructor(){super(...arguments),this.defaults=Ls,this.mode="board"}emit(e,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:s},bubbles:!0,composed:!0}))}row(e,s,a,l,n){const i=this.mode==="board",r=e.key==="space"&&a==="c"||i&&e.key==="night_logo"&&!l||i&&e.key==="weather_days"&&!n,d=e.text(this.defaults[e.key]),c=e.key==="space"&&r?t("spaceOnlyOneRow"):i&&s===null?t("tvDefaultNow",{v:d}):"";return o`<div class="fld"><span class="lbl">${t(e.label)}</span>
      <sw-segmented label=${t(e.label)} data-seg=${e.seg} value=${s===null?"__default__":String(s)} ?disabled=${r}
        @change=${h=>{if(h.detail.value==="__default__")this.emit(e.key,null);else{const y=e.values.find(z=>String(z)===h.detail.value);y!==void 0&&this.emit(e.key,y)}}}
        .options=${[...i?[{value:"__default__",label:t("tvUseDefault"),title:d,attrs:{"data-v":"default"}}]:[],...e.values.map(h=>({value:String(h),label:e.text(h),attrs:{"data-v":String(h)}}))]}></sw-segmented>
      ${c?o`<span class="hint" data-default-note>${c}</span>`:p}</div>`}render(){const e=this.mode==="board";if(e&&!this.display)return o``;const s=this.display??{},a=L=>e?s[L]??null:this.defaults[L],l=e?_e(s,this.defaults):this.defaults,n=!!s.blocks?.company_logo,i=!!s.blocks?.weather,[r,d,c,h,y,z]=lt.map(L=>this.row(L,a(L.key),l.header,n,i));return o`<div class="r">${r}${d}</div><div class="r">${c}${h}</div><div class="r">${y}${z}</div>`}};P.styles=[S];K([v({attribute:!1})],P.prototype,"display",2);K([v({attribute:!1})],P.prototype,"defaults",2);K([v()],P.prototype,"mode",2);P=K([x("notice-display-layout")],P);var nt=Object.defineProperty,ot=Object.getOwnPropertyDescriptor,J=(e,s,a,l)=>{for(var n=l>1?void 0:l?ot(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&nt(s,a,n),n};const rt=[{key:"design",seg:"design",label:"designLabel",values:Rs},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:As},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:Hs},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:Fs},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:Ws},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:Us},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:js},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:Ms}],dt={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},ge=(e,s)=>t(`${dt[e]}${s}`);let B=class extends _{constructor(){super(...arguments),this.defaults=Is,this.mode="board"}emit(e,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:s},bubbles:!0,composed:!0}))}row(e,s,a){const l=this.mode==="board",n=e.key==="live_bg"||e.key==="systems_status"||e.key==="urgent_screen",i=l&&e.key!=="design"&&!n&&!a,r=ge(e.key,this.defaults[e.key]),d=e.key==="board_layout"&&!l?t("boardLayoutDefaultLabel"):t(e.label),c=i?t("v2Only"):l&&s===null?t("tvDefaultNow",{v:r}):"";return o`<div class="fld"><span class="lbl">${d}</span>
      <sw-segmented label=${d} data-seg=${e.seg} value=${s===null?"__default__":s} ?disabled=${i}
        @change=${h=>this.emit(e.key,h.detail.value==="__default__"?null:h.detail.value)}
        .options=${[...l?[{value:"__default__",label:t("tvUseDefault"),title:r,attrs:{"data-v":"default"}}]:[],...e.values.map(h=>({value:h,label:ge(e.key,h),attrs:{"data-v":h}}))]}></sw-segmented>
      ${c?o`<span class="hint" data-default-note>${c}</span>`:p}</div>`}render(){const e=this.mode==="board";if(e&&!this.display)return o``;const s=this.display??{},a=H=>e?s[H]??null:this.defaults[H],n=(e?te(s,this.defaults):this.defaults).design==="v2",[i,r,d,c,h,y,z,L]=rt.map(H=>this.row(H,a(H.key),n));return o`<div class="r" data-tv2>${i}${r}</div><div class="r">${d}${c}</div><div class="r">${h}</div><div class="r" data-lobby>${y}${z}</div><div class="r">${L}</div>`}};B.styles=[S];J([v({attribute:!1})],B.prototype,"display",2);J([v({attribute:!1})],B.prototype,"defaults",2);J([v()],B.prototype,"mode",2);B=J([x("notice-display-design")],B);const ct=["rows","drop"],pt=[0,1,2,3,4,5],ae={portrait_chips:"drop",safe_margin:0},Se=e=>e==="rows"||e==="drop",De=e=>typeof e=="number"&&Number.isInteger(e)&&e>=0&&e<=5;function ht(e,s){const a=e?.[s];return s==="portrait_chips"?Se(a)?a:null:De(a)?a:null}function ut(e){return{portrait_chips:Se(e?.portrait_chips)?e.portrait_chips:ae.portrait_chips,safe_margin:De(e?.safe_margin)?e.safe_margin:ae.safe_margin}}function bt(e,s){return e==="portrait_chips"?[s==="drop"?"portraitChips_drop":"portraitChips_rows"]:s===0?["safeMargin_0"]:["safeMargin_pct",{n:s}]}var gt=Object.defineProperty,vt=Object.getOwnPropertyDescriptor,Q=(e,s,a,l)=>{for(var n=l>1?void 0:l?vt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&gt(s,a,n),n};const ve=(e,s)=>{const[a,l]=bt(e,s);return t(a,l)};let I=class extends _{constructor(){super(...arguments),this.defaults=ae,this.mode="board"}emit(e,s){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[e]:s},bubbles:!0,composed:!0}))}row(e,s,a,l,n){const i=this.mode==="board",r=i?ht(this.display,e):this.defaults[e],d=ve(e,this.defaults[e]);return o`<div class="fld" data-tv-fit=${e}><span class="lbl">${l}</span>
      <sw-segmented label=${l} data-seg=${s} value=${r===null?"__default__":String(r)}
        @change=${c=>{if(c.detail.value==="__default__")this.emit(e,null);else{const h=a.find(y=>String(y)===c.detail.value);h!==void 0&&this.emit(e,h)}}}
        .options=${[...i?[{value:"__default__",label:t("tvUseDefault"),title:d,attrs:{"data-v":"default"}}]:[],...a.map(c=>({value:String(c),label:ve(e,c),attrs:{"data-v":String(c)}}))]}></sw-segmented>
      ${i&&r===null?o`<span class="hint" data-default-note>${t("tvDefaultNow",{v:d})}</span>`:p}
      <span class="hint">${n}</span></div>`}render(){return this.mode==="board"&&!this.display?o``:o`<div class="r" data-tv-fit-rows>
      ${this.row("portrait_chips","portrait-chips",ct,t("portraitChipsLabel"),t("portraitChipsHint"))}
      ${this.row("safe_margin","safe-margin",pt,t("safeMarginLabel"),t("safeMarginHint"))}</div>`}};I.styles=[S];Q([v({attribute:!1})],I.prototype,"display",2);Q([v({attribute:!1})],I.prototype,"defaults",2);Q([v()],I.prototype,"mode",2);I=Q([x("notice-display-fit")],I);const de={orderHint:"הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.",moveUp:"הזזה למעלה: {k}",moveDown:"הזזה למטה: {k}",noSource:"אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.",sourcesTitle:"מקורות לסמלי החניה וחדר הכושר",sourcesHint:"הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.",parkingLabel:"חניה",parkingHint:"מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.",gymLabel:"חדר כושר",gymHint:"מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.",pick:"בחירת ישות",add:"הוספה",remove:"הסרה",removeOne:"הסרה: {n}",none:"לא נבחרה ישות",noCandidates:"אין ישויות מתאימות",max:"עד {n} ישויות",gone:"לא נמצאה",invert:"הפוך",invertOne:"הפוך: {n}",invertParking:"הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס).",invertGym:"הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי."},Oe=Ce("en","i18n/notice-chips","en"),ft={he:de,en:Oe};function m(e,s,a=Te()){const l=ft[a][e]??de[e]??e;return Ne(l,s)}Ee("i18n/notice-chips",{he:de,en:Oe});const ce=["elevators","generator","parking","gym"],ie=8,mt=e=>ce.includes(e);function pe(e){return[...new Set((e??[]).filter(mt))]}function $t(e){const s=pe(e),a=ce.filter(l=>!s.includes(l));return[...s.map((l,n)=>({kind:l,on:!0,pos:n,count:s.length})),...a.map(l=>({kind:l,on:!1,pos:-1,count:s.length}))]}function wt(e,s,a){const l=pe(e).filter(n=>n!==s);return a?[...l,s]:l}function fe(e,s,a){const l=pe(e),n=l.indexOf(s),i=n+a;return n<0||i<0||i>=l.length||([l[n],l[i]]=[l[i],l[n]]),l}function yt(e,s){return!s||e!=="parking"&&e!=="gym"?!1:!s[e]?.length}function kt(e,s){return!s||e.includes(s)||e.length>=ie?[...e]:[...e,s]}function _t(e,s){return e.filter(a=>a!==s)}function xt(e,s){return(e??[]).filter(a=>!s.includes(a.entity_id))}const St=["binary_sensor","input_boolean","switch","schedule"];function le(e){return St.includes(e.split(".")[0]??"")}function Dt(e,s,a,l){const n=new Set(s.filter(i=>i!==a));return l&&n.add(a),e.filter(i=>n.has(i)&&le(i))}function Ot(e,s){return(e??[]).find(a=>a.entity_id===s)?.name??null}var zt=Object.defineProperty,Lt=Object.getOwnPropertyDescriptor,Z=(e,s,a,l)=>{for(var n=l>1?void 0:l?Lt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&zt(s,a,n),n};const Ct={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let R=class extends _{constructor(){super(...arguments),this.value=[],this.show=!0,this.sources=null}emit(e){this.dispatchEvent(new CustomEvent("info-change",{detail:[...e],bubbles:!0,composed:!0}))}render(){const e=this.value.length>0,s=$t(this.value);return o`<div class="blk" data-info-picker>
      <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("infoShow")} data-info-show .checked=${this.show} @change=${a=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:w(a),bubbles:!0,composed:!0}))}></sw-toggle>${t("infoShow")}</label>
      <p class="help" data-info-help>${t("infoOldBoards")}</p>
      <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkInfo")} .checked=${e} @change=${a=>this.emit(w(a)?[...ce]:[])}></sw-toggle>${t("blkInfo")}</label>
      <ol class="ord" data-info-order>${s.map(a=>{const l=t(Ct[a.kind]);return o`<li data-info-row=${a.kind} data-on=${String(a.on)}>
          <label class="ck"><input type="checkbox" data-info=${a.kind} .checked=${a.on} @change=${n=>this.emit(wt(this.value,a.kind,n.target.checked))}>${l}</label>
          ${a.on?o`<button type="button" class="mv up" data-info-up=${a.kind} aria-label=${m("moveUp",{k:l})} title=${m("moveUp",{k:l})} ?disabled=${a.pos<=0}
              @click=${()=>this.emit(fe(this.value,a.kind,-1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${a.kind} aria-label=${m("moveDown",{k:l})} title=${m("moveDown",{k:l})} ?disabled=${a.pos>=a.count-1}
              @click=${()=>this.emit(fe(this.value,a.kind,1))}><sw-icon name="chevron" size="14"></sw-icon></button>`:p}
          ${a.on&&yt(a.kind,this.sources)?o`<span class="note" data-info-no-source=${a.kind}>${m("noSource")}</span>`:p}
        </li>`})}</ol>
      <p class="hint" data-info-order-hint>${t("infoIconsOnly")}. ${m("orderHint")}</p>
    </div>`}};R.styles=A`
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
  `;Z([v({attribute:!1})],R.prototype,"value",2);Z([v({type:Boolean})],R.prototype,"show",2);Z([v({attribute:!1})],R.prototype,"sources",2);R=Z([x("notice-display-info")],R);var Et=Object.defineProperty,Nt=Object.getOwnPropertyDescriptor,N=(e,s,a,l)=>{for(var n=l>1?void 0:l?Nt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Et(s,a,n),n};let O=class extends _{constructor(){super(...arguments),this.parking=[],this.gym=[],this.candidates={},this.inverted={},this.disabled=!1,this.pick={parking:"",gym:""}}emit(e,s){this.send({[`${e}_entities`]:s})}send(e){this.dispatchEvent(new CustomEvent("info-sources-change",{detail:e,bubbles:!0,composed:!0}))}one(e){const s=e==="parking"?this.parking:this.gym,a=this.candidates[e]??[],l=xt(a,s),n=s.length>=ie,i=m(e==="parking"?"parkingLabel":"gymLabel"),r=this.inverted[e]??[],d=m(e==="parking"?"invertParking":"invertGym"),c=`ns-src-${e}`;return o`<div class="src fld" data-info-source=${e}>
      <label for=${c}>${i}</label>
      ${s.length?o`<ul class="picked" data-info-source-list>${s.map(h=>{const y=Ot(a,h);return o`<li class=${y===null?"gone":""} data-info-source-item=${h}><span>${y??m("gone")}</span>
          ${le(h)?o`<label class="inv" title=${d}><sw-toggle size="sm" labelHidden in-label data-info-source-invert
            label=${m("invertOne",{n:y??m("gone")})} .checked=${r.includes(h)} ?disabled=${this.disabled}
            @change=${z=>this.send({[`${e}_inverted`]:Dt(s,r,h,w(z))})}></sw-toggle>${m("invert")}</label>`:p}
          <button type="button" aria-label=${m("removeOne",{n:y??m("gone")})} ?disabled=${this.disabled} @click=${()=>this.emit(e,_t(s,h))}>${m("remove")}</button></li>`})}</ul>`:o`<span class="mut" data-info-source-none>${m("none")}</span>`}
      <div class="row">
        <select id=${c} class="inp" data-info-source-pick .value=${this.pick[e]} ?disabled=${this.disabled||n||!l.length}
          @change=${h=>this.pick={...this.pick,[e]:h.target.value}}>
          <option value="">${l.length?m("pick"):m("noCandidates")}</option>
          ${l.map(h=>o`<option value=${h.entity_id}>${h.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled||n||!this.pick[e]}
          @click=${()=>{const h=this.pick[e];this.pick={...this.pick,[e]:""},this.emit(e,kt(s,h))}}>${m("add")}</button>
        ${n?o`<span class="mut">${m("max",{n:ie})}</span>`:p}
      </div>
      <span class="hint">${m(e==="parking"?"parkingHint":"gymHint")}</span>
      ${s.some(le)?o`<span class="hint" data-info-source-invert-hint>${d}</span>`:p}
    </div>`}render(){return o`<div class="srcs" data-info-sources>
      <span class="lbl">${m("sourcesTitle")}</span>
      <span class="hint">${m("sourcesHint")}</span>
      ${this.one("parking")}
      ${this.one("gym")}
    </div>`}};O.styles=[S,A`
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
  `];N([v({attribute:!1})],O.prototype,"parking",2);N([v({attribute:!1})],O.prototype,"gym",2);N([v({attribute:!1})],O.prototype,"candidates",2);N([v({attribute:!1})],O.prototype,"inverted",2);N([v({type:Boolean})],O.prototype,"disabled",2);N([u()],O.prototype,"pick",2);O=N([x("notice-info-sources")],O);var Tt=Object.defineProperty,Pt=Object.getOwnPropertyDescriptor,D=(e,s,a,l)=>{for(var n=l>1?void 0:l?Pt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Tt(s,a,n),n};let k=class extends _{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await Pe(this.boardId)}catch(e){this.err=$(e)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(e){this.err="",this.confirming=!1,this.dlg={id:e.id,title:e.title,text:e.text,seconds:e.seconds?String(e.seconds):"",boards:[...e.boards],hasImage:e.has_image,removeImage:!1,file:null}}set(e){this.dlg&&(this.dlg={...this.dlg,...e})}async save(){const e=this.dlg;if(!e||!e.title.trim())return;const s=e.seconds.trim()===""?null:Number(e.seconds);this.busy=!0,this.err="";try{const a={title:e.title.trim(),text:e.text.trim(),seconds:s,board_ids:e.boards};let l=e.id;l?await Be(l,a):l=(await Ie(a)).id,e.file?await Re(l,e.file):e.removeImage&&e.hasImage&&await Ae(l),this.dlg=null,await this.load(),this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}async removeSlide(){const e=this.dlg;if(e?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await He(e.id),this.dlg=null,await this.load(),this.changed()}catch(s){this.err=$(s)}finally{this.busy=!1,this.confirming=!1}}}async photo(e,s=!1){this.busy=!0,this.err="";try{const a=s?e?await Fe(this.boardId,e):await We(this.boardId):e?await Ue(this.boardId,e):await je(this.boardId);this.doc={...this.doc??a,photo:a.photo,photo_night:a.photo_night},this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}pickBoard(e){const s=this.dlg;s&&this.set({boards:s.boards.includes(e)?s.boards.filter(a=>a!==e):[...s.boards,e]})}dialog(){const e=this.dlg;if(!e)return o`<sw-dialog></sw-dialog>`;const s=this.doc?.seconds.min??6,a=this.doc?.seconds.max??120,l=e.file?e.file.name:e.hasImage&&!e.removeImage?t("slidePicture"):t("slideNoPicture");return o`<sw-dialog open data-slide-dialog heading=${e.id?t("slideEditTitle"):t("slideNew")} @close=${()=>this.dlg=null}>
      <div class="form">
        <div class="fld"><label for="sl-title">${t("slideTitle")}</label><input id="sl-title" class="inp" maxlength="80" .value=${e.title} @input=${n=>this.set({title:n.target.value})}></div>
        <div class="fld"><label for="sl-text">${t("slideText")}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${e.text} @input=${n=>this.set({text:n.target.value})}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${t("slideSeconds")}</label><input id="sl-sec" class="inp short num" type="number" min=${s} max=${a} .value=${e.seconds} @input=${n=>this.set({seconds:n.target.value})}></div>
          <div class="fld"><span class="lbl">${t("slidePicture")}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${()=>this.renderRoot.querySelector("[data-slide-file]").click()}>${t("slidePick")}</sw-button>
              <span class="nm">${l}</span>
              ${e.file||e.hasImage&&!e.removeImage?o`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${()=>this.set({file:null,removeImage:!0})}>${t("slideRemovePicture")}</sw-button>`:p}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${n=>this.set({file:n.target.files?.[0]??null,removeImage:!1})}></div></div>
        </div>
        ${this.boards.length>1?o`<div class="fld"><span class="lbl">${t("slideBoards")}</span>
          <div class="chips" data-slide-boards>${this.boards.map(n=>o`<button class="pick" aria-pressed=${String(e.boards.includes(n.id))} data-slide-board=${n.id} @click=${()=>this.pickBoard(n.id)}>${n.name}</button>`)}</div></div>`:p}
      </div>
      ${this.err?o`<p class="err" role="alert" data-slide-error>${this.err}</p>`:p}
      ${e.id?o`<sw-button slot="footer" variant=${this.confirming?"danger":"ghost"} ?disabled=${this.busy} data-slide-delete @click=${()=>this.removeSlide()}>${this.confirming?t("slideDeleteConfirm"):t("slideDelete")}</sw-button>`:o`<sw-button slot="footer" variant="ghost" @click=${()=>this.dlg=null}>${t("cancel")}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy||!e.title.trim()} data-slide-save @click=${()=>this.save()}>${t("save")}</sw-button>
    </sw-dialog>`}render(){if(!this.display)return o``;const e=this.doc?.slides??[],s=this.doc?.limit??10,a=this.display.rotate_s||12,l=e.reduce((r,d)=>r+(d.seconds||a),0),n=this.doc?.photo,i=this.doc?.photo_night;return o`<div class="blk" data-slides>
        <div class="head"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("slidesBlock")} data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(w(r))}></sw-toggle>${t("slidesBlock")}</label>
          <span class="st num" data-slides-count>${t("slidesCount",{n:e.length,s:l})}</span></div>
        <div class="slides" data-slide-grid>${e.map(r=>o`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?o`<img alt="" src=${Me(r)}>`:o`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${t("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${e.length>=s} title=${t("slideLimit",{n:s})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${t("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?o`<div class="blk" data-photo-block><span class="ck"><b>${t("photoBlock")}</b></span>
        <div class="photo"><div class="th">${n?.has?o`<img alt="" data-photo-img src=${Ge(this.boardId,n.stamp)}>`:o`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${n?.has?t("photoReplace"):t("photoUpload")}</sw-button>
          ${n?.has?o`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${t("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const d=r.target,c=d.files?.[0];d.value="",c&&this.photo(c)}}></div>
        ${!this.dlg&&this.err?o`<p class="err" role="alert" data-photo-error>${this.err}</p>`:p}</div>`:p}
      ${this.lux?o`<div class="blk" data-photo-night-block><span class="ck"><b>${t("photoNightBlock")}</b></span><span class="hint">${t("photoNightHint")}</span>
        <div class="photo"><div class="th">${i?.has?o`<img alt="" data-photo-night-img src=${qe(this.boardId,i.stamp)}>`:o`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${i?.has?t("photoReplace"):t("photoUpload")}</sw-button>
          ${i?.has?o`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${t("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const d=r.target,c=d.files?.[0];d.value="",c&&this.photo(c,!0)}}></div></div>`:p}
      ${this.dialog()}`}emitPromo(e){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:e}},bubbles:!0,composed:!0}))}};k.styles=[S,A`
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
    `];D([v({attribute:!1})],k.prototype,"display",2);D([v({attribute:!1})],k.prototype,"boardId",2);D([v({type:Boolean})],k.prototype,"lux",2);D([v({attribute:!1})],k.prototype,"boards",2);D([u()],k.prototype,"doc",2);D([u()],k.prototype,"dlg",2);D([u()],k.prototype,"err",2);D([u()],k.prototype,"busy",2);D([u()],k.prototype,"confirming",2);k=D([x("notice-display-slides")],k);var Bt=Object.defineProperty,It=Object.getOwnPropertyDescriptor,W=(e,s,a,l)=>{for(var n=l>1?void 0:l?It(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Bt(s,a,n),n};let C=class extends _{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await Ys()}catch{this.failed=!0}}get scr(){return Gs(this.display)}emit(e){const s=(this.t?.config.stops??[]).map(l=>l.code),a=Xs(this.scr,e,s);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:a},bubbles:!0,composed:!0}))}render(){if(!this.display)return o``;const e=this.scr,s=this.t?.config.stops??[],a=!!this.t?.config.enabled&&s.length>0,l=document.documentElement.lang?.startsWith("en")?"en":"he",n=[["side",b("lay_side"),b("lay_side_hint")],["strip",b("lay_strip"),b("lay_strip_hint")],["slide",b("lay_slide"),b("lay_slide_hint")]],i=[["auto",b("grp_auto")],["always",b("grp_always")],["never",b("grp_never")]],r=Ks(e.window_min),d=e.stops.length?e.stops:s.map(c=>c.code);return o`<div class="blk" data-transit-block>
      <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${`${b("scrTitle")} - ${b("scrShow")}`} data-transit-show .checked=${e.enabled} @change=${c=>this.emit({enabled:w(c)})}></sw-toggle><b>${b("scrTitle")}</b> - ${b("scrShow")}</label>
      ${a?p:o`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?b("forbiddenHint"):b("scrOffModule")}</span>
        <a href="#/system/transit">${b("scrGo")}</a></div>`}
      ${e.enabled&&a?o`
        <div class="sub" data-transit-stops>
          <span>${b("scrStops")}</span>
          ${s.map(c=>o`<label class="ck"><input type="checkbox" data-transit-stop=${c.code} .checked=${F(d.includes(c.code))}
            @change=${()=>this.emit({stops:Js(e.stops,c.code,s.map(h=>h.code))})}>${c.name||c.catalogue_name||c.code}</label>`)}
          ${e.stops.length===0?o`<span class="hint">${b("scrStopsAll")}</span>`:p}
        </div>
        ${this.v2Layout?p:o`<div class="sub"><span>${b("scrLayout")}</span><sw-segmented data-transit-layout value=${e.layout} @change=${c=>this.emit({layout:c.detail.value})}
          .options=${n.map(([c,h,y])=>({value:c,label:h,title:y,attrs:{"data-layout":c}}))}></sw-segmented></div>`}
        <div class="sub"><span>${b("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(e.window_min):"free"} @change=${c=>{const h=c.target.value;this.emit({window_min:h==="free"?45:Number(h)})}}>${Qs.map(c=>o`<option value=${String(c)} ?selected=${r==="list"&&e.window_min===c}>${Zs(c,l)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${b("scrWindowFree")}</option></select>
          ${r==="free"?o`<input class="inp short num" type="number" data-transit-window-free min=${T[0]} max=${T[1]} step="1" .value=${F(String(e.window_min))}
            title=${b("scrFree",{a:T[0],b:T[1]})}
            @change=${c=>this.emit({window_min:G(c.target.value,T[0],T[1],e.window_min)})}>`:p}
        </div>
        <div class="sub"><span>${b("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${j[0]} max=${j[1]} step="1" .value=${F(String(e.rows))}
          @change=${c=>this.emit({rows:G(c.target.value,j[0],j[1],e.rows)})}>
          <span>${b("scrGroup")}</span><select class="inp" data-transit-group .value=${e.group} @change=${c=>this.emit({group:c.target.value})}>
            ${i.map(([c,h])=>o`<option value=${c} ?selected=${e.group===c}>${h}</option>`)}</select></div>
        <div class="sub"><span>${b("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${M[0]} max=${M[1]} step="1"
          placeholder=${b("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${F(e.refresh_s==null?"":String(e.refresh_s))}
          @change=${c=>{const h=c.target.value.trim();this.emit({refresh_s:h===""?null:G(h,M[0],M[1],20)})}}>
          <span>${b("scrDistance")}</span><select class="inp" data-transit-distance .value=${e.show_distance==null?"inherit":e.show_distance?"on":"off"} @change=${c=>{const h=c.target.value;this.emit({show_distance:h==="inherit"?null:h==="on"})}}>${[["inherit",b("scrDistInherit")],["on",b("scrDistOn")],["off",b("scrDistOff")]].map(([c,h])=>o`<option value=${c} ?selected=${(e.show_distance==null?"inherit":e.show_distance?"on":"off")===c}>${h}</option>`)}</select></div>
        ${(this.v2Layout??e.layout)==="slide"?o`<div class="sub"><span>${b("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${q[0]} max=${q[1]} step="1" .value=${F(String(e.dwell_s))}
          @change=${c=>this.emit({dwell_s:G(c.target.value,q[0],q[1],e.dwell_s)})}></div>`:p}
      `:p}
    </div>`}};C.styles=[S,A`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];W([v({attribute:!1})],C.prototype,"display",2);W([v({attribute:!1})],C.prototype,"v2Layout",2);W([u()],C.prototype,"t",2);W([u()],C.prototype,"failed",2);C=W([x("notice-display-transit")],C);const ne=40,oe=12,Rt="image/png,image/jpeg",At=3e5;function me(e){return e.map(s=>({id:s.id,name:s.name,url:s.url,enabled:s.enabled!==!1,has_logo:!!s.has_logo,logo_url:s.logo_url||"",custom:!!s.custom,last_ok_at:s.last_ok_at??null,last_error:s.last_error??null}))}function Ht(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1,last_ok_at:null,last_error:null}}const Ft={status:"nsWhyStatus",size:"nsWhySize",xml:"nsWhyXml",timeout:"nsWhyTimeout",dns:"nsWhyDns",tls:"nsWhyTls",network:"nsWhyNetwork",encoding:"nsWhyEncoding",empty:"nsWhyEmpty",redirect:"nsWhyRedirect",redirects:"nsWhyRedirect",syntax:"nsWhyBlocked",scheme:"nsWhyBlocked",credentials:"nsWhyBlocked",port:"nsWhyBlocked",name:"nsWhyBlocked",address:"nsWhyBlocked"};function Wt(e,s){if(!e.id||!e.last_error)return null;const a=s.find(l=>l.id===e.id);return!a||a.url.trim()!==e.url.trim()?null:{why:Ft[e.last_error]??"nsWhyOther",code:e.last_error,lastOk:e.last_ok_at}}function Ut(e){const s=e.trim();if(!s||s.length>400||/[\s\\]/.test(s))return!1;let a;try{a=new URL(s)}catch{return!1}if(a.protocol!=="https:"||a.username||a.password||a.port&&a.port!=="443")return!1;const l=a.hostname.toLowerCase();return!l.includes(".")||l==="localhost"||l.endsWith(".local")||l.endsWith(".localhost")||l.endsWith(".internal")?!1:/^[0-9.]+$/.test(l)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(l):!l.startsWith("[")}function ze(e){const s=new Set;return e.map(a=>{const l=a.name.trim();if(!l||l.length>ne)return"name";if(!Ut(a.url))return"url";const n=a.url.trim();return s.has(n)?"dup":(s.add(n),"")})}function $e(e){return e.length<=oe&&ze(e).every(s=>s==="")}function we(e,s,a){if(s===a||s<0||a<0||s>=e.length||a>=e.length)return e;const l=e.slice();return l.splice(a,0,l.splice(s,1)[0]),l}function re(e){return e.map(s=>({...s.id?{id:s.id}:{},name:s.name.trim(),url:s.url.trim(),enabled:s.enabled}))}function ye(e,s){return JSON.stringify(re(e))!==JSON.stringify(re(s))||e.some(a=>a.custom)}function jt(e,s){const a=s.find(l=>e.id&&l.id===e.id||l.url===e.url);return a?{name:a.name,logo:a.logo_url||"",known:!a.custom}:{name:e.name,logo:"",known:!1}}function Mt(e,s=24){const a=e.trim();return a.length<=s?a:a.slice(0,s-1)+"…"}var Gt=Object.defineProperty,qt=Object.getOwnPropertyDescriptor,U=(e,s,a,l)=>{for(var n=l>1?void 0:l?qt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Gt(s,a,n),n};let E=class extends _{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=me(this.sources),(!ye(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(e=>({...e}))))}say(e){this.dispatchEvent(new CustomEvent("ns-message",{detail:e,bubbles:!0,composed:!0}))}applyAnswer(e,s){const a=this.rows;this.fromProp=e.sources,this.saved=me(e.sources),this.rows=s?this.saved.map(l=>{const n=a.find(i=>i.id===l.id);return n?{...n,has_logo:l.has_logo,logo_url:l.logo_url,custom:l.custom,last_ok_at:l.last_ok_at,last_error:l.last_error}:{...l}}).concat(a.filter(l=>!l.id)):this.saved.map(l=>({...l})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:e.sources,bubbles:!0,composed:!0}))}set(e,s){this.rows=this.rows.map((a,l)=>l===e?{...a,...s}:a)}async save(){if(!(this.busy||!$e(this.rows))){this.busy=!0;try{this.applyAnswer(await Ve(re(this.rows)),!1),this.say(t("nsSaved"))}catch(e){this.say($(e))}finally{this.busy=!1}}}async logo(e,s){const a=this.rows[e];if(!(!s||!a?.id||this.busy)){if(s.size>At){this.say(t("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await Ye(a.id,s),!0)}catch(l){this.say(l instanceof ke&&l.status===422?t("nsLogoFile"):$(l))}finally{this.busy=!1}}}async dropLogo(e){const s=this.rows[e];if(!(!s?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Xe(s.id),!0)}catch(a){this.say($(a))}finally{this.busy=!1}}}rowHtml(e,s,a){const l=this.rows.length-1,n=!!e.id&&!this.busy,i=e.has_logo?t("nsLogoReplace"):t("nsLogoUpload"),r=Wt(e,this.saved);return o`<div class="row" data-ns-row=${e.id||"new"} data-off=${e.enabled?"0":"1"} data-bad=${a?"1":"0"}>
      <div class="lg" data-ns-logo>${e.has_logo&&e.logo_url?o`<img alt="" src=${e.logo_url}>`:o`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${ne} .value=${e.name} placeholder=${t("nsName")} aria-label=${t("nsName")} @input=${d=>this.set(s,{name:d.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${e.url} placeholder="https://" aria-label=${t("nsUrl")} @input=${d=>this.set(s,{url:d.target.value})}>
      <div class="tools">
        ${e.custom?o`<span class="chip">${t("nsCustomTag")}</span>`:p}
        ${r?o`<span class="chip health" data-look="warn" data-ns-health=${r.code} role="status"
          title=${t("nsBrokenTip",{why:t(r.why)})+" · "+(r.lastOk?t("nsLastOk",{t:V(r.lastOk,Date.now())}):t("nsNeverOk"))}
          ><sw-icon name="warning" size="12"></sw-icon>${t("nsBroken")} · ${t(r.why)}</span>`:p}
        <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("nsEnabled")} data-ns-on .checked=${e.enabled} @change=${d=>this.set(s,{enabled:w(d)})}></sw-toggle>${t("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!n} title=${e.id?i:t("nsLogoSaveFirst")} aria-label=${i}
          @click=${d=>d.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${Rt} @change=${d=>{const c=d.target;this.logo(s,c.files?.[0]),c.value=""}}>
        ${e.has_logo?o`<button class="ib" type="button" data-ns-logo-del ?disabled=${!n} title=${t("nsLogoRemove")} aria-label=${t("nsLogoRemove")} @click=${()=>this.dropLogo(s)}><sw-icon name="close" size="14"></sw-icon></button>`:p}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${s===0} title=${t("nsUp")} aria-label=${t("nsUp")} @click=${()=>this.rows=we(this.rows,s,s-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${s===l} title=${t("nsDown")} aria-label=${t("nsDown")} @click=${()=>this.rows=we(this.rows,s,s+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${t("nsDelete")} aria-label=${t("nsDelete")} @click=${()=>this.rows=this.rows.filter((d,c)=>c!==s)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${a?o`<span class="err" data-ns-err=${a}>${a==="name"?t("nsErrName",{n:ne}):a==="url"?t("nsErrUrl"):t("nsErrDup")}</span>`:p}
    </div>`}render(){const e=ze(this.rows),s=ye(this.rows,this.saved);return o`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${t("nsCard")}</h2><span class="chip num">${t("nsCount",{n:this.rows.length,m:oe})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=oe} @click=${()=>this.rows=[...this.rows,Ht()]}>${t("nsAdd")}</sw-button></div>
      ${this.rows.length?o`<div class="list" data-ns-list>${this.rows.map((a,l)=>this.rowHtml(a,l,e[l]))}</div>`:o`<span class="mut">${t("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${s?o`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(a=>({...a}))}>${t("nsDiscard")}</sw-button>`:p}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!s||!$e(this.rows)||this.busy} @click=${()=>this.save()}>${t("nsSave")}</sw-button></div>
    </div>`}};E.styles=[S,A`
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
    `];U([v({attribute:!1})],E.prototype,"sources",2);U([u()],E.prototype,"rows",2);U([u()],E.prototype,"saved",2);U([u()],E.prototype,"busy",2);E=U([x("notice-news-sources")],E);var Vt=Object.defineProperty,Yt=Object.getOwnPropertyDescriptor,Le=(e,s,a,l)=>{for(var n=l>1?void 0:l?Yt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Vt(s,a,n),n};let X=class extends _{constructor(){super(...arguments),this.value="hide"}render(){return o`<div class="fld"><label for="ns-home-empty">${t("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${e=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:e.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${t("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${t("dHomeEmptyLine")}</option></select></div>`}};X.styles=[S];Le([v()],X.prototype,"value",2);X=Le([x("notice-home-empty")],X);var Xt=Object.defineProperty,Kt=Object.getOwnPropertyDescriptor,f=(e,s,a,l)=>{for(var n=l>1?void 0:l?Kt(s,a):s,i=e.length-1,r;i>=0;i--)(r=e[i])&&(n=(l?r(s,a,n):r(n))||n);return l&&n&&Xt(s,a,n),n};let g=class extends _{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.bldChoices=[],this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmLastFeed=null,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(e){e.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(e=>{e.value!==e.dataset.v&&(e.value=e.dataset.v??"")})}say(e){this.toast=e,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Ke(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(e){e instanceof ke&&e.status===403?this.forbidden=!0:this.error=$(e)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{const e=await Je();this.boards=e.boards,this.bldChoices=e.buildings??[]}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await ee(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await he("all")).notices}catch{this.notices=[]}}catch(e){this.error=$(e)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const e=await Qe();this.floors=e.floors,this.groups=e.groups,this.roles=e.roles}catch{}}}newNotice(e=""){const s=this.s.settings;this.compose=e?Ze(new Date,s.default_days,s.default_severity,e):es(new Date,s.default_days,s.default_severity)}editNotice(e){const s=this.notices.find(a=>a.id===e);s&&(this.compose=ss(s))}async composed(e){this.compose=null,this.say(e.detail.message);try{this.notices=(await he("all")).notices}catch{}if(this.detail)try{this.detail=await ee(this.detail.board.id)}catch(s){this.say($(s))}this.loadBoards()}composeDialog(){return o`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .boardBuildings=${this.bldChoices} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${e=>this.composed(e)}></notice-compose>`}async patchSettings(e,s=t("saved")){try{const a=await ts(e);this.s&&(this.s={...this.s,settings:a.settings}),"enabled"in e&&(as(a.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(s)}catch(a){this.say($(a))}}render(){return this.forbidden?o`<sw-page heading=${t("setTitle")}><sw-state-panel state="forbidden" heading=${t("forbidden")} hint=${t("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?o`<sw-page heading=${t("setTitle")}><sw-state-panel state="error" heading=${t("saveError")} hint=${this.error} actionLabel=${t("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?o`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.lastFeedDialog()} ${this.composeDialog()}
      ${this.toast?o`<div class="toast" role="status" ${is()}>${this.toast}</div>`:p}`:o`<sw-page heading=${t("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const e=this.s,s=e.settings,a=e.can;return o`
      <div class="top"><div><h1>${t("setTitle")}</h1><p class="sub">${t("setSub")}</p></div><span class="sp"></span>
        ${s.enabled&&a.manage?o`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=ls}>${t("allNotices")}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${()=>this.newNotice()}>${t("newNotice")}</sw-button></div>`:p}</div>
      ${s.enabled?p:o`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${t("off")} hint=${t("offBody")}
          actionLabel=${a.configure?t("turnOn"):""} @action=${()=>this.patchSettings({enabled:!0})}></sw-state-panel>`}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${t("moduleCard")}</h2><span class="sp"></span>
          <sw-toggle .checked=${s.enabled} ?disabled=${!a.configure} label=${s.enabled?t("moduleOn"):t("moduleOff")} data-module-switch
            @change=${l=>this.patchSettings({enabled:l.detail.checked})}></sw-toggle></div>
          <dl class="kv"><dt>${t("kvWrite")}</dt><dd>${t("kvWriteV")} <span class="mut ltr">(notices.manage)</span></dd><dt>${t("kvPush")}</dt><dd>${t("kvPushV")} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${t("kvBoards")}</dt><dd>${t("kvBoardsV")} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${a.configure?this.defaultsCard():p}
      </div>
      ${a.configure?o`<notice-news-sources .sources=${s.news_sources} @ns-message=${l=>this.say(l.detail)}
        @news-sources-change=${l=>this.s={...this.s,settings:{...this.s.settings,news_sources:l.detail}}}></notice-news-sources>`:p}
      ${s.enabled&&a.boards?o`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${t("boardsCard")}</h2><span class="chip num">${t("boardsCount",{n:this.boards.length,m:s.boards_max})}</span><span class="sp"></span>
          ${a.configure?o`<label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("dRemote")} .checked=${s.boards_remote} @change=${l=>this.patchSettings({boards_remote:w(l)})}></sw-toggle>${t("dRemote")}</label>`:p}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length>=s.boards_max} @click=${()=>this.openCreate()}>${t("newBoard")}</sw-button></div>
        ${this.boards.length?o`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map(l=>this.boardCard(l))}</div>`:o`<sw-state-panel icon="wall" state="empty" heading=${t("noBoards")} hint=${t("boardsEmpty")} actionLabel=${t("firstBoard")} @action=${()=>this.openCreate()}></sw-state-panel>`}
      </div>`:p}
      ${s.enabled&&a.boards?this.tvDefaultsCard():p}`}tvDefaults(){return qs(this.s?.settings.tv_defaults)}tvDefaultsCard(){return o`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${t("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${t("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${e=>void this.saveTvDefaults(e.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return Vs(this.s?.settings.tv2_defaults)}tvFitDefaults(){return ut(this.s?.settings.tv2_defaults)}async saveTvDefaults(e){try{const s=await ns(e);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:s.tv_defaults,...s.tv2_defaults?{tv2_defaults:s.tv2_defaults}:{}}}),this.say(t("saved"))}catch(s){this.say($(s))}}defaultsCard(){const e=this.s,s=e.settings;return o`<div class="panel" data-defaults-card><div class="hd"><h2>${t("defaultsCard")}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${t("dDays")}</label><div class="sum"><sw-field class="short"><input id="ns-days" class="num" type="number" min="1" max="90" .value=${String(s.default_days)}
          @change=${a=>this.patchSettings({default_days:Number(a.target.value)})}></sw-field><span class="mut">${t("dDaysUnit")}</span></div></div>
        <div class="fld"><label for="ns-sev">${t("dSeverity")}</label><sw-field><select id="ns-sev" data-v=${s.default_severity} @change=${a=>this.patchSettings({default_severity:a.target.value})}>
          <option value="info">${t("sevInfo")}</option><option value="alert">${t("sevAlert")}</option></select></sw-field></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${t("dReads")}</label><sw-field><select id="ns-reads" data-v=${s.reads_names?"names":"counts"} @change=${a=>this.patchSettings({reads_names:a.target.value==="names"})}>
          <option value="names">${t("dReadsNames")}</option><option value="counts">${t("dReadsCounts")}</option></select></sw-field></div>
        <div class="fld"><label for="ns-ret">${t("dRetention")}</label><sw-field><select id="ns-ret" data-v=${String(s.retention_days)}
          @change=${a=>this.patchSettings({retention_days:Number(a.target.value)})}>
          ${os(s.retention_days).map(a=>o`<option value=${String(a.value)}>${a.label}</option>`)}</select></sw-field></div>
        <notice-home-empty .value=${s.home_empty??"hide"} @home-empty-change=${a=>this.patchSettings({home_empty:a.detail})}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${t("dPush")}</label><sw-field><select id="ns-push" data-v=${s.push_default}
          @change=${a=>this.patchSettings({push_default:a.target.value})}>
          <option value="by_severity">${t("dPushSev")}</option><option value="always">${t("dPushAlways")}</option><option value="never">${t("dPushNever")}</option></select></sw-field>
          <span class="hint">${t("dPushHint")}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${t("dWeather")}</label><sw-field><select id="ns-wx" data-v=${s.weather_entity} @change=${a=>this.patchSettings({weather_entity:a.target.value})}>
          <option value="">${t("dWeatherNone")}</option>${e.weather_entities.map(a=>o`<option value=${a.entity_id}>${a.name}</option>`)}</select></sw-field></div>
        <div class="fld"><label for="ns-bn">${t("dBuilding")}</label><sw-field><input id="ns-bn" maxlength="60" .value=${s.building_name} placeholder=${e.building_fallback}
          @change=${a=>this.patchSettings({building_name:a.target.value})}></sw-field><span class="hint">${t("dBuildingHint",{name:e.building_fallback||"-"})}</span></div>
      </div>
      <notice-info-sources .parking=${s.parking_entities??[]} .gym=${s.gym_entities??[]} .candidates=${e.info_entities??{}}
        .inverted=${{parking:s.parking_inverted??[],gym:s.gym_inverted??[]}}
        @info-sources-change=${a=>this.patchSettings(a.detail)}></notice-info-sources>
      <div class="fld"><label for="ns-origin">${t("dOrigin")}</label><sw-field><input id="ns-origin" class="ltr" maxlength="220" .value=${s.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${a=>this.patchSettings({boards_origin:a.target.value})}></sw-field><span class="hint">${t("dOriginHint")}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${t("dConnTotal")}</label><sw-field class="short"><input id="ns-ctot" class="num" type="number" min="4" max="256" data-conn-total .value=${String(s.conn_total)}
          @change=${a=>this.patchSettings({conn_total:Number(a.target.value)})}></sw-field></div>
        <div class="fld"><label for="ns-cadr">${t("dConnPerAddr")}</label><sw-field class="short"><input id="ns-cadr" class="num" type="number" min="1" max="64" data-conn-per-address .value=${String(s.conn_per_address)}
          @change=${a=>this.patchSettings({conn_per_address:Number(a.target.value)})}></sw-field></div>
      </div>
      <label class="ck" data-places-tree-setting><sw-toggle size="sm" labelHidden in-label label=${t("dPlacesTree")} .checked=${s.show_places_tree!==!1} @change=${a=>this.patchSettings({show_places_tree:w(a)})}></sw-toggle>${t("dPlacesTree")}</label>
      <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("dCustomFeeds")} .checked=${s.news_custom} @change=${a=>this.patchSettings({news_custom:w(a)})}></sw-toggle>${t("dCustomFeeds")}</label>
      <div class="fld"><span class="lbl">${t("companyLogo")}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${t("logoWhere")}</a></div>
    </div></div>`}seenBadge(e,s=!1){const a=rs(e,Date.now()),l=a==="online"?"ok":a==="off"?"off":"unk",n=a==="online"?t("bOnline"):a==="off"?t("bDisabled"):a==="never"?t("bNever"):t("bIdle");return s?o`<span class="chip" data-tone=${l==="ok"?"ok":l==="unk"?"warn":p}>${n}</span>`:o`<span class="badge" data-look=${l}>${n}</span>`}newsUnset(e){return typeof e.news_unset=="boolean"?e.news_unset:!!e.display?.blocks?.news&&!e.display.news?.feeds?.length}newsUnsetChip(e,s=!1){return this.newsUnset(e)?s?o` <span class="chip" data-tone="warn" data-news-unset-chip title=${t("newsUnset")}>${t("newsUnsetChip")}</span>`:o`<span class="badge" data-look="warn" data-news-unset-chip title=${t("newsUnset")}>${t("newsUnsetChip")}</span>`:p}summary(e){const s=e.display;if(!s)return"";const a=t(s.template===1?"tpl1":s.template===2?"tpl2":"tpl3"),l=t(s.theme==="day"?"themeDay":s.theme==="night"?"themeNight":"orAuto");return`${a} · ${l} · ${s.rotate_s} ${t("seconds")}`}boardsTable(){const e=[{key:"state",label:t("bState"),kind:"status",render:s=>o`${this.seenBadge(s,!0)}${this.newsUnsetChip(s,!0)}`},{key:"name",label:t("bName"),kind:"truncate",cellTitle:s=>s.name,render:s=>o`<span class="t1">${s.name}</span><span class="t2">${this.summary(s)}</span>`},{key:"slug",label:t("bAddress"),kind:"muted",render:s=>o`<bdi dir="ltr">/b/${s.slug}</bdi>`},{key:"items",label:t("bItems"),kind:"num",render:s=>String(s.item_count??0)},{key:"seen",label:t("bSeen"),kind:"muted",render:s=>V(s.last_seen_at,Date.now())},{key:"act",label:"",kind:"actions",render:s=>this.rowActions(s)}];return o`<sw-table class="t" bare data-boards-table rowKey="slug" .columns=${e} .rows=${this.boards}
      .rowAttrs=${s=>({"data-board":String(s.slug)})}
      @row-select=${s=>this.goBoard(s.detail.row)}></sw-table>`}rowActions(e){const s=a=>l=>{l.stopPropagation(),a()};return o`${e.enabled?p:o`<sw-button size="sm" data-activate @click=${s(()=>void this.activate(e))}>${t("activate")}</sw-button>`}
      ${this.canCopyLink()?o`<sw-button size="sm" data-copy-link @click=${s(()=>void this.copyLink(e))}>${t("copyLink")}</sw-button>`:p}
      <sw-button size="sm" @click=${s(()=>this.goBoard(e))}>${t("open")}</sw-button>`}canCopyLink(){const e=this.s?.can;return!!(e?.configure&&e.boards)}async copyLink(e){if(!e.has_stored_link){this.confirmRotate={board:e,copy:!0,legacy:!0};return}try{const s=await ds(e.id);this.link={board:e,token:s.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(e,s.token)).then(()=>this.say(t("copied")),()=>{})}catch(s){this.say($(s))}}async activate(e){try{await ue(e.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===e.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(t("saved"))}catch(s){this.say($(s))}}boardCard(e){return o`<div class="card" tabindex="0" role="link" data-board-card=${e.slug} @click=${()=>this.goBoard(e)} @keydown=${et(()=>this.goBoard(e))}><div class="row">${this.seenBadge(e)}${this.newsUnsetChip(e)}<span class="ltr mut">/b/${e.slug}</span></div><span class="t1">${e.name}</span><span class="t2">${this.summary(e)}</span></div>`}goBoard(e){location.hash=`${se}/${encodeURIComponent(e.id)}`}openCreate(){this.creating={name:"",slug:cs("board",this.boards.map(e=>e.slug)),err:""}}createDialog(){const e=this.creating;return o`<sw-dialog ?open=${!!e} heading=${t("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${e?o`<div class="form">
        <div class="fld"><label for="nb-name">${t("bName")}</label><sw-field><input id="nb-name" maxlength="60" .value=${e.name} @input=${s=>this.creating={...e,name:s.target.value,err:""}}></sw-field></div>
        <div class="fld"><label for="nb-slug">${t("bSlug")}</label><sw-field><input id="nb-slug" class="ltr" maxlength="40" .value=${e.slug} @input=${s=>this.creating={...e,slug:s.target.value.toLowerCase(),err:""}}></sw-field><span class="hint">${t("bSlugHint")}</span></div>
        ${e.err?o`<span class="err" role="alert">${e.err}</span>`:p}</div>`:p}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${t("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${t("newBoard")}</sw-button></sw-dialog>`}async create(){const e=this.creating;if(e){if(!e.name.trim()){this.creating={...e,err:t("bName")};return}if(!ps(e.slug)){this.creating={...e,err:t("bSlugHint")};return}try{const s=await hs({name:e.name.trim(),slug:e.slug});this.creating=null,this.link={board:s.board,token:s.token,rotated:!1},await this.loadBoards()}catch(s){this.creating={...e,err:$(s)}}}}linkUrl(e,s){return us(e.slug,s,this.s?.settings.boards_origin||void 0)}linkDialog(){const e=this.link,s=e?this.linkUrl(e.board,e.token):"";return o`<sw-dialog ?open=${!!e} heading=${e?t("linkTitle",{name:e.board.name}):""} subheading=${e?.rotated?t("linkSub"):t("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${e?o`<div class="form">
        <div class="link"><code data-board-link>${s}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(s)}>${t("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${xs(s,148)}</div><p class="hint">${t("linkHint")}</p></div>
        ${this.s?.settings.boards_remote?p:o`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${t("linkLan")}</span></div>`}
      </div>`:p}
      <sw-button slot="footer" variant="primary" @click=${()=>this.link=null}>${t("done")}</sw-button></sw-dialog>`}async copy(e){try{await navigator.clipboard.writeText(e),this.say(t("copied"))}catch{this.say(e)}}boardPage(){const e=this.detail,s=e.board,a=[{id:"general",label:t("tabGeneral")},{id:"display",label:t("tabDisplay")},{id:"notices",label:`${t("tabNotices")} (${e.notices.length})`}];return o`
      <div class="top"><div><h1>${s.name}</h1><p class="sub"><a href=${se}>${t("back")}</a> · <span class="ltr">/b/${s.slug}</span> · ${V(s.last_seen_at,Date.now())} ${this.newsUnsetChip(s)}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${t("openTv")}</sw-button>
          ${this.canCopyLink()?o`<sw-button icon="copy" data-copy-link @click=${()=>void this.copyLink(s)}>${t("copyLink")}</sw-button>`:p}
          <sw-button icon="refresh" data-rotate @click=${()=>this.confirmRotate={board:s,copy:!1}}>${t("newLink")}</sw-button>
          <sw-toggle .checked=${s.enabled} label=${t("boardEnabled")} @change=${l=>this.saveBoard({enabled:l.detail.checked})}></sw-toggle>
        </div></div>
      <sw-tabs .items=${a} active=${this.tab} panel="board-panel" @change=${l=>this.tab=l.detail.id}></sw-tabs>
      <div class="stack" id="board-panel">${this.tab==="general"?this.generalTab():this.tab==="display"?this.displayTab():this.noticesTab()}</div>`}generalTab(){const e=this.detail.board,s=this.draft;return o`<div class="two">
      <div class="panel"><div class="hd"><h2>${t("tabGeneral")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty&&this.nameDraft===e.name} @click=${()=>this.saveAll()}>${t("save")}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${t("bName")}</label><sw-field><input id="bg-name" maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}></sw-field></div>
            <div class="fld"><label for="bg-slug">${t("bSlug")}</label><sw-field><input id="bg-slug" class="ltr" .value=${e.slug} disabled></sw-field></div></div>
          ${this.bldChoices.length?o`<div class="fld" data-board-building><label>${t("bBuilding")}</label><sw-dropdown block label=${t("bBuilding")} .items=${[{id:"",label:t("bBuildingSite")},...this.bldChoices.map(a=>({id:a.id,label:a.name}))]} .value=${e.building_id??""} @change=${a=>this.saveBoard({building_id:a.detail.id})}></sw-dropdown><p class="hint">${t("bBuildingHint")}</p></div>`:p}
          <div class="r">${this.placeField(s.place)}
            <div class="fld"><label for="bg-lang">${t("lang")}</label><sw-field><select id="bg-lang" data-v=${s.lang} @change=${a=>this.setD({lang:a.target.value})}><option value="he">עברית</option><option value="en">English</option></select></sw-field></div></div>
          <dl class="kv"><dt>${t("kvTemplate")}</dt><dd>${this.summary(e)}</dd><dt>${t("bItems")}</dt><dd class="num">${this.detail.notices.length}</dd>
            <dt>${t("kvSeen")}</dt><dd>${V(e.last_seen_at,Date.now())}</dd><dt>${t("kvCreated")}</dt><dd class="num">${(e.created_at||"").slice(0,10)}</dd>
            <dt>${t("kvRotated")}</dt><dd class="num">${(e.token_rotated_at||"").slice(0,10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${()=>this.confirmDelete=!0}>${t("deleteBoard")}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${t("bAddress")}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(e,"••••••••••••••••••••••••••••••••")}</code></div>
        <p class="hint">${t("linkOnce")} ${t("linkHint")}</p>
        ${e.has_stored_link===!1?o`<p class="hint" data-link-pending>${t("linkPending")}</p>`:p}
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:e,copy:!1}}>${t("newLink")}</sw-button></div></div>
    </div>`}placeField(e){const s=bs(this.floors);if(!s.length)return o`<div class="fld"><label for="bg-place">${t("place")}</label><sw-field><input id="bg-place" maxlength="60" .value=${e} @input=${n=>this.setD({place:n.target.value})}></sw-field></div>`;const a=!!e&&!s.includes(e),l=this.placeOther||a?"__other":e;return o`<div class="fld"><label for="bg-place">${t("place")}</label>
      <sw-field><select id="bg-place" data-place-select data-v=${l} @change=${n=>{const i=n.target.value;this.placeOther=i==="__other",this.placeOther||this.setD({place:i})}}><option value="">-</option>${s.map(n=>o`<option value=${n}>${n}</option>`)}<option value="__other">${t("placeOther")}</option></select></sw-field>
      ${l==="__other"?o`<sw-field><input data-place-text maxlength="60" aria-label=${t("place")} .value=${e} @input=${n=>this.setD({place:n.target.value})}></sw-field>`:p}</div>`}setD(e){this.draft&&(this.draft={...this.draft,...e,blocks:{...this.draft.blocks,...e.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(e=!0){const s=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${e?"embed=1&":""}preview=${s}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(e){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:e},location.origin),this.sendToTvs&&this.detail)try{await gs(this.detail.board.id,e==="toggle"?"pause":e)}catch(s){this.say($(s))}}displayTab(){const e=this.draft,s=[{n:1,t:t("tpl1"),dsc:t("tpl1d")},{n:2,t:t("tpl2"),dsc:t("tpl2d")},{n:3,t:t("tpl3"),dsc:t("tpl3d")}],a=e.layout==="portrait",l=this.s.settings,n=this.detail.notices.filter(i=>i.state==="active");return o`<div class="disp">
      <div class="panel"><div class="hd"><h2>${t("tplCard")}</h2><span class="sp"></span><span class="chip" data-look="acc">${t("tplLive")}</span></div>
        <div class="tpls" data-tpls>${s.map(i=>o`<button class="tpl" data-tpl=${i.n} aria-pressed=${String(e.template===i.n)} @click=${()=>this.setD({template:i.n})}>
          <div class="sch t${i.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${i.t}</b><span>${i.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${t("preview")}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${t("fullScreen")}</sw-button></div>
        <div class="prev ${a?"port":""}"><iframe data-preview title=${t("preview")} src=${this.previewSrc()} @load=${()=>this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${()=>this.cmd("prev")}>${t("prev")}</sw-button><sw-button size="sm" @click=${()=>this.cmd("toggle")}>${t("pauseToggle")}</sw-button>
          <sw-button size="sm" @click=${()=>this.cmd("next")}>${t("next")}</sw-button><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("sendToTvs")} .checked=${this.sendToTvs} @change=${i=>this.sendToTvs=w(i)}></sw-toggle>${t("sendToTvs")}</label>
          <span class="hint">${t("remoteHint")}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${t("theme")}</span><sw-segmented label=${t("theme")} data-theme-seg value=${e.theme} @change=${i=>this.setD({theme:i.detail.value})}
            .options=${["day","night","auto"].map(i=>({value:i,label:t(i==="day"?"themeDay":i==="night"?"themeNight":"themeAuto")}))}></sw-segmented></div>
            <div class="fld"><span class="lbl">${t("orient")}</span><sw-segmented label=${t("orient")} value=${e.layout} @change=${i=>this.setD({layout:i.detail.value})}
            .options=${["auto","landscape","portrait"].map(i=>({value:i,label:t(i==="auto"?"orAuto":i==="landscape"?"orLand":"orPort")}))}></sw-segmented></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${t("dayHours")}</label><sw-field><input id="bd-dh" class="ltr" placeholder="07:00-19:00" .value=${e.day_hours} @change=${i=>this.setD({day_hours:i.target.value.trim()})}></sw-field><span class="hint">${t("dayHoursHint")}</span></div>
            <div class="fld"><label for="bd-fs">${t("fontSize")}</label><sw-field><select id="bd-fs" data-v=${e.font_size} @change=${i=>this.setD({font_size:i.target.value})}>
              <option value="s">${t("fsS")}</option><option value="m">${t("fsM")}</option><option value="l">${t("fsL")}</option></select></sw-field></div></div>
          <div class="fld"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("nightDim")} .checked=${e.night.enabled} @change=${i=>this.setD({night:{...e.night,enabled:w(i)}})}></sw-toggle>${t("nightDim")}</label>
            ${e.night.enabled?o`<div class="sum">${t("nightFrom")}<sw-field class="short"><input class="ltr" type="time" lang=${be()} .value=${e.night.from} @change=${i=>this.setD({night:{...e.night,from:i.target.value}})}></sw-field>
              ${t("nightTo")}<sw-field class="short"><input class="ltr" type="time" lang=${be()} .value=${e.night.to} @change=${i=>this.setD({night:{...e.night,to:i.target.value}})}></sw-field>
              ${t("nightLevel")}<sw-field class="short"><select data-v=${String(e.night.dim)} @change=${i=>this.setD({night:{...e.night,dim:Number(i.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(i=>o`<option value=${String(i)}>${Math.round(i*100)}%</option>`)}</select></sw-field></div>`:p}</div>
          <div class="chips"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("burnIn")} .checked=${e.burn_in.shift} @change=${i=>this.setD({burn_in:{shift:w(i)}})}></sw-toggle>${t("burnIn")}</label>
            <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("companyLogo")} .checked=${e.blocks.company_logo} @change=${i=>this.setD({blocks:{...e.blocks,company_logo:w(i)}})}></sw-toggle>${t("companyLogo")}</label>
            <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("smplwiseLogo")} checked disabled></sw-toggle>${t("smplwiseLogo")}</label></div>
          <notice-display-design .display=${e} .defaults=${this.tv2Defaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-design>
          <notice-display-fit .display=${e} .defaults=${this.tvFitDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-fit>
          <notice-display-layout .display=${e} .defaults=${this.tvDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-layout>
          <notice-display-saver .display=${_e(e,this.tvDefaults())} @display-change=${i=>this.setD(i.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${t("whatShown")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${()=>this.saveAll()}>${t("save")}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkClock")} .checked=${e.blocks.clock} @change=${i=>this.setD({blocks:{...e.blocks,clock:w(i)}})}></sw-toggle>${t("blkClock")}</label>
            <div class="sub"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkHebdate")} .checked=${e.blocks.hebdate} @change=${i=>this.setD({blocks:{...e.blocks,hebdate:w(i)}})}></sw-toggle>${t("blkHebdate")}</label>
              <label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkWelcome")} .checked=${e.blocks.welcome} @change=${i=>this.setD({blocks:{...e.blocks,welcome:w(i)}})}></sw-toggle>${t("blkWelcome")}</label></div></div>
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkWeather")} .checked=${e.blocks.weather} @change=${i=>this.setD({blocks:{...e.blocks,weather:w(i)}})}></sw-toggle>${t("blkWeather")}</label>
            <div class="sub">${l.weather_entity?o`<span class="ltr mut">${l.weather_entity}</span>`:o`<span class="mut">${t("blkWeatherNoEntity")}</span>`}
              <span>${t("hoursAhead")}</span><sw-field class="short"><select data-v=${String(e.weather.hours)} @change=${i=>this.setD({weather:{hours:Number(i.target.value)}})}>${[3,5,8].map(i=>o`<option value=${String(i)}>${i}</option>`)}</select></sw-field></div></div>
          <div class="blk"><label class="ck"><sw-toggle size="sm" labelHidden in-label label=${t("blkNews")} .checked=${e.blocks.news} @change=${i=>this.setD({blocks:{...e.blocks,news:w(i)}})}></sw-toggle>${t("blkNews")}</label>
            ${e.blocks.news&&!e.news.feeds.length?o`<div class="alert" role="status" data-news-unset><sw-icon name="warning" size="14"></sw-icon><span>${t("newsUnset")}</span>
              ${this.allFeeds().length?o`<sw-button size="sm" icon="plus" data-news-add-all @click=${()=>this.addAllFeeds()}>${t("newsAddAll")}</sw-button>`:p}</div>`:p}
            <div class="sub">${e.news.feeds.map((i,r)=>{const d=jt(i,l.news_sources);return o`<div class="feed" data-feed=${i.url}>${d.logo?o`<img class="flg" alt="" src=${d.logo}>`:o`<sw-icon name="link" size="12"></sw-icon>`}<b>${Mt(d.name)}</b>${d.known?p:o`<span class="chip">${t("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" data-feed-remove @click=${()=>this.removeFeed(r)}>${t("remove")}</sw-button></div>`})}
              <sw-field class="short"><select data-v=${this.feedPick} @change=${i=>this.feedPick=i.target.value}><option value="">${t("feedPick")}</option>
                ${l.news_sources.filter(i=>i.enabled!==!1).map(i=>o`<option value=${i.url}>${i.name}${i.custom?" · "+t("nsCustomTag"):""}</option>`)}${l.news_custom?o`<option value="custom">${t("feedCustom")}</option>`:p}</select></sw-field>
              ${this.feedPick==="custom"?o`<sw-field><input class="ltr" placeholder="https://" .value=${this.feedUrl} @input=${i=>this.feedUrl=i.target.value}></sw-field>`:p}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick||e.news.feeds.length>=6} @click=${()=>this.addFeed()}>${t("add")}</sw-button>
              <span>${t("speed")}</span><sw-segmented label=${t("speed")} value=${e.news.speed} @change=${i=>this.setD({news:{...e.news,speed:i.detail.value}})}
                .options=${["slow","normal","fast"].map(i=>({value:i,label:t(i==="slow"?"spSlow":i==="normal"?"spNormal":"spFast")}))}></sw-segmented></div></div>
          <notice-display-info .value=${e.blocks.info} .show=${e.blocks.info_show!==!1} .sources=${l.parking_entities?{parking:l.parking_entities,gym:l.gym_entities??[]}:null} @info-show-change=${i=>this.setD({blocks:{...e.blocks,info_show:i.detail}})} @info-change=${i=>this.setD({blocks:{...e.blocks,info:i.detail}})}></notice-display-info>
          <div class="blk"><span class="ck"><b>${t("blkNotices")}</b></span><span class="hint">${n.length} ${t("kpiActive")}</span>
            <div class="sub"><span>${t("mode")}</span><sw-segmented label=${t("mode")} data-mode-seg value=${e.mode} @change=${i=>this.setD({mode:i.detail.value})}
              .options=${["rotation","all","focus"].map(i=>({value:i,label:t(i==="rotation"?"modeRotation":i==="all"?"modeAll":"modeFocus"),attrs:{"data-mode":i}}))}></sw-segmented></div>
            <div class="sub"><span>${t("rotateEvery")}</span><sw-field class="short"><input class="num" type="number" min="6" max="60" step="1" data-rot .value=${String(e.rotate_s)}
              @change=${i=>this.setD({rotate_s:Math.max(6,Math.min(60,Math.round(Number(i.target.value)||12)))})}></sw-field><span>${t("seconds")}</span><span class="hint">${t("rotateHint")}</span></div>
            <div class="sub"><span>${t("urgent")}</span><sw-field><select data-urg data-v=${e.urgent==="band"?"stage":e.urgent} @change=${i=>this.setD({urgent:i.target.value})}>
              <option value="stage">${t("urgStage")}</option><option value="stay">${t("urgStay")}</option><option value="full">${t("urgFull")}</option></select></sw-field></div>
            <div class="sub"><span>${t("hold")}</span><sw-field><select data-hold data-v=${e.hold} @change=${i=>this.setD({hold:i.target.value})}>
              <option value="">${t("holdNone")}</option>${n.map(i=>o`<option value=${i.id}>${i.title}</option>`)}</select></sw-field><span class="hint">${t("holdHint")}</span></div>
            <p class="hint">${t("dwellNote")}</p></div>
          <notice-display-transit .display=${e} .v2Layout=${(i=>i.design==="v2"?i.board_layout:null)(te(e,this.tv2Defaults()))} @display-change=${i=>this.setD(i.detail)}></notice-display-transit>
          <notice-display-slides .display=${e} .lux=${["gallery","concierge","stone"].includes(te(e,this.tv2Defaults()).design)} .boardId=${this.detail.board.id} .boards=${this.boards} @display-change=${i=>this.setD(i.detail)} @slides-changed=${()=>this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`}addFeed(){const e=this.draft;if(!e)return;const s=this.feedPick,a=this.s.settings.news_sources.find(n=>n.url===s),l=a?{id:a.id,name:a.name,url:a.url}:s==="custom"&&this.feedUrl.startsWith("https://")?{name:new URL(this.feedUrl).hostname,url:this.feedUrl}:null;!l||e.news.feeds.some(n=>n.url===l.url)||(this.setD({news:{...e.news,feeds:[...e.news.feeds,l]},blocks:{...e.blocks,news:!0}}),this.feedPick="",this.feedUrl="")}allFeeds(){return(this.s?.settings.news_sources??[]).filter(e=>e.enabled!==!1&&!e.custom).map(e=>({id:e.id,name:e.name,url:e.url}))}addAllFeeds(){const e=this.draft;if(!e)return;const s=new Set(e.news.feeds.map(l=>l.url)),a=[...e.news.feeds,...this.allFeeds().filter(l=>!s.has(l.url))].slice(0,6);a.length!==e.news.feeds.length&&this.setD({news:{...e.news,feeds:a},blocks:{...e.blocks,news:!0}})}removeFeed(e){const s=this.draft;if(s){if(s.blocks.news&&s.news.feeds.length===1&&this.confirmLastFeed===null){this.confirmLastFeed=e;return}this.setD({news:{...s.news,feeds:s.news.feeds.filter((a,l)=>l!==e)}})}}lastFeedDialog(){const e=this.confirmLastFeed;return o`<sw-dialog ?open=${e!==null} heading=${t("newsLastQ")} @close=${()=>this.confirmLastFeed=null} data-news-last-confirm>
      <p>${t("newsLastBody")}</p>
      <sw-button slot="footer" data-news-last-cancel @click=${()=>this.confirmLastFeed=null}>${t("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-news-last-go @click=${()=>{const s=this.confirmLastFeed;s!==null&&this.removeFeed(s),this.confirmLastFeed=null}}>${t("remove")}</sw-button></sw-dialog>`}noticesTab(){const e=this.detail,s=new Set(e.notices.map(d=>d.id)),a=this.notices.filter(d=>!s.has(d.id)&&(d.state==="active"||d.state==="scheduled"||d.state==="draft")),l=!!this.s?.can.manage,n=d=>l&&this.notices.some(c=>c.id===d&&c.state!=="archived"&&c.state!=="expired"),i=d=>d.state!=="active"?void 0:d.severity==="critical"?"bad":d.severity==="alert"?"warn":"info",r=[{key:"sev",label:t("colState"),kind:"status",render:d=>o`<span class="chip" data-tone=${i(d)??p}>${t(vs[d.severity])}${d.pinned?" · "+t("pinned"):""}</span>`},{key:"title",label:t("colNotice"),kind:"truncate",cellTitle:d=>d.title,render:d=>o`<span class="t1">${d.title}</span>`},{key:"window",label:t("colWindow"),kind:"muted",render:d=>fs(d)},{key:"act",label:"",kind:"actions",render:d=>o`${n(d.id)?o`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(d.id)}>${t("edit")}</sw-button>`:p}
          <sw-button size="sm" @click=${()=>this.removeItem(d.id)}>${t("removeFromBoard")}</sw-button>`}];return o`<div class="panel flush">
      <div class="toolbar"><h2>${t("boardNotices")}</h2><span class="chip num">${e.notices.filter(d=>d.state==="active").length} ${t("kpiActive")}</span><span class="sp"></span>
        ${a.length?o`<sw-field class="short"><select data-add-notice @change=${d=>this.addItem(d.target.value)}><option value="">${t("addToBoard")}…</option>
          ${a.map(d=>o`<option value=${d.id}>${d.title}</option>`)}</select></sw-field>`:p}
        ${l?o`<sw-button variant="primary" icon="plus" data-board-compose @click=${()=>this.newNotice(e.board.id)}>${t("newForBoard")}</sw-button>`:p}</div>
      ${e.notices.length?o`<sw-table class="t" bare static-rows data-board-notices .columns=${r} .rows=${e.notices}
          .rowAttrs=${d=>({"data-board-notice":String(d.id),"data-look":d.state==="active"?ms[d.severity]:"off"})}></sw-table>`:o`<sw-state-panel icon="inbox" state="empty" heading=${t("boardEmpty")}
            actionLabel=${l?t("newForBoard"):""} @action=${()=>this.newNotice(e.board.id)}></sw-state-panel>`}
    </div>`}async addItem(e){!e||!this.detail||await this.setItems([...this.detail.notices.map(s=>s.id),e])}async removeItem(e){this.detail&&await this.setItems(this.detail.notices.map(s=>s.id).filter(s=>s!==e))}async setItems(e){try{await $s(this.detail.board.id,e),this.detail=await ee(this.detail.board.id),this.say(t("saved"))}catch(s){this.say($(s))}}async saveBoard(e){if(this.detail)try{const s=await ue(this.detail.board.id,e);this.detail={...this.detail,board:s.board},this.draft=structuredClone(s.board.display??this.draft),this.dirty=!1,this.say(t("saved")),this.loadBoards()}catch(s){this.say($(s))}}async saveAll(){const e={};this.draft&&this.dirty&&(e.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(e.name=this.nameDraft.trim()),await this.saveBoard(e)}async rotate(e,s){try{const a=await ws(e.id);this.link={board:a.board,token:a.token,rotated:!0},this.detail?.board.id===a.board.id&&(this.detail={...this.detail,board:a.board}),this.loadBoards(),s&&navigator.clipboard?.writeText(this.linkUrl(a.board,a.token)).then(()=>this.say(t("copied")),()=>{})}catch(a){this.say($(a))}}rotateDialog(){const e=this.confirmRotate;return o`<sw-dialog ?open=${!!e} heading=${e?t("copyAsk",{name:e.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      ${e?.legacy?o`<p data-no-stored-link>${t("noStoredLink")}</p>`:p}
      <p>${t("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${t("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${()=>{const s=this.confirmRotate;this.confirmRotate=null,s&&this.rotate(s.board,s.copy)}}>${t("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return o`<sw-dialog ?open=${this.confirmDelete} heading=${t("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${t("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${t("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${t("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await ys(this.detail.board.id),this.confirmDelete=!1,location.hash=se,await this.loadBoards()}catch(e){this.say($(e))}}};g.styles=[ks,_s,S,A`
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
      /* NOTICE-NEWS-EMPTY-2500: news on, no source chosen - the module's warning line under the news switch, aligned with its sub rows */
      .alert[data-news-unset] { align-items: center; flex-wrap: wrap; margin-inline-start: 22px; }
      .alert[data-news-unset] > span { flex: 1 1 220px; min-inline-size: 0; }
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
    `];f([v()],g.prototype,"boardId",2);f([u()],g.prototype,"s",2);f([u()],g.prototype,"boards",2);f([u()],g.prototype,"error",2);f([u()],g.prototype,"forbidden",2);f([u()],g.prototype,"toast",2);f([u()],g.prototype,"creating",2);f([u()],g.prototype,"link",2);f([u()],g.prototype,"detail",2);f([u()],g.prototype,"tab",2);f([u()],g.prototype,"draft",2);f([u()],g.prototype,"dirty",2);f([u()],g.prototype,"nameDraft",2);f([u()],g.prototype,"bldChoices",2);f([u()],g.prototype,"notices",2);f([u()],g.prototype,"feedPick",2);f([u()],g.prototype,"feedUrl",2);f([u()],g.prototype,"confirmDelete",2);f([u()],g.prototype,"confirmLastFeed",2);f([u()],g.prototype,"confirmRotate",2);f([u()],g.prototype,"placeOther",2);f([u()],g.prototype,"sendToTvs",2);f([u()],g.prototype,"compose",2);f([u()],g.prototype,"floors",2);f([u()],g.prototype,"groups",2);f([u()],g.prototype,"roles",2);g=f([x("system-notices")],g);export{g as SystemNotices};
