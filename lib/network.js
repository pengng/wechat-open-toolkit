const https = require('https')

// 获取HTTP请求主体
function getBody(req) {
    return new Promise(function (resolve, reject) {
        let buffers = [] // 缓冲数据

        req.on('error', reject) // 处理请求错误
            .on('aborted', reject) // 处理请求中止
            .on('data', Array.prototype.push.bind(buffers))
            .on('end', function () {
                let body = Buffer.concat(buffers) // 拼接请求主体
                resolve(body)
            })
    })
}

/**
 * 发送HTTPS get请求
 * @param {string} url 请求的URL
 */
function get(url) {
    return new Promise(function (resolve, reject) {
        let req = https.get(url, async function (res) {
            let { statusCode, headers } = res // 响应状态码和响应头部
            try {
                let body = await getBody(res) // 获取响应主体
                let bodyRaw = body.toString()
                let data = JSON.parse(bodyRaw)
                resolve({ statusCode, headers, data })
            } catch(err) {
                reject(err)
            }
        })
        req.on('error', reject) // 当连接出错时触发
    })
}

/**
 * 发送HTTPS post请求
 * @param {string} url 请求的URL
 * @param {Object} data 提交的数据
 */
function post(url, data) {
    return new Promise(function (resolve, reject) {
        let body = JSON.stringify(data)
        let req = https.request(url, { method: 'POST', 'Content-Type': 'application/json' }, async function (res) {
            let { statusCode, headers } = res
            try {
                let body = await getBody(res) // 获取响应主体
                let bodyRaw = body.toString()
                let data = JSON.parse(bodyRaw)
                resolve({ statusCode, headers, data })
            } catch(err) {
                reject(err)
            }
        })
        req.on('error', reject).end(body)
    })
}

module.exports = { getBody, https: { get, post } }