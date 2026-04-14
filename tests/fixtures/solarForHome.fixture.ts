import { test as base } from '@playwright/test';
import { SolarForHomePage } from '../pages/SolarForHomePage';

type Fixtures = { solarForHomePage: SolarForHomePage };

export const test = base.extend<Fixtures>({
  solarForHomePage: async ({ page }, use) => {
    const p = new SolarForHomePage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
