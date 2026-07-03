package com.nexora.backend.application;

import com.nexora.backend.domain.event.payload.OrderSourceMetadata;
import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.repository.InboundOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OrderIngestionService {

    private final InboundOrderRepository inboundOrderRepository;
    private final OrderLifecycleService orderLifecycleService;

    @Transactional
    public IngestedOrderResult ingestAndNormalize(IngestOrderCommand command) {
        if (command.tenantId() == null) {
            throw new IllegalArgumentException("tenantId is required");
        }

        OrderSource source = command.source() == null ? OrderSource.MANUAL : command.source();
        String idempotencyKey = normalizeIdempotencyKey(command.idempotencyKey());
        String externalOrderId = normalizeNullable(command.externalOrderId());

        Optional<InboundOrder> existing = inboundOrderRepository.findByTenantIdAndSourceAndIdempotencyKey(
                command.tenantId(),
                source,
                idempotencyKey
        );
        if (existing.isEmpty() && externalOrderId != null) {
            existing = inboundOrderRepository.findByTenantIdAndSourceAndExternalOrderId(
                    command.tenantId(),
                    source,
                    externalOrderId
            );
        }
        if (existing.isPresent()) {
            return IngestedOrderResult.from(existing.get());
        }

        Instant now = Instant.now();
        InboundOrder inboundOrder = inboundOrderRepository.save(InboundOrder.builder()
                .inboundOrderId(UUID.randomUUID())
                .tenantId(command.tenantId())
                .source(source)
                .externalOrderId(externalOrderId)
                .idempotencyKey(idempotencyKey)
                .rawPayload(normalizeRawPayload(command.rawPayload()))
                .receivedAt(now)
                .status(InboundOrderStatus.RECEIVED)
                .build());

        String rejectionReason = validate(command, source);
        if (rejectionReason != null) {
            inboundOrder.markRejected(rejectionReason);
            return IngestedOrderResult.from(inboundOrderRepository.save(inboundOrder));
        }

        UUID orderId = orderLifecycleService.createOrder(
                command.tenantId(),
                command.customer(),
                command.address(),
                command.amount(),
                command.orderLines(),
                new OrderSourceMetadata(source, inboundOrder.getInboundOrderId(), externalOrderId)
        );
        inboundOrder.markNormalized(orderId, Instant.now());
        return IngestedOrderResult.from(inboundOrderRepository.save(inboundOrder));
    }

    private String validate(IngestOrderCommand command, OrderSource source) {
        boolean publicStorefrontOrder = source == OrderSource.WASILIO_STOREFRONT;
        if (command.customer() == null) {
            return "customer is required";
        }
        if (isBlank(command.customer().getFirstName())) {
            return "customer.firstName is required";
        }
        if (!publicStorefrontOrder && isBlank(command.customer().getLastName())) {
            return "customer.lastName is required";
        }
        if (!publicStorefrontOrder && isBlank(command.customer().getEmail())) {
            return "customer.email is required";
        }
        if (isBlank(command.customer().getPhone())) {
            return "customer.phone is required";
        }
        if (command.address() == null) {
            return "address is required";
        }
        if (isBlank(command.address().getStreet())) {
            return "address.street is required";
        }
        if (isBlank(command.address().getCity())) {
            return "address.city is required";
        }
        if (!publicStorefrontOrder && isBlank(command.address().getState())) {
            return "address.state is required";
        }
        if (!publicStorefrontOrder && isBlank(command.address().getZipCode())) {
            return "address.zipCode is required";
        }
        if (isBlank(command.address().getCountry())) {
            return "address.country is required";
        }
        if (command.amount() == null || command.amount().signum() <= 0) {
            return "amount must be greater than zero";
        }
        return null;
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        String normalized = normalizeNullable(idempotencyKey);
        return normalized == null ? "generated:" + UUID.randomUUID() : normalized;
    }

    private String normalizeRawPayload(String rawPayload) {
        String normalized = normalizeNullable(rawPayload);
        return normalized == null ? "{}" : normalized;
    }

    private String normalizeNullable(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public record IngestOrderCommand(
            UUID tenantId,
            OrderSource source,
            String externalOrderId,
            String idempotencyKey,
            String rawPayload,
            Customer customer,
            Address address,
            BigDecimal amount,
            List<OrderLineSnapshot> orderLines
    ) {
        public IngestOrderCommand(
                UUID tenantId,
                OrderSource source,
                String externalOrderId,
                String idempotencyKey,
                String rawPayload,
                Customer customer,
                Address address,
                BigDecimal amount
        ) {
            this(tenantId, source, externalOrderId, idempotencyKey, rawPayload, customer, address, amount, List.of());
        }
    }

    public record IngestedOrderResult(
            UUID inboundOrderId,
            UUID orderId,
            InboundOrderStatus status,
            OrderSource source,
            String externalOrderId,
            String rejectionReason
    ) {
        static IngestedOrderResult from(InboundOrder inboundOrder) {
            return new IngestedOrderResult(
                    inboundOrder.getInboundOrderId(),
                    inboundOrder.getNormalizedOrderId(),
                    inboundOrder.getStatus(),
                    inboundOrder.getSource(),
                    inboundOrder.getExternalOrderId(),
                    inboundOrder.getRejectionReason()
            );
        }
    }
}
