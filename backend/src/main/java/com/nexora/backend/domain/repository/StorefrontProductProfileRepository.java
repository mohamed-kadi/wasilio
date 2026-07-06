package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.StorefrontProductProfile;
import com.nexora.backend.domain.model.StorefrontProductProfileStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface StorefrontProductProfileRepository extends JpaRepository<StorefrontProductProfile, UUID> {
    Optional<StorefrontProductProfile> findByTenantIdAndProductId(UUID tenantId, UUID productId);

    Optional<StorefrontProductProfile> findByTenantIdAndProductIdAndStatus(
            UUID tenantId,
            UUID productId,
            StorefrontProductProfileStatus status
    );
}
