"""Semantic draft predicates. No schedule/program activation or hardware calls."""
from datetime import date
import re

from .validation import Refusal

DAYS=('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')


def normalize_schedule(data):
    def text(value):
        if type(value) is not str or not 1<=len(value)<=32 or any(ord(c)<32 for c in value) or not value.strip():raise Refusal()
        return value.strip()
    def minute(value,end=False):
        if end and value=='24:00':return 1440
        if type(value) is not str or not re.fullmatch(r'(?:[01][0-9]|2[0-3]):[0-5][0-9]',value):raise Refusal()
        a,b=value.split(':');return int(a)*60+int(b)
    def periods(items):
        if type(items) is not list or len(items)>8:raise Refusal()
        result=[]
        for item in items:
            if type(item) is not dict or set(item)!={'start','end'} or minute(item['start'])>=minute(item['end'],True):raise Refusal()
            result.append(dict(item))
        result.sort(key=lambda p:p['start'])
        if any(minute(a['end'],True)>minute(b['start']) for a,b in zip(result,result[1:])):raise Refusal()
        return result
    def day(value):
        if type(value) is not str or re.fullmatch('[0-9]{4}-[0-9]{2}-[0-9]{2}',value) is None:raise Refusal()
        try:parsed=date.fromisoformat(value)
        except ValueError:raise Refusal() from None
        if not 2000<=parsed.year<=2037:raise Refusal()
        return parsed
    if type(data) is not dict or set(data)!={'name','weekly','holidays'}:raise Refusal()
    name=text(data['name']);weekly=data['weekly'];holidays=data['holidays']
    if type(weekly) is not dict or set(weekly)!=set(DAYS):raise Refusal()
    week={d:periods(weekly[d]) for d in DAYS}
    if type(holidays) is not list or len(holidays)>64:raise Refusal()
    normalized=[]
    for holiday in holidays:
        if type(holiday) is not dict or set(holiday)!={'name','start','end','periods'}:raise Refusal()
        start,end=day(holiday['start']),day(holiday['end'])
        if start>end:raise Refusal()
        normalized.append({'name':text(holiday['name']),'start':start.isoformat(),'end':end.isoformat(),'periods':periods(holiday['periods'])})
    normalized.sort(key=lambda h:h['start'])
    if any(a['end']>=b['start'] for a,b in zip(normalized,normalized[1:])):raise Refusal()
    return {'name':name,'weekly':week,'holidays':normalized}
