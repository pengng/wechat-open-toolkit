# wechat-open-toolkit 微信开放平台工具套件

**方便搭建基础的 Node.js 微信第三方服务平台。**

### 示例代码

```shell
npm i wechat-open-toolkit -S
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

const toolkit = new WechatOpenToolkit({
    list: [
        {
            componentAppId: '', // 微信第三方平台 appId
            componentAppSecret: '', // 微信第三方平台 appSecret
            token: '', // 消息校验 Token
            encodingAESKey: '' // 消息加解密 key
        }
    ]
})

// 列出需要侦听的全部事件列表
let eventList = [
    EVENT_COMPONENT_VERIFY_TICKET, EVENT_AUTHORIZED, EVENT_UPDATE_AUTHORIZED,
    EVENT_UNAUTHORIZED, EVENT_COMPONENT_ACCESS_TOKEN, EVENT_AUTHORIZER_ACCESS_TOKEN, 
    EVENT_AUTHORIZER_JSAPI_TICKET, 'error'
]

eventList.forEach(event => toolkit.on(event, console.log)) // 批量绑定事件处理函数

// 通常需要绑定4个中间件
// 1.绑定第三方平台授权事件的中间件
app.use('/wechat/events', toolkit.events())
options.list.forEach(({ componentAppId }) => {
    // 2.绑定第三方平台网页授权的中间件
    app.get(`/wechat/auth/${componentAppId}`, toolkit.auth(componentAppId, 'https://domain.com/'))
    // 3.绑定授权方网页授权的中间件
    app.get(`/wechat/oauth/${componentAppId}/:authorizerAppId`, (req, res, next) => {
        let { authorizerAppId } = req.params
        toolkit.oauth(options)(req, res, next)
        toolkit.oauth(componentAppId, authorizerAppId, 'https://domain.com/')(req, res, next)
    })
    // 4.绑定授权方用户消息的中间件
    app.post(`/wechat/message/${componentAppId}/:authorizerAppId`,
        toolkit.message(componentAppId), toolkit.autoTest(componentAppId),
        (req, res) => {
      			console.log(req.wechat)
      			res.end('success') // 响应微信服务器
    })
})

app.listen(3000)
console.log('server start at 3000')
```



### 微信第三方平台要求配置2个URL，分别推送第三方平台事件和公众号事件，列表整理如下：

- 授权事件接收URL
  - component_verity_ticket 当微信服务器推送 **component_verity_ticket** 时触发
  - authorized 当有新的公众号授权给第三方平台时触发
  - updateauthorized 当已授权公众号修改授权给第三方平台的权限时触发
  - unauthorized 当已授权公众号取消授权时触发
- 公众号消息接收URL
  - 推送用户与公众号的消息
  - 用户点击底部菜单、关注、取消关注、扫码事件



### 微信开放平台 和 微信第三方平台

微信开放平台账号需要在 [微信开放平台](https://open.weixin.qq.com/) 注册，注册后得到账号和密码。(注册时提供的邮箱之前未注册过公众号和小程序)

一个微信开放平台账号可以创建多个第三方平台，创建后得到第三方平台的 **appId** 和 **appSecret**。也就是代码中使用的**componentAppId**、**componentAppSecret** 。(第三方平台的数量有上限，定制化开发服务商类型上限是**5个**、平台型服务商类型上限是**5个**)



#### 第三方平台列表配置

| 名称               | 类型   | 必填 | 描述                |
| ------------------ | ------ | ---- | ------------------- |
| componentAppId     | string | 是   | 微信第三方appId     |
| componentAppSecret | string | 是   | 微信第三方appSecret |
| token              | string | 是   | 消息校验token       |
| encodingAESKey     | string | 是   | 消息加解密Key       |



#### 当收到微信推送的 component_verify_ticket 时触发 component_verify_ticket 事件

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

> ！微信服务器会每隔10分钟推送1次，这会导致每次进程重新启动后，有1至10分钟服务不可用（因为其他功能全部依赖于 component_verify_ticket），解决方法是存储上一次的推送数据，并且每次启动时，主动触发一次相同事件。示例如下：
>
> ```
> // ！在所有侦听事件绑定完成后，再触发事件
> // 从数据库（或其他地方）读取上次缓存的数据，通过事件通知给组件
> toolkit.emit(EVENT_COMPONENT_VERIFY_TICKET, {
>     AppId: "wx52ffab2939ad",
>     CreateTime: "142345003"
>     InfoType: "component_verify_ticket",
>     ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
> })
> ```



#### 当刷新第三方平台 access token 时触发 component_access_token 事件

```javascript
toolkit.on(EVENT_COMPONENT_ACCESS_TOKEN, function (result) {
/* {
    component_access_token: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expires_in: 7200,
    componentAppId: 'componentAppId'
} */
})
```



#### 当刷新授权方 access token 时触发 authorizer_access_token 事件

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



#### 当刷新授权方 jsapi_ticket 时触发 authorizer_jsapi_ticket 事件

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



#### 当新的公众号授权成功时触发 authorized 事件

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



#### 当已授权公众号更新权限时触发 updateauthorized 事件

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



#### 当已授权公众号取消授权时触发 unauthorized 事件

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



#### 当有错误时触发 error 事件

```Javascript
toolkit.on('error', function (err) {
		console.error(err)
})
```



#### 函数列表

中间件：

- **auth(componentAppId, redirectUrl [, authType])** [返回第三方平台授权中间件](#auth)
- **events()** [返回第三方平台授权事件处理中间件](#events)
- **message(componentAppId)** [返回授权方消息处理中间件](#message)
- **autoTest(componentAppId)** [返回全网发布测试用例的中间件](#autoTest)
- **oauth(componentAppId, authorizerAppId, redirectUrl [, scope [, state]])** [返回授权方网页授权中间件](#oauth)
- **getAuthorizerAccessToken(componentAppId, authorizerAppId, callback)**  [获取指定第三方平台下指定微信公众号的 **access token**](#getauthorizeraccesstoken)

主动调用接口：

- `getJsConfig(options, callback)` [获取指定第三方平台下指定微信公众号的网页 **js config** 配置对象](#getjsconfig)
- `getAuthorizerInfo(componentAppId, authorizerAppId, callback)` [获取授权方账号基本信息](#getauthorizerinfo)
- `getAuthorizerOptionInfo(componentAppId, authorizerAppId, optionName, callback)` [获取授权方选项设置信息](#getauthorizeroptioninfo)
- `setAuthorizerOption(componentAppId, authorizerAppId, optionName, optionValue, callback)` [设置授权方选项](#setauthorizeroption)
- `clearQuota(componentAppId, callback)` [第三方平台对其所有API调用次数清零](#clearquota)
- `createOpenAccount(componentAppId, authorizerAppId, callback)` [创建开放平台帐号并绑定公众号/小程序](#createopenaccount)
- `bindOpenAccount(componentAppId, authorizerAppId, openAppId, callback)` [将公众号/小程序绑定到开放平台帐号下](#bindopenaccount)
- `unbindOpenAccount(componentAppId, authorizerAppId, openAppId, callback)` [将公众号/小程序从开放平台帐号下解绑](#unbindopenaccount)
- `getOpenAccount(componentAppId, authorizerAppId, callback)` [获取公众号/小程序所绑定的开放平台帐号](#getopenaccount)



#### auth

返回第三方平台授权中间件。

- `componentAppId` \<string\> 第三方平台APPID
- `redirectUrl` \<string\> 授权成功后重定向的URL
- `authType` \<number\> 授权的类型

**redirectUrl** 该链接的域名必须和当前服务的域名相同，而且和微信第三方平台配置的域名相同。

**authType** 指定授权时显示的可选项。**1** 表示仅展示公众号、**2** 表示仅展示小程序、**3** 表示展示公众号和小程序。默认为 **3** 

```javascript
const { AUTH_TYPE_BOTH } = require('wechat-open-toolkit')
let componentAppId = 'wx52ffab2939ad'
let redirectUrl = 'https://domain.com/authorized'

app.get(`/wechat/auth/${componentAppId}`, toolkit.auth(componentAppId, redirectUrl, AUTH_TYPE_BOTH))
// 浏览器打开该路由即可扫码授权
```



#### events

返回第三方平台授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.events())
```



#### message

返回授权方消息处理中间件

- `componentAppId` \<string\> 第三方平台appId

```javascript
const componentAppId = 'wx52ffab2939ad'
app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, toolkit.message(componentAppId), (req, res) => {
  /**
  print req.wechat
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



#### 被动回复消息功能

当第三方平台收到授权方用户消息时，可以使用被动回复功能回复消息。

- **res.text(content)** 回复文本消息
- **res.image(mediaId)** 回复图片
- **res.voice(mediaId)** 回复语音
- **res.video(mediaId [, title [, description]])** 回复视频
- **res.musice(thumbMediaId [, HQMusicUrl [, musicUrl [, title [, description]]]])** 回复音乐

```javascript
let componentAppId = 'wx52ffab2939ad'
app.post(`/wechat/message/${componentAppId}/:authorizerAppId`,
    toolkit.message(componentAppId), (req, res) => {
    let { MsgType, Content, MediaId, Label, Title, Description, Url} = req.wechat
    switch (MsgType) {
        case 'text':
            res.text(Content)
            break;
        case 'image':
            res.image(MediaId)
            break;
        case 'voice':
            res.voice(MediaId)
            break;
        case 'video':
            res.video(MediaId)
            break;
        case 'location':
            res.text(Label)
            break;
        case 'link':
            res.text(`<a href="${Url}">${Title}-${Description}</a>`)
    }
})
```



#### autoTest

返回全网发布测试用例的中间件。该中间件需要放置在 [message](#message) 中间件后面，以及其他中间件前面。

- **componentAppId** \<string\> 第三方平台APPID

```javascript
let componentAppId = 'wx52ffab2939ad'
app.post(`/wechat/message/${componentAppId}/:authorizerAppId`,
    toolkit.message(componentAppId), toolkit.autoTest(componentAppId),
    (req, res) => {
        res.end('success') // 响应微信服务器
        console.log(req.wechat)
})
```



#### oauth

返回第三方平台代理微信公众号网页授权中间件。

- `componentAppId` \<string\> 第三方平台APPID
- `authorizerAppId` \<string\> 授权方APPID
- `redirectUrl` \<string\> 授权成功后的重定向URL
- `scope` \<string\> 网页授权的类型。可选
- `state` \<string\> 授权的附带值。可选

`scope`为授权作用域。可能的值为：` snsapi_base` 和 ` snsapi_userinfo`。默认为：`snsapi_base`

```javascript
const { OAUTH_TYPE_USERINFO } = require('wechat-open-toolkit')
let componentAppId = 'wx304925fbea25bcbe'
let authorizerAppId = 'wxc736b9251b3c6c41'
let redirectUrl = 'https://domain.com/authorized'

app.get(`/wechat/oauth/${componentAppId}/${authorizerAppId}`, 
		toolkit.oauth(componentAppId, authorizerAppId, redirectUrl, OAUTH_TYPE_USERINFO))
```







#### getAuthorizerAccessToken

获取指定第三方平台下指定微信公众号的access_token。

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `callback` \<Function\>
  - `err` \<Error\>
  - `access_token` \<string\> 微信公众号授权access_token

> 需要代理微信公众号调用api接口时，可以调用该接口获取授权的access_token后调用。

```javascript
const WechatApi = require('co-wechat-api')
const api = new WechatApi('', '', async () => {
  return new Promise((resolve, reject) => {
    toolkit.getAuthorizerAccessToken(componentAppId, authorizerAppId, (err, result) => {
      if (err) {
        return reject(err)
      }
      resolve({
        accessToken: result.access_token,
        expireTime: Date.now() + 1000 * 60
      })
    })
  })
})
api.sendText(openid, text).then(console.log).catch(console.error)
```



#### getApi

获取指定第三方平台下指定微信公众号的`wechat-api`对象。

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>

```javascript
toolkit.getApi('wxdf023kdsj02k', 'wx39930sj2ljfs').sendText(openId, text, callback)
```



#### getJsConfig

获取指定第三方平台下指定微信公众号的网页`jsConfig`配置对象。

- `options` \<Object\>
  - `componentAppId` \<string\>
  - `authorizerAppId` \<string\>
  - `url` \<string\> 网页链接
- `callback` \<Function\>
  - `err` \<Error\>
  - `result` \<Object\>

```javascript
const options = {
  componentAppId: '',
  authorizerAppId: '',
  url: ''
}
toolkit.getJsConfig(options, (err, result) => {
  if (!err) console.log(result)
  /**
  {
    appId: '',
    timestamp: 158923408,
    nonceStr: '292jslk30dk',
    signature: '20kjafj20dfhl2j0sjhk2h3f0afjasd2',
    jsApiList: []
  }
  */
})
```

#### getAuthorizerInfo

获取授权方账号基本信息

- `componentAppId` \<string\> 微信第三方appId
- `authorizerAppId` \<string\> 授权方公众号appId
- `callback` \<Function\> 
  - `err` \<Error\>
  - `result` \<Object\>

```javascript
toolkit.getAuthorizerInfo(componentAppId, authorizerAppId, (err, result) => {
  if (!err) console.log(result)
})
```

##### result 对象属性

- `authorizerInfo` \<Object\>
  - `nickname` \<string\> 授权方昵称
  - `headImg` \<string\> 授权方头像
  - `serviceTypeInfo` \<Object\>
    - `id` **<number>** 授权方公众号类型，0代表订阅号，1代表由历史老帐号升级后的订阅号，2代表服务号
  - `verifyTypeInfo` \<Object\>
    - `id` **<number>** 授权方认证类型，-1代表未认证，0代表微信认证，1代表新浪微博认证，2代表腾讯微博认证，3代表已资质认证通过但还未通过名称认证，4代表已资质认证通过、还未通过名称认证，但通过了新浪微博认证，5代表已资质认证通过、还未通过名称认证，但通过了腾讯微博认证
  - `username` \<string\> 授权方公众号的原始ID
  - `principalName` \<string\> 公众号的主体名称
  - `businessInfo` \<Object\> 用以了解以下功能的开通状况（0代表未开通，1代表已开通）：
    - `openStore` **<number>** 是否开通微信门店功能
    - `openScan` **<number>** 是否开通微信扫商品功能
    - `openPay` **<number>** 是否开通微信支付功能
    - `openCard` **<number>** 是否开通微信卡券功能
    - `openShake` **<number>** 是否开通微信摇一摇功能
  - `alias` \<string\> 授权方公众号所设置的微信号，可能为空
  - `qrcodeUrl` \<string\> 二维码图片的URL，开发者最好自行也进行保存
- `authorizationInfo` \<Object\> 授权信息
  - `authorizerAppId` \<string\> 授权方appid

*****

#### getAuthorizerOptionInfo

获取授权方选项设置信息

- `componentAppId` \<string\> 
- `authorizerAppId` \<string\>
- `optionName` \<string\>
- `callback` \<Function\>
  - `err` \<Error\>
  - `result` \<Object\>

该API用于获取授权方的公众号或小程序的选项设置信息，如：地理位置上报，语音识别开关，多客服开关。

```javascript
toolkit.getAuthorizerOptionInfo(componentAppId, authorizerAppId, optionName, (err, result) => {
  if (!err) console.log(result)
})
```

*****

#### setAuthorizerOption

设置授权方选项

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `optionName` \<string\>
- `optionValue` **<number>**
- `callback` \<Function\>
  - `err` \<Error\>

该API用于设置授权方的公众号或小程序的选项信息，如：地理位置上报，语音识别开关，多客服开关。

```javascript
toolkit.setAuthorizerOption(componentAppId, authorizerAppId, optionName, optionValue, (err) => {
  if (!err) console.log('ok')
})
```

| optionName                 | optionValue | 选项值说明             |
| -------------------------- | ----------- | ----------------- |
| location_report (地理位置上报选项) | `0`，`1`，`2` | 无上报，进入会话时上报，每5秒上报 |
| voice_recognize（语音识别开关选项）  | `0`，`1`     | 关闭语音识别，开启语音识别     |
| customer_service（多客服开关选项）  | `0`，`1`     | 关闭多客服，开启多客服       |

#### clearQuota

第三方平台对其所有API调用次数清零

- `componentAppId` \<string\> 
- `callback` \<Function\>
  - `err` \<Error\>

```javascript
toolkit.clearQuota(componentAppId, (err) => {
  if (!err) console.log('ok')
})
```

***

#### createOpenAccount

创建开放平台帐号并绑定公众号/小程序

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `callback` \<Function\>
  - `err` \<Error\>

```javascript
toolkit.createOpenAccount(componentAppId, authorizerAppId, (err) => {
  if (!err) console.log('ok')
})
```

#### bindOpenAccount

将公众号/小程序绑定到开放平台帐号下

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `openAppId` \<string\>
- `callback` \<Function\>
  - `err` \<Error\>

```javascript
toolkit.bindOpenAccount(componentAppId, authorizerAppId, (err) => {
  if (!err) console.log('ok')
})
```

#### unbindOpenAccount

将公众号/小程序从开放平台帐号下解绑

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `openAppId` \<string\>
- `callback` **<Function>*
  - `err` \<Error\>

```javascript
toolkit.unbindOpenAccount(componentAppId, authorizerAppId, (err) => {
  if (!err) console.log('ok')
})
```

#### getOpenAccount

获取公众号/小程序所绑定的开放平台帐号

- `componentAppId` \<string\>
- `authorizerAppId` \<string\>
- `callback` \<Function\>
  - `err` \<Error\>
  - `result` \<Object\>

```javascript
toolkit.getOpenAccount(componentAppId, authorizerAppId, (err, result) => {
  if (!err) console.log(result)
})
```

