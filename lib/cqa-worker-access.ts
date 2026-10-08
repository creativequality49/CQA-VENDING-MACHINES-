const launchWorkers = ["receptionist", "sales", "marketing"];
const active = (status?: string | null) => status === "active" || status === "trialing";

export function hasIncludedCqaWorker(plan?: string | null, status?: string | null, workerId?: string) {
  return active(status) && (plan === "pro" || plan === "elite") && launchWorkers.includes(workerId || "");
}

export function canUseCqaWorker(plan: string | null | undefined, planStatus: string | null | undefined, workerId: string, workerStatus?: string | null) {
  return active(planStatus) && launchWorkers.includes(workerId) && (hasIncludedCqaWorker(plan, planStatus, workerId) || active(workerStatus));
}
