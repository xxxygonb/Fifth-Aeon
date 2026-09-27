import { Component } from '@angular/core';
import { WebClient } from '../client';

/** 单人游戏:对战 AI / 轮抽 / 开卡包 */
@Component({
    selector: 'ccg-lobby-single',
    templateUrl: './lobby-single.component.html',
    styleUrls: ['./lobby-page.shared.scss']
})
export class LobbySingleComponent {
    constructor(public client: WebClient) {}
}
