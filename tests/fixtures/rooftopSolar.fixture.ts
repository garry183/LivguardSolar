import { test as base } from '@playwright/test';
import { RooftopSolarPage } from '../pages/RooftopSolarPage';

type Fixtures = { rooftopSolarPage: RooftopSolarPage };

export const test = base.extend<Fixtures>({
  rooftopSolarPage: async ({ page }, use) => {
    const p = new RooftopSolarPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
