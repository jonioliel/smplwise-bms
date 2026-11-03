import{E as w,F as u,G as n,a as v,R as p,A as d,e as r,aj as f,H as b}from"./index-Bd8RPmTw.js";import{a as m,b as g,d as $}from"./cases-DOaDoyU2.js";var y=Object.defineProperty,k=Object.getOwnPropertyDescriptor,o=(t,s,e,l)=>{for(var a=l>1?void 0:l?k(s,e):s,c=t.length-1,h;c>=0;c--)(h=t[c])&&(a=(l?h(s,e,a):h(a))||a);return l&&a&&y(s,e,a),a};let i=class extends v{constructor(){super(...arguments),this.item=null,this.subheading="",this.cases=[],this.loading=!1,this.error="",this.picked="",this.newTitle="",this.note="",this.busy=!1,this.done=null,this.canManage=!0}updated(t){t.has("item")&&this.item&&this.load()}async load(){this.loading=!0,this.error="",this.done=null,this.note="";try{const t=await m({status:"open"});this.cases=t.cases,this.canManage=t.can_manage,this.picked=t.cases[0]?.id??"new"}catch(t){this.error=p(t)}finally{this.loading=!1}}close(){this.item=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async confirm(){const t=this.item;if(t){this.busy=!0,this.error="";try{let s=this.picked,e=this.cases.find(a=>a.id===s)?.title??"";if(s==="new"){if(!this.newTitle.trim()){this.error="תן שם לתיק החדש.";return}const a=await g({title:this.newTitle.trim()});s=a.id,e=a.title}const l=await $(s,{...t,note:this.note.trim()||t.note});this.done={id:s,title:e},this.dispatchEvent(new CustomEvent("added",{detail:{caseId:s,item:l},bubbles:!0,composed:!0}))}catch(s){this.error=p(s)}finally{this.busy=!1}}}render(){const t=this.item;if(!t)return d;const s=t.kind==="event"?"האירוע":t.kind==="clip"?"הקטע":"ההערה";return r`<sw-dialog open heading="הוסף לתיק" subheading=${this.subheading} data-case-picker @close=${()=>this.close()}>
      ${this.error?r`<div class="err" data-case-error>${this.error}</div>`:d}
      ${this.done?r`<div class="ok" data-case-added>${s} נוסף לתיק "${this.done.title}".</div>`:this.loading?r`<div class="note">טוען תיקים…</div>`:r`${this.canManage?d:r`<div class="note">אין לך הרשאה לנהל תיקים.</div>`}
              <sw-field label="תיק">
                <select aria-label="תיק" data-case-select @change=${e=>this.picked=e.target.value}>
                  ${this.cases.map(e=>r`<option value=${e.id} ?selected=${e.id===this.picked}>${e.title} · ${e.counts.items} פריטים</option>`)}
                  <option value="new" ?selected=${this.picked==="new"}>+ תיק חדש</option>
                </select>
              </sw-field>
              ${this.picked==="new"?r`<sw-field label="שם התיק החדש"><input data-case-new-title .value=${this.newTitle} placeholder="למשל: כניסה לא מורשית" @input=${e=>this.newTitle=e.target.value} /></sw-field>`:d}
              ${t.kind!=="note"?r`<sw-field label="הערה לפריט (לא חובה)"><input data-case-note .value=${this.note} @input=${e=>this.note=e.target.value} /></sw-field>`:d}
              <div class="note">
                ${t.kind==="clip"?"הקטע נשמר כסימנייה שמצביעה ל־NVR; שימור עותק מאומת נעשה מתוך התיק.":t.kind==="event"?"האירוע נוסף עם חלון של 5 שניות לפני ו־30 שניות אחרי; שימור עותק מאומת נעשה מתוך התיק.":""}
              </div>`}
      ${this.done?r`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>סגור</sw-button>
            <sw-button slot="footer" variant="primary" icon="case" data-case-open @click=${()=>{const e=this.done?.id??"";this.close(),f(`/investigate/cases/${e}`)}}>פתח את התיק</sw-button>`:r`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>ביטול</sw-button>
            <sw-button slot="footer" variant="primary" icon="plus" data-case-confirm ?disabled=${this.busy||this.loading||!this.canManage} @click=${()=>this.confirm()}>הוסף</sw-button>`}
    </sw-dialog>`}};i.styles=w`
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success);
      font-size: var(--sw-fs-sm);
    }
    .note {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    select,
    input {
      inline-size: 100%;
      font: inherit;
      padding: 7px 9px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
  `;o([u({attribute:!1})],i.prototype,"item",2);o([u()],i.prototype,"subheading",2);o([n()],i.prototype,"cases",2);o([n()],i.prototype,"loading",2);o([n()],i.prototype,"error",2);o([n()],i.prototype,"picked",2);o([n()],i.prototype,"newTitle",2);o([n()],i.prototype,"note",2);o([n()],i.prototype,"busy",2);o([n()],i.prototype,"done",2);o([n()],i.prototype,"canManage",2);i=o([b("sw-case-picker")],i);
//# sourceMappingURL=sw-case-picker-CCbzhKv9.js.map
