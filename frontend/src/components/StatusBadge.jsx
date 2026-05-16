const colors = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  PARTIALLY_APPROVED: 'bg-orange-100 text-orange-800',
  DENIED: 'bg-red-100 text-red-800',
  DISPUTED: 'bg-purple-100 text-purple-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  ACTIVE: 'bg-green-100 text-green-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-800',
  OPEN: 'bg-blue-100 text-blue-800',
  RESOLVED_UPHELD: 'bg-gray-100 text-gray-800',
  RESOLVED_OVERTURNED: 'bg-purple-100 text-purple-800',
  PENDING: 'bg-gray-100 text-gray-600',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-800',
};

export default function StatusBadge({ status }) {
  const cls = colors[status] || 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
}
