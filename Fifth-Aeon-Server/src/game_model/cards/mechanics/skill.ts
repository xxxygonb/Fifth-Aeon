import { CardType } from '../../card-types/card';
import { Mechanic } from '../../mechanic';

/**
 * 关键词类效果器(Flying/Rush/Lifesteal/Fury 等)的公共基类。
 *
 * 注意:本文件故意与 skills.ts 分开——效果器注册表(mechanicList.ts)
 * 会枚举各 mechanics/*.ts 模块的所有导出并注册进编辑器下拉,
 * 若把抽象基类与具体效果器放在同一模块,基类本身也会被注册成一个
 * 空白条目(getId() 继承到未初始化的 Mechanic.id)。
 */
export abstract class Skill extends Mechanic {
    public static readonly grantable = true;
    protected static validCardTypes = new Set([CardType.Unit, CardType.Item]);
}
