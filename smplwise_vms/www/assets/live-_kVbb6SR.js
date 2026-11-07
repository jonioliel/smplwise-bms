import{hK as o,hL as T,hM as t,hN as a,hO as n,A as l,hP as p}from"./index-B6b85WR9.js";/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const u=o(class extends T{constructor(e){if(super(e),e.type!==t.PROPERTY&&e.type!==t.ATTRIBUTE&&e.type!==t.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!a(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[r]){if(r===n||r===l)return r;const s=e.element,i=e.name;if(e.type===t.PROPERTY){if(r===s[i])return n}else if(e.type===t.BOOLEAN_ATTRIBUTE){if(!!r===s.hasAttribute(i))return n}else if(e.type===t.ATTRIBUTE&&s.getAttribute(i)===r+"")return n;return p(e),r}});export{u as l};
//# sourceMappingURL=live-_kVbb6SR.js.map
