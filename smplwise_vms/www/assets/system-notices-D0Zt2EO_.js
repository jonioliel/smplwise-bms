import{F as m,a as y,e as l,qC as s,A as c,H as k,E as C,G as p,qD as vt,R as $,qE as gt,qF as $t,qG as mt,qH as ft,qI as wt,qJ as yt,qK as kt,qL as _t,qM as xt,qN as St,qO as Dt,qP as Ot,qQ as u,qR as Lt,qS as Et,j as ct,qT as Nt,qU as Pt,qV as zt,qW as M,qX as st,qY as Tt,qZ as Ct,q_ as Bt,q$ as It,r0 as Rt,r1 as At,r2 as Ut,r3 as qt,r4 as Ht,r5 as jt,r6 as V,r7 as Ft,r8 as et,r9 as Y,ra as Wt,rb as Gt,rc as Mt,rd as Vt,re as Yt,rf as Xt,rg as Kt,bU as at,rh as it,ri as Jt,rj as Zt,rk as Qt,rl as ts,rm as ss,qB as es}from"./index-DmgaojPZ.js";import{_ as as,W as is,Z as os,V as ls,a9 as ns,aa as pt,U as rs,ab as ds,ac as cs,ad as ps,ae as hs,af as us,ag as bs,ah as K,ai as vs,a3 as gs,aj as $s,ak as ms,al as fs,am as ws,an as ys,ao as ks,p as _s,ap as xs,aq as Ss}from"./transit-logic-CM14P4qH.js";import"./compose-dialog-BZ6uwVw6.js";import{n as _}from"./styles-BydBeloE.js";import{l as z}from"./live-BKWPXK8F.js";import{t as Ds,s as Os,w as Ls,R,a as A,b as Es,W as Ns,c as Ps,d as O,e as U,D as q}from"./model-C91m-CAR.js";import"./sw-logo-art-Va6y_cIM.js";var zs=Object.defineProperty,Ts=Object.getOwnPropertyDescriptor,ht=(t,e,i,o)=>{for(var n=o>1?void 0:o?Ts(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&zs(e,i,n),n};let H=class extends y{emit(t){this.dispatchEvent(new CustomEvent("display-change",{detail:t,bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=as(this.display),e=is(this.display),i=os.map(a=>[a,s(`saver_${a}`)]),o=[["a",s("logos_a")],["b",s("logos_b")],["c",s("logos_c")]],n=ls(this.display)!=="c";return l`<div class="r">
      <div class="fld"><span class="lbl">${s("saverLabel")}</span><div class="seg" data-saver-seg>${i.map(([a,r])=>l`<button data-saver=${a} aria-pressed=${String(t===a)} @click=${()=>this.emit({saver:a})}>${r}</button>`)}</div></div>
      <div class="fld"><span class="lbl">${s("logosLabel")}</span><div class="seg" data-logos-seg>${o.map(([a,r])=>l`<button data-logos=${a} aria-pressed=${String(e===a)} ?disabled=${n} @click=${()=>this.emit({logos:a})}>${r}</button>`)}</div>
        ${n?l`<span class="hint">${s("logosOnlyHeaderC")}</span>`:c}</div>
    </div>`}};H.styles=[_];ht([m({attribute:!1})],H.prototype,"display",2);H=ht([k("notice-display-saver")],H);var Cs=Object.defineProperty,Bs=Object.getOwnPropertyDescriptor,F=(t,e,i,o)=>{for(var n=o>1?void 0:o?Bs(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Cs(e,i,n),n};const Is=[{key:"header",seg:"header",label:"headerLabel",values:rs,text:t=>s(`header_${t}`)},{key:"updated",seg:"updated",label:"updatedLabel",values:ds,text:t=>s(`updated_${t}`)},{key:"space",seg:"space",label:"spaceLabel",values:cs,text:t=>s(`space_${t}`)},{key:"night_logo",seg:"night-logo",label:"nightLogoLabel",values:ps,text:t=>s(`nightLogo_${t}`)},{key:"weather_days",seg:"weather-days",label:"weatherDaysLabel",values:hs,text:t=>t===0?s("weatherDays_0"):t===1?s("weatherDays_1"):s("weatherDays_n",{n:t})},{key:"idle_logo",seg:"idle-logo",label:"idleLogoLabel",values:us,text:t=>s(`idleLogo_${t}`)}];let L=class extends y{constructor(){super(...arguments),this.defaults=ns,this.mode="board"}emit(t,e){const i=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(i,{detail:{[t]:e},bubbles:!0,composed:!0}))}row(t,e,i,o,n){const a=this.mode==="board",r=t.key==="space"&&i==="c"||a&&t.key==="night_logo"&&!o||a&&t.key==="weather_days"&&!n,b=t.text(this.defaults[t.key]),d=t.key==="space"&&r?s("spaceOnlyOneRow"):a&&e===null?s("tvDefaultNow",{v:b}):"";return l`<div class="fld"><span class="lbl">${s(t.label)}</span>
      <div class="seg" data-seg=${t.seg}>
        ${a?l`<button data-v="default" aria-pressed=${String(e===null)} ?disabled=${r} title=${b} @click=${()=>this.emit(t.key,null)}>${s("tvUseDefault")}</button>`:c}
        ${t.values.map(h=>l`<button data-v=${String(h)} aria-pressed=${String(e===h)} ?disabled=${r} @click=${()=>this.emit(t.key,h)}>${t.text(h)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const e=this.display??{},i=x=>t?e[x]??null:this.defaults[x],o=t?pt(e,this.defaults):this.defaults,n=!!e.blocks?.company_logo,a=!!e.blocks?.weather,[r,b,d,h,N,G]=Is.map(x=>this.row(x,i(x.key),o.header,n,a));return l`<div class="r">${r}${b}</div><div class="r">${d}${h}</div><div class="r">${N}${G}</div>`}};L.styles=[_];F([m({attribute:!1})],L.prototype,"display",2);F([m({attribute:!1})],L.prototype,"defaults",2);F([m()],L.prototype,"mode",2);L=F([k("notice-display-layout")],L);var Rs=Object.defineProperty,As=Object.getOwnPropertyDescriptor,W=(t,e,i,o)=>{for(var n=o>1?void 0:o?As(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Rs(e,i,n),n};const Us=[{key:"design",seg:"design",label:"designLabel",values:vs},{key:"board_layout",seg:"board-layout",label:"boardLayoutLabel",values:gs},{key:"co_size",seg:"co-size",label:"coSizeLabel",values:$s},{key:"portrait_order",seg:"portrait-order",label:"portraitOrderLabel",values:ms},{key:"next_row",seg:"next-row",label:"nextRowLabel",values:fs},{key:"live_bg",seg:"live-bg",label:"liveBgLabel",values:ws},{key:"systems_status",seg:"systems-status",label:"systemsStatusLabel",values:ys},{key:"urgent_screen",seg:"urgent-screen",label:"urgentScreenLabel",values:ks}],qs={design:"design_",board_layout:"boardLayout_",co_size:"coSize_",portrait_order:"portraitOrder_",next_row:"nextRow_",live_bg:"liveBg_",systems_status:"systemsStatus_",urgent_screen:"urgentScreen_"},ot=(t,e)=>s(`${qs[t]}${e}`);let E=class extends y{constructor(){super(...arguments),this.defaults=bs,this.mode="board"}emit(t,e){const i=this.mode==="defaults"?"defaults-change":"display-change";this.dispatchEvent(new CustomEvent(i,{detail:{[t]:e},bubbles:!0,composed:!0}))}row(t,e,i){const o=this.mode==="board",n=t.key==="live_bg"||t.key==="systems_status"||t.key==="urgent_screen",a=o&&t.key!=="design"&&!n&&!i,r=ot(t.key,this.defaults[t.key]),b=t.key==="board_layout"&&!o?s("boardLayoutDefaultLabel"):s(t.label),d=a?s("v2Only"):o&&e===null?s("tvDefaultNow",{v:r}):"";return l`<div class="fld"><span class="lbl">${b}</span>
      <div class="seg" data-seg=${t.seg}>
        ${o?l`<button data-v="default" aria-pressed=${String(e===null)} ?disabled=${a} title=${r} @click=${()=>this.emit(t.key,null)}>${s("tvUseDefault")}</button>`:c}
        ${t.values.map(h=>l`<button data-v=${h} aria-pressed=${String(e===h)} ?disabled=${a} @click=${()=>this.emit(t.key,h)}>${ot(t.key,h)}</button>`)}</div>
      ${d?l`<span class="hint" data-default-note>${d}</span>`:c}</div>`}render(){const t=this.mode==="board";if(t&&!this.display)return l``;const e=this.display??{},i=P=>t?e[P]??null:this.defaults[P],n=(t?K(e,this.defaults):this.defaults).design==="v2",[a,r,b,d,h,N,G,x]=Us.map(P=>this.row(P,i(P.key),n));return l`<div class="r" data-tv2>${a}${r}</div><div class="r">${b}${d}</div><div class="r">${h}</div><div class="r" data-lobby>${N}${G}</div><div class="r">${x}</div>`}};E.styles=[_];W([m({attribute:!1})],E.prototype,"display",2);W([m({attribute:!1})],E.prototype,"defaults",2);W([m()],E.prototype,"mode",2);E=W([k("notice-display-design")],E);var Hs=Object.defineProperty,js=Object.getOwnPropertyDescriptor,tt=(t,e,i,o)=>{for(var n=o>1?void 0:o?js(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Hs(e,i,n),n};const X=["elevators","generator","parking","gym"],Fs={elevators:"infoElevators",generator:"infoGenerator",parking:"infoParking",gym:"infoGym"};let T=class extends y{constructor(){super(...arguments),this.value=[],this.show=!0}toggle(t,e){const i=X.filter(o=>o===t?e:this.value.includes(o));this.dispatchEvent(new CustomEvent("info-change",{detail:[...i],bubbles:!0,composed:!0}))}render(){const t=this.value.length>0;return l`<div class="blk" data-info-picker>
      <label class="ck"><input type="checkbox" data-info-show .checked=${this.show} @change=${e=>this.dispatchEvent(new CustomEvent("info-show-change",{detail:e.target.checked,bubbles:!0,composed:!0}))}>${s("infoShow")}</label>
      <p class="help" data-info-help>${s("infoOldBoards")}</p>
      <label class="ck"><input type="checkbox" .checked=${t} @change=${e=>{const i=e.target.checked;this.dispatchEvent(new CustomEvent("info-change",{detail:i?[...X]:[],bubbles:!0,composed:!0}))}}>${s("blkInfo")}</label>
      <div class="sub">${X.map(e=>l`<label class="ck"><input type="checkbox" data-info=${e} .checked=${this.value.includes(e)} @change=${i=>this.toggle(e,i.target.checked)}>${s(Fs[e])}</label>`)}
        <span>${s("infoIconsOnly")}</span></div>
    </div>`}};T.styles=C`
    :host { display: block; }
    .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
    .ck { display: inline-flex; align-items: center; gap: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .help { margin: 0; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sub { display: flex; gap: 8px 16px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  `;tt([m({attribute:!1})],T.prototype,"value",2);tt([m({type:Boolean})],T.prototype,"show",2);T=tt([k("notice-display-info")],T);var Ws=Object.defineProperty,Gs=Object.getOwnPropertyDescriptor,w=(t,e,i,o)=>{for(var n=o>1?void 0:o?Gs(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Ws(e,i,n),n};let f=class extends y{constructor(){super(...arguments),this.boardId="",this.lux=!1,this.boards=[],this.doc=null,this.dlg=null,this.err="",this.busy=!1,this.confirming=!1,this.loadedFor=""}updated(){this.boardId&&this.boardId!==this.loadedFor&&(this.loadedFor=this.boardId,this.load())}async load(){try{this.doc=await vt(this.boardId)}catch(t){this.err=$(t)}}changed(){this.dispatchEvent(new CustomEvent("slides-changed",{bubbles:!0,composed:!0}))}openNew(){this.err="",this.confirming=!1,this.dlg={id:"",title:"",text:"",seconds:"",boards:[this.boardId],hasImage:!1,removeImage:!1,file:null}}openEdit(t){this.err="",this.confirming=!1,this.dlg={id:t.id,title:t.title,text:t.text,seconds:t.seconds?String(t.seconds):"",boards:[...t.boards],hasImage:t.has_image,removeImage:!1,file:null}}set(t){this.dlg&&(this.dlg={...this.dlg,...t})}async save(){const t=this.dlg;if(!t||!t.title.trim())return;const e=t.seconds.trim()===""?null:Number(t.seconds);this.busy=!0,this.err="";try{const i={title:t.title.trim(),text:t.text.trim(),seconds:e,board_ids:t.boards};let o=t.id;o?await gt(o,i):o=(await $t(i)).id,t.file?await mt(o,t.file):t.removeImage&&t.hasImage&&await ft(o),this.dlg=null,await this.load(),this.changed()}catch(i){this.err=$(i)}finally{this.busy=!1}}async removeSlide(){const t=this.dlg;if(t?.id){if(!this.confirming){this.confirming=!0;return}this.busy=!0;try{await wt(t.id),this.dlg=null,await this.load(),this.changed()}catch(e){this.err=$(e)}finally{this.busy=!1,this.confirming=!1}}}async photo(t,e=!1){this.busy=!0,this.err="";try{const i=e?t?await yt(this.boardId,t):await kt(this.boardId):t?await _t(this.boardId,t):await xt(this.boardId);this.doc={...this.doc??i,photo:i.photo,photo_night:i.photo_night},this.changed()}catch(i){this.err=$(i)}finally{this.busy=!1}}pickBoard(t){const e=this.dlg;e&&this.set({boards:e.boards.includes(t)?e.boards.filter(i=>i!==t):[...e.boards,t]})}dialog(){const t=this.dlg;if(!t)return l`<sw-dialog></sw-dialog>`;const e=this.doc?.seconds.min??6,i=this.doc?.seconds.max??120,o=t.file?t.file.name:t.hasImage&&!t.removeImage?s("slidePicture"):s("slideNoPicture");return l`<sw-dialog open data-slide-dialog heading=${t.id?s("slideEditTitle"):s("slideNew")} @close=${()=>this.dlg=null}>
      <div class="form">
        <div class="fld"><label for="sl-title">${s("slideTitle")}</label><input id="sl-title" class="inp" maxlength="80" .value=${t.title} @input=${n=>this.set({title:n.target.value})}></div>
        <div class="fld"><label for="sl-text">${s("slideText")}</label><textarea id="sl-text" class="inp" maxlength="300" .value=${t.text} @input=${n=>this.set({text:n.target.value})}></textarea></div>
        <div class="r">
          <div class="fld"><label for="sl-sec">${s("slideSeconds")}</label><input id="sl-sec" class="inp short num" type="number" min=${e} max=${i} .value=${t.seconds} @input=${n=>this.set({seconds:n.target.value})}></div>
          <div class="fld"><span class="lbl">${s("slidePicture")}</span>
            <div class="file"><sw-button size="sm" icon="image" data-slide-pick @click=${()=>this.renderRoot.querySelector("[data-slide-file]").click()}>${s("slidePick")}</sw-button>
              <span class="nm">${o}</span>
              ${t.file||t.hasImage&&!t.removeImage?l`<sw-button size="sm" variant="ghost" data-slide-unpick @click=${()=>this.set({file:null,removeImage:!0})}>${s("slideRemovePicture")}</sw-button>`:c}
              <input type="file" data-slide-file accept="image/jpeg,image/png" @change=${n=>this.set({file:n.target.files?.[0]??null,removeImage:!1})}></div></div>
        </div>
        ${this.boards.length>1?l`<div class="fld"><span class="lbl">${s("slideBoards")}</span>
          <div class="chips" data-slide-boards>${this.boards.map(n=>l`<button class="pick" aria-pressed=${String(t.boards.includes(n.id))} data-slide-board=${n.id} @click=${()=>this.pickBoard(n.id)}>${n.name}</button>`)}</div></div>`:c}
      </div>
      ${this.err?l`<p class="err" role="alert" data-slide-error>${this.err}</p>`:c}
      ${t.id?l`<sw-button slot="footer" variant=${this.confirming?"danger":"ghost"} ?disabled=${this.busy} data-slide-delete @click=${()=>this.removeSlide()}>${this.confirming?s("slideDeleteConfirm"):s("slideDelete")}</sw-button>`:l`<sw-button slot="footer" variant="ghost" @click=${()=>this.dlg=null}>${s("cancel")}</sw-button>`}
      <sw-button slot="footer" variant="primary" ?disabled=${this.busy||!t.title.trim()} data-slide-save @click=${()=>this.save()}>${s("save")}</sw-button>
    </sw-dialog>`}render(){if(!this.display)return l``;const t=this.doc?.slides??[],e=this.doc?.limit??10,i=this.display.rotate_s||12,o=t.reduce((r,b)=>r+(b.seconds||i),0),n=this.doc?.photo,a=this.doc?.photo_night;return l`<div class="blk" data-slides>
        <div class="head"><label class="ck"><input type="checkbox" data-promo .checked=${!!this.display.blocks.promo} @change=${r=>this.emitPromo(r.target.checked)}>${s("slidesBlock")}</label>
          <span class="st num" data-slides-count>${s("slidesCount",{n:t.length,s:o})}</span></div>
        <div class="slides" data-slide-grid>${t.map(r=>l`<div class="slide" data-slide=${r.id}><div class="im">${r.has_image?l`<img alt="" src=${St(r)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
            <div class="cap"><b>${r.title}</b><sw-button size="sm" data-slide-edit @click=${()=>this.openEdit(r)}>${s("edit")}</sw-button></div></div>`)}
          <button class="slide add" data-slide-new ?disabled=${t.length>=e} title=${s("slideLimit",{n:e})} @click=${()=>this.openNew()}><div class="im add"><sw-icon name="plus" size="22"></sw-icon></div><div class="cap"><b>${s("slideNew")}</b></div></button></div>
      </div>
      ${this.display.template===2||this.lux?l`<div class="blk" data-photo-block><span class="ck"><b>${s("photoBlock")}</b></span>
        <div class="photo"><div class="th">${n?.has?l`<img alt="" data-photo-img src=${Dt(this.boardId,n.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-file]").click()}>${n?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${n?.has?l`<sw-button size="sm" variant="ghost" data-photo-remove ?disabled=${this.busy} @click=${()=>this.photo(null)}>${s("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-file accept="image/jpeg,image/png" @change=${r=>{const b=r.target,d=b.files?.[0];b.value="",d&&this.photo(d)}}></div>
        ${!this.dlg&&this.err?l`<p class="err" role="alert" data-photo-error>${this.err}</p>`:c}</div>`:c}
      ${this.lux?l`<div class="blk" data-photo-night-block><span class="ck"><b>${s("photoNightBlock")}</b></span><span class="hint">${s("photoNightHint")}</span>
        <div class="photo"><div class="th">${a?.has?l`<img alt="" data-photo-night-img src=${Ot(this.boardId,a.stamp)}>`:l`<sw-icon name="image" size="22"></sw-icon>`}</div>
          <sw-button size="sm" icon="image" data-photo-night-pick ?disabled=${this.busy} @click=${()=>this.renderRoot.querySelector("[data-photo-night-file]").click()}>${a?.has?s("photoReplace"):s("photoUpload")}</sw-button>
          ${a?.has?l`<sw-button size="sm" variant="ghost" data-photo-night-remove ?disabled=${this.busy} @click=${()=>this.photo(null,!0)}>${s("photoRemove")}</sw-button>`:c}
          <input type="file" data-photo-night-file accept="image/jpeg,image/png" @change=${r=>{const b=r.target,d=b.files?.[0];b.value="",d&&this.photo(d,!0)}}></div></div>`:c}
      ${this.dialog()}`}emitPromo(t){this.dispatchEvent(new CustomEvent("display-change",{detail:{blocks:{...this.display.blocks,promo:t}},bubbles:!0,composed:!0}))}};f.styles=[_,C`
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
    `];w([m({attribute:!1})],f.prototype,"display",2);w([m({attribute:!1})],f.prototype,"boardId",2);w([m({type:Boolean})],f.prototype,"lux",2);w([m({attribute:!1})],f.prototype,"boards",2);w([p()],f.prototype,"doc",2);w([p()],f.prototype,"dlg",2);w([p()],f.prototype,"err",2);w([p()],f.prototype,"busy",2);w([p()],f.prototype,"confirming",2);f=w([k("notice-display-slides")],f);var Ms=Object.defineProperty,Vs=Object.getOwnPropertyDescriptor,B=(t,e,i,o)=>{for(var n=o>1?void 0:o?Vs(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&Ms(e,i,n),n};let S=class extends y{constructor(){super(...arguments),this.v2Layout=null,this.t=null,this.failed=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.t=await Ds()}catch{this.failed=!0}}get scr(){return _s(this.display)}emit(t){const e=(this.t?.config.stops??[]).map(o=>o.code),i=Os(this.scr,t,e);this.dispatchEvent(new CustomEvent("display-change",{detail:{transit:i},bubbles:!0,composed:!0}))}render(){if(!this.display)return l``;const t=this.scr,e=this.t?.config.stops??[],i=!!this.t?.config.enabled&&e.length>0,o=document.documentElement.lang?.startsWith("en")?"en":"he",n=[["side",u("lay_side"),u("lay_side_hint")],["strip",u("lay_strip"),u("lay_strip_hint")],["slide",u("lay_slide"),u("lay_slide_hint")]],a=[["auto",u("grp_auto")],["always",u("grp_always")],["never",u("grp_never")]],r=Ls(t.window_min),b=t.stops.length?t.stops:e.map(d=>d.code);return l`<div class="blk" data-transit-block>
      <label class="ck"><input type="checkbox" data-transit-show .checked=${t.enabled} @change=${d=>this.emit({enabled:d.target.checked})}><b>${u("scrTitle")}</b> - ${u("scrShow")}</label>
      ${i?c:l`<div class="sub"><span class="hint" data-transit-unavailable>${this.failed?u("forbiddenHint"):u("scrOffModule")}</span>
        <a href="#/system/transit">${u("scrGo")}</a></div>`}
      ${t.enabled&&i?l`
        <div class="sub" data-transit-stops>
          <span>${u("scrStops")}</span>
          ${e.map(d=>l`<label class="ck"><input type="checkbox" data-transit-stop=${d.code} .checked=${z(b.includes(d.code))}
            @change=${()=>this.emit({stops:Es(t.stops,d.code,e.map(h=>h.code))})}>${d.name||d.catalogue_name||d.code}</label>`)}
          ${t.stops.length===0?l`<span class="hint">${u("scrStopsAll")}</span>`:c}
        </div>
        ${this.v2Layout?c:l`<div class="sub"><span>${u("scrLayout")}</span><div class="seg" data-transit-layout>${n.map(([d,h,N])=>l`<button data-layout=${d} title=${N} aria-pressed=${String(t.layout===d)} @click=${()=>this.emit({layout:d})}>${h}</button>`)}</div></div>`}
        <div class="sub"><span>${u("scrWindow")}</span>
          <select class="inp short" data-transit-window .value=${r==="list"?String(t.window_min):"free"} @change=${d=>{const h=d.target.value;this.emit({window_min:h==="free"?45:Number(h)})}}>${Ns.map(d=>l`<option value=${String(d)} ?selected=${r==="list"&&t.window_min===d}>${Ps(d,o)}</option>`)}
            <option value="free" ?selected=${r==="free"}>${u("scrWindowFree")}</option></select>
          ${r==="free"?l`<input class="inp short num" type="number" data-transit-window-free min=${O[0]} max=${O[1]} step="1" .value=${z(String(t.window_min))}
            title=${u("scrFree",{a:O[0],b:O[1]})}
            @change=${d=>this.emit({window_min:U(d.target.value,O[0],O[1],t.window_min)})}>`:c}
        </div>
        <div class="sub"><span>${u("scrRows")}</span><input class="inp short num" type="number" data-transit-rows min=${R[0]} max=${R[1]} step="1" .value=${z(String(t.rows))}
          @change=${d=>this.emit({rows:U(d.target.value,R[0],R[1],t.rows)})}>
          <span>${u("scrGroup")}</span><select class="inp" data-transit-group .value=${t.group} @change=${d=>this.emit({group:d.target.value})}>
            ${a.map(([d,h])=>l`<option value=${d} ?selected=${t.group===d}>${h}</option>`)}</select></div>
        <div class="sub"><span>${u("scrRefresh")}</span><input class="inp short num" type="number" data-transit-refresh min=${A[0]} max=${A[1]} step="1"
          placeholder=${u("scrRefreshInherit",{n:this.t?.config.refresh_s??20})} .value=${z(t.refresh_s==null?"":String(t.refresh_s))}
          @change=${d=>{const h=d.target.value.trim();this.emit({refresh_s:h===""?null:U(h,A[0],A[1],20)})}}>
          <span>${u("scrDistance")}</span><select class="inp" data-transit-distance .value=${t.show_distance==null?"inherit":t.show_distance?"on":"off"} @change=${d=>{const h=d.target.value;this.emit({show_distance:h==="inherit"?null:h==="on"})}}>${[["inherit",u("scrDistInherit")],["on",u("scrDistOn")],["off",u("scrDistOff")]].map(([d,h])=>l`<option value=${d} ?selected=${(t.show_distance==null?"inherit":t.show_distance?"on":"off")===d}>${h}</option>`)}</select></div>
        ${(this.v2Layout??t.layout)==="slide"?l`<div class="sub"><span>${u("scrDwell")}</span><input class="inp short num" type="number" data-transit-dwell min=${q[0]} max=${q[1]} step="1" .value=${z(String(t.dwell_s))}
          @change=${d=>this.emit({dwell_s:U(d.target.value,q[0],q[1],t.dwell_s)})}></div>`:c}
      `:c}
    </div>`}};S.styles=[_,C`
      .blk { display: grid; gap: 8px; padding-block-end: 10px; border-block-end: 1px solid var(--sw-border); }
      .sub { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-inline-start: 22px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    `];B([m({attribute:!1})],S.prototype,"display",2);B([m({attribute:!1})],S.prototype,"v2Layout",2);B([p()],S.prototype,"t",2);B([p()],S.prototype,"failed",2);S=B([k("notice-display-transit")],S);const J=40,Z=12,Ys="image/png,image/jpeg",Xs=3e5;function lt(t){return t.map(e=>({id:e.id,name:e.name,url:e.url,enabled:e.enabled!==!1,has_logo:!!e.has_logo,logo_url:e.logo_url||"",custom:!!e.custom}))}function Ks(){return{id:"",name:"",url:"https://",enabled:!0,has_logo:!1,logo_url:"",custom:!1}}function Js(t){const e=t.trim();if(!e||e.length>400||/[\s\\]/.test(e))return!1;let i;try{i=new URL(e)}catch{return!1}if(i.protocol!=="https:"||i.username||i.password||i.port&&i.port!=="443")return!1;const o=i.hostname.toLowerCase();return!o.includes(".")||o==="localhost"||o.endsWith(".local")||o.endsWith(".localhost")||o.endsWith(".internal")?!1:/^[0-9.]+$/.test(o)?!/^(0|10|127)\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(o):!o.startsWith("[")}function ut(t){const e=new Set;return t.map(i=>{const o=i.name.trim();if(!o||o.length>J)return"name";if(!Js(i.url))return"url";const n=i.url.trim();return e.has(n)?"dup":(e.add(n),"")})}function nt(t){return t.length<=Z&&ut(t).every(e=>e==="")}function rt(t,e,i){if(e===i||e<0||i<0||e>=t.length||i>=t.length)return t;const o=t.slice();return o.splice(i,0,o.splice(e,1)[0]),o}function Q(t){return t.map(e=>({...e.id?{id:e.id}:{},name:e.name.trim(),url:e.url.trim(),enabled:e.enabled}))}function dt(t,e){return JSON.stringify(Q(t))!==JSON.stringify(Q(e))||t.some(i=>i.custom)}function Zs(t,e){const i=e.find(o=>t.id&&o.id===t.id||o.url===t.url);return i?{name:i.name,logo:i.logo_url||"",known:!i.custom}:{name:t.name,logo:"",known:!1}}function Qs(t,e=24){const i=t.trim();return i.length<=e?i:i.slice(0,e-1)+"…"}var te=Object.defineProperty,se=Object.getOwnPropertyDescriptor,I=(t,e,i,o)=>{for(var n=o>1?void 0:o?se(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&te(e,i,n),n};let D=class extends y{constructor(){super(...arguments),this.sources=[],this.rows=[],this.saved=[],this.busy=!1,this.fromProp=null}willUpdate(){this.sources!==this.fromProp&&(this.fromProp=this.sources,this.saved=lt(this.sources),(!dt(this.rows,this.saved)||!this.rows.length)&&(this.rows=this.saved.map(t=>({...t}))))}say(t){this.dispatchEvent(new CustomEvent("ns-message",{detail:t,bubbles:!0,composed:!0}))}applyAnswer(t,e){const i=this.rows;this.fromProp=t.sources,this.saved=lt(t.sources),this.rows=e?this.saved.map(o=>{const n=i.find(a=>a.id===o.id);return n?{...n,has_logo:o.has_logo,logo_url:o.logo_url,custom:o.custom}:{...o}}).concat(i.filter(o=>!o.id)):this.saved.map(o=>({...o})),this.dispatchEvent(new CustomEvent("news-sources-change",{detail:t.sources,bubbles:!0,composed:!0}))}set(t,e){this.rows=this.rows.map((i,o)=>o===t?{...i,...e}:i)}async save(){if(!(this.busy||!nt(this.rows))){this.busy=!0;try{this.applyAnswer(await Lt(Q(this.rows)),!1),this.say(s("nsSaved"))}catch(t){this.say($(t))}finally{this.busy=!1}}}async logo(t,e){const i=this.rows[t];if(!(!e||!i?.id||this.busy)){if(e.size>Xs){this.say(s("nsLogoFile"));return}this.busy=!0;try{this.applyAnswer(await Et(i.id,e),!0)}catch(o){this.say(o instanceof ct&&o.status===422?s("nsLogoFile"):$(o))}finally{this.busy=!1}}}async dropLogo(t){const e=this.rows[t];if(!(!e?.id||this.busy)){this.busy=!0;try{this.applyAnswer(await Nt(e.id),!0)}catch(i){this.say($(i))}finally{this.busy=!1}}}rowHtml(t,e,i){const o=this.rows.length-1,n=!!t.id&&!this.busy,a=t.has_logo?s("nsLogoReplace"):s("nsLogoUpload");return l`<div class="row" data-ns-row=${t.id||"new"} data-off=${t.enabled?"0":"1"} data-bad=${i?"1":"0"}>
      <div class="lg" data-ns-logo>${t.has_logo&&t.logo_url?l`<img alt="" src=${t.logo_url}>`:l`<sw-icon name="image" size="18"></sw-icon>`}</div>
      <input class="inp" data-ns-name maxlength=${J} .value=${t.name} placeholder=${s("nsName")} aria-label=${s("nsName")} @input=${r=>this.set(e,{name:r.target.value})}>
      <input class="inp ltr url" data-ns-url .value=${t.url} placeholder="https://" aria-label=${s("nsUrl")} @input=${r=>this.set(e,{url:r.target.value})}>
      <div class="tools">
        ${t.custom?l`<span class="chip">${s("nsCustomTag")}</span>`:c}
        <label class="ck"><input type="checkbox" data-ns-on .checked=${t.enabled} @change=${r=>this.set(e,{enabled:r.target.checked})}>${s("nsEnabled")}</label>
        <span class="sp"></span>
        <button class="ib" type="button" data-ns-logo-btn ?disabled=${!n} title=${t.id?a:s("nsLogoSaveFirst")} aria-label=${a}
          @click=${r=>r.currentTarget.nextElementSibling.click()}><sw-icon name="upload" size="14"></sw-icon></button>
        <input class="file" type="file" accept=${Ys} @change=${r=>{const b=r.target;this.logo(e,b.files?.[0]),b.value=""}}>
        ${t.has_logo?l`<button class="ib" type="button" data-ns-logo-del ?disabled=${!n} title=${s("nsLogoRemove")} aria-label=${s("nsLogoRemove")} @click=${()=>this.dropLogo(e)}><sw-icon name="close" size="14"></sw-icon></button>`:c}
        <span class="sp"></span>
        <button class="ib up" type="button" data-ns-up ?disabled=${e===0} title=${s("nsUp")} aria-label=${s("nsUp")} @click=${()=>this.rows=rt(this.rows,e,e-1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-down ?disabled=${e===o} title=${s("nsDown")} aria-label=${s("nsDown")} @click=${()=>this.rows=rt(this.rows,e,e+1)}><sw-icon name="chevron" size="14"></sw-icon></button>
        <button class="ib" type="button" data-ns-del title=${s("nsDelete")} aria-label=${s("nsDelete")} @click=${()=>this.rows=this.rows.filter((r,b)=>b!==e)}><sw-icon name="trash" size="14"></sw-icon></button>
      </div>
      ${i?l`<span class="err" data-ns-err=${i}>${i==="name"?s("nsErrName",{n:J}):i==="url"?s("nsErrUrl"):s("nsErrDup")}</span>`:c}
    </div>`}render(){const t=ut(this.rows),e=dt(this.rows,this.saved);return l`<div class="panel" data-news-sources-card>
      <div class="hd"><h2>${s("nsCard")}</h2><span class="chip num">${s("nsCount",{n:this.rows.length,m:Z})}</span><span class="sp"></span>
        <sw-button size="sm" icon="plus" data-ns-add ?disabled=${this.rows.length>=Z} @click=${()=>this.rows=[...this.rows,Ks()]}>${s("nsAdd")}</sw-button></div>
      ${this.rows.length?l`<div class="list" data-ns-list>${this.rows.map((i,o)=>this.rowHtml(i,o,t[o]))}</div>`:l`<span class="mut">${s("nsEmpty")}</span>`}
      <div class="foot"><span class="sp"></span>
        ${e?l`<sw-button size="sm" variant="ghost" data-ns-discard @click=${()=>this.rows=this.saved.map(i=>({...i}))}>${s("nsDiscard")}</sw-button>`:c}
        <sw-button size="sm" variant="primary" data-ns-save ?disabled=${!e||!nt(this.rows)||this.busy} @click=${()=>this.save()}>${s("nsSave")}</sw-button></div>
    </div>`}};D.styles=[_,C`
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
    `];I([m({attribute:!1})],D.prototype,"sources",2);I([p()],D.prototype,"rows",2);I([p()],D.prototype,"saved",2);I([p()],D.prototype,"busy",2);D=I([k("notice-news-sources")],D);var ee=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,bt=(t,e,i,o)=>{for(var n=o>1?void 0:o?ae(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&ee(e,i,n),n};let j=class extends y{constructor(){super(...arguments),this.value="hide"}render(){return l`<div class="fld"><label for="ns-home-empty">${s("dHomeEmpty")}</label>
      <select id="ns-home-empty" class="inp" data-v=${this.value} data-home-empty .value=${this.value}
        @change=${t=>this.dispatchEvent(new CustomEvent("home-empty-change",{detail:t.target.value,bubbles:!0,composed:!0}))}>
        <option value="hide" ?selected=${this.value==="hide"}>${s("dHomeEmptyHide")}</option>
        <option value="line" ?selected=${this.value==="line"}>${s("dHomeEmptyLine")}</option></select></div>`}};j.styles=[_];bt([m()],j.prototype,"value",2);j=bt([k("notice-home-empty")],j);var ie=Object.defineProperty,oe=Object.getOwnPropertyDescriptor,g=(t,e,i,o)=>{for(var n=o>1?void 0:o?oe(e,i):e,a=t.length-1,r;a>=0;a--)(r=t[a])&&(n=(o?r(e,i,n):r(n))||n);return o&&n&&ie(e,i,n),n};let v=class extends y{constructor(){super(...arguments),this.boardId="",this.s=null,this.boards=[],this.error="",this.forbidden=!1,this.toast="",this.creating=null,this.link=null,this.detail=null,this.tab="general",this.draft=null,this.dirty=!1,this.nameDraft="",this.notices=[],this.feedPick="",this.feedUrl="",this.confirmDelete=!1,this.confirmRotate=null,this.placeOther=!1,this.sendToTvs=!1,this.compose=null,this.floors=[],this.groups=[],this.roles=[],this.optionsLoaded=!1,this.toastTimer=0,this.loadedFor=""}connectedCallback(){super.connectedCallback(),this.load()}willUpdate(t){t.has("boardId")&&this.loadedFor!==this.boardId&&this.s&&this.loadBoard()}updated(){this.renderRoot.querySelectorAll("select[data-v]").forEach(t=>{t.value!==t.dataset.v&&(t.value=t.dataset.v??"")})}say(t){this.toast=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toast="",2600)}async load(){this.error="";try{this.s=await Pt(),this.forbidden=!1,await this.loadBoards(),await this.loadBoard(),this.loadOptions()}catch(t){t instanceof ct&&t.status===403?this.forbidden=!0:this.error=$(t)}}async loadBoards(){if(!this.s?.settings.enabled||!this.s.can.boards){this.boards=[];return}try{this.boards=(await zt()).boards}catch{this.boards=[]}}async loadBoard(){if(this.loadedFor=this.boardId,this.detail=null,this.draft=null,this.dirty=!1,!(!this.boardId||!this.s?.settings.enabled||!this.s.can.boards))try{this.detail=await M(this.boardId),this.draft=structuredClone(this.detail.board.display??null),this.nameDraft=this.detail.board.name;try{this.notices=(await st("all")).notices}catch{this.notices=[]}}catch(t){this.error=$(t)}}async loadOptions(){if(!(this.optionsLoaded||!this.s?.settings.enabled||!this.s.can.manage)){this.optionsLoaded=!0;try{const t=await Tt();this.floors=t.floors,this.groups=t.groups,this.roles=t.roles}catch{}}}newNotice(t=""){const e=this.s.settings;this.compose=t?Ct(new Date,e.default_days,e.default_severity,t):Bt(new Date,e.default_days,e.default_severity)}editNotice(t){const e=this.notices.find(i=>i.id===t);e&&(this.compose=It(e))}async composed(t){this.compose=null,this.say(t.detail.message);try{this.notices=(await st("all")).notices}catch{}if(this.detail)try{this.detail=await M(this.detail.board.id)}catch(e){this.say($(e))}this.loadBoards()}composeDialog(){return l`<notice-compose .draft=${this.compose} .canPush=${this.s?.can.push??!1} .pushDefault=${this.s?.settings.push_default??"by_severity"} .boards=${this.boards} .floors=${this.floors} .groups=${this.groups} .roles=${this.roles}
      @notice-close=${()=>this.compose=null} @notice-saved=${t=>this.composed(t)}></notice-compose>`}async patchSettings(t,e=s("saved")){try{const i=await Rt(t);this.s&&(this.s={...this.s,settings:i.settings}),"enabled"in t&&(At(i.settings.enabled),await this.loadBoards(),this.loadOptions()),this.say(e)}catch(i){this.say($(i))}}render(){return this.forbidden?l`<sw-page heading=${s("setTitle")}><sw-state-panel state="forbidden" heading=${s("forbidden")} hint=${s("setForbidden")}></sw-state-panel></sw-page>`:this.error&&!this.s?l`<sw-page heading=${s("setTitle")}><sw-state-panel state="error" heading=${s("saveError")} hint=${this.error} actionLabel=${s("retry")} @action=${()=>this.load()}></sw-state-panel></sw-page>`:this.s?l`<sw-page heading="" data-notices-settings>${this.boardId&&this.detail?this.boardPage():this.overview()}</sw-page>
      ${this.createDialog()} ${this.linkDialog()} ${this.rotateDialog()} ${this.deleteDialog()} ${this.composeDialog()}
      ${this.toast?l`<div class="toast" role="status">${this.toast}</div>`:c}`:l`<sw-page heading=${s("setTitle")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`}overview(){const t=this.s,e=t.settings,i=t.can;return l`
      <div class="top"><div><h1>${s("setTitle")}</h1><p class="sub">${s("setSub")}</p></div><span class="sp"></span>
        ${e.enabled&&i.manage?l`<div class="meta"><sw-button icon="inbox" data-all-notices @click=${()=>location.hash=Ut}>${s("allNotices")}</sw-button>
          <sw-button variant="primary" icon="plus" data-new-notice @click=${()=>this.newNotice()}>${s("newNotice")}</sw-button></div>`:c}</div>
      ${e.enabled?c:l`<sw-state-panel icon="offline" data-notices-state="off" state="empty" heading=${s("off")} hint=${s("offBody")}
          actionLabel=${i.configure?s("turnOn"):""} @action=${()=>this.patchSettings({enabled:!0})}></sw-state-panel>`}
      <div class="two">
        <div class="panel" data-module-card><div class="hd"><h2>${s("moduleCard")}</h2><span class="sp"></span>
          <sw-toggle .checked=${e.enabled} ?disabled=${!i.configure} label=${e.enabled?s("moduleOn"):s("moduleOff")} data-module-switch
            @change=${o=>this.patchSettings({enabled:o.detail.checked})}></sw-toggle></div>
          <dl class="kv"><dt>${s("kvWrite")}</dt><dd>${s("kvWriteV")} <span class="mut ltr">(notices.manage)</span></dd><dt>${s("kvPush")}</dt><dd>${s("kvPushV")} <span class="mut ltr">(notices.push)</span></dd>
            <dt>${s("kvBoards")}</dt><dd>${s("kvBoardsV")} <span class="mut ltr">(notices.boards)</span></dd></dl></div>
        ${i.configure?this.defaultsCard():c}
      </div>
      ${i.configure?l`<notice-news-sources .sources=${e.news_sources} @ns-message=${o=>this.say(o.detail)}
        @news-sources-change=${o=>this.s={...this.s,settings:{...this.s.settings,news_sources:o.detail}}}></notice-news-sources>`:c}
      ${e.enabled&&i.boards?l`<div class="panel flush" data-boards-card>
        <div class="toolbar"><h2>${s("boardsCard")}</h2><span class="chip num">${s("boardsCount",{n:this.boards.length,m:e.boards_max})}</span><span class="sp"></span>
          ${i.configure?l`<label class="ck"><input type="checkbox" .checked=${e.boards_remote} @change=${o=>this.patchSettings({boards_remote:o.target.checked})}>${s("dRemote")}</label>`:c}
          <sw-button variant="primary" icon="plus" data-new-board ?disabled=${this.boards.length>=e.boards_max} @click=${()=>this.openCreate()}>${s("newBoard")}</sw-button></div>
        ${this.boards.length?l`<div class="scrollx">${this.boardsTable()}</div><div class="cards">${this.boards.map(o=>this.boardCard(o))}</div>`:l`<sw-state-panel icon="wall" state="empty" heading=${s("noBoards")} hint=${s("boardsEmpty")} actionLabel=${s("firstBoard")} @action=${()=>this.openCreate()}></sw-state-panel>`}
      </div>`:c}
      ${e.enabled&&i.boards?this.tvDefaultsCard():c}`}tvDefaults(){return xs(this.s?.settings.tv_defaults)}tvDefaultsCard(){return l`<div class="panel" data-tv-defaults-card><div class="hd"><h2>${s("tvDefaultsCard")}</h2></div><div class="form">
      <p class="hint">${s("tvDefaultsHint")}</p>
      <notice-display-design mode="defaults" .defaults=${this.tv2Defaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-design>
      <notice-display-layout mode="defaults" .defaults=${this.tvDefaults()} @defaults-change=${t=>void this.saveTvDefaults(t.detail)}></notice-display-layout>
    </div></div>`}tv2Defaults(){return Ss(this.s?.settings.tv2_defaults)}async saveTvDefaults(t){try{const e=await qt(t);this.s&&(this.s={...this.s,settings:{...this.s.settings,tv_defaults:e.tv_defaults,...e.tv2_defaults?{tv2_defaults:e.tv2_defaults}:{}}}),this.say(s("saved"))}catch(e){this.say($(e))}}defaultsCard(){const t=this.s,e=t.settings;return l`<div class="panel" data-defaults-card><div class="hd"><h2>${s("defaultsCard")}</h2></div><div class="form">
      <div class="r">
        <div class="fld"><label for="ns-days">${s("dDays")}</label><div class="sum"><input id="ns-days" class="inp short num" type="number" min="1" max="90" .value=${String(e.default_days)}
          @change=${i=>this.patchSettings({default_days:Number(i.target.value)})}><span class="mut">${s("dDaysUnit")}</span></div></div>
        <div class="fld"><label for="ns-sev">${s("dSeverity")}</label><select id="ns-sev" class="inp" data-v=${e.default_severity} @change=${i=>this.patchSettings({default_severity:i.target.value})}>
          <option value="info">${s("sevInfo")}</option><option value="alert">${s("sevAlert")}</option></select></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-reads">${s("dReads")}</label><select id="ns-reads" class="inp" data-v=${e.reads_names?"names":"counts"} @change=${i=>this.patchSettings({reads_names:i.target.value==="names"})}>
          <option value="names">${s("dReadsNames")}</option><option value="counts">${s("dReadsCounts")}</option></select></div>
        <div class="fld"><label for="ns-ret">${s("dRetention")}</label><select id="ns-ret" class="inp" data-v=${String(e.retention_days)}
          @change=${i=>this.patchSettings({retention_days:Number(i.target.value)})}>
          ${Ht(e.retention_days).map(i=>l`<option value=${String(i.value)}>${i.label}</option>`)}</select></div>
        <notice-home-empty .value=${e.home_empty??"hide"} @home-empty-change=${i=>this.patchSettings({home_empty:i.detail})}></notice-home-empty>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-push">${s("dPush")}</label><select id="ns-push" class="inp" data-v=${e.push_default}
          @change=${i=>this.patchSettings({push_default:i.target.value})}>
          <option value="by_severity">${s("dPushSev")}</option><option value="always">${s("dPushAlways")}</option><option value="never">${s("dPushNever")}</option></select>
          <span class="hint">${s("dPushHint")}</span></div>
      </div>
      <div class="r">
        <div class="fld"><label for="ns-wx">${s("dWeather")}</label><select id="ns-wx" class="inp" data-v=${e.weather_entity} @change=${i=>this.patchSettings({weather_entity:i.target.value})}>
          <option value="">${s("dWeatherNone")}</option>${t.weather_entities.map(i=>l`<option value=${i.entity_id}>${i.name}</option>`)}</select></div>
        <div class="fld"><label for="ns-bn">${s("dBuilding")}</label><input id="ns-bn" class="inp" maxlength="60" .value=${e.building_name} placeholder=${t.building_fallback}
          @change=${i=>this.patchSettings({building_name:i.target.value})}><span class="hint">${s("dBuildingHint",{name:t.building_fallback||"-"})}</span></div>
      </div>
      <div class="fld"><label for="ns-origin">${s("dOrigin")}</label><input id="ns-origin" class="inp ltr" maxlength="220" .value=${e.boards_origin} placeholder="http://192.0.2.10:18094"
        @change=${i=>this.patchSettings({boards_origin:i.target.value})}><span class="hint">${s("dOriginHint")}</span></div>
      <div class="r">
        <div class="fld"><label for="ns-ctot">${s("dConnTotal")}</label><input id="ns-ctot" class="inp short num" type="number" min="4" max="256" data-conn-total .value=${String(e.conn_total)}
          @change=${i=>this.patchSettings({conn_total:Number(i.target.value)})}></div>
        <div class="fld"><label for="ns-cadr">${s("dConnPerAddr")}</label><input id="ns-cadr" class="inp short num" type="number" min="1" max="64" data-conn-per-address .value=${String(e.conn_per_address)}
          @change=${i=>this.patchSettings({conn_per_address:Number(i.target.value)})}></div>
      </div>
      <label class="ck" data-places-tree-setting><input type="checkbox" .checked=${e.show_places_tree!==!1} @change=${i=>this.patchSettings({show_places_tree:i.target.checked})}>${s("dPlacesTree")}</label>
      <label class="ck"><input type="checkbox" .checked=${e.news_custom} @change=${i=>this.patchSettings({news_custom:i.target.checked})}>${s("dCustomFeeds")}</label>
      <div class="fld"><span class="lbl">${s("companyLogo")}</span><a href="#/system/diagnostics?tab=general" data-logo-link>${s("logoWhere")}</a></div>
    </div></div>`}seenBadge(t){const e=jt(t,Date.now()),i=e==="online"?"ok":e==="off"?"off":"unk",o=e==="online"?s("bOnline"):e==="off"?s("bDisabled"):e==="never"?s("bNever"):s("bIdle");return l`<span class="badge" data-look=${i}>${o}</span>`}summary(t){const e=t.display;if(!e)return"";const i=s(e.template===1?"tpl1":e.template===2?"tpl2":"tpl3"),o=s(e.theme==="day"?"themeDay":e.theme==="night"?"themeNight":"orAuto");return`${i} · ${o} · ${e.rotate_s} ${s("seconds")}`}boardsTable(){return l`<table class="t"><thead><tr><th>${s("bState")}</th><th>${s("bName")}</th><th>${s("bAddress")}</th><th>${s("bItems")}</th><th>${s("bSeen")}</th><th></th></tr></thead><tbody>
      ${this.boards.map(t=>l`<tr class="go" tabindex="0" data-board=${t.slug} @click=${()=>this.goBoard(t)} @keydown=${e=>e.key==="Enter"&&this.goBoard(t)}>
        <td>${this.seenBadge(t)}</td><td><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></td>
        <td class="ltr mut">/b/${t.slug}</td><td class="num">${t.item_count??0}</td><td class="num mut">${V(t.last_seen_at,Date.now())}</td>
        <td class="act">${this.rowActions(t)}</td></tr>`)}
      </tbody></table>`}rowActions(t){const e=i=>o=>{o.stopPropagation(),i()};return l`${t.enabled?c:l`<sw-button size="sm" data-activate @click=${e(()=>void this.activate(t))}>${s("activate")}</sw-button>`}
      ${this.canCopyLink()?l`<sw-button size="sm" data-copy-link @click=${e(()=>void this.copyLink(t))}>${s("copyLink")}</sw-button>`:c}
      <sw-button size="sm" @click=${e(()=>this.goBoard(t))}>${s("open")}</sw-button>`}canCopyLink(){const t=this.s?.can;return!!(t?.configure&&t.boards)}async copyLink(t){if(!t.has_stored_link){this.confirmRotate={board:t,copy:!0};return}try{const e=await Ft(t.id);this.link={board:t,token:e.token,rotated:!1},navigator.clipboard?.writeText(this.linkUrl(t,e.token)).then(()=>this.say(s("copied")),()=>{})}catch(e){this.say($(e))}}async activate(t){try{await et(t.id,{enabled:!0}),await this.loadBoards(),this.detail?.board.id===t.id&&(this.detail={...this.detail,board:{...this.detail.board,enabled:!0}}),this.say(s("saved"))}catch(e){this.say($(e))}}boardCard(t){return l`<div class="card" @click=${()=>this.goBoard(t)}><div class="row">${this.seenBadge(t)}<span class="ltr mut">/b/${t.slug}</span></div><span class="t1">${t.name}</span><span class="t2">${this.summary(t)}</span></div>`}goBoard(t){location.hash=`${Y}/${encodeURIComponent(t.id)}`}openCreate(){this.creating={name:"",slug:Wt("board",this.boards.map(t=>t.slug)),err:""}}createDialog(){const t=this.creating;return l`<sw-dialog ?open=${!!t} heading=${s("newBoard")} @close=${()=>this.creating=null} data-create-board>
      ${t?l`<div class="form">
        <div class="fld"><label for="nb-name">${s("bName")}</label><input id="nb-name" class="inp" maxlength="60" .value=${t.name} @input=${e=>this.creating={...t,name:e.target.value,err:""}}></div>
        <div class="fld"><label for="nb-slug">${s("bSlug")}</label><input id="nb-slug" class="inp ltr" maxlength="40" .value=${t.slug} @input=${e=>this.creating={...t,slug:e.target.value.toLowerCase(),err:""}}><span class="hint">${s("bSlugHint")}</span></div>
        ${t.err?l`<span class="err" role="alert">${t.err}</span>`:c}</div>`:c}
      <sw-button slot="footer" @click=${()=>this.creating=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-create @click=${()=>this.create()}>${s("newBoard")}</sw-button></sw-dialog>`}async create(){const t=this.creating;if(t){if(!t.name.trim()){this.creating={...t,err:s("bName")};return}if(!Gt(t.slug)){this.creating={...t,err:s("bSlugHint")};return}try{const e=await Mt({name:t.name.trim(),slug:t.slug});this.creating=null,this.link={board:e.board,token:e.token,rotated:!1},await this.loadBoards()}catch(e){this.creating={...t,err:$(e)}}}}linkUrl(t,e){return Vt(t.slug,e,this.s?.settings.boards_origin||void 0)}linkDialog(){const t=this.link,e=t?this.linkUrl(t.board,t.token):"";return l`<sw-dialog ?open=${!!t} heading=${t?s("linkTitle",{name:t.board.name}):""} subheading=${t?.rotated?s("linkSub"):s("linkSubNew")} @close=${()=>this.link=null} data-link-dialog>
      ${t?l`<div class="form">
        <div class="link"><code data-board-link>${e}</code><sw-button size="sm" icon="copy" @click=${()=>this.copy(e)}>${s("copyLink")}</sw-button></div>
        <div class="sum"><div class="qr">${Yt(e,148)}</div><p class="hint">${s("linkHint")}</p></div>
        ${this.s?.settings.boards_remote?c:l`<div class="alert"><sw-icon name="warning" size="14"></sw-icon><span>${s("linkLan")}</span></div>`}
      </div>`:c}
      <sw-button slot="footer" variant="primary" @click=${()=>this.link=null}>${s("done")}</sw-button></sw-dialog>`}async copy(t){try{await navigator.clipboard.writeText(t),this.say(s("copied"))}catch{this.say(t)}}boardPage(){const t=this.detail,e=t.board,i=[{id:"general",label:s("tabGeneral")},{id:"display",label:s("tabDisplay")},{id:"notices",label:`${s("tabNotices")} (${t.notices.length})`}];return l`
      <div class="top"><div><h1>${e.name}</h1><p class="sub"><a href=${Y}>${s("back")}</a> · <span class="ltr">/b/${e.slug}</span> · ${V(e.last_seen_at,Date.now())}</p></div><span class="sp"></span>
        <div class="meta">
          <sw-button icon="eye" data-tv-open @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("openTv")}</sw-button>
          ${this.canCopyLink()?l`<sw-button icon="copy" data-copy-link @click=${()=>void this.copyLink(e)}>${s("copyLink")}</sw-button>`:c}
          <sw-button icon="refresh" data-rotate @click=${()=>this.confirmRotate={board:e,copy:!1}}>${s("newLink")}</sw-button>
          <sw-toggle .checked=${e.enabled} label=${s("boardEnabled")} @change=${o=>this.saveBoard({enabled:o.detail.checked})}></sw-toggle>
        </div></div>
      <sw-tabs .items=${i} active=${this.tab} @change=${o=>this.tab=o.detail.id}></sw-tabs>
      <div class="stack">${this.tab==="general"?this.generalTab():this.tab==="display"?this.displayTab():this.noticesTab()}</div>`}generalTab(){const t=this.detail.board,e=this.draft;return l`<div class="two">
      <div class="panel"><div class="hd"><h2>${s("tabGeneral")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" ?disabled=${!this.dirty&&this.nameDraft===t.name} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="form">
          <div class="r"><div class="fld"><label for="bg-name">${s("bName")}</label><input id="bg-name" class="inp" maxlength="60" .value=${this.nameDraft} @input=${i=>this.nameDraft=i.target.value}></div>
            <div class="fld"><label for="bg-slug">${s("bSlug")}</label><input id="bg-slug" class="inp ltr" .value=${t.slug} disabled></div></div>
          <div class="r">${this.placeField(e.place)}
            <div class="fld"><label for="bg-lang">${s("lang")}</label><select id="bg-lang" class="inp" data-v=${e.lang} @change=${i=>this.setD({lang:i.target.value})}><option value="he">עברית</option><option value="en">English</option></select></div></div>
          <dl class="kv"><dt>${s("kvTemplate")}</dt><dd>${this.summary(t)}</dd><dt>${s("bItems")}</dt><dd class="num">${this.detail.notices.length}</dd>
            <dt>${s("kvSeen")}</dt><dd>${V(t.last_seen_at,Date.now())}</dd><dt>${s("kvCreated")}</dt><dd class="num">${(t.created_at||"").slice(0,10)}</dd>
            <dt>${s("kvRotated")}</dt><dd class="num">${(t.token_rotated_at||"").slice(0,10)}</dd></dl>
          <sw-button size="sm" variant="danger" icon="trash" @click=${()=>this.confirmDelete=!0}>${s("deleteBoard")}</sw-button>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("bAddress")}</h2></div>
        <div class="link"><code class="ltr">${this.linkUrl(t,"••••••••••••••••••••••••••••••••")}</code></div>
        <p class="hint">${s("linkOnce")} ${s("linkHint")}</p>
        <div class="ctl"><sw-button icon="refresh" @click=${()=>this.confirmRotate={board:t,copy:!1}}>${s("newLink")}</sw-button></div></div>
    </div>`}placeField(t){const e=Xt(this.floors);if(!e.length)return l`<div class="fld"><label for="bg-place">${s("place")}</label><input id="bg-place" class="inp" maxlength="60" .value=${t} @input=${n=>this.setD({place:n.target.value})}></div>`;const i=!!t&&!e.includes(t),o=this.placeOther||i?"__other":t;return l`<div class="fld"><label for="bg-place">${s("place")}</label>
      <select id="bg-place" class="inp" data-place-select data-v=${o} @change=${n=>{const a=n.target.value;this.placeOther=a==="__other",this.placeOther||this.setD({place:a})}}><option value="">-</option>${e.map(n=>l`<option value=${n}>${n}</option>`)}<option value="__other">${s("placeOther")}</option></select>
      ${o==="__other"?l`<input class="inp" data-place-text maxlength="60" aria-label=${s("place")} .value=${t} @input=${n=>this.setD({place:n.target.value})}>`:c}</div>`}setD(t){this.draft&&(this.draft={...this.draft,...t,blocks:{...this.draft.blocks,...t.blocks??{}}},this.dirty=!0,this.pushPreview())}previewSrc(t=!0){const e=encodeURIComponent(this.detail?.board.id??"");return`notice-tv.html?${t?"embed=1&":""}preview=${e}`}frame(){return this.renderRoot.querySelector("iframe[data-preview]")}pushPreview(){this.frame()?.contentWindow?.postMessage({smplwise:"tv",display:this.draft},location.origin)}async cmd(t){if(this.frame()?.contentWindow?.postMessage({smplwise:"tv",cmd:t},location.origin),this.sendToTvs&&this.detail)try{await Kt(this.detail.board.id,t==="toggle"?"pause":t)}catch(e){this.say($(e))}}displayTab(){const t=this.draft,e=[{n:1,t:s("tpl1"),dsc:s("tpl1d")},{n:2,t:s("tpl2"),dsc:s("tpl2d")},{n:3,t:s("tpl3"),dsc:s("tpl3d")}],i=t.layout==="portrait",o=this.s.settings,n=this.detail.notices.filter(a=>a.state==="active");return l`<div class="disp">
      <div class="panel"><div class="hd"><h2>${s("tplCard")}</h2><span class="sp"></span><span class="chip" data-look="acc">${s("tplLive")}</span></div>
        <div class="tpls" data-tpls>${e.map(a=>l`<button class="tpl" data-tpl=${a.n} aria-pressed=${String(t.template===a.n)} @click=${()=>this.setD({template:a.n})}>
          <div class="sch t${a.n}"><i></i><div class="row"><i class="acc"></i><i></i></div><i></i></div><b>${a.t}</b><span>${a.dsc}</span></button>`)}</div>
        <div class="hd"><h2>${s("preview")}</h2><span class="sp"></span><sw-button size="sm" icon="eye" @click=${()=>window.open(this.previewSrc(!1),"_blank","noopener")}>${s("fullScreen")}</sw-button></div>
        <div class="prev ${i?"port":""}"><iframe data-preview title=${s("preview")} src=${this.previewSrc()} @load=${()=>this.pushPreview()}></iframe></div>
        <div class="ctl"><sw-button size="sm" @click=${()=>this.cmd("prev")}>${s("prev")}</sw-button><sw-button size="sm" @click=${()=>this.cmd("toggle")}>${s("pauseToggle")}</sw-button>
          <sw-button size="sm" @click=${()=>this.cmd("next")}>${s("next")}</sw-button><label class="ck"><input type="checkbox" .checked=${this.sendToTvs} @change=${a=>this.sendToTvs=a.target.checked}>${s("sendToTvs")}</label>
          <span class="hint">${s("remoteHint")}</span></div>
        <div class="form">
          <div class="r"><div class="fld"><span class="lbl">${s("theme")}</span><div class="seg" data-theme-seg>${["day","night","auto"].map(a=>l`<button aria-pressed=${String(t.theme===a)} @click=${()=>this.setD({theme:a})}>${s(a==="day"?"themeDay":a==="night"?"themeNight":"themeAuto")}</button>`)}</div></div>
            <div class="fld"><span class="lbl">${s("orient")}</span><div class="seg">${["auto","landscape","portrait"].map(a=>l`<button aria-pressed=${String(t.layout===a)} @click=${()=>this.setD({layout:a})}>${s(a==="auto"?"orAuto":a==="landscape"?"orLand":"orPort")}</button>`)}</div></div></div>
          <div class="r"><div class="fld"><label for="bd-dh">${s("dayHours")}</label><input id="bd-dh" class="inp ltr" placeholder="07:00-19:00" .value=${t.day_hours} @change=${a=>this.setD({day_hours:a.target.value.trim()})}><span class="hint">${s("dayHoursHint")}</span></div>
            <div class="fld"><label for="bd-fs">${s("fontSize")}</label><select id="bd-fs" class="inp" data-v=${t.font_size} @change=${a=>this.setD({font_size:a.target.value})}>
              <option value="s">${s("fsS")}</option><option value="m">${s("fsM")}</option><option value="l">${s("fsL")}</option></select></div></div>
          <div class="fld"><label class="ck"><input type="checkbox" .checked=${t.night.enabled} @change=${a=>this.setD({night:{...t.night,enabled:a.target.checked}})}>${s("nightDim")}</label>
            ${t.night.enabled?l`<div class="sum">${s("nightFrom")}<input class="inp short ltr" type="time" lang=${at()} .value=${t.night.from} @change=${a=>this.setD({night:{...t.night,from:a.target.value}})}>
              ${s("nightTo")}<input class="inp short ltr" type="time" lang=${at()} .value=${t.night.to} @change=${a=>this.setD({night:{...t.night,to:a.target.value}})}>
              ${s("nightLevel")}<select class="inp short" data-v=${String(t.night.dim)} @change=${a=>this.setD({night:{...t.night,dim:Number(a.target.value)}})}>
                ${[.3,.4,.5,.6,.7,.8].map(a=>l`<option value=${String(a)}>${Math.round(a*100)}%</option>`)}</select></div>`:c}</div>
          <div class="chips"><label class="ck"><input type="checkbox" .checked=${t.burn_in.shift} @change=${a=>this.setD({burn_in:{shift:a.target.checked}})}>${s("burnIn")}</label>
            <label class="ck"><input type="checkbox" .checked=${t.blocks.company_logo} @change=${a=>this.setD({blocks:{...t.blocks,company_logo:a.target.checked}})}>${s("companyLogo")}</label>
            <label class="ck"><input type="checkbox" checked disabled>${s("smplwiseLogo")}</label></div>
          <notice-display-design .display=${t} .defaults=${this.tv2Defaults()} @display-change=${a=>this.setD(a.detail)}></notice-display-design>
          <notice-display-layout .display=${t} .defaults=${this.tvDefaults()} @display-change=${a=>this.setD(a.detail)}></notice-display-layout>
          <notice-display-saver .display=${pt(t,this.tvDefaults())} @display-change=${a=>this.setD(a.detail)}></notice-display-saver>
        </div></div>
      <div class="panel"><div class="hd"><h2>${s("whatShown")}</h2><span class="sp"></span><sw-button size="sm" variant="primary" data-save-display ?disabled=${!this.dirty} @click=${()=>this.saveAll()}>${s("save")}</sw-button></div>
        <div class="blocks">
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.clock} @change=${a=>this.setD({blocks:{...t.blocks,clock:a.target.checked}})}>${s("blkClock")}</label>
            <div class="sub"><label class="ck"><input type="checkbox" .checked=${t.blocks.hebdate} @change=${a=>this.setD({blocks:{...t.blocks,hebdate:a.target.checked}})}>${s("blkHebdate")}</label>
              <label class="ck"><input type="checkbox" .checked=${t.blocks.welcome} @change=${a=>this.setD({blocks:{...t.blocks,welcome:a.target.checked}})}>${s("blkWelcome")}</label></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.weather} @change=${a=>this.setD({blocks:{...t.blocks,weather:a.target.checked}})}>${s("blkWeather")}</label>
            <div class="sub">${o.weather_entity?l`<span class="ltr mut">${o.weather_entity}</span>`:l`<span class="mut">${s("blkWeatherNoEntity")}</span>`}
              <span>${s("hoursAhead")}</span><select class="inp short" data-v=${String(t.weather.hours)} @change=${a=>this.setD({weather:{hours:Number(a.target.value)}})}>${[3,5,8].map(a=>l`<option value=${String(a)}>${a}</option>`)}</select></div></div>
          <div class="blk"><label class="ck"><input type="checkbox" .checked=${t.blocks.news} @change=${a=>this.setD({blocks:{...t.blocks,news:a.target.checked}})}>${s("blkNews")}</label>
            <div class="sub">${t.news.feeds.map((a,r)=>{const b=Zs(a,o.news_sources);return l`<div class="feed" data-feed=${a.url}>${b.logo?l`<img class="flg" alt="" src=${b.logo}>`:l`<sw-icon name="link" size="12"></sw-icon>`}<b>${Qs(b.name)}</b>${b.known?c:l`<span class="chip">${s("nsCustomTag")}</span>`}
                <sw-button size="sm" variant="ghost" @click=${()=>this.setD({news:{...t.news,feeds:t.news.feeds.filter((d,h)=>h!==r)}})}>${s("remove")}</sw-button></div>`})}
              <select class="inp short" data-v=${this.feedPick} @change=${a=>this.feedPick=a.target.value}><option value="">${s("feedPick")}</option>
                ${o.news_sources.filter(a=>a.enabled!==!1).map(a=>l`<option value=${a.url}>${a.name}${a.custom?" · "+s("nsCustomTag"):""}</option>`)}${o.news_custom?l`<option value="custom">${s("feedCustom")}</option>`:c}</select>
              ${this.feedPick==="custom"?l`<input class="inp ltr" placeholder="https://" .value=${this.feedUrl} @input=${a=>this.feedUrl=a.target.value}>`:c}
              <sw-button size="sm" icon="plus" ?disabled=${!this.feedPick||t.news.feeds.length>=6} @click=${()=>this.addFeed()}>${s("add")}</sw-button>
              <span>${s("speed")}</span><div class="seg">${["slow","normal","fast"].map(a=>l`<button aria-pressed=${String(t.news.speed===a)} @click=${()=>this.setD({news:{...t.news,speed:a}})}>${s(a==="slow"?"spSlow":a==="normal"?"spNormal":"spFast")}</button>`)}</div></div></div>
          <notice-display-info .value=${t.blocks.info} .show=${t.blocks.info_show!==!1} @info-show-change=${a=>this.setD({blocks:{...t.blocks,info_show:a.detail}})} @info-change=${a=>this.setD({blocks:{...t.blocks,info:a.detail}})}></notice-display-info>
          <div class="blk"><span class="ck"><b>${s("blkNotices")}</b></span><span class="hint">${n.length} ${s("kpiActive")}</span>
            <div class="sub"><span>${s("mode")}</span><div class="seg" data-mode-seg>${["rotation","all","focus"].map(a=>l`<button aria-pressed=${String(t.mode===a)} data-mode=${a} @click=${()=>this.setD({mode:a})}>${s(a==="rotation"?"modeRotation":a==="all"?"modeAll":"modeFocus")}</button>`)}</div></div>
            <div class="sub"><span>${s("rotateEvery")}</span><input class="inp short num" type="number" min="6" max="60" step="1" data-rot .value=${String(t.rotate_s)}
              @change=${a=>this.setD({rotate_s:Math.max(6,Math.min(60,Math.round(Number(a.target.value)||12)))})}><span>${s("seconds")}</span><span class="hint">${s("rotateHint")}</span></div>
            <div class="sub"><span>${s("urgent")}</span><select class="inp" data-urg data-v=${t.urgent==="band"?"stage":t.urgent} @change=${a=>this.setD({urgent:a.target.value})}>
              <option value="stage">${s("urgStage")}</option><option value="stay">${s("urgStay")}</option><option value="full">${s("urgFull")}</option></select></div>
            <div class="sub"><span>${s("hold")}</span><select class="inp" data-hold data-v=${t.hold} @change=${a=>this.setD({hold:a.target.value})}>
              <option value="">${s("holdNone")}</option>${n.map(a=>l`<option value=${a.id}>${a.title}</option>`)}</select><span class="hint">${s("holdHint")}</span></div>
            <p class="hint">${s("dwellNote")}</p></div>
          <notice-display-transit .display=${t} .v2Layout=${(a=>a.design==="v2"?a.board_layout:null)(K(t,this.tv2Defaults()))} @display-change=${a=>this.setD(a.detail)}></notice-display-transit>
          <notice-display-slides .display=${t} .lux=${["gallery","concierge","stone"].includes(K(t,this.tv2Defaults()).design)} .boardId=${this.detail.board.id} .boards=${this.boards} @display-change=${a=>this.setD(a.detail)} @slides-changed=${()=>this.pushPreview()}></notice-display-slides>
        </div></div>
    </div>`}addFeed(){const t=this.draft;if(!t)return;const e=this.feedPick,i=this.s.settings.news_sources.find(n=>n.url===e),o=i?{id:i.id,name:i.name,url:i.url}:e==="custom"&&this.feedUrl.startsWith("https://")?{name:new URL(this.feedUrl).hostname,url:this.feedUrl}:null;!o||t.news.feeds.some(n=>n.url===o.url)||(this.setD({news:{...t.news,feeds:[...t.news.feeds,o]},blocks:{...t.blocks,news:!0}}),this.feedPick="",this.feedUrl="")}noticesTab(){const t=this.detail,e=new Set(t.notices.map(a=>a.id)),i=this.notices.filter(a=>!e.has(a.id)&&(a.state==="active"||a.state==="scheduled"||a.state==="draft")),o=!!this.s?.can.manage,n=a=>o&&this.notices.some(r=>r.id===a&&r.state!=="archived"&&r.state!=="expired");return l`<div class="panel flush">
      <div class="toolbar"><h2>${s("boardNotices")}</h2><span class="chip num">${t.notices.filter(a=>a.state==="active").length} ${s("kpiActive")}</span><span class="sp"></span>
        ${i.length?l`<select class="inp short" data-add-notice @change=${a=>this.addItem(a.target.value)}><option value="">${s("addToBoard")}…</option>
          ${i.map(a=>l`<option value=${a.id}>${a.title}</option>`)}</select>`:c}
        ${o?l`<sw-button variant="primary" icon="plus" data-board-compose @click=${()=>this.newNotice(t.board.id)}>${s("newForBoard")}</sw-button>`:c}</div>
      ${t.notices.length?l`<table class="t"><thead><tr><th>${s("colState")}</th><th>${s("colNotice")}</th><th>${s("colWindow")}</th><th></th></tr></thead><tbody>
        ${t.notices.map(a=>l`<tr data-look=${a.state==="active"?it[a.severity]:"off"} data-board-notice=${a.id}><td><span class="badge" data-look=${a.state==="active"?it[a.severity]:"off"}>${s(Jt[a.severity])}${a.pinned?" · "+s("pinned"):""}</span></td>
          <td><span class="t1">${a.title}</span></td><td class="num mut">${Zt(a)}</td>
          <td class="act">${n(a.id)?l`<sw-button size="sm" data-edit-notice @click=${()=>this.editNotice(a.id)}>${s("edit")}</sw-button>`:c}
            <sw-button size="sm" @click=${()=>this.removeItem(a.id)}>${s("removeFromBoard")}</sw-button></td></tr>`)}</tbody></table>`:l`<sw-state-panel icon="inbox" state="empty" heading=${s("boardEmpty")}
            actionLabel=${o?s("newForBoard"):""} @action=${()=>this.newNotice(t.board.id)}></sw-state-panel>`}
    </div>`}async addItem(t){!t||!this.detail||await this.setItems([...this.detail.notices.map(e=>e.id),t])}async removeItem(t){this.detail&&await this.setItems(this.detail.notices.map(e=>e.id).filter(e=>e!==t))}async setItems(t){try{await Qt(this.detail.board.id,t),this.detail=await M(this.detail.board.id),this.say(s("saved"))}catch(e){this.say($(e))}}async saveBoard(t){if(this.detail)try{const e=await et(this.detail.board.id,t);this.detail={...this.detail,board:e.board},this.draft=structuredClone(e.board.display??this.draft),this.dirty=!1,this.say(s("saved")),this.loadBoards()}catch(e){this.say($(e))}}async saveAll(){const t={};this.draft&&this.dirty&&(t.display=this.draft),this.detail&&this.nameDraft.trim()&&this.nameDraft!==this.detail.board.name&&(t.name=this.nameDraft.trim()),await this.saveBoard(t)}async rotate(t,e){try{const i=await ts(t.id);this.link={board:i.board,token:i.token,rotated:!0},this.detail?.board.id===i.board.id&&(this.detail={...this.detail,board:i.board}),this.loadBoards(),e&&navigator.clipboard?.writeText(this.linkUrl(i.board,i.token)).then(()=>this.say(s("copied")),()=>{})}catch(i){this.say($(i))}}rotateDialog(){const t=this.confirmRotate;return l`<sw-dialog ?open=${!!t} heading=${t?s("copyAsk",{name:t.board.name}):""} @close=${()=>this.confirmRotate=null} data-rotate-confirm>
      <p>${s("copyAskBody")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmRotate=null}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-rotate-go @click=${()=>{const e=this.confirmRotate;this.confirmRotate=null,e&&this.rotate(e.board,e.copy)}}>${s("copyAsk2")}</sw-button></sw-dialog>`}deleteDialog(){return l`<sw-dialog ?open=${this.confirmDelete} heading=${s("deleteBoard")} @close=${()=>this.confirmDelete=!1}>
      <p>${s("deleteBoardQ")}</p>
      <sw-button slot="footer" @click=${()=>this.confirmDelete=!1}>${s("cancel")}</sw-button>
      <sw-button slot="footer" variant="danger" @click=${()=>this.removeBoard()}>${s("deleteBoard")}</sw-button></sw-dialog>`}async removeBoard(){if(this.detail)try{await ss(this.detail.board.id),this.confirmDelete=!1,location.hash=Y,await this.loadBoards()}catch(t){this.say($(t))}}};v.styles=[es,_,C`
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
    `];g([m()],v.prototype,"boardId",2);g([p()],v.prototype,"s",2);g([p()],v.prototype,"boards",2);g([p()],v.prototype,"error",2);g([p()],v.prototype,"forbidden",2);g([p()],v.prototype,"toast",2);g([p()],v.prototype,"creating",2);g([p()],v.prototype,"link",2);g([p()],v.prototype,"detail",2);g([p()],v.prototype,"tab",2);g([p()],v.prototype,"draft",2);g([p()],v.prototype,"dirty",2);g([p()],v.prototype,"nameDraft",2);g([p()],v.prototype,"notices",2);g([p()],v.prototype,"feedPick",2);g([p()],v.prototype,"feedUrl",2);g([p()],v.prototype,"confirmDelete",2);g([p()],v.prototype,"confirmRotate",2);g([p()],v.prototype,"placeOther",2);g([p()],v.prototype,"sendToTvs",2);g([p()],v.prototype,"compose",2);g([p()],v.prototype,"floors",2);g([p()],v.prototype,"groups",2);g([p()],v.prototype,"roles",2);v=g([k("system-notices")],v);export{v as SystemNotices};
//# sourceMappingURL=system-notices-D0Zt2EO_.js.map
