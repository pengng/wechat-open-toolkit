const EventEmitter = require('events')
const WechatApi = require('wechat-api')
const xml2js = require('xml2js')

const error = require('./error')
const { WechatOpenToolkitError } = error
const Component = require('./component')
const { getBody } = require('./network')

// 事件列表
const EVENT_COMPONENT_VERIFY_TICKET = 'component_verify_ticket' // 当微信服务器向第三方服务器推送 ticket 时触发
const EVENT_AUTHORIZED = 'authorized' // 当有新的公众号授权给第三方平台时触发
const EVENT_UPDATE_AUTHORIZED = 'updateauthorized' // 当已授权公众号的授权权限更新时触发
const EVENT_UNAUTHORIZED = 'unauthorized' // 当已授权公众号取消授权时触发

const xmlParser = new xml2js.Parser({
    explicitRoot: false,
    explicitArray: false
})

// 解板XML数据
function parseXMLSync(str) {
    return new Promise(function (resolve, reject) {
        xmlParser.parseString(str, function (err, result) {
            if (err) {
                reject(err)
            } else {
                resolve(result)
            }
        })
    })
}

function Toolkit(options) {
    EventEmitter.call(this)
    let components = {} // 第三方平台列表

    options.list.foreach((item) => {
        let { componentAppId } = item
        item.getComponentVerifyTicket = options.getComponentVerifyTicket
        const component = new Component(item)
        component
            .on('component_access_token', this.emit.bind(this, 'component_access_token'))
            .on('error', this.emit.bind(this, 'error'))
            .on('authorizer_token', this.emit.bind(this, 'authorizer_token'))
            .on('authorizer_jsapi_ticket', this.emit.bind(this, 'authorizer_jsapi_ticket'))

        components[componentAppId] = component
    })

    this.components = components
    this.on(EVENT_COMPONENT_VERIFY_TICKET, this.onReceiveComponentVerifyTicket.bind(this))
}

Toolkit.prototype = Object.create(EventEmitter.prototype)

const proto = {}

// 当接收到 component_verify_ticket 时触发
proto.onReceiveComponentVerifyTicket = function (data) {
    let { AppId, ComponentVerifyTicket } = data
    Object.assign(this.component[AppId], { ComponentVerifyTicket }) // 内部储存 component_verify_ticket
}

/**
 * 获取指定的第三方平台
 * @param {string} componentAppId 第三方平台APPID
 */
proto.getComponent = function (componentAppId) {
    let { [componentAppId]: component } = this.components
    if (component) {
        return component
    }
    throw new WechatOpenToolkitError('componentAppId 不存在')
}

proto.getApi = function (componentAppId, authorizerAppId) {
    const getAuthorizerAccessTokenCallback = function (callback, err, accessToken) {
        if (err) {
            return callback(err)
        }
        callback(null, {
            accessToken: accessToken,
            expireTime: Date.now() + 1000 * 60 * 60
        })
    }
    const getApiAccessToken = function (callback) {
        this.getAuthorizerAccessToken(componentAppId, authorizerAppId, getAuthorizerAccessTokenCallback.bind(this, callback))
    }
    return new WechatApi('', '', getApiAccessToken.bind(this))
}
proto.getJsConfig = function (options, callback) {
    try {
        this.getComponent(options.componentAppId).getAuthorizerJsApiConfig(options.authorizerAppId, options.url, callback)
    } catch(err) {
        callback(err)
    }
}
proto.getAuthorizerAccessToken = function (componentAppId, authorizerAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch(err) {
        return callback(err)
    }
    if (component.authorizer.length > 0) {
        return component.getAuthorizerAccessToken(authorizerAppId, callback)
    }
    component.once('init_authorizer', function () {
        component.getAuthorizerAccessToken(authorizerAppId, callback)
    })
}
/**
 * 获取授权方账号基本信息
 * @param {string} componentAppId 第三方平台appId
 * @param {string} authorizerAppId 授权方公众号appId
 * @param {Function} callback 
 */
proto.getAuthorizerInfo = function (componentAppId, authorizerAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    if (component.authorizer.length > 0) {
        return component.getAuthorizerInfo(authorizerAppId, callback)
    }
    component.once('init_authorizer', function () {
        component.getAuthorizerInfo(authorizerAppId, callback)
    })
}

/**
 * 获取授权方选项设置信息
 * @param {string} componentAppId 第三方平台appId
 * @param {string} authorizerAppId 授权方公众号appId
 * @param {string} optionName 选项名
 * @param {Function} callback 
 */
proto.getAuthorizerOptionInfo = function (componentAppId, authorizerAppId, optionName, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    if (component.authorizer.length > 0) {
        return component.getAuthorizerOptionInfo(authorizerAppId, callback)
    }
    component.once('init_authorizer', function () {
        component.getAuthorizerOptionInfo(authorizerAppId, callback)
    })
}

/**
 * 设置授权方选项
 * @param {string} componentAppId 第三方平台appId
 * @param {string} authorizerAppId 授权方appId
 * @param {string} optionName 选项名
 * @param {number} optionValue 选项值
 * @param {Function} callback 
 */
proto.setAuthorizerOption = function (componentAppId, authorizerAppId, optionName, optionValue, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    if (component.authorizer.length > 0) {
        return component.setAuthorizerOption(authorizerAppId, optionName, optionValue, callback)
    }
    component.once('init_authorizer', function () {
        component.setAuthorizerOption(authorizerAppId, optionName, optionValue, callback)
    })
}

/**
 * 第三方平台对其所有API调用次数清零
 * @param {string} componentAppId 
 * @param {Function} callback 
 */
proto.clearQuota = function (componentAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    if (component.componentAccessToken) {
        return component.clearQuota(callback)
    }
    component.once('component_access_token', component.clearQuota.bind(component, callback))
}

/**
 * 创建开放平台帐号并绑定公众号/小程序
 * @param {string} componentAppId 
 * @param {string} authorizerAppId 
 * @param {Function} callback 
 */
proto.createOpenAccount = function (componentAppId, authorizerAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    component.createOpenAccount(authorizerAppId, callback)
}

/**
 * 将公众号/小程序绑定到开放平台帐号下
 * @param {string} componentAppId
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.bindOpenAccount = function (componentAppId, authorizerAppId, openAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    component.bindOpenAccount(authorizerAppId, openAppId, callback)
}

/**
 * 将公众号/小程序从开放平台帐号下解绑
 * @param {string} componentAppId
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.unbindOpenAccount = function (componentAppId, authorizerAppId, openAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    component.unbindOpenAccount(authorizerAppId, openAppId, callback)
}

/**
 * 获取公众号/小程序所绑定的开放平台帐号
 * @param {string} componentAppId
 * @param {string} authorizerAppId 
 * @param {string} openAppId 
 * @param {Function} callback 
 */
proto.getOpenAccount = function (componentAppId, authorizerAppId, callback) {
    let component = null
    try {
        component = this.getComponent(componentAppId)
    } catch (err) {
        return callback(err)
    }
    component.getOpenAccount(authorizerAppId, callback)
}

// 返回第三方平台授权相关事件的中间件
proto.events = function () {
    return async (req, res) => {
        try {
            let body = await getBody(req) // 获取请求主体
            res.end('success') // 接收完请求主体后，返回 success
            let bodyRaw = body.toString() // 转换成字符串
            let xml = await parseXMLSync(bodyRaw) // 解析XML数据成JS对象
    
            let { AppId: appId, Encrypt: encrypt } = xml
    
            if (appId && encrypt) {
                let str = this.getComponent(appId).encrypt.decode(encrypt) // 解密数据
                let xml = await parseXMLSync(str) // 解析XML数据成JS对象
                let { infoType } = xml
                this.emit(infoType, xml) // 触发相应事件
            } else {
                // 请求主体不包含特定字段，说明数据有误
                this.emit('error', new WechatOpenToolkitError('AppId 或 Encrypt 字段不存在'))
            }
        } catch(err) {
            this.emit('error', err)
        }
    }
}

/**
 * 返回微信公众号消息事件处理的中间件
 * @param {string} componentAppId 第三方平台APPID
 */
proto.message = function (componentAppId) {
    async (req, res) => {
        try {
            let body = await getBody(req) // 获取请求主体
            // res.end('success') // 接收完请求主体后，返回 success
            let bodyRaw = body.toString() // 转换成字符串
            let xml = await parseXMLSync(bodyRaw) // 解析XML数据

            let { Encrypt: encrypt } = xml

            if (encrypt) {
                let str = this.getComponent(componentAppId).encrypt.decode(encrypt) // 解密数据
                let xml = await parseXMLSync(str) // 解析XML数据成JS对象
                req.wechat = xml
                this.getComponent(AppId).messageMiddlewarify()(req, res, next)
            } else {
                // 请求主体不包含特定字段，说明数据有误
                this.emit('error', new WechatOpenToolkitError('Encrypt 字段不存在'))
            }

        } catch(err) {
            this.emit('error', err) // 如果有错误，触发错误事件
        }
    }
}

// 返回第三方授权处理的中间件
proto.auth = function (componentAppId, authType) {
    return this.getComponent(componentAppId).authorizationMiddlewarify(authType)
}

// 返回微信公众号网页授权的中间件
proto.oauth = function (options) {
    return this.getComponent(options.componentAppId).oauthMiddlewarify(options)
}

Object.assign(Toolkit.prototype, proto)
Object.assign(Toolkit, { EVENT_COMPONENT_VERIFY_TICKET, EVENT_AUTHORIZED, EVENT_UPDATE_AUTHORIZED, EVENT_UNAUTHORIZED })

module.exports = Toolkit