package com.nexora.backend.infrastructure.persistence;

import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.EventConcurrencyException;
import com.nexora.backend.domain.event.EventStore;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
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
    public void append(DomainEvent event, int expectedAggregateSequence) {
        int currentSequence = repository
                .findTopByTenantIdAndAggregateIdOrderByAggregateSequenceDesc(event.getTenantId(), event.getAggregateId())
                .map(DomainEvent::getAggregateSequence)
                .orElse(0);

        if (currentSequence != expectedAggregateSequence) {
            throw new EventConcurrencyException(
                    "Expected aggregate sequence " + expectedAggregateSequence + " but was " + currentSequence
            );
        }

        int nextSequence = expectedAggregateSequence + 1;
        if (event.getAggregateSequence() != nextSequence) {
            throw new EventConcurrencyException(
                    "Event aggregate sequence must be " + nextSequence + " but was " + event.getAggregateSequence()
            );
        }

        try {
            repository.saveAndFlush(event);
        } catch (DataIntegrityViolationException e) {
            throw new EventConcurrencyException("Event sequence conflict for aggregate " + event.getAggregateId(), e);
        }
        publisher.publishEvent(event);
    }

    @Override
    public List<DomainEvent> getEventsForAggregate(UUID tenantId, UUID aggregateId) {
        return repository.findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(tenantId, aggregateId);
    }
}
