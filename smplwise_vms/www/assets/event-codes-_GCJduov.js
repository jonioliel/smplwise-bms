import{E as s}from"./index-BJCfUqyq.js";const d=s`
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
`,o={vmd:"זיהוי תנועה",motiondetection:"זיהוי תנועה",linedetection:"חציית קו",fielddetection:"חדירה לאזור",regionentrance:"כניסה לאזור",regionexiting:"יציאה מאזור",intrusion:"חדירה לאזור",videoloss:"אובדן וידאו",videolost:"אובדן וידאו",ipcdisconnect:"מצלמה התנתקה",shelteralarm:"הסתרת מצלמה",tamperdetection:"חבלה במצלמה",facedetection:"זיהוי פנים",humandetect:"זיהוי אדם",vehicledetection:"זיהוי רכב",io:"כניסת חיווי",diskfull:"דיסק מלא",diskerror:"שגיאת דיסק",nicbroken:"תקלת רשת"};function a(e){return e?o[e.trim().toLowerCase()]??null:null}function u(e){if(!e)return null;const i=/^\s*([a-z]+)\s+alarm\s*$/i.exec(e);if(!i)return null;const t=i[1].toLowerCase()==="motion"?"vmd":i[1],r=a(t);return r?`התראת ${r}`:null}const l={device_offset:"שעון המכשיר, מתוקן להפרש",wall_clock:"שעון המכשיר כמו שהוא",received:"שעת הקליטה",recording_file:"לפי קובץ ההקלטה",keyframe_limited:"לפי פריים מפתח",verified:"מאומת"};function f(e){return e?l[e]??null:null}function m(e,i){if(!i)return null;const t=Math.round((new Date(i).getTime()-new Date(e).getTime())/1e3);if(!Number.isFinite(t)||t<1)return null;if(t<60)return`${t} שנ׳`;const r=Math.floor(t/60);if(r<60)return t%60?`${r} דק׳ ${t%60} שנ׳`:`${r} דק׳`;const n=Math.floor(r/60);return r%60?`${n} שע׳ ${r%60} דק׳`:`${n} שע׳`}export{u as d,f as p,a as r,m as s,d as t};
//# sourceMappingURL=event-codes-_GCJduov.js.map
