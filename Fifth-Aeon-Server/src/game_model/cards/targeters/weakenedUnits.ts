import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { Targeter } from '../../targeter';
import { t } from '../../i18n';

export class DamagedUnit extends Targeter {
    protected static id = 'DamagedUnit';
    public getValidTargets(card: Card, game: Game) {
        return game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.getLife() < unit.getMaxLife());
    }
    public getText() {
        return t('target damaged unit');
    }
}
