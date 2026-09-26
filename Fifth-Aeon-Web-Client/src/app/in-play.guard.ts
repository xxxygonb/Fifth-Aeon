import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { WebClient } from './client';
import { AuthenticationService } from './user/authentication.service';
import { I18nService } from './i18n/i18n.service';

/**
 * 对局路由守卫(刷新恢复):
 *  1. 等待登录态恢复完成(刷新后必经);
 *  2. AI 局 → 本地快照重放恢复(瞬时);
 *  3. 联机局 → ResendGame 请求服务器重发对局(5 秒内)。
 * 恢复成功:放行,URL 始终保持在 /game,玩家直接回到对局;
 * 恢复失败:回大厅并给出提示(对局已结束/未能恢复)。
 */
@Injectable()
export class InPlayGuard implements CanActivate {
    constructor(
        private client: WebClient,
        private router: Router,
        private auth: AuthenticationService,
        private snackbar: MatSnackBar,
        private i18n: I18nService
    ) {}

    async canActivate(): Promise<boolean> {
        await this.auth.ready;
        if (this.client.isInGame()) {
            return true;
        }
        const restored = await this.client.tryRestoreGame();
        if (restored) {
            return true;
        }
        this.router.navigate(['/lobby']);
        this.snackbar.open(
            this.i18n.tr('Game not available. Back to lobby.'),
            undefined,
            { duration: 4000 }
        );
        return false;
    }
}
