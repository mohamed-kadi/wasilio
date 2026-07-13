import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Gauge, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { fetchIntelligenceReport, getErrorMessage } from '../api/client';
import type {
  IntelligenceMovement,
  IntelligenceReport as IntelligenceReportData,
  IntelligenceTopSignal,
  IntelligenceWatchlistOrder,
  OrderIntelligenceLevel,
  OrderIntelligenceSignalSeverity,
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          icon={<Gauge size={18} />}
          label="Scored orders"
          value={report.scoredOrders.toLocaleString()}
          detail={`${report.highRiskCount.toLocaleString()} high risk`}
          tone="blue"
        />
        <KpiTile
          icon={<ArrowUpRight size={18} />}
          label="Avg confirmation"
          value={`${report.averageConfirmationConfidence}/100`}
          detail="Higher is better"
          tone="emerald"
        />
        <KpiTile
          icon={<ArrowDownRight size={18} />}
          label="Avg fraud risk"
          value={`${report.averageFraudRisk}/100`}
          detail="Lower is better"
          tone={report.averageFraudRisk >= report.calibration.highRiskMinimumRisk ? 'red' : 'amber'}
        />
        <KpiTile
          icon={<Activity size={18} />}
          label="Risk movement"
          value={report.movementSummary.riskIncreasedCount.toLocaleString()}
          detail={`${report.movementSummary.levelChangedCount.toLocaleString()} level changes`}
          tone="red"
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
              <BarChart3 size={19} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Score distribution</h2>
              <p className="mt-1 text-sm text-gray-600">Current scored orders by level.</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            <LevelRow label="High confidence" count={report.highConfidenceCount} total={report.scoredOrders} tone="emerald" />
            <LevelRow label="Needs attention" count={report.needsAttentionCount} total={report.scoredOrders} tone="amber" />
            <LevelRow label="High risk" count={report.highRiskCount} total={report.scoredOrders} tone="red" />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700">
              <ShieldAlert size={19} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">High-risk watchlist</h2>
              <p className="mt-1 text-sm text-gray-600">Current orders with the strongest risk score.</p>
            </div>
          </div>
          <div className="mt-4">
            <WatchlistTable orders={report.highRiskOrders} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Top score reasons</h2>
          <p className="mt-1 text-sm text-gray-600">Current signals appearing most often across scored orders.</p>
          <div className="mt-4">
            <TopSignalsTable signals={report.topSignals} />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Recent score movement</h2>
          <p className="mt-1 text-sm text-gray-600">Latest audit events from recalculated scores.</p>
          <div className="mt-4">
            <MovementTable movements={report.recentMovements} />
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-gray-700">
            <SlidersHorizontal size={19} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Calibration</h2>
            <p className="mt-1 text-sm text-gray-600">Version {report.calibration.version}; report-only, no automatic lifecycle action.</p>
          </div>
        </div>
        <CalibrationGrid report={report} />
      </section>
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

function LevelRow({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: 'emerald' | 'amber' | 'red';
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
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-semibold text-gray-900">{count.toLocaleString()} orders</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-xs text-gray-500">{percent}% of scored orders</p>
    </div>
  );
}

function WatchlistTable({ orders }: { orders: IntelligenceWatchlistOrder[] }) {
  if (orders.length === 0) {
    return <EmptyState text="No high-risk orders are currently scored." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Order</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Customer</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Risk</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Reason</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {orders.map((order) => (
            <tr key={order.orderId}>
              <td className="px-3 py-3">
                <Link to={`/app/orders/${order.orderId}`} className="font-mono text-blue-600 hover:underline">
                  {shortId(order.orderId)}
                </Link>
              </td>
              <td className="px-3 py-3">
                <p className="font-medium text-gray-900">{order.customerName}</p>
                <p className="text-xs text-gray-500">{order.customerPhone}</p>
              </td>
              <td className="px-3 py-3">
                <p className="font-semibold text-red-700">{order.fraudRiskScore}/100</p>
                <p className="text-xs text-gray-500">{order.confirmationConfidenceScore}/100 confirmation</p>
              </td>
              <td className="px-3 py-3">
                <p className="max-w-56 truncate text-gray-700">{order.summary}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopSignalsTable({ signals }: { signals: IntelligenceTopSignal[] }) {
  if (signals.length === 0) {
    return <EmptyState text="No score reasons have been recorded yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Reason</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Impact</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Orders</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {signals.map((signal) => (
            <tr key={signal.key}>
              <td className="px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-gray-900">{signal.label}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${severityTones[signal.severity]}`}>
                    {signal.severity.toLowerCase()}
                  </span>
                </div>
                {signal.detail && <p className="mt-1 max-w-md truncate text-xs text-gray-500">{signal.detail}</p>}
              </td>
              <td className="px-3 py-3">
                <p className="text-gray-700">
                  {formatDelta(signal.totalConfidenceDelta)} confirmation / {formatDelta(signal.totalRiskDelta)} risk
                </p>
              </td>
              <td className="px-3 py-3 font-semibold text-gray-900">{signal.count.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MovementTable({ movements }: { movements: IntelligenceMovement[] }) {
  if (movements.length === 0) {
    return <EmptyState text="No score movement has been recorded yet." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Change</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Score</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Reason</th>
            <th className="px-3 py-2 text-left font-semibold text-gray-600">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {movements.map((movement) => (
            <tr key={`${movement.orderId}-${movement.sequenceNumber}`}>
              <td className="px-3 py-3">
                <Link to={`/app/orders/${movement.orderId}`} className="font-medium text-blue-600 hover:underline">
                  {movement.changeLabel}
                </Link>
                <div className="mt-1">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${levelTones[movement.level]}`}>
                    {levelLabels[movement.level]}
                  </span>
                </div>
              </td>
              <td className="px-3 py-3">
                <p className="text-gray-700">
                  {movement.confirmationConfidenceScore}/100 <Delta value={movement.confidenceDelta} />
                </p>
                <p className="mt-1 text-gray-700">
                  {movement.fraudRiskScore}/100 risk <Delta value={movement.riskDelta} positiveIsGood={false} />
                </p>
              </td>
              <td className="px-3 py-3">
                <p className="max-w-48 truncate text-gray-700">{movement.reasonLabel ?? movement.summary}</p>
              </td>
              <td className="px-3 py-3 text-gray-500">{formatDateTime(movement.calculatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CalibrationGrid({ report }: { report: IntelligenceReportData }) {
  const calibration = report.calibration;
  const items = [
    ['Base confidence', calibration.baseConfirmationConfidence],
    ['Base risk', calibration.baseFraudRisk],
    ['High confidence', `${calibration.highConfidenceMinimumConfidence}+ / risk ${calibration.highConfidenceMaximumRisk} or less`],
    ['High risk', `${calibration.highRiskMinimumRisk}+ risk`],
    ['Confirmed cap', `${calibration.confirmedMinimumConfidence}+ / risk ${calibration.confirmedMaximumRisk} or less`],
    ['Delivered cap', `${calibration.deliveredMinimumConfidence}+ / risk ${calibration.deliveredMaximumRisk} or less`],
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

function Delta({ value, positiveIsGood = true }: { value: number; positiveIsGood?: boolean }) {
  const tone =
    value === 0
      ? 'text-gray-500'
      : (value > 0) === positiveIsGood
        ? 'text-emerald-700'
        : 'text-red-700';
  return <span className={`text-xs font-semibold ${tone}`}>{formatDelta(value)}</span>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-sm text-gray-500">{text}</div>;
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

function shortId(value: string) {
  return value.slice(0, 8);
}
