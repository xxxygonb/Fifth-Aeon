import { Component } from '@angular/core';
import { WebClient } from '../client';
import { environment } from '../../environments/environment';

/** 多人游戏:公共匹配 / P2P 对战 */
@Component({
    selector: 'ccg-lobby-multi',
    templateUrl: './lobby-multi.component.html',
    styleUrls: ['./lobby-page.shared.scss']
})
export class LobbyMultiComponent {
    constructor(public client: WebClient) {}

    public isServerless() {
        return environment.serverless;
    }
}
