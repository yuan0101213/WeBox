#!/usr/bin/env python3
"""Real stock/cache concurrency test. Test date is isolated; created orders are cancelled."""
import concurrent.futures,datetime,json,time,urllib.request,urllib.error,uuid,subprocess
from zoneinfo import ZoneInfo
BASE='http://127.0.0.1:5173/api'
def call(method,path,body=None,token=None):
 headers={'Content-Type':'application/json'}
 if token:headers['Authorization']='Bearer '+token
 req=urllib.request.Request(BASE+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method)
 try:
  with urllib.request.urlopen(req,timeout=20) as res:return res.status,json.load(res).get('data')
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def ok(method,path,body=None,token=None):
 status,data=call(method,path,body,token);assert status==200,(status,data);return data
admin=ok('POST','/auth/login',{'email':'superadmin@webox.test','password':'WeBoxAdmin123'})['token']
stamp=uuid.uuid4().hex[:8]
date=(datetime.datetime.now(ZoneInfo('Asia/Shanghai')).date()+datetime.timedelta(days=45)).isoformat()
dish=ok('POST','/console/dishes',{'name':'Stock Test '+stamp,'description':'Concurrent stock test','priceFen':1000,'category':'Chinese','imageUrl':'','proteins':[],'allergens':[],'spiceLevel':'None','optionGroups':[],'active':True},admin)
id=dish['id']
ok('PUT','/console/menu',{'date':date,'items':[{'dishId':id,'supplyQuantity':3}]},admin)
tokens=[]
for i in range(10):
 creds={'email':f'stock-{stamp}-{i}@example.test','password':'TestPass123'}
 ok('POST','/auth/register',creds);tokens.append(ok('POST','/auth/login',creds)['token'])
def body():return {'requestId':str(uuid.uuid4()),'deliveryDate':date,'mealPeriod':'Lunch','address':'Stock test office','items':[{'dishId':id,'quantity':1,'selectedOptions':[]}]}
requests=[body() for _ in tokens]
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
 results=list(executor.map(lambda i:call('POST','/orders',requests[i],tokens[i]),range(10)))
winners=[(i,data) for i,(status,data) in enumerate(results) if status==200]
losers=[i for i,(status,data) in enumerate(results) if status==409 and data.get('code')=='INSUFFICIENT_STOCK']
assert len(winners)==3 and len(losers)==7,results

def remaining():
 value=ok('GET',f'/inventory?date={date}',token=tokens[0]);return next(row['remainingQuantity'] for row in value['items'] if row['dishId']==id)
def wait_stock(expected):
 deadline=time.monotonic()+8
 while time.monotonic()<deadline:
  if remaining()==expected:return
  time.sleep(.25)
 raise AssertionError(('stale cached stock',expected,remaining()))
wait_stock(0)
print('PASS 10 concurrent users compete for 3 servings: exactly 3 orders, 7 stock errors, cache shows zero')
i,order=winners[0]
assert ok('POST','/orders',requests[i],tokens[i])['id']==order['id'];wait_stock(0)
ok('POST',f"/orders/{order['id']}/cancel",token=tokens[i]);wait_stock(1)
ok('POST',f"/orders/{order['id']}/cancel",token=tokens[i]);wait_stock(1)
print('PASS replay does not re-deduct; repeated cancellation restores once')
# A failed request can be retried with its original ID after stock becomes available.
retry=losers[0];new=ok('POST','/orders',requests[retry],tokens[retry]);wait_stock(0)
# Supply cannot be reduced below consumed quantity, nor can a consumed dish be removed.
assert call('PUT','/console/menu',{'date':date,'items':[{'dishId':id,'supplyQuantity':2}]},admin)[0]==409
assert call('PUT','/console/menu',{'date':date,'items':[]},admin)[0]==409
for index,existing in winners[1:]:ok('POST',f"/orders/{existing['id']}/cancel",token=tokens[index])
ok('POST',f"/orders/{new['id']}/cancel",token=tokens[retry]);wait_stock(3)
# Aggregate the same dish across separate configuration lines before deducting.
invalid=body();invalid['items']=[{'dishId':id,'quantity':2,'selectedOptions':[]},{'dishId':id,'quantity':2,'selectedOptions':[]}]
assert call('POST','/orders',invalid,tokens[0])[0]==409
wait_stock(3)
print('PASS admin stock edits protect consumed stock, aggregate shortage rollback, cancellation restores database/cache')
# Verify Redis cache exists and misses rebuild one date key.
time.sleep(1)  # allow the requested delayed second delete to complete
assert remaining()==3
key='webox:menu:v3:'+date
result=subprocess.run(['docker','compose','exec','-T','redis','redis-cli','TTL',key],capture_output=True,text=True,check=True)
assert int(result.stdout.strip())>0,result.stdout
ok('PUT','/console/menu',{'date':date,'items':[]},admin)
ok('PATCH',f'/console/dishes/{id}/status',{'active':False},admin)
print('PASS Redis date cache has bounded TTL; isolated test menu cleared')
print('All inventory checks passed.')
