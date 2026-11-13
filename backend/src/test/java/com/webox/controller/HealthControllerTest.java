package com.webox.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

class HealthControllerTest {
    private MockMvc mvc;
    private JdbcTemplate jdbc;
    private RedisConnection redisConnection;

    @BeforeEach
    void setup() {
        jdbc = mock(JdbcTemplate.class);
        var redis = mock(StringRedisTemplate.class);
        var factory = mock(RedisConnectionFactory.class);
        redisConnection = mock(RedisConnection.class);
        when(redis.getConnectionFactory()).thenReturn(factory);
        when(factory.getConnection()).thenReturn(redisConnection);
        when(jdbc.queryForObject("SELECT 1", Integer.class)).thenReturn(1);
        when(redisConnection.ping()).thenReturn("PONG");
        mvc = standaloneSetup(new HealthController(jdbc, redis)).build();
    }

    @Test
    void reportsUpOnlyWhenBothDependenciesRespond() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("UP"))
                .andExpect(jsonPath("$.data.mysql").value("UP"))
                .andExpect(jsonPath("$.data.redis").value("UP"));
        verify(redisConnection).close();
    }

    @Test
    void reportsServiceUnavailableWhenMysqlFails() throws Exception {
        when(jdbc.queryForObject("SELECT 1", Integer.class))
                .thenThrow(new RuntimeException("private details"));
        mvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.data.mysql").value("DOWN"))
                .andExpect(jsonPath("$.data.redis").value("UP"));
    }

    @Test
    void reportsServiceUnavailableWhenRedisFails() throws Exception {
        when(redisConnection.ping()).thenThrow(new RuntimeException("private details"));
        mvc.perform(get("/api/health"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.data.redis").value("DOWN"));
        verify(redisConnection).close();
    }
}
