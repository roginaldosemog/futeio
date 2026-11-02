import { requireTestDatabaseUrl } from '../scripts/test-database.cjs';

describe('Integration database isolation', () => {
  const development = 'postgresql://user:development@127.0.0.1:5432/futeio';
  const testDatabase = 'postgresql://user:testing@127.0.0.1:5433/futeio_test';

  it('accepts a separate test database', () => {
    expect(
      requireTestDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: testDatabase }),
    ).toBe(testDatabase);
  });

  it('requires an explicit test connection', () => {
    expect(() => requireTestDatabaseUrl({ DATABASE_URL: development })).toThrow();
  });

  it('requires an explicit development connection for the isolation check', () => {
    expect(() => requireTestDatabaseUrl({ TEST_DATABASE_URL: testDatabase })).toThrow();
  });

  it('rejects a database without the test suffix', () => {
    expect(() =>
      requireTestDatabaseUrl({ DATABASE_URL: development, TEST_DATABASE_URL: development }),
    ).toThrow();
  });

  it('rejects the same database even when passwords or query parameters differ', () => {
    expect(() =>
      requireTestDatabaseUrl({
        DATABASE_URL: testDatabase,
        TEST_DATABASE_URL: `${testDatabase}?schema=public`,
      }),
    ).toThrow();
  });

  it('rejects a non-PostgreSQL URL without exposing its password', () => {
    const password = 'private-configuration-value';
    try {
      requireTestDatabaseUrl({
        DATABASE_URL: development,
        TEST_DATABASE_URL: `https://user:${password}@localhost/futeio_test`,
      });
      throw new Error('Expected invalid database configuration to be rejected.');
    } catch (error) {
      expect(String(error)).not.toContain(password);
      expect(String(error)).toContain('PostgreSQL');
    }
  });
});
