package com.nexora.backend.domain.event.payload;

import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import java.math.BigDecimal;
import java.util.List;

public record OrderCreatedEvent(
        Customer customer,
        Address address,
        BigDecimal amount,
        List<OrderLineSnapshot> orderLines,
        OrderSourceMetadata sourceMetadata
) {
    public OrderCreatedEvent {
        orderLines = orderLines == null ? List.of() : List.copyOf(orderLines);
    }

    public OrderCreatedEvent(Customer customer, Address address, BigDecimal amount) {
        this(customer, address, amount, List.of(), null);
    }

    public OrderCreatedEvent(Customer customer, Address address, BigDecimal amount, OrderSourceMetadata sourceMetadata) {
        this(customer, address, amount, List.of(), sourceMetadata);
    }
}
