package com.webox.service;
import java.time.*;
import com.webox.common.ApiException;
public final class CheckoutSlots {
 public record Slot(LocalDate deliveryDate,String mealPeriod,boolean adjusted) {}
 public static Slot resolve(LocalDate date,String meal,ZonedDateTime now) {
  if(date==null || !("Lunch".equals(meal)||"Dinner".equals(meal))) throw ApiException.bad("Invalid delivery slot.");
  now=now.withZoneSameInstant(CatalogService.ZONE);
  if(date.isBefore(now.toLocalDate())) throw ApiException.bad("Delivery date cannot be in the past.");
  if(date.equals(now.toLocalDate()) && !now.toLocalTime().isBefore(LocalTime.of(meal.equals("Lunch")?10:15,0))) {
   if(now.toLocalTime().isBefore(LocalTime.of(15,0))) return new Slot(date,"Dinner",true);
   return new Slot(date.plusDays(1),"Lunch",true);
  }
  return new Slot(date,meal,false);
 }
}
