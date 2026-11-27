import express, { type NextFunction, type Request, type Response } from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { defaultAuthDeps } from './auth';
import { env } from './env';
import { apiRouter, defaultChat, type ApiDeps } from './routes/api';
import { serverReadiness, twilioRouter, type TwilioRouteDeps } from './routes/twilio';

export function createApp(options: { api?: Partial<ApiDeps>; twilio?: TwilioRouteDeps; staticDir?: string | null } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const supabase = env.SUPABASE_URL ? ` ${new URL(env.SUPABASE_URL).origin}` : '';
    res.setHeader('Content-Security-Policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'${supabase}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`);
    next();
  });

  app.use('/api', apiRouter({
    auth: options.api?.auth ?? defaultAuthDeps,
    serverMissing: options.api?.serverMissing ?? (() => serverReadiness().missing),
    chat: options.api?.chat ?? defaultChat,
  }));
  app.use('/twilio', options.twilio ? twilioRouter(options.twilio) : twilioRouter());

  const staticDir = options.staticDir === undefined ? path.resolve('dist') : options.staticDir;
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Single-page app: any other GET serves the dashboard.
    app.get(/^(?!\/(api|twilio)\/).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use((_req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(JSON.stringify({ level: 'error', component: 'http', message: String((error as Error)?.message ?? error).slice(0, 200) }));
    if (!res.headersSent) res.status(500).json({ error: 'SERVER_ERROR', message: 'Something went wrong. Try again.' });
  });
  return app;
}
