import{a as y,j as b,a8 as l,aV as v,G as c,I as r,d7 as g,aj as x,d8 as h,an as $,ao as w,ap as u,aq as k}from"./index-BQXwTbwi.js";import"./transit-logic-BgylXPpu.js";const f={he:{title:"תשלומים לפי שלבים",none:"טרם נדרש",open:"ממתין לתשלום",paid:"שולם",cancelled:"בוטל",advance:"מקדמה",progress:"תשלום ביניים",final:"תשלום סופי",due:"מועד",onCompletion:"בסיום העבודה",n:"תשלום {n}",late:"באיחור",soon:"בקרוב",later:"טרם הגיע המועד",markPaid:"סמן כשולם",confirm:"לאשר שהתשלום בוצע?",yes:"כן, שולם",no:"ביטול",failed:"סימון התשלום נכשל. נסו שוב.",done:"התשלום סומן כשולם"},en:{title:"Instalment payments",none:"Not demanded yet",open:"Awaiting payment",paid:"Paid",cancelled:"Cancelled",advance:"Advance",progress:"Progress payment",final:"Final payment",due:"Due",onCompletion:"On completion",n:"Instalment {n}",late:"Late",soon:"Due soon",later:"Not due yet",markPaid:"Mark paid",confirm:"Confirm the payment was made?",yes:"Yes, paid",no:"Cancel",failed:"Marking the payment failed. Try again.",done:"Payment marked as paid"}};function e(a,n){return(f[a]??f.he)[n]}function _(a,n){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(a??"");return t?`${t[3]}.${t[2]}.${t[1]}`:e(n,"onCompletion")}function P(a){return a.status==="paid"?"paid":a.timing==="late"||a.timing==="soon"||a.timing==="later"||a.timing==="paid"?a.timing:"later"}function T(a,n){return[...a??[]].filter(t=>t&&typeof t.id=="string"&&Number.isInteger(t.index)&&(t.status==="none"||t.status==="open"||t.status==="paid"||t.status==="cancelled")).sort((t,s)=>t.index-s.index).map(t=>{const s=P(t);return{id:t.id,label:e(n,"n").replace("{n}",String(t.index+1)),kind:t.kind==="advance"||t.kind==="progress"||t.kind==="final"?e(n,t.kind):"",status:t.status,statusText:e(n,t.status),due:_(t.due_date,n),amount_minor:typeof t.amount_minor=="number"?t.amount_minor:null,currency:t.currency??null,timing:s,timingText:e(n,s==="paid"?"paid":s),index:t.index,awardId:t.award_id??"",rfqId:t.rfq_id??"",canPay:t.can_pay===!0&&typeof t.amount_minor=="number"&&t.status!=="paid"&&!!t.award_id&&!!t.rfq_id}})}function C(a){return!a.canPay||a.status==="paid"?[]:a.status==="open"?["paid"]:["create","paid"]}var I=Object.defineProperty,D=Object.getOwnPropertyDescriptor,d=(a,n,t,s)=>{for(var i=s>1?void 0:s?D(n,t):n,p=a.length-1,m;p>=0;p--)(m=a[p])&&(i=(s?m(n,t,i):m(i))||i);return s&&i&&I(n,t,i),i};let o=class extends y{constructor(){super(...arguments),this.items=[],this.confirming="",this.busy="",this.err=""}async pay(a){const n=b();if(n.instalmentDemand){this.busy=a.id,this.err="";try{for(const t of C(a))await n.instalmentDemand(a.rfqId,a.awardId,a.index,t);this.confirming="",this.dispatchEvent(new CustomEvent("cost-reload",{bubbles:!0,composed:!0}))}catch(t){this.err=`${e(l(),"failed")} ${v(t)}`.trim()}finally{this.busy=""}}}action(a,n){return a.canPay?this.confirming!==a.id?r`<button type="button" class="btn sm" data-demand-pay=${a.id} @click=${()=>{this.confirming=a.id,this.err=""}}>${e(n,"markPaid")}</button>`:r`<span class="act" data-demand-confirm=${a.id}>${e(n,"confirm")}
      <button type="button" class="btn sm primary" ?disabled=${this.busy===a.id} data-demand-yes=${a.id} @click=${()=>void this.pay(a)}>${e(n,"yes")}</button>
      <button type="button" class="btn sm" ?disabled=${this.busy===a.id} @click=${()=>this.confirming=""}>${e(n,"no")}</button></span>`:c}render(){const a=l(),n=T(this.items,a);return n.length?r`<section class="cstage" data-costs-demands>
      <div class="csh"><span class="ic">${g("coins")}</span><b>${e(a,"title")}</b></div>
      <ul class="rows">${n.map(t=>r`<li class="row" data-costs-demand=${t.id} data-timing=${t.timing}>
        <span class="what">${t.label}${t.kind?r` · <span class="muted">${t.kind}</span>`:c}</span>
        <span class="chip" data-timing=${t.timing}>${t.timingText}</span>
        <span class="st" data-status=${t.status}>${t.statusText}</span>
        <span class="amt">${t.amount_minor===null?r`<span class="muted" data-demand-no-amount>-</span>`:x(t.amount_minor,t.currency,a)}</span>
        <span class="due"><span class="muted">${e(a,"due")}</span> ${t.due}</span>
        ${this.action(t,a)}
      </li>`)}</ul>
      ${this.err?r`<div class="err" role="alert" data-demand-error>${this.err}</div>`:c}
    </section>`:c}};o.styles=[h,$`
    .rows { display: flex; flex-direction: column; margin: 0; padding: 0; list-style: none; font-size: var(--sw-fs-sm); }
    .row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; padding: 8px; border-block-end: 1px solid var(--dv-border); color: var(--dv-text); }
    .row .what { flex: 1 1 140px; min-inline-size: 0; }
    .row .amt { font-variant-numeric: tabular-nums; white-space: nowrap; unicode-bidi: isolate; }
    .row .due { white-space: nowrap; color: var(--dv-text-2); unicode-bidi: isolate; }
    .chip { display: inline-block; padding: 1px 8px; border-radius: 999px; border: 1px solid var(--dv-border); font-size: var(--sw-fs-sm); color: var(--dv-text-2); }
    .chip[data-timing='late'] { color: var(--dv-danger); border-color: var(--dv-danger); }
    .chip[data-timing='soon'] { color: var(--dv-warning); border-color: var(--dv-warning); }
    .chip[data-timing='paid'] { color: var(--dv-success); border-color: var(--dv-success); }
    .st[data-status='cancelled'] { color: var(--dv-text-3); text-decoration: line-through; }
    .st[data-status='open'] { color: var(--dv-accent); }
    .st[data-status='none'] { color: var(--dv-text-3); }
    .act { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .act .btn { min-block-size: 44px; }
    .err { color: var(--dv-danger); padding: 6px 8px; }
  `];d([w({attribute:!1})],o.prototype,"items",2);d([u()],o.prototype,"confirming",2);d([u()],o.prototype,"busy",2);d([u()],o.prototype,"err",2);o=d([k("ticket-costs-demands")],o);export{o as TicketCostsDemands};
//# sourceMappingURL=costs-demands-DAWBL7qI.js.map
