package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.PublicStorefront;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PublicStorefrontRepository extends JpaRepository<PublicStorefront, UUID> {
    Optional<PublicStorefront> findByStoreSlug(String storeSlug);

    Optional<PublicStorefront> findFirstByTenantIdOrderByCreatedAtAsc(UUID tenantId);
}
