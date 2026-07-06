package com.nexora.backend.domain.model;

import com.nexora.backend.infrastructure.persistence.StorefrontProfileFaqItemListJsonConverter;
import com.nexora.backend.infrastructure.persistence.StorefrontProfileFeatureListJsonConverter;
import com.nexora.backend.infrastructure.persistence.StorefrontProfileTrustBadgeListJsonConverter;
import com.nexora.backend.infrastructure.persistence.StringListJsonConverter;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(
        name = "storefront_product_profiles",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_storefront_product_profiles_tenant_product",
                columnNames = {"tenant_id", "product_id"}
        ),
        indexes = {
                @Index(name = "idx_storefront_product_profiles_tenant_status", columnList = "tenant_id,status")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StorefrontProductProfile {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID productId;

    @Column(length = 255)
    private String headline;

    @Column(length = 500)
    private String subheadline;

    @Builder.Default
    @Convert(converter = StringListJsonConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<String> benefits = List.of();

    @Builder.Default
    @Convert(converter = StorefrontProfileFeatureListJsonConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<StorefrontProfileFeature> features = List.of();

    @Builder.Default
    @Convert(converter = StorefrontProfileFaqItemListJsonConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<StorefrontProfileFaqItem> faq = List.of();

    @Builder.Default
    @Convert(converter = StorefrontProfileTrustBadgeListJsonConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<StorefrontProfileTrustBadge> trustBadges = List.of();

    @Builder.Default
    @Convert(converter = StringListJsonConverter.class)
    @Column(nullable = false, columnDefinition = "TEXT")
    private List<String> galleryImageUrls = List.of();

    @Column(length = 255)
    private String seoTitle;

    @Column(length = 500)
    private String seoDescription;

    @Column(length = 1000)
    private String seoImageUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private StorefrontProductProfileStatus status;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;
}
