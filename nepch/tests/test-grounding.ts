import { nepChan } from '../src/mastra/agents/nep-chan';

async function testGrounding() {
    console.log('Testing Gemini Search Grounding...');

    // Ask a question about current events that requires search
    // "What is the weather in Otoineppu today?" or "Latest news about Mastra AI"
    const query = "今日の音威子府村の天気と、最近のニュースを教えて？";

    console.log(`Query: ${query}`);

    try {
        const result = await nepChan.generate(query);
        console.log('\nResponse:', result.text);

        // Check if tool calls were made (if we want to see if it used search-tool or native)
        // The result object might have info, but generate() returns a simplified response usually.
        // We can check the console output of the server if we were running it there, 
        // but here we are running the agent directly.
        // If useSearchGrounding is working, it might not show up as a tool call in the standard sense 
        // unless Mastra exposes it. 
        // However, if it answers correctly about *today's* weather, it means it searched.

    } catch (error) {
        console.error('Error:', error);
    }
}

testGrounding();
