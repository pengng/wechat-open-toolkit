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

const options = {
    list: [
        {
            componentAppId: '', // 微信第三方平台 appId
            componentAppSecret: '', // 微信第三方平台 appSecret
            token: '', // 消息校验 Token
            encodingAESKey: '', // 消息加解密 key
            host: '' // 网页授权的域名
        }
    ],
    async getComponentVerifyTicket (componentAppId, callback) {
        callback([err[, component_verify_ticket]])
    }
}

const toolkit = new WechatOpenToolkit(options)

toolkit.on('component_access_token', function (result) {
    console.log(result)
})

toolkit.on('component_verify_ticket', function (result) {
    console.log(result)
})

toolkit.on('authorizer_token', function (result) {
    console.log(result)
})

toolkit.on('unauthorized', function (result) {
    console.log(result)
})

toolkit.on('error', console.error)

app.use('/wechat/events', toolkit.events())
options.list.forEach(item => {
    const cid = item.componentAppId
    app.get(`/wechat/auth/${cid}`, 
            toolkit.auth(cid),
            (req, res) => {
                res.end('授权成功')
            }
    )
    app.get(`/wechat/oauth/${cid}/:authorizerAppId`, (req, res, next) => {
        const aid = req.params.authorizerAppId
        const options = {
            componentAppId: cid,
            authorizerAppId: aid,
            scope: 'snsapi_userinfo'
        }
        toolkit.oauth(options)(req, res, next)
    }, (req, res) => {
        console.log(req.wechat)
        res.end('ok')
    })
    app.post(`/wechat/message/${cid}/:authorizerAppId`, 
            toolkit.message(cid),
            (req, res) => {
                console.log(req.wechat)
            }
    )
})

app.listen(3000,function () {
    console.log('server start at 3000')
})
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

| 名称               | 类型    | 必填 | 描述                              |
| ------------------ | ------- | ---- | --------------------------------- |
| componentAppId     | string  | 是   | 微信第三方appId                   |
| componentAppSecret | string  | 是   | 微信第三方appSecret               |
| token              | string  | 是   | 消息校验token                     |
| encodingAESKey     | string  | 是   | 消息加解密Key                     |
| host               | string  | 是   | 登录授权发起页域名                |
| enableReply        | boolean | 否   | 默认值 false，会自动回复"success" |



#### getComponentVerifyTicket

```javascript
function getComponentVerifyTicket (componentAppId, callback) {
  	// 调用 callback 返回上次保存的 component_verify_ticket 和错误信息（如果有的话）
		callback([err [, component_verify_ticket]])
}
```



#### 当收到微信推送的 component_verify_ticket 时触发 component_verify_ticket 事件

```javascript
toolkit.on('component_verify_ticket', function (result) {
/* {
    AppId: "wx52ffab2939ad",
    CreateTime: "142345003"
    InfoType: "component_verify_ticket",
    ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
} */
})
```

> 微信服务器会每隔10分钟推送1次，目前没有主动触发微信推送的机制，解决方法是存储上一次的推送数据，并且每次启动时，主动触发一次相同事件。示例如下：
>
> ```
> toolkit.emit('component_verify_ticket', {
>     AppId: "wx52ffab2939ad",
>     CreateTime: "142345003"
>     InfoType: "component_verify_ticket",
>     ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
> })
> ```



#### 当刷新 componentAccessToken 时触发 component_access_token 事件

```javascript
toolkit.on('component_access_token', function (result) {
/* {
    componentAppId: 'wx52ffab2939ad',
    componentAccessToken: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expiresIn: 7200
} */
})
```



#### 当刷新 authorizerAccessToken 时触发 authorizer_token 事件

```javascript
toolkit.on('authorizer_token', function (result) {
    /**
    {
        componentAppId: 'wx52ffab2939ad',
        authorizerAppId: 'wxf2338d927b405d39',
        authorizerAccessToken: 'j7mR_dvcCAmUq5Iw-MuzE4sBT0unN-ukg7LR8EqZEQ1wZ7oyw0rs1Idk40d7uxriOubE3795JiFa3e5jDGdofRpTemXd2HLLV6p_i_Uwy7m2Rp-qv1k1ld-T9iCCDcVeQONdALDFDC',
        authorizerRefreshToken: 'refreshtoken@@@6Esz0GgFsth_vRPtqjQd_aIQcCBcJ4iuzQFf3akLwgg',
        expiresIn: 7200
    }
    */
})
```



#### 当刷新 jsapi_ticket 时触发 authorizer_jsapi_ticket 事件

```javascript
toolkit.on('authorizer_jsapi_ticket', function (result) {
/* {
    componentAppId: '',
    authorizerAppId: '',
    authorizerJsApiTicket: '',
    expiresIn: ''
} */
})
```



#### 当新的公众号授权成功时触发 authorized 事件

```javascript
toolkit.on('authorized', function (result) {
/* {
    componentAppId: '',
    authorizerAppId: '',
    authorizationCode: '',
    authorizationCodeExpiredTime: 7200,
    preAuthCode: '',
    createTime: 142345003,
    infoType: 'authorized'
} */
})
```



#### 当已授权公众号更新权限时触发 update_authorized 事件

```javascript
toolkit.on('update_authorized', function (result) {
/* {
    componentAppId: '',
    authorizerAppId: '',
    authorizationCode: '',
    authorizationCodeExpiredTime: 7200,
    preAuthCode: '',
    createTime: 142345003,
    infoType: 'update_authorized'
} */
})
```



#### 当已授权公众号取消授权时触发 unauthorized 事件

```javascript
toolkit.on('unauthorized', function (result) {
/* {
    componentAppId: '',
    authorizerAppId: '',
    createTime: 142345003,
    infoType: 'unauthorized'
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

- `auth(componentAppId, authType)` [返回第三方平台授权中间件](#auth)
- `events()` [返回授权事件处理中间件](#events)
- `message(componentAppId)` [返回微信公众号消息处理中间件](#message)
- `oauth(options)` [返回第三方平台代理微信公众号网页授权中间件](#oauth)
- `getAuthorizerAccessToken(componentAppId, authorizerAppId, callback)`  [获取指定第三方平台下指定微信公众号的 **access token**](#getauthorizeraccesstoken)
- `getApi(componentAppId, authorizerAppId)` [获取指定第三方平台下指定微信公众号的 **wechat api** 对象](#getapi)
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

- `componentAppId` \<string\>
- `authType` **<number>**

`authType` 指定授权时显示的可选项。`1` 表示仅展示公众号、`2` 表示仅展示小程序、`3` 表示展示公众号和小程序。默认为 `3` 。

```javascript
const componentAppId = 'wx52ffab2939ad'
const authType = 3
app.get(`/wechat/auth/${componentAppId}`, toolkit.auth(componentAppId, authType), (req, res) => {
  res.end('ok')
})
// 浏览器打开该路由即可扫码授权
```

#### events

返回授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.events())
```

#### message

返回微信公众号消息处理中间件

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

#### oauth

返回第三方平台代理微信公众号网页授权中间件。

- `options` \<Object\>
  - `componentAppId` \<string\> 
  - `authorizerAppId` \<string\>
  - `scope` \<string\>


`scope`为授权作用域。可能的值为：` snsapi_base` 和 ` snsapi_userinfo`。默认为：`snsapi_base`

```javascript
const options = {
  componentAppId: '',
  authorizerAppId: '',
  scope: ''
}
app.get(`/wechat/oauth/${options.componentAppId}/${options.authorizerAppId}`, toolkit.oauth(options), (req, res) => {
  // print req.wechat
  /**
  {
    openid: 'oVtjJv5NEub-fbE7E6_P2_jCLMXo',
    nickname: 'test',
    sex: 1,
    language: 'zh_CN',
    city: '',
    province: '',
    country: '',
    headimgurl: '',
    privilege: [],
    unionid: ''
  }
  */
  res.setHeader('content-type', 'text/html; charset=utf-8')
  res.end('<pre>' + JSON.stringify(req.wxuser, null, 4) + '</pre>')
})
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

