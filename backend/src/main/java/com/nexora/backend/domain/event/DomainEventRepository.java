package com.nexora.backend.domain.event;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface DomainEventRepository extends JpaRepository<DomainEvent, UUID> {
    List<DomainEvent> findByAggregateIdOrderByVersionAsc(UUID aggregateId);
    List<DomainEvent> findByTenantIdAndAggregateIdOrderByVersionAsc(UUID tenantId, UUID aggregateId);
}
