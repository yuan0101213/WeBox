package com.webox.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;

public final class Requests {
    public record Credentials(
            @NotBlank @Email @Size(max = 200) String email,
            @NotBlank @Size(min = 8, max = 64) String password) {}

    public record Selection(
            @NotBlank @Size(max = 80) String groupId, @NotBlank @Size(max = 80) String optionId) {}

    public record Item(
            @NotNull @Positive Long dishId,
            @Min(1) @Max(99) int quantity,
            @NotNull @Size(max = 30) List<@NotNull @Valid Selection> selectedOptions) {}

    public record OrderRequest(
            @NotBlank @Pattern(regexp = "[a-fA-F0-9-]{36}") String requestId,
            @NotNull LocalDate deliveryDate,
            @NotBlank @Pattern(regexp = "Lunch|Dinner") String mealPeriod,
            @NotBlank @Size(max = 200) String address,
            @NotEmpty @Size(max = 100) List<@NotNull @Valid Item> items) {}
}
