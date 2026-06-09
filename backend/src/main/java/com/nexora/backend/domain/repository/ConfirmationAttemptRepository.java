package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConfirmationAttemptRepository extends JpaRepository<ConfirmationAttempt, UUID> {

    Optional<ConfirmationAttempt> findByAttemptIdAndTenantId(UUID attemptId, UUID tenantId);

    List<ConfirmationAttempt> findByTenantIdAndOrderIdOrderByAttemptNumberAsc(UUID tenantId, UUID orderId);

    @Query("""
            select coalesce(max(attempt.attemptNumber), 0)
            from ConfirmationAttempt attempt
            where attempt.tenantId = :tenantId
              and attempt.orderId = :orderId
            """)
    int findMaxAttemptNumber(@Param("tenantId") UUID tenantId, @Param("orderId") UUID orderId);

    @Query("""
            select attempt
            from ConfirmationAttempt attempt
            join Order orderProjection
              on orderProjection.id = attempt.orderId
             and orderProjection.tenantId = attempt.tenantId
            where attempt.tenantId = :tenantId
              and attempt.outcome = :outcome
              and attempt.callbackAt is not null
              and attempt.callbackResolvedAt is null
              and orderProjection.status in :actionableStatuses
              and (:callbackFromEnabled = false or attempt.callbackAt >= :callbackFrom)
              and (:callbackToExclusiveEnabled = false or attempt.callbackAt < :callbackToExclusive)
              and (:dueAtEnabled = false or attempt.callbackAt <= :dueAt)
              and (:afterEnabled = false or attempt.callbackAt > :after)
            """)
    Page<ConfirmationAttempt> findPendingCallbacks(
            @Param("tenantId") UUID tenantId,
            @Param("outcome") ConfirmationOutcome outcome,
            @Param("actionableStatuses") List<OrderStatus> actionableStatuses,
            @Param("callbackFromEnabled") boolean callbackFromEnabled,
            @Param("callbackFrom") Instant callbackFrom,
            @Param("callbackToExclusiveEnabled") boolean callbackToExclusiveEnabled,
            @Param("callbackToExclusive") Instant callbackToExclusive,
            @Param("dueAtEnabled") boolean dueAtEnabled,
            @Param("dueAt") Instant dueAt,
            @Param("afterEnabled") boolean afterEnabled,
            @Param("after") Instant after,
            Pageable pageable
    );

    @Modifying
    @Query("""
            update ConfirmationAttempt attempt
               set attempt.callbackResolvedAt = :resolvedAt,
                   attempt.callbackResolvedBy = :resolvedBy
             where attempt.tenantId = :tenantId
               and attempt.orderId = :orderId
               and attempt.outcome = :outcome
               and attempt.callbackResolvedAt is null
            """)
    int resolvePendingCallbacksForOrder(
            @Param("tenantId") UUID tenantId,
            @Param("orderId") UUID orderId,
            @Param("outcome") ConfirmationOutcome outcome,
            @Param("resolvedAt") Instant resolvedAt,
            @Param("resolvedBy") String resolvedBy
    );
}
