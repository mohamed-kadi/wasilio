package com.nexora.backend.domain.event;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DomainEventRepository extends JpaRepository<DomainEvent, UUID> {
    List<DomainEvent> findByTenantIdAndAggregateIdOrderByAggregateSequenceAsc(UUID tenantId, UUID aggregateId);
    Optional<DomainEvent> findTopByTenantIdAndAggregateIdOrderByAggregateSequenceDesc(UUID tenantId, UUID aggregateId);
    List<DomainEvent> findAllByOrderByTenantIdAscAggregateIdAscAggregateSequenceAsc();
}
