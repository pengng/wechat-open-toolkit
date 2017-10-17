const HttpError = function (message, statusCode) {
  Error.call(this, message)
  Error.captureStackTrace(this, this.constructor)
  this.name = 'HttpError'
  this.statusCode = statusCode
}
HttpError.prototype = Object.create(Error.prototype)

const WechatOpenToolkitError = function (message) {
  Error.call(this, message)
  Error.captureStackTrace(this, this.constructor)
  this.name = 'WechatOpenToolkitError'
}
WechatOpenToolkitError.prototype = Object.create(Error.prototype)

module.exports = {
  HttpError: HttpError,
  WechatOpenToolkitError: WechatOpenToolkitError
}