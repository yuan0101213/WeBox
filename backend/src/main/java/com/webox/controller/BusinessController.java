package com.webox.controller;

import com.webox.dto.Requests.*;
import com.webox.service.*;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.Map;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class BusinessController {
    private final AuthService auth;
    private final CatalogService catalog;
    private final OrderService orders;
    public BusinessController(AuthService auth,CatalogService catalog,OrderService orders) { this.auth=auth; this.catalog=catalog; this.orders=orders; }
    private Map<String,Object> data(Object value) { return Map.of("data",value); }
    @PostMapping("/auth/register") public Object register(@Valid @RequestBody Credentials input) { return data(auth.register(input)); }
    @PostMapping("/auth/login") public Object login(@Valid @RequestBody Credentials input) { return data(auth.login(input)); }
    @GetMapping("/auth/me") public Object me(@RequestAttribute long userId) { return data(auth.user(userId)); }
    @PostMapping("/auth/logout") public Object logout(@RequestHeader("Authorization") String token) { auth.logout(token); return data(Map.of("message","You have been logged out.")); }
    @GetMapping("/menu") public Object menu(@RequestParam(required=false) LocalDate date,
        @RequestParam(defaultValue="") String keyword,@RequestParam(defaultValue="") String categories,
        @RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="12") int pageSize,@RequestAttribute long userId,@RequestParam(defaultValue="false") boolean recommend) {
        return data(catalog.menu(date==null ? LocalDate.now(CatalogService.ZONE) : date,keyword,categories,page,pageSize,userId,recommend));
    }
    @GetMapping("/dishes/{id}") public Object dish(@PathVariable long id) { return data(catalog.detail(id)); }
    @GetMapping("/checkout/availability") public Object availability(@RequestAttribute long userId,@RequestParam LocalDate deliveryDate,@RequestParam String mealPeriod) { return data(orders.availability(userId,deliveryDate,mealPeriod)); }
    @GetMapping("/addresses") public Object addresses(@RequestAttribute long userId) { return data(orders.addresses(userId)); }
    @PostMapping("/orders") public Object create(@RequestAttribute long userId,@Valid @RequestBody OrderRequest request) { return data(orders.create(userId,request)); }
    @GetMapping("/orders") public Object list(@RequestAttribute long userId,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="10") int pageSize) { return data(orders.list(userId,page,pageSize)); }
    @GetMapping("/orders/{id}") public Object detail(@RequestAttribute long userId,@PathVariable long id) { return data(orders.detail(userId,id)); }
    @PostMapping("/orders/{id}/cancel") public Object cancel(@RequestAttribute long userId,@PathVariable long id) { return data(orders.cancel(userId,id)); }
}
