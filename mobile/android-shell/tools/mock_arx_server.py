"""Loopback-only Arx presence and push-relay fixture. Never prints credentials or sensor values."""
import argparse
import hashlib
import json
import math
import secrets
import threading
import uuid
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote
from mock_web_server import Handler as WebHandler, PAGE

PLACEHOLDER = 'טקסט ההודעה לעובדים יוזן בהגדרות המערכת.'
SENSORS = ('location', 'activity', 'steps', 'altitude', 'battery', 'network', 'beacon', 'app_state')
CATALOG = [
    {'key':'location','name_he':'מיקום','purpose_he':'נוכחות במבנה: כניסה ויציאה'},
    {'key':'activity','name_he':'פעילות','purpose_he':'זיהוי כללי של הליכה, ריצה, רכיבה או נסיעה'},
    {'key':'steps','name_he':'צעדים','purpose_he':'מספר צעדים ושינויי קומות בפרקי זמן מוגבלים'},
    {'key':'altitude','name_he':'שינוי גובה','purpose_he':'שינוי גובה יחסי, כרמז לשינוי קומה'},
    {'key':'battery','name_he':'סוללה','purpose_he':'אחוז סוללה, טעינה ומצב חיסכון בחשמל'},
    {'key':'network','name_he':'רשת ו-Wi-Fi','purpose_he':'סוג חיבור הרשת ו-Wi-Fi לפי ערך מגובב'},
    {'key':'beacon','name_he':'קרבה לנקודות בבניין','purpose_he':'קרבה יחסית למשואות שהוגדרו בשרת'},
    {'key':'app_state','name_he':'פעילות האפליקציה','purpose_he':'מצב חזית או רקע ומועד העדכון האחרון'},
]
CATEGORIES = [
    {'id':'safety','name':'בטיחות','critical':True}, {'id':'alerts','name':'התראות','critical':False},
    {'id':'doors','name':'דלתות','critical':False}, {'id':'device_faults','name':'תקלות במכשירים','critical':False},
    {'id':'automations','name':'אוטומציות','critical':False}, {'id':'system','name':'מערכת','critical':False},
    {'id':'security','name':'אבטחה','critical':False},
]

class State:
    def __init__(self, enabled=False, notice=PLACEHOLDER):
        self.lock = threading.RLock()
        self.enabled = enabled
        self.notice = notice
        self.version = 1
        self.allowed = []
        self.intervals = {'battery':900,'steps':300,'app_state':300}
        self.sites = []
        self.beacons = []
        self.wifi_sites = []
        self.required_enabled = False
        self.required = []
        self.server_id = 'fixture-server'
        self.devices = {}
        self.tokens = {}
        self.event_ids = set()
        self.messages = {}
        self.relay_tokens = {}
        self.relay_push_tokens = {}

class Handler(WebHandler):
    state = State()
    server_version = 'LocalFixture/1'
    def log_message(self, *_):
        return
    def json_response(self, code, body):
        data = json.dumps(body, ensure_ascii=False, separators=(',',':')).encode()
        self.send_response(code); self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def failure(self, code, reason, details=None, message='בקשת הבדיקה לא הושלמה.'):
        self.json_response(code, {'code':reason,'user_message':message,'retryable':code>=500,'correlation_id':'fixture','details':details or {}})
    def body(self):
        try: length=int(self.headers.get('Content-Length','0'))
        except ValueError: raise ValueError()
        limit=2048 if self.path.startswith('/v1/') else 65536
        if length < 0 or length > limit: raise ValueError()
        value=json.loads(self.rfile.read(length) or b'{}')
        if not isinstance(value,dict): raise ValueError()
        return value
    def user(self):
        for item in self.headers.get('Cookie','').split(';'):
            if item.strip().startswith('fixture_user='):
                value=item.strip().split('=',1)[1]
                if value in ('fixture-a','fixture-b','fixture-admin') or (value.startswith('fixture-') and len(value) == 44 and all(c in '0123456789abcdef-' for c in value[8:])): return value
        return None
    def bearer(self):
        value=self.headers.get('Authorization','')
        return value[7:] if value.startswith('Bearer ') else ''
    def device(self):
        if self.headers.get('Cookie'):
            return None
        token=self.bearer()
        if not token.startswith('arxd_'): return None
        key=hashlib.sha256(token.encode()).hexdigest()
        return self.state.devices.get(self.state.tokens.get(key))
    def require_device(self, device_id=None):
        device=self.device()
        if device and device_id and device['device_id'] != device_id:
            self.failure(404,'not_found'); return None
        if not device:
            self.failure(401,'device_token_invalid',message='רישום המכשיר אינו תקף. יש לרשום את המכשיר מחדש.')
            return None
        return device
    def do_GET(self):
        path=self.path.split('?',1)[0]
        with self.state.lock:
            if path in ('/arx/','/arx'):
                controls='''<!doctype html><html lang="he" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>*{box-sizing:border-box}body{font:18px system-ui;background:#f5f7fb;color:#1b2233;margin:0;padding:24px;width:100%;overflow-wrap:anywhere}button{display:block;width:100%;padding:14px;margin:12px 0;background:#2f6bff;color:white;border:0;border-radius:14px}pre{white-space:pre-wrap}</style><h1>SmplWise Arx</h1><p>בדיקה מקומית בלבד · נתונים סינתטיים</p><button onclick="document.cookie='fixture_user=fixture-a; Path=/arx/; SameSite=Strict';ArxApp.signedIn({user_id:'fixture-a',display_name:'Synthetic user'})">כניסת משתמש בדיקה</button><button onclick="ArxApp.openSensorSettings()">נתונים שהמכשיר משתף</button><button onclick="ArxApp.deviceStatus().then(s=>document.getElementById('device-status').textContent=JSON.stringify(s))">מצב המכשיר</button><button onclick="ArxApp.signedOut();document.cookie='fixture_user=; Path=/arx/; Max-Age=0'">התנתקות</button><button onclick="ArxApp.switchServer()">שרתים</button><pre id="device-status"></pre><script>if(document.cookie.includes('fixture_user=')){ArxApp.signedIn({user_id:'fixture-a'});}</script></html>'''
                self.respond(200, controls.encode(), 'text/html; charset=utf-8')
                return
            if path == '/arx/api/v1/presence/config':
                state=self.state; device=self.device(); user=self.user()
                if self.headers.get('Authorization') and not device: return self.failure(401,'device_token_invalid')
                if not device and not user: return self.failure(401,'not_authenticated')
                active=state.enabled
                payload={'enabled':active,'mode':'continuous','interval_s':60,'distance_filter_m':50,'notice_version':state.version,'notice_text':state.notice,
                    'sites':state.sites if active else [],
                    'sensors':{'allowed':state.allowed if active else [],'intervals_s':state.intervals,'catalog':CATALOG},
                    'beacons':state.beacons if active else [],'wifi_sites':state.wifi_sites if active else [],
                    'required_sensors':{'enabled':bool(active and state.required_enabled),'sensors':state.required if active and state.required_enabled else []},
                    'server_id':state.server_id}
                if device: payload['device']={'device_id':device['device_id'],'name':device['name'],'notice_ack_version':device['ack']}
                return self.json_response(200,payload)
            if path in ('/arx/api/v1/presence/gate','/arx/api/v1/me'):
                user=self.user()
                if not user: return self.failure(401,'not_authenticated')
                gate=self.gate(user)
                return self.json_response(200,{'user_id':user,'presence_gate':gate} if path.endswith('/me') else gate)
            if path == '/arx/api/v1/presence/devices/me':
                user=self.user()
                if not user: return self.failure(401,'not_authenticated')
                devices=[self.public_device(d) for d in self.state.devices.values() if d['user']==user]
                return self.json_response(200,{'devices':devices})
            if path.startswith('/arx/api/v1/presence/devices/') and path.endswith('/state'):
                return self.presence_device_route(path,'GET',{})
            if path == '/arx/api/v1/notifications/categories':
                if self.headers.get('Authorization') and not self.device(): return self.failure(401,'device_token_invalid')
                if not (self.device() or self.user()): return self.failure(401,'not_authenticated')
                return self.json_response(200,{'categories':CATEGORIES})
            if path.startswith('/arx/api/v1/notifications/app/'):
                device=self.require_device()
                if not device: return
                message_id=unquote(path.rsplit('/',1)[-1]); message=self.state.messages.get(message_id)
                if not message or message['device_id'] != device['device_id'] or datetime.fromisoformat(message['at'].replace('Z','+00:00')) < datetime.now(timezone.utc)-timedelta(hours=24): return self.failure(404,'not_found')
                return self.json_response(200,{k:v for k,v in message.items() if k!='device_id'})
        super().do_GET()
    def gate(self,user):
        state=self.state
        if user=='fixture-admin' or not state.required_enabled or not state.enabled:
            return {'required':state.required if state.enabled and state.required_enabled else [],'missing':[],'blocked':False,'applies':user!='fixture-admin','channel':'app','break_glass_until':None,'reason':None}
        live=[d for d in state.devices.values() if d['user']==user and d.get('revoked_at') is None]
        missing=[]
        for sensor in state.required:
            if not any(d['ack']==state.version and datetime.fromisoformat(d.get('last_seen_at','1970-01-01T00:00:00Z').replace('Z','+00:00')) > datetime.now(timezone.utc)-timedelta(hours=48) and d.get('status',{}).get('sensors',{}).get(sensor)=='on' and (sensor!='location' or (d.get('status',{}).get('sharing') is True and d.get('status',{}).get('location_auth') in ('always','when_in_use'))) for d in live): missing.append(sensor)
        return {'required':state.required,'missing':missing,'blocked':bool(missing),'applies':True,'channel':'app','break_glass_until':None,'reason':'missing_sensors' if missing else None}
    def public_device(self,d):
        return {k:v for k,v in d.items() if k not in ('device_token','token_hash','user','install')}
    def do_POST(self): self.mutate('POST')
    def do_PATCH(self): self.mutate('PATCH')
    def do_DELETE(self): self.mutate('DELETE')
    def mutate(self,method):
        try: body=self.body()
        except (ValueError,TypeError): return self.failure(400,'invalid_body')
        path=self.path.split('?',1)[0]
        with self.state.lock:
            # Fixture controls exist only on loopback and are never an Arx API.
            if path == '/fixture/config' and method=='POST':
                state=self.state
                old=(state.notice,state.allowed[:])
                state.enabled=body.get('enabled',False) is True
                if 'notice_text' in body: state.notice=str(body['notice_text'])
                if 'allowed' in body:
                    allowed=body['allowed']
                    if not isinstance(allowed,list) or any(k not in SENSORS for k in allowed): return self.failure(400,'invalid_sensor')
                    state.allowed=list(dict.fromkeys(allowed))
                if 'required_sensors' in body:
                    value=body['required_sensors']
                    if isinstance(value,dict): state.required_enabled=value.get('enabled') is True; state.required=value.get('sensors',[])
                    elif isinstance(value,list): state.required_enabled=bool(value); state.required=value
                    else: return self.failure(400,'invalid_required_sensors')
                    if any(k not in SENSORS for k in state.required): return self.failure(400,'invalid_required_sensors')
                if 'sites' in body: state.sites=body['sites']
                if 'beacons' in body: state.beacons=body['beacons']
                if 'wifi_sites' in body: state.wifi_sites=body['wifi_sites']
                if 'server_id' in body: state.server_id=str(body['server_id'])
                if old != (state.notice,state.allowed): state.version+=1
                return self.json_response(200,{'enabled':state.enabled,'notice_version':state.version})
            if path == '/fixture/revoke' and method=='POST':
                self.state.tokens.clear(); return self.json_response(200,{})
            if path == '/v1/register' and method=='POST':
                if body.get('platform') not in ('ios','android') or not isinstance(body.get('push_token'),str) or not body['push_token'] or not isinstance(body.get('bundle_id'),str): return self.failure(400,'invalid_push_token')
                push_hash=hashlib.sha256(body['push_token'].encode()).hexdigest()
                relay=next((t for t,h in self.state.relay_push_tokens.items() if h==push_hash),None)
                if not relay:
                    relay='rt_'+secrets.token_urlsafe(32); self.state.relay_tokens[hashlib.sha256(relay.encode()).hexdigest()]=body['platform']; self.state.relay_push_tokens[relay]=push_hash
                return self.json_response(200,{'relay_token':relay})
            if path == '/v1/register' and method=='DELETE':
                relay=body.get('relay_token',''); key=hashlib.sha256(relay.encode()).hexdigest()
                self.state.relay_tokens.pop(key,None); self.state.relay_push_tokens.pop(relay,None)
                self.send_response(204); self.send_header('Content-Length','0'); self.end_headers(); return
            if path == '/arx/api/v1/presence/devices' and method=='POST':
                user=self.user()
                if not user: return self.failure(401,'not_authenticated')
                name=body.get('name'); platform=body.get('platform'); install=body.get('install_id')
                if not isinstance(name,str) or not 2<=len(name.strip())<=40: return self.failure(400,'invalid_name')
                if platform not in ('ios','android'): return self.failure(400,'invalid_platform')
                if not isinstance(install,str) or not 8<=len(install)<=64: return self.failure(400,'invalid_install_id')
                name=name.strip()
                existing=next((d for d in self.state.devices.values() if d['user']==user and d['install']==install),None)
                if any(d['user']==user and d['name'].casefold()==name.casefold() and d is not existing for d in self.state.devices.values()): return self.failure(409,'device_name_taken',{'suggestion':name+' 2'})
                if not existing and sum(d['user']==user for d in self.state.devices.values())>=10: return self.failure(409,'too_many_devices')
                device_id=existing['device_id'] if existing else 'dev_'+uuid.uuid4().hex
                token='arxd_'+secrets.token_urlsafe(32)
                self.state.tokens={key:value for key,value in self.state.tokens.items() if value!=device_id}
                self.state.tokens[hashlib.sha256(token.encode()).hexdigest()]=device_id
                device={'device_id':device_id,'device_token':token,'token_hash':hashlib.sha256(token.encode()).hexdigest(),'name':name,'user':user,'install':install,
                    'platform':platform,'app_version':body.get('app_version','1.0.0'),'os_version':body.get('os_version',''), 'model':body.get('model',''),
                    'registered_at':'2026-10-05T00:00:00Z','notice_ack_version':0,'ack':0,'status':{},'push':{'registered':False,'platform':platform,'muted':[]},'revoked_at':None}
                self.state.devices[device_id]=device
                return self.json_response(200 if existing else 201,{'device_id':device_id,'device_token':token,'name':name,'registered_at':device['registered_at'],'created':not bool(existing)})
            if path == '/arx/api/v1/presence/devices/' and method=='': return self.failure(404,'not_found')
            if path == '/arx/api/v1/presence/devices/me': return self.failure(404,'not_found')
            if path == '/arx/api/v1/notifications/devices' and method=='POST':
                device=self.require_device()
                if not device: return
                relay=body.get('relay_token',''); relay_hash=hashlib.sha256(str(relay).encode()).hexdigest()
                if relay_hash not in self.state.relay_tokens: return self.failure(400,'invalid_relay_token')
                device['push'].update({'registered':True,'platform':body.get('platform'),'relay_token_hash':relay_hash})
                return self.json_response(200,{'device_id':device['device_id'],'push':device['push']})
            if path.startswith('/arx/api/v1/presence/devices/'):
                return self.presence_device_route(path,method,body)
            if path.startswith('/arx/api/v1/notifications/devices/'):
                return self.notification_device_route(path,method,body)
            if path == '/arx/api/v1/notifications/devices' and method=='DELETE':
                device=self.require_device()
                if not device: return
                device['push']={'registered':False,'platform':device.get('platform','android'),'muted':[]}
                self.send_response(204); self.send_header('Content-Length','0'); self.end_headers(); return
            if path == '/arx/api/v1/notifications/app/test' and method=='POST':
                device=self.require_device()
                if not device: return
                message_id='msg_'+uuid.uuid4().hex
                self.state.messages[message_id]={'message_id':message_id,'notification_id':message_id,'title':'התראת בדיקה','body':'ההתראה מהשרת התקבלה.','category':'system','severity':'normal','deep_link':'/arx/','at':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'mode':'active','device_id':device['device_id']}
                return self.json_response(200,{'message_id':message_id,'sent':True,'reason':None})
        self.failure(404,'not_found')
    def presence_device_route(self,path,method,body):
        prefix='/arx/api/v1/presence/devices/'
        parts=[unquote(p) for p in path[len(prefix):].split('/')]
        device=self.require_device(parts[0] if parts and parts[0]!='me' else None)
        if not device: return
        if len(parts)==1 and method=='PATCH':
            name=body.get('name')
            if not isinstance(name,str) or not 2<=len(name.strip())<=40: return self.failure(400,'invalid_name')
            name=name.strip()
            if any(d['user']==device['user'] and d['device_id']!=device['device_id'] and d['name'].casefold()==name.casefold() for d in self.state.devices.values()): return self.failure(409,'device_name_taken',{'suggestion':name+' 2'})
            device['name']=name; return self.json_response(200,self.public_device(device))
        if len(parts)==1 and method=='DELETE':
            self.state.devices.pop(device['device_id'],None); self.state.tokens={k:v for k,v in self.state.tokens.items() if v!=device['device_id']}
            self.state.event_ids={item for item in self.state.event_ids if item[0]!=device['device_id']}
            self.state.messages={key:value for key,value in self.state.messages.items() if value['device_id']!=device['device_id']}
            self.send_response(204); self.send_header('Content-Length','0'); self.end_headers(); return
        if parts[1:]==['ack'] and method=='POST':
            version=body.get('notice_version')
            if not isinstance(version,int) or version<=0: return self.failure(400,'invalid_notice_version')
            if version!=self.state.version: return self.failure(409,'notice_version_stale',{'notice_version':self.state.version})
            if not self.state.enabled: return self.failure(409,'presence_disabled')
            device['ack']=version; device['notice_ack_version']=version
            return self.json_response(200,{'ok':True,'notice_version':version})
        if parts[1:]==['events'] and method=='POST':
            events=body.get('events',[]); status=body.get('status')
            if not isinstance(events,list) or len(events)>50: return self.failure(400,'batch_too_large')
            if not events and status is None: return self.failure(400,'invalid_event')
            if events and not self.state.enabled: return self.failure(409,'presence_disabled')
            if events and device['ack']!=self.state.version: return self.failure(409,'notice_ack_required',{'notice_version':self.state.version})
            for event in events:
                if not isinstance(event,dict) or not isinstance(event.get('client_event_id'),str) or not 1<=len(event['client_event_id'])<=64 or not isinstance(event.get('at'),str): return self.failure(400,'invalid_event',{'field':'client_event_id'})
                try:
                    if not event.get('at','').endswith('Z'): raise ValueError()
                    datetime.fromisoformat(event['at'].replace('Z','+00:00'))
                except (ValueError,TypeError): return self.failure(400,'invalid_event',{'field':'at','client_event_id':event['client_event_id']})
                kind=event.get('type')
                if kind=='sensor':
                    sensor=event.get('sensor'); value=event.get('value')
                    if sensor not in SENSORS or sensor not in self.state.allowed: return self.failure(400,'sensor_not_allowed',{'sensor':sensor})
                    if not isinstance(value,dict) or len(value)>20 or len(json.dumps(value).encode())>1024 or any(not isinstance(v,(str,int,float,bool,type(None))) or (isinstance(v,str) and len(v)>128) or (isinstance(v,float) and not math.isfinite(v)) for v in value.values()): return self.failure(400,'invalid_event',{'field':'value','client_event_id':event['client_event_id']})
                elif kind in ('fix','enter','exit'):
                    if kind=='fix' and not all(isinstance(event.get(k),(float,int)) and not isinstance(event.get(k),bool) and math.isfinite(event[k]) for k in ('lat','lon')): return self.failure(400,'invalid_event',{'field':'coordinates','client_event_id':event['client_event_id']})
                    if 'location' not in self.state.allowed: return self.failure(400,'sensor_not_allowed',{'sensor':'location'})
                    if kind=='fix' and (not -90<=event['lat']<=90 or not -180<=event['lon']<=180): return self.failure(400,'invalid_event',{'field':'coordinates','client_event_id':event['client_event_id']})
                else: return self.failure(400,'invalid_event',{'field':'type','client_event_id':event['client_event_id']})
            if status is not None:
                if not isinstance(status,dict): return self.failure(400,'invalid_event',{'field':'status'})
                sensors=status.get('sensors',{})
                if not isinstance(sensors,dict): return self.failure(400,'invalid_event',{'field':'status.sensors'})
                device['status']={'location_auth':status.get('location_auth','not_determined'),'precise':bool(status.get('precise',False)),'sharing':bool(status.get('sharing',False)),
                    'sensors':{key:(value if key in self.state.allowed and value in ('on','off') else 'off') for key,value in sensors.items() if key in SENSORS}}
            if status is not None: device['last_seen_at']=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
            accepted=duplicates=0
            for event in events:
                identity=(device['device_id'],event['client_event_id'])
                if identity in self.state.event_ids: duplicates+=1
                else:
                    self.state.event_ids.add(identity); accepted+=1
                    if event['type'] in ('fix','enter','exit') and event['at'] >= device.get('last_event_at',''):
                        inside=None; site_id=None
                        if event['type'] in ('enter','exit'):
                            inside=event['type']=='enter'; site_id=event.get('site_id')
                        elif self.state.sites:
                            inside=False
                            for site in self.state.sites:
                                lat1,lat2=math.radians(event['lat']),math.radians(site['lat'])
                                dl=math.radians(event['lon']-site['lon']); da=lat1-lat2
                                distance=6371000*2*math.asin(min(1,math.sqrt(math.sin(da/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dl/2)**2)))
                                if distance<=site['radius_m']: inside=True; site_id=site['id']; break
                        device['presence']={'inside':inside,'site_id':site_id,'at':event['at']}
                        device['last_event_at']=event['at']
            return self.json_response(200,{'accepted':accepted,'duplicates':duplicates,'inside':device.get('presence',{}).get('inside'),'site_id':device.get('presence',{}).get('site_id'),'notice_version':self.state.version})
        if parts[1:]==['state'] and method=='GET':
            return self.json_response(200,{'device_id':device['device_id'],'presence':device.get('presence'),'status':device.get('status',{}),'last_event_at':device.get('last_event_at')})
        return self.failure(404,'not_found')
    def notification_device_route(self,path,method,body):
        prefix='/arx/api/v1/notifications/devices/'
        device_id=unquote(path[len(prefix):].split('/',1)[0]); device=self.require_device(device_id)
        if not device: return
        if method=='PATCH':
            muted=body.get('muted')
            allowed={c['id'] for c in CATEGORIES}
            if not isinstance(muted,list) or any(item not in allowed for item in muted): return self.failure(400,'validation')
            device['push']['muted']=muted; return self.json_response(200,{'device_id':device_id,'push':device['push']})
        if method=='DELETE':
            device['push']={'registered':False,'platform':device.get('platform','android'),'muted':[]}
            self.send_response(204); self.send_header('Content-Length','0'); self.end_headers(); return
        return self.failure(404,'not_found')

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--port',type=int,default=8099)
    parser.add_argument('--enabled',action='store_true')
    parser.add_argument('--allowed',nargs='*',choices=SENSORS,default=[])
    parser.add_argument('--notice-file')
    args=parser.parse_args()
    notice=PLACEHOLDER
    if args.notice_file:
        with open(args.notice_file,encoding='utf-8') as stream: notice=stream.read()
    Handler.state=State(args.enabled,notice); Handler.state.allowed=args.allowed
    ThreadingHTTPServer(('127.0.0.1',args.port),Handler).serve_forever()
