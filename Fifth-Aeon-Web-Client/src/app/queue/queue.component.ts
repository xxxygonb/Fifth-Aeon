import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ClientState, WebClient } from '../client';

/** 公共对战排队页:等待对手 + 取消排队(从 LobbyComponent 拆分出的独立职责) */
@Component({
    selector: 'ccg-queue',
    template: `
        <div class="queue-page">
            <h1>{{ 'In Queue. Waiting for an opponent.' | tr }}</h1>
            <mat-progress-spinner
                attr.color="primary"
                mode="indeterminate"
            ></mat-progress-spinner>
            <button mat-raised-button color="warn" (click)="cancel()">
                {{ 'Cancel' | tr }}
            </button>
        </div>
    `,
    styles: [
        `
            .queue-page {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 24px;
                padding-top: 10vh;
            }
        `
    ]
})
export class QueueComponent {
    constructor(public client: WebClient, private router: Router) {}

    public isQueueing(): boolean {
        const state = this.client.getState();
        return state === ClientState.InQueue || state === ClientState.Waiting;
    }

    /** 取消排队并回大厅(若已被匹配则直接跟随进入对局) */
    public cancel() {
        this.client.leaveQueue();
        this.router.navigate(['/lobby']);
    }
}
