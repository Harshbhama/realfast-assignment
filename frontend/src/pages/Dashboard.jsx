import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMembers, getClaims } from '../api/api';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const [members, setMembers] = useState([]);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([getMembers(), getClaims()])
      .then(([m, c]) => { setMembers(m); setClaims(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  const statusCounts = claims.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card label="Total Members" value={members.length} />
        <Card label="Total Claims" value={claims.length} />
        <Card label="Approved" value={statusCounts.APPROVED || 0} color="text-green-600" />
        <Card label="Denied" value={statusCounts.DENIED || 0} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Claims by Status</h3>
          <div className="space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex justify-between text-sm">
                <span className="text-gray-700">{status.replace(/_/g, ' ')}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
            {Object.keys(statusCounts).length === 0 && (
              <p className="text-sm text-gray-400">No claims yet.</p>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => navigate('/members')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Create Member
        </button>
        <button onClick={() => navigate('/claims')} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Submit Claim
        </button>
      </div>
    </div>
  );
}

function Card({ label, value, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}
