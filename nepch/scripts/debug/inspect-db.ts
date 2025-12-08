import { db } from '../src/mastra/db';

async function main() {
    console.log('Listing tables...');
    const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', tables.rows);

    for (const row of tables.rows) {
        const tableName = row.name as string;
        if (tableName.includes('message') || tableName.includes('thread')) {
            console.log(`\nSchema for ${tableName}:`);
            const schema = await db.execute(`PRAGMA table_info(${tableName})`);
            console.log(schema.rows);

            // Check row count
            const count = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
            console.log(`Row count:`, count.rows[0]);
        }
    }
}

main().catch(console.error);
