import{i as m,cL as v,w as l,cM as b,x as c,cN as f,cO as x,a1 as $,a2 as y,a4 as g}from"./index-DEwtttfK.js";const u={he:{title:"דרישות תשלום לפי שלבים",open:"ממתין לתשלום",paid:"שולם",cancelled:"בוטל",advance:"מקדמה",progress:"תשלום ביניים",final:"תשלום סופי",due:"מועד",onCompletion:"בסיום העבודה",n:"תשלום {n}"},en:{title:"Instalment payment demands",open:"Awaiting payment",paid:"Paid",cancelled:"Cancelled",advance:"Advance",progress:"Progress payment",final:"Final payment",due:"Due",onCompletion:"On completion",n:"Instalment {n}"}};function r(s,e){return(u[s]??u.he)[e]}function h(s,e){const t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s??"");return t?`${t[3]}.${t[2]}.${t[1]}`:r(e,"onCompletion")}function _(s,e){return[...s??[]].filter(t=>t&&typeof t.id=="string"&&Number.isInteger(t.index)&&(t.status==="open"||t.status==="paid"||t.status==="cancelled")).sort((t,a)=>t.index-a.index).map(t=>({id:t.id,label:r(e,"n").replace("{n}",String(t.index+1)),kind:t.kind==="advance"||t.kind==="progress"||t.kind==="final"?r(e,t.kind):"",status:t.status,statusText:r(e,t.status),due:h(t.due_date,e),amount_minor:t.amount_minor,currency:t.currency}))}var T=Object.defineProperty,w=Object.getOwnPropertyDescriptor,p=(s,e,t,a)=>{for(var n=a>1?void 0:a?w(e,t):e,o=s.length-1,d;o>=0;o--)(d=s[o])&&(n=(a?d(e,t,n):d(n))||n);return a&&n&&T(e,t,n),n};let i=class extends m{constructor(){super(...arguments),this.items=[]}render(){const s=v(),e=_(this.items,s);return e.length?c`<section class="cstage" data-costs-demands>
      <div class="csh"><span class="ic">${b("coins")}</span><b>${r(s,"title")}</b></div>
      <table>
        <tbody>${e.map(t=>c`<tr data-costs-demand=${t.id}>
          <td>${t.label}${t.kind?c` · <span class="muted">${t.kind}</span>`:l}</td>
          <td data-status=${t.status}>${t.statusText}</td>
          <td class="amt">${f(t.amount_minor,t.currency,s)}</td>
          <td><span class="muted">${r(s,"due")}</span> ${t.due}</td>
        </tr>`)}</tbody>
      </table>
    </section>`:l}};i.styles=[x,$`
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--dv-border); color: var(--dv-text); }
    td.amt { font-variant-numeric: tabular-nums; white-space: nowrap; }
    td[data-status='cancelled'] { color: var(--dv-text-3); text-decoration: line-through; }
    td[data-status='open'] { color: var(--dv-accent); }
  `];p([y({attribute:!1})],i.prototype,"items",2);i=p([g("ticket-costs-demands")],i);export{i as TicketCostsDemands};
//# sourceMappingURL=costs-demands-BmtCXEBQ.js.map
