#!/usr/bin/env python3
"""One small real DeepSeek recommendation request; never reads or prints the API key."""
import datetime,json,urllib.request,uuid
from zoneinfo import ZoneInfo
BASE='http://127.0.0.1:5173/api'
def post(path,body,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 with urllib.request.urlopen(urllib.request.Request(BASE+path,data=json.dumps(body).encode(),headers=headers,method='POST'),timeout=15) as res:return json.load(res)['data']
creds={'email':f'ai-{uuid.uuid4().hex[:10]}@example.test','password':'TestPass123'}
post('/auth/register',creds);token=post('/auth/login',creds)['token']
date=datetime.datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat()
request=urllib.request.Request(BASE+'/recommendations',data=json.dumps({'prompt':'Please recommend two light meals with protein. Give brief reasons.','date':date}).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+token},method='POST')
count=0;done=False;event=''
with urllib.request.urlopen(request,timeout=120) as response:
 assert response.headers.get_content_type()=='text/event-stream'
 for raw in response:
  line=raw.decode().strip()
  if line.startswith('event:'):event=line[6:].strip()
  if line.startswith('data:'):
   data=json.loads(line[5:])
   if event=='recommendation':
    assert data['dish']['id'] and data['reason'] and data['dish']['remainingQuantity']>0
    count+=1;print('CARD:',data['dish']['name'],'—',data['reason'])
   if event=='error':raise AssertionError(data['message'])
   if event=='done':done=True
assert count>0 and done,(count,done)
print(f'PASS real deepseek-flash streaming: {count} validated recommendation cards and done event')
