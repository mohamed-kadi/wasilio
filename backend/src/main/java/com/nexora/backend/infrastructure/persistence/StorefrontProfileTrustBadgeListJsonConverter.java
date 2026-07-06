package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.nexora.backend.domain.model.StorefrontProfileTrustBadge;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class StorefrontProfileTrustBadgeListJsonConverter extends JsonListAttributeConverter<StorefrontProfileTrustBadge> {
    private static final TypeReference<List<StorefrontProfileTrustBadge>> TYPE_REFERENCE = new TypeReference<>() {};

    @Override
    protected TypeReference<List<StorefrontProfileTrustBadge>> typeReference() {
        return TYPE_REFERENCE;
    }
}
