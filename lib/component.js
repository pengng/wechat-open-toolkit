const EventEmitter = require('events')
const fs = require('fs')
const querystring = require('querystring')
const urlParser = require('url')
const Encrypt = require('wechat-encrypt')
const util = require('./util')
const error = require('./error')
const Authorizer = require('./authorizer')

const Component = function (options) {
  if (!(this instanceof Component)) {
    return new Component(options)
  }
  EventEmitter.call(this)
  this.componentAppId = options.componentAppId
  this.componentAppSecret = options.componentAppSecret
  this.host = options.host
  this.encrypt = new Encrypt({
    appId: this.componentAppId,
    encodingAESKey: options.encodingAESKey,
    token: options.token
  })
  this.on('component_verify_ticket', this.onComponentVerifyTicket.bind(this))
  this.on('authorized', this.onAuthorized.bind(this))
  this.authorizer = []
  const getComponentVerifyTicketCallback = function (err, componentVerifyTicket) {
    if (err) {
      return this.emit('error', err)
    }
    if (!componentVerifyTicket) {
      return this.on('component_verify_ticket', this.start.bind(this))
    }
    this.componentVerifyTicket = componentVerifyTicket
    this.start()
  }
  options.getComponentVerifyTicket(this.componentAppId, getComponentVerifyTicketCallback.bind(this))
}

Component.prototype = Object.create(EventEmitter.prototype)

const proto = {}
proto.middlewarify = function () {
  const middleware = function (req, res) {
    const infoType = req.wechatOpenMessage.InfoType
    this.emit(infoType, req.wechatOpenMessage)
  }
  return middleware.bind(this)
}
proto.authorizationMiddlewarify = function () {
  const readFileCallback = function (req, res, next, url, err, result) {
    if (err) {
      return next(err)
    }
    res.write(result.replace('{url}', url))
    res.end()
  }
  const getAuthorizationUrlCallback = function (req, res, next, err, url) {
    if (err) {
      return next(err)
    }
    fs.readFile(__dirname + '/../static/jump.html', readFileCallback.bind(this, req, res, next, url))
  }
  const middleware = function (req, res, next) {
    const isEncrypted = req.socket.encrypted
    const query = req.query || urlParser.parse(req.url, true).query
    if (query.auth_code) {
      req.query = query
      return next()
    }
    this.getAuthorizationUrl(req.url, isEncrypted, getAuthorizationUrlCallback.bind(this, req, res, next))
  }
  return middleware.bind(this)
}
proto.onComponentVerifyTicket = function (result) {
  this.componentVerifyTicket = result.ComponentVerifyTicket
}
proto.onAuthorized = function (result) {
  const authorizer = new Authorizer({
    authorizerAppId: result.AuthorizerAppid,
    authorizationCode: result.AuthorizationCode,
    component: this
  })
  const onAuthorizerAccessToken = function (result) {
    result.componentAppId = this.componentAppId
    this.emit('authorizer_token', result)
  }
  authorizer
    .on('error', this.emit.bind(this, 'error'))
    .on('authorizer_token', onAuthorizerAccessToken.bind(this))
    .start()
  this.authorizer.push(authorizer)
}
proto.getComponentAccessToken = function (callback) {
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
proto.getAuthorizationUrl = function (redirectUrl, isEncrypted, callback) {
  const getPreAuthCodeCallback = function (err, result) {
    if (err) {
      return callback(err)
    }
    const url = 'https://mp.weixin.qq.com/cgi-bin/componentloginpage'
    redirectUrl = (isEncrypted ? 'https://' : 'http://') + this.host + redirectUrl
    const query = {
      component_appid: this.componentAppId,
      pre_auth_code: result.pre_auth_code,
      redirect_uri: encodeURIComponent(redirectUrl)
    }
    const newUrl = url + '?' + querystring.stringify(query)
    callback(null, newUrl)
  }
  this.getPreAuthCode(getPreAuthCodeCallback.bind(this))
}
proto.start = function (text) {
  const callback = function (err, result) {
    if (err) {
      this.emit('error', err)
      this.timer = setTimeout(this.start.bind(this), 1000 * 60 * 10)
      return
    }
    result.componentAppId = this.componentAppId
    this.emit('component_access_token', result)
    this.componentAccessToken = result.component_access_token
    this.timer = setTimeout(this.start.bind(this), (result.expires_in - 60 * 10) * 1000)
  }
  this.getComponentAccessToken(callback.bind(this))
}

Object.assign(Component.prototype, proto)

module.exports = Component