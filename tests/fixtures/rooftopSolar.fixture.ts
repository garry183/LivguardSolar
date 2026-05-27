import { test as base } from '@playwright/test';
import { RooftopSolarPage } from '../pages/RooftopSolarPage';
import { blockThirdPartyScripts } from '../utils/visualHelpers';

type Fixtures = { rooftopSolarPage: RooftopSolarPage };

export const test = base.extend<Fixtures>({
  rooftopSolarPage: async ({ page }, use) => {
    await blockThirdPartyScripts(page);
    const p = new RooftopSolarPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
