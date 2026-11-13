package com.webox.service;

import com.webox.repository.WeBoxRepository;
import com.webox.common.ApiException;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class PreferencesService {
    private final WeBoxRepository db;
    public static final Set<String> ALLERGENS =
            Set.of("Peanuts", "Dairy", "Egg", "Gluten", "Soy", "Fish", "Shellfish");
    public static final Set<String> CUISINES =
            Set.of("Chinese", "Western", "Japanese", "Light Meal", "Korean", "Southeast Asian");

    public record Preferences(
            List<String> allergens,
            List<String> cuisines,
            String spiceLevel,
            String taste,
            Integer budgetMinFen,
            Integer budgetMaxFen) {}

    public PreferencesService(WeBoxRepository db) {
        this.db = db;
    }

    public Object get(long id) {
        var row = db.one("SELECT preferences_json FROM user_preferences WHERE user_id=?", id);
        return row == null
                ? new Preferences(List.of(), List.of(), "None", "Moderate", 1500, 3000)
                : db.json(row.get("preferences_json"));
    }

    public Object save(long id, Preferences p) {
        if (p.allergens() == null
                || p.cuisines() == null
                || p.allergens().size() > 30
                || p.allergens().stream().anyMatch(a -> a == null || a.isBlank() || a.length() > 80)
                || p.allergens().stream().anyMatch(a -> !ALLERGENS.contains(a))
                || p.cuisines().size() > 6
                || p.cuisines().stream().anyMatch(a -> a == null || !CUISINES.contains(a))
                || p.spiceLevel() == null
                || !Set.of("None", "Mild", "Medium", "Hot").contains(p.spiceLevel())
                || p.taste() == null
                || !Set.of("Light", "Moderate", "Strong").contains(p.taste())
                || p.budgetMinFen() == null
                || p.budgetMaxFen() == null
                || p.budgetMinFen() < 0
                || p.budgetMaxFen() < p.budgetMinFen()
                || p.budgetMaxFen() > 1000000)
            throw ApiException.bad("Invalid preferences or budget range.");
        db.update(
                "INSERT INTO user_preferences(user_id,preferences_json) VALUES (?,?) ON DUPLICATE KEY UPDATE preferences_json=VALUES(preferences_json)",
                id,
                db.stringify(p));
        return p;
    }
}
