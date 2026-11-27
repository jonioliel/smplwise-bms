import{cL as n,d8 as Me,gG as W,gF as Ae,e as Te,ut as ce,uu as Le,uv as Ce,bP as Se,j as C,db as Re,gP as Be,gK as Ke,da as se,d$ as Ne,i4 as ne,dn as je,gT as Ie,gO as Ue,uw as Z,iT as Ge,ds as ae,dg as Ve,ux as Ye,uy as Fe,gQ as He,z as x,k as m,a as G,A as p,cV as k,b as o,uz as Xe,aj as v,bo as V,m as Y,eK as Ee,uA as De,dd as D,e1 as A,uB as Qe,uC as Je,uD as We,dZ as ee,uE as Ze,uF as pe,uG as et,uH as tt,uI as de,uJ as ue,uK as rt,uL as it,uM as st,uN as nt,l2 as at,bC as me,l3 as ot,uO as he,uP as fe,uQ as q,uR as ve,c as H,l4 as lt,dY as be,i1 as ct,af as pt,c6 as dt,uS as ut,e0 as mt,dc as ht,uT as ft,d_ as ge,uU as vt,df as bt,de as gt,uV as wt,r7 as xt,dU as we}from"./index-CoJbESCx.js";const _r={up:n("למעלה"),down:n("למטה"),left:n("שמאלה"),right:n("ימינה"),ok:n("אישור"),back:n("חזרה"),home:n("בית"),menu:n("תפריט"),exit:n("יציאה"),info:n("מידע"),guide:n("מדריך"),source:n("מקור"),tools:n("כלים"),settings:n("הגדרות"),chlist:n("רשימת ערוצים"),prech:n("ערוץ קודם"),volup:n("הגבר"),voldown:n("הנמך"),mute:n("השתק"),chup:n("ערוץ הבא"),chdown:n("ערוץ קודם"),n0:"0",n1:"1",n2:"2",n3:"3",n4:"4",n5:"5",n6:"6",n7:"7",n8:"8",n9:"9",red:n("אדום"),green:n("ירוק"),yellow:n("צהוב"),blue:n("כחול"),play:n("נגן"),pause:n("השהה"),stop:n("עצור"),rew:n("אחורה"),ff:n("קדימה")},Mr={up:"up",down:"down",left:"left",right:"right",back:"back",home:"home",menu:"menu",exit:"exit",info:"info",guide:"guide",source:"input",tools:"tools",settings:"settings",chlist:"list",prech:"history",volup:"plus",voldown:"minus",mute:"volOff",chup:"up",chdown:"down",play:"play",pause:"pause",stop:"stop",rew:"rew",ff:"ff"},Tr=["exit","tools","settings","info","guide","source","chlist","prech"],Sr=["guide","source","chlist"],Er=["n1","n2","n3","n4","n5","n6","n7","n8","n9","prech","n0","info"],Dr=["red","green","yellow","blue"],qr={recent:n("אחרונים"),nav:n("חזרה · בית · תפריט"),dpad:n("חצים ואישור"),touch:n("משטח מגע"),vol:n("עוצמה"),ch:n("ערוצים"),pbk:n("ניגון"),nums:n("מספרים"),colors:n("מקשי צבע"),text:n("הקלדה"),xtra:n("מקשים נוספים")},te={power:'<path d="M12 3v9"/><path d="M6.4 6.6a8 8 0 1 0 11.2 0"/>',vol:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',volOff:'<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',left:'<path d="m15 6-6 6 6 6"/>',right:'<path d="m9 6 6 6-6 6"/>',chevronDown:'<path d="m6 9 6 6 6-6"/>',back:'<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',guide:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11"/>',tools:'<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',input:'<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',exit:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',hdmi:'<path d="M3 8h18v5l-3 3H6l-3-3z"/><path d="M7 11h10"/>',antenna:'<path d="M8 3l4 5 4-5"/><rect x="3" y="8" width="18" height="12" rx="2"/>',play:'<path d="M7 5v14l11-7z"/>',pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',stop:'<rect x="6" y="6" width="12" height="12" rx="2"/>',rew:'<path d="M11 6 3 12l8 6zM21 6l-8 6 8 6z"/>',ff:'<path d="m13 6 8 6-8 6zM3 6l8 6-8 6z"/>',prev:'<path d="M6 5v14M18 5 9 12l9 7z"/>',next:'<path d="M18 5v14M6 5l9 7-9 7z"/>',keyboard:'<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',apps:'<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',history:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',wifiOff:'<path d="M3 3l18 18"/><path d="M8.5 16a5 5 0 0 1 6.2-.6M5 12.5a10 10 0 0 1 4-2.3M16.5 10.5a10 10 0 0 1 2.5 2M2 9a15 15 0 0 1 5-3M11 5.1A15 15 0 0 1 22 9"/><path d="M12 19.5h.01"/>',touch:'<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M12 10.5V9a1.5 1.5 0 0 1 3 0v2M15 10.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-.5a6 6 0 0 1-4.9-2.6L4 14.5a1.5 1.5 0 0 1 2.4-1.8L9 15"/>',film:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',playRect:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/>',music:'<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',ball:'<circle cx="12" cy="12" r="9"/><path d="m12 7 4 3-1.5 4.5h-5L8 10z"/><path d="M12 3v4M21 10.5 16 10M17.5 19.5l-3-5M6.5 19.5l3-5M3 10.5l5-.5"/>',news:'<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>',smile:'<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',globe:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="m21 16-5-5-9 9"/>',gamepad:'<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M15 11.5h.01M17.5 13.5h.01"/>',sparkle:'<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/>',frame:'<rect x="3" y="3" width="18" height="18" rx="1"/><rect x="6.5" y="6.5" width="11" height="11"/><path d="m6.5 15 3.5-3.5 3 3 2-2 2.5 2.5"/>',moon:'<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',send:'<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="m21 3-11 10"/>',close:'<path d="M6 6l12 12M18 6 6 18"/>',check:'<path d="m5 12 5 5 9-10"/>',edit:'<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16z"/><path d="m13 7 4 4"/>',eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',eyeOff:'<path d="M3 3l18 18"/><path d="M10.6 6.2A9.6 9.6 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3.1 3.9M6.5 7.6A16.8 16.8 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.5-.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',grip:'<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3.2"/>',warning:'<path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/>',tv:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',speaker:'<rect x="6" y="3" width="12" height="18" rx="2.5"/><circle cx="12" cy="14" r="3"/><path d="M12 7h.01"/>',remote:'<rect x="7.5" y="2.5" width="9" height="19" rx="4.5"/><circle cx="12" cy="7.5" r="1.7"/><path d="M10.3 12.5h3.4M10.3 15.5h3.4M10.3 18.5h3.4"/>',app:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 12h6"/>'};function kt(e){return te[e??"app"]??te.app}function O(e){if(e==null||!Number.isFinite(e))return{a1:"#3f4a5c",a2:"#6b7788",rgb:"107 119 136"};const t=(Math.round(e)%360+360)%360;return{a1:`hsl(${t} 58% 26%)`,a2:`hsl(${t} 70% 56%)`,rgb:yt(t,70,56)}}function yt(e,t,r){const i=t/100,s=r/100,a=c=>(c+e/30)%12,l=i*Math.min(s,1-s),d=c=>s-l*Math.max(-1,Math.min(a(c)-3,Math.min(9-a(c),1)));return[d(0),d(8),d(4)].map(c=>Math.round(c*255)).join(" ")}function $t(e){switch(e.live.power){case"on":return"on";case"art":return"art";case"off":case"standby":return"off";default:return"unavailable"}}const Or=e=>!e.can.control&&!e.can.power;function Pr(e){if(!e.can.power)return{action:"none",enabled:!1,reason:"forbidden"};const t=$t(e);if(t==="unavailable")return{action:"none",enabled:!1,reason:"unavailable"};if(t==="on"||t==="art")return{action:"off",enabled:W(e,{command:"power_off"}),reason:null};const r=W(e,{command:"power_on"});return{action:"on",enabled:r,reason:r?null:e.caps.power_on_reason??"no_remote_wake"}}const Ar=e=>e.live.power==="art"&&e.can.power&&e.caps.power_on;function Lr(e){const t=["pad"];return e.caps.sources&&e.sources.length&&e.can.power&&t.push("sources"),e.caps.apps&&e.apps.length&&e.can.power&&t.push("apps"),t}function Cr(e){return!e.can.power||!(e.caps.sources||e.caps.apps)?[]:e.recent.slice(0,3)}function Rr(e){if(!e.can.control)return{main:e.can.power&&ce(e).main.includes("recent")?["recent"]:[],more:[]};const t=ce(e),r=s=>!(s==="recent"&&!e.can.power),i=t.main.includes("touch")&&!t.main.includes("dpad")&&!t.more.includes("dpad");return{main:t.main.filter(r).filter(s=>s!=="touch"||i),more:t.more.filter(r)}}function Br(e){const t=i=>e.remote.sections.some(s=>s.id===i&&s.on),r=["up","down","left","right","ok"].some(i=>e.caps.keys.includes(i));return{dpad:t("dpad")&&r,touch:t("touch")&&e.caps.touchpad&&r}}function Kr(e,t){return e.audio_link?t??e.live.volume.target??e.audio_link.default:"screen"}function Nr(e,t){return t.kind==="app"?e.now.app_id===t.id:e.now.source_id===t.id}const zt=["up","down","left","right","volup","voldown"],_t=e=>zt.includes(e),Mt={ArrowUp:"up",ArrowDown:"down",ArrowLeft:"left",ArrowRight:"right",Enter:"ok",Backspace:"back","+":"volup","=":"volup","-":"voldown",_:"voldown",m:"mute",M:"mute",PageUp:"chup",PageDown:"chdown"};function xe(e){if(e.ctrlKey||e.altKey||e.metaKey)return null;const t=(e.target?.tagName??"").toUpperCase();return t==="INPUT"||t==="TEXTAREA"||t==="SELECT"||e.target?.isContentEditable||e.key==="Escape"||(e.key==="Enter"||e.key===" ")&&t==="BUTTON"?null:Mt[e.key]??null}const qe={setTimeout:(e,t)=>globalThis.setTimeout(e,t),clearTimeout:e=>globalThis.clearTimeout(e),setInterval:(e,t)=>globalThis.setInterval(e,t),clearInterval:e=>globalThis.clearInterval(e),now:()=>Date.now()};class Tt{constructor(t,r=qe,i=Le,s=Ce,a=400){this.fire=t,this.timers=r,this.intervalMs=i,this.maxMs=s,this.holdDelayMs=a,this.timer=null,this.startedAt=0,this.running=!1}get active(){return this.running}start(){this.stop(),this.running=!0,this.startedAt=this.timers.now(),this.fire(),this.timer=this.timers.setTimeout(()=>{this.running&&(this.timer=this.timers.setInterval(()=>{if(this.running){if(this.timers.now()-this.startedAt>=this.maxMs){this.stop();return}this.fire()}},this.intervalMs))},this.holdDelayMs)}stop(){this.running=!1,this.timer!==null&&(this.timers.clearTimeout(this.timer),this.timers.clearInterval(this.timer),this.timer=null)}}const St=["key","volume_step","mute","transport"],Et=e=>St.includes(e.command);class jr{constructor(){this.keys=new Me,this.powerBusy=!1,this.lastText=0,this.lastPower=0}check(t,r,i=Date.now()){return W(t,r)?r.command==="power_on"||r.command==="power_off"?this.powerBusy||i-this.lastPower<2e3?"busy":(this.powerBusy=!0,this.lastPower=i,"send"):r.command==="text"?i-this.lastText<1e3?"cooldown":(this.lastText=i,"send"):Et(r)&&!this.keys.take(i)?"dropped":"send":"not_offered"}powerDone(){this.powerBusy=!1}}function Ir(e,t){switch(e.command){case"power_on":return r=>r.power==="on";case"power_off":return r=>r.power==="off"||r.power==="standby"||r.power==="art";case"volume_set":return r=>r.volume.level!==null&&Math.abs(r.volume.level-Math.round(e.level))<=1;case"mute":return r=>r.volume.muted===e.muted;case"source":return r=>r.now.source_id===e.source_id;case"app":return r=>r.now.app_id===e.app_id;case"sound_output":return r=>r.sound_output===e.output;case"transport":if(e.action==="play")return r=>r.play==="playing";if(e.action==="pause")return r=>r.play==="paused";if(e.action==="stop")return r=>r.play==="idle"||r.play===null||r.power!=="on";if(e.action==="play_pause"){const r=t.play;return i=>i.play!==r}return null;default:return null}}function N(e){if(e==null||!Number.isFinite(e))return"";const t=Math.max(0,Math.round(e)),r=Math.floor(t/3600),i=Math.floor(t%3600/60),s=t%60;return`${r?`${r}:${String(i).padStart(2,"0")}`:i}:${String(s).padStart(2,"0")}`}function Ur(e,t){const r=e.now;if(r.position_s===null||r.position_s===void 0)return null;let i=r.position_s;if(e.play==="playing"&&r.position_at){const s=Date.parse(r.position_at);Number.isFinite(s)&&(i+=Math.max(0,(t-s)/1e3))}return r.duration_s!==null&&r.duration_s!==void 0&&r.duration_s>0&&(i=Math.min(i,r.duration_s)),i}function Gr(e){const t=e.power==="unknown"?n("מצב לא ידוע"):n("המסך לא זמין");if(!e.since)return{title:t,since:""};const r=new Date(e.since);if(Number.isNaN(r.getTime()))return{title:t,since:""};const i=Te(r);return{title:t,since:i}}function Vr(e){return e.replace(/[\u0000-\u001f\u007f]/g,"").slice(0,Ae)}function Yr(e,t){return/^[0-9]$/.test(t)?(e+t).slice(-3):e}const Fr=e=>/^n[0-9]$/.test(e)?e.slice(1):"";function Hr(e,t,r){return{...e,sections:e.sections.map(i=>i.id===t?{...i,on:r}:i)}}function Xr(e,t,r){const i=e.sections.findIndex(l=>l.id===t);if(i<0)return e;const s=[...e.sections],[a]=s.splice(i,1);return s.splice(Math.max(0,Math.min(s.length,r)),0,a),{...e,sections:s}}function Qr(e,t,r){const i=e.more.filter(s=>s!==t);return{...e,more:r?[...i,t]:i}}class Dt{constructor(t,r=qe){this.fire=t,this.timers=r,this.holds=new Map,this.held=null}holder(t){let r=this.holds.get(t);return r||(r=new Tt(()=>this.fire(t),this.timers),this.holds.set(t,r)),r}down(t,r){t.pointerType==="mouse"&&t.button!==void 0&&t.button!==0||(t.preventDefault?.(),this.stopAll(),this.begin(r))}begin(t){this.held=t,_t(t)?this.holder(t).start():this.fire(t)}up(){this.stopAll()}click(t,r){(t.detail??0)===0&&this.held===null&&this.fire(r)}keyDown(t,r){t.key!=="Enter"&&t.key!==" "||(t.preventDefault?.(),!t.repeat&&(this.stopAll(),this.begin(r)))}keyUp(t,r){t.key!=="Enter"&&t.key!==" "||(t.preventDefault?.(),this.held===r&&this.stopAll())}global(t,r,i=!1){if(r){if(i)return;this.stopAll(),this.begin(t)}else this.held===t&&this.stopAll()}stopAll(){for(const t of this.holds.values())t.stop();this.held=null}get holding(){return this.held}}const Oe={shuffle:'<path d="M16 3h5v5"/><path d="M4 20 21 3"/><path d="M21 16v5h-5"/><path d="m15 15 6 6"/><path d="m4 4 5 5"/>',repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',receiver:'<rect x="2.5" y="8" width="19" height="9" rx="2"/><circle cx="7.5" cy="12.5" r="1.8"/><circle cx="16.5" cy="12.5" r="1.8"/><path d="M5 20h.01M19 20h.01"/>',bt:'<path d="m7 7 10 10-5 5V2l5 5L7 17"/>',radio:'<rect x="3" y="8" width="18" height="12" rx="2"/><path d="m8 8 8-5"/><circle cx="9" cy="14" r="2.5"/><path d="M15 12h3M15 16h3"/>',transfer:'<path d="M5 8h14"/><path d="m15 4 4 4-4 4"/><path d="M19 16H5"/><path d="m9 12-4 4 4 4"/>',group:'<rect x="3" y="5" width="8" height="14" rx="2"/><rect x="13" y="5" width="8" height="14" rx="2"/><circle cx="7" cy="14.5" r="1.8"/><circle cx="17" cy="14.5" r="1.8"/>',unlink:'<path d="m9 15 6-6"/><path d="M11 6.5 12.4 5a4 4 0 0 1 5.7 5.7L16.7 12"/><path d="m13 17.5-1.4 1.5a4 4 0 0 1-5.7-5.7L7.3 12"/><path d="M3 3l18 18"/>',trash:'<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',playNext:'<path d="M4 6h10M4 12h10M4 18h6"/><path d="m16 15 5 3-5 3z"/>',addQueue:'<path d="M4 6h12M4 12h12M4 18h7"/><path d="M18 14v8M14 18h8"/>'},qt={...te,...Oe},h=e=>Se(qt[e]??""),j=(e,t="ic gl")=>Se(e==="radio"?Oe.radio:kt(e??"music"),t),F=C`
  /* COLOR-LITERAL-A-2480: the volume knob's shadow, written once (the same literal) */
  :host {
    --mp-knob-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
  }
  svg.ic {
    inline-size: 1em;
    block-size: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex: none;
    vertical-align: middle;
  }
  .n {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button[disabled] {
    cursor: not-allowed;
  }
  :focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .rb {
    position: relative;
    flex: none;
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform var(--sw-t-press) var(--mr-ease), box-shadow var(--mr-motion), color var(--mr-motion);
  }
  .rb .ic {
    font-size: var(--sw-fs-xl);
  }
  .rb:active,
  .rb.hit {
    transform: scale(0.92);
  }
  .rb.muted {
    background: var(--mr-danger-soft);
    color: var(--mr-danger);
    box-shadow: inset 0 0 0 1px var(--mr-danger-soft);
  }
  .rb[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }
  .pendring {
    position: absolute;
    inset: -5px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-block-start-color: var(--mr-accent);
    animation: mr-spin calc(var(--sw-t-med) * 4) linear infinite;
    pointer-events: none;
  }
  @keyframes mr-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pendring {
      animation: none;
      border-color: var(--mr-accent);
      opacity: 0.6;
    }
  }
  /* ---- sliders: fill from the inline-start (the right in RTL), the ceiling marker only where one is set ---- */
  .vrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 2px;
    min-inline-size: 0;
    direction: rtl;
  }
  .vrow .vv {
    min-inline-size: 30px;
    text-align: end;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .vrow .lbl {
    flex: none;
    min-inline-size: 52px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .rngwrap {
    position: relative;
    flex: 1;
    min-inline-size: 0;
    display: flex;
    align-items: center;
  }
  .rng {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-inline-size: 0;
    block-size: 44px;
    background: transparent;
    margin: 0;
    direction: rtl;
  }
  .rng::-webkit-slider-runnable-track {
    block-size: 8px;
    border-radius: var(--sw-r-pill);
    background: linear-gradient(to left, var(--mr-accent) var(--v, 50%), var(--mr-surface-3) var(--v, 50%));
  }
  .rng::-moz-range-track {
    block-size: 8px;
    border-radius: var(--sw-r-pill);
    background: var(--mr-surface-3);
  }
  .rng::-moz-range-progress {
    block-size: 8px;
    border-radius: var(--sw-r-pill);
    background: var(--mr-accent);
  }
  .rng::-webkit-slider-thumb {
    -webkit-appearance: none;
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    margin-block-start: -9px;
    box-shadow: var(--mp-knob-shadow), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  }
  .rng::-moz-range-thumb {
    inline-size: 26px;
    block-size: 26px;
    border: 0;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    box-shadow: var(--mp-knob-shadow);
  }
  .rng.sm::-webkit-slider-runnable-track {
    block-size: 6px;
  }
  .rng.sm::-webkit-slider-thumb {
    inline-size: 20px;
    block-size: 20px;
    margin-block-start: -7px;
  }
  .rng.sm::-moz-range-thumb {
    inline-size: 20px;
    block-size: 20px;
  }
  .rng[disabled] {
    opacity: 0.4;
  }
  .rng.seek::-webkit-slider-runnable-track {
    block-size: 5px;
    background: linear-gradient(to left, var(--mr-text) var(--v, 0%), var(--mr-surface-3) var(--v, 0%));
  }
  .rng.seek::-moz-range-progress {
    background: var(--mr-text);
    block-size: 5px;
  }
  .rng.seek::-moz-range-track {
    block-size: 5px;
  }
  .rng.seek::-webkit-slider-thumb {
    inline-size: 16px;
    block-size: 16px;
    margin-block-start: -5.5px;
    background: var(--mr-text);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  }
  .rng.seek::-moz-range-thumb {
    inline-size: 16px;
    block-size: 16px;
    background: var(--mr-text);
  }
  /* the ceiling in force (volume_max / the night window) - drawn ONLY where an administrator set one */
  .rngwrap .cap {
    position: absolute;
    inset-block: 14px;
    inset-inline-start: calc(13px + (100% - 26px) * var(--capn) / 100 - 1px);
    inline-size: 2px;
    border-radius: var(--sw-r-pill);
    background: var(--mr-warning);
    pointer-events: none;
    opacity: 0.9;
  }
  .rngwrap.sm .cap {
    inset-block: 15px;
    inset-inline-start: calc(10px + (100% - 20px) * var(--capn) / 100 - 1px);
  }
  /* ---- per room ---- */
  .members {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mrow {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(88px, 150px) 30px auto;
    align-items: center;
    gap: 10px;
    min-block-size: 52px;
    padding: 4px 12px;
    border-radius: var(--sw-r-lg);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .mrow .nm {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .mrow .nm b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mrow .nm small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mrow .nm small.bad {
    color: var(--mr-danger);
    font-weight: 600;
  }
  .mrow .nm small.ok {
    color: var(--mr-success);
    font-weight: 600;
  }
  :host([data-devices-scheme='light']) .mrow .nm small.ok,
  :host([data-devices-scheme='light']) .ckrow .nm small.ok {
    color: var(--sw-success-text);
  }
  .mrow .vv {
    font-size: var(--sw-fs-base);
    font-weight: 700;
    text-align: end;
    font-variant-numeric: tabular-nums;
  }
  .mrow.lead {
    border-color: color-mix(in srgb, var(--mr-accent) 35%, transparent);
  }
  .mrow.dim {
    opacity: 0.55;
  }
  @media (max-width: 767px) {
    .mrow {
      grid-template-columns: minmax(0, 1fr) minmax(70px, 110px) 28px auto;
      padding-inline: 10px;
      gap: 8px;
    }
  }
`,oe=C`
  /* ---- header action (power) and the sticky notice ---- */
  .hpw {
    position: relative;
    inline-size: 44px;
    block-size: 44px;
    border-radius: 50%;
    border: 0;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-text-2);
    box-shadow: var(--mr-key-shadow);
    flex: none;
    transition: transform var(--sw-t-press) var(--mr-ease), background var(--mr-motion);
  }
  .hpw.on {
    background: var(--mr-accent);
    color: var(--sw-text-inverse);
    box-shadow: 0 6px 18px var(--mr-accent-glow), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  }
  .hpw .ic {
    font-size: var(--sw-fs-2xl);
    stroke-width: 2;
  }
  .hpw:active {
    transform: scale(0.92);
  }
  .hpw[disabled] {
    opacity: 0.38;
    pointer-events: none;
    box-shadow: none;
  }
  .notice {
    position: sticky;
    inset-block-start: 0;
    z-index: 4;
    /* opaque under the tint: the body scrolls beneath it */
    background: color-mix(in srgb, var(--mr-danger) 16%, var(--mr-surface-solid));
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
  }
  .notice span {
    flex: 1;
    min-inline-size: 0;
  }
  .notice ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .rbody {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
  }
  .rbody > * {
    flex-shrink: 0;
  }
  .dimmed {
    opacity: 0.3;
    filter: saturate(0.2);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* ---- now playing ---- */
  .npb {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border-radius: var(--sw-r-2xl);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .npb .top {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
  }
  .npb .thumb {
    inline-size: 96px;
    block-size: 96px;
    border-radius: var(--sw-r-2xl);
    box-shadow: 0 12px 26px rgb(var(--art, 20 24 34) / 0.38);
  }
  .npb .thumb .tile {
    border-radius: inherit;
  }
  .npb .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    gap: 2px;
    line-height: 1.25;
  }
  .npb .t small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .npb .t b {
    font-size: var(--sw-fs-xl);
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .npb .t span {
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .npb .t .al {
    color: var(--mr-text-3);
    font-size: var(--sw-fs-sm);
  }
  .pprog {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    min-inline-size: 0;
  }
  .pprog .tm {
    min-inline-size: 34px;
    flex: none;
  }
  .pprog .tm:last-child {
    text-align: end;
  }
  .pprog .bar {
    flex: 1;
    block-size: 5px;
    border-radius: var(--sw-r-pill);
    background: var(--mr-surface-3);
    overflow: hidden;
  }
  .pprog .bar i {
    display: block;
    block-size: 100%;
    inline-size: var(--p, 0%);
    background: var(--mr-text);
    border-radius: var(--sw-r-pill);
  }
  .pprog .live {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--mr-text-2);
  }
  .pprog .live i {
    inline-size: 7px;
    block-size: 7px;
    border-radius: 50%;
    background: var(--sw-danger);
    box-shadow: 0 0 6px var(--sw-danger);
    animation: pn-blink calc(var(--sw-t-med) * 8) ease-in-out infinite;
  }
  @keyframes pn-blink {
    50% { opacity: 0.35; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pprog .live i {
      animation: none;
    }
  }
  .idle {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 18px 0 6px;
    text-align: center;
  }
  .idle .ic {
    font-size: 38px;
    color: var(--mr-text-3);
  }
  .idle b {
    font-size: var(--sw-fs-lg);
    font-weight: 600;
  }

  /* ---- transport: never mirrored ---- */
  .tport {
    direction: ltr;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 4px 0;
  }
  .tport.shake {
    animation: mr-shake var(--mr-motion) var(--mr-ease);
  }
  @keyframes mr-shake {
    20% { transform: translateX(-4px); }
    45% { transform: translateX(4px); }
    70% { transform: translateX(-2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tport.shake {
      animation: pn-flash var(--mr-motion) linear;
    }
    @keyframes pn-flash {
      50% { opacity: 0.6; }
    }
  }
  .tport .kb {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 0;
    background: transparent;
    padding: 0;
    min-inline-size: 0;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .tport .kc {
    position: relative;
    inline-size: 48px;
    block-size: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform var(--sw-t-press) var(--mr-ease), box-shadow var(--mr-motion) var(--mr-ease), color var(--mr-motion);
  }
  .tport .kc .ic {
    font-size: var(--sw-fs-2xl);
  }
  .tport .kb:active .kc,
  .tport .kb.hit .kc {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft), 0 0 22px var(--mr-accent-glow);
  }
  .tport .kb:focus-visible {
    outline: none;
  }
  .tport .kb:focus-visible .kc {
    outline: 2px solid var(--mr-focus);
    outline-offset: 3px;
  }
  .tport .kb.main .kc {
    inline-size: 66px;
    block-size: 66px;
    background: var(--mr-text);
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  .tport .kb.main .kc .ic {
    font-size: var(--sw-fs-3xl);
    stroke-width: 2;
  }
  .tport .kb.main:active .kc {
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 0 0 4px var(--mr-accent-soft);
  }
  .tport .kb.side .kc {
    inline-size: 44px;
    block-size: 44px;
  }
  .tport .kb.side .kc .ic {
    font-size: var(--sw-fs-xl);
  }
  .tport .kb.side[aria-pressed='true'] .kc {
    color: var(--mr-accent-text);
    box-shadow: var(--mr-key-shadow), inset 0 0 0 1.5px var(--mr-accent);
  }
  .tport .kc .one {
    position: absolute;
    inset-inline-start: 50%;
    inset-block-start: 50%;
    transform: translate(-50%, -45%);
    font-size: var(--sw-fs-2xs);
    font-weight: 800;
  }
  .tport .kb[disabled] {
    opacity: 0.38;
    pointer-events: none;
  }
  .tport .kb.pend .kc {
    color: var(--mr-accent);
  }

  /* ---- section heads ---- */
  .psh {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 4px 0;
    min-block-size: 28px;
  }
  .psh h4 {
    margin: 0;
    font-size: var(--sw-fs-base);
    font-weight: 700;
    color: var(--mr-text-2);
    letter-spacing: 0.01em;
  }
  .psh small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-3);
    font-variant-numeric: tabular-nums;
  }
  .psh .lnk {
    all: unset;
    cursor: pointer;
    margin-inline-start: auto;
    min-block-size: 28px;
    padding-inline: 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 600;
    color: var(--mr-accent-text);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    border-radius: var(--sw-r-sm);
  }
  .psh .lnk .ic {
    font-size: var(--sw-fs-md);
    transition: transform var(--mr-motion) var(--mr-ease);
  }
  .psh .lnk[aria-expanded='true'] .ic {
    transform: rotate(180deg);
  }
  .psh .lnk:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .psh .lnk[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ---- up next ---- */
  .uq {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border-radius: var(--sw-r-2xl);
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .uq .row {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 6px 8px;
    border-radius: var(--sw-r-md);
    min-block-size: 44px;
  }
  .uq .row.cur {
    background: var(--mr-accent-soft);
  }
  .uq .ix {
    display: grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-sm);
    background: var(--mr-surface-3);
    color: var(--mr-text-2);
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .uq .row.cur .ix {
    background: var(--mr-accent);
    color: var(--sw-text-inverse);
  }
  .uq .ix .ic {
    font-size: var(--sw-fs-base);
  }
  .uq .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .uq .t b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uq .t small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .uq .dur {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
  }
  .uq .umore {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-block-size: 36px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .uq .unav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-block-size: 48px;
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
    font-weight: 500;
  }
  .uq .unav .ic {
    color: var(--mr-text-3);
    font-size: var(--sw-fs-lg);
  }

  /* ---- library ---- */
  .libg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .libi {
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    padding-inline: 6px 10px;
    min-block-size: 56px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    color: var(--mr-text);
    min-inline-size: 0;
    touch-action: manipulation;
    transition: transform var(--sw-t-press), border-color var(--mr-motion), background var(--mr-motion);
  }
  .libi:hover {
    border-color: var(--mr-border-strong);
    background: var(--mr-surface);
  }
  .libi:active {
    transform: scale(0.97);
  }
  .libi .gi {
    inline-size: 42px;
    block-size: 42px;
    border-radius: var(--sw-r-md);
  }
  .libi .gi .ic {
    font-size: var(--sw-fs-2xl);
  }
  .libi .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    line-height: 1.25;
  }
  .libi .t b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .libi .t small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .libi[aria-current='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
  }
  .libi[aria-current='true'] .t b {
    color: var(--mr-accent-text);
  }
  .libi.pend .gi::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 2;
    background: rgba(0, 0, 0, 0.3);
  }
  .libi.pend .gi::after {
    content: '';
    position: absolute;
    inset: 0;
    margin: auto;
    inline-size: 18px;
    block-size: 18px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.4);
    border-block-start-color: var(--sw-on-video);
    animation: mr-spin calc(var(--sw-t-med) * 4) linear infinite;
    z-index: 3;
    background: none;
    box-shadow: none;
  }
  .libi[disabled] {
    opacity: 0.5;
    pointer-events: none;
  }
  .libempty {
    display: flex;
    align-items: center;
    justify-content: center;
    min-block-size: 56px;
    color: var(--mr-text-2);
    font-size: var(--sw-fs-base);
    font-weight: 500;
  }

  /* ---- the group section ---- */
  .gsec {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ckrow {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 48px;
    padding: 4px 8px;
    padding-inline: 12px 8px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    color: var(--mr-text);
    inline-size: 100%;
    touch-action: manipulation;
    transition: background var(--mr-motion), border-color var(--mr-motion);
  }
  .ckrow:hover {
    background: var(--mr-surface);
  }
  .ckrow .nm {
    flex: 1;
    min-inline-size: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .ckrow .nm b {
    font-size: var(--sw-fs-base);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ckrow .nm small {
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ckrow .nm small.bad {
    color: var(--mr-danger);
    font-weight: 600;
  }
  .ckrow .nm small.ok {
    color: var(--mr-success);
    font-weight: 600;
  }
  .ckrow .ck {
    position: relative;
    flex: none;
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    border: 2px solid var(--mr-border-strong);
    display: grid;
    place-items: center;
    color: var(--sw-text-inverse);
    transition: background var(--mr-motion), border-color var(--mr-motion);
  }
  .ckrow .ck .ic {
    font-size: var(--sw-fs-lg);
    stroke-width: 2.6;
    opacity: 0;
  }
  .ckrow[aria-checked='true'] {
    border-color: color-mix(in srgb, var(--mr-accent) 45%, transparent);
    background: var(--mr-accent-soft);
  }
  .ckrow[aria-checked='true'] .ck {
    background: var(--mr-accent);
    border-color: var(--mr-accent);
  }
  .ckrow[aria-checked='true'] .ck .ic {
    opacity: 1;
  }
  .ckrow.lead {
    border-color: color-mix(in srgb, var(--mr-accent) 45%, transparent);
    cursor: default;
  }
  .ckrow.lead .ck {
    background: var(--mr-text);
    border-color: var(--mr-text);
  }
  .ckrow.lead .ck .ic {
    opacity: 1;
    color: var(--mr-text-inverse);
  }
  .ckrow[disabled] {
    opacity: 0.6;
    pointer-events: none;
  }
  .ckrow.warn {
    border-color: color-mix(in srgb, var(--mr-warning) 50%, transparent);
    background: color-mix(in srgb, var(--mr-warning) 14%, transparent);
  }
  .ckrow.warn > .ic {
    color: var(--mr-warning);
    font-size: var(--sw-fs-2xl);
  }
  .ckrow .gi {
    inline-size: 30px;
    block-size: 30px;
    border-radius: var(--sw-r-sm);
  }
  .ckrow .gi .ic {
    font-size: var(--sw-fs-md);
  }
  .ckrow .pendring {
    inset: -6px;
  }

  /* ---- transfer ---- */
  .ctas {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ctas .btn {
    min-block-size: 46px;
    font-size: var(--sw-fs-md);
  }
  .ctas .btn small {
    font-weight: 500;
    color: var(--mr-text-2);
  }
  .pop {
    display: flex;
    flex-direction: column;
    padding: 4px;
    border-radius: var(--sw-r-lg);
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
  }
  .pop button {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 48px;
    padding: 4px 8px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: transparent;
    text-align: start;
    font-size: var(--sw-fs-base);
    font-weight: 600;
  }
  .pop button:hover {
    background: var(--mr-surface-3);
  }
  .pop .gi {
    inline-size: 32px;
    block-size: 32px;
    border-radius: var(--sw-r-md);
  }
  .pop .gi .ic {
    font-size: var(--sw-fs-lg);
  }
  .pop .cnt {
    margin-inline-start: auto;
    font-size: var(--sw-fs-sm);
    font-weight: 500;
    color: var(--mr-text-2);
    max-inline-size: 45%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* ---- receiver ---- */
  .modes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .modes .srci {
    min-block-size: 44px;
    padding: 8px 12px;
    flex-direction: row;
    align-items: center;
    font-size: var(--sw-fs-base);
    border-radius: var(--sw-r-lg);
    gap: 6px;
  }
  .modes .srci .ck {
    position: static;
    margin-inline-start: auto;
    font-size: var(--sw-fs-lg);
  }
  .srci > span:not(.gi):not(.ck) {
    min-inline-size: 0;
  }
  .zone-pw {
    position: relative;
  }
  .rzone {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .rzone .rng {
    flex: 1;
  }

  /* ---- confirmation (rendered inside the drawer) ---- */
  .cd-line {
    margin: 0;
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
  }
  .cd details {
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
  }
  .cd summary {
    cursor: pointer;
    inline-size: max-content;
    min-block-size: 32px;
    display: inline-flex;
    align-items: center;
  }
  .cd ul {
    margin: 6px 0 0;
    padding-inline-start: 18px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .skl-row {
    display: block;
    block-size: 48px;
    border-radius: var(--sw-r-lg);
  }
`,X=n("הנגן לא אישר את הפקודה"),Ot=520,Pt=250,At=300;function P(e){switch(e.live.power){case"on":case"art":return"on";case"off":case"standby":return"off";default:return"unavailable"}}const ke=e=>!e.can.control&&!e.can.power,E=e=>!e.live.caps_known,Lt={speaker:n("הרמקול"),receiver:n("המגבר"),player:n("הנגן"),group:n("הקבוצה")};function Ct(e){const t=Lt[e.kind]??n("הנגן"),r=e.live.power==="unknown"?n("מצב לא ידוע"):n("{word} לא זמין",{word:t});if(!e.live.since)return{title:r,since:""};const i=new Date(e.live.since);return Number.isNaN(i.getTime())?{title:r,since:""}:{title:r,since:Te(i)}}function Q(e,t){if(!e.can.power)return{action:"none",enabled:!1,reason:"forbidden"};const r=t&&e.zones&&t!==e.zones[0]?.id?e.zones.find(d=>d.id===t)??null:null,i=P(e);if(i==="unavailable")return{action:"none",enabled:!1,reason:"unavailable"};const s=r?r.power==="on":i==="on",a={command:s?"power_off":"power_on",...r&&t?{zone:t}:{}},l=se(e,a);return{action:s?"off":"on",enabled:l,reason:l?null:e.live.caps_known?"not_supported":"unavailable"}}function Rt(e,t){const r=e.live,i=r.play==="paused";return r.group.role==="member"&&t?`${n("מנגן עם {name}",{name:Z(t)})}${i?` · ${n("מושהה")}`:""}`:i?n("מושהה"):r.now.kind==="station"?n("תחנה"):n("מנגן")}const L=e=>(e.play==="playing"||e.play==="paused")&&!!e.now.title;function Bt(e){const t=e.caps,r=[];return t.shuffle&&r.push({id:"shuffle",offered:!0}),t.transport.previous&&r.push({id:"previous",offered:!0}),(t.transport.play||t.transport.pause)&&r.push({id:"play_pause",offered:!0}),t.transport.next&&r.push({id:"next",offered:!0}),t.repeat&&r.push({id:"repeat",offered:!0}),r}const Kt=e=>n("חזרה: {mode}",{mode:e==="all"?n("הכל"):e==="one"?n("שיר אחד"):n("כבוי")});function Pe(e,t=Date.now()){return Ge(e.now,e.play==="playing",t)}function Nt(e){const t=e.live.now;return t.kind==="station"?"live":t.position_s===null||t.duration_s===null||t.duration_s<=0?"none":e.caps.transport.seek&&e.can.control&&e.live.caps_known&&!ne(e.live)?"seek":"bar"}const jt=(e,t)=>e===null||!t||t<=0?0:Math.max(0,Math.min(1,e/t));function It(e,t,r=!1){return e.caps.up_next?e.live.now.kind==="station"?{kind:"none"}:t==="error"||r?{kind:"unavailable"}:t===null?L(e.live)?{kind:"loading"}:{kind:"none"}:t.confirmed?!L(e.live)||!t.current?{kind:"none"}:{kind:"rows",count:t.count,current:{name:t.current.name,artist:t.current.artist,duration_s:t.current.duration_s,index:t.index,playing:e.live.play==="playing"},next:t.next?{name:t.next.name,artist:t.next.artist,duration_s:t.next.duration_s,index:t.index===null?null:t.index+1}:null,more:Ye(t)}:{kind:"unavailable"}:{kind:"none"}}function U(e,t,r=new Date){const i=Re(e,r),s=Math.max(0,Math.min(100,Math.round(t)));return{level:i===null?s:Be(e,s,r),ceiling:i,clamped:i!==null&&s>i}}function Ut(e){return Ke(e.map(Gt))}function Gt(e){return{key:e.key,volume_max:e.volume_max,volume_night:e.volume_night,can:{control:e.can.control},live:{power:e.live.power,volume:{level:e.live.volume.level,muted:e.live.volume.muted}}}}function B(e,t){return Ne(e,t)}function re(e){return e.kind==="group"?[...new Set(e.live.group.member_keys)]:je(e.live.group,e.key)}function ye(e,t){const r=new Map(t.map(s=>[s.key,s])),i=[];for(const s of re(e)){const a=s===e.key?e:r.get(s);a&&i.push({key:a.key,name:a.name,room:a.area_name,floor:a.floor_name,level:a.live.volume.level,muted:a.live.volume.muted,available:a.live.power!=="unavailable"&&a.live.power!=="unknown",leader:a.key===e.key&&e.kind!=="group",dev:a})}return i}function Vt(e,t){return e.kind==="group"?t.length>0:t.length>1}const $e=e=>e.caps.volume_group&&e.can.group&&e.can.control&&e.live.caps_known&&!ne(e.live);function Yt(e,t){const r=Fe(e,t).sort((s,a)=>(s.floor_name??"￿").localeCompare(a.floor_name??"￿","he")||s.name.localeCompare(a.name,"he")),i=s=>[s.area_name??n("ללא חדר"),s.floor_name&&e.floor_name&&s.floor_name!==e.floor_name?s.floor_name:null].filter(Boolean).join(" · ");return[e,...r].map(s=>({key:s.key,name:s.name,sub:i(s),leader:s.key===e.key,member:s.key===e.key||s.live.group.role==="member"&&s.live.group.leader_key===e.key,playing:s.key!==e.key&&ae(s)&&s.live.group.role==="none"&&s.live.now.title?{glyph:s.live.now.glyph,hue:s.live.now.hue}:null}))}const Ft=(e,t)=>He(e)&&t.length>1;function Ht(e,t,r,i){const s=Ie(t,r,e.key),a=new Map(i.map(u=>[u.key,u])),l=[...s.stay,...s.join],d=[e,...l.map(u=>a.get(u)).filter(u=>!!u)],c=new Set(d.map(u=>u.floor_id).filter(u=>u!==null)).size;return{diff:s,after:d,needsConfirmation:s.join.length>0&&Ue(d),floors:c}}const Xt=e=>n("לצרף {n} חדרים לקבוצה אחת?",{n:e}),Qt=e=>e>1?n("הקבוצה תשמיע ב־{n} קומות.",{n:e}):null;function Jt(e,t){const r=e?e.devices:t.after.length,i=e?e.floors:t.floors;return{question:Xt(r),line:Qt(i)}}function Wt(e,t){return e.filter(r=>r.outcome==="not_joined"||r.outcome==="unknown"||r.outcome==="not_allowed").map(r=>`${r.area_name??t.get(r.device_key)??""} ${Zt[r.outcome]}`.trim())}const Zt={not_joined:n("לא הצטרף"),unknown:n("לא ידוע"),not_allowed:n("אין הרשאה")};function er(e,t){return t.filter(r=>r.key!==e.key&&r.kind!=="group"&&ae(r)&&r.live.group.role!=="member"&&r.caps.up_next&&r.live.caps_known)}const tr=(e,t)=>e.caps.transfer&&e.can.control&&e.live.caps_known&&!ne(e.live)&&!ae(e)&&!Ve(e)&&t.length>0,ze=(e,t)=>t&&e.includes(t)?t:e[0]??null,J=e=>e.music_provider==="ma";function ie(e){return(e.zones??[]).map((t,r)=>({...t,main:r===0}))}function I(e,t){const r=ie(e);return r.length?r.find(i=>i.id===t)??r[0]:null}const rr=["transport","volume_step","mute","key"],ir={seek:500,shuffle:500,repeat:500,transfer:5e3,play_item:1e3},sr=6;class _e{constructor(){this.keys=new Me,this.last=new Map,this.plays=[],this.powerBusy=!1,this.lastPower=0}check(t,r,i=Date.now()){if(!se(t,r))return"not_offered";if(r.command==="power_on"||r.command==="power_off")return this.powerBusy||i-this.lastPower<2e3?"busy":(this.powerBusy=!0,this.lastPower=i,"send");if(rr.includes(r.command)&&!this.keys.take(i))return"dropped";const s=ir[r.command];if(s!==void 0){const a=this.last.get(r.command);if(a!==void 0&&i-a<s)return r.command==="transfer"?"cooldown":"dropped";if(r.command==="play_item"){for(;this.plays.length&&i-this.plays[0]>6e4;)this.plays.shift();if(this.plays.length>=sr)return"dropped";this.plays.push(i)}this.last.set(r.command,i)}return"send"}powerDone(){this.powerBusy=!1}}class nr{constructor(t){this.gapMs=t,this.last=null}take(t=Date.now()){return this.last!==null&&t-this.last<this.gapMs?!1:(this.last=t,!0)}}function ar(e,t,r={}){switch(e.command){case"power_on":return i=>i.power==="on";case"power_off":return i=>i.power==="off"||i.power==="standby";case"volume_set":return i=>i.volume.level!==null&&Math.abs(i.volume.level-Math.round(e.level))<=1;case"mute":return i=>i.volume.muted===e.muted;case"source":return i=>i.now.source_id===e.source_id;case"sound_output":return i=>i.sound_output===e.output;case"shuffle":return i=>i.shuffle===e.on;case"repeat":return i=>i.repeat===e.mode;case"seek":return i=>{const s=Pe(i);return s!==null&&Math.abs(s-e.position_s)<=3};case"transport":if(e.action==="play")return i=>i.play==="playing";if(e.action==="pause")return i=>i.play==="paused";if(e.action==="stop")return i=>i.play==="idle"||i.play===null||i.power!=="on";if(e.action==="play_pause"){const i=t.play;return s=>s.play!==i}return null;case"play_item":return e.enqueue==="next"||e.enqueue==="add"?null:i=>i.play==="playing"&&(t.play!=="playing"||i.now.title!==t.now.title||!!r.itemName&&i.now.title===r.itemName);case"transfer":return i=>i.play==="playing";default:return null}}function or(e){switch(e.command){case"power_on":case"power_off":return`power${e.zone?`:${e.zone}`:""}`;case"source":return`src:${e.source_id}`;case"sound_output":return`mode:${e.output}`;case"transport":return e.action==="play_pause"||e.action==="play"||e.action==="pause"?"toggle":e.action;case"play_item":return`item:${e.item_ref}`;case"volume_set":return e.zone?`vol:${e.zone}`:"vol";default:return e.command}}const lr="107 119 136";var cr=Object.defineProperty,pr=Object.getOwnPropertyDescriptor,T=(e,t,r,i)=>{for(var s=i>1?void 0:i?pr(t,r):t,a=e.length-1,l;a>=0;a--)(l=e[a])&&(s=(i?l(t,r,s):l(s))||s);return i&&s&&cr(t,r,s),s};let z=class extends G{constructor(){super(...arguments),this.device=null,this.zone=null,this.group=!1,this.rooms=[],this.byRoom=!1,this.groupOffered=!1,this.outcomes={},this.pend=new Set,this.interactive=!0,this.now=null,this.drafts=new Map,this.timers=new Map}disconnectedCallback(){super.disconnectedCallback();for(const e of this.timers.values())window.clearTimeout(e);this.timers.clear()}willUpdate(e){if(e.has("pend")&&this.drafts.size){const t=new Map(this.drafts);for(const r of this.drafts.keys())!this.timers.has(r)&&!this.pend.has(r==="*"?"gvol":`vol:${r}`)&&t.delete(r);t.size!==this.drafts.size&&(this.drafts=t)}}setDraft(e,t,r){this.drafts=new Map(this.drafts).set(e,t),window.clearTimeout(this.timers.get(e)),this.timers.set(e,window.setTimeout(()=>{this.timers.delete(e),r()},Pt))}emit(e,t){this.dispatchEvent(new CustomEvent(e,{detail:t,bubbles:!0,composed:!0}))}onRoom(e,t,r){const i=Number(r.target.value),s=U(e,i,this.now??new Date).level;r.target.value=String(s),this.setDraft(e.key+(t?`@${t}`:""),s,()=>this.emit("pv-volume",{key:e.key,level:s,...t?{zone:t}:{}}))}onGroup(e){const t=Math.max(0,Math.min(100,Math.round(Number(e.target.value))));this.setDraft("*",t,()=>this.emit("pv-group-volume",{level:t}))}muteButton(e,t){if(!e.caps.mute)return p;const r=e.live.volume.muted===!0;return o`<button type="button" class=${k({rb:!0,muted:r})} data-mute-key=${e.key} aria-pressed=${String(r)} aria-label=${`${r?n("בטל השתקה"):n("השתק")} · ${e.name}`}
      title=${r?n("בטל השתקה"):n("השתק")} ?disabled=${t}>${h(r?"volOff":"vol")}</button>`}slider(e,t,r,i){const s=t?I(e,t):null,a=s&&!s.main?s.volume:e.live.volume.level,d=this.drafts.get(e.key+(t&&s&&!s.main?`@${t}`:""))??a??0,c=U(e,d,this.now??new Date),u=`${n("עוצמה")} · ${s&&!s.main?`${e.name} · ${s.name}`:e.name}`;return o`<span class=${k({rngwrap:!0,sm:r})}>${c.ceiling!==null?o`<span class="cap" style="--capn:${c.ceiling}" title=${n("תקרה {n}",{n:c.ceiling})} data-pv-cap=${c.ceiling}></span>`:p}
      <input class=${k({rng:!0,sm:r})} type="range" min="0" max="100" step="1" .value=${String(c.level)} style="--v:${c.level}%" aria-label=${u}
        data-pv-slider=${e.key} ?disabled=${i||!e.caps.volume_set} @input=${g=>this.onRoom(e,t,g)} /></span>`}single(e){const t=!this.interactive||!e.live.caps_known||(this.zone?I(e,this.zone)?.power!=="on":e.live.power!=="on"),r=this.zone?I(e,this.zone):null,i=r&&!r.main?r.volume:e.live.volume.level,s=this.drafts.get(e.key+(r&&!r.main?`@${this.zone}`:""))??i;return e.caps.volume_set?o`<div class="vrow" data-pv="single">${r&&!r.main?p:this.muteButton(e,t)}${this.slider(e,this.zone,!1,t)}
        <span class="vv n" data-pv-value>${s!==null?U(e,s,this.now??new Date).level:"–"}</span></div>`:e.caps.volume_step?o`<div class="vrow" data-pv="step">${this.muteButton(e,t)}<span class="spacer"></span><span class="vrock" role="group" aria-label=${`${n("עוצמה")} · ${e.name}`}>
        <button type="button" data-key="voldown" aria-label=${n("הנמך")} ?disabled=${t}>${h("minus")}</button><span class="vv n" data-pv-value>${i??"–"}</span>
        <button type="button" data-key="volup" aria-label=${n("הגבר")} ?disabled=${t}>${h("plus")}</button></span></div>`:o`${e.caps.mute?o`<div class="vrow" data-pv="mute">${this.muteButton(e,t)}</div>`:p}`}room(e,t){const r=this.outcomes[e.key]?.outcome,s=r&&r!=="set"&&r!=="joined"&&r!=="left"?o`<small class=${r==="not_joined"||r==="unknown"||r==="not_allowed"?"bad":"ok"} data-pv-outcome=${r}>${Xe[r]}</small>`:o`<small>${[e.room?v(e.room):n("ללא חדר"),e.leader?n("מוביל"):null].filter(Boolean).join(" · ")}</small>`,a=t||!e.available||e.dev.live.power!=="on",l=e.dev.caps.volume_set,d=this.drafts.get(e.key)??e.level;return o`<div class=${k({mrow:!0,lead:e.leader,dim:!e.available})} data-pv-room=${e.key}>
      <div class="nm"><b>${v(e.name)}</b>${s}</div>
      ${l?this.slider(e.dev,null,!0,a):o`<span></span>`}
      <span class="vv n" data-pv-value>${l&&d!==null?U(e.dev,d,this.now??new Date).level:"–"}</span>
      ${e.dev.caps.mute?this.muteButton(e.dev,a):o`<span></span>`}</div>`}grouped(e){const t=Ut(this.rooms.map(l=>l.dev)),r=this.drafts.get("*"),i=r??t??0,s=!this.interactive||!this.groupOffered||!e.live.caps_known,a=this.pend.has("gvol");return o`<div class="vrow" data-pv="group"><span class="lbl">${n("קבוצה")}</span>
      <span class="rngwrap"><input class="rng" type="range" min="0" max="100" step="1" .value=${String(i)} style="--v:${i}%" aria-label=${n("עוצמת הקבוצה")} data-pv-group ?disabled=${s} aria-busy=${String(a)} @input=${this.onGroup} /></span>
      <span class="vv n" data-pv-value>${r??t??"–"}</span></div>
      <div class="psh"><h4>${n("לפי חדר")}</h4><small>${this.rooms.length}</small>
        ${this.byRoom?o`<button type="button" class="lnk" data-pv-equalize ?disabled=${s||t===null} @click=${()=>this.emit("pv-equalize",{})}>${n("אותה עוצמה")}</button>`:p}
        <button type="button" class="lnk" data-pv-rooms aria-expanded=${String(this.byRoom)} @click=${()=>this.emit("pv-rooms",{open:!this.byRoom})}>${this.byRoom?n("הסתר"):n("הצג")}${h("chevronDown")}</button></div>
      ${this.byRoom?o`<div class="members" data-pv-members>${V(this.rooms,l=>l.key,l=>this.room(l,!this.interactive||!e.live.caps_known))}</div>`:p}`}render(){const e=this.device;if(this.group){const t=this.device;return t&&this.rooms.length?this.grouped(t):p}return e?this.single(e):p}};z.styles=[F,C`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-inline-size: 0;
        color: var(--mr-text);
        font-family: var(--mr-font);
      }
      .vrock {
        display: inline-flex;
        align-items: center;
        block-size: 48px;
        padding: 2px;
        border-radius: var(--sw-r-pill);
        background: var(--mr-surface-3);
        flex: none;
        direction: ltr;
      }
      .vrock button {
        inline-size: 44px;
        block-size: 44px;
        border-radius: 50%;
        border: 0;
        background: transparent;
        display: grid;
        place-items: center;
        color: var(--mr-text);
        touch-action: manipulation;
        user-select: none;
        -webkit-user-select: none;
      }
      .vrock button:hover {
        background: var(--mr-seg-thumb);
        box-shadow: var(--mr-shadow-control);
      }
      .vrock button:active {
        transform: scale(0.9);
      }
      .vrock button[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .vrock .vv {
        min-inline-size: 44px;
        text-align: center;
        font-weight: 700;
        font-size: var(--sw-fs-lg);
      }
      .spacer {
        flex: 1;
      }
      .psh {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 2px 4px 0;
        min-block-size: 28px;
      }
      .psh h4 {
        margin: 0;
        font-size: var(--sw-fs-base);
        font-weight: 700;
        color: var(--mr-text-2);
        letter-spacing: 0.01em;
      }
      .psh small {
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-3);
        font-variant-numeric: tabular-nums;
      }
      .psh .lnk {
        all: unset;
        cursor: pointer;
        margin-inline-start: auto;
        min-block-size: 28px;
        padding-inline: 6px;
        font-size: var(--sw-fs-sm);
        font-weight: 600;
        color: var(--mr-accent-text);
        display: inline-flex;
        align-items: center;
        gap: 4px;
        border-radius: var(--sw-r-sm);
      }
      .psh .lnk + .lnk {
        margin-inline-start: 0;
      }
      .psh .lnk .ic {
        font-size: var(--sw-fs-md);
        transition: transform var(--mr-motion) var(--mr-ease);
      }
      .psh .lnk[aria-expanded='true'] .ic {
        transform: rotate(180deg);
      }
      .psh .lnk:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .psh .lnk[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
    `];T([x({attribute:!1})],z.prototype,"device",2);T([x({attribute:!1})],z.prototype,"zone",2);T([x({type:Boolean})],z.prototype,"group",2);T([x({attribute:!1})],z.prototype,"rooms",2);T([x({type:Boolean})],z.prototype,"byRoom",2);T([x({type:Boolean})],z.prototype,"groupOffered",2);T([x({attribute:!1})],z.prototype,"outcomes",2);T([x({attribute:!1})],z.prototype,"pend",2);T([x({type:Boolean})],z.prototype,"interactive",2);T([x({attribute:!1})],z.prototype,"now",2);T([m()],z.prototype,"drafts",2);z=T([Y("media-player-volume")],z);const dr=C`
  :host {
    --mr-text: #1c1c1e;
    --mr-text-2: #4c4c50;
    --mr-text-3: #6e6e73;
    --mr-text-inverse: #ffffff;
    --mr-surface: rgba(255, 255, 255, 0.64);
    --mr-surface-2: rgba(255, 255, 255, 0.5);
    --mr-surface-3: rgba(120, 120, 128, 0.14);
    --mr-surface-solid: #f7f9fc;
    --mr-border: rgba(60, 60, 67, 0.12);
    --mr-border-strong: rgba(60, 60, 67, 0.22);
    --mr-accent: #007aff;
    --mr-accent-hover: #0066d6;
    --mr-accent-soft: rgba(0, 122, 255, 0.13);
    --mr-accent-text: #0062cc;
    --mr-accent-glow: rgba(0, 122, 255, 0.3);
    --mr-focus: #007aff;
    --mr-success: #34c759;
    --mr-danger: #d70015;
    --mr-danger-soft: rgba(255, 59, 48, 0.13);
    --mr-warning: #b25000;
    --mr-seg-thumb: #ffffff;
    --mr-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.18);
    --mr-shadow-3: 0 24px 64px rgba(15, 23, 42, 0.26);
    --mr-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0) 46%);
    --mr-key-size: 52px;
    --mr-key-bg: linear-gradient(180deg, #ffffff, #eef1f6);
    --mr-key-fg: #1c1c1e;
    --mr-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95), 0 1px 2px rgba(31, 45, 80, 0.12), 0 4px 12px rgba(31, 45, 80, 0.08), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mr-remote-body: linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0.4));
    --mr-dpad-size: 216px;
    --mr-ok-size: 96px;
    --mr-rocker-w: 62px;
    --mr-dpad-ring: radial-gradient(circle at 50% 28%, #ffffff 0%, #f2f5f9 55%, #e3e8f0 100%);
    --mr-dpad-shadow: 0 16px 36px rgba(31, 45, 80, 0.16), inset 0 1px 0 #fff, inset 0 -8px 18px rgba(31, 45, 80, 0.06), 0 0 0 1px rgba(60, 60, 67, 0.1);
    --mr-dpad-groove: inset 0 2px 6px rgba(31, 45, 80, 0.16), inset 0 -1px 0 rgba(255, 255, 255, 0.9);
    --mr-ok-bg: linear-gradient(180deg, #ffffff, #edf1f6);
    --mr-screen-off: linear-gradient(155deg, rgba(120, 120, 128, 0.2), rgba(120, 120, 128, 0.08));
    --mr-art-veil: rgba(255, 255, 255, 0.38);
    --mr-glow-alpha: 0.36;
    --mr-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --mr-motion: 240ms;
    --mr-font: var(--sw-font); /* SYS-AUDIT-QUICKFIX-2437: the product face in both schemes (was the OS stack in light) */
    color-scheme: light;
  }
  :host([data-devices-scheme='dark']) {
    --mr-text: #f5f5f7;
    --mr-text-2: rgba(235, 235, 245, 0.72);
    --mr-text-3: rgba(235, 235, 245, 0.56);
    --mr-text-inverse: #1c1c1e;
    --mr-surface: rgba(28, 28, 30, 0.72);
    --mr-surface-2: rgba(44, 44, 46, 0.62);
    --mr-surface-3: rgba(235, 235, 245, 0.14);
    --mr-surface-solid: #161619;
    --mr-border: rgba(255, 255, 255, 0.13);
    --mr-border-strong: rgba(255, 255, 255, 0.24);
    --mr-accent: #0a84ff;
    --mr-accent-hover: #409cff;
    --mr-accent-soft: rgba(10, 132, 255, 0.26);
    --mr-accent-text: #64d2ff;
    --mr-accent-glow: rgba(10, 132, 255, 0.45);
    --mr-focus: #64d2ff;
    --mr-success: #30d158;
    --mr-danger: #ff453a;
    --mr-danger-soft: rgba(255, 69, 58, 0.2);
    --mr-warning: #ff9f0a;
    --mr-seg-thumb: rgba(118, 118, 128, 0.5);
    --mr-shadow-control: 0 1px 4px rgba(0, 0, 0, 0.35);
    --mr-shadow-3: 0 26px 70px rgba(0, 0, 0, 0.6);
    --mr-sheen: linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015) 50%);
    --mr-key-bg: linear-gradient(180deg, rgba(78, 78, 84, 0.95), rgba(50, 50, 54, 0.95));
    --mr-key-fg: #f5f5f7;
    --mr-key-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 10px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.06);
    --mr-remote-body: linear-gradient(180deg, rgba(58, 58, 62, 0.55), rgba(30, 30, 33, 0.35));
    --mr-dpad-ring: radial-gradient(circle at 50% 28%, #3b3b40 0%, #2a2a2e 58%, #1d1d20 100%);
    --mr-dpad-shadow: 0 18px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.1), inset 0 -8px 18px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.07);
    --mr-dpad-groove: inset 0 2px 8px rgba(0, 0, 0, 0.6), inset 0 -1px 0 rgba(255, 255, 255, 0.07);
    --mr-ok-bg: linear-gradient(180deg, #4b4b51, #323236);
    --mr-screen-off: linear-gradient(155deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025));
    --mr-art-veil: rgba(18, 18, 20, 0.34);
    --mr-glow-alpha: 0.5;
    color-scheme: dark;
  }
  /* the Bubble skin (phase C): the remote and the player panel read the product's tokens - the sheet, the keys, the rows follow
     the skin and its scheme (data-theme on <html>), not devices.scheme; declared after the dark block so it wins */
  :host([data-skin='bubble']) {
    --mr-text: var(--sw-text);
    --mr-text-2: var(--sw-text-2);
    --mr-text-3: var(--sw-text-3);
    --mr-text-inverse: var(--sw-text-inverse);
    --mr-surface: var(--sw-layer);
    --mr-surface-2: var(--sw-layer-2);
    --mr-surface-3: var(--sw-surface-2);
    --mr-surface-solid: var(--sw-surface-solid);
    --mr-border: transparent;
    --mr-border-strong: var(--sw-border-strong);
    --mr-accent: var(--sw-accent);
    --mr-accent-hover: var(--sw-accent-hover);
    --mr-accent-soft: var(--sw-accent-soft);
    --mr-accent-text: var(--sw-accent-text);
    --mr-accent-glow: transparent;
    --mr-focus: var(--sw-focus);
    --mr-success: var(--sw-success);
    --mr-danger: var(--sw-danger);
    --mr-danger-soft: var(--sw-danger-soft);
    --mr-warning: var(--sw-warning);
    --mr-seg-thumb: var(--sw-surface-solid);
    --mr-shadow-control: none;
    --mr-shadow-3: var(--sw-shadow-3);
    --mr-sheen: none;
    --mr-key-bg: var(--sw-surface-2);
    --mr-key-fg: var(--sw-text);
    --mr-key-shadow: none;
    --mr-remote-body: var(--sw-layer);
    --mr-dpad-ring: var(--sw-surface-2);
    --mr-dpad-shadow: none;
    --mr-dpad-groove: none;
    --mr-ok-bg: var(--sw-surface-solid);
    --mr-screen-off: var(--sw-surface-2);
    --mr-art-veil: rgba(var(--sw-sheet-rgb), 0.3);
    --mr-glow-alpha: 0.3;
    --mr-ease: var(--sw-ease);
    --mr-motion: var(--sw-t-med);
    --mr-font: var(--sw-font);
  }
  @media (max-width: 767px) {
    :host {
      --mr-dpad-size: 196px;
      --mr-ok-size: 88px;
      --mr-rocker-w: 56px;
      --mr-key-size: 50px;
    }
  }
  /* no backdrop blur is used by the remote itself (the sheet is a solid panel with a tinted glow); transparency settings
     therefore need nothing here. Reduced motion: only the state changes stay, the movement goes. */
  @media (prefers-reduced-motion: reduce) {
    :host {
      --mr-motion: 0.01ms;
    }
  }
`,le=C`
  :host {
    display: contents;
    /* COLOR-LITERAL-A-2480: fixed values this sheet repeated, written once (the same literals): the ink on the accent fill (white in
       both schemes, unlike --mr-text-inverse) and the volume knob's shadow */
    --mr-on-accent-ink: #fff;
    --mr-knob-shadow: 0 2px 6px rgba(0, 0, 0, 0.28);
    font-family: var(--mr-font);
    color: var(--mr-text);
    /* the drawer (sw-drawer, modal) reads these: its panel surface, title, hairlines and buttons follow the remote's scheme */
    --dv-surface-solid: radial-gradient(130% 34% at 50% 0%, rgb(var(--mr-art, 107 119 136) / var(--mr-glow-alpha)), transparent 72%), var(--mr-surface-solid);
    --sw-text: var(--mr-text);
    --sw-text-2: var(--mr-text-2);
    --sw-text-3: var(--mr-text-3);
    --sw-border: var(--mr-border);
    --sw-border-strong: var(--mr-border-strong);
    --sw-surface: var(--mr-surface-solid);
    --sw-menu-surface: var(--mr-surface-solid);
    --sw-menu-border: var(--mr-border-strong);
    --sw-surface-2: var(--mr-surface-2);
    --sw-surface-3: var(--mr-surface-3);
    --sw-accent: var(--mr-accent);
    --sw-accent-soft: var(--mr-accent-soft);
    --sw-focus: var(--mr-focus);
    --sw-fs-lg: 20px;
    --sw-drawer-modal-w: 448px;
  }
  .r {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-inline-size: 0;
    font-size: var(--sw-fs-md);
    line-height: 1.45;
    color: var(--mr-text);
    padding-block-end: 6px;
  }
  /* POLISH4-WP1 (MEDIA-POLISH-2331 5.3): while the layout editor is open its "ביטול / שמירה" bar sticks to the top of the drawer's
     scroll box. A sticky box stops at the scroll box's padding edge, so the body's top padding left a strip where the rows scrolled
     past ABOVE the bar. Editing, the body has no top padding and the editor carries the same space itself: at rest nothing moves,
     scrolled the bar meets the top edge and nothing shows above it. */
  sw-drawer[data-editing]::part(body) {
    padding-block-start: 0;
  }
  .r[data-mr-state='editing'] {
    padding-block-start: 14px;
  }
  .r svg.ic {
    inline-size: 1em;
    block-size: 1em;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    flex: none;
    vertical-align: middle;
  }
  .r :focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
  }
  .n {
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
    font-variant-numeric: tabular-nums;
  }
  bdi {
    unicode-bidi: isolate;
  }
  button {
    font: inherit;
    color: inherit;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }
  button[disabled] {
    cursor: not-allowed;
  }

  /* ---- now showing ---- */
  .np {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 12px;
    border-radius: 20px;
    background: var(--mr-surface-2);
    border: 1px solid var(--mr-border);
  }
  .thumb {
    position: relative;
    inline-size: 64px;
    block-size: 64px;
    border-radius: 15px;
    overflow: hidden;
    color: var(--sw-on-video);
    background: var(--mr-screen-off);
    box-shadow: 0 8px 20px rgb(var(--art, 20 24 34) / 0.35);
    display: grid;
    place-items: center;
  }
  .thumb.plain {
    box-shadow: none;
    color: var(--mr-text-2);
  }
  .thumb .tile {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--a1), var(--a2));
  }
  .thumb .tile::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.3), transparent 45%), radial-gradient(circle at 10% 110%, rgba(0, 0, 0, 0.35), transparent 55%);
  }
  .thumb .tile.frameart {
    background: linear-gradient(160deg, #efe6d6, #e2d3bb);
  }
  .thumb .tile.frameart::before {
    display: none;
  }
  .thumb .tile.saver {
    background: radial-gradient(circle at 70% 30%, #2b3656, #0b0f19 70%);
  }
  .thumb svg.gl {
    position: relative;
    inline-size: 66%;
    block-size: 66%;
    color: rgba(255, 255, 255, 0.72);
    stroke-width: 1.4;
  }
  .thumb .num {
    position: relative;
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: rgba(255, 255, 255, 0.85);
    direction: ltr;
  }
  .thumb img {
    position: absolute;
    inset: 0;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }
  .np .t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
    gap: 1px;
  }
  .np .t small {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .np .t b {
    font-size: var(--sw-fs-lg);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .prog {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--sw-fs-xs);
    color: var(--mr-text-2);
    direction: ltr;
    margin-block-start: 5px;
    font-variant-numeric: tabular-nums;
  }
  .prog .bar {
    flex: 1;
    block-size: 4px;
    border-radius: 2px;
    background: var(--mr-surface-3);
    overflow: hidden;
  }
  .prog .bar i {
    display: block;
    block-size: 100%;
    inline-size: var(--p);
    background: var(--mr-text);
    border-radius: 2px;
  }

  /* ---- segmented control, toggles, buttons ---- */
  /* CR-CMP2-TABS-2460: the tab strips (the remote's pad / sources / apps, the player panel's library and zones) are sw-tabs (pill,
     filling the drawer's width) - the hand-built .seg tab strip is gone; the keys keep the 44 px of the .seg keys */
  sw-tabs[variant='pill'] {
    /* the remote's 44 px keys (the old .seg strip), 14 px sides */
    --sw-tabs-key-h: 44px;
    --sw-tabs-key-pad: 14px;
    /* the remote's own palette (devices.scheme, not the app's theme) through the tokens the pill reads - the skins' pill rules read
       the same tokens, so the track, the thumb and the inks follow the sheet under every skin */
    --sw-surface-3: var(--mr-surface-3);
    --sw-text: var(--mr-text);
    --sw-text-2: var(--mr-text-2);
    --sw-accent-text: var(--mr-text);
    --sw-seg-key: var(--mr-seg-thumb);
    --sw-seg-key-ink: var(--mr-text);
    --sw-seg-thumb-shadow: var(--mr-shadow-control);
    --sw-tabs-fs: var(--sw-fs-base);
  }
  /* CR-CMP2-SEGMENTED-C-2450: the radio groups (audio output, pad type, the remote editor's scope) are sw-segmented, drawn as the
     remote's old .seg strip through its knobs - the pill track, the 44 px keys, the --mr thumb */
  sw-segmented {
    --sw-seg-border: transparent;
    --sw-seg-track: var(--mr-surface-3);
    --sw-seg-radius: 999px;
    --sw-seg-btn-radius: 999px;
    --sw-seg-pad: 3px;
    --sw-seg-gap: 2px;
    --sw-seg-h: 44px;
    --sw-seg-key-pad: 12px;
    --sw-seg-fs: var(--sw-fs-base);
    --sw-seg-fw: 600;
    --sw-seg-fg: var(--mr-text);
    --sw-seg-on-bg: var(--mr-seg-thumb);
    --sw-seg-on-fg: var(--mr-text);
    --sw-seg-on-shadow: var(--mr-shadow-control);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-block-size: 44px;
    padding-inline: 18px;
    border-radius: 999px;
    border: 1px solid var(--mr-border);
    background: var(--mr-sheen), var(--mr-surface);
    color: var(--mr-text);
    font-size: var(--sw-fs-md);
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: var(--mr-shadow-control);
    transition: background var(--mr-motion) var(--mr-ease), transform 120ms var(--mr-ease);
  }
  .btn:active {
    transform: scale(0.97);
  }
  .btn.primary {
    background: var(--mr-accent);
    border-color: transparent;
    color: var(--mr-on-accent-ink);
    box-shadow: 0 6px 16px var(--mr-accent-glow);
  }
  .btn.quiet {
    box-shadow: none;
    background: var(--mr-surface-2);
  }
  .btn[disabled] {
    opacity: 0.45;
    pointer-events: none;
  }
  .btn .ic {
    font-size: var(--sw-fs-lg);
  }

  /* ---- round buttons ---- */
  .rb {
    position: relative;
    flex: none;
    inline-size: 46px;
    block-size: 46px;
    border-radius: 50%;
    border: 0;
    padding: 0;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform 120ms var(--mr-ease), box-shadow var(--mr-motion), color var(--mr-motion);
  }
  .rb .ic {
    font-size: var(--sw-fs-2xl);
  }
  .rb:active,
  .rb.hit {
    transform: scale(0.92);
  }
  .rb.on {
    background: var(--mr-danger-soft);
    color: var(--mr-danger);
    box-shadow: inset 0 0 0 1px var(--mr-danger-soft);
  }
  .rb[disabled] {
    opacity: 0.4;
    pointer-events: none;
  }

  /* ---- volume slider row, audio switch, recent chips ---- */
  .vrow {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 2px;
    direction: ltr;
  }
  .vrow .vv {
    min-inline-size: 30px;
    text-align: start;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .rng {
    -webkit-appearance: none;
    appearance: none;
    flex: 1;
    min-inline-size: 0;
    block-size: 34px;
    background: transparent;
    margin: 0;
  }
  .rng::-webkit-slider-runnable-track {
    block-size: 8px;
    border-radius: 999px;
    background: linear-gradient(to right, var(--mr-accent) var(--v, 50%), var(--mr-surface-3) var(--v, 50%));
  }
  .rng::-moz-range-track {
    block-size: 8px;
    border-radius: 999px;
    background: var(--mr-surface-3);
  }
  .rng::-moz-range-progress {
    block-size: 8px;
    border-radius: 999px;
    background: var(--mr-accent);
  }
  .rng::-webkit-slider-thumb {
    -webkit-appearance: none;
    inline-size: 26px;
    block-size: 26px;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    margin-block-start: -9px;
    box-shadow: var(--mr-knob-shadow), 0 0 0 0.5px rgba(0, 0, 0, 0.08);
  }
  .rng::-moz-range-thumb {
    inline-size: 26px;
    block-size: 26px;
    border: 0;
    border-radius: 50%;
    background: var(--sw-toggle-thumb);
    box-shadow: var(--mr-knob-shadow);
  }
  .rng:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: 2px;
    border-radius: 999px;
  }
  .recent {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    scrollbar-width: none;
    padding: 3px 2px;
  }
  .recent .lbl {
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
    flex: none;
    margin-inline-end: 2px;
  }
  .rchip {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    block-size: 46px;
    padding-inline: 5px 14px;
    border-radius: 15px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    font-size: var(--sw-fs-base);
    font-weight: 500;
    white-space: nowrap;
    flex: none;
    transition: transform 120ms, border-color var(--mr-motion);
  }
  .rchip:hover {
    border-color: var(--mr-border-strong);
  }
  .rchip:active {
    transform: scale(0.97);
  }
  .rchip[aria-current='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
    color: var(--mr-accent-text);
  }
  .gi {
    position: relative;
    display: grid;
    place-items: center;
    color: var(--sw-on-video);
    background: linear-gradient(135deg, var(--a1), var(--a2));
    flex: none;
    overflow: hidden;
  }
  .gi::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0) 50%);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  }
  .gi.src {
    background: var(--mr-surface-3);
    color: var(--mr-text);
  }
  .gi.src::after {
    display: none;
  }
  .rchip .gi {
    inline-size: 36px;
    block-size: 36px;
    border-radius: 11px;
  }
  .rchip .gi .ic {
    font-size: var(--sw-fs-xl);
  }

  /* ---- the pad body ---- */
  .rpad {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    padding: 18px 16px;
    border-radius: 32px;
    background: var(--mr-remote-body);
    border: 1px solid var(--mr-border);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35);
    min-inline-size: 0;
  }
  .rpad.dim {
    opacity: 0.3;
    filter: saturate(0.2);
    pointer-events: none;
  }
  .rpad.shake {
    animation: mr-shake 240ms var(--mr-ease);
  }
  @keyframes mr-shake {
    20% { transform: translateX(-4px); }
    45% { transform: translateX(4px); }
    70% { transform: translateX(-2px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .rpad.shake {
      animation: mr-flash 240ms linear;
    }
    @keyframes mr-flash {
      50% { opacity: 0.6; }
    }
  }
  .tcl {
    direction: ltr;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    inline-size: 100%;
    padding-inline: 4px;
  }
  .tcl .grow {
    flex: 1;
  }
  .navk {
    direction: ltr;
    display: flex;
    justify-content: space-between;
    inline-size: 100%;
    max-inline-size: 300px;
  }
  .kb {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    border: 0;
    background: transparent;
    padding: 0;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 500;
    min-inline-size: var(--mr-key-size);
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .kc {
    position: relative;
    inline-size: var(--mr-key-size);
    block-size: var(--mr-key-size);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--mr-key-bg);
    color: var(--mr-key-fg);
    box-shadow: var(--mr-key-shadow);
    transition: transform 120ms var(--mr-ease), box-shadow 220ms var(--mr-ease), color 220ms;
  }
  .kc .ic {
    font-size: 21px;
  }
  .kb:active .kc,
  .kb.hit .kc,
  .kb.pend .kc {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft), 0 0 22px var(--mr-accent-glow);
  }
  .kb:focus-visible {
    outline: none;
  }
  .kb:focus-visible .kc {
    outline: 2px solid var(--mr-focus);
    outline-offset: 3px;
  }
  .kb.pwk .kc {
    color: var(--mr-danger);
  }
  .kb.pwk.off .kc {
    color: var(--mr-accent);
  }
  .kb[disabled] {
    opacity: 0.45;
  }
  .pgrid {
    direction: ltr;
    display: grid;
    grid-template-columns: var(--mr-rocker-w) var(--mr-dpad-size) var(--mr-rocker-w);
    gap: 14px;
    align-items: center;
    justify-content: center;
  }
  .pgrid.solo {
    grid-template-columns: auto;
  }
  .pgrid.duo {
    grid-template-columns: var(--mr-rocker-w) var(--mr-rocker-w);
    gap: 28px;
  }
  @media (max-width: 767px) {
    .pgrid {
      gap: 10px;
    }
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .rock {
    display: grid;
    grid-template-rows: 1fr auto 1fr;
    inline-size: var(--mr-rocker-w);
    block-size: calc(var(--mr-dpad-size) * 0.74);
    border-radius: 999px;
    background: var(--mr-key-bg);
    box-shadow: var(--mr-key-shadow);
    overflow: hidden;
    user-select: none;
    -webkit-user-select: none;
  }
  .rock button {
    border: 0;
    background: transparent;
    display: grid;
    place-items: center;
    color: var(--mr-key-fg);
    transition: background 220ms, color 160ms;
    touch-action: manipulation;
  }
  .rock button .ic {
    font-size: 21px;
    stroke-width: 2;
  }
  .rock button:active,
  .rock button.hit {
    background: radial-gradient(circle, var(--mr-accent-soft), transparent 72%);
    color: var(--mr-accent);
  }
  .rock button:focus-visible {
    outline: 2px solid var(--mr-focus);
    outline-offset: -4px;
    border-radius: 999px;
  }
  .rock button[disabled] {
    opacity: 0.4;
  }
  .rock .rv {
    margin-inline: 9px;
    padding: 6px 0 5px;
    border-radius: 12px;
    box-shadow: var(--mr-dpad-groove);
    display: flex;
    flex-direction: column;
    align-items: center;
    line-height: 1.1;
    direction: rtl;
  }
  .rock .rv small {
    font-size: var(--sw-fs-2xs);
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .rock .rv b {
    font-size: var(--sw-fs-lg);
    font-variant-numeric: tabular-nums;
    margin-block-start: 1px;
  }
  .pbk {
    direction: ltr;
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }
  .pbk .kb {
    min-inline-size: 0;
  }
  .pbk .kc {
    inline-size: 46px;
    block-size: 46px;
  }
  .pbk .kc .ic {
    font-size: var(--sw-fs-xl);
  }
  .pbk .main .kc {
    inline-size: 62px;
    block-size: 62px;
    background: var(--mr-text);
    color: var(--mr-text-inverse);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  .pbk .main .kc .ic {
    font-size: 24px;
  }
  .morebtn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    inline-size: 100%;
    block-size: 44px;
    border-radius: 999px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    color: var(--mr-text);
    font-size: var(--sw-fs-md);
    font-weight: 600;
  }
  .morebtn:hover {
    background: var(--mr-surface);
  }
  .morebtn .ic {
    font-size: var(--sw-fs-lg);
    transition: transform var(--mr-motion) var(--mr-ease);
  }
  .morebtn[aria-expanded='true'] .ic {
    transform: rotate(180deg);
  }
  .more {
    display: flex;
    flex-direction: column;
    gap: 20px;
    inline-size: 100%;
  }
  .more h4 {
    margin: 0 0 8px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 600;
    text-align: center;
  }
  .npad {
    direction: ltr;
    display: grid;
    grid-template-columns: repeat(3, 72px);
    gap: 10px;
    justify-content: center;
  }
  .npad button {
    block-size: 52px;
    border-radius: 17px;
    border: 0;
    background: var(--mr-key-bg);
    box-shadow: var(--mr-key-shadow);
    font-size: var(--sw-fs-2xl);
    font-weight: 600;
    color: var(--mr-key-fg);
    display: grid;
    place-items: center;
    transition: transform 120ms, box-shadow 220ms, color 200ms;
    font-variant-numeric: tabular-nums;
    touch-action: manipulation;
  }
  .npad button .ic {
    font-size: var(--sw-fs-2xl);
  }
  .npad button:active,
  .npad button.hit {
    transform: scale(0.93);
    color: var(--mr-accent);
    box-shadow: var(--mr-key-shadow), 0 0 0 4px var(--mr-accent-soft);
  }
  .chentry {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    block-size: 24px;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    margin-block-end: 6px;
  }
  .chentry b {
    font-size: var(--sw-fs-2xl);
    color: var(--mr-accent-text);
    letter-spacing: 0.1em;
    direction: ltr;
  }
  .ckeys {
    direction: ltr;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    inline-size: 100%;
    max-inline-size: 300px;
    margin-inline: auto;
  }
  .ckeys button {
    block-size: 44px;
    border-radius: 999px;
    border: 0;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.35), inset 0 -2px 0 rgba(0, 0, 0, 0.15), 0 3px 8px rgba(0, 0, 0, 0.14);
    transition: transform 120ms;
    background-clip: content-box;
    touch-action: manipulation;
  }
  .ckeys button:active,
  .ckeys button.hit {
    transform: scale(0.92);
  }
  .ckeys .red { background: linear-gradient(180deg, #ff6b6b, #e5484d); }
  .ckeys .green { background: linear-gradient(180deg, #4cd08a, #30a46c); }
  .ckeys .yellow { background: linear-gradient(180deg, #ffd84d, #f5c518); }
  .ckeys .blue { background: linear-gradient(180deg, #6f8cff, #3e63dd); }
  .xkeys {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }
  .kbd {
    display: flex;
    gap: 8px;
    inline-size: 100%;
  }
  .kbd .fld {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    block-size: 48px;
    border-radius: 15px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    padding: 0 12px;
    min-inline-size: 0;
  }
  .kbd .fld:focus-within {
    outline: 2px solid var(--mr-focus);
    outline-offset: 1px;
  }
  .kbd input {
    border: 0;
    outline: none;
    flex: 1;
    min-inline-size: 0;
    font: inherit;
    font-size: var(--sw-fs-md);
    background: transparent;
    color: var(--mr-text);
  }
  .kbd input::placeholder {
    color: var(--mr-text-2);
  }
  .kbd .fld .ic {
    color: var(--mr-text-2);
    font-size: var(--sw-fs-xl);
  }
  .kbd .btn {
    min-block-size: 48px;
  }

  /* ---- off / art / unavailable / loading ---- */
  .roff {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 30px 0 12px;
    text-align: center;
  }
  .roff > b {
    font-size: var(--sw-fs-xl);
    font-weight: 600;
    margin-block-start: 6px;
  }
  .roff small {
    font-size: var(--sw-fs-base);
    color: var(--mr-text-2);
  }
  .roff > .ic {
    font-size: 42px;
    color: var(--mr-text-3);
  }
  .bigpw {
    position: relative;
    inline-size: 116px;
    block-size: 116px;
    border-radius: 50%;
    border: 0;
    background: var(--mr-key-bg);
    color: var(--mr-accent);
    display: grid;
    place-items: center;
    box-shadow: var(--mr-key-shadow), 0 0 0 10px var(--mr-accent-soft), 0 18px 44px var(--mr-accent-glow);
    transition: transform 140ms var(--mr-ease);
  }
  .bigpw .ic {
    font-size: 44px;
    stroke-width: 2;
  }
  .bigpw:active {
    transform: scale(0.95);
  }
  .bigpw[disabled] {
    color: var(--mr-text-3);
    box-shadow: var(--mr-key-shadow);
  }
  .bigpw.pend,
  .kb.pend {
    cursor: progress;
  }
  .pendring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 3px solid transparent;
    border-block-start-color: var(--mr-accent);
    animation: mr-spin 900ms linear infinite;
    pointer-events: none;
  }
  @keyframes mr-spin {
    to { transform: rotate(360deg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pendring {
      animation: none;
      border-color: var(--mr-accent);
      opacity: 0.6;
    }
  }
  .skl {
    display: block;
    border-radius: 14px;
    background: linear-gradient(90deg, var(--mr-surface-3) 0%, var(--mr-surface-2) 50%, var(--mr-surface-3) 100%);
    background-size: 200% 100%;
    animation: mr-sh 1.6s linear infinite;
  }
  @keyframes mr-sh {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skl {
      animation: none;
    }
  }
  .errbox {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 36px 12px;
    text-align: center;
    color: var(--mr-text-2);
  }
  .errbox .ic {
    font-size: 34px;
    color: var(--mr-danger);
  }

  /* ---- sources and apps ---- */
  .srcg {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .srci {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    min-block-size: 100px;
    border-radius: 20px;
    border: 1px solid var(--mr-border);
    background: var(--mr-surface-2);
    text-align: start;
    font-size: var(--sw-fs-md);
    font-weight: 600;
    color: var(--mr-text);
    transition: transform 120ms, background var(--mr-motion), border-color var(--mr-motion);
  }
  .srci:hover {
    background: var(--mr-surface);
  }
  .srci:active {
    transform: scale(0.98);
  }
  .srci .gi {
    inline-size: 42px;
    block-size: 42px;
    border-radius: 50%;
  }
  .srci .gi .ic {
    font-size: var(--sw-fs-2xl);
  }
  .srci small {
    display: block;
    font-size: var(--sw-fs-sm);
    color: var(--mr-text-2);
    font-weight: 500;
  }
  .srci[aria-checked='true'] {
    border-color: var(--mr-accent);
    background: var(--mr-accent-soft);
  }
  .srci[aria-checked='true'] .gi.src {
    background: var(--mr-accent);
    color: var(--mr-on-accent-ink);
  }
  .srci .ck {
    position: absolute;
    inset-block-start: 12px;
    inset-inline-end: 12px;
    color: var(--mr-accent-text);
    font-size: var(--sw-fs-xl);
  }
  .srci .pendring {
    inset: 6px;
    inline-size: 18px;
    block-size: 18px;
    inset-inline-start: auto;
    inset-block-end: auto;
    border-width: 2px;
  }
  .appg {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px 8px;
  }
  .appt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 4px 0;
    font-size: var(--sw-fs-sm);
    font-weight: 500;
    color: var(--mr-text);
    border-radius: 14px;
    min-inline-size: 0;
    min-block-size: 44px;
  }
  .appt .gi {
    position: relative;
    inline-size: 62px;
    block-size: 62px;
    border-radius: 19px;
    box-shadow: 0 8px 20px rgb(var(--art) / 0.35);
    transition: transform 140ms var(--mr-ease);
  }
  .appt .gi .ic {
    font-size: 27px;
  }
  .appt span:last-child {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .appt:active .gi {
    transform: scale(0.92);
  }
  .appt[aria-current='true'] .gi {
    outline: 3px solid var(--mr-accent);
    outline-offset: 3px;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 28px 12px;
    color: var(--mr-text-2);
    font-weight: 600;
  }
  .empty .ic {
    font-size: 30px;
    color: var(--mr-text-3);
  }

  /* ---- the notice above the body (not confirmed / refused) ---- */
  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 14px;
    background: var(--mr-danger-soft);
    color: var(--mr-text);
    font-size: var(--sw-fs-base);
    font-weight: 600;
  }
  .notice[hidden] {
    display: none;
  }
  .notice .ic {
    color: var(--mr-danger);
    font-size: var(--sw-fs-xl);
  }
`;var ur=Object.defineProperty,mr=Object.getOwnPropertyDescriptor,S=(e,t,r,i)=>{for(var s=i>1?void 0:i?mr(t,r):t,a=e.length-1,l;a>=0;a--)(l=e[a])&&(s=(i?l(t,r,s):l(s))||s);return i&&s&&ur(t,r,s),s};let _=class extends G{constructor(){super(...arguments),this.deviceKey="",this.canEdit=!1,this.stamp=null,this.list=null,this.rows=[],this.busy=new Set,this.drag=null,this.ask=null,this.select=!1,this.selected=[],this.note="",this.poll=new Ee(this),this.noteTimer=0,this.token=0,this.rects=[],this.startY=0}connectedCallback(){super.connectedCallback(),this.poll.every("upnext",De,()=>this.load())}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noteTimer)}willUpdate(e){e.has("deviceKey")&&(this.list=null,this.rows=[],this.ask=null,this.select=!1,this.selected=[])}updated(e){(e.has("deviceKey")||e.has("stamp"))&&this.deviceKey&&this.load()}async load(){if(!this.deviceKey||this.drag)return;const e=++this.token;try{const t=await D().queue(this.deviceKey);if(e!==this.token)return;this.list=t,this.rows=t.items;const r=new Set(t.items.filter(i=>!i.locked).map(i=>i.item));this.selected.some(i=>!r.has(i))&&(this.selected=this.selected.filter(i=>r.has(i)))}catch(t){if(e!==this.token||A(t)==="rate_limited")return;this.list="error"}}say(e){this.note=e,window.clearTimeout(this.noteTimer),this.noteTimer=window.setTimeout(()=>this.note="",3600)}async edit(e,t,r={}){const i=t?`${e}:${t.item}`:e;if(!this.busy.has(i)){this.busy=new Set(this.busy).add(i);try{const s=await Qe(this.deviceKey,e,{...t?{item:t.item}:{},...r});s.status==="refused"&&this.say(Je(s,r.items?.length??1)||n("הפעולה נדחתה"))}catch(s){const a=We(s);this.say(a!==null&&r.items?n("הוסרו {n} מתוך {total}",{n:a,total:r.items.length}):ee(s))}finally{const s=new Set(this.busy);s.delete(i),this.busy=s,this.load()}}}onPlay(e){if(this.select){e.locked||(this.selected=Ze(this.selected,e.item));return}this.edit("play",e)}endSelect(){this.select=!1,this.selected=[],this.ask==="remove"&&(this.ask=null)}removeSelected(){const e=[...this.selected],t=new Set(e);this.ask=null,this.rows=this.rows.filter(r=>!t.has(r.item)),this.endSelect(),this.edit("delete_many",null,{items:e})}clear(e){this.ask=null,this.edit(e,null,{confirmed:!0})}onNext(e){const t=this.list;t&&t!=="error"&&t.locked_to!==null&&(this.rows=pe(this.rows,e.index,t.locked_to+1)),this.edit("top",e)}onDelete(e){this.rows=this.rows.filter(t=>t.item!==e.item),this.edit("delete",e)}moveTo(e,t){const r=this.list;if(!r||r==="error"||r.locked_to===null)return;const i=this.rows.length?this.rows[this.rows.length-1].index:e.index,s=et(e.index,t,r.locked_to,i);s!==null&&(this.rows=pe(this.rows,e.index,s),this.edit("move",e,{to:s}))}onGripDown(e,t){e.button!==0||!this.canEdit||(e.preventDefault(),e.currentTarget.setPointerCapture(e.pointerId),this.rects=[...this.renderRoot.querySelectorAll("[data-qx-row]")].map(r=>{const i=r.getBoundingClientRect();return{index:Number(r.dataset.qxRow),top:i.top,bottom:i.bottom}}),this.startY=e.clientY,this.drag={from:t.index,over:t.index,dy:0})}onGripMove(e){if(!this.drag)return;const t=this.rects.find(r=>e.clientY>=r.top&&e.clientY<r.bottom)??(e.clientY<(this.rects[0]?.top??0)?this.rects[0]:this.rects[this.rects.length-1]);this.drag={...this.drag,over:t?t.index:this.drag.over,dy:e.clientY-this.startY}}onGripUp(e){const t=this.drag;this.drag=null,t&&t.over!==t.from&&this.moveTo(e,t.over)}onGripKey(e,t){e.key!=="ArrowUp"&&e.key!=="ArrowDown"||(e.preventDefault(),this.moveTo(t,t.index+(e.key==="ArrowUp"?-1:1)),this.updateComplete.then(()=>this.renderRoot.querySelector(`[data-qx-grip="${t.item}"]`)?.focus()))}render(){const e=this.list,t=e&&e!=="error"&&e.confirmed?e.count:null,r=this.rows.filter(c=>!c.locked).length,i=this.selected.length,s=!this.canEdit||r===0?p:this.select?o`<span class="hacts"><small class="n" data-qx-sel-count>${n("{n} נבחרו",{n:i})}</small>
          <button type="button" class="lnk danger" data-qx-remove-sel ?disabled=${i===0||this.busy.has("delete_many")} @click=${()=>this.ask="remove"}>${n("הסר")}</button>
          <button type="button" class="lnk" data-qx-select-cancel @click=${()=>this.endSelect()}>${n("ביטול")}</button></span>`:o`<span class="hacts"><button type="button" class="lnk" data-qx-select @click=${()=>{this.select=!0,this.ask=null}}>${n("בחר")}</button>
          <button type="button" class="lnk" data-qx-clear ?disabled=${this.busy.has("clear")||this.busy.has("clear_upcoming")} @click=${()=>this.ask="clear"}>${n("נקה תור")}</button></span>`,a=o`<div class="psh"><h4>${n("הבא בתור")}</h4>${t?o`<small class="n" data-qx-count>${t}</small>`:p}${s}</div>`;if(e===null)return o`${a}<div class="uq" aria-busy="true" data-pn-upnext="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`;if(e==="error"||!e.confirmed)return o`${a}<div class="uq" data-pn-upnext="unavailable"><div class="unav">${h("wifiOff")}${n("לא זמין")}</div></div>`;const l=this.drag,d=tt(e);return o`${a}
      ${this.ask==="clear"?o`<div class="ask choice" role="alertdialog" aria-label=${n("ניקוי התור")} data-qx-ask="clear"><b>${n("לנקות את התור?")}</b>
            ${d>0?o`<button type="button" class="opt" data-qx-clear-upcoming @click=${()=>this.clear("clear_upcoming")}>${n("נקה את הבאים")}<small>${n("{n} שירים; השיר הנוכחי ממשיך",{n:d})}</small></button>`:p}
            <button type="button" class="opt danger" data-qx-clear-all @click=${()=>this.clear("clear")}>${n("נקה הכול")}<small>${n("הניגון ייעצר")}</small></button>
            <button type="button" class="no" data-qx-ask-no @click=${()=>this.ask=null}>${n("ביטול")}</button></div>`:p}
      ${this.ask==="remove"?o`<div class="ask" role="alertdialog" aria-label=${n("הסרת שירים")} data-qx-ask="remove"><span class="sp">${n("להסיר {n} שירים מהתור?",{n:i})}</span>
            <button type="button" class="yes" data-qx-remove-yes @click=${()=>this.removeSelected()}>${n("הסר")}</button>
            <button type="button" class="no" data-qx-ask-no @click=${()=>this.ask=null}>${n("ביטול")}</button></div>`:p}
      <div class="uq" role="list" aria-label=${n("תור הניגון")} data-pn-upnext="queue">
        ${this.rows.length?V(this.rows,c=>c.item,c=>this.row(c,e.index,l)):o`<div class="unav" data-qx-empty>${h("list")}${n("התור ריק")}</div>`}
      </div>
      ${this.select&&i>=de?o`<div class="qnote" role="status" data-qx-cap>${n("אפשר לבחור עד {n} שירים",{n:de})}</div>`:p}
      ${this.note?o`<div class="qnote" role="status" data-qx-note>${this.note}</div>`:p}`}row(e,t,r){const i=t!==null&&e.index===t,s=r?.from===e.index,a=!!r&&r.over===e.index&&r.over<r.from,l=!!r&&r.over===e.index&&r.over>r.from,d=this.canEdit&&!e.locked&&!this.select,c=this.selected.includes(e.item),u=o`<span class="ix n">${this.select&&!e.locked?c?h("check"):"":i?h("play"):e.index+1}</span>
      <span class="t"><b>${v(e.name)}</b>${e.artist?o`<small>${v(e.artist)}</small>`:p}</span>
      <span class="dur n">${e.duration_s?N(e.duration_s):""}</span>`,f=this.canEdit&&(this.select?!e.locked:!i)?this.select?o`<button type="button" role="checkbox" aria-checked=${String(c)} class=${k({tap:!0,sel:c})} data-qx-pick @click=${()=>this.onPlay(e)}>${u}</button>`:o`<button type="button" class=${k({tap:!0,pend:this.busy.has(`play:${e.item}`)})} aria-label=${n("נגן עכשיו: {name}",{name:e.name})} data-qx-play @click=${()=>this.onPlay(e)}>${u}</button>`:o`<div class=${k({tap:!0,off:this.select&&e.locked})}>${u}</div>`;return o`<div class=${k({row:!0,qrow:!0,cur:i,dragging:s,"over-before":a,"over-after":l})} role="listitem" data-qx-row=${e.index}
        data-qx-locked=${String(e.locked)} style=${s?`transform:translateY(${r.dy}px)`:""}>
      ${f}
      <span class="acts">${d?o`<button type="button" class=${k({qb:!0,pend:this.busy.has(`top:${e.item}`)})} title=${n("העבר לראש התור")} aria-label=${n("העבר לראש התור")} data-qx-next @click=${()=>this.onNext(e)}>${h("playNext")}</button>
            <button type="button" class=${k({qb:!0,del:!0,pend:this.busy.has(`delete:${e.item}`)})} title=${n("הסר מהתור")} aria-label=${n("הסר מהתור")} data-qx-delete @click=${()=>this.onDelete(e)}>${h("trash")}</button>
            <button type="button" class="qb grip" title=${n("גרור לשינוי הסדר")} aria-label=${n("הזז בתור (חצים למעלה ולמטה)")} data-qx-grip=${e.item}
              @pointerdown=${y=>this.onGripDown(y,e)} @pointermove=${y=>this.onGripMove(y)}
              @pointerup=${()=>this.onGripUp(e)} @pointercancel=${()=>this.drag=null} @keydown=${y=>this.onGripKey(y,e)}>${h("grip")}</button>`:p}</span>
    </div>`}};_.styles=[le,F,oe,C`
      :host {
        display: contents;
      }
      .uq .row.qrow {
        grid-template-columns: minmax(0, 1fr) auto;
        touch-action: pan-y;
        transition: background var(--mr-motion);
      }
      .tap {
        all: unset;
        box-sizing: border-box;
        display: grid;
        grid-template-columns: 28px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        min-inline-size: 0;
        min-block-size: 32px;
        border-radius: var(--sw-r-md);
      }
      button.tap {
        cursor: pointer;
      }
      button.tap:hover {
        background: var(--mr-surface-3);
      }
      button.tap:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 1px;
      }
      .tap.pend {
        opacity: 0.5;
        pointer-events: none;
      }
      .tap.off {
        opacity: 0.55;
      }
      .tap.sel .ix {
        background: var(--mr-accent);
        color: var(--sw-text-inverse);
      }
      .hacts {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        margin-inline-start: auto;
      }
      .psh .hacts .lnk {
        margin-inline-start: 0;
      }
      .psh .lnk.danger {
        color: var(--mr-danger, var(--sw-danger-text));
      }
      .uq .row.qrow.dragging {
        position: relative;
        z-index: 2;
        background: var(--mr-surface);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.18);
        transition: none;
      }
      .uq .row.qrow.over-before {
        box-shadow: inset 0 2px 0 var(--mr-accent);
      }
      .uq .row.qrow.over-after {
        box-shadow: inset 0 -2px 0 var(--mr-accent);
      }
      .acts {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }
      .qb {
        all: unset;
        box-sizing: border-box;
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: var(--sw-r-md);
        color: var(--mr-text-2);
        cursor: pointer;
      }
      .qb .ic {
        font-size: var(--sw-fs-xl);
      }
      .qb:hover {
        background: var(--mr-surface-3);
        color: var(--mr-text);
      }
      .qb:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 1px;
      }
      .qb.grip {
        cursor: grab;
        touch-action: none;
      }
      .qb.pend,
      .qb[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .qb.del:hover {
        color: var(--mr-danger, var(--sw-danger-text));
      }
      .ask {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        padding: 8px 10px;
        border-radius: var(--sw-r-md);
        background: var(--mr-surface-3);
        font-size: var(--sw-fs-base);
        font-weight: 600;
      }
      .ask .sp {
        flex: 1;
      }
      .ask button {
        all: unset;
        cursor: pointer;
        padding: 6px 12px;
        border-radius: var(--sw-r-pill);
        font-weight: 600;
        font-size: var(--sw-fs-sm);
      }
      .ask .yes {
        background: var(--mr-danger, var(--sw-danger));
        color: var(--sw-text-inverse);
      }
      .ask.choice {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }
      .ask.choice .opt {
        display: flex;
        flex-direction: column;
        gap: 1px;
        padding: 8px 12px;
        border-radius: var(--sw-r-md);
        background: var(--mr-surface);
        border: 1px solid var(--mr-border);
        font-size: var(--sw-fs-base);
        text-align: start;
      }
      .ask.choice .opt small {
        font-size: var(--sw-fs-sm);
        font-weight: 500;
        color: var(--mr-text-2);
      }
      .ask.choice .opt.danger {
        color: var(--mr-danger, var(--sw-danger-text));
      }
      .ask.choice .no {
        align-self: flex-end;
      }
      .ask .no {
        color: var(--mr-text-2);
      }
      .ask button:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .qnote {
        font-size: var(--sw-fs-sm);
        color: var(--mr-text-2);
        padding: 2px 8px;
      }
      /* every target is 44 px (the layout guard's rule: touch layouts, and the desktop dial's default) */
      .qb {
        inline-size: 44px;
        block-size: 44px;
      }
      .tap {
        min-block-size: 44px;
      }
      .psh .hacts .lnk {
        min-block-size: 44px;
        min-inline-size: 44px;
        justify-content: center;
        padding-inline: 10px;
      }
      .ask button {
        min-block-size: 44px;
        min-inline-size: 44px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding-inline: 14px;
      }
      @media (max-width: 480px) {
        .uq .row.qrow {
          gap: 4px;
          padding-inline: 6px 2px;
        }
        .acts {
          gap: 0;
        }
        .uq .dur {
          display: none;
        }
      }
    `];S([x({attribute:!1})],_.prototype,"deviceKey",2);S([x({type:Boolean})],_.prototype,"canEdit",2);S([x({attribute:!1})],_.prototype,"stamp",2);S([m()],_.prototype,"list",2);S([m()],_.prototype,"rows",2);S([m()],_.prototype,"busy",2);S([m()],_.prototype,"drag",2);S([m()],_.prototype,"ask",2);S([m()],_.prototype,"select",2);S([m()],_.prototype,"selected",2);S([m()],_.prototype,"note",2);_=S([Y("media-queue-list")],_);var hr=Object.defineProperty,fr=Object.getOwnPropertyDescriptor,M=(e,t,r,i)=>{for(var s=i>1?void 0:i?fr(t,r):t,a=e.length-1,l;a>=0;a--)(l=e[a])&&(s=(i?l(t,r,s):l(s))||s);return i&&s&&hr(t,r,s),s};const vr=550;let $=class extends G{constructor(){super(...arguments),this.deviceKey="",this.canSearch=!1,this.canPlay=!1,this.enqueueOk=!1,this.pending=new Set,this.current=null,this.type="track",this.q="",this.items=null,this.more=!1,this.failed=!1,this.loadingMore=!1,this.token=0,this.debounce=0,this.longTimer=0,this.longFired=!1,this.onUp=()=>window.clearTimeout(this.longTimer)}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.debounce),window.clearTimeout(this.longTimer)}updated(e){e.has("deviceKey")&&this.deviceKey&&this.load(!1)}async load(e){const t=++this.token,r=e&&this.items?this.items.length:0;e?this.loadingMore=!0:(this.items=null,this.failed=!1);try{const i=await D().browse(this.deviceKey,this.type,this.canSearch?this.q:"",r);if(t!==this.token)return;this.items=e&&this.items?[...this.items,...i.items]:i.items,this.more=i.more}catch(i){if(t!==this.token||A(i)==="rate_limited"&&this.items)return;this.failed=!0,e||(this.items=[])}finally{t===this.token&&(this.loadingMore=!1)}}pick(e){e!==this.type&&(this.type=e,this.load(!1))}onInput(e){this.q=e.target.value.slice(0,ue),window.clearTimeout(this.debounce),this.debounce=window.setTimeout(()=>void this.load(!1),rt)}clearQ(){this.q="",window.clearTimeout(this.debounce),this.load(!1)}fire(e,t){this.dispatchEvent(new CustomEvent("play-item",{detail:{item:e,enqueue:t},bubbles:!0,composed:!0}))}onDown(e){this.longFired=!1,this.enqueueOk&&(window.clearTimeout(this.longTimer),this.longTimer=window.setTimeout(()=>{this.longFired=!0,this.fire(e,"next")},vr))}onTap(e){if(window.clearTimeout(this.longTimer),this.longFired){this.longFired=!1;return}this.fire(e,"play")}render(){return o`
      ${this.canSearch?o`<label class="srch" data-lb-search>${h("search")}<input type="search" .value=${this.q} maxlength=${ue} placeholder=${n("חיפוש בספרייה")} aria-label=${n("חיפוש בספרייה")} enterkeyhint="search"
              @input=${this.onInput} @keydown=${e=>{e.key==="Enter"&&(window.clearTimeout(this.debounce),this.load(!1))}} />
            ${this.q?o`<button type="button" class="x" aria-label=${n("נקה חיפוש")} data-lb-clear @click=${this.clearQ}>${h("close")}</button>`:p}</label>`:p}
      <div class="chips" role="group" aria-label=${n("סוג")} data-lb-types>${it.map(e=>o`<button type="button" class="chip" aria-pressed=${String(this.type===e)} data-lb-type=${e} @click=${()=>this.pick(e)}>${st[e]}</button>`)}</div>
      ${this.body()}`}body(){return this.items===null?o`<div class="libg" aria-busy="true" data-lb="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`:this.failed&&!this.items.length?o`<div class="libempty" data-lb="error">${n("לא זמין")}</div>`:this.items.length?o`<div class="libg" role="list" data-lb=${this.type}>${V(this.items,e=>e.item_ref,e=>this.tile(e))}</div>
      ${this.more?o`<button type="button" class="moreb" data-lb-more ?disabled=${this.loadingMore} @click=${()=>void this.load(!0)}>${h("chevronDown")}${n("עוד")}</button>`:p}`:o`<div class="libempty" data-lb="empty">${this.q?n("לא נמצאו פריטים"):n("אין פריטים")}</div>`}tile(e){const t=O(e.hue),r=this.pending.has(`item:${e.item_ref}`);return o`<div class="tile" role="listitem">
      <button type="button" class=${k({libi:!0,pend:r})} data-lb-item=${e.item_ref} aria-current=${String(this.current!==null&&e.name===this.current)} ?disabled=${!this.canPlay||r}
        title=${this.enqueueOk?n("נגן עכשיו · לחיצה ארוכה: אחרי הנוכחי"):n("נגן עכשיו")} @pointerdown=${()=>this.onDown(e)} @pointerup=${this.onUp} @pointerleave=${this.onUp} @pointercancel=${this.onUp} @click=${()=>this.onTap(e)}>
        <span class="gi" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}">${j(e.kind==="radio"?"radio":e.glyph,"ic")}</span>
        <span class="t"><b>${v(e.name)}</b>${e.artist?o`<small>${v(e.artist)}</small>`:p}</span></button>
      ${this.enqueueOk&&e.kind!=="radio"?o`<button type="button" class="add" title=${n("הוסף לתור")} aria-label=${n("הוסף לתור")} data-lb-add=${e.item_ref} ?disabled=${!this.canPlay||r} @click=${()=>this.fire(e,"add")}>${h("addQueue")}</button>`:p}
    </div>`}};$.styles=[le,F,oe,C`
      :host {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .srch {
        display: flex;
        align-items: center;
        gap: 8px;
        padding-inline: 12px 6px;
        min-block-size: 42px;
        border-radius: var(--sw-r-lg);
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
      }
      .srch:focus-within {
        border-color: var(--mr-accent);
      }
      .srch .ic {
        font-size: var(--sw-fs-xl);
        color: var(--mr-text-3);
        flex: none;
      }
      .srch input {
        all: unset;
        flex: 1;
        min-inline-size: 0;
        font: inherit;
        font-size: var(--sw-fs-md);
        color: var(--mr-text);
      }
      .srch input::placeholder {
        color: var(--mr-text-3);
      }
      .srch .x {
        all: unset;
        cursor: pointer;
        display: grid;
        place-items: center;
        inline-size: 30px;
        block-size: 30px;
        border-radius: var(--sw-r-sm);
        color: var(--mr-text-2);
      }
      .srch .x:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      .chips {
        display: flex;
        gap: 6px;
        overflow-x: auto;
        scrollbar-width: none;
        padding-block: 2px;
      }
      .chips::-webkit-scrollbar {
        display: none;
      }
      .chip {
        all: unset;
        cursor: pointer;
        flex: none;
        padding: 6px 12px;
        border-radius: var(--sw-r-pill);
        font-size: var(--sw-fs-sm);
        font-weight: 600;
        color: var(--mr-text-2);
        background: var(--mr-surface-2);
        border: 1px solid var(--mr-border);
      }
      .chip[aria-pressed='true'] {
        color: var(--mr-accent-text);
        background: var(--mr-accent-soft);
        border-color: var(--mr-accent);
      }
      .chip:focus-visible {
        outline: 2px solid var(--mr-focus);
        outline-offset: 2px;
      }
      .tile {
        position: relative;
        display: flex;
        min-inline-size: 0;
      }
      .tile .libi {
        flex: 1;
        padding-inline-end: 40px;
      }
      .tile .add {
        all: unset;
        cursor: pointer;
        position: absolute;
        inset-inline-end: 4px;
        inset-block: 0;
        margin-block: auto;
        display: grid;
        place-items: center;
        inline-size: 34px;
        block-size: 34px;
        border-radius: var(--sw-r-md);
        color: var(--mr-text-2);
      }
      .tile .add:hover {
        background: var(--mr-surface-3);
        color: var(--mr-text);
      }
      .tile .add:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      .tile .add .ic {
        font-size: var(--sw-fs-xl);
      }
      .tile .add[disabled] {
        opacity: 0.4;
        pointer-events: none;
      }
      .moreb {
        all: unset;
        cursor: pointer;
        align-self: center;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-block-size: 36px;
        padding-inline: 14px;
        border-radius: var(--sw-r-pill);
        font-size: var(--sw-fs-sm);
        font-weight: 600;
        color: var(--mr-text-2);
      }
      .moreb:focus-visible {
        outline: 2px solid var(--mr-focus);
      }
      @media (max-width: 480px) {
        .libg {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `];M([x({attribute:!1})],$.prototype,"deviceKey",2);M([x({type:Boolean})],$.prototype,"canSearch",2);M([x({type:Boolean})],$.prototype,"canPlay",2);M([x({type:Boolean})],$.prototype,"enqueueOk",2);M([x({attribute:!1})],$.prototype,"pending",2);M([x({attribute:!1})],$.prototype,"current",2);M([m()],$.prototype,"type",2);M([m()],$.prototype,"q",2);M([m()],$.prototype,"items",2);M([m()],$.prototype,"more",2);M([m()],$.prototype,"failed",2);M([m()],$.prototype,"loadingMore",2);$=M([Y("media-library-browse")],$);var br=Object.defineProperty,gr=Object.getOwnPropertyDescriptor,w=(e,t,r,i)=>{for(var s=i>1?void 0:i?gr(t,r):t,a=e.length-1,l;a>=0;a--)(l=e[a])&&(s=(i?l(t,r,s):l(s))||s);return i&&s&&br(t,r,s),s};const wr=4e3,xr=600,kr=2,yr=500,$r=8e3;let b=class extends G{constructor(){super(...arguments),this.deviceKey="",this.open=!1,this.scheme="",this.clock=()=>new Date,this.detail=null,this.phase="loading",this.devices=null,this.upNext=null,this.libAbsent=!1,this.lib={},this.kindsOn=null,this.libTab=null,this.pend=new Set,this.notice=[],this.shaking=!1,this.byRoom=!1,this.zone="",this.outcomes={},this.joining=new Set,this.tick=0,this.confirm=null,this.partyAsk=null,this.trMenu=!1,this.seekDraft=null,this.nowMs=Date.now(),this.gate=new _e,this.press=new Dt(e=>this.onStepKey(e)),this.draft=new nt,this.groupGap=new nr(500),this.token=0,this.polls=0,this.poll=new Ee(this),this.tickTimer=0,this.noticeTimer=0,this.refreshTimer=0,this.joinTimer=0,this.seekTimer=0,this.upNextAt=0,this.upNextTitle=null,this.longTimer=0,this.longFired=!1,this.onBlur=()=>{(document.visibilityState==="hidden"||!document.hasFocus())&&this.press.stopAll()},this.onSeekInput=e=>{const t=this.detail,r=t?.live.now.duration_s;!t||!r||(this.seekDraft=Math.round(Number(e.target.value)/1e3*r))},this.onSeekChange=e=>{const t=this.detail,r=t?.live.now.duration_s;if(!t||!r)return;const i=Math.round(Number(e.target.value)/1e3*r);this.seekDraft=i,window.clearTimeout(this.seekTimer),this.seekTimer=window.setTimeout(()=>{this.exec({command:"seek",position_s:i}).then(s=>{s||(this.seekDraft=null)})},At)},this.onVolume=e=>{e.stopPropagation();const{key:t,level:r,zone:i}=e.detail,s=this.deviceOf(t),a=i&&s?.zones&&i!==s.zones[0]?.id?i:void 0;if(s?.kind==="group"){this.runGroupVolume(r,"absolute");return}s&&this.exec({command:"volume_set",level:r,...a?{zone:a}:{}},s,{},`vol:${t}${a?`@${a}`:""}`)},this.onGroupVolume=e=>{e.stopPropagation(),this.runGroupVolume(e.detail.level,"relative")},this.onEqualize=e=>{e.stopPropagation();const t=this.detail,r=t&&this.devices?B(t,this.devices):t,i=r?ye(r,this.devices??[]):[],s=i.length?Math.max(...i.map(a=>a.level??0)):null;s!==null&&this.runGroupVolume(s,"absolute")},this.onItemDown=e=>{const t=this.detail;this.longFired=!1,!(!t||!J(t))&&(window.clearTimeout(this.longTimer),this.longTimer=window.setTimeout(()=>{this.longFired=!0,this.exec({command:"play_item",item_ref:e.item_ref,enqueue:"next"},t,{},`item:${e.item_ref}`)},Ot))},this.onItemUp=()=>window.clearTimeout(this.longTimer),this.onClose=e=>{e.target===e.currentTarget&&(this.open=!1)},this.onDown=e=>{const t=this.stepKeyOf(e);if(!t)return;this.press.down(e,t);const r=()=>{this.press.up(),window.removeEventListener("pointerup",r),window.removeEventListener("pointercancel",r)};window.addEventListener("pointerup",r),window.addEventListener("pointercancel",r)},this.onClick=e=>{const r=e.composedPath().find(s=>s.dataset?.muteKey!==void 0);if(r){this.onMute(r.dataset.muteKey);return}const i=this.stepKeyOf(e);i&&this.press.click(e,i)},this.onKeyDown=e=>{const t=this.stepKeyOf(e);t&&this.press.keyDown(e,t)},this.onKeyUp=e=>{const t=this.stepKeyOf(e);t&&this.press.keyUp(e,t)},this.onDocKeyDown=e=>{const t=this.detail;if(!this.open||!t||P(t)!=="on"||!t.can.control||this.confirm)return;const r=e.composedPath()[0],i=xe({key:e.key,ctrlKey:e.ctrlKey,altKey:e.altKey,metaKey:e.metaKey,repeat:e.repeat,target:r?{tagName:r.tagName,isContentEditable:r.isContentEditable}:null});i==="mute"&&t.caps.mute?(e.preventDefault(),e.repeat||this.onMute(t.key)):(i==="volup"||i==="voldown")&&t.caps.volume_step&&(e.preventDefault(),this.press.global(i,!0,e.repeat))},this.onDocKeyUp=e=>{const t=xe({key:e.key});(t==="volup"||t==="voldown")&&this.press.global(t,!1)}}connectedCallback(){super.connectedCallback(),this.hasAttribute("data-devices-scheme")||this.setAttribute("data-devices-scheme","light"),at(this)}disconnectedCallback(){super.disconnectedCallback(),this.end()}willUpdate(e){e.has("deviceKey")&&e.get("deviceKey")!==void 0&&this.resetForDevice()}updated(e){(e.has("open")||e.has("deviceKey"))&&(this.open&&this.deviceKey?this.begin():this.open||this.end()),this.syncGlow()}resetForDevice(){this.detail=null,this.phase="loading",this.devices=null,this.upNext=null,this.libAbsent=!1,this.lib={},this.libTab=null,this.pend=new Set,this.notice=[],this.byRoom=!1,this.zone="",this.outcomes={},this.joining=new Set,this.confirm=null,this.partyAsk?.answer(!1),this.trMenu=!1,this.seekDraft=null,this.draft.clear(),this.upNextAt=0,this.upNextTitle=null,this.polls=0,this.gate=new _e,this.press.stopAll()}begin(){this.scheme?me(this,this.scheme):ot().then(e=>me(this,e.scheme)),D().favourites().then(e=>this.kindsOn=e.kinds_on).catch(()=>{}),this.load(!0),this.poll.every("state",wr,()=>this.load(!1),{when:()=>this.pend.size===0&&this.joining.size===0}),window.clearInterval(this.tickTimer),this.tickTimer=window.setInterval(()=>{this.detail?.live.play==="playing"&&(this.nowMs=Date.now())},1e3),document.addEventListener("keydown",this.onDocKeyDown,!0),document.addEventListener("keyup",this.onDocKeyUp,!0),window.addEventListener("blur",this.onBlur),document.addEventListener("visibilitychange",this.onBlur)}end(){this.poll.cancel("state"),window.clearInterval(this.tickTimer);for(const e of[this.noticeTimer,this.refreshTimer,this.joinTimer,this.seekTimer,this.longTimer])window.clearTimeout(e);this.token++,this.press.stopAll(),document.removeEventListener("keydown",this.onDocKeyDown,!0),document.removeEventListener("keyup",this.onDocKeyUp,!0),window.removeEventListener("blur",this.onBlur),document.removeEventListener("visibilitychange",this.onBlur),this.pend=new Set,this.joining=new Set,this.draft.clear(),this.confirm=null,this.partyAsk?.answer(!1),this.trMenu=!1,this.gate.powerDone()}syncGlow(){const e=this.detail,t=e?.live.now,r=!!e&&P(e)==="on"&&!!t&&(e.live.play==="playing"||e.live.play==="paused")&&t.hue!==null;this.style.setProperty("--mr-art",r&&t?O(t.hue).rgb:lr)}async load(e){const t=this.deviceKey;if(!t)return;const r=++this.token;e&&!(this.detail&&this.detail.key===t)&&(this.phase="loading");try{const i=await D().get(t);if(r!==this.token||t!==this.deviceKey)return;this.applyDetail(i),this.loadSide(i,r,e)}catch{if(r!==this.token)return;this.detail||(this.phase="error")}}applyDetail(e){this.detail=e,this.phase="ready",this.zone===""&&e.zones?.length&&(this.zone=e.zones[0].id),this.dispatchEvent(new CustomEvent("media-changed",{detail:{key:e.key},bubbles:!0,composed:!0}))}refreshSoon(e=500){window.clearTimeout(this.refreshTimer),this.refreshTimer=window.setTimeout(()=>void this.load(!1),e)}async loadSide(e,t,r){if(P(e)==="unavailable")return;if(r&&e.music_provider!=="none"&&(e.caps.up_next||e.caps.favourites||e.caps.stations))try{const c=(await D().status()).library;t===this.token&&(this.libAbsent=c.state==="unavailable"&&c.provider===e.music_provider)}catch{}if((e.caps.group||e.caps.transfer||e.kind==="group"||e.live.group.role!=="none")&&(r||this.polls++%kr===0||!this.devices))try{const{devices:c}=await D().list();t===this.token&&(this.devices=c)}catch{}const a=this.devices?B(e,this.devices):e;if(!he(e))if(e.caps.up_next&&L(e.live)){const c=e.live.now.title;if(r||c!==this.upNextTitle||Date.now()-this.upNextAt>=De){this.upNextTitle=c,this.upNextAt=Date.now();try{const u=await D().upNext(a.key);t===this.token&&(this.upNext=u)}catch(u){t===this.token&&A(u)!=="rate_limited"&&(A(u)==="no_library"&&(this.libAbsent=!0),this.upNext="error")}}}else L(e.live)||(this.upNextTitle=null);const l=fe(e,this.kindsOn);if(this.libTab===q&&ve(e))return;const d=ze(l,this.libTab===q?null:this.libTab);d&&(r||!this.lib[d])&&await this.loadLib(e.key,d,t)}async loadLib(e,t,r=this.token){try{const i=await D().library(e,t);r===this.token&&(this.lib={...this.lib,[t]:i})}catch(i){if(r!==this.token||A(i)==="rate_limited")return;A(i)==="no_library"&&(this.libAbsent=!0),this.lib={...this.lib,[t]:"error"}}}shake(){this.shaking=!0,window.setTimeout(()=>this.shaking=!1,260)}say(e,t=3600){this.notice=Array.isArray(e)?e:[e],window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice=[],t)}setPend(e,t){const r=new Set(this.pend);t?r.add(e):r.delete(e),this.pend=r}onError(e){if(e instanceof H&&(e.code==="rate_limited"||e.status===429)){this.shake();return}this.say(e instanceof H?ee(e):X);const t=A(e);t&&["screen_off","unavailable","not_found","caps_unknown","unknown_item","not_playing"].includes(t)&&this.refreshSoon(0),t==="unknown_item"&&(this.lib={})}askParty(e){return new Promise(t=>{this.partyAsk?.answer(!1),this.partyAsk={preview:e,answer:r=>{this.partyAsk=null,t(r)}}})}async exec(e,t=this.detail,r={},i=or(e)){if(!t)return!1;const s=this.gate.check(t,e);if(s==="dropped")return this.shake(),!1;if(s!=="send")return!1;const a=e.command==="power_on"||e.command==="power_off",l=ar(e,t.live,r);l&&this.setPend(i,!0);let d;try{d=await lt(t.key,e)}catch(c){this.setPend(i,!1),a&&this.gate.powerDone();const u=e.confirmed===!0?null:be(c);return u?await this.askParty(u)?this.exec({...e,confirmed:!0},t,r,i):!1:(this.onError(c),!1)}return d.status==="refused"?(this.setPend(i,!1),a&&this.gate.powerDone(),this.say(ee(new H(409,{code:d.error??"not_confirmed",user_message:X,retryable:!1,correlation_id:"",details:{}}))),this.refreshSoon(0),!1):!l||d.status==="sent"?(this.setPend(i,!1),a&&this.gate.powerDone(),this.refreshSoon(e.command==="volume_step"||e.command==="mute"?600:300),!0):this.confirmCmd(t.key,i,l,d.action_id,a)}async confirmCmd(e,t,r,i,s){const a=e===this.deviceKey,l=this.token,d=Date.now();for(;Date.now()-d<ct;){if(l!==this.token)return!1;try{const c=await D().get(e);if(l!==this.token)return!1;if(a&&this.applyDetail(c),r(c.live))return this.setPend(t,!1),s&&this.gate.powerDone(),this.seekDraft=null,a?this.loadSide(c,l,!1):this.refreshSoon(0),!0}catch{}if(i&&pt())try{const c=await dt(i);if(c.status==="failed"||c.status==="denied")break}catch{}await new Promise(c=>window.setTimeout(c,xr))}return l!==this.token||(this.setPend(t,!1),s&&this.gate.powerDone(),this.seekDraft=null,this.say(X),this.load(!1)),!1}transport(e){this.exec({command:"transport",action:e})}onShuffle(){const e=this.detail?.live;e&&this.exec({command:"shuffle",on:!(e.shuffle??!1)})}onRepeat(){const e=this.detail?.live;e&&this.exec({command:"repeat",mode:ut(e.repeat)})}deviceOf(e){return e===this.detail?.key?this.detail:this.devices?.find(t=>t.key===e)??null}async runGroupVolume(e,t){const r=this.detail;if(!r)return;const i=this.devices?B(r,this.devices):r;if($e(i)){if(!this.groupGap.take()){this.shake();return}this.setPend("gvol",!0);try{const s=await mt(i.key,e,t),a=await this.follow(s.bulk_id);a&&this.showRecord(a,!1)}catch(s){this.onError(s)}finally{this.setPend("gvol",!1),this.refreshSoon(0)}}}onMute(e){const t=this.deviceOf(e);t&&(async()=>{const r=t.live.volume.muted?ht(t):null;r!==null&&t.caps.volume_set&&!await this.exec({command:"volume_set",level:r},t,{},`vol:${e}`)||await this.exec({command:"mute",muted:!(t.live.volume.muted??!1)},t,{},`mute:${e}`)})()}onStepKey(e){const t=this.detail;if(!t)return;const r=e==="volup"?"up":"down",i=this.zone&&t.zones&&this.zone!==t.zones[0]?.id?this.zone:void 0;t.caps.volume_step&&this.exec({command:"volume_step",direction:r,...i?{zone:i}:{}},t,{},"step")}onItem(e){if(window.clearTimeout(this.longTimer),this.longFired){this.longFired=!1;return}this.exec({command:"play_item",item_ref:e.item_ref},this.detail,{itemName:e.name})}onBrowseItem(e){const t=e.enqueue==="play"?{command:"play_item",item_ref:e.item.item_ref}:{command:"play_item",item_ref:e.item.item_ref,enqueue:e.enqueue};this.exec(t,this.detail,e.enqueue==="play"?{itemName:e.item.name}:{},`item:${e.item.item_ref}`).then(r=>{r&&e.enqueue!=="play"&&this.say(e.enqueue==="next"?n("יתנגן אחרי הנוכחי"):n("נוסף לתור"),2e3)})}onTransfer(e){this.trMenu=!1,this.exec({command:"transfer",from_key:e.key})}tickRoom(e,t){!this.detail||this.joining.size||(this.draft.toggle(e,t),this.tick++,window.clearTimeout(this.joinTimer),this.joinTimer=window.setTimeout(()=>void this.flushJoin(),ft))}currentPlan(){const e=this.detail;if(!e||!this.devices)return null;const t=B(e,this.devices),r=re(t).filter(i=>i!==t.key);return Ht(t,r,this.draft.desired(r),this.devices)}async flushJoin(){const e=this.currentPlan();if(e){if(!e.diff.join.length&&!e.diff.leave.length){this.draft.clear(),this.tick++;return}if(e.needsConfirmation){this.confirm={plan:e,preview:null};return}await this.runJoin(e,!1)}}async runJoin(e,t){if(!this.detail)return;const i=e.after[0];this.joining=new Set([...e.diff.join,...e.diff.leave]),this.outcomes={};let s=!1;try{if(e.diff.leave.length){const a=await ge(e.diff.leave),l=await this.follow(a.bulk_id);l&&this.showRecord(l,!0)}if(e.diff.join.length)try{const a=await vt(i.key,e.diff.join,t),l=await this.follow(a.bulk_id);l&&this.showRecord(l,!0)}catch(a){const l=be(a);if(!l)throw a;s=!0,this.confirm={plan:e,preview:l}}}catch(a){this.onError(a)}finally{this.joining=new Set,s||(this.draft.clear(),this.tick++),this.load(!1)}}async onConfirm(){const e=this.confirm;this.confirm=null,e&&await this.runJoin(e.plan,!0)}onCancelConfirm(){this.confirm=null,this.draft.clear(),this.tick++}async onUngroup(){const e=this.detail;if(!e||!this.devices||this.joining.size)return;const t=B(e,this.devices),r=re(t).filter(i=>i!==t.key);if(r.length){this.joining=new Set(r),this.outcomes={};try{const i=await ge(r),s=await this.follow(i.bulk_id);s&&this.showRecord(s,!0)}catch(i){this.onError(i)}finally{this.joining=new Set,this.load(!1)}}}async follow(e){const t=this.token,r=Date.now();for(;Date.now()-r<$r;){if(t!==this.token)return null;try{const i=await D().groupRecord(e);if(i.status==="done")return i}catch{return null}await new Promise(i=>window.setTimeout(i,yr))}return null}showRecord(e,t){const r={},i=new Map;for(const a of[this.detail,...this.devices??[]])a&&i.set(a.key,a.area_name??a.name);for(const a of e.members)r[a.device_key]={outcome:a.outcome};this.outcomes=r;const s=Wt(e.members,i);s.length?this.say(s,6e3):t&&window.setTimeout(()=>this.outcomes={},6e3)}stepKeyOf(e){const t=e.composedPath()[0]?.closest?.("[data-key]");if(!t||t.hasAttribute("disabled"))return null;const r=t.dataset.key??"";return r==="volup"||r==="voldown"?r:null}render(){const e=this.detail,t=e?[e.area_name,e.floor_name].filter(Boolean).map(r=>v(r)).join(" · "):"";return o`<sw-drawer modal .open=${this.open} heading=${e?v(e.name):""} subheading=${t} @close=${this.onClose}>${e?this.headerPower(e):p}${this.body()}${this.dialog()}</sw-drawer>`}headerPower(e){if(ke(e)||P(e)==="unavailable"||E(e)||!e.caps.power_on&&!e.caps.power_off)return p;const t=ie(e)[0],r=Q(e,t?.id);if(r.action==="none")return p;const i=r.action==="off",s=this.pend.has("power");return o`<button type="button" slot="action" class=${k({hpw:!0,on:i})} data-pn-power=${r.action} aria-pressed=${String(i)} aria-label=${i?n("כבה"):n("הפעל")} title=${r.enabled?i?n("כבה"):n("הפעל"):n("אין הפעלה מרחוק")}
      ?disabled=${!r.enabled||s} @click=${()=>void this.exec({command:i?"power_off":"power_on"})}>${h("power")}${s?o`<span class="pendring"></span>`:p}</button>`}body(){const e=this.detail;if(!e)return this.phase==="error"?o`<div class="r" data-pn-state="error"><div class="errbox">${h("warning")}<b>${n("לא ניתן לטעון את הנגן")}</b><button type="button" class="btn" @click=${()=>void this.load(!0)}>${n("נסו שוב")}</button></div></div>`:o`<div class="r" data-pn-state="loading" aria-busy="true"><span class="skl" style="block-size:132px;border-radius:var(--sw-r-2xl)"></span><span class="skl" style="block-size:66px;border-radius:var(--sw-r-pill)"></span><span class="skl" style="block-size:44px"></span><span class="skl" style="block-size:160px;border-radius:var(--sw-r-xl)"></span></div>`;const t=P(e),r=ke(e);return o`<div class="r" data-pn data-pn-state=${t} data-pn-kind=${e.kind} ?data-view-only=${r} ?data-greyed=${E(e)} ?data-not-confirmed=${!e.live.confirmed}
      @pointerdown=${this.onDown} @click=${this.onClick} @keydown=${this.onKeyDown} @keyup=${this.onKeyUp}
      @pv-volume=${this.onVolume} @pv-group-volume=${this.onGroupVolume} @pv-equalize=${this.onEqualize} @pv-rooms=${i=>this.byRoom=i.detail.open}>
      <div class="notice" role="status" aria-live="polite" ?hidden=${!this.notice.length}>${this.notice.length?o`${h("warning")}<span data-pn-notice>${this.notice.length>1?o`<ul>${this.notice.map(i=>o`<li>${v(i)}</li>`)}</ul>`:v(this.notice[0])}</span>`:p}</div>
      ${t==="unavailable"?this.unavailableBody(e):e.kind==="receiver"?this.receiverBody(e,t,r):t==="off"?this.offBody(e,r):this.onBody(e,r)}
    </div>`}unavailableBody(e){const t=Ct(e);return o`<div class="roff" data-pn-unavailable>${h("wifiOff")}<b>${t.title}</b>${t.since?o`<small>${n("מאז")} <span class="n">${t.since}</span></small>`:p}</div>`}bigPower(e,t,r){const i=Q(e,r),s=this.pend.has(r?`power:${r}`:"power"),a=i.action==="on",l=t||i.action==="none"?n("כבוי"):i.enabled?n("הפעל"):n("אין הפעלה מרחוק");return!r&&!bt(e)?o`<div class="roff" data-pn-off data-pn-no-power>${h(e.kind==="player"?"playRect":"speaker")}<b>${n("כבוי")}</b></div>`:o`<div class="roff" data-pn-off>
      <button type="button" class=${k({bigpw:!0,pend:s})} data-pn-power=${a?"on":"none"} aria-label=${a?n("הפעל"):n("כבוי")} title=${l} ?disabled=${t||!a||!i.enabled||s}
        @click=${()=>void this.exec({command:"power_on",...r?{zone:r}:{}})}>${h("power")}${s?o`<span class="pendring"></span>`:p}</button>
      <b>${a&&i.enabled&&!t?n("הפעל"):n("כבוי")}</b></div>`}offBody(e,t){return o`${this.bigPower(e,t)}
      ${t?p:o`<div class="dimmed" aria-hidden="true" inert>${this.transportPad(e,e)}${this.volume(e,e,null)}</div>`}`}onBody(e,t){const r=this.devices??[],i=this.devices?B(e,r):e,s=L(e.live)||!L(i.live)?e:i;return t?o`${this.nowPlaying(e,s,i,!0)}${this.upNextBlock(e)}`:o`${this.nowPlaying(e,s,i,!1)}${this.transportPad(e,s)}${this.volume(e,i,r)}${this.transferBlock(e,r)}${this.upNextBlock(e)}${this.libraryBlock(e)}${this.groupBlock(e,i,r)}`}art(e){const t=O(e.hue),r=e.kind==="station";return o`<div class="thumb" style="--a1:${t.a1};--a2:${t.a2};--art:${t.rgb}" aria-hidden="true" data-pn-art=${r?"station":e.artwork?"image":"tile"}>
      ${e.artwork?o`<img src=${gt(e.artwork)} alt="" loading="lazy" />`:o`<span class="tile"></span>${j(r?"radio":e.glyph)}`}</div>`}nowPlaying(e,t,r,i){const s=t.live;if(!L(s))return o`<div class="idle" data-pn-idle>${h(e.kind==="player"?"playRect":e.kind==="group"?"group":"speaker")}<b>${n("לא מנגן")}</b></div>`;const a=s.now,l=Rt(e,e.live.group.role==="member"?r:null),d=Nt(t),c=this.seekDraft??Pe(s,this.nowMs),u=a.duration_s,g=jt(c,u),f=d==="live"?o`<div class="pprog" data-pn-live><span class="live"><i></i>${n("שידור חי")}</span></div>`:d==="none"?p:o`<div class="pprog" data-pn-progress><span class="tm n" data-pn-pos>${N(c)}</span>
          ${d==="seek"&&!i?o`<input class="rng seek" type="range" min="0" max="1000" step="1" .value=${String(Math.round(g*1e3))} style="--v:${Math.round(g*100)}%" aria-label=${n("מיקום בשיר")} data-pn-seek @input=${this.onSeekInput} @change=${this.onSeekChange} />`:o`<span class="bar" style="--p:${Math.round(g*100)}%"><i></i></span>`}
          <span class="tm n" data-pn-dur>${N(u)}</span></div>`;return o`<div class="npb" data-pn-now data-pn-now-kind=${a.kind}><div class="top">${this.art(a)}<div class="t"><small data-pn-word>${l}</small><b data-pn-title>${v(a.title)}</b>${a.artist?o`<span data-pn-artist>${v(a.artist)}</span>`:p}${a.album?o`<span class="al">${v(a.album)}</span>`:p}</div></div>${f}</div>`}transportPad(e,t){const r=Bt(e);if(!r.length)return p;const i=t.live.play==="playing",s=l=>this.pend.has(l),a=(l,d,c,u,g,f={})=>{const y=this.canSend(e,l);return o`<button type="button" class=${k({kb:!0,[u]:!0,pend:s(l==="play_pause"?"toggle":l)})} data-pn-tp=${l} aria-label=${c} title=${c}
        aria-pressed=${f.pressed===void 0?p:String(f.pressed)} ?disabled=${!y} @click=${g}><span class="kc">${h(d)}${f.one?o`<span class="one">1</span>`:p}${s(l==="play_pause"?"toggle":l)?o`<span class="pendring"></span>`:p}</span></button>`};return o`<div class=${k({tport:!0,shake:this.shaking})} role="group" aria-label=${n("ניגון")} data-pn-transport>${r.map(l=>{switch(l.id){case"shuffle":return a("shuffle","shuffle",e.live.shuffle?n("ביטול ערבוב"):n("ערבוב"),"side",()=>this.onShuffle(),{pressed:e.live.shuffle===!0});case"previous":return a("previous","prev",n("הקודם"),"",()=>this.transport("previous"));case"play_pause":return a("play_pause",i?"pause":"play",i?n("השהה"):n("נגן"),"main",()=>this.transport("play_pause"));case"next":return a("next","next",n("הבא"),"",()=>this.transport("next"));case"repeat":return a("repeat","repeat",Kt(e.live.repeat),"side",()=>this.onRepeat(),{pressed:e.live.repeat!==null&&e.live.repeat!=="off",one:e.live.repeat==="one"})}})}</div>`}canSend(e,t){if(P(e)!=="on")return!1;const r=t==="shuffle"?{command:"shuffle"}:t==="repeat"?{command:"repeat"}:{command:"transport",action:t};return!E(e)&&se(e,r)}volume(e,t,r){const i=r?ye(t,r):[],s=!!r&&Vt(t,i)&&(t.kind==="group"||e.live.group.role!=="none"),a=e.can.control&&!E(e);return s?o`<media-player-volume .group=${!0} .device=${t} .rooms=${i} .byRoom=${this.byRoom} .groupOffered=${$e(t)} .outcomes=${this.outcomes} .pend=${this.pend}
        .interactive=${a} .now=${this.clock()}></media-player-volume>`:!e.caps.volume_set&&!e.caps.volume_step&&!e.caps.mute?p:o`<media-player-volume .device=${e} .pend=${this.pend} .interactive=${a} .now=${this.clock()}></media-player-volume>`}transferBlock(e,t){const r=er(e,t);if(!tr(e,r))return p;const i=r.length===1,s=this.pend.has("transfer");return o`<div class="ctas" data-pn-transfer><button type="button" class=${k({btn:!0,quiet:!0,pend:s})} aria-haspopup=${i?"false":"menu"} aria-expanded=${i?p:String(this.trMenu)} ?disabled=${s}
        @click=${()=>i?this.onTransfer(r[0]):this.trMenu=!this.trMenu}>${h("transfer")}${n("העבר את המוזיקה לכאן")}${i?o`<small>· ${n("מ{name}",{name:v(Z(r[0]))})}</small>`:p}${s?o`<span class="pendring" style="inset:-4px;border-radius:var(--sw-r-pill)"></span>`:p}</button>
      ${!i&&this.trMenu?o`<div class="pop" role="menu">${r.map(a=>o`<button type="button" role="menuitem" data-pn-transfer-from=${a.key} @click=${()=>this.onTransfer(a)}><span class="gi" style=${`--a1:${O(a.live.now.hue).a1};--a2:${O(a.live.now.hue).a2}`}>${j(a.live.now.kind==="station"?"radio":a.live.now.glyph)}</span>${v(Z(a))}<span class="cnt">${v(a.live.now.title)}</span></button>`)}</div>`:p}</div>`}upNextBlock(e){if(he(e)&&!this.libAbsent&&e.live.caps_known)return o`<media-queue-list .deviceKey=${e.key} .canEdit=${!!e.can.queue&&!E(e)} .stamp=${e.live.now.title}></media-queue-list>`;const t=It(e,this.upNext,this.libAbsent);if(t.kind==="none")return p;const r=o`<div class="psh"><h4>${n("הבא בתור")}</h4>${t.kind==="rows"&&t.count?o`<small class="n">${t.count}</small>`:p}</div>`;return t.kind==="loading"?o`${r}<div class="uq" aria-busy="true" data-pn-upnext="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`:t.kind==="unavailable"?o`${r}<div class="uq" data-pn-upnext="unavailable"><div class="unav">${h("wifiOff")}${n("לא זמין")}</div></div>`:o`${r}<div class="uq" data-pn-upnext="rows">
      <div class="row cur"><span class="ix">${h(t.current.playing?"play":"pause")}</span><div class="t"><b>${v(t.current.name)}</b>${t.current.artist?o`<small>${v(t.current.artist)}</small>`:p}</div><span class="dur n">${t.current.duration_s?N(t.current.duration_s):""}</span></div>
      ${t.next?o`<div class="row" data-pn-next><span class="ix n">${t.next.index!==null?t.next.index+1:""}</span><div class="t"><b>${v(t.next.name)}</b>${t.next.artist?o`<small>${v(t.next.artist)}</small>`:p}</div><span class="dur n">${t.next.duration_s?N(t.next.duration_s):""}</span></div>`:p}
      ${t.more>0?o`<div class="umore" data-pn-more>${h("chevronDown")}${n("עוד")} <span class="n">${t.more}</span></div>`:p}</div>`}libraryBlock(e){if(this.libAbsent||!e.live.caps_known)return p;const t=fe(e,this.kindsOn),r=ve(e);if(!t.length&&!r)return p;const i=e.live.now.title,s=r&&(this.libTab===q||!t.length),a=s?null:ze(t,this.libTab===q?null:this.libTab),l=[...t.map(f=>({id:f,label:xt[f],attrs:{"data-pn-libtab":f}})),...r?[{id:q,label:wt,attrs:{"data-pn-libtab":q}}]:[]],d=f=>{if(f===q){this.libTab=q;return}const y=f;this.libTab=y,this.lib[y]||this.loadLib(e.key,y)},c=o`<sw-tabs controlled variant="pill" fill="always" group-label=${n("ספרייה")} data-pn-libtabs .items=${l} .active=${s?q:a??""}
      @change=${f=>{f.stopPropagation(),d(f.detail.id)}}></sw-tabs>`;if(s||a===null)return o`${c}<media-library-browse .deviceKey=${e.key} .canSearch=${!!e.caps.search} .canPlay=${e.can.control&&!E(e)} .enqueueOk=${J(e)}
        .pending=${this.pend} .current=${i} @play-item=${f=>this.onBrowseItem(f.detail)}></media-library-browse>`;const u=this.lib[a],g=u&&u!=="error"?u.items:null;return o`${c}
      ${g===null?u==="error"?o`<div class="libempty" data-pn-lib="error">${n("לא זמין")}</div>`:o`<div class="libg" aria-busy="true" data-pn-lib="loading"><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span><span class="skl skl-row"></span></div>`:g.length?o`<div class="libg" role="list" data-pn-lib=${a}>${V(g,f=>f.item_ref,f=>this.libItem(e,f,i))}</div>`:o`<div class="libempty" data-pn-lib="empty">${n("אין פריטים")}</div>`}`}libItem(e,t,r){const i=O(t.hue),s=this.pend.has(`item:${t.item_ref}`),a=e.can.control&&!E(e);return o`<button type="button" role="listitem" class=${k({libi:!0,pend:s})} data-pn-item=${t.item_ref} aria-current=${String(r!==null&&t.name===r)} ?disabled=${!a||s}
      title=${J(e)?n("נגן עכשיו · לחיצה ארוכה: אחרי הנוכחי"):n("נגן עכשיו")} @pointerdown=${()=>this.onItemDown(t)} @pointerup=${this.onItemUp} @pointerleave=${this.onItemUp} @pointercancel=${this.onItemUp} @click=${()=>this.onItem(t)}>
      <span class="gi" style="--a1:${i.a1};--a2:${i.a2};--art:${i.rgb}">${j(t.kind==="radio"?"radio":t.glyph,"ic")}</span>
      <span class="t"><b>${v(t.name)}</b>${t.artist?o`<small>${v(t.artist)}</small>`:p}</span></button>`}groupBlock(e,t,r){if(!this.devices)return p;if(t.live.group.conflict||e.live.group.conflict)return o`<div class="psh"><h4>${n("קבוצה")}</h4></div><div class="ckrow warn" role="status" data-pn-conflict>${h("warning")}<div class="nm"><b>${n("קיבוץ לא תואם")}</b><small>${n("מנהל יפרק אחת מהשכבות בהגדרות")}</small></div></div>`;const i=Yt(t,r);if(!Ft(t,i))return p;this.tick;const s=i.filter(a=>a.member).length;return o`<div class="psh"><h4>${n("קבוצה")}</h4>${s>1?o`<small data-pn-gcount>${n("{n} חדרים",{n:s})}</small>`:p}${s>1?o`<button type="button" class="lnk" data-pn-ungroup ?disabled=${this.joining.size>0} @click=${()=>void this.onUngroup()}>${n("פרק")}</button>`:p}</div>
      <div class="gsec" role="group" aria-label=${n("חדרים בקבוצה")} data-pn-group>${i.map(a=>{const l=this.draft.has(a.key),d=a.leader?!0:l?!a.member:a.member,c=this.outcomes[a.key]?.outcome,u=c==="not_joined"||c==="unknown"||c==="not_allowed",g=a.leader?t:r.find(K=>K.key===a.key),f=c&&c!=="joined"&&c!=="left"?o`<small class=${u?"bad":"ok"} data-pn-gout=${c}>${c==="not_joined"?n("לא הצטרף"):c==="unknown"?n("לא ידוע"):c==="not_allowed"?n("אין הרשאה"):""}</small>`:o`<small>${v(a.sub)}</small>`,y=l||this.joining.has(a.key),R=a.playing?O(a.playing.hue):null;return o`<button type="button" class=${k({ckrow:!0,lead:a.leader})} role="checkbox" aria-checked=${String(d)} data-pn-room=${a.key} ?disabled=${a.leader||!g||this.joining.size>0}
          @click=${()=>this.tickRoom(a.key,a.member)}><span class="ck">${h("check")}${y?o`<span class="pendring"></span>`:p}</span><div class="nm"><b>${v(a.name)}</b>${f}</div>
          ${a.playing&&R?o`<span class="gi" style="--a1:${R.a1};--a2:${R.a2}">${j(a.playing.glyph,"ic")}</span>`:p}</button>`})}</div>`}dialog(){const e=this.partyAsk;if(e)return o`<sw-dialog open heading=${n("לשלוט ב־{n} חדרים יחד?",{n:e.preview.devices})} data-pn-dialog="party" @close=${s=>{s.stopPropagation(),e.answer(!1)}}>
        <div class="cd">${e.preview.floors>1?o`<p class="cd-line">${n("הקבוצה משמיעה ב־{n} קומות.",{n:e.preview.floors})}</p>`:p}
          <details data-pn-details><summary>${n("פרטים")}</summary><ul>${we(e.preview).map(s=>o`<li>${v(s)}</li>`)}</ul></details></div>
        <sw-button slot="footer" data-pn-cancel @click=${()=>e.answer(!1)}>${n("ביטול")}</sw-button>
        <sw-button slot="footer" variant="primary" data-pn-confirm @click=${()=>e.answer(!0)}>${n("בצע")}</sw-button></sw-dialog>`;const t=this.confirm;if(!t)return p;const r=Jt(t.preview,t.plan),i=t.preview?we(t.preview):t.plan.after.map(s=>s.name);return o`<sw-dialog open heading=${r.question} data-pn-dialog="confirm" @close=${s=>{s.stopPropagation(),this.onCancelConfirm()}}>
      <div class="cd">${r.line?o`<p class="cd-line">${r.line}</p>`:p}
        <details data-pn-details><summary>${n("פרטים")}</summary><ul>${i.map(s=>o`<li>${v(s)}</li>`)}</ul></details></div>
      <sw-button slot="footer" data-pn-cancel @click=${()=>this.onCancelConfirm()}>${n("ביטול")}</sw-button>
      <sw-button slot="footer" variant="primary" data-pn-confirm @click=${()=>void this.onConfirm()}>${n("צרף")}</sw-button></sw-dialog>`}sourceIcon(e){const t=e.id.toLowerCase();return t.includes("bluetooth")?"bt":t.includes("tuner")||t.includes("radio")?"radio":t==="tv"?"tv":e.glyph==="speaker"?"speaker":"hdmi"}receiverBody(e,t,r){const i=ie(e),s=i.length?(i.find(c=>c.id===this.zone)??i[0]).id:"",a=i.length?I(e,s):null,l=!!a&&!a.main,d=i.length>1?o`<sw-tabs controlled variant="pill" fill="always" group-label=${n("אזור")} data-pn-zones .active=${s}
          .items=${i.map(c=>({id:c.id,label:c.name,pill:c.main?void 0:c.power==="on"?n("פועל"):n("כבוי"),attrs:{"data-pn-zone":c.id}}))}
          @change=${c=>{c.stopPropagation(),this.zone=c.detail.id}}></sw-tabs>`:p;return r?o`${d}<div class="roff" data-pn-viewonly>${h("receiver")}<b>${l?a?.power==="on"?n("פועל"):n("כבוי"):t==="on"?e.live.now.label||n("דולק"):n("כבוי")}</b></div>`:!l&&t==="off"?o`${d}${this.bigPower(e,r)}<div class="dimmed" aria-hidden="true" inert>${this.receiverControls(e,null)}</div>`:l&&a&&a.power!=="on"?o`${d}${this.bigPower(e,r,s)}<div class="dimmed" aria-hidden="true" inert>${this.receiverControls(e,s)}</div>`:o`${d}${l?this.zonePower(e,a):p}${this.receiverControls(e,l?s:null)}`}zonePower(e,t){const r=Q(e,t.id);if(r.action==="none")return p;const i=r.action==="off",s=this.pend.has(`power:${t.id}`);return o`<div class="rzone"><button type="button" class=${k({hpw:!0,on:i,"zone-pw":!0})} data-pn-zone-power=${r.action} aria-pressed=${String(i)} aria-label=${`${i?n("כבה"):n("הפעל")} · ${t.name}`} ?disabled=${!r.enabled||s}
      @click=${()=>void this.exec({command:i?"power_off":"power_on",zone:t.id})}>${h("power")}${s?o`<span class="pendring"></span>`:p}</button></div>`}receiverControls(e,t){const r=t?I(e,t):null,i=r&&!r.main?r.source_id:e.live.now.source_id,s=r&&!r.main?r.sound_mode:e.live.sound_output,a=e.can.control&&!E(e),l=e.can.power&&e.caps.sources&&!E(e),d=e.sources.length&&e.caps.sources?o`<div class="psh"><h4>${r&&!r.main?n("מקור · {zone}",{zone:r.name}):n("מקורות")}</h4></div><div class="srcg" role="radiogroup" aria-label=${n("מקורות")} data-pn-sources>${e.sources.map(g=>{const[f,y]=g.label.split(" · "),R=g.id===i,K=this.pend.has(`src:${g.id}`);return o`<button type="button" class="srci" role="radio" aria-checked=${String(R)} data-pn-source=${g.id} ?disabled=${!l||K}
            @click=${()=>void this.exec({command:"source",source_id:g.id,...r&&!r.main?{zone:r.id}:{}})}>
            <span class="gi src">${h(this.sourceIcon(g))}</span><span><bdi>${f}</bdi>${y?o`<small>${v(y)}</small>`:p}</span>${R&&!K?o`<span class="ck">${h("check")}</span>`:p}${K?o`<span class="pendring" style="inset:8px;inset-inline-start:auto;inline-size:18px;block-size:18px;border-width:2px"></span>`:p}</button>`})}</div>`:p,c=!(r&&!r.main)&&e.caps.sound_outputs.length&&e.can.power?o`<div class="psh"><h4>${n("מצב שמע")}</h4>${e.caps.sound_outputs.length>4?o`<small class="n">${e.caps.sound_outputs.length}</small>`:p}</div><div class="modes" role="radiogroup" aria-label=${n("מצב שמע")} data-pn-modes>${e.caps.sound_outputs.map(g=>{const f=g===s,y=this.pend.has(`mode:${g}`);return o`<button type="button" class="srci" role="radio" aria-checked=${String(f)} data-pn-mode=${g} ?disabled=${E(e)||y} @click=${()=>void this.exec({command:"sound_output",output:g})}>${v(g)}${f?o`<span class="ck">${h("check")}</span>`:p}</button>`})}</div>`:p,u=e.caps.volume_set||e.caps.volume_step||e.caps.mute?o`<media-player-volume .device=${e} .zone=${r&&!r.main?r.id:null} .pend=${this.pend} .interactive=${a} .now=${this.clock()}></media-player-volume>`:p;return o`${u}${d}${c}`}};b.styles=[dr,le,F,oe];w([x({attribute:"device-key"})],b.prototype,"deviceKey",2);w([x({type:Boolean,reflect:!0})],b.prototype,"open",2);w([x()],b.prototype,"scheme",2);w([x({attribute:!1})],b.prototype,"clock",2);w([m()],b.prototype,"detail",2);w([m()],b.prototype,"phase",2);w([m()],b.prototype,"devices",2);w([m()],b.prototype,"upNext",2);w([m()],b.prototype,"libAbsent",2);w([m()],b.prototype,"lib",2);w([m()],b.prototype,"kindsOn",2);w([m()],b.prototype,"libTab",2);w([m()],b.prototype,"pend",2);w([m()],b.prototype,"notice",2);w([m()],b.prototype,"shaking",2);w([m()],b.prototype,"byRoom",2);w([m()],b.prototype,"zone",2);w([m()],b.prototype,"outcomes",2);w([m()],b.prototype,"joining",2);w([m()],b.prototype,"tick",2);w([m()],b.prototype,"confirm",2);w([m()],b.prototype,"partyAsk",2);w([m()],b.prototype,"trMenu",2);w([m()],b.prototype,"seekDraft",2);w([m()],b.prototype,"nowMs",2);b=w([Y("media-player-panel")],b);export{Br as A,Sr as B,jr as C,Dr as D,dr as E,te as I,Dt as K,Er as N,qr as S,Tr as X,_r as a,Xr as b,O as c,$t as d,Vr as e,Lr as f,kt as g,Fr as h,_t as i,Ir as j,xe as k,Or as l,N as m,Ur as n,Pr as o,Yr as p,Rr as q,le as r,Qr as s,Hr as t,Gr as u,Kr as v,Ar as w,Cr as x,Nr as y,Mr as z};
