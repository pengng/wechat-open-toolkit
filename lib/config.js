// 事件列表
const EVENT_COMPONENT_VERIFY_TICKET = 'component_verify_ticket' // 当微信服务器向第三方服务器推送 ticket 时触发
const EVENT_AUTHORIZED = 'authorized' // 当有新的公众号授权给第三方平台时触发
const EVENT_UPDATE_AUTHORIZED = 'updateauthorized' // 当已授权公众号的授权权限更新时触发
const EVENT_UNAUTHORIZED = 'unauthorized' // 当已授权公众号取消授权时触发

module.exports = {
    EVENT_COMPONENT_VERIFY_TICKET, EVENT_AUTHORIZED, EVENT_UPDATE_AUTHORIZED, EVENT_UNAUTHORIZED,
}