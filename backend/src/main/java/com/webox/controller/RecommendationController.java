package com.webox.controller;

import com.webox.service.RecommendationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.LocalDate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/recommendations")
public class RecommendationController {
    private final RecommendationService service;

    public RecommendationController(RecommendationService service) {
        this.service = service;
    }

    public record Request(@NotBlank @Size(max = 500) String prompt, @NotNull LocalDate date) {}

    @PostMapping(produces = "text/event-stream")
    public SseEmitter recommend(@RequestAttribute long userId, @Valid @RequestBody Request body) {
        return service.recommend(userId, body.prompt(), body.date());
    }
}
