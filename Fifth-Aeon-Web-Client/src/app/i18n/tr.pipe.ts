import { Pipe, PipeTransform } from '@angular/core';
import { I18nService } from './i18n.service';

/**
 * Template translation pipe. Keys are the English source strings.
 * Usage: {{ 'Play vs A.I' | tr }} or {{ 'Tip {n}' | tr: { n: 3 } }}
 */
@Pipe({ name: 'tr' })
export class TrPipe implements PipeTransform {
    constructor(private i18n: I18nService) {}

    transform(
        key: string,
        params?: Record<string, string | number>
    ): string {
        return this.i18n.tr(key, params);
    }
}
