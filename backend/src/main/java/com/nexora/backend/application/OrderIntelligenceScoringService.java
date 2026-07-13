package com.nexora.backend.application;

import com.nexora.backend.domain.model.ConfirmationAttempt;
import com.nexora.backend.domain.model.ConfirmationOutcome;
import com.nexora.backend.domain.model.DeliveryFailure;
import com.nexora.backend.domain.model.DeliveryFailureReason;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderIntelligenceAuditEvent;
import com.nexora.backend.domain.model.OrderIntelligenceLevel;
import com.nexora.backend.domain.model.OrderIntelligenceSignal;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSeverity;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSource;
import com.nexora.backend.domain.model.OrderIntelligenceSnapshot;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.ConfirmationAttemptRepository;
import com.nexora.backend.domain.repository.DeliveryFailureRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceAuditEventRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSignalRepository;
import com.nexora.backend.domain.repository.OrderIntelligenceSnapshotRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderIntelligenceScoringService {

    private static final ScoringCalibration CALIBRATION = ScoringCalibration.v1();

    private final OrderRepository orderRepository;
    private final ConfirmationAttemptRepository confirmationAttemptRepository;
    private final DeliveryFailureRepository deliveryFailureRepository;
    private final OrderIntelligenceSnapshotRepository snapshotRepository;
    private final OrderIntelligenceSignalRepository signalRepository;
    private final OrderIntelligenceAuditEventRepository auditEventRepository;
    private final Clock clock;

    @Transactional
    public OrderIntelligenceResult getOrCalculate(UUID tenantId, UUID orderId) {
        OrderIntelligenceSnapshot snapshot = snapshotRepository.findByTenantIdAndOrderId(tenantId, orderId).orElse(null);
        if (snapshot == null) {
            return recalculate(tenantId, orderId);
        }
        return new OrderIntelligenceResult(
                snapshot,
                signalRepository.findByTenantIdAndOrderIdOrderBySortRankAsc(tenantId, orderId),
                List.of()
        );
    }

    @Transactional
    public OrderIntelligenceResult getOrCalculateWithHistory(UUID tenantId, UUID orderId, int historyLimit) {
        OrderIntelligenceResult result = getOrCalculate(tenantId, orderId);
        return new OrderIntelligenceResult(
                result.snapshot(),
                result.signals(),
                auditEventRepository.findByTenantIdAndOrderIdOrderBySequenceNumberDescCalculatedAtDesc(
                        tenantId,
                        orderId,
                        PageRequest.of(0, Math.max(1, historyLimit))
                )
        );
    }

    @Transactional
    public Map<UUID, OrderIntelligenceResult> getOrCalculate(UUID tenantId, List<Order> orders) {
        Map<UUID, OrderIntelligenceResult> results = new LinkedHashMap<>();
        for (Order order : orders) {
            results.put(order.getId(), getOrCalculate(tenantId, order.getId()));
        }
        return results;
    }

    public OrderIntelligenceCalibration calibration() {
        return new OrderIntelligenceCalibration(
                CALIBRATION.version(),
                CALIBRATION.baseConfirmationConfidence(),
                CALIBRATION.baseFraudRisk(),
                CALIBRATION.highConfidenceMinimumConfidence(),
                CALIBRATION.highConfidenceMaximumRisk(),
                CALIBRATION.highRiskMinimumRisk(),
                CALIBRATION.confirmedMinimumConfidence(),
                CALIBRATION.confirmedMaximumRisk(),
                CALIBRATION.deliveredMinimumConfidence(),
                CALIBRATION.deliveredMaximumRisk(),
                CALIBRATION.minimumPhoneDigits(),
                CALIBRATION.maximumPhoneDigits()
        );
    }

    @Transactional
    public OrderIntelligenceResult recalculate(UUID tenantId, UUID orderId) {
        return recalculateInternal(tenantId, orderId);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public OrderIntelligenceResult recalculateAfterProjection(UUID tenantId, UUID orderId) {
        return recalculateInternal(tenantId, orderId);
    }

    private OrderIntelligenceResult recalculateInternal(UUID tenantId, UUID orderId) {
        Order order = orderRepository.findByIdAndTenantId(orderId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Order not found"));
        OrderIntelligenceSnapshot previousSnapshot = snapshotRepository.findByTenantIdAndOrderId(tenantId, orderId)
                .orElse(null);
        PreviousScore previousScore = PreviousScore.from(previousSnapshot);

        Instant now = Instant.now(clock);
        List<ConfirmationAttempt> attempts = confirmationAttemptRepository
                .findByTenantIdAndOrderIdOrderByAttemptNumberAsc(tenantId, orderId);
        List<DeliveryFailure> deliveryFailures = deliveryFailureRepository
                .findByTenantIdAndOrderIdOrderByCreatedAtAsc(tenantId, orderId);
        List<Order> samePhoneOrders = samePhoneOrders(tenantId, order);

        Score score = new Score();
        scoreOrderQuality(score, order);
        scoreCurrentAttempts(score, attempts, now);
        scorePhoneHistory(score, tenantId, order, samePhoneOrders);
        scoreDeliverySignals(score, deliveryFailures);
        applyFinalStateCaps(score, order, attempts);

        int confidence = clamp(score.confirmationConfidence);
        int risk = clamp(score.fraudRisk);
        OrderIntelligenceLevel level = level(confidence, risk);
        List<ScoreSignal> rankedSignals = rank(score.signals);
        String summary = summary(level, rankedSignals);

        OrderIntelligenceSnapshot snapshot;
        if (previousSnapshot == null) {
            snapshot = snapshotRepository.save(OrderIntelligenceSnapshot.builder()
                    .tenantId(tenantId)
                    .orderId(orderId)
                    .confirmationConfidenceScore(confidence)
                    .fraudRiskScore(risk)
                    .level(level)
                    .summary(summary)
                    .calculatedAt(now)
                    .build());
        } else {
            previousSnapshot.updateScore(confidence, risk, level, summary, now);
            snapshot = snapshotRepository.save(previousSnapshot);
        }

        signalRepository.deleteByTenantIdAndOrderId(tenantId, orderId);
        List<OrderIntelligenceSignal> storedSignals = toStoredSignals(tenantId, orderId, rankedSignals, now);
        signalRepository.saveAll(storedSignals);
        OrderIntelligenceAuditEvent auditEvent = auditEventRepository.save(toAuditEvent(
                tenantId,
                orderId,
                previousScore,
                confidence,
                risk,
                level,
                summary,
                rankedSignals,
                now
        ));
        return new OrderIntelligenceResult(snapshot, storedSignals, List.of(auditEvent));
    }

    private void scoreOrderQuality(Score score, Order order) {
        if (validPhone(order.getCustomer().getPhone())) {
            score.add("valid_phone", "Valid phone format", "Phone has enough digits for a confirmation call.", 5, -3,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.ORDER);
        } else {
            score.add("weak_phone", "Weak phone", "Phone is missing, too short, or has a suspicious format.", -25, 25,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.ORDER);
        }

        if (hasText(customerName(order))) {
            score.add("customer_name_present", "Customer name present", "The order includes a customer name for the call.", 3, 0,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.ORDER);
        }

        if (completeAddress(order)) {
            score.add("complete_address", "Address has delivery basics", "Street, city, and country are present.", 5, -3,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.ORDER);
        } else {
            score.add("weak_address", "Weak address", "Street, city, or country is missing or too vague.", -15, 15,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.ORDER);
        }
    }

    private void scoreCurrentAttempts(Score score, List<ConfirmationAttempt> attempts, Instant now) {
        int noAnswerCount = 0;
        int callbackCount = 0;
        boolean callbackRequested = false;
        boolean onTimeCallbackResolved = false;
        boolean callbackOverdue = false;
        boolean wrongNumber = false;
        boolean rejected = false;

        for (ConfirmationAttempt attempt : attempts) {
            if (attempt.getOutcome() == ConfirmationOutcome.NO_ANSWER) {
                noAnswerCount++;
                if (noAnswerCount == 1) {
                    score.add("first_no_answer", "First no-answer attempt", "The first confirmation call was not answered.", -10, 10,
                            OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.CONFIRMATION);
                } else if (noAnswerCount == 2) {
                    score.add("second_no_answer", "Second no-answer attempt", "The customer repeated the same no-answer behavior.", -15, 15,
                            OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.CONFIRMATION);
                } else {
                    score.add("repeated_no_answer", "Repeated no-answer attempts", "Three or more confirmation calls were not answered.", -20, 20,
                            OrderIntelligenceSignalSeverity.CRITICAL, OrderIntelligenceSignalSource.CONFIRMATION);
                }
            }

            if (attempt.getOutcome() == ConfirmationOutcome.CALL_BACK_LATER) {
                callbackCount++;
                callbackRequested = true;
                if (attempt.getCallbackResolvedAt() != null
                        && attempt.getCallbackAt() != null
                        && !attempt.getCallbackResolvedAt().isAfter(attempt.getCallbackAt())) {
                    onTimeCallbackResolved = true;
                }
                if (attempt.getCallbackResolvedAt() == null
                        && attempt.getCallbackAt() != null
                        && attempt.getCallbackAt().isBefore(now)) {
                    callbackOverdue = true;
                }
            }

            if (attempt.getOutcome() == ConfirmationOutcome.WRONG_NUMBER) {
                wrongNumber = true;
            }
            if (attempt.getOutcome() == ConfirmationOutcome.REJECTED) {
                rejected = true;
            }
        }

        if (callbackRequested) {
            score.add("callback_requested", "Customer requested callback", "The customer gave a next-contact window instead of refusing.", 5, 0,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.CALLBACK);
        }
        if (onTimeCallbackResolved) {
            score.add("callback_resolved_on_time", "Callback resolved on time", "The scheduled callback was completed by its due time.", 8, -5,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.CALLBACK);
        }
        if (callbackOverdue) {
            score.add("callback_overdue", "Callback overdue", "A scheduled callback has passed without resolution.", -15, 15,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.CALLBACK);
        }
        if (callbackCount > 1 && attempts.stream().noneMatch(attempt -> attempt.getOutcome() == ConfirmationOutcome.CONFIRMED)) {
            score.add("multiple_callbacks", "Multiple callbacks without confirmation", "The customer has asked for more than one callback.", -10, 10,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.CALLBACK);
        }
        if (repeatedUnresolvedOutcome(attempts)) {
            score.add("repeated_unresolved_outcome", "Repeated unresolved behavior", "The latest attempts returned the same unresolved result.", -10, 10,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.CONFIRMATION);
        }
        if (wrongNumber) {
            score.add("wrong_number", "Wrong number", "The phone number does not reach the customer.", -60, 60,
                    OrderIntelligenceSignalSeverity.CRITICAL, OrderIntelligenceSignalSource.CONFIRMATION);
        }
        if (rejected) {
            score.add("customer_rejected", "Customer rejected order", "The customer refused or cancelled during confirmation.", -50, 40,
                    OrderIntelligenceSignalSeverity.CRITICAL, OrderIntelligenceSignalSource.CONFIRMATION);
        }
    }

    private void scorePhoneHistory(Score score, UUID tenantId, Order order, List<Order> samePhoneOrders) {
        String phone = normalize(order.getCustomer().getPhone());
        if (phone == null) {
            return;
        }

        List<Order> previousOrders = samePhoneOrders.stream()
                .filter(previous -> !previous.getId().equals(order.getId()))
                .toList();

        boolean deliveredBefore = previousOrders.stream().anyMatch(previous -> previous.getStatus() == OrderStatus.DELIVERED);
        boolean confirmedBefore = previousOrders.stream().anyMatch(previous -> List.of(
                OrderStatus.CONFIRMED,
                OrderStatus.ASSIGNED_TO_COURIER,
                OrderStatus.PICKED_UP
        ).contains(previous.getStatus()));
        boolean rejectedBefore = previousOrders.stream().anyMatch(previous -> previous.getStatus() == OrderStatus.REJECTED);
        long customerNames = previousOrders.stream()
                .map(this::normalizedCustomerName)
                .filter(this::hasText)
                .distinct()
                .count();

        if (deliveredBefore) {
            score.add("phone_delivered_before", "Same phone delivered before", "This phone has a previous successful delivery.", 20, -15,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.HISTORY);
        } else if (confirmedBefore) {
            score.add("phone_confirmed_before", "Same phone confirmed before", "This phone has a previous confirmed order.", 15, -10,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.HISTORY);
        }

        if (rejectedBefore) {
            score.add("phone_rejected_before", "Same phone rejected another order", "A recent order for this phone was rejected.", -25, 25,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.HISTORY);
        }

        long historicalNoAnswers = confirmationAttemptRepository.countHistoricalPhoneAttemptsByOutcome(
                tenantId,
                order.getId(),
                phone,
                ConfirmationOutcome.NO_ANSWER
        );
        if (historicalNoAnswers >= 2) {
            score.add("phone_repeated_no_answer_history", "Same phone has repeated no-answer history",
                    historicalNoAnswers + " previous no-answer attempts were recorded for this phone.", -20, 20,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.HISTORY);
        }

        String currentName = normalizedCustomerName(order);
        boolean differentName = previousOrders.stream()
                .map(this::normalizedCustomerName)
                .filter(this::hasText)
                .anyMatch(previousName -> hasText(currentName) && !previousName.equals(currentName));
        if (differentName || customerNames > 1) {
            score.add("phone_different_names", "Same phone used with different customer names",
                    "This phone appears with different customer names across recent orders.", -15, 15,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.HISTORY);
        }
    }

    private void scoreDeliverySignals(Score score, List<DeliveryFailure> deliveryFailures) {
        if (deliveryFailures.isEmpty()) {
            return;
        }

        DeliveryFailure latestFailure = deliveryFailures.get(deliveryFailures.size() - 1);
        DeliveryFailureReason reason = latestFailure.getReason();
        switch (reason) {
            case CUSTOMER_UNREACHABLE -> score.add("delivery_customer_unreachable", "Delivery failed: customer unreachable",
                    "Courier could not reach the customer during delivery.", -25, 25,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.DELIVERY);
            case CUSTOMER_REFUSED -> score.add("delivery_customer_refused", "Delivery failed: customer refused",
                    "Customer refused the package during delivery.", -30, 30,
                    OrderIntelligenceSignalSeverity.CRITICAL, OrderIntelligenceSignalSource.DELIVERY);
            case INVALID_ADDRESS -> score.add("delivery_invalid_address", "Delivery failed: invalid address",
                    "Courier reported the delivery address could not be used.", -35, 35,
                    OrderIntelligenceSignalSeverity.CRITICAL, OrderIntelligenceSignalSource.DELIVERY);
            case CUSTOMER_RESCHEDULED -> score.add("delivery_rescheduled", "Delivery rescheduled",
                    "Customer asked for a new delivery window.", -5, 5,
                    OrderIntelligenceSignalSeverity.INFO, OrderIntelligenceSignalSource.DELIVERY);
            case LOST_PACKAGE, OTHER -> score.add("delivery_failed_other", "Delivery failed",
                    "A delivery failure was recorded and needs review.", -10, 10,
                    OrderIntelligenceSignalSeverity.WARNING, OrderIntelligenceSignalSource.DELIVERY);
        }
    }

    private void applyFinalStateCaps(Score score, Order order, List<ConfirmationAttempt> attempts) {
        if (attempts.stream().anyMatch(attempt -> attempt.getOutcome() == ConfirmationOutcome.CONFIRMED)) {
            score.add("order_confirmed", "Order confirmed", "Customer accepted the order during confirmation.", 35, -35,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.CONFIRMATION);
            score.confirmationConfidence = Math.max(score.confirmationConfidence, CALIBRATION.confirmedMinimumConfidence());
            score.fraudRisk = Math.min(score.fraudRisk, CALIBRATION.confirmedMaximumRisk());
        }
        if (order.getStatus() == OrderStatus.DELIVERED) {
            score.add("order_delivered", "Order delivered", "The order reached a successful delivery outcome.", 38, -37,
                    OrderIntelligenceSignalSeverity.POSITIVE, OrderIntelligenceSignalSource.DELIVERY);
            score.confirmationConfidence = Math.max(score.confirmationConfidence, CALIBRATION.deliveredMinimumConfidence());
            score.fraudRisk = Math.min(score.fraudRisk, CALIBRATION.deliveredMaximumRisk());
        }
    }

    private List<Order> samePhoneOrders(UUID tenantId, Order order) {
        String phone = normalize(order.getCustomer().getPhone());
        if (phone == null) {
            return List.of();
        }
        return orderRepository.findTop20ByTenantIdAndCustomer_PhoneOrderByCreatedAtDesc(tenantId, phone);
    }

    private boolean repeatedUnresolvedOutcome(List<ConfirmationAttempt> attempts) {
        if (attempts.size() < 2) {
            return false;
        }
        ConfirmationAttempt latest = attempts.get(attempts.size() - 1);
        ConfirmationAttempt previous = attempts.get(attempts.size() - 2);
        if (latest.getOutcome() == ConfirmationOutcome.CONFIRMED || latest.getOutcome() == ConfirmationOutcome.REJECTED) {
            return false;
        }
        return latest.getOutcome() == previous.getOutcome();
    }

    private boolean validPhone(String value) {
        String normalized = normalize(value);
        if (normalized == null) {
            return false;
        }
        String digits = normalized.replaceAll("\\D", "");
        if (digits.length() < CALIBRATION.minimumPhoneDigits() || digits.length() > CALIBRATION.maximumPhoneDigits()) {
            return false;
        }
        return digits.chars().distinct().count() > 1;
    }

    private boolean completeAddress(Order order) {
        return hasText(order.getAddress().getStreet())
                && order.getAddress().getStreet().trim().length() >= 8
                && hasText(order.getAddress().getCity())
                && hasText(order.getAddress().getCountry());
    }

    private String customerName(Order order) {
        return ((order.getCustomer().getFirstName() == null ? "" : order.getCustomer().getFirstName()) + " "
                + (order.getCustomer().getLastName() == null ? "" : order.getCustomer().getLastName())).trim();
    }

    private String normalizedCustomerName(Order order) {
        String name = customerName(order);
        return hasText(name) ? name.toLowerCase(Locale.ROOT) : null;
    }

    private String normalize(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private int clamp(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private OrderIntelligenceLevel level(int confidence, int risk) {
        if (confidence >= CALIBRATION.highConfidenceMinimumConfidence()
                && risk <= CALIBRATION.highConfidenceMaximumRisk()) {
            return OrderIntelligenceLevel.HIGH_CONFIDENCE;
        }
        if (risk >= CALIBRATION.highRiskMinimumRisk()) {
            return OrderIntelligenceLevel.HIGH_RISK;
        }
        return OrderIntelligenceLevel.NEEDS_ATTENTION;
    }

    private String summary(OrderIntelligenceLevel level, List<ScoreSignal> signals) {
        return switch (level) {
            case HIGH_CONFIDENCE -> "Strong confirmation signals";
            case HIGH_RISK -> signals.stream()
                    .filter(signal -> signal.riskDelta() > 0 || signal.confidenceDelta() < 0)
                    .findFirst()
                    .map(signal -> "High risk: " + signal.label())
                    .orElse("High risk signals detected");
            case NEEDS_ATTENTION -> signals.stream()
                    .filter(signal -> signal.riskDelta() > 0 || signal.confidenceDelta() < 0)
                    .findFirst()
                    .map(signal -> "Review: " + signal.label())
                    .orElse("Review confirmation signals before progressing");
        };
    }

    private List<ScoreSignal> rank(List<ScoreSignal> signals) {
        return signals.stream()
                .sorted(Comparator
                        .comparingInt(this::signalPriority).reversed()
                        .thenComparing(ScoreSignal::label))
                .toList();
    }

    private int signalPriority(ScoreSignal signal) {
        int severityWeight = switch (signal.severity()) {
            case CRITICAL -> 100;
            case WARNING -> 70;
            case POSITIVE -> 50;
            case INFO -> 30;
        };
        return severityWeight + Math.abs(signal.confidenceDelta()) + Math.abs(signal.riskDelta());
    }

    private List<OrderIntelligenceSignal> toStoredSignals(
            UUID tenantId,
            UUID orderId,
            List<ScoreSignal> signals,
            Instant calculatedAt
    ) {
        for (int index = 0; index < signals.size(); index++) {
            signals.get(index).setSortRank(index + 1);
        }
        return signals.stream()
                .map(signal -> OrderIntelligenceSignal.builder()
                        .signalId(UUID.randomUUID())
                        .tenantId(tenantId)
                        .orderId(orderId)
                        .signalKey(signal.key())
                        .label(signal.label())
                        .detail(signal.detail())
                        .confidenceDelta(signal.confidenceDelta())
                        .riskDelta(signal.riskDelta())
                        .severity(signal.severity())
                        .source(signal.source())
                        .sortRank(signal.sortRank())
                        .calculatedAt(calculatedAt)
                        .build())
                .toList();
    }

    private OrderIntelligenceAuditEvent toAuditEvent(
            UUID tenantId,
            UUID orderId,
            PreviousScore previous,
            int confidence,
            int risk,
            OrderIntelligenceLevel level,
            String summary,
            List<ScoreSignal> rankedSignals,
            Instant calculatedAt
    ) {
        ScoreSignal reason = rankedSignals.isEmpty() ? null : rankedSignals.get(0);
        int confidenceDelta = previous == null ? 0 : confidence - previous.confirmationConfidenceScore();
        int riskDelta = previous == null ? 0 : risk - previous.fraudRiskScore();

        return OrderIntelligenceAuditEvent.builder()
                .eventId(UUID.randomUUID())
                .tenantId(tenantId)
                .orderId(orderId)
                .sequenceNumber(auditEventRepository.countByTenantIdAndOrderId(tenantId, orderId) + 1)
                .previousConfirmationConfidenceScore(previous == null ? null : previous.confirmationConfidenceScore())
                .previousFraudRiskScore(previous == null ? null : previous.fraudRiskScore())
                .previousLevel(previous == null ? null : previous.level())
                .confirmationConfidenceScore(confidence)
                .fraudRiskScore(risk)
                .level(level)
                .confidenceDelta(confidenceDelta)
                .riskDelta(riskDelta)
                .changeLabel(changeLabel(previous, level, confidenceDelta, riskDelta))
                .summary(summary)
                .reasonKey(reason == null ? null : reason.key())
                .reasonLabel(reason == null ? null : reason.label())
                .reasonDetail(reason == null ? null : reason.detail())
                .reasonSeverity(reason == null ? null : reason.severity())
                .reasonSource(reason == null ? null : reason.source())
                .calibrationVersion(CALIBRATION.version())
                .calculatedAt(calculatedAt)
                .build();
    }

    private String changeLabel(PreviousScore previous, OrderIntelligenceLevel level, int confidenceDelta, int riskDelta) {
        if (previous == null) {
            return "Initial score";
        }
        if (previous.level() != level) {
            return "Moved to " + levelLabel(level);
        }
        if (confidenceDelta == 0 && riskDelta == 0) {
            return "Score recalculated";
        }
        if (confidenceDelta >= 0 && riskDelta < 0) {
            return "Score improved";
        }
        if (confidenceDelta < 0 || riskDelta > 0) {
            return "Risk increased";
        }
        return "Score updated";
    }

    private String levelLabel(OrderIntelligenceLevel level) {
        return switch (level) {
            case HIGH_CONFIDENCE -> "High confidence";
            case NEEDS_ATTENTION -> "Needs attention";
            case HIGH_RISK -> "High risk";
        };
    }

    public record OrderIntelligenceResult(
            OrderIntelligenceSnapshot snapshot,
            List<OrderIntelligenceSignal> signals,
            List<OrderIntelligenceAuditEvent> history
    ) {
        public OrderIntelligenceResult {
            signals = signals == null ? List.of() : List.copyOf(signals);
            history = history == null ? List.of() : List.copyOf(history);
        }
    }

    public record OrderIntelligenceCalibration(
            String version,
            int baseConfirmationConfidence,
            int baseFraudRisk,
            int highConfidenceMinimumConfidence,
            int highConfidenceMaximumRisk,
            int highRiskMinimumRisk,
            int confirmedMinimumConfidence,
            int confirmedMaximumRisk,
            int deliveredMinimumConfidence,
            int deliveredMaximumRisk,
            int minimumPhoneDigits,
            int maximumPhoneDigits
    ) {}

    private record PreviousScore(
            int confirmationConfidenceScore,
            int fraudRiskScore,
            OrderIntelligenceLevel level
    ) {
        private static PreviousScore from(OrderIntelligenceSnapshot snapshot) {
            if (snapshot == null) {
                return null;
            }
            return new PreviousScore(
                    snapshot.getConfirmationConfidenceScore(),
                    snapshot.getFraudRiskScore(),
                    snapshot.getLevel()
            );
        }
    }

    private final class Score {
        private int confirmationConfidence = CALIBRATION.baseConfirmationConfidence();
        private int fraudRisk = CALIBRATION.baseFraudRisk();
        private final List<ScoreSignal> signals = new java.util.ArrayList<>();

        private void add(
                String key,
                String label,
                String detail,
                int confidenceDelta,
                int riskDelta,
                OrderIntelligenceSignalSeverity severity,
                OrderIntelligenceSignalSource source
        ) {
            confirmationConfidence += confidenceDelta;
            fraudRisk += riskDelta;
            signals.add(new ScoreSignal(key, label, detail, confidenceDelta, riskDelta, severity, source));
        }
    }

    private record ScoringCalibration(
            String version,
            int baseConfirmationConfidence,
            int baseFraudRisk,
            int highConfidenceMinimumConfidence,
            int highConfidenceMaximumRisk,
            int highRiskMinimumRisk,
            int confirmedMinimumConfidence,
            int confirmedMaximumRisk,
            int deliveredMinimumConfidence,
            int deliveredMaximumRisk,
            int minimumPhoneDigits,
            int maximumPhoneDigits
    ) {
        private static ScoringCalibration v1() {
            return new ScoringCalibration(
                    "v1",
                    60,
                    40,
                    75,
                    35,
                    65,
                    95,
                    5,
                    98,
                    3,
                    9,
                    15
            );
        }
    }

    private static final class ScoreSignal {
        private final String key;
        private final String label;
        private final String detail;
        private final int confidenceDelta;
        private final int riskDelta;
        private final OrderIntelligenceSignalSeverity severity;
        private final OrderIntelligenceSignalSource source;
        private int sortRank;

        private ScoreSignal(
                String key,
                String label,
                String detail,
                int confidenceDelta,
                int riskDelta,
                OrderIntelligenceSignalSeverity severity,
                OrderIntelligenceSignalSource source
        ) {
            this.key = key;
            this.label = label;
            this.detail = detail;
            this.confidenceDelta = confidenceDelta;
            this.riskDelta = riskDelta;
            this.severity = severity;
            this.source = source;
        }

        private String key() {
            return key;
        }

        private String label() {
            return label;
        }

        private String detail() {
            return detail;
        }

        private int confidenceDelta() {
            return confidenceDelta;
        }

        private int riskDelta() {
            return riskDelta;
        }

        private OrderIntelligenceSignalSeverity severity() {
            return severity;
        }

        private OrderIntelligenceSignalSource source() {
            return source;
        }

        private int sortRank() {
            return sortRank;
        }

        private void setSortRank(int sortRank) {
            this.sortRank = sortRank;
        }
    }
}
