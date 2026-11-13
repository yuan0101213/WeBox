package com.webox.controller;
import com.webox.service.InventoryService;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/inventory")
public class InventoryController {
 private final InventoryService inventory;
 public InventoryController(InventoryService inventory){this.inventory=inventory;}
 @GetMapping public Object snapshot(@RequestParam LocalDate date){return Map.of("data",inventory.snapshot(date));}
}
