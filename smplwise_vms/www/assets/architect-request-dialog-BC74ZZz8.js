import{E as m,F as h,G as w,a as x,A as b,e as l,H as v}from"./index-DmgaojPZ.js";const y=`בקשה לתוכניות מהאדריכל – מערכת ניהול ובקרה (SmplWise Arx)

שלום,

אנחנו מטמיעים במבנה מערכת ניהול ובקרה (מצלמות, תאורה, חשמל, גישה) שעובדת על גבי תוכניות המבנה.
המערכת מזהה אוטומטית קירות, דלתות, חלונות וחדרים מתוך קובץ שרטוט. ככל שהקבצים נקיים ומדויקים יותר,
כך נחסוך עבודה ידנית וטעויות. נשמח לקבל את הקבצים הבאים, לפי סדר העדיפויות.

────────────────────────
א. חובה – בלי אלה אי אפשר להתחיל
────────────────────────

1. תוכנית קומה אדריכלית, לכל קומה בנפרד (כולל מרתף, גג, וחצר/פיתוח אם יש):
   קירות, דלתות, חלונות, מדרגות, ושם ומספר לכל חדר.
   • פורמט מועדף: DXF (גרסת AutoCAD 2010 ומעלה). קובץ נפרד לכל קומה.
   • לצידו: PDF וקטורי של אותה קומה, לבדיקה ולהשוואה.

2. לוח חדרים: מספר חדר, שם, שטח במ"ר, קומה, וגובה תקרה אם קיים.
   • פורמט: Excel / CSV / PDF.

3. גבהים ומפלסים:
   • גובה כל קומה (גובה נטו) ומפלס הרצפה של כל קומה ביחס ל־±0.00.
   • כל מקום שבו יש גובה כפול, מפלסי רצפה שונים באותה קומה, יציע, טריבונה, גלריה או מדרגות ארוכות –
     נא לסמן בחתך או בטבלה.
   • פורמט: טבלה או חתכים (PDF / DXF).

────────────────────────
ב. מומלץ מאוד
────────────────────────

4. תוכנית תאורה: מיקום גופי תאורה, מתגים, והחלוקה למעגלים או קבוצות (איזה גופים על איזה מתג).
5. תוכנית חשמל ותקשורת: לוח חשמל, שקעים, נקודות תקשורת, ואם תוכננו – מיקום מצלמות, נקודות גישה,
   אינטרקום וגלאי אזעקה.
6. חתכים וחזיתות: לפחות חתך אחד בכל חלק של המבנה שבו הגבהים שונים.
7. לוח דלתות וחלונות: סוג, רוחב, גובה וכיוון פתיחה.

────────────────────────
ג. אם קיים
────────────────────────

8. תוכנית פריסה / ריהוט (חשוב במיוחד באולמות, מוסדות, משרדים ובתי ספר).
9. תוכנית אתר / פיתוח: חצר, חניה, גדרות ושערים (חשוב למצלמות חוץ).
10. מודל BIM אם התוכניות נעשו ב־Revit או ב־ArchiCAD: קובץ IFC 4. (לשלב מאוחר, לא חובה.)
11. DWG: אפשר לשלוח, אבל DXF עדיף ויעבוד מיד.

────────────────────────
דרישות איכות לקבצי DXF / DWG
────────────────────────

• יחידות: מטרים (או ס"מ / מ"מ, אבל עם יחידות מוגדרות בקובץ). קנה מידה 1:1 במרחב המודל,
  בלי הקטנה ובלי קנה מידה בתוך בלוקים.
• אותה נקודת ייחוס ואותו כיוון (צפון) בכל הקומות, כדי שהקומות יישבו אחת על השנייה.
• שכבות מסודרות בשמות מקובלים, ועקביות בין הקומות. למשל:
  A-WALL קירות · A-DOOR דלתות · A-GLAZ חלונות · A-STRS מדרגות · A-FURN ריהוט · A-LITE תאורה ·
  A-AREA או ROOM חדרים · A-ANNO-TEXT טקסטים.
  (שמות שכבות בעברית מתקבלים גם הם, כל עוד הם עקביים.)
• קירות: קווים כפולים מקבילים או פוליליין סגור עם עובי. בלי קווים כפולים חופפים ובלי קירות שבורים
  להרבה קטעים קצרים.
• דלתות וחלונות: בלוקים (INSERT) בגודל אמיתי, בשכבות נפרדות, ואם אפשר – עם חיווי כיוון פתיחה.
• חדרים: פוליליין סגור בשכבה נפרדת, עם הטקסט של שם החדר.
• ניקוי הקובץ:
  – Purge לפני השליחה.
  – בלי קבצים מקושרים (XREF): נא לבצע Bind.
  – בלי אובייקטים תלת־ממדיים (3DSOLID) ובלי תמונות מוטמעות בקובץ התוכנית.
  – Hatch כבד, מידות וטקסטים בשכבות נפרדות, כדי שאפשר יהיה להסתיר אותם.
• קובץ כבד (מעל 50MB): נא לפצל לפי קומה.

────────────────────────
דרישות איכות ל־PDF ולתמונות
────────────────────────

• PDF: וקטורי, מיוצא ישירות ממערכת השרטוט (לא סריקה). קנה מידה 1:50 או 1:100, על A3 או A1,
  עם קנה המידה כתוב על הדף וקו מידה מדויק.
• אם יש רק סריקה או תמונה: PNG או JPG ברזולוציה של לפחות 300 DPI, ישרה (בלי סיבוב, עיוות או צל),
  עם מידה אחת ידועה לפחות (למשל קו מידה או רוחב דלת שמצוין עליה).
• לא לשלוח: צילומי מסך, תמונות מהטלפון, קבצים מוגנים בסיסמה, ותוכניות "לפני שינויים" ישנות.

────────────────────────
שמות קבצים ומידע נלווה
────────────────────────

• שם קובץ: ‏<שם הפרויקט>_קומה_<מספר>_<תיאור>.dxf
  לדוגמה: בית_לוי_קומה_0_תוכנית.dxf · בית_לוי_קומה_1_תאורה.dxf
• מספור קומות: ‏-1, 0, 1, 2 ... ונא לציין איזו קומה היא קומת הכניסה.
• נא לצרף הודעה קצרה עם: רשימת הקבצים, תאריך הגרסה (או מספר revision), כיוון הצפון,
  והאם בוצעו בבנייה שינויים לעומת התוכנית (as-made).

תודה רבה,
‏[שם · טלפון]
`,d="בקשה לאדריכל",g="בקשה_לאדריכל.txt",A=1800,T="הבקשה המלאה מצורפת";function E(e){return e.replace(/^﻿/,"").replace(/\r\n?/g,`
`).trimEnd()}const f=e=>e.split(`
`,1)[0].trim();function u(e){const t=encodeURIComponent(f(e)),n=`mailto:?subject=${t}&body=${encodeURIComponent(e.replace(/\n/g,`\r
`))}`;return n.length<=A?{href:n,full:!0}:{href:`mailto:?subject=${t}&body=${encodeURIComponent(T)}`,full:!1}}function _(e){const t=document.createElement("textarea");t.value=e,t.setAttribute("readonly",""),t.setAttribute("aria-hidden","true"),t.style.cssText="position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;opacity:0;pointer-events:none";const n=document.activeElement;document.body.append(t),t.select(),t.setSelectionRange(0,e.length);let o=!1;try{o=document.execCommand("copy")}catch{o=!1}return t.remove(),n?.focus?.({preventScroll:!0}),o}async function p(e,t={}){const n=t.clipboard===void 0?typeof navigator<"u"?navigator.clipboard:null:t.clipboard;if(n?.writeText)try{return await n.writeText(e),!0}catch{}const o=t.fallback??(typeof document<"u"?_:void 0);return o?o(e):!1}const R=e=>new Blob([e],{type:"text/plain;charset=utf-8"});var D=Object.defineProperty,$=Object.getOwnPropertyDescriptor,a=(e,t,n,o)=>{for(var i=o>1?void 0:o?$(t,n):t,r=e.length-1,c;r>=0;r--)(c=e[r])&&(i=(o?c(t,n,i):c(i))||i);return o&&i&&D(t,n,i),i};const k=E(y);let s=class extends x{constructor(){super(...arguments),this.open=!1,this.text=k,this.notice="",this.noticeTimer=0}disconnectedCallback(){super.disconnectedCallback(),window.clearTimeout(this.noticeTimer)}say(e){this.notice=e,window.clearTimeout(this.noticeTimer),this.noticeTimer=window.setTimeout(()=>this.notice="",3200)}async copy(){const e=await p(this.text);return this.say(e?"הועתק":"ההעתקה לא הצליחה: סמנו את הטקסט והעתיקו ידנית"),e}async share(){try{await navigator.share({title:f(this.text),text:this.text})}catch(e){e?.name!=="AbortError"&&this.copy()}}download(){const e=URL.createObjectURL(R(this.text)),t=document.createElement("a");t.href=e,t.download=g,t.hidden=!0,document.body.append(t),t.click(),t.remove(),window.setTimeout(()=>URL.revokeObjectURL(e),1e4)}async mail(){if(u(this.text).full)return;const e=await p(this.text);this.say(e?"הועתק: הדביקו את הבקשה בגוף המייל":"סמנו והעתיקו את הטקסט, ואז הדביקו בגוף המייל")}close(){this.open=!1,this.notice="",this.dispatchEvent(new CustomEvent("close",{bubbles:!0,composed:!0}))}render(){const e=typeof navigator<"u"&&typeof navigator.share=="function";return l`<sw-dialog wide ?open=${this.open} heading=${d} @close=${t=>{t.stopPropagation(),this.close()}}>
      <pre class="txt" dir="rtl" lang="he" tabindex="0" data-architect-text aria-label=${d}>${this.text}</pre>
      <div slot="footer" class="actions">
        <sw-button size="lg" variant="primary" icon="copy" data-architect-copy @click=${()=>void this.copy()}>העתק</sw-button>
        ${e?l`<sw-button size="lg" icon="share" data-architect-share @click=${()=>void this.share()}>שתף</sw-button>`:b}
        <sw-button size="lg" icon="download" data-architect-download @click=${()=>this.download()}>הורד כקובץ</sw-button>
        <a class="btn" href=${u(this.text).href} data-architect-mail @click=${()=>void this.mail()}><sw-icon name="mail" size=${18}></sw-icon>שלח במייל</a>
        <div class="notice" role="status" aria-live="polite" data-architect-notice>${this.notice}</div>
      </div>
    </sw-dialog>`}};s.styles=m`
    .txt {
      margin: 0;
      padding: 12px 14px;
      max-block-size: min(56dvh, 520px);
      overflow: auto;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font: inherit;
      font-size: var(--sw-fs-md);
      line-height: 1.7;
      color: var(--sw-text);
      background: var(--sw-surface-2);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      user-select: text;
      -webkit-user-select: text;
    }
    .txt:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
    }
    .notice {
      flex: 1 1 100%;
      min-block-size: 1.2em;
      font-size: var(--sw-fs-sm);
      color: var(--sw-success);
      font-weight: var(--sw-fw-semibold);
    }
    .notice:empty {
      display: none;
    }
    a.btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-block-size: 36px;
      padding-inline: 16px;
      border-radius: var(--sw-r-sm);
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      box-shadow: var(--sw-shadow-1);
      color: var(--sw-text);
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
      line-height: 1;
      text-decoration: none;
      white-space: nowrap;
    }
    a.btn:hover {
      background: var(--sw-surface-2);
    }
    a.btn:focus-visible {
      outline: 2px solid var(--sw-accent);
      outline-offset: 2px;
    }
    /* a finger needs 44px (the same rule as sw-button's lg size) */
    @media (max-width: 767px) and (pointer: coarse) {
      a.btn {
        min-block-size: 44px;
      }
    }
    @media (max-width: 520px) {
      .actions > * {
        flex: 1 1 calc(50% - 8px);
      }
      .actions > .notice {
        flex-basis: 100%;
      }
    }
  `;a([h({type:Boolean,reflect:!0})],s.prototype,"open",2);a([h()],s.prototype,"text",2);a([w()],s.prototype,"notice",2);s=a([v("architect-request-dialog")],s);function C(){let e=document.querySelector("architect-request-dialog");e||(e=document.createElement("architect-request-dialog"),document.body.append(e)),e.open=!0}export{C as o};
//# sourceMappingURL=architect-request-dialog-BC74ZZz8.js.map
