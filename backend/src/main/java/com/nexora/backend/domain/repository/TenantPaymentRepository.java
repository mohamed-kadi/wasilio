package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.TenantPayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TenantPaymentRepository extends JpaRepository<TenantPayment, UUID> {
    List<TenantPayment> findAllByOrderByPaidAtDesc();

    List<TenantPayment> findByTenantIdOrderByPaidAtDesc(UUID tenantId);

    Optional<TenantPayment> findByPaymentIdAndTenantId(UUID paymentId, UUID tenantId);
}
