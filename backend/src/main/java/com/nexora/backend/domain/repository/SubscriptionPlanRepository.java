package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SubscriptionPlanRepository extends JpaRepository<SubscriptionPlan, UUID> {
    Optional<SubscriptionPlan> findByCodeIgnoreCase(String code);

    List<SubscriptionPlan> findAllByOrderByMonthlyPriceAsc();
}
