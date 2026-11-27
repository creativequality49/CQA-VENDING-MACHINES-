// What the receptionist knows and how it must behave on a call.
import { formatAuPhone } from '../../shared/phone';

export type ReceptionistSettings = {
  enabled: boolean;
  assistant_name: string;
  greeting: string;
  about: string;
  services: string;
  service_area: string;
  hours: string;
  pricing_wording: string;
  callback_window: string;
  emergency_instructions: string;
  owner_alert_number: string | null;
};

export type CallContext = {
  businessId: string;
  businessName: string;
  timezone: string;
  settings: ReceptionistSettings;
  callerNumber: string | null;
};

// What the caller hears first. The AI disclosure is always added, whatever
// the owner writes as their opening line.
export function welcomeGreeting(settings: Pick<ReceptionistSettings, 'greeting' | 'assistant_name'>): string {
  const opening = settings.greeting.trim().replace(/\s+/g, ' ');
  return `${opening}${/[.!?]$/.test(opening) ? '' : '.'} You're speaking with ${settings.assistant_name.trim()}, the AI receptionist. How can I help?`;
}

function localTime(timezone: string, now: Date) {
  try {
    return new Intl.DateTimeFormat('en-AU', { timeZone: timezone, weekday: 'long', hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'long' }).format(now);
  } catch {
    return now.toISOString();
  }
}

const section = (title: string, body: string) => (body.trim() ? `${title}:\n${body.trim()}` : `${title}: (not provided - do not guess)`);

export function buildSystemPrompt(context: CallContext, now = new Date()): string {
  const s = context.settings;
  return [
    `You are ${s.assistant_name}, the AI phone receptionist for ${context.businessName}, an Australian trades business.`,
    `You are not a person. If asked, say you are the business's AI receptionist. Speak Australian English.`,
    `Your one job: find out what the caller needs and take down the job so the team can call them back. You cannot book, quote, or promise a time.`,
    ``,
    `It is currently ${localTime(context.timezone, now)} for the business.`,
    `Caller ID: ${context.callerNumber ? formatAuPhone(context.callerNumber) : 'withheld'}.`,
    ``,
    section('About the business', s.about),
    section('Services', s.services),
    section('Service area', s.service_area),
    section('Hours', s.hours),
    ``,
    `TAKING THE JOB (one short question at a time, like a friendly office manager):`,
    `1. What the job is and any useful detail (what's wrong, where in the property, how long it's been happening).`,
    `2. The suburb where the job is.`,
    `3. How urgent it is.`,
    `4. Their name.`,
    `5. The best number to call back. If there is a caller ID, ask "Is ${context.callerNumber ? formatAuPhone(context.callerNumber) : 'this number'} the best number to reach you?" instead of asking them to read it out.`,
    `Call save_job_details as soon as you learn anything, and again whenever you learn more. Then read back the job, suburb and number in one sentence to confirm.`,
    `When the details are confirmed and the caller has nothing else, say the team will call back ${s.callback_window}, say goodbye, and call end_call.`,
    ``,
    `URGENCY: "emergency" only for something dangerous or damage happening right now (burst pipe flooding, sparking, gas smell, no power to a medical device). "urgent" if they need someone today or tomorrow. Otherwise "routine".`,
    `If anyone may be in danger, tell them to hang up and call triple zero (000) first.`,
    s.emergency_instructions.trim() ? `Owner's emergency instructions: ${s.emergency_instructions.trim()}` : '',
    ``,
    `RULES:`,
    `- Never give a price, estimate, discount or quote. If asked about cost, say: "${s.pricing_wording}"`,
    `- Never promise an arrival time or booking. Only promise a call back ${s.callback_window}.`,
    `- Only share facts written above. If you don't know, say the team can answer that when they call back.`,
    `- Never give safety, electrical, gas, legal or medical advice beyond calling 000.`,
    `- Never ask for card or bank details.`,
    `- Keep every reply to one or two short sentences. This is a phone call: no lists, no symbols, no emoji.`,
    `- If the call is not about a job (sales calls, spam), politely end it with end_call.`,
  ].filter((line) => line !== '').join('\n').replace(/\n{3,}/g, '\n\n');
}

export const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'save_job_details',
      description: 'Save what the caller has told you about the job. Call it whenever you learn something new; only include fields you know.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          caller_name: { type: 'string', description: "Caller's name." },
          callback_number: { type: 'string', description: 'Best number to call back, as said by the caller, or the caller ID if they confirmed it.' },
          suburb: { type: 'string', description: 'Suburb where the job is.' },
          job_type: { type: 'string', description: 'Short label for the job, under six words, e.g. "Burst pipe" or "Power point not working".' },
          urgency: { type: 'string', enum: ['emergency', 'urgent', 'routine'] },
          details: { type: 'string', description: 'Everything useful about the job in one to three plain sentences.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_call',
      description: 'Hang up after you have said goodbye.',
      parameters: { type: 'object', additionalProperties: false, properties: { reason: { type: 'string' } } },
    },
  },
] as const;
