import { test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { blockThirdPartyScripts } from '../utils/visualHelpers';

type Fixtures = {
  homePage: HomePage;
};

export const test = base.extend<Fixtures>({
  homePage: async ({ page }, use) => {
    await blockThirdPartyScripts(page);
    const homePage = new HomePage(page);
    await homePage.goto();
    await use(homePage);
  },
});

export { expect } from '@playwright/test';
