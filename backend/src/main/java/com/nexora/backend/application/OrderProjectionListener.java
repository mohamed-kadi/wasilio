package com.nexora.backend.application;

import com.nexora.backend.application.projection.OrderProjectionService;
import com.nexora.backend.domain.event.DomainEvent;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
@RequiredArgsConstructor
public class OrderProjectionListener {

    private static final Logger log = LoggerFactory.getLogger(OrderProjectionListener.class);

    private final OrderProjectionService orderProjectionService;

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
        }
    }
}
