import { expect, test, type Page } from '@playwright/test';
import { installMockApi, loginAs } from './helpers';

test('merchant can review intelligence report', async ({ page }) => {
  await installMockApi(page);

  await page.route('**/api/intelligence/report', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        generatedAt: '2026-07-09T16:00:00Z',
        scoredOrders: 12,
        averageConfirmationConfidence: 72,
        averageFraudRisk: 41,
        highConfidenceCount: 5,
        needsAttentionCount: 4,
        highRiskCount: 3,
        movementSummary: {
          improvedCount: 6,
          riskIncreasedCount: 4,
          levelChangedCount: 2,
        },
        topSignals: [
          {
            key: 'repeated_no_answer',
            label: 'Repeated no-answer attempts',
            detail: 'Three or more confirmation calls were not answered.',
            severity: 'CRITICAL',
            source: 'CONFIRMATION',
            count: 3,
            totalConfidenceDelta: -60,
            totalRiskDelta: 60,
          },
        ],
        recentMovements: [
          {
            orderId: '11111111-1111-1111-1111-111111111111',
            sequenceNumber: 2,
            previousConfirmationConfidenceScore: 63,
            previousFraudRiskScore: 44,
            previousLevel: 'NEEDS_ATTENTION',
            confirmationConfidenceScore: 38,
            fraudRiskScore: 69,
            level: 'HIGH_RISK',
            confidenceDelta: -25,
            riskDelta: 25,
            changeLabel: 'Moved to High risk',
            summary: 'High risk: Second no-answer attempt',
            reasonKey: 'second_no_answer',
            reasonLabel: 'Second no-answer attempt',
            reasonSeverity: 'WARNING',
            reasonSource: 'CONFIRMATION',
            calibrationVersion: 'v1',
            calculatedAt: '2026-07-09T15:55:00Z',
          },
        ],
        highRiskOrders: [
          {
            orderId: '11111111-1111-1111-1111-111111111111',
            customerName: 'Sara Customer',
            customerPhone: '+212600000001',
            amount: 349,
            confirmationConfidenceScore: 38,
            fraudRiskScore: 69,
            level: 'HIGH_RISK',
            summary: 'High risk: Second no-answer attempt',
            calculatedAt: '2026-07-09T15:55:00Z',
          },
        ],
        calibration: {
          version: 'v1',
          baseConfirmationConfidence: 60,
          baseFraudRisk: 40,
          highConfidenceMinimumConfidence: 75,
          highConfidenceMaximumRisk: 35,
          highRiskMinimumRisk: 65,
          confirmedMinimumConfidence: 95,
          confirmedMaximumRisk: 5,
          deliveredMinimumConfidence: 98,
          deliveredMaximumRisk: 3,
          minimumPhoneDigits: 9,
          maximumPhoneDigits: 15,
        },
      }),
    });
  });

  await loginAs(page, 'admin@example.com');
  await page.goto('/app/intelligence');

  await expect(page.getByRole('heading', { name: 'Intelligence Report' })).toBeVisible();
  await expect(page.getByText('Scored orders', { exact: true })).toBeVisible();
  await expect(page.getByText('12', { exact: true })).toBeVisible();
  await expect(page.getByTestId('average-confirmation-score')).toContainText('72');
  await expect(page.getByTestId('average-confirmation-score')).not.toContainText('72/100');
  await expectScoreRangeOnOneLine(page, 'average-confirmation-score');
  await expect(page.getByText('7 orders need review')).toBeVisible();
  await expect(page.getByText('Needs review now')).toBeVisible();
  await expect(page.getByText('Sara Customer')).toBeVisible();
  await expect(page.getByText('Repeated no-answer attempts')).toBeVisible();
  await expect(page.getByText('Raises risk and lowers confirmation confidence')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moved to High risk' })).toBeVisible();
  await page.getByText('Show audit points').click();
  await expect(page.getByText('-60 confidence / +60 risk')).toBeVisible();
  await expect(page.getByText('Scoring model details')).toBeVisible();
  await expect(page.getByText('Version v1')).toBeVisible();
  await page.getByText('Scoring model details').click();
  await expect(page.getByText('65+ risk')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

async function expectNoHorizontalOverflow(page: Page) {
  const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  expect(pageFits).toBe(true);
}

async function expectScoreRangeOnOneLine(page: Page, testId: string) {
  const rangeHeight = await page
    .getByTestId(testId)
    .getByText('0-100')
    .evaluate((element) => element.getBoundingClientRect().height);
  expect(rangeHeight).toBeLessThanOrEqual(28);
}
