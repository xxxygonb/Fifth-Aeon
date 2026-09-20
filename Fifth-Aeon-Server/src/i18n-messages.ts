/**
 * Server-side i18n dictionary and helpers.
 *
 * Standalone mini implementation (mirrors game_model/i18n) so server messages
 * stay decoupled from the shared model's dictionary registry. English source
 * text is used as the dictionary key; missing keys gracefully fall back to
 * English so network messages never break when a translation is missing.
 *
 * The default locale is zh-CN and can be overridden with the FA_LOCALE
 * environment variable ("zh-CN" | "en-US").
 */

export const zhCNServer: Record<string, string> = {
    // ---- errors.ts ------------------------------------------------------
    'Error of type: {type} - {message}': '错误类型：{type} - {message}',

    // ---- server.ts ------------------------------------------------------
    'You must be logged in to set your deck.': '你必须先登录才能设置卡组。',
    'Invalid Deck.': '无效的卡组。',
    'Not logged in.': '尚未登录。',
    'Not in game.': '你不在对局中。',

    // ---- matchmaking.ts ---------------------------------------------------
    'You must be logged in to start a private game.':
        '你必须先登录才能发起私人对局。',
    'Must be logged in': '需要先登录',
    'No game with that id.': '没有该 ID 对应的对局。',
    'Not Logged in': '尚未登录',
    'Already in queue': '已在匹配队列中',

    // ---- gameServer.ts ----------------------------------------------------
    'Cannot take action {action}': '无法执行操作：{action}',

    // ---- routes/validators.ts ---------------------------------------------
    'Request lacks required parameter(s).': '请求缺少必需的参数。',

    // ---- authentication (routes + model) ------------------------------------
    done: '完成',
    'No such account': '账号不存在',
    'Incorrect password': '密码错误',
    'Reset email sent': '重置邮件已发送',
    'Authentication model is not connected to a server instance.':
        '身份验证模块未连接到服务器实例。',

    // ---- routes/collection.routes.ts ----------------------------------------
    'No packs to open.': '没有可打开的卡包。',
    'Not enough gold to buy that.': '金币不足，无法购买。',

    // ---- draft (routes + model) ----------------------------------------------
    'Draft started': '轮抽已开始',
    'Cannot start draft: {reason}': '无法开始轮抽：{reason}',
    success: '成功',
    'no data': '无数据',
    'Not Enough Gold': '金币不足',
    'Already in draft': '已在轮抽中',

    // ---- routes/tournament.routes.ts -----------------------------------------
    'No such submission.': '没有该提交。',

    // ---- models/tournament.model.ts -------------------------------------------
    // (keys are the English source strings verbatim, typos included)
    'Cannot form a team, you are already already on a team':
        '无法创建战队：你已经在某个战队中',
    'Your not on a team': '你不在任何战队中',
    'You are not the leader of a team.': '你不是战队的队长。',
    'Cannot join team,  you are already already on a team':
        '无法加入战队：你已经在某个战队中',
    'No team exists with that join code.': '没有使用该加入码的战队。',
    'Cannot leave team your not in one': '无法退出战队：你不在任何战队中',
    'No Active tournament': '当前没有进行中的锦标赛',
    'Multiple Active tournaments': '存在多个进行中的锦标赛',

    // ---- passwords.ts ----------------------------------------------------------
    'Requires higher user role': '需要更高的用户权限',
    'Requires Authentication': '需要身份验证'
};

export type ServerLocale = 'zh-CN' | 'en-US';

const envLocale = process.env.FA_LOCALE as ServerLocale | undefined;
const locale: ServerLocale = envLocale === 'en-US' ? 'en-US' : 'zh-CN';

/**
 * Translate a static server message. The key is the English source text.
 */
export function tsrv(text: string): string {
    if (locale === 'en-US') {
        return text;
    }
    return zhCNServer[text] ?? text;
}

/**
 * Translate a templated server message with {placeholder} interpolation.
 * The key is the English template source text.
 */
export function tsrvf(
    template: string,
    params: Record<string, string | number>
): string {
    const localized =
        locale === 'en-US' ? template : zhCNServer[template] ?? template;
    return localized.replace(/\{(\w+)\}/g, (match, name) =>
        params.hasOwnProperty(name) ? String(params[name]) : match
    );
}
