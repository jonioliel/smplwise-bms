import{g as C,ax as j,j as o,i as D,n as f,U as h,A as p,b as l,k as q,aL as T,eR as U,R as W,eL as B,jO as g,ek as P,aU as N,hI as R}from"./index-koYOOmpL.js";import{x as A,y as F,z as M,A as G,B as I,C as H,D as J,E as K,F as Y,G as X,H as S,I as Q,J as V,W as L,M as _}from"./wall-logic-C50ucfL_.js";import{F as O}from"./wall-plan-mode-c9o1zIUB.js";import{R as x}from"./quality-ladder-Daz7ILJG.js";import{a as Z}from"./settings-DQrUiMx4.js";import"./sw-logo-art-PLtEZJxU.js";import"./map-CpZHEE-n.js";var ee=Object.defineProperty,te=Object.getOwnPropertyDescriptor,v=(t,a,e,i)=>{for(var r=i>1?void 0:i?te(a,e):a,n=t.length-1,w;n>=0;n--)(w=t[n])&&(r=(i?w(a,e,r):w(r))||r);return i&&r&&ee(a,e,r),r};const se=["image/jpeg","image/png","image/webp"];let m=class extends D{constructor(){super(...arguments),this.open=!1,this.sets=[],this.limits={max_files:200,max_bytes:8*1024*1024},this.current="",this.photos=[],this.name="",this.busy=!1,this.progress="",this.error="",this.confirmDelete=!1}willUpdate(t){t.has("open")&&this.open&&this.refresh()}async refresh(){try{const t=await A();this.sets=t.sets,this.limits=t.limits,this.sets.some(a=>a.id===this.current)||(this.current=this.sets[0]?.id??""),await this.loadPhotos(),this.error=""}catch(t){this.error=f(t)}}async loadPhotos(){this.photos=this.current?(await F(this.current)).photos:[]}async create(){if(this.name.trim()){this.busy=!0;try{const t=await M(this.name.trim());this.name="",this.current=t.id,await this.refresh()}catch(t){this.error=f(t)}finally{this.busy=!1}}}async upload(t){if(!t||!this.current)return;this.busy=!0,this.error="";const a=[...t];let e=0;const i=[];for(const r of a){if(this.progress=h("מעלה {n} מתוך {total}",{n:++e,total:a.length}),!se.includes(r.type)){i.push(h("{name}: רק JPEG, PNG או WebP",{name:r.name}));continue}if(r.size>this.limits.max_bytes){i.push(h("{name}: גדול מ-8MB",{name:r.name}));continue}try{await G(this.current,r)}catch(n){i.push(`${r.name}: ${f(n)}`)}}this.progress="",this.busy=!1,await this.refresh(),i.length&&(this.error=i.slice(0,3).join(" · "))}async removePhoto(t){try{await I(this.current,t),await this.refresh()}catch(a){this.error=f(a)}}async removeSet(){this.busy=!0;try{await H(this.current),this.confirmDelete=!1,this.current="",await this.refresh(),this.dispatchEvent(new CustomEvent("sets-changed",{bubbles:!0,composed:!0}))}catch(t){this.error=f(t)}finally{this.busy=!1}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){if(!this.open)return p;const t=this.sets.find(a=>a.id===this.current);return l`<sw-dialog open heading=${h("תמונות למסכי קיר")} data-wall-photos-dialog @close=${()=>this.close()}>
      <div class="sets" data-wall-photo-sets>${this.sets.map(a=>l`<button class="set" aria-pressed=${a.id===this.current} data-wall-set=${a.id} @click=${()=>{this.current=a.id,this.confirmDelete=!1,this.loadPhotos()}}>${a.name} · ${a.count}</button>`)}</div>
      <div class="row"><sw-field label=${h("תיקייה חדשה")}><input type="text" maxlength="40" aria-label=${h("שם תיקייה חדשה")} data-wall-new-set .value=${this.name} @input=${a=>this.name=a.target.value} /></sw-field>
        <sw-button size="sm" data-wall-create-set ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.create()}>${h("הוספה")}</sw-button></div>
      ${t?l`<div class="row"><b>${t.name}</b><span class="muted">${h("{n} מתוך {max}",{n:t.count,max:this.limits.max_files})}${t.used_by.length?h(" · בשימוש: {list}",{list:t.used_by.join(", ")}):""}</span></div>
          <div class="row"><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label=${h("העלאת תמונות")} data-wall-upload ?disabled=${this.busy} @change=${a=>{const e=a.target;this.upload(e.files).then(()=>e.value="")}} />
            ${this.progress?l`<span class="muted" data-wall-progress>${this.progress}</span>`:p}</div>
          <div class="muted">${h("JPEG, PNG או WebP · עד 8MB לתמונה · התמונות נשמרות בשרת בלבד (בגודל מסך), בלי נתוני מיקום")}</div>
          <div class="grid" data-wall-photo-grid>${this.photos.map(a=>l`<div class="ph" data-wall-photo=${a.id}><img loading="lazy" alt="" src=${J(t.id,a.id)} /><button aria-label=${h("מחיקת תמונה")} data-wall-photo-del=${a.id} @click=${()=>void this.removePhoto(a.id)}>×</button></div>`)}</div>
          ${this.confirmDelete?l`<div class="row"><span class="warn">${h("למחוק את התיקייה וכל התמונות שבה?")}${t.used_by.length?h(" מסגרת התמונות במסכים שמשתמשים בה תכבה."):""}</span><sw-button size="sm" variant="danger" data-wall-set-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeSet()}>${h("מחיקה")}</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.confirmDelete=!1}>${h("ביטול")}</sw-button></div>`:l`<sw-button size="sm" variant="ghost" data-wall-set-delete @click=${()=>this.confirmDelete=!0}>${h("מחיקת התיקייה")}</sw-button>`}`:l`<p class="muted" data-wall-photos-empty>${h("אין תיקיות עדיין. הוסיפו תיקייה והעלו אליה תמונות.")}</p>`}
      ${this.error?l`<div class="warn" role="alert" data-wall-photos-error>${this.error}</div>`:p}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>${h("סגירה")}</sw-button>
    </sw-dialog>`}};m.styles=C`
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
  `;v([j({type:Boolean,reflect:!0})],m.prototype,"open",2);v([o()],m.prototype,"sets",2);v([o()],m.prototype,"limits",2);v([o()],m.prototype,"current",2);v([o()],m.prototype,"photos",2);v([o()],m.prototype,"name",2);v([o()],m.prototype,"busy",2);v([o()],m.prototype,"progress",2);v([o()],m.prototype,"error",2);v([o()],m.prototype,"confirmDelete",2);m=v([q("sw-wall-photo-sets")],m);var ae=Object.defineProperty,ie=Object.getOwnPropertyDescriptor,c=(t,a,e,i)=>{for(var r=i>1?void 0:i?ie(a,e):a,n=t.length-1,w;n>=0;n--)(w=t[n])&&(r=(i?w(a,e,r):w(r))||r);return i&&r&&ae(a,e,r),r};const re=[g("א׳"),g("ב׳"),g("ג׳"),g("ד׳"),g("ה׳"),g("ו׳"),g("ש׳")],le=[{id:"clock",label:"שעון"},{id:"date",label:"תאריך"},{id:"health",label:"מצב המערכת"}],oe=[{id:"safety",label:"בטיחות"},{id:"alerts",label:"התראות חוקים"},{id:"doors",label:"דלתות"},{id:"device_faults",label:"תקלות התקנים"},{id:"security",label:"אבטחה"}],ne=15e3;let d=class extends D{constructor(){super(...arguments),this.bubbleSkin=new T(this),this.profiles=null,this.max=20,this.error="",this.busy=!1,this.adding=!1,this.candidates=[],this.pick="",this.addTitle="",this.addFloor="",this.floors=[],this.cameras=[],this.editing=null,this.draft=null,this.foldable="tablet",this.foldableBusy=!1,this.removing=null,this.photoSets=[],this.managingPhotos=!1,this.query="",this.poll=new U(this)}connectedCallback(){super.connectedCallback(),this.load(),this.poll.every("profiles",ne,()=>this.load(!0),{when:()=>!this.editing&&!this.adding})}async load(t=!1){try{const a=await K();this.profiles=a.profiles,this.max=a.max_profiles,this.foldableBusy||(this.foldable=a.foldable_open==="phone"?"phone":"tablet"),this.error=""}catch(a){(!t||!this.profiles)&&(this.error=f(a))}}async openAdd(){this.adding=!0,this.pick="",this.addTitle="",this.addFloor="";try{const[t,a]=await Promise.all([Y(),W()]);this.candidates=t.users,this.floors=a.sites.flatMap(e=>(e.buildings??[]).flatMap(i=>i.floors??[]))}catch(t){this.error=f(t)}}async submitAdd(){if(!(!this.pick||!this.addTitle.trim())){this.busy=!0;try{const t=await X({user_id:this.pick,title:this.addTitle.trim(),floor_id:this.addFloor||null});this.adding=!1,await this.load(!0),await this.openDrawer(t)}catch(t){this.error=f(t)}finally{this.busy=!1}}}async openDrawer(t){if(!this.cameras.length)try{this.cameras=(await B()).cameras.map(e=>({id:e.id,name:e.alias||e.name}))}catch(e){this.error=f(e)}this.loadPhotoSets(),this.editing=t;const a=structuredClone(t.config);a.plan={...O,...a.plan??{}},this.draft={title:t.title,enabled:t.enabled,remote:t.remote_allowed,desktop:t.desktop===!0,config:a}}async loadPhotoSets(){try{this.photoSets=(await A()).sets}catch{this.photoSets=[]}}async save(){if(!(!this.editing||!this.draft)){this.busy=!0;try{await S(this.editing.user_id,{title:this.draft.title.trim()||this.editing.title,enabled:this.draft.enabled,remote_allowed:this.draft.remote,desktop:this.draft.desktop,config:this.draft.config}),this.editing=null,this.draft=null,await this.load(!0)}catch(t){this.error=f(t)}finally{this.busy=!1}}}async setFoldable(t){const a=this.foldable;this.foldable=t,this.foldableBusy=!0;try{this.foldable=(await Q({foldable_open:t})).foldable_open,this.error=""}catch(e){this.foldable=a,this.error=f(e)}finally{this.foldableBusy=!1}}renderGeneral(){return l`<sw-card class="general" data-wall-general>
      <div class="line">
        <span>טלפון מתקפל פתוח</span>
        <sw-field><select aria-label="טלפון מתקפל פתוח" data-wall-foldable ?disabled=${this.foldableBusy} @change=${t=>void this.setFoldable(t.target.value==="phone"?"phone":"tablet")}>
          <option value="tablet" ?selected=${this.foldable==="tablet"}>כמו טאבלט (מסך קיר)</option>
          <option value="phone" ?selected=${this.foldable==="phone"}>כמו טלפון (המערכת הרגילה)</option>
        </select></sw-field>
      </div>
    </sw-card>`}async toggleEnabled(t){try{await S(t.user_id,{enabled:!t.enabled}),await this.load(!0)}catch(a){this.error=f(a)}}async doRemove(){if(this.removing){this.busy=!0;try{await V(this.removing.user_id),this.removing=null,await this.load(!0)}catch(t){this.error=f(t)}finally{this.busy=!1}}}rel(t){if(!t)return"—";const a=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/6e4));return a<1?g("הרגע"):a<60?g("לפני {n} דק׳",{n:a}):a<1440?g("לפני {n} שע׳",{n:Math.round(a/60)}):g("לפני {n} ימים",{n:Math.round(a/1440)})}statusBadge(t){const a=t.status==="connected"?"live":t.status==="disabled"?"offline":"stale",e=t.status==="connected"&&t.connections>1?`${L.connected} · ${t.connections}`:L[t.status];return l`<sw-badge kind=${a} label=${e}></sw-badge>`}cams(t){const a=t.camera_names;return a.length?`${a.length} · ${a.slice(0,2).join(", ")}`:t.config.scope==="floor"?"כל הקומה":"0"}actions(t){return l`<span class="acts">
      <sw-button size="sm" icon="edit" data-wall-edit=${t.user_id} @click=${()=>void this.openDrawer(t)}>עריכה</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${t.user_id} @click=${()=>void this.toggleEnabled(t)}>${t.enabled?"השבתה":"הפעלה"}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-wall-remove=${t.user_id} @click=${()=>this.removing=t}>הסרה</sw-button>
    </span>`}seen(t){return l`<span class="seen"><span class="num">${this.rel(t.last_seen_at)}</span>${t.last_channel==="remote"?l`<sw-badge kind="neutral" label="מרחוק"></sw-badge>`:p}</span>`}renderList(){const t=this.profiles??[];if(!t.length)return l`<sw-state-panel icon="grid" data-wall-empty state="empty" heading="אין מסכי קיר" hint="משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו."
        actionLabel=${this.max>0?"הוספת משתמש מסך":""} @action=${()=>void this.openAdd()}></sw-state-panel>`;const a=e=>e.config.cameras.length>_?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${_} זרמים - בדוק שהמקליט עומד בעומס</div>`:p;return l`<sw-card flush class="table-card"><table data-wall-table>
        <thead><tr><th scope="col">משתמש</th><th scope="col">מצב</th><th scope="col">נראה לאחרונה</th><th scope="col">מצלמות</th><th scope="col">התראות</th><th scope="col"><span class="sr">פעולות</span></th></tr></thead>
        <tbody>${t.map(e=>l`<tr data-wall-row=${e.user_id}>
            <td class="who"><b>${e.title}</b><span>${e.username}</span></td>
            <td>${this.statusBadge(e)}</td>
            <td>${this.seen(e)}</td>
            <td><span class="num">${this.cams(e)}</span>${a(e)}</td>
            <td>${e.config.alerts.enabled?"פעילות":l`<span class="muted">כבויות</span>`}</td>
            <td>${this.actions(e)}</td>
          </tr>`)}</tbody>
      </table></sw-card>
      <div class="cards">${t.map(e=>l`<sw-card class="card" data-wall-card=${e.user_id}>
          <div class="row"><span class="who"><b>${e.title}</b><span>${e.username}</span></span>${this.statusBadge(e)}</div>
          <div class="row"><span class="muted">${this.seen(e)}</span><span class="muted num">מצלמות: ${this.cams(e)}</span></div>
          ${a(e)}
          ${this.actions(e)}
        </sw-card>`)}</div>`}renderAdd(){if(!this.adding)return p;const t=this.query.trim().toLowerCase(),a=this.candidates.filter(e=>!t||`${e.display_name} ${e.username}`.toLowerCase().includes(t));return l`<sw-dialog open heading="הוספת משתמש מסך" data-wall-add @close=${()=>this.adding=!1}>
      <div class="sec">
        ${this.candidates.length?l`<sw-field label="משתמש"><input type="search" placeholder="חיפוש" aria-label="חיפוש משתמש" .value=${this.query} @input=${e=>this.query=e.target.value} /></sw-field>
              <sw-field label="בחירת משתמש"><select data-wall-pick size="5" aria-label="משתמש" @change=${e=>this.pick=e.target.value}>${a.map(e=>l`<option value=${e.id} ?selected=${e.id===this.pick}>${e.display_name} (${e.username})</option>`)}</select></sw-field>`:l`<p class="muted">אין משתמשים פנויים. משתמש נוצר בתשתית המערכת.</p>`}
        <sw-field label="כותרת המסך"><input type="text" maxlength="40" data-wall-title aria-label="כותרת" .value=${this.addTitle} @input=${e=>this.addTitle=e.target.value} /></sw-field>
        <sw-field label="מקום"><select data-wall-floor aria-label="מקום" @change=${e=>this.addFloor=e.target.value}><option value="">מצלמות נבחרות בלבד</option>${this.floors.map(e=>l`<option value=${e.id} ?selected=${e.id===this.addFloor}>כל הקומה: ${e.name}</option>`)}</select></sw-field>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.adding=!1}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-add-submit ?disabled=${this.busy||!this.pick||!this.addTitle.trim()} @click=${()=>void this.submitAdd()}>הוספה</sw-button>
    </sw-dialog>`}cfg(){return this.draft.config}moveCam(t,a){const e=[...this.cfg().cameras],i=e.indexOf(t),r=i+a;i<0||r<0||r>=e.length||([e[i],e[r]]=[e[r],e[i]],this.cfg().cameras=e,this.requestUpdate())}toggleCam(t,a){const e=this.cfg();e.cameras=a?[...e.cameras.filter(i=>i!==t),t].slice(0,12):e.cameras.filter(i=>i!==t),this.requestUpdate()}renderWindows(){const t=this.cfg().schedule.windows,a=(e,i)=>{this.cfg().schedule.windows=t.map((r,n)=>n===e?{...r,...i}:r),this.requestUpdate()};return l`${t.map((e,i)=>l`<div class="win" data-wall-window=${i}>
        <span class="days" role="group" aria-label="ימים">${re.map((r,n)=>l`<label><input type="checkbox" aria-label=${`יום ${r}`} .checked=${e.days.includes(n)} @change=${w=>a(i,{days:w.target.checked?[...e.days,n].sort():e.days.filter(z=>z!==n)})} /><span aria-hidden="true">${r}</span></label>`)}</span>
        <sw-field><input type="time" lang=${P()} aria-label="משעה" .value=${e.from} @change=${r=>a(i,{from:r.target.value})} /></sw-field>
        <sw-field><input type="time" lang=${P()} aria-label="עד שעה" .value=${e.to} @change=${r=>a(i,{to:r.target.value})} /></sw-field>
        <sw-button size="sm" variant="ghost" icon="trash" iconOnly label="הסרת חלון הערות" @click=${()=>{this.cfg().schedule.windows=t.filter((r,n)=>n!==i),this.requestUpdate()}}></sw-button>
      </div>`)}
    <span><sw-button size="sm" icon="plus" data-wall-add-window @click=${()=>{this.cfg().schedule.windows=[...t,{days:[0,1,2,3,4],from:"07:00",to:"20:00"}],this.requestUpdate()}}>הוספת חלון ערות</sw-button></span>`}renderDrawer(){const t=this.editing,a=this.draft;if(!t||!a)return p;const e=a.config,i=(s,u,b,$,y="")=>l`<div class="line"><span>${s}</span><sw-field><select aria-label=${s} data-wall-field=${y} @change=${k=>{$(k.target.value),this.requestUpdate()}}>${b.map(([k,E])=>l`<option value=${String(k)} ?selected=${String(k)===String(u)}>${E}</option>`)}</select></sw-field></div>`,r=(s,u,b,$="")=>l`<div class="line"><span>${s}</span><sw-toggle label=${s} labelHidden .checked=${u} data-wall-field=${$} @change=${y=>{b(y.detail.checked),this.requestUpdate()}}></sw-toggle></div>`,n=e.plan??(e.plan={...O}),w="כמו בהגדרות המערכת",z=l`<div class="sec" data-wall-section="map"><h3>מפה</h3>
        ${r("להציג מפה (במסך לאורך)",e.show_map,s=>e.show_map=s,"show-map")}
        ${e.show_map&&!t.floor_id?l`<div class="warn" data-wall-map-nofloor>למסך הזה אין קומה, ולכן המפה לא תוצג</div>`:p}
        ${e.show_map?l`${i("תצוגת התוכנית",n.mode,[["follow",w],["live","תלת־ממד חי"],["stills","תמונות מוכנות"]],s=>n.mode=s,"plan-mode")}
              ${i("איכות התלת־ממד",n.quality,[["follow",w],["auto",x.auto],["realistic",x.realistic],["lite",x.lite],["full",x.full],["schematic",x.schematic]],s=>n.quality=s,"plan-quality")}
              ${i("מעבר לתמונה מוכנה בלי מגע ובלי שינוי",n.idle_s,[["follow",w],[0,"לעולם לא"],[10,"10 שנ׳"],[30,"30 שנ׳"],[120,"2 דקות"],[600,"10 דקות"]],s=>n.idle_s=s==="follow"?"follow":Number(s),"plan-idle")}`:p}
      </div>`;return l`<sw-drawer open modal heading=${t.title} subheading=${t.username} data-wall-drawer @close=${()=>{this.editing=null,this.draft=null}}>
      <div class="sec" data-wall-section="user"><h3>משתמש</h3>
        <sw-field label="כותרת"><input type="text" maxlength="40" aria-label="כותרת" data-wall-field="title" .value=${a.title} @input=${s=>{a.title=s.target.value}} /></sw-field>
        ${r("פעיל",a.enabled,s=>a.enabled=s,"enabled")}
        ${r("גישה מרחוק",a.remote,s=>a.remote=s,"remote")}
        ${r("מסך קיר גם במחשב",a.desktop,s=>a.desktop=s,"desktop")}
        ${a.desktop?l`<div class="muted" data-wall-desktop-note>מחשב בלי מגע יציג את מסך הקיר במקום המערכת</div>`:p}
        <div class="muted">תפקיד: קיוסק (מפה ווידאו חי בלבד)</div>
      </div>
      <div class="sec"><h3>מצלמות ופריסה</h3>
        <div class="muted">${e.cameras.length?`נבחרו ${e.cameras.length} מצלמות (עד 12); המספר הוא הסדר במסך`:"לא נבחרו מצלמות"}</div>
        <div class="cams">${this.cameras.map(s=>{const u=e.cameras.includes(s.id),b=e.cameras.indexOf(s.id),$=`wc-${s.id}`;return l`<div class=${u?"cam on":"cam"} data-wall-cam=${s.id}>
            <input type="checkbox" id=${$} aria-label=${s.name} .checked=${u} @change=${y=>this.toggleCam(s.id,y.target.checked)} />
            <span class="ord" aria-hidden="true">${u?b+1:""}</span>
            <label for=${$}>${s.name}</label>
            <span class="acts">${u?l`<sw-button size="sm" variant="ghost" icon="arrowUp" iconOnly label=${`הקדמה: ${s.name}`} ?disabled=${b===0} @click=${()=>this.moveCam(s.id,-1)}></sw-button><sw-button size="sm" variant="ghost" icon="arrowDown" iconOnly label=${`דחייה: ${s.name}`} ?disabled=${b===e.cameras.length-1} @click=${()=>this.moveCam(s.id,1)}></sw-button>`:p}</span>
          </div>`})}</div>
        ${e.cameras.length>_?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${_} זרמים - בדוק שהמקליט עומד בעומס</div>`:p}
        ${i("פריסה",e.layout,[["auto","אוטומטית"],["tablet-landscape","טאבלט לרוחב"],["tablet-portrait","טאבלט לאורך"],["single","מצלמה אחת"]],s=>e.layout=s,"layout")}
        ${i("דפדוף",e.rotate_s,[[0,"אוטומטי"],[15,"15 שנ׳"],[30,"30 שנ׳"],[60,"דקה"],[120,"2 דקות"]],s=>e.rotate_s=Number(s),"rotate")}
        ${i("ערכה",e.theme,[["dark","כהה"],["light","בהירה"],["follow","כמו המערכת"]],s=>e.theme=s,"theme")}
        <div class="line"><span>שורת מצב</span><span class="chips" role="group" aria-label="שורת מצב">${le.map(s=>l`<label><input type="checkbox" data-wall-strip=${s.id} .checked=${e.strip.includes(s.id)} @change=${u=>{e.strip=u.target.checked?[...e.strip,s.id]:e.strip.filter(b=>b!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span></div>
        <sw-field label="ישויות בשורת המצב (עד 8, מופרדות בפסיק)"><input type="text" dir="ltr" data-wall-field="entities" .value=${e.state_entities.join(", ")} @change=${s=>{e.state_entities=s.target.value.split(",").map(u=>u.trim()).filter(Boolean).slice(0,8),this.requestUpdate()}} /></sw-field>
      </div>
      ${z}
      <div class="sec" data-wall-section="alerts"><h3>התראות במסך</h3>
        ${r("להציג התראות",e.alerts.enabled,s=>e.alerts.enabled=s,"alerts-enabled")}
        <div class="sub">קטגוריות</div>
        <span class="chips" role="group" aria-label="קטגוריות">${oe.map(s=>l`<label><input type="checkbox" data-wall-alert-cat=${s.id} .checked=${e.alerts.categories.includes(s.id)} @change=${u=>{e.alerts.categories=u.target.checked?[...e.alerts.categories,s.id]:e.alerts.categories.filter(b=>b!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span>
        ${e.alerts.categories.length?p:l`<div class="muted" data-wall-no-cat>לא נבחרה קטגוריה</div>`}
        ${i("חומרה מינימלית",e.alerts.min_severity,[["info","מידע ומעלה"],["alert","התראה ומעלה"],["critical","קריטי בלבד"]],s=>e.alerts.min_severity=s,"alerts-min")}
        ${i("התראה מתקפלת לשורת המצב אחרי",e.alerts.takeover_timeout_s,[[60,"דקה"],[120,"2 דקות"],[300,"5 דקות"],[600,"10 דקות"]],s=>e.alerts.takeover_timeout_s=Number(s),"alerts-timeout")}
        ${r("אישור התראה מהמסך (לחיצה ארוכה)",e.alerts.ack_allowed,s=>e.alerts.ack_allowed=s,"alerts-ack")}
        ${i("להעיר מסך ישן בהתראה מחומרה",e.schedule.wake_on_alert_severity,[["critical","קריטית"],["alert","התראה ומעלה"]],s=>e.schedule.wake_on_alert_severity=s,"alerts-wake")}
      </div>
      <div class="sec" data-wall-section="frame"><h3>מסגרת תמונות</h3>
        ${r("מסגרת תמונות כשהמסך במנוחה",e.frame.enabled,s=>e.frame.enabled=s,"frame-enabled")}
        ${i("תיקיית תמונות",e.frame.folder??"",[["","ללא"],...this.photoSets.map(s=>[s.id,`${s.name} (${s.count})`])],s=>e.frame.folder=s||null,"frame-folder")}
        ${e.frame.enabled&&!e.frame.folder?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>בחרו תיקייה כדי להפעיל את המסגרת</div>`:p}
        <span><sw-button size="sm" icon="image" data-wall-photos-open @click=${()=>this.managingPhotos=!0}>ניהול התמונות</sw-button></span>
        ${i("מופיעה אחרי",e.frame.idle_min,[[5,"5 דק׳"],[10,"10 דק׳"],[30,"30 דק׳"],[60,"שעה"]],s=>e.frame.idle_min=Number(s),"frame-idle")}
        ${i("החלפת תמונה כל",e.frame.interval_s,[[15,"15 שנ׳"],[30,"30 שנ׳"],[60,"דקה"],[300,"5 דק׳"]],s=>e.frame.interval_s=Number(s),"frame-interval")}
        ${i("התאמה",e.frame.fit,[["contain","כל התמונה"],["cover","מילוי המסך"]],s=>e.frame.fit=s,"frame-fit")}
        ${r("שעון ותאריך",e.frame.clock,s=>e.frame.clock=s,"frame-clock")}
        ${r("תנועה איטית בתמונה",e.frame.motion==="slow",s=>e.frame.motion=s?"slow":"none","frame-motion")}
      </div>
      <div class="sec"><h3>שעות והגנה על המסך</h3>
        ${r("הזזת פיקסלים",e.burn_in.shift,s=>e.burn_in.shift=s,"shift")}
        ${i("עמעום אחרי",e.burn_in.dim_after_min,[[0,"לעולם לא"],[10,"10 דק׳"],[30,"30 דק׳"],[60,"שעה"]],s=>e.burn_in.dim_after_min=Number(s),"dim")}
        ${i("ערבוב סדר כל",e.burn_in.shuffle_h,[[0,"כבוי"],[1,"שעה"],[6,"6 שעות"]],s=>e.burn_in.shuffle_h=Number(s),"shuffle")}
        ${i("וידאו תקוע - להציג כבוי אחרי",e.offline.show_last_frame_s,[[30,"30 שנ׳"],[60,"דקה"],[120,"2 דקות"]],s=>e.offline.show_last_frame_s=Number(s),"offline")}
        ${r("נוגעים במסך מעירים אותו",e.schedule.wake_on_touch,s=>e.schedule.wake_on_touch=s,"wake")}
        <div class="sub">חלונות ערות <span class="muted">(בלי חלון = תמיד פעיל)</span></div>${this.renderWindows()}
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>{this.editing=null,this.draft=null}}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-save ?disabled=${this.busy} @click=${()=>void this.save()}>שמירה</sw-button>
    </sw-drawer>`}renderRemove(){const t=this.removing;return t?l`<sw-dialog open heading="להסיר את מסך הקיר?" data-wall-remove-dialog @close=${()=>this.removing=null}>
      <p class="confirm">הגישה של המשתמש ${t.username} תוסר והמסך יחזור למסך הכניסה.</p>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.removing=null}>ביטול</sw-button>
      <sw-button slot="footer" variant="danger" data-wall-remove-confirm ?disabled=${this.busy} @click=${()=>void this.doRemove()}>הסרה</sw-button>
    </sw-dialog>`:p}render(){if(this.error&&!this.profiles)return l`<sw-page crumbs="הגדרות" heading="מסכי קיר"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const t=this.profiles?.length??0,a=t>=this.max;return l`<sw-page crumbs="הגדרות" heading="מסכי קיר">
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${a} @click=${()=>void this.openAdd()}>הוספת משתמש מסך</sw-button>
        <sw-button icon="image" data-wall-photos-manage @click=${()=>this.managingPhotos=!0}>תמונות למסכי קיר</sw-button>
        <span class="grow"></span>
        ${this.error?l`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:p}
        <span class=${a?"count full":"count"} data-wall-count title=${a?"הגעתם למספר המסכים המרבי":""}>${t} / ${this.max} מסכים</span>
      </div>
      ${this.profiles?this.renderList():l`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.profiles?this.renderGeneral():p}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
      <sw-wall-photo-sets ?open=${this.managingPhotos} @close=${()=>this.managingPhotos=!1} @sets-changed=${()=>void this.loadPhotoSets()}></sw-wall-photo-sets>
    </sw-page>`}};d.styles=[Z,C`
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
      /* the list: a card with a quiet header row; the row is the unit (hover wash), the name leads */
      table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-base); }
      th { text-align: start; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); padding: 12px 16px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
      td { padding: 12px 16px; border-block-start: 1px solid var(--sw-border); vertical-align: middle; }
      tbody tr:first-child td { border-block-start: 0; }
      tbody tr { transition: background var(--sw-t-hover) var(--sw-ease-color); }
      @media (hover: hover) and (pointer: fine) { tbody tr:hover { background: var(--sw-hover-wash); } }
      .who { min-inline-size: 0; }
      .who b { display: block; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); color: var(--sw-heading); overflow-wrap: anywhere; }
      .who span, .muted { color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
      .who span { direction: ltr; unicode-bidi: isolate; }
      .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .seen { display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .acts { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
      ${R}
      .cards { display: none; gap: var(--sw-s-3); }
      .card { display: grid; gap: var(--sw-s-2); }
      .card .row { display: flex; justify-content: space-between; gap: var(--sw-s-2); align-items: center; min-inline-size: 0; }
      .card .acts { justify-content: flex-start; padding-block-start: var(--sw-s-2); border-block-start: 1px solid var(--sw-border); }
      @media (max-width: 720px) { .table-card { display: none; } .cards { display: grid; } }
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
    `,N];c([o()],d.prototype,"profiles",2);c([o()],d.prototype,"max",2);c([o()],d.prototype,"error",2);c([o()],d.prototype,"busy",2);c([o()],d.prototype,"adding",2);c([o()],d.prototype,"candidates",2);c([o()],d.prototype,"pick",2);c([o()],d.prototype,"addTitle",2);c([o()],d.prototype,"addFloor",2);c([o()],d.prototype,"floors",2);c([o()],d.prototype,"cameras",2);c([o()],d.prototype,"editing",2);c([o()],d.prototype,"draft",2);c([o()],d.prototype,"foldable",2);c([o()],d.prototype,"foldableBusy",2);c([o()],d.prototype,"removing",2);c([o()],d.prototype,"photoSets",2);c([o()],d.prototype,"managingPhotos",2);c([o()],d.prototype,"query",2);d=c([q("system-wall")],d);export{d as SystemWall};
