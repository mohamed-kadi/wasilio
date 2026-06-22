import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { fetchCourierPerformance, getErrorMessage } from '../api/client';

export default function CourierPerformance() {
  const { data: metrics = [], error, isLoading } = useQuery({
    queryKey: ['courier-performance'],
    queryFn: fetchCourierPerformance,
  });
  const activeCouriers = metrics.filter((metric) => metric.active).length;
  const assignedOrders = metrics.reduce((total, metric) => total + metric.assignedOrdersCount, 0);
  const deliveredOrders = metrics.reduce((total, metric) => total + metric.deliveredOrdersCount, 0);
  const failedOrders = metrics.reduce((total, metric) => total + metric.failedOrdersCount, 0);
  const completedOrders = deliveredOrders + failedOrders;
  const overallSuccessRate = completedOrders ? Math.round((deliveredOrders / completedOrders) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Courier Performance</h2>
        <p className="text-sm text-gray-500">Courier workload, delivery outcomes, and active resource visibility</p>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <PerformanceMetric title="Active couriers" value={activeCouriers} detail="Can receive work" tone="blue" />
        <PerformanceMetric title="Assigned orders" value={assignedOrders} detail="Currently assigned" tone="amber" />
        <PerformanceMetric title="Delivered" value={deliveredOrders} detail="Successful outcomes" tone="green" />
        <PerformanceMetric title="Success rate" value={`${overallSuccessRate}%`} detail={`${failedOrders} failed orders`} tone={overallSuccessRate >= 80 ? 'green' : 'red'} />
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {getErrorMessage(error)}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
              <th className="p-4 font-medium">Courier</th>
              <th className="p-4 font-medium">Assigned</th>
              <th className="p-4 font-medium">Picked up</th>
              <th className="p-4 font-medium">Delivered</th>
              <th className="p-4 font-medium">Failed</th>
              <th className="p-4 font-medium">Success rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.map((metric) => (
              <tr key={metric.courierId} className="hover:bg-gray-50">
                <td className="p-4">
                  <p className="font-medium text-gray-900">{metric.courierName}</p>
                  <p className="text-xs text-gray-500">{metric.active ? 'Active - can receive assignments' : 'Inactive - no new assignments'}</p>
                </td>
                <td className="p-4 font-medium">{metric.assignedOrdersCount}</td>
                <td className="p-4 font-medium">{metric.pickedUpOrdersCount}</td>
                <td className="p-4 font-medium text-green-700">{metric.deliveredOrdersCount}</td>
                <td className="p-4 font-medium text-red-700">{metric.failedOrdersCount}</td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-28 rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${Math.round(metric.deliverySuccessRate * 100)}%` }}
                      />
                    </div>
                    <span className="font-medium">{Math.round(metric.deliverySuccessRate * 100)}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && metrics.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No courier metrics are available.
                </td>
              </tr>
            )}
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <BarChart3 size={16} />
                    Loading courier metrics...
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PerformanceMetric({
  title,
  value,
  detail,
  tone,
}: {
  title: string;
  value: number | string;
  detail: string;
  tone: 'blue' | 'amber' | 'green' | 'red';
}) {
  const tones = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-sm">{detail}</p>
    </div>
  );
}
