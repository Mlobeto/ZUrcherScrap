import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'results');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const permitUrl =
  'https://aca-prod.accela.com/LEECO/Cap/CapDetail.aspx?Module=Permitting&TabName=Permitting&capID1=26CAP&capID2=00000&capID3=011FK&agencyCode=LEECO';

await page.goto(permitUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(3000);

const data = await page.evaluate(() => {
  const text = document.body.innerText;
  const pick = (re) => {
    const m = text.match(re);
    return m?.[1]?.trim() ?? null;
  };

  const businessNames = [...document.querySelectorAll('.contactinfo_businessname')].map(
    (el) => el.textContent?.trim()
  );
  const phones = [...document.querySelectorAll('.ACA_PhoneNumberLTR')].map((el) => el.textContent?.trim());
  const emails = [...document.querySelectorAll('.contactinfo_email a, .contactinfo_email')].map((el) =>
    el.textContent?.trim()
  );

  return {
    recordId: pick(/Record\s+(RES[\d-]+)/i),
    recordStatus: pick(/Record Status:\s*([^\n]+)/i),
    permitTypeLine: text.includes('Residential New Primary Structure'),
    workLocation: pick(/(\d+[^\n]*(?:AVE|ST|DR|RD|BLVD|LN|CT|WAY)[^\n]*(?:FL)?[^\n]*\d{5}?)/i),
    applicantBusiness: businessNames[0] ?? null,
    allBusinessNames: businessNames.filter(Boolean),
    licensedProfessionalBlock: text.match(/Licensed Professional:[\s\S]{0,500}/i)?.[0]?.slice(0, 500) ?? null,
    phones: [...new Set(phones.filter(Boolean))],
    emails: [...new Set(emails.filter(Boolean))],
    estConstValue: pick(/Est\.\s*Const\.\s*Value:\s*([^\n]+)/i),
    typeOfUse: pick(/Type of Use:\s*([^\n]+)/i),
    ownerBuilder: pick(/Owner-Builder\?:\s*([^\n]+)/i),
    projectDescription: pick(/Project Description:[\s\S]*?\n([\s\S]{0,200})/i),
    hasParcelSection: /Parcel Information/i.test(text),
    hasRelatedContacts: /Related Contacts/i.test(text),
    hasInspections: /Inspection/i.test(text),
    hasNocMention: /Notice of Commencement/i.test(text),
  };
});

await page.screenshot({ path: join(outDir, 'accela-detail-recent.png'), fullPage: true });
await browser.close();

writeFileSync(join(outDir, 'accela-detail-recent.json'), JSON.stringify(data, null, 2));
console.log(JSON.stringify(data, null, 2));
