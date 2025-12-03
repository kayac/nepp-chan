import { db } from '../mastra/db';

async function checkLinks() {
    console.log('Checking conversation_links table...');
    try {
        const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('Tables:', tables.rows.map(r => r.name));

        const schema = await db.execute("PRAGMA table_info(memory_messages_768)");
        console.log('Schema for memory_messages_768:', schema.rows);

        const result = await db.execute('SELECT * FROM conversation_links');
        console.log(`Found ${result.rows.length} links.`);
        result.rows.forEach(row => {
            console.log(`- Link: ${row.source_thread_id} -> ${row.target_thread_id} (Confidence: ${row.confidence})`);
            console.log(`  Reason: ${row.reason}`);
        });
    } catch (error) {
        console.error('Error checking links:', error);
    }
}

checkLinks();
