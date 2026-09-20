import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { Targeter } from '../../targeter';
import { t, tf } from '../../i18n';

export class UnitWithAbility extends Targeter {
    protected static id = 'UnitWithAbility';
    constructor(private abilityId: string, private desc: string) {
        super();
    }
    public getValidTargets(card: Card, game: Game) {
        return game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.hasMechanicWithId(this.abilityId));
    }
    public getText() {
        return tf('target {desc} unit', { desc: t(this.desc) });
    }
}
