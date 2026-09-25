/**
 * Print output, in a real browser, under real print media.
 *
 * Unit tests check the numbers; these check what actually lands on the page.
 * That distinction matters: the previous tool shipped a print bug where the
 * computed transform was correct but the rendered result was wrong, because
 * the transform was applied twice down one DOM branch. Only looking at
 * rendered geometry catches that.
 */

import { expect, test } from '@playwright/test';

const APP = '/schematic-v3/';

/** Build a drawing through the app's own model, then render it. */
async function seed(page: import('@playwright/test').Page) {
  await page.goto(APP);
  await page.waitForSelector('.sc-canvas');

  // Drag two components out of the palette via the real drag-and-drop path.
  await page.evaluate(() => {
    const drop = (type: string, x: number, y: number) => {
      const item = document.querySelector<HTMLElement>(`.sc-palette-item[data-type="${type}"]`)!;
      const canvas = document.querySelector<HTMLElement>('.sc-canvas')!;
      const dt = new DataTransfer();
      dt.setData('text/plain', type);
      item.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      const r = canvas.getBoundingClientRect();
      canvas.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + x, clientY: r.top + y }),
      );
      canvas.dispatchEvent(
        new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + x, clientY: r.top + y }),
      );
    };
    drop('RAK8', 120, 120);
    drop('KeypadWCM', 600, 300);
  });
  await expect(page.locator('.sc-item')).toHaveCount(2);
}

test('the page shows the printable area and nothing outside it', async ({ page }) => {
  await page.goto(APP);
  const size = await page.locator('.sc-canvas').evaluate((el) => ({
    w: (el as HTMLElement).offsetWidth,
    h: (el as HTMLElement).offsetHeight,
  }));
  // A4 landscape less 10mm margins, less the title block, at 96dpi.
  expect(size.w).toBeGreaterThan(1040);
  expect(size.w).toBeLessThan(1050);
  expect(size.h).toBeGreaterThan(560);
  expect(size.h).toBeLessThan(580);
});

test('a component cannot be dropped outside the printable page', async ({ page }) => {
  await seed(page);
  const placed = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLElement>('.sc-canvas')!;
    return [...document.querySelectorAll<HTMLElement>('.sc-item')].every((el) => {
      return (
        el.offsetLeft >= 0 &&
        el.offsetTop >= 0 &&
        el.offsetLeft + el.offsetWidth <= canvas.offsetWidth + 1 &&
        el.offsetTop + el.offsetHeight <= canvas.offsetHeight + 1
      );
    });
  });
  expect(placed).toBe(true);
});

test('printing renders a sheet from the model, with no duplicate ids', async ({ page }) => {
  await seed(page);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForSelector('.sc-print-sheet');

  const sheet = page.locator('.sc-print-sheet');
  await expect(sheet.locator('.sc-item')).toHaveCount(2);

  const duplicateIds = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map((el) => el.id);
    return ids.length !== new Set(ids).size;
  });
  expect(duplicateIds).toBe(false);
});

test('the fit transform is applied exactly once, so cables stay on their components', async ({ page }) => {
  await seed(page);
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForSelector('.sc-print-sheet');

  const transformedAncestors = await page.evaluate(() => {
    const item = document.querySelector('.sc-print-sheet .sc-item')!;
    let node: HTMLElement | null = item as HTMLElement;
    let count = 0;
    while (node) {
      const t = getComputedStyle(node).transform;
      if (t && t !== 'none') count++;
      node = node.parentElement;
    }
    return count;
  });
  expect(transformedAncestors).toBe(1);
});

test('circuit labels print black on transparent, and never overlap', async ({ page }) => {
  await seed(page);
  // Name every circuit through the model the app exposes for testing.
  await page.evaluate(() => {
    const api = (window as unknown as { __schematic?: { setCircuits(names: string[]): void } }).__schematic;
    api?.setCircuits(['Kitchen', 'Hall', 'Snug', 'Study', 'Landing', 'Bed 1', 'Bed 2', 'Loft']);
  });
  await expect(page.locator('.sc-output-label')).toHaveCount(8);

  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForSelector('.sc-print-sheet');

  const result = await page.evaluate(() => {
    const labels = [...document.querySelectorAll<HTMLElement>('.sc-print-sheet .sc-output-label')];
    const rects = labels.map((l) => l.getBoundingClientRect());
    const overlaps = rects.slice(0, -1).map((r, i) => r.bottom - rects[i + 1]!.top);
    const cs = getComputedStyle(labels[0]!);
    const line = document.querySelector('.sc-print-sheet .sc-output-label-lines line')!;
    return {
      count: labels.length,
      maxOverlap: Math.max(...overlaps),
      colour: cs.color,
      background: cs.backgroundColor,
      lineStroke: getComputedStyle(line).stroke,
    };
  });

  expect(result.count).toBe(8);
  // The exact defect from the old tool: labels overlapping by ~3.6px.
  expect(result.maxOverlap).toBeLessThanOrEqual(0);
  expect(result.colour).toBe('rgb(0, 0, 0)');
  expect(result.background).toBe('rgba(0, 0, 0, 0)');
  expect(result.lineStroke).toBe('rgb(0, 0, 0)');
});

test('cable colours survive into print unchanged', async ({ page }) => {
  await page.goto(APP);
  await page.waitForSelector('.sc-canvas');
  await page.evaluate(() => {
    const api = (window as unknown as { __schematic?: { addConnection(kind: string): void } }).__schematic;
    api?.addConnection('dali');
  });
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
  await page.waitForSelector('.sc-print-sheet');
  const stroke = await page
    .locator('.sc-print-sheet .sc-connection')
    .first()
    .evaluate((el) => el.getAttribute('stroke'));
  expect(stroke).toBe('#dc3545');
});
