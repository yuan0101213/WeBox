#!/usr/bin/env python3
"""Real HTTP/MySQL/Redis smoke test. Creates isolated test users and cancelled orders."""
import concurrent.futures
import datetime
import json
import subprocess
import time
import urllib.request
import urllib.error
import uuid
from pathlib import Path
from zoneinfo import ZoneInfo

BASE='http://127.0.0.1:5173/api'
ROOT=Path(__file__).resolve().parents[1]
def call(method, path, body=None, token=None, status=200):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    request=urllib.request.Request(BASE+path, data=json.dumps(body).encode() if body is not None else None, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response: code=response.status; data=json.load(response)
    except urllib.error.HTTPError as error: code=error.code; data=json.load(error)
    assert code==status, (path,code,data)
    return data.get('data',data)

def redis(*args):
    result=subprocess.run(['docker','compose','exec','-T','redis','redis-cli',*args],cwd=ROOT,capture_output=True,text=True,check=True)
    return result.stdout.strip()

stamp=uuid.uuid4().hex[:12]
email=f'api-{stamp}@example.test'
credentials={'email':email,'password':'TestPass123'}
call('GET','/menu',status=401)
call('POST','/auth/register',{'email':'bad','password':'abc'},status=400)
call('POST','/auth/register',{'email':email,'password':'abcdefgh'},status=400)
user=call('POST','/auth/register',credentials)
call('POST','/auth/register',credentials,status=409)
call('POST','/auth/login',{'email':email,'password':'WrongPass1'},status=401)
login=call('POST','/auth/login',credentials); token=login['token']
assert login['expiresIn']==300
assert 290 <= int(redis('TTL','webox:login:'+token)) <= 300
assert call('GET','/auth/me',token=token)['id']==user['id']
print('PASS registration, duplicate email, password validation, login and Redis 300s TTL')

menu=call('GET','/menu?pageSize=2',token=token)
assert len(menu['items'])==2 and menu['total']>=9
assert call('GET','/menu?keyword=tomato',token=token)['items'][0]['name']=='Tomato Pasta'
assert not call('GET','/menu?keyword=%25',token=token)['items']
assert {d['category'] for d in call('GET','/menu?categories=Chinese,Japanese',token=token)['items']}=={'Chinese','Japanese'}
assert call('GET','/dishes/9',token=token)['optionGroups']
print('PASS menu pagination, keyword search, literal wildcard, multiple cuisines, details')

today=datetime.datetime.now(ZoneInfo('Asia/Shanghai')).date().isoformat()
body={'requestId':str(uuid.uuid4()),'deliveryDate':today,'mealPeriod':'Lunch','address':'Test Building, Floor 3','items':[{'dishId':9,'quantity':2,'selectedOptions':[{'groupId':'bun','optionId':'whole-wheat'},{'groupId':'sauce','optionId':'mustard'},{'groupId':'add-ons','optionId':'cheese'}]}], 'totalFen':1}
invalid={**body,'requestId':str(uuid.uuid4()),'items':[{'dishId':9,'quantity':1,'selectedOptions':[]}]}
call('POST','/orders',invalid,token,status=400)
order=call('POST','/orders',body,token)
assert order['totalFen']==8200 and order['items'][0]['subtotalFen']==8200
assert len(order['items'][0]['options'])==3 and order['status']=='Pending'
replay=call('POST','/orders',body,token); assert replay['id']==order['id']
call('POST','/orders',{**body,'address':'Changed'},token,status=409)
invalid={**body,'requestId':str(uuid.uuid4()),'items':[{'dishId':1,'quantity':0,'selectedOptions':[]}]}
call('POST','/orders',invalid,token,status=400)
before=call('GET','/orders',token=token)['total']
invalid={**body,'requestId':str(uuid.uuid4()),'items':[{'dishId':1,'quantity':1,'selectedOptions':[]},{'dishId':999999,'quantity':1,'selectedOptions':[]}]}
call('POST','/orders',invalid,token,status=400)
assert call('GET','/orders',token=token)['total']==before
print('PASS required options, integer pricing, snapshots, replay, mismatched replay, rollback')

# Phase 2 allows only one active order per slot; cancel before the next submission.
call('POST',f"/orders/{order['id']}/cancel",token=token)
concurrent_body={**body,'requestId':str(uuid.uuid4()),'items':[{'dishId':1,'quantity':1,'selectedOptions':[]}]}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
    results=list(executor.map(lambda _:call('POST','/orders',concurrent_body,token),range(6)))
assert len({r['id'] for r in results})==1
assert call('GET','/orders',token=token)['total']==before+1
print('PASS six concurrent submissions create exactly one order')

other={'email':f'other-{stamp}@example.test','password':'TestPass123'}
call('POST','/auth/register',other); other_token=call('POST','/auth/login',other)['token']
call('GET',f"/orders/{order['id']}",token=other_token,status=404)
call('POST',f"/orders/{order['id']}/cancel",token=other_token,status=404)
assert call('GET','/orders',token=other_token)['total']==0
assert body['address'] in call('GET','/addresses',token=token)
for target in [order['id'],results[0]['id']]:
    assert call('POST',f'/orders/{target}/cancel',token=token)['status']=='Cancelled'
    assert call('POST',f'/orders/{target}/cancel',token=token)['status']=='Cancelled'
print('PASS owner isolation, historical addresses and repeat cancellation')

redis('EXPIRE','webox:login:'+token,'1'); time.sleep(1.2)
call('GET','/auth/me',token=token,status=401)
call('POST','/auth/logout',token=other_token)
call('GET','/auth/me',token=other_token,status=401)
print('PASS Redis expiry and logout invalidate sessions')
print('All core business API checks passed.')
