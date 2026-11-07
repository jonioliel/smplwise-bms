import{a as W,aB as z,i as h,j as R,T as f,A as d,e as i,bW as T,E as S,G as u,H as C}from"./index-DTag9Y3p.js";import{a as K,p as O}from"./events-print-BofHdYv3.js";import{g as b,a as $,r as m,s as P,c as L,f as U,b as x,d as A,e as D,h as v,i as _}from"./wiskey-validation-BPr21pYE.js";import{f as w,U as g}from"./wiskey-format-DJ4vUeXA.js";import"./sw-logo-art-Va6y_cIM.js";var I=Object.defineProperty,j=Object.getOwnPropertyDescriptor,p=(s,t,e,l)=>{for(var a=l>1?void 0:l?j(t,e):t,n=s.length-1,r;n>=0;n--)(r=s[n])&&(a=(l?r(t,e,a):r(a))||a);return l&&a&&I(t,e,a),a};const k=1500,E="פעולה פיזית - דלת תיפתח",y={running:"בבדיקה",done:"הסתיימה",cancelled:"בוטלה",interrupted:"נקטעה (הפעלה מחדש)"},M={opened:"הדלת נפתחה",not_opened:"הדלת לא נפתחה",unsure:"לא בטוח"},B={feed_state:"ready",stations:[{id:"demo-lobby",name:"לובי ראשי",online:!0,doors:[{door:1,name:"כניסה"}],can_pulse:!1},{id:"demo-garage",name:"חניון",online:!0,doors:[],can_pulse:!1}],checks:[],runs:[],active_run_id:null,rights:{run:!1,pulse:!1,pulse_local:!0}},o=(s,t,e,l,a=null,n=null)=>({check:s,label:t,status:e,status_text:l,reason:a,reason_text:n,detail:{},started_at:null,finished_at:"2026-11-03T10:00:00Z"}),N={id:"lv_demo",kind:"checks",scope:"all",parent_run_id:null,state:"done",created_by:"demo",created_by_name:"הדגמה",created_at:"2026-11-03T09:59:00Z",finished_at:"2026-11-03T10:00:00Z",cancel_requested:!1,station_count:2,counts:{pending:0,running:0,pass:9,fail:2,unsupported:2,not_run:3},progress:{done:16,total:16},pulses:[],stations:[{station_id:"demo-lobby",name:"לובי ראשי",counts:{pending:0,running:0,pass:6,fail:1,unsupported:1,not_run:0},progress:{done:8,total:8},checks:[o("identity","זהות העמדה","pass","עבר"),o("door_capabilities","יכולות הדלת","pass","עבר"),o("door_read","קריאת הגדרות הדלת","pass","עבר"),o("media_arx","תמונה דרך Arx","pass","עבר"),o("media_wiskey","תמונה דרך WisKey","unsupported","לא נתמך ב-WisKey","not_listed","WisKey אינו מפרסם את פקודות המדיה בערוץ השירות."),o("talk","זמינות דיבור","fail","נכשל","provider_local","מקור הווידאו והדיבור מוגדר Arx, ולכן WisKey לא נבדק כאן."),o("events","זרם אירועים","pass","עבר"),o("clock","סטיית שעון","pass","עבר")]},{station_id:"demo-garage",name:"חניון",counts:{pending:0,running:0,pass:3,fail:1,unsupported:1,not_run:3},progress:{done:8,total:8},checks:[o("identity","זהות העמדה","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),o("door_capabilities","יכולות הדלת","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),o("door_read","קריאת הגדרות הדלת","not_run","לא הורץ","relay_map_missing","לעמדה אין שיוך דלתות מאושר, ולכן WisKey לא יכול לבדוק אותה. שייכו דלתות במסך שיוך דלתות."),o("media_arx","תמונה דרך Arx","pass","עבר"),o("media_wiskey","תמונה דרך WisKey","unsupported","לא נתמך ב-WisKey","not_listed","WisKey אינו מפרסם את פקודות המדיה בערוץ השירות."),o("talk","זמינות דיבור","pass","עבר"),o("events","זרם אירועים","pass","עבר"),o("clock","סטיית שעון","fail","נכשל","skew_over_tolerance","שעון העמדה סוטה מעבר ל-2 שניות.")]}]};let c=class extends W{constructor(){super(...arguments),this.data=null,this.run=null,this.error="",this.forbidden=!1,this.busy=!1,this.note="",this.pulse=null,this.pulseError="",this.focusStation="",this.timer=null}connectedCallback(){super.connectedCallback(),this.focusStation=z().params.get("station")??"",this.load()}disconnectedCallback(){super.disconnectedCallback(),this.stopPolling()}stopPolling(){this.timer!==null&&clearTimeout(this.timer),this.timer=null}async load(){if(!h()){this.data=B,this.run=N;return}try{const s=await b();this.data=s,this.forbidden=!1,this.error="";const t=s.active_run_id??(this.run&&s.runs.some(e=>e.id===this.run?.id)?this.run.id:s.runs[0]?.id);t?await this.openRun(t):this.run=null}catch(s){s instanceof R&&s.status===403?this.forbidden=!0:this.error=f(s)}}async openRun(s){this.stopPolling();try{this.run=await $(s)}catch(t){this.note=f(t);return}this.run&&!m(this.run)&&(this.timer=setTimeout(()=>void this.poll(),k))}async poll(){if(this.timer=null,!(!this.run||!this.isConnected)){try{const s=await $(this.run.id);if(this.run=s,m(s)){this.data=await b();return}}catch{}this.timer=setTimeout(()=>void this.poll(),k)}}async start(s){if(!(!h()||this.busy)){this.busy=!0,this.note="";try{const{run_id:t}=await P(s);await this.openRun(t),this.data=await b()}catch(t){this.note=f(t)}finally{this.busy=!1}}}async cancel(){if(this.run)try{await L(this.run.id),this.note="הבקשה לעצור נשלחה: הבדיקה תיעצר לפני הצעד הבא."}catch(s){this.note=f(s)}}async exportCsv(){if(!(!this.run||!h()))try{const s=await U(this.run.id),t=URL.createObjectURL(s),e=document.createElement("a");e.href=t,e.download=`arx-station-acceptance-${this.run.id.slice(-8)}.csv`,document.body.append(e),e.click(),e.remove(),setTimeout(()=>URL.revokeObjectURL(t),1e3)}catch(s){this.note=f(s)}}print(){const s=this.run;if(!s)return;const t=[],e=a=>a.stations.forEach(n=>n.checks.forEach(r=>t.push([n.name||n.station_id,r.label,r.status_text,r.reason_text??"",v(r)])));e(s),s.pulses.forEach(e),K(O({title:"בדיקת קבלה לעמדות",subtitle:`${w(s.created_at,"he-IL",g)} (UTC) · ${s.created_by_name??""} · ${y[s.state]??s.state} · ${s.station_count} עמדות`,columns:["עמדה","בדיקה","תוצאה","סיבה","פרטים"],rows:t,footer:`SmplWise Arx · הודפס ${w(new Date().toISOString(),"he-IL",g)} (UTC) · ${s.id}`,lang:"he"}))||(this.note="הדפדפן לא פתח את חלון ההדפסה.")}openPulse(s){this.pulseError="",this.pulse={station:s,door:s.doors[0]?.door??1,witness:"",typed:""}}async sendPulse(){const s=this.pulse;if(!(!s||this.busy||!x(s.station,s.typed)||s.witness.trim().length<2)){this.busy=!0,this.pulseError="";try{const t=this.run&&this.run.kind==="checks"&&this.run.stations.some(e=>e.station_id===s.station.id)?this.run.id:null;await A({station_id:s.station.id,door:s.door,confirm_text:s.typed,witness_name:s.witness.trim(),parent_run_id:t}),this.pulse=null,t&&await this.openRun(t),this.note="הפקודה נשלחה. רשמו את מה שהעד ראה."}catch(t){this.pulseError=f(t)}finally{this.busy=!1}}}async witness(s,t){if(!this.busy){this.busy=!0;try{await D(s,t),this.run&&await this.openRun(this.run.id)}catch(e){this.note=f(e)}finally{this.busy=!1}}}render(){const s=this.data,t=!!this.run&&!m(this.run);return i`<sw-page heading="בדיקת קבלה לעמדות" subheading="בדיקה לכל עמדה: זהות, דלתות, תמונה, דיבור, אירועים ושעון. הבדיקות קוראות בלבד ורצות רק כשלוחצים." data-lv-page>
      <span slot="actions" class="acts">
        <a class="back" href="#/system/diagnostics?tab=access-control" data-lv-back>מצב WisKey</a>
        ${s&&s.stations.length?i`<sw-button variant="primary" icon="play" ?disabled=${!h()||t||this.busy} data-lv-run-all @click=${()=>void this.start({all:!0})}>בדוק את כל העמדות</sw-button>`:d}
      </span>
      ${this.forbidden?i`<sw-state-panel state="forbidden" data-lv-state="forbidden" heading="אין הרשאה למסך הזה" hint="בדיקת הקבלה פתוחה למי שמנהל עמדות (ניהול עמדות)."></sw-state-panel>`:this.error?i`<sw-state-panel state="error" data-lv-state="error" heading="בדיקת הקבלה לא נטענה" hint=${this.error} actionLabel="ניסיון חוזר" @action=${()=>void this.load()}></sw-state-panel>`:s?s.stations.length?i`<div class="wrap" data-lv-state="ready">
                  ${this.note?i`<p class="note" role="status" data-lv-note>${this.note}</p>`:d}
                  ${this.runBar(s)}
                  <div class="grid">${T(this.order(s),e=>e.id,e=>this.stationCard(s,e))}</div>
                  <p class="muted foot">"לא נתמך ב-WisKey" = הגרסה המותקנת של WisKey אינה מציעה את הבדיקה. "לא הורץ" = הבדיקה לא נוסתה (הגדרה כבויה, אין שיוך דלתות, בוטל). תוצאה לא ידועה מ-WisKey נרשמת ככישלון, לעולם לא כהצלחה.</p>
                </div>`:i`<sw-state-panel icon="door" state="empty" data-lv-state="empty" heading="אין עמדות לבדיקה" hint=${s.feed_state==="ready"?"לא נמצאו עמדות שמותר לך לבדוק.":"נתוני העמדות מ-WisKey אינם זמינים כרגע."}></sw-state-panel>`:i`<sw-state-panel state="loading" data-lv-state="loading" heading="טוען את העמדות…"></sw-state-panel>`}
      ${this.pulseDialog()}
    </sw-page>`}order(s){return this.focusStation?[...s.stations.filter(e=>e.id===this.focusStation),...s.stations.filter(e=>e.id!==this.focusStation)]:s.stations}runBar(s){const t=this.run,e=!!t&&!m(t),l=t&&t.progress.total?Math.round(t.progress.done/t.progress.total*100):0;return i`<div class="bar" data-lv-bar>
      ${s.runs.length?i`<sw-field label="בדיקה"><select data-lv-history @change=${a=>void this.openRun(a.target.value)}>
            ${s.runs.map(a=>i`<option value=${a.id} ?selected=${t?.id===a.id}>${w(a.created_at,"he-IL",g)} · ${a.scope==="all"?"כל העמדות":"עמדה אחת"} · ${y[a.state]??a.state}</option>`)}
          </select></sw-field>`:i`<span class="muted" data-lv-no-runs>עוד לא הורצה בדיקה. בחרו עמדה או "בדוק את כל העמדות".</span>`}
      ${t?i`<div class="prog" data-lv-progress=${t.state}>
              <div class="track" role="progressbar" aria-valuemin="0" aria-valuemax=${t.progress.total} aria-valuenow=${t.progress.done} aria-label="התקדמות הבדיקה"><span style="inline-size:${l}%"></span></div>
              <span class="muted">${y[t.state]??t.state} · ${t.progress.done}/${t.progress.total} · עבר ${t.counts.pass} · נכשל ${t.counts.fail} · לא נתמך ${t.counts.unsupported} · לא הורץ ${t.counts.not_run}</span>
            </div>
            <div class="tools">
              ${e&&!t.cancel_requested?i`<sw-button size="sm" icon="stopSquare" data-lv-cancel @click=${()=>void this.cancel()}>עצור</sw-button>`:d}
              <sw-button size="sm" icon="download" ?disabled=${e||!h()} data-lv-export @click=${()=>void this.exportCsv()}>CSV</sw-button>
              <sw-button size="sm" icon="list" ?disabled=${e} data-lv-print @click=${()=>this.print()}>הדפסה / PDF</sw-button>
            </div>`:d}
    </div>`}resultsOf(s){const t=this.run,e=t?.stations.find(a=>a.station_id===s),l=(t?.pulses??[]).flatMap(a=>a.stations.filter(n=>n.station_id===s).flatMap(n=>n.checks.map(r=>({runId:a.id,c:r}))));return{checks:e?e.checks:null,pulses:l}}stationCard(s,t){const{checks:e,pulses:l}=this.resultsOf(t.id),a=!!this.run&&!m(this.run),n=this.focusStation===t.id;return i`<section class="st ${n?"focus":""}" data-lv-station=${t.id}>
      <header>
        <div class="name"><b>${t.name||t.id}</b><sw-badge kind=${t.online?"live":"offline"} label=${t.online?"מחוברת":"מנותקת"}></sw-badge></div>
        <sw-button size="sm" icon="play" ?disabled=${!h()||a||this.busy} data-lv-run-one=${t.id} @click=${()=>void this.start({station_id:t.id})}>בדוק</sw-button>
      </header>
      ${e?i`<ul class="checks">${e.map(r=>this.checkRow(r))}</ul>`:i`<p class="muted" data-lv-not-checked>${this.run?"העמדה לא נבדקה בבדיקה הזו.":"העמדה עוד לא נבדקה."}</p>`}
      ${this.pulseBlock(s,t,l,a)}
    </section>`}checkRow(s){const t=v(s);return i`<li data-lv-check=${s.check} data-status=${s.status}>
      <sw-badge kind=${_(s.status)} label=${s.status_text}></sw-badge>
      <div class="ctext"><span class="clabel">${s.label}</span>${s.reason_text?i`<span class="reason" data-lv-reason=${s.reason??""}>${s.reason_text}</span>`:d}${t?i`<span class="muted detail">${t}</span>`:d}</div>
    </li>`}pulseBlock(s,t,e,l){if(!s.rights.pulse)return d;const a=e[0];if(a){const n=a.c.status==="pending"&&a.c.reason==="awaiting_witness";return i`<div class="pulse" data-lv-pulse-result=${a.c.status}>
        <div class="phead"><sw-badge kind=${n?"stale":_(a.c.status)} label=${n?"ממתין לעד":a.c.status_text}></sw-badge><span class="clabel">${a.c.label}</span></div>
        ${a.c.reason_text?i`<div class="reason">${a.c.reason_text}</div>`:d}
        ${v(a.c)?i`<div class="muted detail">${v(a.c)}</div>`:d}
        ${n?i`<div class="verdicts" data-lv-witness>${["opened","not_opened","unsure"].map(r=>i`<sw-button size="sm" variant=${r==="opened"?"primary":"secondary"} ?disabled=${this.busy} data-lv-verdict=${r} @click=${()=>void this.witness(a.runId,r)}>${M[r]}</sw-button>`)}</div>`:d}
      </div>`}return s.rights.pulse_local?t.can_pulse?i`<div class="pulse idle">
      <sw-button size="sm" variant="danger" icon="doorOpen" ?disabled=${!h()||l||this.busy} data-lv-pulse-open=${t.id} @click=${()=>this.openPulse(t)}>${E}</sw-button>
      <span class="muted">פעם אחת לעמדה, עם עד ליד הדלת. לא חלק מ"בדוק את כל העמדות".</span>
    </div>`:i`<p class="muted" data-lv-pulse-off>${t.doors.length?"אין לך הרשאה לפתוח דלתות בעמדה הזו.":"פתיחת דלת עם עד: אין לעמדה דלת משויכת."}</p>`:i`<p class="muted" data-lv-pulse-remote>פתיחת דלת עם עד אפשרית רק מחיבור מקומי.</p>`}pulseDialog(){const s=this.pulse,t=!!s&&x(s.station,s.typed)&&s.witness.trim().length>=2;return i`<sw-dialog ?open=${!!s} heading=${E} subheading=${s?s.station.name||s.station.id:""} ?locked=${this.busy} @close=${()=>this.pulse=null} data-lv-pulse-dialog>
      ${s?i`<div class="dlg">
            <p class="warn" role="alert" data-lv-physical>לחיצה על "פתח את הדלת" שולחת לעמדה פקודת פתיחה אחת. <b>הדלת תיפתח באמת.</b> ודאו שהעד עומד ליד הדלת ושאין סכנה לאיש. הפקודה לא נשלחת שוב אוטומטית.</p>
            ${s.station.doors.length>1?i`<sw-field label="דלת"><select data-lv-door @change=${e=>this.pulse={...s,door:Number(e.target.value)}}>
                  ${s.station.doors.map(e=>i`<option value=${e.door} ?selected=${e.door===s.door}>${e.name?`${e.name} (${e.door})`:`דלת ${e.door}`}</option>`)}
                </select></sw-field>`:i`<p class="muted">דלת: ${s.station.doors[0]?.name??`דלת ${s.door}`}</p>`}
            <sw-field label="שם העד" hint="מי שעומד ליד הדלת ומאשר מה ראה."><input data-lv-witness-name maxlength="80" autocomplete="off" .value=${s.witness} @input=${e=>this.pulse={...s,witness:e.target.value}} /></sw-field>
            <sw-field label=${`להמשך הקלידו את שם העמדה: ${s.station.name||s.station.id}`}><input data-lv-confirm autocomplete="off" .value=${s.typed} @input=${e=>this.pulse={...s,typed:e.target.value}} /></sw-field>
            ${this.pulseError?i`<p class="err" role="alert" data-lv-pulse-error>${this.pulseError}</p>`:d}
            <div class="dacts">
              <sw-button ?disabled=${this.busy} @click=${()=>this.pulse=null}>ביטול</sw-button>
              <sw-button variant="danger" icon="doorOpen" ?disabled=${!t||this.busy} data-lv-pulse-send @click=${()=>void this.sendPulse()}>${this.busy?"שולח…":"פתח את הדלת"}</sw-button>
            </div>
          </div>`:d}
    </sw-dialog>`}};c.styles=S`
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
    .muted {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
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
  `;p([u()],c.prototype,"data",2);p([u()],c.prototype,"run",2);p([u()],c.prototype,"error",2);p([u()],c.prototype,"forbidden",2);p([u()],c.prototype,"busy",2);p([u()],c.prototype,"note",2);p([u()],c.prototype,"pulse",2);p([u()],c.prototype,"pulseError",2);p([u()],c.prototype,"focusStation",2);c=p([C("system-wiskey-validation")],c);export{c as SystemWiskeyValidation};
//# sourceMappingURL=system-wiskey-validation-TqSGfTF-.js.map
