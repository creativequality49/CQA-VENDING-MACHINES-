// One live phone call: turns the caller's words into replies, saves the job
// details as they are learned, and decides when to hang up. Transport-free
// (relay.ts feeds it text from Twilio), and its storage and model are
// injected so the whole conversation logic is unit-tested.
import type { Chat, ChatMessage } from './openai';
import { buildSystemPrompt, TOOLS, welcomeGreeting, type CallContext } from './prompt';

export type JobDetails = {
  caller_name?: string;
  callback_number?: string;
  suburb?: string;
  job_type?: string;
  urgency?: string;
  details?: string;
};

export type TranscriptEntry = { role: 'caller' | 'receptionist'; text: string; at: string };

export interface CallStore {
  loadContext(businessId: string, callSid: string): Promise<CallContext | null>;
  saveDetails(callSid: string, details: JobDetails): Promise<void>;
  saveTranscript(businessId: string, callSid: string, transcript: TranscriptEntry[]): Promise<void>;
}

export type TurnResult = { reply: string; endCall: boolean };

export const MAX_TURNS = 30;
export const MAX_CALL_MS = 12 * 60_000;
const MAX_TRANSCRIPT = 200;
const MAX_TOOL_ROUNDS = 4;

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function pickDetails(args: Record<string, unknown>): JobDetails {
  const out: JobDetails = {};
  for (const key of ['caller_name', 'callback_number', 'suburb', 'job_type', 'urgency', 'details'] as const) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) out[key] = value.trim().slice(0, 2000);
  }
  return out;
}

export class CallSession {
  readonly businessId: string;
  readonly callSid: string;
  readonly transcript: TranscriptEntry[] = [];
  context: CallContext | null = null;
  ended = false;

  private readonly store: CallStore;
  private readonly chat: Chat | null;
  private readonly now: () => number;
  private readonly startedAt: number;
  private history: ChatMessage[] = [];
  private turns = 0;
  private fallbackStep: number | null = null;
  private fallbackNotes: string[] = [];
  private queue: Promise<unknown> = Promise.resolve();
  private finished = false;

  constructor(options: { businessId: string; callSid: string; store: CallStore; chat: Chat | null; now?: () => number }) {
    this.businessId = options.businessId;
    this.callSid = options.callSid;
    this.store = options.store;
    this.chat = options.chat;
    this.now = options.now ?? Date.now;
    this.startedAt = this.now();
  }

  async start(): Promise<boolean> {
    this.context = await this.store.loadContext(this.businessId, this.callSid);
    if (!this.context) return false;
    this.record('receptionist', welcomeGreeting(this.context.settings));
    return true;
  }

  // Turns are processed one at a time, in order, even if Twilio delivers a
  // new prompt while the previous reply is still being worked out.
  handleCallerText(text: string): Promise<TurnResult> {
    const run = this.queue.then(() => this.turn(text));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private record(role: TranscriptEntry['role'], text: string) {
    this.transcript.push({ role, text: text.slice(0, 1000), at: new Date(this.now()).toISOString() });
    if (this.transcript.length > MAX_TRANSCRIPT) this.transcript.shift();
  }

  private callbackWindow() {
    return this.context?.settings.callback_window || 'as soon as they can';
  }

  private async turn(rawText: string): Promise<TurnResult> {
    const text = rawText.trim().slice(0, 1000);
    if (this.ended) return { reply: 'Thanks for calling. Goodbye.', endCall: true };
    if (!text) return { reply: '', endCall: false };
    this.turns += 1;
    this.record('caller', text);

    let result: TurnResult;
    if (this.turns > MAX_TURNS || this.now() - this.startedAt > MAX_CALL_MS) {
      result = { reply: `I'll need to wrap up now. I've passed everything on, and the team will call you back ${this.callbackWindow()}. Thanks for calling.`, endCall: true };
    } else if (!this.chat || !this.context || this.fallbackStep !== null) {
      result = await this.fallbackTurn(text);
    } else {
      try {
        result = await this.aiTurn(text);
      } catch {
        // The model is unavailable: switch to the scripted message-take for
        // the rest of the call rather than leave the caller hanging.
        result = await this.fallbackTurn(text);
      }
    }
    if (result.endCall) this.ended = true;
    if (result.reply) this.record('receptionist', result.reply);
    return result;
  }

  private async aiTurn(text: string): Promise<TurnResult> {
    const context = this.context!;
    const messages: ChatMessage[] = [
      { role: 'system', content: buildSystemPrompt(context, new Date(this.now())) },
      ...this.history,
      { role: 'user', content: text },
    ];
    let endRequested = false;
    let reply: string | null = null;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const answer = await this.chat!(messages, TOOLS);
      if (!answer.toolCalls.length) {
        reply = answer.content;
        break;
      }
      messages.push({ role: 'assistant', content: answer.content, tool_calls: answer.toolCalls });
      for (const call of answer.toolCalls) {
        let output = 'Unknown tool.';
        if (call.function.name === 'save_job_details') {
          const details = pickDetails(parseArgs(call.function.arguments));
          // Saved before the reply is spoken, so a hang-up straight after
          // still leaves the details for the owner's alert.
          if (Object.keys(details).length) await this.store.saveDetails(this.callSid, details);
          output = 'Saved.';
        } else if (call.function.name === 'end_call') {
          endRequested = true;
          output = 'The call will end after your goodbye.';
        }
        messages.push({ role: 'tool', tool_call_id: call.id, content: output });
      }
      if (endRequested && answer.content?.trim()) {
        reply = answer.content;
        break;
      }
    }

    const finalReply = (reply?.trim()
      || (endRequested ? `Thanks for calling. The team will call you back ${this.callbackWindow()}. Goodbye.` : 'Sorry, could you say that again?')).slice(0, 600);
    this.history.push({ role: 'user', content: text }, { role: 'assistant', content: finalReply });
    this.history = this.history.slice(-24);
    return { reply: finalReply, endCall: endRequested };
  }

  // Scripted message-take used when no model is available: record what the
  // caller says, ask once for name, suburb and number, then hang up politely.
  private async fallbackTurn(text: string): Promise<TurnResult> {
    this.fallbackNotes.push(text);
    await this.store.saveDetails(this.callSid, { details: `Caller said: ${this.fallbackNotes.join(' / ')}`.slice(0, 2000) }).catch(() => undefined);
    if (this.fallbackStep === null) {
      this.fallbackStep = 1;
      return { reply: "Sorry, I can't take full details right now. Please tell me your name, your suburb, and the best number to call you back, and I'll pass it straight to the team.", endCall: false };
    }
    return { reply: `Thanks, I've passed that on. The team will call you back ${this.callbackWindow()}. Goodbye.`, endCall: true };
  }

  // Saves the transcript once, however many call-end paths fire.
  async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    this.ended = true;
    await this.queue.catch(() => undefined);
    await this.store.saveTranscript(this.businessId, this.callSid, this.transcript);
  }
}
