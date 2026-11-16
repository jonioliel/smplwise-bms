import{p as i,X as r,q as n}from"./index-Cif9Bwbo.js";import{p,a as t,O as l,b as d,c as $}from"./org-locations-text-C2FWtssV.js";function f(e){const c=p(e.ans),o=a=>n`<label class="fld">${a}<input class="inp" data-location-other ?data-rfq-place=${!!e.rfqPlaceAttr} maxlength=${$} placeholder=${t("otherPh")}
    ?disabled=${e.disabled} .value=${e.other} @input=${s=>e.onOther(s.target.value)} />${e.error??i}</label>`;return c.length?n`<label class="fld">${t("fLocation")}<select class="inp" data-location-pick ?disabled=${e.disabled}
      @change=${a=>e.onPick(a.target.value)}>
      <option value="" ?selected=${e.pick===""}>${t("pickNone")}</option>
      ${c.map(a=>n`<option value=${a.id} ?selected=${e.pick===a.id}>${r([a.name,d(a)].filter(Boolean).join(" – "))}</option>`)}
      <option value=${l} ?selected=${e.pick===l}>${t("pickOther")}</option>
    </select>${e.pick!==l?e.error??i:i}</label>
    ${e.pick===l?o(t("otherLabel")):i}`:o(e.label??t("fLocation"))}export{f as l};
//# sourceMappingURL=location-picker-BSb4ZvaZ.js.map
