import{t as d,e as a,A as c,E as b}from"./index-BGBybS0o.js";import{l as n}from"./list-text-BLkKI2Hp.js";function u(i,e,t,o=""){return a`<button type="button" class=${`btn sm filterbtn${i?" on":""}`} aria-expanded=${String(i)} aria-controls="filter-panel" aria-haspopup="dialog"
    aria-label=${e?n("lfBtnCount",{n:e}):n("lfBtn")} data-filter-toggle ?data-filter-btn=${o==="board"} @click=${t}>${d("filter")}<span class="lbl">${n("lfBtn")}</span>${e?a`<span class="n" aria-hidden="true">${e}</span>`:c}</button>`}function v(i,e){return i.length?a`<div class="achips" role="group" aria-label=${n("tbChips")} data-active-chips>
    ${i.map(t=>a`<button type="button" class="achip" data-active-chip=${t.key} data-assignee-filter=${t.attrs?.["data-assignee-filter"]??c}
      aria-label=${t.attrs?.["aria-label"]??n("tbRemove",{name:t.label})} @click=${t.remove}><span class="t">${t.label}</span>${d("x")}</button>`)}
    ${i.length>1?a`<button type="button" class="areset" data-chips-reset aria-label=${n("tbResetLabel")} @click=${e}>${n("tbReset")}</button>`:c}
  </div>`:c}function m(i,e,t=""){return a`<section class="fsect" data-panel-section=${t||c}><h2 class="fl">${i}</h2>${e}</section>`}function g(i,e,t,o){return a`<div class="fpop" id="filter-panel" role="dialog" aria-label=${n("tbPanel")} data-filter-panel>
    ${i}
    <div class="ffoot">
      <button type="button" class="btn sm" data-f-reset data-f-clear ?disabled=${!e} @click=${t}>${d("x")}${n("tbResetLabel")}</button>
      <span class="grow"></span>
      <button type="button" class="btn sm" data-f-close @click=${o}>${n("tbClose")}</button>
    </div>
  </div>`}class w{constructor(e,t,o){this.host=e,this.isOpen=t,this.setOpen=o,this.wasOpen=!1,this.onKey=l=>{if(l.key!=="Escape"||!this.isOpen())return;const r=l.composedPath(),p=this.panel(),s=this.toggle();(p&&r.includes(p)||s&&r.includes(s))&&(l.stopPropagation(),this.setOpen(!1),s?.focus())},this.onOutside=l=>{if(!this.isOpen())return;const r=l.composedPath(),p=this.panel(),s=this.toggle();p&&r.includes(p)||s&&r.includes(s)||r.some(f=>f instanceof HTMLOptionElement)||this.setOpen(!1)},e.addController(this)}hostConnected(){window.addEventListener("pointerdown",this.onOutside,!0),this.host.addEventListener("keydown",this.onKey)}hostDisconnected(){window.removeEventListener("pointerdown",this.onOutside,!0),this.host.removeEventListener("keydown",this.onKey)}hostUpdated(){const e=this.isOpen();e&&this.placeSheet(),e&&!this.wasOpen&&this.panel()?.querySelector("button:not([disabled]), select, input")?.focus({preventScroll:!0}),this.wasOpen=e}placeSheet(){const e=this.panel(),t=this.toggle();if(!e||!t||getComputedStyle(e).position!=="fixed")return;const o=t.closest("[data-toolbar], .tb")??t;e.style.setProperty("--fpop-top",`${Math.ceil(o.getBoundingClientRect().bottom+8)}px`)}root(){return this.host.shadowRoot}panel(){return this.root()?.querySelector("[data-filter-panel]")??null}toggle(){return this.root()?.querySelector("[data-filter-toggle]")??null}}const k=b`
  .dh-det.tb {
    flex-wrap: nowrap;
    gap: 10px;
    min-inline-size: 0;
    position: relative;
  }
  .tb .search {
    flex: 1 1 220px;
    min-inline-size: 160px;
    max-inline-size: 340px;
  }
  .tb > .seg {
    flex: none;
  }
  .dh-row .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: none;
    margin-inline-start: auto;
  }
  .fanchor {
    position: relative;
    flex: none;
  }
  /* "סינון": a neutral button whose active count is a small accent badge; pressed (open) = the control's pressed look */
  .filterbtn .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 20px;
    block-size: 20px;
    padding-inline: 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .filterbtn.on {
    background: var(--dv-surface-3);
    border-color: var(--dv-border-strong);
  }
  /* the active-filter chips: soft accent, the remove mark inside the chip, one quiet reset */
  .achips {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }
  .achip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-inline-size: 220px;
    min-block-size: 32px;
    padding-inline: 12px 8px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .achip .t {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .achip .ic {
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    opacity: 0.75;
  }
  .achip:active {
    transform: scale(0.97);
  }
  .areset {
    flex: none;
    min-block-size: 32px;
    padding-inline: 8px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--sw-r-md);
  }
  @media (hover: hover) and (pointer: fine) {
    .achip:hover {
      border-color: color-mix(in srgb, var(--dv-accent) 40%, transparent);
    }
    .areset:hover {
      color: var(--dv-text);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
  .achip:focus-visible,
  .areset:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  /* the panel: opaque, anchored under its button, enters from just above (transform + opacity; zero under reduced motion) */
  .fpop {
    position: absolute;
    inset-block-start: calc(100% + 8px);
    inset-inline-start: 0;
    z-index: 30;
    inline-size: min(560px, calc(100vw - 48px));
    max-block-size: min(70dvh, 560px);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    box-shadow: var(--dv-shadow-2);
    color: var(--dv-text);
    transform-origin: top;
    transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  @starting-style {
    .fpop {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  .fsect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .fsect .fl {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .fchips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fchips .rc {
    block-size: auto;
    min-block-size: 36px;
    padding-inline: 14px;
    font-size: var(--sw-fs-base);
  }
  .fchips .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* a single-choice group (the state) reads as the same chips; the chosen one takes the pressed look */
  .fchips .rc[aria-checked='true'] {
    background: var(--dv-text);
    border-color: transparent;
    color: var(--mm-text-inverse);
    font-weight: 600;
    box-shadow: var(--dv-shadow-control);
  }
  .fchips .rc[aria-pressed='true'] small,
  .fchips .rc[aria-checked='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  .fpop .frow {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  /* inside the panel the old filter row is a plain stack, not a bubble: no rounded corner for the guard to find text in */
  .fpop .frow {
    border-radius: 0;
  }
  .fpop .frow select {
    inline-size: min(100%, 280px);
    max-inline-size: none;
    min-block-size: 36px;
  }
  .fpop ticket-board-tree {
    max-block-size: 280px;
    overflow-y: auto;
  }
  .ffoot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--dv-border);
  }
  .ffoot .grow {
    flex: 1;
  }
  @media (max-width: 1279px) {
    /* the label of the active view hides first: the icons keep their names in aria-label and title */
    .dh-row .vsw button .lbl {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .dh-det.tb {
      flex-wrap: wrap;
      gap: 8px;
    }
    .tb > .seg {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      border-radius: var(--sw-r-xl);
    }
    .tb > .seg button {
      min-block-size: 44px;
      padding-inline: 6px;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tb .search {
      order: 1;
      flex: 1 1 0;
      min-inline-size: 0;
      max-inline-size: none;
    }
    .tb .fanchor {
      order: 1;
      position: static;
    }
    .tb .filterbtn {
      min-block-size: 44px;
    }
    .tb .filterbtn .lbl {
      display: none;
    }
    .tb .achips {
      order: 2;
      inline-size: 100%;
      flex-wrap: wrap;
      overflow: visible;
    }
    .achip,
    .areset {
      min-block-size: 44px;
    }
    /* on a phone the panel is a bottom sheet over the page, just above the dock (a panel in the sticky header could not scroll and folded
       away with the compacting header); it rises 8 px into place */
    .fpop {
      position: fixed;
      inset-block: auto var(--sw-bottomnav-h);
      inset-inline: 0;
      inline-size: auto;
      /* the sheet stops under the toolbar (--fpop-top, measured by FilterPanelController): the scope, "סינון" and the active chips stay
         reachable while it is open (a sheet over the toolbar swallowed their taps) */
      max-block-size: max(160px, calc(100dvh - var(--sw-bottomnav-h) - var(--fpop-top, 96px)));
      padding: 18px 16px 14px;
      border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
      border-block-end: 0;
      z-index: 60;
      transform-origin: bottom;
    }
    @starting-style {
      .fpop {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    .fchips .rc,
    .fpop .frow select {
      min-block-size: 44px;
    }
    .dh-row .pact .newbtn .lbl {
      display: none;
    }
    .dh-row .pact .newbtn {
      min-inline-size: 44px;
      min-block-size: 44px;
      justify-content: center;
    }
  }
`;export{w as F,u as a,v as b,g as f,m as p,k as t};
//# sourceMappingURL=list-toolbar-DBB6rNaX.js.map
