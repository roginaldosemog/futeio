import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function createOpenApiDocument(app: INestApplication) {
  const options = new DocumentBuilder().setTitle('Futeio API').setDescription('Private football group: player access, profiles, current evaluations and recorded team draws.').setVersion('0.1.0').addCookieAuth('futeio_session', { type: 'apiKey', in: 'cookie' }, 'session').build();
  return SwaggerModule.createDocument(app, options);
}
