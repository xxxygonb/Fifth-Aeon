import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { EvalContext, UnitTargetedMechanic, maybeEvaluate, EvalMap } from '../../mechanic';
import { Unit } from '../../card-types/unit';
import { t, tf } from '../../i18n';

export class ShuffleIntoDeck extends UnitTargetedMechanic {
    protected static id = 'ShuffleIntoDeck';
    public onTrigger(card: Card, game: Game) {
        const targets = this.targeter.getUnitTargets(card, game, this);
        for (const target of targets) {
            game.returnPermanentToDeck(target);
        }
    }

    public getText(card: Card) {
        return tf("Shuffle {target} into their owner's deck.", {
            target: this.targeter.getTextOrPronoun()
        });
    }

    public evaluateUnitTarget(source: Card, target: Unit, game: Game, evaluated: EvalMap) {
        return (
            maybeEvaluate(game, EvalContext.NonlethalRemoval, target, evaluated) *
            (target.getOwner() === source.getOwner() ? -1 : 1)
        );
    }
}
