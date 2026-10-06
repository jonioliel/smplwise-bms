"""Contract checks for the synthetic loopback server; no external network access."""
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from mock_arx_server import Handler, State, PLACEHOLDER, SENSORS

class ContractTests(unittest.TestCase):
    def setUp(self):
        Handler.state=State()
        self.server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True); self.thread.start()
        self.base='http://127.0.0.1:'+str(self.server.server_port); self.token=None; self.device_id=None
    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
    def request(self,path,method='GET',body=None,user=None,token=None):
        headers={'Content-Type':'application/json'}
        if user: headers['Cookie']='fixture_user='+user
        if token: headers['Authorization']='Bearer '+token
        request=Request(self.base+path,data=None if body is None else json.dumps(body).encode(),headers=headers,method=method)
        try:
            with urlopen(request,timeout=3) as response:
                payload=json.load(response) if response.status!=204 else None
                return response.status,payload
        except HTTPError as error:
            return error.code,json.load(error)
    def register(self,install='fixture-install-01',name='מכשיר בדיקה',user='fixture-a'):
        status,reply=self.request('/arx/api/v1/presence/devices','POST',{'name':name,'platform':'android','install_id':install,'app_version':'1.0.0','os_version':'15','model':'Android fixture'},user=user)
        self.assertIn(status,(200,201)); self.token=reply['device_token']; self.device_id=reply['device_id']; return reply
    def configure(self,**values):
        if values.get('enabled') is True and 'notice_text' not in values:
            values['notice_text']='Synthetic test notice'
        return self.request('/fixture/config','POST',values)
    def ack(self):
        return self.request('/arx/api/v1/presence/devices/'+self.device_id+'/ack','POST',{'notice_version':Handler.state.version},token=self.token)
    def status(self,sensors,sharing=False):
        return self.request('/arx/api/v1/presence/devices/'+self.device_id+'/events','POST',{'events':[],'status':{'location_auth':'always','precise':True,'sharing':sharing,'sensors':sensors}},token=self.token)
    def testDefaultDisabledConfigReturnsNoSensorsAndNoSiteData(self):
        self.configure(enabled=False,allowed=list(SENSORS),required_sensors={'enabled':True,'sensors':['location']},sites=[{'id':'fixture','name':'בדיקה','lat':0,'lon':0,'radius_m':10}])
        reply=self.request('/arx/api/v1/presence/config',user='fixture-a')[1]
        self.assertFalse(reply['enabled']); self.assertEqual(reply['sensors']['allowed'],[]); self.assertEqual(reply['sites'],[])
        self.assertEqual(reply['beacons'],[]); self.assertEqual(reply['wifi_sites'],[]); self.assertFalse(reply['required_sensors']['enabled'])
        self.assertEqual(reply['notice_text'],PLACEHOLDER)
    def testRegistrationRotatesTokenAndValidatesIdentity(self):
        path='/arx/api/v1/presence/devices'
        self.assertEqual(self.request(path,'POST',{'name':'א','platform':'android','install_id':'short-id'},user='fixture-a')[0],400)
        first=self.register(); second=self.register(install='fixture-install-01')
        self.assertEqual(first['device_id'],second['device_id']); self.assertNotEqual(first['device_token'],second['device_token'])
        self.assertEqual(self.request('/arx/api/v1/presence/config',token=first['device_token'])[0],401)
        status,reply=self.request('/arx/api/v1/presence/devices','POST',{'name':'מכשיר בדיקה','platform':'android','install_id':'different-install'},user='fixture-a')
        self.assertEqual(status,409); self.assertEqual(reply['code'],'device_name_taken')
    def testSensorEventsStatusAndRequiredGate(self):
        self.register(); self.configure(enabled=True,allowed=list(SENSORS),required_sensors={'enabled':True,'sensors':['activity']})
        self.assertEqual(self.ack()[0],200)
        self.assertEqual(self.status({'activity':'off'},sharing=False)[0],200)
        gate=self.request('/arx/api/v1/presence/gate',user='fixture-a')[1]
        self.assertTrue(gate['blocked']); self.assertEqual(gate['missing'],['activity'])
        event={'client_event_id':'event-activity-1','type':'sensor','sensor':'activity','at':'2026-10-05T10:00:00Z','value':{'state':'walking','confidence':'high'}}
        status,reply=self.request('/arx/api/v1/presence/devices/'+self.device_id+'/events','POST',{'events':[event],'status':{'sensors':{'activity':'on'}}},token=self.token)
        self.assertEqual(status,200); self.assertEqual(reply['accepted'],1)
        status,duplicate=self.request('/arx/api/v1/presence/devices/'+self.device_id+'/events','POST',{'events':[event]},token=self.token)
        self.assertEqual(status,200); self.assertEqual(duplicate['duplicates'],1)
        self.status({'activity':'on'})
        self.assertFalse(self.request('/arx/api/v1/presence/gate',user='fixture-a')[1]['blocked'])
    def testServerRejectsUnallowedSensorAndAllowsStatusWhileDisabled(self):
        self.register(); self.configure(enabled=True,allowed=['battery']); self.ack()
        event={'client_event_id':'event-steps-1','type':'sensor','sensor':'steps','at':'2026-10-05T10:00:00Z','value':{'steps_delta':2}}
        status,reply=self.request('/arx/api/v1/presence/devices/'+self.device_id+'/events','POST',{'events':[event]},token=self.token)
        self.assertEqual(status,400); self.assertEqual(reply['code'],'sensor_not_allowed')
        self.configure(enabled=False)
        self.assertEqual(self.status({'battery':'on'})[0],200)
    def testPushRelayAndFullTextFetchUseAppRoute(self):
        self.register()
        status,relay=self.request('/v1/register','POST',{'platform':'android','push_token':'synthetic-token','app_version':'1.0.0','bundle_id':'com.smplwise.arx.app'})
        self.assertEqual(status,200); self.assertTrue(relay['relay_token'].startswith('rt_'))
        self.assertEqual(self.request('/arx/api/v1/notifications/devices','POST',{'platform':'android','relay_token':relay['relay_token'],'app_version':'1.0.0'},token=self.token)[0],200)
        self.assertGreater(len(self.request('/arx/api/v1/notifications/categories',token=self.token)[1]['categories']),0)
        status,test=self.request('/arx/api/v1/notifications/app/test','POST',{},token=self.token)
        self.assertEqual(status,200); self.assertTrue(test['sent'])
        status,message=self.request('/arx/api/v1/notifications/app/'+test['message_id'],token=self.token)
        self.assertEqual(status,200); self.assertEqual(message['message_id'],test['message_id']); self.assertEqual(message['title'],'התראת בדיקה')
    def testRequiredGateDoesNotBlockAdministratorsOrDisabledMaster(self):
        self.register(); self.configure(enabled=True,allowed=list(SENSORS),required_sensors={'enabled':True,'sensors':['location']})
        self.assertTrue(self.request('/arx/api/v1/presence/gate',user='fixture-a')[1]['blocked'])
        self.assertTrue(self.request('/arx/api/v1/me',user='fixture-a')[1]['presence_gate']['blocked'])
        self.assertFalse(self.request('/arx/api/v1/presence/gate',user='fixture-admin')[1]['blocked'])
        self.configure(enabled=False)
        self.assertFalse(self.request('/arx/api/v1/presence/gate',user='fixture-a')[1]['blocked'])

    def testAndroidRegistrationAndOpaqueRelayNeverSendFcmTokenToArx(self):
        self.register()
        self.assertEqual(Handler.state.devices[self.device_id]['platform'],'android')
        reply=self.request('/v1/register','POST',{'platform':'android','push_token':'synthetic-fcm','bundle_id':'com.smplwise.arx.app'})[1]
        self.assertEqual(self.request('/arx/api/v1/notifications/devices','POST',{'platform':'android','relay_token':reply['relay_token']},token=self.token)[0],200)
        self.assertEqual(Handler.state.devices[self.device_id]['push']['platform'],'android')
        self.assertNotIn('synthetic-fcm', json.dumps(Handler.state.devices))
    def testNotificationFetchRejectsOtherDevicesAndExpiredMessages(self):
        self.register(); first=self.token
        message=self.request('/arx/api/v1/notifications/app/test','POST',{},token=first)[1]['message_id']
        self.register(install='fixture-install-02',name='מכשיר שני')
        self.assertEqual(self.request('/arx/api/v1/notifications/app/'+message,token=self.token)[0],404)
        Handler.state.messages[message]['at']='2020-01-01T00:00:00Z'
        self.assertEqual(self.request('/arx/api/v1/notifications/app/'+message,token=first)[0],404)
    def testRevocationClearsMessagesAndCrossDeviceManagementIsNotFound(self):
        self.register(); first=self.token; first_id=self.device_id
        message=self.request('/arx/api/v1/notifications/app/test','POST',{},token=first)[1]['message_id']
        self.register(install='fixture-install-02',name='מכשיר שני')
        self.assertEqual(self.request('/arx/api/v1/presence/devices/'+first_id,'PATCH',{'name':'שם חדש'},token=self.token)[0],404)
        self.assertEqual(self.request('/arx/api/v1/presence/devices/'+first_id,'DELETE',{},token=first)[0],204)
        self.assertNotIn(message,Handler.state.messages)
        self.assertEqual(self.request('/arx/api/v1/presence/config',token=first)[0],401)
    def testRegionEventsRequireLocationAllowedAndInvalidBatchIsAtomic(self):
        self.register(); self.configure(enabled=True,allowed=['battery']); self.ack()
        path='/arx/api/v1/presence/devices/'+self.device_id+'/events'
        event={'client_event_id':'region-1','type':'enter','site_id':'site_main','at':'2026-10-05T10:00:00Z','source':'region'}
        self.assertEqual(self.request(path,'POST',{'events':[event]},token=self.token)[1]['code'],'sensor_not_allowed')
        self.configure(enabled=True,allowed=['location']); self.ack()
        invalid=dict(event,client_event_id='region-2',at='bad')
        self.assertEqual(self.request(path,'POST',{'events':[event,invalid]},token=self.token)[0],400)
        self.assertEqual(len(Handler.state.event_ids),0)
    def testOldFixDoesNotMovePresenceBackwards(self):
        self.register(); self.configure(enabled=True,allowed=['location'],sites=[{'id':'site_main','lat':32,'lon':34,'radius_m':150}]); self.ack()
        path='/arx/api/v1/presence/devices/'+self.device_id+'/events'
        newer={'client_event_id':'newer','type':'fix','lat':32,'lon':34,'at':'2026-10-05T10:00:00Z'}
        older={'client_event_id':'older','type':'fix','lat':0,'lon':0,'at':'2026-10-05T09:00:00Z'}
        self.assertTrue(self.request(path,'POST',{'events':[newer,older]},token=self.token)[1]['inside'])
        self.assertTrue(self.request('/arx/api/v1/presence/devices/'+self.device_id+'/state',token=self.token)[1]['presence']['inside'])

if __name__=='__main__': unittest.main()
