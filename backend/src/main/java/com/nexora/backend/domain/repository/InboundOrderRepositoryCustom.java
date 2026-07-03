package com.nexora.backend.domain.repository;

import com.nexora.backend.domain.model.InboundOrder;
import com.nexora.backend.domain.model.InboundOrderStatus;
import com.nexora.backend.domain.model.OrderSource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.UUID;

public interface InboundOrderRepositoryCustom {
    Page<InboundOrder> searchInboundOrders(
            UUID tenantId,
            OrderSource source,
            InboundOrderStatus status,
            String search,
            Pageable pageable
    );
}
