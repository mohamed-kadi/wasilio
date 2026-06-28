package com.nexora.backend.api;

import com.nexora.backend.application.ProductService;
import com.nexora.backend.domain.model.Product;
import com.nexora.backend.domain.model.ProductStatus;
import com.nexora.backend.infrastructure.security.CustomUserDetails;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/products")
@PreAuthorize("hasAnyRole('ADMIN','MERCHANT')")
@RequiredArgsConstructor
public class ProductController {

    private final ProductService productService;

    public record ProductRequest(
            @NotBlank @Size(max = 255) String name,
            @Size(max = 160) String slug,
            @Size(max = 2000) String description,
            @NotNull @Positive BigDecimal priceAmount,
            @Size(min = 3, max = 3) String currency,
            @Size(max = 100) String sku,
            @Size(max = 1000) String imageUrl,
            ProductStatus status
    ) {
        ProductService.ProductCommand toCommand() {
            return new ProductService.ProductCommand(
                    name,
                    slug,
                    description,
                    priceAmount,
                    currency,
                    sku,
                    imageUrl,
                    status
            );
        }
    }

    public record ProductsPageResponse(
            List<Product> content,
            int page,
            int size,
            long totalElements,
            int totalPages
    ) {
        static ProductsPageResponse from(Page<Product> products) {
            return new ProductsPageResponse(
                    products.getContent(),
                    products.getNumber(),
                    products.getSize(),
                    products.getTotalElements(),
                    products.getTotalPages()
            );
        }
    }

    @PostMapping
    public ResponseEntity<Product> createProduct(@Valid @RequestBody ProductRequest request) {
        return ResponseEntity.ok(productService.createProduct(getCurrentTenantId(), request.toCommand()));
    }

    @GetMapping
    public ResponseEntity<ProductsPageResponse> listProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(ProductsPageResponse.from(productService.listProducts(
                getCurrentTenantId(),
                pageRequest(page, size)
        )));
    }

    @GetMapping("/{productId}")
    public ResponseEntity<Product> getProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(productService.getProduct(getCurrentTenantId(), productId));
    }

    @PutMapping("/{productId}")
    public ResponseEntity<Product> updateProduct(
            @PathVariable UUID productId,
            @Valid @RequestBody ProductRequest request
    ) {
        return ResponseEntity.ok(productService.updateProduct(getCurrentTenantId(), productId, request.toCommand()));
    }

    @PatchMapping("/{productId}/archive")
    public ResponseEntity<Product> archiveProduct(@PathVariable UUID productId) {
        return ResponseEntity.ok(productService.archiveProduct(getCurrentTenantId(), productId));
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
                Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.ASC, "name"))
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
