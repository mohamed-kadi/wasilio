package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.Order;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {
    Optional<Order> findByIdAndTenantId(UUID id, UUID tenantId);
    List<Order> findByTenantId(UUID tenantId);
    boolean existsByIdAndTenantIdNot(UUID id, UUID tenantId);
}
