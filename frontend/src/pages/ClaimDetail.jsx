import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClaim, adjudicateClaim, getDisputes, createDispute, resolveDispute } from '../api/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmDialog from '../components/ConfirmDialog';

export default function ClaimDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const addToast = useToast();
  const [claim, setClaim] = useState(null);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adjResult, setAdjResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [resolveForm, setResolveForm] = useState(null);

  const load = async () => {
    try {
      const data = await getClaim(id);
      setClaim(data);
      const { disputes: d } = await getDisputes(id);
      setDisputes(d);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAdjudicate = async () => {
    setShowConfirm(false);
    try {
      const result = await adjudicateClaim(id);
      setAdjResult(result);
      addToast('Claim adjudicated successfully');
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleDispute = async () => {
    if (!disputeReason.trim()) { addToast('Reason is required', 'error'); return; }
    try {
      await createDispute(id, { reason: disputeReason });
      addToast('Dispute filed successfully');
      setShowDisputeForm(false);
      setDisputeReason('');
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleResolve = async (disputeId) => {
    if (!resolveForm.resolution || !resolveForm.resolution_notes.trim()) {
      addToast('All fields are required', 'error'); return;
    }
    try {
      await resolveDispute(disputeId, resolveForm);
      addToast('Dispute resolved');
      setResolveForm(null);
      setAdjResult(null);
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!claim) return <p className="text-gray-500">Claim not found.</p>;

  const canAdjudicate = ['SUBMITTED', 'UNDER_REVIEW'].includes(claim.status);
  const canDispute = ['APPROVED', 'PARTIALLY_APPROVED', 'DENIED'].includes(claim.status);

  return (
    <div>
      <button onClick={() => navigate('/claims')} className="text-sm text-indigo-600 hover:text-indigo-800 mb-4">&larr; Back to Claims</button>

      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Claim #{claim.id}</h2>
          <StatusBadge status={claim.status} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Info label="Member" value={claim.Member?.full_name || claim.member_id} />
          <Info label="Policy" value={claim.Policy?.plan_name || claim.policy_id} />
          <Info label="Provider" value={claim.provider_name} />
          <Info label="Service Date" value={formatDate(claim.service_date)} />
          <Info label="Diagnosis" value={claim.diagnosis_code} />
          <Info label="Submitted" value={formatDate(claim.submitted_at)} />
        </div>

        <div className="flex gap-3 mt-6">
          {canAdjudicate && (
            <button onClick={() => setShowConfirm(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
              Adjudicate
            </button>
          )}
          {canDispute && (
            <button onClick={() => setShowDisputeForm(true)} className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
              File Dispute
            </button>
          )}
        </div>
      </div>

      {/* Adjudication Summary */}
      {adjResult && (
        <div className="bg-indigo-50 rounded-lg border border-indigo-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Adjudication Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <SummaryCard label="Total Billed" value={money(adjResult.claim.summary.total_billed)} />
            <SummaryCard label="Total Approved" value={money(adjResult.claim.summary.total_approved)} color="text-green-700" />
            <SummaryCard label="Deductible Applied" value={money(adjResult.claim.summary.total_deductible_applied)} />
            <SummaryCard label="Member Responsibility" value={money(adjResult.claim.summary.total_member_responsibility)} color="text-red-700" />
          </div>
        </div>
      )}

      {/* Line Items */}
      <div className="bg-white rounded-lg border overflow-hidden mb-6">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Line Items</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Service</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Description</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Billed</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Approved</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(adjResult ? adjResult.claim.line_items : claim.LineItems)?.map((li) => (
              <tr key={li.id} className={li.status === 'DENIED' ? 'bg-red-50' : li.status === 'APPROVED' ? 'bg-green-50' : ''}>
                <td className="px-4 py-3 font-mono text-xs">{li.service_code}</td>
                <td className="px-4 py-3">{li.description}</td>
                <td className="px-4 py-3">{money(li.billed_amount)}</td>
                <td className="px-4 py-3">{li.approved_amount !== null ? money(li.approved_amount) : '-'}</td>
                <td className="px-4 py-3"><StatusBadge status={li.status} /></td>
                <td className="px-4 py-3 text-xs text-gray-600 max-w-xs">{li.denial_reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Disputes */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Disputes</h3>
        {disputes.length === 0 ? (
          <p className="text-sm text-gray-400">No disputes filed.</p>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <div key={d.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">Dispute #{d.id}</span>
                  <StatusBadge status={d.status} />
                </div>
                <p className="text-sm text-gray-700 mb-1"><strong>Reason:</strong> {d.reason}</p>
                {d.resolution_notes && <p className="text-sm text-gray-600"><strong>Resolution:</strong> {d.resolution_notes}</p>}
                {['OPEN', 'UNDER_REVIEW'].includes(d.status) && (
                  <button
                    onClick={() => setResolveForm({ disputeId: d.id, resolution: '', resolution_notes: '' })}
                    className="mt-3 px-3 py-1.5 text-xs bg-gray-800 text-white rounded-lg hover:bg-gray-900"
                  >
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispute Form */}
      {showDisputeForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">File Dispute</h3>
            <textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              className="input w-full h-24 resize-none"
              placeholder="Explain why you are disputing this claim..."
            />
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowDisputeForm(false)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg">Cancel</button>
              <button onClick={handleDispute} className="px-4 py-2 text-sm text-white bg-purple-600 rounded-lg hover:bg-purple-700">Submit Dispute</button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Dispute Form */}
      {resolveForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold mb-4">Resolve Dispute</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution</label>
                <select
                  value={resolveForm.resolution}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Select...</option>
                  <option value="UPHELD">UPHELD - Original decision stands</option>
                  <option value="OVERTURNED">OVERTURNED - Re-adjudication needed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                <textarea
                  value={resolveForm.resolution_notes}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution_notes: e.target.value })}
                  className="input w-full h-24 resize-none"
                  placeholder="Explain the resolution decision..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setResolveForm(null)} className="px-4 py-2 text-sm text-gray-700 border rounded-lg">Cancel</button>
              <button onClick={() => handleResolve(resolveForm.disputeId)} className="px-4 py-2 text-sm text-white bg-gray-800 rounded-lg hover:bg-gray-900">Resolve</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        onConfirm={handleAdjudicate}
        onCancel={() => setShowConfirm(false)}
        title="Adjudicate Claim"
        message="Are you sure? This will process the claim against coverage rules. This cannot be undone."
      />
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function SummaryCard({ label, value, color = 'text-gray-900' }) {
  return (
    <div className="bg-white rounded-lg p-3 border">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function money(val) {
  if (val === null || val === undefined) return '-';
  return `$${Number(val).toFixed(2)}`;
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
