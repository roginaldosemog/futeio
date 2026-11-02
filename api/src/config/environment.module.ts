import { Module } from '@nestjs/common';
import { loadEnvironment } from './environment';

export const API_ENVIRONMENT = Symbol('API_ENVIRONMENT');

@Module({
  providers: [
    {
      provide: API_ENVIRONMENT,
      useFactory: () => loadEnvironment(process.env),
    },
  ],
  exports: [API_ENVIRONMENT],
})
export class EnvironmentModule {}
