type RecoveryOperation = "request" | "update" | "callback";

/** Format transport errors without implying that an ambiguous request succeeded or failed remotely. */
export function cqaRecoveryError(failure: unknown, operation: RecoveryOperation): string {
  const detail = failure && typeof failure === "object" ? failure as { message?: unknown; name?: unknown } : {};
  const message = typeof detail.message === "string" ? detail.message : typeof failure === "string" ? failure : "";
  const network = /failed to fetch|fetch failed|network(?:\s*(?:error|request|failure))?|load failed|enotfound|econn(?:reset|refused)|etimedout|dns|connection (?:failed|closed)|request timed out/i.test(message) || detail.name === "AuthRetryableFetchError";
  if (network) {
    const context = operation === "request" ? "No recovery email has been confirmed." : operation === "update" ? "We could not confirm whether your password was updated. Try signing in before requesting another reset." : "Your recovery link could not be verified. Try the link again, or request a fresh recovery email.";
    return `We could not reach the account service. Check your connection and try again. ${context}`;
  }
  return message || (operation === "callback" ? "This recovery link could not be verified." : "Unable to reset your password. Please try again.");
}
