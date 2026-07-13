package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.OrderIntelligenceSignal;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface OrderIntelligenceSignalRepository extends JpaRepository<OrderIntelligenceSignal, UUID> {
    List<OrderIntelligenceSignal> findByTenantIdAndOrderIdOrderBySortRankAsc(UUID tenantId, UUID orderId);
    List<OrderIntelligenceSignal> findByTenantId(UUID tenantId);
    void deleteByTenantIdAndOrderId(UUID tenantId, UUID orderId);
}
