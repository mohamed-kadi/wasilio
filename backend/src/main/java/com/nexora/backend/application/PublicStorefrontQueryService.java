package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PublicStorefrontQueryService {

    private final PublicStorefrontRepository publicStorefrontRepository;

    @Transactional(readOnly = true)
    public PublicStorefrontContext resolveStorefront(String storeSlug) {
        return resolveStorefrontForApplication(storeSlug).toPublicContext();
    }

    ResolvedPublicStorefrontContext resolveStorefrontForApplication(String storeSlug) {
        String normalizedSlug = normalizeStoreSlug(storeSlug);
        PublicStorefront storefront = publicStorefrontRepository.findByStoreSlug(normalizedSlug)
                .filter(candidate -> candidate.getStatus() == PublicStorefrontStatus.ACTIVE)
                .orElseThrow(() -> new IllegalArgumentException("Public storefront not found"));

        return ResolvedPublicStorefrontContext.from(storefront);
    }

    private String normalizeStoreSlug(String storeSlug) {
        if (storeSlug == null || storeSlug.trim().isEmpty()) {
            throw new IllegalArgumentException("Public storefront not found");
        }
        return storeSlug.trim().toLowerCase(Locale.ROOT);
    }
}
