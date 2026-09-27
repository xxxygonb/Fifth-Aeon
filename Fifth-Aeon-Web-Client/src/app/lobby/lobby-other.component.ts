import { Component } from '@angular/core';
import { AuthenticationService, UserData } from '../user/authentication.service';
import { WebClient } from '../client';

/** 其他:设置 / 帮助 / 账号 */
@Component({
    selector: 'ccg-lobby-other',
    templateUrl: './lobby-other.component.html',
    styleUrls: ['./lobby-page.shared.scss']
})
export class LobbyOtherComponent {
    public user: UserData;

    constructor(public client: WebClient, public auth: AuthenticationService) {
        this.user = auth.getUser() as UserData;
    }
}
