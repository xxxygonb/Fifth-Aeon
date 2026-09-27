import { sampleSize } from 'lodash';
import { Card } from './card-types/card';
import { cardList } from './cards/cardList';

/**
 * 卡池抽样抽象(B5): 开包(Booster.open)、轮抽(Draft)等一切
 * "从卡池随机取卡"的统一入口。未来引入稀有度/保底等规则时,
 * 只需新增实现或在构造时注入权重,调用方不感知。
 */
export interface CardSampler {
    /** 从卡池抽 n 张卡(同一包内不重复) */
    sampleCards(n: number): Card[];
}

/** 均匀抽样: 卡池内每张卡概率相同(当前线上行为) */
export class UniformCardSampler implements CardSampler {
    constructor(private pool: Card[] = cardList.getCards()) {}

    public sampleCards(n: number): Card[] {
        return sampleSize(this.pool, n);
    }
}

/**
 * 加权抽样: 按 weightOf 返回的权重轮盘抽取(为稀有度体系 A2 预留)。
 * 采用有放回抽样, n 大于池大小时允许重复。
 */
export class WeightedCardSampler implements CardSampler {
    constructor(
        private pool: Card[] = cardList.getCards(),
        private weightOf: (card: Card) => number = () => 1
    ) {}

    public sampleCards(n: number): Card[] {
        const weights = this.pool.map(c => Math.max(0, this.weightOf(c)));
        const total = weights.reduce((a, b) => a + b, 0);
        const picked: Card[] = [];
        for (let i = 0; i < n; i++) {
            if (total <= 0) {
                // 全零权重退化: 均匀有放回
                picked.push(this.pool[Math.floor(Math.random() * this.pool.length)]);
                continue;
            }
            let roll = Math.random() * total;
            for (let j = 0; j < this.pool.length; j++) {
                roll -= weights[j];
                if (roll <= 0) {
                    picked.push(this.pool[j]);
                    break;
                }
            }
        }
        return picked;
    }
}
