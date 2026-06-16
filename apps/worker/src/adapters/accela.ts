import { chromium, type Page } from 'playwright';
import {
  classifyServiceZone,
  detectRequiresSeptic,
  isPermitOfficeAddress,
  parseLocationFromText,
  type ServiceZone,
} from '../lib/service-area.js';
import { parsePermitHtml } from '../lib/parse-permit-html.js';

const BASE_ACCELA = 'https://aca-prod.accela.com';

export interface AccelaConfig {
  /** County name stored in DB, e.g. 'lee' | 'charlotte' */
  county: string;
  /** Accela agency code, e.g. 'LEECO' | 'CHARLOTTE' */
  agencyCode: string;
  /** Accela module name, e.g. 'Permitting' | 'Building' */
  module: string;
  /** Value of the permit type <select> option for new residential construction */
  permitTypeValue: string;
}

export const LEE_CONFIG: AccelaConfig = {
  county: 'lee',
  agencyCode: 'LEECO',
  module: 'Permitting',
  permitTypeValue: 'Permitting/Residential/New Primary Structure/NA',
};

export const CHARLOTTE_CONFIG: AccelaConfig = {
  county: 'charlotte',
  agencyCode: 'CHARLOTTE',
  module: 'Building',
  // Verify this value by opening the Charlotte Accela portal and inspecting the select options:
  // https://aca-prod.accela.com/CHARLOTTE/Cap/CapHome.aspx?module=Building
  permitTypeValue: 'Building/Residential/New Single Family Residential/NA',
};

export interface PermitListItem {
  permitNumber: string;
  detailUrl: string;
}

export interface PermitDetail {
  permitNumber: string;
  permitType: string;
  recordStatus: string | null;
  address: string | null;
  city: string | null;
  state: string;
  ownerName: string | null;
  builderName: string | null;
  contractorName: string | null;
  phone: string | null;
  email: string | null;
  estimatedValue: number | null;
  typeOfUse: string | null;
  projectDescription: string | null;
  requiresSeptic: boolean;
  serviceZone: ServiceZone;
  sourceUrl: string;
  rawData: Record<string, unknown>;
}

function formatDate(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
}

async function searchPermits(page: Page, config: AccelaConfig, lookbackDays: number): Promise<PermitListItem[]> {
  const searchUrl = `${BASE_ACCELA}/${config.agencyCode}/Cap/CapHome.aspx?module=${config.module}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#ctl00_PlaceHolderMain_generalSearchForm_ddlGSPermitType', { timeout: 30000 });

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - lookbackDays);

  await page.selectOption('#ctl00_PlaceHolderMain_generalSearchForm_ddlGSPermitType', config.permitTypeValue);
  await page.fill('#ctl00_PlaceHolderMain_generalSearchForm_txtGSStartDate', formatDate(start));
  await page.fill('#ctl00_PlaceHolderMain_generalSearchForm_txtGSEndDate', formatDate(end));

  await Promise.all([
    page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {}),
    page.click('#ctl00_PlaceHolderMain_btnNewSearch'),
  ]);

  await Promise.race([
    page.waitForSelector('a[href*="CapDetail.aspx"]', { timeout: 20000 }).catch(() => {}),
    page.waitForSelector('.ACA_SmLabel', { timeout: 20000 }).catch(() => {}),
  ]);
  await page.waitForTimeout(1500);

  const currentUrl = page.url();
  if (currentUrl.includes('Error.aspx')) {
    throw new Error(
      `Accela returned an error page (${currentUrl}). ` +
      'The server IP may be blocked by Accela. Run the scrape from a local/residential IP.'
    );
  }

  const links = await page.locator('a[href*="CapDetail.aspx"]').evaluateAll((els) => {
    const seen = new Set<string>();
    const results: { permitNumber: string; detailUrl: string }[] = [];

    for (const el of els) {
      const text = el.textContent?.trim() ?? '';
      const href = el.getAttribute('href');
      if (!href || seen.has(text)) continue;
      // Accept permit numbers like RES2026-XXXXX, BLD2026-XXXXX, etc.
      if (!/^[A-Z]{2,4}\d{4}-\d+/i.test(text)) continue;
      seen.add(text);
      results.push({
        permitNumber: text,
        detailUrl: href.startsWith('http') ? href : `https://aca-prod.accela.com${href}`,
      });
    }

    return results;
  });

  return links;
}

async function fetchPermitDetail(page: Page, item: PermitListItem, county: string): Promise<PermitDetail> {
  await page.goto(item.detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(800);

  const html = await page.content();
  const parsed = parsePermitHtml(html);

  const requiresSeptic = detectRequiresSeptic(`${parsed.conditionsBlock} ${parsed.fullPageText}`);

  let city: string | null = null;
  let state = 'FL';
  let address: string | null = parsed.workLocation;

  const fromProject = parseLocationFromText(parsed.projectDescription);
  const fromWork = parseLocationFromText(parsed.workLocation);

  if (fromProject.address && !isPermitOfficeAddress(fromProject.address)) {
    address = fromProject.address;
    city = fromProject.city;
  } else if (fromWork.address && !isPermitOfficeAddress(fromWork.address)) {
    address = fromWork.address;
    city = fromWork.city;
  } else if (parsed.workLocation && !isPermitOfficeAddress(parsed.workLocation)) {
    const cityMatch = parsed.workLocation.match(/([A-Z\s]+)\s+FL\s*\d{5}/i);
    if (cityMatch) city = cityMatch[1].trim();
    const addrMatch = parsed.workLocation.match(/^(.+?)\s+[A-Z\s]+\s+FL/i);
    if (addrMatch) address = addrMatch[1].trim();
  } else if (fromProject.address) {
    address = fromProject.address;
    city = fromProject.city;
  }

  const serviceZone = classifyServiceZone(city, address, county);

  const estimatedValue = parsed.estConstValue
    ? Number(parsed.estConstValue.replace(/[^0-9.]/g, '')) || null
    : null;

  return {
    permitNumber: item.permitNumber,
    permitType: parsed.permitType,
    recordStatus: parsed.recordStatus,
    address,
    city,
    state,
    ownerName: parsed.ownerName,
    builderName: parsed.builderName,
    contractorName: parsed.contractorName,
    phone: parsed.phones[0] ?? null,
    email: parsed.emails[0] ?? null,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : null,
    typeOfUse: parsed.typeOfUse,
    projectDescription: parsed.projectDescription,
    requiresSeptic,
    serviceZone,
    sourceUrl: item.detailUrl,
    rawData: { ...parsed, requiresSeptic, serviceZone },
  };
}

const MAX_PERMITS_PER_RUN = 80;
const GLOBAL_TIMEOUT_MS = 8 * 60 * 1000;

export async function scrapeAccelaPermits(config: AccelaConfig, lookbackDays: number): Promise<PermitDetail[]> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  const startedAt = Date.now();

  try {
    const list = await searchPermits(page, config, lookbackDays);
    const limited = list.slice(0, MAX_PERMITS_PER_RUN);
    console.log(`[${config.county}] Found ${list.length} permits — processing up to ${limited.length}`);

    const details: PermitDetail[] = [];
    for (const item of limited) {
      if (Date.now() - startedAt > GLOBAL_TIMEOUT_MS) {
        console.log(`[${config.county}] ⏱ Global timeout reached after ${details.length} permits`);
        break;
      }
      try {
        const detail = await fetchPermitDetail(page, item, config.county);
        details.push(detail);
        const zoneTag = detail.serviceZone === 'lehigh_core' ? ' [LEHIGH]' : '';
        const septicTag = detail.requiresSeptic ? ' [SEPTIC]' : '';
        console.log(`[${config.county}]   ✓ ${detail.permitNumber} — ${detail.builderName ?? 'no builder'}${zoneTag}${septicTag}`);
      } catch (err) {
        console.error(`[${config.county}]   ✗ ${item.permitNumber}:`, err instanceof Error ? err.message : err);
      }
    }

    return details;
  } finally {
    await browser.close();
  }
}
