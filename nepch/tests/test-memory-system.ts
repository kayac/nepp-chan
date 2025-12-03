import { PersonaService } from '../src/mastra/services/PersonaService';
import { NewsService } from '../src/mastra/services/NewsService';
import { v4 as uuidv4 } from 'uuid';

async function test() {
    console.log('Starting Memory System Test...');

    const personaService = new PersonaService();
    const newsService = new NewsService();

    // Test Persona
    const userId = uuidv4();
    console.log(`\nTesting Persona for User ID: ${userId}`);

    await personaService.savePersona({
        id: userId,
        name: 'Test User',
        attributes: { age: 30, occupation: 'Engineer' },
        current_concerns: { health: 'Back pain' },
        summary: 'A test user with back pain.'
    });
    console.log('Saved persona.');

    const persona = await personaService.getPersona(userId);
    console.log('Retrieved persona:', persona);

    if (persona?.name === 'Test User' && persona.attributes.age === 30) {
        console.log('Persona test PASSED.');
    } else {
        console.error('Persona test FAILED.');
    }

    // Test News
    console.log('\nTesting News...');
    const newsId = await newsService.addNews('Bear sighted near the river', 'NEWS', userId);
    console.log(`Added news with ID: ${newsId}`);

    const recentNews = await newsService.getRecentNews(1);
    console.log('Retrieved recent news:', recentNews);

    if (recentNews.length > 0 && recentNews[0].content === 'Bear sighted near the river') {
        console.log('News test PASSED.');
    } else {
        console.error('News test FAILED.');
    }
}

test();
