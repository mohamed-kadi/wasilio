package com.nexora.backend.domain.event.payload;

import com.nexora.backend.domain.model.Address;
import com.nexora.backend.domain.model.Customer;
import java.math.BigDecimal;

public record OrderCreatedEvent(
        Customer customer,
        Address address,
        BigDecimal amount,
        OrderSourceMetadata sourceMetadata
) {
    public OrderCreatedEvent(Customer customer, Address address, BigDecimal amount) {
        this(customer, address, amount, null);
    }
}
