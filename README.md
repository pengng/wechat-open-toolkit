# wechat-open-toolkit 微信开放平台工具套件

**方便搭建基础的 Node.js 微信第三方服务平台。**

### 示例代码

```shell
npm install wechat-open-toolkit
```

```javascript
const express = require('express')
const app = express()
const WechatOpenToolkit = require('wechat-open-toolkit')
const {
    EVENT_COMPONENT_VERIFY_TICKET, EVENT_AUTHORIZED, EVENT_UPDATE_AUTHORIZED,
    EVENT_UNAUTHORIZED, EVENT_COMPONENT_ACCESS_TOKEN, EVENT_AUTHORIZER_ACCESS_TOKEN, 
    EVENT_AUTHORIZER_JSAPI_TICKET
} = WechatOpenToolkit

// 微信第三方平台列表
let list = [
    {
        componentAppId: '', // 微信第三方平台 appId
        componentAppSecret: '', // 微信第三方平台 appSecret
        token: '', // 消息校验 Token
        encodingAESKey: '' // 消息加解密 key
    }
]

let toolkit = new WechatOpenToolkit({ list })

// 绑定全部事件
toolkit.on(EVENT_COMPONENT_VERIFY_TICKET, ret => {
    console.log(ret)
})
toolkit.on(EVENT_AUTHORIZED, ret => {
    console.log(ret)
})
toolkit.on(EVENT_UPDATE_AUTHORIZED, ret => {
    console.log(ret)
})
toolkit.on(EVENT_UNAUTHORIZED, ret => {
    console.log(ret)
})
toolkit.on(EVENT_COMPONENT_ACCESS_TOKEN, ret => {
    console.log(ret)
})
toolkit.on(EVENT_AUTHORIZER_ACCESS_TOKEN, ret => {
    console.log(ret)
})
toolkit.on(EVENT_AUTHORIZER_JSAPI_TICKET, ret => {
    console.log(ret)
})
toolkit.on('error', err => {
    console.error(err)
})

// 通常需要绑定5个中间件
app.use('/wechat/events', toolkit.events()) // 第三方平台事件接收中间件

list.forEach(({ componentAppId }) => {

    let authMiddleware = toolkit.auth(componentAppId, 'https://domain.com/') // 第三方平台网页授权中间件
    let msgMiddleware = toolkit.message(componentAppId) // 授权方用户消息接收中间件
    let autoTestMiddleware = toolkit.autoTest(componentAppId) // 第三方平台全网发布测试中间件

    app.get(`/wechat/auth/${componentAppId}`, authMiddleware)
  
    app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, autoTestMiddleware, (req, res) => {
        res.end('success')
        console.log(req.wechat)
    })

    app.get(`/wechat/oauth/${componentAppId}/:authorizerAppId`, (req, res) => {
        let { authorizerAppId } = req.params
        let oauthMiddleware = toolkit.oauth(componentAppId, authorizerAppId, 'https://domain.com/') // 授权方网页授权中间件
        oauthMiddleware(req, res)
    })
})

app.listen(3000)
console.log('server start at 3000')
```


### 接入 co-wechat-api 和 wechat-api 示例代码

```javascript
const CoWechatApi = require('co-wechat-api')
const WechatApi = require('wechat-api')

let store = {} // 缓存数据

let componentAppId = 'test app id'
let authorizerAppId = 'test app id'

let api = new WechatApi('', '', callback => {
    // 每次调用 api.方法()，都会从 store 对象取 access token
    callback(null, {
        accessToken: store[`${componentAppId}/${authorizerAppId}`],
        expireTime: Date.now() + 1000 * 60
    }
})

let coApi = new CoWechatApi('', '', async () => {
    // 每次调用 api.方法()，都会从 store 对象取 access token
    return {
        accessToken: store[`${componentAppId}/${authorizerAppId}`],
        expireTime: Date.now() + 1000 * 60
    }
})

// 每次授权方 access token 更新时，同步更新缓存数据
toolkit.on(EVENT_AUTHORIZER_ACCESS_TOKEN, function (ret) {
    let { AppId, authorizer_appid, authorizer_access_token } = ret
    store[`${AppID}/${authorizer_appid}`] = authorizer_access_token // 更新
})

// 该功能需等到 access token 首次更新后，才能调用
api.sendText()
await coApi.sendText()
///
```

**示例代码仅供参考，根据实际情况调整。**

### 微信第三方平台要求配置2个URL，分别推送第三方平台事件和公众号事件，列表整理如下：

- **授权事件接收URL**
  - **component_verity_ticket 当微信服务器推送 component_verity_ticket 时触发**
  - **authorized 当有新的公众号授权给第三方平台时触发**
  - **updateauthorized 当已授权公众号修改授权给第三方平台的权限时触发**
  - **unauthorized 当已授权公众号取消授权时触发**
- **公众号消息接收URL**
  - **推送用户与公众号的消息**
  - **用户点击底部菜单、关注、取消关注、扫码事件**

### 微信开放平台 和 微信第三方平台

微信开放平台账号需要在 [微信开放平台](https://open.weixin.qq.com/) 注册，注册后得到账号和密码。(注册时提供的邮箱之前未注册过公众号和小程序)

一个微信开放平台账号可以创建多个第三方平台，创建后得到第三方平台的 **appId** 和 **appSecret**。也就是代码中使用的**componentAppId**、**componentAppSecret** 。(第三方平台的数量有上限，定制化开发服务商类型上限是**5个**、平台型服务商类型上限是**5个**)

### 当收到微信推送的 component_verify_ticket 时触发 component_verify_ticket 事件

```javascript
toolkit.on(EVENT_COMPONENT_VERIFY_TICKET, function (result) {
/* {
    AppId: "wx304925fbea25bcbe",
    CreateTime: "1562424829"
    InfoType: "component_verify_ticket",
    ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
} */
})
```

> **微信服务器会每隔10分钟推送1次，这会导致每次进程重新启动后，有1至10分钟服务不可用（因为其他功能全部依赖于 component_verify_ticket），解决方法是存储上一次的推送数据，并且每次启动时，主动触发一次相同事件。示例如下：**

```javascript
// ！在所有侦听事件绑定完成后，再触发事件
// 从数据库（或其他地方）读取上次缓存的数据，通过事件通知给组件
toolkit.emit(EVENT_COMPONENT_VERIFY_TICKET, {
    AppId: "wx52ffab2939ad",
    CreateTime: "142345003"
    InfoType: "component_verify_ticket",
    ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
})
```

### 当刷新第三方平台 access token 时触发 component_access_token 事件

```javascript
toolkit.on(EVENT_COMPONENT_ACCESS_TOKEN, function (result) {
/* {
    component_access_token: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expires_in: 7200,
    componentAppId: 'componentAppId'
} */
})
```

### 当刷新授权方 access token 时触发 authorizer_access_token 事件

```javascript
toolkit.on(EVENT_AUTHORIZER_ACCESS_TOKEN, function (result) {
/**
{
    AppId: 'wx304925fbea25bcbe',
    authorizer_appid: 'wxc736b9251b3c6c41',
    authorizer_access_token: 'j7mR_dvcCAmUq5Iw-MuzE4sBT0unN-ukg7LR8EqZEQ1wZ7oyw0rs1Idk40d7uxriOubE3795JiFa3e5jDGdofRpTemXd2HLLV6p_i_Uwy7m2Rp-qv1k1ld-T9iCCDcVeQONdALDFDC',
    authorizer_refresh_token: 'refreshtoken@@@6Esz0GgFsth_vRPtqjQd_aIQcCBcJ4iuzQFf3akLwgg',
    expires_in: 7200
}
*/
})
```

### 当刷新授权方 jsapi_ticket 时触发 authorizer_jsapi_ticket 事件

```javascript
toolkit.on(EVENT_AUTHORIZER_JSAPI_TICKET, function (result) {
/* {
    errcode: 0,
    errmsg: 'ok',
    ticket: 'Zqqmael1_O_ddyFwCE14BtflzySMrtVpp086SHhK3P07xXnhjii2MTmKAGQHBwPOg8GsEtR9HG_dHUngs22ayQ',
    expires_in: 7200,
    componentAppId: 'wx304925fbea25bcbe',
    authorizerAppId: 'wxc736b9251b3c6c41'
} */
})
```

### 当新的公众号授权成功时触发 authorized 事件

```javascript
toolkit.on(EVENT_AUTHORIZED, function (result) {
/* {
    AppId: 'wx304925fbea25bcbe',
    CreateTime: '1562428385',
    InfoType: 'authorized',
    AuthorizerAppid: 'wxc736b9251b3c6c41',
    AuthorizationCode: 'queryauthcode@@@SozCwT_ve8WQI6Poum-qdGrrBrnQoX2rApglrUIMF0e308IQY7w_tCfAkndxzUth_YwHDto8DUsIeNrX4atetA',
    AuthorizationCodeExpiredTime: '1562431985',
    PreAuthCode: 'preauthcode@@@c4Uh5vOCS3wu9Bbx4tJWxplzkn5swwVHQc9xGtF57C1lfk_UeW50INZsh2flrwxh'
} */
})
```

### 当已授权公众号更新权限时触发 updateauthorized 事件

```javascript
toolkit.on(EVENT_UPDATE_AUTHORIZED, function (result) {
/* {
    AppId: 'wx304925fbea25bcbe',
    CreateTime: '1562426956',
    InfoType: 'updateauthorized',
    AuthorizerAppid: 'wxc736b9251b3c6c41',
    AuthorizationCode: 'queryauthcode@@@SozCwT_ve8WQI6Poum-qdG_rFKaepJCyhL-zx1OkvsxmmJkbZadF78t3U9lh20IaWFqb2DcLne7MGVICr5eRfQ',
    AuthorizationCodeExpiredTime: '1562430556',
    PreAuthCode: 'preauthcode@@@ivkKNYhiXXsDFLBmH2ccOCg6doXsD_RdQOS7Cxw5GoILrdQktfx_glIzmhWQrMyT'
} */
})
```

### 当已授权公众号取消授权时触发 unauthorized 事件

```javascript
toolkit.on(EVENT_UNAUTHORIZED, function (result) {
/* {
    AppId: 'wx304925fbea25bcbe',
    CreateTime: '1562428154',
    InfoType: 'unauthorized',
    AuthorizerAppid: 'wxc736b9251b3c6c41'
} */
})
```

### 当有错误时触发 error 事件

```Javascript
toolkit.on('error', function (err) {
    console.error(err)
})
```

### 实例方法：

- **auth(componentAppId, redirectUrl [, authType])** [返回第三方平台授权中间件](#auth)

- **events()** [返回第三方平台授权事件处理中间件](#events)

- **message(componentAppId)** [返回授权方消息处理中间件](#message)

- **autoTest(componentAppId)** [返回全网发布测试用例的中间件](#autoTest)

- **oauth(componentAppId, authorizerAppId, redirectUrl [, scope [, state]])** [返回授权方网页授权中间件](#oauth)

### 类方法：

- **getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId)** [获取授权方的账号基本信息](#getauthorizerinfo)

- **clearQuota(componentAppId, componentAccessToken)** [第三方平台对其所有API调用次数清零](#clearquota)

- **getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url)** [获取授权方 js sdk 配置](#getjsapiconfig)

- **getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code)** [获取授权方网页授权 access token](#getoauthaccesstoken)

- **getUserInfo(authorizerAccessToken, openId)** [获取授权方微信用户基本信息](#getuserinfo)

- **send(authorizerAccessToken, openId, type, content)** [发送客服消息](#send)

- **getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName)** [获取授权方的选项设置信息](#getauthorizeroptioninfo)

- **setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue)** [设置授权方选项信息](#setauthorizeroption)

- **createOpenAccount(authorizerAppId, authorizerAccessToken)** [创建开放平台帐号并绑定公众号/小程序](#createopenaccount)

- **bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)** [将公众号/小程序绑定到开放平台帐号下](#bindopenaccount)

- **unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)** [将公众号/小程序从开放平台帐号下解绑](#unbindopenaccount)

- **getOpenAccount(authorizerAppId, authorizerAccessToken)** [获取公众号/小程序所绑定的开放平台帐号](#getopenaccount)

### auth

返回第三方平台授权中间件。

- **componentAppId** \<string\> 第三方平台APPID
- **redirectUrl** \<string\> 授权成功后重定向的URL
- **authType** \<number|string\> 授权的类型
- **pageStyle** \<number\> 页面样式

**redirectUrl** 该链接的域名必须和当前服务的域名相同，而且和微信第三方平台配置的域名相同。

**authType** 指定授权时显示的可选项。**1** 表示仅展示公众号、**2** 表示仅展示小程序、**3** 表示展示公众号和小程序。默认为 **3** 。也可以传入授权方 APPID，指定授权方。

**pageStyle** 指定授权页面的样式。**1** 表示PC扫码授权；**2** 表示微信浏览器打开。默认值为 **1**。

```javascript
const { AUTH_TYPE_BOTH, PAGE_STYLE_PC } = require('wechat-open-toolkit')
let componentAppId = 'wx52ffab2939ad'
let redirectUrl = 'https://domain.com/authorized'
let authMiddleware = toolkit.auth(componentAppId, redirectUrl, AUTH_TYPE_BOTH, PAGE_STYLE_PC)

// 浏览器打开该路由即可扫码授权
app.get(`/wechat/auth/${componentAppId}`, authMiddleware)
```

### events

返回第三方平台授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.events())
```

### message

返回授权方消息处理中间件

- **componentAppId** \<string\> 第三方平台appId

```javascript
const componentAppId = 'wx52ffab2939ad'
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, (req, res) => {
    console.log(req.wechat)
    /**
    {
        ToUserName: 'gh_2a33e5f5a9b0',
        FromUserName: 'oVtjJv5NEub-fbE7E6_P2_jCLMXo',
        CreateTime: '1508406464',
        MsgType: 'text',
        Content: 'hello world',
        MsgId: '6478556432393017916'
    }
    */
})
```

### 被动回复消息功能

当第三方平台收到授权方用户消息时，可以使用被动回复功能回复消息。

- **res.text(content)** 回复文本消息
- **res.image(mediaId)** 回复图片
- **res.voice(mediaId)** 回复语音
- **res.video(mediaId [, title [, description]])** 回复视频
- **res.music(thumbMediaId [, HQMusicUrl [, musicUrl [, title [, description]]]])** 回复音乐
- **res.news(articles)** 回复图文
  - **Title** 标题
  - **Description** 描述
  - **Url** 跳转链接
  - **PicUrl** 缩略图链接

```javascript
let componentAppId = 'wx52ffab2939ad' // 第三方平台APPID
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, (req, res) => {
    let { MsgType, Content, MediaId, Label, Title, Description, Url} = req.wechat
    switch (MsgType) {
        case 'text':
            res.text(Content) // 被动回复文本消息
            break;
        case 'image':
            res.image(MediaId) // 被动回复图片消息
            break;
        case 'voice':
            res.voice(MediaId) // 被动回复语音消息
            break;
        case 'video':
            res.video(MediaId) // 被动回复视频消息
            break;
        case 'location':
            res.text(Label)
            break;
        case 'link':
            res.news([{ Title, Description, Url }])
    }
})
```

### autoTest

返回全网发布测试用例的中间件。该中间件需要放置在 [message](#message) 中间件后面，以及其他中间件前面。

- **componentAppId** \<string\> 第三方平台APPID

```javascript
let componentAppId = 'wx52ffab2939ad'
let msgMiddleware = toolkit.message(componentAppId) // 用户消息中间件
let testMiddleware = toolkit.autoTest(componentAppId) // 全网发布测试中间件

app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, msgMiddleware, testMiddleware, (req, res) => {
    res.end('success') // 响应微信服务器
    console.log(req.wechat)
})
```

### oauth

返回第三方平台代理微信公众号网页授权中间件。

- **componentAppId** \<string\> 第三方平台APPID
- **authorizerAppId** \<string\> 授权方APPID
- **redirectUrl** \<string\> 授权成功后的重定向URL
- **scope** \<string\> 网页授权的类型。可选
- **state** \<string\> 授权的附带值。可选

**scope 为授权作用域。可能的值为：snsapi_base 和 snsapi_userinfo。默认为：snsapi_base**

```javascript
const { OAUTH_TYPE_USERINFO } = require('wechat-open-toolkit')
let componentAppId = 'wx304925fbea25bcbe'
let authorizerAppId = 'wxc736b9251b3c6c41'
let redirectUrl = 'https://domain.com/authorized'
let oauthMiddleware = toolkit.oauth(componentAppId, authorizerAppId, redirectUrl, OAUTH_TYPE_USERINFO)

app.get(`/wechat/oauth/${componentAppId}/${authorizerAppId}`, oauthMiddleware)
```

### getAuthorizerInfo

获取授权方的账号基本信息

```javascript
let ret = await WechatOpenToolkit.getAuthorizerInfo(componentAppId, componentAccessToken, authorizerAppId)
```

### getJsApiConfig

获取授权方的 js sdk 配置对象

- **authorizerAppId** \<string\> 授权方APPID
- **authorizerJsApiTicket** \<string\> 授权方 JsApi Ticket
- **url** \<string\> 要配置的网页链接

```javascript
let conf = WechatOpenToolkit.getJsApiConfig(authorizerAppId, authorizerJsApiTicket, url)
/**
{
    appId: '',
    timestamp: 158923408,
    nonceStr: '292jslk30dk',
    signature: '20kjafj20dfhl2j0sjhk2h3f0afjasd2'
}
*/
```

### getOauthAccessToken

获取授权方的网页授权 access token

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>
- **authorizerAppId** \<string\> 授权方APPID
- **code** \<string\> 网页授权后得到的临时 code

```javascript
let ret = await WechatOpenToolkit.getOauthAccessToken(componentAppId, componentAccessToken, authorizerAppId, code)
```

### getUserInfo

获取授权方微信用户的基本信息

- **authorizerAccessToken** \<string\> 授权方网页授权得到的 access token
- **openId** \<string\> 授权方微信用户的openId

```javascript
let ret = await WechatOpenToolkit.getUserInfo(authorizerAccessToken, openId)
```

### send

发送客服消息

- **authorizerAccessToken** \<string\> 授权方 access token
- **openId** \<string\> 微信用户 openId
- **type** \<string\> 消息类型
- **content** \<string\> 消息主体

```javascript
await WechatOpenToolkit.send(authorizerAccessToken, openId, 'text', { content: '消息内容' }) // 发送文本消息
await WechatOpenToolkit.send(authorizerAccessToken, openId, 'image', { media_id: 'MEDIA_ID' }) // 发送图片消息
await WechatOpenToolkit.send(authorizerAccessToken, openId, 'voice', { media_id: 'MEDIA_ID' }) // 发送语音消息

await WechatOpenToolkit.send(authorizerAccessToken, openId, 'video', {
    media_id: 'MEDIA_ID',
    thumb_media_id: 'MEDIA_ID',
    title: 'TITLE',
    description: 'DESCRIPTION'
}) // 发送视频消息

await WechatOpenToolkit.send(authorizerAccessToken, openId, 'music', {
    title: 'TITLE',
    description: 'DESCRIPTION',
    musicurl: 'MUSIC_URL',
    hqmusicurl: 'HQ_MUSIC_URL',
    thumb_media_id: 'MEDIA_ID'
}) // 发送音乐消息

await WechatOpenToolkit.send(authorizerAccessToken, openId, 'news', {
    articles: [{
        title: 'TITLE',
        description: 'DESCRIPTION',
        url: 'URL',
        picurl: 'PIC_URL'
    }]
}) // 发送图文消息

await WechatOpenToolkit.send(authorizerAccessToken, openId, 'mpnews', { media_id: 'MEDIA_ID' }) // 发送图文消息
```

### getAuthorizerOptionInfo

该API用于获取授权方的公众号或小程序的选项设置信息，如：地理位置上报，语音识别开关，多客服开关。

- **componentAppId**
- **componentAccessToken**
- **authorizerAppId**
- **optionName**

```javascript
let ret = await WechatOpenToolkit.getAuthorizerOptionInfo(componentAppId, componentAccessToken, authorizerAppId, optionName)
```

### setAuthorizerOption

设置授权方选项

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>
- **authorizerAppId** \<string\> 授权方平台APPID
- **optionName** \<string\>
- **optionValue** \<number\>

**该API用于设置授权方的公众号或小程序的选项信息，如：地理位置上报，语音识别开关，多客服开关。**

```javascript
await WechatOpenToolkit.setAuthorizerOption(componentAppId, componentAccessToken, authorizerAppId, optionName, optionValue)
```

### clearQuota

第三方平台对其所有API调用次数清零

- **componentAppId** \<string\> 第三方平台APPID
- **componentAccessToken** \<string\>

```javascript
await WechatOpenToolkit.clearQuota(componentAppId, componentAccessToken)
```

### createOpenAccount

创建开放平台帐号并绑定公众号/小程序

- **authorizerAppId** \<string\> 授权方APPID
- **authorizerAccessToken** \<string\>

```javascript
let ret = await WechatOpenToolkit.createOpenAccount(authorizerAppId, authorizerAccessToken)
```

### bindOpenAccount

将公众号/小程序绑定到开放平台帐号下

- **openAppId** \<string\>
- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
await WechatOpenToolkit.bindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)
```

### unbindOpenAccount

将公众号/小程序从开放平台帐号下解绑

- **openAppId** \<string\>
- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
await WechatOpenToolkit.unbindOpenAccount(openAppId, authorizerAppId, authorizerAccessToken)
```

### getOpenAccount

获取公众号/小程序所绑定的开放平台帐号

- **authorizerAppId** \<string\>
- **authorizerAccessToken** \<string\>

```javascript
let ret = await WechatOpenToolkit.getOpenAccount(authorizerAppId, authorizerAccessToken)
```

