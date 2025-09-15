// 获取飞书访问令牌的脚本
// 使用方法：node get-token.js your_app_id your_app_secret

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

// 从命令行参数获取凭证
const args = process.argv.slice(2);
const APP_ID = args[0];
const APP_SECRET = args[1];

if (APP_ID && APP_SECRET) {
  console.log('🔄 正在获取租户访问令牌...');
  getTenantAccessToken(APP_ID, APP_SECRET);
} else {
  console.log('❌ 请提供App ID和App Secret');
  console.log('使用方法: node get-token.js <app_id> <app_secret>');
  console.log('');
  console.log('示例: node get-token.js cli_a1234567890abcdef your_app_secret');
  console.log('');
  console.log('💡 提示:');
  console.log('1. 访问 https://open.feishu.cn/app 创建应用');
  console.log('2. 在应用详情页获取 App ID 和 App Secret');
  console.log('3. 确保应用已添加 bitable:app 权限');
}

// 导出函数供其他模块使用
module.exports = { getTenantAccessToken };

// 注意：
// 1. tenant_access_token 有效期为2小时
// 2. 在生产环境中，建议实现自动刷新机制
// 3. 请妥善保管应用凭证，不要泄露