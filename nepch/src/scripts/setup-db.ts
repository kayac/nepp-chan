import { db } from '../mastra/db';

async function setup() {
  console.log('Setting up database tables...');

  try {
    // Create villagers table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS villagers (
        id TEXT PRIMARY KEY,
        name TEXT,
        attributes TEXT,
        current_concerns TEXT,
        last_seen TEXT,
        summary TEXT
      )
    `);
    console.log('Created villagers table.');

    // Create village_news table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS village_news (
        id TEXT PRIMARY KEY,
        content TEXT,
        category TEXT,
        source_villager_id TEXT,
        created_at TEXT
      )
    `);
    console.log('Created village_news table.');

    // Create conversation_links table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS conversation_links (
        id TEXT PRIMARY KEY,
        source_thread_id TEXT,
        target_thread_id TEXT,
        reason TEXT,
        confidence REAL,
        created_at TEXT
      )
    `);
    console.log('Created conversation_links table.');

  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

setup();
