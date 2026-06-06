import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });

const results = {
  source: 'accela-leeco',
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

await runTest('portal_load', async () => {
  const res = await page.goto(
    'https://aca-prod.accela.com/LEECO/Cap/CapHome.aspx?module=Permitting',
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );
  const permitType = page.locator('#ctl00_PlaceHolderMain_generalSearchForm_ddlGSPermitType');
  await permitType.waitFor({ timeout: 30000 });
  const options = await permitType.locator('option').allTextContents();
  return {
    httpStatus: res?.status(),
    title: await page.title(),
    hasResidentialNewPrimary: options.some((o) => o.includes('Residential New Primary Structure')),
    permitTypeCount: options.length,
    defaultStartDate: await page.inputValue('#ctl00_PlaceHolderMain_generalSearchForm_txtGSStartDate'),
    defaultEndDate: await page.inputValue('#ctl00_PlaceHolderMain_generalSearchForm_txtGSEndDate'),
  };
});

await runTest('search_residential_new_primary_last_30_days', async () => {
  await page.selectOption(
    '#ctl00_PlaceHolderMain_generalSearchForm_ddlGSPermitType',
    'Permitting/Residential/New Primary Structure/NA'
  );

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const fmt = (d) =>
    `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;

  await page.fill('#ctl00_PlaceHolderMain_generalSearchForm_txtGSStartDate', fmt(start));
  await page.fill('#ctl00_PlaceHolderMain_generalSearchForm_txtGSEndDate', fmt(end));

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 90000 }).catch(() => {}),
    page.click('#ctl00_PlaceHolderMain_btnNewSearch'),
  ]);

  await page.waitForTimeout(5000);

  const resultText = await page.locator('body').innerText();
  const noResults = /no record|no results|0 record/i.test(resultText);

  const rows = await page.locator('table[id*="RecordSearchResult"] tr, .ACA_GridView tr').count();

  const recordLinks = await page
    .locator('a[href*="CapDetail.aspx"]')
    .evaluateAll((els) =>
      els.slice(0, 10).map((el) => ({
        text: el.textContent?.trim(),
        href: el.getAttribute('href'),
      }))
    );

  await page.screenshot({ path: join(outDir, 'accela-search-results.png'), fullPage: true });

  return {
    dateRange: { start: fmt(start), end: fmt(end) },
    noResultsHint: noResults,
    approxTableRows: rows,
    sampleRecordLinks: recordLinks,
  };
});

await runTest('permit_detail_sample', async () => {
  const res = await page.goto(
    'https://aca-prod.accela.com/LEECO/cap/CapDetail.aspx?ALTID=RES2024-12654&Module=Permitting',
    { waitUntil: 'domcontentloaded', timeout: 60000 }
  );

  const bodyText = await page.locator('body').innerText();

  const extract = (label) => {
    const re = new RegExp(`${label}[:\\s]*([^\\n]+)`, 'i');
    const m = bodyText.match(re);
    return m?.[1]?.trim() ?? null;
  };

  const builderMatch = bodyText.match(/([A-Z0-9][A-Z0-9 .,&'-]*(?:LLC|INC|CORP|CONSTRUCTION|BUILDER|HOMES|PROPERTIES))/i);

  return {
    httpStatus: res?.status(),
    recordId: 'RES2024-12654',
    recordStatus: extract('Record Status'),
    permitType: bodyText.includes('Residential New Primary Structure'),
    address: bodyText.match(/1316 JACKSON AVE/i)?.[0] ?? null,
    estConstValue: extract('Est\\. Const\\. Value'),
    typeOfUse: extract('Type of Use'),
    licensedProfessional: bodyText.includes('BLUESHINE BUILDER LLC'),
    applicant: bodyText.includes('Blueshine Builder LLC'),
    phoneFound: bodyText.match(/\d{10}/)?.[0] ?? null,
    builderCandidate: builderMatch?.[0] ?? null,
    hasOwnerSection: /Owner/i.test(bodyText),
    hasNocCondition: /Notice of Commencement/i.test(bodyText),
  };
});

await browser.close();

writeFileSync(join(outDir, 'accela-spike.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
