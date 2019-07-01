const fs = require('fs')
const express = require('express')
const app = express()
const https = require('https')

app.post('/cgi-bin/component/api_component_token', (req, res) => {
    res.send({
        "component_access_token":"61W3mEpU66027wgNZ_MhGHNQDHnFATkDa9-2llqrMBjUwxRSNPbVsMmyD-yq8wZETSoE5NQgecigDrSHkPtIYA", 
        "expires_in":7200
    })
})

app.post('/cgi-bin/component/api_create_preauthcode', (req, res) => {
    res.send({
        "pre_auth_code":"Cx_Dk6qiBE0Dmx4EmlT3oRfArPvwSQ-oa3NL_fwHM7VI08r52wazoZX2Rhpz1dEw",
        "expires_in":600
    })
})

app.post('/cgi-bin/component/api_query_auth', (req, res) => {
    res.send({ 
        "authorization_info": {
        "authorizer_appid": "wxf8b4f85f3a794e77", 
        "authorizer_access_token": "QXjUqNqfYVH0yBE1iI_7vuN_9gQbpjfK7hYwJ3P7xOa88a89-Aga5x1NMYJyB8G2yKt1KCl0nPC3W9GJzw0Zzq_dBxc8pxIGUNi_bFes0qM", 
        "expires_in": 7200, 
        "authorizer_refresh_token": "dTo-YCXPL4llX-u1W1pPpnp8Hgm4wpJtlR6iV0doKdY", 
        "func_info": [
        {
        "funcscope_category": {
        "id": 1
        }
        }, 
        {
        "funcscope_category": {
        "id": 2
        }
        }, 
        {
        "funcscope_category": {
        "id": 3
        }
        }
        ]
        }})
})

https.createServer({
    key: fs.readFileSync(__dirname + '/privatekey.pem'),
    cert: fs.readFileSync(__dirname + '/certificate.pem')
}, app).listen(443)