const EventEmitter = require('events')
const querystring = require('querystring')
const urlParser = require('url')
const Encrypt = require('wechat-encrypt')

const { https } = require('./network')
const util = require('./util')
const { validator } = util
const WechatOpenToolkitError = require('./error').WechatOpenToolkitError
const Authorizer = require('./authorizer')
const {
    EVENT_AUTHORIZED, EVENT_UNAUTHORIZED
} = require('./config')

const Component = function (options) {
    if (!(this instanceof Component)) {
        return new Component(options)
    }
    EventEmitter.call(this)
    this.enableReply = options.enableReply // 默认值为 false，当接收到微信消息通知，会自动回复“success“，避免出现消息回复超时的问题(可用客服消息代替回复功能)。开启后则需要开发者手动回复消息。
    this.componentAppId = options.componentAppId
    this.componentAppSecret = options.componentAppSecret
    this.authorizer = []
    this.host = options.host
    this.encrypt = new Encrypt({
        appId: this.componentAppId,
        encodingAESKey: options.encodingAESKey,
        token: options.token
    })
    this.on(EVENT_AUTHORIZED, this.onAuthorized.bind(this))
    this.on(EVENT_UNAUTHORIZED, this.onUnauthorized.bind(this))
}

Component.prototype = Object.create(EventEmitter.prototype)

const proto = {}

// 返回微信公众号消息事件处理的中间件
proto.messageMiddlewarify = function () {
    const sendTextCallback = function (err) {
        if (err) {
            this.emit('error', err)
        }
    }
    const middleware = function (req, res, next) {
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
                authorizer.sendText(msg.FromUserName, authorizationCode + '_from_api', sendTextCallback.bind(this))
            }
        }
    }
    return middleware.bind(this)
}

proto.getReplyXml = function (options) {
    let obj = {
        ToUserName: options.ToUserName,
        FromUserName: options.FromUserName,
        Content: options.Content,
        CreateTime: Date.now(),
        MsgType: 'text'
    }
    let xml = util.buildObject(obj)
    let encodeStr = this.encrypt.encode(xml)
    obj = {
        Encrypt: encodeStr,
        TimeStamp: Date.now(),
        Nonce: Math.random().toString(36).slice(2, 18)
    }
    obj.MsgSignature = this.encrypt.getSignature({
        timestamp: obj.TimeStamp,
        nonce: obj.Nonce,
        msg_encrypt: obj.Encrypt
    })
    xml = util.buildObject(obj)
    return xml
}
proto.authorizationMiddlewarify = function (authType) {
    const getAuthorizationUrlCallback = function (req, res, next, err, url) {
        if (err) {
            return next(err)
        }
        res.end(util.htmlTpl.replace('{url}', url))
    }
    const middleware = function (req, res, next) {
        const isEncrypted = req.socket.encrypted
        const query = req.query || urlParser.parse(req.url, true).query
        if (query.auth_code) {
            req.query = query
            return next()
        }
        this.getAuthorizationUrl(req.url, authType, isEncrypted, getAuthorizationUrlCallback.bind(this, req, res, next))
    }
    return middleware.bind(this)
}

proto.onAuthorized = function (result) {
    const options = {
        authorizerAppId: result.authorizerAppId,
        authorizationCode: result.authorizationCode,
    }
    this.addAuthorizer(options)
}
proto.onUnauthorized = function (result) {
    this.authorizer = this.authorizer.filter(function (item) {
        return item.authorizerAppId === result.authorizerAppId && item.stop()
    })
}

proto.getAuthorizer = function (authorizerAppId) {
    for (let i = 0, len = this.authorizer.length; i < len; i++) {
        if (this.authorizer[i].authorizerAppId === authorizerAppId) {
            return this.authorizer[i]
        }
    }
}
proto.getAuthorizerAccessToken = function (authorizerAppId, callback) {
    const onAuthorizerToken = function (result) {
        callback(null, result.authorizerAccessToken)
    }
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else if (authorizer.authorizerAccessToken) {
        callback(null, authorizer.authorizerAccessToken)
    } else {
        authorizer.once('authorizer_token', onAuthorizerToken)
    }
}
proto.getAuthorizerJsApiConfig = function (authorizerAppId, url, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.getJsApiConfig(url, callback)
    }
}

/**
 * 第三方平台对其所有API调用次数清零
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
proto.clearQuota = async function (componentAppId, componentAccessToken) {
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
proto.getComponentAccessToken = async function (componentAppId, componentAppSecret, componentVerifyTicket) {
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
proto.getPreAuthCode = async function (componentAppId, componentAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_create_preauthcode'
    let query = {
        component_access_token: componentAccessToken
    }
    let body = {
        component_appid: componentAppId 
    }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

/**
 * 获取第三方平台授权URL
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} preAuthCode 第三方平台预授权码
 * @param {string} host 第三方平台授权域名
 * @param {string} redirectUrl 授权后的重定向地址
 * @param {number} authType 授权类型
 * @param {boolean} isEncrypted 是否HTTPS
 */
proto.getAuthorizationUrl = function (componentAppId, preAuthCode, host, redirectUrl, authType, isEncrypted) {
    let url = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage'
    redirectUrl = (isEncrypted ? 'https://' : 'http://') + host + redirectUrl
    let query = {
        component_appid: componentAppId,
        pre_auth_code: preAuthCode,
        redirect_uri: redirectUrl,
        auth_type: authType || 3
    }
    url += '?' + querystring.stringify(query)
    return url
}

/**
 * 获取第三方平台的授权方列表
 * @param {string} componentAppId 第三方平台APPID
 * @param {string} componentAccessToken 第三方平台access token
 */
proto.getAuthorizerList = async function (componentAppId, componentAccessToken) {
    let url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_list'
    let query = { component_access_token: componentAccessToken }
    let body = { component_appid: componentAppId, offset: 0, count: 500 }
    url += '?' + querystring.stringify(query)

    let ret = await https.post(url, body)
    return validator(ret)
}

proto.oauthMiddlewarify = function (options) {
    const getUserInfoCallback = function (req, res, next, err, result) {
        const isFunc = typeof next === 'function'
        if (err) {
            this.emit('error', err)
            isFunc && next(err)
            return
        }
        req.wechat = result
        isFunc && next()
    }
    const getOauthAccessTokenCallback = function (req, res, next, err, result) {
        const isFunc = typeof next === 'function'
        if (err) {
            this.emit('error', err)
            isFunc && next(err)
            return
        }
        if (options.scope === 'snsapi_base') {
            req.wechat = result
            isFunc && next()
            return
        }
        this.getUserInfo({
            accessToken: result.access_token,
            openId: result.openid
        }, getUserInfoCallback.bind(this, req, res, next))
    }
    const middleware = function (req, res, next) {
        const urlObj = urlParser.parse(req.url, true)
        const query = urlObj.query
        if (!query.code) {
            const redirectUrl = (req.socket.encrypted ? 'https://' : 'http://') + this.host + req.url
            const newOptions = {
                authorizerAppId: options.authorizerAppId,
                redirectUrl: redirectUrl,
                scope: options.scope
            }
            res.writeHead(302, {
                Location: this.getOauthUrl(newOptions)
            })
            return res.end()
        }
        if (this.componentAccessToken) {
            this.getOauthAccessToken({
                authorizerAppId: options.authorizerAppId,
                code: query.code
            }, getOauthAccessTokenCallback.bind(this, req, res, next))
        } else {
            this.once('component_access_token', this.getOauthAccessToken.bind(this, {
                authorizerAppId: options.authorizerAppId,
                code: query.code
            }, getOauthAccessTokenCallback.bind(this, req, res, next)))
        }
    }
    return middleware.bind(this)
}


Object.assign(Component.prototype, proto)

module.exports = Component