export interface ApiEnvironment {
  databaseUrl: string;
  port: number;
  host: string;
}

export function loadEnvironment(environment: NodeJS.ProcessEnv): ApiEnvironment {
  const databaseUrl = environment.DATABASE_URL;
  let parsedUrl: URL;

  try {
    if (!databaseUrl) {
      throw new Error();
    }
    parsedUrl = new URL(databaseUrl);
    const database = decodeURIComponent(parsedUrl.pathname.slice(1));
    if (
      !['postgres:', 'postgresql:'].includes(parsedUrl.protocol) ||
      !parsedUrl.hostname ||
      !database ||
      database.includes('/')
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(
      'DATABASE_URL must be a valid PostgreSQL connection URL with a database name.',
    );
  }

  const portValue = environment.API_PORT ?? '3001';
  const port = Number(portValue);
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('API_PORT must be an integer between 1 and 65535.');
  }

  const host = (environment.API_HOST ?? '127.0.0.1').trim();
  if (!host) {
    throw new Error('API_HOST must not be empty.');
  }

  return { databaseUrl, port, host };
}
