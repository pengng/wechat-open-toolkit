const EventEmitter = require('events')
const querystring = require('querystring')
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

proto.refreshAccessToken = function (callback) {
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
  result.authorizer_appid = result.authorizer_appid || this.authorizerAppId
  this.authorizerAccessToken = result.authorizer_access_token
  this.authorizerRefreshToken = result.authorizer_refresh_token
  this.emit('authorizer_token', result)
  this.timer = setTimeout(this.start.bind(this), (result.expires_in - 60 * 10) * 1000)
}

proto.start = function () {
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

Object.assign(Authorizer.prototype, proto)

module.exports = Authorizer