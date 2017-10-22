# wechat-open-toolkit

WeChat open platform Toolkit.

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
  } catch(err) {
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
  } catch(err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('error', console.error)

app.use('/wechat/events', toolkit.events())
options.list.forEach(item => {
  const cid = item.componentAppId
  app.get(`/wechat/auth/${cid}`, 
      toolkit.auth(cid)
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
    console.log(req.wxuser)
    res.end('ok')
  })
  app.post(`/wechat/message/${cid}/:authorizerAppId`, 
      toolkit.message(cid)
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
      toolkit.auth(cid)
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
    console.log(req.wxuser)
    res.end('ok')
  })
  app.post(`/wechat/message/${cid}/:authorizerAppId`, 
      toolkit.message(cid)
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

### 方法

#### Function: auth(componentAppId)

返回第三方平台授权中间件。

```javascript
const componentAppId = 'wx52ffab2939ad'
app.get(`/wechat/auth/${componentAppId}`, toolkit.auth(componentAppId))
// 浏览器打开该路由即可扫码授权
```

#### Function: events()

返回授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.events(), (req, res, next) => {
  // req.wechatOpenMessage 保存着解析后的对象数据
  // 中间件已经响应了'success'，因此不需要再次响应。
})
```

#### Function: message(componentAppId)

返回微信公众号消息处理中间件。

```javascript
const componentAppId = 'wx52ffab2939ad'
app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, toolkit.message(componentAppId), (req, res, next) => {
  // print req.params
  /**
  {
    authorizerAppId: 'wx239skh03hsl23'
  }
  */
  // print req.wechatOpenMessage
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

#### Function: oauth(options)

返回第三方平台代理微信公众号网页授权中间件。

```javascript
const options = {
  componentAppId: '',
  authorizerAppId: '',
  scope: ''
}
app.get(`/wechat/oauth/${options.componentAppId}/${options.authorizerAppId}`, toolkit.oauth(options), (req, res, next) => {
  // print req.wxuser
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

### options 参数属性

| 名称              | 类型     | 必填   | 描述                                       |
| --------------- | ------ | ---- | ---------------------------------------- |
| componentAppId  | string | 是    | 微信第三方appid                               |
| authorizerAppId | string | 是    | 微信公众号appid                               |
| scope           | string | 否    | 授权作用域<br/>可能的值为：` snsapi_base` 和 ` snsapi_userinfo`。<br/>默认为：`snsapi_base` |

#### Function: getAuthorizerAccessToken(componentAppId, authorizerAppId, callback)

获取指定第三方平台下指定微信公众号的access_token。

##### 参数列表

| 名称              | 类型       | 必填   | 描述         |
| --------------- | -------- | ---- | ---------- |
| componentAppId  | string   | 是    | 微信第三方appid |
| authorizerAppId | string   | 是    | 微信公众号appid |
| callback        | function | 是    | 回调函数       |

##### 回调函数参数

| 名称           | 类型     | 描述                  |
| ------------ | ------ | ------------------- |
| err          | error  | 错误对象                |
| access_token | string | 微信公众号授权access_token |

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

#### Function: getApi(componentAppId, authorizerAppId)

获取指定第三方平台下指定微信公众号的wechat-api对象。

```javascript
toolkit.getApi('wxdf023kdsj02k', 'wx39930sj2ljfs').sendText(openId, text, callback)
```



