import{E as C,F as E,G as o,a as O,R as m,A as h,e as l,H as L,S as A,ae as j,qo as T,bO as _,ru as U,C as W}from"./index-D2ApsviK.js";import{u as q,v as N,x as F,y as M,z as R,A as B,B as G,C as I,D as H,E as J,F as z,G as K,W as P,M as x}from"./wall-logic-Cix3jsE4.js";import{F as S}from"./wall-plan-mode-CWXgHhMr.js";import{R as $}from"./quality-ladder-CXajLOl3.js";import"./sw-logo-art-Va6y_cIM.js";var Y=Object.defineProperty,X=Object.getOwnPropertyDescriptor,b=(t,a,e,i)=>{for(var r=i>1?void 0:i?X(a,e):a,n=t.length-1,u;n>=0;n--)(u=t[n])&&(r=(i?u(a,e,r):u(r))||r);return i&&r&&Y(a,e,r),r};const Q=["image/jpeg","image/png","image/webp"];let w=class extends O{constructor(){super(...arguments),this.open=!1,this.sets=[],this.limits={max_files:200,max_bytes:8*1024*1024},this.current="",this.photos=[],this.name="",this.busy=!1,this.progress="",this.error="",this.confirmDelete=!1}willUpdate(t){t.has("open")&&this.open&&this.refresh()}async refresh(){try{const t=await q();this.sets=t.sets,this.limits=t.limits,this.sets.some(a=>a.id===this.current)||(this.current=this.sets[0]?.id??""),await this.loadPhotos(),this.error=""}catch(t){this.error=m(t)}}async loadPhotos(){this.photos=this.current?(await N(this.current)).photos:[]}async create(){if(this.name.trim()){this.busy=!0;try{const t=await F(this.name.trim());this.name="",this.current=t.id,await this.refresh()}catch(t){this.error=m(t)}finally{this.busy=!1}}}async upload(t){if(!t||!this.current)return;this.busy=!0,this.error="";const a=[...t];let e=0;const i=[];for(const r of a){if(this.progress=`מעלה ${++e} מתוך ${a.length}`,!Q.includes(r.type)){i.push(`${r.name}: רק JPEG, PNG או WebP`);continue}if(r.size>this.limits.max_bytes){i.push(`${r.name}: גדול מ-8MB`);continue}try{await M(this.current,r)}catch(n){i.push(`${r.name}: ${m(n)}`)}}this.progress="",this.busy=!1,await this.refresh(),i.length&&(this.error=i.slice(0,3).join(" · "))}async removePhoto(t){try{await R(this.current,t),await this.refresh()}catch(a){this.error=m(a)}}async removeSet(){this.busy=!0;try{await B(this.current),this.confirmDelete=!1,this.current="",await this.refresh(),this.dispatchEvent(new CustomEvent("sets-changed",{bubbles:!0,composed:!0}))}catch(t){this.error=m(t)}finally{this.busy=!1}}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){if(!this.open)return h;const t=this.sets.find(a=>a.id===this.current);return l`<sw-dialog open heading="תמונות למסכי קיר" data-wall-photos-dialog @close=${()=>this.close()}>
      <div class="sets" data-wall-photo-sets>${this.sets.map(a=>l`<button class="set" aria-pressed=${a.id===this.current} data-wall-set=${a.id} @click=${()=>{this.current=a.id,this.confirmDelete=!1,this.loadPhotos()}}>${a.name} · ${a.count}</button>`)}</div>
      <div class="row"><sw-field label="תיקייה חדשה"><input type="text" maxlength="40" aria-label="שם תיקייה חדשה" data-wall-new-set .value=${this.name} @input=${a=>this.name=a.target.value} /></sw-field>
        <sw-button size="sm" data-wall-create-set ?disabled=${this.busy||!this.name.trim()} @click=${()=>void this.create()}>הוספה</sw-button></div>
      ${t?l`<div class="row"><b>${t.name}</b><span class="muted">${t.count} מתוך ${this.limits.max_files}${t.used_by.length?` · בשימוש: ${t.used_by.join(", ")}`:""}</span></div>
          <div class="row"><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="העלאת תמונות" data-wall-upload ?disabled=${this.busy} @change=${a=>{const e=a.target;this.upload(e.files).then(()=>e.value="")}} />
            ${this.progress?l`<span class="muted" data-wall-progress>${this.progress}</span>`:h}</div>
          <div class="muted">JPEG, PNG או WebP · עד 8MB לתמונה · התמונות נשמרות בשרת בלבד (בגודל מסך), בלי נתוני מיקום</div>
          <div class="grid" data-wall-photo-grid>${this.photos.map(a=>l`<div class="ph" data-wall-photo=${a.id}><img loading="lazy" alt="" src=${G(t.id,a.id)} /><button aria-label="מחיקת תמונה" data-wall-photo-del=${a.id} @click=${()=>void this.removePhoto(a.id)}>×</button></div>`)}</div>
          ${this.confirmDelete?l`<div class="row"><span class="warn">למחוק את התיקייה וכל התמונות שבה?${t.used_by.length?" מסגרת התמונות במסכים שמשתמשים בה תכבה.":""}</span><sw-button size="sm" variant="danger" data-wall-set-delete-confirm ?disabled=${this.busy} @click=${()=>void this.removeSet()}>מחיקה</sw-button><sw-button size="sm" variant="ghost" @click=${()=>this.confirmDelete=!1}>ביטול</sw-button></div>`:l`<sw-button size="sm" variant="ghost" data-wall-set-delete @click=${()=>this.confirmDelete=!0}>מחיקת התיקייה</sw-button>`}`:l`<p class="muted" data-wall-photos-empty>אין תיקיות עדיין. הוסיפו תיקייה והעלו אליה תמונות.</p>`}
      ${this.error?l`<div class="warn" role="alert" data-wall-photos-error>${this.error}</div>`:h}
      <sw-button slot="footer" variant="primary" @click=${()=>this.close()}>סגירה</sw-button>
    </sw-dialog>`}};w.styles=C`
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
  `;b([E({type:Boolean,reflect:!0})],w.prototype,"open",2);b([o()],w.prototype,"sets",2);b([o()],w.prototype,"limits",2);b([o()],w.prototype,"current",2);b([o()],w.prototype,"photos",2);b([o()],w.prototype,"name",2);b([o()],w.prototype,"busy",2);b([o()],w.prototype,"progress",2);b([o()],w.prototype,"error",2);b([o()],w.prototype,"confirmDelete",2);w=b([L("sw-wall-photo-sets")],w);var V=Object.defineProperty,Z=Object.getOwnPropertyDescriptor,c=(t,a,e,i)=>{for(var r=i>1?void 0:i?Z(a,e):a,n=t.length-1,u;n>=0;n--)(u=t[n])&&(r=(i?u(a,e,r):u(r))||r);return i&&r&&V(a,e,r),r};const ee=["א׳","ב׳","ג׳","ד׳","ה׳","ו׳","ש׳"],te=[{id:"clock",label:"שעון"},{id:"date",label:"תאריך"},{id:"health",label:"מצב המערכת"}],se=[{id:"safety",label:"בטיחות"},{id:"alerts",label:"התראות חוקים"},{id:"doors",label:"דלתות"},{id:"device_faults",label:"תקלות התקנים"},{id:"security",label:"אבטחה"}],ae=15e3;let d=class extends O{constructor(){super(...arguments),this.bubbleSkin=new A(this),this.profiles=null,this.max=20,this.error="",this.busy=!1,this.adding=!1,this.candidates=[],this.pick="",this.addTitle="",this.addFloor="",this.floors=[],this.cameras=[],this.editing=null,this.draft=null,this.removing=null,this.photoSets=[],this.managingPhotos=!1,this.query="",this.poll=0}connectedCallback(){super.connectedCallback(),this.load(),this.poll=window.setInterval(()=>{!this.editing&&!this.adding&&this.load(!0)},ae)}disconnectedCallback(){super.disconnectedCallback(),window.clearInterval(this.poll)}async load(t=!1){try{const a=await I();this.profiles=a.profiles,this.max=a.max_profiles,this.error=""}catch(a){(!t||!this.profiles)&&(this.error=m(a))}}async openAdd(){this.adding=!0,this.pick="",this.addTitle="",this.addFloor="";try{const[t,a]=await Promise.all([H(),j()]);this.candidates=t.users,this.floors=a.sites.flatMap(e=>(e.buildings??[]).flatMap(i=>i.floors??[]))}catch(t){this.error=m(t)}}async submitAdd(){if(!(!this.pick||!this.addTitle.trim())){this.busy=!0;try{const t=await J({user_id:this.pick,title:this.addTitle.trim(),floor_id:this.addFloor||null});this.adding=!1,await this.load(!0),await this.openDrawer(t)}catch(t){this.error=m(t)}finally{this.busy=!1}}}async openDrawer(t){if(!this.cameras.length)try{this.cameras=(await T()).cameras.map(e=>({id:e.id,name:e.alias||e.name}))}catch(e){this.error=m(e)}this.loadPhotoSets(),this.editing=t;const a=structuredClone(t.config);a.plan={...S,...a.plan??{}},this.draft={title:t.title,enabled:t.enabled,remote:t.remote_allowed,config:a}}async loadPhotoSets(){try{this.photoSets=(await q()).sets}catch{this.photoSets=[]}}async save(){if(!(!this.editing||!this.draft)){this.busy=!0;try{await z(this.editing.user_id,{title:this.draft.title.trim()||this.editing.title,enabled:this.draft.enabled,remote_allowed:this.draft.remote,config:this.draft.config}),this.editing=null,this.draft=null,await this.load(!0)}catch(t){this.error=m(t)}finally{this.busy=!1}}}async toggleEnabled(t){try{await z(t.user_id,{enabled:!t.enabled}),await this.load(!0)}catch(a){this.error=m(a)}}async doRemove(){if(this.removing){this.busy=!0;try{await K(this.removing.user_id),this.removing=null,await this.load(!0)}catch(t){this.error=m(t)}finally{this.busy=!1}}}rel(t){if(!t)return"—";const a=Math.max(0,Math.round((Date.now()-new Date(t).getTime())/6e4));return a<1?"הרגע":a<60?`לפני ${a} דק׳`:a<1440?`לפני ${Math.round(a/60)} שע׳`:`לפני ${Math.round(a/1440)} ימים`}statusBadge(t){const a=t.status==="connected"?"live":t.status==="disabled"?"offline":"stale",e=t.status==="connected"&&t.connections>1?`${P.connected} · ${t.connections}`:P[t.status];return l`<sw-badge kind=${a} label=${e}></sw-badge>`}cams(t){const a=t.camera_names;return a.length?`${a.length} · ${a.slice(0,2).join(", ")}`:t.config.scope==="floor"?"כל הקומה":"0"}actions(t){return l`<span class="acts">
      <sw-button size="sm" icon="edit" data-wall-edit=${t.user_id} @click=${()=>void this.openDrawer(t)}>עריכה</sw-button>
      <sw-button size="sm" variant="ghost" data-wall-toggle=${t.user_id} @click=${()=>void this.toggleEnabled(t)}>${t.enabled?"השבתה":"הפעלה"}</sw-button>
      <sw-button size="sm" variant="ghost" icon="trash" data-wall-remove=${t.user_id} @click=${()=>this.removing=t}>הסרה</sw-button>
    </span>`}seen(t){return l`<span class="seen"><span class="num">${this.rel(t.last_seen_at)}</span>${t.last_channel==="remote"?l`<sw-badge kind="neutral" label="מרחוק"></sw-badge>`:h}</span>`}renderList(){const t=this.profiles??[];if(!t.length)return l`<sw-state-panel icon="grid" data-wall-empty state="empty" heading="אין מסכי קיר" hint="משתמש מסך קיר הוא משתמש רגיל שמתחבר מטאבלט קבוע ורואה רק את המצלמות שנבחרו."
        actionLabel=${this.max>0?"הוספת משתמש מסך":""} @action=${()=>void this.openAdd()}></sw-state-panel>`;const a=e=>e.config.cameras.length>x?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${x} זרמים - בדוק שהמקליט עומד בעומס</div>`:h;return l`<sw-card flush class="table-card"><table data-wall-table>
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
        </sw-card>`)}</div>`}renderAdd(){if(!this.adding)return h;const t=this.query.trim().toLowerCase(),a=this.candidates.filter(e=>!t||`${e.display_name} ${e.username}`.toLowerCase().includes(t));return l`<sw-dialog open heading="הוספת משתמש מסך" data-wall-add @close=${()=>this.adding=!1}>
      <div class="sec">
        ${this.candidates.length?l`<sw-field label="משתמש"><input type="search" placeholder="חיפוש" aria-label="חיפוש משתמש" .value=${this.query} @input=${e=>this.query=e.target.value} /></sw-field>
              <sw-field label="בחירת משתמש"><select data-wall-pick size="5" aria-label="משתמש" @change=${e=>this.pick=e.target.value}>${a.map(e=>l`<option value=${e.id} ?selected=${e.id===this.pick}>${e.display_name} (${e.username})</option>`)}</select></sw-field>`:l`<p class="muted">אין משתמשים פנויים. משתמש נוצר בתשתית המערכת.</p>`}
        <sw-field label="כותרת המסך"><input type="text" maxlength="40" data-wall-title aria-label="כותרת" .value=${this.addTitle} @input=${e=>this.addTitle=e.target.value} /></sw-field>
        <sw-field label="מקום"><select data-wall-floor aria-label="מקום" @change=${e=>this.addFloor=e.target.value}><option value="">מצלמות נבחרות בלבד</option>${this.floors.map(e=>l`<option value=${e.id} ?selected=${e.id===this.addFloor}>כל הקומה: ${e.name}</option>`)}</select></sw-field>
      </div>
      <sw-button slot="footer" variant="ghost" @click=${()=>this.adding=!1}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-wall-add-submit ?disabled=${this.busy||!this.pick||!this.addTitle.trim()} @click=${()=>void this.submitAdd()}>הוספה</sw-button>
    </sw-dialog>`}cfg(){return this.draft.config}moveCam(t,a){const e=[...this.cfg().cameras],i=e.indexOf(t),r=i+a;i<0||r<0||r>=e.length||([e[i],e[r]]=[e[r],e[i]],this.cfg().cameras=e,this.requestUpdate())}toggleCam(t,a){const e=this.cfg();e.cameras=a?[...e.cameras.filter(i=>i!==t),t].slice(0,12):e.cameras.filter(i=>i!==t),this.requestUpdate()}renderWindows(){const t=this.cfg().schedule.windows,a=(e,i)=>{this.cfg().schedule.windows=t.map((r,n)=>n===e?{...r,...i}:r),this.requestUpdate()};return l`${t.map((e,i)=>l`<div class="win" data-wall-window=${i}>
        <span class="days" role="group" aria-label="ימים">${ee.map((r,n)=>l`<label><input type="checkbox" aria-label=${`יום ${r}`} .checked=${e.days.includes(n)} @change=${u=>a(i,{days:u.target.checked?[...e.days,n].sort():e.days.filter(k=>k!==n)})} /><span aria-hidden="true">${r}</span></label>`)}</span>
        <sw-field><input type="time" lang=${_()} aria-label="משעה" .value=${e.from} @change=${r=>a(i,{from:r.target.value})} /></sw-field>
        <sw-field><input type="time" lang=${_()} aria-label="עד שעה" .value=${e.to} @change=${r=>a(i,{to:r.target.value})} /></sw-field>
        <sw-button size="sm" variant="ghost" icon="trash" iconOnly label="הסרת חלון הערות" @click=${()=>{this.cfg().schedule.windows=t.filter((r,n)=>n!==i),this.requestUpdate()}}></sw-button>
      </div>`)}
    <span><sw-button size="sm" icon="plus" data-wall-add-window @click=${()=>{this.cfg().schedule.windows=[...t,{days:[0,1,2,3,4],from:"07:00",to:"20:00"}],this.requestUpdate()}}>הוספת חלון ערות</sw-button></span>`}renderDrawer(){const t=this.editing,a=this.draft;if(!t||!a)return h;const e=a.config,i=(s,p,f,g,v="")=>l`<div class="line"><span>${s}</span><sw-field><select aria-label=${s} data-wall-field=${v} @change=${y=>{g(y.target.value),this.requestUpdate()}}>${f.map(([y,D])=>l`<option value=${String(y)} ?selected=${String(y)===String(p)}>${D}</option>`)}</select></sw-field></div>`,r=(s,p,f,g="")=>l`<div class="line"><span>${s}</span><sw-toggle label=${s} labelHidden .checked=${p} data-wall-field=${g} @change=${v=>{f(v.detail.checked),this.requestUpdate()}}></sw-toggle></div>`,n=e.plan??(e.plan={...S}),u="כמו בהגדרות המערכת",k=l`<div class="sec" data-wall-section="map"><h3>מפה</h3>
        ${r("להציג מפה (במסך לאורך)",e.show_map,s=>e.show_map=s,"show-map")}
        ${e.show_map&&!t.floor_id?l`<div class="warn" data-wall-map-nofloor>למסך הזה אין קומה, ולכן המפה לא תוצג</div>`:h}
        ${e.show_map?l`${i("תצוגת התוכנית",n.mode,[["follow",u],["live","תלת־ממד חי"],["stills","תמונות מוכנות"]],s=>n.mode=s,"plan-mode")}
              ${i("איכות התלת־ממד",n.quality,[["follow",u],["auto",$.auto],["realistic",$.realistic],["lite",$.lite],["full",$.full],["schematic",$.schematic]],s=>n.quality=s,"plan-quality")}
              ${i("מעבר לתמונה מוכנה בלי מגע ובלי שינוי",n.idle_s,[["follow",u],[0,"לעולם לא"],[10,"10 שנ׳"],[30,"30 שנ׳"],[120,"2 דקות"],[600,"10 דקות"]],s=>n.idle_s=s==="follow"?"follow":Number(s),"plan-idle")}`:h}
      </div>`;return l`<sw-drawer open modal heading=${t.title} subheading=${t.username} data-wall-drawer @close=${()=>{this.editing=null,this.draft=null}}>
      <div class="sec"><h3>משתמש</h3>
        <sw-field label="כותרת"><input type="text" maxlength="40" aria-label="כותרת" data-wall-field="title" .value=${a.title} @input=${s=>{a.title=s.target.value}} /></sw-field>
        ${r("פעיל",a.enabled,s=>a.enabled=s,"enabled")}
        ${r("גישה מרחוק",a.remote,s=>a.remote=s,"remote")}
        <div class="muted">תפקיד: קיוסק (מפה ווידאו חי בלבד)</div>
      </div>
      <div class="sec"><h3>מצלמות ופריסה</h3>
        <div class="muted">${e.cameras.length?`נבחרו ${e.cameras.length} מצלמות (עד 12); המספר הוא הסדר במסך`:"לא נבחרו מצלמות"}</div>
        <div class="cams">${this.cameras.map(s=>{const p=e.cameras.includes(s.id),f=e.cameras.indexOf(s.id),g=`wc-${s.id}`;return l`<div class=${p?"cam on":"cam"} data-wall-cam=${s.id}>
            <input type="checkbox" id=${g} aria-label=${s.name} .checked=${p} @change=${v=>this.toggleCam(s.id,v.target.checked)} />
            <span class="ord" aria-hidden="true">${p?f+1:""}</span>
            <label for=${g}>${s.name}</label>
            <span class="acts">${p?l`<sw-button size="sm" variant="ghost" icon="arrowUp" iconOnly label=${`הקדמה: ${s.name}`} ?disabled=${f===0} @click=${()=>this.moveCam(s.id,-1)}></sw-button><sw-button size="sm" variant="ghost" icon="arrowDown" iconOnly label=${`דחייה: ${s.name}`} ?disabled=${f===e.cameras.length-1} @click=${()=>this.moveCam(s.id,1)}></sw-button>`:h}</span>
          </div>`})}</div>
        ${e.cameras.length>x?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>מעל ${x} זרמים - בדוק שהמקליט עומד בעומס</div>`:h}
        ${i("פריסה",e.layout,[["auto","אוטומטית"],["tablet-landscape","טאבלט לרוחב"],["tablet-portrait","טאבלט לאורך"],["single","מצלמה אחת"]],s=>e.layout=s,"layout")}
        ${i("דפדוף",e.rotate_s,[[0,"אוטומטי"],[15,"15 שנ׳"],[30,"30 שנ׳"],[60,"דקה"],[120,"2 דקות"]],s=>e.rotate_s=Number(s),"rotate")}
        ${i("ערכה",e.theme,[["dark","כהה"],["light","בהירה"],["follow","כמו המערכת"]],s=>e.theme=s,"theme")}
        <div class="line"><span>שורת מצב</span><span class="chips" role="group" aria-label="שורת מצב">${te.map(s=>l`<label><input type="checkbox" data-wall-strip=${s.id} .checked=${e.strip.includes(s.id)} @change=${p=>{e.strip=p.target.checked?[...e.strip,s.id]:e.strip.filter(f=>f!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span></div>
        <sw-field label="ישויות בשורת המצב (עד 8, מופרדות בפסיק)"><input type="text" dir="ltr" data-wall-field="entities" .value=${e.state_entities.join(", ")} @change=${s=>{e.state_entities=s.target.value.split(",").map(p=>p.trim()).filter(Boolean).slice(0,8),this.requestUpdate()}} /></sw-field>
      </div>
      ${k}
      <div class="sec" data-wall-section="alerts"><h3>התראות במסך</h3>
        ${r("להציג התראות",e.alerts.enabled,s=>e.alerts.enabled=s,"alerts-enabled")}
        <div class="sub">קטגוריות</div>
        <span class="chips" role="group" aria-label="קטגוריות">${se.map(s=>l`<label><input type="checkbox" data-wall-alert-cat=${s.id} .checked=${e.alerts.categories.includes(s.id)} @change=${p=>{e.alerts.categories=p.target.checked?[...e.alerts.categories,s.id]:e.alerts.categories.filter(f=>f!==s.id),this.requestUpdate()}} /><span>${s.label}</span></label>`)}</span>
        ${e.alerts.categories.length?h:l`<div class="muted" data-wall-no-cat>לא נבחרה קטגוריה</div>`}
        ${i("חומרה מינימלית",e.alerts.min_severity,[["info","מידע ומעלה"],["alert","התראה ומעלה"],["critical","קריטי בלבד"]],s=>e.alerts.min_severity=s,"alerts-min")}
        ${i("התראה מתקפלת לשורת המצב אחרי",e.alerts.takeover_timeout_s,[[60,"דקה"],[120,"2 דקות"],[300,"5 דקות"],[600,"10 דקות"]],s=>e.alerts.takeover_timeout_s=Number(s),"alerts-timeout")}
        ${r("אישור התראה מהמסך (לחיצה ארוכה)",e.alerts.ack_allowed,s=>e.alerts.ack_allowed=s,"alerts-ack")}
        ${i("להעיר מסך ישן בהתראה מחומרה",e.schedule.wake_on_alert_severity,[["critical","קריטית"],["alert","התראה ומעלה"]],s=>e.schedule.wake_on_alert_severity=s,"alerts-wake")}
      </div>
      <div class="sec" data-wall-section="frame"><h3>מסגרת תמונות</h3>
        ${r("מסגרת תמונות כשהמסך במנוחה",e.frame.enabled,s=>e.frame.enabled=s,"frame-enabled")}
        ${i("תיקיית תמונות",e.frame.folder??"",[["","ללא"],...this.photoSets.map(s=>[s.id,`${s.name} (${s.count})`])],s=>e.frame.folder=s||null,"frame-folder")}
        ${e.frame.enabled&&!e.frame.folder?l`<div class="warn"><sw-icon name="warning" size=${14}></sw-icon>בחרו תיקייה כדי להפעיל את המסגרת</div>`:h}
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
    </sw-dialog>`:h}render(){if(this.error&&!this.profiles)return l`<sw-page crumbs="הגדרות" heading="מסכי קיר"><sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const t=this.profiles?.length??0,a=t>=this.max;return l`<sw-page crumbs="הגדרות" heading="מסכי קיר">
      <div class="toolbar">
        <sw-button variant="primary" icon="plus" data-wall-add-open ?disabled=${a} @click=${()=>void this.openAdd()}>הוספת משתמש מסך</sw-button>
        <sw-button icon="image" data-wall-photos-manage @click=${()=>this.managingPhotos=!0}>תמונות למסכי קיר</sw-button>
        <span class="grow"></span>
        ${this.error?l`<span class="msg err" role="alert"><sw-icon name="warning" size=${13}></sw-icon>${this.error}</span>`:h}
        <span class=${a?"count full":"count"} data-wall-count title=${a?"הגעתם למספר המסכים המרבי":""}>${t} / ${this.max} מסכים</span>
      </div>
      ${this.profiles?this.renderList():l`<sw-state-panel state="loading"></sw-state-panel>`}
      ${this.renderAdd()}${this.renderDrawer()}${this.renderRemove()}
      <sw-wall-photo-sets ?open=${this.managingPhotos} @close=${()=>this.managingPhotos=!1} @sets-changed=${()=>void this.loadPhotoSets()}></sw-wall-photo-sets>
    </sw-page>`}};d.styles=[U,C`
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
      .sr { position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
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
    `,W];c([o()],d.prototype,"profiles",2);c([o()],d.prototype,"max",2);c([o()],d.prototype,"error",2);c([o()],d.prototype,"busy",2);c([o()],d.prototype,"adding",2);c([o()],d.prototype,"candidates",2);c([o()],d.prototype,"pick",2);c([o()],d.prototype,"addTitle",2);c([o()],d.prototype,"addFloor",2);c([o()],d.prototype,"floors",2);c([o()],d.prototype,"cameras",2);c([o()],d.prototype,"editing",2);c([o()],d.prototype,"draft",2);c([o()],d.prototype,"removing",2);c([o()],d.prototype,"photoSets",2);c([o()],d.prototype,"managingPhotos",2);c([o()],d.prototype,"query",2);d=c([L("system-wall")],d);export{d as SystemWall};
//# sourceMappingURL=system-wall-BMYqQ4su.js.map
