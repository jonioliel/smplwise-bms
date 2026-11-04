import{it as o,iu as T,iv as t,iw as a,ix as i,A as l,iy as p}from"./index-Dspqd-4d.js";/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=o(class extends T{constructor(e){if(super(e),e.type!==t.PROPERTY&&e.type!==t.ATTRIBUTE&&e.type!==t.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!a(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[r]){if(r===i||r===l)return r;const n=e.element,s=e.name;if(e.type===t.PROPERTY){if(r===n[s])return i}else if(e.type===t.BOOLEAN_ATTRIBUTE){if(!!r===n.hasAttribute(s))return i}else if(e.type===t.ATTRIBUTE&&n.getAttribute(s)===r+"")return i;return p(e),r}});export{E as l};
//# sourceMappingURL=live-DMBlOOpL.js.map
