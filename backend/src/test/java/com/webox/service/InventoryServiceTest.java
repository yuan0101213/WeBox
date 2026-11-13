package com.webox.service;
import com.webox.repository.WeBoxRepository;
import com.webox.common.ApiException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import java.time.LocalDate;
import java.util.*;
class InventoryServiceTest {
 final WeBoxRepository db=mock(WeBoxRepository.class);
 final MenuCacheService cache=mock(MenuCacheService.class);
 final InventoryService service=new InventoryService(db,cache);
 final LocalDate date=LocalDate.of(2026,11,14);
 @Test void stockShortageUsesGuardedUpdateAndNamesDish(){
  when(db.one("SELECT name FROM dishes WHERE id=?",7L)).thenReturn(Map.of("name","Salmon Bowl"));
  var error=assertThrows(ApiException.class,()->service.deduct(date,new TreeMap<>(Map.of(7L,3))));
  assertTrue(error.getMessage().contains("Salmon Bowl"));
  verify(db).update("UPDATE daily_menu_items SET remaining_quantity=remaining_quantity-? WHERE menu_date=? AND dish_id=? AND remaining_quantity>=?",3,date,7L,3);
 }
 @Test void menuSupplyKeepsConsumedServings()throws Exception{
  when(db.query("SELECT dish_id,supply_quantity,remaining_quantity FROM daily_menu_items WHERE menu_date=? ORDER BY dish_id FOR UPDATE",date)).thenReturn(List.of(Map.of("dish_id",7L,"supply_quantity",10,"remaining_quantity",6)));
  service.replace(date,new ObjectMapper().readTree("[{\"dishId\":7,\"supplyQuantity\":8}]"));
  verify(db).update("UPDATE daily_menu_items SET supply_quantity=?,remaining_quantity=? WHERE menu_date=? AND dish_id=?",8,4,date,7L);
 }
 @Test void cannotRemoveDishWithConsumedServings()throws Exception{
  when(db.query("SELECT dish_id,supply_quantity,remaining_quantity FROM daily_menu_items WHERE menu_date=? ORDER BY dish_id FOR UPDATE",date)).thenReturn(List.of(Map.of("dish_id",7L,"supply_quantity",10,"remaining_quantity",6)));
  assertThrows(ApiException.class,()->service.replace(date,new ObjectMapper().createArrayNode()));
  verify(db,never()).update("DELETE FROM daily_menu_items WHERE menu_date=? AND dish_id=?",date,7L);
 }
}
