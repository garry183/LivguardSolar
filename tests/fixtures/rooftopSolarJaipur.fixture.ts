import { test as base } from '@playwright/test';
import { RooftopSolarJaipurPage } from '../pages/RooftopSolarJaipurPage';
import { blockThirdPartyScripts } from '../utils/visualHelpers';

type Fixtures = { jaipurPage: RooftopSolarJaipurPage };

export const test = base.extend<Fixtures>({
  jaipurPage: async ({ page }, use) => {
    await blockThirdPartyScripts(page);
    const p = new RooftopSolarJaipurPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
