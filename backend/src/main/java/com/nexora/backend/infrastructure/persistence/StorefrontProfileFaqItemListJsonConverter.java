package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import com.nexora.backend.domain.model.StorefrontProfileFaqItem;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class StorefrontProfileFaqItemListJsonConverter extends JsonListAttributeConverter<StorefrontProfileFaqItem> {
    private static final TypeReference<List<StorefrontProfileFaqItem>> TYPE_REFERENCE = new TypeReference<>() {};

    @Override
    protected TypeReference<List<StorefrontProfileFaqItem>> typeReference() {
        return TYPE_REFERENCE;
    }
}
