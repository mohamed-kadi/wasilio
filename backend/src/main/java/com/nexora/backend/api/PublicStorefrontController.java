package com.nexora.backend.api;

import com.nexora.backend.application.PublicOrderIntentRequest;
import com.nexora.backend.application.PublicOrderIntentResponse;
import com.nexora.backend.application.PublicStorefrontOrderService;
import com.nexora.backend.application.PublicStorefrontProductPageResponse;
import com.nexora.backend.application.PublicStorefrontProductPageService;
import com.nexora.backend.infrastructure.observability.CorrelationIdContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public/storefront")
@RequiredArgsConstructor
public class PublicStorefrontController {

    private final PublicStorefrontProductPageService productPageService;
    private final PublicStorefrontOrderService orderService;

    @GetMapping("/{storeSlug}/products/{productSlug}")
    public ResponseEntity<PublicStorefrontProductPageResponse> getProductPage(
            @PathVariable String storeSlug,
            @PathVariable String productSlug
    ) {
        return ResponseEntity.ok(productPageService.getProductPage(storeSlug, productSlug));
    }

    @PostMapping("/{storeSlug}/orders")
    public ResponseEntity<PublicOrderIntentResponse> submitOrderIntent(
            @PathVariable String storeSlug,
            @RequestHeader(value = CorrelationIdContext.HEADER_NAME, required = false) String correlationIdHeader,
            @RequestBody PublicOrderIntentRequest request
    ) {
        return ResponseEntity.accepted().body(orderService.submitOrderIntent(
                storeSlug,
                requestWithCorrelationId(request, correlationIdHeader)
        ));
    }

    private PublicOrderIntentRequest requestWithCorrelationId(
            PublicOrderIntentRequest request,
            String correlationIdHeader
    ) {
        if (request == null || !hasText(correlationIdHeader)) {
            return request;
        }

        return new PublicOrderIntentRequest(
                request.selection(),
                request.customer(),
                request.delivery(),
                request.idempotencyKey(),
                CorrelationIdContext.getRequiredString(),
                request.attribution()
        );
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
