function parseConnection(value) {
  let url;
  let database;
  try {
    url = new URL(value);
    database = decodeURIComponent(url.pathname.slice(1));
  } catch {
    throw new Error('Database configuration must use valid PostgreSQL connection URLs.');
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !url.hostname ||
    !database ||
    database.includes('/')
  ) {
    throw new Error('Database configuration must use valid PostgreSQL connection URLs.');
  }

  const hostname = url.hostname.toLowerCase();
  const host = ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? 'loopback' : hostname;
  return { database, identity: `${host}:${url.port || '5432'}/${database}` };
}

function requireTestDatabaseUrl(environment) {
  const value = environment.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required for integration tests.');
  }
  if (!environment.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to verify test database isolation.');
  }

  const testConnection = parseConnection(value);
  const applicationConnection = parseConnection(environment.DATABASE_URL);
  if (
    !testConnection.database.endsWith('_test') ||
    testConnection.identity === applicationConnection.identity
  ) {
    throw new Error(
      'Integration tests require a separate PostgreSQL database ending in _test.',
    );
  }

  return value;
}

module.exports = { requireTestDatabaseUrl };
