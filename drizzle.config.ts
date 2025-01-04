import { defineConfig } from 'drizzle-kit';

const dbUrl = process.env.NEXT_PUBLIC_TURSO_DATABASE_URL;
const authToken = process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN;

if (!dbUrl || !authToken) {
    throw new Error('Database URL or Auth Token is missing in environment variables.');
}

export default defineConfig({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'turso',
    dbCredentials: {
        url: dbUrl,
        authToken: authToken,
    },
});