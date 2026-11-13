package com.webox.service;
import com.webox.common.ApiException;
import com.webox.repository.WeBoxRepository;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
@Service
public class InventoryService {
 private final WeBoxRepository db;private final MenuCacheService cache;
 public InventoryService(WeBoxRepository db,MenuCacheService cache){this.db=db;this.cache=cache;}
 public Object snapshot(LocalDate date){return Map.of("date",date.toString(),"items",cache.get(date).stream().map(r->Map.of("dishId",r.get("id"),"remainingQuantity",r.get("remaining_quantity"),"supplyQuantity",r.get("supply_quantity"))).toList());}
 public void deduct(LocalDate date,SortedMap<Long,Integer> quantities){cache.changing(date);for(var entry:quantities.entrySet()){
  if(db.update("UPDATE daily_menu_items SET remaining_quantity=remaining_quantity-? WHERE menu_date=? AND dish_id=? AND remaining_quantity>=?",entry.getValue(),date,entry.getKey(),entry.getValue())!=1){var dish=db.one("SELECT name FROM dishes WHERE id=?",entry.getKey());throw new ApiException(409,"INSUFFICIENT_STOCK","Insufficient stock for "+(dish==null?"selected dish":dish.get("name"))+". Please update your cart.");}
 }}
 public void restore(LocalDate date,long orderId){cache.changing(date);for(var line:db.query("SELECT dish_id,SUM(quantity) AS quantity FROM order_items WHERE order_id=? GROUP BY dish_id ORDER BY dish_id",orderId))db.update("UPDATE daily_menu_items SET remaining_quantity=remaining_quantity+? WHERE menu_date=? AND dish_id=?",line.get("quantity"),date,line.get("dish_id"));}
 public void replace(LocalDate date,JsonNode items){
  cache.changing(date);SortedMap<Long,Integer> requested=new TreeMap<>();items.forEach(i->requested.put(i.path("dishId").asLong(),i.path("supplyQuantity").asInt()));
  var old=db.query("SELECT dish_id,supply_quantity,remaining_quantity FROM daily_menu_items WHERE menu_date=? ORDER BY dish_id FOR UPDATE",date);
  for(var row:old){long id=((Number)row.get("dish_id")).longValue();int used=((Number)row.get("supply_quantity")).intValue()-((Number)row.get("remaining_quantity")).intValue();Integer supply=requested.remove(id);
   if(supply==null){if(used>0)throw new ApiException(409,"STOCK_CONFLICT","Cannot remove a dish with existing orders.");db.update("DELETE FROM daily_menu_items WHERE menu_date=? AND dish_id=?",date,id);}
   else{if(supply<used)throw new ApiException(409,"STOCK_CONFLICT","Supply cannot be below the quantity already ordered.");db.update("UPDATE daily_menu_items SET supply_quantity=?,remaining_quantity=? WHERE menu_date=? AND dish_id=?",supply,supply-used,date,id);}
  }
  for(var entry:requested.entrySet())db.update("INSERT INTO daily_menu_items(menu_date,dish_id,supply_quantity,remaining_quantity) VALUES (?,?,?,?)",date,entry.getKey(),entry.getValue(),entry.getValue());
 }
}
