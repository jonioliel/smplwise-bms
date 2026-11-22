import{bH as X,dE as t,aU as Ce,hH as Ve,g as Ge,j as w,i as Me,aL as He,od as te,oe as ae,of as ie,og as ne,oh as re,oi as le,oj as oe,ok as de,ol as ce,om as he,on as pe,oo as ue,op as we,oq as ve,or as be,os as fe,ot as ge,ou as $e,ov as j,eC as Ye,ow as qe,a2 as T,dN as Be,ox as W,b as o,A as y,kq as z,dL as E,n as m,oy as Fe,oz as Ze,oA as C,oB as _,oC as L,oD as Je,oE as ye,oF as Xe,oG as me,oH as Qe,oI as es,oJ as ss,oK as ts,oL as xe,oM as as,oN as G,oO as is,oP as ke,oQ as R,oR as ns,oS as M,oT as U,oU as rs,oV as K,oW as V,oX as ls,oY as os,oZ as ds,o_ as cs,o$ as Se,p0 as Le,p1 as We,p2 as Oe,p3 as ze,p4 as hs,p5 as Ee,p6 as Ie,p7 as Y,p8 as ps,p9 as us,pa as ws,pb as vs,pc as bs,pd as fs,pe as gs,k as Ne,pf as a,bF as Q,bG as ee,cE as $s,cC as ys,pg as De,ph as _e,pi as Pe,pj as q,aA as ms,pk as xs,pl as ks,bd as Ss,pm as F}from"./index-Cwrvr-7C.js";import{s as Ls}from"./settings-C0oL8AFl.js";import"./sw-logo-art-PLtEZJxU.js";const B={he:{title:"מיקום התפריט הנפתח בכותרת",sub:"במסך רחב (מ־1100 פיקסלים). במסך צר התפריט תמיד בשורה משלו מעל הכותרת. ברירת המחדל: בשורה משלו; מיקומים 2-4 ניסיוניים",inst:"ברירת המחדל של ההתקנה",own:"ההעדפה שלי",follow:"לפי ההתקנה (כרגע: {v})",active:"מה פעיל אצלי עכשיו:",saved:"ברירת המחדל נשמרה",savedOwn:"ההעדפה נשמרה",places:{1:"בשורה משלו מעל הכותרת",2:"בקצה הרחוק של שורת הכותרת",3:"מיד אחרי הכותרת",4:"בתחילת שורת הכותרת, לפני הכותרת"}},en:{title:"Header dropdown placement",sub:"On a wide screen (1100 px and up). On a narrow screen the dropdown always has its own row above the title. Default: own row; placements 2-4 are experimental",inst:"Installation default",own:"My preference",follow:"Follow the installation (now: {v})",active:"Active for me now:",saved:"Default saved",savedOwn:"Preference saved",places:{1:"Own row above the title",2:"Far end of the title row",3:"Right after the title",4:"Start of the title row, before the title"}}};function Z(){let e="he";try{e=document.documentElement.lang||"he"}catch{}return e.toLowerCase().startsWith("en")?B.en:B.he}X("screens/tabs-place-strings",{he:B.he,en:B.en});const N={he:{title:"ניווט בהגדרות בטלפון",options:{tabs:"שורת לשוניות",dropdown:"תפריט נפתח"},saved:"ההעדפה נשמרה"},en:{title:"Settings navigation on phones",options:{tabs:"Tab row",dropdown:"Dropdown"},saved:"Preference saved"},ar:{title:"التنقل في الإعدادات على الهاتف",options:{tabs:"شريط علامات التبويب",dropdown:"قائمة منسدلة"},saved:"تم حفظ التفضيل"},ru:{title:"Навигация по настройкам на телефоне",options:{tabs:"Строка вкладок",dropdown:"Выпадающий список"},saved:"Настройка сохранена"}};function Re(e){let s=e;if(s===void 0)try{s=document.documentElement.lang||"he"}catch{s="he"}const i=s.toLowerCase().slice(0,2);return i==="en"||i==="ar"||i==="ru"?N[i]:N.he}X("screens/settings-nav-strings",{he:N.he,en:N.en});var Ws=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,g=(e,s,i,n)=>{for(var l=n>1?void 0:n?Os(s,i):s,d=e.length-1,u;d>=0;d--)(u=e[d])&&(l=(n?u(s,i,l):u(l))||l);return n&&l&&Ws(s,i,l),l};const Te={"own-group":t("ההעדפה שלי לקבוצה"),own:t("ההעדפה שלי"),"installation-group":t("ברירת המחדל לקבוצה"),installation:t("ברירת המחדל של ההתקנה")},Ae=[{id:"a",label:t("ראשון"),count:4},{id:"b",label:t("שני")},{id:"c",label:t("שלישי")}],J=[{id:"a",label:t("סלון"),count:6},{id:"b",label:t("מטבח")},{id:"c",label:t("חדר שינה")},{id:"d",label:t("משרד"),alert:!0},{id:"e",label:t("מרפסת")},{id:"f",label:t("חצר")}],zs=[{id:"all",label:t("כל הקומות"),icon:"home",count:14},{id:"d1",label:"",divider:!0},{id:"f0",label:t("קומת קרקע"),icon:"layers",count:6},{id:"f1",label:t("קומה ראשונה"),icon:"layers",count:5},{id:"f2",label:t("גג"),icon:"layers",count:3}];let b=class extends Me{constructor(){super(...arguments),this.bubbleSkin=new He(this),this.inst=te(),this.own=ae(),this.ddInst=ie(),this.ddOwn=ne(),this.szInst=re(),this.szOwn=le(),this.ringInst=oe(),this.ringOwn=de(),this.panelInst=ce(),this.panelOwn=he(),this.phInst=pe(),this.phOwn=ue(),this.pkInst=we(),this.pkOwn=ve(),this.seInst=be(),this.seOwn=fe(),this.plInst=ge(),this.plOwn=$e(),this.snOwn=j(),this.canEdit=!1,this.busy=!1,this.toaster=new Ye(this,{ms:2500}),this.scope="style",this.error=""}get message(){return this.toaster.text}connectedCallback(){super.connectedCallback(),this.stop=qe(()=>{this.inst=te(),this.own=ae(),this.ddInst=ie(),this.ddOwn=ne(),this.szInst=re(),this.szOwn=le(),this.ringInst=oe(),this.ringOwn=de(),this.panelInst=ce(),this.panelOwn=he(),this.phInst=pe(),this.phOwn=ue(),this.pkInst=we(),this.pkOwn=ve(),this.seInst=be(),this.seOwn=fe(),this.plInst=ge(),this.plOwn=$e(),this.snOwn=j()}),this.load()}disconnectedCallback(){this.stop?.(),super.disconnectedCallback()}async load(){if(T())try{const e=await Be();this.canEdit=e.can_edit===!0,W(e.settings)}catch{}}flash(e){this.toaster.show(e)}colhead(e,s=!1,i,n){const l=i??(e==="inst"?t("ברירת המחדל של ההתקנה"):t("ההעדפה שלי")),d=T(),u=e==="own"?o`<span class="who">${n??t("רק אצלי; גוברת על ברירת המחדל")}</span>`:d?this.canEdit?o`<span class="who">${t("לכל המשתמשים, עד שמשתמש בוחר אחרת")}</span>`:o`<span class="who" data-inst-note><sw-icon name="lock" size=${13}></sw-icon>${t("שינוי ברירת המחדל דורש הרשאת מנהל מערכת.")}</span>`:o`<span class="who" data-inst-note>${t("נתוני הדגמה: ההגדרות נשמרות רק מול השרת.")}</span>`;return s?o`<legend class="colhead">${l}${u}</legend>`:o`<div class="colhead">${l}${u}</div>`}status(e){return o`<div class="status" aria-live="polite">${this.message&&this.scope===e?o`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:y}${this.error&&this.scope===e?o`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:y}</div>`}async saveInstallation(e,s){this.scope="style",this.busy=!0,this.error="";try{const i=await z({"ui.tabs_mode":e,"ui.tabs_mode_groups":s});E(),W(i.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}async saveDdInstallation(e,s){this.scope="style",this.busy=!0,this.error="";try{const i=await z({"ui.dd_style":e,"ui.dd_style_groups":s});E(),W(i.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}async saveDdOwn(e,s){this.scope="style",this.busy=!0,this.error="";try{await Fe(e,s),this.flash(t("ההעדפה נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}async saveSizeInstallation(e,s){this.scope="style",this.busy=!0,this.error="";try{const i=await z({"ui.dd_size":e,"ui.dd_size_groups":s});E(),W(i.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}async saveSizeOwn(e,s){this.scope="style",this.busy=!0,this.error="";try{await Ze(e,s),this.flash(t("ההעדפה נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}sizeWithGroup(e,s,i){const n={...e},l=V(i);return l?n[s]=l:delete n[s],n}sizeSelects(e,s,i,n,l,d){const u=e==="inst"?t("לפי ברירת המחדל הכללית"):t("לפי ההתקנה"),h=(c,p)=>o`${p?o`<option value="" ?selected=${!c}>${p}</option>`:y}${Oe.map($=>o`<option value=${$} ?selected=${c===$}>${C[$]}</option>`)}`;return o`<fieldset><legend>${t("גודל התפריט הנפתח")}</legend>
        <div class="grp all"><span>${t("לכל הקבוצות")}</span>
          <sw-field><select data-dd-size-global=${e} aria-label=${t("גודל תפריט נפתח: לכל הקבוצות")} ?disabled=${n} @change=${c=>l(c.target.value)}>${h(s,e==="own"?`${u} ${t("(כרגע: {value})",{value:C[this.szInst.size]})}`:null)}</select></sw-field></div>
        ${_.map(c=>o`<div class="grp" data-dd-size-group-row=${c}><span>${L[c]}</span>
            <sw-field><select data-dd-size-group=${`${e}:${c}`} aria-label=${`${L[c]}: ${t("גודל תפריט נפתח")}`} ?disabled=${n} @change=${p=>d(c,p.target.value)}>${h(i[c]??null,u)}</select></sw-field></div>`)}
      </fieldset>`}async saveDialInstallation(e,s,i){this.scope="style",this.busy=!0,this.error="";try{const n=await z({[`ui.dd_${e}`]:s,[`ui.dd_${e}_groups`]:i});E(),W(n.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(n){this.error=m(n)}finally{this.busy=!1}}async saveDialOwn(e,s,i){this.scope="style",this.busy=!0,this.error="";try{e==="ring"?await Je(ye(s),i):await Xe(me(s),i),this.flash(t("ההעדפה נשמרה"))}catch(n){this.error=m(n)}finally{this.busy=!1}}dialWithGroup(e,s,i,n){const l={...e};return n(i)?l[s]=i:delete l[s],l}dialSelects(e,s,i,n,l){const d=e==="ring",u=d?bs:fs,h=f=>d?Se[f]:Le[f],c=d?ye:me,p=d?this.ringInst.ring:this.panelInst.panel,$=s==="inst"?t("לפי ברירת המחדל הכללית"):t("לפי ההתקנה"),r=d?t("עובי הטבעת (סגנון קפסולה)"):t("רוחב התפריט הפתוח (סגנון קפסולה)"),v=(f,I)=>o`${I?o`<option value="" ?selected=${!f}>${I}</option>`:y}${u.map(D=>o`<option value=${D} ?selected=${f===D}>${h(D)}</option>`)}`,S=f=>s==="inst"?c(f)&&void this.saveDialInstallation(e,f,n):void this.saveDialOwn(e,c(f)?f:null,n),A=(f,I)=>{const D=this.dialWithGroup(n,f,I,c);s==="inst"?this.saveDialInstallation(e,i??p,D):this.saveDialOwn(e,i,D)};return o`<fieldset data-dd-dial-fieldset=${e}><legend>${r}</legend>
        ${d?o`<span class="muted">${t("טבעת דקה מאוד (1 או 1.5 פיקסל) נראית רק במסכי רטינה. חל רק על הסגנון קפסולה")}</span>`:o`<span class="muted">${t("חל רק על הסגנון קפסולה")}</span>`}
        <div class="grp all"><span>${t("לכל הקבוצות")}</span>
          <sw-field><select data-dd-dial-global=${`${e}:${s}`} aria-label=${`${r}: ${t("לכל הקבוצות")}`} ?disabled=${l} @change=${f=>S(f.target.value)}>${v(i,s==="own"?`${$} ${t("(כרגע: {value})",{value:h(p)})}`:null)}</select></sw-field></div>
        ${_.map(f=>o`<div class="grp" data-dd-dial-group-row=${`${e}:${f}`}><span>${L[f]}</span>
            <sw-field><select data-dd-dial-group=${`${e}:${s}:${f}`} aria-label=${`${L[f]}: ${r}`} ?disabled=${l} @change=${I=>A(f,I.target.value)}>${v(n[f]??null,$)}</select></sw-field></div>`)}
      </fieldset>`}async savePhoneInstallation(e){this.scope="phone",this.busy=!0,this.error="";try{const s=await z({"ui.dd_phone":e});E(),W(s.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(s){this.error=m(s)}finally{this.busy=!1}}async savePhoneOwn(e){this.scope="phone",this.busy=!0,this.error="";try{await Qe(e),this.flash(t("ההעדפה נשמרה"))}catch(s){this.error=m(s)}finally{this.busy=!1}}async savePickerInstallation(e){this.scope="picker",this.busy=!0,this.error="";try{const s=await z(e);E(),W(s.settings),this.flash(t("ברירת המחדל נשמרה"))}catch(s){this.error=m(s)}finally{this.busy=!1}}async savePlaceInstallation(e){this.scope="place",this.busy=!0,this.error="";try{const s=await z({"ui.dd_place":e});E(),W(s.settings),this.flash(Z().saved)}catch(s){this.error=m(s)}finally{this.busy=!1}}async savePlaceOwn(e){this.scope="place",this.busy=!0,this.error="";try{await es(e),this.flash(Z().savedOwn)}catch(s){this.error=m(s)}finally{this.busy=!1}}async saveSettingsNav(e){this.scope="settings-nav",this.busy=!0,this.error="";try{await ss(e),this.snOwn=j(),this.flash(Re().saved)}catch(s){this.error=m(s)}finally{this.busy=!1}}renderSettingsNavCard(){const e=Re(),s=this.snOwn??"tabs";return o`<sw-card heading=${e.title} data-settings-nav-card>
      <fieldset data-settings-nav-own>
        <legend class="sr">${e.title}</legend>
        <div class="tiles">${ts.map(i=>o`<label class="opt"><input type="radio" name="settings-nav-own" value=${i} data-settings-nav=${i} .checked=${s===i} ?disabled=${this.busy} @change=${()=>void this.saveSettingsNav(i)} /><span class="t">${e.options[i]}</span></label>`)}</div>
      </fieldset>
      ${this.status("settings-nav")}
    </sw-card>`}renderPlaceCard(e){const s=Z();return o`<sw-card heading=${s.title} subheading=${s.sub} data-dd-place-card>
      <div class="grid">
        <div data-dd-place-installation>
          <fieldset>${this.colhead("inst",!0,s.inst)}
            ${xe.map(i=>o`<label class="opt"><input type="radio" name="dd-place-inst" value=${i} data-dd-place=${`inst:${i}`} .checked=${this.plInst===i} ?disabled=${e} @change=${()=>void this.savePlaceInstallation(i)} /><span class="t">${s.places[i]}</span></label>`)}
          </fieldset>
        </div>
        <div data-dd-place-own>
          <fieldset>${this.colhead("own",!0,s.own)}
            <label class="opt"><input type="radio" name="dd-place-own" value="" data-dd-place="own:follow" .checked=${this.plOwn===null} ?disabled=${this.busy} @change=${()=>void this.savePlaceOwn(null)} /><span class="t">${s.follow.replace("{v}",s.places[this.plInst])}</span></label>
            ${xe.map(i=>o`<label class="opt"><input type="radio" name="dd-place-own" value=${i} data-dd-place=${`own:${i}`} .checked=${this.plOwn===i} ?disabled=${this.busy} @change=${()=>void this.savePlaceOwn(as(i))} /><span class="t">${s.places[i]}</span></label>`)}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-place-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>${s.active}</strong> ${s.places[this.plOwn??this.plInst]}</span></div>
      ${this.status("place")}
    </sw-card>`}async savePickerOwn(e){this.scope="picker",this.busy=!0,this.error="";try{await e(),this.flash(t("ההעדפה נשמרה"))}catch(s){this.error=m(s)}finally{this.busy=!1}}choiceRadios(e,s,i,n,l,d,u,h){const c=(p,$,r,v)=>e==="picker"?o`<input type="radio" name=${`dd-picker-${s}`} value=${p} data-dd-picker=${$} .checked=${r} ?disabled=${u} @change=${v} />`:o`<input type="radio" name=${`dd-search-${s}`} value=${p} data-dd-search=${$} .checked=${r} ?disabled=${u} @change=${v} />`;return o`${s==="own"?o`<label class="opt">${c("","own:follow",l===null,()=>h(null))}<span class="t">${t("לפי ההתקנה (כרגע: {value})",{value:n[d]})}</span></label>`:y}
    ${i.map(p=>o`<label class="opt">${c(p,`${s}:${p}`,l===p,()=>h(p))}<span class="t">${n[p]}</span></label>`)}`}ddWithGroup(e,s,i){const n={...e},l=K(i);return l?n[s]=l:delete n[s],n}ddSelects(e,s,i,n,l,d){const u=e==="inst"?t("לפי ברירת המחדל הכללית"):t("לפי ההתקנה"),h=(c,p)=>o`${p?o`<option value="" ?selected=${!c}>${p}</option>`:y}${We.map($=>o`<option value=${$} ?selected=${c===$}>${G[$]}</option>`)}`;return o`<fieldset><legend>${t("סגנון התפריט הנפתח")}</legend>
        <div class="grp all"><span>${t("לכל הקבוצות")}</span>
          <sw-field><select data-dd-global=${e} aria-label=${t("סגנון תפריט נפתח: לכל הקבוצות")} ?disabled=${n} @change=${c=>l(c.target.value)}>${h(s,e==="own"?`${u} ${t("(כרגע: {value})",{value:G[this.ddInst.style]})}`:null)}</select></sw-field></div>
      ${_.map(c=>o`<div class="grp" data-dd-group-row=${c}><span>${L[c]}</span>
          <sw-field><select data-dd-group=${`${e}:${c}`} aria-label=${`${L[c]}: ${t("סגנון תפריט נפתח")}`} ?disabled=${n} @change=${p=>d(c,p.target.value)}>${h(i[c]??null,u)}</select></sw-field></div>`)}</fieldset>`}async saveOwn(e,s){this.scope="style",this.busy=!0,this.error="";try{await is(e,s),this.flash(t("ההעדפה נשמרה"))}catch(i){this.error=m(i)}finally{this.busy=!1}}withGroup(e,s,i){const n={...e},l=gs(i);return l?n[s]=l:delete n[s],n}modeRadios(e,s,i,n,l){return o`${i?o`<label class="opt"><input type="radio" name=${e} value="" data-mode-follow .checked=${s===null} ?disabled=${n} @change=${()=>l(null)} /><span class="t">${i}</span></label>`:y}
    ${ke.map(d=>o`<label class="opt"><input type="radio" name=${e} value=${d} data-mode=${d} .checked=${s===d} ?disabled=${n} @change=${()=>l(d)} /><span class="t">${R[d]}<span class="muted">${ns[d]}</span></span></label>`)}`}groupSelects(e,s,i,n){const l=e==="inst"?t("לפי ברירת המחדל הכללית"):t("לפי ההתקנה");return _.map(d=>o`<div class="grp" data-group-row=${d}><span>${L[d]}</span>
        <sw-field><select data-group=${`${e}:${d}`} aria-label=${`${L[d]}: ${t("תצוגת לשוניות")}`} ?disabled=${i} @change=${u=>n(d,u.target.value)}>
          <option value="" ?selected=${!s[d]}>${l}</option>
          ${ke.map(u=>o`<option value=${u} ?selected=${s[d]===u}>${R[u]}</option>`)}
        </select></sw-field></div>`)}render(){const e=T(),s=this.own.mode??this.inst.mode,i=!this.canEdit||this.busy||!e,n=this.busy,l=this.ddOwn.style??this.ddInst.style,d=!this.canEdit||this.busy||!e,u=this.szOwn.size??this.szInst.size,h=this.ringOwn.ring??this.ringInst.ring,c=this.panelOwn.panel??this.panelInst.panel,p=o`<sw-icon name="refresh" size=${15}></sw-icon>`,$=[this.ddOwn.style||Object.keys(this.ddOwn.groups).length?o`<button type="button" class="reset" data-dd-own-reset ?disabled=${this.busy} @click=${()=>void this.saveDdOwn(null,{})}>${p}${t("אפס את ההעדפות שלי")}</button>`:null,this.szOwn.size||Object.keys(this.szOwn.groups).length?o`<button type="button" class="reset" data-dd-size-own-reset ?disabled=${this.busy} @click=${()=>void this.saveSizeOwn(null,{})}>${p}${t("אפס את הגדלים שלי")}</button>`:null,this.ringOwn.ring||Object.keys(this.ringOwn.groups).length?o`<button type="button" class="reset" data-dd-ring-own-reset ?disabled=${this.busy} @click=${()=>void this.saveDialOwn("ring",null,{})}>${p}${t("אפס את עובי הטבעת שלי")}</button>`:null,this.panelOwn.panel||Object.keys(this.panelOwn.groups).length?o`<button type="button" class="reset" data-dd-panel-own-reset ?disabled=${this.busy} @click=${()=>void this.saveDialOwn("panel",null,{})}>${p}${t("אפס את רוחב התפריט שלי")}</button>`:null].filter(r=>r!==null);return o`<sw-card heading=${t("תצוגת לשוניות")} subheading=${t("לשוניות, משולב או תפריטים נפתחים, לכל הקבוצות או לכל קבוצה בנפרד. הניווט הראשי אינו חלק מזה")} data-tabs-mode>
      <div class="grid">
        <div data-tabs-mode-installation>
          ${this.colhead("inst")}
          <fieldset><legend>${t("לכל הקבוצות")}</legend>
            ${this.modeRadios("inst-mode",this.inst.mode,null,i,r=>r&&void this.saveInstallation(r,this.inst.groups))}
          </fieldset>
          <fieldset><legend>${t("לפי קבוצה")}</legend>${this.groupSelects("inst",this.inst.groups,i,(r,v)=>void this.saveInstallation(this.inst.mode,this.withGroup(this.inst.groups,r,v)))}</fieldset>
        </div>
        <div data-tabs-mode-own>
          ${this.colhead("own")}
          <fieldset><legend>${t("לכל הקבוצות")}</legend>
            ${this.modeRadios("own-mode",this.own.mode,t("לפי ההתקנה (כרגע: {value})",{value:R[this.inst.mode]}),n,r=>void this.saveOwn(r,this.own.groups))}
          </fieldset>
          <fieldset><legend>${t("לפי קבוצה")}</legend>${this.groupSelects("own",this.own.groups,n,(r,v)=>void this.saveOwn(this.own.mode,this.withGroup(this.own.groups,r,v)))}</fieldset>
        </div>
      </div>
      <div class="effective" data-tabs-mode-effective>
        <strong>${t("מה פעיל אצלי עכשיו")}</strong>
        <ul>${_.map(r=>{const v=rs(r);return o`<li data-effective-group=${r} data-mode=${v.mode} data-source=${v.source}><span>${L[r]}</span><span>${R[v.mode]}<span class="src">${Te[v.source]}</span></span></li>`})}</ul>
        ${this.own.mode||Object.keys(this.own.groups).length?o`<div class="resets"><button type="button" class="reset" data-own-reset ?disabled=${this.busy} @click=${()=>void this.saveOwn(null,{})}><sw-icon name="refresh" size=${15}></sw-icon>${t("אפס את ההעדפות שלי")}</button></div>`:y}
      </div>
      <div class="preview" data-tabs-mode-preview=${s} aria-label=${t("תצוגה מקדימה")}>
        <p class="ph">${t("תצוגה מקדימה: {mode}",{mode:R[s]})}</p>
        <sw-tabs .items=${Ae} active="a" .variant=${s==="dropdown"?"dropdown":"pill"} ?adaptive=${s==="hybrid"} dd-style=${l} dd-size=${u} dd-ring=${h} dd-panel=${c} group-label=${t("דוגמה: שלוש אפשרויות")} data-preview="3"></sw-tabs>
        <sw-tabs .items=${J} active="a" .variant=${s==="dropdown"?"dropdown":"pill"} ?adaptive=${s==="hybrid"} dd-style=${l} dd-size=${u} dd-ring=${h} dd-panel=${c} group-label=${t("דוגמה: שש אפשרויות")} data-preview="6"></sw-tabs>
        ${s==="dropdown"?o`<div class="pair" data-preview="pair"><sw-tabs block variant="dropdown" dd-style=${l} dd-size=${u} dd-ring=${h} dd-panel=${c} .items=${Ae} active="a" group-label=${t("דוגמה: רמה ראשונה")}></sw-tabs><sw-tabs block variant="dropdown" dd-style=${l} dd-size=${u} dd-ring=${h} dd-panel=${c} .items=${J} active="a" group-label=${t("דוגמה: רמה שנייה")}></sw-tabs></div>`:y}
      </div>
    </sw-card>
    <sw-card heading=${t("סגנון תפריט נפתח")} subheading=${t("המראה של תפריט נפתח, לכל הקבוצות או לכל קבוצה בנפרד")} data-dd-style-card>
      <div class="grid">
        <div data-dd-style-installation>
          ${this.colhead("inst")}
          ${this.ddSelects("inst",this.ddInst.style,this.ddInst.groups,d,r=>{const v=K(r);v&&this.saveDdInstallation(v,this.ddInst.groups)},(r,v)=>void this.saveDdInstallation(this.ddInst.style,this.ddWithGroup(this.ddInst.groups,r,v)))}
          ${this.sizeSelects("inst",this.szInst.size,this.szInst.groups,d,r=>{const v=V(r);v&&this.saveSizeInstallation(v,this.szInst.groups)},(r,v)=>void this.saveSizeInstallation(this.szInst.size,this.sizeWithGroup(this.szInst.groups,r,v)))}
          ${this.dialSelects("ring","inst",this.ringInst.ring,this.ringInst.groups,d)}
          ${this.dialSelects("panel","inst",this.panelInst.panel,this.panelInst.groups,d)}
        </div>
        <div data-dd-style-own>
          ${this.colhead("own")}
          ${this.ddSelects("own",this.ddOwn.style,this.ddOwn.groups,this.busy,r=>void this.saveDdOwn(K(r),this.ddOwn.groups),(r,v)=>void this.saveDdOwn(this.ddOwn.style,this.ddWithGroup(this.ddOwn.groups,r,v)))}
          ${this.sizeSelects("own",this.szOwn.size,this.szOwn.groups,this.busy,r=>void this.saveSizeOwn(V(r),this.szOwn.groups),(r,v)=>void this.saveSizeOwn(this.szOwn.size,this.sizeWithGroup(this.szOwn.groups,r,v)))}
          ${this.dialSelects("ring","own",this.ringOwn.ring,this.ringOwn.groups,this.busy)}
          ${this.dialSelects("panel","own",this.panelOwn.panel,this.panelOwn.groups,this.busy)}
        </div>
      </div>
      <div class="effective" data-dd-style-effective>
        <strong>${t("מה פעיל אצלי עכשיו")}</strong>
        <ul>${_.map(r=>{const v=ls(r),S=os(r),A=ds(r),f=cs(r);return o`<li data-dd-effective-group=${r} data-dd-style=${v.style} data-dd-size=${S.size} data-dd-size-source=${S.source} data-dd-ring=${A.ring} data-dd-panel=${f.panel} data-source=${v.source}><span>${L[r]}</span><span>${G[v.style]}, ${C[S.size]}${v.style==="capsule"?o`, ${Se[A.ring]}, ${Le[f.panel]}`:y}<span class="src">${Te[v.source]}</span></span></li>`})}</ul>
        ${$.length?o`<div class="resets">${$}</div>`:y}
      </div>
      <p class="ph">${t("כל הסגנונות, בגודל הפעיל")}</p>
      <div class="styles" data-dd-style-previews>${We.map(r=>o`<div data-dd-preview=${r} class=${r===l?"on":""}><span class="cap"><span class="muted">${G[r]}</span>${r===l?o`<span class="badge">${t("הפעיל")}</span>`:y}</span><sw-tabs variant="dropdown" dd-style=${r} dd-size=${u} dd-ring=${h} dd-panel=${c} .items=${J} active="a" group-label=${t("אבטחה")}></sw-tabs></div>`)}</div>
      <p class="ph">${t("שלושת הגדלים, בסגנון קפסולה")}</p>
      <div class="styles" data-dd-size-previews>${Oe.map(r=>o`<div data-dd-size-preview=${r} class=${r===u?"on":""}><span class="cap"><span class="muted">${C[r]}</span>${r===u?o`<span class="badge">${t("הפעיל")}</span>`:y}</span><sw-tabs variant="dropdown" dd-style="capsule" dd-size=${r} dd-ring=${h} dd-panel=${c} .items=${zs} active="all" group-label=${t("קומה")}></sw-tabs></div>`)}</div>
      ${this.status("style")}
    </sw-card>
    <sw-card heading=${t("תפריט נפתח בטלפון")} subheading=${t("איך נפתחת רשימה של תפריט נפתח במסך צר")} data-dd-phone-card>
      <div class="grid">
        <div data-dd-phone-installation>
          <fieldset>${this.colhead("inst",!0)}
            ${ze.map(r=>o`<label class="opt"><input type="radio" name="dd-phone-inst" value=${r} data-dd-phone=${`inst:${r}`} .checked=${this.phInst===r} ?disabled=${d} @change=${()=>void this.savePhoneInstallation(r)} /><span class="t">${M[r]}</span></label>`)}
          </fieldset>
        </div>
        <div data-dd-phone-own>
          <fieldset>${this.colhead("own",!0)}
            <label class="opt"><input type="radio" name="dd-phone-own" value="" data-dd-phone="own:follow" .checked=${this.phOwn===null} ?disabled=${this.busy} @change=${()=>void this.savePhoneOwn(null)} /><span class="t">${t("לפי ההתקנה (כרגע: {value})",{value:M[this.phInst]})}</span></label>
            ${ze.map(r=>o`<label class="opt"><input type="radio" name="dd-phone-own" value=${r} data-dd-phone=${`own:${r}`} .checked=${this.phOwn===r} ?disabled=${this.busy} @change=${()=>void this.savePhoneOwn(hs(r))} /><span class="t">${M[r]}</span></label>`)}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-phone-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>${t("מה פעיל אצלי עכשיו:")}</strong> ${M[this.phOwn??this.phInst]}</span></div>
      ${this.status("phone")}
    </sw-card>
    <sw-card heading=${t("בחירת מצלמות להשוואה")} subheading=${t("מסך ההקלטות והניגון המסונכרן")} data-dd-picker-card>
      <div class="grid">
        <div data-dd-picker-installation>
          <fieldset>${this.colhead("inst",!0)}
            <div class="sub">${t("תצוגה")}</div>
            ${this.choiceRadios("picker","inst",Ee,U,this.pkInst,this.pkInst,d,r=>r&&void this.savePickerInstallation({"ui.dd_picker":r}))}
            <div class="sub">${t("חיפוש ברשימת המצלמות")}</div>
            ${this.choiceRadios("search","inst",Ie,Y,this.seInst,this.seInst,d,r=>r&&void this.savePickerInstallation({"ui.dd_search":r}))}
          </fieldset>
        </div>
        <div data-dd-picker-own>
          <fieldset>${this.colhead("own",!0)}
            <div class="sub">${t("תצוגה")}</div>
            ${this.choiceRadios("picker","own",Ee,U,this.pkOwn,this.pkInst,this.busy,r=>void this.savePickerOwn(()=>ps(us(r))))}
            <div class="sub">${t("חיפוש ברשימת המצלמות")}</div>
            ${this.choiceRadios("search","own",Ie,Y,this.seOwn,this.seInst,this.busy,r=>void this.savePickerOwn(()=>ws(vs(r))))}
          </fieldset>
        </div>
      </div>
      <div class="effective line" data-dd-picker-effective><sw-icon name="check" size=${16}></sw-icon><span><strong>${t("מה פעיל אצלי עכשיו:")}</strong> ${U[this.pkOwn??this.pkInst]}, ${t("חיפוש {value}",{value:Y[this.seOwn??this.seInst]})}</span></div>
      ${this.status("picker")}
    </sw-card>${this.renderPlaceCard(d)}${this.renderSettingsNavCard()}`}};b.styles=[Ge`
    /* TABSMODE-POLISH-2331: the display cards follow the settings ladder (R5-SYSTEM-297 / HOMEFABLE): card > owner well > choice.
       The cards of this element are siblings inside ONE host, so the host spaces them itself (they used to touch). */
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      min-inline-size: 0;
    }
    fieldset {
      margin: 0;
      padding: 0;
      border: 0;
      min-inline-size: 0;
    }
    legend {
      padding: 0;
      margin-block-end: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    /* the two owners side by side, each a well; one column on a phone */
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--sw-s-3);
      margin-block-end: var(--sw-s-3);
    }
    .grid > div {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-4);
      min-inline-size: 0;
      padding: 14px 16px 16px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    @media (max-width: 767px) {
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .grid > div {
        padding: 12px;
      }
    }
    /* the owner of a column: whose value it is and who may change it */
    .colhead {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0;
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
      letter-spacing: -0.005em;
    }
    legend.colhead {
      margin-block-end: var(--sw-s-3);
    }
    .colhead .who {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-2);
      line-height: 1.45;
      letter-spacing: 0;
    }
    .colhead .who sw-icon {
      flex: none;
      color: var(--sw-text-3);
    }
    /* a choice is a tile on the well: the checked one carries the accent, the rest stay quiet */
    .opt {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      min-block-size: 44px;
      padding: 10px 12px;
      box-sizing: border-box;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font-size: var(--sw-fs-base);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .opt + .opt {
      margin-block-start: 6px;
    }
    .opt:has(input:checked) {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      font-weight: var(--sw-fw-semibold);
    }
    .opt:has(input:focus-visible) {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .opt:active:not(:has(input:disabled)) {
      transform: scale(var(--sw-press-scale));
    }
    .opt:has(input:disabled) {
      cursor: default;
    }
    .opt:has(input:disabled:not(:checked)) {
      opacity: var(--sw-disabled-opacity);
    }
    @media (hover: hover) and (pointer: fine) {
      .opt:hover:not(:has(input:disabled)):not(:has(input:checked)) {
        border-color: var(--sw-border-strong);
        background: color-mix(in srgb, var(--sw-surface) 70%, var(--sw-hover-wash));
      }
    }
    .opt input {
      margin: 2px 0 0;
      inline-size: 18px;
      block-size: 18px;
      accent-color: var(--sw-accent);
      flex: none;
    }
    .opt .t {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .opt .t .muted {
      font-weight: var(--sw-fw-regular);
    }
    /* short choices (the settings navigation) sit side by side on a wide screen */
    .tiles {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr));
      gap: 6px;
    }
    .tiles .opt + .opt {
      margin-block-start: 0;
    }
    .muted {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    /* 2.0.2: a sub-heading inside a fieldset with two radio groups (the camera picker card) */
    .sub {
      margin: var(--sw-s-4) 0 var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    legend + .sub {
      margin-block-start: 0;
    }
    /* a value per group: the label at the start, the select at the end; the "all groups" row leads, the groups follow */
    .grp {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      min-block-size: 48px;
      padding-block: 4px;
      font-size: var(--sw-fs-base);
      color: var(--sw-text);
    }
    .grp + .grp {
      border-block-start: 1px solid var(--sw-border);
    }
    .grp.all {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .grp > span {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }
    /* CR-CMP2-SELECTS-2450 (owner N10): every select sits in sw-field (the shared field: look, focus, hover, disabled, the 44 px phone
       target); the row only places it */
    .grp > sw-field {
      flex: 0 1 240px;
      min-inline-size: 0;
      max-inline-size: 60%;
    }
    sw-field > select {
      text-overflow: ellipsis;
    }
    /* "what is active for me now": a fact list - the group at the start, the value and where it comes from at the end */
    .effective {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      margin-block-end: var(--sw-s-3);
    }
    .effective > strong {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .effective ul {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .effective li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px var(--sw-s-3);
      min-block-size: 40px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
      font-size: var(--sw-fs-base);
    }
    .effective li:last-child {
      border-block-end: 0;
    }
    .effective li > span:last-child {
      display: inline-flex;
      align-items: center;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 6px;
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
      text-align: end;
    }
    .effective .src {
      display: inline-flex;
      align-items: center;
      min-block-size: 22px;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    /* the one-line summary of a card with one global value */
    .effective.line {
      flex-direction: row;
      align-items: center;
      gap: var(--sw-s-2);
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-heading, var(--sw-text));
      font-size: var(--sw-fs-base);
    }
    .effective.line sw-icon {
      flex: none;
      color: var(--sw-accent-text);
    }
    .resets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--sw-s-2);
    }
    .reset {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 40px;
      padding: 0 14px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: transparent;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .reset:active:not(:disabled) {
      transform: scale(var(--sw-press-scale));
    }
    .reset:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    .reset:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    @media (hover: hover) and (pointer: fine) {
      .reset:hover:not(:disabled) {
        background: var(--sw-hover-wash);
      }
    }
    @media (pointer: coarse) {
      .reset,
      sw-field > select {
        min-block-size: 44px;
      }
    }
    /* the live sample of the effective mode */
    .preview {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-3);
      padding: 14px 16px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      min-inline-size: 0;
    }
    .ph {
      margin: 0;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .styles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 190px), 1fr));
      gap: var(--sw-s-2);
      margin-block: var(--sw-s-2) var(--sw-s-4);
    }
    .styles > div {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-2);
      min-inline-size: 0;
      padding: 10px 12px 12px;
      border: 1px solid transparent;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
    }
    .styles > div.on {
      border-color: var(--sw-accent);
    }
    .styles .cap {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-block-size: 22px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      min-block-size: 20px;
      padding: 0 8px;
      border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .pair {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    /* the saved / error line: a pill with an icon in a reserved slot, so the card does not jump when it appears */
    .status {
      display: flex;
      align-items: center;
      min-block-size: 28px;
    }
    .msg {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 28px;
      padding: 2px 12px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      max-inline-size: 100%;
      overflow-wrap: anywhere;
    }
    .msg sw-icon {
      flex: none;
    }
    .ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    ${Ve}
    @media (prefers-reduced-motion: reduce) {
      .opt,
      .reset {
        transition-duration: 0ms;
      }
    }
    /* the bubble skin is frozen (unit-bubble-freeze-295): its owner columns keep the flat list, no wells */
    :host([data-skin='bubble']) .grid > div,
    :host([data-skin='bubble']) .preview,
    :host([data-skin='bubble']) .styles > div {
      padding: 0;
      background: transparent;
    }
  `,Ce];g([w()],b.prototype,"inst",2);g([w()],b.prototype,"own",2);g([w()],b.prototype,"ddInst",2);g([w()],b.prototype,"ddOwn",2);g([w()],b.prototype,"szInst",2);g([w()],b.prototype,"szOwn",2);g([w()],b.prototype,"ringInst",2);g([w()],b.prototype,"ringOwn",2);g([w()],b.prototype,"panelInst",2);g([w()],b.prototype,"panelOwn",2);g([w()],b.prototype,"phInst",2);g([w()],b.prototype,"phOwn",2);g([w()],b.prototype,"pkInst",2);g([w()],b.prototype,"pkOwn",2);g([w()],b.prototype,"seInst",2);g([w()],b.prototype,"seOwn",2);g([w()],b.prototype,"plInst",2);g([w()],b.prototype,"plOwn",2);g([w()],b.prototype,"snOwn",2);g([w()],b.prototype,"canEdit",2);g([w()],b.prototype,"busy",2);g([w()],b.prototype,"scope",2);g([w()],b.prototype,"error",2);b=g([Ne("system-tabs-mode")],b);const se={areasLabel:a.he.areasLabel,areasWhere:a.he.areasWhere,devicesLabel:a.he.devicesLabel,devicesWhere:a.he.devicesWhere,securityLabel:a.he.securityLabel,securityWhere:a.he.securityWhere,securityLiveLabel:a.he.securityLiveLabel,securityLiveWhere:a.he.securityLiveWhere,securityInvestigateLabel:a.he.securityInvestigateLabel,securityInvestigateWhere:a.he.securityInvestigateWhere,exploreLabel:a.he.exploreLabel,exploreWhere:a.he.exploreWhere,multimediaLabel:a.he.multimediaLabel,multimediaWhere:a.he.multimediaWhere,wiskeyLabel:a.he.wiskeyLabel,wiskeyWhere:a.he.wiskeyWhere,infraLabel:a.he.infraLabel,infraWhere:a.he.infraWhere,infraElectricityLabel:a.he.infraElectricityLabel,infraElectricityWhere:a.he.infraElectricityWhere,infraGeneratorLabel:a.he.infraGeneratorLabel,infraGeneratorWhere:a.he.infraGeneratorWhere,infraWaterLabel:a.he.infraWaterLabel,infraWaterWhere:a.he.infraWaterWhere,ticketsWhere:a.he.ticketsWhere,ticketsSectionLabel:a.he.ticketsSectionLabel,ticketsSectionWhere:a.he.ticketsSectionWhere,ticketsScopesLabel:a.he.ticketsScopesLabel,ticketsScopesWhere:a.he.ticketsScopesWhere,ticketsSingleRowLabel:"שורת המקטעים למי שרואה מקטע אחד",ticketsSingleRowHint:"שורת הדפים של המקטע מוצגת בכל מקרה",ticketsSingleRowHide:"הסתרה (ברירת מחדל)",ticketsSingleRowShow:"הצגה תמיד",systemLabel:a.he.systemLabel,systemWhere:a.he.systemWhere,systemSecurityLabel:a.he.systemSecurityLabel,systemSecurityWhere:a.he.systemSecurityWhere,noteOffered:"לשונית מוצגת רק כשיש במערכת פריטים מסוגה; עד אז היא שומרת את המקום שנקבע לה.",level1Hint:"הסרגל הראשון של כל אזור",level2Hint:"הדפים של לייב, חקירה ותשתיות, ואבטחה בהגדרות"},je=Q(ee("en","i18n/tab-sections","en"),{areasLabel:a.en.areasLabel,areasWhere:a.en.areasWhere,devicesLabel:a.en.devicesLabel,devicesWhere:a.en.devicesWhere,securityLabel:a.en.securityLabel,securityWhere:a.en.securityWhere,securityLiveLabel:a.en.securityLiveLabel,securityLiveWhere:a.en.securityLiveWhere,securityInvestigateLabel:a.en.securityInvestigateLabel,securityInvestigateWhere:a.en.securityInvestigateWhere,exploreLabel:a.en.exploreLabel,exploreWhere:a.en.exploreWhere,multimediaLabel:a.en.multimediaLabel,multimediaWhere:a.en.multimediaWhere,wiskeyLabel:a.en.wiskeyLabel,wiskeyWhere:a.en.wiskeyWhere,infraLabel:a.en.infraLabel,infraWhere:a.en.infraWhere,infraElectricityLabel:a.en.infraElectricityLabel,infraElectricityWhere:a.en.infraElectricityWhere,infraGeneratorLabel:a.en.infraGeneratorLabel,infraGeneratorWhere:a.en.infraGeneratorWhere,infraWaterLabel:a.en.infraWaterLabel,infraWaterWhere:a.en.infraWaterWhere,ticketsWhere:a.en.ticketsWhere,ticketsSectionLabel:a.en.ticketsSectionLabel,ticketsSectionWhere:a.en.ticketsSectionWhere,ticketsScopesLabel:a.en.ticketsScopesLabel,ticketsScopesWhere:a.en.ticketsScopesWhere,systemLabel:a.en.systemLabel,systemWhere:a.en.systemWhere,systemSecurityLabel:a.en.systemSecurityLabel,systemSecurityWhere:a.en.systemSecurityWhere}),Ue=Q(ee("ar","i18n/tab-sections","ar"),{areasLabel:a.ar.areasLabel,areasWhere:a.ar.areasWhere,devicesLabel:a.ar.devicesLabel,devicesWhere:a.ar.devicesWhere,securityLabel:a.ar.securityLabel,securityWhere:a.ar.securityWhere,securityLiveLabel:a.ar.securityLiveLabel,securityLiveWhere:a.ar.securityLiveWhere,securityInvestigateLabel:a.ar.securityInvestigateLabel,securityInvestigateWhere:a.ar.securityInvestigateWhere,exploreLabel:a.ar.exploreLabel,exploreWhere:a.ar.exploreWhere,multimediaLabel:a.ar.multimediaLabel,multimediaWhere:a.ar.multimediaWhere,wiskeyLabel:a.ar.wiskeyLabel,wiskeyWhere:a.ar.wiskeyWhere,infraLabel:a.ar.infraLabel,infraWhere:a.ar.infraWhere,infraElectricityLabel:a.ar.infraElectricityLabel,infraElectricityWhere:a.ar.infraElectricityWhere,infraGeneratorLabel:a.ar.infraGeneratorLabel,infraGeneratorWhere:a.ar.infraGeneratorWhere,infraWaterLabel:a.ar.infraWaterLabel,infraWaterWhere:a.ar.infraWaterWhere,ticketsWhere:a.ar.ticketsWhere,ticketsSectionLabel:a.ar.ticketsSectionLabel,ticketsSectionWhere:a.ar.ticketsSectionWhere,ticketsScopesLabel:a.ar.ticketsScopesLabel,ticketsScopesWhere:a.ar.ticketsScopesWhere,systemLabel:a.ar.systemLabel,systemWhere:a.ar.systemWhere,systemSecurityLabel:a.ar.systemSecurityLabel,systemSecurityWhere:a.ar.systemSecurityWhere}),Ke=Q(ee("ru","i18n/tab-sections","ru"),{areasLabel:a.ru.areasLabel,areasWhere:a.ru.areasWhere,devicesLabel:a.ru.devicesLabel,devicesWhere:a.ru.devicesWhere,securityLabel:a.ru.securityLabel,securityWhere:a.ru.securityWhere,securityLiveLabel:a.ru.securityLiveLabel,securityLiveWhere:a.ru.securityLiveWhere,securityInvestigateLabel:a.ru.securityInvestigateLabel,securityInvestigateWhere:a.ru.securityInvestigateWhere,exploreLabel:a.ru.exploreLabel,exploreWhere:a.ru.exploreWhere,multimediaLabel:a.ru.multimediaLabel,multimediaWhere:a.ru.multimediaWhere,wiskeyLabel:a.ru.wiskeyLabel,wiskeyWhere:a.ru.wiskeyWhere,infraLabel:a.ru.infraLabel,infraWhere:a.ru.infraWhere,infraElectricityLabel:a.ru.infraElectricityLabel,infraElectricityWhere:a.ru.infraElectricityWhere,infraGeneratorLabel:a.ru.infraGeneratorLabel,infraGeneratorWhere:a.ru.infraGeneratorWhere,infraWaterLabel:a.ru.infraWaterLabel,infraWaterWhere:a.ru.infraWaterWhere,ticketsWhere:a.ru.ticketsWhere,ticketsSectionLabel:a.ru.ticketsSectionLabel,ticketsSectionWhere:a.ru.ticketsSectionWhere,ticketsScopesLabel:a.ru.ticketsScopesLabel,ticketsScopesWhere:a.ru.ticketsScopesWhere,systemLabel:a.ru.systemLabel,systemWhere:a.ru.systemWhere,systemSecurityLabel:a.ru.systemSecurityLabel,systemSecurityWhere:a.ru.systemSecurityWhere});function Es(){return ys(["en","ar","ru"])}const Is={he:se,en:je,ar:Ue,ru:Ke},Ds=["ar","ru"];function O(e,s,i=Es()){const n=Is[i][e]??se[e]??e;return $s(n,s)}X("i18n/tab-sections",{he:se,en:je,ar:Ue,ru:Ke},Ds);var _s=Object.defineProperty,Ps=Object.getOwnPropertyDescriptor,k=(e,s,i,n)=>{for(var l=n>1?void 0:n?Ps(s,i):s,d=e.length-1,u;d>=0;d--)(u=e[d])&&(l=(n?u(s,i,l):u(l))||l);return n&&l&&_s(s,i,l),l};const H={pill:t("כמוסבה"),underline:t("פס תחתון"),"underline-compact":t("פס תחתון קומפקטי")},Rs={1:["pill","underline"],2:["underline-compact","underline","pill"]},P={1:"level1",2:"level2"},Ts=[{id:"a",label:t("ראשון")},{id:"b",label:t("שני")},{id:"c",label:t("שלישי")}];let x=class extends Me{constructor(){super(...arguments),this.bubbleSkin=new He(this),this.saved={},this.draft={},this.savedStyles={},this.draftStyles={},this.savedSectionRow="hide_single",this.draftSectionRow="hide_single",this.canEdit=!1,this.loaded=!1,this.busy=!1,this.message="",this.error="",this.loadError="",this.announce="",this.dragging=null,this.onWindowMove=e=>{const s=this.dragging,i=s?De.find(l=>l.id===s.section):void 0;if(!s||!i)return;let n=0;for(const l of this.renderRoot.querySelectorAll(`li[data-sec="${s.section}"]`)){if(l.dataset.tab===s.id)continue;const d=l.getBoundingClientRect();e.clientY>d.top+d.height/2&&(n+=1)}n!==this.orderedIds(i).indexOf(s.id)&&this.move(i,s.id,n)},this.onWindowUp=()=>{this.dragging=null,this.stopDrag()}}connectedCallback(){super.connectedCallback(),this.load()}disconnectedCallback(){this.stopDrag(),super.disconnectedCallback()}async load(){if(!T()){this.loaded=!0;return}try{const e=await Be();this.saved=_e(e.settings["ui.tabs"]),this.draft=structuredClone(this.saved),this.savedStyles=Pe(e.settings["ui.tabs"]),this.draftStyles={...this.savedStyles},this.savedSectionRow=q(e.settings["ui.tickets_section_row"]),this.draftSectionRow=this.savedSectionRow,this.canEdit=e.can_edit&&ms("system.configure"),this.error="",this.loadError=""}catch(e){this.loadError=m(e)}finally{this.loaded=!0}}orderedIds(e){const s=e.tabs().map(n=>n.id),i=(this.draft[e.id]?.order??[]).filter((n,l,d)=>s.includes(n)&&d.indexOf(n)===l);return[...i,...s.filter(n=>!i.includes(n))]}hiddenSet(e){return new Set((this.draft[e.id]?.hidden??[]).filter(s=>e.tabs().some(i=>i.id===s)))}isLocked(e,s){return(xs[e.id]??[]).includes(s)}commit(e,s,i){const n=e.tabs().map(p=>p.id),l=this.draft[e.id]??{order:[],hidden:[]},d=l.order.filter(p=>!n.includes(p)),u=l.hidden.filter(p=>!n.includes(p)),h=s.every((p,$)=>p===n[$]),c={...this.draft};h&&!i.size&&!d.length&&!u.length&&!l.style?delete c[e.id]:(c[e.id]={order:h&&!d.length?[]:[...s,...d],hidden:[...n.filter(p=>i.has(p)),...u]},l.style&&(c[e.id].style=l.style)),this.draft=c,this.message=""}setSectionStyle(e,s){const i={...this.draft},n=i[e.id]??{order:[],hidden:[]},{style:l,...d}=n;s?i[e.id]={...d,style:s}:d.order.length||d.hidden.length?i[e.id]=d:delete i[e.id],this.draft=i,this.message="",this.announce=s?`${e.label}: ${t("סגנון {style}",{style:H[s]})}`:`${e.label}: ${t("הסגנון לפי ברירת המחדל של הרמה")}`}setLevelStyle(e,s){const i={...this.draftStyles};s===F[P[e]]?delete i[P[e]]:i[P[e]]=s,this.draftStyles=i,this.message="",this.announce=`${t("רמה {n}",{n:e})}: ${t("סגנון {style}",{style:H[s]})}`}label(e,s){return e.tabs().find(i=>i.id===s)?.label??s}move(e,s,i,n=null){const l=this.orderedIds(e),d=l.indexOf(s),u=Math.max(0,Math.min(l.length-1,i));if(d<0||d===u)return;const h=[...l];h.splice(d,1),h.splice(u,0,s),this.commit(e,h,this.hiddenSet(e)),this.announce=t("{name} הועבר למקום {n} מתוך {total}",{name:this.label(e,s),n:u+1,total:h.length}),n&&this.updateComplete.then(()=>{const c=this.renderRoot.querySelector(`li[data-sec="${e.id}"][data-tab="${s}"]`),p=c?.querySelector(n==="handle"?".handle":`.mv[data-move="${n}"]`);(p&&p.getAttribute("aria-disabled")!=="true"?p:c?.querySelector(".handle"))?.focus()})}setVisible(e,s,i){const n=this.hiddenSet(e);i?n.delete(s):n.add(s),this.commit(e,this.orderedIds(e),n),this.announce=`${this.label(e,s)} ${i?t("מוצגת"):t("מוסתרת")}`}resetSection(e){const s={...this.draft};delete s[e.id],this.draft=s,this.message="",this.announce=`${e.label}: ${t("ברירת המחדל שוחזרה")}`}get dirty(){const e=(s,i)=>JSON.stringify([Object.keys(s).sort().map(n=>[n,s[n].order,s[n].hidden,s[n].style??null]),i.level1??null,i.level2??null]);return e(this.draft,this.draftStyles)!==e(this.saved,this.savedStyles)||this.draftSectionRow!==this.savedSectionRow}payload(){const e=this.draftStyles;return e.level1||e.level2?{...this.draft,styles:e}:{...this.draft}}async save(){this.busy=!0,this.error="";try{const e=await z({"ui.tabs":this.payload(),...this.draftSectionRow!==this.savedSectionRow?{"ui.tickets_section_row":this.draftSectionRow}:{}});E(),ks(e.settings),this.saved=_e(e.settings["ui.tabs"]),this.draft=structuredClone(this.saved),this.savedStyles=Pe(e.settings["ui.tabs"]),this.draftStyles={...this.savedStyles},this.savedSectionRow=q(e.settings["ui.tickets_section_row"]),this.draftSectionRow=this.savedSectionRow,this.message=t("הלשוניות נשמרו"),window.setTimeout(()=>this.message="",2500)}catch(e){this.error=m(e)}finally{this.busy=!1}}discard(){this.draft=structuredClone(this.saved),this.draftStyles={...this.savedStyles},this.draftSectionRow=this.savedSectionRow,this.message="",this.error=""}onPointerDown(e,s,i){e.button!==0||!this.canEdit||(e.preventDefault(),this.dragging={section:s.id,id:i},window.addEventListener("pointermove",this.onWindowMove),window.addEventListener("pointerup",this.onWindowUp),window.addEventListener("pointercancel",this.onWindowUp))}stopDrag(){window.removeEventListener("pointermove",this.onWindowMove),window.removeEventListener("pointerup",this.onWindowUp),window.removeEventListener("pointercancel",this.onWindowUp)}onHandleKey(e,s,i){const n=this.orderedIds(s),l=n.indexOf(i),d=e.key==="ArrowUp"?l-1:e.key==="ArrowDown"?l+1:e.key==="Home"?0:e.key==="End"?n.length-1:null;d===null||!this.canEdit||(e.preventDefault(),this.move(s,i,d,"handle"))}renderStyleDefaults(){const e=(s,i,n)=>{const l=this.draftStyles[P[s]]??F[P[s]];return o`<div class="srow" data-style-level=${s}>
        <span class="lbl">${i}<span class="muted">${n}</span></span>
        <span class="ctl">
          <select data-style-default=${s} aria-label=${i} ?disabled=${!this.canEdit} @change=${d=>this.setLevelStyle(s,d.target.value)}>
            ${Rs[s].map(d=>o`<option value=${d} ?selected=${d===l}>${H[d]}${d===F[P[s]]?` ${t("(ברירת מחדל)")}`:""}</option>`)}
          </select>
          <sw-tabs class="preview" .items=${Ts} active="a" .variant=${l} data-style-preview=${s}></sw-tabs>
        </span>
      </div>`};return o`<sw-card heading=${t("סגנון סרגל")} subheading=${t("איך נראים סרגלי הלשוניות; אפשר לקבוע סגנון אחר לכל מקטע בכרטיס שלו")} data-tabs-styles>
      ${e(1,t("רמה 1: הסרגל הראשון של האזור"),O("level1Hint"))}
      ${e(2,t("רמה 2: תת־לשוניות"),O("level2Hint"))}
    </sw-card>`}renderSectionRowSetting(){const e=this.draftSectionRow;return o`<div class="srow" data-tickets-section-row>
      <span class="lbl">${O("ticketsSingleRowLabel")}<span class="muted">${O("ticketsSingleRowHint")}</span></span>
      <span class="ctl">
        <select data-tickets-section-row-select aria-label=${O("ticketsSingleRowLabel")} ?disabled=${!this.canEdit} @change=${s=>{this.draftSectionRow=q(s.target.value),this.message=""}}>
          <option value="hide_single" ?selected=${e==="hide_single"}>${O("ticketsSingleRowHide")}</option>
          <option value="always" ?selected=${e==="always"}>${O("ticketsSingleRowShow")}</option>
        </select>
      </span>
    </div>`}renderSection(e){const s=this.orderedIds(e),i=this.hiddenSet(e),n=s.filter(h=>!i.has(h)).length,l=s.length,d=!!this.draft[e.id],u=this.draft[e.id]?.style??"";return o`<sw-card heading=${e.label} subheading=${e.where} data-tabs-section=${e.id}>
      ${e.bar===!1?y:o`<div class="srow" data-style-row=${e.id}>
            <span class="lbl">${t("סגנון סרגל")}<span class="muted">${t("רמה {n}",{n:e.level})}</span></span>
            <span class="ctl">
              <select data-style-section=${e.id} aria-label=${`${t("סגנון סרגל")}: ${e.label}`} ?disabled=${!this.canEdit} @change=${h=>this.setSectionStyle(e,h.target.value)}>
                <option value="" ?selected=${u===""}>${t("לפי ברירת המחדל של הרמה")}</option>
                ${["pill","underline","underline-compact"].map(h=>o`<option value=${h} ?selected=${u===h}>${H[h]}</option>`)}
              </select>
            </span>
          </div>`}
      ${e.id==="tickets"?this.renderSectionRowSetting():y}
      <ol aria-label=${t("הלשוניות של {name} לפי הסדר",{name:e.label})}>
        ${Ss(s,h=>h,(h,c)=>{const p=this.label(e,h),$=i.has(h),r=this.isLocked(e,h),v=r||!$&&n<=1;return o`<li data-sec=${e.id} data-tab=${h} class=${`${this.dragging?.id===h&&this.dragging.section===e.id?"dragging":""} ${$?"off":""}`}>
              <button type="button" class="handle" data-drag=${h} ?disabled=${!this.canEdit} aria-label=${t("גרור את {name}",{name:p})} aria-roledescription=${t("ידית גרירה")}
                @pointerdown=${S=>this.onPointerDown(S,e,h)} @keydown=${S=>this.onHandleKey(S,e,h)}><sw-icon name="grip" size=${20}></sw-icon></button>
              <span class="name">${p}${r?o`<sw-icon class="lock" name="lock" size=${13} title=${t("הדרך חזרה לעורך הזה: אי אפשר להסתיר")}></sw-icon>`:y}</span>
              <button type="button" class="mv" data-move="up" aria-label=${t("הזז למעלה: {name}",{name:p})} aria-disabled=${!this.canEdit||c===0?"true":"false"} @click=${()=>this.canEdit&&c>0&&this.move(e,h,c-1,"up")}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
              <button type="button" class="mv" data-move="down" aria-label=${t("הזז למטה: {name}",{name:p})} aria-disabled=${!this.canEdit||c===l-1?"true":"false"} @click=${()=>this.canEdit&&c<l-1&&this.move(e,h,c+1,"down")}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
              <sw-toggle data-visible=${h} .checked=${!$} ?disabled=${!this.canEdit||v} label=${t("הצגת {name}",{name:p})} labelHidden @change=${S=>this.setVisible(e,h,S.detail.checked)}></sw-toggle>
            </li>`})}
      </ol>
      ${e.id==="wiskey"?o`<div class="muted note">${t("רשימת הלשוניות נלקחת מ־WisKey; לשונית שעוד לא נטענה בדפדפן הזה שומרת את ההגדרה שלה.")}</div>`:y}
      ${e.offered?o`<div class="muted note" data-tabs-offered=${e.id}>${O("noteOffered")}</div>`:y}
      <div class="foot">
        <button type="button" class="link" data-tabs-reset=${e.id} ?disabled=${!this.canEdit||!d} @click=${()=>this.resetSection(e)}>${t("אפס לברירת המחדל")}</button>
      </div>
    </sw-card>`}render(){if(!this.loaded)return o`<sw-state-panel state="loading"></sw-state-panel>`;const e=T();return o`<div class="sections" data-tabs-config>
      <p class="intro">${t("בחרו אילו לשוניות מוצגות בכל אזור ובאיזה סדר. השינוי חל על כל המשתמשים והלשונית הראשונה המוצגת היא זו שהאזור נפתח עליה. הסדר של הניווט הראשי הוא ברירת המחדל: כל משתמש יכול לסדר אותו לעצמו. הסתרת לשונית אינה מבטלת הרשאות והכתובת שלה ממשיכה לעבוד למי שמורשה; בכל אזור נשארת לפחות לשונית אחת.")}</p>
      <div class="group" data-tabs-group="display"><h3 class="grouplabel">${t("תצוגה")}</h3><span class="muted"><sw-icon name="check" size=${13}></sw-icon>${t("כל בחירה כאן נשמרת מיד")}</span></div>
      <system-tabs-mode></system-tabs-mode>
      <div class="group" data-tabs-group="sections"><h3 class="grouplabel">${t("הלשוניות של כל אזור")}</h3><span class="muted">${t('השינויים כאן נשמרים בכפתור "שמור" שבתחתית')}</span></div>
      ${this.loadError?o`<sw-state-panel state="error" heading=${t("לא ניתן לטעון את הגדרות הלשוניות")} hint=${this.loadError} actionLabel=${t("נסה שוב")} data-tabs-load-error @action=${()=>void this.load()}></sw-state-panel>`:o`${this.renderStyleDefaults()}
      ${De.filter(s=>!s.available||s.available()).map(s=>this.renderSection(s))}`}
      ${this.loadError?y:o`<div class="savebar">
        ${this.message?o`<span class="msg ok" role="status"><sw-icon name="check" size=${13}></sw-icon>${this.message}</span>`:y}
        ${this.error?o`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:y}
        ${e?this.canEdit?!this.message&&!this.error?o`<span class="dirty">${this.dirty?t("יש שינויים שלא נשמרו."):t("הכול שמור.")}</span>`:y:o`<span class="muted">${t("נדרשת הרשאת מנהל מערכת.")}</span>`:o`<span class="muted">${t("נתוני הדגמה: ההגדרות נשמרות רק מול השרת.")}</span>`}
        <span class="grow"></span>
        <sw-button variant="ghost" data-tabs-discard ?disabled=${!this.dirty||this.busy} @click=${()=>this.discard()}>${t("בטל שינויים")}</sw-button>
        <sw-button variant="primary" icon="check" data-tabs-save ?disabled=${!this.canEdit||!this.dirty||this.busy||!e} @click=${()=>void this.save()}>${t("שמור")}</sw-button>
      </div>`}
      <span class="sr" role="status" aria-live="polite" data-tabs-announce>${this.announce}</span>
    </div>`}};x.styles=[Ls,Ge`
    /* TABSMODE-POLISH-2331: the page reads as two groups - how tabs look (saved at once) and which tabs each area shows (saved
       with the bar below) - each with its group heading and a line that says how it saves */
    .intro {
      margin: 0;
      max-inline-size: 72ch;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.55;
    }
    .group {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin-block-start: var(--sw-s-2);
    }
    .group .grouplabel {
      margin: 0;
    }
    .group .muted {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .note {
      margin-block-start: var(--sw-s-2);
    }
    ol {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    li {
      display: flex;
      align-items: center;
      gap: 6px;
      min-block-size: 48px;
      padding: 2px 6px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      transition: box-shadow var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease), border-color var(--sw-t-fast) var(--sw-ease);
    }
    li.dragging {
      border-color: var(--sw-accent);
      box-shadow: var(--sw-shadow-2);
      transform: scale(1.01);
      position: relative;
      z-index: 1;
    }
    li.off {
      border-style: dashed;
      background: transparent;
    }
    li.off .name {
      color: var(--sw-text-3);
      text-decoration: line-through;
    }
    @media (hover: hover) and (pointer: fine) {
      li:hover:not(.dragging) {
        border-color: var(--sw-border-strong);
      }
    }
    .handle,
    .mv {
      all: unset;
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-3);
      flex: none;
    }
    .handle {
      cursor: grab;
      touch-action: none;
    }
    .handle:active {
      cursor: grabbing;
    }
    .mv {
      color: var(--sw-text-2);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .mv:active:not([aria-disabled='true']) {
      transform: scale(var(--sw-press-scale));
    }
    @media (hover: hover) and (pointer: fine) {
      .mv:hover:not([aria-disabled='true']) {
        background: var(--sw-surface-3);
        color: var(--sw-text);
      }
    }
    /* a finger gets the full touch target on the reorder keys (TOUCH_TARGET_PX) */
    @media (pointer: coarse) {
      .handle,
      .mv {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      li,
      .mv {
        transition-duration: 0ms;
      }
    }
    .mv[aria-disabled='true'] {
      opacity: 0.3;
      cursor: default;
    }
    .handle:focus-visible,
    .mv:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: -2px;
    }
    .name {
      flex: 1;
      min-inline-size: 0;
      font-weight: var(--sw-fw-medium);
      font-size: var(--sw-fs-md);
      overflow-wrap: anywhere;
    }
    .name .lock {
      color: var(--sw-text-3);
      vertical-align: middle;
      margin-inline-start: 6px;
    }
    /* a setting row of a section card is a well (the settings ladder), like every .row of the settings pages */
    .srow {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: var(--sw-s-3);
      padding: 12px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-well, var(--sw-surface-2));
      margin-block-end: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
    }
    .srow .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .srow + ol {
      margin-block-start: var(--sw-s-3);
    }
    :host([data-skin='bubble']) .srow {
      padding: 8px 0;
      border-radius: 0;
      background: transparent;
      border-block-end: 1px solid var(--sw-border);
    }
    .srow .ctl {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 8px;
      min-inline-size: 0;
      max-inline-size: 100%;
    }
    .srow select {
      min-block-size: 40px;
      max-inline-size: 100%;
      padding: 0 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      cursor: pointer;
    }
    .srow select:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 1px;
    }
    .srow select:disabled {
      opacity: var(--sw-disabled-opacity);
      cursor: default;
    }
    @media (pointer: coarse) {
      .srow select {
        min-block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .srow {
        flex-direction: column;
        align-items: stretch;
      }
      .srow .ctl {
        align-items: stretch;
      }
    }
    .foot {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
      margin-block-start: 10px;
    }
    .foot .grow {
      flex: 1;
    }
    button.link {
      all: unset;
      box-sizing: border-box;
      min-block-size: 40px;
      padding: 0 4px;
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    button.link:hover {
      text-decoration: underline;
    }
    button.link:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
      border-radius: var(--sw-r-2xs);
    }
    button.link[disabled] {
      opacity: 0.5;
      cursor: default;
      text-decoration: none;
    }
  `,Ce];k([w()],x.prototype,"saved",2);k([w()],x.prototype,"draft",2);k([w()],x.prototype,"savedStyles",2);k([w()],x.prototype,"draftStyles",2);k([w()],x.prototype,"savedSectionRow",2);k([w()],x.prototype,"draftSectionRow",2);k([w()],x.prototype,"canEdit",2);k([w()],x.prototype,"loaded",2);k([w()],x.prototype,"busy",2);k([w()],x.prototype,"message",2);k([w()],x.prototype,"error",2);k([w()],x.prototype,"loadError",2);k([w()],x.prototype,"announce",2);k([w()],x.prototype,"dragging",2);x=k([Ne("system-tabs-config")],x);
