package com.nexora.backend.application;

import com.nexora.backend.domain.model.PublicStorefront;
import com.nexora.backend.domain.model.PublicStorefrontStatus;
import com.nexora.backend.domain.repository.PublicStorefrontRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

@Service
@RequiredArgsConstructor
public class PublicStorefrontManagementService {

    private static final int MAX_STORE_SLUG_LENGTH = 160;
    private static final int MAX_PUBLIC_NAME_LENGTH = 255;
    private static final int MAX_SUPPORT_CHANNEL_TYPE_LENGTH = 50;
    private static final int MAX_SUPPORT_CHANNEL_VALUE_LENGTH = 255;
    private static final int MAX_PHONE_PATTERN_LENGTH = 255;

    private final PublicStorefrontRepository publicStorefrontRepository;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Optional<PublicStorefrontSettingsResponse> getSettings(UUID tenantId) {
        requireTenantId(tenantId);
        return publicStorefrontRepository.findFirstByTenantIdOrderByCreatedAtAsc(tenantId)
                .map(PublicStorefrontSettingsResponse::from);
    }

    @Transactional
    public PublicStorefrontSettingsResponse upsertSettings(UUID tenantId, PublicStorefrontSettingsCommand command) {
        requireTenantId(tenantId);
        if (command == null) {
            throw new IllegalArgumentException("Storefront settings are required");
        }

        PublicStorefront existing = publicStorefrontRepository.findFirstByTenantIdOrderByCreatedAtAsc(tenantId)
                .orElse(null);
        String storeSlug = normalizeSlug(command.storeSlug());
        ensureStoreSlugAvailable(storeSlug, existing == null ? null : existing.getId());

        Instant now = Instant.now(clock);
        PublicStorefront storefront = existing == null
                ? PublicStorefront.builder()
                        .id(UUID.randomUUID())
                        .tenantId(tenantId)
                        .createdAt(now)
                        .build()
                : existing;

        storefront.setStoreSlug(storeSlug);
        storefront.setPublicName(normalizeRequired(command.publicName(), "publicName", MAX_PUBLIC_NAME_LENGTH));
        storefront.setStatus(command.status() == null ? PublicStorefrontStatus.DISABLED : command.status());
        storefront.setSupportChannelType(normalizeOptional(
                command.supportChannelType(),
                "supportChannelType",
                MAX_SUPPORT_CHANNEL_TYPE_LENGTH
        ));
        storefront.setSupportChannelValue(normalizeOptional(
                command.supportChannelValue(),
                "supportChannelValue",
                MAX_SUPPORT_CHANNEL_VALUE_LENGTH
        ));
        storefront.setDefaultCountryCode(normalizeFixedLengthCode(command.defaultCountryCode(), "defaultCountryCode", 2));
        storefront.setDefaultCurrency(normalizeFixedLengthCode(command.defaultCurrency(), "defaultCurrency", 3));
        storefront.setPhonePattern(normalizePhonePattern(command.phonePattern()));
        storefront.setUpdatedAt(now);

        return PublicStorefrontSettingsResponse.from(publicStorefrontRepository.save(storefront));
    }

    private void ensureStoreSlugAvailable(String storeSlug, UUID currentStorefrontId) {
        publicStorefrontRepository.findByStoreSlug(storeSlug)
                .filter(candidate -> currentStorefrontId == null || !candidate.getId().equals(currentStorefrontId))
                .ifPresent(candidate -> {
                    throw new ResourceConflictException("Storefront slug already exists");
                });
    }

    private String normalizeSlug(String storeSlug) {
        String rawSlug = normalizeRequired(storeSlug, "storeSlug", MAX_STORE_SLUG_LENGTH);
        String normalized = Normalizer.normalize(rawSlug, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-|-$)", "");

        if (!hasText(normalized)) {
            throw new IllegalArgumentException("storeSlug could not be generated");
        }
        if (normalized.length() > MAX_STORE_SLUG_LENGTH) {
            return normalized.substring(0, MAX_STORE_SLUG_LENGTH).replaceAll("-+$", "");
        }
        return normalized;
    }

    private String normalizeRequired(String value, String field, int maxLength) {
        if (!hasText(value)) {
            throw new IllegalArgumentException(field + " is required");
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private String normalizeOptional(String value, String field, int maxLength) {
        if (!hasText(value)) {
            return null;
        }
        String normalized = value.trim();
        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(field + " must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private String normalizeFixedLengthCode(String value, String field, int length) {
        String normalized = normalizeRequired(value, field, length).toUpperCase(Locale.ROOT);
        if (normalized.length() != length) {
            throw new IllegalArgumentException(field + " must be " + length + " characters");
        }
        return normalized;
    }

    private String normalizePhonePattern(String phonePattern) {
        String normalized = normalizeRequired(phonePattern, "phonePattern", MAX_PHONE_PATTERN_LENGTH);
        try {
            Pattern.compile(normalized);
        } catch (PatternSyntaxException ex) {
            throw new IllegalArgumentException("phonePattern must be a valid regular expression");
        }
        return normalized;
    }

    private void requireTenantId(UUID tenantId) {
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
