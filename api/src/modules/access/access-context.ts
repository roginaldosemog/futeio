import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client';

export const SESSION_INCLUDE = { membership: { include: { identity: true, player: { select: { id: true } } } }, playerCredential: { include: { player: { select: { id: true, identityId: true } } } } } as const;
export type LoadedSession = Prisma.AccessSessionGetPayload<{ include: typeof SESSION_INCLUDE }>;
export interface BrowserContext { session: LoadedSession; token: string }
export interface AccessContext { identityId: string; groupId: string; role: 'ADMIN' | 'PLAYER'; sessionId: string }
export interface AccessRequest extends Request { browser?: BrowserContext; accessContext?: AccessContext }
