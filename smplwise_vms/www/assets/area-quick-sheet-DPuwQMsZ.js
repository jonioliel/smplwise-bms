import{kH as P,kI as se,kJ as D,cA as ie,g as ae,i as ne,kK as oe,co as re,kL as le,bL as de,bM as ce,kM as S,kN as pe,kO as he,kP as L,kQ as M,kR as H,bS as ue,eB as fe,kS as me,kT as we,kU as ge,bP as B,a2 as $,aN as ve,kV as be,a3 as q,kW as xe,kX as ye,d7 as n,kY as N,kZ as U,k_ as ke,k$ as $e,l0 as qe,aA as F,l1 as Se,l2 as ze,a as K,A as c,bd as z,cv as x,b as r,l3 as _e,l4 as Ee,l5 as Te,l6 as Ae,ar as _,l7 as Re,a6 as y,l8 as C,aS as Y,ct as O,l9 as G,cu as Ce,la as W,ax as b,j as m,lb as j,lc as Q,dR as Oe,k as Ie}from"./index-kipM9krC.js";import{l as Pe,E as De}from"./events-D41ouKKE.js";import"./sw-logo-art-PLtEZJxU.js";const V=se;function Le(e,t){return(t?e.areas[t]:void 0)??e.site??D}function A(e,t,i){if(!i.length)return[...e];const s=new Map(i.map((o,l)=>[o,l]));return[...e.filter(o=>s.has(t(o))).sort((o,l)=>s.get(t(o))-s.get(t(l))),...e.filter(o=>!s.has(t(o)))]}const Me=["smoke","gas","carbon_monoxide","moisture","tamper","problem","safety","heat","vibration","door","window","opening","garage_door"];function J(e){return e.domain==="binary_sensor"&&e.available&&e.active&&!!e.device_class&&Me.includes(e.device_class)}function He(e){const t=(e.entity_id.split(".")[1]??e.entity_id).toLowerCase(),i=(e.name??"").trim().toLowerCase(),s=/^(input|inp)[ _-]?\d+$/;return s.test(i)||s.test(t)||/(^|_)input_?\d+(_|$)/.test(t)||i==="idle"||/(^|_)idle($|_)/.test(t)}function E(e,t,i,s){const a=i.items[t],o=A(e,v=>v.entity_id,a?.order??[]),l=new Set;return!a||!a.hidden.length?{rows:o,revealed:l}:{rows:o.filter(v=>a.hidden.includes(v.entity_id)?t==="sensors"&&s&&J(v)?(l.add(v.entity_id),!0):!1:!0),revealed:l}}function Be(e,t,i){return A(e,s=>s,t.sections).filter(s=>!t.hidden.includes(s)||s==="sensors"&&i)}function Ne(e,t){return A(e,i=>i,t.sections).map(i=>({id:i,hidden:t.hidden.includes(i)}))}function T(e,t,i){const s=i.items[t];return A(e,a=>a.entity_id,s?.order??[]).map(a=>({row:a,hidden:!!s?.hidden.includes(a.entity_id)}))}function Ue(e,t,i){if(t<0||t>=e.length||i<0||i>=e.length||t===i)return[...e];const s=[...e],[a]=s.splice(t,1);return s.splice(i,0,a),s}const Z=(e,t)=>e.includes(t)?e.filter(i=>i!==t):[...e,t];function Fe(e,t){return{...e,hidden:Z(e.hidden,t)}}function Ke(e,t){return{...e,sections:[...t]}}function Ye(e,t,i,s){const a=e.items[t]??{order:[],hidden:[]};return{...e,items:{...e.items,[t]:{order:a.order.length?a.order:[...s],hidden:Z(a.hidden,i)}}}}function Ge(e,t,i){const s=e.items[t]??{hidden:[]};return{...e,items:{...e.items,[t]:{order:[...i],hidden:s.hidden}}}}function We(e,t){const i={};for(const o of P){const l=e.items[o];l&&(l.hidden.length||l.order.length)&&(i[o]={order:[...l.order],hidden:[...l.hidden]})}const a={sections:t.every((o,l)=>l===0||V.indexOf(t[l-1])<=V.indexOf(o))?[]:[...t],hidden:e.hidden.filter(o=>t.includes(o)),items:i};return!a.sections.length&&!a.hidden.length&&!Object.keys(i).length?null:a}function je(e){return e.length>0&&e.every(t=>t.hidden)}function Qe(e,t){return e.items[t]?.hidden.length??0}const Ve=[ie,ae`
      :host {
        display: contents;
        --qc-spring: linear(0, 0.4, 0.75, 0.92, 1);
        --qc-spring-flick: var(--qc-spring);
        --qc-open-ms: 576ms;
        --qc-close-ms: 180ms;
        --qc-w: 480px;
        --qc-w-wide: min(900px, calc(100vw - 48px));
        --qc-pop-w: 620px;
        --qc-pop-w-wide: min(1040px, calc(100vw - 48px));
      }
      .scrim {
        position: fixed;
        inset: 0;
        z-index: var(--sw-z-modal);
        background: var(--sw-overlay);
        -webkit-backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        backdrop-filter: var(--sw-backdrop-blur); /* taste-skill-ignore: the skin contract's scrim blur, none by default */
        opacity: 0;
        pointer-events: none;
        transition: opacity var(--qc-close-ms) var(--sw-ease-out);
      }
      :host([open]) .scrim {
        opacity: 1;
        pointer-events: auto;
        transition: opacity 240ms var(--sw-ease);
      }
      .panel {
        position: fixed;
        z-index: calc(var(--sw-z-modal) + 1);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        color: var(--sw-text);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the floating dialog's edge over a dark page */
        box-shadow: inset 0 1px 0 var(--sw-highlight), var(--sw-shadow-3); /* taste-skill-ignore: a real overlay (dialog) floats */
        isolation: isolate;
        overflow: hidden;
        visibility: hidden;
        will-change: transform;
        transition: transform var(--qc-close-ms) var(--sw-ease-out), opacity var(--qc-close-ms) var(--sw-ease-out), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s linear var(--qc-close-ms);
      }
      :host([open]) .panel {
        visibility: visible;
        transition: transform var(--qc-open-ms) var(--qc-spring), opacity 200ms var(--sw-ease-dialog), inline-size var(--qc-open-ms) var(--qc-spring), visibility 0s;
      }
      /* ---- drawer: the inline start (right in Hebrew) ---- */
      :host([mode='drawer']) .panel {
        inset-block: 0;
        inset-inline-start: 0;
        inline-size: min(var(--qc-w), 100vw);
        border-inline-start: 0;
        border-block: 0;
        border-start-end-radius: var(--sw-r-xl);
        border-end-end-radius: var(--sw-r-xl);
        transform: translateX(var(--qc-out, 100%));
      }
      :host-context([dir='ltr']) :host([mode='drawer']) .panel,
      :host([mode='drawer'][data-ltr]) .panel {
        --qc-out: -100%;
      }
      :host([mode='drawer'][data-expanded]) .panel {
        inline-size: var(--qc-w-wide);
      }
      :host([mode='drawer'][open][data-shown]) .panel {
        transform: none;
      }
      /* ---- pop-up: centred, grows out of the pressed element ---- */
      /* HOMEFABLE-297 (emil-design-eng: a modal under 300-500 ms; apple-design: materialize - blur and scale arrive together): the
         pop-up lands in 380 ms on the same spring, the scrim behind it blurs the page a touch */
      :host([mode='popup']) {
        --qc-open-ms: 380ms;
      }
      :host([mode='popup']) .scrim {
        -webkit-backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
        backdrop-filter: var(--sw-popup-blur); /* taste-skill-ignore: the dimmed page behind a dialog */
      }
      :host([mode='popup']) .panel {
        inset-inline: 0;
        margin-inline: auto;
        inset-block-start: 50%;
        inline-size: min(var(--qc-pop-w), calc(100vw - 32px));
        max-block-size: min(86vh, 900px);
        border-radius: var(--sw-r-2xl);
        opacity: 0;
        transform: translateY(-50%) var(--qc-from, scale(0.96));
      }
      :host([mode='popup'][data-expanded]) .panel {
        inline-size: var(--qc-pop-w-wide);
      }
      :host([mode='popup'][open][data-shown]) .panel {
        opacity: 1;
        transform: translateY(-50%);
      }
      /* ---- bottom sheet (phone): three detents, dragged ---- */
      :host([mode='sheet']) .panel {
        inset-inline: 0;
        inset-block-end: 0;
        block-size: 100dvh;
        border-inline: 0;
        border-block-end: 0;
        border-start-start-radius: var(--sw-r-2xl);
        border-start-end-radius: var(--sw-r-2xl);
        padding-block-end: env(safe-area-inset-bottom, 0px);
        transform: translateY(100%);
      }
      /* the list scrolls with the finger; the grabber and the head drag the sheet */
      :host([mode='sheet']) .body {
        touch-action: pan-y;
        -webkit-mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%); /* taste-skill-ignore: a fade MASK at the cut edge, not a fill */
        mask-image: linear-gradient(to bottom, #000 calc(100% - 28px), transparent 100%); /* taste-skill-ignore: a fade MASK at the cut edge, not a fill */
      }
      :host([mode='sheet'][open][data-shown]) .panel {
        transform: translateY(var(--qc-rest, 38%));
      }
      /* AREAEDIT-2290: the editor's footer (reset / cancel / save) must always be on screen. The browsing sheet is a full-height panel
         pushed down by its detent (its lower part is cropped; the list scrolls); the editor panel is only as tall as the visible part. */
      :host([mode='sheet'][data-editing]) .panel {
        inset-block-start: 0;
        inset-block-end: auto;
        block-size: calc(100dvh - var(--qc-rest, 0px));
      }
      :host([data-dragging]) .panel {
        transition: none !important;
      }
      :host([data-flick]) .panel {
        transition-timing-function: var(--qc-spring-flick);
      }
      .grab {
        display: none;
        flex: none;
        inline-size: 100%;
        block-size: 32px;
        border: 0;
        background: transparent;
        padding: 0;
        cursor: grab;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
      }
      .grab::before {
        content: '';
        display: block;
        inline-size: 40px;
        block-size: 5px;
        border-radius: 3px;
        margin: 10px auto 0;
        background: var(--sw-text-3);
        opacity: 0.55;
      }
      :host([mode='sheet']) .grab {
        display: block;
      }
      :host([mode='sheet']) header {
        padding-block-start: 2px;
        touch-action: none;
      }
      /* ---- the head: icon ring, name, the floor and the temperature, the actions ---- */
      /* HOMEFABLE-297 (impeccable typeset): the room's name is the display line of the surface - 24 px / 800, tight - over a 14.5 px
         reading line; the icon ring a 46 px object with the ladder's first shadow, lit when something is on */
      header {
        flex: none;
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        column-gap: 14px;
        padding: 18px 20px 12px;
      }
      .ring {
        inline-size: 46px;
        block-size: 46px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        box-shadow: var(--sw-shadow-1), inset 0 1px 0 var(--sw-highlight);
        --sw-icon-stroke: 2;
      }
      .ring[data-on] {
        background: var(--sw-lit-soft);
        color: var(--sw-heading);
      }
      .ttl {
        min-inline-size: 0;
        display: flex;
        flex-direction: column;
        line-height: 1.15;
      }
      h2 {
        margin: 0;
        font-size: var(--sw-fs-2xl);
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub {
        margin-block-start: 3px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .sub b {
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      /* each piece of the sub-line keeps its own direction (a number next to Hebrew never swaps places) */
      .sub > span {
        unicode-bidi: isolate;
      }
      /* AREA-PRESENCE-LINE-2351 (owner 02.11, round 14): the area line, as on the area screen - one fixed-height line that never wraps
         (a long list ends in an ellipsis; the full list is the tooltip); green only while someone is there */
      .pline {
        display: flex;
        align-items: center;
        gap: 6px;
        min-inline-size: 0;
        block-size: 24px;
        margin-block-start: 2px;
        font-size: var(--sw-fs-sm);
        line-height: 1.2;
        color: var(--sw-text-2);
        white-space: nowrap;
        overflow: hidden;
      }
      .pline sw-icon,
      .pline .psep {
        flex: none;
        color: var(--sw-text-3);
      }
      .pline .plbl {
        flex: none;
      }
      .pline b {
        flex: none;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .pline[data-tone='ok'] sw-icon,
      .pline[data-tone='ok'] b {
        color: var(--sw-success-text);
      }
      .pline .pwho {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--sw-text);
      }
      /* PRESENCE-COMPACT-2310: the room's presence - green words only while active, a hollow dot for "no data" */
      .sub .pres i {
        display: inline-block;
        inline-size: 7px;
        block-size: 7px;
        border-radius: 50%;
        margin-inline-end: 5px;
        vertical-align: 0.1em;
        background: var(--sw-unknown);
      }
      .sub .pres[data-tone='ok'] {
        color: var(--sw-success-text);
        font-weight: var(--sw-fw-medium);
      }
      .sub .pres[data-tone='ok'] i {
        background: var(--sw-success);
      }
      .sub .pres[data-tone='unknown'] i {
        background: transparent;
        box-shadow: inset 0 0 0 1.5px var(--sw-unknown);
      }
      .acts {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .ib {
        inline-size: 36px;
        block-size: 36px;
        border: 0;
        border-radius: 50%;
        background: transparent;
        color: var(--sw-text-2);
        display: grid;
        place-items: center;
        cursor: pointer;
        padding: 0;
        text-decoration: none;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), transform 120ms var(--sw-ease-out);
      }
      .ib:active {
        transform: scale(0.94);
      }
      @media (hover: hover) and (pointer: fine) {
        .ib:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .ib:focus-visible,
      .qb:focus-visible,
      .scene:focus-visible,
      .grab:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      @media (max-width: 767px) {
        .ib {
          inline-size: 44px;
          block-size: 44px;
        }
        /* a narrow head: the floor, the temperature and the count may take a second line instead of an ellipsis */
        .sub {
          white-space: normal;
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
      }
      /* ---- the body: no scroll where it fits; a scroll only when it does not ---- */
      .body {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        padding: 4px 20px 20px;
      }
      .cols {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      /* expanded: two CSS columns in a box of its own height (a column box with a fixed height spills sideways - break-ui found it) */
      :host([data-expanded]) .cols {
        display: block;
        column-count: 2;
        column-gap: 20px;
      }
      :host([data-expanded]) .cols > * {
        break-inside: avoid;
        margin-block-end: 16px;
      }
      :host([data-expanded]) .cols > .quick,
      :host([data-expanded]) .cols > .note {
        column-span: all;
      }
      /* the content focuses in as the panel lands */
      :host([open][data-shown]) .cols > * {
        animation: qc-in var(--qc-open-ms) var(--sw-ease-dialog) both;
      }
      :host([open][data-shown]) .cols > :nth-child(2) {
        animation-delay: 40ms;
      }
      :host([open][data-shown]) .cols > :nth-child(3) {
        animation-delay: 80ms;
      }
      :host([open][data-shown]) .cols > :nth-child(n + 4) {
        animation-delay: 110ms;
      }
      @keyframes qc-in {
        from {
          opacity: 0;
          transform: translateY(6px);
        }
      }
      /* ---- the quick strip: the area's group actions ---- */
      .quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      /* HOMEFABLE-297 (apple-design materials, emil press): the group actions are raised keys (a tone step, the first shadow, 14.5 px
         semibold) and the one that turns the room off is a filled danger key, not a red outline; a press sinks the key at once */
      .qb {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        min-block-size: 40px;
        padding: 0 16px;
        border: 1px solid var(--sw-border); /* taste-skill-ignore: the key's edge, one step under the panel outline */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-2);
        box-shadow: var(--sw-shadow-1); /* taste-skill-ignore: a raised key (owner: depth) */
        color: var(--sw-heading);
        font: inherit;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: background-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
      }
      .qb:active:not(:disabled) {
        transform: scale(var(--sw-press-scale, 0.97));
        box-shadow: none;
        background: var(--sw-pressed-wash);
      }
      .qb:disabled {
        opacity: 0.5;
        cursor: default;
      }
      @media (hover: hover) and (pointer: fine) {
        .qb:hover:not(:disabled) {
          background: var(--sw-surface);
          box-shadow: var(--sw-shadow-2);
        }
      }
      .qb.main {
        background: var(--sw-danger-soft);
        border-color: color-mix(in srgb, var(--sw-danger) 35%, transparent);
        color: var(--sw-danger-text);
      }
      @media (hover: hover) and (pointer: fine) {
        .qb.main:hover:not(:disabled) {
          background: var(--sw-danger-soft);
          border-color: color-mix(in srgb, var(--sw-danger) 60%, transparent);
        }
      }
      @media (max-width: 767px) {
        .qb {
          min-block-size: 44px;
        }
      }
      /* ---- a section: a small label with its icon and count, then the rows ---- */
      .sec {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-inline-size: 0;
      }
      /* HOMEFABLE-297: a section is a real heading (14.5 px bold, heading ink, the icon in the accent) with its count as a filled pill */
      .sh {
        display: flex;
        align-items: center;
        gap: 7px;
        padding-inline: 2px;
        padding-block-start: 6px;
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-bold);
        letter-spacing: -0.01em;
        color: var(--sw-heading);
      }
      .sh > sw-icon {
        color: var(--sw-accent);
      }
      .sh .n {
        margin-inline-start: auto;
        min-inline-size: 22px;
        padding: 1px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface-3);
        color: var(--sw-text-2);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-bold);
        font-variant-numeric: tabular-nums;
        text-align: center;
      }
      .rows {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .row {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        grid-template-areas: 'ic nm ct' 'ic st ct';
        align-items: center;
        column-gap: 12px;
        min-block-size: 50px;
        padding: 7px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        border: 1px solid transparent; /* taste-skill-ignore: reserves the width, no visible line */
        transition: background-color var(--sw-t-state) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
      }
      .row.on {
        background: var(--sw-lit-soft);
      }
      .row.on[data-card='climate'],
      .row.on[data-card='heating'],
      .row.on[data-card='covers'],
      .row.on[data-card='media'] {
        background: var(--sw-accent-soft);
      }
      .row > sw-icon {
        grid-area: ic;
        color: var(--sw-text-3);
      }
      .row.on > sw-icon {
        color: var(--sw-heading);
      }
      .row .nm {
        grid-area: nm;
        font-size: var(--sw-fs-name);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.25;
      }
      .row .st {
        grid-area: st;
        font-size: var(--sw-fs-state);
        color: var(--sw-text-2);
        font-variant-numeric: tabular-nums;
        line-height: 1.25;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .row .ct {
        grid-area: ct;
        display: inline-flex;
        align-items: center;
      }
      /* the shared controls (devices-controls.ts) take a whole line under the name and the state */
      .row > .ctl-row,
      .row > .ctl-range,
      .row > .cmd-status,
      .row > .rollback-note {
        grid-column: 1 / -1;
        grid-row: auto;
      }
      .row > .ctl-row {
        margin-block-start: 4px;
      }
      /* sensors: value chips */
      .sens {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
      }
      .sv {
        display: flex;
        flex-direction: column;
        min-inline-size: 0;
        padding: 8px 12px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        line-height: 1.25;
      }
      .sv b {
        font-size: var(--sw-fs-xl);
        font-weight: 800;
        letter-spacing: -0.02em;
        color: var(--sw-heading);
        font-variant-numeric: tabular-nums;
      }
      .sv span {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      /* cameras */
      .cams {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 8px;
      }
      .cams devices-camera-card {
        border-radius: var(--sw-r-media);
        overflow: hidden;
      }
      /* scenes: chips that run */
      .scenes {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .scene {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding: 0 12px;
        border: 1px solid var(--sw-border-strong); /* taste-skill-ignore: the same outlined pill as the home's own quick actions */
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 120ms var(--sw-ease-out), background-color var(--sw-t-fast) var(--sw-ease);
      }
      .scene:active {
        transform: scale(0.97);
      }
      .scene[data-busy] {
        opacity: 0.6;
      }
      @media (hover: hover) and (pointer: fine) {
        .scene:hover {
          background: var(--sw-surface-2);
        }
      }
      /* schedules and events: quiet lines */
      .line {
        display: flex;
        align-items: center;
        gap: 10px;
        min-block-size: 36px;
        padding: 4px 10px;
        border-radius: var(--sw-r-sm);
        background: var(--sw-surface-2);
        font-size: var(--sw-fs-sm);
      }
      .line .nm {
        flex: 1;
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--sw-heading);
        font-weight: var(--sw-fw-medium);
      }
      .line .tm {
        flex: none;
        color: var(--sw-text-3);
        font-variant-numeric: tabular-nums;
        font-size: var(--sw-fs-xs);
      }
      .line.off .nm {
        color: var(--sw-text-3);
        font-weight: var(--sw-fw-regular);
      }
      .line .dot {
        flex: none;
        inline-size: 8px;
        block-size: 8px;
        border-radius: 50%;
        background: var(--sw-success);
      }
      .line.off .dot {
        background: var(--sw-text-3);
        opacity: 0.5;
      }
      .note {
        padding: 18px 8px;
        text-align: center;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .spin {
        inline-size: 18px;
        block-size: 18px;
        margin: 24px auto;
        border-radius: 50%;
        border: 2px solid var(--sw-border-strong);
        border-block-start-color: var(--sw-accent);
        animation: qc-spin 0.7s linear infinite;
      }
      @keyframes qc-spin {
        to {
          transform: rotate(360deg);
        }
      }
      /* ---- solid when the browser cannot blur or the OS asks for less transparency / more contrast ---- */
      @media (prefers-reduced-transparency: reduce) {
        .scrim {
          -webkit-backdrop-filter: none; /* taste-skill-ignore: the reset */
          backdrop-filter: none; /* taste-skill-ignore: the reset */
        }
      }
      @media (prefers-contrast: more) {
        .panel {
          border-color: var(--sw-text-2);
        }
      }
      /* ---- reduced motion: a short cross-fade, no travel, no spring ---- */
      @media (prefers-reduced-motion: reduce) {
        .panel,
        :host([open]) .panel,
        :host([mode='drawer']) .panel,
        :host([mode='popup']) .panel,
        :host([mode='sheet']) .panel {
          transition: opacity 160ms var(--sw-ease), visibility 0s linear 160ms !important;
          opacity: 0;
        }
        :host([mode='drawer'][open][data-shown]) .panel,
        :host([mode='popup'][open][data-shown]) .panel,
        :host([mode='sheet'][open][data-shown]) .panel {
          opacity: 1;
          transition: opacity 160ms var(--sw-ease), visibility 0s !important;
        }
        :host([mode='drawer']) .panel {
          transform: none;
        }
        :host([mode='popup']) .panel {
          transform: translateY(-50%);
        }
        :host([mode='sheet']) .panel {
          transform: translateY(var(--qc-rest, 38%));
        }
        :host([open][data-shown]) .cols > * {
          animation: none;
        }
        .spin {
          animation-duration: 1.4s;
        }
      }

      /* ---- AREAEDIT-2290: the editor (same panel; hide + order). Tokens only; green is never used here, the switch is accent blue ---- */
      /* the name keeps its ellipsis, the "editing" label never leaves; on the phone the head carries only the close button while editing */
      h2 {
        display: flex;
        align-items: center;
        min-inline-size: 0;
      }
      h2 .hn {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      h2 .editing {
        flex: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-inline-start: 10px;
        padding: 2px 8px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        font-size: var(--sw-fs-xs);
        font-weight: var(--sw-fw-semibold);
        letter-spacing: 0;
        vertical-align: middle;
      }
      /* a 375 px row: four 44 px controls + the name; the "hidden" word gives way to the dimmed row and the closed eye */
      :host([mode='sheet']) .er {
        gap: 2px;
        padding-inline: 4px;
      }
      :host([mode='sheet']) .er .hidtag {
        display: none;
      }
      :host([mode='sheet'][data-editing]) [data-qc-expand],
      :host([mode='sheet'][data-editing]) [data-qc-open-screen] {
        display: none;
      }
      .ed {
        position: relative;
        flex: 1 1 auto;
        min-block-size: 0;
        display: flex;
        flex-direction: column;
      }
      .ed-main {
        flex: 1 1 auto;
        min-block-size: 0;
        overflow-y: auto; /* only when the sections do not fit (an accordion keeps it rare); the footer never scrolls away */
        overflow-x: hidden;
        padding: 4px 20px 8px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      /* two columns (list + side) only where there is room: the pop-up and the widened drawer; the 480 px drawer and the phone stack them */
      :host([mode='popup']) .ed-main,
      :host([mode='drawer'][data-expanded]) .ed-main {
        flex-direction: row;
        align-items: flex-start;
      }
      :host([mode='popup']) .ed-list,
      :host([mode='drawer'][data-expanded]) .ed-list {
        flex: 1 1 auto;
        min-inline-size: 0;
      }
      .ed-list {
        min-inline-size: 0;
      }
      .ed-side {
        flex: none;
      }
      :host([mode='popup']) .ed-side,
      :host([mode='drawer'][data-expanded]) .ed-side {
        flex: 0 0 240px;
      }
      .er {
        display: flex;
        align-items: center;
        gap: 6px;
        min-block-size: 48px; /* a 44 px control and 2 px of air on each side */
        padding: 2px 6px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
        margin-block-end: 4px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text);
      }
      .er.off .nm {
        color: var(--sw-text-3);
      }
      .er.off {
        opacity: 0.7;
      }
      .er.it {
        margin-inline-start: 24px;
        min-block-size: 46px; /* the 44 px control inside the 1 px edge */
        padding-block: 0;
        background: transparent;
        border: 1px solid var(--sw-border);
      }
      .er .nm {
        min-inline-size: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-weight: var(--sw-fw-semibold);
      }
      .er .meta,
      .er .hidtag {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        white-space: nowrap;
      }
      .er .tag {
        font-size: var(--sw-fs-xs);
        padding: 1px 6px;
        border-radius: var(--sw-r-pill);
        background: var(--sw-surface);
        border: 1px solid var(--sw-border);
        color: var(--sw-text-2);
        white-space: nowrap;
      }
      .grow {
        flex: 1 1 auto;
      }
      .eye,
      .mv,
      .grip,
      .exp {
        inline-size: 44px; /* a touch target is 44 x 44 at every width (owner rule); the 375 px row drops the drag handle to make room */
        block-size: 44px;
        flex: none;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--sw-r-md);
        background: transparent;
        color: var(--sw-text-2);
        cursor: pointer;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
      .grip {
        cursor: grab;
        touch-action: none; /* a finger on the handle reorders; it never scrolls the list or drags the sheet */
      }
      :host([data-ed-dragging]) .grip {
        cursor: grabbing;
      }
      .eye[aria-pressed='true'] {
        color: var(--sw-accent-text);
      }
      .mv:disabled {
        opacity: 0.3;
        cursor: default;
      }
      .exp sw-icon {
        transition: transform var(--sw-t-fast) var(--sw-ease);
      }
      .exp[aria-expanded='true'] sw-icon {
        transform: rotate(180deg);
      }
      .exp-gap {
        inline-size: 44px;
        flex: none;
      }
      /* the editor's other controls reach 44 px too: the apply-to switch, "show more", the footer keys, the head's buttons, the sheet's handle,
         the alert switch (its host is padded to 44 x 44; a press on the padding flips it) */
      :host([data-editing]) .ib,
      :host([data-editing]) .qb,
      .seg button,
      .more {
        min-block-size: 44px;
      }
      :host([data-editing]) .ib {
        inline-size: 44px;
        block-size: 44px;
      }
      :host([data-editing]) .grab {
        block-size: 44px;
      }
      .more {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        padding: 10px 1px;
        box-sizing: content-box;
      }
      @media (hover: hover) and (pointer: fine) {
        .eye:hover,
        .mv:hover:not(:disabled),
        .grip:hover,
        .exp:hover {
          background: var(--sw-hover-wash);
          color: var(--sw-text);
        }
      }
      .eye:focus-visible,
      .mv:focus-visible,
      .grip:focus-visible,
      .exp:focus-visible,
      .more:focus-visible,
      .seg button:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .more {
        margin-inline-start: 24px;
        border: 0;
        background: transparent;
        color: var(--sw-accent-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        cursor: pointer;
        padding: 6px 12px;
      }
      .ed-side {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .ed-side .fld {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .ed-side .fld.tgrow {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .ed-side b {
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text);
      }
      .ed-side small,
      .ed-side .fine {
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
        line-height: 1.4;
      }
      .ed-side .fine {
        display: flex;
        gap: 6px;
        align-items: flex-start;
      }
      .vh {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        overflow: hidden;
        clip-path: inset(50%);
      }
      .seg {
        display: flex;
        padding: 3px;
        gap: 3px;
        border-radius: var(--sw-r-md);
        background: var(--sw-surface-2);
      }
      .seg button {
        flex: 1 1 0;
        min-block-size: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: 0;
        border-radius: var(--sw-r-sm, var(--sw-r-md));
        background: transparent;
        color: var(--sw-text-2);
        font: inherit;
        font-size: var(--sw-fs-sm);
        font-weight: var(--sw-fw-semibold);
        cursor: pointer;
      }
      .seg button.on {
        background: var(--sw-seg-key, var(--sw-surface-solid));
        color: var(--sw-seg-key-ink, var(--sw-text));
        box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      }
      .seg button:disabled {
        opacity: 0.45;
        cursor: default;
      }
      .sitewarn,
      .warn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--sw-warning-soft, var(--sw-surface-2));
        color: var(--sw-text);
        font-size: var(--sw-fs-xs);
        line-height: 1.4;
      }
      .warn {
        margin-inline: 20px;
        margin-block-end: 6px;
        flex-wrap: wrap;
      }
      .ed-foot {
        flex: none;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 20px calc(12px + env(safe-area-inset-bottom, 0px));
        border-block-start: 1px solid var(--sw-border);
        background: var(--sw-surface-solid);
      }
      .ed-foot .qb {
        white-space: nowrap;
        flex: none;
      }
      :host([mode='sheet']) .ed-foot {
        padding-inline: 12px;
        gap: 6px;
      }
      :host([mode='sheet']) .ed-foot .qb {
        padding-inline: 12px;
      }
      .ed-side sw-toggle {
        --sw-toggle-on: var(--sw-accent); /* the editor's switch is accent blue, never the success green */
      }
      :host([data-editing]) .sub {
        white-space: normal;
      }
      :host([mode='drawer']:not([data-expanded])) .ed-foot .lockn {
        display: none; /* the narrow drawer has no room for the note; the head's hint and the disabled controls say it */
      }
      .ed-foot .lockn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: var(--sw-fs-xs);
        color: var(--sw-text-3);
      }
      .qb.pri {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
        color: var(--sw-text-inverse);
      }
      .ed-foot .qb:focus-visible,
      .warn .qb:focus-visible,
      .cf .qb:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .cf-scrim {
        position: absolute;
        inset: 0;
        background: var(--sw-overlay);
        z-index: 2;
      }
      .cf {
        position: absolute;
        z-index: 3;
        inset-inline: 20px;
        inset-block-end: 20px;
        padding: 16px;
        border-radius: var(--sw-r-xl);
        background: var(--sw-surface-solid);
        border: 1px solid var(--sw-border-strong);
        box-shadow: var(--sw-shadow-3);
      }
      .cf h3 {
        margin: 0 0 6px;
        font-size: var(--sw-fs-lg);
        color: var(--sw-heading);
      }
      .cf p {
        margin: 0 0 12px;
        font-size: var(--sw-fs-md);
        color: var(--sw-text-2);
      }
      .cf .row2 {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      /* a hidden sensor that is in alarm: shown for as long as it alarms, red (only an alarm is red) */
      .sv.alarm {
        background: var(--sw-danger-soft);
        outline: 1px solid color-mix(in srgb, var(--sw-danger) 55%, transparent);
        outline-offset: -1px;
      }
      .sv.alarm b {
        color: var(--sw-danger-text);
      }
      .sv.alarm em {
        font-style: normal;
        font-size: var(--sw-fs-xs);
        color: var(--sw-danger-text);
        line-height: 1.3;
      }
    `];var Xe=Object.defineProperty,Je=Object.getOwnPropertyDescriptor,h=(e,t,i,s)=>{for(var a=s>1?void 0:s?Je(t,i):t,o=e.length-1,l;o>=0;o--)(l=e[o])&&(a=(s?l(t,i,a):l(a))||a);return s&&a&&Xe(t,i,a),a};const Ze=()=>{try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches}catch{return!1}};function I(){let e=document.activeElement;for(;e?.shadowRoot?.activeElement;)e=e.shadowRoot.activeElement;return e}const et=400,X={lighting:"qcSecLighting",switches:"qcSecSwitches",climate:"qcSecClimate",heating:"qcSecHeating",covers:"qcSecCovers",media:"qcSecMedia",sensors:"qcSecSensors",cameras:"qcSecCameras",scenes:"qcSecScenes",schedules:"qcSecSchedules",events:"qcSecEvents"},tt={lighting:"light",switches:"bolt",climate:"snow",heating:"flame",covers:"layers",media:"play",sensors:"sensor",cameras:"camera",scenes:"sparkle",schedules:"clock",events:"history"};let p=class extends ne{constructor(){super(...arguments),this.area=null,this.floorName="",this.presence=null,this.icon="home",this.mode="drawer",this.open=!1,this.origin=null,this.canBulk=!1,this.offline=!1,this.expanded=!1,this.detent="half",this.detail=null,this.error="",this.scenes=[],this.schedules=[],this.events=[],this.sceneBusy="",this.areaPres=null,this.presTimer=0,this.opts=oe,this.editing=!1,this.draft=D,this.applyTo="area",this.alertDraft="show",this.openSec=null,this.moreItems=!1,this.confirmReset=!1,this.saving=!1,this.saveError="",this.conflict=!1,this.edDrag=null,this.ctl=new re(this,()=>this.scheduleReload()),this.opener=null,this.releaseScroll=null,this.stopHa=null,this.reloadTimer=0,this.reloading=!1,this.reloadAgain=!1,this.loadSeq=0,this.drag=null,this.dragged=!1,this.closedByKey=!1,this.hideTimer=0,this.flickTimer=0,this.resizeFrame=new le(()=>{this.open&&(this.applyRest(),this.requestUpdate())}),this.onResize=()=>{this.open&&this.resizeFrame.schedule()},this.onKey=e=>{if(this.open){if(e.key==="Escape"){if(e.composedPath().some(i=>i instanceof Element&&(i.tagName==="SW-DIALOG"||i.tagName==="DEVICES-BULK-DIALOG"))||!de(this,e))return;if(e.preventDefault(),this.confirmReset){this.confirmReset=!1;return}if(this.editing){this.cancelEdit();return}this.closedByKey=!0,this.close();return}e.key==="Tab"&&ce(this)&&this.trapTab(e)}},this.onDown=e=>{if(this.mode!=="sheet"||!this.open||this.drag)return;const t='button:not(.grab), a, input, select, textarea, [role="slider"], sw-button, sw-toggle, devices-camera-card',i=e.composedPath();if(i.some(o=>o instanceof Element&&o.matches(t))||!i.some(o=>o instanceof Element&&(o.matches("header")||o.classList.contains("grab"))))return;const s=e.currentTarget,a=this.currentOffset(s);this.drag={y0:e.clientY,t0:performance.now(),id:e.pointerId,base:a,last:e.clientY,lastT:performance.now(),v:0};try{s.setPointerCapture(e.pointerId)}catch{}this.toggleAttribute("data-dragging",!0),s.style.transform=`translateY(${a}px)`},this.onMove=e=>{const t=this.drag;if(!t||e.pointerId!==t.id)return;const i=performance.now(),s=Math.max(1,i-t.lastT);t.v=t.v*.6+(e.clientY-t.last)/s*.4,t.last=e.clientY,t.lastT=i;const a=window.innerHeight,o=e.clientY-t.y0,l=a-S(this.detent,a),u=pe(this.detent,o+(t.base-l),a);e.currentTarget.style.transform=`translateY(${u}px)`},this.onUp=e=>{const t=this.drag;if(!t||e.pointerId!==t.id)return;this.drag=null;const i=e.currentTarget,s=window.innerHeight,a=s-S(this.detent,s),o=e.clientY-t.y0+(t.base-a),l=he(this.detent,o,t.v,s),u=Math.abs(t.v)>.45;this.dragged=Math.abs(e.clientY-t.y0)>6,this.toggleAttribute("data-dragging",!1),this.toggleAttribute("data-flick",u),i.style.transform="",l==="closed"?this.close():this.detent=l,window.clearTimeout(this.flickTimer),this.flickTimer=window.setTimeout(()=>{this.flickTimer=0,this.removeAttribute("data-flick")},L)}}connectedCallback(){super.connectedCallback(),this.style.setProperty("--qc-spring",M(j.response,j.bounce)),this.style.setProperty("--qc-spring-flick",M(Q.response,Q.bounce)),this.style.setProperty("--qc-open-ms",`${L}ms`),this.style.setProperty("--qc-close-ms",`${H}ms`),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.onResize)}disconnectedCallback(){window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.onResize),ue(this),this.resizeFrame.cancel(),this.stopLive(),this.releaseScroll?.(),this.releaseScroll=null,window.clearTimeout(this.hideTimer),window.clearTimeout(this.flickTimer),this.flickTimer=0,this.removeAttribute("data-flick"),super.disconnectedCallback()}willUpdate(e){e.has("area")&&this.area&&e.get("area")?.area_id!==this.area.area_id&&(this.detail=null,this.areaPres=null,this.scenes=[],this.schedules=[],this.events=[],this.error="",this.editing=!1,this.confirmReset=!1),(e.has("mode")||e.has("open"))&&(this.mode==="sheet"&&this.editing&&(this.editing=!1),this.open&&this.mode==="sheet"&&(this.expanded=!1))}updated(e){fe(this,this.open),this.toggleAttribute("data-expanded",this.expanded&&this.mode!=="sheet"),this.toggleAttribute("data-editing",this.editing),this.toggleAttribute("data-ltr",getComputedStyle(this.parentElement??document.documentElement).direction==="ltr"),this.applyRest();const t=e.has("area")&&e.get("area")?.area_id!==this.area?.area_id;(e.has("open")||t&&this.open)&&(this.open?this.onOpen(e.has("open")):e.get("open")===!0&&this.onClose())}onOpen(e){if(window.clearTimeout(this.hideTimer),e){const t=I();t&&!this.contains(t)&&(this.opener=t),this.detent="half",this.placeAtOrigin(),this.releaseScroll?.(),this.releaseScroll=me(this),this.startLive(),requestAnimationFrame(()=>requestAnimationFrame(()=>{this.open&&(this.toggleAttribute("data-shown",!0),this.updateComplete.then(()=>this.focusIn()))}))}this.load()}onClose(){this.editing=!1,this.confirmReset=!1,this.toggleAttribute("data-shown",!1),this.removeAttribute("data-flick"),this.releaseScroll?.(),this.releaseScroll=null,this.stopLive(),window.clearTimeout(this.hideTimer),this.hideTimer=window.setTimeout(()=>this.dropBody(),H);const e=this.opener;this.opener=null;const t=this.closedByKey;this.closedByKey=!1,t&&e?.isConnected&&requestAnimationFrame(()=>e.focus({preventScroll:!0}))}dropBody(){this.hideTimer=0,!this.open&&(++this.loadSeq,this.detail=null,this.scenes=[],this.schedules=[],this.events=[],this.error="")}placeAtOrigin(){if(this.mode!=="popup"){this.style.removeProperty("--qc-from");return}const e=this.origin;if(!e||Ze()){this.style.removeProperty("--qc-from");return}const t=Math.min(this.expanded?1040:620,window.innerWidth-32),i=Math.min(window.innerHeight*.86,900,Math.max(320,this.detail?620:420)),s={x:(window.innerWidth-t)/2,y:(window.innerHeight-i)/2,w:t,h:i};this.style.setProperty("--qc-from",we(ge(e,s)))}applyRest(){if(this.mode!=="sheet")return;const e=window.innerHeight,t=e-S(this.detent,e);this.style.setProperty("--qc-rest",`${t}px`)}close(){this.open&&(this.open=!1,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0})))}trapTab(e){const t=this.renderRoot.querySelector(".panel");if(!t)return;const i=B(t).filter(u=>!u.classList.contains("grab"));if(!i.length){e.preventDefault();return}const s=I(),a=s?t.contains(s)||this.contains(s):!1,o=i[0],l=i[i.length-1];a?e.shiftKey&&s===o?(e.preventDefault(),l.focus({preventScroll:!0})):!e.shiftKey&&s===l&&(e.preventDefault(),o.focus({preventScroll:!0})):(e.preventDefault(),(e.shiftKey?l:o).focus({preventScroll:!0}))}focusIn(){const e=this.renderRoot.querySelector(".panel");if(!e||!this.open)return;const t=I();if(t&&e.contains(t))return;const i=B(e).filter(s=>!s.classList.contains("grab"));(i.find(s=>s.hasAttribute("data-qc-close"))??i[0])?.focus({preventScroll:!0})}toggleExpand(){if(this.mode==="sheet"){this.detent=this.detent==="full"?"half":"full";return}this.expanded=!this.expanded}onGrabClick(){if(!(this.mode!=="sheet"||this.drag)){if(this.dragged){this.dragged=!1;return}this.detent=this.detent==="peek"?"half":this.detent==="half"?"full":"peek"}}onGrabKey(e){if(this.mode==="sheet"){if(e.key==="ArrowUp")this.detent=this.detent==="peek"?"half":"full";else if(e.key==="ArrowDown")this.detent==="peek"?(this.closedByKey=!0,this.close()):this.detent=this.detent==="full"?"half":"peek";else return;e.preventDefault()}}currentOffset(e){try{return new DOMMatrixReadOnly(getComputedStyle(e).transform).f}catch{return window.innerHeight-S(this.detent,window.innerHeight)}}startLive(){this.stopLive(),$()&&(this.stopHa=ve(e=>{e.type==="entity_state_changed"?(!this.detail||this.entityIds.has(e.entity.entity_id))&&this.scheduleReload():e.type==="structure_changed"&&this.scheduleReload()}),this.presTimer=window.setInterval(()=>{const e=this.area;!e||!this.open||document.hidden||!this.areaPres?.line||this.readPresence(e.area_id).then(t=>{t!==void 0&&this.area?.area_id===e.area_id&&(this.areaPres=t)})},be))}stopLive(){this.stopHa?.(),this.stopHa=null,window.clearTimeout(this.reloadTimer),this.reloadTimer=0,this.reloadAgain=!1,window.clearInterval(this.presTimer),this.presTimer=0}async readPresence(e){if(!$()||!(q("presence.building.view")||q("presence.view")))return null;try{return await xe(e)}catch{return}}scheduleReload(){this.reloadTimer||(this.reloadTimer=window.setTimeout(()=>{this.reloadTimer=0,this.reloadQuiet()},et))}async reloadQuiet(){if(this.reloading){this.reloadAgain=!0;return}this.reloading=!0;try{await this.load(!0)}finally{this.reloading=!1}this.reloadAgain&&(this.reloadAgain=!1,this.scheduleReload())}get entityIds(){return this.detail?new Set(Object.values(this.detail.cards).flatMap(e=>(e?.entities??[]).map(t=>t.entity_id))):new Set}async load(e=!1){const t=this.area;if(!t||!this.open)return;const i=++this.loadSeq;try{const[s,a]=await Promise.all([ye(t.area_id),this.readPresence(t.area_id)]);if(i!==this.loadSeq)return;a!==void 0&&(this.areaPres=a),this.detail=s,this.error="",this.placeAtOrigin()}catch{if(i!==this.loadSeq)return;this.detail||(this.error=n("qcLoadFailed"))}e||(this.loadSide(t,i),N().then(s=>{i===this.loadSeq&&!this.editing&&(this.opts=s)}))}async loadSide(e,t){const i=U(u=>!$()||q(u)),s=(u,v)=>u.catch(k=>(k instanceof K&&(k.status===403||k.status===404),v)),[a,o,l]=await Promise.all([i.scenes?s(ke().list({kind:"scene",area:e.area_id,limit:8}).then(u=>u.items.filter(v=>v.can.run)),[]):Promise.resolve([]),i.schedules?s($e({area:e.area_id}).then(u=>u.items.slice(0,6)),[]):Promise.resolve([]),i.events&&e.map?.zone_id?s(Pe({zoneId:e.map.zone_id,limit:5}).then(u=>u.events.slice(0,5)),[]):Promise.resolve([])]);t===this.loadSeq&&(this.scenes=a,this.schedules=o,this.events=l)}async runScene(e){if(!this.sceneBusy){this.sceneBusy=e.id;try{await qe(e.id)}catch{}finally{this.sceneBusy=""}}}bulk(e,t){!this.area||this.offline||this.dispatchEvent(new CustomEvent("area-bulk",{detail:{kind:e,position:t,area:this.area},bubbles:!0,composed:!0}))}openScreen(e){e.preventDefault();const t=this.area;t&&(this.dispatchEvent(new CustomEvent("open-screen",{detail:{area:t},bubbles:!0,composed:!0})),this.close(),location.hash=`#/devices/areas/${encodeURIComponent(t.area_id)}`)}startEdit(){this.canEdit&&(this.draft=this.layout,this.applyTo="area",this.alertDraft=this.opts.popup_alert,this.openSec=null,this.moreItems=!1,this.confirmReset=!1,this.saveError="",this.conflict=!1,this.editing=!0,this.mode==="sheet"&&(this.detent="full"),this.updateComplete.then(()=>this.renderRoot.querySelector("[data-qc-ed-save]")?.focus({preventScroll:!0})))}cancelEdit(){this.editing=!1,this.confirmReset=!1,this.saveError="",this.conflict=!1}get listedSections(){return Ne(this.availableSections,this.draft)}edToggleSection(e){this.draft=Fe(this.draft,e)}edToggleItem(e,t){const i=T(this.itemRows(e),e,this.draft).map(s=>s.row.entity_id);this.draft=Ye(this.draft,e,t,i)}edMove(e,t,i){const s=e==="sections"?this.listedSections.map(o=>o.id):T(this.itemRows(e),e,this.draft).map(o=>o.row.entity_id),a=Ue(s,s.indexOf(t),i);this.draft=e==="sections"?Ke(this.draft,a):Ge(this.draft,e,a)}edStep(e,t,i){const s=e==="sections"?this.listedSections.map(a=>a.id):T(this.itemRows(e),e,this.draft).map(a=>a.row.entity_id);this.edMove(e,t,s.indexOf(t)+i)}onGripKey(e,t,i){e.key!=="ArrowUp"&&e.key!=="ArrowDown"||(e.preventDefault(),this.edStep(t,i,e.key==="ArrowUp"?-1:1),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-ed-grip="${CSS.escape(i)}"]`)?.focus({preventScroll:!0})))}onGripDown(e,t,i){if(e.button===0){e.preventDefault(),e.stopPropagation(),this.edDrag={list:t,id:i,pid:e.pointerId};try{e.currentTarget.setPointerCapture(e.pointerId)}catch{}this.toggleAttribute("data-ed-dragging",!0)}}onGripMove(e){const t=this.edDrag;if(!t||e.pointerId!==t.pid)return;const i=[...this.renderRoot.querySelectorAll(`[data-ed-list="${CSS.escape(t.list)}"] > [data-ed-row]`)],s=i.findIndex(o=>{const l=o.getBoundingClientRect();return e.clientY>=l.top&&e.clientY<=l.bottom}),a=i.findIndex(o=>o.dataset.edRow===t.id);s>=0&&a>=0&&s!==a&&this.edMove(t.list,t.id,s)}onGripUp(e){!this.edDrag||e.pointerId!==this.edDrag.pid||(this.edDrag=null,this.toggleAttribute("data-ed-dragging",!1))}async saveEdit(e=!1){if(this.saving||!this.area)return;const t=this.applyTo==="site",i=We(this.draft,this.listedSections.map(o=>o.id)),a=F("system.configure")&&this.alertDraft!==this.opts.popup_alert?this.alertDraft:void 0;this.saving=!0,this.saveError="";try{const o=await Se(t?null:this.area.area_id,this.opts.popup.version,i,{force:e,alert:a});this.opts={...this.opts,popup:o.popup,popup_alert:o.popup_alert},this.editing=!1,this.conflict=!1}catch(o){ze(o)?this.conflict=!0:this.saveError=o instanceof K&&o.status===403?o.message:n("qcSaveFailed")}finally{this.saving=!1}}async reloadEdit(){Oe(),this.opts=await N(!0),this.draft=this.layout,this.alertDraft=this.opts.popup_alert,this.conflict=!1}doReset(){this.draft=D,this.confirmReset=!1,this.openSec=null}renderEditor(){const e=this.area,t=this.listedSections,i=this.mode==="sheet",s=this.applyTo==="site",a=F("system.configure"),o=d=>d==="quick"?n("qcQuickLabel"):n(X[d]),l=(d,w,f)=>r`<button type="button" class="eye" data-ed-eye aria-pressed=${String(!d)} aria-label=${d?n("qcShowIt",{name:w}):n("qcHideIt",{name:w})} title=${d?n("qcShowIt",{name:w}):n("qcHideIt",{name:w})} @click=${f}><sw-icon name=${d?"eyeOff":"eye"} size=${16}></sw-icon></button>`,u=(d,w,f,g)=>r`
      <button type="button" class="mv" data-ed-up aria-label=${n("qcMoveUp")} title=${n("qcMoveUp")} ?disabled=${f===0} @click=${()=>this.edStep(d,w,-1)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
      <button type="button" class="mv" data-ed-down aria-label=${n("qcMoveDown")} title=${n("qcMoveDown")} ?disabled=${f===g-1} @click=${()=>this.edStep(d,w,1)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>`,v=(d,w)=>r`<button type="button" class="grip" data-ed-grip=${w} aria-label=${n("qcDragHandle")} title=${n("qcDragHandle")} @pointerdown=${f=>this.onGripDown(f,d,w)} @pointermove=${f=>this.onGripMove(f)} @pointerup=${f=>this.onGripUp(f)} @pointercancel=${f=>this.onGripUp(f)} @keydown=${f=>this.onGripKey(f,d,w)}><sw-icon name="grip" size=${15}></sw-icon></button>`,k=d=>P.includes(d)&&this.itemRows(d).length>0,R=i?4:6,ee=d=>{const w=T(this.itemRows(d),d,this.draft),f=this.moreItems?w:w.slice(0,R);return r`<div class="ed-items" role="list" data-ed-list=${d} aria-label=${n("qcItemsOf",{name:o(d)})}>
        ${z(f,g=>g.row.entity_id,(g,te)=>r`<div class=${x({er:!0,it:!0,off:g.hidden})} role="listitem" data-ed-row=${g.row.entity_id}>
          ${v(d,g.row.entity_id)}${l(g.hidden,g.row.name,()=>this.edToggleItem(d,g.row.entity_id))}
          <span class="nm">${y(g.row.name)}</span>${d==="sensors"&&He(g.row)?r`<span class="tag" data-ed-tech>${n("qcTechTag")}</span>`:c}${g.hidden?r`<span class="hidtag">${n("qcHiddenTag")}</span>`:c}
          <span class="grow"></span>${u(d,g.row.entity_id,te,w.length)}</div>`)}
        ${w.length>R&&!this.moreItems?r`<button type="button" class="more" data-ed-more @click=${()=>this.moreItems=!0}>${n("qcShowMoreN",{n:w.length-R})}</button>`:c}
      </div>`};return r`<div class="ed" data-qc-editor>
      <div class="ed-main">
        <div class="ed-list" role="list" data-ed-list="sections" aria-label=${n("qcEditTitle")}>
          ${z(t,d=>d.id,(d,w)=>{const f=this.openSec===d.id,g=Qe(this.draft,d.id);return r`<div class=${x({er:!0,sr:!0,off:d.hidden,open:f})} role="listitem" data-ed-row=${d.id}>
                ${v("sections",d.id)}${l(d.hidden,o(d.id),()=>this.edToggleSection(d.id))}
                <span class="nm">${o(d.id)}</span>${g?r`<span class="meta">· ${n("qcHiddenN",{n:g})}</span>`:c}${d.hidden?r`<span class="hidtag">${n("qcHiddenTag")}</span>`:c}
                <span class="grow"></span>${u("sections",d.id,w,t.length)}
                ${k(d.id)?r`<button type="button" class="exp" data-ed-expand=${d.id} aria-expanded=${String(f)} aria-label=${n("qcItemsOf",{name:o(d.id)})} @click=${()=>{this.openSec=f?null:d.id,this.moreItems=!1}}><sw-icon name="chevronDown" size=${14}></sw-icon></button>`:r`<span class="exp-gap"></span>`}
              </div>${f?ee(d.id):c}`})}
        </div>
        <aside class="ed-side">
          <div class="fld">
            <b class=${i?"vh":""}>${n("qcApplyTo")}</b>
            <div class="seg" role="radiogroup" aria-label=${n("qcApplyTo")}>
              <button type="button" role="radio" aria-checked=${String(!s)} class=${x({on:!s})} data-ed-apply="area" @click=${()=>this.applyTo="area"}><sw-icon name="pin" size=${13}></sw-icon>${n("qcApplyArea")}</button>
              <button type="button" role="radio" aria-checked=${String(s)} class=${x({on:s})} data-ed-apply="site" ?disabled=${!a} @click=${()=>this.applyTo="site"}><sw-icon name="home" size=${13}></sw-icon>${n("qcApplySite")}</button>
            </div>
            ${s?r`<div class="sitewarn" data-ed-sitewarn><sw-icon name="warning" size=${13}></sw-icon><span>${n("qcSiteWarn")}</span></div>`:i?c:r`<small>${n("qcAreaNote",{name:e.name})}</small>`}
          </div>
          ${a?r`<div class="fld tgrow"><div><b>${n("qcAlertTitle")}</b>${i?c:r`<small>${this.alertDraft==="show"?n("qcAlertOn"):n("qcAlertOff")}</small>`}</div>
            <sw-toggle data-ed-alert .checked=${this.alertDraft==="show"} label=${n("qcAlertTitle")} labelHidden @change=${d=>this.alertDraft=d.detail.checked?"show":"hide"}></sw-toggle></div>`:c}
          ${i?c:r`<div class="fine"><sw-icon name="info" size=${13}></sw-icon><span>${n("qcFine")}</span></div>`}
        </aside>
      </div>
      ${je(t)?r`<div class="warn" data-ed-allhidden role="status"><sw-icon name="warning" size=${13}></sw-icon>${n("qcAllHiddenWarn")}</div>`:c}
      ${this.saveError?r`<div class="warn" data-ed-error role="alert">${this.saveError}</div>`:c}
      ${this.conflict?r`<div class="warn" data-ed-conflict role="alert"><span>${n("qcConflict")}</span><button type="button" class="qb" data-ed-reload @click=${()=>void this.reloadEdit()}>${n("qcReload")}</button><button type="button" class="qb main" data-ed-force @click=${()=>void this.saveEdit(!0)}>${n("qcOverwrite")}</button></div>`:c}
      <footer class="ed-foot">
        <button type="button" class="qb" data-ed-reset @click=${()=>this.confirmReset=!0}>${n("qcResetBtn")}</button>
        ${i?c:r`<span class="lockn"><sw-icon name="lock" size=${13}></sw-icon>${n("qcLockNote")}</span>`}
        <span class="grow"></span>
        <button type="button" class="qb" data-ed-cancel @click=${()=>this.cancelEdit()}>${n("qcCancel")}</button>
        <button type="button" class="qb pri" data-qc-ed-save ?disabled=${this.saving} @click=${()=>void this.saveEdit()}>${s?n("qcSaveSite"):n("qcSaveArea")}</button>
      </footer>
      ${this.confirmReset?r`<div class="cf-scrim" @click=${()=>this.confirmReset=!1}></div>
        <div class="cf" role="alertdialog" aria-labelledby="qc-cf-t" data-ed-confirm><h3 id="qc-cf-t">${n("qcResetTitle")}</h3><p>${s?n("qcResetBodySite"):n("qcResetBody")}</p>
          <div class="row2"><button type="button" class="qb" data-ed-confirm-no @click=${()=>this.confirmReset=!1}>${n("qcCancel")}</button><button type="button" class="qb pri" data-ed-confirm-yes @click=${()=>this.doReset()}>${n("qcResetGo")}</button></div></div>`:c}
    </div>`}get allCameras(){return U(t=>!$()||q(t)).cameras?(this.detail?.cards.security?.entities??[]).filter(t=>t.kind==="camera"&&t.available):[]}get cameras(){return E(this.allCameras,"cameras",this.layout,!1).rows.slice(0,4)}get layout(){return Le(this.opts.popup,this.area?.area_id)}get canEdit(){return this.mode!=="sheet"&&$()&&q("system.configure")&&!!this.area}itemRows(e){const t=this.detail;return e==="sensors"?_e(t?.cards.sensors,1/0):e==="cameras"?this.allCameras:Ee(t?.cards[e],W)}get alarmingHidden(){if(this.opts.popup_alert!=="show")return!1;const e=this.layout.items.sensors?.hidden??[];return this.itemRows("sensors").some(t=>e.includes(t.entity_id)&&J(t))}get availableSections(){const e=this.detail;return Te({cards:e?.cards??null,cameras:this.allCameras.length,scenes:this.scenes.length,schedules:this.schedules.length,events:this.events.length,canBulk:this.canBulk&&!!this.area&&(e?.can_bulk??!0)},W)}get sections(){const e=this.layout,t=this.opts.popup_alert==="show",i=Be(this.availableSections,e,this.alarmingHidden).filter(s=>!P.includes(s)||E(this.itemRows(s),s,e,t&&s==="sensors").rows.length>0);return this.mode==="sheet"&&this.detent==="peek"?Ae(i):i}render(){const e=this.area,t=e?.counts,i=!!t&&(t.lights_on>0||t.switches_on>0||t.climate_active>0||t.media_on>0),s=e?.temperature!==null&&e?.temperature!==void 0?_(`${e.temperature.toFixed(1)}°`):"",a=this.mode==="sheet"?this.detent==="full"?n("qcCollapse"):n("qcExpand"):this.expanded?n("qcCollapse"):n("qcExpand"),o=this.mode==="sheet"?this.detent==="full":this.expanded,l=Re(this.presence,this.areaPres);return r`<div class="scrim" data-qc-scrim @click=${()=>this.close()}></div>
      <section class="panel" role="dialog" aria-modal="true" aria-label=${e?.name??""} data-qc-panel data-qc-mode=${this.mode} data-qc-detent=${this.mode==="sheet"?this.detent:c} ?data-qc-expanded=${o}
        @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.onUp} @pointercancel=${this.onUp}>
        <button type="button" class="grab" aria-label=${n("qcGrab")} data-qc-grab @keydown=${this.onGrabKey} @click=${this.onGrabClick}></button>
        <header>
          <span class="ring" ?data-on=${i}><sw-icon .name=${this.icon} size=${20}></sw-icon></span>
          <div class="ttl">
            <h2><span class="hn">${e?y(e.name):""}</span>${this.editing?r`<span class="editing" data-qc-editing><sw-icon name="edit" size=${12}></sw-icon>${n("qcEditing")}</span>`:c}</h2>
            <span class="sub">${this.editing?r`<span class="ed-hint">${this.mode==="sheet"?n("qcEditHintPhone"):n("qcEditHintDesk")}</span>`:[this.floorName?r`<span>${y(this.floorName)}</span>`:"",s?r`<span><b>${s}</b></span>`:"",l.subWord?r`<span class="pres" data-qc-presence data-tone=${l.subWord.tone}><i aria-hidden="true"></i>${l.subWord.text}</span>`:"",t?r`<span>${_(t.entities)} ${n("qcDevicesLabel")}</span>`:""].filter(u=>u!=="").map((u,v)=>v?r` · ${u}`:u)}</span>
            ${this.editing?c:this.renderPresenceLine(l.line)}
          </div>
          <span class="acts">
            ${this.canEdit&&!this.editing?r`<button type="button" class="ib" data-qc-edit aria-label=${n("qcEditTitle")} title=${n("qcEditTitle")} @click=${()=>this.startEdit()}><sw-icon name="edit" size=${17}></sw-icon></button>`:c}
            <button type="button" class="ib" data-qc-expand aria-label=${a} title=${a} aria-pressed=${String(o)} @click=${()=>this.toggleExpand()}><sw-icon name="expand" size=${17}></sw-icon></button>
            ${e?r`<a class="ib" href=${`#/devices/areas/${encodeURIComponent(e.area_id)}`} data-qc-open-screen aria-label=${n("qcOpenScreen")} title=${n("qcOpenScreen")} @click=${u=>this.openScreen(u)}><sw-icon name="chevron" size=${17}></sw-icon></a>`:c}
            <button type="button" class="ib" data-qc-close aria-label=${n("close")} title=${n("close")} @click=${u=>{u.detail===0&&(this.closedByKey=!0),this.close()}}><sw-icon name="close" size=${18}></sw-icon></button>
          </span>
        </header>
        ${this.editing?this.renderEditor():r`<div class="body" data-qc-body><div class="cols">${this.renderBody()}</div></div>`}
      </section>`}renderPresenceLine(e){if(!e.show)return c;const t=e.names.length?r`${e.names.map((i,s)=>r`${s?", ":""}<bdi>${i}</bdi>`)}${e.rest>0?` ${C.andMore(e.rest)}`:""}`:e.people;return r`<span class="pline" data-qc-area-presence data-tone=${e.tone} role="status" aria-label=${C.areaLineAria} title=${e.title}>
      <sw-icon name="users" size=${14}></sw-icon><span class="plbl">${C.areaLineLabel}</span>
      ${e.room?r`<span class="psep" aria-hidden="true">·</span><b data-qc-area-presence-room>${e.room}</b>`:c}
      ${e.people?r`<span class="psep" aria-hidden="true">·</span><span class="pwho" data-qc-area-presence-people>${t}</span>`:c}
    </span>`}renderBody(){if(this.error&&!this.detail)return r`<div class="note" data-qc-error role="alert">${this.error}</div>`;if(!this.detail)return r`<div class="spin" role="status" aria-label="טוען"></div>`;const e=this.sections;return e.length?z(e,t=>t,t=>this.renderSection(t)):r`<div class="note" data-qc-empty>${this.availableSections.length?n("qcEmptyLayout"):n("qcEmpty")}</div>`}renderSection(e){if(e==="quick")return this.renderQuick();const t=s=>r`<div class="sh"><sw-icon .name=${tt[e]} size=${13}></sw-icon>${n(X[e])}<span class="n">${_(s)}</span></div>`;if(e==="sensors"){const s=E(this.itemRows("sensors"),"sensors",this.layout,this.opts.popup_alert==="show"),a=s.rows.slice(0,6);return r`<div class="sec" data-qc-section="sensors">${t(a.length)}<div class="sens">${a.map(o=>this.renderSensor(o,s.revealed.has(o.entity_id)))}</div></div>`}if(e==="cameras"){const s=this.cameras;return r`<div class="sec" data-qc-section="cameras">${t(s.length)}<div class="cams">${s.map(a=>r`<devices-camera-card .source=${{kind:"ha",entity_id:a.entity_id}} .title=${a.name} size="s"></devices-camera-card>`)}</div></div>`}if(e==="scenes")return r`<div class="sec" data-qc-section="scenes">${t(this.scenes.length)}<div class="scenes">${this.scenes.map(s=>r`<button type="button" class="scene" data-qc-scene=${s.id} ?data-busy=${this.sceneBusy===s.id} ?disabled=${!!this.sceneBusy} @click=${()=>void this.runScene(s)}><sw-icon name="play" size=${13}></sw-icon>${y(s.name)}</button>`)}</div></div>`;if(e==="schedules")return r`<div class="sec" data-qc-section="schedules">${t(this.schedules.length)}<div class="rows">${this.schedules.map(s=>r`<div class=${x({line:!0,off:!s.enabled})} data-qc-schedule=${s.id}><span class="dot" aria-hidden="true"></span><span class="nm">${y(s.display_name)}</span>${s.next_run?r`<span class="tm">${n("qcNext",{t:Y(s.next_run.at)})}</span>`:c}</div>`)}</div></div>`;if(e==="events")return r`<div class="sec" data-qc-section="events">${t(this.events.length)}<div class="rows">${this.events.map(s=>r`<div class="line" data-qc-event=${s.id}><sw-icon name="camera" size=${13}></sw-icon><span class="nm">${De[s.type]??s.type}${s.camera_name?` · ${y(s.camera_name)}`:""}</span><span class="tm">${Y(s.occurred_at)}</span></div>`)}</div></div>`;const i=E(this.itemRows(e),e,this.layout,!1).rows;return r`<div class="sec" data-qc-section=${e}>${t(i.length)}<div class="rows">${z(i,s=>s.entity_id,s=>this.renderRow(s,e))}</div></div>`}renderQuick(){const e=this.area.counts,t=this.offline,i=(s,a,o,l=!1)=>r`<button type="button" class=${x({qb:!0,main:l})} data-qc-quick=${s} ?disabled=${t} @click=${()=>this.bulk(s)}><sw-icon .name=${o} size=${14}></sw-icon>${a}</button>`;return r`<div class="quick" data-qc-section="quick">
      ${e.lights_on>0?i("lights_off",n("qcLightsOff"),"light"):c}
      ${i("all_off",n("qcOffNow"),"power",!0)}
      ${e.covers>0?r`${i("covers_open",n("coversOpen"),"arrowUp")}${i("covers_close",n("coversClose"),"arrowDown")}`:c}
      ${e.climate_active>0?i("climate_off",`${n("qClimate")} · ${n("climateOff")}`,"snow"):c}
    </div>`}renderSensor(e,t=!1){const i=e.domain==="sensor"&&e.value!==null&&e.value!==void 0?`${_(Number.isInteger(e.value)?e.value:e.value.toFixed(1))}${e.unit?` ${e.unit}`:""}`:O(e);return r`<div class=${x({sv:!0,alarm:t})} data-qc-sensor=${e.entity_id} data-qc-alarm=${t?"true":c} title=${t?`${e.name} - ${n("qcRevealed")}`:e.name}><b>${i}</b><span>${y(e.name)}</span>${t?r`<em>${n("qcRevealed")}</em>`:c}</div>`}renderRow(e,t){const i=t==="lighting"||t==="switches",s=i?this.ctl.shownRow(e):e,a=s.active&&s.available&&s.state!=="unavailable",o=t==="lighting"?"light":t==="switches"?"bolt":t==="climate"?"snow":t==="heating"?"flame":t==="covers"?"layers":"play",l=t==="climate"&&s.domain==="climate"?`${O(s)} · ${G(s.current_temperature)}${s.target_temperature!==null&&s.target_temperature!==void 0?` · יעד ${G(s.target_temperature)}`:""}`:O(s);return r`<div class=${x({row:!0,on:a,pending:this.ctl.rowPendingVisible(s.entity_id)})} data-qc-row=${s.entity_id} data-card=${t} data-active=${String(a)}>
      <sw-icon .name=${o} size=${16}></sw-icon>
      <span class="nm">${y(s.name)}</span>
      <span class="st">${l}</span>
      ${i?r`<span class="ct">${this.ctl.renderPowerToggle(s)}</span>`:c}
      ${i&&t==="lighting"&&Ce(s)&&(a||this.ctl.live(s.entity_id,"power")===!0)&&s.brightness_pct!==void 0?this.ctl.renderBrightnessSlider(s):c}
      ${t==="climate"||t==="heating"?this.ctl.renderClimateControls(s):c}
      ${t==="covers"?this.ctl.renderCoverControls(s):c}
      ${t==="media"?this.ctl.renderMediaControls(s):c}
      ${this.ctl.renderCmdStatus(s.entity_id)}
    </div>`}};p.styles=Ve;h([b({attribute:!1})],p.prototype,"area",2);h([b()],p.prototype,"floorName",2);h([b({attribute:!1})],p.prototype,"presence",2);h([b()],p.prototype,"icon",2);h([b({reflect:!0})],p.prototype,"mode",2);h([b({type:Boolean,reflect:!0})],p.prototype,"open",2);h([b({attribute:!1})],p.prototype,"origin",2);h([b({type:Boolean})],p.prototype,"canBulk",2);h([b({type:Boolean})],p.prototype,"offline",2);h([m()],p.prototype,"expanded",2);h([m()],p.prototype,"detent",2);h([m()],p.prototype,"detail",2);h([m()],p.prototype,"error",2);h([m()],p.prototype,"scenes",2);h([m()],p.prototype,"schedules",2);h([m()],p.prototype,"events",2);h([m()],p.prototype,"sceneBusy",2);h([m()],p.prototype,"areaPres",2);h([m()],p.prototype,"opts",2);h([m()],p.prototype,"editing",2);h([m()],p.prototype,"draft",2);h([m()],p.prototype,"applyTo",2);h([m()],p.prototype,"alertDraft",2);h([m()],p.prototype,"openSec",2);h([m()],p.prototype,"moreItems",2);h([m()],p.prototype,"confirmReset",2);h([m()],p.prototype,"saving",2);h([m()],p.prototype,"saveError",2);h([m()],p.prototype,"conflict",2);p=h([Ie("area-quick-sheet")],p);export{p as AreaQuickSheet,et as SHEET_RELOAD_WINDOW_MS};
