import{i as G,a8 as I,g as N,gN as B,E as Y,F as ve,G as h,a as Z,Y as O,n as ce,A as l,q as K,e as r,ct as L,H as Q,ac as we,a7 as F,j as C,S as be,bQ as _e,C as ye}from"./index-k1cto_iv.js";import"./sw-logo-art-Va6y_cIM.js";const $e=["conservative","standard","off"],q=["alert","code","ticket","reminder"],X="messaging/whatsapp/pacing",ke={view:()=>N(X),save:e=>I(X,e)};function ee(){return{mode:"conservative",wiskey_shared:!0,max_wait_min:{alert:60,code:5,ticket:360,reminder:720},budget:{per_minute:10,burst:5,burst_window_s:10},per_minute:null,burst:null,shared_budget_guaranteed:!1,share_pct:{alert:100,code:95,ticket:80,reminder:60},can_manage:!0,applies:!0,accounts:[{account_key:"entry:01JDEMOOFFICE",wiskey:{mapped:!0,verified:!1,unknown:!0,charged:null,throttled_until:null,leases_active:0},sends_1h:7,sends_24h:41,wiskey_1h:2,wiskey_24h:9,waiting:3,waiting_by_class:{ticket:1,reminder:2},oldest_wait_s:540,counters_24h:{sent:41,deferred:12,backoff:1,pair_backoff:0,expired:0},backoff:null,pairs_in_backoff:0}]}}let b=null;const xe={async view(){return b??=ee(),structuredClone(b)},async save(e){b??=ee(),e.mode&&(b.mode=e.mode),e.wiskey_shared!==void 0&&(b.wiskey_shared=e.wiskey_shared),e.max_wait_min&&(b.max_wait_min={...b.max_wait_min,...e.max_wait_min}),e.per_minute!==void 0&&(b.per_minute=e.per_minute),e.burst!==void 0&&(b.burst=e.burst),b.applies=b.mode!=="off";const s=b.mode==="standard"?{per_minute:20,burst:8}:{per_minute:10,burst:5};return b.budget=b.mode==="off"?null:{per_minute:b.per_minute??s.per_minute,burst:b.burst??s.burst,burst_window_s:10},structuredClone(b)}};function se(){return G()?ke:xe}const ue={title:"קצב שליחה משותף",mode:"מצב",mode_conservative:"שמרני",mode_standard:"רגיל",mode_off:"כבוי",wiskey:"WisKey שולח מאותו מספר",inactive:"לא פעיל",limits:"המתנה מרבית בדקות",perMinute:"הודעות בדקה",burstLbl:"פרץ ב-10 שניות",wiskeyUnknown:"מוני WisKey לא ידועים",reason_unread:"לא נקרא עדיין מ-WisKey",reason_stale:"הקריאה האחרונה מ-WisKey ישנה",reason_unsupported:"גרסת WisKey הזו אינה מדווחת את מוני השליחה",reason_error:"הקריאה מ-WisKey נכשלה",reason_invalid:"התשובה מ-WisKey לא שמישה",reason_truncated:"WisKey שלח רק חלק מהשולחים שלו",reason_absent:"WisKey לא כלל את השולח הזה",reason_unverified:"השולח לא הותאם בוודאות לשולח של WisKey",reason_incomplete:"מוני WisKey לשולח הזה חלקיים",reason_unreserved:"הודעות ש-WisKey שלח בלי להזמין מקום אינן ידועות",reason_other:"מוני WisKey אינם ידועים",err_minute:"ערך בין 1 ל-120",err_burst:"ערך בין 1 ל-60",cls_alert:"התראות",cls_code:"קודי אימות",cls_ticket:"הודעות",cls_reminder:"תזכורות",budget:"{n} בדקה · פרץ {b}",sentHour:"נשלחו בשעה האחרונה",wiskeyHour:"מהן WisKey",waiting:"ממתינות",oldest:"ההמתנה הארוכה ביותר",deferred:"נדחו ב-24 שעות",slowed:"האטות מהפלטפורמה",expired:"הסתיימו בלי שליחה",backoffUntil:"מואט עד {time}",pairs:"נמענים מואטים: {n}",noAccounts:"אין חשבונות",unit_s:"{n} שנ׳",unit_m:"{n} דק׳",unit_h:"{n} שע׳",saved:"נשמר",retry:"נסו שוב",err_range:"ערך בין 1 ל-2880",loadError:"לא ניתן לטעון את הקצב"},Se={title:"Shared send pace",mode:"Mode",mode_conservative:"Conservative",mode_standard:"Standard",mode_off:"Off",wiskey:"WisKey sends from the same number",inactive:"Inactive",limits:"Longest wait, minutes",perMinute:"Messages a minute",burstLbl:"Burst in 10 seconds",wiskeyUnknown:"WisKey counters unknown",reason_unread:"Not read from WisKey yet",reason_stale:"The last read from WisKey is old",reason_unsupported:"This WisKey version does not report its send counters",reason_error:"The read from WisKey failed",reason_invalid:"WisKey's answer could not be used",reason_truncated:"WisKey sent only some of its senders",reason_absent:"WisKey did not list this sender",reason_unverified:"This sender could not be matched to WisKey's with certainty",reason_incomplete:"WisKey's counters for this sender are incomplete",reason_unreserved:"Messages WisKey sent without reserving are unknown",reason_other:"WisKey counters are unknown",err_minute:"A value from 1 to 120",err_burst:"A value from 1 to 60",cls_alert:"Alerts",cls_code:"Verification codes",cls_ticket:"Messages",cls_reminder:"Reminders",budget:"{n} a minute · burst {b}",sentHour:"Sent in the last hour",wiskeyHour:"of them WisKey",waiting:"Waiting",oldest:"Longest wait",deferred:"Deferred in 24 hours",slowed:"Platform slow-downs",expired:"Ended without sending",backoffUntil:"Slowed until {time}",pairs:"Slowed recipients: {n}",noAccounts:"No accounts",unit_s:"{n} s",unit_m:"{n} min",unit_h:"{n} h",saved:"Saved",retry:"Try again",err_range:"A value from 1 to 2880",loadError:"The pace could not be loaded"},Oe={title:"وتيرة الإرسال المشتركة",mode:"الوضع",mode_conservative:"متحفظ",mode_standard:"عادي",mode_off:"متوقف",wiskey:"WisKey يرسل من الرقم نفسه",inactive:"غير فعّال",limits:"أقصى انتظار بالدقائق",perMinute:"رسائل في الدقيقة",burstLbl:"دفعة خلال 10 ثوانٍ",wiskeyUnknown:"عدّادات WisKey غير معروفة",reason_unread:"لم تُقرأ من WisKey بعد",reason_stale:"القراءة الأخيرة من WisKey قديمة",reason_unsupported:"إصدار WisKey هذا لا يُبلغ عن عدّادات الإرسال",reason_error:"فشلت القراءة من WisKey",reason_invalid:"تعذّر استخدام إجابة WisKey",reason_truncated:"أرسل WisKey جزءًا فقط من المرسلين لديه",reason_absent:"لم يُدرج WisKey هذا المرسل",reason_unverified:"تعذّر مطابقة هذا المرسل مع مرسل WisKey بيقين",reason_incomplete:"عدّادات WisKey لهذا المرسل غير مكتملة",reason_unreserved:"الرسائل التي أرسلها WisKey دون حجز غير معروفة",reason_other:"عدّادات WisKey غير معروفة",err_minute:"قيمة من 1 إلى 120",err_burst:"قيمة من 1 إلى 60",cls_alert:"التنبيهات",cls_code:"رموز التحقق",cls_ticket:"الرسائل",cls_reminder:"التذكيرات",budget:"{n} في الدقيقة · دفعة {b}",sentHour:"أُرسلت في الساعة الأخيرة",wiskeyHour:"منها من WisKey",waiting:"قيد الانتظار",oldest:"أطول انتظار",deferred:"مؤجلة خلال 24 ساعة",slowed:"إبطاء من المنصة",expired:"انتهت دون إرسال",backoffUntil:"مُبطأ حتى {time}",pairs:"مستلمون مُبطؤون: {n}",noAccounts:"لا توجد حسابات",unit_s:"{n} ث",unit_m:"{n} د",unit_h:"{n} س",saved:"تم الحفظ",retry:"حاولوا مرة أخرى",err_range:"قيمة من 1 إلى 2880",loadError:"تعذّر تحميل الوتيرة"},Te={title:"Общий темп отправки",mode:"Режим",mode_conservative:"Осторожный",mode_standard:"Обычный",mode_off:"Выключен",wiskey:"WisKey отправляет с того же номера",inactive:"Не действует",limits:"Максимальное ожидание, минут",perMinute:"Сообщений в минуту",burstLbl:"Пакет за 10 секунд",wiskeyUnknown:"Счётчики WisKey неизвестны",reason_unread:"Данные WisKey ещё не получены",reason_stale:"Последнее чтение из WisKey устарело",reason_unsupported:"Эта версия WisKey не сообщает счётчики отправки",reason_error:"Не удалось прочитать данные из WisKey",reason_invalid:"Ответ WisKey не удалось использовать",reason_truncated:"WisKey прислал только часть своих отправителей",reason_absent:"WisKey не указал этого отправителя",reason_unverified:"Отправителя не удалось точно сопоставить с отправителем WisKey",reason_incomplete:"Счётчики WisKey для этого отправителя неполные",reason_unreserved:"Сообщения, отправленные WisKey без резервирования, неизвестны",reason_other:"Счётчики WisKey неизвестны",err_minute:"Значение от 1 до 120",err_burst:"Значение от 1 до 60",cls_alert:"Оповещения",cls_code:"Коды подтверждения",cls_ticket:"Сообщения",cls_reminder:"Напоминания",budget:"{n} в минуту · пакет {b}",sentHour:"Отправлено за последний час",wiskeyHour:"из них WisKey",waiting:"Ожидают",oldest:"Самое долгое ожидание",deferred:"Отложено за 24 часа",slowed:"Замедления платформы",expired:"Завершены без отправки",backoffUntil:"Замедлено до {time}",pairs:"Замедленных получателей: {n}",noAccounts:"Нет аккаунтов",unit_s:"{n} с",unit_m:"{n} мин",unit_h:"{n} ч",saved:"Сохранено",retry:"Повторить",err_range:"Значение от 1 до 2880",loadError:"Не удалось загрузить темп"},We={he:ue,en:Se,ar:Oe,ru:Te};function Ee(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function u(e,s,t=Ee()){const a=We[t][e]??ue[e]??e;return s?a.replace(/\{(\w+)\}/g,(i,o)=>o in s?String(s[o]):i):a}const te=[1,2880];function Ce(e){const s=Math.max(0,Math.round(e));return s<90?{n:s,u:"s"}:s<5400?{n:Math.round(s/60),u:"m"}:{n:Math.round(s/3600),u:"h"}}function Ae(e,s,t){if(!/^\d{1,4}$/.test(e.trim()))return null;const a=Number(e);return a>=s&&a<=t?a:null}const ze=[1,120],Ke=[1,60];function Me(e){if(!/^\d{1,4}$/.test(e.trim()))return null;const s=Number(e);return s>=te[0]&&s<=te[1]?s:null}function De(e,s){const t={};for(const a of q)s[a]!==void 0&&s[a]!==e.max_wait_min[a]&&(t[a]=s[a]);return t}function Re(e){return e.backoff!==null||e.pairs_in_backoff>0||e.counters_24h.backoff+e.counters_24h.pair_backoff>0}function Ie(e){return e.counters_24h.expired>0?"bad":Re(e)?"warn":"ok"}const Ne={not_read:"reason_unread",discovery_unknown:"reason_unread",stale:"reason_stale",api_incompatible:"reason_unsupported",pacing_route_not_listed:"reason_unsupported",schema_version_missing:"reason_unsupported",schema_version_misplaced:"reason_unsupported",schema_version_unsupported:"reason_unsupported",route_error:"reason_error",envelope_invalid:"reason_invalid",coverage_inconsistent:"reason_invalid",truncated:"reason_truncated",sender_absent:"reason_absent",unverified:"reason_unverified",counters_incomplete:"reason_incomplete",unreserved_unknown:"reason_unreserved"};function ae(e){const s=e.wiskey;return!s.unknown&&s.coverage!=="not_covered"?null:s.reason&&Ne[s.reason]||"reason_other"}var Le=Object.defineProperty,Pe=Object.getOwnPropertyDescriptor,T=(e,s,t,a)=>{for(var i=a>1?void 0:a?Pe(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&Le(s,t,i),i};let x=class extends Z{constructor(){super(...arguments),this.labels={},this.view=null,this.state="loading",this.error="",this.ok="",this.busy=!1,this.edited={},this.okTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){window.clearTimeout(this.okTimer),super.disconnectedCallback()}async load(){try{this.view=await se().view(),this.state="ready",this.edited={}}catch(e){this.error=O(e),this.state="error"}}get editable(){return!!this.view?.can_manage}async save(e){if(!(this.busy||!this.editable)){this.busy=!0,this.error="";try{this.view=await se().save(e),this.edited={},this.ok=u("saved"),window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",2500)}catch(s){this.error=O(s)}finally{this.busy=!1}}}commitWaits(){if(!this.view)return;const e={};for(const t of q){const a=this.edited[t];if(a===void 0)continue;const i=Me(a);if(i===null){this.error=u("err_range");return}e[t]=i}const s=De(this.view,e);Object.keys(s).length?this.save({max_wait_min:s}):this.edited={}}commitRate(e,s){const t=e==="per_minute"?ze:Ke,a=Ae(s,t[0],t[1]);if(a===null){this.error=u(e==="per_minute"?"err_minute":"err_burst");return}this.save({[e]:a})}duration(e){const s=Ce(e);return u(`unit_${s.u}`,{n:s.n})}accountRow(e){const s=e.counters_24h,t=Ie(e),a=e.backoff?ce(new Date(e.backoff.until)):"";return r`<div class="acct" data-pacing-account=${e.account_key} data-tone=${t}>
      <div class="head"><strong>${K(this.labels[e.account_key]??e.account_key)}</strong>
        ${e.backoff?r`<span class="tag warn" data-backoff><sw-icon name="warning" size="14"></sw-icon>${u("backoffUntil",{time:a})}</span>`:l}
        ${e.wiskey.unknown?r`<span class="tag" data-wiskey-unknown>${u("wiskeyUnknown")}</span>`:l}
        ${ae(e)?r`<span class="tag" data-wiskey-reason=${e.wiskey.reason??""}>${u(ae(e))}</span>`:l}
        ${e.pairs_in_backoff?r`<span class="tag warn" data-pairs>${u("pairs",{n:e.pairs_in_backoff})}</span>`:l}
        ${s.expired?r`<span class="tag bad" data-expired>${u("expired")}: ${s.expired}</span>`:l}</div>
      <div class="kv">
        <div data-k="sent"><span>${u("sentHour")}</span><b>${e.sends_1h}</b></div>
        <div data-k="wiskey"><span>${u("wiskeyHour")}</span><b>${e.wiskey_1h}</b></div>
        <div data-k="waiting"><span>${u("waiting")}</span><b>${e.waiting}</b></div>
        <div data-k="oldest"><span>${u("oldest")}</span><b>${e.oldest_wait_s===null?"–":this.duration(e.oldest_wait_s)}</b></div>
        <div data-k="deferred"><span>${u("deferred")}</span><b>${s.deferred}</b></div>
        <div data-k="slowed"><span>${u("slowed")}</span><b>${s.backoff+s.pair_backoff}</b></div>
      </div>
    </div>`}render(){if(this.state==="loading")return l;if(this.state==="error"||!this.view)return r`<sw-card data-card="pacing" data-state="error"><div class="msg err" role="alert">${u("loadError")}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${()=>void this.load()}>${u("retry")}</sw-button></div></sw-card>`;const e=this.view;return r`<sw-card data-card="pacing" data-state="ready" data-mode=${e.mode}>
      <div class="head"><strong>${u("title")}</strong>
        ${e.budget?r`<span class="tag ltr" data-budget>${u("budget",{n:e.budget.per_minute,b:e.budget.burst})}</span>`:l}
        ${e.applies?l:r`<span class="tag" data-inactive>${u("inactive")}</span>`}
        <span class="grow"></span></div>
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:l}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:l}
      <div class="row"><span class="lbl">${u("mode")}</span>
        <span class="ctl"><select class="in" data-pacing-mode aria-label=${u("mode")} ?disabled=${!this.editable||this.busy}
          @change=${s=>void this.save({mode:s.target.value})}>
          ${$e.map(s=>r`<option value=${s} ?selected=${s===e.mode}>${u(`mode_${s}`)}</option>`)}
        </select></span></div>
      <div class="row"><span class="lbl">${u("wiskey")}</span>
        <sw-toggle label=${u("wiskey")} labelHidden data-pacing-wiskey .checked=${e.wiskey_shared} ?disabled=${!this.editable||this.busy}
          @change=${s=>void this.save({wiskey_shared:s.detail.checked})}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${u("perMinute")} / ${u("burstLbl")}</span>
        <div class="waits" data-pacing-rate>
          <label>${u("perMinute")}<input class="in" inputmode="numeric" data-rate="per_minute" .value=${String(e.budget?.per_minute??"")} ?disabled=${!this.editable||this.busy||!e.budget}
            @change=${s=>this.commitRate("per_minute",s.target.value)}></label>
          <label>${u("burstLbl")}<input class="in" inputmode="numeric" data-rate="burst" .value=${String(e.budget?.burst??"")} ?disabled=${!this.editable||this.busy||!e.budget}
            @change=${s=>this.commitRate("burst",s.target.value)}></label></div></div>
      <div class="row stack"><span class="lbl">${u("limits")}</span>
        <div class="waits" data-pacing-limits>${q.map(s=>r`<label>${u(`cls_${s}`)}
          <input class="in" inputmode="numeric" data-wait=${s} .value=${this.edited[s]??String(e.max_wait_min[s])} ?disabled=${!this.editable||this.busy}
            @input=${t=>this.edited={...this.edited,[s]:t.target.value}} @change=${()=>this.commitWaits()}></label>`)}</div></div>
      <div data-pacing-accounts>${e.accounts.length?L(e.accounts,s=>s.account_key,s=>this.accountRow(s)):r`<p class="muted" data-no-accounts>${u("noAccounts")}</p>`}</div>
    </sw-card>`}};x.styles=[B,Y`
    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.bad { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .grow { flex: 1; }
    .waits { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: var(--sw-s-2); inline-size: 100%; }
    .waits label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .waits input { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; }
    .waits label { min-inline-size: 0; }
    :host { display: block; min-inline-size: 0; }
    .head strong { min-inline-size: 0; overflow-wrap: anywhere; }
    .acct { min-inline-size: 0; border-block-start: 1px solid var(--sw-border); padding-block: var(--sw-s-2); }
    .kv { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 4px var(--sw-s-3); margin-block-start: 6px; }
    .kv div { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .kv span, .kv b { min-inline-size: 0; overflow-wrap: anywhere; }
    .kv b { font-variant-numeric: tabular-nums; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
  `];T([ve({attribute:!1})],x.prototype,"labels",2);T([h()],x.prototype,"view",2);T([h()],x.prototype,"state",2);T([h()],x.prototype,"error",2);T([h()],x.prototype,"ok",2);T([h()],x.prototype,"busy",2);T([h()],x.prototype,"edited",2);x=T([Q("messaging-pacing-card")],x);const Ue=["handler","provider","other"],E="messaging/whatsapp/policy",je={view:()=>N(E),setEnforce:e=>I(E,{enforce:e}),add:e=>F(`${E}/allow`,e),remove:async e=>(await we(`${E}/allow/${encodeURIComponent(e)}`),N(E)),selfWindow:e=>I(`${E}/self-messages`,{minutes:e})};function A(){return{enforce:!1,can_manage:!0,max_entries:500,allow:[{id:"demo00000001",label:"דנה כהן",role:"handler",last4:"0191"},{id:"demo00000002",label:'מעליות בע"מ',role:"provider",last4:"0192"}],self_messages:{active:!1,until:null,minutes_default:30,minutes_range:[1,240]}}}let g=null,Fe=3;const qe={async view(){return g??=A(),g.self_messages.until&&Date.parse(g.self_messages.until)<=Date.now()&&(g.self_messages={...g.self_messages,active:!1,until:null}),structuredClone(g)},async setEnforce(e){return g??=A(),g.enforce=e,structuredClone(g)},async add(e){g??=A();const s=e.phone.replace(/[\s\-().+]/g,"");if(!/^\d{8,15}$/.test(s)||!e.label.trim())throw new Error("validation");return g.allow=[...g.allow,{id:`demo${String(Fe++).padStart(8,"0")}`,label:e.label.trim(),role:e.role,last4:s.slice(-4)}],structuredClone(g)},async remove(e){return g??=A(),g.allow=g.allow.filter(s=>s.id!==e),structuredClone(g)},async selfWindow(e){return g??=A(),g.self_messages={...g.self_messages,active:e!==null,until:e===null?null:new Date(Date.now()+e*6e4).toISOString()},structuredClone(g)}};function W(){return G()?je:qe}const pe={title:"מדיניות שליחה בוואטסאפ",allowTitle:"רשימת מותרים: מטפלים וספקים",enforce:"לשלוח רק לרשימה",enforceOff:"כבוי: כל נמען יקבל הודעה",blocksAll:"האכיפה פעילה והרשימה ריקה: שום הודעה לא תישלח",phone:"מספר (עם קידומת מדינה)",label:"שם",role:"תפקיד",role_handler:"מטפל",role_provider:"ספק",role_other:"אחר",add:"הוספה",remove:"הסרה",empty:"הרשימה ריקה",page:"עמוד {n} מתוך {m}",prev:"הקודם",next:"הבא",selfTitle:"הודעות לעצמי לבדיקה",selfMinutes:"דקות",selfStart:"הפעלה",selfStop:"כיבוי",selfActive:"פעיל עד {time}",selfOff:"כבוי",saved:"נשמר",loadError:"טעינת המדיניות נכשלה",retry:"נסו שוב",err_phone:"מספר לא תקין",err_label:"יש להזין שם",err_minutes:"ערך בין {lo} ל-{hi}",err_listed:"המספר כבר ברשימה",readOnly:"צפייה בלבד"},He={title:"WhatsApp sending policy",allowTitle:"Allow-list: handlers and providers",enforce:"Send only to the list",enforceOff:"Off: every recipient may be messaged",blocksAll:"Enforcement is on and the list is empty: no message will be sent",phone:"Number (with country code)",label:"Name",role:"Role",role_handler:"Handler",role_provider:"Provider",role_other:"Other",add:"Add",remove:"Remove",empty:"The list is empty",page:"Page {n} of {m}",prev:"Previous",next:"Next",selfTitle:"Self-messages for testing",selfMinutes:"Minutes",selfStart:"Turn on",selfStop:"Turn off",selfActive:"On until {time}",selfOff:"Off",saved:"Saved",loadError:"Could not load the policy",retry:"Try again",err_phone:"Invalid number",err_label:"Enter a name",err_minutes:"A value from {lo} to {hi}",err_listed:"The number is already listed",readOnly:"View only"},Je={title:"سياسة الإرسال عبر واتساب",allowTitle:"قائمة المسموح لهم: المعالجون والمزوّدون",enforce:"الإرسال إلى القائمة فقط",enforceOff:"متوقف: يمكن مراسلة أي مستلم",blocksAll:"التطبيق مفعّل والقائمة فارغة: لن تُرسل أي رسالة",phone:"الرقم (مع رمز الدولة)",label:"الاسم",role:"الدور",role_handler:"معالج",role_provider:"مزوّد",role_other:"آخر",add:"إضافة",remove:"إزالة",empty:"القائمة فارغة",page:"الصفحة {n} من {m}",prev:"السابق",next:"التالي",selfTitle:"رسائل إلى النفس للاختبار",selfMinutes:"دقائق",selfStart:"تشغيل",selfStop:"إيقاف",selfActive:"يعمل حتى {time}",selfOff:"متوقف",saved:"تم الحفظ",loadError:"تعذّر تحميل السياسة",retry:"حاول مرة أخرى",err_phone:"رقم غير صالح",err_label:"أدخل اسماً",err_minutes:"قيمة من {lo} إلى {hi}",err_listed:"الرقم موجود في القائمة",readOnly:"للعرض فقط"},Ve={title:"Политика отправки в WhatsApp",allowTitle:"Список разрешённых: исполнители и поставщики",enforce:"Отправлять только по списку",enforceOff:"Выключено: сообщения можно слать любому получателю",blocksAll:"Проверка включена, список пуст: ни одно сообщение не будет отправлено",phone:"Номер (с кодом страны)",label:"Имя",role:"Роль",role_handler:"Исполнитель",role_provider:"Поставщик",role_other:"Другое",add:"Добавить",remove:"Убрать",empty:"Список пуст",page:"Страница {n} из {m}",prev:"Назад",next:"Далее",selfTitle:"Сообщения самому себе для проверки",selfMinutes:"Минуты",selfStart:"Включить",selfStop:"Выключить",selfActive:"Включено до {time}",selfOff:"Выключено",saved:"Сохранено",loadError:"Не удалось загрузить политику",retry:"Повторить",err_phone:"Неверный номер",err_label:"Введите имя",err_minutes:"Значение от {lo} до {hi}",err_listed:"Номер уже в списке",readOnly:"Только просмотр"},Ge={he:pe,en:He,ar:Je,ru:Ve};function Be(){const e=typeof document<"u"?(document.documentElement.lang||"").toLowerCase():"";return e.startsWith("en")?"en":e.startsWith("ar")?"ar":e.startsWith("ru")?"ru":"he"}function p(e,s,t=Be()){const a=Ge[t][e]??pe[e]??e;return s?a.replace(/\{(\w+)\}/g,(i,o)=>o in s?String(s[o]):i):a}const H=5;function Ye(e){const s=e.trim().replace(/^\+/,"").replace(/[\s\-().]/g,"");return/^\d{8,15}$/.test(s)?s:null}function Ze(e,s){if(!/^\d{1,3}$/.test(e.trim()))return null;const t=Number(e);return t>=s[0]&&t<=s[1]?t:null}function Qe(e){return Math.max(1,Math.ceil(e/H))}function Xe(e,s){const t=Qe(e.length),a=Math.min(Math.max(0,s),t-1);return{items:e.slice(a*H,(a+1)*H),page:a,pages:t}}function es(e,s){return e&&s===0}var ss=Object.defineProperty,ts=Object.getOwnPropertyDescriptor,k=(e,s,t,a)=>{for(var i=a>1?void 0:a?ts(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&ss(s,t,i),i};let $=class extends Z{constructor(){super(...arguments),this.view=null,this.state="loading",this.error="",this.ok="",this.busy=!1,this.page=0,this.phone="",this.label="",this.newRole="handler",this.minutes="30",this.okTimer=0,this.tick=0}connectedCallback(){super.connectedCallback(),this.load(),this.tick=window.setInterval(()=>this.view?.self_messages.active&&void this.refreshWindow(),3e4)}disconnectedCallback(){window.clearTimeout(this.okTimer),window.clearInterval(this.tick),super.disconnectedCallback()}async load(){try{this.view=await W().view(),this.state="ready"}catch(e){this.error=O(e),this.state="error"}}async refreshWindow(){try{this.view=await W().view()}catch{}}get editable(){return!!this.view?.can_manage}async run(e,s){if(!(this.busy||!this.editable)){this.busy=!0,this.error="";try{this.view=await e(),s?.(),this.ok=p("saved"),window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",2500)}catch(t){this.error=t instanceof C&&t.status===422&&JSON.stringify(t.body.details??{}).includes("already_listed")?p("err_listed"):O(t)}finally{this.busy=!1}}}add(){if(Ye(this.phone)===null){this.error=p("err_phone");return}if(!this.label.trim()){this.error=p("err_label");return}const e={phone:this.phone.trim(),label:this.label.trim(),role:this.newRole};this.run(()=>W().add(e),()=>{this.phone="",this.label="",this.page=Number.MAX_SAFE_INTEGER})}startWindow(){const e=this.view?.self_messages.minutes_range??[1,240],s=Ze(this.minutes,e);if(s===null){this.error=p("err_minutes",{lo:e[0],hi:e[1]});return}this.run(()=>W().selfWindow(s))}render(){if(this.state==="loading")return l;if(this.state==="error"||!this.view)return r`<sw-card data-card="policy" data-state="error"><div class="msg err" role="alert">${p("loadError")}: ${this.error}
        <sw-button size="sm" variant="ghost" @click=${()=>void this.load()}>${p("retry")}</sw-button></div></sw-card>`;const e=this.view,s=Xe(e.allow,this.page),t=!this.editable||this.busy;return r`<sw-card data-card="policy" data-state="ready">
      <div class="head"><strong>${p("title")}</strong>
        ${this.editable?l:r`<span class="tag" data-read-only>${p("readOnly")}</span>`}</div>
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:l}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:l}
      <div class="row"><span class="lbl">${p("allowTitle")}</span></div>
      <div class="row"><span class="lbl">${p("enforce")}</span>
        <sw-toggle label=${p("enforce")} labelHidden data-policy-enforce .checked=${e.enforce} ?disabled=${t}
          @change=${a=>void this.run(()=>W().setEnforce(a.detail.checked))}></sw-toggle>
        ${e.enforce?l:r`<span class="tag" data-enforce-off>${p("enforceOff")}</span>`}</div>
      ${es(e.enforce,e.allow.length)?r`<div class="msg err" role="status" data-blocks-all>${p("blocksAll")}</div>`:l}
      <div data-policy-list>
        ${e.allow.length?L(s.items,a=>a.id,a=>r`<div class="entry" data-entry=${a.id}>
          <span class="name">${K(a.label)}</span>
          <span class="tag" data-role=${a.role}>${p(`role_${a.role}`)}</span>
          <span class="tag ltr">${a.last4?`…${a.last4}`:"–"}</span>
          ${this.editable?r`<sw-button size="sm" variant="ghost" data-remove ?disabled=${this.busy}
            @click=${()=>void this.run(()=>W().remove(a.id))}>${p("remove")}</sw-button>`:l}</div>`):r`<p class="muted" data-empty>${p("empty")}</p>`}
        ${s.pages>1?r`<div class="pager" data-pager>
          <sw-button size="sm" variant="ghost" data-prev ?disabled=${s.page===0} @click=${()=>this.page=s.page-1}>${p("prev")}</sw-button>
          <span>${p("page",{n:s.page+1,m:s.pages})}</span>
          <sw-button size="sm" variant="ghost" data-next ?disabled=${s.page>=s.pages-1} @click=${()=>this.page=s.page+1}>${p("next")}</sw-button></div>`:l}
      </div>
      ${this.editable?r`<div class="grid" data-policy-add>
        <label>${p("phone")}<input class="in ltr" inputmode="tel" data-add="phone" .value=${this.phone} ?disabled=${this.busy}
          @input=${a=>this.phone=a.target.value}></label>
        <label>${p("label")}<input class="in" maxlength="80" data-add="label" .value=${this.label} ?disabled=${this.busy}
          @input=${a=>this.label=a.target.value}></label>
        <label>${p("role")}<select class="in" data-add="role" ?disabled=${this.busy} @change=${a=>this.newRole=a.target.value}>
          ${Ue.map(a=>r`<option value=${a} ?selected=${a===this.newRole}>${p(`role_${a}`)}</option>`)}</select></label>
        <sw-button size="sm" variant="primary" data-add-button ?disabled=${this.busy} @click=${()=>this.add()}>${p("add")}</sw-button></div>`:l}
      <div class="sect" data-policy-self>
        <div class="head"><strong>${p("selfTitle")}</strong>
          ${e.self_messages.active?r`<span class="tag warn" data-self-on>${p("selfActive",{time:e.self_messages.until?ce(new Date(e.self_messages.until)):""})}</span>`:r`<span class="tag" data-self-off>${p("selfOff")}</span>`}</div>
        ${this.editable?r`<div class="grid">
          <label>${p("selfMinutes")}<input class="in" inputmode="numeric" data-self-minutes .value=${this.minutes} ?disabled=${this.busy}
            @input=${a=>this.minutes=a.target.value}></label>
          <sw-button size="sm" variant="primary" data-self-start ?disabled=${this.busy} @click=${()=>this.startWindow()}>${p("selfStart")}</sw-button>
          <sw-button size="sm" variant="ghost" data-self-stop ?disabled=${this.busy||!e.self_messages.active}
            @click=${()=>void this.run(()=>W().selfWindow(null))}>${p("selfStop")}</sw-button></div>`:l}
      </div>
    </sw-card>`}};$.styles=[B,Y`
    :host { display: block; min-inline-size: 0; }
    .head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-block-end: var(--sw-s-2); }
    .head strong { min-inline-size: 0; overflow-wrap: anywhere; }
    .tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: var(--sw-fs-xs); background: var(--sw-surface-3); color: var(--sw-text-2); white-space: nowrap; }
    .tag.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .tag.ok { background: var(--sw-success-soft); color: var(--sw-success-text); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: var(--sw-s-2); align-items: end; inline-size: 100%; }
    .grid label { display: flex; flex-direction: column; gap: 4px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); min-inline-size: 0; }
    .grid .in { inline-size: 100%; min-inline-size: 0; box-sizing: border-box; }
    .entry { display: flex; align-items: center; gap: var(--sw-s-2); min-inline-size: 0; padding-block: 6px; border-block-start: 1px solid var(--sw-border); }
    .entry .name { flex: 1; min-inline-size: 0; overflow-wrap: anywhere; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-block-start: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .sect { border-block-start: 1px solid var(--sw-border); margin-block-start: var(--sw-s-2); padding-block-start: var(--sw-s-2); }
  `];k([h()],$.prototype,"view",2);k([h()],$.prototype,"state",2);k([h()],$.prototype,"error",2);k([h()],$.prototype,"ok",2);k([h()],$.prototype,"busy",2);k([h()],$.prototype,"page",2);k([h()],$.prototype,"phone",2);k([h()],$.prototype,"label",2);k([h()],$.prototype,"newRole",2);k([h()],$.prototype,"minutes",2);$=k([Q("messaging-policy-card")],$);const D="messaging/whatsapp",as={view:()=>N(D),save:e=>I(D,e),refresh:()=>F(`${D}/refresh`),test:(e,s)=>F(`${D}/test`,{account_key:e,target:s})},z={min_gap_s:5,jitter_s:1,per_hour:100,per_day:600,per_recipient_hour:4,hold_when_down_min:15},ns={min_gap_s:[5,600],jitter_s:[0,300],per_hour:[1,2e3],per_day:[1,1e4],per_recipient_hour:[1,30],hold_when_down_min:[1,240]};function P(){return{revision:3,can_manage:!0,ws_connected:!0,accounts:[{key:"entry:01JDEMOOFFICE",kind:"discovered",label:"משרד הניהול",label_set:!0,last4:"0099",state:"connected",state_source:"entity",in_mirror:!0,stored:!0,shared_outside:!1,removed:!1,pacing:{...z},uses:["tickets.codes","tickets.messages"],sends_24h:12,last_send_at:"2026-10-13T09:58:00Z",has_status_entity:!0},{key:"entry:01JDEMOINTERC",kind:"discovered",label:"אינטרקום",label_set:!0,last4:"0098",state:"connected",state_source:"entity",in_mirror:!0,stored:!0,shared_outside:!0,removed:!1,pacing:{...z},uses:["tickets.messages@dept:dept-cleaning"],sends_24h:41,last_send_at:"2026-10-13T10:31:00Z",has_status_entity:!0},{key:"manual:demo01",kind:"manual",label:"מספר ישן",label_set:!0,last4:"0097",state:"disconnected",state_source:"status_entity",in_mirror:!1,stored:!0,shared_outside:!1,removed:!1,pacing:{...z},uses:[],sends_24h:0,last_send_at:null,has_status_entity:!0,account:"15555550097",status_entity_id:"binary_sensor.old_phone_online",connected_states:["on"]}],uses:[{key:"tickets.messages",module:"tickets",label:"הודעות בקשות שירות",inherits:null,inherits_label:null,per_department:!0,required:!0,value:"entry:01JDEMOOFFICE",resolved:"entry:01JDEMOOFFICE",queued:2,departments:[{id:"dept-maintenance",name:"אחזקה",value:null,resolved:"entry:01JDEMOOFFICE"},{id:"dept-cleaning",name:"ניקיון",value:"entry:01JDEMOINTERC",resolved:"entry:01JDEMOINTERC"}]},{key:"tickets.codes",module:"tickets",label:"קודי אימות לבקשות שירות",inherits:"tickets.messages",inherits_label:"הודעות בקשות שירות",per_department:!1,required:!1,value:null,resolved:"entry:01JDEMOOFFICE",queued:0}],mapping:{"tickets.messages":"entry:01JDEMOOFFICE","tickets.codes":null,"tickets.messages@dept:dept-cleaning":"entry:01JDEMOINTERC"},warnings:[{code:"shared_outside",use:"tickets.messages",department_id:"dept-cleaning",account_key:"entry:01JDEMOINTERC",severity:"amber"}],channels:[{key:"whatsapp",state:"active"},{key:"email",state:"active"},{key:"inapp",state:"active"},{key:"sms",state:"soon"}],modules:{tickets:"ניהול השירות"},pacing_ranges:ns,pacing_default:{...z},test_send:{enabled:!0}}}let y=null;const is={async view(){return y??=P(),structuredClone(y)},async save(e){if(y??=P(),e.revision!==y.revision)throw new C(409,{code:"settings_stale",user_message:"ההגדרות השתנו בינתיים. טענו מחדש.",retryable:!1,correlation_id:"demo",details:{}});const s=new Map(y.accounts.map(t=>[t.key,t]));y.accounts=e.accounts.map(t=>{const a=s.get(t.key);return{...a??{state:"unknown",state_source:"sends",in_mirror:!1,uses:[],sends_24h:0,last_send_at:null,has_status_entity:!!t.status_entity_id,last4:null,removed:!1},key:t.key,kind:t.kind,label:t.label||a?.label||"וואטסאפ (ידני)",label_set:!!t.label,stored:!0,shared_outside:t.shared_outside,pacing:{...z,...t.pacing??{}},...t.kind==="manual"?{account:t.account??null,status_entity_id:t.status_entity_id??null,last4:(t.account??"").replace(/\D/g,"").slice(-4)||null}:{}}}),y.mapping={...e.uses};for(const t of y.uses){t.value=e.uses[t.key]??null,t.resolved=t.value??(t.inherits?e.uses[t.inherits]??null:null);for(const a of t.departments??[])a.value=e.uses[`${t.key}@dept:${a.id}`]??null,a.resolved=a.value??t.resolved}for(const t of y.accounts)t.uses=Object.entries(e.uses).filter(([,a])=>a===t.key).map(([a])=>a);return y.revision+=1,structuredClone(y)},async refresh(){return y??=P(),structuredClone(y)},async test(){return{id:"demo-test",state:"queued"}}};function R(){return G()?as:is}const rs={tab:"ערוץ ההודעות",title:"ערוץ ההודעות",sub:"מאיזה חשבון וואטסאפ נשלחות ההודעות של כל שימוש",keywords:"וואטסאפ חשבון חשבונות מספר שולח ערוץ הודעות קוד אימות שימושים SMS",loading:"טוען…",forbidden:"אין הרשאה לצפות בחשבונות",retry:"נסו שוב",accounts:"חשבונות וואטסאפ",source:"מרכיב הוואטסאפ של תשתית המערכת",refresh:"רענון",refreshed:"נקרא מחדש",noAccounts:"לא נמצאו חשבונות. אפשר להוסיף חשבון ידני.",wsDown:"אין חיבור לתשתית המערכת - המצבים אינם עדכניים",manualTag:"ידני",notInMirror:"לא נמצא בתשתית",usedBy:"בשימוש: {uses}",unused:"לא בשימוש",sends:"{n} מתוך {cap} ב-24 שעות",lastSend:"שליחה אחרונה {time}",neverSent:"לא נשלחו הודעות",st_connected:"מחובר",st_disconnected:"מנותק",st_unknown:"לא ידוע",st_missing:"לא נמצא",usesTitle:"שימושים",noUses:"אין שימושים פעילים",none:"ללא",same:"כמו {use}",deptDefault:"ברירת המחדל",deptOwn:"חשבון משלה",installDefault:"ברירת המחדל להתקנה",inheritDefault:"ברירת המחדל: אותו חשבון",deptOf:"{dept}",deptsToggle:"מחלקות ({n})",queued:"{n} ממתינות",w_shared_module:"המספר משותף גם ל{module} - קצב שליחה משותף",w_shared_outside:"המספר משמש גם מחוץ למערכת",w_required_unmapped:"לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ",w_maybe_same_number:"ייתכן שזה אותו מספר",w_down_disconnected:"החשבון מנותק",w_down_missing:"החשבון לא נמצא",w_down_unknown:"מצב החשבון לא ידוע",sharedChip:"משותף",manualRow:"הזנה ידנית",manualSub:"כשהחשבון לא נמצא בתשתית",manualAdd:"חשבון ידני",manualTitle:"חשבון ידני",manualValue:"מזהה החשבון",manualValueSub:"מזהה הרשומה או ספרות המספר, כפי שהם בתשתית",manualStatus:"ישות מצב (לא חובה)",labelField:"שם",add:"הוספה",cancel:"ביטול",selected:"החשבון הנבחר",selectHint:"בחרו חשבון מהרשימה",sharedOutside:"משמש גם מחוץ למערכת",sharedOutsideSub:"למשל אינטרקום או טלפון של אדם",pacing:"קצב שליחה",pacingSub:"משותף לכל השימושים של החשבון",pacingSummary:"{hour} בשעה · {day} ביממה · מרווח {gap} שניות",p_min_gap_s:"מרווח מזערי (שניות)",p_jitter_s:"תוספת אקראית (שניות)",p_per_hour:"בשעה",p_per_day:"ביממה",p_per_recipient_hour:"לנמען בשעה",p_hold_when_down_min:"המתנה כשמנותק (דקות)",remove:"הסרה",removeInUse:"החשבון בשימוש - בחרו חשבון אחר לשימושים לפני ההסרה",testTitle:"שליחת בדיקה",testTarget:"מספר לבדיקה",testSend:"שליחה",testOff:"שליחת בדיקה אינה זמינה עד שערוץ ההודעות פועל",testConfirmLine:"תישלח הודעת בדיקה אחת אמיתית בוואטסאפ מהחשבון הזה אל {target}. עד 5 בדיקות בשעה לכל חשבון.",testQueued:"הבדיקה נשלחה לתור",channels:"ערוצים",ch_whatsapp:"וואטסאפ",ch_whatsapp_sub:"הערוץ הראשי לספקים ולאנשי קשר",ch_email:'דוא"ל',ch_email_sub:"גיבוי כשהערוץ מנותק",ch_inapp:"באפליקציה",ch_inapp_sub:"משתמשי המערכת",ch_sms:"SMS",ch_sms_sub:"בקרוב",cs_active:"פעיל",cs_down:"מנותק",cs_not_configured:"לא מוגדר",cs_idle:"לא בשימוש",cs_soon:"בקרוב",save:"שמירה",discard:"ביטול שינויים",dirty:"לא נשמר",saved:"נשמר",readOnly:"צפייה בלבד",confirmTitle:"הודעות ממתינות",confirmLine:"{n} הודעות ממתינות יישלחו מהחשבון החדש",confirmSave:"שמירה",err_manual_equals_discovered:"המזהה הזה הוא של חשבון שכבר נמצא - בחרו אותו מהרשימה",err_manual_value_invalid:"מזהה לא תקין",err_pacing_out_of_range:"ערך מחוץ לטווח",err_pacing_day_below_hour:"המכסה ביממה קטנה מהמכסה בשעה"},os={tab:"Messaging channel",title:"Messaging channel",sub:"Which WhatsApp account sends the messages of each use",accounts:"WhatsApp accounts",source:"The system platform's WhatsApp component",refresh:"Refresh",st_connected:"Connected",st_disconnected:"Disconnected",st_unknown:"Unknown",st_missing:"Not found",usesTitle:"Uses",none:"None",same:"Same as {use}",deptDefault:"Default",manualAdd:"Manual account",selected:"Selected account",pacing:"Sending pace",channels:"Channels",ch_sms_sub:"Coming soon",cs_soon:"Coming soon",save:"Save",cancel:"Cancel"};function ls(){return typeof document<"u"&&(document.documentElement.lang||"").toLowerCase().startsWith("en")?"en":"he"}function n(e,s){const t=(ls()==="en"?os[e]:void 0)??rs[e]??e;return s?t.replace(/\{(\w+)\}/g,(a,i)=>i in s?String(s[i]):a):t}const J="@dept:",he=["min_gap_s","jitter_s","per_hour","per_day","per_recipient_hour","hold_when_down_min"],ds=/^[A-Za-z0-9_\-.:@+]{1,64}$/,U=40;function me(e){return{accounts:e.accounts.filter(s=>!s.removed).map(s=>({key:s.key,kind:s.kind,label:s.label_set?s.label:"",shared_outside:s.shared_outside,pacing:{...s.pacing},...s.kind==="manual"?{account:s.account??"",status_entity_id:s.status_entity_id??null}:{}})),uses:{...e.mapping}}}const ne=e=>JSON.stringify(Object.entries(e).filter(([,s])=>s).sort(([s],[t])=>s.localeCompare(t)));function ie(e,s){return JSON.stringify(me(e).accounts)!==JSON.stringify(s.accounts)||ne(e.mapping)!==ne(s.uses)}function cs(e,s,t=!1){const a=s.accounts.map(o=>{const d={key:o.key,kind:o.kind,label:o.label.trim(),shared_outside:o.shared_outside,pacing:{...o.pacing}};return o.kind==="manual"&&(d.account=(o.account??"").trim(),d.status_entity_id=o.status_entity_id?.trim()||null),d}),i={};for(const[o,d]of Object.entries(s.uses))i[o]=d||null;return{revision:e.revision,accounts:a,uses:i,...t?{confirm_queued:!0}:{}}}function us(e,s=Math.random){const t="abcdefghijklmnopqrstuvwxyz0123456789";for(;;){let a="";for(let o=0;o<8;o++)a+=t[Math.floor(s()*t.length)%t.length];const i=`manual:${a}`;if(!e.accounts.some(o=>o.key===i))return i}}function ps(e,s){const t=e.trim();return ds.test(t)?s.accounts.some(a=>a.kind==="discovered"&&a.key===`entry:${t}`)?"manual_equals_discovered":null:"manual_value_invalid"}function hs(e,s){for(const t of he){const[a,i]=e.pacing_ranges[t];if(!Number.isInteger(s[t])||s[t]<a||s[t]>i)return{field:t,code:"pacing_out_of_range"}}return s.per_day<s.per_hour?{field:"per_day",code:"pacing_day_below_hour"}:null}function j(e,s){return Object.entries(e.uses).filter(([,t])=>t===s).map(([t])=>t)}function M(e,s){return s?e.accounts.find(t=>t.key===s):void 0}function V(e,s,t){const a=s.accounts.find(o=>o.key===t);if(a?.label.trim())return a.label.trim();const i=M(e,t);return i&&!i.label_set||i?.kind==="discovered"?i.label:n("manualTag")}function fe(e){return n(`st_${e}`)}function re(e,s,t,a=!1){const i=a?{value:"",label:n("deptDefault")}:t.inherits?{value:"",label:n("same",{use:t.inherits_label??t.inherits})}:{value:"",label:n("none")},o=new Set(s.accounts.map(c=>c.key)),d=[...s.accounts.map(c=>c.key),...e.accounts.filter(c=>!o.has(c.key)&&!c.removed).map(c=>c.key)],f=c=>c.startsWith("entry:")?0:1,S=d.sort((c,v)=>f(c)-f(v)).map(c=>{const v=M(e,c),m=[V(e,s,c)];return v?.last4&&!m[0].includes(v.last4)&&m.push(`····${v.last4}`),v&&v.state!=="connected"&&m.push(fe(v.state)),{value:c,label:m.join(" · ")}});return[i,...S]}function oe(e,s,t){return e.warnings.filter(a=>a.use===s&&(a.department_id??null)===t)}function le(e,s){const t=new Set;return e.warnings.filter(a=>{if(a.account_key!==s||!(a.code==="shared_module"||a.code==="shared_outside"||a.code==="maybe_same_number"))return!1;const i=`${a.code}:${a.module??""}`;return t.has(i)?!1:(t.add(i),!0)})}function de(e,s){return e.code==="account_down"?n(e.state==="missing"?"w_down_missing":e.state==="unknown"?"w_down_unknown":"w_down_disconnected"):e.code==="shared_module"?n("w_shared_module",{module:s[e.module??""]??e.module??""}):n(`w_${e.code}`)}function ms(e,s){return s.map(t=>{const[a,i]=t.split(J),o=e.uses.find(f=>f.key===a);if(!o)return"";const d=i?o.departments?.find(f=>f.id===i)?.name:"";return d?`${o.label} · ${d}`:o.label}).filter(Boolean).join(", ")}function fs(e){return e==="connected"?"ok":e==="unknown"?"mute":"bad"}var gs=Object.defineProperty,vs=Object.getOwnPropertyDescriptor,_=(e,s,t,a)=>{for(var i=a>1?void 0:a?vs(s,t):s,o=e.length-1,d;o>=0;o--)(d=e[o])&&(i=(a?d(s,t,i):d(i))||i);return a&&i&&gs(s,t,i),i};let w=class extends Z{constructor(){super(...arguments),this.bubbleSkin=new be(this),this.view=null,this.draft=null,this.selected="",this.busy=!1,this.error="",this.ok="",this.loadState="loading",this.manualOpen=!1,this.manual={label:"",value:"",entity:""},this.confirm=null,this.openDepts={},this.pacingOpen=!1,this.testTarget="",this.testConfirm=!1,this.fieldErrors={},this.okTimer=0}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.okTimer)}say(e){this.ok=e,this.error="",window.clearTimeout(this.okTimer),this.okTimer=window.setTimeout(()=>this.ok="",3e3)}take(e){this.view=e,this.draft=me(e),this.fieldErrors={},(!this.selected||!e.accounts.some(s=>s.key===this.selected))&&(this.selected=e.accounts[0]?.key??""),this.loadState="ready"}async load(){try{this.take(await R().view())}catch(e){this.loadState=e instanceof C&&e.status===403?"forbidden":"error",this.error=this.loadState==="error"?O(e):""}}get editable(){return!!this.view?.can_manage}setAccount(e,s){this.draft&&(this.draft={...this.draft,accounts:this.draft.accounts.map(t=>t.key===e?{...t,...s}:t)})}setUse(e,s){this.draft&&(this.draft={...this.draft,uses:{...this.draft.uses,[e]:s||null}})}ensureDraftAccount(e){if(!this.draft||!this.view||this.draft.accounts.some(t=>t.key===e))return;const s=M(this.view,e);s&&(this.draft={...this.draft,accounts:[...this.draft.accounts,{key:e,kind:s.kind,label:"",shared_outside:!1,pacing:{...s.pacing}}]})}async save(e=!1){if(!(!this.view||!this.draft||this.busy)){for(const s of this.draft.accounts){const t=hs(this.view,s.pacing);if(t){this.selected=s.key,this.pacingOpen=!0,this.fieldErrors={[`pacing.${t.field}`]:n(`err_${t.code}`)};return}}this.busy=!0;try{this.take(await R().save(cs(this.view,this.draft,e))),this.confirm=null,this.say(n("saved"))}catch(s){if(s instanceof C&&s.code==="queued_messages")this.confirm=s.body.details?.moves??[];else if(s instanceof C&&s.code==="validation"){const t=s.body.details?.fields??[];this.fieldErrors=Object.fromEntries(t.map(a=>[a.field,n(`err_${a.code}`)])),this.error=O(s)}else this.error=O(s),s instanceof C&&s.status===409&&this.load()}finally{this.busy=!1}}}async refresh(){if(!this.busy){this.busy=!0;try{const e=this.view&&this.draft&&ie(this.view,this.draft),s=await R().refresh();e?this.view=s:this.take(s),this.say(n("refreshed"))}catch(e){this.error=O(e)}finally{this.busy=!1}}}addManual(){if(!this.view||!this.draft)return;const e=ps(this.manual.value,this.view);if(e){this.fieldErrors={manual:n(`err_${e}`)};return}const s=us(this.draft),t=this.manual.entity.trim();this.draft={...this.draft,accounts:[...this.draft.accounts,{key:s,kind:"manual",label:this.manual.label.trim().slice(0,U),shared_outside:!1,pacing:{...this.view.pacing_default},account:this.manual.value.trim(),status_entity_id:t||null}]},this.selected=s,this.manualOpen=!1,this.manual={label:"",value:"",entity:""},this.fieldErrors={}}select(e){this.selected=e,this.pacingOpen=!1,typeof window<"u"&&window.innerWidth<1024&&this.updateComplete.then(()=>this.renderRoot.querySelector('[data-card="selected"]')?.scrollIntoView({block:"start",behavior:window.matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"}))}removeAccount(e){!this.draft||j(this.draft,e).length||(this.draft={...this.draft,accounts:this.draft.accounts.filter(s=>s.key!==e)},this.selected=this.draft.accounts[0]?.key??"")}async test(){if(!(!this.selected||this.busy)){this.busy=!0;try{await R().test(this.selected,this.testTarget),this.testTarget="",this.say(n("testQueued"))}catch(e){this.error=O(e)}finally{this.busy=!1}}}chip(e){return r`<span class=${`tag ${fs(e)}`} data-state=${e}>${fe(e)}</span>`}warnChips(e){if(!this.view||!e.length)return l;const s=this.view.modules;return r`<div class="warnline">${e.map(t=>r`<span class=${`tag ${t.severity==="red"?"bad":t.severity==="amber"?"warn":"mute"}`} data-warning=${t.code}><sw-icon name="warning" size="14"></sw-icon>${de(t,s)}</span>`)}</div>`}accountRow(e){const s=this.view,t=this.draft,a=M(s,e),i=a?.state??"unknown",o=j(t,e),d=t.accounts.find(c=>c.key===e)?.pacing.per_day??a?.pacing.per_day??0,f=le(s,e).some(c=>c.code!=="maybe_same_number")||t.accounts.find(c=>c.key===e)?.shared_outside,S=[o.length?n("usedBy",{uses:ms(s,o)}):n("unused"),n("sends",{n:a?.sends_24h??0,cap:d})].join(" · ");return r`<button type="button" class="acc" aria-pressed=${String(this.selected===e)} data-account=${e} @click=${()=>this.select(e)}>
      <sw-icon name="signal" size="18"></sw-icon>
      <span class="nm"><b>${K(V(s,t,e))}${a?.last4?r` <span class="ltr muted">····${a.last4}</span>`:l}${a?.kind==="manual"||!a?r` <span class="tag mute">${n("manualTag")}</span>`:l}</b>
        <small>${S}</small></span>
      <span class="chips">${f?r`<span class="tag warn" data-shared><sw-icon name="warning" size="14"></sw-icon>${n("sharedChip")}</span>`:l}${this.chip(i)}</span>
    </button>`}useRow(e){const s=this.view,t=this.draft,a=t.uses[e.key]??"",i=e.inherits?n("inheritDefault"):n("installDefault"),o=e.departments??[],d=this.openDepts[e.key]??o.some(f=>!!t.uses[`${e.key}${J}${f.id}`]);return r`<div class="usegroup" data-use=${e.key}>
      <div class="row"><span class="lbl">${e.label}<span class="muted">${i}${e.queued?` · ${n("queued",{n:e.queued})}`:""}</span>${this.warnChips(oe(s,e.key,null))}</span>
        <span class="ctl"><select class="in" data-use-pick=${e.key} aria-label=${e.label} ?disabled=${!this.editable||this.busy} @change=${f=>this.setUse(e.key,f.target.value)}>
          ${re(s,t,e).map(f=>r`<option value=${f.value} ?selected=${f.value===a}>${f.label}</option>`)}
        </select></span></div>
      ${e.per_department&&o.length?r`
        <button type="button" class="linkbtn depts" aria-expanded=${String(d)} data-depts-toggle=${e.key} @click=${()=>this.openDepts={...this.openDepts,[e.key]:!d}}><sw-icon name="chevronDown" size="14"></sw-icon>${n("deptsToggle",{n:o.length})}</button>
        ${d?o.map(f=>{const S=`${e.key}${J}${f.id}`,c=t.uses[S]??"";return r`<div class="row dept" data-dept-row=${f.id}><span class="lbl">${K(f.name)}<span class="muted">${n(c?"deptOwn":"deptDefault")}</span>${this.warnChips(oe(s,e.key,f.id))}</span>
            <span class="ctl"><select class="in" data-dept-pick=${S} aria-label=${f.name} ?disabled=${!this.editable||this.busy} @change=${v=>this.setUse(S,v.target.value)}>
              ${re(s,t,e,!0).map(v=>r`<option value=${v.value} ?selected=${v.value===c}>${v.label}</option>`)}
            </select></span></div>`}):l}`:l}
    </div>`}accountsCard(){const e=this.view,s=this.draft,t=[...s.accounts.map(i=>i.key),...e.accounts.filter(i=>!i.removed&&!s.accounts.some(o=>o.key===i.key)).map(i=>i.key)],a=e.warnings.filter(i=>i.code==="required_unmapped");return r`<sw-card data-card="accounts">
      <div class="head"><h3 class="sr">${n("accounts")}</h3><strong>${n("accounts")}</strong><span class="tag">${n("source")}</span><span class="grow"></span>
        ${this.editable?r`<sw-button size="sm" icon="refresh" data-refresh ?disabled=${this.busy} @click=${()=>void this.refresh()}>${n("refresh")}</sw-button>`:l}</div>
      ${e.ws_connected?l:r`<div class="msg warn" data-ws-down><sw-icon name="offline" size="16"></sw-icon>${n("wsDown")}</div>`}
      ${a.length?r`<div class="msg err" data-required-unmapped><sw-icon name="warning" size="16"></sw-icon>${de(a[0],e.modules)}</div>`:l}
      <div data-accounts>${t.length?L(t,i=>i,i=>this.accountRow(i)):r`<p class="muted" data-no-accounts>${n("noAccounts")}</p>`}</div>
      ${e.uses.length?L(e.uses,i=>i.key,i=>this.useRow(i)):r`<div class="usegroup"><span class="muted" data-no-uses>${n("noUses")}</span></div>`}
      <div class="usegroup"><div class="row"><span class="lbl">${n("manualRow")}<span class="muted">${n("manualSub")}</span></span>
        <sw-button size="sm" icon="plus" data-manual-add ?disabled=${!this.editable||this.busy} @click=${()=>{this.manualOpen=!0,this.fieldErrors={}}}>${n("manualAdd")}</sw-button></div></div>
    </sw-card>`}channelsCard(){const e=this.view,s=t=>t==="active"?"ok":t==="down"?"bad":"mute";return r`<sw-card heading=${n("channels")} data-card="channels">
      ${e.channels.map(t=>r`<div class=${`row ${t.state==="soon"?"disabled":""}`} data-channel=${t.key} aria-disabled=${t.state==="soon"?"true":"false"}>
        <span class="lbl">${n(`ch_${t.key}`)}<span class="muted">${n(`ch_${t.key}_sub`)}</span></span>
        <span class=${`tag ${s(t.state)}`} data-channel-state=${t.state}>${n(`cs_${t.state}`)}</span></div>`)}
    </sw-card>`}selectedCard(){const e=this.view,s=this.draft,t=this.selected,a=M(e,t),i=s.accounts.find(m=>m.key===t);if(!t||!a&&!i)return r`<sw-card heading=${n("selected")} data-card="selected"><p class="muted">${n("selectHint")}</p></sw-card>`;const o=i?.kind??a?.kind??"discovered",d=i?.pacing??a?.pacing??e.pacing_default,f=j(s,t).length>0,S=this.editable&&(o==="manual"||(a?!a.in_mirror:!0)),c=this.editable&&!this.busy,v=this.fieldErrors;return r`<sw-card heading=${n("selected")} data-card="selected" data-selected=${t}>
      <div class="row"><span class="lbl">${K(V(e,s,t))}<span class="muted">${a?.last_send_at?n("lastSend",{time:_e(a.last_send_at)}):n("neverSent")}</span></span>${this.chip(a?.state??"unknown")}</div>
      ${this.warnChips(le(e,t))}
      <div class="row stack"><label class="lbl" for="lbl">${n("labelField")}</label>
        <input id="lbl" class="in" maxlength=${U} data-label .value=${i?.label??""} placeholder=${a?.label??""} ?disabled=${!c}
          @input=${m=>{this.ensureDraftAccount(t),this.setAccount(t,{label:m.target.value})}} /></div>
      ${o==="manual"?r`
        <div class="row stack"><label class="lbl" for="mv">${n("manualValue")}<span class="muted">${n("manualValueSub")}</span></label>
          <input id="mv" class="in ltr" dir="ltr" maxlength="64" data-manual-value .value=${e.can_manage?i?.account??"":a?.last4?`····${a.last4}`:""} ?disabled=${!c}
            aria-invalid=${String(!!v["accounts.account"])} @input=${m=>this.setAccount(t,{account:m.target.value})} /></div>
        <div class="row stack"><label class="lbl" for="se">${n("manualStatus")}</label>
          <input id="se" class="in ltr" dir="ltr" maxlength="120" data-manual-status .value=${i?.status_entity_id??""} ?disabled=${!c}
            @input=${m=>this.setAccount(t,{status_entity_id:m.target.value||null})} /></div>`:l}
      <div class="row"><span class="lbl">${n("sharedOutside")}<span class="muted">${n("sharedOutsideSub")}</span></span>
        <sw-toggle label=${n("sharedOutside")} labelHidden data-shared-outside .checked=${i?.shared_outside??a?.shared_outside??!1} ?disabled=${!c}
          @change=${m=>{this.ensureDraftAccount(t),this.setAccount(t,{shared_outside:m.detail.checked})}}></sw-toggle></div>
      <div class="row stack"><span class="lbl">${n("pacing")}<span class="muted">${n("pacingSub")}</span></span>
        <button type="button" class="linkbtn" aria-expanded=${String(this.pacingOpen)} data-pacing-toggle @click=${()=>this.pacingOpen=!this.pacingOpen}>${n("pacingSummary",{hour:d.per_hour,day:d.per_day,gap:d.min_gap_s})}</button>
        ${this.pacingOpen?r`<div class="pace" data-pacing>${he.map(m=>r`<label>${n(`p_${m}`)}
          <input class="in num" type="number" inputmode="numeric" min=${e.pacing_ranges[m][0]} max=${e.pacing_ranges[m][1]} data-pace=${m} .value=${String(d[m])} ?disabled=${!c}
            aria-invalid=${String(!!v[`pacing.${m}`])} @input=${ge=>{this.ensureDraftAccount(t),this.setAccount(t,{pacing:{...d,[m]:Number(ge.target.value)}})}} />
          ${v[`pacing.${m}`]?r`<span class="field-error">${v[`pacing.${m}`]}</span>`:l}</label>`)}</div>`:l}</div>
      <div class="row stack"><span class="lbl">${n("testTitle")}${e.test_send.enabled?l:r`<span class="muted" data-test-off>${n("testOff")}</span>`}</span>
        <div class="actions"><input class="in ltr" dir="ltr" inputmode="tel" maxlength="20" data-test-target aria-label=${n("testTarget")} placeholder=${n("testTarget")} .value=${this.testTarget}
          ?disabled=${!e.test_send.enabled||!c} @input=${m=>this.testTarget=m.target.value} />
          <sw-button size="sm" data-test-send ?disabled=${!e.test_send.enabled||!c||!this.testTarget.trim()} @click=${()=>this.testConfirm=!0}>${n("testSend")}</sw-button></div></div>
      ${S?r`<div class="row"><span class="lbl">${f?r`<span class="muted">${n("removeInUse")}</span>`:l}</span>
        <sw-button size="sm" variant="danger" data-remove ?disabled=${f||this.busy} @click=${()=>this.removeAccount(t)}>${n("remove")}</sw-button></div>`:l}
    </sw-card>`}manualDialog(){const e=this.fieldErrors.manual??"";return r`<sw-dialog heading=${n("manualTitle")} .open=${this.manualOpen} data-manual-dialog @close=${()=>this.manualOpen=!1}>
      <div class="form">
        <label>${n("labelField")}<input class="in" maxlength=${U} data-manual-label .value=${this.manual.label} @input=${s=>this.manual={...this.manual,label:s.target.value}} /></label>
        <label>${n("manualValue")}<span class="muted">${n("manualValueSub")}</span><input class="in ltr" dir="ltr" maxlength="64" data-manual-new-value aria-invalid=${String(!!e)} .value=${this.manual.value} @input=${s=>{this.manual={...this.manual,value:s.target.value},this.fieldErrors={}}} />
          ${e?r`<span class="field-error" data-manual-error>${e}</span>`:l}</label>
        <label>${n("manualStatus")}<input class="in ltr" dir="ltr" maxlength="120" data-manual-new-status .value=${this.manual.entity} @input=${s=>this.manual={...this.manual,entity:s.target.value}} /></label>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.manualOpen=!1}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-manual-ok ?disabled=${!this.manual.value.trim()} @click=${()=>this.addManual()}>${n("add")}</sw-button>
    </sw-dialog>`}testDialog(){return r`<sw-dialog heading=${n("testTitle")} .open=${this.testConfirm} data-test-dialog @close=${()=>this.testConfirm=!1}>
      <p>${n("testConfirmLine",{target:this.testTarget.trim()})}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.testConfirm=!1}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-test-confirm ?disabled=${this.busy} @click=${()=>{this.testConfirm=!1,this.test()}}>${n("testSend")}</sw-button>
    </sw-dialog>`}confirmDialog(){const e=(this.confirm??[]).reduce((s,t)=>s+t.count,0);return r`<sw-dialog heading=${n("confirmTitle")} .open=${!!this.confirm} data-confirm-dialog @close=${()=>this.confirm=null}>
      <p data-confirm-count=${e}>${n("confirmLine",{n:e})}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.confirm=null}>${n("cancel")}</sw-button>
      <sw-button slot="footer" variant="primary" data-confirm-save ?disabled=${this.busy} @click=${()=>void this.save(!0)}>${n("confirmSave")}</sw-button>
    </sw-dialog>`}render(){const e=n("title");if(this.loadState==="loading")return r`<sw-page crumbs="הגדרות" heading=${e}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.loadState!=="ready"||!this.view||!this.draft)return r`<sw-page crumbs="הגדרות" heading=${e} data-messaging-accounts data-state=${this.loadState}>
        <sw-state-panel icon="mail" state=${this.loadState==="forbidden"?"forbidden":"error"} heading=${this.loadState==="forbidden"?n("forbidden"):this.error} actionLabel=${n("retry")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const s=ie(this.view,this.draft);return r`<sw-page crumbs="הגדרות" heading=${e} subheading=${n("sub")} data-messaging-accounts data-state="ready">
      ${this.error?r`<div class="msg err" role="alert" data-error>${this.error}</div>`:l}
      ${this.ok?r`<div class="msg ok" role="status" data-ok>${this.ok}</div>`:l}
      <div class="cols">
        <div class="col">${this.accountsCard()}${this.channelsCard()}</div>
        <div class="col">${this.selectedCard()}<messaging-pacing-card .labels=${Object.fromEntries(this.view.accounts.map(t=>[t.key,t.label]))}></messaging-pacing-card><messaging-policy-card></messaging-policy-card></div>
      </div>
      ${this.editable?r`<div class="savebar" data-savebar>
        <span class=${s?"dirty":"muted"}>${s?n("dirty"):""}</span><span class="grow"></span>
        <sw-button size="sm" variant="ghost" data-discard ?disabled=${!s||this.busy} @click=${()=>this.view&&this.take(this.view)}>${n("discard")}</sw-button>
        <sw-button size="sm" variant="primary" data-save ?disabled=${!s||this.busy} @click=${()=>void this.save()}>${n("save")}</sw-button>
      </div>`:r`<p class="muted" data-read-only>${n("readOnly")}</p>`}
      ${this.manualDialog()}${this.confirmDialog()}${this.testDialog()}
    </sw-page>`}};w.styles=[B,Y`
    .cols {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      align-items: start;
      max-inline-size: 1180px;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    .head {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: var(--sw-s-2);
    }
    .head .grow {
      flex: 1;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      white-space: nowrap;
    }
    .tag.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .tag.bad {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .tag.warn {
      background: var(--sw-warning-soft);
      color: var(--sw-warning-text);
    }
    .tag.mute {
      background: var(--sw-surface-3);
      color: var(--sw-text-3);
    }
    .acc {
      display: flex;
      align-items: center;
      gap: 10px;
      inline-size: 100%;
      padding: 10px 6px;
      border: 0;
      border-block-end: 1px solid var(--sw-border);
      border-radius: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      cursor: pointer;
      min-inline-size: 0;
    }
    .acc[aria-pressed='true'] {
      background: var(--sw-accent-soft);
      border-radius: var(--sw-r-sm);
    }
    .acc:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .acc .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .acc .nm b {
      font-weight: var(--sw-fw-semibold);
      overflow-wrap: anywhere;
    }
    .acc .nm small {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      overflow-wrap: anywhere;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      justify-content: flex-end;
    }
    .in {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-solid);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      inline-size: 100%;
      min-inline-size: 0;
    }
    .in.num {
      inline-size: 96px;
    }
    /* a stacked row: the label is a line, not a 220 px flex basis (which is a HEIGHT in a column) */
    .row.stack .lbl {
      flex: none;
    }
    .warnline {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 4px;
      min-inline-size: 0;
    }
    /* a warning is a sentence: it wraps inside its row on a narrow phone instead of leaving the card */
    .warnline .tag {
      white-space: normal;
      max-inline-size: 100%;
      box-sizing: border-box;
      /* GATE-FIX-2270: a wrapped warning is a short block, not a pill - a 999 px radius put the last word of a two-line warning
         into the rounded corner (domus 1024 px); one line still reads as a rounded tag */
      border-radius: var(--sw-r-md);
    }
    .usegroup {
      border-block-start: 1px solid var(--sw-border);
      margin-block-start: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    .usegroup h4 {
      margin: 0 0 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-semibold);
    }
    .linkbtn {
      border: 0;
      background: transparent;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      padding: 4px 0;
    }
    .pace {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px 12px;
      inline-size: 100%;
    }
    .pace label {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      min-inline-size: 0;
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .form label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .disabled {
      opacity: var(--sw-disabled-opacity);
    }
    /* CALMSG-POLISH-2331: focus, hover and press on the controls this screen draws itself */
    .in:focus-visible,
    .linkbtn:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }
    .in[aria-invalid='true'] {
      border-color: var(--sw-danger);
    }
    .acc {
      transition: background var(--sw-t-hover) var(--sw-ease-color);
    }
    @media (hover: hover) {
      .acc:not([aria-pressed='true']):hover {
        background: var(--sw-hover-wash);
        border-radius: var(--sw-r-sm);
      }
      .linkbtn:hover {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
    }
    /* a department row belongs to its use: indented, one step lighter, so the use - departments nesting reads at a glance
       (the three department rows looked exactly like the use above them) */
    .linkbtn.depts {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-start: 6px;
    }
    .linkbtn.depts sw-icon {
      transition: transform var(--sw-t-hover) var(--sw-ease);
    }
    .linkbtn.depts[aria-expanded='true'] sw-icon {
      transform: rotate(180deg);
    }
    .row.dept {
      margin-inline-start: var(--sw-s-4);
      padding-block: 10px;
      background: color-mix(in srgb, var(--sw-well, var(--sw-surface-2)) 55%, transparent);
    }
    .row.dept .lbl {
      font-size: var(--sw-fs-md);
    }
    @media (prefers-reduced-motion: reduce) {
      .acc,
      .linkbtn.depts sw-icon {
        transition: none;
      }
    }
    @media (max-width: 1023px) {
      .cols {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    @media (max-width: 480px) {
      .pace {
        grid-template-columns: minmax(0, 1fr);
      }
      .in.num {
        inline-size: 100%;
      }
    }
  `,ye];_([h()],w.prototype,"view",2);_([h()],w.prototype,"draft",2);_([h()],w.prototype,"selected",2);_([h()],w.prototype,"busy",2);_([h()],w.prototype,"error",2);_([h()],w.prototype,"ok",2);_([h()],w.prototype,"loadState",2);_([h()],w.prototype,"manualOpen",2);_([h()],w.prototype,"manual",2);_([h()],w.prototype,"confirm",2);_([h()],w.prototype,"openDepts",2);_([h()],w.prototype,"pacingOpen",2);_([h()],w.prototype,"testTarget",2);_([h()],w.prototype,"testConfirm",2);_([h()],w.prototype,"fieldErrors",2);w=_([Q("system-messaging-accounts")],w);export{w as SystemMessagingAccounts};
//# sourceMappingURL=system-messaging-accounts-CYqwcMTv.js.map
