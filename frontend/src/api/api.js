const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.errors?.join(', ') || 'Request failed');
  return data;
}

export const getMembers = () => request('/members');
export const createMember = (data) => request('/members', { method: 'POST', body: JSON.stringify(data) });

export const getPolicies = () => request('/policies');
export const getPolicy = (id) => request(`/policies/${id}`);

export const getServices = () => request('/services');

export const getClaims = () => request('/claims');
export const getClaim = (id) => request(`/claims/${id}`);
export const createClaim = (data) => request('/claims', { method: 'POST', body: JSON.stringify(data) });
export const adjudicateClaim = (id) => request(`/claims/${id}/adjudicate`, { method: 'POST' });

export const getDisputes = (claimId) => request(`/claims/${claimId}/disputes`);
export const createDispute = (claimId, data) => request(`/claims/${claimId}/disputes`, { method: 'POST', body: JSON.stringify(data) });
export const resolveDispute = (disputeId, data) => request(`/disputes/${disputeId}`, { method: 'PATCH', body: JSON.stringify(data) });
