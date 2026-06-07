package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.Courier;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CourierRepository extends JpaRepository<Courier, UUID> {
    Optional<Courier> findByCourierIdAndTenantId(UUID courierId, UUID tenantId);
    Page<Courier> findByTenantId(UUID tenantId, Pageable pageable);
}
