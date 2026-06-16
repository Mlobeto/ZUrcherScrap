import * as cheerio from 'cheerio';

export interface ParsedPermitHtml {
  recordStatus: string | null;
  permitType: string;
  workLocation: string | null;
  builderName: string | null;
  contractorName: string | null;
  ownerName: string | null;
  phones: string[];
  emails: string[];
  estConstValue: string | null;
  typeOfUse: string | null;
  projectDescription: string | null;
  fullPageText: string;
  conditionsBlock: string;
}

function pick(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match?.[1]?.trim() ?? null;
}

export function parsePermitHtml(html: string): ParsedPermitHtml {
  const $ = cheerio.load(html);
  const text = $('body').text();

  const businessNames = $('.contactinfo_businessname')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const phones = [
    ...new Set(
      $('.ACA_PhoneNumberLTR')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(Boolean)
    ),
  ];

  const emails = [
    ...new Set(
      $('.contactinfo_email a, .contactinfo_email')
        .map((_, el) => $(el).text().replace(/^E-mail:\s*/i, '').trim())
        .get()
        .filter((e) => e.includes('@'))
    ),
  ];

  const workLocation = $('.fontbold').first().text().trim() || null;

  const licensedBlock = text.match(/Licensed Professional:[\s\S]*?(?=Project Description:|$)/i)?.[0] ?? '';
  const contractorLine =
    licensedBlock
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !/Licensed Professional|Primary Phone|Certified|Contractor/i.test(l)) ?? null;

  const ownerSection = text.match(/Owner[\s\S]{0,300}/i)?.[0] ?? null;
  const conditionsBlock = text.match(/Conditions[\s\S]*?(?=Work Location|Licensed Professional|$)/i)?.[0] ?? '';

  return {
    recordStatus: pick(text, /Record Status:\s*([^\n]+)/i),
    permitType: text.includes('Residential New Primary Structure')
      ? 'Residential New Primary Structure'
      : 'Unknown',
    workLocation,
    builderName: businessNames[0] ?? contractorLine,
    contractorName: contractorLine,
    ownerName: ownerSection,
    phones,
    emails,
    estConstValue: pick(text, /Est\.\s*Const\.\s*Value:\s*([^\n]+)/i),
    typeOfUse: pick(text, /Type of Use:\s*([^\n]+)/i),
    projectDescription: pick(text, /Project Description:\s*\n?([\s\S]{0,300})/i),
    fullPageText: text,
    conditionsBlock,
  };
}
