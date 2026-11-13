package com.webox.common;

import java.time.Clock;
import com.webox.service.CatalogService;
import org.springframework.context.annotation.*;

@Configuration
public class TimeConfiguration {
    @Bean
    public Clock businessClock() {
        return Clock.system(CatalogService.ZONE);
    }
}
