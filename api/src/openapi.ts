import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

export function createOpenApiDocument(app: INestApplication) {
  const options = new DocumentBuilder().setTitle('Futeio API').setDescription('Private football group: player access, profiles, current evaluations and recorded team draws. Browser cookies require exact Origin and CSRF for mutations. Native opaque bearer sessions use the same permissions and revocation. Never combine Cookie and Authorization.').setVersion('0.1.0').addCookieAuth('futeio_session', { type: 'apiKey', in: 'cookie' }, 'session').addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'opaque' }, 'nativeSession').build();
  return SwaggerModule.createDocument(app, options);
}
