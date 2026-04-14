import { test as base } from '@playwright/test';
import { RooftopSolarJaipurPage } from '../pages/RooftopSolarJaipurPage';

type Fixtures = { jaipurPage: RooftopSolarJaipurPage };

export const test = base.extend<Fixtures>({
  jaipurPage: async ({ page }, use) => {
    const p = new RooftopSolarJaipurPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
