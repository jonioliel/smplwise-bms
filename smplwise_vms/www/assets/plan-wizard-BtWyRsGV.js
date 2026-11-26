const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as Te}from"./sw-logo-art-PLtEZJxU.js";import{ai as k,A as b,af as je,bg as Ce,bw as Fe,aQ as Le,aV as Se,aR as qe,a_ as re,aN as Ne,aT as Ve,pt as oe,pu as We,c as F,pv as Ue,j as Be,a as Ge,a3 as Ke,aL as Ze,q as M,a8 as j,b as d,ae as L,u as He,z as te,k as w,m as Ye}from"./index-CVsAtsN7.js";import{a as A,t as n,n as U,W as Y}from"./wizard-prefs-B1wlF7q0.js";import{w as Qe,a as Xe,c as Je,f as et,r as tt}from"./candidates-CoxtEVV0.js";import{P as st,Q as it,b as De,m as le}from"./shared-space-Bk61kJ4D.js";import{b as at}from"./scene-builder-BNWGkecI.js";import{M as nt}from"./material-resolve-4MvgB_4a.js";import{g as rt,d as ot,e as lt,f as dt,h as ct,s as pt}from"./geometry-B4NJVNbI.js";import{d as ht,a as de,b as ut,u as mt,l as ft}from"./zones-DioH6FRK.js";import{c as gt,l as wt,a as vt}from"./plan-catalog-Dx2eRTDE.js";import"./map-CBK9FVn4.js";const se=1e3,ie=900,R=.012,bt=e=>[Math.round(e[0]/se*1e5)/1e5,Math.round(e[1]/ie*1e5)/1e5],yt=[["g-out","exterior",.3,[[42,42],[958,42],[958,858],[42,858],[42,42]]],["g-w1","interior",.12,[[292,42],[292,858]]],["g-w2","interior",.12,[[42,292],[292,292]]],["g-w3","railing",.05,[[167,325],[167,625]]],["g-w5","interior",.12,[[292,500],[958,500]]],["g-w6","interior",.12,[[625,500],[625,858]]],["g-w7","interior",.12,[[42,625],[292,625]]],["g-w8","interior",.1,[[167,625],[167,858]]]],Pe=[["front","g-out",.95913,"door",1,"right","end"],["win-hall","g-out",.98317,"window",.8,"none","start"],["win-liv-n1","g-out",.12019,"window",1.4,"none","start"],["win-liv-n2","g-out",.16827,"window",1.4,"none","start"],["win-liv-n3","g-out",.21635,"window",1.4,"none","start"],["win-liv-e","g-out",.32933,"window",2.6,"none","start"],["win-kit-e","g-out",.44952,"window",1.2,"none","start"],["win-kit-s","g-out",.54808,"window",1.4,"none","start"],["win-off-s","g-out",.64423,"window",1.6,"none","start"],["win-wc-w","g-out",.79567,"window",.6,"none","start"],["d-hall-liv","g-w1",.15306,"door",1.6,"double","start"],["d-corr-liv","g-w1",.43878,"door",.9,"left","start"],["d-corr-off","g-w1",.65306,"door",.9,"right","end"],["p-hall-corr","g-w2",.73333,"passage",1.4,"none","start"],["d-liv-off","g-w5",.25,"door",.9,"right","start"],["d-liv-kit","g-w5",.75,"passage",1.8,"none","start"],["d-off-kit","g-w6",.51163,"door",.8,"left","end"],["d-wc","g-w7",.25,"door",.8,"right","end"],["d-util","g-w7",.75,"door",.8,"left","start"]],ce={"g-w3":.48,"g-w8":.71,"d-liv-kit":.45,"win-wc-w":.6,"win-hall":.6,"d-off-kit":.62,"p-hall-corr":.45,"win-kit-e":.75};function Re(){const e=Ae(),s=yt.map(([i,a,o,r])=>({id:i,level_id:"L0",polyline:r.map(bt),thickness_m:o,height_m:null,base_z_m:0,kind:a,confidence:1,source:"manual",locked:!1,external_ids:{}})),t=Pe.map(([i,a,o,r,l,h,p])=>i==="d-liv-kit"?{id:i,wall_id:a,t:o,kind:"door",width_m:l,height_m:2.1,sill_m:0,swing:"sliding",hinge:p,anchor_ref:null,confidence:1,source:"manual",external_ids:{}}:{id:i,wall_id:a,t:o,kind:r,width_m:l,height_m:r==="window"?1.2:2.1,sill_m:r==="window"?.9:0,swing:h,hinge:p,anchor_ref:null,confidence:1,source:"manual",external_ids:{}});return{...e,walls:s,openings:t}}function Ae(){return{schema_version:"2.0",plan_version_id:"demo-wizard",floor_id:"f0",source:{sha256:"",file_name:"תוכנית-קרקע.png",mime:"image/png",page:1},dimensions:{width_px:se,height_px:ie,scale_m_per_px:R,calibration:{status:"estimated",method:"door_width",pairs:[],residual_pct:null,reason:"לפי רוחב 9 דלתות"}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"קרקע",elevation_m:0,ceiling_height_m:2.8,is_default:!0}],walls:[],openings:[],rooms:[],objects:[],circuits:[],connectors:[],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"demo",tokens_version:"map-1",detector_version:null}}}function xt(){const s=Re().walls.map(a=>({...a,id:`auto-${a.id}`,source:"auto",confidence:ce[a.id]??.96,hollow:!1})),t=Pe.map(([a,o,r,l,h,p,u])=>({id:`auto-${a}`,wall_id:`auto-${o}`,t:r,kind:l,width_m:h,height_m:l==="window"?1.2:2.1,sill_m:l==="window"?.9:0,swing:p,hinge:u,anchor_ref:null,confidence:ce[a]??(l==="window"?.9:.92),source:"auto",external_ids:{}})),i={};for(const a of s)i[a.id]={thickness_px:a.thickness_m/R};for(const a of t)i[a.id]={width_px:a.width_m/R};return{walls:s,openings:t,objects:[],detector:{name:"plan_detect",version:"demo",params:{}},calibration_hint:{scale_m_per_px:R,status:"estimated",method:"door_width",reason:"לפי רוחב 9 דלתות",doors:9},pixels:i,scale:{m_per_px:R,status:"estimated_walls"},stats:{},version_id:"demo-wizard",level_id:"L0",existing_auto:{walls:0,openings:0}}}const $t=[["כניסה",[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]]],["חדר מדרגות",[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]]],["מסדרון",[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]]],["סלון",[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]]],["מטבח",[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]]],["חדר עבודה",[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]]],["",[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]]],["",[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]]]];function _t(){return $t.map(([e,s])=>({name:e,polygon:s.map(([t,i])=>({x:Math.round(t/R/se*1e5)/1e5,y:Math.round(i/R/ie*1e5)/1e5}))}))}const kt=[{area_id:"hall",name:"כניסה"},{area_id:"living",name:"סלון"},{area_id:"kitchen",name:"מטבח"},{area_id:"office",name:"חדר עבודה"},{area_id:"corridor",name:"מסדרון"},{area_id:"wc",name:"שירותים"},{area_id:"terrace",name:"מרפסת"}],zt=[{entity_id:"lock.front",name:"דלת כניסה",domain:"lock",device_class:null,area_id:"hall"},{entity_id:"binary_sensor.kitchen_door",name:"דלת הזזה למטבח",domain:"binary_sensor",device_class:"door",area_id:"kitchen"},{entity_id:"binary_sensor.office_door",name:"דלת חדר עבודה",domain:"binary_sensor",device_class:"door",area_id:"office"},{entity_id:"binary_sensor.motion_living",name:"תנועה בסלון",domain:"binary_sensor",device_class:"motion",area_id:"living"},{entity_id:"binary_sensor.motion_office",name:"תנועה בחדר עבודה",domain:"binary_sensor",device_class:"motion",area_id:"office"},{entity_id:"cover.living_terrace",name:"תריס מרפסת",domain:"cover",device_class:"shutter",area_id:"living"},{entity_id:"cover.office",name:"תריס חדר עבודה",domain:"cover",device_class:"shutter",area_id:"office"},{entity_id:"sensor.living_temp",name:"טמפרטורה סלון",domain:"sensor",device_class:"temperature",area_id:"living"},{entity_id:"light.living",name:"תאורת סלון",domain:"light",device_class:null,area_id:"living"},{entity_id:"light.kitchen",name:"תאורת מטבח",domain:"light",device_class:null,area_id:"kitchen"},{entity_id:"light.hall",name:"תאורת כניסה",domain:"light",device_class:null,area_id:"hall"},{entity_id:"light.office",name:"תאורת חדר עבודה",domain:"light",device_class:null,area_id:"office"},{entity_id:"light.floor_lamp",name:"מנורת רצפה סלון",domain:"light",device_class:null,area_id:null},{entity_id:"binary_sensor.smoke_corridor",name:"גלאי עשן מסדרון",domain:"binary_sensor",device_class:"smoke",area_id:null}],Mt=[{id:"demo-cam-entry",name:"מצלמת כניסה"},{id:"demo-cam-terrace",name:"מצלמת מרפסת"},{id:"demo-cam-yard",name:"מצלמת חצר"}];function P(e,s){const t=Math.round(e*100);return t>=s.auto_accept?"sure":t>=s.review_min?"check":"doubt"}function pe(e,s){return[...e.walls.map(i=>({id:i.id,kind:"wall",band:P(i.confidence,s),confidence:i.confidence})),...e.openings.map(i=>({id:i.id,kind:i.kind,band:P(i.confidence,s),confidence:i.confidence}))].filter(i=>i.band!=="sure").sort((i,a)=>i.confidence-a.confidence||(i.id<a.id?-1:i.id>a.id?1:0))}function It(e,s){const t={sure:0,check:0,doubt:0};for(const i of e.walls)t[P(i.confidence,s)]+=1;for(const i of e.openings)t[P(i.confidence,s)]+=1;return t}function St(e,s){const t=e.walls.find(a=>a.id===s);if(t)return t.kind==="railing"?"railing":"wall";const i=e.openings.find(a=>a.id===s);return i?i.kind==="door"?i.swing==="sliding"?"sliding":"door":i.kind:null}const Dt=[{id:"wall",he:n("קיר")},{id:"railing",he:n("מעקה או קיר נמוך")},{id:"none",he:n("אין כאן קיר")}],Pt=[{id:"sliding",he:n("דלת הזזה")},{id:"door",he:n("דלת רגילה")},{id:"passage",he:n("מעבר פתוח")},{id:"window",he:n("חלון")},{id:"none",he:n("אין כאן פתח")}],Rt={wall:n("קיר"),door:n("דלת"),window:n("חלון"),passage:n("מעבר פתוח")};function At(e,s){const t=e.openings.find(a=>a.id===s);return t?t.kind==="door"&&t.swing==="sliding"?n("זוהה כדלת הזזה"):t.kind==="passage"?n("זוהה כמעבר פתוח"):n("זוהה כ{kind}",{kind:Rt[t.kind]}):e.walls.find(a=>a.id===s)?.kind==="railing"?n("זוהה כמעקה"):n("זוהה כקיר")}function Ot(e,s){return s==="none"?null:s==="sliding"?e.kind==="door"&&e.swing==="sliding"?{}:{kind:"door",swing:"sliding",height_m:2.1,sill_m:0}:s==="door"?e.kind==="door"&&e.swing!=="sliding"?{}:{kind:"door",swing:"left",height_m:2.1,sill_m:0}:s==="passage"?e.kind==="passage"?{}:{kind:"passage",swing:"none",height_m:2.1,sill_m:0}:e.kind==="window"?{}:{kind:"window",swing:"none",height_m:1.2,sill_m:.9}}function Et(e,s){return s==="none"?null:s==="railing"?e.kind==="railing"?{}:{kind:"railing"}:e.kind==="railing"?{kind:"interior"}:{}}function Tt(e,s,t){const i=new Set,a={},o={byChoice:0,byDoubt:0,byPolicy:0,orphans:0},r=p=>{const u=P(p,t);return u==="sure"||u==="check"&&t.unreviewed==="as_detected"?!0:(u==="check"?o.byPolicy+=1:o.byDoubt+=1,!1)};for(const p of e.walls){const u=s[p.id];if(u===void 0){r(p.confidence)&&i.add(p.id);continue}const m=Et(p,u);if(!m){o.byChoice+=1;continue}i.add(p.id),Object.keys(m).length&&(a[p.id]=m)}for(const p of e.openings){const u=s[p.id];let m;if(u===void 0)m=r(p.confidence);else{const c=Ot(p,u);m=!!c,c?Object.keys(c).length&&(a[p.id]=c):o.byChoice+=1}if(m){if(!i.has(p.wall_id)&&s[p.wall_id]==="none"){o.orphans+=1,delete a[p.id];continue}i.add(p.id)}}const l=Qe(e,Xe(e).filter(p=>i.has(p))),h=e.objects.filter(p=>P(p.confidence,t)==="sure").map(p=>p.id);return{accepted:[...l,...h],edits:a,rejected:o}}function jt(e,s,t){let i=null;for(const a of e.walls)for(let o=1;o<a.polyline.length;o++){const r=a.polyline[o-1],l=a.polyline[o],h=Math.hypot((l[0]-r[0])*s,(l[1]-r[1])*t);(!i||h>i.px)&&(i={id:a.id,a:[r[0],r[1]],b:[l[0],l[1]],px:h})}return i}const E=[{id:"entrance",he:n("כניסה"),kind:"room",tags:["entrance"],words:["כניסה","לובי","מבואה"]},{id:"corridor",he:n("מעבר"),kind:"corridor",tags:["corridor"],words:["מסדרון","מעבר","פרוזדור"]},{id:"living",he:n("סלון"),kind:"room",tags:["living"],words:["סלון","מגורים","אירוח"]},{id:"kitchen",he:n("מטבח"),kind:"room",tags:["kitchen"],words:["מטבח","מטבחון","פינת אוכל"]},{id:"bedroom",he:n("חדר שינה"),kind:"room",tags:["bedroom"],words:["שינה","הורים","ילדים"]},{id:"office",he:n("חדר עבודה"),kind:"room",tags:["office"],words:["עבודה","משרד","מחשב"]},{id:"meeting",he:n("חדר ישיבות"),kind:"room",tags:["meeting"],words:["ישיבות","כנסים"]},{id:"wc",he:n("שירותים"),kind:"room",tags:["wc"],words:["שירותים","אורחים"]},{id:"bath",he:n("אמבטיה"),kind:"room",tags:["bath"],words:["אמבטיה","מקלחת","רחצה"]},{id:"stairs",he:n("חדר מדרגות"),kind:"corridor",tags:["stairs"],words:["מדרגות"]},{id:"service",he:n("חדר שירות"),kind:"service",tags:["service"],words:["שירות","כביסה"]},{id:"storage",he:n("מחסן"),kind:"service",tags:["storage"],words:["מחסן","אחסון"]},{id:"technical",he:n("חדר טכני"),kind:"service",tags:["technical"],words:["טכני","שרתים","חשמל","תקשורת"]},{id:"balcony",he:n("מרפסת"),kind:"outdoor",tags:["balcony"],words:["מרפסת"]},{id:"parking",he:n("חניה"),kind:"outdoor",tags:["parking"],words:["חניה","חנייה","חניון"]},{id:"other",he:n("אחר"),kind:"zone",tags:[],words:[]}],X=e=>E.find(s=>s.id===e)??E[E.length-1];function q(e){const s=e.trim();if(!s)return null;for(const t of E)if(t.words.some(i=>s.includes(i)))return t.id;return null}const N=e=>`חדר ${e+1}`;function ae(e){let s=0,t=0,i=0;for(let a=0,o=e.length-1;a<e.length;o=a++){const r=e[o].x*e[a].y-e[a].x*e[o].y;s+=r,t+=(e[o].x+e[a].x)*r,i+=(e[o].y+e[a].y)*r}if(Math.abs(s)<1e-12){const a=Math.max(1,e.length);return{x:e.reduce((o,r)=>o+r.x,0)/a,y:e.reduce((o,r)=>o+r.y,0)/a}}return{x:t/(3*s),y:i/(3*s)}}const B=[{id:"apartment",he:A.apartment,note:n("פרקט, קירות בהירים, ריהוט בית"),level:"oak",floors:{default:"oak",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",service:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",parking:"asphalt"},furniture:{living:["sofa.3","table.side"],kitchen:["table.dining"],bedroom:["wardrobe"],office:["table.desk","chair.office"],meeting:["table.meeting"],wc:["toilet.standard"],bath:["bathtub","sink.bathroom"],entrance:["coat.rack"]}},{id:"office",he:A.office,note:n("שטיח, שולחנות עבודה, חדרי ישיבות"),level:"carpet",floors:{default:"carpet",entrance:"tiles_grey",corridor:"tiles_grey",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt"},furniture:{office:["table.desk","chair.office"],living:["sofa.2","table.side"],meeting:["table.meeting"],kitchen:["table.round"],wc:["toilet.standard"],bath:["sink.bathroom"],entrance:["bench.indoor"],technical:["rack.server"]}},{id:"lobby",he:A.lobby,note:n("אבן, עמדת קבלה, ישיבה"),level:"tiles_grey",floors:{default:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt",office:"carpet"},furniture:{entrance:["counter.reception"],living:["sofa.2","armchair","table.side"],corridor:["bench.indoor"],meeting:["table.meeting"],office:["table.desk","chair.office"],kitchen:["table.round"],wc:["toilet.standard"]}},{id:"technical",he:A.technical,note:n("בטון, סימוני רצפה, בלי ריהוט"),level:"concrete",floors:{default:"concrete",parking:"asphalt",wc:"tiles_grey",bath:"tiles_grey"},furniture:{parking:["parking.space","parking.space"],technical:["rack.server"]}},{id:"commercial",he:A.commercial,note:n("אריחים, מדפים, דלפק"),level:"tiles_grey",floors:{default:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt",office:"carpet"},furniture:{entrance:["counter.straight"],living:["shelf.unit","shelf.unit","shelf.unit"],other:["shelf.unit","shelf.unit","shelf.unit"],storage:["rack.pallet"],office:["table.desk","chair.office"],kitchen:["table.round"],wc:["toilet.standard"]}},{id:"empty",he:A.empty,note:n("חומרים בלבד, בלי ריהוט"),level:"concrete",floors:{default:"concrete",parking:"asphalt"},furniture:{}}],Q=e=>B.find(s=>s.id===e)??B[0],W=(e,s)=>e.floors[s]??e.floors.default,V={"sofa.3":{w_m:2.1,d_m:.9,h_m:.85},"sofa.2":{w_m:1.6,d_m:.9,h_m:.85},"table.side":{w_m:.5,d_m:.5,h_m:.5},"table.dining":{w_m:1.6,d_m:.9,h_m:.75},"table.round":{w_m:1.2,d_m:1.2,h_m:.75},wardrobe:{w_m:1.5,d_m:.6,h_m:2.2},"table.desk":{w_m:1.4,d_m:.7,h_m:.75},"chair.office":{w_m:.6,d_m:.6,h_m:1.1},"table.meeting":{w_m:3,d_m:1.2,h_m:.75},"toilet.standard":{w_m:.4,d_m:.7,h_m:.8},bathtub:{w_m:1.7,d_m:.75,h_m:.6},"sink.bathroom":{w_m:.6,d_m:.45,h_m:.85},"coat.rack":{w_m:.4,d_m:.4,h_m:1.8},"bench.indoor":{w_m:1.8,d_m:.4,h_m:.45},"rack.server":{w_m:.6,d_m:1,h_m:2},"counter.reception":{w_m:3,d_m:.8,h_m:1.1},armchair:{w_m:.85,d_m:.85,h_m:.8},"counter.straight":{w_m:2,d_m:.6,h_m:1.1},"shelf.unit":{w_m:.9,d_m:.4,h_m:2},"rack.pallet":{w_m:2.7,d_m:1.1,h_m:3},"parking.space":{w_m:2.5,d_m:5,h_m:.05}},he="plan-wizard";function Ct(e,s,t,i,a){const o=e.levels.find(u=>u.is_default)??e.levels[0];let r={...e,objects:e.objects.filter(u=>!u.tags?.includes(he))};o&&(r={...r,levels:r.levels.map(u=>u.id===o.id?{...u,floor_material_id:t.level}:u)});const l=e.dimensions.width_px||1e3,h=e.dimensions.height_px||1e3,p=[];for(const u of s){const m=X(u.typeId);if(r.rooms.some(_=>_.id===u.id)?r={...r,rooms:r.rooms.map(_=>_.id===u.id?{..._,tags:m.tags}:_)}:r={...r,rooms:[...r.rooms,{id:u.id,level_id:u.level_id??o?.id??null,tags:m.tags}]},r=st(r,"rooms",u.id,"floor_material_id",W(t,m.id)),!i)continue;const c=(t.furniture[m.id]??[]).filter(_=>V[_]);if(!c.length||u.polygon.length<3)continue;const x=u.polygon.map(_=>_.x),y=u.polygon.map(_=>_.y),z=(Math.max(...x)-Math.min(...x))*l*a,I=(Math.max(...y)-Math.min(...y))*h*a,S=ae(u.polygon),$=c.reduce((_,Z)=>_+V[Z].w_m,0)+.3*(c.length-1),K=Math.max(...c.map(_=>V[_].d_m));if($+.6>z||K+.6>I)continue;let ne=-$/2;c.forEach((_,Z)=>{const H=V[_],Ee=ne+H.w_m/2;ne+=H.w_m+.3,p.push({id:`wz-${u.id}-${Z}`.slice(0,64),item_id:_,level_id:u.level_id??o?.id??"L0",position:[T(S.x+Ee/(l*a)),T(S.y)],rotation_deg:0,size:{...H},z_m:0,params:{},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{},tags:[he]})})}return it({...r,objects:[...r.objects,...p]})}const T=e=>Math.round(Math.min(1,Math.max(0,e))*1e5)/1e5,Ft=new Set(["door","garage_door","opening"]),Lt=new Set(["window"]);function qt(e){return e.domain==="lock"?"door":e.domain==="cover"?e.device_class==="garage"||e.device_class==="door"||e.device_class==="gate"?"door":"window":e.domain==="binary_sensor"&&e.device_class&&Ft.has(e.device_class)?"door":e.domain==="binary_sensor"&&e.device_class&&Lt.has(e.device_class)?"window":null}function Nt(e,s){let t=!1;for(let i=0,a=s.length-1;i<s.length;a=i++){const o=s[i],r=s[a];o.y>e.y!=r.y>e.y&&e.x<(r.x-o.x)*(e.y-o.y)/(r.y-o.y)+o.x&&(t=!t)}return t}function Vt(e,s,t,i=!0){const a=new Set,o=new Map;return e.map(r=>{const l=r.area_id?s.find(x=>x.area_id===r.area_id):void 0;if(!l||!i)return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:l?.name??null,x:null,y:null,where:"manual"};const h=ae(l.polygon),p=qt(r);if(p){const x=t.filter(y=>y.kind===p&&!a.has(y.id)&&Nt(ue(y,h,.04),l.polygon)).sort((y,z)=>Math.hypot(y.x-h.x,y.y-h.y)-Math.hypot(z.x-h.x,z.y-h.y))[0];if(x){a.add(x.id);const y=ue(x,h,.06);return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:l.name,x:y.x,y:y.y,where:p}}}const u=o.get(l.id)??0;o.set(l.id,u+1);const m=u*2.399963,c=u===0?0:.028*Math.sqrt(u);return{entity_id:r.entity_id,name:r.name,domain:r.domain,room:l.name,x:T(h.x+c*Math.cos(m)),y:T(h.y+c*Math.sin(m)),where:"centre"}})}function ue(e,s,t){return{x:T(e.x+(s.x-e.x)*t),y:T(e.y+(s.y-e.y)*t)}}function Wt(e){return e.map(s=>({entity_id:s.id,name:s.name,domain:"camera",resource:"camera",room:null,x:null,y:null,where:"manual"}))}const D=e=>e.resource==="camera",me={door:n("ליד הדלת שזוהתה"),window:n("ליד החלון שזוהה"),centre:n("מרכז החדר"),manual:n("בחר ולחץ על המפה"),none:n("לא יוצב")},Ut=n("הוצבה במקום שסימנת");function Bt(e){return E.find(t=>t.tags.length&&t.tags.every(i=>e?.includes(i)))?.id??"other"}const C="#1b1f27",v=e=>Math.round(e*10)/10,Oe=e=>e.map(s=>`${v(s[0])},${v(s[1])}`).join(" ");function Gt(e){let s="";for(const t of e)if(t.kind==="wall")s+=`<polyline points="${Oe(t.points)}" fill="none" stroke="${C}" stroke-width="${v(Math.max(3,t.width))}" stroke-linejoin="miter" stroke-linecap="butt"/>`;else if(t.kind==="door"){for(const i of t.leaves)s+=`<line x1="${v(i[0][0])}" y1="${v(i[0][1])}" x2="${v(i[1][0])}" y2="${v(i[1][1])}" stroke="${C}" stroke-width="2"/>`;for(const i of t.arcs)s+=`<path d="M${v(i.from[0])},${v(i.from[1])} A${v(i.r)},${v(i.r)} 0 0 ${i.sweep} ${v(i.to[0])},${v(i.to[1])}" fill="none" stroke="${C}" stroke-width="1.3"/>`}else if(t.kind==="window")for(const i of t.lines)s+=`<line x1="${v(i[0][0])}" y1="${v(i[0][1])}" x2="${v(i[1][0])}" y2="${v(i[1][1])}" stroke="${C}" stroke-width="1.5"/>`;return s}function Kt(e){const s=e.dimensions.width_px,t=e.dimensions.height_px,i=`<g stroke="${C}" stroke-width="1.2" fill="none"><path d="M42,20H958M42,12v16M958,12v16M292,12v16M20,42V858M12,42h16M12,858h16"/><path d="M0,470H${s}" stroke-dasharray="14 8 3 8"/><rect x="${s-250}" y="${t-40}" width="236" height="34"/></g>`,a=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${t}" width="${s}" height="${t}"><rect width="${s}" height="${t}" fill="#ffffff"/>${i}${Gt(De(e,s,t))}</svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(a)}`}const O={sure:"var(--wz-sure)",check:"var(--wz-check)",doubt:"var(--wz-doubt)"};function fe(e,s){const t=e.dimensions.width_px,i=e.dimensions.height_px,a=new Map,o=new Map;for(const r of De(Je(e,s),t,i))r.kind==="wall"?a.set(r.id,[...a.get(r.id)??[],r.points]):(r.kind==="door"||r.kind==="window"||r.kind==="passage")&&o.set(r.id,r.gap);return{walls:a,gaps:o}}function J(e,s){const t=e.gaps.get(s);if(t)return[(t[0][0]+t[1][0])/2,(t[0][1]+t[1][1])/2];const i=e.walls.get(s);if(!i?.length)return null;const a=[...i].sort((o,r)=>ge(r)-ge(o))[0];return a.length>=2?[(a[0][0]+a[a.length-1][0])/2,(a[0][1]+a[a.length-1][1])/2]:a[0]}const ge=e=>e.slice(1).reduce((s,t,i)=>s+Math.hypot(t[0]-e[i][0],t[1]-e[i][1]),0);function we(e,s,t,i,a,o){const r=new Map([...s.walls.map(m=>[m.id,m.confidence]),...s.openings.map(m=>[m.id,m.confidence])]),l=m=>i.has(m)?"sure":P(r.get(m)??1,t),h=[...e.walls.entries()].map(([m,c])=>{const x=l(m),y=a.has(m);return c.map(z=>k`<polyline data-cand=${m} points=${Oe(z)} fill="none" stroke=${y?"var(--wz-out)":O[x]} stroke-width="7" stroke-linecap="round" stroke-dasharray=${x==="doubt"&&!y?"10 9":y?"3 8":"none"} opacity=".85"/>`)}),p=[...e.gaps.entries()].map(([m,[c,x]])=>{const y=l(m),z=a.has(m),I=[(c[0]+x[0])/2,(c[1]+x[1])/2],S=o===m;return k`<line data-cand=${m} x1=${v(c[0])} y1=${v(c[1])} x2=${v(x[0])} y2=${v(x[1])} stroke=${z?"var(--wz-out)":O[y]} stroke-width="9" stroke-linecap="round" stroke-dasharray=${y==="doubt"&&!z?"3 12":"none"} opacity=".95"/>
      ${y!=="sure"||S?k`<circle data-cand=${m} cx=${v(I[0])} cy=${v(I[1])} r=${S?46:26} fill=${O[y]} fill-opacity=${S?.16:.1} stroke=${O[y]} stroke-width=${S?4:2}/>`:b}`}),u=o&&e.walls.has(o)?J(e,o):null;return k`<g class="ov">${h}${p}${u?k`<circle cx=${v(u[0])} cy=${v(u[1])} r="46" fill=${O[l(o)]} fill-opacity=".14" stroke=${O[l(o)]} stroke-width="4"/>`:b}</g>`}const ve=["#7aa7ff","#b99cf0","#8fd0c8","#f5c26b","#f09a8a","#9ccf7f","#e8a3d3","#b8bfcc","#7fc4e8","#d9b48f","#a3b8f0","#c9d97f"],ee=e=>ve[e%ve.length];function be(e,s,t,i,a){return k`<g class="rooms">${e.map((o,r)=>{const l=ae(o.polygon),h=o.polygon.map(p=>`${v(p.x*s)},${v(p.y*t)}`).join(" ");return k`<polygon data-room=${r} points=${h} fill=${ee(r)} fill-opacity=${i==="name"?a===r?.62:.42:.16} stroke=${a===r?"var(--sw-accent)":"none"} stroke-width="4"/>
      ${i==="name"?k`<g data-room=${r}><circle cx=${v(l.x*s)} cy=${v(l.y*t)} r="24" fill="#fff" stroke=${ee(r)} stroke-width="3"/><text x=${v(l.x*s)} y=${v(l.y*t+8)} text-anchor="middle" font-size="24" font-weight="700" fill="#1e2e47">${r+1}</text></g>`:b}`})}</g>`}function Zt(e,s,t,i){return k`<g class="devs">${e.filter(a=>a.x!==null&&a.y!==null).map(a=>{const o=v(a.x*s),r=v(a.y*t),l=a.entity_id===i,h=a.where==="manual"?"var(--wz-check)":"var(--wz-sure)",p=a.resource==="camera"?k`<rect x=${v(a.x*s-15)} y=${v(a.y*t-15)} width="30" height="30" rx="7" fill=${h} stroke="#fff" stroke-width="4"/>`:k`<circle cx=${o} cy=${r} r="15" fill=${h} stroke="#fff" stroke-width="4"/>`;return k`<g data-dev=${a.entity_id} data-dev-kind=${a.resource??"ha_entity"}>${l?k`<circle cx=${o} cy=${r} r="30" fill="var(--sw-accent)" fill-opacity=".16" stroke="var(--sw-accent)" stroke-width="3"/>`:b}${p}</g>`})}</g>`}const ye="אשף תוכנית חדשה",xe="plan.wizard";class Ht{constructor(s){this.floorId=s,this.demo=!1}async prefs(){try{const s=await Ce("me/prefs");return U(s.prefs[xe])}catch{return U(null)}}async savePrefs(s){await Fe("me/prefs",{[xe]:s})}async upload(s){const t=await Le(this.floorId,s);return{assetId:t.id,name:t.original_name,pages:t.pages.map(i=>({page:i.page,url:Se(i.preview_url)}))}}async createVersion(s,t){const i=await qe(this.floorId,{asset_id:s,page:t,rotation:0,crop:null,notes:ye});return $e(i)}async draft(s){const t=await rt(s,{draft:!0});return{doc:t.doc,revision:t.geometry.revision}}detect(s){return ot(s,{targets:["walls","openings"]})}async estimate(s,t){await lt(s,t.scale_m_per_px,t.reason)}async measure(s,t,i,a){return(await dt(s,[{a:t,b:i,metres:a}])).scale_m_per_px}async accept(s,t){const i=await ct(s,t);return{doc:i.doc,revision:i.geometry.revision}}async detectRooms(){const s=await ht(this.floorId,"medium");return{rooms:s.rooms.map(t=>({polygon:t.polygon,name:""})),existingAuto:s.existing_auto}}async acceptRooms(s,t,i){for(const r of i)await de(r).catch(()=>{});const a=await ut(this.floorId,s,t),o=new Set(a.created);return a.created.map(r=>a.zones.find(l=>l.id===r)).filter(r=>!!r&&o.has(r.id)).map(r=>({id:r.id,revision:r.revision,polygon:r.polygon,level_id:r.level_id??null}))}async tagRoom(s,t,i){await mt(s.id,{revision:s.revision,tags:t,...i?{area_id:i}:{}})}async areas(){return(await re({limit:1})).areas.filter(t=>t.area_name).map(t=>({area_id:t.area_id,name:t.area_name}))}async saveDraft(s,t,i){const a=await pt(s,t,i);return{doc:a.doc,revision:a.geometry.revision}}async entities(){return(await re({placed:!1,limit:300})).entities.filter(t=>!t.disabled&&!t.hidden&&t.area_id).map(t=>({entity_id:t.entity_id,name:t.name||t.original_name||t.entity_id,domain:t.domain,device_class:t.device_class,area_id:t.area_id}))}async catalog(){try{const s=await gt();return{lookup3d:vt(s),materials:wt(s)}}catch{return{lookup3d:null,materials:null}}}async cameras(){const s=await Ne(this.floorId,!0),t=new Set(s.anchors.filter(i=>i.resource_type==="camera").map(i=>i.resource_id));return(s.cameras??[]).filter(i=>!t.has(i.id)).map(i=>({id:i.id,name:i.name||i.id}))}async publish(s,t){if(await Ve(s),!t.length)return{placed:0,failed:0,refused:[]};if((await oe(this.floorId).then(r=>r.versions.filter(l=>l.status==="draft"&&l.id!==s)).catch(()=>[])).length)return{placed:0,failed:t.length,refused:t.map(r=>({id:r.entity_id,code:"other_draft"})),blocked:"other_draft"};let a=0;const o=[];for(const r of t)try{await We(this.floorId,{resource_type:r.resource_type??"ha_entity",resource_id:r.entity_id,x:r.x,y:r.y,level_id:r.level_id}),a+=1}catch(l){o.push({id:r.entity_id,code:l instanceof F?l.code:"error"})}return{placed:a,failed:o.length,refused:o}}async resumable(){const t=(await oe(this.floorId)).versions.filter(i=>i.status==="draft").sort((i,a)=>i.created_at<a.created_at?1:-1)[0];return t&&t.notes===ye?{version:$e(t),createdAt:t.created_at}:null}async resumeRooms(s){return(await ft(this.floorId)).zones.filter(i=>i.plan_version_id===s&&i.source==="auto").map(i=>({id:i.id,revision:i.revision,polygon:i.polygon,level_id:i.level_id??null,name:i.name,tags:i.tags??[]}))}async discard(s,t){for(const i of t)await de(i).catch(a=>{if(!(a instanceof F&&a.status===404))throw a});await Ue(s)}}function $e(e){const s=e.image_url??"";return{versionId:e.id,imageUrl:s?Se(s):"",width:e.width_px,height:e.height_px}}class G{constructor(s=!1){this.resume=s,this.demo=!0,this.doc=Ae(),this.revision=0,this.wait=t=>new Promise(i=>setTimeout(i,t))}static{this.prefsMem=null}async prefs(){return U(G.prefsMem)}async savePrefs(s){G.prefsMem={...s}}async upload(s){return await this.wait(150),{assetId:"demo-asset",name:s.name,pages:[{page:1,url:""}]}}async createVersion(){return{versionId:"demo-wizard",imageUrl:Kt(Re()),width:this.doc.dimensions.width_px,height:this.doc.dimensions.height_px}}async draft(){return{doc:this.doc,revision:this.revision}}async detect(){return await this.wait(900),xt()}async estimate(){}async measure(s,t,i,a){const o=Math.hypot((i[0]-t[0])*this.doc.dimensions.width_px,(i[1]-t[1])*this.doc.dimensions.height_px),r=a/Math.max(1,o);return this.doc={...this.doc,dimensions:{...this.doc.dimensions,scale_m_per_px:r,calibration:{status:"measured",method:"two_point",pairs:[{a:t,b:i,metres:a}],residual_pct:null,reason:null}}},r}async accept(s,t){const i=new Set(t.accepted),a=t.edits;return this.doc={...this.doc,walls:t.candidates.walls.filter(o=>i.has(o.id)).map(o=>({...o,...a[o.id]??{}})),openings:t.candidates.openings.filter(o=>i.has(o.id)).map(o=>({...o,...a[o.id]??{}})),objects:[...this.doc.objects.filter(o=>o.source!=="auto"),...(t.candidates.objects??[]).filter(o=>i.has(o.id))]},this.revision+=1,{doc:this.doc,revision:this.revision}}async detectRooms(){return await this.wait(200),{rooms:_t(),existingAuto:0}}async acceptRooms(s){return s.map((t,i)=>({id:`demo-room-${i+1}`,revision:1,polygon:t.polygon,level_id:"L0"}))}async tagRoom(){}async areas(){return kt}async saveDraft(s,t){return this.doc=t,this.revision+=1,{doc:this.doc,revision:this.revision}}async entities(){return zt}async catalog(){return{lookup3d:null,materials:null}}async cameras(){return Mt}async publish(s,t){return await this.wait(300),{placed:t.length,failed:0,refused:[]}}async resumable(){return this.resume?{version:await this.createVersion(),createdAt:"2026-11-12T08:30:00Z"}:null}async resumeRooms(){return[]}async discard(){await this.wait(100)}}function Yt(e,s=!1){return je()?new Ht(e):new G(s)}const Qt=Be`
  :host {
    display: block;
    position: relative;
    --wz-paper: #fff; /* COLOR-LITERAL-B-2480: the white plan paper and crop field (two rules) */
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
    background: var(--wz-paper);
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
    background: var(--wz-paper);
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
    /* PLAN3D-R32-ANSWERS-2438: six kits - two columns where the panel holds them, so the step does not scroll */
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
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
    min-block-size: 56px;
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
  /* CR-CMP2-TABS-2460: the devices / cameras strip is sw-tabs (pill, filling the side panel) - its .seg rules are gone */
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
    .pager button {
      transition: none;
    }
  }
`;var Xt=Object.defineProperty,Jt=Object.getOwnPropertyDescriptor,g=(e,s,t,i)=>{for(var a=i>1?void 0:i?Jt(s,t):s,o=e.length-1,r;o>=0;o--)(r=e[o])&&(a=(i?r(s,t,a):r(a))||a);return i&&a&&Xt(s,t,a),a};const _e=[n("העלאה"),n("זיהוי"),n("בדיקה"),n("חדרים"),n("סגנון"),n("התקנים"),n("סיום")],ke=8,ze=4,es=7,ts=4,ss={forbidden:n("אין הרשאה"),already_placed:n("כבר הוצב"),validation:n("לא קיים"),not_placeable:n("לא ניתן להצבה")},Me=e=>{try{return new Date(e).toLocaleString(He(),{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}},Ie=(e,s)=>{const t=nt.find(i=>i.id===e);return t?.tint?s?t.tint.dark:t.tint.light:"#cccccc"},is=e=>e==="light"?"light":e==="lock"?"lock":e==="cover"?"coverClose":e==="camera"?"camera":e==="sensor"?"thermometer":"sensor";let f=class extends Ge{constructor(){super(...arguments),this.floorId="",this.demoStep=0,this.demoResume=!1,this.step=1,this.prefs={...Y},this.prefsOpen=!1,this.prefsDraft={...Y},this.floor=null,this.ceiling=2.8,this.busy=!1,this.error="",this.dragOver=!1,this.uploaded=null,this.page=1,this.version=null,this.versionPage=1,this.resumeInfo=null,this.replace=null,this.phases={structure:"idle",rooms:"idle"},this.elapsed=0,this.result=null,this.set=null,this.draft=null,this.decisions={},this.current=null,this.measure={open:!1,metres:""},this.rooms=[],this.roomsPage=0,this.roomFocus=null,this.existingAuto=0,this.replaceAuto=!1,this.areas=[],this.created=[],this.kit="apartment",this.furniture=!0,this.catalog={lookup3d:null,materials:null},this.three="idle",this.placements=[],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices",this.done=null,this.backend=null,this.token=0,this.small=!1,this.mq=null,this.onMq=()=>{this.small=!!this.mq?.matches,this.requestUpdate()},this.onKey=e=>this.key(e),this.sceneMemo={key:"",desc:null},this.geomMemo=null}connectedCallback(){super.connectedCallback();try{this.mq=window.matchMedia("(max-width: 767px), (max-height: 760px)"),this.small=this.mq.matches,this.mq.addEventListener("change",this.onMq)}catch{this.mq=null}window.addEventListener("keydown",this.onKey),this.init()}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.removeEventListener("keydown",this.onKey),clearInterval(this.timer),this.token++}willUpdate(e){e.has("floorId")&&e.get("floorId")!==void 0&&this.init()}async init(){const e=++this.token;this.backend=Yt(this.floorId,this.demoResume);const s=this.backend;try{const[t,i]=await Promise.all([s.prefs(),Ke()]);if(e!==this.token)return;this.prefs=t,this.kit=t.kit,this.furniture=t.furniture&&t.kit!=="empty";const a=Ze(i,this.floorId);if(a?this.floor={name:a.floor.name,crumb:`${a.site.name} · ${a.building.name}`,hasPlan:a.floor.has_plan,siblings:(a.building.floors??[]).map(o=>({id:o.id,name:o.name}))}:this.floor={name:"",crumb:"",hasPlan:!1,siblings:[]},!(s.demo&&this.demoStep>1)){const o=await s.resumable().catch(()=>null);e===this.token&&!this.version&&(this.resumeInfo=o)}}catch(t){e===this.token&&(this.error=M(t))}s.demo&&this.demoStep>1&&await this.demoTo(Math.min(7,this.demoStep),e)}async demoTo(e,s){await this.onFile(new File(["demo"],"תוכנית-קרקע.png",{type:"image/png"}),e===2),!(s!==this.token||e<=3)&&(await this.confirmReview(),!(s!==this.token||e<=4)&&(await this.saveRooms(),!(s!==this.token||e<=5)&&(await this.saveStyle(),!(s!==this.token||e<=6)&&(this.step=7))))}get ownDraft(){return this.version?.versionId??this.resumeInfo?.version.versionId??null}async onFile(e,s=!1){const t=this.backend;if(!(!e||!t||this.busy)){if(this.ownDraft){this.replace={kind:"file",file:e};return}this.busy=!0,this.error="";try{if(this.uploaded=await t.upload(e),this.page=1,this.uploaded.pages.length>1)return;await this.startVersion(s)}catch(i){this.error=M(i)}finally{this.busy=!1}}}async startVersion(e=!1){const s=this.backend;!s||!this.uploaded||(this.version=await s.createVersion(this.uploaded.assetId,this.page),this.versionPage=this.page,this.step=2,await this.runDetect(e))}reuseVersion(){this.busy||!this.version||(this.step=2,this.runDetect())}async confirmReplace(){const e=this.backend,s=this.replace,t=this.ownDraft;if(!(!e||!s||!t||this.busy)){this.busy=!0,this.error="";try{const i=this.version?this.created.map(a=>a.id):(await e.resumeRooms(t)).map(a=>a.id);await e.discard(t,i),this.version=null,this.resumeInfo=null,this.created=[],this.rooms=[],this.set=null,this.result=null,this.draft=null,this.replace=null}catch(i){this.replace=null,this.error=n("הטיוטה הקודמת לא נמחקה, ולכן התוכנית החדשה לא הועלתה: {error}",{error:M(i)});return}finally{this.busy=!1}s.kind==="file"?await this.onFile(s.file):await this.pickPage()}}async resumeWizard(){const e=this.backend,s=this.resumeInfo;if(!e||!s||this.busy)return;this.busy=!0,this.error="";const t=this.token;try{this.version=s.version,this.uploaded={assetId:"",name:n("התוכנית מהטיוטה"),pages:[{page:1,url:""}]},this.resumeInfo=null;const i=await e.draft(s.version.versionId);if(t!==this.token)return;if(this.draft=i,!i.doc.walls.length){this.busy=!1,this.step=2,await this.runDetect();return}const a=await e.resumeRooms(s.version.versionId);if(t!==this.token)return;if(a.length)this.created=a.map(({id:o,revision:r,polygon:l,level_id:h})=>({id:o,revision:r,polygon:l,level_id:h})),this.rooms=a.map(o=>({polygon:o.polygon,name:o.name,typeId:Bt(o.tags)}));else{const o=await e.detectRooms().catch(()=>({rooms:[],existingAuto:0}));this.rooms=o.rooms.map(r=>({polygon:r.polygon,name:r.name,typeId:q(r.name)??"other"})),this.existingAuto=o.existingAuto}this.phases={structure:"done",rooms:"done"},this.areas=await e.areas().catch(()=>[]),this.roomsPage=0,this.step=4}catch(i){this.error=M(i)}finally{this.busy=!1}}async pickPage(){if(!this.busy){this.busy=!0,this.error="";try{await this.startVersion()}catch(e){this.error=M(e)}finally{this.busy=!1}}}async runDetect(e=!1){const s=this.backend,t=this.version;if(!s||!t)return;const i=this.token;this.error="",this.phases={structure:"run",rooms:"idle"};const a=Date.now();if(this.elapsed=0,clearInterval(this.timer),this.timer=window.setInterval(()=>this.elapsed=Math.floor((Date.now()-a)/1e3),1e3),e){clearInterval(this.timer);return}try{const[o,r]=await Promise.all([s.draft(t.versionId),s.detect(t.versionId)]);if(i!==this.token)return;this.draft=o,this.result=r,this.set=this.scaled(et(r),o.doc),this.phases={structure:"done",rooms:"run"},this.decisions={},this.current=pe(this.set,this.prefs)[0]?.id??null;try{const l=await s.detectRooms();if(i!==this.token)return;this.rooms=l.rooms.map(h=>({polygon:h.polygon,name:h.name,typeId:q(h.name)??"other"})),this.existingAuto=l.existingAuto,this.phases={structure:"done",rooms:"done"}}catch{this.rooms=[],this.phases={structure:"done",rooms:"error"}}this.step=3}catch(o){if(i!==this.token)return;const r=o instanceof F&&o.code==="detect_timeout";this.error=r?n("הזיהוי לא הסתיים בזמן. תוכנית גדולה או סריקה רועשת לוקחות זמן: נסה שוב, או המשך בסטודיו התוכניות."):M(o),this.phases={...this.phases,structure:"error"}}finally{clearInterval(this.timer)}}scaled(e,s){const{scale:t}=le(s);return e.scaleMPerPx===null||Math.abs(e.scaleMPerPx-t)>t*1e-6?tt(e,t):e}get queue(){return this.set?pe(this.set,this.prefs):[]}decide(e){const s=this.current;if(!s)return;this.decisions={...this.decisions,[s]:e};const t=this.queue,i=t.findIndex(o=>o.id===s),a=t.slice(i+1).find(o=>!(o.id in this.decisions))??t.find(o=>!(o.id in this.decisions));a&&(this.current=a.id)}moveQueue(e){const s=this.queue;if(!s.length)return;const t=s.findIndex(i=>i.id===this.current);this.current=s[Math.max(0,Math.min(s.length-1,(t<0?0:t)+e))].id}async measureWall(){const e=this.backend,s=this.version,t=this.set,i=parseFloat(this.measure.metres.replace(",","."));if(!e||!s||!t||!this.draft||!(i>0)||this.busy)return;const a=jt(t,this.draft.doc.dimensions.width_px,this.draft.doc.dimensions.height_px);if(a){this.busy=!0,this.error="";try{await e.measure(s.versionId,a.a,a.b,i),this.draft=await e.draft(s.versionId),this.set=this.scaled(t,this.draft.doc),this.measure={open:!1,metres:""}}catch(o){this.error=M(o)}finally{this.busy=!1}}}async confirmReview(){const e=this.backend,s=this.version,t=this.result;if(!(!e||!s||!t||!this.set||this.busy)){this.busy=!0,this.error="";try{let i=await e.draft(s.versionId);const a=i.doc.dimensions.calibration?.status;a!=="measured"&&a!=="estimated"&&t.calibration_hint&&(await e.estimate(s.versionId,t.calibration_hint),i=await e.draft(s.versionId));const o=this.scaled(this.set,i.doc),r=Tt(o,this.decisions,this.prefs);this.draft=await e.accept(s.versionId,{accepted:r.accepted,edits:r.edits,replace_auto:!0,candidates:{walls:o.walls,openings:o.openings,objects:o.objects},base_revision:i.revision,detector:t.detector}),this.set=o,this.step=4,this.roomsPage=0,this.areas.length||(this.areas=await e.areas().catch(()=>[]))}catch(i){this.error=i instanceof F&&i.code==="stale_revision"?n("טיוטת המבנה השתנתה בינתיים בחלון אחר. אשר שוב."):M(i)}finally{this.busy=!1}}}areaOf(e){const s=e.trim();return s?this.areas.find(t=>t.name===s)?.area_id??null:null}setRoom(e,s){this.rooms=this.rooms.map((t,i)=>{if(i!==e)return t;const a={...t,...s};return s.name!==void 0&&(t.typeId==="other"||t.typeId===q(t.name))&&(a.typeId=q(s.name)??t.typeId),a})}async saveRooms(){const e=this.backend;if(!(!e||this.busy)){if(!this.rooms.length){this.created=[],this.step=5;return}this.busy=!0,this.error="";try{const s=this.rooms.map((i,a)=>({polygon:i.polygon,name:i.name.trim()||N(a),kind:X(i.typeId).kind})),t=await e.acceptRooms(s,this.replaceAuto,this.created.map(i=>i.id));for(let i=0;i<t.length;i++)await e.tagRoom(t[i],X(this.rooms[i]?.typeId).tags,this.areaOf(this.rooms[i]?.name??""));this.created=t,this.step=5,this.loadThree()}catch(s){this.error=M(s)}finally{this.busy=!1}}}async loadThree(){if(!(this.three!=="idle"||!this.backend)){this.three="loading";try{const[,e]=await Promise.all([Te(()=>import("./sw-plan-3d-igSau6sx.js").then(s=>s.s),__vite__mapDeps([0]),import.meta.url),this.backend.catalog()]);this.catalog=e,this.three="ready"}catch{this.three="failed"}}}styledRooms(){return this.created.map((e,s)=>({id:e.id,typeId:this.rooms[s]?.typeId??"other",polygon:e.polygon,level_id:e.level_id}))}styledDoc(){const e=this.draft?.doc;if(!e)return null;const s={...e,levels:e.levels.map(t=>t.is_default||e.levels.length===1?{...t,ceiling_height_m:this.ceiling}:t)};return Ct(s,this.styledRooms(),Q(this.kit),this.furniture&&this.kit!=="empty",le(e).scale)}scene(){const e=this.styledDoc();if(!e||this.three!=="ready")return null;const s=`${this.draft?.revision}|${this.kit}|${this.furniture}|${this.ceiling}|${this.created.map(i=>i.id).join(",")}`;if(this.sceneMemo.key===s)return this.sceneMemo.desc;let t=null;try{t=at({doc:e,width:e.dimensions.width_px,height:e.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},catalog:this.catalog.lookup3d,materialsCatalog:this.catalog.materials,realistic:!0,zones:this.created.map((i,a)=>({id:i.id,name:this.rooms[a]?.name||N(a),polygon:i.polygon,level_id:i.level_id}))})}catch{t=null}return this.sceneMemo={key:s,desc:t},t}async saveStyle(){const e=this.backend,s=this.version,t=this.styledDoc();if(!(!e||!s||!t||!this.draft||this.busy)){this.busy=!0,this.error="";try{this.draft=await e.saveDraft(s.versionId,t,this.draft.revision),await this.proposeDevices(),this.step=6}catch(i){this.error=i instanceof F&&i.code==="stale_revision"?n("טיוטת המבנה השתנתה בינתיים בחלון אחר. חזור לשלב הזה ונסה שוב."):M(i)}finally{this.busy=!1}}}async proposeDevices(){const e=this.backend;if(!e||!this.draft)return;const s=await e.entities().catch(()=>[]),t=this.draft.doc,i=t.dimensions.width_px,a=t.dimensions.height_px,o=fe(t,{walls:t.walls,openings:t.openings,objects:[]}),r=t.openings.map(c=>{const x=J(o,c.id);return x?{id:c.id,kind:c.kind,x:x[0]/i,y:x[1]/a}:null}).filter(c=>!!c),l=this.created.map((c,x)=>({id:c.id,name:this.rooms[x]?.name.trim()||N(x),area_id:this.areaOf(this.rooms[x]?.name??""),polygon:c.polygon})),h=new Set(l.map(c=>c.area_id).filter(Boolean)),p=s.filter(c=>c.area_id?h.has(c.area_id):e.demo),u=Vt(p,l,r,this.prefs.auto_place),m=await e.cameras().catch(()=>[]);this.placements=[...u.filter(c=>c.where==="manual"),...u.filter(c=>c.where!=="manual"),...Wt(m)],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices"}placeAt(e){if(this.step!==6||!this.selDev||!this.draft)return;const s=e.currentTarget,t=s.createSVGPoint();t.x=e.clientX,t.y=e.clientY;const i=s.getScreenCTM();if(!i)return;const a=t.matrixTransform(i.inverse()),o=this.draft.doc.dimensions.width_px,r=this.draft.doc.dimensions.height_px,l=Math.round(Math.min(1,Math.max(0,a.x/o))*1e5)/1e5,h=Math.round(Math.min(1,Math.max(0,a.y/r))*1e5)/1e5,p=this.selDev;this.placements=this.placements.map(m=>m.entity_id===p?{...m,x:l,y:h,where:m.where==="manual"?"centre":m.where}:m);const u=new Set(this.skipped);u.delete(p),this.skipped=u,this.selDev=null}toggleSkip(e){const s=new Set(this.skipped);s.has(e)?s.delete(e):s.add(e),this.skipped=s,this.selDev===e&&(this.selDev=null)}get toPlace(){return this.placements.filter(e=>e.x!==null&&e.y!==null&&e.where!=="manual"&&!this.skipped.has(e.entity_id))}unplace(e){this.placements=this.placements.map(s=>s.entity_id===e?{...s,x:null,y:null,where:"manual"}:s),this.selDev=null}async publish(){const e=this.backend,s=this.version;if(!(!e||!s||this.busy)){this.busy=!0,this.error="";try{const t=this.draft?.doc.levels.find(i=>i.is_default)?.id??this.draft?.doc.levels[0]?.id??null;this.done=await e.publish(s.versionId,this.toPlace.map(i=>({resource_type:i.resource??"ha_entity",entity_id:i.entity_id,x:i.x,y:i.y,level_id:t}))),this.done.failed||j(`/explore/floors/${this.floorId}`)}catch(t){this.error=M(t)}finally{this.busy=!1}}}toStudio(){j(`/explore/floors/${this.floorId}/edit`)}back(){if(this.busy||this.step<=1)return;this.error="";const e=this.step===3?1:this.step-1;if(e===3&&!this.set){this.step=2,this.runDetect();return}this.step=e,this.step===1&&(this.phases={structure:"idle",rooms:"idle"})}next(){this.busy||(this.step===1&&this.version&&(!this.uploaded||this.uploaded.pages.length<2||this.page===this.versionPage)?this.reuseVersion():this.step===1&&this.version?this.replace={kind:"page"}:this.step===1&&this.uploaded&&this.uploaded.pages.length>1?this.pickPage():this.step===2&&this.phases.structure==="error"?this.runDetect():this.step===3?this.confirmReview():this.step===4?this.saveRooms():this.step===5?this.saveStyle():this.step===6?this.step=7:this.step===7&&this.publish())}key(e){if(this.step!==3||this.prefsOpen||e.ctrlKey||e.metaKey||e.altKey)return;const s=e.composedPath()[0];if(s&&(s.tagName==="INPUT"||s.tagName==="SELECT"||s.tagName==="TEXTAREA"))return;const t=Number(e.key),i=this.choicesFor(this.current);t>=1&&t<=i.length&&(e.preventDefault(),this.decide(i[t-1].id))}choicesFor(e){if(!e||!this.set)return[];if(this.set.walls.some(t=>t.id===e))return Dt;const s=this.set.openings.find(t=>t.id===e)?.kind==="window";return Pt.filter(t=>s?t.id!=="sliding":t.id!=="window")}openPrefs(){this.prefsDraft={...this.prefs},this.prefsOpen=!0}async savePrefs(){const e=this.backend,s=U(this.prefsDraft);this.prefsOpen=!1,this.prefs=s,this.step<=3&&(this.kit=s.kit,this.furniture=s.furniture&&s.kit!=="empty"),this.set&&!this.queue.some(t=>t.id===this.current)&&(this.current=this.queue[0]?.id??null);try{await e?.savePrefs(s)}catch(t){this.error=M(t)}}render(){const e=this.step,s=this.draft?.doc.dimensions.width_px??this.version?.width??1e3,t=this.draft?.doc.dimensions.height_px??this.version?.height??1e3;return d`<div class="wz" data-wizard-step=${e}>
        ${this.renderSteps()}
        <div class="wz-canvas" data-wz-canvas>${this.renderCanvas(s,t)}</div>
        <div class="wz-side" data-wz-side>${this.renderSide(s,t)}</div>
        ${this.renderFoot()}
      </div>
      ${this.prefsOpen?this.renderPrefs():b}
      ${this.replace?this.renderReplace():b}`}renderSteps(){const e=this.step;return d`<div class="wz-steps" role="list" aria-label=${n("שלבי האשף")}>
      ${_e.map((s,t)=>d`${t?d`<i class="ln ${t<e?"done":""}" aria-hidden="true"></i>`:b}<span role="listitem" class="st ${t+1<e?"done":t+1===e?"now":""}" aria-current=${t+1===e?"step":"false"}><i class="num">${t+1<e?d`<sw-icon name="check" size="14"></sw-icon>`:t+1}</i><span>${s}</span></span>`)}
      <div class="mob"><span>${_e[e-1]}</span><small class="num">${n("שלב {step} מתוך 7",{step:e})}</small><span class="bar" aria-hidden="true"><i style="inline-size:${e/7*100}%"></i></span></div>
      <button class="gear" data-wz-prefs aria-label=${n("הגדרות האשף")} title=${n("הגדרות האשף")} @click=${()=>this.openPrefs()}><sw-icon name="system" size="18"></sw-icon></button>
    </div>`}planSvg(e,s,t,i={}){const a=this.version?.imageUrl??"",o=i.crop??[0,0,e,s];return d`<svg class="plan ${i.placing?"placing":""}" viewBox=${o.join(" ")} preserveAspectRatio=${i.crop?"xMidYMid slice":"xMidYMid meet"}
        style=${i.crop?"":`aspect-ratio:${e}/${s}`} role="img" aria-label=${n("תוכנית הקומה")} @click=${i.click??(()=>{})}>
      <rect x=${o[0]} y=${o[1]} width=${o[2]} height=${o[3]} fill="#fff"/>
      ${a?k`<image href=${a} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" opacity=${t===b?1:.55}/>`:b}
      ${t}
    </svg>`}get geom(){if(!this.set||!this.draft)return null;const e=`${this.draft.revision}|${this.set.walls.length}|${this.set.openings.length}|${this.set.scaleMPerPx}`;return this.geomMemo?.key!==e&&(this.geomMemo={key:e,g:fe(this.draft.doc,this.set)}),this.geomMemo.g}onCandClick(e){const t=e.target.closest("[data-cand]")?.getAttribute("data-cand");t&&(this.current=t)}onRoomClick(e){const s=e.target.closest("[data-room]"),t=s?Number(s.getAttribute("data-room")):NaN;if(!Number.isFinite(t))return;const i=this.small?ze:ke;this.roomFocus=t,this.roomsPage=Math.floor(t/i),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-room-name="${t}"]`)?.focus())}renderCanvas(e,s){const t=this.step;if(t===1)return d`<div class="drop ${this.dragOver?"over":""}" data-wz-drop
          @dragover=${a=>{a.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1}
          @drop=${a=>{a.preventDefault(),this.dragOver=!1,this.onFile(a.dataTransfer?.files?.[0])}}>
        <sw-icon class="big" name="upload" size="44"></sw-icon>
        <b>${this.uploaded?this.uploaded.name:n("גרור לכאן את תוכנית הקומה")}</b>
        <span class="hide-ph">${this.uploaded&&this.uploaded.pages.length>1?n("בחר בצד את העמוד שבו נמצאת התוכנית"):n("תמונה או PDF של תוכנית אדריכלית, שרטוט מכירות או סריקה")}</span>
        <div class="row">
          <span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-wz-file @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button variant="primary" size="lg" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>${this.busy?n("מעלה…"):n("בחר קובץ")}</sw-button></span>
          <span><input type="file" accept="image/*" capture="environment" @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button size="lg" icon="camera" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>${n("צלם")}</sw-button></span>
        </div>
        <div class="fmts"><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">PDF</span><a class="tag" href=${`#/explore/floors/${this.floorId}/import`}>${n("DXF / IFC: ייבוא מדויק, בלי זיהוי")}</a></div>
      </div>`;if(t===2)return d`<div class="sheet">${this.planSvg(e,s,b)}</div>${this.phases.structure==="run"?d`<i class="scan" aria-hidden="true"></i>`:b}`;if(t===3){const a=this.geom,o=this.set;if(!a||!o)return b;const r=new Set(Object.entries(this.decisions).filter(([,l])=>l==="none").map(([l])=>l));return d`<div class="sheet">${this.planSvg(e,s,we(a,o,this.prefs,new Set(Object.keys(this.decisions)),r,this.current),{click:l=>this.onCandClick(l)})}</div>
        <div class="legend"><span><i style="background:var(--wz-sure)"></i>${n("זוהה בביטחון")}</span><span><i style="background:var(--wz-check)"></i>${n("לבדיקה")}</span><span><i class="dash"></i>${n("בספק, לא ייכנס בלי אישור")}</span><span><i style="background:var(--wz-out)"></i>${n("הושמט")}</span></div>`}if(t===4)return d`<div class="sheet">${this.planSvg(e,s,be(this.rooms,e,s,"name",this.roomFocus),{click:a=>this.onRoomClick(a)})}</div>`;if(t===5||t===7){const a=this.scene();if(a)return d`<div class="preview3d"><sw-plan-3d data-wz-3d .description=${a} .frameKey=${`wizard-${this.version?.versionId??""}`} .preset=${"iso"} kiosk .qualityForce=${"full"} .minFps=${0}></sw-plan-3d></div><span class="preview-note">${n("תצוגה מקדימה")}</span>`;const o=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,r=Q(this.kit),l=k`<g>${this.created.map((h,p)=>k`<polygon points=${h.polygon.map(u=>`${u.x*e},${u.y*s}`).join(" ")} fill=${Ie(W(r,this.rooms[p]?.typeId??"other"),o)} fill-opacity=".85"/>`)}</g>`;return d`<div class="sheet">${this.planSvg(e,s,l)}</div><span class="preview-note">${this.three==="loading"?n("טוען תצוגה בתלת־ממד…"):n("תצוגה מקדימה")}</span>`}const i=k`${be(this.created.map(a=>({polygon:a.polygon})),e,s,"faint",null)}${Zt(this.placements.filter(a=>!this.skipped.has(a.entity_id)),e,s,this.selDev)}`;return d`<div class="sheet">${this.planSvg(e,s,i,{click:a=>this.placeAt(a),placing:!!this.selDev})}</div>
      <div class="legend"><span><i class="dot" style="background:var(--wz-sure)"></i>${n("הוצב")}</span><span><i class="dot" style="background:var(--wz-check)"></i>${n("ממתין למקום")}</span>${this.placements.some(D)?d`<span><i class="sq"></i>${n("מצלמה")}</span>`:b}</div>`}renderSide(e,s){return d`${this.sideFor(e,s)}${this.error?d`<div class="card err" role="alert" data-wz-error>${this.error}</div>`:b}`}sideFor(e,s){const t=this.step;if(t===1){const i=this.uploaded&&this.uploaded.pages.length>1,a=this.resumeInfo,o=this.version;return d`<h2>${n("העלאת תוכנית")}</h2><p>${n("המערכת תזהה קירות, דלתות, חלונות וחדרים, ואתה תאשר. כמה דקות לקומה.")}</p>
        ${a?d`<div class="card resume" data-wz-resume><b>${n("יש כאן טיוטה של האשף שלא הסתיימה")}</b><span>${Me(a.createdAt)?n("התחלת אותה ב־{when}. ",{when:Me(a.createdAt)}):""}${n("אפשר להמשיך מהמקום שעצרת.")}</span>
            <div class="side-actions"><sw-button variant="primary" icon="history" data-wz-resume-go ?disabled=${this.busy} @click=${()=>void this.resumeWizard()}>${n("המשך באשף")}</sw-button><sw-button variant="ghost" @click=${()=>this.toStudio()}>${n("פתח בסטודיו")}</sw-button></div></div>`:b}
        ${o&&!a?d`<div class="card resume" data-wz-kept><b>${n("התוכנית שהעלית נשמרה")}</b><span>${n('"המשך" יזהה אותה שוב, בלי טיוטה נוספת. קובץ אחר יחליף אותה.')}</span></div>`:b}
        <div class="card"><div class="kv">
          <b>${n("לאיזו קומה?")}</b>
          <select style="inline-size:160px" aria-label=${n("הקומה")} data-wz-floor .value=${this.floorId} @change=${r=>j(`/explore/floors/${r.target.value}/wizard`)}>
            ${(this.floor?.siblings.length?this.floor.siblings:[{id:this.floorId,name:this.floor?.name||this.floorId}]).map(r=>d`<option value=${r.id} ?selected=${r.id===this.floorId}>${r.name}</option>`)}
          </select>
          <b class="hide-ph">${n("גובה תקרה")}</b>
          <select class="hide-ph" style="inline-size:160px" aria-label=${n("גובה תקרה")} .value=${String(this.ceiling)} @change=${r=>this.ceiling=Number(r.target.value)}>
            ${[2.5,2.6,2.7,2.8,3,3.2,3.5,4,5].map(r=>d`<option value=${String(r)} ?selected=${r===this.ceiling}>${r.toFixed(2)} ${n("מ׳")}</option>`)}
          </select>
        </div></div>
        ${i?d`<div class="card"><b>${n("באיזה עמוד התוכנית?")}</b><div class="side-actions" style="margin-block-start:8px">${this.uploaded.pages.map(r=>d`<button class="opt" style="inline-size:64px" aria-pressed=${r.page===this.page?"true":"false"} @click=${()=>this.page=r.page}>${r.page}</button>`)}</div></div>`:a||o?b:d`<div class="card soft hide-ph"><b>${n("כדי שהזיהוי יצליח")}</b><div class="tips"><span>${n("סריקה ישרה וחדה, בלי צל או קיפול.")}</span><span>${n("קירות כהים על רקע בהיר.")}</span><span>${n("ריהוט וכיתוב על התוכנית לא מפריעים.")}</span></div></div>`}
        ${this.floor?.hasPlan?d`<div class="side-actions"><sw-button variant="ghost" icon="edit" @click=${()=>this.toStudio()}>${n("שרטוט ידני בסטודיו")}</sw-button></div>`:b}`}if(t===2){const i=(r,l,h="")=>d`<div class="p ${r==="done"?"done":r==="run"?"run":""}"><i>${r==="done"?d`<sw-icon name="check" size="13"></sw-icon>`:r==="error"?d`<sw-icon name="warning" size="13"></sw-icon>`:b}</i>${l}<span class="v">${h}</span></div>`,a=this.phases.structure,o=this.phases.rooms;return d`<h2>${n("מזהה את התוכנית")}</h2><p>${n("הזיהוי רץ אצלך במערכת. התוכנית לא נשלחת לשום מקום.")}</p>
        <div class="card"><div class="prog" data-wz-progress>
          ${i(a,n("קירות"),a==="done"?n("{n} נמצאו",{n:this.set?.walls.length??0}):"")}
          ${i(a,n("דלתות, חלונות ומעברים"),a==="done"?n("{n} נמצאו",{n:this.set?.openings.length??0}):"")}
          ${i(a==="done"?"done":a==="run"?"idle":a,n("עמודים ומדרגות"),a==="done"?`${this.set?.objects.length??0}`:"")}
          ${i(o,n("חדרים סגורים"),o==="done"?n("{n} נמצאו",{n:this.rooms.length}):o==="error"?n("לא זוהו"):"")}
          ${i(a==="done"?"done":"idle",n("קנה מידה"),a==="done"?this.result?.calibration_hint?n("משוער לפי רוחב דלת"):n("לא ידוע"):"")}
        </div></div>
        <div class="card soft hide-ph">${n("קווי מידה, קווים מקווקווים ומסגרת הגיליון מזוהים ומושמטים, כדי שלא יהפכו לקירות.")}</div>
        ${a==="run"?d`<div class="why num" data-wz-elapsed>${this.elapsed?n("{n} שנ׳",{n:this.elapsed}):""}</div>`:b}`}return t===3?this.sideReview(e,s):t===4?this.sideRooms():t===5?this.sideStyle():t===6?this.sideDevices():this.sideDone()}sideReview(e,s){const t=this.set,i=this.geom;if(!t||!i)return b;const a=It(t,this.prefs),o=this.queue,r=this.current,l=o.findIndex($=>$.id===r),h=r?t.walls.find($=>$.id===r)??t.openings.find($=>$.id===r):void 0,p=h?P(h.confidence,this.prefs):"sure",u=r?this.decisions[r]??St(t,r):null,m=r?J(i,r):null,c=m?[m[0]-235,m[1]-125,470,250]:void 0,x=this.choicesFor(r),y=r?t.openings.find($=>$.id===r):void 0,I=this.draft?.doc?.dimensions.calibration?.status,S=new Set(Object.entries(this.decisions).filter(([,$])=>$==="none").map(([$])=>$));return d`<h2>${n("בדיקת הזיהוי")}</h2>
      <div class="cnts" data-wz-counts><div class="cnt"><b class="num">${a.sure}</b><span>${n("בביטחון")}</span></div><div class="cnt chk"><b class="num">${a.check}</b><span>${n("לבדיקה")}</span></div><div class="cnt low"><b class="num">${a.doubt}</b><span>${n("בספק")}</span></div></div>
      ${o.length&&h?d`<div class="card" style="display:grid;gap:10px" data-wz-item=${r}>
            <div class="qhead"><b>${n("מה יש כאן?")}</b><span class="pager"><button aria-label=${n("הקודם")} ?disabled=${l<=0} @click=${()=>this.moveQueue(-1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num" data-wz-pos>${l<0?"–":l+1} / ${o.length}</span><button aria-label=${n("הבא")} ?disabled=${l>=o.length-1} @click=${()=>this.moveQueue(1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span></div>
            <div class="q-crop">${this.planSvg(e,s,we(i,t,this.prefs,new Set(Object.keys(this.decisions)),S,r),{crop:c})}</div>
            <div class="conf ${p}"><span>${At(t,r)}</span><span class="bar"><i style="inline-size:${Math.round(h.confidence*100)}%"></i></span><b class="num">${Math.round(h.confidence*100)}%</b></div>
            ${y?d`<div class="why hide-ph">${y.kind==="passage"?n("יש רווח בקיר ברוחב {w} מ׳, אבל לא נמצאה קשת של דלת.",{w:y.width_m.toFixed(2)}):n("ברוחב {w} מ׳.",{w:y.width_m.toFixed(2)})}</div>`:b}
            <div class="opts" role="group" aria-label=${n("מה יש כאן")}>${x.map(($,K)=>d`<button class="opt" data-choice=${$.id} aria-pressed=${u===$.id?"true":"false"} @click=${()=>this.decide($.id)}>${$.he}<kbd class="hide-ph">${K+1}</kbd></button>`)}</div>
          </div>`:d`<div class="card soft">${n("כל מה שזוהה נמצא מעל סף הביטחון ויכנס לתוכנית. אפשר לתקן כל פריט אחר כך בסטודיו.")}</div>`}
      <div class="card soft hide-ph">${this.measure.open?d`<div class="measure"><span>${n("אורך הקיר הארוך ביותר")}</span><input type="number" inputmode="decimal" min="0.5" step="0.01" aria-label=${n("אורך במטרים")} placeholder=${n("מ׳")} .value=${this.measure.metres} @input=${$=>this.measure={...this.measure,metres:$.target.value}} /><sw-button size="sm" variant="primary" ?disabled=${this.busy||!(parseFloat(this.measure.metres)>0)} @click=${()=>void this.measureWall()}>${n("שמור")}</sw-button></div>`:d`<div class="kv"><span>${n("קנה מידה")} <b>${I==="measured"?n("נמדד"):n("משוער")}</b>${I==="measured"?"":this.result?.calibration_hint?n(", לפי רוחב דלת"):""}</span><sw-button size="sm" icon="ruler" @click=${()=>this.measure={open:!0,metres:""}}>${n("מדוד קיר")}</sw-button></div>`}</div>`}sideRooms(){const e=this.small?ze:ke,s=Math.max(1,Math.ceil(this.rooms.length/e)),t=Math.min(this.roomsPage,s-1),i=this.rooms.filter(a=>!a.name.trim()).length;return d`<h2>${n("שמות החדרים")}</h2><p>${this.rooms.length?n("נמצאו {n} חדרים סגורים. תן שם לכל אחד, או בחר שם של אזור שכבר קיים במערכת כדי לקשר אליו.",{n:this.rooms.length}):n("לא נמצאו חדרים סגורים. אפשר להמשיך ולסמן חדרים אחר כך בסטודיו.")}</p>
      <datalist id="wz-areas">${this.areas.map(a=>d`<option value=${a.name}></option>`)}</datalist>
      <div class="rooms" data-wz-rooms>${this.rooms.slice(t*e,t*e+e).map((a,o)=>{const r=t*e+o,l=!!this.areaOf(a.name);return d`<div class="rrow"><i style="background:${ee(r)}"></i>
          <input type="text" list="wz-areas" data-room-name=${r} class="${a.name.trim()?l?"linked":"":"empty"}" .value=${a.name} placeholder=${n("{room}: שם",{room:N(r)})} aria-label=${n("שם חדר {n}",{n:r+1})} title=${l?n("מקושר לאזור קיים"):""}
            @focus=${()=>this.roomFocus=r} @input=${h=>this.setRoom(r,{name:h.target.value})} />
          <select aria-label=${n("סוג חדר {n}",{n:r+1})} .value=${a.typeId} @change=${h=>this.setRoom(r,{typeId:h.target.value})}>${E.map(h=>d`<option value=${h.id} ?selected=${h.id===a.typeId}>${h.id==="other"?n("סוג"):h.he}</option>`)}</select>
        </div>`})}</div>
      <div class="rnote">${i?d`<span class="warn">${i===1?n("חדר אחד עוד בלי שם"):n("{n} חדרים עוד בלי שם",{n:i})}</span>`:d`<span>${n("{n} מקושרים לאזורים קיימים",{n:this.rooms.filter(a=>this.areaOf(a.name)).length})}</span>`}
        ${s>1?d`<span class="pager"><button aria-label=${n("הקודם")} ?disabled=${t<=0} @click=${()=>this.roomsPage=t-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${t+1} / ${s}</span><button aria-label=${n("הבא")} ?disabled=${t>=s-1} @click=${()=>this.roomsPage=t+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:b}</div>
      ${this.existingAuto?d`<label class="check"><sw-toggle size="sm" labelHidden in-label label=${this.existingAuto===1?n("להחליף חדר אוטומטי קודם בקומה"):n("להחליף {n} חדרים אוטומטיים קודמים בקומה",{n:this.existingAuto})} .checked=${this.replaceAuto} @change=${a=>this.replaceAuto=L(a)}></sw-toggle>${this.existingAuto===1?n("להחליף חדר אוטומטי קודם בקומה"):n("להחליף {n} חדרים אוטומטיים קודמים בקומה",{n:this.existingAuto})}</label>`:b}`}sideStyle(){const e=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,s={empty:"plaster_ceiling",office:"fabric_accent",lobby:"wood_dark",technical:"metal_dark",commercial:"metal_light"},t=i=>[W(i,"living"),W(i,"kitchen"),"plaster_white",s[i.id]??"wood_light"].map(a=>d`<i style="background:${Ie(a,e)}"></i>`);return d`<h2>${n("סגנון וריהוט")}</h2><p>${n("ערכה קובעת חומרים וריהוט התחלתי לכל חדר לפי הסוג שלו. אפשר לשנות אחר כך חדר־חדר בסטודיו.")}</p>
      <div class="presets" role="radiogroup" aria-label=${n("ערכת סגנון")}>${B.map(i=>d`<button class="preset" role="radio" data-kit=${i.id} aria-checked=${i.id===this.kit?"true":"false"} aria-pressed=${i.id===this.kit?"true":"false"}
          @click=${()=>{this.kit=i.id,i.id==="empty"?this.furniture=!1:this.prefs.furniture&&(this.furniture=!0)}}><span class="sw" aria-hidden="true">${t(i)}</span><span class="tx"><b>${i.he}</b><span>${i.note}</span></span></button>`)}</div>
      <label class="check"><sw-toggle size="sm" labelHidden in-label label=${n("להציב ריהוט התחלתי")} data-wz-furniture .checked=${this.furniture} ?disabled=${this.kit==="empty"} @change=${i=>this.furniture=L(i)}></sw-toggle><sw-icon name="cube" size="16"></sw-icon>${n("להציב ריהוט התחלתי")}</label>
`}sideDevices(){const e=this.small?ts:es,s=this.placements.filter(D),t=this.placements.filter(c=>!D(c)),i=s.length?this.devTab:"devices",a=i==="cameras"?s:t,o=Math.max(1,Math.ceil(a.length/e)),r=Math.min(this.devPage,o-1),l=t.filter(c=>c.where!=="manual").length,h=s.filter(c=>c.where!=="manual").length,p=this.selDev?this.placements.find(c=>c.entity_id===this.selDev):null,u=c=>{this.devTab=c,this.devPage=0,this.selDev=null},m=i==="cameras"?n("{set} מתוך {total} מצלמות סומנו. בחר מצלמה ולחץ על המפה במקום שבו היא מותקנת; מצלמה שלא תסמן לא תוצב.",{set:h,total:s.length}):t.length?n("{auto} מתוך {total} הוצבו לבד, לפי האזור והסוג. את השאר בוחרים ומסמנים על המפה.",{auto:l,total:t.length}):n("אין התקנים שמחכים למקום באזורים של החדרים האלה. אפשר להציב התקנים אחר כך מהמפה.");return d`<h2>${n("מיקום התקנים")}</h2>
      ${s.length?d`<sw-tabs controlled variant="pill" fill="always" group-label=${n("מה מציבים")} data-wz-dev-tabs .active=${i}
          .items=${[{id:"devices",label:n("התקנים"),glyph:d`<sw-icon name="sensor" size="15"></sw-icon>`,pill:t.length,attrs:{"data-wz-tab":"devices"}},{id:"cameras",label:n("מצלמות"),glyph:d`<sw-icon name="camera" size="15"></sw-icon>`,pill:h?`${h}/${s.length}`:s.length,attrs:{"data-wz-tab":"cameras"}}]}
          @change=${c=>{c.stopPropagation(),u(c.detail.id)}}></sw-tabs>`:b}
      <p>${m}</p>
      <div class="devs" data-wz-devs role=${s.length?"tabpanel":b}>${a.slice(r*e,r*e+e).map(c=>{const x=D(c),y=this.skipped.has(c.entity_id),z=!x&&c.where==="manual"&&!y,I=y?me.none:x&&c.where!=="manual"?Ut:me[c.where];return d`<button class="dev ${z?"todo":""} ${y?"off":""} ${x&&c.where!=="manual"?"set":""}" data-dev-row=${c.entity_id} aria-pressed=${this.selDev===c.entity_id?"true":"false"} @click=${()=>this.selDev=this.selDev===c.entity_id?null:c.entity_id}>
          <sw-icon name=${is(c.domain)} size="16"></sw-icon><span class="nm">${c.name}</span><span class="w">${I}</span></button>`})}</div>
      ${p?d`<div class="card soft" data-wz-dev-sel><b>${p.name}</b>${p.where==="manual"?n(": לחץ על המפה כדי להציב."):n(": לחץ על המפה כדי להזיז.")}${D(p)?p.where!=="manual"?d`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.unplace(p.entity_id)}>${n("הסר מהמפה")}</sw-button></div>`:b:d`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.toggleSkip(p.entity_id)}>${this.skipped.has(p.entity_id)?n("להציב בכל זאת"):n("לא להציב")}</sw-button></div>`}</div>`:b}
      <div class="rnote"><span>${i==="cameras"?n("רק מצלמות שמותר לך להציב, שעוד לא בקומה הזו"):n("רק התקנים מהקטלוג המאושר, שעוד לא על אף מפה")}</span>${o>1?d`<span class="pager"><button aria-label=${n("הקודם")} ?disabled=${r<=0} @click=${()=>this.devPage=r-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${r+1} / ${o}</span><button aria-label=${n("הבא")} ?disabled=${r>=o-1} @click=${()=>this.devPage=r+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:b}</div>`}sideDone(){const e=this.draft?.doc,s=e?.dimensions.calibration?.status;return d`<h2>${n("הקומה מוכנה")}</h2><p>${n("נשמרה כטיוטה. היא תופיע לכולם רק אחרי פרסום.")}</p>
      <div class="card"><div class="kv" data-wz-summary>
        <span>${n("קירות")}</span><b class="num">${e?.walls.length??0}</b>
        <span>${n("דלתות, חלונות ומעברים")}</span><b class="num">${e?.openings.length??0}</b>
        <span>${n("חדרים")}</span><b class="num">${this.created.length}</b>
        <span>${n("התקנים שיוצבו")}</span><b class="num">${this.toPlace.filter(t=>!D(t)).length}</b>
        ${this.placements.some(D)?d`<span>${n("מצלמות שיוצבו")}</span><b class="num" data-wz-cams-count>${this.toPlace.filter(D).length}</b>`:b}
        <span>${n("סגנון")}</span><b>${Q(this.kit).he}</b>
        <span>${n("קנה מידה")}</span><b>${s==="measured"?n("נמדד"):n("משוער")}</b>
      </div></div>
      ${this.done?.failed?d`<div class="card err" data-wz-refused>${this.refusedText(this.done)}<div><sw-button size="sm" @click=${()=>j(`/explore/floors/${this.floorId}`)}>${n("פתח את המפה")}</sw-button></div></div>`:b}
      <div class="card soft hide-ph">${n("רוצה לדייק קיר, להזיז רהיט או להוסיף מצלמה? הכול פתוח לעריכה בסטודיו התוכניות. התקנים מוצבים רק בפרסום מכאן.")}</div>
      <sw-button data-wz-studio @click=${()=>this.toStudio()}>${n("המשך עריכה בסטודיו")}</sw-button>`}refusedText(e){if(e.blocked==="other_draft")return n("התוכנית פורסמה, אבל {n} פריטים לא הוצבו: לקומה יש טיוטה נוספת פתוחה, והם היו נשמרים עליה. פרסם או מחק אותה בסטודיו, ואז הצב מהמפה.",{n:e.failed});const s=a=>this.placements.find(o=>o.entity_id===a)?.name??a,t=e.refused.slice(0,3).map(a=>`${s(a.id)} (${ss[a.code]??n("נדחה")})`).join(", "),i=e.refused.length>3?n(" ועוד {n}",{n:e.refused.length-3}):"";return n("{placed} הוצבו, {failed} לא הוצבו: {shown}{more}. אפשר להציב אותם מהמפה.",{placed:e.placed,failed:e.failed,shown:t,more:i})}renderReplace(){return d`<sw-dialog open heading=${n("להחליף את התוכנית?")} subheading=${n("טיוטה אחת של האשף לכל קומה")} data-wz-replace-dialog @close=${()=>this.replace=null}>
      <p class="dlg-p">${n("הטיוטה הקודמת של האשף, עם הקירות, הפתחים והחדרים שאישרת בה, תימחק לפני שהתוכנית החדשה תיטען. היא לא פורסמה ושום דבר לא הוצב עליה.")}</p>
      <p class="dlg-p soft">${n('כדי להמשיך עם אותה תוכנית, בחר "ביטול" ואז "המשך".')}</p>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" data-wz-replace-cancel ?disabled=${this.busy} @click=${()=>this.replace=null}>${n("ביטול")}</sw-button>
        <sw-button variant="danger" data-wz-replace-go ?disabled=${this.busy} aria-busy=${this.busy?"true":"false"} @click=${()=>void this.confirmReplace()}>${this.busy?n("מוחק…"):n("מחק את הטיוטה והמשך")}</sw-button>
      </div>
    </sw-dialog>`}renderFoot(){const e=this.step,s=e===1&&this.uploaded&&this.uploaded.pages.length>1,t=e===1?this.version?n("אותה תוכנית, אותה טיוטה"):n("אפשר להעלות קומה אחת בכל פעם"):e===2?n("בדרך כלל 5 עד 20 שניות"):e===3?this.prefs.unreviewed==="as_detected"?n('מה שלא תבדוק: "לבדיקה" ייכנס כמו שזוהה, "בספק" לא ייכנס'):n("מה שלא תבדוק לא ייכנס לתוכנית"):e===4?n('חדר בלי שם יקבל "חדר 7", ואפשר לשנות אחר כך'):e===5?n("התצוגה מתעדכנת מיד כשבוחרים ערכה"):e===6?n("אפשר לדלג ולהציב התקנים אחר כך מהמפה"):n("אפשר לחזור ולתקן כל שלב"),i=e===1?s?n("המשך"):n("המשך"):e===2?this.phases.structure==="error"?n("נסה שוב"):n("מזהה…"):e===3?n("אשר והמשך"):e===7?n("פרסם ופתח במפה"):n("המשך"),a=this.busy||e===1&&!s&&!this.version||e===2&&this.phases.structure!=="error";return d`<div class="wz-foot">
      ${e>1?d`<sw-button size="lg" data-wz-back ?disabled=${this.busy||e===2} @click=${()=>this.back()}>${n("חזרה")}</sw-button>`:d`<sw-button size="lg" variant="ghost" @click=${()=>j(`/explore/floors/${this.floorId}`)}>${n("ביטול")}</sw-button>`}
      <span class="hint">${t}</span><span class="sp"></span>
      <sw-button size="lg" variant="primary" data-wz-next ?disabled=${a} aria-busy=${this.busy?"true":"false"} @click=${()=>this.next()}>${this.busy&&e>2?n("שומר…"):i}</sw-button>
    </div>`}renderPrefs(){const e=this.prefsDraft,s=i=>this.prefsDraft={...this.prefsDraft,...i},t=e.review_min>=e.auto_accept;return d`<sw-dialog open wide heading=${n("הגדרות האשף")} subheading=${n("נשמרות לחשבון שלך")} data-wz-prefs-dialog @close=${()=>this.prefsOpen=!1}>
      <div class="prefs">
        <div class="two">
          <label>${n("נכנס בלי בדיקה מעל (%)")}<input type="number" min="5" max="99" .value=${String(e.auto_accept)} @input=${i=>s({auto_accept:Math.round(Number(i.target.value))})} /></label>
          <label>${n("לא נכנס בלי אישור מתחת ל־(%)")}<input type="number" min="5" max="99" .value=${String(e.review_min)} @input=${i=>s({review_min:Math.round(Number(i.target.value))})} /></label>
        </div>
        ${t?d`<span class="note" style="color:var(--sw-danger-text)">${n("הסף התחתון חייב להיות נמוך מהעליון.")}</span>`:b}
        <label>${n('פריט "לבדיקה" שלא בדקת')}<select .value=${e.unreviewed} @change=${i=>s({unreviewed:i.target.value})}><option value="as_detected" ?selected=${e.unreviewed==="as_detected"}>${n("נכנס כמו שזוהה")}</option><option value="reject" ?selected=${e.unreviewed==="reject"}>${n("לא נכנס")}</option></select></label>
        <label>${n("ערכת סגנון ראשונה")}<select .value=${e.kit} @change=${i=>s({kit:i.target.value})}>${B.map(i=>d`<option value=${i.id} ?selected=${i.id===e.kit}>${i.he}</option>`)}</select></label>
        <label class="check"><sw-toggle size="sm" labelHidden in-label label=${n("להציב ריהוט התחלתי")} .checked=${e.furniture} @change=${i=>s({furniture:L(i)})}></sw-toggle>${n("להציב ריהוט התחלתי")}</label>
        <label class="check"><sw-toggle size="sm" labelHidden in-label label=${n("להציב התקנים לבד לפי האזור")} .checked=${e.auto_place} @change=${i=>s({auto_place:L(i)})}></sw-toggle>${n("להציב התקנים לבד לפי האזור")}</label>
        <span class="note">${n("ברירת המחדל: מעל 80% נכנס, בין 50% ל־80% לבדיקה ונכנס כמו שזוהה אם דילגת, מתחת ל־50% לא נכנס בלי אישור.")}</span>
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" @click=${()=>this.prefsDraft={...Y}}>${n("ברירת מחדל")}</sw-button>
        <sw-button variant="primary" data-wz-prefs-save ?disabled=${t} @click=${()=>void this.savePrefs()}>${n("שמור")}</sw-button>
      </div>
    </sw-dialog>`}};f.styles=Qt;g([te()],f.prototype,"floorId",2);g([te({type:Number})],f.prototype,"demoStep",2);g([te({type:Boolean})],f.prototype,"demoResume",2);g([w()],f.prototype,"step",2);g([w()],f.prototype,"prefs",2);g([w()],f.prototype,"prefsOpen",2);g([w()],f.prototype,"prefsDraft",2);g([w()],f.prototype,"floor",2);g([w()],f.prototype,"ceiling",2);g([w()],f.prototype,"busy",2);g([w()],f.prototype,"error",2);g([w()],f.prototype,"dragOver",2);g([w()],f.prototype,"uploaded",2);g([w()],f.prototype,"page",2);g([w()],f.prototype,"version",2);g([w()],f.prototype,"resumeInfo",2);g([w()],f.prototype,"replace",2);g([w()],f.prototype,"phases",2);g([w()],f.prototype,"elapsed",2);g([w()],f.prototype,"result",2);g([w()],f.prototype,"set",2);g([w()],f.prototype,"draft",2);g([w()],f.prototype,"decisions",2);g([w()],f.prototype,"current",2);g([w()],f.prototype,"measure",2);g([w()],f.prototype,"rooms",2);g([w()],f.prototype,"roomsPage",2);g([w()],f.prototype,"roomFocus",2);g([w()],f.prototype,"existingAuto",2);g([w()],f.prototype,"replaceAuto",2);g([w()],f.prototype,"areas",2);g([w()],f.prototype,"created",2);g([w()],f.prototype,"kit",2);g([w()],f.prototype,"furniture",2);g([w()],f.prototype,"catalog",2);g([w()],f.prototype,"three",2);g([w()],f.prototype,"placements",2);g([w()],f.prototype,"skipped",2);g([w()],f.prototype,"selDev",2);g([w()],f.prototype,"devPage",2);g([w()],f.prototype,"devTab",2);g([w()],f.prototype,"done",2);f=g([Ye("plan-wizard-screen")],f);export{f as PlanWizardScreen};
