package com.nexora.backend.application;

import com.nexora.backend.domain.model.Courier;
import com.nexora.backend.domain.repository.CourierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CourierService {

    private final CourierRepository courierRepository;
    private final Clock clock;

    @Transactional
    public Courier createCourier(UUID tenantId, String name, String phone) {
        return courierRepository.save(Courier.builder()
                .courierId(UUID.randomUUID())
                .tenantId(tenantId)
                .name(normalize(name))
                .phone(normalize(phone))
                .active(true)
                .createdAt(Instant.now(clock))
                .build());
    }

    @Transactional(readOnly = true)
    public Page<Courier> listCouriers(UUID tenantId, Pageable pageable) {
        return courierRepository.findByTenantId(tenantId, pageable);
    }

    @Transactional(readOnly = true)
    public Courier getCourier(UUID tenantId, UUID courierId) {
        return courierRepository.findByCourierIdAndTenantId(courierId, tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Courier not found"));
    }

    @Transactional
    public Courier updateCourier(UUID tenantId, UUID courierId, String name, String phone) {
        Courier courier = getCourier(tenantId, courierId);
        courier.setName(normalize(name));
        courier.setPhone(normalize(phone));
        return courier;
    }

    @Transactional
    public Courier setActive(UUID tenantId, UUID courierId, boolean active) {
        Courier courier = getCourier(tenantId, courierId);
        courier.setActive(active);
        return courier;
    }

    @Transactional(readOnly = true)
    public Courier requireActiveCourier(UUID tenantId, UUID courierId) {
        Courier courier = getCourier(tenantId, courierId);
        if (!courier.isActive()) {
            throw new IllegalStateException("Courier is inactive");
        }
        return courier;
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}
