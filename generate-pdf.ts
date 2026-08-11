import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

export async function generatePdf(htmlContent: string) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: (chromium as any).defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: (chromium as any).headless,
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' as any });
  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
  });
  await browser.close();
  return pdfBuffer;
}
