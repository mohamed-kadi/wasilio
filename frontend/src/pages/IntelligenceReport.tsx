import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Gauge,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { fetchIntelligenceReport, getErrorMessage } from '../api/client';
import type {
  IntelligenceMovement,
  IntelligenceReport as IntelligenceReportData,
  IntelligenceTopSignal,
  IntelligenceWatchlistOrder,
  OrderIntelligenceLevel,
  OrderIntelligenceSignalSeverity,
  OrderIntelligenceSignalSource,
} from '../api/client';

const levelLabels: Record<OrderIntelligenceLevel, string> = {
  HIGH_CONFIDENCE: 'High confidence',
  NEEDS_ATTENTION: 'Needs attention',
  HIGH_RISK: 'High risk',
};

const levelTones: Record<OrderIntelligenceLevel, string> = {
  HIGH_CONFIDENCE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  NEEDS_ATTENTION: 'border-amber-200 bg-amber-50 text-amber-800',
  HIGH_RISK: 'border-red-200 bg-red-50 text-red-800',
};

const severityTones: Record<OrderIntelligenceSignalSeverity, string> = {
  POSITIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  INFO: 'border-blue-200 bg-blue-50 text-blue-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
};

const sourceLabels: Record<OrderIntelligenceSignalSource, string> = {
  ORDER: 'Order',
  CONFIRMATION: 'Confirmation',
  CALLBACK: 'Callback',
  DELIVERY: 'Delivery',
  HISTORY: 'History',
};

export default function IntelligenceReport() {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['intelligence-report'],
    queryFn: fetchIntelligenceReport,
  });

  if (isLoading) {
    return <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">Loading intelligence report...</div>;
  }

  if (error || !report) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ? getErrorMessage(error) : 'Unable to load intelligence report.'}
      </div>
    );
  }

  const reviewCount = report.needsAttentionCount + report.highRiskCount;
  const highRiskDetail = `${report.highRiskCount.toLocaleString()} high risk / ${report.needsAttentionCount.toLocaleString()} needs attention`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-blue-700">Operations intelligence</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Intelligence Report</h1>
          <p className="mt-1 text-sm text-gray-600">Generated {formatDateTime(report.generatedAt)}</p>
        </div>
        <Link
          to="/app/confirmations"
          className="inline-flex min-h-10 items-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          Confirmation queue
        </Link>
      </header>

      <section className="rounded-lg border border-blue-100 bg-white p-5 shadow-sm">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.8fr)]">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-700">Decision focus</p>
            <h2 className="mt-2 text-2xl font-bold text-gray-900">
              {reviewCount > 0 ? `${reviewCount.toLocaleString()} orders need review` : 'No orders need review'}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
              Use confidence and fraud-risk signals to decide which orders need careful confirmation. Intelligence is decision support only; it does not move the order lifecycle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <ScoreGauge
              testId="average-confirmation-score"
              label="Confirmation confidence"
              value={report.averageConfirmationConfidence}
              caption="Higher means easier to confirm"
              tone={report.averageConfirmationConfidence >= report.calibration.highConfidenceMinimumConfidence ? 'emerald' : 'amber'}
            />
            <ScoreGauge
              testId="average-risk-score"
              label="Fraud risk"
              value={report.averageFraudRisk}
              caption="Lower means less risk"
              tone={report.averageFraudRisk >= report.calibration.highRiskMinimumRisk ? 'red' : 'amber'}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={<Gauge size={18} />}
          label="Scored orders"
          value={report.scoredOrders.toLocaleString()}
          detail="Current scored orders"
          tone="blue"
        />
        <KpiTile
          icon={<ShieldAlert size={18} />}
          label="Needs review"
          value={reviewCount.toLocaleString()}
          detail={highRiskDetail}
          tone={reviewCount > 0 ? 'red' : 'emerald'}
        />
        <KpiTile
          icon={<ArrowUpRight size={18} />}
          label="Improved scores"
          value={report.movementSummary.improvedCount.toLocaleString()}
          detail="Recent positive movement"
          tone="emerald"
        />
        <KpiTile
          icon={<ArrowDownRight size={18} />}
          label="Risk increased"
          value={report.movementSummary.riskIncreasedCount.toLocaleString()}
          detail={`${report.movementSummary.levelChangedCount.toLocaleString()} level changes`}
          tone={report.movementSummary.riskIncreasedCount > 0 ? 'amber' : 'emerald'}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <NeedsReviewPanel orders={report.highRiskOrders} />
        <div className="space-y-6">
          <ScoreDistribution report={report} />
          <TopSignalsPanel signals={report.topSignals} />
        </div>
      </div>

      <RecentMovementPanel movements={report.recentMovements} />

      <details className="rounded-lg border border-gray-200 bg-white p-5">
        <summary className="cursor-pointer list-none">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
                <SlidersHorizontal size={19} />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Scoring model details</h2>
                <p className="mt-1 text-sm text-gray-600">Version {report.calibration.version}; audit reference only, not an automatic lifecycle rule.</p>
              </div>
            </div>
            <span className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500">
              Advanced
            </span>
          </div>
        </summary>
        <CalibrationGrid report={report} />
      </details>
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'emerald' | 'amber' | 'red';
}) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  }[tone];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          <p className="mt-1 text-sm text-gray-600">{detail}</p>
        </div>
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-md ${toneClasses}`}>{icon}</div>
      </div>
    </div>
  );
}

function ScoreGauge({
  label,
  value,
  caption,
  tone,
  testId,
}: {
  label: string;
  value: number;
  caption: string;
  tone: 'blue' | 'emerald' | 'amber' | 'red';
  testId?: string;
}) {
  const clamped = clampScore(value);
  const fill = {
    blue: 'bg-blue-600',
    emerald: 'bg-emerald-600',
    amber: 'bg-amber-500',
    red: 'bg-red-600',
  }[tone];
  const surface = {
    blue: 'border-blue-100 bg-blue-50',
    emerald: 'border-emerald-100 bg-emerald-50',
    amber: 'border-amber-100 bg-amber-50',
    red: 'border-red-100 bg-red-50',
  }[tone];

  return (
    <div data-testid={testId} className={`rounded-md border p-4 ${surface}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-gray-600">{label}</p>
          <p className="mt-2 flex items-end gap-1 text-gray-900">
            <span className="text-3xl font-bold leading-none">{value}</span>
            <span className="pb-0.5 text-xs font-semibold uppercase text-gray-500">score</span>
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap rounded-full bg-white/80 px-2.5 py-1 text-center text-xs font-semibold tabular-nums text-gray-600">
          0-100
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-2 text-xs font-medium text-gray-600">{caption}</p>
      <span className="sr-only">{label}: {value} out of 100</span>
    </div>
  );
}

function NeedsReviewPanel({ orders }: { orders: IntelligenceWatchlistOrder[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Needs review now</h2>
          <p className="mt-1 text-sm text-gray-600">High-risk orders that should be handled carefully in confirmation.</p>
        </div>
        <Link
          to="/app/confirmations"
          className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          Open confirmation
          <ArrowRight size={16} />
        </Link>
      </div>

      {orders.length === 0 ? (
        <div className="mt-5">
          <EmptyState text="No high-risk orders are currently scored." />
        </div>
      ) : (
        <div className="mt-5 divide-y divide-gray-100">
          {orders.map((order) => (
            <article key={order.orderId} className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Link to={`/app/orders/${order.orderId}`} className="font-mono text-sm font-semibold text-blue-700 hover:underline">
                    {shortId(order.orderId)}
                  </Link>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTones[order.level]}`}>
                    {levelLabels[order.level]}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-gray-900">{order.customerName}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {order.customerPhone} - {formatMoney(order.amount)}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-gray-700">{order.summary}</p>
              </div>
              <div className="grid min-w-[190px] grid-cols-2 gap-2 self-center">
                <ScoreChip label="Confidence" value={order.confirmationConfidenceScore} tone="amber" />
                <ScoreChip label="Risk" value={order.fraudRiskScore} tone="red" />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ScoreDistribution({ report }: { report: IntelligenceReportData }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
          <BarChart3 size={19} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Score mix</h2>
          <p className="mt-1 text-sm text-gray-600">Current scored orders by operating band.</p>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        <LevelRow
          label="High confidence"
          count={report.highConfidenceCount}
          total={report.scoredOrders}
          tone="emerald"
          detail="Normal confirmation flow"
        />
        <LevelRow
          label="Needs attention"
          count={report.needsAttentionCount}
          total={report.scoredOrders}
          tone="amber"
          detail="Review reason before calling"
        />
        <LevelRow
          label="High risk"
          count={report.highRiskCount}
          total={report.scoredOrders}
          tone="red"
          detail="Prioritize careful review"
        />
      </div>
    </section>
  );
}

function LevelRow({
  label,
  count,
  total,
  tone,
  detail,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'emerald' | 'amber' | 'red';
  detail: string;
}) {
  const percent = total === 0 ? 0 : Math.round((count / total) * 100);
  const fill = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }[tone];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="font-semibold text-gray-800">{label}</span>
          <span className="ml-2 text-xs text-gray-500">{detail}</span>
        </span>
        <span className="font-semibold text-gray-900">{count.toLocaleString()}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{percent}% of scored orders</p>
    </div>
  );
}

function TopSignalsPanel({ signals }: { signals: IntelligenceTopSignal[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-base font-semibold text-gray-900">Why scores are changing</h2>
      <p className="mt-1 text-sm text-gray-600">Most common business reasons across scored orders.</p>

      {signals.length === 0 ? (
        <div className="mt-4">
          <EmptyState text="No score reasons have been recorded yet." />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {signals.map((signal) => (
            <SignalCard key={signal.key} signal={signal} />
          ))}
        </div>
      )}
    </section>
  );
}

function SignalCard({ signal }: { signal: IntelligenceTopSignal }) {
  return (
    <article className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-gray-900">{signal.label}</h3>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityTones[signal.severity]}`}>
              {signal.severity.toLowerCase()}
            </span>
          </div>
          {signal.detail && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{signal.detail}</p>}
        </div>
        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-gray-700">
          {signal.count.toLocaleString()} orders
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-gray-700">{signalImpactLabel(signal)}</p>
      <p className="mt-1 text-xs text-gray-500">Source: {sourceLabels[signal.source]}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-gray-500">Show audit points</summary>
        <p className="mt-2 text-xs text-gray-600">
          {formatDelta(signal.totalConfidenceDelta)} confidence / {formatDelta(signal.totalRiskDelta)} risk
        </p>
      </details>
    </article>
  );
}

function RecentMovementPanel({ movements }: { movements: IntelligenceMovement[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
          <Activity size={19} />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Recent score movement</h2>
          <p className="mt-1 text-sm text-gray-600">Latest recalculations from the audit history.</p>
        </div>
      </div>

      {movements.length === 0 ? (
        <div className="mt-4">
          <EmptyState text="No score movement has been recorded yet." />
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {movements.map((movement) => (
            <MovementCard key={`${movement.orderId}-${movement.sequenceNumber}`} movement={movement} />
          ))}
        </div>
      )}
    </section>
  );
}

function MovementCard({ movement }: { movement: IntelligenceMovement }) {
  return (
    <article className="rounded-md border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={`/app/orders/${movement.orderId}`} className="font-semibold text-blue-700 hover:underline">
            {movement.changeLabel}
          </Link>
          <p className="mt-1 font-mono text-xs text-gray-500">{shortId(movement.orderId)}</p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTones[movement.level]}`}>
          {levelLabels[movement.level]}
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-gray-700">{movement.reasonLabel ?? movement.summary}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ScoreChip label="Confidence" value={movement.confirmationConfidenceScore} tone={movement.confirmationConfidenceScore >= 75 ? 'emerald' : 'amber'} />
        <ScoreChip label="Risk" value={movement.fraudRiskScore} tone={movement.fraudRiskScore >= 65 ? 'red' : 'amber'} />
      </div>
      <p className="mt-3 text-xs text-gray-500">{formatDateTime(movement.calculatedAt)}</p>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold uppercase text-gray-500">Show movement audit</summary>
        <p className="mt-2 text-xs text-gray-600">
          Confidence {formatDelta(movement.confidenceDelta)} / risk {formatDelta(movement.riskDelta)}
        </p>
      </details>
    </article>
  );
}

function ScoreChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'red';
}) {
  const toneClasses = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-800',
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClasses}`}>
      <p className="text-[11px] font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 flex items-end gap-1">
        <span className="text-xl font-bold leading-none">{value}</span>
        <span className="text-[10px] font-semibold uppercase opacity-80">score</span>
      </p>
    </div>
  );
}

function CalibrationGrid({ report }: { report: IntelligenceReportData }) {
  const calibration = report.calibration;
  const items = [
    ['Base confidence', calibration.baseConfirmationConfidence],
    ['Base risk', calibration.baseFraudRisk],
    ['High confidence', `${calibration.highConfidenceMinimumConfidence}+ confidence / risk ${calibration.highConfidenceMaximumRisk} or less`],
    ['High risk', `${calibration.highRiskMinimumRisk}+ risk`],
    ['Confirmed cap', `${calibration.confirmedMinimumConfidence}+ confidence / risk ${calibration.confirmedMaximumRisk} or less`],
    ['Delivered cap', `${calibration.deliveredMinimumConfidence}+ confidence / risk ${calibration.deliveredMaximumRisk} or less`],
    ['Phone length', `${calibration.minimumPhoneDigits}-${calibration.maximumPhoneDigits} digits`],
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">{text}</div>;
}

function signalImpactLabel(signal: IntelligenceTopSignal) {
  if (signal.totalRiskDelta > 0 && signal.totalConfidenceDelta < 0) {
    return 'Raises risk and lowers confirmation confidence';
  }
  if (signal.totalRiskDelta < 0 && signal.totalConfidenceDelta > 0) {
    return 'Improves confirmation confidence and lowers risk';
  }
  if (signal.totalRiskDelta > 0) {
    return 'Raises fraud risk';
  }
  if (signal.totalConfidenceDelta > 0) {
    return 'Improves confirmation confidence';
  }
  return 'Informational scoring signal';
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatDelta(value: number) {
  if (value > 0) {
    return `+${value}`;
  }
  return String(value);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'MAD',
  }).format(amount);
}

function shortId(value: string) {
  return value.slice(0, 8);
}
