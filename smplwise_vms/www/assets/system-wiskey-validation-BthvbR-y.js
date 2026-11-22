import{i as S,aa as z,a2 as f,a as T,n as m,dE as e,u as v,A as c,b as n,bd as C,gu as K,g as O,j as h,k as P}from"./index-CPuzFb4-.js";import{p as L,a as U}from"./events-print-PznbawFR.js";import{g as w,a as _,r as g,s as A,c as D,f as j,b as k,d as M,e as I,h as b,i as E}from"./wiskey-validation-CWO0chOX.js";import{a as $,U as y}from"./wiskey-format-DNXFjaP2.js";import"./sw-logo-art-PLtEZJxU.js";import"./wiskey-DDOiFIbs.js";var N=Object.defineProperty,V=Object.getOwnPropertyDescriptor,u=(s,t,a,d)=>{for(var i=d>1?void 0:d?V(t,a):t,r=s.length-1,o;r>=0;r--)(o=s[r])&&(i=(d?o(t,a,i):o(i))||i);return d&&i&&N(t,a,i),i};const W=1500,R=e("פעולה פיזית - דלת תיפתח"),x={running:e("בבדיקה"),done:e("הסתיימה"),cancelled:e("בוטלה"),interrupted:e("נקטעה (הפעלה מחדש)")},B={opened:e("הדלת נפתחה"),not_opened:e("הדלת לא נפתחה"),unsure:e("לא בטוח")},Z={feed_state:"ready",stations:[{id:"demo-lobby",name:"לובי ראשי",online:!0,doors:[{door:1,name:"כניסה"}],can_pulse:!1},{id:"demo-garage",name:"חניון",online:!0,doors:[],can_pulse:!1}],checks:[],runs:[],active_run_id:null,rights:{run:!1,pulse:!1,pulse_local:!0}},l=(s,t,a,d,i=null,r=null)=>({check:s,label:t,status:a,status_text:d,reason:i,reason_text:r,detail:{},started_at:null,finished_at:"2026-11-03T10:00:00Z"}),q={id:"lv_demo",kind:"checks",scope:"all",parent_run_id:null,state:"done",created_by:"demo",created_by_name:"הדגמה",created_at:"2026-11-03T09:59:00Z",finished_at:"2026-11-03T10:00:00Z",cancel_requested:!1,station_count:2,counts:{pending:0,running:0,pass:9,fail:2,unsupported:2,not_run:3},progress:{done:16,total:16},pulses:[],stations:[{station_id:"demo-lobby",name:"לובי ראשי",counts:{pending:0,running:0,pass:6,fail:1,unsupported:1,not_run:0},progress:{done:8,total:8},checks:[l("identity","זהות העמדה","pass","עבר"),l("door_capabilities","יכולות הדלת","pass","עבר"),l("door_read","קריאת הגדרות הדלת","pass","עבר"),l("media_arx","תמונה דרך Arx","pass","עבר"),l("media_wiskey","תמונה דרך WisKey","unsupported","לא נתמך ב-WisKey","not_listed","WisKey אינו מפרסם את פקודות המדיה בערוץ השירות."),l("talk","זמינות דיבור","fail","נכשל","provider_local","מקור הווידאו והדיבור מוגדר Arx, ולכן WisKey לא נבדק כאן."),l("events","זרם אירועים","pass","עבר"),l("clock","סטיית שעון","pass","עבר")]},{station_id:"demo-garage",name:"חניון",counts:{pending:0,running:0,pass:3,fail:1,unsupported:1,not_run:3},progress:{done:8,total:8},checks:[l("identity","זהות העמדה","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),l("door_capabilities","יכולות הדלת","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),l("door_read","קריאת הגדרות הדלת","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),l("media_arx","תמונה דרך Arx","pass","עבר"),l("media_wiskey","תמונה דרך WisKey","unsupported","לא נתמך ב-WisKey","not_listed","WisKey אינו מפרסם את פקודות המדיה בערוץ השירות."),l("talk","זמינות דיבור","pass","עבר"),l("events","זרם אירועים","pass","עבר"),l("clock","סטיית שעון","fail","נכשל","skew_over_tolerance","שעון העמדה סוטה מעבר ל-2 שניות.")]}]};let p=class extends S{constructor(){super(...arguments),this.data=null,this.run=null,this.error="",this.forbidden=!1,this.busy=!1,this.note="",this.pulse=null,this.pulseError="",this.focusStation="",this.timer=null}connectedCallback(){super.connectedCallback(),this.focusStation=z().params.get("station")??"",this.load()}disconnectedCallback(){super.disconnectedCallback(),this.stopPolling()}stopPolling(){this.timer!==null&&clearTimeout(this.timer),this.timer=null}async load(){if(!f()){this.data=Z,this.run=q;return}try{const s=await w();this.data=s,this.forbidden=!1,this.error="";const t=s.active_run_id??(this.run&&s.runs.some(a=>a.id===this.run?.id)?this.run.id:s.runs[0]?.id);t?await this.openRun(t):this.run=null}catch(s){s instanceof T&&s.status===403?this.forbidden=!0:this.error=m(s)}}async openRun(s){this.stopPolling();try{this.run=await _(s)}catch(t){this.note=m(t);return}this.run&&!g(this.run)&&(this.timer=setTimeout(()=>void this.poll(),W))}async poll(){if(this.timer=null,!(!this.run||!this.isConnected)){try{const s=await _(this.run.id);if(this.run=s,g(s)){this.data=await w();return}}catch{}this.timer=setTimeout(()=>void this.poll(),W)}}async start(s){if(!(!f()||this.busy)){this.busy=!0,this.note="";try{const{run_id:t}=await A(s);await this.openRun(t),this.data=await w()}catch(t){this.note=m(t)}finally{this.busy=!1}}}async cancel(){if(this.run)try{await D(this.run.id),this.note=e("הבקשה לעצור נשלחה: הבדיקה תיעצר לפני הצעד הבא.")}catch(s){this.note=m(s)}}async exportCsv(){if(!(!this.run||!f()))try{const s=await j(this.run.id),t=URL.createObjectURL(s),a=document.createElement("a");a.href=t,a.download=`arx-station-acceptance-${this.run.id.slice(-8)}.csv`,document.body.append(a),a.click(),a.remove(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){this.note=m(s)}}print(){const s=this.run;if(!s)return;const t=[],a=i=>i.stations.forEach(r=>r.checks.forEach(o=>t.push([r.name||r.station_id,o.label,o.status_text,o.reason_text??"",b(o)])));a(s),s.pulses.forEach(a),L(U({title:e("בדיקת קבלה לעמדות"),subtitle:`${$(s.created_at,v(),y)} (UTC) · ${s.created_by_name??""} · ${x[s.state]??s.state} · ${e("{n} עמדות",{n:s.station_count})}`,columns:[e("עמדה"),e("בדיקה"),e("תוצאה"),e("סיבה"),e("פרטים")],rows:t,footer:`SmplWise Arx · ${e("הודפס {time}",{time:$(new Date().toISOString(),v(),y)})} (UTC) · ${s.id}`,lang:"he"}))||(this.note=e("הדפדפן לא פתח את חלון ההדפסה."))}openPulse(s){this.pulseError="",this.pulse={station:s,door:s.doors[0]?.door??1,witness:"",typed:""}}async sendPulse(){const s=this.pulse;if(!(!s||this.busy||!k(s.station,s.typed)||s.witness.trim().length<2)){this.busy=!0,this.pulseError="";try{const t=this.run&&this.run.kind==="checks"&&this.run.stations.some(a=>a.station_id===s.station.id)?this.run.id:null;await M({station_id:s.station.id,door:s.door,confirm_text:s.typed,witness_name:s.witness.trim(),parent_run_id:t}),this.pulse=null,t&&await this.openRun(t),this.note=e("הפקודה נשלחה. רשמו את מה שהעד ראה.")}catch(t){this.pulseError=m(t)}finally{this.busy=!1}}}async witness(s,t){if(!this.busy){this.busy=!0;try{await I(s,t),this.run&&await this.openRun(this.run.id)}catch(a){this.note=m(a)}finally{this.busy=!1}}}render(){const s=this.data,t=!!this.run&&!g(this.run);return n`<sw-page heading=${e("בדיקת קבלה לעמדות")} subheading=${e("בדיקה לכל עמדה: זהות, דלתות, תמונה, דיבור, אירועים ושעון. הבדיקות קוראות בלבד ורצות רק כשלוחצים.")} data-lv-page>
      <span slot="actions" class="acts">
        <a class="back" href="#/system/diagnostics?tab=access-control" data-lv-back>${e("מצב WisKey")}</a>
        ${s&&s.stations.length?n`<sw-button variant="primary" icon="play" ?disabled=${!f()||t||this.busy} data-lv-run-all @click=${()=>void this.start({all:!0})}>${e("בדוק את כל העמדות")}</sw-button>`:c}
      </span>
      ${this.forbidden?n`<sw-state-panel state="forbidden" data-lv-state="forbidden" heading=${e("אין הרשאה למסך הזה")} hint=${e("בדיקת הקבלה פתוחה למי שמנהל עמדות (ניהול עמדות).")}></sw-state-panel>`:this.error?n`<sw-state-panel state="error" data-lv-state="error" heading=${e("בדיקת הקבלה לא נטענה")} hint=${this.error} actionLabel=${e("ניסיון חוזר")} @action=${()=>void this.load()}></sw-state-panel>`:s?s.stations.length?n`<div class="wrap" data-lv-state="ready">
                  ${this.note?n`<p class="note" role="status" data-lv-note>${this.note}</p>`:c}
                  ${this.runBar(s)}
                  <div class="grid">${C(this.order(s),a=>a.id,a=>this.stationCard(s,a))}</div>
                  <p class="muted foot">${e('"לא נתמך ב-WisKey" = הגרסה המותקנת של WisKey אינה מציעה את הבדיקה. "לא הורץ" = הבדיקה לא נוסתה (הגדרה כבויה, אין שיוך דלתות, בוטל). תוצאה לא ידועה מ-WisKey נרשמת ככישלון, לעולם לא כהצלחה.')}</p>
                </div>`:n`<sw-state-panel icon="door" state="empty" data-lv-state="empty" heading=${e("אין עמדות לבדיקה")} hint=${s.feed_state==="ready"?e("לא נמצאו עמדות שמותר לך לבדוק."):e("נתוני העמדות מ-WisKey אינם זמינים כרגע.")}></sw-state-panel>`:n`<sw-state-panel state="loading" data-lv-state="loading" heading=${e("טוען את העמדות…")}></sw-state-panel>`}
      ${this.pulseDialog()}
    </sw-page>`}order(s){return this.focusStation?[...s.stations.filter(a=>a.id===this.focusStation),...s.stations.filter(a=>a.id!==this.focusStation)]:s.stations}runBar(s){const t=this.run,a=!!t&&!g(t),d=t&&t.progress.total?Math.round(t.progress.done/t.progress.total*100):0;return n`<div class="bar" data-lv-bar>
      ${s.runs.length?n`<sw-field label=${e("בדיקה")}><select data-lv-history @change=${i=>void this.openRun(i.target.value)}>
            ${s.runs.map(i=>n`<option value=${i.id} ?selected=${t?.id===i.id}>${$(i.created_at,v(),y)} · ${i.scope==="all"?e("כל העמדות"):e("עמדה אחת")} · ${x[i.state]??i.state}</option>`)}
          </select></sw-field>`:n`<span class="muted" data-lv-no-runs>${e('עוד לא הורצה בדיקה. בחרו עמדה או "בדוק את כל העמדות".')}</span>`}
      ${t?n`<div class="prog" data-lv-progress=${t.state}>
              <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax=${t.progress.total} aria-valuenow=${t.progress.done} aria-label=${e("התקדמות הבדיקה")}><span style="inline-size:${d}%"></span></div>
              <span class="muted">${x[t.state]??t.state} · ${t.progress.done}/${t.progress.total} · ${e("עבר {n}",{n:t.counts.pass})} · ${e("נכשל {n}",{n:t.counts.fail})} · ${e("לא נתמך {n}",{n:t.counts.unsupported})} · ${e("לא הורץ {n}",{n:t.counts.not_run})}</span>
            </div>
            <div class="tools">
              ${a&&!t.cancel_requested?n`<sw-button size="sm" icon="stopSquare" data-lv-cancel @click=${()=>void this.cancel()}>${e("עצור")}</sw-button>`:c}
              <sw-button size="sm" icon="download" ?disabled=${a||!f()} data-lv-export @click=${()=>void this.exportCsv()}>CSV</sw-button>
              <sw-button size="sm" icon="list" ?disabled=${a} data-lv-print @click=${()=>this.print()}>${e("הדפסה / PDF")}</sw-button>
            </div>`:c}
    </div>`}resultsOf(s){const t=this.run,a=t?.stations.find(i=>i.station_id===s),d=(t?.pulses??[]).flatMap(i=>i.stations.filter(r=>r.station_id===s).flatMap(r=>r.checks.map(o=>({runId:i.id,c:o}))));return{checks:a?a.checks:null,pulses:d}}stationCard(s,t){const{checks:a,pulses:d}=this.resultsOf(t.id),i=!!this.run&&!g(this.run),r=this.focusStation===t.id;return n`<section class="st ${r?"focus":""}" data-lv-station=${t.id}>
      <header>
        <div class="name"><b>${t.name||t.id}</b><sw-badge kind=${t.online?"live":"offline"} label=${t.online?e("מחוברת"):e("מנותקת")}></sw-badge></div>
        <sw-button size="sm" icon="play" ?disabled=${!f()||i||this.busy} data-lv-run-one=${t.id} @click=${()=>void this.start({station_id:t.id})}>${e("בדוק")}</sw-button>
      </header>
      ${a?n`<ul class="checks">${a.map(o=>this.checkRow(o))}</ul>`:n`<p class="muted" data-lv-not-checked>${this.run?e("העמדה לא נבדקה בבדיקה הזו."):e("העמדה עוד לא נבדקה.")}</p>`}
      ${this.pulseBlock(s,t,d,i)}
    </section>`}checkRow(s){const t=b(s);return n`<li data-lv-check=${s.check} data-status=${s.status}>
      <sw-badge kind=${E(s.status)} label=${s.status_text}></sw-badge>
      <div class="ctext"><span class="clabel">${s.label}</span>${s.reason_text?n`<span class="reason" data-lv-reason=${s.reason??""}>${s.reason_text}</span>`:c}${t?n`<span class="muted detail">${t}</span>`:c}</div>
    </li>`}pulseBlock(s,t,a,d){if(!s.rights.pulse)return c;const i=a[0];if(i){const r=i.c.status==="pending"&&i.c.reason==="awaiting_witness";return n`<div class="pulse" data-lv-pulse-result=${i.c.status}>
        <div class="phead"><sw-badge kind=${r?"stale":E(i.c.status)} label=${r?e("ממתין לעד"):i.c.status_text}></sw-badge><span class="clabel">${i.c.label}</span></div>
        ${i.c.reason_text?n`<div class="reason">${i.c.reason_text}</div>`:c}
        ${b(i.c)?n`<div class="muted detail">${b(i.c)}</div>`:c}
        ${r?n`<div class="verdicts" data-lv-witness>${["opened","not_opened","unsure"].map(o=>n`<sw-button size="sm" variant=${o==="opened"?"primary":"secondary"} ?disabled=${this.busy} data-lv-verdict=${o} @click=${()=>void this.witness(i.runId,o)}>${B[o]}</sw-button>`)}</div>`:c}
      </div>`}return s.rights.pulse_local?t.can_pulse?n`<div class="pulse idle">
      <sw-button size="sm" variant="danger" icon="doorOpen" ?disabled=${!f()||d||this.busy} data-lv-pulse-open=${t.id} @click=${()=>this.openPulse(t)}>${R}</sw-button>
      <span class="muted">${e('פעם אחת לעמדה, עם עד ליד הדלת. לא חלק מ"בדוק את כל העמדות".')}</span>
    </div>`:n`<p class="muted" data-lv-pulse-off>${t.doors.length?e("אין לך הרשאה לפתוח דלתות בעמדה הזו."):e("פתיחת דלת עם עד: אין לעמדה דלת משויכת.")}</p>`:n`<p class="muted" data-lv-pulse-remote>${e("פתיחת דלת עם עד אפשרית רק מחיבור מקומי.")}</p>`}pulseDialog(){const s=this.pulse,t=!!s&&k(s.station,s.typed)&&s.witness.trim().length>=2;return n`<sw-dialog ?open=${!!s} heading=${R} subheading=${s?s.station.name||s.station.id:""} ?locked=${this.busy} @close=${()=>this.pulse=null} data-lv-pulse-dialog>
      ${s?n`<div class="dlg">
            <p class="warn" role="alert" data-lv-physical>${e('לחיצה על "פתח את הדלת" שולחת לעמדה פקודת פתיחה אחת.')} <b>${e("הדלת תיפתח באמת.")}</b> ${e("ודאו שהעד עומד ליד הדלת ושאין סכנה לאיש. הפקודה לא נשלחת שוב אוטומטית.")}</p>
            ${s.station.doors.length>1?n`<sw-field label=${e("דלת")}><select data-lv-door @change=${a=>this.pulse={...s,door:Number(a.target.value)}}>
                  ${s.station.doors.map(a=>n`<option value=${a.door} ?selected=${a.door===s.door}>${a.name?`${a.name} (${a.door})`:e("דלת {door}",{door:a.door})}</option>`)}
                </select></sw-field>`:n`<p class="muted">${e("דלת:")} ${s.station.doors[0]?.name??e("דלת {door}",{door:s.door})}</p>`}
            <sw-field label=${e("שם העד")} hint=${e("מי שעומד ליד הדלת ומאשר מה ראה.")}><input data-lv-witness-name maxlength="80" autocomplete="off" .value=${s.witness} @input=${a=>this.pulse={...s,witness:a.target.value}} /></sw-field>
            <sw-field label=${e("להמשך הקלידו את שם העמדה: {name}",{name:s.station.name||s.station.id})}><input data-lv-confirm autocomplete="off" .value=${s.typed} @input=${a=>this.pulse={...s,typed:a.target.value}} /></sw-field>
            ${this.pulseError?n`<p class="err" role="alert" data-lv-pulse-error>${this.pulseError}</p>`:c}
            <div class="dacts">
              <sw-button ?disabled=${this.busy} @click=${()=>this.pulse=null}>${e("ביטול")}</sw-button>
              <sw-button variant="danger" icon="doorOpen" ?disabled=${!t||this.busy} data-lv-pulse-send @click=${()=>void this.sendPulse()}>${this.busy?e("שולח…"):e("פתח את הדלת")}</sw-button>
            </div>
          </div>`:c}
    </sw-dialog>`}};p.styles=O`
    :host {
      display: block;
    }
    .acts {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .back {
      color: var(--sw-accent);
      font-size: var(--sw-fs-sm);
      text-decoration: none;
      padding: 6px 4px;
    }
    .back:hover {
      text-decoration: underline;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4, 16px);
    }
    ${K}
    .note {
      margin: 0;
      padding: 8px 12px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface-2);
      font-size: var(--sw-fs-sm);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 10px 16px;
      padding: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
    }
    .bar sw-field {
      min-inline-size: min(320px, 100%);
    }
    .prog {
      display: flex;
      flex-direction: column;
      gap: 6px;
      flex: 1 1 260px;
      min-inline-size: 0;
    }
    .track {
      block-size: 6px;
      border-radius: 3px;
      background: var(--sw-surface-2);
      overflow: hidden;
    }
    .track span {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
    }
    .tools {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(340px, 100%), 1fr));
      gap: 12px;
    }
    .st {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      min-inline-size: 0;
    }
    .st.focus {
      border-color: var(--sw-accent);
    }
    .st header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .name {
      display: flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
    }
    .name b {
      overflow-wrap: anywhere;
    }
    .checks {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .checks li {
      display: grid;
      grid-template-columns: 140px 1fr;
      align-items: start;
      gap: 8px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .checks li:last-child {
      border-block-end: 0;
    }
    .ctext {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .clabel {
      font-weight: var(--sw-fw-medium);
    }
    .reason {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      overflow-wrap: anywhere;
    }
    .detail {
      overflow-wrap: anywhere;
    }
    .pulse {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px;
      border: 1px dashed var(--sw-danger);
      border-radius: var(--sw-r-sm);
    }
    .pulse.idle {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;
    }
    .phead {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .verdicts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .warn {
      margin: 0;
      padding: 10px 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-danger);
      color: var(--sw-text);
      background: color-mix(in srgb, var(--sw-danger) 10%, transparent);
    }
    .err {
      margin: 0;
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    .dacts {
      display: flex;
      justify-content: flex-end;
      flex-wrap: wrap;
      gap: 8px;
    }
    .foot {
      margin: 0;
    }
    @media (max-width: 600px) {
      .checks li {
        grid-template-columns: 140px 1fr;
      }
    }
  `;u([h()],p.prototype,"data",2);u([h()],p.prototype,"run",2);u([h()],p.prototype,"error",2);u([h()],p.prototype,"forbidden",2);u([h()],p.prototype,"busy",2);u([h()],p.prototype,"note",2);u([h()],p.prototype,"pulse",2);u([h()],p.prototype,"pulseError",2);u([h()],p.prototype,"focusStation",2);p=u([P("system-wiskey-validation")],p);export{p as SystemWiskeyValidation};
