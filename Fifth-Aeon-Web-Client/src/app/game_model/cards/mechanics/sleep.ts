import { Card, CardType } from '../../card-types/card';
import { Game } from '../../game';
import { EvalContext, Mechanic, UnitTargetedMechanic, maybeEvaluate, EvalMap } from '../../mechanic';
import { Unit } from '../../card-types/unit';
import { t, tf } from '../../i18n';

export class Sleeping extends Mechanic {
    protected static id = 'Sleeping';
    protected static validCardTypes = new Set([CardType.Unit]);

    constructor(private turns: number = 1) {
        super();
    }
    public enter(card: Card, game: Game) {
        const unit = card as Unit;
        unit.setExhausted(true);
        game.getEvents().startOfTurn.addEvent(this, params => {
            if (params.player === unit.getOwner()) {
                unit.setExhausted(true);
                this.turns--;
                if (this.turns < 1) {
                    unit.removeMechanic(this.getId(), game);
                }
            }
            return params;
        });
    }

    public stack() {
        this.turns++;
    }

    public remove(card: Card, game: Game) {
        game.gameEvents.removeEvents(this);
    }

    public getText(card: Card) {
        if (this.turns === 1) {
            return t('Sleeping.');
        } else {
            return tf('Sleeping ({n}).', { n: this.turns });
        }
    }

    public evaluate() {
        return this.turns * -3;
    }
}

export class SleepTarget extends UnitTargetedMechanic {
    protected static id = 'SleepTarget';
    constructor(private turns: number = 1) {
        super();
    }

    public onTrigger(card: Card, game: Game) {
        for (const target of this.targeter.getUnitTargets(card, game, this)) {
            target.addMechanic(new Sleeping(this.turns), game);
        }
    }

    public getText(card: Card) {
        if (this.turns === 1) {
            return tf('Put {target} to sleep for a turn.', {
                target: this.targeter.getTextOrPronoun()
            });
        }
        return tf('Put {target} to sleep for {n} turns.', {
            target: this.targeter.getTextOrPronoun(),
            n: this.turns
        });
    }

    public evaluateUnitTarget(source: Card, target: Unit, game: Game, evaluated: EvalMap) {
        return (
            maybeEvaluate(game, EvalContext.NonlethalRemoval, target, evaluated) *
            0.5 *
            (target.getOwner() === source.getOwner() ? -1 : 1)
        );
    }
}
