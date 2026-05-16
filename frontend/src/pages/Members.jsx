import { useEffect, useState } from 'react';
import { getMembers, getPolicies, createMember } from '../api/api';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Members() {
  const [members, setMembers] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const addToast = useToast();

  const load = () => {
    Promise.all([getMembers(), getPolicies()])
      .then(([m, p]) => { setMembers(m); setPolicies(p); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    try {
      await createMember(data);
      addToast('Member created successfully');
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
        <h2 className="text-2xl font-bold text-gray-900">Members</h2>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
          Create Member
        </button>
      </div>

      {members.length === 0 ? (
        <p className="text-gray-500 text-sm">No members found. Create one to get started.</p>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Member No</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Full Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">DOB</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{m.member_no}</td>
                  <td className="px-4 py-3">{m.full_name}</td>
                  <td className="px-4 py-3">{formatDate(m.dob)}</td>
                  <td className="px-4 py-3">{policies.find((p) => p.id === m.policy_id)?.plan_name || m.policy_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Create Member">
        <MemberForm policies={policies} onSubmit={handleCreate} />
      </Modal>
    </div>
  );
}

function MemberForm({ policies, onSubmit }) {
  const [form, setForm] = useState({ member_no: '', full_name: '', dob: '', policy_id: '' });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const e = {};
    if (!form.member_no.trim()) e.member_no = 'Required';
    if (!form.full_name.trim()) e.full_name = 'Required';
    if (!form.dob) e.dob = 'Required';
    if (!form.policy_id) e.policy_id = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (validate()) onSubmit({ ...form, policy_id: Number(form.policy_id) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Member No" error={errors.member_no}>
        <input type="text" value={form.member_no} onChange={(e) => setForm({ ...form, member_no: e.target.value })} className="input" placeholder="M-100001" />
      </Field>
      <Field label="Full Name" error={errors.full_name}>
        <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input" />
      </Field>
      <Field label="Date of Birth" error={errors.dob}>
        <input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className="input" />
      </Field>
      <Field label="Policy" error={errors.policy_id}>
        <select value={form.policy_id} onChange={(e) => setForm({ ...form, policy_id: e.target.value })} className="input">
          <option value="">Select policy...</option>
          {policies.map((p) => <option key={p.id} value={p.id}>{p.plan_name} ({p.policy_number})</option>)}
        </select>
      </Field>
      <button type="submit" className="w-full px-4 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700">
        Create Member
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
