import { defineConfig } from '@playwright/test';

/**
 * Playwright 冒烟测试配置。
 *
 * 前置条件：
 * - 游戏服务器运行在 http://localhost:2222（游客账号/卡组数据需要数据库），
 *   一键启动脚本 start.bat / start.sh 会同时拉起两端。
 * - Angular dev server 若未运行，Playwright 会自动用 `ng serve` 拉起
 *   （webServer.reuseExistingServer = true 时已有实例则复用）。
 */
export default defineConfig({
    testDir: './e2e',
    timeout: 120_000,
    expect: { timeout: 15_000 },
    fullyParallel: false,
    workers: 1,
    reporter: [['list']],
    use: {
        baseURL: 'http://localhost:4200',
        // 使用系统 Chrome，避免额外下载浏览器二进制
        channel: 'chrome',
        headless: true,
        viewport: { width: 1600, height: 900 }
    },
    webServer: {
        command: 'npx ng serve --port 4200',
        url: 'http://localhost:4200',
        reuseExistingServer: true,
        timeout: 240_000
    }
});
