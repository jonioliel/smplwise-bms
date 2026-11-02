import{E as O,G as p,a as I,hO as te,cL as b,R as v,hP as Ve,e as o,A as d,hQ as Ue,hR as pe,H as R,i as C,b6 as ue,g as me,ba as We,hS as H,by as Ye,hT as T,bv as ie,hU as Qe,hV as le,F as M,C as de,bp as Xe,S as ce,Q as U,br as Je,av as B,hm as he,j as De,bU as W,hW as Te,hX as Ze,hY as Q,hZ as S,h_ as es,h$ as ss,i0 as X,cK as J,J as as,b7 as ts,fj as is,i1 as ns,i2 as q,r as os,fi as rs}from"./index-D0R90ECk.js";import{d as ve}from"./media-preset-editor-2ukvYfnl.js";import{u as ls,D as ge,l as ds,m as cs,z as ps}from"./multimedia-players-layout-R4NHFGFF.js";import{a as us,A as ne,b as be,c as fe,d as ms,e as hs,f as we,g as z,h as $e,i as vs,j as gs}from"./announcements-AqmMg-Sg.js";import{t as bs,c as fs,a as ws,s as $s,N as ys,T as ks,b as ye,r as xs,d as _s,e as zs,f as Ss,g as Cs,p as As}from"./model-BZym_EE1.js";import"./sw-logo-art-Va6y_cIM.js";var Es=Object.defineProperty,Os=Object.getOwnPropertyDescriptor,L=(e,s,a,t)=>{for(var i=t>1?void 0:t?Os(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&Es(s,a,i),i};const Ls={off:"neutral",ready:"live",unreachable:"error",unauthorized:"error",schema_too_old:"error",error:"error",unreadable:"error",host_refused:"error"};let y=class extends I{constructor(){super(...arguments),this.conn=null,this.url="",this.token="",this.editingToken=!1,this.busy=!1,this.error="",this.test=null}connectedCallback(){super.connectedCallback(),te()||this.load()}async load(){try{this.conn=await b().maConnection(),this.url=this.conn.url??""}catch(e){this.error=v(e)}}async save(e){this.busy=!0,this.error="";try{this.conn=await b().saveMaConnection(e),this.url=this.conn.url??"",this.token="",this.editingToken=!1,this.test=null}catch(s){this.error=v(s)}finally{this.busy=!1}}async runTest(){this.busy=!0,this.error="";try{this.test=await b().testMaConnection(),this.conn=await b().maConnection()}catch(e){this.error=v(e)}finally{this.busy=!1}}render(){const e=this.conn;if(te())return o`<div class="row"><span class="lbl">חיבור ישיר ל־Music Assistant<span class="muted" data-mc-local-only>${Ve}</span></span></div>`;if(!e)return this.error?o`<div class="err" role="alert">${this.error}</div>`:d;const s=this.test??e.last_test,a=e.token_set_at?Ue(e.token_set_at):null;return o`
      <div class="row"><span class="lbl">חיבור ישיר ל־Music Assistant<span class="muted">תור מלא (גרירה, מחיקה, נגן הבא) וחיפוש בספרייה. ללא החיבור: התור הקצר והספרייה בלי חיפוש.</span></span>
        <span class="acts"><sw-badge kind=${Ls[e.state]} label=${pe[e.state]} data-mc-state=${e.state}></sw-badge>
          <sw-toggle label="חיבור ישיר" labelHidden .checked=${e.enabled} ?disabled=${this.busy||!e.url&&!this.url} data-mc-enabled
            @change=${t=>void this.save({enabled:t.detail.checked,...this.url&&this.url!==e.url?{url:this.url}:{}})}></sw-toggle></span></div>
      <div class="row"><span class="lbl">כתובת השרת<span class="muted">http://שם-מארח:8095 · נשמרת בהגדרות בלבד</span></span>
        <span class="acts"><input type="url" inputmode="url" spellcheck="false" placeholder="http://host:8095" .value=${this.url} data-mc-url aria-label="כתובת השרת"
            @input=${t=>this.url=t.target.value} />
          <sw-button size="sm" ?disabled=${this.busy||this.url===(e.url??"")} data-mc-url-save @click=${()=>void this.save({url:this.url||null})}>שמור</sw-button></span></div>
      <div class="row"><span class="lbl">אסימון גישה<span class="muted" data-mc-token>${e.token_set?`הוגדר${a?` ב־${a}`:""}`:"לא הוגדר"} · משתמש ייעודי עם סינון נגנים${e.token_expiring?o` · <span class="warn">יש לחדש את האסימון</span>`:""}</span></span>
        <span class="acts">${this.editingToken||!e.token_set?o`<input type="password" autocomplete="off" spellcheck="false" .value=${this.token} data-mc-token-input aria-label="אסימון גישה" @input=${t=>this.token=t.target.value} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy||this.token.trim().length<16} data-mc-token-save @click=${()=>void this.save({token:this.token.trim()})}>שמור</sw-button>
              ${e.token_set?o`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>{this.editingToken=!1,this.token=""}}>ביטול</sw-button>`:d}`:o`<sw-button size="sm" ?disabled=${this.busy} data-mc-token-replace @click=${()=>this.editingToken=!0}>החלף</sw-button>
              <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-mc-token-clear @click=${()=>void this.save({clear_token:!0})}>מחק</sw-button>`}</span></div>
      <div class="row"><span class="lbl">בדיקת חיבור<span class="muted" data-mc-test>${s?`${pe[s.state]}${s.server_version?` · גרסה ${s.server_version}`:""}${s.schema_version!==null?` · סכמה ${s.schema_version}`:""}${s.players!==null?` · ${s.players} נגנים גלויים לחשבון`:""}`:"לא נבדק"}</span></span>
        <sw-button size="sm" ?disabled=${this.busy||!e.url||!e.token_set} data-mc-test-run @click=${()=>void this.runTest()}>בדוק חיבור</sw-button></div>
      ${this.error?o`<div class="err" role="alert" data-mc-error>${this.error}</div>`:d}`}};y.styles=O`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .warn {
      color: var(--sw-warning-text, var(--sw-text-2));
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    input {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      inline-size: min(320px, 100%);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
  `;L([p()],y.prototype,"conn",2);L([p()],y.prototype,"url",2);L([p()],y.prototype,"token",2);L([p()],y.prototype,"editingToken",2);L([p()],y.prototype,"busy",2);L([p()],y.prototype,"error",2);L([p()],y.prototype,"test",2);y=L([R("media-ma-connection")],y);const Ds={list:()=>me("multimedia/admin/devices"),update:(e,s)=>We(`multimedia/admin/devices/${encodeURIComponent(e)}`,s),link:async e=>(await ue("multimedia/admin/links",e),me("multimedia/admin/devices")),approve:(e,s,a)=>ue("multimedia/admin/approve",{...e?{device_keys:e}:{},approved:s,...a?.length?{kinds:a}:{}})},Z=e=>JSON.parse(JSON.stringify(e));function Ts(){const e=(t,i,n,r,l,c=[],u=!1)=>({endpoint_id:t,platform:i,role:n,rule:r,link_source:u?"manual":"auto",hidden:l,primary_for:c}),s=(t,i,n,r,l,c,u,$={})=>({key:t,name:i,kind:"screen",kind_source:"auto",approved:c,public:!1,profile:l,profile_source:"auto",confidence:"exact",anchor_entity_id:u[0].endpoint_id.replace(/^ha:/,""),floor_name:n,area_name:r,audio_link_key:null,audio_default:"screen",volume_max:null,model_keys:[],also_turns_on:[],endpoints:u,...$}),a=(t,i,n,r)=>({method:t,confidence:i,via:n,reason:r});return[s("md-living","טלוויזיה סלון","קומת קרקע","סלון","samsung_smart",!0,[e("ha:media_player.demo_living","samsungtv_smart","vendor","1",!1,["power","sources","apps","keys"]),e("ha:media_player.demo_living_cast","cast","cast","3",!0,["now_playing"]),e("ha:media_player.demo_living_st","smartthings","smartthings","3",!0),e("ha:media_player.demo_living_ma","music_assistant","ma_export","2",!0)],{confidence:"strong",audio_link_key:"mp-ampl",audio_default:"linked",also_turns_on:["מגבר סלון"],volume_max:60,cast:a("cast_hls","confirmed","ha:media_player.demo_living_cast","cast_video")}),s("md-kitchen","טלוויזיה מטבח","קומת קרקע","מטבח","lg_webos",!0,[e("ha:media_player.demo_kitchen","webostv","vendor","1",!1,["power","volume","mute","sources","apps","keys","now_playing"])],{cast:a("none","unknown",null,"no_path")}),s("md-pergola","מסך פרגולה","קומת קרקע","פרגולה","samsung_smart",!0,[e("ha:media_player.demo_pergola","samsungtv_smart","vendor","1",!1,["power","sources","apps","keys"])],{public:!0,cast:a("browser_url","unknown","ha:media_player.demo_pergola","samsung_browser")}),s("md-parents","טלוויזיה הורים","קומה 1","חדר הורים","android_tv",!0,[e("ha:remote.demo_parents","androidtv_remote","remote","1",!1,["power","apps","keys"]),e("ha:media_player.demo_parents_cast","cast","cast","1",!1,["now_playing"])],{cast:a("cast_hls","confirmed","ha:media_player.demo_parents_cast","cast_video")}),s("md-kids","מסך ילדים","קומה 1","חדר ילדים","generic",!0,[e("ha:media_player.demo_kids","dlna_dmr","dlna","1",!1,["power","volume","mute","sources","now_playing"])],{cast:a("dlna","likely","ha:media_player.demo_kids","dlna_renderer")}),s("md-new","מסך חדש שזוהה","קומה 1","חדר עבודה","generic",!1,[e("ha:media_player.demo_new","samsungtv","vendor","1",!1,["power"])],{confidence:"weak",cast:a("none","unknown",null,"no_path")})]}class Ns{constructor(){this.devices=Ts(),this.suggestions=[{endpoint_id:"ha:media_player.demo_new",device_key:"md-kitchen",rule:"weak",reason:"אותו חדר ושם דומה"}]}snapshot(){return Z({devices:[...this.devices,...H().adminList()],suggestions:this.suggestions})}async list(){return this.snapshot()}async update(s,a){if(s.startsWith("mp-")){const i=a.area_id?oe.find(n=>n.id===a.area_id):a.area_id===null?null:void 0;return H().adminPatch(s,{...i!==void 0?{area:i?{id:i.id,name:i.name,floor:i.floor_name?[Ps[i.floor_name]??i.floor_name,i.floor_name]:null}:null}:{},...a.volume_max!==void 0?{volume_max:a.volume_max}:{},...a.volume_night!==void 0?{volume_night:a.volume_night}:{},...a.approved!==void 0?{approved:a.approved}:{},...a.display_name?{name:a.display_name.trim()}:{}}),Z(H().adminList().find(n=>n.key===s)??{key:s,name:s,kind:"virtual_group",approved:a.approved!==!1})}const t=this.devices.find(i=>i.key===s);if(!t)throw new Error("not found");return a.display_name!==void 0&&(t.name=a.display_name?.trim()||t.name),a.kind&&([t.kind,t.kind_source]=[a.kind,"manual"]),a.approved!==void 0&&(t.approved=a.approved),a.public!==void 0&&(t.public=a.public),a.profile!==void 0&&([t.profile,t.profile_source]=a.profile?[a.profile,"manual"]:[t.profile,"auto"]),a.audio_link_key!==void 0&&(t.audio_link_key=a.audio_link_key),a.audio_default&&(t.audio_default=a.audio_default),a.volume_max!==void 0&&(t.volume_max=a.volume_max),a.volume_night!==void 0&&(t.volume_night=a.volume_night),a.area_id!==void 0&&(t.area_id=a.area_id,t.area_name=a.area_id?oe.find(i=>i.id===a.area_id)?.name??a.area_id:null),a.model_keys&&(t.model_keys=a.model_keys),Z(t)}async link(s){for(const a of this.devices){const t=a.endpoints.find(i=>i.endpoint_id===s.endpoint_id);t&&(s.op==="ignore"&&(t.hidden=!0),s.op==="restore"&&(t.hidden=!1),s.op==="unlink"&&(t.link_source="manual"))}return s.op==="link"&&(this.suggestions=this.suggestions.filter(a=>a.endpoint_id!==s.endpoint_id)),(s.op==="link"||s.op==="ignore")&&H().answerSuggestion(s.op,s.endpoint_id,s.device_key),this.snapshot()}async approve(s,a,t){const i=s?.filter(l=>!l.startsWith("mp-"))??[];for(const l of this.devices)(s?i.includes(l.key):!t?.length&&l.kind==="screen")&&(l.approved=a);const n=s===null&&!t?.length?null:H().approve(s?s.filter(l=>l.startsWith("mp-")):null,a,t),r=this.devices.filter(l=>l.kind==="screen");return{requested:s?s.length:n?.requested??r.length,changed:n?.changed??i.length,approved:r.filter(l=>l.approved).length,pending_approval:r.filter(l=>!l.approved).length,...t?.length?{approved_players:n?.approved_players,pending_players:n?.pending_players}:{}}}}const oe=[{id:"living",name:"סלון",floor_name:"קומת קרקע"},{id:"kitchen",name:"מטבח",floor_name:"קומת קרקע"},{id:"pergola",name:"פרגולה",floor_name:"קומת קרקע"},{id:"guest",name:"חדר אורחים",floor_name:"קומת קרקע"},{id:"parents",name:"חדר הורים",floor_name:"קומה 1"},{id:"kids",name:"חדר ילדים",floor_name:"קומה 1"},{id:"office",name:"חדר עבודה",floor_name:"קומה 1"},{id:"basement",name:"מרתף",floor_name:"מרתף"}],Ps={"קומת קרקע":"g","קומה 1":"u1",מרתף:"b"};async function Is(){if(!C())return oe;try{return(await Ye()).floors.flatMap(s=>s.areas.map(a=>({id:a.area_id,name:a.name,floor_name:s.floor_id==="none"?null:s.name})))}catch{return[]}}let Rs=null;const _=()=>C()?Ds:Rs??=new Ns,re={samsung_smart:"Samsung (samsungtv_smart)",lg_webos:"LG (webostv)",android_tv:"Android TV (androidtv_remote)",generic:"כללי"},ee={screen:"מסך",receiver:"מגבר",speaker:"רמקול",player:"נגן"},se={screen:"מסך",receiver:"מגבר",speaker:"רמקול",player:"נגן",group:"קבוצה",session:"סשן",virtual_group:"קבוצה וירטואלית",service:"שירות"},Ne={vendor:"יצרן",remote:"שלט",cast:"Cast",dlna:"DLNA",smartthings:"SmartThings",ma_export:"Music Assistant (יצוא)",ma_import:"Music Assistant (יבוא)",ma_native:"Music Assistant",ma_universal:"Music Assistant (אוניברסלי)",other:"אחר",music:"שכבת המוזיקה",mirror:"מראה (מוסתר)"},Ms={power:"הפעלה",volume:"עוצמה",mute:"השתקה",sources:"מקורות",apps:"אפליקציות",keys:"מקשים",now_playing:"מה מתנגן"},Pe={exact:"מדויק",strong:"חזק",weak:"חלש",manual:"ידני"},Ie=["type","integration","entityId","deviceId","room","floor","status","cast","connections"],js={type:"סוג",integration:"אינטגרציה",entityId:"מזהה ישות",deviceId:"מזהה התקן",room:"חדר",floor:"קומה",status:"מצב",cast:"שידור",connections:"חיבורים"},Hs=1280,qs=1228,Bs=864,Ks=e=>e>=qs?"wide":"md";function Re(e,s){return e==="floor"?!1:e==="room"||e==="cast"?s==="wide":!0}function N(e,s,a){const t=e[s];return typeof t=="boolean"?t:Re(s,a)}function V(e,s){return[N(e,s,"wide")?"":"hw",N(e,s,"md")?"":"hm"].filter(Boolean).join(" ")}const Fs={wide:{x:"var(--hit)",name:"minmax(150px, 1.5fr)",type:"96px",integration:"130px",id:"minmax(200px, 1.9fr)",floor:"110px",room:"minmax(110px, 1fr)",status:"90px",cast:"132px",ap:"64px",connections:"110px"},md:{x:"var(--hit)",name:"minmax(130px, 1.4fr)",type:"84px",integration:"110px",id:"minmax(170px, 1.7fr)",floor:"100px",room:"minmax(100px, 1fr)",status:"80px",cast:"120px",ap:"60px",connections:"104px"}};function ke(e,s){const a=n=>N(e,n,s),t=Fs[s],i=[t.x,t.name];return a("type")&&i.push(t.type),a("integration")&&i.push(t.integration),(a("entityId")||a("deviceId"))&&i.push(t.id),a("floor")&&i.push(t.floor),a("room")&&i.push(t.room),a("status")&&i.push(t.status),a("cast")&&i.push(t.cast),i.push(t.ap),a("connections")&&i.push(t.connections),i.join(" ")}function Gs(e){return[N(e,"floor","wide")?"fl-w":"",N(e,"floor","md")?"fl-m":""].filter(Boolean).join(" ")}function Vs(e,s,a,t){const i={...e};return a===Re(s,t)?delete i[s]:i[s]=a,i}const Us=e=>Object.keys(e).length>0,K="__none__",A="__none__",F={q:"",integrations:[],area:"",type:"",approval:"all",avail:"all",sort:"name",dir:"asc",group:"none",collapsed:[],cols:{}},Ws=["name","type","integration","area","id","status"],Ys=["none","integration","area","type"];function Qs(e){return e==="screen"?"screen":e==="speaker"?"speaker":"other"}const xe={vendor:0};function Xs(e){const a=[...e.endpoints].sort((i,n)=>Number(i.hidden)-Number(n.hidden)||(xe[i.role]??1)-(xe[n.role]??1)).map(i=>i.platform).filter(Boolean),t=e.integrations??[];return[...new Set([...a,...t])]}function Js(e){return e.anchor_entity_id||e.endpoints[0]?.endpoint_id.replace(/^ha:/,"")||""}function Me(e,s){const a=Xs(e),t=e.area_name??"",i=s?s(e.key):null;return{integrations:a,primary:a[0]??"",entityId:Js(e),deviceId:e.ha_device_id??"",area:t,areaKey:t||K,type:Qs(e.kind),available:i!==null?i:typeof e.available=="boolean"?e.available:null}}const _e=e=>e.toLocaleLowerCase("he").normalize("NFKC");function Zs(e,s,a){const t=_e(a).split(/\s+/).filter(Boolean);if(!t.length)return!0;const i=_e([e.name,e.area_name??"",e.floor_name??"",s.entityId,s.deviceId,...e.endpoints.map(n=>n.endpoint_id),...s.integrations,...s.integrations.map(T)].join(`
`));return t.every(n=>i.includes(n))}function ea(e,s,a){return a.integrations.length&&!(a.integrations.includes(A)&&!s.integrations.length)&&!s.integrations.some(t=>a.integrations.includes(t))||a.area&&s.areaKey!==a.area||a.type&&s.type!==a.type||a.approval==="approved"&&!e.approved||a.approval==="pending"&&e.approved||a.avail==="available"&&s.available!==!0||a.avail==="unavailable"&&s.available!==!1?!1:Zs(e,s,a.q)}const P=(e,s)=>e.localeCompare(s,"he",{numeric:!0,sensitivity:"base"}),sa=(e,s,a)=>e===""&&s!==""?1:s===""&&e!==""?-1:a*P(e,s),aa=e=>e===!0?0:e===!1?1:2;function ze(e,s,a){switch(a){case"name":return e.name;case"type":return s.type+":"+e.kind;case"integration":return T(s.primary);case"area":return s.area;case"id":return s.entityId;case"status":return String(aa(s.available))}}function ta(e,s,a){const t=a==="asc"?1:-1;return[...e].sort((i,n)=>sa(ze(i.d,i.f,s),ze(n.d,n.f,s),t)||P(i.d.name,n.d.name)||P(i.d.key,n.d.key))}function ia(e,s,a,t){return s==="integration"?{id:e.f.primary||A,label:T(e.f.primary)||t.integration}:s==="area"?{id:e.f.areaKey,label:e.f.area||t.area}:{id:e.f.type,label:a(e.f.type)}}const je={screen:"מסכים",speaker:"רמקולים ונגנים",other:"אחר"};function na(e,s,a){const t=e.map(c=>({d:c,f:Me(c,a)})),i=ta(t.filter(c=>ea(c.d,c.f,s)),s.sort,s.dir);if(s.group==="none")return{groups:[{id:"",label:"",rows:i}],shown:i.length,total:t.length};const n=new Map;for(const c of i){const u=ia(c,s.group,$=>je[$],{area:"ללא חדר",integration:"ללא אינטגרציה"});n.has(u.id)||n.set(u.id,{...u,rows:[]}),n.get(u.id).rows.push(c)}const r=s.sort===s.group||s.sort==="integration"&&s.group==="integration"?s.dir==="asc"?1:-1:1;return{groups:[...n.values()].sort((c,u)=>c.id===K||c.id===A?1:u.id===K||u.id===A?-1:r*P(c.label,u.label)),shown:i.length,total:t.length}}function oa(e,s){const a=new Map,t=new Map,i=new Set;for(const n of e){const r=Me(n,s);for(const c of r.integrations.length?r.integrations:[A])a.set(c,(a.get(c)??0)+1);const l=t.get(r.areaKey)??{label:r.area||"ללא חדר",count:0};l.count+=1,t.set(r.areaKey,l),i.add(r.type)}return{integrations:[...a].map(([n,r])=>({id:n,count:r})).sort((n,r)=>n.id===A?1:r.id===A?-1:P(n.id,r.id)),areas:[...t].map(([n,r])=>({id:n,...r})).sort((n,r)=>n.id===K?1:r.id===K?-1:P(n.label,r.label)),types:["screen","speaker","other"].filter(n=>i.has(n))}}function ra(e){return!!(e.q.trim()||e.integrations.length||e.area||e.type||e.approval!=="all"||e.avail!=="all")}const la="sw.media-admin.view.";function da(e){const s=e&&typeof e=="object"&&!Array.isArray(e)?e:{},a={};for(const t of Ie)typeof s[t]=="boolean"&&(a[t]=s[t]);return a}function ca(e){const s=e&&typeof e=="object"?e:{},a=(n,r="")=>typeof n=="string"?n:r,t=(n,r,l)=>typeof n=="string"&&r.includes(n)?n:l,i=n=>Array.isArray(n)?n.filter(r=>typeof r=="string").slice(0,100):[];return{q:a(s.q).slice(0,100),integrations:i(s.integrations),area:a(s.area),type:t(s.type,["","screen","speaker","other"],""),approval:t(s.approval,["all","approved","pending"],"all"),avail:t(s.avail,["all","available","unavailable"],"all"),sort:t(s.sort,Ws,"name"),dir:t(s.dir,["asc","desc"],"asc"),group:t(s.group,Ys,"none"),collapsed:i(s.collapsed),cols:da(s.cols)}}const He=(e,s)=>`${la}${e}.${s||"anon"}`;function qe(e,s,a){try{const i=(a??localStorage).getItem(He(e,s));return i?ca(JSON.parse(i)):{...F}}catch{return{...F}}}function Be(e,s,a,t){try{(t??localStorage).setItem(He(e,s),JSON.stringify({...a,q:""}))}catch{}}var pa=Object.defineProperty,ua=Object.getOwnPropertyDescriptor,D=(e,s,a,t)=>{for(var i=t>1?void 0:t?ua(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&pa(s,a,i),i};const Se={name:"שם",type:"סוג",integration:"אינטגרציה",area:"חדר",id:"מזהה",status:"מצב"},Ce={none:"ללא קיבוץ",integration:"לפי אינטגרציה",area:"לפי חדר",type:"לפי סוג"};let k=class extends I{constructor(){super(...arguments),this.devices=[],this.view=F,this.shown=0,this.scope="",this.colsOpen=!1,this.bp="wide",this.onMq=()=>{this.bp=this.mq?.matches?"md":"wide"},this.onDocDown=e=>{this.colsOpen&&!e.composedPath().includes(this)&&(this.colsOpen=!1)}}connectedCallback(){if(super.connectedCallback(),typeof ResizeObserver=="function"&&typeof CSS<"u"&&CSS.supports?.("container-type: inline-size"))this.ro=new ResizeObserver(e=>{const s=e[0]?.contentRect.width??0;if(s<=0)return;this.bp=Ks(s);const a=s<Bs;this.toggleAttribute("data-cards",a),a&&(this.colsOpen=!1)}),this.ro.observe(this);else try{this.mq=window.matchMedia(`(max-width: ${Hs}px)`),this.onMq(),this.mq.addEventListener("change",this.onMq)}catch{}document.addEventListener("pointerdown",this.onDocDown,!0)}disconnectedCallback(){this.mq?.removeEventListener("change",this.onMq),this.ro?.disconnect(),this.ro=void 0,document.removeEventListener("pointerdown",this.onDocDown,!0),super.disconnectedCallback()}emit(e){this.dispatchEvent(new CustomEvent("view-change",{detail:{...this.view,...e},bubbles:!0,composed:!0}))}toggleInt(e){const s=this.view.integrations;this.emit({integrations:s.includes(e)?s.filter(a=>a!==e):[...s,e]})}updated(){const e=this.renderRoot.querySelector("[data-mm-cols-panel]");if(!e)return;e.classList.remove("flip");const s=()=>{const a=e.getBoundingClientRect();return a.left<4||a.right>window.innerWidth-4};s()&&(e.classList.add("flip"),s()&&e.classList.remove("flip"))}pickCol(e,s){this.emit({cols:Vs(this.view.cols,e,s,this.bp)})}onColsKey(e){e.key==="Escape"&&this.colsOpen&&(e.stopPropagation(),this.colsOpen=!1,this.renderRoot.querySelector("[data-mm-cols]")?.focus())}columnsControl(){const e=this.view;return o`<div class="colswrap" @keydown=${s=>this.onColsKey(s)}>
      <button type="button" class="ib" data-mm-cols aria-label="עמודות" title="עמודות" aria-haspopup="true" aria-expanded=${String(this.colsOpen)} aria-controls=${`cols-panel-${this.scope}`}
        @click=${()=>{this.colsOpen=!this.colsOpen}}><sw-icon name="grid" size="16"></sw-icon></button>
      ${this.colsOpen?o`<div class="colspanel" id=${`cols-panel-${this.scope}`} role="group" aria-label="עמודות" data-mm-cols-panel>
        ${Ie.map(s=>o`<label class="colopt"><input type="checkbox" data-mm-col=${s} .checked=${N(e.cols,s,this.bp)}
          @change=${a=>this.pickCol(s,a.target.checked)} />${js[s]}</label>`)}
        ${Us(e.cols)?o`<button type="button" class="colreset" data-mm-cols-reset @click=${()=>this.emit({cols:{}})}>ברירת מחדל</button>`:d}
      </div>`:d}
    </div>`}render(){const e=this.view,s=oa(this.devices,this.live),a=[{id:"",label:"כל החדרים"},...s.areas.map(u=>({id:u.id,label:u.label,count:u.count}))],t=[{id:"",label:"כל הסוגים"},...s.types.map(u=>({id:u,label:je[u]}))],i=[{id:"all",label:"כל האישורים"},{id:"approved",label:"מאושרים"},{id:"pending",label:"ממתינים לאישור"}],n=[{id:"all",label:"כל המצבים"},{id:"available",label:"זמינים"},{id:"unavailable",label:"לא זמינים"}],r=Object.keys(Se).map(u=>({id:u,label:`מיון: ${Se[u]}`})),l=Object.keys(Ce).map(u=>({id:u,label:Ce[u]})),c=u=>$=>this.emit({[u]:$.detail.id});return o`<div class="bar" role="search" data-mm-toolbar=${this.scope}>
      <label class="search"><sw-icon name="search" size="16"></sw-icon>
        <input type="search" .value=${e.q} placeholder="חיפוש שם, מזהה או אינטגרציה" aria-label="חיפוש שם, מזהה או אינטגרציה" data-mm-search
          @input=${u=>this.emit({q:u.target.value})} /></label>
      ${s.areas.length>1?o`<sw-dropdown label="סינון לפי חדר" data-mm-f-area .items=${a} .value=${e.area} @change=${c("area")}></sw-dropdown>`:d}
      ${s.types.length>1?o`<sw-dropdown label="סינון לפי סוג" data-mm-f-type .items=${t} .value=${e.type} @change=${c("type")}></sw-dropdown>`:d}
      <sw-dropdown label="סינון לפי אישור" data-mm-f-approval .items=${i} .value=${e.approval} @change=${u=>this.emit({approval:u.detail.id})}></sw-dropdown>
      <sw-dropdown label="סינון לפי מצב" data-mm-f-avail .items=${n} .value=${e.avail} @change=${u=>this.emit({avail:u.detail.id})}></sw-dropdown>
      <sw-dropdown label="מיון" data-mm-sort .items=${r} .value=${e.sort} @change=${u=>this.emit({sort:u.detail.id})}></sw-dropdown>
      <button type="button" class="ib" data-mm-dir aria-label=${e.dir==="asc"?"סדר עולה, לחץ להיפוך":"סדר יורד, לחץ להיפוך"} @click=${()=>this.emit({dir:e.dir==="asc"?"desc":"asc"})}>
        <sw-icon name=${e.dir==="asc"?"arrowUp":"arrowDown"} size="16"></sw-icon></button>
      <sw-dropdown label="קיבוץ" data-mm-group .items=${l} .value=${e.group} @change=${u=>this.emit({group:u.detail.id,collapsed:[]})}></sw-dropdown>
      ${this.columnsControl()}
      ${ra(e)?o`<button type="button" class="clear" data-mm-clear @click=${()=>this.emit({q:"",integrations:[],area:"",type:"",approval:"all",avail:"all"})}>נקה סינון</button>`:d}
      <span class="count" data-mm-shown role="status">${this.shown===this.devices.length?`${this.devices.length}`:`${this.shown} מתוך ${this.devices.length}`}</span>
    </div>
    ${s.integrations.length>1?o`<div class="ints" role="group" aria-label="סינון לפי אינטגרציה" data-mm-f-int>
      ${s.integrations.map(u=>o`<button type="button" class="chip" data-mm-int=${u.id} aria-pressed=${String(e.integrations.includes(u.id))}
        @click=${()=>this.toggleInt(u.id)}>${u.id===A?"ללא אינטגרציה":T(u.id)}<span class="n">${u.count}</span></button>`)}
    </div>`:d}`}};k.styles=O`
    :host {
      display: block;
      --hit: var(--sw-touch-desktop);
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1 1 220px;
      min-inline-size: 180px;
      max-inline-size: 360px;
      min-block-size: var(--hit);
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-3);
    }
    .search:focus-within {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .search input {
      flex: 1;
      min-inline-size: 0;
      border: 0;
      outline: 0;
      background: none;
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      min-block-size: var(--hit);
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: var(--hit);
      block-size: var(--hit);
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      font: inherit;
    }
    .ib:focus-visible,
    .clear:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .clear {
      border: 0;
      background: none;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      min-block-size: var(--hit);
      padding-inline: 6px;
    }
    .colswrap {
      position: relative;
    }
    .colspanel {
      position: absolute;
      inset-block-start: calc(100% + 4px);
      inset-inline-end: 0;
      z-index: 5;
      display: grid;
      gap: 2px;
      min-inline-size: 190px;
      padding: 6px;
      /* the column chooser is a menu: opaque, never see-through (owner 2026-10-13) */
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-menu-surface);
      box-shadow: var(--sw-shadow-lg, 0 8px 24px rgba(0, 0, 0, 0.18));
    }
    .colspanel.flip {
      inset-inline-end: auto;
      inset-inline-start: 0;
    }
    .colopt {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: var(--hit);
      padding-inline: 8px;
      border-radius: var(--sw-r-xs);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .colopt:hover {
        background: var(--sw-surface-2);
      }
    }
    .colopt:focus-within {
      outline: 2px solid var(--sw-accent);
      outline-offset: -2px;
    }
    .colopt input {
      inline-size: 16px;
      block-size: 16px;
      margin: 0;
      accent-color: var(--sw-accent);
    }
    .colreset {
      border: 0;
      background: none;
      color: var(--sw-accent-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      min-block-size: var(--hit);
      text-align: start;
      padding-inline: 8px;
    }
    .colreset:focus-visible,
    .ib[aria-expanded='true'] {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    @media (max-width: 860px) {
      .colswrap {
        display: none;
      }
    }
    :host([data-cards]) .colswrap {
      display: none;
    }
    .ints {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      padding-block-start: 8px;
    }
    .count {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-inline-start: auto;
    }
    @media (max-width: 1100px) {
      :host {
        --hit: 44px;
      }
      .search {
        max-inline-size: none;
      }
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: var(--hit);
      padding-inline: 12px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      white-space: nowrap;
    }
    .chip[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .chip:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 1px;
    }
    .chip .n {
      font-size: var(--sw-fs-xs);
      opacity: 0.75;
    }
  `;D([M({attribute:!1})],k.prototype,"devices",2);D([M({attribute:!1})],k.prototype,"view",2);D([M({attribute:!1})],k.prototype,"live",2);D([M({type:Number})],k.prototype,"shown",2);D([M()],k.prototype,"scope",2);D([p()],k.prototype,"colsOpen",2);D([p()],k.prototype,"bp",2);k=D([R("media-admin-toolbar")],k);const ma=[{key:"x",label:"",cls:"c-x"},{key:"name",label:"שם",cls:"c-name"},{key:"type",label:"סוג",cls:"c-type",opt:"type"},{key:"integration",label:"אינטגרציה",cls:"c-int",opt:"integration"},{key:"id",label:"מזהה",cls:"c-id",opt:"id"},{key:"x",label:"קומה",cls:"c-fl",opt:"floor"},{key:"area",label:"חדר",cls:"c-area",opt:"room"},{key:"status",label:"מצב",cls:"c-st",opt:"status"},{key:"x",label:"שידור",cls:"c-cast",opt:"cast"},{key:"x",label:"מאושר",cls:"c-ap"},{key:"x",label:"חיבורים",cls:"c-cn",opt:"connections"}];function Ke(e,s){if(!s)return"";if(s!=="id")return V(e,s);const a=V(e,"entityId").split(" "),t=V(e,"deviceId").split(" ");return a.filter(i=>i&&t.includes(i)).join(" ")}function ha(e){const s=e.view;return o`<div class="thead" role="row">${ma.map(a=>({...a,h:Ke(s.cols,a.opt)})).map(a=>a.key==="x"?o`<div role="columnheader" class=${`th ${a.cls} ${a.h}`}>${a.label}</div>`:o`<div role="columnheader" class=${`th ${a.cls} ${a.h}`} aria-sort=${s.sort===a.key?s.dir==="asc"?"ascending":"descending":"none"}>
        <button type="button" class="sortb" data-mm-th=${a.key} @click=${()=>e.onView({...s,sort:a.key,dir:s.sort===a.key&&s.dir==="asc"?"desc":"asc"})}>${a.label}${s.sort===a.key?o`<sw-icon name=${s.dir==="asc"?"arrowUp":"arrowDown"} size="12"></sw-icon>`:d}</button></div>`)}</div>`}function Ae(e,s,a){const t=e.editing.has(s.key),i=e.endpoints.has(s.key),n=e.status?e.status(s,a):a.available===null?null:a.available?{kind:"ok",label:"זמין"}:{kind:"stale",label:"לא זמין"},r=a.integrations.length-1,l=e.view.cols,c=Y=>V(l,Y),u=Ke(l,"id"),$=Qe(s.cast);return o`<div class=${`item${t?" sel":""}`} role="rowgroup" data-mm-admin-device=${s.key}>
    <div class="tr" role="row">
      <div role="cell" class="c c-x"><button type="button" class="eb" data-mm-edit=${s.key} aria-expanded=${String(t)} aria-label=${`${t?"סגור עריכה":"עריכה"}: ${s.name}`} @click=${()=>e.onEdit(s.key)}>
        <sw-icon name=${t?"chevronDown":"chevronBack"} size="14"></sw-icon></button></div>
      <div role="cell" class="c c-name"><span class="nm" title=${s.name} data-mm-row-name=${s.key}>${s.name}</span>${e.saved===s.key?o`<span class="ok" role="status">נשמר</span>`:d}</div>
      <div role="cell" class=${`c c-type ${c("type")}`}><span class="lb">סוג</span>${e.typeLabel(s)}</div>
      <div role="cell" class=${`c c-int ${c("integration")}`} data-mm-int-cell=${s.key}><span class="lb">אינטגרציה</span>${a.integrations.length?o`<span class="mono" title=${a.integrations.map(le).join(", ")}>${T(a.primary)}</span>${r>0?o`<span class="more">+${r}</span>`:d}`:o`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-id ${u}`} data-mm-id-cell=${s.key}>
        ${a.entityId?o`<span class=${`idl ${c("entityId")}`}><span class="mono" title=${a.entityId} data-mm-entity-id>${a.entityId}</span>
          <button type="button" class="cp" data-mm-copy=${s.key} aria-label=${`העתק מזהה: ${a.entityId}`} @click=${()=>e.onCopy(a.entityId)}><sw-icon name="copy" size="14"></sw-icon></button></span>`:d}
        ${a.deviceId?o`<span class=${`idl ${c("deviceId")}`}><span class="mono dim" title=${a.deviceId} data-mm-device-id>${a.deviceId}</span>
          <button type="button" class="cp" data-mm-copy-device=${s.key} aria-label=${`העתק מזהה התקן: ${a.deviceId}`} @click=${()=>e.onCopy(a.deviceId)}><sw-icon name="copy" size="14"></sw-icon></button></span>`:d}
        ${!a.entityId&&!a.deviceId?o`<span class="muted">—</span>`:d}</div>
      <div role="cell" class=${`c c-fl ${c("floor")}`} data-mm-floor-cell=${s.key}>${s.floor_name?o`<span class="floor" title=${s.floor_name}>${s.floor_name}</span>`:o`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-area ${c("room")}`}><span class="lb">חדר</span>${a.area?o`${s.floor_name?o`<span class="fp">${s.floor_name} ‹ </span>`:d}${a.area}`:o`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-st ${c("status")}`} data-mm-status=${s.key}>${n?o`<sw-badge kind=${n.kind} label=${n.label}></sw-badge>`:o`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-cast ${c("cast")}`} data-mm-cast=${s.key} data-mm-cast-method=${s.cast?.method??""}><span class="lb">שידור</span>${$?o`<sw-badge kind=${$.kind} label=${$.label} title=${$.title}></sw-badge>`:o`<span class="muted">—</span>`}</div>
      <div role="cell" class="c c-ap"><sw-toggle label=${`מאושר: ${s.name}`} labelHidden .checked=${s.approved} data-mm-approved=${s.key} @change=${Y=>e.onApprove(s,Y.detail.checked)}></sw-toggle></div>
      <div role="cell" class=${`c c-cn ${c("connections")}`}><button type="button" class="cnb" data-mm-toggle-endpoints=${s.key} aria-expanded=${String(i)} @click=${()=>e.onEndpoints(s.key)}>חיבורים (${s.endpoints.length}) ${i?"▴":"◂"}</button></div>
    </div>
    ${t||i?o`<div class="detail" role="row"><div role="cell" class="dcell">
      ${t?e.form(s):d}${i?e.connections(s):d}</div></div>`:d}
  </div>`}function va(e,s){const a=e.view,t=a.collapsed.includes(s.id);return o`<div class="ghead" role="row"><button type="button" class="gb" data-mm-group-head=${s.id} aria-expanded=${String(!t)}
    @click=${()=>e.onView({...a,collapsed:t?a.collapsed.filter(i=>i!==s.id):[...a.collapsed,s.id]})}>
    <sw-icon name=${t?"chevronBack":"chevronDown"} size="14"></sw-icon><span class="gl">${s.label}</span><span class="gc" data-mm-group-count>${s.rows.length}</span></button></div>`}function Fe(e){const{groups:s,shown:a}=na(e.devices,e.view,e.live);return o`<media-admin-toolbar scope=${e.scope} .devices=${e.devices} .view=${e.view} .live=${e.live} .shown=${a} @view-change=${t=>e.onView(t.detail)}></media-admin-toolbar>
    <div class=${`tbl ${Gs(e.view.cols)}`} style=${`--cols-w: ${ke(e.view.cols,"wide")}; --cols-m: ${ke(e.view.cols,"md")}`} role="table" aria-label=${e.scope==="screens"?"מסכים":"נגנים ורמקולים"} data-mm-table=${e.scope}>
      ${ha(e)}
      ${a===0?o`<div class="none muted" data-mm-no-match>${e.devices.length?"אין התאמות לסינון":e.none}</div>`:d}
      ${e.view.group==="none"?ie(s[0].rows,t=>t.d.key,t=>Ae(e,t.d,t.f)):s.map(t=>o`<div role="rowgroup" class="grp" data-mm-grp=${t.id}>${va(e,t)}
            ${e.view.collapsed.includes(t.id)?d:ie(t.rows,i=>i.d.key,i=>Ae(e,i.d,i.f))}</div>`)}
    </div>`}const Ee=O`
    .thead,
    .c-fl {
      display: none;
    }
    .tr {
      grid-template-columns: 44px minmax(0, 1fr) auto;
      grid-template-areas: 'x name ap' 'x type st' 'x int int' 'x id id' 'x area area' 'x cast cast' 'x cn cn';
      row-gap: 4px;
      padding: 8px 6px;
    }
    .c-x {
      grid-area: x;
      align-self: start;
    }
    .c-name {
      grid-area: name;
    }
    .c-ap {
      grid-area: ap;
      justify-self: end;
    }
    .c-type {
      grid-area: type;
    }
    .c-st {
      grid-area: st;
      justify-self: end;
    }
    .c-int {
      grid-area: int;
    }
    .c-id {
      grid-area: id;
    }
    .c-area {
      grid-area: area;
      display: flex;
    }
    .c-cast {
      grid-area: cast;
      display: flex;
    }
    .c-cn {
      grid-area: cn;
    }
    .c .lb {
      display: inline;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
`,Ge=O`
  /* 2.4.6: the table chooses its layout by the width it actually has (a container query on .tbl), not by the viewport: on a
     settings page the navigation column takes 236 px, so a 1440 px window no longer leaves room for the wide columns. The
     wide set needs 1228 px at the default columns, the tablet set 864 px (CQ_WIDE / CQ_CARDS in media-admin-list-logic.ts);
     the viewport rules of before stay below as the fallback for a browser without container queries. */
  .tbl {
    --hit: var(--sw-touch-desktop);
    display: block;
    margin-block-start: 10px;
    --cols: var(--cols-w);
    container: mm-tbl / inline-size;
  }
  /* the user's column choices (columns control in the toolbar): hw = hidden in the wide layout, hm = hidden in the tablet
     layout; the cards ignore both */
  @container mm-tbl (min-width: 1228px) {
    .hw {
      display: none !important;
    }
    .tbl.fl-w .fp {
      display: none;
    }
  }
  @container mm-tbl (min-width: 864px) and (max-width: 1227.98px) {
    .hm {
      display: none !important;
    }
    .tbl.fl-m .fp {
      display: none;
    }
  }
  @supports not (container-type: inline-size) {
    @media (min-width: 1281px) {
      .hw {
        display: none !important;
      }
      .tbl.fl-w .fp {
        display: none;
      }
    }
    @media (min-width: 861px) and (max-width: 1280px) {
      .hm {
        display: none !important;
      }
      .tbl.fl-m .fp {
        display: none;
      }
    }
  }
  .fp {
    color: var(--sw-text-3);
  }
  .floor {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .thead,
  .tr {
    display: grid;
    grid-template-columns: var(--cols);
    align-items: center;
    column-gap: 10px;
    padding-inline: 6px;
  }
  .thead {
    position: sticky;
    inset-block-start: 0;
    z-index: 2;
    background: var(--sw-surface);
    border-block-end: 1px solid var(--sw-border-strong);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-text-2);
    min-block-size: 34px;
  }
  .sortb {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border: 0;
    background: none;
    padding: 0;
    color: inherit;
    font: inherit;
    cursor: pointer;
    min-block-size: var(--hit);
    min-inline-size: var(--hit);
    justify-content: center;
  }
  .sortb:focus-visible,
  .gb:focus-visible,
  .cp:focus-visible,
  .cnb:focus-visible,
  .eb:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 1px;
  }
  .item {
    border-block-end: 1px solid var(--sw-border);
  }
  .item.sel {
    background: var(--sw-surface-2);
  }
  .tr {
    min-block-size: 52px;
    font-size: var(--sw-fs-sm);
  }
  .c {
    min-inline-size: 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .c .lb {
    display: none;
  }
  /* R5-MEDIA-ENERGY-297: the device name leads the row - 14.5 px semibold in the heading ink; the header row reads as a header */
  .nm {
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-md);
    color: var(--sw-heading);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  .c-int .mono {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c-id {
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
  }
  .idl {
    display: flex;
    align-items: center;
    gap: 2px;
    max-inline-size: 100%;
    min-inline-size: 0;
  }
  .idl .mono {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mono.dim {
    color: var(--sw-text-3);
  }
  .more {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .cp {
    flex: none;
    display: inline-grid;
    place-items: center;
    inline-size: var(--hit);
    block-size: var(--hit);
    padding: 0;
    border: 0;
    border-radius: var(--sw-r-xs);
    background: none;
    color: var(--sw-text-3);
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .cp:hover {
      background: var(--sw-surface-2);
      color: var(--sw-text);
    }
  }
  .cp:active {
    background: var(--sw-surface-3);
  }
  .cnb {
    color: var(--sw-accent-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
    background: none;
    border: 0;
    padding: 0 6px;
    min-block-size: var(--hit);
    min-inline-size: var(--hit);
  }
  .ghead {
    display: block;
    background: var(--sw-surface-2);
    border-block-end: 1px solid var(--sw-border);
  }
  .grp + .grp .ghead {
    border-block-start: 1px solid var(--sw-border);
  }
  .gb {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    min-block-size: var(--hit);
    padding-inline: 8px;
    border: 0;
    background: none;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-medium);
    cursor: pointer;
    text-align: start;
  }
  .gc {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  .detail {
    display: block;
    padding: 4px 12px 12px;
    border-block-start: 1px dashed var(--sw-border);
  }
  .dcell {
    display: block;
  }
  .none {
    padding: 16px 6px;
  }
  .eb {
    display: inline-grid;
    place-items: center;
    inline-size: var(--hit);
    block-size: var(--hit);
    padding: 0;
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface);
    color: var(--sw-text);
    cursor: pointer;
  }
  /* the tablet column set below the wide width (the cards below override the grid) */
  @container mm-tbl (max-width: 1227.98px) {
    .thead,
    .tr {
      --cols: var(--cols-m);
    }
  }
  @supports not (container-type: inline-size) {
    @media (max-width: 1280px) {
      .tbl {
        --cols: var(--cols-m);
      }
    }
  }
  /* the touch targets follow the touch layout of the whole window (the shell's rule), not the table's width */
  @media (max-width: 1100px) {
    .tbl {
      --hit: 44px;
    }
  }
  @container mm-tbl (max-width: 863.98px) {
    ${Ee}
  }
  @supports not (container-type: inline-size) {
    @media (max-width: 860px) {
      ${Ee}
    }
  }
`;var ga=Object.defineProperty,ba=Object.getOwnPropertyDescriptor,h=(e,s,a,t)=>{for(var i=t>1?void 0:t?ba(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&ga(s,a,i),i};const fa=(e=3e3)=>new Promise(s=>setTimeout(s,e)),wa=["speaker","player","receiver"],ae={ma:"music_assistant",sonos:"sonos",heos:"heos",vendor:"יצרן",none:"ללא"},Oe=["speaker","player","receiver","group"],$a={music:"שכבת המוזיקה",mirror:"מראה (מוסתר)"},ya={favourites:[],stations:[],playlists:[]},G=["favourites","stations","playlists"];let m=class extends I{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.phase="loading",this.devices=[],this.live=new Map,this.status=null,this.sugg=null,this.answered=new Set,this.nonPhys=null,this.presets=null,this.fav=null,this.favLists=ya,this.areas=[],this.open=new Set,this.editing=new Set,this.view={...F},this.npOpen=!1,this.saved="",this.error="",this.note="",this.deleting=null,this.busy=!1,this.noteTimer=0,this.offPush=null,this.setView=e=>{this.view=e,Be("players",U.me?.user.id??"",e)},this.liveAvail=e=>{const s=this.live.get(e);return s?s.live.power!=="unavailable":null}}connectedCallback(){super.connectedCallback(),this.view=qe("players",U.me?.user.id??""),this.load(),C()&&(this.offPush=Je(e=>{e.type==="media_groups_changed"&&this.loadGroups()}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer),this.offPush?.(),this.offPush=null}async load(){if(C()&&!B("system.configure")){this.phase="forbidden";return}const[e,s,a,t,i,n]=await Promise.allSettled([_().list(),b().status(),b().list(),b().suggestions(),b().nonPhysical(),Is()]);e.status==="fulfilled"&&(this.devices=e.value.devices.filter(r=>Oe.includes(r.kind))),this.status=s.status==="fulfilled"?s.value:null,this.live=a.status==="fulfilled"?new Map(a.value.devices.map(r=>[r.key,r])):new Map,this.sugg=t.status==="fulfilled"?t.value:null,this.nonPhys=i.status==="fulfilled"?i.value.devices:null,this.areas=n.status==="fulfilled"?n.value:[],await Promise.all([this.loadGroups(),this.loadFavs()]),this.phase="ready"}async loadGroups(){try{this.presets=await b().presets()}catch{this.presets=null}}async loadFavs(){try{const e=await b().favourites(),s=[...this.live.values()].find(i=>i.caps.favourites||i.caps.stations),a={favourites:[],stations:[],playlists:[]},t=new Map(e.items.map(i=>[i.item_ref,i]));for(const i of G){if(!s||!s.caps[i])continue;const r=(await b().library(s.key,i,0,!0)).items.map(l=>({ref:l.item_ref,name:t.get(l.item_ref)?.name??l.name,artist:l.artist,hidden:!!l.hidden}));a[i]=r.sort((l,c)=>(t.get(l.ref)?.order??1e6)-(t.get(c.ref)?.order??1e6))}this.favLists=a,this.fav=e}catch{this.fav=null}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}async patchDevice(e,s){this.error="";try{const a=await _().update(e.key,s);this.devices=this.devices.map(t=>t.key===e.key?a:t),this.saved=e.key,fa().then(()=>this.saved=this.saved===e.key?"":this.saved)}catch(a){this.error=v(a),await this.load()}}async approveAll(){const e=this.devices.filter(s=>!s.approved).length;if(e)try{const s=await _().approve(null,!0,["speaker","player","receiver","group"]);this.devices=this.devices.map(a=>({...a,approved:!0})),this.say(`אושרו ${s.changed||e} נגנים`),await this.load()}catch(s){this.error=v(s)}}async approveHelper(e,s){this.error="";try{await _().update(e,{approved:s}),this.nonPhys=(await b().nonPhysical()).devices,this.say("נשמר")}catch(a){this.error=v(a)}}async link(e){try{const s=await _().link(e);this.devices=s.devices.filter(a=>Oe.includes(a.kind)),this.say("נשמר")}catch(s){this.error=v(s)}}async answer(e,s){this.error="",this.answered=new Set([...this.answered,e.id]),await this.link({op:s,endpoint_id:e.endpoint_id,device_key:e.device_key}),this.error&&(this.answered=new Set([...this.answered].filter(a=>a!==e.id)))}async deletePreset(){const e=this.deleting;if(!(!e||this.busy)){this.busy=!0;try{await b().deletePreset(e.id,e.revision),this.deleting=null,this.say("נמחק"),await this.loadGroups()}catch(s){this.error=he(s),s instanceof De&&s.code==="revision_conflict"&&(this.deleting=null),await this.loadGroups()}finally{this.busy=!1}}}async saveFav(e,s){const a=this.fav;if(!a)return;const t=G.flatMap(i=>s[i]).map((i,n)=>({item_ref:i.ref,hidden:i.hidden,order:n}));this.error="";try{this.fav=await b().saveFavourites({kinds_on:e,items:t},a.revision),this.favLists=s,this.say("נשמר")}catch(i){this.error=he(i),await this.loadFavs()}}toggleKind(e,s){const a=this.fav;a&&this.saveFav(s?[...new Set([...a.kinds_on,e])]:a.kinds_on.filter(t=>t!==e),this.favLists)}setHidden(e,s,a){this.saveFav(this.fav.kinds_on,{...this.favLists,[e]:this.favLists[e].map(t=>t.ref===s?{...t,hidden:a}:t)})}moveFav(e,s,a){const t=[...this.favLists[e]],i=t.findIndex(r=>r.ref===s),n=i+a;i<0||n<0||n>=t.length||([t[i],t[n]]=[t[n],t[i]],this.saveFav(this.fav.kinds_on,{...this.favLists,[e]:t}))}toggle(e,s){const a=new Set(this[e]);a.delete(s)||a.add(s),this[e]=a}async copy(e){try{await navigator.clipboard.writeText(e),this.say("הועתק")}catch{this.say("ההעתקה נחסמה בדפדפן")}}table(e){return Fe({scope:"players",devices:e,view:this.view,live:this.liveAvail,editing:this.editing,endpoints:this.open,saved:this.saved,status:(s,a)=>{const t=this.live.get(s.key)?.live.power;return t==="unavailable"?{kind:"stale",label:"לא זמין"}:t==="off"?{kind:"neutral",label:"כבוי"}:a.available===null?null:a.available?{kind:"ok",label:"זמין"}:{kind:"stale",label:"לא זמין"}},form:s=>this.form(s),connections:s=>this.connections(s),typeLabel:s=>se[s.kind]??s.kind,onView:this.setView,onEdit:s=>this.toggle("editing",s),onEndpoints:s=>this.toggle("open",s),onApprove:(s,a)=>void this.patchDevice(s,{approved:a}),onCopy:s=>void this.copy(s),none:"לא זוהו נגנים."})}form(e){const s=this.devices.filter(r=>r.key!==e.key&&r.kind==="receiver"),a=e.volume_night??null,t=[e.floor_name,e.area_name].filter(Boolean).join(" ‹ "),i=(e.area_id??null)===null&&!e.area_name,n=r=>{const l=a??ge,c=ps(r.from??l.from,r.to??l.to,String(r.max??l.max));c&&this.patchDevice(e,{volume_night:c})};return o`<div class="dev" data-mm-form=${e.key}>
      <div class="line">
        <label class="f">שם
          <input type="text" .value=${e.name} maxlength="60" data-mm-name=${e.key} @change=${r=>void this.patchDevice(e,{display_name:r.target.value})} />
        </label>
        <label class="f">סוג
          ${e.kind==="group"?o`<span>${se.group}</span>`:o`<select data-mm-kind=${e.key} @change=${r=>void this.patchDevice(e,{kind:r.target.value})}>
            ${wa.map(r=>o`<option value=${r} ?selected=${e.kind===r}>${se[r]}</option>`)}
          </select>`}
        </label>
        <span class="f">זיהוי<sw-badge kind=${e.confidence==="weak"?"stale":"neutral"} label=${Pe[e.confidence]}></sw-badge></span>
        <label class="f">חדר
          ${i&&this.areas.length?o`<select data-mm-area=${e.key} @change=${r=>{const l=r.target.value;l&&this.patchDevice(e,{area_id:l})}}>
                <option value="" selected>ללא חדר</option>${this.areas.map(r=>o`<option value=${r.id}>${r.name}${r.floor_name?` · ${r.floor_name}`:""}</option>`)}</select>`:o`<span data-mm-place=${e.key}>${t||"ללא חדר"}</span>`}
        </label>
        ${e.zones?.length?o`<span class="f">אזורים<span>${e.zones.map(r=>r.name).join(" · ")}</span></span>`:d}
        <span class="grow"></span>
      </div>
      <div class="line">
        ${e.kind!=="receiver"&&e.kind!=="group"?o`<label class="f">מגבר מקושר
          <select data-mm-link=${e.key} @change=${r=>{const l=r.target.value;this.patchDevice(e,{audio_link_key:l||null})}}>
            <option value="" ?selected=${!e.audio_link_key}>ללא</option>
            ${s.map(r=>o`<option value=${r.key} ?selected=${e.audio_link_key===r.key}>${r.name}</option>`)}
          </select></label>`:d}
        <label class="f">תקרת עוצמה
          <input type="number" min="0" max="100" .value=${e.volume_max===null?"":String(e.volume_max)} placeholder="ללא" data-mm-volmax=${e.key}
            @change=${r=>{const l=ls(r.target.value);l!=="invalid"&&this.patchDevice(e,{volume_max:l})}} />
        </label>
        <span class="f">חלון לילה
          <span class="night">
            <sw-toggle label=${`חלון לילה: ${e.name}`} labelHidden .checked=${!!a} data-mm-night=${e.key} @change=${r=>void this.patchDevice(e,{volume_night:r.detail.checked?{...ge}:null})}></sw-toggle>
            ${a?o`<span>מ־</span><input type="time" lang=${W()} .value=${a.from} data-mm-night-from=${e.key} aria-label="מ־" @change=${r=>n({from:r.target.value})} />
              <span>עד</span><input type="time" lang=${W()} .value=${a.to} data-mm-night-to=${e.key} aria-label="עד" @change=${r=>n({to:r.target.value})} />
              <span>תקרה</span><input type="number" min="0" max="100" .value=${String(a.max)} data-mm-night-max=${e.key} aria-label="תקרה בלילה" @change=${r=>n({max:Number(r.target.value)})} />`:o`<span class="muted">כבוי</span>`}
          </span>
        </span>
      </div>
      ${e.cast?o`<div class="muted" data-mm-cast-line=${e.key}>שידור למסך: ${Te(e.cast)}</div>`:d}
    </div>`}connections(e){return o`<div data-mm-endpoints=${e.key}>${e.music_provider&&e.music_provider!=="none"?o`<div class="muted">שכבת המוזיקה: ${ae[e.music_provider]}</div>`:d}${e.endpoints.map(s=>o`<div class="ep" data-mm-endpoint=${s.endpoint_id}>
        <span class="mono" data-mm-ep-platform=${s.platform} title=${le(s.platform)}>${T(s.platform)}</span>
        <span>${$a[s.role]??Ne[s.role]??s.role}${s.hidden?o` <sw-badge kind="neutral" label="מוסתר"></sw-badge>`:d}</span>
        <span class="muted">${s.primary_for.length?`עונה על: ${s.primary_for.join(", ")}`:"כפילות"} · שלב ${s.rule}${s.link_source==="manual"?" · ידני":""}</span>
        <span class="acts">
          ${s.hidden?o`<sw-button size="sm" data-mm-restore=${s.endpoint_id} @click=${()=>void this.link({op:"restore",endpoint_id:s.endpoint_id})}>שחזר</sw-button>`:o`<sw-button size="sm" data-mm-ignore=${s.endpoint_id} @click=${()=>void this.link({op:"ignore",endpoint_id:s.endpoint_id})}>התעלם</sw-button>
              ${e.endpoints.length>1?o`<sw-button size="sm" data-mm-unlink=${s.endpoint_id} @click=${()=>void this.link({op:"unlink",endpoint_id:s.endpoint_id})}>פצל</sw-button>`:d}`}
        </span>
      </div>`)}</div>`}playersCard(){const e=this.devices;if(!e.length)return d;const s=e.filter(r=>r.approved).length,a=e.length-s,t=e.filter(r=>!r.area_name&&!r.area_id).length,i=e.filter(r=>this.live.get(r.key)?.live.power==="unavailable").length,n=[`${s} מאושרים`,a?`${a} ממתינים`:"",t?`${t} ללא חדר`:"",i?`${i} לא זמינים`:""].filter(Boolean).join(" · ");return o`<sw-card heading="נגנים ורמקולים" data-mm-players>
      <div class="hd"><span class="muted" data-mm-players-count>${n}</span><span class="grow"></span>
        <sw-button size="sm" variant="primary" icon="check" data-mm-approve-players ?disabled=${!a} @click=${()=>void this.approveAll()}>אשר את כל הנגנים שזוהו${a?` (${a})`:""}</sw-button></div>
      <div class="muted">רק נגנים מאושרים מופיעים ב"מולטימדיה". תקרת עוצמה וחלון לילה חלים רק כשהוגדרו.</div>
      ${this.table(e)}
    </sw-card>`}wizardCard(){const e=this.sugg?.filter(t=>!this.answered.has(t.id)),s=this.nonPhys;if(!e&&!s?.length)return d;const a={session:"סשן",virtual_group:"קבוצה וירטואלית",service:"שירות"};return o`<sw-card heading="איחוד כפילויות" data-mm-wizard>
      ${e?o`<div class="hd"><span class="muted" data-mm-wizard-count>${e.length?`${e.length} הצעות`:"אין הצעות פתוחות"}</span></div>
        ${ie(e,t=>t.id,t=>o`<div class="row" data-mm-wizard-row=${t.id}><span class="lbl"><span><span class="mono">${t.endpoint_label}</span> ← ${t.device_name}</span><span class="muted">${Ze[t.reason]} · שלב ${t.rule}</span></span>
          <span class="acts"><sw-button size="sm" variant="primary" icon="link" data-mm-wizard-accept=${t.id} @click=${()=>void this.answer(t,"link")}>אחד</sw-button>
            <sw-button size="sm" data-mm-wizard-ignore=${t.id} @click=${()=>void this.answer(t,"ignore")}>התעלם</sw-button></span></div>`)}`:d}
      ${s?.length?o`<div class="row" data-mm-nonphysical><span class="lbl">רכיבים לא פיזיים<span class="muted">${s.length} רשומות: סשנים, קבוצות עזר ושירותים · לא מוצגים כנגנים ולא מוצעים לאיחוד</span></span>
          <sw-button size="sm" data-mm-np-toggle aria-expanded=${String(this.npOpen)} @click=${()=>this.npOpen=!this.npOpen}>${this.npOpen?"הסתר":"הצג"}</sw-button></div>
        ${this.npOpen?s.map(t=>o`<div class="row" data-mm-np-row=${t.key}><span class="lbl">${t.name}</span>
          ${t.kind==="virtual_group"?o`<label class="f inline">מוצג בקבוצות<sw-toggle label=${`מוצג בקבוצות: ${t.name}`} labelHidden .checked=${!!t.approved} data-mm-np-approved=${t.key} @change=${i=>void this.approveHelper(t.key,i.detail.checked)}></sw-toggle></label>`:d}
          <sw-badge kind="neutral" label=${a[t.kind]??t.kind}></sw-badge></div>`):d}`:d}
    </sw-card>`}presetsCard(){const e=this.presets;if(!e)return d;const s=[...this.live.values()];return o`<sw-card heading="קבוצות שמורות" data-mm-presets>
      <div class="hd"><span class="muted">${e.length} שמורות</span><span class="grow"></span>
        <sw-button size="sm" icon="plus" data-mm-preset-new @click=${()=>this.editor?.show(ve(null))}>קבוצה חדשה</sw-button></div>
      ${e.map(a=>{const t=ds(a,s),i=cs(a,s);return o`<div class="row" data-mm-preset=${a.id}><span class="lbl">${a.name}<span class="muted">${t.map(n=>n.room).join(", ")}${i>1?` · ${i} קומות · דורש אישור בהפעלה`:""}${a.volumes?" · עם עוצמות":""}</span></span>
        <span class="acts"><sw-button size="sm" icon="edit" data-mm-preset-edit=${a.id} @click=${()=>this.editor?.show(ve(a))}>ערוך</sw-button>
          <sw-button size="sm" variant="danger" data-mm-preset-delete=${a.id} @click=${()=>this.deleting=a}>מחק</sw-button></span></div>`})}
      ${e.length?d:o`<div class="muted">אין קבוצות שמורות.</div>`}
    </sw-card>`}favCard(){const e=this.fav;if(!e)return d;const s=this.status?.library,a=G.some(n=>this.favLists[n].length),t=s?.provider==="sonos",i=G.filter(n=>!(n==="playlists"&&t));return o`<sw-card heading="מועדפים ותחנות" data-mm-favs>
      <div class="row"><span class="lbl">לשוניות בנגן<span class="muted">רשימה אחת לכולם</span></span>
        <span class="acts">${i.map(n=>o`<label class="f inline">${Q[n]}<sw-toggle label=${Q[n]} labelHidden .checked=${e.kinds_on.includes(n)} data-mm-fav-kind=${n} @change=${r=>this.toggleKind(n,r.detail.checked)}></sw-toggle></label>`)}</span></div>
      <div class="row"><span class="lbl">מקור<span class="muted">${s?.provider==="ma"?"Music Assistant · המועדפים של ההתקנה":t?"Sonos · המועדפים של הרמקולים (source_list) · אין פלייליסטים בלי Music Assistant":"אין ספריית מוזיקה"}</span></span></div>
      ${a?i.map(n=>this.favList(n)):d}
    </sw-card>`}favList(e){const s=this.favLists[e];return s.length?o`<div class="fgrp" data-mm-fav-group=${e}><h3>${Q[e]} · סדר והצגה</h3>${s.map((a,t)=>o`<div class=${a.hidden?"frow off":"frow"} data-mm-fav=${a.ref}>
      <sw-toggle label=${`הצג: ${a.name}`} labelHidden .checked=${!a.hidden} data-mm-fav-show=${a.ref} @change=${i=>this.setHidden(e,a.ref,!i.detail.checked)}></sw-toggle>
      <span class="nm"><b>${a.name}</b>${a.artist?o`<span class="muted">${a.artist}</span>`:d}</span>
      <button type="button" class="ib" data-mm-fav-up=${a.ref} aria-label=${`הקדם: ${a.name}`} ?disabled=${t===0} @click=${()=>this.moveFav(e,a.ref,-1)}><sw-icon name="arrowUp" size="14"></sw-icon></button>
      <button type="button" class="ib" data-mm-fav-down=${a.ref} aria-label=${`אחר: ${a.name}`} ?disabled=${t===s.length-1} @click=${()=>this.moveFav(e,a.ref,1)}><sw-icon name="arrowDown" size="14"></sw-icon></button>
    </div>`)}</div>`:d}connectionCard(){const e=this.status;if(!e?.library)return d;const s=e.library,a=[...this.live.values()].filter(n=>n.kind!=="group").length,t=[...this.live.values()].filter(n=>n.kind!=="group"&&n.live.power==="unavailable").length,i=new Map;for(const n of this.devices)n.music_provider&&n.music_provider!=="none"&&i.set(n.music_provider,(i.get(n.music_provider)??0)+1);return o`<sw-card heading="חיבור" data-mm-connection>
      ${s.provider==="ma"||s.state==="unavailable"?o`<div class="row"><span class="lbl">Music Assistant דרך Home Assistant<span class="muted" data-mm-conn-text>${a} נגנים${t?` · ${t} לא זמינים`:""} · ${s.state==="ready"?"ספרייה זמינה":"ספרייה לא זמינה"}</span></span>
            <sw-badge kind=${s.state==="ready"?"ok":"stale"} label=${s.state==="ready"?"מחובר":"ספרייה לא זמינה"}></sw-badge></div>`:o`<div class="row"><span class="lbl">Music Assistant<span class="muted" data-mm-conn-text>לא מותקן במערכת זו${s.provider!=="none"?` · ספקי מוזיקה: ${ae[s.provider]}`:""}</span></span><sw-badge kind="neutral" label="לא מותקן"></sw-badge></div>`}
      ${i.size?o`<div class="row"><span class="lbl">שכבת המוזיקה לפי התקן<span class="muted">${[...i].map(([n,r])=>`${ae[n]} על ${r}`).join(" · ")}</span></span></div>`:d}
      <div class="row"><span class="lbl">רכיב החיבור (גשר Arx)<span class="muted">${e.bridge.players_ready?`גרסה ${e.bridge.version??"?"} · מוכן לנגנים`:`גרסה ${e.bridge.version??"?"} · נדרש עדכון (0.5.0 ומעלה) לנגנים`}</span></span></div>
      ${s.provider==="ma"?o`<media-ma-connection data-mm-ma-direct></media-ma-connection>`:d}
    </sw-card>`}permissionsCard(){return o`<sw-card heading="הרשאות" data-mm-permissions>
      <div class="row"><span class="lbl">קיבוץ רמקולים וקבוצות שמורות<span class="muted"><span class="mono">media.group</span> · מפעיל, מנהל אתר, מנהל מערכת · קבוצה של 4 חדרים ומעלה או יותר מקומה אחת מבקשת אישור; כל הבניין רק למנהל</span></span>
        <a class="link" href="#/system/access">תפקידים והרשאות ‹</a></div>
      <div class="row"><span class="lbl">שליטה בניגון ובעוצמה<span class="muted"><span class="mono">media.control</span> · כולל דילוג, ערבוב, חזרה, מועדפים והעברת מוזיקה</span></span></div>
      <div class="row"><span class="lbl">עיון וחיפוש בספריית המוזיקה<span class="muted"><span class="mono">media.browse</span> · מפעיל, מנהל אתר, מנהל מערכת · הפעלת פריט דורשת גם שליטה בניגון</span></span></div>
      <div class="row"><span class="lbl">עריכת תור הניגון<span class="muted"><span class="mono">media.queue</span> · מנהל מערכת בלבד כברירת מחדל · גרירה, מחיקה, נגן הבא, ניקוי התור</span></span></div>
    </sw-card>`}deleteDialog(){const e=this.deleting;return e?o`<sw-dialog open ?locked=${this.busy} heading=${`למחוק את "${e.name}"?`} data-mm-preset-delete-dialog="open" @close=${()=>this.deleting=null}>
      <div class="dlg-acts">
        <sw-button data-mm-pd-no autofocus ?disabled=${this.busy} @click=${()=>this.deleting=null}>ביטול</sw-button>
        <sw-button variant="danger" data-mm-pd-yes ?disabled=${this.busy} @click=${()=>void this.deletePreset()}>מחק</sw-button>
      </div></sw-dialog>`:o`<sw-dialog data-mm-preset-delete-dialog="closed"></sw-dialog>`}render(){return this.phase!=="ready"?d:o`${this.error?o`<div class="err" role="alert" data-mm-players-error>${this.error}</div>`:d}
      ${this.playersCard()}${this.wizardCard()}${this.presetsCard()}${this.favCard()}${this.connectionCard()}${this.permissionsCard()}
      ${this.note?o`<div class="ok" role="status" data-mm-players-note>${this.note}</div>`:d}
      <media-preset-editor .devices=${[...this.live.values()]} @preset-saved=${()=>{this.say("נשמר"),this.loadGroups()}} @preset-stale=${()=>void this.loadGroups()}></media-preset-editor>
      ${this.deleteDialog()}`}};m.styles=[Ge,O`
    :host {
      display: contents;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-child {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    code,
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .dev {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 8px 0 0;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 10px 16px;
      flex-wrap: wrap;
    }
    .line .grow {
      flex: 1;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it on a phone */
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .f.inline {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    input[type='text'],
    input[type='number'],
    input[type='time'],
    select {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select {
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    input[type='text'] {
      min-inline-size: 200px;
    }
    input[type='number'] {
      inline-size: 88px;
    }
    .night {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .ep {
      display: grid;
      grid-template-columns: minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(0, 2fr) auto;
      gap: 6px 12px;
      align-items: center;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px dashed var(--sw-border);
    }
    .ep:last-child {
      border-block-end: 0;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
      min-block-size: 32px;
    }
    a.link {
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .acts {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .fgrp h3 {
      margin: 10px 0 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .frow {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .frow.off {
      opacity: 0.6;
    }
    .frow .nm {
      flex: 1;
      min-inline-size: 0;
      display: flex;
      flex-direction: column;
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
    }
    .hd {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block-end: 4px;
    }
    .hd .grow {
      flex: 1;
    }
    .dlg-acts {
      display: flex;
      justify-content: flex-end;
      gap: var(--sw-s-2);
      padding-block-start: var(--sw-s-2);
    }
    /* MEDIA-POLISH-2331: an error stays in view at the top of the settings while the person scrolls (it was a bare red line that
       scrolled away above the first card); the save note floats at the bottom of the window instead of after the last card, so the
       "נשמר" of a field near the top is actually seen */
    .err {
      position: sticky;
      inset-block-start: var(--sw-s-2);
      z-index: 5;
      padding: var(--sw-s-2) var(--sw-s-3);
      border-radius: var(--sw-r-md);
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      border: 1px solid color-mix(in srgb, var(--sw-danger) 30%, transparent);
      color: var(--sw-danger-text, var(--sw-danger));
      box-shadow: var(--sw-shadow-1);
    }
    .ok[role='status'] {
      position: fixed;
      z-index: 60;
      inset-inline: 0;
      inset-block-end: var(--sw-s-6);
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100% - var(--sw-s-6));
      padding: var(--sw-s-2) var(--sw-s-4);
      border-radius: var(--sw-r-pill);
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      box-shadow: var(--sw-shadow-3);
      font-weight: var(--sw-fw-medium);
    }
    /* keyboard: every native field, icon button and link shows where the focus is */
    input:focus-visible,
    select:focus-visible,
    .ib:focus-visible,
    .link:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .link:focus-visible {
      border-radius: var(--sw-r-2xs);
    }
    /* touch: the fields and the order buttons are 44 px targets */
    @media (pointer: coarse) {
      input[type='text'],
      input[type='number'],
      input[type='time'],
      select,
      .link {
        min-block-size: 44px;
      }
      .ib {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    @media (max-width: 767px) {
      .ok[role='status'] {
        inset-block-end: calc(var(--sw-bottomnav-h, 0px) + var(--sw-s-3));
      }
      .ep {
        grid-template-columns: 1fr;
      }
      input[type='text'] {
        min-inline-size: 0;
        inline-size: 100%;
      }
    }
  `,de];h([p()],m.prototype,"phase",2);h([p()],m.prototype,"devices",2);h([p()],m.prototype,"live",2);h([p()],m.prototype,"status",2);h([p()],m.prototype,"sugg",2);h([p()],m.prototype,"answered",2);h([p()],m.prototype,"nonPhys",2);h([p()],m.prototype,"presets",2);h([p()],m.prototype,"fav",2);h([p()],m.prototype,"favLists",2);h([p()],m.prototype,"areas",2);h([p()],m.prototype,"open",2);h([p()],m.prototype,"editing",2);h([p()],m.prototype,"view",2);h([p()],m.prototype,"npOpen",2);h([p()],m.prototype,"saved",2);h([p()],m.prototype,"error",2);h([p()],m.prototype,"note",2);h([p()],m.prototype,"deleting",2);h([p()],m.prototype,"busy",2);h([Xe("media-preset-editor")],m.prototype,"editor",2);m=h([R("system-multimedia-players")],m);var ka=Object.defineProperty,xa=Object.getOwnPropertyDescriptor,j=(e,s,a,t)=>{for(var i=t>1?void 0:t?xa(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&ka(s,a,i),i};let E=class extends I{constructor(){super(...arguments),this.templates=[],this.draft=[],this.dirty=!1,this.err="",this.busy=!1}willUpdate(e){e.has("templates")&&!this.dirty&&(this.draft=this.templates.map(s=>({...s,name:{...s.name},text:{...s.text}})))}edit(e){this.draft=e,this.dirty=!0,this.err=""}async save(){const e=S(),s=bs(this.draft);if(s){this.err=e.tplProblem[s];return}this.busy=!0;try{const a=await us(fs(this.draft));this.dirty=!1,this.draft=a.templates,this.dispatchEvent(new CustomEvent("saved",{detail:{templates:a.templates},bubbles:!0,composed:!0}))}catch(a){this.err=v(a)}finally{this.busy=!1}}render(){const e=S(),s=es();return o`<sw-card heading=${e.templates} subheading=${e.templatesHint} data-announce-templates>
      ${this.draft.map(a=>o`<details data-announce-template=${a.id}>
        <summary>${ws(a,s)||a.id} <span class="muted">${a.kind==="emergency"?e.kindEmergency:e.kindRoutine}</span></summary>
        <div class="grid">
          <span>${e.kind}</span>
          <select data-announce-template-kind aria-label=${e.kind} @change=${t=>this.edit($s(this.draft,a.id,t.target.value))}>
            <option value="routine" ?selected=${a.kind==="routine"}>${e.kindRoutine}</option>
            <option value="emergency" ?selected=${a.kind==="emergency"}>${e.kindEmergency}</option></select>
          ${ne.map(t=>o`
            <span>${e.tplName} · ${e.langName[t]}</span>
            <input type="text" maxlength=${ys} data-announce-template-name=${t} dir=${t==="he"?"rtl":"ltr"} aria-label=${`${e.tplName} ${e.langName[t]}`} .value=${a.name[t]??""}
              @input=${i=>this.edit(ye(this.draft,a.id,"name",t,i.target.value))} />
            <span>${e.tplText} · ${e.langName[t]}</span>
            <textarea maxlength=${ks} data-announce-template-text=${t} dir=${t==="he"?"rtl":"ltr"} aria-label=${`${e.tplText} ${e.langName[t]}`} .value=${a.text[t]??""}
              @input=${i=>this.edit(ye(this.draft,a.id,"text",t,i.target.value))}></textarea>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-announce-template-remove @click=${()=>this.edit(xs(this.draft,a.id))}>${e.removeTemplate}</sw-button>
      </details>`)}
      <div class="bar">
        <sw-button size="sm" data-announce-template-add ?disabled=${this.draft.length>=_s} @click=${()=>this.edit([...this.draft,zs(this.draft)])}>${e.addTemplate}</sw-button>
        <sw-button size="sm" variant="primary" data-announce-template-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${e.saveTemplates}</sw-button>
        ${this.err?o`<span class="err" role="alert" data-announce-template-error>${this.err}</span>`:d}
      </div>
    </sw-card>`}};E.styles=O`
    :host { display: block; }
    details { border-block-end: 1px solid var(--sw-border); padding-block: 8px; }
    details:last-of-type { border-block-end: 0; }
    summary { cursor: pointer; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); display: flex; gap: 10px; align-items: center; }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    .grid { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px 10px; align-items: center; padding-block: 10px 4px; }
    input, textarea, select { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; }
    textarea { padding: 8px 10px; resize: vertical; min-block-size: 56px; }
    .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding-block-start: 10px; }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-sm); }
  `;j([M({attribute:!1})],E.prototype,"templates",2);j([p()],E.prototype,"draft",2);j([p()],E.prototype,"dirty",2);j([p()],E.prototype,"err",2);j([p()],E.prototype,"busy",2);E=j([R("system-announce-templates")],E);var _a=Object.defineProperty,za=Object.getOwnPropertyDescriptor,x=(e,s,a,t)=>{for(var i=t>1?void 0:t?za(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&_a(s,a,i),i};const Sa=(e=3e3)=>new Promise(s=>setTimeout(s,e));let w=class extends I{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.phase="loading",this.err="",this.data=null,this.areas=[],this.saved="",this.busy="",this.room="",this.text="",this.vol=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!C()){this.phase="ready";return}if(te()){this.phase="local";return}if(!B("system.configure")){this.phase="forbidden";return}this.phase="loading",this.err="";try{this.data=await be(),this.areas=B("media.announce")?(await fe()).areas:[],this.areas.some(e=>e.area_id===this.room)||(this.room=this.areas[0]?.area_id??""),this.phase="ready"}catch(e){this.err=v(e),this.phase="error"}}note(e){this.saved=e,Sa().then(()=>{this.saved===e&&(this.saved="")})}async save(e){this.err="";try{this.data=await ms(e),ss(this.data.config.enabled),B("media.announce")&&(this.areas=(await fe()).areas),this.areas.some(s=>s.area_id===this.room)||(this.room=this.areas[0]?.area_id??""),this.note(S().saved)}catch(s){const a=v(s);await this.load(),this.err=a}}async toggleSpeaker(e,s){const a=new Set(this.data?.config.devices??[]);s?a.add(e.key):a.delete(e.key),await this.save({devices:[...a]})}pct(e){const s=e.target.value.trim();return s===""?null:Number(s)}emergencyLangs(e,s){const a=this.data?.config.emergency_languages??[],t=ne.filter(i=>i===e?s:a.includes(i));return t.length?t:[...a]}routeAreas(){const e=new Map;for(const s of this.data?.speakers??[])s.allowed&&s.area_id&&e.set(s.area_id,[s.floor_name,s.area_name].filter(Boolean).join(" · ")||s.area_id);return[...e].map(([s,a])=>({id:s,name:a}))}extraCards(e,s){const a=s.quiet,t=s.notify,i=this.routeAreas();return o`
      <sw-card heading=${e.quiet} data-announce-quiet>
        <div class="row"><span class="lbl">${e.quietEnabled}<span class="muted">${e.quietHint}</span></span>
          <sw-toggle label=${e.quietEnabled} labelHidden .checked=${a.enabled} data-announce-quiet-enabled @change=${n=>void this.save({quiet:{enabled:n.detail.checked}})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.from}</span>
          <input type="time" lang=${W()} data-announce-quiet-from .value=${a.from} @change=${n=>void this.save({quiet:{from:n.target.value}})} /></div>
        <div class="row"><span class="lbl">${e.to}</span>
          <input type="time" lang=${W()} data-announce-quiet-to .value=${a.to} @change=${n=>void this.save({quiet:{to:n.target.value}})} /></div>
        <div class="row"><span class="lbl">${e.mode}</span>
          <select data-announce-quiet-mode aria-label=${e.mode} @change=${n=>void this.save({quiet:{mode:n.target.value}})}>
            ${hs.map(n=>o`<option value=${n} ?selected=${a.mode===n}>${{suppress:e.modeSuppress,lower:e.modeLower,queue:e.modeQueue,allow:e.modeAllow}[n]}</option>`)}</select></div>
        ${a.mode==="lower"?o`<div class="row"><span class="lbl">${e.nightVolume}</span>
          <input type="number" min="0" max="100" data-announce-night-volume .value=${a.night_volume===null?"":String(a.night_volume)} @change=${n=>void this.save({quiet:{night_volume:this.pct(n)}})} /></div>`:d}
      </sw-card>
      <sw-card heading=${e.routing} data-announce-routing>
        <div class="row"><span class="lbl">${e.routingEnabled}<span class="muted">${e.routingHint}</span></span>
          <sw-toggle label=${e.routingEnabled} labelHidden .checked=${t.enabled} data-announce-routing-enabled @change=${n=>void this.save({notify:{enabled:n.detail.checked}})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.routingRoom}</span>
          <select data-announce-routing-room aria-label=${e.routingRoom} @change=${n=>void this.save({notify:{scope:"area",ref:n.target.value}})}>
            <option value="" ?selected=${!i.some(n=>n.id===t.ref)}>${e.routingNone}</option>
            ${i.map(n=>o`<option value=${n.id} ?selected=${t.scope==="area"&&n.id===t.ref}>${n.name}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.minSeverity}</span>
          <select data-announce-routing-severity aria-label=${e.minSeverity} @change=${n=>void this.save({notify:{min_severity:n.target.value}})}>
            ${["info","alert","critical"].map(n=>o`<option value=${n} ?selected=${t.min_severity===n}>${e.severity[n]}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.categories}</span>
          <span class="inl">${we.map(n=>o`<label class="pick"><input type="checkbox" data-announce-routing-category=${n} .checked=${t.categories.includes(n)}
            @change=${r=>void this.save({notify:{categories:we.filter(l=>l===n?r.target.checked:t.categories.includes(l))}})} />${e.category[n]}</label>`)}</span></div>
      </sw-card>`}screenAreas(){const e=new Map;for(const s of this.data?.speakers??[])s.area_id&&e.set(s.area_id,[s.floor_name,s.area_name].filter(Boolean).join(" · ")||s.area_id);for(const s of this.data?.screen_options?.screens??[])s.area_id&&!e.has(s.area_id)&&e.set(s.area_id,s.area_id);return[...e].map(([s,a])=>({id:s,name:a}))}screenNumber(e,s){const a=Ss(e,s.target.value);a!==null&&this.save({screens:{[e]:a}})}screensCard(e,s){const a=s.config.screens??{enabled:!1,default_on:!0,seconds:30,critical_seconds:180,poll_s:5},t=s.screen_options?.screens??[],i=s.screen_options?.devices??[],n=this.screenAreas(),r=(l,c)=>void this.save({screens:{targets:Cs(As(t,l,c))}});return o`<sw-card heading=${e.screens} subheading=${e.screensHint} data-announce-screens>
      <div class="row"><span class="lbl">${e.screensEnabled}<span class="muted">${e.screensEnabledHint}</span></span>
        <sw-toggle label=${e.screensEnabled} labelHidden .checked=${a.enabled} data-announce-screens-enabled @change=${l=>void this.save({screens:{enabled:l.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.screensDefault}</span>
        <sw-toggle label=${e.screensDefault} labelHidden .checked=${a.default_on} data-announce-screens-default @change=${l=>void this.save({screens:{default_on:l.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.screensSeconds}</span>
        <input type="number" min=${z.seconds[0]} max=${z.seconds[1]} data-announce-screens-seconds aria-label=${e.screensSeconds} .value=${String(a.seconds)} @change=${l=>this.screenNumber("seconds",l)} /></div>
      <div class="row"><span class="lbl">${e.screensCriticalSeconds}</span>
        <input type="number" min=${z.critical_seconds[0]} max=${z.critical_seconds[1]} data-announce-screens-critical aria-label=${e.screensCriticalSeconds} .value=${String(a.critical_seconds)} @change=${l=>this.screenNumber("critical_seconds",l)} /></div>
      <div class="row"><span class="lbl">${e.screensPoll}</span>
        <input type="number" min=${z.poll_s[0]} max=${z.poll_s[1]} data-announce-screens-poll aria-label=${e.screensPoll} .value=${String(a.poll_s)} @change=${l=>this.screenNumber("poll_s",l)} /></div>
      ${a.critical_close_s!==void 0?o`<div class="row"><span class="lbl">${e.screensCriticalClose}</span>
        <input type="number" step="1" inputmode="numeric" min=${z.critical_close_s[0]} max=${z.critical_close_s[1]} data-announce-screens-critical-close aria-label=${e.screensCriticalClose} .value=${String(a.critical_close_s)} @change=${l=>this.screenNumber("critical_close_s",l)} /></div>`:d}
      <div class="area">${e.screensList}</div>
      ${t.length?t.map(l=>o`<div class="row" data-announce-screen=${l.key}>
        <label class="pick"><input type="checkbox" .checked=${l.allowed} data-announce-screen-allow @change=${c=>r(l.key,{allowed:c.target.checked})} />${l.name}
          <span class="muted">${l.kind==="board"?e.screensKindBoard:e.screensKindWall}</span></label>
        <span class="inl">
          <select data-announce-screen-area aria-label=${e.screensArea} ?disabled=${!l.allowed} @change=${c=>r(l.key,{area_id:c.target.value||null})}>
            <option value="" ?selected=${!l.area_id}>${e.screensNoArea}</option>
            ${n.map(c=>o`<option value=${c.id} ?selected=${c.id===l.area_id}>${c.name}</option>`)}</select>
          <select data-announce-screen-device aria-label=${e.screensDevice} ?disabled=${!l.allowed} @change=${c=>r(l.key,{device_key:c.target.value||null})}>
            <option value="" ?selected=${!l.device_key}>${e.screensNoDevice}</option>
            ${i.map(c=>o`<option value=${c.key} ?selected=${c.key===l.device_key}>${c.name}</option>`)}</select>
        </span></div>`):o`<div class="muted" data-announce-screens-none>${e.screensNone}</div>`}
    </sw-card>`}translateCard(e,s){const a=s.config.translate;if(!a)return d;const t=!!a.approval&&a.approval.provider===a.provider,i=a.approval?new Intl.DateTimeFormat(X()==="en"?"en-GB":"he-IL",{dateStyle:"short",timeStyle:"short"}).format(new Date(a.approval.at)):"";return o`<sw-card heading=${e.translateCard} subheading=${e.translateHint} data-announce-translate-card>
      <div class="row"><span class="lbl">${e.translateProvider}</span>
        <select data-announce-translate-provider aria-label=${e.translateProvider} @change=${n=>void this.save({translate:{provider:n.target.value,...a.enabled?{enabled:!1}:{}}})}>
          <option value="off" ?selected=${a.provider==="off"}>${e.translateProviderOff}</option>
          <option value="google" ?selected=${a.provider==="google"}>${e.translateProviderGoogle}</option>
          <option value="cloud" ?selected=${a.provider==="cloud"}>${e.translateProviderCloud}</option></select></div>
      <div class="row"><span class="lbl">${e.translateApprove}${t?o`<span class="muted" data-announce-translate-approved>${e.translateApprovedBy} ${a.approval?.by??"—"} · ${i}</span>`:o`<span class="muted">${e.translateNotApproved}</span>`}</span>
        <sw-button size="sm" data-announce-translate-approve ?disabled=${a.provider==="off"||t} @click=${()=>void this.save({translate:{approve:!0}})}>${e.translateApproveAction}</sw-button></div>
      <div class="row"><span class="lbl">${e.translateEnabled}${a.provider==="cloud"?o`<span class="muted" data-announce-translate-key>${a.key_set?e.cloudKeySet:e.cloudKeyMissing}</span>`:d}</span>
        <sw-toggle label=${e.translateEnabled} labelHidden .checked=${a.enabled} ?disabled=${!t&&!a.enabled} data-announce-translate-enabled @change=${n=>void this.save({translate:{enabled:n.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.translateTargets}</span>
        <span class="inl">${$e.map(n=>o`<label class="pick"><input type="checkbox" data-announce-translate-target=${n} .checked=${a.targets.includes(n)}
          @change=${r=>{const l=$e.filter(c=>c===n?r.target.checked:a.targets.includes(c));l.length?this.save({translate:{targets:l}}):r.target.checked=!0}} />${e.langName[n]}</label>`)}</span></div>
    </sw-card>`}async run(e,s){this.busy=e,this.err="";try{await s(),this.note(S().sent)}catch(a){this.err=v(a)}finally{this.busy=""}try{this.data=await be()}catch{}}speakerRows(e){const s=this.data?.speakers??[];if(!s.length)return o`<div class="muted" data-announce-none>${e.none}</div>`;const a=new Map;for(const i of s){const n=[i.floor_name,i.area_name].filter(Boolean).join(" · ")||e.noRoom;a.set(n,[...a.get(n)??[],i])}const t=!!this.data?.config.enabled&&!!this.data?.config.engine;return o`${[...a].map(([i,n])=>o`<div class="area">${i}</div>${n.map(r=>o`
      <div class="row" data-announce-speaker=${r.key}>
        <label class="pick"><input type="checkbox" .checked=${r.allowed} data-announce-allow @change=${l=>void this.toggleSpeaker(r,l.target.checked)} />${r.name}</label>
        <sw-button size="sm" data-announce-test ?disabled=${!r.allowed||!t||this.busy!==""} @click=${()=>void this.run(`t:${r.key}`,()=>vs({scope:"device",ref:r.key,language:X()}))}>${e.testAction}</sw-button>
      </div>`)}`)}`}render(){const e=S();if(this.phase==="forbidden")return o`<sw-state-panel state="forbidden" heading=${e.forbidden}></sw-state-panel>`;if(this.phase==="local")return o`<sw-state-panel icon="bell" state="empty" heading=${e.local}></sw-state-panel>`;if(this.phase==="loading")return o`<sw-state-panel state="loading"></sw-state-panel>`;if(this.phase==="error")return o`<sw-state-panel state="error" heading=${this.err} actionLabel="↻" @action=${()=>void this.load()}></sw-state-panel>`;const s=this.data;if(!s)return o`<sw-state-panel icon="bell" state="empty" heading=${e.none}></sw-state-panel>`;const a=s.config;return o`<div class="stack" data-announce>
      ${this.err?o`<div class="err" role="alert">${this.err}</div>`:d}
      <sw-card heading=${e.general}>
        <div class="row"><span class="lbl">${e.enabled}<span class="muted">${e.enabledHint}</span></span>
          <sw-toggle label=${e.enabled} labelHidden .checked=${a.enabled} data-announce-enabled @change=${t=>void this.save({enabled:t.detail.checked})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.engine}<span class="muted">${e.engineHint}</span>${(s.engine_info??[]).some(t=>t.entity_id===a.engine&&t.cloud)?o`<span class="muted" data-announce-cloud-warn>${e.engineCloudWarn}</span>`:d}</span>
          <select data-ltr data-announce-engine aria-label=${e.engine} @change=${t=>void this.save({engine:t.target.value})}>
            <option value="" ?selected=${a.engine===""}>—</option>
            ${[...new Set([...s.engines,...a.engine?[a.engine]:[]])].map(t=>o`<option value=${t} ?selected=${t===a.engine}>${(s.engine_info??[]).find(i=>i.entity_id===t)?.name??t}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.emergencyLangs}</span>
          <span class="inl">${ne.map(t=>o`<label class="pick"><input type="checkbox" data-announce-emergency-lang=${t} .checked=${(a.emergency_languages??[]).includes(t)}
            @change=${i=>void this.save({emergency_languages:this.emergencyLangs(t,i.target.checked)})} />${e.langName[t]}</label>`)}</span></div>
        <div class="row"><span class="lbl">${e.language}</span>
          <input type="text" data-ltr data-announce-language style="inline-size:100px" .value=${a.language} @change=${t=>void this.save({language:t.target.value.trim()})} /></div>
        <div class="row"><span class="lbl">${e.limit}</span>
          <input type="number" min="1" max="30" data-announce-limit .value=${String(a.max_per_minute)} @change=${t=>void this.save({max_per_minute:Number(t.target.value)})} /></div>
        <div class="row"><span class="lbl">${e.volume}<span class="muted">${e.volumeHint}</span></span>
          <input type="number" min="0" max="100" data-announce-volume .value=${a.volume===null?"":String(a.volume)} @change=${t=>void this.save({volume:this.pct(t)})} /></div>
        <div class="row"><span class="lbl">${e.pause}<span class="muted">${e.pauseHint}</span></span>
          <sw-toggle label=${e.pause} labelHidden .checked=${a.pause_music} data-announce-pause @change=${t=>void this.save({pause_music:t.detail.checked})}></sw-toggle></div>
      </sw-card>
      ${this.extraCards(e,a)}
      ${this.screensCard(e,s)}
      ${this.translateCard(e,s)}
      <system-announce-templates .templates=${s.templates??[]} @saved=${t=>{this.data&&(this.data={...this.data,templates:t.detail.templates}),this.note(S().saved)}}></system-announce-templates>
      <sw-card heading=${e.speakers} subheading=${e.speakersHint}>${this.speakerRows(e)}</sw-card>
      ${this.areas.length?o`<sw-card heading=${e.say} data-announce-now>
        <div class="row">
          <span class="inl"><select data-announce-room @change=${t=>this.room=t.target.value} aria-label=${e.room}>${this.areas.map(t=>o`<option value=${t.area_id} ?selected=${t.area_id===this.room}>${[t.floor_name,t.name].filter(Boolean).join(" · ")}</option>`)}</select>
          <input type="text" class="grow" maxlength=${a.max_text} data-announce-text aria-label=${e.text} .value=${this.text} @input=${t=>this.text=t.target.value} />
          <input type="number" min="0" max="100" data-announce-send-volume aria-label=${e.volume} placeholder="%" .value=${this.vol} @input=${t=>this.vol=t.target.value} /></span>
          <sw-button size="sm" variant="primary" icon="check" data-announce-send ?disabled=${!this.text.trim()||!this.room||this.busy!==""}
            @click=${()=>void this.run("send",async()=>{await gs({scope:"area",ref:this.room,text:this.text,...this.vol.trim()===""?{}:{volume:Number(this.vol)}}),this.text=""})}>${e.send}</sw-button>
        </div></sw-card>`:d}
      <sw-card heading=${e.history}>
        ${s.history.length?o`<table data-announce-history><tbody>${s.history.map(t=>o`<tr>
          <td>${new Intl.DateTimeFormat(X()==="en"?"en-GB":"he-IL",{dateStyle:"short",timeStyle:"short"}).format(new Date(t.at))}</td>
          <td>${e.src[t.source]??t.source}</td><td class="msg">${t.message}</td><td>${e.status[t.status]??t.status}</td></tr>`)}</tbody></table>`:o`<div class="muted">${e.empty}</div>`}
      </sw-card>
      ${this.saved?o`<div class="ok" role="status">${this.saved}</div>`:d}
    </div>`}};w.styles=[de,O`
    :host { display: block; }
    .stack { display: flex; flex-direction: column; gap: 14px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 0; border-block-end: 1px solid var(--sw-border); flex-wrap: wrap; }
    .row:last-child { border-block-end: 0; }
    .lbl { display: flex; flex-direction: column; gap: 2px; min-inline-size: 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    input[type='text'], input[type='number'], input[type='time'], select {
      box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm);
      background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); max-inline-size: 100%;
    }
    input[type='text'] { inline-size: 260px; }
    input[data-ltr] { direction: ltr; text-align: start; }
    input[type='number'], input[type='time'] { inline-size: 90px; }
    .grow { flex: 1; min-inline-size: 200px; inline-size: auto; }
    .inl { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .area { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-medium); color: var(--sw-text-2); padding-block: 10px 2px; }
    .pick { display: inline-flex; align-items: center; gap: 8px; }
    .ok { color: var(--sw-live); font-size: var(--sw-fs-sm); }
    .err { padding: 10px 12px; border-radius: var(--sw-r-md); background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface)); color: var(--sw-danger); font-size: var(--sw-fs-sm); }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--sw-border); }
    td.msg { max-inline-size: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    @media (max-width: 600px) { input[type='text'] { inline-size: 100%; } }
  `];x([p()],w.prototype,"phase",2);x([p()],w.prototype,"err",2);x([p()],w.prototype,"data",2);x([p()],w.prototype,"areas",2);x([p()],w.prototype,"saved",2);x([p()],w.prototype,"busy",2);x([p()],w.prototype,"room",2);x([p()],w.prototype,"text",2);x([p()],w.prototype,"vol",2);w=x([R("system-announcements")],w);var Ca=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,f=(e,s,a,t)=>{for(var i=t>1?void 0:t?Aa(s,a):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(i=(t?r(s,a,i):r(i))||i);return t&&i&&Ca(s,a,i),i};const Ea=Object.keys(re),Oa=(e=3e3)=>new Promise(s=>setTimeout(s,e)),Le=[{id:"blue",label:"כחול"},{id:"rew",label:"אחורה מהירה"},{id:"ff",label:"קדימה מהירה"},{id:"stop",label:"עצור"},{id:"exit",label:"יציאה"},{id:"info",label:"מידע"},{id:"guide",label:"מדריך"},{id:"source",label:"מקור"},{id:"tools",label:"כלים"},{id:"settings",label:"הגדרות"},{id:"chlist",label:"רשימת ערוצים"},{id:"prech",label:"ערוץ קודם"}];let g=class extends I{constructor(){super(...arguments),this.bubbleSkin=new ce(this),this.phase="loading",this.list={devices:[],suggestions:[]},this.status=null,this.enabled=!0,this.remote=null,this.remoteDirty=!1,this.error="",this.note="",this.saved="",this.open=new Set,this.editing=new Set,this.view={...F},this.tab="main",this.noteTimer=0,this.onHash=()=>{window.location.hash.startsWith("#/system/multimedia")&&this.readTab()},this.setView=e=>{this.view=e,Be("screens",U.me?.user.id??"",e)}}connectedCallback(){super.connectedCallback(),this.view=qe("screens",U.me?.user.id??""),this.readTab(),window.addEventListener("hashchange",this.onHash),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),window.clearTimeout(this.noteTimer)}async load(){if(this.error="",C()&&!B("system.configure")){this.phase="forbidden";return}try{const[e,s,a]=await Promise.all([_().list(),J().status(),J().remoteDefault()]);this.list=e,this.status=s,this.remote=a,this.remoteDirty=!1,this.enabled=C()?String((await as(!0))["multimedia.enabled"]??"true")!=="false":s.enabled,this.phase="ready"}catch(e){e instanceof De&&e.status===403?this.phase="forbidden":(this.error=v(e),this.phase="error")}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}async setEnabled(e){this.error="";try{C()&&(await ts("settings",{"multimedia.enabled":String(e)}),is()),this.enabled=e,ns({"multimedia.enabled":String(e)}),this.say("נשמר")}catch(s){this.error=v(s)}}async updateDevice(e,s){this.error="";try{const a=await _().update(e.key,s);this.list={...this.list,devices:this.list.devices.map(t=>t.key===e.key?a:t)},this.saved=e.key,Oa().then(()=>this.saved=this.saved===e.key?"":this.saved)}catch(a){this.error=v(a),await this.load()}}async approveAll(){const e=this.list.devices.filter(s=>s.kind==="screen"&&!s.approved).map(s=>s.key);if(e.length)try{await _().approve(e,!0),this.list={...this.list,devices:this.list.devices.map(s=>e.includes(s.key)?{...s,approved:!0}:s)},this.say(`אושרו ${e.length} מסכים`)}catch(s){this.error=v(s)}}async link(e){try{this.list=await _().link(e),this.say("נשמר")}catch(s){this.error=v(s)}}setSection(e,s){const a=this.remote;if(!a)return;const t=a.sections.map(n=>n.id===e&&s.on!==void 0?{...n,on:s.on}:n),i=s.more===void 0?a.more:s.more?[...new Set([...a.more,e])]:a.more.filter(n=>n!==e);this.remote={...a,sections:t,more:i},this.remoteDirty=!0}moveSection(e,s){const a=this.remote;if(!a)return;const t=a.sections.findIndex(r=>r.id===e),i=t+s;if(t<0||i<0||i>=a.sections.length)return;const n=[...a.sections];[n[t],n[i]]=[n[i],n[t]],this.remote={...a,sections:n},this.remoteDirty=!0}async saveRemote(){if(this.remote)try{this.remote=await J().saveRemoteDefault(this.remote),this.remoteDirty=!1,this.say("נשמר")}catch(e){this.error=v(e)}}toggle(e,s){const a=new Set(this[e]);a.delete(s)||a.add(s),this[e]=a}async copy(e){try{await navigator.clipboard.writeText(e),this.say("הועתק")}catch{this.say("ההעתקה נחסמה בדפדפן")}}table(e){return Fe({scope:"screens",devices:e,view:this.view,editing:this.editing,endpoints:this.open,saved:this.saved,form:s=>this.form(s),connections:s=>this.connections(s),typeLabel:s=>ee[s.kind]??s.kind,onView:this.setView,onEdit:s=>this.toggle("editing",s),onEndpoints:s=>this.toggle("open",s),onApprove:(s,a)=>void this.updateDevice(s,{approved:a}),onCopy:s=>void this.copy(s),none:"לא זוהו מסכים."})}form(e){const s=this.list.devices.filter(t=>t.key!==e.key&&(t.kind==="receiver"||t.kind==="speaker")),a=e.model_key_options?Le.filter(t=>e.model_key_options.includes(t.id)):Le;return o`<div class="dev" data-mm-form=${e.key}>
      <div class="line">
        <label class="f">שם
          <input type="text" .value=${e.name} maxlength="60" data-mm-name=${e.key} @change=${t=>void this.updateDevice(e,{display_name:t.target.value})} />
        </label>
        <label class="f">סוג
          <select data-mm-kind=${e.key} @change=${t=>void this.updateDevice(e,{kind:t.target.value})}>
            ${Object.keys(ee).map(t=>o`<option value=${t} ?selected=${e.kind===t}>${ee[t]}</option>`)}
          </select>
        </label>
        <span class="f">זיהוי<sw-badge kind=${e.confidence==="weak"?"stale":"neutral"} label=${Pe[e.confidence]}></sw-badge></span>
        <span class="f">מיקום<span>${[e.floor_name,e.area_name].filter(Boolean).join(" ‹ ")||"—"}</span></span>
        <span class="grow"></span>
      </div>
      <div class="line">
        <label class="f inline">מסך ציבורי<sw-toggle label=${`מסך ציבורי: ${e.name}`} labelHidden .checked=${e.public} ?disabled=${e.kind!=="screen"} data-mm-public=${e.key} @change=${t=>void this.updateDevice(e,{public:t.detail.checked})}></sw-toggle></label>
        <label class="f">פרופיל
          <select data-mm-profile=${e.key} ?disabled=${e.kind!=="screen"} @change=${t=>{const i=t.target.value;this.updateDevice(e,{profile:i===""?null:i})}}>
            <option value="" ?selected=${e.profile_source==="auto"}>זיהוי אוטומטי · ${re[e.profile]}</option>
            ${Ea.map(t=>o`<option value=${t} ?selected=${e.profile_source==="manual"&&e.profile===t}>${re[t]}</option>`)}
          </select>
        </label>
        <label class="f">מגבר מקושר
          <select data-mm-link=${e.key} ?disabled=${e.kind!=="screen"} @change=${t=>{const i=t.target.value;this.updateDevice(e,{audio_link_key:i||null,...i?{}:{audio_default:"screen"}})}}>
            <option value="" ?selected=${!e.audio_link_key}>ללא</option>
            ${s.map(t=>o`<option value=${t.key} ?selected=${e.audio_link_key===t.key}>${t.name}</option>`)}
          </select>
        </label>
        <span class="f">שמע ברירת מחדל
          <span class="seg" role="group" aria-label="שמע ברירת מחדל">
            <button type="button" aria-pressed=${String(e.audio_default==="screen")} ?disabled=${!e.audio_link_key} @click=${()=>void this.updateDevice(e,{audio_default:"screen"})}>רמקולי המסך</button>
            <button type="button" aria-pressed=${String(e.audio_default==="linked")} ?disabled=${!e.audio_link_key} @click=${()=>void this.updateDevice(e,{audio_default:"linked"})}>מגבר</button>
          </span>
        </span>
        <label class="f">תקרת עוצמה
          <input type="number" min="0" max="100" .value=${e.volume_max===null?"":String(e.volume_max)} placeholder="ללא" data-mm-volmax=${e.key}
            @change=${t=>{const i=t.target.value.trim(),n=Math.max(0,Math.min(100,Math.round(Number(i))));this.updateDevice(e,{volume_max:i===""||Number.isNaN(n)?null:n})}} />
        </label>
      </div>
      ${e.also_turns_on.length?o`<div class="muted" data-mm-also>גם מדליק: ${e.also_turns_on.join(", ")}</div>`:d}
      ${e.cast?o`<div class="muted" data-mm-cast-line=${e.key}>שידור למסך: ${Te(e.cast)}</div>`:d}
      ${e.kind==="screen"&&e.profile!=="generic"&&a.length?o`<div class="line" data-mm-extra-keys=${e.key}><span class="f">מקשים נוספים למסך זה</span>${a.map(t=>o`<label class="f inline"><input type="checkbox" .checked=${e.model_keys.includes(t.id)} @change=${i=>void this.updateDevice(e,{model_keys:a.filter(n=>n.id===t.id?i.target.checked:e.model_keys.includes(n.id)).map(n=>n.id)})} />${t.label}</label>`)}</div>`:d}
    </div>`}connections(e){return o`<div data-mm-endpoints=${e.key}>${e.endpoints.map(s=>o`<div class="ep" data-mm-endpoint=${s.endpoint_id}>
        <span class="mono" data-mm-ep-platform=${s.platform} title=${le(s.platform)}>${T(s.platform)}</span>
        <span>${Ne[s.role]??s.role}${s.hidden?o` <sw-badge kind="neutral" label="מוסתר"></sw-badge>`:d}</span>
        <span class="muted">${s.primary_for.length?`עונה על: ${s.primary_for.map(a=>Ms[a]).join(", ")}`:"כפילות"} · שלב ${s.rule}${s.link_source==="manual"?" · ידני":""}</span>
        <span style="display:flex;gap:6px">
          ${s.hidden?o`<sw-button size="sm" data-mm-restore=${s.endpoint_id} @click=${()=>void this.link({op:"restore",endpoint_id:s.endpoint_id})}>שחזר</sw-button>`:o`<sw-button size="sm" data-mm-ignore=${s.endpoint_id} @click=${()=>void this.link({op:"ignore",endpoint_id:s.endpoint_id})}>התעלם</sw-button>
              ${e.endpoints.length>1?o`<sw-button size="sm" data-mm-unlink=${s.endpoint_id} @click=${()=>void this.link({op:"unlink",endpoint_id:s.endpoint_id})}>פצל</sw-button>`:d}`}
        </span>
      </div>`)}</div>`}suggestions(){const e=this.list.suggestions??[];if(!e.length)return d;const s=a=>this.list.devices.find(t=>t.key===a)?.name??a;return o`<sw-card heading="הצעות איחוד" data-mm-suggestions>
      ${e.map(a=>o`<div class="row"><span class="lbl"><span class="mono">${a.endpoint_id.replace(/^ha:/,"")}</span><span class="muted">${a.reason} · אל ${s(a.device_key)}</span></span>
        <sw-button size="sm" data-mm-merge=${a.endpoint_id} @click=${()=>void this.link({op:"link",endpoint_id:a.endpoint_id,device_key:a.device_key})}>אחד</sw-button></div>`)}
    </sw-card>`}remoteCard(){const e=this.remote;return e?o`<sw-card heading="שלט" data-mm-remote>
      ${e.sections.map((s,a)=>o`<div class="sec" data-mm-section=${s.id}>
        <sw-toggle label=${`הצג: ${q[s.id]}`} labelHidden .checked=${s.on} @change=${t=>this.setSection(s.id,{on:t.detail.checked})}></sw-toggle>
        <span class="nm">${q[s.id]}</span>
        <label class="f inline"><input type="checkbox" .checked=${e.more.includes(s.id)} ?disabled=${!s.on} aria-label=${`מאחורי "עוד מקשים": ${q[s.id]}`} @change=${t=>this.setSection(s.id,{more:t.target.checked})} />מאחורי "עוד מקשים"</label>
        <button type="button" class="ib" aria-label=${`הקדם: ${q[s.id]}`} ?disabled=${a===0} @click=${()=>this.moveSection(s.id,-1)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
        <button type="button" class="ib" aria-label=${`אחר: ${q[s.id]}`} ?disabled=${a===e.sections.length-1} @click=${()=>this.moveSection(s.id,1)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>
      </div>`)}
      <div class="row"><span class="muted">ברירת המחדל של כל המסכים; אפשר לשנות מסך בודד דרך "עריכת השלט" בתפריט המשתמש.</span>
        <sw-button variant="primary" size="sm" ?disabled=${!this.remoteDirty} data-mm-save-remote @click=${()=>void this.saveRemote()}>שמור</sw-button></div>
    </sw-card>`:d}readTab(){const e=(window.location.hash.split("?")[1]??"").split("&").find(s=>s.startsWith("tab="))?.slice(4);this.tab=e==="cast"||e==="mine"||e==="announce"?e:"main"}setTab(e){const s=e==="cast"||e==="mine"||e==="announce"?e:"main";this.tab=s,os("/system/multimedia",s==="main"?void 0:new URLSearchParams({tab:s}))}tabsRow(){return o`<sw-tabs variant="underline" data-mm-tabs .items=${[{id:"main",label:"מסכים ונגנים"},{id:"cast",label:"שידור למסכים"},{id:"mine",label:"המסכים שלי לשידור"},{id:"announce",label:S().tab}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>`}render(){if(this.phase==="forbidden")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה"><sw-state-panel data-mm-admin-state="forbidden" state="forbidden" heading="אין לך הרשאה להגדרות המדיה" hint="נדרשת ההרשאה להגדרת המערכת."></sw-state-panel></sw-page>`;if(this.tab==="cast")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה" subheading="שידור מצלמות למסכים">${this.tabsRow()}<system-cast></system-cast></sw-page>`;if(this.tab==="announce")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה" subheading=${S().sub}>${this.tabsRow()}<system-announcements></system-announcements></sw-page>`;if(this.tab==="mine")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה" subheading="המסכים שאפשר לשדר אליהם">${this.tabsRow()}<cast-my-screens embedded></cast-my-screens></sw-page>`;if(this.phase==="loading")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה"><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.phase==="error")return o`<sw-page crumbs="הגדרות" heading="מולטימדיה">${this.tabsRow()}<sw-state-panel data-mm-admin-state="error" state="error" heading="לא ניתן לטעון את הגדרות המדיה" hint=${this.error} actionLabel="נסה שוב" @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.status,s=this.list.devices.filter(i=>i.kind==="screen"),a=s.filter(i=>!i.approved).length,t=e?.bridge;return o`<sw-page crumbs="הגדרות" heading="מולטימדיה" subheading=${`${s.filter(i=>i.approved).length} מסכים מאושרים${a?` · ${a} ממתינים לאישור`:""}`}>
      ${this.tabsRow()}
      <div class="stack">
        ${this.error?o`<div class="err" role="alert">${this.error}</div>`:d}
        <sw-card heading="כללי" data-mm-general>
          <div class="row"><span class="lbl">מולטימדיה<span class="muted">כבוי = הכניסה "מולטימדיה" אינה מוצגת לאף משתמש</span></span>
            <sw-toggle label="מולטימדיה" labelHidden .checked=${this.enabled} data-mm-enabled @change=${i=>void this.setEnabled(i.detail.checked)}></sw-toggle></div>
          <div class="row"><span class="lbl">רכיב החיבור (גשר Arx)<span class="muted" data-mm-bridge>${t?t.media_ready?`גרסה ${t.version??"?"} · מוכן לפקודות מדיה`:t.paired?`גרסה ${t.version??"?"} · נדרש עדכון (0.4.0 ומעלה)`:"לא מצומד":"—"}</span></span></div>
          <div class="row"><span class="lbl">תצוגה<span class="muted" data-mm-display>זכוכית תמיד; בהיר/כהה לפי חשמל והתקנים</span></span></div>
        </sw-card>
        <sw-card heading="מסכים" data-mm-devices>
          <div class="row"><span class="muted">רק מסכים מאושרים מופיעים ב"מולטימדיה".</span>
            <sw-button size="sm" variant="primary" icon="check" data-mm-approve-all ?disabled=${!a} @click=${()=>void this.approveAll()}>אשר את כל המסכים שזוהו${a?` (${a})`:""}</sw-button></div>
          ${this.table(s)}
        </sw-card>
        ${this.suggestions()}
        ${this.remoteCard()}
        <system-multimedia-players></system-multimedia-players>
        ${this.note?o`<div class="ok" role="status" data-mm-note>${this.note}</div>`:d}
      </div>
    </sw-page>`}};g.styles=[rs,Ge,O`
    sw-tabs {
      --sw-tab-min-h: 44px;
      margin-block-end: 10px;
    }
    .stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .row {
      flex-wrap: wrap;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .dev {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 8px 0 0;
    }
    .line {
      display: flex;
      align-items: center;
      gap: 10px 16px;
      flex-wrap: wrap;
    }
    .line .grow {
      flex: 1;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 3px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      /* 0.1.162: the form opens inside the list's padded detail row; a field never grows past it (the profile select's
         longest option, "זיהוי אוטומטי · ...", is wider than a 320 px phone's row) */
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    .f.inline {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    input[type='text'],
    input[type='number'],
    select {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      max-inline-size: 100%;
    }
    select {
      max-inline-size: 100%;
      min-inline-size: 0;
    }
    input[type='text'] {
      min-inline-size: min(200px, 100%);
    }
    input[type='number'] {
      inline-size: 88px;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      overflow: hidden;
    }
    .seg button {
      border: 0;
      background: var(--sw-surface);
      padding: 0 12px;
      min-block-size: 36px;
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse);
    }
    .seg button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .ep {
      display: grid;
      grid-template-columns: minmax(140px, 1.4fr) minmax(90px, 0.8fr) minmax(0, 2fr) auto;
      gap: 6px 12px;
      align-items: center;
      padding: 6px 0;
      font-size: var(--sw-fs-sm);
      border-block-end: 1px dashed var(--sw-border);
    }
    .ep:last-child {
      border-block-end: 0;
    }
    .link {
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-sm);
      cursor: pointer;
      background: none;
      border: 0;
      padding: 0;
      font-family: inherit;
      min-block-size: 32px;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .sec {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 6px 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .sec .nm {
      flex: 1;
      font-size: var(--sw-fs-sm);
    }
    .ok {
      color: var(--sw-success-text);
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-sm);
    }
    @media (max-width: 767px) {
      .ep {
        grid-template-columns: 1fr;
      }
      input[type='text'] {
        min-inline-size: 0;
        inline-size: 100%;
      }
    }
  `,de];f([p()],g.prototype,"phase",2);f([p()],g.prototype,"list",2);f([p()],g.prototype,"status",2);f([p()],g.prototype,"enabled",2);f([p()],g.prototype,"remote",2);f([p()],g.prototype,"remoteDirty",2);f([p()],g.prototype,"error",2);f([p()],g.prototype,"note",2);f([p()],g.prototype,"saved",2);f([p()],g.prototype,"open",2);f([p()],g.prototype,"editing",2);f([p()],g.prototype,"view",2);f([p()],g.prototype,"tab",2);g=f([R("system-multimedia")],g);export{g as SystemMultimedia};
//# sourceMappingURL=system-multimedia-D-e5jS6A.js.map
