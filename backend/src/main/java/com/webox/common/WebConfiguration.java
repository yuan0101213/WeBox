package com.webox.common;

import com.webox.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    private final AuthService auth;

    public WebConfiguration(AuthService auth) {
        this.auth = auth;
    }

    @Override
    public void addResourceHandlers(
            org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(
                        java.nio.file.Path.of("uploads").toAbsolutePath().toUri().toString() + "/");
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(
                        new HandlerInterceptor() {
                            @Override
                            public boolean preHandle(
                                    HttpServletRequest request,
                                    HttpServletResponse response,
                                    Object handler) {
                                long userId = auth.authenticate(request.getHeader("Authorization"));
                                request.setAttribute("userId", userId);
                                if (request.getRequestURI().startsWith("/api/console/")
                                        && !"SUPER_ADMIN".equals(auth.user(userId).get("role")))
                                    throw new ApiException(
                                            403,
                                            "FORBIDDEN",
                                            "Super administrator access is required.");
                                return true;
                            }
                        })
                .addPathPatterns("/api/**")
                .excludePathPatterns("/api/health", "/api/auth/login", "/api/auth/register");
    }
}
