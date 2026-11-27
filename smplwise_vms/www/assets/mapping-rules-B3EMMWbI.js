import{g$ as f,A as m,b as l,h0 as b}from"./index-DlIoBDHe.js";import{RULE_LABEL as g,POS_TEXT as k,MappingAssistant as w}from"./mapping-assistant-Iaw0CsVe.js";import{t}from"./media-BC_Yw4Md.js";import"./sw-logo-art-PLtEZJxU.js";import"./mb-safety-BQnx-yNL.js";import"./system-diagnostics-buildings-BNfC29ci.js";import"./live-CSFbdBCB.js";import"./editor-guards-CEHbVbIV.js";import"./memo-CyxK7byc.js";function R(n){const u=n.model(),i=n.st,c=f(n.data.mapItems,i,n.refs),o=i.rules,r=(a,s)=>n.setState({...i,rules:o.map((e,d)=>d===a?{...e,...s}:e)},!0),p=(a,s)=>n.setState({...i,rules:b(o,a,s)},!0),v=a=>l`${a.kind==="regex"?l`<option value="" ?selected=${!a.to}>${t("הקבוצה הראשונה, לפי הטבלה")}</option>`:a.to?m:l`<option value="" selected>${t("בחרו בניין")}</option>`}
    ${n.data.buildings.map(s=>l`<option value=${`b:${s.id}`} ?selected=${a.to?.t==="b"&&a.to.id===s.id}>${s.name}</option>`)}
    <option value="none" ?selected=${a.to?.t==="none"}>${t("לא משויך")}</option>`,$=u.sum.unassigned;return l`<div class="panel" style="flex:1 1 auto" data-ma-rules><h3><sw-icon name="filter" size=${16}></sw-icon>${t("מתקדם · הכללים, במשפטים")}<span class="sp"></span><span class="ct">${t("גרירה = מה נבדק קודם · אפשר לערבב סוגים")}</span></h3>
    <div class="scroll rules">
      ${o.map((a,s)=>l`<div class="sr ${a.on?"":"off"} ${n.dragRule>=0&&n.dragRule!==s?"dropzone":""}" data-ma-rule=${a.id} data-ma-rule-kind-now=${a.kind}
          @dragover=${e=>{n.dragRule>=0&&e.preventDefault()}} @drop=${e=>{e.preventDefault(),n.dragRule>=0&&p(n.dragRule,s),n.dragRule=-1}}>
        <button class="grip" draggable="true" data-ma-rule-grip aria-label=${t("כלל {n}: גרירה או חיצים משנים את הסדר",{n:s+1})} @dragstart=${e=>{n.dragRule=s,e.dataTransfer?.setData("text/plain",a.id)}} @dragend=${()=>n.dragRule=-1}
          @keydown=${e=>{e.key==="ArrowUp"&&s>0&&(e.preventDefault(),p(s,s-1)),e.key==="ArrowDown"&&s<o.length-1&&(e.preventDefault(),p(s,s+1))}}><sw-icon name="grip" size=${16}></sw-icon></button>
        <span class="n">${s+1}</span>
        <span class="sent">
          <select aria-label=${t("סוג הכלל")} data-ma-rule-kind @change=${e=>r(s,{kind:e.target.value})}>${Object.keys(g).map(e=>l`<option value=${e} ?selected=${a.kind===e}>${g[e]}</option>`)}</select>
          ${a.kind==="table"?l`<span class="k">${t("{title}, {length} סימונים",{title:k[i.spec.position].title,length:u.rows.length})}</span>`:l`<input class="tx" data-ma-rule-value aria-label=${t("הערך")} maxlength="80" .value=${a.value} placeholder=${a.kind==="regex"?"^B(\\d)-":t("למשל חניון")} @input=${e=>r(s,{value:e.target.value})} />`}
        </span>
        ${a.kind==="table"?l`<span class="to k">${t("← לפי הטבלה")}</span>`:l`<select class="to" aria-label=${t("לאיזה בניין")} data-ma-rule-to @change=${e=>r(s,{to:n.parseTarget(e.target.value)})}>${v(a)}</select>`}
        <span class="cnt" data-ma-rule-count>${t("{floors} קומות, {areas} אזורים",{floors:c[a.id]?.floors??0,areas:c[a.id]?.areas??0})}</span>
        <span class="acts"><button class="ib" aria-label=${a.on?t("השבת את הכלל"):t("הפעל את הכלל")} title=${a.on?t("השבת"):t("הפעל")} aria-pressed=${String(a.on)} @click=${()=>r(s,{on:!a.on})}><sw-icon name=${a.on?"eye":"minus"} size=${16}></sw-icon></button>
          ${a.kind==="table"&&o.filter(e=>e.kind==="table").length===1?m:l`<button class="ib" aria-label=${t("מחק את הכלל")} data-ma-rule-delete @click=${()=>n.setState({...i,rules:o.filter((e,d)=>d!==s)},!0)}><sw-icon name="trash" size=${16}></sw-icon></button>`}</span>
      </div>`)}
      <div class="sr def"><span></span><span class="n">∅</span><span class="sent"><span class="k">${t("כל שם אחר")}</span></span><span class="to k">${t("← שאלה / לא משויך")}</span><span class="cnt">${t("{floors} קומות, {areas} אזורים",{floors:$.floors,areas:$.areas})}</span><span></span></div>
      <div class="add"><sw-button size="sm" variant="ghost" icon="plus" data-ma-rule-add
        @click=${()=>n.setState({...i,rules:[...o,{id:`r${Date.now().toString(36)}${o.length}`,kind:"contains",value:"",to:null,on:!0}]})}>${t("הוסף כלל")}</sw-button>
        <span>${t("מתחיל ב- / מסתיים ב- / מכיל / התווית היא / ביטוי רגולרי. הכלל הראשון שמתאים ויש לו בניין קובע.")}</span></div>
    </div></div>`}w.rulesView=R;export{R as renderRules};
