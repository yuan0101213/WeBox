package com.webox.controller;
import com.webox.service.*;
import com.webox.repository.WeBoxRepository;
import com.webox.common.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.*;
import java.util.*;
import java.nio.file.*;
@RestController
@RequestMapping("/api/console")
public class ConsoleController {
 private final WeBoxRepository db; private final CatalogService catalog; private final TransactionTemplate tx; private final InventoryService inventory; private final MenuCacheService cache;
 public ConsoleController(WeBoxRepository db,CatalogService catalog,TransactionTemplate tx,InventoryService inventory,MenuCacheService cache){this.inventory=inventory;this.cache=cache;this.db=db;this.catalog=catalog;this.tx=tx;}
 private Object data(Object v){return Map.of("data",v);}
 @GetMapping("/dishes") public Object dishes(@RequestParam(defaultValue="") String keyword,@RequestParam(defaultValue="") String categories,@RequestParam(defaultValue="1") int page,@RequestParam(defaultValue="20") int pageSize){
  if(page<1||page>100000||pageSize<1||pageSize>50||keyword.length()>50)throw ApiException.bad("Invalid pagination or search.");
  Map<String,Object> args=new HashMap<>();args.put("keyword","%"+keyword.replace("!","!!").replace("%","!%").replace("_","!_")+"%");args.put("size",pageSize);args.put("offset",(page-1)*pageSize);
  String where=" FROM dishes WHERE (name LIKE :keyword ESCAPE '!' OR description LIKE :keyword ESCAPE '!')";
  if(!categories.isBlank()){args.put("categories",Arrays.asList(categories.split(",")));where+=" AND category IN (:categories)";}
  var rows=db.namedQuery("SELECT *"+where+" ORDER BY id DESC LIMIT :size OFFSET :offset",args).stream().map(r->{var m=new LinkedHashMap<>(catalog.map(r));m.put("active",r.get("active"));return m;}).toList();
  return data(Map.of("items",rows,"total",db.namedQuery("SELECT COUNT(*) AS total"+where,args).get(0).get("total")));
 }
 private Object dishData(long id){var row=db.one("SELECT * FROM dishes WHERE id=?",id);var result=new LinkedHashMap<>(catalog.map(row));result.put("active",row.get("active"));return data(result);}
 private boolean text(JsonNode b,String key,int max){return b.path(key).isTextual()&&!b.path(key).asText().isBlank()&&b.path(key).asText().length()<=max;}
 private Object[] values(JsonNode b){
  if(!b.path("name").isTextual()||b.path("name").asText().isBlank()||b.path("name").asText().length()>200||!b.path("description").isTextual()||b.path("description").asText().length()>2000||!b.path("priceFen").isIntegralNumber()||b.path("priceFen").asLong()<0||b.path("priceFen").asLong()>1000000||!PreferencesService.CUISINES.contains(b.path("category").asText())||!Set.of("None","Mild","Medium","Hot").contains(b.path("spiceLevel").asText())||!b.path("imageUrl").isTextual()||b.path("imageUrl").asText().length()>500||!b.path("proteins").isArray()||!b.path("allergens").isArray()||!b.path("optionGroups").isArray()||!b.path("active").isBoolean())throw ApiException.bad("Invalid dish fields.");
  String image=b.path("imageUrl").asText();if(!(image.startsWith("/uploads/")||image.startsWith("https://")||image.startsWith("/images/")||image.startsWith("/product-images/")||image.isBlank()))throw ApiException.bad("Image URL must use HTTPS or a local image path.");
  for(String field:List.of("proteins","allergens")){if(b.get(field).size()>30)throw ApiException.bad("Too many dish tags.");for(var tag:b.get(field))if(!tag.isTextual()||tag.asText().isBlank()||tag.asText().length()>80)throw ApiException.bad("Invalid dish tags.");}
  for(var allergen:b.get("allergens"))if(!PreferencesService.ALLERGENS.contains(allergen.asText()))throw ApiException.bad("Invalid allergen.");
  Set<String> groupIds=new HashSet<>();if(b.get("optionGroups").size()>30)throw ApiException.bad("Too many option groups.");
  for(var group:b.get("optionGroups")){
   if(!text(group,"id",80)||!text(group,"name",200)||!groupIds.add(group.path("id").asText())||!group.path("options").isArray()||group.path("options").size()>30||!group.path("minSelect").isInt()||!group.path("maxSelect").isInt()||group.path("minSelect").asInt()<0||group.path("maxSelect").asInt()<group.path("minSelect").asInt()||group.path("maxSelect").asInt()>group.path("options").size())throw ApiException.bad("Invalid option group.");
   Set<String> optionIds=new HashSet<>();for(var option:group.path("options"))if(!text(option,"id",80)||!text(option,"name",200)||!optionIds.add(option.path("id").asText())||!option.path("extraPriceFen").isIntegralNumber()||option.path("extraPriceFen").asLong()<0||option.path("extraPriceFen").asLong()>1000000)throw ApiException.bad("Invalid customization option.");
  }
  return new Object[]{b.path("name").asText().strip(),b.path("description").asText(),b.path("priceFen").asLong(),b.path("category").asText(),image,db.stringify(b.get("proteins")),db.stringify(b.get("allergens")),b.path("spiceLevel").asText(),db.stringify(b.get("optionGroups")),b.path("active").asBoolean()};
 }
 @PostMapping("/dishes") public Object create(@RequestBody JsonNode body){long id=db.insert("INSERT INTO dishes(name,description,price_fen,category,image_url,proteins_json,allergens_json,spice_level,option_groups_json,active) VALUES (?,?,?,?,?,?,?,?,?,?)",values(body));return dishData(id);}
 @PutMapping("/dishes/{id}") public Object update(@PathVariable long id,@RequestBody JsonNode body){var args=new ArrayList<>(Arrays.asList(values(body)));args.add(id);if(db.one("SELECT id FROM dishes WHERE id=?",id)==null)throw ApiException.missing();cache.dishChanging(id);db.update("UPDATE dishes SET name=?,description=?,price_fen=?,category=?,image_url=?,proteins_json=?,allergens_json=?,spice_level=?,option_groups_json=?,active=? WHERE id=?",args.toArray());cache.dishChanging(id);return dishData(id);}
 @PatchMapping("/dishes/{id}/status") public Object status(@PathVariable long id,@RequestBody JsonNode body){if(!body.path("active").isBoolean())throw ApiException.bad("Active must be boolean.");if(db.one("SELECT id FROM dishes WHERE id=?",id)==null)throw ApiException.missing();cache.dishChanging(id);db.update("UPDATE dishes SET active=? WHERE id=?",body.get("active").asBoolean(),id);cache.dishChanging(id);return data(Map.of("id",id,"active",body.get("active").asBoolean()));}
 @GetMapping("/menu") public Object menu(@RequestParam LocalDate date){return data(db.query("SELECT dish_id AS dishId,supply_quantity AS supplyQuantity,remaining_quantity AS remainingQuantity FROM daily_menu_items WHERE menu_date=? ORDER BY dish_id",date));}
 @PutMapping("/menu") public Object menu(@RequestBody JsonNode body){LocalDate date;try{date=LocalDate.parse(body.path("date").asText());}catch(Exception e){throw ApiException.bad("Invalid date.");}if(date.isBefore(LocalDate.now(CatalogService.ZONE))||!body.path("items").isArray()||body.get("items").size()>1000)throw ApiException.bad("Choose today or a future date and menu items.");Set<Long> ids=new HashSet<>();for(var item:body.get("items")){if(!item.path("dishId").isIntegralNumber()||!item.path("supplyQuantity").isInt()||item.path("supplyQuantity").asInt()<0||!ids.add(item.path("dishId").asLong())||db.one("SELECT id FROM dishes WHERE id=?",item.path("dishId").asLong())==null)throw ApiException.bad("Invalid or duplicate menu dish or supply quantity.");}tx.execute(status->{inventory.replace(date,body.get("items"));return null;});return menu(date);}
 @PostMapping("/images") public Object image(@RequestParam MultipartFile file)throws java.io.IOException{
  if(file.isEmpty()||file.getSize()>5*1024*1024)throw ApiException.bad("Image must be at most 5 MB.");byte[] bytes=file.getBytes();String ext=null;
  if(bytes.length>=12){if((bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255)ext="jpg";else if(Arrays.equals(Arrays.copyOf(bytes,8),new byte[]{(byte)137,80,78,71,13,10,26,10}))ext="png";else if(new String(bytes,0,4,java.nio.charset.StandardCharsets.US_ASCII).equals("RIFF")&&new String(bytes,8,4,java.nio.charset.StandardCharsets.US_ASCII).equals("WEBP"))ext="webp";}
  if(ext==null)throw ApiException.bad("Only JPEG, PNG and WEBP images are accepted.");Path dir=Path.of("uploads").toAbsolutePath();Files.createDirectories(dir);String name=UUID.randomUUID()+"."+ext;Files.write(dir.resolve(name),bytes,StandardOpenOption.CREATE_NEW);return data(Map.of("url","/uploads/"+name));
 }
}
