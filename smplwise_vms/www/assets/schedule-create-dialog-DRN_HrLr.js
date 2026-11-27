import{a as ht,bz as vt,bA as bt,j as _t,a8 as H,c as gt,A as E,b as h,mo as yt,z as wt,k as y}from"./index-DMqYQw_5.js";import{D as P,f as kt,r as G,U as N,p as g,W as L,X as at,T as $t,g as xt,S as St,Y as F,i as Y,e as rt,d as Mt,Z as k,_ as J,l as Et,$ as Nt,a0 as Tt}from"./schedules-CcHVJMGM.js";import{t as a}from"./automation-B3ruBAEi.js";const b=1440;function A(t,e){const n=Math.max(1,e);return Math.min(b,Math.max(0,Math.round(t/n)*n))}function be(t,e){return e<=0?0:Math.min(b,Math.max(0,t/e*b))}function _e(t){return Math.min(b,Math.max(0,t))/b*100}function ge(t){const e=Math.min(b,Math.max(0,Math.round(t)));return`${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}`}function j(t){return t>=b?"00:00:00":L(t)}function C(t,e){return kt(t,e)}function S(t,e){return t.map(n=>C(n,e))}function ot(t,e){const n=S(t,e);return t.map((i,s)=>s).sort((i,s)=>(n[i]?.start??1e6)-(n[s]?.start??1e6)||i-s)}function z(t,e,n=-1){const i=ot(t,e);return{slots:i.map(s=>t[s]),index:n<0?-1:i.indexOf(n)}}function At(t,e){return(e??$t)[t]}function x(t,e,n,i=!1,s=!1){const r=g(t);if(r&&r.kind==="sun"){let o=Math.round(e)-At(r.event,n);return o<0&&!i&&(o=0),at({kind:"sun",event:r.event,offset_min:o})}return s?j(e):L(Math.min(1439,Math.max(0,Math.round(e))))}function V(t){const e=g(t);return!!e&&e.kind==="sun"}function Ct(t,e,n=-1){let i=0,s=b;for(let r=0;r<t.length;r++){const o=t[r];if(!(!o||r===n)){if(e>=o.start&&e<o.end)return null;o.end<=e&&(i=Math.max(i,o.end)),o.start>e&&(s=Math.min(s,o.start))}}return{start:i,end:s}}function B(t,e=1){const n=t.filter(r=>!!r).sort((r,o)=>r.start-o.start),i=[];let s=0;for(const r of n)r.start-s>=e&&i.push({start:s,end:r.start}),s=Math.max(s,r.end);return b-s>=e&&i.push({start:s,end:b}),i}const Dt=(t,e,n=!0)=>({start:L(t),stop:n?j(e):null,actions:[]});function zt(t,e,n,i,s=r=>r){const r=Pt(S(t,i.sun),e,n,i.step);if(!r)return null;const o=s(Dt(r.start,r.end)),u=z([...t,o],i.sun,t.length);return{slots:u.slots,index:u.index}}function ye(t,e,n=480,i=s=>s){const s=S(t,e.sun),r=B(s,e.step);if(r.length){const c=r.find(p=>p.end>n)??r[0],d=A(Math.max(c.start,Math.min(n,c.end-e.step)),e.step),f=Math.min(Math.max(d,c.start),c.end-e.step),m=Math.min(c.end,f+60);return zt(t,f,m,e,i)}let o=-1,u=0;if(s.forEach((c,d)=>{c&&c.end-c.start>u&&(u=c.end-c.start,o=d)}),o<0||u<e.step*2)return null;const l=s[o];return Ot(t,o,A((l.start+l.end)/2,e.step),e,i)}function Ot(t,e,n,i,s=r=>r){const r=t[e],o=r?C(r,i.sun):null;if(!r||!o||!r.stop)return null;const u=A(n,i.step);if(u<=o.start||u>=o.end)return null;const l={...r,stop:x(r.start,u,i.sun,i.allowNegativeSun,!0)},c=s({start:x(r.start,u,i.sun,i.allowNegativeSun),stop:r.stop,actions:r.actions.map(m=>({...m,data:{...m.data}}))}),d=t.slice();d.splice(e,1,l,c);const f=z(d,i.sun,e+1);return{slots:f.slots,index:f.index}}function we(t,e){return t.filter((n,i)=>i!==e)}function ke(t,e,n,i=s=>s){const s=t[e],r=s?C(s,n.sun):null;if(!s||!r)return null;const o=Math.max(n.step,r.end-r.start),u=B(S(t,n.sun),n.step).find(d=>d.end-d.start>=o&&d.start>=r.end)??B(S(t,n.sun),n.step).find(d=>d.end-d.start>=o);if(!u)return null;const l=i({start:L(u.start),stop:s.stop?j(u.start+o):null,actions:s.actions.map(d=>({...d,data:{...d.data}}))}),c=z([...t,l],n.sun,t.length);return{slots:c.slots,index:c.index}}function lt(t,e,n,i){const s=t[n];if(!s||e[n])return-1;for(let r=0;r<t.length;r++){const o=t[r];if(!(r===n||!o)&&(i==="end"&&o.start===s.end||i==="start"&&!e[r]&&o.end===s.start))return r}return-1}function Rt(t,e,n,i,s,r,o=!1){const u=t[n];if(!u)return s;const l=A(s,r),c=o?-1:lt(t,e,n,i);if(i==="end"){let p=b;for(let O=0;O<t.length;O++){const U=t[O];O===n||!U||O===c||U.start>=u.end&&(p=Math.min(p,U.start))}c>=0&&(p=Math.min(p,t[c].end-r));const M=Math.min(Math.max(l,u.start+r),p);return M<=u.start?Math.min(u.start+r,b):M}let d=0;for(let p=0;p<t.length;p++){const M=t[p];p===n||!M||p===c||M.end<=u.start&&(d=Math.max(d,M.end))}c>=0&&(d=Math.max(d,t[c].start+r));const f=u.end-(e[n]?0:r),m=Math.max(Math.min(l,f),d);return m>=b?b-r:m}function qt(t,e,n,i){const s=t[e];if(!s)return 0;let r=0,o=b;t.forEach((l,c)=>{c===e||!l||(l.end<=s.start&&(r=Math.max(r,l.end)),l.start>=s.end&&(o=Math.min(o,l.start)))});const u=s.end-s.start;return Math.min(Math.max(A(s.start+n,i),r),Math.max(r,o-u))}function Pt(t,e,n,i){const s=Math.min(e,n),r=Math.max(e,n),o=Ct(t,Math.min(Math.floor(s),b-1));if(!o)return null;let u=Math.min(Math.max(A(s,i),o.start),o.end-1),l=Math.min(A(r,i),o.end);return l-u<i&&(l=Math.min(o.end,u+i),l-u<i&&(u=Math.max(o.start,l-i))),l>u?{start:u,end:l}:null}function $e(t,e,n,i,s){const r=t[e],o=r?C(r,s.sun):null;if(!r||!o)return{slots:t,index:e};const u=S(t,s.sun),l=t.map(p=>p.stop==null),c=Rt(u,l,e,n,i,s.step,s.detach),d=s.detach?-1:lt(u,l,e,n),f=t.slice();n==="end"?(f[e]={...r,stop:r.stop==null?j(c):x(r.stop,c,s.sun,s.allowNegativeSun,!0)},d>=0&&(f[d]={...t[d],start:x(t[d].start,c,s.sun,s.allowNegativeSun)})):(f[e]={...r,start:x(r.start,c,s.sun,s.allowNegativeSun)},d>=0&&(f[d]={...t[d],stop:x(t[d].stop??t[d].start,c,s.sun,s.allowNegativeSun,!0)}));const m=z(f,s.sun,e);return{slots:m.slots,index:m.index}}function xe(t,e,n,i){const s=t[e],r=s?C(s,i.sun):null;if(!s||!r)return{slots:t,index:e};const o=qt(S(t,i.sun),e,n,i.step);if(o===r.start)return{slots:t,index:e};const u=o-r.start,l=r.end-r.start,c=t.slice();c[e]={...s,start:x(s.start,N(g(s.start),i.sun)+u,i.sun,i.allowNegativeSun),stop:s.stop?x(s.stop,o+l,i.sun,i.allowNegativeSun,!0):null};const d=z(c,i.sun,e);return{slots:d.slots,index:d.index}}function Ft(t,e){return t.start<e.end&&e.start<t.end}function It(t,e={}){const n=t.trim().replace(/−|–|־/g,"-").replace(/\s+/g," ");if(!n)return{error:"empty"};const i=/^(שקיעה|זריחה|sunset|sunrise)\s*(?:([+-])\s*(\d{1,2})(?::?(\d{2}))?)?$/i.exec(n);if(i){const u=/שקיעה|sunset/i.test(i[1])?"sunset":"sunrise";let l=0;return i[3]!==void 0&&(l=i[4]!==void 0?Number(i[3])*60+Number(i[4]):Number(i[3])),l>720?{error:"range"}:i[2]==="-"&&l>0&&!e.allowNegative?{error:"negative_sun"}:{raw:at({kind:"sun",event:u,offset_min:i[2]==="-"?-l:l})}}let s=/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(n),r,o;if(s)r=Number(s[1]),o=Number(s[2]);else if(s=/^(\d{2})(\d{2})$/.exec(n))r=Number(s[1]),o=Number(s[2]);else if(s=/^(\d{1,2})$/.exec(n))r=Number(s[1]),o=0;else return{error:"format"};return r===24&&o===0&&e.end?{raw:"00:00:00"}:r>23||o>59?{error:"range"}:{raw:`${String(r).padStart(2,"0")}:${String(o).padStart(2,"0")}:00`}}const X={empty:a("נא למלא שעה."),format:a('שעה כמו 07:30, או "שקיעה+30".'),range:a("שעה מחוץ לטווח."),negative_sun:a("הקדמה לפני זריחה או שקיעה עדיין אינה נתמכת.")};function Z(t,e=!1){if(t==null)return"";const n=g(t);if(!n)return t;if(n.kind==="fixed")return e&&n.time==="00:00"?"24:00":n.time;const i=n.event==="sunrise"?a("זריחה"):a("שקיעה");if(!n.offset_min)return i;const s=Math.abs(n.offset_min);return`${i}${n.offset_min<0?"-":"+"}${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}function Se(t,e,n=()=>null){return ot(t,e).map(i=>{const s=t[i],r=C(s,e);return{index:i,from:Z(s.start),to:s.stop==null?"":Z(s.stop,!0),start:r?.start??null,end:r&&s.stop?r.end:null,fromSun:V(s.start),toSun:V(s.stop),point:s.stop==null,pairedWith:n(i)}})}function Me(t,e,n,i,s){const r=t[e];if(!r)return{error:a("המשבצת לא נמצאה.")};let o;if(n==="to"&&!i.trim())o={...r,stop:null};else{const f=It(i,{end:n==="to",allowNegative:s.allowNegativeSun});if("error"in f)return{error:X[f.error]};o=n==="from"?{...r,start:f.raw}:{...r,stop:f.raw}}const u=C(o,s.sun);if(!u)return{error:X.format};if(o.stop&&n==="to"){const f=N(g(o.start),s.sun),m=g(o.stop),p=N(m,s.sun);if(!(o.stop==="00:00:00")&&p<=f)return{error:a("שעת הסיום חייבת להיות אחרי שעת ההתחלה.")}}if(o.stop&&n==="from"){const f=N(g(o.start),s.sun),m=N(g(o.stop),s.sun);if(o.stop!=="00:00:00"&&m<=f)return{error:a("שעת ההתחלה חייבת להיות לפני שעת הסיום.")}}const l=S(t,s.sun);for(let f=0;f<l.length;f++){const m=l[f];if(f!==e&&m&&Ft(u,m))return{error:a("המשבצת חופפת למשבצת אחרת.")}}const c=t.slice();c[e]=o;const d=z(c,s.sun,e);return{slots:d.slots,index:d.index}}function Ee(t){const e=G(t);return e?P.map(n=>({day:n,active:e.includes(n),linked:e.length})):null}function Ne(t,e){const n=G(t);if(!n)return[e];const s=n.includes(e)?n.filter(r=>r!==e):P.filter(r=>r===e||n.includes(r));return s.length?s.length===7?["daily"]:s:t}function W(t){const e=P.filter(n=>t.includes(n));return e.length===7?["daily"]:e}function Te(t,e){const n=t.actions[0];if(!n)return"empty";for(const s of t.actions){const r=e(s.entity_id);if(r==="alarm"||r==="lock"||r==="door"||s.service.startsWith("alarm_control_panel.")||s.service.startsWith("lock."))return"secure"}const i=n.service.split(".")[0];return i==="climate"?n.service==="climate.turn_off"?"off":"climate":i==="cover"?"cover":n.service.endsWith(".turn_off")?"off":i==="light"&&(typeof n.data.brightness=="number"||typeof n.data.brightness_pct=="number")||i==="fan"&&(typeof n.data.percentage=="number"||n.service==="fan.set_percentage")?"level":n.service.endsWith(".turn_on")?"on":"custom"}const Ae={on:a("הדלקה"),off:a("כיבוי"),level:a("עוצמה"),climate:a("מזגן"),cover:a("תריס"),secure:a("אבטחה"),custom:a("אחר"),empty:a("ללא פעולה")};function Ce(t,e=new Map){for(const n of t?.entities??[])e.has(n.entity_id)||e.set(n.entity_id,{entity_id:n.entity_id,name:n.name,domain:n.domain,class:n.class,sensitive:n.sensitive,area_name:n.area_name,floor_name:n.floor_name,attributes:{},actions:[],selectable:!0,reason:null});return e}function Lt(t,e=new Map){for(const n of t)e.set(n.entity_id,{entity_id:n.entity_id,name:n.name,domain:n.domain,class:n.class,sensitive:n.sensitive,area_name:n.area_name,floor_name:n.floor_name,attributes:n.attributes??{},actions:n.actions,selectable:n.selectable,reason:n.reason});return e}function De(t,e){return e?t.get(e)?.class??null:null}function jt(t){const e=[];for(const n of t)for(const i of n.actions)i.entity_id&&!e.includes(i.entity_id)&&e.push(i.entity_id);return e}function $(t){if(Array.isArray(t))return`[${t.map($).join(",")}]`;if(t&&typeof t=="object"){const e=t;return`{${Object.keys(e).sort().map(n=>`${JSON.stringify(n)}:${$(e[n])}`).join(",")}}`}return JSON.stringify(t)}function Ut(t){const e=[];for(const n of t){const i=`${n.service}|${$(n.data)}`,s=n.entity_id?e.find(r=>r.key===i&&r.entities[0]!==null):void 0;s?s.entities.push(n.entity_id):e.push({key:i,service:n.service,data:{...n.data},entities:[n.entity_id]})}return e}function ze(t,e,n,i){return t.map(s=>s.service===e.service&&$(s.data)===$(e.data)&&e.entities.includes(s.entity_id)?{...s,service:n,data:{...i}}:s)}function Wt(t,e){return t.filter(n=>n.entity_id!==e)}const ct=(t,e)=>!t.actions.length||t.actions.some(n=>n.service===e);function tt(t,e){const n=e.attributes.hvac_modes;return!Array.isArray(n)||!n.length?t:(t==="cool"?["cool","heat_cool","auto"]:["heat","heat_cool","auto"]).find(i=>n.includes(i))}const et=(t,e,n)=>{const i=Number(n.attributes.min_temp??NaN),s=Number(n.attributes.max_temp??NaN),r=Math.min(Number.isFinite(s)?s:1/0,Math.max(Number.isFinite(i)?i:-1/0,e));return t?{hvac_mode:t,temperature:r}:{temperature:r}};function Qt(t){const e=t.actions[0];return e?{service:e.service,entity_id:t.entity_id,data:re(e.args,t)}:null}function T(t,e){const n=e.domain,i=(s,r={})=>ct(e,s)?{service:s,entity_id:e.entity_id,data:r}:null;switch(t.kind){case"on":return n==="light"||n==="switch"||n==="fan"?i(`${n}.turn_on`):n==="climate"?i("climate.set_temperature",et(tt("cool",e),23,e)):n==="cover"?i("cover.open_cover"):n==="script"||n==="scene"||n==="input_boolean"?i(`${n}.turn_on`):n==="vacuum"?i("vacuum.start"):n==="humidifier"||n==="input_number"||n==="input_select"?Qt(e):null;case"off":return n==="light"||n==="switch"||n==="fan"?i(`${n}.turn_off`):n==="climate"?i("climate.turn_off"):n==="cover"?i("cover.close_cover"):n==="input_boolean"?i("input_boolean.turn_off"):n==="vacuum"?i("vacuum.return_to_base"):null;case"open":return n==="cover"?i("cover.open_cover"):n==="light"||n==="switch"||n==="fan"?i(`${n}.turn_on`):null;case"close":return n==="cover"?i("cover.close_cover"):n==="light"||n==="switch"||n==="fan"?i(`${n}.turn_off`):null;case"level":return n==="light"?i("light.turn_on",{brightness:Math.round(t.pct/100*255)}):n==="fan"?i("fan.turn_on",{percentage:t.pct}):n==="cover"?i("cover.set_cover_position",{position:t.pct}):T({kind:"on"},e);case"cover_pos":return n==="cover"?i("cover.set_cover_position",{position:t.pos}):T({kind:"on"},e);case"climate":return n==="climate"?i("climate.set_temperature",et(tt(t.mode,e),t.temp,e)):T({kind:"on"},e)}}function ut(t){const e=t.data;switch(t.service){case"light.turn_on":return typeof e.brightness=="number"?{kind:"level",pct:Math.round(e.brightness/255*100)}:typeof e.brightness_pct=="number"?{kind:"level",pct:e.brightness_pct}:{kind:"on"};case"switch.turn_on":return{kind:"on"};case"fan.turn_on":return typeof e.percentage=="number"?{kind:"level",pct:e.percentage}:{kind:"on"};case"light.turn_off":case"switch.turn_off":case"fan.turn_off":case"climate.turn_off":return{kind:"off"};case"cover.open_cover":return{kind:"open"};case"cover.close_cover":return{kind:"close"};case"cover.set_cover_position":return typeof e.position=="number"?{kind:"cover_pos",pos:e.position}:null;case"climate.set_temperature":return typeof e.temperature=="number"?{kind:"climate",mode:e.hvac_mode==="heat"?"heat":"cool",temp:e.temperature}:null;default:return null}}function Yt(t,e){if(t.service.split(".")[0]===e.domain&&ct(e,t.service))return{service:t.service,entity_id:e.entity_id,data:{...t.data}};const n=ut(t);return n?T(n,e):null}function Oe(t,e){return t.map(n=>{const i=new Set(n.actions.map(r=>r.entity_id)),s=[];for(const r of e){if(i.has(r.entity_id))continue;let o=null;if((n.intent||!n.actions.length)&&(o=T(n.intent??{kind:"on"},r)),!o){const u=n.actions.find(l=>l.entity_id&&l.service.split(".")[0]===r.domain);o=u?{service:u.service,entity_id:r.entity_id,data:{...u.data}}:null}!o&&n.actions[0]&&(o=Yt(n.actions[0],r)),o&&s.push(o)}return s.length?{...n,actions:[...n.actions,...s]}:n})}function Re(t,e){return t.map(n=>n.actions.some(i=>i.entity_id===e)?{...n,actions:Wt(n.actions,e)}:n)}function qe(t,e,n,i=[]){const s=[...new Set([...jt(t),...i])];if(!s.length)return[];const r=t.filter(d=>d.actions.length).sort((d,f)=>n(d)-n(f)),o=r[r.length-1],u=o?ut(o.actions[0]):null,l=u&&u.kind!=="off"&&u.kind!=="close"?{kind:"off"}:{kind:"on"},c=[];for(const d of s){const f=e.get(d);if(!f)continue;const m=T(l,f);m&&c.push(m)}return c}const Bt=["alarm_control_panel.alarm_arm_home","alarm_control_panel.alarm_arm_away","alarm_control_panel.alarm_arm_night","alarm_control_panel.alarm_arm_vacation","alarm_control_panel.alarm_arm_custom_bypass"];function Kt(t,e,n){const i=n?.find(s=>s.service===t.service);return i&&n&&n.length&&t.service!=="cover.set_cover_position"?i.lowering:t.service==="alarm_control_panel.alarm_disarm"||t.service==="lock.unlock"?!0:e!=="door"?!1:t.service==="cover.set_cover_position"?Number(t.data.position??0)>0:["cover.open_cover","switch.turn_on","switch.turn_off","button.press"].includes(t.service)}function Gt(t,e,n){return(e==="script"||e==="scene")&&n?n.sensitive:!!e&&St.includes(e)||t.service.startsWith("alarm_control_panel.")||t.service.startsWith("lock.")}function Ht(t){return Y(g(t.start))}function Pe(t,e){const n=[],i=[],s=[];let r=!1;for(const o of t.slots){let u=!1;for(const l of o.actions){const c=l.entity_id?e.get(l.entity_id):void 0,d=c?.class??null;if(Gt(l,d,c)&&(r=!0),Kt(l,d,c?.actions)){u=!0;const f=c?.name??l.entity_id??"";f&&!n.includes(f)&&n.push(f);const m=l.service==="alarm_control_panel.alarm_disarm"?a("מנטרל"):l.service==="lock.unlock"?a("פותח נעילה"):a("פותח");i.includes(m)||i.push(m)}}u&&s.push(Ht(o))}return{entities:n,kinds:i,times:s.join(", "),sensitive:r,lowering:n.length>0}}function Jt(t){return{brightness:a("בהירות"),brightness_pct:a("בהירות"),position:a("מיקום"),tilt_position:a("הטיה"),temperature:a("טמפרטורה"),hvac_mode:a("מצב פעולה"),percentage:a("עוצמה"),fan_mode:a("מצב מאוורר"),preset_mode:a("מצב מוגדר"),swing_mode:a("מצב נדנוד"),humidity:a("לחות"),mode:a("מצב"),value:a("ערך"),option:a("אפשרות"),variables:a("משתני הסקריפט")}[t]??t}function dt(t,e){return t.service===e.service&&t.entity_id===e.entity_id&&$(t.data)===$(e.data)}function Vt(t,e,n,i){const s=e.data.variables??{};for(const r of t.fields??[])r.required&&(s[r.name]===void 0||s[r.name]==="")&&i(`${n}.data.variables`,"required",a("חסר משתנה חובה של הסקריפט: {name}",{name:r.label??r.name}));for(const r of Object.keys(s))(t.fields??[]).some(o=>o.name===r)||i(`${n}.data.variables`,"argument_not_allowed",a("לסקריפט אין משתנה בשם {name}.",{name:r}))}function Xt(t,e,n,i){if(t.type==="vars"){Vt(t,e,n,i);return}const s=e.data[t.name],r=t.label??Jt(t.name);if(s==null||s===""){t.required&&i(`${n}.data.${t.name}`,"required",a("נדרש ערך: {label}.",{label:r}));return}(t.type==="int"||t.type==="float")&&(typeof s!="number"||Number.isNaN(s))?i(`${n}.data.${t.name}`,"type",a("{label}: נדרש מספר.",{label:r})):typeof s=="number"&&(t.min!==void 0&&s<t.min||t.max!==void 0&&s>t.max)?i(`${n}.data.${t.name}`,"out_of_range",a("{label} מחוץ לטווח {min}–{max}.",{label:r,min:t.min??"",max:t.max??""})):t.choices&&t.choices.length&&typeof s=="string"&&!t.choices.includes(s)&&!(t.name==="hvac_mode"&&s==="off")&&i(`${n}.data.${t.name}`,"choice",a("{label}: ערך לא זמין להתקן.",{label:r}))}function Zt(t,e,n,i,s,r){const o=t.data.temperature,u=Number(e.attributes.min_temp??NaN),l=Number(e.attributes.max_temp??NaN);typeof o=="number"&&Number.isFinite(u)&&o<u&&s(`${n}.data.temperature`,"out_of_range",a("טמפרטורה מחוץ לטווח {min}–{max}.",{min:u,max:Number.isFinite(l)?l:""}));const c=i.original?.slots.some(m=>m.actions.some(p=>dt(p,t))),d=Bt.includes(t.service)&&e.attributes.code_arm_required===!0,f=t.service==="alarm_control_panel.alarm_disarm"&&!!e.attributes.code_format;(d||f)&&(c?r(n,"alarm_may_need_code",a("לוח האזעקה עשוי לדרוש קוד, ותזמון אינו שומר קודים.")):s(n,"alarm_code_needed",a("לוח האזעקה דורש קוד לפעולה זו. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותה."))),(t.service==="lock.lock"||t.service==="lock.unlock")&&e.attributes.code_format&&(c||s(n,"lock_code_needed",a("המנעול דורש קוד. תזמון אינו שומר קודים, ולכן אי אפשר לתזמן אותו.")))}function te(t,e,n,i,s){if(!t.entity_id){i(e,"action_without_entity",a("הפעולה אינה מותרת בתזמון."));return}const r=n.meta.get(t.entity_id);if(!r)return;!r.selectable&&r.reason&&(n.original?.slots.some(l=>l.actions.some(c=>dt(c,t)))||i(`${e}.entity_id`,r.reason.code,r.reason.message));const o=r.actions.find(u=>u.service===t.service);r.actions.length&&!o&&i(`${e}.service`,"action_not_allowed",a("הפעולה אינה מותרת בתזמון.")),"code"in t.data&&i(`${e}.data.code`,"code_not_allowed",a("אסור לשמור קוד בתוך תזמון."));for(const u of o?.args??[])Xt(u,t,e,i);Zt(t,r,e,n,i,s)}function Fe(t,e){const n=[],i=[],s=(l,c,d)=>n.push({path:l,code:c,message:d}),r=(l,c,d)=>i.push({path:l,code:c,message:d}),o=(t.name??"").trim();e.creating&&!o&&s("name","required",a("נדרש שם לתזמון.")),o.length>80&&s("name","too_long",a("השם ארוך מדי (עד 80 תווים).")),t.weekdays.length||s("weekdays","required",a("נדרש יום אחד לפחות.")),t.start_date&&t.end_date&&t.start_date>t.end_date&&s("end_date","order",a("תאריך הסיום לפני תאריך ההתחלה.")),t.slots.length||s("slots","required",a("נדרשת לפחות משבצת אחת.")),t.slots.length>(e.maxSlots??48)&&s("slots","too_many",a("יותר מדי משבצות בתזמון אחד.")),t.repeat==="single"&&r("repeat","single_deletes",a("התזמון יימחק אחרי ההרצה האחרונה.")),t.slots.forEach((l,c)=>{const d=g(l.start),f=l.stop?g(l.stop):null;d||s(`slots[${c}].start`,"time",a("שעת התחלה לא תקינה.")),l.stop&&!f&&s(`slots[${c}].stop`,"time",a("שעת סיום לא תקינה.")),d&&f&&l.stop!=="00:00:00"&&N(f,e.sun)<=N(d,e.sun)&&s(`slots[${c}].stop`,"order",a("שעת הסיום לפני שעת ההתחלה.")),l.actions.length||s(`slots[${c}].actions`,"required",a("לכל משבצת נדרשת פעולה.")),l.actions.length>20&&s(`slots[${c}].actions`,"too_many",a("יותר מדי פעולות במשבצת אחת.")),l.actions.forEach((m,p)=>te(m,`slots[${c}].actions[${p}]`,e,s,r))});for(const[l,c]of xt(t.slots,e.sun))s(`slots[${c}]`,"slots_overlap",a("משבצת {n} חופפת למשבצת {other}.",{n:c+1,other:l+1}));const u=t.conditions;u.items.length>10&&s("conditions.items","too_many",a("יותר מדי תנאים.")),u.items.forEach((l,c)=>{l.entity_id||s(`conditions.items[${c}]`,"required",a("נדרש חיישן לתנאי.")),(l.match_type==="above"||l.match_type==="below")&&(typeof l.value!="number"||Number.isNaN(l.value))&&s(`conditions.items[${c}].value`,"type",a("בהשוואה מספרית נדרש מספר.")),(l.match_type==="is"||l.match_type==="not")&&(String(l.value).length<1||String(l.value).length>100)&&s(`conditions.items[${c}].value`,"required",a("נדרש ערך לתנאי."))});for(const l of e.lockedConditions.filter(c=>c.locked))u.items.some(d=>d.entity_id===l.entity_id&&d.attribute===l.attribute&&d.match_type===l.match_type&&d.value===l.value)||s("conditions.items","condition_locked",a('התנאי "{name}" מחוץ להרשאתך ואי אפשר לשנות או להסיר אותו.',{name:l.name}));return u.track&&t.slots.some(l=>!l.stop)&&r("conditions.track","track_needs_window",a("בדיקה מתמשכת דורשת משבצת עם שעת סיום.")),{errors:n,warnings:i}}function Ie(t){const e=/^slots\[(\d+)\]/.exec(t??"");return e?Number(e[1]):-1}function ee(t,e){return $(nt(t))===$(nt(e))}function nt(t){return{...t,name:(t.name??"").trim(),tags:[...t.tags],slots:t.slots.map(e=>({start:e.start,stop:e.stop,actions:e.actions}))}}function Le(t,e,n){const i=G(e.weekdays);if(!i)return{ok:!1,error:a("לא ניתן לפצל תזמון לפי ימי עבודה או סוף שבוע; בחרו ימים מפורשים תחילה.")};const s=i.filter(c=>n.days.includes(c)),r=i.filter(c=>!s.includes(c));if(!s.length||!r.length)return{ok:!1,error:a("בחרו חלק מהימים בלבד (לא את כולם ולא אף יום).")};const o={...e,weekdays:W(r)},u={...t,weekdays:W(r)},l={...t,weekdays:W(s),slots:n.slots};return{ok:!0,days:s,remaining:r,afterSplit:o,originalUpdate:ee(u,o)?null:u,created:l}}function I(t){return t.items.length?{items:t.items.map(e=>({...e})),type:t.items.length===1?"or":t.type??"and",track:t.track}:{items:[],type:null,track:!1}}function je(t){return t.numeric?{entity_id:t.entity_id,attribute:"state",match_type:"above",value:Number.isFinite(Number(t.state))?Math.round(Number(t.state)):0}:t.domain==="sun"?{entity_id:t.entity_id,attribute:"state",match_type:"is",value:"above_horizon"}:{entity_id:t.entity_id,attribute:"state",match_type:"is",value:"on"}}function Ue(t,e){const n=t.items.length>=2?t.type??"and":t.items.length===1?"and":"or";return I({...t,items:[...t.items,e],type:n})}function We(t,e){return I({...t,items:t.items.filter((n,i)=>i!==e)})}function Qe(t,e,n){return I({...t,items:t.items.map((i,s)=>s===e?{...i,...n}:i)})}function Ye(t,e,n,i=[]){const s=F(e,n),r=t.items.filter(o=>i.includes(o.entity_id));return r.length?I({items:[...r,...s.items],type:t.type??"and",track:t.track}):s}function Be(t,e=[]){return I({...t,items:t.items.filter(n=>e.includes(n.entity_id))})}function Ke(t,e){return Mt(t,e)}function ne(t,e=40){const n=String(Math.floor(e/60)).padStart(2,"0"),i=String(e%60).padStart(2,"0");return{weekdays:["sat"],conditions:F("not_holy_days",t),start:`sunset+${n}:${i}:00`}}const q={on:a("פעיל"),off:a("כבוי"),above_horizon:a("מעל האופק"),below_horizon:a("מתחת לאופק"),home:a("בבית"),not_home:a("לא בבית"),open:a("פתוח"),closed:a("סגור")};function se(t,e){if(t.attribute==="state"&&typeof t.value=="string"&&t.value in q){const i=t.match_type==="is";return t.value==="on"||t.value==="off"?i===(t.value==="on")?a("{name} פעיל",{name:e}):a("{name} כבוי",{name:e}):i?a("{name} הוא {state}",{name:e,state:q[t.value]}):a("{name} אינו {state}",{name:e,state:q[t.value]})}const n={name:e,value:t.value};return t.match_type==="is"?a("{name} שווה ל {value}",n):t.match_type==="not"?a("{name} שונה מ {value}",n):t.match_type==="above"?a("{name} מעל {value}",n):a("{name} מתחת ל {value}",n)}function Ge(t){return!t||t.numeric?[]:t.domain==="sun"?[{value:"above_horizon",label:q.above_horizon},{value:"below_horizon",label:q.below_horizon}]:[{value:"on",label:a("פעיל")},{value:"off",label:a("כבוי")}]}function He(t,e,n){const i={...n},s={};for(const r of e){const o=t.slots[r.slot_index],u=o?g(o.start):null;if(!u||u.kind!=="sun"||s[u.event])continue;const l=new Date(r.at);if(Number.isNaN(l.getTime()))continue;const d=l.getHours()*60+l.getMinutes()-u.offset_min;d>0&&d<1440&&(i[u.event]=d,s[u.event]=!0)}return i}function Je(t,e){const n=Ut(t.actions);if(!n.length)return a("בחרו פעולה");const i=n[0],s=i.entities.map(o=>o?e.get(o)?.name??o:a("ללא התקן")),r=s.length>1?a("{n} התקנים",{n:s.length}):s[0]??"";return`${rt({service:i.service,data:i.data})}${r?` · ${r}`:""}${n.length>1?` (+${n.length-1})`:""}`}const ie={"light.turn_on":a("הדלקה"),"light.turn_off":a("כיבוי"),"switch.turn_on":a("הדלקה"),"switch.turn_off":a("כיבוי"),"fan.turn_on":a("הפעלה"),"fan.turn_off":a("כיבוי"),"fan.set_percentage":a("עוצמת מאוורר"),"cover.open_cover":a("פתיחה"),"cover.close_cover":a("סגירה"),"cover.stop_cover":a("עצירה"),"cover.set_cover_position":a("מיקום"),"cover.set_cover_tilt_position":a("הטיה"),"climate.set_temperature":a("טמפרטורת יעד"),"climate.set_hvac_mode":a("מצב פעולה"),"climate.set_fan_mode":a("מצב מאוורר"),"climate.set_preset_mode":a("מצב מוגדר מראש"),"climate.turn_off":a("כיבוי מיזוג"),"alarm_control_panel.alarm_arm_home":a("דריכה בבית"),"alarm_control_panel.alarm_arm_away":a("דריכה מלאה"),"alarm_control_panel.alarm_arm_night":a("דריכת לילה"),"alarm_control_panel.alarm_arm_vacation":a("דריכת חופשה"),"alarm_control_panel.alarm_arm_custom_bypass":a("דריכה עם עקיפה"),"alarm_control_panel.alarm_disarm":a("נטרול"),"lock.lock":a("נעילה"),"lock.unlock":a("פתיחת נעילה"),"button.press":a("לחיצה"),"cover.open_cover_tilt":a("פתיחת הטיה"),"cover.close_cover_tilt":a("סגירת הטיה"),"climate.set_swing_mode":a("מצב נדנוד"),"climate.set_humidity":a("לחות יעד"),"script.turn_on":a("הפעלת סקריפט"),"scene.turn_on":a("הפעלת סצנה"),"input_boolean.turn_on":a("הפעלה"),"input_boolean.turn_off":a("כיבוי"),"input_number.set_value":a("קביעת ערך"),"input_select.select_option":a("בחירה"),"humidifier.set_humidity":a("לחות יעד"),"humidifier.set_mode":a("מצב לחות"),"vacuum.start":a("התחלת ניקוי"),"vacuum.return_to_base":a("חזרה לעמדה")};function Ve(t,e){return ie[t]??(e||t)}let ae=0;const ft=()=>`s${Date.now().toString(36)}${(++ae).toString(36)}`,Xe=t=>({...t,uid:t.uid??ft()});function Ze(t){return t.map(e=>({...e,uid:ft(),actions:e.actions.map(n=>({...n,data:{...n.data}}))}))}function tn(t){return t.map(e=>({start:e.start,stop:e.stop,actions:e.actions.map(n=>({service:n.service,entity_id:n.entity_id,data:{...n.data}}))}))}function re(t,e){const n={};for(const i of t){if(i.type==="vars"){const s={};for(const r of i.fields??[])r.required&&(r.default!==void 0?s[r.name]=r.default:r.choices?.length?s[r.name]=r.choices[0]:r.type==="int"||r.type==="float"?s[r.name]=r.min??0:r.type==="bool"&&(s[r.name]=!1));Object.keys(s).length&&(n.variables=s);continue}if(i.required)if(i.name==="temperature"){const s=Number(e?.attributes.min_temp??i.min??16),r=Number(e?.attributes.max_temp??i.max??30);n.temperature=Math.min(r,Math.max(s,23))}else i.choices?.length?n[i.name]=i.name==="hvac_mode"?["cool","heat_cool","heat","auto"].find(s=>i.choices.includes(s))??i.choices.find(s=>s!=="off")??i.choices[0]:i.choices[0]:i.type==="int"||i.type==="float"?n[i.name]=i.name==="value"&&i.min!==void 0?i.min:Math.min(i.max??100,Math.max(i.min??0,50)):(i.type==="enum"||i.type==="str")&&(n[i.name]="")}return n}function en(t,e=!1){if(t==null)return{kind:"none",time:"08:00",offset:0};if(e&&t==="00:00:00")return{kind:"end",time:"00:00",offset:0};const n=g(t);return n?n.kind==="sun"?{kind:n.event,time:"00:00",offset:n.offset_min}:{kind:"fixed",time:n.time,offset:0}:{kind:"fixed",time:"00:00",offset:0}}function nn(t){if(t.kind==="none")return null;if(t.kind==="end")return"00:00:00";if(t.kind==="fixed"){const n=/^(\d{1,2}):(\d{2})/.exec(t.time);return n?`${n[1].padStart(2,"0")}:${n[2]}:00`:"00:00:00"}const e=Math.abs(Math.round(t.offset));return`${t.kind}${t.offset<0?"-":"+"}${String(Math.floor(e/60)).padStart(2,"0")}:${String(e%60).padStart(2,"0")}:00`}const st={repeat:a("חוזר"),pause:a("פעם אחת, מושהה"),single:a("פעם אחת, נמחק")};function sn(t,e,n,i){const s=[],r=(l,c,d)=>{c!==d&&s.push({label:l,mine:c,theirs:d})};r(a("שם"),(t.name??"").trim()||a("ללא שם"),(e.name??"").trim()||a("ללא שם")),r(a("ימים"),i(t.weekdays),i(e.weekdays)),r(a("תקופה"),`${t.start_date??"—"} – ${t.end_date??"—"}`,`${e.start_date??"—"} – ${e.end_date??"—"}`),r(a("חזרה"),st[t.repeat],st[e.repeat]);const o=l=>l.conditions.items.length?`${l.conditions.items.map(c=>se(c,n(c.entity_id))).join(l.conditions.type==="and"?` ${a("וגם")} `:` ${a("או")} `)}${l.conditions.track?` (${a("בדיקה מתמשכת")})`:""}`:a("ללא");r(a("תנאים"),o(t),o(e));const u=l=>l.slots.length?l.slots.map(c=>`${Y(g(c.start))}${c.stop?`–${Y(g(c.stop))}`:""}: ${c.actions.map(d=>`${rt(d)} · ${n(d.entity_id)}`).join(", ")||"—"}`).join(`
`):a("ללא משבצות");return r(a("משבצות"),u(t),u(e)),s}const R=["sun","mon","tue","wed","thu"],w=(t,e,n)=>({start:t,stop:e,actions:[],...n?{intent:n}:{}});function D(t){return`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`}function K(t,e){return new Date(t.getFullYear(),t.getMonth(),t.getDate()+e)}const mt=[{id:"weekly",name:a("שגרה שבועית"),description:a("הדלקה בבוקר וכיבוי בערב, ראשון עד חמישי"),icon:"calendar",build:t=>({...k(t.defaultRepeat),name:a("שגרה שבועית"),weekdays:R,slots:[w("07:30:00","19:00:00",{kind:"on"}),w("19:00:00","00:00:00",{kind:"off"})]})},{id:"sunset",name:a("תאורה בשקיעה"),description:a("נדלקת בשקיעה ונכבית בזריחה, כל יום"),icon:"light",build:t=>({...k(t.defaultRepeat),name:a("תאורה בשקיעה"),slots:[w("sunrise+00:00:00","sunset+00:00:00",{kind:"off"}),w("sunset+00:00:00","00:00:00",{kind:"on"})]})},{id:"season",name:a("תריסים לפי עונה"),description:a("סגירה חלקית ביום, פתיחה בערב. עם תקופת תוקף"),icon:"coverOpen",build:t=>({...k(t.defaultRepeat),name:a("תריסים לפי עונה"),weekdays:R,start_date:D(t.now),end_date:D(K(t.now,120)),slots:[w("10:00:00","18:30:00",{kind:"cover_pos",pos:30}),w("18:30:00","00:00:00",{kind:"cover_pos",pos:100})]})},{id:"ac",name:a("מזגן בשעות משרד"),description:a("קירור 23° בבוקר, כיבוי בסוף היום"),icon:"activity",build:t=>({...k(t.defaultRepeat),name:a("מזגן בשעות משרד"),weekdays:R,slots:[w("07:00:00","18:00:00",{kind:"climate",mode:"cool",temp:23}),w("18:00:00","00:00:00",{kind:"off"})]})},{id:"once",name:a("פעם אחת – מחר"),description:a("הפעלה חד־פעמית מחר בבוקר; נמחק בסיום"),icon:"clock",build:t=>{const e=K(t.now,1);return{...k("single"),name:a("פעם אחת – מחר"),weekdays:[P[e.getDay()]],start_date:D(e),end_date:D(e),slots:[w("08:00:00","09:00:00",{kind:"on"}),w("09:00:00",null,{kind:"off"})]}}},{id:"shabbat_climate",name:a("שבת: קירור / חימום"),description:a("מזגן בשבת ובחג בלבד: קירור בלילה, כיבוי ביום"),icon:"activity",needsSensor:!0,build:t=>({...k(t.defaultRepeat),name:a("שבת – מזגן"),conditions:t.sensor?F("only_holy_days",t.sensor):k().conditions,slots:[w("00:00:00","07:00:00",{kind:"climate",mode:"cool",temp:25}),w("07:00:00","21:00:00",{kind:"off"}),w("21:00:00","00:00:00",{kind:"climate",mode:"cool",temp:25})]})},{id:"motzash",name:a("מוצאי שבת"),description:a("כיבוי או הדלקה בצאת השבת (שקיעה + 40 דקות), רק כשהחג הסתיים"),icon:"history",needsSensor:!0,build:t=>{const e=ne(t.sensor??"",40);return{...k(t.defaultRepeat),name:a("מוצאי שבת"),weekdays:e.weekdays,conditions:t.sensor?e.conditions:k().conditions,slots:[w(e.start,null,{kind:"off"})]}}},{id:"blank",name:a("ריק"),description:a("להתחיל מדף חלק"),icon:"plus",build:t=>({...k(t.defaultRepeat),name:"",weekdays:R,slots:[]})}];function an(t){return mt.find(e=>e.id===t)??null}function rn(t,e,n){return!e||!n||t.conditions.items.length?t:{...t,conditions:F(e,n)}}const oe=[{id:null,label:a("ללא תנאי")},{id:"only_holy_days",label:J.only_holy_days},{id:"not_holy_days",label:J.not_holy_days}],le=[{id:"sunset",label:a("שקיעה"),raw:"sunset+00:00:00",sun:!0},{id:"sunrise",label:a("זריחה"),raw:"sunrise+00:00:00",sun:!0},{id:"0700",label:"07:00",raw:"07:00:00",sun:!1},{id:"1800",label:"18:00",raw:"18:00:00",sun:!1},{id:"2200",label:"22:00",raw:"22:00:00",sun:!1}],ce=[{id:"daily",label:a("כל יום"),days:["daily"]},{id:"work",label:a("א׳–ה׳"),days:R},{id:"weekend",label:a("סוף שבוע"),days:["fri","sat"]},{id:"once",label:a("פעם אחת – מחר"),days:"tomorrow",once:!0}];function Q(t){if(!t)return[];switch(t.domain){case"light":return[{id:"on",label:a("הדלקה"),intent:{kind:"on"}},{id:"off",label:a("כיבוי"),intent:{kind:"off"}},{id:"level50",label:a("בהירות 50%"),intent:{kind:"level",pct:50}}];case"switch":return[{id:"on",label:a("הדלקה"),intent:{kind:"on"}},{id:"off",label:a("כיבוי"),intent:{kind:"off"}}];case"fan":return[{id:"on",label:a("הפעלה"),intent:{kind:"on"}},{id:"off",label:a("כיבוי"),intent:{kind:"off"}}];case"cover":return[{id:"open",label:a("פתיחה"),intent:{kind:"open"}},{id:"close",label:a("סגירה"),intent:{kind:"close"}},{id:"pos30",label:a("הנמכה ל־30%"),intent:{kind:"cover_pos",pos:30}}];case"climate":return[{id:"cool23",label:a("קירור 23°"),intent:{kind:"climate",mode:"cool",temp:23}},{id:"heat22",label:a("חימום 22°"),intent:{kind:"climate",mode:"heat",temp:22}},{id:"off",label:a("כיבוי"),intent:{kind:"off"}}];default:return[]}}const pt=t=>t.entities.length>0&&!!t.action&&!!t.time&&!!t.days;function ue(t){return t.entities.length?`${t.entities.length>3?a("{names} ועוד {n}",{names:t.entities.slice(0,3).map(n=>n.name).join(", "),n:t.entities.length-3}):t.entities.map(n=>n.name).join(` ${a("ו")}`)}: ${t.action?.label??"…"} · ${t.time?.label??"…"} · ${t.days?.label??"…"}`:a("בחרו התקנים כדי להתחיל.")}function it(t,e,n,i=null,s=null){if(!pt(t))return null;const r=t.action,o=t.time,u=t.days,l=K(n,1),c=u.days==="tomorrow"?[P[l.getDay()]]:u.days,d=t.entities.map(p=>T(r.intent,p)).filter(p=>!!p);if(!d.length)return null;const f=`${t.entities.length===1?t.entities[0].name:a("{names} ועוד {n}",{names:t.entities[0].name,n:t.entities.length-1})}: ${r.label} · ${o.label}`.slice(0,80),m=k(u.once?"single":e);return{...m,name:f,weekdays:c,start_date:u.once?D(l):null,end_date:u.once?D(l):null,conditions:i&&s?F(i,s):m.conditions,slots:[{start:o.raw,stop:null,actions:d}]}}var de=Object.defineProperty,_=(t,e,n,i)=>{for(var s=void 0,r=t.length-1,o;r>=0;r--)(o=t[r])&&(s=o(e,n,s)||s);return s&&de(e,n,s),s};const fe="sw.schedules.newdraft",me={calendar:"calendar",clock:"clock",light:"light",coverOpen:"coverOpen",activity:"activity",plus:"plus",history:"history"};class v extends ht{constructor(){super(...arguments),this.open=!1,this.tab="tpl",this.tpl=null,this.preset=null,this.status=null,this.entities=[],this.loading=!1,this.loadError="",this.area="",this.picked=[],this.action=null,this.time=null,this.days=null,this.busy=!1,this.error="",this.note="",this.wasOpen=!1}static{this.styles=_t`
    :host {
      display: contents;
    }
    /* AUDIT30-I3 (#11, owner Q9 option a): the dialog is the product's one <sw-dialog> (its scrim, its centred box, its spring, its focus
       trap, Escape and the return of focus), wide. Opaque in every skin: the glass skins' translucent --sw-surface and their blur stop
       at this box (the audit measured the old box as rgba(255,255,255,.64) under a 40 px blur in the glass look). */
    sw-dialog {
      --sw-surface: var(--sw-surface-solid);
      --sw-glass-blur: none;
    }
    .tabs {
      display: flex;
      margin: 0;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      padding: 3px;
    }
    .tabs button {
      flex: 1;
      border: 0;
      background: none;
      font: inherit;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      min-block-size: 36px;
      padding: 0 10px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    .tabs button:active {
      transform: scale(var(--sw-press-scale));
    }
    .tabs button[aria-selected='true'] {
      background: var(--sw-seg-key, var(--sw-surface));
      color: var(--sw-seg-key-ink, var(--sw-accent-text));
      box-shadow: var(--sw-seg-thumb-shadow, var(--sw-shadow-1));
      font-weight: var(--sw-fw-bold);
    }
    /* the tabs, the body and the footer live in sw-dialog's slots; its body scrolls, its footer stays (the actions are always on screen) */
    .cbody {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-block-start: 4px;
    }
    .tpls {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
    }
    .tpl {
      text-align: start;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      padding: 12px 14px;
      font: inherit;
      color: var(--sw-text);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: transform var(--sw-t-press) var(--sw-ease), border-color var(--sw-t-hover) var(--sw-ease-color), background var(--sw-t-hover) var(--sw-ease-color), box-shadow var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    @media (hover: hover) and (pointer: fine) {
      .tpl:not(:disabled):hover {
        border-color: var(--sw-border-strong);
        box-shadow: var(--sw-shadow-1);
      }
      .chip:not(:disabled):hover {
        background: var(--sw-hover-wash);
      }
    }
    .tpl:not(:disabled):active,
    .chip:not(:disabled):active {
      transform: scale(var(--sw-press-scale));
    }
    .tpl[aria-pressed='true'] {
      border-color: var(--sw-accent);
      background: var(--sw-accent-soft);
      box-shadow: inset 0 0 0 1px var(--sw-accent);
    }
    .tpl:disabled {
      cursor: not-allowed;
      background: var(--sw-surface-2);
    }
    .tpl:disabled .top,
    .tpl:disabled > span:not(.why) {
      opacity: 0.6;
    }
    .tpl .top {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tile {
      display: grid;
      place-items: center;
      inline-size: 32px;
      block-size: 32px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      flex: none;
    }
    .tpl b {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-heading, var(--sw-text));
    }
    .tpl span {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      line-height: 1.45;
    }
    .tpl .why {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--sw-warning-text);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
    }
    .sec {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .sec > label,
    .sec > .lbl {
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-bold);
      color: var(--sw-heading, var(--sw-text));
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      min-block-size: 36px;
      padding: 0 14px;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      color: var(--sw-text);
      border-radius: var(--sw-r-pill);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color);
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
    /* AUDIT30-I2 (#4, owner Q3 option a): the chosen chip is the Blue Wash pair (was solid accent) */
    .chip[aria-pressed='true'] {
      ${vt}
    }
    /* DOMUS-DEFAULT-2439: the check mark of the selected chip (hidden by the other looks of ui.chip_selected) */
    .chip[aria-pressed='true']::before {
      ${bt}
    }
    .chip:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
    .tabs button:focus-visible,
    .tpl:focus-visible,
    .chip:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset, 2px);
    }
    .banner {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 14px;
      border-radius: var(--sw-r-md);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-medium);
    }
    .banner sw-icon {
      flex: none;
    }
    .banner.ok {
      background: var(--sw-success-soft);
      color: var(--sw-success-text);
    }
    .banner.err {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
    }
    .loading {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .loading i {
      display: block;
      block-size: 36px;
      border-radius: var(--sw-r-md);
      background: var(--sw-skeleton, var(--sw-surface-3));
    }
    .loading i:nth-child(2) {
      inline-size: 70%;
    }
    .foot {
      flex: 1;
      display: flex;
      justify-content: flex-start;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .foot .full {
      flex: 1 1 100%;
    }
    .foot .sp {
      flex: 1;
    }
    @media (pointer: coarse) {
      .chip,
      .tabs button {
        min-block-size: 44px;
      }
    }
    @media (max-width: 640px) {
      .tpls {
        grid-template-columns: 1fr;
      }
      .foot sw-button {
        flex: 1;
      }
      .foot .sp {
        display: none;
      }
    }
  `}willUpdate(e){e.has("open")&&this.open&&!this.wasOpen&&this.reset(),e.has("open")&&(this.wasOpen=this.open)}updated(e){e.has("open")&&this.open&&requestAnimationFrame(()=>this.renderRoot.querySelector('.tabs [aria-selected="true"]')?.focus({preventScroll:!0}))}onTabKey(e){const n=["tpl","quick"],i=n.indexOf(this.tab);let s=i;if(e.key==="ArrowLeft")s=Math.min(n.length-1,i+1);else if(e.key==="ArrowRight")s=Math.max(0,i-1);else if(e.key==="Home")s=0;else if(e.key==="End")s=n.length-1;else return;e.preventDefault(),this.tab=n[s],this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-create-tab="${n[s]}"]`)?.focus())}async reset(){this.tab="tpl",this.tpl=null,this.preset=null,this.area="",this.picked=[],this.action=null,this.time=null,this.days=null,this.error="",this.note="",this.loadError="",this.loading=!0;try{this.status=await Et()}catch{this.status=null}try{this.entities=(await Nt()).entities}catch(e){this.entities=[],this.loadError=e instanceof Error?e.message:""}this.loading=!1}get sensor(){return this.status?.settings.shabbat_sensor?.entity_id??null}get meta(){return Lt(this.entities)}close(){this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}useTemplate(){if(!this.tpl)return;const e={template:this.tpl};this.preset&&this.sensor&&(e.preset=this.preset),this.close(),H("/devices/schedules/new/edit",e)}get quickEntities(){return this.entities.filter(e=>e.selectable&&!e.sensitive&&Q(this.meta.get(e.entity_id)).length>0)}get areas(){return[...new Set(this.quickEntities.map(e=>e.area_name??a("ללא אזור")))]}get chosen(){const e=this.meta;return this.picked.map(n=>e.get(n)).filter(n=>!!n)}togglePicked(e){this.picked=this.picked.includes(e)?this.picked.filter(s=>s!==e):[...this.picked,e];const n=this.chosen[0],i=Q(n);(!n||!i.some(s=>s.id===this.action?.id))&&(this.action=null)}choice(){return{entities:this.chosen,action:this.action,time:this.time,days:this.days}}async quickCreate(){const e=it(this.choice(),this.status?.settings.default_repeat??"repeat",new Date,this.preset,this.sensor);if(e){this.busy=!0,this.error="";try{const n=await Tt(e,{enabled:!0});"schedule"in n?this.dispatchEvent(new CustomEvent("created",{detail:{id:n.schedule.id},bubbles:!0,composed:!0})):(this.note=n.message,this.dispatchEvent(new CustomEvent("created",{detail:{id:""},bubbles:!0,composed:!0}))),"schedule"in n&&this.close()}catch(n){this.error=n instanceof gt?n.message:a("היצירה נכשלה. אפשר לנסות שוב.")}this.busy=!1}}quickEdit(){const e=it(this.choice(),this.status?.settings.default_repeat??"repeat",new Date,this.preset,this.sensor);if(e){try{sessionStorage.setItem(fe,JSON.stringify(e))}catch{}this.close(),H("/devices/schedules/new/edit",{draft:"1"})}}renderPresets(){return this.sensor?h`<div class="sec"><span class="lbl" id="preset-lbl">${a("תנאי")}</span><div class="chips" role="group" aria-labelledby="preset-lbl">
      ${oe.map(e=>h`<button type="button" class="chip" data-create-preset=${e.id??"none"} aria-pressed=${this.preset===e.id} @click=${()=>this.preset=e.id}>${e.label}</button>`)}
    </div></div>`:this.status?.can.configure?h`<div class="hint" data-preset-hint>${a("בחרו חיישן שבת וחג בהגדרות ‹ תזמונים כדי לקבל תנאים מוכנים.")}</div>`:E}renderTemplates(){return h`<div class="tpls" role="group" aria-label=${a("תבניות")}>
        ${mt.map(e=>{const n=!!e.needsSensor&&!this.sensor;return h`<button type="button" class="tpl" data-template=${e.id} aria-pressed=${this.tpl===e.id} ?disabled=${n} title=${n?a("דורש חיישן שבת וחג בהגדרות"):""} @click=${()=>this.tpl=e.id}>
            <span class="top"><span class="tile"><sw-icon name=${me[e.icon]} size="16"></sw-icon></span><b>${e.name}</b></span>
            <span>${e.description}</span>
            ${n?h`<span class="why" data-template-blocked><sw-icon name="lock" size="12"></sw-icon>${a("דורש חיישן שבת וחג בהגדרות")}</span>`:E}
          </button>`})}
      </div>
      ${this.renderPresets()}`}renderTemplatesFooter(){return h`<div class="foot" slot="footer">
      <sw-button variant="primary" data-create-continue ?disabled=${!this.tpl} @click=${()=>this.useTemplate()}>${a("המשך לעורך")}</sw-button>
      <span class="sp"></span>
      <sw-button variant="ghost" @click=${()=>this.close()}>${a("ביטול")}</sw-button>
    </div>`}renderQuick(){const e=this.quickEntities.filter(s=>(s.area_name??a("ללא אזור"))===this.area),n=this.chosen[0],i=Q(n);return h`<div class="sec"><span class="lbl" id="q-where">1 · ${a("איפה?")}</span>
        <div class="chips" role="group" aria-labelledby="q-where">${this.areas.map(s=>h`<button type="button" class="chip" data-quick-area=${s} aria-pressed=${this.area===s} @click=${()=>this.area=s}>${s}</button>`)}</div>
        ${this.area?h`<div class="chips" role="group" aria-label=${`${a("התקנים")} · ${this.area}`}>${e.map(s=>{const r=this.picked.includes(s.entity_id),o=n&&n.domain!==s.domain;return h`<button type="button" class="chip" data-quick-entity=${s.entity_id} aria-pressed=${r} ?disabled=${!r&&!!o} @click=${()=>this.togglePicked(s.entity_id)}>${s.name}</button>`})}</div>`:E}
      </div>
      <div class="sec"><span class="lbl" id="q-what">2 · ${a("מה ומתי?")}</span>
        <div class="chips" role="group" aria-labelledby="q-what">${i.length?i.map(s=>h`<button type="button" class="chip" data-quick-action=${s.id} aria-pressed=${this.action?.id===s.id} @click=${()=>this.action=s}>${s.label}</button>`):h`<span class="hint">${a("בחרו התקן קודם")}</span>`}</div>
        <div class="chips" role="group" aria-label=${a("מתי")}>${le.map(s=>h`<button type="button" class="chip" data-quick-time=${s.id} aria-pressed=${this.time?.id===s.id} @click=${()=>this.time=s}><sw-icon name=${s.sun?"history":"clock"} size="13"></sw-icon>${s.label}</button>`)}</div>
      </div>
      <div class="sec"><span class="lbl" id="q-days">3 · ${a("באילו ימים?")}</span>
        <div class="chips" role="group" aria-labelledby="q-days">${ce.map(s=>h`<button type="button" class="chip" data-quick-days=${s.id} aria-pressed=${this.days?.id===s.id} @click=${()=>this.days=s}>${s.label}</button>`)}</div>
      </div>
      ${this.renderPresets()}`}renderQuickFooter(){const e=this.choice(),n=pt(e);return h`<div class="foot" slot="footer">
      <div class="banner full ${n?"ok":""}" data-quick-sentence aria-live="polite"><sw-icon name=${n?"check":"info"} size="16"></sw-icon><span>${ue(e)}</span></div>
      ${this.error?h`<div class="banner err full" role="alert" data-create-error><sw-icon name="warning" size="16"></sw-icon>${this.error}</div>`:E}
      ${this.note?h`<div class="banner full" data-create-note>${this.note}</div>`:E}
      <sw-button variant="primary" icon="plus" data-quick-go ?disabled=${!n||this.busy} @click=${()=>this.quickCreate()}>${this.busy?a("יוצר…"):a("יצירת התזמון")}</sw-button>
      <sw-button data-quick-edit ?disabled=${!n||this.busy} @click=${()=>this.quickEdit()}>${a("פתיחה בעורך")}</sw-button>
      <span class="sp"></span>
      <sw-button variant="ghost" ?disabled=${this.busy} @click=${()=>this.close()}>${a("ביטול")}</sw-button>
    </div>`}render(){if(!this.open)return E;const e=(n,i)=>h`<button type="button" role="tab" id=${`tab-${n}`} aria-controls="create-panel" aria-selected=${this.tab===n} tabindex=${this.tab===n?0:-1} data-create-tab=${n} @click=${()=>this.tab=n} @keydown=${s=>this.onTabKey(s)}>${i}</button>`;return h`<sw-dialog wide .open=${this.open} heading=${a("תזמון חדש")} ?locked=${this.busy} data-create-dialog @close=${n=>{n.stopPropagation(),this.close()}}>
        <div class="tabs" role="tablist" aria-label=${a("דרך היצירה")} @keydown=${yt}>
          ${e("tpl",a("מתבנית"))}${e("quick",a("יצירה מהירה (3 הקשות)"))}
        </div>
        <div class="cbody" id="create-panel" role="tabpanel" aria-labelledby=${`tab-${this.tab}`} aria-busy=${this.loading?"true":"false"}>
          ${this.loadError&&this.tab==="quick"?h`<div class="banner err" role="alert"><sw-icon name="warning" size="16"></sw-icon>${this.loadError}</div>`:E}
          ${this.loading&&this.tab==="quick"?h`<div class="loading" role="status" aria-label=${a("טוען…")}><i></i><i></i><i></i></div>`:this.tab==="tpl"?this.renderTemplates():this.renderQuick()}
        </div>
        ${this.tab==="tpl"?this.renderTemplatesFooter():this.renderQuickFooter()}
      </sw-dialog>`}}_([wt({type:Boolean,reflect:!0})],v.prototype,"open");_([y()],v.prototype,"tab");_([y()],v.prototype,"tpl");_([y()],v.prototype,"preset");_([y()],v.prototype,"status");_([y()],v.prototype,"entities");_([y()],v.prototype,"loading");_([y()],v.prototype,"loadError");_([y()],v.prototype,"area");_([y()],v.prototype,"picked");_([y()],v.prototype,"action");_([y()],v.prototype,"time");_([y()],v.prototype,"days");_([y()],v.prototype,"busy");_([y()],v.prototype,"error");_([y()],v.prototype,"note");customElements.get("schedule-create-dialog")||customElements.define("schedule-create-dialog",v);export{$e as $,se as A,Ge as B,Ae as C,b as D,We as E,Qe as F,He as G,tn as H,ee as I,De as J,Fe as K,W as L,Ie as M,Ce as N,Lt as O,jt as P,Xe as Q,z as R,fe as S,an as T,mt as U,rn as V,zt as W,qe as X,C as Y,ye as Z,Ne as _,Pt as a,xe as a0,we as a1,ke as a2,Ze as a3,Re as a4,Pe as a5,Le as a6,V as a7,Ee as a8,ne as a9,Oe as aa,sn as ab,qt as b,ge as c,Rt as d,nn as e,ze as f,re as g,Ut as h,Yt as i,Ve as j,Gt as k,Kt as l,_e as m,Je as n,be as o,Z as p,Me as q,Wt as r,Te as s,en as t,Se as u,Ke as v,Be as w,Ye as x,Ue as y,je as z};
