import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);
// Never let a query silently match everything because a filter key was misspelt.
mongoose.set('strictPopulate', true);

export async function connectDB(uri = env.mongoUri) {
  await mongoose.connect(uri, { autoIndex: !env.isProd });
  console.log(`[db] connected to ${mongoose.connection.name}`);
  return mongoose.connection;
}
