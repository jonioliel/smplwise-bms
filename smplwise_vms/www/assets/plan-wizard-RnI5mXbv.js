const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{w as _,A as v,i as Oe,g as Ee,a8 as je,bM as Te,bR as Me,bN as Ce,bS as ie,bc as Fe,bP as qe,bT as ae,bU as Le,j as C,bV as Ne,E as Ve,a as Ge,aZ as Ue,bJ as Ke,Y as z,_ as We,b2 as j,e as l,F as X,G as g,H as Ze}from"./index-Cx0qJkOE.js";import{w as Be,a as Ye,c as He,f as Qe,r as Xe}from"./candidates-rbOww-Gr.js";import{s as Je,w as et,b as Ie,e as re}from"./shared-space-BHX-kR4G.js";import{b as tt}from"./scene-builder-BdQVXlya.js";import{M as st}from"./material-resolve-BNwQPaog.js";import{g as it,d as at,c as rt,b as nt,e as ot,s as lt}from"./geometry-CziiQPlI.js";import{d as ct,a as ne,b as dt,u as pt,l as ht}from"./zones-Dyw6xG09.js";import{l as ut,a as mt,b as ft}from"./plan-catalog-C9oqYOjT.js";import"./sw-logo-art-Va6y_cIM.js";const J=1e3,ee=900,P=.012,gt=e=>[Math.round(e[0]/J*1e5)/1e5,Math.round(e[1]/ee*1e5)/1e5],wt=[["g-out","exterior",.3,[[42,42],[958,42],[958,858],[42,858],[42,42]]],["g-w1","interior",.12,[[292,42],[292,858]]],["g-w2","interior",.12,[[42,292],[292,292]]],["g-w3","railing",.05,[[167,325],[167,625]]],["g-w5","interior",.12,[[292,500],[958,500]]],["g-w6","interior",.12,[[625,500],[625,858]]],["g-w7","interior",.12,[[42,625],[292,625]]],["g-w8","interior",.1,[[167,625],[167,858]]]],Se=[["front","g-out",.95913,"door",1,"right","end"],["win-hall","g-out",.98317,"window",.8,"none","start"],["win-liv-n1","g-out",.12019,"window",1.4,"none","start"],["win-liv-n2","g-out",.16827,"window",1.4,"none","start"],["win-liv-n3","g-out",.21635,"window",1.4,"none","start"],["win-liv-e","g-out",.32933,"window",2.6,"none","start"],["win-kit-e","g-out",.44952,"window",1.2,"none","start"],["win-kit-s","g-out",.54808,"window",1.4,"none","start"],["win-off-s","g-out",.64423,"window",1.6,"none","start"],["win-wc-w","g-out",.79567,"window",.6,"none","start"],["d-hall-liv","g-w1",.15306,"door",1.6,"double","start"],["d-corr-liv","g-w1",.43878,"door",.9,"left","start"],["d-corr-off","g-w1",.65306,"door",.9,"right","end"],["p-hall-corr","g-w2",.73333,"passage",1.4,"none","start"],["d-liv-off","g-w5",.25,"door",.9,"right","start"],["d-liv-kit","g-w5",.75,"passage",1.8,"none","start"],["d-off-kit","g-w6",.51163,"door",.8,"left","end"],["d-wc","g-w7",.25,"door",.8,"right","end"],["d-util","g-w7",.75,"door",.8,"left","start"]],oe={"g-w3":.48,"g-w8":.71,"d-liv-kit":.45,"win-wc-w":.6,"win-hall":.6,"d-off-kit":.62,"p-hall-corr":.45,"win-kit-e":.75};function De(){const e=Pe(),s=wt.map(([i,a,n,r])=>({id:i,level_id:"L0",polyline:r.map(gt),thickness_m:n,height_m:null,base_z_m:0,kind:a,confidence:1,source:"manual",locked:!1,external_ids:{}})),t=Se.map(([i,a,n,r,o,p,d])=>i==="d-liv-kit"?{id:i,wall_id:a,t:n,kind:"door",width_m:o,height_m:2.1,sill_m:0,swing:"sliding",hinge:d,anchor_ref:null,confidence:1,source:"manual",external_ids:{}}:{id:i,wall_id:a,t:n,kind:r,width_m:o,height_m:r==="window"?1.2:2.1,sill_m:r==="window"?.9:0,swing:p,hinge:d,anchor_ref:null,confidence:1,source:"manual",external_ids:{}});return{...e,walls:s,openings:t}}function Pe(){return{schema_version:"2.0",plan_version_id:"demo-wizard",floor_id:"f0",source:{sha256:"",file_name:"תוכנית-קרקע.png",mime:"image/png",page:1},dimensions:{width_px:J,height_px:ee,scale_m_per_px:P,calibration:{status:"estimated",method:"door_width",pairs:[],residual_pct:null,reason:"לפי רוחב 9 דלתות"}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"קרקע",elevation_m:0,ceiling_height_m:2.8,is_default:!0}],walls:[],openings:[],rooms:[],objects:[],circuits:[],connectors:[],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"demo",tokens_version:"map-1",detector_version:null}}}function vt(){const s=De().walls.map(a=>({...a,id:`auto-${a.id}`,source:"auto",confidence:oe[a.id]??.96,hollow:!1})),t=Se.map(([a,n,r,o,p,d,h])=>({id:`auto-${a}`,wall_id:`auto-${n}`,t:r,kind:o,width_m:p,height_m:o==="window"?1.2:2.1,sill_m:o==="window"?.9:0,swing:d,hinge:h,anchor_ref:null,confidence:oe[a]??(o==="window"?.9:.92),source:"auto",external_ids:{}})),i={};for(const a of s)i[a.id]={thickness_px:a.thickness_m/P};for(const a of t)i[a.id]={width_px:a.width_m/P};return{walls:s,openings:t,objects:[],detector:{name:"plan_detect",version:"demo",params:{}},calibration_hint:{scale_m_per_px:P,status:"estimated",method:"door_width",reason:"לפי רוחב 9 דלתות",doors:9},pixels:i,scale:{m_per_px:P,status:"estimated_walls"},stats:{},version_id:"demo-wizard",level_id:"L0",existing_auto:{walls:0,openings:0}}}const bt=[["כניסה",[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]]],["חדר מדרגות",[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]]],["מסדרון",[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]]],["סלון",[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]]],["מטבח",[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]]],["חדר עבודה",[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]]],["",[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]]],["",[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]]]];function yt(){return bt.map(([e,s])=>({name:e,polygon:s.map(([t,i])=>({x:Math.round(t/P/J*1e5)/1e5,y:Math.round(i/P/ee*1e5)/1e5}))}))}const xt=[{area_id:"hall",name:"כניסה"},{area_id:"living",name:"סלון"},{area_id:"kitchen",name:"מטבח"},{area_id:"office",name:"חדר עבודה"},{area_id:"corridor",name:"מסדרון"},{area_id:"wc",name:"שירותים"},{area_id:"terrace",name:"מרפסת"}],kt=[{entity_id:"lock.front",name:"דלת כניסה",domain:"lock",device_class:null,area_id:"hall"},{entity_id:"binary_sensor.kitchen_door",name:"דלת הזזה למטבח",domain:"binary_sensor",device_class:"door",area_id:"kitchen"},{entity_id:"binary_sensor.office_door",name:"דלת חדר עבודה",domain:"binary_sensor",device_class:"door",area_id:"office"},{entity_id:"binary_sensor.motion_living",name:"תנועה בסלון",domain:"binary_sensor",device_class:"motion",area_id:"living"},{entity_id:"binary_sensor.motion_office",name:"תנועה בחדר עבודה",domain:"binary_sensor",device_class:"motion",area_id:"office"},{entity_id:"cover.living_terrace",name:"תריס מרפסת",domain:"cover",device_class:"shutter",area_id:"living"},{entity_id:"cover.office",name:"תריס חדר עבודה",domain:"cover",device_class:"shutter",area_id:"office"},{entity_id:"sensor.living_temp",name:"טמפרטורה סלון",domain:"sensor",device_class:"temperature",area_id:"living"},{entity_id:"light.living",name:"תאורת סלון",domain:"light",device_class:null,area_id:"living"},{entity_id:"light.kitchen",name:"תאורת מטבח",domain:"light",device_class:null,area_id:"kitchen"},{entity_id:"light.hall",name:"תאורת כניסה",domain:"light",device_class:null,area_id:"hall"},{entity_id:"light.office",name:"תאורת חדר עבודה",domain:"light",device_class:null,area_id:"office"},{entity_id:"light.floor_lamp",name:"מנורת רצפה סלון",domain:"light",device_class:null,area_id:null},{entity_id:"binary_sensor.smoke_corridor",name:"גלאי עשן מסדרון",domain:"binary_sensor",device_class:"smoke",area_id:null}],_t=[{id:"demo-cam-entry",name:"מצלמת כניסה"},{id:"demo-cam-terrace",name:"מצלמת מרפסת"},{id:"demo-cam-yard",name:"מצלמת חצר"}],R={auto_accept:80,review_min:50,unreviewed:"as_detected",kit:"apartment",furniture:!0,auto_place:!0},le=e=>typeof e=="number"&&Number.isInteger(e)&&e>=5&&e<=99?e:null;function V(e){const s=e&&typeof e=="object"&&!Array.isArray(e)?e:{},t={...R};return t.auto_accept=le(s.auto_accept)??t.auto_accept,t.review_min=le(s.review_min)??t.review_min,t.review_min>=t.auto_accept&&(t.auto_accept=R.auto_accept,t.review_min=R.review_min),(s.unreviewed==="as_detected"||s.unreviewed==="reject")&&(t.unreviewed=s.unreviewed),(s.kit==="apartment"||s.kit==="office"||s.kit==="empty")&&(t.kit=s.kit),typeof s.furniture=="boolean"&&(t.furniture=s.furniture),typeof s.auto_place=="boolean"&&(t.auto_place=s.auto_place),t}function D(e,s){const t=Math.round(e*100);return t>=s.auto_accept?"sure":t>=s.review_min?"check":"doubt"}function ce(e,s){return[...e.walls.map(i=>({id:i.id,kind:"wall",band:D(i.confidence,s),confidence:i.confidence})),...e.openings.map(i=>({id:i.id,kind:i.kind,band:D(i.confidence,s),confidence:i.confidence}))].filter(i=>i.band!=="sure").sort((i,a)=>i.confidence-a.confidence||(i.id<a.id?-1:i.id>a.id?1:0))}function $t(e,s){const t={sure:0,check:0,doubt:0};for(const i of e.walls)t[D(i.confidence,s)]+=1;for(const i of e.openings)t[D(i.confidence,s)]+=1;return t}function zt(e,s){const t=e.walls.find(a=>a.id===s);if(t)return t.kind==="railing"?"railing":"wall";const i=e.openings.find(a=>a.id===s);return i?i.kind==="door"?i.swing==="sliding"?"sliding":"door":i.kind:null}const Mt=[{id:"wall",he:"קיר"},{id:"railing",he:"מעקה או קיר נמוך"},{id:"none",he:"אין כאן קיר"}],It=[{id:"sliding",he:"דלת הזזה"},{id:"door",he:"דלת רגילה"},{id:"passage",he:"מעבר פתוח"},{id:"window",he:"חלון"},{id:"none",he:"אין כאן פתח"}],St={wall:"קיר",door:"דלת",window:"חלון",passage:"מעבר פתוח"};function Dt(e,s){const t=e.openings.find(a=>a.id===s);return t?t.kind==="door"&&t.swing==="sliding"?"זוהה כדלת הזזה":t.kind==="passage"?"זוהה כמעבר פתוח":`זוהה כ${St[t.kind]}`:e.walls.find(a=>a.id===s)?.kind==="railing"?"זוהה כמעקה":"זוהה כקיר"}function Pt(e,s){return s==="none"?null:s==="sliding"?e.kind==="door"&&e.swing==="sliding"?{}:{kind:"door",swing:"sliding",height_m:2.1,sill_m:0}:s==="door"?e.kind==="door"&&e.swing!=="sliding"?{}:{kind:"door",swing:"left",height_m:2.1,sill_m:0}:s==="passage"?e.kind==="passage"?{}:{kind:"passage",swing:"none",height_m:2.1,sill_m:0}:e.kind==="window"?{}:{kind:"window",swing:"none",height_m:1.2,sill_m:.9}}function At(e,s){return s==="none"?null:s==="railing"?e.kind==="railing"?{}:{kind:"railing"}:e.kind==="railing"?{kind:"interior"}:{}}function Rt(e,s,t){const i=new Set,a={},n={byChoice:0,byDoubt:0,byPolicy:0,orphans:0},r=d=>{const h=D(d,t);return h==="sure"||h==="check"&&t.unreviewed==="as_detected"?!0:(h==="check"?n.byPolicy+=1:n.byDoubt+=1,!1)};for(const d of e.walls){const h=s[d.id];if(h===void 0){r(d.confidence)&&i.add(d.id);continue}const u=At(d,h);if(!u){n.byChoice+=1;continue}i.add(d.id),Object.keys(u).length&&(a[d.id]=u)}for(const d of e.openings){const h=s[d.id];let u;if(h===void 0)u=r(d.confidence);else{const c=Pt(d,h);u=!!c,c?Object.keys(c).length&&(a[d.id]=c):n.byChoice+=1}if(u){if(!i.has(d.wall_id)&&s[d.wall_id]==="none"){n.orphans+=1,delete a[d.id];continue}i.add(d.id)}}const o=Be(e,Ye(e).filter(d=>i.has(d))),p=e.objects.filter(d=>D(d.confidence,t)==="sure").map(d=>d.id);return{accepted:[...o,...p],edits:a,rejected:n}}function Ot(e,s,t){let i=null;for(const a of e.walls)for(let n=1;n<a.polyline.length;n++){const r=a.polyline[n-1],o=a.polyline[n],p=Math.hypot((o[0]-r[0])*s,(o[1]-r[1])*t);(!i||p>i.px)&&(i={id:a.id,a:[r[0],r[1]],b:[o[0],o[1]],px:p})}return i}const O=[{id:"entrance",he:"כניסה",kind:"room",tags:["entrance"],words:["כניסה","לובי","מבואה"]},{id:"corridor",he:"מעבר",kind:"corridor",tags:["corridor"],words:["מסדרון","מעבר","פרוזדור"]},{id:"living",he:"סלון",kind:"room",tags:["living"],words:["סלון","מגורים","אירוח"]},{id:"kitchen",he:"מטבח",kind:"room",tags:["kitchen"],words:["מטבח","מטבחון","פינת אוכל"]},{id:"bedroom",he:"חדר שינה",kind:"room",tags:["bedroom"],words:["שינה","הורים","ילדים"]},{id:"office",he:"חדר עבודה",kind:"room",tags:["office"],words:["עבודה","משרד","מחשב"]},{id:"meeting",he:"חדר ישיבות",kind:"room",tags:["meeting"],words:["ישיבות","כנסים"]},{id:"wc",he:"שירותים",kind:"room",tags:["wc"],words:["שירותים","אורחים"]},{id:"bath",he:"אמבטיה",kind:"room",tags:["bath"],words:["אמבטיה","מקלחת","רחצה"]},{id:"stairs",he:"חדר מדרגות",kind:"corridor",tags:["stairs"],words:["מדרגות"]},{id:"service",he:"חדר שירות",kind:"service",tags:["service"],words:["שירות","כביסה"]},{id:"storage",he:"מחסן",kind:"service",tags:["storage"],words:["מחסן","אחסון"]},{id:"technical",he:"חדר טכני",kind:"service",tags:["technical"],words:["טכני","שרתים","חשמל","תקשורת"]},{id:"balcony",he:"מרפסת",kind:"outdoor",tags:["balcony"],words:["מרפסת"]},{id:"parking",he:"חניה",kind:"outdoor",tags:["parking"],words:["חניה","חנייה","חניון"]},{id:"other",he:"אחר",kind:"zone",tags:[],words:[]}],Y=e=>O.find(s=>s.id===e)??O[O.length-1];function F(e){const s=e.trim();if(!s)return null;for(const t of O)if(t.words.some(i=>s.includes(i)))return t.id;return null}const q=e=>`חדר ${e+1}`;function te(e){let s=0,t=0,i=0;for(let a=0,n=e.length-1;a<e.length;n=a++){const r=e[n].x*e[a].y-e[a].x*e[n].y;s+=r,t+=(e[n].x+e[a].x)*r,i+=(e[n].y+e[a].y)*r}if(Math.abs(s)<1e-12){const a=Math.max(1,e.length);return{x:e.reduce((n,r)=>n+r.x,0)/a,y:e.reduce((n,r)=>n+r.y,0)/a}}return{x:t/(3*s),y:i/(3*s)}}const G=[{id:"apartment",he:"דירה",note:"פרקט, קירות בהירים, ריהוט בית",level:"oak",floors:{default:"oak",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",service:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",parking:"asphalt"},furniture:{living:["sofa.3","table.side"],kitchen:["table.dining"],bedroom:["wardrobe"],office:["table.desk","chair.office"],meeting:["table.meeting"],wc:["toilet.standard"],bath:["bathtub","sink.bathroom"],entrance:["coat.rack"]}},{id:"office",he:"משרד",note:"שטיח, שולחנות עבודה, חדרי ישיבות",level:"carpet",floors:{default:"carpet",entrance:"tiles_grey",corridor:"tiles_grey",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt"},furniture:{office:["table.desk","chair.office"],living:["sofa.2","table.side"],meeting:["table.meeting"],kitchen:["table.round"],wc:["toilet.standard"],bath:["sink.bathroom"],entrance:["bench.indoor"],technical:["rack.server"]}},{id:"empty",he:"ריק",note:"חומרים בלבד, בלי ריהוט",level:"concrete",floors:{default:"concrete",parking:"asphalt"},furniture:{}}],B=e=>G.find(s=>s.id===e)??G[0],N=(e,s)=>e.floors[s]??e.floors.default,L={"sofa.3":{w_m:2.1,d_m:.9,h_m:.85},"sofa.2":{w_m:1.6,d_m:.9,h_m:.85},"table.side":{w_m:.5,d_m:.5,h_m:.5},"table.dining":{w_m:1.6,d_m:.9,h_m:.75},"table.round":{w_m:1.2,d_m:1.2,h_m:.75},wardrobe:{w_m:1.5,d_m:.6,h_m:2.2},"table.desk":{w_m:1.4,d_m:.7,h_m:.75},"chair.office":{w_m:.6,d_m:.6,h_m:1.1},"table.meeting":{w_m:3,d_m:1.2,h_m:.75},"toilet.standard":{w_m:.4,d_m:.7,h_m:.8},bathtub:{w_m:1.7,d_m:.75,h_m:.6},"sink.bathroom":{w_m:.6,d_m:.45,h_m:.85},"coat.rack":{w_m:.4,d_m:.4,h_m:1.8},"bench.indoor":{w_m:1.8,d_m:.4,h_m:.45},"rack.server":{w_m:.6,d_m:1,h_m:2}},de="plan-wizard";function Et(e,s,t,i,a){const n=e.levels.find(h=>h.is_default)??e.levels[0];let r={...e,objects:e.objects.filter(h=>!h.tags?.includes(de))};n&&(r={...r,levels:r.levels.map(h=>h.id===n.id?{...h,floor_material_id:t.level}:h)});const o=e.dimensions.width_px||1e3,p=e.dimensions.height_px||1e3,d=[];for(const h of s){const u=Y(h.typeId);if(r.rooms.some(k=>k.id===h.id)?r={...r,rooms:r.rooms.map(k=>k.id===h.id?{...k,tags:u.tags}:k)}:r={...r,rooms:[...r.rooms,{id:h.id,level_id:h.level_id??n?.id??null,tags:u.tags}]},r=Je(r,"rooms",h.id,"floor_material_id",N(t,u.id)),!i)continue;const c=(t.furniture[u.id]??[]).filter(k=>L[k]);if(!c.length||h.polygon.length<3)continue;const y=h.polygon.map(k=>k.x),b=h.polygon.map(k=>k.y),$=(Math.max(...y)-Math.min(...y))*o*a,M=(Math.max(...b)-Math.min(...b))*p*a,I=te(h.polygon),x=c.reduce((k,W)=>k+L[W].w_m,0)+.3*(c.length-1),K=Math.max(...c.map(k=>L[k].d_m));if(x+.6>$||K+.6>M)continue;let se=-x/2;c.forEach((k,W)=>{const Z=L[k],Re=se+Z.w_m/2;se+=Z.w_m+.3,d.push({id:`wz-${h.id}-${W}`.slice(0,64),item_id:k,level_id:h.level_id??n?.id??"L0",position:[E(I.x+Re/(o*a)),E(I.y)],rotation_deg:0,size:{...Z},z_m:0,params:{},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{},tags:[de]})})}return et({...r,objects:[...r.objects,...d]})}const E=e=>Math.round(Math.min(1,Math.max(0,e))*1e5)/1e5,jt=new Set(["door","garage_door","opening"]),Tt=new Set(["window"]);function Ct(e){return e.domain==="lock"?"door":e.domain==="cover"?e.device_class==="garage"||e.device_class==="door"||e.device_class==="gate"?"door":"window":e.domain==="binary_sensor"&&e.device_class&&jt.has(e.device_class)?"door":e.domain==="binary_sensor"&&e.device_class&&Tt.has(e.device_class)?"window":null}function Ft(e,s){let t=!1;for(let i=0,a=s.length-1;i<s.length;a=i++){const n=s[i],r=s[a];n.y>e.y!=r.y>e.y&&e.x<(r.x-n.x)*(e.y-n.y)/(r.y-n.y)+n.x&&(t=!t)}return t}function qt(e,s,t,i=!0){const a=new Set,n=new Map;return e.map(r=>{const o=r.area_id?s.find(y=>y.area_id===r.area_id):void 0;if(!o||!i)return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:o?.name??null,x:null,y:null,where:"manual"};const p=te(o.polygon),d=Ct(r);if(d){const y=t.filter(b=>b.kind===d&&!a.has(b.id)&&Ft(pe(b,p,.04),o.polygon)).sort((b,$)=>Math.hypot(b.x-p.x,b.y-p.y)-Math.hypot($.x-p.x,$.y-p.y))[0];if(y){a.add(y.id);const b=pe(y,p,.06);return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:o.name,x:b.x,y:b.y,where:d}}}const h=n.get(o.id)??0;n.set(o.id,h+1);const u=h*2.399963,c=h===0?0:.028*Math.sqrt(h);return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:o.name,x:E(p.x+c*Math.cos(u)),y:E(p.y+c*Math.sin(u)),where:"centre"}})}function pe(e,s,t){return{x:E(e.x+(s.x-e.x)*t),y:E(e.y+(s.y-e.y)*t)}}function Lt(e){return e.map(s=>({entity_id:s.id,name:s.name,domain:"camera",resource:"camera",room:null,x:null,y:null,where:"manual"}))}const S=e=>e.resource==="camera",he={door:"ליד הדלת שזוהתה",window:"ליד החלון שזוהה",centre:"מרכז החדר",manual:"בחר ולחץ על המפה",none:"לא יוצב"},Nt="הוצבה במקום שסימנת";function Vt(e){return O.find(t=>t.tags.length&&t.tags.every(i=>e?.includes(i)))?.id??"other"}const T="#1b1f27",w=e=>Math.round(e*10)/10,Ae=e=>e.map(s=>`${w(s[0])},${w(s[1])}`).join(" ");function Gt(e){let s="";for(const t of e)if(t.kind==="wall")s+=`<polyline points="${Ae(t.points)}" fill="none" stroke="${T}" stroke-width="${w(Math.max(3,t.width))}" stroke-linejoin="miter" stroke-linecap="butt"/>`;else if(t.kind==="door"){for(const i of t.leaves)s+=`<line x1="${w(i[0][0])}" y1="${w(i[0][1])}" x2="${w(i[1][0])}" y2="${w(i[1][1])}" stroke="${T}" stroke-width="2"/>`;for(const i of t.arcs)s+=`<path d="M${w(i.from[0])},${w(i.from[1])} A${w(i.r)},${w(i.r)} 0 0 ${i.sweep} ${w(i.to[0])},${w(i.to[1])}" fill="none" stroke="${T}" stroke-width="1.3"/>`}else if(t.kind==="window")for(const i of t.lines)s+=`<line x1="${w(i[0][0])}" y1="${w(i[0][1])}" x2="${w(i[1][0])}" y2="${w(i[1][1])}" stroke="${T}" stroke-width="1.5"/>`;return s}function Ut(e){const s=e.dimensions.width_px,t=e.dimensions.height_px,i=`<g stroke="${T}" stroke-width="1.2" fill="none"><path d="M42,20H958M42,12v16M958,12v16M292,12v16M20,42V858M12,42h16M12,858h16"/><path d="M0,470H${s}" stroke-dasharray="14 8 3 8"/><rect x="${s-250}" y="${t-40}" width="236" height="34"/></g>`,a=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${t}" width="${s}" height="${t}"><rect width="${s}" height="${t}" fill="#ffffff"/>${i}${Gt(Ie(e,s,t))}</svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(a)}`}const A={sure:"var(--wz-sure)",check:"var(--wz-check)",doubt:"var(--wz-doubt)"};function ue(e,s){const t=e.dimensions.width_px,i=e.dimensions.height_px,a=new Map,n=new Map;for(const r of Ie(He(e,s),t,i))r.kind==="wall"?a.set(r.id,[...a.get(r.id)??[],r.points]):(r.kind==="door"||r.kind==="window"||r.kind==="passage")&&n.set(r.id,r.gap);return{walls:a,gaps:n}}function H(e,s){const t=e.gaps.get(s);if(t)return[(t[0][0]+t[1][0])/2,(t[0][1]+t[1][1])/2];const i=e.walls.get(s);if(!i?.length)return null;const a=[...i].sort((n,r)=>me(r)-me(n))[0];return a.length>=2?[(a[0][0]+a[a.length-1][0])/2,(a[0][1]+a[a.length-1][1])/2]:a[0]}const me=e=>e.slice(1).reduce((s,t,i)=>s+Math.hypot(t[0]-e[i][0],t[1]-e[i][1]),0);function fe(e,s,t,i,a,n){const r=new Map([...s.walls.map(u=>[u.id,u.confidence]),...s.openings.map(u=>[u.id,u.confidence])]),o=u=>i.has(u)?"sure":D(r.get(u)??1,t),p=[...e.walls.entries()].map(([u,c])=>{const y=o(u),b=a.has(u);return c.map($=>_`<polyline data-cand=${u} points=${Ae($)} fill="none" stroke=${b?"var(--wz-out)":A[y]} stroke-width="7" stroke-linecap="round" stroke-dasharray=${y==="doubt"&&!b?"10 9":b?"3 8":"none"} opacity=".85"/>`)}),d=[...e.gaps.entries()].map(([u,[c,y]])=>{const b=o(u),$=a.has(u),M=[(c[0]+y[0])/2,(c[1]+y[1])/2],I=n===u;return _`<line data-cand=${u} x1=${w(c[0])} y1=${w(c[1])} x2=${w(y[0])} y2=${w(y[1])} stroke=${$?"var(--wz-out)":A[b]} stroke-width="9" stroke-linecap="round" stroke-dasharray=${b==="doubt"&&!$?"3 12":"none"} opacity=".95"/>
      ${b!=="sure"||I?_`<circle data-cand=${u} cx=${w(M[0])} cy=${w(M[1])} r=${I?46:26} fill=${A[b]} fill-opacity=${I?.16:.1} stroke=${A[b]} stroke-width=${I?4:2}/>`:v}`}),h=n&&e.walls.has(n)?H(e,n):null;return _`<g class="ov">${p}${d}${h?_`<circle cx=${w(h[0])} cy=${w(h[1])} r="46" fill=${A[o(n)]} fill-opacity=".14" stroke=${A[o(n)]} stroke-width="4"/>`:v}</g>`}const ge=["#7aa7ff","#b99cf0","#8fd0c8","#f5c26b","#f09a8a","#9ccf7f","#e8a3d3","#b8bfcc","#7fc4e8","#d9b48f","#a3b8f0","#c9d97f"],Q=e=>ge[e%ge.length];function we(e,s,t,i,a){return _`<g class="rooms">${e.map((n,r)=>{const o=te(n.polygon),p=n.polygon.map(d=>`${w(d.x*s)},${w(d.y*t)}`).join(" ");return _`<polygon data-room=${r} points=${p} fill=${Q(r)} fill-opacity=${i==="name"?a===r?.62:.42:.16} stroke=${a===r?"var(--sw-accent)":"none"} stroke-width="4"/>
      ${i==="name"?_`<g data-room=${r}><circle cx=${w(o.x*s)} cy=${w(o.y*t)} r="24" fill="#fff" stroke=${Q(r)} stroke-width="3"/><text x=${w(o.x*s)} y=${w(o.y*t+8)} text-anchor="middle" font-size="24" font-weight="700" fill="#1e2e47">${r+1}</text></g>`:v}`})}</g>`}function Kt(e,s,t,i){return _`<g class="devs">${e.filter(a=>a.x!==null&&a.y!==null).map(a=>{const n=w(a.x*s),r=w(a.y*t),o=a.entity_id===i,p=a.where==="manual"?"var(--wz-check)":"var(--wz-sure)",d=a.resource==="camera"?_`<rect x=${w(a.x*s-15)} y=${w(a.y*t-15)} width="30" height="30" rx="7" fill=${p} stroke="#fff" stroke-width="4"/>`:_`<circle cx=${n} cy=${r} r="15" fill=${p} stroke="#fff" stroke-width="4"/>`;return _`<g data-dev=${a.entity_id} data-dev-kind=${a.resource??"ha_entity"}>${o?_`<circle cx=${n} cy=${r} r="30" fill="var(--sw-accent)" fill-opacity=".16" stroke="var(--sw-accent)" stroke-width="3"/>`:v}${d}</g>`})}</g>`}const ve="אשף תוכנית חדשה",be="plan.wizard";class Wt{constructor(s){this.floorId=s,this.demo=!1}async prefs(){try{const s=await Ee("me/prefs");return V(s.prefs[be])}catch{return V(null)}}async savePrefs(s){await je("me/prefs",{[be]:s})}async upload(s){const t=await Te(this.floorId,s);return{assetId:t.id,name:t.original_name,pages:t.pages.map(i=>({page:i.page,url:Me(i.preview_url)}))}}async createVersion(s,t){const i=await Ce(this.floorId,{asset_id:s,page:t,rotation:0,crop:null,notes:ve});return ye(i)}async draft(s){const t=await it(s,{draft:!0});return{doc:t.doc,revision:t.geometry.revision}}detect(s){return at(s,{targets:["walls","openings"]})}async estimate(s,t){await rt(s,t.scale_m_per_px,t.reason)}async measure(s,t,i,a){return(await nt(s,[{a:t,b:i,metres:a}])).scale_m_per_px}async accept(s,t){const i=await ot(s,t);return{doc:i.doc,revision:i.geometry.revision}}async detectRooms(){const s=await ct(this.floorId,"medium");return{rooms:s.rooms.map(t=>({polygon:t.polygon,name:""})),existingAuto:s.existing_auto}}async acceptRooms(s,t,i){for(const r of i)await ne(r).catch(()=>{});const a=await dt(this.floorId,s,t),n=new Set(a.created);return a.created.map(r=>a.zones.find(o=>o.id===r)).filter(r=>!!r&&n.has(r.id)).map(r=>({id:r.id,revision:r.revision,polygon:r.polygon,level_id:r.level_id??null}))}async tagRoom(s,t,i){await pt(s.id,{revision:s.revision,tags:t,...i?{area_id:i}:{}})}async areas(){return(await ie({limit:1})).areas.filter(t=>t.area_name).map(t=>({area_id:t.area_id,name:t.area_name}))}async saveDraft(s,t,i){const a=await lt(s,t,i);return{doc:a.doc,revision:a.geometry.revision}}async entities(){return(await ie({placed:!1,limit:300})).entities.filter(t=>!t.disabled&&!t.hidden&&t.area_id).map(t=>({entity_id:t.entity_id,name:t.name||t.original_name||t.entity_id,domain:t.domain,device_class:t.device_class,area_id:t.area_id}))}async catalog(){try{const s=await ut();return{lookup3d:ft(s),materials:mt(s)}}catch{return{lookup3d:null,materials:null}}}async cameras(){const s=await Fe(this.floorId,!0),t=new Set(s.anchors.filter(i=>i.resource_type==="camera").map(i=>i.resource_id));return(s.cameras??[]).filter(i=>!t.has(i.id)).map(i=>({id:i.id,name:i.name||i.id}))}async publish(s,t){if(await qe(s),!t.length)return{placed:0,failed:0,refused:[]};if((await ae(this.floorId).then(r=>r.versions.filter(o=>o.status==="draft"&&o.id!==s)).catch(()=>[])).length)return{placed:0,failed:t.length,refused:t.map(r=>({id:r.entity_id,code:"other_draft"})),blocked:"other_draft"};let a=0;const n=[];for(const r of t)try{await Le(this.floorId,{resource_type:r.resource_type??"ha_entity",resource_id:r.entity_id,x:r.x,y:r.y,level_id:r.level_id}),a+=1}catch(o){n.push({id:r.entity_id,code:o instanceof C?o.code:"error"})}return{placed:a,failed:n.length,refused:n}}async resumable(){const t=(await ae(this.floorId)).versions.filter(i=>i.status==="draft").sort((i,a)=>i.created_at<a.created_at?1:-1)[0];return t&&t.notes===ve?{version:ye(t),createdAt:t.created_at}:null}async resumeRooms(s){return(await ht(this.floorId)).zones.filter(i=>i.plan_version_id===s&&i.source==="auto").map(i=>({id:i.id,revision:i.revision,polygon:i.polygon,level_id:i.level_id??null,name:i.name,tags:i.tags??[]}))}async discard(s,t){for(const i of t)await ne(i).catch(a=>{if(!(a instanceof C&&a.status===404))throw a});await Ne(s)}}function ye(e){const s=e.image_url??"";return{versionId:e.id,imageUrl:s?Me(s):"",width:e.width_px,height:e.height_px}}class U{constructor(s=!1){this.resume=s,this.demo=!0,this.doc=Pe(),this.revision=0,this.wait=t=>new Promise(i=>setTimeout(i,t))}static{this.prefsMem=null}async prefs(){return V(U.prefsMem)}async savePrefs(s){U.prefsMem={...s}}async upload(s){return await this.wait(150),{assetId:"demo-asset",name:s.name,pages:[{page:1,url:""}]}}async createVersion(){return{versionId:"demo-wizard",imageUrl:Ut(De()),width:this.doc.dimensions.width_px,height:this.doc.dimensions.height_px}}async draft(){return{doc:this.doc,revision:this.revision}}async detect(){return await this.wait(900),vt()}async estimate(){}async measure(s,t,i,a){const n=Math.hypot((i[0]-t[0])*this.doc.dimensions.width_px,(i[1]-t[1])*this.doc.dimensions.height_px),r=a/Math.max(1,n);return this.doc={...this.doc,dimensions:{...this.doc.dimensions,scale_m_per_px:r,calibration:{status:"measured",method:"two_point",pairs:[{a:t,b:i,metres:a}],residual_pct:null,reason:null}}},r}async accept(s,t){const i=new Set(t.accepted),a=t.edits;return this.doc={...this.doc,walls:t.candidates.walls.filter(n=>i.has(n.id)).map(n=>({...n,...a[n.id]??{}})),openings:t.candidates.openings.filter(n=>i.has(n.id)).map(n=>({...n,...a[n.id]??{}})),objects:[...this.doc.objects.filter(n=>n.source!=="auto"),...(t.candidates.objects??[]).filter(n=>i.has(n.id))]},this.revision+=1,{doc:this.doc,revision:this.revision}}async detectRooms(){return await this.wait(200),{rooms:yt(),existingAuto:0}}async acceptRooms(s){return s.map((t,i)=>({id:`demo-room-${i+1}`,revision:1,polygon:t.polygon,level_id:"L0"}))}async tagRoom(){}async areas(){return xt}async saveDraft(s,t){return this.doc=t,this.revision+=1,{doc:this.doc,revision:this.revision}}async entities(){return kt}async catalog(){return{lookup3d:null,materials:null}}async cameras(){return _t}async publish(s,t){return await this.wait(300),{placed:t.length,failed:0,refused:[]}}async resumable(){return this.resume?{version:await this.createVersion(),createdAt:"2026-11-12T08:30:00Z"}:null}async resumeRooms(){return[]}async discard(){await this.wait(100)}}function Zt(e,s=!1){return Oe()?new Wt(e):new U(s)}const Bt=Ve`
  :host {
    display: block;
    position: relative;
    min-block-size: 0;
    --wz-sure: var(--sw-accent);
    --wz-check: var(--sw-warning);
    --wz-doubt: var(--sw-danger);
    --wz-out: var(--sw-text-3);
    --wz-ease: cubic-bezier(0.23, 1, 0.32, 1);
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  .wz {
    position: absolute;
    inset: 0;
    display: grid;
    grid-template-rows: 64px minmax(0, 1fr) 68px;
    grid-template-columns: minmax(0, 1fr) 380px;
    grid-template-areas: 'steps steps' 'canvas side' 'foot foot';
    background: var(--sw-bg);
    overflow: hidden;
  }
  button {
    font: inherit;
    color: inherit;
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }
  button,
  .opt,
  .preset,
  .dev,
  .st {
    user-select: none;
  }
  :focus-visible {
    outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
    outline-offset: 2px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }

  /* ---- the step bar */
  .wz-steps {
    grid-area: steps;
    display: flex;
    align-items: center;
    gap: 4px;
    padding-inline: 20px 12px;
    background: var(--sw-surface);
    border-block-end: 1px solid var(--sw-border);
    min-inline-size: 0;
  }
  .st {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-medium);
    white-space: nowrap;
  }
  .st i {
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    background: var(--sw-surface-3);
    display: grid;
    place-items: center;
    font-style: normal;
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    transition: background-color 200ms var(--wz-ease), color 200ms var(--wz-ease);
  }
  .st.done i {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .st.now {
    color: var(--sw-heading);
    font-weight: var(--sw-fw-bold);
  }
  .st.now i {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .ln {
    flex: 1;
    block-size: 2px;
    background: var(--sw-border);
    min-inline-size: 10px;
    border-radius: 2px;
  }
  .ln.done {
    background: var(--sw-accent);
  }
  .mob {
    display: none;
  }
  .gear {
    margin-inline-start: 10px;
    flex: none;
    inline-size: 40px;
    block-size: 40px;
    border-radius: var(--sw-r-md);
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    display: grid;
    place-items: center;
    cursor: pointer;
    color: var(--sw-text-2);
    transition: transform 140ms ease-out, background-color 150ms ease;
  }
  .gear:active {
    transform: scale(0.97);
  }
  @media (hover: hover) and (pointer: fine) {
    .gear:hover {
      background: var(--sw-surface-3);
    }
  }

  /* ---- the canvas: the plan on a dotted table, never mirrored */
  .wz-canvas {
    grid-area: canvas;
    position: relative;
    overflow: hidden;
    background: radial-gradient(circle at 1px 1px, var(--sw-border-strong) 1px, transparent 0) 0 0 / 22px 22px, var(--sw-surface-2);
    direction: ltr;
  }
  .sheet {
    position: absolute;
    inset: 20px;
    display: grid;
    place-items: center;
  }
  svg.plan {
    max-inline-size: 100%;
    max-block-size: 100%;
    border-radius: 4px;
    box-shadow: 0 8px 24px rgba(20, 30, 50, 0.16), 0 1px 3px rgba(20, 30, 50, 0.1);
    background: #fff;
  }
  svg.plan [data-cand],
  svg.plan [data-room] {
    cursor: pointer;
  }
  svg.plan.placing {
    cursor: crosshair;
  }
  .legend {
    position: absolute;
    inset-block-end: 12px;
    left: 12px;
    direction: rtl;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    max-inline-size: calc(100% - 24px);
    padding: 8px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    box-shadow: var(--sw-shadow-2);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .legend span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }
  .legend i {
    inline-size: 18px;
    block-size: 4px;
    border-radius: 2px;
  }
  .legend i.dash {
    background: none !important;
    block-size: 0;
    border-block-start: 3px dashed var(--wz-doubt);
  }
  .legend i.dot {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 50%;
  }
  .legend i.sq {
    inline-size: 10px;
    block-size: 10px;
    border-radius: 3px;
    border: 2px solid var(--sw-text-3);
  }
  /* the scanning band: a full-height layer whose last 90 px carry the light, moved by its own height (no layout per frame) */
  .scan {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent calc(100% - 90px), color-mix(in srgb, var(--sw-accent) 16%, transparent) calc(100% - 18px), color-mix(in srgb, var(--sw-accent) 45%, transparent));
    border-block-end: 2px solid var(--sw-accent);
    animation: scan 2.2s cubic-bezier(0.77, 0, 0.175, 1) infinite alternate;
    pointer-events: none;
  }
  @keyframes scan {
    from {
      transform: translateY(calc(-100% + 90px));
    }
    to {
      transform: translateY(0);
    }
  }
  .drop {
    position: absolute;
    inset: 28px;
    border: 2px dashed var(--sw-border-strong);
    border-radius: var(--sw-r-xl);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 10px;
    text-align: center;
    color: var(--sw-text-2);
    padding: 24px;
    direction: rtl;
    background: var(--sw-surface);
    transition: border-color 150ms ease, background-color 150ms ease;
  }
  .drop.over {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
  }
  .drop .big {
    color: var(--sw-accent);
  }
  .drop b {
    font-size: var(--sw-fs-xl);
    color: var(--sw-heading);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.3px;
  }
  .drop .row {
    display: flex;
    gap: 8px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .fmts {
    display: flex;
    gap: 6px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    block-size: 24px;
    padding-inline: 8px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-3);
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
  }
  a.tag {
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
    text-decoration: none;
  }
  input[type='file'] {
    display: none;
  }
  .preview3d {
    position: absolute;
    inset: 0;
  }
  .preview3d sw-plan-3d {
    position: absolute;
    inset: 0;
    block-size: 100%;
  }
  .preview-note {
    position: absolute;
    inset-block-start: 12px;
    right: 12px;
    direction: rtl;
    padding: 6px 10px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    border: 1px solid var(--sw-border);
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    box-shadow: var(--sw-shadow-1);
  }

  /* ---- the side panel */
  .wz-side {
    grid-area: side;
    background: var(--sw-surface);
    border-inline-start: 1px solid var(--sw-border);
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-block-size: 0;
    overflow: hidden;
  }
  .wz-side h2 {
    margin: 0;
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.3px;
    color: var(--sw-heading);
    text-wrap: balance;
  }
  .wz-side > p {
    margin: 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-sm);
  }
  .card {
    border: 1px solid var(--sw-border);
    border-radius: var(--sw-r-lg);
    padding: 12px;
    background: var(--sw-surface);
  }
  .card.soft {
    background: var(--sw-surface-2);
    border-color: transparent;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .card.err {
    background: var(--sw-danger-soft);
    border-color: transparent;
    color: var(--sw-danger-text);
    font-size: var(--sw-fs-sm);
    display: grid;
    gap: 8px;
  }
  .kv {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 8px 12px;
    align-items: center;
    font-size: var(--sw-fs-sm);
  }
  .kv b {
    font-weight: var(--sw-fw-semibold);
  }
  .tips {
    display: grid;
    gap: 6px;
    margin-block-start: 8px;
    font-size: var(--sw-fs-sm);
  }
  select,
  input[type='text'],
  input[type='number'] {
    block-size: 36px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border-strong);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    padding-inline: 10px;
    inline-size: 100%;
    min-inline-size: 0;
  }
  @media (pointer: coarse) {
    select,
    input[type='text'],
    input[type='number'] {
      font-size: 16px;
    }
  }
  .prog {
    display: grid;
    gap: 10px;
  }
  .p {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-md);
    color: var(--sw-text-3);
  }
  .p i {
    inline-size: 22px;
    block-size: 22px;
    border-radius: 50%;
    border: 2px solid var(--sw-border-strong);
    display: grid;
    place-items: center;
    flex: none;
  }
  .p.done {
    color: var(--sw-text);
  }
  .p.done i {
    border-color: var(--sw-accent);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .p.run {
    color: var(--sw-heading);
    font-weight: var(--sw-fw-semibold);
  }
  .p.run i {
    border-color: var(--sw-accent);
    border-inline-start-color: transparent;
    animation: spin 0.8s linear infinite;
  }
  .p .v {
    margin-inline-start: auto;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-weight: var(--sw-fw-regular);
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .cnts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cnt {
    border-radius: var(--sw-r-md);
    padding: 10px 12px;
    background: var(--sw-surface-2);
  }
  .cnt b {
    display: block;
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    letter-spacing: -0.4px;
    color: var(--sw-heading);
    line-height: 1.1;
  }
  .cnt span {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .cnt.chk {
    background: var(--sw-warning-soft);
  }
  .cnt.chk b {
    color: var(--sw-warning-text);
  }
  .cnt.low {
    background: var(--sw-danger-soft);
  }
  .cnt.low b {
    color: var(--sw-danger-text);
  }
  .qhead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pager {
    margin-inline-start: auto;
    flex: none;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .pager button {
    inline-size: 32px;
    block-size: 32px;
    border-radius: var(--sw-r-sm);
    border: 1px solid var(--sw-border);
    background: var(--sw-surface);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition: transform 140ms ease-out;
  }
  .pager button:active:not(:disabled) {
    transform: scale(0.97);
  }
  .pager button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .q-crop {
    border-radius: var(--sw-r-md);
    overflow: hidden;
    background: #fff;
    border: 1px solid var(--sw-border);
    block-size: 150px;
    direction: ltr;
  }
  .q-crop svg {
    inline-size: 100%;
    block-size: 100%;
    display: block;
  }
  .conf {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .conf .bar {
    flex: 1;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-3);
    overflow: hidden;
    direction: ltr;
  }
  .conf .bar i {
    display: block;
    block-size: 100%;
    border-radius: 3px;
    background: var(--wz-check);
  }
  .conf.doubt .bar i {
    background: var(--wz-doubt);
  }
  .conf.sure .bar i {
    background: var(--wz-sure);
  }
  .why {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .opts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .opt {
    block-size: 44px;
    border-radius: var(--sw-r-md);
    border: 1.5px solid var(--sw-border-strong);
    font-weight: var(--sw-fw-semibold);
    font-size: var(--sw-fs-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--sw-surface);
    cursor: pointer;
    transition: border-color 150ms ease, background-color 150ms ease, transform 120ms ease-out;
  }
  .opt:active {
    transform: scale(0.97);
  }
  .opt[aria-pressed='true'] {
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
    color: var(--sw-accent-text);
  }
  .opt kbd {
    font: var(--sw-fw-semibold) 11px var(--sw-font, inherit);
    color: var(--sw-text-3);
    border: 1px solid var(--sw-border-strong);
    border-radius: 4px;
    padding: 0 5px;
  }
  .measure {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .measure input {
    inline-size: 90px;
  }
  .rooms {
    display: grid;
    gap: 4px;
  }
  .rrow {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) 118px;
    gap: 8px;
    align-items: center;
    block-size: 40px;
  }
  .rrow > i {
    inline-size: 14px;
    block-size: 14px;
    border-radius: 4px;
  }
  .rrow input.empty {
    border-color: var(--sw-warning);
    background: var(--sw-warning-soft);
  }
  .rrow input.linked {
    border-color: color-mix(in srgb, var(--sw-accent) 55%, var(--sw-border-strong));
  }
  .rnote {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .rnote > span:first-child {
    flex: 1;
    min-inline-size: 0;
  }
  .rnote .warn {
    color: var(--sw-warning-text);
  }
  .check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .check input {
    inline-size: 18px;
    block-size: 18px;
    margin: 0;
  }
  .presets {
    display: grid;
    gap: 10px;
  }
  .preset {
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    border-radius: var(--sw-r-md);
    border: 1.5px solid var(--sw-border);
    overflow: hidden;
    text-align: start;
    background: var(--sw-surface);
    cursor: pointer;
    padding: 0;
    transition: border-color 150ms ease, transform 120ms ease-out, box-shadow 150ms ease;
  }
  @media (hover: hover) and (pointer: fine) {
    .preset:hover {
      box-shadow: var(--sw-shadow-2);
    }
  }
  .preset:active {
    transform: scale(0.98);
  }
  .preset[aria-pressed='true'] {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 2px var(--sw-accent-soft);
  }
  .preset .sw {
    display: grid;
    grid-template-rows: 1fr 1fr;
    grid-template-columns: 1fr 1fr;
    direction: ltr;
    min-block-size: 64px;
  }
  .preset .tx {
    padding: 10px 12px;
    display: grid;
    gap: 2px;
    align-content: center;
  }
  .preset b {
    font-size: var(--sw-fs-md);
    font-weight: var(--sw-fw-bold);
    color: var(--sw-heading);
  }
  .preset span {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .devs {
    display: grid;
    gap: 4px;
  }
  .dev {
    display: flex;
    align-items: center;
    gap: 8px;
    block-size: 38px;
    padding-inline: 10px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    font-size: var(--sw-fs-sm);
    border: 1.5px solid transparent;
    cursor: pointer;
    text-align: start;
    inline-size: 100%;
    transition: border-color 150ms ease, transform 120ms ease-out;
  }
  .dev:active {
    transform: scale(0.98);
  }
  .dev sw-icon {
    color: var(--sw-text-3);
    flex: none;
  }
  .dev .nm {
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dev .w {
    margin-inline-start: auto;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    white-space: nowrap;
  }
  .dev.todo {
    background: var(--sw-warning-soft);
  }
  .dev.todo .w {
    color: var(--sw-warning-text);
    font-weight: var(--sw-fw-semibold);
  }
  .dev.off {
    opacity: 0.55;
  }
  .dev[aria-pressed='true'] {
    border-color: var(--sw-accent);
  }
  /* PLAN3D-R28-WIZARD2-2434: a placed camera, devices / cameras switch, the resume and kept-plan cards, the replace dialog */
  .dev.set .w {
    color: var(--sw-accent-text);
  }
  .seg {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 2px;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
  }
  .seg button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    block-size: 34px;
    border: 0;
    border-radius: calc(var(--sw-r-md) - 2px);
    background: transparent;
    color: var(--sw-text-2);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, transform 140ms cubic-bezier(0.23, 1, 0.32, 1);
  }
  .seg button:active {
    transform: scale(0.97);
  }
  .seg button[aria-selected='true'] {
    /* DARK-SEG-ALL-2380: the chosen key reads the key tokens (in dark the light pill + its ink); light keeps the card surface */
    background: var(--sw-seg-key, var(--sw-surface));
    color: var(--sw-seg-key-ink, var(--sw-text));
    box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
  }
  .seg .num {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    font-variant-numeric: tabular-nums;
  }
  .seg button[aria-selected='true'] .num {
    color: var(--sw-seg-key-ink, var(--sw-text-3));
  }
  .card.resume {
    display: grid;
    gap: 6px;
    border-color: var(--sw-accent);
    background: var(--sw-accent-soft);
    font-size: var(--sw-fs-sm);
  }
  .card.resume span {
    color: var(--sw-text-2);
  }
  .card.resume .side-actions {
    margin-block-start: 4px;
  }
  .dlg-p {
    margin: 0 0 8px;
    font-size: var(--sw-fs-sm);
    line-height: 1.55;
    max-inline-size: 60ch;
  }
  .dlg-p.soft {
    color: var(--sw-text-3);
  }
  .grow {
    flex: 1;
    min-block-size: 0;
  }
  .side-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  /* ---- the footer */
  .wz-foot {
    grid-area: foot;
    display: flex;
    align-items: center;
    gap: 10px;
    padding-inline: 20px;
    background: var(--sw-surface);
    border-block-start: 1px solid var(--sw-border);
  }
  .wz-foot .sp {
    flex: 1;
  }
  .wz-foot .hint {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- the settings dialog */
  .prefs {
    display: grid;
    gap: 14px;
  }
  .prefs label {
    display: grid;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-2);
  }
  .prefs label.check {
    display: flex;
  }
  .prefs .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .prefs .note {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }

  @media (max-width: 1100px) {
    .wz {
      grid-template-columns: minmax(0, 1fr) 330px;
    }
    .st:not(.now) span {
      display: none;
    }
    .wz-side {
      padding: 14px;
      gap: 10px;
    }
    .q-crop {
      block-size: 112px;
    }
  }
  @media (max-height: 760px) and (min-width: 768px) {
    .q-crop {
      block-size: 104px;
    }
    .wz-side {
      gap: 9px;
    }
  }
  @media (max-width: 767px) {
    .wz {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: 52px minmax(0, 38fr) minmax(0, 62fr) calc(64px + env(safe-area-inset-bottom));
      grid-template-areas: 'steps' 'canvas' 'side' 'foot';
    }
    .wz-steps {
      padding-inline: 14px 8px;
    }
    .st,
    .ln {
      display: none;
    }
    .mob {
      display: flex;
      flex: 1;
      align-items: center;
      gap: 10px;
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading);
      font-size: var(--sw-fs-md);
      min-inline-size: 0;
    }
    .mob small {
      font-weight: var(--sw-fw-regular);
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
    }
    .mob .bar {
      flex: 1;
      block-size: 4px;
      border-radius: 2px;
      background: var(--sw-surface-3);
      overflow: hidden;
      direction: rtl;
    }
    .mob .bar i {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      border-radius: 2px;
    }
    .wz-side {
      border-inline-start: 0;
      border-block-start: 1px solid var(--sw-border);
      padding: 12px 14px;
      gap: 8px;
    }
    .wz-side h2 {
      font-size: var(--sw-fs-lg);
    }
    .wz-foot {
      padding: 0 14px env(safe-area-inset-bottom);
    }
    .wz-foot .hint,
    .hide-ph {
      display: none;
    }
    .sheet {
      inset: 10px;
    }
    .drop {
      inset: 12px;
      padding: 14px;
    }
    .legend {
      display: none;
    }
    .q-crop {
      block-size: 96px;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .scan {
      animation: none;
      transform: translateY(-62%);
    }
    .p.run i {
      animation-duration: 2.4s;
    }
    .opt,
    .preset,
    .dev,
    .gear,
    .seg button,
    .pager button {
      transition: none;
    }
  }
`;var Yt=Object.defineProperty,Ht=Object.getOwnPropertyDescriptor,f=(e,s,t,i)=>{for(var a=i>1?void 0:i?Ht(s,t):s,n=e.length-1,r;n>=0;n--)(r=e[n])&&(a=(i?r(s,t,a):r(a))||a);return i&&a&&Yt(s,t,a),a};const xe=["העלאה","זיהוי","בדיקה","חדרים","סגנון","התקנים","סיום"],ke=8,_e=4,Qt=7,Xt=4,Jt={forbidden:"אין הרשאה",already_placed:"כבר הוצב",validation:"לא קיים",not_placeable:"לא ניתן להצבה"},$e=e=>{try{return new Date(e).toLocaleString("he-IL",{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}},ze=(e,s)=>{const t=st.find(i=>i.id===e);return t?.tint?s?t.tint.dark:t.tint.light:"#cccccc"},es=e=>e==="light"?"light":e==="lock"?"lock":e==="cover"?"coverClose":e==="camera"?"camera":e==="sensor"?"thermometer":"sensor";let m=class extends Ge{constructor(){super(...arguments),this.floorId="",this.demoStep=0,this.demoResume=!1,this.step=1,this.prefs={...R},this.prefsOpen=!1,this.prefsDraft={...R},this.floor=null,this.ceiling=2.8,this.busy=!1,this.error="",this.dragOver=!1,this.uploaded=null,this.page=1,this.version=null,this.versionPage=1,this.resumeInfo=null,this.replace=null,this.phases={structure:"idle",rooms:"idle"},this.elapsed=0,this.result=null,this.set=null,this.draft=null,this.decisions={},this.current=null,this.measure={open:!1,metres:""},this.rooms=[],this.roomsPage=0,this.roomFocus=null,this.existingAuto=0,this.replaceAuto=!1,this.areas=[],this.created=[],this.kit="apartment",this.furniture=!0,this.catalog={lookup3d:null,materials:null},this.three="idle",this.placements=[],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices",this.done=null,this.backend=null,this.token=0,this.small=!1,this.mq=null,this.onMq=()=>{this.small=!!this.mq?.matches,this.requestUpdate()},this.onKey=e=>this.key(e),this.sceneMemo={key:"",desc:null},this.geomMemo=null}connectedCallback(){super.connectedCallback();try{this.mq=window.matchMedia("(max-width: 767px), (max-height: 760px)"),this.small=this.mq.matches,this.mq.addEventListener("change",this.onMq)}catch{this.mq=null}window.addEventListener("keydown",this.onKey),this.init()}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.removeEventListener("keydown",this.onKey),clearInterval(this.timer),this.token++}willUpdate(e){e.has("floorId")&&e.get("floorId")!==void 0&&this.init()}async init(){const e=++this.token;this.backend=Zt(this.floorId,this.demoResume);const s=this.backend;try{const[t,i]=await Promise.all([s.prefs(),Ue()]);if(e!==this.token)return;this.prefs=t,this.kit=t.kit,this.furniture=t.furniture&&t.kit!=="empty";const a=Ke(i,this.floorId);if(a?this.floor={name:a.floor.name,crumb:`${a.site.name} · ${a.building.name}`,hasPlan:a.floor.has_plan,siblings:(a.building.floors??[]).map(n=>({id:n.id,name:n.name}))}:this.floor={name:"",crumb:"",hasPlan:!1,siblings:[]},!(s.demo&&this.demoStep>1)){const n=await s.resumable().catch(()=>null);e===this.token&&!this.version&&(this.resumeInfo=n)}}catch(t){e===this.token&&(this.error=z(t))}s.demo&&this.demoStep>1&&await this.demoTo(Math.min(7,this.demoStep),e)}async demoTo(e,s){await this.onFile(new File(["demo"],"תוכנית-קרקע.png",{type:"image/png"}),e===2),!(s!==this.token||e<=3)&&(await this.confirmReview(),!(s!==this.token||e<=4)&&(await this.saveRooms(),!(s!==this.token||e<=5)&&(await this.saveStyle(),!(s!==this.token||e<=6)&&(this.step=7))))}get ownDraft(){return this.version?.versionId??this.resumeInfo?.version.versionId??null}async onFile(e,s=!1){const t=this.backend;if(!(!e||!t||this.busy)){if(this.ownDraft){this.replace={kind:"file",file:e};return}this.busy=!0,this.error="";try{if(this.uploaded=await t.upload(e),this.page=1,this.uploaded.pages.length>1)return;await this.startVersion(s)}catch(i){this.error=z(i)}finally{this.busy=!1}}}async startVersion(e=!1){const s=this.backend;!s||!this.uploaded||(this.version=await s.createVersion(this.uploaded.assetId,this.page),this.versionPage=this.page,this.step=2,await this.runDetect(e))}reuseVersion(){this.busy||!this.version||(this.step=2,this.runDetect())}async confirmReplace(){const e=this.backend,s=this.replace,t=this.ownDraft;if(!(!e||!s||!t||this.busy)){this.busy=!0,this.error="";try{const i=this.version?this.created.map(a=>a.id):(await e.resumeRooms(t)).map(a=>a.id);await e.discard(t,i),this.version=null,this.resumeInfo=null,this.created=[],this.rooms=[],this.set=null,this.result=null,this.draft=null,this.replace=null}catch(i){this.replace=null,this.error=`הטיוטה הקודמת לא נמחקה, ולכן התוכנית החדשה לא הועלתה: ${z(i)}`;return}finally{this.busy=!1}s.kind==="file"?await this.onFile(s.file):await this.pickPage()}}async resumeWizard(){const e=this.backend,s=this.resumeInfo;if(!e||!s||this.busy)return;this.busy=!0,this.error="";const t=this.token;try{this.version=s.version,this.uploaded={assetId:"",name:"התוכנית מהטיוטה",pages:[{page:1,url:""}]},this.resumeInfo=null;const i=await e.draft(s.version.versionId);if(t!==this.token)return;if(this.draft=i,!i.doc.walls.length){this.busy=!1,this.step=2,await this.runDetect();return}const a=await e.resumeRooms(s.version.versionId);if(t!==this.token)return;if(a.length)this.created=a.map(({id:n,revision:r,polygon:o,level_id:p})=>({id:n,revision:r,polygon:o,level_id:p})),this.rooms=a.map(n=>({polygon:n.polygon,name:n.name,typeId:Vt(n.tags)}));else{const n=await e.detectRooms().catch(()=>({rooms:[],existingAuto:0}));this.rooms=n.rooms.map(r=>({polygon:r.polygon,name:r.name,typeId:F(r.name)??"other"})),this.existingAuto=n.existingAuto}this.phases={structure:"done",rooms:"done"},this.areas=await e.areas().catch(()=>[]),this.roomsPage=0,this.step=4}catch(i){this.error=z(i)}finally{this.busy=!1}}async pickPage(){if(!this.busy){this.busy=!0,this.error="";try{await this.startVersion()}catch(e){this.error=z(e)}finally{this.busy=!1}}}async runDetect(e=!1){const s=this.backend,t=this.version;if(!s||!t)return;const i=this.token;this.error="",this.phases={structure:"run",rooms:"idle"};const a=Date.now();if(this.elapsed=0,clearInterval(this.timer),this.timer=window.setInterval(()=>this.elapsed=Math.floor((Date.now()-a)/1e3),1e3),e){clearInterval(this.timer);return}try{const[n,r]=await Promise.all([s.draft(t.versionId),s.detect(t.versionId)]);if(i!==this.token)return;this.draft=n,this.result=r,this.set=this.scaled(Qe(r),n.doc),this.phases={structure:"done",rooms:"run"},this.decisions={},this.current=ce(this.set,this.prefs)[0]?.id??null;try{const o=await s.detectRooms();if(i!==this.token)return;this.rooms=o.rooms.map(p=>({polygon:p.polygon,name:p.name,typeId:F(p.name)??"other"})),this.existingAuto=o.existingAuto,this.phases={structure:"done",rooms:"done"}}catch{this.rooms=[],this.phases={structure:"done",rooms:"error"}}this.step=3}catch(n){if(i!==this.token)return;const r=n instanceof C&&n.code==="detect_timeout";this.error=r?"הזיהוי לא הסתיים בזמן. תוכנית גדולה או סריקה רועשת לוקחות זמן: נסה שוב, או המשך בסטודיו התוכניות.":z(n),this.phases={...this.phases,structure:"error"}}finally{clearInterval(this.timer)}}scaled(e,s){const{scale:t}=re(s);return e.scaleMPerPx===null||Math.abs(e.scaleMPerPx-t)>t*1e-6?Xe(e,t):e}get queue(){return this.set?ce(this.set,this.prefs):[]}decide(e){const s=this.current;if(!s)return;this.decisions={...this.decisions,[s]:e};const t=this.queue,i=t.findIndex(n=>n.id===s),a=t.slice(i+1).find(n=>!(n.id in this.decisions))??t.find(n=>!(n.id in this.decisions));a&&(this.current=a.id)}moveQueue(e){const s=this.queue;if(!s.length)return;const t=s.findIndex(i=>i.id===this.current);this.current=s[Math.max(0,Math.min(s.length-1,(t<0?0:t)+e))].id}async measureWall(){const e=this.backend,s=this.version,t=this.set,i=parseFloat(this.measure.metres.replace(",","."));if(!e||!s||!t||!this.draft||!(i>0)||this.busy)return;const a=Ot(t,this.draft.doc.dimensions.width_px,this.draft.doc.dimensions.height_px);if(a){this.busy=!0,this.error="";try{await e.measure(s.versionId,a.a,a.b,i),this.draft=await e.draft(s.versionId),this.set=this.scaled(t,this.draft.doc),this.measure={open:!1,metres:""}}catch(n){this.error=z(n)}finally{this.busy=!1}}}async confirmReview(){const e=this.backend,s=this.version,t=this.result;if(!(!e||!s||!t||!this.set||this.busy)){this.busy=!0,this.error="";try{let i=await e.draft(s.versionId);const a=i.doc.dimensions.calibration?.status;a!=="measured"&&a!=="estimated"&&t.calibration_hint&&(await e.estimate(s.versionId,t.calibration_hint),i=await e.draft(s.versionId));const n=this.scaled(this.set,i.doc),r=Rt(n,this.decisions,this.prefs);this.draft=await e.accept(s.versionId,{accepted:r.accepted,edits:r.edits,replace_auto:!0,candidates:{walls:n.walls,openings:n.openings,objects:n.objects},base_revision:i.revision,detector:t.detector}),this.set=n,this.step=4,this.roomsPage=0,this.areas.length||(this.areas=await e.areas().catch(()=>[]))}catch(i){this.error=i instanceof C&&i.code==="stale_revision"?"טיוטת המבנה השתנתה בינתיים בחלון אחר. אשר שוב.":z(i)}finally{this.busy=!1}}}areaOf(e){const s=e.trim();return s?this.areas.find(t=>t.name===s)?.area_id??null:null}setRoom(e,s){this.rooms=this.rooms.map((t,i)=>{if(i!==e)return t;const a={...t,...s};return s.name!==void 0&&(t.typeId==="other"||t.typeId===F(t.name))&&(a.typeId=F(s.name)??t.typeId),a})}async saveRooms(){const e=this.backend;if(!(!e||this.busy)){if(!this.rooms.length){this.created=[],this.step=5;return}this.busy=!0,this.error="";try{const s=this.rooms.map((i,a)=>({polygon:i.polygon,name:i.name.trim()||q(a),kind:Y(i.typeId).kind})),t=await e.acceptRooms(s,this.replaceAuto,this.created.map(i=>i.id));for(let i=0;i<t.length;i++)await e.tagRoom(t[i],Y(this.rooms[i]?.typeId).tags,this.areaOf(this.rooms[i]?.name??""));this.created=t,this.step=5,this.loadThree()}catch(s){this.error=z(s)}finally{this.busy=!1}}}async loadThree(){if(!(this.three!=="idle"||!this.backend)){this.three="loading";try{const[,e]=await Promise.all([We(()=>import("./sw-plan-3d-BraDpR1Q.js").then(s=>s.s),__vite__mapDeps([0]),import.meta.url),this.backend.catalog()]);this.catalog=e,this.three="ready"}catch{this.three="failed"}}}styledRooms(){return this.created.map((e,s)=>({id:e.id,typeId:this.rooms[s]?.typeId??"other",polygon:e.polygon,level_id:e.level_id}))}styledDoc(){const e=this.draft?.doc;if(!e)return null;const s={...e,levels:e.levels.map(t=>t.is_default||e.levels.length===1?{...t,ceiling_height_m:this.ceiling}:t)};return Et(s,this.styledRooms(),B(this.kit),this.furniture&&this.kit!=="empty",re(e).scale)}scene(){const e=this.styledDoc();if(!e||this.three!=="ready")return null;const s=`${this.draft?.revision}|${this.kit}|${this.furniture}|${this.ceiling}|${this.created.map(i=>i.id).join(",")}`;if(this.sceneMemo.key===s)return this.sceneMemo.desc;let t=null;try{t=tt({doc:e,width:e.dimensions.width_px,height:e.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},catalog:this.catalog.lookup3d,materialsCatalog:this.catalog.materials,realistic:!0,zones:this.created.map((i,a)=>({id:i.id,name:this.rooms[a]?.name||q(a),polygon:i.polygon,level_id:i.level_id}))})}catch{t=null}return this.sceneMemo={key:s,desc:t},t}async saveStyle(){const e=this.backend,s=this.version,t=this.styledDoc();if(!(!e||!s||!t||!this.draft||this.busy)){this.busy=!0,this.error="";try{this.draft=await e.saveDraft(s.versionId,t,this.draft.revision),await this.proposeDevices(),this.step=6}catch(i){this.error=i instanceof C&&i.code==="stale_revision"?"טיוטת המבנה השתנתה בינתיים בחלון אחר. חזור לשלב הזה ונסה שוב.":z(i)}finally{this.busy=!1}}}async proposeDevices(){const e=this.backend;if(!e||!this.draft)return;const s=await e.entities().catch(()=>[]),t=this.draft.doc,i=t.dimensions.width_px,a=t.dimensions.height_px,n=ue(t,{walls:t.walls,openings:t.openings,objects:[]}),r=t.openings.map(c=>{const y=H(n,c.id);return y?{id:c.id,kind:c.kind,x:y[0]/i,y:y[1]/a}:null}).filter(c=>!!c),o=this.created.map((c,y)=>({id:c.id,name:this.rooms[y]?.name.trim()||q(y),area_id:this.areaOf(this.rooms[y]?.name??""),polygon:c.polygon})),p=new Set(o.map(c=>c.area_id).filter(Boolean)),d=s.filter(c=>c.area_id?p.has(c.area_id):e.demo),h=qt(d,o,r,this.prefs.auto_place),u=await e.cameras().catch(()=>[]);this.placements=[...h.filter(c=>c.where==="manual"),...h.filter(c=>c.where!=="manual"),...Lt(u)],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices"}placeAt(e){if(this.step!==6||!this.selDev||!this.draft)return;const s=e.currentTarget,t=s.createSVGPoint();t.x=e.clientX,t.y=e.clientY;const i=s.getScreenCTM();if(!i)return;const a=t.matrixTransform(i.inverse()),n=this.draft.doc.dimensions.width_px,r=this.draft.doc.dimensions.height_px,o=Math.round(Math.min(1,Math.max(0,a.x/n))*1e5)/1e5,p=Math.round(Math.min(1,Math.max(0,a.y/r))*1e5)/1e5,d=this.selDev;this.placements=this.placements.map(u=>u.entity_id===d?{...u,x:o,y:p,where:u.where==="manual"?"centre":u.where}:u);const h=new Set(this.skipped);h.delete(d),this.skipped=h,this.selDev=null}toggleSkip(e){const s=new Set(this.skipped);s.has(e)?s.delete(e):s.add(e),this.skipped=s,this.selDev===e&&(this.selDev=null)}get toPlace(){return this.placements.filter(e=>e.x!==null&&e.y!==null&&e.where!=="manual"&&!this.skipped.has(e.entity_id))}unplace(e){this.placements=this.placements.map(s=>s.entity_id===e?{...s,x:null,y:null,where:"manual"}:s),this.selDev=null}async publish(){const e=this.backend,s=this.version;if(!(!e||!s||this.busy)){this.busy=!0,this.error="";try{const t=this.draft?.doc.levels.find(i=>i.is_default)?.id??this.draft?.doc.levels[0]?.id??null;this.done=await e.publish(s.versionId,this.toPlace.map(i=>({resource_type:i.resource??"ha_entity",entity_id:i.entity_id,x:i.x,y:i.y,level_id:t}))),this.done.failed||j(`/explore/floors/${this.floorId}`)}catch(t){this.error=z(t)}finally{this.busy=!1}}}toStudio(){j(`/explore/floors/${this.floorId}/edit`)}back(){if(this.busy||this.step<=1)return;this.error="";const e=this.step===3?1:this.step-1;if(e===3&&!this.set){this.step=2,this.runDetect();return}this.step=e,this.step===1&&(this.phases={structure:"idle",rooms:"idle"})}next(){this.busy||(this.step===1&&this.version&&(!this.uploaded||this.uploaded.pages.length<2||this.page===this.versionPage)?this.reuseVersion():this.step===1&&this.version?this.replace={kind:"page"}:this.step===1&&this.uploaded&&this.uploaded.pages.length>1?this.pickPage():this.step===2&&this.phases.structure==="error"?this.runDetect():this.step===3?this.confirmReview():this.step===4?this.saveRooms():this.step===5?this.saveStyle():this.step===6?this.step=7:this.step===7&&this.publish())}key(e){if(this.step!==3||this.prefsOpen||e.ctrlKey||e.metaKey||e.altKey)return;const s=e.composedPath()[0];if(s&&(s.tagName==="INPUT"||s.tagName==="SELECT"||s.tagName==="TEXTAREA"))return;const t=Number(e.key),i=this.choicesFor(this.current);t>=1&&t<=i.length&&(e.preventDefault(),this.decide(i[t-1].id))}choicesFor(e){if(!e||!this.set)return[];if(this.set.walls.some(t=>t.id===e))return Mt;const s=this.set.openings.find(t=>t.id===e)?.kind==="window";return It.filter(t=>s?t.id!=="sliding":t.id!=="window")}openPrefs(){this.prefsDraft={...this.prefs},this.prefsOpen=!0}async savePrefs(){const e=this.backend,s=V(this.prefsDraft);this.prefsOpen=!1,this.prefs=s,this.step<=3&&(this.kit=s.kit,this.furniture=s.furniture&&s.kit!=="empty"),this.set&&!this.queue.some(t=>t.id===this.current)&&(this.current=this.queue[0]?.id??null);try{await e?.savePrefs(s)}catch(t){this.error=z(t)}}render(){const e=this.step,s=this.draft?.doc.dimensions.width_px??this.version?.width??1e3,t=this.draft?.doc.dimensions.height_px??this.version?.height??1e3;return l`<div class="wz" data-wizard-step=${e}>
        ${this.renderSteps()}
        <div class="wz-canvas" data-wz-canvas>${this.renderCanvas(s,t)}</div>
        <div class="wz-side" data-wz-side>${this.renderSide(s,t)}</div>
        ${this.renderFoot()}
      </div>
      ${this.prefsOpen?this.renderPrefs():v}
      ${this.replace?this.renderReplace():v}`}renderSteps(){const e=this.step;return l`<div class="wz-steps" role="list" aria-label="שלבי האשף">
      ${xe.map((s,t)=>l`${t?l`<i class="ln ${t<e?"done":""}" aria-hidden="true"></i>`:v}<span role="listitem" class="st ${t+1<e?"done":t+1===e?"now":""}" aria-current=${t+1===e?"step":"false"}><i class="num">${t+1<e?l`<sw-icon name="check" size="14"></sw-icon>`:t+1}</i><span>${s}</span></span>`)}
      <div class="mob"><span>${xe[e-1]}</span><small class="num">שלב ${e} מתוך 7</small><span class="bar" aria-hidden="true"><i style="inline-size:${e/7*100}%"></i></span></div>
      <button class="gear" data-wz-prefs aria-label="הגדרות האשף" title="הגדרות האשף" @click=${()=>this.openPrefs()}><sw-icon name="system" size="18"></sw-icon></button>
    </div>`}planSvg(e,s,t,i={}){const a=this.version?.imageUrl??"",n=i.crop??[0,0,e,s];return l`<svg class="plan ${i.placing?"placing":""}" viewBox=${n.join(" ")} preserveAspectRatio=${i.crop?"xMidYMid slice":"xMidYMid meet"}
        style=${i.crop?"":`aspect-ratio:${e}/${s}`} role="img" aria-label="תוכנית הקומה" @click=${i.click??(()=>{})}>
      <rect x=${n[0]} y=${n[1]} width=${n[2]} height=${n[3]} fill="#fff"/>
      ${a?_`<image href=${a} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" opacity=${t===v?1:.55}/>`:v}
      ${t}
    </svg>`}get geom(){if(!this.set||!this.draft)return null;const e=`${this.draft.revision}|${this.set.walls.length}|${this.set.openings.length}|${this.set.scaleMPerPx}`;return this.geomMemo?.key!==e&&(this.geomMemo={key:e,g:ue(this.draft.doc,this.set)}),this.geomMemo.g}onCandClick(e){const t=e.target.closest("[data-cand]")?.getAttribute("data-cand");t&&(this.current=t)}onRoomClick(e){const s=e.target.closest("[data-room]"),t=s?Number(s.getAttribute("data-room")):NaN;if(!Number.isFinite(t))return;const i=this.small?_e:ke;this.roomFocus=t,this.roomsPage=Math.floor(t/i),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-room-name="${t}"]`)?.focus())}renderCanvas(e,s){const t=this.step;if(t===1)return l`<div class="drop ${this.dragOver?"over":""}" data-wz-drop
          @dragover=${a=>{a.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1}
          @drop=${a=>{a.preventDefault(),this.dragOver=!1,this.onFile(a.dataTransfer?.files?.[0])}}>
        <sw-icon class="big" name="upload" size="44"></sw-icon>
        <b>${this.uploaded?this.uploaded.name:"גרור לכאן את תוכנית הקומה"}</b>
        <span class="hide-ph">${this.uploaded&&this.uploaded.pages.length>1?"בחר בצד את העמוד שבו נמצאת התוכנית":"תמונה או PDF של תוכנית אדריכלית, שרטוט מכירות או סריקה"}</span>
        <div class="row">
          <span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-wz-file @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button variant="primary" size="lg" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>${this.busy?"מעלה…":"בחר קובץ"}</sw-button></span>
          <span><input type="file" accept="image/*" capture="environment" @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button size="lg" icon="camera" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>צלם</sw-button></span>
        </div>
        <div class="fmts"><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">PDF</span><a class="tag" href=${`#/explore/floors/${this.floorId}/import`}>DXF / IFC: ייבוא מדויק, בלי זיהוי</a></div>
      </div>`;if(t===2)return l`<div class="sheet">${this.planSvg(e,s,v)}</div>${this.phases.structure==="run"?l`<i class="scan" aria-hidden="true"></i>`:v}`;if(t===3){const a=this.geom,n=this.set;if(!a||!n)return v;const r=new Set(Object.entries(this.decisions).filter(([,o])=>o==="none").map(([o])=>o));return l`<div class="sheet">${this.planSvg(e,s,fe(a,n,this.prefs,new Set(Object.keys(this.decisions)),r,this.current),{click:o=>this.onCandClick(o)})}</div>
        <div class="legend"><span><i style="background:var(--wz-sure)"></i>זוהה בביטחון</span><span><i style="background:var(--wz-check)"></i>לבדיקה</span><span><i class="dash"></i>בספק, לא ייכנס בלי אישור</span><span><i style="background:var(--wz-out)"></i>הושמט</span></div>`}if(t===4)return l`<div class="sheet">${this.planSvg(e,s,we(this.rooms,e,s,"name",this.roomFocus),{click:a=>this.onRoomClick(a)})}</div>`;if(t===5||t===7){const a=this.scene();if(a)return l`<div class="preview3d"><sw-plan-3d data-wz-3d .description=${a} .frameKey=${`wizard-${this.version?.versionId??""}`} .preset=${"iso"} kiosk .qualityForce=${"full"} .minFps=${0}></sw-plan-3d></div><span class="preview-note">תצוגה מקדימה</span>`;const n=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,r=B(this.kit),o=_`<g>${this.created.map((p,d)=>_`<polygon points=${p.polygon.map(h=>`${h.x*e},${h.y*s}`).join(" ")} fill=${ze(N(r,this.rooms[d]?.typeId??"other"),n)} fill-opacity=".85"/>`)}</g>`;return l`<div class="sheet">${this.planSvg(e,s,o)}</div><span class="preview-note">${this.three==="loading"?"טוען תצוגה בתלת־ממד…":"תצוגה מקדימה"}</span>`}const i=_`${we(this.created.map(a=>({polygon:a.polygon})),e,s,"faint",null)}${Kt(this.placements.filter(a=>!this.skipped.has(a.entity_id)),e,s,this.selDev)}`;return l`<div class="sheet">${this.planSvg(e,s,i,{click:a=>this.placeAt(a),placing:!!this.selDev})}</div>
      <div class="legend"><span><i class="dot" style="background:var(--wz-sure)"></i>הוצב</span><span><i class="dot" style="background:var(--wz-check)"></i>ממתין למקום</span>${this.placements.some(S)?l`<span><i class="sq"></i>מצלמה</span>`:v}</div>`}renderSide(e,s){return l`${this.sideFor(e,s)}${this.error?l`<div class="card err" role="alert" data-wz-error>${this.error}</div>`:v}`}sideFor(e,s){const t=this.step;if(t===1){const i=this.uploaded&&this.uploaded.pages.length>1,a=this.resumeInfo,n=this.version;return l`<h2>העלאת תוכנית</h2><p>המערכת תזהה קירות, דלתות, חלונות וחדרים, ואתה תאשר. כמה דקות לקומה.</p>
        ${a?l`<div class="card resume" data-wz-resume><b>יש כאן טיוטה של האשף שלא הסתיימה</b><span>${$e(a.createdAt)?`התחלת אותה ב־${$e(a.createdAt)}. `:""}אפשר להמשיך מהמקום שעצרת.</span>
            <div class="side-actions"><sw-button variant="primary" icon="history" data-wz-resume-go ?disabled=${this.busy} @click=${()=>void this.resumeWizard()}>המשך באשף</sw-button><sw-button variant="ghost" @click=${()=>this.toStudio()}>פתח בסטודיו</sw-button></div></div>`:v}
        ${n&&!a?l`<div class="card resume" data-wz-kept><b>התוכנית שהעלית נשמרה</b><span>"המשך" יזהה אותה שוב, בלי טיוטה נוספת. קובץ אחר יחליף אותה.</span></div>`:v}
        <div class="card"><div class="kv">
          <b>לאיזו קומה?</b>
          <select style="inline-size:160px" aria-label="הקומה" data-wz-floor .value=${this.floorId} @change=${r=>j(`/explore/floors/${r.target.value}/wizard`)}>
            ${(this.floor?.siblings.length?this.floor.siblings:[{id:this.floorId,name:this.floor?.name||this.floorId}]).map(r=>l`<option value=${r.id} ?selected=${r.id===this.floorId}>${r.name}</option>`)}
          </select>
          <b class="hide-ph">גובה תקרה</b>
          <select class="hide-ph" style="inline-size:160px" aria-label="גובה תקרה" .value=${String(this.ceiling)} @change=${r=>this.ceiling=Number(r.target.value)}>
            ${[2.5,2.6,2.7,2.8,3,3.2,3.5,4,5].map(r=>l`<option value=${String(r)} ?selected=${r===this.ceiling}>${r.toFixed(2)} מ׳</option>`)}
          </select>
        </div></div>
        ${i?l`<div class="card"><b>באיזה עמוד התוכנית?</b><div class="side-actions" style="margin-block-start:8px">${this.uploaded.pages.map(r=>l`<button class="opt" style="inline-size:64px" aria-pressed=${r.page===this.page?"true":"false"} @click=${()=>this.page=r.page}>${r.page}</button>`)}</div></div>`:a||n?v:l`<div class="card soft hide-ph"><b>כדי שהזיהוי יצליח</b><div class="tips"><span>סריקה ישרה וחדה, בלי צל או קיפול.</span><span>קירות כהים על רקע בהיר.</span><span>ריהוט וכיתוב על התוכנית לא מפריעים.</span></div></div>`}
        ${this.floor?.hasPlan?l`<div class="side-actions"><sw-button variant="ghost" icon="edit" @click=${()=>this.toStudio()}>שרטוט ידני בסטודיו</sw-button></div>`:v}`}if(t===2){const i=(r,o,p="")=>l`<div class="p ${r==="done"?"done":r==="run"?"run":""}"><i>${r==="done"?l`<sw-icon name="check" size="13"></sw-icon>`:r==="error"?l`<sw-icon name="warning" size="13"></sw-icon>`:v}</i>${o}<span class="v">${p}</span></div>`,a=this.phases.structure,n=this.phases.rooms;return l`<h2>מזהה את התוכנית</h2><p>הזיהוי רץ אצלך במערכת. התוכנית לא נשלחת לשום מקום.</p>
        <div class="card"><div class="prog" data-wz-progress>
          ${i(a,"קירות",a==="done"?`${this.set?.walls.length??0} נמצאו`:"")}
          ${i(a,"דלתות, חלונות ומעברים",a==="done"?`${this.set?.openings.length??0} נמצאו`:"")}
          ${i(a==="done"?"done":a==="run"?"idle":a,"עמודים ומדרגות",a==="done"?`${this.set?.objects.length??0}`:"")}
          ${i(n,"חדרים סגורים",n==="done"?`${this.rooms.length} נמצאו`:n==="error"?"לא זוהו":"")}
          ${i(a==="done"?"done":"idle","קנה מידה",a==="done"?this.result?.calibration_hint?"משוער לפי רוחב דלת":"לא ידוע":"")}
        </div></div>
        <div class="card soft hide-ph">קווי מידה, קווים מקווקווים ומסגרת הגיליון מזוהים ומושמטים, כדי שלא יהפכו לקירות.</div>
        ${a==="run"?l`<div class="why num" data-wz-elapsed>${this.elapsed?`${this.elapsed} שנ׳`:""}</div>`:v}`}return t===3?this.sideReview(e,s):t===4?this.sideRooms():t===5?this.sideStyle():t===6?this.sideDevices():this.sideDone()}sideReview(e,s){const t=this.set,i=this.geom;if(!t||!i)return v;const a=$t(t,this.prefs),n=this.queue,r=this.current,o=n.findIndex(x=>x.id===r),p=r?t.walls.find(x=>x.id===r)??t.openings.find(x=>x.id===r):void 0,d=p?D(p.confidence,this.prefs):"sure",h=r?this.decisions[r]??zt(t,r):null,u=r?H(i,r):null,c=u?[u[0]-235,u[1]-125,470,250]:void 0,y=this.choicesFor(r),b=r?t.openings.find(x=>x.id===r):void 0,M=this.draft?.doc?.dimensions.calibration?.status,I=new Set(Object.entries(this.decisions).filter(([,x])=>x==="none").map(([x])=>x));return l`<h2>בדיקת הזיהוי</h2>
      <div class="cnts" data-wz-counts><div class="cnt"><b class="num">${a.sure}</b><span>בביטחון</span></div><div class="cnt chk"><b class="num">${a.check}</b><span>לבדיקה</span></div><div class="cnt low"><b class="num">${a.doubt}</b><span>בספק</span></div></div>
      ${n.length&&p?l`<div class="card" style="display:grid;gap:10px" data-wz-item=${r}>
            <div class="qhead"><b>מה יש כאן?</b><span class="pager"><button aria-label="הקודם" ?disabled=${o<=0} @click=${()=>this.moveQueue(-1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num" data-wz-pos>${o<0?"–":o+1} / ${n.length}</span><button aria-label="הבא" ?disabled=${o>=n.length-1} @click=${()=>this.moveQueue(1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span></div>
            <div class="q-crop">${this.planSvg(e,s,fe(i,t,this.prefs,new Set(Object.keys(this.decisions)),I,r),{crop:c})}</div>
            <div class="conf ${d}"><span>${Dt(t,r)}</span><span class="bar"><i style="inline-size:${Math.round(p.confidence*100)}%"></i></span><b class="num">${Math.round(p.confidence*100)}%</b></div>
            ${b?l`<div class="why hide-ph">${b.kind==="passage"?`יש רווח בקיר ברוחב ${b.width_m.toFixed(2)} מ׳, אבל לא נמצאה קשת של דלת.`:`ברוחב ${b.width_m.toFixed(2)} מ׳.`}</div>`:v}
            <div class="opts" role="group" aria-label="מה יש כאן">${y.map((x,K)=>l`<button class="opt" data-choice=${x.id} aria-pressed=${h===x.id?"true":"false"} @click=${()=>this.decide(x.id)}>${x.he}<kbd class="hide-ph">${K+1}</kbd></button>`)}</div>
          </div>`:l`<div class="card soft">כל מה שזוהה נמצא מעל סף הביטחון ויכנס לתוכנית. אפשר לתקן כל פריט אחר כך בסטודיו.</div>`}
      <div class="card soft hide-ph">${this.measure.open?l`<div class="measure"><span>אורך הקיר הארוך ביותר</span><input type="number" inputmode="decimal" min="0.5" step="0.01" aria-label="אורך במטרים" placeholder="מ׳" .value=${this.measure.metres} @input=${x=>this.measure={...this.measure,metres:x.target.value}} /><sw-button size="sm" variant="primary" ?disabled=${this.busy||!(parseFloat(this.measure.metres)>0)} @click=${()=>void this.measureWall()}>שמור</sw-button></div>`:l`<div class="kv"><span>קנה מידה <b>${M==="measured"?"נמדד":"משוער"}</b>${M==="measured"?"":this.result?.calibration_hint?", לפי רוחב דלת":""}</span><sw-button size="sm" icon="ruler" @click=${()=>this.measure={open:!0,metres:""}}>מדוד קיר</sw-button></div>`}</div>`}sideRooms(){const e=this.small?_e:ke,s=Math.max(1,Math.ceil(this.rooms.length/e)),t=Math.min(this.roomsPage,s-1),i=this.rooms.filter(a=>!a.name.trim()).length;return l`<h2>שמות החדרים</h2><p>${this.rooms.length?`נמצאו ${this.rooms.length} חדרים סגורים. תן שם לכל אחד, או בחר שם של אזור שכבר קיים במערכת כדי לקשר אליו.`:"לא נמצאו חדרים סגורים. אפשר להמשיך ולסמן חדרים אחר כך בסטודיו."}</p>
      <datalist id="wz-areas">${this.areas.map(a=>l`<option value=${a.name}></option>`)}</datalist>
      <div class="rooms" data-wz-rooms>${this.rooms.slice(t*e,t*e+e).map((a,n)=>{const r=t*e+n,o=!!this.areaOf(a.name);return l`<div class="rrow"><i style="background:${Q(r)}"></i>
          <input type="text" list="wz-areas" data-room-name=${r} class="${a.name.trim()?o?"linked":"":"empty"}" .value=${a.name} placeholder=${`${q(r)}: שם`} aria-label=${`שם חדר ${r+1}`} title=${o?"מקושר לאזור קיים":""}
            @focus=${()=>this.roomFocus=r} @input=${p=>this.setRoom(r,{name:p.target.value})} />
          <select aria-label=${`סוג חדר ${r+1}`} .value=${a.typeId} @change=${p=>this.setRoom(r,{typeId:p.target.value})}>${O.map(p=>l`<option value=${p.id} ?selected=${p.id===a.typeId}>${p.id==="other"?"סוג":p.he}</option>`)}</select>
        </div>`})}</div>
      <div class="rnote">${i?l`<span class="warn">${i===1?"חדר אחד עוד בלי שם":`${i} חדרים עוד בלי שם`}</span>`:l`<span>${this.rooms.filter(a=>this.areaOf(a.name)).length} מקושרים לאזורים קיימים</span>`}
        ${s>1?l`<span class="pager"><button aria-label="הקודם" ?disabled=${t<=0} @click=${()=>this.roomsPage=t-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${t+1} / ${s}</span><button aria-label="הבא" ?disabled=${t>=s-1} @click=${()=>this.roomsPage=t+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:v}</div>
      ${this.existingAuto?l`<label class="check"><input type="checkbox" .checked=${this.replaceAuto} @change=${a=>this.replaceAuto=a.target.checked} />להחליף ${this.existingAuto===1?"חדר אוטומטי קודם":`${this.existingAuto} חדרים אוטומטיים קודמים`} בקומה</label>`:v}`}sideStyle(){const e=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,s=t=>[N(t,"living"),N(t,"kitchen"),"plaster_white",t.id==="empty"?"plaster_ceiling":t.id==="office"?"fabric_accent":"wood_light"].map(i=>l`<i style="background:${ze(i,e)}"></i>`);return l`<h2>סגנון וריהוט</h2><p>ערכה קובעת חומרים וריהוט התחלתי לכל חדר לפי הסוג שלו. אפשר לשנות אחר כך חדר־חדר בסטודיו.</p>
      <div class="presets" role="radiogroup" aria-label="ערכת סגנון">${G.map(t=>l`<button class="preset" role="radio" data-kit=${t.id} aria-checked=${t.id===this.kit?"true":"false"} aria-pressed=${t.id===this.kit?"true":"false"}
          @click=${()=>{this.kit=t.id,t.id==="empty"?this.furniture=!1:this.prefs.furniture&&(this.furniture=!0)}}><span class="sw" aria-hidden="true">${s(t)}</span><span class="tx"><b>${t.he}</b><span>${t.note}</span></span></button>`)}</div>
      <label class="check"><input type="checkbox" data-wz-furniture .checked=${this.furniture} ?disabled=${this.kit==="empty"} @change=${t=>this.furniture=t.target.checked} /><sw-icon name="cube" size="16"></sw-icon>להציב ריהוט התחלתי</label>
      <div class="card soft hide-ph">ערכות לובי, טכני וחניון ומסחרי יתווספו בהמשך.</div>`}sideDevices(){const e=this.small?Xt:Qt,s=this.placements.filter(S),t=this.placements.filter(c=>!S(c)),i=s.length?this.devTab:"devices",a=i==="cameras"?s:t,n=Math.max(1,Math.ceil(a.length/e)),r=Math.min(this.devPage,n-1),o=t.filter(c=>c.where!=="manual").length,p=s.filter(c=>c.where!=="manual").length,d=this.selDev?this.placements.find(c=>c.entity_id===this.selDev):null,h=c=>{this.devTab=c,this.devPage=0,this.selDev=null},u=i==="cameras"?`${p} מתוך ${s.length} מצלמות סומנו. בחר מצלמה ולחץ על המפה במקום שבו היא מותקנת; מצלמה שלא תסמן לא תוצב.`:t.length?`${o} מתוך ${t.length} הוצבו לבד, לפי האזור והסוג. את השאר בוחרים ומסמנים על המפה.`:"אין התקנים שמחכים למקום באזורים של החדרים האלה. אפשר להציב התקנים אחר כך מהמפה.";return l`<h2>מיקום התקנים</h2>
      ${s.length?l`<div class="seg" role="tablist" aria-label="מה מציבים" data-wz-dev-tabs>
          <button role="tab" data-wz-tab="devices" aria-selected=${i==="devices"?"true":"false"} @click=${()=>h("devices")}><sw-icon name="sensor" size="15"></sw-icon>התקנים<span class="num">${t.length}</span></button>
          <button role="tab" data-wz-tab="cameras" aria-selected=${i==="cameras"?"true":"false"} @click=${()=>h("cameras")}><sw-icon name="camera" size="15"></sw-icon>מצלמות<span class="num">${p?`${p}/${s.length}`:s.length}</span></button>
        </div>`:v}
      <p>${u}</p>
      <div class="devs" data-wz-devs role=${s.length?"tabpanel":v}>${a.slice(r*e,r*e+e).map(c=>{const y=S(c),b=this.skipped.has(c.entity_id),$=!y&&c.where==="manual"&&!b,M=b?he.none:y&&c.where!=="manual"?Nt:he[c.where];return l`<button class="dev ${$?"todo":""} ${b?"off":""} ${y&&c.where!=="manual"?"set":""}" data-dev-row=${c.entity_id} aria-pressed=${this.selDev===c.entity_id?"true":"false"} @click=${()=>this.selDev=this.selDev===c.entity_id?null:c.entity_id}>
          <sw-icon name=${es(c.domain)} size="16"></sw-icon><span class="nm">${c.name}</span><span class="w">${M}</span></button>`})}</div>
      ${d?l`<div class="card soft" data-wz-dev-sel><b>${d.name}</b>: לחץ על המפה כדי ${d.where==="manual"?"להציב":"להזיז"}.${S(d)?d.where!=="manual"?l`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.unplace(d.entity_id)}>הסר מהמפה</sw-button></div>`:v:l`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.toggleSkip(d.entity_id)}>${this.skipped.has(d.entity_id)?"להציב בכל זאת":"לא להציב"}</sw-button></div>`}</div>`:v}
      <div class="rnote"><span>${i==="cameras"?"רק מצלמות שמותר לך להציב, שעוד לא בקומה הזו":"רק התקנים מהקטלוג המאושר, שעוד לא על אף מפה"}</span>${n>1?l`<span class="pager"><button aria-label="הקודם" ?disabled=${r<=0} @click=${()=>this.devPage=r-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${r+1} / ${n}</span><button aria-label="הבא" ?disabled=${r>=n-1} @click=${()=>this.devPage=r+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:v}</div>`}sideDone(){const e=this.draft?.doc,s=e?.dimensions.calibration?.status;return l`<h2>הקומה מוכנה</h2><p>נשמרה כטיוטה. היא תופיע לכולם רק אחרי פרסום.</p>
      <div class="card"><div class="kv" data-wz-summary>
        <span>קירות</span><b class="num">${e?.walls.length??0}</b>
        <span>דלתות, חלונות ומעברים</span><b class="num">${e?.openings.length??0}</b>
        <span>חדרים</span><b class="num">${this.created.length}</b>
        <span>התקנים שיוצבו</span><b class="num">${this.toPlace.filter(t=>!S(t)).length}</b>
        ${this.placements.some(S)?l`<span>מצלמות שיוצבו</span><b class="num" data-wz-cams-count>${this.toPlace.filter(S).length}</b>`:v}
        <span>סגנון</span><b>${B(this.kit).he}</b>
        <span>קנה מידה</span><b>${s==="measured"?"נמדד":"משוער"}</b>
      </div></div>
      ${this.done?.failed?l`<div class="card err" data-wz-refused>${this.refusedText(this.done)}<div><sw-button size="sm" @click=${()=>j(`/explore/floors/${this.floorId}`)}>פתח את המפה</sw-button></div></div>`:v}
      <div class="card soft hide-ph">רוצה לדייק קיר, להזיז רהיט או להוסיף מצלמה? הכול פתוח לעריכה בסטודיו התוכניות. התקנים מוצבים רק בפרסום מכאן.</div>
      <sw-button data-wz-studio @click=${()=>this.toStudio()}>המשך עריכה בסטודיו</sw-button>`}refusedText(e){if(e.blocked==="other_draft")return`התוכנית פורסמה, אבל ${e.failed} פריטים לא הוצבו: לקומה יש טיוטה נוספת פתוחה, והם היו נשמרים עליה. פרסם או מחק אותה בסטודיו, ואז הצב מהמפה.`;const s=a=>this.placements.find(n=>n.entity_id===a)?.name??a,t=e.refused.slice(0,3).map(a=>`${s(a.id)} (${Jt[a.code]??"נדחה"})`).join(", "),i=e.refused.length>3?` ועוד ${e.refused.length-3}`:"";return`${e.placed} הוצבו, ${e.failed} לא הוצבו: ${t}${i}. אפשר להציב אותם מהמפה.`}renderReplace(){return l`<sw-dialog open heading="להחליף את התוכנית?" subheading="טיוטה אחת של האשף לכל קומה" data-wz-replace-dialog @close=${()=>this.replace=null}>
      <p class="dlg-p">הטיוטה הקודמת של האשף, עם הקירות, הפתחים והחדרים שאישרת בה, תימחק לפני שהתוכנית החדשה תיטען. היא לא פורסמה ושום דבר לא הוצב עליה.</p>
      <p class="dlg-p soft">כדי להמשיך עם אותה תוכנית, בחר "ביטול" ואז "המשך".</p>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" data-wz-replace-cancel ?disabled=${this.busy} @click=${()=>this.replace=null}>ביטול</sw-button>
        <sw-button variant="danger" data-wz-replace-go ?disabled=${this.busy} aria-busy=${this.busy?"true":"false"} @click=${()=>void this.confirmReplace()}>${this.busy?"מוחק…":"מחק את הטיוטה והמשך"}</sw-button>
      </div>
    </sw-dialog>`}renderFoot(){const e=this.step,s=e===1&&this.uploaded&&this.uploaded.pages.length>1,t=e===1?this.version?"אותה תוכנית, אותה טיוטה":"אפשר להעלות קומה אחת בכל פעם":e===2?"בדרך כלל 5 עד 20 שניות":e===3?this.prefs.unreviewed==="as_detected"?'מה שלא תבדוק: "לבדיקה" ייכנס כמו שזוהה, "בספק" לא ייכנס':"מה שלא תבדוק לא ייכנס לתוכנית":e===4?'חדר בלי שם יקבל "חדר 7", ואפשר לשנות אחר כך':e===5?"התצוגה מתעדכנת מיד כשבוחרים ערכה":e===6?"אפשר לדלג ולהציב התקנים אחר כך מהמפה":"אפשר לחזור ולתקן כל שלב",i=e===1?"המשך":e===2?this.phases.structure==="error"?"נסה שוב":"מזהה…":e===3?"אשר והמשך":e===7?"פרסם ופתח במפה":"המשך",a=this.busy||e===1&&!s&&!this.version||e===2&&this.phases.structure!=="error";return l`<div class="wz-foot">
      ${e>1?l`<sw-button size="lg" data-wz-back ?disabled=${this.busy||e===2} @click=${()=>this.back()}>חזרה</sw-button>`:l`<sw-button size="lg" variant="ghost" @click=${()=>j(`/explore/floors/${this.floorId}`)}>ביטול</sw-button>`}
      <span class="hint">${t}</span><span class="sp"></span>
      <sw-button size="lg" variant="primary" data-wz-next ?disabled=${a} aria-busy=${this.busy?"true":"false"} @click=${()=>this.next()}>${this.busy&&e>2?"שומר…":i}</sw-button>
    </div>`}renderPrefs(){const e=this.prefsDraft,s=i=>this.prefsDraft={...this.prefsDraft,...i},t=e.review_min>=e.auto_accept;return l`<sw-dialog open wide heading="הגדרות האשף" subheading="נשמרות לחשבון שלך" data-wz-prefs-dialog @close=${()=>this.prefsOpen=!1}>
      <div class="prefs">
        <div class="two">
          <label>נכנס בלי בדיקה מעל (%)<input type="number" min="5" max="99" .value=${String(e.auto_accept)} @input=${i=>s({auto_accept:Math.round(Number(i.target.value))})} /></label>
          <label>לא נכנס בלי אישור מתחת ל־(%)<input type="number" min="5" max="99" .value=${String(e.review_min)} @input=${i=>s({review_min:Math.round(Number(i.target.value))})} /></label>
        </div>
        ${t?l`<span class="note" style="color:var(--sw-danger-text)">הסף התחתון חייב להיות נמוך מהעליון.</span>`:v}
        <label>פריט "לבדיקה" שלא בדקת<select .value=${e.unreviewed} @change=${i=>s({unreviewed:i.target.value})}><option value="as_detected" ?selected=${e.unreviewed==="as_detected"}>נכנס כמו שזוהה</option><option value="reject" ?selected=${e.unreviewed==="reject"}>לא נכנס</option></select></label>
        <label>ערכת סגנון ראשונה<select .value=${e.kit} @change=${i=>s({kit:i.target.value})}>${G.map(i=>l`<option value=${i.id} ?selected=${i.id===e.kit}>${i.he}</option>`)}</select></label>
        <label class="check"><input type="checkbox" .checked=${e.furniture} @change=${i=>s({furniture:i.target.checked})} />להציב ריהוט התחלתי</label>
        <label class="check"><input type="checkbox" .checked=${e.auto_place} @change=${i=>s({auto_place:i.target.checked})} />להציב התקנים לבד לפי האזור</label>
        <span class="note">ברירת המחדל: מעל 80% נכנס, בין 50% ל־80% לבדיקה ונכנס כמו שזוהה אם דילגת, מתחת ל־50% לא נכנס בלי אישור.</span>
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" @click=${()=>this.prefsDraft={...R}}>ברירת מחדל</sw-button>
        <sw-button variant="primary" data-wz-prefs-save ?disabled=${t} @click=${()=>void this.savePrefs()}>שמור</sw-button>
      </div>
    </sw-dialog>`}};m.styles=Bt;f([X()],m.prototype,"floorId",2);f([X({type:Number})],m.prototype,"demoStep",2);f([X({type:Boolean})],m.prototype,"demoResume",2);f([g()],m.prototype,"step",2);f([g()],m.prototype,"prefs",2);f([g()],m.prototype,"prefsOpen",2);f([g()],m.prototype,"prefsDraft",2);f([g()],m.prototype,"floor",2);f([g()],m.prototype,"ceiling",2);f([g()],m.prototype,"busy",2);f([g()],m.prototype,"error",2);f([g()],m.prototype,"dragOver",2);f([g()],m.prototype,"uploaded",2);f([g()],m.prototype,"page",2);f([g()],m.prototype,"version",2);f([g()],m.prototype,"resumeInfo",2);f([g()],m.prototype,"replace",2);f([g()],m.prototype,"phases",2);f([g()],m.prototype,"elapsed",2);f([g()],m.prototype,"result",2);f([g()],m.prototype,"set",2);f([g()],m.prototype,"draft",2);f([g()],m.prototype,"decisions",2);f([g()],m.prototype,"current",2);f([g()],m.prototype,"measure",2);f([g()],m.prototype,"rooms",2);f([g()],m.prototype,"roomsPage",2);f([g()],m.prototype,"roomFocus",2);f([g()],m.prototype,"existingAuto",2);f([g()],m.prototype,"replaceAuto",2);f([g()],m.prototype,"areas",2);f([g()],m.prototype,"created",2);f([g()],m.prototype,"kit",2);f([g()],m.prototype,"furniture",2);f([g()],m.prototype,"catalog",2);f([g()],m.prototype,"three",2);f([g()],m.prototype,"placements",2);f([g()],m.prototype,"skipped",2);f([g()],m.prototype,"selDev",2);f([g()],m.prototype,"devPage",2);f([g()],m.prototype,"devTab",2);f([g()],m.prototype,"done",2);m=f([Ze("plan-wizard-screen")],m);export{m as PlanWizardScreen};
//# sourceMappingURL=plan-wizard-RnI5mXbv.js.map
