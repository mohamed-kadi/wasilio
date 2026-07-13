package com.nexora.backend.infrastructure.media;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.concurrent.TimeUnit;

@Configuration
@RequiredArgsConstructor
public class MediaResourceConfig implements WebMvcConfigurer {

    private final MediaStorageProperties properties;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler(properties.normalizedPublicBasePath() + "/**")
                .addResourceLocations(storageLocation())
                .setCacheControl(CacheControl.maxAge(properties.getCacheMaxAge().toSeconds(), TimeUnit.SECONDS).cachePublic());
    }

    private String storageLocation() {
        String location = properties.normalizedStorageDir().toUri().toString();
        return location.endsWith("/") ? location : location + "/";
    }
}
