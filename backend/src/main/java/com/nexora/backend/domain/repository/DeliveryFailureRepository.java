package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.DeliveryFailure;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryFailureRepository extends JpaRepository<DeliveryFailure, UUID> {
    Optional<DeliveryFailure> findByOrderIdAndTenantId(UUID orderId, UUID tenantId);

    List<DeliveryFailure> findByTenantIdAndOrderIdOrderByCreatedAtAsc(UUID tenantId, UUID orderId);
}
