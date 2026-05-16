import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getClaims, getMembers, getServices, getPolicies, createClaim } from '../api/api';
import { useToast } from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Claims() {
  const [claims, setClaims] = useState([]);
  const [members, setMembers] = useState([]);
  const [services, setServices] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const navigate = useNavigate();
  const addToast = useToast();

  const load = () => {
    Promise.all([getClaims(), getMembers(), getServices(), getPolicies()])
      .then(([c, m, s, p]) => { setClaims(c); setMembers(m); setServices(s); setPolicies(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createClaim(data);
      addToast('Claim submitted successfully');
      setShowForm(false);
      load();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Claims</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Submit New Claim
        </button>
      </div>

      {claims.length === 0 ? (
        <p className="text-gray-500 text-sm">No claims found. Submit one to get started.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">ID</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Service Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {claims.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{c.id}</td>
                  <td className="px-4 py-3">{c.Member?.full_name || c.member_id}</td>
                  <td className="px-4 py-3">{c.provider_name}</td>
                  <td className="px-4 py-3">{formatDate(c.service_date)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/claims/${c.id}`)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Submit New Claim">
        <ClaimForm members={members} services={services} policies={policies} onSubmit={handleCreate} />
      </Modal>
    </div>
  );
}

function ClaimForm({ members, services, policies, onSubmit }) {
  const [form, setForm] = useState({
    member_id: '', policy_id: '', service_date: '', provider_name: '', diagnosis_code: '',
  });
  const [lineItems, setLineItems] = useState([{ service_code: '', description: '', billed_amount: '' }]);
  const [errors, setErrors] = useState({});

  const handleMemberChange = (memberId) => {
    const member = members.find((m) => m.id === Number(memberId));
    setForm({ ...form, member_id: memberId, policy_id: member ? String(member.policy_id) : '' });
  };

  const updateLineItem = (idx, field, value) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [field]: value };
    setLineItems(updated);
  };

  const addLineItem = () => setLineItems([...lineItems, { service_code: '', description: '', billed_amount: '' }]);
  const removeLineItem = (idx) => { if (lineItems.length > 1) setLineItems(lineItems.filter((_, i) => i !== idx)); };

  const validate = () => {
    const e = {};
    if (!form.member_id) e.member_id = 'Required';
    if (!form.service_date) e.service_date = 'Required';
    if (!form.provider_name.trim()) e.provider_name = 'Required';
    if (!form.diagnosis_code.trim()) e.diagnosis_code = 'Required';
    lineItems.forEach((li, i) => {
      if (!li.service_code) e[`li_${i}_service`] = 'Required';
      if (!li.description.trim()) e[`li_${i}_desc`] = 'Required';
      if (!li.billed_amount || Number(li.billed_amount) <= 0) e[`li_${i}_amount`] = 'Must be > 0';
    });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    onSubmit({
      member_id: Number(form.member_id),
      policy_id: Number(form.policy_id),
      service_date: form.service_date,
      provider_name: form.provider_name,
      diagnosis_code: form.diagnosis_code,
      line_items: lineItems.map((li) => ({
        service_code: li.service_code,
        description: li.description,
        billed_amount: Number(li.billed_amount),
      })),
    });
  };

  const selectedPolicy = policies.find((p) => p.id === Number(form.policy_id));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Member" error={errors.member_id}>
        <select value={form.member_id} onChange={(e) => handleMemberChange(e.target.value)} className="input">
          <option value="">Select member...</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.full_name} ({m.member_no})</option>)}
        </select>
      </Field>
      <Field label="Policy">
        <input type="text" value={selectedPolicy ? `${selectedPolicy.plan_name} (${selectedPolicy.policy_number})` : ''} readOnly className="input bg-gray-50" />
      </Field>
      <Field label="Service Date" error={errors.service_date}>
        <input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} className="input" />
      </Field>
      <Field label="Provider Name" error={errors.provider_name}>
        <input type="text" value={form.provider_name} onChange={(e) => setForm({ ...form, provider_name: e.target.value })} className="input" />
      </Field>
      <Field label="Diagnosis Code" error={errors.diagnosis_code}>
        <input type="text" value={form.diagnosis_code} onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value })} className="input" placeholder="e.g. J06.9" />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Line Items</label>
          <button type="button" onClick={addLineItem} className="text-xs text-indigo-600 hover:text-indigo-800">+ Add Line Item</button>
        </div>
        <div className="space-y-3">
          {lineItems.map((li, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <div className="flex-1">
                <select value={li.service_code} onChange={(e) => updateLineItem(idx, 'service_code', e.target.value)} className="input text-xs">
                  <option value="">Service...</option>
                  {services.map((s) => <option key={s.code} value={s.code}>{s.code}</option>)}
                </select>
                {errors[`li_${idx}_service`] && <p className="text-xs text-red-600">{errors[`li_${idx}_service`]}</p>}
              </div>
              <div className="flex-1">
                <input type="text" value={li.description} onChange={(e) => updateLineItem(idx, 'description', e.target.value)} className="input text-xs" placeholder="Description" />
                {errors[`li_${idx}_desc`] && <p className="text-xs text-red-600">{errors[`li_${idx}_desc`]}</p>}
              </div>
              <div className="w-24">
                <input type="number" step="0.01" min="0.01" value={li.billed_amount} onChange={(e) => updateLineItem(idx, 'billed_amount', e.target.value)} className="input text-xs" placeholder="$" />
                {errors[`li_${idx}_amount`] && <p className="text-xs text-red-600">{errors[`li_${idx}_amount`]}</p>}
              </div>
              {lineItems.length > 1 && (
                <button type="button" onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 mt-2 text-sm">&times;</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
        Submit Claim
      </button>
    </form>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
