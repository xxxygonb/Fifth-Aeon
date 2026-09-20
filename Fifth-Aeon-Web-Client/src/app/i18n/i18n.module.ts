import { NgModule } from '@angular/core';
import { TrPipe } from './tr.pipe';

/**
 * Shared i18n module. Import this in any feature module whose templates use
 * the `| tr` pipe.
 */
@NgModule({
    declarations: [TrPipe],
    exports: [TrPipe]
})
export class I18nModule {}
