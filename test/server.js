process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
const express = require('express')
const app = express()
const config = require('./config')
const serverConfig = config.server
const wechatOpenToolkitConfig = config.wechatOpenToolkit
const WechatOpenToolkit = require('../index')
const options = Object.assign({}, wechatOpenToolkitConfig, {
    getComponentVerifyTicket (componentAppId, callback) {
        console.log(componentAppId)
        callback(null, 'component_verify_ticket')
    },
    saveComponentVerifyTicket (result) {
        console.log('verify_ticket', result)
    },
    saveComponentAccessToken (result) {
        console.log('access_token: ', result)
    },
    onError (err) {
        console.error(err)
    }
})
const wechatOpenToolkit = new WechatOpenToolkit(options)

wechatOpenToolkit.getPreAuthCode(wechatOpenToolkitConfig.list[0].componentAppId, (err, response, body) => {
    if (err) {
        return console.error(err)
    }
    console.log(body)
})

app.use('/open', wechatOpenToolkit.middlewarify(), (req, res) => {
    console.log(req.wechatOpenMessage)
})

app.listen(serverConfig.PORT, () => {
    console.log(`server start at ${serverConfig.PORT}`)
})