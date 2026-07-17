import { expect, test, type Page } from '@playwright/test';
import { fakeJwt, installMockApi, loginAs } from './helpers';

const order = {
  id: '11111111-1111-1111-1111-111111111111',
  tenantId: '00000000-0000-0000-0000-000000000001',
  status: 'CONFIRMED',
  customer: {
    firstName: 'Sara',
    lastName: 'Customer',
    email: 'sara@example.com',
    phone: '+212600000001',
  },
  address: {
    street: 'Rue Test',
    city: 'Casablanca',
    state: 'Casablanca-Settat',
    zipCode: '20000',
    country: 'Morocco',
  },
  amount: 349,
  intelligence: {
    confirmationConfidenceScore: 100,
    fraudRiskScore: 0,
    level: 'HIGH_CONFIDENCE',
    summary: 'Strong confirmation signals',
    calculatedAt: '2026-06-21T10:05:00Z',
    signals: [
      {
        key: 'order_confirmed',
        label: 'Order confirmed',
        detail: 'Customer accepted the order during confirmation.',
        confidenceDelta: 35,
        riskDelta: -35,
        severity: 'POSITIVE',
        source: 'CONFIRMATION',
      },
    ],
    history: [
      {
        sequenceNumber: 2,
        previousConfirmationConfidenceScore: 73,
        previousFraudRiskScore: 34,
        previousLevel: 'NEEDS_ATTENTION',
        confirmationConfidenceScore: 100,
        fraudRiskScore: 0,
        level: 'HIGH_CONFIDENCE',
        confidenceDelta: 27,
        riskDelta: -34,
        changeLabel: 'Moved to High confidence',
        summary: 'Strong confirmation signals',
        reasonKey: 'order_confirmed',
        reasonLabel: 'Order confirmed',
        reasonDetail: 'Customer accepted the order during confirmation.',
        reasonSeverity: 'POSITIVE',
        reasonSource: 'CONFIRMATION',
        calibrationVersion: 'v1',
        calculatedAt: '2026-06-21T10:05:00Z',
      },
      {
        sequenceNumber: 1,
        previousConfirmationConfidenceScore: null,
        previousFraudRiskScore: null,
        previousLevel: null,
        confirmationConfidenceScore: 73,
        fraudRiskScore: 34,
        level: 'NEEDS_ATTENTION',
        confidenceDelta: 0,
        riskDelta: 0,
        changeLabel: 'Initial score',
        summary: 'Review confirmation signals before progressing',
        reasonKey: 'complete_address',
        reasonLabel: 'Address has delivery basics',
        reasonDetail: 'Street, city, and country are present.',
        reasonSeverity: 'POSITIVE',
        reasonSource: 'ORDER',
        calibrationVersion: 'v1',
        calculatedAt: '2026-06-21T10:00:00Z',
      },
    ],
  },
  createdAt: '2026-06-21T10:00:00Z',
  updatedAt: '2026-06-21T10:00:00Z',
  version: 1,
};

const courier = {
  courierId: '22222222-2222-2222-2222-222222222222',
  tenantId: order.tenantId,
  name: 'Amine Courier',
  phone: '+212600000002',
  active: true,
  createdAt: '2026-06-20T10:00:00Z',
};

const failedOrder = {
  ...order,
  status: 'FAILED',
  courierId: courier.courierId,
  failureReason: 'CUSTOMER_REFUSED',
  updatedAt: '2026-06-21T12:00:00Z',
};

const productLineOrder = {
  ...order,
  id: '33333333-3333-3333-3333-333333333333',
  status: 'CREATED',
  amount: 240,
  orderLines: [
    {
      productName: 'Original Product',
      sku: 'OLD-SKU',
      unitPrice: 120,
      quantity: 2,
      lineTotal: 240,
      currency: 'MAD',
    },
  ],
};

test('merchant can understand order journey stage and next action', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installMockApi(page);
  const token = fakeJwt({
    email: 'admin@example.com',
    role: 'MERCHANT',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  await page.goto('/login');
  await page.evaluate((sessionToken) => {
    window.sessionStorage.setItem(
      'nexora.auth.session',
      JSON.stringify({
        token: sessionToken,
        user: {
          email: 'admin@example.com',
          role: 'MERCHANT',
          tenantId: '00000000-0000-0000-0000-000000000001',
          expiresAt: Date.now() + 3_600_000,
        },
      }),
    );
  }, token);

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [order],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          courier,
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(order),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          itemId: '33333333-3333-3333-3333-333333333333',
          source: 'DOMAIN_EVENT',
          category: 'LIFECYCLE',
          type: 'OrderConfirmed',
          title: 'Order confirmed',
          timestamp: '2026-06-21T10:05:00Z',
          actor: 'admin@example.com',
          details: {},
        },
      ]),
    });
  });

  await page.goto('/app/orders');

  const workflowScan = page.getByLabel('Orders workflow scan');
  await expect(workflowScan).toBeVisible();
  await expect(workflowScan.getByText('Confirmation', { exact: true })).toBeVisible();
  await expect(workflowScan.getByText('Assignment', { exact: true })).toBeVisible();
  await expect(workflowScan.getByText('Pickup', { exact: true })).toBeVisible();
  await expect(workflowScan.getByText('Delivery', { exact: true })).toBeVisible();
  await expect(workflowScan.getByText('Recovery', { exact: true })).toBeVisible();
  await expect(workflowScan.getByText('Closed', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Assign Courier' })).toBeVisible();
  await expect(page.getByRole('table').getByText('Ready for assignment').first()).toBeVisible();
  await expect(page.getByRole('table').getByText('MAD 349.00')).toBeVisible();
  await expectNoHorizontalOverflow(page, 'orders-table-wrap');

  await page.goto('/app/orders/11111111-1111-1111-1111-111111111111');
  await expect(page).toHaveURL(/\/app\/orders\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByText('Current workflow stage', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assignment' })).toBeVisible();
  await expect(page.getByLabel('Order workflow stages').getByText('Assignment', { exact: true })).toBeVisible();
  await expect(page.getByText('The customer accepted the order')).toBeVisible();
  await expect(page.getByText('Stage action')).toBeVisible();
  await expect(page.getByText('Score history')).toBeVisible();
  await expect(page.getByText('Moved to High confidence')).toBeVisible();
  await expect(page.getByText('+27')).toBeVisible();
  await expect(page.getByText('-34')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign Courier' })).toBeDisabled();
  await expect(page.getByText('Total Amount')).toBeVisible();
  await expect(page.getByText('Product snapshot')).toHaveCount(0);
});

test('merchant records confirmation attempts and can clear a requested confirmation', async ({ page }) => {
  await installMockApi(page);
  const token = fakeJwt({
    email: 'admin@example.com',
    role: 'MERCHANT',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  let currentOrder = {
    ...order,
    status: 'CONFIRMATION_REQUESTED',
    intelligence: {
      ...order.intelligence,
      confirmationConfidenceScore: 41,
      fraudRiskScore: 67,
      level: 'HIGH_RISK',
      summary: 'Repeated contact issues require careful verification',
    },
  };
  const attempts: Array<Record<string, unknown>> = [];
  let clearRequests = 0;

  await page.goto('/login');
  await page.evaluate((sessionToken) => {
    window.sessionStorage.setItem(
      'nexora.auth.session',
      JSON.stringify({
        token: sessionToken,
        user: {
          email: 'admin@example.com',
          role: 'MERCHANT',
          tenantId: '00000000-0000-0000-0000-000000000001',
          expiresAt: Date.now() + 3_600_000,
        },
      }),
    );
  }, token);

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentOrder),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          itemId: 'timeline-confirmation-requested',
          source: 'DOMAIN_EVENT',
          category: 'CONFIRMATION',
          type: 'OrderConfirmationRequested',
          title: 'Order Confirmation Requested',
          timestamp: '2026-06-21T10:01:00Z',
          actor: null,
          details: {},
        },
      ]),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/confirmation-attempts', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      attempts.push(body);
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          attemptId: `attempt-${attempts.length}`,
          tenantId: order.tenantId,
          orderId: order.id,
          attemptNumber: attempts.length,
          outcome: body.outcome,
          note: body.note,
          createdBy: 'admin@example.com',
          createdAt: '2026-06-21T10:06:00Z',
          callbackAt: body.callbackAt,
          callbackResolvedAt: null,
          callbackResolvedBy: null,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(attempts.map((attempt, index) => ({
        attemptId: `attempt-${index + 1}`,
        tenantId: order.tenantId,
        orderId: order.id,
        attemptNumber: index + 1,
        outcome: attempt.outcome,
        note: attempt.note,
        createdBy: 'admin@example.com',
        createdAt: '2026-06-21T10:06:00Z',
        callbackAt: attempt.callbackAt,
        callbackResolvedAt: null,
        callbackResolvedBy: null,
      }))),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/clear-confirmation-request', async (route) => {
    clearRequests += 1;
    currentOrder = {
      ...currentOrder,
      status: 'CREATED',
      updatedAt: '2026-06-21T10:07:00Z',
      version: currentOrder.version + 1,
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '',
    });
  });

  await page.goto('/app/orders/11111111-1111-1111-1111-111111111111');

  await expect(page.getByText('Record customer confirmation')).toBeVisible();
  await expect(page.getByRole('button', { name: /No answer/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Call back later/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Wrong number/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Return to New order' })).toBeVisible();

  await page.getByRole('button', { name: /Wrong number/ }).click();
  await page.getByLabel('Call note').fill('Phone belongs to another customer.');
  await page.getByRole('button', { name: 'Save wrong number' }).click();

  await expect(page.getByText('Attempt #1')).toBeVisible();
  await expect(page.getByText('Phone belongs to another customer.')).toBeVisible();
  expect(attempts).toHaveLength(1);
  expect(attempts[0]).toMatchObject({
    outcome: 'WRONG_NUMBER',
    note: 'Phone belongs to another customer.',
  });

  await page.getByRole('button', { name: 'Return to New order' }).click();

  await expect(page.getByRole('heading', { name: 'Confirmation' })).toBeVisible();
  await expect(page.getByText('Status: New order')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Request Confirmation' })).toBeVisible();
  expect(clearRequests).toBe(1);
});

test('merchant sees captured product snapshots in order list and detail', async ({ page }) => {
  await installMockApi(page);

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [productLineOrder],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [],
        page: 0,
        size: 100,
        totalElements: 0,
        totalPages: 0,
      }),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/33333333-3333-3333-3333-333333333333', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(productLineOrder),
    });
  });

  await page.route('**/api/orders/33333333-3333-3333-3333-333333333333/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/33333333-3333-3333-3333-333333333333/confirmation-attempts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/products?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [
          {
            id: '55555555-5555-5555-5555-555555555555',
            tenantId: '00000000-0000-0000-0000-000000000001',
            name: 'Edited Product',
            slug: 'edited-product',
            description: null,
            priceAmount: 300,
            currency: 'MAD',
            sku: 'NEW-SKU',
            imageUrl: null,
            status: 'ACTIVE',
            createdAt: '2026-06-20T10:00:00Z',
            updatedAt: '2026-06-22T10:00:00Z',
          },
        ],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/orders');

  await expect(page.getByText('Original Product (2 items)')).toBeVisible();
  await expect(page.getByText('Edited Product')).toHaveCount(0);

  await page.goto('/app/orders/33333333-3333-3333-3333-333333333333');

  await expect(page.getByText('Product snapshot')).toBeVisible();
  await expect(page.getByRole('table').getByText('Original Product')).toBeVisible();
  await expect(page.getByRole('table').getByText('OLD-SKU')).toBeVisible();
  await expect(page.getByRole('cell', { name: '120.00' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '2', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: '240.00' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'MAD' })).toBeVisible();
  await expect(page.getByText('Edited Product')).toHaveCount(0);
  await expect(page.getByText('NEW-SKU')).toHaveCount(0);
});

test('merchant can review failed delivery recovery details', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installMockApi(page);
  let currentOrder = { ...failedOrder };
  const recoveryRecords: Array<Record<string, unknown>> = [];
  const recoveryRequests: Array<Record<string, unknown>> = [];
  const followUpRecords: Array<Record<string, unknown>> = [];
  const followUpResolveRequests: Array<Record<string, unknown>> = [];
  let retryRequests = 0;
  const token = fakeJwt({
    email: 'admin@example.com',
    role: 'MERCHANT',
    tenantId: '00000000-0000-0000-0000-000000000001',
  });
  await page.goto('/login');
  await page.evaluate((sessionToken) => {
    window.sessionStorage.setItem(
      'nexora.auth.session',
      JSON.stringify({
        token: sessionToken,
        user: {
          email: 'admin@example.com',
          role: 'MERCHANT',
          tenantId: '00000000-0000-0000-0000-000000000001',
          expiresAt: Date.now() + 3_600_000,
        },
      }),
    );
  }, token);

  await page.route('**/api/orders?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [currentOrder],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/couriers?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content: [courier],
        page: 0,
        size: 100,
        totalElements: 1,
        totalPages: 1,
      }),
    });
  });

  await page.route('**/api/orders/search-views', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(currentOrder),
    });
  });

  await page.route('**/api/orders/11111111-1111-1111-1111-111111111111/timeline', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          itemId: '44444444-4444-4444-4444-444444444444',
          source: 'DOMAIN_EVENT',
          category: 'DELIVERY',
          type: 'DeliveryFailed',
          title: 'Delivery failed',
          timestamp: '2026-06-21T12:00:00Z',
          actor: 'admin@example.com',
          details: {
            reason: 'CUSTOMER_REFUSED',
          },
        },
      ]),
    });
  });

  await page.route('**/api/courier-operations/orders/recovery-queue?**', async (route) => {
    const url = new URL(route.request().url());
    const state = url.searchParams.get('state') ?? 'ALL';
    const latestRecovery = recoveryRecords.length > 0 ? recoveryRecords[recoveryRecords.length - 1] : null;
    const openFollowUp = followUpRecords.find((record) => record.status === 'OPEN') ?? null;
    const latestFollowUp = followUpRecords.length > 0 ? followUpRecords[followUpRecords.length - 1] : null;
    const recoveryState = openFollowUp
      ? 'OPEN_FOLLOW_UP'
      : latestRecovery?.decision === 'RETRY_DELIVERY'
        ? 'RETRY_READY'
        : latestRecovery?.decision === 'CLOSE_UNRECOVERABLE'
          ? 'CLOSED_UNRECOVERABLE'
          : latestRecovery
            ? 'REFUND_REVIEW'
            : 'NEEDS_DECISION';
    const counts = {
      all: currentOrder.status === 'FAILED' ? 1 : 0,
      needsDecision: currentOrder.status === 'FAILED' && recoveryState === 'NEEDS_DECISION' ? 1 : 0,
      openFollowUp: currentOrder.status === 'FAILED' && recoveryState === 'OPEN_FOLLOW_UP' ? 1 : 0,
      retryReady: currentOrder.status === 'FAILED' && recoveryState === 'RETRY_READY' ? 1 : 0,
      refundReview: currentOrder.status === 'FAILED' && recoveryState === 'REFUND_REVIEW' ? 1 : 0,
      closedUnrecoverable: currentOrder.status === 'FAILED' && recoveryState === 'CLOSED_UNRECOVERABLE' ? 1 : 0,
    };
    const included = currentOrder.status === 'FAILED' && (state === 'ALL' || state === recoveryState);
    const content = included
      ? [{
          order: currentOrder,
          recovery: {
            orderId: currentOrder.id,
            latestRecovery,
            openFollowUp,
            latestFollowUp,
          },
        }]
      : [];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        content,
        page: 0,
        size: 20,
        totalElements: content.length,
        totalPages: content.length > 0 ? 1 : 0,
        counts,
      }),
    });
  });

  await page.route('**/api/courier-operations/orders/recovery-summaries?**', async (route) => {
    const url = new URL(route.request().url());
    const orderIds = url.searchParams.getAll('orderId');
    const latestRecovery = recoveryRecords.length > 0 ? recoveryRecords[recoveryRecords.length - 1] : null;
    const openFollowUp = followUpRecords.find((record) => record.status === 'OPEN') ?? null;
    const latestFollowUp = followUpRecords.length > 0 ? followUpRecords[followUpRecords.length - 1] : null;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(orderIds
        .filter((orderId) => orderId === failedOrder.id)
        .map((orderId) => ({
          orderId,
          latestRecovery,
          openFollowUp,
          latestFollowUp,
        }))),
    });
  });

  await page.route('**/api/courier-operations/orders/11111111-1111-1111-1111-111111111111/failure-recoveries', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      recoveryRequests.push(body);
      const recoveryId = `recovery-${recoveryRecords.length + 1}`;
      const recovery: Record<string, unknown> = {
        recoveryId,
        tenantId: failedOrder.tenantId,
        orderId: failedOrder.id,
        decision: body.decision,
        note: body.note,
        createdBy: 'admin@example.com',
        createdAt: '2026-06-21T12:30:00Z',
      };
      recoveryRecords.push(recovery);
      if (body.decision === 'REFUND_OR_CUSTOMER_FOLLOW_UP') {
        const followUpTask = {
          taskId: `follow-up-${followUpRecords.length + 1}`,
          tenantId: failedOrder.tenantId,
          orderId: failedOrder.id,
          recoveryId,
          status: 'OPEN',
          note: body.note,
          dueAt: body.followUpDueAt,
          assignedTo: 'admin@example.com',
          createdAt: '2026-06-21T12:30:00Z',
        };
        followUpRecords.push(followUpTask);
        recovery.followUpTask = followUpTask;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recovery),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(recoveryRecords),
    });
  });

  await page.route('**/api/courier-operations/orders/11111111-1111-1111-1111-111111111111/follow-ups', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(followUpRecords),
    });
  });

  await page.route('**/api/courier-operations/orders/11111111-1111-1111-1111-111111111111/follow-ups/*/resolve', async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    followUpResolveRequests.push(body);
    const taskId = route.request().url().split('/follow-ups/')[1].split('/resolve')[0];
    const task = followUpRecords.find((record) => record.taskId === taskId);
    if (task) {
      task.status = 'RESOLVED';
      task.resolvedBy = 'admin@example.com';
      task.resolvedAt = '2026-06-21T12:45:00Z';
      task.resolutionNote = body.note;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(task),
    });
  });

  await page.route('**/api/courier-operations/orders/11111111-1111-1111-1111-111111111111/retry-delivery', async (route) => {
    retryRequests += 1;
    currentOrder = {
      ...failedOrder,
      status: 'CONFIRMED',
      courierId: undefined,
      failureReason: undefined,
      updatedAt: '2026-06-21T12:35:00Z',
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '',
    });
  });

  await page.goto('/app/orders');
  const advancedFiltersToggle = page.getByRole('button', { name: 'Advanced filters' });
  const closedFiltersBox = await advancedFiltersToggle.boundingBox();
  expect(closedFiltersBox).not.toBeNull();
  await advancedFiltersToggle.click();
  const openFiltersBox = await advancedFiltersToggle.boundingBox();
  expect(openFiltersBox).not.toBeNull();
  expect(Math.round(openFiltersBox?.x ?? 0)).toBe(Math.round(closedFiltersBox?.x ?? 0));
  expect(Math.round(openFiltersBox?.width ?? 0)).toBe(Math.round(closedFiltersBox?.width ?? 0));
  await advancedFiltersToggle.click();

  await page.getByRole('button', { name: 'Review failed deliveries' }).click();

  await expect(page.getByText('Failed delivery recovery')).toBeVisible();
  await expect(page.getByRole('button', { name: /Needs decision \(1\)/ })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Failure reason' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Recovery status' })).toBeVisible();
  await expect(page.getByText('Customer refused')).toBeVisible();
  await expect(page.getByRole('table').getByText('Needs decision', { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page, 'orders-table-wrap');
  await page.getByRole('link', { name: 'Continue Recovery' }).click();

  await expect(page).toHaveURL(/\/app\/orders\/11111111-1111-1111-1111-111111111111$/);
  await expect(page.getByRole('heading', { name: 'Recovery', exact: true })).toBeVisible();
  await expect(page.getByText('Failure reason: Customer refused')).toBeVisible();
  await expect(page.getByText('Recovery work is handled in the failed delivery workspace below.')).toBeVisible();
  await expect(page.getByText('No recovery decision recorded')).toBeVisible();
  await expect(page.getByText('Record recovery decision').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Failed deliveries' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Courier performance' })).toBeVisible();
  await expect(page.getByText('Latest decision', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Next action', { exact: true }).first()).toBeVisible();

  await page.getByLabel('Recovery decision').selectOption('REFUND_OR_CUSTOMER_FOLLOW_UP');
  await page.getByLabel('Recovery note').fill('Customer wants a refund before another attempt');
  await page.getByLabel('Follow-up due date').fill('2026-06-22');
  await page.getByRole('button', { name: 'Create follow-up task' }).click();

  await expect(page.getByText('Refund / customer follow-up').last()).toBeVisible();
  await expect(page.getByText('Customer wants a refund before another attempt').first()).toBeVisible();
  await expect(page.getByText('Customer follow-ups')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve follow-up' })).toBeVisible();
  await expect(page.getByText('Resolve the open follow-up before creating another customer follow-up.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Resolve open follow-up first' })).toBeDisabled();
  await page.getByPlaceholder('Optional resolution note').fill('Refund request sent to merchant');
  await page.getByRole('button', { name: 'Resolve follow-up' }).click();
  await expect(page.getByText('Resolved follow-up')).toBeVisible();
  await expect(page.getByText('Refund request sent to merchant')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move back to assignment queue' })).toBeDisabled();

  await page.getByLabel('Recovery decision').selectOption('CLOSE_UNRECOVERABLE');
  await expect(page.getByText('A closure note is required')).toBeVisible();
  await page.getByRole('button', { name: 'Close as unreachable' }).click();
  await expect(page.getByText('Add a closure note before closing this failed recovery.')).toBeVisible();
  await page.getByLabel('Recovery note').fill('Customer unreachable after repeated attempts');
  await page.getByRole('button', { name: 'Close as unreachable' }).click();
  await expect(page.getByText('Close as unreachable / unrecoverable').last()).toBeVisible();
  await expect(page.getByText('Recovery closed').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move back to assignment queue' })).toBeDisabled();
  await page.getByRole('link', { name: 'Failed deliveries' }).click();
  await expect(page.getByRole('link', { name: 'View Details' })).toBeVisible();
  await expect(page.getByText('Customer unreachable after repeated attempts')).not.toBeVisible();
  await expect(page.getByRole('table').getByText('Closed', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'View Details' }).click();

  await page.getByLabel('Recovery decision').selectOption('RETRY_DELIVERY');
  await page.getByLabel('Recovery note').fill('Customer confirmed retry for tomorrow');
  await page.getByRole('button', { name: 'Record retry decision' }).click();

  await expect(page.getByText('Retry delivery').last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move back to assignment queue' })).toBeEnabled();
  await page.getByRole('button', { name: 'Move back to assignment queue' }).click();

  await expect(page.getByRole('heading', { name: 'Assignment' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign Courier' })).toBeVisible();
  await expect.poll(() => retryRequests).toBe(1);
  expect(recoveryRequests).toEqual([
    {
      decision: 'REFUND_OR_CUSTOMER_FOLLOW_UP',
      note: 'Customer wants a refund before another attempt',
      followUpDueAt: '2026-06-22T23:59:59Z',
    },
    {
      decision: 'CLOSE_UNRECOVERABLE',
      note: 'Customer unreachable after repeated attempts',
    },
    {
      decision: 'RETRY_DELIVERY',
      note: 'Customer confirmed retry for tomorrow',
    },
  ]);
  expect(followUpResolveRequests).toEqual([
    {
      note: 'Refund request sent to merchant',
    },
  ]);
});

async function expectNoHorizontalOverflow(page: Page, tableTestId: string) {
  const tableFits = await page
    .getByTestId(tableTestId)
    .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(tableFits).toBe(true);
  expect(pageFits).toBe(true);
}
