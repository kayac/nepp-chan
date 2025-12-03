import { searchTool } from '../mastra/tools/search-tool';

async function verifySearch() {
    console.log('Testing search tool with query "Apple"...');
    const result = await searchTool.execute({
        context: { query: 'Apple' },
        suspend: async () => { },
    });

    console.log('Search Results:');
    console.log(JSON.stringify(result, null, 2));

    const results = result.results || [];
    if (results.length === 0) {
        console.warn('No results found.');
        return;
    }

    const japaneseRegex = /[ぁ-んァ-ン一-龯]/;
    const hasJapanese = results.some((r: any) => japaneseRegex.test(r.title) || japaneseRegex.test(r.snippet));

    if (hasJapanese) {
        console.log('SUCCESS: Found Japanese characters in search results.');
    } else {
        console.warn('WARNING: No Japanese characters found in search results. Check if results are localized.');
    }
}

verifySearch();
