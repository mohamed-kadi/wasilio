package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.OrderSearchSavedView;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderSearchSavedViewRepository extends JpaRepository<OrderSearchSavedView, UUID> {
    List<OrderSearchSavedView> findByTenantIdOrderByNameAscViewIdAsc(UUID tenantId);
    Optional<OrderSearchSavedView> findByViewIdAndTenantId(UUID viewId, UUID tenantId);
    boolean existsByTenantIdAndNameIgnoreCase(UUID tenantId, String name);
}
