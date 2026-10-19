import{a as m,a7 as v,G as l,d3 as b,I as c,ah as f,d4 as x,al as $,am as y,ao as g}from"./index-BVPurVKQ.js";const u={he:{title:"דרישות תשלום לפי שלבים",open:"ממתין לתשלום",paid:"שולם",cancelled:"בוטל",advance:"מקדמה",progress:"תשלום ביניים",final:"תשלום סופי",due:"מועד",onCompletion:"בסיום העבודה",n:"תשלום {n}"},en:{title:"Instalment payment demands",open:"Awaiting payment",paid:"Paid",cancelled:"Cancelled",advance:"Advance",progress:"Progress payment",final:"Final payment",due:"Due",onCompletion:"On completion",n:"Instalment {n}"}};function r(a,e){return(u[a]??u.he)[e]}function h(a,e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(a??"");return t?`${t[3]}.${t[2]}.${t[1]}`:r(e,"onCompletion")}function _(a,e){return[...a??[]].filter(t=>t&&typeof t.id=="string"&&Number.isInteger(t.index)&&(t.status==="open"||t.status==="paid"||t.status==="cancelled")).sort((t,n)=>t.index-n.index).map(t=>({id:t.id,label:r(e,"n").replace("{n}",String(t.index+1)),kind:t.kind==="advance"||t.kind==="progress"||t.kind==="final"?r(e,t.kind):"",status:t.status,statusText:r(e,t.status),due:h(t.due_date,e),amount_minor:t.amount_minor,currency:t.currency}))}var T=Object.defineProperty,k=Object.getOwnPropertyDescriptor,p=(a,e,t,n)=>{for(var s=n>1?void 0:n?k(e,t):e,i=a.length-1,d;i>=0;i--)(d=a[i])&&(s=(n?d(e,t,s):d(s))||s);return n&&s&&T(e,t,s),s};let o=class extends m{constructor(){super(...arguments),this.items=[]}render(){const a=v(),e=_(this.items,a);return e.length?c`<section class="cstage" data-costs-demands>
      <div class="csh"><span class="ic">${b("coins")}</span><b>${r(a,"title")}</b></div>
      <table>
        <tbody>${e.map(t=>c`<tr data-costs-demand=${t.id}>
          <td>${t.label}${t.kind?c` · <span class="muted">${t.kind}</span>`:l}</td>
          <td data-status=${t.status}>${t.statusText}</td>
          <td class="amt">${f(t.amount_minor,t.currency,a)}</td>
          <td><span class="muted">${r(a,"due")}</span> ${t.due}</td>
        </tr>`)}</tbody>
      </table>
    </section>`:l}};o.styles=[x,$`
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--dv-border); color: var(--dv-text); }
    td.amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td[data-status='cancelled'] { color: var(--dv-text-3); text-decoration: line-through; }
    td[data-status='open'] { color: var(--dv-accent); }
  `];p([y({attribute:!1})],o.prototype,"items",2);o=p([g("ticket-costs-demands")],o);export{o as TicketCostsDemands};
//# sourceMappingURL=costs-demands-SyJLvEvw.js.map
