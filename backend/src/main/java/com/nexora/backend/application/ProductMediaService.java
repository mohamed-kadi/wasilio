package com.nexora.backend.application;

import com.nexora.backend.domain.model.MediaAsset;
import com.nexora.backend.domain.model.MediaAssetPurpose;
import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.repository.MediaAssetRepository;
import com.nexora.backend.domain.repository.ProductRepository;
import com.nexora.backend.infrastructure.media.LocalMediaStorageService;
import com.nexora.backend.infrastructure.media.MediaStorageProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProductMediaService {

    private static final String DEFAULT_UPLOADER = "system";

    private final ProductRepository productRepository;
    private final MediaAssetRepository mediaAssetRepository;
    private final LocalMediaStorageService storageService;
    private final MediaStorageProperties properties;
    private final Clock clock;

    @Transactional
    public ProductMediaUploadResult uploadProductMedia(
            UUID tenantId,
            UUID productId,
            MediaAssetPurpose purpose,
            MultipartFile file,
            String uploadedBy
    ) {
        Product product = productRepository.findByIdAndTenantId(productId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
        MediaAssetPurpose resolvedPurpose = purpose == null ? MediaAssetPurpose.PRODUCT_IMAGE : purpose;
        ValidatedMedia validated = validate(file);

        LocalMediaStorageService.StoredMedia storedMedia;
        try {
            storedMedia = storageService.store(
                    tenantId,
                    productId,
                    resolvedPurpose,
                    validated.extension(),
                    validated.bytes()
            );
        } catch (IOException ex) {
            throw new IllegalStateException("Could not store media upload", ex);
        }

        Instant now = Instant.now(clock);
        MediaAsset mediaAsset = mediaAssetRepository.save(MediaAsset.builder()
                .id(UUID.randomUUID())
                .tenantId(tenantId)
                .productId(productId)
                .purpose(resolvedPurpose)
                .originalFilename(normalizeOriginalFilename(file.getOriginalFilename()))
                .contentType(validated.contentType())
                .sizeBytes(validated.bytes().length)
                .storagePath(storedMedia.storagePath())
                .publicUrl(storedMedia.publicUrl())
                .checksumSha256(sha256(validated.bytes()))
                .uploadedBy(normalizeUploader(uploadedBy))
                .createdAt(now)
                .build());

        if (resolvedPurpose == MediaAssetPurpose.PRODUCT_IMAGE) {
            product.setImageUrl(mediaAsset.getPublicUrl());
            product.setUpdatedAt(now);
        }

        return ProductMediaUploadResult.from(mediaAsset);
    }

    private ValidatedMedia validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Image file is required");
        }
        if (file.getSize() > properties.getMaxFileSizeBytes()) {
            throw new IllegalArgumentException("Image file is larger than the allowed limit");
        }

        String contentType = normalizeContentType(file.getContentType());
        if (!properties.getAllowedContentTypes().contains(contentType)) {
            throw new IllegalArgumentException("Image must be JPEG, PNG, or WebP");
        }

        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException ex) {
            throw new IllegalArgumentException("Image file could not be read", ex);
        }

        if (!matchesMagicBytes(contentType, bytes)) {
            throw new IllegalArgumentException("Image file content does not match its media type");
        }

        return new ValidatedMedia(contentType, extensionFor(contentType), bytes);
    }

    private boolean matchesMagicBytes(String contentType, byte[] bytes) {
        if ("image/jpeg".equals(contentType)) {
            return bytes.length >= 3
                    && (bytes[0] & 0xff) == 0xff
                    && (bytes[1] & 0xff) == 0xd8
                    && (bytes[2] & 0xff) == 0xff;
        }
        if ("image/png".equals(contentType)) {
            byte[] signature = new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
            if (bytes.length < signature.length) {
                return false;
            }
            for (int index = 0; index < signature.length; index++) {
                if (bytes[index] != signature[index]) {
                    return false;
                }
            }
            return true;
        }
        if ("image/webp".equals(contentType)) {
            return bytes.length >= 12
                    && bytes[0] == 'R'
                    && bytes[1] == 'I'
                    && bytes[2] == 'F'
                    && bytes[3] == 'F'
                    && bytes[8] == 'W'
                    && bytes[9] == 'E'
                    && bytes[10] == 'B'
                    && bytes[11] == 'P';
        }
        return false;
    }

    private String normalizeContentType(String contentType) {
        if (contentType == null || contentType.isBlank()) {
            return "";
        }
        return contentType.trim().toLowerCase(Locale.ROOT);
    }

    private String extensionFor(String contentType) {
        return switch (contentType) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            default -> throw new IllegalArgumentException("Unsupported image media type");
        };
    }

    private String normalizeOriginalFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) {
            return "upload";
        }
        String normalized = originalFilename.trim().replaceAll("[\\\\/]+", "-");
        return normalized.length() > 255 ? normalized.substring(normalized.length() - 255) : normalized;
    }

    private String normalizeUploader(String uploadedBy) {
        if (uploadedBy == null || uploadedBy.isBlank()) {
            return DEFAULT_UPLOADER;
        }
        String normalized = uploadedBy.trim();
        return normalized.length() > 255 ? normalized.substring(0, 255) : normalized;
    }

    private String sha256(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 digest is not available", ex);
        }
    }

    private record ValidatedMedia(String contentType, String extension, byte[] bytes) {
    }

    public record ProductMediaUploadResult(
            UUID mediaId,
            UUID productId,
            MediaAssetPurpose purpose,
            String originalFilename,
            String contentType,
            long sizeBytes,
            String publicUrl,
            Instant createdAt
    ) {
        static ProductMediaUploadResult from(MediaAsset mediaAsset) {
            return new ProductMediaUploadResult(
                    mediaAsset.getId(),
                    mediaAsset.getProductId(),
                    mediaAsset.getPurpose(),
                    mediaAsset.getOriginalFilename(),
                    mediaAsset.getContentType(),
                    mediaAsset.getSizeBytes(),
                    mediaAsset.getPublicUrl(),
                    mediaAsset.getCreatedAt()
            );
        }
    }
}
