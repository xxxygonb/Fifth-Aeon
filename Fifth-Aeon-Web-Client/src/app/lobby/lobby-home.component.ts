import { Component } from '@angular/core';
import { WebClient } from '../client';

/** 大厅首页:游戏功能分类入口 */
@Component({
    selector: 'ccg-lobby-home',
    templateUrl: './lobby-home.component.html',
    styleUrls: ['./lobby-page.shared.scss']
})
export class LobbyHomeComponent {
    constructor(public client: WebClient) {}
}
