package com.nexora.backend.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.event.DomainEvent;
import com.nexora.backend.domain.event.DomainEventRepository;
import com.nexora.backend.domain.event.payload.OrderAssignedToCourierEvent;
import com.nexora.backend.domain.event.payload.OrderPickedUpEvent;
import com.nexora.backend.domain.model.Courier;
import com.nexora.backend.domain.repository.CourierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourierPerformanceService {

    private static final List<String> PERFORMANCE_EVENT_TYPES = List.of(
            "OrderAssignedToCourier",
            "OrderPickedUp",
            "OrderDelivered",
            "OrderDeliveryFailed",
            "OrderDeliveryRetryRequested"
    );

    private final CourierRepository courierRepository;
    private final DomainEventRepository domainEventRepository;
    private final ObjectMapper objectMapper;

    public record CourierPerformanceMetric(
            String courierId,
            String courierName,
            boolean active,
            long assignedOrdersCount,
            long pickedUpOrdersCount,
            long deliveredOrdersCount,
            long failedOrdersCount
    ) {}

    @Transactional(readOnly = true)
    public List<CourierPerformanceMetric> listPerformance(UUID tenantId) {
        Map<String, MetricAccumulator> metricsByCourierId = new LinkedHashMap<>();
        for (Courier courier : courierRepository.findByTenantIdOrderByNameAscCourierIdAsc(tenantId)) {
            metricsByCourierId.put(courier.getCourierId().toString(), new MetricAccumulator(courier));
        }

        Map<UUID, String> currentCourierByOrderId = new HashMap<>();
        for (DomainEvent event : domainEventRepository.findByTenantIdAndEventTypeInOrderByAggregateIdAscAggregateSequenceAsc(
                tenantId,
                PERFORMANCE_EVENT_TYPES
        )) {
            apply(event, metricsByCourierId, currentCourierByOrderId);
        }

        return metricsByCourierId.values().stream()
                .map(MetricAccumulator::toMetric)
                .toList();
    }

    private void apply(
            DomainEvent event,
            Map<String, MetricAccumulator> metricsByCourierId,
            Map<UUID, String> currentCourierByOrderId
    ) {
        switch (event.getEventType()) {
            case "OrderAssignedToCourier" -> {
                String courierId = readAssignedCourierId(event);
                currentCourierByOrderId.put(event.getAggregateId(), courierId);
                recordAssigned(metricsByCourierId, courierId);
            }
            case "OrderPickedUp" -> {
                String courierId = readPickupCourierId(event);
                currentCourierByOrderId.put(event.getAggregateId(), courierId);
                recordPickedUp(metricsByCourierId, courierId);
            }
            case "OrderDelivered" -> recordDelivered(
                    metricsByCourierId,
                    currentCourierByOrderId.remove(event.getAggregateId())
            );
            case "OrderDeliveryFailed" -> recordFailed(
                    metricsByCourierId,
                    currentCourierByOrderId.remove(event.getAggregateId())
            );
            case "OrderDeliveryRetryRequested" -> currentCourierByOrderId.remove(event.getAggregateId());
            default -> throw new IllegalStateException("Unsupported courier performance event: " + event.getEventType());
        }
    }

    private String readAssignedCourierId(DomainEvent event) {
        try {
            return objectMapper.readValue(event.getPayload(), OrderAssignedToCourierEvent.class).courierId();
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to read assigned courier from order event", ex);
        }
    }

    private String readPickupCourierId(DomainEvent event) {
        try {
            return objectMapper.readValue(event.getPayload(), OrderPickedUpEvent.class).courierId();
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to read picked up courier from order event", ex);
        }
    }

    private void recordAssigned(Map<String, MetricAccumulator> metricsByCourierId, String courierId) {
        MetricAccumulator metric = metricsByCourierId.get(courierId);
        if (metric != null) {
            metric.assignedOrdersCount++;
        }
    }

    private void recordPickedUp(Map<String, MetricAccumulator> metricsByCourierId, String courierId) {
        MetricAccumulator metric = metricsByCourierId.get(courierId);
        if (metric != null) {
            metric.pickedUpOrdersCount++;
        }
    }

    private void recordDelivered(Map<String, MetricAccumulator> metricsByCourierId, String courierId) {
        MetricAccumulator metric = metricsByCourierId.get(courierId);
        if (metric != null) {
            metric.deliveredOrdersCount++;
        }
    }

    private void recordFailed(Map<String, MetricAccumulator> metricsByCourierId, String courierId) {
        MetricAccumulator metric = metricsByCourierId.get(courierId);
        if (metric != null) {
            metric.failedOrdersCount++;
        }
    }

    private static final class MetricAccumulator {
        private final String courierId;
        private final String courierName;
        private final boolean active;
        private long assignedOrdersCount;
        private long pickedUpOrdersCount;
        private long deliveredOrdersCount;
        private long failedOrdersCount;

        private MetricAccumulator(Courier courier) {
            this.courierId = courier.getCourierId().toString();
            this.courierName = courier.getName();
            this.active = courier.isActive();
        }

        private CourierPerformanceMetric toMetric() {
            return new CourierPerformanceMetric(
                    courierId,
                    courierName,
                    active,
                    assignedOrdersCount,
                    pickedUpOrdersCount,
                    deliveredOrdersCount,
                    failedOrdersCount
            );
        }
    }
}
