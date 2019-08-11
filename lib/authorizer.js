const querystring = require('querystring')
const crypto = require('crypto')
const { validator } = require('./util')
const { https } = require('./network')

// 授权方网页授权类型
const OAUTH_TYPE_BASE = 'snsapi_base' // 基本授权可以得到用户openId
const OAUTH_TYPE_USERINFO = 'snsapi_userinfo' // 用户信息授权可以得到用户openId、unionId、头像和昵称

// 客服消息类型列表
const MSG_TYPE_TEXT = 'text'
const MSG_TYPE_IMAGE = 'image'
const MSG_TYPE_VOICE = 'voice'
const MSG_TYPE_VIDEO = 'video'
const MSG_TYPE_MUSIC = 'music'
const MSG_TYPE_NEWS = 'news' // 图文消息（点击跳转到外链）
const MSG_TYPE_MP_NEWS = 'mpnews' // 图文消息（点击跳转到图文消息页面）
const MSG_TYPE_MSG_MENU = 'msgmenu' // 菜单消息
const MSG_TYPE_WX_CARD = 'wxcard' // 卡券
const MSG_TYPE_MINI_PROGRAM_PAGE = 'miniprogrampage' // 小程序卡片

/**
 * 获取授权方的access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizationCode 授权码。公众号或小程序授权给第三方平台时得到
 */
async function getAccessToken(componentAppId, componentAccessToken, authorizationCode) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth'
    let query = { component_access_token: componentAccessToken }
    const body = { component_appid: componentAppId, authorization_code: authorizationCode }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取授权方的js api ticket
 * @param {string} authorizerAccessToken 授权方的access token
 */
async function getJsApiTicket(authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'
    let query = { access_token: authorizerAccessToken, type: 'jsapi' }
    url += '?' + querystring.stringify(query)
    let ret = await https.get(url)

    return validator(ret)
}

/**
 * 获取授权方的账号基本信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 */
async function getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_info'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)

    return validator(ret)
}

/**
 * 获取授权方的选项设置信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 */
async function getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_option'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId, option_name: optionName }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)

    return validator(ret)
}

/**
 * 设置授权方选项信息
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台 access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} optionName 选项名
 * @param {number} optionValue 选项值
 */
async function setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_set_authorizer_option'
    let query = { component_access_token: componentAccessToken }
    let body = {
        component_appid: componentAppId, authorizer_appid: authorizerAppId,
        option_name: optionName, option_value: optionValue.toString()
    }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 创建开放平台帐号并绑定公众号/小程序
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function createOpenAccount(authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/create'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId }
    url += '?' + querystring.stringify(query)
    
    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 将公众号/小程序绑定到开放平台帐号下
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/bind'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId, open_appid: openAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 将公众号/小程序从开放平台帐号下解绑
 * @param {string} openAppId 开放平台账号appid
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方 access token
 */
async function unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/unbind'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId, open_appid: openAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取公众号/小程序所绑定的开放平台帐号
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerAccessToken 授权方access token
 */
async function getOpenAccount(authorizerAppId, authorizerAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/open/get'
    let query = { access_token: authorizerAccessToken }
    let body = { appid: authorizerAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取授权方的Js API config
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerJsApiTicket 授权方 js api ticket
 * @param {string} url 要配置的url
 */
function getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url) {
    let noncestr = Math.random().toString(36).slice(2) // 随机字符串
    let timestamp = Math.ceil(Date.now() / 1000) // 时间戳
    url = url.split('#')[0]

    let params = { noncestr, timestamp, url, jsapi_ticket: authorizerJsApiTicket } // 待签名参数
    let keyList = Object.keys(params) // 取全部字段名

    keyList.sort() // 将字段名按 ASCII 排序
    let rawStr = keyList.map(key => `${key}=${params[key]}`).join('&') // 将全部键值对拼接成字符串

    let signature = crypto.createHash('sha1').update(rawStr).digest('hex') // 生成签名

    return { appId: authorizerAppId, timestamp, nonceStr: noncestr, signature}
}

/**
 * 获取授权方网页授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} redirectUrl 授权后的重定向URL
 * @param {string} scope 授权类型
 * @param {string} state 授权附带值
 */
function getOAuthUrl(componentAppId, authorizerAppId, redirectUrl, scope = 'snsapi_base', state = '') {
    const url = 'https://open.weixin.qq.com/connect/oauth2/authorize'
    const query = {
        appid: authorizerAppId,
        redirect_uri: encodeURIComponent(redirectUrl),
        response_type: 'code',
        scope, state,
        component_appid: componentAppId
    }
    const keys = ['appid', 'redirect_uri', 'response_type', 'scope', 'state', 'component_appid']
    const iteration = function (item) {
        return item + '=' + query[item]
    }
    const querystr = keys.map(iteration).join('&')
    const newUrl = url + '?' + querystr + '#wechat_redirect'
    return newUrl
}

/**
 * 获取授权方的网页授权access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} code 网页授权code
 */
async function getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code) {
    let url = 'https://api.weixin.qq.com/sns/oauth2/component/access_token'
    let query = {
        appid: authorizerAppId,
        code,
        grant_type: 'authorization_code',
        component_appid: componentAppId,
        component_access_token: componentAccessToken
    }
    url += '?' + querystring.stringify(query)
    let ret = https.get(url)
    return validator(ret)
}

/**
 * 获取微信用户信息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 */
async function getUserInfo(authorizerAccessToken, openId) {
    let url = 'https://api.weixin.qq.com/sns/userinfo'
    let query = { access_token: authorizerAccessToken, openid: openId, lang: 'zh_CN' }
    url += '?' + querystring.stringify(query)
    let ret = await https.get(url)
    return validator(ret)
}

/**
 * 刷新授权方的 access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 * @param {string} authorizerAppId 授权方APPID
 * @param {string} authorizerRefreshToken 授权方 refresh token
 */
async function refreshAccessToken(componentAppId, componentAccessToken, authorizerAppId, authorizerRefreshToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_authorizer_token'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, authorizer_appid: authorizerAppId, authorizer_refresh_token: authorizerRefreshToken }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 发送客服消息
 * @param {string} authorizerAccessToken 授权方access token
 * @param {string} openId 微信用户openId
 * @param {string} type 消息类型
 * @param {Object} content 消息主体
 */
async function send(authorizerAccessToken, openId, type, content) {
    let url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send'
    let query = {
        access_token: authorizerAccessToken
    }
    let body = {
        touser: openId,
        msgtype: type,
        [type]: content
    }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

module.exports = {
    getAccessToken, getJsApiTicket, getAuthorizerInfo, getAuthorizerOptionInfo, setAuthorizerOption,
    createOpenAccount, bindOpenAccount, unbindOpenAccount, getOpenAccount, getJsApiConfig, getOAuthUrl,
    getOauthAccessToken, getUserInfo, refreshAccessToken, send, 

    MSG_TYPE_TEXT, MSG_TYPE_IMAGE, MSG_TYPE_VOICE, MSG_TYPE_VIDEO, MSG_TYPE_MUSIC, MSG_TYPE_NEWS,
    MSG_TYPE_MP_NEWS, MSG_TYPE_MSG_MENU, MSG_TYPE_WX_CARD, MSG_TYPE_MINI_PROGRAM_PAGE,

    OAUTH_TYPE_BASE, OAUTH_TYPE_USERINFO
}