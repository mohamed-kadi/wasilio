package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.OrderIntelligenceSnapshot;
import com.nexora.backend.domain.model.OrderIntelligenceLevel;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderIntelligenceSnapshotRepository extends JpaRepository<OrderIntelligenceSnapshot, UUID> {
    Optional<OrderIntelligenceSnapshot> findByTenantIdAndOrderId(UUID tenantId, UUID orderId);
    List<OrderIntelligenceSnapshot> findByTenantIdAndOrderIdIn(UUID tenantId, List<UUID> orderIds);
    List<OrderIntelligenceSnapshot> findByTenantId(UUID tenantId);
    List<OrderIntelligenceSnapshot> findByTenantIdAndLevelOrderByFraudRiskScoreDescCalculatedAtDesc(
            UUID tenantId,
            OrderIntelligenceLevel level,
            Pageable pageable
    );
}
