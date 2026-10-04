"""fpdf2 fallback probe (CR-023 P0): one Hebrew RTL line block with text shaping. Fake data only."""
import json
import os
import time

from fpdf import FPDF
import fpdf

HERE = os.path.dirname(os.path.abspath(__file__))
t = time.perf_counter()
pdf = FPDF(format="A4")
pdf.add_page()
pdf.add_font("HeeboHe", fname=os.path.join(HERE, "fonts", "Heebo-he-400.ttf"))
pdf.add_font("HeeboLa", fname=os.path.join(HERE, "fonts", "Heebo-la-400.ttf"))
pdf.set_font("HeeboHe", size=14)
pdf.set_fallback_fonts(["HeeboLa"])
pdf.set_text_shaping(use_shaping_engine=True, direction="rtl", script="hebr", language="heb")
for line in ["חשבון צריכת חשמל ודרישת תשלום", "לכבוד: סטודיו אורן לעיצוב, מספר לקוח 0001",
             "תקופה: 01.09.2026 - 30.09.2026", "צריכה: 776.20 קוט״ש × 0.5430 ₪ = 421.48 ₪", "מע״מ 18%: 75.87 ₪, סה״כ: 497.35 ₪"]:
    pdf.cell(0, 10, line, new_x="LMARGIN", new_y="NEXT", align="R")
pdf.output(os.path.join(HERE, "fpdf-1p.pdf"))
print(json.dumps({"fpdf2": fpdf.__version__, "seconds": round(time.perf_counter() - t, 3)}))
