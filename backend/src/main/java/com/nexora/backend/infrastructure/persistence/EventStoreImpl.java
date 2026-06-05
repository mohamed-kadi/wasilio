package com.nexora.backend.infrastructure.persistence;

import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.EventStore;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class EventStoreImpl implements EventStore {

    private final DomainEventRepository repository;
    private final ApplicationEventPublisher publisher;

    @Override
    @Transactional
    public void append(DomainEvent event) {
        repository.save(event);
        publisher.publishEvent(event);
    }

    @Override
    public List<DomainEvent> getEventsForAggregate(UUID tenantId, UUID aggregateId) {
        return repository.findByTenantIdAndAggregateIdOrderByVersionAsc(tenantId, aggregateId);
    }
}
