const urlParser = require('url')
const querystring = require('querystring')
const https = require('https')
const xmlParser = new require('xml2js').Parser({
  explicitRoot: false,
  explicitArray: false
})
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
      let result = null
      try {
        result = JSON.parse(Buffer.concat(buffers))
      } catch(err) {
        return callback(err)
      }
      callback(null, res, result)
    })
  }
  const req = https.request(url, requestCallback)
  req.on('error', callback)
  req.write(body)
  req.end()
}
util.parseXml = xmlParser.parseString

module.exports = util