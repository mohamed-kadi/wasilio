package com.nexora.backend.application.projection;

import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public class ProjectionProcessedEventId implements Serializable {

    private String projectionName;
    private UUID eventId;

    public ProjectionProcessedEventId() {
    }

    public ProjectionProcessedEventId(String projectionName, UUID eventId) {
        this.projectionName = projectionName;
        this.eventId = eventId;
    }

    public String getProjectionName() {
        return projectionName;
    }

    public UUID getEventId() {
        return eventId;
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof ProjectionProcessedEventId that)) {
            return false;
        }
        return Objects.equals(projectionName, that.projectionName)
                && Objects.equals(eventId, that.eventId);
    }

    @Override
    public int hashCode() {
        return Objects.hash(projectionName, eventId);
    }
}
