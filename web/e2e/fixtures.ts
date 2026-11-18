import { expect, test as base } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export { expect } from '@playwright/test';
export type { Page } from '@playwright/test';

// Verify the browser used by the journeys, not Playwright's bundled executablePath().
export const test = base.extend<{ rateLimitIsolation: void }, { quotaDatabase: Firestore }>({
  quotaDatabase: [async ({ browserName }, provide) => {
    if (browserName !== 'chromium' || process.env.FUTEIO_E2E_ISOLATED !== '1' || process.env.FUTEIO_FIREBASE_MODE !== 'emulator' || process.env.FIREBASE_PROJECT_ID !== 'demo-futeio-test' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8280') {
      throw new Error('Quota isolation only runs in the owned demo test emulator. Use pnpm test:e2e.');
    }
    const app = initializeApp({ projectId: 'demo-futeio-test' }, 'futeio-browser-fixture');
    try { await provide(getFirestore(app)); }
    finally { await deleteApp(app); }
  }, { scope: 'worker' }],
  rateLimitIsolation: [async ({ quotaDatabase }, use) => {
    // Journeys exercise independent logins; limit enforcement has integration coverage.
    await quotaDatabase.recursiveDelete(quotaDatabase.collection('rateLimits'));
    await use(undefined);
  }, { auto: true }],
  browser: [async ({ browser, channel, launchOptions }, use) => {
    expect(channel, 'E2E must use the installed stable Google Chrome channel.').toBe('chrome');
    expect(launchOptions.chromiumSandbox, 'E2E must request the Chromium sandbox.').toBe(true);
    expect(launchOptions.executablePath, 'Do not override the Chrome channel executable.').toBeUndefined();

    const diagnostics = await browser.newContext();
    try {
      // Browser.getBrowserCommandLine requires --enable-automation, which this
      // Playwright version does not set. Keep launch arguments unchanged.
      const page = await diagnostics.newPage();
      await page.goto('chrome://version');
      const executableField = page.locator('#executable_path');
      await expect(executableField).toHaveText(/\S/);
      const executable = (await executableField.innerText()).trim().replaceAll('\\', '/');
      const commandLineField = page.locator('#command_line');
      await expect(commandLineField).toHaveText(/\S/);
      const commandLine = await commandLineField.innerText();
      const installedChrome = /\/Google\/Chrome\/Application\/chrome\.exe$/i.test(executable)
        || executable === '/opt/google/chrome/chrome'
        || /\/Google Chrome\.app\/Contents\/MacOS\/Google Chrome$/.test(executable);
      expect(installedChrome, 'The running executable must be the installed Google Chrome.').toBe(true);
      const unsafeFlags = [...commandLine.matchAll(/(?:^|[\s"])(--(?:no-sandbox|disable-setuid-sandbox|disable-gpu-sandbox|disable-seccomp-filter-sandbox|disable-namespace-sandbox|no-zygote-sandbox))(?=[=\s"]|$)/g)].map((match) => match[1]);
      expect(unsafeFlags, 'The browser must not disable its OS sandbox.').toEqual([]);
      console.log(`[browser-policy] ${JSON.stringify({ executable, version: browser.version(), channel, chromiumSandbox: launchOptions.chromiumSandbox, sandboxDisablingFlags: unsafeFlags })}`);
    } finally {
      await diagnostics.close();
    }
    await use(browser);
  }, { scope: 'worker' }],
});
