import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { UnitTargetedMechanic } from '../../mechanic';
import { Unit } from '../../card-types/unit';
import { t, tf } from '../../i18n';

export class RefreshTarget extends UnitTargetedMechanic {
    protected static id = 'RefreshTarget';
    public onTrigger(card: Card, game: Game) {
        for (const target of this.targeter.getUnitTargets(card, game, this)) {
            target.refresh();
        }
    }

    public getText(card: Card) {
        return tf('Refresh {target}.', {
            target: this.targeter.getTextOrPronoun()
        });
    }

    public evaluateUnitTarget(source: Card, target: Unit) {
        return (
            0.1 *
            (target.isExhausted() ? 1 : 0) *
            (target.getOwner() === source.getOwner() ? 1 : -1)
        );
    }
}
