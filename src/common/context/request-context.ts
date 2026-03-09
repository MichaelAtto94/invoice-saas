import { AsyncLocalStorage } from 'node:async_hooks';

export type RequestContextStore = {
  userId?: string;
  tenantId?: string;
  tenantSlug?: string;
  role?: 'OWNER' | 'ADMIN' | 'STAFF';
};

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}
