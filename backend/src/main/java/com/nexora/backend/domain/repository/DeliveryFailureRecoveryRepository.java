package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.DeliveryFailureRecovery;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeliveryFailureRecoveryRepository extends JpaRepository<DeliveryFailureRecovery, UUID> {
    List<DeliveryFailureRecovery> findByTenantIdAndOrderIdOrderByCreatedAtAsc(UUID tenantId, UUID orderId);
}
