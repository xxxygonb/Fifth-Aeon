import { expect, test, type Page } from '@playwright/test';

/**
 * 全局冒烟测试：游客登录 → 大厅 → AI 对局（懒加载 GameModule）→
 * 编辑器/锦标赛/管理页（懒加载 Editor/Tournament/AdminModule）。
 * 默认语言为 zh-CN，按钮断言同时兼容中英文文案。
 */

const SEVERE_ERRORS = [
    /Unhandled Rejection/i,
    /NOT_FOUND/i,
    /NG0[0-9]{4}:/, // Angular 运行时异常
    /TypeError/,
    /ReferenceError/
];

/** 收集控制台严重错误与页面未捕获异常 */
function trackErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error' && SEVERE_ERRORS.some(re => re.test(msg.text()))) {
            errors.push(`console: ${msg.text()}`);
        }
    });
    page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
    return errors;
}

test.describe('Fifth Aeon 全局冒烟', () => {
    let errors: string[];

    test.beforeEach(({ page }) => {
        errors = trackErrors(page);
    });

    test.afterEach(() => {
        expect(errors, '页面不应出现严重运行时错误').toEqual([]);
    });

    test('游客登录 → 大厅 → 开启 AI 对局', async ({ page }) => {
        await loginAsGuestIfNeeded(page);

        // 点击 对战 AI → 进入选卡组页（/select）
        await page
            .getByRole('button', { name: '对战 AI', exact: true })
            .click();
        await expect(page).toHaveURL(/\/select/);

        // 选择第一副起始卡组（卡内按钮顺序 [选用, 编辑, 删除] 已由 DOM 验证）
        const deckCard = page
            .locator('.mat-card')
            .filter({ hasText: /亡灵进军|The Meek|王的军团/i })
            .first();
        await deckCard.waitFor({ state: 'visible', timeout: 20_000 });
        await deckCard.locator('button').first().click();

        // 对局界面：开局可能弹出调度(mulligan)选择(时序竞争下偶发缺席),
        // 出现则点掉;资源条/卡牌带进场动画,headless 下可见性判定不稳定,
        // 统一断言 DOM 存在。
        await expect(page).toHaveURL(/\/game/, { timeout: 30_000 });
        const mulliganDone = page.getByRole('button', {
            name: /完成|Done/i
        });
        if (await mulliganDone.waitFor({ state: 'attached', timeout: 15_000 }).catch(() => false)) {
            await mulliganDone.click();
        }
        await expect(page.locator('ccg-resource-display').first()).toBeAttached({
            timeout: 30_000
        });
        // 开局后双方手牌合计至少 4 张 ccg-card
        await expect(page.locator('ccg-card').first()).toBeAttached({
            timeout: 30_000
        });
        expect(await page.locator('ccg-card').count()).toBeGreaterThanOrEqual(4);
    });

    test('懒加载页面：卡牌编辑器', async ({ page }) => {
        await loginAsGuestIfNeeded(page);
        await page.goto('/editor');
        await expect(
            page.getByText(/点击右下角的按钮开始创建卡牌|Card Editor|New Card/i).first()
        ).toBeVisible({ timeout: 30_000 });
    });

    test('懒加载页面：锦标赛', async ({ page }) => {
        await loginAsGuestIfNeeded(page);
        await page.goto('/tournament');
        await expect(
            page.getByText(/锦标赛|Tournament/i).first()
        ).toBeVisible({ timeout: 30_000 });
    });

    test('懒加载页面：管理面板（访客可进入页面，接口 403 不崩溃）', async ({ page }) => {
        await loginAsGuestIfNeeded(page);
        await page.goto('/admin');
        await expect(page.locator('ccg-admin-panel').first()).toBeVisible({
            timeout: 30_000
        });
    });
});

/**
 * 若尚未登录（无 localStorage 凭据），走完整游客登录流程。
 * 流程（已验证）：落地页等待初始化 → 新玩家 → 以访客身份游玩 →
 * 初始设置向导 → 进入大厅。
 */
async function loginAsGuestIfNeeded(page: Page) {
    await page.goto('/');
    const newPlayer = page.getByRole('button', { name: /新玩家|New Player/i });
    await newPlayer.waitFor({ state: 'visible', timeout: 20_000 });
    await newPlayer.click();

    const guestButton = page.getByRole('button', {
        name: /以访客身份游玩|Play as Guest/i
    });
    await guestButton.waitFor({ state: 'visible', timeout: 10_000 });
    await guestButton.click();

    // 新游客进入初始设置向导，等待"进入大厅"出现后点击
    const enterLobby = page.getByRole('button', {
        name: /进入大厅|Continue To Lobby/i
    });
    await enterLobby.waitFor({ state: 'visible', timeout: 40_000 });
    await enterLobby.click();

    await page.waitForURL(/\/lobby/, { timeout: 20_000 });
    await expect(
        page.getByText(/单人游戏|Singleplayer/i).first()
    ).toBeVisible({ timeout: 30_000 });
}
