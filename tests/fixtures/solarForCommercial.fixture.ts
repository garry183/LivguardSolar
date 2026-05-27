import { test as base } from '@playwright/test';
import { SolarForCommercialPage } from '../pages/SolarForCommercialPage';
import { blockThirdPartyScripts } from '../utils/visualHelpers';

type Fixtures = { solarForCommercialPage: SolarForCommercialPage };

export const test = base.extend<Fixtures>({
  solarForCommercialPage: async ({ page }, use) => {
    await blockThirdPartyScripts(page);
    const p = new SolarForCommercialPage(page);
    await p.goto();
    await use(p);
  },
});

export { expect } from '@playwright/test';
