import { Card } from '../../card-types/card';
import { Game } from '../../game';
import { Targeter } from '../../targeter';
import { Unit, UnitType } from '../../card-types/unit';
import { AllUnits } from './basicTargeter';
import { t, tf } from '../../i18n';

export class UnitsOfTypeAsTarget extends AllUnits {
    protected static id = 'UnitsOfTypeAsTarget';

    public needsInput() {
        return true;
    }
    public getValidTargets(card: Card, game: Game) {
        return game.getBoard().getAllUnits();
    }
    public getTargets(card: Card, game: Game): Array<Unit> {
        const target = this.targets[0] as Unit;
        if (!target) {
            return [];
        }
        this.lastTargets = game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.getUnitType() === target.getUnitType() );
        return this.lastTargets;
    }
    public getText() {
        return t('target unit and all units of the same type');
    }
}

export class UnitsOfType extends AllUnits {
    protected static id = 'UnitsOfType';
    constructor(private type: UnitType) {
        super();
    }
    public getTargets(card: Card, game: Game): Array<Unit> {
        this.lastTargets = game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.getUnitType() === this.type);
        return this.lastTargets;
    }
    public getText() {
        return tf('all {type} units', { type: t(UnitType[this.type]) });
    }
}

export class FriendlyUnitsOfType extends AllUnits {
    protected static id = 'FriendlyUnitsOfType';
    constructor(private type: UnitType) {
        super();
    }
    public getTargets(card: Card, game: Game): Array<Unit> {
        this.lastTargets = game
            .getBoard()
            .getAllUnits()
            .filter(
                unit =>
                    unit.getUnitType() === this.type &&
                    unit.getOwner() === card.getOwner()
            );
        return this.lastTargets;
    }
    public getText() {
        return tf('all friendly {type} units', {
            type: t(UnitType[this.type])
        });
    }
}

export class UnitsNotOfType extends AllUnits {
    protected static id = 'UnitsNotOfType';
    constructor(private type: UnitType) {
        super();
    }
    public getTargets(card: Card, game: Game): Array<Unit> {
        this.lastTargets = game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.getUnitType() !== this.type);
        return this.lastTargets;
    }
    public getText() {
        return tf('all non-{type} units', { type: t(UnitType[this.type]) });
    }
}

export class UnitOfType extends Targeter {
    protected static id = 'UnitOfType';
    constructor(private type: UnitType) {
        super();
    }
    public getValidTargets(card: Card, game: Game) {
        return game
            .getBoard()
            .getAllUnits()
            .filter(unit => unit.getUnitType() === this.type);
    }
    public getText() {
        return tf('target {type}', { type: t(UnitType[this.type]) });
    }
}
