package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.OrderSource;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface InboundOrderRepository extends JpaRepository<InboundOrder, UUID> {
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
}
