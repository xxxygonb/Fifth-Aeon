import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { I18nService } from '../i18n/i18n.service';

@Component({
    selector: 'ccg-end-dialog',
    templateUrl: './end-dialog.component.html',
    styleUrls: ['./end-dialog.component.scss']
})
export class EndDialogComponent implements OnInit {
    public winner = false;
    public quit = false;
    public rewards = '';

    constructor(
        public dialogRef: MatDialogRef<EndDialogComponent>,
        private i18n: I18nService
    ) {
        this.rewards = this.i18n.tr('Loading rewards...');
    }

    ngOnInit() {}
}
