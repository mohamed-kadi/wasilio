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
        name = "public_storefronts",
        indexes = {
                @Index(name = "idx_public_storefronts_tenant_id", columnList = "tenant_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PublicStorefront {
    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false, unique = true, length = 160)
    private String storeSlug;

    @Column(nullable = false)
    private String publicName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private PublicStorefrontStatus status;

    @Column(length = 50)
    private String supportChannelType;

    @Column(length = 255)
    private String supportChannelValue;

    @Column(nullable = false, length = 2)
    private String defaultCountryCode;

    @Column(nullable = false, length = 3)
    private String defaultCurrency;

    @Column(nullable = false, length = 255)
    private String phonePattern;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;
}
