import { Component, HostListener, OnInit } from '@angular/core';
import { EditorDataService } from '../editor-data.service';
import { AuthenticationService } from 'app/user/authentication.service';
import { SetInformation } from 'app/game_model/cardSet';
import { MatSlideToggleChange } from '@angular/material/slide-toggle';

@Component({
    selector: 'ccg-set-editor',
    templateUrl: './set-editor.component.html',
    styleUrls: ['./set-editor.component.scss']
})
export class SetEditorComponent implements OnInit {
    constructor(
        public editorData: EditorDataService,
        private auth: AuthenticationService
    ) {
        this.auth.setRedirect('/editor/sets');
        this.auth.attemptLogin();
    }

    public newSet() {
      this.editorData.createSet();
    }

    public changePublicity(set: SetInformation, event: MatSlideToggleChange) {
        set.public = event.checked;
    }

    public deleteSet(set: SetInformation) {
        if (!confirm(`Are you sure you want to delete the set ${set.name}? This action is irreversible.`)) {
            return;
        }
        this.editorData.deleteSet(set);
    }

    public getChangeCardsLink(set: SetInformation) {
        return `/editor/sets/${set.id}`;
    }


    ngOnInit() {}

    /** 任意编辑交互都置脏标记，驱动 10 秒自动保存 */
    @HostListener('input')
    @HostListener('change')
    @HostListener('click')
    public onEditorActivity() {
        this.editorData.markDirty();
    }
}
