package com.nexora.backend.application;

import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationCallbackScope;
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
import java.time.LocalDate;
import java.time.ZoneOffset;
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
    private final OrderIntelligenceScoringService orderIntelligenceScoringService;
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
        String normalizedSearch = normalizeSearch(search);
        return orderRepository.findConfirmationQueue(
                tenantId,
                queueStatuses(status),
                createdFrom != null,
                createdFrom,
                createdToExclusive != null,
                createdToExclusive,
                normalizedSearch != null,
                normalizedSearch,
                pageable
        );
    }

    @Transactional
    public ConfirmationAttempt recordAttempt(
            UUID tenantId,
            UUID orderId,
            ConfirmationOutcome outcome,
            String note,
            Instant callbackAt,
            String createdBy
    ) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));

        if (!QUEUE_STATUSES.contains(order.getStatus())) {
            throw new IllegalStateException("Order is not awaiting confirmation");
        }

        Instant now = Instant.now(clock);
        validateCallbackAt(outcome, callbackAt, now);

        int attemptNumber = attemptRepository.findMaxAttemptNumber(tenantId, orderId) + 1;
        ConfirmationAttempt attempt = attemptRepository.saveAndFlush(ConfirmationAttempt.builder()
                .attemptId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .attemptNumber(attemptNumber)
                .outcome(outcome)
                .note(normalizeNote(note))
                .createdBy(createdBy)
                .createdAt(now)
                .callbackAt(outcome == ConfirmationOutcome.CALL_BACK_LATER ? callbackAt : null)
                .build());

        if (outcome == ConfirmationOutcome.CONFIRMED || outcome == ConfirmationOutcome.REJECTED) {
            ensureConfirmationRequested(tenantId, order);
        }

        if (outcome == ConfirmationOutcome.CONFIRMED) {
            orderLifecycleService.confirmOrder(tenantId, orderId);
        } else if (outcome == ConfirmationOutcome.REJECTED) {
            orderLifecycleService.rejectOrder(tenantId, orderId, rejectionReason(note));
        }

        if (outcome == ConfirmationOutcome.CONFIRMED || outcome == ConfirmationOutcome.REJECTED) {
            attemptRepository.resolvePendingCallbacksForOrder(
                    tenantId,
                    orderId,
                    ConfirmationOutcome.CALL_BACK_LATER,
                    now,
                    createdBy
            );
        }

        orderIntelligenceScoringService.recalculate(tenantId, orderId);
        return attempt;
    }

    @Transactional(readOnly = true)
    public List<ConfirmationAttempt> listAttempts(UUID tenantId, UUID orderId) {
        if (orderRepository.findByIdAndTenantId(orderId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("Order not found");
        }
        return attemptRepository.findByTenantIdAndOrderIdOrderByAttemptNumberAsc(tenantId, orderId);
    }

    @Transactional(readOnly = true)
    public Page<ConfirmationCallbackItem> listCallbacks(
            UUID tenantId,
            ConfirmationCallbackScope scope,
            Instant callbackFrom,
            Instant callbackToExclusive,
            Pageable pageable
    ) {
        CallbackQueryWindow window = callbackQueryWindow(scope == null ? ConfirmationCallbackScope.DUE : scope, callbackFrom, callbackToExclusive);
        return attemptRepository.findPendingCallbacks(
                tenantId,
                ConfirmationOutcome.CALL_BACK_LATER,
                QUEUE_STATUSES,
                window.callbackFrom() != null,
                window.callbackFrom(),
                window.callbackToExclusive() != null,
                window.callbackToExclusive(),
                window.dueAt() != null,
                window.dueAt(),
                window.after() != null,
                window.after(),
                pageable
        ).map(callback -> new ConfirmationCallbackItem(
                callback,
                orderRepository.findByIdAndTenantId(callback.getOrderId(), tenantId)
                        .orElseThrow(() -> new IllegalArgumentException("Order not found"))
        ));
    }

    @Transactional
    public ConfirmationAttempt resolveCallback(UUID tenantId, UUID callbackId, String resolvedBy) {
        ConfirmationAttempt callback = attemptRepository.findByAttemptIdAndTenantId(callbackId, tenantId)
                .filter(attempt -> attempt.getOutcome() == ConfirmationOutcome.CALL_BACK_LATER)
                .filter(attempt -> attempt.getCallbackAt() != null)
                .orElseThrow(() -> new IllegalArgumentException("Callback not found"));

        if (callback.getCallbackResolvedAt() == null) {
            callback.setCallbackResolvedAt(Instant.now(clock));
            callback.setCallbackResolvedBy(resolvedBy);
            orderIntelligenceScoringService.recalculate(tenantId, callback.getOrderId());
        }

        return callback;
    }

    public ConfirmationCallbackStatus callbackStatus(ConfirmationAttempt callback) {
        if (callback.getCallbackResolvedAt() != null) {
            return ConfirmationCallbackStatus.RESOLVED;
        }

        Instant now = Instant.now(clock);
        if (callback.getCallbackAt().isBefore(startOfTodayUtc(now))) {
            return ConfirmationCallbackStatus.OVERDUE;
        }
        if (!callback.getCallbackAt().isAfter(now)) {
            return ConfirmationCallbackStatus.DUE;
        }
        return ConfirmationCallbackStatus.UPCOMING;
    }

    private void ensureConfirmationRequested(UUID tenantId, Order order) {
        if (order.getStatus() == OrderStatus.CREATED) {
            orderLifecycleService.requestConfirmation(tenantId, order.getId());
        }
    }

    private void validateCallbackAt(ConfirmationOutcome outcome, Instant callbackAt, Instant now) {
        if (outcome == ConfirmationOutcome.CALL_BACK_LATER) {
            if (callbackAt == null) {
                throw new IllegalArgumentException("callbackAt is required for CALL_BACK_LATER");
            }
            if (!callbackAt.isAfter(now)) {
                throw new IllegalArgumentException("callbackAt must be in the future");
            }
            return;
        }

        if (callbackAt != null) {
            throw new IllegalArgumentException("callbackAt is only allowed for CALL_BACK_LATER");
        }
    }

    private CallbackQueryWindow callbackQueryWindow(
            ConfirmationCallbackScope scope,
            Instant callbackFrom,
            Instant callbackToExclusive
    ) {
        Instant now = Instant.now(clock);
        return switch (scope) {
            case DUE -> new CallbackQueryWindow(callbackFrom, callbackToExclusive, now, null);
            case OVERDUE -> new CallbackQueryWindow(callbackFrom, earlier(callbackToExclusive, startOfTodayUtc(now)), null, null);
            case UPCOMING -> new CallbackQueryWindow(callbackFrom, callbackToExclusive, null, now);
            case ALL -> new CallbackQueryWindow(callbackFrom, callbackToExclusive, null, null);
        };
    }

    private Instant earlier(Instant candidate, Instant upperBound) {
        if (candidate == null || upperBound.isBefore(candidate)) {
            return upperBound;
        }
        return candidate;
    }

    private Instant startOfTodayUtc(Instant now) {
        return LocalDate.ofInstant(now, ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant();
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

    public record ConfirmationCallbackItem(ConfirmationAttempt callback, Order order) {}

    public enum ConfirmationCallbackStatus {
        DUE,
        OVERDUE,
        UPCOMING,
        RESOLVED
    }

    private record CallbackQueryWindow(
            Instant callbackFrom,
            Instant callbackToExclusive,
            Instant dueAt,
            Instant after
    ) {}
}
