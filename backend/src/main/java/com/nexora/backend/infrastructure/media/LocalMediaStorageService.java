package com.nexora.backend.infrastructure.media;

import com.nexora.backend.domain.model.MediaAssetPurpose;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocalMediaStorageService {

    private final MediaStorageProperties properties;

    public StoredMedia store(
            UUID tenantId,
            UUID productId,
            MediaAssetPurpose purpose,
            String extension,
            byte[] bytes
    ) throws IOException {
        String relativePath = String.join("/",
                tenantId.toString(),
                "products",
                productId.toString(),
                purpose.name().toLowerCase(Locale.ROOT),
                UUID.randomUUID() + "." + extension
        );
        Path root = properties.normalizedStorageDir();
        Path target = root.resolve(relativePath).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalStateException("Media storage path resolved outside configured storage directory");
        }

        Files.createDirectories(target.getParent());
        Files.write(target, bytes, StandardOpenOption.CREATE_NEW);
        return new StoredMedia(
                relativePath,
                properties.publicUrlFor(relativePath)
        );
    }

    public record StoredMedia(String storagePath, String publicUrl) {
    }
}
