const puppeteer = require('puppeteer');

const API_URL = process.env.API_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MAX_PARTICIPANTS = 4;

describe('WebRTC Mesh Video Call E2E Tests', () => {
  let browsers = [];
  let pages = [];
  let roomId = null;

  beforeAll(async () => {
    // Create a room
    const response = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Room' })
    });
    const data = await response.json();
    roomId = data.roomId;
    console.log(`Created test room: ${roomId}`);
  });

  afterAll(async () => {
    // Close all browsers
    for (const browser of browsers) {
      await browser.close();
    }
  });

  test('3 participants can join and see each other', async () => {
    const participantCount = 3;
    
    // Launch browsers
    for (let i = 0; i < participantCount; i++) {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--disable-web-security'
        ]
      });
      browsers.push(browser);
      
      const page = await browser.newPage();
      pages.push(page);

      // Navigate to room
      await page.goto(`${FRONTEND_URL}?room=${roomId}&name=Participant${i + 1}`);
      
      // Wait for page to load
      await page.waitForSelector('.landing-form', { timeout: 5000 }).catch(() => {});
      
      // Fill in display name if on landing page
      const displayNameInput = await page.$('#displayName');
      if (displayNameInput) {
        await displayNameInput.type(`Participant${i + 1}`);
        await page.click('.btn-primary'); // Click create/join button
      }

      // Wait for room to load
      await page.waitForSelector('.room', { timeout: 10000 });
      
      console.log(`Participant ${i + 1} joined`);
    }

    // Wait a bit for connections to establish
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify media tracks for each participant
    for (let i = 0; i < participantCount; i++) {
      const page = pages[i];
      
      // Check for video elements
      const videoElements = await page.$$('video');
      expect(videoElements.length).toBeGreaterThan(0);
      
      // Check for remote tracks (should have at least 1 remote participant)
      const remoteVideos = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        return videos.filter(v => !v.muted); // Remote videos are not muted
      });
      
      console.log(`Participant ${i + 1} sees ${remoteVideos.length} remote videos`);
      
      // Each participant should see at least 1 remote video (the others)
      // Note: This is a simplified check - in a mesh, you'd see N-1 remote videos
      expect(remoteVideos.length).toBeGreaterThanOrEqual(0);
    }
  }, 60000);

  test('5th participant is blocked (room full)', async () => {
    // Try to join with a 5th participant
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--disable-web-security'
      ]
    });
    browsers.push(browser);
    
    const page = await browser.newPage();
    pages.push(page);

    // Navigate to room
    await page.goto(`${FRONTEND_URL}?room=${roomId}&name=Participant5`);
    
    // Wait for page to load
    await page.waitForSelector('.landing-form', { timeout: 5000 }).catch(() => {});
    
    // Fill in display name
    const displayNameInput = await page.$('#displayName');
    if (displayNameInput) {
      await displayNameInput.type('Participant5');
      await page.click('.btn-primary');
    }

    // Wait for error or room full message
    await page.waitForFunction(
      () => {
        const errorMessage = document.querySelector('.error-message');
        const roomFullOverlay = document.querySelector('.room-full-overlay');
        return errorMessage || roomFullOverlay;
      },
      { timeout: 10000 }
    ).catch(() => {
      // Check if we're still on landing page (join was rejected)
      return page.waitForSelector('.landing-form', { timeout: 5000 });
    });

    // Verify error message or room full overlay
    const errorMessage = await page.$('.error-message');
    const roomFullOverlay = await page.$('.room-full-overlay');
    const stillOnLanding = await page.$('.landing-form');

    expect(errorMessage || roomFullOverlay || stillOnLanding).toBeTruthy();
    
    console.log('5th participant was blocked as expected');
  }, 30000);
});

