package com.nexora.backend.application;

import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Courier;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.Order;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import com.nexora.backend.domain.model.OrderSource;
import com.nexora.backend.domain.model.OrderStatus;
import com.nexora.backend.domain.repository.CourierRepository;
import com.nexora.backend.domain.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class OrderExportService {

    private static final int EXPORT_LIMIT = 10_000;
    private static final DateTimeFormatter CSV_DATE_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final OrderRepository orderRepository;
    private final CourierRepository courierRepository;

    public String exportOrdersCsv(
            UUID tenantId,
            List<OrderStatus> statuses,
            String phone,
            String customerName,
            String orderId,
            UUID courierId,
            Instant createdFrom,
            Instant createdTo
    ) {
        List<OrderStatus> requestedStatuses = statuses == null ? List.of() : statuses;
        Page<Order> page = orderRepository.searchOrders(
                tenantId,
                !requestedStatuses.isEmpty(),
                requestedStatuses.isEmpty()
                        ? List.of(OrderStatus.CREATED.name())
                        : requestedStatuses.stream().map(Enum::name).toList(),
                normalizeSearch(phone),
                normalizeSearch(customerName),
                normalizeSearch(orderId),
                courierId == null ? null : courierId.toString(),
                createdFrom != null,
                createdFrom,
                createdTo != null,
                createdTo,
                PageRequest.of(0, EXPORT_LIMIT)
        );

        if (page.getTotalElements() > EXPORT_LIMIT) {
            throw new IllegalArgumentException("Order export is limited to 10000 rows. Narrow the filters and try again.");
        }

        Map<String, String> courierNamesById = courierRepository.findByTenantIdOrderByNameAscCourierIdAsc(tenantId).stream()
                .collect(Collectors.toMap(
                        courier -> courier.getCourierId().toString(),
                        Courier::getName
                ));

        StringBuilder csv = new StringBuilder();
        appendCsvRow(csv, List.of(
                "Order ID",
                "Created At",
                "Customer",
                "Phone",
                "Email",
                "City",
                "Address",
                "Products",
                "Amount",
                "Currency",
                "Status",
                "Workflow Stage",
                "Confirmation Result",
                "Courier",
                "Delivery Outcome",
                "Failure Reason",
                "Source",
                "External Order ID"
        ));

        for (Order order : page.getContent()) {
            appendCsvRow(csv, List.of(
                    order.getId().toString(),
                    formatInstant(order.getCreatedAt()),
                    formatCustomer(order.getCustomer()),
                    safe(order.getCustomer().getPhone()),
                    safe(order.getCustomer().getEmail()),
                    safe(order.getAddress().getCity()),
                    formatAddress(order.getAddress()),
                    formatProducts(order.getOrderLines()),
                    formatAmount(order.getAmount()),
                    orderCurrency(order),
                    statusLabel(order.getStatus()),
                    workflowStage(order.getStatus()),
                    confirmationResult(order.getStatus()),
                    courierLabel(order.getCourierId(), courierNamesById),
                    deliveryOutcome(order.getStatus()),
                    failureReason(order.getFailureReason()),
                    sourceLabel(order.getSource()),
                    safe(order.getExternalOrderId())
            ));
        }

        return csv.toString();
    }

    private static String normalizeSearch(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static void appendCsvRow(StringBuilder csv, List<String> fields) {
        for (int i = 0; i < fields.size(); i++) {
            if (i > 0) {
                csv.append(',');
            }
            csv.append(escapeCsv(fields.get(i)));
        }
        csv.append('\n');
    }

    private static String escapeCsv(String value) {
        String safeValue = value == null ? "" : value;
        if (safeValue.contains(",") || safeValue.contains("\"") || safeValue.contains("\n")) {
            return "\"" + safeValue.replace("\"", "\"\"") + "\"";
        }
        return safeValue;
    }

    private static String formatInstant(Instant value) {
        if (value == null) {
            return "";
        }
        return CSV_DATE_FORMATTER.format(value.atOffset(ZoneOffset.UTC));
    }

    private static String formatCustomer(Customer customer) {
        List<String> parts = new ArrayList<>();
        if (customer.getFirstName() != null && !customer.getFirstName().isBlank()) {
            parts.add(customer.getFirstName().trim());
        }
        if (customer.getLastName() != null && !customer.getLastName().isBlank()) {
            parts.add(customer.getLastName().trim());
        }
        return String.join(" ", parts);
    }

    private static String formatAddress(Address address) {
        List<String> parts = new ArrayList<>();
        addIfPresent(parts, address.getStreet());
        addIfPresent(parts, address.getCity());
        addIfPresent(parts, address.getState());
        addIfPresent(parts, address.getZipCode());
        addIfPresent(parts, address.getCountry());
        return String.join(", ", parts);
    }

    private static String formatProducts(List<OrderLineSnapshot> orderLines) {
        if (orderLines == null || orderLines.isEmpty()) {
            return "";
        }
        return orderLines.stream()
                .map(line -> safe(line.productName()) + " x" + line.quantity())
                .collect(Collectors.joining("; "));
    }

    private static String formatAmount(BigDecimal amount) {
        return amount == null ? "" : amount.stripTrailingZeros().toPlainString();
    }

    private static String orderCurrency(Order order) {
        if (order.getOrderLines() != null) {
            for (OrderLineSnapshot line : order.getOrderLines()) {
                if (line.currency() != null && !line.currency().isBlank()) {
                    return line.currency();
                }
            }
        }
        return "MAD";
    }

    private static String statusLabel(OrderStatus status) {
        return switch (status) {
            case CREATED -> "New order";
            case CONFIRMATION_REQUESTED -> "Needs confirmation";
            case CONFIRMED -> "Ready for assignment";
            case REJECTED -> "Rejected";
            case ASSIGNED_TO_COURIER -> "Waiting pickup";
            case PICKED_UP -> "Out for delivery";
            case DELIVERED -> "Delivered";
            case FAILED -> "Recovery";
        };
    }

    private static String workflowStage(OrderStatus status) {
        return switch (status) {
            case CREATED, CONFIRMATION_REQUESTED -> "Confirmation";
            case CONFIRMED -> "Assignment";
            case ASSIGNED_TO_COURIER -> "Pickup";
            case PICKED_UP -> "Delivery";
            case FAILED -> "Recovery";
            case REJECTED, DELIVERED -> "Closed";
        };
    }

    private static String confirmationResult(OrderStatus status) {
        return switch (status) {
            case CREATED -> "Not started";
            case CONFIRMATION_REQUESTED -> "Requested";
            case REJECTED -> "Rejected";
            case CONFIRMED, ASSIGNED_TO_COURIER, PICKED_UP, DELIVERED, FAILED -> "Confirmed";
        };
    }

    private static String courierLabel(String courierId, Map<String, String> courierNamesById) {
        if (courierId == null || courierId.isBlank()) {
            return "";
        }
        return courierNamesById.getOrDefault(courierId, "Assigned courier");
    }

    private static String deliveryOutcome(OrderStatus status) {
        return switch (status) {
            case DELIVERED -> "Delivered";
            case FAILED -> "Failed";
            case PICKED_UP -> "Out for delivery";
            case ASSIGNED_TO_COURIER -> "Waiting pickup";
            default -> "";
        };
    }

    private static String failureReason(String reason) {
        if (reason == null || reason.isBlank()) {
            return "";
        }
        return switch (reason) {
            case "CUSTOMER_UNREACHABLE" -> "Customer unreachable";
            case "CUSTOMER_REFUSED" -> "Customer refused";
            case "INVALID_ADDRESS" -> "Invalid address";
            case "CUSTOMER_RESCHEDULED" -> "Customer rescheduled";
            case "LOST_PACKAGE" -> "Lost package";
            case "OTHER" -> "Other";
            default -> reason.replace('_', ' ').toLowerCase();
        };
    }

    private static String sourceLabel(OrderSource source) {
        if (source == null) {
            return "Manual";
        }
        return switch (source) {
            case MANUAL -> "Manual";
            case WASILIO_STOREFRONT -> "Storefront";
            case CUSTOM_API -> "Custom API";
            case CSV_IMPORT -> "CSV import";
            case YOUCAN -> "YouCan";
            case SHOPIFY -> "Shopify";
            case WOOCOMMERCE -> "WooCommerce";
            case WHATSAPP -> "WhatsApp";
            case FACEBOOK_LEAD_FORM -> "Facebook lead form";
        };
    }

    private static void addIfPresent(List<String> parts, String value) {
        if (value != null && !value.isBlank()) {
            parts.add(value.trim());
        }
    }

    private static String safe(String value) {
        return value == null ? "" : value;
    }
}
