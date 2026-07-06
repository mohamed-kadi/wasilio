package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class StringListJsonConverter extends JsonListAttributeConverter<String> {
    private static final TypeReference<List<String>> TYPE_REFERENCE = new TypeReference<>() {};

    @Override
    protected TypeReference<List<String>> typeReference() {
        return TYPE_REFERENCE;
    }
}
