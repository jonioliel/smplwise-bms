import{A as i,a6 as s,b as c}from"./index-DkcUEx2W.js";import{p,a as t,O as l,b as d,c as $}from"./org-locations-text-DhjL0rIa.js";function f(e){const n=p(e.ans),o=a=>c`<label class="fld">${a}<input class="inp" data-location-other ?data-rfq-place=${!!e.rfqPlaceAttr} maxlength=${$} placeholder=${t("otherPh")}
    ?disabled=${e.disabled} .value=${e.other} @input=${r=>e.onOther(r.target.value)} />${e.error??i}</label>`;return n.length?c`<label class="fld">${t("fLocation")}<select class="inp" data-location-pick ?disabled=${e.disabled}
      @change=${a=>e.onPick(a.target.value)}>
      <option value="" ?selected=${e.pick===""}>${t("pickNone")}</option>
      ${n.map(a=>c`<option value=${a.id} ?selected=${e.pick===a.id}>${s([a.name,d(a)].filter(Boolean).join(" – "))}</option>`)}
      <option value=${l} ?selected=${e.pick===l}>${t("pickOther")}</option>
    </select>${e.pick!==l?e.error??i:i}</label>
    ${e.pick===l?o(t("otherLabel")):i}`:o(e.label??t("fLocation"))}export{f as l};
