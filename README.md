# wechat-open-toolkit

WeChat open platform Toolkit.

微信开放平台工具包

> The module is used to simplify the management of multiple WeChat open platform and multiple WeChat public number. Provide `component_access_token` and `component_verify_ticket`,`authorizer_access_token`,`authorizer_refresh_token` auto-refresh. Through the authorization event processing middleware and message agent middleware to help build the basic WeChat third party platform.
>
> 该模块用于简化管理多个微信开放平台和多个微信公众号。提供`component_access_token`和`component_verify_ticket`、`authorizer_access_token`、`authorizer_refresh_token`自动刷新。通过授权事件处理中间件和消息代理中间件帮助搭建基础微信第三方平台。

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
    obj.set('componentAccessToken', result.component_access_token)
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
    obj.set('componentVerifyTicket', result.ComponentVerifyTicket)
    await obj.save()
  } catch(err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('authorizer_token', async (result) => {
  try {
    let obj = await new Parse.Query('WeixinOpenAuthorizerToken').equalTo('authorizerAppId', result.authorizer_appid).first()
    if (!obj) {
      obj = new Parse.Object('WeixinOpenAuthorizerToken')
      obj.set('authorizerAppId', result.authorizer_appid)
      const componentObj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
      obj.set('component', componentObj)
    }
    obj.set('authorizerAccessToken', result.authorizer_access_token)
    obj.set('authorizerRefreshToken', result.authorizer_refresh_token)
    await obj.save()
  } catch(err) {
    toolkit.emit('error', err)
  }
})

toolkit.on('error', console.error)

app.use('/wechat/events', toolkit.middlewarify())
options.list.forEach(item => {
  const cid = item.componentAppId
  app.get(`/wechat/auth/${cid}`, 
      toolkit.authMiddlewarify(cid)
  )
  app.get(`/wechat/oauth/${cid}/:authorizerAppId`, (req, res, next) => {
    const aid = req.params.authorizerAppId
    const options = {
      componentAppId: cid,
      authorizerAppId: aid,
      scope: 'snsapi_userinfo'
    }
    toolkit.oauthMiddlewarify(options)(req, res, next)
  }, (req, res) => {
    console.log(req.wxuser)
    res.end('ok')
  })
  app.post(`/wechat/message/${cid}/:authorizerAppId`, 
      toolkit.messageMiddlewarify(cid)
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

##### Configuration save function, save `component_verify_ticket`, `component_access_token`, `authorizer_access_token`, `authorizer_refresh_token`.

```javascript
toolkit.on('component_access_token', function (result) {
  /**
  print result
  {
    componentAppId: '',
    component_access_token: ''
  }
  */
  // save to the database
})

toolkit.on('component_verify_ticket', function (result) {
  /**
  {
    componentAppId: '',
    ComponentVerifyTicket: '' // Note the capitalization of C
  }
  */
  // save to the database
})

toolkit.on('authorizer_token', function (result) {
  /**
  {
    authorizer_appid: '',
    authorizer_access_token: '',
    authorizer_refresh_token: '',
    componentAppId: ''
  }
  */
  // save to the database
})
```

### Step 3

##### Configure the initialization data function. Get `component_verify_ticket` 

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
app.use('/wechat/events', toolkit.middlewarify())
list.forEach(item => {
  const cid = item.componentAppId
  app.get(`/wechat/auth/${cid}`, 
      toolkit.authMiddlewarify(cid)
  )
  app.get(`/wechat/oauth/${cid}/:authorizerAppId`, (req, res, next) => {
    const aid = req.params.authorizerAppId
    const options = {
      componentAppId: cid,
      authorizerAppId: aid,
      scope: 'snsapi_userinfo'
    }
    toolkit.oauthMiddlewarify(options)(req, res, next)
  }, (req, res) => {
    console.log(req.wxuser)
    res.end('ok')
  })
  app.post(`/wechat/message/${cid}/:authorizerAppId`, 
      toolkit.messageMiddlewarify(cid)
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

当收到新的`component_verify_ticket`时触发。

##### 参数 result 属性

| 名称                    | 类型     | 描述                             |
| --------------------- | ------ | ------------------------------ |
| AppId                 | string | 微信第三方appId                     |
| CreateTime            | string | 时间戳，秒。                         |
| InfoType              | string | 事件类型，`component_verify_ticket` |
| ComponentVerifyTicket | string | component_verify_ticket        |
| componentAppId        | string | 微信第三方appId                     |

```javascript
toolkit.on('component_verify_ticket', result => {
  console.log(result)
  /**
  	{
      AppId: 'wx52ffab2939ad',
      componentAppId: 'wx52ffab2939ad',
      CreateTime: '1508309812',
      InfoType: 'component_verify_ticket',
      ComponentVerifyTicket: 'ticket@@@lEHjsBEi_TPDey0IZxw4Zbb7JRYLOtEf9ksvDpSwzkwog3R6xEpdaK0yIee7JOyOXM0V7cp0dpM58GKmb8FSKA'
  	}
  */
})
```

#### Event: component_access_token

当刷新`component_access_token`时触发。

##### 参数 result 属性

| 名称                     | 类型     | 描述          |
| ---------------------- | ------ | ----------- |
| component_access_token | string | 调用第三方平台接口   |
| Expires_in             | number | 7200 秒，2个小时 |
| componentAppId         | string | 微信第三方appId  |

```javascript
toolkit.on('component_access_token', result => {
  console.log(result)
  /**
  {
    componentAppId: 'wx52ffab2939ad',
    component_access_token: 'M5CvflZyL5fkV29gU6MhQIoNsvzPEGBjYgmgA7yxnI_l8sblqm0QUULiMHoWY3gXPOnenZs3-42x_EenE1DEAg2F1K3X_fOI44h_eqxrV_7b0K7yc3pEGf_qTZl8HOlyCTSiAHAVML',
    expires_in: 7200
  }
  */
})
```

### Event: authorizer_token

当刷新`authorizer_access_token`和`authorizer_refresh_token`时触发。

##### 参数 result 属性

| 名称                       | 类型     | 描述                      |
| ------------------------ | ------ | ----------------------- |
| authorizer_appid         | string | 授权微信公众号appd             |
| authorizer_access_token  | string | 授权微信公众号调用接口token        |
| authorizer_refresh_token | string | 刷新`access_token`用的token |
| expires_in               | number | 7200  秒，2个小时            |
| componentAppId           | string | 微信第三方appId              |

```javascript
toolkit.on('authorizer_token', result => {
  console.log(result)
  /**
  {
    authorizer_appid: 'wxf2338d927b405d39',
    authorizer_access_token: 'j7mR_dvcCAmUq5Iw-MuzE4sBT0unN-ukg7LR8EqZEQ1wZ7oyw0rs1Idk40d7uxriOubE3795JiFa3e5jDGdofRpTemXd2HLLV6p_i_Uwy7m2Rp-qv1k1ld-T9iCCDcVeQONdALDFDC',
    authorizer_refresh_token: 'refreshtoken@@@6Esz0GgFsth_vRPtqjQd_aIQcCBcJ4iuzQFf3akLwgg',
    expires_in: 7200,
    func_info: [
      funcscope_category: 
    ],
    componentAppId: 'wx52ffab2939ad'
  }
  */
})
```

#### Event: authorized

授权成功事件。

##### 参数 result

| 名称                           | 类型     | 描述              |
| ---------------------------- | ------ | --------------- |
| AppId                        | string | 微信第三方appId      |
| CreateTime                   | string | 时间戳             |
| InfoType                     | string | 事件类型，authorized |
| AuthorizerAppid              | string | 微信公众号appid      |
| AuthorizationCode            | string | 微信公众号授权码        |
| AuthorizationCodeExpiredTime | string | 过期时间戳           |
| PreAuthCode                  | string | 预授权             |
| componentAppId               | string | 微信第三方appId      |

#### Event: updateauthorized

更新授权事件。

##### 参数 result

| 名称                           | 类型     | 描述                    |
| ---------------------------- | ------ | --------------------- |
| AppId                        | string | 微信第三方appId            |
| CreateTime                   | string | 时间戳                   |
| InfoType                     | string | 事件类型，updateauthorized |
| AuthorizerAppid              | string | 微信公众号appid            |
| AuthorizationCode            | string | 微信公众号授权码              |
| AuthorizationCodeExpiredTime | string | 过期时间戳                 |
| PreAuthCode                  | string | 预授权                   |
| componentAppId               | string | 微信第三方appId            |

#### Event: unauthorized

取消授权事件。

##### 参数 result

| 名称                           | 类型     | 描述                |
| ---------------------------- | ------ | ----------------- |
| AppId                        | string | 微信第三方appId        |
| CreateTime                   | string | 时间戳               |
| InfoType                     | string | 事件类型，unauthorized |
| AuthorizerAppid              | string | 微信公众号appid        |
| componentAppId               | string | 微信第三方appId        |

#### Event: error

错误事件。

```Javascript
toolkit.on('error', console.error)
```

### 方法

#### Function: authMiddlewarify(componentAppId)

返回第三方平台授权中间件。

```javascript
const componentAppId = 'wx52ffab2939ad'
app.get(`/wechat/auth/${componentAppId}`, toolkit.authMiddlewarify(componentAppId))
// 浏览器打开该路由即可扫码授权
```

#### Function: middlewarify()

返回授权事件处理中间件。

```javascript
app.use('/wechat/events', toolkit.middlewarify(), (req, res, next) => {
  // req.wechatOpenMessage 保存着解析后的对象数据
  // 中间件已经响应了'success'，因此不需要再次响应。
})
```

#### Function: messageMiddlewarify(componentAppId)

返回微信公众号消息处理中间件。

```javascript
const componentAppId = 'wx52ffab2939ad'
app.post(`/wechat/message/${componentAppId}/:authorizerAppId`, toolkit.messageMiddlewarify(componentAppId), (req, res, next) => {
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

#### Function: oauthMiddlewarify(options)

返回第三方平台代理微信公众号网页授权中间件。

```javascript
const options = {
  componentAppId: '',
  authorizerAppId: '',
  scope: ''
}
app.get(`/wechat/oauth/${options.componentAppId}/${options.authorizerAppId}`, toolkit.oauthMiddlewarify(options), (req, res, next) => {
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



