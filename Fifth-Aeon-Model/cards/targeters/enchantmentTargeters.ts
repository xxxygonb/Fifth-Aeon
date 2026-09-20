import { Permanent } from '../../card-types/permanent';
import { Targeter } from '../../targeter';
import { Card } from 'app/game_model/card-types/card';
import { Game } from 'app/game_model/game';
import { t } from '../../i18n';

export class AllEnchantments extends Targeter {
    protected static id = 'AllEnchantments';
    protected lastTargets: Array<Permanent> = [];
    public getText() {
        return t('all enchantments');
    }
    public getPronoun() {
        return t('them');
    }
    public needsInput() {
        return false;
    }
    public getTargets(card: Card, game: Game): Array<Permanent> {
        this.lastTargets = game.getBoard().getAllEnchantments();
        return this.lastTargets;
    }
    public getLastTargets() {
        return this.lastTargets;
    }
}
