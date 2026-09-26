import { Unit } from '../card-types/unit';
import { DefaultAI } from './defaultAi';
import { aiList } from './aiList';

/**
 * 中等难度 AI:轻度评估噪声,偶有小失误,整体接近满配决策核心。
 */
export class MediumAI extends DefaultAI {
    protected noiseRange(): [number, number] {
        return [0.85, 1.15];
    }

    protected skipResourceChance(): number {
        return 0;
    }

    protected evaluateCard(card: import('../card-types/card').Card) {
        const result = super.evaluateCard(card);
        const [low, high] = this.noiseRange();
        result.score *= low + Math.random() * (high - low);
        return result;
    }
}

aiList.registerConstructor(MediumAI);
