
import { storage } from '../src/mastra/memory';

async function main() {
    console.log('Storage keys:', Object.keys(storage));
    console.log('Storage prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(storage)));

    if (storage.getMessages) console.log('storage.getMessages exists');
    if (storage.listMessages) console.log('storage.listMessages exists');
}

main().catch(console.error);
