import{cB as o,cC as c,cD as t,cE as T,cF as n,A as a,cG as l}from"./index-CqeTnh_F.js";/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const E=o(class extends c{constructor(e){if(super(e),e.type!==t.PROPERTY&&e.type!==t.ATTRIBUTE&&e.type!==t.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!T(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[r]){if(r===n||r===a)return r;const s=e.element,i=e.name;if(e.type===t.PROPERTY){if(r===s[i])return n}else if(e.type===t.BOOLEAN_ATTRIBUTE){if(!!r===s.hasAttribute(i))return n}else if(e.type===t.ATTRIBUTE&&s.getAttribute(i)===r+"")return n;return l(e),r}});export{E as l};
