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

async function setAiMessages(page: import('playwright/test').Page, messages: unknown[]) {
  return page.evaluate((m) => {
    const h = (window as unknown as { __sketchroomHarness?: { setAiMessages: (m: unknown) => void } })
      .__sketchroomHarness;
    if (!h) throw new Error('harness handle missing');
    h.setAiMessages(m);
  }, messages);
}

const appUrl = (route: string, extra = '') =>
  `/harness.html?view=app&route=${encodeURIComponent(route)}${extra}`;

test.describe('dashboard', () => {
  test('renders rooms, search, and navigation', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));

    await expect(page.getByRole('heading', { name: 'Rooms' })).toBeVisible();
    await expect(page.locator('.room:not(.add)')).toHaveCount(2);

    // KPI pills
    await expect(page.locator('.kpi-pill-label', { hasText: 'Rooms' })).toBeVisible();

    // Search narrows the grid; a miss shows the empty state.
    await page.locator('.search-input').fill('auth');
    await expect(page.locator('.room:not(.add)')).toHaveCount(1);
    await expect(page.locator('.room .name', { hasText: 'Auth flow review' })).toBeVisible();

    await page.locator('.search-input').fill('zzz');
    await expect(page.getByText('No rooms match your search')).toBeVisible();
  });
});

test.describe('room creation', () => {
  test('creating a room navigates to it with the given name', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));

    await page.locator('.topbar-actions .btn.primary').first().click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    await page.locator('.modal input').fill('Smoke Test Room');
    await page.keyboard.press('Enter');

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
      await expect(page.locator('.nav')).toBeVisible();

      // Hamburger fully visible and clickable — never pushed off-screen.
      const menu = page.locator('.nav-hamburger');
      await expect(menu).toBeVisible();
      const box = await menu.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(w);

      // The CTA button is collapsed away below 480 (it lives in the menu);
      // nothing may overflow the viewport horizontally.
      await expect(page.locator('.nav-cta')).toBeHidden();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('the CTA button stays visible from 481px up', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 800 });
    await page.goto(appUrl('/'));
    await expect(page.locator('.nav')).toBeVisible();
    await expect(page.locator('.nav-cta')).toBeVisible();
    const box = await page.locator('.nav-hamburger').boundingBox();
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

test.describe('AI copilot', () => {
  test('asking the AI shows a pending state then a completed suggestion with insert options', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    // Open AI feed and ask a question
    await page.locator('.ai-bar-input').fill('Draw a login flow');
    await page.locator('.ai-bar-send').click();

    // Should show pending state
    await expect(page.locator('.ai-message-thinking')).toBeVisible({ timeout: 5000 });

    // Should eventually show completed response with blocks
    await expect(page.locator('.ai-message-response')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.ai-ghost-block')).toHaveCount(3); // 3 blocks from seed
    await expect(page.getByRole('button', { name: /insert all/i })).toBeVisible();

    // Verify the AI mutation was called
    const calls = await mutationCalls(page, 'requestAiSuggestion');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { prompt?: string }).prompt).toBe('Draw a login flow');
  });

  test('inserting a ghost block adds it to the canvas', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    // Ask AI and wait for completion
    await page.locator('.ai-bar-input').fill('Draw a login flow');
    await page.locator('.ai-bar-send').click();
    await expect(page.locator('.ai-message-response')).toBeVisible({ timeout: 10000 });

    // Insert the first block
    await page.locator('.ai-ghost-block').first().getByRole('button', { name: /insert/i }).click();

    // The insert action should have triggered applyCanvasChanges
    const calls = await mutationCalls(page, 'applyCanvasChanges');
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });

  test('AI error shows retry and dismiss options', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    // Focus the AI input to open the feed, then seed a failed message
    await page.locator('.ai-bar-input').click();
    await expect(page.locator('.ai-chat')).toBeVisible();

    await setAiMessages(page, [{
      _id: 'm_failed',
      prompt: 'Draft a login flow',
      status: 'failed',
      response: 'Could not reach the AI right now.',
      ghostBlocks: null,
      createdAt: Date.now(),
    }]);

    // Should show error with retry and dismiss
    await expect(page.locator('.ai-message-error')).toBeVisible();
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /dismiss/i })).toBeVisible();
  });
});

test.describe('invites', () => {
  test('inviting a member by email calls inviteMember mutation', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.locator('.share-modal')).toBeVisible();

    // Invite by email
    await page.locator('.share-invite-row input.input').fill('newuser@example.com');
    await page.locator('.share-invite-row .btn-primary').click();

    const calls = await mutationCalls(page, 'inviteMember');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { email?: string }).email).toBe('newuser@example.com');
  });

  test('creating an invite link calls createInviteLink and shows copyable link', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.locator('.share-modal')).toBeVisible();

    await page.locator('.share-link-row .share-role-select').selectOption('viewer');
    await page.locator('.share-link-row .btn-outline').click();

    const calls = await mutationCalls(page, 'createInviteLink');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { role?: string }).role).toBe('viewer');

    // Link should appear in the input
    await expect(page.locator('.share-link-row input.input')).toHaveValue(/\/invite\/.*/);
  });

  test('changing a member role calls updateMemberRole', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await expect(page.locator('.share-modal')).toBeVisible();

    // The share modal shows the member list with role selectors
    await expect(page.locator('.share-member')).toHaveCount(2);

    // Change the guest's role to viewer via the select
    const roleSelect = page.locator('.share-member').nth(1).locator('select');
    await roleSelect.selectOption('viewer');

    const calls = await mutationCalls(page, 'updateMemberRole');
    expect(calls.length).toBeGreaterThanOrEqual(1);
  });
});

test.describe('room creation with templates', () => {
  test('creating from a template seeds the room and navigates to it', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));
    await expect(page.locator('.dashboard')).toBeVisible();

    // Open the create modal
    await page.locator('.topbar-actions .btn.primary').click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    // Click the Architecture System template inside the modal
    await page.getByRole('button', { name: /system architecture/i }).click();

    // Should navigate to room screen
    await expect(page.locator('.room-screen')).toBeVisible({ timeout: 5000 });

    const calls = await mutationCalls(page, 'createRoom');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { name?: string; seed?: string }).name).toBe('System architecture');
    expect((calls[0][0] as { seed?: string }).seed).toBeTruthy();
  });

  test('blank canvas creates empty room', async ({ page }) => {
    await page.goto(appUrl('/dashboard'));
    await expect(page.locator('.dashboard')).toBeVisible();

    // Open the create modal
    await page.locator('.topbar-actions .btn.primary').click();
    const modal = page.locator('.modal');
    await expect(modal).toBeVisible();

    await page.locator('.modal input').fill('My Blank Room');
    await page.keyboard.press('Enter');

    await expect(page.locator('.room-screen')).toBeVisible();
    await expect(page.locator('.room-name-input')).toHaveValue('My Blank Room');

    const calls = await mutationCalls(page, 'createRoom');
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect((calls[0][0] as { name?: string }).name).toBe('My Blank Room');
    expect((calls[0][0] as { seed?: string }).seed).toBeFalsy();
  });
});

test.describe('export', () => {
  test('export dialog opens with format options', async ({ page }) => {
    await page.goto(appUrl('/room/room_a'));
    await expect(page.locator('.room-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.locator('.export-dialog')).toBeVisible();

    // Format options are available
    await expect(page.getByRole('radio', { name: /png/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /svg/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /pdf/i })).toBeVisible();
  });
});

test.describe('auth flow', () => {
  test('sign up form submits and shows verification step', async ({ page }) => {
    // Inject unauthenticated state before the page loads so the first render sees it
    await page.addInitScript(() => {
      (window as any).__sketchroomAuth = { isAuthenticated: false };
    });
    await page.goto(appUrl('/auth'));
    await expect(page.locator('.auth-screen')).toBeVisible();

    // Switch to signup tab
    await page.getByRole('tab', { name: /create account/i }).click();
    await expect(page.locator('input[name="name"]')).toBeVisible();

    await page.locator('input[name="name"]').fill('Test User');
    await page.locator('input[name="email"]').fill('test@example.com');
    await page.locator('input[name="password"]').fill('password123');
    await page.locator('button.auth-submit').click();

    // Should show verification step (email verification)
    await expect(page.locator('.auth-form-wrap')).toBeVisible();
    await expect(page.getByText(/check your inbox/i)).toBeVisible();

    // Clear the override so subsequent tests default to authenticated
    await page.evaluate(() => { delete (window as any).__sketchroomAuth; });
  });

  test('sign in form shows error on invalid credentials', async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__sketchroomAuth = { isAuthenticated: false };
    });
    await page.goto(appUrl('/auth'));
    await expect(page.locator('.auth-screen')).toBeVisible();

    await page.locator('input[name="email"]').fill('wrong@example.com');
    await page.locator('input[name="password"]').fill('wrongpass');

    // Set the error message before submitting
    await page.evaluate(() => {
      (window as any).__sketchroomAuthError = 'invalid credentials';
    });
    await page.locator('button.auth-submit').click();

    // Should show friendly error
    await expect(page.locator('.auth-error')).toBeVisible();
    await expect(page.locator('.auth-error')).toContainText(/don't match/i);

    await page.evaluate(() => { delete (window as any).__sketchroomAuth; });
  });
});
