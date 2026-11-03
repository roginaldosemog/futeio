import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client';

export type LoadedSession = Prisma.AccessSessionGetPayload<{ include: { membership: { include: { identity: true } } } }>;
export interface BrowserContext { session: LoadedSession; token: string }
export interface AccessContext { identityId: string; groupId: string; role: 'ADMIN' | 'PLAYER'; sessionId: string }
export interface AccessRequest extends Request { browser?: BrowserContext; accessContext?: AccessContext }
