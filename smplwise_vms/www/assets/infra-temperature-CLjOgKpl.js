import{sy as Zt,sz as H,id as e,sA as b,A as l,sB as et,a4 as C,sC as B,b as r,sD as Rt,sE as dt,sF as Lt,sG as Q,sH as q,d as te,cN as ht,sI as ee,sJ as se,dn as Z,g as G,aw as k,j as u,i as Y,sK as ae,sL as it,m as z,sM as ie,a0 as E,k as K,sN as ne,dX as re,sO as wt,sP as Mt,sQ as F,sR as oe,sS as le,u as nt,sT as I,qd as ot,sU as de,sV as vt,sW as pe,sX as Dt,sY as Tt,sZ as It,s_ as pt,s$ as U,t0 as ct,t1 as ce,t2 as ut,t3 as he,t4 as ue,t5 as me,t6 as gt,t7 as we,t8 as ve,t9 as ge,ta as be,tb as lt,tc as fe,td as $e,te as xe,tf as bt,tg as ye,th as ft,ti as ke,tj as _e,tk as $t,ea as J,tl as ze,tm as xt,tn as Se,to as Oe,tp as yt,tq as Ee,tr as Pt,ts as Ce,tt as Re,tu as Le,tv as Me,ev as kt,tw as Ft,aH as _t,tx as De,ty as zt,tz as Te,tA as Ie,tB as Pe,tC as St,tD as Fe,tE as qe,tF as Ae,tG as st,tH as Ne,tI as We,tJ as je,tK as He,aK as Be,gU as Ue,tL as Ge,iR as Ye,gV as Ke,tM as Ve,tN as Qe,tO as at,tP as Xe,tQ as Je,tR as Ze,tS as ts,tT as Ot,bg as es,bh as ss}from"./index-eHtAZ44A.js";import"./sw-pager-kLZKMgDh.js";import{t as V}from"./styles-DqcHxHWi.js";import{c as qt}from"./confirm-dialog-CYGk_R7l.js";import{listUsers as as,listGroups as is}from"./access-C9T5H46L.js";import"./sw-table-DCV8D1Zi.js";import{b as ns}from"./bubble-chrome-DOL7l61i.js";import{L as rs}from"./long-lists-DABkJF3B.js";import{T as os}from"./toast-controller-BPX0Tkjm.js";import"./sw-logo-art-PLtEZJxU.js";let Et=0;const At=()=>`tc${Et=(Et+1)%1e6}`;function rt(t,s,a,o=120){const i=t.value??t.value_last,n=t.hvac?.setpoint??null,p=Zt(t.low,t.high,[i,n].filter(_=>_!==null)),h=p.frac,c=i!==null&&(i>t.high||i<t.low),[w,x]=i!==null?H(h(i)):H(.5),v=H(h(t.low),58),g=H(h(t.high),58),d=e("gaugeLabel",{v:b(i),lo:b(t.low),hi:b(t.high)}),m=a==="up"?e("trendUp"):a==="down"?e("trendDown"):a==="flat"?e("trendFlat"):"";return r`<div class="gauge" data-look=${s} style=${`inline-size:${o}px;block-size:${o}px`}>
    <svg viewBox="0 0 120 120" role="img" aria-label=${d} dir="ltr">
      <path d=${et(0,1)} class="g-track" fill="none" stroke-width="9" stroke-linecap="round"></path>
      <path d=${et(h(t.low),h(t.high))} class="g-band" fill="none" stroke-width="9"></path>
      ${i!==null&&c?C`<path d=${h(i)>h(t.high)?et(h(t.high),h(i)):et(h(i),h(t.low))} class="g-val" fill="none" stroke-width="9" stroke-linecap="round"></path>`:l}
      <text x=${v[0].toFixed(1)} y=${v[1].toFixed(1)} class="g-tick" text-anchor="middle" dominant-baseline="middle">${b(t.low)}</text>
      <text x=${g[0].toFixed(1)} y=${g[1].toFixed(1)} class="g-tick" text-anchor="middle" dominant-baseline="middle">${b(t.high)}</text>
      ${n!==null?C`<path d=${`M${H(p.frac(n),40)[0].toFixed(2)} ${H(p.frac(n),40)[1].toFixed(2)}L${H(p.frac(n),56)[0].toFixed(2)} ${H(p.frac(n),56)[1].toFixed(2)}`} class="g-sp" stroke-width="2.5" stroke-linecap="round"><title>${e("setpointChip",{v:b(n)})}</title></path>`:l}
      ${i!==null?C`<circle cx=${w.toFixed(2)} cy=${x.toFixed(2)} r="7.5" class="g-dot" stroke-width="2.5"></circle>`:C`<circle cx=${w.toFixed(2)} cy=${x.toFixed(2)} r="6" class="g-none" fill="none" stroke-dasharray="2 3" stroke-width="2"></circle>`}
    </svg>
    <div class="gv"><b class="num" dir="ltr">${B(i)}<sup>°C</sup></b><small>${e("targetWord")} <span dir="ltr" class="num">${b(t.low)}–${b(t.high)}</span></small>${m?r`<span class="trend" data-trend=${a}>${m}</span>`:l}</div>
  </div>`}function Nt(t,s,a=300,o=52){const i=Math.floor(s/1e3),n=i-86400,p=t.spark??[],h=p.map(m=>[m[0],m[1]]),c=t.source==="climate"?p.map(m=>[m[0],m[2]??null]):[],w=Rt([...h,...c.filter(m=>m[1]!==null)],t.low,t.high,n,i,a,o),x=At(),v=dt(h,w,900),g=c.length?Lt(c,w,900):"",d=[Q(w,t.high),Q(w,t.low)];return r`<div class="spark" dir="ltr" aria-hidden="true">
    <svg viewBox=${`0 0 ${a} ${o}`} preserveAspectRatio="none">
      <defs><clipPath id=${x}><rect x="0" y="0" width=${a} height=${d[0].toFixed(1)}></rect><rect x="0" y=${d[1].toFixed(1)} width=${a} height=${o}></rect></clipPath></defs>
      <rect x="0" y=${d[0].toFixed(1)} width=${a} height=${(d[1]-d[0]).toFixed(1)} class="c-band"></rect>
      ${(t.doors_24h??[]).map(([m,_])=>C`<rect x=${q(w,m).toFixed(1)} y="0" width=${Math.max(1.5,q(w,_)-q(w,m)).toFixed(1)} height=${o} class="c-door"></rect>`)}
      ${(t.defrost_24h??[]).map(([m,_])=>C`<rect x=${q(w,m).toFixed(1)} y="0" width=${Math.max(1,q(w,_)-q(w,m)).toFixed(1)} height=${o} class="c-defrost"></rect>`)}
      <line x1="0" x2=${a} y1=${d[0].toFixed(1)} y2=${d[0].toFixed(1)} class="c-edge" vector-effect="non-scaling-stroke"></line>
      <line x1="0" x2=${a} y1=${d[1].toFixed(1)} y2=${d[1].toFixed(1)} class="c-edge" vector-effect="non-scaling-stroke"></line>
      ${g?C`<path d=${g} class="c-sp" fill="none" vector-effect="non-scaling-stroke"></path>`:l}
      <path d=${v} class="c-line" fill="none" vector-effect="non-scaling-stroke"></path>
      <path d=${v} class="c-out" fill="none" vector-effect="non-scaling-stroke" clip-path=${`url(#${x})`}></path>
    </svg>
  </div>`}function Wt(t,s,a){const o=(t.setpoints??[]).filter(n=>n[1]!==null),i=(t.overlays??[]).flatMap(n=>n.points);if(t.axisUnit===""){const n=[...t.points,...i].map(c=>c[1]).filter(c=>Number.isFinite(c)),p=Math.min(-.5,...n),h=Math.max(1.5,...n);return{t0:t.t0,t1:t.t1,lo:Math.floor(p*2)/2,hi:Math.ceil(h*2)/2,w:s,h:a,ml:36,mr:10,mt:10,mb:24}}return Rt([...t.points,...o,...i],t.low,t.high,t.t0,t.t1,s,a,{ml:36,mr:10,mt:10,mb:24})}function jt(t,s,a,o,i){const n=Wt(t,s,a),p=At(),h=dt(t.points,n,Math.max(900,t.step*3)),c=[Q(n,t.high),Q(n,t.low)],w=t.t1-t.t0,x=[];if(w<=1.5*86400)for(let d=Math.ceil(t.t0/14400)*14400;d<=t.t1;d+=14400)x.push({t:d,l:te(new Date(d*1e3))});else{const d=w<=864e3?1:5,m=new Date(t.t0*1e3);m.setHours(24,0,0,0);for(let _=m.getTime()/1e3;_<=t.t1;_+=d*86400)x.push({t:_,l:ht(new Date(_*1e3))})}const v=s-n.ml-n.mr,g=a-n.mt-n.mb;return r`<svg viewBox=${`0 0 ${s} ${a}`} role="img" aria-label=${e("chartTitle")} dir="ltr">
    <defs><clipPath id=${p}><rect x=${n.ml} y="0" width=${v} height=${c[0].toFixed(1)}></rect><rect x=${n.ml} y=${c[1].toFixed(1)} width=${v} height=${a}></rect></clipPath></defs>
    ${(t.axisUnit===""?[0,.5,1].filter(d=>d>=n.lo&&d<=n.hi):ee(n.lo,n.hi)).map(d=>C`<line x1=${n.ml} x2=${s-n.mr} y1=${Q(n,d).toFixed(1)} y2=${Q(n,d).toFixed(1)} class="c-grid"></line><text x=${n.ml-6} y=${Q(n,d).toFixed(1)} class="c-ax" text-anchor="end" dominant-baseline="middle">${d}${t.axisUnit??"°"}</text>`)}
    <rect x=${n.ml} y=${c[0].toFixed(1)} width=${v} height=${(c[1]-c[0]).toFixed(1)} class="c-band"></rect>
    ${t.doors.map(([d,m])=>C`<rect x=${q(n,d).toFixed(1)} y=${n.mt} width=${Math.max(2,q(n,m)-q(n,d)).toFixed(1)} height=${g} class="c-door"></rect>`)}
    ${t.defrost.map(([d,m])=>C`<rect x=${q(n,d).toFixed(1)} y=${n.mt} width=${Math.max(1,q(n,m)-q(n,d)).toFixed(1)} height=${g} class="c-defrost"></rect>`)}
    <line x1=${n.ml} x2=${s-n.mr} y1=${c[0].toFixed(1)} y2=${c[0].toFixed(1)} class="c-edge"></line>
    <line x1=${n.ml} x2=${s-n.mr} y1=${c[1].toFixed(1)} y2=${c[1].toFixed(1)} class="c-edge"></line>
    ${x.map(d=>C`<text x=${q(n,d.t).toFixed(1)} y=${a-6} class="c-ax" text-anchor="middle">${d.l}</text>`)}
    ${t.setpoints?.length?C`<path d=${Lt(t.setpoints,n,Math.max(900,t.step*3))} class="c-sp big" fill="none"></path>`:l}
    ${(t.overlays??[]).map((d,m)=>C`<path d=${dt(d.points,n,Math.max(900,t.step*3))} class="c-ov big" data-ov=${m} fill="none"><title>${d.name}</title></path>`)}
    <path d=${h} class="c-line big" fill="none"></path>
    <path d=${h} class="c-out big" fill="none" clip-path=${`url(#${p})`}></path>
    ${i?C`<line x1=${i.x} x2=${i.x} y1=${n.mt} y2=${a-n.mb} class="c-cross"></line>${i.y!==null?C`<circle cx=${i.x} cy=${i.y} r="5" class="c-crossdot" stroke-width="2"></circle>`:l}`:l}
  </svg>`}function ls(t,s,a){const h=se((t.spark??[]).map(m=>[m[0],m[1]]),t.low,t.high,s,t.defrost_24h??[],t.hard_max),c=(m,_)=>[75+_*Math.cos(m),75+_*Math.sin(m)],w={ok:e("ringOk"),warn:e("ringWarn"),alarm:e("ringAlarm"),none:e("ringNone"),defrost:e("lgDefrost")},x=h.map(m=>{const _=m.hour/24*2*Math.PI-Math.PI/2+.012,mt=(m.hour+1)/24*2*Math.PI-Math.PI/2-.012,[Ut,Gt]=c(_,66),[Yt,Kt]=c(mt,66),[Vt,Qt]=c(mt,44),[Xt,Jt]=c(_,44);return C`<path d=${`M${Ut} ${Gt}A66 66 0 0 1 ${Yt} ${Kt}L${Vt} ${Qt}A44 44 0 0 0 ${Xt} ${Jt}Z`} class="r-seg" data-k=${m.state}><title>${`${String(m.hour).padStart(2,"0")}:00 · ${w[m.state]}`}</title></path>`}),v=new Date(s),g=(v.getHours()+v.getMinutes()/60)/24*2*Math.PI-Math.PI/2,d=[0,6,12,18].map(m=>{const _=m/24*2*Math.PI-Math.PI/2;return C`<text x=${75+32*Math.cos(_)} y=${75+32*Math.sin(_)} class="c-ax" text-anchor="middle" dominant-baseline="middle">${String(m).padStart(2,"0")}</text>`});return r`<svg viewBox="0 0 150 150" role="img" aria-label=${e("ringTitle")} dir="ltr" data-temp-ring>
    ${x}${d}
    <line x1=${75} y1=${75} x2=${75+70*Math.cos(g)} y2=${75+70*Math.sin(g)} class="r-hand" stroke-width="2" stroke-linecap="round"></line>
    <circle cx=${75} cy=${75} r="3.5" class="r-hub"></circle>
  </svg>`}var ds=Object.defineProperty,ps=Object.getOwnPropertyDescriptor,W=(t,s,a,o)=>{for(var i=o>1?void 0:o?ps(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&ds(s,a,i),i};let A=class extends Y{constructor(){super(...arguments),this.unitId="",this.eventId=null,this.draft=null,this.dept="",this.subject="",this.desc="",this.chart=!0,this.err="",this.busy=!1}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback()}close(){this.dispatchEvent(new CustomEvent("close"))}async load(){try{const t=await ae(this.unitId,this.eventId,it()==="en"?"en":"he");this.draft=t,this.dept=t.department_id??"",this.subject=t.title,this.desc=t.description,this.chart=t.attach_chart}catch(t){this.err=z(t)}}async submit(){if(this.dept){this.busy=!0,this.err="";try{const t=await ie(this.unitId,{department_id:this.dept,title:this.subject.trim(),description:this.desc,event_id:this.eventId,attach_chart:this.chart,lang:it()==="en"?"en":"he"});this.dispatchEvent(new CustomEvent("done",{detail:{message:e(t.result==="absorbed"?"ticketAbsorbed":"ticketOpened",{n:t.number}),ticketId:t.ticket_id}}))}catch(t){this.err=z(t)}finally{this.busy=!1}}}render(){const t=this.draft;return r`<sw-dialog open wide heading=${e("ticketTitle")} @close=${s=>{s.stopPropagation(),this.close()}}>
      <div class="form" data-temp-ticket>
        ${t?t.departments.length?r`<div class="field"><label class="l" for="tk-dept">${e("ticketDept")}</label>
              <select id="tk-dept" class="in" data-ticket-dept @change=${s=>{this.dept=s.target.value}}>
                <option value="" ?selected=${!this.dept}>${e("ticketChoose")}</option>
                ${t.departments.map(s=>r`<option value=${s.id} ?selected=${this.dept===s.id}>${s.name}</option>`)}</select></div>
            <div class="field"><label class="l" for="tk-subj">${e("ticketSubject")}</label><input id="tk-subj" class="in" maxlength="200" .value=${this.subject}
              @input=${s=>{this.subject=s.target.value}} data-ticket-title /></div>
            <div class="field"><label class="l" for="tk-desc">${e("ticketDesc")}</label><textarea id="tk-desc" class="in" maxlength="4000" .value=${this.desc}
              @input=${s=>{this.desc=s.target.value}} data-ticket-desc></textarea></div>
            <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("ticketChart")} .checked=${this.chart} @change=${s=>{this.chart=E(s)}} data-ticket-chart></sw-toggle>${e("ticketChart")}</label>`:r`<p class="hint" data-ticket-nodept>${e("ticketNoDept")}</p>`:this.err?r`<p class="err" role="alert">${this.err}</p>`:r`<div class="skl" style="block-size:200px"></div>`}
      </div>
        <div slot="footer" class="bar">${this.err&&t?r`<span class="err" role="alert">${this.err}</span>`:l}
          <button type="button" class="btn ghost" @click=${()=>this.close()}>${e("cancel")}</button>
          ${t?.departments.length?r`<button type="button" class="btn pri" ?disabled=${this.busy||!this.dept||!this.subject.trim()} data-ticket-open @click=${()=>this.submit()}>
            <sw-icon name="ticket" size="16"></sw-icon>${e("ticketOpen")}</button>`:l}</div>
      </sw-dialog>`}};A.styles=[V,G`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the system's one dialog (sw-dialog: the scrim, the opaque centred box, the title
       and the close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's bottom sheet). */
    :host { display: contents; }
    .form { display: grid; gap: 12px; align-content: start; }
    .field { display: grid; gap: 6px; }
    label.l { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .in { min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 12px; font: inherit; box-sizing: border-box; inline-size: 100%; }
    textarea.in { padding: 10px 12px; min-block-size: 150px; resize: vertical; line-height: 1.5; }
    .sw { display: inline-flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .bar { display: flex; gap: 8px; justify-content: flex-end; align-items: center; flex-wrap: wrap; flex: 1; min-inline-size: 0; }
    ${Z}
  `];W([k()],A.prototype,"unitId",2);W([k()],A.prototype,"eventId",2);W([u()],A.prototype,"draft",2);W([u()],A.prototype,"dept",2);W([u()],A.prototype,"subject",2);W([u()],A.prototype,"desc",2);W([u()],A.prototype,"chart",2);W([u()],A.prototype,"err",2);W([u()],A.prototype,"busy",2);A=W([K("temp-ticket")],A);const cs={high:"acc",medium:"warn",low:"mut",none:"mut"},hs={high:"whyConfHigh",medium:"whyConfMedium",low:"whyConfLow",none:"whyConfNone"},us={maint:"wrench",defrost:"snow",door:"door",outage:"bolt",compressor_off:"bolt",compressor_no_power:"bolt",compressor_on:"bolt",unit_off:"power",setpoint:"edit",gap:"clock",spike:"warning",shared:"grid",local:"home",gradual:"thermometer"},L=(t,s=0)=>typeof t=="number"&&Number.isFinite(t)?t.toLocaleString("en-US",{maximumFractionDigits:s}):"-";function ms(t,s="high",a=it()){const o=t.vars,i=(n,p)=>e(n,p,a);switch(t.key){case"maint":return o.reason?i("fx_maint_reason",{r:String(o.reason)}):i("fx_maint");case"defrost":return i(o.above_hard_max?"fx_defrost_hot":"fx_defrost");case"door":return i(o.open_at_start?"fx_door_open":"fx_door",{c:L(o.count),t:L(o.total_min,1),l:L(o.lead_min)});case"outage":return i("fx_outage",{d:String(o.device_name||i("fx_outage_src")),l:L(o.lead_min),m:L(o.minutes)});case"compressor_off":return i("fx_compressor_off",{m:L(o.minutes)});case"compressor_no_power":return i("fx_compressor_no_power");case"compressor_on":return i("fx_compressor_on",{m:L(o.minutes)});case"unit_off":return i("fx_unit_off");case"setpoint":return i("fx_setpoint",{a:L(o.sp_from,1),b:L(o.sp_to,1)});case"gap":return o.silent?i("fx_gap_silent"):i("fx_gap",{m:L(o.gap_min)});case"spike":return i("fx_spike",{j:L(o.jump,1)});case"shared":return i(s==="low"?"fx_shared_low":"fx_shared",{a:L(o.n_moved),b:L(o.n_total),names:Array.isArray(o.names)?o.names.join(", "):""});case"local":return i("fx_local",{b:L(o.n_total)});case"gradual":return i("fx_gradual",{r:L(o.rate_h,1)});default:return t.key}}var ws=Object.defineProperty,vs=Object.getOwnPropertyDescriptor,tt=(t,s,a,o)=>{for(var i=o>1?void 0:o?vs(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&ws(s,a,i),i};let X=class extends Y{constructor(){super(...arguments),this.unitId="",this.eventId="",this.data=null,this.err="",this.loadedFor=""}updated(){const t=`${this.unitId}|${this.eventId}`;this.unitId&&this.eventId&&t!==this.loadedFor&&(this.loadedFor=t,this.data=null,this.err="",ne(this.unitId,{eventId:this.eventId}).then(s=>{this.loadedFor===t&&(this.data=s)}).catch(s=>{this.loadedFor===t&&(this.err=z(s))}))}render(){const t=this.data,s=r`<button type="button" class="btn sm ghost" aria-label=${e("close")} data-why-close @click=${()=>this.dispatchEvent(new CustomEvent("close"))}><sw-icon name="close" size="14"></sw-icon></button>`;return this.err?r`<div class="panel" data-temp-why="error"><div class="ph"><h4>${e("whyTitle")}</h4>${s}</div><p class="err" role="alert">${this.err}</p></div>`:t?r`<div class="panel" data-temp-why=${t.confidence}>
      <div class="ph"><h4>${e("whyTitle")}</h4><span class="chip" data-tone=${cs[t.confidence]}>${e(hs[t.confidence])}</span>${s}</div>
      ${t.factors.length?r`<div class="fx">${t.factors.map(a=>r`<div class="f" data-factor=${a.key} ?data-primary=${a.key===t.primary}>
          <sw-icon name=${us[a.key]??"info"} size="14"></sw-icon><span>${ms(a,t.kind)}</span><div class="bar" aria-label=${e("whyScore",{s:a.score})}><i style=${`inline-size:${a.score}%`}></i></div></div>`)}</div>`:r`<p class="hint" style="margin:0">${e(t.reason==="no_samples"?"whyNoSamples":"whyNone")}</p>`}
      <p class="ft">${e("whyRule")}${t.profile?.rate_h!=null?` · ${e("whyRate",{r:L(t.profile.rate_h,1)})}`:""}</p></div>`:r`<div class="panel" data-temp-why="loading"><div class="ph"><h4>${e("whyTitle")}</h4>${s}</div><div class="skl" style="block-size:64px"></div></div>`}};X.styles=[V,G`
    :host { display: block; }
    .ph { display: flex; align-items: center; gap: 8px; margin-block-end: 8px; }
    .ph h4 { flex: 1; margin: 0; }
    .fx { display: grid; gap: 8px; }
    .f { display: grid; grid-template-columns: auto minmax(0, 1fr) 44px; gap: 10px; align-items: center; font-size: var(--sw-fs-sm); }
    .f > span { min-inline-size: 0; overflow-wrap: anywhere; }
    .f .bar { block-size: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); overflow: hidden; }
    .f .bar i { display: block; block-size: 100%; background: var(--tc-acc); }
    .f[data-primary] { font-weight: var(--sw-fw-semibold); }
    .f[data-primary] .bar i { background: var(--tc-warn); }
    .ft { margin: 8px 0 0; font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    ${Z}
  `];tt([k()],X.prototype,"unitId",2);tt([k()],X.prototype,"eventId",2);tt([u()],X.prototype,"data",2);tt([u()],X.prototype,"err",2);X=tt([K("temp-explain")],X);var gs=Object.defineProperty,bs=Object.getOwnPropertyDescriptor,$=(t,s,a,o)=>{for(var i=o>1?void 0:o?bs(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&gs(s,a,i),i};const Ht="sw.temperature.detailWide",fs=[15,30,60,120],$s=[30,60,120,240],Ct=2;function xs(){try{return localStorage.getItem(Ht)==="1"}catch{return!1}}let f=class extends Y{constructor(){super(...arguments),this.units=[],this.canAck=!1,this.canManage=!1,this.stale=!1,this.explain=!0,this.range="24h",this.hist=null,this.histError="",this.events=[],this.wide=xs(),this.muteOpen=!1,this.busy=!1,this.err="",this.chartW=560,this.cross=null,this.maintOpen=!1,this.maintReason="",this.maintMin=60,this.ticket=null,this.cmp=[],this.cmpScale="shared",this.cmpHist={},this.whyEvent="",this.loadedFor="",this.onKey=t=>{t.key==="Escape"&&(this.muteOpen?this.muteOpen=!1:this.maintOpen&&(this.maintOpen=!1))},this.onDrawerClose=t=>{t.target===t.currentTarget&&this.close()}}connectedCallback(){super.connectedCallback(),window.addEventListener("keydown",this.onKey)}disconnectedCallback(){window.removeEventListener("keydown",this.onKey),this.ro?.disconnect(),super.disconnectedCallback()}updated(t){if(this.unit&&this.loadedFor!==`${this.unit.id}:${this.range}`){const a=!this.loadedFor.startsWith(`${this.unit.id}:`);this.loadedFor=`${this.unit.id}:${this.range}`,a&&(this.cmp=[],this.cmpHist={},this.whyEvent=""),this.loadHistory(),this.loadCompare(),t.has("unit")&&t.get("unit")?.id!==this.unit.id&&this.loadEvents()}const s=this.chartBox;s&&!this.ro&&(this.ro=new ResizeObserver(()=>{const a=Math.round(s.clientWidth);a>0&&Math.abs(a-this.chartW)>2&&(this.chartW=a)}),this.ro.observe(s))}close(){this.dispatchEvent(new CustomEvent("close"))}async loadHistory(){const t=this.unit.id;try{const s=await wt(t,this.range,void 0,void 0,Math.max(200,Math.min(1200,this.chartW)));this.unit.id===t&&(this.hist=s,this.histError="")}catch(s){this.histError=z(s)}}async loadCompare(){const t=this.range,s={};await Promise.all(this.cmp.map(async a=>{try{s[a]=await wt(a,t,void 0,void 0,Math.max(200,Math.min(1200,this.chartW)))}catch{}})),t===this.range&&(this.cmpHist=s)}toggleCompare(t,s){this.cmp=s?[...this.cmp,t].slice(-Ct):this.cmp.filter(a=>a!==t),this.loadCompare()}async loadEvents(){const t=this.unit.id;try{const s=await Mt({unit:t,range:"24h",limit:8});this.unit.id===t&&(this.events=s.events)}catch{this.events=[]}}async act(t,s,a){this.busy=!0,this.err="";try{await t(),this.dispatchEvent(new CustomEvent("changed",{detail:e(s,a)})),this.loadEvents()}catch(o){this.err=z(o)}finally{this.busy=!1}}toggleWide(){this.wide=!this.wide;try{localStorage.setItem(Ht,this.wide?"1":"0")}catch{}this.ro?.disconnect(),this.ro=void 0}chartData(){const t=this.hist;if(!t)return null;const s=this.unit,a=this.cmp.length>0&&this.cmpScale==="norm",o=this.cmp.map(n=>({id:n,u:this.units.find(p=>p.id===n),h:this.cmpHist[n]})).filter(n=>n.u&&n.h),i=(n,p,h)=>a?n.map(([c,w])=>[c,we(w,p,h)]):n;return{points:i(t.points.map(n=>[n[0],n[1]]),s.low,s.high),setpoints:s.source==="climate"&&!a?t.points.map(n=>[n[0],n[5]]):void 0,low:a?0:s.low,high:a?1:s.high,doors:t.doors,defrost:t.defrost,t0:t.from,t1:t.to,step:t.step,overlays:o.map(n=>({id:n.id,name:n.u.name,points:i(n.h.points.map(p=>[p[0],p[1]]),n.u.low,n.u.high)})),axisUnit:a?"":"°"}}hover(t,s){const a=this.chartBox;if(!a||!s.points.length)return;const o=a.getBoundingClientRect(),i=Wt(s,this.chartW,250),n=(t.clientX-o.left)/o.width*this.chartW,p=i.t0+(n-i.ml)/(this.chartW-i.ml-i.mr)*(i.t1-i.t0);let h=0;for(let v=1;v<s.points.length;v++)Math.abs(s.points[v][0]-p)<Math.abs(s.points[h][0]-p)&&(h=v);const c=s.points[h],w=i.ml+(c[0]-i.t0)/Math.max(1,i.t1-i.t0)*(this.chartW-i.ml-i.mr),x=i.mt+(i.hi-c[1])/Math.max(1e-9,i.hi-i.lo)*(250-i.mt-i.mb);this.cross={x:w,y:x,i:h}}tip(t,s){if(!this.cross)return l;const a=t.points[this.cross.i];if(!a)return l;const o=a[0]*1e3,i=t.doors.some(([v,g])=>a[0]>=v&&a[0]<=g),n=t.defrost.some(([v,g])=>a[0]>=v&&a[0]<=g),p=t.setpoints?.[this.cross.i]?.[1]??null,h=a[1]>t.high||a[1]<t.low,c=this.range==="24h"?"":`${ht(new Date(o))} · `,w=t.axisUnit==="",x=v=>v.reduce((g,d)=>g===null||Math.abs(d[0]-a[0])<Math.abs(g[0]-a[0])?d:g,null);return r`<div class="tip" style=${`inset-inline-start:${this.cross.x/this.chartW*100}%;inset-block-start:${(this.cross.y??20)/250*100}%`} data-temp-tip>
      <div>${c}<span class="num">${F(o,s)}</span></div><b class="num">${w?a[1].toFixed(2):`${B(a[1])} °C`}</b>
      ${(t.overlays??[]).map(v=>{const g=x(v.points);return g&&Math.abs(g[0]-a[0])<=t.step*2?r`<div>${v.name}: <span class="num">${w?g[1].toFixed(2):`${B(g[1])} °C`}</span></div>`:l})}
      ${p!==null?r`<div>${e("lgSetpoint")}: ${b(p)}</div>`:l}
      ${i?r`<div>${e("lgDoor")}</div>`:l}${n?r`<div>${e("lgDefrost")}</div>`:l}${h?r`<div class="err">${e("lgOut")}</div>`:l}
    </div>`}rulesLine(t){const s=t.rules,a=[];return t.door&&s.door_alarm&&a.push(e("ruleDoorShort",{x:s.door_alarm_min})),s.high_alarm&&a.push(e("ruleHighShort",{t:b(t.high),z:s.high_alarm_min})),s.low_alarm&&a.push(e("ruleLowShort",{t:b(t.low),z:s.low_alarm_min})),s.offline_warn&&a.push(e("ruleOffShort",{n:s.offline_min})),s.quiet_enabled&&a.push(e("ruleQuietShort",{a:s.quiet_from,b:s.quiet_to})),a.join(" · ")}bars(t,s){const a=s-864e5,o=oe(t.doors_24h??[],a,s),i=le((t.spark??[]).map(h=>[h[0],h[1]]),t.low,t.high,a,s,t.defrost_24h??[]),n=t.stats_24h,p=nt();return r`
      ${t.door!==null||(t.doors_24h??[]).length?r`<div class="tlrow"><div class="lbl"><span>${e("tlDoor")}</span><span>${e("doorSummary",{n:n.door_opens,t:I(n.door_total_min),l:n.door_longest_min})}</span></div>
        <div class="tl" role="img" aria-label=${e("tlDoor")} data-temp-doorbar>${o.map(h=>r`<span data-k=${h.k} style=${`flex:${h.pct.toFixed(2)}`}></span>`)}</div></div>`:l}
      <div class="tlrow"><div class="lbl"><span>${e("tlTemp")}</span><span>${n.out_min?e("outOfRange",{d:I(n.out_min)}):e("allInRange")}</span></div>
        <div class="tl" role="img" aria-label=${e("tlTemp")} data-temp-statebar>${i.map(h=>r`<span data-k=${h.k} style=${`flex:${h.pct.toFixed(2)}`}></span>`)}</div></div>
      <div class="axis"><span>${F(a,p)}</span><span>${F(a+6*36e5,p)}</span><span>${F(a+12*36e5,p)}</span><span>${F(a+18*36e5,p)}</span><span>${e("now")}</span></div>
      <div class="legend"><span><i data-k="door"></i>${e("lgDoor")}</span><span><i data-k="ok"></i>${e("ringOk")}</span><span><i data-k="warn"></i>${e("ringWarn")}</span><span><i data-k="alarm"></i>${e("ringAlarm")}</span>${t.defrost.mode!=="none"?r`<span><i data-k="defrost"></i>${e("lgDefrost")}</span>`:l}</div>`}healthPanel(t,s){const a=t.health;if(!a)return l;const o=(n,p,h)=>r`<div><span>${e(n)}</span><b data-bad=${String(h)}>${p}</b></div>`,i=a.signal===null?e("hNotReported"):a.signal_unit==="dBm"?r`<span class="num ltr">${a.signal} dBm</span>`:r`<span class="num ltr">LQI ${a.signal}</span>`;return r`<div class="panel" data-temp-health><div class="ph"><h4>${e("healthTitle")}</h4>
        ${a.issues.length?r`<span class="chip" data-tone="warn">${a.issues.length}</span>`:r`<span class="chip" data-tone="ok">${e("hOk")}</span>`}</div>
      <div class="summ hl">
        ${o("hBattery",a.battery===null?a.battery_low?e("healthBatteryLow"):e("hNotReported"):r`<span class="num ltr">${Math.round(a.battery)}%</span>`,a.battery_low)}
        ${o("hSignal",a.signal_weak?r`${i} · ${e("healthSignal")}`:i,a.signal_weak)}
        ${o("hAge",a.age_min===null?"—":I(a.age_min),!1)}
        ${a.frozen_since?o("hFrozen",e("healthFrozen",{t:F(Date.parse(a.frozen_since),s)}),!0):l}
      </div></div>`}doorPanel(t,s){const a=t.insights?.door;if(!t.door||!a)return l;const o=a.opens===0||a.median_recovery_min===null?e("doorFxNone"):a.slow?e("doorFxSlow"):e("doorFxOk");return r`<div class="panel" data-temp-doorfx data-slow=${String(a.slow)}><div class="ph"><h4>${e("doorFxTitle")}</h4></div>
      <div class="stat4">
        <div><span>${e("doorFxOpens")}</span><b class="num">${a.opens}</b></div>
        <div><span>${e("doorFxRise")}</span><b class="num" dir="ltr">${a.avg_rise===null?"—":`+${B(a.avg_rise)}°`}</b></div>
        <div><span>${e("doorFxMaxRise")}</span><b class="num" dir="ltr">${a.max_rise===null?"—":`+${B(a.max_rise)}°`}</b></div>
        <div><span>${e("doorFxRecovery")}</span><b class="num">${a.median_recovery_min===null?"—":I(a.median_recovery_min)}</b></div>
      </div>
      <p class="hint ${a.slow?"warnline":""}" style="margin:8px 0 0">${o}</p>
      ${a.last.length?r`<div class="fx"><span class="hint">${e("doorFxLast")}</span>${[...a.last].reverse().map(i=>r`<div class="fxr"><time class="num">${F(i.opened*1e3,s)}</time>
        <span class="num ltr">+${B(i.rise)}°</span><span>${i.recovery_min===null?e("doorFxNotBack"):I(i.recovery_min)}</span></div>`)}</div>`:l}
    </div>`}dutyPanel(t){if(!t.power)return l;const s=t.insights?.duty,a=o=>o==null?"—":`${Math.round(o)}%`;return r`<div class="panel" data-temp-duty data-rising=${String(!!s?.rising)}><div class="ph"><h4>${e("dutyTitle")}</h4>
        ${t.power.w!==null?r`<span class="chip" data-tone=${t.power.on?"acc":"mut"}><sw-icon name="power" size="12"></sw-icon>${t.power.on?e("compressorOn"):e("compressorOff")} · ${e("dutyNow",{w:Math.round(t.power.w)})}</span>`:l}</div>
      ${s?r`<div class="stat4" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <div><span>${e("duty24")}</span><b class="num">${a(s.pct_24h)}</b></div>
          <div><span>${e("dutyRecent")}</span><b class="num">${a(s.recent)}</b></div>
          <div><span>${e("dutyBefore")}</span><b class="num">${a(s.before)}</b></div></div>
        ${s.days.length?r`<div class="bars" role="img" aria-label=${e("dutyTitle")} dir="ltr">${s.days.map(o=>r`<span title=${`${o.day} · ${a(o.pct)}`}><i style=${`block-size:${Math.max(2,o.pct??0)}%`}></i></span>`)}</div>`:l}
        <p class="hint ${s.rising?"warnline":""}" style="margin:8px 0 0">${s.recent===null?e("dutyNoData"):s.rising?e("dutyRising"):e("dutyStable")}</p>`:r`<p class="hint" style="margin:0">${e("dutyNoData")}</p>`}</div>`}ticketsPanel(t){const s=t.tickets??[];return!ot()||!s.length?l:r`<div class="panel" data-temp-tickets><div class="ph"><h4>${e("ticketsLinked")}</h4></div>
      <div class="events">${s.map(a=>r`<a class="ev tk" href=${`#/tickets/${encodeURIComponent(a.ticket_id)}`} data-ticket-link=${a.ticket_id}><sw-icon name="ticket" size="14"></sw-icon>
        <div>${e("ticketChip",{n:a.number})}</div><span class="chip">${a.status??""}</span></a>`)}</div></div>`}maintPop(t,s){const a=t.rules.maintenance_max_min??240,o=$s.filter(n=>n<=a),i=()=>{const n=this.maintReason.trim();if(!n){this.err=e("maintNeedReason");return}this.maintOpen=!1;const p=Math.min(this.maintMin,a);this.act(()=>ve(t.id,p,n),"maintStarted",{t:F(Date.now()+p*6e4,s)}),this.maintReason=""};return r`<div class="pop maint" role="dialog" aria-label=${e("maintTitle")} data-nested-open data-temp-maintpop><div class="hd">${e("maintTitle")}</div>
      <div class="nt">${t.rules.maintenance_includes_alarms?e("maintNoteAlarms"):e("maintNote")}</div>
      <label class="mf"><span>${e("maintReason")}</span><input class="in" maxlength="120" .value=${this.maintReason} placeholder=${e("maintReasonPh")}
        @input=${n=>{this.maintReason=n.target.value}} @keydown=${n=>{n.key==="Enter"&&i()}} data-maint-reason /></label>
      <div class="mf"><span>${e("maintFor")}</span><sw-segmented value=${String(this.maintMin)} @change=${n=>{this.maintMin=Number(n.detail.value)}}
        .options=${o.map(n=>({value:String(n),label:I(n),attrs:{"data-maint-min":String(n)}}))}></sw-segmented></div>
      <button type="button" class="btn pri sm" ?disabled=${!this.maintReason.trim()} data-maint-start @click=${i}><sw-icon name="wrench" size="14"></sw-icon>${e("maintStart")}</button>
    </div>`}defrostPanel(t){const s=t.defrost;if(s.mode==="none")return l;const a={learned:"wLearned",confirmed:"wConfirmed",rejected:"wRejected",fixed:"wFixed"},o=s.mode==="fixed"?e("modeFixed"):s.state==="learning"?e("stLearning",{d:Math.floor(s.days),n:t.rules.learn_min_repeats??3}):s.state==="learned"?e("stLearned"):s.state==="none_found"?e("stNoneFound"):e("modeLearn");return r`<div class="panel" data-temp-defrost><div class="ph"><h4>${e("defrostTitle")}</h4><span class="chip" data-tone="acc">${s.mode==="fixed"?e("modeFixed"):e("modeLearn")}</span></div>
      <p class="hint" style="margin:0 0 8px">${o}</p>
      <div class="wins">${s.windows.map(i=>r`<div class="win" data-window=${i.start_min} data-status=${i.status}><sw-icon name="snow" size="14"></sw-icon><span class="w">${de(i)}</span>
        <span class="chip" data-tone=${i.status==="rejected"?"mut":i.status==="confirmed"?"ok":"acc"}>${e(a[i.status]??"wLearned")}</span>${i.repeats?r`<span class="hint">${e("wRepeats",{n:i.repeats})}</span>`:l}
        ${this.canManage&&i.status==="learned"?r`<span style="flex:1"></span><button type="button" class="btn sm" ?disabled=${this.busy} data-window-confirm @click=${()=>this.act(()=>vt(t.id,i.start_min,"confirm"),"saved")}>${e("confirm")}</button>
          <button type="button" class="btn sm ghost" ?disabled=${this.busy} data-window-reject @click=${()=>this.act(()=>vt(t.id,i.start_min,"reject"),"saved")}>${e("reject")}</button>`:l}</div>`)}</div>
      ${this.canManage&&s.mode==="learn"&&s.windows.length?r`<button type="button" class="btn sm ghost" style="margin-top:8px" ?disabled=${this.busy} data-learn-clear
          @click=${async()=>{await qt({body:e("clearConfirm"),danger:!0})&&this.act(()=>pe(t.id),"saved")}}>${e("clearLearned")}</button>`:l}
    </div>`}render(){const t=this.unit;if(!t)return l;const s=Date.now(),a=nt(),o=this.stale?"unknown":t.status,i=Tt[o],n=Dt(t,s,a),p=this.chartData(),h=this.hist?.stats??t.stats_24h,c=t.events.some(d=>(d.severity==="alarm"||d.severity==="warning")&&!d.ack_at),w=d=>r`<span class="sname">${U(d,t.name)}</span>`,x=this.units.filter(d=>d.id!==t.id),v={alarm:"var(--tc-alarm)",warning:"var(--tc-warn)",info:"var(--tc-acc)"},g=[...t.events].sort((d,m)=>(d.severity==="alarm"?-1:0)-(m.severity==="alarm"?-1:0)).find(d=>d.severity==="alarm"||d.severity==="warning");return r`<sw-drawer modal open heading=${t.name} subheading=${[t.area_name,U(t.temp_sensor_name,"")].filter(Boolean).join(" · ")} ?data-wide=${this.wide} @close=${this.onDrawerClose}>
        <span slot="action" class="hact"><span class="badge" data-look=${i}><sw-icon name=${It[o]} size="14"></sw-icon>${e(ct[o])}</span>
          <button type="button" class="btn icb" aria-label=${e("expand")} title=${e("expand")} aria-pressed=${String(this.wide)} data-temp-wide @click=${()=>this.toggleWide()}><sw-icon name="grid" size="16"></sw-icon></button></span>
        <div class=${this.wide?"db wide":"db"} data-temp-detail=${t.id}>
          <div class="col">
            <div class="panel" data-look=${i}><div class="headrow">${rt(t,i,t.trend,132)}
              <div style="flex:1;display:grid;gap:8px;min-inline-size:0">
                <div class="chips" style="justify-content:flex-start">${n.map(d=>r`<span class="chip" data-tone=${d.tone}><sw-icon name=${d.icon} size="12"></sw-icon>${d.text}</span>`)}</div>
                <div class="summ">
                  <div><span>${e("sensorTemp")}</span><b>${w(t.temp_sensor_name)}</b></div>
                  ${t.hvac?r`<div><span>${e("lgSetpoint")}</span><b>${b(t.hvac.setpoint)} · ${ce(t.hvac.hvac_mode,t.hvac.hvac_action)}</b></div>`:l}
                  <div><span>${e("sensorDoor")}</span><b>${t.door?w(t.door.sensor_name):e("none")}</b></div>
                  ${t.power?r`<div><span>${e("powerSensor")}</span><b>${w(t.power.sensor_name)}${t.power.w!==null?r` · <span class="num ltr">${Math.round(t.power.w)} W</span>`:l}</b></div>`:l}
                  ${t.rules.predict_enabled!==!1&&!this.stale&&t.status!=="offline"?r`<div data-temp-predict><span>${e("predictRow")}</span><b>${t.prediction?e("predictChip",{t:b(t.prediction.threshold),m:t.prediction.eta_min}):e("predictNone")}</b></div>`:l}
                  ${t.maintenance?r`<div data-temp-maint><span>${e("maintBtn")}</span><b>${e("maintChip",{t:F(Date.parse(t.maintenance.until),a)})} · ${t.maintenance.reason}${t.maintenance.by_name?` · ${t.maintenance.by_name}`:""}</b></div>`:l}
                  <div><span>${e("rulesLbl")}</span><b>${this.rulesLine(t)}</b></div>
                </div>
              </div></div></div>
            <div class="panel"><div class="ph"><h4>${e("chartTitle")}</h4>
              <sw-segmented label=${e("chartTitle")} value=${this.range} @change=${d=>{this.range=d.detail.value,this.cross=null}}
                .options=${["24h","7d","30d"].map(d=>({value:d,label:e(d==="24h"?"r24":d==="7d"?"r7":"r30"),attrs:{"data-range":d}}))}></sw-segmented></div>
              <div class="bigchart" data-temp-chart @pointermove=${d=>p&&this.hover(d,p)} @pointerdown=${d=>p&&this.hover(d,p)} @pointerleave=${()=>{this.cross=null}}>
                ${p?jt(p,this.chartW,250,a,this.cross):this.histError?r`<p class="err">${this.histError}</p>`:r`<div class="skl" style="block-size:100%"></div>`}
                ${p?this.tip(p,a):l}
              </div>
              <div class="legend"><span><i data-k="line"></i>${this.cmp.length?t.name:e("lgTemp")}</span>${(p?.overlays??[]).map((d,m)=>r`<span><i data-k=${`ov${m}`}></i>${d.name}</span>`)}<span><i data-k="out"></i>${e("lgOut")}</span><span><i data-k="band"></i>${p?.axisUnit===""?e("normHint"):e("lgBand",{lo:b(t.low),hi:b(t.high)})}</span>
                ${t.source==="climate"?r`<span><i data-k="sp"></i>${e("lgSetpoint")}</span>`:l}${t.door?r`<span><i data-k="door"></i>${e("lgDoor")}</span>`:l}${t.defrost.mode!=="none"?r`<span><i data-k="defrost"></i>${e("lgDefrost")}</span>`:l}</div>
              <div class="stat4" data-temp-stats>
                <div><span>${e("statMin")}</span><b class="num" dir="ltr">${b(h.min)}</b></div>
                <div><span>${e("statMax")}</span><b class="num" dir="ltr">${b(h.max)}</b></div>
                <div><span>${e("statAvg")}</span><b class="num" dir="ltr">${b(h.avg)}</b></div>
                <div><span>${e("statOut")}</span><b class="num" data-temp-out>${h.out_min?I(h.out_min):"0"}</b>${h.out_min_raw!==h.out_min?r`<small>${e("statOutRaw",{d:I(h.out_min_raw)})}</small>`:l}</div>
              </div>
            </div>
            <div class="panel"><h4 style="margin-block-end:10px">${e("timeline")}</h4>${this.bars(t,s)}</div>
            ${x.length?r`<div class="panel" data-temp-compare><div class="ph"><h4>${e("compare")}</h4><span class="hint">${e("compareHint")}</span></div>
              ${this.cmp.length?r`<div class="cmpbar"><span class="hint">${e("compareScale")}</span><sw-segmented label=${e("compareScale")} value=${this.cmpScale} @change=${d=>{this.cmpScale=d.detail.value,this.cross=null}}
                  .options=${[{value:"shared",label:e("scaleShared"),attrs:{"data-cmp-scale":"shared"}},{value:"norm",label:e("scaleNorm"),attrs:{"data-cmp-scale":"norm"}}]}></sw-segmented>
                <button type="button" class="btn sm ghost" data-cmp-clear @click=${()=>{this.cmp=[],this.cmpHist={}}}>${e("compareClear")}</button></div>`:l}
              <div class="cmp">${x.map(d=>r`<div class="cirow"><label class="cmpck" title=${e("compareChart")}><input type="checkbox" .checked=${this.cmp.includes(d.id)} data-cmp-pick=${d.id}
                  ?disabled=${!this.cmp.includes(d.id)&&this.cmp.length>=Ct} aria-label=${`${e("compareChart")}: ${d.name}`}
                  @change=${m=>this.toggleCompare(d.id,m.target.checked)} /></label>
                <button type="button" class="ci" data-compare=${d.id} @click=${()=>this.dispatchEvent(new CustomEvent("open-unit",{detail:d.id}))}>
                <div><b>${d.name}</b><small>${d.area_name??""}</small></div>${Nt(d,s,200,30)}<div class="o">${d.stats_24h.out_min?e("excursion",{d:I(d.stats_24h.out_min)}):e("inRange")}</div></button></div>`)}</div>
              <p class="hint" style="margin:6px 0 0">${e("compareMax")}</p></div>`:l}
          </div>
          <div class="col">
            ${this.explain&&this.whyEvent?r`<temp-explain .unitId=${t.id} .eventId=${this.whyEvent} @close=${()=>{this.whyEvent=""}}></temp-explain>`:l}
            <div class="panel"><div class="ringrow"><div class="ring">${ls(t,s)}</div>
              <div style="flex:1;display:grid;gap:6px"><h4>${e("ringTitle")}</h4><p class="hint" style="margin:0">${e("ringHint")}</p>
                <div class="legend"><span><i data-k="ok"></i>${e("ringOk")}</span><span><i data-k="warn"></i>${e("ringWarn")}</span><span><i data-k="alarm"></i>${e("ringAlarm")}</span><span><i data-k="none"></i>${e("ringNone")}</span></div></div></div></div>
            ${this.healthPanel(t,a)}
            ${this.doorPanel(t,a)}
            ${this.dutyPanel(t)}
            ${this.ticketsPanel(t)}
            ${this.defrostPanel(t)}
            <div class="panel"><div class="ph"><h4>${e("recent")}</h4><a class="btn sm ghost" href=${`${pt}/log?unit=${encodeURIComponent(t.id)}`} data-temp-fulllog>${e("fullLog")}</a></div>
              <div class="events" data-temp-events>${this.events.length?this.events.map(d=>r`<div class="ev" style=${`--c:${v[d.severity]}`}><time>${F(Date.parse(d.started_at),a)}</time>
                <div><i aria-hidden="true"></i>${ut(d)}${this.explain&&(d.kind==="high"||d.kind==="low")?r` <button type="button" class="btn sm ghost" data-temp-why-btn=${d.id}
                  aria-pressed=${String(this.whyEvent===d.id)} @click=${()=>{this.whyEvent=this.whyEvent===d.id?"":d.id,this.updateComplete.then(()=>this.renderRoot.querySelector("temp-explain")?.scrollIntoView({block:"nearest",behavior:"smooth"}))}}>${e("whyBtn")}</button>`:l}</div>
                <span class="chip" data-tone=${d.ended_at?"mut":"err"}>${d.ended_at?e("closed"):e("open")}</span></div>`):r`<p class="hint">${e("noRecent")}</p>`}</div></div>
          </div>
          <div class="ovs"><slot></slot>
            ${this.ticket&&ot()?r`<temp-ticket .unitId=${t.id} .eventId=${this.ticket.eventId} @close=${()=>{this.ticket=null}}
              @done=${d=>{this.ticket=null,this.dispatchEvent(new CustomEvent("changed",{detail:d.detail.message}))}}></temp-ticket>`:l}</div>
        </div>
        <div slot="footer" class="df">
          ${this.err?r`<span class="err" role="alert">${this.err}</span>`:l}
          ${this.canAck?r`<button type="button" class="btn pri" ?disabled=${!c||this.busy} data-temp-ack @click=${()=>this.act(()=>he(t.id),"acked")}><sw-icon name="check" size="16"></sw-icon>${e("ack")}</button>
            ${t.muted_until?r`<button type="button" class="btn" ?disabled=${this.busy} data-temp-unmute @click=${()=>this.act(()=>ue(t.id),"saved")}><sw-icon name="bell" size="16"></sw-icon>${e("unmute")}</button>`:r`<button type="button" class="btn" ?disabled=${this.busy} aria-expanded=${String(this.muteOpen)} data-temp-mute @click=${()=>{this.muteOpen=!this.muteOpen}}><sw-icon name="bellOff" size="16"></sw-icon>${e("mute")}</button>`}`:l}
          ${this.canAck?t.maintenance?r`<button type="button" class="btn" ?disabled=${this.busy} data-temp-maint-end @click=${()=>this.act(()=>me(t.id),"maintEnded")}><sw-icon name="wrench" size="16"></sw-icon>${e("maintEnd")}</button>`:r`<button type="button" class="btn" ?disabled=${this.busy} aria-expanded=${String(this.maintOpen)} data-temp-maint @click=${()=>{this.maintOpen=!this.maintOpen,this.muteOpen=!1}}><sw-icon name="wrench" size="16"></sw-icon>${e("maintBtn")}</button>`:l}
          <button type="button" class="btn" data-temp-report @click=${()=>this.dispatchEvent(new CustomEvent("report",{detail:t.id}))}><sw-icon name="download" size="16"></sw-icon>${e("report")}</button>
          ${this.canAck&&ot()?r`<button type="button" class="btn" data-temp-ticket-btn @click=${()=>{this.ticket={eventId:g?.id??null}}}><sw-icon name="ticket" size="16"></sw-icon>${e("ticketBtn")}</button>`:l}
          <span class="sp"></span>
          ${this.canManage?r`<button type="button" class="btn ghost" data-temp-detail-edit @click=${()=>this.dispatchEvent(new CustomEvent("edit"))}><sw-icon name="edit" size="16"></sw-icon>${e("edit")}</button>`:l}
          ${this.muteOpen?r`<div class="pop" role="menu" data-nested-open data-temp-mutepop><div class="hd">${e("muteTitle")}</div>${t.rules.mute_includes_alarms?l:r`<div class="nt">${e("muteNote")}</div>`}
            ${fs.map(d=>r`<button type="button" role="menuitem" data-mute=${d} @click=${()=>{this.muteOpen=!1,this.act(()=>gt(t.id,{minutes:d}),"muted",{t:F(s+d*6e4,a)})}}>${I(d)}<span class="num">${F(s+d*6e4,a)}</span></button>`)}
            ${t.defrost.windows.some(d=>d.status!=="rejected")?r`<button type="button" role="menuitem" data-mute="defrost" @click=${()=>{this.muteOpen=!1,this.act(()=>gt(t.id,{until_defrost_end:!0}),"saved")}}>${e("muteDefrost")}</button>`:l}
          </div>`:l}
          ${this.maintOpen?this.maintPop(t,a):l}
        </div>
      </sw-drawer>`}};f.styles=[V,G`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8B): the unit's detail is the system's one drawer (sw-drawer modal: the scrim, the
       opaque surface, the title and close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's
       full-height sheet). It opens from the same side as every other drawer; the coloured ground is gone. The expand key keeps its
       behaviour: it only widens the same drawer. */
    :host { display: contents; }
    sw-drawer { --sw-drawer-modal-w: 560px; }
    sw-drawer[data-wide] { --sw-drawer-modal-w: min(1240px, 100vw); }
    .hact { display: flex; align-items: center; gap: 8px; }
    .icb { inline-size: 36px; block-size: 36px; padding: 0; justify-content: center; }
    .db { position: relative; min-inline-size: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
    .db.wide { grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
    /* the dialogs opened over the detail (report, edit wizard, service call) live inside the modal drawer - everything outside it is inert */
    .ovs { position: absolute; inline-size: 0; block-size: 0; }
    .col { display: grid; gap: 12px; align-content: start; min-inline-size: 0; }
    .df { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; position: relative; flex: 1; }
    .df .sp { flex: 1; }
    .df { min-inline-size: 0; }
    .df .err { flex: 1 1 100%; overflow-wrap: anywhere; }
    .headrow { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .headrow > * { min-inline-size: 0; }
    .headrow > .gauge { flex: none; }
    .summ { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .summ > div { display: flex; gap: 10px; justify-content: space-between; border-block-end: 1px solid var(--sw-border); padding-block: 5px; }
    .summ > div > span { color: var(--sw-text-2); flex: none; }
    .summ b { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); text-align: end; min-inline-size: 0; overflow-wrap: anywhere; }
    .summ > div > span { overflow-wrap: anywhere; }
    .sname { overflow-wrap: anywhere; word-break: break-word; }
    .ph { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-block-end: 8px; }
    .ph h4 { flex: 1; }
    .bigchart { position: relative; block-size: 250px; touch-action: pan-y; min-inline-size: 0; max-inline-size: 100%; overflow: hidden; }
    .bigchart svg { inline-size: 100%; block-size: 100%; display: block; }
    .tip {
      position: absolute; pointer-events: none; transform: translate(-50%, -115%); background: var(--sw-surface-solid); border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-sm); padding: 6px 9px; box-shadow: var(--sw-shadow-2); font-size: var(--sw-fs-xs); white-space: nowrap; direction: ltr;
    }
    .tip b { font-size: var(--sw-fs-md); }
    .stat4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-block-start: 10px; }
    .stat4 > div { min-inline-size: 0; overflow-wrap: anywhere; background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 10px 12px; display: grid; gap: 3px; }
    .stat4 span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); font-weight: var(--sw-fw-medium); }
    .stat4 b { font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; color: var(--sw-heading); font-variant-numeric: tabular-nums; }
    .stat4 small { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .tlrow { display: grid; gap: 4px; margin-block-end: 10px; }
    .tlrow .lbl { display: flex; justify-content: space-between; gap: 8px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); flex-wrap: wrap; }
    .cmp { display: grid; gap: 8px; }
    .ci { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 10px; align-items: center; padding: 6px 8px; border-radius: var(--sw-r-sm); border: 0; background: transparent; font: inherit; color: inherit; text-align: start; cursor: pointer; }
    /* R5-MEDIA-ENERGY-297 (mobile-native): hover only under a pointer that hovers; the row answers the press */
    @media (hover: hover) and (pointer: fine) { .ci:hover { background: var(--sw-hover-wash); } }
    .ci:active { background: var(--sw-surface-3); }
    .ci > div { min-inline-size: 0; overflow-wrap: anywhere; }
    .ci small { display: block; color: var(--sw-text-3); font-size: var(--sw-fs-2xs); }
    .ci .spark { block-size: 30px; }
    .ci .o { font-size: var(--sw-fs-xs); color: var(--sw-text-2); white-space: nowrap; }
    .ringrow { display: flex; gap: 16px; align-items: center; min-inline-size: 0; }
    .ringrow > div:not(.ring) { min-inline-size: 0; }
    .ring { inline-size: 150px; block-size: 150px; flex: none; }
    .ring svg { inline-size: 100%; block-size: 100%; }
    .events { display: grid; }
    .ev { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding-block: 8px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .ev > div { min-inline-size: 0; overflow-wrap: anywhere; }
    .win, .ph, .legend, .cmpbar { min-inline-size: 0; }
    .legend span { overflow-wrap: anywhere; }
    .ev time { color: var(--sw-text-2); font-variant-numeric: tabular-nums; }
    .ev i { display: inline-block; inline-size: 8px; block-size: 8px; border-radius: 50%; background: var(--c, var(--sw-accent)); margin-inline-end: 6px; }
    .wins { display: grid; gap: 6px; }
    .win { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); }
    .win .w { font-variant-numeric: tabular-nums; direction: ltr; }
    .pop {
      position: absolute; inset-block-end: calc(100% + 6px); inset-inline-start: 0; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md); box-shadow: var(--sw-shadow-3); padding: 6px; display: grid; min-inline-size: min(220px, calc(100vw - 32px)); max-inline-size: calc(100vw - 32px); z-index: 1;
    }
    .pop .hd { padding: 6px 10px; font-weight: var(--sw-fw-semibold); font-size: var(--sw-fs-sm); }
    .pop .nt { padding: 0 10px 6px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .pop button { display: flex; justify-content: space-between; gap: 16px; border: 0; background: transparent; padding: 8px 10px; border-radius: var(--sw-r-sm); font: inherit; color: inherit; cursor: pointer; text-align: start; }
    @media (hover: hover) and (pointer: fine) { .pop button:hover { background: var(--sw-hover-wash); } }
    .pop button:active { background: var(--sw-surface-3); }
    ${Z}
    /* phase 3 */
    .summ.hl b[data-bad='true'] { color: var(--sw-warning-text); font-weight: var(--sw-fw-semibold); }
    .warnline { color: var(--sw-warning-text) !important; }
    .fx { display: grid; gap: 2px; margin-block-start: 8px; }
    .fxr { display: grid; grid-template-columns: auto auto 1fr; gap: 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
    .bars { display: flex; align-items: flex-end; gap: 4px; block-size: 46px; margin-block-start: 10px; }
    .bars span { flex: 1; block-size: 100%; display: flex; align-items: flex-end; background: var(--sw-surface-2); border-radius: var(--sw-r-2xs); overflow: hidden; }
    .bars i { display: block; inline-size: 100%; background: var(--tc-acc); opacity: 0.7; }
    .cmpbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block-end: 8px; }
    .cirow { display: flex; align-items: center; gap: 4px; }
    .cirow .ci { flex: 1; min-inline-size: 0; }
    .cmpck { display: grid; place-items: center; inline-size: 32px; block-size: 32px; flex: none; }
    .cmpck input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .ev.tk { text-decoration: none; color: inherit; }
    .pop.maint { min-inline-size: min(320px, calc(100vw - 32px)); gap: 8px; padding: 10px; }
    .pop .mf { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .pop .in { min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .pop.maint > .btn { justify-self: start; }
    @media (max-width: 900px) {
      .db.wide { grid-template-columns: minmax(0, 1fr); }
    }
    @media (max-width: 600px) {
      .headrow { flex-direction: column; align-items: stretch; }
      .headrow > .gauge { align-self: center; }
      .stat4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ringrow { flex-direction: column; }
    }
  `];$([k({attribute:!1})],f.prototype,"unit",2);$([k({attribute:!1})],f.prototype,"units",2);$([k({type:Boolean})],f.prototype,"canAck",2);$([k({type:Boolean})],f.prototype,"canManage",2);$([k({type:Boolean})],f.prototype,"stale",2);$([k({type:Boolean})],f.prototype,"explain",2);$([u()],f.prototype,"range",2);$([u()],f.prototype,"hist",2);$([u()],f.prototype,"histError",2);$([u()],f.prototype,"events",2);$([u()],f.prototype,"wide",2);$([u()],f.prototype,"muteOpen",2);$([u()],f.prototype,"busy",2);$([u()],f.prototype,"err",2);$([u()],f.prototype,"chartW",2);$([u()],f.prototype,"cross",2);$([u()],f.prototype,"maintOpen",2);$([u()],f.prototype,"maintReason",2);$([u()],f.prototype,"maintMin",2);$([u()],f.prototype,"ticket",2);$([u()],f.prototype,"cmp",2);$([u()],f.prototype,"cmpScale",2);$([u()],f.prototype,"cmpHist",2);$([u()],f.prototype,"whyEvent",2);$([re(".bigchart")],f.prototype,"chartBox",2);f=$([K("temp-detail")],f);var ys=Object.defineProperty,ks=Object.getOwnPropertyDescriptor,D=(t,s,a,o)=>{for(var i=o>1?void 0:o?ks(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&ys(s,a,i),i};const _s=[["viewer","צופים"],["operator","מפעילים"],["site_admin","מנהלי אתר"],["system_admin","מנהלי מערכת"]];let O=class extends Y{constructor(){super(...arguments),this.unitId=null,this.step=1,this.d=ge(),this.meta=null,this.temps=[],this.doors=[],this.powers=[],this.qp="",this.users=[],this.groups=[],this.qt="",this.qd="",this.qu="",this.err="",this.busy=!1}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){super.disconnectedCallback()}async load(){try{const[t,s,a]=await Promise.all([be(),lt("temp"),lt("door")]);this.meta=t,this.temps=s.items,this.doors=a.items,lt("power").then(i=>this.powers=i.items).catch(()=>this.powers=[]);const o=this.unitId?t.units.find(i=>i.id===this.unitId):null;o&&(this.d=fe(o))}catch(t){this.err=z(t)}as().then(t=>this.users=t.users.filter(s=>s.active)).catch(()=>{}),is().then(t=>this.groups=t.groups).catch(()=>{})}close(){this.dispatchEvent(new CustomEvent("close"))}get defaults(){return this.meta?.defaults??{}}get isClimate(){return this.d.temp_entity_id.startsWith("climate.")}patch(t){this.d={...this.d,...t}}rule(t){return $e(this.d,this.defaults,t)}setRule(t,s){this.d=xe(this.d,this.defaults,t,s)}num(t){return Number(t.target.value)}go(t){if(t>this.step)for(let s=this.step;s<t;s++){const a=bt(this.d,s);if(a){this.err=e(a),this.step=s;return}}this.err="",this.step=t}async save(){const t=bt(this.d,0);if(t){this.err=e(t);return}this.busy=!0,this.err="";try{this.d.id?await ye(this.d.id,ft(this.d)):await ke(ft(this.d)),this.dispatchEvent(new CustomEvent("saved",{detail:e("saved")}))}catch(s){this.err=z(s)}finally{this.busy=!1}}async removeUnit(){if(!(!this.d.id||!await qt({body:e("removeConfirm",{name:this.d.name}),danger:!0}))){this.busy=!0;try{await _e(this.d.id),this.dispatchEvent(new CustomEvent("removed",{detail:e("saved")}))}catch(t){this.err=z(t)}finally{this.busy=!1}}}pickTemp(t){const s=t.group==="climate",a={temp_entity_id:t.entity_id};this.d.name.trim()||(a.name=U(t.name,"")),s&&!this.d.id&&(a.band_mode="setpoint",a.kind="room",a.defrost_mode="none",t.setpoint!==null&&(a.low=Math.round(t.setpoint-2),a.high=Math.round(t.setpoint+2))),this.patch(a)}sensorList(t){const s=(t==="temp"?this.qt:this.qd).trim().toLowerCase(),a=(t==="temp"?this.temps:this.doors).filter(h=>!s||h.name.toLowerCase().includes(s)||h.entity_id.includes(s)||(h.area_name??"").toLowerCase().includes(s)),o=t==="temp"?this.d.temp_entity_id:this.d.door_entity_id,i=h=>r`<button type="button" class="sopt" role="option" aria-selected=${String(o===h.entity_id)} data-cand=${h.entity_id}
        @click=${()=>t==="temp"?this.pickTemp(h):this.patch({door_entity_id:h.entity_id})}>
      <sw-icon name=${t==="door"?"door":h.group==="climate"?"fan":"thermometer"} size="16"></sw-icon>
      <span class="tx"><span class="nm">${U(h.name,h.area_name??"")}${h.area_name?r` <span class="def">· ${h.area_name}</span>`:l}</span></span>
      <span class="lv">${t==="door"?h.state==="on"?e("doorOpenWord"):h.state==="off"?e("doorClosedWord"):"":h.value===null?e("disconnected"):`${B(h.value)}°${h.setpoint!==null?` → ${B(h.setpoint)}°`:""}`}</span></button>`;if(t==="door")return r`<div class="slist" role="listbox" aria-label=${e("doorSensor")} data-door-list>
        <button type="button" class="sopt" role="option" aria-selected=${String(!this.d.door_entity_id)} data-cand="" @click=${()=>this.patch({door_entity_id:null,door_invert:!1})}>
          <sw-icon name="close" size="16"></sw-icon><span class="tx"><span class="nm">${e("noDoorSensor")}</span></span></button>
        ${a.map(i)}</div>`;const n=a.filter(h=>h.group==="sensor"),p=a.filter(h=>h.group==="climate");return r`<div class="slist" role="listbox" aria-label=${e("tempSensor")} data-temp-list>
      ${n.length?r`<div class="grp" data-grp="sensor">${e("groupSensors")}</div>${n.map(i)}`:l}
      ${p.length?r`<div class="grp" data-grp="climate">${e("groupClimate")}</div>${p.map(i)}`:l}
      ${a.length?l:r`<p class="hint" style="padding:10px">${e("noSensors")}</p>`}</div>`}step1(){const t=this.doors.find(a=>a.entity_id===this.d.door_entity_id),s=t?.state?t.state==="on"!==this.d.door_invert?e("doorOpenWord"):e("doorClosedWord"):"";return r`<div class="f2">
        <div class="field"><label for="w-name">${e("name")}</label><input id="w-name" class="in" .value=${this.d.name} placeholder=${e("namePh")} maxlength="60"
          @input=${a=>this.patch({name:a.target.value})} data-w-name /></div>
        <div class="field"><label for="w-area">${e("area")}</label><select id="w-area" class="in" @change=${a=>this.patch({area_id:a.target.value||null})} data-w-area>
          <option value="" ?selected=${!this.d.area_id}>${e("noArea")}</option>
          ${(this.meta?.areas??[]).map(a=>r`<option value=${a.area_id} ?selected=${this.d.area_id===a.area_id}>${a.name}${a.floor_name?` · ${a.floor_name}`:""}</option>`)}</select></div>
      </div>
      <div class="field"><label for="w-kind">${e("kind")}</label><select id="w-kind" class="in" @change=${a=>this.patch({kind:a.target.value})} data-w-kind>
        ${(this.meta?.kinds??[]).map(a=>r`<option value=${a} ?selected=${this.d.kind===a}>${e($t[a])}</option>`)}</select></div>
      <div class="field"><span class="lbl">${e("tempSensor")} <span class="chip" data-tone="err">${e("required")}</span></span>
        <input class="in" type="search" placeholder=${e("searchTemp")} .value=${this.qt} @input=${a=>{this.qt=a.target.value}} aria-label=${e("searchTemp")} />
        ${this.sensorList("temp")}<span class="hint">${e("tempHint")}${this.isClimate?r` · ${e("climateHint")}`:l}</span></div>
      <div class="field"><span class="lbl">${e("doorSensor")} <span class="chip">${e("optional")}</span></span>
        <input class="in" type="search" placeholder=${e("searchDoor")} .value=${this.qd} @input=${a=>{this.qd=a.target.value}} aria-label=${e("searchDoor")} />
        ${this.sensorList("door")}
        ${this.d.door_entity_id?r`<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center"><label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("invert")} .checked=${this.d.door_invert}
            @change=${a=>this.patch({door_invert:E(a)})} data-w-invert></sw-toggle><span>${e("invert")}</span></label>${s?r`<span class="hint">${e("doorNow",{s})}</span>`:l}</div>`:l}</div>
      ${this.powers.length||this.d.power_entity_id?this.powerField():l}`}powerField(){const t=this.qp.trim().toLowerCase(),s=this.powers.filter(o=>!t||o.name.toLowerCase().includes(t)||o.entity_id.includes(t)||(o.area_name??"").toLowerCase().includes(t)),a=this.d.power_entity_id;return r`<div class="field" data-w-power><span class="lbl">${e("powerSensor")} <span class="chip">${e("optional")}</span></span>
      <input class="in" type="search" placeholder=${e("searchPower")} .value=${this.qp} @input=${o=>{this.qp=o.target.value}} aria-label=${e("searchPower")} />
      <div class="slist" role="listbox" aria-label=${e("powerSensor")} data-power-list>
        <button type="button" class="sopt" role="option" aria-selected=${String(!a)} data-cand="" @click=${()=>this.patch({power_entity_id:null})}>
          <sw-icon name="close" size="16"></sw-icon><span class="tx"><span class="nm">${e("noPowerSensor")}</span></span></button>
        ${s.map(o=>r`<button type="button" class="sopt" role="option" aria-selected=${String(a===o.entity_id)} data-cand=${o.entity_id} @click=${()=>this.patch({power_entity_id:o.entity_id})}>
          <sw-icon name="power" size="16"></sw-icon><span class="tx"><span class="nm">${U(o.name,o.area_name??"")}${o.area_name?r` <span class="def">· ${o.area_name}</span>`:l}</span></span>
          <span class="lv">${o.watts===null||o.watts===void 0?e("disconnected"):`${Math.round(o.watts)} W`}</span></button>`)}</div>
      <span class="hint">${e("powerHint")}</span>
      ${a?r`<label class="sw">${e("compressorOnW")}<input class="in n" type="number" step="1" min="0.5" max="5000" .value=${String(this.rule("compressor_on_w"))}
        @change=${o=>this.setRule("compressor_on_w",Math.max(.5,this.num(o)))} data-w-onw /></label>`:l}</div>`}check(t,s){return r`<label class="sw" data-w-rule=${t}><sw-toggle size="sm" labelHidden in-label label=${e(s)} .checked=${this.rule(t)} @change=${a=>this.setRule(t,E(a))}></sw-toggle>${e(s)}
      ${t in this.d.rules?r`<span class="def">${e("fromDefault",{v:String(this.defaults[t])})}</span>`:l}</label>`}numRule(t,s,a,o,i=1){return r`<label class="sw" data-w-rule=${t}>${e(s)}<input class="in n" type="number" min=${a} max=${o} step=${i} .value=${String(this.rule(t))}
      @change=${n=>this.setRule(t,Math.max(a,Math.min(o,i===1?Math.round(this.num(n)):this.num(n))))} />
      ${t in this.d.rules?r`<span class="def">${e("fromDefault",{v:String(this.defaults[t])})}</span>`:l}</label>`}phase3Rules(){const t=this.d;return r`<details class="field more" data-w-phase3><summary class="lbl">${e("phase3Title")}</summary><div style="display:grid;gap:8px;padding-block-start:8px">
      ${this.check("predict_enabled","predictEnabled")}
      ${this.rule("predict_enabled")?r`${this.numRule("predict_horizon_min","predictHorizon",5,240)}${this.check("predict_warn","predictWarn")}${this.rule("predict_warn")?this.numRule("predict_warn_min","predictWarnMin",5,240):l}`:l}
      ${this.check("escalation_enabled","escalationUnit")}
      ${this.check("maintenance_includes_alarms","maintAlarms")}
      ${this.numRule("maintenance_max_min","maintMax",15,1440)}
      ${this.check("health_warn","healthWarn")}
      ${this.numRule("battery_low_pct","batteryLow",5,60)}
      ${this.numRule("frozen_min","frozenMin",0,2880)}
      ${t.door_entity_id?r`${this.check("recovery_alert","recoveryAlert")}${this.numRule("recovery_slow_min","recoverySlow",5,240)}`:l}
      ${t.power_entity_id?r`${this.check("duty_alert","dutyAlert")}${this.numRule("duty_rise_pts","dutyRise",5,80)}`:l}
    </div></details>`}ruleRow(t,s,a,o,i,n){const p=this.rule(t),h=this.defaults[s];return r`<div class="rule" ?data-off=${!p} data-rule=${t}><label class="sw"><sw-toggle size="sm" labelHidden in-label .checked=${p} label=${e(a)} @change=${c=>this.setRule(t,E(c))}></sw-toggle></label>
      <div class="txt"><sw-icon name=${i} size="16"></sw-icon>${e(a)}<input class="in n" type="number" min="0" max="1440" .value=${String(this.rule(s))} aria-label=${e("minutes")}
        @change=${c=>this.setRule(s,Math.max(0,Math.round(this.num(c))))} data-rule-min=${s} />${e("minutes")}
        <span class="chip" data-tone=${o==="alarm"?"err":"warn"}>${e(o==="alarm"?"chipAlarm":"chipWarn")}</span>${n??l}
        ${s in this.d.rules?r`<span class="def">${e("fromDefault",{v:String(h)})}</span>`:l}</div></div>`}step2(){const t=this.d,s=this.meta?.templates??{},a={low:t.low,high:t.high,value:null,value_last:null};return r`<div class="gprev">${rt(a,"ok",null,120)}
        <div style="flex:1;display:grid;gap:10px">
          ${this.isClimate?r`<div class="field"><span class="lbl">${e("bandMode")}</span><sw-segmented value=${t.band_mode} @change=${o=>this.patch({band_mode:o.detail.value})}
            .options=${[{value:"fixed",label:e("bandFixed"),attrs:{"data-band":"fixed"}},{value:"setpoint",label:e("bandSetpoint"),attrs:{"data-band":"setpoint"}}]}></sw-segmented>
            ${t.band_mode==="setpoint"?r`<label class="sw">${e("tolerance")}<input class="in n" type="number" step="0.5" min="0.1" max="20" .value=${String(this.rule("setpoint_tolerance"))}
                @change=${o=>this.setRule("setpoint_tolerance",this.num(o))} data-w-tol /></label><span class="hint">${e("bandSetpointHint",{v:`±${this.rule("setpoint_tolerance")}°`})}</span>`:l}</div>`:l}
          <div class="f2">
            <div class="field"><label for="w-low">${e("low")}</label><input id="w-low" class="in" type="number" step="0.5" .value=${String(t.low)} @change=${o=>this.patch({low:this.num(o)})} data-w-low /></div>
            <div class="field"><label for="w-high">${e("high")}</label><input id="w-high" class="in" type="number" step="0.5" .value=${String(t.high)} @change=${o=>this.patch({high:this.num(o)})} data-w-high /></div>
          </div>
          <div class="tpl"><span class="hint">${e("templates")}</span>${Object.entries(s).map(([o,i])=>r`<button type="button" class="btn sm ghost" data-tpl=${o}
            @click=${()=>this.patch({low:i[0],high:i[1],kind:o})}>${e($t[o])} ${b(i[0])}–${b(i[1])}</button>`)}</div>
        </div></div>
      <div class="field"><span class="lbl">${e("rulesTitle")}</span><div style="display:grid;gap:8px">
        ${t.door_entity_id?this.ruleRow("door_alarm","door_alarm_min","ruleDoor","alarm","doorOpen"):l}
        ${this.ruleRow("high_alarm","high_alarm_min","ruleHigh","alarm","arrowUp",r`<span class="hint">· ${e("ruleWarnNow")}</span>`)}
        ${this.ruleRow("low_alarm","low_alarm_min","ruleLow","alarm","snow")}
        ${this.ruleRow("offline_warn","offline_min","ruleOffline","warn","offline")}
        <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("ruleWarnNow")} .checked=${this.rule("warn_on_excursion")} @change=${o=>this.setRule("warn_on_excursion",E(o))} data-w-warnnow></sw-toggle><span>${e("ruleWarnNow")}</span></label>
        ${this.isClimate?r`<label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("alertWhenOff")} .checked=${this.rule("alert_when_off")} @change=${o=>this.setRule("alert_when_off",E(o))} data-w-whenoff></sw-toggle><span>${e("alertWhenOff")}</span></label><span class="hint">${e("offHint")}</span>`:l}
      </div></div>`}step3(){const t=this.d,s=(n,p,h)=>h?[...new Set([...n,p])]:n.filter(c=>c!==p),a=this.qu.trim().toLowerCase(),o=this.users.filter(n=>!a||n.name.toLowerCase().includes(a)||n.username.toLowerCase().includes(a)).slice(0,80),i=this.rule("defrost_hard_margin");return r`<div class="field"><span class="lbl">${e("who")}</span>
        <sw-segmented value=${t.ownRecipients?"own":"default"} @change=${n=>this.patch({ownRecipients:n.detail.value==="own"})}
          .options=${[{value:"default",label:e("whoDefault"),attrs:{"data-who":"default"}},{value:"own",label:e("whoOwn"),attrs:{"data-who":"own"}}]}></sw-segmented>
        ${t.ownRecipients?r`<div style="display:grid;gap:8px">
          <span class="hint">${e("roles")}</span><div class="opts">${_s.map(([n,p])=>r`<label class="sw"><input type="checkbox" .checked=${t.recipients.roles.includes(n)}
            @change=${h=>this.patch({recipients:{...t.recipients,roles:s(t.recipients.roles,n,h.target.checked)}})} />${p}</label>`)}</div>
          ${this.users.length?r`<span class="hint">${e("users")}</span><input class="in" type="search" .value=${this.qu} @input=${n=>{this.qu=n.target.value}} aria-label=${e("users")} />
            <div class="opts scroll">${o.map(n=>r`<label class="sw"><input type="checkbox" .checked=${t.recipients.users.includes(n.id)}
              @change=${p=>this.patch({recipients:{...t.recipients,users:s(t.recipients.users,n.id,p.target.checked)}})} />${n.name||n.username}</label>`)}</div>`:l}
          ${this.groups.length?r`<span class="hint">${e("groups")}</span><div class="opts">${this.groups.map(n=>r`<label class="sw"><input type="checkbox" .checked=${t.recipients.groups.includes(n.id)}
              @change=${p=>this.patch({recipients:{...t.recipients,groups:s(t.recipients.groups,n.id,p.target.checked)}})} />${n.name}</label>`)}</div>`:l}
        </div>`:l}</div>
      <div class="field"><span class="lbl">${e("quiet")}</span><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("quiet")} .checked=${this.rule("quiet_enabled")} @change=${n=>this.setRule("quiet_enabled",E(n))} data-w-quiet></sw-toggle></label>
        <input class="in" style="inline-size:auto" type="time" lang=${J()} .value=${this.rule("quiet_from")} ?disabled=${!this.rule("quiet_enabled")} @change=${n=>this.setRule("quiet_from",n.target.value)} aria-label=${e("start")} />
        <span>${e("to")}</span>
        <input class="in" style="inline-size:auto" type="time" lang=${J()} .value=${this.rule("quiet_to")} ?disabled=${!this.rule("quiet_enabled")} @change=${n=>this.setRule("quiet_to",n.target.value)} aria-label=${e("to")} /></div></div>
      <div class="field" data-w-holds><label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("alertsEnabled")} .checked=${this.rule("alerts_enabled")} @change=${n=>this.setRule("alerts_enabled",E(n))} data-w-alerts></sw-toggle>${e("alertsEnabled")}</label>
        <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("quietAlarms")} .checked=${this.rule("quiet_includes_alarms")} @change=${n=>this.setRule("quiet_includes_alarms",E(n))}></sw-toggle>${e("quietAlarms")}</label>
        <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("muteAlarms")} .checked=${this.rule("mute_includes_alarms")} @change=${n=>this.setRule("mute_includes_alarms",E(n))}></sw-toggle>${e("muteAlarms")}</label>
        <span class="hint">${e("alarmsNever")}</span></div>
      ${this.phase3Rules()}
      <div class="field"><span class="lbl">${e("defrost")}</span>
        <sw-segmented data-w-defrost value=${t.defrost_mode}
          @change=${n=>{const p=n.detail.value;this.patch({defrost_mode:p,defrost_windows:p==="fixed"&&!t.defrost_windows.length?[{start:"03:00",minutes:30}]:t.defrost_windows})}}
          .options=${["learn","fixed","none"].map(n=>({value:n,label:e(n==="learn"?"modeLearn":n==="fixed"?"modeFixed":"modeNone"),attrs:{"data-mode":n}}))}></sw-segmented>
        <span class="hint">${e(t.defrost_mode==="learn"?"defrostLearnHint":t.defrost_mode==="fixed"?"defrostFixedHint":"defrostNoneHint")}</span>
        ${t.defrost_mode==="fixed"?r`<div style="display:grid;gap:6px">${t.defrost_windows.map((n,p)=>r`<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap" data-w-window=${p}>
            <input class="in" style="inline-size:auto" type="time" lang=${J()} .value=${n.start} aria-label=${e("start")} @change=${h=>this.patch({defrost_windows:t.defrost_windows.map((c,w)=>w===p?{...c,start:h.target.value}:c)})} />
            <span>${e("duration")}</span><input class="in n" type="number" min="5" max="180" .value=${String(n.minutes)} aria-label=${e("duration")}
              @change=${h=>this.patch({defrost_windows:t.defrost_windows.map((c,w)=>w===p?{...c,minutes:Math.max(5,Math.min(180,Math.round(this.num(h))))}:c)})} />
            <button type="button" class="btn sm ghost" aria-label=${e("removeWindow")} @click=${()=>this.patch({defrost_windows:t.defrost_windows.filter((h,c)=>c!==p)})}><sw-icon name="close" size="14"></sw-icon></button></div>`)}
          ${t.defrost_windows.length<6?r`<button type="button" class="btn sm" style="justify-self:start" @click=${()=>this.patch({defrost_windows:[...t.defrost_windows,{start:"15:00",minutes:30}]})}><sw-icon name="plus" size="14"></sw-icon>${e("addWindow")}</button>`:l}</div>`:l}
        ${t.defrost_mode!=="none"?r`<label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("excludeStats")} .checked=${this.rule("exclude_defrost_stats")} @change=${n=>this.setRule("exclude_defrost_stats",E(n))} data-w-exclude></sw-toggle><span>${e("excludeStats")}</span></label>
          <label class="sw">${e("hardMargin")}<input class="in n" type="number" step="0.5" min="0" max="50" .value=${String(i)} @change=${n=>this.setRule("defrost_hard_margin",this.num(n))} data-w-hard /></label>
          <span class="hint">${e("hardMax",{v:b((t.band_mode==="setpoint"&&this.isClimate,t.high+i))})}</span>`:l}</div>`}step4(){const t=this.d,s=this.temps.find(n=>n.entity_id===t.temp_entity_id),a=this.doors.find(n=>n.entity_id===t.door_entity_id),o={low:t.low,high:t.high,value:s?.value??null,value_last:null},i=t.defrost_mode==="learn"?e("modeLearn"):t.defrost_mode==="none"?e("modeNone"):t.defrost_windows.map(n=>`${n.start} · ${n.minutes}′`).join(", ");return r`<div class="gprev">${rt(o,"ok",null,130)}<div class="summ" data-w-summary>
        <div><span>${e("name")}</span><b>${t.name||"—"}</b></div>
        <div><span>${e("tempSensor")}</span><b>${U(s?.name,t.name)}</b></div>
        <div><span>${e("doorSensor")}</span><b>${a?U(a.name,t.name):e("none")}${a&&t.door_invert?" ⇄":""}</b></div>
        ${t.power_entity_id?r`<div><span>${e("powerSensor")}</span><b>${this.powers.find(n=>n.entity_id===t.power_entity_id)?.name??t.name}</b></div>`:l}
        <div><span>${e("bandMode")}</span><b dir="ltr">${this.isClimate&&t.band_mode==="setpoint"?`${e("bandSetpoint")} ±${this.rule("setpoint_tolerance")}°`:`${b(t.low)} – ${b(t.high)}`}</b></div>
        <div><span>${e("rulesTitle")}</span><b>${[this.rule("high_alarm")?`↑ ${this.rule("high_alarm_min")}′`:"",this.rule("low_alarm")?`↓ ${this.rule("low_alarm_min")}′`:"",t.door_entity_id&&this.rule("door_alarm")?`${e("kDoor")} ${this.rule("door_alarm_min")}′`:""].filter(Boolean).join(" · ")}</b></div>
        <div><span>${e("who")}</span><b>${t.ownRecipients?e("whoOwn"):e("whoDefault")}</b></div>
        <div><span>${e("defrost")}</span><b>${i}</b></div>
        ${t.id?r`<div><span>${e("enabled")}</span><b><label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("enabled")} .checked=${t.enabled} @change=${n=>this.patch({enabled:E(n)})} data-w-enabled></sw-toggle></label></b></div>`:l}
      </div></div>
      <div class="banner"><sw-icon name="check" size="16"></sw-icon><span>${e("summaryBanner")}</span></div>`}render(){const t=["step1","step2","step3","step4"];return r`<sw-dialog open wide heading=${this.unitId?e("wizEdit"):e("wizNew")} data-temp-wizard-dialog @close=${s=>{s.stopPropagation(),this.close()}}>
        <div class="steps">${t.map((s,a)=>r`<button type="button" aria-current=${this.step===a+1?"step":"false"} ?data-done=${this.step>a+1} data-step=${a+1}
          @click=${()=>this.go(a+1)}><i></i>${a+1} · ${e(s)}</button>`)}</div>
        <div class="wb" data-temp-wizard data-w-step=${this.step}>
          ${!this.meta&&!this.err?r`<div class="skl" style="block-size:200px"></div>`:this.step===1?this.step1():this.step===2?this.step2():this.step===3?this.step3():this.step4()}
        </div>
        <div slot="footer" class="wf">
          ${this.step>1?r`<button type="button" class="btn" @click=${()=>this.go(this.step-1)} data-w-prev><sw-icon name="chevron" size="16"></sw-icon>${e("prev")}</button>`:l}
          ${this.d.id&&this.step===4?r`<button type="button" class="btn ghost" ?disabled=${this.busy} @click=${()=>this.removeUnit()} data-w-remove><sw-icon name="trash" size="16"></sw-icon>${e("remove")}</button>`:l}
          <span class="sp"></span>${this.err?r`<span class="err" role="alert" data-w-err>${this.err}</span>`:l}
          <button type="button" class="btn ghost" @click=${()=>this.close()}>${e("cancel")}</button>
          ${this.step<4?r`<button type="button" class="btn pri" @click=${()=>this.go(this.step+1)} data-w-next>${e("next")}<sw-icon name="chevronBack" size="16"></sw-icon></button>`:r`<button type="button" class="btn pri" ?disabled=${this.busy} @click=${()=>this.save()} data-w-save><sw-icon name="check" size="16"></sw-icon>${this.d.id?e("save"):e("create")}</button>`}
        </div>
      </sw-dialog>`}};O.styles=[V,G`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the system's one dialog (sw-dialog: the scrim, the opaque centred box, the title
       and the close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's bottom sheet). */
    :host { display: contents; }
    /* the steps stay in view while the step's form scrolls under them */
    .steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; padding-block: 2px 10px; position: sticky; inset-block-start: 0; z-index: 1; background: var(--sw-menu-surface); }
    .steps button { border: 0; background: transparent; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); text-align: start; padding: 0; cursor: pointer; display: grid; gap: 6px; }
    .steps i { display: block; block-size: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); transition: background-color var(--sw-t-med) var(--sw-ease); }
    .steps button[aria-current='step'] { color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .steps button[aria-current='step'] i, .steps button[data-done] i { background: var(--sw-accent); }
    .wb { display: grid; gap: 14px; align-content: start; }
    .wf { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1; min-inline-size: 0; }
    .wf .sp { flex: 1; }
    .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .field { display: grid; gap: 6px; min-inline-size: 0; }
    .field > label, .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .in {
      min-block-size: var(--sw-ctl-h-md); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text);
      padding: 0 12px; font: inherit; box-sizing: border-box; inline-size: 100%;
    }
    .in:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .in.n { inline-size: 76px; text-align: center; min-block-size: 32px; padding: 0 6px; }
    .slist { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); max-block-size: 230px; overflow: auto; background: var(--sw-surface); }
    .grp { padding: 6px 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; }
    .sopt {
      display: flex; align-items: center; gap: 10px; inline-size: 100%; border: 0; border-block-end: 1px solid var(--sw-border); background: transparent; padding: 8px 12px;
      font: inherit; color: inherit; text-align: start; cursor: pointer;
    }
    .sopt[aria-selected='true'] { background: var(--sw-accent-soft); }
    .sopt .tx { flex: 1; min-inline-size: 0; display: grid; }
    .sopt .nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sopt .lv { font-variant-numeric: tabular-nums; color: var(--sw-text-2); white-space: nowrap; direction: ltr; }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .rule { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); flex-wrap: wrap; }
    .rule .txt { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; flex: 1; font-size: var(--sw-fs-sm); }
    .rule[data-off] .txt { opacity: 0.55; }
    .tpl { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .gprev { display: flex; gap: 16px; align-items: center; }
    .opts { display: flex; flex-wrap: wrap; gap: 6px 16px; }
    .opts.scroll { max-block-size: 160px; overflow: auto; }
    .summ { display: grid; gap: 4px; font-size: var(--sw-fs-sm); flex: 1; }
    .summ > div { display: flex; justify-content: space-between; gap: 10px; border-block-end: 1px solid var(--sw-border); padding-block: 5px; }
    .summ span { color: var(--sw-text-2); }
    .banner { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-sm); }
    ${Z}
    .def { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    details.more { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 10px 12px; background: var(--sw-surface); }
    details.more > summary { cursor: pointer; list-style-position: inside; }
    @media (max-width: 600px) {
      .f2 { grid-template-columns: 1fr; }
      .steps button { font-size: var(--sw-fs-xs); }
      .gprev { flex-direction: column; }
    }
  `];D([k()],O.prototype,"unitId",2);D([u()],O.prototype,"step",2);D([u()],O.prototype,"d",2);D([u()],O.prototype,"meta",2);D([u()],O.prototype,"temps",2);D([u()],O.prototype,"doors",2);D([u()],O.prototype,"powers",2);D([u()],O.prototype,"qp",2);D([u()],O.prototype,"users",2);D([u()],O.prototype,"groups",2);D([u()],O.prototype,"qt",2);D([u()],O.prototype,"qd",2);D([u()],O.prototype,"qu",2);D([u()],O.prototype,"err",2);D([u()],O.prototype,"busy",2);O=D([K("temp-wizard")],O);var zs=Object.defineProperty,Ss=Object.getOwnPropertyDescriptor,j=(t,s,a,o)=>{for(var i=o>1?void 0:o?Ss(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&zs(s,a,i),i};const Os=200;let N=class extends Y{constructor(){super(...arguments),this.units=[],this.unitFilter="",this.canSend=!1,this.q={range:"24h"},this.rows=[],this.total=0,this.error="",this.loading=!0,this.busy=!1,this.started=!1}updated(){this.started||(this.started=!0,this.unitFilter&&(this.q={...this.q,unit:this.unitFilter}),this.load(!1))}async load(t){this.loading=!0;try{const s=await Mt({...this.q,limit:Os,offset:t?this.rows.length:0});this.rows=t?[...this.rows,...s.events]:s.events,this.total=s.total,this.error=""}catch(s){this.error=z(s)}finally{this.loading=!1}}set(t){this.q={...this.q,...t},this.load(!1)}async csv(){this.busy=!0;try{await ze(this.q,it()==="en"?"en":"he")}catch(t){this.error=`${e("csvError")}: ${z(t)}`}finally{this.busy=!1}}columns(t,s){const a=nt(),o=n=>n==="alarm"?"bad":n==="warning"?"warn":"info",i=n=>{const p=new Date(n);return t-p.getTime()>20*36e5?`${ht(p)} `:""};return[{key:"started_at",label:e("colTime"),render:n=>r`<span class="num">${i(n.started_at)}${F(Date.parse(n.started_at),a)}</span>`},{key:"unit",label:e("colUnit"),render:n=>r`<span class="t1">${n.unit_name??""}</span><span class="t2">${s.get(n.unit_id)??""}</span>`},{key:"event",label:e("colEvent"),render:n=>r`${ut(n)}${xt(n)?r`<span class="t2">${xt(n)}</span>`:l}`},{key:"severity",label:e("colSev"),kind:"status",render:n=>r`<span class="chip" data-tone=${o(n.severity)}>${e(n.severity==="alarm"?"sevAlarm":n.severity==="warning"?"sevWarning":"sevInfo")}</span>`},{key:"value",label:e("colValue"),hideBelow:"phone",render:n=>r`<span class="num">${Se(n)}</span>`},{key:"duration",label:e("colDur"),hideBelow:"phone",render:n=>r`<span class="num">${Oe(n,t)}</span>`},{key:"status",label:e("colStatus"),kind:"status",render:n=>r`<span class="chip" data-tone=${n.ended_at?l:"bad"}>${n.ended_at?e("closed"):e("open")}</span>`}]}render(){const t=Date.now(),s=new Map(this.units.map(a=>[a.id,a.area_name??""]));return r`<div class="top lead-head"><div><h1>${e("logTitle")}</h1><p class="sub">${e("logSub")}</p></div><span class="sp"></span>
        <div class="meta">
          <button type="button" class="btn" data-temp-back @click=${()=>this.dispatchEvent(new CustomEvent("back"))}><sw-icon name="chevronBack" size="16"></sw-icon>${e("back")}</button>
          <button type="button" class="btn" ?disabled=${this.busy} data-temp-csv @click=${()=>this.csv()}><sw-icon name="download" size="16"></sw-icon>${e("csv")}</button>
          ${this.canSend?r`<button type="button" class="btn" data-temp-log-wa @click=${()=>this.dispatchEvent(new CustomEvent("whatsapp",{detail:this.q.unit?[this.q.unit]:this.units.map(a=>a.id)}))}><sw-icon name="share" size="16"></sw-icon>WhatsApp</button>`:l}
          <button type="button" class="btn" data-temp-log-pdf @click=${()=>this.dispatchEvent(new CustomEvent("report",{detail:this.q.unit?[this.q.unit]:this.units.map(a=>a.id)}))}><sw-icon name="download" size="16"></sw-icon>${e("report")}</button>
        </div></div>
      <div class="tcard">
        <div class="filters">
          <select aria-label=${e("colUnit")} data-f="unit" @change=${a=>this.set({unit:a.target.value||void 0})}>
            <option value="">${e("allUnits")}</option>${this.units.map(a=>r`<option value=${a.id} ?selected=${this.q.unit===a.id}>${a.name}</option>`)}</select>
          <select aria-label=${e("colEvent")} data-f="kind" @change=${a=>this.set({kind:a.target.value||void 0})}>
            <option value="">${e("allKinds")}</option><option value="temp">${e("kTemp")}</option><option value="door">${e("kDoor")}</option><option value="offline">${e("kOffline")}</option>
            <option value="defrost">${e("kDefrost")}</option><option value="health">${e("kHealth")}</option><option value="maint">${e("maintBtn")}</option><option value="act">${e("kAct")}</option></select>
          <select aria-label=${e("colSev")} data-f="severity" @change=${a=>this.set({severity:a.target.value||void 0})}>
            <option value="">${e("allSev")}</option><option value="alarm">${e("sevAlarm")}</option><option value="warning">${e("sevWarning")}</option><option value="info">${e("sevInfo")}</option></select>
          <select aria-label=${e("colTime")} data-f="range" @change=${a=>this.set({range:a.target.value})}>
            <option value="24h">${e("rng24")}</option><option value="7d">${e("rng7")}</option><option value="30d">${e("rng30")}</option></select>
          <span class="sp"></span><span class="chip" data-tone="acc" data-temp-count>${e("count",{n:this.total})}</span>
        </div>
        ${this.error?r`<p class="err" role="alert">${this.error}</p>`:l}
        <sw-table bare static-rows data-temp-log-table .columns=${this.columns(t,s)} .rows=${this.rows}
          .rowAttrs=${a=>({"data-event":String(a.id),"data-kind":String(a.kind),"data-sev":String(a.severity)})}>
          <p slot="empty" class="hint" data-state=${this.loading?"loading":"empty"}>${this.loading?"…":e("noEvents")}</p></sw-table>
        ${this.rows.length<this.total?r`<div class="foot"><button type="button" class="btn sm" ?disabled=${this.loading} @click=${()=>this.load(!0)}>+</button></div>`:l}
      </div>`}};N.styles=[V,G`
    :host { display: flex; flex-direction: column; gap: 14px; }
    .top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .top h1 { margin: 0; font-size: var(--sw-fs-3xl); line-height: 1.2; }
    .top .sub { margin: 2px 0 0; color: var(--sw-text-2); font-size: var(--sw-fs-base); }
    .top .sp { flex: 1; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; }
    /* R5-MEDIA-ENERGY-297: the log table is the page's hero object; its header row and severity marks carry weight */
    .tcard { background: var(--sw-surface); border: 1px solid var(--sw-border); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); overflow: hidden; }
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; padding: 12px; border-block-end: 1px solid var(--sw-border); }
    .filters select { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 12px; font: inherit; }
    .filters .sp { flex: 1; }
    /* CR-CMP2-TABLES-2450 (owner N10): the log is the shared table inside the card - the card's header band, the page's reading size,
       never wider than the card (the value and duration columns step out on a phone) */
    sw-table[data-temp-log-table] { --sw-table-min: 0; --sw-table-head-bg: var(--sw-surface-2); --sw-table-cell-pad: 10px 12px; --sw-table-fs: var(--sw-fs-md); }
    .hint { margin: 0; padding: 16px 12px; color: var(--sw-text-3); }
    .foot { display: flex; justify-content: center; padding: 10px; }
    .err { color: var(--sw-danger-text); padding: 12px; }
    @media (max-width: 700px) {
      .top { flex-direction: column; align-items: stretch; }
      .top .sp { display: none; }
    }
  `];j([k({attribute:!1})],N.prototype,"units",2);j([k()],N.prototype,"unitFilter",2);j([k({type:Boolean})],N.prototype,"canSend",2);j([u()],N.prototype,"q",2);j([u()],N.prototype,"rows",2);j([u()],N.prototype,"total",2);j([u()],N.prototype,"error",2);j([u()],N.prototype,"loading",2);j([u()],N.prototype,"busy",2);N=j([K("temp-log")],N);var Es=Object.defineProperty,Cs=Object.getOwnPropertyDescriptor,P=(t,s,a,o)=>{for(var i=o>1?void 0:o?Cs(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&Es(s,a,i),i};let M=class extends Y{constructor(){super(...arguments),this.units=[],this.preselect=[],this.canSend=!1,this.canLink=!1,this.linkOn=!1,this.waOn=!1,this.waSent=null,this.link=null,this.copied=!1,this.p={units:[],range:"24h",lang:"he",chart:!0,events:!0,signature:!0},this.model=null,this.err="",this.busy=!1,this.seq=0}connectedCallback(){super.connectedCallback();const t=Date.now();this.p={...this.p,units:this.preselect.length?[...this.preselect]:this.units.slice(0,1).map(s=>s.id),lang:document.documentElement.lang.startsWith("en")?"en":"he",from:yt(t-7*864e5),to:yt(t)},this.refresh(),this.canLink&&Ee().then(s=>{this.linkOn=s.available,this.waOn=s.available&&s.whatsapp?.available===!0},()=>{this.linkOn=!1,this.waOn=!1})}disconnectedCallback(){window.clearTimeout(this.timer),super.disconnectedCallback()}params(){return{...this.p}}setLayout(t){const s=this.p;if(t==="haccp"){if(s.layout==="haccp")return;const o=s.range==="24h"?"month":s.range;this.haccpAuto={range:o,prevRange:s.range,prevSignature:s.signature!==!1},this.set({layout:t,range:o,signature:!0});return}const a=this.haccpAuto;this.haccpAuto=void 0,this.set({layout:t,...a&&s.range===a.range?{range:a.prevRange}:{},...a&&!a.prevSignature?{signature:!1}:{}})}set(t){this.p={...this.p,...t},this.refresh()}refresh(){if(window.clearTimeout(this.timer),!this.p.units.length){this.model=null;return}const t=++this.seq;this.timer=window.setTimeout(()=>{(async()=>{const s=await Pt(this.params());t===this.seq&&(this.model=s,this.err="")})().catch(s=>{t===this.seq&&(this.err=z(s))})},250)}close(){this.dispatchEvent(new CustomEvent("close"))}async exportPdf(){if(!this.p.units.length){this.err=e("repNeedUnit");return}this.busy=!0,this.err="";try{await Ce(this.params()),this.dispatchEvent(new CustomEvent("done",{detail:e("repDone")}))}catch(t){this.err=z(t)}finally{this.busy=!1}}async makeLink(){if(!this.p.units.length){this.err=e("repNeedUnit");return}this.busy=!0,this.err="",this.copied=!1,this.waSent=null;try{this.link=await Re(this.params())}catch(t){this.err=z(t)}finally{this.busy=!1}}waText(t,s){const a=t==="sent"?e("repLinkWaSent"):t==="not_sendable"?e("repLinkWaNotSendable"):e("repLinkWaFailed"),o=`waR_${s??""}`;return s?`${a} - ${e(o)===o?s:e(o)}`:a}async copyLink(){try{await navigator.clipboard.writeText(this.link?.url??""),this.copied=!0}catch{this.copied=!1}}async sendLink(){if(this.link){this.busy=!0,this.err="";try{this.waSent=await Le(this.link.id)}catch(t){this.err=z(t)}finally{this.busy=!1}}}async revokeLink(){if(this.link)try{await Me(this.link.id),this.link=null,this.waSent=null,this.dispatchEvent(new CustomEvent("done",{detail:e("repLinkRevoked")}))}catch(t){this.err=z(t)}}samplesBlock(t,s,a,o){const i=s.samples;if(!t.samples||!i)return l;const n=h=>[[1,"sfDefrost"],[2,"sfDoor"],[4,"sfOff"],[8,"sfOut"],[16,"sfAlert"],[32,"sfAvg"]].filter(([c])=>h&c).map(([,c])=>a(c)).join(" · "),p=h=>_t(new Date(h*1e3),{timeZone:t.zone});return r`<div data-rep-samples-block>
      <b class="lbl">${a("repSamples")} · <span dir="ltr">${i.total}</span></b>
      ${i.rows.length?r`<table class="smp" data-rep-samples-table><thead><tr><th>${a("colTime")}</th><th>${a("colValue")}</th><th></th></tr></thead><tbody>
        ${i.rows.map(([h,c,w])=>r`<tr ?data-out=${(w&8)>0}><td dir="ltr">${p(h)}</td><td dir="ltr">${b(c)}</td><td>${n(w)}</td></tr>`)}
        ${i.total>i.rows.length?r`<tr><td colspan="3" class="hint" dir="ltr">+${i.total-i.rows.length}</td></tr>`:l}
      </tbody></table>`:r`<p class="hint">${a("repSamplesNone")}</p>`}
      ${i.capped?r`<p class="capnote" role="status" data-rep-samples-cap>${a("repSamplesCap").replace("{n}",String(i.shown)).replace("{m}",String(i.total))}</p>`:l}
    </div>`}paper(){const t=this.model;if(!t||!t.units.length)return r`<div class="paper" data-rep-paper><p class="hint">${this.p.units.length?"…":e("repNeedUnit")}</p></div>`;const s=t.units[0],a=s.stats,o=t.lang,i=c=>e(c,void 0,o),n=[["statMin",b(a.min)],["statMax",b(a.max)],["statAvg",b(a.avg)],["statOut",I(a.out_min)],["tlDoor",s.door?`${a.door_opens} · ${I(a.door_total_min)}`:"—"],["alertsTitle",String(a.alarms+a.warnings)]],p=s.has_data===!1||s.has_data===void 0&&a.min===null&&!(s.points??[]).length,h=(s.points??[]).map(c=>[c[0],c[1]]);return r`<div class="paper" dir=${o==="he"?"rtl":"ltr"} lang=${o} data-rep-paper>
      <div class="ph"><div><h3>${t.layout==="haccp"?i("repHaccp"):i("repTitle").replace(" (PDF)","")} · ${s.name}</h3><small>${[s.area,U(s.sensor,"")].filter(Boolean).join(" · ")} · ${i("lgBand").replace("{lo}",b(s.low)).replace("{hi}",b(s.high))}</small><small dir="ltr">${t.range_text}</small></div><b>SmplWise</b></div>
      ${p?r`<div class="nodata" data-rep-empty><b>${i("repNoData")}</b><span dir="ltr">${t.range_text}</span></div>`:r`
      <div class="st">${n.map(([c,w])=>r`<div><span>${i(c)}</span><b class="num" dir="ltr">${w}</b></div>`)}</div>
      ${t.chart&&h.length?r`<div class="chart">${jt({points:h,setpoints:s.source==="climate"?(s.points??[]).map(c=>[c[0],c[2]]):void 0,low:s.low,high:s.high,doors:s.doors??[],defrost:s.defrost??[],t0:t.from,t1:t.to,step:300},600,170,kt(o),null)}</div>`:l}
      ${t.events?r`<table><thead><tr><th>${i("colTime")}</th><th>${i("colEvent")}</th><th>${i("colValue")}</th></tr></thead><tbody>
        ${(s.events??[]).slice(0,6).map(c=>r`<tr><td dir="ltr">${new Date(c.started_at).toLocaleString(kt(o),{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</td>
          <td>${ut({...c,ack_by_name:c.by_name??null,detail:{reason:c.reason??void 0}})}</td><td dir="ltr">${b(c.peak??c.value)}</td></tr>`)}
      </tbody></table>`:l}
      ${s.daily?r`<table data-rep-daily><thead><tr><th>${i("dailyTitle")}</th><th>${i("statMin")}</th><th>${i("statMax")}</th><th>${i("statOut")}</th><th>${i("coverage")}</th><th></th></tr></thead><tbody>
        ${s.daily.slice(0,8).map(c=>r`<tr data-verdict=${c.verdict}><td dir="ltr">${c.day.slice(8,10)}.${c.day.slice(5,7)}</td><td dir="ltr">${b(c.min)}</td><td dir="ltr">${b(c.max)}</td>
          <td>${c.out_min?I(c.out_min):"0"}</td><td dir="ltr">${Math.round(c.coverage)}%</td><td>${i(c.verdict==="ok"?"dayOk":c.verdict==="exc"?"dayExc":"dayNone")}</td></tr>`)}
        ${s.daily.length>8?r`<tr><td colspan="6" class="hint" dir="ltr">+${s.daily.length-8}</td></tr>`:l}
      </tbody></table>`:l}
      ${this.samplesBlock(t,s,i,o)}`}
      ${t.signature?r`<div class="sig" style=${t.layout==="haccp"?"grid-template-columns:1fr 1fr 1fr":""}>${t.layout==="haccp"?r`<div>${i("repSignName")}</div>`:l}<div>${i("repSign")}</div><div>${i("repDate")}</div></div>`:l}
      <div class="foot" dir="ltr">SmplWise Arx · ${t.zone} · sha256 ${t.digest.slice(0,16)}${t.units.length>1?` · +${t.units.length-1}`:""}</div>
    </div>`}render(){const t=this.p;return r`<sw-dialog open xl heading=${e("repTitle")} subheading=${e("repSub")} @close=${s=>{s.stopPropagation(),this.close()}}>
        <div class="wb">
          <div class="col">
            <div class="field"><span class="lbl">${e("repRange")}</span><div class="presets" role="group">${Ft.map(s=>r`<button type="button" aria-pressed=${String(t.range===s)} data-rep-range=${s}
              @click=${()=>this.set({range:s})}>${e(`rp${s}`)}</button>`)}</div>
              ${t.range==="custom"?r`<div class="f2"><label class="field"><span class="lbl">${e("repFrom")}</span><input class="in" type="datetime-local" lang=${J()} .value=${t.from??""}
                  @change=${s=>this.set({from:s.target.value})} data-rep-from /></label>
                <label class="field"><span class="lbl">${e("repTo")}</span><input class="in" type="datetime-local" lang=${J()} .value=${t.to??""}
                  @change=${s=>this.set({to:s.target.value})} data-rep-to /></label></div>`:l}</div>
            <div class="field"><span class="lbl">${e("repUnits")} <span class="hint">· ${e("repUnitsHint")}</span></span><div class="ulist">
              ${this.units.map(s=>r`<label class="sw"><input type="checkbox" .checked=${t.units.includes(s.id)} data-rep-unit=${s.id}
                @change=${a=>this.set({units:a.target.checked?[...t.units,s.id]:t.units.filter(o=>o!==s.id)})} />${s.name}${s.area_name?r` <span class="hint">· ${s.area_name}</span>`:l}</label>`)}</div></div>
            <div class="f2">
              <div class="field"><span class="lbl">${e("repLang")}</span><sw-segmented value=${t.lang} @change=${s=>this.set({lang:s.detail.value})}
                .options=${[{value:"he",label:"עברית",attrs:{"data-rep-lang":"he"}},{value:"en",label:"English",attrs:{"data-rep-lang":"en"}}]}></sw-segmented></div>
              <div class="field"><span class="lbl">${e("repContent")}</span>
                <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("repChart")} .checked=${t.chart!==!1} @change=${s=>this.set({chart:E(s)})}></sw-toggle>${e("repChart")}</label>
                <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("repSig")} .checked=${t.signature!==!1} @change=${s=>this.set({signature:E(s)})} data-rep-sig></sw-toggle>${e("repSig")}</label>
                <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("repEvents")} .checked=${t.events!==!1} @change=${s=>this.set({events:E(s)})}></sw-toggle>${e("repEvents")}</label>
                <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("repSamples")} .checked=${t.samples===!0} @change=${s=>this.set({samples:E(s)})} data-rep-samples></sw-toggle>${e("repSamples")}</label></div>
            </div>
            <div class="field" data-rep-layout><span class="lbl">${e("repLayout")}</span><sw-segmented value=${t.layout==="haccp"?"haccp":"standard"} @change=${s=>this.setLayout(s.detail.value)}
              .options=${[{value:"standard",label:e("repStandard"),attrs:{"data-rep-layout-btn":"standard"}},{value:"haccp",label:e("repHaccp"),attrs:{"data-rep-layout-btn":"haccp"}}]}></sw-segmented>
              ${t.layout==="haccp"?r`<span class="hint">${e("repHaccpHint")}</span>`:l}</div>
            <span class="hint">${e("repEngine")}</span>
          </div>
          ${this.paper()}
        </div>
        ${this.link?r`<div class="wl" data-rep-link-row>
          <input class="in" dir="ltr" readonly .value=${this.link.url} aria-label=${e("repLink")} data-rep-link-url @focus=${s=>s.target.select()} />
          <button type="button" class="btn sm" data-rep-link-copy @click=${()=>this.copyLink()}><sw-icon name="copy" size="14"></sw-icon>${this.copied?e("repLinkCopied"):e("repLinkCopy")}</button>
          <span class="hint">${e("repLinkUntil",{t:_t(new Date(this.link.expires_at))})}</span>
          ${this.waOn?r`<button type="button" class="btn sm" ?disabled=${this.busy} data-rep-link-wa @click=${()=>this.sendLink()}><sw-icon name="share" size="14"></sw-icon>${e("repLinkWa")}</button>`:l}
          <button type="button" class="btn sm ghost" data-rep-link-revoke @click=${()=>this.revokeLink()}>${e("repLinkRevoke")}</button></div>
          ${this.waSent?r`<div class="wl" data-rep-link-wa-result>${this.waSent.results.map(s=>r`<span class="hint" data-wa-status=${s.status}>${s.name}: ${this.waText(s.status,s.reason)}</span>`)}</div>`:l}`:l}
        <div slot="footer" class="wf">
          ${this.canSend?r`<button type="button" class="btn" ?disabled=${!t.units.length} data-rep-wa @click=${()=>this.dispatchEvent(new CustomEvent("whatsapp",{detail:this.params()}))}><sw-icon name="share" size="16"></sw-icon>${e("repWa")}</button>`:l}
          ${this.canLink&&this.linkOn?r`<button type="button" class="btn" ?disabled=${this.busy||!t.units.length} data-rep-link @click=${()=>this.makeLink()}><sw-icon name="link" size="16"></sw-icon>${e("repLink")}</button>`:l}
          <span class="sp"></span>${this.err?r`<span class="err" role="alert">${this.err}</span>`:l}
          <button type="button" class="btn ghost" @click=${()=>this.close()}>${e("cancel")}</button>
          <button type="button" class="btn pri" ?disabled=${this.busy||!t.units.length} data-rep-export @click=${()=>this.exportPdf()}><sw-icon name="download" size="16"></sw-icon>${e("repExport")}</button>
        </div>
      </sw-dialog>`}};M.styles=[V,G`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the system's one dialog (sw-dialog: the scrim, the opaque centred box, the title
       and the close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's bottom sheet). */
    :host { display: contents; }
    .wb { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 18px; align-items: start; }
    .col { display: grid; gap: 14px; }
    .field { display: grid; gap: 6px; }
    .field > .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .presets button { border: 1px solid var(--sw-border); background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 5px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .presets button[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .f2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .in { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .ulist { display: grid; gap: 4px; max-block-size: 220px; overflow: auto; }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .paper { background: var(--sw-surface-solid); border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); padding: 18px 20px; box-shadow: var(--sw-shadow-2); display: grid; gap: 10px; min-inline-size: 0; }
    .ph { display: flex; justify-content: space-between; gap: 10px; border-block-end: 2px solid var(--sw-text); padding-block-end: 6px; }
    .ph h3 { margin: 0; font-size: var(--sw-fs-lg); }
    .ph small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-2xs); }
    .st { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 6px; }
    .st div { border: 1px solid var(--sw-border); border-radius: var(--sw-r-xs); padding: 6px; }
    .st span { display: block; font-size: var(--sw-fs-2xs); color: var(--sw-text-2); }
    .st b { font-size: var(--sw-fs-md); }
    .chart { block-size: 170px; }
    .chart svg { inline-size: 100%; block-size: 100%; }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-xs); }
    td, th { border-block-end: 1px solid var(--sw-border); padding: 4px; text-align: start; }
    tr[data-verdict='exc'] td { color: var(--sw-danger-text); }
    tr[data-verdict='none'] td { color: var(--sw-text-3); }
    th { color: var(--sw-text-2); }
    .sig { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-block-start: 12px; }
    .sig div { border-block-start: 1px solid var(--sw-text); padding-block-start: 4px; font-size: var(--sw-fs-xs); }
    .foot { font-size: var(--sw-fs-2xs); color: var(--sw-text-3); }
    .nodata { border: 1px dashed var(--sw-border-strong, var(--sw-border)); border-radius: var(--sw-r-md); padding: 14px 12px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); text-align: center; display: grid; gap: 4px; }
    .nodata b { color: var(--sw-text); }
    .capnote { font-size: var(--sw-fs-xs); color: var(--sw-warn-text, var(--sw-text-2)); margin: 0; }
    table.smp td { font-variant-numeric: tabular-nums; }
    table.smp tr[data-out] td { color: var(--sw-danger-text); }
    .wl { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-block-start: 10px; border-block-start: 1px solid var(--sw-menu-border); }
    .wl .in { flex: 1; min-inline-size: 200px; }
    .wf { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1; min-inline-size: 0; }
    .wf .sp { flex: 1; }
    ${Z}
    @media (max-width: 860px) {
      .wb { grid-template-columns: minmax(0, 1fr); }
      .st { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    @media (max-width: 600px) {
      .presets button,
      .sw { min-block-size: 44px; }
      /* RELEASE-2450-TRAIN: the language / layout keys are sw-segmented (CR-CMP2-SEGMENTED-C-2450); on a phone they keep the 44 px
         key the hand-built .seg buttons had (evidence-temperature TEMPREP-295, mobile) */
      sw-segmented { --sw-seg-h: 44px; }
      .sw input { inline-size: 22px; block-size: 22px; }
    }
  `];P([k({attribute:!1})],M.prototype,"units",2);P([k({attribute:!1})],M.prototype,"preselect",2);P([k({type:Boolean})],M.prototype,"canSend",2);P([k({type:Boolean})],M.prototype,"canLink",2);P([u()],M.prototype,"linkOn",2);P([u()],M.prototype,"waOn",2);P([u()],M.prototype,"waSent",2);P([u()],M.prototype,"link",2);P([u()],M.prototype,"copied",2);P([u()],M.prototype,"p",2);P([u()],M.prototype,"model",2);P([u()],M.prototype,"err",2);P([u()],M.prototype,"busy",2);M=P([K("temp-report")],M);var Rs=Object.defineProperty,Ls=Object.getOwnPropertyDescriptor,S=(t,s,a,o)=>{for(var i=o>1?void 0:o?Ls(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&Rs(s,a,i),i};let y=class extends Y{constructor(){super(...arguments),this.units=[],this.params=null,this.rec=null,this.chosen=[],this.channels={},this.q="",this.range="24h",this.text="",this.scheduled=!1,this.freq="weekly",this.dow=0,this.dom=1,this.at="08:30",this.sends=[],this.schedules=[],this.err="",this.ok="",this.busy=!1}connectedCallback(){super.connectedCallback(),this.params?.range&&(this.range=this.params.range==="custom"?"7d":this.params.range),De().then(t=>this.rec=t).catch(t=>this.err=z(t)),zt().then(t=>this.schedules=t.schedules).catch(()=>{}),this.preview()}disconnectedCallback(){window.clearInterval(this.poll),super.disconnectedCallback()}get unitIds(){return this.params?.units?.length?this.params.units:this.units.map(t=>t.id)}get vendorOnly(){const t=Te(this.rec,this.chosen);return t>0&&t===this.chosen.length}get repLang(){return this.params?.lang??"he"}async preview(){try{this.text=(await Pt({units:this.unitIds,range:this.range,lang:this.repLang,chart:!1,events:!1,signature:!1,external:this.vendorOnly})).text_summary}catch{this.text=""}}close(){this.dispatchEvent(new CustomEvent("close"))}toggle(t,s){const a=this.vendorOnly;this.chosen=s?[...new Set([...this.chosen,t])]:this.chosen.filter(o=>o!==t),a!==this.vendorOnly&&this.preview()}pick(t,s){this.channels={...this.channels,[t]:s}}reasonText(t){if(!t)return"";const s=`waReason_${t}`;return Ie.includes(s)?e(s):t}async send(){this.busy=!0,this.err="",this.ok="";try{const t=await Pe({units:this.unitIds,range:this.range,lang:this.repLang,recipients:St(this.rec,this.chosen,this.channels)});this.sends=t.sends,this.ok=e("waQueued",{n:t.queued}),window.clearInterval(this.poll);let s=12;this.poll=window.setInterval(()=>{--s<=0&&window.clearInterval(this.poll),(async()=>{this.sends=(await Fe(t.batch_id)).sends,this.sends.every(a=>a.status!=="queued"&&a.status!=="retry"&&a.status!=="handed")&&window.clearInterval(this.poll)})().catch(()=>{window.clearInterval(this.poll)})},1e4)}catch(t){this.err=z(t)}finally{this.busy=!1}}async saveSchedule(){this.busy=!0,this.err="",this.ok="";try{await qe({units:this.unitIds,range:this.range,lang:this.repLang,freq:this.freq,at:this.at,dow:this.freq==="weekly"?this.dow:null,dom:this.freq==="monthly"?this.dom:null,recipients:St(this.rec,this.chosen,this.channels)}),this.schedules=(await zt()).schedules,this.ok=e("waScheduled")}catch(t){this.err=z(t)}finally{this.busy=!1}}person(t,s){const a=this.chosen.includes(t.id),o=!s&&t.reach&&t.reach!=="ok"?e(t.reach==="no_address"?"waNoPhone":"waNoConsent"):"",i=this.q.trim().toLowerCase();if(i&&!t.name.toLowerCase().includes(i)&&!(t.company??"").toLowerCase().includes(i))return l;const n=s&&!!t.channels,p=n?Ae(t,this.channels[t.id],!!this.rec?.vendor_reports?.email):null,h=n&&p?st(t,p):"";return r`<label class="row" ?data-disabled=${!t.selectable} data-person=${t.id} data-kind=${s?"vendor":"user"}>
      <input type="checkbox" .checked=${a} ?disabled=${!t.selectable} @change=${c=>this.toggle(t.id,c.target.checked)} />
      <span class="tx">${t.name}${t.company?r`<small>${t.company}</small>`:l}</span>
      ${n?r`<span class="vw"><span class="seg" role="group" data-wa-channels=${t.id}>${Ne(!!this.rec?.vendor_reports?.email).map(c=>r`<button type="button" ?disabled=${!t.selectable||st(t,c)!=="ok"}
            title=${st(t,c)==="ok"?"":this.reasonText(st(t,c))} aria-pressed=${String(p===c)} data-wa-channel=${c}
            @click=${w=>{w.preventDefault(),this.pick(t.id,c)}}>${e(c==="whatsapp"?"waChannelWhatsapp":"waChannelEmail")}</button>`)}</span>
          ${h&&h!=="ok"?r`<span class="w" data-wa-reason>${this.reasonText(h)}</span>`:l}</span>`:s?r`<span class="chip" title=${e("waVendorsLater")}>${e("waComingLater")}</span>`:o?r`<span class="w">${o}</span>`:l}</label>`}render(){const t=this.rec,s=new Map([...t?.users??[],...t?.vendors??[]].map(i=>[i.id,i.name])),a=We(t?.users??[],this.chosen),o=new Map(this.units.map(i=>[i.id,i.name]));return r`<sw-dialog open wide heading=${e("waTitle")} subheading=${e(this.rec?.user_attachment==="link"?"waSubLink":"waSub")} @close=${i=>{i.stopPropagation(),this.close()}}>
        <div class="wb" data-temp-wa>
          <div class="field"><span class="lbl">${e("waRecipients")}</span>
            <div class="pills">${this.chosen.map(i=>r`<span class="pill">${s.get(i)??i}<button type="button" aria-label=${e("removeWindow")} @click=${()=>this.toggle(i,!1)}><sw-icon name="close" size="12"></sw-icon></button></span>`)}</div>
            <input class="in" type="search" .value=${this.q} placeholder=${e("waSearch")} aria-label=${e("waSearch")} @input=${i=>{this.q=i.target.value}} />
            <div class="plist" data-wa-list>
              ${t?r`<div class="grp">${e("waUsers")}</div>${t.users.map(i=>this.person(i,!1))}
                ${t.vendors.length?r`<div class="grp">${e("waVendors")}${t.vendor_reports?.enabled?"":r` · ${e("waVendorsLater")}`}</div>${t.vendors.map(i=>this.person(i,!0))}`:l}`:r`<p class="hint" style="padding:10px">…</p>`}
            </div>
            ${a?r`<div class="banner warn" data-wa-warn><sw-icon name="warning" size="16"></sw-icon><span>${e("waWarn",{n:a})}</span></div>`:l}
          </div>
          <div class="field"><span class="lbl">${e("repRange")}</span><div class="presets">${Ft.filter(i=>i!=="custom").map(i=>r`<button type="button" aria-pressed=${String(this.range===i)}
            data-wa-range=${i} @click=${()=>{this.range=i,this.preview()}}>${e(`rp${i}`)}</button>`)}</div></div>
          <div class="field"><span class="lbl">${e("waPreview")}</span><div class="bubble" dir=${this.repLang==="he"?"rtl":"ltr"} data-wa-text>${this.text||"…"}</div>
            <span class="hint">${e("waTextOnly")}</span></div>
          <div class="sched">
            <label class="sw"><sw-toggle size="sm" labelHidden in-label label=${e("waSchedule")} .checked=${this.scheduled} @change=${i=>{this.scheduled=E(i)}} data-wa-sched></sw-toggle>${e("waSchedule")}</label>
            ${this.scheduled?r`<div class="r"><sw-segmented value=${this.freq} @change=${i=>{this.freq=i.detail.value}}
                .options=${["daily","weekly","monthly"].map(i=>({value:i,label:e(i==="daily"?"waDaily":i==="weekly"?"waWeekly":"waMonthly")}))}></sw-segmented>
              ${this.freq==="weekly"?r`<select class="in" aria-label=${e("waWeekly")} @change=${i=>{this.dow=Number(i.target.value)}}>
                ${[0,1,2,3,4,5,6].map(i=>r`<option value=${i} ?selected=${this.dow===i}>${e(`dow${i}`)}</option>`)}</select>`:l}
              ${this.freq==="monthly"?r`<label class="sw">${e("waDom")}<input class="in" type="number" min="1" max="28" style="inline-size:70px" .value=${String(this.dom)}
                @change=${i=>{this.dom=Math.max(1,Math.min(28,Number(i.target.value)||1))}} /></label>`:l}
              <span>${e("waAt")}</span><input class="in" type="time" lang=${J()} .value=${this.at} @change=${i=>{this.at=i.target.value}} aria-label=${e("waAt")} /></div>`:l}
            ${this.schedules.length?r`<div class="status"><span class="lbl">${e("waSchedules")}</span>${this.schedules.map(i=>r`<div class="r" data-wa-schedule=${i.id}>
              <span>${e(i.freq==="daily"?"waDaily":i.freq==="weekly"?"waWeekly":"waMonthly")}${i.freq==="weekly"&&i.dow!==null?` · ${e(`dow${i.dow}`)}`:""} · ${i.at} ·
                ${i.units.map(n=>o.get(n)??"").filter(Boolean).join(", ")} · ${i.recipients.map(n=>s.get(n.id)??"").filter(Boolean).join(", ")}</span>
              <button type="button" class="btn sm ghost" @click=${async()=>{await je(i.id),this.schedules=this.schedules.filter(n=>n.id!==i.id)}}>${e("waDelete")}</button></div>`)}</div>`:l}
          </div>
          ${t?r`<div class="banner"><sw-icon name="clock" size="16"></sw-icon><span>${e("waHours",{h:He(`${t.send_hours.from}–${t.send_hours.to}`)})}</span></div>`:l}
          ${this.sends.length?r`<div class="status" data-wa-status>${this.sends.map(i=>r`<div>${i.name}${i.channel?r` · ${e(i.channel==="email"?"waChannelEmail":"waChannelWhatsapp")}`:l} · <b>${e(`waStatus_${i.status}`)}</b>${i.reason?r` <span class="hint">(${this.reasonText(i.reason)})</span>`:l}</div>`)}</div>`:l}
        </div>
        <div slot="footer" class="wf">
          <span class="sp"></span>${this.err?r`<span class="err" role="alert">${this.err}</span>`:l}${this.ok?r`<span class="okm" role="status">${this.ok}</span>`:l}
          ${this.scheduled?r`<button type="button" class="btn" ?disabled=${this.busy||!this.chosen.length} data-wa-save @click=${()=>this.saveSchedule()}><sw-icon name="calendar" size="16"></sw-icon>${e("waSave")}</button>`:l}
          <button type="button" class="btn ghost" @click=${()=>this.close()}>${e("cancel")}</button>
          <button type="button" class="btn pri" ?disabled=${this.busy||!this.chosen.length} data-wa-send @click=${()=>this.send()}><sw-icon name="check" size="16"></sw-icon>${e("waSend")}</button>
        </div>
      </sw-dialog>`}};y.styles=[V,G`
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A): the system's one dialog (sw-dialog: the scrim, the opaque centred box, the title
       and the close button on top, the actions on the bottom, focus trap, Escape, focus return, the phone's bottom sheet). */
    :host { display: contents; }
    .wb { display: grid; gap: 14px; align-content: start; }
    .field { display: grid; gap: 6px; }
    .lbl { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .in { min-block-size: var(--sw-ctl-h-sm); border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text); padding: 0 10px; font: inherit; }
    .pills { display: flex; flex-wrap: wrap; gap: 6px; }
    .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: var(--sw-r-pill); background: var(--sw-surface-2); padding: 3px 6px 3px 10px; font-size: var(--sw-fs-sm); }
    .pill button { border: 0; background: transparent; cursor: pointer; color: var(--sw-text-2); padding: 0; display: inline-grid; }
    .plist { border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); max-block-size: 240px; overflow: auto; background: var(--sw-surface); }
    .grp { padding: 6px 12px; font-size: var(--sw-fs-xs); color: var(--sw-text-2); background: var(--sw-surface-2); position: sticky; inset-block-start: 0; }
    .row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-block-end: 1px solid var(--sw-border); font-size: var(--sw-fs-sm); }
    .row[data-disabled] { opacity: 0.55; }
    .row .tx { flex: 1; min-inline-size: 0; }
    .row small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-xs); }
    .row .w { color: var(--sw-warning-text); font-size: var(--sw-fs-xs); }
    .row .seg { flex: none; }
    .row .seg button:disabled { opacity: 0.45; cursor: not-allowed; }
    .row .vw { display: grid; gap: 4px; justify-items: end; }
    .row input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .presets { display: flex; flex-wrap: wrap; gap: 6px; }
    .presets button { border: 1px solid var(--sw-border); background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 5px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text); cursor: pointer; }
    .presets button[aria-pressed='true'] { border-color: var(--sw-accent); background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .bubble { justify-self: end; max-inline-size: 460px; white-space: pre-wrap; background: color-mix(in srgb, var(--sw-success) 14%, var(--sw-surface)); border-radius: var(--sw-r-md); padding: 10px 12px; font-size: var(--sw-fs-sm); line-height: 1.5; box-shadow: var(--sw-shadow-1); }
    .banner { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .banner.warn { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
    .sched { display: grid; gap: 8px; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); }
    .sched .r { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .seg { display: inline-flex; background: var(--sw-surface); border-radius: var(--sw-r-pill); padding: 3px; gap: 2px; }
    .seg button { border: 0; background: transparent; border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit; font-size: var(--sw-fs-sm); color: var(--sw-text-2); cursor: pointer; }
    .seg button[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    .sw { display: inline-flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); cursor: pointer; }
    .sw input { inline-size: 18px; block-size: 18px; accent-color: var(--sw-accent); }
    .status { display: grid; gap: 4px; font-size: var(--sw-fs-sm); }
    .wf { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; flex: 1; min-inline-size: 0; }
    .wf .sp { flex: 1; }
    ${Z}
    .okm { color: var(--sw-success-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 600px) {
    }
  `];S([k({attribute:!1})],y.prototype,"units",2);S([k({attribute:!1})],y.prototype,"params",2);S([u()],y.prototype,"rec",2);S([u()],y.prototype,"chosen",2);S([u()],y.prototype,"channels",2);S([u()],y.prototype,"q",2);S([u()],y.prototype,"range",2);S([u()],y.prototype,"text",2);S([u()],y.prototype,"scheduled",2);S([u()],y.prototype,"freq",2);S([u()],y.prototype,"dow",2);S([u()],y.prototype,"dom",2);S([u()],y.prototype,"at",2);S([u()],y.prototype,"sends",2);S([u()],y.prototype,"schedules",2);S([u()],y.prototype,"err",2);S([u()],y.prototype,"ok",2);S([u()],y.prototype,"busy",2);y=S([K("temp-wa")],y);var Ms=Object.defineProperty,Ds=Object.getOwnPropertyDescriptor,T=(t,s,a,o)=>{for(var i=o>1?void 0:o?Ds(s,a):s,n=t.length-1,p;n>=0;n--)(p=t[n])&&(i=(o?p(s,a,i):p(i))||i);return o&&i&&Ms(s,a,i),i};const Ts=3e4,Is=480,Bt="sw.temperature.collapsed";function Ps(){try{const t=JSON.parse(localStorage.getItem(Bt)??"[]");return Array.isArray(t)?t.filter(s=>typeof s=="string").slice(0,200):[]}catch{return[]}}let R=class extends Y{constructor(){super(...arguments),this.bubbleSkin=new Be(this),this.route=null,this.access=Ue(),this.data=null,this.error="",this.editing=!1,this.kpi=null,this.openId=null,this.wizard=null,this.toaster=new os(this,{ms:2600}),this.report=null,this.wa=null,this.floor=null,this.collapsed=Ps(),this.pressed=!1,this.opener=null,this.page=1,this.per=0,this.desk=window.matchMedia("(min-width: 1101px)"),this.onDesk=()=>this.refit(),this.lists=new rs(this,()=>{this.page=1,this.refit()})}get toast(){return this.toaster.text}connectedCallback(){if(super.connectedCallback(),this.desk.addEventListener("change",this.onDesk),typeof ResizeObserver<"u"){let t=0,s=0;this.fitObserver=new ResizeObserver(([a])=>{const o=a.contentRect;Math.abs(o.width-t)<2&&Math.abs(o.height-s)<2||(t=o.width,s=o.height,this.refit())}),this.fitObserver.observe(this)}this.stop=Ge(t=>{this.access=t,t.manage||(this.editing=!1)}),this.offScreenEdit=Ye({id:"temperature-edit",label:e("editPage"),icon:"edit",can:()=>this.access.manage&&!this.editing&&!this.isLog(),run:()=>{this.editing=!0}}),this.load(),this.timer=window.setInterval(()=>{document.visibilityState==="visible"&&!this.isLog()&&this.load()},Ts)}disconnectedCallback(){this.desk.removeEventListener("change",this.onDesk),this.fitObserver?.disconnect(),this.contentObserver?.disconnect(),window.clearInterval(this.timer),this.stop?.(),this.offScreenEdit?.(),super.disconnectedCallback()}isLog(){return this.route?.segments[2]==="log"}refit(){this.per=0}updated(){if(!(!this.desk.matches||this.isLog()||!this.data?.units.length)&&(this.fitCheck(),requestAnimationFrame(()=>this.fitCheck()),typeof ResizeObserver<"u")){this.contentObserver??=new ResizeObserver(()=>this.fitCheck()),this.contentObserver.disconnect();for(const t of this.renderRoot.querySelectorAll("[data-temp-grid], [data-temp-groups]"))this.contentObserver.observe(t)}}fitCheck(){if(!this.desk.matches||!this.lists.paged||this.isLog()||!this.data?.units.length)return;const t=this.renderRoot.querySelector("[data-temp-grid]");if(!t)return;const s=Math.max(1,getComputedStyle(t).gridTemplateColumns.split(" ").filter(Boolean).length),a=this.renderRoot.querySelectorAll("[data-temp-unit]").length,o=[...this.renderRoot.querySelectorAll(".ucard")].flatMap(i=>i.getAnimations()).filter(i=>i.playState==="running");if(o.length){Promise.all(o.map(i=>i.finished.catch(()=>{}))).then(()=>this.fitCheck());return}if(this.scrollHeight-this.clientHeight>1&&a>s){const i=Math.max(s,(Math.ceil(a/s)-1)*s);i!==this.per&&(this.per=i)}}async load(){if(this.access.view)try{const t=this.data?.units.map(a=>a.id).join()??"";this.data=await Ke(!0),this.data.units.map(a=>a.id).join()!==t&&this.refit(),this.error="",Ve(this.data.units.length>0||this.access.manage);const s=this.route?.params.get("unit");s&&!this.openId&&this.data.units.some(a=>a.id===s)&&(this.openId=s)}catch(t){this.error=z(t)}}flash(t){this.toaster.show(t)}open(t,s){this.opener=s,this.openId=t,navigator.vibrate&&this.pressed&&navigator.vibrate(8)}closeDetail(){this.openId=null;const t=this.opener;this.opener=null,t?.isConnected&&this.updateComplete.then(()=>t.focus())}down(t,s){this.pressed=!1;const a=t.currentTarget,o=t.clientX,i=t.clientY;window.clearTimeout(this.pressTimer),this.pressTimer=window.setTimeout(()=>{this.pressed=!0,this.open(s,a)},Is);const n=p=>{(Math.abs(p.clientX-o)>8||Math.abs(p.clientY-i)>8)&&window.clearTimeout(this.pressTimer)};a.addEventListener("pointermove",n,{once:!1}),a.addEventListener("pointerup",()=>{window.clearTimeout(this.pressTimer),a.removeEventListener("pointermove",n)},{once:!0})}tap(t,s){if(this.pressed){this.pressed=!1;return}this.open(s,t.currentTarget)}key(t,s){(t.key==="Enter"||t.key===" ")&&(t.preventDefault(),this.open(s,t.currentTarget))}kpis(t,s){const a=Qe(t,s),o=(i,n,p,h)=>r`<button type="button" class="kpi" data-k=${i} data-look=${n} data-temp-kpi=${i} ?data-nz=${p>0}
      aria-pressed=${String(this.kpi===i)} @click=${()=>{this.kpi=this.kpi===i?null:i,this.page=1,this.refit()}}><span class="dot" aria-hidden="true"></span><div><b>${p}</b><span class="l">${e(h)}</span></div></button>`;return r`<div class="kpis" role="group" aria-label=${e("title")}>
      ${o("total","",a.total,"kpiTotal")}${o("ok","ok",a.ok,"kpiOk")}${o("warning","warn",a.warning,"kpiWarn")}${o("alarm","alarm",a.alarm,"kpiAlarm")}
      ${o("door","",a.door,"kpiDoor")}${o("offline","off",a.offline,"kpiOff")}${a.health?o("health","",a.health,"kpiHealth"):l}
    </div>`}toggleGroup(t){const s=t||"-";this.collapsed=this.collapsed.includes(s)?this.collapsed.filter(a=>a!==s):[...this.collapsed,s],this.refit();try{localStorage.setItem(Bt,JSON.stringify(this.collapsed))}catch{}}isGrouped(t){return this.data?.grouping!=="none"&&(at(t,this.floor).length>=2||!!this.floor)}ordered(t){return this.isGrouped(t)?at(t,this.floor).filter(s=>!this.collapsed.includes(s.key||"-")).flatMap(s=>s.units):this.floor?at(t,this.floor).flatMap(s=>s.units):t}pagesOf(t){const s=this.ordered(t).length;return this.desk.matches&&this.lists.paged&&this.per>0?Math.max(1,Math.ceil(s/this.per)):1}pageNo(t){return Math.min(this.page,this.pagesOf(t))}cards(t,s,a,o,i){const n=this.ordered(t),p=this.pagesOf(t),h=this.pageNo(t),c=p>1?n.slice((h-1)*this.per,h*this.per):n;h<p&&(i=l);const w=at(t,this.floor);if(!this.isGrouped(t))return r`<div class="grid" data-temp-grid>${c.map(v=>this.card(v,s,a,o))}${i}</div>`;const x=new Set(c.map(v=>v.id));return r`<div class="groups" data-temp-groups>${w.map(v=>{const g=!this.collapsed.includes(v.key||"-"),d=v.units.filter(m=>x.has(m.id));return(g?!d.length:this.pageNo(t)!==1)?l:r`<section class="group" data-temp-group=${v.key||"-"}>
        <button type="button" class="ghead" aria-expanded=${String(g)} data-look=${Xe(v,s)} data-temp-group-toggle=${v.key||"-"}
          aria-label=${e(g?"groupCollapse":"groupExpand",{name:v.name})} @click=${()=>this.toggleGroup(v.key)}>
          <span class="dot" aria-hidden="true"></span><h2>${v.name}</h2><small>${[v.floor,e("groupCount",{n:v.units.length})].filter(Boolean).join(" · ")}</small>
          <sw-icon class="chev" name="chevronDown" size="16"></sw-icon></button>
        ${g?r`<div class="grid" data-temp-grid>${d.map(m=>this.card(m,s,a,o))}</div>`:l}</section>`})}${i?r`<div class="grid">${i}</div>`:l}</div>`}pager(t){const s=this.pagesOf(t);return s>1?r`<sw-pager data-temp-pager .page=${this.pageNo(t)} .pages=${s} @page-change=${a=>{this.page=a.detail.page}}></sw-pager>`:l}floorBar(t){const s=Je(t);return s.length<2||this.data?.grouping==="none"?l:r`<div class="floors" role="group" aria-label=${e("floorFilter")} data-temp-floors>
      <button type="button" aria-pressed=${String(this.floor===null)} data-temp-floor="" @click=${()=>{this.floor=null,this.page=1,this.refit()}}>${e("allFloors")}</button>
      ${s.map(a=>r`<button type="button" aria-pressed=${String(this.floor===a.id)} data-temp-floor=${a.id} @click=${()=>{this.floor=this.floor===a.id?null:a.id,this.page=1,this.refit()}}>${a.name}</button>`)}</div>`}card(t,s,a,o){const i=s?"unknown":t.status,n=Tt[i],p=Dt(t,a,o),h=t.stats_24h.out_min;return r`<article class="ucard" tabindex="0" role="button" data-temp-unit=${t.id} data-status=${i} data-look=${n} ?data-stale=${s}
        aria-label=${`${t.name}: ${e(ct[i])}`} @pointerdown=${c=>this.down(c,t.id)} @click=${c=>this.tap(c,t.id)}
        @keydown=${c=>this.key(c,t.id)} @contextmenu=${c=>c.preventDefault()}>
      <div class="uhead"><h3>${t.name}${t.area_name?r`<small>${t.area_name}</small>`:l}</h3>
        <span class="badge" data-look=${n}><sw-icon name=${It[i]} size="14"></sw-icon>${e(ct[i])}</span></div>
      <div class="ubody">
        ${rt(t,n,s||t.status==="offline"||t.trend==="flat"&&t.status==="ok"?null:t.trend)}
        <div class="umeta">
          <div class="chips" data-temp-chips>${p.map(c=>r`<span class="chip" data-tone=${c.tone} data-chip=${c.id}><sw-icon name=${c.icon} size="12"></sw-icon>${c.text}</span>`)}</div>
          ${Nt(t,a)}
          <div class="axis" aria-hidden="true"><span>−24</span><span>−18</span><span>−12</span><span>−6</span><span>${e("now")}</span></div>
          <div class="row2"><span>${e("last24")} · ${h?e("outOfRange",{d:I(h)}):e("allInRange")}</span><span>${t.updated_at?e("updated",{ago:Ze(t.updated_at,a)}):""}</span></div>
        </div>
      </div>
      ${this.editing&&this.access.manage?r`<div class="hand"><button type="button" class="btn sm" data-temp-edit=${t.id} aria-label=${`${e("edit")} ${t.name}`} @pointerdown=${c=>c.stopPropagation()}
            @click=${c=>{c.stopPropagation(),this.wizard=t.id}}><sw-icon name="edit" size="14"></sw-icon></button></div>`:l}
    </article>`}reportOverlays(){const t=this.data?.units??[];return r`${this.report!==null?r`<temp-report .units=${t} .preselect=${this.report} .canSend=${this.access.manage} .canLink=${this.access.link} @close=${()=>{this.report=null}}
          @done=${s=>this.flash(s.detail)} @whatsapp=${s=>{this.report=null,this.wa=s.detail}}></temp-report>`:l}
      ${this.wa!==null?r`<temp-wa .units=${t} .params=${this.wa} @close=${()=>{this.wa=null}}></temp-wa>`:l}`}render(){if(!this.access.view)return r`<sw-state-panel state="forbidden" data-state="forbidden"></sw-state-panel>`;if(this.isLog())return r`<temp-log .units=${this.data?.units??[]} .unitFilter=${this.route?.params.get("unit")??""} .canSend=${this.access.manage}
        @back=${()=>{window.location.hash=pt}} @report=${d=>{this.report=d.detail}}
        @whatsapp=${d=>{this.wa={units:d.detail,range:"24h",lang:"he"}}}></temp-log>${this.reportOverlays()}`;if(!this.data)return this.error?r`<sw-page heading=${e("title")} data-infra-page="temperature"><sw-state-panel state="error" heading=${e("loadError")} hint=${this.error} actionLabel=${e("retry")} @action=${()=>void this.load()} data-state="error"></sw-state-panel></sw-page>`:r`<sw-page heading=${e("title")} data-infra-page="temperature"><div class="skl" data-state="loading" role="status" aria-busy="true" aria-label=${e("loading")}>
            <div class="kpis" aria-hidden="true">${[0,1,2,3,4,5].map(()=>r`<div class="sk sk-kpi"></div>`)}</div>
            <div class="grid" aria-hidden="true">${[0,1,2].map(()=>r`<div class="sk sk-card"></div>`)}</div>
          </div></sw-page>`;const t=this.data.units,s=ts(this.access.manage,this.editing),a=this.data.stale,o=Date.now(),i=nt(),n=t.filter(d=>d.door).length,p=a?e("subtitleStale"):e("subtitle",{n:t.length,d:n}),h=r`<div class="meta" slot="actions">
        ${s.doneButton?r`<span class="editbanner"><sw-icon name="edit" size="14"></sw-icon>${e("editBanner")}</span>`:l}
        ${this.pager(t.filter(d=>Ot(d,this.kpi,a)))}
        ${t.length?r`<a class="btn" href=${`${pt}/log`} data-temp-log><sw-icon name="list" size="16"></sw-icon>${e("alertLog")}</a>`:l}
        ${s.newButton?r`<sw-button variant="primary" icon="plus" data-temp-new @click=${()=>{this.wizard=""}}>${e("newUnit")}</sw-button>`:l}
        ${s.doneButton?r`<sw-button icon="check" data-temp-edit-done @click=${()=>{this.editing=!1}}>${e("editDone")}</sw-button>`:l}
      </div>`,c=d=>r`<sw-page heading=${e("title")} subheading=${p} data-infra-page="temperature">${h}${d}</sw-page>`,w=r`${this.wizard!==null?r`<temp-wizard .unitId=${this.wizard||null} @close=${()=>{this.wizard=null}}
            @saved=${d=>{this.wizard=null,this.flash(d.detail),this.load()}}
            @removed=${d=>{this.wizard=null,this.openId=null,this.flash(d.detail),this.load()}}></temp-wizard>`:l}
      ${this.reportOverlays()}`,x=r`
      ${this.openId&&t.some(d=>d.id===this.openId)?r`<temp-detail .unit=${t.find(d=>d.id===this.openId)} .units=${t} .canAck=${this.data.can_ack} .canManage=${this.access.manage} .explain=${this.data.explain!==!1} .stale=${a}
            @close=${()=>this.closeDetail()} @open-unit=${d=>{this.openId=d.detail}}
            @edit=${()=>{this.wizard=this.openId}} @report=${d=>{this.report=[d.detail]}} @changed=${d=>{this.flash(d.detail),this.load()}}>${w}</temp-detail>`:w}
      ${this.toast?r`<div class="toast" role="status" aria-live="polite">${this.toast}</div>`:l}`;if(!t.length)return c(r`
        <div class="empty" data-state="empty"><div class="art"><sw-icon name="thermometer" size="34"></sw-icon></div><h2>${e("emptyTitle")}</h2><p>${e("emptyBody")}</p>
          ${s.addCard?r`<button type="button" class="btn pri" data-temp-add-first @click=${()=>{this.wizard=""}}><sw-icon name="plus" size="16"></sw-icon>${e("addFirst")}</button>`:this.access.manage?r`<span class="hint">${e("emptyHint")}</span>`:l}</div>
        ${x}`);const v=t.filter(d=>Ot(d,this.kpi,a)),g=s.addCard?r`<button type="button" class="add" data-temp-add @click=${()=>{this.wizard=""}}><div><b>+</b>${e("addCard")}<br /><small>${e("addCardSub")}</small></div></button>`:l;return c(r`
      ${a?r`<div class="banner" role="status" data-temp-stale><sw-icon name="offline" size="18"></sw-icon><span>${e("staleBanner")}</span></div>`:l}
      ${this.kpis(t,a)}
      ${this.floorBar(t)}
      ${this.cards(v,a,o,i,g)}
      ${x}`)}};R.styles=[V,G`
    :host {
      display: flex; flex-direction: column; inline-size: 100%; box-sizing: border-box;
    }
    sw-page { flex: 1 1 auto; min-block-size: 0; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
    .editbanner { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-accent-text); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
    .banner {
      display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--sw-r-md); background: var(--sw-offline-soft);
      color: var(--sw-offline-text); font-size: var(--sw-fs-sm);
    }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    /* POLISH-CONTROL-297 round 2: the number is the hero of the tile (display size, heavy, tight, tabular), the tile on the card elevation */
    /* R5-MEDIA-ENERGY-297 (HOMEFABLE tiers): the counter is a tone step DOWN from the unit cards (surface-2, a hairline, no shadow) so the
       cards read as the page's objects; its label gets two lines before an ellipsis; a chosen counter is a filled status field */
    /* loop 2 (visible-difference test): surface-2 is 3 % from white and read as "another white card"; the counter is now a surface-3 well with
       no outline and no shadow, its mark a 20 px disc with a ring; a counter that is not zero on an alerting status is a filled status field
       (impeccable detect flagged the first try - a 6 px side border - as the "side-tab accent border" tell; replaced by the field) */
    .kpi {
      display: flex; align-items: center; gap: 14px; padding: 12px 16px; border-radius: var(--sw-r-lg); background: var(--sw-surface-3);
      border: 1px solid transparent; box-shadow: none; font: inherit; color: inherit; text-align: start; cursor: pointer; min-inline-size: 0;
      touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; -webkit-user-select: none;
    }
    .kpi > div { min-inline-size: 0; }
    /* POLISH136: the KPI is a filter button - it answers hover (fine pointers only), press and keyboard like the cards */
    .kpi { transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out); }
    .kpi:active { transform: scale(var(--sw-press-scale)); background: var(--sw-surface-3); }
    .kpi[aria-pressed='true'] { border-color: var(--c); background: color-mix(in srgb, var(--c) 20%, var(--sw-surface)); box-shadow: inset 0 0 0 1px var(--c); }
    .kpi[aria-pressed='true'] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi .dot { inline-size: 20px; block-size: 20px; border-radius: 50%; background: var(--c); flex: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 22%, transparent), inset 0 1px 0 rgba(255, 255, 255, 0.35); }
    .kpi b { display: block; font-size: var(--sw-fs-4xl); font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; color: var(--sw-heading, var(--sw-text)); }
    .kpi span.l { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; margin-block-start: 4px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); overflow: hidden; line-height: 1.25; }
    .kpi[data-k='total'] { --c: var(--sw-accent); }
    .kpi[data-nz][data-look='alarm'], .kpi[data-nz][data-look='warn'], .kpi[data-nz][data-look='off'], .kpi[data-nz][data-k='door'] { background: color-mix(in srgb, var(--c) 18%, var(--sw-surface)); }
    .kpi[data-nz][data-look='alarm'] b, .kpi[data-nz][data-look='warn'] b { color: var(--c-text, var(--sw-heading)); }
    .kpi[data-nz] span.l { color: var(--sw-heading); font-weight: var(--sw-fw-semibold); }
    .kpi[data-k='door'] { --c: var(--tc-door); }
    .kpi:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(380px, 100%), 1fr)); gap: 16px; }
    .ucard {
      -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
      position: relative; display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: var(--sw-r-lg); overflow: hidden;
      /* R5-MEDIA-ENERGY-297: the unit card is the hero tier - the ladder's second step and a lit top edge */
      background: var(--sw-surface); border: 1px solid var(--sw-border); box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight); min-inline-size: 0; cursor: pointer;
      /* POLISH136: a tappable card confirms the press (transform only, token durations - zero under reduced motion) */
      transition: border-color var(--sw-t-fast) var(--sw-ease), box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-press) var(--sw-ease-out);
    }
    .ucard:active { transform: scale(var(--sw-press-scale)); box-shadow: var(--sw-shadow-1); }
    /* R5-MEDIA-ENERGY-297 (status as a filled field): an alerting card is a solid tinted field of its colour with a strong frame - readable from
       across the room, in light and in dark - never a 7 % wash */
    .ucard[data-look='alarm'] { border-color: color-mix(in srgb, var(--tc-alarm) 75%, transparent); background: color-mix(in srgb, var(--tc-alarm) 16%, var(--sw-surface)); }
    .ucard[data-look='warn'] { border-color: color-mix(in srgb, var(--tc-warn) 75%, transparent); background: color-mix(in srgb, var(--tc-warn) 14%, var(--sw-surface)); }
    .ucard[data-look='alarm'] .chip, .ucard[data-look='warn'] .chip { background: color-mix(in srgb, var(--sw-surface) 55%, transparent); }
    .ucard[data-look='off'] { border-style: dashed; }
    .ucard:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    /* round 2 (find-animation-opportunities, occasional screen entry): the cards arrive as a 40 ms cascade - transform and opacity only;
       under reduced motion only the fade remains */
    @media (prefers-reduced-motion: no-preference) {
      .ucard { animation: tp-in 360ms var(--sw-ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
    }
    @media (prefers-reduced-motion: reduce) {
      .ucard { animation: tp-fade 200ms var(--sw-ease) both; }
    }
    .grid > .ucard:nth-child(2) { --i: 1; } .grid > .ucard:nth-child(3) { --i: 2; } .grid > .ucard:nth-child(4) { --i: 3; }
    .grid > .ucard:nth-child(5) { --i: 4; } .grid > .ucard:nth-child(6) { --i: 5; } .grid > .ucard:nth-child(n + 7) { --i: 6; }
    @keyframes tp-in { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
    @keyframes tp-fade { from { opacity: 0; } }
    .uhead { display: flex; align-items: flex-start; gap: 10px; min-inline-size: 0; }
    /* R5-MEDIA-ENERGY-297: the unit name is the card's title - 20 px / 800 in the heading ink */
    .uhead h3 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; color: var(--sw-heading); flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .uhead h3 small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-state); font-weight: var(--sw-fw-regular); overflow: hidden; text-overflow: ellipsis; }
    .ubody { display: flex; gap: 14px; align-items: center; min-inline-size: 0; }
    .umeta { flex: 1; display: grid; gap: 6px; min-inline-size: 0; }
    .row2 { display: flex; justify-content: space-between; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-xs); flex-wrap: wrap; }
    .hand { position: absolute; inset-block-start: 10px; inset-inline-end: 10px; }
    .add {
      display: grid; place-items: center; min-block-size: 220px; border-radius: var(--sw-r-lg); border: 2px dashed var(--sw-border); background: transparent;
      color: var(--sw-text-2); text-align: center; padding: 16px; font: inherit; cursor: pointer;
    }
    .add b { display: block; font-size: var(--sw-fs-3xl); color: var(--sw-accent); line-height: 1; }
    .add small { color: var(--sw-text-3); }
    .add:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 3px; }
    .kpi[data-k='health'] { --c: var(--sw-warning); }
    /* phase 3 (idea 7): area groups, like the floors tree of the other screens; a quick floor filter */
    .floors { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .floors button {
      border: 1px solid var(--sw-border); background: var(--sw-surface); color: var(--sw-text-2); border-radius: var(--sw-r-pill); padding: 4px 12px; font: inherit;
      font-size: var(--sw-fs-sm); cursor: pointer; min-block-size: var(--sw-ctl-h-sm);
      transition: border-color var(--sw-t-fast) var(--sw-ease), background-color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    .floors button:active { transform: scale(0.97); }
    /* DOMUS-DEFAULT-2439: the product's one selected chip (styles/chip-selected.ts) and its check mark */
    .floors button[aria-pressed='true'] { ${es} }
    .floors button[aria-pressed='true']::before { ${ss} }
    .floors button:focus-visible, .ghead:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 2px; }
    .groups { display: grid; gap: 18px; }
    .group { display: grid; gap: 10px; }
    .ghead {
      display: flex; align-items: center; gap: 10px; border: 0; background: transparent; padding: 4px 6px; font: inherit; color: inherit; cursor: pointer; text-align: start;
      inline-size: 100%; min-block-size: 32px; border-radius: var(--sw-r-md); transition: background-color var(--sw-t-fast) var(--sw-ease);
    }
    .ghead h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: 800; color: var(--sw-heading); letter-spacing: -0.01em; }
    .ghead small { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .ghead .dot { inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--c); flex: none; }
    .ghead .chev { margin-inline-start: auto; color: var(--sw-text-3); transition: transform var(--sw-t-fast) var(--sw-ease-out); }
    .ghead[aria-expanded='false'] .chev { transform: rotate(-90deg); }
    .empty { display: grid; justify-items: center; gap: 10px; text-align: center; padding: 40px 16px; }
    .empty .art { inline-size: 72px; block-size: 72px; border-radius: 50%; display: grid; place-items: center; background: var(--sw-accent-soft); color: var(--sw-accent); }
    .empty h2 { margin: 0; font-size: var(--sw-fs-xl); }
    .empty p { margin: 0; max-inline-size: 520px; color: var(--sw-text-2); }
    .toast {
      position: fixed; inset-block-end: calc(var(--sw-bottomnav-h, 0px) + 20px); inset-inline: 0; margin-inline: auto; inline-size: max-content; max-inline-size: 90vw;
      background: var(--sw-toast-bg); color: var(--sw-toast-text); border-radius: var(--sw-r-pill); padding: 8px 16px; z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-2);
      /* POLISH136: the toast rises in instead of popping (token duration: zero under reduced motion) */
      opacity: 1; transform: translateY(0); transition: opacity var(--sw-t-med) var(--sw-ease), transform var(--sw-t-med) var(--sw-ease);
    }
    @starting-style { .toast { opacity: 0; transform: translateY(8px); } }
    /* POLISH136: the header actions and the add card answer a press like every other control on the page */
    .meta .btn, .hand .btn, .add { transition: border-color var(--sw-t-fast) var(--sw-ease), color var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease); }
    .meta .btn:active, .hand .btn:active { transform: scale(0.97); }
    .add:active { transform: scale(0.99); }
    /* POLISH136: the loading state draws the shape of the page (title, KPI row, three cards) instead of a blank screen; .skl was never
       defined for this screen (the generator and elevators screens share the gap - noted for the round) */
    .skl { display: flex; flex-direction: column; gap: 14px; }
    .sk {
      border-radius: var(--sw-r-md); border: 1px solid var(--sw-border); box-sizing: border-box;
      background: linear-gradient(90deg, var(--sw-surface-3) 0%, var(--sw-surface) 50%, var(--sw-surface-3) 100%); background-size: 200% 100%; animation: tp-shimmer 1.4s var(--sw-ease) infinite;
    }
    .sk-kpi { block-size: 64px; }
    .sk-card { block-size: 236px; border-radius: var(--sw-r-lg); }
    @keyframes tp-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    /* POLISH136: hover is only for fine pointers - a touch must not leave a card lit */
    @media (hover: hover) and (pointer: fine) {
      .ucard:hover { box-shadow: var(--sw-shadow-3), inset 0 1px 0 var(--sw-highlight); }
      .ucard:hover:not([data-look='alarm']):not([data-look='warn']) { border-color: var(--sw-border-strong); }
      .kpi:hover { border-color: var(--sw-border-strong); }
      .floors button:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
      .ghead:hover { background: var(--sw-surface-2); }
      .add:hover { border-color: var(--sw-border-strong); color: var(--sw-text); }
    }
    /* NOSCROLL-1366-2437 (owner rule: a control screen never scrolls; audit round 30: 76 px over at 1366x768): from 1101 px (a desktop; the 1024 px tablet keeps the page as it was) the screen keeps
       its box (the shell gives it the room under the tabs) and the unit cards are pages (the pager sits beside "יומן התראות"); a short window
       (<= 820 px high) draws the counters and the cards a step denser, so two rows of cards fit at 1366x768. Tablet and phone unchanged. */
    @media (min-width: 1101px) {
      :host { gap: 12px; }
      .grid { gap: 14px; }
    }
    /* PAGING-SETTING-2439: the long lists scroll (הגדרות › כללי) - the screen keeps its box, the counters and the floors stay, and the
       unit cards scroll inside their own region (measured: layout-noscroll-1366 case temperature-many) */
    @media (min-width: 1101px) {
      :host([data-long-lists='scroll']) { block-size: 100%; min-block-size: 0; }
      :host([data-long-lists='scroll']) sw-page { block-size: 100%; min-block-size: 0; }
      :host([data-long-lists='scroll']) [data-temp-grid],
      :host([data-long-lists='scroll']) [data-temp-groups] { flex: 1 1 auto; min-block-size: 0; overflow-y: auto; overscroll-behavior: contain; align-content: start; }
      /* a card clips its overflow, so its rows would shrink to the box instead of overflowing it: rows keep their content height */
      :host([data-long-lists='scroll']) [data-temp-grid],
      :host([data-long-lists='scroll']) [data-temp-groups] { grid-auto-rows: max-content; }
    }
    @media (min-width: 1101px) and (max-height: 820px) {
      :host { padding-block: 10px 16px; }
      .kpi { padding: 8px 14px; gap: 12px; }
      .kpi b { font-size: var(--sw-fs-3xl); }
      .kpi .dot { inline-size: 16px; block-size: 16px; }
      .ucard { padding: 14px 16px; gap: 8px; }
      .ucard .spark { block-size: 44px; }
      .umeta { gap: 4px; }
    }
    @media (max-width: 600px) {
      /* round 2 loop 1: on a phone the tile's word may take two lines instead of an ellipsis */
      .kpi span.l { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; line-height: 1.25; }
      .ubody { gap: 10px; }
    }
    @media (max-width: 420px) {
      .ubody { flex-direction: row; }
      .chips { justify-content: flex-start; }
    }
  `,ns];T([k({attribute:!1})],R.prototype,"route",2);T([u()],R.prototype,"access",2);T([u()],R.prototype,"data",2);T([u()],R.prototype,"error",2);T([u()],R.prototype,"editing",2);T([u()],R.prototype,"kpi",2);T([u()],R.prototype,"openId",2);T([u()],R.prototype,"wizard",2);T([u()],R.prototype,"report",2);T([u()],R.prototype,"wa",2);T([u()],R.prototype,"floor",2);T([u()],R.prototype,"collapsed",2);T([u()],R.prototype,"page",2);T([u()],R.prototype,"per",2);R=T([K("infra-temperature")],R);export{R as InfraTemperature};
