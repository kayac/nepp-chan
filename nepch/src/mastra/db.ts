import { createClient } from '@libsql/client';
import path from 'path';

const dbPath = process.cwd().endsWith(path.join('.mastra', 'output'))
    ? 'file:../../local.db'
    : `file:${path.resolve(process.cwd(), 'local.db')}`;

export const connectionUrl = dbPath;

export const db = createClient({
    url: connectionUrl,
});
