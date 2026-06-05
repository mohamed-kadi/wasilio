package com.nexora.backend.domain.event;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(
        name = "domain_events",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_domain_events_tenant_aggregate_sequence",
                columnNames = {"tenant_id", "aggregate_id", "aggregate_sequence"}
        )
)
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DomainEvent {
    @Id
    private UUID eventId;

    @Column(nullable = false)
    private String eventType;

    @Column(name = "aggregate_sequence", nullable = false)
    private int aggregateSequence;

    @Column(name = "event_schema_version", nullable = false)
    private int eventSchemaVersion;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID aggregateId;

    private UUID correlationId;
    
    private UUID causationId;

    @Column(nullable = false)
    private Instant timestamp;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private String payload;

    public int getVersion() {
        return aggregateSequence;
    }
}
