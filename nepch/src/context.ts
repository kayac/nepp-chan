import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
    threadId: string;
    resourceId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
