/**
 * Plate configurator check (see .claude/skills/visual-qa): drives /configure at a phone and a desktop
 * size, takes a screenshot of every state, and records what a screenshot cannot show.
 *
 *   bunx vite --host 127.0.0.1 --port 5173                       # dev server, in another shell
 *   node scripts/render/plates.cjs <outDir> [baseUrl] [phone|desktop|both]
 *
 * States: initial load, a paint change, every view that is pictured, a catalogue wheel and another
 * finish, an option that is not pictured yet, the summary (top and price card), a reload of the address,
 * and the two failure paths (the manifest cannot be loaded; one plate cannot be loaded).
 * Writes <outDir>/<size>-NN-<state>.png and <outDir>/<size>.log.
 *
 * The log reports, and the script exits 1 on: a page error, a WebGL context, a request for three.js,
 * horizontal overflow, a failed step. It also lists layout shift, long tasks, small touch targets and
 * the address after each step.
 *
 * Supabase writes are answered here, never sent: a run must not save a build or create a lead (each
 * lead emails the owner). No form is ever submitted.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const [, , OUT, BASE = 'http://127.0.0.1:5173', WHICH = 'both'] = process.argv;
if (!OUT) {
  console.error('usage: node scripts/render/plates.cjs <outDir> [baseUrl] [phone|desktop|both]');
  process.exit(2);
}
const SIZES = { phone: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desktop: { width: 1440, height: 900 } };
const STAGE = '[data-plate-stage]';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // no GPU flags: the page must not need one
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let failed = false;

  for (const name of Object.keys(SIZES)) {
    if (WHICH !== 'both' && WHICH !== name) continue;
    const { width, height, ...device } = SIZES[name];
    const context = await browser.newContext({ viewport: { width, height }, ...device });
    const log = [];
    const started = Date.now();
    const note = (line) => {
      log.push(`${((Date.now() - started) / 1000).toFixed(1)}s  ${line}`);
      console.log(name, line);
    };
    const problem = (line) => {
      failed = true;
      note(`PROBLEM ${line}`);
    };

    const requests = [];
    const watch = async (page) => {
      page.on('pageerror', (error) => problem(`page error: ${error.message}`));
      page.on('console', (message) => {
        const text = message.text();
        if (message.type() === 'error' && !/ERR_CERT|Failed to load resource|ERR_NAME|net::/.test(text)) note(`console.error ${text.slice(0, 200)}`);
        if (/^Plates/.test(text)) note(`console.${message.type()} ${text.slice(0, 200)}`);
      });
      page.on('request', (request) => requests.push(request.url()));
      await page.addInitScript(() => {
        window.__longTasks = [];
        window.__layoutShift = 0;
        window.__webglContexts = 0;
        try {
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__longTasks.push(Math.round(entry.duration)); }).observe({ type: 'longtask', buffered: true });
          new PerformanceObserver((list) => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__layoutShift += entry.value; }).observe({ type: 'layout-shift', buffered: true });
        } catch {}
        const getContext = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
          if (/webgl/i.test(String(kind))) window.__webglContexts++;
          return getContext.call(this, kind, ...rest);
        };
      });
      // a test run never writes to the live database: saved builds and leads are answered here
      await page.route(/supabase\.co\//, (route) => (['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })));
    };

    const page = await context.newPage();
    await watch(page);
    let shot = 0;
    const screenshot = async (p, tag) => p.screenshot({ path: path.join(OUT, `${name}-${String(++shot).padStart(2, '0')}-${tag}.png`), timeout: 120000 });
    const shown = (p) => p.locator(STAGE).first().getAttribute('data-plate-stage');
    /** Waits until the stage shows a plate whose path contains `part`, and the swap has finished fading. */
    const waitShown = async (p, part) => {
      await p.waitForFunction(([selector, wanted]) => (document.querySelector(selector)?.getAttribute('data-plate-stage') || '').includes(wanted), [STAGE, part], { timeout: 60000 });
      await p.waitForTimeout(500);
    };
    const step = async (tag, run, p = page) => {
      const before = Date.now();
      try {
        await run();
      } catch (error) {
        problem(`${tag}: FAILED ${String(error.message).split('\n')[0]}`);
        await screenshot(p, `${tag}-FAIL`).catch(() => {});
        return false;
      }
      const url = new URL(p.url());
      note(`${tag}: ${Date.now() - before} ms  ${url.pathname}${url.search}`);
      await screenshot(p, tag);
      return true;
    };
    const overflow = async (tag, p = page) => {
      const wide = await p.evaluate(() => {
        const out = [];
        for (const element of document.querySelectorAll('body *')) {
          const box = element.getBoundingClientRect();
          if (box.width > 0 && (box.right > window.innerWidth + 1 || box.left < -1) && getComputedStyle(element).position !== 'fixed') out.push(`${element.tagName.toLowerCase()}.${String(element.className).slice(0, 50)}`);
          if (out.length > 8) break;
        }
        return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, out };
      });
      if (wide.scrollWidth > wide.innerWidth || wide.out.length) problem(`overflow (${tag}): scrollWidth ${wide.scrollWidth} vs ${wide.innerWidth}; ${wide.out.join(' | ')}`);
      else note(`overflow (${tag}): none`);
    };
    const smallTargets = async (tag, p = page) => {
      const small = await p.evaluate(() =>
        [...document.querySelectorAll('button, a[href], input, select')]
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ element, box }) => box.width > 0 && box.height > 0 && (box.width < 40 || box.height < 40) && !element.closest('[data-allow-small]'))
          .map(({ element, box }) => `${(element.getAttribute('aria-label') || element.textContent || element.tagName).trim().slice(0, 30)} ${Math.round(box.width)}x${Math.round(box.height)}`)
      );
      note(`touch targets under 40 px (${tag}): ${small.length ? small.join(' | ') : 'none'}`);
    };

    // ---------------------------------------------------------------- the configurator
    await step('initial', async () => {
      await page.goto(`${BASE}/configure`, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await waitShown(page, '/body/');
    });
    note(`showing: ${await shown(page)}`);
    await overflow('configure');
    if (name === 'phone') await smallTargets('configure');

    await step('paint', async () => {
      // a paint that is pictured and is not the one showing
      const swatch = page.locator('[data-options="paints"] button[aria-pressed="false"]:not([aria-disabled])').first();
      const label = await swatch.getAttribute('aria-label');
      const before = await shown(page);
      await swatch.click();
      await page.waitForFunction(([selector, was]) => document.querySelector(selector)?.getAttribute('data-plate-stage') !== was, [STAGE, before], { timeout: 60000 });
      await page.waitForTimeout(500);
      note(`paint -> ${label}: ${await shown(page)}`);
    });

    const views = await page.locator('[aria-label="View"] button').evaluateAll((buttons) => buttons.map((button) => ({ label: button.getAttribute('aria-label'), available: !button.hasAttribute('aria-disabled') })));
    note(`views: ${views.map((view) => `${view.label}${view.available ? '' : ' (not pictured)'}`).join(', ')}`);
    for (const view of views.filter((candidate) => candidate.available).slice(1)) {
      await step(`view-${view.label.split(' ')[0].toLowerCase()}`, async () => {
        const before = await shown(page);
        await page.getByRole('button', { name: view.label, exact: true }).click();
        await page.waitForFunction(([selector, was]) => document.querySelector(selector)?.getAttribute('data-plate-stage') !== was, [STAGE, before], { timeout: 60000 });
        await page.waitForTimeout(500);
      });
    }
    if (views.some((view) => view.available)) await page.getByRole('button', { name: views.find((view) => view.available).label, exact: true }).click();
    await page.waitForTimeout(600);

    const wheelButtons = page.locator('[data-options="wheels"] button');
    const pictured = page.locator('[data-options="wheels"] li:not(:first-child) button:not([aria-disabled])');
    if (await pictured.count()) {
      await step('wheel', async () => {
        const tile = (await pictured.count()) > 1 ? pictured.nth(1) : pictured.first();
        await tile.scrollIntoViewIfNeeded();
        const label = await tile.getAttribute('aria-label');
        await tile.click();
        await waitShown(page, '/wheels/');
        note(`wheel -> ${label}: ${await shown(page)}`);
      });
      const otherFinish = page.locator('[data-options="finishes"] button[aria-pressed="false"]:not([aria-disabled])');
      const anyWheelWithFinishes = pictured.first();
      await anyWheelWithFinishes.click();
      await waitShown(page, '/wheels/');
      if (await otherFinish.count()) {
        await step('finish', async () => {
          const before = await shown(page);
          await otherFinish.first().scrollIntoViewIfNeeded();
          await otherFinish.first().click();
          await page.waitForFunction(([selector, was]) => document.querySelector(selector)?.getAttribute('data-plate-stage') !== was, [STAGE, before], { timeout: 60000 });
          await page.waitForTimeout(500);
          note(`finish: ${await shown(page)}`);
        });
      }
    } else note(`wheel: no catalogue wheel is pictured on this car (${await wheelButtons.count()} tiles), wheel and finish steps skipped`);

    await step('unavailable', async () => {
      const disabled = page.locator('aside button[aria-disabled="true"], [aria-label="View"] button[aria-disabled="true"]').first();
      if (!(await disabled.count())) throw new Error('every option is pictured: nothing to show');
      await disabled.scrollIntoViewIfNeeded();
      const before = await shown(page);
      // (Playwright waits for aria-disabled to clear before it clicks; a customer's tap does not)
      await disabled.click({ force: true });
      await page.getByText(/picture coming soon/i).first().waitFor({ timeout: 10000 });
      if ((await shown(page)) !== before) throw new Error('the picture changed after pressing an option that is not pictured');
      note(`unavailable: ${await disabled.getAttribute('aria-label')}`);
    });

    // the address holds the configuration: a reload shows the same picture
    await step('reload', async () => {
      const before = await shown(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitShown(page, '/body/');
      const after = await shown(page);
      if (after !== before) throw new Error(`after a reload the stage shows ${after}, before it ${before}`);
    });

    const viewBuild = page.getByRole('button', { name: /^view build$/i });
    if (await viewBuild.count()) {
      await step('summary', async () => {
        await viewBuild.click();
        await page.getByRole('button', { name: /^pdf$/i }).waitFor({ timeout: 60000 });
        await page.waitForTimeout(1500);
      });
      await overflow('summary');
      await step('summary-price', async () => {
        await page.getByRole('button', { name: /^pdf$/i }).scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
      });
      await step('summary-back', async () => {
        await page.getByRole('button', { name: /back|return to configuration/i }).first().click();
        await page.locator(STAGE).first().waitFor({ timeout: 20000 });
        await page.waitForTimeout(600);
        if (await page.getByRole('button', { name: /^pdf$/i }).count()) throw new Error('the summary is still open');
      });
    } else note('summary: no catalogue wheel selected (none pictured), summary steps skipped');

    const metrics = await page.evaluate(() => ({ long: window.__longTasks.filter((d) => d >= 100), shift: window.__layoutShift, webgl: window.__webglContexts }));
    note(`long tasks over 100 ms: ${metrics.long.length ? metrics.long.join(', ') + ' ms' : 'none'}`);
    note(`layout shift (since the last load): ${metrics.shift.toFixed(4)}`);
    if (metrics.webgl) problem(`${metrics.webgl} WebGL context(s) were created on the configurator`);
    else note('WebGL contexts created: 0');
    const three = requests.filter((url) => /three|CarConfiguratorEngine|wheelKit/i.test(url));
    if (three.length) problem(`the configurator requested 3D code: ${[...new Set(three)].slice(0, 4).join(', ')}`);
    else note(`requests for three.js or the 3D engine: none (of ${requests.length} requests)`);
    const plateRequests = requests.filter((url) => /\/(body|wheels)\/[^/]+\.(avif|webp)/.test(url));
    note(`plate files requested: ${new Set(plateRequests).size} (${[...new Set(plateRequests.map((url) => url.split('.').pop()))].join(', ')})`);
    await page.close();

    // ---------------------------------------------------------------- the manifest cannot be loaded
    const offline = await context.newPage();
    await watch(offline);
    let block = true;
    await offline.route(/manifest\.json/, (route) => (block ? route.abort('failed') : route.continue()));
    await step('manifest-failed', async () => {
      await offline.goto(`${BASE}/configure`, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await offline.getByText(/pictures could not be loaded/i).first().waitFor({ timeout: 60000 });
    }, offline);
    await step('manifest-retry', async () => {
      block = false;
      await offline.getByRole('button', { name: /try again/i }).first().click();
      await waitShown(offline, '/body/');
    }, offline);
    await offline.close();

    // ---------------------------------------------------------------- one plate cannot be loaded
    const broken = await context.newPage();
    await watch(broken);
    await step('plate-failed', async () => {
      await broken.goto(`${BASE}/configure`, { waitUntil: 'domcontentloaded', timeout: 240000 });
      await waitShown(broken, '/body/');
      const before = await shown(broken);
      const label = await broken.locator('[data-options="paints"] button[aria-pressed="false"]:not([aria-disabled])').last().getAttribute('aria-label');
      // by its name: once its picture has failed the option no longer matches "pictured"
      const swatch = broken.locator(`[data-options="paints"] button[aria-label^="${label}"]`);
      await broken.route(/\/body\/[^/]+\.(avif|webp)/, (route) => route.abort('failed'));
      await swatch.scrollIntoViewIfNeeded();
      await swatch.click();
      await broken.getByText(/could not be loaded/i).first().waitFor({ timeout: 30000 });
      if ((await shown(broken)) !== before) throw new Error('the stage did not keep the last good picture');
      const state = await swatch.evaluate((button) => ({ disabled: button.getAttribute('aria-disabled'), pressed: button.getAttribute('aria-pressed') }));
      if (state.disabled !== 'true' || state.pressed !== 'false') throw new Error(`the option whose picture failed (${label}) is still offered: ${JSON.stringify(state)}`);
      note(`plate-failed: ${label} is marked not pictured, the stage kept ${before}`);
    }, broken);
    await broken.close();

    fs.writeFileSync(path.join(OUT, `${name}.log`), log.join('\n') + '\n');
    await context.close();
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(2);
});
