package com.nexora.backend.application;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.EventStore;
import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureRecovery;
import com.nexora.backend.domain.model.DeliveryFollowUpTask;
import com.nexora.backend.domain.repository.ConfirmationAttemptRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRecoveryRepository;
import com.nexora.backend.domain.repository.DeliveryFollowUpTaskRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderTimelineService {

    private final OrderRepository orderRepository;
    private final EventStore eventStore;
    private final ConfirmationAttemptRepository confirmationAttemptRepository;
    private final DeliveryFailureRepository deliveryFailureRepository;
    private final DeliveryFailureRecoveryRepository deliveryFailureRecoveryRepository;
    private final DeliveryFollowUpTaskRepository deliveryFollowUpTaskRepository;

    @Transactional(readOnly = true)
    public List<OrderTimelineItem> getTimeline(UUID tenantId, UUID orderId) {
        if (orderRepository.findByIdAndTenantId(orderId, tenantId).isEmpty()) {
            throw new IllegalArgumentException("Order not found");
        }

        List<OrderTimelineItem> items = new ArrayList<>();
        eventStore.getEventsForAggregate(tenantId, orderId).forEach(event -> items.add(fromDomainEvent(event)));
        confirmationAttemptRepository.findByTenantIdAndOrderIdOrderByAttemptNumberAsc(tenantId, orderId)
                .forEach(attempt -> addConfirmationItems(items, attempt));
        deliveryFailureRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId)
                .forEach(failure -> items.add(fromDeliveryFailure(failure)));
        deliveryFailureRecoveryRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId)
                .forEach(recovery -> items.add(fromDeliveryFailureRecovery(recovery)));
        deliveryFollowUpTaskRepository.findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId)
                .forEach(task -> addDeliveryFollowUpItems(items, task));

        return items.stream()
                .sorted(Comparator
                        .comparing(OrderTimelineItem::timestamp)
                        .thenComparing(OrderTimelineItem::sortOrder)
                        .thenComparing(OrderTimelineItem::itemId))
                .toList();
    }

    private OrderTimelineItem fromDomainEvent(DomainEvent event) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("eventType", event.getEventType());
        details.put("aggregateSequence", event.getAggregateSequence());
        details.put("eventSchemaVersion", event.getEventSchemaVersion());
        details.put("payload", event.getPayload());
        details.put("correlationId", event.getCorrelationId());

        return new OrderTimelineItem(
                event.getEventId().toString(),
                TimelineSource.DOMAIN_EVENT,
                categoryForEvent(event.getEventType()),
                event.getEventType(),
                titleForEvent(event.getEventType()),
                event.getTimestamp(),
                null,
                details,
                event.getAggregateSequence() * 10
        );
    }

    private void addConfirmationItems(List<OrderTimelineItem> items, ConfirmationAttempt attempt) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("attemptNumber", attempt.getAttemptNumber());
        details.put("outcome", attempt.getOutcome());
        details.put("note", attempt.getNote());
        details.put("callbackAt", attempt.getCallbackAt());

        items.add(new OrderTimelineItem(
                attempt.getAttemptId().toString(),
                TimelineSource.OPERATIONAL_RECORD,
                attempt.getOutcome() == ConfirmationOutcome.CALL_BACK_LATER
                        ? TimelineCategory.CALLBACK
                        : TimelineCategory.CONFIRMATION,
                "ConfirmationAttemptRecorded",
                titleForAttempt(attempt),
                attempt.getCreatedAt(),
                attempt.getCreatedBy(),
                details,
                5_000 + attempt.getAttemptNumber()
        ));

        if (attempt.getCallbackResolvedAt() != null) {
            Map<String, Object> resolutionDetails = new LinkedHashMap<>();
            resolutionDetails.put("attemptNumber", attempt.getAttemptNumber());
            resolutionDetails.put("callbackAt", attempt.getCallbackAt());
            resolutionDetails.put("resolvedBy", attempt.getCallbackResolvedBy());

            items.add(new OrderTimelineItem(
                    attempt.getAttemptId() + ":resolved",
                    TimelineSource.OPERATIONAL_RECORD,
                    TimelineCategory.CALLBACK,
                    "CallbackResolved",
                    "Callback resolved",
                    attempt.getCallbackResolvedAt(),
                    attempt.getCallbackResolvedBy(),
                    resolutionDetails,
                    6_000 + attempt.getAttemptNumber()
            ));
        }
    }

    private OrderTimelineItem fromDeliveryFailure(DeliveryFailure failure) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("courierId", failure.getCourierId());
        details.put("reason", failure.getReason());
        details.put("note", failure.getNote());

        return new OrderTimelineItem(
                failure.getFailureId().toString(),
                TimelineSource.OPERATIONAL_RECORD,
                TimelineCategory.DELIVERY,
                "DeliveryFailureRecorded",
                "Delivery failure recorded",
                failure.getCreatedAt(),
                null,
                details,
                7_000
        );
    }

    private OrderTimelineItem fromDeliveryFailureRecovery(DeliveryFailureRecovery recovery) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("decision", recovery.getDecision());
        details.put("note", recovery.getNote());

        return new OrderTimelineItem(
                recovery.getRecoveryId().toString(),
                TimelineSource.OPERATIONAL_RECORD,
                TimelineCategory.DELIVERY,
                "DeliveryFailureRecoveryRecorded",
                "Delivery failure recovery recorded",
                recovery.getCreatedAt(),
                recovery.getCreatedBy(),
                details,
                7_500
        );
    }

    private void addDeliveryFollowUpItems(List<OrderTimelineItem> items, DeliveryFollowUpTask task) {
        Map<String, Object> openedDetails = new LinkedHashMap<>();
        openedDetails.put("status", "OPEN");
        openedDetails.put("note", task.getNote());
        openedDetails.put("dueAt", task.getDueAt());
        openedDetails.put("assignedTo", task.getAssignedTo());
        openedDetails.put("recoveryId", task.getRecoveryId());

        items.add(new OrderTimelineItem(
                task.getTaskId().toString(),
                TimelineSource.OPERATIONAL_RECORD,
                TimelineCategory.DELIVERY,
                "DeliveryFollowUpOpened",
                "Delivery follow-up opened",
                task.getCreatedAt(),
                task.getAssignedTo(),
                openedDetails,
                7_600
        ));

        if (task.getResolvedAt() == null) {
            return;
        }

        Map<String, Object> resolvedDetails = new LinkedHashMap<>();
        resolvedDetails.put("status", task.getStatus());
        resolvedDetails.put("resolutionNote", task.getResolutionNote());
        resolvedDetails.put("dueAt", task.getDueAt());
        resolvedDetails.put("assignedTo", task.getAssignedTo());
        resolvedDetails.put("recoveryId", task.getRecoveryId());

        items.add(new OrderTimelineItem(
                task.getTaskId() + ":resolved",
                TimelineSource.OPERATIONAL_RECORD,
                TimelineCategory.DELIVERY,
                "DeliveryFollowUpResolved",
                "Delivery follow-up resolved",
                task.getResolvedAt(),
                task.getResolvedBy(),
                resolvedDetails,
                7_700
        ));
    }

    private TimelineCategory categoryForEvent(String eventType) {
        if (eventType.contains("Confirmation") || eventType.contains("Confirmed") || eventType.contains("Rejected")) {
            return TimelineCategory.CONFIRMATION;
        }
        if (eventType.contains("Delivery") || eventType.contains("Assigned") || eventType.contains("PickedUp") || eventType.contains("Delivered") || eventType.contains("Failed")) {
            return TimelineCategory.DELIVERY;
        }
        return TimelineCategory.LIFECYCLE;
    }

    private String titleForEvent(String eventType) {
        return eventType.replaceAll("([a-z])([A-Z])", "$1 $2");
    }

    private String titleForAttempt(ConfirmationAttempt attempt) {
        return switch (attempt.getOutcome()) {
            case CONFIRMED -> "Confirmation attempt confirmed";
            case REJECTED -> "Confirmation attempt rejected";
            case NO_ANSWER -> "Confirmation attempt no answer";
            case CALL_BACK_LATER -> "Callback scheduled";
            case WRONG_NUMBER -> "Confirmation attempt wrong number";
        };
    }

    public record OrderTimelineItem(
            String itemId,
            TimelineSource source,
            TimelineCategory category,
            String type,
            String title,
            Instant timestamp,
            String actor,
            Map<String, Object> details,
            @JsonIgnore
            int sortOrder
    ) {}

    public enum TimelineSource {
        DOMAIN_EVENT,
        OPERATIONAL_RECORD
    }

    public enum TimelineCategory {
        LIFECYCLE,
        CONFIRMATION,
        CALLBACK,
        DELIVERY
    }
}
