package com.nexora.backend.application;

import com.nexora.backend.application.projection.OrderProjectionService;
import com.nexora.backend.domain.event.DomainEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class OrderProjectionListener {

    private static final Logger log = LoggerFactory.getLogger(OrderProjectionListener.class);

    private final OrderProjectionService orderProjectionService;
    private final OrderIntelligenceScoringService orderIntelligenceScoringService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void on(DomainEvent event) {
        try {
            orderProjectionService.project(event);
        } catch (Exception ex) {
            log.error(
                    "Order projection failed for eventId={} aggregateId={} sequence={}. "
                            + "The event remains in domain_events and can be recovered with an orders projection rebuild.",
                    event.getEventId(),
                    event.getAggregateId(),
                    event.getAggregateSequence(),
                    ex
            );
            return;
        }

        scoreInitialIntelligence(event);
    }

    private void scoreInitialIntelligence(DomainEvent event) {
        if (!"OrderCreated".equals(event.getEventType())) {
            return;
        }

        try {
            orderIntelligenceScoringService.recalculateAfterProjection(event.getTenantId(), event.getAggregateId());
        } catch (Exception ex) {
            log.error(
                    "Initial order intelligence scoring failed for eventId={} aggregateId={}. "
                            + "The order remains valid and can be scored again from queue or detail reads.",
                    event.getEventId(),
                    event.getAggregateId(),
                    ex
            );
        }
    }
}
