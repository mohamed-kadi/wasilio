package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;

import java.util.List;

abstract class JsonListAttributeConverter<T> implements AttributeConverter<List<T>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    protected abstract TypeReference<List<T>> typeReference();

    @Override
    public String convertToDatabaseColumn(List<T> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? List.of() : attribute);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("List value could not be serialized", ex);
        }
    }

    @Override
    public List<T> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            return OBJECT_MAPPER.readValue(dbData, typeReference());
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("List value could not be deserialized", ex);
        }
    }
}
