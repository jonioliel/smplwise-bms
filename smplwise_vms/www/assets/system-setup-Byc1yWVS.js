import{g as G,at as Se,E as A,G as d,a as R,Y as f,j as Ae,A as o,e as i,H as O,gM as Be,C as ht,dT as kt,dU as xt,dq as ve,kR as _t,F as b,cn as ke,w as We,uP as zt,bP as Ct,bd as N,l as ne,i as be,jm as ge,uQ as St,uR as Rt,aB as Ot,aa as Z,jn as Et,uS as Nt,uT as Pt,uU as u,uV as ut,uW as Ue,uX as Tt,uY as Oe,uZ as qe,u_ as Ke,u$ as It,v0 as Dt,v1 as At,a9 as vt,S as Bt,f6 as He,f7 as jt,v2 as Lt,v3 as Mt,v4 as Vt,v5 as Ft,v6 as Ge,v7 as Wt}from"./index-D8-Lulvz.js";import"./system-doors-MZgz1slm.js";import{fmtWhen as ft}from"./access-9JV6v1KG.js";import{l as Ie}from"./live-CSuUWPCG.js";import"./sw-chip-Lquv6NJt.js";import{n as Ut,k as qt,l as Ze,m as Kt,p as Ht}from"./nvr-DKwZxx_Q.js";import"./nvr-connection-form-BGkbbdCa.js";import{o as Gt,p as Zt,q as Xt,m as ce,t as Yt,u as De,A as Qt,v as Jt,l as es,w as ts,x as xe,y as ss,z as mt,B as as,C as is,D as rs,E as ns,F as os,G as Xe,H as ls,I as ds,J as cs,K as ps,L as hs,S as us,M as Ye,N as vs,O as fs,P as Qe,Q as Je,R as ms,T as bs,U as Ee,V as gs,W as ws,X as $s,j as Ne,a as ys,Y as et,k as tt,Z as ks,_ as xs,$ as _s,a0 as zs,a1 as st}from"./frigate-control-D_FkTuVS.js";import{f as p}from"./frigate-text-DekzVAPK.js";import{l as Cs,u as at,S as Ss}from"./recorders-BjPKTS_H.js";import"./sw-logo-art-Va6y_cIM.js";import"./nvr-h264-preset-CWl-CnDx.js";const Rs=()=>G("wiskey/relay-map"),Os=(e,t,s,r)=>Se(`wiskey/relay-map/${encodeURIComponent(e)}`,{expected_revision:t,rows:s,confirmed:!0,...r?{confirm_text:r}:{}}),je="off";function _e(e,t){const s=e.relays.find(r=>r.physical_index===t);return s?.name?`ממסר פיזי ${t} · ${s.name}`:`ממסר פיזי ${t}`}function Es(e){return[{value:je,label:"מושבת"},...e.relays.map(t=>({value:String(t.physical_index),label:_e(e,t.physical_index)}))]}function Ns(e){const t=Number(e);return e!==je&&Number.isInteger(t)&&t>=1?t:null}function Le(e){const t={};for(const s of e.rows)t[s.api_relay]=s.active?s.physical_relay:null;return t}function Ps(e){return Object.keys(e).map(Number).sort((t,s)=>t-s).map(t=>({api_relay:t,physical_relay:e[t]??null}))}function Re(e,t){const s=Le(e),r=new Set;for(const l of Object.keys(s).map(Number)){const g=s[l]??null,B=t[l]??null;g!==B&&(g!==null&&r.add(g),B!==null&&r.add(B))}const a=Object.values(t).filter(l=>l!==null),n=[...new Set(a.filter((l,g)=>a.indexOf(l)!==g))].sort((l,g)=>l-g),c=[...r].sort((l,g)=>l-g);return{changed:c.length>0,affected:c,automated:c.filter(l=>e.automated_relays.includes(l)),duplicate:n}}function Ts(e,t,s){const r=Re(e,t);return s&&e.in_copy&&r.changed&&r.duplicate.length===0}function it(e,t){return Re(e,t).automated.length>0}function Is(e){if(!e.in_copy)return{tone:"stale",text:"התחנה אינה מופיעה כעת ב-WisKey"};if(e.revision===0)return{tone:"unknown",text:"לא אושר - חירום ואוטומציות דרך WisKey ייחסמו"};const t=new Set(Object.values(Le(e)).filter(r=>r!==null)),s=e.relays.map(r=>r.physical_index).filter(r=>!t.has(r));return s.length?{tone:"stale",text:`חלקי · מהדורה ${e.revision} · ${s.map(r=>`ממסר פיזי ${r}`).join(", ")} לא ממופה`}:{tone:"live",text:`מאושר · מהדורה ${e.revision}`}}function Ds(e,t){return e.approved_at?`אושר בידי ${e.approved_by??"משתמש לא ידוע"} · ${t(e.approved_at)}`:"טרם אושר"}function As(e,t){const s=Re(e,t),r=s.affected.map(n=>_e(e,n)).join(", "),a=s.automated.length?` לדלתות ${s.automated.map(n=>_e(e,n)).join(", ")} יש אוטומציה - היא תפעל לפי המיפוי החדש.`:"";return`לאשר את מיפוי הממסרים של ${e.name}? השינוי נוגע ל${r}.${a} שום פקודה לא נשלחת לתחנה.`}var Bs=Object.defineProperty,js=Object.getOwnPropertyDescriptor,pe=(e,t,s,r)=>{for(var a=r>1?void 0:r?js(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&Bs(t,s,a),a};let ae=class extends R{constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.drafts={},this.pending=null,this.word=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await Rs(),this.drafts={},this.error=""}catch(e){this.error=f(e)}}draft(e){return this.drafts[e.id]??Le(e)}pick(e,t,s){this.drafts={...this.drafts,[e.id]:{...this.draft(e),[t]:Ns(s)}}}ask(e){this.word="",this.pending=e}async approve(){const e=this.pending;if(!e)return;const t=this.draft(e);this.busy=!0;try{await Os(e.id,e.revision,Ps(t),it(e,t)?this.word.trim():void 0),this.pending=null,await this.load()}catch(s){const r=f(s);this.pending=null,s instanceof Ae&&s.status===409&&await this.load(),this.error=r}finally{this.busy=!1}}stationBlock(e,t){const s=this.draft(t),r=Is(t),a=Re(t,s),n=e.can_edit&&t.in_copy,c=Es(t);return i`<div class="station" data-relay-map-station=${t.name}>
      <div class="head">
        <div class="who"><span class="name">${t.name||"תחנה ללא שם"}</span><span class="sub">${Ds(t,ft)}</span></div>
        <sw-badge kind=${r.tone} label=${r.text}></sw-badge>
      </div>
      <div class="rows">
        ${t.rows.map(l=>{const g=s[l.api_relay]??null;return i`<label data-relay-map-row=${l.api_relay}>
            <span>ממסר API ${l.api_relay}</span>
            <select aria-label=${`${t.name}: ממסר API ${l.api_relay}`} ?disabled=${!n||this.busy} @change=${B=>this.pick(t,l.api_relay,B.target.value)}>
              ${c.map(B=>i`<option value=${B.value} ?selected=${B.value===(g===null?je:String(g))}>${B.label}</option>`)}
            </select>
          </label>`})}
      </div>
      ${t.automated_relays.length?i`<div class="sub" data-relay-map-automated>יש אוטומציה על ${t.automated_relays.map(l=>_e(t,l)).join(", ")}</div>`:o}
      ${a.duplicate.length?i`<div class="err" role="alert">כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד.</div>`:o}
      ${n&&a.changed?i`<div class="actions">
            <sw-button size="sm" variant="primary" data-relay-map-approve ?disabled=${this.busy||!Ts(t,s,e.can_edit)} @click=${()=>this.ask(t)}>אישור מיפוי</sw-button>
            <sw-button size="sm" variant="ghost" data-relay-map-reset ?disabled=${this.busy} @click=${()=>{const{[t.id]:l,...g}=this.drafts;this.drafts=g}}>ביטול שינויים</sw-button>
          </div>`:o}
    </div>`}dialog(e,t){const s=this.draft(t),r=it(t,s),a=!r||this.word.trim()===e.confirm_word;return i`<sw-dialog open heading="מיפוי ממסרים" data-relay-map-confirm @close=${()=>{this.pending=null}}>
      <p>${As(t,s)}</p>
      ${r?i`<div class="word">
            <span class="warn">כדי לאשר יש להקליד "${e.confirm_word}"</span>
            <input data-relay-map-word aria-label=${`להקליד ${e.confirm_word}`} .value=${this.word} @input=${n=>this.word=n.target.value} />
          </div>`:o}
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-relay-map-ok ?disabled=${this.busy||!a} @click=${()=>this.approve()}>אישור</sw-button>
    </sw-dialog>`}render(){if(this.error&&!this.map)return i`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return i`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,t=e.can_edit?"לכל תחנה: איזה ממסר פיזי (דלת) כל ממסר API מפעיל · חירום ואוטומציות דרך WisKey פועלים רק על מיפוי מאושר · לא נשלחת פקודה לתחנה":"לצפייה בלבד · שינוי המיפוי שמור למנהל המערכת";return i`<sw-card heading="מיפוי ממסרים" subheading=${t} data-relay-map-card>
      ${this.error?i`<div class="err" role="alert">${this.error}</div>`:o}
      ${e.stations.length?e.stations.map(s=>this.stationBlock(e,s)):i`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${e.has_copy?"WisKey לא מסר תחנות.":"נתוני WisKey אינם זמינים כרגע."}></sw-state-panel>`}
      ${this.pending?this.dialog(e,this.pending):o}
    </sw-card>`}};ae.styles=A`
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
  `;pe([d()],ae.prototype,"map",2);pe([d()],ae.prototype,"error",2);pe([d()],ae.prototype,"busy",2);pe([d()],ae.prototype,"drafts",2);pe([d()],ae.prototype,"pending",2);pe([d()],ae.prototype,"word",2);ae=pe([O("sw-wiskey-relay-map")],ae);const Ls=()=>G("doors/blocks"),Ms=(e,t,s)=>Se(`doors/blocks/entities/${encodeURIComponent(e)}`,{unblocked:t,...s?{note:s}:{},confirmed:!0}),bt={title:"חסימות פתיחת דלתות",sub:"כל עוד יש דלת אינטרקום, התקן וירטואלי (תבנית) שלא ניתן להוכיח שאינו דלת נחסם, וכך גם פריט שמשתמש בו. מנהל מערכת יכול לשחרר התקן אחד ולהחזיר אותו לחסימה. כל שינוי נרשם ביומן.",entities:"התקנים וירטואליים",items:"פריטים חסומים",search:"חיפוש לפי שם, אזור או סיבה",fAll:"הכול",fBlocked:"חסומים",fReleased:"משוחררים",refresh:"רענון",more:"הצג עוד ({n})",retry:"נסה שוב",none:"אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום",noEntities:"אין התקנים וירטואליים לשחרור",noMatch:"אין התאמות לחיפוש",noItems:"אין פריטים חסומים",truncated:"הרשימה קטועה: מוצגים רק ההתקנים הראשונים לפי שם",summary:"{blocked} חסומים · {released} משוחררים",summaryItems:"{blocked} פריטים חסומים",sBlocked:"חסום",sReleased:"משוחרר",sDoor:"משויך לדלת",sStale:"כבר אינו בקטלוג",usedBy:"בשימוש: {names}",usedMore:" ועוד {n}",releasedBy:"שוחרר בידי {who} · {when}",toggle:"שחרור {name}",itemFreed:"אינו חסום עוד",itemBlocked:"חסום",itemDevices:"התקנים וירטואליים: {names}",itemDevicesMore:" ועוד {n}",itemDeviceReleased:"{name} (משוחרר)",itemStays:"נשאר חסום גם אחרי שחרור ההתקנים",releaseTitle:"שחרור התקן וירטואלי",releaseText:"ההתקן יפסיק להיחסם: כפתורי התקנים, פעולה מרוכזת ופריטים שמשתמשים בו יורשו מ־Arx, גם אם הוא פותח דלת אינטרקום. השחרור נרשם ביומן עם שמך והסיבה, ואפשר להחזיר את החסימה בכל עת.",noteLabel:"סיבה לשחרור (חובה)",noteHint:"לפחות 3 תווים, עד {max}",release:"שחרור",reblockTitle:"החזרת חסימה להתקן",reblockText:"פעולות על ההתקן ייחסמו שוב, ופריטים שמשתמשים בו לא יופעלו מ־Arx עד שיוסר ממנו.",reblock:"החזרת חסימה",noteOptional:"סיבה (לא חובה)",cancel:"ביטול",saved:"נשמר",needNote:"נדרשת סיבה (לפחות 3 תווים)",tooLong:"הסיבה ארוכה מדי (עד {max} תווים)",d_lock:"מנעול",d_switch:"מתג",d_light:"תאורה",d_cover:"תריס או שער",d_fan:"מאוורר",d_button:"כפתור",d_media_player:"נגן",d_select:"בחירה",d_number:"ערך",d_valve:"ברז",d_vacuum:"שואב",d_alarm_control_panel:"לוח אזעקה",d_climate:"מיזוג",d_other:"התקן"},Vs={title:"Door blocks",entities:"Virtual devices",items:"Blocked items",search:"Search by name, area or reason",fAll:"All",fBlocked:"Blocked",fReleased:"Released",refresh:"Refresh",more:"Show more ({n})",sBlocked:"Blocked",sReleased:"Released",sDoor:"Mapped to a door",release:"Release",reblock:"Block again",cancel:"Cancel"};function Fs(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function v(e,t){const s=(Fs()==="en"?Vs[e]:void 0)??bt[e];return t?s.replace(/\{(\w+)\}/g,(r,a)=>a in t?String(t[a]):r):s}function Ws(e,t,s){return e in bt?v(e,s):v(t,s)}const Us=3,Me=300,$e=50,qs=["all","blocked","released"],Ks={all:"fAll",blocked:"fBlocked",released:"fReleased"},Hs=e=>v(Ks[e]),gt=e=>e.split(/\s+/).filter(Boolean).join(" ");function Gs(e){const t=gt(e).length;return t<Us?"required":t>Me?"too_long":null}function Zs(e){return e==="required"?v("needNote"):v("tooLong",{max:Me})}const rt=e=>e.toLowerCase().split(/\s+/).filter(Boolean).join(" ");function Xs(e,t,s){const r=rt(t).split(" ").filter(Boolean);return e.filter(a=>{if(s==="blocked"&&a.state==="unblocked"||s==="released"&&a.state!=="unblocked")return!1;if(!r.length)return!0;const n=rt([a.name,a.entity_id,a.area??"",wt(a.domain),a.override?.note??"",a.override?.by??""].join(" "));return r.every(c=>n.includes(c))})}function Ys(e,t){return{rows:e.slice(0,t),left:Math.max(0,e.length-t)}}const wt=e=>Ws(`d_${e}`,"d_other");function nt(e){return[wt(e.domain),e.area].filter(Boolean).join(" · ")}function Qs(e){return e.state==="door"?{kind:"unknown",text:v("sDoor")}:e.state==="unblocked"?{kind:"live",text:e.stale?`${v("sReleased")} · ${v("sStale")}`:v("sReleased")}:{kind:"stale",text:v("sBlocked")}}function Js(e){return e.used_by.length?v("usedBy",{names:e.used_by.join(", ")})+(e.used_more?v("usedMore",{n:e.used_more}):""):""}function ea(e,t){return e.override?v("releasedBy",{who:e.override.by||"—",when:t(e.override.at)}):""}function ta(e){if(!e.devices.length)return"";const t=e.devices.map(s=>s.state==="unblocked"?v("itemDeviceReleased",{name:s.name}):s.name).join(", ");return v("itemDevices",{names:t})+(e.devices_more?v("itemDevicesMore",{n:e.devices_more}):"")}function sa(e){return e.blocked?{kind:"stale",text:v("itemBlocked")}:{kind:"live",text:v("itemFreed")}}function aa(e){return!e.wiskey_present&&!e.counts.entities?v("none"):v("summary",{blocked:e.counts.blocked,released:e.counts.unblocked})}var ia=Object.defineProperty,ra=Object.getOwnPropertyDescriptor,X=(e,t,s,r)=>{for(var a=r>1?void 0:r?ra(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ia(t,s,a),a};let j=class extends R{constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.status="all",this.shown=$e,this.pending=null,this.note="",this.problem="",this.saved=!1,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}async load(){const e=++this.gen;this.busy=!0;try{const t=await Ls();if(e!==this.gen)return;this.data=t,this.error=""}catch(t){if(e!==this.gen)return;this.error=f(t)}finally{e===this.gen&&(this.busy=!1)}}ask(e,t){this.pending={entity:e,release:t},this.note="",this.problem="",this.saved=!1,this.requestUpdate()}cancel(){this.pending=null,this.problem="",this.requestUpdate()}async confirm(){const e=this.pending;if(!(!e||this.busy)){if(e.release){const t=Gs(this.note);if(t){this.problem=Zs(t);return}}this.busy=!0,this.problem="";try{const t=await Ms(e.entity.entity_id,e.release,gt(this.note)||void 0);this.data&&(this.data={...this.data,entities:this.data.entities.map(s=>s.entity_id===t.entity_id?{...s,state:t.state,override:t.override}:s)}),this.pending=null,this.note="",this.saved=!0,this.busy=!1,await this.load()}catch(t){this.problem=f(t)}finally{this.busy=!1}}}entityRow(e){const t=Qs(e),s=Js(e),r=ea(e,ft);return i`<div class="ent" data-door-block=${e.entity_id} data-door-block-state=${e.state}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${nt(e)}</span>
        ${s?i`<span class="sub" data-door-block-used>${s}</span>`:o}
        ${e.override?i`<span class="sub" data-door-block-when>${r}</span><span class="note" data-door-block-why>${e.override.note}</span>`:o}
      </div>
      <div class="ctl">
        <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
        ${e.state==="door"||!e.overridable?o:i`<sw-toggle class="t" label=${v("toggle",{name:e.name})} labelHidden data-door-block-toggle .checked=${Ie(e.state==="unblocked")} ?disabled=${this.busy}
              @change=${a=>this.ask(e,a.detail.checked)}></sw-toggle>`}
      </div>
    </div>`}itemRow(e){const t=sa(e),s=ta(e);return i`<div class="item" data-door-block-item=${e.key} data-blocked=${String(e.blocked)} data-opens-door=${String(e.opens_door)}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${e.kind_text}</span>
        ${e.opens_door?i`<span class="warn" data-door-block-door>${e.guard}${e.why?` · ${e.why}`:""}</span>`:o}
        ${s?i`<span class="sub" data-door-block-devices>${s}</span>`:o}
        ${e.opens_door&&s?i`<span class="sub">${v("itemStays")}</span>`:o}
        ${!e.opens_door&&!s&&e.reasons.length?i`<span class="sub">${e.reasons.join(" · ")}</span>`:o}
      </div>
      <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
    </div>`}dialog(){const e=this.pending;return e?i`<sw-dialog open heading=${e.release?v("releaseTitle"):v("reblockTitle")} data-door-block-dialog @close=${()=>this.cancel()}>
      <p class="q"><strong>${e.entity.name}</strong> · ${nt(e.entity)}</p>
      <p class="q">${e.release?v("releaseText"):v("reblockText")}</p>
      <sw-field label=${e.release?v("noteLabel"):v("noteOptional")} hint=${e.release?v("noteHint",{max:Me}):""}>
        <textarea data-door-block-note-input rows="3" maxlength="600" aria-label=${e.release?v("noteLabel"):v("noteOptional")} .value=${this.note}
          @input=${t=>{this.note=t.target.value,this.problem=""}}></textarea>
      </sw-field>
      ${this.problem?i`<div class="err" role="alert" data-door-block-problem>${this.problem}</div>`:o}
      <sw-button slot="footer" variant="ghost" data-door-block-cancel @click=${()=>this.cancel()}>${v("cancel")}</sw-button>
      <sw-button slot="footer" variant=${e.release?"primary":"danger"} data-door-block-ok ?disabled=${this.busy} @click=${()=>void this.confirm()}>${e.release?v("release"):v("reblock")}</sw-button>
    </sw-dialog>`:o}render(){if(this.error&&!this.data)return i`<sw-state-panel state="error" hint=${this.error} actionLabel=${v("retry")} data-door-blocks-state="error" @action=${()=>void this.load()}></sw-state-panel>`;if(!this.data)return i`<sw-state-panel state="loading" data-door-blocks-state="loading"></sw-state-panel>`;const e=this.data,t=Xs(e.entities,this.q,this.status),s=Ys(t,this.shown);return i`<sw-card heading=${v("title")} subheading=${v("sub")} data-door-blocks-card data-door-blocks-state="ready" style="margin-block-start: var(--sw-s-3)">
      ${this.error?i`<div class="err" role="alert">${this.error}</div>`:o}
      ${this.saved?i`<div class="sub" role="status" data-door-blocks-saved>${v("saved")}</div>`:o}
      <div class="sum" data-door-blocks-summary>${aa(e)}${e.items.length?` · ${v("summaryItems",{blocked:e.counts.items_blocked})}`:""}</div>
      ${!e.wiskey_present&&!e.entities.length?i`<sw-state-panel icon="door" state="empty" heading=${v("none")} data-door-blocks-none></sw-state-panel>`:i`<h3>${v("entities")}</h3>
          <div class="tools">
            <input type="search" data-door-blocks-search placeholder=${v("search")} aria-label=${v("search")} .value=${this.q}
              @input=${r=>{this.q=r.target.value,this.shown=$e}} />
            <div class="chips" role="group" aria-label=${v("entities")}>
              ${qs.map(r=>i`<sw-chip data-door-blocks-filter=${r} ?selected=${this.status===r} @click=${()=>{this.status=r,this.shown=$e}}>${Hs(r)}</sw-chip>`)}
            </div>
            <sw-button size="sm" variant="ghost" icon="refresh" data-door-blocks-refresh ?disabled=${this.busy} @click=${()=>void this.load()}>${v("refresh")}</sw-button>
          </div>
          ${s.rows.length?s.rows.map(r=>this.entityRow(r)):i`<sw-state-panel icon="door" state="empty" heading=${e.entities.length?v("noMatch"):v("noEntities")}></sw-state-panel>`}
          ${s.left?i`<sw-button class="more" size="sm" variant="ghost" data-door-blocks-more @click=${()=>{this.shown+=$e}}>${v("more",{n:s.left})}</sw-button>`:o}
          ${e.truncated?i`<div class="sub">${v("truncated")}</div>`:o}
          <h3>${v("items")}</h3>
          ${e.items.length?e.items.map(r=>this.itemRow(r)):i`<sw-state-panel icon="door" state="empty" heading=${v("noItems")}></sw-state-panel>`}`}
    </sw-card>${this.dialog()}`}};j.styles=[Be,A`
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
    `,ht];X([d()],j.prototype,"data",2);X([d()],j.prototype,"error",2);X([d()],j.prototype,"busy",2);X([d()],j.prototype,"q",2);X([d()],j.prototype,"status",2);X([d()],j.prototype,"shown",2);X([d()],j.prototype,"pending",2);X([d()],j.prototype,"note",2);X([d()],j.prototype,"problem",2);X([d()],j.prototype,"saved",2);j=X([O("sw-door-blocks")],j);var na=Object.defineProperty,oa=Object.getOwnPropertyDescriptor,fe=(e,t,s,r)=>{for(var a=r>1?void 0:r?oa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&na(t,s,a),a};const me=[["doors.emergency.grant.default_hours","sGrantDefault",0],["doors.emergency.grant.max_hours","sGrantMax",1]],$t=[["doors.emergency.grant.by_security_manager","sGrantManager"],["doors.emergency.retry_open.by_holders","sRetryHolders"]],ot=[...me.map(e=>e[0]),...$t.map(e=>e[0])];let le=class extends R{constructor(){super(...arguments),this.saved=null,this.edit={},this.busy=!1,this.error="",this.done=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=(await kt()).settings,t=Object.fromEntries(ot.map(s=>[s,String(e[s]??"")]));this.saved=t,this.edit={...t}}catch{this.saved=null}}async save(){if(!this.saved)return;const e=Object.fromEntries(Object.entries(this.edit).filter(([t,s])=>this.saved[t]!==s));if(Object.keys(e).length){this.busy=!0,this.error="",this.done=!1;try{await xt(e),await this.load(),this.done=!0}catch(t){this.error=f(t)}finally{this.busy=!1}}}render(){if(!this.saved)return o;const e=ot.some(s=>this.edit[s]!==this.saved[s]),t=me.every(([s,,r])=>/^\d+$/.test(this.edit[s]??"")&&Number(this.edit[s])>=r&&Number(this.edit[s])<=8760)&&Number(this.edit[me[0][0]])<=Number(this.edit[me[1][0]]);return i`<sw-card heading=${ve("sGrants")} data-emergency-open-settings>
      ${me.map(([s,r])=>i`<div class="f"><label for=${s}>${ve(r)}</label>
        <input id=${s} type="text" inputmode="numeric" data-eo-setting=${s} .value=${Ie(this.edit[s]??"")}
          @input=${a=>{this.edit={...this.edit,[s]:a.target.value.trim()},this.done=!1}}></div>`)}
      ${$t.map(([s,r])=>i`<div class="f"><span>${ve(r)}</span>
        <sw-toggle label=${ve(r)} labelHidden data-eo-switch=${s} .checked=${Ie(this.edit[s]==="on")}
          @change=${a=>{this.edit={...this.edit,[s]:a.detail.checked?"on":"off"},this.done=!1}}></sw-toggle></div>`)}
      <div class="bar"><sw-button variant="primary" data-eo-save ?disabled=${this.busy||!e||!t} @click=${()=>void this.save()}>${ve("sSave")}</sw-button>
        ${this.done?i`<span>${ve("saved")}</span>`:o}${this.error?i`<span class="err" role="alert">${this.error}</span>`:o}</div>
    </sw-card>`}};le.styles=[Be,A`
      :host { display: block; }
      .f { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-3); flex-wrap: wrap; padding: var(--sw-s-2) 0; border-block-end: 1px solid var(--sw-border); }
      .f input { inline-size: 7em; box-sizing: border-box; min-block-size: 44px; font: inherit; color: var(--sw-text); background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: var(--sw-s-1) var(--sw-s-2); }
      .f input:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .bar { display: flex; gap: var(--sw-s-2); align-items: center; padding-block-start: var(--sw-s-2); }
      .err { color: var(--sw-danger-text, var(--sw-text)); font-size: var(--sw-fs-sm); }
    `];fe([d()],le.prototype,"saved",2);fe([d()],le.prototype,"edit",2);fe([d()],le.prototype,"busy",2);fe([d()],le.prototype,"error",2);fe([d()],le.prototype,"done",2);le=fe([O("sw-emergency-open-settings")],le);const he=A`
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
    .tbl .r .fold {
      display: inline;
    }
    .tbl .r .fold.chip {
      display: inline-flex;
    }
  }
  /* FRIGATE-F2B-2405: what a folded row would lose with its hidden columns (an export still being written, a Frigate-made row
     that is not Arx's to rename or delete) comes back as a tag on the sub line, drawn only while folded */
  .tbl .fold {
    display: none;
    vertical-align: baseline;
  }
  .tbl .fold.chip {
    margin-inline-end: var(--sw-s-1);
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
`;function K(e,t,s,r,a="data-supervised"){if(!e||!e.can_supervise||e.done[t])return o;const n=p().control.settings.supervised;return i`<label class="sup" data-supervised-box=${a}><input type="checkbox" .checked=${s} @change=${c=>r(c.target.checked)} /><span><b>${n.label}</b> · ${n.hint}</span></label>`}const te=(e,t)=>!!e&&!e.done[t]&&!e.can_supervise;function se(e,t){if(e==null)return"—";const s=typeof e=="number"?new Date(e*1e3):new Date(e);if(Number.isNaN(s.getTime()))return"—";try{return _t(s,{timeZone:t})}catch{return s.toISOString()}}function ze(e){if(!e)return null;const t=Date.parse(e);return Number.isFinite(t)?Math.floor(t/1e3):null}function Ce(e){const t=new Date(e*1e3),s=r=>String(r).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}T${s(t.getHours())}:${s(t.getMinutes())}`}var la=Object.defineProperty,da=Object.getOwnPropertyDescriptor,Y=(e,t,s,r)=>{for(var a=r>1?void 0:r?da(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&la(t,s,a),a};let L=class extends R{constructor(){super(...arguments),this.recorderId="",this.first=null,this.canConfigure=!1,this.canProfile=!1,this.tz="",this.data=null,this.failed="",this.busy=!1,this.msg=null,this.applying=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(this.recorderId)try{this.data=await Gt(this.recorderId),this.failed=""}catch(e){this.failed=f(e)}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}async setting(e){if(this.data){this.busy=!0;try{const t=await Zt(this.recorderId,e);this.data={...this.data,setting:t.setting},this.flash("ok",p().control.saved),this.changed(),this.load()}catch(t){this.flash("err",f(t)),this.load()}finally{this.busy=!1}}}async apply(){const e=this.applying;if(!(!e||this.busy)){this.busy=!0;try{const t=await Xt(this.recorderId,e.item.id,e.supervised);this.applying=null,this.flash("ok",t.status==="applied"?p().control.settings.auto.applied:t.status==="skipped"?p().control.settings.auto.status.skipped:p().control.unverified),this.changed(),this.load()}catch(t){this.applying={...e,error:ce(t)?p().control.settings.supervised.need:f(t)}}finally{this.busy=!1}}}async dismiss(e){this.busy=!0;try{await Yt(this.recorderId,e.id),this.flash("ok",p().control.settings.auto.dismissed),this.load()}catch(t){this.flash("err",f(t))}finally{this.busy=!1}}statusLine(){const e=p().control.settings.auto,t=this.data.setting;if(t.mode==="off")return i`<span class="chip" data-auto-status="off">${e.offText}</span>`;if(t.mode==="suggest")return i`<span class="chip accent" data-auto-status="suggest">${e.suggestOnly}</span>`;if(t.will_apply)return i`<span class="chip ok" data-auto-status="apply">${e.willApply}</span>`;const s=[t.profile_class_on?null:e.blockedClass,t.auto_apply_consent?null:e.blockedConsent,t.first_write_done?null:e.blockedFirst].filter(Boolean);return i`<span class="chip warn" data-auto-status="blocked">${e.suggestOnly} · ${s.join(" · ")}</span>`}itemLine(e){const t=p().control.settings.auto;return i`<b>${De(e.alarm_state)}</b> <span class="muted">${t.arrow}</span><b>${e.profile==="none"?t.profileNone:e.profile}</b>`}applyDialog(){const e=this.applying;if(!e)return o;const t=p().control.settings.auto,s=p().control,r=!!this.first&&this.first.can_supervise&&!this.first.done.profile_auto;return i`<sw-dialog open heading=${t.confirmApply} data-auto-confirm @close=${()=>this.applying=null}>
      <div class="form">
        <p class="dialog-text">${this.itemLine(e.item)} · ${s.confirmProfile}</p>
        ${K(this.first,"profile_auto",e.supervised,a=>this.applying={...e,supervised:a},"profile_auto")}
        ${e.error?i`<div class="err" role="alert" data-auto-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.applying=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-auto-apply-ok ?disabled=${this.busy||r&&!e.supervised} @click=${()=>void this.apply()}>${s.confirm}</sw-button>
    </sw-dialog>`}render(){const e=p().control.settings.auto,t=p().control.settings;if(this.failed)return i`<div class="panel" data-frigate-auto><div class="msg err" data-auto-failed>${this.failed}</div></div>`;const s=this.data;if(!s)return o;const r=s.setting,a=s.items.filter(l=>l.status==="suggested"||l.status==="pending"),n=s.items.filter(l=>l.status!=="suggested"&&l.status!=="pending").slice(0,8),c=this.busy||!this.canConfigure;return i`<div class="panel" data-frigate-auto>
      <div class="head"><h4>${e.title}</h4>${this.statusLine()}</div>
      <div class="row">
        <span class="name"><span>${e.mode}</span></span>
        <div class="seg" role="group" aria-label=${e.mode} data-auto-modes>
          ${Qt.map(l=>i`<button type="button" aria-pressed=${String(r.mode===l)} data-auto-mode=${l} ?disabled=${c||l==="apply"&&!r.auto_apply_consent} title=${l==="apply"&&!r.auto_apply_consent?e.blockedConsent:""} @click=${()=>r.mode!==l&&void this.setting({mode:l})}>${e.modes[l]}</button>`)}
        </div>
      </div>
      <div class="row">
        <span class="name"><span>${e.consent}</span>${r.auto_apply_consent&&r.consent_at?i`<span class="sub" data-auto-consent-by>${e.consentBy} · ${se(r.consent_at,this.tz||void 0)}</span>`:o}</span>
        <sw-toggle .checked=${r.auto_apply_consent} ?disabled=${c} labelHidden label=${e.consent} data-auto-consent @change=${l=>void this.setting({auto_apply_consent:l.currentTarget.checked})}></sw-toggle>
      </div>
      <h5>${e.suggestions}</h5>
      ${a.length?i`<div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) 110px 150px">
            ${a.map(l=>i`<div class="r" role="row" data-auto-item=${l.id}>
              <div class="c main" role="cell">${this.itemLine(l)}</div>
              <div class="c sub ltr muted" role="cell">${se(l.at,this.tz||void 0)}</div>
              <div class="c acts" role="cell">
                ${this.canProfile?i`<sw-button size="sm" variant="primary" data-auto-apply ?disabled=${this.busy} @click=${()=>this.applying={item:l,supervised:!1,error:""}}>${e.apply}</sw-button>
                  <sw-button size="sm" variant="ghost" data-auto-dismiss ?disabled=${this.busy} @click=${()=>void this.dismiss(l)}>${e.dismiss}</sw-button>`:o}
              </div>
            </div>`)}
          </div>`:i`<div class="tbl"><div class="empty" data-auto-empty>${e.noSuggestions}</div></div>`}
      ${n.length?i`<h5>${e.recent}</h5>
          <div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) minmax(120px, 1fr) 110px" data-auto-recent>
            ${n.map(l=>i`<div class="r" role="row" data-auto-recent-item=${l.id}>
              <div class="c main" role="cell">${this.itemLine(l)}</div>
              <div class="c sub" role="cell"><span class=${`chip ${l.status==="applied"?"ok":l.status==="failed"?"bad":""}`}>${e.status[l.status]??l.status}</span>${l.reason&&e.reason[l.reason]?i` <span class="muted">${e.reason[l.reason]}</span>`:o}</div>
              <div class="c ltr muted" role="cell">${se(l.at,this.tz||void 0)}</div>
            </div>`)}
          </div>`:o}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-auto-msg>${this.msg.text}</div>`:o}
      ${this.first&&!this.first.done.profile_auto&&r.mode!=="off"?i`<p class="note" data-auto-first-note>${t.kinds.profile_auto}: ${t.firstPending}</p>`:o}
      ${this.applyDialog()}
    </div>`}};L.styles=he;Y([b({attribute:"recorder-id"})],L.prototype,"recorderId",2);Y([b({attribute:!1})],L.prototype,"first",2);Y([b({type:Boolean})],L.prototype,"canConfigure",2);Y([b({type:Boolean})],L.prototype,"canProfile",2);Y([b()],L.prototype,"tz",2);Y([d()],L.prototype,"data",2);Y([d()],L.prototype,"failed",2);Y([d()],L.prototype,"busy",2);Y([d()],L.prototype,"msg",2);Y([d()],L.prototype,"applying",2);L=Y([O("frigate-auto-profile")],L);var ca=Object.defineProperty,pa=Object.getOwnPropertyDescriptor,T=(e,t,s,r)=>{for(var a=r>1?void 0:r?pa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ca(t,s,a),a};let S=class extends R{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.msg=null,this.draft=null,this.renaming=null,this.deleting=null,this.moving=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await Jt(this.recorderId);this.rows=e.exports,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=f(e),this.rows=[]}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return ce(e)?p().control.settings.supervised.need:f(e)}openCreate(){const e=Math.floor(Date.now()/1e3),t=this.cams.find(s=>s.enabled&&s.frigate_enabled!==!1)??this.cams[0];this.draft={camera:t?.id??"",start:Ce(e-600),end:Ce(e),name:"",supervised:!1,error:""}}async submitCreate(){const e=this.draft;if(!e||this.busy)return;const t=p().control.settings.exports,s=ze(e.start),r=ze(e.end),a=is(s,r);if(!e.camera)return void(this.draft={...e,error:t.chooseCamera});if(a)return void(this.draft={...e,error:a==="missing"?t.rangeMissing:a==="order"?t.rangeOrder:a==="long"?t.rangeLong:t.rangeFuture});if(!e.name.trim())return void(this.draft={...e,error:`${t.name}?`});this.busy=!0;try{const n=await es(this.recorderId,{camera_id:e.camera,start:s,end:r,name:e.name.trim(),...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",n.verified?t.created:p().control.unverified),this.changed()}catch(n){this.draft={...e,error:this.refusal(n)}}finally{this.busy=!1}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await ts(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?p().control.settings.exports.renamed:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!xe(e.typed,e.row.name))){this.busy=!0;try{const t=await ss(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?p().control.settings.exports.deleted:p().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async openMove(e){this.moving={row:e,caseId:e.case_id??"",cases:null,supervised:!1,error:""};try{const t=await mt(this.recorderId);this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:t.cases})}catch(t){this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:[],error:f(t)})}}async confirmMove(){const e=this.moving;if(!(!e||this.busy)){this.busy=!0;try{const t=await as(this.recorderId,e.row.id,e.caseId||null,e.supervised);this.moving=null,this.flash("ok",t.verified?p().control.settings.exports.moved:p().control.unverified),this.changed()}catch(t){this.moving={...e,error:this.refusal(t)}}finally{this.busy=!1}}}moveDialog(){const e=this.moving;if(!e)return o;const t=p().control.settings.exports,s=p().control,r=!!this.first&&this.first.can_supervise&&!this.first.done.export_assign,a=[{id:"",label:t.noCase},...(e.cases??[]).map(n=>({id:n.id,label:n.name||n.id}))];return i`<sw-dialog open heading=${t.moveToCase} subheading=${e.row.name} data-fx-move @close=${()=>this.moving=null}>
      <div class="form">
        <label>${t.case}<sw-dropdown block data-fx-case .label=${t.case} .value=${e.caseId} .items=${a} ?disabled=${e.cases===null}
          @change=${n=>this.moving={...e,caseId:n.detail.id}}></sw-dropdown></label>
        ${K(this.first,"export_assign",e.supervised,n=>this.moving={...e,supervised:n},"export_assign")}
        ${e.error?i`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.moving=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fx-move-ok ?disabled=${this.busy||e.cases===null||e.caseId===(e.row.case_id??"")||r&&!e.supervised}
        @click=${()=>void this.confirmMove()}>${s.confirm}</sw-button>
    </sw-dialog>`}camName(e,t){return this.cams.find(s=>s.id===e)?.name??t??e}createDialog(){const e=this.draft;if(!e)return o;const t=p().control.settings.exports,s=p().control,r=this.cams.filter(n=>n.enabled).map(n=>({id:n.id,label:n.name})),a=!!this.first&&this.first.can_supervise&&!this.first.done.export_create;return i`<sw-dialog open heading=${t.create} data-fx-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.camera}<sw-dropdown block data-fx-camera .label=${t.camera} .placeholder=${t.chooseCamera} .value=${e.camera} .items=${r} @change=${n=>this.draft={...e,camera:n.detail.id}}></sw-dropdown></label>
        <div class="two">
          <label>${t.from}<input type="datetime-local" lang=${ke()} data-fx-start .value=${e.start} @input=${n=>this.draft={...e,start:n.target.value}} /></label>
          <label>${t.to}<input type="datetime-local" lang=${ke()} data-fx-end .value=${e.end} @input=${n=>this.draft={...e,end:n.target.value}} /></label>
        </div>
        <label>${t.name}<input type="text" maxlength="80" data-fx-name .value=${e.name} @input=${n=>this.draft={...e,name:n.target.value}} /></label>
        ${K(this.first,"export_create",e.supervised,n=>this.draft={...e,supervised:n},"export_create")}
        ${e.error?i`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-fx-create-ok ?disabled=${this.busy||a&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return o;const t=p().control.settings.exports,s=p().control,r=!!this.first&&this.first.can_supervise&&!this.first.done.export_delete;return i`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fx-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${t.deleteText}</p>
        <input type="text" data-fx-delete-typed aria-label=${t.name} .value=${e.typed} @input=${a=>this.deleting={...e,typed:a.target.value}} />
        ${K(this.first,"export_delete",e.supervised,a=>this.deleting={...e,supervised:a},"export_delete")}
        ${e.error?i`<div class="err" role="alert" data-fx-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fx-delete-ok ?disabled=${this.busy||!xe(e.typed,e.row.name)||r&&!e.supervised} @click=${()=>void this.confirmDelete()}>${t.delete}</sw-button>
    </sw-dialog>`}row(e){const t=p().control.settings.exports,s=p().control,r=this.renaming?.id===e.id?this.renaming:null,a=this.enabled&&e.arx_created;return i`<div class="r" role="row" data-fx-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${r?i`<span class="inline"><input type="text" maxlength="80" data-fx-rename-input aria-label=${t.name} .value=${r.name} ?disabled=${this.busy}
                @input=${n=>this.renaming={...r,name:n.target.value}}
                @keydown=${n=>{n.key==="Enter"&&this.saveRename(),n.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${s.confirm} data-fx-rename-save ?disabled=${this.busy||!r.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${s.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:i`<b title=${e.name}>${e.name||e.id}</b>`}
        ${r?K(this.first,"export_rename",r.supervised,n=>this.renaming={...r,supervised:n},"export_rename"):o}
      </div>
      <div class="c sub muted" role="cell">${e.in_progress?i`<span class="chip warn fold" data-fx-fold-state>${t.inProgress}</span>`:o}${e.arx_created?o:i`<span class="fold" data-fx-fold-origin>${t.foreign} ·&nbsp;</span>`}${this.camName(e.camera_id,e.camera)} · ${se(e.date,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${se(e.date,this.tz||void 0)}</div>
      <div class="c" role="cell"><span class=${`chip ${e.in_progress?"warn":"ok"}`} data-fx-state=${e.in_progress?"progress":"ready"}>${e.in_progress?t.inProgress:t.ready}</span></div>
      <div class="c muted" role="cell">${e.arx_created?t.arx:t.foreign}</div>
      <div class="c acts" role="cell">
        ${a&&!r?i`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${t.rename} data-fx-rename ?disabled=${this.busy||te(this.first,"export_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:o}
        ${a&&!e.in_progress?i`<sw-button size="sm" variant="ghost" iconOnly icon="case" label=${t.moveToCase} data-fx-move-btn ?disabled=${this.busy||te(this.first,"export_assign")} @click=${()=>void this.openMove(e)}></sw-button>`:o}
        ${a?i`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${t.delete} data-fx-delete-btn ?disabled=${this.busy||te(this.first,"export_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:o}
      </div>
    </div>`}render(){if(!this.allowed)return o;const e=p().control.settings.exports,t=p().control.settings,s=this.rows,r=this.enabled&&!te(this.first,"export_create")&&this.cams.length>0;return i`<div class="panel" data-frigate-exports>
      <div class="head">
        <h4>${t.tabs.exports}</h4>
        <span class="inline">
          ${this.enabled?o:i`<span class="chip warn" data-fx-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.export_create?i`<span class="chip" data-fx-first-pending>${t.firstPending}</span>`:o}
          <sw-button size="sm" variant="primary" icon="plus" data-fx-new ?disabled=${!r} @click=${()=>this.openCreate()}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?i`<div class="msg err" role="alert" data-fx-failed>${this.failed}</div>`:o}
      ${s===null?o:s.length?i`<div class="tbl" role="table" style="--cols: minmax(140px, 1.6fr) minmax(90px, 1fr) 110px 88px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.camera}</span><span>${e.date}</span><span>${e.state}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:i`<div class="tbl"><div class="empty" data-fx-empty>${e.empty}</div></div>`}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fx-msg>${this.msg.text}</div>`:o}
      ${this.createDialog()}
      ${this.deleteDialog()}
      ${this.moveDialog()}
    </div>`}};S.styles=he;T([b({attribute:"recorder-id"})],S.prototype,"recorderId",2);T([b({attribute:!1})],S.prototype,"first",2);T([b({attribute:!1})],S.prototype,"cams",2);T([b({type:Boolean})],S.prototype,"allowed",2);T([b()],S.prototype,"tz",2);T([d()],S.prototype,"rows",2);T([d()],S.prototype,"enabled",2);T([d()],S.prototype,"failed",2);T([d()],S.prototype,"busy",2);T([d()],S.prototype,"msg",2);T([d()],S.prototype,"draft",2);T([d()],S.prototype,"renaming",2);T([d()],S.prototype,"deleting",2);T([d()],S.prototype,"moving",2);S=T([O("frigate-exports-panel")],S);var ha=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,V=(e,t,s,r)=>{for(var a=r>1?void 0:r?ua(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ha(t,s,a),a};let P=class extends R{constructor(){super(...arguments),this.recorderId="",this.first=null,this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.msg=null,this.draft=null,this.renaming=null,this.deleting=null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await mt(this.recorderId);this.rows=e.cases,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=f(e),this.rows=[]}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return ce(e)?p().control.settings.supervised.need:f(e)}async submitCreate(){const e=this.draft;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await rs(this.recorderId,{name:e.name.trim(),description:e.description.trim()||null,...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",t.verified?p().control.settings.cases.created:p().control.unverified),this.changed()}catch(t){this.draft={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await ns(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?p().control.settings.cases.renamed:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!xe(e.typed,e.row.name))){this.busy=!0;try{const t=await os(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?p().control.settings.cases.deleted:p().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}createDialog(){const e=this.draft;if(!e)return o;const t=p().control.settings.cases,s=p().control,r=!!this.first&&this.first.can_supervise&&!this.first.done.case_create;return i`<sw-dialog open heading=${t.create} data-fc-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.name}<input type="text" maxlength="80" data-fc-name .value=${e.name} @input=${a=>this.draft={...e,name:a.target.value}} /></label>
        <label>${t.description}<input type="text" maxlength="200" data-fc-description .value=${e.description} @input=${a=>this.draft={...e,description:a.target.value}} /></label>
        ${K(this.first,"case_create",e.supervised,a=>this.draft={...e,supervised:a},"case_create")}
        ${e.error?i`<div class="err" role="alert" data-fc-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fc-create-ok ?disabled=${this.busy||!e.name.trim()||r&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return o;const t=p().control.settings.cases,s=p().control.settings.exports,r=p().control,a=!!this.first&&this.first.can_supervise&&!this.first.done.case_delete;return i`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fc-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${s.deleteText}</p>
        <input type="text" data-fc-delete-typed aria-label=${t.name} .value=${e.typed} @input=${n=>this.deleting={...e,typed:n.target.value}} />
        ${K(this.first,"case_delete",e.supervised,n=>this.deleting={...e,supervised:n},"case_delete")}
        ${e.error?i`<div class="err" role="alert" data-fc-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${r.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fc-delete-ok ?disabled=${this.busy||!xe(e.typed,e.row.name)||a&&!e.supervised} @click=${()=>void this.confirmDelete()}>${s.delete}</sw-button>
    </sw-dialog>`}row(e){const t=p().control.settings.cases,s=p().control.settings.exports,r=p().control,a=this.renaming?.id===e.id?this.renaming:null,n=this.enabled&&e.arx_created;return i`<div class="r" role="row" data-fc-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${a?i`<span class="inline"><input type="text" maxlength="80" data-fc-rename-input aria-label=${t.name} .value=${a.name} ?disabled=${this.busy}
                @input=${c=>this.renaming={...a,name:c.target.value}}
                @keydown=${c=>{c.key==="Enter"&&this.saveRename(),c.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${r.confirm} data-fc-rename-save ?disabled=${this.busy||!a.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${r.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:i`<b title=${e.name}>${e.name||e.id}</b>`}
        ${a?K(this.first,"case_rename",a.supervised,c=>this.renaming={...a,supervised:c},"case_rename"):o}
      </div>
      <div class="c sub muted" role="cell" title=${e.description}>${e.arx_created?o:i`<span class="fold" data-fc-fold-origin>${s.foreign} ·&nbsp;</span>`}${e.description||se(e.created_at,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${se(e.created_at,this.tz||void 0)}</div>
      <div class="c muted" role="cell">${e.arx_created?s.arx:s.foreign}</div>
      <div class="c acts" role="cell">
        ${n&&!a?i`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${s.rename} data-fc-rename ?disabled=${this.busy||te(this.first,"case_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:o}
        ${n?i`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${s.delete} data-fc-delete-btn ?disabled=${this.busy||te(this.first,"case_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:o}
      </div>
    </div>`}render(){if(!this.allowed)return o;const e=p().control.settings.cases,t=p().control.settings,s=this.rows,r=this.enabled&&!te(this.first,"case_create");return i`<div class="panel" data-frigate-cases>
      <div class="head">
        <h4>${t.tabs.cases}</h4>
        <span class="inline">
          ${this.enabled?o:i`<span class="chip warn" data-fc-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.case_create?i`<span class="chip" data-fc-first-pending>${t.firstPending}</span>`:o}
          <sw-button size="sm" variant="primary" icon="plus" data-fc-new ?disabled=${!r} @click=${()=>this.draft={name:"",description:"",supervised:!1,error:""}}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?i`<div class="msg err" role="alert" data-fc-failed>${this.failed}</div>`:o}
      ${s===null?o:s.length?i`<div class="tbl" role="table" style="--cols: minmax(140px, 1.4fr) minmax(120px, 1.6fr) 110px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.description}</span><span>${e.createdAt}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:i`<div class="tbl"><div class="empty" data-fc-empty>${e.empty}</div></div>`}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fc-msg>${this.msg.text}</div>`:o}
      ${this.createDialog()}
      ${this.deleteDialog()}
    </div>`}};P.styles=he;V([b({attribute:"recorder-id"})],P.prototype,"recorderId",2);V([b({attribute:!1})],P.prototype,"first",2);V([b({type:Boolean})],P.prototype,"allowed",2);V([b()],P.prototype,"tz",2);V([d()],P.prototype,"rows",2);V([d()],P.prototype,"enabled",2);V([d()],P.prototype,"failed",2);V([d()],P.prototype,"busy",2);V([d()],P.prototype,"msg",2);V([d()],P.prototype,"draft",2);V([d()],P.prototype,"renaming",2);V([d()],P.prototype,"deleting",2);P=V([O("frigate-cases-panel")],P);var va=Object.defineProperty,fa=Object.getOwnPropertyDescriptor,C=(e,t,s,r)=>{for(var a=r>1?void 0:r?fa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&va(t,s,a),a};let k=class extends R{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.changes=[],this.enabled=!1,this.allowed=!1,this.tz="",this.camera="",this.label="",this.subLabel="",this.duration="30",this.openEnded=!1,this.supervised=!1,this.endSupervised=!1,this.busy=!1,this.error="",this.msg=null}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}refusal(e){return ce(e)?p().control.settings.supervised.need:f(e)}async create(){const e=p().control.settings.events,t=this.camera||this.cams.find(r=>r.enabled)?.id||"",s=this.openEnded?null:Number(this.duration);if(!t)return void(this.error=p().control.settings.exports.chooseCamera);if(!this.label.trim())return void(this.error=e.labelError);if(s!==null&&(!Number.isInteger(s)||s<1||s>Xe))return void(this.error=e.durationError);this.busy=!0,this.error="";try{const r=await ls(this.recorderId,t,{label:this.label.trim(),duration_s:s,sub_label:this.subLabel.trim()||null,...this.supervised?{supervised:!0}:{}});this.label="",this.subLabel="",this.flash("ok",r.verified?e.created:p().control.unverified),this.changed()}catch(r){this.error=this.refusal(r)}finally{this.busy=!1}}async end(e){this.busy=!0;try{const t=await ds(this.recorderId,e,this.endSupervised);this.flash("ok",t.verified?p().control.settings.events.ended:p().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}camName(e){return this.cams.find(t=>t.id===e)?.name??e??""}render(){if(!this.allowed)return o;const e=p().control.settings.events,t=p().control.settings,s=this.cams.filter(l=>l.enabled).map(l=>({id:l.id,label:l.name})),r=this.camera||s[0]?.id||"",a=!!this.first&&this.first.can_supervise&&!this.first.done.event_create,n=this.enabled&&!te(this.first,"event_create")&&s.length>0,c=cs(this.changes);return i`<div class="panel" data-frigate-events>
      <div class="head">
        <h4>${e.create}</h4>
        <span class="inline">
          ${this.enabled?o:i`<span class="chip warn" data-fe-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.event_create?i`<span class="chip" data-fe-first-pending>${t.firstPending}</span>`:o}
        </span>
      </div>
      <div class="form" data-fe-form>
        <div class="two">
          <label>${e.camera}<sw-dropdown block data-fe-camera .label=${e.camera} .placeholder=${e.camera} .value=${r} .items=${s} @change=${l=>this.camera=l.detail.id}></sw-dropdown></label>
          <label>${e.label}<input type="text" maxlength="40" data-fe-label .value=${this.label} ?disabled=${!n} @input=${l=>this.label=l.target.value} /></label>
        </div>
        <div class="two">
          <label>${e.subLabel}<input type="text" maxlength="60" data-fe-sub-label .value=${this.subLabel} ?disabled=${!n} @input=${l=>this.subLabel=l.target.value} /></label>
          <label>${e.duration}<input type="number" min="1" max=${Xe} step="1" data-fe-duration .value=${this.duration} ?disabled=${!n||this.openEnded} @input=${l=>this.duration=l.target.value} /></label>
        </div>
        <label class="row"><input type="checkbox" data-fe-open .checked=${this.openEnded} ?disabled=${!n} @change=${l=>this.openEnded=l.target.checked} /><span>${e.openEnded}</span></label>
        ${K(this.first,"event_create",this.supervised,l=>this.supervised=l,"event_create")}
        ${this.error?i`<div class="err" role="alert" data-fe-error>${this.error}</div>`:o}
        <div class="inline"><sw-button size="sm" variant="primary" icon="plus" data-fe-create ?disabled=${this.busy||!n||a&&!this.supervised} @click=${()=>void this.create()}>${e.create}</sw-button></div>
      </div>
      <h5>${e.openList}</h5>
      ${c.length?i`<div class="tbl" role="table" style="--cols: minmax(120px, 1.4fr) minmax(100px, 1fr) 110px 110px 80px">
            <div class="h" role="row"><span>${e.label}</span><span>${e.camera}</span><span>${p().review.time}</span><span>${p().control.settings.by}</span><span></span></div>
            ${c.map(l=>i`<div class="r" role="row" data-fe-open-row=${l.id}>
              <div class="c main" role="cell"><b>${l.label}</b>${l.sub_label?i` <span class="muted">· ${l.sub_label}</span>`:o}${l.status==="unverified"?i` <span class="chip warn">${t.unverified}</span>`:o}</div>
              <div class="c sub muted" role="cell">${this.camName(l.camera_id)} · ${se(l.at,this.tz||void 0)}</div>
              <div class="c ltr muted" role="cell">${se(l.at,this.tz||void 0)}</div>
              <div class="c muted" role="cell">${l.actor??""}</div>
              <div class="c acts" role="cell"><sw-button size="sm" icon="stopSquare" data-fe-end ?disabled=${this.busy||!this.enabled||te(this.first,"event_end")} @click=${()=>void this.end(l.id)}>${e.end}</sw-button></div>
            </div>`)}
          </div>
          ${K(this.first,"event_end",this.endSupervised,l=>this.endSupervised=l,"event_end")}`:i`<div class="tbl"><div class="empty" data-fe-empty>${e.empty}</div></div>`}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fe-msg>${this.msg.text}</div>`:o}
    </div>`}};k.styles=he;C([b({attribute:"recorder-id"})],k.prototype,"recorderId",2);C([b({attribute:!1})],k.prototype,"first",2);C([b({attribute:!1})],k.prototype,"cams",2);C([b({attribute:!1})],k.prototype,"changes",2);C([b({type:Boolean})],k.prototype,"enabled",2);C([b({type:Boolean})],k.prototype,"allowed",2);C([b()],k.prototype,"tz",2);C([d()],k.prototype,"camera",2);C([d()],k.prototype,"label",2);C([d()],k.prototype,"subLabel",2);C([d()],k.prototype,"duration",2);C([d()],k.prototype,"openEnded",2);C([d()],k.prototype,"supervised",2);C([d()],k.prototype,"endSupervised",2);C([d()],k.prototype,"busy",2);C([d()],k.prototype,"error",2);C([d()],k.prototype,"msg",2);k=C([O("frigate-manual-events")],k);var ma=Object.defineProperty,ba=Object.getOwnPropertyDescriptor,Q=(e,t,s,r)=>{for(var a=r>1?void 0:r?ba(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ma(t,s,a),a};let M=class extends R{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.canPlayback=!1,this.camera="",this.start=Ce(Math.floor(Date.now()/1e3)-600),this.end=Ce(Math.floor(Date.now()/1e3)),this.supervised=!1,this.error="",this.viewer=null}clipAddress(){const e=p().control.settings.supervision,t=ze(this.start),s=ze(this.end),r=this.camera||this.cams.find(a=>a.enabled)?.id||"";return r?t==null||s==null||s<=t||s-t>ps||s>Date.now()/1e3+60?(this.error=e.clipRangeError,null):(this.error="",hs(this.recorderId,r,t,s,this.supervised)):(this.error=p().control.settings.exports.chooseCamera,null)}openClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),window.open(e,"_blank","noopener"))}playClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),this.viewer={url:e,state:"loading"})}viewerDialog(){const e=this.viewer;if(!e)return o;const t=p().control.settings.supervision,s=this.cams.find(r=>r.id===(this.camera||this.cams.find(a=>a.enabled)?.id))?.name??"";return i`<sw-dialog open wide heading=${t.clipTitle} subheading=${s} data-fs-viewer @close=${()=>this.viewer=null}>
      <div class="clip" data-state=${e.state} data-fs-clip-state=${e.state}>
        <video controls playsinline preload="metadata" src=${e.url} data-fs-video
          @loadeddata=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"ready"}:this.viewer}
          @error=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"error"}:this.viewer}></video>
        <div class="state">${e.state==="error"?i`<sw-icon name="warning" size="18"></sw-icon>${t.clipError}`:i`<sw-icon class="spin" name="clock" size="18"></sw-icon>${t.clipLoading}`}</div>
      </div>
      <sw-button slot="footer" variant="ghost" icon="share" data-fs-viewer-tab @click=${()=>window.open(e.url,"_blank","noopener")}>${t.openTab}</sw-button>
      <sw-button slot="footer" data-fs-viewer-close @click=${()=>this.viewer=null}>${t.close}</sw-button>
    </sw-dialog>`}render(){const e=p().control.settings.supervision,t=p().control.settings,s=this.first,r=this.cams.filter(l=>l.enabled).map(l=>({id:l.id,label:l.name})),a=this.camera||r[0]?.id||"",n=!!s&&s.can_supervise&&!s.done.clip_read,c=!!s&&!s.done.clip_read&&!s.can_supervise;return i`<div class="panel" data-frigate-supervision>
      <div class="head"><h4>${e.title}</h4></div>
      <p class="note">${e.intro}</p>
      ${s?i`<div class="tbl" role="table" style="--cols: minmax(160px, 1fr) 110px" data-fs-kinds>
            ${us.map(l=>i`<div class="r" role="row" data-fs-kind=${l} data-done=${String(!!s.done[l])}>
              <div class="c main" role="cell">${t.kinds[l]}</div>
              <div class="c acts" role="cell"><span class=${`chip ${s.done[l]?"ok":""}`}>${s.done[l]?e.done:e.pending}</span></div>
            </div>`)}
          </div>`:i`<div class="msg err" data-fs-failed>${t.unavailable}</div>`}
      ${this.canPlayback&&r.length?i`<h5>${e.clipTitle}</h5>
          <p class="note">${e.clipText}</p>
          <div class="form" data-fs-clip>
            <label>${t.exports.camera}<sw-dropdown block data-fs-camera .label=${t.exports.camera} .placeholder=${t.exports.camera} .value=${a} .items=${r} @change=${l=>this.camera=l.detail.id}></sw-dropdown></label>
            <div class="two">
              <label>${t.exports.from}<input type="datetime-local" lang=${ke()} data-fs-start .value=${this.start} @input=${l=>this.start=l.target.value} /></label>
              <label>${t.exports.to}<input type="datetime-local" lang=${ke()} data-fs-end .value=${this.end} @input=${l=>this.end=l.target.value} /></label>
            </div>
            ${K(s,"clip_read",this.supervised,l=>this.supervised=l,"clip_read")}
            ${this.error?i`<div class="err" role="alert" data-fs-error>${this.error}</div>`:o}
            <div class="inline">
              <sw-button size="sm" variant="primary" icon="play" data-fs-play ?disabled=${c||n&&!this.supervised} @click=${()=>this.playClip()}>${e.play}</sw-button>
              <sw-button size="sm" variant="ghost" icon="share" data-fs-open ?disabled=${c||n&&!this.supervised} @click=${()=>this.openClip()}>${e.openTab}</sw-button>
            </div>
          </div>`:o}
      ${this.viewerDialog()}
    </div>`}};M.styles=[he,A`
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
  `];Q([b({attribute:"recorder-id"})],M.prototype,"recorderId",2);Q([b({attribute:!1})],M.prototype,"first",2);Q([b({attribute:!1})],M.prototype,"cams",2);Q([b({type:Boolean})],M.prototype,"canPlayback",2);Q([d()],M.prototype,"camera",2);Q([d()],M.prototype,"start",2);Q([d()],M.prototype,"end",2);Q([d()],M.prototype,"supervised",2);Q([d()],M.prototype,"error",2);Q([d()],M.prototype,"viewer",2);M=Q([O("frigate-supervision")],M);var ga=Object.defineProperty,wa=Object.getOwnPropertyDescriptor,de=(e,t,s,r)=>{for(var a=r>1?void 0:r?wa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ga(t,s,a),a};let J=class extends R{constructor(){super(...arguments),this.src=null,this.aspect=16/9,this.zones=[],this.selected=null,this.points=[],this.editing=!1,this.broken=!1,this.drag=null,this.swallowClick=!1}rect(){return this.renderRoot.querySelector(".stage").getBoundingClientRect()}emit(e){this.dispatchEvent(new CustomEvent("zone-points",{detail:{points:e},bubbles:!0,composed:!0}))}onStageClick(e){if(this.swallowClick){this.swallowClick=!1;return}!this.editing||e.target.closest(".h, .m")||this.points.length>=40||this.emit([...this.points,Ye(e.clientX,e.clientY,this.rect())])}onDown(e,t){this.editing&&(t.stopPropagation(),t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId),this.drag={index:e,id:t.pointerId})}mid(e){const t=this.points[e],s=this.points[(e+1)%this.points.length],r=a=>Math.round(a*1e4)/1e4;return[r((t[0]+s[0])/2),r((t[1]+s[1])/2)]}insertAt(e,t){if(!this.editing||this.points.length>=40)return;const s=[...this.points.slice(0,e+1),this.mid(e),...this.points.slice(e+1)];t&&(t.stopPropagation(),t.preventDefault(),this.renderRoot.querySelector(".stage").setPointerCapture(t.pointerId),this.drag={index:e+1,id:t.pointerId},this.swallowClick=!0),this.emit(s),t||this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-zone-handle="${e+1}"]`)?.focus())}onMove(e){if(!this.drag||this.drag.id!==e.pointerId)return;const t=this.points.slice();t[this.drag.index]=Ye(e.clientX,e.clientY,this.rect()),this.emit(t)}onUp(e){this.drag?.id===e.pointerId&&(this.drag=null)}onKey(e,t){if(!this.editing)return;const s=t.shiftKey?.02:.005,r={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]};if(r[t.key]){t.preventDefault();const[a,n]=this.points[e],c=g=>Math.round(Math.min(1,Math.max(0,g))*1e4)/1e4,l=this.points.slice();l[e]=[c(a+r[t.key][0]),c(n+r[t.key][1])],this.emit(l)}else(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.emit(this.points.filter((a,n)=>n!==e)))}pick(e,t){this.editing||(t.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-pick",{detail:{name:e},bubbles:!0,composed:!0})))}centroid(e){const t=e.length||1;return[e.reduce((s,r)=>s+r[0],0)/t,e.reduce((s,r)=>s+r[1],0)/t]}render(){const e=p().control.settings.config,t=1e3,s=Math.round(1e3/(this.aspect>0?this.aspect:16/9)),r=n=>n.map(([c,l])=>`${(c*t).toFixed(1)},${(l*s).toFixed(1)}`).join(" "),a=this.zones.filter(n=>n.points&&n.name!==this.selected);return i`<div class=${`stage ${this.editing?"editing":""}`} dir="ltr" style=${`aspect-ratio: ${t} / ${s}`} data-zone-stage
        @click=${n=>this.onStageClick(n)} @pointermove=${n=>this.onMove(n)} @pointerup=${n=>this.onUp(n)} @pointercancel=${n=>this.onUp(n)}>
      ${this.src&&!this.broken?i`<img src=${this.src} alt="" draggable="false" @error=${()=>this.broken=!0} />`:i`<div class="noframe" data-zone-noframe>${e.noFrame}</div>`}
      <svg viewBox=${`0 0 ${t} ${s}`} preserveAspectRatio="none" aria-hidden="true">
        ${a.map(n=>We`<polygon class=${`zone ${this.editing?"dim":""}`} points=${r(n.points)} data-zone-shape=${n.name} @click=${c=>this.pick(n.name,c)}></polygon>`)}
        ${this.selected!==null&&this.points.length>=2?We`<polygon class="draft" points=${r(this.points)} data-zone-draft></polygon>`:o}
      </svg>
      ${a.map(n=>{const[c,l]=this.centroid(n.points);return i`<span class="name" style=${`left:${c*100}%;top:${l*100}%`}>${n.name}</span>`})}
      ${this.selected!==null&&this.editing&&this.points.length>=2&&this.points.length<40?this.points.map((n,c)=>c===this.points.length-1&&this.points.length<3?o:i`<button type="button" class="m" style=${`left:${this.mid(c)[0]*100}%;top:${this.mid(c)[1]*100}%`}
            aria-label=${`${e.insertPoint} ${c+2}`} title=${e.insertPoint} data-zone-mid=${c} @pointerdown=${l=>this.insertAt(c,l)} @click=${l=>l.stopPropagation()}
            @keydown=${l=>{(l.key==="Enter"||l.key===" ")&&(l.preventDefault(),this.insertAt(c))}}></button>`):o}
      ${this.selected!==null?this.points.map(([n,c],l)=>i`<button type="button" class=${`h ${l===0?"first":""}`} style=${`left:${n*100}%;top:${c*100}%`} aria-label=${`${e.points} ${l+1}`}
            data-zone-handle=${l} ?disabled=${!this.editing} @pointerdown=${g=>this.onDown(l,g)} @keydown=${g=>this.onKey(l,g)}></button>`):o}
    </div>`}};J.styles=A`
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
  `;de([b()],J.prototype,"src",2);de([b({type:Number})],J.prototype,"aspect",2);de([b({attribute:!1})],J.prototype,"zones",2);de([b()],J.prototype,"selected",2);de([b({attribute:!1})],J.prototype,"points",2);de([b({type:Boolean})],J.prototype,"editing",2);de([d()],J.prototype,"broken",2);J=de([O("frigate-zone-editor")],J);var $a=Object.defineProperty,ya=Object.getOwnPropertyDescriptor,E=(e,t,s,r)=>{for(var a=r>1?void 0:r?ya(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&$a(t,s,a),a};let _=class extends R{constructor(){super(...arguments),this.recorderId="",this.cams=[],this.enabled=!1,this.schema=null,this.cameraId="",this.view=null,this.failed=!1,this.loading=!1,this.mode="zones",this.draft=null,this.values={},this.pending=null,this.supervised=!1,this.dialogError="",this.busy=!1,this.msg=null}connectedCallback(){super.connectedCallback(),vs(this.recorderId).then(e=>this.schema=e).catch(()=>this.failed=!0)}updated(e){if((e.has("cams")||e.has("recorderId"))&&!this.cameraId){const t=this.cams.find(s=>s.enabled);t&&this.pickCamera(t.id)}}async pickCamera(e){this.cameraId=e,this.draft=null,await this.reload()}async reload(){if(!this.cameraId)return;const e=this.cameraId;this.loading=!0;try{const t=await fs(this.recorderId,e);if(e!==this.cameraId)return;this.view=t,this.values={},this.failed=!1}catch{if(e!==this.cameraId)return;this.view=null,this.failed=!0}finally{e===this.cameraId&&(this.loading=!1)}}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}startNew(){this.draft={name:"",isNew:!0,points:[],objects:[],inertia:"",loitering:""}}select(e){e.points&&(this.draft={name:e.name,isNew:!1,points:e.points.map(t=>[t[0],t[1]]),objects:[...e.objects],inertia:e.inertia==null?"":String(e.inertia),loitering:e.loitering_time==null?"":String(e.loitering_time)})}draftErrors(){const e=p().control.settings.config,t=this.draft;if(!t||!this.view)return{name:null,poly:null,num:null};const s=t.isNew?Qe(t.name,this.view.camera_key,this.view.zones.map(c=>c.name)):null,r=Je(t.points),a=this.schema?.zone.fields??[],n=(c,l)=>{const g=a.find(B=>B.key===c);return!!g&&"error"in Ee(g,l)};return{name:s&&t.name?e.nameError[s]:null,poly:r&&t.points.length?e.polyError[r]:null,num:n("inertia",t.inertia)||n("loitering_time",t.loitering)?e.rangeError:null}}canSaveZone(){const e=this.draft;if(!e||!this.view?.writable)return!1;const t=this.draftErrors();return!t.name&&!t.poly&&!t.num&&!Je(e.points)&&(!e.isNew||!Qe(e.name,this.view.camera_key,this.view.zones.map(s=>s.name)))}toggleObject(e){if(!this.draft)return;const t=this.draft.objects.includes(e);this.draft={...this.draft,objects:t?this.draft.objects.filter(s=>s!==e):[...this.draft.objects,e].sort()}}async saveZone(){const e=this.draft,t=r=>r.trim()===""?null:Number(r);return(await ms(this.recorderId,this.cameraId,e.name,{points:e.points,objects:e.objects,inertia:t(e.inertia),loitering_time:t(e.loitering)},this.supervised)).verified}async removeZone(){return(await bs(this.recorderId,this.cameraId,this.draft.name,this.supervised)).verified}sectionFields(e){return(this.schema?.settings??[]).filter(t=>t.section===e)}current(e){return this.view?.settings[e.key]??null}edited(e){if(e.key in this.values)return this.values[e.key];const t=this.current(e);return e.type==="labels"?Array.isArray(t)?t:Array.isArray(e.default)?e.default:[]:t==null?"":String(t)}sectionDiff(e){const t={};for(const s of this.sectionFields(e)){if(!(s.key in this.values))continue;const r=this.values[s.key];let a;if(s.type==="labels")a=[...r].sort();else{const n=Ee(s,r);if("error"in n)return"error";a=n.value}gs(s,this.current(s),a)||(t[s.key]=a)}return t}setValue(e,t){this.values={...this.values,[e]:t}}toggleLabel(e,t){const s=this.edited(e);this.setValue(e.key,s.includes(t)?s.filter(r=>r!==t):[...s,t].sort())}ask(e){this.pending=e,this.supervised=!1,this.dialogError=""}kindOf(e){return e.kind==="settings"?"config_settings":"config_zone"}async run(){const e=this.pending;if(!e)return;const t=p().control.settings.config;this.busy=!0;try{let s;if(e.kind==="zone")s=await this.saveZone();else if(e.kind==="delete")s=await this.removeZone();else{const r=this.sectionDiff(e.section);if(r==="error")throw new Error(t.rangeError);s=(await ws(this.recorderId,this.cameraId,e.section,r,this.supervised)).verified}this.pending=null,this.draft=null,this.flash("ok",e.kind==="delete"?t.deleted:s?t.saved:t.sent),this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),await this.reload()}catch(s){this.dialogError=ce(s)?p().control.settings.supervised.need:s instanceof Error&&!("body"in s)?s.message:f(s)}finally{this.busy=!1}}dialog(){const e=this.pending,t=this.view;if(!e||!t)return o;const s=p().control.settings.config,r=p().control.settings,a=this.kindOf(e),n=t.can_supervise&&!t.first_write_done[a],c=!t.can_supervise&&!t.first_write_done[a],l=e.kind==="delete"?`${s.removeTitle}: ${this.draft?.name??""}`:s.confirmTitle;return i`<sw-dialog open heading=${l} data-fcp-confirm=${e.kind} @close=${()=>this.pending=null}>
      <div class="form">
        <p class="dialog-text">${s.confirmText}</p>
        ${n?i`<label class="sup" data-supervised-box=${a}><input type="checkbox" .checked=${this.supervised} @change=${g=>this.supervised=g.target.checked} /><span><b>${r.supervised.label}</b> · ${r.supervised.hint}</span></label>`:o}
        ${c?i`<div class="err" data-fcp-blocked>${r.supervised.need}</div>`:o}
        ${this.dialogError?i`<div class="err" role="alert" data-fcp-error>${this.dialogError}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.pending=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant=${e.kind==="delete"?"danger":"primary"} data-fcp-ok ?disabled=${this.busy||c||n&&!this.supervised} @click=${()=>void this.run()}>${p().control.confirm}</sw-button>
    </sw-dialog>`}labelText(e){return p().control.settings.config.labels[e]??e}zonesView(e){const t=p().control.settings.config,s=this.draft,r=e.frame.width&&e.frame.height?e.frame.width/e.frame.height:16/9,a=this.cams.find($=>$.id===this.cameraId),n=a&&a.enabled?$s(this.recorderId,this.cameraId):null,c=this.draftErrors(),l=!e.writable||this.busy,g=Array.from(new Set([...this.schema?.labels??[],...s?.objects??[]])),B=this.schema?.zone.max_zones??24;return i`<div class="grid" data-fcp-zones>
      <div>
        <frigate-zone-editor .src=${n} .aspect=${r} .zones=${e.zones} .selected=${s?s.name||"":null} .points=${s?.points??[]} ?editing=${!!s&&e.writable}
          @zone-points=${$=>s&&(this.draft={...s,points:$.detail.points})}
          @zone-pick=${$=>{const we=e.zones.find(yt=>yt.name===$.detail.name);we&&this.select(we)}}></frigate-zone-editor>
      </div>
      <div class="side">
        ${s?i`<div class="form" data-fcp-zone-form>
              ${s.isNew?i`<label>${t.name}<input dir="ltr" data-fcp-zone-name maxlength="40" autocomplete="off" .value=${s.name} ?disabled=${l} @input=${$=>this.draft={...s,name:$.target.value.trim()}} /></label>
                  ${c.name?i`<div class="err" data-fcp-name-error>${c.name}</div>`:o}`:i`<div class="head"><h4 dir="ltr">${s.name}</h4></div>`}
              ${e.writable?i`<p class="note">${t.draw}</p>`:o}
              <div class="inline">
                <span class="chip" data-fcp-points>${t.points}: ${s.points.length}</span>
                <sw-button size="sm" variant="ghost" data-fcp-undo-point ?disabled=${l||!s.points.length} @click=${()=>this.draft={...s,points:s.points.slice(0,-1)}}>${t.undoPoint}</sw-button>
                <sw-button size="sm" variant="ghost" data-fcp-clear ?disabled=${l||!s.points.length} @click=${()=>this.draft={...s,points:[]}}>${t.clear}</sw-button>
              </div>
              ${c.poly?i`<div class="err" data-fcp-poly-error>${c.poly}</div>`:o}
              <div class="field"><span class="lbl">${t.objects}${s.objects.length?o:i`<span>${t.allObjects}</span>`}</span>
                <div class="chips" data-fcp-zone-objects>${g.map($=>i`<button type="button" aria-pressed=${String(s.objects.includes($))} ?disabled=${l} data-label=${$} @click=${()=>this.toggleObject($)}>${this.labelText($)}</button>`)}</div>
              </div>
              <div class="two">
                <label>${t.inertia}<input type="number" inputmode="numeric" min="1" max="10" placeholder="3" data-fcp-inertia .value=${s.inertia} ?disabled=${l} @input=${$=>this.draft={...s,inertia:$.target.value}} /></label>
                <label>${t.loitering}<input type="number" inputmode="numeric" min="0" max="3600" placeholder="0" data-fcp-loitering .value=${s.loitering} ?disabled=${l} @input=${$=>this.draft={...s,loitering:$.target.value}} /></label>
              </div>
              ${c.num?i`<div class="err">${c.num}</div>`:o}
              <div class="acts">
                ${!s.isNew&&e.writable?i`<sw-button size="sm" variant="ghost" data-fcp-delete ?disabled=${this.busy} @click=${()=>this.ask({kind:"delete"})}>${t.remove}</sw-button>`:o}
                <sw-button size="sm" data-fcp-cancel @click=${()=>this.draft=null}>${t.cancel}</sw-button>
                ${e.writable?i`<sw-button size="sm" variant="primary" data-fcp-save ?disabled=${!this.canSaveZone()||this.busy} @click=${()=>this.ask({kind:"zone"})}>${t.save}</sw-button>`:o}
              </div>
            </div>`:i`${e.zones.length?i`<ul class="zl" data-fcp-zone-list>${e.zones.map($=>i`<li><button type="button" data-zone=${$.name} ?disabled=${!$.points} title=${$.points?"":t.notEditable} @click=${()=>this.select($)}>
                  <span class="zn">${$.name}</span><span class="zs">${$.objects.length?$.objects.map(we=>this.labelText(we)).join(", "):t.allObjects}</span></button></li>`)}</ul>`:i`<div class="empty" data-fcp-no-zones>${t.noZones}</div>`}
            ${e.writable?i`<div class="acts"><sw-button size="sm" icon="plus" data-fcp-new-zone ?disabled=${e.zones.length>=B} @click=${()=>this.startNew()}>${t.newZone}</sw-button></div>`:o}`}
      </div>
    </div>`}field(e,t){const s=p().control.settings.config,r=s.fields[e.key]??e.key,a=this.edited(e);if(e.type==="labels"){const c=Array.from(new Set([...this.schema?.labels??[],...a]));return i`<div class="field" data-fcp-field=${e.key}><span class="lbl">${r}</span>
        <div class="chips">${c.map(l=>i`<button type="button" aria-pressed=${String(a.includes(l))} ?disabled=${t} data-label=${l} @click=${()=>this.toggleLabel(e,l)}>${this.labelText(l)}</button>`)}</div>
      </div>`}const n="error"in Ee(e,a);return i`<label class="field" data-fcp-field=${e.key}><span class="lbl"><span>${r}</span>
        <button type="button" class="link" data-fcp-default ?disabled=${t||a===""} @click=${()=>this.setValue(e.key,"")}>${s.useDefault}</button></span>
      <input type="number" inputmode=${e.type==="int"?"numeric":"decimal"} min=${e.min??""} max=${e.max??""} step=${e.step??(e.type==="int"?1:"any")}
        placeholder=${e.default==null?"":`${s.defaultValue}: ${e.default}`} .value=${a} ?disabled=${t} aria-invalid=${String(n)}
        @input=${c=>this.setValue(e.key,c.target.value)} />
      ${n?i`<span class="err">${s.rangeError}</span>`:o}
    </label>`}settingsView(e){const t=p().control.settings.config,s=!e.writable||this.busy;return i`<div class="sections" data-fcp-settings>
      ${(this.schema?.sections??[]).map(r=>{const a=this.sectionDiff(r),n=a!=="error"&&Object.keys(a).length>0;return i`<div class="sect" data-fcp-section=${r}>
          <h4>${t.sections[r]??r}</h4>
          ${this.sectionFields(r).map(c=>this.field(c,s))}
          ${e.writable?i`<div class="acts"><sw-button size="sm" variant="primary" data-fcp-save-section=${r} ?disabled=${!n||this.busy} @click=${()=>this.ask({kind:"settings",section:r})}>${t.save}</sw-button></div>`:o}
        </div>`})}
    </div>`}render(){const e=p().control.settings.config,t=p().control.settings,s=this.cams.filter(a=>a.enabled).map(a=>({id:a.id,label:a.name}));if(!s.length)return i`<div class="panel"><div class="empty" data-fcp-no-cameras>${e.noCameras}</div></div>`;const r=this.view;return i`<div class="panel" data-frigate-config-panel>
      <div class="head">
        <div class="inline" style="min-inline-size: 200px; flex: 1 1 220px">
          <sw-dropdown block data-fcp-camera .label=${e.camera} .placeholder=${e.camera} .value=${this.cameraId} .items=${s} @change=${a=>void this.pickCamera(a.detail.id)}></sw-dropdown>
        </div>
        <div class="inline">
          ${this.enabled?r&&!r.writable?i`<span class="chip" data-fcp-read-only>${e.readOnly}</span>`:o:i`<span class="chip warn" data-fcp-class-off>${e.classOff}</span>`}
          <div class="seg" role="group" aria-label=${t.tabs.config}>
            <button type="button" aria-pressed=${String(this.mode==="zones")} data-fcp-mode="zones" @click=${()=>this.mode="zones"}>${e.zones}</button>
            <button type="button" aria-pressed=${String(this.mode==="settings")} data-fcp-mode="settings" @click=${()=>this.mode="settings"}>${e.settings}</button>
          </div>
        </div>
      </div>
      ${this.failed?i`<div class="msg err" data-fcp-failed>${e.unavailable}</div>`:o}
      ${this.loading&&!r?i`<sw-state-panel state="loading" compact heading=${e.loading} data-fcp-loading></sw-state-panel>`:o}
      ${r&&!this.failed?i`<div class="body" ?data-busy=${this.loading}>${this.mode==="zones"?this.zonesView(r):this.settingsView(r)}</div>`:o}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcp-msg>${this.msg.text}</div>`:o}
      ${this.dialog()}
    </div>`}};_.styles=[he,A`
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
  `];E([b({attribute:"recorder-id"})],_.prototype,"recorderId",2);E([b({attribute:!1})],_.prototype,"cams",2);E([b({type:Boolean})],_.prototype,"enabled",2);E([d()],_.prototype,"schema",2);E([d()],_.prototype,"cameraId",2);E([d()],_.prototype,"view",2);E([d()],_.prototype,"failed",2);E([d()],_.prototype,"loading",2);E([d()],_.prototype,"mode",2);E([d()],_.prototype,"draft",2);E([d()],_.prototype,"values",2);E([d()],_.prototype,"pending",2);E([d()],_.prototype,"supervised",2);E([d()],_.prototype,"dialogError",2);E([d()],_.prototype,"busy",2);E([d()],_.prototype,"msg",2);_=E([O("frigate-config-panel")],_);var ka=Object.defineProperty,xa=Object.getOwnPropertyDescriptor,U=(e,t,s,r)=>{for(var a=r>1?void 0:r?xa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ka(t,s,a),a};const _a=["classes","profiles","config","exports","cases","events","log","supervision"],lt={export_create:"export_delete",export_rename:"export_rename",case_create:"case_delete",case_rename:"case_rename",event_create:"event_end",config_zone:"config_zone",config_settings:"config_settings"};let I=class extends R{constructor(){super(...arguments),this.recorderId="",this.tab="classes",this.policy=null,this.profiles=null,this.changes=[],this.first=null,this.cams=[],this.failed=!1,this.busy=!1,this.msg=null,this.undoing=null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.policy=await Ne(this.recorderId),this.failed=!1}catch{this.failed=!0;return}const[e,t,s,r]=await Promise.allSettled([ys(this.recorderId),et(this.recorderId),tt(this.recorderId),zt(this.recorderId)]);this.profiles=e.status==="fulfilled"?e.value:null,this.changes=t.status==="fulfilled"?t.value.changes:[],this.first=s.status==="fulfilled"?s.value:null,this.cams=r.status==="fulfilled"?r.value:[]}async afterWrite(){const[e,t,s]=await Promise.allSettled([et(this.recorderId),tt(this.recorderId),Ne(this.recorderId)]);e.status==="fulfilled"&&(this.changes=e.value.changes),t.status==="fulfilled"&&(this.first=t.value),s.status==="fulfilled"&&(this.policy=s.value)}flash(e,t){this.msg={tone:e,text:t},window.setTimeout(()=>{this.msg?.text===t&&(this.msg=null)},4e3)}async toggle(e,t){const s=t.currentTarget,r=s.checked;this.busy=!0;try{await ks(this.recorderId,{[e]:r}),this.policy=await Ne(this.recorderId),this.dispatchEvent(new CustomEvent("frigate-control-policy",{detail:{anyOn:this.policy.classes.some(a=>a.enabled)},bubbles:!0,composed:!0}))}catch(a){s.checked=!r,this.flash("err",f(a))}finally{this.busy=!1}}async rule(e,t){const s=t.currentTarget.value;this.busy=!0;try{const r=await xs(this.recorderId,{[e]:s||null});this.profiles&&(this.profiles={...this.profiles,rules:r.rules})}catch(r){this.flash("err",f(r)),this.load()}finally{this.busy=!1}}async undo(e,t,s=!1){this.busy=!0;try{await _s(this.recorderId,e.id,t,s),this.undoing=null,this.flash("ok",p().control.settings.undone),this.afterWrite()}catch(r){this.undoing?this.undoing={...this.undoing,error:ce(r)?p().control.settings.supervised.need:f(r)}:this.flash("err",ce(r)?p().control.settings.supervised.need:f(r))}finally{this.busy=!1}}onUndo(e){const t=lt[e.kind],s=!!t&&!!this.first&&!this.first.done[t];e.class==="record"||e.class==="profile"||e.class==="config"||e.kind==="export_create"||e.kind==="case_create"||s?this.undoing={row:e,supervised:!1,error:""}:this.undo(e,!1)}timeText(e){try{return Ct(new Date(e))}catch{return e}}statusTag(e){const t=p().control.settings;return e.status==="reverted"?i`<span class="tag" data-change-status="reverted">${t.reverted}</span>`:e.status==="failed"?i`<span class="tag bad" data-change-status="failed">${t.failed}</span>`:e.status==="unverified"?i`<span class="tag" data-change-status="unverified">${t.unverified}</span>`:o}classesTab(e){const t=p().control.settings,s=this.busy||!N("system.configure");return i`<div class="classes" data-fcs-classes>
      ${zs(e).map(r=>i`<div class="row" data-fcs-class=${r.class}>
        <span class="name"><span>${t.classes[r.class]}</span>
          <span class="sub">${r.per_action?i`<span>${t.perAction}</span>`:o}${r.confirm_actions?.includes("delete")?i`<span>${t.confirmDelete}</span>`:o}<span dir="ltr">${r.permission}</span></span></span>
        <sw-toggle .checked=${r.enabled} ?disabled=${s||!r.available} labelHidden label=${t.classes[r.class]} data-fcs-toggle=${r.class} @change=${a=>void this.toggle(r.class,a)}></sw-toggle>
      </div>`)}
    </div>`}profilesTab(){const e=p().control.settings,t=this.profiles,s=this.busy||!N("system.configure");return i`${t&&t.names.length?i`<div data-fcs-rules>
        <h4>${e.rules}</h4>
        ${t.alarm_states.filter(r=>["disarmed","armed_home","armed_away","armed_night"].includes(r)).map(r=>i`<div class="row">
          <span>${De(r)}</span>
          <select aria-label=${De(r)} data-fcs-rule=${r} .value=${t.rules[r]??""} ?disabled=${s} @change=${a=>void this.rule(r,a)}>
            <option value="">${e.rulesNone}</option>
            ${t.names.map(a=>i`<option value=${a} ?selected=${t.rules[r]===a}>${a}</option>`)}
          </select>
        </div>`)}
      </div>`:o}
      <frigate-auto-profile recorder-id=${this.recorderId} .first=${this.first} .canConfigure=${N("system.configure")} .canProfile=${ne("analytics.profile")} @frigate-changed=${()=>void this.afterWrite()}></frigate-auto-profile>`}logTab(){const e=p().control.settings;return i`<div data-fcs-log>
      ${this.changes.length?i`<ul>${this.changes.map(t=>i`<li class="change" data-change=${t.id}>
            <span class="what"><span>${st(t)}${this.statusTag(t)}</span><span class="meta">${this.timeText(t.at)}${t.actor?` · ${t.actor}`:""}${t.camera_key&&t.camera_key!=="*"?` · ${this.cams.find(s=>s.id===t.camera_id)?.name??t.camera_key}`:""}</span></span>
            ${t.reversible?i`<sw-button size="sm" variant="ghost" data-change-undo ?disabled=${this.busy} @click=${()=>this.onUndo(t)}>${e.undo}</sw-button>`:o}
          </li>`)}</ul>`:i`<p class="note" data-fcs-log-empty>${e.logEmpty}</p>`}
    </div>`}undoDialog(){const e=this.undoing;if(!e)return o;const t=p().control.settings,s=p().control,r=lt[e.row.kind],a=!!r&&!!this.first&&this.first.can_supervise&&!this.first.done[r],n=!!r&&!!this.first&&!this.first.done[r]&&!this.first.can_supervise;return i`<sw-dialog open heading=${`${t.undo}: ${st(e.row)}`} data-fcs-confirm @close=${()=>this.undoing=null}>
      <div class="form">
        ${a?i`<label class="sup" data-supervised-box=${r}><input type="checkbox" .checked=${e.supervised} @change=${c=>this.undoing={...e,supervised:c.target.checked}} /><span><b>${t.supervised.label}</b> · ${t.supervised.hint}</span></label>`:o}
        ${n?i`<div class="err" data-fcs-undo-blocked>${t.supervised.need}</div>`:o}
        ${e.error?i`<div class="err" role="alert" data-fcs-undo-error>${e.error}</div>`:o}
      </div>
      <sw-button slot="footer" @click=${()=>this.undoing=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcs-ok ?disabled=${this.busy||n||a&&!e.supervised} @click=${()=>void this.undo(e.row,!0,e.supervised)}>${s.confirm}</sw-button>
    </sw-dialog>`}tabs(){const e=N("system.configure");return _a.filter(t=>t==="exports"?e||ne("analytics.exports"):t==="cases"?e||ne("analytics.cases"):t==="events"?e||ne("analytics.events"):!0)}render(){const e=p().control.settings;if(this.failed)return i`<div class="note" data-fcs-failed>${e.unavailable}</div>`;const t=this.policy;if(!t)return o;const s=this.tabs(),r=s.includes(this.tab)?this.tab:s[0],a=l=>t.classes.some(g=>g.class===l&&g.enabled),n=N("system.configure"),c="";return i`<div class="box" data-frigate-control-settings>
      <div class="head"><h4>${e.title}</h4>${t.classes.some(l=>l.enabled)?i`<span class="chip accent" data-fcs-any-on>${t.classes.filter(l=>l.enabled).length} ${e.classesOn}</span>`:i`<span class="chip" data-fcs-all-off>${p().summary.readOnly}</span>`}</div>
      <sw-tabs variant="underline-compact" data-fcs-tabs .items=${s.map(l=>({id:l,label:e.tabs[l]}))} .active=${r} @change=${l=>this.tab=l.detail.id}></sw-tabs>
      ${r==="classes"?this.classesTab(t):o}
      ${r==="profiles"?this.profilesTab():o}
      ${r==="config"?i`<frigate-config-panel recorder-id=${this.recorderId} .cams=${this.cams} .enabled=${a("config")} @frigate-changed=${()=>void this.afterWrite()}></frigate-config-panel>`:o}
      ${r==="exports"?i`<frigate-exports-panel recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .allowed=${n||ne("analytics.exports")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-exports-panel>`:o}
      ${r==="cases"?i`<frigate-cases-panel recorder-id=${this.recorderId} .first=${this.first} .allowed=${n||ne("analytics.cases")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-cases-panel>`:o}
      ${r==="events"?i`<frigate-manual-events recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .changes=${this.changes} .enabled=${a("events")} .allowed=${n||ne("analytics.events")} tz=${c} @frigate-changed=${()=>void this.afterWrite()}></frigate-manual-events>`:o}
      ${r==="log"?this.logTab():o}
      ${r==="supervision"?i`<frigate-supervision recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .canPlayback=${ne("video.playback")}></frigate-supervision>`:o}
      ${this.msg?i`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcs-msg>${this.msg.text}</div>`:o}
      ${this.undoDialog()}
    </div>`}};I.styles=[he,A`
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
  `];U([b({attribute:"recorder-id"})],I.prototype,"recorderId",2);U([d()],I.prototype,"tab",2);U([d()],I.prototype,"policy",2);U([d()],I.prototype,"profiles",2);U([d()],I.prototype,"changes",2);U([d()],I.prototype,"first",2);U([d()],I.prototype,"cams",2);U([d()],I.prototype,"failed",2);U([d()],I.prototype,"busy",2);U([d()],I.prototype,"msg",2);U([d()],I.prototype,"undoing",2);I=U([O("frigate-control-settings")],I);var za=Object.defineProperty,Ca=Object.getOwnPropertyDescriptor,q=(e,t,s,r)=>{for(var a=r>1?void 0:r?Ca(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&za(t,s,a),a};const Sa="מיד: בלי שידור חי, ניגון ואירועים מה־NVR הזה. המצלמות שלו יורדות מהקיר ומבחירת המצלמות; בטבלת המצלמות ובמפה הן נשארות, בלי תמונה. ההיסטוריה נשמרת.",Ra="ה־NVR חוזר לפעול מיד, והמצלמות שלו חוזרות לקיר.",Oa={online:"live",error:"error",unknown:"unknown",pending_restart:"stale",disabled:"neutral",not_configured:"neutral",unreadable:"error",refused:"error",removed:"neutral"};let D=class extends R{constructor(){super(...arguments),this.loadState="loading",this.loadError="",this.data=null,this.open="",this.renaming="",this.nameDraft="",this.toggling=null,this.adding=!1,this.busy=!1,this.msg=null,this.fallback=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),be()&&N("system.configure")&&!ge()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}async load(){try{const e=await Cs();this.fallback=!Array.isArray(e?.recorders),this.data=this.fallback?null:e,this.loadState="ready",this.loadError=""}catch(e){if(e instanceof Ae&&e.status===404){this.fallback=!0,this.loadState="ready";return}this.loadError=f(e),this.loadState="error"}}async rename(e){const t=this.nameDraft.trim();if(!(!t||this.busy)){this.busy=!0;try{await at(e.id,{name:t}),this.renaming="",this.msg={tone:"ok",text:"השם נשמר"},await this.load()}catch(s){this.msg={tone:"err",text:f(s)}}finally{this.busy=!1}}}async toggle(e){if(!this.busy){this.busy=!0;try{const t=await at(e.id,{enabled:!e.enabled});this.toggling=null,this.msg={tone:"ok",text:e.enabled?"ה־NVR הושבת":"ה־NVR הופעל"},t.restart_required&&St(!0),await this.load()}catch(t){this.toggling=null,this.msg={tone:"err",text:f(t)}}finally{this.busy=!1}}}changed(e){this.msg={tone:"ok",text:e},this.adding=!1,this.load()}row(e){const t=e.status.state,s=[e.vendor_label,e.model].filter(Boolean).join(" · "),r=this.open===e.id;return i`<li class="rec" data-recorder=${e.id} data-recorder-state=${t}>
      <div class="head">
        <div class="who">
          ${this.renaming===e.id?i`<input class="name-in" data-recorder-name-input maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}
                @keydown=${a=>{a.key==="Enter"&&this.rename(e),a.key==="Escape"&&(this.renaming="")}} />`:i`<span class="name" data-recorder-name>${e.name}</span>`}
          <span class="meta">${s}</span>
        </div>
        <div class="facts">
          <sw-badge kind=${Oa[t]??"neutral"} label=${Ss[t]??t} data-recorder-status></sw-badge>
          <span class="cams" data-recorder-cameras>${e.cameras} מצלמות</span>
        </div>
      </div>
      <div class="actions">
        ${this.renaming===e.id?i`<sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${this.busy||!this.nameDraft.trim()} data-recorder-name-save @click=${()=>this.rename(e)}>שמור</sw-button>
              <sw-button size=${this.btn} variant="ghost" @click=${()=>this.renaming=""}>ביטול</sw-button>`:i`<sw-button size=${this.btn} icon="link" data-recorder-connection aria-expanded=${String(r)} @click=${()=>this.open=r?"":e.id}>חיבור</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="edit" data-recorder-rename @click=${()=>{this.renaming=e.id,this.nameDraft=e.name,this.msg=null}}>שם</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="power" data-recorder-toggle @click=${()=>this.toggling=e}>${e.enabled?"השבת":"הפעל"}</sw-button>`}
      </div>
      ${r?i`<div class="conn" data-recorder-connection-form>
            <nvr-connection-form context="settings" recorder-id=${e.id}
              @nvr-connection-saved=${()=>this.changed("נשמר")} @nvr-connection-removed=${()=>{this.open="",this.changed("ה־NVR הוסר")}}></nvr-connection-form>
            ${e.vendor==="frigate"&&t==="online"?i`<frigate-summary recorder-id=${e.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${e.id} data-recorder-frigate-control></frigate-control-settings>`:o}
          </div>`:o}
    </li>`}addDialog(){return i`<sw-dialog open wide heading="הוספת NVR" data-recorder-add-dialog @close=${()=>this.adding=!1}>
      <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed("ה־NVR נוסף")}></nvr-connection-form>
    </sw-dialog>`}render(){if(!be()||!N("system.configure"))return o;if(ge())return i`<sw-card heading="חיבור ל־NVR" data-nvr-connection><p class="local-only" data-nvr-local-only role="status">${Rt}</p></sw-card>`;if(this.loadState==="loading")return i`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="loading" compact heading="קורא…"></sw-state-panel></sw-card>`;if(this.fallback)return i`<sw-card heading="חיבור ל־NVR" data-nvr-connection><nvr-connection-form context="settings"></nvr-connection-form></sw-card>`;if(this.loadState==="error"||!this.data)return i`<sw-card heading="מקליטים (NVR)"><sw-state-panel state="error" compact heading="רשימת המקליטים לא נטענה" hint=${this.loadError} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel></sw-card>`;const e=this.data.recorders.filter(s=>!s.removed);if(!e.length&&this.data.primary_has_history)return i`<sw-card heading="חיבור ל־NVR" data-nvr-connection data-recorder-add-new>
        <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed("ה־NVR נוסף")}></nvr-connection-form>
        ${this.msg?i`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
      </sw-card>`;if(e.length<=1){const s=e[0],r=!!s&&s.connection?.vendor&&s.connection.vendor!=="none"&&s.connection.state!=="not_chosen";return i`<sw-card heading="חיבור ל־NVR" data-nvr-connection>
        <nvr-connection-form context="settings" recorder-id=${s?.id??"nvr-1"} @nvr-connection-saved=${()=>void this.load()} @nvr-connection-removed=${()=>void this.load()}></nvr-connection-form>
        ${s?.vendor==="frigate"&&s.status.state==="online"?i`<frigate-summary recorder-id=${s.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${s.id} data-recorder-frigate-control></frigate-control-settings>`:o}
        ${r?i`<div class="actions add-one"><sw-button size=${this.btn} icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>הוסף NVR</sw-button></div>`:o}
        ${this.msg?i`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
        ${this.adding?this.addDialog():o}
      </sw-card>`}const t=this.toggling;return i`<sw-card heading="מקליטים (NVR)" data-nvr-recorders data-nvr-connection>
      <ul class="list" data-recorder-list>${e.map(s=>this.row(s))}</ul>
      <div class="actions">
        <sw-button size=${this.btn} variant="primary" icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>הוסף NVR</sw-button>
      </div>
      ${this.msg?i`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:o}
      ${this.adding?this.addDialog():o}
      ${t?i`<sw-dialog open heading=${t.enabled?"השבתת NVR":"הפעלת NVR"} subheading=${t.name} data-recorder-toggle-dialog @close=${()=>this.toggling=null}>
            <div class="dlg" data-recorder-toggle-text>${t.enabled?Sa:Ra}</div>
            <div slot="footer">
              <sw-button variant=${t.enabled?"danger":"primary"} ?disabled=${this.busy} data-recorder-toggle-confirm @click=${()=>this.toggle(t)}>${t.enabled?"השבת":"הפעל"}</sw-button>
              <sw-button variant="ghost" @click=${()=>this.toggling=null}>ביטול</sw-button>
            </div>
          </sw-dialog>`:o}
    </sw-card>`}};D.styles=A`
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
  `;q([d()],D.prototype,"loadState",2);q([d()],D.prototype,"loadError",2);q([d()],D.prototype,"data",2);q([d()],D.prototype,"open",2);q([d()],D.prototype,"renaming",2);q([d()],D.prototype,"nameDraft",2);q([d()],D.prototype,"toggling",2);q([d()],D.prototype,"adding",2);q([d()],D.prototype,"busy",2);q([d()],D.prototype,"msg",2);q([d()],D.prototype,"fallback",2);D=q([O("nvr-recorders-card")],D);const Ea=()=>G("system/secrets"),Na=(e,t)=>Se(`system/secrets/${encodeURIComponent(e)}`,{value:t}),Pa=e=>Ot(`system/secrets/${encodeURIComponent(e)}`,{method:"DELETE"}),Ta=(e,t)=>Z(`system/secrets/${encodeURIComponent(e)}/test`,t===void 0?{}:{value:t}),Ia={ok:"החיבור תקין",unauthorized:"go2rtc דחה את הסיסמה",unreachable:"go2rtc לא ענה",error:"go2rtc החזיר שגיאה",not_configured:"כתובת go2rtc לא הוגדרה",username_missing:"שם המשתמש לא הוגדר בהגדרות החיבור של ההתקנה",wiskey_unavailable:"נתוני WisKey אינם זמינים כרגע",no_station:"אין עמדה מחוברת עם מצלמה שמשתמשת בחשבון המשותף",station_failed:"לא התקבלה תמונה מהעמדה (סיסמה שגויה או מצלמה שלא ענתה)",go2rtc_unauthorized:"go2rtc דחה את פרטי הגישה שלו"};var Da=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,re=(e,t,s,r)=>{for(var a=r>1?void 0:r?Aa(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&Da(t,s,a),a};const Ba={set:["live","מוגדר"],not_set:["neutral","לא מוגדר"],unreadable:["error","לא ניתן לפענוח"],legacy:["partial","מהגדרה ישנה"]};function dt(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let H=class extends R{constructor(){super(...arguments),this.items=null,this.editing=null,this.draft="",this.confirmClear=null,this.busy=!1,this.error="",this.tests={},this.restartNote=!1}connectedCallback(){super.connectedCallback(),ge()||this.load()}async load(){try{this.items=(await Ea()).secrets}catch(e){this.error=f(e)}}replaceItem(e){this.items=(this.items??[]).map(t=>t.name===e.name?e:t)}async run(e){this.busy=!0,this.error="";try{return await e()}catch(t){return this.error=f(t),null}finally{this.busy=!1}}async save(e){const t=await this.run(()=>Na(e,this.draft));if(!t)return;this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required,this.editing=null,this.draft="";const{[e]:s,...r}=this.tests;this.tests=r}async clear(e){const t=await this.run(()=>Pa(e));this.confirmClear=null,t&&(this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required)}async test(e,t){const s=await this.run(()=>Ta(e,t));s&&(this.tests={...this.tests,[e]:s})}status(e){if(e.state==="unreadable")return"הערך השמור אינו ניתן לפענוח (מפתח ההתקנה השתנה) - יש להזין אותו מחדש";if(e.state==="legacy")return e.source==="environment"?"בשימוש ממשתנה סביבה של הרצת פיתוח":"בשימוש מהגדרת התוסף הישנה - יועבר בהפעלה הבאה";if(!e.configured)return e.updated_at?`נמחק ${dt(e.updated_at)}${e.updated_by_name?` · ${e.updated_by_name}`:""}`:"לא הוגדר";const t=e.source==="addon_import"?"הועבר מהגדרות התוסף":e.updated_by_name??"";return`הוגדר ${dt(e.updated_at)}${t?` · ${t}`:""}`}renderRow(e){const[t,s]=Ba[e.state]??["neutral",e.state],r=this.tests[e.name],a=this.editing===e.name||e.state==="not_set"||e.state==="unreadable";return i`<div class="row" data-secret-row=${e.name}>
      <span class="lbl">${e.label_he}<span class="muted"><span class="ltr">${e.name}</span> · <span data-secret-status>${this.status(e)}</span></span>
        ${r?i`<span class=${`muted ${r.ok?"ok":"bad"}`} data-secret-test-result=${r.code}>${Ia[r.code]??r.code}</span>`:o}</span>
      <span class="acts"><sw-badge kind=${t} label=${s} data-secret-state=${e.state}></sw-badge>
        ${a?i`<input type="password" autocomplete="new-password" spellcheck="false" .value=${this.editing===e.name?this.draft:""} aria-label=${e.label_he} data-secret-input
                @focus=${()=>{this.editing!==e.name&&(this.editing=e.name,this.draft="")}}
                @input=${n=>{this.editing=e.name,this.draft=n.target.value}} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-save @click=${()=>void this.save(e.name)}>שמור</sw-button>
              ${e.testable?i`<sw-button size="sm" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-test @click=${()=>void this.test(e.name,this.draft)}>בדוק</sw-button>`:o}
              ${e.configured||this.editing===e.name?i`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>{this.editing=null,this.draft=""}}>ביטול</sw-button>`:o}`:this.confirmClear===e.name?i`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear-confirm @click=${()=>void this.clear(e.name)}>מחק סופית</sw-button>
                <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirmClear=null}>ביטול</sw-button>`:i`<sw-button size="sm" ?disabled=${this.busy} data-secret-replace @click=${()=>{this.editing=e.name,this.draft=""}}>החלף</sw-button>
                ${e.testable?i`<sw-button size="sm" ?disabled=${this.busy} data-secret-test-stored @click=${()=>void this.test(e.name)}>בדוק חיבור</sw-button>`:o}
                ${e.state==="set"?i`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear @click=${()=>this.confirmClear=e.name}>מחק</sw-button>`:o}`}
      </span>
    </div>`}render(){const e=ge()?i`<div class="hint" data-secrets-local-only>${Et}</div>`:this.items?i`${this.items.map(t=>this.renderRow(t))}
            ${this.restartNote?i`<div class="hint" data-secrets-restart>השינוי חל מיד על המסכים; שירותי הרקע (סנכרון זרמי go2rtc, ערוצי WisKey) יקבלו אותו בהפעלה הבאה של המערכת.</div>`:o}`:this.error?o:i`<div class="hint">טוען…</div>`;return i`<sw-card heading="סודות" subheading="Secrets · סיסמאות ומפתחות של שירותים חיצוניים, שמורים מוצפנים · הערכים עצמם אינם מוצגים שוב" data-secrets>
      ${e}
      ${this.error?i`<div class="err" role="alert" data-secrets-error>${this.error}</div>`:o}
    </sw-card>`}};H.styles=A`
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
  `;re([d()],H.prototype,"items",2);re([d()],H.prototype,"editing",2);re([d()],H.prototype,"draft",2);re([d()],H.prototype,"confirmClear",2);re([d()],H.prototype,"busy",2);re([d()],H.prototype,"error",2);re([d()],H.prototype,"tests",2);re([d()],H.prototype,"restartNote",2);H=re([O("sw-secrets-card")],H);var ja=Object.defineProperty,La=Object.getOwnPropertyDescriptor,ee=(e,t,s,r)=>{for(var a=r>1?void 0:r?La(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&ja(t,s,a),a};function ct(e){if(!e)return"";const t=new Date(e),s={he:"he-IL",en:"en-GB",ar:"ar",ru:"ru-RU"}[ut()];return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let W=class extends R{constructor(){super(...arguments),this.status=null,this.dialog=null,this.ack=!1,this.otp="",this.shown=null,this.copied=!1,this.busy=!1,this.error="",this.done=!1}disconnectedCallback(){super.disconnectedCallback(),this.shown=null}close(){this.dialog=null,this.ack=!1,this.otp="",this.shown=null,this.copied=!1,this.error=""}changed(){this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async revoke(){const e=this.status?.revocation;this.busy=!0,this.error="";try{await Nt(!!e?.wiskey_present&&this.ack),this.close(),this.done=!0,this.changed()}catch(t){this.error=f(t)}finally{this.busy=!1}}async reveal(){this.busy=!0,this.error="";try{this.shown=await Pt(this.otp.trim()),this.otp=""}catch(e){this.error=f(e)}finally{this.busy=!1}}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0}catch{this.copied=!1}}confirmDialog(){const t=!!this.status?.revocation?.wiskey_present;return i`<sw-dialog open heading=${u("rvDlgTitle")} data-bridge-key-revoke-dialog @close=${()=>this.close()}>
      <ul>
        <li>${u("rvDlg1")}</li>
        <li>${u("rvDlg2")}</li>
        <li>${u("rvDlg3")}</li>
        <li>${u("rvDlg4")}</li>
      </ul>
      ${t?i`<div class="warn" role="alert" data-bridge-key-revoke-wiskey>${u("rvWiskeyWarn")}</div>
            <label class="ack"><input type="checkbox" data-bridge-key-revoke-ack .checked=${this.ack}
              @change=${s=>this.ack=s.target.checked} />${u("rvWiskeyAck")}</label>`:o}
      ${this.error?i`<p class="err" role="alert">${this.error}</p>`:o}
      <div class="foot">
        <sw-button variant="ghost" @click=${()=>this.close()}>${u("rvBack")}</sw-button>
        <sw-button variant="danger" ?disabled=${this.busy||t&&!this.ack} data-bridge-key-revoke-yes @click=${()=>void this.revoke()}>${u("rvConfirm")}</sw-button>
      </div>
    </sw-dialog>`}revealDialog(){const e=this.status?.revocation?.step_up_ready!==!1,t=this.shown;return i`<sw-dialog open heading=${u("rvRevealTitle")} data-bridge-key-reveal-dialog @close=${()=>this.close()}>
      ${t?i`<div class="code"><span class="lbl">${u("rvCode")}</span><output data-bridge-key-new-code>${t.pairing_code}</output></div>
            <div class="code"><span class="lbl">${u("rvAddress")}</span><output>${t.addon_url}</output></div>
            <p class="note">${u("rvSteps")}</p>
            <div class="foot">
              ${this.copied?i`<span class="ok" role="status">${u("rvCopied")}</span>`:o}
              <sw-button @click=${()=>void this.copy(t.pairing_code)}>${u("rvCopy")}</sw-button>
              <sw-button variant="primary" @click=${()=>this.close()}>${u("rvClose")}</sw-button>
            </div>`:e?i`<p class="note">${u("rvStepUp")}</p>
              <div class="field">
                <label for="otp" class="lbl">${u("rvCodeLabel")}</label>
                <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-bridge-key-otp .value=${this.otp}
                  @input=${s=>this.otp=s.target.value.replace(/\D/g,"")}
                  @keydown=${s=>{s.key==="Enter"&&this.otp.length>=6&&!this.busy&&this.reveal()}} />
              </div>
              ${this.error?i`<p class="err" role="alert">${this.error}</p>`:o}
              <div class="foot">
                <sw-button variant="ghost" @click=${()=>this.close()}>${u("rvBack")}</sw-button>
                <sw-button variant="primary" ?disabled=${this.busy||this.otp.length<6} data-bridge-key-reveal-yes @click=${()=>void this.reveal()}>${u("rvShow")}</sw-button>
              </div>`:i`<p class="note" role="status" data-bridge-key-step-up-none>${u("rvStepUpNone")}</p>
              <div class="foot"><sw-button variant="primary" @click=${()=>this.close()}>${u("rvClose")}</sw-button></div>`}
    </sw-dialog>`}render(){const e=this.status,t=e?.revocation;if(!e||!t)return o;const s=t.state==="revoked";return i`<div data-bridge-key-revoke=${t.state}>
      ${s?i`<div class="alert" role="alert" data-bridge-key-revoked>${u("rvRevoked",{t:ct(t.revoked_at),name:t.revoked_by_name??""})}</div>
            <div class="note" data-bridge-key-revoke-path=${t.announce_path?"auto":"manual"}>${u(t.announce_path?"rvAuto":"rvManual")}</div>`:t.state==="repaired"&&t.repaired_at?i`<div class="note" data-bridge-key-repaired>${u("rvRepaired",{t:ct(t.repaired_at)})}</div>`:o}
      <div class="row">
        <span class="lbl">${u("rvTitle")}</span>
        <span>
          ${s?i`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-reveal @click=${()=>{this.close(),this.dialog="reveal"}}>${u("rvReveal")}</sw-button>`:o}
          <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-bridge-key-revoke-open @click=${()=>{this.close(),this.done=!1,this.dialog="confirm"}}>${u("rvButton")}</sw-button>
        </span>
      </div>
      <div class="note">${u("rvNote")}</div>
      ${this.done?i`<p class="ok" role="status">${u("rvDone")}</p>`:o}
      ${this.dialog==="confirm"?this.confirmDialog():this.dialog==="reveal"?this.revealDialog():o}
    </div>`}};W.styles=A`
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
      border-block-start: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .note,
    .alert,
    .err,
    .ok,
    li,
    p {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    .note {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      padding-block: 4px;
    }
    .alert {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      margin: 8px 0 0;
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
      font-size: var(--sw-fs-sm);
    }
    ul {
      margin: 0;
      padding-inline-start: 18px;
      display: grid;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .warn {
      margin-block-start: 12px;
      padding: 10px 12px;
      border: 1px solid var(--sw-danger-border, var(--sw-border-strong));
      border-radius: var(--sw-r-sm);
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    label.ack {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-block-start: 10px;
      font-size: var(--sw-fs-sm);
    }
    label.ack input {
      margin-block-start: 3px;
      inline-size: 18px;
      block-size: 18px;
      flex: none;
    }
    .field {
      display: grid;
      gap: 6px;
      margin-block-start: 12px;
    }
    .field input {
      min-block-size: 40px;
      inline-size: min(220px, 100%);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-md);
      letter-spacing: 0.15em;
      padding-inline: 10px;
      direction: ltr;
    }
    .code {
      display: grid;
      gap: 4px;
      margin-block-start: 8px;
    }
    .code output {
      direction: ltr;
      unicode-bidi: isolate;
      font-family: var(--sw-font-mono, ui-monospace, monospace);
      font-size: var(--sw-fs-md);
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
      overflow-wrap: anywhere;
      user-select: all;
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-block-start: 16px;
      flex-wrap: wrap;
    }
    @media (max-width: 767px) and (pointer: coarse) {
      sw-button {
        --sw-ctl-h-sm: 44px;
      }
      .field input {
        min-block-size: 44px;
      }
    }
  `;ee([b({attribute:!1})],W.prototype,"status",2);ee([d()],W.prototype,"dialog",2);ee([d()],W.prototype,"ack",2);ee([d()],W.prototype,"otp",2);ee([d()],W.prototype,"shown",2);ee([d()],W.prototype,"copied",2);ee([d()],W.prototype,"busy",2);ee([d()],W.prototype,"error",2);ee([d()],W.prototype,"done",2);W=ee([O("sw-bridge-key-revoke")],W);var Ma=Object.defineProperty,Va=Object.getOwnPropertyDescriptor,ue=(e,t,s,r)=>{for(var a=r>1?void 0:r?Va(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&Ma(t,s,a),a};function Pe(e){if(!e)return"";const t=new Date(e),s={he:"he-IL",en:"en-GB",ar:"ar",ru:"ru-RU"}[ut()];return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let ie=class extends R{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.asking=null,this.saved=!1}connectedCallback(){if(super.connectedCallback(),ge()){this.notShown=!0;return}this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}schedule(){window.clearTimeout(this.timer),!!this.s?.rotation&&Ue.includes(this.s.rotation.state)&&(this.timer=window.setTimeout(()=>void this.load(),5e3))}async load(){try{this.s=await Tt(),this.error=""}catch(e){const t=e.status;t===403||t===404?this.notShown=!0:this.error=f(e)}this.schedule()}async run(e){this.busy=!0,this.error="",this.saved=!1;try{await e()}catch(t){this.error=f(t)}finally{this.busy=!1}await this.load()}overall(e){return e.revocation?.state==="revoked"?["error",u("stateRevoked")]:e.watchdog?.length?["error",u("stateAttention")]:e.rotation&&Ue.includes(e.rotation.state)?["partial",u("stateRotating")]:e.last&&(e.last.state==="needs_repair"||e.last.state==="verify_failed")?["error",u("stateAttention")]:e.key&&e.key.readable===!1?["error",u("stateAttention")]:e.enabled?["live",u("stateReady")]:["neutral",u("stateOff")]}renderOwners(e){const t=e.owner_contacts;if(!t)return o;const s=a=>void this.run(async()=>{await At(a),this.saved=!0}),r=t.candidates.filter(a=>!t.ids.includes(a.id));return i`<div class="row" data-bridge-key-owners>
        <span class="lbl">${u("ownerContacts")}</span>
        <span class="acts">
          <span class="chips">${t.users.map(a=>i`<span class="chip ${a.valid?"":"invalid"}" data-bridge-key-owner=${a.id} title=${a.valid?"":u("ownerInvalid")}>${a.name}
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} aria-label=${`${u("ownerRemove")} ${a.name}`} data-bridge-key-owner-remove
              @click=${()=>s(t.ids.filter(n=>n!==a.id))}>${u("ownerRemove")}</sw-button></span>`)}</span>
          ${r.length&&t.ids.length<t.max?i`<select aria-label=${u("ownerAdd")} ?disabled=${this.busy} data-bridge-key-owner-add
                @change=${a=>{const n=a.target.value;n&&s([...t.ids,n])}}>
                <option value="" selected>${u("ownerAdd")}</option>
                ${r.map(a=>i`<option value=${a.id}>${a.name}</option>`)}
              </select>`:o}
        </span>
      </div>
      <div class="note" data-bridge-key-owners-note>${t.set?u("ownerReach",{n:t.recipients}):u("ownerNone")}</div>`}watchLine(e){return e.code==="generation_mismatch"?u("wd_generation_mismatch",{a:e.arx_generation??"",b:e.bridge_generation??""}):Oe("wd_",e.code)}renderAsk(){if(!this.asking)return o;const e=this.asking;return i`<div class="row" data-bridge-key-confirm=${e}>
      <span class="val">${u(e==="hard_cut"?"confirmHardCut":"confirmRotate")}</span>
      <span class="acts">
        <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-confirm-yes
          @click=${()=>{this.asking=null,this.run(()=>qe(e))}}>${u("confirm")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.asking=null}>${u("cancel")}</sw-button>
      </span>
    </div>`}render(){if(this.notShown)return o;const e=this.s;if(!e)return this.error?i`<p class="err" role="alert">${this.error}</p>`:o;const[t,s]=this.overall(e),r=e.rotation,a=e.last,n=a&&a.state==="needs_repair"?a:null,c=e.blocked_by?Oe("bl_",e.blocked_by):"";return i`<sw-card heading=${u("title")} data-bridge-key>
      <div class="row">
        <span class="lbl">${u("switchLabel")}</span>
        <span class="acts">
          <sw-badge kind=${t} label=${s} data-bridge-key-state></sw-badge>
          <sw-toggle .checked=${e.enabled} ?disabled=${this.busy||!e.enabled&&!e.go_live_permitted} label=${u("switchLabel")} labelHidden
            data-bridge-key-switch @change=${l=>void this.run(()=>Ke({enabled:l.detail.checked}))}></sw-toggle>
        </span>
      </div>
      <div class="row">
        <span class="lbl">${u("keyId")}</span>
        <span class="val ltr" data-bridge-key-kid>${e.key?`${e.key.kid} · ${u("generation")} ${e.key.generation}`:u("none")}</span>
      </div>
      ${e.key?i`<div class="row"><span class="lbl">${u("since")}</span><span class="val">${Pe(e.key.activated_at??e.key.created_at)}</span></div>`:o}
      <div class="row">
        <span class="lbl">${u("lastRotation")}</span>
        <span class="val" data-bridge-key-last>${r??a?`${Pe((r??a).ended_at??(r??a).started_at)} · ${u((r??a).mode==="hard_cut"?"modeHardCut":"modeRoutine")} · ${Oe("st_",(r??a).state)}`:u("none")}</span>
      </div>
      <div class="row" data-bridge-key-auto>
        <span class="val" role="status">${e.automatic==="awaiting_click"?u("autoAwaitClick"):e.automatic==="waiting_for_bridge"?u("autoWaiting"):e.automatic==="scheduled"?u("autoScheduled"):e.automatic==="idle"?u("autoIdle"):""}</span>
        ${e.automatic==="awaiting_click"&&e.can_start?i`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-start-first @click=${()=>void this.run(()=>qe("routine"))}>${u("startFirst")}</sw-button>`:o}
      </div>
      ${It(e)?i`<div class="note" role="status" data-bridge-key-doors-paused>${u("doorsPaused")}</div>`:o}
      ${(e.watchdog??[]).map(l=>i`<div class="alert" role="alert" data-bridge-key-watchdog=${l.code}>${this.watchLine(l)}</div>`)}
      <div class="note" data-bridge-key-hygiene>${u("hygieneNote")}</div>
      ${r?.retire_at?i`<div class="note" role="status">${u("retireAt",{t:Pe(r.retire_at)})}</div>`:o}
      <div class="row">
        <span class="lbl">${u("reminder")}</span>
        <span class="acts">
          ${e.reminder_due?i`<sw-badge kind="stale" label=${u("reminderDue")} data-bridge-key-reminder-due></sw-badge>`:o}
          <select aria-label=${u("reminder")} ?disabled=${this.busy} data-bridge-key-reminder
            @change=${l=>{const g=Number(l.target.value);this.run(async()=>{await Ke({reminder_days:g}),this.saved=!0})}}>
            ${e.reminder_values.map(l=>i`<option value=${l} ?selected=${l===e.reminder_days}>${l?u("reminderDays",{n:l}):u("reminderOff")}</option>`)}
          </select>
        </span>
      </div>
      ${this.renderOwners(e)}
      ${e.hand_over?i`<div class="row" data-bridge-key-hand-over>
            <span class="lbl">${u("bridgeGen")}</span>
            <span class="val">${e.hand_over.bridge_generation??u("bridgeGenNone")}</span>
          </div>
          ${e.hand_over.last_rotation?.anchor_eligible&&!e.hand_over.anchor_decrease_available?i`<div class="note" data-bridge-key-anchor>${u("anchorUnavailable")}</div>`:o}`:o}
      ${this.renderAsk()}
      <div class="row">
        <span class="val" data-bridge-key-blocked>${c}</span>
        <span class="acts">
          ${n?i`<sw-button size="sm" ?disabled=${this.busy} data-bridge-key-resume @click=${()=>void this.run(()=>Dt(n.id))}>${u("resume")}</sw-button>`:o}
          <sw-button size="sm" variant="primary" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-rotate
            @click=${()=>this.asking="routine"}>${u("rotate")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-hard-cut
            @click=${()=>this.asking="hard_cut"}>${u("hardCut")}</sw-button>
        </span>
      </div>
      <sw-bridge-key-revoke .status=${e} data-bridge-key-revoke-section @changed=${()=>void this.load()}></sw-bridge-key-revoke>
      ${this.error?i`<p class="err" role="alert">${this.error}</p>`:o}
      ${this.saved?i`<p class="ok" role="status">${u("saved")}</p>`:o}
    </sw-card>`}};ie.styles=A`
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
    .chips {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
      min-inline-size: 0;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
      font-size: var(--sw-fs-sm);
      padding-inline-start: 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm);
    }
    .chip.invalid {
      color: var(--sw-text-2);
      text-decoration: line-through;
    }
    .alert {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    @media (max-width: 767px) and (pointer: coarse) {
      select {
        min-block-size: 44px;
      }
      sw-button {
        --sw-ctl-h-sm: 44px;
      }
    }
  `;ue([d()],ie.prototype,"s",2);ue([d()],ie.prototype,"notShown",2);ue([d()],ie.prototype,"busy",2);ue([d()],ie.prototype,"error",2);ue([d()],ie.prototype,"asking",2);ue([d()],ie.prototype,"saved",2);ie=ue([O("sw-bridge-key-card")],ie);const x="partners",Fa=()=>G(`${x}/settings`),pt=e=>Se(`${x}/settings`,e),Wa=()=>G(`${x}/options`),Ua=()=>G(`${x}/clients`),qa=e=>Z(`${x}/clients`,{label:e}),Ka=(e,t)=>Z(`${x}/clients/${encodeURIComponent(e)}/state`,{state:t}),Ha=e=>vt(`${x}/clients/${encodeURIComponent(e)}`),Ga=()=>G(`${x}/tokens`),Za=(e,t)=>Z(`${x}/clients/${encodeURIComponent(e)}/tokens`,t),Xa=e=>Z(`${x}/tokens/${encodeURIComponent(e)}/rotate`,{}),Ya=e=>Z(`${x}/tokens/${encodeURIComponent(e)}/revoke`),Qa=()=>G(`${x}/endpoints`),Ja=(e,t)=>Z(`${x}/clients/${encodeURIComponent(e)}/endpoints`,t),ei=e=>vt(`${x}/endpoints/${encodeURIComponent(e)}`),ti=(e,t)=>Z(`${x}/endpoints/${encodeURIComponent(e)}/pause`,{paused:t}),si=e=>Z(`${x}/endpoints/${encodeURIComponent(e)}/secret/rotate`,{}),ai=e=>Z(`${x}/endpoints/${encodeURIComponent(e)}/ping`),ii=()=>G(`${x}/deliveries?limit=50`),ri=()=>G(`${x}/outbox?state=dead&limit=50`),ni=e=>Z(`${x}/outbox/${encodeURIComponent(e)}/redeliver`),Ve={title:"ממשק לשותפים",stateOff:"כבוי",stateOn:"פעיל",stateBlocked:"ממתין לאישור הפעלה",apiSwitch:"גישת קריאה לשותפים",webhooksSwitch:"שליחת הודעות לשותפים",notPermitted:"ההפעלה דורשת סקירת אבטחה ואישור בעלים.",localOnly:"הפעלה רק מהרשת המקומית. כיבוי אפשרי מכל מקום.",tabPartners:"שותפים",tabTokens:"אסימונים",tabEndpoints:"יעדי הודעות",tabLog:"יומן משלוחים",tabSettings:"הגדרות",partner:"שותף",partnerName:"שם השותף",addPartner:"הוספת שותף",disable:"השבתה",enable:"הפעלה",remove:"מחיקה",confirmRemove:"למחוק? כל האסימונים והיעדים של השותף יבוטלו.",confirmRemoveEndpoint:"למחוק את היעד? הודעות שבתור לא יישלחו.",none:"אין",label:"תיאור",scopes:"הרשאות גישה",sc_tickets_read:"קריאת קריאות שירות",sc_tickets_create:"פתיחת קריאות שירות",sc_temperature_read:"יחידות טמפרטורה",sc_elevators_read:"מעליות",restriction:"תחום",rk_installation:"כל ההתקנה",rk_site:"אתרים",rk_building:"מבנים",rk_floor:"קומות",departments:"מחלקות",sourceCidrs:"כתובות מקור מותרות (אופציונלי)",expiresDays:"תוקף בימים",textOption:"כותרת ותיאור הקריאה",peopleOption:"שמות מבקש ומטפל",createToken:"יצירת אסימון",rotate:"החלפה",revoke:"ביטול",confirmRevoke:"לבטל את האסימון? השותף יאבד גישה מיד.",shownOnce:"מוצג פעם אחת בלבד. העתיקו ושמרו עכשיו.",copy:"העתקה",copied:"הועתק",close:"סגירה",expires:"בתוקף עד",lastUsed:"שימוש אחרון",st_active:"פעיל",st_expired:"פג תוקף",st_revoked:"בוטל",st_pending:"ממתין לבדיקה",st_paused:"מושהה",st_disabled:"מושבת",ownerGone:"יוצר האסימון אינו פעיל",url:"כתובת יעד (https, פורט {ports})",events:"אירועים",skipOwn:"לא לשלוח לשותף על קריאות שהוא פתח",createEndpoint:"הוספת יעד",ping:"בדיקה",pingOk:"הבדיקה הצליחה",pingFail:"הבדיקה נכשלה",pause:"השהיה",resume:"חידוש",rotateSecret:"החלפת סוד",queued:"בתור",dead:"נכשלו",redeliver:"שליחה חוזרת",attempt:"ניסיון",status:"תוצאה",ev_ticket_created:"קריאה נפתחה",ev_ticket_status_changed:"סטטוס קריאה השתנה",ev_ticket_done:"טיפול הסתיים",ev_temperature_alarm:"אזעקת טמפרטורה",ev_temperature_warning:"חריגת טמפרטורה",ev_temperature_offline:"חיישן טמפרטורה לא מדווח",ev_temperature_escalation:"הסלמת אזעקת טמפרטורה",ev_temperature_resolved:"טמפרטורה חזרה לתקינות",ev_elevator_fault:"תקלת מעלית",ev_elevator_out_of_service:"מעלית בהשבתה",ev_elevator_fire_service:"מעלית בפיקוד כבאים",ev_elevator_resolved:"מעלית חזרה לפעולה",v_token_default_days:"תוקף ברירת מחדל (ימים)",v_token_max_days:"תוקף מרבי (ימים)",v_max_endpoints:"מספר יעדים מרבי",v_rate_per_min:"בקשות לדקה לאסימון",v_rate_per_hour:"בקשות לשעה לאסימון",v_create_per_hour:"פתיחת קריאות לשעה",v_create_per_day:"פתיחת קריאות ליום",v_expiry_notice_days:"התראה לפני פקיעה (ימים)",v_rotation_overlap_hours:"חפיפה בהחלפה (שעות)",save:"שמירה",saved:"נשמר",cancel:"ביטול",choosePartner:"בחירת שותף"},oi={title:"Partner interface",stateOff:"Off",stateOn:"On",stateBlocked:"Awaiting activation approval",apiSwitch:"Partner read access",webhooksSwitch:"Messages to partners",notPermitted:"Activation needs a security review and the owner’s approval.",localOnly:"Switch on from the local network only. Switching off works from anywhere.",tabPartners:"Partners",tabTokens:"Tokens",tabEndpoints:"Message targets",tabLog:"Delivery log",tabSettings:"Settings",partner:"Partner",partnerName:"Partner name",addPartner:"Add partner",disable:"Disable",enable:"Enable",remove:"Delete",confirmRemove:"Delete? All tokens and targets of the partner are revoked.",confirmRemoveEndpoint:"Delete the target? Queued messages are not sent.",none:"None",label:"Description",scopes:"Access scopes",sc_tickets_read:"Read service requests",sc_tickets_create:"Open service requests",sc_temperature_read:"Temperature units",sc_elevators_read:"Elevators",restriction:"Area",rk_installation:"Whole installation",rk_site:"Sites",rk_building:"Buildings",rk_floor:"Floors",departments:"Departments",sourceCidrs:"Allowed source addresses (optional)",expiresDays:"Valid for (days)",textOption:"Request title and description",peopleOption:"Requester and handler names",createToken:"Create token",rotate:"Rotate",revoke:"Revoke",confirmRevoke:"Revoke the token? The partner loses access at once.",shownOnce:"Shown once only. Copy and store it now.",copy:"Copy",copied:"Copied",close:"Close",expires:"Valid until",lastUsed:"Last used",st_active:"Active",st_expired:"Expired",st_revoked:"Revoked",st_pending:"Awaiting test",st_paused:"Paused",st_disabled:"Disabled",ownerGone:"The token’s creator is no longer active",url:"Target address (https, port {ports})",events:"Events",skipOwn:"Do not tell a partner about requests it opened",createEndpoint:"Add target",ping:"Test",pingOk:"Test succeeded",pingFail:"Test failed",pause:"Pause",resume:"Resume",rotateSecret:"Rotate secret",queued:"Queued",dead:"Failed",redeliver:"Send again",attempt:"Attempt",status:"Result",ev_ticket_created:"Request opened",ev_ticket_status_changed:"Request status changed",ev_ticket_done:"Work done",ev_temperature_alarm:"Temperature alarm",ev_temperature_warning:"Temperature out of range",ev_temperature_offline:"Temperature sensor silent",ev_temperature_escalation:"Temperature alarm escalated",ev_temperature_resolved:"Temperature back to normal",ev_elevator_fault:"Elevator fault",ev_elevator_out_of_service:"Elevator out of service",ev_elevator_fire_service:"Elevator in fire service",ev_elevator_resolved:"Elevator back in service",v_token_default_days:"Default validity (days)",v_token_max_days:"Maximum validity (days)",v_max_endpoints:"Maximum targets",v_rate_per_min:"Requests per minute per token",v_rate_per_hour:"Requests per hour per token",v_create_per_hour:"Requests opened per hour",v_create_per_day:"Requests opened per day",v_expiry_notice_days:"Notice before expiry (days)",v_rotation_overlap_hours:"Rotation overlap (hours)",save:"Save",saved:"Saved",cancel:"Cancel",choosePartner:"Choose a partner"},li={he:Ve,en:oi,ar:{},ru:{}};function Fe(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function h(e,t,s=Fe()){const r=li[s][e]??Ve[e]??e;return t?r.replace(/\{(\w+)\}/g,(a,n)=>n in t?String(t[n]):a):r}function F(e,t,s=Fe()){const r=`${e}${t.replace(/\./g,"_")}`;return r in Ve?h(r,void 0,s):t}var di=Object.defineProperty,ci=Object.getOwnPropertyDescriptor,z=(e,t,s,r)=>{for(var a=r>1?void 0:r?ci(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&di(t,s,a),a};function ye(e){if(!e)return"";const t=new Date(e),s={he:"he-IL",en:"en-GB",ar:"ar",ru:"ru-RU"}[Fe()];return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}function Te(e){return e==="active"?"live":e==="paused"||e==="pending"?"partial":e==="expired"||e==="revoked"||e==="disabled"?"neutral":"stale"}let y=class extends R{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.ok="",this.tab="partners",this.clients=[],this.tokens=[],this.endpoints=[],this.log=[],this.deadRows=[],this.opts=null,this.once=null,this.confirm=null,this.fClient="",this.fToken={client:"",label:"",scopes:new Set,kind:"installation",ids:new Set,depts:new Set,text:!0,people:!1,days:0,cidrs:""},this.fEp={client:"",label:"",url:"",events:new Set,kind:"installation",ids:new Set,skipOwn:!0},this.values={}}connectedCallback(){super.connectedCallback(),this.load()}get on(){return!!this.s&&(this.s.api_active||this.s.webhooks_active)}async load(){try{if(this.s=await Fa(),this.values={...this.s.values},this.error="",this.on){const[e,t,s,r]=await Promise.all([Ua(),Ga(),Qa(),Wa()]);this.clients=e.items,this.tokens=t.items,this.endpoints=s.items,this.opts=r,this.tab==="log"&&await this.loadLog()}else this.tab!=="settings"&&(this.tab="settings")}catch(e){e.status===403?this.notShown=!0:this.error=f(e)}}async loadLog(){const[e,t]=await Promise.all([ii(),ri()]);this.log=e.items,this.deadRows=t.items}async run(e,t=""){this.busy=!0,this.error="",this.ok="";try{await e(),this.ok=t}catch(s){this.error=f(s)}finally{this.busy=!1}await this.load()}showOnce(e){this.once=e??null}toggleIn(e,t){const s=new Set(e);return s.has(t)?s.delete(t):s.add(t),s}clientName(e){return this.clients.find(t=>t.id===e)?.label??e}placeOptions(e){const t=this.opts;return t?e==="site"?t.sites:e==="building"?t.buildings:e==="floor"?t.floors:[]:[]}renderSwitches(e){const t=this.on?"live":e.go_live_permitted?"neutral":"partial",s=this.on?h("stateOn"):e.go_live_permitted?h("stateOff"):h("stateBlocked"),r=(a,n)=>i`<div class="row">
      <span class="lbl">${n}</span>
      <sw-toggle .checked=${e[a]} ?disabled=${this.busy||!e[a]&&(!e.go_live_permitted||e.remote)} label=${n} labelHidden
        data-partner-switch=${a} @change=${c=>void this.run(()=>pt({[a]:c.detail.checked}))}></sw-toggle>
    </div>`;return i`<div class="row"><span class="lbl">${h("title")}</span><sw-badge kind=${t} label=${s} data-partner-state></sw-badge></div>
      ${r("api",h("apiSwitch"))}${r("webhooks",h("webhooksSwitch"))}
      ${e.go_live_permitted?o:i`<div class="note" role="status" data-partner-not-permitted>${h("notPermitted")}</div>`}
      ${e.go_live_permitted&&e.remote?i`<div class="note" role="status">${h("localOnly")}</div>`:o}`}renderTabs(){const e=this.on?["partners","tokens","endpoints","log","settings"]:["settings"],t={partners:h("tabPartners"),tokens:h("tabTokens"),endpoints:h("tabEndpoints"),log:h("tabLog"),settings:h("tabSettings")};return i`<div class="tabs" role="tablist">${e.map(s=>i`<button role="tab" aria-selected=${this.tab===s?"true":"false"} data-partner-tab=${s}
      @click=${()=>{this.tab=s,s==="log"&&this.loadLog()}}>${t[s]}</button>`)}</div>`}renderOnce(){if(!this.once)return o;const e=this.once;return i`<div class="once" role="alert" data-partner-once>
      <span class="val">${h("shownOnce")}</span>
      <code>${e}</code>
      <span class="acts">
        <sw-button size="sm" @click=${async()=>{try{await navigator.clipboard.writeText(e),this.ok=h("copied")}catch{}}}>${h("copy")}</sw-button>
        <sw-button size="sm" variant="ghost" data-partner-once-close @click=${()=>this.once=null}>${h("close")}</sw-button>
      </span>
    </div>`}renderConfirm(){if(!this.confirm)return o;const e=this.confirm;return i`<div class="row" data-partner-confirm><span class="val">${e.text}</span><span class="acts">
      <sw-button size="sm" variant="primary" ?disabled=${this.busy} @click=${()=>{this.confirm=null,this.run(e.run)}}>${e.action}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.confirm=null}>${h("cancel")}</sw-button></span></div>`}renderPartners(){return i`<div class="form">
        <input type="text" maxlength="80" .value=${this.fClient} placeholder=${h("partnerName")} aria-label=${h("partnerName")}
          @input=${e=>this.fClient=e.target.value} />
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!this.fClient.trim()} data-partner-add
          @click=${()=>void this.run(async()=>{await qa(this.fClient.trim()),this.fClient=""},h("saved"))}>${h("addPartner")}</sw-button></span>
      </div>
      <div class="list">${this.clients.length?this.clients.map(e=>i`<div class="row" data-partner-client=${e.id}>
        <span class="lbl">${e.label}</span>
        <span class="acts">
          <sw-badge kind=${Te(e.state)} label=${F("st_",e.state)}></sw-badge>
          <span class="val">${h("tabTokens")} ${e.tokens} · ${h("tabEndpoints")} ${e.endpoints}</span>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>Ka(e.id,e.state==="active"?"disabled":"active"))}>${e.state==="active"?h("disable"):h("enable")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:h("confirmRemove"),action:h("remove"),run:()=>Ha(e.id)}}>${h("remove")}</sw-button>
        </span></div>`):i`<div class="note">${h("none")}</div>`}</div>`}renderRestriction(e,t,s,r){const a=this.s;return i`<span class="chips"><span class="val">${h("restriction")}</span>
        <select aria-label=${h("restriction")} @change=${n=>s(n.target.value)}>
          ${a.restriction_kinds.map(n=>i`<option value=${n} ?selected=${n===e}>${F("rk_",n)}</option>`)}
        </select></span>
      ${e!=="installation"?i`<span class="chips">${this.placeOptions(e).map(n=>i`<label><input type="checkbox" .checked=${t.has(n.id)}
        @change=${()=>r(this.toggleIn(t,n.id))} />${n.name}</label>`)}</span>`:o}`}renderTokens(){const e=this.fToken,t=this.s,s=[...e.scopes].some(n=>n.startsWith("tickets.")),r=!!e.client&&e.scopes.size>0&&(e.kind==="installation"||e.ids.size>0)&&(!e.scopes.has("tickets.create")||e.depts.size>0),a=()=>void this.run(async()=>{const n=e.cidrs.split(/[\s,]+/).map(l=>l.trim()).filter(Boolean),c=await Za(e.client,{label:e.label.trim()||void 0,scopes:[...e.scopes],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],departments:s?[...e.depts]:void 0,source_cidrs:n.length?n:void 0,personal:{ticket_text:e.text,ticket_people:e.people},expires_days:e.days>0?e.days:void 0});this.showOnce(c.token),this.fToken={...this.fToken,label:"",scopes:new Set,ids:new Set,depts:new Set,cidrs:"",days:0}},h("saved"));return i`<div class="form" data-partner-token-form>
        <span class="chips"><select aria-label=${h("choosePartner")} @change=${n=>this.fToken={...e,client:n.target.value}}>
          <option value="">${h("choosePartner")}</option>
          ${this.clients.filter(n=>n.state==="active").map(n=>i`<option value=${n.id} ?selected=${n.id===e.client}>${n.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${h("label")} aria-label=${h("label")} @input=${n=>this.fToken={...e,label:n.target.value}} /></span>
        <span class="chips"><span class="val">${h("scopes")}</span>${t.scopes.map(n=>i`<label><input type="checkbox" .checked=${e.scopes.has(n)}
          data-partner-scope=${n} @change=${()=>this.fToken={...e,scopes:this.toggleIn(e.scopes,n)}} />${F("sc_",n)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,n=>this.fToken={...e,kind:n,ids:new Set},n=>this.fToken={...e,ids:n})}
        ${s?i`<span class="chips"><span class="val">${h("departments")}</span>${(this.opts?.departments??[]).map(n=>i`<label><input type="checkbox" .checked=${e.depts.has(n.id)}
          @change=${()=>this.fToken={...e,depts:this.toggleIn(e.depts,n.id)}} />${n.name}</label>`)}</span>
          <span class="chips"><label><input type="checkbox" .checked=${e.text} @change=${()=>this.fToken={...e,text:!e.text}} />${h("textOption")}</label>
          <label><input type="checkbox" .checked=${e.people} data-partner-people @change=${()=>this.fToken={...e,people:!e.people}} />${h("peopleOption")}</label></span>`:o}
        <span class="chips"><label>${h("expiresDays")} <input type="number" min="1" max=${t.values.token_max_days??365} placeholder=${String(t.values.token_default_days??90)}
          .value=${e.days?String(e.days):""} @input=${n=>this.fToken={...e,days:Number(n.target.value)||0}} /></label>
          <input type="text" class="ltr" .value=${e.cidrs} placeholder=${h("sourceCidrs")} aria-label=${h("sourceCidrs")} @input=${n=>this.fToken={...e,cidrs:n.target.value}} /></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!r} data-partner-token-create @click=${a}>${h("createToken")}</sw-button></span>
      </div>
      <div class="list">${this.tokens.length?this.tokens.map(n=>i`<div class="row" data-partner-token=${n.id}>
        <span class="lbl">${this.clientName(n.client_id)}${n.label?` · ${n.label}`:""} <span class="val ltr">…${n.last4}</span></span>
        <span class="val">${n.scopes.map(c=>F("sc_",c)).join(", ")} · ${F("rk_",n.restriction_kind)} · ${h("expires")} ${ye(n.expires_at)}${n.last_used_at?` · ${h("lastUsed")} ${ye(n.last_used_at)}`:""}</span>
        <span class="acts">
          <sw-badge kind=${Te(n.state)} label=${F("st_",n.state)}></sw-badge>
          ${n.owner_gone?i`<sw-badge kind="stale" label=${h("ownerGone")}></sw-badge>`:o}
          ${n.state==="active"?i`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await Xa(n.id)).token))}>${h("rotate")}</sw-button>
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:h("confirmRevoke"),action:h("revoke"),run:()=>Ya(n.id)}}>${h("revoke")}</sw-button>`:o}
        </span></div>`):i`<div class="note">${h("none")}</div>`}</div>`}renderEndpoints(){const e=this.fEp,t=this.s,s=!!e.client&&e.url.startsWith("https://")&&e.events.size>0&&(e.kind==="installation"||e.ids.size>0),r=()=>void this.run(async()=>{const a=await Ja(e.client,{label:e.label.trim()||void 0,url:e.url.trim(),events:[...e.events],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],skip_own:e.skipOwn});this.showOnce(a.secret),this.fEp={...this.fEp,label:"",url:"",events:new Set,ids:new Set}},h("saved"));return i`<div class="form" data-partner-endpoint-form>
        <span class="chips"><select aria-label=${h("choosePartner")} @change=${a=>this.fEp={...e,client:a.target.value}}>
          <option value="">${h("choosePartner")}</option>
          ${this.clients.filter(a=>a.state==="active").map(a=>i`<option value=${a.id} ?selected=${a.id===e.client}>${a.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${h("label")} aria-label=${h("label")} @input=${a=>this.fEp={...e,label:a.target.value}} /></span>
        <input type="url" class="ltr" maxlength="2048" .value=${e.url} placeholder=${h("url",{ports:t.allowed_ports.join(" / ")})} aria-label=${h("url",{ports:t.allowed_ports.join(" / ")})}
          data-partner-url @input=${a=>this.fEp={...e,url:a.target.value}} />
        <span class="chips"><span class="val">${h("events")}</span>${t.event_types.map(a=>i`<label><input type="checkbox" .checked=${e.events.has(a)}
          @change=${()=>this.fEp={...e,events:this.toggleIn(e.events,a)}} />${F("ev_",a)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,a=>this.fEp={...e,kind:a,ids:new Set},a=>this.fEp={...e,ids:a})}
        <span class="chips"><label><input type="checkbox" .checked=${e.skipOwn} @change=${()=>this.fEp={...e,skipOwn:!e.skipOwn}} />${h("skipOwn")}</label></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!s} data-partner-endpoint-create @click=${r}>${h("createEndpoint")}</sw-button></span>
      </div>
      <div class="list">${this.endpoints.length?this.endpoints.map(a=>i`<div class="row" data-partner-endpoint=${a.id}>
        <span class="lbl">${this.clientName(a.client_id)}${a.label?` · ${a.label}`:""} <span class="val ltr">${a.host}</span></span>
        <span class="val">${a.events.map(n=>F("ev_",n)).join(", ")} · ${h("queued")} ${a.queued} · ${h("dead")} ${a.dead}</span>
        <span class="acts">
          <sw-badge kind=${Te(a.state)} label=${F("st_",a.state)}></sw-badge>
          <sw-button size="sm" ?disabled=${this.busy||!t.webhooks_active} @click=${()=>void this.run(async()=>{if((await ai(a.id)).state!=="delivered")throw new Error(h("pingFail"))},h("pingOk"))}>${h("ping")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>ti(a.id,a.state!=="paused"))}>${a.state==="paused"?h("resume"):h("pause")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await si(a.id)).secret))}>${h("rotateSecret")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:h("confirmRemoveEndpoint"),action:h("remove"),run:()=>ei(a.id)}}>${h("remove")}</sw-button>
        </span></div>`):i`<div class="note">${h("none")}</div>`}</div>`}renderLog(){return i`<div class="list" data-partner-log>
      ${this.deadRows.map(e=>i`<div class="row"><span class="val">${ye(e.occurred_at)} · ${F("ev_",e.type)} · ${e.dead_reason??""}</span>
        <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>ni(e.id))}>${h("redeliver")}</sw-button></div>`)}
      ${this.log.length?this.log.map(e=>i`<div class="row"><span class="val">${ye(e.started_at)} · ${F("ev_",e.type)} · ${h("attempt")} ${e.attempt}</span>
        <span class="val ltr">${e.http_status??""} ${e.error_class??""} · ${e.duration_ms} ms</span></div>`):i`<div class="note">${h("none")}</div>`}
    </div>`}renderSettings(){const e=this.s;return i`<div class="form" data-partner-settings>
      ${Object.keys(e.values).map(t=>i`<label class="row"><span class="val">${F("v_",t)}</span>
        <input type="number" min=${e.ranges[t]?.[0]??0} max=${e.ranges[t]?.[1]??0} .value=${String(this.values[t]??e.values[t])}
          @input=${s=>this.values={...this.values,[t]:Number(s.target.value)}} /></label>`)}
      <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-partner-settings-save
        @click=${()=>{const t=Object.fromEntries(Object.entries(this.values).filter(([s,r])=>r!==e.values[s]));this.run(()=>pt({values:t}),h("saved"))}}>${h("save")}</sw-button></span>
    </div>`}render(){if(this.notShown)return o;const e=this.s;if(!e)return this.error?i`<p class="err" role="alert">${this.error}</p>`:o;const t={partners:()=>this.renderPartners(),tokens:()=>this.renderTokens(),endpoints:()=>this.renderEndpoints(),log:()=>this.renderLog(),settings:()=>this.renderSettings()}[this.tab]();return i`<sw-card heading=${h("title")} data-partner-api>
      ${this.renderSwitches(e)}
      ${this.renderTabs()}
      ${this.renderOnce()}
      ${this.renderConfirm()}
      ${t}
      ${this.error?i`<p class="err" role="alert">${this.error}</p>`:o}
      ${this.ok?i`<p class="ok" role="status">${this.ok}</p>`:o}
    </sw-card>`}};y.styles=A`
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
  `;z([d()],y.prototype,"s",2);z([d()],y.prototype,"notShown",2);z([d()],y.prototype,"busy",2);z([d()],y.prototype,"error",2);z([d()],y.prototype,"ok",2);z([d()],y.prototype,"tab",2);z([d()],y.prototype,"clients",2);z([d()],y.prototype,"tokens",2);z([d()],y.prototype,"endpoints",2);z([d()],y.prototype,"log",2);z([d()],y.prototype,"deadRows",2);z([d()],y.prototype,"opts",2);z([d()],y.prototype,"once",2);z([d()],y.prototype,"confirm",2);z([d()],y.prototype,"fClient",2);z([d()],y.prototype,"fToken",2);z([d()],y.prototype,"fEp",2);z([d()],y.prototype,"values",2);y=z([O("sw-partner-api-card")],y);var pi=Object.defineProperty,hi=Object.getOwnPropertyDescriptor,w=(e,t,s,r)=>{for(var a=r>1?void 0:r?hi(t,s):t,n=e.length-1,c;n>=0;n--)(c=e[n])&&(a=(r?c(t,s,a):c(a))||a);return r&&a&&pi(t,s,a),a};const ui=[{key:"go2rtc_url",label:"כתובת go2rtc"},{key:"go2rtc_api_username",label:"משתמש go2rtc (אם מוגן)"},{key:"wiskey_username",label:"משתמש עמדות WisKey (מצלמות)"},{key:"bootstrap_admin_username",label:"שם משתמש של המנהל הראשון"},{key:"log_level",label:"רמת לוג"}];function oe(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleString("he-IL",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}let m=class extends R{constructor(){super(...arguments),this.bubbleSkin=new Bt(this),this.raw=null,this.report=null,this.recorder=null,this.error="",this.busy=!1,this.notify=null,this.notifyError="",this.notifyPlan=null,this.notifyBusy=!1,this.notifyResult="",this.sys=null,this.sysRecorder="nvr-1",this.sysRecorders=[],this.sysError="",this.sysMsg="",this.sysBusy=!1,this.ntpForm=null,this.rebootWord="",this.rebootOpen=!1,this.changes=[],this.wiskey=null,this.wiskeyError="",this.wiskeyForm=null,this.wiskeyClear=null,this.wiskeyMsg="",this.wiskeyBusy=!1,this.sysOk=!0,this.notifyOk=!0,this.wiskeyOk=!0}get sysApi(){return Ut(this.sysRecorder)}static statusLine(e,t,s){const r=i`<sw-icon name=${t?"check":"warning"} size=${13}></sw-icon>`;return s==="data-nvr-system-msg"?i`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-nvr-system-msg>${r}${e}</div>`:s==="data-nvr-result"?i`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-nvr-result>${r}${e}</div>`:i`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-wiskey-cred-msg>${r}${e}</div>`}connectedCallback(){super.connectedCallback(),be()&&this.load()}async load(){this.loadNvr(),this.loadWiskey(),this.busy=!0;try{this.raw=await G("health"),this.error=""}catch(e){this.error=f(e)}try{const e=He()?null:await jt();this.recorder=e?.recorder??null,this.sysRecorders=e?.recorders??[]}catch{this.recorder=null}try{this.report=await Lt()}catch{this.report=null}this.busy=!1}check(e){return this.report?.checks.find(t=>t.id===e)??null}row(e,t,s=""){return i`<div class="check"><span>${e}</span><span class=${`val ${s}`}>${t==null||t===""?"—":String(t)}</span></div>`}sectionHead(e,t){return i`<div class="syshead"><sw-icon name=${e} size=${15}></sw-icon>${t}</div>`}async loadNvr(){if(be()&&!He()){try{const[e,t]=await Promise.all([qt(),Ze(10)]);this.notify=e,this.changes=t.changes,this.notifyError=""}catch(e){this.notifyError=f(e)}this.loadSystem()}}get sysVendor(){return this.sysRecorders.find(e=>e.id===this.sysRecorder)?.vendor??this.sys?.vendor??null}async loadSystem(){if(this.sysRecorders.find(e=>e.id===this.sysRecorder)?.vendor==="frigate"){this.sys=null,this.sysError="";return}try{this.sys=await this.sysApi.nvrSystem(),this.sysError=""}catch(e){this.sysError=f(e)}}async sysAction(e,t){if(!this.sysBusy){this.sysBusy=!0,this.sysMsg="";try{await t(),await Promise.all([this.loadSystem(),Ze(10).then(s=>this.changes=s.changes)]),this.sysOk=!0,this.sysMsg=`${e}: בוצע ונרשם באודיט.`}catch(s){this.sysOk=!1,this.sysMsg=`${e}: ${f(s)}`}finally{this.sysBusy=!1}}}renderSystemCard(){const e=this.sys,t=a=>`${(a/1024).toFixed(0)} GB`,s=e?.time?.drift_s??null,r=s===null?"":Math.abs(s)<=2?"ok":Math.abs(s)<=30?"warn":"err";return i`<sw-card heading="מערכת ה־NVR" subheading="שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת" data-nvr-system>
      ${this.sysRecorders.length>1?i`<sw-field label="NVR"><select data-nvr-system-recorder ?disabled=${this.sysBusy} @change=${a=>{this.sysRecorder=a.target.value,this.sys=null,this.sysMsg="",this.loadSystem()}}>
            ${this.sysRecorders.map(a=>i`<option value=${a.id} ?selected=${a.id===this.sysRecorder}>${a.name}</option>`)}
          </select></sw-field>`:o}
      ${this.sysVendor==="frigate"?i`<frigate-summary recorder-id=${this.sysRecorder} data-nvr-system-frigate></frigate-summary>`:e&&e.supported===!1?i`<div class="hint" data-nvr-system-unsupported>פרטי השעון, הדיסקים והיציאות אינם זמינים עבור מקליט מסוג זה.</div>`:i`${this.sysError?i`<div class="msg err" role="alert" data-nvr-system-error><sw-icon name="warning" size=${13}></sw-icon>${this.sysError}</div>`:o}
      ${e?i`
          ${this.sectionHead("clock","שעון")}
          ${e.time?i`${this.row("שעון ה־NVR",`${e.time.local_time??"—"} · ${e.time.mode==="NTP"?"NTP":"ידני"}`)}
                ${this.row("סטייה מול שעון השרת",s===null?"—":`${s>0?"+":""}${s} שנ׳`,r)}
                ${this.row("שרת NTP",e.time.ntp?`${e.time.ntp.host??"—"}:${e.time.ntp.port} · כל ${e.time.ntp.interval_min} דק׳`:"—")}
                ${e.can.time?i`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${()=>this.sysAction("סנכרון השעון",()=>this.sysApi.setNvrTime({sync_now:!0}))}>סנכרן לשעון השרת עכשיו</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${()=>this.ntpForm=this.ntpForm?null:{host:e.time?.ntp?.host??"",port:e.time?.ntp?.port??123,interval_min:e.time?.ntp?.interval_min||1440}}>שרת NTP…</sw-button>
                    </div>
                    ${this.ntpForm?i`<div class="two" data-nvr-ntp-form>
                          <sw-field label="שרת NTP"><input data-ltr .value=${this.ntpForm.host} @input=${a=>this.ntpForm={...this.ntpForm,host:a.target.value}} /></sw-field>
                          <sw-field label="מרווח (דקות)"><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${a=>this.ntpForm={...this.ntpForm,interval_min:Number(a.target.value)}} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy||!this.ntpForm.host} data-nvr-ntp-save @click=${()=>{const a=this.ntpForm;this.sysAction("שרת NTP",async()=>{await this.sysApi.setNvrNtp({host:a.host.trim(),port:a.port,interval_min:a.interval_min}),this.ntpForm=null})}}>כתוב ל־NVR</sw-button></div>
                        </div>`:o}`:i`<div class="hint">כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).</div>`}`:i`<div class="hint">השעון לא נקרא${e.errors.time?` (${e.errors.time})`:""}.</div>`}
          ${this.sectionHead("storage","דיסקים ו־S.M.A.R.T.")}
          ${e.disks.length?e.disks.map(a=>i`<div data-nvr-disk=${a.id}>
                ${this.row(`${a.name} (${a.type})`,`${a.status} · ${t(a.capacity_mb)} · פנוי ${t(a.free_mb)} (${a.capacity_mb?Math.round(a.free_mb/a.capacity_mb*100):0}%)`,a.status==="ok"?"ok":"warn")}
                ${a.smart?this.row("S.M.A.R.T.",`${a.smart.all_eval??"—"} · ${a.smart.temperature_c??"—"}°C · ${a.smart.power_on_days??"—"} ימי פעילות${a.smart.test_status?` · בדיקה: ${a.smart.test_status} ${a.smart.test_percent}%`:""}`,a.smart.all_eval==="functional"?"ok":"warn"):this.row("S.M.A.R.T.","לא זמין")}
                ${e.can.storage?i`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${a.id} @click=${()=>this.sysAction("בדיקת S.M.A.R.T. קצרה",()=>this.sysApi.startSmartTest(a.id,"short"))}>בדיקת S.M.A.R.T. קצרה</sw-button><span class="hint">מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות</span></div>`:o}
              </div>`):i`<div class="hint">לא נקראו דיסקים${e.errors.disks?` (${e.errors.disks})`:""}.</div>`}
          ${this.sectionHead("bell","יציאות אזעקה")}
          ${e.outputs.length?e.outputs.map(a=>i`<div class="check" data-nvr-output=${a.id}><span>יציאה ${a.id}${a.name?` · ${a.name}`:""} <span class="hint">${a.io_type==="local"?"ממסר ב־NVR":"במצלמה"} · ${a.use_type==="whiteLight"?"אור לבן":a.use_type==="disable"?"לא בשימוש":a.use_type}${a.pulse_ms?` · פולס ${a.pulse_ms/1e3} שנ׳`:""}</span></span>
                ${a.pulse_supported?e.can.alarm?i`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy||!a.enabled} data-nvr-pulse=${a.id} @click=${()=>this.sysAction(`הפעלת יציאה ${a.id}`,()=>this.sysApi.pulseNvrOutput(a.id))}>הפעל (pulse)</sw-button>`:i`<span class="val">${a.enabled?"פעיל":"כבוי"}</span>`:i`<span class="val" data-nvr-output-unsupported>הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)</span>`}
              </div>`):i`<div class="hint">אין יציאות${e.errors.outputs?` (${e.errors.outputs})`:""}.</div>`}
          ${this.sectionHead("refresh","הפעלה מחדש")}
          ${e.can.reboot?i`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${()=>{this.rebootWord="",this.rebootOpen=!0}}>הפעל מחדש את ה־NVR…</sw-button><span class="hint">1–2 דקות בלי לייב ובלי הקלטה</span></div>`:i`<div class="hint">הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).</div>`}
          ${this.sysMsg?m.statusLine(this.sysMsg,this.sysOk,"data-nvr-system-msg"):o}`:this.sysError?o:i`<div class="hint">קורא את מצב המערכת מה־NVR…</div>`}`}
      ${this.rebootOpen?i`<sw-dialog open heading="הפעלה מחדש של ה־NVR" subheading="במשך 1–2 דקות אין לייב ואין הקלטה" data-nvr-reboot-dialog @close=${()=>this.rebootOpen=!1}>
            <div class="dlgtext">הקלד <b>RESTART</b> כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.</div>
            <sw-field label="אישור"><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${a=>this.rebootWord=a.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy||this.rebootWord.trim().toUpperCase()!=="RESTART"} data-nvr-reboot-run @click=${()=>{const a=this.rebootWord;this.rebootOpen=!1,this.sysAction("הפעלה מחדש",()=>this.sysApi.rebootNvr(a))}}>הפעל מחדש</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}async loadWiskey(){if(N("system.configure"))try{this.wiskey=await Mt(),this.wiskeyError=""}catch(e){this.wiskeyError=m.wiskeyFailure("רשימת העמדות לא נטענה",e)}}static wiskeyFailure(e,t){return`${e}: ${f(t)}${t instanceof Ae?` (${t.code})`:""}`}wiskeyName(e){return this.wiskey?.stations.find(s=>s.station_id===e)?.name||e}async saveWiskey(){const e=this.wiskeyForm;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await Vt(e.station_id,{username:e.username.trim(),password:e.password}),this.wiskeyForm=null,this.wiskeyOk=!0,this.wiskeyMsg=`החשבון של ${this.wiskeyName(e.station_id)} נשמר; התמונה מהמצלמה תילקח מחדש איתו.`,await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=m.wiskeyFailure("לא נשמר",t)}finally{this.wiskeyBusy=!1}}}async clearWiskey(){const e=this.wiskeyClear;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await Ft(e.station_id),this.wiskeyClear=null,this.wiskeyOk=!0,this.wiskeyMsg=e.known?`החשבון של ${e.name||e.station_id} הוסר; העמדה חוזרת לחשבון המשותף.`:`הרשומה של ${e.station_id} הוסרה.`,await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=m.wiskeyFailure("לא הוסר",t)}finally{this.wiskeyBusy=!1}}}renderWiskeyStation(e,t){const s=this.wiskeyForm?.station_id===e.station_id?this.wiskeyForm:null,r=e.override?"override":t.default_configured?"default":"none",a=e.override?`חשבון משלה · מאז ${oe(e.override_updated_at)}`:t.default_configured?"החשבון המשותף":"אין חשבון · אין תמונה מהמצלמה";return i`<div data-wiskey-station=${e.station_id} data-wiskey-cred-state=${r}>
      <div class="check">
        <span>${e.name||e.station_id}${e.known?e.has_camera?o:i` <span class="hint">· ללא מצלמה</span>`:i` <span class="hint" data-wiskey-cred-unknown>· לא ברשימת העמדות של WisKey כרגע</span>`}</span>
        <span class=${`val ${e.override?"ok":t.default_configured?"":"warn"}`} data-wiskey-cred-status>${a}</span>
      </div>
      ${s?i`<div class="two" data-wiskey-cred-form>
            <sw-field label="משתמש"><input data-ltr data-wiskey-cred-user autocomplete="off" .value=${s.username} @input=${n=>this.wiskeyForm={...s,username:n.target.value}} /></sw-field>
            <sw-field label="סיסמה"><input type="password" data-ltr data-wiskey-cred-password autocomplete="new-password" .value=${s.password} @input=${n=>this.wiskeyForm={...s,password:n.target.value}} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.wiskeyBusy||!s.username.trim()||!s.password} data-wiskey-cred-save @click=${()=>this.saveWiskey()}>${this.wiskeyBusy?"שומר…":"שמור"}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.wiskeyBusy} data-wiskey-cred-cancel @click=${()=>this.wiskeyForm=null}>ביטול</sw-button>
            </div>
            <div class="hint">החשבון נשמר בבסיס הנתונים של Arx ואינו מוצג שוב; השמירה נרשמת באודיט בלי הסיסמה. החשבון אינו נבדק מול העמדה - אם הוא שגוי, במרכז הכניסה לא תהיה תמונה מהמצלמה.</div>
          </div>`:i`<div class="actions">
            ${e.known?i`<sw-button size="sm" icon="edit" ?disabled=${this.wiskeyBusy} data-wiskey-cred-edit @click=${()=>{this.wiskeyMsg="",this.wiskeyForm={station_id:e.station_id,username:"",password:""}}}>${e.override?"החלפת החשבון…":"חשבון משלה לעמדה…"}</sw-button>`:o}
            ${e.override?i`<sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.wiskeyBusy} data-wiskey-cred-clear @click=${()=>{this.wiskeyMsg="",this.wiskeyClear=e}}>${e.known?"חזרה לחשבון המשותף":"הסרת הרשומה"}</sw-button>`:o}
          </div>`}
    </div>`}renderWiskeyCard(){if(!N("system.configure"))return o;const e=this.wiskey,t=this.wiskeyClear;return i`<sw-card heading="מצלמות עמדות WisKey" subheading="חשבון ה־RTSP שאיתו go2rtc מושך את מצלמת כל עמדה: המשותף שהוגדר בתשתית המערכת, או חשבון משלה לעמדה שצריכה אחר · הערכים עצמם אינם מוצגים" data-wiskey-credentials>
      ${this.wiskeyError?i`<div class="msg err" role="alert" data-wiskey-cred-error><sw-icon name="warning" size=${13}></sw-icon>${this.wiskeyError}</div>`:o}
      ${e?i`${this.row("חשבון משותף (wiskey_username, הסיסמה בכרטיס סודות)",e.default_configured?"מוגדר":"לא מוגדר",e.default_configured?"ok":"warn")}
          ${e.state!=="ready"?i`<div class="hint" data-wiskey-cred-feed=${e.state}>WisKey אינו מחובר כרגע (מצב: <span class="ltr">${e.state}</span>); מוצג מה שידוע ל־Arx.</div>`:o}
          ${e.stations.length?e.stations.map(s=>this.renderWiskeyStation(s,e)):i`<div class="hint" data-wiskey-cred-empty>אין עמדות ברשימה.</div>`}
          ${this.wiskeyMsg?m.statusLine(this.wiskeyMsg,this.wiskeyOk,"data-wiskey-cred-msg"):o}`:this.wiskeyError?o:i`<div class="hint">קורא את רשימת העמדות…</div>`}
      ${t?i`<sw-dialog open heading="הסרת החשבון של העמדה" subheading=${t.name||t.station_id} data-wiskey-cred-confirm @close=${()=>this.wiskeyClear=null}>
            <div class="dlgtext">${t.known?e?.default_configured?"העמדה תחזור לחשבון המשותף, והתמונה מהמצלמה תילקח מחדש איתו.":"לעמדה לא יישאר חשבון, ולא תהיה ממנה תמונה עד שיוגדר אחד.":"הרשומה תימחק מבסיס הנתונים של Arx."} ההסרה נרשמת באודיט.</div>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.wiskeyBusy} data-wiskey-cred-confirm-run @click=${()=>this.clearWiskey()}>${this.wiskeyBusy?"מסיר…":"הסר"}</sw-button><sw-button variant="ghost" @click=${()=>this.wiskeyClear=null}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}renderConnectionCard(){return N("system.configure")?i`<nvr-recorders-card></nvr-recorders-card>`:o}planNotify(e,t,s){const r=e?e.length:this.notify?.channels.length??0;this.notifyResult="",this.notifyPlan={channels:e,smart:t,enabled:s,label:`${s?"הפעלת":"כיבוי"} Notify Surveillance Center ב־${r} ערוצים${t?" · תנועה + אירועים חכמים":" · זיהוי תנועה"}`}}async runNotify(){const e=this.notifyPlan;if(!(!e||this.notifyBusy)){this.notifyBusy=!0;try{const t=await Kt({channels:e.channels,smart:e.smart,enabled:e.enabled});this.notifyOk=!t.failed,this.notifyResult=`בוצע: ${t.applied} שינויים · ${t.unchanged} כבר היו כך · ${t.skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · ${t.failed} נכשלו`,this.notifyPlan=null,await this.loadNvr()}catch(t){this.notifyOk=!1,this.notifyResult=f(t)}finally{this.notifyBusy=!1}}}async rollback(e){if(!this.notifyBusy){this.notifyBusy=!0;try{await Ht(e.id),this.notifyOk=!0,this.notifyResult=`השינוי ${e.target} הוחזר למצב הקודם.`,await this.loadNvr()}catch(t){this.notifyOk=!1,this.notifyResult=f(t)}finally{this.notifyBusy=!1}}}renderNotifyCard(){const e=this.notify,t=s=>s===null?"—":i`<span class=${`yn ${s?"on":"off"}`} role="img" aria-label=${s?"נשלחת":"לא נשלחת"}><sw-icon name=${s?"check":"close"} size=${12}></sw-icon></span>`;return i`<sw-card heading="התראות מה־NVR (Notify Surveillance Center)" subheading="אילו ערוצים מודיעים ל־Arx על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר" data-nvr-notify>
      ${this.notifyError?i`<div class="msg err" role="alert" data-nvr-notify-error><sw-icon name="warning" size=${13}></sw-icon>${this.notifyError}</div>`:o}
      ${e?i`<div class="tablewrap"><table class="matrix" data-nvr-matrix>
            <thead><tr><th scope="col">ערוץ</th><th scope="col">מצלמה</th><th scope="col">תנועה</th><th scope="col">אירועים חכמים</th><th scope="col"><span class="sr">פעולה</span></th></tr></thead>
            <tbody>${e.channels.map(s=>i`<tr data-nvr-channel=${s.channel}>
              <td class="ltr num">${s.channel}</td><td>${s.name}</td>
              <td data-nvr-motion=${s.motion.supported?String(s.motion.center):"none"}>${s.motion.supported?t(s.motion.center):i`<span class="dim">לא מוגדר</span>`}</td>
              <td class="num">${s.smart_supported?i`<span class="ltr">${s.smart_center}/${s.smart_supported}</span>`:i`<span class="dim">אין</span>`}</td>
              <td class="act">${e.can_write&&s.motion.supported&&!s.motion.center?i`<sw-button size="sm" data-nvr-enable-one=${s.channel} @click=${()=>this.planNotify([s.channel],!1,!0)}>הפעל</sw-button>`:o}</td>
            </tr>`)}</tbody>
          </table></div>
          <div class="hint legend"><span class="yn on"><sw-icon name="check" size=${12}></sw-icon></span> ההתראה נשלחת ל־Arx · <span class="yn off"><sw-icon name="close" size=${12}></sw-icon></span> הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).</div>
          ${e.can_write?i`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${()=>this.planNotify(null,!1,!0)}>הפעל תנועה בכל הערוצים</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${()=>this.planNotify(null,!0,!0)}>הפעל גם אירועים חכמים</sw-button>
              </div>`:i`<div class="hint" data-nvr-no-permission>לכתיבה ל־NVR נדרשת ההרשאה "${e.permission}" — מוקנית למנהל המערכת, ולאחרים דרך תפקיד מותאם (הגדרות ‹ משתמשים והרשאות ‹ תפקידים), גם למנהל מערכת.</div>`}
          ${this.notifyResult?m.statusLine(this.notifyResult,this.notifyOk,"data-nvr-result"):o}
          ${this.changes.length?i`<div class="syshead"><sw-icon name="history" size=${15}></sw-icon>שינויים אחרונים ב־NVR</div>
            <ul class="changes" data-nvr-changes>${this.changes.map(s=>i`<li><span class="ltr">${s.created_at.slice(0,16).replace("T"," ")}</span> · ${s.target} · ${s.note||s.kind} · ${s.status==="applied"?"בוצע":s.status==="unchanged"?"ללא שינוי":s.status==="rolled_back"?"הוחזר":"נכשל"}${s.actor_username?` · ${s.actor_username}`:""}
              ${s.status==="applied"&&e.can_write?i`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${s.id} @click=${()=>this.rollback(s)}>החזר</sw-button>`:o}</li>`)}</ul>`:o}`:this.notifyError?o:i`<div class="hint">קורא את הגדרות ה־NVR…</div>`}
      ${this.notifyPlan?i`<sw-dialog open heading="כתיבה ל־NVR" subheading=${this.notifyPlan.label} data-nvr-confirm @close=${()=>this.notifyPlan=null}>
            <div class="dlgtext">השינוי נכתב להגדרות ה־NVR בזהות המשתמש של חיבור ה־NVR, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${()=>this.runNotify()}>${this.notifyBusy?"כותב…":"כתוב ל־NVR"}</sw-button><sw-button variant="ghost" @click=${()=>this.notifyPlan=null}>ביטול</sw-button></div>
          </sw-dialog>`:o}
    </sw-card>`}renderApi(){const e=this.raw;return i`
      <sw-page crumbs="הגדרות" heading="חיבורים" subheading="מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · פרטי חיבור ה־NVR נשמרים כאן">
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.load()}>${this.busy?"בודק…":"רענון"}</sw-button>
        ${this.error?i`<sw-state-panel state="error" heading="מצב החיבורים לא נטען" hint=${this.error}></sw-state-panel>`:o}
        ${e?i`<div class="two" data-connections>
              <div class="grouplabel">מערכת ה־NVR</div>
              ${e.mode==="ha_only"?i`<sw-card heading="NVR - מצב ללא NVR" subheading="לא מוגדר - דילוג מכוון" data-nvr-less-connections>
                    ${this.row("מצב ההתקנה","תשתית המערכת בלבד (ללא NVR)")}
                    <div class="hint">מצלמות, לייב, אירועים, הקלטות, תיקים וייצוא מוסתרים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.</div>
                  </sw-card>
                  ${this.renderConnectionCard()}`:i`
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${e.nvr_configured?"מוגדר · קריאה בלבד":"לא מוגדר"}>
                ${this.row("חיבור מוגדר",e.nvr_configured?"כן":"לא",e.nvr_configured?"ok":"err")}
                ${this.recorder?this.row("דגם · קושחה",`${this.recorder.model??"—"} · ${this.recorder.firmware??"—"}`):o}
                ${this.row("גילוי מצלמות",`${e.discovery.cameras} ערוצים · כל ${Math.round(e.discovery.interval_s/60)} דק׳`)}
                ${this.row("גילוי אחרון תקין",oe(e.discovery.cameras_last_ok),e.discovery.cameras_last_error?"warn":"ok")}
                ${e.discovery.cameras_last_error?this.row("שגיאת גילוי",e.discovery.cameras_last_error,"err"):o}
                ${this.row("זרם התראות (alertStream)",e.events.ingest.connected?`מחובר · פעימה ${oe(e.events.ingest.last_heartbeat_at)}`:`מנותק${e.events.ingest.last_error?` · ${e.events.ingest.last_error}`:""}`,e.events.ingest.connected?"ok":"err")}
                ${this.row("התראות שנשמרו מאז ההפעלה",e.events.ingest.events_stored,e.events.ingest.connected&&!e.events.ingest.events_stored?"warn":"")}
                ${e.events.ingest.connected&&!e.events.ingest.last_event_at?i`<div class="hint" data-no-alerts-hint>ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.</div>`:o}
                ${this.row("אירועים שנגזרו מהקלטות (ריצה אחרונה)",`${e.events.derive.derived} · ${oe(e.events.derive.last_ok)}`,e.events.derive.last_error?"warn":"")}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}`}
              <div class="grouplabel">שירותים ותשתית נוספים</div>
              <sw-card heading="go2rtc (relay לווידאו)" subheading=${e.go2rtc_configured?"מוגדר":e.mode==="ha_only"?"לא מוגדר - רשות במצב ללא NVR":Ge()?"לא מוגדר":"לא מוגדר - נדרש כשיש NVR"}>
                ${this.row("חיבור מוגדר",e.go2rtc_configured?"כן":"לא",e.go2rtc_configured?"ok":e.mode==="ha_only"?"":"err")}
                ${!e.go2rtc_configured&&e.mode==="ha_only"?i`<div class="hint" data-go2rtc-optional>במצב ללא NVR go2rtc נדרש רק לווידאו של עמדות WisKey.</div>`:o}
                ${Ge()?o:i`<div class="hint" data-go2rtc-required>${Wt}</div>`}
                ${this.row("סנכרון זרמים אחרון תקין",oe(e.discovery.streams_last_ok),e.discovery.streams_last_error?"warn":"ok")}
                ${e.discovery.streams_last_error?this.row("שגיאת סנכרון זרמים",e.discovery.streams_last_error,"err"):o}
                ${this.check("go2rtc")?this.row("בדיקת בריאות",this.check("go2rtc").detail,this.check("go2rtc").status==="ok"?"ok":this.check("go2rtc").status==="warn"?"warn":"err"):i`<div class="hint">פרטי הזרמים והגרסה מוצגים ב"הגדרות ‹ כללי ‹ בריאות ועבודות" (דורש הרשאת ניהול).</div>`}
              </sw-card>
              ${this.renderWiskeyCard()}
              ${N("system.configure")?i`<sw-secrets-card></sw-secrets-card>`:o}
              ${N("system.configure")?i`<sw-bridge-key-card></sw-bridge-key-card>`:o}
              ${N("partner.manage")?i`<sw-partner-api-card></sw-partner-api-card>`:o}
              ${N("system.configure")?i`<sw-door-setup data-door-setup></sw-door-setup><sw-door-inventory data-door-inventory></sw-door-inventory><sw-door-blocks data-door-blocks></sw-door-blocks><sw-emergency-open-settings></sw-emergency-open-settings>`:o}
              ${N("system.configure")||N("access.admin.read")?i`<sw-wiskey-relay-map data-relay-map></sw-wiskey-relay-map>`:o}
              <sw-card heading="תשתית המערכת" subheading=${e.home_assistant.connected?`מחובר · גרסה ${e.home_assistant.ha_version??""}`:e.home_assistant.configured?"מוגדר, מנותק":"לא מוגדר"}>
                ${this.row("חיבור",e.home_assistant.connected?"מחובר":`מנותק${e.home_assistant.last_error?` · ${e.home_assistant.last_error}`:""}`,e.home_assistant.connected?"ok":"err")}
                ${this.row("ישויות בקטלוג",e.home_assistant.entities)}
                ${this.row("תמונת מצב אחרונה",oe(e.home_assistant.last_snapshot_at))}
                ${this.row("עדכון ישות אחרון",oe(e.home_assistant.last_event_at))}
                ${this.row("רישום (אזורים / קומות) עודכן",oe(e.home_assistant.last_registry_at))}
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
                ${ui.map(t=>i`<div class="check"><span>${t.label}</span><span class="val ltr">${t.key}</span></div>`)}
              </div>
              <div class="hint">משתמש ה־NVR צריך הרשאות צפייה והקלטות; Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה.</div>
            </sw-card>`:this.error?o:i`<sw-state-panel state="loading" heading="קורא את מצב החיבורים…"></sw-state-panel>`}
      </sw-page>
    `}render(){return be()?this.renderApi():i`<sw-page crumbs="הגדרות" heading="חיבורים" subheading="מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · כתיבה ל־NVR רק בפעולות המאושרות, עם הרשאה רגישה">
      <sw-state-panel icon="link" state="empty" heading="החיבורים מוצגים מול שרת אמיתי" hint="במצב הדגמה אין חיבורים לקרוא. שלבי ההתקנה עם נתוני הדגמה נמצאים באשף ההתקנה." actionLabel="לאשף ההתקנה" @action=${()=>window.location.hash="#/system/wizard"}></sw-state-panel>
    </sw-page>`}};m.styles=[Be,A`
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
  `,ht];w([d()],m.prototype,"raw",2);w([d()],m.prototype,"report",2);w([d()],m.prototype,"recorder",2);w([d()],m.prototype,"error",2);w([d()],m.prototype,"busy",2);w([d()],m.prototype,"notify",2);w([d()],m.prototype,"notifyError",2);w([d()],m.prototype,"notifyPlan",2);w([d()],m.prototype,"notifyBusy",2);w([d()],m.prototype,"notifyResult",2);w([d()],m.prototype,"sys",2);w([d()],m.prototype,"sysRecorder",2);w([d()],m.prototype,"sysRecorders",2);w([d()],m.prototype,"sysError",2);w([d()],m.prototype,"sysMsg",2);w([d()],m.prototype,"sysBusy",2);w([d()],m.prototype,"ntpForm",2);w([d()],m.prototype,"rebootWord",2);w([d()],m.prototype,"rebootOpen",2);w([d()],m.prototype,"changes",2);w([d()],m.prototype,"wiskey",2);w([d()],m.prototype,"wiskeyError",2);w([d()],m.prototype,"wiskeyForm",2);w([d()],m.prototype,"wiskeyClear",2);w([d()],m.prototype,"wiskeyMsg",2);w([d()],m.prototype,"wiskeyBusy",2);w([d()],m.prototype,"sysOk",2);w([d()],m.prototype,"notifyOk",2);w([d()],m.prototype,"wiskeyOk",2);m=w([O("system-setup")],m);export{m as SystemSetup};
//# sourceMappingURL=system-setup-Byc1yWVS.js.map
