package com.nexora.backend.infrastructure.media;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.time.Duration;
import java.util.List;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.media")
public class MediaStorageProperties {
    private Path storageDir = Path.of("storage", "media");
    private String publicBasePath = "/media";
    private String publicBaseUrl = "";
    private long maxFileSizeBytes = 5 * 1024 * 1024;
    private Duration cacheMaxAge = Duration.ofDays(30);
    private List<String> allowedContentTypes = List.of("image/jpeg", "image/png", "image/webp");

    public String normalizedPublicBasePath() {
        String normalized = publicBasePath == null || publicBasePath.isBlank() ? "/media" : publicBasePath.trim();
        if (!normalized.startsWith("/")) {
            normalized = "/" + normalized;
        }
        return normalized.replaceAll("/+$", "");
    }

    public String normalizedPublicBaseUrl() {
        if (publicBaseUrl == null || publicBaseUrl.isBlank()) {
            return "";
        }
        return publicBaseUrl.trim().replaceAll("/+$", "");
    }

    public String publicUrlFor(String relativePath) {
        String normalizedRelativePath = relativePath == null ? "" : relativePath.replaceAll("^/+", "");
        String path = normalizedPublicBasePath() + "/" + normalizedRelativePath;
        String baseUrl = normalizedPublicBaseUrl();
        return baseUrl.isBlank() ? path : baseUrl + path;
    }

    public Path normalizedStorageDir() {
        return storageDir.toAbsolutePath().normalize();
    }
}
