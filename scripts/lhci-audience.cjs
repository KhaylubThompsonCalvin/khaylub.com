// Lighthouse CI puppeteerScript for the weight-tier runs (D-37): stores the audience answer the run
// measures (LHCI_AUDIENCE: `tech` is Standard, `exploring` is Full) before Lighthouse navigates.
// Two layers, because Lighthouse clears site storage before a load: the answer is written to
// localStorage once, and a new-document script rewrites it before any page script runs. The page
// stays open so the new-document script stays registered for Lighthouse's navigation.
module.exports = async (browser, context) => {
  const audience = process.env.LHCI_AUDIENCE;
  if (!audience) throw new Error('lhci-audience: LHCI_AUDIENCE is not set');
  const origin = new URL(context.url).origin;
  const page = await browser.newPage();
  await page.evaluateOnNewDocument((a) => {
    try { localStorage.setItem('khaylub-audience', a); } catch (e) { /* storage blocked */ }
  }, audience);
  await page.goto(origin + '/404.html', { waitUntil: 'load' });
};
