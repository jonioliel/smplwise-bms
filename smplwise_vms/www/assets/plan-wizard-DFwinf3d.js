const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-FTIMe59U.css"])))=>i.map(i=>d[i]);
import{_ as Ee}from"./sw-logo-art-PLtEZJxU.js";import{a5 as _,A as b,a2 as je,b5 as Te,br as Ce,aE as Fe,aJ as Ie,aF as qe,aO as re,aB as Le,aH as Ne,ps as ne,pt as Ve,a as F,pu as We,g as Ge,i as Ke,R as Ue,az as Be,n as M,Y as T,b as c,u as Ze,ax as ee,j as w,k as Ye}from"./index-kipM9krC.js";import{a as A,t as r,n as W,W as Y}from"./wizard-prefs-Bu0kPCW5.js";import{w as He,a as Qe,c as Xe,f as Je,r as et}from"./candidates-B7oZpCxC.js";import{P as tt,Q as st,b as Se,m as oe}from"./shared-space-OPfsyBO8.js";import{b as it}from"./scene-builder-Cm_qn47R.js";import{M as at}from"./material-resolve-D74_GKN5.js";import{g as rt,d as nt,e as ot,f as lt,h as ct,s as dt}from"./geometry-CXXuNkbl.js";import{d as pt,a as le,b as ht,u as ut,l as mt}from"./zones-B2QcwyTs.js";import{c as ft,l as gt,a as wt}from"./plan-catalog-DNt1NtgA.js";import"./map-DNZQRQUO.js";const te=1e3,se=900,R=.012,vt=e=>[Math.round(e[0]/te*1e5)/1e5,Math.round(e[1]/se*1e5)/1e5],bt=[["g-out","exterior",.3,[[42,42],[958,42],[958,858],[42,858],[42,42]]],["g-w1","interior",.12,[[292,42],[292,858]]],["g-w2","interior",.12,[[42,292],[292,292]]],["g-w3","railing",.05,[[167,325],[167,625]]],["g-w5","interior",.12,[[292,500],[958,500]]],["g-w6","interior",.12,[[625,500],[625,858]]],["g-w7","interior",.12,[[42,625],[292,625]]],["g-w8","interior",.1,[[167,625],[167,858]]]],De=[["front","g-out",.95913,"door",1,"right","end"],["win-hall","g-out",.98317,"window",.8,"none","start"],["win-liv-n1","g-out",.12019,"window",1.4,"none","start"],["win-liv-n2","g-out",.16827,"window",1.4,"none","start"],["win-liv-n3","g-out",.21635,"window",1.4,"none","start"],["win-liv-e","g-out",.32933,"window",2.6,"none","start"],["win-kit-e","g-out",.44952,"window",1.2,"none","start"],["win-kit-s","g-out",.54808,"window",1.4,"none","start"],["win-off-s","g-out",.64423,"window",1.6,"none","start"],["win-wc-w","g-out",.79567,"window",.6,"none","start"],["d-hall-liv","g-w1",.15306,"door",1.6,"double","start"],["d-corr-liv","g-w1",.43878,"door",.9,"left","start"],["d-corr-off","g-w1",.65306,"door",.9,"right","end"],["p-hall-corr","g-w2",.73333,"passage",1.4,"none","start"],["d-liv-off","g-w5",.25,"door",.9,"right","start"],["d-liv-kit","g-w5",.75,"passage",1.8,"none","start"],["d-off-kit","g-w6",.51163,"door",.8,"left","end"],["d-wc","g-w7",.25,"door",.8,"right","end"],["d-util","g-w7",.75,"door",.8,"left","start"]],ce={"g-w3":.48,"g-w8":.71,"d-liv-kit":.45,"win-wc-w":.6,"win-hall":.6,"d-off-kit":.62,"p-hall-corr":.45,"win-kit-e":.75};function Pe(){const e=Re(),s=bt.map(([i,a,o,n])=>({id:i,level_id:"L0",polyline:n.map(vt),thickness_m:o,height_m:null,base_z_m:0,kind:a,confidence:1,source:"manual",locked:!1,external_ids:{}})),t=De.map(([i,a,o,n,l,h,p])=>i==="d-liv-kit"?{id:i,wall_id:a,t:o,kind:"door",width_m:l,height_m:2.1,sill_m:0,swing:"sliding",hinge:p,anchor_ref:null,confidence:1,source:"manual",external_ids:{}}:{id:i,wall_id:a,t:o,kind:n,width_m:l,height_m:n==="window"?1.2:2.1,sill_m:n==="window"?.9:0,swing:h,hinge:p,anchor_ref:null,confidence:1,source:"manual",external_ids:{}});return{...e,walls:s,openings:t}}function Re(){return{schema_version:"2.0",plan_version_id:"demo-wizard",floor_id:"f0",source:{sha256:"",file_name:"תוכנית-קרקע.png",mime:"image/png",page:1},dimensions:{width_px:te,height_px:se,scale_m_per_px:R,calibration:{status:"estimated",method:"door_width",pairs:[],residual_pct:null,reason:"לפי רוחב 9 דלתות"}},transform:{rotation:0,crop:null},levels:[{id:"L0",name:"קרקע",elevation_m:0,ceiling_height_m:2.8,is_default:!0}],walls:[],openings:[],rooms:[],objects:[],circuits:[],connectors:[],labels:[],groups:[],uncertain_regions:[],uncertainty:{overall:0,notes:[]},meta:{generator:"demo",tokens_version:"map-1",detector_version:null}}}function yt(){const s=Pe().walls.map(a=>({...a,id:`auto-${a.id}`,source:"auto",confidence:ce[a.id]??.96,hollow:!1})),t=De.map(([a,o,n,l,h,p,u])=>({id:`auto-${a}`,wall_id:`auto-${o}`,t:n,kind:l,width_m:h,height_m:l==="window"?1.2:2.1,sill_m:l==="window"?.9:0,swing:p,hinge:u,anchor_ref:null,confidence:ce[a]??(l==="window"?.9:.92),source:"auto",external_ids:{}})),i={};for(const a of s)i[a.id]={thickness_px:a.thickness_m/R};for(const a of t)i[a.id]={width_px:a.width_m/R};return{walls:s,openings:t,objects:[],detector:{name:"plan_detect",version:"demo",params:{}},calibration_hint:{scale_m_per_px:R,status:"estimated",method:"door_width",reason:"לפי רוחב 9 דלתות",doors:9},pixels:i,scale:{m_per_px:R,status:"estimated_walls"},stats:{},version_id:"demo-wizard",level_id:"L0",existing_auto:{walls:0,openings:0}}}const xt=[["כניסה",[[.5,.5],[3.5,.5],[3.5,3.5],[.5,3.5]]],["חדר מדרגות",[[.5,3.5],[2,3.5],[2,7.5],[.5,7.5]]],["מסדרון",[[2,3.5],[3.5,3.5],[3.5,7.5],[2,7.5]]],["סלון",[[3.5,.5],[11.5,.5],[11.5,6],[3.5,6]]],["מטבח",[[7.5,6],[11.5,6],[11.5,10.3],[7.5,10.3]]],["חדר עבודה",[[3.5,6],[7.5,6],[7.5,10.3],[3.5,10.3]]],["",[[.5,7.5],[2,7.5],[2,10.3],[.5,10.3]]],["",[[2,7.5],[3.5,7.5],[3.5,10.3],[2,10.3]]]];function $t(){return xt.map(([e,s])=>({name:e,polygon:s.map(([t,i])=>({x:Math.round(t/R/te*1e5)/1e5,y:Math.round(i/R/se*1e5)/1e5}))}))}const kt=[{area_id:"hall",name:"כניסה"},{area_id:"living",name:"סלון"},{area_id:"kitchen",name:"מטבח"},{area_id:"office",name:"חדר עבודה"},{area_id:"corridor",name:"מסדרון"},{area_id:"wc",name:"שירותים"},{area_id:"terrace",name:"מרפסת"}],_t=[{entity_id:"lock.front",name:"דלת כניסה",domain:"lock",device_class:null,area_id:"hall"},{entity_id:"binary_sensor.kitchen_door",name:"דלת הזזה למטבח",domain:"binary_sensor",device_class:"door",area_id:"kitchen"},{entity_id:"binary_sensor.office_door",name:"דלת חדר עבודה",domain:"binary_sensor",device_class:"door",area_id:"office"},{entity_id:"binary_sensor.motion_living",name:"תנועה בסלון",domain:"binary_sensor",device_class:"motion",area_id:"living"},{entity_id:"binary_sensor.motion_office",name:"תנועה בחדר עבודה",domain:"binary_sensor",device_class:"motion",area_id:"office"},{entity_id:"cover.living_terrace",name:"תריס מרפסת",domain:"cover",device_class:"shutter",area_id:"living"},{entity_id:"cover.office",name:"תריס חדר עבודה",domain:"cover",device_class:"shutter",area_id:"office"},{entity_id:"sensor.living_temp",name:"טמפרטורה סלון",domain:"sensor",device_class:"temperature",area_id:"living"},{entity_id:"light.living",name:"תאורת סלון",domain:"light",device_class:null,area_id:"living"},{entity_id:"light.kitchen",name:"תאורת מטבח",domain:"light",device_class:null,area_id:"kitchen"},{entity_id:"light.hall",name:"תאורת כניסה",domain:"light",device_class:null,area_id:"hall"},{entity_id:"light.office",name:"תאורת חדר עבודה",domain:"light",device_class:null,area_id:"office"},{entity_id:"light.floor_lamp",name:"מנורת רצפה סלון",domain:"light",device_class:null,area_id:null},{entity_id:"binary_sensor.smoke_corridor",name:"גלאי עשן מסדרון",domain:"binary_sensor",device_class:"smoke",area_id:null}],zt=[{id:"demo-cam-entry",name:"מצלמת כניסה"},{id:"demo-cam-terrace",name:"מצלמת מרפסת"},{id:"demo-cam-yard",name:"מצלמת חצר"}];function P(e,s){const t=Math.round(e*100);return t>=s.auto_accept?"sure":t>=s.review_min?"check":"doubt"}function de(e,s){return[...e.walls.map(i=>({id:i.id,kind:"wall",band:P(i.confidence,s),confidence:i.confidence})),...e.openings.map(i=>({id:i.id,kind:i.kind,band:P(i.confidence,s),confidence:i.confidence}))].filter(i=>i.band!=="sure").sort((i,a)=>i.confidence-a.confidence||(i.id<a.id?-1:i.id>a.id?1:0))}function Mt(e,s){const t={sure:0,check:0,doubt:0};for(const i of e.walls)t[P(i.confidence,s)]+=1;for(const i of e.openings)t[P(i.confidence,s)]+=1;return t}function It(e,s){const t=e.walls.find(a=>a.id===s);if(t)return t.kind==="railing"?"railing":"wall";const i=e.openings.find(a=>a.id===s);return i?i.kind==="door"?i.swing==="sliding"?"sliding":"door":i.kind:null}const St=[{id:"wall",he:r("קיר")},{id:"railing",he:r("מעקה או קיר נמוך")},{id:"none",he:r("אין כאן קיר")}],Dt=[{id:"sliding",he:r("דלת הזזה")},{id:"door",he:r("דלת רגילה")},{id:"passage",he:r("מעבר פתוח")},{id:"window",he:r("חלון")},{id:"none",he:r("אין כאן פתח")}],Pt={wall:r("קיר"),door:r("דלת"),window:r("חלון"),passage:r("מעבר פתוח")};function Rt(e,s){const t=e.openings.find(a=>a.id===s);return t?t.kind==="door"&&t.swing==="sliding"?r("זוהה כדלת הזזה"):t.kind==="passage"?r("זוהה כמעבר פתוח"):r("זוהה כ{kind}",{kind:Pt[t.kind]}):e.walls.find(a=>a.id===s)?.kind==="railing"?r("זוהה כמעקה"):r("זוהה כקיר")}function At(e,s){return s==="none"?null:s==="sliding"?e.kind==="door"&&e.swing==="sliding"?{}:{kind:"door",swing:"sliding",height_m:2.1,sill_m:0}:s==="door"?e.kind==="door"&&e.swing!=="sliding"?{}:{kind:"door",swing:"left",height_m:2.1,sill_m:0}:s==="passage"?e.kind==="passage"?{}:{kind:"passage",swing:"none",height_m:2.1,sill_m:0}:e.kind==="window"?{}:{kind:"window",swing:"none",height_m:1.2,sill_m:.9}}function Ot(e,s){return s==="none"?null:s==="railing"?e.kind==="railing"?{}:{kind:"railing"}:e.kind==="railing"?{kind:"interior"}:{}}function Et(e,s,t){const i=new Set,a={},o={byChoice:0,byDoubt:0,byPolicy:0,orphans:0},n=p=>{const u=P(p,t);return u==="sure"||u==="check"&&t.unreviewed==="as_detected"?!0:(u==="check"?o.byPolicy+=1:o.byDoubt+=1,!1)};for(const p of e.walls){const u=s[p.id];if(u===void 0){n(p.confidence)&&i.add(p.id);continue}const m=Ot(p,u);if(!m){o.byChoice+=1;continue}i.add(p.id),Object.keys(m).length&&(a[p.id]=m)}for(const p of e.openings){const u=s[p.id];let m;if(u===void 0)m=n(p.confidence);else{const d=At(p,u);m=!!d,d?Object.keys(d).length&&(a[p.id]=d):o.byChoice+=1}if(m){if(!i.has(p.wall_id)&&s[p.wall_id]==="none"){o.orphans+=1,delete a[p.id];continue}i.add(p.id)}}const l=He(e,Qe(e).filter(p=>i.has(p))),h=e.objects.filter(p=>P(p.confidence,t)==="sure").map(p=>p.id);return{accepted:[...l,...h],edits:a,rejected:o}}function jt(e,s,t){let i=null;for(const a of e.walls)for(let o=1;o<a.polyline.length;o++){const n=a.polyline[o-1],l=a.polyline[o],h=Math.hypot((l[0]-n[0])*s,(l[1]-n[1])*t);(!i||h>i.px)&&(i={id:a.id,a:[n[0],n[1]],b:[l[0],l[1]],px:h})}return i}const E=[{id:"entrance",he:r("כניסה"),kind:"room",tags:["entrance"],words:["כניסה","לובי","מבואה"]},{id:"corridor",he:r("מעבר"),kind:"corridor",tags:["corridor"],words:["מסדרון","מעבר","פרוזדור"]},{id:"living",he:r("סלון"),kind:"room",tags:["living"],words:["סלון","מגורים","אירוח"]},{id:"kitchen",he:r("מטבח"),kind:"room",tags:["kitchen"],words:["מטבח","מטבחון","פינת אוכל"]},{id:"bedroom",he:r("חדר שינה"),kind:"room",tags:["bedroom"],words:["שינה","הורים","ילדים"]},{id:"office",he:r("חדר עבודה"),kind:"room",tags:["office"],words:["עבודה","משרד","מחשב"]},{id:"meeting",he:r("חדר ישיבות"),kind:"room",tags:["meeting"],words:["ישיבות","כנסים"]},{id:"wc",he:r("שירותים"),kind:"room",tags:["wc"],words:["שירותים","אורחים"]},{id:"bath",he:r("אמבטיה"),kind:"room",tags:["bath"],words:["אמבטיה","מקלחת","רחצה"]},{id:"stairs",he:r("חדר מדרגות"),kind:"corridor",tags:["stairs"],words:["מדרגות"]},{id:"service",he:r("חדר שירות"),kind:"service",tags:["service"],words:["שירות","כביסה"]},{id:"storage",he:r("מחסן"),kind:"service",tags:["storage"],words:["מחסן","אחסון"]},{id:"technical",he:r("חדר טכני"),kind:"service",tags:["technical"],words:["טכני","שרתים","חשמל","תקשורת"]},{id:"balcony",he:r("מרפסת"),kind:"outdoor",tags:["balcony"],words:["מרפסת"]},{id:"parking",he:r("חניה"),kind:"outdoor",tags:["parking"],words:["חניה","חנייה","חניון"]},{id:"other",he:r("אחר"),kind:"zone",tags:[],words:[]}],Q=e=>E.find(s=>s.id===e)??E[E.length-1];function q(e){const s=e.trim();if(!s)return null;for(const t of E)if(t.words.some(i=>s.includes(i)))return t.id;return null}const L=e=>`חדר ${e+1}`;function ie(e){let s=0,t=0,i=0;for(let a=0,o=e.length-1;a<e.length;o=a++){const n=e[o].x*e[a].y-e[a].x*e[o].y;s+=n,t+=(e[o].x+e[a].x)*n,i+=(e[o].y+e[a].y)*n}if(Math.abs(s)<1e-12){const a=Math.max(1,e.length);return{x:e.reduce((o,n)=>o+n.x,0)/a,y:e.reduce((o,n)=>o+n.y,0)/a}}return{x:t/(3*s),y:i/(3*s)}}const G=[{id:"apartment",he:A.apartment,note:r("פרקט, קירות בהירים, ריהוט בית"),level:"oak",floors:{default:"oak",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",service:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",parking:"asphalt"},furniture:{living:["sofa.3","table.side"],kitchen:["table.dining"],bedroom:["wardrobe"],office:["table.desk","chair.office"],meeting:["table.meeting"],wc:["toilet.standard"],bath:["bathtub","sink.bathroom"],entrance:["coat.rack"]}},{id:"office",he:A.office,note:r("שטיח, שולחנות עבודה, חדרי ישיבות"),level:"carpet",floors:{default:"carpet",entrance:"tiles_grey",corridor:"tiles_grey",kitchen:"tiles_grey",wc:"tiles_grey",bath:"tiles_grey",stairs:"tiles_grey",balcony:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt"},furniture:{office:["table.desk","chair.office"],living:["sofa.2","table.side"],meeting:["table.meeting"],kitchen:["table.round"],wc:["toilet.standard"],bath:["sink.bathroom"],entrance:["bench.indoor"],technical:["rack.server"]}},{id:"lobby",he:A.lobby,note:r("אבן, עמדת קבלה, ישיבה"),level:"tiles_grey",floors:{default:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt",office:"carpet"},furniture:{entrance:["counter.reception"],living:["sofa.2","armchair","table.side"],corridor:["bench.indoor"],meeting:["table.meeting"],office:["table.desk","chair.office"],kitchen:["table.round"],wc:["toilet.standard"]}},{id:"technical",he:A.technical,note:r("בטון, סימוני רצפה, בלי ריהוט"),level:"concrete",floors:{default:"concrete",parking:"asphalt",wc:"tiles_grey",bath:"tiles_grey"},furniture:{parking:["parking.space","parking.space"],technical:["rack.server"]}},{id:"commercial",he:A.commercial,note:r("אריחים, מדפים, דלפק"),level:"tiles_grey",floors:{default:"tiles_grey",storage:"concrete",technical:"concrete",service:"concrete",parking:"asphalt",office:"carpet"},furniture:{entrance:["counter.straight"],living:["shelf.unit","shelf.unit","shelf.unit"],other:["shelf.unit","shelf.unit","shelf.unit"],storage:["rack.pallet"],office:["table.desk","chair.office"],kitchen:["table.round"],wc:["toilet.standard"]}},{id:"empty",he:A.empty,note:r("חומרים בלבד, בלי ריהוט"),level:"concrete",floors:{default:"concrete",parking:"asphalt"},furniture:{}}],H=e=>G.find(s=>s.id===e)??G[0],V=(e,s)=>e.floors[s]??e.floors.default,N={"sofa.3":{w_m:2.1,d_m:.9,h_m:.85},"sofa.2":{w_m:1.6,d_m:.9,h_m:.85},"table.side":{w_m:.5,d_m:.5,h_m:.5},"table.dining":{w_m:1.6,d_m:.9,h_m:.75},"table.round":{w_m:1.2,d_m:1.2,h_m:.75},wardrobe:{w_m:1.5,d_m:.6,h_m:2.2},"table.desk":{w_m:1.4,d_m:.7,h_m:.75},"chair.office":{w_m:.6,d_m:.6,h_m:1.1},"table.meeting":{w_m:3,d_m:1.2,h_m:.75},"toilet.standard":{w_m:.4,d_m:.7,h_m:.8},bathtub:{w_m:1.7,d_m:.75,h_m:.6},"sink.bathroom":{w_m:.6,d_m:.45,h_m:.85},"coat.rack":{w_m:.4,d_m:.4,h_m:1.8},"bench.indoor":{w_m:1.8,d_m:.4,h_m:.45},"rack.server":{w_m:.6,d_m:1,h_m:2},"counter.reception":{w_m:3,d_m:.8,h_m:1.1},armchair:{w_m:.85,d_m:.85,h_m:.8},"counter.straight":{w_m:2,d_m:.6,h_m:1.1},"shelf.unit":{w_m:.9,d_m:.4,h_m:2},"rack.pallet":{w_m:2.7,d_m:1.1,h_m:3},"parking.space":{w_m:2.5,d_m:5,h_m:.05}},pe="plan-wizard";function Tt(e,s,t,i,a){const o=e.levels.find(u=>u.is_default)??e.levels[0];let n={...e,objects:e.objects.filter(u=>!u.tags?.includes(pe))};o&&(n={...n,levels:n.levels.map(u=>u.id===o.id?{...u,floor_material_id:t.level}:u)});const l=e.dimensions.width_px||1e3,h=e.dimensions.height_px||1e3,p=[];for(const u of s){const m=Q(u.typeId);if(n.rooms.some(k=>k.id===u.id)?n={...n,rooms:n.rooms.map(k=>k.id===u.id?{...k,tags:m.tags}:k)}:n={...n,rooms:[...n.rooms,{id:u.id,level_id:u.level_id??o?.id??null,tags:m.tags}]},n=tt(n,"rooms",u.id,"floor_material_id",V(t,m.id)),!i)continue;const d=(t.furniture[m.id]??[]).filter(k=>N[k]);if(!d.length||u.polygon.length<3)continue;const x=u.polygon.map(k=>k.x),y=u.polygon.map(k=>k.y),z=(Math.max(...x)-Math.min(...x))*l*a,I=(Math.max(...y)-Math.min(...y))*h*a,S=ie(u.polygon),$=d.reduce((k,B)=>k+N[B].w_m,0)+.3*(d.length-1),U=Math.max(...d.map(k=>N[k].d_m));if($+.6>z||U+.6>I)continue;let ae=-$/2;d.forEach((k,B)=>{const Z=N[k],Oe=ae+Z.w_m/2;ae+=Z.w_m+.3,p.push({id:`wz-${u.id}-${B}`.slice(0,64),item_id:k,level_id:u.level_id??o?.id??"L0",position:[j(S.x+Oe/(l*a)),j(S.y)],rotation_deg:0,size:{...Z},z_m:0,params:{},label:null,anchor_ref:null,group_id:null,confidence:1,source:"manual",locked:!1,external_ids:{},tags:[pe]})})}return st({...n,objects:[...n.objects,...p]})}const j=e=>Math.round(Math.min(1,Math.max(0,e))*1e5)/1e5,Ct=new Set(["door","garage_door","opening"]),Ft=new Set(["window"]);function qt(e){return e.domain==="lock"?"door":e.domain==="cover"?e.device_class==="garage"||e.device_class==="door"||e.device_class==="gate"?"door":"window":e.domain==="binary_sensor"&&e.device_class&&Ct.has(e.device_class)?"door":e.domain==="binary_sensor"&&e.device_class&&Ft.has(e.device_class)?"window":null}function Lt(e,s){let t=!1;for(let i=0,a=s.length-1;i<s.length;a=i++){const o=s[i],n=s[a];o.y>e.y!=n.y>e.y&&e.x<(n.x-o.x)*(e.y-o.y)/(n.y-o.y)+o.x&&(t=!t)}return t}function Nt(e,s,t,i=!0){const a=new Set,o=new Map;return e.map(n=>{const l=n.area_id?s.find(x=>x.area_id===n.area_id):void 0;if(!l||!i)return{entity_id:n.entity_id,name:n.name,domain:n.domain,room:l?.name??null,x:null,y:null,where:"manual"};const h=ie(l.polygon),p=qt(n);if(p){const x=t.filter(y=>y.kind===p&&!a.has(y.id)&&Lt(he(y,h,.04),l.polygon)).sort((y,z)=>Math.hypot(y.x-h.x,y.y-h.y)-Math.hypot(z.x-h.x,z.y-h.y))[0];if(x){a.add(x.id);const y=he(x,h,.06);return{entity_id:n.entity_id,name:n.name,domain:n.domain,room:l.name,x:y.x,y:y.y,where:p}}}const u=o.get(l.id)??0;o.set(l.id,u+1);const m=u*2.399963,d=u===0?0:.028*Math.sqrt(u);return{entity_id:n.entity_id,name:n.name,domain:n.domain,room:l.name,x:j(h.x+d*Math.cos(m)),y:j(h.y+d*Math.sin(m)),where:"centre"}})}function he(e,s,t){return{x:j(e.x+(s.x-e.x)*t),y:j(e.y+(s.y-e.y)*t)}}function Vt(e){return e.map(s=>({entity_id:s.id,name:s.name,domain:"camera",resource:"camera",room:null,x:null,y:null,where:"manual"}))}const D=e=>e.resource==="camera",ue={door:r("ליד הדלת שזוהתה"),window:r("ליד החלון שזוהה"),centre:r("מרכז החדר"),manual:r("בחר ולחץ על המפה"),none:r("לא יוצב")},Wt=r("הוצבה במקום שסימנת");function Gt(e){return E.find(t=>t.tags.length&&t.tags.every(i=>e?.includes(i)))?.id??"other"}const C="#1b1f27",v=e=>Math.round(e*10)/10,Ae=e=>e.map(s=>`${v(s[0])},${v(s[1])}`).join(" ");function Kt(e){let s="";for(const t of e)if(t.kind==="wall")s+=`<polyline points="${Ae(t.points)}" fill="none" stroke="${C}" stroke-width="${v(Math.max(3,t.width))}" stroke-linejoin="miter" stroke-linecap="butt"/>`;else if(t.kind==="door"){for(const i of t.leaves)s+=`<line x1="${v(i[0][0])}" y1="${v(i[0][1])}" x2="${v(i[1][0])}" y2="${v(i[1][1])}" stroke="${C}" stroke-width="2"/>`;for(const i of t.arcs)s+=`<path d="M${v(i.from[0])},${v(i.from[1])} A${v(i.r)},${v(i.r)} 0 0 ${i.sweep} ${v(i.to[0])},${v(i.to[1])}" fill="none" stroke="${C}" stroke-width="1.3"/>`}else if(t.kind==="window")for(const i of t.lines)s+=`<line x1="${v(i[0][0])}" y1="${v(i[0][1])}" x2="${v(i[1][0])}" y2="${v(i[1][1])}" stroke="${C}" stroke-width="1.5"/>`;return s}function Ut(e){const s=e.dimensions.width_px,t=e.dimensions.height_px,i=`<g stroke="${C}" stroke-width="1.2" fill="none"><path d="M42,20H958M42,12v16M958,12v16M292,12v16M20,42V858M12,42h16M12,858h16"/><path d="M0,470H${s}" stroke-dasharray="14 8 3 8"/><rect x="${s-250}" y="${t-40}" width="236" height="34"/></g>`,a=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${t}" width="${s}" height="${t}"><rect width="${s}" height="${t}" fill="#ffffff"/>${i}${Kt(Se(e,s,t))}</svg>`;return`data:image/svg+xml;charset=utf-8,${encodeURIComponent(a)}`}const O={sure:"var(--wz-sure)",check:"var(--wz-check)",doubt:"var(--wz-doubt)"};function me(e,s){const t=e.dimensions.width_px,i=e.dimensions.height_px,a=new Map,o=new Map;for(const n of Se(Xe(e,s),t,i))n.kind==="wall"?a.set(n.id,[...a.get(n.id)??[],n.points]):(n.kind==="door"||n.kind==="window"||n.kind==="passage")&&o.set(n.id,n.gap);return{walls:a,gaps:o}}function X(e,s){const t=e.gaps.get(s);if(t)return[(t[0][0]+t[1][0])/2,(t[0][1]+t[1][1])/2];const i=e.walls.get(s);if(!i?.length)return null;const a=[...i].sort((o,n)=>fe(n)-fe(o))[0];return a.length>=2?[(a[0][0]+a[a.length-1][0])/2,(a[0][1]+a[a.length-1][1])/2]:a[0]}const fe=e=>e.slice(1).reduce((s,t,i)=>s+Math.hypot(t[0]-e[i][0],t[1]-e[i][1]),0);function ge(e,s,t,i,a,o){const n=new Map([...s.walls.map(m=>[m.id,m.confidence]),...s.openings.map(m=>[m.id,m.confidence])]),l=m=>i.has(m)?"sure":P(n.get(m)??1,t),h=[...e.walls.entries()].map(([m,d])=>{const x=l(m),y=a.has(m);return d.map(z=>_`<polyline data-cand=${m} points=${Ae(z)} fill="none" stroke=${y?"var(--wz-out)":O[x]} stroke-width="7" stroke-linecap="round" stroke-dasharray=${x==="doubt"&&!y?"10 9":y?"3 8":"none"} opacity=".85"/>`)}),p=[...e.gaps.entries()].map(([m,[d,x]])=>{const y=l(m),z=a.has(m),I=[(d[0]+x[0])/2,(d[1]+x[1])/2],S=o===m;return _`<line data-cand=${m} x1=${v(d[0])} y1=${v(d[1])} x2=${v(x[0])} y2=${v(x[1])} stroke=${z?"var(--wz-out)":O[y]} stroke-width="9" stroke-linecap="round" stroke-dasharray=${y==="doubt"&&!z?"3 12":"none"} opacity=".95"/>
      ${y!=="sure"||S?_`<circle data-cand=${m} cx=${v(I[0])} cy=${v(I[1])} r=${S?46:26} fill=${O[y]} fill-opacity=${S?.16:.1} stroke=${O[y]} stroke-width=${S?4:2}/>`:b}`}),u=o&&e.walls.has(o)?X(e,o):null;return _`<g class="ov">${h}${p}${u?_`<circle cx=${v(u[0])} cy=${v(u[1])} r="46" fill=${O[l(o)]} fill-opacity=".14" stroke=${O[l(o)]} stroke-width="4"/>`:b}</g>`}const we=["#7aa7ff","#b99cf0","#8fd0c8","#f5c26b","#f09a8a","#9ccf7f","#e8a3d3","#b8bfcc","#7fc4e8","#d9b48f","#a3b8f0","#c9d97f"],J=e=>we[e%we.length];function ve(e,s,t,i,a){return _`<g class="rooms">${e.map((o,n)=>{const l=ie(o.polygon),h=o.polygon.map(p=>`${v(p.x*s)},${v(p.y*t)}`).join(" ");return _`<polygon data-room=${n} points=${h} fill=${J(n)} fill-opacity=${i==="name"?a===n?.62:.42:.16} stroke=${a===n?"var(--sw-accent)":"none"} stroke-width="4"/>
      ${i==="name"?_`<g data-room=${n}><circle cx=${v(l.x*s)} cy=${v(l.y*t)} r="24" fill="#fff" stroke=${J(n)} stroke-width="3"/><text x=${v(l.x*s)} y=${v(l.y*t+8)} text-anchor="middle" font-size="24" font-weight="700" fill="#1e2e47">${n+1}</text></g>`:b}`})}</g>`}function Bt(e,s,t,i){return _`<g class="devs">${e.filter(a=>a.x!==null&&a.y!==null).map(a=>{const o=v(a.x*s),n=v(a.y*t),l=a.entity_id===i,h=a.where==="manual"?"var(--wz-check)":"var(--wz-sure)",p=a.resource==="camera"?_`<rect x=${v(a.x*s-15)} y=${v(a.y*t-15)} width="30" height="30" rx="7" fill=${h} stroke="#fff" stroke-width="4"/>`:_`<circle cx=${o} cy=${n} r="15" fill=${h} stroke="#fff" stroke-width="4"/>`;return _`<g data-dev=${a.entity_id} data-dev-kind=${a.resource??"ha_entity"}>${l?_`<circle cx=${o} cy=${n} r="30" fill="var(--sw-accent)" fill-opacity=".16" stroke="var(--sw-accent)" stroke-width="3"/>`:b}${p}</g>`})}</g>`}const be="אשף תוכנית חדשה",ye="plan.wizard";class Zt{constructor(s){this.floorId=s,this.demo=!1}async prefs(){try{const s=await Te("me/prefs");return W(s.prefs[ye])}catch{return W(null)}}async savePrefs(s){await Ce("me/prefs",{[ye]:s})}async upload(s){const t=await Fe(this.floorId,s);return{assetId:t.id,name:t.original_name,pages:t.pages.map(i=>({page:i.page,url:Ie(i.preview_url)}))}}async createVersion(s,t){const i=await qe(this.floorId,{asset_id:s,page:t,rotation:0,crop:null,notes:be});return xe(i)}async draft(s){const t=await rt(s,{draft:!0});return{doc:t.doc,revision:t.geometry.revision}}detect(s){return nt(s,{targets:["walls","openings"]})}async estimate(s,t){await ot(s,t.scale_m_per_px,t.reason)}async measure(s,t,i,a){return(await lt(s,[{a:t,b:i,metres:a}])).scale_m_per_px}async accept(s,t){const i=await ct(s,t);return{doc:i.doc,revision:i.geometry.revision}}async detectRooms(){const s=await pt(this.floorId,"medium");return{rooms:s.rooms.map(t=>({polygon:t.polygon,name:""})),existingAuto:s.existing_auto}}async acceptRooms(s,t,i){for(const n of i)await le(n).catch(()=>{});const a=await ht(this.floorId,s,t),o=new Set(a.created);return a.created.map(n=>a.zones.find(l=>l.id===n)).filter(n=>!!n&&o.has(n.id)).map(n=>({id:n.id,revision:n.revision,polygon:n.polygon,level_id:n.level_id??null}))}async tagRoom(s,t,i){await ut(s.id,{revision:s.revision,tags:t,...i?{area_id:i}:{}})}async areas(){return(await re({limit:1})).areas.filter(t=>t.area_name).map(t=>({area_id:t.area_id,name:t.area_name}))}async saveDraft(s,t,i){const a=await dt(s,t,i);return{doc:a.doc,revision:a.geometry.revision}}async entities(){return(await re({placed:!1,limit:300})).entities.filter(t=>!t.disabled&&!t.hidden&&t.area_id).map(t=>({entity_id:t.entity_id,name:t.name||t.original_name||t.entity_id,domain:t.domain,device_class:t.device_class,area_id:t.area_id}))}async catalog(){try{const s=await ft();return{lookup3d:wt(s),materials:gt(s)}}catch{return{lookup3d:null,materials:null}}}async cameras(){const s=await Le(this.floorId,!0),t=new Set(s.anchors.filter(i=>i.resource_type==="camera").map(i=>i.resource_id));return(s.cameras??[]).filter(i=>!t.has(i.id)).map(i=>({id:i.id,name:i.name||i.id}))}async publish(s,t){if(await Ne(s),!t.length)return{placed:0,failed:0,refused:[]};if((await ne(this.floorId).then(n=>n.versions.filter(l=>l.status==="draft"&&l.id!==s)).catch(()=>[])).length)return{placed:0,failed:t.length,refused:t.map(n=>({id:n.entity_id,code:"other_draft"})),blocked:"other_draft"};let a=0;const o=[];for(const n of t)try{await Ve(this.floorId,{resource_type:n.resource_type??"ha_entity",resource_id:n.entity_id,x:n.x,y:n.y,level_id:n.level_id}),a+=1}catch(l){o.push({id:n.entity_id,code:l instanceof F?l.code:"error"})}return{placed:a,failed:o.length,refused:o}}async resumable(){const t=(await ne(this.floorId)).versions.filter(i=>i.status==="draft").sort((i,a)=>i.created_at<a.created_at?1:-1)[0];return t&&t.notes===be?{version:xe(t),createdAt:t.created_at}:null}async resumeRooms(s){return(await mt(this.floorId)).zones.filter(i=>i.plan_version_id===s&&i.source==="auto").map(i=>({id:i.id,revision:i.revision,polygon:i.polygon,level_id:i.level_id??null,name:i.name,tags:i.tags??[]}))}async discard(s,t){for(const i of t)await le(i).catch(a=>{if(!(a instanceof F&&a.status===404))throw a});await We(s)}}function xe(e){const s=e.image_url??"";return{versionId:e.id,imageUrl:s?Ie(s):"",width:e.width_px,height:e.height_px}}class K{constructor(s=!1){this.resume=s,this.demo=!0,this.doc=Re(),this.revision=0,this.wait=t=>new Promise(i=>setTimeout(i,t))}static{this.prefsMem=null}async prefs(){return W(K.prefsMem)}async savePrefs(s){K.prefsMem={...s}}async upload(s){return await this.wait(150),{assetId:"demo-asset",name:s.name,pages:[{page:1,url:""}]}}async createVersion(){return{versionId:"demo-wizard",imageUrl:Ut(Pe()),width:this.doc.dimensions.width_px,height:this.doc.dimensions.height_px}}async draft(){return{doc:this.doc,revision:this.revision}}async detect(){return await this.wait(900),yt()}async estimate(){}async measure(s,t,i,a){const o=Math.hypot((i[0]-t[0])*this.doc.dimensions.width_px,(i[1]-t[1])*this.doc.dimensions.height_px),n=a/Math.max(1,o);return this.doc={...this.doc,dimensions:{...this.doc.dimensions,scale_m_per_px:n,calibration:{status:"measured",method:"two_point",pairs:[{a:t,b:i,metres:a}],residual_pct:null,reason:null}}},n}async accept(s,t){const i=new Set(t.accepted),a=t.edits;return this.doc={...this.doc,walls:t.candidates.walls.filter(o=>i.has(o.id)).map(o=>({...o,...a[o.id]??{}})),openings:t.candidates.openings.filter(o=>i.has(o.id)).map(o=>({...o,...a[o.id]??{}})),objects:[...this.doc.objects.filter(o=>o.source!=="auto"),...(t.candidates.objects??[]).filter(o=>i.has(o.id))]},this.revision+=1,{doc:this.doc,revision:this.revision}}async detectRooms(){return await this.wait(200),{rooms:$t(),existingAuto:0}}async acceptRooms(s){return s.map((t,i)=>({id:`demo-room-${i+1}`,revision:1,polygon:t.polygon,level_id:"L0"}))}async tagRoom(){}async areas(){return kt}async saveDraft(s,t){return this.doc=t,this.revision+=1,{doc:this.doc,revision:this.revision}}async entities(){return _t}async catalog(){return{lookup3d:null,materials:null}}async cameras(){return zt}async publish(s,t){return await this.wait(300),{placed:t.length,failed:0,refused:[]}}async resumable(){return this.resume?{version:await this.createVersion(),createdAt:"2026-11-12T08:30:00Z"}:null}async resumeRooms(){return[]}async discard(){await this.wait(100)}}function Yt(e,s=!1){return je()?new Zt(e):new K(s)}const Ht=Ge`
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
`;var Qt=Object.defineProperty,Xt=Object.getOwnPropertyDescriptor,g=(e,s,t,i)=>{for(var a=i>1?void 0:i?Xt(s,t):s,o=e.length-1,n;o>=0;o--)(n=e[o])&&(a=(i?n(s,t,a):n(a))||a);return i&&a&&Qt(s,t,a),a};const $e=[r("העלאה"),r("זיהוי"),r("בדיקה"),r("חדרים"),r("סגנון"),r("התקנים"),r("סיום")],ke=8,_e=4,Jt=7,es=4,ts={forbidden:r("אין הרשאה"),already_placed:r("כבר הוצב"),validation:r("לא קיים"),not_placeable:r("לא ניתן להצבה")},ze=e=>{try{return new Date(e).toLocaleString(Ze(),{day:"numeric",month:"numeric",hour:"2-digit",minute:"2-digit"})}catch{return""}},Me=(e,s)=>{const t=at.find(i=>i.id===e);return t?.tint?s?t.tint.dark:t.tint.light:"#cccccc"},ss=e=>e==="light"?"light":e==="lock"?"lock":e==="cover"?"coverClose":e==="camera"?"camera":e==="sensor"?"thermometer":"sensor";let f=class extends Ke{constructor(){super(...arguments),this.floorId="",this.demoStep=0,this.demoResume=!1,this.step=1,this.prefs={...Y},this.prefsOpen=!1,this.prefsDraft={...Y},this.floor=null,this.ceiling=2.8,this.busy=!1,this.error="",this.dragOver=!1,this.uploaded=null,this.page=1,this.version=null,this.versionPage=1,this.resumeInfo=null,this.replace=null,this.phases={structure:"idle",rooms:"idle"},this.elapsed=0,this.result=null,this.set=null,this.draft=null,this.decisions={},this.current=null,this.measure={open:!1,metres:""},this.rooms=[],this.roomsPage=0,this.roomFocus=null,this.existingAuto=0,this.replaceAuto=!1,this.areas=[],this.created=[],this.kit="apartment",this.furniture=!0,this.catalog={lookup3d:null,materials:null},this.three="idle",this.placements=[],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices",this.done=null,this.backend=null,this.token=0,this.small=!1,this.mq=null,this.onMq=()=>{this.small=!!this.mq?.matches,this.requestUpdate()},this.onKey=e=>this.key(e),this.sceneMemo={key:"",desc:null},this.geomMemo=null}connectedCallback(){super.connectedCallback();try{this.mq=window.matchMedia("(max-width: 767px), (max-height: 760px)"),this.small=this.mq.matches,this.mq.addEventListener("change",this.onMq)}catch{this.mq=null}window.addEventListener("keydown",this.onKey),this.init()}disconnectedCallback(){super.disconnectedCallback(),this.mq?.removeEventListener("change",this.onMq),window.removeEventListener("keydown",this.onKey),clearInterval(this.timer),this.token++}willUpdate(e){e.has("floorId")&&e.get("floorId")!==void 0&&this.init()}async init(){const e=++this.token;this.backend=Yt(this.floorId,this.demoResume);const s=this.backend;try{const[t,i]=await Promise.all([s.prefs(),Ue()]);if(e!==this.token)return;this.prefs=t,this.kit=t.kit,this.furniture=t.furniture&&t.kit!=="empty";const a=Be(i,this.floorId);if(a?this.floor={name:a.floor.name,crumb:`${a.site.name} · ${a.building.name}`,hasPlan:a.floor.has_plan,siblings:(a.building.floors??[]).map(o=>({id:o.id,name:o.name}))}:this.floor={name:"",crumb:"",hasPlan:!1,siblings:[]},!(s.demo&&this.demoStep>1)){const o=await s.resumable().catch(()=>null);e===this.token&&!this.version&&(this.resumeInfo=o)}}catch(t){e===this.token&&(this.error=M(t))}s.demo&&this.demoStep>1&&await this.demoTo(Math.min(7,this.demoStep),e)}async demoTo(e,s){await this.onFile(new File(["demo"],"תוכנית-קרקע.png",{type:"image/png"}),e===2),!(s!==this.token||e<=3)&&(await this.confirmReview(),!(s!==this.token||e<=4)&&(await this.saveRooms(),!(s!==this.token||e<=5)&&(await this.saveStyle(),!(s!==this.token||e<=6)&&(this.step=7))))}get ownDraft(){return this.version?.versionId??this.resumeInfo?.version.versionId??null}async onFile(e,s=!1){const t=this.backend;if(!(!e||!t||this.busy)){if(this.ownDraft){this.replace={kind:"file",file:e};return}this.busy=!0,this.error="";try{if(this.uploaded=await t.upload(e),this.page=1,this.uploaded.pages.length>1)return;await this.startVersion(s)}catch(i){this.error=M(i)}finally{this.busy=!1}}}async startVersion(e=!1){const s=this.backend;!s||!this.uploaded||(this.version=await s.createVersion(this.uploaded.assetId,this.page),this.versionPage=this.page,this.step=2,await this.runDetect(e))}reuseVersion(){this.busy||!this.version||(this.step=2,this.runDetect())}async confirmReplace(){const e=this.backend,s=this.replace,t=this.ownDraft;if(!(!e||!s||!t||this.busy)){this.busy=!0,this.error="";try{const i=this.version?this.created.map(a=>a.id):(await e.resumeRooms(t)).map(a=>a.id);await e.discard(t,i),this.version=null,this.resumeInfo=null,this.created=[],this.rooms=[],this.set=null,this.result=null,this.draft=null,this.replace=null}catch(i){this.replace=null,this.error=r("הטיוטה הקודמת לא נמחקה, ולכן התוכנית החדשה לא הועלתה: {error}",{error:M(i)});return}finally{this.busy=!1}s.kind==="file"?await this.onFile(s.file):await this.pickPage()}}async resumeWizard(){const e=this.backend,s=this.resumeInfo;if(!e||!s||this.busy)return;this.busy=!0,this.error="";const t=this.token;try{this.version=s.version,this.uploaded={assetId:"",name:r("התוכנית מהטיוטה"),pages:[{page:1,url:""}]},this.resumeInfo=null;const i=await e.draft(s.version.versionId);if(t!==this.token)return;if(this.draft=i,!i.doc.walls.length){this.busy=!1,this.step=2,await this.runDetect();return}const a=await e.resumeRooms(s.version.versionId);if(t!==this.token)return;if(a.length)this.created=a.map(({id:o,revision:n,polygon:l,level_id:h})=>({id:o,revision:n,polygon:l,level_id:h})),this.rooms=a.map(o=>({polygon:o.polygon,name:o.name,typeId:Gt(o.tags)}));else{const o=await e.detectRooms().catch(()=>({rooms:[],existingAuto:0}));this.rooms=o.rooms.map(n=>({polygon:n.polygon,name:n.name,typeId:q(n.name)??"other"})),this.existingAuto=o.existingAuto}this.phases={structure:"done",rooms:"done"},this.areas=await e.areas().catch(()=>[]),this.roomsPage=0,this.step=4}catch(i){this.error=M(i)}finally{this.busy=!1}}async pickPage(){if(!this.busy){this.busy=!0,this.error="";try{await this.startVersion()}catch(e){this.error=M(e)}finally{this.busy=!1}}}async runDetect(e=!1){const s=this.backend,t=this.version;if(!s||!t)return;const i=this.token;this.error="",this.phases={structure:"run",rooms:"idle"};const a=Date.now();if(this.elapsed=0,clearInterval(this.timer),this.timer=window.setInterval(()=>this.elapsed=Math.floor((Date.now()-a)/1e3),1e3),e){clearInterval(this.timer);return}try{const[o,n]=await Promise.all([s.draft(t.versionId),s.detect(t.versionId)]);if(i!==this.token)return;this.draft=o,this.result=n,this.set=this.scaled(Je(n),o.doc),this.phases={structure:"done",rooms:"run"},this.decisions={},this.current=de(this.set,this.prefs)[0]?.id??null;try{const l=await s.detectRooms();if(i!==this.token)return;this.rooms=l.rooms.map(h=>({polygon:h.polygon,name:h.name,typeId:q(h.name)??"other"})),this.existingAuto=l.existingAuto,this.phases={structure:"done",rooms:"done"}}catch{this.rooms=[],this.phases={structure:"done",rooms:"error"}}this.step=3}catch(o){if(i!==this.token)return;const n=o instanceof F&&o.code==="detect_timeout";this.error=n?r("הזיהוי לא הסתיים בזמן. תוכנית גדולה או סריקה רועשת לוקחות זמן: נסה שוב, או המשך בסטודיו התוכניות."):M(o),this.phases={...this.phases,structure:"error"}}finally{clearInterval(this.timer)}}scaled(e,s){const{scale:t}=oe(s);return e.scaleMPerPx===null||Math.abs(e.scaleMPerPx-t)>t*1e-6?et(e,t):e}get queue(){return this.set?de(this.set,this.prefs):[]}decide(e){const s=this.current;if(!s)return;this.decisions={...this.decisions,[s]:e};const t=this.queue,i=t.findIndex(o=>o.id===s),a=t.slice(i+1).find(o=>!(o.id in this.decisions))??t.find(o=>!(o.id in this.decisions));a&&(this.current=a.id)}moveQueue(e){const s=this.queue;if(!s.length)return;const t=s.findIndex(i=>i.id===this.current);this.current=s[Math.max(0,Math.min(s.length-1,(t<0?0:t)+e))].id}async measureWall(){const e=this.backend,s=this.version,t=this.set,i=parseFloat(this.measure.metres.replace(",","."));if(!e||!s||!t||!this.draft||!(i>0)||this.busy)return;const a=jt(t,this.draft.doc.dimensions.width_px,this.draft.doc.dimensions.height_px);if(a){this.busy=!0,this.error="";try{await e.measure(s.versionId,a.a,a.b,i),this.draft=await e.draft(s.versionId),this.set=this.scaled(t,this.draft.doc),this.measure={open:!1,metres:""}}catch(o){this.error=M(o)}finally{this.busy=!1}}}async confirmReview(){const e=this.backend,s=this.version,t=this.result;if(!(!e||!s||!t||!this.set||this.busy)){this.busy=!0,this.error="";try{let i=await e.draft(s.versionId);const a=i.doc.dimensions.calibration?.status;a!=="measured"&&a!=="estimated"&&t.calibration_hint&&(await e.estimate(s.versionId,t.calibration_hint),i=await e.draft(s.versionId));const o=this.scaled(this.set,i.doc),n=Et(o,this.decisions,this.prefs);this.draft=await e.accept(s.versionId,{accepted:n.accepted,edits:n.edits,replace_auto:!0,candidates:{walls:o.walls,openings:o.openings,objects:o.objects},base_revision:i.revision,detector:t.detector}),this.set=o,this.step=4,this.roomsPage=0,this.areas.length||(this.areas=await e.areas().catch(()=>[]))}catch(i){this.error=i instanceof F&&i.code==="stale_revision"?r("טיוטת המבנה השתנתה בינתיים בחלון אחר. אשר שוב."):M(i)}finally{this.busy=!1}}}areaOf(e){const s=e.trim();return s?this.areas.find(t=>t.name===s)?.area_id??null:null}setRoom(e,s){this.rooms=this.rooms.map((t,i)=>{if(i!==e)return t;const a={...t,...s};return s.name!==void 0&&(t.typeId==="other"||t.typeId===q(t.name))&&(a.typeId=q(s.name)??t.typeId),a})}async saveRooms(){const e=this.backend;if(!(!e||this.busy)){if(!this.rooms.length){this.created=[],this.step=5;return}this.busy=!0,this.error="";try{const s=this.rooms.map((i,a)=>({polygon:i.polygon,name:i.name.trim()||L(a),kind:Q(i.typeId).kind})),t=await e.acceptRooms(s,this.replaceAuto,this.created.map(i=>i.id));for(let i=0;i<t.length;i++)await e.tagRoom(t[i],Q(this.rooms[i]?.typeId).tags,this.areaOf(this.rooms[i]?.name??""));this.created=t,this.step=5,this.loadThree()}catch(s){this.error=M(s)}finally{this.busy=!1}}}async loadThree(){if(!(this.three!=="idle"||!this.backend)){this.three="loading";try{const[,e]=await Promise.all([Ee(()=>import("./sw-plan-3d-C_X4UNgp.js").then(s=>s.s),__vite__mapDeps([0]),import.meta.url),this.backend.catalog()]);this.catalog=e,this.three="ready"}catch{this.three="failed"}}}styledRooms(){return this.created.map((e,s)=>({id:e.id,typeId:this.rooms[s]?.typeId??"other",polygon:e.polygon,level_id:e.level_id}))}styledDoc(){const e=this.draft?.doc;if(!e)return null;const s={...e,levels:e.levels.map(t=>t.is_default||e.levels.length===1?{...t,ceiling_height_m:this.ceiling}:t)};return Tt(s,this.styledRooms(),H(this.kit),this.furniture&&this.kit!=="empty",oe(e).scale)}scene(){const e=this.styledDoc();if(!e||this.three!=="ready")return null;const s=`${this.draft?.revision}|${this.kit}|${this.furniture}|${this.ceiling}|${this.created.map(i=>i.id).join(",")}`;if(this.sceneMemo.key===s)return this.sceneMemo.desc;let t=null;try{t=it({doc:e,width:e.dimensions.width_px,height:e.dimensions.height_px,anchors:[],entityStates:{},circuitStates:{},catalog:this.catalog.lookup3d,materialsCatalog:this.catalog.materials,realistic:!0,zones:this.created.map((i,a)=>({id:i.id,name:this.rooms[a]?.name||L(a),polygon:i.polygon,level_id:i.level_id}))})}catch{t=null}return this.sceneMemo={key:s,desc:t},t}async saveStyle(){const e=this.backend,s=this.version,t=this.styledDoc();if(!(!e||!s||!t||!this.draft||this.busy)){this.busy=!0,this.error="";try{this.draft=await e.saveDraft(s.versionId,t,this.draft.revision),await this.proposeDevices(),this.step=6}catch(i){this.error=i instanceof F&&i.code==="stale_revision"?r("טיוטת המבנה השתנתה בינתיים בחלון אחר. חזור לשלב הזה ונסה שוב."):M(i)}finally{this.busy=!1}}}async proposeDevices(){const e=this.backend;if(!e||!this.draft)return;const s=await e.entities().catch(()=>[]),t=this.draft.doc,i=t.dimensions.width_px,a=t.dimensions.height_px,o=me(t,{walls:t.walls,openings:t.openings,objects:[]}),n=t.openings.map(d=>{const x=X(o,d.id);return x?{id:d.id,kind:d.kind,x:x[0]/i,y:x[1]/a}:null}).filter(d=>!!d),l=this.created.map((d,x)=>({id:d.id,name:this.rooms[x]?.name.trim()||L(x),area_id:this.areaOf(this.rooms[x]?.name??""),polygon:d.polygon})),h=new Set(l.map(d=>d.area_id).filter(Boolean)),p=s.filter(d=>d.area_id?h.has(d.area_id):e.demo),u=Nt(p,l,n,this.prefs.auto_place),m=await e.cameras().catch(()=>[]);this.placements=[...u.filter(d=>d.where==="manual"),...u.filter(d=>d.where!=="manual"),...Vt(m)],this.skipped=new Set,this.selDev=null,this.devPage=0,this.devTab="devices"}placeAt(e){if(this.step!==6||!this.selDev||!this.draft)return;const s=e.currentTarget,t=s.createSVGPoint();t.x=e.clientX,t.y=e.clientY;const i=s.getScreenCTM();if(!i)return;const a=t.matrixTransform(i.inverse()),o=this.draft.doc.dimensions.width_px,n=this.draft.doc.dimensions.height_px,l=Math.round(Math.min(1,Math.max(0,a.x/o))*1e5)/1e5,h=Math.round(Math.min(1,Math.max(0,a.y/n))*1e5)/1e5,p=this.selDev;this.placements=this.placements.map(m=>m.entity_id===p?{...m,x:l,y:h,where:m.where==="manual"?"centre":m.where}:m);const u=new Set(this.skipped);u.delete(p),this.skipped=u,this.selDev=null}toggleSkip(e){const s=new Set(this.skipped);s.has(e)?s.delete(e):s.add(e),this.skipped=s,this.selDev===e&&(this.selDev=null)}get toPlace(){return this.placements.filter(e=>e.x!==null&&e.y!==null&&e.where!=="manual"&&!this.skipped.has(e.entity_id))}unplace(e){this.placements=this.placements.map(s=>s.entity_id===e?{...s,x:null,y:null,where:"manual"}:s),this.selDev=null}async publish(){const e=this.backend,s=this.version;if(!(!e||!s||this.busy)){this.busy=!0,this.error="";try{const t=this.draft?.doc.levels.find(i=>i.is_default)?.id??this.draft?.doc.levels[0]?.id??null;this.done=await e.publish(s.versionId,this.toPlace.map(i=>({resource_type:i.resource??"ha_entity",entity_id:i.entity_id,x:i.x,y:i.y,level_id:t}))),this.done.failed||T(`/explore/floors/${this.floorId}`)}catch(t){this.error=M(t)}finally{this.busy=!1}}}toStudio(){T(`/explore/floors/${this.floorId}/edit`)}back(){if(this.busy||this.step<=1)return;this.error="";const e=this.step===3?1:this.step-1;if(e===3&&!this.set){this.step=2,this.runDetect();return}this.step=e,this.step===1&&(this.phases={structure:"idle",rooms:"idle"})}next(){this.busy||(this.step===1&&this.version&&(!this.uploaded||this.uploaded.pages.length<2||this.page===this.versionPage)?this.reuseVersion():this.step===1&&this.version?this.replace={kind:"page"}:this.step===1&&this.uploaded&&this.uploaded.pages.length>1?this.pickPage():this.step===2&&this.phases.structure==="error"?this.runDetect():this.step===3?this.confirmReview():this.step===4?this.saveRooms():this.step===5?this.saveStyle():this.step===6?this.step=7:this.step===7&&this.publish())}key(e){if(this.step!==3||this.prefsOpen||e.ctrlKey||e.metaKey||e.altKey)return;const s=e.composedPath()[0];if(s&&(s.tagName==="INPUT"||s.tagName==="SELECT"||s.tagName==="TEXTAREA"))return;const t=Number(e.key),i=this.choicesFor(this.current);t>=1&&t<=i.length&&(e.preventDefault(),this.decide(i[t-1].id))}choicesFor(e){if(!e||!this.set)return[];if(this.set.walls.some(t=>t.id===e))return St;const s=this.set.openings.find(t=>t.id===e)?.kind==="window";return Dt.filter(t=>s?t.id!=="sliding":t.id!=="window")}openPrefs(){this.prefsDraft={...this.prefs},this.prefsOpen=!0}async savePrefs(){const e=this.backend,s=W(this.prefsDraft);this.prefsOpen=!1,this.prefs=s,this.step<=3&&(this.kit=s.kit,this.furniture=s.furniture&&s.kit!=="empty"),this.set&&!this.queue.some(t=>t.id===this.current)&&(this.current=this.queue[0]?.id??null);try{await e?.savePrefs(s)}catch(t){this.error=M(t)}}render(){const e=this.step,s=this.draft?.doc.dimensions.width_px??this.version?.width??1e3,t=this.draft?.doc.dimensions.height_px??this.version?.height??1e3;return c`<div class="wz" data-wizard-step=${e}>
        ${this.renderSteps()}
        <div class="wz-canvas" data-wz-canvas>${this.renderCanvas(s,t)}</div>
        <div class="wz-side" data-wz-side>${this.renderSide(s,t)}</div>
        ${this.renderFoot()}
      </div>
      ${this.prefsOpen?this.renderPrefs():b}
      ${this.replace?this.renderReplace():b}`}renderSteps(){const e=this.step;return c`<div class="wz-steps" role="list" aria-label=${r("שלבי האשף")}>
      ${$e.map((s,t)=>c`${t?c`<i class="ln ${t<e?"done":""}" aria-hidden="true"></i>`:b}<span role="listitem" class="st ${t+1<e?"done":t+1===e?"now":""}" aria-current=${t+1===e?"step":"false"}><i class="num">${t+1<e?c`<sw-icon name="check" size="14"></sw-icon>`:t+1}</i><span>${s}</span></span>`)}
      <div class="mob"><span>${$e[e-1]}</span><small class="num">${r("שלב {step} מתוך 7",{step:e})}</small><span class="bar" aria-hidden="true"><i style="inline-size:${e/7*100}%"></i></span></div>
      <button class="gear" data-wz-prefs aria-label=${r("הגדרות האשף")} title=${r("הגדרות האשף")} @click=${()=>this.openPrefs()}><sw-icon name="system" size="18"></sw-icon></button>
    </div>`}planSvg(e,s,t,i={}){const a=this.version?.imageUrl??"",o=i.crop??[0,0,e,s];return c`<svg class="plan ${i.placing?"placing":""}" viewBox=${o.join(" ")} preserveAspectRatio=${i.crop?"xMidYMid slice":"xMidYMid meet"}
        style=${i.crop?"":`aspect-ratio:${e}/${s}`} role="img" aria-label=${r("תוכנית הקומה")} @click=${i.click??(()=>{})}>
      <rect x=${o[0]} y=${o[1]} width=${o[2]} height=${o[3]} fill="#fff"/>
      ${a?_`<image href=${a} x="0" y="0" width=${e} height=${s} preserveAspectRatio="none" opacity=${t===b?1:.55}/>`:b}
      ${t}
    </svg>`}get geom(){if(!this.set||!this.draft)return null;const e=`${this.draft.revision}|${this.set.walls.length}|${this.set.openings.length}|${this.set.scaleMPerPx}`;return this.geomMemo?.key!==e&&(this.geomMemo={key:e,g:me(this.draft.doc,this.set)}),this.geomMemo.g}onCandClick(e){const t=e.target.closest("[data-cand]")?.getAttribute("data-cand");t&&(this.current=t)}onRoomClick(e){const s=e.target.closest("[data-room]"),t=s?Number(s.getAttribute("data-room")):NaN;if(!Number.isFinite(t))return;const i=this.small?_e:ke;this.roomFocus=t,this.roomsPage=Math.floor(t/i),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-room-name="${t}"]`)?.focus())}renderCanvas(e,s){const t=this.step;if(t===1)return c`<div class="drop ${this.dragOver?"over":""}" data-wz-drop
          @dragover=${a=>{a.preventDefault(),this.dragOver=!0}} @dragleave=${()=>this.dragOver=!1}
          @drop=${a=>{a.preventDefault(),this.dragOver=!1,this.onFile(a.dataTransfer?.files?.[0])}}>
        <sw-icon class="big" name="upload" size="44"></sw-icon>
        <b>${this.uploaded?this.uploaded.name:r("גרור לכאן את תוכנית הקומה")}</b>
        <span class="hide-ph">${this.uploaded&&this.uploaded.pages.length>1?r("בחר בצד את העמוד שבו נמצאת התוכנית"):r("תמונה או PDF של תוכנית אדריכלית, שרטוט מכירות או סריקה")}</span>
        <div class="row">
          <span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" data-wz-file @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button variant="primary" size="lg" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>${this.busy?r("מעלה…"):r("בחר קובץ")}</sw-button></span>
          <span><input type="file" accept="image/*" capture="environment" @change=${a=>void this.onFile(a.target.files?.[0])} /><sw-button size="lg" icon="camera" ?disabled=${this.busy} @click=${a=>a.currentTarget.parentElement?.querySelector("input")?.click()}>${r("צלם")}</sw-button></span>
        </div>
        <div class="fmts"><span class="tag">PNG</span><span class="tag">JPG</span><span class="tag">PDF</span><a class="tag" href=${`#/explore/floors/${this.floorId}/import`}>${r("DXF / IFC: ייבוא מדויק, בלי זיהוי")}</a></div>
      </div>`;if(t===2)return c`<div class="sheet">${this.planSvg(e,s,b)}</div>${this.phases.structure==="run"?c`<i class="scan" aria-hidden="true"></i>`:b}`;if(t===3){const a=this.geom,o=this.set;if(!a||!o)return b;const n=new Set(Object.entries(this.decisions).filter(([,l])=>l==="none").map(([l])=>l));return c`<div class="sheet">${this.planSvg(e,s,ge(a,o,this.prefs,new Set(Object.keys(this.decisions)),n,this.current),{click:l=>this.onCandClick(l)})}</div>
        <div class="legend"><span><i style="background:var(--wz-sure)"></i>${r("זוהה בביטחון")}</span><span><i style="background:var(--wz-check)"></i>${r("לבדיקה")}</span><span><i class="dash"></i>${r("בספק, לא ייכנס בלי אישור")}</span><span><i style="background:var(--wz-out)"></i>${r("הושמט")}</span></div>`}if(t===4)return c`<div class="sheet">${this.planSvg(e,s,ve(this.rooms,e,s,"name",this.roomFocus),{click:a=>this.onRoomClick(a)})}</div>`;if(t===5||t===7){const a=this.scene();if(a)return c`<div class="preview3d"><sw-plan-3d data-wz-3d .description=${a} .frameKey=${`wizard-${this.version?.versionId??""}`} .preset=${"iso"} kiosk .qualityForce=${"full"} .minFps=${0}></sw-plan-3d></div><span class="preview-note">${r("תצוגה מקדימה")}</span>`;const o=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,n=H(this.kit),l=_`<g>${this.created.map((h,p)=>_`<polygon points=${h.polygon.map(u=>`${u.x*e},${u.y*s}`).join(" ")} fill=${Me(V(n,this.rooms[p]?.typeId??"other"),o)} fill-opacity=".85"/>`)}</g>`;return c`<div class="sheet">${this.planSvg(e,s,l)}</div><span class="preview-note">${this.three==="loading"?r("טוען תצוגה בתלת־ממד…"):r("תצוגה מקדימה")}</span>`}const i=_`${ve(this.created.map(a=>({polygon:a.polygon})),e,s,"faint",null)}${Bt(this.placements.filter(a=>!this.skipped.has(a.entity_id)),e,s,this.selDev)}`;return c`<div class="sheet">${this.planSvg(e,s,i,{click:a=>this.placeAt(a),placing:!!this.selDev})}</div>
      <div class="legend"><span><i class="dot" style="background:var(--wz-sure)"></i>${r("הוצב")}</span><span><i class="dot" style="background:var(--wz-check)"></i>${r("ממתין למקום")}</span>${this.placements.some(D)?c`<span><i class="sq"></i>${r("מצלמה")}</span>`:b}</div>`}renderSide(e,s){return c`${this.sideFor(e,s)}${this.error?c`<div class="card err" role="alert" data-wz-error>${this.error}</div>`:b}`}sideFor(e,s){const t=this.step;if(t===1){const i=this.uploaded&&this.uploaded.pages.length>1,a=this.resumeInfo,o=this.version;return c`<h2>${r("העלאת תוכנית")}</h2><p>${r("המערכת תזהה קירות, דלתות, חלונות וחדרים, ואתה תאשר. כמה דקות לקומה.")}</p>
        ${a?c`<div class="card resume" data-wz-resume><b>${r("יש כאן טיוטה של האשף שלא הסתיימה")}</b><span>${ze(a.createdAt)?r("התחלת אותה ב־{when}. ",{when:ze(a.createdAt)}):""}${r("אפשר להמשיך מהמקום שעצרת.")}</span>
            <div class="side-actions"><sw-button variant="primary" icon="history" data-wz-resume-go ?disabled=${this.busy} @click=${()=>void this.resumeWizard()}>${r("המשך באשף")}</sw-button><sw-button variant="ghost" @click=${()=>this.toStudio()}>${r("פתח בסטודיו")}</sw-button></div></div>`:b}
        ${o&&!a?c`<div class="card resume" data-wz-kept><b>${r("התוכנית שהעלית נשמרה")}</b><span>${r('"המשך" יזהה אותה שוב, בלי טיוטה נוספת. קובץ אחר יחליף אותה.')}</span></div>`:b}
        <div class="card"><div class="kv">
          <b>${r("לאיזו קומה?")}</b>
          <select style="inline-size:160px" aria-label=${r("הקומה")} data-wz-floor .value=${this.floorId} @change=${n=>T(`/explore/floors/${n.target.value}/wizard`)}>
            ${(this.floor?.siblings.length?this.floor.siblings:[{id:this.floorId,name:this.floor?.name||this.floorId}]).map(n=>c`<option value=${n.id} ?selected=${n.id===this.floorId}>${n.name}</option>`)}
          </select>
          <b class="hide-ph">${r("גובה תקרה")}</b>
          <select class="hide-ph" style="inline-size:160px" aria-label=${r("גובה תקרה")} .value=${String(this.ceiling)} @change=${n=>this.ceiling=Number(n.target.value)}>
            ${[2.5,2.6,2.7,2.8,3,3.2,3.5,4,5].map(n=>c`<option value=${String(n)} ?selected=${n===this.ceiling}>${n.toFixed(2)} ${r("מ׳")}</option>`)}
          </select>
        </div></div>
        ${i?c`<div class="card"><b>${r("באיזה עמוד התוכנית?")}</b><div class="side-actions" style="margin-block-start:8px">${this.uploaded.pages.map(n=>c`<button class="opt" style="inline-size:64px" aria-pressed=${n.page===this.page?"true":"false"} @click=${()=>this.page=n.page}>${n.page}</button>`)}</div></div>`:a||o?b:c`<div class="card soft hide-ph"><b>${r("כדי שהזיהוי יצליח")}</b><div class="tips"><span>${r("סריקה ישרה וחדה, בלי צל או קיפול.")}</span><span>${r("קירות כהים על רקע בהיר.")}</span><span>${r("ריהוט וכיתוב על התוכנית לא מפריעים.")}</span></div></div>`}
        ${this.floor?.hasPlan?c`<div class="side-actions"><sw-button variant="ghost" icon="edit" @click=${()=>this.toStudio()}>${r("שרטוט ידני בסטודיו")}</sw-button></div>`:b}`}if(t===2){const i=(n,l,h="")=>c`<div class="p ${n==="done"?"done":n==="run"?"run":""}"><i>${n==="done"?c`<sw-icon name="check" size="13"></sw-icon>`:n==="error"?c`<sw-icon name="warning" size="13"></sw-icon>`:b}</i>${l}<span class="v">${h}</span></div>`,a=this.phases.structure,o=this.phases.rooms;return c`<h2>${r("מזהה את התוכנית")}</h2><p>${r("הזיהוי רץ אצלך במערכת. התוכנית לא נשלחת לשום מקום.")}</p>
        <div class="card"><div class="prog" data-wz-progress>
          ${i(a,r("קירות"),a==="done"?r("{n} נמצאו",{n:this.set?.walls.length??0}):"")}
          ${i(a,r("דלתות, חלונות ומעברים"),a==="done"?r("{n} נמצאו",{n:this.set?.openings.length??0}):"")}
          ${i(a==="done"?"done":a==="run"?"idle":a,r("עמודים ומדרגות"),a==="done"?`${this.set?.objects.length??0}`:"")}
          ${i(o,r("חדרים סגורים"),o==="done"?r("{n} נמצאו",{n:this.rooms.length}):o==="error"?r("לא זוהו"):"")}
          ${i(a==="done"?"done":"idle",r("קנה מידה"),a==="done"?this.result?.calibration_hint?r("משוער לפי רוחב דלת"):r("לא ידוע"):"")}
        </div></div>
        <div class="card soft hide-ph">${r("קווי מידה, קווים מקווקווים ומסגרת הגיליון מזוהים ומושמטים, כדי שלא יהפכו לקירות.")}</div>
        ${a==="run"?c`<div class="why num" data-wz-elapsed>${this.elapsed?r("{n} שנ׳",{n:this.elapsed}):""}</div>`:b}`}return t===3?this.sideReview(e,s):t===4?this.sideRooms():t===5?this.sideStyle():t===6?this.sideDevices():this.sideDone()}sideReview(e,s){const t=this.set,i=this.geom;if(!t||!i)return b;const a=Mt(t,this.prefs),o=this.queue,n=this.current,l=o.findIndex($=>$.id===n),h=n?t.walls.find($=>$.id===n)??t.openings.find($=>$.id===n):void 0,p=h?P(h.confidence,this.prefs):"sure",u=n?this.decisions[n]??It(t,n):null,m=n?X(i,n):null,d=m?[m[0]-235,m[1]-125,470,250]:void 0,x=this.choicesFor(n),y=n?t.openings.find($=>$.id===n):void 0,I=this.draft?.doc?.dimensions.calibration?.status,S=new Set(Object.entries(this.decisions).filter(([,$])=>$==="none").map(([$])=>$));return c`<h2>${r("בדיקת הזיהוי")}</h2>
      <div class="cnts" data-wz-counts><div class="cnt"><b class="num">${a.sure}</b><span>${r("בביטחון")}</span></div><div class="cnt chk"><b class="num">${a.check}</b><span>${r("לבדיקה")}</span></div><div class="cnt low"><b class="num">${a.doubt}</b><span>${r("בספק")}</span></div></div>
      ${o.length&&h?c`<div class="card" style="display:grid;gap:10px" data-wz-item=${n}>
            <div class="qhead"><b>${r("מה יש כאן?")}</b><span class="pager"><button aria-label=${r("הקודם")} ?disabled=${l<=0} @click=${()=>this.moveQueue(-1)}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num" data-wz-pos>${l<0?"–":l+1} / ${o.length}</span><button aria-label=${r("הבא")} ?disabled=${l>=o.length-1} @click=${()=>this.moveQueue(1)}><sw-icon name="chevronBack" size="16"></sw-icon></button></span></div>
            <div class="q-crop">${this.planSvg(e,s,ge(i,t,this.prefs,new Set(Object.keys(this.decisions)),S,n),{crop:d})}</div>
            <div class="conf ${p}"><span>${Rt(t,n)}</span><span class="bar"><i style="inline-size:${Math.round(h.confidence*100)}%"></i></span><b class="num">${Math.round(h.confidence*100)}%</b></div>
            ${y?c`<div class="why hide-ph">${y.kind==="passage"?r("יש רווח בקיר ברוחב {w} מ׳, אבל לא נמצאה קשת של דלת.",{w:y.width_m.toFixed(2)}):r("ברוחב {w} מ׳.",{w:y.width_m.toFixed(2)})}</div>`:b}
            <div class="opts" role="group" aria-label=${r("מה יש כאן")}>${x.map(($,U)=>c`<button class="opt" data-choice=${$.id} aria-pressed=${u===$.id?"true":"false"} @click=${()=>this.decide($.id)}>${$.he}<kbd class="hide-ph">${U+1}</kbd></button>`)}</div>
          </div>`:c`<div class="card soft">${r("כל מה שזוהה נמצא מעל סף הביטחון ויכנס לתוכנית. אפשר לתקן כל פריט אחר כך בסטודיו.")}</div>`}
      <div class="card soft hide-ph">${this.measure.open?c`<div class="measure"><span>${r("אורך הקיר הארוך ביותר")}</span><input type="number" inputmode="decimal" min="0.5" step="0.01" aria-label=${r("אורך במטרים")} placeholder=${r("מ׳")} .value=${this.measure.metres} @input=${$=>this.measure={...this.measure,metres:$.target.value}} /><sw-button size="sm" variant="primary" ?disabled=${this.busy||!(parseFloat(this.measure.metres)>0)} @click=${()=>void this.measureWall()}>${r("שמור")}</sw-button></div>`:c`<div class="kv"><span>${r("קנה מידה")} <b>${I==="measured"?r("נמדד"):r("משוער")}</b>${I==="measured"?"":this.result?.calibration_hint?r(", לפי רוחב דלת"):""}</span><sw-button size="sm" icon="ruler" @click=${()=>this.measure={open:!0,metres:""}}>${r("מדוד קיר")}</sw-button></div>`}</div>`}sideRooms(){const e=this.small?_e:ke,s=Math.max(1,Math.ceil(this.rooms.length/e)),t=Math.min(this.roomsPage,s-1),i=this.rooms.filter(a=>!a.name.trim()).length;return c`<h2>${r("שמות החדרים")}</h2><p>${this.rooms.length?r("נמצאו {n} חדרים סגורים. תן שם לכל אחד, או בחר שם של אזור שכבר קיים במערכת כדי לקשר אליו.",{n:this.rooms.length}):r("לא נמצאו חדרים סגורים. אפשר להמשיך ולסמן חדרים אחר כך בסטודיו.")}</p>
      <datalist id="wz-areas">${this.areas.map(a=>c`<option value=${a.name}></option>`)}</datalist>
      <div class="rooms" data-wz-rooms>${this.rooms.slice(t*e,t*e+e).map((a,o)=>{const n=t*e+o,l=!!this.areaOf(a.name);return c`<div class="rrow"><i style="background:${J(n)}"></i>
          <input type="text" list="wz-areas" data-room-name=${n} class="${a.name.trim()?l?"linked":"":"empty"}" .value=${a.name} placeholder=${r("{room}: שם",{room:L(n)})} aria-label=${r("שם חדר {n}",{n:n+1})} title=${l?r("מקושר לאזור קיים"):""}
            @focus=${()=>this.roomFocus=n} @input=${h=>this.setRoom(n,{name:h.target.value})} />
          <select aria-label=${r("סוג חדר {n}",{n:n+1})} .value=${a.typeId} @change=${h=>this.setRoom(n,{typeId:h.target.value})}>${E.map(h=>c`<option value=${h.id} ?selected=${h.id===a.typeId}>${h.id==="other"?r("סוג"):h.he}</option>`)}</select>
        </div>`})}</div>
      <div class="rnote">${i?c`<span class="warn">${i===1?r("חדר אחד עוד בלי שם"):r("{n} חדרים עוד בלי שם",{n:i})}</span>`:c`<span>${r("{n} מקושרים לאזורים קיימים",{n:this.rooms.filter(a=>this.areaOf(a.name)).length})}</span>`}
        ${s>1?c`<span class="pager"><button aria-label=${r("הקודם")} ?disabled=${t<=0} @click=${()=>this.roomsPage=t-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${t+1} / ${s}</span><button aria-label=${r("הבא")} ?disabled=${t>=s-1} @click=${()=>this.roomsPage=t+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:b}</div>
      ${this.existingAuto?c`<label class="check"><input type="checkbox" .checked=${this.replaceAuto} @change=${a=>this.replaceAuto=a.target.checked} />${this.existingAuto===1?r("להחליף חדר אוטומטי קודם בקומה"):r("להחליף {n} חדרים אוטומטיים קודמים בקומה",{n:this.existingAuto})}</label>`:b}`}sideStyle(){const e=matchMedia?.("(prefers-color-scheme: dark)").matches??!1,s={empty:"plaster_ceiling",office:"fabric_accent",lobby:"wood_dark",technical:"metal_dark",commercial:"metal_light"},t=i=>[V(i,"living"),V(i,"kitchen"),"plaster_white",s[i.id]??"wood_light"].map(a=>c`<i style="background:${Me(a,e)}"></i>`);return c`<h2>${r("סגנון וריהוט")}</h2><p>${r("ערכה קובעת חומרים וריהוט התחלתי לכל חדר לפי הסוג שלו. אפשר לשנות אחר כך חדר־חדר בסטודיו.")}</p>
      <div class="presets" role="radiogroup" aria-label=${r("ערכת סגנון")}>${G.map(i=>c`<button class="preset" role="radio" data-kit=${i.id} aria-checked=${i.id===this.kit?"true":"false"} aria-pressed=${i.id===this.kit?"true":"false"}
          @click=${()=>{this.kit=i.id,i.id==="empty"?this.furniture=!1:this.prefs.furniture&&(this.furniture=!0)}}><span class="sw" aria-hidden="true">${t(i)}</span><span class="tx"><b>${i.he}</b><span>${i.note}</span></span></button>`)}</div>
      <label class="check"><input type="checkbox" data-wz-furniture .checked=${this.furniture} ?disabled=${this.kit==="empty"} @change=${i=>this.furniture=i.target.checked} /><sw-icon name="cube" size="16"></sw-icon>${r("להציב ריהוט התחלתי")}</label>
`}sideDevices(){const e=this.small?es:Jt,s=this.placements.filter(D),t=this.placements.filter(d=>!D(d)),i=s.length?this.devTab:"devices",a=i==="cameras"?s:t,o=Math.max(1,Math.ceil(a.length/e)),n=Math.min(this.devPage,o-1),l=t.filter(d=>d.where!=="manual").length,h=s.filter(d=>d.where!=="manual").length,p=this.selDev?this.placements.find(d=>d.entity_id===this.selDev):null,u=d=>{this.devTab=d,this.devPage=0,this.selDev=null},m=i==="cameras"?r("{set} מתוך {total} מצלמות סומנו. בחר מצלמה ולחץ על המפה במקום שבו היא מותקנת; מצלמה שלא תסמן לא תוצב.",{set:h,total:s.length}):t.length?r("{auto} מתוך {total} הוצבו לבד, לפי האזור והסוג. את השאר בוחרים ומסמנים על המפה.",{auto:l,total:t.length}):r("אין התקנים שמחכים למקום באזורים של החדרים האלה. אפשר להציב התקנים אחר כך מהמפה.");return c`<h2>${r("מיקום התקנים")}</h2>
      ${s.length?c`<div class="seg" role="tablist" aria-label=${r("מה מציבים")} data-wz-dev-tabs>
          <button role="tab" data-wz-tab="devices" aria-selected=${i==="devices"?"true":"false"} @click=${()=>u("devices")}><sw-icon name="sensor" size="15"></sw-icon>${r("התקנים")}<span class="num">${t.length}</span></button>
          <button role="tab" data-wz-tab="cameras" aria-selected=${i==="cameras"?"true":"false"} @click=${()=>u("cameras")}><sw-icon name="camera" size="15"></sw-icon>${r("מצלמות")}<span class="num">${h?`${h}/${s.length}`:s.length}</span></button>
        </div>`:b}
      <p>${m}</p>
      <div class="devs" data-wz-devs role=${s.length?"tabpanel":b}>${a.slice(n*e,n*e+e).map(d=>{const x=D(d),y=this.skipped.has(d.entity_id),z=!x&&d.where==="manual"&&!y,I=y?ue.none:x&&d.where!=="manual"?Wt:ue[d.where];return c`<button class="dev ${z?"todo":""} ${y?"off":""} ${x&&d.where!=="manual"?"set":""}" data-dev-row=${d.entity_id} aria-pressed=${this.selDev===d.entity_id?"true":"false"} @click=${()=>this.selDev=this.selDev===d.entity_id?null:d.entity_id}>
          <sw-icon name=${ss(d.domain)} size="16"></sw-icon><span class="nm">${d.name}</span><span class="w">${I}</span></button>`})}</div>
      ${p?c`<div class="card soft" data-wz-dev-sel><b>${p.name}</b>${p.where==="manual"?r(": לחץ על המפה כדי להציב."):r(": לחץ על המפה כדי להזיז.")}${D(p)?p.where!=="manual"?c`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.unplace(p.entity_id)}>${r("הסר מהמפה")}</sw-button></div>`:b:c`<div class="side-actions" style="margin-block-start:8px"><sw-button size="sm" variant="ghost" @click=${()=>this.toggleSkip(p.entity_id)}>${this.skipped.has(p.entity_id)?r("להציב בכל זאת"):r("לא להציב")}</sw-button></div>`}</div>`:b}
      <div class="rnote"><span>${i==="cameras"?r("רק מצלמות שמותר לך להציב, שעוד לא בקומה הזו"):r("רק התקנים מהקטלוג המאושר, שעוד לא על אף מפה")}</span>${o>1?c`<span class="pager"><button aria-label=${r("הקודם")} ?disabled=${n<=0} @click=${()=>this.devPage=n-1}><sw-icon name="chevron" size="16"></sw-icon></button><span class="num">${n+1} / ${o}</span><button aria-label=${r("הבא")} ?disabled=${n>=o-1} @click=${()=>this.devPage=n+1}><sw-icon name="chevronBack" size="16"></sw-icon></button></span>`:b}</div>`}sideDone(){const e=this.draft?.doc,s=e?.dimensions.calibration?.status;return c`<h2>${r("הקומה מוכנה")}</h2><p>${r("נשמרה כטיוטה. היא תופיע לכולם רק אחרי פרסום.")}</p>
      <div class="card"><div class="kv" data-wz-summary>
        <span>${r("קירות")}</span><b class="num">${e?.walls.length??0}</b>
        <span>${r("דלתות, חלונות ומעברים")}</span><b class="num">${e?.openings.length??0}</b>
        <span>${r("חדרים")}</span><b class="num">${this.created.length}</b>
        <span>${r("התקנים שיוצבו")}</span><b class="num">${this.toPlace.filter(t=>!D(t)).length}</b>
        ${this.placements.some(D)?c`<span>${r("מצלמות שיוצבו")}</span><b class="num" data-wz-cams-count>${this.toPlace.filter(D).length}</b>`:b}
        <span>${r("סגנון")}</span><b>${H(this.kit).he}</b>
        <span>${r("קנה מידה")}</span><b>${s==="measured"?r("נמדד"):r("משוער")}</b>
      </div></div>
      ${this.done?.failed?c`<div class="card err" data-wz-refused>${this.refusedText(this.done)}<div><sw-button size="sm" @click=${()=>T(`/explore/floors/${this.floorId}`)}>${r("פתח את המפה")}</sw-button></div></div>`:b}
      <div class="card soft hide-ph">${r("רוצה לדייק קיר, להזיז רהיט או להוסיף מצלמה? הכול פתוח לעריכה בסטודיו התוכניות. התקנים מוצבים רק בפרסום מכאן.")}</div>
      <sw-button data-wz-studio @click=${()=>this.toStudio()}>${r("המשך עריכה בסטודיו")}</sw-button>`}refusedText(e){if(e.blocked==="other_draft")return r("התוכנית פורסמה, אבל {n} פריטים לא הוצבו: לקומה יש טיוטה נוספת פתוחה, והם היו נשמרים עליה. פרסם או מחק אותה בסטודיו, ואז הצב מהמפה.",{n:e.failed});const s=a=>this.placements.find(o=>o.entity_id===a)?.name??a,t=e.refused.slice(0,3).map(a=>`${s(a.id)} (${ts[a.code]??r("נדחה")})`).join(", "),i=e.refused.length>3?r(" ועוד {n}",{n:e.refused.length-3}):"";return r("{placed} הוצבו, {failed} לא הוצבו: {shown}{more}. אפשר להציב אותם מהמפה.",{placed:e.placed,failed:e.failed,shown:t,more:i})}renderReplace(){return c`<sw-dialog open heading=${r("להחליף את התוכנית?")} subheading=${r("טיוטה אחת של האשף לכל קומה")} data-wz-replace-dialog @close=${()=>this.replace=null}>
      <p class="dlg-p">${r("הטיוטה הקודמת של האשף, עם הקירות, הפתחים והחדרים שאישרת בה, תימחק לפני שהתוכנית החדשה תיטען. היא לא פורסמה ושום דבר לא הוצב עליה.")}</p>
      <p class="dlg-p soft">${r('כדי להמשיך עם אותה תוכנית, בחר "ביטול" ואז "המשך".')}</p>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" data-wz-replace-cancel ?disabled=${this.busy} @click=${()=>this.replace=null}>${r("ביטול")}</sw-button>
        <sw-button variant="danger" data-wz-replace-go ?disabled=${this.busy} aria-busy=${this.busy?"true":"false"} @click=${()=>void this.confirmReplace()}>${this.busy?r("מוחק…"):r("מחק את הטיוטה והמשך")}</sw-button>
      </div>
    </sw-dialog>`}renderFoot(){const e=this.step,s=e===1&&this.uploaded&&this.uploaded.pages.length>1,t=e===1?this.version?r("אותה תוכנית, אותה טיוטה"):r("אפשר להעלות קומה אחת בכל פעם"):e===2?r("בדרך כלל 5 עד 20 שניות"):e===3?this.prefs.unreviewed==="as_detected"?r('מה שלא תבדוק: "לבדיקה" ייכנס כמו שזוהה, "בספק" לא ייכנס'):r("מה שלא תבדוק לא ייכנס לתוכנית"):e===4?r('חדר בלי שם יקבל "חדר 7", ואפשר לשנות אחר כך'):e===5?r("התצוגה מתעדכנת מיד כשבוחרים ערכה"):e===6?r("אפשר לדלג ולהציב התקנים אחר כך מהמפה"):r("אפשר לחזור ולתקן כל שלב"),i=e===1?s?r("המשך"):r("המשך"):e===2?this.phases.structure==="error"?r("נסה שוב"):r("מזהה…"):e===3?r("אשר והמשך"):e===7?r("פרסם ופתח במפה"):r("המשך"),a=this.busy||e===1&&!s&&!this.version||e===2&&this.phases.structure!=="error";return c`<div class="wz-foot">
      ${e>1?c`<sw-button size="lg" data-wz-back ?disabled=${this.busy||e===2} @click=${()=>this.back()}>${r("חזרה")}</sw-button>`:c`<sw-button size="lg" variant="ghost" @click=${()=>T(`/explore/floors/${this.floorId}`)}>${r("ביטול")}</sw-button>`}
      <span class="hint">${t}</span><span class="sp"></span>
      <sw-button size="lg" variant="primary" data-wz-next ?disabled=${a} aria-busy=${this.busy?"true":"false"} @click=${()=>this.next()}>${this.busy&&e>2?r("שומר…"):i}</sw-button>
    </div>`}renderPrefs(){const e=this.prefsDraft,s=i=>this.prefsDraft={...this.prefsDraft,...i},t=e.review_min>=e.auto_accept;return c`<sw-dialog open wide heading=${r("הגדרות האשף")} subheading=${r("נשמרות לחשבון שלך")} data-wz-prefs-dialog @close=${()=>this.prefsOpen=!1}>
      <div class="prefs">
        <div class="two">
          <label>${r("נכנס בלי בדיקה מעל (%)")}<input type="number" min="5" max="99" .value=${String(e.auto_accept)} @input=${i=>s({auto_accept:Math.round(Number(i.target.value))})} /></label>
          <label>${r("לא נכנס בלי אישור מתחת ל־(%)")}<input type="number" min="5" max="99" .value=${String(e.review_min)} @input=${i=>s({review_min:Math.round(Number(i.target.value))})} /></label>
        </div>
        ${t?c`<span class="note" style="color:var(--sw-danger-text)">${r("הסף התחתון חייב להיות נמוך מהעליון.")}</span>`:b}
        <label>${r('פריט "לבדיקה" שלא בדקת')}<select .value=${e.unreviewed} @change=${i=>s({unreviewed:i.target.value})}><option value="as_detected" ?selected=${e.unreviewed==="as_detected"}>${r("נכנס כמו שזוהה")}</option><option value="reject" ?selected=${e.unreviewed==="reject"}>${r("לא נכנס")}</option></select></label>
        <label>${r("ערכת סגנון ראשונה")}<select .value=${e.kit} @change=${i=>s({kit:i.target.value})}>${G.map(i=>c`<option value=${i.id} ?selected=${i.id===e.kit}>${i.he}</option>`)}</select></label>
        <label class="check"><input type="checkbox" .checked=${e.furniture} @change=${i=>s({furniture:i.target.checked})} />${r("להציב ריהוט התחלתי")}</label>
        <label class="check"><input type="checkbox" .checked=${e.auto_place} @change=${i=>s({auto_place:i.target.checked})} />${r("להציב התקנים לבד לפי האזור")}</label>
        <span class="note">${r("ברירת המחדל: מעל 80% נכנס, בין 50% ל־80% לבדיקה ונכנס כמו שזוהה אם דילגת, מתחת ל־50% לא נכנס בלי אישור.")}</span>
      </div>
      <div slot="footer" style="display:flex;gap:8px;justify-content:flex-end">
        <sw-button variant="ghost" @click=${()=>this.prefsDraft={...Y}}>${r("ברירת מחדל")}</sw-button>
        <sw-button variant="primary" data-wz-prefs-save ?disabled=${t} @click=${()=>void this.savePrefs()}>${r("שמור")}</sw-button>
      </div>
    </sw-dialog>`}};f.styles=Ht;g([ee()],f.prototype,"floorId",2);g([ee({type:Number})],f.prototype,"demoStep",2);g([ee({type:Boolean})],f.prototype,"demoResume",2);g([w()],f.prototype,"step",2);g([w()],f.prototype,"prefs",2);g([w()],f.prototype,"prefsOpen",2);g([w()],f.prototype,"prefsDraft",2);g([w()],f.prototype,"floor",2);g([w()],f.prototype,"ceiling",2);g([w()],f.prototype,"busy",2);g([w()],f.prototype,"error",2);g([w()],f.prototype,"dragOver",2);g([w()],f.prototype,"uploaded",2);g([w()],f.prototype,"page",2);g([w()],f.prototype,"version",2);g([w()],f.prototype,"resumeInfo",2);g([w()],f.prototype,"replace",2);g([w()],f.prototype,"phases",2);g([w()],f.prototype,"elapsed",2);g([w()],f.prototype,"result",2);g([w()],f.prototype,"set",2);g([w()],f.prototype,"draft",2);g([w()],f.prototype,"decisions",2);g([w()],f.prototype,"current",2);g([w()],f.prototype,"measure",2);g([w()],f.prototype,"rooms",2);g([w()],f.prototype,"roomsPage",2);g([w()],f.prototype,"roomFocus",2);g([w()],f.prototype,"existingAuto",2);g([w()],f.prototype,"replaceAuto",2);g([w()],f.prototype,"areas",2);g([w()],f.prototype,"created",2);g([w()],f.prototype,"kit",2);g([w()],f.prototype,"furniture",2);g([w()],f.prototype,"catalog",2);g([w()],f.prototype,"three",2);g([w()],f.prototype,"placements",2);g([w()],f.prototype,"skipped",2);g([w()],f.prototype,"selDev",2);g([w()],f.prototype,"devPage",2);g([w()],f.prototype,"devTab",2);g([w()],f.prototype,"done",2);f=g([Ye("plan-wizard-screen")],f);export{f as PlanWizardScreen};
