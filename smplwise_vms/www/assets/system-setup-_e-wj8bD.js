import{bg as q,bw as Ae,j,k as c,a as E,q as w,A as l,b as r,c as Ee,m as N,bs as zt,bu as Ct,br as St,bt as Rt,dv as Vt,s5 as Wt,s6 as Ft,rE as be,ae as $e,fo as Ut,z as y,ei as Ne,d0 as ze,ai as et,AX as Kt,aU as qt,aM as O,ag as pe,cL as g,af as we,iY as _e,m9 as Ht,md as Gt,c$ as se,bv as Zt,F as Q,b4 as qe,j9 as Xt,u as Ot,AY as Yt,AZ as Qt,A_ as h,eD as He,A$ as Et,B0 as tt,B1 as Jt,B2 as es,B3 as ts,B4 as ss,d4 as as,B5 as Le,B6 as st,B7 as at,B8 as is,B9 as rs,Ba as ns,cd as Nt,aX as os,gz as it,eG as ls,Ao as ds,dL as o,Bb as cs,Bc as ps,Bd as hs,Be as rt,Bf as us}from"./index-D3xHkfje.js";import"./system-doors-CXIgxWsE.js";import{fmtWhen as Pt}from"./access-CVGF2oq1.js";import{t as f}from"./wiskey-BvQMnpau.js";import{s as vs,d as fs}from"./confirm-words-ChQmxGYO.js";import{l as Ue}from"./live-Btf27nYW.js";import"./sw-chip-C1wXYX1O.js";import{s as Ge}from"./settings-CBX0_39g.js";import{b as Tt}from"./bubble-chrome-DW_f3pbN.js";import{n as Se,k as gs,l as nt,m as ms,p as bs}from"./nvr-dBJ-GVXZ.js";import{p as ws}from"./physical-outcome-CFMDmHms.js";import{c as ot}from"./confirm-dialog-ARVGcHOq.js";import"./nvr-connection-form-BPy5finQ.js";import{p as $s,q as ys,t as ks,o as ge,u as xs,v as Ke,A as lt,w as _s,m as zs,x as Cs,y as Pe,z as Ss,B as It,C as Rs,D as Os,E as Es,F as Ns,G as Ps,H as dt,I as Ts,J as Is,K as Ds,L as As,M as Bs,S as js,N as ct,O as Ls,P as Ms,Q as pt,R as ht,T as Vs,U as Ws,V as Me,W as Fs,X as Us,Y as Ks,g as Ve,c as qs,Z as ut,l as vt,_ as Hs,$ as Gs,a0 as Zs,a1 as Xs,a2 as ft}from"./frigate-control-DZyAysMC.js";import{f as u}from"./frigate-text-C2Is4xjn.js";import{T as ye}from"./toast-controller-BPX0Tkjm.js";import{l as Ys,u as gt,S as Qs}from"./recorders-CvcjRzWw.js";import"./sw-table-BASj552X.js";import{m as Js,t as ea}from"./deep-links-q4RsfMxD.js";import"./sw-logo-art-PLtEZJxU.js";import"./system-a-CDuaOwuI.js";import"./door-path-logic-Y1uIn7zZ.js";import"./lock-reason-B_fHNviT.js";import"./nvr-h264-preset-INpvg1PZ.js";import"./media-CSqgsuwf.js";const ta=()=>q("wiskey/relay-map"),sa=(e,t,s,i)=>Ae(`wiskey/relay-map/${encodeURIComponent(e)}`,{expected_revision:t,rows:s,confirmed:!0,...i?{confirm_text:i}:{}}),aa=e=>q(`wiskey/relay-map/inventory/${encodeURIComponent(e)}`),Ze="off";function Te(e,t){const s=e.relays.find(i=>i.physical_index===t);return s?.name?`${f("ממסר פיזי {n}",{n:t})} · ${s.name}`:f("ממסר פיזי {n}",{n:t})}function ia(e){return[{value:Ze,label:f("מושבת")},...e.relays.map(t=>({value:String(t.physical_index),label:Te(e,t.physical_index)}))]}function ra(e){const t=Number(e);return e!==Ze&&Number.isInteger(t)&&t>=1?t:null}function Xe(e){const t={};for(const s of e.rows)t[s.api_relay]=s.active?s.physical_relay:null;return t}function na(e){return Object.keys(e).map(Number).sort((t,s)=>t-s).map(t=>({api_relay:t,physical_relay:e[t]??null}))}function Be(e,t){const s=Xe(e),i=new Set;for(const d of Object.keys(s).map(Number)){const $=s[d]??null,D=t[d]??null;$!==D&&($!==null&&i.add($),D!==null&&i.add(D))}const a=Object.values(t).filter(d=>d!==null),n=[...new Set(a.filter((d,$)=>a.indexOf(d)!==$))].sort((d,$)=>d-$),p=[...i].sort((d,$)=>d-$);return{changed:p.length>0,affected:p,automated:p.filter(d=>e.automated_relays.includes(d)),duplicate:n}}function oa(e,t,s){const i=Be(e,t);return s&&e.in_copy&&i.changed&&i.duplicate.length===0}function mt(e,t){return Be(e,t).automated.length>0}function la(e){if(!e.in_copy)return{tone:"stale",text:f("התחנה אינה מופיעה כעת ב-WisKey")};if(e.revision===0)return{tone:"unknown",text:f("לא אושר - חירום ואוטומציות דרך WisKey ייחסמו")};const t=new Set(Object.values(Xe(e)).filter(i=>i!==null)),s=e.relays.map(i=>i.physical_index).filter(i=>!t.has(i));return s.length?{tone:"stale",text:`${f("חלקי")} · ${f("מהדורה {n}",{n:e.revision})} · ${f("{relays} לא ממופה",{relays:s.map(i=>f("ממסר פיזי {n}",{n:i})).join(", ")})}`}:{tone:"live",text:`${f("מאושר")} · ${f("מהדורה {n}",{n:e.revision})}`}}function da(e,t){return e.approved_at?`${f("אושר בידי {name}",{name:e.approved_by??f("משתמש לא ידוע")})} · ${t(e.approved_at)}`:f("טרם אושר")}function ca(e,t){const s=Be(e,t),i=s.affected.map(n=>Te(e,n)).join(", "),a=s.automated.length?` ${f("לדלתות {doors} יש אוטומציה - היא תפעל לפי המיפוי החדש.",{doors:s.automated.map(n=>Te(e,n)).join(", ")})}`:"";return`${f("לאשר את מיפוי הממסרים של {name}? השינוי נוגע ל{doors}.",{name:e.name,doors:i})}${a} ${f("שום פקודה לא נשלחת לתחנה.")}`}function pa(e){const t=e.data;if(e.state!=="ready"||!t)return{lines:[],message:ha(e)};const s=t.api_outputs,i=s.count===null||s.evidence!=="device_capability_at_load"?f("לא נצפו"):`${s.ids.map(n=>f("ממסר API {n}",{n})).join(", ")} · ${f("לפי יכולת העמדה בטעינה")}`,a=t.configured_mapping.length?`${t.configured_mapping.map(n=>`${f("ממסר פיזי {n}",{n:n.physical_index})} ← ${f("ממסר API {n}",{n:n.api_id})}`).join(", ")} · ${f("הגדרה שמורה, לא מדידה")}`:f("לא נשמר מיפוי");return{message:null,lines:[{key:"outputs",label:f("יציאות API שהעמדה דיווחה"),value:i,unknown:s.count===null},{key:"saved",label:f("מיפוי שמור ב-WisKey"),value:a,unknown:!1},{key:"count",label:f("מספר ממסרים פיזיים"),value:t.physical_relay_count===null?f("לא ידוע"):String(t.physical_relay_count),unknown:t.physical_relay_count===null},{key:"roles",label:f("תפקיד הממסרים (דלת / שער)"),value:f("לא ידוע"),unknown:!0},{key:"test",label:f("בדיקת ממסר בלי להפעיל"),value:f("לא נתמכת ב-WisKey"),unknown:!1}]}}function ha(e){switch(e.state){case"unsupported":return f("גרסת WisKey המותקנת אינה מציעה את הקריאה הזו - לא נשלח דבר.");case"forbidden":return f("WisKey סירב לקריאה.");case"unavailable":return e.reason==="station_unloaded"?f("העמדה אינה טעונה כרגע ב-WisKey."):f("WisKey אינו זמין כרגע.");case"busy":return f("WisKey עסוק כרגע. אפשר לנסות שוב בעוד רגע.");default:return e.reason==="contract_mismatch"?f("תשובת WisKey אינה תואמת את החוזה ולכן אינה מוצגת."):f("הקריאה מ-WisKey נכשלה.")}}var ua=Object.defineProperty,va=Object.getOwnPropertyDescriptor,ve=(e,t,s,i)=>{for(var a=i>1?void 0:i?va(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&ua(t,s,a),a};let ae=class extends E{constructor(){super(...arguments),this.map=null,this.error="",this.busy=!1,this.drafts={},this.pending=null,this.word="",this.inventory={}}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.map=await ta(),this.drafts={},this.error=""}catch(e){this.error=w(e)}}async toggleInventory(e){if(this.inventory[e.id]&&this.inventory[e.id]!=="loading"){const{[e.id]:t,...s}=this.inventory;this.inventory=s;return}if(this.inventory[e.id]!=="loading"){this.inventory={...this.inventory,[e.id]:"loading"};try{const t=await aa(e.id);this.inventory={...this.inventory,[e.id]:t}}catch(t){this.inventory={...this.inventory,[e.id]:{error:w(t)}}}}}inventoryBlock(e){const t=this.inventory[e.id];if(!t)return l;if(t==="loading")return r`<div class="sub" data-relay-inventory="loading">${f("קורא מ-WisKey…")}</div>`;if("error"in t)return r`<div class="err" role="alert" data-relay-inventory="error">${t.error}</div>`;const s=pa(t);return s.message?r`<div class="sub" data-relay-inventory=${t.state}>${s.message}</div>`:r`<dl class="inv" data-relay-inventory="ready">
      ${s.lines.map(i=>r`<dt>${i.label}</dt><dd data-relay-inventory-line=${i.key} data-unknown=${i.unknown?"true":l}>${i.value}</dd>`)}
      <dd class="note">${f("יציאות API אינן ממסרים פיזיים. המיפוי שאושר כאן הוא אישור, לא מדידה, ואינו משתנה מהקריאה.")}</dd>
    </dl>`}draft(e){return this.drafts[e.id]??Xe(e)}pick(e,t,s){this.drafts={...this.drafts,[e.id]:{...this.draft(e),[t]:ra(s)}}}ask(e){this.word="",this.pending=e}async approve(){const e=this.pending;if(!e)return;const t=this.draft(e);this.busy=!0;try{await sa(e.id,e.revision,na(t),mt(e,t)?this.word.trim():void 0),this.pending=null,await this.load()}catch(s){const i=w(s);this.pending=null,s instanceof Ee&&s.status===409&&await this.load(),this.error=i}finally{this.busy=!1}}stationBlock(e,t){const s=this.draft(t),i=la(t),a=Be(t,s),n=e.can_edit&&t.in_copy,p=ia(t);return r`<div class="station" data-relay-map-station=${t.name}>
      <div class="head">
        <div class="who"><span class="name">${t.name||f("תחנה ללא שם")}</span><span class="sub">${da(t,Pt)}</span></div>
        <sw-badge kind=${i.tone} label=${i.text}></sw-badge>
      </div>
      <div class="rows">
        ${t.rows.map(d=>{const $=s[d.api_relay]??null;return r`<label data-relay-map-row=${d.api_relay}>
            <span>${f("ממסר API {n}",{n:d.api_relay})}</span>
            <sw-dropdown label=${`${t.name}: ${f("ממסר API {n}",{n:d.api_relay})}`} data-relay-map-pick=${d.api_relay} .value=${$===null?Ze:String($)}
              .items=${p.map(D=>({id:D.value,label:D.label}))} ?inert=${!n||this.busy} aria-disabled=${!n||this.busy?"true":l} style=${!n||this.busy?"opacity: var(--sw-disabled-opacity)":""}
              @change=${D=>this.pick(t,d.api_relay,D.detail.id)}></sw-dropdown>
          </label>`})}
      </div>
      ${t.in_copy?r`<div class="actions">
            <sw-button size="sm" variant="ghost" data-relay-inventory-toggle aria-expanded=${this.inventory[t.id]?"true":"false"} ?disabled=${this.inventory[t.id]==="loading"}
              @click=${()=>this.toggleInventory(t)}>${this.inventory[t.id]?f("הסתרת מה ש-WisKey יודע"):f("מה WisKey יודע על הממסרים")}</sw-button>
          </div>`:l}
      ${this.inventoryBlock(t)}
      ${t.automated_relays.length?r`<div class="sub" data-relay-map-automated>${f("יש אוטומציה על {relays}",{relays:t.automated_relays.map(d=>Te(t,d)).join(", ")})}</div>`:l}
      ${a.duplicate.length?r`<div class="err" role="alert">${f("כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד.")}</div>`:l}
      ${n&&a.changed?r`<div class="actions">
            <sw-button size="sm" variant="primary" data-relay-map-approve ?disabled=${this.busy||!oa(t,s,e.can_edit)} @click=${()=>this.ask(t)}>${f("אישור מיפוי")}</sw-button>
            <sw-button size="sm" variant="ghost" data-relay-map-reset ?disabled=${this.busy} @click=${()=>{const{[t.id]:d,...$}=this.drafts;this.drafts=$}}>${f("ביטול שינויים")}</sw-button>
          </div>`:l}
    </div>`}dialog(e,t){const s=this.draft(t),i=mt(t,s),a=!i||vs(e.confirm_word,this.word),n=fs(e.confirm_word);return r`<sw-dialog open heading=${f("מיפוי ממסרים")} data-relay-map-confirm @close=${()=>{this.pending=null}}>
      <p>${ca(t,s)}</p>
      ${i?r`<div class="word">
            <span class="warn">${f('כדי לאשר יש להקליד "{word}"',{word:n})}</span>
            <input data-relay-map-word aria-label=${f("להקליד {word}",{word:n})} .value=${this.word} @input=${p=>this.word=p.target.value} />
          </div>`:l}
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.pending=null}}>${f("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-relay-map-ok ?disabled=${this.busy||!a} @click=${()=>this.approve()}>${f("אישור")}</sw-button>
    </sw-dialog>`}render(){if(this.error&&!this.map)return r`<sw-state-panel state="error" hint=${this.error} actionLabel=${f("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>`;if(!this.map)return r`<sw-state-panel state="loading"></sw-state-panel>`;const e=this.map,t=e.can_edit?`${f("לכל תחנה: איזה ממסר פיזי (דלת) כל ממסר API מפעיל")} · ${f("חירום ואוטומציות דרך WisKey פועלים רק על מיפוי מאושר")} · ${f("לא נשלחת פקודה לתחנה")}`:`${f("לצפייה בלבד")} · ${f("שינוי המיפוי שמור למנהל המערכת")}`;return r`<sw-card heading=${f("מיפוי ממסרים")} subheading=${t} data-relay-map-card>
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:l}
      ${e.stations.length?e.stations.map(s=>this.stationBlock(e,s)):r`<sw-state-panel icon="door" state="empty" heading=${f("אין תחנות")} hint=${e.has_copy?f("WisKey לא מסר תחנות."):f("נתוני WisKey אינם זמינים כרגע.")}></sw-state-panel>`}
      ${this.pending?this.dialog(e,this.pending):l}
    </sw-card>`}};ae.styles=j`
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
    .inv {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px var(--sw-s-3);
      margin-block-start: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .inv dt {
      color: var(--sw-text-3);
    }
    .inv dd {
      margin: 0;
      min-inline-size: 0;
    }
    .inv .note {
      grid-column: 1 / -1;
      color: var(--sw-text-3);
    }
    @media (max-width: 599px) {
      .inv {
        grid-template-columns: 1fr;
      }
      .inv dd {
        margin-block-end: var(--sw-s-1);
      }
    }
    .word {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      margin-block-start: var(--sw-s-2);
    }
  `;ve([c()],ae.prototype,"map",2);ve([c()],ae.prototype,"error",2);ve([c()],ae.prototype,"busy",2);ve([c()],ae.prototype,"drafts",2);ve([c()],ae.prototype,"pending",2);ve([c()],ae.prototype,"word",2);ve([c()],ae.prototype,"inventory",2);ae=ve([N("sw-wiskey-relay-map")],ae);const fa=()=>q("doors/blocks"),ga=(e,t,s)=>Ae(`doors/blocks/entities/${encodeURIComponent(e)}`,{unblocked:t,...s?{note:s}:{},confirmed:!0}),Ye={title:"חסימות פתיחת דלתות",sub:"כל עוד יש דלת אינטרקום, התקן וירטואלי (תבנית) שלא ניתן להוכיח שאינו דלת נחסם, וכך גם פריט שמשתמש בו. מנהל מערכת יכול לשחרר התקן אחד ולהחזיר אותו לחסימה. כל שינוי נרשם ביומן.",entities:"התקנים וירטואליים",items:"פריטים חסומים",search:"חיפוש לפי שם, אזור או סיבה",fAll:"הכול",fBlocked:"חסומים",fReleased:"משוחררים",refresh:"רענון",more:"הצג עוד ({n})",retry:"נסה שוב",none:"אין דלת אינטרקום בהתקנה, ולכן שום התקן אינו חסום",noEntities:"אין התקנים וירטואליים לשחרור",noMatch:"אין התאמות לחיפוש",noItems:"אין פריטים חסומים",truncated:"הרשימה קטועה: מוצגים רק ההתקנים הראשונים לפי שם",summary:"{blocked} חסומים · {released} משוחררים",summaryItems:"{blocked} פריטים חסומים",sBlocked:"חסום",sReleased:"משוחרר",sDoor:"משויך לדלת",sStale:"כבר אינו בקטלוג",usedBy:"בשימוש: {names}",usedMore:" ועוד {n}",releasedBy:"שוחרר בידי {who} · {when}",toggle:"שחרור {name}",itemFreed:"אינו חסום עוד",itemBlocked:"חסום",itemDevices:"התקנים וירטואליים: {names}",itemDevicesMore:" ועוד {n}",itemDeviceReleased:"{name} (משוחרר)",itemStays:"נשאר חסום גם אחרי שחרור ההתקנים",releaseTitle:"שחרור התקן וירטואלי",releaseText:"ההתקן יפסיק להיחסם: כפתורי התקנים, פעולה מרוכזת ופריטים שמשתמשים בו יורשו מ־Arx, גם אם הוא פותח דלת אינטרקום. השחרור נרשם ביומן עם שמך והסיבה, ואפשר להחזיר את החסימה בכל עת.",noteLabel:"סיבה לשחרור (חובה)",noteHint:"לפחות 3 תווים, עד {max}",release:"שחרור",reblockTitle:"החזרת חסימה להתקן",reblockText:"פעולות על ההתקן ייחסמו שוב, ופריטים שמשתמשים בו לא יופעלו מ־Arx עד שיוסר ממנו.",reblock:"החזרת חסימה",noteOptional:"סיבה (לא חובה)",cancel:"ביטול",saved:"נשמר",needNote:"נדרשת סיבה (לפחות 3 תווים)",tooLong:"הסיבה ארוכה מדי (עד {max} תווים)",d_lock:"מנעול",d_switch:"מתג",d_light:"תאורה",d_cover:"תריס או שער",d_fan:"מאוורר",d_button:"כפתור",d_media_player:"נגן",d_select:"בחירה",d_number:"ערך",d_valve:"ברז",d_vacuum:"שואב",d_alarm_control_panel:"לוח אזעקה",d_climate:"מיזוג",d_other:"התקן"},Dt=zt("en","i18n/door-blocks","en");function ma(){return Rt(["en"])}function m(e,t){const s=(ma()==="en"?Dt[e]:void 0)??Ye[e];return St(s,t)}function ba(e,t,s){return e in Ye?m(e,s):m(t,s)}Ct("i18n/door-blocks",{he:Ye,en:Dt});const wa=3,Qe=300,Re=50,$a=["all","blocked","released"],ya={all:"fAll",blocked:"fBlocked",released:"fReleased"},ka=e=>m(ya[e]),At=e=>e.split(/\s+/).filter(Boolean).join(" ");function xa(e){const t=At(e).length;return t<wa?"required":t>Qe?"too_long":null}function _a(e){return e==="required"?m("needNote"):m("tooLong",{max:Qe})}const bt=e=>e.toLowerCase().split(/\s+/).filter(Boolean).join(" ");function za(e,t,s){const i=bt(t).split(" ").filter(Boolean);return e.filter(a=>{if(s==="blocked"&&a.state==="unblocked"||s==="released"&&a.state!=="unblocked")return!1;if(!i.length)return!0;const n=bt([a.name,a.entity_id,a.area??"",Bt(a.domain),a.override?.note??"",a.override?.by??""].join(" "));return i.every(p=>n.includes(p))})}function Ca(e,t){return{rows:e.slice(0,t),left:Math.max(0,e.length-t)}}const Bt=e=>ba(`d_${e}`,"d_other");function wt(e){return[Bt(e.domain),e.area].filter(Boolean).join(" · ")}function Sa(e){return e.state==="door"?{kind:"unknown",text:m("sDoor")}:e.state==="unblocked"?{kind:"live",text:e.stale?`${m("sReleased")} · ${m("sStale")}`:m("sReleased")}:{kind:"stale",text:m("sBlocked")}}function Ra(e){return e.used_by.length?m("usedBy",{names:e.used_by.join(", ")})+(e.used_more?m("usedMore",{n:e.used_more}):""):""}function Oa(e,t){return e.override?m("releasedBy",{who:e.override.by||"—",when:t(e.override.at)}):""}function Ea(e){if(!e.devices.length)return"";const t=e.devices.map(s=>s.state==="unblocked"?m("itemDeviceReleased",{name:s.name}):s.name).join(", ");return m("itemDevices",{names:t})+(e.devices_more?m("itemDevicesMore",{n:e.devices_more}):"")}function Na(e){return e.blocked?{kind:"stale",text:m("itemBlocked")}:{kind:"live",text:m("itemFreed")}}function Pa(e){return!e.wiskey_present&&!e.counts.entities?m("none"):m("summary",{blocked:e.counts.blocked,released:e.counts.unblocked})}var Ta=Object.defineProperty,Ia=Object.getOwnPropertyDescriptor,J=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ia(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Ta(t,s,a),a};let M=class extends E{constructor(){super(...arguments),this.data=null,this.error="",this.busy=!1,this.q="",this.status="all",this.shown=Re,this.pending=null,this.note="",this.problem="",this.saved=!1,this.gen=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.gen+=1,super.disconnectedCallback()}async load(){const e=++this.gen;this.busy=!0;try{const t=await fa();if(e!==this.gen)return;this.data=t,this.error=""}catch(t){if(e!==this.gen)return;this.error=w(t)}finally{e===this.gen&&(this.busy=!1)}}ask(e,t){this.pending={entity:e,release:t},this.note="",this.problem="",this.saved=!1,this.requestUpdate()}cancel(){this.pending=null,this.problem="",this.requestUpdate()}async confirm(){const e=this.pending;if(!(!e||this.busy)){if(e.release){const t=xa(this.note);if(t){this.problem=_a(t);return}}this.busy=!0,this.problem="";try{const t=await ga(e.entity.entity_id,e.release,At(this.note)||void 0);this.data&&(this.data={...this.data,entities:this.data.entities.map(s=>s.entity_id===t.entity_id?{...s,state:t.state,override:t.override}:s)}),this.pending=null,this.note="",this.saved=!0,this.busy=!1,await this.load()}catch(t){this.problem=w(t)}finally{this.busy=!1}}}entityRow(e){const t=Sa(e),s=Ra(e),i=Oa(e,Pt);return r`<div class="ent" data-door-block=${e.entity_id} data-door-block-state=${e.state}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${wt(e)}</span>
        ${s?r`<span class="sub" data-door-block-used>${s}</span>`:l}
        ${e.override?r`<span class="sub" data-door-block-when>${i}</span><span class="note" data-door-block-why>${e.override.note}</span>`:l}
      </div>
      <div class="ctl">
        <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
        ${e.state==="door"||!e.overridable?l:r`<sw-toggle class="t" label=${m("toggle",{name:e.name})} labelHidden data-door-block-toggle .checked=${Ue(e.state==="unblocked")} ?disabled=${this.busy}
              @change=${a=>this.ask(e,a.detail.checked)}></sw-toggle>`}
      </div>
    </div>`}itemRow(e){const t=Na(e),s=Ea(e);return r`<div class="item" data-door-block-item=${e.key} data-blocked=${String(e.blocked)} data-opens-door=${String(e.opens_door)}>
      <div class="who">
        <span class="name">${e.name}</span>
        <span class="sub">${e.kind_text}</span>
        ${e.opens_door?r`<span class="warn" data-door-block-door>${e.guard}${e.why?` · ${e.why}`:""}</span>`:l}
        ${s?r`<span class="sub" data-door-block-devices>${s}</span>`:l}
        ${e.opens_door&&s?r`<span class="sub">${m("itemStays")}</span>`:l}
        ${!e.opens_door&&!s&&e.reasons.length?r`<span class="sub">${e.reasons.join(" · ")}</span>`:l}
      </div>
      <sw-badge kind=${t.kind} label=${t.text}></sw-badge>
    </div>`}dialog(){const e=this.pending;return e?r`<sw-dialog open heading=${e.release?m("releaseTitle"):m("reblockTitle")} data-door-block-dialog @close=${()=>this.cancel()}>
      <p class="q"><strong>${e.entity.name}</strong> · ${wt(e.entity)}</p>
      <p class="q">${e.release?m("releaseText"):m("reblockText")}</p>
      <sw-field label=${e.release?m("noteLabel"):m("noteOptional")} hint=${e.release?m("noteHint",{max:Qe}):""}>
        <textarea data-door-block-note-input rows="3" maxlength="600" aria-label=${e.release?m("noteLabel"):m("noteOptional")} .value=${this.note}
          @input=${t=>{this.note=t.target.value,this.problem=""}}></textarea>
      </sw-field>
      ${this.problem?r`<div class="err" role="alert" data-door-block-problem>${this.problem}</div>`:l}
      <sw-button slot="footer" variant="ghost" data-door-block-cancel @click=${()=>this.cancel()}>${m("cancel")}</sw-button>
      <sw-button slot="footer" variant=${e.release?"primary":"danger"} data-door-block-ok ?disabled=${this.busy} @click=${()=>void this.confirm()}>${e.release?m("release"):m("reblock")}</sw-button>
    </sw-dialog>`:l}render(){if(this.error&&!this.data)return r`<sw-state-panel state="error" hint=${this.error} actionLabel=${m("retry")} data-door-blocks-state="error" @action=${()=>void this.load()}></sw-state-panel>`;if(!this.data)return r`<sw-state-panel state="loading" data-door-blocks-state="loading"></sw-state-panel>`;const e=this.data,t=za(e.entities,this.q,this.status),s=Ca(t,this.shown);return r`<sw-card heading=${m("title")} subheading=${m("sub")} data-door-blocks-card data-door-blocks-state="ready" style="margin-block-start: var(--sw-s-3)">
      ${this.error?r`<div class="err" role="alert">${this.error}</div>`:l}
      ${this.saved?r`<div class="sub" role="status" data-door-blocks-saved>${m("saved")}</div>`:l}
      <div class="sum" data-door-blocks-summary>${Pa(e)}${e.items.length?` · ${m("summaryItems",{blocked:e.counts.items_blocked})}`:""}</div>
      ${!e.wiskey_present&&!e.entities.length?r`<sw-state-panel icon="door" state="empty" heading=${m("none")} data-door-blocks-none></sw-state-panel>`:r`<h3>${m("entities")}</h3>
          <div class="tools">
            <input type="search" data-door-blocks-search placeholder=${m("search")} aria-label=${m("search")} .value=${this.q}
              @input=${i=>{this.q=i.target.value,this.shown=Re}} />
            <div class="chips" role="group" aria-label=${m("entities")}>
              ${$a.map(i=>r`<sw-chip data-door-blocks-filter=${i} ?selected=${this.status===i} @click=${()=>{this.status=i,this.shown=Re}}>${ka(i)}</sw-chip>`)}
            </div>
            <sw-button size="sm" variant="ghost" icon="refresh" data-door-blocks-refresh ?disabled=${this.busy} @click=${()=>void this.load()}>${m("refresh")}</sw-button>
          </div>
          ${s.rows.length?s.rows.map(i=>this.entityRow(i)):r`<sw-state-panel icon="door" state="empty" heading=${e.entities.length?m("noMatch"):m("noEntities")}></sw-state-panel>`}
          ${s.left?r`<sw-button class="more" size="sm" variant="ghost" data-door-blocks-more @click=${()=>{this.shown+=Re}}>${m("more",{n:s.left})}</sw-button>`:l}
          ${e.truncated?r`<div class="sub">${m("truncated")}</div>`:l}
          <h3>${m("items")}</h3>
          ${e.items.length?e.items.map(i=>this.itemRow(i)):r`<sw-state-panel icon="door" state="empty" heading=${m("noItems")}></sw-state-panel>`}`}
    </sw-card>${this.dialog()}`}};M.styles=[Ge,j`
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
      ${Vt}
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
    `,Tt];J([c()],M.prototype,"data",2);J([c()],M.prototype,"error",2);J([c()],M.prototype,"busy",2);J([c()],M.prototype,"q",2);J([c()],M.prototype,"status",2);J([c()],M.prototype,"shown",2);J([c()],M.prototype,"pending",2);J([c()],M.prototype,"note",2);J([c()],M.prototype,"problem",2);J([c()],M.prototype,"saved",2);M=J([N("sw-door-blocks")],M);var Da=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,ke=(e,t,s,i)=>{for(var a=i>1?void 0:i?Aa(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Da(t,s,a),a};const xe=[["doors.emergency.grant.default_hours","sGrantDefault",0],["doors.emergency.grant.max_hours","sGrantMax",1]],jt=[["doors.emergency.grant.by_security_manager","sGrantManager"],["doors.emergency.retry_open.by_holders","sRetryHolders"]],$t=[...xe.map(e=>e[0]),...jt.map(e=>e[0])];let ue=class extends E{constructor(){super(...arguments),this.saved=null,this.edit={},this.busy=!1,this.error="",this.done=!1}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{const e=(await Wt()).settings,t=Object.fromEntries($t.map(s=>[s,String(e[s]??"")]));this.saved=t,this.edit={...t}}catch{this.saved=null}}async save(){if(!this.saved)return;const e=Object.fromEntries(Object.entries(this.edit).filter(([t,s])=>this.saved[t]!==s));if(Object.keys(e).length){this.busy=!0,this.error="",this.done=!1;try{await Ft(e),await this.load(),this.done=!0}catch(t){this.error=w(t)}finally{this.busy=!1}}}render(){if(!this.saved)return l;const e=$t.some(s=>this.edit[s]!==this.saved[s]),t=xe.every(([s,,i])=>/^\d+$/.test(this.edit[s]??"")&&Number(this.edit[s])>=i&&Number(this.edit[s])<=8760)&&Number(this.edit[xe[0][0]])<=Number(this.edit[xe[1][0]]);return r`<sw-card heading=${be("sGrants")} data-emergency-open-settings>
      ${xe.map(([s,i])=>r`<div class="f"><label for=${s}>${be(i)}</label>
        <input id=${s} type="text" inputmode="numeric" data-eo-setting=${s} .value=${Ue(this.edit[s]??"")}
          @input=${a=>{this.edit={...this.edit,[s]:a.target.value.trim()},this.done=!1}}></div>`)}
      ${jt.map(([s,i])=>r`<div class="f"><span>${be(i)}</span>
        <sw-toggle label=${be(i)} labelHidden data-eo-switch=${s} .checked=${Ue(this.edit[s]==="on")}
          @change=${a=>{this.edit={...this.edit,[s]:a.detail.checked?"on":"off"},this.done=!1}}></sw-toggle></div>`)}
      <div class="bar"><sw-button variant="primary" data-eo-save ?disabled=${this.busy||!e||!t} @click=${()=>void this.save()}>${be("sSave")}</sw-button>
        ${this.done?r`<span>${be("saved")}</span>`:l}${this.error?r`<span class="err" role="alert">${this.error}</span>`:l}</div>
    </sw-card>`}};ue.styles=[Ge,j`
      :host { display: block; }
      .f { display: flex; align-items: center; justify-content: space-between; gap: var(--sw-s-3); flex-wrap: wrap; padding: var(--sw-s-2) 0; border-block-end: 1px solid var(--sw-border); }
      .f input { inline-size: 7em; box-sizing: border-box; min-block-size: 44px; font: inherit; color: var(--sw-text); background: var(--sw-surface);
        border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); padding: var(--sw-s-1) var(--sw-s-2); }
      .f input:focus-visible { outline: 2px solid var(--sw-focus); outline-offset: 1px; }
      .bar { display: flex; gap: var(--sw-s-2); align-items: center; padding-block-start: var(--sw-s-2); }
      .err { color: var(--sw-danger-text, var(--sw-text)); font-size: var(--sw-fs-sm); }
    `];ke([c()],ue.prototype,"saved",2);ke([c()],ue.prototype,"edit",2);ke([c()],ue.prototype,"busy",2);ke([c()],ue.prototype,"error",2);ke([c()],ue.prototype,"done",2);ue=ke([N("sw-emergency-open-settings")],ue);const me=j`
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
  .sup sw-toggle {
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
  /* CR-CMP2-SEGMENTED-C-2450: the panels' segmented choices (the config panel's zones / settings, the auto-profile mode) are
     sw-segmented; the pill track and the 32 px pill key with the extra-small medium label, the chosen key in the text ink, stay */
  sw-segmented {
    --sw-seg-pad: 3px;
    --sw-seg-gap: 2px;
    --sw-seg-radius: var(--sw-r-pill);
    --sw-seg-btn-radius: var(--sw-r-pill);
    --sw-seg-h: 32px;
    --sw-seg-key-pad: var(--sw-s-3);
    --sw-seg-fs: var(--sw-fs-xs);
    --sw-seg-fw: var(--sw-fw-medium);
    --sw-seg-on-fw: var(--sw-fw-medium);
    --sw-seg-on-fg: var(--sw-seg-key-ink, var(--sw-text));
    --sw-disabled-opacity: 0.6;
    /* CR-SEG-MODULE-LOOK-2470: the sw-segmented default is the module look now; this key keeps the old default values it used */
    --sw-seg-on-bg: var(--sw-seg-key, var(--sw-surface));
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
`;function Z(e,t,s,i,a="data-supervised"){if(!e||!e.can_supervise||e.done[t])return l;const n=u().control.settings.supervised;return r`<label class="sup" data-supervised-box=${a}><sw-toggle size="sm" labelHidden in-label label=${n.label} .checked=${s} @change=${p=>i($e(p))}></sw-toggle><span><b>${n.label}</b> · ${n.hint}</span></label>`}const oe=(e,t)=>!!e&&!e.done[t]&&!e.can_supervise;function le(e,t){if(e==null)return"—";const s=typeof e=="number"?new Date(e*1e3):new Date(e);if(Number.isNaN(s.getTime()))return"—";try{return Ut(s,{timeZone:t})}catch{return s.toISOString()}}function Ie(e){if(!e)return null;const t=Date.parse(e);return Number.isFinite(t)?Math.floor(t/1e3):null}function De(e){const t=new Date(e*1e3),s=i=>String(i).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())}T${s(t.getHours())}:${s(t.getMinutes())}`}var Ba=Object.defineProperty,ja=Object.getOwnPropertyDescriptor,re=(e,t,s,i)=>{for(var a=i>1?void 0:i?ja(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Ba(t,s,a),a};let U=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.canConfigure=!1,this.canProfile=!1,this.tz="",this.data=null,this.failed="",this.busy=!1,this.toaster=new ye(this,{ms:4e3}),this.applying=null}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(this.recorderId)try{this.data=await $s(this.recorderId),this.failed=""}catch(e){this.failed=w(e)}}flash(e,t){this.toaster.show(t,{tone:e})}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}async setting(e){if(this.data){this.busy=!0;try{const t=await ys(this.recorderId,e);this.data={...this.data,setting:t.setting},this.flash("ok",u().control.saved),this.changed(),this.load()}catch(t){this.flash("err",w(t)),this.load()}finally{this.busy=!1}}}async apply(){const e=this.applying;if(!(!e||this.busy)){this.busy=!0;try{const t=await ks(this.recorderId,e.item.id,e.supervised);this.applying=null,this.flash("ok",t.status==="applied"?u().control.settings.auto.applied:t.status==="skipped"?u().control.settings.auto.status.skipped:u().control.unverified),this.changed(),this.load()}catch(t){this.applying={...e,error:ge(t)?u().control.settings.supervised.need:w(t)}}finally{this.busy=!1}}}async dismiss(e){this.busy=!0;try{await xs(this.recorderId,e.id),this.flash("ok",u().control.settings.auto.dismissed),this.load()}catch(t){this.flash("err",w(t))}finally{this.busy=!1}}statusLine(){const e=u().control.settings.auto,t=this.data.setting;if(t.mode==="off")return r`<span class="chip" data-auto-status="off">${e.offText}</span>`;if(t.mode==="suggest")return r`<span class="chip accent" data-auto-status="suggest">${e.suggestOnly}</span>`;if(t.will_apply)return r`<span class="chip ok" data-auto-status="apply">${e.willApply}</span>`;const s=[t.profile_class_on?null:e.blockedClass,t.auto_apply_consent?null:e.blockedConsent,t.first_write_done?null:e.blockedFirst].filter(Boolean);return r`<span class="chip warn" data-auto-status="blocked">${e.suggestOnly} · ${s.join(" · ")}</span>`}itemLine(e){const t=u().control.settings.auto;return r`<b>${Ke(e.alarm_state)}</b> <span class="muted">${t.arrow}</span><b>${e.profile==="none"?t.profileNone:e.profile}</b>`}applyDialog(){const e=this.applying;if(!e)return l;const t=u().control.settings.auto,s=u().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.profile_auto;return r`<sw-dialog open heading=${t.confirmApply} data-auto-confirm @close=${()=>this.applying=null}>
      <div class="form">
        <p class="dialog-text">${this.itemLine(e.item)} · ${s.confirmProfile}</p>
        ${Z(this.first,"profile_auto",e.supervised,a=>this.applying={...e,supervised:a},"profile_auto")}
        ${e.error?r`<div class="err" role="alert" data-auto-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.applying=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-auto-apply-ok ?disabled=${this.busy||i&&!e.supervised} @click=${()=>void this.apply()}>${s.confirm}</sw-button>
    </sw-dialog>`}render(){const e=u().control.settings.auto,t=u().control.settings;if(this.failed)return r`<div class="panel" data-frigate-auto><div class="msg err" data-auto-failed>${this.failed}</div></div>`;const s=this.data;if(!s)return l;const i=s.setting,a=s.items.filter(d=>d.status==="suggested"||d.status==="pending"),n=s.items.filter(d=>d.status!=="suggested"&&d.status!=="pending").slice(0,8),p=this.busy||!this.canConfigure;return r`<div class="panel" data-frigate-auto>
      <div class="head"><h4>${e.title}</h4>${this.statusLine()}</div>
      <div class="row">
        <span class="name"><span>${e.mode}</span></span>
        <sw-segmented label=${e.mode} data-auto-modes value=${i.mode}
          @change=${d=>{const $=lt.find(D=>D===d.detail.value);$&&i.mode!==$&&this.setting({mode:$})}}
          .options=${lt.map(d=>({value:d,label:e.modes[d],disabled:p||d==="apply"&&!i.auto_apply_consent,title:d==="apply"&&!i.auto_apply_consent?e.blockedConsent:"",attrs:{"data-auto-mode":d}}))}></sw-segmented>
      </div>
      <div class="row">
        <span class="name"><span>${e.consent}</span>${i.auto_apply_consent&&i.consent_at?r`<span class="sub" data-auto-consent-by>${e.consentBy} · ${le(i.consent_at,this.tz||void 0)}</span>`:l}</span>
        <sw-toggle controlled .checked=${i.auto_apply_consent} ?disabled=${p} labelHidden label=${e.consent} data-auto-consent @change=${d=>void this.setting({auto_apply_consent:$e(d)})}></sw-toggle>
      </div>
      <h5>${e.suggestions}</h5>
      ${a.length?r`<div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) 110px 150px">
            ${a.map(d=>r`<div class="r" role="row" data-auto-item=${d.id}>
              <div class="c main" role="cell">${this.itemLine(d)}</div>
              <div class="c sub ltr muted" role="cell">${le(d.at,this.tz||void 0)}</div>
              <div class="c acts" role="cell">
                ${this.canProfile?r`<sw-button size="sm" variant="primary" data-auto-apply ?disabled=${this.busy} @click=${()=>this.applying={item:d,supervised:!1,error:""}}>${e.apply}</sw-button>
                  <sw-button size="sm" variant="ghost" data-auto-dismiss ?disabled=${this.busy} @click=${()=>void this.dismiss(d)}>${e.dismiss}</sw-button>`:l}
              </div>
            </div>`)}
          </div>`:r`<div class="tbl"><div class="empty" data-auto-empty>${e.noSuggestions}</div></div>`}
      ${n.length?r`<h5>${e.recent}</h5>
          <div class="tbl" role="table" style="--cols: minmax(160px, 1.6fr) minmax(120px, 1fr) 110px" data-auto-recent>
            ${n.map(d=>r`<div class="r" role="row" data-auto-recent-item=${d.id}>
              <div class="c main" role="cell">${this.itemLine(d)}</div>
              <div class="c sub" role="cell"><span class=${`chip ${d.status==="applied"?"ok":d.status==="failed"?"bad":""}`}>${e.status[d.status]??d.status}</span>${d.reason&&e.reason[d.reason]?r` <span class="muted">${e.reason[d.reason]}</span>`:l}</div>
              <div class="c ltr muted" role="cell">${le(d.at,this.tz||void 0)}</div>
            </div>`)}
          </div>`:l}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-auto-msg>${this.msg.text}</div>`:l}
      ${this.first&&!this.first.done.profile_auto&&i.mode!=="off"?r`<p class="note" data-auto-first-note>${t.kinds.profile_auto}: ${t.firstPending}</p>`:l}
      ${this.applyDialog()}
    </div>`}};U.styles=me;re([y({attribute:"recorder-id"})],U.prototype,"recorderId",2);re([y({attribute:!1})],U.prototype,"first",2);re([y({type:Boolean})],U.prototype,"canConfigure",2);re([y({type:Boolean})],U.prototype,"canProfile",2);re([y()],U.prototype,"tz",2);re([c()],U.prototype,"data",2);re([c()],U.prototype,"failed",2);re([c()],U.prototype,"busy",2);re([c()],U.prototype,"applying",2);U=re([N("frigate-auto-profile")],U);var La=Object.defineProperty,Ma=Object.getOwnPropertyDescriptor,L=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ma(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&La(t,s,a),a};let T=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.toaster=new ye(this,{ms:4e3}),this.draft=null,this.renaming=null,this.deleting=null,this.moving=null}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await _s(this.recorderId);this.rows=e.exports,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=w(e),this.rows=[]}}flash(e,t){this.toaster.show(t,{tone:e})}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return ge(e)?u().control.settings.supervised.need:w(e)}openCreate(){const e=Math.floor(Date.now()/1e3),t=this.cams.find(s=>s.enabled&&s.frigate_enabled!==!1)??this.cams[0];this.draft={camera:t?.id??"",start:De(e-600),end:De(e),name:"",supervised:!1,error:""}}async submitCreate(){const e=this.draft;if(!e||this.busy)return;const t=u().control.settings.exports,s=Ie(e.start),i=Ie(e.end),a=Os(s,i);if(!e.camera)return void(this.draft={...e,error:t.chooseCamera});if(a)return void(this.draft={...e,error:a==="missing"?t.rangeMissing:a==="order"?t.rangeOrder:a==="long"?t.rangeLong:t.rangeFuture});if(!e.name.trim())return void(this.draft={...e,error:`${t.name}?`});this.busy=!0;try{const n=await zs(this.recorderId,{camera_id:e.camera,start:s,end:i,name:e.name.trim(),...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",n.verified?t.created:u().control.unverified),this.changed()}catch(n){this.draft={...e,error:this.refusal(n)}}finally{this.busy=!1}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Cs(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?u().control.settings.exports.renamed:u().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!Pe(e.typed,e.row.name))){this.busy=!0;try{const t=await Ss(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?u().control.settings.exports.deleted:u().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async openMove(e){this.moving={row:e,caseId:e.case_id??"",cases:null,supervised:!1,error:""};try{const t=await It(this.recorderId);this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:t.cases})}catch(t){this.moving?.row.id===e.id&&(this.moving={...this.moving,cases:[],error:w(t)})}}async confirmMove(){const e=this.moving;if(!(!e||this.busy)){this.busy=!0;try{const t=await Rs(this.recorderId,e.row.id,e.caseId||null,e.supervised);this.moving=null,this.flash("ok",t.verified?u().control.settings.exports.moved:u().control.unverified),this.changed()}catch(t){this.moving={...e,error:this.refusal(t)}}finally{this.busy=!1}}}moveDialog(){const e=this.moving;if(!e)return l;const t=u().control.settings.exports,s=u().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.export_assign,a=[{id:"",label:t.noCase},...(e.cases??[]).map(n=>({id:n.id,label:n.name||n.id}))];return r`<sw-dialog open heading=${t.moveToCase} subheading=${e.row.name} data-fx-move @close=${()=>this.moving=null}>
      <div class="form">
        <label>${t.case}<sw-dropdown block data-fx-case .label=${t.case} .value=${e.caseId} .items=${a} ?disabled=${e.cases===null}
          @change=${n=>this.moving={...e,caseId:n.detail.id}}></sw-dropdown></label>
        ${Z(this.first,"export_assign",e.supervised,n=>this.moving={...e,supervised:n},"export_assign")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.moving=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fx-move-ok ?disabled=${this.busy||e.cases===null||e.caseId===(e.row.case_id??"")||i&&!e.supervised}
        @click=${()=>void this.confirmMove()}>${s.confirm}</sw-button>
    </sw-dialog>`}camName(e,t){return this.cams.find(s=>s.id===e)?.name??t??e}createDialog(){const e=this.draft;if(!e)return l;const t=u().control.settings.exports,s=u().control,i=this.cams.filter(n=>n.enabled).map(n=>({id:n.id,label:n.name})),a=!!this.first&&this.first.can_supervise&&!this.first.done.export_create;return r`<sw-dialog open heading=${t.create} data-fx-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.camera}<sw-dropdown block data-fx-camera .label=${t.camera} .placeholder=${t.chooseCamera} .value=${e.camera} .items=${i} @change=${n=>this.draft={...e,camera:n.detail.id}}></sw-dropdown></label>
        <div class="two">
          <label>${t.from}<input type="datetime-local" lang=${Ne()} data-fx-start .value=${e.start} @input=${n=>this.draft={...e,start:n.target.value}} /></label>
          <label>${t.to}<input type="datetime-local" lang=${Ne()} data-fx-end .value=${e.end} @input=${n=>this.draft={...e,end:n.target.value}} /></label>
        </div>
        <label>${t.name}<input type="text" maxlength="80" data-fx-name .value=${e.name} @input=${n=>this.draft={...e,name:n.target.value}} /></label>
        ${Z(this.first,"export_create",e.supervised,n=>this.draft={...e,supervised:n},"export_create")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="download" data-fx-create-ok ?disabled=${this.busy||a&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return l;const t=u().control.settings.exports,s=u().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.export_delete;return r`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fx-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${t.deleteText}</p>
        <input type="text" data-fx-delete-typed aria-label=${t.name} .value=${e.typed} @input=${a=>this.deleting={...e,typed:a.target.value}} />
        ${Z(this.first,"export_delete",e.supervised,a=>this.deleting={...e,supervised:a},"export_delete")}
        ${e.error?r`<div class="err" role="alert" data-fx-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fx-delete-ok ?disabled=${this.busy||!Pe(e.typed,e.row.name)||i&&!e.supervised} @click=${()=>void this.confirmDelete()}>${t.delete}</sw-button>
    </sw-dialog>`}row(e){const t=u().control.settings.exports,s=u().control,i=this.renaming?.id===e.id?this.renaming:null,a=this.enabled&&e.arx_created;return r`<div class="r" role="row" data-fx-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${i?r`<span class="inline"><input type="text" maxlength="80" data-fx-rename-input aria-label=${t.name} .value=${i.name} ?disabled=${this.busy}
                @input=${n=>this.renaming={...i,name:n.target.value}}
                @keydown=${n=>{n.key==="Enter"&&this.saveRename(),n.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${s.confirm} data-fx-rename-save ?disabled=${this.busy||!i.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${s.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:r`<b title=${e.name}>${e.name||e.id}</b>`}
        ${i?Z(this.first,"export_rename",i.supervised,n=>this.renaming={...i,supervised:n},"export_rename"):l}
      </div>
      <div class="c sub muted" role="cell">${e.in_progress?r`<span class="chip warn fold" data-fx-fold-state>${t.inProgress}</span>`:l}${e.arx_created?l:r`<span class="fold" data-fx-fold-origin>${t.foreign} ·&nbsp;</span>`}${this.camName(e.camera_id,e.camera)} · ${le(e.date,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${le(e.date,this.tz||void 0)}</div>
      <div class="c" role="cell"><span class=${`chip ${e.in_progress?"warn":"ok"}`} data-fx-state=${e.in_progress?"progress":"ready"}>${e.in_progress?t.inProgress:t.ready}</span></div>
      <div class="c muted" role="cell">${e.arx_created?t.arx:t.foreign}</div>
      <div class="c acts" role="cell">
        ${a&&!i?r`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${t.rename} data-fx-rename ?disabled=${this.busy||oe(this.first,"export_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:l}
        ${a&&!e.in_progress?r`<sw-button size="sm" variant="ghost" iconOnly icon="case" label=${t.moveToCase} data-fx-move-btn ?disabled=${this.busy||oe(this.first,"export_assign")} @click=${()=>void this.openMove(e)}></sw-button>`:l}
        ${a?r`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${t.delete} data-fx-delete-btn ?disabled=${this.busy||oe(this.first,"export_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:l}
      </div>
    </div>`}render(){if(!this.allowed)return l;const e=u().control.settings.exports,t=u().control.settings,s=this.rows,i=this.enabled&&!oe(this.first,"export_create")&&this.cams.length>0;return r`<div class="panel" data-frigate-exports>
      <div class="head">
        <h4>${t.tabs.exports}</h4>
        <span class="inline">
          ${this.enabled?l:r`<span class="chip warn" data-fx-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.export_create?r`<span class="chip" data-fx-first-pending>${t.firstPending}</span>`:l}
          <sw-button size="sm" variant="primary" icon="plus" data-fx-new ?disabled=${!i} @click=${()=>this.openCreate()}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?r`<div class="msg err" role="alert" data-fx-failed>${this.failed}</div>`:l}
      ${s===null?l:s.length?r`<div class="tbl" role="table" style="--cols: minmax(140px, 1.6fr) minmax(90px, 1fr) 110px 88px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.camera}</span><span>${e.date}</span><span>${e.state}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:r`<div class="tbl"><div class="empty" data-fx-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fx-msg>${this.msg.text}</div>`:l}
      ${this.createDialog()}
      ${this.deleteDialog()}
      ${this.moveDialog()}
    </div>`}};T.styles=me;L([y({attribute:"recorder-id"})],T.prototype,"recorderId",2);L([y({attribute:!1})],T.prototype,"first",2);L([y({attribute:!1})],T.prototype,"cams",2);L([y({type:Boolean})],T.prototype,"allowed",2);L([y()],T.prototype,"tz",2);L([c()],T.prototype,"rows",2);L([c()],T.prototype,"enabled",2);L([c()],T.prototype,"failed",2);L([c()],T.prototype,"busy",2);L([c()],T.prototype,"draft",2);L([c()],T.prototype,"renaming",2);L([c()],T.prototype,"deleting",2);L([c()],T.prototype,"moving",2);T=L([N("frigate-exports-panel")],T);var Va=Object.defineProperty,Wa=Object.getOwnPropertyDescriptor,H=(e,t,s,i)=>{for(var a=i>1?void 0:i?Wa(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Va(t,s,a),a};let A=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.allowed=!1,this.tz="",this.rows=null,this.enabled=!1,this.failed="",this.busy=!1,this.toaster=new ye(this,{ms:4e3}),this.draft=null,this.renaming=null,this.deleting=null}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),this.load()}updated(e){e.has("recorderId")&&e.get("recorderId")!==void 0&&this.load()}async load(){if(!(!this.recorderId||!this.allowed))try{const e=await It(this.recorderId);this.rows=e.cases,this.enabled=e.enabled,this.failed=""}catch(e){this.failed=w(e),this.rows=[]}}flash(e,t){this.toaster.show(t,{tone:e})}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),this.load()}refusal(e){return ge(e)?u().control.settings.supervised.need:w(e)}async submitCreate(){const e=this.draft;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Es(this.recorderId,{name:e.name.trim(),description:e.description.trim()||null,...e.supervised?{supervised:!0}:{}});this.draft=null,this.flash("ok",t.verified?u().control.settings.cases.created:u().control.unverified),this.changed()}catch(t){this.draft={...e,error:this.refusal(t)}}finally{this.busy=!1}}}async saveRename(){const e=this.renaming;if(!(!e||this.busy||!e.name.trim())){this.busy=!0;try{const t=await Ns(this.recorderId,e.id,e.name.trim(),e.supervised);this.renaming=null,this.flash("ok",t.verified?u().control.settings.cases.renamed:u().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}}async confirmDelete(){const e=this.deleting;if(!(!e||this.busy||!Pe(e.typed,e.row.name))){this.busy=!0;try{const t=await Ps(this.recorderId,e.row.id,e.supervised);this.deleting=null,this.flash("ok",t.verified?u().control.settings.cases.deleted:u().control.unverified),this.changed()}catch(t){this.deleting={...e,error:this.refusal(t)}}finally{this.busy=!1}}}createDialog(){const e=this.draft;if(!e)return l;const t=u().control.settings.cases,s=u().control,i=!!this.first&&this.first.can_supervise&&!this.first.done.case_create;return r`<sw-dialog open heading=${t.create} data-fc-create @close=${()=>this.draft=null}>
      <div class="form">
        <label>${t.name}<input type="text" maxlength="80" data-fc-name .value=${e.name} @input=${a=>this.draft={...e,name:a.target.value}} /></label>
        <label>${t.description}<input type="text" maxlength="200" data-fc-description .value=${e.description} @input=${a=>this.draft={...e,description:a.target.value}} /></label>
        ${Z(this.first,"case_create",e.supervised,a=>this.draft={...e,supervised:a},"case_create")}
        ${e.error?r`<div class="err" role="alert" data-fc-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.draft=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" icon="case" data-fc-create-ok ?disabled=${this.busy||!e.name.trim()||i&&!e.supervised} @click=${()=>void this.submitCreate()}>${t.create}</sw-button>
    </sw-dialog>`}deleteDialog(){const e=this.deleting;if(!e)return l;const t=u().control.settings.cases,s=u().control.settings.exports,i=u().control,a=!!this.first&&this.first.can_supervise&&!this.first.done.case_delete;return r`<sw-dialog open heading=${t.deleteTitle} subheading=${e.row.name} data-fc-delete @close=${()=>this.deleting=null}>
      <div class="form">
        <p class="dialog-text">${s.deleteText}</p>
        <input type="text" data-fc-delete-typed aria-label=${t.name} .value=${e.typed} @input=${n=>this.deleting={...e,typed:n.target.value}} />
        ${Z(this.first,"case_delete",e.supervised,n=>this.deleting={...e,supervised:n},"case_delete")}
        ${e.error?r`<div class="err" role="alert" data-fc-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.deleting=null}>${i.cancel}</sw-button>
      <sw-button slot="footer" variant="danger" icon="trash" data-fc-delete-ok ?disabled=${this.busy||!Pe(e.typed,e.row.name)||a&&!e.supervised} @click=${()=>void this.confirmDelete()}>${s.delete}</sw-button>
    </sw-dialog>`}row(e){const t=u().control.settings.cases,s=u().control.settings.exports,i=u().control,a=this.renaming?.id===e.id?this.renaming:null,n=this.enabled&&e.arx_created;return r`<div class="r" role="row" data-fc-row=${e.id} data-arx=${String(e.arx_created)}>
      <div class="c main" role="cell">
        ${a?r`<span class="inline"><input type="text" maxlength="80" data-fc-rename-input aria-label=${t.name} .value=${a.name} ?disabled=${this.busy}
                @input=${p=>this.renaming={...a,name:p.target.value}}
                @keydown=${p=>{p.key==="Enter"&&this.saveRename(),p.key==="Escape"&&(this.renaming=null)}} />
              <sw-button size="sm" variant="primary" iconOnly icon="check" label=${i.confirm} data-fc-rename-save ?disabled=${this.busy||!a.name.trim()} @click=${()=>void this.saveRename()}></sw-button>
              <sw-button size="sm" variant="ghost" iconOnly icon="close" label=${i.cancel} @click=${()=>this.renaming=null}></sw-button></span>`:r`<b title=${e.name}>${e.name||e.id}</b>`}
        ${a?Z(this.first,"case_rename",a.supervised,p=>this.renaming={...a,supervised:p},"case_rename"):l}
      </div>
      <div class="c sub muted" role="cell" title=${e.description}>${e.arx_created?l:r`<span class="fold" data-fc-fold-origin>${s.foreign} ·&nbsp;</span>`}${e.description||le(e.created_at,this.tz||void 0)}</div>
      <div class="c ltr muted" role="cell">${le(e.created_at,this.tz||void 0)}</div>
      <div class="c muted" role="cell">${e.arx_created?s.arx:s.foreign}</div>
      <div class="c acts" role="cell">
        ${n&&!a?r`<sw-button size="sm" variant="ghost" iconOnly icon="edit" label=${s.rename} data-fc-rename ?disabled=${this.busy||oe(this.first,"case_rename")} @click=${()=>this.renaming={id:e.id,name:e.name,supervised:!1}}></sw-button>`:l}
        ${n?r`<sw-button size="sm" variant="ghost" iconOnly icon="trash" label=${s.delete} data-fc-delete-btn ?disabled=${this.busy||oe(this.first,"case_delete")} @click=${()=>this.deleting={row:e,typed:"",supervised:!1,error:""}}></sw-button>`:l}
      </div>
    </div>`}render(){if(!this.allowed)return l;const e=u().control.settings.cases,t=u().control.settings,s=this.rows,i=this.enabled&&!oe(this.first,"case_create");return r`<div class="panel" data-frigate-cases>
      <div class="head">
        <h4>${t.tabs.cases}</h4>
        <span class="inline">
          ${this.enabled?l:r`<span class="chip warn" data-fc-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.case_create?r`<span class="chip" data-fc-first-pending>${t.firstPending}</span>`:l}
          <sw-button size="sm" variant="primary" icon="plus" data-fc-new ?disabled=${!i} @click=${()=>this.draft={name:"",description:"",supervised:!1,error:""}}>${e.create}</sw-button>
        </span>
      </div>
      ${this.failed?r`<div class="msg err" role="alert" data-fc-failed>${this.failed}</div>`:l}
      ${s===null?l:s.length?r`<div class="tbl" role="table" style="--cols: minmax(140px, 1.4fr) minmax(120px, 1.6fr) 110px 70px 88px">
              <div class="h" role="row"><span>${e.name}</span><span>${e.description}</span><span>${e.createdAt}</span><span>${e.origin}</span><span></span></div>
              ${s.map(a=>this.row(a))}
            </div>`:r`<div class="tbl"><div class="empty" data-fc-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fc-msg>${this.msg.text}</div>`:l}
      ${this.createDialog()}
      ${this.deleteDialog()}
    </div>`}};A.styles=me;H([y({attribute:"recorder-id"})],A.prototype,"recorderId",2);H([y({attribute:!1})],A.prototype,"first",2);H([y({type:Boolean})],A.prototype,"allowed",2);H([y()],A.prototype,"tz",2);H([c()],A.prototype,"rows",2);H([c()],A.prototype,"enabled",2);H([c()],A.prototype,"failed",2);H([c()],A.prototype,"busy",2);H([c()],A.prototype,"draft",2);H([c()],A.prototype,"renaming",2);H([c()],A.prototype,"deleting",2);A=H([N("frigate-cases-panel")],A);var Fa=Object.defineProperty,Ua=Object.getOwnPropertyDescriptor,P=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ua(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Fa(t,s,a),a};let C=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.changes=[],this.enabled=!1,this.allowed=!1,this.tz="",this.camera="",this.label="",this.subLabel="",this.duration="30",this.openEnded=!1,this.supervised=!1,this.endSupervised=!1,this.busy=!1,this.error="",this.toaster=new ye(this,{ms:4e3})}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}flash(e,t){this.toaster.show(t,{tone:e})}changed(){this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0}))}refusal(e){return ge(e)?u().control.settings.supervised.need:w(e)}async create(){const e=u().control.settings.events,t=this.camera||this.cams.find(i=>i.enabled)?.id||"",s=this.openEnded?null:Number(this.duration);if(!t)return void(this.error=u().control.settings.exports.chooseCamera);if(!this.label.trim())return void(this.error=e.labelError);if(s!==null&&(!Number.isInteger(s)||s<1||s>dt))return void(this.error=e.durationError);this.busy=!0,this.error="";try{const i=await Ts(this.recorderId,t,{label:this.label.trim(),duration_s:s,sub_label:this.subLabel.trim()||null,...this.supervised?{supervised:!0}:{}});this.label="",this.subLabel="",this.flash("ok",i.verified?e.created:u().control.unverified),this.changed()}catch(i){this.error=this.refusal(i)}finally{this.busy=!1}}async end(e){this.busy=!0;try{const t=await Is(this.recorderId,e,this.endSupervised);this.flash("ok",t.verified?u().control.settings.events.ended:u().control.unverified),this.changed()}catch(t){this.flash("err",this.refusal(t))}finally{this.busy=!1}}camName(e){return this.cams.find(t=>t.id===e)?.name??e??""}render(){if(!this.allowed)return l;const e=u().control.settings.events,t=u().control.settings,s=this.cams.filter(d=>d.enabled).map(d=>({id:d.id,label:d.name})),i=this.camera||s[0]?.id||"",a=!!this.first&&this.first.can_supervise&&!this.first.done.event_create,n=this.enabled&&!oe(this.first,"event_create")&&s.length>0,p=Ds(this.changes);return r`<div class="panel" data-frigate-events>
      <div class="head">
        <h4>${e.create}</h4>
        <span class="inline">
          ${this.enabled?l:r`<span class="chip warn" data-fe-off>${t.classOff}</span>`}
          ${this.first&&!this.first.done.event_create?r`<span class="chip" data-fe-first-pending>${t.firstPending}</span>`:l}
        </span>
      </div>
      <div class="form" data-fe-form>
        <div class="two">
          <label>${e.camera}<sw-dropdown block data-fe-camera .label=${e.camera} .placeholder=${e.camera} .value=${i} .items=${s} @change=${d=>this.camera=d.detail.id}></sw-dropdown></label>
          <label>${e.label}<input type="text" maxlength="40" data-fe-label .value=${this.label} ?disabled=${!n} @input=${d=>this.label=d.target.value} /></label>
        </div>
        <div class="two">
          <label>${e.subLabel}<input type="text" maxlength="60" data-fe-sub-label .value=${this.subLabel} ?disabled=${!n} @input=${d=>this.subLabel=d.target.value} /></label>
          <label>${e.duration}<input type="number" min="1" max=${dt} step="1" data-fe-duration .value=${this.duration} ?disabled=${!n||this.openEnded} @input=${d=>this.duration=d.target.value} /></label>
        </div>
        <label class="row"><sw-toggle size="sm" labelHidden in-label label=${e.openEnded} data-fe-open .checked=${this.openEnded} ?disabled=${!n} @change=${d=>this.openEnded=$e(d)}></sw-toggle><span>${e.openEnded}</span></label>
        ${Z(this.first,"event_create",this.supervised,d=>this.supervised=d,"event_create")}
        ${this.error?r`<div class="err" role="alert" data-fe-error>${this.error}</div>`:l}
        <div class="inline"><sw-button size="sm" variant="primary" icon="plus" data-fe-create ?disabled=${this.busy||!n||a&&!this.supervised} @click=${()=>void this.create()}>${e.create}</sw-button></div>
      </div>
      <h5>${e.openList}</h5>
      ${p.length?r`<div class="tbl" role="table" style="--cols: minmax(120px, 1.4fr) minmax(100px, 1fr) 110px 110px 80px">
            <div class="h" role="row"><span>${e.label}</span><span>${e.camera}</span><span>${u().review.time}</span><span>${u().control.settings.by}</span><span></span></div>
            ${p.map(d=>r`<div class="r" role="row" data-fe-open-row=${d.id}>
              <div class="c main" role="cell"><b>${d.label}</b>${d.sub_label?r` <span class="muted">· ${d.sub_label}</span>`:l}${d.status==="unverified"?r` <span class="chip warn">${t.unverified}</span>`:l}</div>
              <div class="c sub muted" role="cell">${this.camName(d.camera_id)} · ${le(d.at,this.tz||void 0)}</div>
              <div class="c ltr muted" role="cell">${le(d.at,this.tz||void 0)}</div>
              <div class="c muted" role="cell">${d.actor??""}</div>
              <div class="c acts" role="cell"><sw-button size="sm" icon="stopSquare" data-fe-end ?disabled=${this.busy||!this.enabled||oe(this.first,"event_end")} @click=${()=>void this.end(d.id)}>${e.end}</sw-button></div>
            </div>`)}
          </div>
          ${Z(this.first,"event_end",this.endSupervised,d=>this.endSupervised=d,"event_end")}`:r`<div class="tbl"><div class="empty" data-fe-empty>${e.empty}</div></div>`}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fe-msg>${this.msg.text}</div>`:l}
    </div>`}};C.styles=me;P([y({attribute:"recorder-id"})],C.prototype,"recorderId",2);P([y({attribute:!1})],C.prototype,"first",2);P([y({attribute:!1})],C.prototype,"cams",2);P([y({attribute:!1})],C.prototype,"changes",2);P([y({type:Boolean})],C.prototype,"enabled",2);P([y({type:Boolean})],C.prototype,"allowed",2);P([y()],C.prototype,"tz",2);P([c()],C.prototype,"camera",2);P([c()],C.prototype,"label",2);P([c()],C.prototype,"subLabel",2);P([c()],C.prototype,"duration",2);P([c()],C.prototype,"openEnded",2);P([c()],C.prototype,"supervised",2);P([c()],C.prototype,"endSupervised",2);P([c()],C.prototype,"busy",2);P([c()],C.prototype,"error",2);C=P([N("frigate-manual-events")],C);var Ka=Object.defineProperty,qa=Object.getOwnPropertyDescriptor,ee=(e,t,s,i)=>{for(var a=i>1?void 0:i?qa(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Ka(t,s,a),a};let V=class extends E{constructor(){super(...arguments),this.recorderId="",this.first=null,this.cams=[],this.canPlayback=!1,this.camera="",this.start=De(Math.floor(Date.now()/1e3)-600),this.end=De(Math.floor(Date.now()/1e3)),this.supervised=!1,this.error="",this.viewer=null}clipAddress(){const e=u().control.settings.supervision,t=Ie(this.start),s=Ie(this.end),i=this.camera||this.cams.find(a=>a.enabled)?.id||"";return i?t==null||s==null||s<=t||s-t>As||s>Date.now()/1e3+60?(this.error=e.clipRangeError,null):(this.error="",Bs(this.recorderId,i,t,s,this.supervised)):(this.error=u().control.settings.exports.chooseCamera,null)}openClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),window.open(e,"_blank","noopener"))}playClip(){const e=this.clipAddress();e&&(this.dispatchEvent(new CustomEvent("frigate-clip-open",{detail:{url:e},bubbles:!0,composed:!0})),this.viewer={url:e,state:"loading"})}viewerDialog(){const e=this.viewer;if(!e)return l;const t=u().control.settings.supervision,s=this.cams.find(i=>i.id===(this.camera||this.cams.find(a=>a.enabled)?.id))?.name??"";return r`<sw-dialog open wide heading=${t.clipTitle} subheading=${s} data-fs-viewer @close=${()=>this.viewer=null}>
      <div class="clip" data-state=${e.state} data-fs-clip-state=${e.state}>
        <video controls playsinline preload="metadata" src=${e.url} data-fs-video
          @loadeddata=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"ready"}:this.viewer}
          @error=${()=>this.viewer=e.url===this.viewer?.url?{url:e.url,state:"error"}:this.viewer}></video>
        <div class="state">${e.state==="error"?r`<sw-icon name="warning" size="18"></sw-icon>${t.clipError}`:r`<sw-icon class="spin" name="clock" size="18"></sw-icon>${t.clipLoading}`}</div>
      </div>
      <sw-button slot="footer" variant="ghost" icon="share" data-fs-viewer-tab @click=${()=>window.open(e.url,"_blank","noopener")}>${t.openTab}</sw-button>
      <sw-button slot="footer" data-fs-viewer-close @click=${()=>this.viewer=null}>${t.close}</sw-button>
    </sw-dialog>`}render(){const e=u().control.settings.supervision,t=u().control.settings,s=this.first,i=this.cams.filter(d=>d.enabled).map(d=>({id:d.id,label:d.name})),a=this.camera||i[0]?.id||"",n=!!s&&s.can_supervise&&!s.done.clip_read,p=!!s&&!s.done.clip_read&&!s.can_supervise;return r`<div class="panel" data-frigate-supervision>
      <div class="head"><h4>${e.title}</h4></div>
      <p class="note">${e.intro}</p>
      ${s?r`<div class="tbl" role="table" style="--cols: minmax(160px, 1fr) 110px" data-fs-kinds>
            ${js.map(d=>r`<div class="r" role="row" data-fs-kind=${d} data-done=${String(!!s.done[d])}>
              <div class="c main" role="cell">${t.kinds[d]}</div>
              <div class="c acts" role="cell"><span class=${`chip ${s.done[d]?"ok":""}`}>${s.done[d]?e.done:e.pending}</span></div>
            </div>`)}
          </div>`:r`<div class="msg err" data-fs-failed>${t.unavailable}</div>`}
      ${this.canPlayback&&i.length?r`<h5>${e.clipTitle}</h5>
          <p class="note">${e.clipText}</p>
          <div class="form" data-fs-clip>
            <label>${t.exports.camera}<sw-dropdown block data-fs-camera .label=${t.exports.camera} .placeholder=${t.exports.camera} .value=${a} .items=${i} @change=${d=>this.camera=d.detail.id}></sw-dropdown></label>
            <div class="two">
              <label>${t.exports.from}<input type="datetime-local" lang=${Ne()} data-fs-start .value=${this.start} @input=${d=>this.start=d.target.value} /></label>
              <label>${t.exports.to}<input type="datetime-local" lang=${Ne()} data-fs-end .value=${this.end} @input=${d=>this.end=d.target.value} /></label>
            </div>
            ${Z(s,"clip_read",this.supervised,d=>this.supervised=d,"clip_read")}
            ${this.error?r`<div class="err" role="alert" data-fs-error>${this.error}</div>`:l}
            <div class="inline">
              <sw-button size="sm" variant="primary" icon="play" data-fs-play ?disabled=${p||n&&!this.supervised} @click=${()=>this.playClip()}>${e.play}</sw-button>
              <sw-button size="sm" variant="ghost" icon="share" data-fs-open ?disabled=${p||n&&!this.supervised} @click=${()=>this.openClip()}>${e.openTab}</sw-button>
            </div>
          </div>`:l}
      ${this.viewerDialog()}
    </div>`}};V.styles=[me,j`
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
  `];ee([y({attribute:"recorder-id"})],V.prototype,"recorderId",2);ee([y({attribute:!1})],V.prototype,"first",2);ee([y({attribute:!1})],V.prototype,"cams",2);ee([y({type:Boolean})],V.prototype,"canPlayback",2);ee([c()],V.prototype,"camera",2);ee([c()],V.prototype,"start",2);ee([c()],V.prototype,"end",2);ee([c()],V.prototype,"supervised",2);ee([c()],V.prototype,"error",2);ee([c()],V.prototype,"viewer",2);V=ee([N("frigate-supervision")],V);var Ha=Object.defineProperty,Ga=Object.getOwnPropertyDescriptor,fe=(e,t,s,i)=>{for(var a=i>1?void 0:i?Ga(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Ha(t,s,a),a};let ie=class extends E{constructor(){super(...arguments),this.src=null,this.aspect=16/9,this.zones=[],this.selected=null,this.points=[],this.editing=!1,this.broken=!1,this.drag=null,this.swallowClick=!1}rect(){return this.renderRoot.querySelector(".stage").getBoundingClientRect()}emit(e){this.dispatchEvent(new CustomEvent("zone-points",{detail:{points:e},bubbles:!0,composed:!0}))}onStageClick(e){if(this.swallowClick){this.swallowClick=!1;return}!this.editing||e.target.closest(".h, .m")||this.points.length>=40||this.emit([...this.points,ct(e.clientX,e.clientY,this.rect())])}onDown(e,t){this.editing&&(t.stopPropagation(),t.preventDefault(),t.currentTarget.setPointerCapture(t.pointerId),this.drag={index:e,id:t.pointerId})}mid(e){const t=this.points[e],s=this.points[(e+1)%this.points.length],i=a=>Math.round(a*1e4)/1e4;return[i((t[0]+s[0])/2),i((t[1]+s[1])/2)]}insertAt(e,t){if(!this.editing||this.points.length>=40)return;const s=[...this.points.slice(0,e+1),this.mid(e),...this.points.slice(e+1)];t&&(t.stopPropagation(),t.preventDefault(),this.renderRoot.querySelector(".stage").setPointerCapture(t.pointerId),this.drag={index:e+1,id:t.pointerId},this.swallowClick=!0),this.emit(s),t||this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-zone-handle="${e+1}"]`)?.focus())}onMove(e){if(!this.drag||this.drag.id!==e.pointerId)return;const t=this.points.slice();t[this.drag.index]=ct(e.clientX,e.clientY,this.rect()),this.emit(t)}onUp(e){this.drag?.id===e.pointerId&&(this.drag=null)}onKey(e,t){if(!this.editing)return;const s=t.shiftKey?.02:.005,i={ArrowLeft:[-s,0],ArrowRight:[s,0],ArrowUp:[0,-s],ArrowDown:[0,s]};if(i[t.key]){t.preventDefault();const[a,n]=this.points[e],p=$=>Math.round(Math.min(1,Math.max(0,$))*1e4)/1e4,d=this.points.slice();d[e]=[p(a+i[t.key][0]),p(n+i[t.key][1])],this.emit(d)}else(t.key==="Delete"||t.key==="Backspace")&&(t.preventDefault(),this.emit(this.points.filter((a,n)=>n!==e)))}pick(e,t){this.editing||(t.stopPropagation(),this.dispatchEvent(new CustomEvent("zone-pick",{detail:{name:e},bubbles:!0,composed:!0})))}centroid(e){const t=e.length||1;return[e.reduce((s,i)=>s+i[0],0)/t,e.reduce((s,i)=>s+i[1],0)/t]}render(){const e=u().control.settings.config,t=1e3,s=Math.round(1e3/(this.aspect>0?this.aspect:16/9)),i=n=>n.map(([p,d])=>`${(p*t).toFixed(1)},${(d*s).toFixed(1)}`).join(" "),a=this.zones.filter(n=>n.points&&n.name!==this.selected);return r`<div class=${`stage ${this.editing?"editing":""}`} dir="ltr" style=${`aspect-ratio: ${t} / ${s}`} data-zone-stage
        @click=${n=>this.onStageClick(n)} @pointermove=${n=>this.onMove(n)} @pointerup=${n=>this.onUp(n)} @pointercancel=${n=>this.onUp(n)}>
      ${this.src&&!this.broken?r`<img src=${this.src} alt="" draggable="false" @error=${()=>this.broken=!0} />`:r`<div class="noframe" data-zone-noframe>${e.noFrame}</div>`}
      <svg viewBox=${`0 0 ${t} ${s}`} preserveAspectRatio="none" aria-hidden="true">
        ${a.map(n=>et`<polygon class=${`zone ${this.editing?"dim":""}`} points=${i(n.points)} data-zone-shape=${n.name} @click=${p=>this.pick(n.name,p)}></polygon>`)}
        ${this.selected!==null&&this.points.length>=2?et`<polygon class="draft" points=${i(this.points)} data-zone-draft></polygon>`:l}
      </svg>
      ${a.map(n=>{const[p,d]=this.centroid(n.points);return r`<span class="name" style=${`left:${p*100}%;top:${d*100}%`}>${n.name}</span>`})}
      ${this.selected!==null&&this.editing&&this.points.length>=2&&this.points.length<40?this.points.map((n,p)=>p===this.points.length-1&&this.points.length<3?l:r`<button type="button" class="m" style=${`left:${this.mid(p)[0]*100}%;top:${this.mid(p)[1]*100}%`}
            aria-label=${`${e.insertPoint} ${p+2}`} title=${e.insertPoint} data-zone-mid=${p} @pointerdown=${d=>this.insertAt(p,d)} @click=${d=>d.stopPropagation()}
            @keydown=${d=>{(d.key==="Enter"||d.key===" ")&&(d.preventDefault(),this.insertAt(p))}}></button>`):l}
      ${this.selected!==null?this.points.map(([n,p],d)=>r`<button type="button" class=${`h ${d===0?"first":""}`} style=${`left:${n*100}%;top:${p*100}%`} aria-label=${`${e.points} ${d+1}`}
            data-zone-handle=${d} ?disabled=${!this.editing} @pointerdown=${$=>this.onDown(d,$)} @keydown=${$=>this.onKey(d,$)}></button>`):l}
    </div>`}};ie.styles=j`
    ${ze}
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
  `;fe([y()],ie.prototype,"src",2);fe([y({type:Number})],ie.prototype,"aspect",2);fe([y({attribute:!1})],ie.prototype,"zones",2);fe([y()],ie.prototype,"selected",2);fe([y({attribute:!1})],ie.prototype,"points",2);fe([y({type:Boolean})],ie.prototype,"editing",2);fe([c()],ie.prototype,"broken",2);ie=fe([N("frigate-zone-editor")],ie);var Za=Object.defineProperty,Xa=Object.getOwnPropertyDescriptor,I=(e,t,s,i)=>{for(var a=i>1?void 0:i?Xa(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Za(t,s,a),a};let R=class extends E{constructor(){super(...arguments),this.recorderId="",this.cams=[],this.enabled=!1,this.schema=null,this.cameraId="",this.view=null,this.failed=!1,this.loading=!1,this.mode="zones",this.draft=null,this.values={},this.pending=null,this.supervised=!1,this.dialogError="",this.busy=!1,this.toaster=new ye(this,{ms:4e3})}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),Ls(this.recorderId).then(e=>this.schema=e).catch(()=>this.failed=!0)}updated(e){if((e.has("cams")||e.has("recorderId"))&&!this.cameraId){const t=this.cams.find(s=>s.enabled);t&&this.pickCamera(t.id)}}async pickCamera(e){this.cameraId=e,this.draft=null,await this.reload()}async reload(){if(!this.cameraId)return;const e=this.cameraId;this.loading=!0;try{const t=await Ms(this.recorderId,e);if(e!==this.cameraId)return;this.view=t,this.values={},this.failed=!1}catch{if(e!==this.cameraId)return;this.view=null,this.failed=!0}finally{e===this.cameraId&&(this.loading=!1)}}flash(e,t){this.toaster.show(t,{tone:e})}startNew(){this.draft={name:"",isNew:!0,points:[],objects:[],inertia:"",loitering:""}}select(e){e.points&&(this.draft={name:e.name,isNew:!1,points:e.points.map(t=>[t[0],t[1]]),objects:[...e.objects],inertia:e.inertia==null?"":String(e.inertia),loitering:e.loitering_time==null?"":String(e.loitering_time)})}draftErrors(){const e=u().control.settings.config,t=this.draft;if(!t||!this.view)return{name:null,poly:null,num:null};const s=t.isNew?pt(t.name,this.view.camera_key,this.view.zones.map(p=>p.name)):null,i=ht(t.points),a=this.schema?.zone.fields??[],n=(p,d)=>{const $=a.find(D=>D.key===p);return!!$&&"error"in Me($,d)};return{name:s&&t.name?e.nameError[s]:null,poly:i&&t.points.length?e.polyError[i]:null,num:n("inertia",t.inertia)||n("loitering_time",t.loitering)?e.rangeError:null}}canSaveZone(){const e=this.draft;if(!e||!this.view?.writable)return!1;const t=this.draftErrors();return!t.name&&!t.poly&&!t.num&&!ht(e.points)&&(!e.isNew||!pt(e.name,this.view.camera_key,this.view.zones.map(s=>s.name)))}toggleObject(e){if(!this.draft)return;const t=this.draft.objects.includes(e);this.draft={...this.draft,objects:t?this.draft.objects.filter(s=>s!==e):[...this.draft.objects,e].sort()}}async saveZone(){const e=this.draft,t=i=>i.trim()===""?null:Number(i);return(await Vs(this.recorderId,this.cameraId,e.name,{points:e.points,objects:e.objects,inertia:t(e.inertia),loitering_time:t(e.loitering)},this.supervised)).verified}async removeZone(){return(await Ws(this.recorderId,this.cameraId,this.draft.name,this.supervised)).verified}sectionFields(e){return(this.schema?.settings??[]).filter(t=>t.section===e)}current(e){return this.view?.settings[e.key]??null}edited(e){if(e.key in this.values)return this.values[e.key];const t=this.current(e);return e.type==="labels"?Array.isArray(t)?t:Array.isArray(e.default)?e.default:[]:t==null?"":String(t)}sectionDiff(e){const t={};for(const s of this.sectionFields(e)){if(!(s.key in this.values))continue;const i=this.values[s.key];let a;if(s.type==="labels")a=[...i].sort();else{const n=Me(s,i);if("error"in n)return"error";a=n.value}Fs(s,this.current(s),a)||(t[s.key]=a)}return t}setValue(e,t){this.values={...this.values,[e]:t}}toggleLabel(e,t){const s=this.edited(e);this.setValue(e.key,s.includes(t)?s.filter(i=>i!==t):[...s,t].sort())}ask(e){this.pending=e,this.supervised=!1,this.dialogError=""}kindOf(e){return e.kind==="settings"?"config_settings":"config_zone"}async run(){const e=this.pending;if(!e)return;const t=u().control.settings.config;this.busy=!0;try{let s;if(e.kind==="zone")s=await this.saveZone();else if(e.kind==="delete")s=await this.removeZone();else{const i=this.sectionDiff(e.section);if(i==="error")throw new Error(t.rangeError);s=(await Us(this.recorderId,this.cameraId,e.section,i,this.supervised)).verified}this.pending=null,this.draft=null,this.flash("ok",e.kind==="delete"?t.deleted:s?t.saved:t.sent),this.dispatchEvent(new CustomEvent("frigate-changed",{bubbles:!0,composed:!0})),await this.reload()}catch(s){this.dialogError=ge(s)?u().control.settings.supervised.need:s instanceof Error&&!("body"in s)?s.message:w(s)}finally{this.busy=!1}}dialog(){const e=this.pending,t=this.view;if(!e||!t)return l;const s=u().control.settings.config,i=u().control.settings,a=this.kindOf(e),n=t.can_supervise&&!t.first_write_done[a],p=!t.can_supervise&&!t.first_write_done[a],d=e.kind==="delete"?`${s.removeTitle}: ${this.draft?.name??""}`:s.confirmTitle;return r`<sw-dialog open heading=${d} data-fcp-confirm=${e.kind} @close=${()=>this.pending=null}>
      <div class="form">
        <p class="dialog-text">${s.confirmText}</p>
        ${n?r`<label class="sup" data-supervised-box=${a}><sw-toggle size="sm" labelHidden in-label label=${i.supervised.label} .checked=${this.supervised} @change=${$=>this.supervised=$e($)}></sw-toggle><span><b>${i.supervised.label}</b> · ${i.supervised.hint}</span></label>`:l}
        ${p?r`<div class="err" data-fcp-blocked>${i.supervised.need}</div>`:l}
        ${this.dialogError?r`<div class="err" role="alert" data-fcp-error>${this.dialogError}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.pending=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant=${e.kind==="delete"?"danger":"primary"} data-fcp-ok ?disabled=${this.busy||p||n&&!this.supervised} @click=${()=>void this.run()}>${u().control.confirm}</sw-button>
    </sw-dialog>`}labelText(e){return u().control.settings.config.labels[e]??e}zonesView(e){const t=u().control.settings.config,s=this.draft,i=e.frame.width&&e.frame.height?e.frame.width/e.frame.height:16/9,a=this.cams.find(x=>x.id===this.cameraId),n=a&&a.enabled?Ks(this.recorderId,this.cameraId):null,p=this.draftErrors(),d=!e.writable||this.busy,$=Array.from(new Set([...this.schema?.labels??[],...s?.objects??[]])),D=this.schema?.zone.max_zones??24;return r`<div class="grid" data-fcp-zones>
      <div>
        <frigate-zone-editor .src=${n} .aspect=${i} .zones=${e.zones} .selected=${s?s.name||"":null} .points=${s?.points??[]} ?editing=${!!s&&e.writable}
          @zone-points=${x=>s&&(this.draft={...s,points:x.detail.points})}
          @zone-pick=${x=>{const Ce=e.zones.find(Mt=>Mt.name===x.detail.name);Ce&&this.select(Ce)}}></frigate-zone-editor>
      </div>
      <div class="side">
        ${s?r`<div class="form" data-fcp-zone-form>
              ${s.isNew?r`<label>${t.name}<input dir="ltr" data-fcp-zone-name maxlength="40" autocomplete="off" .value=${s.name} ?disabled=${d} @input=${x=>this.draft={...s,name:x.target.value.trim()}} /></label>
                  ${p.name?r`<div class="err" data-fcp-name-error>${p.name}</div>`:l}`:r`<div class="head"><h4 dir="ltr">${s.name}</h4></div>`}
              ${e.writable?r`<p class="note">${t.draw}</p>`:l}
              <div class="inline">
                <span class="chip" data-fcp-points>${t.points}: ${s.points.length}</span>
                <sw-button size="sm" variant="ghost" data-fcp-undo-point ?disabled=${d||!s.points.length} @click=${()=>this.draft={...s,points:s.points.slice(0,-1)}}>${t.undoPoint}</sw-button>
                <sw-button size="sm" variant="ghost" data-fcp-clear ?disabled=${d||!s.points.length} @click=${()=>this.draft={...s,points:[]}}>${t.clear}</sw-button>
              </div>
              ${p.poly?r`<div class="err" data-fcp-poly-error>${p.poly}</div>`:l}
              <div class="field"><span class="lbl">${t.objects}${s.objects.length?l:r`<span>${t.allObjects}</span>`}</span>
                <div class="chips" data-fcp-zone-objects>${$.map(x=>r`<button type="button" aria-pressed=${String(s.objects.includes(x))} ?disabled=${d} data-label=${x} @click=${()=>this.toggleObject(x)}>${this.labelText(x)}</button>`)}</div>
              </div>
              <div class="two">
                <label>${t.inertia}<input type="number" inputmode="numeric" min="1" max="10" placeholder="3" data-fcp-inertia .value=${s.inertia} ?disabled=${d} @input=${x=>this.draft={...s,inertia:x.target.value}} /></label>
                <label>${t.loitering}<input type="number" inputmode="numeric" min="0" max="3600" placeholder="0" data-fcp-loitering .value=${s.loitering} ?disabled=${d} @input=${x=>this.draft={...s,loitering:x.target.value}} /></label>
              </div>
              ${p.num?r`<div class="err">${p.num}</div>`:l}
              <div class="acts">
                ${!s.isNew&&e.writable?r`<sw-button size="sm" variant="ghost" data-fcp-delete ?disabled=${this.busy} @click=${()=>this.ask({kind:"delete"})}>${t.remove}</sw-button>`:l}
                <sw-button size="sm" data-fcp-cancel @click=${()=>this.draft=null}>${t.cancel}</sw-button>
                ${e.writable?r`<sw-button size="sm" variant="primary" data-fcp-save ?disabled=${!this.canSaveZone()||this.busy} @click=${()=>this.ask({kind:"zone"})}>${t.save}</sw-button>`:l}
              </div>
            </div>`:r`${e.zones.length?r`<ul class="zl" data-fcp-zone-list>${e.zones.map(x=>r`<li><button type="button" data-zone=${x.name} ?disabled=${!x.points} title=${x.points?"":t.notEditable} @click=${()=>this.select(x)}>
                  <span class="zn">${x.name}</span><span class="zs">${x.objects.length?x.objects.map(Ce=>this.labelText(Ce)).join(", "):t.allObjects}</span></button></li>`)}</ul>`:r`<div class="empty" data-fcp-no-zones>${t.noZones}</div>`}
            ${e.writable?r`<div class="acts"><sw-button size="sm" icon="plus" data-fcp-new-zone ?disabled=${e.zones.length>=D} @click=${()=>this.startNew()}>${t.newZone}</sw-button></div>`:l}`}
      </div>
    </div>`}field(e,t){const s=u().control.settings.config,i=s.fields[e.key]??e.key,a=this.edited(e);if(e.type==="labels"){const p=Array.from(new Set([...this.schema?.labels??[],...a]));return r`<div class="field" data-fcp-field=${e.key}><span class="lbl">${i}</span>
        <div class="chips">${p.map(d=>r`<button type="button" aria-pressed=${String(a.includes(d))} ?disabled=${t} data-label=${d} @click=${()=>this.toggleLabel(e,d)}>${this.labelText(d)}</button>`)}</div>
      </div>`}const n="error"in Me(e,a);return r`<label class="field" data-fcp-field=${e.key}><span class="lbl"><span>${i}</span>
        <button type="button" class="link" data-fcp-default ?disabled=${t||a===""} @click=${()=>this.setValue(e.key,"")}>${s.useDefault}</button></span>
      <input type="number" inputmode=${e.type==="int"?"numeric":"decimal"} min=${e.min??""} max=${e.max??""} step=${e.step??(e.type==="int"?1:"any")}
        placeholder=${e.default==null?"":`${s.defaultValue}: ${e.default}`} .value=${a} ?disabled=${t} aria-invalid=${String(n)}
        @input=${p=>this.setValue(e.key,p.target.value)} />
      ${n?r`<span class="err">${s.rangeError}</span>`:l}
    </label>`}settingsView(e){const t=u().control.settings.config,s=!e.writable||this.busy;return r`<div class="sections" data-fcp-settings>
      ${(this.schema?.sections??[]).map(i=>{const a=this.sectionDiff(i),n=a!=="error"&&Object.keys(a).length>0;return r`<div class="sect" data-fcp-section=${i}>
          <h4>${t.sections[i]??i}</h4>
          ${this.sectionFields(i).map(p=>this.field(p,s))}
          ${e.writable?r`<div class="acts"><sw-button size="sm" variant="primary" data-fcp-save-section=${i} ?disabled=${!n||this.busy} @click=${()=>this.ask({kind:"settings",section:i})}>${t.save}</sw-button></div>`:l}
        </div>`})}
    </div>`}render(){const e=u().control.settings.config,t=u().control.settings,s=this.cams.filter(a=>a.enabled).map(a=>({id:a.id,label:a.name}));if(!s.length)return r`<div class="panel"><div class="empty" data-fcp-no-cameras>${e.noCameras}</div></div>`;const i=this.view;return r`<div class="panel" data-frigate-config-panel>
      <div class="head">
        <div class="inline" style="min-inline-size: 200px; flex: 1 1 220px">
          <sw-dropdown block data-fcp-camera .label=${e.camera} .placeholder=${e.camera} .value=${this.cameraId} .items=${s} @change=${a=>void this.pickCamera(a.detail.id)}></sw-dropdown>
        </div>
        <div class="inline">
          ${this.enabled?i&&!i.writable?r`<span class="chip" data-fcp-read-only>${e.readOnly}</span>`:l:r`<span class="chip warn" data-fcp-class-off>${e.classOff}</span>`}
          <sw-segmented label=${t.tabs.config} value=${this.mode} @change=${a=>this.mode=a.detail.value}
            .options=${[{value:"zones",label:e.zones,attrs:{"data-fcp-mode":"zones"}},{value:"settings",label:e.settings,attrs:{"data-fcp-mode":"settings"}}]}></sw-segmented>
        </div>
      </div>
      ${this.failed?r`<div class="msg err" data-fcp-failed>${e.unavailable}</div>`:l}
      ${this.loading&&!i?r`<sw-state-panel state="loading" compact heading=${e.loading} data-fcp-loading></sw-state-panel>`:l}
      ${i&&!this.failed?r`<div class="body" ?data-busy=${this.loading}>${this.mode==="zones"?this.zonesView(i):this.settingsView(i)}</div>`:l}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcp-msg>${this.msg.text}</div>`:l}
      ${this.dialog()}
    </div>`}};R.styles=[me,j`
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
  `];I([y({attribute:"recorder-id"})],R.prototype,"recorderId",2);I([y({attribute:!1})],R.prototype,"cams",2);I([y({type:Boolean})],R.prototype,"enabled",2);I([c()],R.prototype,"schema",2);I([c()],R.prototype,"cameraId",2);I([c()],R.prototype,"view",2);I([c()],R.prototype,"failed",2);I([c()],R.prototype,"loading",2);I([c()],R.prototype,"mode",2);I([c()],R.prototype,"draft",2);I([c()],R.prototype,"values",2);I([c()],R.prototype,"pending",2);I([c()],R.prototype,"supervised",2);I([c()],R.prototype,"dialogError",2);I([c()],R.prototype,"busy",2);R=I([N("frigate-config-panel")],R);var Ya=Object.defineProperty,Qa=Object.getOwnPropertyDescriptor,te=(e,t,s,i)=>{for(var a=i>1?void 0:i?Qa(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Ya(t,s,a),a};const Ja=["classes","profiles","config","exports","cases","events","log","supervision"],yt={export_create:"export_delete",export_rename:"export_rename",case_create:"case_delete",case_rename:"case_rename",event_create:"event_end",config_zone:"config_zone",config_settings:"config_settings"};let W=class extends E{constructor(){super(...arguments),this.recorderId="",this.tab="classes",this.policy=null,this.profiles=null,this.changes=[],this.first=null,this.cams=[],this.failed=!1,this.busy=!1,this.toaster=new ye(this,{ms:4e3}),this.undoing=null}get msg(){return this.toaster.visible?{tone:this.toaster.tone,text:this.toaster.text}:null}connectedCallback(){super.connectedCallback(),this.load()}async load(){try{this.policy=await Ve(this.recorderId),this.failed=!1}catch{this.failed=!0;return}const[e,t,s,i]=await Promise.allSettled([qs(this.recorderId),ut(this.recorderId),vt(this.recorderId),Kt(this.recorderId)]);this.profiles=e.status==="fulfilled"?e.value:null,this.changes=t.status==="fulfilled"?t.value.changes:[],this.first=s.status==="fulfilled"?s.value:null,this.cams=i.status==="fulfilled"?i.value:[]}async afterWrite(){const[e,t,s]=await Promise.allSettled([ut(this.recorderId),vt(this.recorderId),Ve(this.recorderId)]);e.status==="fulfilled"&&(this.changes=e.value.changes),t.status==="fulfilled"&&(this.first=t.value),s.status==="fulfilled"&&(this.policy=s.value)}flash(e,t){this.toaster.show(t,{tone:e})}async toggle(e,t){const s=t.currentTarget,i=s.checked;this.busy=!0;try{await Hs(this.recorderId,{[e]:i}),this.policy=await Ve(this.recorderId),this.dispatchEvent(new CustomEvent("frigate-control-policy",{detail:{anyOn:this.policy.classes.some(a=>a.enabled)},bubbles:!0,composed:!0}))}catch(a){s.checked=!i,this.flash("err",w(a))}finally{this.busy=!1}}async rule(e,t){const s=t.currentTarget.value;this.busy=!0;try{const i=await Gs(this.recorderId,{[e]:s||null});this.profiles&&(this.profiles={...this.profiles,rules:i.rules})}catch(i){this.flash("err",w(i)),this.load()}finally{this.busy=!1}}async undo(e,t,s=!1){this.busy=!0;try{await Zs(this.recorderId,e.id,t,s),this.undoing=null,this.flash("ok",u().control.settings.undone),this.afterWrite()}catch(i){this.undoing?this.undoing={...this.undoing,error:ge(i)?u().control.settings.supervised.need:w(i)}:this.flash("err",ge(i)?u().control.settings.supervised.need:w(i))}finally{this.busy=!1}}onUndo(e){const t=yt[e.kind],s=!!t&&!!this.first&&!this.first.done[t];e.class==="record"||e.class==="profile"||e.class==="config"||e.kind==="export_create"||e.kind==="case_create"||s?this.undoing={row:e,supervised:!1,error:""}:this.undo(e,!1)}timeText(e){try{return qt(new Date(e))}catch{return e}}statusTag(e){const t=u().control.settings;return e.status==="reverted"?r`<span class="tag" data-change-status="reverted">${t.reverted}</span>`:e.status==="failed"?r`<span class="tag bad" data-change-status="failed">${t.failed}</span>`:e.status==="unverified"?r`<span class="tag" data-change-status="unverified">${t.unverified}</span>`:l}classesTab(e){const t=u().control.settings,s=this.busy||!O("system.configure");return r`<div class="classes" data-fcs-classes>
      ${Xs(e).map(i=>r`<div class="row" data-fcs-class=${i.class}>
        <span class="name"><span>${t.classes[i.class]}</span>
          <span class="sub">${i.per_action?r`<span>${t.perAction}</span>`:l}${i.confirm_actions?.includes("delete")?r`<span>${t.confirmDelete}</span>`:l}<span dir="ltr">${i.permission}</span></span></span>
        <sw-toggle .checked=${i.enabled} ?disabled=${s||!i.available} labelHidden label=${t.classes[i.class]} data-fcs-toggle=${i.class} @change=${a=>void this.toggle(i.class,a)}></sw-toggle>
      </div>`)}
    </div>`}profilesTab(){const e=u().control.settings,t=this.profiles,s=this.busy||!O("system.configure");return r`${t&&t.names.length?r`<div data-fcs-rules>
        <h4>${e.rules}</h4>
        ${t.alarm_states.filter(i=>["disarmed","armed_home","armed_away","armed_night"].includes(i)).map(i=>r`<div class="row">
          <span>${Ke(i)}</span>
          <select aria-label=${Ke(i)} data-fcs-rule=${i} .value=${t.rules[i]??""} ?disabled=${s} @change=${a=>void this.rule(i,a)}>
            <option value="">${e.rulesNone}</option>
            ${t.names.map(a=>r`<option value=${a} ?selected=${t.rules[i]===a}>${a}</option>`)}
          </select>
        </div>`)}
      </div>`:l}
      <frigate-auto-profile recorder-id=${this.recorderId} .first=${this.first} .canConfigure=${O("system.configure")} .canProfile=${pe("analytics.profile")} @frigate-changed=${()=>void this.afterWrite()}></frigate-auto-profile>`}logTab(){const e=u().control.settings;return r`<div data-fcs-log>
      ${this.changes.length?r`<ul>${this.changes.map(t=>r`<li class="change" data-change=${t.id}>
            <span class="what"><span>${ft(t)}${this.statusTag(t)}</span><span class="meta">${this.timeText(t.at)}${t.actor?` · ${t.actor}`:""}${t.camera_key&&t.camera_key!=="*"?` · ${this.cams.find(s=>s.id===t.camera_id)?.name??t.camera_key}`:""}</span></span>
            ${t.reversible?r`<sw-button size="sm" variant="ghost" data-change-undo ?disabled=${this.busy} @click=${()=>this.onUndo(t)}>${e.undo}</sw-button>`:l}
          </li>`)}</ul>`:r`<p class="note" data-fcs-log-empty>${e.logEmpty}</p>`}
    </div>`}undoDialog(){const e=this.undoing;if(!e)return l;const t=u().control.settings,s=u().control,i=yt[e.row.kind],a=!!i&&!!this.first&&this.first.can_supervise&&!this.first.done[i],n=!!i&&!!this.first&&!this.first.done[i]&&!this.first.can_supervise;return r`<sw-dialog open heading=${`${t.undo}: ${ft(e.row)}`} data-fcs-confirm @close=${()=>this.undoing=null}>
      <div class="form">
        ${a?r`<label class="sup" data-supervised-box=${i}><sw-toggle size="sm" labelHidden in-label label=${t.supervised.label} .checked=${e.supervised} @change=${p=>this.undoing={...e,supervised:$e(p)}}></sw-toggle><span><b>${t.supervised.label}</b> · ${t.supervised.hint}</span></label>`:l}
        ${n?r`<div class="err" data-fcs-undo-blocked>${t.supervised.need}</div>`:l}
        ${e.error?r`<div class="err" role="alert" data-fcs-undo-error>${e.error}</div>`:l}
      </div>
      <sw-button slot="footer" @click=${()=>this.undoing=null}>${s.cancel}</sw-button>
      <sw-button slot="footer" variant="primary" data-fcs-ok ?disabled=${this.busy||n||a&&!e.supervised} @click=${()=>void this.undo(e.row,!0,e.supervised)}>${s.confirm}</sw-button>
    </sw-dialog>`}tabs(){const e=O("system.configure");return Ja.filter(t=>t==="exports"?e||pe("analytics.exports"):t==="cases"?e||pe("analytics.cases"):t==="events"?e||pe("analytics.events"):!0)}render(){const e=u().control.settings;if(this.failed)return r`<div class="note" data-fcs-failed>${e.unavailable}</div>`;const t=this.policy;if(!t)return l;const s=this.tabs(),i=s.includes(this.tab)?this.tab:s[0],a=d=>t.classes.some($=>$.class===d&&$.enabled),n=O("system.configure"),p="";return r`<div class="box" data-frigate-control-settings>
      <div class="head"><h4>${e.title}</h4>${t.classes.some(d=>d.enabled)?r`<span class="chip accent" data-fcs-any-on>${t.classes.filter(d=>d.enabled).length} ${e.classesOn}</span>`:r`<span class="chip" data-fcs-all-off>${u().summary.readOnly}</span>`}</div>
      <sw-tabs variant="underline-compact" data-fcs-tabs .items=${s.map(d=>({id:d,label:e.tabs[d]}))} .active=${i} @change=${d=>this.tab=d.detail.id}></sw-tabs>
      ${i==="classes"?this.classesTab(t):l}
      ${i==="profiles"?this.profilesTab():l}
      ${i==="config"?r`<frigate-config-panel recorder-id=${this.recorderId} .cams=${this.cams} .enabled=${a("config")} @frigate-changed=${()=>void this.afterWrite()}></frigate-config-panel>`:l}
      ${i==="exports"?r`<frigate-exports-panel recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .allowed=${n||pe("analytics.exports")} tz=${p} @frigate-changed=${()=>void this.afterWrite()}></frigate-exports-panel>`:l}
      ${i==="cases"?r`<frigate-cases-panel recorder-id=${this.recorderId} .first=${this.first} .allowed=${n||pe("analytics.cases")} tz=${p} @frigate-changed=${()=>void this.afterWrite()}></frigate-cases-panel>`:l}
      ${i==="events"?r`<frigate-manual-events recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .changes=${this.changes} .enabled=${a("events")} .allowed=${n||pe("analytics.events")} tz=${p} @frigate-changed=${()=>void this.afterWrite()}></frigate-manual-events>`:l}
      ${i==="log"?this.logTab():l}
      ${i==="supervision"?r`<frigate-supervision recorder-id=${this.recorderId} .first=${this.first} .cams=${this.cams} .canPlayback=${pe("video.playback")}></frigate-supervision>`:l}
      ${this.msg?r`<div class=${`msg ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-fcs-msg>${this.msg.text}</div>`:l}
      ${this.undoDialog()}
    </div>`}};W.styles=[me,j`
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
  `];te([y({attribute:"recorder-id"})],W.prototype,"recorderId",2);te([c()],W.prototype,"tab",2);te([c()],W.prototype,"policy",2);te([c()],W.prototype,"profiles",2);te([c()],W.prototype,"changes",2);te([c()],W.prototype,"first",2);te([c()],W.prototype,"cams",2);te([c()],W.prototype,"failed",2);te([c()],W.prototype,"busy",2);te([c()],W.prototype,"undoing",2);W=te([N("frigate-control-settings")],W);var ei=Object.defineProperty,ti=Object.getOwnPropertyDescriptor,G=(e,t,s,i)=>{for(var a=i>1?void 0:i?ti(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&ei(t,s,a),a};const si=g("מיד: בלי שידור חי, ניגון ואירועים מה־NVR הזה. המצלמות שלו יורדות מהקיר ומבחירת המצלמות; בטבלת המצלמות ובמפה הן נשארות, בלי תמונה. ההיסטוריה נשמרת."),ai=g("ה־NVR חוזר לפעול מיד, והמצלמות שלו חוזרות לקיר."),ii={online:"live",error:"error",unknown:"unknown",pending_restart:"stale",disabled:"neutral",not_configured:"neutral",unreadable:"error",refused:"error",removed:"neutral"};let B=class extends E{constructor(){super(...arguments),this.loadState="loading",this.loadError="",this.data=null,this.open="",this.renaming="",this.nameDraft="",this.toggling=null,this.adding=!1,this.busy=!1,this.msg=null,this.fallback=!1,this.mq=window.matchMedia("(max-width: 767px)"),this.onMq=()=>this.requestUpdate()}get btn(){return this.mq.matches?"lg":"sm"}connectedCallback(){super.connectedCallback(),this.mq.addEventListener("change",this.onMq),we()&&O("system.configure")&&!_e()&&this.load()}disconnectedCallback(){super.disconnectedCallback(),this.mq.removeEventListener("change",this.onMq)}async load(){try{const e=await Ys();this.fallback=!Array.isArray(e?.recorders),this.data=this.fallback?null:e,this.loadState="ready",this.loadError=""}catch(e){if(e instanceof Ee&&e.status===404){this.fallback=!0,this.loadState="ready";return}this.loadError=w(e),this.loadState="error"}}async rename(e){const t=this.nameDraft.trim();if(!(!t||this.busy)){this.busy=!0;try{await gt(e.id,{name:t}),this.renaming="",this.msg={tone:"ok",text:g("השם נשמר")},await this.load()}catch(s){this.msg={tone:"err",text:w(s)}}finally{this.busy=!1}}}async toggle(e){if(!this.busy){this.busy=!0;try{const t=await gt(e.id,{enabled:!e.enabled});this.toggling=null,this.msg={tone:"ok",text:e.enabled?g("ה־NVR הושבת"):g("ה־NVR הופעל")},t.restart_required&&Ht(!0),await this.load()}catch(t){this.toggling=null,this.msg={tone:"err",text:w(t)}}finally{this.busy=!1}}}changed(e){this.msg={tone:"ok",text:e},this.adding=!1,this.load()}row(e){const t=e.status.state,s=[e.vendor_label,e.model].filter(Boolean).join(" · "),i=this.open===e.id;return r`<li class="rec" data-recorder=${e.id} data-recorder-state=${t}>
      <div class="head">
        <div class="who">
          ${this.renaming===e.id?r`<input class="name-in" data-recorder-name-input maxlength="60" .value=${this.nameDraft} @input=${a=>this.nameDraft=a.target.value}
                @keydown=${a=>{a.key==="Enter"&&this.rename(e),a.key==="Escape"&&(this.renaming="")}} />`:r`<span class="name" data-recorder-name>${e.name}</span>`}
          <span class="meta">${s}</span>
        </div>
        <div class="facts">
          <sw-badge kind=${ii[t]??"neutral"} label=${Qs[t]??t} data-recorder-status></sw-badge>
          <span class="cams" data-recorder-cameras>${g("{n} מצלמות",{n:e.cameras})}</span>
        </div>
      </div>
      <div class="actions">
        ${this.renaming===e.id?r`<sw-button size=${this.btn} variant="primary" icon="check" ?disabled=${this.busy||!this.nameDraft.trim()} data-recorder-name-save @click=${()=>this.rename(e)}>${g("שמור")}</sw-button>
              <sw-button size=${this.btn} variant="ghost" @click=${()=>this.renaming=""}>${g("ביטול")}</sw-button>`:r`<sw-button size=${this.btn} icon="link" data-recorder-connection aria-expanded=${String(i)} @click=${()=>this.open=i?"":e.id}>${g("חיבור")}</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="edit" data-recorder-rename @click=${()=>{this.renaming=e.id,this.nameDraft=e.name,this.msg=null}}>${g("שם")}</sw-button>
              <sw-button size=${this.btn} variant="ghost" icon="power" data-recorder-toggle @click=${()=>this.toggling=e}>${e.enabled?g("השבת"):g("הפעל")}</sw-button>`}
      </div>
      ${i?r`<div class="conn" data-recorder-connection-form>
            <nvr-connection-form context="settings" recorder-id=${e.id}
              @nvr-connection-saved=${()=>this.changed(g("נשמר"))} @nvr-connection-removed=${()=>{this.open="",this.changed(g("ה־NVR הוסר"))}}></nvr-connection-form>
            ${e.vendor==="frigate"&&t==="online"?r`<frigate-summary recorder-id=${e.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${e.id} data-recorder-frigate-control></frigate-control-settings>`:l}
          </div>`:l}
    </li>`}addDialog(){return r`<sw-dialog open wide heading=${g("הוספת NVR")} data-recorder-add-dialog @close=${()=>this.adding=!1}>
      <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed(g("ה־NVR נוסף"))}></nvr-connection-form>
    </sw-dialog>`}render(){if(!we()||!O("system.configure"))return l;if(_e())return r`<sw-card heading=${g("חיבור ל־NVR")} data-nvr-connection><p class="local-only" data-nvr-local-only role="status">${Gt}</p></sw-card>`;if(this.loadState==="loading")return r`<sw-card heading=${g("מקליטים (NVR)")}><sw-state-panel state="loading" compact heading=${g("קורא…")}></sw-state-panel></sw-card>`;if(this.fallback)return r`<sw-card heading=${g("חיבור ל־NVR")} data-nvr-connection><nvr-connection-form context="settings"></nvr-connection-form></sw-card>`;if(this.loadState==="error"||!this.data)return r`<sw-card heading=${g("מקליטים (NVR)")}><sw-state-panel state="error" compact heading=${g("רשימת המקליטים לא נטענה")} hint=${this.loadError} actionLabel=${g("נסה שוב")} @action=${()=>this.load()}></sw-state-panel></sw-card>`;const e=this.data.recorders.filter(s=>!s.removed);if(!e.length&&this.data.primary_has_history)return r`<sw-card heading=${g("חיבור ל־NVR")} data-nvr-connection data-recorder-add-new>
        <nvr-connection-form context="add" @nvr-recorder-added=${()=>this.changed(g("ה־NVR נוסף"))}></nvr-connection-form>
        ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:l}
      </sw-card>`;if(e.length<=1){const s=e[0],i=!!s&&s.connection?.vendor&&s.connection.vendor!=="none"&&s.connection.state!=="not_chosen";return r`<sw-card heading=${g("חיבור ל־NVR")} data-nvr-connection>
        <nvr-connection-form context="settings" recorder-id=${s?.id??"nvr-1"} @nvr-connection-saved=${()=>void this.load()} @nvr-connection-removed=${()=>void this.load()}></nvr-connection-form>
        ${s?.vendor==="frigate"&&s.status.state==="online"?r`<frigate-summary recorder-id=${s.id} data-recorder-frigate-summary></frigate-summary><frigate-control-settings recorder-id=${s.id} data-recorder-frigate-control></frigate-control-settings>`:l}
        ${i?r`<div class="actions add-one"><sw-button size=${this.btn} icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>${g("הוסף NVR")}</sw-button></div>`:l}
        ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:l}
        ${this.adding?this.addDialog():l}
      </sw-card>`}const t=this.toggling;return r`<sw-card heading=${g("מקליטים (NVR)")} data-nvr-recorders data-nvr-connection>
      <ul class="list" data-recorder-list>${e.map(s=>this.row(s))}</ul>
      <div class="actions">
        <sw-button size=${this.btn} variant="primary" icon="plus" data-recorder-add @click=${()=>{this.adding=!0,this.msg=null}}>${g("הוסף NVR")}</sw-button>
      </div>
      ${this.msg?r`<div class=${`line ${this.msg.tone}`} role=${this.msg.tone==="err"?"alert":"status"} data-recorder-msg>${this.msg.text}</div>`:l}
      ${this.adding?this.addDialog():l}
      ${t?r`<sw-dialog open heading=${t.enabled?g("השבתת NVR"):g("הפעלת NVR")} subheading=${t.name} data-recorder-toggle-dialog @close=${()=>this.toggling=null}>
            <div class="dlg" data-recorder-toggle-text>${t.enabled?si:ai}</div>
            <div slot="footer">
              <sw-button variant=${t.enabled?"danger":"primary"} ?disabled=${this.busy} data-recorder-toggle-confirm @click=${()=>this.toggle(t)}>${t.enabled?g("השבת"):g("הפעל")}</sw-button>
              <sw-button variant="ghost" @click=${()=>this.toggling=null}>${g("ביטול")}</sw-button>
            </div>
          </sw-dialog>`:l}
    </sw-card>`}};B.styles=j`
    .local-only {
      margin: 0;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-md);
    }
    ${ze}
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
  `;G([c()],B.prototype,"loadState",2);G([c()],B.prototype,"loadError",2);G([c()],B.prototype,"data",2);G([c()],B.prototype,"open",2);G([c()],B.prototype,"renaming",2);G([c()],B.prototype,"nameDraft",2);G([c()],B.prototype,"toggling",2);G([c()],B.prototype,"adding",2);G([c()],B.prototype,"busy",2);G([c()],B.prototype,"msg",2);G([c()],B.prototype,"fallback",2);B=G([N("nvr-recorders-card")],B);const ri=()=>q("system/secrets"),ni=(e,t)=>Ae(`system/secrets/${encodeURIComponent(e)}`,{value:t}),oi=e=>Zt(`system/secrets/${encodeURIComponent(e)}`,{method:"DELETE"}),li=(e,t)=>Q(`system/secrets/${encodeURIComponent(e)}/test`,t===void 0?{}:{value:t}),di={ok:se("החיבור תקין"),unauthorized:se("go2rtc דחה את הסיסמה"),unreachable:se("go2rtc לא ענה"),error:se("go2rtc החזיר שגיאה"),not_configured:se("כתובת go2rtc לא הוגדרה"),username_missing:se("שם המשתמש לא הוגדר בהגדרות החיבור של ההתקנה"),wiskey_unavailable:se("נתוני WisKey אינם זמינים כרגע"),no_station:se("אין עמדה מחוברת עם מצלמה שמשתמשת בחשבון המשותף"),station_failed:se("לא התקבלה תמונה מהעמדה (סיסמה שגויה או מצלמה שלא ענתה)"),go2rtc_unauthorized:se("go2rtc דחה את פרטי הגישה שלו")};var ci=Object.defineProperty,pi=Object.getOwnPropertyDescriptor,de=(e,t,s,i)=>{for(var a=i>1?void 0:i?pi(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&ci(t,s,a),a};const hi={set:["live",g("מוגדר")],not_set:["neutral",g("לא מוגדר")],unreadable:["error",g("לא ניתן לפענוח")],legacy:["partial",g("מהגדרה ישנה")]};function kt(e){if(!e)return"";const t=new Date(e);return Number.isNaN(t.getTime())?e:t.toLocaleString(Ot(),{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let X=class extends E{constructor(){super(...arguments),this.items=null,this.editing=null,this.draft="",this.confirmClear=null,this.busy=!1,this.error="",this.tests={},this.restartNote=!1}connectedCallback(){super.connectedCallback(),_e()||this.load()}async load(){try{this.items=(await ri()).secrets}catch(e){this.error=w(e)}}replaceItem(e){this.items=(this.items??[]).map(t=>t.name===e.name?e:t)}async run(e){this.busy=!0,this.error="";try{return await e()}catch(t){return this.error=w(t),null}finally{this.busy=!1}}async save(e){const t=await this.run(()=>ni(e,this.draft));if(!t)return;this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required,this.editing=null,this.draft="";const{[e]:s,...i}=this.tests;this.tests=i}async clear(e){const t=await this.run(()=>oi(e));this.confirmClear=null,t&&(this.replaceItem(t.secret),this.restartNote=this.restartNote||t.restart_required)}async test(e,t){const s=await this.run(()=>li(e,t));s&&(this.tests={...this.tests,[e]:s})}status(e){if(e.state==="unreadable")return g("הערך השמור אינו ניתן לפענוח (מפתח ההתקנה השתנה) - יש להזין אותו מחדש");if(e.state==="legacy")return e.source==="environment"?g("בשימוש ממשתנה סביבה של הרצת פיתוח"):g("בשימוש מהגדרת התוסף הישנה - יועבר בהפעלה הבאה");if(!e.configured)return e.updated_at?`${g("נמחק {when}",{when:kt(e.updated_at)})}${e.updated_by_name?` · ${e.updated_by_name}`:""}`:g("לא הוגדר");const t=e.source==="addon_import"?g("הועבר מהגדרות התוסף"):e.updated_by_name??"";return`${g("הוגדר {when}",{when:kt(e.updated_at)})}${t?` · ${t}`:""}`}renderRow(e){const[t,s]=hi[e.state]??["neutral",e.state],i=this.tests[e.name],a=this.editing===e.name||e.state==="not_set"||e.state==="unreadable";return r`<div class="row" data-secret-row=${e.name}>
      <span class="lbl">${e.label_he}<span class="muted"><span class="ltr">${e.name}</span> · <span data-secret-status>${this.status(e)}</span></span>
        ${i?r`<span class=${`muted ${i.ok?"ok":"bad"}`} data-secret-test-result=${i.code}>${di[i.code]??i.code}</span>`:l}</span>
      <span class="acts"><sw-badge kind=${t} label=${s} data-secret-state=${e.state}></sw-badge>
        ${a?r`<input type="password" autocomplete="new-password" spellcheck="false" .value=${this.editing===e.name?this.draft:""} aria-label=${e.label_he} data-secret-input
                @focus=${()=>{this.editing!==e.name&&(this.editing=e.name,this.draft="")}}
                @input=${n=>{this.editing=e.name,this.draft=n.target.value}} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-save @click=${()=>void this.save(e.name)}>${g("שמור")}</sw-button>
              ${e.testable?r`<sw-button size="sm" ?disabled=${this.busy||this.editing!==e.name||!this.draft.trim()} data-secret-test @click=${()=>void this.test(e.name,this.draft)}>${g("בדוק")}</sw-button>`:l}
              ${e.configured||this.editing===e.name?r`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>{this.editing=null,this.draft=""}}>${g("ביטול")}</sw-button>`:l}`:this.confirmClear===e.name?r`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear-confirm @click=${()=>void this.clear(e.name)}>${g("מחק סופית")}</sw-button>
                <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirmClear=null}>${g("ביטול")}</sw-button>`:r`<sw-button size="sm" ?disabled=${this.busy} data-secret-replace @click=${()=>{this.editing=e.name,this.draft=""}}>${g("החלף")}</sw-button>
                ${e.testable?r`<sw-button size="sm" ?disabled=${this.busy} data-secret-test-stored @click=${()=>void this.test(e.name)}>${g("בדוק חיבור")}</sw-button>`:l}
                ${e.state==="set"?r`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear @click=${()=>this.confirmClear=e.name}>${g("מחק")}</sw-button>`:l}`}
      </span>
    </div>`}render(){const e=_e()?r`<div class="hint" data-secrets-local-only>${Xt}</div>`:this.items?r`${this.items.map(t=>this.renderRow(t))}
            ${this.restartNote?r`<div class="hint" data-secrets-restart>${g("השינוי חל מיד על המסכים; שירותי הרקע (סנכרון זרמי go2rtc, ערוצי WisKey) יקבלו אותו בהפעלה הבאה של המערכת.")}</div>`:l}`:this.error?l:r`<div class="hint">${g("טוען…")}</div>`;return r`<sw-card heading=${g("סודות")} subheading=${g("Secrets · סיסמאות ומפתחות של שירותים חיצוניים, שמורים מוצפנים · הערכים עצמם אינם מוצגים שוב")} data-secrets>
      ${e}
      ${this.error?r`<div class="err" role="alert" data-secrets-error>${this.error}</div>`:l}
    </sw-card>`}};X.styles=j`
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
    ${qe}
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
  `;de([c()],X.prototype,"items",2);de([c()],X.prototype,"editing",2);de([c()],X.prototype,"draft",2);de([c()],X.prototype,"confirmClear",2);de([c()],X.prototype,"busy",2);de([c()],X.prototype,"error",2);de([c()],X.prototype,"tests",2);de([c()],X.prototype,"restartNote",2);X=de([N("sw-secrets-card")],X);var ui=Object.defineProperty,vi=Object.getOwnPropertyDescriptor,ne=(e,t,s,i)=>{for(var a=i>1?void 0:i?vi(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&ui(t,s,a),a};function xt(e){if(!e)return"";const t=new Date(e),s=He(Et());return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let K=class extends E{constructor(){super(...arguments),this.status=null,this.dialog=null,this.ack=!1,this.otp="",this.shown=null,this.copied=!1,this.busy=!1,this.error="",this.done=!1}disconnectedCallback(){super.disconnectedCallback(),this.shown=null}close(){this.dialog=null,this.ack=!1,this.otp="",this.shown=null,this.copied=!1,this.error=""}changed(){this.dispatchEvent(new CustomEvent("changed",{bubbles:!0,composed:!0}))}async revoke(){const e=this.status?.revocation;this.busy=!0,this.error="";try{await Yt(!!e?.wiskey_present&&this.ack),this.close(),this.done=!0,this.changed()}catch(t){this.error=w(t)}finally{this.busy=!1}}async reveal(){this.busy=!0,this.error="";try{this.shown=await Qt(this.otp.trim()),this.otp=""}catch(e){this.error=w(e)}finally{this.busy=!1}}async copy(e){try{await navigator.clipboard.writeText(e),this.copied=!0}catch{this.copied=!1}}confirmDialog(){const t=!!this.status?.revocation?.wiskey_present;return r`<sw-dialog open heading=${h("rvDlgTitle")} data-bridge-key-revoke-dialog @close=${()=>this.close()}>
      <ul>
        <li>${h("rvDlg1")}</li>
        <li>${h("rvDlg2")}</li>
        <li>${h("rvDlg3")}</li>
        <li>${h("rvDlg4")}</li>
      </ul>
      ${t?r`<div class="warn" role="alert" data-bridge-key-revoke-wiskey>${h("rvWiskeyWarn")}</div>
            <label class="ack"><sw-toggle size="sm" labelHidden in-label label=${h("rvWiskeyAck")} data-bridge-key-revoke-ack .checked=${this.ack}
              @change=${s=>this.ack=$e(s)}></sw-toggle>${h("rvWiskeyAck")}</label>`:l}
      ${this.error?r`<p class="err" role="alert">${this.error}</p>`:l}
      <div class="foot">
        <sw-button variant="ghost" @click=${()=>this.close()}>${h("rvBack")}</sw-button>
        <sw-button variant="danger" ?disabled=${this.busy||t&&!this.ack} data-bridge-key-revoke-yes @click=${()=>void this.revoke()}>${h("rvConfirm")}</sw-button>
      </div>
    </sw-dialog>`}revealDialog(){const e=this.status?.revocation?.step_up_ready!==!1,t=this.shown;return r`<sw-dialog open heading=${h("rvRevealTitle")} data-bridge-key-reveal-dialog @close=${()=>this.close()}>
      ${t?r`<div class="code"><span class="lbl">${h("rvCode")}</span><output data-bridge-key-new-code>${t.pairing_code}</output></div>
            <div class="code"><span class="lbl">${h("rvAddress")}</span><output>${t.addon_url}</output></div>
            <p class="note">${h("rvSteps")}</p>
            <div class="foot">
              ${this.copied?r`<span class="ok" role="status">${h("rvCopied")}</span>`:l}
              <sw-button @click=${()=>void this.copy(t.pairing_code)}>${h("rvCopy")}</sw-button>
              <sw-button variant="primary" @click=${()=>this.close()}>${h("rvClose")}</sw-button>
            </div>`:e?r`<p class="note">${h("rvStepUp")}</p>
              <div class="field">
                <label for="otp" class="lbl">${h("rvCodeLabel")}</label>
                <input id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" data-bridge-key-otp .value=${this.otp}
                  @input=${s=>this.otp=s.target.value.replace(/\D/g,"")}
                  @keydown=${s=>{s.key==="Enter"&&this.otp.length>=6&&!this.busy&&this.reveal()}} />
              </div>
              ${this.error?r`<p class="err" role="alert">${this.error}</p>`:l}
              <div class="foot">
                <sw-button variant="ghost" @click=${()=>this.close()}>${h("rvBack")}</sw-button>
                <sw-button variant="primary" ?disabled=${this.busy||this.otp.length<6} data-bridge-key-reveal-yes @click=${()=>void this.reveal()}>${h("rvShow")}</sw-button>
              </div>`:r`<p class="note" role="status" data-bridge-key-step-up-none>${h("rvStepUpNone")}</p>
              <div class="foot"><sw-button variant="primary" @click=${()=>this.close()}>${h("rvClose")}</sw-button></div>`}
    </sw-dialog>`}render(){const e=this.status,t=e?.revocation;if(!e||!t)return l;const s=t.state==="revoked";return r`<div data-bridge-key-revoke=${t.state}>
      ${s?r`<div class="alert" role="alert" data-bridge-key-revoked>${h("rvRevoked",{t:xt(t.revoked_at),name:t.revoked_by_name??""})}</div>
            <div class="note" data-bridge-key-revoke-path=${t.announce_path?"auto":"manual"}>${h(t.announce_path?"rvAuto":"rvManual")}</div>`:t.state==="repaired"&&t.repaired_at?r`<div class="note" data-bridge-key-repaired>${h("rvRepaired",{t:xt(t.repaired_at)})}</div>`:l}
      <div class="row">
        <span class="lbl">${h("rvTitle")}</span>
        <span>
          ${s?r`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-reveal @click=${()=>{this.close(),this.dialog="reveal"}}>${h("rvReveal")}</sw-button>`:l}
          <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-bridge-key-revoke-open @click=${()=>{this.close(),this.done=!1,this.dialog="confirm"}}>${h("rvButton")}</sw-button>
        </span>
      </div>
      <div class="note">${h("rvNote")}</div>
      ${this.done?r`<p class="ok" role="status">${h("rvDone")}</p>`:l}
      ${this.dialog==="confirm"?this.confirmDialog():this.dialog==="reveal"?this.revealDialog():l}
    </div>`}};K.styles=j`
    ${ze}
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
    label.ack sw-toggle {
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
  `;ne([y({attribute:!1})],K.prototype,"status",2);ne([c()],K.prototype,"dialog",2);ne([c()],K.prototype,"ack",2);ne([c()],K.prototype,"otp",2);ne([c()],K.prototype,"shown",2);ne([c()],K.prototype,"copied",2);ne([c()],K.prototype,"busy",2);ne([c()],K.prototype,"error",2);ne([c()],K.prototype,"done",2);K=ne([N("sw-bridge-key-revoke")],K);var fi=Object.defineProperty,gi=Object.getOwnPropertyDescriptor,ce=(e,t,s,i)=>{for(var a=i>1?void 0:i?gi(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&fi(t,s,a),a};function We(e){if(!e)return"";const t=new Date(e),s=He(Et());return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}let Y=class extends E{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.asking=null,this.saved=!1,this.grant=null,this.grantError=""}connectedCallback(){if(super.connectedCallback(),_e()){this.notShown=!0;return}this.load(),this.loadGrant()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.timer)}schedule(){window.clearTimeout(this.timer),!!this.s?.rotation&&tt.includes(this.s.rotation.state)&&(this.timer=window.setTimeout(()=>void this.load(),5e3))}async load(){try{this.s=await Jt(),this.error=""}catch(e){const t=e.status;t===403||t===404?this.notShown=!0:this.error=w(e)}this.schedule()}async loadGrant(){try{this.grant=await es(),this.grantError=""}catch(e){const t=e.status;t===403||t===404?this.grant="hidden":this.grantError=w(e)}}grantKind(e){return{active:"live",absent_or_revoked:"neutral",refused:"forbidden",unknown:"unknown",unsupported:"neutral",unavailable:"offline"}[e]}renderGrant(){const e=this.grant;if(e==="hidden")return l;if(e===null&&!this.grantError)return l;const t=e?ts(e):"unknown",s=e?ss(e):[],i=e&&t==="refused"?e.wiskey_code:null,a=we()&&Js({api:!0,accessReadInstallation:O("access.read"),hidden:as});return r`<div class="grant" data-bridge-key-grant=${t}>
      <div class="row">
        <span class="lbl">${h("sgTitle")}</span>
        <sw-badge kind=${this.grantKind(t)} label=${h(`sg_${t}`)} data-bridge-key-grant-state></sw-badge>
      </div>
      <div class="note" role="status" data-bridge-key-grant-text>${this.grantError||h(`sgText_${t}`)}</div>
      ${s.length?r`<div class="row" data-bridge-key-grant-actions>
            <span class="lbl">${h("sgActions")}</span>
            <span class="val">${s.map(n=>h(`sgCmd_${n.replace("/","_")}`)).join(" · ")}</span>
          </div>
          <div class="note" data-bridge-key-grant-no-cards>${h("sgNoCards")}</div>`:l}
      ${i?r`<div class="note" data-bridge-key-grant-code>${h("sgCode")} <bdi class="ltr" dir="ltr">${i}</bdi></div>`:l}
      <div class="row" data-bridge-key-grant-owner>
        <span class="val">${h("sgOwner")}</span>
        ${a?r`<a class="link" href=${ea({tab:"tools",tool:null})} data-bridge-key-grant-open>${h("sgOpen")}</a>`:l}
      </div>
    </div>`}async run(e){this.busy=!0,this.error="",this.saved=!1;try{await e()}catch(t){this.error=w(t)}finally{this.busy=!1}await this.load()}overall(e){return e.revocation?.state==="revoked"?["error",h("stateRevoked")]:e.watchdog?.length?["error",h("stateAttention")]:e.rotation&&tt.includes(e.rotation.state)?["partial",h("stateRotating")]:e.last&&(e.last.state==="needs_repair"||e.last.state==="verify_failed")?["error",h("stateAttention")]:e.key&&e.key.readable===!1?["error",h("stateAttention")]:e.enabled?["live",h("stateReady")]:["neutral",h("stateOff")]}renderOwners(e){const t=e.owner_contacts;if(!t)return l;const s=a=>void this.run(async()=>{await ns(a),this.saved=!0}),i=t.candidates.filter(a=>!t.ids.includes(a.id));return r`<div class="row" data-bridge-key-owners>
        <span class="lbl">${h("ownerContacts")}</span>
        <span class="acts">
          <span class="chips">${t.users.map(a=>r`<span class="chip ${a.valid?"":"invalid"}" data-bridge-key-owner=${a.id} title=${a.valid?"":h("ownerInvalid")}>${a.name}
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} aria-label=${`${h("ownerRemove")} ${a.name}`} data-bridge-key-owner-remove
              @click=${()=>s(t.ids.filter(n=>n!==a.id))}>${h("ownerRemove")}</sw-button></span>`)}</span>
          ${i.length&&t.ids.length<t.max?r`<select aria-label=${h("ownerAdd")} ?disabled=${this.busy} data-bridge-key-owner-add
                @change=${a=>{const n=a.target.value;n&&s([...t.ids,n])}}>
                <option value="" selected>${h("ownerAdd")}</option>
                ${i.map(a=>r`<option value=${a.id}>${a.name}</option>`)}
              </select>`:l}
        </span>
      </div>
      <div class="note" data-bridge-key-owners-note>${t.set?h("ownerReach",{n:t.recipients}):h("ownerNone")}</div>`}watchLine(e){return e.code==="generation_mismatch"?h("wd_generation_mismatch",{a:e.arx_generation??"",b:e.bridge_generation??""}):Le("wd_",e.code)}renderAsk(){if(!this.asking)return l;const e=this.asking;return r`<div class="row" data-bridge-key-confirm=${e}>
      <span class="val">${h(e==="hard_cut"?"confirmHardCut":"confirmRotate")}</span>
      <span class="acts">
        <sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-confirm-yes
          @click=${()=>{this.asking=null,this.run(()=>st(e))}}>${h("confirm")}</sw-button>
        <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.asking=null}>${h("cancel")}</sw-button>
      </span>
    </div>`}render(){if(this.notShown)return l;const e=this.s;if(!e)return this.error?r`<p class="err" role="alert">${this.error}</p>`:l;const[t,s]=this.overall(e),i=e.rotation,a=e.last,n=a&&a.state==="needs_repair"?a:null,p=e.blocked_by?Le("bl_",e.blocked_by):"";return r`<sw-card heading=${h("title")} data-bridge-key>
      <div class="row">
        <span class="lbl">${h("switchLabel")}</span>
        <span class="acts">
          <sw-badge kind=${t} label=${s} data-bridge-key-state></sw-badge>
          <sw-toggle controlled .checked=${e.enabled} ?disabled=${this.busy||!e.enabled&&!e.go_live_permitted} label=${h("switchLabel")} labelHidden
            data-bridge-key-switch @change=${d=>void this.run(()=>at({enabled:d.detail.checked}))}></sw-toggle>
        </span>
      </div>
      <div class="row">
        <span class="lbl">${h("keyId")}</span>
        <span class="val ltr" data-bridge-key-kid>${e.key?`${e.key.kid} · ${h("generation")} ${e.key.generation}`:h("none")}</span>
      </div>
      ${e.key?r`<div class="row"><span class="lbl">${h("since")}</span><span class="val">${We(e.key.activated_at??e.key.created_at)}</span></div>`:l}
      <div class="row">
        <span class="lbl">${h("lastRotation")}</span>
        <span class="val" data-bridge-key-last>${i??a?`${We((i??a).ended_at??(i??a).started_at)} · ${h((i??a).mode==="hard_cut"?"modeHardCut":"modeRoutine")} · ${Le("st_",(i??a).state)}`:h("none")}</span>
      </div>
      <div class="row" data-bridge-key-auto>
        <span class="val" role="status">${e.automatic==="awaiting_click"?h("autoAwaitClick"):e.automatic==="waiting_for_bridge"?h("autoWaiting"):e.automatic==="scheduled"?h("autoScheduled"):e.automatic==="idle"?h("autoIdle"):""}</span>
        ${e.automatic==="awaiting_click"&&e.can_start?r`<sw-button size="sm" variant="primary" ?disabled=${this.busy} data-bridge-key-start-first @click=${()=>void this.run(()=>st("routine"))}>${h("startFirst")}</sw-button>`:l}
      </div>
      ${is(e)?r`<div class="note" role="status" data-bridge-key-doors-paused>${h("doorsPaused")}</div>`:l}
      ${(e.watchdog??[]).map(d=>r`<div class="alert" role="alert" data-bridge-key-watchdog=${d.code}>${this.watchLine(d)}</div>`)}
      <div class="note" data-bridge-key-hygiene>${h("hygieneNote")}</div>
      ${i?.retire_at?r`<div class="note" role="status">${h("retireAt",{t:We(i.retire_at)})}</div>`:l}
      <div class="row">
        <span class="lbl">${h("reminder")}</span>
        <span class="acts">
          ${e.reminder_due?r`<sw-badge kind="stale" label=${h("reminderDue")} data-bridge-key-reminder-due></sw-badge>`:l}
          <select aria-label=${h("reminder")} ?disabled=${this.busy} data-bridge-key-reminder
            @change=${d=>{const $=Number(d.target.value);this.run(async()=>{await at({reminder_days:$}),this.saved=!0})}}>
            ${e.reminder_values.map(d=>r`<option value=${d} ?selected=${d===e.reminder_days}>${d?h("reminderDays",{n:d}):h("reminderOff")}</option>`)}
          </select>
        </span>
      </div>
      ${this.renderOwners(e)}
      ${e.hand_over?r`<div class="row" data-bridge-key-hand-over>
            <span class="lbl">${h("bridgeGen")}</span>
            <span class="val">${e.hand_over.bridge_generation??h("bridgeGenNone")}</span>
          </div>
          ${e.hand_over.last_rotation?.anchor_eligible&&!e.hand_over.anchor_decrease_available?r`<div class="note" data-bridge-key-anchor>${h("anchorUnavailable")}</div>`:l}`:l}
      ${this.renderAsk()}
      <div class="row">
        <span class="val" data-bridge-key-blocked>${p}</span>
        <span class="acts">
          ${n?r`<sw-button size="sm" ?disabled=${this.busy} data-bridge-key-resume @click=${()=>void this.run(()=>rs(n.id))}>${h("resume")}</sw-button>`:l}
          <sw-button size="sm" variant="primary" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-rotate
            @click=${()=>this.asking="routine"}>${h("rotate")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy||!e.can_start||!!this.asking} data-bridge-key-hard-cut
            @click=${()=>this.asking="hard_cut"}>${h("hardCut")}</sw-button>
        </span>
      </div>
      <sw-bridge-key-revoke .status=${e} data-bridge-key-revoke-section @changed=${()=>void this.load()}></sw-bridge-key-revoke>
      ${this.renderGrant()}
      ${this.error?r`<p class="err" role="alert">${this.error}</p>`:l}
      ${this.saved?r`<p class="ok" role="status">${h("saved")}</p>`:l}
    </sw-card>`}};Y.styles=j`
    ${ze}
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
    ${qe}
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
    .grant {
      border-block-start: 1px solid var(--sw-border);
      padding-block-start: var(--sw-s-1);
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
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
      .link {
        display: inline-flex;
        align-items: center;
        min-block-size: 44px;
      }
    }
  `;ce([c()],Y.prototype,"s",2);ce([c()],Y.prototype,"notShown",2);ce([c()],Y.prototype,"busy",2);ce([c()],Y.prototype,"error",2);ce([c()],Y.prototype,"asking",2);ce([c()],Y.prototype,"saved",2);ce([c()],Y.prototype,"grant",2);ce([c()],Y.prototype,"grantError",2);Y=ce([N("sw-bridge-key-card")],Y);const z="partners",mi=()=>q(`${z}/settings`),_t=e=>Ae(`${z}/settings`,e),bi=()=>q(`${z}/options`),wi=()=>q(`${z}/clients`),$i=e=>Q(`${z}/clients`,{label:e}),yi=(e,t)=>Q(`${z}/clients/${encodeURIComponent(e)}/state`,{state:t}),ki=e=>Nt(`${z}/clients/${encodeURIComponent(e)}`),xi=()=>q(`${z}/tokens`),_i=(e,t)=>Q(`${z}/clients/${encodeURIComponent(e)}/tokens`,t),zi=e=>Q(`${z}/tokens/${encodeURIComponent(e)}/rotate`,{}),Ci=e=>Q(`${z}/tokens/${encodeURIComponent(e)}/revoke`),Si=()=>q(`${z}/endpoints`),Ri=(e,t)=>Q(`${z}/clients/${encodeURIComponent(e)}/endpoints`,t),Oi=e=>Nt(`${z}/endpoints/${encodeURIComponent(e)}`),Ei=(e,t)=>Q(`${z}/endpoints/${encodeURIComponent(e)}/pause`,{paused:t}),Ni=e=>Q(`${z}/endpoints/${encodeURIComponent(e)}/secret/rotate`,{}),Pi=e=>Q(`${z}/endpoints/${encodeURIComponent(e)}/ping`),Ti=()=>q(`${z}/deliveries?limit=50`),Ii=()=>q(`${z}/outbox?state=dead&limit=50`),Di=e=>Q(`${z}/outbox/${encodeURIComponent(e)}/redeliver`),je={title:"ממשק לשותפים",stateOff:"כבוי",stateOn:"פעיל",stateBlocked:"ממתין לאישור הפעלה",apiSwitch:"גישת קריאה לשותפים",webhooksSwitch:"שליחת הודעות לשותפים",notPermitted:"ההפעלה דורשת סקירת אבטחה ואישור בעלים.",localOnly:"הפעלה רק מהרשת המקומית. כיבוי אפשרי מכל מקום.",tabPartners:"שותפים",tabTokens:"אסימונים",tabEndpoints:"יעדי הודעות",tabLog:"יומן משלוחים",tabSettings:"הגדרות",partner:"שותף",partnerName:"שם השותף",addPartner:"הוספת שותף",disable:"השבתה",enable:"הפעלה",remove:"מחיקה",confirmRemove:"למחוק? כל האסימונים והיעדים של השותף יבוטלו.",confirmRemoveEndpoint:"למחוק את היעד? הודעות שבתור לא יישלחו.",none:"אין",label:"תיאור",scopes:"הרשאות גישה",sc_tickets_read:"קריאת קריאות שירות",sc_tickets_create:"פתיחת קריאות שירות",sc_temperature_read:"יחידות טמפרטורה",sc_elevators_read:"מעליות",restriction:"תחום",rk_installation:"כל ההתקנה",rk_site:"אתרים",rk_building:"מבנים",rk_floor:"קומות",departments:"מחלקות",sourceCidrs:"כתובות מקור מותרות (אופציונלי)",expiresDays:"תוקף בימים",textOption:"כותרת ותיאור הקריאה",peopleOption:"שמות מבקש ומטפל",createToken:"יצירת אסימון",rotate:"החלפה",revoke:"ביטול",confirmRevoke:"לבטל את האסימון? השותף יאבד גישה מיד.",shownOnce:"מוצג פעם אחת בלבד. העתיקו ושמרו עכשיו.",copy:"העתקה",copied:"הועתק",close:"סגירה",expires:"בתוקף עד",lastUsed:"שימוש אחרון",st_active:"פעיל",st_expired:"פג תוקף",st_revoked:"בוטל",st_pending:"ממתין לבדיקה",st_paused:"מושהה",st_disabled:"מושבת",ownerGone:"יוצר האסימון אינו פעיל",url:"כתובת יעד (https, פורט {ports})",events:"אירועים",skipOwn:"לא לשלוח לשותף על קריאות שהוא פתח",createEndpoint:"הוספת יעד",ping:"בדיקה",pingOk:"הבדיקה הצליחה",pingFail:"הבדיקה נכשלה",pause:"השהיה",resume:"חידוש",rotateSecret:"החלפת סוד",queued:"בתור",dead:"נכשלו",redeliver:"שליחה חוזרת",attempt:"ניסיון",status:"תוצאה",ev_ticket_created:"קריאה נפתחה",ev_ticket_status_changed:"סטטוס קריאה השתנה",ev_ticket_done:"טיפול הסתיים",ev_temperature_alarm:"אזעקת טמפרטורה",ev_temperature_warning:"חריגת טמפרטורה",ev_temperature_offline:"חיישן טמפרטורה לא מדווח",ev_temperature_escalation:"הסלמת אזעקת טמפרטורה",ev_temperature_resolved:"טמפרטורה חזרה לתקינות",ev_elevator_fault:"תקלת מעלית",ev_elevator_out_of_service:"מעלית בהשבתה",ev_elevator_fire_service:"מעלית בפיקוד כבאים",ev_elevator_resolved:"מעלית חזרה לפעולה",v_token_default_days:"תוקף ברירת מחדל (ימים)",v_token_max_days:"תוקף מרבי (ימים)",v_max_endpoints:"מספר יעדים מרבי",v_rate_per_min:"בקשות לדקה לאסימון",v_rate_per_hour:"בקשות לשעה לאסימון",v_create_per_hour:"פתיחת קריאות לשעה",v_create_per_day:"פתיחת קריאות ליום",v_expiry_notice_days:"התראה לפני פקיעה (ימים)",v_rotation_overlap_hours:"חפיפה בהחלפה (שעות)",save:"שמירה",saved:"נשמר",cancel:"ביטול",choosePartner:"בחירת שותף"},Lt=zt("en","i18n/partners","en"),Ai={he:je,en:Lt,ar:{},ru:{}},Bi=["ar","ru"];function Je(){return Rt(["en","ar","ru"])}function v(e,t,s=Je()){const i=Ai[s][e]??je[e]??e;return St(i,t)}function F(e,t,s=Je()){const i=`${e}${t.replace(/\./g,"_")}`;return i in je?v(i,void 0,s):t}Ct("i18n/partners",{he:je,en:Lt},Bi);var ji=Object.defineProperty,Li=Object.getOwnPropertyDescriptor,S=(e,t,s,i)=>{for(var a=i>1?void 0:i?Li(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&ji(t,s,a),a};function Oe(e){if(!e)return"";const t=new Date(e),s=He(Je());return Number.isNaN(t.getTime())?e:t.toLocaleString(s,{day:"2-digit",month:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit"})}function Fe(e){return e==="active"?"live":e==="paused"||e==="pending"?"partial":e==="expired"||e==="revoked"||e==="disabled"?"neutral":"stale"}let _=class extends E{constructor(){super(...arguments),this.s=null,this.notShown=!1,this.busy=!1,this.error="",this.ok="",this.tab="partners",this.clients=[],this.tokens=[],this.endpoints=[],this.log=[],this.deadRows=[],this.opts=null,this.once=null,this.confirm=null,this.fClient="",this.fToken={client:"",label:"",scopes:new Set,kind:"installation",ids:new Set,depts:new Set,text:!0,people:!1,days:0,cidrs:""},this.fEp={client:"",label:"",url:"",events:new Set,kind:"installation",ids:new Set,skipOwn:!0},this.values={}}connectedCallback(){super.connectedCallback(),this.load()}get on(){return!!this.s&&(this.s.api_active||this.s.webhooks_active)}async load(){try{if(this.s=await mi(),this.values={...this.s.values},this.error="",this.on){const[e,t,s,i]=await Promise.all([wi(),xi(),Si(),bi()]);this.clients=e.items,this.tokens=t.items,this.endpoints=s.items,this.opts=i,this.tab==="log"&&await this.loadLog()}else this.tab!=="settings"&&(this.tab="settings")}catch(e){e.status===403?this.notShown=!0:this.error=w(e)}}async loadLog(){const[e,t]=await Promise.all([Ti(),Ii()]);this.log=e.items,this.deadRows=t.items}async run(e,t=""){this.busy=!0,this.error="",this.ok="";try{await e(),this.ok=t}catch(s){this.error=w(s)}finally{this.busy=!1}await this.load()}showOnce(e){this.once=e??null}toggleIn(e,t){const s=new Set(e);return s.has(t)?s.delete(t):s.add(t),s}clientName(e){return this.clients.find(t=>t.id===e)?.label??e}placeOptions(e){const t=this.opts;return t?e==="site"?t.sites:e==="building"?t.buildings:e==="floor"?t.floors:[]:[]}renderSwitches(e){const t=this.on?"live":e.go_live_permitted?"neutral":"partial",s=this.on?v("stateOn"):e.go_live_permitted?v("stateOff"):v("stateBlocked"),i=(a,n)=>r`<div class="row">
      <span class="lbl">${n}</span>
      <sw-toggle controlled .checked=${e[a]} ?disabled=${this.busy||!e[a]&&(!e.go_live_permitted||e.remote)} label=${n} labelHidden
        data-partner-switch=${a} @change=${p=>void this.run(()=>_t({[a]:p.detail.checked}))}></sw-toggle>
    </div>`;return r`<div class="row"><span class="lbl">${v("title")}</span><sw-badge kind=${t} label=${s} data-partner-state></sw-badge></div>
      ${i("api",v("apiSwitch"))}${i("webhooks",v("webhooksSwitch"))}
      ${e.go_live_permitted?l:r`<div class="note" role="status" data-partner-not-permitted>${v("notPermitted")}</div>`}
      ${e.go_live_permitted&&e.remote?r`<div class="note" role="status">${v("localOnly")}</div>`:l}`}renderTabs(){const e=this.on?["partners","tokens","endpoints","log","settings"]:["settings"],t={partners:v("tabPartners"),tokens:v("tabTokens"),endpoints:v("tabEndpoints"),log:v("tabLog"),settings:v("tabSettings")};return r`<div class="tabs" role="tablist">${e.map(s=>r`<button role="tab" aria-selected=${this.tab===s?"true":"false"} data-partner-tab=${s}
      @click=${()=>{this.tab=s,s==="log"&&this.loadLog()}}>${t[s]}</button>`)}</div>`}renderOnce(){if(!this.once)return l;const e=this.once;return r`<div class="once" role="alert" data-partner-once>
      <span class="val">${v("shownOnce")}</span>
      <code>${e}</code>
      <span class="acts">
        <sw-button size="sm" @click=${async()=>{try{await navigator.clipboard.writeText(e),this.ok=v("copied")}catch{}}}>${v("copy")}</sw-button>
        <sw-button size="sm" variant="ghost" data-partner-once-close @click=${()=>this.once=null}>${v("close")}</sw-button>
      </span>
    </div>`}renderConfirm(){if(!this.confirm)return l;const e=this.confirm;return r`<div class="row" data-partner-confirm><span class="val">${e.text}</span><span class="acts">
      <sw-button size="sm" variant="primary" ?disabled=${this.busy} @click=${()=>{this.confirm=null,this.run(e.run)}}>${e.action}</sw-button>
      <sw-button size="sm" variant="ghost" @click=${()=>this.confirm=null}>${v("cancel")}</sw-button></span></div>`}renderPartners(){return r`<div class="form">
        <input type="text" maxlength="80" .value=${this.fClient} placeholder=${v("partnerName")} aria-label=${v("partnerName")}
          @input=${e=>this.fClient=e.target.value} />
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!this.fClient.trim()} data-partner-add
          @click=${()=>void this.run(async()=>{await $i(this.fClient.trim()),this.fClient=""},v("saved"))}>${v("addPartner")}</sw-button></span>
      </div>
      <div class="list">${this.clients.length?this.clients.map(e=>r`<div class="row" data-partner-client=${e.id}>
        <span class="lbl">${e.label}</span>
        <span class="acts">
          <sw-badge kind=${Fe(e.state)} label=${F("st_",e.state)}></sw-badge>
          <span class="val">${v("tabTokens")} ${e.tokens} · ${v("tabEndpoints")} ${e.endpoints}</span>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>yi(e.id,e.state==="active"?"disabled":"active"))}>${e.state==="active"?v("disable"):v("enable")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:v("confirmRemove"),action:v("remove"),run:()=>ki(e.id)}}>${v("remove")}</sw-button>
        </span></div>`):r`<div class="note">${v("none")}</div>`}</div>`}renderRestriction(e,t,s,i){const a=this.s;return r`<span class="chips"><span class="val">${v("restriction")}</span>
        <select aria-label=${v("restriction")} @change=${n=>s(n.target.value)}>
          ${a.restriction_kinds.map(n=>r`<option value=${n} ?selected=${n===e}>${F("rk_",n)}</option>`)}
        </select></span>
      ${e!=="installation"?r`<span class="chips">${this.placeOptions(e).map(n=>r`<label><input type="checkbox" .checked=${t.has(n.id)}
        @change=${()=>i(this.toggleIn(t,n.id))} />${n.name}</label>`)}</span>`:l}`}renderTokens(){const e=this.fToken,t=this.s,s=[...e.scopes].some(n=>n.startsWith("tickets.")),i=!!e.client&&e.scopes.size>0&&(e.kind==="installation"||e.ids.size>0)&&(!e.scopes.has("tickets.create")||e.depts.size>0),a=()=>void this.run(async()=>{const n=e.cidrs.split(/[\s,]+/).map(d=>d.trim()).filter(Boolean),p=await _i(e.client,{label:e.label.trim()||void 0,scopes:[...e.scopes],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],departments:s?[...e.depts]:void 0,source_cidrs:n.length?n:void 0,personal:{ticket_text:e.text,ticket_people:e.people},expires_days:e.days>0?e.days:void 0});this.showOnce(p.token),this.fToken={...this.fToken,label:"",scopes:new Set,ids:new Set,depts:new Set,cidrs:"",days:0}},v("saved"));return r`<div class="form" data-partner-token-form>
        <span class="chips"><select aria-label=${v("choosePartner")} @change=${n=>this.fToken={...e,client:n.target.value}}>
          <option value="">${v("choosePartner")}</option>
          ${this.clients.filter(n=>n.state==="active").map(n=>r`<option value=${n.id} ?selected=${n.id===e.client}>${n.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${v("label")} aria-label=${v("label")} @input=${n=>this.fToken={...e,label:n.target.value}} /></span>
        <span class="chips"><span class="val">${v("scopes")}</span>${t.scopes.map(n=>r`<label><input type="checkbox" .checked=${e.scopes.has(n)}
          data-partner-scope=${n} @change=${()=>this.fToken={...e,scopes:this.toggleIn(e.scopes,n)}} />${F("sc_",n)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,n=>this.fToken={...e,kind:n,ids:new Set},n=>this.fToken={...e,ids:n})}
        ${s?r`<span class="chips"><span class="val">${v("departments")}</span>${(this.opts?.departments??[]).map(n=>r`<label><input type="checkbox" .checked=${e.depts.has(n.id)}
          @change=${()=>this.fToken={...e,depts:this.toggleIn(e.depts,n.id)}} />${n.name}</label>`)}</span>
          <span class="chips"><label><input type="checkbox" .checked=${e.text} @change=${()=>this.fToken={...e,text:!e.text}} />${v("textOption")}</label>
          <label><input type="checkbox" .checked=${e.people} data-partner-people @change=${()=>this.fToken={...e,people:!e.people}} />${v("peopleOption")}</label></span>`:l}
        <span class="chips"><label>${v("expiresDays")} <input type="number" min="1" max=${t.values.token_max_days??365} placeholder=${String(t.values.token_default_days??90)}
          .value=${e.days?String(e.days):""} @input=${n=>this.fToken={...e,days:Number(n.target.value)||0}} /></label>
          <input type="text" class="ltr" .value=${e.cidrs} placeholder=${v("sourceCidrs")} aria-label=${v("sourceCidrs")} @input=${n=>this.fToken={...e,cidrs:n.target.value}} /></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!i} data-partner-token-create @click=${a}>${v("createToken")}</sw-button></span>
      </div>
      <div class="list">${this.tokens.length?this.tokens.map(n=>r`<div class="row" data-partner-token=${n.id}>
        <span class="lbl">${this.clientName(n.client_id)}${n.label?` · ${n.label}`:""} <span class="val ltr">…${n.last4}</span></span>
        <span class="val">${n.scopes.map(p=>F("sc_",p)).join(", ")} · ${F("rk_",n.restriction_kind)} · ${v("expires")} ${Oe(n.expires_at)}${n.last_used_at?` · ${v("lastUsed")} ${Oe(n.last_used_at)}`:""}</span>
        <span class="acts">
          <sw-badge kind=${Fe(n.state)} label=${F("st_",n.state)}></sw-badge>
          ${n.owner_gone?r`<sw-badge kind="stale" label=${v("ownerGone")}></sw-badge>`:l}
          ${n.state==="active"?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await zi(n.id)).token))}>${v("rotate")}</sw-button>
            <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:v("confirmRevoke"),action:v("revoke"),run:()=>Ci(n.id)}}>${v("revoke")}</sw-button>`:l}
        </span></div>`):r`<div class="note">${v("none")}</div>`}</div>`}renderEndpoints(){const e=this.fEp,t=this.s,s=!!e.client&&e.url.startsWith("https://")&&e.events.size>0&&(e.kind==="installation"||e.ids.size>0),i=()=>void this.run(async()=>{const a=await Ri(e.client,{label:e.label.trim()||void 0,url:e.url.trim(),events:[...e.events],restriction_kind:e.kind,restriction_ids:e.kind==="installation"?void 0:[...e.ids],skip_own:e.skipOwn});this.showOnce(a.secret),this.fEp={...this.fEp,label:"",url:"",events:new Set,ids:new Set}},v("saved"));return r`<div class="form" data-partner-endpoint-form>
        <span class="chips"><select aria-label=${v("choosePartner")} @change=${a=>this.fEp={...e,client:a.target.value}}>
          <option value="">${v("choosePartner")}</option>
          ${this.clients.filter(a=>a.state==="active").map(a=>r`<option value=${a.id} ?selected=${a.id===e.client}>${a.label}</option>`)}
        </select>
        <input type="text" maxlength="80" .value=${e.label} placeholder=${v("label")} aria-label=${v("label")} @input=${a=>this.fEp={...e,label:a.target.value}} /></span>
        <input type="url" class="ltr" maxlength="2048" .value=${e.url} placeholder=${v("url",{ports:t.allowed_ports.join(" / ")})} aria-label=${v("url",{ports:t.allowed_ports.join(" / ")})}
          data-partner-url @input=${a=>this.fEp={...e,url:a.target.value}} />
        <span class="chips"><span class="val">${v("events")}</span>${t.event_types.map(a=>r`<label><input type="checkbox" .checked=${e.events.has(a)}
          @change=${()=>this.fEp={...e,events:this.toggleIn(e.events,a)}} />${F("ev_",a)}</label>`)}</span>
        ${this.renderRestriction(e.kind,e.ids,a=>this.fEp={...e,kind:a,ids:new Set},a=>this.fEp={...e,ids:a})}
        <span class="chips"><label><input type="checkbox" .checked=${e.skipOwn} @change=${()=>this.fEp={...e,skipOwn:!e.skipOwn}} />${v("skipOwn")}</label></span>
        <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy||!s} data-partner-endpoint-create @click=${i}>${v("createEndpoint")}</sw-button></span>
      </div>
      <div class="list">${this.endpoints.length?this.endpoints.map(a=>r`<div class="row" data-partner-endpoint=${a.id}>
        <span class="lbl">${this.clientName(a.client_id)}${a.label?` · ${a.label}`:""} <span class="val ltr">${a.host}</span></span>
        <span class="val">${a.events.map(n=>F("ev_",n)).join(", ")} · ${v("queued")} ${a.queued} · ${v("dead")} ${a.dead}</span>
        <span class="acts">
          <sw-badge kind=${Fe(a.state)} label=${F("st_",a.state)}></sw-badge>
          <sw-button size="sm" ?disabled=${this.busy||!t.webhooks_active} @click=${()=>void this.run(async()=>{if((await Pi(a.id)).state!=="delivered")throw new Error(v("pingFail"))},v("pingOk"))}>${v("ping")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>Ei(a.id,a.state!=="paused"))}>${a.state==="paused"?v("resume"):v("pause")}</sw-button>
          <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(async()=>this.showOnce((await Ni(a.id)).secret))}>${v("rotateSecret")}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${()=>this.confirm={text:v("confirmRemoveEndpoint"),action:v("remove"),run:()=>Oi(a.id)}}>${v("remove")}</sw-button>
        </span></div>`):r`<div class="note">${v("none")}</div>`}</div>`}renderLog(){return r`<div class="list" data-partner-log>
      ${this.deadRows.map(e=>r`<div class="row"><span class="val">${Oe(e.occurred_at)} · ${F("ev_",e.type)} · ${e.dead_reason??""}</span>
        <sw-button size="sm" ?disabled=${this.busy} @click=${()=>void this.run(()=>Di(e.id))}>${v("redeliver")}</sw-button></div>`)}
      ${this.log.length?this.log.map(e=>r`<div class="row"><span class="val">${Oe(e.started_at)} · ${F("ev_",e.type)} · ${v("attempt")} ${e.attempt}</span>
        <span class="val ltr">${e.http_status??""} ${e.error_class??""} · ${e.duration_ms} ms</span></div>`):r`<div class="note">${v("none")}</div>`}
    </div>`}renderSettings(){const e=this.s;return r`<div class="form" data-partner-settings>
      ${Object.keys(e.values).map(t=>r`<label class="row"><span class="val">${F("v_",t)}</span>
        <input type="number" min=${e.ranges[t]?.[0]??0} max=${e.ranges[t]?.[1]??0} .value=${String(this.values[t]??e.values[t])}
          @input=${s=>this.values={...this.values,[t]:Number(s.target.value)}} /></label>`)}
      <span class="acts"><sw-button size="sm" variant="primary" ?disabled=${this.busy} data-partner-settings-save
        @click=${()=>{const t=Object.fromEntries(Object.entries(this.values).filter(([s,i])=>i!==e.values[s]));this.run(()=>_t({values:t}),v("saved"))}}>${v("save")}</sw-button></span>
    </div>`}render(){if(this.notShown)return l;const e=this.s;if(!e)return this.error?r`<p class="err" role="alert">${this.error}</p>`:l;const t={partners:()=>this.renderPartners(),tokens:()=>this.renderTokens(),endpoints:()=>this.renderEndpoints(),log:()=>this.renderLog(),settings:()=>this.renderSettings()}[this.tab]();return r`<sw-card heading=${v("title")} data-partner-api>
      ${this.renderSwitches(e)}
      ${this.renderTabs()}
      ${this.renderOnce()}
      ${this.renderConfirm()}
      ${t}
      ${this.error?r`<p class="err" role="alert">${this.error}</p>`:l}
      ${this.ok?r`<p class="ok" role="status">${this.ok}</p>`:l}
    </sw-card>`}};_.styles=j`
    ${ze}
    .row { display: flex; align-items: center; justify-content: space-between; gap: 8px 14px; padding: 8px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); min-inline-size: 0; overflow-wrap: anywhere; }
    .val, .note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; overflow-wrap: anywhere; }
    ${qe}
    .acts { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .tabs { display: flex; gap: 4px; flex-wrap: wrap; padding-block: 8px; border-block-end: 1px solid var(--sw-border); }
    .tabs button { font: inherit; font-size: var(--sw-fs-sm); min-block-size: 32px; padding-inline: 10px; border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); cursor: pointer; }
    .tabs button[aria-selected='true'] { background: var(--sw-accent); color: var(--sw-text-inverse); border-color: transparent; }
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
  `;S([c()],_.prototype,"s",2);S([c()],_.prototype,"notShown",2);S([c()],_.prototype,"busy",2);S([c()],_.prototype,"error",2);S([c()],_.prototype,"ok",2);S([c()],_.prototype,"tab",2);S([c()],_.prototype,"clients",2);S([c()],_.prototype,"tokens",2);S([c()],_.prototype,"endpoints",2);S([c()],_.prototype,"log",2);S([c()],_.prototype,"deadRows",2);S([c()],_.prototype,"opts",2);S([c()],_.prototype,"once",2);S([c()],_.prototype,"confirm",2);S([c()],_.prototype,"fClient",2);S([c()],_.prototype,"fToken",2);S([c()],_.prototype,"fEp",2);S([c()],_.prototype,"values",2);_=S([N("sw-partner-api-card")],_);var Mi=Object.defineProperty,Vi=Object.getOwnPropertyDescriptor,k=(e,t,s,i)=>{for(var a=i>1?void 0:i?Vi(t,s):t,n=e.length-1,p;n>=0;n--)(p=e[n])&&(a=(i?p(t,s,a):p(a))||a);return i&&a&&Mi(t,s,a),a};const Wi=[{key:"go2rtc_url",label:o("כתובת go2rtc")},{key:"go2rtc_api_username",label:o("משתמש go2rtc (אם מוגן)")},{key:"wiskey_username",label:o("משתמש עמדות WisKey (מצלמות)")},{key:"bootstrap_admin_username",label:o("שם משתמש של המנהל הראשון")},{key:"log_level",label:o("רמת לוג")}];function he(e){if(!e)return"—";const t=new Date(e);return Number.isNaN(t.getTime())?String(e):t.toLocaleString(Ot(),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"})}let b=class extends E{constructor(){super(...arguments),this.bubbleSkin=new os(this),this.raw=null,this.report=null,this.recorder=null,this.error="",this.busy=!1,this.notify=null,this.notifyError="",this.notifyPlan=null,this.notifyBusy=!1,this.notifyResult="",this.sys=null,this.sysRecorder="nvr-1",this.sysRecorders=[],this.sysError="",this.sysMsg="",this.sysBusy=!1,this.ntpForm=null,this.rebootWord="",this.rebootOpen=!1,this.changes=[],this.wiskey=null,this.wiskeyError="",this.wiskeyForm=null,this.wiskeyClear=null,this.wiskeyMsg="",this.wiskeyBusy=!1,this.sysOk=!0,this.notifyOk=!0,this.wiskeyOk=!0}get sysApi(){return Se(this.sysRecorder)}static statusLine(e,t,s){const i=r`<sw-icon name=${t===!0?"check":"warning"} size=${13}></sw-icon>`;if(s==="data-nvr-system-msg"){const a=t==="warn"?"warn":t?"ok":"err";return r`<div class=${`msg ${a}`} role=${t===!0?"status":"alert"} data-nvr-system-msg=${a}>${i}${e}</div>`}if(s==="data-nvr-result"){const a=t==="warn"?"warn":t?"ok":"err";return r`<div class=${`msg ${a}`} role=${t===!0?"status":"alert"} data-nvr-result=${a}>${i}${e}</div>`}return r`<div class=${`msg ${t?"ok":"err"}`} role=${t?"status":"alert"} data-wiskey-cred-msg>${i}${e}</div>`}connectedCallback(){super.connectedCallback(),we()&&this.load()}async load(){this.loadNvr(),this.loadWiskey(),this.busy=!0;try{this.raw=await q("health"),this.error=""}catch(e){this.error=w(e)}try{const e=it()?null:await ls();this.recorder=e?.recorder??null,this.sysRecorders=e?.recorders??[]}catch{this.recorder=null}try{this.report=await ds()}catch{this.report=null}this.busy=!1}check(e){return this.report?.checks.find(t=>t.id===e)??null}row(e,t,s=""){return r`<div class="check"><span>${e}</span><span class=${`val ${s}`}>${t==null||t===""?"—":String(t)}</span></div>`}static writesOffHint(e){return r`<div class="hint" role="note" data-nvr-writes-off=${e}><sw-icon name="lock" size=${13}></sw-icon> ${o("שינויי הגדרות ב־NVR כבויים עבור המקליט הזה. אפשר להפעיל אותם בהגדרות החיבור של ה־NVR.")}</div>`}sectionHead(e,t){return r`<div class="syshead"><sw-icon name=${e} size=${15}></sw-icon>${t}</div>`}async loadNvr(){if(we()&&!it()){try{const[e,t]=await Promise.all([gs(),nt(10)]);this.notify=e,this.changes=t.changes,this.notifyError=""}catch(e){this.notifyError=w(e)}this.loadSystem()}}get sysVendor(){return this.sysRecorders.find(e=>e.id===this.sysRecorder)?.vendor??this.sys?.vendor??null}async loadSystem(){if(this.sysRecorders.find(t=>t.id===this.sysRecorder)?.vendor==="frigate"){this.sys=null,this.sysError="";return}const e=this.sysRecorder;try{const t=await Se(e).nvrSystem();if(e!==this.sysRecorder)return;this.sys=t,this.sysError=""}catch(t){if(e!==this.sysRecorder)return;this.sysError=w(t)}}recorderName(e){return this.sysRecorders.length>1?this.sysRecorders.find(t=>t.id===e)?.name??e:""}async pulse(e){if(this.sysBusy)return;const t=this.sysRecorder,s=o("יציאה {id}{v}",{id:e.id,v:e.name?` · ${e.name}`:""}),i=this.recorderName(t);!await ot({heading:o("הפעלת יציאת אזעקה"),body:[o("להפעיל עכשיו את {output}{rec}?",{output:s,rec:i?o(" ב־{name}",{name:i}):""}),o("זהו ממסר פיזי: הוא עשוי להפעיל צופר, תאורה או שער{v}.",{v:e.pulse_ms?o(" למשך {v} שנ׳",{v:e.pulse_ms/1e3}):""}),o("הפעולה נרשמת באודיט עם שם המשתמש.")].join(`
`),confirmLabel:o("הפעל את היציאה"),danger:!0,focusCancel:!0})||t!==this.sysRecorder||this.sysAction(o("הפעלת יציאה {id}",{id:e.id}),()=>Se(t).pulseNvrOutput(e.id),!0)}async sysAction(e,t,s=!1){if(this.sysBusy)return;this.sysBusy=!0,this.sysMsg="";const i=()=>s?o("{label}: ה־NVR אישר את הפקודה · נרשם באודיט.",{label:e}):o("{label}: בוצע ונרשם באודיט.",{label:e});let a=!1;try{await t(),a=!0,await Promise.all([this.loadSystem(),nt(10).then(n=>this.changes=n.changes)]),this.sysOk=!0,this.sysMsg=i()}catch(n){a?(this.sysOk=!0,this.sysMsg=i()):s&&ws(n)==="unknown"?(this.sysOk="warn",this.sysMsg=`${e}: ${o("לא ידוע אם הפעולה בוצעה · בדקו במקום לפני הפעלה חוזרת")}`):(this.sysOk=!1,this.sysMsg=`${e}: ${w(n)}`)}finally{this.sysBusy=!1}}renderSystemCard(){const e=this.sys,t=a=>`${(a/1024).toFixed(0)} GB`,s=e?.time?.drift_s??null,i=s===null?"":Math.abs(s)<=2?"ok":Math.abs(s)<=30?"warn":"err";return r`<sw-card heading=${o("מערכת ה־NVR")} subheading=${o("שעון ו־NTP, דיסקים ובדיקת S.M.A.R.T., יציאות אזעקה, הפעלה מחדש · כל כתיבה דורשת הרשאה רגישה ונרשמת")} data-nvr-system>
      ${this.sysRecorders.length>1?r`<sw-field label="NVR"><select data-nvr-system-recorder ?disabled=${this.sysBusy} @change=${a=>{this.sysRecorder=a.target.value,this.sys=null,this.sysMsg="",this.loadSystem()}}>
            ${this.sysRecorders.map(a=>r`<option value=${a.id} ?selected=${a.id===this.sysRecorder}>${a.name}</option>`)}
          </select></sw-field>`:l}
      ${this.sysVendor==="frigate"?r`<frigate-summary recorder-id=${this.sysRecorder} data-nvr-system-frigate></frigate-summary>`:e&&e.supported===!1?r`<div class="hint" data-nvr-system-unsupported>${o("פרטי השעון, הדיסקים והיציאות אינם זמינים עבור מקליט מסוג זה.")}</div>`:r`${this.sysError?r`<div class="msg err" role="alert" data-nvr-system-error><sw-icon name="warning" size=${13}></sw-icon>${this.sysError}</div>`:l}
      ${e?r`
          ${this.sectionHead("clock",o("שעון"))}
          ${e.time?r`${this.row(o("שעון ה־NVR"),`${e.time.local_time??"—"} · ${e.time.mode==="NTP"?"NTP":o("ידני")}`)}
                ${this.row(o("סטייה מול שעון השרת"),s===null?"—":o("{v}{drift} שנ׳",{v:s>0?"+":"",drift:s}),i)}
                ${this.row(o("שרת NTP"),e.time.ntp?o("{v}:{port} · כל {interval_min} דק׳",{v:e.time.ntp.host??"—",port:e.time.ntp.port,interval_min:e.time.ntp.interval_min}):"—")}
                ${e.can.time?r`<div class="actions">
                      <sw-button size="sm" icon="clock" ?disabled=${this.sysBusy} data-nvr-sync-clock @click=${()=>this.sysAction(o("סנכרון השעון"),()=>this.sysApi.setNvrTime({sync_now:!0}))}>${o("סנכרן לשעון השרת עכשיו")}</sw-button>
                      <sw-button size="sm" variant="ghost" ?disabled=${this.sysBusy} data-nvr-ntp-edit @click=${()=>this.ntpForm=this.ntpForm?null:{host:e.time?.ntp?.host??"",port:e.time?.ntp?.port??123,interval_min:e.time?.ntp?.interval_min||1440}}>${o("שרת NTP…")}</sw-button>
                    </div>
                    ${this.ntpForm?r`<div class="two" data-nvr-ntp-form>
                          <sw-field label=${o("שרת NTP")}><input data-ltr .value=${this.ntpForm.host} @input=${a=>this.ntpForm={...this.ntpForm,host:a.target.value}} /></sw-field>
                          <sw-field label=${o("מרווח (דקות)")}><input type="number" min="1" max="10080" data-ltr .value=${String(this.ntpForm.interval_min)} @input=${a=>this.ntpForm={...this.ntpForm,interval_min:Number(a.target.value)}} /></sw-field>
                          <div class="actions"><sw-button size="sm" variant="primary" ?disabled=${this.sysBusy||!this.ntpForm.host} data-nvr-ntp-save @click=${()=>{const a=this.ntpForm;this.sysAction(o("שרת NTP"),async()=>{await this.sysApi.setNvrNtp({host:a.host.trim(),port:a.port,interval_min:a.interval_min}),this.ntpForm=null})}}>${o("כתוב ל־NVR")}</sw-button></div>
                        </div>`:l}`:e.writes_enabled===!1?b.writesOffHint("time"):r`<div class="hint">${o("כתיבת שעון / NTP: הרשאה nvr.config.time (תפקיד מותאם).")}</div>`}`:r`<div class="hint">${o("השעון לא נקרא{v}.",{v:e.errors.time?` (${e.errors.time})`:""})}</div>`}
          ${this.sectionHead("storage",o("דיסקים ו־S.M.A.R.T."))}
          ${e.disks.length?e.disks.map(a=>r`<div data-nvr-disk=${a.id}>
                ${this.row(`${a.name} (${a.type})`,o("{status} · {gb} · פנוי {gb2} ({v}%)",{status:a.status,gb:t(a.capacity_mb),gb2:t(a.free_mb),v:a.capacity_mb?Math.round(a.free_mb/a.capacity_mb*100):0}),a.status==="ok"?"ok":"warn")}
                ${a.smart?this.row("S.M.A.R.T.",o("{v} · {v2}°C · {v3} ימי פעילות{v4}",{v:a.smart.all_eval??"—",v2:a.smart.temperature_c??"—",v3:a.smart.power_on_days??"—",v4:a.smart.test_status?o(" · בדיקה: {test_status} {test_percent}%",{test_status:a.smart.test_status,test_percent:a.smart.test_percent}):""}),a.smart.all_eval==="functional"?"ok":"warn"):this.row("S.M.A.R.T.",o("לא זמין"))}
                ${e.can.storage?r`<div class="actions"><sw-button size="sm" icon="storage" ?disabled=${this.sysBusy} data-nvr-smart-test=${a.id} @click=${()=>this.sysAction(o("בדיקת S.M.A.R.T. קצרה"),()=>this.sysApi.startSmartTest(a.id,"short"))}>${o("בדיקת S.M.A.R.T. קצרה")}</sw-button><span class="hint">${o("מעמיסה את הדיסק בזמן ריצתה; מומלץ בשעות שקטות")}</span></div>`:l}
              </div>`):r`<div class="hint">${o("לא נקראו דיסקים{v}.",{v:e.errors.disks?` (${e.errors.disks})`:""})}</div>`}
          ${this.sectionHead("bell",o("יציאות אזעקה"))}
          ${e.outputs.length?e.outputs.map(a=>r`<div class="check" data-nvr-output=${a.id}><span>${o("יציאה {id}{v}",{id:a.id,v:a.name?` · ${a.name}`:""})} <span class="hint">${a.io_type==="local"?o("ממסר ב־NVR"):o("במצלמה")} · ${a.use_type==="whiteLight"?o("אור לבן"):a.use_type==="disable"?o("לא בשימוש"):a.use_type}${a.pulse_ms?o(" · פולס {v} שנ׳",{v:a.pulse_ms/1e3}):""}</span></span>
                ${a.pulse_supported?e.can.alarm?r`<sw-button size="sm" icon="bell" ?disabled=${this.sysBusy||!a.enabled} data-nvr-pulse=${a.id} @click=${()=>void this.pulse(a)}>${o("הפעל (pulse)")}</sw-button>`:r`<span class="val">${a.enabled?o("פעיל"):o("כבוי")}</span>`:r`<span class="val" data-nvr-output-unsupported>${o("הפעלה דרך המצלמה בלבד (ה־NVR לא מעביר)")}</span>`}
              </div>`):r`<div class="hint">${o("אין יציאות{v}.",{v:e.errors.outputs?` (${e.errors.outputs})`:""})}</div>`}
          ${this.sectionHead("refresh",o("הפעלה מחדש"))}
          ${e.can.reboot?r`<div class="actions"><sw-button size="sm" variant="danger" icon="refresh" ?disabled=${this.sysBusy} data-nvr-reboot @click=${()=>{this.rebootWord="",this.rebootOpen=!0}}>${o("הפעל מחדש את ה־NVR…")}</sw-button><span class="hint">${o("1–2 דקות בלי לייב ובלי הקלטה")}</span></div>`:e.writes_enabled===!1?b.writesOffHint("reboot"):r`<div class="hint">${o("הפעלה מחדש: הרשאה nvr.system.reboot (תפקיד מותאם).")}</div>`}
          ${this.sysMsg?b.statusLine(this.sysMsg,this.sysOk,"data-nvr-system-msg"):l}`:this.sysError?l:r`<div class="hint">${o("קורא את מצב המערכת מה־NVR…")}</div>`}`}
      ${this.rebootOpen?r`<sw-dialog open heading=${o("הפעלה מחדש של ה־NVR")} subheading=${this.recorderName(this.sysRecorder)?`${this.recorderName(this.sysRecorder)} · ${o("במשך 1–2 דקות אין לייב ואין הקלטה")}`:o("במשך 1–2 דקות אין לייב ואין הקלטה")} data-nvr-reboot-dialog @close=${()=>this.rebootOpen=!1}>
            <div class="dlgtext">${o("הקלד")} <b>RESTART</b> ${o("כדי לאשר. הפעולה נרשמת באודיט עם שם המשתמש.")}</div>
            <sw-field label=${o("אישור")}><input data-ltr data-nvr-reboot-word .value=${this.rebootWord} @input=${a=>this.rebootWord=a.target.value} /></sw-field>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.sysBusy||this.rebootWord.trim().toUpperCase()!=="RESTART"} data-nvr-reboot-run @click=${()=>{const a=this.rebootWord,n=this.sysRecorder;this.rebootOpen=!1,this.sysAction(o("הפעלה מחדש"),()=>Se(n).rebootNvr(a),!0)}}>${o("הפעל מחדש")}</sw-button><sw-button variant="ghost" @click=${()=>this.rebootOpen=!1}>${o("ביטול")}</sw-button></div>
          </sw-dialog>`:l}
    </sw-card>`}async loadWiskey(){if(O("system.configure"))try{this.wiskey=await cs(),this.wiskeyError=""}catch(e){this.wiskeyError=b.wiskeyFailure(o("רשימת העמדות לא נטענה"),e)}}static wiskeyFailure(e,t){return`${e}: ${w(t)}${t instanceof Ee?` (${t.code})`:""}`}wiskeyName(e){return this.wiskey?.stations.find(s=>s.station_id===e)?.name||e}async saveWiskey(){const e=this.wiskeyForm;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await ps(e.station_id,{username:e.username.trim(),password:e.password}),this.wiskeyForm=null,this.wiskeyOk=!0,this.wiskeyMsg=o("החשבון של {wiskeyName} נשמר; התמונה מהמצלמה תילקח מחדש איתו.",{wiskeyName:this.wiskeyName(e.station_id)}),await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=b.wiskeyFailure(o("לא נשמר"),t)}finally{this.wiskeyBusy=!1}}}async clearWiskey(){const e=this.wiskeyClear;if(!(!e||this.wiskeyBusy)){this.wiskeyBusy=!0,this.wiskeyMsg="";try{await hs(e.station_id),this.wiskeyClear=null,this.wiskeyOk=!0,this.wiskeyMsg=e.known?o("החשבון של {v} הוסר; העמדה חוזרת לחשבון המשותף.",{v:e.name||e.station_id}):o("הרשומה של {station_id} הוסרה.",{station_id:e.station_id}),await this.loadWiskey()}catch(t){this.wiskeyOk=!1,this.wiskeyMsg=b.wiskeyFailure(o("לא הוסר"),t)}finally{this.wiskeyBusy=!1}}}renderWiskeyStation(e,t){const s=this.wiskeyForm?.station_id===e.station_id?this.wiskeyForm:null,i=e.override?"override":t.default_configured?"default":"none",a=e.override?o("חשבון משלה · מאז {when}",{when:he(e.override_updated_at)}):t.default_configured?o("החשבון המשותף"):o("אין חשבון · אין תמונה מהמצלמה");return r`<div data-wiskey-station=${e.station_id} data-wiskey-cred-state=${i}>
      <div class="check">
        <span>${e.name||e.station_id}${e.known?e.has_camera?l:r` <span class="hint">${o("· ללא מצלמה")}</span>`:r` <span class="hint" data-wiskey-cred-unknown>${o("· לא ברשימת העמדות של WisKey כרגע")}</span>`}</span>
        <span class=${`val ${e.override?"ok":t.default_configured?"":"warn"}`} data-wiskey-cred-status>${a}</span>
      </div>
      ${s?r`<div class="two" data-wiskey-cred-form>
            <sw-field label=${o("משתמש")}><input data-ltr data-wiskey-cred-user autocomplete="off" .value=${s.username} @input=${n=>this.wiskeyForm={...s,username:n.target.value}} /></sw-field>
            <sw-field label=${o("סיסמה")}><input type="password" data-ltr data-wiskey-cred-password autocomplete="new-password" .value=${s.password} @input=${n=>this.wiskeyForm={...s,password:n.target.value}} /></sw-field>
            <div class="actions">
              <sw-button size="sm" variant="primary" icon="check" ?disabled=${this.wiskeyBusy||!s.username.trim()||!s.password} data-wiskey-cred-save @click=${()=>this.saveWiskey()}>${this.wiskeyBusy?o("שומר…"):o("שמור")}</sw-button>
              <sw-button size="sm" variant="ghost" ?disabled=${this.wiskeyBusy} data-wiskey-cred-cancel @click=${()=>this.wiskeyForm=null}>${o("ביטול")}</sw-button>
            </div>
            <div class="hint">${o("החשבון נשמר בבסיס הנתונים של Arx ואינו מוצג שוב; השמירה נרשמת באודיט בלי הסיסמה. החשבון אינו נבדק מול העמדה - אם הוא שגוי, במרכז הכניסה לא תהיה תמונה מהמצלמה.")}</div>
          </div>`:r`<div class="actions">
            ${e.known?r`<sw-button size="sm" icon="edit" ?disabled=${this.wiskeyBusy} data-wiskey-cred-edit @click=${()=>{this.wiskeyMsg="",this.wiskeyForm={station_id:e.station_id,username:"",password:""}}}>${e.override?o("החלפת החשבון…"):o("חשבון משלה לעמדה…")}</sw-button>`:l}
            ${e.override?r`<sw-button size="sm" variant="ghost" icon="trash" ?disabled=${this.wiskeyBusy} data-wiskey-cred-clear @click=${()=>{this.wiskeyMsg="",this.wiskeyClear=e}}>${e.known?o("חזרה לחשבון המשותף"):o("הסרת הרשומה")}</sw-button>`:l}
          </div>`}
    </div>`}renderWiskeyCard(){if(!O("system.configure"))return l;const e=this.wiskey,t=this.wiskeyClear;return r`<sw-card heading=${o("מצלמות עמדות WisKey")} subheading=${o("חשבון ה־RTSP שאיתו go2rtc מושך את מצלמת כל עמדה: המשותף שהוגדר בתשתית המערכת, או חשבון משלה לעמדה שצריכה אחר · הערכים עצמם אינם מוצגים")} data-wiskey-credentials>
      ${this.wiskeyError?r`<div class="msg err" role="alert" data-wiskey-cred-error><sw-icon name="warning" size=${13}></sw-icon>${this.wiskeyError}</div>`:l}
      ${e?r`${this.row(o("חשבון משותף (wiskey_username, הסיסמה בכרטיס סודות)"),e.default_configured?o("מוגדר"):o("לא מוגדר"),e.default_configured?"ok":"warn")}
          ${e.state!=="ready"?r`<div class="hint" data-wiskey-cred-feed=${e.state}>${o("WisKey אינו מחובר כרגע (מצב:")} <span class="ltr">${e.state}</span>${o("); מוצג מה שידוע ל־Arx.")}</div>`:l}
          ${e.stations.length?e.stations.map(s=>this.renderWiskeyStation(s,e)):r`<div class="hint" data-wiskey-cred-empty>${o("אין עמדות ברשימה.")}</div>`}
          ${this.wiskeyMsg?b.statusLine(this.wiskeyMsg,this.wiskeyOk,"data-wiskey-cred-msg"):l}`:this.wiskeyError?l:r`<div class="hint">${o("קורא את רשימת העמדות…")}</div>`}
      ${t?r`<sw-dialog open heading=${o("הסרת החשבון של העמדה")} subheading=${t.name||t.station_id} data-wiskey-cred-confirm @close=${()=>this.wiskeyClear=null}>
            <div class="dlgtext">${o("{v} ההסרה נרשמת באודיט.",{v:t.known?e?.default_configured?o("העמדה תחזור לחשבון המשותף, והתמונה מהמצלמה תילקח מחדש איתו."):o("לעמדה לא יישאר חשבון, ולא תהיה ממנה תמונה עד שיוגדר אחד."):o("הרשומה תימחק מבסיס הנתונים של Arx.")})}</div>
            <div slot="footer"><sw-button variant="danger" ?disabled=${this.wiskeyBusy} data-wiskey-cred-confirm-run @click=${()=>this.clearWiskey()}>${this.wiskeyBusy?o("מסיר…"):o("הסר")}</sw-button><sw-button variant="ghost" @click=${()=>this.wiskeyClear=null}>${o("ביטול")}</sw-button></div>
          </sw-dialog>`:l}
    </sw-card>`}renderConnectionCard(){return O("system.configure")?r`<nvr-recorders-card></nvr-recorders-card>`:l}planNotify(e,t,s){const i=e?e.length:this.notify?.channels.length??0;this.notifyResult="",this.notifyPlan={channels:e,smart:t,enabled:s,label:o("{v} Notify Surveillance Center ב־{n} ערוצים{v2}",{v:s?o("הפעלת"):o("כיבוי"),n:i,v2:t?o(" · תנועה + אירועים חכמים"):o(" · זיהוי תנועה")})}}async runNotify(){const e=this.notifyPlan;if(!(!e||this.notifyBusy)){this.notifyBusy=!0;try{const t=await ms({channels:e.channels,smart:e.smart,enabled:e.enabled});this.notifyOk=!t.failed,this.notifyResult=o("בוצע: {applied} שינויים · {unchanged} כבר היו כך · {skipped} דולגו (סוג אירוע שלא מוגדר בערוץ) · {failed} נכשלו",{applied:t.applied,unchanged:t.unchanged,skipped:t.skipped,failed:t.failed}),this.notifyPlan=null,await this.loadNvr()}catch(t){this.notifyOk=!1,this.notifyResult=w(t)}finally{this.notifyBusy=!1}}}async rollback(e,t=!1){if(this.notifyBusy)return;this.notifyBusy=!0;let s=null;try{await bs(e.id,t),this.notifyOk=!0,this.notifyResult=t?o("השינוי {target} הוחזר למצב הקודם בכל זאת · נרשם באודיט.",{target:e.target}):o("השינוי {target} הוחזר למצב הקודם.",{target:e.target}),await this.loadNvr()}catch(a){const n=a instanceof Ee?a.code:"";n==="changed_since"&&!t?(s=w(a),this.notifyOk="warn",this.notifyResult=`${s} ${o("לא נכתב דבר ל־NVR.")}`):n==="already_rolled_back"?(this.notifyOk="warn",this.notifyResult=o("השינוי {target} כבר הוחזר קודם לכן · לא נכתב דבר ל־NVR.",{target:e.target}),await this.loadNvr()):(this.notifyOk=!1,this.notifyResult=w(a))}finally{this.notifyBusy=!1}if(s===null)return;await ot({heading:o("החזרת שינוי ב־NVR"),body:[s,o("החזרה בכל זאת תכתוב ל־NVR את המצב שלפני השינוי {target} ותדרוס את מה שמוגדר בו עכשיו.",{target:e.target}),o("הפעולה נרשמת באודיט עם שם המשתמש.")].join(`
`),confirmLabel:o("החזר בכל זאת"),danger:!0,focusCancel:!0})&&await this.rollback(e,!0)}renderNotifyCard(){const e=this.notify,t=i=>i===null?"—":r`<span class=${`yn ${i?"on":"off"}`} part=${`yn ${i?"yn-on":"yn-off"}`} role="img" aria-label=${i?o("נשלחת"):o("לא נשלחת")}><sw-icon name=${i?"check":"close"} size=${12}></sw-icon></span>`,s=[{key:"channel",label:o("ערוץ"),kind:"num",align:"start"},{key:"name",label:o("מצלמה"),cellAttrs:()=>({"data-nvr-cam":!0})},{key:"motion",label:o("תנועה"),cellAttrs:i=>({"data-nvr-motion":i.motion.supported?String(i.motion.center):"none"}),render:i=>i.motion.supported?t(i.motion.center):r`<span class="mut">${o("לא מוגדר")}</span>`},{key:"smart",label:o("אירועים חכמים"),render:i=>i.smart_supported?r`<span class="num">${i.smart_center}/${i.smart_supported}</span>`:r`<span class="mut">${o("אין")}</span>`},{key:"act",label:o("פעולה"),kind:"actions",render:i=>e?.can_write&&i.motion.supported&&!i.motion.center?r`<sw-button size="sm" data-nvr-enable-one=${i.channel} @click=${()=>this.planNotify([i.channel],!1,!0)}>${o("הפעל")}</sw-button>`:l}];return r`<sw-card heading=${o("התראות מה־NVR (Notify Surveillance Center)")} subheading=${o("אילו ערוצים מודיעים ל־Arx על תנועה ועל אירועים חכמים · כתיבה מאושרת ל־NVR, עם החזר")} data-nvr-notify>
      ${this.notifyError?r`<div class="msg err" role="alert" data-nvr-notify-error><sw-icon name="warning" size=${13}></sw-icon>${this.notifyError}</div>`:l}
      ${e?r`<sw-table class="matrix" bare static-rows data-nvr-matrix rowKey="channel" .columns=${s} .rows=${e.channels}
            .rowAttrs=${i=>({"data-nvr-channel":String(i.channel)})}></sw-table>
          <div class="hint legend"><span class="yn on"><sw-icon name="check" size=${12}></sw-icon></span> ${o("ההתראה נשלחת ל־Arx ·")} <span class="yn off"><sw-icon name="close" size=${12}></sw-icon></span> ${o("הערוץ מקליט אבל לא מודיע · אירועים חכמים = חציית קו, פריצה לאזור, כניסה ויציאה מאזור (רק במצלמות שמגדירות אותם).")}</div>
          ${e.can_write?r`<div class="actions">
                <sw-button variant="primary" size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-all @click=${()=>this.planNotify(null,!1,!0)}>${o("הפעל תנועה בכל הערוצים")}</sw-button>
                <sw-button size="sm" icon="bell" ?disabled=${this.notifyBusy} data-nvr-enable-smart @click=${()=>this.planNotify(null,!0,!0)}>${o("הפעל גם אירועים חכמים")}</sw-button>
              </div>`:e.writes_enabled===!1?b.writesOffHint("notify"):r`<div class="hint" data-nvr-no-permission>${o('לכתיבה ל־NVR נדרשת ההרשאה "{permission}" — מוקנית למנהל המערכת, ולאחרים דרך תפקיד מותאם (הגדרות ‹ משתמשים והרשאות ‹ תפקידים), גם למנהל מערכת.',{permission:e.permission})}</div>`}
          ${this.notifyResult?b.statusLine(this.notifyResult,this.notifyOk,"data-nvr-result"):l}
          ${this.changes.length?r`<div class="syshead"><sw-icon name="history" size=${15}></sw-icon>${o("שינויים אחרונים ב־NVR")}</div>
            <ul class="changes" data-nvr-changes>${this.changes.map(i=>r`<li><span class="ltr">${i.created_at.slice(0,16).replace("T"," ")}</span> · ${i.target} · ${i.note||i.kind} · ${i.status==="applied"?o("בוצע"):i.status==="unchanged"?o("ללא שינוי"):i.status==="rolled_back"?o("הוחזר"):o("נכשל")}${i.actor_username?` · ${i.actor_username}`:""}
              ${i.status==="applied"&&e.can_write&&i.writes_enabled!==!1?r`<sw-button variant="ghost" size="sm" ?disabled=${this.notifyBusy} data-nvr-rollback=${i.id} @click=${()=>this.rollback(i)}>${o("החזר")}</sw-button>`:l}
              ${i.status==="applied"&&i.writes_enabled===!1?r`<span class="dim" data-nvr-rollback-off=${i.id}>${o("· החזר כבוי (שינויי הגדרות ב־NVR כבויים)")}</span>`:l}</li>`)}</ul>`:l}`:this.notifyError?l:r`<div class="hint">${o("קורא את הגדרות ה־NVR…")}</div>`}
      ${this.notifyPlan?r`<sw-dialog open heading=${o("כתיבה ל־NVR")} subheading=${this.notifyPlan.label} data-nvr-confirm @close=${()=>this.notifyPlan=null}>
            <div class="dlgtext">${o("השינוי נכתב להגדרות ה־NVR בזהות המשתמש של חיבור ה־NVR, נרשם באודיט עם המסמך לפני ואחרי, וניתן להחזרה מרשימת השינויים. הקלטות אינן מושפעות.")}</div>
            <div slot="footer"><sw-button variant="primary" ?disabled=${this.notifyBusy} data-nvr-confirm-run @click=${()=>this.runNotify()}>${this.notifyBusy?o("כותב…"):o("כתוב ל־NVR")}</sw-button><sw-button variant="ghost" @click=${()=>this.notifyPlan=null}>${o("ביטול")}</sw-button></div>
          </sw-dialog>`:l}
    </sw-card>`}renderApi(){const e=this.raw;return r`
      <sw-page crumbs=${o("הגדרות")} heading=${o("חיבורים")} subheading=${o("מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · פרטי חיבור ה־NVR נשמרים כאן")}>
        <sw-button slot="actions" icon="refresh" ?disabled=${this.busy} @click=${()=>this.load()}>${this.busy?o("בודק…"):o("רענון")}</sw-button>
        ${this.error?r`<sw-state-panel state="error" heading=${o("מצב החיבורים לא נטען")} hint=${this.error}></sw-state-panel>`:l}
        ${e?r`<div class="two" data-connections>
              <div class="grouplabel">${o("מערכת ה־NVR")}</div>
              ${e.mode==="ha_only"?r`<sw-card heading=${o("NVR - מצב ללא NVR")} subheading=${o("לא מוגדר - דילוג מכוון")} data-nvr-less-connections>
                    ${this.row(o("מצב ההתקנה"),o("תשתית המערכת בלבד (ללא NVR)"))}
                    <div class="hint">${o("מצלמות, לייב, אירועים, הקלטות, תיקים וייצוא מוסתרים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.")}</div>
                  </sw-card>
                  ${this.renderConnectionCard()}`:r`
              <sw-card heading="NVR (Hikvision, ISAPI + RTSP)" subheading=${e.nvr_configured?o("מוגדר · קריאה בלבד"):o("לא מוגדר")}>
                ${this.row(o("חיבור מוגדר"),e.nvr_configured?o("כן"):o("לא"),e.nvr_configured?"ok":"err")}
                ${this.recorder?this.row(o("דגם · קושחה"),`${this.recorder.model??"—"} · ${this.recorder.firmware??"—"}`):l}
                ${this.row(o("גילוי מצלמות"),o("{cameras} ערוצים · כל {v} דק׳",{cameras:e.discovery.cameras,v:Math.round(e.discovery.interval_s/60)}))}
                ${this.row(o("גילוי אחרון תקין"),he(e.discovery.cameras_last_ok),e.discovery.cameras_last_error?"warn":"ok")}
                ${e.discovery.cameras_last_error?this.row(o("שגיאת גילוי"),e.discovery.cameras_last_error,"err"):l}
                ${this.row(o("זרם התראות (alertStream)"),e.events.ingest.connected?o("מחובר · פעימה {when}",{when:he(e.events.ingest.last_heartbeat_at)}):o("מנותק{v}",{v:e.events.ingest.last_error?` · ${e.events.ingest.last_error}`:""}),e.events.ingest.connected?"ok":"err")}
                ${this.row(o("התראות שנשמרו מאז ההפעלה"),e.events.ingest.events_stored,e.events.ingest.connected&&!e.events.ingest.events_stored?"warn":"")}
                ${e.events.ingest.connected&&!e.events.ingest.last_event_at?r`<div class="hint" data-no-alerts-hint>${o('ה־NVR מחובר אבל לא שלח התראה מאז ההפעלה — ב־NVR יש להפעיל "Notify Surveillance Center" ב־linkage של זיהוי התנועה; עד אז אירועי תנועה נגזרים מההקלטות כל 10 דקות.')}</div>`:l}
                ${this.row(o("אירועים שנגזרו מהקלטות (ריצה אחרונה)"),`${e.events.derive.derived} · ${he(e.events.derive.last_ok)}`,e.events.derive.last_error?"warn":"")}
              </sw-card>
              ${this.renderNotifyCard()}
              ${this.renderSystemCard()}
              ${this.renderConnectionCard()}`}
              <div class="grouplabel">${o("שירותים ותשתית נוספים")}</div>
              <sw-card heading=${o("go2rtc (relay לווידאו)")} subheading=${e.go2rtc_configured?o("מוגדר"):e.mode==="ha_only"?o("לא מוגדר - רשות במצב ללא NVR"):rt()?o("לא מוגדר"):o("לא מוגדר - נדרש כשיש NVR")}>
                ${this.row(o("חיבור מוגדר"),e.go2rtc_configured?o("כן"):o("לא"),e.go2rtc_configured?"ok":e.mode==="ha_only"?"":"err")}
                ${!e.go2rtc_configured&&e.mode==="ha_only"?r`<div class="hint" data-go2rtc-optional>${o("במצב ללא NVR go2rtc נדרש רק לווידאו של עמדות WisKey.")}</div>`:l}
                ${rt()?l:r`<div class="hint" data-go2rtc-required>${us}</div>`}
                ${this.row(o("סנכרון זרמים אחרון תקין"),he(e.discovery.streams_last_ok),e.discovery.streams_last_error?"warn":"ok")}
                ${e.discovery.streams_last_error?this.row(o("שגיאת סנכרון זרמים"),e.discovery.streams_last_error,"err"):l}
                ${this.check("go2rtc")?this.row(o("בדיקת בריאות"),this.check("go2rtc").detail,this.check("go2rtc").status==="ok"?"ok":this.check("go2rtc").status==="warn"?"warn":"err"):r`<div class="hint">${o('פרטי הזרמים והגרסה מוצגים ב"הגדרות ‹ כללי ‹ בריאות ועבודות" (דורש הרשאת ניהול).')}</div>`}
              </sw-card>
              ${this.renderWiskeyCard()}
              ${O("system.configure")?r`<sw-secrets-card></sw-secrets-card>`:l}
              ${O("system.configure")?r`<sw-bridge-key-card></sw-bridge-key-card>`:l}
              ${O("partner.manage")?r`<sw-partner-api-card></sw-partner-api-card>`:l}
              ${O("system.configure")?r`<sw-door-setup data-door-setup></sw-door-setup><sw-door-inventory data-door-inventory></sw-door-inventory><sw-door-blocks data-door-blocks></sw-door-blocks><sw-emergency-open-settings></sw-emergency-open-settings>`:l}
              ${O("system.configure")||O("access.admin.read")?r`<sw-wiskey-relay-map data-relay-map></sw-wiskey-relay-map>`:l}
              <sw-card heading=${o("תשתית המערכת")} subheading=${e.home_assistant.connected?o("מחובר · גרסה {v}",{v:e.home_assistant.ha_version??""}):e.home_assistant.configured?o("מוגדר, מנותק"):o("לא מוגדר")}>
                ${this.row(o("חיבור"),e.home_assistant.connected?o("מחובר"):o("מנותק{v}",{v:e.home_assistant.last_error?` · ${e.home_assistant.last_error}`:""}),e.home_assistant.connected?"ok":"err")}
                ${this.row(o("ישויות בקטלוג"),e.home_assistant.entities)}
                ${this.row(o("תמונת מצב אחרונה"),he(e.home_assistant.last_snapshot_at))}
                ${this.row(o("עדכון ישות אחרון"),he(e.home_assistant.last_event_at))}
                ${this.row(o("רישום (אזורים / קומות) עודכן"),he(e.home_assistant.last_registry_at))}
                ${this.row(o("התחברויות מחדש מאז ההפעלה"),e.home_assistant.reconnects,e.home_assistant.reconnects>3?"warn":"")}
                ${this.row(o("מקור הזהות"),e.identity_source==="ingress"?o("תשתית המערכת (כניסה מקומית)"):e.identity_source)}
              </sw-card>
              <sw-card heading=${o("אחסון וכלים")} subheading=${o("גרסה {version}",{version:e.version})}>
                ${this.row(o("בסיס הנתונים"),e.db.ok?o("תקין · מהדורת הרשאות {permission_revision}",{permission_revision:e.db.permission_revision}):o("שגיאה"),e.db.ok?"ok":"err")}
                ${this.row(o("תיקיית הנתונים (/data)"),e.data_dir_writable?o("ניתנת לכתיבה"):o("לא ניתנת לכתיבה"),e.data_dir_writable?"ok":"err")}
                ${this.row(o("ממיר תוכניות PDF"),e.renderer??o("חסר"),e.renderer?"ok":"warn")}
                ${this.row(o("אירועים שמורים"),e.events.stored)}
                ${this.check("thumbnails")?this.row(o("תמונות אירועים (ffmpeg)"),this.check("thumbnails").detail,this.check("thumbnails").status==="ok"?"ok":"warn"):l}
                ${this.check("backups")?this.row(o("גיבויים"),this.check("backups").detail,this.check("backups").status==="ok"?"ok":"warn"):l}
              </sw-card>
            </div>
            <sw-card heading=${o("איפה מגדירים")} subheading=${o("חיבורים נוספים מוגדרים בהגדרות SmplWise Arx בתשתית המערכת; הערכים אינם מוצגים כאן ושינוי דורש הפעלה מחדש; סיסמאות ומפתחות בכרטיס סודות")}>
              <div class="opts" data-connection-options>
                ${Wi.map(t=>r`<div class="check"><span>${t.label}</span><span class="val ltr">${t.key}</span></div>`)}
              </div>
              <div class="hint">${o("משתמש ה־NVR צריך הרשאות צפייה והקלטות; Arx כותב ל־NVR רק דרך הפעולות המאושרות בעמוד הזה, ורק עם הרשאה רגישה.")}</div>
            </sw-card>`:this.error?l:r`<sw-state-panel state="loading" heading=${o("קורא את מצב החיבורים…")}></sw-state-panel>`}
      </sw-page>
    `}render(){return we()?this.renderApi():r`<sw-page crumbs=${o("הגדרות")} heading=${o("חיבורים")} subheading=${o("מצב החיבורים של המערכת: NVR, go2rtc, תשתית המערכת ואחסון · כתיבה ל־NVR רק בפעולות המאושרות, עם הרשאה רגישה")}>
      <sw-state-panel icon="link" state="empty" heading=${o("החיבורים מוצגים מול שרת אמיתי")} hint=${o("במצב הדגמה אין חיבורים לקרוא. שלבי ההתקנה עם נתוני הדגמה נמצאים באשף ההתקנה.")} actionLabel=${o("לאשף ההתקנה")} @action=${()=>window.location.hash="#/system/wizard"}></sw-state-panel>
    </sw-page>`}};b.styles=[Ge,j`
    /* SETUPPLAN-POLISH-2331: the channel matrix is a dense data table (ui-ux-pro-max: tabular numerals, a quiet header, a row
       hover under a pointer that hovers, a scroll box of its own so a 16-channel recorder never widens the page on a phone) */
    /* CR-CMP2-TABLES-REST-2470 (owner N10): the channel matrix is the shared table on the well (a 16-channel recorder never widens the page:
       the camera names wrap, the table is never wider than the card) */
    sw-table.matrix {
      --sw-table-min: 0;
      --sw-table-head-bg: transparent;
      --sw-table-cell-pad: 8px 12px;
      margin-block: var(--sw-s-2);
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    sw-table.matrix::part(cell) {
      white-space: normal;
    }
    sw-table.matrix::part(yn) {
      display: inline-grid;
      place-items: center;
      inline-size: 22px;
      block-size: 22px;
      border-radius: var(--sw-r-pill);
      vertical-align: middle;
    }
    sw-table.matrix::part(yn-on) {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    sw-table.matrix::part(yn-off) {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
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
  `,Tt];k([c()],b.prototype,"raw",2);k([c()],b.prototype,"report",2);k([c()],b.prototype,"recorder",2);k([c()],b.prototype,"error",2);k([c()],b.prototype,"busy",2);k([c()],b.prototype,"notify",2);k([c()],b.prototype,"notifyError",2);k([c()],b.prototype,"notifyPlan",2);k([c()],b.prototype,"notifyBusy",2);k([c()],b.prototype,"notifyResult",2);k([c()],b.prototype,"sys",2);k([c()],b.prototype,"sysRecorder",2);k([c()],b.prototype,"sysRecorders",2);k([c()],b.prototype,"sysError",2);k([c()],b.prototype,"sysMsg",2);k([c()],b.prototype,"sysBusy",2);k([c()],b.prototype,"ntpForm",2);k([c()],b.prototype,"rebootWord",2);k([c()],b.prototype,"rebootOpen",2);k([c()],b.prototype,"changes",2);k([c()],b.prototype,"wiskey",2);k([c()],b.prototype,"wiskeyError",2);k([c()],b.prototype,"wiskeyForm",2);k([c()],b.prototype,"wiskeyClear",2);k([c()],b.prototype,"wiskeyMsg",2);k([c()],b.prototype,"wiskeyBusy",2);k([c()],b.prototype,"sysOk",2);k([c()],b.prototype,"notifyOk",2);k([c()],b.prototype,"wiskeyOk",2);b=k([N("system-setup")],b);export{b as SystemSetup};
