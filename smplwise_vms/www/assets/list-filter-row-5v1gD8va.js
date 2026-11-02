import{b as oe,s as X,S as le,a as ce,w as de,o as pe,m as ue}from"./ticket-detail-CPqvYB28.js";import{E as S,gG as fe,w as he,x as Y,mf as be,F as b,G as J,a as Q,b_ as ve,A as p,e as l,H as Z,mH as we,mv as ee,p as m,C as ge,D as me,mI as xe,S as ye,b as ke,t as f,mJ as $e,q as y,i as ze,ba as _e,g as H,bX as Se,b7 as Ce,b6 as A,j as F,mK as g,bY as Oe,mq as Me,mL as B}from"./index-D0R90ECk.js";import{a as Le,w as Ve}from"./board-model-CJwimW_z.js";const He=S`
  .tcard.stuck {
    border-color: color-mix(in srgb, var(--dv-danger) 45%, transparent);
  }
  .tcard.closed {
    opacity: 0.86;
  }
  .chip .subst {
    font-weight: 600;
    opacity: 0.85;
  }
  /* the sentence IS the status: the largest line of the card after the title, two lines at most (the full text is the title attribute) */
  p.stat {
    margin: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.5;
    color: var(--dv-text);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }
  /* the board card's one ranked warning line, instead of its chips row */
  .cwarn {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 7px;
    min-inline-size: 0;
    font-size: var(--sw-fs-base);
    font-weight: 600;
    color: var(--au-warn-text);
  }
  .cwarn.bad {
    color: var(--dv-danger);
  }
  .cwarn .ic {
    flex: none;
    font-size: var(--sw-fs-lg);
  }
  .cwarn span {
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .pair {
    display: inline-flex;
    flex: none;
    margin-inline-start: auto;
  }
  .av {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    box-sizing: border-box;
    border-radius: 50%;
    border: 2px solid var(--dv-surface-solid);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    letter-spacing: 0;
    color: var(--dv-accent-text);
    background: var(--dv-accent-soft);
  }
  .av + .av {
    margin-inline-start: -8px;
  }
  .av.ext {
    color: var(--au-warn-text);
    background: var(--dv-warning-soft);
  }
  footer span.run {
    flex: 1 1 auto;
    min-inline-size: 0;
  }
  footer span.run > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (max-width: 767px) {
    p.stat {
      font-size: var(--sw-fs-base);
    }
  }
  /* UXFIX-A11Y-295: the skeleton card - shimmer bars sit IN the text lines, so every line keeps the height of the text it stands for */
  .tcard.sk .skl.ln {
    display: inline-block;
    vertical-align: middle;
    block-size: 0.8em;
    max-inline-size: 100%;
    border-radius: var(--sw-r-xs);
  }
  .tcard.sk .chip,
  .tcard.sk .av {
    background: var(--dv-surface-3);
  }
  .tcard.sk .chip .skl.ln {
    background: none;
    animation: none;
  }
  :host([data-skin='bubble']) .av {
    border-radius: 50%;
  }
`,dt=S`
  .frow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 10px 14px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .frow .lbl {
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .frow .sep {
    inline-size: 1px;
    block-size: 22px;
    background: var(--dv-border);
  }
  .frow .rc {
    min-block-size: 32px;
    padding-block: 4px;
  }
  .frow .rc .ic {
    font-size: var(--sw-fs-base);
  }
  .frow .grow {
    flex: 1;
  }
  .frow select {
    min-block-size: 32px;
    max-inline-size: 200px;
    padding-inline: 12px;
    border-radius: var(--dv-radius-control);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
  }
  .fnote {
    padding-inline: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--dv-text-2);
  }
  .vsw button .lbl {
    font-weight: 600;
  }
  .vsw button[aria-checked='true'] .ic,
  .vsw button[aria-checked='true'] svg {
    color: var(--dv-accent-text);
  }
  .seg.scope button small,
  .seg.stf button small {
    margin-inline-start: 6px;
  }
  /* a count on a department chip is a small badge, never read as part of the name */
  .rooms .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rooms .rc[aria-pressed='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  @media (max-width: 767px) {
    .frow {
      padding: 10px 12px;
    }
    .frow .rc,
    .frow select {
      min-block-size: 44px;
    }
    .frow .sep {
      display: none;
    }
    .vsw button .lbl {
      display: none;
    }
    .dh-det .seg.scope {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border-radius: var(--sw-r-xl);
    }
    .dh-det .seg.scope button {
      padding-inline: 6px;
      min-block-size: 44px;
    }
    .dh-det .filterbtn {
      order: 2;
      min-block-size: 44px;
    }
  }
`,pt=S`
  .today {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 10px 16px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .today > b {
    flex: none;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .today .up {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-block-size: 32px;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    text-align: start;
  }
  /* POLISH-CONTROL-297: the "today" entry answers the press (transform only, token durations - zero under reduced motion); hover is for
     fine pointers only */
  .today button.up {
    cursor: pointer;
    border-radius: var(--sw-r-md);
    transition: transform var(--sw-t-fast) var(--sw-ease);
  }
  .today button.up:active {
    transform: scale(0.98);
  }
  @media (hover: hover) and (pointer: fine) {
    .today button.up:hover {
      text-decoration: underline;
    }
  }
  .today button.up:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  .today .up time {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .today .up .what {
    color: var(--dv-text-2);
  }
  .today .up i {
    inline-size: 8px;
    block-size: 8px;
    border-radius: 50%;
    flex: none;
    background: var(--dv-accent);
  }
  .today .up.warn i {
    background: var(--dv-warning);
  }
  .today .up.ok i {
    background: var(--dv-success);
  }
  .hgroup {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    padding-inline: 4px;
    font-size: var(--sw-fs-base);
    color: var(--dv-text-2);
  }
  .hgroup b {
    font-size: var(--sw-fs-md);
    color: var(--dv-text);
  }
  .hgroup .av {
    inline-size: 26px;
    block-size: 26px;
  }
  .load {
    display: inline-flex;
    gap: 3px;
    align-items: center;
  }
  .load i {
    inline-size: 14px;
    block-size: 6px;
    border-radius: var(--sw-r-pill);
    background: var(--dv-surface-3);
  }
  .load i.on {
    background: var(--dv-accent);
  }
  .load i.hot {
    background: var(--dv-danger);
  }
  .closedrows {
    display: flex;
    flex-direction: column;
    padding: 4px 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-2xl);
  }
  .closedrows .cr {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 6px 14px;
    min-block-size: 44px;
    padding: 6px 12px;
    border: 0;
    background: transparent;
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    text-align: start;
    text-decoration: none;
    border-radius: var(--sw-r-lg);
    cursor: pointer;
  }
  .closedrows .cr + .cr {
    border-block-start: 1px solid var(--dv-border);
  }
  .closedrows .cr {
    transition: background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  .closedrows .cr:active {
    transform: scale(0.99);
  }
  .closedrows .cr:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: -2px;
  }
  @media (hover: hover) and (pointer: fine) {
    .closedrows .cr:hover {
      background: var(--dv-surface-3);
    }
  }
  .closedrows .cr .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
    color: var(--dv-text-3);
    font-weight: 600;
  }
  .closedrows .cr b {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .closedrows .cr span:not(.num) {
    color: var(--dv-text-2);
    white-space: nowrap;
  }
  @media (max-width: 767px) {
    .today {
      padding: 10px 12px;
    }
    .today .up {
      min-block-size: 44px;
    }
    .closedrows .cr {
      grid-template-columns: auto minmax(0, 1fr) auto;
    }
    .closedrows .cr .hide-p {
      display: none;
    }
  }
`,Pe={coin:'<circle cx="12" cy="12" r="9"/><path d="M14.5 9.2c-.6-.8-1.5-1.2-2.5-1.2-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2c-1 0-1.9-.4-2.5-1.2M12 6.5V8m0 8v1.5"/>',hand:'<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11m0-.5V4.5a1.5 1.5 0 0 1 3 0V11m0-.5V6a1.5 1.5 0 0 1 3 0v8a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.6-2.2L4 14.5a1.6 1.6 0 0 1 2.4-2L8 14"/>',calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sliders:'<path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1"/><circle cx="16" cy="6" r="1.8"/><circle cx="10" cy="12" r="1.8"/><circle cx="18" cy="18" r="1.8"/>',cardsView:'<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',tableView:'<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 10h17M3.5 14.5h17M10 5v14"/>',boardView:'<rect x="3.5" y="4" width="4.5" height="14" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="9" rx="1.5"/><rect x="16" y="4" width="4.5" height="11" rx="1.5"/>'};function $(e,t=""){return he`<svg class=${t?`ic ${t}`:"ic"} viewBox="0 0 24 24" aria-hidden="true">${fe(Pe[e])}</svg>`}const Re={lsScopeGroup:"היקף הרשימה",lsStateGroup:"סינון לפי מצב",lsSearchLong:"חיפוש לפי מספר, כותרת או התקן",lsViewsGroup:"תצוגת הרשימה",lsView_cards:"כרטיסים",lsView_table:"טבלה",lsView_board:"לוח מנהל",lsView_calendar:"יומן שבועי",lfBtn:"סינון",lfBtnCount:"סינון · {n}",lfGroup:"סינון {tickets}",lfPriority:"עדיפות",lfHandler:"מטפל",lfAnyHandler:"כולם",lfNoHandler:"ללא מטפל",lfStuck:"{f:תקועות|m:תקועים}",lfWaiting:"{f:ממתינות|m:ממתינים} לי",lfCost:"עלות לאישור",lfClear:"ניקוי",lfShown:"מוצגות {n} מתוך {m}",lfNoMatch:"אין {tickets} {f:שמתאימות|m:שמתאימים} למסנן",tbPanel:"סינון {tickets}",tbState:"מצב",tbDept:"מחלקה",tbPlace:"מיקום",tbChips:"מסננים פעילים",tbChipState:"מצב: {name}",tbRemove:"הסרת המסנן {name}",tbReset:"איפוס",tbResetLabel:"איפוס כל המסננים",tbClose:"סגירה",tbTree:"עץ הקומות",tbFlags:"{f:דורשות|m:דורשים} תשומת לב",lcCostMine:"לאישורך",lcStuck:"{f:תקועה|m:תקוע}",lcNoHandler:"ללא מטפל",lcWhoVendor:"גורם חיצוני: {name}",lcWhoStaff:"מטפל: {name}",lcWhoOwner:"אחראי בארגון: {name}",lcSentence:"מצב: {text}",ltSentence:"מה קורה",bdTodayGroup:"מה קורה היום",bdToday:"היום",bdVisit:"ביקור",bdSla:"יעד תגובה",bdWaitingMine:"{f:ממתינות|m:ממתינים} לאישורך: {n}",bdWaitingMineOne:"{f:ממתינה|m:ממתין} לאישורך: 1",bdHandlingBy:"{n} בטיפול · {f:הוותיקה|m:הוותיק} {age}",bdLoad:"עומס",bdLoadLabel:"עומס: {n} {tickets} בטיפול",bdClosedRows:"נסגרו לאחרונה",bdOpenRow:"פתיחת {the_ticket} {n}",elLessMinute:"פחות מדקה",elMin:"{m} ד׳",elHour:"{h} ש׳",elHourMin:"{h} ש׳ {m} ד׳",elDayOne:"1 יום",elDays:"{d} ימים",elOpen:"{f:פתוחה|m:פתוח} {dur}",elHandled:"{f:טופלה|m:טופל} תוך {dur}",elCancelled:"{f:בוטלה|m:בוטל} אחרי {dur}",elOldest:"{f:הוותיקה|m:הוותיק} {f:פתוחה|m:פתוח} {dur}",elTitle:"משך הזמן מפתיחת {the_ticket}"},Ee={lsScopeGroup:"List scope",lsStateGroup:"Filter by state",lsSearchLong:"Search by number, title or device",lsViewsGroup:"List view",lsView_cards:"Cards",lsView_table:"Table",lsView_board:"Manager board",lsView_calendar:"Weekly calendar",lfBtn:"Filter",lfBtnCount:"Filter · {n}",lfGroup:"Filter {tickets}",lfPriority:"Priority",lfHandler:"Handler",lfAnyHandler:"Everyone",lfNoHandler:"No handler",lfStuck:"Stuck",lfWaiting:"Waiting for me",lfCost:"Cost to approve",lfClear:"Clear",tbPanel:"Filter {tickets}",tbState:"State",tbDept:"Department",tbPlace:"Place",tbChips:"Active filters",tbChipState:"State: {name}",tbRemove:"Remove the filter {name}",tbReset:"Reset",tbResetLabel:"Reset all filters",tbClose:"Close",tbTree:"Floors tree",tbFlags:"Needs attention",lfShown:"Showing {n} of {m}",lfNoMatch:"No {tickets} match the filter",lcCostMine:"To approve",lcStuck:"Stuck",lcNoHandler:"No handler",lcWhoVendor:"Outside handler: {name}",lcWhoStaff:"Handler: {name}",lcWhoOwner:"Owner: {name}",lcSentence:"Status: {text}",ltSentence:"What is happening",bdTodayGroup:"What is happening today",bdToday:"Today",bdVisit:"Visit",bdSla:"Response target",bdWaitingMine:"Waiting for your approval: {n}",bdWaitingMineOne:"Waiting for your approval: 1",bdHandlingBy:"{n} in progress · oldest {age}",bdLoad:"Load",bdLoadLabel:"Load: {n} {tickets} in progress",bdClosedRows:"Closed lately",bdOpenRow:"Open {the_ticket} {n}",elLessMinute:"Under a minute",elMin:"{m} min",elHour:"{h} h",elHourMin:"{h} h {m} min",elDayOne:"1 day",elDays:"{d} days",elOpen:"Open {dur}",elHandled:"Handled in {dur}",elCancelled:"Cancelled after {dur}",elOldest:"Oldest open {dur}",elTitle:"Time since the {ticket} was opened"};function De(e,t=Y()){return(t==="en"?Ee[e]:void 0)??Re[e]}function o(e,t){const n=Y(),a=be(De(e,n),n);return t?a.replace(/\{(\w+)\}/g,(s,r)=>r in t?String(t[r]):s):a}const O=6e4,k=60*O,P=24*k,T=["closed","cancelled"];function te(e,t=new Date){const n=Date.parse(e.created_at);if(Number.isNaN(n))return null;let a=t.getTime();if(T.includes(e.status)){const s=Date.parse(e.closed_at??e.last_activity_at??"");a=Number.isNaN(s)?t.getTime():s}return Math.max(0,a-n)}function ne(e){const t=Math.max(0,e);if(t<O)return o("elLessMinute");if(t<k)return o("elMin",{m:Math.floor(t/O)});if(t<P){const r=Math.floor(t/k),i=Math.floor(t%k/O);return i?o("elHourMin",{h:r,m:i}):o("elHour",{h:r})}const n=Math.floor(t/P),a=Math.floor(t%P/k),s=o(n===1?"elDayOne":"elDays",{d:n});return a?`${s} ${o("elHour",{h:a})}`:s}function Fe(e,t=new Date){const n=te(e,t);if(n===null)return null;const a=ne(n),s=T.includes(e.status),r=s?o(e.status==="cancelled"?"elCancelled":"elHandled",{dur:a}):o("elOpen",{dur:a}),i=s?null:oe({status:e.status,sla:e.sla},t).badge;return{text:r,dur:a,frozen:s,tone:i?.tone??""}}function ut(e,t=new Date){let n=-1;for(const a of e){if(T.includes(a.status))continue;const s=te(a,t);s!==null&&s>n&&(n=s)}return n<0?"":o("elOldest",{dur:ne(n)})}var Ne=Object.defineProperty,Te=Object.getOwnPropertyDescriptor,W=(e,t,n,a)=>{for(var s=a>1?void 0:a?Te(t,n):t,r=e.length-1,i;r>=0;r--)(i=e[r])&&(s=(a?i(t,n,s):i(s))||s);return a&&s&&Ne(t,n,s),s};let z=class extends Q{constructor(){super(...arguments),this.now=new Date,this.off=null}connectedCallback(){super.connectedCallback(),this.now=new Date;const e=ve(t=>this.now=t);this.off=()=>{e()}}disconnectedCallback(){super.disconnectedCallback(),this.off?.(),this.off=null}render(){const e=this.item?Fe(this.item,this.now):null;return e?l`<span class=${e.tone} data-elapsed=${e.frozen?"frozen":"open"} title=${o("elTitle")}>${e.text}</span>`:p}};z.styles=S`
    :host {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
    }
    /* a narrow host (the calendar's week columns) sets --sw-elapsed-wrap: normal and its own --sw-elapsed-fs */
    span {
      font-size: var(--sw-elapsed-fs, var(--sw-fs-base));
      font-variant-numeric: tabular-nums;
      color: var(--dv-text-2);
      white-space: var(--sw-elapsed-wrap, nowrap);
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    span.warn {
      color: var(--au-warn-text);
      font-weight: 600;
    }
    span.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
  `;W([b({attribute:!1})],z.prototype,"item",2);W([J()],z.prototype,"now",2);z=W([Z("ticket-elapsed")],z);const We=3,Ie=["closed","cancelled"],_=e=>!Ie.includes(e.status);function ft(e,t){if(e.view==="limited")return"requester";if(e.manager||e.can?.manage)return"manager";const n=e.department?t?.departments.find(a=>a.id===e.department?.id):void 0;return n?.my_role==="manager"||t?.can.all_departments&&t.can.manage?"manager":n?.my_role==="member"?"handler":t?.can.manage?"manager":"requester"}function Ae(e,t){const n=[];e.priority&&n.push({key:"priority",text:e.priority.name,tone:ee(e.priority)}),e.department&&n.push({key:"department",text:e.department.name,tone:""});const a=t==="manager"||t==="approver";return a&&e.cost?.status==="submitted"&&e.cost.can_decide!==!1&&_(e)?n.push({key:"cost",text:o("lcCostMine"),tone:"warn",icon:"coin"}):a&&e.stuck&&_(e)?n.push({key:"stuck",text:o("lcStuck"),tone:"bad",icon:"warning"}):e.reopen_count>0&&n.push({key:"reopened",text:m("reopenedChip"),tone:"warn",icon:"refresh"}),n.slice(0,We)}function q(e){const t=e.replace(/["'׳״.,()\-]/g," ").split(/\s+/).filter(Boolean),n=a=>[...a].filter(s=>/\p{L}/u.test(s));if(t.length>=2){const a=n(t[0])[0]??"",s=n(t[1])[0]??"";return`${a}${s}`.toUpperCase()}return n(t[0]??"").slice(0,2).join("").toUpperCase()}function Be(e){const t=[];if(e.assignee?.name){const n=e.assignee.kind==="contact";t.push({ini:q(e.assignee.name),name:e.assignee.name,kind:n?"ext":"int",label:o(n?"lcWhoVendor":"lcWhoStaff",{name:e.assignee.name})})}return e.owner?.name&&t.push({ini:q(e.owner.name),name:e.owner.name,kind:"int",label:o("lcWhoOwner",{name:e.owner.name})}),t.filter(n=>n.ini).slice(0,2)}function qe(e,t){if(!_(e))return null;const n=de(e,t);if(n){const a=n.key==="stuck"&&(e.stuck?.level??0)>=2;return{key:n.key,text:n.text,tone:a?"bad":n.tone,icon:"warning"}}if(e.group==="waiting"){const a=Ve(e.waiting_reason);if(a)return{key:"wait",text:a,tone:"warn",icon:"user"}}return null}function Ge(e,t){const n=t.now??new Date;let a=X(e,t.role,n);if(t.board&&e.status==="done"&&e.auto_close_at){const i=Le(e.auto_close_at);i&&a.length+3+i.length<=le&&(a=`${a} · ${i}`)}const s=t.board?qe(e,t.role):null,r=we(e,n,{omitUnassigned:!e.assignee&&(e.status==="new"||/שיוך|assign/i.test(a))});return{sentence:a,chip:ce(e),chips:s?[]:Ae(e,t.role),warning:s,avatars:Be(e),run:{text:r.text,tone:r.tone},urgent:ee(e.priority)==="bad"&&_(e),stuck:!!e.stuck&&_(e)}}function ht(e,t,n,a){const{sla:s,cost:r,...i}=e;return X({...i,cost:e.cost_status&&e.cost_status!=="not_required"?{status:e.cost_status,can_decide:a}:null},t,n)}var je=Object.defineProperty,Ke=Object.getOwnPropertyDescriptor,h=(e,t,n,a)=>{for(var s=a>1?void 0:a?Ke(t,n):t,r=e.length-1,i;r>=0;r--)(i=e[r])&&(s=(a?i(t,n,s):i(s))||s);return a&&s&&je(t,n,s),s};let u=class extends Q{constructor(){super(...arguments),this.bubbleSkin=new ye(this),this.href="",this.timelineHref="",this.fullScreen=!0,this.now=new Date,this.role="manager",this.board=!1,this.picked=!1,this.skeleton=!1,this.menu=!1,this.onOutside=e=>{this.menu&&!e.composedPath().includes(this)&&this.setMenu(!1)},this.onKey=e=>{this.menu&&e.key==="Escape"&&this.setMenu(!1)},this.placeMenu=()=>{if(!this.menu)return;const e=this.renderRoot.querySelector(".pop.ov"),t=this.renderRoot.querySelector("[data-card-menu]");e&&t&&pe(e,t)},this.onMenuKey=e=>{e.key==="Escape"?(e.stopPropagation(),this.setMenu(!1),this.renderRoot.querySelector("[data-card-menu]")?.focus()):ue(e,e.currentTarget)}}connectedCallback(){super.connectedCallback(),ke(this),window.addEventListener("pointerdown",this.onOutside,!0),window.addEventListener("keydown",this.onKey),window.addEventListener("resize",this.placeMenu),window.addEventListener("scroll",this.placeMenu,!0)}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("pointerdown",this.onOutside,!0),window.removeEventListener("keydown",this.onKey),window.removeEventListener("resize",this.placeMenu),window.removeEventListener("scroll",this.placeMenu,!0)}setMenu(e){this.menu=e,this.toggleAttribute("data-menu",e),e&&this.updateComplete.then(()=>this.renderRoot.querySelector(".pop button")?.focus())}updated(){this.placeMenu()}act(e){this.setMenu(!1),this.dispatchEvent(new CustomEvent("card-action",{detail:{item:this.item,action:e},bubbles:!0,composed:!0}))}menuItems(){const e=(t,n,a)=>l`<button type="button" role="menuitem" data-card-action=${t} @click=${()=>this.act(t)}>${f(n)}${a}</button>`;return l`<div class="pop ov" popover="manual" role="menu" aria-label=${m("actions")} @keydown=${this.onMenuKey}>
      ${e("open","eye",m("open"))}
      ${this.fullScreen?e("full","expand",m("fullScreen")):p}
      ${e("copy","link",m("copyLink"))}
    </div>`}renderSkeleton(){const e=t=>l`<span class="skl ln" style=${`inline-size:${t}`}></span>`;return l`<article class="tcard sk" aria-hidden="true" data-card-skeleton>
      <header>
        <div class="ttl">
          <h3>${e("68%")}</h3>
          <div class="where">${f("layers")}${e("42%")}</div>
        </div>
        <div class="ctl"><span class="chip">${e("52px")}</span><span class="more"></span></div>
      </header>
      <p class="stat">${e("92%")}<br />${e("58%")}</p>
      ${this.board?l`<div class="cwarn">${e("64%")}</div>`:l`<div class="chips"><span class="chip">${e("44px")}</span><span class="chip">${e("58px")}</span></div>`}
      <footer>
        <span class="num">${e("32px")}</span>
        <span class="run">${e("72px")}</span>
        <a class="tl" tabindex="-1">${e("56px")}</a>
        <span class="pair"><span class="av"></span><span class="av"></span></span>
      </footer>
    </article>`}render(){if(this.skeleton)return this.renderSkeleton();const e=this.item;if(!e)return p;const t=$e(e),n=Ge(e,{role:this.role,now:this.now,board:this.board}),a=n.chip.tone,s=["closed","cancelled"].includes(e.status);return l`<article class=${`tcard${n.urgent?" urgent":""}${n.stuck?" stuck":""}${s?" closed":""}`} data-ticket=${e.id} data-status=${e.status} aria-label=${e.title}>
      <header>
        <div class="ttl">
          <h3 dir="auto" data-card-title><a class="name" href=${this.href||"#"} title=${e.title} data-card-open>${y(e.title)}</a></h3>
          ${t.strong||t.rest?l`<div class="where">${f("layers")}${t.strong?l`<b>${y(t.strong)}</b>`:p}${t.rest?l`<span>${y(t.rest)}</span>`:p}</div>`:p}
        </div>
        <div class="ctl">
          <span class=${`chip ${a}`} data-card-status aria-label=${n.chip.text}><i class=${`dot ${a==="ok"?"ok":a==="info"?"run":""}`}></i>${n.chip.label}${n.chip.sub?l`<span class="subst"> · ${n.chip.sub}</span>`:p}</span>
          <button type="button" class="more" aria-haspopup="menu" aria-expanded=${String(this.menu)} aria-label=${m("moreOf",{title:e.title})} data-card-menu @click=${()=>this.setMenu(!this.menu)}>${f("dots")}</button>
        </div>
        ${this.menu?this.menuItems():p}
      </header>
      <p class="stat" data-card-sentence title=${n.sentence}>${n.sentence}</p>
      ${n.warning?l`<div class=${`cwarn ${n.warning.tone}`} data-card-warning=${n.warning.key} role="note">${n.warning.icon==="user"?$("hand"):f("warning")}<span>${n.warning.text}</span></div>`:l`<div class="chips" data-card-chips>
            ${n.chips.map(r=>l`<span class=${`chip ${r.tone}`} data-chip=${r.key}>${r.key==="priority"?l`<i class=${`dot ${r.tone==="bad"?"bad":r.tone==="info"?"run":""}`}></i>`:r.icon==="coin"?$("coin"):r.icon==="warning"?f("warning"):r.icon==="refresh"?f("refresh"):p}${r.key==="department"?y(r.text):r.text}</span>`)}
          </div>`}
      <footer>
        <span class="num">#${e.number}</span>
        <span class="run" data-card-run><i class=${`dot ${n.run.tone}`}></i><span>${n.run.text}</span></span>
        <ticket-elapsed .item=${e} data-card-elapsed></ticket-elapsed>
        ${this.timelineHref?l`<a class="tl" href=${this.timelineHref} data-card-timeline>${f("clock")}${m("timelineLink")}</a>`:p}
        ${n.avatars.length?l`<span class="pair" data-card-pair>${n.avatars.map(r=>l`<span class=${`av ${r.kind}`} title=${r.label} role="img" aria-label=${r.label}>${r.ini}</span>`)}</span>`:p}
      </footer>
    </article>`}};u.styles=[ge,...me,xe,He];h([b({attribute:!1})],u.prototype,"item",2);h([b()],u.prototype,"href",2);h([b()],u.prototype,"timelineHref",2);h([b({type:Boolean})],u.prototype,"fullScreen",2);h([b({attribute:!1})],u.prototype,"now",2);h([b()],u.prototype,"role",2);h([b({type:Boolean})],u.prototype,"board",2);h([b({type:Boolean,reflect:!0,attribute:"data-picked"})],u.prototype,"picked",2);h([b({type:Boolean,reflect:!0})],u.prototype,"skeleton",2);h([J()],u.prototype,"menu",2);u=h([Z("ticket-card")],u);const w="tickets",G=encodeURIComponent,R=e=>{const t=new URLSearchParams;for(const[a,s]of Object.entries(e))s!==""&&t.set(a,s);const n=t.toString();return n?`?${n}`:""};async function j(e){const t=await fetch(Oe(e),{credentials:"same-origin"});if(!t.ok){let n={};try{n=await t.json()}catch{n={}}throw new F(t.status,{code:n.code??`http_${t.status}`,user_message:n.user_message??"",retryable:n.retryable??!1,correlation_id:n.correlation_id??"",details:n.details??{}})}return{blob:await t.blob(),headers:t.headers}}const Ue={page:e=>H(`${w}/table${R(e)}`),bulk:e=>A(`${w}/bulk`,e),exportCsv:async e=>{const{blob:t,headers:n}=await j(`${w}/export.csv${R(e)}`),a=n.get("X-Export-Rows"),s=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:a===null?null:Number(a),filename:s||"export.csv"}},monthlyReport:async e=>{const{blob:t,headers:n}=await j(`${w}/reports/monthly.csv${R(e)}`),a=n.get("X-Export-Rows"),s=/filename="?([^";]+)"?/.exec(n.get("Content-Disposition")??"")?.[1];return{blob:t,rows:a===null?null:Number(a),filename:s||"monthly.csv"}},views:()=>H(`${w}/views`),createView:(e,t)=>A(`${w}/views`,{name:e,view:t}),patchView:(e,t)=>Ce(`${w}/views/${G(e)}`,t),deleteView:e=>Se(`${w}/views/${G(e)}`,{method:"DELETE"}),prefs:async()=>(await H("me/prefs")).prefs["tickets.board"]??{},savePrefs:async e=>(await _e("me/prefs",{"tickets.board":e})).prefs["tickets.board"]??{}},Xe=["new","assigned","acknowledged","in_progress","waiting_part","done","returned","closed","cancelled"],Ye={open:["new","assigned","acknowledged","in_progress","waiting_part","done","returned"],unassigned:["new","returned"],handling:["assigned","acknowledged","in_progress","waiting_part"],done:["done"],closed:["closed","cancelled"]},x=[];let E={},Je=0;function K(e,t){switch(t){case"number":return e.number;case"title":return e.title;case"department":return e.department?.name??"";case"priority":return e.priority?.rank??99;case"status":return Xe.indexOf(e.status);case"assignee":return e.assignee?.name??"";case"place":return e.place_text;case"device":return e.device_name;case"created":return e.created_at;case"activity":return e.last_activity_at;case"stuck":return e.stuck?1+e.stuck.level:0;case"sla":return e.sla?.due_at??"9999";case"cost":return e.cost?.total_minor??-1;case"cost_status":return e.cost_status??""}}const Qe={async page(e){const t=await g.list({scope:e.scope||"visible",status:"all",limit:200}),n=!e.status||e.status==="all"?null:Ye[e.status]??e.status.split(","),a=e.department?e.department.split(","):[],s=e.priority?e.priority.split(","):[],r=(e.q??"").trim(),i=[];for(const c of t.items){if(n&&!n.includes(c.status)||a.length&&!a.includes(c.department?.id??"")||s.length&&!s.includes(c.priority?.key??"")||e.assignee==="none"&&c.assignee||e.assignee==="me"&&c.assignee?.id!=="demo"||e.assignee?.includes(":")&&e.assignee!==`${c.assignee?.kind}:${c.assignee?.id}`||e.waiting==="manager"&&c.waiting_on!=="manager"||r&&!c.title.includes(r)&&String(c.number)!==r.replace(/^#/,""))continue;const d=await g.get(c.id),{excerpt:L,...V}=c;if(e.cost_status&&!e.cost_status.split(",").includes(d.cost?.status??""))continue;const C=d.cost?.total_minor!=null&&d.cost.currency?{total_minor:d.cost.total_minor,currency:d.cost.currency,approved:d.cost.status==="approved"||d.cost.status==="paid"}:null;i.push({...V,stuck:null,sla:null,transitions:d.transitions,can:{manage:d.can.manage,assign:d.can.assign,assign_external:!1},cost:C,cost_status:d.cost?.status??null})}const v=(e.sort||"activity:desc").split(",").map(c=>c.split(":"));return i.sort((c,d)=>{for(const[L,V]of v){const C=K(c,L),I=K(d,L);if(C!==I)return(C<I?-1:1)*(V==="desc"?-1:1)}return c.id<d.id?-1:1}),{items:i,next_cursor:null,sort:e.sort||"activity:desc",limit:Number(e.limit||50)}},async bulk(e){const t=[];for(const a of e.items){let s="ok",r;try{const i=await g.get(a.id);if(r=i.number,i.revision!==a.revision)s="stale";else if(e.action==="close")await g.status(a.id,{to:"closed",note:e.params.note,revision:a.revision});else if(e.action==="assign"&&e.params.assignee)await g.assign(a.id,{assignee:e.params.assignee,revision:a.revision});else if(e.action==="priority"){const c=(await g.meta()).departments.find(d=>d.id===i.department?.id)?.priorities.find(d=>d.key===e.params.priority_key);!c||c.id===i.priority?.id?s="unchanged":await g.patch(a.id,{priority_id:c.id,revision:a.revision})}else e.action==="remind"&&!i.assignee&&(s="invalid_transition")}catch(i){s=i instanceof F&&i.status===409?"invalid_transition":"not_found"}t.push({id:a.id,number:r,result:s})}const n={};for(const a of t)n[a.result]=(n[a.result]??0)+1;return{action:e.action,total:e.items.length,done:n.ok??0,counts:n,results:t}},async exportCsv(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"export.csv"}},async monthlyReport(){return{blob:new Blob(["\uFEFF"],{type:"text/csv"}),rows:0,filename:"monthly.csv"}},async views(){return{items:x.map(e=>({...e})),max:20}},async createView(e,t){const n=new Date().toISOString(),a={id:`v${++Je}`,name:e,view:t,created_at:n,updated_at:n};return x.push(a),{...a}},async patchView(e,t){const n=x.find(a=>a.id===e);if(!n)throw new F(404,{code:"view_not_found",user_message:"",retryable:!1,correlation_id:"",details:{}});return Object.assign(n,t.name?{name:t.name}:{},t.view?{view:t.view}:{}),{...n}},async deleteView(e){const t=x.findIndex(n=>n.id===e);t>=0&&x.splice(t,1)},async prefs(){return{...E}},async savePrefs(e){return E={...e},{...E}}};function ae(){return ze()?Ue:Qe}let M=null;function Ze(){return M??=ae().prefs().catch(()=>({})),M}async function bt(e){const n={...await Ze(),...e};for(const a of Object.keys(n))(n[a]===void 0||n[a]===null)&&delete n[a];M=Promise.resolve(n);try{const a=await ae().savePrefs(n);return M=Promise.resolve(a),a}catch{return n}}const et=[{id:"cards",icon:"cardsView",label:"lsView_cards",managerOnly:!1},{id:"table",icon:"tableView",label:"lsView_table",managerOnly:!1},{id:"board",icon:"boardView",label:"lsView_board",managerOnly:!0},{id:"calendar",icon:"calendar",label:"lsView_calendar",managerOnly:!1}];function tt(e){return et.filter(t=>!t.managerOnly||e)}function vt(e,t,n){return l`<div class="seg sm vsw" role="radiogroup" aria-label=${o("lsViewsGroup")} data-view-switch>
    ${tt(t).map(a=>l`<button type="button" role="radio" aria-checked=${String(e===a.id)} aria-label=${o(a.label)} title=${o(a.label)} data-view=${a.id}
      @click=${()=>n(a.id)}>${$(a.icon)}${e===a.id?l`<span class="lbl">${o(a.label)}</span>`:""}</button>`)}
  </div>`}const N="sw.tickets.list.calendar";function wt(){try{return sessionStorage.getItem(N)==="1"}catch{return!1}}function gt(e){try{e?sessionStorage.setItem(N,"1"):sessionStorage.removeItem(N)}catch{}}const nt=["stuck","waiting","cost"],mt={priority:[],handler:"",flags:[]};function at(e){return e.priority.length+(e.handler?1:0)+e.flags.length}function st(e,t){switch(t){case"stuck":return!!e.stuck;case"waiting":return e.waiting_on==="manager"&&!["closed","cancelled"].includes(e.status);case"cost":return e.cost?.status==="submitted"}}function rt(e,t){return t.priority.length&&!(e.priority&&t.priority.includes(e.priority.key))||(t.handler==="none"?B(e.assignee):t.handler&&B(e.assignee)!==t.handler)?!1:t.flags.every(n=>st(e,n))}function xt(e,t){return at(t)?e.filter(n=>rt(n,t)):[...e]}function it(e){const t=n=>n==="waiting"?!0:n==="stuck"?e.some(a=>"stuck"in a):e.some(a=>!!a.cost);return nt.filter(t)}function se(e){const t=new Map;for(const n of e)n.priority&&!t.has(n.priority.key)&&t.set(n.priority.key,{key:n.priority.key,name:n.priority.name,rank:n.priority.rank});return[...t.values()].sort((n,a)=>n.rank-a.rank).map(({key:n,name:a})=>({key:n,name:a}))}function re(e){return Me(e).map(({key:t,name:n})=>({key:t,name:n}))}function U(e,t){return e.includes(t)?e.filter(n=>n!==t):[...e,t]}function yt(e,t,n,a=""){return l`<button type="button" class=${`btn sm filterbtn${e?" on":""}`} aria-expanded=${String(e)} aria-controls="filter-panel" aria-haspopup="dialog"
    aria-label=${t?o("lfBtnCount",{n:t}):o("lfBtn")} data-filter-toggle ?data-filter-btn=${a==="board"} @click=${n}>${f("filter")}<span class="lbl">${o("lfBtn")}</span>${t?l`<span class="n" aria-hidden="true">${t}</span>`:p}</button>`}function kt(e,t){return e.length?l`<div class="achips" role="group" aria-label=${o("tbChips")} data-active-chips>
    ${e.map(n=>l`<button type="button" class="achip" data-active-chip=${n.key} data-assignee-filter=${n.attrs?.["data-assignee-filter"]??p}
      aria-label=${n.attrs?.["aria-label"]??o("tbRemove",{name:n.label})} @click=${n.remove}><span class="t">${n.label}</span>${f("x")}</button>`)}
    ${e.length>1?l`<button type="button" class="areset" data-chips-reset aria-label=${o("tbResetLabel")} @click=${t}>${o("tbReset")}</button>`:p}
  </div>`:p}function D(e,t,n=""){return l`<section class="fsect" data-panel-section=${n||p}><h2 class="fl">${e}</h2>${t}</section>`}function $t(e,t,n,a){return l`<div class="fpop" id="filter-panel" role="dialog" aria-label=${o("tbPanel")} data-filter-panel>
    ${e}
    <div class="ffoot">
      <button type="button" class="btn sm" data-f-reset data-f-clear ?disabled=${!t} @click=${n}>${f("x")}${o("tbResetLabel")}</button>
      <span class="grow"></span>
      <button type="button" class="btn sm" data-f-close @click=${a}>${o("tbClose")}</button>
    </div>
  </div>`}class zt{constructor(t,n,a){this.host=t,this.isOpen=n,this.setOpen=a,this.wasOpen=!1,this.onKey=s=>{if(s.key!=="Escape"||!this.isOpen())return;const r=s.composedPath(),i=this.panel(),v=this.toggle();(i&&r.includes(i)||v&&r.includes(v))&&(s.stopPropagation(),this.setOpen(!1),v?.focus())},this.onOutside=s=>{if(!this.isOpen())return;const r=s.composedPath(),i=this.panel(),v=this.toggle();i&&r.includes(i)||v&&r.includes(v)||r.some(c=>c instanceof HTMLOptionElement)||this.setOpen(!1)},t.addController(this)}hostConnected(){window.addEventListener("pointerdown",this.onOutside,!0),this.host.addEventListener("keydown",this.onKey)}hostDisconnected(){window.removeEventListener("pointerdown",this.onOutside,!0),this.host.removeEventListener("keydown",this.onKey)}hostUpdated(){const t=this.isOpen();t&&this.placeSheet(),t&&!this.wasOpen&&this.panel()?.querySelector("button:not([disabled]), select, input")?.focus({preventScroll:!0}),this.wasOpen=t}placeSheet(){const t=this.panel(),n=this.toggle();if(!t||!n||getComputedStyle(t).position!=="fixed")return;const a=n.closest("[data-toolbar], .tb")??n;t.style.setProperty("--fpop-top",`${Math.ceil(a.getBoundingClientRect().bottom+8)}px`)}root(){return this.host.shadowRoot}panel(){return this.root()?.querySelector("[data-filter-panel]")??null}toggle(){return this.root()?.querySelector("[data-filter-toggle]")??null}}const _t=S`
  .dh-det.tb {
    flex-wrap: nowrap;
    gap: 10px;
    min-inline-size: 0;
    position: relative;
  }
  .tb .search {
    flex: 1 1 220px;
    min-inline-size: 160px;
    max-inline-size: 340px;
  }
  .tb > .seg {
    flex: none;
  }
  .dh-row .pact {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    flex: none;
    margin-inline-start: auto;
  }
  .fanchor {
    position: relative;
    flex: none;
  }
  /* "סינון": a neutral button whose active count is a small accent badge; pressed (open) = the control's pressed look */
  .filterbtn .n {
    display: inline-grid;
    place-items: center;
    min-inline-size: 20px;
    block-size: 20px;
    padding-inline: 6px;
    box-sizing: border-box;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent);
    color: var(--sw-text-inverse);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .filterbtn.on {
    background: var(--dv-surface-3);
    border-color: var(--dv-border-strong);
  }
  /* the active-filter chips: soft accent, the remove mark inside the chip, one quiet reset */
  .achips {
    display: flex;
    align-items: center;
    gap: 6px;
    min-inline-size: 0;
    flex: 0 1 auto;
    overflow: hidden;
  }
  .achip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex: none;
    max-inline-size: 220px;
    min-block-size: 32px;
    padding-inline: 12px 8px;
    border: 1px solid transparent;
    border-radius: var(--sw-r-pill);
    background: var(--dv-accent-soft);
    color: var(--dv-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    transition: transform var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease);
    -webkit-tap-highlight-color: transparent;
  }
  .achip .t {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .achip .ic {
    flex: none;
    inline-size: 14px;
    block-size: 14px;
    opacity: 0.75;
  }
  .achip:active {
    transform: scale(0.97);
  }
  .areset {
    flex: none;
    min-block-size: 32px;
    padding-inline: 8px;
    border: 0;
    background: transparent;
    color: var(--dv-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    cursor: pointer;
    border-radius: var(--sw-r-md);
  }
  @media (hover: hover) and (pointer: fine) {
    .achip:hover {
      border-color: color-mix(in srgb, var(--dv-accent) 40%, transparent);
    }
    .areset:hover {
      color: var(--dv-text);
      text-decoration: underline;
      text-underline-offset: 3px;
    }
  }
  .achip:focus-visible,
  .areset:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 2px;
  }
  /* the panel: opaque, anchored under its button, enters from just above (transform + opacity; zero under reduced motion) */
  .fpop {
    position: absolute;
    inset-block-start: calc(100% + 8px);
    inset-inline-start: 0;
    z-index: 30;
    inline-size: min(560px, calc(100vw - 48px));
    max-block-size: min(70dvh, 560px);
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border-radius: var(--sw-r-2xl);
    border: 1px solid var(--dv-border);
    background: var(--dv-surface-solid);
    box-shadow: var(--dv-shadow-2);
    color: var(--dv-text);
    transform-origin: top;
    transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
  }
  @starting-style {
    .fpop {
      opacity: 0;
      transform: translateY(-4px) scale(0.98);
    }
  }
  .fsect {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-inline-size: 0;
  }
  .fsect .fl {
    margin: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .fchips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .fchips .rc {
    block-size: auto;
    min-block-size: 36px;
    padding-inline: 14px;
    font-size: var(--sw-fs-base);
  }
  .fchips .rc small {
    display: inline-grid;
    place-items: center;
    min-inline-size: 18px;
    block-size: 18px;
    padding-inline: 5px;
    box-sizing: border-box;
    margin-inline-start: 8px;
    border-radius: var(--sw-r-pill);
    background: color-mix(in srgb, var(--dv-text) 8%, transparent);
    color: var(--dv-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  /* a single-choice group (the state) reads as the same chips; the chosen one takes the pressed look */
  .fchips .rc[aria-checked='true'] {
    background: var(--dv-text);
    border-color: transparent;
    color: var(--mm-text-inverse);
    font-weight: 600;
    box-shadow: var(--dv-shadow-control);
  }
  .fchips .rc[aria-pressed='true'] small,
  .fchips .rc[aria-checked='true'] small {
    background: color-mix(in srgb, currentColor 18%, transparent);
    color: inherit;
  }
  .fpop .frow {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
    padding: 0;
    background: none;
    border: 0;
    box-shadow: none;
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
  /* inside the panel the old filter row is a plain stack, not a bubble: no rounded corner for the guard to find text in */
  .fpop .frow {
    border-radius: 0;
  }
  .fpop .frow select {
    inline-size: min(100%, 280px);
    max-inline-size: none;
    min-block-size: 36px;
  }
  .fpop ticket-board-tree {
    max-block-size: 280px;
    overflow-y: auto;
  }
  .ffoot {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-block-start: 12px;
    border-block-start: 1px solid var(--dv-border);
  }
  .ffoot .grow {
    flex: 1;
  }
  @media (max-width: 1279px) {
    /* the label of the active view hides first: the icons keep their names in aria-label and title */
    .dh-row .vsw button .lbl {
      display: none;
    }
  }
  @media (max-width: 767px) {
    .dh-det.tb {
      flex-wrap: wrap;
      gap: 8px;
    }
    .tb > .seg {
      order: 0;
      inline-size: 100%;
      box-sizing: border-box;
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr);
      border-radius: var(--sw-r-xl);
    }
    .tb > .seg button {
      min-block-size: 44px;
      padding-inline: 6px;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .tb .search {
      order: 1;
      flex: 1 1 0;
      min-inline-size: 0;
      max-inline-size: none;
    }
    .tb .fanchor {
      order: 1;
      position: static;
    }
    .tb .filterbtn {
      min-block-size: 44px;
    }
    .tb .filterbtn .lbl {
      display: none;
    }
    .tb .achips {
      order: 2;
      inline-size: 100%;
      flex-wrap: wrap;
      overflow: visible;
    }
    .achip,
    .areset {
      min-block-size: 44px;
    }
    /* on a phone the panel is a bottom sheet over the page, just above the dock (a panel in the sticky header could not scroll and folded
       away with the compacting header); it rises 8 px into place */
    .fpop {
      position: fixed;
      inset-block: auto var(--sw-bottomnav-h);
      inset-inline: 0;
      inline-size: auto;
      /* the sheet stops under the toolbar (--fpop-top, measured by FilterPanelController): the scope, "סינון" and the active chips stay
         reachable while it is open (a sheet over the toolbar swallowed their taps) */
      max-block-size: max(160px, calc(100dvh - var(--sw-bottomnav-h) - var(--fpop-top, 96px)));
      padding: 18px 16px 14px;
      border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0;
      border-block-end: 0;
      z-index: 60;
      transform-origin: bottom;
    }
    @starting-style {
      .fpop {
        opacity: 0;
        transform: translateY(8px);
      }
    }
    .fchips .rc,
    .fpop .frow select {
      min-block-size: 44px;
    }
    .dh-row .pact .newbtn .lbl {
      display: none;
    }
    .dh-row .pact .newbtn {
      min-inline-size: 44px;
      min-block-size: 44px;
      justify-content: center;
    }
  }
`,ie={stuck:"lfStuck",waiting:"lfWaiting",cost:"lfCost"};function St(e,t,n){const a=se(e),s=re(e),r=it(e);return l`<div class="frow" id="filter-row" role="group" aria-label=${o("lfGroup")} data-filter-row>
    ${a.length?D(o("lfPriority"),l`<div class="fchips">
      ${a.map(i=>l`<button type="button" class="rc sm" aria-pressed=${String(t.priority.includes(i.key))} data-f-priority=${i.key} @click=${()=>n({...t,priority:U(t.priority,i.key)})}>${y(i.name)}</button>`)}
    </div>`,"priority"):p}
    ${D(o("lfHandler"),l`<label class="vh" for="f-handler">${o("lfHandler")}</label>
      <select id="f-handler" data-f-handler .value=${t.handler} @change=${i=>n({...t,handler:i.target.value})}>
        <option value="" ?selected=${t.handler===""}>${o("lfAnyHandler")}</option>
        <option value="none" ?selected=${t.handler==="none"}>${o("lfNoHandler")}</option>
        ${s.map(i=>l`<option value=${i.key} ?selected=${t.handler===i.key}>${i.name}</option>`)}
      </select>`,"handler")}
    ${r.length?D(o("tbFlags"),l`<div class="fchips">
      ${r.map(i=>l`<button type="button" class="rc sm" aria-pressed=${String(t.flags.includes(i))} data-f-flag=${i} @click=${()=>n({...t,flags:U(t.flags,i)})}>${i==="stuck"?f("warning"):$(i==="cost"?"coin":"hand")}${o(ie[i])}</button>`)}
    </div>`,"flags"):p}
  </div>`}function Ct(e,t,n){const a=[],s=se(e);for(const r of t.priority)a.push({key:`priority:${r}`,label:`${o("lfPriority")}: ${s.find(i=>i.key===r)?.name??r}`,remove:()=>n({...t,priority:t.priority.filter(i=>i!==r)})});if(t.handler){const r=t.handler==="none"?o("lfNoHandler"):re(e).find(i=>i.key===t.handler)?.name??o("lfHandler");a.push({key:"handler",label:t.handler==="none"?r:`${o("lfHandler")}: ${r}`,remove:()=>n({...t,handler:""})})}for(const r of t.flags)a.push({key:`flag:${r}`,label:o(ie[r]),remove:()=>n({...t,flags:t.flags.filter(i=>i!==r)})});return a}export{zt as F,mt as N,ft as a,Ze as b,wt as c,gt as d,Ct as e,St as f,$t as g,vt as h,yt as i,kt as j,xt as k,o as l,dt as m,_t as n,ut as o,D as p,Be as q,ht as r,bt as s,ae as t,pt as u};
//# sourceMappingURL=list-filter-row-5v1gD8va.js.map
