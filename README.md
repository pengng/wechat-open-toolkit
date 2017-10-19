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
  },
  async saveComponentVerifyTicket (result) {
    try {
      let obj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
      if (!obj) {
        obj = new Parse.Object('WeixinOpenToken')
        obj.set('componentAppId', result.componentAppId)
      }
      obj.set('componentVerifyTicket', result.ComponentVerifyTicket)
      await obj.save()
    } catch(err) {
      console.error(err)
    }
  },
  async saveComponentAccessToken (result) {
    try {
      let obj = await new Parse.Query('WeixinOpenToken').equalTo('componentAppId', result.componentAppId).first()
      if (!obj) {
        obj = new Parse.Object('WeixinOpenToken')
        obj.set('componentAppId', result.componentAppId)
      }
      obj.set('componentAccessToken', result.component_access_token)
      await obj.save()
    } catch(err) {
      console.error(err)
    }
  },
  async saveAuthorizerToken (result) {
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
      console.error(err)
    }
  },
  onError: console.error
}

const toolkit = new WechatOpenToolkit(options)

app.use('/wechat/open', toolkit.middlewarify())
app.get('/wechat/authorization', toolkit.authMiddlewarify())
app.post('/wechat/authorizer/:authorizerAppId', toolkit.messageMiddlewarify())

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
const saveComponentVerifyTicket = function (result) {
  /**
  {
    componentAppId: '',
    ComponentVerifyTicket: '' // Note the capitalization of C
  }
  */
  // save to the database
}
const saveComponentAccessToken = function (result) {
  /**
  {
    componentAppId: '',
    component_access_token: ''
  }
  */
  // save to the database
}
const saveAuthorizerToken = function (result) {
  /**
  {
    authorizer_appid: '',
    authorizer_access_token: '',
    authorizer_refresh_token: '',
    componentAppId: ''
  }
  */
  // save to the database
}
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
const onError = function (err) {
  console.error(err)
}
const options = {
  list,
  saveComponentVerifyTicket,
  saveComponentAccessToken,
  saveAuthorizerToken,
  getComponentVerifyTicket,
  onError
}
const toolkit = new WechatOpenToolkit(options)
app.use('/wechat/events', toolkit.middlewarify())
list.forEach(item => {
  const componentAppId = item.componentAppId
  app.get(`/wechat/authorization/${componentAppId}`, 
      toolkit.authMiddlewarify(componentAppId))
  app.post(`/wechat/message/${componentAppId}/:authorizerAppId`,
      toolkit.messageMiddlewarify(componentAppId),
      (req, res, next) => {
      	console.log(req.wechatOpenMessage)
  	  }
   )
})
app.listen(3000)
console.log('server start at 3000!')
console.log('The browser opens http://hostname/wechat/authorization/[componentAppId]')
```

### options 参数属性

| 名称                        | 类型       | 必填   | 描述                                       |
| ------------------------- | -------- | ---- | ---------------------------------------- |
| list                      | array    | 是    | [微信第三方账号列表](#list)                       |
| saveComponentVerifyTicket | function | 是    | [保存新的component_verify_ticket](#savecomponentverifyticket)，等同绑定`component_verify_ticket`事件。 |
| saveComponentAccessToken  | function | 是    | [保存新的component_access_token](#savecomponentaccesstoken)，等同绑定`component_access_token`事件。 |
| saveAuthorizerToken       | function | 是    | [保存新的代理调用微信公众号接口的授权token](#saveauthorizertoken)。包含`authorizer_access_token`和用于刷新的`authorizer_refresh_token`，等同绑定`authorizer_token`事件。 |
| getComponentVerifyTicket  | function | 是    | [首次启动读取缓存的component_verify_ticket](#getcomponentverifyticket) |
| onError                   | function | 是    | 绑定错误事件。                                  |
| onAuthorized              | function | 否    | 当有新的微信公众号授权事件时触发， 等同绑定`authorized`事件。    |

### list

list 数组内的成员属性。

| 名称                 | 类型     | 必填   | 描述             |
| ------------------ | ------ | ---- | -------------- |
| componentAppId     | string | 是    | 微信第三方appId     |
| componentAppSecret | string | 是    | 微信第三方appSecret |
| token              | string | 是    | 消息校验token      |
| encodingAESKey     | string | 是    | 消息加解密K         |
| host               | string | 是    | 登录授权发起页域名      |

### saveComponentVerifyTicket

保存新的`component_verify_ticket`，等同绑定`component_verify_ticket`事件。

##### 参数 result 属性

| 名称                    | 类型     | 描述                             |
| --------------------- | ------ | ------------------------------ |
| AppId                 | string | 微信第三方appId                     |
| CreateTime            | string | 时间戳，秒。                         |
| InfoType              | string | 事件类型，`component_verify_ticket` |
| ComponentVerifyTicket | string | component_verify_ticket        |
| componentAppId        | string | 微信第三方appId                     |

### saveComponentAccessToken

保存新的`component_access_token`，等同绑定`component_access_token`事件。

##### 参数 result 属性

| 名称                     | 类型     | 描述          |
| ---------------------- | ------ | ----------- |
| component_access_token | string | 调用第三方平台接口   |
| Expires_in             | number | 7200 秒，2个小时 |
| componentAppId         | string | 微信第三方appId  |

### saveAuthorizerToken

保存新的代理调用微信公众号接口的授权`token`。包含`authorizer_access_token`和用于刷新的`authorizer_refresh_token`

##### 参数 result 属性

| 名称                       | 类型     | 描述                      |
| ------------------------ | ------ | ----------------------- |
| authorizer_appid         | string | 授权微信公众号appd             |
| authorizer_access_token  | string | 授权微信公众号调用接口token        |
| authorizer_refresh_token | string | 刷新`access_token`用的token |
| expires_in               | number | 7200  秒，2个小时            |
| componentAppId           | string | 微信第三方appId              |

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
| AppId                        | string | 微信公众号           |
| CreateTime                   | string | 时间戳             |
| InfoType                     | string | 事件类型，authorized |
| AuthorizerAppId              | string | 微信公众号appid      |
| AuthorizationCode            | string | 微信公众号授权码        |
| AuthorizationCodeExpiredTime | string | 过期时间戳           |
| PreAuthCode                  | string | 预授权             |
| componentAppId               | string | 微信第三方appId      |

#### Event: updateauthorized

更新授权事件。

#### Event: unauthorized

取消授权事件。

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
app.get('/auth/test', toolkit.authMiddlewarify(componentAppId))
// 浏览器打开该路由即可扫码授权
```

#### Function: middlewarify()

返回授权事件处理中间件。

```javascript
app.use('/wechat/open', toolkit.middlewarify(), (req, res, next) => {
  // req.wechatOpenMessage 保存着解析后的对象数据
  // 中间件已经响应了'success'，因此不需要再次响应。
})
```

#### Function: messageMiddlewarify(componentAppId)

返回微信公众号处理中间件。

```javascript
app.post('/weechat/authorizer/:authorizerAppId', toolkit.messageMiddlewarify(componentAppId), (req, res, next) => {
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

