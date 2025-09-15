// Node.js + Express 代理服务器示例
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// 启用CORS
app.use(cors({
  origin: true,  // 允许所有源，包括Chrome扩展
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

app.use(express.json());

// 飞书API代理路由
app.use('/bitable', async (req, res) => {
  try {
    // 移除/bitable前缀，构建正确的API URL
    const apiPath = req.path.startsWith('/bitable') ? req.path : `/bitable${req.path}`;
    const feishuUrl = `https://open.feishu.cn/open-apis${apiPath}`;
    
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

// 根路径处理
app.get('/', (req, res) => {
  res.json({ 
    name: '飞书网页收藏助手代理服务器',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      proxy: '/bitable/*'
    },
    timestamp: new Date().toISOString()
  });
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