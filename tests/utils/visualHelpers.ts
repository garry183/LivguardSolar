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
      /* Hide scrollbars so their width never affects element screenshot dimensions.
         Without this, a visible scrollbar (e.g. ~4 px on Windows Chromium) shifts
         all element widths, causing spurious dimension mismatches in baselines. */
      ::-webkit-scrollbar { width: 0 !important; height: 0 !important; }
      html { scrollbar-width: none !important; }
    `,
  });
  // Pause videos and stop all JS timers (carousels, counters, auto-sliding) so
  // screenshots are deterministic regardless of how long the page has been running.
  // Interval IDs are sequential from 1; clearing up to the highest current ID
  // stops every running setInterval/setTimeout in the page.
  await page.evaluate(() => {
    document.querySelectorAll<HTMLVideoElement>('video').forEach(v => v.pause());
    const maxId = window.setTimeout(() => {}, 0) as unknown as number;
    for (let id = 1; id <= maxId; id++) {
      window.clearInterval(id);
      window.clearTimeout(id);
    }
    // Cancel all pending requestAnimationFrame callbacks (Lottie, GSAP, scroll-driven
    // path animations) and prevent new ones so screenshots are frame-deterministic.
    const maxRafId = window.requestAnimationFrame(() => {});
    for (let id = 1; id <= maxRafId; id++) {
      window.cancelAnimationFrame(id);
    }
    window.requestAnimationFrame = () => 0;
  });
}

/** Scroll the full page to trigger lazy-loaded images and sections. */
export async function triggerLazyLoad(page: Page): Promise<void> {
  // CTA modal sets body{overflow:hidden} on load, silently breaking all scrollBy calls.
  await page.evaluate(() => { document.body.style.overflow = ''; });
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const distance = 400;
      // scrollHeight grows as IO-mounted sections render into the DOM.
      // The old check (totalHeight >= scrollHeight) terminated too early when new
      // sections added height after we scrolled past them, producing a truncated page.
      // New strategy: keep scrolling until we are at the actual bottom AND scrollHeight
      // has been stable for 4 consecutive 500 ms ticks (= 2 s), or a 45 s hard timeout.
      let lastHeight = document.body.scrollHeight;
      let stableCount = 0;
      const deadline = Date.now() + 45_000;
      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        const atBottom =
          window.scrollY + window.innerHeight >= document.body.scrollHeight - 50;
        if (atBottom) {
          if (document.body.scrollHeight === lastHeight) {
            stableCount++;
          } else {
            lastHeight = document.body.scrollHeight;
            stableCount = 0;
          }
          if (stableCount >= 4 || Date.now() > deadline) {
            clearInterval(timer);
            resolve();
          }
        } else {
          // Not at bottom yet — height may have grown; reset stability counter.
          lastHeight = document.body.scrollHeight;
          stableCount = 0;
        }
      }, 500);
    });
  });
  // Extra dwell at the bottom: IntersectionObserver callbacks fire asynchronously
  // and async API fetches for late-page sections (Portfolio, FAQ, footer) need time
  // to resolve before scrollToSection checks their DOM presence.
  await page.waitForTimeout(2000);
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

/**
 * Reset the hero section's Swiper carousel to slide 0 so hero snapshots are
 * deterministic regardless of how long the carousel ran before freezeAnimations fired.
 * Call AFTER freezeAnimations so transition-duration:0s makes the jump instant.
 *
 * Scoped to the first child of <main> only — calling slideTo on page-level or footer
 * Swipers scrolls the viewport away from the hero.
 */
export async function resetCarouselToFirst(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Scoped to the hero (first direct child of <main>) to avoid scrolling the
    // viewport via page-level or footer Swipers. Mobile carousel is pure React
    // with no Swiper API — hero section is masked in mobile hero tests instead.
    const hero = document.querySelector<HTMLElement>('main > *:first-child');
    if (!hero) return;
    Array.from(hero.querySelectorAll<any>('*'))
      .filter(el => el.swiper?.slideTo)
      .forEach(el => {
        const sw = el.swiper;
        if (sw.params?.loop && sw.slideToLoop) {
          sw.slideToLoop(0, 0);
        } else {
          sw.slideTo(0, 0);
        }
      });
  });
  await page.waitForTimeout(100);
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
