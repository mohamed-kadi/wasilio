package com.nexora.backend.domain.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "media_assets",
        indexes = {
                @Index(name = "idx_media_assets_tenant_product", columnList = "tenant_id,product_id,created_at"),
                @Index(name = "idx_media_assets_tenant_purpose", columnList = "tenant_id,purpose,created_at")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MediaAsset {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID productId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private MediaAssetPurpose purpose;

    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Column(nullable = false)
    private long sizeBytes;

    @Column(nullable = false, length = 1000)
    private String storagePath;

    @Column(nullable = false, length = 1000)
    private String publicUrl;

    @Column(nullable = false, length = 64)
    private String checksumSha256;

    @Column(nullable = false, length = 255)
    private String uploadedBy;

    @Column(nullable = false)
    private Instant createdAt;
}
