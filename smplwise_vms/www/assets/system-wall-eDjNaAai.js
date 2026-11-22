import{g as q,ax as j,j as n,i as E,n as m,U as h,A as p,b as r,k as O,aL as M,eQ as T,R as U,eK as W,jN as g,ej as P,aU as B,hH as N}from"./index-CPuzFb4-.js";import"./sw-table-8Ffab9oO.js";import{x as A,y as R,z as F,A as G,B as H,C as I,D as K,E as J,F as Y,G as Q,H as S,I as X,J as V,W as L,M as y}from"./wall-logic-SX4wdooU.js";import{F as C}from"./wall-plan-mode-C1sfVNcc.js";import{R as k}from"./quality-ladder-BcAgbeEe.js";import{a as Z}from"./settings-BBKucUsS.js";import"./sw-logo-art-PLtEZJxU.js";import"./map-Dwr94ni0.js";var ee=Object.defineProperty,te=Object.getOwnPropertyDescriptor,v=(t,s,e,i)=>{for(var l=i>1?void 0:i?te(s,e):s,o=t.length-1,u;o>=0;o--)(u=t[o])&&(l=(i?u(s,e,l):u(l))||l);return i&&l&&ee(s,e,l),l};const ae=["image/jpeg","image/png","image/webp"];let f=class extends E{constructor(){super(...arguments),this.open=!1,this.sets=[],this.limits={max_files:200,max_bytes:8*1024*1024},this.current="",this.photos=[],this.name="",this.busy=!1,this.progress="",this.error="",this.confirmDelete=!1}willUpdate(t){t.has("open")&&this.open&&this.refresh()}async refresh(){try{const t=await A();this.sets=t.sets,this.limits=t.limits,this.sets.some(s=>s.id===this.current)||(this.current=this.sets[0]?.id??""),await this.loadPhotos(),this.error=""}catch(t){this.error=m(t)}}async loadPhotos(){this.photos=this.current?(await R(this.current)).photos:[]}async create(){if(this.name.trim()){this.busy=!0;try{const t=await F(this.name.trim());this.name="",this.current=t.id,await this.refresh()}catch(t){this.error=m(t)}finally{this.busy=!1}}}async upload(t){if(!t||!this.current)return;this.busy=!0,this.error="";const s=[...t];let e=0;const i=[];for(const l of s){if(this.progress=h("מעלה {n} מתוך {total}",{n:++e,total:s.length}),!ae.includes(l.type)){i.push(h("{name}: רק JPEG, PNG או WebP",{name:l.name}));continue}if(l.size>this.limits.max_bytes){i.push(h("{name}: גדול מ-8MB",{name:l.name}));continue}try{await G(this.current,l)}catch(o){i.push(`${l.name}: ${m(o)}`)}}this.progress="",this.busy=!1,await this.refresh(),i.length&&(this.error=i.slice(0,3).join(" · "))}async removePhoto(t){try{await H(this.current,t),await this.refresh()}catch(s){this.error=m(s)}}async removeSet(){this.busy=!0;try{await I(this.current),this.confirmDelete=!1,this.current="",await this.refresh(),this.dispatchEvent(new CustomEvent("sets-changed",{bubbles:!0,composed:!0}))}catch(t){this.error=m(t)}finally{this.busy=!1}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){if(!this.open)return p;const t=this.sets.find(s=>s.id===this.current);return r`<sw-dialog open heading=${h("תמונות למסכי קיר")} data-wall-photos-dialog @close=${()=>this.close()}>
      <div class="sets" data-wall-photo-sets>${this.sets.map(s=>r`<button class="set" aria-pressed=${s.id===this.current} data-wall-set=${s.id} @click=${()=>{this.current=s.id,this.confirmDelete=!1,this.loadPhotos()}}>${s.name} · ${s.count}</button>`)}</div>
      <div class="row"><sw-field label=${h("תיקייה חדשה")}><input type="text" maxlength="40" aria-label=${h("שם תיקייה חדשה")} data-wall-new-set .value=${this.name} @input=${s=>this.name=s.target.value} /></sw-field>
        <sw-button size="sm" data-wall-create-set ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.create()}>${h("הוספה")}</sw-button></div>
      ${t?r`<div class="row"><b>${t.name}</b><span class="muted">${h("{n} מתוך {max}",{n:t.count,max:this.limits.max_files})}${t.used_by.length?h(" · בשימוש: {list}",{list:t.used_by.join(", ")}):""}</span></div>
          <div class="row"><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label=${h("העלאת תמונות")} data-wall-upload ?disabled=${this.busy} @change=${s=>{const e=s.target;this.upload(e.files).then(()=>e.value="")}} />
            ${this.progress?r`<span class="muted" data-wall-progress>${this.progress}</span>`:p}</div>
          <div class="muted">${h("JPEG, PNG או WebP · עד 8MB לתמונה · התמונות נשמרות בשרת בלבד (בגודל מסך), בלי נתוני מיקום")}</div>
          <div class="grid" data-wall-photo-grid>${this.photos.map(s=>r`<div class="ph" data-wall-photo=${s.id}><img loading="lazy" alt="" src=${K(t.id,s.id)} /><button aria-label=${h("מחיקת תמונה")} data-wall-photo-del=${s.id} @click=${()=>void this.removePhoto(s.id)}>×</button></div>`)}</div>
          ${this.confirmDelete?r`<div class="row"><span class="warn">${h("למחוק את התיקייה וכל התמונות שבה?")}${t.used_by.length?h(" מסגרת התמונות במסכים שמשתמשים בה תכבה."):""}</span><sw-button size="sm" variant="danger" data-wall-set-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeSet()}>${h("מחיקה")}</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.confirmDelete=!1}>${h("ביטול")}</sw-button></div>`:r`<sw-button size="sm" variant="ghost" data-wall-set-delete @click=${()=>this.confirmDelete=!0}>${h("מחיקת התיקייה")}</sw-button>`}`:r`<p class="muted" data-wall-photos-empty>${h("אין תיקיות עדיין. הוסיפו תיקייה והעלו אליה תמונות.")}</p>`}
      ${this.error?r`<div class="warn" role="alert" data-wall-photos-error>${this.error}</div>`:p}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${h("סגירה")}</sw-button>
    </sw-dialog>`}};f.styles=q`
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
  `;v([j({type:Boolean,reflect:!0})],f.prototype,"open",2);v([n()],f.prototype,"sets",2);v([n()],f.prototype,"limits",2);v([n()],f.prototype,"current",2);v([n()],f.prototype,"photos",2);v([n()],f.prototype,"name",2);v([n()],f.prototype,"busy",2);v([n()],f.prototype,"progress",2);v([n()],f.prototype,"error",2);v([n()],f.prototype,"confirmDelete",2);f=v([O("sw-wall-photo-sets")],f);var se=Object.defineProperty,ie=Object.getOwnPropertyDescriptor,c=(t,s,e,i)=>{for(var l=i>1?void 0:i?ie(s,e):s,o=t.length-1,u;o>=0;o--)(u=t[o])&&(l=(i?u(s,e,l):u(l))||l);return i&&l&&se(s,e,l),l};const re=[g("א׳"),g("ב׳"),g("ג׳"),g("ד׳"),g("ה׳"),g("ו׳"),g("ש׳")],le=[{id:"clock",label:"שעון"},{id:"date",label:"תאריך"},{id:"health",label:"מצב המערכת"}],ne=[{id:"safety",label:"בטיחות"},{id:"alerts",label:"התראות חוקים"},{id:"doors",label:"דלתות"},{id:"device_faults",label:"תקלות התקנים"},{id:"security",label:"אבטחה"}],oe=15e3;let d=class extends E{constructor(){super(...arguments),this.bubbleSkin=new M(this),this.profiles=null,this.max=20,this.error="",this.busy=!1,this.adding=!1,this.candidates=[],this.pick="",this.addTitle="",this.addFloor="",this.floors=[],this.cameras=[],this.editing=null,this.draft=null,this.foldable="tablet",this.foldableBusy=!1,this.phoneMq=window.matchMedia("(max-width: 767px)"),this.phone=this.phoneMq.matches,this.onPhone=()=>this.phone=this.phoneMq.matches,this.removing=null,this.photoSets=[],this.managingPhotos=!1,this.query="",this.poll=new T(this)}connectedCallback(){super.connectedCallback(),this.phoneMq.addEventListener("change",this.onPhone),this.phone=this.phoneMq.matches,this.load(),this.poll.every("profiles",oe,()=>this.load(!0),{when:()=>!this.editing&&!this.adding})}disconnectedCallback(){this.phoneMq.removeEventListener("change",this.onPhone),super.disconnectedCallback()}async load(t=!1){try{const s=await J();this.profiles=s.profiles,this.max=s.max_profiles,this.foldableBusy||(this.foldable=s.foldable_open==="phone"?"phone":"tablet"),this.error=""}catch(s){(!t||!this.profiles)&&(this.error=m(s))}}async openAdd(){this.adding=!0,this.pick="",this.addTitle="",this.addFloor="";try{const[t,s]=await Promise.all([Y(),U()]);this.candidates=t.users,this.floors=s.sites.flatMap(e=>(e.buildings??[]).flatMap(i=>i.floors??[]))}catch(t){this.error=m(t)}}async submitAdd(){if(!(!this.pick||!this.addTitle.trim())){this.busy=!0;try{const t=await Q({user_id:this.pick,title:this.addTitle.trim(),floor_id:this.addFloor||null});this.adding=!1,await this.load(!0),await this.openDrawer(t)}catch(t){this.error=m(t)}finally{this.busy=!1}}}async openDrawer(t){if(!this.cameras.length)try{this.cameras=(await W()).cameras.map(e=>({id:e.id,name:e.alias||e.name}))}catch(e){this.error=m(e)}this.loadPhotoSets(),this.editing=t;const s=structuredClone(t.config);s.plan={...C,...s.plan??{}},this.draft={title:t.title,enabled:t.enabled,remote:t.remote_allowed,desktop:t.desktop===!0,config:s}}async loadPhotoSets(){try{this.photoSets=(await A()).sets}catch{this.photoSets=[]}}async save(){if(!(!this.editing||!this.draft)){this.busy=!0;try{await S(this.editing.user_id,{title:this.draft.title.trim()||this.editing.title,enabled:this.draft.enabled,remote_allowed:this.draft.remote,desktop:this.draft.desktop,config:this.draft.config}),this.editing=null,this.draft=null,await this.load(!0)}catch(t){this.error=m(t)}finally{this.busy=!1}}}async setFoldable(t){const s=this.foldable;this.foldable=t,this.foldableBusy=!0;try{this.foldable=(await X({foldable_open:t})).foldable_open,this.error=""}catch(e){this.foldable=s,this.error=m(e)}finally{this.foldableBusy=!1}}renderGeneral(){return r`<sw-card class="general" data-wall-general>
      <div class="line">
        <span>טלפון מתקפל פתוח</span>
        <sw-field><select aria-label="טלפון מתקפל פתוח" data-wall-foldable ?disabled=${this.foldableBusy} @change=${t=>void this.setFoldable(t.target.value==="phone"?"phone":"tablet")}>
          <option value="tablet" ?selected=${this.foldable==="tablet"}>כמו טאבלט (מסך קיר)</option>
          <option value="phone" ?selected=${this.foldable==="phone"}>כמו טלפון (המערכת הרגילה)</option>
        </select></sw-field>
      </div>
    </sw-card>`}async toggleEnabled(t){try{await S(t.user_id,{enabled:!t.enabled}),await this.load(!0)}catch(s){this.error=m(s)}}async doRemove(){if(this.removing){this.busy=!0;try{await V(this.removing.user_id),this.removing=null,await this.load(!0)}catch(t){this.error=m(t)}finally{this.busy=!1}}}rel(t){if(!t)return"—";const s=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/6e4));return s<1?g("הרגע"):s<60?g("לפני {n} דק׳",{n:s}):s<1440?g("לפני {n} שע׳",{n:Math.round(s/60)}):g("לפני {n} ימים",{n:Math.round(s/1440)})}statusBadge(t){const s=t.status==="connected"?"live":t.status==="disabled"?"offline":"stale",e=t.status==="connected"&&t.connections>1?`${L.connected} · ${t.connections}`:L[t.status];return r`<sw-badge kind=${s} label=${e}></sw-badge>`}cams(t){const s=t.camera_names;return s.length?`${s.length} · ${s.slice(0,2).join(", ")}`:t.config.scope==="floor"?"כל הקומה":"0"}actions(t){return r`<span class="acts">
      <sw-button size="sm" icon="edit" data-wall-edit=${t.user_id} @click=${()=>void this.openDrawer(t)}>עריכה</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${t.user_id} @click=${()=>void this.toggleEnabled(t)}>${t.enabled?"השבתה":"הפעלה"}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-wall-remove=${t.user_id} @click=${()=>this.removing=t}>הסרה</sw-button>
    </span>`}seen(t){return r`<span class="seen"><span class="num">${this.rel(t.last_seen_at)}</span>${t.last_channel==="remote"?r`<sw-badge kind="neutral" label="מרחוק"></sw-badge>`:p}</span>`}renderList(){const t=this.profiles??[];if(!t.length)return r`<sw-state-panel icon="grid" data-wall-empty state="empty" heading="אין מסכי קיר" hint="משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו."
        actionLabel=${this.max>0?"הוספת משתמש מסך":""} @action=${()=>void this.openAdd()}></sw-state-panel>`;const s=i=>i.config.cameras.length>y?r`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${y} זרמים - בדוק שהמקליט עומד בעומס</div>`:p,e=[{key:"title",label:"משתמש",render:i=>r`<span class="t1">${i.title}</span><span class="t2"><bdi dir="ltr">${i.username}</bdi></span>`},{key:"status",label:"מצב",kind:"status",render:i=>this.statusBadge(i)},{key:"seen",label:"נראה לאחרונה",render:i=>r`${this.rel(i.last_seen_at)}${i.last_channel==="remote"?r` <sw-badge kind="neutral" label="מרחוק"></sw-badge>`:p}`},{key:"cams",label:"מצלמות",render:i=>r`${this.cams(i)}${i.config.cameras.length>y?r`<span class="t2" part="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${y} זרמים - בדוק שהמקליט עומד בעומס</span>`:p}`},{key:"alerts",label:"התראות",render:i=>i.config.alerts.enabled?"פעילות":r`<span class="mut">כבויות</span>`},{key:"acts",label:"פעולות",kind:"actions",render:i=>this.actions(i)}];return this.phone?r`<div class="cards">${t.map(i=>r`<sw-card class="card" data-wall-card=${i.user_id}>
          <div class="row"><span class="who"><b>${i.title}</b><span>${i.username}</span></span>${this.statusBadge(i)}</div>
          <div class="row"><span class="muted">${this.seen(i)}</span><span class="muted num">מצלמות: ${this.cams(i)}</span></div>
          ${s(i)}
          ${this.actions(i)}
        </sw-card>`)}</div>`:r`<sw-card flush class="table-card"><sw-table bare static-rows data-wall-table rowKey="user_id" .columns=${e} .rows=${t}
        .rowAttrs=${i=>({"data-wall-row":String(i.user_id)})}></sw-table></sw-card>`}renderAdd(){if(!this.adding)return p;const t=this.query.trim().toLowerCase(),s=this.candidates.filter(e=>!t||`${e.display_name} ${e.username}`.toLowerCase().includes(t));return r`<sw-dialog open heading="הוספת משתמש מסך" data-wall-add @close=${()=>this.adding=!1}>
      <div class="sec">
        ${this.candidates.length?r`<sw-field label="משתמש"><input type="search" placeholder="חיפוש" aria-label="חיפוש משתמש" .value=${this.query} @input=${e=>this.query=e.target.value} /></sw-field>
              <sw-field label="בחירת משתמש"><select data-wall-pick size="5" aria-label="משתמש" @change=${e=>this.pick=e.target.value}>${s.map(e=>r`<option value=${e.id} ?selected=${e.id===this.pick}>${e.display_name} (${e.username})</option>`)}</select></sw-field>`:r`<p class="muted">אין משתמשים פנויים. משתמש נוצר בתשתית המערכת.</p>`}
        <sw-field label="כותרת המסך"><input type="text" maxlength="40" data-wall-title aria-label="כותרת" .value=${this.addTitle} @input=${e=>this.addTitle=e.target.value} /></sw-field>
        <sw-field label="מקום"><select data-wall-floor aria-label="מקום" @change=${e=>this.addFloor=e.target.value}><option value="">מצלמות נבחרות בלבד</option>${this.floors.map(e=>r`<option value=${e.id} ?selected=${e.id===this.addFloor}>כל הקומה: ${e.name}</option>`)}</select></sw-field>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.adding=!1}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-add-submit ?disabled=${this.busy||!this.pick||!this.addTitle.trim()} @click=${()=>void this.submitAdd()}>הוספה</sw-button>
    </sw-dialog>`}cfg(){return this.draft.config}moveCam(t,s){const e=[...this.cfg().cameras],i=e.indexOf(t),l=i+s;i<0||l<0||l>=e.length||([e[i],e[l]]=[e[l],e[i]],this.cfg().cameras=e,this.requestUpdate())}toggleCam(t,s){const e=this.cfg();e.cameras=s?[...e.cameras.filter(i=>i!==t),t].slice(0,12):e.cameras.filter(i=>i!==t),this.requestUpdate()}renderWindows(){const t=this.cfg().schedule.windows,s=(e,i)=>{this.cfg().schedule.windows=t.map((l,o)=>o===e?{...l,...i}:l),this.requestUpdate()};return r`${t.map((e,i)=>r`<div class="win" data-wall-window=${i}>
        <span class="days" role="group" aria-label="ימים">${re.map((l,o)=>r`<label><input type="checkbox" aria-label=${`יום ${l}`} .checked=${e.days.includes(o)} @change=${u=>s(i,{days:u.target.checked?[...e.days,o].sort():e.days.filter(z=>z!==o)})} /><span aria-hidden="true">${l}</span></label>`)}</span>
        <sw-field><input type="time" lang=${P()} aria-label="משעה" .value=${e.from} @change=${l=>s(i,{from:l.target.value})} /></sw-field>
        <sw-field><input type="time" lang=${P()} aria-label="עד שעה" .value=${e.to} @change=${l=>s(i,{to:l.target.value})} /></sw-field>
        <sw-button size="sm" variant="ghost" icon="trash" iconOnly label="הסרת חלון הערות" @click=${()=>{this.cfg().schedule.windows=t.filter((l,o)=>o!==i),this.requestUpdate()}}></sw-button>
      </div>`)}
    <span><sw-button size="sm" icon="plus" data-wall-add-window @click=${()=>{this.cfg().schedule.windows=[...t,{days:[0,1,2,3,4],from:"07:00",to:"20:00"}],this.requestUpdate()}}>הוספת חלון ערות</sw-button></span>`}renderDrawer(){const t=this.editing,s=this.draft;if(!t||!s)return p;const e=s.config,i=(a,w,b,$,x="")=>r`<div class="line"><span>${a}</span><sw-field><select aria-label=${a} data-wall-field=${x} @change=${_=>{$(_.target.value),this.requestUpdate()}}>${b.map(([_,D])=>r`<option value=${String(_)} ?selected=${String(_)===String(w)}>${D}</option>`)}</select></sw-field></div>`,l=(a,w,b,$="")=>r`<div class="line"><span>${a}</span><sw-toggle label=${a} labelHidden .checked=${w} data-wall-field=${$} @change=${x=>{b(x.detail.checked),this.requestUpdate()}}></sw-toggle></div>`,o=e.plan??(e.plan={...C}),u="כמו בהגדרות המערכת",z=r`<div class="sec" data-wall-section="map"><h3>מפה</h3>
        ${l("להציג מפה (במסך לאורך)",e.show_map,a=>e.show_map=a,"show-map")}
        ${e.show_map&&!t.floor_id?r`<div class="warn" data-wall-map-nofloor>למסך הזה אין קומה, ולכן המפה לא תוצג</div>`:p}
        ${e.show_map?r`${i("תצוגת התוכנית",o.mode,[["follow",u],["live","תלת־ממד חי"],["stills","תמונות מוכנות"]],a=>o.mode=a,"plan-mode")}
              ${i("איכות התלת־ממד",o.quality,[["follow",u],["auto",k.auto],["realistic",k.realistic],["lite",k.lite],["full",k.full],["schematic",k.schematic]],a=>o.quality=a,"plan-quality")}
              ${i("מעבר לתמונה מוכנה בלי מגע ובלי שינוי",o.idle_s,[["follow",u],[0,"לעולם לא"],[10,"10 שנ׳"],[30,"30 שנ׳"],[120,"2 דקות"],[600,"10 דקות"]],a=>o.idle_s=a==="follow"?"follow":Number(a),"plan-idle")}`:p}
      </div>`;return r`<sw-drawer open modal heading=${t.title} subheading=${t.username} data-wall-drawer @close=${()=>{this.editing=null,this.draft=null}}>
      <div class="sec" data-wall-section="user"><h3>משתמש</h3>
        <sw-field label="כותרת"><input type="text" maxlength="40" aria-label="כותרת" data-wall-field="title" .value=${s.title} @input=${a=>{s.title=a.target.value}} /></sw-field>
        ${l("פעיל",s.enabled,a=>s.enabled=a,"enabled")}
        ${l("גישה מרחוק",s.remote,a=>s.remote=a,"remote")}
        ${l("מסך קיר גם במחשב",s.desktop,a=>s.desktop=a,"desktop")}
        ${s.desktop?r`<div class="muted" data-wall-desktop-note>מחשב בלי מגע יציג את מסך הקיר במקום המערכת</div>`:p}
        <div class="muted">תפקיד: קיוסק (מפה ווידאו חי בלבד)</div>
      </div>
      <div class="sec"><h3>מצלמות ופריסה</h3>
        <div class="muted">${e.cameras.length?`נבחרו ${e.cameras.length} מצלמות (עד 12); המספר הוא הסדר במסך`:"לא נבחרו מצלמות"}</div>
        <div class="cams">${this.cameras.map(a=>{const w=e.cameras.includes(a.id),b=e.cameras.indexOf(a.id),$=`wc-${a.id}`;return r`<div class=${w?"cam on":"cam"} data-wall-cam=${a.id}>
            <input type="checkbox" id=${$} aria-label=${a.name} .checked=${w} @change=${x=>this.toggleCam(a.id,x.target.checked)} />
            <span class="ord" aria-hidden="true">${w?b+1:""}</span>
            <label for=${$}>${a.name}</label>
            <span class="acts">${w?r`<sw-button size="sm" variant="ghost" icon="arrowUp" iconOnly label=${`הקדמה: ${a.name}`} ?disabled=${b===0} @click=${()=>this.moveCam(a.id,-1)}></sw-button><sw-button size="sm" variant="ghost" icon="arrowDown" iconOnly label=${`דחייה: ${a.name}`} ?disabled=${b===e.cameras.length-1} @click=${()=>this.moveCam(a.id,1)}></sw-button>`:p}</span>
          </div>`})}</div>
        ${e.cameras.length>y?r`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${y} זרמים - בדוק שהמקליט עומד בעומס</div>`:p}
        ${i("פריסה",e.layout,[["auto","אוטומטית"],["tablet-landscape","טאבלט לרוחב"],["tablet-portrait","טאבלט לאורך"],["single","מצלמה אחת"]],a=>e.layout=a,"layout")}
        ${i("דפדוף",e.rotate_s,[[0,"אוטומטי"],[15,"15 שנ׳"],[30,"30 שנ׳"],[60,"דקה"],[120,"2 דקות"]],a=>e.rotate_s=Number(a),"rotate")}
        ${i("ערכה",e.theme,[["dark","כהה"],["light","בהירה"],["follow","כמו המערכת"]],a=>e.theme=a,"theme")}
        <div class="line"><span>שורת מצב</span><span class="chips" role="group" aria-label="שורת מצב">${le.map(a=>r`<label><input type="checkbox" data-wall-strip=${a.id} .checked=${e.strip.includes(a.id)} @change=${w=>{e.strip=w.target.checked?[...e.strip,a.id]:e.strip.filter(b=>b!==a.id),this.requestUpdate()}} /><span>${a.label}</span></label>`)}</span></div>
        <sw-field label="ישויות בשורת המצב (עד 8, מופרדות בפסיק)"><input type="text" dir="ltr" data-wall-field="entities" .value=${e.state_entities.join(", ")} @change=${a=>{e.state_entities=a.target.value.split(",").map(w=>w.trim()).filter(Boolean).slice(0,8),this.requestUpdate()}} /></sw-field>
      </div>
      ${z}
      <div class="sec" data-wall-section="alerts"><h3>התראות במסך</h3>
        ${l("להציג התראות",e.alerts.enabled,a=>e.alerts.enabled=a,"alerts-enabled")}
        <div class="sub">קטגוריות</div>
        <span class="chips" role="group" aria-label="קטגוריות">${ne.map(a=>r`<label><input type="checkbox" data-wall-alert-cat=${a.id} .checked=${e.alerts.categories.includes(a.id)} @change=${w=>{e.alerts.categories=w.target.checked?[...e.alerts.categories,a.id]:e.alerts.categories.filter(b=>b!==a.id),this.requestUpdate()}} /><span>${a.label}</span></label>`)}</span>
        ${e.alerts.categories.length?p:r`<div class="muted" data-wall-no-cat>לא נבחרה קטגוריה</div>`}
        ${i("חומרה מינימלית",e.alerts.min_severity,[["info","מידע ומעלה"],["alert","התראה ומעלה"],["critical","קריטי בלבד"]],a=>e.alerts.min_severity=a,"alerts-min")}
        ${i("התראה מתקפלת לשורת המצב אחרי",e.alerts.takeover_timeout_s,[[60,"דקה"],[120,"2 דקות"],[300,"5 דקות"],[600,"10 דקות"]],a=>e.alerts.takeover_timeout_s=Number(a),"alerts-timeout")}
        ${l("אישור התראה מהמסך (לחיצה ארוכה)",e.alerts.ack_allowed,a=>e.alerts.ack_allowed=a,"alerts-ack")}
        ${i("להעיר מסך ישן בהתראה מחומרה",e.schedule.wake_on_alert_severity,[["critical","קריטית"],["alert","התראה ומעלה"]],a=>e.schedule.wake_on_alert_severity=a,"alerts-wake")}
      </div>
      <div class="sec" data-wall-section="frame"><h3>מסגרת תמונות</h3>
        ${l("מסגרת תמונות כשהמסך במנוחה",e.frame.enabled,a=>e.frame.enabled=a,"frame-enabled")}
        ${i("תיקיית תמונות",e.frame.folder??"",[["","ללא"],...this.photoSets.map(a=>[a.id,`${a.name} (${a.count})`])],a=>e.frame.folder=a||null,"frame-folder")}
        ${e.frame.enabled&&!e.frame.folder?r`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>בחרו תיקייה כדי להפעיל את המסגרת</div>`:p}
        <span><sw-button size="sm" icon="image" data-wall-photos-open @click=${()=>this.managingPhotos=!0}>ניהול התמונות</sw-button></span>
        ${i("מופיעה אחרי",e.frame.idle_min,[[5,"5 דק׳"],[10,"10 דק׳"],[30,"30 דק׳"],[60,"שעה"]],a=>e.frame.idle_min=Number(a),"frame-idle")}
        ${i("החלפת תמונה כל",e.frame.interval_s,[[15,"15 שנ׳"],[30,"30 שנ׳"],[60,"דקה"],[300,"5 דק׳"]],a=>e.frame.interval_s=Number(a),"frame-interval")}
        ${i("התאמה",e.frame.fit,[["contain","כל התמונה"],["cover","מילוי המסך"]],a=>e.frame.fit=a,"frame-fit")}
        ${l("שעון ותאריך",e.frame.clock,a=>e.frame.clock=a,"frame-clock")}
        ${l("תנועה איטית בתמונה",e.frame.motion==="slow",a=>e.frame.motion=a?"slow":"none","frame-motion")}
      </div>
      <div class="sec"><h3>שעות והגנה על המסך</h3>
        ${l("הזזת פיקסלים",e.burn_in.shift,a=>e.burn_in.shift=a,"shift")}
        ${i("עמעום אחרי",e.burn_in.dim_after_min,[[0,"לעולם לא"],[10,"10 דק׳"],[30,"30 דק׳"],[60,"שעה"]],a=>e.burn_in.dim_after_min=Number(a),"dim")}
        ${i("ערבוב סדר כל",e.burn_in.shuffle_h,[[0,"כבוי"],[1,"שעה"],[6,"6 שעות"]],a=>e.burn_in.shuffle_h=Number(a),"shuffle")}
        ${i("וידאו תקוע - להציג כבוי אחרי",e.offline.show_last_frame_s,[[30,"30 שנ׳"],[60,"דקה"],[120,"2 דקות"]],a=>e.offline.show_last_frame_s=Number(a),"offline")}
        ${l("נוגעים במסך מעירים אותו",e.schedule.wake_on_touch,a=>e.schedule.wake_on_touch=a,"wake")}
        <div class="sub">חלונות ערות <span class="muted">(בלי חלון = תמיד פעיל)</span></div>${this.renderWindows()}
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.editing=null,this.draft=null}}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</sw-button>
    </sw-drawer>`}renderRemove(){const t=this.removing;return t?r`<sw-dialog open heading="להסיר את מסך הקיר?" data-wall-remove-dialog @close=${()=>this.removing=null}>
      <p class="confirm">הגישה של המשתמש ${t.username} תוסר והמסך יחזור למסך הכניסה.</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.removing=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" data-wall-remove-confirm ?disabled=${this.busy} @click=${()=>void this.doRemove()}>הסרה</sw-button>
    </sw-dialog>`:p}render(){if(this.error&&!this.profiles)return r`<sw-page crumbs="הגדרות" heading="מסכי קיר"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const t=this.profiles?.length??0,s=t>=this.max;return r`<sw-page crumbs="הגדרות" heading="מסכי קיר">
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${s} @click=${()=>void this.openAdd()}>הוספת משתמש מסך</sw-button>
        <sw-button icon="image" data-wall-photos-manage @click=${()=>this.managingPhotos=!0}>תמונות למסכי קיר</sw-button>
        <span class="grow"></span>
        ${this.error?r`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:p}
        <span class=${s?"count full":"count"} data-wall-count title=${s?"הגעתם למספר המסכים המרבי":""}>${t} / ${this.max} מסכים</span>
      </div>
      ${this.profiles?this.renderList():r`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.profiles?this.renderGeneral():p}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
      <sw-wall-photo-sets ?open=${this.managingPhotos} @close=${()=>this.managingPhotos=!1} @sets-changed=${()=>void this.loadPhotoSets()}></sw-wall-photo-sets>
    </sw-page>`}};d.styles=[Z,q`
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
    `,B];c([n()],d.prototype,"profiles",2);c([n()],d.prototype,"max",2);c([n()],d.prototype,"error",2);c([n()],d.prototype,"busy",2);c([n()],d.prototype,"adding",2);c([n()],d.prototype,"candidates",2);c([n()],d.prototype,"pick",2);c([n()],d.prototype,"addTitle",2);c([n()],d.prototype,"addFloor",2);c([n()],d.prototype,"floors",2);c([n()],d.prototype,"cameras",2);c([n()],d.prototype,"editing",2);c([n()],d.prototype,"draft",2);c([n()],d.prototype,"foldable",2);c([n()],d.prototype,"foldableBusy",2);c([n()],d.prototype,"phone",2);c([n()],d.prototype,"removing",2);c([n()],d.prototype,"photoSets",2);c([n()],d.prototype,"managingPhotos",2);c([n()],d.prototype,"query",2);d=c([O("system-wall")],d);export{d as SystemWall};
