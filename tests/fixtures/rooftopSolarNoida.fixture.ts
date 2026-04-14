import { test as base } from '@playwright/test';
import { RooftopSolarNoidaPage } from '../pages/RooftopSolarNoidaPage';

type Fixtures = { noidaPage: RooftopSolarNoidaPage };

export const test = base.extend<Fixtures>({
  noidaPage: async ({ page }, use) => {
    const p = new RooftopSolarNoidaPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
