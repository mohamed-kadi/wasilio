import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { fetchCourierPerformance, getErrorMessage } from '../api/client';

export default function CourierPerformance() {
  const { data: metrics = [], error, isLoading } = useQuery({
    queryKey: ['courier-performance'],
    queryFn: fetchCourierPerformance,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Courier Performance</h2>
        <p className="text-sm text-gray-500">Basic operational counts by courier</p>
      </div>

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
                  <p className="text-xs text-gray-500">{metric.active ? 'Active' : 'Inactive'}</p>
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
