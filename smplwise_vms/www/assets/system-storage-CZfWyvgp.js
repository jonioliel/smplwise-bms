import{a as k,aX as _,af as y,q as w,A as l,b as r,dL as s,aj as f,p as z,aU as E,gy as L,ai as u,j as R,k as g,m as S}from"./index-HK12zoPD.js";import"./sw-chip-ChHRJG6K.js";import{g as B,r as N,f as v,a as D}from"./storage-kQFSQAUr.js";import{n as V,o as A}from"./cases-CP2rAOOf.js";import{f as C}from"./exports-dKmQ6m_O.js";import{b as T}from"./bubble-chrome-5ObbvscE.js";import{a as q}from"./settings-DYAYUgHz.js";import"./sw-logo-art-PLtEZJxU.js";import"./bytes-QYSxC3WX.js";var P=Object.defineProperty,j=Object.getOwnPropertyDescriptor,p=(a,i,t,n)=>{for(var o=n>1?void 0:n?j(i,t):i,m=a.length-1,$;m>=0;m--)($=a[m])&&(o=(n?$(i,t,o):$(o))||o);return n&&o&&P(i,t,o),o};const M=[{name:s("כניסה ראשית"),gb:320},{name:s("אולם"),gb:410},{name:s("חצר אחורית"),gb:380},{name:s("לובי"),gb:180},{name:s("מחסן"),gb:96}];let c=class extends k{constructor(){super(...arguments),this.bubbleSkin=new _(this),this.range="30D",this.data=null,this.error="",this.loading=!1,this.tz="Asia/Jerusalem",this.local=null,this.localError="",this.resuming=!1,this.signing=null,this.signingError="",this.signingBusy=!1,this.rotateConfirm=!1}connectedCallback(){super.connectedCallback(),y()&&(this.load(),this.loadSigning(),this.loadLocal())}async loadLocal(){try{this.local=await B(),this.localError=""}catch(a){this.localError=w(a)}}async resume(){this.resuming=!0;try{this.local=await N(),this.localError=""}catch(a){this.localError=w(a),this.loadLocal()}finally{this.resuming=!1}}renderDiskGuard(){const a=this.local;if(!a)return this.localError?r`<div class="err">${this.localError}</div>`:l;const i=a.data_disk,t=a.exports.paused_disk_full,n=a.exports.counters;return r`<sw-card heading=${s("הדיסק של התוסף")} subheading=${s("ייצואים, תמונות אירועים וגיבויים נשמרים כאן · ייצוא חדש נדחה מתחת ל־{min} פנויים, וייצוא שרץ מושהה עד שיתפנה מקום",{min:v(i.min_free_mb)})} data-storage-disk-guard>
      ${this.localError?r`<div class="err">${this.localError}</div>`:l}
      <div class="ret">
        <div><div class="v" data-local-free>${f(v(i.free_mb))}</div><div class="l">${f(s("פנויים מתוך {total} · מינימום {min}",{total:v(i.total_mb),min:v(i.min_free_mb)}))}</div></div>
        <div>
          <div><sw-badge kind=${i.low?"error":t?"stale":"recorded"} label=${i.low?s("מתחת למינימום · ייצוא חדש נדחה"):t?s("{n} ייצואים מושהים",{n:t}):s("תקין")} data-local-state></sw-badge></div>
          <div class="l">${s("בתור {n} מתוך {max}",{n:a.exports.waiting,max:a.exports.max_waiting})} · ${s("נדחו בגלל מקום {n}",{n:n.refused_disk})} · ${s("הושהו {n}",{n:n.paused_disk_full})} · ${s("חודשו {n}",{n:n.resumed})}${n.refused_queue_full?` · ${s("נדחו בתור מלא {n}",{n:n.refused_queue_full})}`:""}</div>
          ${t?r`<div style="margin-block-start:6px"><sw-button size="sm" icon="refresh" data-local-resume ?disabled=${this.resuming||i.low} @click=${()=>this.resume()}>${this.resuming?s("ממשיך…"):s("המשך ייצואים מושהים")}</sw-button></div>`:l}
        </div>
      </div>
      ${a.ingest_queue.dropped||a.ingest_queue.coalesced?r`<div class="hint" style="margin-block-start:6px">${s("תור קליטת ההתראות מה־NVR: {merged} אוחדו לרצף אחד · {dropped} נזרקו כשהמסד היה איטי (שיא {peak} מתוך {max})",{merged:a.ingest_queue.coalesced,dropped:a.ingest_queue.dropped,peak:a.ingest_queue.high_water,max:a.ingest_queue.max})}</div>`:l}
      ${a.portal_start?.dropped?r`<div class="hint" style="margin-block-start:6px" data-local-portal-dropped>${s("בקשות קוד בפורטל הספקים: {dropped} נזרקו כשהתור היה מלא (מתוך {total})",{dropped:a.portal_start.dropped,total:a.portal_start.accepted+a.portal_start.dropped})}</div>`:l}
    </sw-card>`}async load(a=!1){this.loading=!0,this.error="";try{const[i,t]=await Promise.all([z(),D(a)]);this.tz=i["time.zone"]??this.tz,this.data=t}catch(i){this.error=w(i)}finally{this.loading=!1}}fmt(a){return a?E(new Date(a),{timeZone:this.tz}):"—"}async loadSigning(){try{this.signing=await V(),this.signingError=""}catch(a){this.signingError=w(a)}}async rotateKey(){this.signingBusy=!0;try{this.signing=await A(),this.rotateConfirm=!1}catch(a){this.signingError=w(a)}finally{this.signingBusy=!1}}renderLocal(a){const i=a.local;if(!i)return l;const t=C;return r`<sw-card heading=${s("אחסון התוסף (/data)")} subheading=${s("נמדד בכל טעינה · הקבצים שהמערכת שומרת אצלה, לא ב־NVR")} data-storage-local>
      <div class="kv">
        <div><span>${s("פנוי")}</span><strong>${f(s("{free} מתוך {total}",{free:t(i.free_bytes),total:t(i.total_bytes)}))}</strong></div>
        <div><span>${s("ייצוא קטעים")}</span><strong>${t(i.exports_bytes)}</strong></div>
        <div><span>${s("תיקים (תמונות וחבילות)")}</span><strong>${t(i.cases_bytes)}</strong></div>
        <div><span>${s("ראיות מיובאות")}</span><strong data-storage-imported data-bytes=${String(i.imported.bytes)}>${t(i.imported.bytes)} · ${s("{n} תיקים מיובאים",{n:i.imported.cases})}</strong></div>
      </div>
      <div class="note" style="margin-block-start:6px">${s("קבצי ראיות מיובאות נשמרים לכל תיק מיובא בנפרד ונמחקים יחד עם התיק.")}</div>
    </sw-card>`}renderSigning(){const a=this.signing,i=t=>t?t.replace("T"," ").replace("Z"," UTC"):"—";return r`<sw-card heading=${s("חתימת ראיות")} subheading=${s("כל חבילת ראיות חתומה ב־Ed25519 במפתח הפעיל של המתקן; החלק הפרטי נשאר ב־/data/keys ואינו נכלל בגיבוי")} data-signing>
      ${this.signingError?r`<div class="note">${this.signingError}</div>`:l}
      ${a?r`<div class="kv">
              <div><span>${s("מפתח פעיל")}</span><strong class="ltr" data-signing-active>${a.active??"—"}</strong></div>
              <div><span>${s("נוצר")}</span><strong>${i(a.keys.find(t=>t.kid===a.active)?.created_at??null)}</strong></div>
              <div><span>${s("מפתחות שהוחלפו")}</span><strong>${a.keys.filter(t=>t.retired_at).length}</strong></div>
              <div><span>${s("מפתח ציבורי (base64)")}</span><strong class="ltr" style="word-break:break-all;font-size:var(--sw-fs-xs)">${a.keys.find(t=>t.kid===a.active)?.public_key??"—"}</strong></div>
            </div>
            ${a.keys.filter(t=>t.retired_at).length?r`<div class="note">${s("מפתחות שהוחלפו נשמרים לאימות חבילות ישנות:")} ${a.keys.filter(t=>t.retired_at).map(t=>`${t.kid} (${s("עד {time}",{time:i(t.retired_at)})})`).join(", ")}</div>`:l}
            <div class="note" style="margin-block-start:6px">${a.trust} ${s("אימות מחוץ למערכת:")} <span class="ltr">scripts/verify_bundle.py bundle.zip --keyring keyring.json</span></div>
            ${a.can_rotate?this.rotateConfirm?r`<div class="note" style="margin-block-start:6px">${s("החלפת מפתח: חבילות חדשות ייחתמו במפתח חדש; הישן נשאר בטבעת לאימות. הפעולה נרשמת באודיט.")} <sw-button size="sm" variant="danger" data-signing-rotate-confirm ?disabled=${this.signingBusy} @click=${()=>this.rotateKey()}>${s("החלף עכשיו")}</sw-button> <sw-button size="sm" variant="ghost" @click=${()=>this.rotateConfirm=!1}>${s("ביטול")}</sw-button></div>`:r`<div style="margin-block-start:8px"><sw-button size="sm" icon="refresh" data-signing-rotate @click=${()=>this.rotateConfirm=!0}>${s("החלפת מפתח חתימה")}</sw-button></div>`:l}`:r`<div class="note">${s("טוען…")}</div>`}
    </sw-card>`}renderNvrLess(){const a=this.data;return r`<sw-page crumbs=${s("הגדרות")} heading=${s("אחסון")} subheading=${s("האחסון המקומי של ה־Add-on (/data) · מצב ללא NVR")}>
      <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${()=>{this.load(!0),this.loadLocal()}}>${this.loading?s("בודק…"):s("רענון")}</sw-button>
      ${this.error?r`<div class="err">${this.error}</div>`:l}
      ${this.renderDiskGuard()}
      ${a?this.renderLocal(a):l}
      <sw-state-panel icon="storage" data-storage-nvr-less state="empty" heading=${s("מצב ללא NVR")} hint=${s("ההתקנה פועלת ללא NVR: אין הקלטות, דיסקים או תוכנית הקלטה לקרוא.")}></sw-state-panel>
    </sw-page>`}renderApi(){if(L())return this.renderNvrLess();if(this.error&&!this.data)return r`<sw-page crumbs=${s("הגדרות")} heading=${s("אחסון ותוכנית הקלטה")}><sw-state-panel state="error" hint=${this.error} actionLabel=${s("נסה שוב")} @action=${()=>this.load()}></sw-state-panel>${this.renderDiskGuard()}</sw-page>`;const a=this.data;if(!a)return r`<sw-page crumbs=${s("הגדרות")} heading=${s("אחסון ותוכנית הקלטה")}>${this.renderDiskGuard()}<sw-state-panel state="loading"></sw-state-panel></sw-page>`;const i=a.totals,t=a.retention,n=16,o=2*Math.PI*n,m=i?.used_pct??0,$=t.measured_days_min==null?"—":t.measured_days_min===t.measured_days_max?`${t.measured_days_min}`:`${t.measured_days_min}–${t.measured_days_max}`;return r`
      <sw-page crumbs=${s("הגדרות")} heading=${s("אחסון ותוכנית הקלטה")} subheading=${s("קריאה בלבד מה־NVR · נמדד לעומת אומדן, עם הסיבה לכל מספר · אין format, RAID או מחיקה מכאן")}>
        <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${()=>{this.load(!0),this.loadLocal()}}>${this.loading?s("שואל את ה־NVR…"):s("רענון מול ה־NVR")}</sw-button>
        ${this.error?r`<div class="err">${this.error}</div>`:l}
        ${this.renderDiskGuard()}
        ${this.renderLocal(a)}
        ${a.nvr.configured?a.nvr.reachable?r`
                <div class="kpis" data-storage-kpis>
                  <sw-card flush class="kpi"><div><div class="v">${v(i?.used_mb)}</div><div class="l">${s("בשימוש (נמדד מה־NVR)")}</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${v(i?.capacity_mb)}</div><div class="l">${s("קיבולת")} · ${s("{n} דיסקים",{n:i?.disks??0})}${i?.nas?` · ${i.nas} NAS`:""} · ${s("מצב {mode}",{mode:a.work_mode??"?"})}</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${i?.used_pct==null?"—":`${i.used_pct}%`}</div><div class="l">${s("ניצולת")} · ${s("פנוי {n}",{n:v(i?.free_mb)})}</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${u`<circle cx="20" cy="20" r=${n} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${n} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${o*m/100} ${o}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
                </div>
                <sw-card heading=${s("שמירת הקלטות (retention)")} subheading=${s("שני מספרים שונים בכוונה: מה שנמדד מול מה שמוערך")} data-storage-retention>
                  <div class="ret">
                    <div><div class="v">${$}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ${s("ימים")}</span></div><div class="l"><strong>${s("נמדד")}</strong> · ${t.measured_reason}</div></div>
                    <div><div class="v">${t.estimated_days==null?"—":`≈ ${t.estimated_days}`}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ${s("ימים")}</span></div><div class="l"><strong>${s("אומדן")}</strong> · ${t.estimated_reason}</div></div>
                  </div>
                </sw-card>
                <div class="grid">
                  <sw-card heading=${s("תוכנית הקלטה לפי מצלמה")} subheading=${a.schedule_error??s("נקרא מ־ISAPI record/tracks · pre/post בשניות · ההקלטה המוקדמת ביותר שנמצאה")}>
                    <div class="tbl cams" data-storage-cameras>
                      <div class="r h"><span>${s("מצלמה")}</span><span>${s("מצב הקלטה")}</span><span>pre / post</span><span>${s("זרם")}</span><span>${s("הקלטה מוקדמת ביותר")}</span><span class="num">${s("ימים")}</span></div>
                      ${a.cameras.map(e=>r`<div class="r" data-storage-camera><span>${e.name}<small>${s("ערוץ")} ${e.channel}${e.track_id?` · track ${e.track_id}`:""}</small></span><span>${e.summary}${e.expiry&&e.expiry!=="P0DT0H"?r`<small>${s("תפוגה {value}",{value:e.expiry})}</small>`:l}</span><span class="num">${e.pre_s??"—"} / ${e.post_s??"—"}</span><span class="num">${e.bitrate_kbps?`${e.bitrate_kbps} kbps`:"—"}${e.resolution?r`<small class="num">${e.resolution}${e.fps?` · ${e.fps} fps`:""}</small>`:l}</span><span>${this.fmt(e.oldest_recording_at)}<small>${e.retention_reason}</small></span><span class="num">${e.retention_days??"—"}</span></div>`)}
                    </div>
                  </sw-card>
                  <div>
                    <sw-card heading=${s("דיסקים")} subheading=${s("{ok} מתוך {total} תקינים",{ok:i?.disks_ok??0,total:(i?.disks??0)+(i?.nas??0)})}>
                      <div class="tbl disks" data-storage-disks>
                        <div class="r h"><span>${s("שם")}</span><span>${s("סוג")}</span><span>${s("מצב")}</span><span class="num">${s("קיבולת")}</span><span class="num">${s("פנוי")}</span><span>${s("גישה")}</span></div>
                        ${[...a.disks,...a.nas].map(e=>r`<div class="r" data-storage-disk><span>${e.name}${e.path?r`<small>${e.path}</small>`:l}</span><span>${e.kind}</span><span><sw-badge kind=${e.status==="ok"?"recorded":"error"} label=${e.status}></sw-badge></span><span class="num">${v(e.capacity_mb)}</span><span class="num">${v(e.free_mb)}</span><span>${e.property}</span></div>`)}
                      </div>
                    </sw-card>
                    ${this.renderSigning()}
                    <sw-card heading=${s("מה המערכת לא עושה ב־NVR")} subheading=${s("גבולות הפיילוט")} data-storage-limits>
                      <ul class="limits">${a.limits.notes.map(e=>r`<li>${e}</li>`)}</ul>
                      <div style="margin-block-start:6px"><sw-button size="sm" disabled icon="edit">${s("עריכת מדיניות הקלטה (לא בפיילוט)")}</sw-button></div>
                    </sw-card>
                  </div>
                </div>
                <div class="hint">${s("נקרא {time}",{time:this.fmt(a.generated_at)})}${a.cached?` · ${s("מהמטמון (עד 10 דקות)")}`:` · ${s("עכשיו")}`} · ${s("חיפוש ההקלטה המוקדמת: {n} ימים אחורה, שאילתה אחת לכל מצלמה.",{n:t.lookback_days})}</div>
              `:r`<sw-state-panel state="error" heading=${s("אין תשובה מה־NVR")} hint=${a.nvr.error??""} actionLabel=${s("נסה שוב")} @action=${()=>this.load(!0)}></sw-state-panel>
                ${this.renderSigning()}`:r`<sw-state-panel icon="storage" state="empty" heading=${s("ה־NVR לא מוגדר")} hint=${s("הגדר את פרטי ה־NVR בהגדרות התוסף; המסך קורא ממנו בלבד.")}></sw-state-panel>`}
      </sw-page>
    `}render(){if(y())return this.renderApi();const a=[.3,.36,.45,.5,.58,.63,.7],i=600,t=200,n=d=>d/(a.length-1)*420,o=d=>170-d*150,m=a.map((d,h)=>`${h===0?"M":"L"}${n(h)} ${o(d)}`).join(" "),$=`M${n(a.length-1)} ${o(.7)} L520 ${o(.86)} L${i} ${o(1)}`,e=16,b=2*Math.PI*e,x=410;return r`
      <sw-page crumbs=${s("הגדרות")} heading=${s("אנליטיקת אחסון")} subheading=${s("Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה")}>
        <div slot="actions" style="display:flex;gap:4px">${["7D","30D","90D","1Y"].map(d=>r`<sw-chip ?selected=${this.range===d} @click=${()=>this.range=d}>${d}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">${s("אחסון בשימוש (נמדד)")}</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">${s("קיבולת כוללת")}</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">${s("ניצולת")} · ${s("≈ {n} ימים נשמרים",{n:11})}</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${u`<circle cx="20" cy="20" r=${e} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${e} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${b*.68} ${b}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading=${s("תחזית שימוש באחסון")} subheading=${s("עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)")}>
          <svg class="trend" viewBox="0 0 ${i} ${t}" preserveAspectRatio="none" role="img" aria-label=${s("תחזית אחסון")}>
            ${u`
              ${[.25,.5,.75,1].map(d=>u`<line x1="0" x2=${i} y1=${o(d)} y2=${o(d)} stroke="var(--sw-border)" />`)}
              <path d="${m} L${n(a.length-1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${m}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${$}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${n(a.length-1)} x2=${n(a.length-1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="var(--sw-surface)" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${s("אומדן מילוי")}</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${[s("ינו"),s("פבר"),s("מרץ"),s("אפר"),s("מאי"),s("יונ"),s("יול")].map((d,h)=>u`<text x=${n(h)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${d}</text>`)}
              ${["0.5 TB","1 TB","1.5 TB","1.9 TB"].map((d,h)=>u`<text x="4" y=${o(.25*(h+1))-3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${d}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading=${s("שימוש באחסון לפי מצלמה")} subheading=${s("נמדד · לפני retention")}>
            ${M.map(d=>r`<div class="cam"><span>${d.name}</span><span class="bar"><i style="--p:${d.gb/x*100}%"></i></span><span class="gb ltr">${d.gb} GB</span></div>`)}
            <div class="hint" style="margin-block-start:6px">${s("מחיקת הקלטות לפי retention מבטלת cache בהתאם.")}</div>
          </sw-card>
          <sw-card heading=${s("מדיניות הקלטה")} subheading=${s("קריאה מה־NVR")}>
            <div class="policy"><span class="ic"><sw-icon name="history" size=${14}></sw-icon></span><span>${s("רציפה")}<small>${s("{n} מצלמות",{n:5})}</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="activity" size=${14}></sw-icon></span><span>${s("לפי תנועה")}<small>${s("{n} מצלמות",{n:4})}</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="calendar" size=${14}></sw-icon></span><span>${s("מתוזמנת")}<small>${s("{n} מצלמות",{n:0})}</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="bell" size=${14}></sw-icon></span><span>${s("לפי אירוע")}<small>${s("{n} מצלמה",{n:1})} · pre/post 5s / 10s</small></span></div>
            <div style="margin-block-start:10px"><sw-button size="sm" disabled icon="edit">${s("עריכת מדיניות (לא בפיילוט)")}</sw-button></div>
          </sw-card>
        </div>
      </sw-page>
    `}};c.styles=[q,R`
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    /* R5-SYSTEM-297: the three counters are the hero row - a 32/800 figure in the heading ink, a 13 px label in the secondary ink; the
       icon square steps back (28 px, quiet) so the number is the object (taste §5) */
    .kpi {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
    }
    .kpi .v {
      font-size: var(--sw-fs-4xl);
      font-weight: var(--sw-fw-bold);
      letter-spacing: -0.03em;
      line-height: 1.05;
      color: var(--sw-heading, var(--sw-text));
      font-variant-numeric: tabular-nums;
    }
    .kpi .l {
      margin-block-start: 4px;
      font-size: var(--sw-fs-base);
      color: var(--sw-text-2);
    }
    .kpi .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      margin-inline-start: auto;
    }
    .kpi svg {
      inline-size: 40px;
      block-size: 40px;
      margin-inline-start: auto;
    }
    .trend {
      inline-size: 100%;
      block-size: 200px;
      direction: ltr;
      display: block;
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, 1fr);
      gap: 12px;
      align-items: start;
    }
    .cam {
      display: grid;
      grid-template-columns: 110px minmax(0, 1fr) 64px;
      align-items: center;
      gap: 10px;
      padding: 7px 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-heading, var(--sw-text));
    }
    .cam .bar {
      block-size: 8px;
      border-radius: var(--sw-r-2xs);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .cam .bar i {
      display: block;
      block-size: 100%;
      inline-size: var(--p);
      background: var(--sw-accent);
      border-radius: var(--sw-r-2xs);
    }
    .cam .gb {
      text-align: end;
      font-variant-numeric: tabular-nums;
      color: var(--sw-heading, var(--sw-text));
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
    }
    .policy {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .policy:last-child {
      border-block-end: 0;
    }
    .policy .ic {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
    }
    .policy small {
      display: block;
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-regular);
      font-size: var(--sw-fs-sm);
    }
    .hint {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .tbl {
      display: flex;
      flex-direction: column;
    }
    .tbl .r {
      display: grid;
      gap: 8px;
      align-items: center;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
    }
    .tbl .r:last-child {
      border-block-end: 0;
    }
    .tbl .h {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      border-block-end: 1px solid var(--sw-border-strong);
    }
    .tbl.disks .r {
      grid-template-columns: minmax(0, 1.2fr) 70px 90px 90px 90px 50px;
    }
    .tbl.cams .r {
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.6fr) 90px 130px 150px 80px;
    }
    .tbl small {
      display: block;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .num {
      font-variant-numeric: tabular-nums;
      direction: ltr;
      unicode-bidi: isolate;
      text-align: end;
    }
    .ret {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .ret .v {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .ret .l {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
    }
    .limits li {
      font-size: var(--sw-fs-sm);
      margin-block-end: 4px;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .tbl.disks .r,
      .tbl.cams .r {
        grid-template-columns: 1fr 1fr;
      }
      .tbl .h {
        display: none;
      }
      .ret {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 1023px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    @media (max-width: 767px) {
      .kpis {
        grid-template-columns: 1fr;
      }
    }
  `,T];p([g()],c.prototype,"range",2);p([g()],c.prototype,"data",2);p([g()],c.prototype,"error",2);p([g()],c.prototype,"loading",2);p([g()],c.prototype,"tz",2);p([g()],c.prototype,"local",2);p([g()],c.prototype,"localError",2);p([g()],c.prototype,"resuming",2);p([g()],c.prototype,"signing",2);p([g()],c.prototype,"signingError",2);p([g()],c.prototype,"signingBusy",2);p([g()],c.prototype,"rotateConfirm",2);c=p([S("system-storage")],c);export{c as SystemStorage};
