package com.nexora.backend.infrastructure.notification;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "app.email")
public class EmailDeliveryProperties {
    private Mode mode = Mode.LOG;
    private String from = "Wasilio <no-reply@wasilio.local>";
    private String supportContact = "support@wasilio.local";

    public enum Mode {
        LOG,
        SMTP
    }
}
