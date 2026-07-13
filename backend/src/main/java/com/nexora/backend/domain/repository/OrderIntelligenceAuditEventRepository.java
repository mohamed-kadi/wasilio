package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.OrderIntelligenceAuditEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface OrderIntelligenceAuditEventRepository extends JpaRepository<OrderIntelligenceAuditEvent, UUID> {
    List<OrderIntelligenceAuditEvent> findByTenantIdAndOrderIdOrderBySequenceNumberDescCalculatedAtDesc(
            UUID tenantId,
            UUID orderId,
            Pageable pageable
    );

    long countByTenantIdAndOrderId(UUID tenantId, UUID orderId);

    List<OrderIntelligenceAuditEvent> findByTenantIdOrderByCalculatedAtDescSequenceNumberDesc(UUID tenantId, Pageable pageable);

    @Query("""
            select count(event)
            from OrderIntelligenceAuditEvent event
            where event.tenantId = :tenantId
              and event.confidenceDelta >= 0
              and event.riskDelta < 0
            """)
    long countImprovedMovements(@Param("tenantId") UUID tenantId);

    @Query("""
            select count(event)
            from OrderIntelligenceAuditEvent event
            where event.tenantId = :tenantId
              and (event.confidenceDelta < 0 or event.riskDelta > 0)
            """)
    long countRiskIncreasedMovements(@Param("tenantId") UUID tenantId);

    @Query("""
            select count(event)
            from OrderIntelligenceAuditEvent event
            where event.tenantId = :tenantId
              and event.previousLevel is not null
              and event.previousLevel <> event.level
            """)
    long countLevelChangedMovements(@Param("tenantId") UUID tenantId);
}
