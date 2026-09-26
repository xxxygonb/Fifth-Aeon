import { HttpClient, HttpHeaders } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { apiURL } from '../url';
import { environment } from '../../environments/environment';

export interface UserData {
    token: string;
    username: string;
    mpToken: string;
    role: 'guest' | 'user' | 'mod' | 'admin';
}

interface GuestData extends UserData {
    password: string;
}

@Injectable()
export class AuthenticationService {
    private user: UserData | null = null;
    private authChangeCallbacks: Array<(user: UserData | null) => void> = [];
    // Shared "waiting for first login" promise so afterLogin() does not
    // append a new never-removed callback on every call.
    private afterLoginPromise: Promise<UserData> | null = null;
    // Shared "restore login state" promise so the many attemptLogin() callers
    // share one server round trip instead of racing each other.
    private initPromise: Promise<boolean> | null = null;
    private retryNoEarlierThan = 0;
    private redirectTarget = 'lobby';

    constructor(private http: HttpClient, private router: Router) { }

    public getRole() {
        if (this.user) {
            return this.user.role;
        }
    }

    public async checkServerAvailable() {
        if (environment.serverless) {
            return false;
        }
        try {
            await lastValueFrom(this.http.get(apiURL, { responseType: 'text' }));
            return true;
        } catch (err: any) {
            return err.status !== 0;
        }
    }

    /**
     * 恢复登录态（幂等）：无论多少处调用，只向服务器确认一次令牌。
     * 登录成功后 resolved 值为 true，且 this.user 已就绪。
     */
    public attemptLogin(): Promise<boolean> {
        // 上次失败后的 5 秒节流:避免路由守卫高频重试打爆服务器
        if (this.retryNoEarlierThan > Date.now()) {
            return Promise.resolve(false);
        }
        if (!this.initPromise) {
            this.initPromise = this.doAttemptLogin();
        }
        return this.initPromise;
    }

    /**
     * 登录态初始化完成的信号：路由守卫必须等待它，
     * 否则刷新页面时会在登录态恢复前误判为未登录。
     */
    public get ready(): Promise<boolean> {
        return this.attemptLogin();
    }

    private doAttemptLogin(): Promise<boolean> {
        if (environment.serverless) {
            return Promise.resolve(false);
        }
        try {
            const rawData = localStorage.getItem('login');
            if (!rawData) {
                return Promise.resolve(false);
            }
            const data = JSON.parse(rawData);
            return this.confirmLogin(data.token).then(res => {
                if (res) {
                    // 刷新场景下的自动恢复：只恢复登录态，
                    // 不触发 redirect() 导航（否则会与路由守卫竞争，
                    // 把用户从刷新前的页面拽到 redirectTarget）
                    this.setLogin(res, false);
                } else {
                    // 恢复失败(网络抖动/token 失效)不永久缓存:
                    // 允许下次路由导航时重试(5 秒节流由 retryNoEarlierThan 控制)
                    this.initPromise = null;
                    this.retryNoEarlierThan = Date.now() + 5000;
                }
                return res !== null;
            });
        } catch (e) {
            this.initPromise = null;
            this.retryNoEarlierThan = Date.now() + 5000;
            return Promise.resolve(false);
        }
    }

    public afterLogin(): Promise<UserData> {
        if (this.user != null) {
            return Promise.resolve(this.user);
        }
        if (!this.afterLoginPromise) {
            this.afterLoginPromise = new Promise(resolve => {
                this.onAuth(user => {
                    if (user !== null) {
                        resolve(user);
                    }
                });
            });
        }
        return this.afterLoginPromise;
    }

    public setRedirect(redirect: string) {
        this.redirectTarget = redirect;
    }

    public redirect() {
        console.log('redir to', this.redirectTarget);
        this.router.navigateByUrl('/' + this.redirectTarget);
    }

    public getUser(): UserData | null {
        if (this.user) {
            return { ...this.user };
        }
        return null;
    }

    public gotoLogin() {
        if (localStorage.getItem('madeAccount')) {
            this.router.navigateByUrl('/login');
        } else {
            this.router.navigateByUrl('/register');
        }
    }

    public loggedIn() {
        return this.user !== null;
    }

    public logout() {
        this.user = null;
        this.afterLoginPromise = null;
        // 允许之后再次尝试恢复登录态（此时 localStorage 已清空）
        this.initPromise = null;
        localStorage.setItem('login', '');
        this.authChangeCallbacks.forEach(callback => callback(null));
        this.router.navigateByUrl('/');
    }

    public onAuth(callback: (user: UserData | null) => void) {
        this.authChangeCallbacks.push(callback);
        if (this.loggedIn()) {
            callback(this.user);
        }
    }

    public getAuthHeader() {
        if (!this.user) {
            throw new Error('Cannot get auth token for unauthorized user');
        }
        return new HttpHeaders({
            token: this.user.token
        });
    }

    public verifyEmail(emailToken: string) {
        return lastValueFrom(this.http
            .post(
                `${apiURL}/api/auth/verifyEmail`,
                {},
                {
                    headers: new HttpHeaders({
                        token: emailToken
                    })
                }
            ));
    }

    public requestPasswordReset(usernameOrEmail: string) {
        return lastValueFrom(this.http
            .post(`${apiURL}/api/auth/requestReset`, {
                usernameOrEmail: usernameOrEmail
            }));
    }

    public resetPassword(restToken: string, newPassword: string) {
        return lastValueFrom<UserData>(this.http
            .post<UserData>(
                `${apiURL}/api/auth/verifyReset`,
                {
                    password: newPassword
                },
                {
                    headers: new HttpHeaders({
                        token: restToken
                    })
                }
            ))
            .then((res: UserData) => {
                this.setLogin(res);
            });
    }

    public upgradeAccount(username: string, email: string, password: string) {
        return lastValueFrom<UserData>(this.http
            .post<UserData>(
                `${apiURL}/api/auth/upgradeGuest`,
                {
                    username: username,
                    email: email.toLowerCase(),
                    password: password
                },
                { headers: this.getAuthHeader() }
            ))
            .then((res: UserData) => {
                this.setLogin(res);
                localStorage.setItem('madeAccount', 'true');
            });
    }

    public register(username: string, email: string, password: string) {
        return lastValueFrom<UserData>(this.http
            .post<UserData>(`${apiURL}/api/auth/register`, {
                username: username,
                email: email.toLowerCase(),
                password: password
            }))
            .then((res: UserData) => {
                this.setLogin(res);
                localStorage.setItem('madeAccount', 'true');
            });
    }

    public registerGuest() {
        return lastValueFrom<GuestData>(this.http
            .post<GuestData>(`${apiURL}/api/auth/registerGuest`, {}))
            .then((res: GuestData) => {
                this.setRedirect('initialSetup');
                this.setLogin(res);
                localStorage.setItem('madeAccount', 'true');
                localStorage.setItem('guest', res.password);
            });
    }

    public login(usernameOrEmail: string, password: string) {
        return lastValueFrom<UserData>(this.http
            .post<UserData>(`${apiURL}/api/auth/login`, {
                usernameOrEmail: usernameOrEmail,
                password: password
            }))
            .then(res => {
                this.setLogin(res);
            });
    }

    private confirmLogin(token: string): Promise<UserData | null> {
        return lastValueFrom<UserData>(this.http
            .get<UserData>(`${apiURL}/api/auth/userdata`, {
                headers: new HttpHeaders({
                    token: token
                })
            }))
            .then(res => res)
            .catch(err => null);
    }

    /**
     * 写入登录态并广播。
     * @param navigate 主动登录（登录页/注册/游客升级）为 true，登录后跳回
     *                 redirectTarget；刷新时的自动恢复必须传 false。
     */
    private setLogin(user: UserData, navigate = true) {
        this.user = user;
        localStorage.setItem('login', JSON.stringify(user));
        this.authChangeCallbacks.forEach(callback => callback(this.getUser()));
        if (navigate) {
            this.redirect();
        }
    }
}
