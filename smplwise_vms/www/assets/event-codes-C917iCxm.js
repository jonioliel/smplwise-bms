import{j as l,br as d,bt as u,bs as m,bu as f}from"./index-CVsAtsN7.js";const v=l`
  details.tech {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  details.tech > summary {
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    min-block-size: 28px;
    padding: 2px 4px;
    border-radius: var(--sw-r-xs);
    user-select: none;
    -webkit-user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  details.tech > summary::-webkit-details-marker {
    display: none;
  }
  details.tech > summary:focus-visible {
    outline: var(--sw-focus-w) solid var(--sw-focus);
    outline-offset: var(--sw-focus-offset);
  }
  details.tech > summary .grow {
    flex: 1;
  }
  details.tech .chev {
    flex: none;
    color: var(--sw-text-3);
    transform: rotate(-90deg);
    transition: transform var(--sw-t-fast) var(--sw-ease-out);
  }
  details.tech[open] > summary .chev {
    transform: rotate(90deg);
  }
  @media (hover: hover) and (pointer: fine) {
    details.tech > summary:hover {
      background: var(--sw-hover-wash);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    details.tech .chev {
      transition-duration: 0ms;
    }
  }
  details.tech .techbody {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-block-start: 4px;
    padding: 8px 12px;
    border-radius: var(--sw-r-sm);
    background: var(--sw-surface-2);
    line-height: 1.6;
  }
`,i={c_vmd:"זיהוי תנועה",c_motiondetection:"זיהוי תנועה",c_linedetection:"חציית קו",c_fielddetection:"חדירה לאזור",c_regionentrance:"כניסה לאזור",c_regionexiting:"יציאה מאזור",c_intrusion:"חדירה לאזור",c_videoloss:"אובדן וידאו",c_videolost:"אובדן וידאו",c_ipcdisconnect:"מצלמה התנתקה",c_shelteralarm:"הסתרת מצלמה",c_tamperdetection:"חבלה במצלמה",c_facedetection:"זיהוי פנים",c_humandetect:"זיהוי אדם",c_vehicledetection:"זיהוי רכב",c_io:"כניסת חיווי",c_diskfull:"דיסק מלא",c_diskerror:"שגיאת דיסק",c_nicbroken:"תקלת רשת",alertOf:"התראת {label}",p_device_offset:"שעון המכשיר, מתוקן להפרש",p_wall_clock:"שעון המכשיר כמו שהוא",p_received:"שעת הקליטה",p_recording_file:"לפי קובץ ההקלטה",p_keyframe_limited:"לפי פריים מפתח",p_verified:"מאומת",s_sec:"{s} שנ׳",s_min:"{m} דק׳",s_min_sec:"{m} דק׳ {s} שנ׳",s_hour:"{h} שע׳",s_hour_min:"{h} שע׳ {m} דק׳"},c=m("en","i18n/event-codes","en"),_={he:i,en:c};function n(e,t){return d(_[u(["en"])][e]??i[e],t)}const a=e=>Object.prototype.hasOwnProperty.call(i,e);function h(e){if(!e)return null;const t=`c_${e.trim().toLowerCase()}`;return a(t)?n(t):null}function b(e){if(!e)return null;const t=/^\s*([a-z]+)\s+alarm\s*$/i.exec(e);if(!t)return null;const s=t[1].toLowerCase()==="motion"?"vmd":t[1],r=h(s);return r?n("alertOf",{label:r}):null}function w(e){if(!e)return null;const t=`p_${e}`;return a(t)?n(t):null}function g(e,t){if(!t)return null;const s=Math.round((new Date(t).getTime()-new Date(e).getTime())/1e3);if(!Number.isFinite(s)||s<1)return null;if(s<60)return n("s_sec",{s});const r=Math.floor(s/60);if(r<60)return s%60?n("s_min_sec",{m:r,s:s%60}):n("s_min",{m:r});const o=Math.floor(r/60);return r%60?n("s_hour_min",{h:o,m:r%60}):n("s_hour",{h:o})}f("i18n/event-codes",{he:i,en:c});export{b as d,w as p,h as r,g as s,v as t};
