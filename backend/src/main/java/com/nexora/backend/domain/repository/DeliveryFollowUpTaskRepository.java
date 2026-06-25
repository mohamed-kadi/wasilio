package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.DeliveryFollowUpStatus;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryFollowUpTaskRepository extends JpaRepository<DeliveryFollowUpTask, UUID> {
    List<DeliveryFollowUpTask> findByTenantIdAndOrderIdOrderByCreatedAtAsc(UUID tenantId, UUID orderId);

    List<DeliveryFollowUpTask> findByTenantIdAndOrderIdInOrderByOrderIdAscCreatedAtAsc(
            UUID tenantId,
            List<UUID> orderIds
    );

    List<DeliveryFollowUpTask> findByTenantIdAndOrderIdAndStatusOrderByCreatedAtAsc(
            UUID tenantId,
            UUID orderId,
            DeliveryFollowUpStatus status
    );

    @Query("""
            select task
            from DeliveryFollowUpTask task
            where task.tenantId = :tenantId
              and task.status = :status
            order by
              case when task.dueAt is null then 1 else 0 end,
              task.dueAt asc,
              task.createdAt asc,
              task.taskId asc
            """)
    Page<DeliveryFollowUpTask> findQueueByTenantIdAndStatus(
            @Param("tenantId") UUID tenantId,
            @Param("status") DeliveryFollowUpStatus status,
            Pageable pageable
    );

    @Query("""
            select task
            from DeliveryFollowUpTask task
            where task.tenantId = :tenantId
              and task.status = :status
              and task.dueAt <= :now
            order by
              task.dueAt asc,
              task.createdAt asc,
              task.taskId asc
            """)
    Page<DeliveryFollowUpTask> findDueNowQueueByTenantIdAndStatus(
            @Param("tenantId") UUID tenantId,
            @Param("status") DeliveryFollowUpStatus status,
            @Param("now") Instant now,
            Pageable pageable
    );

    @Query("""
            select task
            from DeliveryFollowUpTask task
            where task.tenantId = :tenantId
              and task.status = :status
              and task.dueAt > :now
            order by
              task.dueAt asc,
              task.createdAt asc,
              task.taskId asc
            """)
    Page<DeliveryFollowUpTask> findScheduledQueueByTenantIdAndStatus(
            @Param("tenantId") UUID tenantId,
            @Param("status") DeliveryFollowUpStatus status,
            @Param("now") Instant now,
            Pageable pageable
    );

    @Query("""
            select task
            from DeliveryFollowUpTask task
            where task.tenantId = :tenantId
              and task.status = :status
              and task.dueAt is null
            order by
              task.createdAt asc,
              task.taskId asc
            """)
    Page<DeliveryFollowUpTask> findNoDueDateQueueByTenantIdAndStatus(
            @Param("tenantId") UUID tenantId,
            @Param("status") DeliveryFollowUpStatus status,
            Pageable pageable
    );

    Optional<DeliveryFollowUpTask> findByTaskIdAndTenantIdAndOrderId(UUID taskId, UUID tenantId, UUID orderId);
}
