export const TEST_ADMIN_EMAIL: string;
export const TEST_ADMIN_PASSWORD: string;
export function createAdminFixture(origin?: string): {
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD_HASH: string;
  AUTH_SECRET: string;
  APP_ORIGIN: string;
};
