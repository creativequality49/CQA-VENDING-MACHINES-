export const RELEASE_GATES = Object.freeze([
  'signup', 'private-owner-upload', 'persisted-machine-publication',
  'subscription-checkout-and-webhook', 'buyer-account-binding',
  'paid-order-entitlement', 'authenticated-buyer-library',
  'signed-download-and-expiry', 'refund-and-cancellation-revocation',
  'two-account-isolation', 'checks-and-production-build',
]);

export function claimRun(state, runId, now = new Date()) {
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.runs) ||
      typeof runId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(runId)) {
    throw new Error('Invalid state or run ID');
  }
  const timestamp = now.getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Invalid run time');
  if (state.lease && (!Number.isFinite(Date.parse(state.lease.expiresAt)) || Date.parse(state.lease.expiresAt) > timestamp)) {
    throw new Error('Another run holds the lease; do not write');
  }
  if (state.runs.some(run => run.id === runId)) throw new Error('Run already completed');
  return { ...structuredClone(state), lease: {
    runId, startedAt: now.toISOString(),
    expiresAt: new Date(timestamp + 45 * 60 * 1000).toISOString(),
  } };
}

export function finishRun(state, run, now = new Date()) {
  const timestamp = now.getTime();
  const expiry = Date.parse(state?.lease?.expiresAt);
  if (!state || state.schemaVersion !== 1 || !Array.isArray(state.runs) ||
      !run || !state.lease || state.lease.runId !== run.id ||
      !Number.isFinite(timestamp) || !Number.isFinite(expiry) || expiry <= timestamp) {
    throw new Error('Run does not own a current lease');
  }
  if (!['completed', 'blocked', 'failed', 'no-change'].includes(run.status) ||
      !/^[a-f0-9]{40}$/.test(run.inspectedCommit) || !Array.isArray(run.checks)) {
    throw new Error('Run must include status, exact commit and actual checks');
  }
  return { ...structuredClone(state), lease: null,
    runs: [...state.runs, { ...run, finishedAt: now.toISOString() }].slice(-30) };
}

export function launchVerdict(gates, commitSha, now = new Date()) {
  const validCandidate = typeof commitSha === 'string' && /^[a-f0-9]{40}$/.test(commitSha);
  const missing = RELEASE_GATES.filter(id => !validCandidate || !(Array.isArray(gates) ? gates : []).some(gate =>
    gate?.id === id && gate.status === 'verified' && Array.isArray(gate.evidence) && gate.evidence.some(item =>
      item?.commitSha === commitSha && item.result === 'passed' &&
      ['test', 'preview', 'production'].includes(item.environment) &&
      typeof item.source === 'string' && item.source.trim().length > 0 &&
      Number.isFinite(Date.parse(item.observedAt)) && Date.parse(item.observedAt) <= now.getTime()
    )
  ));
  return { status: missing.length ? 'NOT_READY' : 'READY_FOR_RELEASE_REVIEW', missing };
}
