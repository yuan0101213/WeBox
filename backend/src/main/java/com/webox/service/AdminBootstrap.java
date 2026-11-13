package com.webox.service;
import com.webox.repository.WeBoxRepository;
import org.springframework.stereotype.Component;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.ApplicationArguments;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.beans.factory.annotation.Value;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
@Component
public class AdminBootstrap implements ApplicationRunner {
 private final WeBoxRepository db;private final String email,password;
 public AdminBootstrap(WeBoxRepository db,@Value("${WEBOX_ADMIN_EMAIL:}") String email,@Value("${WEBOX_ADMIN_PASSWORD:}") String password){this.db=db;this.email=email;this.password=password;}
 public void run(ApplicationArguments args){
  if(email.isBlank()&&password.isBlank())return;
  if(!email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")||email.length()>200||password.length()<8||password.getBytes(StandardCharsets.UTF_8).length>72||!password.matches("(?s).*[a-zA-Z].*")||!password.matches("(?s).*[0-9].*"))throw new IllegalArgumentException("Set valid WEBOX_ADMIN_EMAIL and WEBOX_ADMIN_PASSWORD (8+ characters with letters and numbers, at most 72 bytes).");
  db.update("INSERT INTO users(email,password_hash,role) VALUES (?,?,'SUPER_ADMIN') ON DUPLICATE KEY UPDATE role='SUPER_ADMIN'",email.strip().toLowerCase(Locale.ROOT),new BCryptPasswordEncoder().encode(password));
 }
}
