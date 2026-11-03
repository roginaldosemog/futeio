import { Injectable } from '@nestjs/common';
import { setTimeout } from 'node:timers/promises';

export const AUTH_CLOCK = Symbol('AUTH_CLOCK');
export interface Clock { now(): Date; sleep(milliseconds: number): Promise<void> }
@Injectable()
export class SystemClock implements Clock {
  now(): Date { return new Date(); }
  async sleep(milliseconds: number): Promise<void> { if (milliseconds > 0) await setTimeout(milliseconds); }
}
