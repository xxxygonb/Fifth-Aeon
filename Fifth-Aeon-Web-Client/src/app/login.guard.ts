import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthenticationService } from 'app/user/authentication.service';
import { SettingsService } from './settings/settings.service';

@Injectable()
export class LoggedInGuard implements CanActivate {
    constructor(
        private auth: AuthenticationService,
        private router: Router,
        private settings: SettingsService
    ) { }

    /**
     * 刷新页面时，登录态是异步从 localStorage + 服务器恢复的。
     * 守卫必须等待 auth.ready（登录态初始化完成）再判断，
     * 否则会在恢复完成前误判为未登录，把用户踢回落地页。
     */
    async canActivate(route: ActivatedRouteSnapshot) {
        await this.auth.ready;
        const ok = this.auth.loggedIn() || this.settings.isOffline();
        const redirectUrl = route.pathFromRoot
            .map(item => item.url.join('/'))
            .join('/');
        if (!ok) {
            this.auth.setRedirect(redirectUrl);
            this.router.navigateByUrl('/');
        }
        return ok;
    }
}
