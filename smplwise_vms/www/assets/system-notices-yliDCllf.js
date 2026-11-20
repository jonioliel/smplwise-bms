import{ax as g,i as k,b as n,jR as s,A as p,k as _,bG as Et,bH as Nt,cE as Tt,zL as Ct,g as A,j as u,zM as It,n as $,zN as Rt,zO as At,zP as Bt,zQ as Ht,zR as Ut,zS as jt,zT as Ft,zU as Wt,zV as Gt,zW as Mt,zX as Vt,zY as qt,dH as H,zZ as Yt,z_ as Xt,a as _t,z$ as Kt,A0 as Qt,sE as Jt,A1 as J,sD as pt,sF as Zt,A2 as te,sR as ee,sQ as se,A3 as ae,A4 as ie,e1 as oe,A5 as le,A6 as ne,A7 as re,A8 as de,A9 as Z,Aa as ce,Ab as ht,sG as tt,Ac as pe,Ad as he,Ae as ue,Af as ve,Ag as be,Ah as ge,ej as ut,sL as vt,j_ as fe,sO as me,Ai as $e,Aj as we,Ak as ye,bh as ke}from"./index-Cwrvr-7C.js";import{a as _e}from"./settings-C0oL8AFl.js";import{qrSvg as xe}from"./sw-second-factor-DATlMlxI.js";import{$ as De,X as Se,_ as Oe,W as ze,aa as Le,ab as xt,V as Pe,ac as Ee,ad as Ne,ae as Te,af as Ce,ag as Ie,ah as Re,ai as et,aj as Ae,a3 as Be,ak as He,al as Ue,am as je,an as Fe,ao as We,ap as Ge,q as Me,aq as Ve,ar as qe}from"./transit-logic-C-J7tGXg.js";import"./compose-dialog-C8WidB5H.js";import{n as x}from"./styles-CRpKoblm.js";import{t as Ye,i as Xe,b as v,w as Ke,R as F,j as W,k as Qe,W as Je,l as Ze,n as N,f as G,D as M}from"./model-CfDXyId6.js";import{a as bt}from"./activate-keys-CrBsenYs.js";import"./sw-logo-art-PLtEZJxU.js";import"./qrcode-CWKHzRGU.js";var ts=Object.defineProperty,es=Object.getOwnPropertyDescriptor,Dt=(t,e,a,o)=>{for(var l=o>1?void 0:o?es(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&ts(e,a,l),l};let V=class extends k{emit(t){this.dispatchEvent(new CustomEvent("display-change",{detail:t,bubbles:!0,composed:!0}))}render(){if(!this.display)return n``;const t=De(this.display),e=Se(this.display),a=Oe.map(i=>[i,s(`saver_${i}`)]),o=[["a",s("logos_a")],["b",s("logos_b")],["c",s("logos_c")]],l=ze(this.display)!=="c";return n`<div class="r">
      <div class="fld"><span class="lbl">${s("saverLabel")}</span><sw-segmented data-saver-seg value=${t} @change=${i=>this.emit({saver:i.detail.value})}
        .options=${a.map(([i,r])=>({value:i,label:r,attrs:{"data-saver":i}}))}></sw-segmented></div>
      <div class="fld"><span class="lbl">${s("logosLabel")}</span><sw-segmented data-logos-seg value=${e} ?disabled=${l} @change=${i=>this.emit({logos:i.detail.value})}
        .options=${o.map(([i,r])=>({value:i,label:r,attrs:{"data-logos":i}}))}></sw-segmented>
        ${l?n`<span class="hint">${s("logosOnlyHeaderC")}</span>`:p}</div>
    </div>`}};V.styles=[x];Dt([g({attribute:!1})],V.prototype,"display",2);V=Dt([_("notice-display-saver")],V);var ss=Object.defineProperty,as=Object.getOwnPropertyDescriptor,Y=(t,e,a,o)=>{for(var l=o>1?void 0:o?as(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&ss(e,a,l),l};const is=[{key:"header",seg:"header",label:"headerLabel",values:Pe,text:t=>s(`header_${t}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:Ee,text:t=>s(`updated_${t}`)},{key:"space",seg:"space",label:"spaceLabel",values:Ne,text:t=>s(`space_${t}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:Te,text:t=>s(`nightLogo_${t}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:Ce,text:t=>t===0?s("weatherDays_0"):t===1?s("weatherDays_1"):s("weatherDays_n",{n:t})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:Ie,text:t=>s(`idleLogo_${t}`)}];let T=class extends k{constructor(){super(...arguments),this.defaults=Le,this.mode="board"}emit(t,e){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:e},bubbles:!0,composed:!0}))}row(t,e,a,o,l){const i=this.mode==="board",r=t.key==="space"&&a==="c"||i&&t.key==="night_logo"&&!o||i&&t.key==="weather_days"&&!l,h=t.text(this.defaults[t.key]),d=t.key==="space"&&r?s("spaceOnlyOneRow"):i&&e===null?s("tvDefaultNow",{v:h}):"";return n`<div class="fld"><span class="lbl">${s(t.label)}</span>
      <sw-segmented label=${s(t.label)} data-seg=${t.seg} value=${e===null?"__default__":String(e)} ?disabled=${r}
        @change=${c=>{if(c.detail.value==="__default__")this.emit(t.key,null);else{const w=t.values.find(O=>String(O)===c.detail.value);w!==void 0&&this.emit(t.key,w)}}}
        .options=${[...i?[{value:"__default__",label:s("tvUseDefault"),title:h,attrs:{"data-v":"default"}}]:[],...t.values.map(c=>({value:String(c),label:t.text(c),attrs:{"data-v":String(c)}}))]}></sw-segmented>
      ${d?n`<span class="hint" data-default-note>${d}</span>`:p}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return n``;const e=this.display??{},a=z=>t?e[z]??null:this.defaults[z],o=t?xt(e,this.defaults):this.defaults,l=!!e.blocks?.company_logo,i=!!e.blocks?.weather,[r,h,d,c,w,O]=is.map(z=>this.row(z,a(z.key),o.header,l,i));return n`<div class="r">${r}${h}</div><div class="r">${d}${c}</div><div class="r">${w}${O}</div>`}};T.styles=[x];Y([g({attribute:!1})],T.prototype,"display",2);Y([g({attribute:!1})],T.prototype,"defaults",2);Y([g()],T.prototype,"mode",2);T=Y([_("notice-display-layout")],T);var os=Object.defineProperty,ls=Object.getOwnPropertyDescriptor,X=(t,e,a,o)=>{for(var l=o>1?void 0:o?ls(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&os(e,a,l),l};const ns=[{key:"design",seg:"design",label:"designLabel",values:Ae},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:Be},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:He},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:Ue},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:je},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:Fe},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:We},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:Ge}],rs={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},gt=(t,e)=>s(`${rs[t]}${e}`);let C=class extends k{constructor(){super(...arguments),this.defaults=Re,this.mode="board"}emit(t,e){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:e},bubbles:!0,composed:!0}))}row(t,e,a){const o=this.mode==="board",l=t.key==="live_bg"||t.key==="systems_status"||t.key==="urgent_screen",i=o&&t.key!=="design"&&!l&&!a,r=gt(t.key,this.defaults[t.key]),h=t.key==="board_layout"&&!o?s("boardLayoutDefaultLabel"):s(t.label),d=i?s("v2Only"):o&&e===null?s("tvDefaultNow",{v:r}):"";return n`<div class="fld"><span class="lbl">${h}</span>
      <sw-segmented label=${h} data-seg=${t.seg} value=${e===null?"__default__":e} ?disabled=${i}
        @change=${c=>this.emit(t.key,c.detail.value==="__default__"?null:c.detail.value)}
        .options=${[...o?[{value:"__default__",label:s("tvUseDefault"),title:r,attrs:{"data-v":"default"}}]:[],...t.values.map(c=>({value:c,label:gt(t.key,c),attrs:{"data-v":c}}))]}></sw-segmented>
      ${d?n`<span class="hint" data-default-note>${d}</span>`:p}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return n``;const e=this.display??{},a=B=>t?e[B]??null:this.defaults[B],l=(t?et(e,this.defaults):this.defaults).design==="v2",[i,r,h,d,c,w,O,z]=ns.map(B=>this.row(B,a(B.key),l));return n`<div class="r" data-tv2>${i}${r}</div><div class="r">${h}${d}</div><div class="r">${c}</div><div class="r" data-lobby>${w}${O}</div><div class="r">${z}</div>`}};C.styles=[x];X([g({attribute:!1})],C.prototype,"display",2);X([g({attribute:!1})],C.prototype,"defaults",2);X([g()],C.prototype,"mode",2);C=X([_("notice-display-design")],C);const ds=["rows","drop"],cs=[0,1,2,3,4,5],st={portrait_chips:"drop",safe_margin:0},St=t=>t==="rows"||t==="drop",Ot=t=>typeof t=="number"&&Number.isInteger(t)&&t>=0&&t<=5;function ps(t,e){const a=t?.[e];return e==="portrait_chips"?St(a)?a:null:Ot(a)?a:null}function hs(t){return{portrait_chips:St(t?.portrait_chips)?t.portrait_chips:st.portrait_chips,safe_margin:Ot(t?.safe_margin)?t.safe_margin:st.safe_margin}}function us(t,e){return t==="portrait_chips"?[e==="drop"?"portraitChips_drop":"portraitChips_rows"]:e===0?["safeMargin_0"]:["safeMargin_pct",{n:e}]}var vs=Object.defineProperty,bs=Object.getOwnPropertyDescriptor,K=(t,e,a,o)=>{for(var l=o>1?void 0:o?bs(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&vs(e,a,l),l};const ft=(t,e)=>{const[a,o]=us(t,e);return s(a,o)};let I=class extends k{constructor(){super(...arguments),this.defaults=st,this.mode="board"}emit(t,e){const a=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(a,{detail:{[t]:e},bubbles:!0,composed:!0}))}row(t,e,a,o,l){const i=this.mode==="board",r=i?ps(this.display,t):this.defaults[t],h=ft(t,this.defaults[t]);return n`<div class="fld" data-tv-fit=${t}><span class="lbl">${o}</span>
      <sw-segmented label=${o} data-seg=${e} value=${r===null?"__default__":String(r)}
        @change=${d=>{if(d.detail.value==="__default__")this.emit(t,null);else{const c=a.find(w=>String(w)===d.detail.value);c!==void 0&&this.emit(t,c)}}}
        .options=${[...i?[{value:"__default__",label:s("tvUseDefault"),title:h,attrs:{"data-v":"default"}}]:[],...a.map(d=>({value:String(d),label:ft(t,d),attrs:{"data-v":String(d)}}))]}></sw-segmented>
      ${i&&r===null?n`<span class="hint" data-default-note>${s("tvDefaultNow",{v:h})}</span>`:p}
      <span class="hint">${l}</span></div>`}render(){return this.mode==="board"&&!this.display?n``:n`<div class="r" data-tv-fit-rows>
      ${this.row("portrait_chips","portrait-chips",ds,s("portraitChipsLabel"),s("portraitChipsHint"))}
      ${this.row("safe_margin","safe-margin",cs,s("safeMarginLabel"),s("safeMarginHint"))}</div>`}};I.styles=[x];K([g({attribute:!1})],I.prototype,"display",2);K([g({attribute:!1})],I.prototype,"defaults",2);K([g()],I.prototype,"mode",2);I=K([_("notice-display-fit")],I);const rt={orderHint:"הסדר ברשימה הוא סדר הסמלים בלוח וגם סדר העדיפות: כשאין מקום בשורה, מוסתר קודם סמל תקין שנמצא נמוך ברשימה. תקלה נשארת עד הסוף.",moveUp:"הזזה למעלה: {k}",moveDown:"הזזה למטה: {k}",noSource:"אין מקור, הסמל לא יוצג. בוחרים מקור בהגדרות לוח ההודעות.",sourcesTitle:"מקורות לסמלי החניה וחדר הכושר",sourcesHint:"הסמל מציג רק את המצב (מילה וצבע), לא את שם הישות. בלי ישות נבחרת הסמל לא מוצג.",parkingLabel:"חניה",parkingHint:"מספר = מקומות פנויים (מסוכם בין הישויות). חיישן תפוס/פנוי = מקום אחד (פעיל = תפוס). רשימת בחירה = האפשרות כפי שנכתבה.",gymLabel:"חדר כושר",gymHint:"מתג או לוח זמנים: פעיל = פתוח, כבוי = סגור. חיישן נוכחות: בשימוש / פנוי, בלי מספר אנשים. רשימת בחירה = האפשרות כפי שנכתבה.",pick:"בחירת ישות",add:"הוספה",remove:"הסרה",removeOne:"הסרה: {n}",none:"לא נבחרה ישות",noCandidates:"אין ישויות מתאימות",max:"עד {n} ישויות",gone:"לא נמצאה",invert:"הפוך",invertOne:"הפוך: {n}",invertParking:"הפוך: לחיישן או מתג שבו פעיל = פנוי (במקום פעיל = תפוס).",invertGym:"הפוך: למתג או חיישן שבו פעיל = סגור, או בחיישן נוכחות פעיל = פנוי."},zt=Et("en","i18n/notice-chips","en"),gs={he:rt,en:zt};function m(t,e,a=Ct()){const o=gs[a][t]??rt[t]??t;return Tt(o,e)}Nt("i18n/notice-chips",{he:rt,en:zt});const dt=["elevators","generator","parking","gym"],at=8,fs=t=>dt.includes(t);function ct(t){return[...new Set((t??[]).filter(fs))]}function ms(t){const e=ct(t),a=dt.filter(o=>!e.includes(o));return[...e.map((o,l)=>({kind:o,on:!0,pos:l,count:e.length})),...a.map(o=>({kind:o,on:!1,pos:-1,count:e.length}))]}function $s(t,e,a){const o=ct(t).filter(l=>l!==e);return a?[...o,e]:o}function mt(t,e,a){const o=ct(t),l=o.indexOf(e),i=l+a;return l<0||i<0||i>=o.length||([o[l],o[i]]=[o[i],o[l]]),o}function ws(t,e){return!e||t!=="parking"&&t!=="gym"?!1:!e[t]?.length}function ys(t,e){return!e||t.includes(e)||t.length>=at?[...t]:[...t,e]}function ks(t,e){return t.filter(a=>a!==e)}function _s(t,e){return(t??[]).filter(a=>!e.includes(a.entity_id))}const xs=["binary_sensor","input_boolean","switch","schedule"];function it(t){return xs.includes(t.split(".")[0]??"")}function Ds(t,e,a,o){const l=new Set(e.filter(i=>i!==a));return o&&l.add(a),t.filter(i=>l.has(i)&&it(i))}function Ss(t,e){return(t??[]).find(a=>a.entity_id===e)?.name??null}var Os=Object.defineProperty,zs=Object.getOwnPropertyDescriptor,Q=(t,e,a,o)=>{for(var l=o>1?void 0:o?zs(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Os(e,a,l),l};const Ls={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let R=class extends k{constructor(){super(...arguments),this.value=[],this.show=!0,this.sources=null}emit(t){this.dispatchEvent(new CustomEvent("info-change",{detail:[...t],bubbles:!0,composed:!0}))}render(){const t=this.value.length>0,e=ms(this.value);return n`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${a=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:a.target.checked,bubbles:!0,composed:!0}))}>${s("infoShow")}</label>
      <p class="help" data-info-help>${s("infoOldBoards")}</p>
      <label class="ck"><input type="checkbox" .checked=${t} @change=${a=>this.emit(a.target.checked?[...dt]:[])}>${s("blkInfo")}</label>
      <ol class="ord" data-info-order>${e.map(a=>{const o=s(Ls[a.kind]);return n`<li data-info-row=${a.kind} data-on=${String(a.on)}>
          <label class="ck"><input type="checkbox" data-info=${a.kind} .checked=${a.on} @change=${l=>this.emit($s(this.value,a.kind,l.target.checked))}>${o}</label>
          ${a.on?n`<button type="button" class="mv up" data-info-up=${a.kind} aria-label=${m("moveUp",{k:o})} title=${m("moveUp",{k:o})} ?disabled=${a.pos<=0}
              @click=${()=>this.emit(mt(this.value,a.kind,-1))}><sw-icon name="chevron" size="14"></sw-icon></button>
            <button type="button" class="mv down" data-info-down=${a.kind} aria-label=${m("moveDown",{k:o})} title=${m("moveDown",{k:o})} ?disabled=${a.pos>=a.count-1}
              @click=${()=>this.emit(mt(this.value,a.kind,1))}><sw-icon name="chevron" size="14"></sw-icon></button>`:p}
          ${a.on&&ws(a.kind,this.sources)?n`<span class="note" data-info-no-source=${a.kind}>${m("noSource")}</span>`:p}
        </li>`})}</ol>
      <p class="hint" data-info-order-hint>${s("infoIconsOnly")}. ${m("orderHint")}</p>
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
  `;Q([g({attribute:!1})],R.prototype,"value",2);Q([g({type:Boolean})],R.prototype,"show",2);Q([g({attribute:!1})],R.prototype,"sources",2);R=Q([_("notice-display-info")],R);var Ps=Object.defineProperty,Es=Object.getOwnPropertyDescriptor,E=(t,e,a,o)=>{for(var l=o>1?void 0:o?Es(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Ps(e,a,l),l};let S=class extends k{constructor(){super(...arguments),this.parking=[],this.gym=[],this.candidates={},this.inverted={},this.disabled=!1,this.pick={parking:"",gym:""}}emit(t,e){this.send({[`${t}_entities`]:e})}send(t){this.dispatchEvent(new CustomEvent("info-sources-change",{detail:t,bubbles:!0,composed:!0}))}one(t){const e=t==="parking"?this.parking:this.gym,a=this.candidates[t]??[],o=_s(a,e),l=e.length>=at,i=m(t==="parking"?"parkingLabel":"gymLabel"),r=this.inverted[t]??[],h=m(t==="parking"?"invertParking":"invertGym"),d=`ns-src-${t}`;return n`<div class="src fld" data-info-source=${t}>
      <label for=${d}>${i}</label>
      ${e.length?n`<ul class="picked" data-info-source-list>${e.map(c=>{const w=Ss(a,c);return n`<li class=${w===null?"gone":""} data-info-source-item=${c}><span>${w??m("gone")}</span>
          ${it(c)?n`<label class="inv" title=${h}><input type="checkbox" data-info-source-invert
            aria-label=${m("invertOne",{n:w??m("gone")})} .checked=${r.includes(c)} ?disabled=${this.disabled}
            @change=${O=>this.send({[`${t}_inverted`]:Ds(e,r,c,O.target.checked)})}>${m("invert")}</label>`:p}
          <button type="button" aria-label=${m("removeOne",{n:w??m("gone")})} ?disabled=${this.disabled} @click=${()=>this.emit(t,ks(e,c))}>${m("remove")}</button></li>`})}</ul>`:n`<span class="mut" data-info-source-none>${m("none")}</span>`}
      <div class="row">
        <select id=${d} class="inp" data-info-source-pick .value=${this.pick[t]} ?disabled=${this.disabled||l||!o.length}
          @change=${c=>this.pick={...this.pick,[t]:c.target.value}}>
          <option value="">${o.length?m("pick"):m("noCandidates")}</option>
          ${o.map(c=>n`<option value=${c.entity_id}>${c.name}</option>`)}</select>
        <button type="button" class="add" data-info-source-add ?disabled=${this.disabled||l||!this.pick[t]}
          @click=${()=>{const c=this.pick[t];this.pick={...this.pick,[t]:""},this.emit(t,ys(e,c))}}>${m("add")}</button>
        ${l?n`<span class="mut">${m("max",{n:at})}</span>`:p}
      </div>
      <span class="hint">${m(t==="parking"?"parkingHint":"gymHint")}</span>
      ${e.some(it)?n`<span class="hint" data-info-source-invert-hint>${h}</span>`:p}
    </div>`}render(){return n`<div class="srcs" data-info-sources>
      <span class="lbl">${m("sourcesTitle")}</span>
      <span class="hint">${m("sourcesHint")}</span>
      ${this.one("parking")}
      ${this.one("gym")}
    </div>`}};S.styles=[x,A`
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
  `];E([g({attribute:!1})],S.prototype,"parking",2);E([g({attribute:!1})],S.prototype,"gym",2);E([g({attribute:!1})],S.prototype,"candidates",2);E([g({attribute:!1})],S.prototype,"inverted",2);E([g({type:Boolean})],S.prototype,"disabled",2);E([u()],S.prototype,"pick",2);S=E([_("notice-info-sources")],S);var Ns=Object.defineProperty,Ts=Object.getOwnPropertyDescriptor,D=(t,e,a,o)=>{for(var l=o>1?void 0:o?Ts(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Ns(e,a,l),l};let y=class extends k{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await It(this.boardId)}catch(t){this.err=$(t)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(t){this.err="",this.confirming=!1,this.dlg={id:t.id,title:t.title,text:t.text,seconds:t.seconds?String(t.seconds):"",boards:[...t.boards],hasImage:t.has_image,removeImage:!1,file:null}}set(t){this.dlg&&(this.dlg={...this.dlg,...t})}async save(){const t=this.dlg;if(!t||!t.title.trim())return;const e=t.seconds.trim()===""?null:Number(t.seconds);this.busy=!0,this.err="";try{const a={title:t.title.trim(),text:t.text.trim(),seconds:e,board_ids:t.boards};let o=t.id;o?await Rt(o,a):o=(await At(a)).id,t.file?await Bt(o,t.file):t.removeImage&&t.hasImage&&await Ht(o),this.dlg=null,await this.load(),this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}async removeSlide(){const t=this.dlg;if(t?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await Ut(t.id),this.dlg=null,await this.load(),this.changed()}catch(e){this.err=$(e)}finally{this.busy=!1,this.confirming=!1}}}async photo(t,e=!1){this.busy=!0,this.err="";try{const a=e?t?await jt(this.boardId,t):await Ft(this.boardId):t?await Wt(this.boardId,t):await Gt(this.boardId);this.doc={...this.doc??a,photo:a.photo,photo_night:a.photo_night},this.changed()}catch(a){this.err=$(a)}finally{this.busy=!1}}pickBoard(t){const e=this.dlg;e&&this.set({boards:e.boards.includes(t)?e.boards.filter(a=>a!==t):[...e.boards,t]})}dialog(){const t=this.dlg;if(!t)return n`<sw-dialog></sw-dialog>`;const e=this.doc?.seconds.min??6,a=this.doc?.seconds.max??120,o=t.file?t.file.name:t.hasImage&&!t.removeImage?s("slidePicture"):s("slideNoPicture");return n`<sw-dialog open data-slide-dialog heading=${t.id?s("slideEditTitle"):s("slideNew")} @close=${()=>this.dlg=null}>
      <div class="form">
        <div class="fld"><label for="sl-title">${s("slideTitle")}</label><input id="sl-title" class="inp" maxlength="80" .value=${t.title} @input=${l=>this.set({title:l.target.value})}></div>
        <div class="fld"><label for="sl-text">${s("slideText")}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${t.text} @input=${l=>this.set({text:l.target.value})}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${s("slideSeconds")}</label><input id="sl-sec" class="inp short num" type="number" min=${e} max=${a} .value=${t.seconds} @input=${l=>this.set({seconds:l.target.value})}></div>
          <div class="fld"><span class="lbl">${s("slidePicture")}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${()=>this.renderRoot.querySelector("[data-slide-file]").click()}>${s("slidePick")}</sw-button>
              <span class="nm">${o}</span>
              ${t.file||t.hasImage&&!t.removeImage?n`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${()=>this.set({file:null,removeImage:!0})}>${s("slideRemovePicture")}</sw-button>`:p}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${l=>this.set({file:l.target.files?.[0]??null,removeImage:!1})}></div></div>
        </div>
        ${this.boards.length>1?n`<div class="fld"><span class="lbl">${s("slideBoards")}</span>
          <div class="chips" data-slide-boards>${this.boards.map(l=>n`<button class="pick" aria-pressed=${String(t.boards.includes(l.id))} data-slide-board=${l.id} @click=${()=>this.pickBoard(l.id)}>${l.name}</button>`)}</div></div>`:p}
      </div>
      ${this.err?n`<p class="err" role="alert" data-slide-error>${this.err}</p>`:p}
      ${t.id?n`<sw-button slot="footer" variant=${this.confirming?"danger":"ghost"} ?disabled=${this.busy} data-slide-delete @click=${()=>this.removeSlide()}>${this.confirming?s("slideDeleteConfirm"):s("slideDelete")}</sw-button>`:n`<sw-button slot="footer" variant="ghost" @click=${()=>this.dlg=null}>${s("cancel")}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy||!t.title.trim()} data-slide-save @click=${()=>this.save()}>${s("save")}</sw-button>
    </sw-dialog>`}render(){if(!this.display)return n``;const t=this.doc?.slides??[],e=this.doc?.limit??10,a=this.display.rotate_s||12,o=t.reduce((r,h)=>r+(h.seconds||a),0),l=this.doc?.photo,i=this.doc?.photo_night;return n`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(r.target.checked)}>${s("slidesBlock")}</label>
          <span class="st num" data-slides-count>${s("slidesCount",{n:t.length,s:o})}</span></div>
        <div class="slides" data-slide-grid>${t.map(r=>n`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?n`<img alt="" src=${Mt(r)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${s("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${t.length>=e} title=${s("slideLimit",{n:e})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${s("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?n`<div class="blk" data-photo-block><span class="ck"><b>${s("photoBlock")}</b></span>
        <div class="photo"><div class="th">${l?.has?n`<img alt="" data-photo-img src=${Vt(this.boardId,l.stamp)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${l?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${l?.has?n`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${s("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const h=r.target,d=h.files?.[0];h.value="",d&&this.photo(d)}}></div>
        ${!this.dlg&&this.err?n`<p class="err" role="alert" data-photo-error>${this.err}</p>`:p}</div>`:p}
      ${this.lux?n`<div class="blk" data-photo-night-block><span class="ck"><b>${s("photoNightBlock")}</b></span><span class="hint">${s("photoNightHint")}</span>
        <div class="photo"><div class="th">${i?.has?n`<img alt="" data-photo-night-img src=${qt(this.boardId,i.stamp)}>`:n`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${i?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${i?.has?n`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${s("photoRemove")}</sw-button>`:p}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const h=r.target,d=h.files?.[0];h.value="",d&&this.photo(d,!0)}}></div></div>`:p}
      ${this.dialog()}`}emitPromo(t){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:t}},bubbles:!0,composed:!0}))}};y.styles=[x,A`
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
    `];D([g({attribute:!1})],y.prototype,"display",2);D([g({attribute:!1})],y.prototype,"boardId",2);D([g({type:Boolean})],y.prototype,"lux",2);D([g({attribute:!1})],y.prototype,"boards",2);D([u()],y.prototype,"doc",2);D([u()],y.prototype,"dlg",2);D([u()],y.prototype,"err",2);D([u()],y.prototype,"busy",2);D([u()],y.prototype,"confirming",2);y=D([_("notice-display-slides")],y);var Cs=Object.defineProperty,Is=Object.getOwnPropertyDescriptor,U=(t,e,a,o)=>{for(var l=o>1?void 0:o?Is(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Cs(e,a,l),l};let L=class extends k{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await Ye()}catch{this.failed=!0}}get scr(){return Me(this.display)}emit(t){const e=(this.t?.config.stops??[]).map(o=>o.code),a=Xe(this.scr,t,e);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:a},bubbles:!0,composed:!0}))}render(){if(!this.display)return n``;const t=this.scr,e=this.t?.config.stops??[],a=!!this.t?.config.enabled&&e.length>0,o=document.documentElement.lang?.startsWith("en")?"en":"he",l=[["side",v("lay_side"),v("lay_side_hint")],["strip",v("lay_strip"),v("lay_strip_hint")],["slide",v("lay_slide"),v("lay_slide_hint")]],i=[["auto",v("grp_auto")],["always",v("grp_always")],["never",v("grp_never")]],r=Ke(t.window_min),h=t.stops.length?t.stops:e.map(d=>d.code);return n`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${t.enabled} @change=${d=>this.emit({enabled:d.target.checked})}><b>${v("scrTitle")}</b> - ${v("scrShow")}</label>
      ${a?p:n`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?v("forbiddenHint"):v("scrOffModule")}</span>
        <a href="#/system/transit">${v("scrGo")}</a></div>`}
      ${t.enabled&&a?n`
        <div class="sub" data-transit-stops>
          <span>${v("scrStops")}</span>
          ${e.map(d=>n`<label class="ck"><input type="checkbox" data-transit-stop=${d.code} .checked=${H(h.includes(d.code))}
            @change=${()=>this.emit({stops:Qe(t.stops,d.code,e.map(c=>c.code))})}>${d.name||d.catalogue_name||d.code}</label>`)}
          ${t.stops.length===0?n`<span class="hint">${v("scrStopsAll")}</span>`:p}
        </div>
        ${this.v2Layout?p:n`<div class="sub"><span>${v("scrLayout")}</span><sw-segmented data-transit-layout value=${t.layout} @change=${d=>this.emit({layout:d.detail.value})}
          .options=${l.map(([d,c,w])=>({value:d,label:c,title:w,attrs:{"data-layout":d}}))}></sw-segmented></div>`}
        <div class="sub"><span>${v("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(t.window_min):"free"} @change=${d=>{const c=d.target.value;this.emit({window_min:c==="free"?45:Number(c)})}}>${Je.map(d=>n`<option value=${String(d)} ?selected=${r==="list"&&t.window_min===d}>${Ze(d,o)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${v("scrWindowFree")}</option></select>
          ${r==="free"?n`<input class="inp short num" type="number" data-transit-window-free min=${N[0]} max=${N[1]} step="1" .value=${H(String(t.window_min))}
            title=${v("scrFree",{a:N[0],b:N[1]})}
            @change=${d=>this.emit({window_min:G(d.target.value,N[0],N[1],t.window_min)})}>`:p}
        </div>
        <div class="sub"><span>${v("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${F[0]} max=${F[1]} step="1" .value=${H(String(t.rows))}
          @change=${d=>this.emit({rows:G(d.target.value,F[0],F[1],t.rows)})}>
          <span>${v("scrGroup")}</span><select class="inp" data-transit-group .value=${t.group} @change=${d=>this.emit({group:d.target.value})}>
            ${i.map(([d,c])=>n`<option value=${d} ?selected=${t.group===d}>${c}</option>`)}</select></div>
        <div class="sub"><span>${v("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${W[0]} max=${W[1]} step="1"
          placeholder=${v("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${H(t.refresh_s==null?"":String(t.refresh_s))}
          @change=${d=>{const c=d.target.value.trim();this.emit({refresh_s:c===""?null:G(c,W[0],W[1],20)})}}>
          <span>${v("scrDistance")}</span><select class="inp" data-transit-distance .value=${t.show_distance==null?"inherit":t.show_distance?"on":"off"} @change=${d=>{const c=d.target.value;this.emit({show_distance:c==="inherit"?null:c==="on"})}}>${[["inherit",v("scrDistInherit")],["on",v("scrDistOn")],["off",v("scrDistOff")]].map(([d,c])=>n`<option value=${d} ?selected=${(t.show_distance==null?"inherit":t.show_distance?"on":"off")===d}>${c}</option>`)}</select></div>
        ${(this.v2Layout??t.layout)==="slide"?n`<div class="sub"><span>${v("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${M[0]} max=${M[1]} step="1" .value=${H(String(t.dwell_s))}
          @change=${d=>this.emit({dwell_s:G(d.target.value,M[0],M[1],t.dwell_s)})}></div>`:p}
      `:p}
    </div>`}};L.styles=[x,A`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];U([g({attribute:!1})],L.prototype,"display",2);U([g({attribute:!1})],L.prototype,"v2Layout",2);U([u()],L.prototype,"t",2);U([u()],L.prototype,"failed",2);L=U([_("notice-display-transit")],L);const ot=40,lt=12,Rs="image/png,image/jpeg",As=3e5;function $t(t){return t.map(e=>({id:e.id,name:e.name,url:e.url,enabled:e.enabled!==!1,has_logo:!!e.has_logo,logo_url:e.logo_url||"",custom:!!e.custom}))}function Bs(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1}}function Hs(t){const e=t.trim();if(!e||e.length>400||/[\s\\]/.test(e))return!1;let a;try{a=new URL(e)}catch{return!1}if(a.protocol!=="https:"||a.username||a.password||a.port&&a.port!=="443")return!1;const o=a.hostname.toLowerCase();return!o.includes(".")||o==="localhost"||o.endsWith(".local")||o.endsWith(".localhost")||o.endsWith(".internal")?!1:/^[0-9.]+$/.test(o)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(o):!o.startsWith("[")}function Lt(t){const e=new Set;return t.map(a=>{const o=a.name.trim();if(!o||o.length>ot)return"name";if(!Hs(a.url))return"url";const l=a.url.trim();return e.has(l)?"dup":(e.add(l),"")})}function wt(t){return t.length<=lt&&Lt(t).every(e=>e==="")}function yt(t,e,a){if(e===a||e<0||a<0||e>=t.length||a>=t.length)return t;const o=t.slice();return o.splice(a,0,o.splice(e,1)[0]),o}function nt(t){return t.map(e=>({...e.id?{id:e.id}:{},name:e.name.trim(),url:e.url.trim(),enabled:e.enabled}))}function kt(t,e){return JSON.stringify(nt(t))!==JSON.stringify(nt(e))||t.some(a=>a.custom)}function Us(t,e){const a=e.find(o=>t.id&&o.id===t.id||o.url===t.url);return a?{name:a.name,logo:a.logo_url||"",known:!a.custom}:{name:t.name,logo:"",known:!1}}function js(t,e=24){const a=t.trim();return a.length<=e?a:a.slice(0,e-1)+"…"}var Fs=Object.defineProperty,Ws=Object.getOwnPropertyDescriptor,j=(t,e,a,o)=>{for(var l=o>1?void 0:o?Ws(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Fs(e,a,l),l};let P=class extends k{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=$t(this.sources),(!kt(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(t=>({...t}))))}say(t){this.dispatchEvent(new CustomEvent("ns-message",{detail:t,bubbles:!0,composed:!0}))}applyAnswer(t,e){const a=this.rows;this.fromProp=t.sources,this.saved=$t(t.sources),this.rows=e?this.saved.map(o=>{const l=a.find(i=>i.id===o.id);return l?{...l,has_logo:o.has_logo,logo_url:o.logo_url,custom:o.custom}:{...o}}).concat(a.filter(o=>!o.id)):this.saved.map(o=>({...o})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:t.sources,bubbles:!0,composed:!0}))}set(t,e){this.rows=this.rows.map((a,o)=>o===t?{...a,...e}:a)}async save(){if(!(this.busy||!wt(this.rows))){this.busy=!0;try{this.applyAnswer(await Yt(nt(this.rows)),!1),this.say(s("nsSaved"))}catch(t){this.say($(t))}finally{this.busy=!1}}}async logo(t,e){const a=this.rows[t];if(!(!e||!a?.id||this.busy)){if(e.size>As){this.say(s("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await Xt(a.id,e),!0)}catch(o){this.say(o instanceof _t&&o.status===422?s("nsLogoFile"):$(o))}finally{this.busy=!1}}}async dropLogo(t){const e=this.rows[t];if(!(!e?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Kt(e.id),!0)}catch(a){this.say($(a))}finally{this.busy=!1}}}rowHtml(t,e,a){const o=this.rows.length-1,l=!!t.id&&!this.busy,i=t.has_logo?s("nsLogoReplace"):s("nsLogoUpload");return n`<div class="row" data-ns-row=${t.id||"new"} data-off=${t.enabled?"0":"1"} data-bad=${a?"1":"0"}>
      <div class="lg" data-ns-logo>${t.has_logo&&t.logo_url?n`<img alt="" src=${t.logo_url}>`:n`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${ot} .value=${t.name} placeholder=${s("nsName")} aria-label=${s("nsName")} @input=${r=>this.set(e,{name:r.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${t.url} placeholder="https://" aria-label=${s("nsUrl")} @input=${r=>this.set(e,{url:r.target.value})}>
      <div class="tools">
        ${t.custom?n`<span class="chip">${s("nsCustomTag")}</span>`:p}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${t.enabled} @change=${r=>this.set(e,{enabled:r.target.checked})}>${s("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!l} title=${t.id?i:s("nsLogoSaveFirst")} aria-label=${i}
          @click=${r=>r.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${Rs} @change=${r=>{const h=r.target;this.logo(e,h.files?.[0]),h.value=""}}>
        ${t.has_logo?n`<button class="ib" type="button" data-ns-logo-del ?disabled=${!l} title=${s("nsLogoRemove")} aria-label=${s("nsLogoRemove")} @click=${()=>this.dropLogo(e)}><sw-icon name="close" size="14"></sw-icon></button>`:p}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${e===0} title=${s("nsUp")} aria-label=${s("nsUp")} @click=${()=>this.rows=yt(this.rows,e,e-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${e===o} title=${s("nsDown")} aria-label=${s("nsDown")} @click=${()=>this.rows=yt(this.rows,e,e+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${s("nsDelete")} aria-label=${s("nsDelete")} @click=${()=>this.rows=this.rows.filter((r,h)=>h!==e)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${a?n`<span class="err" data-ns-err=${a}>${a==="name"?s("nsErrName",{n:ot}):a==="url"?s("nsErrUrl"):s("nsErrDup")}</span>`:p}
    </div>`}render(){const t=Lt(this.rows),e=kt(this.rows,this.saved);return n`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${s("nsCard")}</h2><span class="chip num">${s("nsCount",{n:this.rows.length,m:lt})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=lt} @click=${()=>this.rows=[...this.rows,Bs()]}>${s("nsAdd")}</sw-button></div>
      ${this.rows.length?n`<div class="list" data-ns-list>${this.rows.map((a,o)=>this.rowHtml(a,o,t[o]))}</div>`:n`<span class="mut">${s("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${e?n`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(a=>({...a}))}>${s("nsDiscard")}</sw-button>`:p}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!e||!wt(this.rows)||this.busy} @click=${()=>this.save()}>${s("nsSave")}</sw-button></div>
    </div>`}};P.styles=[x,A`
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
    `];j([g({attribute:!1})],P.prototype,"sources",2);j([u()],P.prototype,"rows",2);j([u()],P.prototype,"saved",2);j([u()],P.prototype,"busy",2);P=j([_("notice-news-sources")],P);var Gs=Object.defineProperty,Ms=Object.getOwnPropertyDescriptor,Pt=(t,e,a,o)=>{for(var l=o>1?void 0:o?Ms(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Gs(e,a,l),l};let q=class extends k{constructor(){super(...arguments),this.value="hide"}render(){return n`<div class="fld"><label for="ns-home-empty">${s("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${t=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:t.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${s("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${s("dHomeEmptyLine")}</option></select></div>`}};q.styles=[x];Pt([g()],q.prototype,"value",2);q=Pt([_("notice-home-empty")],q);var Vs=Object.defineProperty,qs=Object.getOwnPropertyDescriptor,f=(t,e,a,o)=>{for(var l=o>1?void 0:o?qs(e,a):e,i=t.length-1,r;i>=0;i--)(r=t[i])&&(l=(o?r(e,a,l):r(l))||l);return o&&l&&Vs(e,a,l),l};let b=class extends k{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(t){t.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(t=>{t.value!==t.dataset.v&&(t.value=t.dataset.v??"")})}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Qt(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(t){t instanceof _t&&t.status===403?this.forbidden=!0:this.error=$(t)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{this.boards=(await Jt()).boards}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await J(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await pt("all")).notices}catch{this.notices=[]}}catch(t){this.error=$(t)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const t=await Zt();this.floors=t.floors,this.groups=t.groups,this.roles=t.roles}catch{}}}newNotice(t=""){const e=this.s.settings;this.compose=t?te(new Date,e.default_days,e.default_severity,t):ee(new Date,e.default_days,e.default_severity)}editNotice(t){const e=this.notices.find(a=>a.id===t);e&&(this.compose=se(e))}async composed(t){this.compose=null,this.say(t.detail.message);try{this.notices=(await pt("all")).notices}catch{}if(this.detail)try{this.detail=await J(this.detail.board.id)}catch(e){this.say($(e))}this.loadBoards()}composeDialog(){return n`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${t=>this.composed(t)}></notice-compose>`}async patchSettings(t,e=s("saved")){try{const a=await ae(t);this.s&&(this.s={...this.s,settings:a.settings}),"enabled"in t&&(ie(a.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(e)}catch(a){this.say($(a))}}render(){return this.forbidden?n`<sw-page heading=${s("setTitle")}><sw-state-panel state="forbidden" heading=${s("forbidden")} hint=${s("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?n`<sw-page heading=${s("setTitle")}><sw-state-panel state="error" heading=${s("saveError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?n`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast?n`<div class="toast" role="status" ${oe()}>${this.toast}</div>`:p}`:n`<sw-page heading=${s("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const t=this.s,e=t.settings,a=t.can;return n`
      <div class="top"><div><h1>${s("setTitle")}</h1><p class="sub">${s("setSub")}</p></div><span class="sp"></span>
        ${e.enabled&&a.manage?n`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=le}>${s("allNotices")}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${()=>this.newNotice()}>${s("newNotice")}</sw-button></div>`:p}</div>
      ${e.enabled?p:n`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offBody")}
          actionLabel=${a.configure?s("turnOn"):""} @action=${()=>this.patchSettings({enabled:!0})}></sw-state-panel>`}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${s("moduleCard")}</h2><span class="sp"></span>
          <sw-toggle .checked=${e.enabled} ?disabled=${!a.configure} label=${e.enabled?s("moduleOn"):s("moduleOff")} data-module-switch
            @change=${o=>this.patchSettings({enabled:o.detail.checked})}></sw-toggle></div>
          <dl class="kv"><dt>${s("kvWrite")}</dt><dd>${s("kvWriteV")} <span class="mut ltr">(notices.manage)</span></dd><dt>${s("kvPush")}</dt><dd>${s("kvPushV")} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${s("kvBoards")}</dt><dd>${s("kvBoardsV")} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${a.configure?this.defaultsCard():p}
      </div>
      ${a.configure?n`<notice-news-sources .sources=${e.news_sources} @ns-message=${o=>this.say(o.detail)}
        @news-sources-change=${o=>this.s={...this.s,settings:{...this.s.settings,news_sources:o.detail}}}></notice-news-sources>`:p}
      ${e.enabled&&a.boards?n`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${s("boardsCard")}</h2><span class="chip num">${s("boardsCount",{n:this.boards.length,m:e.boards_max})}</span><span class="sp"></span>
          ${a.configure?n`<label class="ck"><input type="checkbox" .checked=${e.boards_remote} @change=${o=>this.patchSettings({boards_remote:o.target.checked})}>${s("dRemote")}</label>`:p}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length>=e.boards_max} @click=${()=>this.openCreate()}>${s("newBoard")}</sw-button></div>
        ${this.boards.length?n`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map(o=>this.boardCard(o))}</div>`:n`<sw-state-panel icon="wall" state="empty" heading=${s("noBoards")} hint=${s("boardsEmpty")} actionLabel=${s("firstBoard")} @action=${()=>this.openCreate()}></sw-state-panel>`}
      </div>`:p}
      ${e.enabled&&a.boards?this.tvDefaultsCard():p}`}tvDefaults(){return Ve(this.s?.settings.tv_defaults)}tvDefaultsCard(){return n`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${s("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${s("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-design>
      <notice-display-fit mode="defaults" .defaults=${this.tvFitDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-fit>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return qe(this.s?.settings.tv2_defaults)}tvFitDefaults(){return hs(this.s?.settings.tv2_defaults)}async saveTvDefaults(t){try{const e=await ne(t);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:e.tv_defaults,...e.tv2_defaults?{tv2_defaults:e.tv2_defaults}:{}}}),this.say(s("saved"))}catch(e){this.say($(e))}}defaultsCard(){const t=this.s,e=t.settings;return n`<div class="panel" data-defaults-card><div class="hd"><h2>${s("defaultsCard")}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${s("dDays")}</label><div class="sum"><sw-field class="short"><input id="ns-days" class="num" type="number" min="1" max="90" .value=${String(e.default_days)}
          @change=${a=>this.patchSettings({default_days:Number(a.target.value)})}></sw-field><span class="mut">${s("dDaysUnit")}</span></div></div>
        <div class="fld"><label for="ns-sev">${s("dSeverity")}</label><sw-field><select id="ns-sev" data-v=${e.default_severity} @change=${a=>this.patchSettings({default_severity:a.target.value})}>
          <option value="info">${s("sevInfo")}</option><option value="alert">${s("sevAlert")}</option></select></sw-field></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${s("dReads")}</label><sw-field><select id="ns-reads" data-v=${e.reads_names?"names":"counts"} @change=${a=>this.patchSettings({reads_names:a.target.value==="names"})}>
          <option value="names">${s("dReadsNames")}</option><option value="counts">${s("dReadsCounts")}</option></select></sw-field></div>
        <div class="fld"><label for="ns-ret">${s("dRetention")}</label><sw-field><select id="ns-ret" data-v=${String(e.retention_days)}
          @change=${a=>this.patchSettings({retention_days:Number(a.target.value)})}>
          ${re(e.retention_days).map(a=>n`<option value=${String(a.value)}>${a.label}</option>`)}</select></sw-field></div>
        <notice-home-empty .value=${e.home_empty??"hide"} @home-empty-change=${a=>this.patchSettings({home_empty:a.detail})}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${s("dPush")}</label><sw-field><select id="ns-push" data-v=${e.push_default}
          @change=${a=>this.patchSettings({push_default:a.target.value})}>
          <option value="by_severity">${s("dPushSev")}</option><option value="always">${s("dPushAlways")}</option><option value="never">${s("dPushNever")}</option></select></sw-field>
          <span class="hint">${s("dPushHint")}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${s("dWeather")}</label><sw-field><select id="ns-wx" data-v=${e.weather_entity} @change=${a=>this.patchSettings({weather_entity:a.target.value})}>
          <option value="">${s("dWeatherNone")}</option>${t.weather_entities.map(a=>n`<option value=${a.entity_id}>${a.name}</option>`)}</select></sw-field></div>
        <div class="fld"><label for="ns-bn">${s("dBuilding")}</label><sw-field><input id="ns-bn" maxlength="60" .value=${e.building_name} placeholder=${t.building_fallback}
          @change=${a=>this.patchSettings({building_name:a.target.value})}></sw-field><span class="hint">${s("dBuildingHint",{name:t.building_fallback||"-"})}</span></div>
      </div>
      <notice-info-sources .parking=${e.parking_entities??[]} .gym=${e.gym_entities??[]} .candidates=${t.info_entities??{}}
        .inverted=${{parking:e.parking_inverted??[],gym:e.gym_inverted??[]}}
        @info-sources-change=${a=>this.patchSettings(a.detail)}></notice-info-sources>
      <div class="fld"><label for="ns-origin">${s("dOrigin")}</label><sw-field><input id="ns-origin" class="ltr" maxlength="220" .value=${e.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${a=>this.patchSettings({boards_origin:a.target.value})}></sw-field><span class="hint">${s("dOriginHint")}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${s("dConnTotal")}</label><sw-field class="short"><input id="ns-ctot" class="num" type="number" min="4" max="256" data-conn-total .value=${String(e.conn_total)}
          @change=${a=>this.patchSettings({conn_total:Number(a.target.value)})}></sw-field></div>
        <div class="fld"><label for="ns-cadr">${s("dConnPerAddr")}</label><sw-field class="short"><input id="ns-cadr" class="num" type="number" min="1" max="64" data-conn-per-address .value=${String(e.conn_per_address)}
          @change=${a=>this.patchSettings({conn_per_address:Number(a.target.value)})}></sw-field></div>
      </div>
      <label class="ck" data-places-tree-setting><input type="checkbox" .checked=${e.show_places_tree!==!1} @change=${a=>this.patchSettings({show_places_tree:a.target.checked})}>${s("dPlacesTree")}</label>
      <label class="ck"><input type="checkbox" .checked=${e.news_custom} @change=${a=>this.patchSettings({news_custom:a.target.checked})}>${s("dCustomFeeds")}</label>
      <div class="fld"><span class="lbl">${s("companyLogo")}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${s("logoWhere")}</a></div>
    </div></div>`}seenBadge(t){const e=de(t,Date.now()),a=e==="online"?"ok":e==="off"?"off":"unk",o=e==="online"?s("bOnline"):e==="off"?s("bDisabled"):e==="never"?s("bNever"):s("bIdle");return n`<span class="badge" data-look=${a}>${o}</span>`}summary(t){const e=t.display;if(!e)return"";const a=s(e.template===1?"tpl1":e.template===2?"tpl2":"tpl3"),o=s(e.theme==="day"?"themeDay":e.theme==="night"?"themeNight":"orAuto");return`${a} · ${o} · ${e.rotate_s} ${s("seconds")}`}boardsTable(){return n`<table class="t"><thead><tr><th>${s("bState")}</th><th>${s("bName")}</th><th>${s("bAddress")}</th><th>${s("bItems")}</th><th>${s("bSeen")}</th><th></th></tr></thead><tbody>
      ${this.boards.map(t=>n`<tr class="go" tabindex="0" data-board=${t.slug} @click=${()=>this.goBoard(t)} @keydown=${bt(()=>this.goBoard(t))}>
        <td>${this.seenBadge(t)}</td><td><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></td>
        <td class="ltr mut">/b/${t.slug}</td><td class="num">${t.item_count??0}</td><td class="num mut">${Z(t.last_seen_at,Date.now())}</td>
        <td class="act">${this.rowActions(t)}</td></tr>`)}
      </tbody></table>`}rowActions(t){const e=a=>o=>{o.stopPropagation(),a()};return n`${t.enabled?p:n`<sw-button size="sm" data-activate @click=${e(()=>void this.activate(t))}>${s("activate")}</sw-button>`}
      ${this.canCopyLink()?n`<sw-button size="sm" data-copy-link @click=${e(()=>void this.copyLink(t))}>${s("copyLink")}</sw-button>`:p}
      <sw-button size="sm" @click=${e(()=>this.goBoard(t))}>${s("open")}</sw-button>`}canCopyLink(){const t=this.s?.can;return!!(t?.configure&&t.boards)}async copyLink(t){if(!t.has_stored_link){this.confirmRotate={board:t,copy:!0,legacy:!0};return}try{const e=await ce(t.id);this.link={board:t,token:e.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(t,e.token)).then(()=>this.say(s("copied")),()=>{})}catch(e){this.say($(e))}}async activate(t){try{await ht(t.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===t.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(s("saved"))}catch(e){this.say($(e))}}boardCard(t){return n`<div class="card" tabindex="0" role="link" data-board-card=${t.slug} @click=${()=>this.goBoard(t)} @keydown=${bt(()=>this.goBoard(t))}><div class="row">${this.seenBadge(t)}<span class="ltr mut">/b/${t.slug}</span></div><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></div>`}goBoard(t){location.hash=`${tt}/${encodeURIComponent(t.id)}`}openCreate(){this.creating={name:"",slug:pe("board",this.boards.map(t=>t.slug)),err:""}}createDialog(){const t=this.creating;return n`<sw-dialog ?open=${!!t} heading=${s("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${t?n`<div class="form">
        <div class="fld"><label for="nb-name">${s("bName")}</label><sw-field><input id="nb-name" maxlength="60" .value=${t.name} @input=${e=>this.creating={...t,name:e.target.value,err:""}}></sw-field></div>
        <div class="fld"><label for="nb-slug">${s("bSlug")}</label><sw-field><input id="nb-slug" class="ltr" maxlength="40" .value=${t.slug} @input=${e=>this.creating={...t,slug:e.target.value.toLowerCase(),err:""}}></sw-field><span class="hint">${s("bSlugHint")}</span></div>
        ${t.err?n`<span class="err" role="alert">${t.err}</span>`:p}</div>`:p}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${s("newBoard")}</sw-button></sw-dialog>`}async create(){const t=this.creating;if(t){if(!t.name.trim()){this.creating={...t,err:s("bName")};return}if(!he(t.slug)){this.creating={...t,err:s("bSlugHint")};return}try{const e=await ue({name:t.name.trim(),slug:t.slug});this.creating=null,this.link={board:e.board,token:e.token,rotated:!1},await this.loadBoards()}catch(e){this.creating={...t,err:$(e)}}}}linkUrl(t,e){return ve(t.slug,e,this.s?.settings.boards_origin||void 0)}linkDialog(){const t=this.link,e=t?this.linkUrl(t.board,t.token):"";return n`<sw-dialog ?open=${!!t} heading=${t?s("linkTitle",{name:t.board.name}):""} subheading=${t?.rotated?s("linkSub"):s("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${t?n`<div class="form">
        <div class="link"><code data-board-link>${e}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(e)}>${s("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${xe(e,148)}</div><p class="hint">${s("linkHint")}</p></div>
        ${this.s?.settings.boards_remote?p:n`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${s("linkLan")}</span></div>`}
      </div>`:p}
      <sw-button slot="footer" variant="primary" @click=${()=>this.link=null}>${s("done")}</sw-button></sw-dialog>`}async copy(t){try{await navigator.clipboard.writeText(t),this.say(s("copied"))}catch{this.say(t)}}boardPage(){const t=this.detail,e=t.board,a=[{id:"general",label:s("tabGeneral")},{id:"display",label:s("tabDisplay")},{id:"notices",label:`${s("tabNotices")} (${t.notices.length})`}];return n`
      <div class="top"><div><h1>${e.name}</h1><p class="sub"><a href=${tt}>${s("back")}</a> · <span class="ltr">/b/${e.slug}</span> · ${Z(e.last_seen_at,Date.now())}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("openTv")}</sw-button>
          ${this.canCopyLink()?n`<sw-button icon="copy" data-copy-link @click=${()=>void this.copyLink(e)}>${s("copyLink")}</sw-button>`:p}
          <sw-button icon="refresh" data-rotate @click=${()=>this.confirmRotate={board:e,copy:!1}}>${s("newLink")}</sw-button>
          <sw-toggle .checked=${e.enabled} label=${s("boardEnabled")} @change=${o=>this.saveBoard({enabled:o.detail.checked})}></sw-toggle>
        </div></div>
      <sw-tabs .items=${a} active=${this.tab} panel="board-panel" @change=${o=>this.tab=o.detail.id}></sw-tabs>
      <div class="stack" id="board-panel">${this.tab==="general"?this.generalTab():this.tab==="display"?this.displayTab():this.noticesTab()}</div>`}generalTab(){const t=this.detail.board,e=this.draft;return n`<div class="two">
      <div class="panel"><div class="hd"><h2>${s("tabGeneral")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty&&this.nameDraft===t.name} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${s("bName")}</label><sw-field><input id="bg-name" maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}></sw-field></div>
            <div class="fld"><label for="bg-slug">${s("bSlug")}</label><sw-field><input id="bg-slug" class="ltr" .value=${t.slug} disabled></sw-field></div></div>
          <div class="r">${this.placeField(e.place)}
            <div class="fld"><label for="bg-lang">${s("lang")}</label><sw-field><select id="bg-lang" data-v=${e.lang} @change=${a=>this.setD({lang:a.target.value})}><option value="he">עברית</option><option value="en">English</option></select></sw-field></div></div>
          <dl class="kv"><dt>${s("kvTemplate")}</dt><dd>${this.summary(t)}</dd><dt>${s("bItems")}</dt><dd class="num">${this.detail.notices.length}</dd>
            <dt>${s("kvSeen")}</dt><dd>${Z(t.last_seen_at,Date.now())}</dd><dt>${s("kvCreated")}</dt><dd class="num">${(t.created_at||"").slice(0,10)}</dd>
            <dt>${s("kvRotated")}</dt><dd class="num">${(t.token_rotated_at||"").slice(0,10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${()=>this.confirmDelete=!0}>${s("deleteBoard")}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("bAddress")}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(t,"••••••••••••••••••••••••••••••••")}</code></div>
        <p class="hint">${s("linkOnce")} ${s("linkHint")}</p>
        ${t.has_stored_link===!1?n`<p class="hint" data-link-pending>${s("linkPending")}</p>`:p}
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:t,copy:!1}}>${s("newLink")}</sw-button></div></div>
    </div>`}placeField(t){const e=be(this.floors);if(!e.length)return n`<div class="fld"><label for="bg-place">${s("place")}</label><sw-field><input id="bg-place" maxlength="60" .value=${t} @input=${l=>this.setD({place:l.target.value})}></sw-field></div>`;const a=!!t&&!e.includes(t),o=this.placeOther||a?"__other":t;return n`<div class="fld"><label for="bg-place">${s("place")}</label>
      <sw-field><select id="bg-place" data-place-select data-v=${o} @change=${l=>{const i=l.target.value;this.placeOther=i==="__other",this.placeOther||this.setD({place:i})}}><option value="">-</option>${e.map(l=>n`<option value=${l}>${l}</option>`)}<option value="__other">${s("placeOther")}</option></select></sw-field>
      ${o==="__other"?n`<sw-field><input data-place-text maxlength="60" aria-label=${s("place")} .value=${t} @input=${l=>this.setD({place:l.target.value})}></sw-field>`:p}</div>`}setD(t){this.draft&&(this.draft={...this.draft,...t,blocks:{...this.draft.blocks,...t.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(t=!0){const e=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${t?"embed=1&":""}preview=${e}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(t){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:t},location.origin),this.sendToTvs&&this.detail)try{await ge(this.detail.board.id,t==="toggle"?"pause":t)}catch(e){this.say($(e))}}displayTab(){const t=this.draft,e=[{n:1,t:s("tpl1"),dsc:s("tpl1d")},{n:2,t:s("tpl2"),dsc:s("tpl2d")},{n:3,t:s("tpl3"),dsc:s("tpl3d")}],a=t.layout==="portrait",o=this.s.settings,l=this.detail.notices.filter(i=>i.state==="active");return n`<div class="disp">
      <div class="panel"><div class="hd"><h2>${s("tplCard")}</h2><span class="sp"></span><span class="chip" data-look="acc">${s("tplLive")}</span></div>
        <div class="tpls" data-tpls>${e.map(i=>n`<button class="tpl" data-tpl=${i.n} aria-pressed=${String(t.template===i.n)} @click=${()=>this.setD({template:i.n})}>
          <div class="sch t${i.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${i.t}</b><span>${i.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${s("preview")}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("fullScreen")}</sw-button></div>
        <div class="prev ${a?"port":""}"><iframe data-preview title=${s("preview")} src=${this.previewSrc()} @load=${()=>this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${()=>this.cmd("prev")}>${s("prev")}</sw-button><sw-button size="sm" @click=${()=>this.cmd("toggle")}>${s("pauseToggle")}</sw-button>
          <sw-button size="sm" @click=${()=>this.cmd("next")}>${s("next")}</sw-button><label class="ck"><input type="checkbox" .checked=${this.sendToTvs} @change=${i=>this.sendToTvs=i.target.checked}>${s("sendToTvs")}</label>
          <span class="hint">${s("remoteHint")}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${s("theme")}</span><sw-segmented label=${s("theme")} data-theme-seg value=${t.theme} @change=${i=>this.setD({theme:i.detail.value})}
            .options=${["day","night","auto"].map(i=>({value:i,label:s(i==="day"?"themeDay":i==="night"?"themeNight":"themeAuto")}))}></sw-segmented></div>
            <div class="fld"><span class="lbl">${s("orient")}</span><sw-segmented label=${s("orient")} value=${t.layout} @change=${i=>this.setD({layout:i.detail.value})}
            .options=${["auto","landscape","portrait"].map(i=>({value:i,label:s(i==="auto"?"orAuto":i==="landscape"?"orLand":"orPort")}))}></sw-segmented></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${s("dayHours")}</label><sw-field><input id="bd-dh" class="ltr" placeholder="07:00-19:00" .value=${t.day_hours} @change=${i=>this.setD({day_hours:i.target.value.trim()})}></sw-field><span class="hint">${s("dayHoursHint")}</span></div>
            <div class="fld"><label for="bd-fs">${s("fontSize")}</label><sw-field><select id="bd-fs" data-v=${t.font_size} @change=${i=>this.setD({font_size:i.target.value})}>
              <option value="s">${s("fsS")}</option><option value="m">${s("fsM")}</option><option value="l">${s("fsL")}</option></select></sw-field></div></div>
          <div class="fld"><label class="ck"><input type="checkbox" .checked=${t.night.enabled} @change=${i=>this.setD({night:{...t.night,enabled:i.target.checked}})}>${s("nightDim")}</label>
            ${t.night.enabled?n`<div class="sum">${s("nightFrom")}<sw-field class="short"><input class="ltr" type="time" lang=${ut()} .value=${t.night.from} @change=${i=>this.setD({night:{...t.night,from:i.target.value}})}></sw-field>
              ${s("nightTo")}<sw-field class="short"><input class="ltr" type="time" lang=${ut()} .value=${t.night.to} @change=${i=>this.setD({night:{...t.night,to:i.target.value}})}></sw-field>
              ${s("nightLevel")}<sw-field class="short"><select data-v=${String(t.night.dim)} @change=${i=>this.setD({night:{...t.night,dim:Number(i.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(i=>n`<option value=${String(i)}>${Math.round(i*100)}%</option>`)}</select></sw-field></div>`:p}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${t.burn_in.shift} @change=${i=>this.setD({burn_in:{shift:i.target.checked}})}>${s("burnIn")}</label>
            <label class="ck"><input type="checkbox" .checked=${t.blocks.company_logo} @change=${i=>this.setD({blocks:{...t.blocks,company_logo:i.target.checked}})}>${s("companyLogo")}</label>
            <label class="ck"><input type="checkbox" checked disabled>${s("smplwiseLogo")}</label></div>
          <notice-display-design .display=${t} .defaults=${this.tv2Defaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-design>
          <notice-display-fit .display=${t} .defaults=${this.tvFitDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-fit>
          <notice-display-layout .display=${t} .defaults=${this.tvDefaults()} @display-change=${i=>this.setD(i.detail)}></notice-display-layout>
          <notice-display-saver .display=${xt(t,this.tvDefaults())} @display-change=${i=>this.setD(i.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("whatShown")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.clock} @change=${i=>this.setD({blocks:{...t.blocks,clock:i.target.checked}})}>${s("blkClock")}</label>
            <div class="sub"><label class="ck"><input type="checkbox" .checked=${t.blocks.hebdate} @change=${i=>this.setD({blocks:{...t.blocks,hebdate:i.target.checked}})}>${s("blkHebdate")}</label>
              <label class="ck"><input type="checkbox" .checked=${t.blocks.welcome} @change=${i=>this.setD({blocks:{...t.blocks,welcome:i.target.checked}})}>${s("blkWelcome")}</label></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.weather} @change=${i=>this.setD({blocks:{...t.blocks,weather:i.target.checked}})}>${s("blkWeather")}</label>
            <div class="sub">${o.weather_entity?n`<span class="ltr mut">${o.weather_entity}</span>`:n`<span class="mut">${s("blkWeatherNoEntity")}</span>`}
              <span>${s("hoursAhead")}</span><sw-field class="short"><select data-v=${String(t.weather.hours)} @change=${i=>this.setD({weather:{hours:Number(i.target.value)}})}>${[3,5,8].map(i=>n`<option value=${String(i)}>${i}</option>`)}</select></sw-field></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.news} @change=${i=>this.setD({blocks:{...t.blocks,news:i.target.checked}})}>${s("blkNews")}</label>
            <div class="sub">${t.news.feeds.map((i,r)=>{const h=Us(i,o.news_sources);return n`<div class="feed" data-feed=${i.url}>${h.logo?n`<img class="flg" alt="" src=${h.logo}>`:n`<sw-icon name="link" size="12"></sw-icon>`}<b>${js(h.name)}</b>${h.known?p:n`<span class="chip">${s("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" @click=${()=>this.setD({news:{...t.news,feeds:t.news.feeds.filter((d,c)=>c!==r)}})}>${s("remove")}</sw-button></div>`})}
              <sw-field class="short"><select data-v=${this.feedPick} @change=${i=>this.feedPick=i.target.value}><option value="">${s("feedPick")}</option>
                ${o.news_sources.filter(i=>i.enabled!==!1).map(i=>n`<option value=${i.url}>${i.name}${i.custom?" · "+s("nsCustomTag"):""}</option>`)}${o.news_custom?n`<option value="custom">${s("feedCustom")}</option>`:p}</select></sw-field>
              ${this.feedPick==="custom"?n`<sw-field><input class="ltr" placeholder="https://" .value=${this.feedUrl} @input=${i=>this.feedUrl=i.target.value}></sw-field>`:p}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick||t.news.feeds.length>=6} @click=${()=>this.addFeed()}>${s("add")}</sw-button>
              <span>${s("speed")}</span><sw-segmented label=${s("speed")} value=${t.news.speed} @change=${i=>this.setD({news:{...t.news,speed:i.detail.value}})}
                .options=${["slow","normal","fast"].map(i=>({value:i,label:s(i==="slow"?"spSlow":i==="normal"?"spNormal":"spFast")}))}></sw-segmented></div></div>
          <notice-display-info .value=${t.blocks.info} .show=${t.blocks.info_show!==!1} .sources=${o.parking_entities?{parking:o.parking_entities,gym:o.gym_entities??[]}:null} @info-show-change=${i=>this.setD({blocks:{...t.blocks,info_show:i.detail}})} @info-change=${i=>this.setD({blocks:{...t.blocks,info:i.detail}})}></notice-display-info>
          <div class="blk"><span class="ck"><b>${s("blkNotices")}</b></span><span class="hint">${l.length} ${s("kpiActive")}</span>
            <div class="sub"><span>${s("mode")}</span><sw-segmented label=${s("mode")} data-mode-seg value=${t.mode} @change=${i=>this.setD({mode:i.detail.value})}
              .options=${["rotation","all","focus"].map(i=>({value:i,label:s(i==="rotation"?"modeRotation":i==="all"?"modeAll":"modeFocus"),attrs:{"data-mode":i}}))}></sw-segmented></div>
            <div class="sub"><span>${s("rotateEvery")}</span><sw-field class="short"><input class="num" type="number" min="6" max="60" step="1" data-rot .value=${String(t.rotate_s)}
              @change=${i=>this.setD({rotate_s:Math.max(6,Math.min(60,Math.round(Number(i.target.value)||12)))})}></sw-field><span>${s("seconds")}</span><span class="hint">${s("rotateHint")}</span></div>
            <div class="sub"><span>${s("urgent")}</span><sw-field><select data-urg data-v=${t.urgent==="band"?"stage":t.urgent} @change=${i=>this.setD({urgent:i.target.value})}>
              <option value="stage">${s("urgStage")}</option><option value="stay">${s("urgStay")}</option><option value="full">${s("urgFull")}</option></select></sw-field></div>
            <div class="sub"><span>${s("hold")}</span><sw-field><select data-hold data-v=${t.hold} @change=${i=>this.setD({hold:i.target.value})}>
              <option value="">${s("holdNone")}</option>${l.map(i=>n`<option value=${i.id}>${i.title}</option>`)}</select></sw-field><span class="hint">${s("holdHint")}</span></div>
            <p class="hint">${s("dwellNote")}</p></div>
          <notice-display-transit .display=${t} .v2Layout=${(i=>i.design==="v2"?i.board_layout:null)(et(t,this.tv2Defaults()))} @display-change=${i=>this.setD(i.detail)}></notice-display-transit>
          <notice-display-slides .display=${t} .lux=${["gallery","concierge","stone"].includes(et(t,this.tv2Defaults()).design)} .boardId=${this.detail.board.id} .boards=${this.boards} @display-change=${i=>this.setD(i.detail)} @slides-changed=${()=>this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`}addFeed(){const t=this.draft;if(!t)return;const e=this.feedPick,a=this.s.settings.news_sources.find(l=>l.url===e),o=a?{id:a.id,name:a.name,url:a.url}:e==="custom"&&this.feedUrl.startsWith("https://")?{name:new URL(this.feedUrl).hostname,url:this.feedUrl}:null;!o||t.news.feeds.some(l=>l.url===o.url)||(this.setD({news:{...t.news,feeds:[...t.news.feeds,o]},blocks:{...t.blocks,news:!0}}),this.feedPick="",this.feedUrl="")}noticesTab(){const t=this.detail,e=new Set(t.notices.map(i=>i.id)),a=this.notices.filter(i=>!e.has(i.id)&&(i.state==="active"||i.state==="scheduled"||i.state==="draft")),o=!!this.s?.can.manage,l=i=>o&&this.notices.some(r=>r.id===i&&r.state!=="archived"&&r.state!=="expired");return n`<div class="panel flush">
      <div class="toolbar"><h2>${s("boardNotices")}</h2><span class="chip num">${t.notices.filter(i=>i.state==="active").length} ${s("kpiActive")}</span><span class="sp"></span>
        ${a.length?n`<sw-field class="short"><select data-add-notice @change=${i=>this.addItem(i.target.value)}><option value="">${s("addToBoard")}…</option>
          ${a.map(i=>n`<option value=${i.id}>${i.title}</option>`)}</select></sw-field>`:p}
        ${o?n`<sw-button variant="primary" icon="plus" data-board-compose @click=${()=>this.newNotice(t.board.id)}>${s("newForBoard")}</sw-button>`:p}</div>
      ${t.notices.length?n`<table class="t"><thead><tr><th>${s("colState")}</th><th>${s("colNotice")}</th><th>${s("colWindow")}</th><th></th></tr></thead><tbody>
        ${t.notices.map(i=>n`<tr data-look=${i.state==="active"?vt[i.severity]:"off"} data-board-notice=${i.id}><td><span class="badge" data-look=${i.state==="active"?vt[i.severity]:"off"}>${s(fe[i.severity])}${i.pinned?" · "+s("pinned"):""}</span></td>
          <td><span class="t1">${i.title}</span></td><td class="num mut">${me(i)}</td>
          <td class="act">${l(i.id)?n`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(i.id)}>${s("edit")}</sw-button>`:p}
            <sw-button size="sm" @click=${()=>this.removeItem(i.id)}>${s("removeFromBoard")}</sw-button></td></tr>`)}</tbody></table>`:n`<sw-state-panel icon="inbox" state="empty" heading=${s("boardEmpty")}
            actionLabel=${o?s("newForBoard"):""} @action=${()=>this.newNotice(t.board.id)}></sw-state-panel>`}
    </div>`}async addItem(t){!t||!this.detail||await this.setItems([...this.detail.notices.map(e=>e.id),t])}async removeItem(t){this.detail&&await this.setItems(this.detail.notices.map(e=>e.id).filter(e=>e!==t))}async setItems(t){try{await $e(this.detail.board.id,t),this.detail=await J(this.detail.board.id),this.say(s("saved"))}catch(e){this.say($(e))}}async saveBoard(t){if(this.detail)try{const e=await ht(this.detail.board.id,t);this.detail={...this.detail,board:e.board},this.draft=structuredClone(e.board.display??this.draft),this.dirty=!1,this.say(s("saved")),this.loadBoards()}catch(e){this.say($(e))}}async saveAll(){const t={};this.draft&&this.dirty&&(t.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(t.name=this.nameDraft.trim()),await this.saveBoard(t)}async rotate(t,e){try{const a=await we(t.id);this.link={board:a.board,token:a.token,rotated:!0},this.detail?.board.id===a.board.id&&(this.detail={...this.detail,board:a.board}),this.loadBoards(),e&&navigator.clipboard?.writeText(this.linkUrl(a.board,a.token)).then(()=>this.say(s("copied")),()=>{})}catch(a){this.say($(a))}}rotateDialog(){const t=this.confirmRotate;return n`<sw-dialog ?open=${!!t} heading=${t?s("copyAsk",{name:t.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      ${t?.legacy?n`<p data-no-stored-link>${s("noStoredLink")}</p>`:p}
      <p>${s("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" data-rotate-go @click=${()=>{const e=this.confirmRotate;this.confirmRotate=null,e&&this.rotate(e.board,e.copy)}}>${s("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return n`<sw-dialog ?open=${this.confirmDelete} heading=${s("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${s("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${s("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await ye(this.detail.board.id),this.confirmDelete=!1,location.hash=tt,await this.loadBoards()}catch(t){this.say($(t))}}};b.styles=[ke,_e,x,A`
      /* CR-CMP2-SEGMENTED-B-2450 (owner N10): every text field and select of the page sits in sw-field (one field look for the whole
         form); the short fields (days, connections, the night hours, the dim level, the forecast hours, the feed and notice pickers) keep
         their 90 px */
      sw-field.short { inline-size: 90px; }
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
