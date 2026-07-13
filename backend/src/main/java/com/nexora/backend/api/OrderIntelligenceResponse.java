package com.nexora.backend.api;

import com.nexora.backend.application.OrderIntelligenceScoringService;
import com.nexora.backend.domain.model.OrderIntelligenceAuditEvent;
import com.nexora.backend.domain.model.OrderIntelligenceLevel;
import com.nexora.backend.domain.model.OrderIntelligenceSignal;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSeverity;
import com.nexora.backend.domain.model.OrderIntelligenceSignalSource;

import java.time.Instant;
import java.util.List;

public record OrderIntelligenceResponse(
        int confirmationConfidenceScore,
        int fraudRiskScore,
        OrderIntelligenceLevel level,
        String summary,
        Instant calculatedAt,
        List<SignalResponse> signals,
        List<AuditEventResponse> history
) {
    static OrderIntelligenceResponse from(OrderIntelligenceScoringService.OrderIntelligenceResult result) {
        return from(result, Integer.MAX_VALUE, Integer.MAX_VALUE);
    }

    static OrderIntelligenceResponse from(OrderIntelligenceScoringService.OrderIntelligenceResult result, int signalLimit) {
        return from(result, signalLimit, 0);
    }

    static OrderIntelligenceResponse from(
            OrderIntelligenceScoringService.OrderIntelligenceResult result,
            int signalLimit,
            int historyLimit
    ) {
        if (result == null || result.snapshot() == null) {
            return null;
        }
        return new OrderIntelligenceResponse(
                result.snapshot().getConfirmationConfidenceScore(),
                result.snapshot().getFraudRiskScore(),
                result.snapshot().getLevel(),
                result.snapshot().getSummary(),
                result.snapshot().getCalculatedAt(),
                result.signals().stream()
                        .limit(signalLimit)
                        .map(SignalResponse::from)
                        .toList(),
                result.history().stream()
                        .limit(historyLimit)
                        .map(AuditEventResponse::from)
                        .toList()
        );
    }

    public record SignalResponse(
            String key,
            String label,
            String detail,
            int confidenceDelta,
            int riskDelta,
            OrderIntelligenceSignalSeverity severity,
            OrderIntelligenceSignalSource source
    ) {
        static SignalResponse from(OrderIntelligenceSignal signal) {
            return new SignalResponse(
                    signal.getSignalKey(),
                    signal.getLabel(),
                    signal.getDetail(),
                    signal.getConfidenceDelta(),
                    signal.getRiskDelta(),
                    signal.getSeverity(),
                    signal.getSource()
            );
        }
    }

    public record AuditEventResponse(
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
            String reasonDetail,
            OrderIntelligenceSignalSeverity reasonSeverity,
            OrderIntelligenceSignalSource reasonSource,
            String calibrationVersion,
            Instant calculatedAt
    ) {
        static AuditEventResponse from(OrderIntelligenceAuditEvent event) {
            return new AuditEventResponse(
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
                    event.getReasonDetail(),
                    event.getReasonSeverity(),
                    event.getReasonSource(),
                    event.getCalibrationVersion(),
                    event.getCalculatedAt()
            );
        }
    }
}
