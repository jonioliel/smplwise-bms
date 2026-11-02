import{E as tt,F as K,G as d,a as et,R as D,A as l,e as a,H as st,j as U,bU as pt,i as ft,oB as At,oC as $t,oD as Jt,oE as Zt,oF as te,oG as Rt,oH as ee,by as se,oI as zt,oJ as ae}from"./index-D0R90ECk.js";import{s as C,a as W,b as P,D as J,d as Z,c as at,m as qt,w as _t,i as A,M as vt,p as rt,g as ie,T as ne,e as I,f as ht,o as yt,h as Ct,j as w,k as G,l as re,n as oe,t as Vt,q as wt,S as Ut,r as X,u as xt,v as le,O as bt,x as ce,y as lt,P as de,A as ut,R as nt,z as pe,B as Ht,C as he,E as St,F as ue,G as me}from"./model-CqUyqSkw.js";import{listUsers as ve,listRoles as be}from"./access-Qh6OjcSr.js";import"./sw-logo-art-Va6y_cIM.js";const Ft=["cal","rooms","approvals","maint","manage"],$={newEvent:"cal-new-event",newMaint:"cal-new-maint",changed:"cal-changed",toast:"cal-toast"};function E(t,e,s){t.dispatchEvent(new CustomEvent(e,{detail:s,bubbles:!0,composed:!0}))}function Mt(t){const e=t.q.trim();return t.cals.filter(s=>(!t.floor||!s.floor_id||s.floor_id===t.floor)&&(!e||s.name.includes(e)))}const Bt={screen:"מסך",projector:"מקרן",video_call:"שיחת וידאו",whiteboard:"לוח",kitchen:"מטבחון",accessible:"נגיש"};function fe(t){const e=[],s=[];return t.forEach(i=>{const n=new Date(i.start).getTime();let r=s.findIndex(o=>o<=n);r<0&&(r=s.length,s.push(0)),s[r]=new Date(i.end).getTime(),e.push(r)}),e}function we(t,e,s,i,n=23){const r=W(e,s)?Math.ceil((s.getHours()*60+s.getMinutes())/15)*15:480;for(let o=r;o+i<=n*60;o+=15){const c=new Date(C(e).getTime()+o*6e4),v=new Date(c.getTime()+i*6e4);for(const m of t){if(!m.open.some(p=>{const[x,y]=p.from.split(":").map(Number),[u,f]=p.to.split(":").map(Number);return o>=x*60+y&&o+i<=u*60+f}))continue;if(!m.entries.some(p=>["confirmed","pending"].includes(p.state)&&new Date(p.start)<v&&new Date(p.end)>c))return{room:m.calendar_id,start:c,end:v}}}return null}const mt={self:"אני",team:"צוות",class:"חוג",customer:"לקוח",department:"מחלקה",vendor:"ספק"};function ge(t,e){if(!(t==="none"||e<2))return`FREQ=${t==="daily"?"DAILY":"WEEKLY"};COUNT=${Math.min(Math.max(e,2),104)}`}function xe(t,e,s){if(t==="none"||e<2)return"פעם אחת";const i=Math.min(Math.max(e,2),104),n=P(s,t==="daily"?i-1:(i-1)*7);return`${t==="daily"?"כל יום":`כל ${J[s.getDay()]}`} עד ${Z(n)} · ${i} מועדים`}function ct(t,e){const s=/^(\d{4})-(\d{2})-(\d{2})$/.exec(t),i=/^(\d{2}):(\d{2})$/.exec(e);return s&&i?new Date(+s[1],+s[2]-1,+s[3],+i[1],+i[2]):null}function Pt(t){return new URLSearchParams(window.location.hash.split("?")[1]??"").get(t)}function gt(t){const[e,s=""]=window.location.hash.split("?"),i=new URLSearchParams(s);for(const[n,r]of Object.entries(t))i.set(n,r);history.replaceState(history.state,"",`${window.location.pathname}${window.location.search}${e}?${i.toString()}`)}function Yt(t,e){const s=t?/^(\d{4})-(\d{2})-(\d{2})$/.exec(t):null;return s?new Date(+s[1],+s[2]-1,+s[3]):C(e)}var $e=Object.defineProperty,ye=Object.getOwnPropertyDescriptor,Y=(t,e,s,i)=>{for(var n=i>1?void 0:i?ye(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&$e(e,s,n),n};const dt=7,Dt=22;let B=class extends et{constructor(){super(...arguments),this.ctx=null,this.mode="month",this.anchor=C(new Date),this.picked=null,this.hiddenCals=new Set,this.occ=[],this.error="",this.switcherOpen=!1,this.dayPage=1,this.cap=3,this.loadedKey="",this.ro=null,this.host=null,this.onChanged=()=>this.reload()}connectedCallback(){super.connectedCallback();const t=Pt("view");this.mode=t==="week"||t==="day"?t:"month",this.anchor=Yt(Pt("date"),this.ctx?.now??new Date);try{const e=sessionStorage.getItem("sw.cal.hidden");e&&(this.hiddenCals=new Set(JSON.parse(e)))}catch{}this.ro=new ResizeObserver(()=>this.fitMonth()),this.host=this.getRootNode().host??null,this.host?.addEventListener($.changed,this.onChanged)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.host?.removeEventListener($.changed,this.onChanged)}updated(){const t=this.renderRoot.querySelector(".mgrid");t&&this.ro&&this.ro.observe(t)}willUpdate(t){(t.has("ctx")||t.has("mode")||t.has("anchor"))&&this.load()}fitMonth(){const t=this.renderRoot.querySelector(".mcell");if(!t)return;const e=Math.max(0,Math.floor((t.clientHeight-52)/23));e!==this.cap&&(this.cap=e)}range(){if(this.mode==="month"){const t=qt(this.anchor);return{from:t[0].day,to:P(t[41].day,1)}}if(this.mode==="week"){const t=_t(this.anchor);return{from:t,to:P(t,7)}}return{from:C(this.anchor),to:P(C(this.anchor),1)}}async load(){const t=this.ctx;if(!t)return;const{from:e,to:s}=this.range(),i=`${e.toISOString()}|${s.toISOString()}|${t.cals.map(n=>n.id).join(",")}`;if(i!==this.loadedKey){this.loadedKey=i;try{const n=await t.api.occurrences(e.toISOString(),s.toISOString());if(this.loadedKey!==i)return;this.occ=n.occurrences.filter(r=>!["cancelled","rejected","withdrawn","expired"].includes(r.state)),this.error=""}catch(n){this.error=D(n)}}}reload(){this.loadedKey="",this.load()}setMode(t){this.mode=t,this.dayPage=1,gt({view:t,date:A(this.anchor)})}go(t){const e=this.anchor;this.anchor=this.mode==="month"?new Date(e.getFullYear(),e.getMonth()+t,1):P(e,this.mode==="week"?t*7:t),this.picked=null,gt({view:this.mode,date:A(this.anchor)})}today(){this.anchor=C(this.ctx?.now??new Date),this.picked=null,gt({view:this.mode,date:A(this.anchor)})}toggle(t){const e=new Set(this.hiddenCals);e.has(t)?e.delete(t):e.add(t),this.hiddenCals=e;try{sessionStorage.setItem("sw.cal.hidden",JSON.stringify([...e]))}catch{}}shownCals(){return Mt(this.ctx).filter(t=>!this.hiddenCals.has(t.id))}shownOcc(){const t=new Set(this.shownCals().map(e=>e.id));return this.occ.filter(e=>t.has(e.calendar_id)||e.room_calendar_ids.some(s=>t.has(s)))}calOf(t){return this.ctx?.cals.find(e=>e.id===t)}rangeTitle(){const t=this.anchor;if(this.mode==="month")return`${vt[t.getMonth()]} ${t.getFullYear()}`;if(this.mode==="week"){const e=_t(t),s=P(e,6);return e.getMonth()===s.getMonth()?`${e.getDate()}–${s.getDate()} ב${vt[e.getMonth()]} ${e.getFullYear()}`:`${e.getDate()}.${rt(e.getMonth()+1)}–${s.getDate()}.${rt(s.getMonth()+1)}.${s.getFullYear()}`}return`${J[t.getDay()]}, ${t.getDate()} ב${vt[t.getMonth()]}`}render(){const t=this.ctx;if(!t)return l;const e=t.device,s=e==="phone"||e==="tablet"&&t.access.ui.tablet_panels==="collapse";return a`
      ${s?l:this.switcher(e==="tablet")}
      <section class="panel main" data-cal-view=${this.mode}>
        ${this.header(s)}
        ${this.error?a`<div class="fail" role="alert" data-cal-error>${this.error}</div>`:l}
        ${this.mode==="month"?this.month():this.week(this.mode==="day")}
      </section>
      ${s&&this.switcherOpen?a`<div class="scrim" @click=${()=>this.switcherOpen=!1}></div>${this.switcher(!1,!0)}`:l}`}header(t){const e=this.shownCals().length;return a`<div class="ph" data-cal-head>
      <span class="big" data-cal-title>${this.rangeTitle()}</span>
      <button type="button" class="btn icon sm" aria-label="הקודם" data-cal-prev @click=${()=>this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <button type="button" class="btn icon sm" aria-label="הבא" data-cal-next @click=${()=>this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
      <button type="button" class="btn sm" data-cal-today @click=${()=>this.today()}>היום</button>
      <span class="sp"></span>
      ${t?a`<button type="button" class="btn sm" data-cal-switcher-open aria-expanded=${String(this.switcherOpen)} @click=${()=>this.switcherOpen=!0}>
        <sw-icon name="calendar" size="16"></sw-icon><span class="num">${e}</span> יומנים</button>`:l}
      <div class="seg" role="group" aria-label="תצוגה">
        ${["month","week","day"].map(s=>a`<button type="button" aria-pressed=${String(this.mode===s)} data-cal-mode=${s} @click=${()=>this.setMode(s)}>${{month:"חודש",week:"שבוע",day:"יום"}[s]}</button>`)}
      </div>
    </div>`}switcher(t,e=!1){const s=this.ctx,i=Mt(s),n=i.filter(r=>!this.hiddenCals.has(r.id)).length;return a`<aside class=${`panel switcher${t&&s.access.ui.tablet_panels==="shrink"?" narrow":""}${e?" overlay":""}`} data-cal-switcher aria-label="יומנים">
      <div class="ph"><h2>יומנים</h2><span class="sp"></span><span class="muted num">${n} מתוך ${i.length}</span>
        ${e?a`<button type="button" class="btn icon sm" aria-label="סגירה" data-cal-switcher-close @click=${()=>this.switcherOpen=!1}><sw-icon name="close" size="16"></sw-icon></button>`:l}</div>
      <div class="list">
        ${ie(i).map(r=>a`<div class="grp">${ne[r.type]}</div>
          ${r.cals.map(o=>a`<button type="button" class="cal-it" style=${`--h:${I(o.color)}`} aria-pressed=${String(!this.hiddenCals.has(o.id))} data-cal-toggle=${o.id} @click=${()=>this.toggle(o.id)}>
            <span class="box"><sw-icon name="check" size="13"></sw-icon></span><span class="ell" title=${o.name}>${o.name}</span>
            ${o.my_role==="view"?a`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>`:l}</button>`)}`)}
      </div></aside>`}month(){const t=this.ctx,e=t.device==="phone",s=qt(this.anchor),i=this.shownOcc(),n=t.now,r=e?0:this.cap,o=this.picked??(this.anchor.getMonth()===n.getMonth()&&this.anchor.getFullYear()===n.getFullYear()?C(n):this.anchor);return a`<div class="month" data-cal-month>
        <div class="mhead">${(e?ht:J).map(c=>a`<div>${c}</div>`)}</div>
        <div class="mgrid">${s.map(({day:c,inMonth:v})=>{const m=yt(i,c),g=m.find(y=>y.kind==="holiday"),h=m.filter(y=>y.kind!=="holiday"),p=c.getDay()>=5,x=W(c,n);return a`<button type="button" class=${`mcell${v?"":" out"}${p?" we":""}${x?" today":""}`} aria-pressed=${String(e&&W(c,o))}
            aria-label=${`${c.getDate()} ב${vt[c.getMonth()]}, ${h.length} אירועים`} data-cal-day=${A(c)} @click=${()=>this.pickDay(c)}>
            <div class="d"><b class="num">${c.getDate()}</b>${g&&!e?a`<span class="ell">${g.title}</span>`:l}</div>
            ${h.slice(0,r).map(y=>this.monthEv(y))}
            ${e?a`<span class="dots">${m.slice(0,4).map(y=>a`<i style=${`--h:${I(this.calOf(y.calendar_id)?.color)}`}></i>`)}</span>`:h.length>r?a`<div class="more">עוד <span class="num">${h.length-r}</span></div>`:l}
          </button>`})}</div>
      </div>
      ${e?this.agenda(o,i):l}`}monthEv(t){const e=this.calOf(t.calendar_id);return a`<span class="ev" data-mark=${Ct(t)} data-flag=${t.sync_flag==="conflict"&&this.ctx?.access.ui.sync_conflict_display!=="list_only"?"conflict":""}
      style=${`--h:${I(e?.color)}`} title=${t.title??"תפוס"}><span class="t num">${w(t.start)}</span><span class="ell">${t.title??"תפוס"}</span></span>`}pickDay(t){if(this.ctx?.device==="phone"){this.picked=t;return}this.anchor=t,this.setMode("day")}agenda(t,e){const s=yt(e,t),i=this.ctx?.now??new Date,n=s.length>3?2:3;return a`<div class="agenda" data-cal-agenda>
      <h3>${W(t,i)?"היום, ":""}${J[t.getDay()]} ${t.getDate()}.${rt(t.getMonth()+1)}</h3>
      ${s.length?s.slice(0,n).map(r=>a`<button type="button" class="row" data-cal-entry=${r.event_id} @click=${()=>this.open(r)}>
          <span class="dot" style=${`--h:${I(this.calOf(r.calendar_id)?.color)}`}></span><b class="num">${r.all_day?"כל היום":w(r.start)}</b>
          <span class="grow ell">${r.title??"תפוס"}</span>${r.state==="pending"?a`<span class="chip dash">ממתין</span>`:r.kind==="maintenance"?a`<span class="chip">תחזוקה</span>`:l}</button>`):a`<span class="muted">אין אירועים ביום הזה.</span>`}
      ${s.length>n?a`<button type="button" class="btn sm" data-cal-agenda-more @click=${()=>{this.anchor=t,this.setMode("day")}}>עוד <span class="num">${s.length-n}</span> · לתצוגת יום</button>`:l}
    </div>`}week(t){const e=this.ctx,s=e.device==="phone",i=e.now,n=this.shownOcc(),r=e.access.ui.sync_conflict_display!=="list_only";let o,c=l;if(t){const h=s?2:e.device==="tablet"?4:6,p=yt(n,this.anchor),x=this.shownCals(),y=[...x.filter(f=>p.some(b=>b.calendar_id===f.id)),...x.filter(f=>!p.some(b=>b.calendar_id===f.id))],u=G(y,this.dayPage,h);o=u.items.map(f=>({key:f.id,day:this.anchor,cal:f})),u.pages>1&&(c=a`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="יומנים קודמים" ?disabled=${u.page<=1} @click=${()=>this.dayPage=u.page-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
          <span class="num">${u.page} / ${u.pages}</span><button type="button" class="btn sm" aria-label="יומנים הבאים" ?disabled=${u.page>=u.pages} @click=${()=>this.dayPage=u.page+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`)}else{const h=_t(this.anchor),p=Array.from({length:7},(u,f)=>P(h,f)),x=Math.min(Math.max(this.anchor.getDay(),1),5);o=(s?p.slice(x-1,x+2):p).map(u=>({key:A(u),day:u}))}const v=Dt-dt,m=Array.from({length:v},(h,p)=>a`<div class="hl" style=${`top:${p/v*100}%`}></div>`),g=(re(i)-dt*60)/(v*60)*100;return a`<div class="week" style=${`--cols:${Math.max(1,o.length)}`} data-cal-week>
        <div></div>
        ${o.map(h=>h.cal?a`<div class="wh cal"><span class="dot" style=${`--h:${I(h.cal.color)}`}></span><b class="ell" title=${h.cal.name}>${h.cal.name}</b></div>`:a`<button type="button" class=${`wh${W(h.day,i)?" today":""}`} @click=${()=>{this.anchor=h.day,this.setMode("day")}}>${s?ht[h.day.getDay()]:J[h.day.getDay()]} <b class="num">${h.day.getDate()}</b></button>`)}
        <div class="axis">${Array.from({length:v},(h,p)=>p%2===0||!s?a`<span class="num" style=${`top:${p/v*100}%`}>${rt(dt+p)}:00</span>`:l)}</div>
        ${o.map(h=>{const p=h.cal?n.filter(f=>f.calendar_id===h.cal?.id||f.room_calendar_ids.includes(h.cal?.id??"")):n,x=oe(p,h.day,dt,Dt),y=yt(p,h.day).filter(f=>f.all_day||f.kind==="holiday"),u=!h.cal&&(h.day.getDay()===6||y.length>0);return a`<div class=${`col${u?" we":""}`} data-cal-col=${h.key} @click=${f=>this.newAt(f,h.day,h.cal)}>
            ${m}
            ${y.length?a`<div class="allday ell">${y[0].title}</div>`:l}
            ${x.map(f=>{const b=r&&f.o.sync_flag==="conflict",j=100/f.lanes;return a`<button type="button" class="ev" data-mark=${Ct(f.o)} data-flag=${b?"conflict":""} data-cal-entry=${f.o.event_id}
                style=${`--h:${I(this.calOf(f.o.calendar_id)?.color)};top:${f.top}%;height:${f.height}%;inset-inline-start:calc(${f.lane*j}% + 3px);inline-size:calc(${j}% - 6px)`}
                title=${b?"התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו, מחכה להחלטה":`${f.o.title??"תפוס"} · ${w(f.o.start)}–${w(f.o.end)}`}
                @click=${it=>{it.stopPropagation(),this.open(f.o)}}>
                <b>${b?a`<sw-icon name="warning" size="13"></sw-icon>`:l}<span class="ell">${f.o.title??"תפוס"}</span></b>
                ${f.height>6?a`<span class="tm num ell ltr">${w(f.o.start)}–${w(f.o.end)}</span>`:l}</button>`})}
            ${W(h.day,i)&&g>0&&g<100?a`<div class="now" style=${`top:${g}%`}></div>`:l}
          </div>`})}
      </div>${c}`}newAt(t,e,s){if(!this.ctx?.access.can.book)return;const r=t.currentTarget.getBoundingClientRect(),o=Math.min(Math.max((t.clientY-r.top)/r.height,0),1),c=Math.floor((dt*60+o*(Dt-dt)*60)/30)*30,v=new Date(C(e).getTime()+c*6e4),m=new Date(v.getTime()+60*6e4);E(this,$.newEvent,{calendarId:s&&s.my_role&&s.my_role!=="view"?s.id:void 0,start:v.toISOString(),end:m.toISOString()})}open(t){E(this,$.newEvent,{eventId:t.event_id})}};B.styles=[at,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .switcher { inline-size: 270px; flex: none; gap: 2px; }
    .switcher.narrow { inline-size: 210px; }
    .switcher .grp { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); margin: 8px 4px 2px; }
    .switcher .list { min-block-size: 0; overflow: hidden; display: flex; flex-direction: column; gap: 1px; }
    .cal-it { display: flex; align-items: center; gap: 10px; min-block-size: 32px; padding-inline: 8px; border-radius: var(--sw-r-md); font: inherit; font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold); color: var(--sw-text); background: transparent; border: 0; cursor: pointer; text-align: start; inline-size: 100%; -webkit-tap-highlight-color: transparent; flex: none; }
    .cal-it .box { inline-size: 18px; block-size: 18px; border-radius: var(--sw-r-xs); flex: none; display: grid; place-items: center; box-shadow: inset 0 0 0 2px var(--h); color: var(--sw-text-inverse); }
    .cal-it[aria-pressed='true'] .box { background: var(--h); }
    .cal-it[aria-pressed='false'] { color: var(--sw-text-2); }
    .cal-it[aria-pressed='false'] .box sw-icon { visibility: hidden; }
    .cal-it .lock { margin-inline-start: auto; color: var(--sw-text-3); display: inline-flex; }
    @media (hover: hover) { .cal-it:hover { background: var(--sw-hover-wash); } }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    .switcher.overlay { position: fixed; inset-block: 12px; inset-inline-end: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(300px, calc(100vw - 24px)); }
    .month { flex: 1; min-block-size: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .mhead, .mgrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .mhead div { padding: 0 8px 6px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); }
    .mgrid { grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 3px; min-block-size: 0; }
    .mcell { background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 6px 6px 4px; display: flex; flex-direction: column; gap: 3px; min-block-size: 0; min-inline-size: 0;
      overflow: hidden; border: 0; font: inherit; text-align: start; cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
    .mcell.we { background: var(--sw-surface-3); }
    .mcell.out { opacity: 0.5; }
    .mcell .d { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); display: flex; align-items: center; gap: 6px; min-block-size: 22px; min-inline-size: 0; }
    .mcell.today .d b { background: var(--sw-accent); color: var(--sw-text-inverse); border-radius: var(--sw-r-pill); min-inline-size: 24px; block-size: 22px; display: inline-grid; place-items: center; padding-inline: 6px; }
    .mcell[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mcell .ev { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); block-size: 20px; line-height: 20px; padding: 0 6px; display: flex; gap: 5px; align-items: center; flex: none; inline-size: 100%; }
    .mcell .ev .t { font-weight: var(--sw-fw-bold); flex: none; }
    .mcell .more { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); padding-inline: 6px; }
    .dots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
    .dots i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--h); }
    .week { flex: 1; min-block-size: 0; display: grid; grid-template-columns: 52px repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: auto minmax(0, 1fr); column-gap: 3px; }
    .wh { padding: 0 6px 8px; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: baseline; min-inline-size: 0;
      border: 0; background: transparent; font-family: inherit; cursor: pointer; text-align: start; }
    .wh b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .wh.today b { color: var(--sw-accent-text); }
    .wh.cal { align-items: center; cursor: default; }
    .wh.cal b { font-size: var(--sw-fs-lg); }
    .axis { position: relative; }
    .axis span { position: absolute; inset-inline-end: 6px; transform: translateY(-50%); font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .axis span:first-child { transform: none; }
    .col { position: relative; background: var(--sw-surface-2); border-radius: var(--sw-r-md); min-block-size: 0; cursor: copy; overflow: hidden; }
    .col.we { background: var(--sw-surface-3); }
    .col .hl { position: absolute; inset-inline: 0; block-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .col .ev { position: absolute; padding: 3px 6px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); line-height: 1.3; z-index: 1; }
    .col .ev b { display: flex; gap: 4px; align-items: center; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .col .ev .tm { display: block; font-variant-numeric: tabular-nums; }
    .col .ev[data-flag='conflict'] sw-icon { color: var(--sw-danger-text); flex: none; }
    .col .allday { position: absolute; inset: 8px 8px auto; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); pointer-events: none; }
    .now { position: absolute; inset-inline: 0; block-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .now::before { content: ''; position: absolute; inset-inline-end: -1px; inset-block-start: -4px; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .agenda { display: flex; flex-direction: column; gap: 6px; min-block-size: 0; overflow: hidden; }
    .agenda h3 { margin: 4px 0 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .agenda .row { min-block-size: 44px; border: 0; font: inherit; text-align: start; cursor: pointer; inline-size: 100%; flex: none; }
    .agenda .row b { color: var(--sw-heading); }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 699px) {
      :host { flex-direction: column; }
      .panel { padding: 12px; gap: 10px; }
      .big { font-size: var(--sw-fs-xl); }
      .ph { gap: 6px; }
      .month { flex: none; block-size: 262px; }
      .mhead div { padding: 0 0 4px; text-align: center; }
      .mcell { padding: 3px; border-radius: var(--sw-r-sm); align-items: center; gap: 2px; }
      .mcell .d { justify-content: center; min-block-size: 20px; }
      .week { grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); }
      .wh b { font-size: var(--sw-fs-xl); }
    }
  `];Y([K({attribute:!1})],B.prototype,"ctx",2);Y([d()],B.prototype,"mode",2);Y([d()],B.prototype,"anchor",2);Y([d()],B.prototype,"picked",2);Y([d()],B.prototype,"hiddenCals",2);Y([d()],B.prototype,"occ",2);Y([d()],B.prototype,"error",2);Y([d()],B.prototype,"switcherOpen",2);Y([d()],B.prototype,"dayPage",2);Y([d()],B.prototype,"cap",2);B=Y([st("cal-view-calendar")],B);var ke=Object.defineProperty,ze=Object.getOwnPropertyDescriptor,N=(t,e,s,i)=>{for(var n=i>1?void 0:i?ze(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&ke(e,s,n),n};const Ot=[0,6,10,20,50];let q=class extends et{constructor(){super(...arguments),this.ctx=null,this.day=C(new Date),this.rooms=null,this.error="",this.capacity=0,this.equipment=new Set,this.eqOpen=!1,this.page=1,this.per=8,this.shift=0,this.free=void 0,this.loadedKey="",this.ro=null,this.host=null,this.onChanged=()=>{this.loadedKey="",this.load()}}connectedCallback(){super.connectedCallback(),this.day=Yt(Pt("date"),this.ctx?.now??new Date),this.ro=new ResizeObserver(()=>this.fit()),this.host=this.getRootNode().host??null,this.host?.addEventListener($.changed,this.onChanged)}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),this.host?.removeEventListener($.changed,this.onChanged)}updated(){const t=this.renderRoot.querySelector(".tl");t&&this.ro&&this.ro.observe(t)}willUpdate(t){(t.has("ctx")||t.has("day"))&&this.load()}fit(){const t=this.renderRoot.querySelector(".tl");if(!t)return;const e=(this.ctx?.device==="phone"?56:52)+6,s=Math.max(1,Math.floor((t.clientHeight-32)/e));s!==this.per&&(this.per=s)}async load(){const t=this.ctx;if(!t)return;const e=`${A(this.day)}|${t.cals.map(s=>s.id).join(",")}`;if(e!==this.loadedKey){this.loadedKey=e;try{const s=await t.api.roomsDay(A(this.day));if(e!==this.loadedKey)return;this.rooms=s.rooms,this.error=""}catch(s){this.error=D(s)}}}go(t){this.day=P(this.day,t),this.free=void 0,gt({date:A(this.day)})}calOf(t){return this.ctx?.cals.find(e=>e.id===t)}filtered(){const t=this.ctx,e=new Set(Mt(t).map(s=>s.id));return(this.rooms??[]).filter(s=>e.has(s.calendar_id)&&(!this.capacity||(s.capacity??0)>=this.capacity)&&[...this.equipment].every(i=>s.equipment.includes(i)))}findFree(){const t=this.ctx,e=this.filtered().filter(s=>{const i=this.calOf(s.calendar_id);return i?.my_role&&i.my_role!=="view"});if(this.free=we(e,this.day,t.now,60),this.free){const s=this.filtered().findIndex(i=>i.calendar_id===this.free?.room);this.page=Math.floor(s/this.per)+1}}book(t,e,s){E(this,$.newEvent,{calendarId:t,start:e.toISOString(),end:s.toISOString()})}render(){const t=this.ctx;if(!t)return l;const e=t.device==="phone",s=Vt(e,t.now),i=e?{from:Math.min(Math.max(s.from+this.shift,0),18),to:Math.min(Math.max(s.from+this.shift,0),18)+6}:s,n=this.filtered(),r=G(n,this.page,this.per),o=W(this.day,t.now),c=e?`${J[this.day.getDay()]}, ${this.day.getDate()}.${rt(this.day.getMonth()+1)}`:`${J[this.day.getDay()]}, `;return a`<section class="panel main" data-cal-rooms>
      <div class="ph">
        <span class="big" data-cal-title>${e?c:a`${c}<b>${this.day.getDate()}</b> ב${vt[this.day.getMonth()]}`}</span>
        <button type="button" class="btn icon sm" aria-label="יום קודם" data-cal-prev @click=${()=>this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <button type="button" class="btn icon sm" aria-label="יום הבא" data-cal-next @click=${()=>this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
        ${e?a`<button type="button" class="btn sm num ltr" data-cal-window aria-label="חלון השעות" @click=${()=>this.shift=this.shift>=6?-6:this.shift+3}>${rt(i.from)}:00–${rt(i.to%24)}:00</button>`:o?l:a`<button type="button" class="btn sm" data-cal-today @click=${()=>{this.day=C(t.now),gt({date:A(this.day)})}}>היום</button>`}
        <span class="sp"></span>
        ${e?l:a`
          <button type="button" class="btn sm" data-cal-capacity aria-pressed=${String(this.capacity>0)} @click=${()=>this.nextCapacity()}><sw-icon name="users" size="16"></sw-icon>${this.capacity?a`<span class="num">${this.capacity}+</span> מקומות`:"כל הקיבולות"}</button>
          <button type="button" class="btn sm" data-cal-equipment aria-pressed=${String(this.equipment.size>0)} aria-expanded=${String(this.eqOpen)} @click=${()=>this.eqOpen=!this.eqOpen}><sw-icon name="filter" size="16"></sw-icon>ציוד${this.equipment.size?a` <span class="num">${this.equipment.size}</span>`:l}</button>`}
        <button type="button" class="btn sm" data-cal-find @click=${()=>this.findFree()}><sw-icon name="search" size="16"></sw-icon>${e?"חדר פנוי":"מצא חדר פנוי"}</button>
      </div>
      ${this.eqOpen?this.equipmentPop():l}
      ${this.error?a`<div class="fail" role="alert">${this.error}</div>`:l}
      ${this.free===null?a`<div class="found" role="status" data-cal-free-none>אין היום חדר פנוי לשעה אחת שמתאים לסינון.</div>`:l}
      ${this.rooms&&!n.length?a`<sw-state-panel icon="calendar" state="empty" data-cal-rooms-empty heading=${this.rooms.length?"אין חדר שמתאים לסינון":"אין חדרים להזמנה"}
            hint=${this.rooms.length?"אפשר לשנות את הקיבולת או את הציוד.":'חדר הוא יומן מסוג "חדר": קיבולת, ציוד, שעות פתיחה ואישור.'}></sw-state-panel>`:this.timeline(r.items,i,o)}
      ${r.pages>1?a`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="חדרים קודמים" ?disabled=${r.page<=1} @click=${()=>this.page=r.page-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <span class="num">${r.page} / ${r.pages}</span><button type="button" class="btn sm" aria-label="חדרים הבאים" ?disabled=${r.page>=r.pages} @click=${()=>this.page=r.page+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`:l}
      ${e?l:this.legend()}
    </section>`}nextCapacity(){const t=Ot.indexOf(this.capacity);this.capacity=Ot[(t+1)%Ot.length],this.page=1}equipmentPop(){return a`<div class="pop" role="group" aria-label="ציוד" data-cal-equipment-pop>
      ${Object.keys(Bt).map(t=>a`<label><input type="checkbox" .checked=${this.equipment.has(t)} @change=${()=>{const e=new Set(this.equipment);e.has(t)?e.delete(t):e.add(t),this.equipment=e,this.page=1}}>${Bt[t]}</label>`)}
      <button type="button" class="btn sm" @click=${()=>this.eqOpen=!1}>סגירה</button></div>`}timeline(t,e,s){const i=this.ctx,n=i.device==="phone",r=e.to-e.from,o=s?(i.now.getHours()*60+i.now.getMinutes()-e.from*60)/(r*60)*100:-1,c=o>0&&o<100,v=Array.from({length:r+1},(m,g)=>{const h=g/r*100;return c&&Math.abs(h-o)<(n?9:3)?l:a`<span class=${`num${g===0?" first":g===r?" last":""}`} style=${`left:${h}%`}>${rt((e.from+g)%24)}${n?"":":00"}</span>`});return a`<div class="tl" data-cal-timeline>
      <div class="tl-row head"><div></div><div class="tl-axis">${v}${c?a`<span class="tl-nowlab num" style=${`left:${o}%`}>${w(i.now)}</span>`:l}</div></div>
      <div class="rows">${t.map(m=>this.row(m,e,c?o:-1))}</div>
    </div>`}row(t,e,s){const n=this.ctx.device==="phone",r=this.calOf(t.calendar_id),o=e.to-e.from,c=Array.from({length:o-1},(b,j)=>a`<div class="hl" style=${`left:${(j+1)/o*100}%`}></div>`),v=b=>{const[j,it]=b.split(":").map(Number);return Math.min(100,Math.max(0,(j*60+it-e.from*60)/(o*60)*100))},m=t.open.map(b=>[v(b.from),v(b.to)]).sort((b,j)=>b[0]-j[0]),g=[];let h=0;for(const[b,j]of m)b>h&&g.push([h,b]),h=Math.max(h,j);h<100&&g.push([h,100]);const p=t.entries.filter(b=>!["cancelled","rejected","withdrawn","expired"].includes(b.state)).sort((b,j)=>b.start.localeCompare(j.start)),x=fe(p),y=Math.max(1,...x.map(b=>b+1)),u=this.free&&this.free.room===t.calendar_id?wt({start:this.free.start.toISOString(),end:this.free.end.toISOString()},this.day,e.from,e.to):null,f=[`${t.capacity??"-"} מקומות`,n?"":r?.floor_name??"",!n&&r&&r.approval_mode!=="none"?"באישור":""].filter(Boolean).join(" · ");return a`<div class="tl-row" data-cal-room=${t.calendar_id}>
      <div class="tl-room"><span class="dot" style=${`--h:${I(r?.color)}`}></span>
        <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${f}</div></div>
        ${r?.my_role==="view"?a`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>`:l}</div>
      <div class="tl-track" @click=${b=>this.trackClick(b,t,e)}>
        ${g.filter(([b,j])=>j>b).map(([b,j])=>a`<div class="closed" style=${`left:${b}%;width:${j-b}%`}></div>`)}
        ${c}
        ${p.map((b,j)=>{const it=wt(b,this.day,e.from,e.to);if(!it)return l;const Lt=100/y,Xt=`calc(${x[j]*Lt}% + ${y>1?3:7}px)`,Gt=`calc(${Lt}% - ${y>1?6:14}px)`,kt=Ct(b),jt=b.state==="pending"?"ממתין לאישור":kt==="displaced"?"נדחק בגלל תחזוקה":b.on_behalf_label?`בשם: ${b.on_behalf_label}`:b.organizer?.name??"",Qt=it.width>(n?30:8)&&y===1;return a`<button type="button" class="ev" data-mark=${kt} data-cal-entry=${b.event_id} style=${`--h:${I(kt==="maint"?"orange":r?.color)};left:${it.start}%;width:${it.width}%;top:${Xt};height:${Gt}`}
            title=${`${b.title??"תפוס"} · ${w(b.start)}–${w(b.end)}`} @click=${Wt=>{Wt.stopPropagation(),E(this,$.newEvent,{eventId:b.event_id})}}>
            <b>${b.title??"תפוס"}</b>${Qt&&jt?a`<small>${jt}</small>`:l}</button>`})}
        ${u?a`<button type="button" class="tl-free" data-cal-free style=${`left:${u.start}%;width:${u.width}%`} @click=${b=>{b.stopPropagation(),this.book(t.calendar_id,this.free.start,this.free.end)}}>
          פנוי · <span class="num">${w(this.free.start)}</span></button>`:l}
        ${s>0?a`<div class="tl-now" style=${`left:${s}%`}></div>`:l}
      </div></div>`}trackClick(t,e,s){const i=this.calOf(e.calendar_id);if(!this.ctx?.access.can.book||!i?.my_role||i.my_role==="view")return;const r=t.currentTarget.getBoundingClientRect(),o=Math.min(Math.max((t.clientX-r.left)/r.width,0),1),c=Math.floor((s.from*60+o*(s.to-s.from)*60)/30)*30,v=new Date(C(this.day).getTime()+c*6e4);this.book(e.calendar_id,v,new Date(v.getTime()+60*6e4))}legend(){return a`<div class="legend" data-cal-legend>
      <span><i class="ev" style="--h:var(--cal-blue)"></i>מאושר</span>
      <span><i class="ev" data-mark="pending" style="--h:var(--cal-blue)"></i>ממתין לאישור</span>
      <span><i class="ev" data-mark="maint"></i>תחזוקה</span>
      <span><i class="ev" data-mark="displaced"></i>נדחק בגלל תחזוקה</span>
      <span><i class="closed" data-k="closed"></i>סגור</span>
    </div>`}};q.styles=[at,tt`
    :host { display: flex; min-block-size: 0; min-inline-size: 0; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; }
    .big b { font-variant-numeric: tabular-nums; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .tl-row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 10px; min-block-size: 0; }
    .tl-row.head { block-size: 26px; flex: none; }
    .rows { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .rows .tl-row { flex: 1 1 0; max-block-size: 86px; min-block-size: 52px; }
    .tl-room { display: flex; align-items: center; gap: 10px; padding-inline: 12px; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); min-inline-size: 0; }
    .tl-room .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .tl-room .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .tl-room .lock { color: var(--sw-text-3); display: inline-flex; }
    .tl-track { position: relative; direction: ltr; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); overflow: hidden; cursor: copy; }
    .tl-track .closed { position: absolute; inset-block: 0; opacity: 0.9; pointer-events: none; }
    .tl-track .hl { position: absolute; inset-block: 0; inline-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .tl-track .ev { position: absolute; padding: 3px 8px; direction: rtl; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.25; display: flex; flex-direction: column;
      justify-content: center; z-index: 1; }
    .tl-track .ev b { font-size: var(--sw-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tl-track .ev small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--sw-fs-xs); }
    .tl-axis { position: relative; direction: ltr; block-size: 26px; }
    .tl-axis span { position: absolute; transform: translateX(-50%); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); top: 4px; }
    .tl-axis span.first { transform: none; }
    .tl-axis span.last { transform: translateX(-100%); }
    .tl-now { position: absolute; inset-block: 0; inline-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .tl-nowlab { position: absolute; top: 2px; line-height: 18px; transform: translateX(-50%); background: var(--sw-accent); color: var(--sw-text-inverse); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-pill); padding: 1px 7px; z-index: 3; }
    .tl-free { position: absolute; inset-block: 7px; border-radius: var(--sw-r-xs); outline: 1.5px dashed var(--sw-accent); outline-offset: -1.5px; background: var(--sw-accent-soft);
      color: var(--sw-accent-text); display: grid; place-items: center; font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); direction: rtl; z-index: 2; border: 0; font-family: inherit;
      cursor: pointer; white-space: nowrap; overflow: hidden; }
    .legend { flex: none; }
    .legend i[data-k='closed'] { box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .pop { position: absolute; z-index: calc(var(--sw-z-drawer) + 1); inset-block-start: 56px; inset-inline-end: 16px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 8px; display: grid; gap: 2px; min-inline-size: 200px; }
    .pop label { display: flex; gap: 8px; align-items: center; min-block-size: 34px; padding-inline: 8px; border-radius: var(--sw-r-sm); font-size: var(--sw-fs-md); cursor: pointer; }
    .pop label:hover { background: var(--sw-hover-wash); }
    .btn[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .found { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    @media (max-width: 1179px) { .tl-row { grid-template-columns: 200px minmax(0, 1fr); } }
    @media (max-width: 699px) {
      .panel { padding: 12px; gap: 8px; }
      .big { font-size: var(--sw-fs-xl); }
      .tl-row { grid-template-columns: 112px minmax(0, 1fr); gap: 6px; }
      .tl-room { padding-inline: 8px; gap: 6px; }
      .tl-room .name { font-size: var(--sw-fs-md); }
      .tl-room .dot { display: none; }
      .rows .tl-row { min-block-size: 56px; }
    }
  `];N([K({attribute:!1})],q.prototype,"ctx",2);N([d()],q.prototype,"day",2);N([d()],q.prototype,"rooms",2);N([d()],q.prototype,"error",2);N([d()],q.prototype,"capacity",2);N([d()],q.prototype,"equipment",2);N([d()],q.prototype,"eqOpen",2);N([d()],q.prototype,"page",2);N([d()],q.prototype,"per",2);N([d()],q.prototype,"shift",2);N([d()],q.prototype,"free",2);q=N([st("cal-view-rooms")],q);var _e=Object.defineProperty,Se=Object.getOwnPropertyDescriptor,O=(t,e,s,i)=>{for(var n=i>1?void 0:i?Se(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&_e(e,s,n),n};let z=class extends et{constructor(){super(...arguments),this.ctx=null,this.detail=null,this.calId="",this.evTitle="",this.date="",this.from="",this.to="",this.repeat="none",this.count=9,this.behalf="self",this.behalfLabel="",this.headcount="",this.guestName="",this.guestPhone="",this.dayOcc=[],this.preview=null,this.error="",this.suggestions=[],this.busy=!1,this.event=null,this.confirmCancel=!1,this.retention=null,this.guestKinds=["customer","class"],this.previewTimer=0,this.dayKey="",this.onKey=t=>{t.key==="Escape"&&this.close()}}connectedCallback(){super.connectedCallback(),document.addEventListener("keydown",this.onKey);const t=this.detail??{};if(t.eventId){this.loadEvent(t.eventId);return}const s=this.ctx?.now??new Date,i=this.bookable().find(o=>o.id===t.calendarId)??this.defaultCal();this.calId=i?.id??"";const n=t.start?new Date(t.start):new Date(Math.ceil(s.getTime()/(30*6e4))*30*6e4),r=t.end?new Date(t.end):new Date(n.getTime()+60*6e4);this.date=A(n),this.from=w(n),this.to=w(r),this.loadSettings()}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("keydown",this.onKey),clearTimeout(this.previewTimer)}firstUpdated(){this.renderRoot.querySelector('[data-cal-field="title"]')?.focus({preventScroll:!0})}willUpdate(t){this.event||this.detail?.eventId||(["calId","date","from","to","repeat","count","behalf","headcount"].some(e=>t.has(e))&&this.schedulePreview(),(t.has("calId")||t.has("date"))&&this.loadDay())}bookable(){return(this.ctx?.cals??[]).filter(t=>!t.archived&&t.my_role&&t.my_role!=="view"&&t.type!=="maintenance")}defaultCal(){const t=this.bookable();return t.find(e=>e.type==="room"&&e.my_role==="manage")??t.find(e=>e.type==="room")??t[0]}cal(){return this.ctx?.cals.find(t=>t.id===this.calId)}async loadSettings(){try{const{settings:t}=await this.ctx.api.settings();this.retention=t.guest_retention_days,this.guestKinds=t.guest_details_kinds?.length?t.guest_details_kinds:this.guestKinds}catch{}}async loadEvent(t){try{this.event=(await this.ctx.api.event(t)).event}catch(e){this.error=D(e)}}async loadDay(){const t=this.ctx,e=ct(this.date,"00:00");if(!t||!e||!this.calId)return;const s=`${this.calId}|${this.date}`;if(s!==this.dayKey){this.dayKey=s;try{const i=await t.api.occurrences(e.toISOString(),P(e,1).toISOString(),[this.calId]);s===this.dayKey&&(this.dayOcc=i.occurrences.filter(n=>["confirmed","pending"].includes(n.state)))}catch{this.dayOcc=[]}}}body(){const t=ct(this.date,this.from),e=ct(this.date,this.to);if(!t||!e||!this.calId)return null;const s=this.ctx,i={calendar_id:this.calId,kind:"booking",title:this.evTitle.trim(),start:t.toISOString(),end:e.toISOString()},n=ge(this.repeat,this.count);n&&(i.rrule=n),s.access.can.book_for_others&&this.behalf!=="self"&&(i.on_behalf={kind:this.behalf,label:this.behalfLabel.trim()});const r=parseInt(this.headcount,10);return r>0&&(i.headcount=r),this.guestsOffered()&&(this.guestName.trim()||this.guestPhone.trim())&&(i.guests=[{name:this.guestName.trim(),phone:this.guestPhone.trim()}]),i}guestsOffered(){const t=this.ctx;return t.access.ui.guest_details_enabled&&t.access.can.book_for_others&&this.behalf!=="self"&&this.guestKinds.includes(this.behalf)}schedulePreview(){clearTimeout(this.previewTimer),this.previewTimer=window.setTimeout(()=>void this.runPreview(),250)}async runPreview(){const t=this.body();if(!t||new Date(t.end)<=new Date(t.start)){this.preview=null;return}try{this.preview=await this.ctx.api.previewEvent({...t,title:t.title||"בדיקה"})}catch{this.preview=null}}close(){this.dispatchEvent(new Event("close"))}problem(){const t=ct(this.date,this.from),e=ct(this.date,this.to);return this.calId?this.evTitle.trim()?!t||!e?"חסר תאריך או שעה.":e<=t?"שעת הסיום לפני שעת ההתחלה.":this.behalf!=="self"&&!this.behalfLabel.trim()?`חסר שם ה${mt[this.behalf]}.`:"":"חסרה כותרת.":"אין יומן שאפשר להזמין בו."}async submit(){const t=this.problem();if(t){this.error=t;return}const e=this.body();this.busy=!0,this.error="",this.suggestions=[];try{const s=await this.ctx.api.createEvent(e);E(this,$.changed),E(this,$.toast,s.state==="pending"?"הבקשה נשלחה לאישור":"ההזמנה נשמרה"),this.close()}catch(s){this.error=D(s),s instanceof U&&Array.isArray(s.body.details.suggestions)&&(this.suggestions=s.body.details.suggestions.slice(0,3))}finally{this.busy=!1}}take(t){const e=new Date(t.start);this.date=A(e),this.from=w(e),this.to=w(t.end),this.suggestions=[],this.error=""}render(){if(!this.ctx)return l;const e=!!this.detail?.eventId;return a`<div class="scrim" @click=${()=>this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-labelledby="h" data-cal-drawer=${e?"event":"new"}>
        ${e?this.viewEvent():this.form()}
      </aside>`}viewEvent(){const t=this.ctx,e=this.event,s=e?t.cals.find(r=>r.id===e.calendar_id):void 0,i=!!e&&e.can.cancel&&["confirmed","displaced"].includes(e.state),n=!!e&&e.state==="pending"&&(e.can.cancel||e.can.edit);return a`<header><div><h2 id="h" class="ell">${e?e.title??"תפוס":"טוען…"}</h2>${s?a`<div class="muted">${s.name}</div>`:l}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${e?a`<dl>
          <dt>מתי</dt><dd class="num">${X(e.start,e.end,t.now).split(" · ")[0]} · <span class="ltr">${w(e.start)}–${w(e.end)}</span>${e.recurring?" · חוזר":""}</dd>
          <dt>מצב</dt><dd><span class=${`chip ${e.state==="confirmed"?"ok":e.state==="pending"?"dash":e.state==="displaced"?"warn":""}`}>${Ut[e.state]}</span>${e.contested?a` <span class="chip warn">מתחרה על החלון</span>`:l}</dd>
          ${e.organizer?a`<dt>מארגן</dt><dd>${e.organizer.name}</dd>`:l}
          ${e.on_behalf_label?a`<dt>בשם</dt><dd>${e.on_behalf_label}</dd>`:l}
          ${e.headcount?a`<dt>משתתפים</dt><dd class="num">${e.headcount}</dd>`:l}
          ${e.notes?a`<dt>הערות</dt><dd>${e.notes}</dd>`:l}
        </dl>
        ${e.sync_flag?a`<div class="note bad" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>מסומן להחלטה</b><span class="muted">${e.sync_flag==="conflict"?"התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו. ההחלטה בהגדרות ‹ חיבורי יומן.":"האירוע נמחק ביומן החיצוני."}</span></div></div>`:l}
        ${e.state==="displaced"?a`<div class="note warn" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>ההזמנה נדחקה בגלל תחזוקה</b><span class="muted">היא לא נמחקה. אפשר לבחור מועד אחר ולבטל אותה.</span></div></div>`:l}
        ${this.confirmCancel?a`<div class="note warn" role="alert"><sw-icon name="warning" size="18"></sw-icon><div><b>${n?"למשוך את הבקשה?":"לבטל את ההזמנה?"}</b><span class="muted">${e.recurring?"הביטול חל על כל הסדרה.":"המועד יתפנה לאחרים."}</span></div></div>`:l}`:this.error?l:a`<div class="skel" style="block-size:120px"></div>`}
        ${this.error?a`<div class="err" role="alert" data-cal-error>${this.error}</div>`:l}
      </div>
      <footer>
        ${i||n?a`<button type="button" class=${`btn bad${this.confirmCancel?" fill":""}`} ?disabled=${this.busy} data-cal-cancel-event @click=${()=>void this.cancelEvent(n)}>
          <sw-icon name="trash" size="16"></sw-icon>${this.confirmCancel?"כן, לבטל":n?"משיכת הבקשה":"ביטול ההזמנה"}</button>`:l}
        <button type="button" class="btn" @click=${()=>this.close()}>סגירה</button>
      </footer>`}async cancelEvent(t){if(!this.confirmCancel){this.confirmCancel=!0;return}const e=this.event;this.busy=!0;try{const s=this.ctx.api;t?await s.withdrawEvent(e.id,e.revision):await s.cancelEvent(e.id,e.revision),E(this,$.changed),E(this,$.toast,t?"הבקשה נמשכה":"ההזמנה בוטלה"),this.close()}catch(s){this.error=D(s),this.confirmCancel=!1}finally{this.busy=!1}}roleLine(t){const e=this.ctx;return t?.my_role==="manage"?`ניהול היומן "${t.name}" · ללא צורך באישור`:e.access.can.book_for_others?"מזמין גם בשם אחרים":"יוצר הזמנות שלו בלבד"}form(){const t=this.ctx,e=this.cal(),s=this.bookable(),i=t.access.can.book_for_others,n=ct(this.date,this.from),r=ct(this.date,this.to),o=this.preview?.conflicts??[],v=!!this.preview?.needs_approval_by.length&&e?.my_role!=="manage"||o.length>0,m=parseInt(this.headcount,10),g=!!e?.capacity&&m>e.capacity,h=e?[e.name,e.floor_name].filter(Boolean).join(" · "):"";return a`<header><div><h2 id="h">הזמנה חדשה</h2>${h?a`<div class="muted ell">${h}</div>`:l}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="lockline" data-cal-roleline><sw-icon name="shield" size="16"></sw-icon><span class="ell">${this.roleLine(e)}</span></div>
        ${s.length?l:a`<div class="note warn" role="note"><sw-icon name="lock" size="18"></sw-icon><div><b>אין יומן שאפשר להזמין בו</b><span class="muted">מנהל היומן יכול לתת הרשאה.</span></div></div>`}
        <div class="fld"><label for="cal">יומן</label>
          <div class="selrow"><span class="dot" style=${`--h:${I(e?.color)}`}></span>
            <select id="cal" class="inp" data-cal-field="calendar" .value=${this.calId} @change=${p=>this.calId=p.target.value}>
              ${s.map(p=>a`<option value=${p.id} ?selected=${p.id===this.calId}>${p.name}</option>`)}</select><sw-icon name="chevronDown" size="16"></sw-icon></div></div>
        <div class="fld"><label for="t">כותרת</label><input id="t" class="inp" maxlength="200" data-cal-field="title" .value=${this.evTitle} placeholder="למשל: ישיבת צוות" @input=${p=>this.evTitle=p.target.value}></div>
        <div class="fld"><span class="lbl">מתי</span><div class="ctls">
          <input type="date" lang=${pt()} class="inp" aria-label="תאריך" data-cal-field="date" .value=${this.date} @change=${p=>this.date=p.target.value}>
          <input type="time" lang=${pt()} class="inp short" aria-label="שעת התחלה" step="300" data-cal-field="from" .value=${this.from} @change=${p=>this.from=p.target.value}>
          <input type="time" lang=${pt()} class="inp short" aria-label="שעת סיום" step="300" data-cal-field="to" .value=${this.to} @change=${p=>this.to=p.target.value}></div></div>
        <div class="fld"><label for="rep">חזרה</label><div class="ctls">
          <select id="rep" class="inp" data-cal-field="repeat" .value=${this.repeat} @change=${p=>this.repeat=p.target.value}>
            <option value="none" ?selected=${this.repeat==="none"}>פעם אחת</option><option value="weekly" ?selected=${this.repeat==="weekly"}>כל שבוע</option><option value="daily" ?selected=${this.repeat==="daily"}>כל יום</option></select>
          ${this.repeat!=="none"?a`<input type="number" class="inp short num" min="2" max="104" aria-label="מספר מועדים" data-cal-field="count" .value=${String(this.count)} @input=${p=>this.count=parseInt(p.target.value,10)||2}>`:l}</div></div>
        ${this.repeat!=="none"&&n?a`<div class="fld"><span></span><span class="hint num" data-cal-repeat-summary><sw-icon name="refresh" size="14"></sw-icon><span class="ell">${xe(this.repeat,this.count,n)}</span></span></div>`:l}
        <div class="fld top"><span class="lbl">הזמינות</span><div class="col">${this.availability(n,r,o)}</div></div>
        ${i?a`
          <div class="fld"><label for="bh">בשם</label><div class="ctls">
            <select id="bh" class="inp short" data-cal-field="behalf" .value=${this.behalf} @change=${p=>this.behalf=p.target.value}>
              ${Object.keys(mt).map(p=>a`<option value=${p} ?selected=${p===this.behalf}>${mt[p]}</option>`)}</select>
            ${this.behalf!=="self"?a`<input class="inp" maxlength="80" aria-label=${`שם ה${mt[this.behalf]}`} data-cal-field="behalf-label" .value=${this.behalfLabel} placeholder=${`שם ה${mt[this.behalf]}`} @input=${p=>this.behalfLabel=p.target.value}>`:l}</div></div>`:a`<div class="lockline" data-cal-behalf-locked><sw-icon name="lock" size="16"></sw-icon><span>הזמנה בשם צוות, חוג או לקוח - למי שקיבל את ההרשאה</span></div>`}
        <div class="fld"><label for="hc">משתתפים</label><div class="ctls">
          <input id="hc" type="number" min="1" class="inp short num" inputmode="numeric" data-cal-field="headcount" .value=${this.headcount} @input=${p=>this.headcount=p.target.value}>
          ${e?.capacity?a`<span class=${`hint${g?" bad":""}`} data-cal-capacity-hint><span>מתוך <span class="num">${e.capacity}</span> מקומות${g?" · יותר מהקיבולת":""}</span></span>`:l}</div></div>
        ${this.guestsOffered()?a`<div class="fld top"><span class="lbl">פרטי אורח</span><div class="col">
            <div class="ctls"><input class="inp" maxlength="80" aria-label="שם האורח" placeholder="שם" data-cal-field="guest-name" .value=${this.guestName} @input=${p=>this.guestName=p.target.value}>
              <input class="inp num ltr" type="tel" inputmode="tel" maxlength="20" aria-label="טלפון האורח" placeholder="050-000-0000" data-cal-field="guest-phone" .value=${this.guestPhone} @input=${p=>this.guestPhone=p.target.value}></div>
            <span class="hint" data-cal-retention><sw-icon name="clock" size="14"></sw-icon><span>${this.retention===null?"השם והטלפון יימחקו אחרי המועד האחרון, לפי הגדרות השמירה.":this.retention===0?"השם והטלפון יימחקו בסיום המועד האחרון.":a`השם והטלפון יימחקו <span class="num">${this.retention}</span> יום אחרי המועד האחרון.`}${this.behalfLabel.trim()?` התווית "${this.behalfLabel.trim()}" נשארת.`:""}</span></span></div></div>`:l}
        ${v?a`<div class="note" role="note" data-cal-approval-note><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח לאישור</b>
          <span class="muted">${o.length?"המועד חופף להזמנה שכבר אושרה; הבקשה תיכנס לתור והמנהל יחליט. ":""}${e?.owner.name?`${e.owner.name}, מנהל/ת היומן, ת/יקבל התראה. `:""}בקשה לא שומרת את המועד: מי שמאושר ראשון מקבל אותו.</span></div></div>`:l}
        ${this.error?a`<div class="err" role="alert" data-cal-error>${this.error}</div>`:l}
        ${this.suggestions.length?a`<div class="sugg">${this.suggestions.map(p=>a`<button type="button" class="num ltr" @click=${()=>this.take(p)}>${w(p.start)}–${w(p.end)}</button>`)}</div>`:l}
      </div>
      <footer>
        <button type="button" class="btn pri" ?disabled=${this.busy||!s.length} data-cal-submit @click=${()=>void this.submit()}><sw-icon name="check" size="16"></sw-icon>${v?"שליחה לאישור":"שמירה"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>ביטול</button>
      </footer>`}availability(t,e,s){const o=t?C(t):null,c=x=>Math.min(100,Math.max(0,((x.getTime()-o.getTime())/6e4-420)/900*100)),v=s.length>0,m=this.repeat==="none"?1:Math.min(Math.max(this.count,2),104),h=this.cal()?.buffer_after_min??0,p=v&&t&&e?this.nextFree(t,e):null;return a`<div class="mini" aria-hidden="true" data-cal-mini>
        ${o?this.dayOcc.map(x=>a`<div class="busy" data-mark=${x.state==="pending"?"pending":""} style=${`left:${c(new Date(x.start))}%;width:${c(new Date(x.end))-c(new Date(x.start))}%`}></div>`):l}
        ${t&&e&&e>t?a`<div class=${`slot${v?" clash":""}`} style=${`left:${c(t)}%;width:${Math.max(1,c(e)-c(t))}%`}></div>`:l}
      </div>
      <div class="scale num"><span>07:00</span><span>12:00</span><span>17:00</span><span>22:00</span></div>
      ${this.preview?v?a`<span class="hint bad" data-cal-avail="clash"><sw-icon name="warning" size="14"></sw-icon><span class="ell"><b>${m>1?a`<span class="num">${s.length}</span> מועדים מתנגשים`:"המועד תפוס"}</b>${s[0]?a` · <span class="num">${Z(new Date(s[0].start))} ${w(s[0].start)}</span>${s[0].title?` (${s[0].title})`:""}`:l}</span></span>
          ${p?a`<div class="sugg"><button type="button" class="num ltr" data-cal-suggest @click=${()=>this.take(p)}>${w(p.start)}–${w(p.end)}</button></div>`:l}`:a`<span class="hint ok" data-cal-avail="free"><sw-icon name="check" size="14"></sw-icon><span class="ell"><b>${m>1?a`פנוי בכל <span class="num">${m}</span> המועדים`:"פנוי"}</b>${h?a` · כולל <span class="num">${h}</span> דק׳ הפסקה אחרי`:l}</span></span>`:l}`}nextFree(t,e){const s=e.getTime()-t.getTime(),i=new Date(C(t).getTime()+22*36e5);for(let n=t.getTime()+15*6e4;n+s<=i.getTime();n+=15*6e4){const r=new Date(n),o=new Date(n+s);if(!this.dayOcc.some(c=>c.state==="confirmed"&&new Date(c.start)<o&&new Date(c.end)>r))return{start:r.toISOString(),end:o.toISOString()}}return null}};z.styles=[at,tt`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); animation: fade var(--sw-t-med) var(--sw-ease); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: slide 240ms var(--sw-ease-drawer); }
    @keyframes slide { from { transform: translateX(100%); } }
    @keyframes fade { from { opacity: 0; } }
    :host-context([dir='ltr']) aside { animation-name: slide-l; }
    @keyframes slide-l { from { transform: translateX(-100%); } }
    @media (prefers-reduced-motion: reduce) { aside, .scrim { animation: none; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    header .muted { margin-block-start: 2px; }
    header .x { margin-inline-start: auto; flex: none; }
    .body { flex: 1; min-block-size: 0; padding: 4px 22px 12px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
    footer { display: flex; gap: 10px; padding: 12px 22px calc(16px + env(safe-area-inset-bottom, 0px)); border-block-start: 1px solid var(--sw-border); align-items: center; }
    .lockline { display: flex; align-items: center; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); padding: 8px 12px; border-radius: var(--sw-r-md);
      background: var(--sw-surface-3); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; align-items: center; }
    .ctls > .inp { flex: 1; }
    .ctls > .short { flex: 0 0 104px; }
    .selrow { position: relative; display: flex; align-items: center; }
    .selrow .dot { position: absolute; inset-inline-start: 12px; pointer-events: none; }
    .selrow select { padding-inline-start: 30px; }
    .selrow sw-icon { position: absolute; inset-inline-end: 10px; color: var(--sw-text-3); pointer-events: none; }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .hint.ok { color: var(--sw-success-text); }
    .hint.bad { color: var(--sw-danger-text); }
    .hint.warn { color: var(--sw-warning-text); }
    .mini { position: relative; direction: ltr; block-size: 26px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); overflow: hidden; }
    .mini .busy { position: absolute; inset-block: 4px; border-radius: var(--sw-r-2xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .mini .busy[data-mark='pending'] { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .mini .slot { position: absolute; inset-block: 2px; border-radius: var(--sw-r-2xs); background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mini .slot.clash { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .scale { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .sugg { display: flex; gap: 6px; flex-wrap: wrap; }
    .sugg button { font: inherit; min-block-size: 30px; padding-inline: 12px; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text); border: 0;
      font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); cursor: pointer; }
    .col { display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
    .fld.top { align-items: start; }
    .fld.top > .lbl, .fld.top > label { padding-block-start: 10px; }
    .note sw-icon { flex: none; color: var(--sw-accent-text); margin-block-start: 2px; }
    .note.warn sw-icon { color: var(--sw-warning-text); }
    .note.bad sw-icon { color: var(--sw-danger-text); }
    .note .muted { display: block; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    dl { margin: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 14px; font-size: var(--sw-fs-md); }
    dt { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    dd { margin: 0; min-inline-size: 0; overflow-wrap: anywhere; color: var(--sw-text); }
    input[type='date'], input[type='time'] { font-variant-numeric: tabular-nums; }
    @media (max-width: 699px) {
      aside { inline-size: 100vw; }
      header { padding: 14px 16px 6px; }
      header h2 { font-size: var(--sw-fs-xl); }
      .body { padding: 4px 16px 10px; gap: 8px; overflow-y: auto; overscroll-behavior: contain; }
      footer { padding-inline: 16px; }
      .ctls { flex-wrap: wrap; }
      .ctls > .inp { flex: 1 1 120px; }
      .inp { min-block-size: 44px; }
    }
  `];O([K({attribute:!1})],z.prototype,"ctx",2);O([K({attribute:!1})],z.prototype,"detail",2);O([d()],z.prototype,"calId",2);O([d()],z.prototype,"evTitle",2);O([d()],z.prototype,"date",2);O([d()],z.prototype,"from",2);O([d()],z.prototype,"to",2);O([d()],z.prototype,"repeat",2);O([d()],z.prototype,"count",2);O([d()],z.prototype,"behalf",2);O([d()],z.prototype,"behalfLabel",2);O([d()],z.prototype,"headcount",2);O([d()],z.prototype,"guestName",2);O([d()],z.prototype,"guestPhone",2);O([d()],z.prototype,"dayOcc",2);O([d()],z.prototype,"preview",2);O([d()],z.prototype,"error",2);O([d()],z.prototype,"suggestions",2);O([d()],z.prototype,"busy",2);O([d()],z.prototype,"event",2);O([d()],z.prototype,"confirmCancel",2);O([d()],z.prototype,"retention",2);O([d()],z.prototype,"guestKinds",2);z=O([st("cal-event-drawer")],z);var De=Object.defineProperty,Oe=Object.getOwnPropertyDescriptor,L=(t,e,s,i)=>{for(var n=i>1?void 0:i?Oe(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&De(e,s,n),n};let M=class extends et{constructor(){super(...arguments),this.ctx=null,this.shrink=!1,this.reqs=null,this.error="",this.seg="pending",this.page=1,this.selId="",this.choice="approve",this.pick="",this.lanes=[],this.series=[],this.skip=new Set,this.rejecting=null,this.note="",this.busy=!1,this.actErr="",this.overlay=!1,this.listH=0,this.decided=[],this.ro=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight)}willUpdate(t){t.has("ctx")&&(this.shrink=this.ctx?.device==="tablet"&&this.ctx.access.ui.tablet_panels==="shrink")}get device(){return this.ctx?.device??"desktop"}panelMode(){return this.device==="desktop"||this.device==="tablet"&&this.ctx?.access.ui.tablet_panels==="shrink"?"inline":"overlay"}async load(){if(this.ctx)try{const{requests:t}=await this.ctx.api.requests();if(this.reqs=t,this.error="",!t.find(s=>s.event_id===this.selId)&&(this.selId="",this.panelMode()==="inline")){const s=t.find(i=>i.competing_count>1)??t.find(i=>i.recurring)??t[0];s&&this.select(s,!1)}}catch(t){this.error=D(t)}}perPage(){const t=this.device==="phone"?222:this.device==="tablet"?136:122;return this.listH?xt(this.listH+8,t):this.device==="desktop"?4:2}holderOf(t){return t.room_calendar_id??t.calendar.id}rivals(t){const e=this.holderOf(t),s=(this.reqs??[]).filter(i=>this.holderOf(i)===e&&i.start<t.end&&i.end>t.start);return le(s,this.ctx?.access.ui.contested_order??"first_come")}async select(t,e=!0){if(!this.ctx)return;this.selId=t.event_id,this.actErr="",this.skip=new Set,this.series=[],this.lanes=[],e&&this.panelMode()==="overlay"&&(this.overlay=!0);const s=this.ctx.access.ui.contested_order,i=this.rivals(t);this.pick=s==="manual"?i.length>1?"":t.event_id:(i.find(o=>o.suggested)??i[0]??t).event_id,this.choice="approve";const n=this.holderOf(t),r=C(new Date(t.start));try{if(t.recurring){const{occurrences:m}=await this.ctx.api.occurrences(r.toISOString(),P(r,61).toISOString(),[n]);this.series=m.filter(g=>g.event_id===t.event_id).slice(0,12)}const{occurrences:o}=await this.ctx.api.occurrences(r.toISOString(),P(r,1).toISOString(),[n]),c=o.filter(m=>m.state==="confirmed"&&m.start<t.end&&m.end>t.start&&m.kind!=="holiday"&&!i.some(g=>g.event_id===m.event_id)),v=this.ctx.cals.find(m=>m.id===n)?.color??t.calendar.color;this.lanes=[...c.map(m=>({id:m.event_id,title:m.title??"תפוס",who:m.organizer?.name??m.on_behalf_label??"",start:m.start,end:m.end,holder:!0,req:null,color:v})),...i.map(m=>({id:m.event_id,title:m.title??"בקשה",who:[m.organizer?.name,m.headcount?`${m.headcount.toLocaleString("he-IL")} משתתפים`:""].filter(Boolean).join(" · "),start:m.start,end:m.end,holder:!1,req:m,color:m.calendar.color}))]}catch{this.lanes=i.map(o=>({id:o.event_id,title:o.title??"בקשה",who:o.organizer?.name??"",start:o.start,end:o.end,holder:!1,req:o,color:o.calendar.color}))}}async decide(t,e,s={}){if(!this.ctx)return!1;this.busy=!0,this.actErr="";try{await this.ctx.api.decide(t.event_id,{decision:e,revision:t.revision,room_calendar_id:t.room_calendar_id,note:s.note||void 0,displace_existing:s.displace||void 0,except_occurrences:s.except?.length?s.except:void 0}),this.decided=[{r:t,decision:e,at:new Date,displaced:!!s.displace},...this.decided].slice(0,50);const i=t.title??"הבקשה";return E(this,$.toast,e==="approve"?s.displace?`"${i}" אושרה; ההזמנה שהחזיקה את החלון נדחקה`:`"${i}" אושרה`:`"${i}" נדחתה`),E(this,$.changed),this.overlay=!1,await this.load(),!0}catch(i){return this.actErr=this.errText(i),i instanceof U&&i.code==="slot_held"&&await this.select(t),i instanceof U&&i.code==="slot_held"&&(this.actErr=this.errText(i)),!1}finally{this.busy=!1}}errText(t){if(t instanceof U){if(t.code==="slot_held")return"החלון כבר תפוס על ידי הזמנה שאושרה קודם. אפשר לאשר עם דחיקה או לדחות.";if(t.code==="displace_disabled")return"בהתקנה הזאת אי אפשר לדחוק הזמנה שאושרה. אפשר לדחות את הבקשה.";if(t.status===403)return"דחיקה של הזמנה מאושרת דורשת את אישור מנהל היומן עצמו.";if(t.code==="stale")return"הבקשה עודכנה בינתיים. הרשימה רועננה."}return D(t)}async applyChoice(t){const e=this.rivals(t);if(this.choice==="keep"){for(const n of e)if(!await this.decide(n,"reject",{note:"החלון נשאר להזמנה שאושרה קודם"}))return;return}const s=e.find(n=>n.event_id===this.pick)??t,i=this.lanes.some(n=>n.holder)||s.conflicts_now>0;await this.decide(s,"approve",{displace:i&&this.ctx?.access.ui.allow_displace!==!1,except:[...this.skip]})}render(){if(!this.ctx)return l;if(this.error&&!this.reqs)return a`<section class="panel main" data-cal-state="error"><sw-state-panel state="error" heading="הבקשות לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.load()}></sw-state-panel></section>`;if(!this.reqs)return a`<section class="panel main" aria-busy="true">${Array.from({length:4},()=>a`<div class="skel" style="block-size:96px"></div>`)}</section>`;const t=this.reqs.find(s=>s.event_id===this.selId)??null,e=this.panelMode();return a`
      <section class="panel main" data-approvals>
        <div class="ph">
          <div class="seg" role="group" aria-label="בקשות">
            <button type="button" aria-pressed=${String(this.seg==="pending")} data-seg="pending" @click=${()=>{this.seg="pending",this.page=1}}>ממתינות <span class="num">${this.reqs.length}</span></button>
            <button type="button" aria-pressed=${String(this.seg==="decided")} data-seg="decided" @click=${()=>{this.seg="decided",this.page=1}}>הוחלטו לאחרונה</button>
          </div>
          <span class="sp"></span>
          ${this.device==="phone"?l:this.managedDots()}
        </div>
        ${this.actErr&&!(t&&(e==="inline"||this.overlay))&&!this.rejecting?a`<div class="note bad" role="alert" data-act-error>${this.actErr}</div>`:l}
        ${this.seg==="pending"?this.pendingList():this.decidedList()}
      </section>
      ${t&&e==="inline"?this.detail(t,!1):l}
      ${t&&e==="overlay"&&this.overlay?a`<div class="scrim" @click=${()=>this.overlay=!1}></div>${this.detail(t,!0)}`:l}
      ${this.rejecting?this.rejectDialog(this.rejecting):l}`}managedDots(){const t=(this.ctx?.cals??[]).filter(e=>e.my_role==="manage");return a`<span class="hintline">יומנים שבניהולך: ${t.slice(0,8).map(e=>a`<span class="dot" style=${`--h:${I(e.color)}`}></span>`)}<span class="num">${t.length}</span></span>`}pendingList(){const t=this.reqs??[];if(!t.length)return a`<div class="reqs-empty" data-cal-state="empty"><sw-state-panel icon="calendar" state="empty" heading="אין בקשות שממתינות לך"
        hint="כשמישהו יבקש חדר ביומן שבאחריותך, הבקשה תופיע כאן ותקבל התראה."></sw-state-panel></div>`;const e=G(t,this.page,this.perPage());return a`<div class="list" data-req-list>${e.items.map(s=>this.card(s))}</div>${this.pager(e.page,e.pages)}`}card(t){const e=this.ctx?.now??new Date,s=(new Date(t.start).getTime()-e.getTime())/36e5,i=this.ctx?.cals.find(c=>c.id===(t.room_calendar_id??t.calendar.id))?.approval_timeout_h??2,n=Math.floor(s-i),[r,o]=X(t.start,t.end,e).split(" · ");return a`<div class="req" role="button" tabindex="0" aria-current=${String(t.event_id===this.selId)} data-req=${t.event_id}
        @click=${c=>{c.target.closest("button")||this.select(t)}}
        @keydown=${c=>{c.key==="Enter"&&c.target===c.currentTarget&&this.select(t)}}>
      <div class="info">
        <div class="ttl"><span class="dot" style=${`--h:${I(t.calendar.color)}`}></span><span class="ell" title=${t.title??""}>${t.title??"בקשה"}</span></div>
        <div class="when"><span>${r} · <span class="ltr num">${o}</span></span>${t.recurring?a`<span class="chip"><sw-icon name="refresh" size="12"></sw-icon><span class="ell">${t.recurring_summary??"סדרה"}</span></span>`:l}</div>
        <div class="meta">
          <span title=${t.calendar.name}>${t.calendar.name}</span>${t.organizer?.name?a`<span title=${t.organizer.name}>${t.organizer.name}</span>`:l}
          <span title=${t.on_behalf_label??""}>${t.on_behalf_label?`בשם: ${t.on_behalf_label}`:a`<span class="muted">ללא תווית</span>`}</span>
          ${t.headcount?a`<span class="num">${t.headcount.toLocaleString("he-IL")} משתתפים</span>`:l}
          ${t.conflicts_now&&t.competing_count<=1?a`<span class="chip bad" data-chip="conflict"><sw-icon name="warning" size="12"></sw-icon>חופף להזמנה מאושרת</span>`:l}
          ${s>0&&n>=0&&n<=12?a`<span class="chip warn num" data-chip="deadline">נשארו ${n} שע׳ להחלטה</span>`:l}
          ${t.competing_count>1?a`<span class="chip warn num" data-chip="contest"><sw-icon name="users" size="12"></sw-icon>${t.competing_count.toLocaleString("he-IL")} מבקשים לחלון</span>`:l}
          ${t.guests_count?a`<span class="chip num" data-chip="guests"><sw-icon name="lock" size="12"></sw-icon>פרטי אורח: ${t.guests_count}</span>`:l}
          ${t.suggested&&this.ctx?.access.ui.contested_order!=="manual"?a`<span class="chip acc" data-chip="first">ראשון בתור</span>`:l}
        </div>
      </div>
      <div class="acts">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-approve=${t.event_id} @click=${()=>void this.quickApprove(t)}><sw-icon name="check" size="14"></sw-icon>אישור</button>
        <button type="button" class="btn no" ?disabled=${this.busy} data-reject=${t.event_id} @click=${()=>{this.rejecting=t,this.note="",this.actErr=""}}><sw-icon name="close" size="14"></sw-icon>דחייה</button>
      </div>
    </div>`}async quickApprove(t){if(t.competing_count>1||t.conflicts_now>0){await this.select(t);return}await this.decide(t,"approve")}decidedList(){if(!this.decided.length)return a`<div class="reqs-empty" data-cal-state="decided-empty"><sw-state-panel icon="check" state="empty" heading="עוד לא הוחלט דבר מאז שנפתח המסך" hint="החלטות שתקבל כאן יופיעו ברשימה הזאת."></sw-state-panel></div>`;const t=G(this.decided,this.page,this.perPage()+2);return a`<div class="list">${t.items.map(e=>a`<div class="row" data-decided=${e.r.event_id}>
      <span class="dot" style=${`--h:${I(e.r.calendar.color)}`}></span>
      <div class="grow"><div class="name ell">${e.r.title??"בקשה"}</div><div class="sub ell">${e.r.calendar.name} · ${X(e.r.start,e.r.end,this.ctx?.now??new Date)}</div></div>
      ${e.displaced?a`<span class="chip warn">נדחקה הזמנה</span>`:l}
      <span class=${`chip ${e.decision==="approve"?"ok":"bad"}`}>${e.decision==="approve"?"אושר":"נדחה"} · <span class="num">${w(e.at)}</span></span></div>`)}</div>${this.pager(t.page,t.pages)}`}pager(t,e){return a`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${t} / ${e}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${t>=e} @click=${()=>this.page=t+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`}detail(t,e){const s=this.lanes.length>1||t.competing_count>1,i=t.recurring&&!s,n=s?`${t.calendar.name} · ${X(t.start,t.end,this.ctx?.now??new Date).split(" · ")[0]}`:t.title??"בקשה";return a`<aside class=${`panel ${e?"overlay":""}`} role=${e?"dialog":"complementary"} aria-label="פרטי הבקשה" data-detail=${s?"contested":i?"series":"single"}>
      <div class="ph"><h2 class="ell" title=${n}>${n}</h2>
        ${e?a`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" data-detail-close @click=${()=>this.overlay=!1}><sw-icon name="close" size="14"></sw-icon></button>`:l}</div>
      ${i?this.seriesBody(t):this.contestBody(t)}
      ${this.actErr?a`<div class="err" role="alert" data-act-error>${this.actErr}</div>`:l}
    </aside>`}contestBody(t){const e=this.lanes.length?this.lanes:[{id:t.event_id,title:t.title??"בקשה",who:t.organizer?.name??"",start:t.start,end:t.end,holder:!1,req:t,color:t.calendar.color}],s=new Date(Math.min(...e.map(u=>new Date(u.start).getTime())));s.setMinutes(0,0,0),s.setHours(s.getHours()-1);const i=new Date(Math.max(...e.map(u=>new Date(u.end).getTime())));i.setMinutes(0,0,0),i.setHours(i.getHours()+2);const n=i.getTime()-s.getTime(),r=u=>(new Date(u).getTime()-s.getTime())/n*100,o=e.find(u=>u.holder),c=e.filter(u=>!u.holder),v=this.ctx?.access.ui,m=c.find(u=>u.id===this.pick)?.req??(c.length===1?c[0].req:null)??null,g=!!o&&v?.allow_displace===!1,h=g?"keep":this.choice,p=v?.contested_order??"first_come",x=new Date((s.getTime()+i.getTime())/2),y=h==="approve"&&!m;return a`
      <div class="muted"><b class="num" style="color:var(--sw-heading)">${c.length}</b> ${c.length===1?"מבקש":"מבקשים"} לאותו חלון${o?" · מי שאושר ראשון מחזיק":""}
        · ${p==="manual"?"הסדר: המנהל בוחר":p==="by_kind"?"הסדר: לפי סוג":"הסדר: לפי סדר הגעה"}</div>
      <div class="lanes" data-lanes>${e.map(u=>a`<div class="lane" data-lane=${u.holder?"holder":"request"} data-lane-id=${u.id}>
        <div class="ln"><b class="ell" title=${u.title}>${u.title}</b><span class="ell" title=${u.who}>${u.who}</span></div>
        <div class="mini"><div class="ev" data-mark=${u.holder?"ok":"pending"} style=${`--h:${I(u.color)};left:${r(u.start)}%;width:${Math.max(2,r(u.end)-r(u.start))}%`}></div></div>
        <span class="chipcell">${u.holder?a`<span class="chip ok">מאושר · מחזיק את החלון</span>`:a`<span class="chip dash num">בקשה ${c.indexOf(u)+1}${u.req?.requested_at?a` · ${w(u.req.requested_at)}`:l}</span>${u.req?.suggested&&p!=="manual"?a`<span class="chip acc" data-first-in-line>ראשון בתור</span>`:l}`}</span></div>`)}</div>
      <div class="axis"><span class="num">${w(s)}</span><span class="num">${w(x)}</span><span class="num">${w(i)}</span></div>
      ${c.length>1&&h==="approve"?a`<label style="display:flex;flex-direction:column;gap:4px"><span class="lbl">איזו בקשה לאשר</span><select class="inp" data-pick @change=${u=>this.pick=u.target.value}>
        ${p==="manual"?a`<option value="" ?selected=${!this.pick}>בחירה…</option>`:l}
        ${c.map((u,f)=>a`<option value=${u.id} ?selected=${u.id===this.pick}>${f+1}. ${u.title}</option>`)}</select></label>`:l}
      <div role="radiogroup" aria-label="מה לעשות" style="display:flex;flex-direction:column;gap:8px">
        <button type="button" class="opt" role="radio" aria-checked=${String(h==="approve")} aria-disabled=${String(g)} data-choice="approve"
          @click=${()=>{g||(this.choice="approve")}}><span class="rad"></span><span>
          <b>${m?`לאשר את "${m.title??"הבקשה"}"`:"לאשר את הבקשה שתבחר"}${o?" ולדחוק":""}</b>
          <small>${g?"בהתקנה הזאת דחיקה של הזמנה מאושרת כבויה (הגדרות ‹ יומנים). אפשר רק לדחות את הבקשות.":o?`"${o.title}" נדחקת ולא נמחקת; ${o.who||"המארגן"} יבחר זמן חלופי מתוך 3 הצעות.${c.length>1?" שאר הבקשות נשארות ממתינות.":""}`:c.length>1?"הבקשה מאושרת; שאר הבקשות לחלון נשארות ממתינות ויוכרעו מול ההזמנה שאושרה.":"הבקשה מאושרת והמבקש מקבל הודעה."}</small></span></button>
        <button type="button" class="opt" role="radio" aria-checked=${String(h==="keep")} data-choice="keep" @click=${()=>this.choice="keep"}><span class="rad"></span><span>
          <b>${o?"להשאיר למחזיק ולדחות את הבקשות":"לדחות את כל הבקשות לחלון"}</b>
          <small>${c.length>1?`${c.length} הבקשות נדחות עם הערה`:"הבקשה נדחית עם הערה"} והמבקשים מקבלים הצעות לזמן אחר.</small></span></button>
      </div>
      <div class="hintline"><sw-icon name="shield" size="14"></sw-icon>${v?.displace_approver==="any_manager"?"מחליט: מנהל היומן, מנהל האזור או מנהל המערכת":"מחליט: מנהל היומן. דחיקה רק באישור מנהל היומן עצמו"}</div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy||y} data-apply @click=${()=>{this.choice=h,this.applyChoice(t)}}>
          <sw-icon name="check" size="14"></sw-icon>${h==="keep"?"דחיית הבקשות":o?"אישור ודחיקה":"אישור"}</button>
        <button type="button" class="btn no" ?disabled=${this.busy||!m} @click=${()=>{m&&(this.rejecting=m,this.note="")}}>דחייה עם הערה</button>
      </div>`}localKey(t){return t.occurrence_id.split("@")[1]??t.start}seriesBody(t){const e=this.series,s=e[0];return a`
      <div class="muted">${t.calendar.name}${t.organizer?.name?` · ביקש/ה ${t.organizer.name}`:""}</div>
      ${s?a`<div style="font-weight:700;color:var(--sw-heading)">המועד הראשון: <span class="num">${ht[new Date(s.start).getDay()]} ${Z(new Date(s.start))} · <span class="ltr">${w(s.start)}–${w(s.end)}</span></span></div>`:l}
      <div style="font-weight:700;color:var(--sw-heading)">${e.length?a`<span class="num">${e.length}</span> מועדים`:t.recurring_summary??"סדרה"}</div>
      ${e.length?a`<div class="dates" data-dates>${e.map(i=>{const n=this.localKey(i),r=this.skip.has(n);return a`<button type="button" class="date" aria-pressed=${String(r)} title=${r?"יידחה":"יאושר"} data-date=${n}
          @click=${()=>{const o=new Set(this.skip);r?o.delete(n):o.add(n),this.skip=o}}>
          <span class="num">${Z(new Date(i.start))}</span>${i.contested&&!r?a`<span class="chip bad">מתנגש</span>`:r?a`<sw-icon name="close" size="12"></sw-icon>`:a`<sw-icon class="ok-ic" name="check" size="12"></sw-icon>`}</button>`})}</div>`:l}
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>אפשר לאשר את הסדרה ולדחות מועדים בודדים</b><span class="muted">לחיצה על תאריך מוציאה אותו. המבקש יראה "אושר למעט N מועדים".</span></div></div>
      <div class="foot">
        <button type="button" class="btn yes" ?disabled=${this.busy} data-apply @click=${()=>void this.decide(t,"approve",{except:[...this.skip]})}>
          <sw-icon name="check" size="14"></sw-icon>${this.skip.size?a`אישור למעט <span class="num">${this.skip.size}</span>`:"אישור הסדרה"}</button>
        <button type="button" class="btn no" ?disabled=${this.busy} @click=${()=>{this.rejecting=t,this.note=""}}>דחייה עם הערה</button>
      </div>`}rejectDialog(t){return a`<div class="scrim" @click=${()=>this.rejecting=null}></div>
      <aside class="panel overlay short" role="dialog" aria-label="דחיית בקשה" data-reject-dialog>
        <div class="ph"><h2 class="ell">לדחות את "${t.title??"הבקשה"}"?</h2></div>
        <div class="muted">${t.calendar.name} · ${X(t.start,t.end,this.ctx?.now??new Date)}</div>
        <label class="lbl" for="note">הערה למבקש (לא חובה, עד 300 תווים)</label>
        <textarea id="note" class="inp" maxlength="300" .value=${this.note} @input=${e=>this.note=e.target.value} data-reject-note></textarea>
        ${this.actErr?a`<div class="err" role="alert">${this.actErr}</div>`:l}
        <div class="foot">
          <button type="button" class="btn bad fill" ?disabled=${this.busy} data-reject-confirm @click=${async()=>{await this.decide(t,"reject",{note:this.note})&&(this.rejecting=null)}}>דחייה</button>
          <button type="button" class="btn" @click=${()=>this.rejecting=null}>ביטול</button>
        </div>
      </aside>`}};M.styles=[at,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .req { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 16px; align-items: center; padding: 12px 16px; border-radius: var(--sw-r-lg);
      background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer; min-inline-size: 0; text-align: start; flex: none; }
    .req[aria-current='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .req:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .req .info { display: flex; flex-direction: column; gap: 4px; min-inline-size: 0; }
    .ttl { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); min-inline-size: 0; }
    .when { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); display: flex; gap: 8px; flex-wrap: wrap; align-items: center; min-inline-size: 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; align-items: center; }
    .meta > span { max-inline-size: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .acts { display: flex; gap: 8px; }
    .yes { background: var(--sw-accent); border-color: var(--sw-accent); color: var(--sw-text-inverse); }
    .no { color: var(--sw-danger-text); }
    .hintline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    aside.panel { inline-size: 440px; flex: none; }
    aside .lanes { display: flex; flex-direction: column; gap: 8px; }
    .lane { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: 4px 10px; align-items: center; }
    .lane .ln { display: flex; flex-direction: column; min-inline-size: 0; }
    .lane .ln b { font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .lane .ln span { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .lane .chipcell { grid-column: 2; justify-self: start; display: flex; gap: 4px; flex-wrap: wrap; }
    .mini { position: relative; block-size: 28px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); direction: ltr; overflow: hidden; }
    .mini .ev { position: absolute; inset-block: 4px; padding: 0; }
    .axis { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); padding-inline-end: 140px; }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt[aria-disabled='true'] { opacity: var(--sw-disabled-opacity); cursor: default; }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); margin-block-start: 2px; }
    .dates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; }
    .date { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-block-size: 34px; padding: 0 10px; border-radius: var(--sw-r-md); background: var(--sw-surface-2);
      border: 0; font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); cursor: pointer; }
    .date[aria-pressed='true'] { background: var(--sw-danger-soft); color: var(--sw-danger-text); text-decoration: line-through; }
    .ok-ic { color: var(--sw-success-text); }
    .foot { display: flex; gap: 8px; margin-block-start: auto; }
    .foot .btn:first-child { flex: 1; }
    textarea.inp { padding: 10px 12px; min-block-size: 72px; resize: none; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); inline-size: min(440px, calc(100vw - 24px)); box-shadow: var(--sw-shadow-3); }
    aside.overlay.short { inset-block: auto 12px; }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 320px; }
    :host([shrink]) .lane { grid-template-columns: 96px minmax(0, 1fr); }
    :host([shrink]) .axis { padding-inline-end: 106px; }
    .reqs-empty { flex: 1; display: grid; place-items: center; }
    .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); }
    @media (max-width: 699px) {
      .req { grid-template-columns: minmax(0, 1fr); padding: 12px; }
      .acts .btn { flex: 1; }
      aside.overlay { inset: auto 0 0 0; inline-size: 100%; max-block-size: 88dvh; border-end-start-radius: 0; border-end-end-radius: 0; padding-block-end: calc(16px + env(safe-area-inset-bottom)); }
    }
  `];L([K({attribute:!1})],M.prototype,"ctx",2);L([K({type:Boolean,reflect:!0})],M.prototype,"shrink",2);L([d()],M.prototype,"reqs",2);L([d()],M.prototype,"error",2);L([d()],M.prototype,"seg",2);L([d()],M.prototype,"page",2);L([d()],M.prototype,"selId",2);L([d()],M.prototype,"choice",2);L([d()],M.prototype,"pick",2);L([d()],M.prototype,"lanes",2);L([d()],M.prototype,"series",2);L([d()],M.prototype,"skip",2);L([d()],M.prototype,"rejecting",2);L([d()],M.prototype,"note",2);L([d()],M.prototype,"busy",2);L([d()],M.prototype,"actErr",2);L([d()],M.prototype,"overlay",2);L([d()],M.prototype,"listH",2);M=L([st("cal-view-approvals")],M);var Te=Object.defineProperty,Ee=Object.getOwnPropertyDescriptor,ot=(t,e,s,i)=>{for(var n=i>1?void 0:i?Ee(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&Te(e,s,n),n};const Ie={confirmed:["מוצב","ok"],pending:["ממתין להחלטה","dash"],rejected:["נדחה","bad"],cancelled:["בוטל",""],done:["הסתיים",""],displaced:["נדחק","warn"],expired:["פג",""],withdrawn:["בוטל",""]};let Q=class extends et{constructor(){super(...arguments),this.ctx=null,this.wins=null,this.error="",this.seg="next",this.page=1,this.listH=0,this.overlap="first_holds",this.ro=null}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight)}async load(){if(!this.ctx)return;const t=this.ctx.now;try{const{occurrences:e}=await this.ctx.api.occurrences(C(P(t,-7)).toISOString(),C(P(t,54)).toISOString()),s=new Map;for(const i of e.filter(n=>n.kind==="maintenance"||n.kind==="maintenance_task")){const n=`${i.event_id}@${i.start}`,r=s.get(n)??{o:i,rooms:[]},o=this.ctx.cals.find(c=>c.id===i.calendar_id)?.type==="room";for(const c of[...i.room_calendar_ids,...o?[i.calendar_id]:[]])r.rooms.includes(c)||r.rooms.push(c);o||(r.o={...i,room_calendar_ids:r.o.room_calendar_ids}),s.set(n,r)}this.ctx.api.settings().then(i=>this.overlap=i.settings.maintenance_overlap).catch(()=>{}),this.wins=[...s.values()].sort((i,n)=>i.o.start.localeCompare(n.o.start)),this.error=""}catch(e){this.error=D(e)}}render(){if(!this.ctx)return l;if(this.error&&!this.wins)return a`<section class="panel" data-cal-state="error"><div class="center"><sw-state-panel state="error" heading="חלונות התחזוקה לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.load()}></sw-state-panel></div></section>`;if(!this.wins)return a`<section class="panel" aria-busy="true">${Array.from({length:5},()=>a`<div class="skel" style="block-size:56px"></div>`)}</section>`;const t=this.ctx.now.toISOString(),e=this.seg==="next"?this.wins.filter(r=>r.o.end>=t):this.wins.filter(r=>r.o.end<t).reverse(),s=this.ctx.device==="phone"?104:64,i=G(e,this.page,this.listH?xt(this.listH+6,s):5),n=this.ctx.access.can.maintenance;return a`<section class="panel" data-maint-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="חלונות">
          <button type="button" aria-pressed=${String(this.seg==="next")} data-seg="next" @click=${()=>{this.seg="next",this.page=1}}>הבאים <span class="num">${this.wins.filter(r=>r.o.end>=t).length}</span></button>
          <button type="button" aria-pressed=${String(this.seg==="past")} data-seg="past" @click=${()=>{this.seg="past",this.page=1}}>השבוע שעבר</button>
        </div>
        <span class="sp"></span>
        <span class="mode"><sw-icon name="info" size="14"></sw-icon>מעל הזמנה מאושרת: <b>${bt[this.overlap]}</b></span>
      </div>
      ${e.length?a`<div class="list">${i.items.map(r=>this.row(r))}</div>
        <div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${i.page<=1} @click=${()=>this.page=i.page-1}><sw-icon name="chevron" size="14"></sw-icon></button>
          <span class="num" data-page>${i.page} / ${i.pages}</span>
          <button type="button" class="btn" aria-label="הבא" ?disabled=${i.page>=i.pages} @click=${()=>this.page=i.page+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`:a`<div class="center" data-cal-state="empty"><sw-state-panel icon="wrench" state="empty" heading=${this.seg==="next"?"אין חלונות תחזוקה מתוכננים":"לא היו חלונות תחזוקה בשבוע שעבר"}
          hint="חלון תחזוקה מסמן חדרים כתפוסים לעבודה; לפני השמירה רואים אם הוא חופף להזמנות." actionLabel=${n&&this.seg==="next"?"חלון תחזוקה חדש":""}
          @action=${()=>E(this,$.newMaint,{})}></sw-state-panel></div>`}
    </section>`}row(t){const e=this.ctx?.cals.find(r=>r.id===t.o.calendar_id),[s,i]=Ie[t.o.state]??[t.o.state,""],n=t.rooms.map(r=>this.ctx?.cals.find(o=>o.id===r)).filter(Boolean);return a`<div class="row" data-maint-row=${t.o.event_id}>
      <span class="sq" style=${`--h:${I(e?.color??"orange")}`}></span>
      <div class="grow"><div class="name ell" title=${t.o.title??""}>${t.o.title??"חלון תחזוקה"}</div><div class="sub ell">${e?.name??""}${t.o.contested?" · מתחרה על החלון":""}</div></div>
      <div class="rooms">${n.map(r=>a`<span class="chip" title=${r.name}><span class="dot" style=${`--h:${I(r.color)}`}></span>${r.name}</span>`)}</div>
      <span class="when num">${X(t.o.start,t.o.end,this.ctx?.now??new Date)}</span>
      <span class=${`chip ${i}`}>${s}</span>
    </div>`}};Q.styles=[at,tt`
    :host { display: flex; min-block-size: 0; }
    .panel { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .row { cursor: default; flex: none; }
    .rooms { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; max-inline-size: 40%; }
    .when { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); white-space: nowrap; }
    .mode { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    .mode b { color: var(--sw-heading); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 699px) {
      .row { flex-wrap: wrap; row-gap: 6px; }
      .rooms { max-inline-size: 100%; order: 3; inline-size: 100%; }
      .mode { display: none; }
    }
  `];ot([K({attribute:!1})],Q.prototype,"ctx",2);ot([d()],Q.prototype,"wins",2);ot([d()],Q.prototype,"error",2);ot([d()],Q.prototype,"seg",2);ot([d()],Q.prototype,"page",2);ot([d()],Q.prototype,"listH",2);ot([d()],Q.prototype,"overlap",2);Q=ot([st("cal-view-maint")],Q);var Ce=Object.defineProperty,Me=Object.getOwnPropertyDescriptor,F=(t,e,s,i)=>{for(var n=i>1?void 0:i?Me(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&Ce(e,s,n),n};const Pe={first_holds:'החלון יישמר כממתין ומסומן "מתחרה". אף הזמנה לא נדחקת עד שמנהלי החדרים מחליטים.',override_notify:'ההזמנות החופפות יעברו ל"נדחק" (לא נמחקות) והמארגנים יקבלו הודעה עם 3 זמנים חלופיים.',block:"השמירה חסומה. הזיזו את החלון או בחרו זמן פנוי.",ask:"בחרו מה יקרה להזמנות החופפות."};let R=class extends et{constructor(){super(...arguments),this.ctx=null,this.detail=null,this.calId="",this.evTitle="",this.date="",this.from="",this.to="",this.rooms=[],this.devices="",this.preview=null,this.decision="override_notify",this.busy=!1,this.err="",this.timer=0,this.onKey=t=>{t.key==="Escape"&&this.close()}}connectedCallback(){super.connectedCallback();const t=this.ctx?.now??new Date,e=this.detail??{},s=e.start?new Date(e.start):new Date(Math.ceil(t.getTime()/18e5)*18e5+36e5),i=e.end?new Date(e.end):new Date(s.getTime()+150*6e4);this.date=A(s),this.from=w(s),this.to=w(i),this.calId=this.maintCals()[0]?.id??"";const n=this.roomCals();this.rooms=e.rooms?.length?e.rooms.filter(r=>n.some(o=>o.id===r)):n.slice(0,1).map(r=>r.id),window.addEventListener("keydown",this.onKey),this.schedule()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("keydown",this.onKey),clearTimeout(this.timer)}maintCals(){return(this.ctx?.cals??[]).filter(t=>t.type==="maintenance"&&t.my_role&&t.my_role!=="view")}roomCals(){return(this.ctx?.cals??[]).filter(t=>t.type==="room")}span(){if(!this.date||!this.from||!this.to)return null;const t=new Date(`${this.date}T${this.from}:00`);let e=new Date(`${this.date}T${this.to}:00`);return e<=t&&(e=P(e,1)),Number.isNaN(t.getTime())?null:{start:t.toISOString(),end:e.toISOString()}}schedule(){clearTimeout(this.timer),this.timer=window.setTimeout(()=>void this.runPreview(),250)}async runPreview(){const t=this.span();if(!this.ctx||!t||!this.rooms.length||!this.calId){this.preview=null;return}try{this.preview=await this.ctx.api.maintPreview({calendar_id:this.calId,rooms:this.rooms,...t}),this.err=""}catch(e){this.preview=null,this.err=D(e)}}close(){this.dispatchEvent(new CustomEvent("close"))}async save(){const t=this.span();if(!this.ctx||!t)return;if(!this.evTitle.trim()){this.err="צריך כותרת לחלון.";return}const e=this.preview?.mode,s=this.preview?.overlaps.length??0;this.busy=!0,this.err="";try{const i=await this.ctx.api.maintPlace({calendar_id:this.calId,title:this.evTitle.trim(),rooms:this.rooms,...t,notes:this.devices.trim()||void 0,overlap_decision:e==="ask"&&s?this.decision:void 0}),n=i.displaced.length;E(this,$.toast,i.event.state==="pending"?"החלון נשמר כממתין להחלטת מנהלי החדרים":n?`החלון הוצב; ${n} הזמנות נדחקו והמארגנים קיבלו הודעה`:"חלון התחזוקה הוצב"),E(this,$.changed),this.close()}catch(i){i instanceof U&&i.code==="maintenance_overlap"?this.err="אי אפשר להציב את החלון מעל הזמנה. בחרו אחד מהזמנים הפנויים.":i instanceof U&&i.code==="overlap_decision_required"?this.err="יש חפיפה עם הזמנות קיימות. יש לבחור מה לעשות.":this.err=D(i),this.runPreview()}finally{this.busy=!1}}useAlt(t){const e=new Date(t.start);this.date=A(e),this.from=w(e),this.to=w(t.end),this.schedule()}render(){const t=this.maintCals(),e=this.roomCals(),s=this.preview,i=s?.overlaps??[],n=s?.mode??"first_holds",r=!!i.length&&(n==="block"||n==="ask"&&this.decision==="block"),o=this.ctx?.now??new Date,c=this.span(),v=c?W(new Date(c.start),o)?"היום":Z(new Date(c.start)):"",m=r?"אי אפשר לשמור":i.length&&n==="first_holds"?"שמירה כממתין להחלטה":"הצבת החלון",g=i.slice(0,this.ctx?.device==="phone"?2:3),h=p=>this.ctx?.cals.find(x=>x.id===p)?.name??"";return a`<div class="scrim" @click=${()=>this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-label="חלון תחזוקה חדש" data-maint-drawer data-mode=${n}>
        <header><div class="grow"><h2>חלון תחזוקה חדש</h2><div class="muted num">${this.rooms.length} ${this.rooms.length===1?"חדר":"חדרים"}${v?` · ${v}`:""}</div></div>
          <button type="button" class="btn icon" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body">
          ${t.length?l:a`<div class="note warn" data-no-maint-cal><div><b>אין יומן אחזקה שאפשר להציב בו</b><span class="muted">מנהל המערכת יוצר יומן מסוג אחזקה במסך ניהול יומנים.</span></div></div>`}
          <div class="fld"><label for="mc">יומן</label><select id="mc" class="inp" .value=${this.calId} @change=${p=>{this.calId=p.target.value,this.schedule()}}>
            ${t.map(p=>a`<option value=${p.id} ?selected=${p.id===this.calId}>${p.name}</option>`)}</select></div>
          <div class="fld"><label for="mt">כותרת</label><input id="mt" class="inp" maxlength="120" placeholder="למשל: החלפת גוף תאורה ובדיקת גלאים" .value=${this.evTitle}
            @input=${p=>this.evTitle=p.target.value} data-maint-title></div>
          <div class="fld"><span class="lbl">מתי</span><div class="ctls">
            <input class="inp num" type="date" lang=${pt()} aria-label="תאריך" .value=${this.date} @change=${p=>{this.date=p.target.value,this.schedule()}}>
            <input class="inp num" type="time" lang=${pt()} step="900" aria-label="משעה" .value=${this.from} @change=${p=>{this.from=p.target.value,this.schedule()}} data-maint-from>
            <input class="inp num" type="time" lang=${pt()} step="900" aria-label="עד שעה" .value=${this.to} @change=${p=>{this.to=p.target.value,this.schedule()}} data-maint-to></div></div>
          <div class="fld"><span class="lbl">חדרים</span><div class="rooms" role="group" aria-label="חדרים">${e.slice(0,this.ctx?.device==="phone"?6:10).map(p=>{const x=this.rooms.includes(p.id);return a`<button type="button" class="room" aria-pressed=${String(x)} data-room=${p.id} title=${p.name}
              @click=${()=>{this.rooms=x?this.rooms.filter(y=>y!==p.id):[...this.rooms,p.id],this.schedule()}}><span class="dot" style=${`--h:${I(p.color)}`}></span><span class="ell">${p.name}</span></button>`})}</div></div>
          <div class="fld"><label for="md">מכשירים</label><input id="md" class="inp" maxlength="200" placeholder='למשל: תאורה ו-2 גלאי עשן · "צפויה חריגה"' .value=${this.devices}
            @input=${p=>this.devices=p.target.value}></div>
          ${i.length?a`<div class=${`ovl ${n==="block"?"bad":""}`} data-overlaps>
            <b><sw-icon name="warning" size="16"></sw-icon>החלון חופף ל-<span class="num">${i.length}</span> ${i.length===1?"הזמנה":"הזמנות"}</b>
            ${g.map(p=>a`<div class="orow" data-overlap=${p.event_id}><div class="grow"><div class="t ell" title=${p.title??"תפוס"}>${p.title??"תפוס"}</div>
              <div class="s ell">${h(p.calendar_id)}${p.organizer?.name?` · ${p.organizer.name}`:""}</div></div>
              <b class="num ltr">${w(p.start)}–${w(p.end)}</b><span class=${`chip ${p.state==="confirmed"?"ok":"dash"}`}>${p.state==="confirmed"?"מאושר":Ut[p.state]}</span></div>`)}
            ${i.length>g.length?a`<span class="more num">ועוד ${i.length-g.length}</span>`:l}</div>
            <div class="modeline"><sw-icon name="info" size="14"></sw-icon>לפי ההגדרה: <b>${ce[n]}</b></div>
            ${n==="ask"?a`<div role="radiogroup" aria-label="מה יקרה להזמנות" style="display:flex;flex-direction:column;gap:6px">
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision==="override_notify")} data-decision="override_notify" @click=${()=>this.decision="override_notify"}><span class="rad"></span><span><b>התחזוקה גוברת</b><small>ההזמנות נדחקות והמארגנים מקבלים הודעה</small></span></button>
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision==="block")} data-decision="block" @click=${()=>this.decision="block"}><span class="rad"></span><span><b>לא להציב</b><small>לחזור ולבחור זמן אחר</small></span></button></div>`:a`<div class="muted" data-mode-text>${Pe[n]}</div>`}
            ${r&&s?.alternatives.length?a`<div class="sugg" data-alternatives>${s.alternatives.slice(0,3).map(p=>a`<button type="button" class="btn sm" @click=${()=>this.useAlt(p)}>
              ${W(new Date(p.start),o)?"":`${Z(new Date(p.start))} `}<span class="num ltr">${w(p.start)}–${w(p.end)}</span></button>`)}</div>`:l}`:s?a`<div class="note" data-no-overlap><sw-icon name="check" size="16"></sw-icon><div><b>אין חפיפה עם הזמנות</b><span class="muted">החלון יוצב מיד.</span></div></div>`:l}
          ${this.err?a`<div class="err" role="alert" data-maint-error>${this.err}</div>`:l}
        </div>
        <footer>
          <button type="button" class="btn pri" ?disabled=${r||this.busy||!t.length||!this.rooms.length} data-maint-save @click=${()=>void this.save()}><sw-icon name="wrench" size="16"></sw-icon>${m}</button>
          <button type="button" class="btn" @click=${()=>this.close()}>ביטול</button>
        </footer>
      </aside>`}};R.styles=[at,tt`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: in var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    @keyframes in { from { transform: translateX(24px); opacity: 0; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .body { flex: 1; min-block-size: 0; overflow: hidden; padding: 6px 22px 12px; display: flex; flex-direction: column; gap: 12px; }
    footer { display: flex; gap: 10px; padding: 14px 22px calc(14px + env(safe-area-inset-bottom)); border-block-start: 1px solid var(--sw-border); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; }
    .ctls > .inp { inline-size: auto; flex: 1 1 0; padding-inline: 10px; }
    .ctls > .inp[type='date'] { flex-grow: 1.5; }
    .rooms { display: flex; flex-wrap: wrap; gap: 6px; }
    .room { font: inherit; font-size: var(--sw-fs-sm); display: inline-flex; align-items: center; gap: 6px; min-block-size: 32px; padding: 0 12px; border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-text-2); cursor: pointer; max-inline-size: 100%; }
    .room[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-heading); border-color: transparent; font-weight: var(--sw-fw-semibold); }
    .room span.ell { max-inline-size: 180px; }
    .ovl { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-warning-soft); }
    .ovl.bad { background: var(--sw-danger-soft); }
    .ovl > b { display: flex; gap: 8px; align-items: center; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-solid); min-inline-size: 0; }
    .orow .t { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow .s { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .modeline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: flex; gap: 6px; align-items: center; }
    .modeline b { color: var(--sw-heading); }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .sugg { display: flex; gap: 8px; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .more { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    @media (max-width: 699px) {
      aside { inset: auto 0 0 0; inline-size: 100%; max-block-size: 94dvh; border-start-start-radius: var(--sw-r-2xl); border-start-end-radius: var(--sw-r-2xl); }
      header { padding: 14px 16px 6px; } .body { padding: 4px 16px 8px; gap: 10px; } footer { padding-inline: 16px; }
      .fld { grid-template-columns: minmax(0, 1fr); }
      @keyframes in { from { transform: translateY(24px); opacity: 0; } }
    }
    @media (prefers-reduced-motion: reduce) { aside { animation: none; } }
  `];F([K({attribute:!1})],R.prototype,"ctx",2);F([K({attribute:!1})],R.prototype,"detail",2);F([d()],R.prototype,"calId",2);F([d()],R.prototype,"evTitle",2);F([d()],R.prototype,"date",2);F([d()],R.prototype,"from",2);F([d()],R.prototype,"to",2);F([d()],R.prototype,"rooms",2);F([d()],R.prototype,"devices",2);F([d()],R.prototype,"preview",2);F([d()],R.prototype,"decision",2);F([d()],R.prototype,"busy",2);F([d()],R.prototype,"err",2);R=F([st("cal-maint-drawer")],R);var Le=Object.defineProperty,je=Object.getOwnPropertyDescriptor,T=(t,e,s,i)=>{for(var n=i>1?void 0:i?je(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&Le(e,s,n),n};const Ae={room:"door",team:"users",maintenance:"wrench",event:"calendar"},Tt={user:"משתמש",role:"תפקיד",department:"מחלקה",everyone:"כולם"},Re={none:"",always:"acc",outside_hours:"acc",on_behalf:"acc"},Et=300,qe=Jt.filter(t=>t!=="slate"),Kt=["first_holds","override_notify","block","ask"];let _=class extends et{constructor(){super(...arguments),this.ctx=null,this.shrink=!1,this.typ="",this.page=1,this.menuFor="",this.confirmArchive=null,this.members=null,this.memErr="",this.rev=0,this.side=!1,this.adding=!1,this.addKind="user",this.addId="",this.addRole="book",this.people=[],this.roles=[],this.draft=null,this.editing=null,this.formErr="",this.busy=!1,this.instOverlap="first_holds",this.listH=0,this.rowH=0,this.loadedFor="",this.ro=null,this.onDoc=t=>{this.menuFor&&!t.composedPath().some(e=>e.classList?.contains("menuwrap"))&&(this.menuFor="")}}connectedCallback(){super.connectedCallback(),document.addEventListener("pointerdown",this.onDoc,!0),this.ctx?.api.settings().then(t=>this.instOverlap=t.settings.maintenance_overlap).catch(()=>{})}disconnectedCallback(){super.disconnectedCallback(),document.removeEventListener("pointerdown",this.onDoc,!0),this.ro?.disconnect()}firstUpdated(){this.ro=new ResizeObserver(()=>this.measure()),this.ro.observe(this)}updated(){this.measure()}measure(){const t=this.renderRoot.querySelector(".list, .tablewrap");t&&Math.abs(t.clientHeight-this.listH)>4&&(this.listH=t.clientHeight);const e=t?.querySelector(".row, tbody tr"),s=e?e.offsetHeight+6:0;s&&Math.abs(s-this.rowH)>2&&(this.rowH=s)}willUpdate(t){if(!t.has("ctx")||!this.ctx)return;this.shrink=this.ctx.device==="tablet"&&this.ctx.access.ui.tablet_panels==="shrink";const e=this.ctx.sub;e==="new"&&!this.draft&&(this.draft=this.blank(),this.loadPeople()),e!=="new"&&!this.editing&&(this.draft=null),e&&e!=="new"&&e!==this.loadedFor&&(this.loadedFor=e,this.page=1,this.loadMembers(e)),e||(this.loadedFor="")}href(t){const e=ft()?"":window.location.hash.split("?")[1]??"";return`${this.ctx?.base??"#/calendars"}/manage${t}${e?`?${e}`:""}`}canManageAll(){return!!this.ctx?.access.can.manage}render(){if(!this.ctx)return l;const t=this.ctx.sub;return t==="new"||this.editing?this.formScreen():t?this.membersScreen(t):this.listScreen()}perPage(t,e){return this.listH?xt(this.listH+6,Math.max(t,this.rowH)):e}listScreen(){const t=this.ctx,e=t.q.trim(),s=t.cals.filter(c=>(!t.floor||!c.floor_id||c.floor_id===t.floor)&&(!e||c.name.includes(e)));if(!t.cals.length)return a`<section class="panel main"><div class="center" data-cal-state="empty"><sw-state-panel icon="calendar" state="empty" heading="אין יומנים עדיין"
        hint="יומן לכל חדר, לצוות האחזקה, לצוותים ולאירועים. כל יומן עם מנהל, סוג ואזור זמן." actionLabel=${this.canManageAll()?"יומן חדש":""}
        @action=${()=>location.hash=this.href("/new")}></sw-state-panel></div></section>`;const i=this.typ?s.filter(c=>c.type===this.typ):s,n=t.device==="phone",r=G(i,this.page,this.perPage(n?72:62,n?5:9)),o=At.map(c=>[c,s.filter(v=>v.type===c).length]);return a`<section class="panel main" data-manage-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="סוג יומן">
          <button type="button" aria-pressed=${String(!this.typ)} data-type="" @click=${()=>{this.typ="",this.page=1}}>הכל <span class="num">${s.length}</span></button>
          ${o.filter(([,c])=>c||!n).map(([c,v])=>a`<button type="button" aria-pressed=${String(this.typ===c)} data-type=${c} @click=${()=>{this.typ=c,this.page=1}}>${n?lt[c]:lt[c]} <span class="num">${v}</span></button>`)}
        </div>
        <span class="sp"></span>
        ${t.device==="desktop"?a`<span class="hint">ההרשאות נקבעות לכל יומן בנפרד</span>`:l}
        ${this.canManageAll()?a`<a class="btn sm" href=${this.href("/new")} data-new-calendar><sw-icon name="plus" size="14"></sw-icon>יומן חדש</a>`:l}
      </div>
      ${i.length?a`<div class="list">${r.items.map((c,v)=>this.calRow(c,v>=r.items.length-2))}</div>`:a`<div class="center"><span class="muted">אין יומנים מהסוג הזה</span></div>`}
      ${this.pager(r.page,r.pages)}
    </section>
    ${this.confirmArchive?this.archiveDialog(this.confirmArchive):l}`}syncChip(t){if(!t.sync)return a`<span class="chip" data-sync="none">ללא סנכרון</span>`;const e=de[t.sync.provider]??t.sync.provider;return t.sync.state==="ok"?a`<span class="chip ok" data-sync="ok">${e} · מסונכרן</span>`:t.sync.state==="needs_reauth"?a`<span class="chip warn" data-sync="reauth">${e} · נדרשת הרשאה</span>`:t.sync.state==="paused"?a`<span class="chip" data-sync="paused">${e} · מושהה</span>`:a`<span class="chip bad" data-sync="error">${e} · תקלה</span>`}calRow(t,e){const i=this.ctx.device,n=t.owner?.name?a`${t.owner.name}`:a`<span class="missing">חסר מנהל</span>`,r=[t.floor_name,t.capacity?`${t.capacity.toLocaleString("he-IL")} מקומות`:"",t.equipment.length?`${t.equipment.length} פריטי ציוד`:""].filter(Boolean).join(" · "),o=t.pending_count?a`<span class="chip dash num">${t.pending_count>999?"999+":t.pending_count.toLocaleString("he-IL")} ממתינות</span>`:l,c=()=>location.hash=this.href(`/${encodeURIComponent(t.id)}`);return i==="phone"?a`<div class="row" data-cal-row=${t.id} @click=${c}><span class="sq" style=${`--h:${I(t.color)}`}></span>
        <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${lt[t.type]} · ${n}</div></div>${o}</div>`:a`<div class="row" data-cal-row=${t.id}>
      <span class="sq" style=${`--h:${I(t.color)}`}></span>
      <div class="cname" @click=${c}><div class="name ell" title=${t.name}>${t.name}</div>
        <div class="sub ell">${i==="tablet"?a`${lt[t.type]} · מנהל: ${n} · ${ut[t.approval_mode]}`:r||" "}</div></div>
      ${i==="desktop"?a`<span class="type"><sw-icon name=${Ae[t.type]} size="14"></sw-icon>${lt[t.type]}</span>
        <div class="mgr ell" title=${t.owner?.name??""}><span class="sub">מנהל: </span><b>${n}</b></div>
        <span class=${`chip ${Re[t.approval_mode]}`}>${ut[t.approval_mode]}</span>`:l}
      <span class="sp"></span>
      ${o}${this.syncChip(t)}
      ${i==="desktop"?a`<span class="myrole ell">${t.my_role?nt[t.my_role]:"—"}</span>`:l}
      <div class="menuwrap"><button type="button" class="btn icon sm" aria-label="פעולות" aria-haspopup="menu" aria-expanded=${String(this.menuFor===t.id)} data-cal-menu=${t.id}
        @click=${()=>this.menuFor=this.menuFor===t.id?"":t.id}><sw-icon name="more" size="16"></sw-icon></button>
        ${this.menuFor===t.id?a`<div class=${`menu ${e?"up":""}`} role="menu">
          <button type="button" role="menuitem" @click=${c}><sw-icon name="users" size="14"></sw-icon>חברים ותפקידים</button>
          ${t.my_role==="manage"?a`<button type="button" role="menuitem" data-edit-rules @click=${()=>{this.menuFor="",this.openEdit(t)}}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>`:l}
          ${this.canManageAll()?a`<button type="button" role="menuitem" class="bad" data-archive=${t.id} @click=${()=>{this.menuFor="",this.confirmArchive=t,this.formErr=""}}><sw-icon name="trash" size="14"></sw-icon>העברה לארכיון</button>`:l}
        </div>`:l}</div>
    </div>`}pager(t,e){return a`<div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevron" size="14"></sw-icon></button>
      <span class="num" data-page>${t} / ${e}</span>
      <button type="button" class="btn" aria-label="הבא" ?disabled=${t>=e} @click=${()=>this.page=t+1}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`}archiveDialog(t){return a`<div class="scrim" @click=${()=>this.confirmArchive=null}></div>
      <aside class="panel overlay" style="inset-block:auto 12px" role="dialog" aria-label="העברה לארכיון" data-archive-dialog>
        <div class="ph"><h2 class="ell">להעביר את "${t.name}" לארכיון?</h2></div>
        <div class="muted">היומן יוסתר מכל המסכים. ההזמנות שכבר היו נשמרות; אפשר להחזיר אותו מהארכיון.</div>
        ${this.formErr?a`<div class="err" role="alert">${this.formErr}</div>`:l}
        <div class="formfoot"><button type="button" class="btn bad fill" ?disabled=${this.busy} data-archive-confirm @click=${()=>void this.archive(t)}>העברה לארכיון</button>
          <button type="button" class="btn" @click=${()=>this.confirmArchive=null}>ביטול</button></div>
      </aside>`}async archive(t){if(this.ctx){this.busy=!0;try{await this.ctx.api.archiveCalendar(t.id,t.revision),this.confirmArchive=null,E(this,$.toast,`"${t.name}" הועבר לארכיון`),E(this,$.changed)}catch(e){this.formErr=e instanceof U&&e.status===409?"ביומן יש הזמנות עתידיות מאושרות. צריך לבטל או להעביר אותן לפני ההעברה לארכיון.":D(e)}finally{this.busy=!1}}}async loadMembers(t){if(this.ctx){this.members=null,this.memErr="",this.rev=this.ctx.cals.find(e=>e.id===t)?.revision??0;try{this.members=(await this.ctx.api.members(t)).members}catch(e){this.memErr=e instanceof U&&e.status===403?"רק מנהל היומן רואה ומשנה את החברים.":D(e)}this.loadPeople()}}async loadPeople(){if(!this.people.length){if(!ft()){const t=[...new Set((this.ctx?.cals??[]).map(e=>e.owner?.name).filter(Boolean))];this.people=t.map((e,s)=>({id:`demo-${s}`,name:e})),this.roles=[{id:"operator",name:"מפעיל"},{id:"viewer",name:"צופה"},{id:"site_admin",name:"מנהל אתר"}];return}try{const[t,e]=await Promise.all([ve(),be()]);this.people=t.users.filter(s=>s.active).map(s=>({id:s.id,name:s.name||s.username})),this.roles=e.roles.map(s=>({id:s.id,name:e.labels[s.id]??s.name}))}catch{}}}async saveMembers(t,e){if(!this.ctx)return;const s=this.ctx.sub,i=this.members;this.members=t,this.memErr="";try{this.members=(await this.ctx.api.putMembers(s,this.rev,t)).members,this.rev+=1,E(this,$.toast,e)}catch(n){this.members=i,this.memErr=n instanceof U&&n.code==="stale"?"היומן עודכן בינתיים. הרשימה רועננה; נסו שוב.":D(n),n instanceof U&&n.code==="stale"&&this.loadMembers(s)}}rules(t){const e=[ut[t.approval_mode],`חפיפה: ${t.overlap_override?bt[t.overlap_override]:"לפי ההתקנה"}`,t.visibility==="members"?'גלוי לחברים; לאחרים "תפוס"':t.visibility==="busy_to_all"?'לכולם "תפוס"':"גלוי לכולם"];return t.buffer_after_min&&e.push(`${t.buffer_after_min} דק׳ הפסקה אחרי`),t.horizon_days&&e.push(`עד ${t.horizon_days} יום קדימה`),t.min_minutes&&t.max_minutes&&e.push(`${t.min_minutes} דק׳ עד ${t.max_minutes>=60?`${Math.round(t.max_minutes/60)} שע׳`:`${t.max_minutes} דק׳`}`),e}sidePanel(t){const e=this.members?.length??0;return a`<aside class=${`panel ${t?"overlay":""}`} aria-label="מה כל תפקיד מאפשר" data-roles-card>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">מה כל תפקיד מאפשר</h2>${t?a`<span class="sp"></span><button type="button" class="btn icon sm" aria-label="סגירה" @click=${()=>this.side=!1}><sw-icon name="close" size="14"></sw-icon></button>`:l}</div>
      <div class="rights">${$t.map(s=>a`<div class="rt"><b>${nt[s]}</b><span>${pe[s]}</span></div>`)}</div>
      <div class="note"><sw-icon name="info" size="16"></sw-icon><div><b>התפקיד ביומן לא עוקף את המערכת</b><span class="muted">הזמנה בשם חוג או לקוח, חלונות תחזוקה ופרטי אורחים דורשים גם הרשאה במערכת.</span></div></div>
      <span class="sp"></span><div class="muted num">${e.toLocaleString("he-IL")} מתוך ${Et} שורות חברות ביומן</div>
    </aside>`}membersScreen(t){const e=this.ctx,s=e.cals.find(h=>h.id===t);if(!s)return a`<section class="panel main"><div class="center"><sw-state-panel icon="calendar" state="empty" heading="היומן לא נמצא" hint="ייתכן שהועבר לארכיון או שאין לך גישה אליו."
        actionLabel="לכל היומנים" @action=${()=>location.hash=this.href("")}></sw-state-panel></div></section>`;const i=e.device==="phone",n=s.my_role==="manage",r=e.device==="desktop"||this.shrink?"inline":"overlay",o=this.rules(s),c=i?o.slice(0,2):o,v=this.members??[],m=this.listH?xt(this.listH-(i?0:46),Math.max(i?62:54,this.rowH)):i?4:6,g=G(v,this.page,m);return a`<section class="panel main" data-members=${s.id}>
      <div class="calhead">
        <a class="btn icon sm" href=${this.href("")} aria-label="לכל היומנים" data-back><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <span class="sq" style=${`--h:${I(s.color)}`}></span>
        <div class="grow"><h2 class="ell" title=${s.name}>${s.name}</h2>
          <div class="sub ell muted">${[lt[s.type],s.floor_name,s.capacity?`${s.capacity.toLocaleString("he-IL")} מקומות`:"",`מנהל: ${s.owner?.name||"—"}`].filter(Boolean).join(" · ")}</div></div>
        ${n&&!i?a`<button type="button" class="btn sm" data-edit-rules @click=${()=>this.openEdit(s)}><sw-icon name="edit" size="14"></sw-icon>כללי היומן</button>`:l}
        ${n?a`<button type="button" class="btn sm pri" data-add-member @click=${()=>{this.adding=!this.adding,this.addId=""}}><sw-icon name="plus" size="14"></sw-icon>${i?"הוספה":"הוספת חבר"}</button>`:l}
        ${r==="overlay"&&!i?a`<button type="button" class="btn icon sm" aria-label="מה כל תפקיד מאפשר" data-roles-open @click=${()=>this.side=!0}><sw-icon name="help" size="16"></sw-icon></button>`:l}
      </div>
      <div class="rulechips">${c.map((h,p)=>a`<span class=${`chip ${p===0&&s.approval_mode!=="none"?"acc":""}`}>${h}</span>`)}${o.length>c.length?a`<span class="chip num">+${o.length-c.length}</span>`:l}</div>
      <div class="ph"><h2 style="font-size:var(--sw-fs-lg)">חברים ותפקידים</h2><span class="sp"></span>${i?l:a`<span class="hint">${n?"שינוי תפקיד נשמר מיד ונרשם ביומן הפעולות":"רק מנהל היומן משנה תפקידים"}</span>`}</div>
      ${this.adding&&n?this.addRow(s):l}
      ${this.memErr?a`<div class="note bad" role="alert" data-members-error>${this.memErr}</div>`:l}
      ${!this.members&&!this.memErr?a`<div class="tablewrap" style="flex:1">${Array.from({length:4},()=>a`<div class="skel" style="block-size:44px;margin-block-end:6px"></div>`)}</div>`:a`<div class="tablewrap" style="flex:1;min-block-size:0;overflow:hidden">${i?a`<div class="list">${g.items.map(h=>this.memberCard(s,h))}</div>`:this.memberTable(s,g.items,n)}</div>`}
      ${this.pager(g.page,g.pages)}
    </section>
    ${i?l:r==="inline"?this.sidePanel(!1):this.side?a`<div class="scrim" @click=${()=>this.side=!1}></div>${this.sidePanel(!0)}`:l}`}isOwner(t,e){return e.subject_kind==="user"&&e.subject_id===t.owner?.id}memberTable(t,e,s){const i=this.ctx?.device==="tablet";return a`<table class="t"><colgroup><col style="inline-size:${i?84:110}px"><col><col style="inline-size:${i?330:380}px"><col style="inline-size:56px"></colgroup>
      <thead><tr><th>סוג</th><th>מי</th><th>תפקיד ביומן</th><th><span class="vh">הסרה</span></th></tr></thead>
      <tbody>${e.map(n=>{const r=this.isOwner(t,n);return a`<tr data-member=${`${n.subject_kind}:${n.subject_id}`}>
          <td>${Tt[n.subject_kind]}</td>
          <td><div style="display:flex;gap:6px;align-items:center;min-inline-size:0"><span class="who ell" title=${n.label}>${n.label||n.subject_id}</span>
            ${r?a`<span class="chip">מנהל אחראי</span>`:n.subject_kind==="everyone"?a`<span class="chip">רואים רק "תפוס"</span>`:l}</div></td>
          <td><span class="rolepick" role="group" aria-label=${`תפקיד של ${n.label}`}>${$t.map(o=>a`<button type="button" aria-pressed=${String(n.cal_role===o)} data-role=${o}
            ?disabled=${!s||r} @click=${()=>this.setRole(n,o)}>${nt[o]}</button>`)}</span></td>
          <td>${r||!s?l:a`<button type="button" class="btn icon sm" aria-label=${`הסרת ${n.label}`} data-remove @click=${()=>this.removeMember(n)}><sw-icon name="close" size="14"></sw-icon></button>`}</td>
        </tr>`})}</tbody></table>`}memberCard(t,e){const s=this.isOwner(t,e);return a`<div class="row" data-member=${`${e.subject_kind}:${e.subject_id}`}><div class="grow"><div class="name ell">${e.label||e.subject_id}</div>
      <div class="sub">${Tt[e.subject_kind]}${s?" · מנהל אחראי":""}</div></div>
      ${t.my_role==="manage"&&!s?a`<select class="inp" style="inline-size:auto;min-block-size:36px" aria-label="תפקיד" @change=${i=>this.setRole(e,i.target.value)}>
        ${$t.map(i=>a`<option value=${i} ?selected=${e.cal_role===i}>${nt[i]}</option>`)}</select>`:a`<span class=${`chip ${e.cal_role==="manage"?"acc":""}`}>${nt[e.cal_role]}</span>`}</div>`}setRole(t,e){t.cal_role===e||!this.members||this.saveMembers(this.members.map(s=>s===t?{...s,cal_role:e}:s),`${t.label}: ${nt[e]}`)}removeMember(t){this.members&&this.saveMembers(this.members.filter(e=>e!==t),`${t.label} הוסר מהיומן`)}addRow(t){const e=this.addKind==="user"?this.people:this.addKind==="role"?this.roles:[],s=new Set((this.members??[]).map(n=>`${n.subject_kind}:${n.subject_id}`)),i=(this.members?.length??0)>=Et;return a`<div class="addrow" data-add-row>
      <select class="inp k" aria-label="סוג" @change=${n=>{this.addKind=n.target.value,this.addId=""}}>
        ${["user","role","department","everyone"].map(n=>a`<option value=${n} ?selected=${n===this.addKind}>${Tt[n]}</option>`)}</select>
      ${this.addKind==="everyone"?a`<span class="grow muted">כל מי שיש לו צפייה ביומנים</span>`:e.length?a`<select class="inp" aria-label="מי" @change=${n=>this.addId=n.target.value} data-add-who>
            <option value="" ?selected=${!this.addId}>בחירה…</option>${e.filter(n=>!s.has(`${this.addKind}:${n.id}`)&&n.id!==t.owner?.id).map(n=>a`<option value=${n.id}>${n.name}</option>`)}</select>`:a`<input class="inp" aria-label="מזהה" placeholder=${this.addKind==="department"?"מזהה המחלקה":"מזהה"} .value=${this.addId} @input=${n=>this.addId=n.target.value.trim()} data-add-who>`}
      <select class="inp k" aria-label="תפקיד" @change=${n=>this.addRole=n.target.value}>
        ${$t.map(n=>a`<option value=${n} ?selected=${n===this.addRole}>${nt[n]}</option>`)}</select>
      <button type="button" class="btn sm pri" ?disabled=${i||this.addKind!=="everyone"&&!this.addId||s.has(`${this.addKind}:${this.addKind==="everyone"?"*":this.addId}`)} data-add-confirm
        @click=${()=>this.add(e)}>הוספה</button>
      ${i?a`<span class="err">הגעת ל-${Et} שורות. אפשר לצרף תפקיד או מחלקה במקום אנשים בודדים.</span>`:l}
    </div>`}add(t){const e=this.addKind==="everyone"?"*":this.addId,s=this.addKind==="everyone"?"כל מי שיש לו צפייה ביומנים":t.find(i=>i.id===e)?.name??e;this.adding=!1,this.saveMembers([...this.members??[],{subject_kind:this.addKind,subject_id:e,label:s,cal_role:this.addRole}],`${s} נוסף/ה כ${nt[this.addRole]}`)}blank(){return{name:"",type:"room",color:"blue",capacity:"",approval:"none",override:"",owner:"",buffer:"",horizon:""}}openEdit(t){this.editing=t,this.formErr="",this.draft={name:t.name,type:t.type,color:t.color,capacity:t.capacity?String(t.capacity):"",approval:t.approval_mode,override:t.overlap_override??"",owner:t.owner?.id??"",buffer:t.buffer_after_min!==void 0?String(t.buffer_after_min):"",horizon:t.horizon_days!==void 0?String(t.horizon_days):""},this.loadPeople()}allowedOverrides(){const t=this.ctx?.access.ui.override_scope??"both";return t==="none"?[]:t==="stricter"?Kt.filter(e=>Ht[e]>=Ht[this.instOverlap]):Kt}formScreen(){const t=this.draft??this.blank(),e=this.editing,s=o=>this.draft={...t,...o},i=this.allowedOverrides(),n=this.ctx?.access.ui.override_scope??"both",r=t.type==="room";return a`<section class="panel main" data-cal-form=${e?"edit":"new"}>
      <div class="ph"><a class="btn icon sm" href=${this.href(e?`/${encodeURIComponent(e.id)}`:"")} aria-label="חזרה" @click=${()=>{this.editing=null,this.draft=null}}><sw-icon name="chevronBack" size="16"></sw-icon></a>
        <h2>${e?`כללי היומן · ${e.name}`:"יומן חדש"}</h2></div>
      <div class="form">
        <div class="fld"><label for="cn">שם</label><input id="cn" class="inp" maxlength="80" .value=${t.name} @input=${o=>s({name:o.target.value})} data-f-name></div>
        <div class="fld"><span class="lbl">סוג</span><div class="seg" role="group" aria-label="סוג">${At.map(o=>a`<button type="button" aria-pressed=${String(t.type===o)} ?disabled=${!!e&&t.type!==o}
          data-f-type=${o} @click=${()=>s({type:o})}>${lt[o]}</button>`)}</div></div>
        <div class="fld"><span class="lbl">צבע</span><div class="hues" role="group" aria-label="צבע">${qe.map(o=>a`<button type="button" class="hue" style=${`--h:${I(o)}`} aria-pressed=${String(t.color===o)}
          aria-label=${o} data-f-color=${o} @click=${()=>s({color:o})}></button>`)}</div></div>
        <div class="fld"><label for="co">מנהל</label><select id="co" class="inp" @change=${o=>s({owner:o.target.value})}>
          <option value="" ?selected=${!t.owner}>${e?e.owner?.name||"ללא שינוי":"אני"}</option>${this.people.filter(o=>!e||o.id!==e.owner?.id).map(o=>a`<option value=${o.id} ?selected=${t.owner===o.id}>${o.name}</option>`)}</select></div>
        ${r?a`<div class="fld"><label for="cc">מקומות</label><input id="cc" class="inp num" type="number" min="1" max="2000" inputmode="numeric" .value=${t.capacity}
          @input=${o=>s({capacity:o.target.value})}></div>`:l}
        <div class="fld"><label for="ca">אישור</label><select id="ca" class="inp" @change=${o=>s({approval:o.target.value})} data-f-approval>
          ${Object.keys(ut).map(o=>a`<option value=${o} ?selected=${t.approval===o}>${ut[o]}</option>`)}</select></div>
        ${r?a`<div class="fld"><label for="cv">חפיפת תחזוקה</label>${i.length?a`<select id="cv" class="inp" @change=${o=>s({override:o.target.value})} data-f-override>
              <option value="" ?selected=${!t.override}>לפי ההתקנה (${bt[this.instOverlap]})</option>
              ${i.map(o=>a`<option value=${o} ?selected=${t.override===o}>${bt[o]}</option>`)}</select>`:a`<span class="muted" data-f-override-off>לפי ההתקנה (${bt[this.instOverlap]}). ההגדרות לא מאפשרות ליומן לקבוע אחרת.</span>`}</div>`:l}
        ${r?a`<div class="fld"><label for="cb">הפסקה אחרי</label><input id="cb" class="inp num" type="number" min="0" max="240" inputmode="numeric" placeholder="דקות" .value=${t.buffer}
          @input=${o=>s({buffer:o.target.value})}></div>`:l}
        <div class="fld"><label for="ch">טווח קדימה</label><input id="ch" class="inp num" type="number" min="1" max="730" inputmode="numeric" placeholder="ימים" .value=${t.horizon}
          @input=${o=>s({horizon:o.target.value})}></div>
      </div>
      ${n==="stricter"&&r?a`<div class="muted">מנהל יומן יכול לבחור רק חפיפה מחמירה מההגדרה הכללית.</div>`:l}
      ${this.formErr?a`<div class="err" role="alert" data-form-error>${this.formErr}</div>`:l}
      <div class="formfoot"><button type="button" class="btn pri" ?disabled=${this.busy||!t.name.trim()} data-f-save @click=${()=>void this.saveForm()}><sw-icon name="check" size="16"></sw-icon>${e?"שמירה":"יצירת היומן"}</button>
        <a class="btn" href=${this.href(e?`/${encodeURIComponent(e.id)}`:"")} @click=${()=>{this.editing=null,this.draft=null}}>ביטול</a></div>
    </section>`}async saveForm(){const t=this.draft;if(!this.ctx||!t)return;const e=n=>n.trim()===""?void 0:Number(n),s=t.type==="room",i={name:t.name.trim(),color:t.color,approval_mode:t.approval,overlap_override:s&&t.override||null};s&&e(t.capacity)!==void 0&&(i.capacity=e(t.capacity)),s&&e(t.buffer)!==void 0&&(i.buffer_after_min=e(t.buffer)),e(t.horizon)!==void 0&&(i.horizon_days=e(t.horizon)),t.owner&&(i.owner_user_id=t.owner),this.busy=!0,this.formErr="";try{if(this.editing){const n=this.editing;await this.ctx.api.patchCalendar(n.id,{...i,revision:n.revision}),this.editing=null,this.draft=null,E(this,$.toast,"כללי היומן נשמרו"),E(this,$.changed)}else{const{calendar:n}=await this.ctx.api.createCalendar({...i,type:t.type});this.draft=null,E(this,$.toast,`היומן "${n.name}" נוצר`),E(this,$.changed),location.hash=this.href(`/${encodeURIComponent(n.id)}`)}}catch(n){this.formErr=n instanceof U?n.code==="name_taken"?"כבר קיים יומן בשם הזה.":n.code==="too_many_calendars"?"הגעת למספר היומנים המרבי (הגדרות ‹ יומנים).":n.code==="stale"?"היומן עודכן בינתיים. רעננו ונסו שוב.":n.status===422?`ערך לא תקין: ${D(n)}`:D(n):D(n)}finally{this.busy=!1}}};_.styles=[at,tt`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .list > .row { flex: none; }
    .cname { flex: 0 0 300px; min-inline-size: 0; cursor: pointer; }
    .cname:hover .name { color: var(--sw-accent-text); }
    .type { flex: 0 0 84px; display: inline-flex; gap: 6px; align-items: center; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .mgr { flex: 0 0 180px; min-inline-size: 0; font-size: var(--sw-fs-sm); }
    .mgr b { color: var(--sw-heading); }
    .missing { color: var(--sw-warning-text); }
    .myrole { flex: 0 0 110px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .menuwrap { position: relative; }
    .menu { position: absolute; inset-block-start: calc(100% + 4px); inset-inline-end: 0; z-index: 5; min-inline-size: 190px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 6px; display: flex; flex-direction: column; }
    .menu.up { inset-block-start: auto; inset-block-end: calc(100% + 4px); }
    .menu button { font: inherit; font-size: var(--sw-fs-md); text-align: start; border: 0; background: transparent; color: var(--sw-heading); padding: 9px 12px; border-radius: var(--sw-r-md);
      cursor: pointer; display: flex; gap: 8px; align-items: center; }
    .menu button:hover { background: var(--sw-hover-wash); }
    .menu button.bad { color: var(--sw-danger-text); }
    .hint { font-size: var(--sw-fs-sm); color: var(--sw-text-3); }
    /* members */
    .calhead { display: flex; align-items: center; gap: 12px; min-inline-size: 0; flex-wrap: wrap; }
    .calhead .sq { inline-size: 40px; block-size: 40px; border-radius: var(--sw-r-md); }
    .calhead h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rulechips { display: flex; gap: 6px; flex-wrap: wrap; max-block-size: 64px; overflow: hidden; }
    table.t { inline-size: 100%; border-collapse: separate; border-spacing: 0 6px; table-layout: fixed; }
    table.t th { text-align: start; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-heading); padding: 8px 12px; background: var(--sw-surface-3); }
    table.t th:first-child { border-start-start-radius: var(--sw-r-md); border-end-start-radius: var(--sw-r-md); }
    table.t th:last-child { border-start-end-radius: var(--sw-r-md); border-end-end-radius: var(--sw-r-md); }
    table.t td { padding: 8px 12px; background: var(--sw-surface-2); vertical-align: middle; font-size: var(--sw-fs-md); }
    table.t td:first-child { border-start-start-radius: var(--sw-r-lg); border-end-start-radius: var(--sw-r-lg); color: var(--sw-text-2); }
    table.t td:last-child { border-start-end-radius: var(--sw-r-lg); border-end-end-radius: var(--sw-r-lg); text-align: end; }
    table.t td .who { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rolepick { display: inline-flex; gap: 2px; padding: 3px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .rolepick button { font: inherit; font-size: var(--sw-fs-sm); border: 0; background: transparent; color: var(--sw-text-2); padding: 5px 10px; border-radius: var(--sw-r-pill); cursor: pointer; white-space: nowrap; }
    .rolepick button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-bold); box-shadow: var(--sw-shadow-1); }
    .rolepick button[disabled] { cursor: default; }
    aside.panel { inline-size: 360px; flex: none; }
    .rights { display: flex; flex-direction: column; gap: 6px; }
    .rt { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 10px; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); }
    .rt b { color: var(--sw-heading); }
    .rt span { color: var(--sw-text-2); }
    .addrow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-accent-soft); }
    .addrow .inp { inline-size: auto; flex: 1; min-inline-size: 140px; background: var(--sw-surface-solid); }
    .addrow select.inp.k { flex: 0 0 120px; min-inline-size: 0; }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    aside.overlay { position: fixed; inset-block: 12px; inset-inline-start: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(380px, calc(100vw - 24px)); }
    :host([shrink]) aside.panel:not(.overlay) { inline-size: 280px; }
    :host([shrink]) .rt { grid-template-columns: minmax(0, 1fr); gap: 2px; }
    /* the calendar form */
    .form { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 24px; align-content: start; }
    .form .fld { grid-template-columns: 110px minmax(0, 1fr); }
    .hues { display: flex; gap: 8px; flex-wrap: wrap; }
    .hue { inline-size: 32px; block-size: 32px; border-radius: 50%; background: var(--h); border: 3px solid transparent; cursor: pointer; box-shadow: inset 0 0 0 2px var(--sw-surface-solid); }
    .hue[aria-pressed='true'] { border-color: var(--sw-heading); }
    .formfoot { display: flex; gap: 8px; margin-block-start: auto; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 1179px) {
      .cname { flex: 1; }
      .form { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 699px) {
      .form .fld { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .calhead h2 { font-size: var(--sw-fs-xl); }
      .addrow .inp, .addrow select.inp.k { flex: 1 1 100%; }
    }
  `];T([K({attribute:!1})],_.prototype,"ctx",2);T([K({type:Boolean,reflect:!0})],_.prototype,"shrink",2);T([d()],_.prototype,"typ",2);T([d()],_.prototype,"page",2);T([d()],_.prototype,"menuFor",2);T([d()],_.prototype,"confirmArchive",2);T([d()],_.prototype,"members",2);T([d()],_.prototype,"memErr",2);T([d()],_.prototype,"rev",2);T([d()],_.prototype,"side",2);T([d()],_.prototype,"adding",2);T([d()],_.prototype,"addKind",2);T([d()],_.prototype,"addId",2);T([d()],_.prototype,"addRole",2);T([d()],_.prototype,"people",2);T([d()],_.prototype,"roles",2);T([d()],_.prototype,"draft",2);T([d()],_.prototype,"editing",2);T([d()],_.prototype,"formErr",2);T([d()],_.prototype,"busy",2);T([d()],_.prototype,"instOverlap",2);T([d()],_.prototype,"listH",2);T([d()],_.prototype,"rowH",2);_=T([st("cal-view-manage")],_);var He=Object.defineProperty,Fe=Object.getOwnPropertyDescriptor,S=(t,e,s,i)=>{for(var n=i>1?void 0:i?Fe(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&He(e,s,n),n};const It={screen:"מסך",projector:"מקרן",video_call:"שיחת וידאו",whiteboard:"לוח",kitchen:"מטבח",accessible:"נגישות"},Be=[[30,"30 דק׳"],[60,"שעה"],[120,"שעתיים"],[180,"3 שעות"]],Nt=new Set(["book","edit","manage"]);let k=class extends et{constructor(){super(...arguments),this.ctx=null,this.tab="book",this.dayIdx=0,this.rooms=null,this.roomId="",this.duration=60,this.start=null,this.headcount=0,this.equip=new Set,this.sheet=null,this.mine=null,this.past=!1,this.error="",this.slow=!1,this.busy=!1,this.actionError="",this.done="",this.evTitle="",this.people=1,this.cancelScope="occurrence",this.alts=null,this.altPick=0,this.page=1,this.per=4,this.tlFrom=8,this.ro=null,this.slowTimer=0,this.drag=!1}connectedCallback(){super.connectedCallback(),this.loadDay(),this.loadMine()}disconnectedCallback(){super.disconnectedCallback(),this.ro?.disconnect(),clearTimeout(this.slowTimer)}willUpdate(t){(t.has("dayIdx")||t.has("roomId")||t.has("tab")||t.has("past")||t.has("duration"))&&(this.page=1),(t.has("roomId")||t.has("dayIdx"))&&(this.tlFrom=this.dayIdx===0?Vt(!0,this.now).from:8)}updated(){const t=this.renderRoot.querySelector("[data-fit]");this.ro??=new ResizeObserver(()=>this.fit()),this.ro.disconnect(),t&&(this.ro.observe(t),requestAnimationFrame(()=>this.fit()))}fit(){const t=this.renderRoot.querySelector("[data-fit]");if(!t)return;const e=getComputedStyle(t).gridTemplateColumns.split(" ").filter(Boolean).length||1,s=Math.max(0,...[...t.children].map(r=>r.offsetHeight+8)),i=Math.max(Number(t.dataset.fit)||66,s),n=e*xt(t.clientHeight+8,i);n!==this.per&&(this.per=n)}get now(){return this.ctx?.now??new Date}get day(){return P(C(this.now),this.dayIdx)}get ui(){return this.ctx.access.ui}async loadDay(){if(this.ctx){this.error="",this.slow=!1,clearTimeout(this.slowTimer),this.slowTimer=window.setTimeout(()=>this.slow=!0,300);try{const t=await this.ctx.api.roomsDay(A(this.day));this.rooms=t.rooms}catch(t){this.error=D(t)}finally{clearTimeout(this.slowTimer)}}}async loadMine(){if(this.ctx)try{const t=this.past?P(this.now,-30):this.now,e=this.past?this.now:P(this.now,31),s=await this.ctx.api.mine(t.toISOString(),e.toISOString());this.mine=s.occurrences.filter(i=>i.state!=="cancelled"&&i.state!=="withdrawn").sort((i,n)=>i.start.localeCompare(n.start))}catch(t){this.mine=[],this.error=D(t)}}cal(t){return this.ctx?.cals.find(e=>e.id===t)}roomList(){const t=this.ui.resident_rooms==="all_busy";return(this.rooms??[]).flatMap(e=>{const s=this.cal(e.calendar_id);if(!s)return[];const i=Nt.has(s.my_role??"");return!i&&!t?[]:this.headcount&&e.capacity&&this.headcount>e.capacity?[]:[...this.equip].some(n=>!e.equipment.includes(n))?[]:[{r:e,cal:s,bookable:i}]})}render(){if(!this.ctx)return l;const t=(this.mine??[]).length;return a`
      <h1>יומנים</h1>
      <div class="tabs" role="tablist" aria-label="יומנים">
        <button type="button" role="tab" aria-pressed=${String(this.tab==="book")} aria-selected=${String(this.tab==="book")} data-res-tab="book" @click=${()=>this.tab="book"}>הזמנת חדר</button>
        <button type="button" role="tab" aria-pressed=${String(this.tab==="mine")} aria-selected=${String(this.tab==="mine")} data-res-tab="mine" @click=${()=>{this.tab="mine",this.done=""}}>ההזמנות שלי${!this.past&&t?a` <b class="num">${t}</b>`:l}</button>
      </div>
      ${this.tab==="book"?this.bookView():this.mineView()}
      ${this.sheetView()}`}stateView(){return this.error?a`<div class="center"><sw-state-panel state="error" data-res-state="error" heading="לא הצלחנו לטעון את החדרים" hint=${this.error} actionLabel="לנסות שוב" @action=${()=>void this.loadDay()}></sw-state-panel></div>`:this.slow?this.ui.loading_style==="spinner"?a`<div class="center" data-res-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`:a`<section class="panel" data-res-state="loading" role="status" aria-label="טוען"><div class="skel" style="block-size:52px"></div>${[0,1,2,3].map(()=>a`<div class="skel" style="block-size:84px"></div>`)}</section>`:a`<section class="panel" aria-busy="true"></section>`}bookView(){if(!this.rooms)return this.stateView();const t=this.roomId?this.roomList().find(i=>i.r.calendar_id===this.roomId):void 0;if(t)return this.slotView(t.r,t.cal);const e=this.roomList(),s=G(e,this.page,this.per);return a`<section class="panel" data-res-view="rooms">
      ${this.dayStrip()}
      <div class="tools"><span class="hc"><sw-icon name="users" size="16"></sw-icon>
        <button type="button" aria-label="פחות אנשים" @click=${()=>this.headcount=Math.max(0,this.headcount-1)}>−</button><b class="num" data-res-headcount>${this.headcount||"כל"}</b>
        <button type="button" aria-label="יותר אנשים" @click=${()=>this.headcount+=1}>+</button> אנשים</span><span class="sp"></span>
        <button type="button" class="btn sm" data-res-equip @click=${()=>this.sheet={kind:"equip"}}><sw-icon name="filter" size="14"></sw-icon>ציוד${this.equip.size?a` <b class="num">${this.equip.size}</b>`:l}</button></div>
      ${e.length?a`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="92">${s.items.map(i=>this.roomCard(i.r,i.cal,i.bookable))}</div>${this.pager(s.page,s.pages)}`:a`<div class="center"><sw-state-panel icon="calendar" state="empty" data-res-state="empty" heading=${(this.rooms??[]).length?"אין חדר שמתאים לסינון":"אין חדרים פתוחים להזמנה בשבילך"}
          hint=${(this.rooms??[]).length?"אפשר לשנות את מספר האנשים או את הציוד.":"ההנהלה קובעת אילו חדרים דיירים יכולים להזמין."}></sw-state-panel></div>`}
    </section>`}dayStrip(){return a`<div class="days" role="group" aria-label="יום">${Array.from({length:7},(t,e)=>{const s=P(C(this.now),e);return a`<button type="button" aria-pressed=${String(this.dayIdx===e)} data-res-day=${e} aria-label=${`${J[s.getDay()]} ${Z(s)}`}
        @click=${()=>{this.dayIdx!==e&&(this.dayIdx=e,this.start=null,this.rooms=null,this.loadDay())}}><small>${e===0?"היום":ht[s.getDay()]}</small><b>${s.getDate()}</b></button>`})}</div>`}roomCard(t,e,s){const i=s?he(t.entries,this.day,t.open,30,this.now):null,n=e.approval_mode!=="none",r=t.equipment.map(o=>It[o]).join(" · ");return a`<button type="button" class="rcard" data-res-room=${t.calendar_id} aria-disabled=${String(!s)}
      @click=${()=>{s&&(this.roomId=t.calendar_id,this.start=null)}}>
      <span class="sq" style=${`--h:${I(e.color)}`}></span>
      <div class="grow"><div class="name ell" title=${t.name}>${t.name}</div><div class="sub ell">${t.capacity?a`<span class="num">${t.capacity}</span> מקומות`:"ללא הגבלת מקום"}${r?` · ${r}`:""}</div>
        <div class="mini" aria-hidden="true">${t.entries.map(o=>{const c=wt(o,this.day,7,23);return c?a`<i class=${o.state==="pending"?"p":""} style=${`left:${c.start}%;width:${c.width}%`}></i>`:l})}</div></div>
      <div class="rnext">${s?i?a`<small>פנוי מ־</small><b>${w(i)}</b>`:a`<b class="none">תפוס ${this.dayIdx?"ביום הזה":"היום"}</b>`:a`<b class="none">תפוס</b><small>צפייה בלבד</small>`}
        ${n&&s?a`<span class="chip acc">באישור</span>`:l}</div></button>`}pager(t,e){return e<=1?l:a`<div class="pager" data-res-pager><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${t<=1} @click=${()=>this.page=t-1}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <span class="num">${t} / ${e}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${t>=e} data-res-next @click=${()=>this.page=t+1}><sw-icon name="chevron" size="16"></sw-icon></button></div>`}slots(t){return St(t.entries,this.day,t.open,this.duration,30,this.now)}slotView(t,e){const s=e.approval_mode!=="none",i=this.start,n=i?new Date(i.getTime()+this.duration*6e4):null,r=this.ui.phone_time_picker==="timeline";return a`<section class="panel" data-res-view="slot" data-picker=${r?"timeline":"grid"}>
      <div class="shead"><span class="sq" style=${`--h:${I(e.color)}`}></span><div class="grow"><b class="ell" title=${t.name}>${t.name}</b>
        <span class="sub">${this.dayIdx===0?"היום":this.dayIdx===1?"מחר":ht[this.day.getDay()]} · ${J[this.day.getDay()]} ${Z(this.day)}${s?" · כל בקשה באישור":""}</span></div>
        <button type="button" class="btn icon" aria-label="חזרה לחדרים" data-res-back @click=${()=>{this.roomId="",this.start=null}}><sw-icon name="chevron" size="16"></sw-icon></button></div>
      <div class="seg dur" role="radiogroup" aria-label="משך">${Be.map(([o,c])=>a`<button type="button" role="radio" aria-pressed=${String(this.duration===o)} aria-checked=${String(this.duration===o)} data-res-dur=${o}
        @click=${()=>{this.duration=o,this.start=null}}>${c}</button>`)}</div>
      ${r?this.timelineView(t):this.gridView(t)}
      <button type="button" class="btn pri go" data-res-continue ?disabled=${!i} @click=${()=>{this.evTitle="",this.people=Math.max(1,this.headcount||1),this.actionError="",this.sheet={kind:"confirm"}}}>
        <sw-icon name="check" size="16"></sw-icon>${i&&n?a`המשך · <span class="num ltr">${w(i)}–${w(n)}</span>`:"בחירת שעת התחלה"}</button>
    </section>`}gridView(t){const e=this.ui.resident_pending_display,s=this.slots(t),i=G(s,this.page,this.per),n=this.start,r=n?n.getTime()+this.duration*6e4:0;return s.length?a`<div class="slots" data-fit="56" data-res-slots>${i.items.map(o=>{const c=ue(o,e),v=!!n&&o.start.getTime()>=n.getTime()&&o.start.getTime()<r;return a`<button type="button" class="slot" data-look=${c} ?data-sel=${v} data-res-slot=${w(o.start)} ?disabled=${c==="busy"||c==="blocked"}
        aria-label=${`${w(o.start)} ${c==="busy"?"תפוס":c==="blocked"?"יש בקשות ממתינות":c==="contest"?`${o.pending} מבקשים`:"פנוי"}`}
        @click=${()=>this.start=o.start}><b>${w(o.start)}</b>${c==="busy"?a`<small>תפוס</small>`:c==="blocked"?a`<small>ממתין</small>`:c==="contest"?a`<small>${o.pending} מבקשים</small>`:l}</button>`})}</div>
    ${this.pager(i.page,i.pages)}
    <div class="legend"><span><i class="lf"></i>פנוי</span>${e==="count"?a`<span><i class="lc"></i>יש בקשות ממתינות, אפשר לבקש</span>`:e==="blocked"?a`<span><i class="lb"></i>יש בקשות ממתינות</span>`:l}<span><i class="lb"></i>תפוס</span></div>`:a`<div class="center"><sw-state-panel icon="clock" state="empty" compact data-res-state="noslots" heading="אין שעות פנויות ביום הזה" hint="אפשר לבחור יום אחר או משך קצר יותר."></sw-state-panel></div>`}timelineView(t){const e={from:this.tlFrom,to:Math.min(24,this.tlFrom+6)},s=(e.to-e.from)*60,i=this.start,n=i?this.slotFree(t,i):!0,r=i?wt({start:i.toISOString(),end:new Date(i.getTime()+this.duration*6e4).toISOString()},this.day,e.from,e.to):null,o=c=>{const m=c.currentTarget.getBoundingClientRect(),g=Math.min(1,Math.max(0,(c.clientX-m.left)/m.width)),h=Math.round((e.from*60+g*s-this.duration/2)/15)*15,p=new Date(C(this.day).getTime()+Math.max(e.from*60,Math.min(e.to*60-this.duration,h))*6e4);p>=this.now&&(this.start=p)};return a`<div class="tl" data-res-timeline>
      <div class="tlnav"><button type="button" class="btn icon" aria-label="מוקדם יותר" ?disabled=${e.from<=0} @click=${()=>this.tlFrom=Math.max(0,this.tlFrom-3)}><sw-icon name="chevron" size="16"></sw-icon></button>
        <div class="tlsel num" data-res-tlsel>${i?a`<span class="ltr">${w(i)}–${w(new Date(i.getTime()+this.duration*6e4))}</span>${n?"":" · תפוס"}`:"נגיעה בפס בוחרת שעה"}</div>
        <button type="button" class="btn icon" aria-label="מאוחר יותר" ?disabled=${e.to>=24} @click=${()=>this.tlFrom=Math.min(18,this.tlFrom+3)}><sw-icon name="chevronBack" size="16"></sw-icon></button></div>
      <div class="bar" role="slider" aria-label="שעת התחלה" aria-valuetext=${i?w(i):""} tabindex="0" data-res-bar
        @pointerdown=${c=>{this.drag=!0,c.currentTarget.setPointerCapture(c.pointerId),o(c)}}
        @pointermove=${c=>{this.drag&&o(c)}} @pointerup=${()=>this.drag=!1} @pointercancel=${()=>this.drag=!1}
        @keydown=${c=>this.tlKey(c)}>
        ${t.entries.map(c=>{const v=wt(c,this.day,e.from,e.to);return v?a`<span class=${`e ${c.state==="pending"?"p":""}`} style=${`left:${v.start}%;width:${v.width}%`}></span>`:l})}
        ${r?a`<span class=${`sel ${n?"":"bad"}`} style=${`left:${r.start}%;width:${r.width}%`}></span>`:l}
      </div>
      <div class="axis" aria-hidden="true">${Array.from({length:e.to-e.from+1},(c,v)=>a`<span style=${`left:${v/(e.to-e.from)*100}%`}>${String(e.from+v).padStart(2,"0")}</span>`)}</div>
    </div>`}tlKey(t){const e=t.key==="ArrowRight"?15:t.key==="ArrowLeft"?-15:0;if(!e)return;t.preventDefault();const s=this.start??new Date(C(this.day).getTime()+this.tlFrom*36e5),i=new Date(s.getTime()+e*6e4);i>=this.now&&(this.start=i)}slotFree(t,e){const s=new Date(e.getTime()+this.duration*6e4),i=this.ui.resident_pending_display==="blocked";return!t.entries.some(n=>new Date(n.start)<s&&new Date(n.end)>e&&(n.state==="confirmed"||i&&n.state==="pending"))}mineView(){if(!this.mine)return this.stateView();const t=this.mine,e=G(t,this.page,this.per);return a`<section class="panel" data-res-view="mine">
      ${this.done?a`<div class="done" role="status" data-res-done><sw-icon name="check" size="18"></sw-icon><div><b>${this.done}</b><span class="muted">תקבל הודעה כשיוחלט</span></div></div>`:l}
      <div class="seg" style="align-self:center;flex:none" role="radiogroup" aria-label="הזמנות"><button type="button" role="radio" aria-pressed=${String(!this.past)} aria-checked=${String(!this.past)} data-res-upcoming
        @click=${()=>{this.past=!1,this.mine=null,this.loadMine()}}>קרובות</button>
        <button type="button" role="radio" aria-pressed=${String(this.past)} aria-checked=${String(this.past)} data-res-past @click=${()=>{this.past=!0,this.mine=null,this.loadMine()}}>הסתיימו</button></div>
      ${t.length?a`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="148">${e.items.map(s=>this.booking(s))}</div>${this.pager(e.page,e.pages)}`:a`<div class="center"><sw-state-panel icon="calendar" state="empty" data-res-state="mine-empty" heading=${this.past?"אין הזמנות שהסתיימו":"אין לך הזמנות קרובות"}
          hint=${this.past?"הזמנות שהסתיימו נשמרות כאן 30 יום.":'חדר פנוי אפשר להזמין בלשונית "הזמנת חדר".'} actionLabel=${this.past?"":"הזמנת חדר"} @action=${()=>this.tab="book"}></sw-state-panel></div>`}
    </section>`}booking(t){const e=this.cal(t.calendar_id),s={confirmed:["ok","מאושר"],pending:["dash","ממתין"],displaced:["warn","נדחק"],rejected:["bad","נדחה"],expired:["","פג"],done:["","הסתיים"]},[i,n]=s[t.state]??["",t.state],r=this.ui.resident_cancel_until,o=t.state==="confirmed"&&me(t.start,r,this.now),c=t.state==="pending"?`ממתין לאישור${t.contested?" · יש עוד בקשה לחלון":""}`:t.state==="displaced"?"נדחק בגלל תחזוקה. אפשר לבחור זמן אחר":t.state==="confirmed"?"מאושר":"";return a`<div class="bk" data-state=${t.state} data-res-booking=${t.event_id}>
      <div class="bkt"><span class="dot" style=${`--h:${I(e?.color)}`}></span><b title=${t.title??""}>${t.title??"הזמנה"}</b><span class=${`chip ${i}`}>${n}</span></div>
      <div class="bkw"><b>${X(t.start,t.end,this.now)}</b><span class="sub ell">${e?.name??""}${t.recurring?" · סדרה":""}</span></div>
      ${c?a`<div class="sub ell">${c}</div>`:l}
      ${this.past?l:t.state==="displaced"?a`<div class="bka"><button type="button" class="btn sm pri" data-res-alts @click=${()=>void this.openDisplaced(t)}>בחירת זמן חלופי</button>
          <button type="button" class="btn sm badtxt" data-res-cancel @click=${()=>this.openCancel(t)}>ביטול</button></div>`:t.state==="pending"?a`<div class="bka"><button type="button" class="btn sm badtxt" data-res-withdraw ?disabled=${this.busy} @click=${()=>void this.withdraw(t)}>משיכת הבקשה</button></div>`:t.state==="confirmed"?a`<div class="bka">${o?a`<span class="why" data-res-closed>${r==="start"?"המועד התחיל":`אפשר לבטל עד ${r==="1h"?"שעה":"24 שעות"} לפני; מנהל היומן יכול לבטל`}</span>`:l}
          <button type="button" class="btn sm badtxt" data-res-cancel ?disabled=${o} @click=${()=>this.openCancel(t)}>ביטול</button></div>`:l}
    </div>`}openCancel(t){this.cancelScope="occurrence",this.actionError="",this.sheet={kind:"cancel",o:t}}async withdraw(t){if(this.ctx){this.busy=!0;try{const e=await this.ctx.api.event(t.event_id);await this.ctx.api.withdrawEvent(t.event_id,e.event.revision),E(this,$.toast,"הבקשה נמשכה"),await this.loadMine()}catch(e){E(this,$.toast,D(e))}finally{this.busy=!1}}}async openDisplaced(t){if(!this.ctx)return;this.alts=null,this.altPick=0,this.actionError="",this.sheet={kind:"displaced",o:t};const e=this.ctx.api,s=new Date(t.start),i=new Date(t.end).getTime()-s.getTime(),n=Math.max(15,Math.round(i/6e4)),r=C(s),o=[];try{const[c,v]=await Promise.all([e.roomsDay(A(r)),e.roomsDay(A(P(r,1)))]),m=(u,f)=>u.find(b=>b.calendar_id===f),g=m(c.rooms,t.calendar_id),h=g&&St(g.entries.filter(u=>u.event_id!==t.event_id),r,g.open,n,30,this.now).find(u=>u.free&&u.start.getTime()>=new Date(t.end).getTime());h&&o.push({calendar_id:t.calendar_id,start:h.start,end:new Date(h.start.getTime()+i),note:"אותו חדר, אותו אורך"});const p=m(v.rooms,t.calendar_id),x=new Date(s.getTime()+864e5);p&&St(p.entries,P(r,1),p.open,n,15,this.now).some(u=>u.free&&u.start.getTime()===x.getTime())&&o.push({calendar_id:t.calendar_id,start:x,end:new Date(x.getTime()+i),note:"אותה שעה, יום אחר"});const y=c.rooms.find(u=>u.calendar_id!==t.calendar_id&&Nt.has(this.cal(u.calendar_id)?.my_role??"")&&!u.entries.some(f=>f.state==="confirmed"&&new Date(f.start)<new Date(t.end)&&new Date(f.end)>s));y&&o.push({calendar_id:y.calendar_id,start:s,end:new Date(t.end),note:`אותה שעה, חדר אחר${this.cal(y.calendar_id)?.approval_mode!=="none"?" · באישור":""}`})}catch(c){this.actionError=D(c)}this.alts=o.slice(0,3)}close(){this.sheet=null}sheetView(){const t=this.sheet;if(!t)return l;const e=a`<div class="scrim" @click=${()=>this.close()}></div>`;return t.kind==="equip"?a`${e}<aside class="sheet" role="dialog" aria-label="ציוד" data-res-sheet="equip"><div class="grab" aria-hidden="true"></div>
        <header><div class="grow"><h2>ציוד בחדר</h2><div class="muted">רק חדרים שיש בהם הכול</div></div><button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body"><div class="eq">${Object.keys(It).map(s=>a`<button type="button" aria-pressed=${String(this.equip.has(s))} data-res-eq=${s}
          @click=${()=>{const i=new Set(this.equip);i.has(s)?i.delete(s):i.add(s),this.equip=i}}>${It[s]}</button>`)}</div></div>
        <footer><button type="button" class="btn pri" style="flex:1" @click=${()=>this.close()}>הצגת חדרים</button><button type="button" class="btn" @click=${()=>this.equip=new Set}>ניקוי</button></footer></aside>`:t.kind==="confirm"?a`${e}${this.confirmSheet()}`:t.kind==="cancel"?a`${e}${this.cancelSheet(t.o)}`:a`${e}${this.displacedSheet(t.o)}`}confirmSheet(){const t=this.roomList().find(v=>v.r.calendar_id===this.roomId);if(!t||!this.start)return l;const{r:e,cal:s}=t,i=new Date(this.start.getTime()+this.duration*6e4),n=e.entries.filter(v=>v.state==="pending"&&new Date(v.start)<i&&new Date(v.end)>this.start).length,r=s.approval_mode!=="none"||n>0||!this.slotFree(e,this.start),o=s.owner.name||"מנהל החדר",c=s.approval_timeout_h??2;return a`<aside class="sheet" role="dialog" aria-label="אישור הזמנה" data-res-sheet="confirm"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>${r?`בקשה להזמנת ${s.name}`:`הזמנת ${s.name}`}</h2><div class="muted ell">${s.name} · ${X(this.start.toISOString(),i.toISOString(),this.now)}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="fld"><label for="rt">כותרת</label><input id="rt" class="inp" data-res-title maxlength="120" placeholder="למשל: יום הולדת" .value=${this.evTitle} @input=${v=>this.evTitle=v.target.value}></div>
        <div class="fld"><span class="lbl">משתתפים</span><span class="hc"><button type="button" aria-label="פחות" @click=${()=>this.people=Math.max(1,this.people-1)}>−</button>
          <b class="num" data-res-people>${this.people}</b><button type="button" aria-label="יותר" @click=${()=>this.people=Math.min(e.capacity??2e3,this.people+1)}>+</button>${e.capacity?a`מתוך <span class="num">${e.capacity}</span>`:l}</span></div>
        <div class="lockline"><sw-icon name="lock" size="14"></sw-icon><span>הזמנה בשמך. הזמנה בשם חוג או לקוח רק לצוות.</span></div>
        ${r?a`<div class="note" data-res-approval><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח ל${o}</b>
          <span>בקשה לא שומרת את המועד.${n?` יש עוד ${n===1?"בקשה אחת":`${n} בקשות`} לחלון הזה; מי שיאושר ראשון יקבל אותו.`:""} אם לא תאושר, תקבל הצעות לזמן אחר.</span></div></div>
          <div class="hint"><sw-icon name="clock" size="14"></sw-icon>${c?`אם לא תהיה החלטה עד ${c===1?"שעה":c===2?"שעתיים":`${c} שעות`} לפני, הבקשה תפוג ותקבל הודעה.`:"אם לא תהיה החלטה עד תחילת המועד, הבקשה תפוג."}</div>`:l}
        ${this.actionError?a`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:l}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-submit ?disabled=${this.busy} @click=${()=>void this.submit(s,r)}><sw-icon name="check" size="16"></sw-icon>${r?"שליחה לאישור":"הזמנה"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>חזרה</button></footer></aside>`}async submit(t,e){if(!this.ctx||!this.start)return;this.busy=!0,this.actionError="";const s=new Date(this.start.getTime()+this.duration*6e4);try{const i=await this.ctx.api.createEvent({calendar_id:t.id,kind:"booking",title:this.evTitle.trim()||"הזמנת חדר",start:this.start.toISOString(),end:s.toISOString(),headcount:this.people});this.sheet=null,this.start=null,this.roomId="",this.done=i.state==="pending"||e?`הבקשה נשלחה ל${t.owner.name||"מנהל החדר"}`:"ההזמנה נקבעה",this.tab="mine",this.past=!1,this.rooms=null,this.loadDay(),await this.loadMine()}catch(i){this.actionError=D(i)}finally{this.busy=!1}}cancelSheet(t){const e=this.cal(t.calendar_id);return a`<aside class="sheet" role="alertdialog" aria-label="ביטול הזמנה" data-res-sheet="cancel"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>לבטל את "${t.title??"ההזמנה"}"?</h2><div class="muted ell">${e?.name??""} · ${X(t.start,t.end,this.now)}</div></div></header>
      <div class="body">
        ${t.recurring?a`<div role="radiogroup" aria-label="מה לבטל" style="display:grid;gap:8px">
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope==="occurrence")} data-res-scope="occurrence" @click=${()=>this.cancelScope="occurrence"}><span class="rad"></span><div><b>רק ${ht[new Date(t.start).getDay()]} ${Z(new Date(t.start))}</b><small>שאר המועדים נשארים</small></div></button>
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope==="series")} data-res-scope="series" @click=${()=>this.cancelScope="series"}><span class="rad"></span><div><b>כל הסדרה</b><small>מועדים שעברו נשארים בהיסטוריה</small></div></button></div>`:l}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>החדר יתפנה מיד ומי שביקש אותו יקבל הודעה.</div>
        ${this.actionError?a`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:l}
      </div>
      <footer><button type="button" class="btn bad fill" style="flex:1" data-res-cancel-ok ?disabled=${this.busy} @click=${()=>void this.cancel(t)}><sw-icon name="trash" size="16"></sw-icon>${t.recurring&&this.cancelScope==="series"?"ביטול הסדרה":"ביטול המועד"}</button>
        <button type="button" class="btn" @click=${()=>this.close()}>השארה</button></footer></aside>`}async cancel(t){if(this.ctx){this.busy=!0,this.actionError="";try{const e=await this.ctx.api.event(t.event_id);await this.ctx.api.cancelEvent(t.event_id,e.event.revision,t.recurring&&this.cancelScope==="occurrence"?t.start:void 0),this.sheet=null,E(this,$.toast,"ההזמנה בוטלה"),await this.loadMine()}catch(e){this.actionError=D(e)}finally{this.busy=!1}}}displacedSheet(t){const e=this.alts;return a`<aside class="sheet" role="dialog" aria-label="בחירת זמן חלופי" data-res-sheet="displaced"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>בחירת זמן חלופי</h2><div class="muted">"${t.title??"ההזמנה"}" נדחקה בגלל תחזוקה ב${this.cal(t.calendar_id)?.name??"חדר"}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${()=>this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${e===null?a`${[0,1,2].map(()=>a`<div class="skel" style="block-size:56px"></div>`)}`:e.length?a`<div role="radiogroup" aria-label="זמן חלופי" style="display:grid;gap:8px">${e.map((s,i)=>a`<button type="button" class="opt" role="radio" aria-checked=${String(this.altPick===i)} data-res-alt=${i}
            @click=${()=>this.altPick=i}><span class="rad"></span><div><b class="num">${X(s.start.toISOString(),s.end.toISOString(),this.now)} · ${this.cal(s.calendar_id)?.name??""}</b><small>${s.note}</small></div></button>`)}</div>`:a`<div class="note warn">אין כרגע זמן חלופי קרוב. אפשר לבחור זמן בלשונית "הזמנת חדר".</div>`}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>Arx לא מזיז הזמנות לבד. אם לא תבחר, ההזמנה נשארת "נדחק" עד שתבטל.</div>
        ${this.actionError?a`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>`:l}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-alt-ok ?disabled=${!e?.length||this.busy} @click=${()=>void this.rebook(t)}><sw-icon name="check" size="16"></sw-icon>קביעה בזמן הזה</button>
        <button type="button" class="btn" @click=${()=>this.openCancel(t)}>ביטול ההזמנה</button></footer></aside>`}async rebook(t){const e=this.alts?.[this.altPick];if(!(!this.ctx||!e)){this.busy=!0,this.actionError="";try{const s=await this.ctx.api.createEvent({calendar_id:e.calendar_id,kind:"booking",title:t.title??"הזמנת חדר",start:e.start.toISOString(),end:e.end.toISOString()}),i=await this.ctx.api.event(t.event_id);await this.ctx.api.cancelEvent(t.event_id,i.event.revision),this.sheet=null,this.done=s.state==="pending"?"הבקשה לזמן החדש נשלחה לאישור":"ההזמנה נקבעה בזמן החדש",await this.loadMine()}catch(s){this.actionError=D(s)}finally{this.busy=!1}}}};k.styles=[at,tt`
    :host { display: flex; flex-direction: column; min-block-size: 0; gap: 10px; overflow: hidden; }
    h1 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); line-height: 1.15; }
    .tabs { display: flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .tabs button { flex: 1; font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); min-block-size: 40px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; -webkit-tap-highlight-color: transparent; }
    .tabs button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .panel { flex: 1; padding: 12px; gap: 10px; }
    .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; flex: none; }
    .days button { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 52px; display: grid; place-items: center;
      align-content: center; gap: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; padding: 4px 0; }
    .days small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .days b { font-size: var(--sw-fs-xl); font-variant-numeric: tabular-nums; }
    .days button[aria-pressed='true'] { background: var(--sw-accent); color: var(--sw-text-inverse); }
    .days button[aria-pressed='true'] small { color: var(--sw-text-inverse); }
    .tools { display: flex; align-items: center; gap: 8px; flex: none; }
    .hc { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .hc button { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); font: inherit; cursor: pointer; padding: 0; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .rcard { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 0; font: inherit; color: inherit; text-align: start;
      cursor: pointer; inline-size: 100%; min-block-size: 84px; -webkit-tap-highlight-color: transparent; transition: transform var(--sw-t-press) var(--sw-ease); }
    .rcard:active { transform: scale(0.98); }
    .rcard[aria-disabled='true'] { cursor: default; opacity: 0.75; }
    .rcard .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rcard .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .rnext { display: grid; justify-items: end; gap: 2px; flex: none; text-align: end; }
    .rnext small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .rnext b { font-size: var(--sw-fs-xl); color: var(--sw-success-text); font-variant-numeric: tabular-nums; }
    .rnext b.none { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .mini { position: relative; block-size: 10px; margin-block-start: 8px; direction: ltr; }
    .mini i { position: absolute; inset-block: 1px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); }
    .mini i.p { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-3); }
    .shead { display: flex; align-items: center; gap: 10px; flex: none; }
    .shead b { display: block; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .shead .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .dur { align-self: center; flex: none; }
    .slots { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-content: start; overflow: hidden; }
    .slot { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 48px; display: grid; place-items: center; align-content: center;
      cursor: pointer; padding: 4px 2px; -webkit-tap-highlight-color: transparent; }
    .slot b { font-size: var(--sw-fs-md); font-variant-numeric: tabular-nums; }
    .slot small { font-size: var(--sw-fs-2xs); color: var(--sw-text-2); }
    .slot[data-look='contest'] { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .slot[data-look='busy'], .slot[data-look='blocked'] { cursor: default; color: var(--sw-text-3); }
    .slot[data-look='busy'] b { text-decoration: line-through; }
    .slot[data-sel] { background: var(--sw-accent); color: var(--sw-text-inverse); outline: 0; }
    .slot[data-sel] small { color: var(--sw-text-inverse); }
    .legend { flex: none; }
    .legend i.lf { background: var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border); }
    .legend i.lc { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .legend i.lb { background: var(--sw-surface-3); }
    .go { inline-size: 100%; min-block-size: 52px; font-size: var(--sw-fs-lg); flex: none; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
    .bar { position: relative; block-size: 72px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); direction: ltr; touch-action: none; cursor: pointer; overflow: hidden; }
    .bar .e { position: absolute; inset-block: 10px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .bar .e.p { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .bar .sel { position: absolute; inset-block: 4px; border-radius: var(--sw-r-sm); background: color-mix(in srgb, var(--sw-accent) 30%, transparent); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .bar .sel.bad { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .axis { position: relative; block-size: 16px; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .axis span { position: absolute; transform: translateX(-50%); font-variant-numeric: tabular-nums; }
    .tlnav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tlsel { text-align: center; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .bk { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; flex: none; }
    .bk[data-state='displaced'] { box-shadow: inset 0 0 0 1.5px var(--sw-warning); background: var(--sw-surface-solid); }
    .bkt { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
    .bkt b { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bkw { display: flex; align-items: baseline; gap: 8px; min-inline-size: 0; }
    .bkw b { font-size: var(--sw-fs-lg); color: var(--sw-heading); font-variant-numeric: tabular-nums; flex: none; }
    .bka { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; align-items: center; }
    .bka .why { font-size: var(--sw-fs-xs); color: var(--sw-text-3); margin-inline-end: auto; }
    .sugg { display: flex; flex-wrap: wrap; gap: 6px; }
    .sugg button { font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); border: 0; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text);
      padding: 6px 12px; cursor: pointer; min-block-size: 32px; }
    .btn.badtxt { color: var(--sw-danger-text); }
    .done { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-success-soft); color: var(--sw-success-text); flex: none; }
    .done b { color: var(--sw-heading); display: block; }
    .center { display: grid; place-items: center; flex: 1; }
    /* the bottom sheet (mobile-native: safe area, 16 px inputs, 44 px targets, the grab handle) */
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); animation: fade var(--sw-t-sheet) var(--sw-ease); }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; z-index: var(--sw-z-modal); background: var(--sw-surface-solid); border-start-start-radius: var(--sw-r-2xl);
      border-start-end-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); display: flex; flex-direction: column; max-block-size: 88dvh;
      padding-block-end: env(safe-area-inset-bottom); animation: up var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    .grab { inline-size: 40px; block-size: 5px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); margin: 8px auto 0; }
    .sheet header { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px 6px; }
    .sheet header h2 { margin: 0; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .sheet .body { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 10px; overflow: auto; overscroll-behavior: contain; }
    .sheet footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-block-start: 1px solid var(--sw-border); }
    .sheet footer .btn { min-block-size: 48px; }
    .x { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); display: grid; place-items: center;
      cursor: pointer; flex: none; padding: 0; }
    .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer;
      text-align: start; font: inherit; color: inherit; inline-size: 100%; min-block-size: 44px; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .rad { flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%; border: 2px solid var(--sw-border-strong); display: grid; place-items: center; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border-color: var(--sw-accent); }
    .opt[aria-checked='true'] .rad::after { content: ''; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .lockline { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .eq { display: flex; flex-wrap: wrap; gap: 8px; }
    .eq button { font: inherit; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); border-radius: var(--sw-r-pill); min-block-size: 44px; padding: 0 16px; cursor: pointer; }
    .eq button[aria-pressed='true'] { background: var(--sw-accent-soft); border-color: var(--sw-accent); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    @keyframes up { from { transform: translateY(100%); } }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .sheet, .scrim { animation: none; } .rcard { transition: none; } }
    @media (hover: hover) { .rcard:hover { background: var(--sw-surface-3); } }
  `];S([K({attribute:!1})],k.prototype,"ctx",2);S([d()],k.prototype,"tab",2);S([d()],k.prototype,"dayIdx",2);S([d()],k.prototype,"rooms",2);S([d()],k.prototype,"roomId",2);S([d()],k.prototype,"duration",2);S([d()],k.prototype,"start",2);S([d()],k.prototype,"headcount",2);S([d()],k.prototype,"equip",2);S([d()],k.prototype,"sheet",2);S([d()],k.prototype,"mine",2);S([d()],k.prototype,"past",2);S([d()],k.prototype,"error",2);S([d()],k.prototype,"slow",2);S([d()],k.prototype,"busy",2);S([d()],k.prototype,"actionError",2);S([d()],k.prototype,"done",2);S([d()],k.prototype,"evTitle",2);S([d()],k.prototype,"people",2);S([d()],k.prototype,"cancelScope",2);S([d()],k.prototype,"alts",2);S([d()],k.prototype,"altPick",2);S([d()],k.prototype,"page",2);S([d()],k.prototype,"per",2);S([d()],k.prototype,"tlFrom",2);k=S([st("cal-resident")],k);var Ke=Object.defineProperty,Ne=Object.getOwnPropertyDescriptor,V=(t,e,s,i)=>{for(var n=i>1?void 0:i?Ne(e,s):e,r=t.length-1,o;r>=0;r--)(o=t[r])&&(n=(i?o(e,s,n):o(n))||n);return i&&n&&Ke(e,s,n),n};const Ve={cal:"יומן",rooms:"חדרים לפי שעות",approvals:"אישורים",maint:"תחזוקה",manage:"ניהול יומנים"},Ue={cal:"יומן",rooms:"חדרים",approvals:"אישורים",maint:"תחזוקה",manage:"ניהול"};let H=class extends et{constructor(){super(...arguments),this.route=null,this.access=Zt(),this.cals=null,this.error="",this.floor="",this.q="",this.floorNames={},this.slow=!1,this.device="desktop",this.drawer=null,this.toastText="",this.api=null,this.stop=null,this.slowTimer=0,this.toastTimer=0,this.onResize=()=>this.measure()}connectedCallback(){super.connectedCallback(),this.measure(),window.addEventListener("resize",this.onResize),this.stop=te(t=>this.access=t),Rt(),this.load(),this.addEventListener($.newEvent,t=>this.drawer={kind:"event",d:t.detail??{}}),this.addEventListener($.newMaint,t=>this.drawer={kind:"maint",d:t.detail??{}}),this.addEventListener($.changed,()=>void this.load(!0)),this.addEventListener($.toast,t=>this.toast(t.detail))}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("resize",this.onResize),this.stop?.(),clearTimeout(this.slowTimer),clearTimeout(this.toastTimer)}willUpdate(t){const e=t.get("route");t.has("route")&&e&&e.params.toString()!==this.route?.params.toString()&&(e.params.get("role")!==this.route?.params.get("role")&&Rt(),this.load())}measure(){const t=window.innerWidth;this.device=t<700?"phone":t<1180?"tablet":"desktop"}async load(t=!1){t||(this.error="",this.slow=!1,clearTimeout(this.slowTimer),this.slowTimer=window.setTimeout(()=>this.slow=!0,300));try{this.api??=await ee();const[{calendars:e}]=await Promise.all([this.api.calendars(),this.loadFloors()]);this.cals=e.filter(s=>!s.archived),this.error=""}catch(e){t||(this.cals=null),this.error=D(e)}finally{clearTimeout(this.slowTimer)}}async loadFloors(){if(!(!ft()||Object.keys(this.floorNames).length))try{const t=await se();this.floorNames=Object.fromEntries((t.floors??[]).map(e=>[e.floor_id,e.name]))}catch{}}toast(t){this.toastText=t,clearTimeout(this.toastTimer),this.toastTimer=window.setTimeout(()=>this.toastText="",3200)}get view(){const t=this.route?.segments??[],e=this.route?.mode==="devices"?t[2]:t[1];return e&&Ft.includes(e)?e:"cal"}get sub(){const t=this.route?.segments??[];return decodeURIComponent((this.route?.mode==="devices"?t[3]:t[2])??"")}manages(){return(this.cals??[]).some(t=>t.my_role==="manage")}offered(t){const e=this.access.can;return t==="approvals"?this.manages():t==="maint"?e.maintenance:t==="manage"?e.manage||this.manages():!0}ctx(){return{api:this.api,access:this.access,cals:this.cals??[],floor:this.floor,q:this.q,base:zt(this.route),sub:this.sub,now:new Date,device:this.device,manages:this.manages()}}floors(){const t=new Map;for(const e of this.cals??[])e.floor_id&&!t.has(e.floor_id)&&t.set(e.floor_id,this.floorNames[e.floor_id]??e.floor_name??e.floor_id);return[...t].map(([e,s])=>({id:e,name:s})).sort((e,s)=>e.name.localeCompare(s.name,"he"))}render(){const t=this.access;if(t.enabled===!1&&ft())return a`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="off" heading="מודול היומנים כבוי"
        hint=${t.can.configure?"אפשר להפעיל אותו בהגדרות ‹ יומנים.":"מנהל המערכת יכול להפעיל אותו."} actionLabel=${t.can.configure?"הפעלת מודול היומנים":""}
        @action=${()=>location.hash=ae}></sw-state-panel></div>`;if(t.enabled&&!t.can.view)return a`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel state="forbidden" data-cal-state="forbidden" heading="אין לך גישה ליומנים"></sw-state-panel></div>`;const e=this.device==="phone"&&!!this.cals&&!this.manages()&&!t.can.manage&&!t.can.maintenance;return a`
      ${e?l:this.head()}
      <div class="body" data-cal-body data-view=${this.view}>${this.content(e)}</div>
      ${this.drawer?.kind==="event"&&this.api?a`<cal-event-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${()=>this.drawer=null}></cal-event-drawer>`:l}
      ${this.drawer?.kind==="maint"&&this.api?a`<cal-maint-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${()=>this.drawer=null}></cal-maint-drawer>`:l}
      ${this.toastText?a`<div class="toast" role="status" data-cal-toast>${this.toastText}</div>`:l}`}head(){const t=this.floors(),e=Ft.filter(r=>this.offered(r)),s=zt(this.route),i=this.device==="phone",n=(this.cals??[]).filter(r=>r.my_role==="manage").reduce((r,o)=>r+o.pending_count,0);return a`
      <div class="top">
        <h1>יומנים</h1><span class="sp"></span>
        ${t.length>1?a`<div class="floors" role="group" aria-label="קומה">
          <button type="button" class="chipb" aria-pressed=${String(this.floor==="")} data-floor="" @click=${()=>this.floor=""}>הכל</button>
          ${t.map(r=>a`<button type="button" class="chipb" aria-pressed=${String(this.floor===r.id)} data-floor=${r.id} @click=${()=>this.floor=r.id}>${r.name}</button>`)}
        </div>`:l}
      </div>
      <div class="bar">
        <nav class="tabs" aria-label="תצוגות היומנים">
          ${e.map(r=>a`<a class="tab" href=${`${s}/${r}${this.demoQuery()}`} aria-current=${this.view===r?"page":"false"} data-cal-tab=${r}>
            ${i?Ue[r]:Ve[r]}${r==="approvals"&&n?a`<span class="count num">${n>99?"99+":n}</span>`:l}${r==="manage"&&!i?a`<span class="n num">${(this.cals??[]).length}</span>`:l}</a>`)}
        </nav>
        <span class="sp"></span>
        <label class="search"><sw-icon name="search" size="16"></sw-icon><span class="vh">חיפוש ביומנים</span>
          <input type="search" placeholder="חיפוש ביומנים" .value=${this.q} @input=${r=>this.q=r.target.value} data-cal-search></label>
        ${this.newButton()}
      </div>`}demoQuery(){if(ft())return"";const t=this.route?.params.toString()??"";return t?`?${t}`:""}newButton(){const t=this.access.can;return this.view==="maint"?t.maintenance?a`<button type="button" class="btn pri new" data-cal-new @click=${()=>this.drawer={kind:"maint",d:{}}}><sw-icon name="plus" size="16"></sw-icon>חלון תחזוקה</button>`:l:t.book?a`<button type="button" class="btn pri new" data-cal-new @click=${()=>this.drawer={kind:"event",d:{}}}><sw-icon name="plus" size="16"></sw-icon>חדש</button>`:l}content(t){if(this.error&&!this.cals)return a`<div class="center"><sw-state-panel state="error" data-cal-state="error" heading="לא הצלחנו לטעון את היומנים" hint=${this.error} actionLabel="לנסות שוב"
        @action=${()=>void this.load()}></sw-state-panel></div>`;if(!this.cals||!this.api)return this.slow?this.loadingView():l;const e=this.ctx();if(t)return a`<cal-resident .ctx=${e}></cal-resident>`;if(!this.cals.length&&this.view!=="manage")return a`<div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="empty" heading="אין עדיין יומנים"
        hint=${this.access.can.manage?"יומן לכל חדר, צוות, אחזקה או אירועים. אפשר להתחיל מחדר אחד.":"כשיוגדר יומן שיש לך בו הרשאה, הוא יופיע כאן."}
        actionLabel=${this.access.can.manage?"יצירת יומן ראשון":""} @action=${()=>location.hash=`${zt(this.route)}/manage${this.demoQuery()}`}></sw-state-panel></div>`;switch(this.view){case"rooms":return a`<cal-view-rooms .ctx=${e}></cal-view-rooms>`;case"approvals":return a`<cal-view-approvals .ctx=${e}></cal-view-approvals>`;case"maint":return a`<cal-view-maint .ctx=${e}></cal-view-maint>`;case"manage":return a`<cal-view-manage .ctx=${e}></cal-view-manage>`;default:return a`<cal-view-calendar .ctx=${e}></cal-view-calendar>`}}loadingView(){return this.access.ui.loading_style==="spinner"?a`<div class="center" data-cal-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`:a`<div class="loading" data-cal-state="loading" role="status" aria-label="טוען">
      <div class="panel">${Array.from({length:6},(t,e)=>a`<div class="skel" style=${`block-size:${e?64:32}px`}></div>`)}</div>
      <div class="panel side">${Array.from({length:8},()=>a`<div class="skel" style="block-size:22px"></div>`)}</div></div>`}};H.styles=[at,tt`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 14px; overflow: hidden; }
    .top { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; padding-inline-start: var(--sw-lead-reserve, 0px); padding-inline-end: var(--sw-float-reserve, 0px); }
    .top h1 { margin: 0; font-size: var(--sw-h1); font-weight: var(--sw-h1-weight); letter-spacing: var(--sw-h1-tracking); color: var(--sw-heading); line-height: 1.2; }
    .floors { display: flex; gap: 8px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; }
    .bar { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
    .tabs { display: inline-flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); max-inline-size: 100%; overflow: hidden; }
    .tab { font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); padding: 0 14px; min-block-size: 34px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; text-decoration: none; -webkit-tap-highlight-color: transparent; }
    .tab[aria-current='page'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .tab .n { color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .search { display: inline-flex; align-items: center; gap: 8px; min-block-size: var(--sw-ctl-h-lg); padding: 0 14px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border);
      background: var(--sw-surface-solid); inline-size: 220px; max-inline-size: 100%; }
    .search input { font: inherit; font-size: var(--sw-fs-md); border: 0; outline: 0; background: transparent; color: var(--sw-text); min-inline-size: 0; flex: 1; }
    .body { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
    .body > * { flex: 1; min-block-size: 0; }
    .loading { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; flex: 1; min-block-size: 0; }
    .loading .panel { gap: 10px; }
    .center { display: grid; place-items: center; flex: 1; }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    @media (max-width: 1179px) { .loading { grid-template-columns: minmax(0, 1fr); } .loading .side { display: none; } }
    @media (max-width: 699px) {
      :host { padding: 10px var(--sw-page-pad-phone) 10px; gap: 10px; }
      .top h1 { font-size: var(--sw-fs-2xl); }
      .bar { gap: 8px; }
      .tabs { inline-size: 100%; }
      .tab { flex: 1; justify-content: center; padding: 0 6px; font-size: var(--sw-fs-sm); }
      .search { display: none; }
      .new { margin-inline-start: auto; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];V([K({attribute:!1})],H.prototype,"route",2);V([d()],H.prototype,"access",2);V([d()],H.prototype,"cals",2);V([d()],H.prototype,"error",2);V([d()],H.prototype,"floor",2);V([d()],H.prototype,"q",2);V([d()],H.prototype,"floorNames",2);V([d()],H.prototype,"slow",2);V([d()],H.prototype,"device",2);V([d()],H.prototype,"drawer",2);V([d()],H.prototype,"toastText",2);H=V([st("calendars-page")],H);export{H as CalendarsPage};
//# sourceMappingURL=cal-page-B6qSatP4.js.map
