package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.DeliveryFollowUpStatus;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryFollowUpTaskRepository extends JpaRepository<DeliveryFollowUpTask, UUID> {
    List<DeliveryFollowUpTask> findByTenantIdAndOrderIdOrderByCreatedAtAsc(UUID tenantId, UUID orderId);

    List<DeliveryFollowUpTask> findByTenantIdAndOrderIdAndStatusOrderByCreatedAtAsc(
            UUID tenantId,
            UUID orderId,
            DeliveryFollowUpStatus status
    );

    Page<DeliveryFollowUpTask> findByTenantIdAndStatusOrderByCreatedAtAscTaskIdAsc(
            UUID tenantId,
            DeliveryFollowUpStatus status,
            Pageable pageable
    );

    Optional<DeliveryFollowUpTask> findByTaskIdAndTenantIdAndOrderId(UUID taskId, UUID tenantId, UUID orderId);
}
