package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.ConfirmationAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ConfirmationAttemptRepository extends JpaRepository<ConfirmationAttempt, UUID> {

    List<ConfirmationAttempt> findByTenantIdAndOrderIdOrderByAttemptNumberAsc(UUID tenantId, UUID orderId);

    @Query("""
            select coalesce(max(attempt.attemptNumber), 0)
            from ConfirmationAttempt attempt
            where attempt.tenantId = :tenantId
              and attempt.orderId = :orderId
            """)
    int findMaxAttemptNumber(@Param("tenantId") UUID tenantId, @Param("orderId") UUID orderId);
}
