package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.TenantSubscription;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface TenantSubscriptionRepository extends JpaRepository<TenantSubscription, UUID> {
    Optional<TenantSubscription> findByTenantId(UUID tenantId);

    long countByPlanId(UUID planId);
}
