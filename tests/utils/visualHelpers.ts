import { Page } from '@playwright/test';

/** Freeze all CSS animations and transitions for deterministic snapshots. */
export async function freezeAnimations(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/** Scroll the full page to trigger lazy-loaded images and sections. */
export async function triggerLazyLoad(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 400;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          // Do NOT scroll back to top: sections mounted by IntersectionObserver
          // will unmount if the page returns to the top before scrollToSection
          // can find them. Keeping the scroll position near the bottom ensures
          // all sections remain in the DOM for the subsequent scrollToSection call.
          resolve();
        }
      }, 500);
    });
  });
  await page.waitForTimeout(1000);
}

/** Wait for all images matching selector to finish loading. */
export async function waitForAllImages(
  page: Page,
  selector = 'img',
): Promise<void> {
  await page.evaluate(async (sel) => {
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>(sel));
    await Promise.all(
      imgs.map(
        (img) =>
          img.complete
            ? Promise.resolve()
            : new Promise((resolve) => {
                img.onload = resolve;
                img.onerror = resolve;
                // Fallback so a single stalled image never blocks the test
                setTimeout(resolve, 8000);
              }),
      ),
    );
  }, selector);
}

/** Build a consistent, filename-safe snapshot name. */
export function snapshotName(...parts: string[]): string {
  return (
    parts
      .join('-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') + '.png'
  );
}

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} as const;
