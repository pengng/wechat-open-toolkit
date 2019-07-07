function HttpError(message, statusCode) {
    this.name = 'HttpError'
    this.code = statusCode
    this.message = message
    Error.captureStackTrace(this, HttpError)
}
HttpError.prototype = Object.create(Error.prototype)

function WechatOpenToolkitError(message, errcode) {
    this.name = 'WechatOpenToolkitError',
    this.message = message
    this.code = errcode
    Error.captureStackTrace(this, WechatOpenToolkitError)
}
WechatOpenToolkitError.prototype = Object.create(Error.prototype)

module.exports = { HttpError, WechatOpenToolkitError }