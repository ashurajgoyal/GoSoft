import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { startJobs } from './services/jobs.js';

await connectDB();
const app = createApp();
if (process.env.DISABLE_JOBS !== 'true') startJobs();
const server = app.listen(env.port, () => console.log(`[api] GO SOFT API listening on :${env.port}`));

const shutdown = (sig) => {
  console.log(`[api] ${sig} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
