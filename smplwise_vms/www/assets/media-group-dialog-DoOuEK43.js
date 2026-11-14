import{hr as q,hs as R,ht as v,i as P,ho as E,j as y,au as b,hp as O,hu as k,e8 as S,hv as C,E as D,G as u,a as z,e5 as w,$ as A,Y as L,e as a,q as c,A as m,ed as T,H as j}from"./index-k1cto_iv.js";import{h as M,b as I}from"./media-now-C0pZ-8dG.js";import{s as N}from"./multimedia-players-layout-C1cWtn5Y.js";const B=600,F=e=>new Promise(s=>setTimeout(s,e));function G(e){return e instanceof y?{code:e.code,message:b(e)||(v[e.code]??e.body.user_message??"הפעולה נכשלה")}:{code:null,message:"אין חיבור לשרת"}}async function U(e,s,r,t){let i;try{i=await q(e,s)}catch(n){const h=t&&s.confirmed!==!0?R(n):null;if(h)return await t(h)?U(e,{...s,confirmed:!0}):{outcome:"refused",message:"",code:"cancelled"};const{code:p,message:f}=G(n);return{outcome:p==="rate_limited"?"rate_limited":"refused",message:f,code:p}}if(i.status==="refused")return{outcome:"refused",message:i.error&&v[i.error]||"הנגן דחה את הפקודה",code:i.error};if(i.status==="sent"||i.confirm==="none")return{outcome:"sent",message:"",code:null};if(!i.action_id||!P())return{outcome:"confirmed",message:"",code:null};const o=Date.now()+O;for(;Date.now()<o;){await F(B);try{const n=await E(i.action_id);if(n.status==="confirmed")return{outcome:"confirmed",message:"",code:null};if(n.status==="failed"||n.status==="denied")return{outcome:"refused",message:n.status==="denied"?v.forbidden:"הנגן דחה את הפקודה",code:n.error};if(n.status==="unknown")break}catch{}}return{outcome:"not_confirmed",message:"הנגן לא אישר את הפקודה",code:"not_confirmed"}}const Y=e=>({a1:`hsl(${e} 55% 22%)`,a2:`hsl(${e} 60% 52%)`,rgb:I(e)});function H(e,s){return e.live.group.role!=="member"?null:s?s.area_name||s.name:e.live.group.name}function Z(e,s,r=Date.now()){const t=e.live,i=t.now,o={kind:"idle",title:"",sub:"",glyph:e.kind==="player"?"media":"speaker",tile:"",a1:"#111827",a2:"#3f4a5c",rgb:null,artwork:null,prog:null,playing:!1,paused:!1,line:""};if(t.power==="unavailable"||t.power==="unknown")return{...o,kind:"un",glyph:"wifiOff",line:t.power==="unknown"?"מצב לא ידוע":t.since?`לא זמין מאז ${M(t.since)}`:"לא זמין"};if(t.power==="off"||t.power==="standby")return{...o,kind:"off",glyph:"power",line:k(e)};if(e.kind==="receiver"){const _=(i.label||"").split(" · ")[0]||"מגבר",x=[i.label,t.sound_output].filter(Boolean).join(" · ")||"דולק";return{...o,kind:"rcv",glyph:i.glyph||"hdmi",tile:_,line:x}}const n=S(e),h=t.power==="on"&&t.play==="paused",p=t.group.role==="member",f=k(e,{leaderLabel:H(e,s)??void 0});if(!(n||h)||i.kind==="none")return{...o,kind:"idle",line:f};const g=i.kind==="station",$=g?null:C(i,n,r);return{...o,kind:g?"station":"music",glyph:i.glyph||(g?"antenna":"music"),...Y(i.hue??210),title:p?"":i.title??"",sub:p||g?"":i.artist??"",artwork:i.artwork,prog:$!==null&&i.duration_s?$/i.duration_s:null,playing:n,paused:h,line:f}}var V=Object.defineProperty,J=Object.getOwnPropertyDescriptor,d=(e,s,r,t)=>{for(var i=t>1?void 0:t?J(s,r):s,o=e.length-1,n;o>=0;o--)(n=e[o])&&(i=(t?n(s,r,i):n(i))||i);return t&&i&&V(s,r,i),i};const K={not_playing:"לא מנגן",unavailable:"לא זמין",not_allowed:"אין הרשאה"};let l=class extends z{constructor(){super(...arguments),this.phase="closed",this.req=null,this.pauseReq=null,this.preview=null,this.record=null,this.error="",this.stopped=!1,this.close=()=>{if(this.phase==="sending")return;this.stopped=!0;const e=this.phase;this.phase="closed",e==="confirm"&&this.req?.cancel?.()}}confirm(e){this.phase==="sending"||this.phase==="running"||(this.stopped=!1,this.req=e,this.pauseReq=null,this.preview=null,this.record=null,this.error="",this.phase="confirm")}async pause(e){if(!(this.phase==="sending"||this.phase==="running")){this.stopped=!1,this.req=null,this.pauseReq=e,this.preview=null,this.record=null,this.error="",this.phase="loading";try{const s=await w().pausePreview(e.scope,e.id);if(this.pauseReq!==e)return;this.preview=s,this.phase=s.counts.send?"confirm":"nothing"}catch(s){if(this.pauseReq!==e)return;this.error=s instanceof y&&s.status===403?"אין לך הרשאה לעצירה מרוכזת כאן.":b(s),this.phase="error"}}}async runConfirm(){const e=this.req;if(!(!e||this.phase!=="confirm")){this.phase="sending";try{await e.run(),this.phase="closed"}catch(s){this.error=b(s),this.phase="error"}}}async runPause(){const e=this.pauseReq;if(!(!e||this.phase!=="confirm")){this.phase="sending";try{const s=await w().pauseRun(e.scope,e.id,A(),new Date(Date.now()+15e3).toISOString());this.phase="running",this.record=await this.follow(s.bulk_id),this.phase="result",this.dispatchEvent(new CustomEvent("group-done",{detail:this.record,bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof y&&s.code==="target_changed"?"רשימת הנגנים השתנתה; לא נשלח דבר. פתחו מחדש.":L(s),this.phase="error",this.dispatchEvent(new CustomEvent("group-done",{detail:null,bubbles:!0,composed:!0}))}}}async follow(e){const s=Date.now()+6e3;let r=null;for(;Date.now()<s&&!this.stopped;){try{if(r=await w().groupRecord(e),r.status==="done")return r}catch{return r}await new Promise(t=>setTimeout(t,600))}return r}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0}updated(e){!e.has("phase")||this.phase==="closed"||this.phase==="sending"||this.phase==="running"||requestAnimationFrame(()=>{const s=this.renderRoot.querySelector("sw-button[data-gd-cancel]");(s?.shadowRoot?.querySelector("button")??s)?.focus({preventScroll:!0})})}render(){if(this.phase==="closed"||!this.req&&!this.pauseReq)return a`<sw-dialog data-group-dialog="closed"></sw-dialog>`;const e=this.preview,s=this.pauseReq,r=this.req?this.req.heading:this.phase==="confirm"&&e&&s?`לעצור ${e.counts.send===1?"נגן אחד":`${e.counts.send} נגנים`} ב${c(s.name)}?`:`עצירת מוזיקה · ${c(s?.name??"")}`;return a`<sw-dialog open ?locked=${this.phase==="sending"} data-group-dialog=${this.phase} heading=${r} @close=${this.close}>${this.body()}</sw-dialog>`}cancel(e="ביטול"){return a`<sw-button data-gd-cancel autofocus @click=${this.close}>${e}</sw-button>`}body(){const e=this.preview;if(this.phase==="loading")return a`<div class="muted">בודק…</div><div class="actions">${this.cancel()}</div>`;if(this.phase==="error")return a`<div class="err" data-gd-error>${this.error}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.req){const t=this.req;return a`<div class="what" data-gd-what>${t.sub?a`<div>${t.sub}</div>`:m}
        ${t.names?.length?a`<details data-gd-details><summary>פרטים</summary><ul>${t.names.map(i=>a`<li>${c(i)}</li>`)}</ul></details>`:m}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant=${t.danger?"danger":"primary"} @click=${()=>void this.runConfirm()}>${t.ok}</sw-button></div>`}if(this.phase==="nothing"&&e)return a`<div class="what" data-gd-nothing><div>אין נגן מנגן שאושר לעצירה.</div>${this.details(e)}</div><div class="actions">${this.cancel("סגור")}</div>`;if(this.phase==="confirm"&&e)return a`<div class="what" data-gd-what>${this.details(e)}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant="primary" @click=${()=>void this.runPause()}>עצור (${e.counts.send})</sw-button></div>`;if(this.phase==="sending"||!this.record&&this.phase==="running")return a`<div class="muted" data-gd-progress>שולח…</div>`;const s=N(this.record&&{...this.record,members:this.record.members.filter(t=>t.will!=="skip")}),r=!!this.record&&s.failed.length>0;return a`<div class="what" data-gd-result=${r?"partial":"ok"}>
        <div class=${T({headline:!0,ok:!r,partial:r})}><sw-icon .name=${r?"warning":"check"} size="16"></sw-icon>${r?`בוצע חלקית: ${s.failed.length} לא נעצרו`:"בוצע"}</div>
        ${r?a`<ul>${s.failed.map(t=>a`<li>${c(t.room)}<span class="tag">לא נעצר</span></li>`)}</ul>`:m}
      </div><div class="actions">${this.cancel("סגור")}</div>`}details(e){const s=e.devices.filter(t=>t.will==="pause"),r=e.devices.filter(t=>t.will==="skip");return a`<details data-gd-details><summary>פרטים</summary>
      ${s.length?a`<ul>${s.map(t=>a`<li>${c(t.name)}</li>`)}</ul>`:m}
      ${r.length?a`<div class="muted">לא נכללו:</div><ul>${r.map(t=>a`<li>${c(t.name)}<span class="tag">${t.reason?K[t.reason]??t.reason:""}</span></li>`)}</ul>`:m}
    </details>`}};l.styles=D`
    .what {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: var(--sw-fs-sm);
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    details {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    summary {
      cursor: pointer;
      min-block-size: 44px;
      display: inline-flex;
      align-items: center;
    }
    ul {
      margin: 4px 0 0;
      padding-inline-start: 18px;
      max-block-size: 160px;
      overflow: auto;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding-block-start: 6px;
    }
    .headline {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .headline.ok {
      color: var(--sw-success);
    }
    .headline.partial {
      color: var(--sw-warning);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .tag {
      color: var(--sw-text-3);
      margin-inline-start: 6px;
    }
  `;d([u()],l.prototype,"phase",2);d([u()],l.prototype,"req",2);d([u()],l.prototype,"pauseReq",2);d([u()],l.prototype,"preview",2);d([u()],l.prototype,"record",2);d([u()],l.prototype,"error",2);l=d([j("media-group-dialog")],l);export{H as l,Z as p,U as r};
