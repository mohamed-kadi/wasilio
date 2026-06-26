package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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

    Optional<InboundOrder> findByInboundOrderIdAndTenantId(UUID inboundOrderId, UUID tenantId);

    @Query("""
            select inboundOrder
            from InboundOrder inboundOrder
            where inboundOrder.tenantId = :tenantId
              and (:source is null or inboundOrder.source = :source)
              and (:status is null or inboundOrder.status = :status)
              and (
                    :search is null
                    or lower(coalesce(inboundOrder.externalOrderId, '')) like lower(concat('%', :search, '%'))
                    or lower(inboundOrder.idempotencyKey) like lower(concat('%', :search, '%'))
              )
            """)
    Page<InboundOrder> searchInboundOrders(
            @Param("tenantId") UUID tenantId,
            @Param("source") OrderSource source,
            @Param("status") InboundOrderStatus status,
            @Param("search") String search,
            Pageable pageable
    );
}
