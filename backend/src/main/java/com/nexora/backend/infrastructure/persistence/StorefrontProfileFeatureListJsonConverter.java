package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.nexora.backend.domain.model.StorefrontProfileFeature;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class StorefrontProfileFeatureListJsonConverter extends JsonListAttributeConverter<StorefrontProfileFeature> {
    private static final TypeReference<List<StorefrontProfileFeature>> TYPE_REFERENCE = new TypeReference<>() {};

    @Override
    protected TypeReference<List<StorefrontProfileFeature>> typeReference() {
        return TYPE_REFERENCE;
    }
}
