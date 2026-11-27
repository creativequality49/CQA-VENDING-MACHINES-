// Server configuration. Missing provider keys never crash the server: each
// feature reports itself as not ready and fails closed instead (a call gets a
// polite "can't take calls right now" message rather than a broken line).
import { existsSync, readFileSync } from 'node:fs';

// Minimal .env loader so `npm run dev` works without extra tooling. Real
// environment variables always win.
if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
}

const read = (key: string, fallback = '') => (process.env[key] ?? fallback).trim();

export const env = {
  NODE_ENV: read('NODE_ENV', 'development'),
  PORT: Number(read('PORT', '3000')) || 3000,
  APP_URL: read('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  SUPABASE_URL: read('SUPABASE_URL'),
  SUPABASE_ANON_KEY: read('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: read('SUPABASE_SERVICE_ROLE_KEY'),
  TWILIO_ACCOUNT_SID: read('TWILIO_ACCOUNT_SID'),
  TWILIO_AUTH_TOKEN: read('TWILIO_AUTH_TOKEN'),
  TWILIO_PHONE_NUMBER: read('TWILIO_PHONE_NUMBER'),
  OPENAI_API_KEY: read('OPENAI_API_KEY'),
  OPENAI_MODEL: read('OPENAI_MODEL', 'gpt-5-mini'),
  CALL_TOKEN_SECRET: read('CALL_TOKEN_SECRET'),
};

export const isProduction = env.NODE_ENV === 'production';

export function supabaseConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_ANON_KEY);
}
export function serviceRoleConfigured() {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}
export function openaiConfigured() {
  return env.OPENAI_API_KEY.length >= 20;
}
export function callTokenConfigured() {
  return env.CALL_TOKEN_SECRET.length >= 32;
}
export function publicHttps() {
  return env.APP_URL.startsWith('https://');
}
