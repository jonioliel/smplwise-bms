import{a as c,e as o,qH as m,E as p,H as l}from"./index-TwIAG38v.js";import"./sw-logo-art-Va6y_cIM.js";var b=Object.getOwnPropertyDescriptor,u=(s,e,d,n)=>{for(var a=n>1?void 0:n?b(e,d):e,r=s.length-1,i;r>=0;r--)(i=s[r])&&(a=i(a)||a);return a};const v=[{mode:"סקירה ומצלמות",items:[{sc:"SC01",name:"סקירה (Dashboard)",route:"#/live",phase:"PILOT",board:"1:01 · 2:15"},{sc:"SC07",name:"כל המצלמות (Grid)",route:"#/live/wall",phase:"PILOT",board:"1:06"},{sc:"SC08",name:"מצלמה בודדת",route:"#/live/cameras/cam-4",phase:"PILOT",board:"1:05"},{sc:"SC09",name:"תצוגות שמורות",route:"#/live/views",phase:"PILOT",board:"legacy"},{sc:"SC27",name:"בריאות מצלמות",route:"#/system/devices",phase:"PILOT",board:"2:12"},{sc:"SC31",name:"קיוסק / תצוגת קיר",route:"#/kiosk/all",phase:"BETA",board:"3:24"}]},{mode:"אתרים ומפות",items:[{sc:"SC02",name:"אתרים ומבנים",route:"#/explore/sites",phase:"PILOT",board:"1:02 · 3:17"},{sc:"SC03",name:"דפדפן קומות",route:"#/explore/buildings/bld-a/floors",phase:"PILOT",board:"1:03"},{sc:"SC04",name:"מפת קומה חיה",route:"#/explore/floors/f0",phase:"PILOT",board:"1:04"},{sc:"SC05",name:"ייבוא ותיקון תוכנית",route:"#/explore/floors/f-2/import",phase:"PILOT",board:"2:13"},{sc:"SC06",name:"עורך תוכנית ועוגנים",route:"#/explore/floors/f0/edit",phase:"PILOT",board:"2:13"},{sc:"SC10",name:"קטלוג ההתקנים",route:"#/system/entities",phase:"PILOT",board:"new"}]},{mode:"אבטחה · אזעקה",items:[{sc:"SC34",name:"אזעקה: לוח, חיישנים ועקיפה",route:"#/security/alarm",phase:"BETA",board:"CR-010"}]},{mode:"WisKey",items:[{sc:"SC23",name:"WisKey · מרכז הכניסה",route:"#/wiskey/overview",phase:"V1",board:"3:18"}]},{mode:"חשמל והתקנים",items:[{sc:"SC32",name:"חשמל והתקנים · המבנה",route:"#/devices/building",phase:"BETA",board:"CR-007:1"},{sc:"SC33",name:"חשמל והתקנים · אזור",route:"#/devices/areas/unassigned",phase:"BETA",board:"CR-007:2"}]},{mode:"אירועים והקלטות",items:[{sc:"SC14",name:"מרכז אירועים",route:"#/investigate/events",phase:"PILOT",board:"1:08"},{sc:"SC12",name:"הקלטות / ציר זמן",route:"#/investigate/playback",phase:"PILOT",board:"1:07 · 2:16"},{sc:"SC13",name:"מרכז שליטה / ניגון מסונכרן",route:"#/investigate/playback/sync",phase:"BETA",board:"2:14"},{sc:"SC11",name:"מפה היסטורית",route:"#/investigate/floors/f0/history",phase:"PILOT",board:"new"},{sc:"SC15",name:"סקירה",route:"#/investigate/reviews",phase:"BETA",board:"legacy"},{sc:"SC16",name:"תיקים",route:"#/investigate/cases",phase:"BETA",board:"2:10"},{sc:"SC17",name:"סקירת אירוע / תיק",route:"#/investigate/cases/case-1",phase:"BETA",board:"2:10"},{sc:"SC18",name:"ייצוא והורדות",route:"#/investigate/exports",phase:"BETA",board:"2:10"},{sc:"SC19",name:"חיפוש AI",route:"#/investigate/search",phase:"BETA",board:"2:09"},{sc:"SC21",name:"התראות וחוקים",route:"#/investigate/rules",phase:"BETA",board:"3:19"},{sc:"SC22",name:"עורך חוק",route:"#/investigate/rules/r-1",phase:"BETA",board:"3:19"}]},{mode:"הגדרות",items:[{sc:"SC28",name:"הגדרות המערכת",route:"#/system/diagnostics",phase:"PILOT",board:"3:23"},{sc:"SC24",name:"משתמשים והרשאות",route:"#/system/access",phase:"PILOT",board:"3:20"},{sc:"SC25",name:"יומן אודיט",route:"#/system/audit",phase:"PILOT",board:"3:21"},{sc:"SC20",name:"אנליטיקת אחסון",route:"#/system/storage",phase:"BETA",board:"2:11"},{sc:"SC26",name:"אשף התקנה",route:"#/system/wizard",phase:"PILOT",board:"3:22"},{sc:"SC26b",name:"מוכנות ההתקנה",route:"#/system/readiness",phase:"PILOT",board:"CR-READY96"}]}],h={PILOT:"live",BETA:"recorded",V1:"neutral"};let t=class extends c{render(){return o`
      <sw-page heading="כל המסכים (סקירת עיצוב)" subheading="29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים">
        <div class="note">כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.</div>
        <div class="groups">
          ${v.map(s=>o`<sw-card heading=${s.mode}>
              ${s.items.map(e=>o`<a href=${e.route}><span class="sc">${e.sc}</span><span class="name">${e.name}</span><span class="board">${e.board}</span><sw-badge kind=${h[e.phase]} label=${e.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`)}
        </div>
      </sw-page>
    `}};t.styles=[m,p`
    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 12px;
      align-items: start;
    }
    a {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 0;
      border-block-end: 1px solid var(--sw-border);
      color: var(--sw-text);
      text-decoration: none;
      font-size: var(--sw-fs-sm);
    }
    a:last-child {
      border-block-end: 0;
    }
    a:hover {
      color: var(--sw-accent-text);
    }
    .sc {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      inline-size: 40px;
    }
    .name {
      flex: 1;
    }
    .board {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      direction: ltr;
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
  `];t=u([l("screens-index")],t);export{t as ScreensIndex};
//# sourceMappingURL=screens-index-O50WDXSg.js.map
