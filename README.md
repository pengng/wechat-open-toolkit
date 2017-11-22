# wechat-open-toolkit

wechat open platform toolkit.

微信开放平台工具包

> The module is used to simplify the management of multiple WeChat open platform and multiple WeChat public number. Provide `componentAccessToken` and `componentVerifyTicket`,`authorizerAccessToken`,`authorizerRefreshToken` auto-refresh. Through the authorization event processing middleware and message agent middleware to help build the basic WeChat third party platform.
>
> 该模块用于简化管理多个微信开放平台和多个微信公众号。提供`componentAccessToken`和`componentVerifyTicket`、`authorizeAccessToken`、`authorizerRefreshToken`自动刷新。通过授权事件处理中间件和消息代理中间件帮助搭建基础微信第三方平台。

### Usage

```shell
npm i wechat-open-toolkit -S
```

```javascript
const Parse = require('parse/node')
const express = require('express')
const app = express()
const WechatOpenToolkit = require('wechat-open-toolkit')
Parse.initialize('')
Parse.serverURL = ''

const options = {
  list: [
    {
      componentAppId: '',
      componentAppSecret: '',
      token: '',
      encodingAESKey: '',
      host: ''
    }
  ],
  async getComponentVerifyTicket (componentAppId, callback) {
    try {
      const result = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', componentAppId).first()
      if (!result) {
        return callback(null)
      }
      callback(null, result.get('componentVerifyTicket'))
    } catch(err) {
      callback(err)
    }
  }
}

const toolkit = new WechatOpenToolkit(options)

toolkit.on('component_access_token', async (result) => {
  try {
    let obj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
    if (!obj) {
      obj = new Parse.Object('WeixinOpenToken')
      obj.set('componentAppId', result.componentAppId)
    }
    obj.set('componentAccessToken', result.componentAccessToken)
    await obj.save()
  } catch(err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('component_verify_ticket', async (result) => {
  try {
    let obj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
    if (!obj) {
      obj = new Parse.Object('WeixinOpenToken')
      obj.set('componentAppId', result.componentAppId)
    }
    obj.set('componentVerifyTicket', result.componentVerifyTicket)
    await obj.save()
  } catch (err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('authorizer_token', async (result) => {
  try {
    let obj = await new Parse.Query('WeixinOpenAuthorizerToken').equalTo('authorizerAppId', result.authorizerAppId).first()
    if (!obj) {
      obj = new Parse.Object('WeixinOpenAuthorizerToken')
      obj.set('authorizerAppId', result.authorizerAppId)
      const componentObj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
      obj.set('component', componentObj)
    }
    obj.set('authorizerAccessToken', result.authorizerAccessToken)
    obj.set('authorizerRefreshToken', result.authorizerRefreshToken)
    await obj.save()
  } catch (err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('unauthorized', async (result) => {
  try {
    let obj = await new Parse.Query('WeixinOpenAuthorizerToken').equalTo('authorizerAppId', result.authorizerAppId).first()
    if (!obj) return
    await obj.destroy()
  } catch (err) {
    toolkit.emit('error', err)
  }
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

### Step 1

##### Configure WeChat open platform `appId` and `appSecret`

```javascript
const list = [
  {
    componentAppId: '', // wechat open platform appId
    componentAppSecret: '', // wechat open platform appSecret
    token: '', // message check Token
    encodingAESKey: '', // message encryption and decryption key
    host: '' // The domain name of the login authorization
  }
]
```

### Step 2

##### Configuration save function, save `componentVerifyTicket`, `componentAccessToken`, `authorizerAccessToken`, `authorizerRefreshToken`.

```javascript
toolkit.on('component_access_token', function (result) {
  /**
  print result
  {
    componentAppId: '',
    componentAccessToken: ''
  }
  */
  // save to the database
})

toolkit.on('component_verify_ticket', function (result) {
  /**
  {
    componentAppId: '',
    componentVerifyTicket: ''
  }
  */
  // save to the database
})

toolkit.on('authorizer_token', function (result) {
  /**
  {
    authorizerAppId: '',
    authorizerAccessToken: '',
    authorizerRefreshToken: '',
    componentAppId: ''
  }
  */
  // save to the database
})

toolkit.on('error', console.error)
```

### Step 3

##### Configure the initialization data function. Get `componentVerifyTicket` 

```javascript
const getComponentVerifyTicket = function (componentAppId, callback) {
  // Get data from the database
  const componentVerifyTicket = ''
  callback(err, componentVerifyTicket)
  // Call the callback function to return componentVerifyTicket
}
```

### Step 4

##### Configure the error handling function, instantiate the `WechatOpenToolkit`, and configure the route.

```javascript
const WechatOpenToolkit = require('wechat-open-toolkit')
const app = require('express')()
const options = {
  list,
  getComponentVerifyTicket
}
const toolkit = new WechatOpenToolkit(options)
app.use('/wechat/events', toolkit.events())
list.forEach(item => {
  const cid = item.componentAppId
  app.get(`/wechat/auth/${cid}`, 
      toolkit.auth(cid),
      (req, res) => {
      	res.end('ok')
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
app.listen(3000)
console.log('server start at 3000!')
console.log('The browser opens http://hostname/wechat/authorization/[componentAppId]')
```

### options 参数属性

| 名称                       | 类型       | 必填   | 描述                                       |
| ------------------------ | -------- | ---- | ---------------------------------------- |
| list                     | array    | 是    | [微信第三方账号列表](#list)                       |
| getComponentVerifyTicket | function | 是    | [首次启动读取缓存的component_verify_ticket](#getcomponentverifyticket) |

### list

list 数组内的成员属性。

| 名称                 | 类型     | 必填   | 描述             |
| ------------------ | ------ | ---- | -------------- |
| componentAppId     | string | 是    | 微信第三方appId     |
| componentAppSecret | string | 是    | 微信第三方appSecret |
| token              | string | 是    | 消息校验token      |
| encodingAESKey     | string | 是    | 消息加解密Key       |
| host               | string | 是    | 登录授权发起页域名      |

### getComponentVerifyTicket

##### 参数 componentAppId 和 callback

```javascript
const getComponentVerifyTicket = function (componentAppId, callback) {
  // 从数据库取componentAppId对应的componentVerifyTicket,
  // 调用callback返回
  // 第一次使用时若没有componentVerifyTicket则直接调用callback
  db.getCollection('WeixinOpenToken').findOne({
    componentAppId: componentAppId
  }, function (err, result) {
    callback(err, result.componentVerifyTicket)
  })
}
```

### 事件

#### Event: component_verify_ticket

当收到新的`componentVerifyTicket`时触发。

##### 参数 result 属性

| 名称                    | 类型     | 描述                             |
| --------------------- | ------ | ------------------------------ |
| componentAppId        | string | 微信第三方appId                     |
| componentVerifyTicket | string | 微信第三方 `componentVerifyTicket`  |
| infoType              | string | 事件类型，`component_verify_ticket` |
| createTime            | number | 消息生成时间戳，秒。                     |

```javascript
toolkit.on('component_verify_ticket', result => {
  console.log(result)
  /**
  	{
      componentAppId: 'wx52ffab2939ad',
      infoType: 'component_verify_ticket',
      componentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA',
      createTime: 142345003
  	}
  */
})
```

#### Event: component_access_token

当刷新`componentAccessToken`时触发。

##### 参数 result 属性

| 名称                   | 类型     | 描述           |
| -------------------- | ------ | ------------ |
| componentAppId       | string | 微信第三方appId   |
| componentAccessToken | string | 第三方平台接口token |
| expiresIn            | number | 7200 秒，2个小时  |

```javascript
toolkit.on('component_access_token', result => {
  console.log(result)
  /**
  {
    componentAppId: 'wx52ffab2939ad',
    componentAccessToken: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expiresIn: 7200
  }
  */
})
```

### Event: authorizer_token

当刷新`authorizerAccessToken`和`authorizerRefreshToken`时触发。

##### 参数 result 属性

| 名称                     | 类型     | 描述                               |
| ---------------------- | ------ | -------------------------------- |
| componentAppId         | string | 微信第三方appId                       |
| authorizerAppId        | string | 授权微信公众号appid                     |
| authorizerAccessToken  | string | 授权微信公众号调用接口token                 |
| authorizerRefreshToken | string | 刷新`authorizerAccessToken`用的token |
| expiresIn              | number | 时间戳，7200秒                        |

```javascript
toolkit.on('authorizer_token', result => {
  console.log(result)
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

### Event: authorizer_jsapi_ticket

当刷新微信公众号网页`jsapi_ticket`时触发。

#### 结果 result 对象属性

| 名称                    | 类型     | 描述                     |
| --------------------- | ------ | ---------------------- |
| componentAppId        | string | 微信第三方appid             |
| authorizerAppId       | string | 微信公众号appid             |
| authorizerJsApiTicket | string | 微信公众号网页 `jsapi_ticket` |
| expiresIn             | number | 时间戳。                   |

```javascript
toolkit.on('authorizer_jsapi_ticket', async (result) => {
  console.log(result)
  /**
  {
    componentAppId: '',
    authorizerAppId: '',
    authorizerJsApiTicket: '',
    expiresIn: ''
  }
  */
})
```

### Event: authorized

授权成功事件。

##### 参数 result

| 名称                           | 类型     | 描述                |
| ---------------------------- | ------ | ----------------- |
| componentAppId               | string | 微信第三方appId        |
| authorizerAppId              | string | 微信公众号appid        |
| authorizationCode            | string | 微信公众号授权码          |
| authorizationCodeExpiredTime | number | 授权码过期时间戳，秒        |
| preAuthCode                  | string | 预授权码              |
| createTime                   | number | 时间戳               |
| infoType                     | string | 事件类型，`authorized` |

### Event: update_authorized

更新授权事件。

##### 参数 result

| 名称                           | 类型     | 描述                       |
| ---------------------------- | ------ | ------------------------ |
| componentAppId               | string | 微信第三方appId               |
| authorizerAppId              | string | 微信公众号appid               |
| authorizationCode            | string | 微信公众号授权码                 |
| authorizationCodeExpiredTime | number | 授权码过期时间戳，秒               |
| preAuthCode                  | string | 预授权码                     |
| createTime                   | number | 时间戳                      |
| infoType                     | string | 事件类型，`update_authorized` |

### Event: unauthorized

取消授权事件。

##### 参数 result

| 名称              | 类型     | 描述                  |
| --------------- | ------ | ------------------- |
| componentAppId  | string | 微信第三方appId          |
| authorizerAppId | string | 微信公众号appid          |
| createTime      | number | 消息创建时间戳，秒           |
| infoType        | string | 事件类型 `unauthorized` |

### Event: error

错误事件。

```Javascript
toolkit.on('error', console.error)
```

### Function

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

