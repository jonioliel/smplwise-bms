import{lw as R,dW as P,lx as y,cy as a,a3 as E,iB as O,a as $,dX as b,iC as C,ly as _,cZ as S,k7 as D,g as z,j as p,i as A,cP as v,i0 as L,n as T,b as n,a7 as d,A as f,cs as j,k as M}from"./index-DJHEuoub.js";import{h as I,b as B}from"./media-now-CC6fBhTh.js";import{s as N}from"./multimedia-players-layout-BB2FelZ5.js";const F=600,U=e=>new Promise(s=>setTimeout(s,e));function G(e){return e instanceof $?{code:e.code,message:b(e)||(y[e.code]??e.body.user_message??a("הפעולה נכשלה"))}:{code:null,message:a("אין חיבור לשרת")}}async function V(e,s,r,t){let i;try{i=await R(e,s)}catch(o){const h=t&&s.confirmed!==!0?P(o):null;if(h)return await t(h)?V(e,{...s,confirmed:!0}):{outcome:"refused",message:"",code:"cancelled"};const{code:m,message:g}=G(o);return{outcome:m==="rate_limited"?"rate_limited":"refused",message:g,code:m}}if(i.status==="refused")return{outcome:"refused",message:i.error&&y[i.error]||a("הנגן דחה את הפקודה"),code:i.error};if(i.status==="sent"||i.confirm==="none")return{outcome:"sent",message:"",code:null};if(!i.action_id||!E())return{outcome:"confirmed",message:"",code:null};const l=Date.now()+C;for(;Date.now()<l;){await U(F);try{const o=await O(i.action_id);if(o.status==="confirmed")return{outcome:"confirmed",message:"",code:null};if(o.status==="failed"||o.status==="denied")return{outcome:"refused",message:o.status==="denied"?y.forbidden:a("הנגן דחה את הפקודה"),code:o.error};if(o.status==="unknown")break}catch{}}return{outcome:"not_confirmed",message:a("הנגן לא אישר את הפקודה"),code:"not_confirmed"}}const W=e=>({a1:`hsl(${e} 55% 22%)`,a2:`hsl(${e} 60% 52%)`,rgb:B(e)});function X(e,s){return e.live.group.role!=="member"?null:s?s.area_name||s.name:e.live.group.name}function ee(e,s,r=Date.now()){const t=e.live,i=t.now,l={kind:"idle",title:"",sub:"",glyph:e.kind==="player"?"media":"speaker",tile:"",a1:"#111827",a2:"#3f4a5c",rgb:null,artwork:null,prog:null,playing:!1,paused:!1,line:""};if(t.power==="unavailable"||t.power==="unknown")return{...l,kind:"un",glyph:"wifiOff",line:t.power==="unknown"?a("מצב לא ידוע"):t.since?a("לא זמין מאז {time}",{time:I(t.since)}):a("לא זמין")};if(t.power==="off"||t.power==="standby")return{...l,kind:"off",glyph:"power",line:_(e)};if(e.kind==="receiver"){const x=(i.label||"").split(" · ")[0]||a("מגבר"),q=[i.label,t.sound_output].filter(Boolean).join(" · ")||a("דולק");return{...l,kind:"rcv",glyph:i.glyph||"hdmi",tile:x,line:q}}const o=S(e),h=t.power==="on"&&t.play==="paused",m=t.group.role==="member",g=_(e,{leaderLabel:X(e,s)??void 0});if(!(o||h)||i.kind==="none")return{...l,kind:"idle",line:g};const w=i.kind==="station",k=w?null:D(i,o,r);return{...l,kind:w?"station":"music",glyph:i.glyph||(w?"antenna":"music"),...W(i.hue??210),title:m?"":i.title??"",sub:m||w?"":i.artist??"",artwork:i.artwork,prog:k!==null&&i.duration_s?k/i.duration_s:null,playing:o,paused:h,line:g}}var Y=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,u=(e,s,r,t)=>{for(var i=t>1?void 0:t?Z(s,r):s,l=e.length-1,o;l>=0;l--)(o=e[l])&&(i=(t?o(s,r,i):o(i))||i);return t&&i&&Y(s,r,i),i};const H={not_playing:a("לא מנגן"),unavailable:a("לא זמין"),not_allowed:a("אין הרשאה")};let c=class extends A{constructor(){super(...arguments),this.phase="closed",this.req=null,this.pauseReq=null,this.preview=null,this.record=null,this.error="",this.stopped=!1,this.close=()=>{if(this.phase==="sending")return;this.stopped=!0;const e=this.phase;this.phase="closed",e==="confirm"&&this.req?.cancel?.()}}confirm(e){this.phase==="sending"||this.phase==="running"||(this.stopped=!1,this.req=e,this.pauseReq=null,this.preview=null,this.record=null,this.error="",this.phase="confirm")}async pause(e){if(!(this.phase==="sending"||this.phase==="running")){this.stopped=!1,this.req=null,this.pauseReq=e,this.preview=null,this.record=null,this.error="",this.phase="loading";try{const s=await v().pausePreview(e.scope,e.id);if(this.pauseReq!==e)return;this.preview=s,this.phase=s.counts.send?"confirm":"nothing"}catch(s){if(this.pauseReq!==e)return;this.error=s instanceof $&&s.status===403?a("אין לך הרשאה לעצירה מרוכזת כאן."):b(s),this.phase="error"}}}async runConfirm(){const e=this.req;if(!(!e||this.phase!=="confirm")){this.phase="sending";try{await e.run(),this.phase="closed"}catch(s){this.error=b(s),this.phase="error"}}}async runPause(){const e=this.pauseReq;if(!(!e||this.phase!=="confirm")){this.phase="sending";try{const s=await v().pauseRun(e.scope,e.id,L(),new Date(Date.now()+15e3).toISOString());this.phase="running",this.record=await this.follow(s.bulk_id),this.phase="result",this.dispatchEvent(new CustomEvent("group-done",{detail:this.record,bubbles:!0,composed:!0}))}catch(s){this.error=s instanceof $&&s.code==="target_changed"?a("רשימת הנגנים השתנתה; לא נשלח דבר. פתחו מחדש."):T(s),this.phase="error",this.dispatchEvent(new CustomEvent("group-done",{detail:null,bubbles:!0,composed:!0}))}}}async follow(e){const s=Date.now()+6e3;let r=null;for(;Date.now()<s&&!this.stopped;){try{if(r=await v().groupRecord(e),r.status==="done")return r}catch{return r}await new Promise(t=>setTimeout(t,600))}return r}disconnectedCallback(){super.disconnectedCallback(),this.stopped=!0}updated(e){!e.has("phase")||this.phase==="closed"||this.phase==="sending"||this.phase==="running"||requestAnimationFrame(()=>{const s=this.renderRoot.querySelector("sw-button[data-gd-cancel]");(s?.shadowRoot?.querySelector("button")??s)?.focus({preventScroll:!0})})}render(){if(this.phase==="closed"||!this.req&&!this.pauseReq)return n`<sw-dialog data-group-dialog="closed"></sw-dialog>`;const e=this.preview,s=this.pauseReq,r=this.req?this.req.heading:this.phase==="confirm"&&e&&s?e.counts.send===1?a("לעצור נגן אחד ב{place}?",{place:d(s.name)}):a("לעצור {n} נגנים ב{place}?",{n:e.counts.send,place:d(s.name)}):`${a("עצירת מוזיקה")} · ${d(s?.name??"")}`;return n`<sw-dialog open ?locked=${this.phase==="sending"} data-group-dialog=${this.phase} heading=${r} @close=${this.close}>${this.body()}</sw-dialog>`}cancel(e=a("ביטול")){return n`<sw-button data-gd-cancel autofocus @click=${this.close}>${e}</sw-button>`}body(){const e=this.preview;if(this.phase==="loading")return n`<div class="muted">${a("בודק…")}</div><div class="actions">${this.cancel()}</div>`;if(this.phase==="error")return n`<div class="err" data-gd-error>${this.error}</div><div class="actions">${this.cancel(a("סגור"))}</div>`;if(this.req){const t=this.req;return n`<div class="what" data-gd-what>${t.sub?n`<div>${t.sub}</div>`:f}
        ${t.names?.length?n`<details data-gd-details><summary>${a("פרטים")}</summary><ul>${t.names.map(i=>n`<li>${d(i)}</li>`)}</ul></details>`:f}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant=${t.danger?"danger":"primary"} @click=${()=>void this.runConfirm()}>${t.ok}</sw-button></div>`}if(this.phase==="nothing"&&e)return n`<div class="what" data-gd-nothing><div>${a("אין נגן מנגן שאושר לעצירה.")}</div>${this.details(e)}</div><div class="actions">${this.cancel(a("סגור"))}</div>`;if(this.phase==="confirm"&&e)return n`<div class="what" data-gd-what>${this.details(e)}</div>
        <div class="actions">${this.cancel()}<sw-button data-gd-confirm variant="primary" @click=${()=>void this.runPause()}>${a("עצור")} (${e.counts.send})</sw-button></div>`;if(this.phase==="sending"||!this.record&&this.phase==="running")return n`<div class="muted" data-gd-progress>${a("שולח…")}</div>`;const s=N(this.record&&{...this.record,members:this.record.members.filter(t=>t.will!=="skip")}),r=!!this.record&&s.failed.length>0;return n`<div class="what" data-gd-result=${r?"partial":"ok"}>
        <div class=${j({headline:!0,ok:!r,partial:r})}><sw-icon .name=${r?"warning":"check"} size="16"></sw-icon>${r?a("בוצע חלקית: {n} לא נעצרו",{n:s.failed.length}):a("בוצע")}</div>
        ${r?n`<ul>${s.failed.map(t=>n`<li>${d(t.room)}<span class="tag">${a("לא נעצר")}</span></li>`)}</ul>`:f}
      </div><div class="actions">${this.cancel(a("סגור"))}</div>`}details(e){const s=e.devices.filter(t=>t.will==="pause"),r=e.devices.filter(t=>t.will==="skip");return n`<details data-gd-details><summary>${a("פרטים")}</summary>
      ${s.length?n`<ul>${s.map(t=>n`<li>${d(t.name)}</li>`)}</ul>`:f}
      ${r.length?n`<div class="muted">${a("לא נכללו:")}</div><ul>${r.map(t=>n`<li>${d(t.name)}<span class="tag">${t.reason?H[t.reason]??t.reason:""}</span></li>`)}</ul>`:f}
    </details>`}};c.styles=z`
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
  `;u([p()],c.prototype,"phase",2);u([p()],c.prototype,"req",2);u([p()],c.prototype,"pauseReq",2);u([p()],c.prototype,"preview",2);u([p()],c.prototype,"record",2);u([p()],c.prototype,"error",2);c=u([M("media-group-dialog")],c);export{X as l,ee as p,V as r};
