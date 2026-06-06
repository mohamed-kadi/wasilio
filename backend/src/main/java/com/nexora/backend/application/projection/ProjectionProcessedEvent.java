package com.nexora.backend.application.projection;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "projection_processed_events")
@IdClass(ProjectionProcessedEventId.class)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectionProcessedEvent {

    @Id
    @Column(name = "projection_name", nullable = false, length = 100)
    private String projectionName;

    @Id
    @Column(name = "event_id", nullable = false)
    private UUID eventId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "aggregate_id", nullable = false)
    private UUID aggregateId;

    @Column(name = "aggregate_sequence", nullable = false)
    private int aggregateSequence;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;
}
