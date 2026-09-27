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

    /** 离线模式下公共匹配不可用(需登录态) */
    public queueDisabled() {
        return !this.client.isConnected() || this.client.isOffline();
    }
}
