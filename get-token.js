// 获取飞书访问令牌的脚本
// 使用方法：node get-token.js

const fetch = require('node-fetch');

async function getTenantAccessToken(appId, appSecret) {
  try {
    const response = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        app_id: appId,
        app_secret: appSecret
      })
    });

    const data = await response.json();
    
    if (data.code === 0) {
      console.log('✅ 获取token成功！');
      console.log('Token:', data.tenant_access_token);
      console.log('有效期:', data.expire + '秒');
      console.log('过期时间:', new Date(Date.now() + data.expire * 1000).toLocaleString());
      
      return data.tenant_access_token;
    } else {
      console.error('❌ 获取token失败:', data);
      return null;
    }
  } catch (error) {
    console.error('❌ 请求失败:', error.message);
    return null;
  }
}

// 使用示例
const APP_ID = 'cli_xxxxxxxxxx';     // 替换为您的App ID
const APP_SECRET = 'xxxxxxxxxx';     // 替换为您的App Secret

if (APP_ID.startsWith('cli_') && APP_SECRET.length > 10) {
  getTenantAccessToken(APP_ID, APP_SECRET);
} else {
  console.log('请先配置正确的APP_ID和APP_SECRET');
  console.log('修改本文件第29-30行，填入您的应用凭证');
}

// 或者使用curl命令：
console.log('\n也可以使用curl命令获取：');
console.log(`curl -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \\
-H "Content-Type: application/json" \\
-d '{
  "app_id": "${APP_ID}",
  "app_secret": "${APP_SECRET}"
}'`);

// 注意：
// 1. tenant_access_token 有效期为2小时
// 2. 在生产环境中，建议实现自动刷新机制
// 3. 请妥善保管应用凭证，不要泄露