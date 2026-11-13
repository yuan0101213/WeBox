package com.webox.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.webox.common.ApiException;
import com.webox.repository.WeBoxRepository;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.*;
import jakarta.annotation.PreDestroy;

/** A short lived snapshot, never the authority for checkout. */
@Service
public class MenuCacheService {
 private final StringRedisTemplate redis; private final WeBoxRepository db; private final ObjectMapper mapper;
 private final ScheduledExecutorService executor=Executors.newSingleThreadScheduledExecutor(r->{Thread t=new Thread(r,"menu-cache-invalidation");t.setDaemon(true);return t;});
 public MenuCacheService(StringRedisTemplate redis,WeBoxRepository db,ObjectMapper mapper){this.redis=redis;this.db=db;this.mapper=mapper;}
 private String key(LocalDate date){return "webox:menu:v3:"+date;}
 private List<Map<String,Object>> read(String key)throws Exception {String value=redis.opsForValue().get(key);return value==null?null:mapper.readValue(value,new TypeReference<List<Map<String,Object>>>(){});}
 public List<Map<String,Object>> get(LocalDate date){
  String key=key(date),lock=key+":lock",token=UUID.randomUUID().toString();
  try {
   var cached=read(key);if(cached!=null)return cached;
   if(Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(lock,token,Duration.ofSeconds(10)))){
    try{cached=read(key);if(cached!=null)return cached;
     var rows=db.query("SELECT d.*,m.supply_quantity,m.remaining_quantity FROM dishes d JOIN daily_menu_items m ON m.dish_id=d.id WHERE m.menu_date=? AND d.active=TRUE ORDER BY d.id",date);
     redis.opsForValue().set(key,mapper.writeValueAsString(rows),Duration.ofSeconds(ThreadLocalRandom.current().nextInt(30,46)));return rows;
    }finally{redis.execute(new DefaultRedisScript<Long>("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",Long.class),List.of(lock),token);}
   }
   for(int i=0;i<8;i++){Thread.sleep(40);cached=read(key);if(cached!=null)return cached;}
  }catch(InterruptedException e){Thread.currentThread().interrupt();}catch(Exception e){/* fail closed: an outage must not fan out into MySQL */}
  throw new ApiException(503,"MENU_RETRY","Menu is temporarily busy. Please retry shortly.");
 }
 private void remove(LocalDate date){try{redis.delete(key(date));}catch(Exception ignored){executor.schedule(()->{try{redis.delete(key(date));}catch(Exception ignoredAgain){}},1,TimeUnit.SECONDS);}}
 public void changing(LocalDate date){remove(date);Runnable after=()->{remove(date);executor.schedule(()->remove(date),500,TimeUnit.MILLISECONDS);};if(TransactionSynchronizationManager.isSynchronizationActive())TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){@Override public void afterCommit(){after.run();}});else after.run();}
 public void dishChanging(long id){for(var row:db.query("SELECT menu_date FROM daily_menu_items WHERE dish_id=?",id))changing(LocalDate.parse(row.get("menu_date").toString()));}
 @PreDestroy public void close(){executor.shutdown();}
}
