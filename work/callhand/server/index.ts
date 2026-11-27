import http from 'node:http';
import { createApp } from './app';
import { attachRelay } from './calls/relay';
import { env } from './env';
import { serverReadiness } from './routes/twilio';

const server = http.createServer(createApp());
attachRelay(server);

server.listen(env.PORT, () => {
  const readiness = serverReadiness();
  console.log(JSON.stringify({
    level: 'info', component: 'server', message: `Callhand listening on ${env.PORT}`,
    readyForCalls: readiness.ok, missing: readiness.missing,
  }));
});
