import{g as L,y as T,j as o,i as q,o as f,A as w,b as l,k as O,aW as j,eL as W,a2 as B,eF as R,dK as e,dh as $,eh as S,hN as N}from"./index-BMsqo0rz.js";import"./sw-table-BpDGNg_D.js";import{x as M,y as U,z as F,A as G,B as H,C as I,D as K,E as X,F as J,G as Y,H as E,I as Q,J as V,W as A,M as x}from"./wall-logic-DqzhoP31.js";import{t as p}from"./media-DMkSACmg.js";import{F as C}from"./wall-plan-mode-CGynGOqc.js";import{R as _}from"./quality-ladder-D3nCZEwJ.js";import{b as Z}from"./bubble-chrome-CmexCsTg.js";import{a as ee}from"./settings-yylxou_W.js";import"./sw-logo-art-PLtEZJxU.js";import"./map-Ce8gybQ2.js";var te=Object.defineProperty,ae=Object.getOwnPropertyDescriptor,v=(a,i,t,r)=>{for(var n=r>1?void 0:r?ae(i,t):i,d=a.length-1,m;d>=0;d--)(m=a[d])&&(n=(r?m(i,t,n):m(n))||n);return r&&n&&te(i,t,n),n};const se=["image/jpeg","image/png","image/webp"];let b=class extends q{constructor(){super(...arguments),this.open=!1,this.sets=[],this.limits={max_files:200,max_bytes:8*1024*1024},this.current="",this.photos=[],this.name="",this.busy=!1,this.progress="",this.error="",this.confirmDelete=!1}willUpdate(a){a.has("open")&&this.open&&this.refresh()}async refresh(){try{const a=await M();this.sets=a.sets,this.limits=a.limits,this.sets.some(i=>i.id===this.current)||(this.current=this.sets[0]?.id??""),await this.loadPhotos(),this.error=""}catch(a){this.error=f(a)}}async loadPhotos(){this.photos=this.current?(await U(this.current)).photos:[]}async create(){if(this.name.trim()){this.busy=!0;try{const a=await F(this.name.trim());this.name="",this.current=a.id,await this.refresh()}catch(a){this.error=f(a)}finally{this.busy=!1}}}async upload(a){if(!a||!this.current)return;this.busy=!0,this.error="";const i=[...a];let t=0;const r=[];for(const n of i){if(this.progress=p("מעלה {n} מתוך {total}",{n:++t,total:i.length}),!se.includes(n.type)){r.push(p("{name}: רק JPEG, PNG או WebP",{name:n.name}));continue}if(n.size>this.limits.max_bytes){r.push(p("{name}: גדול מ-8MB",{name:n.name}));continue}try{await G(this.current,n)}catch(d){r.push(`${n.name}: ${f(d)}`)}}this.progress="",this.busy=!1,await this.refresh(),r.length&&(this.error=r.slice(0,3).join(" · "))}async removePhoto(a){try{await H(this.current,a),await this.refresh()}catch(i){this.error=f(i)}}async removeSet(){this.busy=!0;try{await I(this.current),this.confirmDelete=!1,this.current="",await this.refresh(),this.dispatchEvent(new CustomEvent("sets-changed",{bubbles:!0,composed:!0}))}catch(a){this.error=f(a)}finally{this.busy=!1}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){if(!this.open)return w;const a=this.sets.find(i=>i.id===this.current);return l`<sw-dialog open heading=${p("תמונות למסכי קיר")} data-wall-photos-dialog @close=${()=>this.close()}>
      <div class="sets" data-wall-photo-sets>${this.sets.map(i=>l`<button class="set" aria-pressed=${i.id===this.current} data-wall-set=${i.id} @click=${()=>{this.current=i.id,this.confirmDelete=!1,this.loadPhotos()}}>${i.name} · ${i.count}</button>`)}</div>
      <div class="row"><sw-field label=${p("תיקייה חדשה")}><input type="text" maxlength="40" aria-label=${p("שם תיקייה חדשה")} data-wall-new-set .value=${this.name} @input=${i=>this.name=i.target.value} /></sw-field>
        <sw-button size="sm" data-wall-create-set ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.create()}>${p("הוספה")}</sw-button></div>
      ${a?l`<div class="row"><b>${a.name}</b><span class="muted">${p("{n} מתוך {max}",{n:a.count,max:this.limits.max_files})}${a.used_by.length?p(" · בשימוש: {list}",{list:a.used_by.join(", ")}):""}</span></div>
          <div class="row"><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label=${p("העלאת תמונות")} data-wall-upload ?disabled=${this.busy} @change=${i=>{const t=i.target;this.upload(t.files).then(()=>t.value="")}} />
            ${this.progress?l`<span class="muted" data-wall-progress>${this.progress}</span>`:w}</div>
          <div class="muted">${p("JPEG, PNG או WebP · עד 8MB לתמונה · התמונות נשמרות בשרת בלבד (בגודל מסך), בלי נתוני מיקום")}</div>
          <div class="grid" data-wall-photo-grid>${this.photos.map(i=>l`<div class="ph" data-wall-photo=${i.id}><img loading="lazy" alt="" src=${K(a.id,i.id)} /><button aria-label=${p("מחיקת תמונה")} data-wall-photo-del=${i.id} @click=${()=>void this.removePhoto(i.id)}>×</button></div>`)}</div>
          ${this.confirmDelete?l`<div class="row"><span class="warn">${p("למחוק את התיקייה וכל התמונות שבה?")}${a.used_by.length?p(" מסגרת התמונות במסכים שמשתמשים בה תכבה."):""}</span><sw-button size="sm" variant="danger" data-wall-set-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeSet()}>${p("מחיקה")}</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.confirmDelete=!1}>${p("ביטול")}</sw-button></div>`:l`<sw-button size="sm" variant="ghost" data-wall-set-delete @click=${()=>this.confirmDelete=!0}>${p("מחיקת התיקייה")}</sw-button>`}`:l`<p class="muted" data-wall-photos-empty>${p("אין תיקיות עדיין. הוסיפו תיקייה והעלו אליה תמונות.")}</p>`}
      ${this.error?l`<div class="warn" role="alert" data-wall-photos-error>${this.error}</div>`:w}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${p("סגירה")}</sw-button>
    </sw-dialog>`}};b.styles=L`
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 8px; margin-block: 10px; }
    .ph { position: relative; aspect-ratio: 4 / 3; border-radius: var(--sw-r-sm); overflow: hidden; background: var(--sw-surface-3); }
    .ph img { inline-size: 100%; block-size: 100%; object-fit: cover; }
    .ph button { position: absolute; inset-block-start: 4px; inset-inline-end: 4px; border: 0; border-radius: 50%; inline-size: 26px; block-size: 26px; background: var(--sw-video-scrim); color: var(--sw-on-video); cursor: pointer; }
    .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-block: 8px; }
    .sets { display: flex; gap: 6px; flex-wrap: wrap; }
    .set { border: 1px solid var(--sw-border); border-radius: var(--sw-r-pill); padding: 4px 12px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
    .set[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; }
    .muted { color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .warn { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    input[type='text'] { font: inherit; color: inherit; background: transparent; border: 0; outline: 0; inline-size: 100%; }
  `;v([T({type:Boolean,reflect:!0})],b.prototype,"open",2);v([o()],b.prototype,"sets",2);v([o()],b.prototype,"limits",2);v([o()],b.prototype,"current",2);v([o()],b.prototype,"photos",2);v([o()],b.prototype,"name",2);v([o()],b.prototype,"busy",2);v([o()],b.prototype,"progress",2);v([o()],b.prototype,"error",2);v([o()],b.prototype,"confirmDelete",2);b=v([O("sw-wall-photo-sets")],b);var ie=Object.defineProperty,re=Object.getOwnPropertyDescriptor,h=(a,i,t,r)=>{for(var n=r>1?void 0:r?re(i,t):i,d=a.length-1,m;d>=0;d--)(m=a[d])&&(n=(r?m(i,t,n):m(n))||n);return r&&n&&ie(i,t,n),n};const le=[$("א׳"),$("ב׳"),$("ג׳"),$("ד׳"),$("ה׳"),$("ו׳"),$("ש׳")],ne=[{id:"clock",label:e("שעון")},{id:"date",label:e("תאריך")},{id:"health",label:e("מצב המערכת")}],oe=[{id:"safety",label:e("בטיחות")},{id:"alerts",label:e("התראות חוקים")},{id:"doors",label:e("דלתות")},{id:"device_faults",label:e("תקלות התקנים")},{id:"security",label:e("אבטחה")}],de=15e3;let c=class extends q{constructor(){super(...arguments),this.bubbleSkin=new j(this),this.profiles=null,this.max=20,this.error="",this.busy=!1,this.adding=!1,this.candidates=[],this.pick="",this.addTitle="",this.addFloor="",this.floors=[],this.cameras=[],this.editing=null,this.draft=null,this.foldable="tablet",this.foldableBusy=!1,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.phone=this.phoneMq.matches,this.onPhone=()=>this.phone=this.phoneMq.matches,this.removing=null,this.photoSets=[],this.managingPhotos=!1,this.query="",this.poll=new W(this)}connectedCallback(){super.connectedCallback(),this.phoneMq.addEventListener("change",this.onPhone),this.phone=this.phoneMq.matches,this.load(),this.poll.every("profiles",de,()=>this.load(!0),{when:()=>!this.editing&&!this.adding})}disconnectedCallback(){this.phoneMq.removeEventListener("change",this.onPhone),super.disconnectedCallback()}async load(a=!1){try{const i=await X();this.profiles=i.profiles,this.max=i.max_profiles,this.foldableBusy||(this.foldable=i.foldable_open==="phone"?"phone":"tablet"),this.error=""}catch(i){(!a||!this.profiles)&&(this.error=f(i))}}async openAdd(){this.adding=!0,this.pick="",this.addTitle="",this.addFloor="";try{const[a,i]=await Promise.all([J(),B()]);this.candidates=a.users,this.floors=i.sites.flatMap(t=>(t.buildings??[]).flatMap(r=>r.floors??[]))}catch(a){this.error=f(a)}}async submitAdd(){if(!(!this.pick||!this.addTitle.trim())){this.busy=!0;try{const a=await Y({user_id:this.pick,title:this.addTitle.trim(),floor_id:this.addFloor||null});this.adding=!1,await this.load(!0),await this.openDrawer(a)}catch(a){this.error=f(a)}finally{this.busy=!1}}}async openDrawer(a){if(!this.cameras.length)try{this.cameras=(await R()).cameras.map(t=>({id:t.id,name:t.alias||t.name}))}catch(t){this.error=f(t)}this.loadPhotoSets(),this.editing=a;const i=structuredClone(a.config);i.plan={...C,...i.plan??{}},this.draft={title:a.title,enabled:a.enabled,remote:a.remote_allowed,desktop:a.desktop===!0,config:i}}async loadPhotoSets(){try{this.photoSets=(await M()).sets}catch{this.photoSets=[]}}async save(){if(!(!this.editing||!this.draft)){this.busy=!0;try{await E(this.editing.user_id,{title:this.draft.title.trim()||this.editing.title,enabled:this.draft.enabled,remote_allowed:this.draft.remote,desktop:this.draft.desktop,config:this.draft.config}),this.editing=null,this.draft=null,await this.load(!0)}catch(a){this.error=f(a)}finally{this.busy=!1}}}async setFoldable(a){const i=this.foldable;this.foldable=a,this.foldableBusy=!0;try{this.foldable=(await Q({foldable_open:a})).foldable_open,this.error=""}catch(t){this.foldable=i,this.error=f(t)}finally{this.foldableBusy=!1}}renderGeneral(){return l`<sw-card class="general" data-wall-general>
      <div class="line">
        <span>${e("טלפון מתקפל פתוח")}</span>
        <sw-field><select aria-label=${e("טלפון מתקפל פתוח")} data-wall-foldable ?disabled=${this.foldableBusy} @change=${a=>void this.setFoldable(a.target.value==="phone"?"phone":"tablet")}>
          <option value="tablet" ?selected=${this.foldable==="tablet"}>${e("כמו טאבלט (מסך קיר)")}</option>
          <option value="phone" ?selected=${this.foldable==="phone"}>${e("כמו טלפון (המערכת הרגילה)")}</option>
        </select></sw-field>
      </div>
    </sw-card>`}async toggleEnabled(a){try{await E(a.user_id,{enabled:!a.enabled}),await this.load(!0)}catch(i){this.error=f(i)}}async doRemove(){if(this.removing){this.busy=!0;try{await V(this.removing.user_id),this.removing=null,await this.load(!0)}catch(a){this.error=f(a)}finally{this.busy=!1}}}rel(a){if(!a)return"—";const i=Math.max(0,Math.round((Date.now()-new Date(a).getTime())/6e4));return i<1?$("הרגע"):i<60?$("לפני {n} דק׳",{n:i}):i<1440?$("לפני {n} שע׳",{n:Math.round(i/60)}):$("לפני {n} ימים",{n:Math.round(i/1440)})}statusBadge(a){const i=a.status==="connected"?"live":a.status==="disabled"?"offline":"stale",t=a.status==="connected"&&a.connections>1?`${A.connected} · ${a.connections}`:A[a.status];return l`<sw-badge kind=${i} label=${t}></sw-badge>`}cams(a){const i=a.camera_names;return i.length?`${i.length} · ${i.slice(0,2).join(", ")}`:a.config.scope==="floor"?e("כל הקומה"):"0"}actions(a){return l`<span class="acts">
      <sw-button size="sm" icon="edit" data-wall-edit=${a.user_id} @click=${()=>void this.openDrawer(a)}>${e("עריכה")}</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${a.user_id} @click=${()=>void this.toggleEnabled(a)}>${a.enabled?e("השבתה"):e("הפעלה")}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-wall-remove=${a.user_id} @click=${()=>this.removing=a}>${e("הסרה")}</sw-button>
    </span>`}seen(a){return l`<span class="seen"><span class="num">${this.rel(a.last_seen_at)}</span>${a.last_channel==="remote"?l`<sw-badge kind="neutral" label=${e("מרחוק")}></sw-badge>`:w}</span>`}renderList(){const a=this.profiles??[];if(!a.length)return l`<sw-state-panel icon="grid" data-wall-empty state="empty" heading=${e("אין מסכי קיר")} hint=${e("משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו.")}
        actionLabel=${this.max>0?e("הוספת משתמש מסך"):""} @action=${()=>void this.openAdd()}></sw-state-panel>`;const i=r=>r.config.cameras.length>x?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>${e("מעל {MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס",{MAX_PER_PAGE:x})}</div>`:w,t=[{key:"title",label:e("משתמש"),render:r=>l`<span class="t1">${r.title}</span><span class="t2"><bdi dir="ltr">${r.username}</bdi></span>`},{key:"status",label:e("מצב"),kind:"status",render:r=>this.statusBadge(r)},{key:"seen",label:e("נראה לאחרונה"),render:r=>l`${this.rel(r.last_seen_at)}${r.last_channel==="remote"?l` <sw-badge kind="neutral" label=${e("מרחוק")}></sw-badge>`:w}`},{key:"cams",label:e("מצלמות"),render:r=>l`${this.cams(r)}${r.config.cameras.length>x?l`<span class="t2" part="warn"><sw-icon name="warning" size=${14}></sw-icon>${e("מעל {MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס",{MAX_PER_PAGE:x})}</span>`:w}`},{key:"alerts",label:e("התראות"),render:r=>r.config.alerts.enabled?e("פעילות"):l`<span class="mut">${e("כבויות")}</span>`},{key:"acts",label:e("פעולות"),kind:"actions",render:r=>this.actions(r)}];return this.phone?l`<div class="cards">${a.map(r=>l`<sw-card class="card" data-wall-card=${r.user_id}>
          <div class="row"><span class="who"><b>${r.title}</b><span>${r.username}</span></span>${this.statusBadge(r)}</div>
          <div class="row"><span class="muted">${this.seen(r)}</span><span class="muted num">${e("מצלמות: {cams}",{cams:this.cams(r)})}</span></div>
          ${i(r)}
          ${this.actions(r)}
        </sw-card>`)}</div>`:l`<sw-card flush class="table-card"><sw-table bare static-rows data-wall-table rowKey="user_id" .columns=${t} .rows=${a}
        .rowAttrs=${r=>({"data-wall-row":String(r.user_id)})}></sw-table></sw-card>`}renderAdd(){if(!this.adding)return w;const a=this.query.trim().toLowerCase(),i=this.candidates.filter(t=>!a||`${t.display_name} ${t.username}`.toLowerCase().includes(a));return l`<sw-dialog open heading=${e("הוספת משתמש מסך")} data-wall-add @close=${()=>this.adding=!1}>
      <div class="sec">
        ${this.candidates.length?l`<sw-field label=${e("משתמש")}><input type="search" placeholder=${e("חיפוש")} aria-label=${e("חיפוש משתמש")} .value=${this.query} @input=${t=>this.query=t.target.value} /></sw-field>
              <sw-field label=${e("בחירת משתמש")}><select data-wall-pick size="5" aria-label=${e("משתמש")} @change=${t=>this.pick=t.target.value}>${i.map(t=>l`<option value=${t.id} ?selected=${t.id===this.pick}>${t.display_name} (${t.username})</option>`)}</select></sw-field>`:l`<p class="muted">${e("אין משתמשים פנויים. משתמש נוצר בתשתית המערכת.")}</p>`}
        <sw-field label=${e("כותרת המסך")}><input type="text" maxlength="40" data-wall-title aria-label=${e("כותרת")} .value=${this.addTitle} @input=${t=>this.addTitle=t.target.value} /></sw-field>
        <sw-field label=${e("מקום")}><select data-wall-floor aria-label=${e("מקום")} @change=${t=>this.addFloor=t.target.value}><option value="">${e("מצלמות נבחרות בלבד")}</option>${this.floors.map(t=>l`<option value=${t.id} ?selected=${t.id===this.addFloor}>${e("כל הקומה: {name}",{name:t.name})}</option>`)}</select></sw-field>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.adding=!1}>${e("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-add-submit ?disabled=${this.busy||!this.pick||!this.addTitle.trim()} @click=${()=>void this.submitAdd()}>${e("הוספה")}</sw-button>
    </sw-dialog>`}cfg(){return this.draft.config}moveCam(a,i){const t=[...this.cfg().cameras],r=t.indexOf(a),n=r+i;r<0||n<0||n>=t.length||([t[r],t[n]]=[t[n],t[r]],this.cfg().cameras=t,this.requestUpdate())}toggleCam(a,i){const t=this.cfg();t.cameras=i?[...t.cameras.filter(r=>r!==a),a].slice(0,12):t.cameras.filter(r=>r!==a),this.requestUpdate()}renderWindows(){const a=this.cfg().schedule.windows,i=(t,r)=>{this.cfg().schedule.windows=a.map((n,d)=>d===t?{...n,...r}:n),this.requestUpdate()};return l`${a.map((t,r)=>l`<div class="win" data-wall-window=${r}>
        <span class="days" role="group" aria-label=${e("ימים")}>${le.map((n,d)=>l`<label><input type="checkbox" aria-label=${e("יום {d}",{d:n})} .checked=${t.days.includes(d)} @change=${m=>i(r,{days:m.target.checked?[...t.days,d].sort():t.days.filter(z=>z!==d)})} /><span aria-hidden="true">${n}</span></label>`)}</span>
        <sw-field><input type="time" lang=${S()} aria-label=${e("משעה")} .value=${t.from} @change=${n=>i(r,{from:n.target.value})} /></sw-field>
        <sw-field><input type="time" lang=${S()} aria-label=${e("עד שעה")} .value=${t.to} @change=${n=>i(r,{to:n.target.value})} /></sw-field>
        <sw-button size="sm" variant="ghost" icon="trash" iconOnly label=${e("הסרת חלון הערות")} @click=${()=>{this.cfg().schedule.windows=a.filter((n,d)=>d!==r),this.requestUpdate()}}></sw-button>
      </div>`)}
    <span><sw-button size="sm" icon="plus" data-wall-add-window @click=${()=>{this.cfg().schedule.windows=[...a,{days:[0,1,2,3,4],from:"07:00",to:"20:00"}],this.requestUpdate()}}>${e("הוספת חלון ערות")}</sw-button></span>`}renderDrawer(){const a=this.editing,i=this.draft;if(!a||!i)return w;const t=i.config,r=(s,u,g,y,k="")=>l`<div class="line"><span>${s}</span><sw-field><select aria-label=${s} data-wall-field=${k} @change=${P=>{y(P.target.value),this.requestUpdate()}}>${g.map(([P,D])=>l`<option value=${String(P)} ?selected=${String(P)===String(u)}>${D}</option>`)}</select></sw-field></div>`,n=(s,u,g,y="")=>l`<div class="line"><span>${s}</span><sw-toggle label=${s} labelHidden .checked=${u} data-wall-field=${y} @change=${k=>{g(k.detail.checked),this.requestUpdate()}}></sw-toggle></div>`,d=t.plan??(t.plan={...C}),m=e("כמו בהגדרות המערכת"),z=l`<div class="sec" data-wall-section="map"><h3>${e("מפה")}</h3>
        ${n(e("להציג מפה (במסך לאורך)"),t.show_map,s=>t.show_map=s,"show-map")}
        ${t.show_map&&!a.floor_id?l`<div class="warn" data-wall-map-nofloor>${e("למסך הזה אין קומה, ולכן המפה לא תוצג")}</div>`:w}
        ${t.show_map?l`${r(e("תצוגת התוכנית"),d.mode,[["follow",m],["live",e("תלת־ממד חי")],["stills",e("תמונות מוכנות")]],s=>d.mode=s,"plan-mode")}
              ${r(e("איכות התלת־ממד"),d.quality,[["follow",m],["auto",_.auto],["realistic",_.realistic],["lite",_.lite],["full",_.full],["schematic",_.schematic]],s=>d.quality=s,"plan-quality")}
              ${r(e("מעבר לתמונה מוכנה בלי מגע ובלי שינוי"),d.idle_s,[["follow",m],[0,e("לעולם לא")],[10,e("10 שנ׳")],[30,e("30 שנ׳")],[120,e("2 דקות")],[600,e("10 דקות")]],s=>d.idle_s=s==="follow"?"follow":Number(s),"plan-idle")}`:w}
      </div>`;return l`<sw-drawer open modal heading=${a.title} subheading=${a.username} data-wall-drawer @close=${()=>{this.editing=null,this.draft=null}}>
      <div class="sec" data-wall-section="user"><h3>${e("משתמש")}</h3>
        <sw-field label=${e("כותרת")}><input type="text" maxlength="40" aria-label=${e("כותרת")} data-wall-field="title" .value=${i.title} @input=${s=>{i.title=s.target.value}} /></sw-field>
        ${n(e("פעיל"),i.enabled,s=>i.enabled=s,"enabled")}
        ${n(e("גישה מרחוק"),i.remote,s=>i.remote=s,"remote")}
        ${n(e("מסך קיר גם במחשב"),i.desktop,s=>i.desktop=s,"desktop")}
        ${i.desktop?l`<div class="muted" data-wall-desktop-note>${e("מחשב בלי מגע יציג את מסך הקיר במקום המערכת")}</div>`:w}
        <div class="muted">${e("תפקיד: קיוסק (מפה ווידאו חי בלבד)")}</div>
      </div>
      <div class="sec"><h3>${e("מצלמות ופריסה")}</h3>
        <div class="muted">${t.cameras.length?e("נבחרו {camerasCount} מצלמות (עד 12); המספר הוא הסדר במסך",{camerasCount:t.cameras.length}):e("לא נבחרו מצלמות")}</div>
        <div class="cams">${this.cameras.map(s=>{const u=t.cameras.includes(s.id),g=t.cameras.indexOf(s.id),y=`wc-${s.id}`;return l`<div class=${u?"cam on":"cam"} data-wall-cam=${s.id}>
            <input type="checkbox" id=${y} aria-label=${s.name} .checked=${u} @change=${k=>this.toggleCam(s.id,k.target.checked)} />
            <span class="ord" aria-hidden="true">${u?g+1:""}</span>
            <label for=${y}>${s.name}</label>
            <span class="acts">${u?l`<sw-button size="sm" variant="ghost" icon="arrowUp" iconOnly label=${e("הקדמה: {name}",{name:s.name})} ?disabled=${g===0} @click=${()=>this.moveCam(s.id,-1)}></sw-button><sw-button size="sm" variant="ghost" icon="arrowDown" iconOnly label=${e("דחייה: {name}",{name:s.name})} ?disabled=${g===t.cameras.length-1} @click=${()=>this.moveCam(s.id,1)}></sw-button>`:w}</span>
          </div>`})}</div>
        ${t.cameras.length>x?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>${e("מעל {MAX_PER_PAGE} זרמים - בדוק שהמקליט עומד בעומס",{MAX_PER_PAGE:x})}</div>`:w}
        ${r(e("פריסה"),t.layout,[["auto",e("אוטומטית")],["tablet-landscape",e("טאבלט לרוחב")],["tablet-portrait",e("טאבלט לאורך")],["single",e("מצלמה אחת")]],s=>t.layout=s,"layout")}
        ${r(e("דפדוף"),t.rotate_s,[[0,e("אוטומטי")],[15,e("15 שנ׳")],[30,e("30 שנ׳")],[60,e("דקה")],[120,e("2 דקות")]],s=>t.rotate_s=Number(s),"rotate")}
        ${r(e("ערכה"),t.theme,[["dark",e("כהה")],["light",e("בהירה")],["follow",e("כמו המערכת")]],s=>t.theme=s,"theme")}
        <div class="line"><span>${e("שורת מצב")}</span><span class="chips" role="group" aria-label=${e("שורת מצב")}>${ne.map(s=>l`<label><input type="checkbox" data-wall-strip=${s.id} .checked=${t.strip.includes(s.id)} @change=${u=>{t.strip=u.target.checked?[...t.strip,s.id]:t.strip.filter(g=>g!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span></div>
        <sw-field label=${e("ישויות בשורת המצב (עד 8, מופרדות בפסיק)")}><input type="text" dir="ltr" data-wall-field="entities" .value=${t.state_entities.join(", ")} @change=${s=>{t.state_entities=s.target.value.split(",").map(u=>u.trim()).filter(Boolean).slice(0,8),this.requestUpdate()}} /></sw-field>
      </div>
      ${z}
      <div class="sec" data-wall-section="alerts"><h3>${e("התראות במסך")}</h3>
        ${n(e("להציג התראות"),t.alerts.enabled,s=>t.alerts.enabled=s,"alerts-enabled")}
        <div class="sub">${e("קטגוריות")}</div>
        <span class="chips" role="group" aria-label=${e("קטגוריות")}>${oe.map(s=>l`<label><input type="checkbox" data-wall-alert-cat=${s.id} .checked=${t.alerts.categories.includes(s.id)} @change=${u=>{t.alerts.categories=u.target.checked?[...t.alerts.categories,s.id]:t.alerts.categories.filter(g=>g!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span>
        ${t.alerts.categories.length?w:l`<div class="muted" data-wall-no-cat>${e("לא נבחרה קטגוריה")}</div>`}
        ${r(e("חומרה מינימלית"),t.alerts.min_severity,[["info",e("מידע ומעלה")],["alert",e("התראה ומעלה")],["critical",e("קריטי בלבד")]],s=>t.alerts.min_severity=s,"alerts-min")}
        ${r(e("התראה מתקפלת לשורת המצב אחרי"),t.alerts.takeover_timeout_s,[[60,e("דקה")],[120,e("2 דקות")],[300,e("5 דקות")],[600,e("10 דקות")]],s=>t.alerts.takeover_timeout_s=Number(s),"alerts-timeout")}
        ${n(e("אישור התראה מהמסך (לחיצה ארוכה)"),t.alerts.ack_allowed,s=>t.alerts.ack_allowed=s,"alerts-ack")}
        ${r(e("להעיר מסך ישן בהתראה מחומרה"),t.schedule.wake_on_alert_severity,[["critical",e("קריטית")],["alert",e("התראה ומעלה")]],s=>t.schedule.wake_on_alert_severity=s,"alerts-wake")}
      </div>
      <div class="sec" data-wall-section="frame"><h3>${e("מסגרת תמונות")}</h3>
        ${n(e("מסגרת תמונות כשהמסך במנוחה"),t.frame.enabled,s=>t.frame.enabled=s,"frame-enabled")}
        ${r(e("תיקיית תמונות"),t.frame.folder??"",[["",e("ללא")],...this.photoSets.map(s=>[s.id,`${s.name} (${s.count})`])],s=>t.frame.folder=s||null,"frame-folder")}
        ${t.frame.enabled&&!t.frame.folder?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>${e("בחרו תיקייה כדי להפעיל את המסגרת")}</div>`:w}
        <span><sw-button size="sm" icon="image" data-wall-photos-open @click=${()=>this.managingPhotos=!0}>${e("ניהול התמונות")}</sw-button></span>
        ${r(e("מופיעה אחרי"),t.frame.idle_min,[[5,e("5 דק׳")],[10,e("10 דק׳")],[30,e("30 דק׳")],[60,e("שעה")]],s=>t.frame.idle_min=Number(s),"frame-idle")}
        ${r(e("החלפת תמונה כל"),t.frame.interval_s,[[15,e("15 שנ׳")],[30,e("30 שנ׳")],[60,e("דקה")],[300,e("5 דק׳")]],s=>t.frame.interval_s=Number(s),"frame-interval")}
        ${r(e("התאמה"),t.frame.fit,[["contain",e("כל התמונה")],["cover",e("מילוי המסך")]],s=>t.frame.fit=s,"frame-fit")}
        ${n(e("שעון ותאריך"),t.frame.clock,s=>t.frame.clock=s,"frame-clock")}
        ${n(e("תנועה איטית בתמונה"),t.frame.motion==="slow",s=>t.frame.motion=s?"slow":"none","frame-motion")}
      </div>
      <div class="sec"><h3>${e("שעות והגנה על המסך")}</h3>
        ${n(e("הזזת פיקסלים"),t.burn_in.shift,s=>t.burn_in.shift=s,"shift")}
        ${r(e("עמעום אחרי"),t.burn_in.dim_after_min,[[0,e("לעולם לא")],[10,e("10 דק׳")],[30,e("30 דק׳")],[60,e("שעה")]],s=>t.burn_in.dim_after_min=Number(s),"dim")}
        ${r(e("ערבוב סדר כל"),t.burn_in.shuffle_h,[[0,e("כבוי")],[1,e("שעה")],[6,e("6 שעות")]],s=>t.burn_in.shuffle_h=Number(s),"shuffle")}
        ${r(e("וידאו תקוע - להציג כבוי אחרי"),t.offline.show_last_frame_s,[[30,e("30 שנ׳")],[60,e("דקה")],[120,e("2 דקות")]],s=>t.offline.show_last_frame_s=Number(s),"offline")}
        ${n(e("נוגעים במסך מעירים אותו"),t.schedule.wake_on_touch,s=>t.schedule.wake_on_touch=s,"wake")}
        <div class="sub">${e("חלונות ערות")} <span class="muted">${e("(בלי חלון = תמיד פעיל)")}</span></div>${this.renderWindows()}
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.editing=null,this.draft=null}}>${e("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-save ?disabled=${this.busy} @click=${()=>void this.save()}>${e("שמירה")}</sw-button>
    </sw-drawer>`}renderRemove(){const a=this.removing;return a?l`<sw-dialog open heading=${e("להסיר את מסך הקיר?")} data-wall-remove-dialog @close=${()=>this.removing=null}>
      <p class="confirm">${e("הגישה של המשתמש {username} תוסר והמסך יחזור למסך הכניסה.",{username:a.username})}</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.removing=null}>${e("ביטול")}</sw-button>
      <sw-button slot="footer" variant="danger" data-wall-remove-confirm ?disabled=${this.busy} @click=${()=>void this.doRemove()}>${e("הסרה")}</sw-button>
    </sw-dialog>`:w}render(){if(this.error&&!this.profiles)return l`<sw-page crumbs=${e("הגדרות")} heading=${e("מסכי קיר")}><sw-state-panel state="error" hint=${this.error} actionLabel=${e("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const a=this.profiles?.length??0,i=a>=this.max;return l`<sw-page crumbs=${e("הגדרות")} heading=${e("מסכי קיר")}>
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${i} @click=${()=>void this.openAdd()}>${e("הוספת משתמש מסך")}</sw-button>
        <sw-button icon="image" data-wall-photos-manage @click=${()=>this.managingPhotos=!0}>${e("תמונות למסכי קיר")}</sw-button>
        <span class="grow"></span>
        ${this.error?l`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:w}
        <span class=${i?"count full":"count"} data-wall-count title=${i?e("הגעתם למספר המסכים המרבי"):""}>${e("{n} / {max} מסכים",{n:a,max:this.max})}</span>
      </div>
      ${this.profiles?this.renderList():l`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.profiles?this.renderGeneral():w}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
      <sw-wall-photo-sets ?open=${this.managingPhotos} @close=${()=>this.managingPhotos=!1} @sets-changed=${()=>void this.loadPhotoSets()}></sw-wall-photo-sets>
    </sw-page>`}};c.styles=[ee,L`
      /* LOOK-POLISH-2331: the settings ladder (page > card > well) on the wall users page - the list sits in a card, the drawer's
         sections are headed groups, every toggle chip is a real keyboard control with its full name, and the hover stays with a
         pointer that hovers. Tokens only. */
      .toolbar { display: flex; gap: var(--sw-s-2) var(--sw-s-3); align-items: center; flex-wrap: wrap; margin-block-end: var(--sw-s-3); }
      .toolbar .grow { flex: 1; }
      .count { display: inline-flex; align-items: center; gap: 6px; min-block-size: 28px; padding: 2px 12px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); font-variant-numeric: tabular-nums; }
      .count.full { background: var(--sw-warning-soft); color: var(--sw-warning-text); }
      .msg { display: inline-flex; align-items: center; gap: 6px; min-block-size: 28px; padding: 2px 12px; border-radius: var(--sw-r-pill); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); max-inline-size: 100%; overflow-wrap: anywhere; }
      .msg.err { background: var(--sw-danger-soft); color: var(--sw-danger-text); }
      .msg sw-icon { flex: none; }
      /* the list: CR-CMP2-TABLES-REST-2470 (owner N10) the shared table inside the card - the reading size and 12 / 16 px cells of the old
         list, never wider than the card (the cells wrap as the old ones did; badges, figures and keys stay on one line); the overload
         warning in the warning ink through the warn part */
      sw-table[data-wall-table] { --sw-table-min: 0; --sw-table-fs: var(--sw-fs-base); --sw-table-cell-pad: 12px 16px; }
      sw-table[data-wall-table]::part(cell) { white-space: normal; }
      sw-table[data-wall-table]::part(cell-status), sw-table[data-wall-table]::part(cell-actions) { white-space: nowrap; }
      sw-table[data-wall-table]::part(warn) { display: flex; align-items: center; gap: 6px; color: var(--sw-warning-text); }
      .who { min-inline-size: 0; }
      .who b { display: block; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); overflow-wrap: anywhere; }
      .who span, .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .who span { direction: ltr; unicode-bidi: isolate; }
      .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .seen { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
      ${N}
      .cards { display: grid; gap: var(--sw-s-3); }
      .card { display: grid; gap: var(--sw-s-2); }
      .card .row { display: flex; justify-content: space-between; gap: var(--sw-s-2); align-items: center; min-inline-size: 0; }
      .card .acts { justify-content: flex-start; padding-block-start: var(--sw-s-2); border-block-start: 1px solid var(--sw-border); }
      /* the drawer: headed groups divided by a hairline; a setting line wraps its control under the label on a narrow drawer */
      .sec { display: grid; gap: var(--sw-s-2); padding-block: var(--sw-s-4); border-block-start: 1px solid var(--sw-border); }
      .sec:first-child { padding-block-start: 0; border-block-start: 0; }
      .sec h3 { margin: 0 0 2px; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); letter-spacing: -0.005em; }
      .line { display: flex; justify-content: space-between; gap: var(--sw-s-2) var(--sw-s-3); align-items: center; flex-wrap: wrap; min-block-size: 40px; }
      .line > span:first-child { flex: 1 1 160px; min-inline-size: 0; color: var(--sw-text); }
      .line sw-field { flex: 0 1 220px; min-inline-size: 160px; }
      .sub { font-weight: var(--sw-fw-semibold); color: var(--sw-text); padding-block-start: var(--sw-s-1); }
      /* WALL-ANSWERS-2400: the installation-wide row under the list (one setting line in its own card) */
      .general { display: block; margin-block-start: var(--sw-s-3); }
      .cams { display: grid; gap: 4px; }
      .cam { display: grid; grid-template-columns: auto auto 1fr auto; gap: var(--sw-s-2); align-items: center; min-block-size: 40px; padding: 2px 10px; border-radius: var(--sw-r-sm); background: var(--sw-well, var(--sw-surface-2)); }
      .cam.on { background: var(--sw-accent-soft); }
      .cam input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
      .cam .ord { min-inline-size: 22px; text-align: center; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold); color: var(--sw-accent-text); font-variant-numeric: tabular-nums; }
      .cam label { min-inline-size: 0; overflow-wrap: anywhere; cursor: pointer; }
      .cam .acts { gap: 2px; }
      .win { display: flex; gap: var(--sw-s-2); align-items: center; flex-wrap: wrap; padding: 8px 10px; border-radius: var(--sw-r-sm); background: var(--sw-well, var(--sw-surface-2)); }
      .win sw-field { inline-size: 120px; }
      /* a toggle chip: the checkbox stays in the tab order (visually hidden), the chip carries its focus ring and its full name */
      .days, .chips { display: flex; gap: 6px; flex-wrap: wrap; }
      .days label, .chips label { position: relative; display: inline-flex; align-items: center; justify-content: center; min-block-size: 36px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); cursor: pointer; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease); }
      .days label { inline-size: 36px; }
      .chips label { padding: 0 14px; }
      .days input, .chips input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
      .days label:has(input:checked), .chips label:has(input:checked) { background: var(--sw-accent-soft); color: var(--sw-accent-text); box-shadow: inset 0 0 0 1px var(--sw-accent); }
      .days label:has(input:focus-visible), .chips label:has(input:focus-visible) { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
      .days label:active, .chips label:active { transform: scale(var(--sw-press-scale)); }
      @media (hover: hover) and (pointer: fine) { .days label:hover:not(:has(input:checked)), .chips label:hover:not(:has(input:checked)) { background: var(--sw-hover-wash); color: var(--sw-text); } }
      @media (prefers-reduced-motion: reduce) { .days label, .chips label, tbody tr { transition-duration: 0ms; } }
      .warn { display: flex; align-items: center; gap: 6px; color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
      .confirm { margin: 0; line-height: 1.5; }
      input[type='text'], input[type='time'], input[type='search'] { font: inherit; color: inherit; background: transparent; border: 0; outline: 0; inline-size: 100%; }
    `,Z];h([o()],c.prototype,"profiles",2);h([o()],c.prototype,"max",2);h([o()],c.prototype,"error",2);h([o()],c.prototype,"busy",2);h([o()],c.prototype,"adding",2);h([o()],c.prototype,"candidates",2);h([o()],c.prototype,"pick",2);h([o()],c.prototype,"addTitle",2);h([o()],c.prototype,"addFloor",2);h([o()],c.prototype,"floors",2);h([o()],c.prototype,"cameras",2);h([o()],c.prototype,"editing",2);h([o()],c.prototype,"draft",2);h([o()],c.prototype,"foldable",2);h([o()],c.prototype,"foldableBusy",2);h([o()],c.prototype,"phone",2);h([o()],c.prototype,"removing",2);h([o()],c.prototype,"photoSets",2);h([o()],c.prototype,"managingPhotos",2);h([o()],c.prototype,"query",2);c=h([O("system-wall")],c);export{c as SystemWall};
