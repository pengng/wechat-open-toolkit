const querystring = require('querystring')
const { https } = require('./network')
const { validator } = require('./util')

// 第三方平台授权类型列表
const AUTH_TYPE_MP = 1 // 授权方手机端只展示公众号列表
const AUTH_TYPE_MINI_PROGRAM = 2 // 授权方手机端只展示小程序列表
const AUTH_TYPE_BOTH = 3 // 授权方手机端展示公众号和小程序列表

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
 * @param {number} authType 授权类型
 */
function getAuthorizationUrl(componentAppId, preAuthCode, redirectUrl, authType) {
    let url = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage'
    let query = {
        component_appid: componentAppId,
        pre_auth_code: preAuthCode,
        redirect_uri: redirectUrl,
        auth_type: authType
    }
    url += '?' + querystring.stringify(query)
    return url
}

/**
 * 获取第三方平台的授权方列表
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
async function getAuthorizerList(componentAppId, componentAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_list'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, offset: 0, count: 500 }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

module.exports = {
    clearQuota, getComponentAccessToken, getPreAuthCode, getAuthorizationUrl, getAuthorizerList,

    AUTH_TYPE_MP, AUTH_TYPE_MINI_PROGRAM, AUTH_TYPE_BOTH
}