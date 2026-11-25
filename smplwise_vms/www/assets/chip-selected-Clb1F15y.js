import{by as e,bz as r,g as c}from"./index-BMsqo0rz.js";const t=c`
  .rc[aria-pressed='true'],
  .rc[aria-checked='true'],
  .rooms .rc[aria-pressed='true'],
  .fchips .rc[aria-pressed='true'],
  .fchips .rc[aria-checked='true'],
  .prio .rc[aria-checked='true'],
  .pop button.rc[aria-pressed='true'],
  .pop button.rc[aria-pressed='true']:hover {
    ${e}
  }
  /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
  .rc[aria-pressed='true']::before,
  .rc[aria-checked='true']::before,
  .rooms .rc[aria-pressed='true']::before,
  .fchips .rc[aria-pressed='true']::before,
  .fchips .rc[aria-checked='true']::before,
  .prio .rc[aria-checked='true']::before,
  .pop button.rc[aria-pressed='true']::before {
    ${r}
  }
  .rc[aria-pressed='true'] small,
  .rc[aria-checked='true'] small {
    background: color-mix(in srgb, var(--sw-accent-text) 14%, transparent);
    color: var(--sw-accent-text);
  }
`;export{t};
