import{a as C,S as D,oT as S,mU as u,o as z,i as f,av as $,oU as g,m,oV as k,oW as T,j as P,R as v,oX as b,oY as R,oZ as E,mp as a,B as A,x as w,bV as y,e as l,nD as F,o_ as L,A as p,o$ as x,p0 as O,dU as q,p1 as B,p as I,fo as V,C as N,E as U,G as d,H as M}from"./index-CHCc2mtA.js";import"./sw-table-DaU7z9J0.js";import"./sw-skeleton-DUmXs0_h.js";import{t as j}from"./settings-styles-BYYMhH93.js";import"./sw-logo-art-Va6y_cIM.js";var K=Object.defineProperty,W=Object.getOwnPropertyDescriptor,c=(e,s,i,t)=>{for(var n=t>1?void 0:t?W(s,i):s,r=e.length-1,h;r>=0;r--)(h=e[r])&&(n=(t?h(s,i,n):h(n))||n);return t&&n&&K(s,i,n),n};const _={due:"vaDue",paid:"vaPaid",open:"vaOpen"};let o=class extends C{constructor(){super(...arguments),this.bubbleSkin=new D(this),this.filters={...S},this.data=null,this.phase="loading",this.loadError="",this.selected=new Set,this.dialog=!1,this.payRef="",this.payDate=u(),this.busy=!1,this.ok="",this.error="",this.failures=[],this.seq=0,this.offNames=null}connectedCallback(){super.connectedCallback(),this.offNames=z(()=>this.requestUpdate()),this.load()}disconnectedCallback(){super.disconnectedCallback(),this.offNames?.()}get canMark(){return!!this.data?.can_mark_paid&&(!f()||$("tickets.costs"))}async load(){if(f()&&!$("tickets.costs.view")){this.phase="forbidden";return}if(!g(this.filters))return;const e=++this.seq;this.phase=this.data?this.phase:"loading";try{const s=await m().accountClaims(k(this.filters));if(e!==this.seq)return;this.data=s,this.selected=T(s.rows,this.selected),this.phase="ready"}catch(s){if(e!==this.seq)return;if(s instanceof P&&s.status===403){this.phase="forbidden";return}this.loadError=v(s),this.phase="error"}}setFilter(e,s){this.filters={...this.filters,[e]:s},this.ok="",this.error="",this.failures=[],this.load()}async exportCsv(){this.error="";try{await m().exportCsv({group_by:"vendor",...k(this.filters)},"claim")}catch(e){this.error=v(e)}}toggle(e,s){const i=new Set(this.selected);s?i.add(e):i.delete(e),this.selected=i}toggleAll(e){this.selected=e?new Set((this.data?.rows??[]).filter(b).map(s=>s.claim_id)):new Set}openDialog(){this.payRef="",this.payDate=u(),this.dialog=!0}async confirmPaid(){const e=this.data?.rows??[],s=R(e,this.selected);if(!(!s.length||!this.payRef.trim()||!this.payDate)){this.busy=!0;try{const i=await m().markPaidBulk(s,this.payRef.trim(),this.payDate),t=E(i);this.dialog=!1,this.selected=new Set,this.ok=a("vaDone",{n:t.done}),this.failures=t.failed.map(n=>`${n.number?`#${n.number}`:n.claim_id} · ${a(`r_${n.result}`)}`),this.error=t.failed.length?a("vaSkipped",{n:t.failed.length}):"",await this.load()}catch(i){this.error=v(i)}finally{this.busy=!1}}}money(e,s){return A(e,s,w()==="en"?"en":"he")}day(e){if(!e)return"";try{return new Intl.DateTimeFormat(w()==="en"?"en-GB":"he-IL",{dateStyle:"short"}).format(new Date(e))}catch{return e.slice(0,10)}}filterBar(){const e=this.filters,s=this.data,i=!g(e),t=s?.vendors??[],n=s?.departments??[];return l`<div class="filters" role="group" aria-label=${a("vaFilters")} data-va-filters>
      <label>${a("from")}<input class="in" type="date" lang=${y()} data-va-from .value=${e.from} max=${e.to||""} @change=${r=>this.setFilter("from",r.target.value)} /></label>
      <label>${a("to")}<input class="in" type="date" lang=${y()} data-va-to .value=${e.to} min=${e.from||""} aria-invalid=${i?"true":"false"} @change=${r=>this.setFilter("to",r.target.value)} /></label>
      <label>${a("vaVendor")}<select class="in" data-va-vendor @change=${r=>this.setFilter("vendor",r.target.value)}>
        <option value="" ?selected=${!e.vendor}>${a("vaAllVendors")}</option>
        ${t.map(r=>l`<option value=${r.key} ?selected=${e.vendor===r.key}>${r.label||a("noLabel")}</option>`)}
      </select></label>
      <label>${a("vaDepartment")}<select class="in" data-va-department @change=${r=>this.setFilter("department",r.target.value)}>
        <option value="" ?selected=${!e.department}>${a("vaAllDepartments")}</option>
        ${n.map(r=>l`<option value=${r.id} ?selected=${e.department===r.id}>${r.name||a("noLabel")}</option>`)}
      </select></label>
      <label>${a("currency")}<select class="in" data-va-currency @change=${r=>this.setFilter("currency",r.target.value)}>
        <option value="" ?selected=${!e.currency}>${a("allCurrencies")}</option>
        ${F.map(r=>l`<option value=${r} ?selected=${e.currency===r}>${r}</option>`)}
      </select></label>
      <label>${a("vaColStatus")}<select class="in" data-va-status @change=${r=>this.setFilter("bucket",r.target.value)}>
        <option value="" ?selected=${!e.bucket}>${a("vaAllStatuses")}</option>
        ${L.map(r=>l`<option value=${r} ?selected=${e.bucket===r}>${a(_[r])}</option>`)}
      </select></label>
    </div>`}summary(e){const s=[{key:"label",label:a("vaVendor"),render:i=>l`<span class=${i.total?"strong":""}>${i.total?a("vaTotal"):i.label||a("noLabel")}</span>`},{key:"due",label:a("vaDue"),render:i=>l`<span class="num ${i.total?"strong":""}" data-va-due>${this.money(i.due,i.currency)}</span>`},{key:"paid",label:a("vaPaid"),render:i=>l`<span class="num">${this.money(i.paid,i.currency)}</span>`},{key:"open",label:a("vaOpen"),render:i=>l`<span class="num">${this.money(i.open,i.currency)}</span>`},{key:"claims",label:a("vaClaims"),render:i=>l`<span class="num">${i.claims}</span>`}];return l`<div class="blocks" data-va-summary>
      ${e.map(i=>{const t=[...i.vendors.map(n=>({...n,id:`v:${n.key}`})),{...i.total,key:"",label:"",currency:i.currency,id:`total:${i.currency}`,total:!0}];return l`<section data-va-currency-block=${i.currency}>
          <h3>${i.currency}</h3>
          <sw-table dense .columns=${s} .rows=${t}
            @row-select=${n=>n.detail.id.startsWith("v:")&&this.setFilter("vendor",n.detail.id.slice(2))}></sw-table>
        </section>`})}
    </div>`}claims(e){const i=[...this.canMark?[{key:"sel",label:"",width:"44px",render:t=>b(t)?l`<label class="sw-hit" style="display:inline-grid;place-items:center;cursor:pointer" @click=${n=>n.stopPropagation()}><input type="checkbox" aria-label=${a("vaSelect")} data-va-select=${t.claim_id} .checked=${this.selected.has(t.claim_id)}
              style="inline-size:18px;block-size:18px;margin:0" @click=${n=>n.stopPropagation()} @change=${n=>this.toggle(t.claim_id,n.target.checked)} /></label>`:p}]:[],{key:"number",label:a("vaColTicket"),render:t=>t.ticket_id?l`<a href=${`#/tickets/${t.ticket_id}`} data-va-link=${t.ticket_id} @click=${n=>n.stopPropagation()}>#${t.number??""}</a>`:l`${t.number?`#${t.number}`:""}`},{key:"title",label:a("vaColTitle"),render:t=>t.title},{key:"vendor",label:a("vaVendor"),render:t=>t.vendor||a("noLabel")},{key:"department",label:a("vaDepartment"),render:t=>t.department},{key:"status",label:a("vaColStatus"),render:t=>l`<span data-va-bucket=${x(t.status)}>${a(_[x(t.status)])}</span>`},{key:"date",label:a("vaColDate"),render:t=>this.day(t.status==="paid"?t.paid_at??t.period_at:t.period_at)},{key:"amount",label:a("vaColAmount"),render:t=>l`<span class="num" data-va-amount>${this.money(t.amount_minor,t.currency)}</span>`}];return l`<sw-table dense .rowKey=${"claim_id"} data-va-claims .columns=${i} .rows=${e}
      @row-select=${t=>t.detail.row.ticket_id&&(window.location.hash=`#/tickets/${t.detail.row.ticket_id}`)}></sw-table>`}actions(e){const s=e.filter(b),i=s.length>0&&s.every(t=>this.selected.has(t.claim_id));return l`<div class="bar" data-va-actions>
      ${this.canMark&&s.length?l`<label class="selall"><input type="checkbox" data-va-select-all .checked=${i} @change=${t=>this.toggleAll(t.target.checked)} />${a("vaSelectAll")}</label>`:p}
      <span class="grow"></span>
      ${this.canMark?l`<sw-button variant="primary" icon="check" data-va-mark ?disabled=${!this.selected.size} @click=${()=>this.openDialog()}>${a("vaMarkPaidN",{n:this.selected.size})}</sw-button>`:p}
      <sw-button icon="download" data-va-csv ?disabled=${!e.length} @click=${()=>void this.exportCsv()}>${a("vaCsv")}</sw-button>
    </div>`}bulkDialog(){const e=O(this.data?.rows??[],this.selected);return l`<sw-dialog ?open=${this.dialog} ?locked=${this.busy} heading=${a("markPaidTitle")} data-va-dialog @close=${()=>this.dialog=!1}>
      <ul class="sum" data-va-dialog-sum>
        ${e.map(s=>l`<li data-va-sum=${s.currency}>${a("vaBulkSum",{n:s.count,amount:this.money(s.minor,s.currency)})}</li>`)}
      </ul>
      <label class="dlg">${a("paymentRef")}<input class="in" data-va-ref maxlength="60" required .value=${this.payRef} @input=${s=>this.payRef=s.target.value} /></label>
      <label class="dlg">${a("paymentDate")}<input class="in" type="date" lang=${y()} data-va-date required max=${u()} .value=${this.payDate} @input=${s=>this.payDate=s.target.value} /></label>
      <sw-button slot="footer" @click=${()=>this.dialog=!1} ?disabled=${this.busy}>${a("back")}</sw-button>
      <sw-button slot="footer" variant="primary" data-va-confirm ?disabled=${this.busy||!this.payRef.trim()||!this.payDate||!e.length} @click=${()=>void this.confirmPaid()}>${a("confirm")}</sw-button>
    </sw-dialog>`}body(){if(this.phase==="forbidden")return l`<sw-state-panel state="forbidden" quiet heading=${a("forbidden")} data-va-state="forbidden"></sw-state-panel>`;if(this.phase==="loading")return l`<div class="skel" data-va-state="loading" role="status" aria-busy="true" aria-label=${q("states.loading")}>
        <sw-skeleton variant="block" height="132px"></sw-skeleton>
        <sw-skeleton variant="block" height="44px"></sw-skeleton>
        <sw-skeleton variant="block" height="240px"></sw-skeleton>
      </div>`;if(this.phase==="error")return l`<sw-state-panel state="error" heading=${a("vaLoadFailed")} hint=${this.loadError} actionLabel=${a("retry")} data-va-state="error"
        @action=${()=>{this.phase="loading",this.load()}}></sw-state-panel>`;const e=this.data?.rows??[];return e.length?l`<div data-va-state="ready">
      ${this.data?.truncated?l`<div class="msg warn" role="status" data-va-truncated>${a("vaTruncated")}</div>`:p}
      ${this.summary(B(e))}
      ${this.actions(e)}
      ${this.claims(e)}
    </div>`:l`<sw-state-panel icon="wrench" state="empty" quiet heading=${a("emptyReport")} data-va-state="empty"></sw-state-panel>`}render(){return l`<sw-page crumbs=${I("area")} heading=${a("vaTitle")} data-vendor-accounts data-phase=${this.phase}>
      ${this.phase==="forbidden"?p:this.filterBar()}
      ${this.error?l`<div class="msg err" role="alert" data-va-error>${this.error}${this.failures.length?l`<ul class="fails">${this.failures.map(e=>l`<li>${e}</li>`)}</ul>`:p}</div>`:p}
      ${this.ok?l`<div class="msg ok" role="status" data-va-ok>${this.ok}</div>`:p}
      ${this.body()}
      ${this.bulkDialog()}
    </sw-page>`}};o.styles=[V,j,U`
    :host {
      display: block;
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
      min-inline-size: 0;
    }
    .filters label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1 1 140px;
      min-inline-size: 0;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .filters .in {
      inline-size: 100%;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block: var(--sw-s-3);
    }
    .bar .grow {
      flex: 1;
    }
    .selall {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-block-size: 36px;
      font-size: var(--sw-fs-sm);
    }
    .blocks {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      min-inline-size: 0;
    }
    h3 {
      margin: 0 0 var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .num {
      font-variant-numeric: tabular-nums;
    }
    .strong {
      font-weight: var(--sw-fw-semibold);
    }
    input[type='checkbox'] {
      inline-size: 18px;
      block-size: 18px;
      margin: 0;
    }
    .sum {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-sm);
    }
    .dlg {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    .fails {
      margin: 4px 0 0;
      padding-inline-start: 18px;
    }
    /* the first answer: the shape of the page that is coming (the vendors' summary, the action bar, the claims), so nothing jumps */
    .skel {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
    }
    /* WP3 (POLISH-4, D5): the phone. The six filters take two to a row (a single column was six rows tall before the first number),
       the actions stack as full 44 px keys, and the select-all line is a real touch target. The tables are cards already (sw-table). */
    @media (max-width: 767px) {
      .filters {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--sw-s-2);
      }
      .filters label {
        flex: none;
      }
      .filters .in,
      .selall {
        min-block-size: 44px;
      }
      .bar {
        gap: var(--sw-s-2);
      }
      .bar .grow {
        display: none;
      }
      .bar sw-button {
        flex: 1 1 100%;
      }
      .selall {
        flex: 1 1 100%;
      }
    }
  `,N];c([d()],o.prototype,"filters",2);c([d()],o.prototype,"data",2);c([d()],o.prototype,"phase",2);c([d()],o.prototype,"loadError",2);c([d()],o.prototype,"selected",2);c([d()],o.prototype,"dialog",2);c([d()],o.prototype,"payRef",2);c([d()],o.prototype,"payDate",2);c([d()],o.prototype,"busy",2);c([d()],o.prototype,"ok",2);c([d()],o.prototype,"error",2);c([d()],o.prototype,"failures",2);o=c([M("tickets-vendor-accounts")],o);export{o as TicketsVendorAccounts};
//# sourceMappingURL=vendor-accounts-xw3WwmuU.js.map
