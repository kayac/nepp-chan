import { memory, storage } from '../src/mastra/memory';

console.log('Memory keys:', Object.keys(memory));
console.log('Memory prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(memory)));

console.log('Storage keys:', Object.keys(storage));
console.log('Storage prototype keys:', Object.getOwnPropertyNames(Object.getPrototypeOf(storage)));

// Check for specific methods
const methodsToCheck = ['getMessages', 'listMessages', 'getMessagesByThreadId', 'listMessagesByThreadId'];
methodsToCheck.forEach(m => {
    if ((memory as any)[m]) console.log(`memory.${m} exists`);
    if ((storage as any)[m]) console.log(`storage.${m} exists`);
});
