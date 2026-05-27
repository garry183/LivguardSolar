import { test as base } from '@playwright/test';
import { SolarForHomePage } from '../pages/SolarForHomePage';
import { blockThirdPartyScripts } from '../utils/visualHelpers';

type Fixtures = { solarForHomePage: SolarForHomePage };

export const test = base.extend<Fixtures>({
  solarForHomePage: async ({ page }, use) => {
    await blockThirdPartyScripts(page);
    const p = new SolarForHomePage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
