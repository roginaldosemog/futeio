import { loadEnvironment } from './environment';

describe('API environment configuration', () => {
  const databaseUrl = 'postgresql://futeio:local@127.0.0.1:5432/futeio';

  it('accepts a PostgreSQL URL and uses local development defaults', () => {
    expect(loadEnvironment({ DATABASE_URL: databaseUrl })).toEqual({
      databaseUrl,
      port: 3001,
      host: '127.0.0.1',
    });
  });

  it('accepts an explicit valid port and host', () => {
    expect(
      loadEnvironment({
        DATABASE_URL: databaseUrl,
        API_PORT: '4001',
        API_HOST: '0.0.0.0',
      }),
    ).toMatchObject({ port: 4001, host: '0.0.0.0' });
  });

  it.each([undefined, '', 'not-a-url', 'https://example.com/futeio', 'postgresql://localhost/'])(
    'rejects a missing or invalid PostgreSQL connection URL without disclosing it',
    (value) => {
      expect(() => loadEnvironment({ DATABASE_URL: value })).toThrow(
        'DATABASE_URL must be a valid PostgreSQL connection URL with a database name.',
      );
    },
  );

  it.each(['0', '65536', '-1', '7.5', 'abc', ''])('rejects an invalid port %p', (port) => {
    expect(() => loadEnvironment({ DATABASE_URL: databaseUrl, API_PORT: port })).toThrow(
      'API_PORT must be an integer between 1 and 65535.',
    );
  });

  it('does not include credentials in a configuration error', () => {
    const secret = 'a-private-database-password';
    expect(() =>
      loadEnvironment({ DATABASE_URL: `https://user:${secret}@localhost/futeio` }),
    ).toThrow(
      'DATABASE_URL must be a valid PostgreSQL connection URL with a database name.',
    );
    try {
      loadEnvironment({ DATABASE_URL: `https://user:${secret}@localhost/futeio` });
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });

  it('rejects an empty host', () => {
    expect(() => loadEnvironment({ DATABASE_URL: databaseUrl, API_HOST: ' ' })).toThrow(
      'API_HOST must not be empty.',
    );
  });
});
