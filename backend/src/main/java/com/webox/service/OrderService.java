package com.webox.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.webox.common.ApiException;
import com.webox.dto.Requests.*;
import com.webox.repository.WeBoxRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class OrderService {
    private final WeBoxRepository db;
    private final CatalogService catalog;
    private final ObjectMapper mapper;
    private final TransactionTemplate transaction;
    private final Clock clock;
    private final InventoryService inventory;
    public OrderService(WeBoxRepository db, CatalogService catalog, ObjectMapper mapper, TransactionTemplate transaction, Clock clock, InventoryService inventory) {
        this.inventory=inventory; this.clock=clock; this.db=db; this.catalog=catalog; this.mapper=mapper; this.transaction=transaction;
    }
    public Map<String,Object> create(long userId,OrderRequest request) {
        String hash=hash(request);
        var existing=db.one("SELECT id,request_hash FROM orders WHERE user_id=? AND request_id=?",userId,request.requestId());
        if(existing!=null) return replay(userId,hash,existing);
        if(request.items().stream().mapToInt(Item::quantity).sum()>5) throw ApiException.bad("An order may contain at most 5 servings.");
        var slot=CheckoutSlots.resolve(request.deliveryDate(),request.mealPeriod(),ZonedDateTime.now(clock));
        try {
            Long id=transaction.execute(status -> {
                List<Map<String,Object>> lines=new ArrayList<>();
                long total=0;
                for(var item:request.items()) {
                    var dish=catalog.available(item.dishId(),slot.deliveryDate());
                    var price=PriceCalculator.calculate(((Number)dish.get("priceFen")).longValue(),(JsonNode)dish.get("optionGroups"),mapper.valueToTree(item.selectedOptions()));
                    long subtotal=Math.multiplyExact(price.unitPriceFen(),item.quantity());
                    total=Math.addExact(total,subtotal);
                    lines.add(Map.of("dishId",item.dishId(),"name",dish.get("name"),"options",price.options(),"unit",price.unitPriceFen(),"quantity",item.quantity(),"subtotal",subtotal));
                }
                SortedMap<Long,Integer> quantities=new TreeMap<>();
                for(var item:request.items())quantities.merge(item.dishId(),item.quantity(),Integer::sum);
                long orderId=db.insert("INSERT INTO orders(order_no,user_id,request_id,request_hash,delivery_date,meal_period,address,total_fen,stock_deducted) VALUES (?,?,?,?,?,?,?,?,TRUE)",
                    "WB"+UUID.randomUUID().toString().replace("-", ""),userId,request.requestId(),hash,slot.deliveryDate(),slot.mealPeriod(),request.address().strip(),total);
                inventory.deduct(slot.deliveryDate(),quantities);
                for(var line:lines) db.insert("INSERT INTO order_items(order_id,dish_id,dish_name,options_json,unit_price_fen,quantity,subtotal_fen) VALUES (?,?,?,?,?,?,?)",
                    orderId,line.get("dishId"),line.get("name"),db.stringify(line.get("options")),line.get("unit"),line.get("quantity"),line.get("subtotal"));
                return orderId;
            });
            return detail(userId,Objects.requireNonNull(id));
        } catch (DuplicateKeyException ex) {
            var row=db.one("SELECT id,request_hash FROM orders WHERE user_id=? AND request_id=?",userId,request.requestId());
            if(row==null) throw new ApiException(409,"EXISTING_ORDER","An active order already exists for this delivery date and meal. View or cancel that order first.");
            return replay(userId,hash,row);
        }
    }
    public Map<String,Object> availability(long userId,LocalDate date,String meal) {
        var slot=CheckoutSlots.resolve(date,meal,ZonedDateTime.now(clock));
        var order=db.one("SELECT id FROM orders WHERE user_id=? AND delivery_date=? AND meal_period=? AND status IN ('Pending','Confirmed')",userId,slot.deliveryDate(),slot.mealPeriod());
        Map<String,Object> result=new LinkedHashMap<>(); result.put("deliveryDate",slot.deliveryDate().toString()); result.put("mealPeriod",slot.mealPeriod()); result.put("adjusted",slot.adjusted()); result.put("existingOrderId",order==null?null:order.get("id")); return result;
    }
    private Map<String,Object> replay(long userId,String hash,Map<String,Object> row) {
        if(!hash.equals(row.get("request_hash"))) throw new ApiException(409,"REQUEST_ID_REUSED","This submission ID was already used for a different order.");
        return detail(userId,((Number)row.get("id")).longValue());
    }
    public Map<String,Object> list(long userId,int page,int pageSize) {
        if(page<1 || page>100000 || pageSize<1 || pageSize>50) throw ApiException.bad("Invalid pagination.");
        var rows=db.query("SELECT * FROM orders WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?",userId,pageSize,(page-1)*pageSize).stream().map(this::map).toList();
        Object total=db.one("SELECT COUNT(*) AS total FROM orders WHERE user_id=?",userId).get("total");
        return Map.of("items",rows,"total",total);
    }
    public Map<String,Object> detail(long userId,long id) {
        var row=db.one("SELECT * FROM orders WHERE id=? AND user_id=?",id,userId);
        if(row==null) throw ApiException.missing();
        var result=new LinkedHashMap<>(map(row));
        var lines=db.query("SELECT * FROM order_items WHERE order_id=? ORDER BY id",id).stream().map(item -> Map.of(
            "id",item.get("id"),"dishId",item.get("dish_id"),"dishName",item.get("dish_name"),"options",db.json(item.get("options_json")),
            "unitPriceFen",item.get("unit_price_fen"),"quantity",item.get("quantity"),"subtotalFen",item.get("subtotal_fen"))).toList();
        result.put("items",lines); return result;
    }
    public Map<String,Object> cancel(long userId,long id) {
        transaction.execute(status->{
            var row=db.one("SELECT * FROM orders WHERE id=? AND user_id=? FOR UPDATE",id,userId);
            if(row==null)throw ApiException.missing();
            if("Cancelled".equals(row.get("status")))return null;
            if(!"Pending".equals(row.get("status")))throw new ApiException(409,"ORDER_NOT_CANCELLABLE","Only pending orders can be cancelled.");
            Object deducted=row.get("stock_deducted");
            if(Boolean.TRUE.equals(deducted)||(deducted instanceof Number n&&n.intValue()!=0))inventory.restore(LocalDate.parse(row.get("delivery_date").toString()),id);
            db.update("UPDATE orders SET status='Cancelled',stock_deducted=FALSE WHERE id=?",id);
            return null;
        });
        return detail(userId,id);
    }

    public List<String> addresses(long userId) {
        return db.query("SELECT address FROM orders WHERE user_id=? GROUP BY address ORDER BY MAX(created_at) DESC LIMIT 20",userId).stream().map(row -> row.get("address").toString()).toList();
    }
    private Map<String,Object> map(Map<String,Object> row) {
        return Map.of("id",row.get("id"),"orderNo",row.get("order_no"),"deliveryDate",row.get("delivery_date").toString(),
            "mealPeriod",row.get("meal_period"),"address",row.get("address"),"status",row.get("status"),"totalFen",row.get("total_fen"),"createdAt",row.get("created_at").toString());
    }
    private String hash(OrderRequest request) {
        try {
            var items=request.items().stream().map(item -> {
                var options=item.selectedOptions().stream().map(s -> s.groupId()+":"+s.optionId()).sorted().toList();
                return new TreeMap<String,Object>(Map.of("dishId",item.dishId(),"quantity",item.quantity(),"options",options));
            }).sorted(Comparator.comparing(db::stringify)).toList();
            var canonical=List.of(request.deliveryDate().toString(),request.mealPeriod(),request.address().strip(),items);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(db.stringify(canonical).getBytes(StandardCharsets.UTF_8)));
        } catch(Exception ex) { throw new IllegalStateException(ex); }
    }
}
