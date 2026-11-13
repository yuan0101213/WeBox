package com.webox.service;

import com.webox.common.ApiException;
import com.webox.repository.WeBoxRepository;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class CatalogService {
    private final WeBoxRepository db;
    private final MenuCacheService cache;
    public static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");

    public CatalogService(WeBoxRepository db, MenuCacheService cache) {
        this.db = db;
        this.cache = cache;
    }

    public Map<String, Object> menu(
            LocalDate date,
            String keyword,
            String categories,
            int page,
            int pageSize,
            long userId,
            boolean recommend) {
        if (page < 1 || page > 100000 || pageSize < 1 || pageSize > 50 || keyword.length() > 50)
            throw ApiException.bad("Invalid pagination or search keyword (maximum 50 characters).");
        Set<String> selected = new HashSet<>();
        if (!categories.isBlank()) {
            selected.addAll(
                    Arrays.stream(categories.split(","))
                            .map(String::strip)
                            .filter(v -> !v.isBlank())
                            .toList());
            if (selected.size() > 6 || selected.isEmpty())
                throw ApiException.bad("Invalid categories.");
        }
        String term = keyword.strip().toLowerCase(Locale.ROOT);
        var rows =
                new ArrayList<>(
                        cache.get(date).stream()
                                .filter(
                                        r ->
                                                selected.isEmpty()
                                                        || selected.contains(
                                                                r.get("category").toString()))
                                .filter(
                                        r ->
                                                term.isEmpty()
                                                        || r.get("name")
                                                                .toString()
                                                                .toLowerCase(Locale.ROOT)
                                                                .contains(term)
                                                        || r.get("description")
                                                                .toString()
                                                                .toLowerCase(Locale.ROOT)
                                                                .contains(term))
                                .toList());
        if (recommend) {
            var pref =
                    db.one("SELECT preferences_json FROM user_preferences WHERE user_id=?", userId);
            if (pref != null) {
                var json =
                        (com.fasterxml.jackson.databind.JsonNode)
                                db.json(pref.get("preferences_json"));
                Set<String> cuisines = new HashSet<>();
                json.path("cuisines").forEach(v -> cuisines.add(v.asText()));
                rows.sort(
                        Comparator.<Map<String, Object>>comparingInt(
                                        r ->
                                                cuisines.contains(r.get("category").toString())
                                                        ? 0
                                                        : 1)
                                .thenComparingInt(
                                        r ->
                                                json.path("spiceLevel")
                                                                .asText()
                                                                .equals(r.get("spice_level"))
                                                        ? 0
                                                        : 1));
            }
        }
        var items =
                rows.stream()
                        .skip((long) (page - 1) * pageSize)
                        .limit(pageSize)
                        .map(this::map)
                        .toList();
        return Map.of(
                "items",
                items,
                "total",
                rows.size(),
                "page",
                page,
                "pageSize",
                pageSize,
                "date",
                date.toString());
    }

    public Map<String, Object> detail(long id) {
        var dish = db.one("SELECT * FROM dishes WHERE id=? AND active=TRUE", id);
        if (dish == null) throw ApiException.missing();
        return map(dish);
    }

    public Map<String, Object> available(long id, LocalDate date) {
        var dish =
                db.one(
                        "SELECT d.*,m.supply_quantity,m.remaining_quantity FROM dishes d JOIN daily_menu_items m ON m.dish_id=d.id WHERE d.id=? AND d.active=TRUE AND m.menu_date=?",
                        id,
                        date);
        if (dish == null)
            throw ApiException.bad(
                    "A selected dish is not available on the delivery date. Please update your cart or date.");
        return map(dish);
    }

    public Map<String, Object> map(Map<String, Object> row) {
        var result =
                new LinkedHashMap<String, Object>(
                        Map.ofEntries(
                                Map.entry("id", row.get("id")),
                                Map.entry("name", row.get("name")),
                                Map.entry("description", row.get("description")),
                                Map.entry("priceFen", row.get("price_fen")),
                                Map.entry("category", row.get("category")),
                                Map.entry("imageUrl", row.get("image_url")),
                                Map.entry("proteins", db.json(row.get("proteins_json"))),
                                Map.entry("allergens", db.json(row.get("allergens_json"))),
                                Map.entry("spiceLevel", row.get("spice_level")),
                                Map.entry("optionGroups", db.json(row.get("option_groups_json")))));
        if (row.containsKey("remaining_quantity")) {
            result.put("remainingQuantity", row.get("remaining_quantity"));
            result.put("supplyQuantity", row.get("supply_quantity"));
        }
        return result;
    }
}
