const d={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},o=e=>e.replace(/[&<>"']/g,t=>d[t]),s=`
@page { margin: 14mm; }
body { font: 12px/1.45 "Heebo", "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 18px; margin: 0 0 2px; }
p.sub { margin: 0 0 10px; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: start; vertical-align: top; }
th { background: #eee; }
tr { break-inside: avoid; }
td.t { white-space: nowrap; }
footer { margin-top: 10px; color: #555; font-size: 11px; }
`;function c(e){const t=e.lang==="he"?"rtl":"ltr",n=e.columns.map(i=>`<th>${o(i)}</th>`).join(""),r=e.rows.map(i=>`<tr>${i.map(a=>`<td>${o(a)}</td>`).join("")}</tr>`).join("");return`<!doctype html><html lang="${e.lang}" dir="${t}"><head><meta charset="utf-8"><title>${o(e.title)}</title></head><body><h1>${o(e.title)}</h1><p class="sub">${o(e.subtitle)}</p><table><thead><tr>${n}</tr></thead><tbody>${r}</tbody></table><footer>${o(e.footer)}</footer></body></html>`}function l(e){try{const t=e;if(!t||!("adoptedStyleSheets"in t.document))return;const n=new t.CSSStyleSheet;n.replaceSync(s),t.document.adoptedStyleSheets=[n]}catch{}}function p(e){if(typeof document>"u")return!1;const t=document.createElement("iframe");t.setAttribute("aria-hidden","true"),t.setAttribute("tabindex","-1"),t.setAttribute("data-sw-print",""),t.style.cssText="position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:0;block-size:0;border:0;visibility:hidden";const n=()=>window.setTimeout(()=>t.remove(),1500);return t.addEventListener("load",()=>{try{l(t.contentWindow),t.contentWindow?.focus(),t.contentWindow?.print()}finally{n()}}),t.srcdoc=e,document.body.appendChild(t),!0}export{p as a,c as p};
//# sourceMappingURL=events-print-BofHdYv3.js.map
