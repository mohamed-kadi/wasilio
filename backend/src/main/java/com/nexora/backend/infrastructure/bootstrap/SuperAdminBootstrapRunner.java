package com.nexora.backend.infrastructure.bootstrap;

import com.nexora.backend.application.SuperAdminBootstrapService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SuperAdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrapRunner.class);

    private final SuperAdminBootstrapService bootstrapService;

    @Value("${app.super-admin.bootstrap.enabled:false}")
    private boolean enabled;

    @Value("${app.super-admin.bootstrap.email:}")
    private String email;

    @Value("${app.super-admin.bootstrap.password:}")
    private String password;

    @Value("${app.super-admin.bootstrap.tenant-name:Nexora Internal}")
    private String tenantName;

    @Override
    public void run(ApplicationArguments args) {
        if (!enabled) {
            return;
        }

        SuperAdminBootstrapService.BootstrapResult result = bootstrapService.bootstrap(email, password, tenantName);
        if (result.created()) {
            log.warn("Super-admin bootstrap created initial SUPER_ADMIN user email={} tenantId={}", result.email(), result.tenantId());
        } else {
            log.info("Super-admin bootstrap skipped because a SUPER_ADMIN user already exists");
        }
    }
}
