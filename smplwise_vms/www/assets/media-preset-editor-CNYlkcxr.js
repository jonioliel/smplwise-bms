import{E as h,F as w,G as c,a as k,cM as m,hq as g,j as x,e as l,A as u,bw as _,q as v,H as $}from"./index-TwIAG38v.js";import{N as f,q as b,u as z,v as y,x as E,y as P}from"./multimedia-players-layout-DKw9-Otu.js";var j=Object.defineProperty,O=Object.getOwnPropertyDescriptor,n=(e,r,t,s)=>{for(var a=s>1?void 0:s?O(r,t):r,i=e.length-1,d;i>=0;i--)(d=e[i])&&(a=(s?d(r,t,a):d(a))||a);return s&&a&&j(r,t,a),a};const A=e=>e?{id:e.id,revision:e.revision,name:e.name,leader_key:e.leader_key,member_keys:[...new Set([e.leader_key,...e.member_keys])],volumes:e.volumes?{...e.volumes}:null}:{...f};let o=class extends k{constructor(){super(...arguments),this.devices=[],this.open=!1,this.draft={...f},this.busy=!1,this.error=""}show(e){this.draft={...e,member_keys:[...e.member_keys],volumes:e.volumes?{...e.volumes}:null},this.error="",this.busy=!1,this.open=!0}set(e){this.draft={...this.draft,...e},this.error=""}toggle(e,r){const t=this.draft,s=r?[...new Set([...t.member_keys,e])]:t.member_keys.filter(i=>i!==e),a=s.includes(t.leader_key)?t.leader_key:s[0]??"";this.set({member_keys:s,leader_key:a,volumes:b({leader_key:a,member_keys:s,volumes:t.volumes})})}setVolume(e,r){const t=z(r),s={...this.draft.volumes??{}};t===null||t==="invalid"?delete s[e]:s[e]=t,this.set({volumes:Object.keys(s).length?s:null})}async save(){const e=this.draft,r=y(e);if(r){this.error=r;return}this.busy=!0;const t={name:e.name.trim(),leader_key:e.leader_key,member_keys:e.member_keys.filter(s=>s!==e.leader_key),volumes:b(e)};try{const s=e.id?await m().savePreset(e.id,t,e.revision):await m().createPreset(t);this.open=!1,this.busy=!1,this.dispatchEvent(new CustomEvent("preset-saved",{detail:s,bubbles:!0,composed:!0}))}catch(s){this.error=g(s),this.busy=!1,s instanceof x&&s.code==="revision_conflict"&&this.dispatchEvent(new CustomEvent("preset-stale",{bubbles:!0,composed:!0}))}}render(){if(!this.open)return l`<sw-dialog data-preset-editor="closed"></sw-dialog>`;const e=this.draft,r=E(this.devices,e.member_keys),t=y(e);return l`<sw-dialog open ?locked=${this.busy} heading=${e.id?"עריכת קבוצה שמורה":"קבוצה שמורה חדשה"} data-preset-editor="open" @close=${()=>this.open=!1}>
      <div class="ed">
        <input type="text" data-pe-name maxlength=${P} placeholder="שם הקבוצה" aria-label="שם הקבוצה" .value=${e.name} @input=${s=>this.set({name:s.target.value})} />
        <div class="list" role="group" aria-label="חדרים">
          ${_(r,s=>s.device.key,({device:s,disabled:a})=>{const i=e.member_keys.includes(s.key),d=[s.area_name,s.floor_name].filter(Boolean).join(" · ")||"ללא חדר";return l`<div class=${a?"row off":"row"} data-pe-row=${s.key}>
              <input type="checkbox" .checked=${i} ?disabled=${a} aria-label=${s.name} @change=${p=>this.toggle(s.key,p.target.checked)} />
              <span class="nm"><b>${v(s.name)}</b><small>${v(d)}${s.live.power==="unavailable"?" · לא זמין":""}</small></span>
              ${i?l`<label class="lead"><input type="radio" name="lead" .checked=${e.leader_key===s.key} @change=${()=>this.set({leader_key:s.key})} />מוביל</label>
                <input type="number" min="0" max="100" data-pe-vol=${s.key} placeholder="עוצמה" aria-label=${`עוצמה · ${s.name}`} .value=${e.volumes?.[s.key]===void 0?"":String(e.volumes[s.key])} @change=${p=>this.setVolume(s.key,p.target.value)} />`:u}
            </div>`})}
        </div>
        ${this.error?l`<div class="err" role="alert" data-pe-error>${this.error}</div>`:t&&e.name?l`<div class="why" data-pe-why>${t}</div>`:u}
        <div class="actions"><sw-button data-pe-cancel ?disabled=${this.busy} @click=${()=>this.open=!1}>ביטול</sw-button><sw-button variant="primary" data-pe-save ?disabled=${this.busy||!!t} @click=${()=>void this.save()}>שמור</sw-button></div>
      </div>
    </sw-dialog>`}};o.styles=h`
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
  `;n([w({attribute:!1})],o.prototype,"devices",2);n([c()],o.prototype,"open",2);n([c()],o.prototype,"draft",2);n([c()],o.prototype,"busy",2);n([c()],o.prototype,"error",2);o=n([$("media-preset-editor")],o);export{A as d};
//# sourceMappingURL=media-preset-editor-CNYlkcxr.js.map
