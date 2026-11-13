package com.webox.service;

import com.webox.common.ApiException;
import com.webox.dto.Requests.Credentials;
import com.webox.repository.WeBoxRepository;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final WeBoxRepository db;
    private final StringRedisTemplate redis;
    private final int ttl;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder();
    public AuthService(WeBoxRepository db, StringRedisTemplate redis, @Value("${webox.auth.token-ttl-seconds}") int ttl) {
        this.db=db; this.redis=redis; this.ttl=ttl;
    }
    public Map<String,Object> register(Credentials input) {
        String email = input.email().strip().toLowerCase(Locale.ROOT);
        String password = input.password();
        if (!password.matches("(?s).*[a-zA-Z].*") || !password.matches("(?s).*[0-9].*") || password.getBytes(StandardCharsets.UTF_8).length > 72)
            throw ApiException.bad("Password must contain letters and numbers and be no more than 72 UTF-8 bytes.");
        try {
            long id = db.insert("INSERT INTO users(email,password_hash) VALUES (?,?)", email, passwords.encode(password));
            return user(id);
        } catch (DuplicateKeyException ex) {
            throw new ApiException(409,"EMAIL_ALREADY_REGISTERED","This email is already registered.");
        }
    }
    public Map<String,Object> login(Credentials input) {
        var row = db.one("SELECT id,password_hash FROM users WHERE email=?",input.email().strip().toLowerCase(Locale.ROOT));
        if (row==null || input.password().getBytes(StandardCharsets.UTF_8).length > 72 || !passwords.matches(input.password(), row.get("password_hash").toString()))
            throw new ApiException(401,"INVALID_CREDENTIALS","Incorrect email or password.");
        long id = ((Number)row.get("id")).longValue();
        String token = UUID.randomUUID().toString();
        redis.opsForValue().set("webox:login:"+token,Long.toString(id),Duration.ofSeconds(ttl));
        return Map.of("token",token,"expiresIn",ttl,"user",user(id));
    }
    public long authenticate(String header) {
        if (header == null || !header.startsWith("Bearer ") || header.length() > 100) throw expired();
        String id = redis.opsForValue().get("webox:login:"+header.substring(7));
        if (id == null) throw expired();
        return Long.parseLong(id);
    }
    public void logout(String header) { redis.delete("webox:login:"+header.substring(7)); }
    public Map<String,Object> user(long id) {
        var user = db.one("SELECT id,email,role FROM users WHERE id=?",id);
        if (user==null) throw expired();
        return user;
    }
    private ApiException expired() { return new ApiException(401,"SESSION_EXPIRED","Your session has expired. Please log in again."); }
}
