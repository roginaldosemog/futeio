import { expect, type Page } from './fixtures';

const emulatorHandler = 'http://127.0.0.1:9299/emulator/auth/handler';

export async function openGoogleAccountPicker(page: Page) {
  // The emulator loads optional Material styling, fonts and ripple effects
  // before binding its account buttons. Keep the Firebase relay and SDK live.
  await page.context().route(
    /^https:\/\/(?:unpkg\.com\/material-components-web@10\/dist\/|fonts\.googleapis\.com\/)/,
    route => {
      const frameUrl = new URL(route.request().frame().url());
      return frameUrl.origin + frameUrl.pathname === emulatorHandler ? route.abort() : route.fallback();
    },
  );
  const button = page.getByRole('button', { name: 'Entrar com Google', exact: true });
  await expect(button).toBeEnabled({ timeout: 30_000 });
  const opened = page.waitForEvent('popup');
  await button.click();
  const popup = await opened;
  // Visible account rows precede their click listeners in the widget HTML.
  await popup.waitForURL(url => url.origin + url.pathname === emulatorHandler, { waitUntil: 'domcontentloaded' });
  return popup;
}
