const urlParser = require('url')
const querystring = require('querystring')
const https = require('https')
const xml2js = require('xml2js')
const xmlParser = new xml2js.Parser({
  explicitRoot: false,
  explicitArray: false
})
const xmlBuilder = new xml2js.Builder({
  rootName: 'xml',
  headless: true,
  cdata: true
})
const error = require('./error')
const util = {}
util.request = function(options, callback) {
  let url = options.url
  url = urlParser.parse(url)
  const headers = options.headers || {}
  let body = options.body || ''
  if (options.json) {
    body = JSON.stringify(body)
    headers['content-type'] = 'application/json'
  } else {
    body = querystring.stringify(body)
    headers['content-type'] = 'application/x-www-form-urlencoded'
  }
  headers['content-length'] = Buffer.byteLength(body)

  const method = options.method.toUpperCase()

  Object.assign(url, {
    method: method,
    headers: headers
  })

  const requestCallback = function (res) {
    const buffers = []
    res.on('data', buffers.push.bind(buffers)).on('end', function () {
      let result = Buffer.concat(buffers).toString()
      if (options.json) {
        try {
          result = JSON.parse(result)
        } catch(err) {
          return callback(null, res, result)
        }
      }
      callback(null, res, result)
    })
  }
  const req = https.request(url, requestCallback)
  req.on('error', callback)
  req.write(body)
  req.end()
}
util.parseXml = xmlParser.parseString.bind(xmlParser)
util.buildObject = xmlBuilder.buildObject.bind(xmlBuilder)
util.wrapper = function (callback) {
  return function (err, response, body) {
    if (err) {
      return callback(err)
    }
    if (response.statusCode !== 200) {
      return callback(new error.HttpError(body, response.statusCode))
    }
    if (body.errcode) {
      return callback(new error.WechatOpenToolkitError(body.errmsg, body.errcode))
    }
    callback(null, body)
  }
}

module.exports = util