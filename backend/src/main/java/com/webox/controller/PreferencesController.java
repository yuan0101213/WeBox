package com.webox.controller;
import com.webox.service.PreferencesService;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
@RestController
@RequestMapping("/api/preferences")
public class PreferencesController {
 private final PreferencesService service;
 public PreferencesController(PreferencesService service){this.service=service;}
 @GetMapping public Object get(@RequestAttribute long userId){return Map.of("data",service.get(userId));}
 @PutMapping public Object put(@RequestAttribute long userId,@RequestBody PreferencesService.Preferences body){return Map.of("data",service.save(userId,body));}
}
