const EventEmitter = require('events')
const querystring = require('querystring')
const urlParser = require('url')
const Encrypt = require('wechat-encrypt')

const { https } = require('./network')
const util = require('./util')
const WechatOpenToolkitError = require('./error').WechatOpenToolkitError
const Authorizer = require('./authorizer')
const {
    EVENT_COMPONENT_VERIFY_TICKET, EVENT_AUTHORIZED, EVENT_UPDATE_AUTHORIZED, EVENT_UNAUTHORIZED
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
    this.once('component_access_token', this.onComponentAccessToken.bind(this))
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

proto.onComponentAccessToken = function () {
    const iteration = function (item) {
        this.addAuthorizer({
            authorizerAppId: item.authorizer_appid,
            authorizerRefreshToken: item.refresh_token
        })
    }
    const getAuthorizersCallback = function (err, result) {
        if (err) {
            return this.emit('error', err)
        }
        result.list.forEach(iteration.bind(this))
        this.emit('init_authorizer', result.list)
    }
    this.getAuthorizers(getAuthorizersCallback.bind(this))
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
proto.addAuthorizer = function (options) {
    options = options || {}
    const isAdded = this.authorizer.some(function (item) {
        return item.authorizerAppId === options.authorizerAppId
    })
    if (isAdded) {
        return this.emit('error', new WechatOpenToolkitError('The authorizerAppId already exists'))
    }
    const authorizer = new Authorizer({
        authorizerAppId: options.authorizerAppId,
        authorizationCode: options.authorizationCode,
        authorizerRefreshToken: options.authorizerRefreshToken,
        component: this
    })
    const onAuthorizerToken = function (result) {
        result.componentAppId = this.componentAppId
        this.emit('authorizer_token', result)
    }
    const onAuthorizerJsApiTicket = function (result) {
        result.componentAppId = this.componentAppId
        this.emit('authorizer_jsapi_ticket', result)
    }
    authorizer
        .on('error', this.emit.bind(this, 'error'))
        .on('authorizer_token', onAuthorizerToken.bind(this))
        .on('authorizer_jsapi_ticket', onAuthorizerJsApiTicket.bind(this))
        .start()
    this.authorizer.push(authorizer)
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
 * 获取授权方公众号基本信息
 * @param {string} authorizerAppId 授权方公众号appId
 * @param {Function} callback 
 */
proto.getAuthorizerInfo = function (authorizerAppId, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.getAuthorizerInfo(callback)
    }
}

/**
 * 获取授权方选项设置信息
 * @param {string} authorizerAppId 授权方公众号appId
 * @param {string} optionName 选项名
 * @param {Function} callback 
 */
proto.getAuthorizerOptionInfo = function (authorizerAppId, optionName, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.getAuthorizerOptionInfo(callback)
    }
}

/**
 * 设置授权方选项
 * @param {string} authorizerAppId 授权方appId
 * @param {string} optionName 选项名
 * @param {number} optionValue 选项值
 * @param {Function} callback 
 */
proto.setAuthorizerOption = function (authorizerAppId, optionName, optionValue, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.setAuthorizerOption(optionName, optionValue, callback)
    }
}

/**
 * 第三方平台对其所有API调用次数清零
 * @param {Function} callback 
 */
proto.clearQuota = function (callback) {
    if (!this.componentAccessToken) {
        return callback(new WechatOpenToolkitError('The component access token does not exists!'))
    }
    const url = 'https://api.weixin.qq.com/cgi-bin/component/clear_quota'
    const query = {
        component_access_token: this.componentAccessToken
    }
    const body = {
        component_appid: this.componentAppId
    }
    const newUrl = url + '?' + querystring.stringify(query)
    const options = {
        url: newUrl,
        method: 'post',
        body: body,
        json: true
    }
    util.request(options, util.wrapper(callback))
}

/**
 * 创建开放平台帐号并绑定公众号/小程序
 * @param {string} authorizerAppId 
 * @param {Function} callback 
 */
proto.createOpenAccount = function (authorizerAppId, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.createOpenAccount(callback)
    }
}

/**
 * 将公众号/小程序绑定到开放平台帐号下
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.bindOpenAccount = function (authorizerAppId, openAppId, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.bindOpenAccount(openAppId, callback)
    }
}

/**
 * 将公众号/小程序从开放平台帐号下解绑
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.unbindOpenAccount = function (authorizerAppId, openAppId, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.unbindOpenAccount(openAppId, callback)
    }
}

/**
 * 获取公众号/小程序所绑定的开放平台帐号
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.getOpenAccount = function (authorizerAppId, callback) {
    const authorizer = this.getAuthorizer(authorizerAppId)
    if (!authorizer) {
        callback(new WechatOpenToolkitError('The authorizerAppId does not exist'))
    } else {
        authorizer.getOpenAccount(callback)
    }
}

/**
 * 获取第三方平台的access token
 */
proto.getComponentAccessToken = function (appId, appSecret, verifyTicket) {
    const url = 'https://api.weixin.qq.com/cgi-bin/component/api_component_token'
    const body = {
        component_appid: this.componentAppId,
        component_appsecret: this.componentAppSecret,
        component_verify_ticket: this.componentVerifyTicket
    }
    util.request({
        url: url,
        method: 'post',
        body: body,
        json: true
    }, util.wrapper(callback))
}

proto.getPreAuthCode = function (callback) {
    if (!this.componentAccessToken) {
        return callback(new WechatOpenToolkitError('The component access token does not exists!'))
    }
    const url = 'https://api.weixin.qq.com/cgi-bin/component/api_create_preauthcode'
    const query = {
        component_access_token: this.componentAccessToken
    }
    const body = {
        component_appid: this.componentAppId 
    }
    const newUrl = url + '?' + querystring.stringify(query)
    util.request({
        url: newUrl,
        method: 'post',
        body: body,
        json: true
    }, util.wrapper(callback))
}
proto.getAuthorizationUrl = function (redirectUrl, authType, isEncrypted, callback) {
    const getPreAuthCodeCallback = function (err, result) {
        if (err) {
            return callback(err)
        }
        const url = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage'
        redirectUrl = (isEncrypted ? 'https://' : 'http://') + this.host + redirectUrl
        const query = {
            component_appid: this.componentAppId,
            pre_auth_code: result.pre_auth_code,
            redirect_uri: redirectUrl,
            auth_type: authType || 3
        }
        const newUrl = url + '?' + querystring.stringify(query)
        callback(null, newUrl)
    }
    this.getPreAuthCode(getPreAuthCodeCallback.bind(this))
}
proto.getAuthorizers = function (callback) {
    if (!this.componentAccessToken) {
        return callback(new WechatOpenToolkitError('The component access token does not exists!'))
    }
    const url = 'https://api.weixin.qq.com/cgi-bin/component/api_get_authorizer_list'
    const query = {
        component_access_token: this.componentAccessToken
    }
    const body = {
        component_appid: this.componentAppId,
        offset: 0,
        count: 500
    }
    const newUrl = url + '?' + querystring.stringify(query)
    util.request({
        url: newUrl,
        method: 'post',
        body: body,
        json: true
    }, util.wrapper(callback))
}
proto.getOauthUrl = function (options) {
    options = options || {}
    const url = 'https://open.weixin.qq.com/connect/oauth2/authorize'
    const query = {
        appid: options.authorizerAppId,
        redirect_uri: encodeURIComponent(options.redirectUrl),
        response_type: 'code',
        scope: options.scope || 'snsapi_base',
        state: options.state || '',
        component_appid: this.componentAppId
    }
    const keys = ['appid', 'redirect_uri', 'response_type', 'scope', 'state', 'component_appid']
    const iteration = function (item) {
        return item + '=' + query[item]
    }
    const querystr = keys.map(iteration).join('&')
    const newUrl = url + '?' + querystr + '#wechat_redirect'
    return newUrl
}
proto.getOauthAccessToken = function (options, callback) {
    if (!this.componentAccessToken) {
        return callback(new WechatOpenToolkitError('The component access token does not exists!'))
    }
    const url = 'https://api.weixin.qq.com/sns/oauth2/component/access_token'
    const query = {
        appid: options.authorizerAppId,
        code: options.code,
        grant_type: 'authorization_code',
        component_appid: this.componentAppId,
        component_access_token: this.componentAccessToken
    }
    const newUrl = url + '?' + querystring.stringify(query)
    const newOptions = {
        url: newUrl,
        method: 'get',
        json: true
    }
    util.request(newOptions, util.wrapper(callback))
}
proto.getUserInfo = function (options, callback) {
    const url = 'https://api.weixin.qq.com/sns/userinfo'
    const query = {
        access_token: options.accessToken,
        openid: options.openId,
        lang: 'zh_CN'
    }
    const newUrl = url + '?' + querystring.stringify(query)
    const newOptions = {
        url: newUrl,
        method: 'get',
        json: true
    }
    util.request(newOptions, util.wrapper(callback))
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

proto.start = function () {
    this.getComponentAccessToken((err, result) => {
        if (err) {
            this.emit('error', err)
            this.timer = setTimeout(this.start.bind(this), 1000 * 60 * 10)
            return
        }
        this.componentAccessToken = result.component_access_token
        this.emit('component_access_token', {
            componentAppId: this.componentAppId,
            componentAccessToken: this.componentAccessToken,
            expiresIn: parseInt(result.expires_in)
        })
        this.timer = setTimeout(this.start.bind(this), (result.expires_in - 60 * 10) * 1000)
    })
}

Object.assign(Component.prototype, proto)

module.exports = Component