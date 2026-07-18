import type { OrderIntelligence, OrderIntelligenceLevel, OrderIntelligenceSignal } from '../api/client';

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

const signalTones: Record<OrderIntelligenceSignal['severity'], string> = {
  POSITIVE: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  INFO: 'border-blue-200 bg-blue-50 text-blue-800',
  WARNING: 'border-amber-200 bg-amber-50 text-amber-800',
  CRITICAL: 'border-red-200 bg-red-50 text-red-800',
};

export function IntelligenceBadge({
  intelligence,
  showScores = true,
}: {
  intelligence?: OrderIntelligence;
  showScores?: boolean;
}) {
  if (!intelligence) {
    return (
      <div className="space-y-1">
        <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
          Score pending
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTones[intelligence.level]}`}>
        {levelLabels[intelligence.level]}
      </span>
      {showScores && (
        <p className="text-xs text-gray-500">
          {intelligence.confirmationConfidenceScore} confidence / {intelligence.fraudRiskScore} risk
        </p>
      )}
    </div>
  );
}

export function IntelligenceScoreKpi({
  intelligence,
  compact = false,
  showHeader = true,
}: {
  intelligence?: OrderIntelligence;
  compact?: boolean;
  showHeader?: boolean;
}) {
  if (!intelligence) {
    return (
      <div className="space-y-3">
        {showHeader && (
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Score KPI</p>
              <p className="mt-1 text-sm text-gray-500">Waiting for order evidence.</p>
            </div>
            <IntelligenceBadge intelligence={intelligence} showScores={false} />
          </div>
        )}
        <ScoreMeter label="Confirmation" value={0} valueLabel="Pending" fillClassName="bg-gray-300" compact={compact} />
        <ScoreMeter label="Fraud risk" value={0} valueLabel="Pending" fillClassName="bg-gray-300" compact={compact} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {showHeader && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Score KPI</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{levelLabels[intelligence.level]}</p>
          </div>
          <IntelligenceBadge intelligence={intelligence} showScores={false} />
        </div>
      )}
      <ScoreMeter
        label="Confirmation"
        value={intelligence.confirmationConfidenceScore}
        valueLabel={`${intelligence.confirmationConfidenceScore} score`}
        fillClassName={confidenceFillClass(intelligence.confirmationConfidenceScore)}
        compact={compact}
      />
      <ScoreMeter
        label="Fraud risk"
        value={intelligence.fraudRiskScore}
        valueLabel={`${intelligence.fraudRiskScore} score`}
        fillClassName={riskFillClass(intelligence.fraudRiskScore)}
        compact={compact}
      />
    </div>
  );
}

export function IntelligenceSignals({
  intelligence,
  limit,
}: {
  intelligence?: OrderIntelligence;
  limit?: number;
}) {
  const signals = intelligence?.signals ?? [];
  const visibleSignals = typeof limit === 'number' ? signals.slice(0, limit) : signals;

  if (!intelligence || visibleSignals.length === 0) {
    return <p className="text-sm text-gray-500">No score signals recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {visibleSignals.map((signal) => (
        <div key={`${signal.key}-${signal.label}`} className={`rounded-md border px-3 py-2 ${signalTones[signal.severity]}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{signal.label}</p>
            <span className="text-xs font-medium">
              {formatDelta(signal.confidenceDelta)} confidence / {formatDelta(signal.riskDelta)} risk
            </span>
          </div>
          {signal.detail && <p className="mt-1 text-xs opacity-90">{signal.detail}</p>}
        </div>
      ))}
    </div>
  );
}

export function IntelligenceHistory({
  intelligence,
  limit = 5,
}: {
  intelligence?: OrderIntelligence;
  limit?: number;
}) {
  const history = (intelligence?.history ?? []).slice(0, limit);

  if (!intelligence || history.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase text-gray-500">Score history</p>
        <p className="mt-2 text-sm text-gray-500">No score movement has been recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Score history</p>
          <p className="mt-1 text-sm text-gray-600">Latest score movement and reason.</p>
        </div>
        <span className="text-xs font-medium text-gray-500">{history.length} shown</span>
      </div>

      <div className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200">
        {history.map((event, index) => (
          <div key={`${event.sequenceNumber}-${event.calculatedAt}-${index}`} className="px-3 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">{event.changeLabel}</p>
                <p className="mt-1 text-xs text-gray-500">{formatDateTime(event.calculatedAt)}</p>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${levelTones[event.level]}`}>
                {levelLabels[event.level]}
              </span>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <HistoryMetric
                label="Confirmation"
                value={`${event.confirmationConfidenceScore}/100`}
                delta={event.previousConfirmationConfidenceScore == null ? null : event.confidenceDelta}
              />
              <HistoryMetric
                label="Fraud risk"
                value={`${event.fraudRiskScore}/100`}
                delta={event.previousFraudRiskScore == null ? null : event.riskDelta}
                positiveIsGood={false}
              />
              <div>
                <p className="text-xs font-semibold uppercase text-gray-500">Reason</p>
                <p className="mt-1 truncate text-sm font-medium text-gray-900">{event.reasonLabel ?? event.summary}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntelligenceSummary({
  intelligence,
  className = 'text-sm text-gray-600',
}: {
  intelligence?: OrderIntelligence;
  className?: string;
}) {
  return <p className={className}>{intelligence?.summary ?? 'Score will appear after order evidence is available.'}</p>;
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

function HistoryMetric({
  label,
  value,
  delta,
  positiveIsGood = true,
}: {
  label: string;
  value: string;
  delta: number | null;
  positiveIsGood?: boolean;
}) {
  const deltaTone =
    delta === 0
      ? 'text-gray-500'
      : ((delta ?? 0) > 0) === positiveIsGood
        ? 'text-emerald-700'
        : 'text-red-700';

  return (
    <div>
      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">{value}</span>
        {delta !== null && (
          <span className={`text-xs font-semibold ${deltaTone}`}>{formatDelta(delta)}</span>
        )}
      </div>
    </div>
  );
}

function ScoreMeter({
  label,
  value,
  valueLabel,
  fillClassName,
  compact,
}: {
  label: string;
  value: number;
  valueLabel: string;
  fillClassName: string;
  compact: boolean;
}) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-semibold uppercase text-gray-500">{label}</span>
        <span className="shrink-0 whitespace-nowrap font-semibold text-gray-900">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${fillClassName}`} style={{ width: `${clampedValue}%` }} />
      </div>
    </div>
  );
}

function confidenceFillClass(value: number) {
  if (value >= 75) {
    return 'bg-emerald-500';
  }
  if (value >= 50) {
    return 'bg-blue-500';
  }
  return 'bg-amber-500';
}

function riskFillClass(value: number) {
  if (value >= 65) {
    return 'bg-red-500';
  }
  if (value >= 36) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}
