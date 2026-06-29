package com.nexora.backend.infrastructure.persistence;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexora.backend.domain.model.OrderLineSnapshot;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.List;

@Converter
public class OrderLineSnapshotListConverter implements AttributeConverter<List<OrderLineSnapshot>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<List<OrderLineSnapshot>> TYPE_REFERENCE = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<OrderLineSnapshot> attribute) {
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute == null ? List.of() : attribute);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Order lines could not be serialized", ex);
        }
    }

    @Override
    public List<OrderLineSnapshot> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return List.of();
        }
        try {
            return OBJECT_MAPPER.readValue(dbData, TYPE_REFERENCE);
        } catch (JsonProcessingException ex) {
            throw new IllegalArgumentException("Order lines could not be deserialized", ex);
        }
    }
}
