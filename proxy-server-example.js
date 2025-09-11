// Node.js + Express 代理服务器示例
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用CORS
app.use(cors({
  origin: ['chrome-extension://*', 'https://open.feishu.cn'],
  credentials: true
}));

app.use(express.json());

// 飞书API代理路由
app.use('/bitable/*', async (req, res) => {
  try {
    const feishuUrl = `https://open.feishu.cn/open-apis${req.path}`;
    
    const options = {
      method: req.method,
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json',
        'User-Agent': 'Feishu-Chrome-Extension/1.0'
      }
    };

    if (req.method === 'POST' || req.method === 'PUT') {
      options.body = JSON.stringify(req.body);
    }

    console.log(`代理请求: ${req.method} ${feishuUrl}`);
    
    const response = await fetch(feishuUrl, options);
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('代理请求失败:', error);
    res.status(500).json({ 
      code: 500, 
      msg: '代理服务器错误: ' + error.message 
    });
  }
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`代理服务器运行在端口 ${PORT}`);
});

// 部署到云平台的示例配置
// 1. Vercel: vercel.json
/*
{
  "version": 2,
  "builds": [{ "src": "proxy-server.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/proxy-server.js" }]
}
*/

// 2. Railway: 直接推送到 Railway
// 3. Heroku: 添加 Procfile
/*
web: node proxy-server.js
*/