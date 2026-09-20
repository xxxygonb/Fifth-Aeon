import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { TriggeredMechanic } from '../../mechanic';
import { ParameterType } from '../parameters';
import { t, tf } from '../../i18n';

export class WinIfHighLife extends TriggeredMechanic {
    protected static id = 'WinIfHighLife';
    protected static ParameterTypes = [
        { name: 'Threshold', type: ParameterType.NaturalNumber }
    ];

    constructor(private threshold: number = 1) {
        super();
    }

    public onTrigger(card: Card, game: Game) {
        const friendlyPlayer = game.getPlayer(card.getOwner());
        const enemyPlayer = game.getPlayer(
            game.getOtherPlayerNumber(card.getOwner())
        );

        if (friendlyPlayer.getLife() >= this.threshold) {
            enemyPlayer.die();
        }
    }

    public getText(card: Card) {
        return tf('If you have {n} or more life you win the game.', {
            n: this.threshold
        });
    }

    public evaluateEffect(card: Card, game: Game) {
        const friendlyPlayer = game.getPlayer(card.getOwner());
        if (friendlyPlayer.getLife() >= this.threshold) {
            return Infinity;
        }
        return 0;
    }
}
