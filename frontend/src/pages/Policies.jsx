import { useEffect, useState } from 'react';
import { getPolicies, getPolicy } from '../api/api';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Policies() {
  const [policies, setPolicies] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPolicies().then(setPolicies).finally(() => setLoading(false));
  }, []);

  const handleSelect = async (id) => {
    if (selected?.id === id) { setSelected(null); return; }
    const data = await getPolicy(id);
    setSelected(data);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Policies</h2>
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Policy Number</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Plan Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Deductible</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Effective From</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Effective To</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {policies.map((p) => (
              <tr key={p.id} onClick={() => handleSelect(p.id)} className="hover:bg-gray-50 cursor-pointer">
                <td className="px-4 py-3 font-mono text-xs">{p.policy_number}</td>
                <td className="px-4 py-3">{p.plan_name}</td>
                <td className="px-4 py-3">${Number(p.deductible_amount).toFixed(2)}</td>
                <td className="px-4 py-3">{formatDate(p.effective_from)}</td>
                <td className="px-4 py-3">{formatDate(p.effective_to)}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="mt-6 bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Coverage Rules - {selected.plan_name}</h3>
          {selected.Coverages?.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Service Code</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Service Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Coverage %</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Annual Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {selected.Coverages.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-2 font-mono text-xs">{c.service_code}</td>
                    <td className="px-4 py-2">{c.Service?.name || '-'}</td>
                    <td className="px-4 py-2">{Number(c.coverage_percentage).toFixed(0)}%</td>
                    <td className="px-4 py-2">{c.annual_limit ? `$${Number(c.annual_limit).toFixed(2)}` : 'No limit'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-gray-400">No coverage rules found.</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
