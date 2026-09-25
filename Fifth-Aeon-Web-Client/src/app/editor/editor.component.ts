import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ClientState, WebClient } from '../client';

@Component({
    selector: 'ccg-editor',
    templateUrl: './editor.component.html',
    styleUrls: ['./editor.component.scss']
})
export class EditorComponent implements OnInit {
    constructor(private client: WebClient, private router: Router) {}

    ngOnInit() {}

    /**
     * 返回大厅的统一入口：如果玩家还在匹配队列/对局中，
     * 先正确退出（发 ExitQueue / Quit），否则从编辑器回大厅
     * 会直接落在「排队中」界面。
     */
    public goHome() {
        switch (this.client.getState()) {
            case ClientState.InGame:
            case ClientState.InQueue:
            case ClientState.Waiting:
            case ClientState.PrivateLobby:
                this.client.returnToLobby();
                return;
        }
        this.router.navigate(['/lobby']);
    }
}
