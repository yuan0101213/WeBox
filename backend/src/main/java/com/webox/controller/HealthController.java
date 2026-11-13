package com.webox.controller;

import java.util.Map;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private final JdbcTemplate jdbc;
    private final StringRedisTemplate redis;

    public HealthController(JdbcTemplate jdbc, StringRedisTemplate redis) {
        this.jdbc = jdbc;
        this.redis = redis;
    }

    @GetMapping("/api/health")
    public ResponseEntity<Map<String, Object>> health() {
        String mysqlStatus = "DOWN";
        String redisStatus = "DOWN";
        try {
            if (Integer.valueOf(1).equals(jdbc.queryForObject("SELECT 1", Integer.class))) {
                mysqlStatus = "UP";
            }
        } catch (RuntimeException ignored) {
            // Do not expose dependency credentials or connection details.
        }
        try (var connection = redis.getConnectionFactory().getConnection()) {
            if ("PONG".equals(connection.ping())) redisStatus = "UP";
        } catch (RuntimeException ignored) {
            // A failed dependency must produce HTTP 503.
        }
        boolean ready = "UP".equals(mysqlStatus) && "UP".equals(redisStatus);
        return ResponseEntity.status(ready ? 200 : 503)
                .body(
                        Map.of(
                                "data",
                                Map.of(
                                        "status",
                                        ready ? "UP" : "DOWN",
                                        "mysql",
                                        mysqlStatus,
                                        "redis",
                                        redisStatus)));
    }
}
