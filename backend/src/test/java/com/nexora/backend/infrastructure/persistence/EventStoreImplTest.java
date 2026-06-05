package com.nexora.backend.infrastructure.persistence;

import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.EventConcurrencyException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class EventStoreImplTest {

    private static final int EVENT_SCHEMA_VERSION = 1;

    @Autowired
    private DomainEventRepository repository;

    private ApplicationEventPublisher publisher;
    private EventStoreImpl eventStore;
    private UUID tenantId;
    private UUID aggregateId;

    @BeforeEach
    void setUp() {
        publisher = mock(ApplicationEventPublisher.class);
        eventStore = new EventStoreImpl(repository, publisher);
        tenantId = UUID.randomUUID();
        aggregateId = UUID.randomUUID();
    }

    @Test
    void appendWithExpectedSequencePersistsAndPublishes() {
        DomainEvent event = event("OrderCreated", 1);

        eventStore.append(event, 0);

        assertEquals(1, repository.findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(tenantId, aggregateId).size());
        verify(publisher).publishEvent(event);
    }

    @Test
    void appendWithStaleExpectedSequenceIsRejected() {
        eventStore.append(event("OrderCreated", 1), 0);

        assertThrows(EventConcurrencyException.class, () ->
                eventStore.append(event("OrderConfirmationRequested", 2), 0)
        );

        assertEquals(1, repository.findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(tenantId, aggregateId).size());
        verify(publisher, times(1)).publishEvent(org.mockito.ArgumentMatchers.any(DomainEvent.class));
    }

    @Test
    void duplicateAggregateSequenceIsRejectedByEventStore() {
        eventStore.append(event("OrderCreated", 1), 0);

        assertThrows(EventConcurrencyException.class, () ->
                eventStore.append(event("OrderConfirmationRequested", 1), 1)
        );

        assertEquals(1, repository.findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(tenantId, aggregateId).size());
    }

    @Test
    void duplicateAggregateSequenceIsRejectedByDatabaseConstraint() {
        repository.saveAndFlush(event("OrderCreated", 1));

        assertThrows(DataIntegrityViolationException.class, () ->
                repository.saveAndFlush(event("OrderConfirmationRequested", 1))
        );
    }

    private DomainEvent event(String eventType, int aggregateSequence) {
        return DomainEvent.builder()
                .eventId(UUID.randomUUID())
                .eventType(eventType)
                .aggregateSequence(aggregateSequence)
                .eventSchemaVersion(EVENT_SCHEMA_VERSION)
                .tenantId(tenantId)
                .aggregateId(aggregateId)
                .timestamp(Instant.now())
                .payload("{}")
                .build();
    }
}
