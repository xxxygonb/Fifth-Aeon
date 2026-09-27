import { Component, HostListener, OnInit } from '@angular/core';
import { ClientState, WebClient } from '../client';
import { SoundManager } from '../sound';
import { AuthenticationService, UserData } from '../user/authentication.service';
import { P2PDialogComponent } from './p2p-dialog/p2p-dialog.component';

@Component({
    selector: 'ccg-lobby',
    templateUrl: './lobby.component.html',
    styleUrls: ['./lobby.component.scss']
})
export class LobbyComponent implements OnInit {
    public user: UserData;
    constructor(
        public client: WebClient,
        public soundManager: SoundManager,
        public auth: AuthenticationService
    ) {
        if (
            client.getState() !== ClientState.UnAuth &&
            client.getState() !== ClientState.Waiting
        ) {
            // 已处于 /lobby 子路由时只归位状态、不重复跳转,
            // 否则会把 /lobby/<子页> 打回大厅首页
            client.returnToLobby(false);
        }

        this.user = auth.getUser() as UserData;
        if (!this.user && this.client.getState() === ClientState.InLobby) {
            this.user = {
                username: 'Offline Player',
                role: 'user',
                token: '',
                mpToken: ''
            };
        }

        if (!this.soundManager.musicIsPlaying()) {
            this.soundManager.setFactionContext(new Set());
        }

        // Check for pending P2P join
        if (this.client.pendingP2PRoom) {
            const room = this.client.pendingP2PRoom;
            this.client.pendingP2PRoom = undefined;
            // timeout to ensure view is ready?
            setTimeout(() => this.openP2PDialog(room), 100);
        }
    }

    public openP2PDialog(autoJoinRoom?: string) {
        this.client.gameManager.dialog.open(P2PDialogComponent, {
            width: '600px',
            disableClose: false,
            data: { autoJoinRoom }
        });
    }

    // 排队等待已拆分为独立的 /queue 页(QueueComponent);
    // 登录/对局恢复由路由守卫(InPlayGuard/LoggedInGuard)统一处理,
    // 大厅不再承载恢复中间态视图。

    @HostListener('window:beforeunload')
    public exit() {
        if (this.client.getState() === ClientState.InQueue) {
            this.client.leaveQueue();
        }
        this.client.exitGame(true);
        return null;
    }

    ngOnInit() { }
}
