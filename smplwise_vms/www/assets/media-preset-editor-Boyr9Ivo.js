import{j as w,z as k,k as p,a as $,dd as u,dZ as g,c as x,b as n,A as v,cL as i,bo as _,aj as b,m as z}from"./index-CoJbESCx.js";import{N as h,e as y,f as E,g as f,h as P,P as j}from"./multimedia-players-layout-CRbZssu_.js";var O=Object.defineProperty,C=Object.getOwnPropertyDescriptor,d=(e,r,t,s)=>{for(var a=s>1?void 0:s?C(r,t):r,o=e.length-1,c;o>=0;o--)(c=e[o])&&(a=(s?c(r,t,a):c(a))||a);return s&&a&&O(r,t,a),a};const D=e=>e?{id:e.id,revision:e.revision,name:e.name,leader_key:e.leader_key,member_keys:[...new Set([e.leader_key,...e.member_keys])],volumes:e.volumes?{...e.volumes}:null}:{...h};let l=class extends ${constructor(){super(...arguments),this.devices=[],this.open=!1,this.draft={...h},this.busy=!1,this.error=""}show(e){this.draft={...e,member_keys:[...e.member_keys],volumes:e.volumes?{...e.volumes}:null},this.error="",this.busy=!1,this.open=!0}set(e){this.draft={...this.draft,...e},this.error=""}toggle(e,r){const t=this.draft,s=r?[...new Set([...t.member_keys,e])]:t.member_keys.filter(o=>o!==e),a=s.includes(t.leader_key)?t.leader_key:s[0]??"";this.set({member_keys:s,leader_key:a,volumes:y({leader_key:a,member_keys:s,volumes:t.volumes})})}setVolume(e,r){const t=E(r),s={...this.draft.volumes??{}};t===null||t==="invalid"?delete s[e]:s[e]=t,this.set({volumes:Object.keys(s).length?s:null})}async save(){const e=this.draft,r=f(e);if(r){this.error=r;return}this.busy=!0;const t={name:e.name.trim(),leader_key:e.leader_key,member_keys:e.member_keys.filter(s=>s!==e.leader_key),volumes:y(e)};try{const s=e.id?await u().savePreset(e.id,t,e.revision):await u().createPreset(t);this.open=!1,this.busy=!1,this.dispatchEvent(new CustomEvent("preset-saved",{detail:s,bubbles:!0,composed:!0}))}catch(s){this.error=g(s),this.busy=!1,s instanceof x&&s.code==="revision_conflict"&&this.dispatchEvent(new CustomEvent("preset-stale",{bubbles:!0,composed:!0}))}}render(){if(!this.open)return n`<sw-dialog data-preset-editor="closed"></sw-dialog>`;const e=this.draft,r=P(this.devices,e.member_keys),t=f(e);return n`<sw-dialog open ?locked=${this.busy} heading=${e.id?i("עריכת קבוצה שמורה"):i("קבוצה שמורה חדשה")} data-preset-editor="open" @close=${()=>this.open=!1}>
      <div class="ed">
        <input type="text" data-pe-name maxlength=${j} placeholder=${i("שם הקבוצה")} aria-label=${i("שם הקבוצה")} .value=${e.name} @input=${s=>this.set({name:s.target.value})} />
        <div class="list" role="group" aria-label=${i("חדרים")}>
          ${_(r,s=>s.device.key,({device:s,disabled:a})=>{const o=e.member_keys.includes(s.key),c=[s.area_name,s.floor_name].filter(Boolean).join(" · ")||i("ללא חדר");return n`<div class=${a?"row off":"row"} data-pe-row=${s.key}>
              <input type="checkbox" .checked=${o} ?disabled=${a} aria-label=${s.name} @change=${m=>this.toggle(s.key,m.target.checked)} />
              <span class="nm"><b>${b(s.name)}</b><small>${b(c)}${s.live.power==="unavailable"?` · ${i("לא זמין")}`:""}</small></span>
              ${o?n`<label class="lead"><input type="radio" name="lead" .checked=${e.leader_key===s.key} @change=${()=>this.set({leader_key:s.key})} />${i("מוביל")}</label>
                <input type="number" min="0" max="100" data-pe-vol=${s.key} placeholder=${i("עוצמה")} aria-label=${`${i("עוצמה")} · ${s.name}`} .value=${e.volumes?.[s.key]===void 0?"":String(e.volumes[s.key])} @change=${m=>this.setVolume(s.key,m.target.value)} />`:v}
            </div>`})}
        </div>
        ${this.error?n`<div class="err" role="alert" data-pe-error>${this.error}</div>`:t&&e.name?n`<div class="why" data-pe-why>${t}</div>`:v}
        <div class="actions"><sw-button data-pe-cancel ?disabled=${this.busy} @click=${()=>this.open=!1}>${i("ביטול")}</sw-button><sw-button variant="primary" data-pe-save ?disabled=${this.busy||!!t} @click=${()=>void this.save()}>${i("שמור")}</sw-button></div>
      </div>
    </sw-dialog>`}};l.styles=w`
    .ed {
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-size: var(--sw-fs-sm);
    }
    input[type='text'],
    input[type='number'] {
      box-sizing: border-box;
      min-block-size: 44px;
      padding-inline: 12px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
    }
    input[type='text'] {
      inline-size: 100%;
    }
    input[type='number'] {
      inline-size: 84px;
      min-block-size: 40px;
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-block-size: 300px;
      overflow: auto;
    }
    .row {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto auto;
      align-items: center;
      gap: 10px;
      min-block-size: 48px;
      padding: 4px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
    }
    .row.off {
      opacity: 0.5;
    }
    .row input[type='checkbox'] {
      inline-size: 22px;
      block-size: 22px;
      accent-color: var(--sw-accent);
    }
    .row .nm {
      display: flex;
      flex-direction: column;
      min-inline-size: 0;
    }
    .row .nm b {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row .nm small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .lead {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-block-size: 44px;
    }
    .lead input {
      inline-size: 20px;
      block-size: 20px;
      accent-color: var(--sw-accent);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .why {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding-block-start: 4px;
    }
  `;d([k({attribute:!1})],l.prototype,"devices",2);d([p()],l.prototype,"open",2);d([p()],l.prototype,"draft",2);d([p()],l.prototype,"busy",2);d([p()],l.prototype,"error",2);l=d([z("media-preset-editor")],l);export{D as d};
