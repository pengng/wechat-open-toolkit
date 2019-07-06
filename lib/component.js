const querystring = require('querystring')
const { https } = require('./network')
const util = require('./util')
const { validator } = util

// 第三方平台授权类型列表
const AUTH_TYPE_MP = 1 // 授权方手机端只展示公众号列表
const AUTH_TYPE_MINI_PROGRAM = 2 // 授权方手机端只展示小程序列表
const AUTH_TYPE_BOTH = 3 // 授权方手机端展示公众号和小程序列表

// 返回微信公众号消息事件处理的中间件
function messageMiddlewarify() {
    return (req, res, next) => {
        const authTest = 'gh_3c884a361561'
        const authTestAppId = 'wx570bc396a51b8ff8'
        const msg = req.wechat
        const reply = {
            ToUserName: msg.FromUserName,
            FromUserName: msg.ToUserName,
        }

        res.text = (content) => {
            reply.Content = content
            let xml = this.getReplyXml(reply)
            res.end(xml)
        }

        if (msg.ToUserName !== authTest) {
            !this.enableReply && res.end('success') // 同一条消息不能多次回复。回复了“success“后，则无法回复其他消息(可用客服消息代替回复功能)
            return next()
        }

        if (msg.MsgType === 'event') {
            reply.Content = msg.Event + 'from_callback'
            const xml = this.getReplyXml(reply)
            res.end(xml)
        } else if (msg.MsgType === 'text') {
            if (msg.Content === 'TESTCOMPONENT_MSG_TYPE_TEXT') {
                reply.Content = msg.Content + '_callback'
                const xml = this.getReplyXml(reply)
                res.end(xml)
            } else if (msg.Content.indexOf('QUERY_AUTH_CODE:') >= 0) {
                res.end('')
                const authorizationCode = msg.Content.slice(16)
                const authorizer = this.getAuthorizer(authTestAppId)
                authorizer.sendText(msg.FromUserName, authorizationCode + '_from_api', (err) => {
                    if (err) {
                        this.emit('error', err)
                    }
                })
            }
        }
    }
}

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

/**
 * 生成被动回复消息的函数
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} encodingAESKey 消息加解密Key
 * @param {string} token 消息加密token
 * @param {string} fromUserName 消息发送者
 * @param {string} toUserName 消息接收者
 * @param {string} type 消息类型
 * @param {string} tpl 消息模板
 */
function genReplyFunc(componentAppId, encodingAESKey, token, fromUserName, toUserName, type, tpl) {
    return function () {
        let data = {
            ToUserName: toUserName,
            FromUserName: fromUserName,
            CreateTime: Date.now(),
            MsgType: type
        }
        let jsonRaw = tpl.replace(/\{(\d+)\}/g, (_, key) => arguments[key])
        Object.assign(data, JSON.parse(jsonRaw))

        let wechatEncrypt = new WechatEncrypt({ appId: componentAppId, encodingAESKey, token })
        let xml = util.buildObject(data)
        let encodeStr = wechatEncrypt.encode(xml)
        data = {
            Encrypt: encodeStr,
            TimeStamp: Date.now(),
            Nonce: Math.random().toString(36).slice(2, 18)
        }
        data.MsgSignature = wechatEncrypt.getSignature({
            timestamp: obj.TimeStamp,
            nonce: obj.Nonce,
            msg_encrypt: obj.Encrypt
        })
        xml = util.buildObject(obj)
        this.end(xml)
    }
}

module.exports = {
    clearQuota, getComponentAccessToken, getPreAuthCode, getAuthorizationUrl, getAuthorizerList,
    getReplyXml, messageMiddlewarify, genReplyFunc,

    AUTH_TYPE_MP, AUTH_TYPE_MINI_PROGRAM, AUTH_TYPE_BOTH
}