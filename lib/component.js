const querystring = require('querystring')
const { https } = require('./network')
const { validator } = require('./util')

// 第三方平台授权类型列表
const AUTH_TYPE_MP = 1              // 授权方手机端只展示公众号列表
const AUTH_TYPE_MINI_PROGRAM = 2    // 授权方手机端只展示小程序列表
const AUTH_TYPE_BOTH = 3            // 授权方手机端展示公众号和小程序列表

// 第三方平台授权页样式
const PAGE_STYLE_PC = 1             // 适用于PC的页面样式
const PAGE_STYLE_MOBILE = 2         // 适用于移动设备的页面样式

const PAGE_SIZE = 20                // 获取第三方平台已授权账号列表的分页大小

/**
 * 第三方平台对其所有API调用次数清零
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function clearQuota(componentAppId, componentAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/clear_quota'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取第三方平台的access token
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAppSecret 第三方平台APP SECRET
 * @param {string} componentVerifyTicket 第三方平台verify ticket
 */
async function getComponentAccessToken(componentAppId, componentAppSecret, componentVerifyTicket) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_component_token'
    let body = {
        component_appid: componentAppId,
        component_appsecret: componentAppSecret,
        component_verify_ticket: componentVerifyTicket
    }
    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取第三方平台预授权码
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function getPreAuthCode(componentAppId, componentAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_create_preauthcode'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取第三方平台授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} preAuthCode 第三方平台预授权码
 * @param {string} redirectUrl 授权后的重定向地址
 * @param {number|string} authType 授权类型；bizAppId 指定授权方APPID
 * @param {number} pageStyle 页面风格
 */
function getAuthorizationUrl(componentAppId, preAuthCode, redirectUrl, authType, pageStyle) {
    let url = {
        [PAGE_STYLE_PC]: 'https://mp.weixin.qq.com/cgi-bin/componentloginpage',
        [PAGE_STYLE_MOBILE]: 'https://mp.weixin.qq.com/safe/bindcomponent'
    }[pageStyle]

    let query = { component_appid: componentAppId, pre_auth_code: preAuthCode, redirect_uri: redirectUrl }

    if (typeof authType === 'number') {
        Object.assign(query, { auth_type: authType })
    } else if (typeof authType === 'string') {
        Object.assign(query, { biz_appid: authType })
    }

    if (pageStyle === PAGE_STYLE_MOBILE) {
        Object.assign(query, { action: 'bindcomponent', no_scan: 1 })
        url += '?' + querystring.stringify(query) + '#wechat_redirect'
    } else if (pageStyle === PAGE_STYLE_PC) {
        url += '?' + querystring.stringify(query)
    }

    return url
}

/**
 * 获取第三方平台的授权方列表
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function getAuthorizerList(componentAppId, componentAccessToken, offset) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_list'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, offset, count: PAGE_SIZE }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

module.exports = {
    clearQuota, getComponentAccessToken, getPreAuthCode, getAuthorizationUrl, getAuthorizerList,

    AUTH_TYPE_MP, AUTH_TYPE_MINI_PROGRAM, AUTH_TYPE_BOTH, PAGE_STYLE_PC, PAGE_STYLE_MOBILE
}