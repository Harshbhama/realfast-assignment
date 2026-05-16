import { useEffect, useState } from 'react';
import { getServices } from '../api/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getServices().then(setServices).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Services</h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Code</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {services.map((s) => (
              <tr key={s.code} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3">{s.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
