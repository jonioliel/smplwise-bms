import{ct as o,cu as c,cv as t,cw as T,cx as n,A as a,cy as l}from"./index-c_ii2C2N.js";/**
 * @license
 * Copyright 2020 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */const u=o(class extends c{constructor(e){if(super(e),e.type!==t.PROPERTY&&e.type!==t.ATTRIBUTE&&e.type!==t.BOOLEAN_ATTRIBUTE)throw Error("The `live` directive is not allowed on child or event bindings");if(!T(e))throw Error("`live` bindings can only contain a single expression")}render(e){return e}update(e,[r]){if(r===n||r===a)return r;const s=e.element,i=e.name;if(e.type===t.PROPERTY){if(r===s[i])return n}else if(e.type===t.BOOLEAN_ATTRIBUTE){if(!!r===s.hasAttribute(i))return n}else if(e.type===t.ATTRIBUTE&&s.getAttribute(i)===r+"")return n;return l(e),r}});export{u as l};
