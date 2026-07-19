package com.nexora.backend.application;

import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.OrderIntelligenceAuditEvent;
import com.nexora.backend.domain.model.OrderIntelligenceLevel;
import com.nexora.backend.domain.model.OrderIntelligenceSignal;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSeverity;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSource;
import com.nexora.backend.domain.model.OrderIntelligenceSnapshot;
import com.nexora.backend.domain.repository.OrderIntelligenceAuditEventRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSignalRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSnapshotRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderIntelligenceReportService {

    private final OrderIntelligenceSnapshotRepository snapshotRepository;
    private final OrderIntelligenceSignalRepository signalRepository;
    private final OrderIntelligenceAuditEventRepository auditEventRepository;
    private final OrderRepository orderRepository;
    private final OrderIntelligenceScoringService scoringService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public OrderIntelligenceReport getReport(
            UUID tenantId,
            int movementLimit,
            int signalLimit,
            int watchlistLimit
    ) {
        List<OrderIntelligenceSnapshot> snapshots = snapshotRepository.findByTenantId(tenantId);
        long scoredOrders = snapshots.size();
        long highConfidenceCount = countLevel(snapshots, OrderIntelligenceLevel.HIGH_CONFIDENCE);
        long needsAttentionCount = countLevel(snapshots, OrderIntelligenceLevel.NEEDS_ATTENTION);
        long highRiskCount = countLevel(snapshots, OrderIntelligenceLevel.HIGH_RISK);

        List<OrderIntelligenceAuditEvent> recentMovements = auditEventRepository
                .findByTenantIdOrderByCalculatedAtDescSequenceNumberDesc(
                        tenantId,
                        PageRequest.of(0, normalizeLimit(movementLimit))
                );

        return new OrderIntelligenceReport(
                Instant.now(clock),
                scoredOrders,
                averageConfidence(snapshots),
                averageRisk(snapshots),
                highConfidenceCount,
                needsAttentionCount,
                highRiskCount,
                new MovementSummary(
                        auditEventRepository.countImprovedMovements(tenantId),
                        auditEventRepository.countRiskIncreasedMovements(tenantId),
                        auditEventRepository.countLevelChangedMovements(tenantId)
                ),
                topSignals(signalRepository.findByTenantId(tenantId), normalizeLimit(signalLimit)),
                recentMovements.stream()
                        .map(this::toMovement)
                        .toList(),
                highRiskOrders(tenantId, normalizeLimit(watchlistLimit)),
                scoringService.calibration()
        );
    }

    private int normalizeLimit(int limit) {
        if (limit < 1) {
            return 1;
        }
        return Math.min(limit, 50);
    }

    private long countLevel(List<OrderIntelligenceSnapshot> snapshots, OrderIntelligenceLevel level) {
        return snapshots.stream()
                .filter(snapshot -> snapshot.getLevel() == level)
                .count();
    }

    private int averageConfidence(List<OrderIntelligenceSnapshot> snapshots) {
        return (int) Math.round(snapshots.stream()
                .mapToInt(OrderIntelligenceSnapshot::getConfirmationConfidenceScore)
                .average()
                .orElse(0));
    }

    private int averageRisk(List<OrderIntelligenceSnapshot> snapshots) {
        return (int) Math.round(snapshots.stream()
                .mapToInt(OrderIntelligenceSnapshot::getFraudRiskScore)
                .average()
                .orElse(0));
    }

    private List<TopSignal> topSignals(List<OrderIntelligenceSignal> signals, int limit) {
        Map<String, SignalAggregate> aggregates = new LinkedHashMap<>();
        for (OrderIntelligenceSignal signal : signals) {
            aggregates.computeIfAbsent(signal.getSignalKey(), ignored -> new SignalAggregate(signal))
                    .add(signal);
        }

        return aggregates.values().stream()
                .map(SignalAggregate::toTopSignal)
                .sorted(Comparator
                        .comparingLong(TopSignal::count).reversed()
                        .thenComparing(Comparator.comparingInt(TopSignal::totalRiskDelta).reversed())
                        .thenComparing(TopSignal::label))
                .limit(limit)
                .toList();
    }

    private Movement toMovement(OrderIntelligenceAuditEvent event) {
        return new Movement(
                event.getOrderId(),
                event.getSequenceNumber(),
                event.getPreviousConfirmationConfidenceScore(),
                event.getPreviousFraudRiskScore(),
                event.getPreviousLevel(),
                event.getConfirmationConfidenceScore(),
                event.getFraudRiskScore(),
                event.getLevel(),
                event.getConfidenceDelta(),
                event.getRiskDelta(),
                event.getChangeLabel(),
                event.getSummary(),
                event.getReasonKey(),
                event.getReasonLabel(),
                event.getReasonSeverity(),
                event.getReasonSource(),
                event.getCalibrationVersion(),
                event.getCalculatedAt()
        );
    }

    private List<WatchlistOrder> highRiskOrders(UUID tenantId, int limit) {
        return snapshotRepository.findByTenantIdAndLevelOrderByFraudRiskScoreDescCalculatedAtDesc(
                        tenantId,
                        OrderIntelligenceLevel.HIGH_RISK,
                        PageRequest.of(0, limit)
                )
                .stream()
                .map(snapshot -> toWatchlistOrder(tenantId, snapshot))
                .flatMap(Optional::stream)
                .toList();
    }

    private Optional<WatchlistOrder> toWatchlistOrder(UUID tenantId, OrderIntelligenceSnapshot snapshot) {
        return orderRepository.findByIdAndTenantId(snapshot.getOrderId(), tenantId)
                .map(order -> new WatchlistOrder(
                        order.getId(),
                        customerName(order.getCustomer()),
                        order.getCustomer().getPhone(),
                        order.getAmount(),
                        snapshot.getConfirmationConfidenceScore(),
                        snapshot.getFraudRiskScore(),
                        snapshot.getLevel(),
                        snapshot.getSummary(),
                        snapshot.getCalculatedAt()
                ));
    }

    private String customerName(Customer customer) {
        String firstName = customer.getFirstName() == null ? "" : customer.getFirstName().trim();
        String lastName = customer.getLastName() == null ? "" : customer.getLastName().trim();
        String name = (firstName + " " + lastName).trim();
        return name.isBlank() ? "Unknown customer" : name;
    }

    public record OrderIntelligenceReport(
            Instant generatedAt,
            long scoredOrders,
            int averageConfirmationConfidence,
            int averageFraudRisk,
            long highConfidenceCount,
            long needsAttentionCount,
            long highRiskCount,
            MovementSummary movementSummary,
            List<TopSignal> topSignals,
            List<Movement> recentMovements,
            List<WatchlistOrder> highRiskOrders,
            OrderIntelligenceScoringService.OrderIntelligenceCalibration calibration
    ) {}

    public record MovementSummary(
            long improvedCount,
            long riskIncreasedCount,
            long levelChangedCount
    ) {}

    public record TopSignal(
            String key,
            String label,
            String detail,
            OrderIntelligenceSignalSeverity severity,
            OrderIntelligenceSignalSource source,
            long count,
            int totalConfidenceDelta,
            int totalRiskDelta
    ) {}

    public record Movement(
            UUID orderId,
            long sequenceNumber,
            Integer previousConfirmationConfidenceScore,
            Integer previousFraudRiskScore,
            OrderIntelligenceLevel previousLevel,
            int confirmationConfidenceScore,
            int fraudRiskScore,
            OrderIntelligenceLevel level,
            int confidenceDelta,
            int riskDelta,
            String changeLabel,
            String summary,
            String reasonKey,
            String reasonLabel,
            OrderIntelligenceSignalSeverity reasonSeverity,
            OrderIntelligenceSignalSource reasonSource,
            String calibrationVersion,
            Instant calculatedAt
    ) {}

    public record WatchlistOrder(
            UUID orderId,
            String customerName,
            String customerPhone,
            BigDecimal amount,
            int confirmationConfidenceScore,
            int fraudRiskScore,
            OrderIntelligenceLevel level,
            String summary,
            Instant calculatedAt
    ) {}

    private static final class SignalAggregate {
        private final String key;
        private final String label;
        private final String detail;
        private final OrderIntelligenceSignalSeverity severity;
        private final OrderIntelligenceSignalSource source;
        private long count;
        private int totalConfidenceDelta;
        private int totalRiskDelta;

        private SignalAggregate(OrderIntelligenceSignal signal) {
            this.key = signal.getSignalKey();
            this.label = signal.getLabel();
            this.detail = signal.getDetail();
            this.severity = signal.getSeverity();
            this.source = signal.getSource();
        }

        private void add(OrderIntelligenceSignal signal) {
            count++;
            totalConfidenceDelta += signal.getConfidenceDelta();
            totalRiskDelta += signal.getRiskDelta();
        }

        private TopSignal toTopSignal() {
            return new TopSignal(key, label, detail, severity, source, count, totalConfidenceDelta, totalRiskDelta);
        }
    }
}
