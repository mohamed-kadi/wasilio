package com.nexora.backend.domain.event;

import java.util.List;
import java.util.UUID;

public interface EventStore {
    void append(DomainEvent event, int expectedAggregateSequence);
    List<DomainEvent> getEventsForAggregate(UUID tenantId, UUID aggregateId);
}
