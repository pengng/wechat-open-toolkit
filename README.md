# wechat-open-toolkit

WeChat open platform Toolkit.

微信开放平台工具包

> The module is used to simplify the management of multiple WeChat open platform and multiple WeChat public number. Provide component_access_token and component_verify_ticket auto-refresh, and authorization event handling middleware.
>
> 该模块用于简化管理多个微信开放平台和多个微信公众号。提供`component_access_token`和`component_verify_ticket`自动刷新，和授权事件处理中间件。

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
      encodingAESKey: ''
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
      }
      obj.set('componentAccessToken', result.component_access_token)
      await obj.save()
    } catch(err) {
      console.error(err)
    }
  },
  onError: console.error
}

const toolkit = new WechatOpenToolkit(options)

app.use('/wechat-open', toolkit.middlewarify())

app.listen(3000,function () {
  console.log('server start at 3000')
})
```

### options 参数属性

| 名称                        | 类型       | 必填   | 描述                                       |
| ------------------------- | -------- | ---- | ---------------------------------------- |
| list                      | array    | 是    | 微信第三方账号                                  |
| getComponentVerifyTicket  | function | 是    | 首次启动读取缓存的`component_verify_ticket`       |
| saveComponentVerifyTicket | function | 是    | 保存新的`component_verify_ticket`            |
| saveComponentAccessToken  | function | 是    | 保存新的`component_access_token`             |
| onAuthorized              | function | 否    | 当有新的微信公众号授权事件时触发                         |
| saveAuthorizerToken       | function | 是    | 保存新的微信公众号授权调用`API`的`authorizer_access_token`和用于刷新的`authorizer_refresh_token` |
| onError                   | function | 是    | 绑定错误事件。                                  |

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

#### Event: error

错误事件。

```Javascript
toolkit.on('error', console.error)
```

### 方法

#### Function: authMiddlewarify(componentId)

返回第三方平台授权中间件。

```javascript
app.get('/auth/test', toolkit.authMiddlewarify('wx52ffab2939ad'))
```

#### Function: middlewarify()

返回授权事件处理中间件。

```javascript
app.use('/wechat/open', toolkit.middlewarify())
```

