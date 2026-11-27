// Loaded before every test file (see the "test" script) so server modules
// read predictable configuration. No real credentials are used anywhere.
process.env.NODE_ENV = 'test';
process.env.APP_URL = 'https://callhand.test';
process.env.CALL_TOKEN_SECRET = 'test-secret-'.padEnd(48, 'x');
process.env.TWILIO_ACCOUNT_SID = `AC${'0'.repeat(32)}`;
process.env.TWILIO_AUTH_TOKEN = 'test-auth-token-'.padEnd(32, 'y');
process.env.TWILIO_PHONE_NUMBER = '+61255550000';
process.env.OPENAI_API_KEY = '';
process.env.SUPABASE_URL = '';
process.env.SUPABASE_ANON_KEY = '';
process.env.SUPABASE_SERVICE_ROLE_KEY = '';
