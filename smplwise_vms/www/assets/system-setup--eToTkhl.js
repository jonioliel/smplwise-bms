import{g as q,bb as be,E as M,G as d,a as E,R as m,j as Ie,A as o,e as r,H as N,fo as De,C as pt,cz as $t,cA as yt,c6 as ue,jr as kt,F as b,bV as ye,w as We,tq as _t,b5 as xt,av as O,l as ie,i as fe,hU as me,tr as zt,ts as Ct,bY as Rt,b7 as V,hV as St,ba as ut,S as Ot,dP as qe,pD as Et,tt as Nt,tu as Ue,tv as Tt}from"./index-DWrXlHoD.js";import"./system-doors-DWxCEV4N.js";import{fmtWhen as ht}from"./access-BL6-9G-Y.js";import{l as Ne}from"./live-CD_FQ4Zr.js";import"./sw-chip-wZ-Bm0Nb.js";import{t as Pt,v as It,w as Dt}from"./intercom-CxlJNndd.js";import{n as At,i as Bt,l as He,j as jt,k as Lt}from"./nvr-DdR39YC0.js";import"./nvr-connection-form-CqhlZsqO.js";import{o as Mt,p as Vt,q as Ft,m as le,t as Wt,u as Te,A as qt,v as Ut,l as Ht,w as Kt,x as ke,y as Gt,z as vt,B as Zt,C as Xt,D as Yt,E as Qt,F as Jt,G as Ke,H as es,I as ts,J as ss,K as as,L as is,S as rs,M as Ge,N as ns,O as os,P as Ze,Q as Xe,R as ls,T as ds,U as Re,V as cs,W as ps,X as us,j as Se,a as hs,Y as Ye,k as Qe,Z as vs,_ as fs,$ as ms,a0 as bs,a1 as Je}from"./frigate-control-_DujLOcJ.js";import{f as p}from"./frigate-text-u8YBBnZF.js";import{l as gs,u as et,S as ws}from"./recorders-DpVZrY7b.js";import"./sw-logo-art-Va6y_cIM.js";import"./nvr-h264-preset-CWl-CnDx.js";const $s=()=>q("wiskey/relay-map"),ys=(e,t,s,i)=>be(`wiskey/relay-map/${encodeURIComponent(e)}`,{expected_revision:t,rows:s,confirmed:!0,...i?{confirm_text:i}:{}}),Ae="off";function _e(e,t){const s=e.relays.find(i=>i.physical_index===t);return s?.name?`ממסר פיזי ${t} · ${s.name}`:`ממסר פיזי ${t}`}function ks(e){return[{value:Ae,label:"מושבת"},...e.relays.map(t=>({value:String(t.physical_index),label:_e(e,t.physical_index)}))]}function _s(e){const t=Number(e);return e!==Ae&&Number.isInteger(t)&&t>=1?t:null}function Be(e){const t={};for(const s of e.rows)t[s.api_relay]=s.active?s.physical_relay:null;return t}function xs(e){return Object.keys(e).map(Number).sort((t,s)=>t-s).map(t=>({api_relay:t,physical_relay:e[t]??null}))}function Ce(e,t){const s=Be(e),i=new Set;for(const l of Object.keys(s).map(Number)){const g=s[l]??null,A=t[l]??null;g!==A&&(g!==null&&i.add(g),A!==null&&i.add(A))}const a=Object.values(t).filter(l=>l!==null),n=[...new Set(a.filter((l,g)=>a.indexOf(l)!==g))].sort((l,g)=>l-g),c=[...i].sort((l,g)=>l-g);return{changed:c.length>0,affected:c,automated:c.filter(l=>e.automated_relays.includes(l)),duplicate:n}}function zs(e,t,s){const i=Ce(e,t);return s&&e.in_copy&&i.changed&&i.duplicate.length===0}function tt(e,t){return Ce(e,t).automated.length>0}function Cs(e){if(!e.in_copy)return{tone:"stale",text:"התחנה אינה מופיעה כעת ב-WisKey"};if(e.revision===0)return{tone:"unknown",text:"לא אושר - חירום ואוטומציות דרך WisKey ייחסמו"};const t=new Set(Object.values(Be(e)).filter(i=>i!==null)),s=e.relays.map(i=>i.physical_index).filter(i=>!t.has(i));return s.length?{tone:"stale",text:`חלקי · מהדורה ${e.revision} · ${s.map(i=>`ממסר פיזי ${i}`).join(", ")} לא ממופה`}:{tone:"live",text:`מאושר · מהדורה ${e.revision}`}}function Rs(e,t){return e.approved_at?`אושר בידי ${e.approved_by??"משתמש לא ידוע"} · ${t(e.approved_at)}`:"טרם אושר"}function Ss(e,t){const s=Ce(e,t),i=s.affected.map(n=>_e(e,n)).join(", "),a=s.automated.length?` לדלתות ${s.automated.map(n=>_e(e,n)).join(", ")} יש אוטומציה - היא תפעל לפי המיפוי החדש.`:"";return`לאשר את מיפוי הממסרים של ${e.name}? השינוי נוגע ל${i}.${a} שום פקודה לא נשלחת לתחנה.`}var Os=Object.defineProperty,Es=Object.getOwnPropertyDescriptor,de=(e,t,s,i)=>{for(var a=i>1?void 0:i?Es(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&Os(t,s,a),a};let te=class extends E{constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.drafts={},this.pending=null,this.word=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await $s(),this.drafts={},this.error=""}catch(e){this.error=m(e)}}draft(e){return this.drafts[e.id]??Be(e)}pick(e,t,s){this.drafts={...this.drafts,[e.id]:{...this.draft(e),[t]:_s(s)}}}ask(e){this.word="",this.pending=e}async approve(){const e=this.pending;if(!e)return;const t=this.draft(e);this.busy=!0;try{await ys(e.id,e.revision,xs(t),tt(e,t)?this.word.trim():void 0),this.pending=null,await this.load()}catch(s){const i=m(s);this.pending=null,s instanceof Ie&&s.status===409&&await this.load(),this.error=i}finally{this.busy=!1}}stationBlock(e,t){const s=this.draft(t),i=Cs(t),a=Ce(t,s),n=e.can_edit&&t.in_copy,c=ks(t);return r`<div class="station" data-relay-map-station=${t.name}>
      <div class="head">
        <div class="who"><span class="name">${t.name||"תחנה ללא שם"}</span><span class="sub">${Rs(t,ht)}</span></div>
        <sw-badge kind=${i.tone} label=${i.text}></sw-badge>
      </div>
      <div class="rows">
        ${t.rows.map(l=>{const g=s[l.api_relay]??null;return r`<label data-relay-map-row=${l.api_relay}>
            <span>ממסר API ${l.api_relay}</span>
            <select aria-label=${`${t.name}: ממסר API ${l.api_relay}`} ?disabled=${!n||this.busy} @change=${A=>this.pick(t,l.api_relay,A.target.value)}>
              ${c.map(A=>r`<option value=${A.value} ?selected=${A.value===(g===null?Ae:String(g))}>${A.label}</option>`)}
            </select>
          </label>`})}
      </div>
      ${t.automated_relays.length?r`<div class="sub" data-relay-map-automated>יש אוטומציה על ${t.automated_relays.map(l=>_e(t,l)).join(", ")}</div>`:o}
      ${a.duplicate.length?r`<div class="err" role="alert">כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד.</div>`:o}
      ${n&&a.changed?r`<div class="actions">
            <sw-button size="sm" variant="primary" data-relay-map-approve ?disabled=${this.busy||!zs(t,s,e.can_edit)} @click=${()=>this.ask(t)}>אישור מיפוי</sw-button>
            <sw-button size="sm" variant="ghost" data-relay-map-reset ?disabled=${this.busy} @click=${()=>{const{[t.id]:l,...g}=this.drafts;this.drafts=g}}>ביטול שינויים</sw-button>
          </div>`:o}
    </div>`}dialog(e,t){const s=this.draft(t),i=tt(t,s),a=!i||this.word.trim()===e.confirm_word;return r`<sw-dialog open heading="מיפוי ממסרים" data-relay-map-confirm @close=${()=>{this.pending=null}}>
      <p>${Ss(t,s)}</p>
      ${i?r`<div class="word">
            <span class="warn">כדי לאשר יש להקליד "${e.confirm_word}"</span>
            <input data-relay-map-word aria-label=${`להקליד ${e.confirm_word}`} .value=${this.word} @input=${n=>this.word=n.target.value} />
          </div>`:o}
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-relay-map-ok ?disabled=${this.busy||!a} @click=${()=>this.approve()}>אישור</sw-button>
    </sw-dialog>`}render(){if(this.error&&!this.map)return r`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,t=e.can_edit?"לכל תחנה: איזה ממסר פיזי (דלת) כל ממסר API מפעיל · חירום ואוטומציות דרך WisKey פועלים רק על מיפוי מאושר · לא נשלחת פקודה לתחנה":"לצפייה בלבד · שינוי המיפוי שמור למנהל המערכת";return r`<sw-card heading="מיפוי ממסרים" subheading=${t} data-relay-map-card>
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:o}
      ${e.stations.length?e.stations.map(s=>this.stationBlock(e,s)):r`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${e.has_copy?"WisKey לא מסר תחנות.":"נתוני WisKey אינם זמינים כרגע."}></sw-state-panel>`}
      ${this.pending?this.dialog(e,this.pending):o}
    </sw-card>`}};te.styles=M`
    :host {
      display: block;
      margin-block-start: var(--sw-s-3);
    }
    .station {
      padding: var(--sw-s-2) 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .station:last-child {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      flex-wrap: wrap;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .rows {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block: var(--sw-s-2);
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-text-2);
    }
    .tag {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    select,
    input {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      min-block-size: 36px;
      max-inline-size: 100%;
    }
    select:disabled {
      color: var(--sw-text-2);
      background: transparent;
    }
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .err,
    .warn {
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
    }
    .warn {
      color: var(--sw-warning-text, var(--sw-text-2));
    }
    .word {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      margin-block-start: var(--sw-s-2);
    }
  `;de([d()],te.prototype,"map",2);de([d()],te.prototype,"error",2);de([d()],te.prototype,"busy",2);de([d()],te.prototype,"drafts",2);de([d()],te.prototype,"pending",2);de([d()],te.prototype,"word",2);te=de([N("sw-wiskey-relay-map")],te);const Ns=()=>q("doors/blocks"),Ts=(e,t,s)=>be(`doors/blocks/entities/${encodeURIComponent(e)}`,{unblocked:t,...s?{note:s}:{},confirmed:!0}),ft={title:"חסימות פתיחת דלתות",sub:"כל עוד יש דלת אינטרקום, התקן וירטואלי (תבנית) שלא ניתן להוכיח שאינו דלת נחסם, וכך גם פריט שמשתמש בו. מנהל מערכת יכול לשחרר התקן אחד ולהחזיר אותו לחסימה. כל שינוי נרשם ביומן.",entities:"התקנים וירטואליים",items:"פריטים חסומים",search:"חיפוש לפי שם, אזור או סיבה",fAll:"הכול",fBlocked:"חסומים",fReleased:"משוחררים",refresh:"רענון",more:"הצג עוד ({n})",retry:"נסה שוב",none:"אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום",noEntities:"אין התקנים וירטואליים לשחרור",noMatch:"אין התאמות לחיפוש",noItems:"אין פריטים חסומים",truncated:"הרשימה קטועה: מוצגים רק ההתקנים הראשונים לפי שם",summary:"{blocked} חסומים · {released} משוחררים",summaryItems:"{blocked} פריטים חסומים",sBlocked:"חסום",sReleased:"משוחרר",sDoor:"משויך לדלת",sStale:"כבר אינו בקטלוג",usedBy:"בשימוש: {names}",usedMore:" ועוד {n}",releasedBy:"שוחרר בידי {who} · {when}",toggle:"שחרור {name}",itemFreed:"אינו חסום עוד",itemBlocked:"חסום",itemDevices:"התקנים וירטואליים: {names}",itemDevicesMore:" ועוד {n}",itemDeviceReleased:"{name} (משוחרר)",itemStays:"נשאר חסום גם אחרי שחרור ההתקנים",releaseTitle:"שחרור התקן וירטואלי",releaseText:"ההתקן יפסיק להיחסם: כפתורי התקנים, פעולה מרוכזת ופריטים שמשתמשים בו יורשו מ־Arx, גם אם הוא פותח דלת אינטרקום. השחרור נרשם ביומן עם שמך והסיבה, ואפשר להחזיר את החסימה בכל עת.",noteLabel:"סיבה לשחרור (חובה)",noteHint:"לפחות 3 תווים, עד {max}",release:"שחרור",reblockTitle:"החזרת חסימה להתקן",reblockText:"פעולות על ההתקן ייחסמו שוב, ופריטים שמשתמשים בו לא יופעלו מ־Arx עד שיוסר ממנו.",reblock:"החזרת חסימה",noteOptional:"סיבה (לא חובה)",cancel:"ביטול",saved:"נשמר",needNote:"נדרשת סיבה (לפחות 3 תווים)",tooLong:"הסיבה ארוכה מדי (עד {max} תווים)",d_lock:"מנעול",d_switch:"מתג",d_light:"תאורה",d_cover:"תריס או שער",d_fan:"מאוורר",d_button:"כפתור",d_media_player:"נגן",d_select:"בחירה",d_number:"ערך",d_valve:"ברז",d_vacuum:"שואב",d_alarm_control_panel:"לוח אזעקה",d_climate:"מיזוג",d_other:"התקן"},Ps={title:"Door blocks",entities:"Virtual devices",items:"Blocked items",search:"Search by name, area or reason",fAll:"All",fBlocked:"Blocked",fReleased:"Released",refresh:"Refresh",more:"Show more ({n})",sBlocked:"Blocked",sReleased:"Released",sDoor:"Mapped to a door",release:"Release",reblock:"Block again",cancel:"Cancel"};function Is(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function h(e,t){const s=(Is()==="en"?Ps[e]:void 0)??ft[e];return t?s.replace(/\{(\w+)\}/g,(i,a)=>a in t?String(t[a]):i):s}function Ds(e,t,s){return e in ft?h(e,s):h(t,s)}const As=3,je=300,we=50,Bs=["all","blocked","released"],js={all:"fAll",blocked:"fBlocked",released:"fReleased"},Ls=e=>h(js[e]),mt=e=>e.split(/\s+/).filter(Boolean).join(" ");function Ms(e){const t=mt(e).length;return t<As?"required":t>je?"too_long":null}function Vs(e){return e==="required"?h("needNote"):h("tooLong",{max:je})}const st=e=>e.toLowerCase().split(/\s+/).filter(Boolean).join(" ");function Fs(e,t,s){const i=st(t).split(" ").filter(Boolean);return e.filter(a=>{if(s==="blocked"&&a.state==="unblocked"||s==="released"&&a.state!=="unblocked")return!1;if(!i.length)return!0;const n=st([a.name,a.entity_id,a.area??"",bt(a.domain),a.override?.note??"",a.override?.by??""].join(" "));return i.every(c=>n.includes(c))})}function Ws(e,t){return{rows:e.slice(0,t),left:Math.max(0,e.length-t)}}const bt=e=>Ds(`d_${e}`,"d_other");function at(e){return[bt(e.domain),e.area].filter(Boolean).join(" · ")}function qs(e){return e.state==="door"?{kind:"unknown",text:h("sDoor")}:e.state==="unblocked"?{kind:"live",text:e.stale?`${h("sReleased")} · ${h("sStale")}`:h("sReleased")}:{kind:"stale",text:h("sBlocked")}}function Us(e){return e.used_by.length?h("usedBy",{names:e.used_by.join(", ")})+(e.used_more?h("usedMore",{n:e.used_more}):""):""}function Hs(e,t){return e.override?h("releasedBy",{who:e.override.by||"—",when:t(e.override.at)}):""}function Ks(e){if(!e.devices.length)return"";const t=e.devices.map(s=>s.state==="unblocked"?h("itemDeviceReleased",{name:s.name}):s.name).join(", ");return h("itemDevices",{names:t})+(e.devices_more?h("itemDevicesMore",{n:e.devices_more}):"")}function Gs(e){return e.blocked?{kind:"stale",text:h("itemBlocked")}:{kind:"live",text:h("itemFreed")}}function Zs(e){return!e.wiskey_present&&!e.counts.entities?h("none"):h("summary",{blocked:e.counts.blocked,released:e.counts.unblocked})}var Xs=Object.defineProperty,Ys=Object.getOwnPropertyDescriptor,Z=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ys(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&Xs(t,s,a),a};let B=class extends E{constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.status="all",this.shown=we,this.pending=null,this.note="",this.problem="",this.saved=!1,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}async load(){const e=++this.gen;this.busy=!0;try{const t=await Ns();if(e!==this.gen)return;this.data=t,this.error=""}catch(t){if(e!==this.gen)return;this.error=m(t)}finally{e===this.gen&&(this.busy=!1)}}ask(e,t){this.pending={entity:e,release:t},this.note="",this.problem="",this.saved=!1,this.requestUpdate()}cancel(){this.pending=null,this.problem="",this.requestUpdate()}async confirm(){const e=this.pending;if(!(!e||this.busy)){if(e.release){const t=Ms(this.note);if(t){this.problem=Vs(t);return}}this.busy=!0,this.problem="";try{const t=await Ts(e.entity.entity_id,e.release,mt(this.note)||void 0);this.data&&(this.data={...this.data,entities:this.data.entities.map(s=>s.entity_id===t.entity_id?{...s,state:t.state,override:t.override}:s)}),this.pending=null,this.note="",this.saved=!0,this.busy=!1,await this.load()}catch(t){this.problem=m(t)}finally{this.busy=!1}}}entityRow(e){const t=qs(e),s=Us(e),i=Hs(e,ht);return r`<div class="ent" data-door-block=${e.entity_id} data-door-block-state=${e.state}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${at(e)}</span>
        ${s?r`<span class="sub" data-door-block-used>${s}</span>`:o}
        ${e.override?r`<span class="sub" data-door-block-when>${i}</span><span class="note" data-door-block-why>${e.override.note}</span>`:o}
      </div>
      <div class="ctl">
        <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
        ${e.state==="door"||!e.overridable?o:r`<sw-toggle class="t" label=${h("toggle",{name:e.name})} labelHidden data-door-block-toggle .checked=${Ne(e.state==="unblocked")} ?disabled=${this.busy}
              @change=${a=>this.ask(e,a.detail.checked)}></sw-toggle>`}
      </div>
    </div>`}itemRow(e){const t=Gs(e),s=Ks(e);return r`<div class="item" data-door-block-item=${e.key} data-blocked=${String(e.blocked)} data-opens-door=${String(e.opens_door)}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${e.kind_text}</span>
        ${e.opens_door?r`<span class="warn" data-door-block-door>${e.guard}${e.why?` · ${e.why}`:""}</span>`:o}
        ${s?r`<span class="sub" data-door-block-devices>${s}</span>`:o}
        ${e.opens_door&&s?r`<span class="sub">${h("itemStays")}</span>`:o}
        ${!e.opens_door&&!s&&e.reasons.length?r`<span class="sub">${e.reasons.join(" · ")}</span>`:o}
      </div>
      <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
    </div>`}dialog(){const e=this.pending;return e?r`<sw-dialog open heading=${e.release?h("releaseTitle"):h("reblockTitle")} data-door-block-dialog @close=${()=>this.cancel()}>
      <p class="q"><strong>${e.entity.name}</strong> · ${at(e.entity)}</p>
      <p class="q">${e.release?h("releaseText"):h("reblockText")}</p>
      <sw-field label=${e.release?h("noteLabel"):h("noteOptional")} hint=${e.release?h("noteHint",{max:je}):""}>
        <textarea data-door-block-note-input rows="3" maxlength="600" aria-label=${e.release?h("noteLabel"):h("noteOptional")} .value=${this.note}
          @input=${t=>{this.note=t.target.value,this.problem=""}}></textarea>
      </sw-field>
      ${this.problem?r`<div class="err" role="alert" data-door-block-problem>${this.problem}</div>`:o}
      <sw-button slot="footer" variant="ghost" data-door-block-cancel @click=${()=>this.cancel()}>${h("cancel")}</sw-button>
      <sw-button slot="footer" variant=${e.release?"primary":"danger"} data-door-block-ok ?disabled=${this.busy} @click=${()=>void this.confirm()}>${e.release?h("release"):h("reblock")}</sw-button>
    </sw-dialog>`:o}render(){if(this.error&&!this.data)return r`<sw-state-panel state="error" hint=${this.error} actionLabel=${h("retry")} data-door-blocks-state="error" @action=${()=>void this.load()}></sw-state-panel>`;if(!this.data)return r`<sw-state-panel state="loading" data-door-blocks-state="loading"></sw-state-panel>`;const e=this.data,t=Fs(e.entities,this.q,this.status),s=Ws(t,this.shown);return r`<sw-card heading=${h("title")} subheading=${h("sub")} data-door-blocks-card data-door-blocks-state="ready" style="margin-block-start: var(--sw-s-3)">
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:o}
      ${this.saved?r`<div class="sub" role="status" data-door-blocks-saved>${h("saved")}</div>`:o}
      <div class="sum" data-door-blocks-summary>${Zs(e)}${e.items.length?` · ${h("summaryItems",{blocked:e.counts.items_blocked})}`:""}</div>
      ${!e.wiskey_present&&!e.entities.length?r`<sw-state-panel icon="door" state="empty" heading=${h("none")} data-door-blocks-none></sw-state-panel>`:r`<h3>${h("entities")}</h3>
          <div class="tools">
            <input type="search" data-door-blocks-search placeholder=${h("search")} aria-label=${h("search")} .value=${this.q}
              @input=${i=>{this.q=i.target.value,this.shown=we}} />
            <div class="chips" role="group" aria-label=${h("entities")}>
              ${Bs.map(i=>r`<sw-chip data-door-blocks-filter=${i} ?selected=${this.status===i} @click=${()=>{this.status=i,this.shown=we}}>${Ls(i)}</sw-chip>`)}
            </div>
            <sw-button size="sm" variant="ghost" icon="refresh" data-door-blocks-refresh ?disabled=${this.busy} @click=${()=>void this.load()}>${h("refresh")}</sw-button>
          </div>
          ${s.rows.length?s.rows.map(i=>this.entityRow(i)):r`<sw-state-panel icon="door" state="empty" heading=${e.entities.length?h("noMatch"):h("noEntities")}></sw-state-panel>`}
          ${s.left?r`<sw-button class="more" size="sm" variant="ghost" data-door-blocks-more @click=${()=>{this.shown+=we}}>${h("more",{n:s.left})}</sw-button>`:o}
          ${e.truncated?r`<div class="sub">${h("truncated")}</div>`:o}
          <h3>${h("items")}</h3>
          ${e.items.length?e.items.map(i=>this.itemRow(i)):r`<sw-state-panel icon="door" state="empty" heading=${h("noItems")}></sw-state-panel>`}`}
    </sw-card>${this.dialog()}`}};B.styles=[De,M`
      :host {
        display: block;
        /* every button of the card is a 44 px target (the shared settings rows are not, in every skin) */
        --sw-ctl-h-md: max(44px, var(--sw-touch-desktop, 44px));
        --sw-ctl-h-sm: max(44px, var(--sw-touch-desktop, 44px));
      }
      h3 {
        margin: var(--sw-s-4) 0 var(--sw-s-1);
        font-size: var(--sw-fs-md);
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-text-2);
      }
      .sum {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
      }
      .tools {
        display: flex;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
        align-items: center;
        margin-block: var(--sw-s-2);
      }
      .tools input {
        flex: 1 1 220px;
        min-inline-size: 0;
        box-sizing: border-box;
        font: inherit;
        font-size: var(--sw-fs-sm);
        color: var(--sw-text);
        background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-sm);
        padding: var(--sw-s-1) var(--sw-s-2);
        min-block-size: 44px;
      }
      .tools input:focus-visible {
        outline: 2px solid var(--sw-focus);
        outline-offset: 1px;
      }
      .chips {
        display: flex;
        gap: var(--sw-s-1);
        flex-wrap: wrap;
      }
      .item,
      .ent {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--sw-s-3);
        flex-wrap: wrap;
        padding: var(--sw-s-2) 0;
        border-block-end: 1px solid var(--sw-border);
      }
      .item:last-of-type,
      .ent:last-of-type {
        border-block-end: 0;
      }
      .who {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1 1 260px;
        min-inline-size: 0;
      }
      /* a device's switch and badge stay on the row of its name on a phone (the card is ~366 px wide there) */
      .ent .who {
        flex-basis: 180px;
      }
      .name {
        font-weight: var(--sw-fw-medium);
        color: var(--sw-text);
        overflow-wrap: anywhere;
      }
      .sub {
        color: var(--sw-text-3);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .warn {
        color: var(--sw-warning-text, var(--sw-text-2));
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .note {
        color: var(--sw-text-2);
        font-size: var(--sw-fs-sm);
        overflow-wrap: anywhere;
      }
      .ctl {
        display: flex;
        align-items: center;
        gap: var(--sw-s-2);
        flex-wrap: wrap;
      }
      /* the switch is 42 x 24; its host is the 44 px target (a press on the host flips it too) */
      sw-toggle.t {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
      }
      .err {
        color: var(--sw-danger-text);
        font-size: var(--sw-fs-sm);
      }
      textarea {
        min-block-size: 88px;
        resize: vertical;
        line-height: 1.5;
      }
      .q {
        margin: 0 0 var(--sw-s-2);
        overflow-wrap: anywhere;
      }
      .more {
        margin-block-start: var(--sw-s-2);
      }
    `,pt];Z([d()],B.prototype,"data",2);Z([d()],B.prototype,"error",2);Z([d()],B.prototype,"busy",2);Z([d()],B.prototype,"q",2);Z([d()],B.prototype,"status",2);Z([d()],B.prototype,"shown",2);Z([d()],B.prototype,"pending",2);Z([d()],B.prototype,"note",2);Z([d()],B.prototype,"problem",2);Z([d()],B.prototype,"saved",2);B=Z([N("sw-door-blocks")],B);var Qs=Object.defineProperty,Js=Object.getOwnPropertyDescriptor,he=(e,t,s,i)=>{for(var a=i>1?void 0:i?Js(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&Qs(t,s,a),a};const ve=[["doors.emergency.grant.default_hours","sGrantDefault",0],["doors.emergency.grant.max_hours","sGrantMax",1]],gt=[["doors.emergency.grant.by_security_manager","sGrantManager"],["doors.emergency.retry_open.by_holders","sRetryHolders"]],it=[...ve.map(e=>e[0]),...gt.map(e=>e[0])];let ne=class extends E{constructor(){super(...arguments),this.saved=null,this.edit={},this.busy=!1,this.error="",this.done=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=(await $t()).settings,t=Object.fromEntries(it.map(s=>[s,String(e[s]??"")]));this.saved=t,this.edit={...t}}catch{this.saved=null}}async save(){if(!this.saved)return;const e=Object.fromEntries(Object.entries(this.edit).filter(([t,s])=>this.saved[t]!==s));if(Object.keys(e).length){this.busy=!0,this.error="",this.done=!1;try{await yt(e),await this.load(),this.done=!0}catch(t){this.error=m(t)}finally{this.busy=!1}}}render(){if(!this.saved)return o;const e=it.some(s=>this.edit[s]!==this.saved[s]),t=ve.every(([s,,i])=>/^\d+$/.test(this.edit[s]??"")&&Number(this.edit[s])>=i&&Number(this.edit[s])<=8760)&&Number(this.edit[ve[0][0]])<=Number(this.edit[ve[1][0]]);return r`<sw-card heading=${ue("sGrants")} data-emergency-open-settings>
      ${ve.map(([s,i])=>r`<div class="f"><label for=${s}>${ue(i)}</label>
        <input id=${s} type="text" inputmode="numeric" data-eo-setting=${s} .value=${Ne(this.edit[s]??"")}
          @input=${a=>{this.edit={...this.edit,[s]:a.target.value.trim()},this.done=!1}}></div>`)}
      ${gt.map(([s,i])=>r`<div class="f"><span>${ue(i)}</span>
        <sw-toggle label=${ue(i)} labelHidden data-eo-switch=${s} .checked=${Ne(this.edit[s]==="on")}
          @change=${a=>{this.edit={...this.edit,[s]:a.detail.checked?"on":"off"},this.done=!1}}></sw-toggle></div>`)}
      <div class="bar"><sw-button variant="primary" data-eo-save ?disabled=${this.busy||!e||!t} @click=${()=>void this.save()}>${ue("sSave")}</sw-button>
        ${this.done?r`<span>${ue("saved")}</span>`:o}${this.error?r`<span class="err" role="alert">${this.error}</span>`:o}</div>
    </sw-card>`}};ne.styles=[De,M`
      :host { display: block; }
      .f { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-3); flex-wrap: wrap; padding: var(--sw-s-2) 0; border-block-end: 1px solid var(--sw-border); }
      .f input { inline-size: 7em; box-sizing: border-box; min-block-size: 44px; font: inherit; color: var(--sw-text); background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: var(--sw-s-1) var(--sw-s-2); }
      .f input:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .bar { display: flex; gap: var(--sw-s-2); align-items: center; padding-block-start: var(--sw-s-2); }
      .err { color: var(--sw-danger-text, var(--sw-text)); font-size: var(--sw-fs-sm); }
    `];he([d()],ne.prototype,"saved",2);he([d()],ne.prototype,"edit",2);he([d()],ne.prototype,"busy",2);he([d()],ne.prototype,"error",2);he([d()],ne.prototype,"done",2);ne=he([N("sw-emergency-open-settings")],ne);const ce=M`
  :host {
    display: block;
  }
  .panel {
    display: grid;
    gap: var(--sw-s-3);
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
    /* the tables fold by the card's own width (a settings card sits beside a tree on wide screens) */
    container: admin / inline-size;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-2);
  }
  h4 {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text);
  }
  h5 {
    margin: 0;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-3);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .note {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    margin: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px var(--sw-s-2);
    border-radius: var(--sw-r-pill);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    white-space: nowrap;
  }
  .chip.ok {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .chip.warn {
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
  }
  .chip.bad {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  .chip.accent {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  /* ---- a table that folds to rows on a narrow card ---- */
  .tbl {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    overflow: hidden;
  }
  .tbl .h,
  .tbl .r {
    display: grid;
    grid-template-columns: var(--cols);
    gap: var(--sw-s-2);
    align-items: center;
    padding: var(--sw-s-2) var(--sw-s-3);
    min-inline-size: 0;
  }
  .tbl .h {
    background: var(--sw-surface-2);
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .tbl .r {
    border-block-start: 1px solid var(--sw-border);
    min-block-size: 44px;
  }
  .tbl .r:hover {
    background: var(--sw-surface-2);
  }
  .tbl .c {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tbl .c.muted {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .tbl .c.ltr {
    direction: ltr;
    unicode-bidi: isolate;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .tbl .acts {
    display: flex;
    justify-content: flex-end;
    gap: 2px;
  }
  .tbl b {
    font-weight: var(--sw-fw-semibold);
  }
  @container admin (max-width: 640px) {
    .tbl .h {
      display: none;
    }
    .tbl .r {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'main acts' 'sub acts';
      row-gap: 2px;
    }
    .tbl .r .c.main {
      grid-area: main;
    }
    .tbl .r .c.sub {
      grid-area: sub;
      white-space: normal;
    }
    .tbl .r .c:not(.main):not(.sub):not(.acts) {
      display: none;
    }
    .tbl .r .acts {
      grid-area: acts;
    }
  }
  .empty {
    padding: var(--sw-s-4);
    text-align: center;
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
  /* ---- forms ---- */
  .form {
    display: grid;
    gap: var(--sw-s-3);
  }
  .form .two {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: var(--sw-s-3);
  }
  .form label {
    display: grid;
    gap: 4px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    min-inline-size: 0;
  }
  .form label.row {
    grid-template-columns: auto 1fr;
    align-items: center;
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
  }
  .form input:not([type='checkbox']),
  .form select,
  .form textarea,
  .inline input {
    font: inherit;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    padding: var(--sw-s-2) var(--sw-s-3);
    min-block-size: 36px;
    box-sizing: border-box;
    inline-size: 100%;
    min-inline-size: 0;
  }
  .form input[type='datetime-local'] {
    direction: ltr;
  }
  .form input[type='checkbox'] {
    inline-size: 16px;
    block-size: 16px;
    margin: 0;
    accent-color: var(--sw-accent);
  }
  .form input:focus-visible,
  .form select:focus-visible,
  .inline input:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 1px;
  }
  .sup {
    display: flex;
    align-items: flex-start;
    gap: var(--sw-s-2);
    padding: var(--sw-s-2) var(--sw-s-3);
    border-radius: var(--sw-r-sm);
    background: var(--sw-stale-soft);
    color: var(--sw-stale-text);
    font-size: var(--sw-fs-xs);
  }
  .sup input {
    margin: 2px 0 0;
    accent-color: var(--sw-accent);
    inline-size: 16px;
    block-size: 16px;
    flex: none;
  }
  .err {
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-xs);
  }
  .msg {
    font-size: var(--sw-fs-xs);
  }
  .msg.ok {
    color: var(--sw-success-text);
  }
  .msg.err {
    color: var(--sw-danger-text);
  }
  .inline {
    display: flex;
    gap: var(--sw-s-1);
    align-items: center;
    min-inline-size: 0;
  }
  .dialog-text {
    margin: 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .seg {
    display: inline-flex;
    gap: 2px;
    padding: 3px;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-3);
    max-inline-size: 100%;
  }
  .seg button {
    min-block-size: 32px;
    padding-inline: var(--sw-s-3);
    border: 0;
    border-radius: var(--sw-r-pill);
    background: transparent;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
    white-space: nowrap;
  }
  .seg button[aria-pressed='true'] {
    background: var(--sw-seg-key, var(--sw-surface));
    color: var(--sw-seg-key-ink, var(--sw-text));
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
  }
  .seg button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .seg button:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sw-s-3);
    padding-block: var(--sw-s-1);
    min-inline-size: 0;
  }
  .row .name {
    display: grid;
    min-inline-size: 0;
  }
  .row .sub {
    color: var(--sw-text-3);
    font-size: var(--sw-fs-xs);
  }
`;function K(e,t,s,i,a="data-supervised"){if(!e||!e.can_supervise||e.done[t])return o;const n=p().control.settings.supervised;return r`<label class="sup" data-supervised-box=${a}><input type="checkbox" .checked=${s} @change=${c=>i(c.target.checked)} /><span><b>${n.label}</b> · ${n.hint}</span></label>`}const J=(e,t)=>!!e&&!e.done[t]&&!e.can_supervise;function ee(e,t){if(e==null)return"—";const s=typeof e=="number"?new Date(e*1e3):new Date(e);if(Number.isNaN(s.getTime()))return"—";try{return kt(s,{timeZone:t})}catch{return s.toISOString()}}function xe(e){if(!e)return null;const t=Date.parse(e);return Number.isFinite(t)?Math.floor(t/1e3):null}function ze(e){const t=new Date(e*1e3),s=i=>String(i).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}T${s(t.getHours())}:${s(t.getMinutes())}`}var ea=Object.defineProperty,ta=Object.getOwnPropertyDescriptor,X=(e,t,s,i)=>{for(var a=i>1?void 0:i?ta(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ea(t,s,a),a};let j=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.canConfigure=!1,this.canProfile=!1,this.tz="",this.data=null,this.failed="",this.busy=!1,this.msg=null,this.applying=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(this.recorderId)try{this.data=await Mt(this.recorderId),this.failed=""}catch(e){this.failed=m(e)}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}async setting(e){if(this.data){this.busy=!0;try{const t=await Vt(this.recorderId,e);this.data={...this.data,setting:t.setting},this.flash("ok",p().control.saved),this.changed(),this.load()}catch(t){this.flash("err",m(t)),this.load()}finally{this.busy=!1}}}async apply(){const e=this.applying;if(!(!e||this.busy)){this.busy=!0;try{const t=await Ft(this.recorderId,e.item.id,e.supervised);this.applying=null,this.flash("ok",t.status==="applied"?p().control.settings.auto.applied:t.status==="skipped"?p().control.settings.auto.status.skipped:p().control.unverified),this.changed(),this.load()}catch(t){this.applying={...e,error:le(t)?p().control.settings.supervised.need:m(t)}}finally{this.busy=!1}}}async dismiss(e){this.busy=!0;try{await Wt(this.recorderId,e.id),this.flash("ok",p().control.settings.auto.dismissed),this.load()}catch(t){this.flash("err",m(t))}finally{this.busy=!1}}statusLine(){const e=p().control.settings.auto,t=this.data.setting;if(t.mode==="off")return r`<span class="chip" data-auto-status="off">${e.offText}</span>`;if(t.mode==="suggest")return r`<span class="chip accent" data-auto-status="suggest">${e.suggestOnly}</span>`;if(t.will_apply)return r`<span class="chip ok" data-auto-status="apply">${e.willApply}</span>`;const s=[t.profile_class_on?null:e.blockedClass,t.auto_apply_consent?null:e.blockedConsent,t.first_write_done?null:e.blockedFirst].filter(Boolean);return r`<span class="chip warn" data-auto-status="blocked">${e.suggestOnly} · ${s.join(" · ")}</span>`}itemLine(e){const t=p().control.settings.auto;return r`<b>${Te(e.alarm_state)}</b> <span class="muted">${t.arrow}</span><b>${e.profile==="none"?t.profileNone:e.profile}</b>`}applyDialog(){const e=this.applying;if(!e)return o;const t=p().control.settings.auto,s=p().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.profile_auto;return r`<sw-dialog open heading=${t.confirmApply} data-auto-confirm @close=${()=>this.applying=null}>
      <div class="form">
        <p class="dialog-text">${this.itemLine(e.item)} · ${s.confirmProfile}</p>
        ${K(this.first,"profile_auto",e.supervised,a=>this.applying={...e,supervised:a},"profile_auto")}
        ${e.error?r`<div class="err" role="alert" data-auto-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.applying=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-auto-apply-ok ?disabled=${this.busy||i&&!e.supervised} @click=${()=>void this.apply()}>${s.confirm}</sw-button>
    </sw-dialog>`}render(){const e=p().control.settings.auto,t=p().control.settings;if(this.failed)return r`<div class="panel" data-frigate-auto><div class="msg err" data-auto-failed>${this.failed}</div></div>`;const s=this.data;if(!s)return o;const i=s.setting,a=s.items.filter(l=>l.status==="suggested"||l.status==="pending"),n=s.items.filter(l=>l.status!=="suggested"&&l.status!=="pending").slice(0,8),c=this.busy||!this.canConfigure;return r`<div class="panel" data-frigate-auto>
      <div class="head"><h4>${e.title}</h4>${this.statusLine()}</div>
      <div class="row">
        <span class="name"><span>${e.mode}</span></span>
        <div class="seg" role="group" aria-label=${e.mode} data-auto-modes>
          ${qt.map(l=>r`<button type="button" aria-pressed=${String(i.mode===l)} data-auto-mode=${l} ?disabled=${c||l==="apply"&&!i.auto_apply_consent} title=${l==="apply"&&!i.auto_apply_consent?e.blockedConsent:""} @click=${()=>i.mode!==l&&void this.setting({mode:l})}>${e.modes[l]}</button>`)}
        </div>
      </div>
      <div class="row">
        <span class="name"><span>${e.consent}</span>${i.auto_apply_consent&&i.consent_at?r`<span class="sub" data-auto-consent-by>${e.consentBy} · ${ee(i.consent_at,this.tz||void 0)}</span>`:o}</span>
        <sw-toggle .checked=${i.auto_apply_consent} ?disabled=${c} labelHidden label=${e.consent} data-auto-consent @change=${l=>void this.setting({auto_apply_consent:l.currentTarget.checked})}></sw-toggle>
      </div>
      <h5>${e.suggestions}</h5>
      ${a.length?r`<div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) 110px 150px">
            ${a.map(l=>r`<div class="r" role="row" data-auto-item=${l.id}>
              <div class="c main" role="cell">${this.itemLine(l)}</div>
              <div class="c sub ltr muted" role="cell">${ee(l.at,this.tz||void 0)}</div>
              <div class="c acts" role="cell">
                ${this.canProfile?r`<sw-button size="sm" variant="primary" data-auto-apply ?disabled=${this.busy} @click=${()=>this.applying={item:l,supervised:!1,error:""}}>${e.apply}</sw-button>
                  <sw-button size="sm" variant="ghost" data-auto-dismiss ?disabled=${this.busy} @click=${()=>void this.dismiss(l)}>${e.dismiss}</sw-button>`:o}
              </div>
            </div>`)}
          </div>`:r`<div class="tbl"><div class="empty" data-auto-empty>${e.noSuggestions}</div></div>`}
      ${n.length?r`<h5>${e.recent}</h5>
          <div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) minmax(120px, 1fr) 110px" data-auto-recent>
            ${n.map(l=>r`<div class="r" role="row" data-auto-recent-item=${l.id}>
              <div class="c main" role="cell">${this.itemLine(l)}</div>
              <div class="c sub" role="cell"><span class=${`chip ${l.status==="applied"?"ok":l.status==="failed"?"bad":""}`}>${e.status[l.status]??l.status}</span>${l.reason&&e.reason[l.reason]?r` <span class="muted">${e.reason[l.reason]}</span>`:o}</div>
              <div class="c ltr muted" role="cell">${ee(l.at,this.tz||void 0)}</div>
            </div>`)}
          </div>`:o}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-auto-msg>${this.msg.text}</div>`:o}
      ${this.first&&!this.first.done.profile_auto&&i.mode!=="off"?r`<p class="note" data-auto-first-note>${t.kinds.profile_auto}: ${t.firstPending}</p>`:o}
      ${this.applyDialog()}
    </div>`}};j.styles=ce;X([b({attribute:"recorder-id"})],j.prototype,"recorderId",2);X([b({attribute:!1})],j.prototype,"first",2);X([b({type:Boolean})],j.prototype,"canConfigure",2);X([b({type:Boolean})],j.prototype,"canProfile",2);X([b()],j.prototype,"tz",2);X([d()],j.prototype,"data",2);X([d()],j.prototype,"failed",2);X([d()],j.prototype,"busy",2);X([d()],j.prototype,"msg",2);X([d()],j.prototype,"applying",2);j=X([N("frigate-auto-profile")],j);var sa=Object.defineProperty,aa=Object.getOwnPropertyDescriptor,P=(e,t,s,i)=>{for(var a=i>1?void 0:i?aa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&sa(t,s,a),a};let R=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.msg=null,this.draft=null,this.renaming=null,this.deleting=null,this.moving=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await Ut(this.recorderId);this.rows=e.exports,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=m(e),this.rows=[]}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return le(e)?p().control.settings.supervised.need:m(e)}openCreate(){const e=Math.floor(Date.now()/1e3),t=this.cams.find(s=>s.enabled&&s.frigate_enabled!==!1)??this.cams[0];this.draft={camera:t?.id??"",start:ze(e-600),end:ze(e),name:"",supervised:!1,error:""}}async submitCreate(){const e=this.draft;if(!e||this.busy)return;const t=p().control.settings.exports,s=xe(e.start),i=xe(e.end),a=Xt(s,i);if(!e.camera)return void(this.draft={...e,error:t.chooseCamera});if(a)return void(this.draft={...e,error:a==="missing"?t.rangeMissing:a==="order"?t.rangeOrder:a==="long"?t.rangeLong:t.rangeFuture});if(!e.name.trim())return void(this.draft={...e,error:`${t.name}?`});this.busy=!0;try{const n=await Ht(this.recorderId,{camera_id:e.camera,start:s,end:i,name:e.name.trim(),...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",n.verified?t.created:p().control.unverified),this.changed()}catch(n){this.draft={...e,error:this.refusal(n)}}finally{this.busy=!1}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Kt(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?p().control.settings.exports.renamed:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!ke(e.typed,e.row.name))){this.busy=!0;try{const t=await Gt(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?p().control.settings.exports.deleted:p().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async openMove(e){this.moving={row:e,caseId:e.case_id??"",cases:null,supervised:!1,error:""};try{const t=await vt(this.recorderId);this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:t.cases})}catch(t){this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:[],error:m(t)})}}async confirmMove(){const e=this.moving;if(!(!e||this.busy)){this.busy=!0;try{const t=await Zt(this.recorderId,e.row.id,e.caseId||null,e.supervised);this.moving=null,this.flash("ok",t.verified?p().control.settings.exports.moved:p().control.unverified),this.changed()}catch(t){this.moving={...e,error:this.refusal(t)}}finally{this.busy=!1}}}moveDialog(){const e=this.moving;if(!e)return o;const t=p().control.settings.exports,s=p().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.export_assign,a=[{id:"",label:t.noCase},...(e.cases??[]).map(n=>({id:n.id,label:n.name||n.id}))];return r`<sw-dialog open heading=${t.moveToCase} subheading=${e.row.name} data-fx-move @close=${()=>this.moving=null}>
      <div class="form">
        <label>${t.case}<sw-dropdown block data-fx-case .label=${t.case} .value=${e.caseId} .items=${a} ?disabled=${e.cases===null}
          @change=${n=>this.moving={...e,caseId:n.detail.id}}></sw-dropdown></label>
        ${K(this.first,"export_assign",e.supervised,n=>this.moving={...e,supervised:n},"export_assign")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.moving=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fx-move-ok ?disabled=${this.busy||e.cases===null||e.caseId===(e.row.case_id??"")||i&&!e.supervised}
        @click=${()=>void this.confirmMove()}>${s.confirm}</sw-button>
    </sw-dialog>`}camName(e,t){return this.cams.find(s=>s.id===e)?.name??t??e}createDialog(){const e=this.draft;if(!e)return o;const t=p().control.settings.exports,s=p().control,i=this.cams.filter(n=>n.enabled).map(n=>({id:n.id,label:n.name})),a=!!this.first&&this.first.can_supervise&&!this.first.done.export_create;return r`<sw-dialog open heading=${t.create} data-fx-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.camera}<sw-dropdown block data-fx-camera .label=${t.camera} .placeholder=${t.chooseCamera} .value=${e.camera} .items=${i} @change=${n=>this.draft={...e,camera:n.detail.id}}></sw-dropdown></label>
        <div class="two">
          <label>${t.from}<input type="datetime-local" lang=${ye()} data-fx-start .value=${e.start} @input=${n=>this.draft={...e,start:n.target.value}} /></label>
          <label>${t.to}<input type="datetime-local" lang=${ye()} data-fx-end .value=${e.end} @input=${n=>this.draft={...e,end:n.target.value}} /></label>
        </div>
        <label>${t.name}<input type="text" maxlength="80" data-fx-name .value=${e.name} @input=${n=>this.draft={...e,name:n.target.value}} /></label>
        ${K(this.first,"export_create",e.supervised,n=>this.draft={...e,supervised:n},"export_create")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-fx-create-ok ?disabled=${this.busy||a&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return o;const t=p().control.settings.exports,s=p().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.export_delete;return r`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fx-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${t.deleteText}</p>
        <input type="text" data-fx-delete-typed aria-label=${t.name} .value=${e.typed} @input=${a=>this.deleting={...e,typed:a.target.value}} />
        ${K(this.first,"export_delete",e.supervised,a=>this.deleting={...e,supervised:a},"export_delete")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fx-delete-ok ?disabled=${this.busy||!ke(e.typed,e.row.name)||i&&!e.supervised} @click=${()=>void this.confirmDelete()}>${t.delete}</sw-button>
    </sw-dialog>`}row(e){const t=p().control.settings.exports,s=p().control,i=this.renaming?.id===e.id?this.renaming:null,a=this.enabled&&e.arx_created;return r`<div class="r" role="row" data-fx-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${i?r`<span class="inline"><input type="text" maxlength="80" data-fx-rename-input aria-label=${t.name} .value=${i.name} ?disabled=${this.busy}
                @input=${n=>this.renaming={...i,name:n.target.value}}
                @keydown=${n=>{n.key==="Enter"&&this.saveRename(),n.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${s.confirm} data-fx-rename-save ?disabled=${this.busy||!i.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${s.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:r`<b title=${e.name}>${e.name||e.id}</b>`}
        ${i?K(this.first,"export_rename",i.supervised,n=>this.renaming={...i,supervised:n},"export_rename"):o}
      </div>
      <div class="c sub muted" role="cell">${this.camName(e.camera_id,e.camera)} · ${ee(e.date,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${ee(e.date,this.tz||void 0)}</div>
      <div class="c" role="cell"><span class=${`chip ${e.in_progress?"warn":"ok"}`} data-fx-state=${e.in_progress?"progress":"ready"}>${e.in_progress?t.inProgress:t.ready}</span></div>
      <div class="c muted" role="cell">${e.arx_created?t.arx:t.foreign}</div>
      <div class="c acts" role="cell">
        ${a&&!i?r`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${t.rename} data-fx-rename ?disabled=${this.busy||J(this.first,"export_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:o}
        ${a&&!e.in_progress?r`<sw-button size="sm" variant="ghost" iconOnly icon="case" label=${t.moveToCase} data-fx-move-btn ?disabled=${this.busy||J(this.first,"export_assign")} @click=${()=>void this.openMove(e)}></sw-button>`:o}
        ${a?r`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${t.delete} data-fx-delete-btn ?disabled=${this.busy||J(this.first,"export_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:o}
      </div>
    </div>`}render(){if(!this.allowed)return o;const e=p().control.settings.exports,t=p().control.settings,s=this.rows,i=this.enabled&&!J(this.first,"export_create")&&this.cams.length>0;return r`<div class="panel" data-frigate-exports>
      <div class="head">
        <h4>${t.tabs.exports}</h4>
        <span class="inline">
          ${this.enabled?o:r`<span class="chip warn" data-fx-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.export_create?r`<span class="chip" data-fx-first-pending>${t.firstPending}</span>`:o}
          <sw-button size="sm" variant="primary" icon="plus" data-fx-new ?disabled=${!i} @click=${()=>this.openCreate()}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?r`<div class="msg err" role="alert" data-fx-failed>${this.failed}</div>`:o}
      ${s===null?o:s.length?r`<div class="tbl" role="table" style="--cols: minmax(140px, 1.6fr) minmax(90px, 1fr) 110px 88px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.camera}</span><span>${e.date}</span><span>${e.state}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:r`<div class="tbl"><div class="empty" data-fx-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fx-msg>${this.msg.text}</div>`:o}
      ${this.createDialog()}
      ${this.deleteDialog()}
      ${this.moveDialog()}
    </div>`}};R.styles=ce;P([b({attribute:"recorder-id"})],R.prototype,"recorderId",2);P([b({attribute:!1})],R.prototype,"first",2);P([b({attribute:!1})],R.prototype,"cams",2);P([b({type:Boolean})],R.prototype,"allowed",2);P([b()],R.prototype,"tz",2);P([d()],R.prototype,"rows",2);P([d()],R.prototype,"enabled",2);P([d()],R.prototype,"failed",2);P([d()],R.prototype,"busy",2);P([d()],R.prototype,"msg",2);P([d()],R.prototype,"draft",2);P([d()],R.prototype,"renaming",2);P([d()],R.prototype,"deleting",2);P([d()],R.prototype,"moving",2);R=P([N("frigate-exports-panel")],R);var ia=Object.defineProperty,ra=Object.getOwnPropertyDescriptor,F=(e,t,s,i)=>{for(var a=i>1?void 0:i?ra(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ia(t,s,a),a};let T=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.msg=null,this.draft=null,this.renaming=null,this.deleting=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await vt(this.recorderId);this.rows=e.cases,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=m(e),this.rows=[]}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return le(e)?p().control.settings.supervised.need:m(e)}async submitCreate(){const e=this.draft;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Yt(this.recorderId,{name:e.name.trim(),description:e.description.trim()||null,...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",t.verified?p().control.settings.cases.created:p().control.unverified),this.changed()}catch(t){this.draft={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Qt(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?p().control.settings.cases.renamed:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!ke(e.typed,e.row.name))){this.busy=!0;try{const t=await Jt(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?p().control.settings.cases.deleted:p().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}createDialog(){const e=this.draft;if(!e)return o;const t=p().control.settings.cases,s=p().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.case_create;return r`<sw-dialog open heading=${t.create} data-fc-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.name}<input type="text" maxlength="80" data-fc-name .value=${e.name} @input=${a=>this.draft={...e,name:a.target.value}} /></label>
        <label>${t.description}<input type="text" maxlength="200" data-fc-description .value=${e.description} @input=${a=>this.draft={...e,description:a.target.value}} /></label>
        ${K(this.first,"case_create",e.supervised,a=>this.draft={...e,supervised:a},"case_create")}
        ${e.error?r`<div class="err" role="alert" data-fc-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fc-create-ok ?disabled=${this.busy||!e.name.trim()||i&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return o;const t=p().control.settings.cases,s=p().control.settings.exports,i=p().control,a=!!this.first&&this.first.can_supervise&&!this.first.done.case_delete;return r`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fc-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${s.deleteText}</p>
        <input type="text" data-fc-delete-typed aria-label=${t.name} .value=${e.typed} @input=${n=>this.deleting={...e,typed:n.target.value}} />
        ${K(this.first,"case_delete",e.supervised,n=>this.deleting={...e,supervised:n},"case_delete")}
        ${e.error?r`<div class="err" role="alert" data-fc-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${i.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fc-delete-ok ?disabled=${this.busy||!ke(e.typed,e.row.name)||a&&!e.supervised} @click=${()=>void this.confirmDelete()}>${s.delete}</sw-button>
    </sw-dialog>`}row(e){const t=p().control.settings.cases,s=p().control.settings.exports,i=p().control,a=this.renaming?.id===e.id?this.renaming:null,n=this.enabled&&e.arx_created;return r`<div class="r" role="row" data-fc-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${a?r`<span class="inline"><input type="text" maxlength="80" data-fc-rename-input aria-label=${t.name} .value=${a.name} ?disabled=${this.busy}
                @input=${c=>this.renaming={...a,name:c.target.value}}
                @keydown=${c=>{c.key==="Enter"&&this.saveRename(),c.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${i.confirm} data-fc-rename-save ?disabled=${this.busy||!a.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${i.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:r`<b title=${e.name}>${e.name||e.id}</b>`}
        ${a?K(this.first,"case_rename",a.supervised,c=>this.renaming={...a,supervised:c},"case_rename"):o}
      </div>
      <div class="c sub muted" role="cell" title=${e.description}>${e.description||ee(e.created_at,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${ee(e.created_at,this.tz||void 0)}</div>
      <div class="c muted" role="cell">${e.arx_created?s.arx:s.foreign}</div>
      <div class="c acts" role="cell">
        ${n&&!a?r`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${s.rename} data-fc-rename ?disabled=${this.busy||J(this.first,"case_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:o}
        ${n?r`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${s.delete} data-fc-delete-btn ?disabled=${this.busy||J(this.first,"case_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:o}
      </div>
    </div>`}render(){if(!this.allowed)return o;const e=p().control.settings.cases,t=p().control.settings,s=this.rows,i=this.enabled&&!J(this.first,"case_create");return r`<div class="panel" data-frigate-cases>
      <div class="head">
        <h4>${t.tabs.cases}</h4>
        <span class="inline">
          ${this.enabled?o:r`<span class="chip warn" data-fc-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.case_create?r`<span class="chip" data-fc-first-pending>${t.firstPending}</span>`:o}
          <sw-button size="sm" variant="primary" icon="plus" data-fc-new ?disabled=${!i} @click=${()=>this.draft={name:"",description:"",supervised:!1,error:""}}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?r`<div class="msg err" role="alert" data-fc-failed>${this.failed}</div>`:o}
      ${s===null?o:s.length?r`<div class="tbl" role="table" style="--cols: minmax(140px, 1.4fr) minmax(120px, 1.6fr) 110px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.description}</span><span>${e.createdAt}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:r`<div class="tbl"><div class="empty" data-fc-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fc-msg>${this.msg.text}</div>`:o}
      ${this.createDialog()}
      ${this.deleteDialog()}
    </div>`}};T.styles=ce;F([b({attribute:"recorder-id"})],T.prototype,"recorderId",2);F([b({attribute:!1})],T.prototype,"first",2);F([b({type:Boolean})],T.prototype,"allowed",2);F([b()],T.prototype,"tz",2);F([d()],T.prototype,"rows",2);F([d()],T.prototype,"enabled",2);F([d()],T.prototype,"failed",2);F([d()],T.prototype,"busy",2);F([d()],T.prototype,"msg",2);F([d()],T.prototype,"draft",2);F([d()],T.prototype,"renaming",2);F([d()],T.prototype,"deleting",2);T=F([N("frigate-cases-panel")],T);var na=Object.defineProperty,oa=Object.getOwnPropertyDescriptor,C=(e,t,s,i)=>{for(var a=i>1?void 0:i?oa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&na(t,s,a),a};let k=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.changes=[],this.enabled=!1,this.allowed=!1,this.tz="",this.camera="",this.label="",this.subLabel="",this.duration="30",this.openEnded=!1,this.supervised=!1,this.endSupervised=!1,this.busy=!1,this.error="",this.msg=null}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}refusal(e){return le(e)?p().control.settings.supervised.need:m(e)}async create(){const e=p().control.settings.events,t=this.camera||this.cams.find(i=>i.enabled)?.id||"",s=this.openEnded?null:Number(this.duration);if(!t)return void(this.error=p().control.settings.exports.chooseCamera);if(!this.label.trim())return void(this.error=e.labelError);if(s!==null&&(!Number.isInteger(s)||s<1||s>Ke))return void(this.error=e.durationError);this.busy=!0,this.error="";try{const i=await es(this.recorderId,t,{label:this.label.trim(),duration_s:s,sub_label:this.subLabel.trim()||null,...this.supervised?{supervised:!0}:{}});this.label="",this.subLabel="",this.flash("ok",i.verified?e.created:p().control.unverified),this.changed()}catch(i){this.error=this.refusal(i)}finally{this.busy=!1}}async end(e){this.busy=!0;try{const t=await ts(this.recorderId,e,this.endSupervised);this.flash("ok",t.verified?p().control.settings.events.ended:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}camName(e){return this.cams.find(t=>t.id===e)?.name??e??""}render(){if(!this.allowed)return o;const e=p().control.settings.events,t=p().control.settings,s=this.cams.filter(l=>l.enabled).map(l=>({id:l.id,label:l.name})),i=this.camera||s[0]?.id||"",a=!!this.first&&this.first.can_supervise&&!this.first.done.event_create,n=this.enabled&&!J(this.first,"event_create")&&s.length>0,c=ss(this.changes);return r`<div class="panel" data-frigate-events>
      <div class="head">
        <h4>${e.create}</h4>
        <span class="inline">
          ${this.enabled?o:r`<span class="chip warn" data-fe-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.event_create?r`<span class="chip" data-fe-first-pending>${t.firstPending}</span>`:o}
        </span>
      </div>
      <div class="form" data-fe-form>
        <div class="two">
          <label>${e.camera}<sw-dropdown block data-fe-camera .label=${e.camera} .placeholder=${e.camera} .value=${i} .items=${s} @change=${l=>this.camera=l.detail.id}></sw-dropdown></label>
          <label>${e.label}<input type="text" maxlength="40" data-fe-label .value=${this.label} ?disabled=${!n} @input=${l=>this.label=l.target.value} /></label>
        </div>
        <div class="two">
          <label>${e.subLabel}<input type="text" maxlength="60" data-fe-sub-label .value=${this.subLabel} ?disabled=${!n} @input=${l=>this.subLabel=l.target.value} /></label>
          <label>${e.duration}<input type="number" min="1" max=${Ke} step="1" data-fe-duration .value=${this.duration} ?disabled=${!n||this.openEnded} @input=${l=>this.duration=l.target.value} /></label>
        </div>
        <label class="row"><input type="checkbox" data-fe-open .checked=${this.openEnded} ?disabled=${!n} @change=${l=>this.openEnded=l.target.checked} /><span>${e.openEnded}</span></label>
        ${K(this.first,"event_create",this.supervised,l=>this.supervised=l,"event_create")}
        ${this.error?r`<div class="err" role="alert" data-fe-error>${this.error}</div>`:o}
        <div class="inline"><sw-button size="sm" variant="primary" icon="plus" data-fe-create ?disabled=${this.busy||!n||a&&!this.supervised} @click=${()=>void this.create()}>${e.create}</sw-button></div>
      </div>
      <h5>${e.openList}</h5>
      ${c.length?r`<div class="tbl" role="table" style="--cols: minmax(120px, 1.4fr) minmax(100px, 1fr) 110px 110px 80px">
            <div class="h" role="row"><span>${e.label}</span><span>${e.camera}</span><span>${p().review.time}</span><span>${p().control.settings.by}</span><span></span></div>
            ${c.map(l=>r`<div class="r" role="row" data-fe-open-row=${l.id}>
              <div class="c main" role="cell"><b>${l.label}</b>${l.sub_label?r` <span class="muted">· ${l.sub_label}</span>`:o}${l.status==="unverified"?r` <span class="chip warn">${t.unverified}</span>`:o}</div>
              <div class="c sub muted" role="cell">${this.camName(l.camera_id)} · ${ee(l.at,this.tz||void 0)}</div>
              <div class="c ltr muted" role="cell">${ee(l.at,this.tz||void 0)}</div>
              <div class="c muted" role="cell">${l.actor??""}</div>
              <div class="c acts" role="cell"><sw-button size="sm" icon="stopSquare" data-fe-end ?disabled=${this.busy||!this.enabled||J(this.first,"event_end")} @click=${()=>void this.end(l.id)}>${e.end}</sw-button></div>
            </div>`)}
          </div>
          ${K(this.first,"event_end",this.endSupervised,l=>this.endSupervised=l,"event_end")}`:r`<div class="tbl"><div class="empty" data-fe-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fe-msg>${this.msg.text}</div>`:o}
    </div>`}};k.styles=ce;C([b({attribute:"recorder-id"})],k.prototype,"recorderId",2);C([b({attribute:!1})],k.prototype,"first",2);C([b({attribute:!1})],k.prototype,"cams",2);C([b({attribute:!1})],k.prototype,"changes",2);C([b({type:Boolean})],k.prototype,"enabled",2);C([b({type:Boolean})],k.prototype,"allowed",2);C([b()],k.prototype,"tz",2);C([d()],k.prototype,"camera",2);C([d()],k.prototype,"label",2);C([d()],k.prototype,"subLabel",2);C([d()],k.prototype,"duration",2);C([d()],k.prototype,"openEnded",2);C([d()],k.prototype,"supervised",2);C([d()],k.prototype,"endSupervised",2);C([d()],k.prototype,"busy",2);C([d()],k.prototype,"error",2);C([d()],k.prototype,"msg",2);k=C([N("frigate-manual-events")],k);var la=Object.defineProperty,da=Object.getOwnPropertyDescriptor,Y=(e,t,s,i)=>{for(var a=i>1?void 0:i?da(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&la(t,s,a),a};let L=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.canPlayback=!1,this.camera="",this.start=ze(Math.floor(Date.now()/1e3)-600),this.end=ze(Math.floor(Date.now()/1e3)),this.supervised=!1,this.error="",this.viewer=null}clipAddress(){const e=p().control.settings.supervision,t=xe(this.start),s=xe(this.end),i=this.camera||this.cams.find(a=>a.enabled)?.id||"";return i?t==null||s==null||s<=t||s-t>as||s>Date.now()/1e3+60?(this.error=e.clipRangeError,null):(this.error="",is(this.recorderId,i,t,s,this.supervised)):(this.error=p().control.settings.exports.chooseCamera,null)}openClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),window.open(e,"_blank","noopener"))}playClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),this.viewer={url:e,state:"loading"})}viewerDialog(){const e=this.viewer;if(!e)return o;const t=p().control.settings.supervision,s=this.cams.find(i=>i.id===(this.camera||this.cams.find(a=>a.enabled)?.id))?.name??"";return r`<sw-dialog open wide heading=${t.clipTitle} subheading=${s} data-fs-viewer @close=${()=>this.viewer=null}>
      <div class="clip" data-state=${e.state} data-fs-clip-state=${e.state}>
        <video controls playsinline preload="metadata" src=${e.url} data-fs-video
          @loadeddata=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"ready"}:this.viewer}
          @error=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"error"}:this.viewer}></video>
        <div class="state">${e.state==="error"?r`<sw-icon name="warning" size="18"></sw-icon>${t.clipError}`:r`<sw-icon class="spin" name="clock" size="18"></sw-icon>${t.clipLoading}`}</div>
      </div>
      <sw-button slot="footer" variant="ghost" icon="share" data-fs-viewer-tab @click=${()=>window.open(e.url,"_blank","noopener")}>${t.openTab}</sw-button>
      <sw-button slot="footer" data-fs-viewer-close @click=${()=>this.viewer=null}>${t.close}</sw-button>
    </sw-dialog>`}render(){const e=p().control.settings.supervision,t=p().control.settings,s=this.first,i=this.cams.filter(l=>l.enabled).map(l=>({id:l.id,label:l.name})),a=this.camera||i[0]?.id||"",n=!!s&&s.can_supervise&&!s.done.clip_read,c=!!s&&!s.done.clip_read&&!s.can_supervise;return r`<div class="panel" data-frigate-supervision>
      <div class="head"><h4>${e.title}</h4></div>
      <p class="note">${e.intro}</p>
      ${s?r`<div class="tbl" role="table" style="--cols: minmax(160px, 1fr) 110px" data-fs-kinds>
            ${rs.map(l=>r`<div class="r" role="row" data-fs-kind=${l} data-done=${String(!!s.done[l])}>
              <div class="c main" role="cell">${t.kinds[l]}</div>
              <div class="c acts" role="cell"><span class=${`chip ${s.done[l]?"ok":""}`}>${s.done[l]?e.done:e.pending}</span></div>
            </div>`)}
          </div>`:r`<div class="msg err" data-fs-failed>${t.unavailable}</div>`}
      ${this.canPlayback&&i.length?r`<h5>${e.clipTitle}</h5>
          <p class="note">${e.clipText}</p>
          <div class="form" data-fs-clip>
            <label>${t.exports.camera}<sw-dropdown block data-fs-camera .label=${t.exports.camera} .placeholder=${t.exports.camera} .value=${a} .items=${i} @change=${l=>this.camera=l.detail.id}></sw-dropdown></label>
            <div class="two">
              <label>${t.exports.from}<input type="datetime-local" lang=${ye()} data-fs-start .value=${this.start} @input=${l=>this.start=l.target.value} /></label>
              <label>${t.exports.to}<input type="datetime-local" lang=${ye()} data-fs-end .value=${this.end} @input=${l=>this.end=l.target.value} /></label>
            </div>
            ${K(s,"clip_read",this.supervised,l=>this.supervised=l,"clip_read")}
            ${this.error?r`<div class="err" role="alert" data-fs-error>${this.error}</div>`:o}
            <div class="inline">
              <sw-button size="sm" variant="primary" icon="play" data-fs-play ?disabled=${c||n&&!this.supervised} @click=${()=>this.playClip()}>${e.play}</sw-button>
              <sw-button size="sm" variant="ghost" icon="share" data-fs-open ?disabled=${c||n&&!this.supervised} @click=${()=>this.openClip()}>${e.openTab}</sw-button>
            </div>
          </div>`:o}
      ${this.viewerDialog()}
    </div>`}};L.styles=[ce,M`
    .clip {
      position: relative;
      inline-size: 100%;
      aspect-ratio: 16 / 9;
      border-radius: var(--sw-r-md);
      background: var(--sw-video-bg);
      overflow: hidden;
      direction: ltr;
    }
    .clip video {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      background: var(--sw-video-bg);
    }
    .clip .state {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--sw-s-2);
      color: rgba(255, 255, 255, 0.82);
      font-size: var(--sw-fs-sm);
      pointer-events: none;
    }
    .clip[data-state='ready'] .state {
      display: none;
    }
    .clip[data-state='error'] video {
      visibility: hidden;
    }
    .clip .spin {
      animation: fs-spin 1.2s linear infinite;
    }
    @keyframes fs-spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .clip .spin {
        animation: none;
      }
    }
  `];Y([b({attribute:"recorder-id"})],L.prototype,"recorderId",2);Y([b({attribute:!1})],L.prototype,"first",2);Y([b({attribute:!1})],L.prototype,"cams",2);Y([b({type:Boolean})],L.prototype,"canPlayback",2);Y([d()],L.prototype,"camera",2);Y([d()],L.prototype,"start",2);Y([d()],L.prototype,"end",2);Y([d()],L.prototype,"supervised",2);Y([d()],L.prototype,"error",2);Y([d()],L.prototype,"viewer",2);L=Y([N("frigate-supervision")],L);var ca=Object.defineProperty,pa=Object.getOwnPropertyDescriptor,oe=(e,t,s,i)=>{for(var a=i>1?void 0:i?pa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ca(t,s,a),a};let Q=class extends E{constructor(){super(...arguments),this.src=null,this.aspect=16/9,this.zones=[],this.selected=null,this.points=[],this.editing=!1,this.broken=!1,this.drag=null,this.swallowClick=!1}rect(){return this.renderRoot.querySelector(".stage").getBoundingClientRect()}emit(e){this.dispatchEvent(new CustomEvent("zone-points",{detail:{points:e},bubbles:!0,composed:!0}))}onStageClick(e){if(this.swallowClick){this.swallowClick=!1;return}!this.editing||e.target.closest(".h, .m")||this.points.length>=40||this.emit([...this.points,Ge(e.clientX,e.clientY,this.rect())])}onDown(e,t){this.editing&&(t.stopPropagation(),t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId),this.drag={index:e,id:t.pointerId})}mid(e){const t=this.points[e],s=this.points[(e+1)%this.points.length],i=a=>Math.round(a*1e4)/1e4;return[i((t[0]+s[0])/2),i((t[1]+s[1])/2)]}insertAt(e,t){if(!this.editing||this.points.length>=40)return;const s=[...this.points.slice(0,e+1),this.mid(e),...this.points.slice(e+1)];t&&(t.stopPropagation(),t.preventDefault(),this.renderRoot.querySelector(".stage").setPointerCapture(t.pointerId),this.drag={index:e+1,id:t.pointerId},this.swallowClick=!0),this.emit(s),t||this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-zone-handle="${e+1}"]`)?.focus())}onMove(e){if(!this.drag||this.drag.id!==e.pointerId)return;const t=this.points.slice();t[this.drag.index]=Ge(e.clientX,e.clientY,this.rect()),this.emit(t)}onUp(e){this.drag?.id===e.pointerId&&(this.drag=null)}onKey(e,t){if(!this.editing)return;const s=t.shiftKey?.02:.005,i={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]};if(i[t.key]){t.preventDefault();const[a,n]=this.points[e],c=g=>Math.round(Math.min(1,Math.max(0,g))*1e4)/1e4,l=this.points.slice();l[e]=[c(a+i[t.key][0]),c(n+i[t.key][1])],this.emit(l)}else(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.emit(this.points.filter((a,n)=>n!==e)))}pick(e,t){this.editing||(t.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-pick",{detail:{name:e},bubbles:!0,composed:!0})))}centroid(e){const t=e.length||1;return[e.reduce((s,i)=>s+i[0],0)/t,e.reduce((s,i)=>s+i[1],0)/t]}render(){const e=p().control.settings.config,t=1e3,s=Math.round(1e3/(this.aspect>0?this.aspect:16/9)),i=n=>n.map(([c,l])=>`${(c*t).toFixed(1)},${(l*s).toFixed(1)}`).join(" "),a=this.zones.filter(n=>n.points&&n.name!==this.selected);return r`<div class=${`stage ${this.editing?"editing":""}`} dir="ltr" style=${`aspect-ratio: ${t} / ${s}`} data-zone-stage
        @click=${n=>this.onStageClick(n)} @pointermove=${n=>this.onMove(n)} @pointerup=${n=>this.onUp(n)} @pointercancel=${n=>this.onUp(n)}>
      ${this.src&&!this.broken?r`<img src=${this.src} alt="" draggable="false" @error=${()=>this.broken=!0} />`:r`<div class="noframe" data-zone-noframe>${e.noFrame}</div>`}
      <svg viewBox=${`0 0 ${t} ${s}`} preserveAspectRatio="none" aria-hidden="true">
        ${a.map(n=>We`<polygon class=${`zone ${this.editing?"dim":""}`} points=${i(n.points)} data-zone-shape=${n.name} @click=${c=>this.pick(n.name,c)}></polygon>`)}
        ${this.selected!==null&&this.points.length>=2?We`<polygon class="draft" points=${i(this.points)} data-zone-draft></polygon>`:o}
      </svg>
      ${a.map(n=>{const[c,l]=this.centroid(n.points);return r`<span class="name" style=${`left:${c*100}%;top:${l*100}%`}>${n.name}</span>`})}
      ${this.selected!==null&&this.editing&&this.points.length>=2&&this.points.length<40?this.points.map((n,c)=>c===this.points.length-1&&this.points.length<3?o:r`<button type="button" class="m" style=${`left:${this.mid(c)[0]*100}%;top:${this.mid(c)[1]*100}%`}
            aria-label=${`${e.insertPoint} ${c+2}`} title=${e.insertPoint} data-zone-mid=${c} @pointerdown=${l=>this.insertAt(c,l)} @click=${l=>l.stopPropagation()}
            @keydown=${l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),this.insertAt(c))}}></button>`):o}
      ${this.selected!==null?this.points.map(([n,c],l)=>r`<button type="button" class=${`h ${l===0?"first":""}`} style=${`left:${n*100}%;top:${c*100}%`} aria-label=${`${e.points} ${l+1}`}
            data-zone-handle=${l} ?disabled=${!this.editing} @pointerdown=${g=>this.onDown(l,g)} @keydown=${g=>this.onKey(l,g)}></button>`):o}
    </div>`}};Q.styles=M`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .stage {
      position: relative;
      inline-size: 100%;
      border-radius: var(--sw-r-md);
      overflow: hidden;
      background: var(--sw-surface-3);
      border: 1px solid var(--sw-border);
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }
    .stage.editing {
      cursor: crosshair;
    }
    img {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
      object-fit: fill;
      display: block;
      pointer-events: none;
    }
    .noframe {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    svg {
      position: absolute;
      inset: 0;
      inline-size: 100%;
      block-size: 100%;
    }
    .zone {
      fill: color-mix(in srgb, var(--sw-accent) 18%, transparent);
      stroke: var(--sw-accent);
      stroke-width: 2;
      vector-effect: non-scaling-stroke;
      cursor: pointer;
    }
    .zone.dim {
      fill: color-mix(in srgb, var(--sw-text-3) 10%, transparent);
      stroke: color-mix(in srgb, var(--sw-text) 55%, transparent);
      cursor: default;
    }
    .draft {
      fill: color-mix(in srgb, var(--sw-warning, var(--sw-stale-text)) 22%, transparent);
      stroke: var(--sw-warning, var(--sw-stale-text));
      stroke-width: 2.5;
      stroke-dasharray: 6 4;
      vector-effect: non-scaling-stroke;
      pointer-events: none;
    }
    .name {
      position: absolute;
      transform: translate(-50%, -50%);
      padding: 1px 6px;
      border-radius: var(--sw-r-pill);
      background: color-mix(in srgb, var(--sw-surface) 85%, transparent);
      color: var(--sw-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      pointer-events: none;
      white-space: nowrap;
      direction: ltr;
    }
    .h {
      position: absolute;
      inline-size: 32px;
      block-size: 32px;
      margin: -16px 0 0 -16px;
      padding: 0;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: grab;
      touch-action: none;
    }
    .h::before {
      content: '';
      inline-size: 14px;
      block-size: 14px;
      border-radius: 50%;
      background: var(--sw-surface);
      border: 2px solid var(--sw-warning, var(--sw-stale-text));
      box-shadow: var(--sw-shadow-1);
    }
    .h.first::before {
      background: var(--sw-warning, var(--sw-stale-text));
    }
    .h:focus-visible {
      outline: none;
    }
    .h:focus-visible::before {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .h:active {
      cursor: grabbing;
    }
    /* the midpoint of an edge: a smaller, hollow handle that inserts a point */
    .m {
      position: absolute;
      inline-size: 28px;
      block-size: 28px;
      margin: -14px 0 0 -14px;
      padding: 0;
      border: 0;
      background: transparent;
      display: grid;
      place-items: center;
      cursor: copy;
      touch-action: none;
      opacity: 0.75;
    }
    .m::before {
      content: '';
      inline-size: 9px;
      block-size: 9px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--sw-surface) 80%, transparent);
      border: 2px dashed var(--sw-warning, var(--sw-stale-text));
      box-sizing: border-box;
    }
    .m:hover,
    .m:focus-visible {
      opacity: 1;
    }
    .m:focus-visible {
      outline: none;
    }
    .m:focus-visible::before {
      outline: 2px solid var(--sw-focus);
      outline-offset: 2px;
    }
  `;oe([b()],Q.prototype,"src",2);oe([b({type:Number})],Q.prototype,"aspect",2);oe([b({attribute:!1})],Q.prototype,"zones",2);oe([b()],Q.prototype,"selected",2);oe([b({attribute:!1})],Q.prototype,"points",2);oe([b({type:Boolean})],Q.prototype,"editing",2);oe([d()],Q.prototype,"broken",2);Q=oe([N("frigate-zone-editor")],Q);var ua=Object.defineProperty,ha=Object.getOwnPropertyDescriptor,S=(e,t,s,i)=>{for(var a=i>1?void 0:i?ha(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ua(t,s,a),a};let x=class extends E{constructor(){super(...arguments),this.recorderId="",this.cams=[],this.enabled=!1,this.schema=null,this.cameraId="",this.view=null,this.failed=!1,this.loading=!1,this.mode="zones",this.draft=null,this.values={},this.pending=null,this.supervised=!1,this.dialogError="",this.busy=!1,this.msg=null}connectedCallback(){super.connectedCallback(),ns(this.recorderId).then(e=>this.schema=e).catch(()=>this.failed=!0)}updated(e){if((e.has("cams")||e.has("recorderId"))&&!this.cameraId){const t=this.cams.find(s=>s.enabled);t&&this.pickCamera(t.id)}}async pickCamera(e){this.cameraId=e,this.draft=null,await this.reload()}async reload(){if(!this.cameraId)return;const e=this.cameraId;this.loading=!0;try{const t=await os(this.recorderId,e);if(e!==this.cameraId)return;this.view=t,this.values={},this.failed=!1}catch{if(e!==this.cameraId)return;this.view=null,this.failed=!0}finally{e===this.cameraId&&(this.loading=!1)}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}startNew(){this.draft={name:"",isNew:!0,points:[],objects:[],inertia:"",loitering:""}}select(e){e.points&&(this.draft={name:e.name,isNew:!1,points:e.points.map(t=>[t[0],t[1]]),objects:[...e.objects],inertia:e.inertia==null?"":String(e.inertia),loitering:e.loitering_time==null?"":String(e.loitering_time)})}draftErrors(){const e=p().control.settings.config,t=this.draft;if(!t||!this.view)return{name:null,poly:null,num:null};const s=t.isNew?Ze(t.name,this.view.camera_key,this.view.zones.map(c=>c.name)):null,i=Xe(t.points),a=this.schema?.zone.fields??[],n=(c,l)=>{const g=a.find(A=>A.key===c);return!!g&&"error"in Re(g,l)};return{name:s&&t.name?e.nameError[s]:null,poly:i&&t.points.length?e.polyError[i]:null,num:n("inertia",t.inertia)||n("loitering_time",t.loitering)?e.rangeError:null}}canSaveZone(){const e=this.draft;if(!e||!this.view?.writable)return!1;const t=this.draftErrors();return!t.name&&!t.poly&&!t.num&&!Xe(e.points)&&(!e.isNew||!Ze(e.name,this.view.camera_key,this.view.zones.map(s=>s.name)))}toggleObject(e){if(!this.draft)return;const t=this.draft.objects.includes(e);this.draft={...this.draft,objects:t?this.draft.objects.filter(s=>s!==e):[...this.draft.objects,e].sort()}}async saveZone(){const e=this.draft,t=i=>i.trim()===""?null:Number(i);return(await ls(this.recorderId,this.cameraId,e.name,{points:e.points,objects:e.objects,inertia:t(e.inertia),loitering_time:t(e.loitering)},this.supervised)).verified}async removeZone(){return(await ds(this.recorderId,this.cameraId,this.draft.name,this.supervised)).verified}sectionFields(e){return(this.schema?.settings??[]).filter(t=>t.section===e)}current(e){return this.view?.settings[e.key]??null}edited(e){if(e.key in this.values)return this.values[e.key];const t=this.current(e);return e.type==="labels"?Array.isArray(t)?t:Array.isArray(e.default)?e.default:[]:t==null?"":String(t)}sectionDiff(e){const t={};for(const s of this.sectionFields(e)){if(!(s.key in this.values))continue;const i=this.values[s.key];let a;if(s.type==="labels")a=[...i].sort();else{const n=Re(s,i);if("error"in n)return"error";a=n.value}cs(s,this.current(s),a)||(t[s.key]=a)}return t}setValue(e,t){this.values={...this.values,[e]:t}}toggleLabel(e,t){const s=this.edited(e);this.setValue(e.key,s.includes(t)?s.filter(i=>i!==t):[...s,t].sort())}ask(e){this.pending=e,this.supervised=!1,this.dialogError=""}kindOf(e){return e.kind==="settings"?"config_settings":"config_zone"}async run(){const e=this.pending;if(!e)return;const t=p().control.settings.config;this.busy=!0;try{let s;if(e.kind==="zone")s=await this.saveZone();else if(e.kind==="delete")s=await this.removeZone();else{const i=this.sectionDiff(e.section);if(i==="error")throw new Error(t.rangeError);s=(await ps(this.recorderId,this.cameraId,e.section,i,this.supervised)).verified}this.pending=null,this.draft=null,this.flash("ok",e.kind==="delete"?t.deleted:s?t.saved:t.sent),this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),await this.reload()}catch(s){this.dialogError=le(s)?p().control.settings.supervised.need:s instanceof Error&&!("body"in s)?s.message:m(s)}finally{this.busy=!1}}dialog(){const e=this.pending,t=this.view;if(!e||!t)return o;const s=p().control.settings.config,i=p().control.settings,a=this.kindOf(e),n=t.can_supervise&&!t.first_write_done[a],c=!t.can_supervise&&!t.first_write_done[a],l=e.kind==="delete"?`${s.removeTitle}: ${this.draft?.name??""}`:s.confirmTitle;return r`<sw-dialog open heading=${l} data-fcp-confirm=${e.kind} @close=${()=>this.pending=null}>
      <div class="form">
        <p class="dialog-text">${s.confirmText}</p>
        ${n?r`<label class="sup" data-supervised-box=${a}><input type="checkbox" .checked=${this.supervised} @change=${g=>this.supervised=g.target.checked} /><span><b>${i.supervised.label}</b> · ${i.supervised.hint}</span></label>`:o}
        ${c?r`<div class="err" data-fcp-blocked>${i.supervised.need}</div>`:o}
        ${this.dialogError?r`<div class="err" role="alert" data-fcp-error>${this.dialogError}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.pending=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant=${e.kind==="delete"?"danger":"primary"} data-fcp-ok ?disabled=${this.busy||c||n&&!this.supervised} @click=${()=>void this.run()}>${p().control.confirm}</sw-button>
    </sw-dialog>`}labelText(e){return p().control.settings.config.labels[e]??e}zonesView(e){const t=p().control.settings.config,s=this.draft,i=e.frame.width&&e.frame.height?e.frame.width/e.frame.height:16/9,a=this.cams.find($=>$.id===this.cameraId),n=a&&a.enabled?us(this.recorderId,this.cameraId):null,c=this.draftErrors(),l=!e.writable||this.busy,g=Array.from(new Set([...this.schema?.labels??[],...s?.objects??[]])),A=this.schema?.zone.max_zones??24;return r`<div class="grid" data-fcp-zones>
      <div>
        <frigate-zone-editor .src=${n} .aspect=${i} .zones=${e.zones} .selected=${s?s.name||"":null} .points=${s?.points??[]} ?editing=${!!s&&e.writable}
          @zone-points=${$=>s&&(this.draft={...s,points:$.detail.points})}
          @zone-pick=${$=>{const ge=e.zones.find(wt=>wt.name===$.detail.name);ge&&this.select(ge)}}></frigate-zone-editor>
      </div>
      <div class="side">
        ${s?r`<div class="form" data-fcp-zone-form>
              ${s.isNew?r`<label>${t.name}<input dir="ltr" data-fcp-zone-name maxlength="40" autocomplete="off" .value=${s.name} ?disabled=${l} @input=${$=>this.draft={...s,name:$.target.value.trim()}} /></label>
                  ${c.name?r`<div class="err" data-fcp-name-error>${c.name}</div>`:o}`:r`<div class="head"><h4 dir="ltr">${s.name}</h4></div>`}
              ${e.writable?r`<p class="note">${t.draw}</p>`:o}
              <div class="inline">
                <span class="chip" data-fcp-points>${t.points}: ${s.points.length}</span>
                <sw-button size="sm" variant="ghost" data-fcp-undo-point ?disabled=${l||!s.points.length} @click=${()=>this.draft={...s,points:s.points.slice(0,-1)}}>${t.undoPoint}</sw-button>
                <sw-button size="sm" variant="ghost" data-fcp-clear ?disabled=${l||!s.points.length} @click=${()=>this.draft={...s,points:[]}}>${t.clear}</sw-button>
              </div>
              ${c.poly?r`<div class="err" data-fcp-poly-error>${c.poly}</div>`:o}
              <div class="field"><span class="lbl">${t.objects}${s.objects.length?o:r`<span>${t.allObjects}</span>`}</span>
                <div class="chips" data-fcp-zone-objects>${g.map($=>r`<button type="button" aria-pressed=${String(s.objects.includes($))} ?disabled=${l} data-label=${$} @click=${()=>this.toggleObject($)}>${this.labelText($)}</button>`)}</div>
              </div>
              <div class="two">
                <label>${t.inertia}<input type="number" inputmode="numeric" min="1" max="10" placeholder="3" data-fcp-inertia .value=${s.inertia} ?disabled=${l} @input=${$=>this.draft={...s,inertia:$.target.value}} /></label>
                <label>${t.loitering}<input type="number" inputmode="numeric" min="0" max="3600" placeholder="0" data-fcp-loitering .value=${s.loitering} ?disabled=${l} @input=${$=>this.draft={...s,loitering:$.target.value}} /></label>
              </div>
              ${c.num?r`<div class="err">${c.num}</div>`:o}
              <div class="acts">
                ${!s.isNew&&e.writable?r`<sw-button size="sm" variant="ghost" data-fcp-delete ?disabled=${this.busy} @click=${()=>this.ask({kind:"delete"})}>${t.remove}</sw-button>`:o}
                <sw-button size="sm" data-fcp-cancel @click=${()=>this.draft=null}>${t.cancel}</sw-button>
                ${e.writable?r`<sw-button size="sm" variant="primary" data-fcp-save ?disabled=${!this.canSaveZone()||this.busy} @click=${()=>this.ask({kind:"zone"})}>${t.save}</sw-button>`:o}
              </div>
            </div>`:r`${e.zones.length?r`<ul class="zl" data-fcp-zone-list>${e.zones.map($=>r`<li><button type="button" data-zone=${$.name} ?disabled=${!$.points} title=${$.points?"":t.notEditable} @click=${()=>this.select($)}>
                  <span class="zn">${$.name}</span><span class="zs">${$.objects.length?$.objects.map(ge=>this.labelText(ge)).join(", "):t.allObjects}</span></button></li>`)}</ul>`:r`<div class="empty" data-fcp-no-zones>${t.noZones}</div>`}
            ${e.writable?r`<div class="acts"><sw-button size="sm" icon="plus" data-fcp-new-zone ?disabled=${e.zones.length>=A} @click=${()=>this.startNew()}>${t.newZone}</sw-button></div>`:o}`}
      </div>
    </div>`}field(e,t){const s=p().control.settings.config,i=s.fields[e.key]??e.key,a=this.edited(e);if(e.type==="labels"){const c=Array.from(new Set([...this.schema?.labels??[],...a]));return r`<div class="field" data-fcp-field=${e.key}><span class="lbl">${i}</span>
        <div class="chips">${c.map(l=>r`<button type="button" aria-pressed=${String(a.includes(l))} ?disabled=${t} data-label=${l} @click=${()=>this.toggleLabel(e,l)}>${this.labelText(l)}</button>`)}</div>
      </div>`}const n="error"in Re(e,a);return r`<label class="field" data-fcp-field=${e.key}><span class="lbl"><span>${i}</span>
        <button type="button" class="link" data-fcp-default ?disabled=${t||a===""} @click=${()=>this.setValue(e.key,"")}>${s.useDefault}</button></span>
      <input type="number" inputmode=${e.type==="int"?"numeric":"decimal"} min=${e.min??""} max=${e.max??""} step=${e.step??(e.type==="int"?1:"any")}
        placeholder=${e.default==null?"":`${s.defaultValue}: ${e.default}`} .value=${a} ?disabled=${t} aria-invalid=${String(n)}
        @input=${c=>this.setValue(e.key,c.target.value)} />
      ${n?r`<span class="err">${s.rangeError}</span>`:o}
    </label>`}settingsView(e){const t=p().control.settings.config,s=!e.writable||this.busy;return r`<div class="sections" data-fcp-settings>
      ${(this.schema?.sections??[]).map(i=>{const a=this.sectionDiff(i),n=a!=="error"&&Object.keys(a).length>0;return r`<div class="sect" data-fcp-section=${i}>
          <h4>${t.sections[i]??i}</h4>
          ${this.sectionFields(i).map(c=>this.field(c,s))}
          ${e.writable?r`<div class="acts"><sw-button size="sm" variant="primary" data-fcp-save-section=${i} ?disabled=${!n||this.busy} @click=${()=>this.ask({kind:"settings",section:i})}>${t.save}</sw-button></div>`:o}
        </div>`})}
    </div>`}render(){const e=p().control.settings.config,t=p().control.settings,s=this.cams.filter(a=>a.enabled).map(a=>({id:a.id,label:a.name}));if(!s.length)return r`<div class="panel"><div class="empty" data-fcp-no-cameras>${e.noCameras}</div></div>`;const i=this.view;return r`<div class="panel" data-frigate-config-panel>
      <div class="head">
        <div class="inline" style="min-inline-size: 200px; flex: 1 1 220px">
          <sw-dropdown block data-fcp-camera .label=${e.camera} .placeholder=${e.camera} .value=${this.cameraId} .items=${s} @change=${a=>void this.pickCamera(a.detail.id)}></sw-dropdown>
        </div>
        <div class="inline">
          ${this.enabled?i&&!i.writable?r`<span class="chip" data-fcp-read-only>${e.readOnly}</span>`:o:r`<span class="chip warn" data-fcp-class-off>${e.classOff}</span>`}
          <div class="seg" role="group" aria-label=${t.tabs.config}>
            <button type="button" aria-pressed=${String(this.mode==="zones")} data-fcp-mode="zones" @click=${()=>this.mode="zones"}>${e.zones}</button>
            <button type="button" aria-pressed=${String(this.mode==="settings")} data-fcp-mode="settings" @click=${()=>this.mode="settings"}>${e.settings}</button>
          </div>
        </div>
      </div>
      ${this.failed?r`<div class="msg err" data-fcp-failed>${e.unavailable}</div>`:o}
      ${this.loading&&!i?r`<sw-state-panel state="loading" compact heading=${e.loading} data-fcp-loading></sw-state-panel>`:o}
      ${i&&!this.failed?r`<div class="body" ?data-busy=${this.loading}>${this.mode==="zones"?this.zonesView(i):this.settingsView(i)}</div>`:o}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcp-msg>${this.msg.text}</div>`:o}
      ${this.dialog()}
    </div>`}};x.styles=[ce,M`
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.6fr) minmax(220px, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
    }
    @container admin (max-width: 720px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .side {
      display: grid;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .zl {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    .zl li + li {
      border-block-start: 1px solid var(--sw-border);
    }
    .zl button {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      inline-size: 100%;
      min-block-size: 44px;
      padding: var(--sw-s-2) var(--sw-s-3);
      border: 0;
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      text-align: start;
      cursor: pointer;
    }
    .zl button:hover,
    .zl button[aria-current='true'] {
      background: var(--sw-surface-2);
    }
    .zl button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .zl .zn {
      direction: ltr;
      unicode-bidi: isolate;
      font-weight: var(--sw-fw-medium);
    }
    .zl .zs {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chips button {
      min-block-size: 32px;
      padding-inline: var(--sw-s-2);
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .chips button[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .chips button:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }
    .chips button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .sect {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
    }
    .sections {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--sw-s-3);
    }
    .field {
      display: grid;
      gap: 4px;
    }
    .field .lbl {
      display: flex;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .field input {
      direction: ltr;
      text-align: start;
    }
    .link {
      border: 0;
      background: none;
      padding: 0;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      cursor: pointer;
    }
    .link:disabled {
      color: var(--sw-text-3);
      cursor: default;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
      justify-content: flex-end;
    }
    .body {
      transition: opacity var(--sw-t-fast) var(--sw-ease);
    }
    .body[data-busy] {
      opacity: 0.55;
      pointer-events: none;
    }
  `];S([b({attribute:"recorder-id"})],x.prototype,"recorderId",2);S([b({attribute:!1})],x.prototype,"cams",2);S([b({type:Boolean})],x.prototype,"enabled",2);S([d()],x.prototype,"schema",2);S([d()],x.prototype,"cameraId",2);S([d()],x.prototype,"view",2);S([d()],x.prototype,"failed",2);S([d()],x.prototype,"loading",2);S([d()],x.prototype,"mode",2);S([d()],x.prototype,"draft",2);S([d()],x.prototype,"values",2);S([d()],x.prototype,"pending",2);S([d()],x.prototype,"supervised",2);S([d()],x.prototype,"dialogError",2);S([d()],x.prototype,"busy",2);S([d()],x.prototype,"msg",2);x=S([N("frigate-config-panel")],x);var va=Object.defineProperty,fa=Object.getOwnPropertyDescriptor,U=(e,t,s,i)=>{for(var a=i>1?void 0:i?fa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&va(t,s,a),a};const ma=["classes","profiles","config","exports","cases","events","log","supervision"],rt={export_create:"export_delete",export_rename:"export_rename",case_create:"case_delete",case_rename:"case_rename",event_create:"event_end",config_zone:"config_zone",config_settings:"config_settings"};let I=class extends E{constructor(){super(...arguments),this.recorderId="",this.tab="classes",this.policy=null,this.profiles=null,this.changes=[],this.first=null,this.cams=[],this.failed=!1,this.busy=!1,this.msg=null,this.undoing=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.policy=await Se(this.recorderId),this.failed=!1}catch{this.failed=!0;return}const[e,t,s,i]=await Promise.allSettled([hs(this.recorderId),Ye(this.recorderId),Qe(this.recorderId),_t(this.recorderId)]);this.profiles=e.status==="fulfilled"?e.value:null,this.changes=t.status==="fulfilled"?t.value.changes:[],this.first=s.status==="fulfilled"?s.value:null,this.cams=i.status==="fulfilled"?i.value:[]}async afterWrite(){const[e,t,s]=await Promise.allSettled([Ye(this.recorderId),Qe(this.recorderId),Se(this.recorderId)]);e.status==="fulfilled"&&(this.changes=e.value.changes),t.status==="fulfilled"&&(this.first=t.value),s.status==="fulfilled"&&(this.policy=s.value)}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}async toggle(e,t){const s=t.currentTarget,i=s.checked;this.busy=!0;try{await vs(this.recorderId,{[e]:i}),this.policy=await Se(this.recorderId),this.dispatchEvent(new CustomEvent("frigate-control-policy",{detail:{anyOn:this.policy.classes.some(a=>a.enabled)},bubbles:!0,composed:!0}))}catch(a){s.checked=!i,this.flash("err",m(a))}finally{this.busy=!1}}async rule(e,t){const s=t.currentTarget.value;this.busy=!0;try{const i=await fs(this.recorderId,{[e]:s||null});this.profiles&&(this.profiles={...this.profiles,rules:i.rules})}catch(i){this.flash("err",m(i)),this.load()}finally{this.busy=!1}}async undo(e,t,s=!1){this.busy=!0;try{await ms(this.recorderId,e.id,t,s),this.undoing=null,this.flash("ok",p().control.settings.undone),this.afterWrite()}catch(i){this.undoing?this.undoing={...this.undoing,error:le(i)?p().control.settings.supervised.need:m(i)}:this.flash("err",le(i)?p().control.settings.supervised.need:m(i))}finally{this.busy=!1}}onUndo(e){const t=rt[e.kind],s=!!t&&!!this.first&&!this.first.done[t];e.class==="record"||e.class==="profile"||e.class==="config"||e.kind==="export_create"||e.kind==="case_create"||s?this.undoing={row:e,supervised:!1,error:""}:this.undo(e,!1)}timeText(e){try{return xt(new Date(e))}catch{return e}}statusTag(e){const t=p().control.settings;return e.status==="reverted"?r`<span class="tag" data-change-status="reverted">${t.reverted}</span>`:e.status==="failed"?r`<span class="tag bad" data-change-status="failed">${t.failed}</span>`:e.status==="unverified"?r`<span class="tag" data-change-status="unverified">${t.unverified}</span>`:o}classesTab(e){const t=p().control.settings,s=this.busy||!O("system.configure");return r`<div class="classes" data-fcs-classes>
      ${bs(e).map(i=>r`<div class="row" data-fcs-class=${i.class}>
        <span class="name"><span>${t.classes[i.class]}</span>
          <span class="sub">${i.per_action?r`<span>${t.perAction}</span>`:o}${i.confirm_actions?.includes("delete")?r`<span>${t.confirmDelete}</span>`:o}<span dir="ltr">${i.permission}</span></span></span>
        <sw-toggle .checked=${i.enabled} ?disabled=${s||!i.available} labelHidden label=${t.classes[i.class]} data-fcs-toggle=${i.class} @change=${a=>void this.toggle(i.class,a)}></sw-toggle>
      </div>`)}
    </div>`}profilesTab(){const e=p().control.settings,t=this.profiles,s=this.busy||!O("system.configure");return r`${t&&t.names.length?r`<div data-fcs-rules>
        <h4>${e.rules}</h4>
        ${t.alarm_states.filter(i=>["disarmed","armed_home","armed_away","armed_night"].includes(i)).map(i=>r`<div class="row">
          <span>${Te(i)}</span>
          <select aria-label=${Te(i)} data-fcs-rule=${i} .value=${t.rules[i]??""} ?disabled=${s} @change=${a=>void this.rule(i,a)}>
            <option value="">${e.rulesNone}</option>
            ${t.names.map(a=>r`<option value=${a} ?selected=${t.rules[i]===a}>${a}</option>`)}
          </select>
        </div>`)}
      </div>`:o}
      <frigate-auto-profile recorder-id=${this.recorderId} .first=${this.first} .canConfigure=${O("system.configure")} .canProfile=${ie("analytics.profile")} @frigate-changed=${()=>void this.afterWrite()}></frigate-auto-profile>`}logTab(){const e=p().control.settings;return r`<div data-fcs-log>
      ${this.changes.length?r`<ul>${this.changes.map(t=>r`<li class="change" data-change=${t.id}>
            <span class="what"><span>${Je(t)}${this.statusTag(t)}</span><span class="meta">${this.timeText(t.at)}${t.actor?` · ${t.actor}`:""}${t.camera_key&&t.camera_key!=="*"?` · ${this.cams.find(s=>s.id===t.camera_id)?.name??t.camera_key}`:""}</span></span>
            ${t.reversible?r`<sw-button size="sm" variant="ghost" data-change-undo ?disabled=${this.busy} @click=${()=>this.onUndo(t)}>${e.undo}</sw-button>`:o}
          </li>`)}</ul>`:r`<p class="note" data-fcs-log-empty>${e.logEmpty}</p>`}
    </div>`}undoDialog(){const e=this.undoing;if(!e)return o;const t=p().control.settings,s=p().control,i=rt[e.row.kind],a=!!i&&!!this.first&&this.first.can_supervise&&!this.first.done[i],n=!!i&&!!this.first&&!this.first.done[i]&&!this.first.can_supervise;return r`<sw-dialog open heading=${`${t.undo}: ${Je(e.row)}`} data-fcs-confirm @close=${()=>this.undoing=null}>
      <div class="form">
        ${a?r`<label class="sup" data-supervised-box=${i}><input type="checkbox" .checked=${e.supervised} @change=${c=>this.undoing={...e,supervised:c.target.checked}} /><span><b>${t.supervised.label}</b> · ${t.supervised.hint}</span></label>`:o}
        ${n?r`<div class="err" data-fcs-undo-blocked>${t.supervised.need}</div>`:o}
        ${e.error?r`<div class="err" role="alert" data-fcs-undo-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.undoing=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcs-ok ?disabled=${this.busy||n||a&&!e.supervised} @click=${()=>void this.undo(e.row,!0,e.supervised)}>${s.confirm}</sw-button>
    </sw-dialog>`}tabs(){const e=O("system.configure");return ma.filter(t=>t==="exports"?e||ie("analytics.exports"):t==="cases"?e||ie("analytics.cases"):t==="events"?e||ie("analytics.events"):!0)}render(){const e=p().control.settings;if(this.failed)return r`<div class="note" data-fcs-failed>${e.unavailable}</div>`;const t=this.policy;if(!t)return o;const s=this.tabs(),i=s.includes(this.tab)?this.tab:s[0],a=l=>t.classes.some(g=>g.class===l&&g.enabled),n=O("system.configure"),c="";return r`<div class="box" data-frigate-control-settings>
      <div class="head"><h4>${e.title}</h4>${t.classes.some(l=>l.enabled)?r`<span class="chip accent" data-fcs-any-on>${t.classes.filter(l=>l.enabled).length} ${e.classesOn}</span>`:r`<span class="chip" data-fcs-all-off>${p().summary.readOnly}</span>`}</div>
      <sw-tabs variant="underline-compact" data-fcs-tabs .items=${s.map(l=>({id:l,label:e.tabs[l]}))} .active=${i} @change=${l=>this.tab=l.detail.id}></sw-tabs>
      ${i==="classes"?this.classesTab(t):o}
      ${i==="profiles"?this.profilesTab():o}
      ${i==="config"?r`<frigate-config-panel recorder-id=${this.recorderId} .cams=${this.cams} .enabled=${a("config")} @frigate-changed=${()=>void this.afterWrite()}></frigate-config-panel>`:o}
      ${i==="exports"?r`<frigate-exports-panel recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .allowed=${n||ie("analytics.exports")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-exports-panel>`:o}
      ${i==="cases"?r`<frigate-cases-panel recorder-id=${this.recorderId} .first=${this.first} .allowed=${n||ie("analytics.cases")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-cases-panel>`:o}
      ${i==="events"?r`<frigate-manual-events recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .changes=${this.changes} .enabled=${a("events")} .allowed=${n||ie("analytics.events")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-manual-events>`:o}
      ${i==="log"?this.logTab():o}
      ${i==="supervision"?r`<frigate-supervision recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .canPlayback=${ie("video.playback")}></frigate-supervision>`:o}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcs-msg>${this.msg.text}</div>`:o}
      ${this.undoDialog()}
    </div>`}};I.styles=[ce,M`
    .box {
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      padding: var(--sw-s-3);
      display: grid;
      gap: var(--sw-s-3);
      font-size: var(--sw-fs-sm);
    }
    .box > .head h4 {
      font-size: var(--sw-fs-md);
    }
    sw-tabs {
      max-inline-size: 100%;
    }
    .classes {
      display: grid;
      gap: 2px;
    }
    .classes .row {
      padding: var(--sw-s-1) 0;
      border-block-start: 1px solid var(--sw-border);
    }
    .classes .row:first-child {
      border-block-start: 0;
    }
    .classes .sub {
      display: flex;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-2);
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      min-block-size: 32px;
      max-inline-size: 50%;
    }
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 0;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      overflow: hidden;
    }
    li.change {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      padding: var(--sw-s-2) var(--sw-s-3);
      border-block-start: 1px solid var(--sw-border);
      min-block-size: 44px;
    }
    li.change:first-child {
      border-block-start: 0;
    }
    li.change .what {
      display: grid;
      gap: 2px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    li.change .meta {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .tag {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-inline-start: 4px;
    }
    .tag.bad {
      color: var(--sw-danger-text);
    }
  `];U([b({attribute:"recorder-id"})],I.prototype,"recorderId",2);U([d()],I.prototype,"tab",2);U([d()],I.prototype,"policy",2);U([d()],I.prototype,"profiles",2);U([d()],I.prototype,"changes",2);U([d()],I.prototype,"first",2);U([d()],I.prototype,"cams",2);U([d()],I.prototype,"failed",2);U([d()],I.prototype,"busy",2);U([d()],I.prototype,"msg",2);U([d()],I.prototype,"undoing",2);I=U([N("frigate-control-settings")],I);var ba=Object.defineProperty,ga=Object.getOwnPropertyDescriptor,H=(e,t,s,i)=>{for(var a=i>1?void 0:i?ga(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ba(t,s,a),a};const wa="מיד: בלי שידור חי, ניגון ואירועים מה־NVR הזה. המצלמות שלו יורדות מהקיר ומבחירת המצלמות; בטבלת המצלמות ובמפה הן נשארות, בלי תמונה. ההיסטוריה נשמרת.",$a="ה־NVR חוזר לפעול מיד, והמצלמות שלו חוזרות לקיר.",ya={online:"live",error:"error",unknown:"unknown",pending_restart:"stale",disabled:"neutral",not_configured:"neutral",unreadable:"error",refused:"error",removed:"neutral"};let D=class extends E{constructor(){super(...arguments),this.loadState="loading",this.loadError="",this.data=null,this.open="",this.renaming="",this.nameDraft="",this.toggling=null,this.adding=!1,this.busy=!1,this.msg=null,this.fallback=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),fe()&&O("system.configure")&&!me()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}async load(){try{const e=await gs();this.fallback=!Array.isArray(e?.recorders),this.data=this.fallback?null:e,this.loadState="ready",this.loadError=""}catch(e){if(e instanceof Ie&&e.status===404){this.fallback=!0,this.loadState="ready";return}this.loadError=m(e),this.loadState="error"}}async rename(e){const t=this.nameDraft.trim();if(!(!t||this.busy)){this.busy=!0;try{await et(e.id,{name:t}),this.renaming="",this.msg={tone:"ok",text:"השם נשמר"},await this.load()}catch(s){this.msg={tone:"err",text:m(s)}}finally{this.busy=!1}}}async toggle(e){if(!this.busy){this.busy=!0;try{const t=await et(e.id,{enabled:!e.enabled});this.toggling=null,this.msg={tone:"ok",text:e.enabled?"ה־NVR הושבת":"ה־NVR הופעל"},t.restart_required&&zt(!0),await this.load()}catch(t){this.toggling=null,this.msg={tone:"err",text:m(t)}}finally{this.busy=!1}}}changed(e){this.msg={tone:"ok",text:e},this.adding=!1,this.load()}row(e){const t=e.status.state,s=[e.vendor_label,e.model].filter(Boolean).join(" · "),i=this.open===e.id;return r`<li class="rec" data-recorder=${e.id} data-recorder-state=${t}>
      <div class="head">
        <div class="who">
          ${this.renaming===e.id?r`<input class="name-in" data-recorder-name-input maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}
                @keydown=${a=>{a.key==="Enter"&&this.rename(e),a.key==="Escape"&&(this.renaming="")}} />`:r`<span class="name" data-recorder-name>${e.name}</span>`}
          <span class="meta">${s}</span>
        </div>
        <div class="facts">
          <sw-badge kind=${ya[t]??"neutral"} label=${ws[t]??t} data-recorder-status></sw-badge>
          <span class="cams" data-recorder-cameras>${e.cameras} מצלמות</span>
        </div>
      </div>
      <div class="actions">
        ${this.renaming===e.id?r`<sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${this.busy||!this.nameDraft.trim()} data-recorder-name-save @click=${()=>this.rename(e)}>שמור</sw-button>
              <sw-button size=${this.btn} variant="ghost" @click=${()=>this.renaming=""}>ביטול</sw-button>`:r`<sw-button size=${this.btn} icon="link" data-recorder-connection aria-expanded=${String(i)} @click=${()=>this.open=i?"":e.id}>חיבור</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="edit" data-recorder-rename @click=${()=>{this.renaming=e.id,this.nameDraft=e.name,this.msg=null}}>שם</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="power" data-recorder-toggle @click=${()=>this.toggling=e}>${e.enabled?"השבת":"הפעל"}</sw-button>`}
      </div>
      ${i?r`<div class="conn" data-recorder-connection-form>
            <nvr-connection-form context="settings" recorder-id=${e.id}
              @nvr-connection-saved=${()=>this.changed("נשמר")} @nvr-connection-removed=${()=>{this.open="",this.changed("ה־NVR הוסר")}}></nvr-connection-form>
            ${e.vendor==="frigate"&&t==="online"?r`<frigate-summary recorder-id=${e.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${e.id} data-recorder-frigate-control></frigate-control-settings>`:o}
          </div>`:o}
    </li>`}addDialog(){return r`<sw-dialog open wide heading="הוספת NVR" data-recorder-add-dialog @close=${()=>this.adding=!1}>
      <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed("ה־NVR נוסף")}></nvr-connection-form>
    </sw-dialog>`}render(){if(!fe()||!O("system.configure"))return o;if(me())return r`<sw-card heading="חיבור ל־NVR" data-nvr-connection><p class="local-only" data-nvr-local-only role="status">${Ct}</p></sw-card>`;if(this.loadState==="loading")return r`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="loading" compact heading="קורא…"></sw-state-panel></sw-card>`;if(this.fallback)return r`<sw-card heading="חיבור ל־NVR" data-nvr-connection><nvr-connection-form context="settings"></nvr-connection-form></sw-card>`;if(this.loadState==="error"||!this.data)return r`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="error" compact heading="רשימת המקליטים לא נטענה" hint=${this.loadError} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-card>`;const e=this.data.recorders.filter(s=>!s.removed);if(!e.length&&this.data.primary_has_history)return r`<sw-card heading="חיבור ל־NVR" data-nvr-connection data-recorder-add-new>
        <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed("ה־NVR נוסף")}></nvr-connection-form>
        ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
      </sw-card>`;if(e.length<=1){const s=e[0],i=!!s&&s.connection?.vendor&&s.connection.vendor!=="none"&&s.connection.state!=="not_chosen";return r`<sw-card heading="חיבור ל־NVR" data-nvr-connection>
        <nvr-connection-form context="settings" recorder-id=${s?.id??"nvr-1"} @nvr-connection-saved=${()=>void this.load()} @nvr-connection-removed=${()=>void this.load()}></nvr-connection-form>
        ${s?.vendor==="frigate"&&s.status.state==="online"?r`<frigate-summary recorder-id=${s.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${s.id} data-recorder-frigate-control></frigate-control-settings>`:o}
        ${i?r`<div class="actions add-one"><sw-button size=${this.btn} icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>הוסף NVR</sw-button></div>`:o}
        ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
        ${this.adding?this.addDialog():o}
      </sw-card>`}const t=this.toggling;return r`<sw-card heading="מקליטים (NVR)" data-nvr-recorders data-nvr-connection>
      <ul class="list" data-recorder-list>${e.map(s=>this.row(s))}</ul>
      <div class="actions">
        <sw-button size=${this.btn} variant="primary" icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>הוסף NVR</sw-button>
      </div>
      ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
      ${this.adding?this.addDialog():o}
      ${t?r`<sw-dialog open heading=${t.enabled?"השבתת NVR":"הפעלת NVR"} subheading=${t.name} data-recorder-toggle-dialog @close=${()=>this.toggling=null}>
            <div class="dlg" data-recorder-toggle-text>${t.enabled?wa:$a}</div>
            <div slot="footer">
              <sw-button variant=${t.enabled?"danger":"primary"} ?disabled=${this.busy} data-recorder-toggle-confirm @click=${()=>this.toggle(t)}>${t.enabled?"השבת":"הפעל"}</sw-button>
              <sw-button variant="ghost" @click=${()=>this.toggling=null}>ביטול</sw-button>
            </div>
          </sw-dialog>`:o}
    </sw-card>`}};D.styles=M`
    .local-only {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    :host {
      display: block;
      min-inline-size: 0;
    }
    .list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    /* one recorder per row: name and model, the state badge beside the camera count, the actions; the tone bar at the start edge says
       error / pending restart / disabled at a glance (the badge carries the word) */
    .rec {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px 0 12px 0;
      padding-inline-start: 12px;
      border-block-end: 1px solid var(--sw-border);
      min-inline-size: 0;
      position: relative;
    }
    .rec::before {
      content: '';
      position: absolute;
      inset-block: 10px;
      inset-inline-start: 0;
      inline-size: 3px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-border-strong);
    }
    .rec[data-recorder-state='online']::before {
      background: var(--sw-live);
    }
    .rec[data-recorder-state='error']::before,
    .rec[data-recorder-state='unreadable']::before,
    .rec[data-recorder-state='refused']::before {
      background: var(--sw-danger);
    }
    .rec[data-recorder-state='pending_restart']::before {
      background: var(--sw-stale);
    }
    .rec[data-recorder-state='disabled'] .name,
    .rec[data-recorder-state='disabled'] .meta {
      color: var(--sw-text-3);
    }
    .rec:last-child {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .meta,
    .cams,
    .dlg,
    .line {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .facts {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .add-one {
      margin-block-start: 12px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
    }
    .conn {
      padding: 10px 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2);
      min-inline-size: 0;
    }
    .name-in {
      font: inherit;
      min-block-size: var(--sw-touch-desktop);
      max-inline-size: 100%;
      inline-size: 260px;
      box-sizing: border-box;
      padding: 4px 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    .name-in:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .line {
      margin-block-start: 8px;
    }
    .line.ok {
      color: var(--sw-success-text);
    }
    .line.err {
      color: var(--sw-danger-text);
    }
    @media (max-width: 767px) {
      .name-in {
        min-block-size: 44px;
        inline-size: 100%;
      }
    }
  `;H([d()],D.prototype,"loadState",2);H([d()],D.prototype,"loadError",2);H([d()],D.prototype,"data",2);H([d()],D.prototype,"open",2);H([d()],D.prototype,"renaming",2);H([d()],D.prototype,"nameDraft",2);H([d()],D.prototype,"toggling",2);H([d()],D.prototype,"adding",2);H([d()],D.prototype,"busy",2);H([d()],D.prototype,"msg",2);H([d()],D.prototype,"fallback",2);D=H([N("nvr-recorders-card")],D);const ka=()=>q("system/secrets"),_a=(e,t)=>be(`system/secrets/${encodeURIComponent(e)}`,{value:t}),xa=e=>Rt(`system/secrets/${encodeURIComponent(e)}`,{method:"DELETE"}),za=(e,t)=>V(`system/secrets/${encodeURIComponent(e)}/test`,t===void 0?{}:{value:t}),Ca={ok:"החיבור תקין",unauthorized:"go2rtc דחה את הסיסמה",unreachable:"go2rtc לא ענה",error:"go2rtc החזיר שגיאה",not_configured:"כתובת go2rtc לא הוגדרה",username_missing:"שם המשתמש לא הוגדר בהגדרות החיבור של ההתקנה",wiskey_unavailable:"נתוני WisKey אינם זמינים כרגע",no_station:"אין עמדה מחוברת עם מצלמה שמשתמשת בחשבון המשותף",station_failed:"לא התקבלה תמונה מהעמדה (סיסמה שגויה או מצלמה שלא ענתה)",go2rtc_unauthorized:"go2rtc דחה את פרטי הגישה שלו"};var Ra=Object.defineProperty,Sa=Object.getOwnPropertyDescriptor,ae=(e,t,s,i)=>{for(var a=i>1?void 0:i?Sa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&Ra(t,s,a),a};const Oa={set:["live","מוגדר"],not_set:["neutral","לא מוגדר"],unreadable:["error","לא ניתן לפענוח"],legacy:["partial","מהגדרה ישנה"]};function nt(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let G=class extends E{constructor(){super(...arguments),this.items=null,this.editing=null,this.draft="",this.confirmClear=null,this.busy=!1,this.error="",this.tests={},this.restartNote=!1}connectedCallback(){super.connectedCallback(),me()||this.load()}async load(){try{this.items=(await ka()).secrets}catch(e){this.error=m(e)}}replaceItem(e){this.items=(this.items??[]).map(t=>t.name===e.name?e:t)}async run(e){this.busy=!0,this.error="";try{return await e()}catch(t){return this.error=m(t),null}finally{this.busy=!1}}async save(e){const t=await this.run(()=>_a(e,this.draft));if(!t)return;this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required,this.editing=null,this.draft="";const{[e]:s,...i}=this.tests;this.tests=i}async clear(e){const t=await this.run(()=>xa(e));this.confirmClear=null,t&&(this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required)}async test(e,t){const s=await this.run(()=>za(e,t));s&&(this.tests={...this.tests,[e]:s})}status(e){if(e.state==="unreadable")return"הערך השמור אינו ניתן לפענוח (מפתח ההתקנה השתנה) - יש להזין אותו מחדש";if(e.state==="legacy")return e.source==="environment"?"בשימוש ממשתנה סביבה של הרצת פיתוח":"בשימוש מהגדרת התוסף הישנה - יועבר בהפעלה הבאה";if(!e.configured)return e.updated_at?`נמחק ${nt(e.updated_at)}${e.updated_by_name?` · ${e.updated_by_name}`:""}`:"לא הוגדר";const t=e.source==="addon_import"?"הועבר מהגדרות התוסף":e.updated_by_name??"";return`הוגדר ${nt(e.updated_at)}${t?` · ${t}`:""}`}renderRow(e){const[t,s]=Oa[e.state]??["neutral",e.state],i=this.tests[e.name],a=this.editing===e.name||e.state==="not_set"||e.state==="unreadable";return r`<div class="row" data-secret-row=${e.name}>
      <span class="lbl">${e.label_he}<span class="muted"><span class="ltr">${e.name}</span> · <span data-secret-status>${this.status(e)}</span></span>
        ${i?r`<span class=${`muted ${i.ok?"ok":"bad"}`} data-secret-test-result=${i.code}>${Ca[i.code]??i.code}</span>`:o}</span>
      <span class="acts"><sw-badge kind=${t} label=${s} data-secret-state=${e.state}></sw-badge>
        ${a?r`<input type="password" autocomplete="new-password" spellcheck="false" .value=${this.editing===e.name?this.draft:""} aria-label=${e.label_he} data-secret-input
                @focus=${()=>{this.editing!==e.name&&(this.editing=e.name,this.draft="")}}
                @input=${n=>{this.editing=e.name,this.draft=n.target.value}} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-save @click=${()=>void this.save(e.name)}>שמור</sw-button>
              ${e.testable?r`<sw-button size="sm" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-test @click=${()=>void this.test(e.name,this.draft)}>בדוק</sw-button>`:o}
              ${e.configured||this.editing===e.name?r`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>{this.editing=null,this.draft=""}}>ביטול</sw-button>`:o}`:this.confirmClear===e.name?r`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear-confirm @click=${()=>void this.clear(e.name)}>מחק סופית</sw-button>
                <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirmClear=null}>ביטול</sw-button>`:r`<sw-button size="sm" ?disabled=${this.busy} data-secret-replace @click=${()=>{this.editing=e.name,this.draft=""}}>החלף</sw-button>
                ${e.testable?r`<sw-button size="sm" ?disabled=${this.busy} data-secret-test-stored @click=${()=>void this.test(e.name)}>בדוק חיבור</sw-button>`:o}
                ${e.state==="set"?r`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear @click=${()=>this.confirmClear=e.name}>מחק</sw-button>`:o}`}
      </span>
    </div>`}render(){const e=me()?r`<div class="hint" data-secrets-local-only>${St}</div>`:this.items?r`${this.items.map(t=>this.renderRow(t))}
            ${this.restartNote?r`<div class="hint" data-secrets-restart>השינוי חל מיד על המסכים; שירותי הרקע (סנכרון זרמי go2rtc, ערוצי WisKey) יקבלו אותו בהפעלה הבאה של המערכת.</div>`:o}`:this.error?o:r`<div class="hint">טוען…</div>`;return r`<sw-card heading="סודות" subheading="Secrets · סיסמאות ומפתחות של שירותים חיצוניים, שמורים מוצפנים · הערכים עצמם אינם מוצגים שוב" data-secrets>
      ${e}
      ${this.error?r`<div class="err" role="alert" data-secrets-error>${this.error}</div>`:o}
    </sw-card>`}};G.styles=M`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    input {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      inline-size: min(280px, 100%);
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .bad {
      color: var(--sw-danger-text);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .hint {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      padding-block: 6px;
    }
  `;ae([d()],G.prototype,"items",2);ae([d()],G.prototype,"editing",2);ae([d()],G.prototype,"draft",2);ae([d()],G.prototype,"confirmClear",2);ae([d()],G.prototype,"busy",2);ae([d()],G.prototype,"error",2);ae([d()],G.prototype,"tests",2);ae([d()],G.prototype,"restartNote",2);G=ae([N("sw-secrets-card")],G);const Pe=["prepared","publishing","published","confirmed","switching","switched","retiring"],Ea=()=>q("system/bridge-key"),ot=e=>be("system/bridge-key/settings",e),lt=e=>V("system/bridge-key/rotations",{mode:e,confirm:!0}),Na=e=>V(`system/bridge-key/rotations/${encodeURIComponent(e)}/resume`);function Ta(e){return typeof e.door_commands_paused=="boolean"?e.door_commands_paused:e.enabled?e.rotation&&Pe.includes(e.rotation.state)?!0:e.last?.state==="needs_repair":!1}const Le={title:"מפתח הגשר",stateOff:"כבוי",stateReady:"מוכן",stateRotating:"בהחלפה",stateAttention:"דורש טיפול",keyId:"מזהה מפתח",generation:"דור",since:"פעיל מאז",lastRotation:"החלפה אחרונה",none:"אין",switchLabel:"החלפת מפתח",reminder:"תזכורת להחלפה",reminderOff:"ללא",reminderDays:"כל {n} ימים",reminderDue:"הגיע זמן להחליף מפתח",rotate:"החלפת מפתח",hardCut:"החלפה מיידית",resume:"השלמת החלפה",confirmRotate:"להחליף את מפתח הגשר? שני המפתחות יפעלו יחד עד 3 דקות.",confirmHardCut:"להחליף מיד? המפתח הישן יפסיק לפעול מיד.",confirm:"אישור",cancel:"ביטול",retireAt:"המפתח הישן יבוטל ב־{t}",saved:"נשמר",modeRoutine:"רגילה",modeHardCut:"מיידית",st_prepared:"מכין",st_publishing:"שולח לגשר",st_published:"הגשר קיבל",st_confirmed:"אומת בגשר",st_switching:"מחליף",st_switched:"הוחלף",st_retiring:"מבטל את הישן",st_retired:"המפתח הישן בוטל",st_verified:"הושלם",st_verify_failed:"האימות נכשל",st_rolled_back:"בוטל, חזרה למפתח הקודם",st_needs_repair:"נדרש זיווג מחדש",bl_rotation_off:"ההחלפה כבויה",bl_rotation_not_permitted:"דורש אישור הפעלה מבעל המערכת",bl_peer_unavailable:"הגשר טרם עודכן",bl_rotation_in_progress:"החלפה מתבצעת",bl_repair_required:"יש להשלים החלפה קודמת",bl_key_unreadable:"המפתח אינו קריא במכונה זו",bl_not_paired:"הגשר לא צומד",doorsPaused:"פתיחת דלתות מרחוק מושהית בזמן החלפת המפתח",hygieneNote:"החלפת מפתח היא תחזוקה שוטפת בלבד, לא טיפול בדליפה. חושדים שהמפתח דלף? יש לבצע צימוד מחדש.",autoWaiting:"ממתין לעדכון הגשר. ההחלפה תתחיל מעצמה.",autoScheduled:"ההחלפה תתחיל מעצמה בקרוב.",autoIdle:"המפתח הוחלף. אין צורך בפעולה.",autoAwaitClick:"הגשר מוכן. החלפת המפתח הראשונה מתחילה בלחיצה אחת.",startFirst:"התחלת החלפה"},Pa={title:"Bridge key",stateOff:"Off",stateReady:"Ready",stateRotating:"Rotating",stateAttention:"Needs attention",keyId:"Key id",generation:"Generation",since:"Active since",lastRotation:"Last rotation",none:"None",switchLabel:"Key rotation",reminder:"Rotation reminder",reminderOff:"None",reminderDays:"Every {n} days",reminderDue:"Time to rotate the key",rotate:"Rotate key",hardCut:"Immediate rotation",resume:"Finish rotation",confirmRotate:"Rotate the bridge key? Both keys work together for up to 3 minutes.",confirmHardCut:"Rotate now? The old key stops working at once.",confirm:"Confirm",cancel:"Cancel",retireAt:"The old key is retired at {t}",saved:"Saved",modeRoutine:"Routine",modeHardCut:"Immediate",st_prepared:"Preparing",st_publishing:"Sending to the bridge",st_published:"Bridge received",st_confirmed:"Bridge verified",st_switching:"Switching",st_switched:"Switched",st_retiring:"Retiring the old key",st_retired:"Old key retired",st_verified:"Done",st_verify_failed:"Verification failed",st_rolled_back:"Cancelled, back to the previous key",st_needs_repair:"Re-pairing required",bl_rotation_off:"Rotation is off",bl_rotation_not_permitted:"Needs the owner’s activation permit",bl_peer_unavailable:"The bridge has not been updated yet",bl_rotation_in_progress:"A rotation is running",bl_repair_required:"Finish the previous rotation first",bl_key_unreadable:"The key cannot be read on this machine",bl_not_paired:"The bridge is not paired",doorsPaused:"Doors paused during key rotation",hygieneNote:"Key rotation is routine hygiene only, not a fix for a leak. If you suspect the key leaked, re-pair the bridge.",autoWaiting:"Waiting for the bridge update. The rotation starts by itself.",autoScheduled:"The rotation will start by itself shortly.",autoIdle:"The key has been rotated. Nothing to do.",autoAwaitClick:"The bridge is ready. The first key rotation starts with one click.",startFirst:"Start rotation"},Ia={title:"مفتاح الجسر",stateOff:"متوقف",stateReady:"جاهز",stateRotating:"قيد التبديل",stateAttention:"يحتاج إلى معالجة",keyId:"معرّف المفتاح",generation:"الجيل",since:"نشط منذ",lastRotation:"آخر تبديل",none:"لا يوجد",switchLabel:"تبديل المفتاح",reminder:"تذكير بالتبديل",reminderOff:"بدون",reminderDays:"كل {n} يومًا",reminderDue:"حان وقت تبديل المفتاح",rotate:"تبديل المفتاح",hardCut:"تبديل فوري",resume:"إكمال التبديل",confirmRotate:"هل تريد تبديل مفتاح الجسر؟ يعمل المفتاحان معًا حتى 3 دقائق.",confirmHardCut:"هل تريد التبديل الآن؟ يتوقف المفتاح القديم فورًا.",confirm:"تأكيد",cancel:"إلغاء",retireAt:"يُلغى المفتاح القديم في {t}",saved:"تم الحفظ",modeRoutine:"عادي",modeHardCut:"فوري",st_prepared:"قيد التحضير",st_publishing:"يُرسل إلى الجسر",st_published:"استلمه الجسر",st_confirmed:"تحقق منه الجسر",st_switching:"قيد التبديل",st_switched:"تم التبديل",st_retiring:"يُلغى المفتاح القديم",st_retired:"أُلغي المفتاح القديم",st_verified:"اكتمل",st_verify_failed:"فشل التحقق",st_rolled_back:"أُلغي، عودة إلى المفتاح السابق",st_needs_repair:"يلزم إعادة الاقتران",bl_rotation_off:"التبديل متوقف",bl_rotation_not_permitted:"يحتاج إلى إذن تشغيل من المالك",bl_peer_unavailable:"لم يتم تحديث الجسر بعد",bl_rotation_in_progress:"يجري تبديل",bl_repair_required:"أكمل التبديل السابق أولًا",bl_key_unreadable:"لا يمكن قراءة المفتاح على هذا الجهاز",bl_not_paired:"الجسر غير مقترن",doorsPaused:"فتح الأبواب متوقف مؤقتًا أثناء تبديل المفتاح",hygieneNote:"تبديل المفتاح صيانة دورية فقط وليس علاجًا لتسرّب. إذا اشتبهت بتسرّب المفتاح فأعد اقتران الجسر.",autoWaiting:"بانتظار تحديث الجسر. سيبدأ التبديل تلقائيًا.",autoScheduled:"سيبدأ التبديل تلقائيًا قريبًا.",autoIdle:"تم تبديل المفتاح. لا حاجة لأي إجراء.",autoAwaitClick:"الجسر جاهز. يبدأ أول تبديل للمفتاح بنقرة واحدة.",startFirst:"بدء التبديل"},Da={title:"Ключ моста",stateOff:"Выключено",stateReady:"Готово",stateRotating:"Идёт замена",stateAttention:"Требует внимания",keyId:"Идентификатор ключа",generation:"Поколение",since:"Активен с",lastRotation:"Последняя замена",none:"Нет",switchLabel:"Замена ключа",reminder:"Напоминание о замене",reminderOff:"Нет",reminderDays:"Каждые {n} дн.",reminderDue:"Пора заменить ключ",rotate:"Заменить ключ",hardCut:"Немедленная замена",resume:"Завершить замену",confirmRotate:"Заменить ключ моста? Оба ключа работают вместе до 3 минут.",confirmHardCut:"Заменить сейчас? Старый ключ сразу перестанет работать.",confirm:"Подтвердить",cancel:"Отмена",retireAt:"Старый ключ будет отозван в {t}",saved:"Сохранено",modeRoutine:"Обычная",modeHardCut:"Немедленная",st_prepared:"Подготовка",st_publishing:"Отправка на мост",st_published:"Мост получил",st_confirmed:"Мост подтвердил",st_switching:"Переключение",st_switched:"Переключено",st_retiring:"Отзыв старого ключа",st_retired:"Старый ключ отозван",st_verified:"Готово",st_verify_failed:"Проверка не прошла",st_rolled_back:"Отменено, возврат к прежнему ключу",st_needs_repair:"Нужно повторное сопряжение",bl_rotation_off:"Замена выключена",bl_rotation_not_permitted:"Нужно разрешение владельца на включение",bl_peer_unavailable:"Мост ещё не обновлён",bl_rotation_in_progress:"Идёт замена",bl_repair_required:"Сначала завершите прошлую замену",bl_key_unreadable:"Ключ не читается на этой машине",bl_not_paired:"Мост не сопряжён",doorsPaused:"Открытие дверей приостановлено на время замены ключа",hygieneNote:"Замена ключа - это только плановая гигиена, а не лечение утечки. Если вы подозреваете утечку ключа, выполните повторное сопряжение моста.",autoWaiting:"Ожидается обновление моста. Замена начнётся автоматически.",autoScheduled:"Замена скоро начнётся автоматически.",autoIdle:"Ключ заменён. Действий не требуется.",autoAwaitClick:"Мост готов. Первая замена ключа запускается одним нажатием.",startFirst:"Начать замену"};function Me(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}const Aa={he:Le,en:Pa,ar:Ia,ru:Da};function f(e,t,s=Me()){const i=Aa[s][e]??Le[e]??e;return t?i.replace(/\{(\w+)\}/g,(a,n)=>n in t?String(t[n]):a):i}function dt(e,t,s=Me()){if(!t)return"";const i=`${e}${t}`;return i in Le?f(i,void 0,s):t}var Ba=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,pe=(e,t,s,i)=>{for(var a=i>1?void 0:i?ja(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&Ba(t,s,a),a};function Oe(e){if(!e)return"";const t=new Date(e),s={he:"he-IL",en:"en-GB",ar:"ar",ru:"ru-RU"}[Me()];return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let se=class extends E{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.asking=null,this.saved=!1}connectedCallback(){if(super.connectedCallback(),me()){this.notShown=!0;return}this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}schedule(){window.clearTimeout(this.timer),!!this.s?.rotation&&Pe.includes(this.s.rotation.state)&&(this.timer=window.setTimeout(()=>void this.load(),5e3))}async load(){try{this.s=await Ea(),this.error=""}catch(e){const t=e.status;t===403||t===404?this.notShown=!0:this.error=m(e)}this.schedule()}async run(e){this.busy=!0,this.error="",this.saved=!1;try{await e()}catch(t){this.error=m(t)}finally{this.busy=!1}await this.load()}overall(e){return e.rotation&&Pe.includes(e.rotation.state)?["partial",f("stateRotating")]:e.last&&(e.last.state==="needs_repair"||e.last.state==="verify_failed")?["error",f("stateAttention")]:e.key&&e.key.readable===!1?["error",f("stateAttention")]:e.enabled?["live",f("stateReady")]:["neutral",f("stateOff")]}renderAsk(){if(!this.asking)return o;const e=this.asking;return r`<div class="row" data-bridge-key-confirm=${e}>
      <span class="val">${f(e==="hard_cut"?"confirmHardCut":"confirmRotate")}</span>
      <span class="acts">
        <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-confirm-yes
          @click=${()=>{this.asking=null,this.run(()=>lt(e))}}>${f("confirm")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.asking=null}>${f("cancel")}</sw-button>
      </span>
    </div>`}render(){if(this.notShown)return o;const e=this.s;if(!e)return this.error?r`<p class="err" role="alert">${this.error}</p>`:o;const[t,s]=this.overall(e),i=e.rotation,a=e.last,n=a&&a.state==="needs_repair"?a:null,c=e.blocked_by?dt("bl_",e.blocked_by):"";return r`<sw-card heading=${f("title")} data-bridge-key>
      <div class="row">
        <span class="lbl">${f("switchLabel")}</span>
        <span class="acts">
          <sw-badge kind=${t} label=${s} data-bridge-key-state></sw-badge>
          <sw-toggle .checked=${e.enabled} ?disabled=${this.busy||!e.enabled&&!e.go_live_permitted} label=${f("switchLabel")} labelHidden
            data-bridge-key-switch @change=${l=>void this.run(()=>ot({enabled:l.detail.checked}))}></sw-toggle>
        </span>
      </div>
      <div class="row">
        <span class="lbl">${f("keyId")}</span>
        <span class="val ltr" data-bridge-key-kid>${e.key?`${e.key.kid} · ${f("generation")} ${e.key.generation}`:f("none")}</span>
      </div>
      ${e.key?r`<div class="row"><span class="lbl">${f("since")}</span><span class="val">${Oe(e.key.activated_at??e.key.created_at)}</span></div>`:o}
      <div class="row">
        <span class="lbl">${f("lastRotation")}</span>
        <span class="val" data-bridge-key-last>${i??a?`${Oe((i??a).ended_at??(i??a).started_at)} · ${f((i??a).mode==="hard_cut"?"modeHardCut":"modeRoutine")} · ${dt("st_",(i??a).state)}`:f("none")}</span>
      </div>
      <div class="row" data-bridge-key-auto>
        <span class="val" role="status">${e.automatic==="awaiting_click"?f("autoAwaitClick"):e.automatic==="waiting_for_bridge"?f("autoWaiting"):e.automatic==="scheduled"?f("autoScheduled"):e.automatic==="idle"?f("autoIdle"):""}</span>
        ${e.automatic==="awaiting_click"&&e.can_start?r`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-start-first @click=${()=>void this.run(()=>lt("routine"))}>${f("startFirst")}</sw-button>`:o}
      </div>
      ${Ta(e)?r`<div class="note" role="status" data-bridge-key-doors-paused>${f("doorsPaused")}</div>`:o}
      <div class="note" data-bridge-key-hygiene>${f("hygieneNote")}</div>
      ${i?.retire_at?r`<div class="note" role="status">${f("retireAt",{t:Oe(i.retire_at)})}</div>`:o}
      <div class="row">
        <span class="lbl">${f("reminder")}</span>
        <span class="acts">
          ${e.reminder_due?r`<sw-badge kind="stale" label=${f("reminderDue")} data-bridge-key-reminder-due></sw-badge>`:o}
          <select aria-label=${f("reminder")} ?disabled=${this.busy} data-bridge-key-reminder
            @change=${l=>{const g=Number(l.target.value);this.run(async()=>{await ot({reminder_days:g}),this.saved=!0})}}>
            ${e.reminder_values.map(l=>r`<option value=${l} ?selected=${l===e.reminder_days}>${l?f("reminderDays",{n:l}):f("reminderOff")}</option>`)}
          </select>
        </span>
      </div>
      ${this.renderAsk()}
      <div class="row">
        <span class="val" data-bridge-key-blocked>${c}</span>
        <span class="acts">
          ${n?r`<sw-button size="sm" ?disabled=${this.busy} data-bridge-key-resume @click=${()=>void this.run(()=>Na(n.id))}>${f("resume")}</sw-button>`:o}
          <sw-button size="sm" variant="primary" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-rotate
            @click=${()=>this.asking="routine"}>${f("rotate")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-hard-cut
            @click=${()=>this.asking="hard_cut"}>${f("hardCut")}</sw-button>
        </span>
      </div>
      ${this.error?r`<p class="err" role="alert">${this.error}</p>`:o}
      ${this.saved?r`<p class="ok" role="status">${f("saved")}</p>`:o}
    </sw-card>`}};se.styles=M`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl,
    .val,
    .note,
    .err,
    .ok {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .val {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    select {
      min-block-size: 36px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding-inline: 8px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) and (pointer: coarse) {
      select {
        min-block-size: 44px;
      }
      sw-button {
        --sw-ctl-h-sm: 44px;
      }
    }
  `;pe([d()],se.prototype,"s",2);pe([d()],se.prototype,"notShown",2);pe([d()],se.prototype,"busy",2);pe([d()],se.prototype,"error",2);pe([d()],se.prototype,"asking",2);pe([d()],se.prototype,"saved",2);se=pe([N("sw-bridge-key-card")],se);const _="partners",La=()=>q(`${_}/settings`),ct=e=>be(`${_}/settings`,e),Ma=()=>q(`${_}/options`),Va=()=>q(`${_}/clients`),Fa=e=>V(`${_}/clients`,{label:e}),Wa=(e,t)=>V(`${_}/clients/${encodeURIComponent(e)}/state`,{state:t}),qa=e=>ut(`${_}/clients/${encodeURIComponent(e)}`),Ua=()=>q(`${_}/tokens`),Ha=(e,t)=>V(`${_}/clients/${encodeURIComponent(e)}/tokens`,t),Ka=e=>V(`${_}/tokens/${encodeURIComponent(e)}/rotate`,{}),Ga=e=>V(`${_}/tokens/${encodeURIComponent(e)}/revoke`),Za=()=>q(`${_}/endpoints`),Xa=(e,t)=>V(`${_}/clients/${encodeURIComponent(e)}/endpoints`,t),Ya=e=>ut(`${_}/endpoints/${encodeURIComponent(e)}`),Qa=(e,t)=>V(`${_}/endpoints/${encodeURIComponent(e)}/pause`,{paused:t}),Ja=e=>V(`${_}/endpoints/${encodeURIComponent(e)}/secret/rotate`,{}),ei=e=>V(`${_}/endpoints/${encodeURIComponent(e)}/ping`),ti=()=>q(`${_}/deliveries?limit=50`),si=()=>q(`${_}/outbox?state=dead&limit=50`),ai=e=>V(`${_}/outbox/${encodeURIComponent(e)}/redeliver`),Ve={title:"ממשק לשותפים",stateOff:"כבוי",stateOn:"פעיל",stateBlocked:"ממתין לאישור הפעלה",apiSwitch:"גישת קריאה לשותפים",webhooksSwitch:"שליחת הודעות לשותפים",notPermitted:"ההפעלה דורשת סקירת אבטחה ואישור בעלים.",localOnly:"הפעלה רק מהרשת המקומית. כיבוי אפשרי מכל מקום.",tabPartners:"שותפים",tabTokens:"אסימונים",tabEndpoints:"יעדי הודעות",tabLog:"יומן משלוחים",tabSettings:"הגדרות",partner:"שותף",partnerName:"שם השותף",addPartner:"הוספת שותף",disable:"השבתה",enable:"הפעלה",remove:"מחיקה",confirmRemove:"למחוק? כל האסימונים והיעדים של השותף יבוטלו.",confirmRemoveEndpoint:"למחוק את היעד? הודעות שבתור לא יישלחו.",none:"אין",label:"תיאור",scopes:"הרשאות גישה",sc_tickets_read:"קריאת קריאות שירות",sc_tickets_create:"פתיחת קריאות שירות",sc_temperature_read:"יחידות טמפרטורה",sc_elevators_read:"מעליות",restriction:"תחום",rk_installation:"כל ההתקנה",rk_site:"אתרים",rk_building:"מבנים",rk_floor:"קומות",departments:"מחלקות",sourceCidrs:"כתובות מקור מותרות (אופציונלי)",expiresDays:"תוקף בימים",textOption:"כותרת ותיאור הקריאה",peopleOption:"שמות מבקש ומטפל",createToken:"יצירת אסימון",rotate:"החלפה",revoke:"ביטול",confirmRevoke:"לבטל את האסימון? השותף יאבד גישה מיד.",shownOnce:"מוצג פעם אחת בלבד. העתיקו ושמרו עכשיו.",copy:"העתקה",copied:"הועתק",close:"סגירה",expires:"בתוקף עד",lastUsed:"שימוש אחרון",st_active:"פעיל",st_expired:"פג תוקף",st_revoked:"בוטל",st_pending:"ממתין לבדיקה",st_paused:"מושהה",st_disabled:"מושבת",ownerGone:"יוצר האסימון אינו פעיל",url:"כתובת יעד (https, פורט {ports})",events:"אירועים",skipOwn:"לא לשלוח לשותף על קריאות שהוא פתח",createEndpoint:"הוספת יעד",ping:"בדיקה",pingOk:"הבדיקה הצליחה",pingFail:"הבדיקה נכשלה",pause:"השהיה",resume:"חידוש",rotateSecret:"החלפת סוד",queued:"בתור",dead:"נכשלו",redeliver:"שליחה חוזרת",attempt:"ניסיון",status:"תוצאה",ev_ticket_created:"קריאה נפתחה",ev_ticket_status_changed:"סטטוס קריאה השתנה",ev_ticket_done:"טיפול הסתיים",ev_temperature_alarm:"אזעקת טמפרטורה",ev_temperature_warning:"חריגת טמפרטורה",ev_temperature_offline:"חיישן טמפרטורה לא מדווח",ev_temperature_escalation:"הסלמת אזעקת טמפרטורה",ev_temperature_resolved:"טמפרטורה חזרה לתקינות",ev_elevator_fault:"תקלת מעלית",ev_elevator_out_of_service:"מעלית בהשבתה",ev_elevator_fire_service:"מעלית בפיקוד כבאים",ev_elevator_resolved:"מעלית חזרה לפעולה",v_token_default_days:"תוקף ברירת מחדל (ימים)",v_token_max_days:"תוקף מרבי (ימים)",v_max_endpoints:"מספר יעדים מרבי",v_rate_per_min:"בקשות לדקה לאסימון",v_rate_per_hour:"בקשות לשעה לאסימון",v_create_per_hour:"פתיחת קריאות לשעה",v_create_per_day:"פתיחת קריאות ליום",v_expiry_notice_days:"התראה לפני פקיעה (ימים)",v_rotation_overlap_hours:"חפיפה בהחלפה (שעות)",save:"שמירה",saved:"נשמר",cancel:"ביטול",choosePartner:"בחירת שותף"},ii={title:"Partner interface",stateOff:"Off",stateOn:"On",stateBlocked:"Awaiting activation approval",apiSwitch:"Partner read access",webhooksSwitch:"Messages to partners",notPermitted:"Activation needs a security review and the owner’s approval.",localOnly:"Switch on from the local network only. Switching off works from anywhere.",tabPartners:"Partners",tabTokens:"Tokens",tabEndpoints:"Message targets",tabLog:"Delivery log",tabSettings:"Settings",partner:"Partner",partnerName:"Partner name",addPartner:"Add partner",disable:"Disable",enable:"Enable",remove:"Delete",confirmRemove:"Delete? All tokens and targets of the partner are revoked.",confirmRemoveEndpoint:"Delete the target? Queued messages are not sent.",none:"None",label:"Description",scopes:"Access scopes",sc_tickets_read:"Read service requests",sc_tickets_create:"Open service requests",sc_temperature_read:"Temperature units",sc_elevators_read:"Elevators",restriction:"Area",rk_installation:"Whole installation",rk_site:"Sites",rk_building:"Buildings",rk_floor:"Floors",departments:"Departments",sourceCidrs:"Allowed source addresses (optional)",expiresDays:"Valid for (days)",textOption:"Request title and description",peopleOption:"Requester and handler names",createToken:"Create token",rotate:"Rotate",revoke:"Revoke",confirmRevoke:"Revoke the token? The partner loses access at once.",shownOnce:"Shown once only. Copy and store it now.",copy:"Copy",copied:"Copied",close:"Close",expires:"Valid until",lastUsed:"Last used",st_active:"Active",st_expired:"Expired",st_revoked:"Revoked",st_pending:"Awaiting test",st_paused:"Paused",st_disabled:"Disabled",ownerGone:"The token’s creator is no longer active",url:"Target address (https, port {ports})",events:"Events",skipOwn:"Do not tell a partner about requests it opened",createEndpoint:"Add target",ping:"Test",pingOk:"Test succeeded",pingFail:"Test failed",pause:"Pause",resume:"Resume",rotateSecret:"Rotate secret",queued:"Queued",dead:"Failed",redeliver:"Send again",attempt:"Attempt",status:"Result",ev_ticket_created:"Request opened",ev_ticket_status_changed:"Request status changed",ev_ticket_done:"Work done",ev_temperature_alarm:"Temperature alarm",ev_temperature_warning:"Temperature out of range",ev_temperature_offline:"Temperature sensor silent",ev_temperature_escalation:"Temperature alarm escalated",ev_temperature_resolved:"Temperature back to normal",ev_elevator_fault:"Elevator fault",ev_elevator_out_of_service:"Elevator out of service",ev_elevator_fire_service:"Elevator in fire service",ev_elevator_resolved:"Elevator back in service",v_token_default_days:"Default validity (days)",v_token_max_days:"Maximum validity (days)",v_max_endpoints:"Maximum targets",v_rate_per_min:"Requests per minute per token",v_rate_per_hour:"Requests per hour per token",v_create_per_hour:"Requests opened per hour",v_create_per_day:"Requests opened per day",v_expiry_notice_days:"Notice before expiry (days)",v_rotation_overlap_hours:"Rotation overlap (hours)",save:"Save",saved:"Saved",cancel:"Cancel",choosePartner:"Choose a partner"},ri={he:Ve,en:ii,ar:{},ru:{}};function Fe(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function u(e,t,s=Fe()){const i=ri[s][e]??Ve[e]??e;return t?i.replace(/\{(\w+)\}/g,(a,n)=>n in t?String(t[n]):a):i}function W(e,t,s=Fe()){const i=`${e}${t.replace(/\./g,"_")}`;return i in Ve?u(i,void 0,s):t}var ni=Object.defineProperty,oi=Object.getOwnPropertyDescriptor,z=(e,t,s,i)=>{for(var a=i>1?void 0:i?oi(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&ni(t,s,a),a};function $e(e){if(!e)return"";const t=new Date(e),s={he:"he-IL",en:"en-GB",ar:"ar",ru:"ru-RU"}[Fe()];return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}function Ee(e){return e==="active"?"live":e==="paused"||e==="pending"?"partial":e==="expired"||e==="revoked"||e==="disabled"?"neutral":"stale"}let y=class extends E{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.ok="",this.tab="partners",this.clients=[],this.tokens=[],this.endpoints=[],this.log=[],this.deadRows=[],this.opts=null,this.once=null,this.confirm=null,this.fClient="",this.fToken={client:"",label:"",scopes:new Set,kind:"installation",ids:new Set,depts:new Set,text:!0,people:!1,days:0,cidrs:""},this.fEp={client:"",label:"",url:"",events:new Set,kind:"installation",ids:new Set,skipOwn:!0},this.values={}}connectedCallback(){super.connectedCallback(),this.load()}get on(){return!!this.s&&(this.s.api_active||this.s.webhooks_active)}async load(){try{if(this.s=await La(),this.values={...this.s.values},this.error="",this.on){const[e,t,s,i]=await Promise.all([Va(),Ua(),Za(),Ma()]);this.clients=e.items,this.tokens=t.items,this.endpoints=s.items,this.opts=i,this.tab==="log"&&await this.loadLog()}else this.tab!=="settings"&&(this.tab="settings")}catch(e){e.status===403?this.notShown=!0:this.error=m(e)}}async loadLog(){const[e,t]=await Promise.all([ti(),si()]);this.log=e.items,this.deadRows=t.items}async run(e,t=""){this.busy=!0,this.error="",this.ok="";try{await e(),this.ok=t}catch(s){this.error=m(s)}finally{this.busy=!1}await this.load()}showOnce(e){this.once=e??null}toggleIn(e,t){const s=new Set(e);return s.has(t)?s.delete(t):s.add(t),s}clientName(e){return this.clients.find(t=>t.id===e)?.label??e}placeOptions(e){const t=this.opts;return t?e==="site"?t.sites:e==="building"?t.buildings:e==="floor"?t.floors:[]:[]}renderSwitches(e){const t=this.on?"live":e.go_live_permitted?"neutral":"partial",s=this.on?u("stateOn"):e.go_live_permitted?u("stateOff"):u("stateBlocked"),i=(a,n)=>r`<div class="row">
      <span class="lbl">${n}</span>
      <sw-toggle .checked=${e[a]} ?disabled=${this.busy||!e[a]&&(!e.go_live_permitted||e.remote)} label=${n} labelHidden
        data-partner-switch=${a} @change=${c=>void this.run(()=>ct({[a]:c.detail.checked}))}></sw-toggle>
    </div>`;return r`<div class="row"><span class="lbl">${u("title")}</span><sw-badge kind=${t} label=${s} data-partner-state></sw-badge></div>
      ${i("api",u("apiSwitch"))}${i("webhooks",u("webhooksSwitch"))}
      ${e.go_live_permitted?o:r`<div class="note" role="status" data-partner-not-permitted>${u("notPermitted")}</div>`}
      ${e.go_live_permitted&&e.remote?r`<div class="note" role="status">${u("localOnly")}</div>`:o}`}renderTabs(){const e=this.on?["partners","tokens","endpoints","log","settings"]:["settings"],t={partners:u("tabPartners"),tokens:u("tabTokens"),endpoints:u("tabEndpoints"),log:u("tabLog"),settings:u("tabSettings")};return r`<div class="tabs" role="tablist">${e.map(s=>r`<button role="tab" aria-selected=${this.tab===s?"true":"false"} data-partner-tab=${s}
      @click=${()=>{this.tab=s,s==="log"&&this.loadLog()}}>${t[s]}</button>`)}</div>`}renderOnce(){if(!this.once)return o;const e=this.once;return r`<div class="once" role="alert" data-partner-once>
      <span class="val">${u("shownOnce")}</span>
      <code>${e}</code>
      <span class="acts">
        <sw-button size="sm" @click=${async()=>{try{await navigator.clipboard.writeText(e),this.ok=u("copied")}catch{}}}>${u("copy")}</sw-button>
        <sw-button size="sm" variant="ghost" data-partner-once-close @click=${()=>this.once=null}>${u("close")}</sw-button>
      </span>
    </div>`}renderConfirm(){if(!this.confirm)return o;const e=this.confirm;return r`<div class="row" data-partner-confirm><span class="val">${e.text}</span><span class="acts">
      <sw-button size="sm" variant="primary" ?disabled=${this.busy} @click=${()=>{this.confirm=null,this.run(e.run)}}>${e.action}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.confirm=null}>${u("cancel")}</sw-button></span></div>`}renderPartners(){return r`<div class="form">
        <input type="text" maxlength="80" .value=${this.fClient} placeholder=${u("partnerName")} aria-label=${u("partnerName")}
          @input=${e=>this.fClient=e.target.value} />
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!this.fClient.trim()} data-partner-add
          @click=${()=>void this.run(async()=>{await Fa(this.fClient.trim()),this.fClient=""},u("saved"))}>${u("addPartner")}</sw-button></span>
      </div>
      <div class="list">${this.clients.length?this.clients.map(e=>r`<div class="row" data-partner-client=${e.id}>
        <span class="lbl">${e.label}</span>
        <span class="acts">
          <sw-badge kind=${Ee(e.state)} label=${W("st_",e.state)}></sw-badge>
          <span class="val">${u("tabTokens")} ${e.tokens} · ${u("tabEndpoints")} ${e.endpoints}</span>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>Wa(e.id,e.state==="active"?"disabled":"active"))}>${e.state==="active"?u("disable"):u("enable")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:u("confirmRemove"),action:u("remove"),run:()=>qa(e.id)}}>${u("remove")}</sw-button>
        </span></div>`):r`<div class="note">${u("none")}</div>`}</div>`}renderRestriction(e,t,s,i){const a=this.s;return r`<span class="chips"><span class="val">${u("restriction")}</span>
        <select aria-label=${u("restriction")} @change=${n=>s(n.target.value)}>
          ${a.restriction_kinds.map(n=>r`<option value=${n} ?selected=${n===e}>${W("rk_",n)}</option>`)}
        </select></span>
      ${e!=="installation"?r`<span class="chips">${this.placeOptions(e).map(n=>r`<label><input type="checkbox" .checked=${t.has(n.id)}
        @change=${()=>i(this.toggleIn(t,n.id))} />${n.name}</label>`)}</span>`:o}`}renderTokens(){const e=this.fToken,t=this.s,s=[...e.scopes].some(n=>n.startsWith("tickets.")),i=!!e.client&&e.scopes.size>0&&(e.kind==="installation"||e.ids.size>0)&&(!e.scopes.has("tickets.create")||e.depts.size>0),a=()=>void this.run(async()=>{const n=e.cidrs.split(/[\s,]+/).map(l=>l.trim()).filter(Boolean),c=await Ha(e.client,{label:e.label.trim()||void 0,scopes:[...e.scopes],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],departments:s?[...e.depts]:void 0,source_cidrs:n.length?n:void 0,personal:{ticket_text:e.text,ticket_people:e.people},expires_days:e.days>0?e.days:void 0});this.showOnce(c.token),this.fToken={...this.fToken,label:"",scopes:new Set,ids:new Set,depts:new Set,cidrs:"",days:0}},u("saved"));return r`<div class="form" data-partner-token-form>
        <span class="chips"><select aria-label=${u("choosePartner")} @change=${n=>this.fToken={...e,client:n.target.value}}>
          <option value="">${u("choosePartner")}</option>
          ${this.clients.filter(n=>n.state==="active").map(n=>r`<option value=${n.id} ?selected=${n.id===e.client}>${n.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${u("label")} aria-label=${u("label")} @input=${n=>this.fToken={...e,label:n.target.value}} /></span>
        <span class="chips"><span class="val">${u("scopes")}</span>${t.scopes.map(n=>r`<label><input type="checkbox" .checked=${e.scopes.has(n)}
          data-partner-scope=${n} @change=${()=>this.fToken={...e,scopes:this.toggleIn(e.scopes,n)}} />${W("sc_",n)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,n=>this.fToken={...e,kind:n,ids:new Set},n=>this.fToken={...e,ids:n})}
        ${s?r`<span class="chips"><span class="val">${u("departments")}</span>${(this.opts?.departments??[]).map(n=>r`<label><input type="checkbox" .checked=${e.depts.has(n.id)}
          @change=${()=>this.fToken={...e,depts:this.toggleIn(e.depts,n.id)}} />${n.name}</label>`)}</span>
          <span class="chips"><label><input type="checkbox" .checked=${e.text} @change=${()=>this.fToken={...e,text:!e.text}} />${u("textOption")}</label>
          <label><input type="checkbox" .checked=${e.people} data-partner-people @change=${()=>this.fToken={...e,people:!e.people}} />${u("peopleOption")}</label></span>`:o}
        <span class="chips"><label>${u("expiresDays")} <input type="number" min="1" max=${t.values.token_max_days??365} placeholder=${String(t.values.token_default_days??90)}
          .value=${e.days?String(e.days):""} @input=${n=>this.fToken={...e,days:Number(n.target.value)||0}} /></label>
          <input type="text" class="ltr" .value=${e.cidrs} placeholder=${u("sourceCidrs")} aria-label=${u("sourceCidrs")} @input=${n=>this.fToken={...e,cidrs:n.target.value}} /></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!i} data-partner-token-create @click=${a}>${u("createToken")}</sw-button></span>
      </div>
      <div class="list">${this.tokens.length?this.tokens.map(n=>r`<div class="row" data-partner-token=${n.id}>
        <span class="lbl">${this.clientName(n.client_id)}${n.label?` · ${n.label}`:""} <span class="val ltr">…${n.last4}</span></span>
        <span class="val">${n.scopes.map(c=>W("sc_",c)).join(", ")} · ${W("rk_",n.restriction_kind)} · ${u("expires")} ${$e(n.expires_at)}${n.last_used_at?` · ${u("lastUsed")} ${$e(n.last_used_at)}`:""}</span>
        <span class="acts">
          <sw-badge kind=${Ee(n.state)} label=${W("st_",n.state)}></sw-badge>
          ${n.owner_gone?r`<sw-badge kind="stale" label=${u("ownerGone")}></sw-badge>`:o}
          ${n.state==="active"?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await Ka(n.id)).token))}>${u("rotate")}</sw-button>
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:u("confirmRevoke"),action:u("revoke"),run:()=>Ga(n.id)}}>${u("revoke")}</sw-button>`:o}
        </span></div>`):r`<div class="note">${u("none")}</div>`}</div>`}renderEndpoints(){const e=this.fEp,t=this.s,s=!!e.client&&e.url.startsWith("https://")&&e.events.size>0&&(e.kind==="installation"||e.ids.size>0),i=()=>void this.run(async()=>{const a=await Xa(e.client,{label:e.label.trim()||void 0,url:e.url.trim(),events:[...e.events],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],skip_own:e.skipOwn});this.showOnce(a.secret),this.fEp={...this.fEp,label:"",url:"",events:new Set,ids:new Set}},u("saved"));return r`<div class="form" data-partner-endpoint-form>
        <span class="chips"><select aria-label=${u("choosePartner")} @change=${a=>this.fEp={...e,client:a.target.value}}>
          <option value="">${u("choosePartner")}</option>
          ${this.clients.filter(a=>a.state==="active").map(a=>r`<option value=${a.id} ?selected=${a.id===e.client}>${a.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${u("label")} aria-label=${u("label")} @input=${a=>this.fEp={...e,label:a.target.value}} /></span>
        <input type="url" class="ltr" maxlength="2048" .value=${e.url} placeholder=${u("url",{ports:t.allowed_ports.join(" / ")})} aria-label=${u("url",{ports:t.allowed_ports.join(" / ")})}
          data-partner-url @input=${a=>this.fEp={...e,url:a.target.value}} />
        <span class="chips"><span class="val">${u("events")}</span>${t.event_types.map(a=>r`<label><input type="checkbox" .checked=${e.events.has(a)}
          @change=${()=>this.fEp={...e,events:this.toggleIn(e.events,a)}} />${W("ev_",a)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,a=>this.fEp={...e,kind:a,ids:new Set},a=>this.fEp={...e,ids:a})}
        <span class="chips"><label><input type="checkbox" .checked=${e.skipOwn} @change=${()=>this.fEp={...e,skipOwn:!e.skipOwn}} />${u("skipOwn")}</label></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!s} data-partner-endpoint-create @click=${i}>${u("createEndpoint")}</sw-button></span>
      </div>
      <div class="list">${this.endpoints.length?this.endpoints.map(a=>r`<div class="row" data-partner-endpoint=${a.id}>
        <span class="lbl">${this.clientName(a.client_id)}${a.label?` · ${a.label}`:""} <span class="val ltr">${a.host}</span></span>
        <span class="val">${a.events.map(n=>W("ev_",n)).join(", ")} · ${u("queued")} ${a.queued} · ${u("dead")} ${a.dead}</span>
        <span class="acts">
          <sw-badge kind=${Ee(a.state)} label=${W("st_",a.state)}></sw-badge>
          <sw-button size="sm" ?disabled=${this.busy||!t.webhooks_active} @click=${()=>void this.run(async()=>{if((await ei(a.id)).state!=="delivered")throw new Error(u("pingFail"))},u("pingOk"))}>${u("ping")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>Qa(a.id,a.state!=="paused"))}>${a.state==="paused"?u("resume"):u("pause")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await Ja(a.id)).secret))}>${u("rotateSecret")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:u("confirmRemoveEndpoint"),action:u("remove"),run:()=>Ya(a.id)}}>${u("remove")}</sw-button>
        </span></div>`):r`<div class="note">${u("none")}</div>`}</div>`}renderLog(){return r`<div class="list" data-partner-log>
      ${this.deadRows.map(e=>r`<div class="row"><span class="val">${$e(e.occurred_at)} · ${W("ev_",e.type)} · ${e.dead_reason??""}</span>
        <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>ai(e.id))}>${u("redeliver")}</sw-button></div>`)}
      ${this.log.length?this.log.map(e=>r`<div class="row"><span class="val">${$e(e.started_at)} · ${W("ev_",e.type)} · ${u("attempt")} ${e.attempt}</span>
        <span class="val ltr">${e.http_status??""} ${e.error_class??""} · ${e.duration_ms} ms</span></div>`):r`<div class="note">${u("none")}</div>`}
    </div>`}renderSettings(){const e=this.s;return r`<div class="form" data-partner-settings>
      ${Object.keys(e.values).map(t=>r`<label class="row"><span class="val">${W("v_",t)}</span>
        <input type="number" min=${e.ranges[t]?.[0]??0} max=${e.ranges[t]?.[1]??0} .value=${String(this.values[t]??e.values[t])}
          @input=${s=>this.values={...this.values,[t]:Number(s.target.value)}} /></label>`)}
      <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-partner-settings-save
        @click=${()=>{const t=Object.fromEntries(Object.entries(this.values).filter(([s,i])=>i!==e.values[s]));this.run(()=>ct({values:t}),u("saved"))}}>${u("save")}</sw-button></span>
    </div>`}render(){if(this.notShown)return o;const e=this.s;if(!e)return this.error?r`<p class="err" role="alert">${this.error}</p>`:o;const t={partners:()=>this.renderPartners(),tokens:()=>this.renderTokens(),endpoints:()=>this.renderEndpoints(),log:()=>this.renderLog(),settings:()=>this.renderSettings()}[this.tab]();return r`<sw-card heading=${u("title")} data-partner-api>
      ${this.renderSwitches(e)}
      ${this.renderTabs()}
      ${this.renderOnce()}
      ${this.renderConfirm()}
      ${t}
      ${this.error?r`<p class="err" role="alert">${this.error}</p>`:o}
      ${this.ok?r`<p class="ok" role="status">${this.ok}</p>`:o}
    </sw-card>`}};y.styles=M`
    :host { display: block; min-inline-size: 0; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); min-inline-size: 0; overflow-wrap: anywhere; }
    .val, .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; overflow-wrap: anywhere; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .acts { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; padding-block: 8px; border-block-end: 1px solid var(--sw-border); }
    .tabs button { font: inherit; font-size: var(--sw-fs-sm); min-block-size: 32px; padding-inline: 10px; border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); cursor: pointer; }
    .tabs button[aria-selected='true'] { background: var(--sw-accent, var(--sw-primary)); color: var(--sw-text-inverse); border-color: transparent; }
    .list { max-block-size: 320px; overflow-y: auto; }
    .form { display: grid; gap: 8px; padding-block: 10px; border-block-end: 1px solid var(--sw-border); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: var(--sw-fs-sm); }
    .chips label { display: inline-flex; align-items: center; gap: 4px; }
    input[type='text'], input[type='number'], input[type='url'], select { min-block-size: 36px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); padding-inline: 8px; min-inline-size: 0; }
    .once { display: grid; gap: 6px; padding: 10px; margin-block: 8px; border: 1px solid var(--sw-warning-border, var(--sw-border-strong)); border-radius: var(--sw-r-md);
      background: var(--sw-warning-bg, var(--sw-surface-2)); }
    .once code { font-family: var(--sw-font-mono, monospace); font-size: var(--sw-fs-sm); overflow-wrap: anywhere; direction: ltr; unicode-bidi: isolate; user-select: all; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); padding-block: 6px; }
    .ok { color: var(--sw-success-text, var(--sw-text-2)); font-size: var(--sw-fs-sm); padding-block: 6px; }
    @media (max-width: 767px) and (pointer: coarse) {
      input, select, .tabs button { min-block-size: 44px; }
      sw-button { --sw-ctl-h-sm: 44px; }
    }
  `;z([d()],y.prototype,"s",2);z([d()],y.prototype,"notShown",2);z([d()],y.prototype,"busy",2);z([d()],y.prototype,"error",2);z([d()],y.prototype,"ok",2);z([d()],y.prototype,"tab",2);z([d()],y.prototype,"clients",2);z([d()],y.prototype,"tokens",2);z([d()],y.prototype,"endpoints",2);z([d()],y.prototype,"log",2);z([d()],y.prototype,"deadRows",2);z([d()],y.prototype,"opts",2);z([d()],y.prototype,"once",2);z([d()],y.prototype,"confirm",2);z([d()],y.prototype,"fClient",2);z([d()],y.prototype,"fToken",2);z([d()],y.prototype,"fEp",2);z([d()],y.prototype,"values",2);y=z([N("sw-partner-api-card")],y);var li=Object.defineProperty,di=Object.getOwnPropertyDescriptor,w=(e,t,s,i)=>{for(var a=i>1?void 0:i?di(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(i?c(t,s,a):c(a))||a);return i&&a&&li(t,s,a),a};const ci=[{key:"go2rtc_url",label:"כתובת go2rtc"},{key:"go2rtc_api_username",label:"משתמש go2rtc (אם מוגן)"},{key:"wiskey_username",label:"משתמש עמדות WisKey (מצלמות)"},{key:"bootstrap_admin_username",label:"שם משתמש של המנהל הראשון"},{key:"log_level",label:"רמת לוג"}];function re(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}let v=class extends E{constructor(){super(...arguments),this.bubbleSkin=new Ot(this),this.raw=null,this.report=null,this.recorder=null,this.error="",this.busy=!1,this.notify=null,this.notifyError="",this.notifyPlan=null,this.notifyBusy=!1,this.notifyResult="",this.sys=null,this.sysRecorder="nvr-1",this.sysRecorders=[],this.sysError="",this.sysMsg="",this.sysBusy=!1,this.ntpForm=null,this.rebootWord="",this.rebootOpen=!1,this.changes=[],this.wiskey=null,this.wiskeyError="",this.wiskeyForm=null,this.wiskeyClear=null,this.wiskeyMsg="",this.wiskeyBusy=!1,this.sysOk=!0,this.notifyOk=!0,this.wiskeyOk=!0}get sysApi(){return At(this.sysRecorder)}static statusLine(e,t,s){const i=r`<sw-icon name=${t?"check":"warning"} size=${13}></sw-icon>`;return s==="data-nvr-system-msg"?r`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-nvr-system-msg>${i}${e}</div>`:s==="data-nvr-result"?r`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-nvr-result>${i}${e}</div>`:r`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-wiskey-cred-msg>${i}${e}</div>`}connectedCallback(){super.connectedCallback(),fe()&&this.load()}async load(){this.loadNvr(),this.loadWiskey(),this.busy=!0;try{this.raw=await q("health"),this.error=""}catch(e){this.error=m(e)}try{const e=qe()?null:await Et();this.recorder=e?.recorder??null,this.sysRecorders=e?.recorders??[]}catch{this.recorder=null}try{this.report=await Nt()}catch{this.report=null}this.busy=!1}check(e){return this.report?.checks.find(t=>t.id===e)??null}row(e,t,s=""){return r`<div class="check"><span>${e}</span><span class=${`val ${s}`}>${t==null||t===""?"—":String(t)}</span></div>`}sectionHead(e,t){return r`<div class="syshead"><sw-icon name=${e} size=${15}></sw-icon>${t}</div>`}async loadNvr(){if(fe()&&!qe()){try{const[e,t]=await Promise.all([Bt(),He(10)]);this.notify=e,this.changes=t.changes,this.notifyError=""}catch(e){this.notifyError=m(e)}this.loadSystem()}}get sysVendor(){return this.sysRecorders.find(e=>e.id===this.sysRecorder)?.vendor??this.sys?.vendor??null}async loadSystem(){if(this.sysRecorders.find(e=>e.id===this.sysRecorder)?.vendor==="frigate"){this.sys=null,this.sysError="";return}try{this.sys=await this.sysApi.nvrSystem(),this.sysError=""}catch(e){this.sysError=m(e)}}async sysAction(e,t){if(!this.sysBusy){this.sysBusy=!0,this.sysMsg="";try{await t(),await Promise.all([this.loadSystem(),He(10).then(s=>this.changes=s.changes)]),this.sysOk=!0,this.sysMsg=`${e}: בוצע ונרשם באודיט.`}catch(s){this.sysOk=!1,this.sysMsg=`${e}: ${m(s)}`}finally{this.sysBusy=!1}}}renderSystemCard(){const e=this.sys,t=a=>`${(a/1024).toFixed(0)} GB`,s=e?.time?.drift_s??null,i=s===null?"":Math.abs(s)<=2?"ok":Math.abs(s)<=30?"warn":"err";return r`<sw-card heading="מערכת ה־NVR" subheading="שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת" data-nvr-system>
      ${this.sysRecorders.length>1?r`<sw-field label="NVR"><select data-nvr-system-recorder ?disabled=${this.sysBusy} @change=${a=>{this.sysRecorder=a.target.value,this.sys=null,this.sysMsg="",this.loadSystem()}}>
            ${this.sysRecorders.map(a=>r`<option value=${a.id} ?selected=${a.id===this.sysRecorder}>${a.name}</option>`)}
          </select></sw-field>`:o}
      ${this.sysVendor==="frigate"?r`<frigate-summary recorder-id=${this.sysRecorder} data-nvr-system-frigate></frigate-summary>`:e&&e.supported===!1?r`<div class="hint" data-nvr-system-unsupported>פרטי השעון, הדיסקים והיציאות אינם זמינים עבור מקליט מסוג זה.</div>`:r`${this.sysError?r`<div class="msg err" role="alert" data-nvr-system-error><sw-icon name="warning" size=${13}></sw-icon>${this.sysError}</div>`:o}
      ${e?r`
          ${this.sectionHead("clock","שעון")}
          ${e.time?r`${this.row("שעון ה־NVR",`${e.time.local_time??"—"} · ${e.time.mode==="NTP"?"NTP":"ידני"}`)}
                ${this.row("סטייה מול שעון השרת",s===null?"—":`${s>0?"+":""}${s} שנ׳`,i)}
                ${this.row("שרת NTP",e.time.ntp?`${e.time.ntp.host??"—"}:${e.time.ntp.port} · כל ${e.time.ntp.interval_min} דק׳`:"—")}
                ${e.can.time?r`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${()=>this.sysAction("סנכרון השעון",()=>this.sysApi.setNvrTime({sync_now:!0}))}>סנכרן לשעון השרת עכשיו</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${()=>this.ntpForm=this.ntpForm?null:{host:e.time?.ntp?.host??"",port:e.time?.ntp?.port??123,interval_min:e.time?.ntp?.interval_min||1440}}>שרת NTP…</sw-button>
                    </div>
                    ${this.ntpForm?r`<div class="two" data-nvr-ntp-form>
                          <sw-field label="שרת NTP"><input data-ltr .value=${this.ntpForm.host} @input=${a=>this.ntpForm={...this.ntpForm,host:a.target.value}} /></sw-field>
                          <sw-field label="מרווח (דקות)"><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${a=>this.ntpForm={...this.ntpForm,interval_min:Number(a.target.value)}} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy||!this.ntpForm.host} data-nvr-ntp-save @click=${()=>{const a=this.ntpForm;this.sysAction("שרת NTP",async()=>{await this.sysApi.setNvrNtp({host:a.host.trim(),port:a.port,interval_min:a.interval_min}),this.ntpForm=null})}}>כתוב ל־NVR</sw-button></div>
                        </div>`:o}`:r`<div class="hint">כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).</div>`}`:r`<div class="hint">השעון לא נקרא${e.errors.time?` (${e.errors.time})`:""}.</div>`}
          ${this.sectionHead("storage","דיסקים ו־S.M.A.R.T.")}
          ${e.disks.length?e.disks.map(a=>r`<div data-nvr-disk=${a.id}>
                ${this.row(`${a.name} (${a.type})`,`${a.status} · ${t(a.capacity_mb)} · פנוי ${t(a.free_mb)} (${a.capacity_mb?Math.round(a.free_mb/a.capacity_mb*100):0}%)`,a.status==="ok"?"ok":"warn")}
                ${a.smart?this.row("S.M.A.R.T.",`${a.smart.all_eval??"—"} · ${a.smart.temperature_c??"—"}°C · ${a.smart.power_on_days??"—"} ימי פעילות${a.smart.test_status?` · בדיקה: ${a.smart.test_status} ${a.smart.test_percent}%`:""}`,a.smart.all_eval==="functional"?"ok":"warn"):this.row("S.M.A.R.T.","לא זמין")}
                ${e.can.storage?r`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${a.id} @click=${()=>this.sysAction("בדיקת S.M.A.R.T. קצרה",()=>this.sysApi.startSmartTest(a.id,"short"))}>בדיקת S.M.A.R.T. קצרה</sw-button><span class="hint">מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות</span></div>`:o}
              </div>`):r`<div class="hint">לא נקראו דיסקים${e.errors.disks?` (${e.errors.disks})`:""}.</div>`}
          ${this.sectionHead("bell","יציאות אזעקה")}
          ${e.outputs.length?e.outputs.map(a=>r`<div class="check" data-nvr-output=${a.id}><span>יציאה ${a.id}${a.name?` · ${a.name}`:""} <span class="hint">${a.io_type==="local"?"ממסר ב־NVR":"במצלמה"} · ${a.use_type==="whiteLight"?"אור לבן":a.use_type==="disable"?"לא בשימוש":a.use_type}${a.pulse_ms?` · פולס ${a.pulse_ms/1e3} שנ׳`:""}</span></span>
                ${a.pulse_supported?e.can.alarm?r`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy||!a.enabled} data-nvr-pulse=${a.id} @click=${()=>this.sysAction(`הפעלת יציאה ${a.id}`,()=>this.sysApi.pulseNvrOutput(a.id))}>הפעל (pulse)</sw-button>`:r`<span class="val">${a.enabled?"פעיל":"כבוי"}</span>`:r`<span class="val" data-nvr-output-unsupported>הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)</span>`}
              </div>`):r`<div class="hint">אין יציאות${e.errors.outputs?` (${e.errors.outputs})`:""}.</div>`}
          ${this.sectionHead("refresh","הפעלה מחדש")}
          ${e.can.reboot?r`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${()=>{this.rebootWord="",this.rebootOpen=!0}}>הפעל מחדש את ה־NVR…</sw-button><span class="hint">1–2 דקות בלי לייב ובלי הקלטה</span></div>`:r`<div class="hint">הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).</div>`}
          ${this.sysMsg?v.statusLine(this.sysMsg,this.sysOk,"data-nvr-system-msg"):o}`:this.sysError?o:r`<div class="hint">קורא את מצב המערכת מה־NVR…</div>`}`}
      ${this.rebootOpen?r`<sw-dialog open heading="הפעלה מחדש של ה־NVR" subheading="במשך 1–2 דקות אין לייב ואין הקלטה" data-nvr-reboot-dialog @close=${()=>this.rebootOpen=!1}>
            <div class="dlgtext">הקלד <b>RESTART</b> כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.</div>
            <sw-field label="אישור"><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${a=>this.rebootWord=a.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy||this.rebootWord.trim().toUpperCase()!=="RESTART"} data-nvr-reboot-run @click=${()=>{const a=this.rebootWord;this.rebootOpen=!1,this.sysAction("הפעלה מחדש",()=>this.sysApi.rebootNvr(a))}}>הפעל מחדש</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}async loadWiskey(){if(O("system.configure"))try{this.wiskey=await Pt(),this.wiskeyError=""}catch(e){this.wiskeyError=v.wiskeyFailure("רשימת העמדות לא נטענה",e)}}static wiskeyFailure(e,t){return`${e}: ${m(t)}${t instanceof Ie?` (${t.code})`:""}`}wiskeyName(e){return this.wiskey?.stations.find(s=>s.station_id===e)?.name||e}async saveWiskey(){const e=this.wiskeyForm;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await It(e.station_id,{username:e.username.trim(),password:e.password}),this.wiskeyForm=null,this.wiskeyOk=!0,this.wiskeyMsg=`החשבון של ${this.wiskeyName(e.station_id)} נשמר; התמונה מהמצלמה תילקח מחדש איתו.`,await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=v.wiskeyFailure("לא נשמר",t)}finally{this.wiskeyBusy=!1}}}async clearWiskey(){const e=this.wiskeyClear;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await Dt(e.station_id),this.wiskeyClear=null,this.wiskeyOk=!0,this.wiskeyMsg=e.known?`החשבון של ${e.name||e.station_id} הוסר; העמדה חוזרת לחשבון המשותף.`:`הרשומה של ${e.station_id} הוסרה.`,await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=v.wiskeyFailure("לא הוסר",t)}finally{this.wiskeyBusy=!1}}}renderWiskeyStation(e,t){const s=this.wiskeyForm?.station_id===e.station_id?this.wiskeyForm:null,i=e.override?"override":t.default_configured?"default":"none",a=e.override?`חשבון משלה · מאז ${re(e.override_updated_at)}`:t.default_configured?"החשבון המשותף":"אין חשבון · אין תמונה מהמצלמה";return r`<div data-wiskey-station=${e.station_id} data-wiskey-cred-state=${i}>
      <div class="check">
        <span>${e.name||e.station_id}${e.known?e.has_camera?o:r` <span class="hint">· ללא מצלמה</span>`:r` <span class="hint" data-wiskey-cred-unknown>· לא ברשימת העמדות של WisKey כרגע</span>`}</span>
        <span class=${`val ${e.override?"ok":t.default_configured?"":"warn"}`} data-wiskey-cred-status>${a}</span>
      </div>
      ${s?r`<div class="two" data-wiskey-cred-form>
            <sw-field label="משתמש"><input data-ltr data-wiskey-cred-user autocomplete="off" .value=${s.username} @input=${n=>this.wiskeyForm={...s,username:n.target.value}} /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr data-wiskey-cred-password autocomplete="new-password" .value=${s.password} @input=${n=>this.wiskeyForm={...s,password:n.target.value}} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.wiskeyBusy||!s.username.trim()||!s.password} data-wiskey-cred-save @click=${()=>this.saveWiskey()}>${this.wiskeyBusy?"שומר…":"שמור"}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.wiskeyBusy} data-wiskey-cred-cancel @click=${()=>this.wiskeyForm=null}>ביטול</sw-button>
            </div>
            <div class="hint">החשבון נשמר בבסיס הנתונים של Arx ואינו מוצג שוב; השמירה נרשמת באודיט בלי הסיסמה. החשבון אינו נבדק מול העמדה - אם הוא שגוי, במרכז הכניסה לא תהיה תמונה מהמצלמה.</div>
          </div>`:r`<div class="actions">
            ${e.known?r`<sw-button size="sm" icon="edit" ?disabled=${this.wiskeyBusy} data-wiskey-cred-edit @click=${()=>{this.wiskeyMsg="",this.wiskeyForm={station_id:e.station_id,username:"",password:""}}}>${e.override?"החלפת החשבון…":"חשבון משלה לעמדה…"}</sw-button>`:o}
            ${e.override?r`<sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.wiskeyBusy} data-wiskey-cred-clear @click=${()=>{this.wiskeyMsg="",this.wiskeyClear=e}}>${e.known?"חזרה לחשבון המשותף":"הסרת הרשומה"}</sw-button>`:o}
          </div>`}
    </div>`}renderWiskeyCard(){if(!O("system.configure"))return o;const e=this.wiskey,t=this.wiskeyClear;return r`<sw-card heading="מצלמות עמדות WisKey" subheading="חשבון ה־RTSP שאיתו go2rtc מושך את מצלמת כל עמדה: המשותף שהוגדר בתשתית המערכת, או חשבון משלה לעמדה שצריכה אחר · הערכים עצמם אינם מוצגים" data-wiskey-credentials>
      ${this.wiskeyError?r`<div class="msg err" role="alert" data-wiskey-cred-error><sw-icon name="warning" size=${13}></sw-icon>${this.wiskeyError}</div>`:o}
      ${e?r`${this.row("חשבון משותף (wiskey_username, הסיסמה בכרטיס סודות)",e.default_configured?"מוגדר":"לא מוגדר",e.default_configured?"ok":"warn")}
          ${e.state!=="ready"?r`<div class="hint" data-wiskey-cred-feed=${e.state}>WisKey אינו מחובר כרגע (מצב: <span class="ltr">${e.state}</span>); מוצג מה שידוע ל־Arx.</div>`:o}
          ${e.stations.length?e.stations.map(s=>this.renderWiskeyStation(s,e)):r`<div class="hint" data-wiskey-cred-empty>אין עמדות ברשימה.</div>`}
          ${this.wiskeyMsg?v.statusLine(this.wiskeyMsg,this.wiskeyOk,"data-wiskey-cred-msg"):o}`:this.wiskeyError?o:r`<div class="hint">קורא את רשימת העמדות…</div>`}
      ${t?r`<sw-dialog open heading="הסרת החשבון של העמדה" subheading=${t.name||t.station_id} data-wiskey-cred-confirm @close=${()=>this.wiskeyClear=null}>
            <div class="dlgtext">${t.known?e?.default_configured?"העמדה תחזור לחשבון המשותף, והתמונה מהמצלמה תילקח מחדש איתו.":"לעמדה לא יישאר חשבון, ולא תהיה ממנה תמונה עד שיוגדר אחד.":"הרשומה תימחק מבסיס הנתונים של Arx."} ההסרה נרשמת באודיט.</div>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.wiskeyBusy} data-wiskey-cred-confirm-run @click=${()=>this.clearWiskey()}>${this.wiskeyBusy?"מסיר…":"הסר"}</sw-button><sw-button variant="ghost" @click=${()=>this.wiskeyClear=null}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}renderConnectionCard(){return O("system.configure")?r`<nvr-recorders-card></nvr-recorders-card>`:o}planNotify(e,t,s){const i=e?e.length:this.notify?.channels.length??0;this.notifyResult="",this.notifyPlan={channels:e,smart:t,enabled:s,label:`${s?"הפעלת":"כיבוי"} Notify Surveillance Center ב־${i} ערוצים${t?" · תנועה + אירועים חכמים":" · זיהוי תנועה"}`}}async runNotify(){const e=this.notifyPlan;if(!(!e||this.notifyBusy)){this.notifyBusy=!0;try{const t=await jt({channels:e.channels,smart:e.smart,enabled:e.enabled});this.notifyOk=!t.failed,this.notifyResult=`בוצע: ${t.applied} שינויים · ${t.unchanged} כבר היו כך · ${t.skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · ${t.failed} נכשלו`,this.notifyPlan=null,await this.loadNvr()}catch(t){this.notifyOk=!1,this.notifyResult=m(t)}finally{this.notifyBusy=!1}}}async rollback(e){if(!this.notifyBusy){this.notifyBusy=!0;try{await Lt(e.id),this.notifyOk=!0,this.notifyResult=`השינוי ${e.target} הוחזר למצב הקודם.`,await this.loadNvr()}catch(t){this.notifyOk=!1,this.notifyResult=m(t)}finally{this.notifyBusy=!1}}}renderNotifyCard(){const e=this.notify,t=s=>s===null?"—":r`<span class=${`yn ${s?"on":"off"}`} role="img" aria-label=${s?"נשלחת":"לא נשלחת"}><sw-icon name=${s?"check":"close"} size=${12}></sw-icon></span>`;return r`<sw-card heading="התראות מה־NVR (Notify Surveillance Center)" subheading="אילו ערוצים מודיעים ל־Arx על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר" data-nvr-notify>
      ${this.notifyError?r`<div class="msg err" role="alert" data-nvr-notify-error><sw-icon name="warning" size=${13}></sw-icon>${this.notifyError}</div>`:o}
      ${e?r`<div class="tablewrap"><table class="matrix" data-nvr-matrix>
            <thead><tr><th scope="col">ערוץ</th><th scope="col">מצלמה</th><th scope="col">תנועה</th><th scope="col">אירועים חכמים</th><th scope="col"><span class="sr">פעולה</span></th></tr></thead>
            <tbody>${e.channels.map(s=>r`<tr data-nvr-channel=${s.channel}>
              <td class="ltr num">${s.channel}</td><td>${s.name}</td>
              <td data-nvr-motion=${s.motion.supported?String(s.motion.center):"none"}>${s.motion.supported?t(s.motion.center):r`<span class="dim">לא מוגדר</span>`}</td>
              <td class="num">${s.smart_supported?r`<span class="ltr">${s.smart_center}/${s.smart_supported}</span>`:r`<span class="dim">אין</span>`}</td>
              <td class="act">${e.can_write&&s.motion.supported&&!s.motion.center?r`<sw-button size="sm" data-nvr-enable-one=${s.channel} @click=${()=>this.planNotify([s.channel],!1,!0)}>הפעל</sw-button>`:o}</td>
            </tr>`)}</tbody>
          </table></div>
          <div class="hint legend"><span class="yn on"><sw-icon name="check" size=${12}></sw-icon></span> ההתראה נשלחת ל־Arx · <span class="yn off"><sw-icon name="close" size=${12}></sw-icon></span> הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).</div>
          ${e.can_write?r`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${()=>this.planNotify(null,!1,!0)}>הפעל תנועה בכל הערוצים</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${()=>this.planNotify(null,!0,!0)}>הפעל גם אירועים חכמים</sw-button>
              </div>`:r`<div class="hint" data-nvr-no-permission>לכתיבה ל־NVR נדרשת ההרשאה "${e.permission}" — מוקנית למנהל המערכת, ולאחרים דרך תפקיד מותאם (הגדרות ‹ משתמשים והרשאות ‹ תפקידים), גם למנהל מערכת.</div>`}
          ${this.notifyResult?v.statusLine(this.notifyResult,this.notifyOk,"data-nvr-result"):o}
          ${this.changes.length?r`<div class="syshead"><sw-icon name="history" size=${15}></sw-icon>שינויים אחרונים ב־NVR</div>
            <ul class="changes" data-nvr-changes>${this.changes.map(s=>r`<li><span class="ltr">${s.created_at.slice(0,16).replace("T"," ")}</span> · ${s.target} · ${s.note||s.kind} · ${s.status==="applied"?"בוצע":s.status==="unchanged"?"ללא שינוי":s.status==="rolled_back"?"הוחזר":"נכשל"}${s.actor_username?` · ${s.actor_username}`:""}
              ${s.status==="applied"&&e.can_write?r`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${s.id} @click=${()=>this.rollback(s)}>החזר</sw-button>`:o}</li>`)}</ul>`:o}`:this.notifyError?o:r`<div class="hint">קורא את הגדרות ה־NVR…</div>`}
      ${this.notifyPlan?r`<sw-dialog open heading="כתיבה ל־NVR" subheading=${this.notifyPlan.label} data-nvr-confirm @close=${()=>this.notifyPlan=null}>
            <div class="dlgtext">השינוי נכתב להגדרות ה־NVR בזהות המשתמש של חיבור ה־NVR, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${()=>this.runNotify()}>${this.notifyBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.notifyPlan=null}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}renderApi(){const e=this.raw;return r`
      <sw-page crumbs="הגדרות" heading="חיבורים" subheading="מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · פרטי חיבור ה־NVR נשמרים כאן">
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.load()}>${this.busy?"בודק…":"רענון"}</sw-button>
        ${this.error?r`<sw-state-panel state="error" heading="מצב החיבורים לא נטען" hint=${this.error}></sw-state-panel>`:o}
        ${e?r`<div class="two" data-connections>
              <div class="grouplabel">מערכת ה־NVR</div>
              ${e.mode==="ha_only"?r`<sw-card heading="NVR - מצב ללא NVR" subheading="לא מוגדר - דילוג מכוון" data-nvr-less-connections>
                    ${this.row("מצב ההתקנה","תשתית המערכת בלבד (ללא NVR)")}
                    <div class="hint">מצלמות, לייב, אירועים, הקלטות, תיקים וייצוא מוסתרים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.</div>
                  </sw-card>
                  ${this.renderConnectionCard()}`:r`
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${e.nvr_configured?"מוגדר · קריאה בלבד":"לא מוגדר"}>
                ${this.row("חיבור מוגדר",e.nvr_configured?"כן":"לא",e.nvr_configured?"ok":"err")}
                ${this.recorder?this.row("דגם · קושחה",`${this.recorder.model??"—"} · ${this.recorder.firmware??"—"}`):o}
                ${this.row("גילוי מצלמות",`${e.discovery.cameras} ערוצים · כל ${Math.round(e.discovery.interval_s/60)} דק׳`)}
                ${this.row("גילוי אחרון תקין",re(e.discovery.cameras_last_ok),e.discovery.cameras_last_error?"warn":"ok")}
                ${e.discovery.cameras_last_error?this.row("שגיאת גילוי",e.discovery.cameras_last_error,"err"):o}
                ${this.row("זרם התראות (alertStream)",e.events.ingest.connected?`מחובר · פעימה ${re(e.events.ingest.last_heartbeat_at)}`:`מנותק${e.events.ingest.last_error?` · ${e.events.ingest.last_error}`:""}`,e.events.ingest.connected?"ok":"err")}
                ${this.row("התראות שנשמרו מאז ההפעלה",e.events.ingest.events_stored,e.events.ingest.connected&&!e.events.ingest.events_stored?"warn":"")}
                ${e.events.ingest.connected&&!e.events.ingest.last_event_at?r`<div class="hint" data-no-alerts-hint>ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.</div>`:o}
                ${this.row("אירועים שנגזרו מהקלטות (ריצה אחרונה)",`${e.events.derive.derived} · ${re(e.events.derive.last_ok)}`,e.events.derive.last_error?"warn":"")}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}`}
              <div class="grouplabel">שירותים ותשתית נוספים</div>
              <sw-card heading="go2rtc (relay לווידאו)" subheading=${e.go2rtc_configured?"מוגדר":e.mode==="ha_only"?"לא מוגדר - רשות במצב ללא NVR":Ue()?"לא מוגדר":"לא מוגדר - נדרש כשיש NVR"}>
                ${this.row("חיבור מוגדר",e.go2rtc_configured?"כן":"לא",e.go2rtc_configured?"ok":e.mode==="ha_only"?"":"err")}
                ${!e.go2rtc_configured&&e.mode==="ha_only"?r`<div class="hint" data-go2rtc-optional>במצב ללא NVR go2rtc נדרש רק לווידאו של עמדות WisKey.</div>`:o}
                ${Ue()?o:r`<div class="hint" data-go2rtc-required>${Tt}</div>`}
                ${this.row("סנכרון זרמים אחרון תקין",re(e.discovery.streams_last_ok),e.discovery.streams_last_error?"warn":"ok")}
                ${e.discovery.streams_last_error?this.row("שגיאת סנכרון זרמים",e.discovery.streams_last_error,"err"):o}
                ${this.check("go2rtc")?this.row("בדיקת בריאות",this.check("go2rtc").detail,this.check("go2rtc").status==="ok"?"ok":this.check("go2rtc").status==="warn"?"warn":"err"):r`<div class="hint">פרטי הזרמים והגרסה מוצגים ב"הגדרות ‹ כללי ‹ בריאות ועבודות" (דורש הרשאת ניהול).</div>`}
              </sw-card>
              ${this.renderWiskeyCard()}
              ${O("system.configure")?r`<sw-secrets-card></sw-secrets-card>`:o}
              ${O("system.configure")?r`<sw-bridge-key-card></sw-bridge-key-card>`:o}
              ${O("partner.manage")?r`<sw-partner-api-card></sw-partner-api-card>`:o}
              ${O("system.configure")?r`<sw-door-setup data-door-setup></sw-door-setup><sw-door-inventory data-door-inventory></sw-door-inventory><sw-door-blocks data-door-blocks></sw-door-blocks><sw-emergency-open-settings></sw-emergency-open-settings>`:o}
              ${O("system.configure")||O("access.admin.read")?r`<sw-wiskey-relay-map data-relay-map></sw-wiskey-relay-map>`:o}
              <sw-card heading="תשתית המערכת" subheading=${e.home_assistant.connected?`מחובר · גרסה ${e.home_assistant.ha_version??""}`:e.home_assistant.configured?"מוגדר, מנותק":"לא מוגדר"}>
                ${this.row("חיבור",e.home_assistant.connected?"מחובר":`מנותק${e.home_assistant.last_error?` · ${e.home_assistant.last_error}`:""}`,e.home_assistant.connected?"ok":"err")}
                ${this.row("ישויות בקטלוג",e.home_assistant.entities)}
                ${this.row("תמונת מצב אחרונה",re(e.home_assistant.last_snapshot_at))}
                ${this.row("עדכון ישות אחרון",re(e.home_assistant.last_event_at))}
                ${this.row("רישום (אזורים / קומות) עודכן",re(e.home_assistant.last_registry_at))}
                ${this.row("התחברויות מחדש מאז ההפעלה",e.home_assistant.reconnects,e.home_assistant.reconnects>3?"warn":"")}
                ${this.row("מקור הזהות",e.identity_source==="ingress"?"תשתית המערכת (כניסה מקומית)":e.identity_source)}
              </sw-card>
              <sw-card heading="אחסון וכלים" subheading=${`גרסה ${e.version}`}>
                ${this.row("בסיס הנתונים",e.db.ok?`תקין · מהדורת הרשאות ${e.db.permission_revision}`:"שגיאה",e.db.ok?"ok":"err")}
                ${this.row("תיקיית הנתונים (/data)",e.data_dir_writable?"ניתנת לכתיבה":"לא ניתנת לכתיבה",e.data_dir_writable?"ok":"err")}
                ${this.row("ממיר תוכניות PDF",e.renderer??"חסר",e.renderer?"ok":"warn")}
                ${this.row("אירועים שמורים",e.events.stored)}
                ${this.check("thumbnails")?this.row("תמונות אירועים (ffmpeg)",this.check("thumbnails").detail,this.check("thumbnails").status==="ok"?"ok":"warn"):o}
                ${this.check("backups")?this.row("גיבויים",this.check("backups").detail,this.check("backups").status==="ok"?"ok":"warn"):o}
              </sw-card>
            </div>
            <sw-card heading="איפה מגדירים" subheading="חיבורים נוספים מוגדרים בהגדרות SmplWise Arx בתשתית המערכת; הערכים אינם מוצגים כאן ושינוי דורש הפעלה מחדש; סיסמאות ומפתחות בכרטיס סודות">
              <div class="opts" data-connection-options>
                ${ci.map(t=>r`<div class="check"><span>${t.label}</span><span class="val ltr">${t.key}</span></div>`)}
              </div>
              <div class="hint">משתמש ה־NVR צריך הרשאות צפייה והקלטות; Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה.</div>
            </sw-card>`:this.error?o:r`<sw-state-panel state="loading" heading="קורא את מצב החיבורים…"></sw-state-panel>`}
      </sw-page>
    `}render(){return fe()?this.renderApi():r`<sw-page crumbs="הגדרות" heading="חיבורים" subheading="מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · כתיבה ל־NVR רק בפעולות המאושרות, עם הרשאה רגישה">
      <sw-state-panel icon="link" state="empty" heading="החיבורים מוצגים מול שרת אמיתי" hint="במצב הדגמה אין חיבורים לקרוא. שלבי ההתקנה עם נתוני הדגמה נמצאים באשף ההתקנה." actionLabel="לאשף ההתקנה" @action=${()=>window.location.hash="#/system/wizard"}></sw-state-panel>
    </sw-page>`}};v.styles=[De,M`
    /* SETUPPLAN-POLISH-2331: the channel matrix is a dense data table (ui-ux-pro-max: tabular numerals, a quiet header, a row
       hover under a pointer that hovers, a scroll box of its own so a 16-channel recorder never widens the page on a phone) */
    .tablewrap {
      overflow-x: auto;
      margin-block: var(--sw-s-2);
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      -webkit-overflow-scrolling: touch;
    }
    .matrix {
      inline-size: 100%;
      border-collapse: collapse;
      font-size: var(--sw-fs-sm);
    }
    .matrix th,
    .matrix td {
      text-align: start;
      padding: 8px 12px;
      border-block-end: 1px solid var(--sw-border);
      vertical-align: middle;
      white-space: nowrap;
    }
    .matrix td:nth-child(2) {
      white-space: normal;
      min-inline-size: 120px;
    }
    .matrix tbody tr:last-child td {
      border-block-end: 0;
    }
    .matrix th {
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-xs);
    }
    .matrix .num {
      font-variant-numeric: tabular-nums;
    }
    .matrix .act {
      text-align: end;
    }
    .matrix .dim {
      color: var(--sw-text-3);
    }
    @media (hover: hover) and (pointer: fine) {
      .matrix tbody tr:hover td {
        background: var(--sw-hover-wash);
      }
    }
    /* a yes / no mark: a drawn check or cross in a small tinted chip (the success / neutral tones of the fact rows) */
    .yn {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
      vertical-align: middle;
    }
    .yn.on {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .yn.off {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .legend .yn {
      inline-size: 18px;
      block-size: 18px;
    }
    .msg {
      margin-block-start: var(--sw-s-2);
    }
    .dlgtext {
      font-size: var(--sw-fs-sm);
      line-height: 1.6;
      color: var(--sw-text);
    }
    ul.changes {
      list-style: none;
      margin: 0;
      padding: 0;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    ul.changes li {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-2);
      padding-block: 6px;
      border-block-end: 1px solid var(--sw-border);
    }
    ul.changes li:last-child {
      border-block-end: 0;
    }
    ul.changes li .ltr {
      font-variant-numeric: tabular-nums;
      color: var(--sw-text-3);
    }
    /* owner round 4 (1.1): the system card packed clock/disks/outputs/reboot behind bare bold text with no
       separation - a wall of controls. A real section head (icon, label, rule) makes it scannable. */
    .syshead {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-block: 14px 4px;
      padding-block-start: 12px;
      border-block-start: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .syshead:first-child {
      margin-block-start: 0;
      padding-block-start: 0;
      border-block-start: 0;
    }
    .syshead sw-icon {
      color: var(--sw-accent);
    }
    .opts {
      columns: 2;
      column-gap: 24px;
    }
    .opts .check {
      break-inside: avoid;
    }
    @media (max-width: 767px) {
      .opts {
        columns: 1;
      }
      .check {
        flex-wrap: wrap;
      }
      .val {
        max-inline-size: 100%;
      }
    }
  `,pt];w([d()],v.prototype,"raw",2);w([d()],v.prototype,"report",2);w([d()],v.prototype,"recorder",2);w([d()],v.prototype,"error",2);w([d()],v.prototype,"busy",2);w([d()],v.prototype,"notify",2);w([d()],v.prototype,"notifyError",2);w([d()],v.prototype,"notifyPlan",2);w([d()],v.prototype,"notifyBusy",2);w([d()],v.prototype,"notifyResult",2);w([d()],v.prototype,"sys",2);w([d()],v.prototype,"sysRecorder",2);w([d()],v.prototype,"sysRecorders",2);w([d()],v.prototype,"sysError",2);w([d()],v.prototype,"sysMsg",2);w([d()],v.prototype,"sysBusy",2);w([d()],v.prototype,"ntpForm",2);w([d()],v.prototype,"rebootWord",2);w([d()],v.prototype,"rebootOpen",2);w([d()],v.prototype,"changes",2);w([d()],v.prototype,"wiskey",2);w([d()],v.prototype,"wiskeyError",2);w([d()],v.prototype,"wiskeyForm",2);w([d()],v.prototype,"wiskeyClear",2);w([d()],v.prototype,"wiskeyMsg",2);w([d()],v.prototype,"wiskeyBusy",2);w([d()],v.prototype,"sysOk",2);w([d()],v.prototype,"notifyOk",2);w([d()],v.prototype,"wiskeyOk",2);v=w([N("system-setup")],v);export{v as SystemSetup};
//# sourceMappingURL=system-setup--eToTkhl.js.map
