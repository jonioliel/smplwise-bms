import { css } from 'lit';

/**
 * Bubble on the list and chrome screens (0.1.157, TASK_QUEUE item 4; after the home / area / multimedia screens of 0.1.154).
 *
 * The security screens (live, investigation, alarm), the device lists, the automations lists and the settings screens keep
 * their STRUCTURE: video, map, 3D plan, timeline and dense tables are not redesigned. Only their chrome follows the skin here:
 * the local segmented controls become pill tracks with a solid thumb (the same language as sw-tabs' pill variant), the
 * bordered boxes and rows lose the hairline the bubble skin has no colour for (`--sw-border` is transparent there) and sit as
 * flat layers instead, separator lines keep a faint strong-border colour, the inputs become pill fields, every control meets
 * the touch dial, and nothing sticks over the rows (the sticky action bars become static: the owner's "nothing floating over
 * content" rule and the layout guard). Every rule is keyed on the host's `data-skin`, mirrored by design/skin.ts
 * SkinController; the classic, domus and tesla skins are untouched. Tokens only - a palette changes everything below.
 *
 * Shared by many screens, so the selectors are the recurring class names of those screens (documented per group). A screen
 * that needs more adds its own `:host([data-skin='bubble'])` rules next to it; nothing here changes order, content or state.
 */
export const bubbleChrome = css`
  /* 1. segmented controls (.layouts live wall, .rangepick events, .transport camera, .seg / .kseg settings and schedules,
        .switcher alarm, .pages audit, .range look, .sevseg notifications): a pill track, pill segments, a solid thumb */
  :host([data-skin='bubble']) .layouts,
  :host([data-skin='bubble']) .rangepick,
  :host([data-skin='bubble']) .transport,
  :host([data-skin='bubble']) .seg,
  :host([data-skin='bubble']) .kseg,
  :host([data-skin='bubble']) .switcher,
  :host([data-skin='bubble']) .pages,
  :host([data-skin='bubble']) .range,
  :host([data-skin='bubble']) .sevseg {
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    padding: 3px;
    gap: 2px;
    box-shadow: none;
  }
  :host([data-skin='bubble']) .layouts button,
  :host([data-skin='bubble']) .rangepick button,
  :host([data-skin='bubble']) .transport button,
  :host([data-skin='bubble']) .seg button,
  :host([data-skin='bubble']) .kseg button,
  :host([data-skin='bubble']) .switcher button,
  :host([data-skin='bubble']) .pages button,
  :host([data-skin='bubble']) .range button,
  :host([data-skin='bubble']) .sevseg button {
    border: 0;
    border-radius: var(--sw-r-pill);
    min-block-size: calc(var(--sw-touch-desktop, 44px) - 6px);
    min-inline-size: calc(var(--sw-touch-desktop, 44px) - 6px);
    box-shadow: none;
    background: transparent;
  }
  :host([data-skin='bubble']) .layouts button.on,
  :host([data-skin='bubble']) .rangepick button.on,
  :host([data-skin='bubble']) .transport button.on,
  :host([data-skin='bubble']) .pages button.on,
  :host([data-skin='bubble']) .seg button[aria-pressed='true'],
  :host([data-skin='bubble']) .seg button[aria-checked='true'],
  :host([data-skin='bubble']) .seg button[aria-selected='true'],
  :host([data-skin='bubble']) .kseg button[aria-selected='true'],
  :host([data-skin='bubble']) .switcher button[aria-pressed='true'],
  :host([data-skin='bubble']) .range button[aria-pressed='true'],
  :host([data-skin='bubble']) .sevseg button[aria-pressed='true'] {
    background: var(--sw-surface-solid);
    color: var(--sw-accent-text);
    box-shadow: var(--sw-shadow-2);
  }
  /* 2. chip-like toggles and small round buttons that are not sw-chip / sw-button (.chips alarm filters, .rc / .colbtn / .dc
        pickers, .stepper, .pillsel, .ib icon buttons, .mv / .more / .eyeb / .zoom / .round / .keys): pills, no hairline, the touch dial */
  :host([data-skin='bubble']) .chips button,
  :host([data-skin='bubble']) .colbtn,
  :host([data-skin='bubble']) .rc,
  :host([data-skin='bubble']) .pillsel,
  :host([data-skin='bubble']) .stepper,
  :host([data-skin='bubble']) .stepper button,
  :host([data-skin='bubble']) .ib,
  :host([data-skin='bubble']) .reset,
  :host([data-skin='bubble']) .zoom button,
  :host([data-skin='bubble']) .keys button,
  :host([data-skin='bubble']) .settings-move button {
    border-color: transparent;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    box-shadow: none;
  }
  /* a pressed chip keeps a filled state (shape + text, never a colour alone: the pressed one is also the solid one) */
  :host([data-skin='bubble']) .chips button[aria-pressed='true'],
  :host([data-skin='bubble']) .colbtn.on,
  :host([data-skin='bubble']) .rc[aria-pressed='true'],
  :host([data-skin='bubble']) .dc[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  :host([data-skin='bubble']) .chips button,
  :host([data-skin='bubble']) .colbtn,
  :host([data-skin='bubble']) .rc,
  :host([data-skin='bubble']) .ib,
  :host([data-skin='bubble']) .mv,
  :host([data-skin='bubble']) .more,
  :host([data-skin='bubble']) .eyeb,
  :host([data-skin='bubble']) .dc,
  :host([data-skin='bubble']) .zoom button,
  :host([data-skin='bubble']) .round button,
  :host([data-skin='bubble']) .keys button,
  :host([data-skin='bubble']) .stepper button,
  :host([data-skin='bubble']) .settings-move button,
  :host([data-skin='bubble']) .pages button,
  :host([data-skin='bubble']) .link,
  :host([data-skin='bubble']) .linkbtn,
  :host([data-skin='bubble']) button.link {
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
  }
  /* 3. bordered boxes and list items (.wrow events, .item / .files / .add cases, .settings-row wall, .evl a history, .acc-root
        camera, .hcard / .brow diagnostics, .zone alarm, .skin / button.opt / li pickers, .ib, .step wizard, .map detail,
        pre.report, .preview tabs-mode, .card / .tbl / .list / .kpi / .wrap lists): no hairline, a flat layer, soft corners */
  :host([data-skin='bubble']) .wrow,
  :host([data-skin='bubble']) .item,
  :host([data-skin='bubble']) .files,
  :host([data-skin='bubble']) .settings-row,
  :host([data-skin='bubble']) .evl a,
  :host([data-skin='bubble']) .acc-root,
  :host([data-skin='bubble']) .hcard,
  :host([data-skin='bubble']) .brow,
  :host([data-skin='bubble']) .zone,
  :host([data-skin='bubble']) .skin,
  :host([data-skin='bubble']) button.opt,
  :host([data-skin='bubble']) .step,
  :host([data-skin='bubble']) .map,
  :host([data-skin='bubble']) pre.report,
  :host([data-skin='bubble']) details.unpaired,
  :host([data-skin='bubble']) .note-in,
  :host([data-skin='bubble']) .confirm-in,
  :host([data-skin='bubble']) .swatch,
  :host([data-skin='bubble']) .verdict {
    border-color: transparent;
    border-radius: var(--sw-r-md);
    background: var(--sw-layer);
    box-shadow: none;
  }
  :host([data-skin='bubble']) .card,
  :host([data-skin='bubble']) .tbl,
  :host([data-skin='bubble']) .list,
  :host([data-skin='bubble']) .kpi,
  :host([data-skin='bubble']) .wrap,
  :host([data-skin='bubble']) .stage,
  :host([data-skin='bubble']) .empty,
  :host([data-skin='bubble']) .skel-card,
  :host([data-skin='bubble']) .summary,
  :host([data-skin='bubble']) .rail {
    border-color: transparent;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    box-shadow: none;
  }
  :host([data-skin='bubble']) .hcard.error,
  :host([data-skin='bubble']) .item[data-preservation='missing'],
  :host([data-skin='bubble']) .verdict[data-ok='false'] {
    box-shadow: inset 0 0 0 2px var(--sw-danger);
  }
  :host([data-skin='bubble']) .hcard.warn {
    box-shadow: inset 0 0 0 2px var(--sw-stale);
  }
  :host([data-skin='bubble']) .evl a.hit,
  :host([data-skin='bubble']) .card.picked,
  :host([data-skin='bubble']) .skin[aria-pressed='true'],
  :host([data-skin='bubble']) button.opt[aria-pressed='true'],
  :host([data-skin='bubble']) .swatch[aria-pressed='true'],
  :host([data-skin='bubble']) li.dragging {
    box-shadow: inset 0 0 0 2px var(--sw-accent);
  }
  /* 4. separator rows (.row settings, .ev / .spot / .hrow overview, .job exports, .recent sync, .li / .tr schedules, .dev / .ep /
        .frow / .sec multimedia, .policy / .tbl .r storage, .check / .fact setup and wizard, .bind / .eff .row access, .rev / .tpl,
        .stream, .corr .link, .dryrow / .dry rules, .note cases, .effective li, .srow, table cells): the hairline stays visible */
  :host([data-skin='bubble']) .row,
  :host([data-skin='bubble']) .ev,
  :host([data-skin='bubble']) .spot,
  :host([data-skin='bubble']) .hrow,
  :host([data-skin='bubble']) .job,
  :host([data-skin='bubble']) .recent,
  :host([data-skin='bubble']) .li,
  :host([data-skin='bubble']) .tr,
  :host([data-skin='bubble']) .dev,
  :host([data-skin='bubble']) .ep,
  :host([data-skin='bubble']) .frow,
  :host([data-skin='bubble']) .sec,
  :host([data-skin='bubble']) .policy,
  :host([data-skin='bubble']) .tbl .r,
  :host([data-skin='bubble']) .tbl .h,
  :host([data-skin='bubble']) .check,
  :host([data-skin='bubble']) .fact,
  :host([data-skin='bubble']) .bind,
  :host([data-skin='bubble']) .rev,
  :host([data-skin='bubble']) .tpl,
  :host([data-skin='bubble']) .stream,
  :host([data-skin='bubble']) .corr .link,
  :host([data-skin='bubble']) .dryrow,
  :host([data-skin='bubble']) .dry,
  :host([data-skin='bubble']) .note,
  :host([data-skin='bubble']) .effective li,
  :host([data-skin='bubble']) .srow,
  :host([data-skin='bubble']) .swatches,
  :host([data-skin='bubble']) .syshead,
  :host([data-skin='bubble']) .files .r,
  :host([data-skin='bubble']) .card footer,
  :host([data-skin='bubble']) td,
  :host([data-skin='bubble']) th {
    border-color: color-mix(in srgb, var(--sw-border-strong) 55%, transparent);
  }
  /* 5. fields (the screens' own inputs and selects; sw-field's are slotted and dressed by the skin sheet): pill fields on the
        second surface, the touch dial; checkboxes, radios, colour wells and ranges keep their native drawing */
  :host([data-skin='bubble']) input:not([type='checkbox']):not([type='radio']):not([type='color']):not([type='range']):not([type='file']),
  :host([data-skin='bubble']) select,
  :host([data-skin='bubble']) textarea {
    border-color: transparent;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    box-shadow: none;
    min-block-size: var(--sw-touch-desktop, 44px);
    box-sizing: border-box;
  }
  :host([data-skin='bubble']) textarea {
    border-radius: var(--sw-r-md);
  }
  :host([data-skin='bubble']) input:focus-visible,
  :host([data-skin='bubble']) select:focus-visible,
  :host([data-skin='bubble']) textarea:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 1px;
  }
  /* 6. nothing sticks over the rows in this skin (the sticky save / bulk bars of the settings and list screens become the last
        row; the layout guard's "floating" class) */
  :host([data-skin='bubble']) .bulk,
  :host([data-skin='bubble']) .bar,
  :host([data-skin='bubble']) .actions.bulk,
  :host([data-skin='bubble']) .setnav,
  :host([data-skin='bubble']) .savebar {
    position: static;
  }
  /* 7. the banners / notices and the icon squares: soft corners of the skin */
  :host([data-skin='bubble']) .banner,
  :host([data-skin='bubble']) .notice,
  :host([data-skin='bubble']) .impact,
  :host([data-skin='bubble']) .warn,
  :host([data-skin='bubble']) .strip,
  :host([data-skin='bubble']) .problem,
  :host([data-skin='bubble']) .ready,
  :host([data-skin='bubble']) .remote-off,
  :host([data-skin='bubble']) .err.banner {
    border-radius: var(--sw-r-md);
    border-color: transparent;
  }
  :host([data-skin='bubble']) .thumb img,
  :host([data-skin='bubble']) .thumb.none,
  :host([data-skin='bubble']) .cam img.snap,
  :host([data-skin='bubble']) .cam .none,
  :host([data-skin='bubble']) .pick img,
  :host([data-skin='bubble']) .res .pic,
  :host([data-skin='bubble']) .clip,
  :host([data-skin='bubble']) .frame,
  :host([data-skin='bubble']) .item .thumb {
    border-radius: var(--sw-r-sm);
  }
  /* touch layouts: 44 px whatever the desktop dial says (the dial is a desktop choice) */
  @media (max-width: 1100px) {
    :host([data-skin='bubble']) .layouts button,
    :host([data-skin='bubble']) .rangepick button,
    :host([data-skin='bubble']) .transport button,
    :host([data-skin='bubble']) .seg button,
    :host([data-skin='bubble']) .kseg button,
    :host([data-skin='bubble']) .switcher button,
    :host([data-skin='bubble']) .pages button,
    :host([data-skin='bubble']) .range button,
    :host([data-skin='bubble']) .sevseg button {
      min-block-size: 38px;
      min-inline-size: 38px;
    }
    :host([data-skin='bubble']) .chips button,
    :host([data-skin='bubble']) .colbtn,
    :host([data-skin='bubble']) .rc,
    :host([data-skin='bubble']) .ib,
    :host([data-skin='bubble']) .mv,
    :host([data-skin='bubble']) .more,
    :host([data-skin='bubble']) .eyeb,
    :host([data-skin='bubble']) .dc,
    :host([data-skin='bubble']) .zoom button,
    :host([data-skin='bubble']) .round button,
    :host([data-skin='bubble']) .keys button,
    :host([data-skin='bubble']) .stepper button,
    :host([data-skin='bubble']) .settings-move button,
    :host([data-skin='bubble']) .link,
    :host([data-skin='bubble']) .linkbtn,
    :host([data-skin='bubble']) button.link,
    :host([data-skin='bubble']) input:not([type='checkbox']):not([type='radio']):not([type='color']):not([type='range']):not([type='file']),
    :host([data-skin='bubble']) select,
    :host([data-skin='bubble']) textarea {
      min-block-size: 44px;
      min-inline-size: 44px;
    }
  }
`;
