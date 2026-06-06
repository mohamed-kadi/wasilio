package com.nexora.backend.application.projection;

import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class OrderProjectionRebuildRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(OrderProjectionRebuildRunner.class);

    private final OrderProjectionService orderProjectionService;

    @Value("${app.projections.rebuild-orders-on-startup:false}")
    private boolean rebuildOrdersOnStartup;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        if (!rebuildOrdersOnStartup) {
            return;
        }

        OrderProjectionService.ProjectionRebuildResult result = orderProjectionService.rebuildAll();
        log.warn(
                "Rebuilt {} projection from domain_events with {} events processed",
                result.projectionName(),
                result.eventsProcessed()
        );
    }
}
