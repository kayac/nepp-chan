
import { InitService } from '../src/mastra/services/InitService';

async function main() {
    console.log('Starting system initialization...');
    const initService = new InitService();

    try {
        console.log('Initializing Database Tables...');
        const dbResult = await initService.initializeDatabase();
        if (dbResult.success) {
            console.log('✅ Database initialized.');
        } else {
            console.error('❌ Database initialization failed:', dbResult.message);
        }

        console.log('Generating Knowledge Embeddings...');
        const embedResult = await initService.generateEmbeddings();
        if (embedResult.success) {
            console.log('✅ Embeddings generated:', embedResult.message);
        } else {
            console.error('❌ Embedding generation failed:', embedResult.message);
        }
    } catch (error) {
        console.error('Fatal error during initialization:', error);
        process.exit(1);
    }
}

main();
