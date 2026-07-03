package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface InboundOrderRepository extends JpaRepository<InboundOrder, UUID>, InboundOrderRepositoryCustom {
    Optional<InboundOrder> findByTenantIdAndSourceAndIdempotencyKey(
            UUID tenantId,
            OrderSource source,
            String idempotencyKey
    );

    Optional<InboundOrder> findByTenantIdAndSourceAndExternalOrderId(
            UUID tenantId,
            OrderSource source,
            String externalOrderId
    );

    Optional<InboundOrder> findByInboundOrderIdAndTenantId(UUID inboundOrderId, UUID tenantId);

    long countByTenantIdAndStatusAndReceivedAtGreaterThanEqual(
            UUID tenantId,
            InboundOrderStatus status,
            Instant receivedAt
    );

    long countByTenantIdAndStatusAndNormalizedAtGreaterThanEqual(
            UUID tenantId,
            InboundOrderStatus status,
            Instant normalizedAt
    );

    Optional<InboundOrder> findFirstByTenantIdAndStatusOrderByReceivedAtDescInboundOrderIdAsc(
            UUID tenantId,
            InboundOrderStatus status
    );
}
