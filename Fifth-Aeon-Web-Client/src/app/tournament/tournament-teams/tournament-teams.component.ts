import { Component, OnInit } from '@angular/core';
import { TeamsService } from '../teams.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
    selector: 'ccg-tournament-teams',
    templateUrl: './tournament-teams.component.html',
    styleUrls: ['./tournament-teams.component.scss']
})
export class TournamentTeamsComponent implements OnInit {
    constructor(public teams: TeamsService, private snackbar: MatSnackBar) {}

    ngOnInit() {}

    public promptAndJoin() {
        const code = prompt('请输入队伍邀请码');
        if (code) {
            this.teams.joinTeam(code);
        }
    }

    public clipboardMessage() {
        this.snackbar.open('邀请码已复制到剪贴板。');
    }


    public teamDescription() {
        const data = this.teams.getTeamData();
        if (!data) {
            return '你还没有加入队伍';
        }
        return `你是「${data.teamName}」队伍的${
            data.isLeader ? '队长' : '一名成员'
        }。`;
    }

    public exitText() {
        const data = this.teams.getTeamData();
        if (!data) {
            return '你还没有加入队伍';
        }
        return `${data.isLeader ? '解散' : '退出'}队伍`;
    }

    public exitAction() {
        if (
            confirm('确定要这么做吗？此操作无法撤销。')
        ) {
            console.log('confd');
            this.teams.exitOrDissolve();
        }
    }
}
