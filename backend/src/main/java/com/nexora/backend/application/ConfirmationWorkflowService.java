package com.nexora.backend.application;

import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.ConfirmationAttemptRepository;
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
public class ConfirmationWorkflowService {

    private static final List<OrderStatus> QUEUE_STATUSES = List.of(
            OrderStatus.CREATED,
            OrderStatus.CONFIRMATION_REQUESTED
    );

    private final OrderRepository orderRepository;
    private final ConfirmationAttemptRepository attemptRepository;
    private final OrderLifecycleService orderLifecycleService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Page<Order> listQueue(
            UUID tenantId,
            OrderStatus status,
            Instant createdFrom,
            Instant createdToExclusive,
            String search,
            Pageable pageable
    ) {
        return orderRepository.findConfirmationQueue(
                tenantId,
                queueStatuses(status),
                createdFrom,
                createdToExclusive,
                normalizeSearch(search),
                pageable
        );
    }

    @Transactional
    public ConfirmationAttempt recordAttempt(
            UUID tenantId,
            UUID orderId,
            ConfirmationOutcome outcome,
            String note,
            String createdBy
    ) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (!QUEUE_STATUSES.contains(order.getStatus())) {
            throw new IllegalStateException("Order is not awaiting confirmation");
        }

        int attemptNumber = attemptRepository.findMaxAttemptNumber(tenantId, orderId) + 1;
        ConfirmationAttempt attempt = attemptRepository.saveAndFlush(ConfirmationAttempt.builder()
                .attemptId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .attemptNumber(attemptNumber)
                .outcome(outcome)
                .note(normalizeNote(note))
                .createdBy(createdBy)
                .createdAt(Instant.now(clock))
                .build());

        if (outcome == ConfirmationOutcome.CONFIRMED || outcome == ConfirmationOutcome.REJECTED) {
            ensureConfirmationRequested(tenantId, order);
        }

        if (outcome == ConfirmationOutcome.CONFIRMED) {
            orderLifecycleService.confirmOrder(tenantId, orderId);
        } else if (outcome == ConfirmationOutcome.REJECTED) {
            orderLifecycleService.rejectOrder(tenantId, orderId, rejectionReason(note));
        }

        return attempt;
    }

    @Transactional(readOnly = true)
    public List<ConfirmationAttempt> listAttempts(UUID tenantId, UUID orderId) {
        if (orderRepository.findByIdAndTenantId(orderId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("Order not found");
        }
        return attemptRepository.findByTenantIdAndOrderIdOrderByAttemptNumberAsc(tenantId, orderId);
    }

    private void ensureConfirmationRequested(UUID tenantId, Order order) {
        if (order.getStatus() == OrderStatus.CREATED) {
            orderLifecycleService.requestConfirmation(tenantId, order.getId());
        }
    }

    private List<OrderStatus> queueStatuses(OrderStatus status) {
        if (status == null) {
            return QUEUE_STATUSES;
        }
        if (!QUEUE_STATUSES.contains(status)) {
            throw new IllegalArgumentException("status must be CREATED or CONFIRMATION_REQUESTED");
        }
        return List.of(status);
    }

    private String normalizeSearch(String search) {
        if (search == null || search.isBlank()) {
            return null;
        }
        return search.trim();
    }

    private String normalizeNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        return note.trim();
    }

    private String rejectionReason(String note) {
        String normalized = normalizeNote(note);
        return normalized == null ? "Rejected during confirmation" : normalized;
    }
}
