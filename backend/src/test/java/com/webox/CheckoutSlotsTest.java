package com.webox;

import com.webox.service.*;
import java.time.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CheckoutSlotsTest {
    private final LocalDate date = LocalDate.of(2026, 11, 13);

    private CheckoutSlots.Slot at(String meal, String time) {
        return CheckoutSlots.resolve(
                date, meal, ZonedDateTime.of(date, LocalTime.parse(time), CatalogService.ZONE));
    }

    @Test
    void lunchBoundary() {
        assertFalse(at("Lunch", "09:59:59").adjusted());
        assertEquals("Dinner", at("Lunch", "10:00:00").mealPeriod());
    }

    @Test
    void dinnerBoundary() {
        assertFalse(at("Dinner", "14:59:59").adjusted());
        assertEquals(date.plusDays(1), at("Dinner", "15:00:00").deliveryDate());
        assertEquals("Lunch", at("Lunch", "15:00:00").mealPeriod());
    }

    @Test
    void futureDateRemainsAvailable() {
        var slot =
                CheckoutSlots.resolve(
                        date.plusDays(1),
                        "Lunch",
                        ZonedDateTime.of(date, LocalTime.of(23, 59), CatalogService.ZONE));
        assertFalse(slot.adjusted());
        assertEquals(date.plusDays(1), slot.deliveryDate());
    }

    @Test
    void pastDatesRejected() {
        assertThrows(
                RuntimeException.class,
                () ->
                        CheckoutSlots.resolve(
                                date.minusDays(1),
                                "Lunch",
                                date.atStartOfDay(CatalogService.ZONE)));
    }
}
