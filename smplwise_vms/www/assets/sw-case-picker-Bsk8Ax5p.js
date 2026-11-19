import{g as v,ax as w,j as l,i as $,n as u,cv as e,A as d,b as n,Y as f,k as b}from"./index-DkcUEx2W.js";import{l as g,c as m,a as y}from"./cases-BQBpBOVs.js";var k=Object.defineProperty,x=Object.getOwnPropertyDescriptor,r=(t,i,s,c)=>{for(var o=c>1?void 0:c?x(i,s):i,h=t.length-1,p;h>=0;h--)(p=t[h])&&(o=(c?p(i,s,o):p(o))||o);return c&&o&&k(i,s,o),o};let a=class extends ${constructor(){super(...arguments),this.item=null,this.subheading="",this.cases=[],this.loading=!1,this.error="",this.picked="",this.newTitle="",this.note="",this.busy=!1,this.done=null,this.canManage=!0}updated(t){t.has("item")&&this.item&&this.load()}async load(){this.loading=!0,this.error="",this.done=null,this.note="";try{const t=await g({status:"open"});this.cases=t.cases,this.canManage=t.can_manage,this.picked=t.cases[0]?.id??"new"}catch(t){this.error=u(t)}finally{this.loading=!1}}close(){this.item=null,this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}async confirm(){const t=this.item;if(t){this.busy=!0,this.error="";try{let i=this.picked,s=this.cases.find(o=>o.id===i)?.title??"";if(i==="new"){if(!this.newTitle.trim()){this.error=e("תן שם לתיק החדש.");return}const o=await m({title:this.newTitle.trim()});i=o.id,s=o.title}const c=await y(i,{...t,note:this.note.trim()||t.note});this.done={id:i,title:s},this.dispatchEvent(new CustomEvent("added",{detail:{caseId:i,item:c},bubbles:!0,composed:!0}))}catch(i){this.error=u(i)}finally{this.busy=!1}}}render(){const t=this.item;if(!t)return d;const i=t.kind==="event"?e("האירוע"):t.kind==="clip"?e("הקטע"):e("ההערה");return n`<sw-dialog open heading=${e("הוסף לתיק")} subheading=${this.subheading} data-case-picker @close=${()=>this.close()}>
      ${this.error?n`<div class="err" data-case-error>${this.error}</div>`:d}
      ${this.done?n`<div class="ok" data-case-added>${e('{what} נוסף לתיק "{title}".',{what:i,title:this.done.title})}</div>`:this.loading?n`<div class="note">${e("טוען תיקים…")}</div>`:n`${this.canManage?d:n`<div class="note">${e("אין לך הרשאה לנהל תיקים.")}</div>`}
              <sw-field label=${e("תיק")}>
                <select aria-label=${e("תיק")} data-case-select @change=${s=>this.picked=s.target.value}>
                  ${this.cases.map(s=>n`<option value=${s.id} ?selected=${s.id===this.picked}>${s.title} · ${e("{n} פריטים",{n:s.counts.items})}</option>`)}
                  <option value="new" ?selected=${this.picked==="new"}>${e("+ תיק חדש")}</option>
                </select>
              </sw-field>
              ${this.picked==="new"?n`<sw-field label=${e("שם התיק החדש")}><input data-case-new-title .value=${this.newTitle} placeholder=${e("למשל: כניסה לא מורשית")} @input=${s=>this.newTitle=s.target.value} /></sw-field>`:d}
              ${t.kind!=="note"?n`<sw-field label=${e("הערה לפריט (לא חובה)")}><input data-case-note .value=${this.note} @input=${s=>this.note=s.target.value} /></sw-field>`:d}
              <div class="note">
                ${t.kind==="clip"?e("הקטע נשמר כסימנייה שמצביעה ל־NVR; שימור עותק מאומת נעשה מתוך התיק."):t.kind==="event"?e("האירוע נוסף עם חלון של 5 שניות לפני ו־30 שניות אחרי; שימור עותק מאומת נעשה מתוך התיק."):""}
              </div>`}
      ${this.done?n`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${e("סגור")}</sw-button>
            <sw-button slot="footer" variant="primary" icon="case" data-case-open @click=${()=>{const s=this.done?.id??"";this.close(),f(`/investigate/cases/${s}`)}}>${e("פתח את התיק")}</sw-button>`:n`<sw-button slot="footer" variant="ghost" @click=${()=>this.close()}>${e("ביטול")}</sw-button>
            <sw-button slot="footer" variant="primary" icon="plus" data-case-confirm ?disabled=${this.busy||this.loading||!this.canManage} @click=${()=>this.confirm()}>${e("הוסף")}</sw-button>`}
    </sw-dialog>`}};a.styles=v`
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
  `;r([w({attribute:!1})],a.prototype,"item",2);r([w()],a.prototype,"subheading",2);r([l()],a.prototype,"cases",2);r([l()],a.prototype,"loading",2);r([l()],a.prototype,"error",2);r([l()],a.prototype,"picked",2);r([l()],a.prototype,"newTitle",2);r([l()],a.prototype,"note",2);r([l()],a.prototype,"busy",2);r([l()],a.prototype,"done",2);r([l()],a.prototype,"canManage",2);a=r([b("sw-case-picker")],a);
