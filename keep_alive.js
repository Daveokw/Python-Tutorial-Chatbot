const { chromium } = require('playwright');

const DEFAULT_ALLOWED_HOST = 'python-tutorial-chatbot.streamlit.app';
const FAILURE_SCREENSHOT = 'keep_alive_screenshot.png';
const CONNECTION_HOLD_MS = 15000;

function validatedTarget(rawValue) {
  if (!rawValue) {
    throw new Error('A target URL is required.');
  }

  const target = new URL(rawValue);
  if (target.protocol !== 'https:') {
    throw new Error('The availability check requires HTTPS.');
  }

  const allowedHost = process.env.KEEP_ALIVE_ALLOWED_HOST || DEFAULT_ALLOWED_HOST;
  if (target.hostname !== allowedHost) {
    throw new Error(`The target host must be ${allowedHost}.`);
  }

  target.username = '';
  target.password = '';
  target.hash = '';
  return target.toString();
}

async function openApp(page, target) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let failure;
    let response;
    try {
      response = await page.goto(target, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });
    } catch (error) {
      failure = error;
    }

    if (!failure) {
      if (!response || response.status() < 400) return;
    }
    if (!failure) {
      failure = new Error(`The app returned HTTP ${response.status()}.`);
      if (![403, 408, 429, 500, 502, 503, 504].includes(response.status())) throw failure;
    }

    if (attempt === 3) throw failure;
    console.log(`${failure.message} Retrying in 10 seconds (${attempt}/3).`);
    await page.waitForTimeout(10000);
  }
}

async function run() {
  let browser;
  let page;

  try {
    const target = validatedTarget(process.argv[2]);
    console.log('Starting the Python Tutorial Chatbot availability check.');

    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();
    await openApp(page, target);
    await page.waitForTimeout(CONNECTION_HOLD_MS);
    console.log('The chatbot app connection completed successfully.');
  } catch (error) {
    console.error(`Availability check failed: ${error.message}`);
    process.exitCode = 1;
    if (page) {
      try {
        await page.screenshot({ path: FAILURE_SCREENSHOT, fullPage: true });
      } catch (screenshotError) {
        console.error(`Failure screenshot could not be saved: ${screenshotError.message}`);
      }
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

run();
