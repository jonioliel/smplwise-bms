import{i as m,dC as e,b as t,g as p,k as l}from"./index-BMsqo0rz.js";import{a as b}from"./settings-yylxou_W.js";import"./sw-logo-art-PLtEZJxU.js";var u=Object.getOwnPropertyDescriptor,v=(a,s,c,i)=>{for(var r=i>1?void 0:i?u(s,c):s,o=a.length-1,d;o>=0;o--)(d=a[o])&&(r=d(r)||r);return r};const h=[{mode:e("סקירה ומצלמות"),items:[{sc:"SC01",name:e("סקירה (Dashboard)"),route:"#/live",phase:"PILOT",board:"1:01 · 2:15"},{sc:"SC07",name:e("כל המצלמות (Grid)"),route:"#/live/wall",phase:"PILOT",board:"1:06"},{sc:"SC08",name:e("מצלמה בודדת"),route:"#/live/cameras/cam-4",phase:"PILOT",board:"1:05"},{sc:"SC09",name:e("תצוגות שמורות"),route:"#/live/views",phase:"PILOT",board:"legacy"},{sc:"SC27",name:e("בריאות מצלמות"),route:"#/system/devices",phase:"PILOT",board:"2:12"},{sc:"SC31",name:e("קיוסק / תצוגת קיר"),route:"#/kiosk/all",phase:"BETA",board:"3:24"}]},{mode:e("אתרים ומפות"),items:[{sc:"SC02",name:e("אתרים ומבנים"),route:"#/explore/sites",phase:"PILOT",board:"1:02 · 3:17"},{sc:"SC03",name:e("דפדפן קומות"),route:"#/explore/buildings/bld-a/floors",phase:"PILOT",board:"1:03"},{sc:"SC04",name:e("מפת קומה חיה"),route:"#/explore/floors/f0",phase:"PILOT",board:"1:04"},{sc:"SC05",name:e("ייבוא ותיקון תוכנית"),route:"#/explore/floors/f-2/import",phase:"PILOT",board:"2:13"},{sc:"SC06",name:e("עורך תוכנית ועוגנים"),route:"#/explore/floors/f0/edit",phase:"PILOT",board:"2:13"},{sc:"SC10",name:e("קטלוג ההתקנים"),route:"#/system/entities",phase:"PILOT",board:"new"}]},{mode:e("אבטחה · אזעקה"),items:[{sc:"SC34",name:e("אזעקה: לוח, חיישנים ועקיפה"),route:"#/security/alarm",phase:"BETA",board:"CR-010"}]},{mode:"WisKey",items:[{sc:"SC23",name:e("WisKey · מרכז הכניסה"),route:"#/wiskey/overview",phase:"V1",board:"3:18"}]},{mode:e("חשמל והתקנים"),items:[{sc:"SC32",name:e("חשמל והתקנים · המבנה"),route:"#/devices/building",phase:"BETA",board:"CR-007:1"},{sc:"SC33",name:e("חשמל והתקנים · אזור"),route:"#/devices/areas/unassigned",phase:"BETA",board:"CR-007:2"}]},{mode:e("אירועים והקלטות"),items:[{sc:"SC14",name:e("מרכז אירועים"),route:"#/investigate/events",phase:"PILOT",board:"1:08"},{sc:"SC12",name:e("הקלטות / ציר זמן"),route:"#/investigate/playback",phase:"PILOT",board:"1:07 · 2:16"},{sc:"SC13",name:e("מרכז שליטה / ניגון מסונכרן"),route:"#/investigate/playback/sync",phase:"BETA",board:"2:14"},{sc:"SC11",name:e("מפה היסטורית"),route:"#/investigate/floors/f0/history",phase:"PILOT",board:"new"},{sc:"SC15",name:e("סקירה"),route:"#/investigate/reviews",phase:"BETA",board:"legacy"},{sc:"SC16",name:e("תיקים"),route:"#/investigate/cases",phase:"BETA",board:"2:10"},{sc:"SC17",name:e("סקירת אירוע / תיק"),route:"#/investigate/cases/case-1",phase:"BETA",board:"2:10"},{sc:"SC18",name:e("ייצוא והורדות"),route:"#/investigate/exports",phase:"BETA",board:"2:10"},{sc:"SC19",name:e("חיפוש AI"),route:"#/investigate/search",phase:"BETA",board:"2:09"},{sc:"SC21",name:e("התראות וחוקים"),route:"#/investigate/rules",phase:"BETA",board:"3:19"},{sc:"SC22",name:e("עורך חוק"),route:"#/investigate/rules/r-1",phase:"BETA",board:"3:19"}]},{mode:e("הגדרות"),items:[{sc:"SC28",name:e("הגדרות המערכת"),route:"#/system/diagnostics",phase:"PILOT",board:"3:23"},{sc:"SC24",name:e("משתמשים והרשאות"),route:"#/system/access",phase:"PILOT",board:"3:20"},{sc:"SC25",name:e("יומן אודיט"),route:"#/system/audit",phase:"PILOT",board:"3:21"},{sc:"SC20",name:e("אנליטיקת אחסון"),route:"#/system/storage",phase:"BETA",board:"2:11"},{sc:"SC26",name:e("אשף התקנה"),route:"#/system/wizard",phase:"PILOT",board:"3:22"},{sc:"SC26b",name:e("מוכנות ההתקנה"),route:"#/system/readiness",phase:"PILOT",board:"CR-READY96"}]}],C={PILOT:"live",BETA:"recorded",V1:"neutral"};let n=class extends m{render(){return t`
      <sw-page heading=${e("כל המסכים (סקירת עיצוב)")} subheading=${e("29 מסכים על נתוני הדגמה · SC29/SC30 הם אותם מסכים ברוחב טלפון · SC32 (Lovelace) הוא עטיפה של אותם רכיבים")}>
        <div class="note">${e("כל מסך מסומן ״נתוני הדגמה״. שום זרם וידאו, תמונה או מצב מכשיר אינם אמיתיים כאן (הסצנות מאוירות); המטרה היא לאשר את השפה החזותית, הניווט והזרימות לפני החיבור לנתונים.")}</div>
        <div class="groups">
          ${h.map(a=>t`<sw-card heading=${a.mode}>
              ${a.items.map(s=>t`<a href=${s.route}><span class="sc">${s.sc}</span><span class="name">${s.name}</span><span class="board">${s.board}</span><sw-badge kind=${C[s.phase]} label=${s.phase}></sw-badge><sw-icon name="chevron" size=${12}></sw-icon></a>`)}
            </sw-card>`)}
        </div>
      </sw-page>
    `}};n.styles=[b,p`
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
  `];n=v([l("screens-index")],n);export{n as ScreensIndex};
