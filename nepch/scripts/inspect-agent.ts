import { nepChan } from '../src/mastra/agents/nep-chan';

console.log('Agent keys:', Object.keys(nepChan));
console.log('Agent prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(nepChan)));

// Check listTools
try {
    const tools = (nepChan as any).listTools();
    console.log('listTools() result:', tools);
} catch (e) {
    console.error('listTools() error:', e);
}
