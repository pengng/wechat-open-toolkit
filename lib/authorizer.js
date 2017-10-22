const EventEmitter = require('events')
const querystring = require('querystring')
const crypto = require('crypto')
const util = require('./util')
const error = require('./error')

const Authorizer = function (options) {
  if (!(this instanceof Authorizer)) {
    return new Authorizer(options)
  }
  if (!options.authorizerAppId) {
    throw new error.WechatOpenToolkitError('Authorizer() require authorizerAppId')
  }
  if (!options.component) {
    throw new error.WechatOpenToolkitError('Authorizer() require component')
  }
  if (!(options.authorizationCode || options.authorizerRefreshToken)) {
    throw new error.WechatOpenToolkitError('Authorizer() authorizationCode and authorizerRefreshToken can\'t all be undefined')
  }
  EventEmitter.call(this)
  this.component = options.component
  this.authorizerAppId = options.authorizerAppId
  this.authorizationCode = options.authorizationCode
  this.authorizerRefreshToken = options.authorizerRefreshToken
}

Authorizer.prototype = Object.create(EventEmitter.prototype)

const proto = {}
proto.getAccessToken = function (callback) {
  if (!this.component.componentAccessToken) {
    return callback(new error.WechatOpenToolkitError('The component access token does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/component/api_query_auth'
  const query = {
    component_access_token: this.component.componentAccessToken
  }
  const newUrl = url + '?' + querystring.stringify(query)
  const body = {
    component_appid: this.component.componentAppId,
    authorization_code: this.authorizationCode
  }
  const options = {
    url: newUrl,
    method: 'post',
    body: body,
    json: true
  }
  util.request(options, util.wrapper(callback))
}

proto.getJsApiTicket = function (callback) {
  const url = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket'
  const query = {
    access_token: this.authorizerAccessToken,
    type: jsapi
  }
  const newUrl = url + '?' + querystring.stringify(query)
  const options = {
    url: newUrl,
    method: 'get',
    json: true
  }
  util.request(options, util.wrapper(callback))
}

proto.getJsApiConfig = function (url, callback) {
  if (!this.authorizerJsApiTicket) {
    return this.once('authorizer_jsapi_ticket', this.getJsApiConfig.bind(this, url, callback))
  }
  const query = {
    noncestr: Math.random().toString(36).slice(2, 18),
    timestamp: Date.now(),
    url: url.split('#')[0],
    jsapi_ticket: this.authorizerJsApiTicket
  }
  const arr = []
  for (let key in query) {
    arr.push(key + '=' + query[key])
  }
  const str = arr.sort().join('&')
  const encrypt = crypto.createHash('sha1').update(str).digest('hex')
  callback(null, {
    appId: this.authorizerAppId,
    timestamp: query.timestamp,
    nonceStr: query.noncestr,
    signature: encrypt,
    jsApiList: []
  })
}

proto.refreshAccessToken = function (callback) {
  if (!this.component.componentAccessToken) {
    return callback(new error.WechatOpenToolkitError('The component access token does not exists!'))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/component/api_authorizer_token'
  const query = {
    component_access_token: this.component.componentAccessToken
  }
  const newUrl = url + '?' + querystring.stringify(query)
  const body = {
    component_appid: this.component.componentAppId,
    authorizer_appid: this.authorizerAppId,
    authorizer_refresh_token: this.authorizerRefreshToken
  }
  const options = {
    url: newUrl,
    method: 'post',
    body: body,
    json: true
  }
  util.request(options, util.wrapper(callback))
}
proto.sendText = function (openId, text, callback) {
  if (!this.authorizerAccessToken) {
    return this.once('authorizer_token', this.sendText.bind(this, openId, text, callback))
  }
  const url = 'https://api.weixin.qq.com/cgi-bin/message/custom/send'
  const query = {
    access_token: this.authorizerAccessToken
  }
  const body = {
    touser: openId,
    msgtype: 'text',
    text: {
      content: text
    }
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

const refreshAccessTokenCallback = function (err, body) {
  if (err) {
    return this.emit('error', err)
  }
  const result = body.authorization_info || body
  this.authorizerAccessToken = result.authorizer_access_token
  this.authorizerRefreshToken = result.authorizer_refresh_token
  this.emit('authorizer_token', {
    authorizerAppId: this.authorizerAppId,
    authorizerAccessToken: this.authorizerAccessToken,
    authorizerRefreshToken: this.authorizerRefreshToken,
    expiresIn: parseInt(result.expires_in)
  })
  clearTimeout(this.tokenTimer)
  this.tokenTimer = setTimeout(this.startRefreshAccessToken.bind(this), (result.expires_in - 60 * 10) * 1000)
}

proto.startRefreshAccessToken = function () {
  const onComponentAccessToken = function () {
    if (this.authorizerRefreshToken) {
      this.refreshAccessToken(refreshAccessTokenCallback.bind(this))
    } else if (this.authorizationCode) {
      this.getAccessToken(refreshAccessTokenCallback.bind(this))
    }
  }
  if (this.component.componentAccessToken) {
    onComponentAccessToken.call(this) 
  } else {
    this.component.once('component_access_token', onComponentAccessToken.bind(this))
  }
}

proto.startRefreshJsApiTicket = function () {
  const getJsApiTicketCallback = function (err, result) {
    if (err) {
      return this.emit('error', err)
    }
    this.authorizerJsApiTicket = result.ticket
    this.emit('authorizer_jsapi_ticket', {
      authorizerAppId: this.authorizerAppId,
      authorizerJsApiTicket: this.authorizerJsApiTicket,
      expiresIn: parseInt(result.expires_in)
    })
    clearTimeout(this.ticketTimer)
    this.ticketTimer = setTimeout(this.startRefreshJsApiTicket.bind(this), (result.expires_in - 60 * 10) * 1000)
  }
  if (this.authorizerAccessToken) {
    this.getJsApiTicket(getJsApiTicketCallback.bind(this))
  } else {
    this.once('authorizer_token', this.getJsApiTicket.bind(this, getJsApiTicketCallback.bind(this)))
  }
}

proto.start = function () {
  this.startRefreshAccessToken()
  this.startRefreshJsApiTicket()
}

proto.stop = function () {
  clearTimeout(this.tokenTimer)
  clearTimeout(this.ticketTimer)
}

Object.assign(Authorizer.prototype, proto)

module.exports = Authorizer