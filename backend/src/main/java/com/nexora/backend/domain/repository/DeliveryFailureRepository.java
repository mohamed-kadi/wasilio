package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.DeliveryFailure;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryFailureRepository extends JpaRepository<DeliveryFailure, UUID> {
    Optional<DeliveryFailure> findByOrderIdAndTenantId(UUID orderId, UUID tenantId);

    List<DeliveryFailure> findByTenantIdAndOrderIdOrderByCreatedAtAsc(UUID tenantId, UUID orderId);

    Optional<DeliveryFailure> findFirstByTenantIdAndOrderIdOrderByCreatedAtDesc(UUID tenantId, UUID orderId);

    @Query("""
            select failure
            from DeliveryFailure failure
            where failure.tenantId = :tenantId
              and (:courierId is null or failure.courierId = :courierId)
              and (:createdFromEnabled = false or failure.createdAt >= :createdFrom)
              and (:createdToExclusiveEnabled = false or failure.createdAt < :createdToExclusive)
            order by failure.createdAt desc, failure.failureId asc
            """)
    Page<DeliveryFailure> findFailureDrilldown(
            @Param("tenantId") UUID tenantId,
            @Param("courierId") UUID courierId,
            @Param("createdFromEnabled") boolean createdFromEnabled,
            @Param("createdFrom") Instant createdFrom,
            @Param("createdToExclusiveEnabled") boolean createdToExclusiveEnabled,
            @Param("createdToExclusive") Instant createdToExclusive,
            Pageable pageable
    );
}
