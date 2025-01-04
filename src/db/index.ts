import 'dotenv/config';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const client = createClient({ 
  url: process.env.NEXT_PUBLIC_TURSO_DATABASE_URL!, 
  authToken: process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN!
});

export const db = drizzle(client, { schema });