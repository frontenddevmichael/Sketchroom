// Critical-path smoke tests, driven against the dev harness (`?view=app`).
//
// The harness renders the REAL app components (Dashboard, RoomScreen, modals)
// on a stubbed Convex/Clerk layer, so these specs exercise the actual UI flow —
// not a mock of it. `window.__sketchroomHarness.getMutationCalls(name)` returns
// the arguments recorded by the stub for a given mutation, letting tests assert
// that the UI really invoked the backend as expected.
import { test, expect } from 'playwright/test';

// The handle lives in the page and its methods are functions, which cannot
// cross the page boundary (page.evaluate structured-clones its return value,
// dropping functions). So the CALL happens inside the page and only the
// serializable result comes back.
async function mutationCalls(page: import('playwright/test').Page, name: string): Promise<unknown[][]> {
  return page.evaluate((n) => {
    const h = (window as unknown as { __sketchroomHarness?: { getMutationCalls: (n: string) => unknown[][] } })
      .__sketchroomHarness;
    if (!h) throw new Error('harness handle missing — is ?view=app active?');
    return h.getMutationCalls(n);
  }, name);
}

const appUrl = (route: string, extra = '') =>
  `/harness.html?view=app&route=${encodeURIComponent(route)}${extra}`;

test.describe('dashboard', () => {
  test('renders rooms, templates, stats, and search', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));

    await expect(page.getByRole('heading', { name: 'Your rooms' })).toBeVisible();
    await expect(page.locator('.room-card')).toHaveCount(2);

    // Stats + template picker
    await expect(page.locator('.stat-tile', { hasText: 'Rooms' })).toBeVisible();
    await expect(page.getByText('Start from a template')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /system architecture/i })
    ).toBeVisible();

    // Search narrows the grid; a miss shows the empty state.
    await page.locator('.search-input').fill('auth');
    await expect(page.locator('.room-card')).toHaveCount(1);
    await expect(page.locator('.room-card-name', { hasText: 'Auth flow review' })).toBeVisible();

    await page.locator('.search-input').fill('zzz');
    await expect(page.getByText('No rooms match your search')).toBeVisible();
  });
});

test.describe('room creation', () => {
  test('creating a room navigates to it with the given name', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));

    // Both the sidebar and the header carry a "New room" CTA; target the
    // header one in the main content so the locator stays unambiguous.
    await page.locator('main').getByRole('button', { name: /new room/i }).click();
    const modal = page.locator('.new-room-modal');
    await expect(modal).toBeVisible();

    await page.locator('.new-room-modal input.input').fill('Smoke Test Room');
    await page.keyboard.press('Enter');

    // Dashboard navigates to /room/<id>; the room screen shows the new name.
    await expect(page.locator('.room-screen')).toBeVisible();
    await expect(page.locator('.room-name-input')).toHaveValue('Smoke Test Room');

    const calls = await mutationCalls(page, 'createRoom');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { name?: string }).name).toBe('Smoke Test Room');
  });
});

test.describe('canvas save', () => {
  test('an edit on the canvas flushes through the save pipeline', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();
    await expect(page.locator('.room-tldraw')).toBeVisible();

    // Insert a block from the library — a real shape lands in the tldraw store.
    await page.getByRole('button', { name: 'Block library' }).click();
    await page.locator('.block-library-item').first().click();

    // The debounced flush calls applyCanvasChanges and flips the status pill.
    await expect(page.locator('.room-status-pill.room-status-ok')).toBeVisible({
      timeout: 8000,
    });

    const calls = await mutationCalls(page, 'applyCanvasChanges');
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('version history', () => {
  test('restore asks for confirmation, then calls restoreSnapshot', async ({ page }) => {
    await page.goto(appUrl('/room/room_a', '&snapshots=1'));
    await expect(page.locator('.room-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Version history' }).click();
    await expect(page.locator('.history-row')).toHaveCount(2);

    const restore = page.locator('.history-restore').first();
    await restore.click();
    await expect(restore).toHaveText('Confirm restore?');
    await restore.click();

    const calls = await mutationCalls(page, 'restoreSnapshot');
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('settings', () => {
  test('deleting a workspace asks for confirmation before calling deleteWorkspace', async ({ page }) => {
    await page.goto(appUrl('/settings'));

    await expect(page.getByRole('heading', { name: 'Workspace settings' })).toBeVisible();

    // First click opens a custom confirmation dialog (no native confirm()).
    await page.getByRole('button', { name: 'Delete workspace' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete workspace' });
    await expect(dialog).toBeVisible();

    // Cancelling closes the dialog without deleting.
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    let calls = await mutationCalls(page, 'deleteWorkspace');
    expect(calls.length).toBe(0);

    // Confirming runs the delete.
    await page.getByRole('button', { name: 'Delete workspace' }).click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Delete workspace', exact: true }).click();
    calls = await mutationCalls(page, 'deleteWorkspace');
    expect(calls.length).toBe(1);
  });
});

test.describe('landing nav', () => {
  test('at narrow widths the hamburger stays inside the viewport and the CTA collapses', async ({ page }) => {
    for (const w of [320, 375, 430, 480]) {
      await page.setViewportSize({ width: w, height: 812 });
      await page.goto(appUrl('/'));
      await expect(page.locator('.landing-page')).toBeVisible();

      // Hamburger fully visible and clickable — never pushed off-screen.
      const menu = page.locator('.landing-nav-menu-btn');
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(w);

      // The CTA button is collapsed away below 480 (it lives in the menu);
      // nothing may overflow the viewport horizontally.
      await expect(page.locator('.landing-nav-cta-btn')).toBeHidden();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('the CTA button stays visible from 481px up', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto(appUrl('/'));
    await expect(page.locator('.landing-page')).toBeVisible();
    await expect(page.locator('.landing-nav-cta-btn')).toBeVisible();
    const box = await page.locator('.landing-nav-menu-btn').boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(600);
  });
});

test.describe('room chrome harness', () => {
  test('default harness still boots the room chrome', async ({ page }) => {
    await page.goto('/harness.html');
    await expect(page.locator('.room-topbar')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Block library' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share', exact: true })).toBeVisible();
    await expect(page.locator('.ai-bar')).toBeVisible();
  });
});
