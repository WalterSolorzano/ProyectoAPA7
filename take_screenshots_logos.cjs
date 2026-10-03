const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1500);

  // Click on recent document
  const recentDoc = page.locator('text=Estudio_Trabajo (1).docx').first();
  if (await recentDoc.isVisible()) {
    await recentDoc.click();
    await page.waitForTimeout(2000);
  }

  // Go to split editor
  const btn = page.locator('text=Seleccionar esta portada').first();
  if (await btn.isVisible()) {
    await btn.click();
    await page.waitForTimeout(1000);
  }

  // Click on UNAN university chip
  const unanChip = page.locator('button[aria-label*="UNAN"]').first();
  if (await unanChip.isVisible()) {
    await unanChip.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'C:/Users/--X/.gemini/antigravity/brain/69e31397-ee9a-48db-8947-b56cd7de6d18/portada_split_unan.png' });

  // Now click on UNI university chip to demonstrate single selection switch
  const uniChip = page.locator('button[aria-label*="UNI"]').first();
  if (await uniChip.isVisible()) {
    await uniChip.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: 'C:/Users/--X/.gemini/antigravity/brain/69e31397-ee9a-48db-8947-b56cd7de6d18/portada_split_uni.png' });

  await browser.close();
  console.log('CAPTURED UNIVERSITY SELECTIONS');
})();
