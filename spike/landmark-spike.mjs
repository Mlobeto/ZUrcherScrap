import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });

const results = {
  source: 'landmark-lee',
  testedAt: new Date().toISOString(),
  tests: [],
};

async function runTest(name, fn) {
  const entry = { name, status: 'pending', data: null, error: null };
  results.tests.push(entry);
  try {
    entry.data = await fn();
    entry.status = 'ok';
  } catch (err) {
    entry.status = 'error';
    entry.error = err.message;
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});
const page = await context.newPage();
page.setDefaultTimeout(90000);

async function acceptDisclaimerIfPresent() {
  const acceptBtn = page.getByRole('button', { name: /accept/i }).or(page.locator('text=Accept'));
  if (await acceptBtn.count()) {
    await acceptBtn.first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1000);
  }
}

await runTest('home_load', async () => {
  const res = await page.goto('https://or.leeclerk.org/LandMarkWeb', {
    waitUntil: 'domcontentloaded',
    timeout: 120000,
  });
  await acceptDisclaimerIfPresent();
  const body = await page.locator('body').innerText();
  await page.screenshot({ path: join(outDir, 'landmark-home.png'), fullPage: true });
  return {
    httpStatus: res?.status(),
    title: await page.title(),
    hasDocumentSearch: /document/i.test(body),
    hasNameSearch: /name/i.test(body),
    hasRecordDate: /record date/i.test(body),
    bodyPreview: body.slice(0, 500),
  };
});

await runTest('document_type_search_noc_last_7_days', async () => {
  const urls = [
    'https://or.leeclerk.org/LandMarkWeb/search/DocumentType',
    'https://or.leeclerk.org/LandMarkWeb/Search/DocumentType',
    'https://or.leeclerk.org/LandMarkWeb/Home/Index',
  ];

  let loadedUrl = null;
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      loadedUrl = url;
      break;
    } catch {
      // try next
    }
  }

  if (!loadedUrl) throw new Error('No LandMarkWeb search URL reachable');

  await acceptDisclaimerIfPresent();

  const bodyBefore = await page.locator('body').innerText();

  // Try to select NOC via common selectors
  const docTypeSelectors = [
    'select[name*="DocumentType"]',
    '#DocumentType',
    'input[name*="DocumentType"]',
  ];

  let docTypeFound = false;
  for (const sel of docTypeSelectors) {
    if (await page.locator(sel).count()) {
      docTypeFound = true;
      try {
        await page.selectOption(sel, { label: 'NOTICE OF COMMENCEMENT' });
      } catch {
        await page.fill(sel, 'NOC');
      }
      break;
    }
  }

  // Last 7 days shortcut if available
  const last7 = page.locator('text=Last 7 Days');
  if (await last7.count()) {
    await last7.first().click().catch(() => {});
  }

  const submit = page.getByRole('button', { name: /submit/i }).or(page.locator('input[type="submit"][value*="Submit" i]'));
  if (await submit.count()) {
    await submit.first().click();
    await page.waitForTimeout(8000);
  }

  const bodyAfter = await page.locator('body').innerText();
  await page.screenshot({ path: join(outDir, 'landmark-noc-search.png'), fullPage: true });

  const rowHints = (bodyAfter.match(/NOC|NOTICE OF COMMENCEMENT|INSTR\.|Recorded/gi) ?? []).slice(0, 20);

  return {
    loadedUrl,
    docTypeSelectorFound: docTypeFound,
    resultHints: rowHints,
    hasResultsTable: /record date|instrument|grantor|grantee|direct name/i.test(bodyAfter),
    bodyPreview: bodyAfter.slice(0, 1200),
    pageChanged: bodyAfter !== bodyBefore,
  };
});

await runTest('document_image_access_without_login', async () => {
  const res = await page.goto(
    'https://or.leeclerk.org/LandMarkWeb/Document/GetDocumentByCFN/?cfn=2023000307714',
    { waitUntil: 'domcontentloaded', timeout: 90000 }
  );
  const body = await page.locator('body').innerText();
  return {
    httpStatus: res?.status(),
    restrictedMessage: /not viewable.*unregistered/i.test(body),
    hasPdfContent: /contractor|owner|commencement/i.test(body),
    bodyPreview: body.slice(0, 600),
  };
});

await browser.close();

writeFileSync(join(outDir, 'landmark-spike.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
