package com.nexora.backend.application.projection;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProjectionProcessedEventRepository extends JpaRepository<ProjectionProcessedEvent, ProjectionProcessedEventId> {
    boolean existsByProjectionNameAndEventId(String projectionName, UUID eventId);
    long countByProjectionName(String projectionName);
    void deleteByProjectionName(String projectionName);
}
