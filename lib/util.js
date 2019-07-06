const xml2js = require('xml2js')
const { HttpError, WechatOpenToolkitError } = require('./error')

const HTTP_STATUS_CODE_OK = 200 // HTTP 状态码

const xmlParser = new xml2js.Parser({
    explicitRoot: false,
    explicitArray: false
})
const xmlBuilder = new xml2js.Builder({
    rootName: 'xml',
    headless: true,
    cdata: true
})

const parseXml = xmlParser.parseString.bind(xmlParser)
const buildObject = xmlBuilder.buildObject.bind(xmlBuilder)

// 校验响应的结果是否有问题
function validator(ret) {
    let { statusCode, data } = ret
    let { errcode, errmsg } = data

    if (statusCode === HTTP_STATUS_CODE_OK) {
        if (errcode) {
            throw new WechatOpenToolkitError(errmsg, errcode)
        } else {
            return data
        }
    } else {
        throw new HttpError('请求出错', statusCode)
    }
}

module.exports = { parseXml, buildObject, validator }