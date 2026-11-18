const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{g as N,j as m,i as H,m6 as re,cP as y,n as $,tz as ss,cy as g,b as r,A as u,eY as as,tA as ge,k as q,a3 as L,bn as be,b4 as we,bs as ts,hW as v,_ as is,lG as ns,U as d,tB as R,bc as le,tC as os,tD as me,ay as B,dE as n,tE as rs,tF as He,aU as he,e1 as ls,aL as ve,s as X,aN as ds,aB as G,dX as $e,a as qe,ei as J,tG as Be,tH as cs,tI as ee,tJ as ps,eF as fe,iE as se,p as us,bo as ms,dK as hs,tK as vs,tL as K,bf as gs}from"./index-CkOaAZ0k.js";import{d as ye}from"./media-preset-editor-1seQWvkH.js";import{f as bs,D as ke,p as ws,a as $s,z as fs}from"./multimedia-players-layout-Bnemt_6g.js";import{f as ys,A as de,g as _e,a as xe,h as ks,i as _s,j as ze,e as E,k as Se,l as xs,c as zs}from"./announcements-DkiNTn9_.js";import{d as O,l as Ss,m as As,a as ce,k as Cs,n as Es,N as Os,T as Ls,o as Ae,q as Ds,u as Ts,v as Ns,w as Ps,x as ae,y as Is,z as Rs}from"./announce-D8fOusm3.js";import{s as Ms}from"./settings-mBGpMa3Z.js";import"./sw-logo-art-MaHPMZFI.js";var js=Object.defineProperty,Hs=Object.getOwnPropertyDescriptor,P=(e,s,a,t)=>{for(var i=t>1?void 0:t?Hs(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&js(s,a,i),i};const qs={off:"neutral",ready:"live",unreachable:"error",unauthorized:"error",schema_too_old:"error",error:"error",unreadable:"error",host_refused:"error"};let z=class extends H{constructor(){super(...arguments),this.conn=null,this.url="",this.token="",this.editingToken=!1,this.busy=!1,this.error="",this.test=null}connectedCallback(){super.connectedCallback(),re()||this.load()}async load(){try{this.conn=await y().maConnection(),this.url=this.conn.url??""}catch(e){this.error=$(e)}}updated(){const e=String(this.busy);this.getAttribute("aria-busy")!==e&&this.setAttribute("aria-busy",e)}async save(e){this.busy=!0,this.error="";try{this.conn=await y().saveMaConnection(e),"url"in e&&(this.url=this.conn.url??""),("token"in e||"clear_token"in e)&&(this.token="",this.editingToken=!1),this.test=null}catch(s){this.error=$(s)}finally{this.busy=!1}}async runTest(){this.busy=!0,this.error="";try{this.test=await y().testMaConnection(),this.conn=await y().maConnection()}catch(e){this.error=$(e)}finally{this.busy=!1}}render(){const e=this.conn;if(re())return r`<div class="row"><span class="lbl">${g("חיבור ישיר ל־Music Assistant")}<span class="muted" data-mc-local-only>${ss}</span></span></div>`;if(!e)return this.error?r`<div class="err" role="alert">${this.error}</div>`:u;const s=this.test??e.last_test,a=e.token_set_at?as(e.token_set_at):null;return r`
      <div class="row"><span class="lbl">${g("חיבור ישיר ל־Music Assistant")}<span class="muted">${g("תור מלא (גרירה, מחיקה, נגן הבא) וחיפוש בספרייה. ללא החיבור: התור הקצר והספרייה בלי חיפוש.")}</span></span>
        <span class="acts"><sw-badge kind=${qs[e.state]} label=${ge[e.state]} data-mc-state=${e.state}></sw-badge>
          <sw-toggle label=${g("חיבור ישיר")} labelHidden .checked=${e.enabled} ?disabled=${this.busy||!e.url&&!this.url} data-mc-enabled
            @change=${t=>void this.save({enabled:t.detail.checked,...this.url&&this.url!==e.url?{url:this.url}:{}})}></sw-toggle></span></div>
      <div class="row"><span class="lbl">${g("כתובת השרת")}<span class="muted">${g("http://שם-מארח:8095 · נשמרת בהגדרות בלבד")}</span></span>
        <span class="acts"><input type="url" inputmode="url" spellcheck="false" placeholder="http://host:8095" .value=${this.url} data-mc-url aria-label=${g("כתובת השרת")}
            @input=${t=>this.url=t.target.value} />
          <sw-button size="sm" ?disabled=${this.busy||this.url===(e.url??"")} data-mc-url-save @click=${()=>void this.save({url:this.url||null})}>${g("שמור")}</sw-button></span></div>
      <div class="row"><span class="lbl">${g("אסימון גישה")}<span class="muted" data-mc-token>${e.token_set?a?g("הוגדר ב־{date}",{date:a}):g("הוגדר"):g("לא הוגדר")} · ${g("משתמש ייעודי עם סינון נגנים")}${e.token_expiring?r` · <span class="warn">${g("יש לחדש את האסימון")}</span>`:""}</span></span>
        <span class="acts">${this.editingToken||!e.token_set?r`<input type="password" autocomplete="off" spellcheck="false" .value=${this.token} data-mc-token-input aria-label=${g("אסימון גישה")} @input=${t=>this.token=t.target.value} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy||this.token.trim().length<16} data-mc-token-save @click=${()=>void this.save({token:this.token.trim()})}>${g("שמור")}</sw-button>
              ${e.token_set?r`<sw-button size="sm" ?disabled=${this.busy} @click=${()=>{this.editingToken=!1,this.token=""}}>${g("ביטול")}</sw-button>`:u}`:r`<sw-button size="sm" ?disabled=${this.busy} data-mc-token-replace @click=${()=>this.editingToken=!0}>${g("החלף")}</sw-button>
              <sw-button size="sm" variant="danger" ?disabled=${this.busy} data-mc-token-clear @click=${()=>void this.save({clear_token:!0})}>${g("מחק")}</sw-button>`}</span></div>
      <div class="row"><span class="lbl">${g("בדיקת חיבור")}<span class="muted" data-mc-test>${s?`${ge[s.state]}${s.server_version?` · ${g("גרסה {v}",{v:s.server_version})}`:""}${s.schema_version!==null?` · ${g("סכמה {v}",{v:s.schema_version})}`:""}${s.players!==null?` · ${g("{n} נגנים גלויים לחשבון",{n:s.players})}`:""}`:g("לא נבדק")}</span></span>
        <sw-button size="sm" ?disabled=${this.busy||!e.url||!e.token_set} data-mc-test-run @click=${()=>void this.runTest()}>${g("בדוק חיבור")}</sw-button></div>
      ${this.error?r`<div class="err" role="alert" data-mc-error>${this.error}</div>`:u}`}};z.styles=N`
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
  `;P([m()],z.prototype,"conn",2);P([m()],z.prototype,"url",2);P([m()],z.prototype,"token",2);P([m()],z.prototype,"editingToken",2);P([m()],z.prototype,"busy",2);P([m()],z.prototype,"error",2);P([m()],z.prototype,"test",2);z=P([q("media-ma-connection")],z);const Bs={list:()=>we("multimedia/admin/devices"),update:(e,s)=>ts(`multimedia/admin/devices/${encodeURIComponent(e)}`,s),link:async e=>(await be("multimedia/admin/links",e),we("multimedia/admin/devices")),approve:(e,s,a)=>be("multimedia/admin/approve",{...e?{device_keys:e}:{},approved:s,...a?.length?{kinds:a}:{}})},te=e=>JSON.parse(JSON.stringify(e));function Fs(){const e=(t,i,o,l,c,p=[],h=!1)=>({endpoint_id:t,platform:i,role:o,rule:l,link_source:h?"manual":"auto",hidden:c,primary_for:p}),s=(t,i,o,l,c,p,h,x={})=>({key:t,name:i,kind:"screen",kind_source:"auto",approved:p,public:!1,profile:c,profile_source:"auto",confidence:"exact",anchor_entity_id:h[0].endpoint_id.replace(/^ha:/,""),floor_name:o,area_name:l,audio_link_key:null,audio_default:"screen",volume_max:null,model_keys:[],also_turns_on:[],endpoints:h,...x}),a=(t,i,o,l)=>({method:t,confidence:i,via:o,reason:l});return[s("md-living","טלוויזיה סלון","קומת קרקע","סלון","samsung_smart",!0,[e("ha:media_player.demo_living","samsungtv_smart","vendor","1",!1,["power","sources","apps","keys"]),e("ha:media_player.demo_living_cast","cast","cast","3",!0,["now_playing"]),e("ha:media_player.demo_living_st","smartthings","smartthings","3",!0),e("ha:media_player.demo_living_ma","music_assistant","ma_export","2",!0)],{confidence:"strong",audio_link_key:"mp-ampl",audio_default:"linked",also_turns_on:["מגבר סלון"],volume_max:60,cast:a("cast_hls","confirmed","ha:media_player.demo_living_cast","cast_video")}),s("md-kitchen","טלוויזיה מטבח","קומת קרקע","מטבח","lg_webos",!0,[e("ha:media_player.demo_kitchen","webostv","vendor","1",!1,["power","volume","mute","sources","apps","keys","now_playing"])],{cast:a("none","unknown",null,"no_path")}),s("md-pergola","מסך פרגולה","קומת קרקע","פרגולה","samsung_smart",!0,[e("ha:media_player.demo_pergola","samsungtv_smart","vendor","1",!1,["power","sources","apps","keys"])],{public:!0,cast:a("browser_url","unknown","ha:media_player.demo_pergola","samsung_browser")}),s("md-parents","טלוויזיה הורים","קומה 1","חדר הורים","android_tv",!0,[e("ha:remote.demo_parents","androidtv_remote","remote","1",!1,["power","apps","keys"]),e("ha:media_player.demo_parents_cast","cast","cast","1",!1,["now_playing"])],{cast:a("cast_hls","confirmed","ha:media_player.demo_parents_cast","cast_video")}),s("md-kids","מסך ילדים","קומה 1","חדר ילדים","generic",!0,[e("ha:media_player.demo_kids","dlna_dmr","dlna","1",!1,["power","volume","mute","sources","now_playing"])],{cast:a("dlna","likely","ha:media_player.demo_kids","dlna_renderer")}),s("md-new","מסך חדש שזוהה","קומה 1","חדר עבודה","generic",!1,[e("ha:media_player.demo_new","samsungtv","vendor","1",!1,["power"])],{confidence:"weak",cast:a("none","unknown",null,"no_path")})]}const W=()=>is(()=>import("./media-players-mock-DlUDLhwY.js"),__vite__mapDeps([0]),import.meta.url).then(e=>e.playersMock());class Ks{constructor(){this.devices=Fs(),this.suggestions=[{endpoint_id:"ha:media_player.demo_new",device_key:"md-kitchen",rule:"weak",reason:"אותו חדר ושם דומה"}]}async snapshot(){const s=await W();return te({devices:[...this.devices,...s.adminList()],suggestions:this.suggestions})}async list(){return this.snapshot()}async update(s,a){if(s.startsWith("mp-")){const i=await W(),o=a.area_id?pe.find(l=>l.id===a.area_id):a.area_id===null?null:void 0;return i.adminPatch(s,{...o!==void 0?{area:o?{id:o.id,name:o.name,floor:o.floor_name?[Gs[o.floor_name]??o.floor_name,o.floor_name]:null}:null}:{},...a.volume_max!==void 0?{volume_max:a.volume_max}:{},...a.volume_night!==void 0?{volume_night:a.volume_night}:{},...a.approved!==void 0?{approved:a.approved}:{},...a.display_name?{name:a.display_name.trim()}:{}}),te(i.adminList().find(l=>l.key===s)??{key:s,name:s,kind:"virtual_group",approved:a.approved!==!1})}const t=this.devices.find(i=>i.key===s);if(!t)throw new Error("not found");return a.display_name!==void 0&&(t.name=a.display_name?.trim()||t.name),a.kind&&([t.kind,t.kind_source]=[a.kind,"manual"]),a.approved!==void 0&&(t.approved=a.approved),a.public!==void 0&&(t.public=a.public),a.profile!==void 0&&([t.profile,t.profile_source]=a.profile?[a.profile,"manual"]:[t.profile,"auto"]),a.audio_link_key!==void 0&&(t.audio_link_key=a.audio_link_key),a.audio_default&&(t.audio_default=a.audio_default),a.volume_max!==void 0&&(t.volume_max=a.volume_max),a.volume_night!==void 0&&(t.volume_night=a.volume_night),a.area_id!==void 0&&(t.area_id=a.area_id,t.area_name=a.area_id?pe.find(i=>i.id===a.area_id)?.name??a.area_id:null),a.model_keys&&(t.model_keys=a.model_keys),te(t)}async link(s){const a=await W();for(const t of this.devices){const i=t.endpoints.find(o=>o.endpoint_id===s.endpoint_id);i&&(s.op==="ignore"&&(i.hidden=!0),s.op==="restore"&&(i.hidden=!1),s.op==="unlink"&&(i.link_source="manual"))}return s.op==="link"&&(this.suggestions=this.suggestions.filter(t=>t.endpoint_id!==s.endpoint_id)),(s.op==="link"||s.op==="ignore")&&a.answerSuggestion(s.op,s.endpoint_id,s.device_key),this.snapshot()}async approve(s,a,t){const i=await W(),o=s?.filter(p=>!p.startsWith("mp-"))??[];for(const p of this.devices)(s?o.includes(p.key):!t?.length&&p.kind==="screen")&&(p.approved=a);const l=s===null&&!t?.length?null:i.approve(s?s.filter(p=>p.startsWith("mp-")):null,a,t),c=this.devices.filter(p=>p.kind==="screen");return{requested:s?s.length:l?.requested??c.length,changed:l?.changed??o.length,approved:c.filter(p=>p.approved).length,pending_approval:c.filter(p=>!p.approved).length,...t?.length?{approved_players:l?.approved_players,pending_players:l?.pending_players}:{}}}}const pe=[{id:"living",name:"סלון",floor_name:"קומת קרקע"},{id:"kitchen",name:"מטבח",floor_name:"קומת קרקע"},{id:"pergola",name:"פרגולה",floor_name:"קומת קרקע"},{id:"guest",name:"חדר אורחים",floor_name:"קומת קרקע"},{id:"parents",name:"חדר הורים",floor_name:"קומה 1"},{id:"kids",name:"חדר ילדים",floor_name:"קומה 1"},{id:"office",name:"חדר עבודה",floor_name:"קומה 1"},{id:"basement",name:"מרתף",floor_name:"מרתף"}],Gs={"קומת קרקע":"g","קומה 1":"u1",מרתף:"b"};async function Vs(){if(!L())return pe;try{return(await ns()).floors.flatMap(s=>s.areas.map(a=>({id:a.area_id,name:a.name,floor_name:s.floor_id==="none"?null:s.name})))}catch{return[]}}let Us=null;const C=()=>L()?Bs:Us??=new Ks,ue={samsung_smart:"Samsung (samsungtv_smart)",lg_webos:"LG (webostv)",android_tv:"Android TV (androidtv_remote)",generic:v("כללי")},ie={screen:v("מסך"),receiver:v("מגבר"),speaker:v("רמקול"),player:v("נגן")},ne={screen:v("מסך"),receiver:v("מגבר"),speaker:v("רמקול"),player:v("נגן"),group:v("קבוצה"),session:v("סשן"),virtual_group:v("קבוצה וירטואלית"),service:v("שירות")},Fe={vendor:v("יצרן"),remote:v("שלט"),cast:"Cast",dlna:"DLNA",smartthings:"SmartThings",ma_export:v("Music Assistant (יצוא)"),ma_import:v("Music Assistant (יבוא)"),ma_native:"Music Assistant",ma_universal:v("Music Assistant (אוניברסלי)"),other:v("אחר"),music:v("שכבת המוזיקה"),mirror:v("מראה (מוסתר)")},Ws={power:v("הפעלה"),volume:v("עוצמה"),mute:v("השתקה"),sources:v("מקורות"),apps:v("אפליקציות"),keys:v("מקשים"),now_playing:v("מה מתנגן")},Ke={exact:v("מדויק"),strong:v("חזק"),weak:v("חלש"),manual:v("ידני")},Ge=["type","integration","entityId","deviceId","room","floor","status","cast","connections"],Ys={type:d("סוג"),integration:d("אינטגרציה"),entityId:d("מזהה ישות"),deviceId:d("מזהה התקן"),room:d("חדר"),floor:d("קומה"),status:d("מצב"),cast:d("שידור"),connections:d("חיבורים")},Qs=1280,Xs=1228,Js=864,Zs=e=>e>=Xs?"wide":"md";function Ve(e,s){return e==="floor"?!1:e==="room"||e==="cast"?s==="wide":!0}function M(e,s,a){const t=e[s];return typeof t=="boolean"?t:Ve(s,a)}function Q(e,s){return[M(e,s,"wide")?"":"hw",M(e,s,"md")?"":"hm"].filter(Boolean).join(" ")}const ea={wide:{x:"var(--hit)",name:"minmax(150px, 1.5fr)",type:"96px",integration:"130px",id:"minmax(200px, 1.9fr)",floor:"110px",room:"minmax(110px, 1fr)",status:"90px",cast:"132px",ap:"64px",connections:"110px"},md:{x:"var(--hit)",name:"minmax(130px, 1.4fr)",type:"84px",integration:"110px",id:"minmax(170px, 1.7fr)",floor:"100px",room:"minmax(100px, 1fr)",status:"80px",cast:"120px",ap:"60px",connections:"104px"}};function Ce(e,s){const a=o=>M(e,o,s),t=ea[s],i=[t.x,t.name];return a("type")&&i.push(t.type),a("integration")&&i.push(t.integration),(a("entityId")||a("deviceId"))&&i.push(t.id),a("floor")&&i.push(t.floor),a("room")&&i.push(t.room),a("status")&&i.push(t.status),a("cast")&&i.push(t.cast),i.push(t.ap),a("connections")&&i.push(t.connections),i.join(" ")}function sa(e){return[M(e,"floor","wide")?"fl-w":"",M(e,"floor","md")?"fl-m":""].filter(Boolean).join(" ")}function aa(e,s,a,t){const i={...e};return a===Ve(s,t)?delete i[s]:i[s]=a,i}const ta=e=>Object.keys(e).length>0,V="__none__",D="__none__",U={q:"",integrations:[],area:"",type:"",approval:"all",avail:"all",sort:"name",dir:"asc",group:"none",collapsed:[],cols:{}},ia=["name","type","integration","area","id","status"],na=["none","integration","area","type"];function oa(e){return e==="screen"?"screen":e==="speaker"?"speaker":"other"}const Ee={vendor:0};function ra(e){const a=[...e.endpoints].sort((i,o)=>Number(i.hidden)-Number(o.hidden)||(Ee[i.role]??1)-(Ee[o.role]??1)).map(i=>i.platform).filter(Boolean),t=e.integrations??[];return[...new Set([...a,...t])]}function la(e){return e.anchor_entity_id||e.endpoints[0]?.endpoint_id.replace(/^ha:/,"")||""}function Ue(e,s){const a=ra(e),t=e.area_name??"",i=s?s(e.key):null;return{integrations:a,primary:a[0]??"",entityId:la(e),deviceId:e.ha_device_id??"",area:t,areaKey:t||V,type:oa(e.kind),available:i!==null?i:typeof e.available=="boolean"?e.available:null}}const Oe=e=>e.toLocaleLowerCase("he").normalize("NFKC");function da(e,s,a){const t=Oe(a).split(/\s+/).filter(Boolean);if(!t.length)return!0;const i=Oe([e.name,e.area_name??"",e.floor_name??"",s.entityId,s.deviceId,...e.endpoints.map(o=>o.endpoint_id),...s.integrations,...s.integrations.map(R)].join(`
`));return t.every(o=>i.includes(o))}function ca(e,s,a){return a.integrations.length&&!(a.integrations.includes(D)&&!s.integrations.length)&&!s.integrations.some(t=>a.integrations.includes(t))||a.area&&s.areaKey!==a.area||a.type&&s.type!==a.type||a.approval==="approved"&&!e.approved||a.approval==="pending"&&e.approved||a.avail==="available"&&s.available!==!0||a.avail==="unavailable"&&s.available!==!1?!1:da(e,s,a.q)}const j=(e,s)=>e.localeCompare(s,"he",{numeric:!0,sensitivity:"base"}),pa=(e,s,a)=>e===""&&s!==""?1:s===""&&e!==""?-1:a*j(e,s),ua=e=>e===!0?0:e===!1?1:2;function Le(e,s,a){switch(a){case"name":return e.name;case"type":return s.type+":"+e.kind;case"integration":return R(s.primary);case"area":return s.area;case"id":return s.entityId;case"status":return String(ua(s.available))}}function ma(e,s,a){const t=a==="asc"?1:-1;return[...e].sort((i,o)=>pa(Le(i.d,i.f,s),Le(o.d,o.f,s),t)||j(i.d.name,o.d.name)||j(i.d.key,o.d.key))}function ha(e,s,a,t){return s==="integration"?{id:e.f.primary||D,label:R(e.f.primary)||t.integration}:s==="area"?{id:e.f.areaKey,label:e.f.area||t.area}:{id:e.f.type,label:a(e.f.type)}}const We={screen:d("מסכים"),speaker:d("רמקולים ונגנים"),other:d("אחר")};function va(e,s,a){const t=e.map(p=>({d:p,f:Ue(p,a)})),i=ma(t.filter(p=>ca(p.d,p.f,s)),s.sort,s.dir);if(s.group==="none")return{groups:[{id:"",label:"",rows:i}],shown:i.length,total:t.length};const o=new Map;for(const p of i){const h=ha(p,s.group,x=>We[x],{area:d("ללא חדר"),integration:d("ללא אינטגרציה")});o.has(h.id)||o.set(h.id,{...h,rows:[]}),o.get(h.id).rows.push(p)}const l=s.sort===s.group||s.sort==="integration"&&s.group==="integration"?s.dir==="asc"?1:-1:1;return{groups:[...o.values()].sort((p,h)=>p.id===V||p.id===D?1:h.id===V||h.id===D?-1:l*j(p.label,h.label)),shown:i.length,total:t.length}}function ga(e,s){const a=new Map,t=new Map,i=new Set;for(const o of e){const l=Ue(o,s);for(const p of l.integrations.length?l.integrations:[D])a.set(p,(a.get(p)??0)+1);const c=t.get(l.areaKey)??{label:l.area||d("ללא חדר"),count:0};c.count+=1,t.set(l.areaKey,c),i.add(l.type)}return{integrations:[...a].map(([o,l])=>({id:o,count:l})).sort((o,l)=>o.id===D?1:l.id===D?-1:j(o.id,l.id)),areas:[...t].map(([o,l])=>({id:o,...l})).sort((o,l)=>o.id===V?1:l.id===V?-1:j(o.label,l.label)),types:["screen","speaker","other"].filter(o=>i.has(o))}}function ba(e){return!!(e.q.trim()||e.integrations.length||e.area||e.type||e.approval!=="all"||e.avail!=="all")}const wa="sw.media-admin.view.";function $a(e){const s=e&&typeof e=="object"&&!Array.isArray(e)?e:{},a={};for(const t of Ge)typeof s[t]=="boolean"&&(a[t]=s[t]);return a}function fa(e){const s=e&&typeof e=="object"?e:{},a=(o,l="")=>typeof o=="string"?o:l,t=(o,l,c)=>typeof o=="string"&&l.includes(o)?o:c,i=o=>Array.isArray(o)?o.filter(l=>typeof l=="string").slice(0,100):[];return{q:a(s.q).slice(0,100),integrations:i(s.integrations),area:a(s.area),type:t(s.type,["","screen","speaker","other"],""),approval:t(s.approval,["all","approved","pending"],"all"),avail:t(s.avail,["all","available","unavailable"],"all"),sort:t(s.sort,ia,"name"),dir:t(s.dir,["asc","desc"],"asc"),group:t(s.group,na,"none"),collapsed:i(s.collapsed),cols:$a(s.cols)}}const Ye=(e,s)=>`${wa}${e}.${s||"anon"}`;function Qe(e,s,a){try{const i=(a??localStorage).getItem(Ye(e,s));return i?fa(JSON.parse(i)):{...U}}catch{return{...U}}}function Xe(e,s,a,t){try{(t??localStorage).setItem(Ye(e,s),JSON.stringify({...a,q:""}))}catch{}}var ya=Object.defineProperty,ka=Object.getOwnPropertyDescriptor,I=(e,s,a,t)=>{for(var i=t>1?void 0:t?ka(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&ya(s,a,i),i};const De={name:d("שם"),type:d("סוג"),integration:d("אינטגרציה"),area:d("חדר"),id:d("מזהה"),status:d("מצב")},Te={none:d("ללא קיבוץ"),integration:d("לפי אינטגרציה"),area:d("לפי חדר"),type:d("לפי סוג")};let S=class extends H{constructor(){super(...arguments),this.devices=[],this.view=U,this.shown=0,this.scope="",this.colsOpen=!1,this.bp="wide",this.onMq=()=>{this.bp=this.mq?.matches?"md":"wide"},this.onDocDown=e=>{this.colsOpen&&!e.composedPath().includes(this)&&(this.colsOpen=!1)}}connectedCallback(){if(super.connectedCallback(),typeof ResizeObserver=="function"&&typeof CSS<"u"&&CSS.supports?.("container-type: inline-size"))this.ro=new ResizeObserver(e=>{const s=e[0]?.contentRect.width??0;if(s<=0)return;this.bp=Zs(s);const a=s<Js;this.toggleAttribute("data-cards",a),a&&(this.colsOpen=!1)}),this.ro.observe(this);else try{this.mq=window.matchMedia(`(max-width: ${Qs}px)`),this.onMq(),this.mq.addEventListener("change",this.onMq)}catch{}document.addEventListener("pointerdown",this.onDocDown,!0)}disconnectedCallback(){this.mq?.removeEventListener("change",this.onMq),this.ro?.disconnect(),this.ro=void 0,document.removeEventListener("pointerdown",this.onDocDown,!0),super.disconnectedCallback()}emit(e){this.dispatchEvent(new CustomEvent("view-change",{detail:{...this.view,...e},bubbles:!0,composed:!0}))}toggleInt(e){const s=this.view.integrations;this.emit({integrations:s.includes(e)?s.filter(a=>a!==e):[...s,e]})}updated(){const e=this.renderRoot.querySelector("[data-mm-cols-panel]");if(!e)return;e.classList.remove("flip");const s=()=>{const a=e.getBoundingClientRect();return a.left<4||a.right>window.innerWidth-4};s()&&(e.classList.add("flip"),s()&&e.classList.remove("flip"))}pickCol(e,s){this.emit({cols:aa(this.view.cols,e,s,this.bp)})}onColsKey(e){e.key==="Escape"&&this.colsOpen&&(e.stopPropagation(),this.colsOpen=!1,this.renderRoot.querySelector("[data-mm-cols]")?.focus())}columnsControl(){const e=this.view;return r`<div class="colswrap" @keydown=${s=>this.onColsKey(s)}>
      <button type="button" class="ib" data-mm-cols aria-label=${d("עמודות")} title=${d("עמודות")} aria-haspopup="true" aria-expanded=${String(this.colsOpen)} aria-controls=${`cols-panel-${this.scope}`}
        @click=${()=>{this.colsOpen=!this.colsOpen}}><sw-icon name="grid" size="16"></sw-icon></button>
      ${this.colsOpen?r`<div class="colspanel" id=${`cols-panel-${this.scope}`} role="group" aria-label=${d("עמודות")} data-mm-cols-panel>
        ${Ge.map(s=>r`<label class="colopt"><input type="checkbox" data-mm-col=${s} .checked=${M(e.cols,s,this.bp)}
          @change=${a=>this.pickCol(s,a.target.checked)} />${Ys[s]}</label>`)}
        ${ta(e.cols)?r`<button type="button" class="colreset" data-mm-cols-reset @click=${()=>this.emit({cols:{}})}>${d("ברירת מחדל")}</button>`:u}
      </div>`:u}
    </div>`}render(){const e=this.view,s=ga(this.devices,this.live),a=[{id:"",label:d("כל החדרים")},...s.areas.map(h=>({id:h.id,label:h.label,count:h.count}))],t=[{id:"",label:d("כל הסוגים")},...s.types.map(h=>({id:h,label:We[h]}))],i=[{id:"all",label:d("כל האישורים")},{id:"approved",label:d("מאושרים")},{id:"pending",label:d("ממתינים לאישור")}],o=[{id:"all",label:d("כל המצבים")},{id:"available",label:d("זמינים")},{id:"unavailable",label:d("לא זמינים")}],l=Object.keys(De).map(h=>({id:h,label:d("מיון: {label}",{label:De[h]})})),c=Object.keys(Te).map(h=>({id:h,label:Te[h]})),p=h=>x=>this.emit({[h]:x.detail.id});return r`<div class="bar" role="search" data-mm-toolbar=${this.scope}>
      <label class="search"><sw-icon name="search" size="16"></sw-icon>
        <input type="search" .value=${e.q} placeholder=${d("חיפוש שם, מזהה או אינטגרציה")} aria-label=${d("חיפוש שם, מזהה או אינטגרציה")} data-mm-search
          @input=${h=>this.emit({q:h.target.value})} /></label>
      ${s.areas.length>1?r`<sw-dropdown label=${d("סינון לפי חדר")} data-mm-f-area .items=${a} .value=${e.area} @change=${p("area")}></sw-dropdown>`:u}
      ${s.types.length>1?r`<sw-dropdown label=${d("סינון לפי סוג")} data-mm-f-type .items=${t} .value=${e.type} @change=${p("type")}></sw-dropdown>`:u}
      <sw-dropdown label=${d("סינון לפי אישור")} data-mm-f-approval .items=${i} .value=${e.approval} @change=${h=>this.emit({approval:h.detail.id})}></sw-dropdown>
      <sw-dropdown label=${d("סינון לפי מצב")} data-mm-f-avail .items=${o} .value=${e.avail} @change=${h=>this.emit({avail:h.detail.id})}></sw-dropdown>
      <sw-dropdown label=${d("מיון")} data-mm-sort .items=${l} .value=${e.sort} @change=${h=>this.emit({sort:h.detail.id})}></sw-dropdown>
      <button type="button" class="ib" data-mm-dir aria-label=${e.dir==="asc"?d("סדר עולה, לחץ להיפוך"):d("סדר יורד, לחץ להיפוך")} @click=${()=>this.emit({dir:e.dir==="asc"?"desc":"asc"})}>
        <sw-icon name=${e.dir==="asc"?"arrowUp":"arrowDown"} size="16"></sw-icon></button>
      <sw-dropdown label=${d("קיבוץ")} data-mm-group .items=${c} .value=${e.group} @change=${h=>this.emit({group:h.detail.id,collapsed:[]})}></sw-dropdown>
      ${this.columnsControl()}
      ${ba(e)?r`<button type="button" class="clear" data-mm-clear @click=${()=>this.emit({q:"",integrations:[],area:"",type:"",approval:"all",avail:"all"})}>${d("נקה סינון")}</button>`:u}
      <span class="count" data-mm-shown role="status">${this.shown===this.devices.length?`${this.devices.length}`:d("{shown} מתוך {length}",{shown:this.shown,length:this.devices.length})}</span>
    </div>
    ${s.integrations.length>1?r`<div class="ints" role="group" aria-label=${d("סינון לפי אינטגרציה")} data-mm-f-int>
      ${s.integrations.map(h=>r`<button type="button" class="chip" data-mm-int=${h.id} aria-pressed=${String(e.integrations.includes(h.id))}
        @click=${()=>this.toggleInt(h.id)}>${h.id===D?d("ללא אינטגרציה"):R(h.id)}<span class="n">${h.count}</span></button>`)}
    </div>`:u}`}};S.styles=N`
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
  `;I([B({attribute:!1})],S.prototype,"devices",2);I([B({attribute:!1})],S.prototype,"view",2);I([B({attribute:!1})],S.prototype,"live",2);I([B({type:Number})],S.prototype,"shown",2);I([B()],S.prototype,"scope",2);I([m()],S.prototype,"colsOpen",2);I([m()],S.prototype,"bp",2);S=I([q("media-admin-toolbar")],S);const _a=[{key:"x",label:"",cls:"c-x"},{key:"name",label:d("שם"),cls:"c-name"},{key:"type",label:d("סוג"),cls:"c-type",opt:"type"},{key:"integration",label:d("אינטגרציה"),cls:"c-int",opt:"integration"},{key:"id",label:d("מזהה"),cls:"c-id",opt:"id"},{key:"x",label:d("קומה"),cls:"c-fl",opt:"floor"},{key:"area",label:d("חדר"),cls:"c-area",opt:"room"},{key:"status",label:d("מצב"),cls:"c-st",opt:"status"},{key:"x",label:d("שידור"),cls:"c-cast",opt:"cast"},{key:"x",label:d("מאושר"),cls:"c-ap"},{key:"x",label:d("חיבורים"),cls:"c-cn",opt:"connections"}];function Je(e,s){if(!s)return"";if(s!=="id")return Q(e,s);const a=Q(e,"entityId").split(" "),t=Q(e,"deviceId").split(" ");return a.filter(i=>i&&t.includes(i)).join(" ")}function xa(e){const s=e.view;return r`<div class="thead" role="row">${_a.map(a=>({...a,h:Je(s.cols,a.opt)})).map(a=>a.key==="x"?r`<div role="columnheader" class=${`th ${a.cls} ${a.h}`}>${a.label}</div>`:r`<div role="columnheader" class=${`th ${a.cls} ${a.h}`} aria-sort=${s.sort===a.key?s.dir==="asc"?"ascending":"descending":"none"}>
        <button type="button" class="sortb" data-mm-th=${a.key} @click=${()=>e.onView({...s,sort:a.key,dir:s.sort===a.key&&s.dir==="asc"?"desc":"asc"})}>${a.label}${s.sort===a.key?r`<sw-icon name=${s.dir==="asc"?"arrowUp":"arrowDown"} size="12"></sw-icon>`:u}</button></div>`)}</div>`}function Ne(e,s,a){const t=e.editing.has(s.key),i=e.endpoints.has(s.key),o=e.status?e.status(s,a):a.available===null?null:a.available?{kind:"ok",label:d("זמין")}:{kind:"stale",label:d("לא זמין")},l=a.integrations.length-1,c=e.view.cols,p=Z=>Q(c,Z),h=Je(c,"id"),x=os(s.cast);return r`<div class=${`item${t?" sel":""}`} role="rowgroup" data-mm-admin-device=${s.key}>
    <div class="tr" role="row">
      <div role="cell" class="c c-x"><button type="button" class="eb" data-mm-edit=${s.key} aria-expanded=${String(t)} aria-label=${`${t?d("סגור עריכה"):d("עריכה")}: ${s.name}`} @click=${()=>e.onEdit(s.key)}>
        <sw-icon name=${t?"chevronDown":"chevronBack"} size="14"></sw-icon></button></div>
      <div role="cell" class="c c-name"><span class="nm" title=${s.name} data-mm-row-name=${s.key}>${s.name}</span>${e.saved===s.key?r`<span class="ok" role="status">${d("נשמר")}</span>`:u}</div>
      <div role="cell" class=${`c c-type ${p("type")}`}><span class="lb">${d("סוג")}</span>${e.typeLabel(s)}</div>
      <div role="cell" class=${`c c-int ${p("integration")}`} data-mm-int-cell=${s.key}><span class="lb">${d("אינטגרציה")}</span>${a.integrations.length?r`<span class="mono" title=${a.integrations.map(me).join(", ")}>${R(a.primary)}</span>${l>0?r`<span class="more">+${l}</span>`:u}`:r`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-id ${h}`} data-mm-id-cell=${s.key}>
        ${a.entityId?r`<span class=${`idl ${p("entityId")}`}><span class="mono" title=${a.entityId} data-mm-entity-id>${a.entityId}</span>
          <button type="button" class="cp" data-mm-copy=${s.key} aria-label=${d("העתק מזהה: {entityId}",{entityId:a.entityId})} @click=${()=>e.onCopy(a.entityId)}><sw-icon name="copy" size="14"></sw-icon></button></span>`:u}
        ${a.deviceId?r`<span class=${`idl ${p("deviceId")}`}><span class="mono dim" title=${a.deviceId} data-mm-device-id>${a.deviceId}</span>
          <button type="button" class="cp" data-mm-copy-device=${s.key} aria-label=${d("העתק מזהה התקן: {deviceId}",{deviceId:a.deviceId})} @click=${()=>e.onCopy(a.deviceId)}><sw-icon name="copy" size="14"></sw-icon></button></span>`:u}
        ${!a.entityId&&!a.deviceId?r`<span class="muted">—</span>`:u}</div>
      <div role="cell" class=${`c c-fl ${p("floor")}`} data-mm-floor-cell=${s.key}>${s.floor_name?r`<span class="floor" title=${s.floor_name}>${s.floor_name}</span>`:r`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-area ${p("room")}`}><span class="lb">${d("חדר")}</span>${a.area?r`${s.floor_name?r`<span class="fp">${s.floor_name} ‹ </span>`:u}${a.area}`:r`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-st ${p("status")}`} data-mm-status=${s.key}>${o?r`<sw-badge kind=${o.kind} label=${o.label}></sw-badge>`:r`<span class="muted">—</span>`}</div>
      <div role="cell" class=${`c c-cast ${p("cast")}`} data-mm-cast=${s.key} data-mm-cast-method=${s.cast?.method??""}><span class="lb">${d("שידור")}</span>${x?r`<sw-badge kind=${x.kind} label=${x.label} title=${x.title}></sw-badge>`:r`<span class="muted">—</span>`}</div>
      <div role="cell" class="c c-ap"><sw-toggle label=${d("מאושר: {name}",{name:s.name})} labelHidden .checked=${s.approved} data-mm-approved=${s.key} @change=${Z=>e.onApprove(s,Z.detail.checked)}></sw-toggle></div>
      <div role="cell" class=${`c c-cn ${p("connections")}`}><button type="button" class="cnb" data-mm-toggle-endpoints=${s.key} aria-expanded=${String(i)} @click=${()=>e.onEndpoints(s.key)}>${d("חיבורים ({n})",{n:s.endpoints.length})} ${i?"▴":"◂"}</button></div>
    </div>
    ${t||i?r`<div class="detail" role="row"><div role="cell" class="dcell">
      ${t?e.form(s):u}${i?e.connections(s):u}</div></div>`:u}
  </div>`}function za(e,s){const a=e.view,t=a.collapsed.includes(s.id);return r`<div class="ghead" role="row"><button type="button" class="gb" data-mm-group-head=${s.id} aria-expanded=${String(!t)}
    @click=${()=>e.onView({...a,collapsed:t?a.collapsed.filter(i=>i!==s.id):[...a.collapsed,s.id]})}>
    <sw-icon name=${t?"chevronBack":"chevronDown"} size="14"></sw-icon><span class="gl">${s.label}</span><span class="gc" data-mm-group-count>${s.rows.length}</span></button></div>`}function Ze(e){const{groups:s,shown:a}=va(e.devices,e.view,e.live);return r`<media-admin-toolbar scope=${e.scope} .devices=${e.devices} .view=${e.view} .live=${e.live} .shown=${a} @view-change=${t=>e.onView(t.detail)}></media-admin-toolbar>
    <div class=${`tbl ${sa(e.view.cols)}`} style=${`--cols-w: ${Ce(e.view.cols,"wide")}; --cols-m: ${Ce(e.view.cols,"md")}`} role="table" aria-label=${e.scope==="screens"?d("מסכים"):d("נגנים ורמקולים")} data-mm-table=${e.scope}>
      ${xa(e)}
      ${a===0?r`<div class="none muted" data-mm-no-match>${e.devices.length?d("אין התאמות לסינון"):e.none}</div>`:u}
      ${e.view.group==="none"?le(s[0].rows,t=>t.d.key,t=>Ne(e,t.d,t.f)):s.map(t=>r`<div role="rowgroup" class="grp" data-mm-grp=${t.id}>${za(e,t)}
            ${e.view.collapsed.includes(t.id)?u:le(t.rows,i=>i.d.key,i=>Ne(e,i.d,i.f))}</div>`)}
    </div>`}const Pe=N`
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
`,es=N`
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
    ${Pe}
  }
  @supports not (container-type: inline-size) {
    @media (max-width: 860px) {
      ${Pe}
    }
  }
`;var Sa=Object.defineProperty,Aa=Object.getOwnPropertyDescriptor,w=(e,s,a,t)=>{for(var i=t>1?void 0:t?Aa(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&Sa(s,a,i),i};const Ca=(e=3e3)=>new Promise(s=>setTimeout(s,e)),Ea=["speaker","player","receiver"],oe={ma:"music_assistant",sonos:"sonos",heos:"heos",vendor:n("יצרן"),none:n("ללא")},Ie=["speaker","player","receiver","group"],Oa={music:n("שכבת המוזיקה"),mirror:n("מראה (מוסתר)")},La={favourites:[],stations:[],playlists:[]},Y=["favourites","stations","playlists"];let b=class extends H{constructor(){super(...arguments),this.bubbleSkin=new ve(this),this.phase="loading",this.devices=[],this.live=new Map,this.status=null,this.sugg=null,this.answered=new Set,this.nonPhys=null,this.presets=null,this.fav=null,this.favLists=La,this.areas=[],this.open=new Set,this.editing=new Set,this.view={...U},this.npOpen=!1,this.saved="",this.error="",this.note="",this.deleting=null,this.busy=!1,this.noteTimer=0,this.offPush=null,this.setView=e=>{this.view=e,Xe("players",X.me?.user.id??"",e)},this.liveAvail=e=>{const s=this.live.get(e);return s?s.live.power!=="unavailable":null}}connectedCallback(){super.connectedCallback(),this.view=Qe("players",X.me?.user.id??""),this.load(),L()&&(this.offPush=ds(e=>{e.type==="media_groups_changed"&&this.loadGroups()}))}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer),this.offPush?.(),this.offPush=null}async load(){if(L()&&!G("system.configure")){this.phase="forbidden";return}const[e,s,a,t,i,o]=await Promise.allSettled([C().list(),y().status(),y().list(),y().suggestions(),y().nonPhysical(),Vs()]);e.status==="fulfilled"&&(this.devices=e.value.devices.filter(l=>Ie.includes(l.kind))),this.status=s.status==="fulfilled"?s.value:null,this.live=a.status==="fulfilled"?new Map(a.value.devices.map(l=>[l.key,l])):new Map,this.sugg=t.status==="fulfilled"?t.value:null,this.nonPhys=i.status==="fulfilled"?i.value.devices:null,this.areas=o.status==="fulfilled"?o.value:[],await Promise.all([this.loadGroups(),this.loadFavs()]),this.phase="ready"}async loadGroups(){try{this.presets=await y().presets()}catch{this.presets=null}}async loadFavs(){try{const e=await y().favourites(),s=[...this.live.values()].find(i=>i.caps.favourites||i.caps.stations),a={favourites:[],stations:[],playlists:[]},t=new Map(e.items.map(i=>[i.item_ref,i]));for(const i of Y){if(!s||!s.caps[i])continue;const l=(await y().library(s.key,i,0,!0)).items.map(c=>({ref:c.item_ref,name:t.get(c.item_ref)?.name??c.name,artist:c.artist,hidden:!!c.hidden}));a[i]=l.sort((c,p)=>(t.get(c.ref)?.order??1e6)-(t.get(p.ref)?.order??1e6))}this.favLists=a,this.fav=e}catch{this.fav=null}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}async patchDevice(e,s){this.error="";try{const a=await C().update(e.key,s);this.devices=this.devices.map(t=>t.key===e.key?a:t),this.saved=e.key,Ca().then(()=>this.saved=this.saved===e.key?"":this.saved)}catch(a){this.error=$(a),await this.load()}}async approveAll(){const e=this.devices.filter(s=>!s.approved).length;if(e)try{const s=await C().approve(null,!0,["speaker","player","receiver","group"]);this.devices=this.devices.map(a=>({...a,approved:!0})),this.say(n("אושרו {n} נגנים",{n:s.changed||e})),await this.load()}catch(s){this.error=$(s)}}async approveHelper(e,s){this.error="";try{await C().update(e,{approved:s}),this.nonPhys=(await y().nonPhysical()).devices,this.say(n("נשמר"))}catch(a){this.error=$(a)}}async link(e){try{const s=await C().link(e);this.devices=s.devices.filter(a=>Ie.includes(a.kind)),this.say(n("נשמר"))}catch(s){this.error=$(s)}}async answer(e,s){this.error="",this.answered=new Set([...this.answered,e.id]),await this.link({op:s,endpoint_id:e.endpoint_id,device_key:e.device_key}),this.error&&(this.answered=new Set([...this.answered].filter(a=>a!==e.id)))}async deletePreset(){const e=this.deleting;if(!(!e||this.busy)){this.busy=!0;try{await y().deletePreset(e.id,e.revision),this.deleting=null,this.say(n("נמחק")),await this.loadGroups()}catch(s){this.error=$e(s),s instanceof qe&&s.code==="revision_conflict"&&(this.deleting=null),await this.loadGroups()}finally{this.busy=!1}}}async saveFav(e,s){const a=this.fav;if(!a)return;const t=Y.flatMap(i=>s[i]).map((i,o)=>({item_ref:i.ref,hidden:i.hidden,order:o}));this.error="";try{this.fav=await y().saveFavourites({kinds_on:e,items:t},a.revision),this.favLists=s,this.say(n("נשמר"))}catch(i){this.error=$e(i),await this.loadFavs()}}toggleKind(e,s){const a=this.fav;a&&this.saveFav(s?[...new Set([...a.kinds_on,e])]:a.kinds_on.filter(t=>t!==e),this.favLists)}setHidden(e,s,a){this.saveFav(this.fav.kinds_on,{...this.favLists,[e]:this.favLists[e].map(t=>t.ref===s?{...t,hidden:a}:t)})}moveFav(e,s,a){const t=[...this.favLists[e]],i=t.findIndex(l=>l.ref===s),o=i+a;i<0||o<0||o>=t.length||([t[i],t[o]]=[t[o],t[i]],this.saveFav(this.fav.kinds_on,{...this.favLists,[e]:t}))}toggle(e,s){const a=new Set(this[e]);a.delete(s)||a.add(s),this[e]=a}async copy(e){try{await navigator.clipboard.writeText(e),this.say(n("הועתק"))}catch{this.say(n("ההעתקה נחסמה בדפדפן"))}}table(e){return Ze({scope:"players",devices:e,view:this.view,live:this.liveAvail,editing:this.editing,endpoints:this.open,saved:this.saved,status:(s,a)=>{const t=this.live.get(s.key)?.live.power;return t==="unavailable"?{kind:"stale",label:n("לא זמין")}:t==="off"?{kind:"neutral",label:n("כבוי")}:a.available===null?null:a.available?{kind:"ok",label:n("זמין")}:{kind:"stale",label:n("לא זמין")}},form:s=>this.form(s),connections:s=>this.connections(s),typeLabel:s=>ne[s.kind]??s.kind,onView:this.setView,onEdit:s=>this.toggle("editing",s),onEndpoints:s=>this.toggle("open",s),onApprove:(s,a)=>void this.patchDevice(s,{approved:a}),onCopy:s=>void this.copy(s),none:n("לא זוהו נגנים.")})}form(e){const s=this.devices.filter(l=>l.key!==e.key&&l.kind==="receiver"),a=e.volume_night??null,t=[e.floor_name,e.area_name].filter(Boolean).join(" ‹ "),i=(e.area_id??null)===null&&!e.area_name,o=l=>{const c=a??ke,p=fs(l.from??c.from,l.to??c.to,String(l.max??c.max));p&&this.patchDevice(e,{volume_night:p})};return r`<div class="dev" data-mm-form=${e.key}>
      <div class="line">
        <label class="f">${n("שם")}
          <input type="text" .value=${e.name} maxlength="60" data-mm-name=${e.key} @change=${l=>void this.patchDevice(e,{display_name:l.target.value})} />
        </label>
        <label class="f">${n("סוג")}
          ${e.kind==="group"?r`<span>${ne.group}</span>`:r`<select data-mm-kind=${e.key} @change=${l=>void this.patchDevice(e,{kind:l.target.value})}>
            ${Ea.map(l=>r`<option value=${l} ?selected=${e.kind===l}>${ne[l]}</option>`)}
          </select>`}
        </label>
        <span class="f">${n("זיהוי")}<sw-badge kind=${e.confidence==="weak"?"stale":"neutral"} label=${Ke[e.confidence]}></sw-badge></span>
        <label class="f">${n("חדר")}
          ${i&&this.areas.length?r`<select data-mm-area=${e.key} @change=${l=>{const c=l.target.value;c&&this.patchDevice(e,{area_id:c})}}>
                <option value="" selected>${n("ללא חדר")}</option>${this.areas.map(l=>r`<option value=${l.id}>${l.name}${l.floor_name?` · ${l.floor_name}`:""}</option>`)}</select>`:r`<span data-mm-place=${e.key}>${t||n("ללא חדר")}</span>`}
        </label>
        ${e.zones?.length?r`<span class="f">${n("אזורים")}<span>${e.zones.map(l=>l.name).join(" · ")}</span></span>`:u}
        <span class="grow"></span>
      </div>
      <div class="line">
        ${e.kind!=="receiver"&&e.kind!=="group"?r`<label class="f">${n("מגבר מקושר")}
          <select data-mm-link=${e.key} @change=${l=>{const c=l.target.value;this.patchDevice(e,{audio_link_key:c||null})}}>
            <option value="" ?selected=${!e.audio_link_key}>${n("ללא")}</option>
            ${s.map(l=>r`<option value=${l.key} ?selected=${e.audio_link_key===l.key}>${l.name}</option>`)}
          </select></label>`:u}
        <label class="f">${n("תקרת עוצמה")}
          <input type="number" min="0" max="100" .value=${e.volume_max===null?"":String(e.volume_max)} placeholder=${n("ללא")} data-mm-volmax=${e.key}
            @change=${l=>{const c=bs(l.target.value);c!=="invalid"&&this.patchDevice(e,{volume_max:c})}} />
        </label>
        <span class="f">${n("חלון לילה")}
          <span class="night">
            <sw-toggle label=${`${n("חלון לילה")}: ${e.name}`} labelHidden .checked=${!!a} data-mm-night=${e.key} @change=${l=>void this.patchDevice(e,{volume_night:l.detail.checked?{...ke}:null})}></sw-toggle>
            ${a?r`<span>${n("מ־")}</span><input type="time" lang=${J()} .value=${a.from} data-mm-night-from=${e.key} aria-label=${n("מ־")} @change=${l=>o({from:l.target.value})} />
              <span>${n("עד")}</span><input type="time" lang=${J()} .value=${a.to} data-mm-night-to=${e.key} aria-label=${n("עד")} @change=${l=>o({to:l.target.value})} />
              <span>${n("תקרה")}</span><input type="number" min="0" max="100" .value=${String(a.max)} data-mm-night-max=${e.key} aria-label=${n("תקרה בלילה")} @change=${l=>o({max:Number(l.target.value)})} />`:r`<span class="muted">${n("כבוי")}</span>`}
          </span>
        </span>
      </div>
      ${e.cast?r`<div class="muted" data-mm-cast-line=${e.key}>${n("שידור למסך:")} ${Be(e.cast)}</div>`:u}
    </div>`}connections(e){return r`<div data-mm-endpoints=${e.key}>${e.music_provider&&e.music_provider!=="none"?r`<div class="muted">${n("שכבת המוזיקה:")} ${oe[e.music_provider]}</div>`:u}${e.endpoints.map(s=>r`<div class="ep" data-mm-endpoint=${s.endpoint_id}>
        <span class="mono" data-mm-ep-platform=${s.platform} title=${me(s.platform)}>${R(s.platform)}</span>
        <span>${Oa[s.role]??Fe[s.role]??s.role}${s.hidden?r` <sw-badge kind="neutral" label=${n("מוסתר")}></sw-badge>`:u}</span>
        <span class="muted">${s.primary_for.length?`${n("עונה על:")} ${s.primary_for.join(", ")}`:n("כפילות")} · ${n("שלב {n}",{n:s.rule})}${s.link_source==="manual"?` · ${n("ידני")}`:""}</span>
        <span class="acts">
          ${s.hidden?r`<sw-button size="sm" data-mm-restore=${s.endpoint_id} @click=${()=>void this.link({op:"restore",endpoint_id:s.endpoint_id})}>${n("שחזר")}</sw-button>`:r`<sw-button size="sm" data-mm-ignore=${s.endpoint_id} @click=${()=>void this.link({op:"ignore",endpoint_id:s.endpoint_id})}>${n("התעלם")}</sw-button>
              ${e.endpoints.length>1?r`<sw-button size="sm" data-mm-unlink=${s.endpoint_id} @click=${()=>void this.link({op:"unlink",endpoint_id:s.endpoint_id})}>${n("פצל")}</sw-button>`:u}`}
        </span>
      </div>`)}</div>`}playersCard(){const e=this.devices;if(!e.length)return u;const s=e.filter(l=>l.approved).length,a=e.length-s,t=e.filter(l=>!l.area_name&&!l.area_id).length,i=e.filter(l=>this.live.get(l.key)?.live.power==="unavailable").length,o=[n("{n} מאושרים",{n:s}),a?n("{n} ממתינים",{n:a}):"",t?n("{n} ללא חדר",{n:t}):"",i?n("{n} לא זמינים",{n:i}):""].filter(Boolean).join(" · ");return r`<sw-card heading=${n("נגנים ורמקולים")} data-mm-players>
      <div class="hd"><span class="muted" data-mm-players-count>${o}</span><span class="grow"></span>
        <sw-button size="sm" variant="primary" icon="check" data-mm-approve-players ?disabled=${!a} @click=${()=>void this.approveAll()}>${n("אשר את כל הנגנים שזוהו")}${a?` (${a})`:""}</sw-button></div>
      <div class="muted">${n('רק נגנים מאושרים מופיעים ב"מולטימדיה". תקרת עוצמה וחלון לילה חלים רק כשהוגדרו.')}</div>
      ${this.table(e)}
    </sw-card>`}wizardCard(){const e=this.sugg?.filter(t=>!this.answered.has(t.id)),s=this.nonPhys;if(!e&&!s?.length)return u;const a={session:n("סשן"),virtual_group:n("קבוצה וירטואלית"),service:n("שירות")};return r`<sw-card heading=${n("איחוד כפילויות")} data-mm-wizard>
      ${e?r`<div class="hd"><span class="muted" data-mm-wizard-count>${e.length?n("{n} הצעות",{n:e.length}):n("אין הצעות פתוחות")}</span></div>
        ${le(e,t=>t.id,t=>r`<div class="row" data-mm-wizard-row=${t.id}><span class="lbl"><span><span class="mono">${t.endpoint_label}</span> ${n("←")} ${t.device_name}</span><span class="muted">${cs[t.reason]} · ${n("שלב {n}",{n:t.rule})}</span></span>
          <span class="acts"><sw-button size="sm" variant="primary" icon="link" data-mm-wizard-accept=${t.id} @click=${()=>void this.answer(t,"link")}>${n("אחד")}</sw-button>
            <sw-button size="sm" data-mm-wizard-ignore=${t.id} @click=${()=>void this.answer(t,"ignore")}>${n("התעלם")}</sw-button></span></div>`)}`:u}
      ${s?.length?r`<div class="row" data-mm-nonphysical><span class="lbl">${n("רכיבים לא פיזיים")}<span class="muted">${n("{n} רשומות: סשנים, קבוצות עזר ושירותים · לא מוצגים כנגנים ולא מוצעים לאיחוד",{n:s.length})}</span></span>
          <sw-button size="sm" data-mm-np-toggle aria-expanded=${String(this.npOpen)} @click=${()=>this.npOpen=!this.npOpen}>${this.npOpen?n("הסתר"):n("הצג")}</sw-button></div>
        ${this.npOpen?s.map(t=>r`<div class="row" data-mm-np-row=${t.key}><span class="lbl">${t.name}</span>
          ${t.kind==="virtual_group"?r`<label class="f inline">${n("מוצג בקבוצות")}<sw-toggle label=${`${n("מוצג בקבוצות")}: ${t.name}`} labelHidden .checked=${!!t.approved} data-mm-np-approved=${t.key} @change=${i=>void this.approveHelper(t.key,i.detail.checked)}></sw-toggle></label>`:u}
          <sw-badge kind="neutral" label=${a[t.kind]??t.kind}></sw-badge></div>`):u}`:u}
    </sw-card>`}presetsCard(){const e=this.presets;if(!e)return u;const s=[...this.live.values()];return r`<sw-card heading=${n("קבוצות שמורות")} data-mm-presets>
      <div class="hd"><span class="muted">${n("{n} שמורות",{n:e.length})}</span><span class="grow"></span>
        <sw-button size="sm" icon="plus" data-mm-preset-new @click=${()=>this.editor?.show(ye(null))}>${n("קבוצה חדשה")}</sw-button></div>
      ${e.map(a=>{const t=ws(a,s),i=$s(a,s);return r`<div class="row" data-mm-preset=${a.id}><span class="lbl">${a.name}<span class="muted">${t.map(o=>o.room).join(", ")}${i>1?` · ${n("{n} קומות",{n:i})} · ${n("דורש אישור בהפעלה")}`:""}${a.volumes?` · ${n("עם עוצמות")}`:""}</span></span>
        <span class="acts"><sw-button size="sm" icon="edit" data-mm-preset-edit=${a.id} @click=${()=>this.editor?.show(ye(a))}>${n("ערוך")}</sw-button>
          <sw-button size="sm" variant="danger" data-mm-preset-delete=${a.id} @click=${()=>this.deleting=a}>${n("מחק")}</sw-button></span></div>`})}
      ${e.length?u:r`<div class="muted">${n("אין קבוצות שמורות.")}</div>`}
    </sw-card>`}favCard(){const e=this.fav;if(!e)return u;const s=this.status?.library,a=Y.some(o=>this.favLists[o].length),t=s?.provider==="sonos",i=Y.filter(o=>!(o==="playlists"&&t));return r`<sw-card heading=${n("מועדפים ותחנות")} data-mm-favs>
      <div class="row"><span class="lbl">${n("לשוניות בנגן")}<span class="muted">${n("רשימה אחת לכולם")}</span></span>
        <span class="acts">${i.map(o=>r`<label class="f inline">${ee[o]}<sw-toggle label=${ee[o]} labelHidden .checked=${e.kinds_on.includes(o)} data-mm-fav-kind=${o} @change=${l=>this.toggleKind(o,l.detail.checked)}></sw-toggle></label>`)}</span></div>
      <div class="row"><span class="lbl">${n("מקור")}<span class="muted">${s?.provider==="ma"?n("Music Assistant · המועדפים של ההתקנה"):t?n("Sonos · המועדפים של הרמקולים (source_list) · אין פלייליסטים בלי Music Assistant"):n("אין ספריית מוזיקה")}</span></span></div>
      ${a?i.map(o=>this.favList(o)):u}
    </sw-card>`}favList(e){const s=this.favLists[e];return s.length?r`<div class="fgrp" data-mm-fav-group=${e}><h3>${ee[e]} · ${n("סדר והצגה")}</h3>${s.map((a,t)=>r`<div class=${a.hidden?"frow off":"frow"} data-mm-fav=${a.ref}>
      <sw-toggle label=${`${n("הצג")}: ${a.name}`} labelHidden .checked=${!a.hidden} data-mm-fav-show=${a.ref} @change=${i=>this.setHidden(e,a.ref,!i.detail.checked)}></sw-toggle>
      <span class="nm"><b>${a.name}</b>${a.artist?r`<span class="muted">${a.artist}</span>`:u}</span>
      <button type="button" class="ib" data-mm-fav-up=${a.ref} aria-label=${n("הקדם: {name}",{name:a.name})} ?disabled=${t===0} @click=${()=>this.moveFav(e,a.ref,-1)}><sw-icon name="arrowUp" size="14"></sw-icon></button>
      <button type="button" class="ib" data-mm-fav-down=${a.ref} aria-label=${n("אחר: {name}",{name:a.name})} ?disabled=${t===s.length-1} @click=${()=>this.moveFav(e,a.ref,1)}><sw-icon name="arrowDown" size="14"></sw-icon></button>
    </div>`)}</div>`:u}connectionCard(){const e=this.status;if(!e?.library)return u;const s=e.library,a=[...this.live.values()].filter(o=>o.kind!=="group").length,t=[...this.live.values()].filter(o=>o.kind!=="group"&&o.live.power==="unavailable").length,i=new Map;for(const o of this.devices)o.music_provider&&o.music_provider!=="none"&&i.set(o.music_provider,(i.get(o.music_provider)??0)+1);return r`<sw-card heading=${n("חיבור")} data-mm-connection>
      ${s.provider==="ma"||s.state==="unavailable"?r`<div class="row"><span class="lbl">${n("Music Assistant דרך Home Assistant")}<span class="muted" data-mm-conn-text>${n("{n} נגנים",{n:a})}${t?` · ${n("{n} לא זמינים",{n:t})}`:""} · ${s.state==="ready"?n("ספרייה זמינה"):n("ספרייה לא זמינה")}</span></span>
            <sw-badge kind=${s.state==="ready"?"ok":"stale"} label=${s.state==="ready"?n("מחובר"):n("ספרייה לא זמינה")}></sw-badge></div>`:r`<div class="row"><span class="lbl">Music Assistant<span class="muted" data-mm-conn-text>${n("לא מותקן במערכת זו")}${s.provider!=="none"?` · ${n("ספקי מוזיקה:")} ${oe[s.provider]}`:""}</span></span><sw-badge kind="neutral" label=${n("לא מותקן")}></sw-badge></div>`}
      ${i.size?r`<div class="row"><span class="lbl">${n("שכבת המוזיקה לפי התקן")}<span class="muted">${[...i].map(([o,l])=>n("{provider} על {n}",{provider:oe[o],n:l})).join(" · ")}</span></span></div>`:u}
      <div class="row"><span class="lbl">${n("רכיב החיבור (גשר Arx)")}<span class="muted">${e.bridge.players_ready?`${n("גרסה {n}",{n:e.bridge.version??"?"})} · ${n("מוכן לנגנים")}`:`${n("גרסה {n}",{n:e.bridge.version??"?"})} · ${n("נדרש עדכון (0.5.0 ומעלה) לנגנים")}`}</span></span></div>
      ${s.provider==="ma"?r`<media-ma-connection data-mm-ma-direct></media-ma-connection>`:u}
    </sw-card>`}permissionsCard(){return r`<sw-card heading=${n("הרשאות")} data-mm-permissions>
      <div class="row"><span class="lbl">${n("קיבוץ רמקולים וקבוצות שמורות")}<span class="muted"><span class="mono">media.group</span> · ${n("מפעיל, מנהל אתר, מנהל מערכת · קבוצה של 4 חדרים ומעלה או יותר מקומה אחת מבקשת אישור; כל הבניין רק למנהל")}</span></span>
        <a class="link" href="#/system/access">${n("תפקידים והרשאות ‹")}</a></div>
      <div class="row"><span class="lbl">${n("שליטה בניגון ובעוצמה")}<span class="muted"><span class="mono">media.control</span> · ${n("כולל דילוג, ערבוב, חזרה, מועדפים והעברת מוזיקה")}</span></span></div>
      <div class="row"><span class="lbl">${n("עיון וחיפוש בספריית המוזיקה")}<span class="muted"><span class="mono">media.browse</span> · ${n("מפעיל, מנהל אתר, מנהל מערכת · הפעלת פריט דורשת גם שליטה בניגון")}</span></span></div>
      <div class="row"><span class="lbl">${n("עריכת תור הניגון")}<span class="muted"><span class="mono">media.queue</span> · ${n("מנהל מערכת בלבד כברירת מחדל · גרירה, מחיקה, נגן הבא, ניקוי התור")}</span></span></div>
    </sw-card>`}deleteDialog(){const e=this.deleting;return e?r`<sw-dialog open ?locked=${this.busy} heading=${n('למחוק את "{name}"?',{name:e.name})} data-mm-preset-delete-dialog="open" @close=${()=>this.deleting=null}>
      <div class="dlg-acts">
        <sw-button data-mm-pd-no autofocus ?disabled=${this.busy} @click=${()=>this.deleting=null}>${n("ביטול")}</sw-button>
        <sw-button variant="danger" data-mm-pd-yes ?disabled=${this.busy} @click=${()=>void this.deletePreset()}>${n("מחק")}</sw-button>
      </div></sw-dialog>`:r`<sw-dialog data-mm-preset-delete-dialog="closed"></sw-dialog>`}render(){return this.phase!=="ready"?u:r`${this.error?r`<div class="err" role="alert" data-mm-players-error>${this.error}</div>`:u}
      ${this.playersCard()}${this.wizardCard()}${this.presetsCard()}${this.favCard()}${this.connectionCard()}${this.permissionsCard()}
      ${this.note?r`<div class="ok" role="status" data-mm-players-note>${this.note}</div>`:u}
      <media-preset-editor .devices=${[...this.live.values()]} @preset-saved=${()=>{this.say(n("נשמר")),this.loadGroups()}} @preset-stale=${()=>void this.loadGroups()}></media-preset-editor>
      ${this.deleteDialog()}`}};b.styles=[es,rs,He,N`
    :host {
      display: contents;
    }
    code,
    .mono {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      direction: ltr;
      unicode-bidi: isolate;
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
    input[type='text'] {
      min-inline-size: 200px;
    }
    .night {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
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
  `,he];w([m()],b.prototype,"phase",2);w([m()],b.prototype,"devices",2);w([m()],b.prototype,"live",2);w([m()],b.prototype,"status",2);w([m()],b.prototype,"sugg",2);w([m()],b.prototype,"answered",2);w([m()],b.prototype,"nonPhys",2);w([m()],b.prototype,"presets",2);w([m()],b.prototype,"fav",2);w([m()],b.prototype,"favLists",2);w([m()],b.prototype,"areas",2);w([m()],b.prototype,"open",2);w([m()],b.prototype,"editing",2);w([m()],b.prototype,"view",2);w([m()],b.prototype,"npOpen",2);w([m()],b.prototype,"saved",2);w([m()],b.prototype,"error",2);w([m()],b.prototype,"note",2);w([m()],b.prototype,"deleting",2);w([m()],b.prototype,"busy",2);w([ls("media-preset-editor")],b.prototype,"editor",2);b=w([q("system-multimedia-players")],b);var Da=Object.defineProperty,Ta=Object.getOwnPropertyDescriptor,F=(e,s,a,t)=>{for(var i=t>1?void 0:t?Ta(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&Da(s,a,i),i};let T=class extends H{constructor(){super(...arguments),this.templates=[],this.draft=[],this.dirty=!1,this.err="",this.busy=!1}willUpdate(e){e.has("templates")&&!this.dirty&&(this.draft=this.templates.map(s=>({...s,name:{...s.name},text:{...s.text}})))}edit(e){this.draft=e,this.dirty=!0,this.err=""}async save(){const e=O(),s=Ss(this.draft);if(s){this.err=e.tplProblem[s];return}this.busy=!0;try{const a=await ys(As(this.draft));this.dirty=!1,this.draft=a.templates,this.dispatchEvent(new CustomEvent("saved",{detail:{templates:a.templates},bubbles:!0,composed:!0}))}catch(a){this.err=$(a)}finally{this.busy=!1}}render(){const e=O(),s=ce();return r`<sw-card heading=${e.templates} subheading=${e.templatesHint} data-announce-templates>
      ${this.draft.map(a=>r`<details data-announce-template=${a.id}>
        <summary>${Cs(a,s)||a.id} <span class="muted">${a.kind==="emergency"?e.kindEmergency:e.kindRoutine}</span></summary>
        <div class="grid">
          <span>${e.kind}</span>
          <select data-announce-template-kind aria-label=${e.kind} @change=${t=>this.edit(Es(this.draft,a.id,t.target.value))}>
            <option value="routine" ?selected=${a.kind==="routine"}>${e.kindRoutine}</option>
            <option value="emergency" ?selected=${a.kind==="emergency"}>${e.kindEmergency}</option></select>
          ${de.map(t=>r`
            <span>${e.tplName} · ${e.langName[t]}</span>
            <input type="text" maxlength=${Os} data-announce-template-name=${t} dir=${t==="he"?"rtl":"ltr"} aria-label=${`${e.tplName} ${e.langName[t]}`} .value=${a.name[t]??""}
              @input=${i=>this.edit(Ae(this.draft,a.id,"name",t,i.target.value))} />
            <span>${e.tplText} · ${e.langName[t]}</span>
            <textarea maxlength=${Ls} data-announce-template-text=${t} dir=${t==="he"?"rtl":"ltr"} aria-label=${`${e.tplText} ${e.langName[t]}`} .value=${a.text[t]??""}
              @input=${i=>this.edit(Ae(this.draft,a.id,"text",t,i.target.value))}></textarea>`)}
        </div>
        <sw-button size="sm" variant="ghost" data-announce-template-remove @click=${()=>this.edit(Ds(this.draft,a.id))}>${e.removeTemplate}</sw-button>
      </details>`)}
      <div class="bar">
        <sw-button size="sm" data-announce-template-add ?disabled=${this.draft.length>=Ts} @click=${()=>this.edit([...this.draft,Ns(this.draft)])}>${e.addTemplate}</sw-button>
        <sw-button size="sm" variant="primary" data-announce-template-save ?disabled=${!this.dirty||this.busy} @click=${()=>void this.save()}>${e.saveTemplates}</sw-button>
        ${this.err?r`<span class="err" role="alert" data-announce-template-error>${this.err}</span>`:u}
      </div>
    </sw-card>`}};T.styles=N`
    :host { display: block; }
    details { border-block-end: 1px solid var(--sw-border); padding-block: 8px; }
    details:last-of-type { border-block-end: 0; }
    summary { cursor: pointer; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-medium); display: flex; gap: 10px; align-items: center; min-block-size: 44px; border-radius: var(--sw-r-sm); }
    summary:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .muted { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-regular); }
    .grid { display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px 10px; align-items: center; padding-block: 10px 4px; }
    input, textarea, select { box-sizing: border-box; min-block-size: 36px; padding-inline: 10px; border: 1px solid var(--sw-border-strong); border-radius: var(--sw-r-sm); background: var(--sw-surface); color: var(--sw-text); font: inherit; font-size: var(--sw-fs-sm); inline-size: 100%; }
    textarea { padding: 8px 10px; resize: vertical; min-block-size: 56px; }
    .bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding-block-start: 10px; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (pointer: coarse) {
      input, select { min-block-size: 44px; }
    }
    /* POLISH4-WP8 (D17): on a phone a template's labels sit above their fields (the 90 px label column squeezed "שם · English"), and the
       add / save row of the list stays in view while the open templates scroll under it (owner Q7, the settings kit's .foot.sticky look) */
    @media (max-width: 767px) {
      .grid { grid-template-columns: minmax(0, 1fr); gap: 4px; }
      .grid > span { margin-block-start: 6px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
      .bar { position: sticky; inset-block-end: var(--sw-s-2); z-index: 3; padding: 10px var(--sw-s-2); border: 1px solid var(--sw-border-strong);
        border-radius: var(--sw-r-lg); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3); }
    }
  `;F([B({attribute:!1})],T.prototype,"templates",2);F([m()],T.prototype,"draft",2);F([m()],T.prototype,"dirty",2);F([m()],T.prototype,"err",2);F([m()],T.prototype,"busy",2);T=F([q("system-announce-templates")],T);var Na=Object.defineProperty,Pa=Object.getOwnPropertyDescriptor,A=(e,s,a,t)=>{for(var i=t>1?void 0:t?Pa(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&Na(s,a,i),i};const Ia=(e=3e3)=>new Promise(s=>setTimeout(s,e)),Re={he:"לא הצלחנו לקרוא את הגדרות ההכרזות",en:"The announcement settings could not be read",ru:"Не удалось загрузить настройки объявлений",ar:"تعذّر تحميل إعدادات الإعلانات"},Me={he:"נסו שוב",en:"Try again",ru:"Повторить",ar:"حاول مرة أخرى"};let _=class extends H{constructor(){super(...arguments),this.bubbleSkin=new ve(this),this.phase="loading",this.err="",this.data=null,this.areas=[],this.saved="",this.busy="",this.room="",this.text="",this.vol=""}connectedCallback(){super.connectedCallback(),this.load()}async load(){if(!L()){this.phase="ready";return}if(re()){this.phase="local";return}if(!G("system.configure")){this.phase="forbidden";return}this.phase="loading",this.err="";try{this.data=await _e(),this.areas=G("media.announce")?(await xe()).areas:[],this.areas.some(e=>e.area_id===this.room)||(this.room=this.areas[0]?.area_id??""),this.phase="ready"}catch(e){this.err=$(e),this.phase="error"}}note(e){this.saved=e,Ia().then(()=>{this.saved===e&&(this.saved="")})}async save(e){this.err="";try{this.data=await ks(e),ps(this.data.config.enabled),G("media.announce")&&(this.areas=(await xe()).areas),this.areas.some(s=>s.area_id===this.room)||(this.room=this.areas[0]?.area_id??""),this.note(O().saved)}catch(s){const a=$(s);await this.load(),this.err=a}}async toggleSpeaker(e,s){const a=new Set(this.data?.config.devices??[]);s?a.add(e.key):a.delete(e.key),await this.save({devices:[...a]})}pct(e){const s=e.target.value.trim();return s===""?null:Number(s)}emergencyLangs(e,s){const a=this.data?.config.emergency_languages??[],t=de.filter(i=>i===e?s:a.includes(i));return t.length?t:[...a]}routeAreas(){const e=new Map;for(const s of this.data?.speakers??[])s.allowed&&s.area_id&&e.set(s.area_id,[s.floor_name,s.area_name].filter(Boolean).join(" · ")||s.area_id);return[...e].map(([s,a])=>({id:s,name:a}))}extraCards(e,s){const a=s.quiet,t=s.notify,i=this.routeAreas();return r`
      <sw-card heading=${e.quiet} data-announce-quiet>
        <div class="row"><span class="lbl">${e.quietEnabled}<span class="muted">${e.quietHint}</span></span>
          <sw-toggle label=${e.quietEnabled} labelHidden .checked=${a.enabled} data-announce-quiet-enabled @change=${o=>void this.save({quiet:{enabled:o.detail.checked}})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.from}</span>
          <input type="time" lang=${J()} data-announce-quiet-from .value=${a.from} @change=${o=>void this.save({quiet:{from:o.target.value}})} /></div>
        <div class="row"><span class="lbl">${e.to}</span>
          <input type="time" lang=${J()} data-announce-quiet-to .value=${a.to} @change=${o=>void this.save({quiet:{to:o.target.value}})} /></div>
        <div class="row"><span class="lbl">${e.mode}</span>
          <select data-announce-quiet-mode aria-label=${e.mode} @change=${o=>void this.save({quiet:{mode:o.target.value}})}>
            ${_s.map(o=>r`<option value=${o} ?selected=${a.mode===o}>${{suppress:e.modeSuppress,lower:e.modeLower,queue:e.modeQueue,allow:e.modeAllow}[o]}</option>`)}</select></div>
        ${a.mode==="lower"?r`<div class="row"><span class="lbl">${e.nightVolume}</span>
          <input type="number" min="0" max="100" data-announce-night-volume .value=${a.night_volume===null?"":String(a.night_volume)} @change=${o=>void this.save({quiet:{night_volume:this.pct(o)}})} /></div>`:u}
      </sw-card>
      <sw-card heading=${e.routing} data-announce-routing>
        <div class="row"><span class="lbl">${e.routingEnabled}<span class="muted">${e.routingHint}</span></span>
          <sw-toggle label=${e.routingEnabled} labelHidden .checked=${t.enabled} data-announce-routing-enabled @change=${o=>void this.save({notify:{enabled:o.detail.checked}})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.routingRoom}</span>
          <select data-announce-routing-room aria-label=${e.routingRoom} @change=${o=>void this.save({notify:{scope:"area",ref:o.target.value}})}>
            <option value="" ?selected=${!i.some(o=>o.id===t.ref)}>${e.routingNone}</option>
            ${i.map(o=>r`<option value=${o.id} ?selected=${t.scope==="area"&&o.id===t.ref}>${o.name}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.minSeverity}</span>
          <select data-announce-routing-severity aria-label=${e.minSeverity} @change=${o=>void this.save({notify:{min_severity:o.target.value}})}>
            ${["info","alert","critical"].map(o=>r`<option value=${o} ?selected=${t.min_severity===o}>${e.severity[o]}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.categories}</span>
          <span class="inl">${ze.map(o=>r`<label class="pick"><input type="checkbox" data-announce-routing-category=${o} .checked=${t.categories.includes(o)}
            @change=${l=>void this.save({notify:{categories:ze.filter(c=>c===o?l.target.checked:t.categories.includes(c))}})} />${e.category[o]}</label>`)}</span></div>
      </sw-card>`}screenAreas(){const e=new Map;for(const s of this.data?.speakers??[])s.area_id&&e.set(s.area_id,[s.floor_name,s.area_name].filter(Boolean).join(" · ")||s.area_id);for(const s of this.data?.screen_options?.screens??[])s.area_id&&!e.has(s.area_id)&&e.set(s.area_id,s.area_id);return[...e].map(([s,a])=>({id:s,name:a}))}screenNumber(e,s){const a=Ps(e,s.target.value);a!==null&&this.save({screens:{[e]:a}})}screensCard(e,s){const a=s.config.screens??{enabled:!1,default_on:!0,seconds:30,critical_seconds:180,poll_s:5},t=s.screen_options?.screens??[],i=s.screen_options?.devices??[],o=this.screenAreas(),l=(c,p)=>void this.save({screens:{targets:Is(Rs(t,c,p))}});return r`<sw-card heading=${e.screens} subheading=${e.screensHint} data-announce-screens>
      <div class="row"><span class="lbl">${e.screensEnabled}<span class="muted">${e.screensEnabledHint}</span></span>
        <sw-toggle label=${e.screensEnabled} labelHidden .checked=${a.enabled} data-announce-screens-enabled @change=${c=>void this.save({screens:{enabled:c.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.screensDefault}</span>
        <sw-toggle label=${e.screensDefault} labelHidden .checked=${a.default_on} data-announce-screens-default @change=${c=>void this.save({screens:{default_on:c.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.screensSeconds}</span>
        <input type="number" min=${E.seconds[0]} max=${E.seconds[1]} data-announce-screens-seconds aria-label=${e.screensSeconds} .value=${String(a.seconds)} @change=${c=>this.screenNumber("seconds",c)} /></div>
      <div class="row"><span class="lbl">${e.screensCriticalSeconds}</span>
        <input type="number" min=${E.critical_seconds[0]} max=${E.critical_seconds[1]} data-announce-screens-critical aria-label=${e.screensCriticalSeconds} .value=${String(a.critical_seconds)} @change=${c=>this.screenNumber("critical_seconds",c)} /></div>
      <div class="row"><span class="lbl">${e.screensPoll}</span>
        <input type="number" min=${E.poll_s[0]} max=${E.poll_s[1]} data-announce-screens-poll aria-label=${e.screensPoll} .value=${String(a.poll_s)} @change=${c=>this.screenNumber("poll_s",c)} /></div>
      ${a.critical_close_s!==void 0?r`<div class="row"><span class="lbl">${e.screensCriticalClose}</span>
        <input type="number" step="1" inputmode="numeric" min=${E.critical_close_s[0]} max=${E.critical_close_s[1]} data-announce-screens-critical-close aria-label=${e.screensCriticalClose} .value=${String(a.critical_close_s)} @change=${c=>this.screenNumber("critical_close_s",c)} /></div>`:u}
      <div class="area">${e.screensList}</div>
      ${t.length?t.map(c=>r`<div class="row" data-announce-screen=${c.key}>
        <label class="pick"><input type="checkbox" .checked=${c.allowed} data-announce-screen-allow @change=${p=>l(c.key,{allowed:p.target.checked})} />${c.name}
          <span class="muted">${c.kind==="board"?e.screensKindBoard:e.screensKindWall}</span></label>
        <span class="inl">
          <select data-announce-screen-area aria-label=${e.screensArea} ?disabled=${!c.allowed} @change=${p=>l(c.key,{area_id:p.target.value||null})}>
            <option value="" ?selected=${!c.area_id}>${e.screensNoArea}</option>
            ${o.map(p=>r`<option value=${p.id} ?selected=${p.id===c.area_id}>${p.name}</option>`)}</select>
          <select data-announce-screen-device aria-label=${e.screensDevice} ?disabled=${!c.allowed} @change=${p=>l(c.key,{device_key:p.target.value||null})}>
            <option value="" ?selected=${!c.device_key}>${e.screensNoDevice}</option>
            ${i.map(p=>r`<option value=${p.key} ?selected=${p.key===c.device_key}>${p.name}</option>`)}</select>
        </span></div>`):r`<div class="muted" data-announce-screens-none>${e.screensNone}</div>`}
    </sw-card>`}translateCard(e,s){const a=s.config.translate;if(!a)return u;const t=!!a.approval&&a.approval.provider===a.provider,i=a.approval?new Intl.DateTimeFormat(fe(ae()),{dateStyle:"short",timeStyle:"short"}).format(new Date(a.approval.at)):"";return r`<sw-card heading=${e.translateCard} subheading=${e.translateHint} data-announce-translate-card>
      <div class="row"><span class="lbl">${e.translateProvider}</span>
        <select data-announce-translate-provider aria-label=${e.translateProvider} @change=${o=>void this.save({translate:{provider:o.target.value,...a.enabled?{enabled:!1}:{}}})}>
          <option value="off" ?selected=${a.provider==="off"}>${e.translateProviderOff}</option>
          <option value="google" ?selected=${a.provider==="google"}>${e.translateProviderGoogle}</option>
          <option value="cloud" ?selected=${a.provider==="cloud"}>${e.translateProviderCloud}</option></select></div>
      <div class="row"><span class="lbl">${e.translateApprove}${t?r`<span class="muted" data-announce-translate-approved>${e.translateApprovedBy} ${a.approval?.by??"—"} · ${i}</span>`:r`<span class="muted">${e.translateNotApproved}</span>`}</span>
        <sw-button size="sm" data-announce-translate-approve ?disabled=${a.provider==="off"||t} @click=${()=>void this.save({translate:{approve:!0}})}>${e.translateApproveAction}</sw-button></div>
      <div class="row"><span class="lbl">${e.translateEnabled}${a.provider==="cloud"?r`<span class="muted" data-announce-translate-key>${a.key_set?e.cloudKeySet:e.cloudKeyMissing}</span>`:u}</span>
        <sw-toggle label=${e.translateEnabled} labelHidden .checked=${a.enabled} ?disabled=${!t&&!a.enabled} data-announce-translate-enabled @change=${o=>void this.save({translate:{enabled:o.detail.checked}})}></sw-toggle></div>
      <div class="row"><span class="lbl">${e.translateTargets}</span>
        <span class="inl">${Se.map(o=>r`<label class="pick"><input type="checkbox" data-announce-translate-target=${o} .checked=${a.targets.includes(o)}
          @change=${l=>{const c=Se.filter(p=>p===o?l.target.checked:a.targets.includes(p));c.length?this.save({translate:{targets:c}}):l.target.checked=!0}} />${e.langName[o]}</label>`)}</span></div>
    </sw-card>`}async run(e,s){this.busy=e,this.err="";try{await s(),this.note(O().sent)}catch(a){this.err=$(a)}finally{this.busy=""}try{this.data=await _e()}catch{}}speakerRows(e){const s=this.data?.speakers??[];if(!s.length)return r`<div class="muted" data-announce-none>${e.none}</div>`;const a=new Map;for(const i of s){const o=[i.floor_name,i.area_name].filter(Boolean).join(" · ")||e.noRoom;a.set(o,[...a.get(o)??[],i])}const t=!!this.data?.config.enabled&&!!this.data?.config.engine;return r`${[...a].map(([i,o])=>r`<div class="area">${i}</div>${o.map(l=>r`
      <div class="row" data-announce-speaker=${l.key}>
        <label class="pick"><input type="checkbox" .checked=${l.allowed} data-announce-allow @change=${c=>void this.toggleSpeaker(l,c.target.checked)} />${l.name}</label>
        <sw-button size="sm" data-announce-test ?disabled=${!l.allowed||!t||this.busy!==""} @click=${()=>void this.run(`t:${l.key}`,()=>xs({scope:"device",ref:l.key,language:ae()}))}>${e.testAction}</sw-button>
      </div>`)}`)}`}render(){const e=O();if(this.phase==="forbidden")return r`<sw-state-panel state="forbidden" heading=${e.forbidden}></sw-state-panel>`;if(this.phase==="local")return r`<sw-state-panel icon="bell" state="empty" heading=${e.local}></sw-state-panel>`;if(this.phase==="loading")return r`<sw-state-panel state="loading"></sw-state-panel>`;if(this.phase==="error")return r`<sw-state-panel state="error" heading=${Re[ce()]??Re.he} hint=${this.err} actionLabel=${Me[ce()]??Me.he} data-announce-load-error @action=${()=>void this.load()}></sw-state-panel>`;const s=this.data;if(!s)return r`<sw-state-panel icon="bell" state="empty" heading=${e.none}></sw-state-panel>`;const a=s.config;return r`<div class="stack" data-announce>
      ${this.err?r`<div class="err" role="alert">${this.err}</div>`:u}
      <sw-card heading=${e.general}>
        <div class="row"><span class="lbl">${e.enabled}<span class="muted">${e.enabledHint}</span></span>
          <sw-toggle label=${e.enabled} labelHidden .checked=${a.enabled} data-announce-enabled @change=${t=>void this.save({enabled:t.detail.checked})}></sw-toggle></div>
        <div class="row"><span class="lbl">${e.engine}<span class="muted">${e.engineHint}</span>${(s.engine_info??[]).some(t=>t.entity_id===a.engine&&t.cloud)?r`<span class="muted" data-announce-cloud-warn>${e.engineCloudWarn}</span>`:u}</span>
          <select data-ltr data-announce-engine aria-label=${e.engine} @change=${t=>void this.save({engine:t.target.value})}>
            <option value="" ?selected=${a.engine===""}>—</option>
            ${[...new Set([...s.engines,...a.engine?[a.engine]:[]])].map(t=>r`<option value=${t} ?selected=${t===a.engine}>${(s.engine_info??[]).find(i=>i.entity_id===t)?.name??t}</option>`)}</select></div>
        <div class="row"><span class="lbl">${e.emergencyLangs}</span>
          <span class="inl">${de.map(t=>r`<label class="pick"><input type="checkbox" data-announce-emergency-lang=${t} .checked=${(a.emergency_languages??[]).includes(t)}
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
      <system-announce-templates .templates=${s.templates??[]} @saved=${t=>{this.data&&(this.data={...this.data,templates:t.detail.templates}),this.note(O().saved)}}></system-announce-templates>
      <sw-card heading=${e.speakers} subheading=${e.speakersHint}>${this.speakerRows(e)}</sw-card>
      ${this.areas.length?r`<sw-card heading=${e.say} data-announce-now>
        <div class="row">
          <span class="inl"><select data-announce-room @change=${t=>this.room=t.target.value} aria-label=${e.room}>${this.areas.map(t=>r`<option value=${t.area_id} ?selected=${t.area_id===this.room}>${[t.floor_name,t.name].filter(Boolean).join(" · ")}</option>`)}</select>
          <input type="text" class="grow" maxlength=${a.max_text} data-announce-text aria-label=${e.text} .value=${this.text} @input=${t=>this.text=t.target.value} />
          <input type="number" min="0" max="100" data-announce-send-volume aria-label=${e.volume} placeholder="%" .value=${this.vol} @input=${t=>this.vol=t.target.value} /></span>
          <sw-button size="sm" variant="primary" icon="check" data-announce-send ?disabled=${!this.text.trim()||!this.room||this.busy!==""}
            @click=${()=>void this.run("send",async()=>{await zs({scope:"area",ref:this.room,text:this.text,...this.vol.trim()===""?{}:{volume:Number(this.vol)}}),this.text=""})}>${e.send}</sw-button>
        </div></sw-card>`:u}
      <sw-card heading=${e.history}>
        ${s.history.length?r`<table data-announce-history><tbody>${s.history.map(t=>r`<tr>
          <td>${new Intl.DateTimeFormat(fe(ae()),{dateStyle:"short",timeStyle:"short"}).format(new Date(t.at))}</td>
          <td>${e.src[t.source]??t.source}</td><td class="msg">${t.message}</td><td>${e.status[t.status]??t.status}</td></tr>`)}</tbody></table>`:r`<div class="muted">${e.empty}</div>`}
      </sw-card>
      ${this.saved?r`<div class="ok" role="status"><sw-icon name="check" size="16"></sw-icon>${this.saved}</div>`:u}
    </div>`}};_.styles=[he,N`
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
    /* POLISH4-WP8 (D17): every change saves at once, so the "saved" line is the only answer - it is a status pill that stays at the bottom
       of the view while the long page scrolls (it used to sit after the last card, out of sight); success and error in their soft fills */
    .ok { position: sticky; inset-block-end: var(--sw-s-2); z-index: 3; align-self: center; display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: var(--sw-r-pill); background: var(--sw-success-soft); color: var(--sw-success-text); font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium); box-shadow: var(--sw-shadow-2); }
    .err { padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-danger-soft); color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    table { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    th, td { text-align: start; padding: 6px 8px; border-block-end: 1px solid var(--sw-border); }
    td.msg { max-inline-size: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    label.pick { cursor: pointer; }
    label.pick input { inline-size: 18px; block-size: 18px; margin: 0; accent-color: var(--sw-accent); }
    input:focus-visible, select:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    @media (pointer: coarse) {
      input[type='text'], input[type='number'], input[type='time'], select, label.pick { min-block-size: 44px; }
    }
    @media (max-width: 600px) { input[type='text'] { inline-size: 100%; } }
    /* the phone: a history entry is two lines (when, source and status, then the message in full) instead of a four-column row that ran
       off the card; a row's controls take the full width under their label */
    @media (max-width: 767px) {
      .row > .inl { inline-size: 100%; }
      .row > .inl > select { flex: 1 1 140px; min-inline-size: 0; }
      table[data-announce-history] tr { display: grid; grid-template-columns: auto auto minmax(0, 1fr); gap: 2px 10px; padding-block: 8px; border-block-end: 1px solid var(--sw-border); }
      table[data-announce-history] td { padding: 0; border: 0; }
      table[data-announce-history] td.msg { grid-column: 1 / -1; grid-row: 2; max-inline-size: none; white-space: normal; overflow-wrap: anywhere; color: var(--sw-text-2); }
      table[data-announce-history] td:last-child { justify-self: end; }
    }
  `];A([m()],_.prototype,"phase",2);A([m()],_.prototype,"err",2);A([m()],_.prototype,"data",2);A([m()],_.prototype,"areas",2);A([m()],_.prototype,"saved",2);A([m()],_.prototype,"busy",2);A([m()],_.prototype,"room",2);A([m()],_.prototype,"text",2);A([m()],_.prototype,"vol",2);_=A([q("system-announcements")],_);var Ra=Object.defineProperty,Ma=Object.getOwnPropertyDescriptor,k=(e,s,a,t)=>{for(var i=t>1?void 0:t?Ma(s,a):s,o=e.length-1,l;o>=0;o--)(l=e[o])&&(i=(t?l(s,a,i):l(i))||i);return t&&i&&Ra(s,a,i),i};const ja=Object.keys(ue),Ha=(e=3e3)=>new Promise(s=>setTimeout(s,e)),je=[{id:"blue",label:n("כחול")},{id:"rew",label:n("אחורה מהירה")},{id:"ff",label:n("קדימה מהירה")},{id:"stop",label:n("עצור")},{id:"exit",label:n("יציאה")},{id:"info",label:n("מידע")},{id:"guide",label:n("מדריך")},{id:"source",label:n("מקור")},{id:"tools",label:n("כלים")},{id:"settings",label:n("הגדרות")},{id:"chlist",label:n("רשימת ערוצים")},{id:"prech",label:n("ערוץ קודם")}];let f=class extends H{constructor(){super(...arguments),this.bubbleSkin=new ve(this),this.phase="loading",this.list={devices:[],suggestions:[]},this.status=null,this.enabled=!0,this.remote=null,this.remoteDirty=!1,this.error="",this.note="",this.saved="",this.open=new Set,this.editing=new Set,this.view={...U},this.tab="main",this.noteTimer=0,this.onHash=()=>{window.location.hash.startsWith("#/system/multimedia")&&this.readTab()},this.setView=e=>{this.view=e,Xe("screens",X.me?.user.id??"",e)}}connectedCallback(){super.connectedCallback(),this.view=Qe("screens",X.me?.user.id??""),this.readTab(),window.addEventListener("hashchange",this.onHash),this.load()}disconnectedCallback(){super.disconnectedCallback(),window.removeEventListener("hashchange",this.onHash),window.clearTimeout(this.noteTimer)}async load(){if(this.error="",L()&&!G("system.configure")){this.phase="forbidden";return}try{const[e,s,a]=await Promise.all([C().list(),se().status(),se().remoteDefault()]);this.list=e,this.status=s,this.remote=a,this.remoteDirty=!1,this.enabled=L()?String((await us(!0))["multimedia.enabled"]??"true")!=="false":s.enabled,this.phase="ready"}catch(e){e instanceof qe&&e.status===403?this.phase="forbidden":(this.error=$(e),this.phase="error")}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3500)}async setEnabled(e){this.error="";try{L()&&(await ms("settings",{"multimedia.enabled":String(e)}),hs()),this.enabled=e,vs({"multimedia.enabled":String(e)}),this.say(n("נשמר"))}catch(s){this.error=$(s)}}async updateDevice(e,s){this.error="";try{const a=await C().update(e.key,s);this.list={...this.list,devices:this.list.devices.map(t=>t.key===e.key?a:t)},this.saved=e.key,Ha().then(()=>this.saved=this.saved===e.key?"":this.saved)}catch(a){this.error=$(a),await this.load()}}async approveAll(){const e=this.list.devices.filter(s=>s.kind==="screen"&&!s.approved).map(s=>s.key);if(e.length)try{await C().approve(e,!0),this.list={...this.list,devices:this.list.devices.map(s=>e.includes(s.key)?{...s,approved:!0}:s)},this.say(n("אושרו {n} מסכים",{n:e.length}))}catch(s){this.error=$(s)}}async link(e){try{this.list=await C().link(e),this.say(n("נשמר"))}catch(s){this.error=$(s)}}setSection(e,s){const a=this.remote;if(!a)return;const t=a.sections.map(o=>o.id===e&&s.on!==void 0?{...o,on:s.on}:o),i=s.more===void 0?a.more:s.more?[...new Set([...a.more,e])]:a.more.filter(o=>o!==e);this.remote={...a,sections:t,more:i},this.remoteDirty=!0}moveSection(e,s){const a=this.remote;if(!a)return;const t=a.sections.findIndex(l=>l.id===e),i=t+s;if(t<0||i<0||i>=a.sections.length)return;const o=[...a.sections];[o[t],o[i]]=[o[i],o[t]],this.remote={...a,sections:o},this.remoteDirty=!0}async saveRemote(){if(this.remote)try{this.remote=await se().saveRemoteDefault(this.remote),this.remoteDirty=!1,this.say(n("נשמר"))}catch(e){this.error=$(e)}}toggle(e,s){const a=new Set(this[e]);a.delete(s)||a.add(s),this[e]=a}async copy(e){try{await navigator.clipboard.writeText(e),this.say(n("הועתק"))}catch{this.say(n("ההעתקה נחסמה בדפדפן"))}}table(e){return Ze({scope:"screens",devices:e,view:this.view,editing:this.editing,endpoints:this.open,saved:this.saved,form:s=>this.form(s),connections:s=>this.connections(s),typeLabel:s=>ie[s.kind]??s.kind,onView:this.setView,onEdit:s=>this.toggle("editing",s),onEndpoints:s=>this.toggle("open",s),onApprove:(s,a)=>void this.updateDevice(s,{approved:a}),onCopy:s=>void this.copy(s),none:n("לא זוהו מסכים.")})}form(e){const s=this.list.devices.filter(t=>t.key!==e.key&&(t.kind==="receiver"||t.kind==="speaker")),a=e.model_key_options?je.filter(t=>e.model_key_options.includes(t.id)):je;return r`<div class="dev" data-mm-form=${e.key}>
      <div class="line">
        <label class="f">${n("שם")}
          <input type="text" .value=${e.name} maxlength="60" data-mm-name=${e.key} @change=${t=>void this.updateDevice(e,{display_name:t.target.value})} />
        </label>
        <label class="f">${n("סוג")}
          <select data-mm-kind=${e.key} @change=${t=>void this.updateDevice(e,{kind:t.target.value})}>
            ${Object.keys(ie).map(t=>r`<option value=${t} ?selected=${e.kind===t}>${ie[t]}</option>`)}
          </select>
        </label>
        <span class="f">${n("זיהוי")}<sw-badge kind=${e.confidence==="weak"?"stale":"neutral"} label=${Ke[e.confidence]}></sw-badge></span>
        <span class="f">${n("מיקום")}<span>${[e.floor_name,e.area_name].filter(Boolean).join(" ‹ ")||"—"}</span></span>
        <span class="grow"></span>
      </div>
      <div class="line">
        <label class="f inline">${n("מסך ציבורי")}<sw-toggle label=${`${n("מסך ציבורי")}: ${e.name}`} labelHidden .checked=${e.public} ?disabled=${e.kind!=="screen"} data-mm-public=${e.key} @change=${t=>void this.updateDevice(e,{public:t.detail.checked})}></sw-toggle></label>
        <label class="f">${n("פרופיל")}
          <select data-mm-profile=${e.key} ?disabled=${e.kind!=="screen"} @change=${t=>{const i=t.target.value;this.updateDevice(e,{profile:i===""?null:i})}}>
            <option value="" ?selected=${e.profile_source==="auto"}>${n("זיהוי אוטומטי")} · ${ue[e.profile]}</option>
            ${ja.map(t=>r`<option value=${t} ?selected=${e.profile_source==="manual"&&e.profile===t}>${ue[t]}</option>`)}
          </select>
        </label>
        <label class="f">${n("מגבר מקושר")}
          <select data-mm-link=${e.key} ?disabled=${e.kind!=="screen"} @change=${t=>{const i=t.target.value;this.updateDevice(e,{audio_link_key:i||null,...i?{}:{audio_default:"screen"}})}}>
            <option value="" ?selected=${!e.audio_link_key}>${n("ללא")}</option>
            ${s.map(t=>r`<option value=${t.key} ?selected=${e.audio_link_key===t.key}>${t.name}</option>`)}
          </select>
        </label>
        <span class="f">${n("שמע ברירת מחדל")}
          <span class="seg" role="group" aria-label=${n("שמע ברירת מחדל")}>
            <button type="button" aria-pressed=${String(e.audio_default==="screen")} ?disabled=${!e.audio_link_key} @click=${()=>void this.updateDevice(e,{audio_default:"screen"})}>${n("רמקולי המסך")}</button>
            <button type="button" aria-pressed=${String(e.audio_default==="linked")} ?disabled=${!e.audio_link_key} @click=${()=>void this.updateDevice(e,{audio_default:"linked"})}>${n("מגבר")}</button>
          </span>
        </span>
        <label class="f">${n("תקרת עוצמה")}
          <input type="number" min="0" max="100" .value=${e.volume_max===null?"":String(e.volume_max)} placeholder=${n("ללא")} data-mm-volmax=${e.key}
            @change=${t=>{const i=t.target.value.trim(),o=Math.max(0,Math.min(100,Math.round(Number(i))));this.updateDevice(e,{volume_max:i===""||Number.isNaN(o)?null:o})}} />
        </label>
      </div>
      ${e.also_turns_on.length?r`<div class="muted" data-mm-also>${n("גם מדליק:")} ${e.also_turns_on.join(", ")}</div>`:u}
      ${e.cast?r`<div class="muted" data-mm-cast-line=${e.key}>${n("שידור למסך:")} ${Be(e.cast)}</div>`:u}
      ${e.kind==="screen"&&e.profile!=="generic"&&a.length?r`<div class="line" data-mm-extra-keys=${e.key}><span class="f">${n("מקשים נוספים למסך זה")}</span>${a.map(t=>r`<label class="f inline"><input type="checkbox" .checked=${e.model_keys.includes(t.id)} @change=${i=>void this.updateDevice(e,{model_keys:a.filter(o=>o.id===t.id?i.target.checked:e.model_keys.includes(o.id)).map(o=>o.id)})} />${t.label}</label>`)}</div>`:u}
    </div>`}connections(e){return r`<div data-mm-endpoints=${e.key}>${e.endpoints.map(s=>r`<div class="ep" data-mm-endpoint=${s.endpoint_id}>
        <span class="mono" data-mm-ep-platform=${s.platform} title=${me(s.platform)}>${R(s.platform)}</span>
        <span>${Fe[s.role]??s.role}${s.hidden?r` <sw-badge kind="neutral" label=${n("מוסתר")}></sw-badge>`:u}</span>
        <span class="muted">${s.primary_for.length?`${n("עונה על:")} ${s.primary_for.map(a=>Ws[a]).join(", ")}`:n("כפילות")} · ${n("שלב {n}",{n:s.rule})}${s.link_source==="manual"?` · ${n("ידני")}`:""}</span>
        <span style="display:flex;gap:6px">
          ${s.hidden?r`<sw-button size="sm" data-mm-restore=${s.endpoint_id} @click=${()=>void this.link({op:"restore",endpoint_id:s.endpoint_id})}>${n("שחזר")}</sw-button>`:r`<sw-button size="sm" data-mm-ignore=${s.endpoint_id} @click=${()=>void this.link({op:"ignore",endpoint_id:s.endpoint_id})}>${n("התעלם")}</sw-button>
              ${e.endpoints.length>1?r`<sw-button size="sm" data-mm-unlink=${s.endpoint_id} @click=${()=>void this.link({op:"unlink",endpoint_id:s.endpoint_id})}>${n("פצל")}</sw-button>`:u}`}
        </span>
      </div>`)}</div>`}suggestions(){const e=this.list.suggestions??[];if(!e.length)return u;const s=a=>this.list.devices.find(t=>t.key===a)?.name??a;return r`<sw-card heading=${n("הצעות איחוד")} data-mm-suggestions>
      ${e.map(a=>r`<div class="row"><span class="lbl"><span class="mono">${a.endpoint_id.replace(/^ha:/,"")}</span><span class="muted">${a.reason} · ${n("אל {name}",{name:s(a.device_key)})}</span></span>
        <sw-button size="sm" data-mm-merge=${a.endpoint_id} @click=${()=>void this.link({op:"link",endpoint_id:a.endpoint_id,device_key:a.device_key})}>${n("אחד")}</sw-button></div>`)}
    </sw-card>`}remoteCard(){const e=this.remote;return e?r`<sw-card heading=${n("שלט")} data-mm-remote>
      ${e.sections.map((s,a)=>r`<div class="sec" data-mm-section=${s.id}>
        <sw-toggle label=${`${n("הצג")}: ${K[s.id]}`} labelHidden .checked=${s.on} @change=${t=>this.setSection(s.id,{on:t.detail.checked})}></sw-toggle>
        <span class="nm">${K[s.id]}</span>
        <label class="f inline"><input type="checkbox" .checked=${e.more.includes(s.id)} ?disabled=${!s.on} aria-label=${`${n('מאחורי "עוד מקשים"')}: ${K[s.id]}`} @change=${t=>this.setSection(s.id,{more:t.target.checked})} />${n('מאחורי "עוד מקשים"')}</label>
        <button type="button" class="ib" aria-label=${n("הקדם: {name}",{name:K[s.id]})} ?disabled=${a===0} @click=${()=>this.moveSection(s.id,-1)}><sw-icon name="arrowUp" size=${14}></sw-icon></button>
        <button type="button" class="ib" aria-label=${n("אחר: {name}",{name:K[s.id]})} ?disabled=${a===e.sections.length-1} @click=${()=>this.moveSection(s.id,1)}><sw-icon name="arrowDown" size=${14}></sw-icon></button>
      </div>`)}
      <div class="row"><span class="muted">${n('ברירת המחדל של כל המסכים; אפשר לשנות מסך בודד דרך "עריכת השלט" בתפריט המשתמש.')}</span>
        <sw-button variant="primary" size="sm" ?disabled=${!this.remoteDirty} data-mm-save-remote @click=${()=>void this.saveRemote()}>${n("שמור")}</sw-button></div>
    </sw-card>`:u}readTab(){const e=(window.location.hash.split("?")[1]??"").split("&").find(s=>s.startsWith("tab="))?.slice(4);this.tab=e==="cast"||e==="mine"||e==="announce"?e:"main"}setTab(e){const s=e==="cast"||e==="mine"||e==="announce"?e:"main";this.tab=s,gs("/system/multimedia",s==="main"?void 0:new URLSearchParams({tab:s}))}tabsRow(){return r`<sw-tabs variant="underline" data-mm-tabs .items=${[{id:"main",label:n("מסכים ונגנים")},{id:"cast",label:n("שידור למסכים")},{id:"mine",label:n("המסכים שלי לשידור")},{id:"announce",label:O().tab}]} .active=${this.tab} @change=${e=>this.setTab(e.detail.id)}></sw-tabs>`}render(){if(this.phase==="forbidden")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")}><sw-state-panel data-mm-admin-state="forbidden" state="forbidden" heading=${n("אין לך הרשאה להגדרות המדיה")} hint=${n("נדרשת ההרשאה להגדרת המערכת.")}></sw-state-panel></sw-page>`;if(this.tab==="cast")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")} subheading=${n("שידור מצלמות למסכים")}>${this.tabsRow()}<system-cast></system-cast></sw-page>`;if(this.tab==="announce")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")} subheading=${O().sub}>${this.tabsRow()}<system-announcements></system-announcements></sw-page>`;if(this.tab==="mine")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")} subheading=${n("המסכים שאפשר לשדר אליהם")}>${this.tabsRow()}<cast-my-screens embedded></cast-my-screens></sw-page>`;if(this.phase==="loading")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;if(this.phase==="error")return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")}>${this.tabsRow()}<sw-state-panel data-mm-admin-state="error" state="error" heading=${n("לא ניתן לטעון את הגדרות המדיה")} hint=${this.error} actionLabel=${n("נסה שוב")} @action=${()=>void this.load()}></sw-state-panel></sw-page>`;const e=this.status,s=this.list.devices.filter(i=>i.kind==="screen"),a=s.filter(i=>!i.approved).length,t=e?.bridge;return r`<sw-page crumbs=${n("הגדרות")} heading=${n("מולטימדיה")} subheading=${`${n("{n} מסכים מאושרים",{n:s.filter(i=>i.approved).length})}${a?` · ${n("{n} ממתינים לאישור",{n:a})}`:""}`}>
      ${this.tabsRow()}
      <div class="stack">
        ${this.error?r`<div class="err" role="alert">${this.error}</div>`:u}
        <sw-card heading=${n("כללי")} data-mm-general>
          <div class="row"><span class="lbl">${n("מולטימדיה")}<span class="muted">${n('כבוי = הכניסה "מולטימדיה" אינה מוצגת לאף משתמש')}</span></span>
            <sw-toggle label=${n("מולטימדיה")} labelHidden .checked=${this.enabled} data-mm-enabled @change=${i=>void this.setEnabled(i.detail.checked)}></sw-toggle></div>
          <div class="row"><span class="lbl">${n("רכיב החיבור (גשר Arx)")}<span class="muted" data-mm-bridge>${t?t.media_ready?`${n("גרסה {n}",{n:t.version??"?"})} · ${n("מוכן לפקודות מדיה")}`:t.paired?`${n("גרסה {n}",{n:t.version??"?"})} · ${n("נדרש עדכון (0.4.0 ומעלה)")}`:n("לא מצומד"):"—"}</span></span></div>
          <div class="row"><span class="lbl">${n("תצוגה")}<span class="muted" data-mm-display>${n("זכוכית תמיד; בהיר/כהה לפי חשמל והתקנים")}</span></span></div>
        </sw-card>
        <sw-card heading=${n("מסכים")} data-mm-devices>
          <div class="row"><span class="muted">${n('רק מסכים מאושרים מופיעים ב"מולטימדיה".')}</span>
            <sw-button size="sm" variant="primary" icon="check" data-mm-approve-all ?disabled=${!a} @click=${()=>void this.approveAll()}>${n("אשר את כל המסכים שזוהו")}${a?` (${a})`:""}</sw-button></div>
          ${this.table(s)}
        </sw-card>
        ${this.suggestions()}
        ${this.remoteCard()}
        <system-multimedia-players></system-multimedia-players>
        ${this.note?r`<div class="ok" role="status" data-mm-note>${this.note}</div>`:u}
      </div>
    </sw-page>`}};f.styles=[Ms,es,He,N`
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
    input[type='text'] {
      min-inline-size: min(200px, 100%);
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
  `,he];k([m()],f.prototype,"phase",2);k([m()],f.prototype,"list",2);k([m()],f.prototype,"status",2);k([m()],f.prototype,"enabled",2);k([m()],f.prototype,"remote",2);k([m()],f.prototype,"remoteDirty",2);k([m()],f.prototype,"error",2);k([m()],f.prototype,"note",2);k([m()],f.prototype,"saved",2);k([m()],f.prototype,"open",2);k([m()],f.prototype,"editing",2);k([m()],f.prototype,"view",2);k([m()],f.prototype,"tab",2);f=k([q("system-multimedia")],f);export{f as SystemMultimedia};
