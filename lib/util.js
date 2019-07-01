const urlParser = require('url')
const querystring = require('querystring')
const https = require('https')
const fs = require('fs')
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
util.htmlTpl = fs.readFileSync(__dirname + '/../static/jump.html', 'utf8')
util.wrapperData = function (obj, otherMap) {
    if (obj instanceof Array) {
        return obj.map(util.wrapperData)
    } else if (!(obj && typeof obj === 'object')) {
        return obj
    }
    otherMap = otherMap || {}
    const fieldNameMap = {
        authorizer_info: 'authorizerInfo',
        authorizer_appid: 'authorizerAppId',
        option_name: 'optionName',
        option_value: 'optionValue',
        nick_name: 'nickname',
        head_img: 'headImg',
        service_type_info: 'serviceTypeInfo',
        verify_type_info: 'verifyTypeInfo',
        user_name: 'userName',
        principal_name: 'principalName',
        business_info: 'businessInfo',
        open_store: 'openStore',
        open_scan: 'openScan',
        open_pay: 'openPay',
        open_card: 'openCard',
        open_shake: 'openShake',
        qrcode_url: 'qrcodeUrl',
        authorization_info: 'authorizationInfo',
        func_info: 'funcInfo',
        funcscope_category: 'funcscopeCategory',
        MiniProgramInfo: 'miniProgramInfo',
        RequestDomain: 'requestDomain',
        WsRequestDomain: 'wsRequestDomain',
        UploadDomain: 'uploadDomain',
        DownloadDomain: 'downloadDomain',
        visit_status: 'visitStatus'
    }
    const result = {}
    for (let key in obj) {
        if (fieldNameMap[key]) {
            result[fieldNameMap[key]] = util.wrapperData(obj[key], otherMap)
        } else if (otherMap[key]) {
            result[otherMap[key]] = util.wrapperData(obj[key], otherMap)
        } else {
            result[key] = value
        }
    }
    return result
}

module.exports = util