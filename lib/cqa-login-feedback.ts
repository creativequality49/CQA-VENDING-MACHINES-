export function cqaLoginFailure(failure: unknown, sendsEmail: boolean) {
  const value = failure && typeof failure === "object" ? failure as { code?: unknown; status?: unknown; message?: unknown } : {};
  const emailRateLimit = value.code === "over_email_send_rate_limit" || (sendsEmail && value.status === 429);
  if (emailRateLimit) {
    const seconds = typeof value.message === "string" ? value.message.match(/after\s+(\d{1,5})\s+seconds?/i)?.[1] : undefined;
    const cooldown = Math.max(60, Math.min(3600, Number(seconds) || 60));
    return { cooldown, message: `Please wait ${cooldown} seconds before requesting another email. Check your inbox and spam folder for the latest link.` };
  }
  if (value.code === "invalid_credentials") return { cooldown: 0, message: "Incorrect email or password. You can use an email sign-in link below." };
  if (value.code === "email_not_confirmed") return { cooldown: 0, message: "Check your email for the confirmation link, or request a fresh confirmation email." };
  if (value.code === "weak_password") return { cooldown: 0, message: "Choose a stronger password with at least 8 characters." };
  return { cooldown: 0, message: sendsEmail ? "The email request could not be completed. Please try again shortly." : "Account access could not be completed. Please check your details and try again." };
}
