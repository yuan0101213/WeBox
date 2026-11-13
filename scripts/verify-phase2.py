#!/usr/bin/env python3
"""Tier2 HTTP test, against running local services. Creates test users and a test dish."""
import concurrent.futures
import datetime
import json
import urllib.request
import urllib.error
import uuid
import subprocess
from pathlib import Path
from zoneinfo import ZoneInfo
BASE='http://127.0.0.1:5173/api'
def call(method,path,body=None,token=None,status=200):
    headers={'Content-Type':'application/json'}
    if token: headers['Authorization']='Bearer '+token
    request=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request,timeout=15) as response: code=response.status; result=json.load(response)
    except urllib.error.HTTPError as error: code=error.code; result=json.load(error)
    assert code==status,(path,code,result)
    return result.get('data',result)

stamp=uuid.uuid4().hex[:10]
creds={'email':f'phase2-{stamp}@example.test','password':'TestPass123'}
call('POST','/auth/register',creds); token=call('POST','/auth/login',creds)['token']
call('GET','/console/dishes',token=token,status=403)
prefs={'allergens':['Egg','Peanuts'],'cuisines':['Japanese'],'spiceLevel':'Hot','taste':'Light','budgetMinFen':1000,'budgetMaxFen':2000}
assert call('PUT','/preferences',prefs,token)==prefs
assert call('GET','/preferences',token=token)==prefs
call('PUT','/preferences',{**prefs,'allergens':['Bad']},token,status=400)
call('PUT','/preferences',{**prefs,'budgetMinFen':3000},token,status=400)
menu=call('GET','/menu?recommend=true&pageSize=50',token=token)
assert menu['items'][0]['category']=='Japanese'
result=subprocess.run(['docker','compose','exec','-T','mysql','sh','-c','MYSQL_PWD="$MYSQL_PASSWORD" exec mysql -u"$MYSQL_USER" "$MYSQL_DATABASE"'], input=f"UPDATE users SET role='ADMIN' WHERE email='{creds['email']}';", text=True, capture_output=True, check=True)
call('GET','/console/dishes',token=token,status=403)
print('PASS ordinary ADMIN denied Console')
print('PASS preference persistence, enum/budget validation, recommended sorting, Console role check')

today=datetime.datetime.now(ZoneInfo('Asia/Shanghai')).date()
preview=call('GET',f'/checkout/availability?deliveryDate={today}&mealPeriod=Lunch',token=token)
assert preview['existingOrderId'] is None
body={'requestId':str(uuid.uuid4()),'deliveryDate':today.isoformat(),'mealPeriod':'Lunch','address':'Phase 2 Test Building','items':[{'dishId':1,'quantity':6,'selectedOptions':[]}]}
call('POST','/orders',body,token,status=400)
body['items'][0]['quantity']=5
order=call('POST','/orders',body,token)
assert order['deliveryDate']==preview['deliveryDate'] and order['mealPeriod']==preview['mealPeriod']
assert call('POST','/orders',body,token)['id']==order['id']
assert call('GET',f'/checkout/availability?deliveryDate={today}&mealPeriod=Lunch',token=token)['existingOrderId']==order['id']
call('POST','/orders',{**body,'requestId':str(uuid.uuid4())},token,status=409)
call('POST',f"/orders/{order['id']}/cancel",token=token)
# Different IDs racing for the same active slot must still result in exactly one winner.
def race(_):
    request={**body,'requestId':str(uuid.uuid4())}
    try: return call('POST','/orders',request,token)
    except AssertionError as error:
        if '409' in str(error): return None
        raise
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor: results=list(executor.map(race,range(5)))
winners=[r for r in results if r]
assert len(winners)==1,results
call('POST',f"/orders/{winners[0]['id']}/cancel",token=token)
print('PASS five-serving limit, cutoff adjustment, active-slot uniqueness, concurrent different IDs and cancel/reorder')

admin=call('POST','/auth/login',{'email':'superadmin@webox.test','password':'WeBoxAdmin123'})['token']
dish={'name':f'Test Salad {stamp}','description':'Fresh salad for integration testing','priceFen':1850,'category':'Light Meal','imageUrl':'','proteins':[],'allergens':['Egg'],'spiceLevel':'None','optionGroups':[],'active':True}
created=call('POST','/console/dishes',dish,admin); dish_id=created['id']
dish['priceFen']=1950
updated=call('PUT',f'/console/dishes/{dish_id}',dish,admin)
assert updated['priceFen']==1950
# Use far-future menu to keep the demonstration's current menus intact.
date=(today+datetime.timedelta(days=30)).isoformat()
call('PUT','/console/menu',{'date':date,'items':[{'dishId':dish_id,'supplyQuantity':12}]},admin)
entries=call('GET',f'/console/menu?date={date}',token=admin)
assert entries[0]['dishId']==dish_id and entries[0]['supplyQuantity']==12
assert call('GET',f'/menu?date={date}',token=token)['total']==1
call('PATCH',f'/console/dishes/{dish_id}/status',{'active':False},admin)
assert call('GET',f'/menu?date={date}',token=token)['total']==0
call('PATCH',f'/console/dishes/{dish_id}/status',{'active':True},admin)
assert call('GET',f'/menu?date={date}',token=token)['total']==1
# Image upload and public access through frontend proxy.
image=next(Path('frontend/public/product-images').glob('*.jpg')).read_bytes()
boundary='webox'+uuid.uuid4().hex
payload=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n').encode()+image+(f'\r\n--{boundary}--\r\n').encode()
request=urllib.request.Request(BASE+'/console/images',data=payload,headers={'Authorization':'Bearer '+admin,'Content-Type':f'multipart/form-data; boundary={boundary}'},method='POST')
with urllib.request.urlopen(request,timeout=15) as response: uploaded=json.load(response)['data']['url']
with urllib.request.urlopen('http://127.0.0.1:5173'+uploaded,timeout=15) as response: assert response.status==200
call('PATCH',f'/console/dishes/{dish_id}/status',{'active':False},admin)
call('PUT','/console/menu',{'date':date,'items':[]},admin)
print('PASS admin create/edit/status, daily menu quantity, employee visibility, image upload/serve')
print('All phase 2 checks passed.')
