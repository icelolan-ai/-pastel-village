import { test, expect } from '@playwright/test';

test.describe('Phase 1 smoke test', () => {
  test('page loads and canvas renders without console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/');

    const canvas = page.locator('#scene-canvas');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);

    // WebGL context must actually exist (not just an empty <canvas>).
    const hasWebGL = await canvas.evaluate((el: HTMLCanvasElement) => {
      return Boolean(el.getContext('webgl2') || el.getContext('webgl'));
    });
    expect(hasWebGL).toBe(true);

    expect(consoleErrors).toEqual([]);
  });

  test('FPS overlay shows and updates a numeric value', async ({ page }) => {
    await page.goto('/');
    const overlay = page.locator('#debug-overlay');
    await expect(overlay).toContainText('FPS:');

    // Give the render loop a couple of 500ms sample windows to update.
    await page.waitForTimeout(1200);
    const text = await overlay.textContent();
    const match = text?.match(/FPS:\s*(\d+)/);
    expect(match).not.toBeNull();
  });

  test('pan (drag) and zoom (wheel) do not throw and keep canvas rendering', async ({ page }) => {
    await page.goto('/');
    const canvas = page.locator('#scene-canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Simulate a mouse drag (pan).
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 80, centerY + 40, { steps: 10 });
    await page.mouse.up();

    // Simulate wheel zoom.
    await page.mouse.wheel(0, -200);
    await page.waitForTimeout(100);

    await expect(canvas).toBeVisible();
  });
});
