package com.nexora.backend.application;

import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureRecovery;
import com.nexora.backend.domain.model.DeliveryFailureRecoveryDecision;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.DeliveryFollowUpDueFilter;
import com.nexora.backend.domain.model.DeliveryFollowUpStatus;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRecoveryRepository;
import com.nexora.backend.domain.repository.DeliveryFollowUpTaskRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliveryOperationsService {

    private final OrderLifecycleService orderLifecycleService;
    private final OrderRepository orderRepository;
    private final DeliveryFailureRepository deliveryFailureRepository;
    private final DeliveryFailureRecoveryRepository deliveryFailureRecoveryRepository;
    private final DeliveryFollowUpTaskRepository deliveryFollowUpTaskRepository;
    private final Clock clock;

    public record DeliveryFailureRecoveryResult(
            DeliveryFailureRecovery recovery,
            DeliveryFollowUpTask followUpTask
    ) {}

    @Transactional
    public void markDelivered(UUID tenantId, UUID orderId) {
        requirePickedUpOrder(tenantId, orderId);
        orderLifecycleService.markDelivered(tenantId, orderId);
    }

    @Transactional
    public DeliveryFailure markFailed(UUID tenantId, UUID orderId, DeliveryFailureReason reason, String note) {
        Order order = requirePickedUpOrder(tenantId, orderId);
        UUID courierId = parseCourierId(order.getCourierId());

        orderLifecycleService.markFailed(tenantId, orderId, reason.name());

        return deliveryFailureRepository.save(DeliveryFailure.builder()
                .failureId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .courierId(courierId)
                .reason(reason)
                .note(normalize(note))
                .createdAt(Instant.now(clock))
                .build());
    }

    @Transactional(readOnly = true)
    public List<DeliveryFailureRecovery> listFailureRecoveries(UUID tenantId, UUID orderId) {
        requireFailedOrder(tenantId, orderId);
        return deliveryFailureRecoveryRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId);
    }

    @Transactional(readOnly = true)
    public List<DeliveryFollowUpTask> listFollowUpTasks(UUID tenantId, UUID orderId) {
        requireOrder(tenantId, orderId);
        return deliveryFollowUpTaskRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId);
    }

    @Transactional(readOnly = true)
    public Page<DeliveryFollowUpTask> listFollowUpTasks(
            UUID tenantId,
            DeliveryFollowUpStatus status,
            DeliveryFollowUpDueFilter dueFilter,
            Pageable pageable
    ) {
        if (status == null) {
            throw new IllegalArgumentException("status is required");
        }
        DeliveryFollowUpDueFilter selectedFilter = dueFilter == null ? DeliveryFollowUpDueFilter.ALL : dueFilter;
        Instant now = Instant.now(clock);
        return switch (selectedFilter) {
            case ALL -> deliveryFollowUpTaskRepository.findQueueByTenantIdAndStatus(
                    tenantId,
                    status,
                    pageable
            );
            case DUE_NOW -> deliveryFollowUpTaskRepository.findDueNowQueueByTenantIdAndStatus(
                    tenantId,
                    status,
                    now,
                    pageable
            );
            case SCHEDULED -> deliveryFollowUpTaskRepository.findScheduledQueueByTenantIdAndStatus(
                    tenantId,
                    status,
                    now,
                    pageable
            );
            case NO_DUE_DATE -> deliveryFollowUpTaskRepository.findNoDueDateQueueByTenantIdAndStatus(
                    tenantId,
                    status,
                    pageable
            );
        };
    }

    @Transactional
    public DeliveryFailureRecoveryResult recordFailureRecovery(
            UUID tenantId,
            UUID orderId,
            DeliveryFailureRecoveryDecision decision,
            String note,
            Instant followUpDueAt,
            String createdBy
    ) {
        if (decision == null) {
            throw new IllegalArgumentException("decision is required");
        }
        requireFailedOrder(tenantId, orderId);
        Instant now = Instant.now(clock);
        String actor = normalizeActor(createdBy);
        String normalizedNote = normalize(note);
        if (decision == DeliveryFailureRecoveryDecision.CLOSE_UNRECOVERABLE && normalizedNote == null) {
            throw new IllegalArgumentException("closure note is required");
        }

        DeliveryFailureRecovery recovery = deliveryFailureRecoveryRepository.save(DeliveryFailureRecovery.builder()
                .recoveryId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .decision(decision)
                .note(normalizedNote)
                .createdBy(actor)
                .createdAt(now)
                .build());

        DeliveryFollowUpTask followUpTask = null;
        if (decision == DeliveryFailureRecoveryDecision.REFUND_OR_CUSTOMER_FOLLOW_UP) {
            followUpTask = deliveryFollowUpTaskRepository.save(DeliveryFollowUpTask.builder()
                    .taskId(UUID.randomUUID())
                    .tenantId(tenantId)
                    .orderId(orderId)
                    .recoveryId(recovery.getRecoveryId())
                    .status(DeliveryFollowUpStatus.OPEN)
                    .note(normalizedNote)
                    .dueAt(followUpDueAt)
                    .assignedTo(actor)
                    .createdAt(now)
                    .build());
        } else {
            resolveOpenFollowUps(
                    tenantId,
                    orderId,
                    actor,
                    now,
                    "Superseded by recovery decision " + decision.name()
            );
        }

        return new DeliveryFailureRecoveryResult(recovery, followUpTask);
    }

    @Transactional
    public DeliveryFollowUpTask resolveFollowUpTask(
            UUID tenantId,
            UUID orderId,
            UUID taskId,
            String resolutionNote,
            String resolvedBy
    ) {
        requireOrder(tenantId, orderId);
        DeliveryFollowUpTask task = deliveryFollowUpTaskRepository.findByTaskIdAndTenantIdAndOrderId(taskId, tenantId, orderId)
                .orElseThrow(() -> new IllegalArgumentException("Follow-up task not found"));
        if (task.getStatus() == DeliveryFollowUpStatus.RESOLVED) {
            throw new IllegalStateException("Follow-up task is already resolved");
        }

        task.setStatus(DeliveryFollowUpStatus.RESOLVED);
        task.setResolvedBy(normalizeActor(resolvedBy));
        task.setResolvedAt(Instant.now(clock));
        task.setResolutionNote(normalize(resolutionNote));
        return deliveryFollowUpTaskRepository.save(task);
    }

    @Transactional
    public void retryDelivery(UUID tenantId, UUID orderId) {
        requireFailedOrder(tenantId, orderId);
        DeliveryFailure latestFailure = deliveryFailureRepository
                .findFirstByTenantIdAndOrderIdOrderByCreatedAtDesc(tenantId, orderId)
                .orElseThrow(() -> new IllegalStateException("Retry delivery requires a recorded delivery failure"));
        DeliveryFailureRecovery latestRecovery = deliveryFailureRecoveryRepository
                .findFirstByTenantIdAndOrderIdOrderByCreatedAtDesc(tenantId, orderId)
                .orElseThrow(() -> new IllegalStateException("Retry delivery requires a recovery decision"));

        if (latestRecovery.getDecision() != DeliveryFailureRecoveryDecision.RETRY_DELIVERY
                || latestRecovery.getCreatedAt().isBefore(latestFailure.getCreatedAt())) {
            throw new IllegalStateException("Retry delivery requires the latest recovery decision to be Retry delivery");
        }

        orderLifecycleService.retryDelivery(tenantId, orderId, latestRecovery.getRecoveryId());
    }

    private Order requirePickedUpOrder(UUID tenantId, UUID orderId) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        if (order.getStatus() != OrderStatus.PICKED_UP) {
            throw new IllegalStateException("Invalid state transition from " + order.getStatus() + " expected " + OrderStatus.PICKED_UP);
        }
        if (order.getCourierId() == null || order.getCourierId().isBlank()) {
            throw new IllegalStateException("Picked up order must have an assigned courier");
        }
        return order;
    }

    private Order requireFailedOrder(UUID tenantId, UUID orderId) {
        Order order = requireOrder(tenantId, orderId);
        if (order.getStatus() != OrderStatus.FAILED) {
            throw new IllegalStateException("Operation requires a failed order");
        }
        return order;
    }

    private Order requireOrder(UUID tenantId, UUID orderId) {
        return orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
    }

    private void resolveOpenFollowUps(UUID tenantId, UUID orderId, String resolvedBy, Instant resolvedAt, String resolutionNote) {
        deliveryFollowUpTaskRepository.findByTenantIdAndOrderIdAndStatusOrderByCreatedAtAsc(
                tenantId,
                orderId,
                DeliveryFollowUpStatus.OPEN
        ).forEach(task -> {
            task.setStatus(DeliveryFollowUpStatus.RESOLVED);
            task.setResolvedBy(resolvedBy);
            task.setResolvedAt(resolvedAt);
            task.setResolutionNote(resolutionNote);
            deliveryFollowUpTaskRepository.save(task);
        });
    }

    private UUID parseCourierId(String courierId) {
        try {
            return UUID.fromString(courierId);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("Picked up order has an invalid courier");
        }
    }

    private String normalize(String value) {
        String normalized = value == null ? null : value.trim();
        return normalized == null || normalized.isBlank() ? null : normalized;
    }

    private String normalizeActor(String value) {
        String normalized = normalize(value);
        return normalized == null ? "unknown" : normalized;
    }
}
