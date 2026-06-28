package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.Product;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProductRepository extends JpaRepository<Product, UUID> {
    Page<Product> findByTenantId(UUID tenantId, Pageable pageable);

    Optional<Product> findByIdAndTenantId(UUID id, UUID tenantId);

    boolean existsByTenantIdAndSlug(UUID tenantId, String slug);

    boolean existsByTenantIdAndSlugAndIdNot(UUID tenantId, String slug, UUID id);
}
