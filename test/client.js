const { Builder } = require('xml2js')
const xmlBuilder = new Builder({
  rootName: 'xml',
  headless: true,
  cdata: true
})
const request = require('request')
const util = require('../lib/util')
const Encrypt = require('wechat-encrypt')
const config = require('./config')
const openConfig = config.wechatOpenToolkit.list[0]
const serverConfig = config.server
openConfig.appId = openConfig.componentAppId
const encrypt = new Encrypt(openConfig)

const componentVerifyTicket = {
  AppId: openConfig.componentAppId,
  Encrypt: {
    AppId: openConfig.componentAppId,
    CreateTime: parseInt(Date.now() / 1000),
    InfoType: 'component_verify_ticket',
    ComponentVerifyTicket: 'test ticket'
  }
}

const authorized = {
  AppId: openConfig.componentAppId,
  Encrypt: {
    AppId: openConfig.componentAppId,
    CreateTime: parseInt(Date.now() / 1000),
    InfoType: 'authorized',
    AuthorizerAppid: 'test appid',
    AuthorizationCode: 'test auth code',
    AuthorizationCodeExpiredTime: 7200,
    PreAuthCode: 'test pre auth code'
  }
}

authorized.Encrypt = encrypt.encode(xmlBuilder.buildObject(authorized.Encrypt))

componentVerifyTicket.Encrypt = encrypt.encode(xmlBuilder.buildObject(componentVerifyTicket.Encrypt))

// request({
//   url: `http://localhost:${serverConfig.PORT}/open`,
//   method: 'post',
//   body: xmlBuilder.buildObject(componentVerifyTicket),
//   headers: {
//     'content-type': 'application/xml'
//   }
// }, (err, response, body) => {
//   if (err) {
//     return console.error(err)
//   }
//   console.log(body)
// })

request({
  url: `http://localhost:${serverConfig.PORT}/open`,
  method: 'post',
  body: xmlBuilder.buildObject(authorized),
  headers: {
    'content-type': 'application/xml'
  }
}, (err, response, body) => {
  if (err) {
    return console.error(err)
  }
  console.log(body)
})