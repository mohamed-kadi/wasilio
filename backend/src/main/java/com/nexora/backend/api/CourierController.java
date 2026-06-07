package com.nexora.backend.api;

import com.nexora.backend.application.CourierService;
import com.nexora.backend.domain.model.Courier;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/couriers")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class CourierController {

    private final CourierService courierService;

    public record CourierRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 50) String phone
    ) {}

    public record CourierActiveRequest(boolean active) {}

    public record CouriersPageResponse(
            List<Courier> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static CouriersPageResponse from(Page<Courier> couriers) {
            return new CouriersPageResponse(
                    couriers.getContent(),
                    couriers.getNumber(),
                    couriers.getSize(),
                    couriers.getTotalElements(),
                    couriers.getTotalPages()
            );
        }
    }

    @PostMapping
    public ResponseEntity<Courier> createCourier(@Valid @RequestBody CourierRequest request) {
        return ResponseEntity.ok(courierService.createCourier(getCurrentTenantId(), request.name(), request.phone()));
    }

    @GetMapping
    public ResponseEntity<CouriersPageResponse> listCouriers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(CouriersPageResponse.from(courierService.listCouriers(
                getCurrentTenantId(),
                pageRequest(page, size)
        )));
    }

    @GetMapping("/{courierId}")
    public ResponseEntity<Courier> getCourier(@PathVariable UUID courierId) {
        return ResponseEntity.ok(courierService.getCourier(getCurrentTenantId(), courierId));
    }

    @PutMapping("/{courierId}")
    public ResponseEntity<Courier> updateCourier(
            @PathVariable UUID courierId,
            @Valid @RequestBody CourierRequest request
    ) {
        return ResponseEntity.ok(courierService.updateCourier(getCurrentTenantId(), courierId, request.name(), request.phone()));
    }

    @PatchMapping("/{courierId}/active")
    public ResponseEntity<Courier> setCourierActive(
            @PathVariable UUID courierId,
            @RequestBody CourierActiveRequest request
    ) {
        return ResponseEntity.ok(courierService.setActive(getCurrentTenantId(), courierId, request.active()));
    }

    private PageRequest pageRequest(int page, int size) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be greater than or equal to 0");
        }
        if (size < 1 || size > 100) {
            throw new IllegalArgumentException("size must be between 1 and 100");
        }
        return PageRequest.of(
                page,
                size,
                Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.ASC, "courierId"))
        );
    }

    private UUID getCurrentTenantId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof CustomUserDetails userDetails)) {
            throw new IllegalStateException("Authenticated user missing in security context");
        }
        return UUID.fromString(userDetails.getTenantId());
    }
}
