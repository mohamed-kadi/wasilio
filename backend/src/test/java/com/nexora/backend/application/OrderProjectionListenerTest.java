package com.nexora.backend.application;

import com.nexora.backend.application.projection.OrderProjectionService;
import com.nexora.backend.domain.event.DomainEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OrderProjectionListenerTest {

    private OrderProjectionService orderProjectionService;
    private OrderProjectionListener listener;

    @BeforeEach
    void setUp() {
        orderProjectionService = mock(OrderProjectionService.class);
        listener = new OrderProjectionListener(orderProjectionService);
    }

    @Test
    void listenerDelegatesProjectionAfterCommitEventToService() throws Exception {
        DomainEvent event = event();

        listener.on(event);

        verify(orderProjectionService).project(event);
    }

    @Test
    void listenerDoesNotPropagateProjectionFailuresAfterEventCommit() throws Exception {
        DomainEvent event = event();
        doThrow(new IllegalStateException("projection failed"))
                .when(orderProjectionService)
                .project(event);

        assertDoesNotThrow(() -> listener.on(event));
    }

    private DomainEvent event() {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType("OrderCreated")
                .aggregateSequence(1)
                .eventSchemaVersion(1)
                .tenantId(UUID.randomUUID())
                .aggregateId(UUID.randomUUID())
                .timestamp(Instant.now())
                .payload("{}")
                .build();
    }
}
