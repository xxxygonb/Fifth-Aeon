import { Component } from '@angular/core';

/** 卡组代码导入对话框：替代原来的阻塞式 prompt()，长代码不再被截断 */
@Component({
    selector: 'ccg-deck-import-dialog',
    templateUrl: './deck-import-dialog.component.html',
    styleUrls: ['./deck-import-dialog.component.scss']
})
export class DeckImportDialogComponent {
    public code = '';
}
