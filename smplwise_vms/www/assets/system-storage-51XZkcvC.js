import{a as x,S as k,i as b,R as w,A as l,e,q as f,J as _,b5 as z,dP as E,w as u,qJ as R,C as S,E as L,G as p,H as B}from"./index-Bd8RPmTw.js";import"./sw-chip-C1wGHoKB.js";import{a as N,r as D,f as g,g as C}from"./storage-BYOtsDbh.js";import{q as V,s as q}from"./cases-DOaDoyU2.js";import{f as A}from"./exports-BRkvvxEx.js";import"./sw-logo-art-Va6y_cIM.js";var T=Object.defineProperty,P=Object.getOwnPropertyDescriptor,c=(s,t,a,r)=>{for(var d=r>1?void 0:r?P(t,a):t,v=s.length-1,m;v>=0;v--)(m=s[v])&&(d=(r?m(t,a,d):m(d))||d);return r&&d&&T(t,a,d),d};const G=[{name:"כניסה ראשית",gb:320},{name:"אולם",gb:410},{name:"חצר אחורית",gb:380},{name:"לובי",gb:180},{name:"מחסן",gb:96}];let o=class extends x{constructor(){super(...arguments),this.bubbleSkin=new k(this),this.range="30D",this.data=null,this.error="",this.loading=!1,this.tz="Asia/Jerusalem",this.local=null,this.localError="",this.resuming=!1,this.signing=null,this.signingError="",this.signingBusy=!1,this.rotateConfirm=!1}connectedCallback(){super.connectedCallback(),b()&&(this.load(),this.loadSigning(),this.loadLocal())}async loadLocal(){try{this.local=await N(),this.localError=""}catch(s){this.localError=w(s)}}async resume(){this.resuming=!0;try{this.local=await D(),this.localError=""}catch(s){this.localError=w(s),this.loadLocal()}finally{this.resuming=!1}}renderDiskGuard(){const s=this.local;if(!s)return this.localError?e`<div class="err">${this.localError}</div>`:l;const t=s.data_disk,a=s.exports.paused_disk_full,r=s.exports.counters;return e`<sw-card heading="הדיסק של התוסף" subheading=${`ייצואים, תמונות אירועים וגיבויים נשמרים כאן · ייצוא חדש נדחה מתחת ל־${g(t.min_free_mb)} פנויים, וייצוא שרץ מושהה עד שיתפנה מקום`} data-storage-disk-guard>
      ${this.localError?e`<div class="err">${this.localError}</div>`:l}
      <div class="ret">
        <div><div class="v" data-local-free>${f(g(t.free_mb))}</div><div class="l">${f(`פנויים מתוך ${g(t.total_mb)} · מינימום ${g(t.min_free_mb)}`)}</div></div>
        <div>
          <div><sw-badge kind=${t.low?"error":a?"stale":"recorded"} label=${t.low?"מתחת למינימום · ייצוא חדש נדחה":a?`${a} ייצואים מושהים`:"תקין"} data-local-state></sw-badge></div>
          <div class="l">בתור ${s.exports.waiting} מתוך ${s.exports.max_waiting} · נדחו בגלל מקום ${r.refused_disk} · הושהו ${r.paused_disk_full} · חודשו ${r.resumed}${r.refused_queue_full?` · נדחו בתור מלא ${r.refused_queue_full}`:""}</div>
          ${a?e`<div style="margin-block-start:6px"><sw-button size="sm" icon="refresh" data-local-resume ?disabled=${this.resuming||t.low} @click=${()=>this.resume()}>${this.resuming?"ממשיך…":"המשך ייצואים מושהים"}</sw-button></div>`:l}
        </div>
      </div>
      ${s.ingest_queue.dropped||s.ingest_queue.coalesced?e`<div class="hint" style="margin-block-start:6px">תור קליטת ההתראות מה־NVR: ${s.ingest_queue.coalesced} אוחדו לרצף אחד · ${s.ingest_queue.dropped} נזרקו כשהמסד היה איטי (שיא ${s.ingest_queue.high_water} מתוך ${s.ingest_queue.max})</div>`:l}
      ${s.portal_start?.dropped?e`<div class="hint" style="margin-block-start:6px" data-local-portal-dropped>בקשות קוד בפורטל הספקים: ${s.portal_start.dropped} נזרקו כשהתור היה מלא (מתוך ${s.portal_start.accepted+s.portal_start.dropped})</div>`:l}
    </sw-card>`}async load(s=!1){this.loading=!0,this.error="";try{const[t,a]=await Promise.all([_(),C(s)]);this.tz=t["time.zone"]??this.tz,this.data=a}catch(t){this.error=w(t)}finally{this.loading=!1}}fmt(s){return s?z(new Date(s),{timeZone:this.tz}):"—"}async loadSigning(){try{this.signing=await V(),this.signingError=""}catch(s){this.signingError=w(s)}}async rotateKey(){this.signingBusy=!0;try{this.signing=await q(),this.rotateConfirm=!1}catch(s){this.signingError=w(s)}finally{this.signingBusy=!1}}renderLocal(s){const t=s.local;if(!t)return l;const a=A;return e`<sw-card heading="אחסון התוסף (/data)" subheading="נמדד בכל טעינה · הקבצים שהמערכת שומרת אצלה, לא ב־NVR" data-storage-local>
      <div class="kv">
        <div><span>פנוי</span><strong>${f(`${a(t.free_bytes)} מתוך ${a(t.total_bytes)}`)}</strong></div>
        <div><span>ייצוא קטעים</span><strong>${a(t.exports_bytes)}</strong></div>
        <div><span>תיקים (תמונות וחבילות)</span><strong>${a(t.cases_bytes)}</strong></div>
        <div><span>ראיות מיובאות</span><strong data-storage-imported data-bytes=${String(t.imported.bytes)}>${a(t.imported.bytes)} · ${t.imported.cases} תיקים מיובאים</strong></div>
      </div>
      <div class="note" style="margin-block-start:6px">קבצי ראיות מיובאות נשמרים לכל תיק מיובא בנפרד ונמחקים יחד עם התיק.</div>
    </sw-card>`}renderSigning(){const s=this.signing,t=a=>a?a.replace("T"," ").replace("Z"," UTC"):"—";return e`<sw-card heading="חתימת ראיות" subheading="כל חבילת ראיות חתומה ב־Ed25519 במפתח הפעיל של המתקן; החלק הפרטי נשאר ב־/data/keys ואינו נכלל בגיבוי" data-signing>
      ${this.signingError?e`<div class="note">${this.signingError}</div>`:l}
      ${s?e`<div class="kv">
              <div><span>מפתח פעיל</span><strong class="ltr" data-signing-active>${s.active??"—"}</strong></div>
              <div><span>נוצר</span><strong>${t(s.keys.find(a=>a.kid===s.active)?.created_at??null)}</strong></div>
              <div><span>מפתחות שהוחלפו</span><strong>${s.keys.filter(a=>a.retired_at).length}</strong></div>
              <div><span>מפתח ציבורי (base64)</span><strong class="ltr" style="word-break:break-all;font-size:var(--sw-fs-xs)">${s.keys.find(a=>a.kid===s.active)?.public_key??"—"}</strong></div>
            </div>
            ${s.keys.filter(a=>a.retired_at).length?e`<div class="note">מפתחות שהוחלפו נשמרים לאימות חבילות ישנות: ${s.keys.filter(a=>a.retired_at).map(a=>`${a.kid} (עד ${t(a.retired_at)})`).join(", ")}</div>`:l}
            <div class="note" style="margin-block-start:6px">${s.trust} אימות מחוץ למערכת: <span class="ltr">scripts/verify_bundle.py bundle.zip --keyring keyring.json</span></div>
            ${s.can_rotate?this.rotateConfirm?e`<div class="note" style="margin-block-start:6px">החלפת מפתח: חבילות חדשות ייחתמו במפתח חדש; הישן נשאר בטבעת לאימות. הפעולה נרשמת באודיט. <sw-button size="sm" variant="danger" data-signing-rotate-confirm ?disabled=${this.signingBusy} @click=${()=>this.rotateKey()}>החלף עכשיו</sw-button> <sw-button size="sm" variant="ghost" @click=${()=>this.rotateConfirm=!1}>ביטול</sw-button></div>`:e`<div style="margin-block-start:8px"><sw-button size="sm" icon="refresh" data-signing-rotate @click=${()=>this.rotateConfirm=!0}>החלפת מפתח חתימה</sw-button></div>`:l}`:e`<div class="note">טוען…</div>`}
    </sw-card>`}renderNvrLess(){const s=this.data;return e`<sw-page crumbs="הגדרות" heading="אחסון" subheading="האחסון המקומי של ה־Add-on (/data) · מצב ללא NVR">
      <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${()=>{this.load(!0),this.loadLocal()}}>${this.loading?"בודק…":"רענון"}</sw-button>
      ${this.error?e`<div class="err">${this.error}</div>`:l}
      ${this.renderDiskGuard()}
      ${s?this.renderLocal(s):l}
      <sw-state-panel icon="storage" data-storage-nvr-less state="empty" heading="מצב ללא NVR" hint="ההתקנה פועלת ללא NVR: אין הקלטות, דיסקים או תוכנית הקלטה לקרוא."></sw-state-panel>
    </sw-page>`}renderApi(){if(E())return this.renderNvrLess();if(this.error&&!this.data)return e`<sw-page crumbs="הגדרות" heading="אחסון ותוכנית הקלטה"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>this.load()}></sw-state-panel>${this.renderDiskGuard()}</sw-page>`;const s=this.data;if(!s)return e`<sw-page crumbs="הגדרות" heading="אחסון ותוכנית הקלטה">${this.renderDiskGuard()}<sw-state-panel state="loading"></sw-state-panel></sw-page>`;const t=s.totals,a=s.retention,r=16,d=2*Math.PI*r,v=t?.used_pct??0,m=a.measured_days_min==null?"—":a.measured_days_min===a.measured_days_max?`${a.measured_days_min}`:`${a.measured_days_min}–${a.measured_days_max}`;return e`
      <sw-page crumbs="הגדרות" heading="אחסון ותוכנית הקלטה" subheading="קריאה בלבד מה־NVR · נמדד לעומת אומדן, עם הסיבה לכל מספר · אין format, RAID או מחיקה מכאן">
        <sw-button slot="actions" icon="refresh" data-storage-refresh ?disabled=${this.loading} @click=${()=>{this.load(!0),this.loadLocal()}}>${this.loading?"שואל את ה־NVR…":"רענון מול ה־NVR"}</sw-button>
        ${this.error?e`<div class="err">${this.error}</div>`:l}
        ${this.renderDiskGuard()}
        ${this.renderLocal(s)}
        ${s.nvr.configured?s.nvr.reachable?e`
                <div class="kpis" data-storage-kpis>
                  <sw-card flush class="kpi"><div><div class="v">${g(t?.used_mb)}</div><div class="l">בשימוש (נמדד מה־NVR)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${g(t?.capacity_mb)}</div><div class="l">קיבולת · ${t?.disks??0} דיסקים${t?.nas?` · ${t.nas} NAS`:""} · מצב ${s.work_mode??"?"}</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
                  <sw-card flush class="kpi"><div><div class="v">${t?.used_pct==null?"—":`${t.used_pct}%`}</div><div class="l">ניצולת · פנוי ${g(t?.free_mb)}</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${u`<circle cx="20" cy="20" r=${r} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${r} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${d*v/100} ${d}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
                </div>
                <sw-card heading="שמירת הקלטות (retention)" subheading="שני מספרים שונים בכוונה: מה שנמדד מול מה שמוערך" data-storage-retention>
                  <div class="ret">
                    <div><div class="v">${m}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>נמדד</strong> · ${a.measured_reason}</div></div>
                    <div><div class="v">${a.estimated_days==null?"—":`≈ ${a.estimated_days}`}<span style="font-size:var(--sw-fs-sm);font-weight:400"> ימים</span></div><div class="l"><strong>אומדן</strong> · ${a.estimated_reason}</div></div>
                  </div>
                </sw-card>
                <div class="grid">
                  <sw-card heading="תוכנית הקלטה לפי מצלמה" subheading=${s.schedule_error??"נקרא מ־ISAPI record/tracks · pre/post בשניות · ההקלטה המוקדמת ביותר שנמצאה"}>
                    <div class="tbl cams" data-storage-cameras>
                      <div class="r h"><span>מצלמה</span><span>מצב הקלטה</span><span>pre / post</span><span>זרם</span><span>הקלטה מוקדמת ביותר</span><span class="num">ימים</span></div>
                      ${s.cameras.map(i=>e`<div class="r" data-storage-camera><span>${i.name}<small>ערוץ ${i.channel}${i.track_id?` · track ${i.track_id}`:""}</small></span><span>${i.summary}${i.expiry&&i.expiry!=="P0DT0H"?e`<small>תפוגה ${i.expiry}</small>`:l}</span><span class="num">${i.pre_s??"—"} / ${i.post_s??"—"}</span><span class="num">${i.bitrate_kbps?`${i.bitrate_kbps} kbps`:"—"}${i.resolution?e`<small class="num">${i.resolution}${i.fps?` · ${i.fps} fps`:""}</small>`:l}</span><span>${this.fmt(i.oldest_recording_at)}<small>${i.retention_reason}</small></span><span class="num">${i.retention_days??"—"}</span></div>`)}
                    </div>
                  </sw-card>
                  <div>
                    <sw-card heading="דיסקים" subheading=${`${t?.disks_ok??0} מתוך ${(t?.disks??0)+(t?.nas??0)} תקינים`}>
                      <div class="tbl disks" data-storage-disks>
                        <div class="r h"><span>שם</span><span>סוג</span><span>מצב</span><span class="num">קיבולת</span><span class="num">פנוי</span><span>גישה</span></div>
                        ${[...s.disks,...s.nas].map(i=>e`<div class="r" data-storage-disk><span>${i.name}${i.path?e`<small>${i.path}</small>`:l}</span><span>${i.kind}</span><span><sw-badge kind=${i.status==="ok"?"recorded":"error"} label=${i.status}></sw-badge></span><span class="num">${g(i.capacity_mb)}</span><span class="num">${g(i.free_mb)}</span><span>${i.property}</span></div>`)}
                      </div>
                    </sw-card>
                    ${this.renderSigning()}
                    <sw-card heading="מה המערכת לא עושה ב־NVR" subheading="גבולות הפיילוט" data-storage-limits>
                      <ul class="limits">${s.limits.notes.map(i=>e`<li>${i}</li>`)}</ul>
                      <div style="margin-block-start:6px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות הקלטה (לא בפיילוט)</sw-button></div>
                    </sw-card>
                  </div>
                </div>
                <div class="hint">נקרא ${this.fmt(s.generated_at)}${s.cached?" · מהמטמון (עד 10 דקות)":" · עכשיו"} · חיפוש ההקלטה המוקדמת: ${a.lookback_days} ימים אחורה, שאילתה אחת לכל מצלמה.</div>
              `:e`<sw-state-panel state="error" heading="אין תשובה מה־NVR" hint=${s.nvr.error??""} actionLabel="נסה שוב" @action=${()=>this.load(!0)}></sw-state-panel>
                ${this.renderSigning()}`:e`<sw-state-panel icon="storage" state="empty" heading="ה־NVR לא מוגדר" hint="הגדר את פרטי ה־NVR בהגדרות התוסף; המסך קורא ממנו בלבד."></sw-state-panel>`}
      </sw-page>
    `}render(){if(b())return this.renderApi();const s=[.3,.36,.45,.5,.58,.63,.7],t=600,a=200,r=n=>n/(s.length-1)*420,d=n=>170-n*150,v=s.map((n,h)=>`${h===0?"M":"L"}${r(h)} ${d(n)}`).join(" "),m=`M${r(s.length-1)} ${d(.7)} L520 ${d(.86)} L${t} ${d(1)}`,i=16,$=2*Math.PI*i,y=410;return e`
      <sw-page crumbs="הגדרות" heading="אנליטיקת אחסון" subheading="Beta · ניטור שימוש, תכנון קדימה ושליטה · נתון נמדד לעומת אומדן מסומן · אין format או RAID · נתוני הדגמה">
        <div slot="actions" style="display:flex;gap:4px">${["7D","30D","90D","1Y"].map(n=>e`<sw-chip ?selected=${this.range===n} @click=${()=>this.range=n}>${n}</sw-chip>`)}</div>
        <div class="kpis">
          <sw-card flush class="kpi"><div><div class="v">1.3 TB</div><div class="l">אחסון בשימוש (נמדד)</div></div><div class="ic"><sw-icon name="storage" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">1.9 TB</div><div class="l">קיבולת כוללת</div></div><div class="ic"><sw-icon name="cpu" size=${16}></sw-icon></div></sw-card>
          <sw-card flush class="kpi"><div><div class="v">68%</div><div class="l">ניצולת · ≈ 11 ימים נשמרים</div></div><svg viewBox="0 0 40 40" aria-hidden="true">${u`<circle cx="20" cy="20" r=${i} fill="none" stroke="var(--sw-surface-3)" stroke-width="6" /><circle cx="20" cy="20" r=${i} fill="none" stroke="var(--sw-accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray=${`${$*.68} ${$}`} transform="rotate(-90 20 20)" />`}</svg></sw-card>
        </div>
        <sw-card heading="תחזית שימוש באחסון" subheading="עד הקו: נתון נמדד · אחרי הקו: אומדן (אינו תחזית פשוטה של דיסק מתמלא)">
          <svg class="trend" viewBox="0 0 ${t} ${a}" preserveAspectRatio="none" role="img" aria-label="תחזית אחסון">
            ${u`
              ${[.25,.5,.75,1].map(n=>u`<line x1="0" x2=${t} y1=${d(n)} y2=${d(n)} stroke="var(--sw-border)" />`)}
              <path d="${v} L${r(s.length-1)} 170 L0 170 Z" fill="var(--sw-accent-soft)" />
              <path d="${v}" fill="none" stroke="var(--sw-accent)" stroke-width="2.5" />
              <path d="${m}" fill="none" stroke="var(--sw-accent)" stroke-width="2" stroke-dasharray="5 5" opacity="0.7" />
              <line x1=${r(s.length-1)} x2=${r(s.length-1)} y1="10" y2="170" stroke="var(--sw-stale)" stroke-dasharray="4 4" />
              <rect x="470" y="18" width="110" height="34" rx="6" fill="var(--sw-surface)" stroke="var(--sw-border)" />
              <text x="525" y="32" font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">אומדן מילוי</text>
              <text x="525" y="46" font-size="11" font-weight="600" text-anchor="middle" fill="var(--sw-text)" font-family="var(--sw-font)">≈ 25.09.2026</text>
              ${["ינו","פבר","מרץ","אפר","מאי","יונ","יול"].map((n,h)=>u`<text x=${r(h)} y="190" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${n}</text>`)}
              ${["0.5 TB","1 TB","1.5 TB","1.9 TB"].map((n,h)=>u`<text x="4" y=${d(.25*(h+1))-3} font-size="9.5" fill="var(--sw-text-3)" font-family="var(--sw-font)">${n}</text>`)}
            `}
          </svg>
        </sw-card>
        <div class="grid">
          <sw-card heading="שימוש באחסון לפי מצלמה" subheading="נמדד · לפני retention">
            ${G.map(n=>e`<div class="cam"><span>${n.name}</span><span class="bar"><i style="--p:${n.gb/y*100}%"></i></span><span class="gb ltr">${n.gb} GB</span></div>`)}
            <div class="hint" style="margin-block-start:6px">מחיקת הקלטות לפי retention מבטלת cache בהתאם.</div>
          </sw-card>
          <sw-card heading="מדיניות הקלטה" subheading="קריאה מה־NVR">
            <div class="policy"><span class="ic"><sw-icon name="history" size=${14}></sw-icon></span><span>רציפה<small>5 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="activity" size=${14}></sw-icon></span><span>לפי תנועה<small>4 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="calendar" size=${14}></sw-icon></span><span>מתוזמנת<small>0 מצלמות</small></span></div>
            <div class="policy"><span class="ic"><sw-icon name="bell" size=${14}></sw-icon></span><span>לפי אירוע<small>1 מצלמה · pre/post 5s / 10s</small></span></div>
            <div style="margin-block-start:10px"><sw-button size="sm" disabled icon="edit">עריכת מדיניות (לא בפיילוט)</sw-button></div>
          </sw-card>
        </div>
      </sw-page>
    `}};o.styles=[R,L`
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
  `,S];c([p()],o.prototype,"range",2);c([p()],o.prototype,"data",2);c([p()],o.prototype,"error",2);c([p()],o.prototype,"loading",2);c([p()],o.prototype,"tz",2);c([p()],o.prototype,"local",2);c([p()],o.prototype,"localError",2);c([p()],o.prototype,"resuming",2);c([p()],o.prototype,"signing",2);c([p()],o.prototype,"signingError",2);c([p()],o.prototype,"signingBusy",2);c([p()],o.prototype,"rotateConfirm",2);o=c([B("system-storage")],o);export{o as SystemStorage};
//# sourceMappingURL=system-storage-51XZkcvC.js.map
