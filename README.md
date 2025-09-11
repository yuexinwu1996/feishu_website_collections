# 🚀 飞书网页收藏助手

一个强大的Chrome扩展，让您可以一键保存网页到飞书多维表格，支持标签、备注、项目分类和附件管理。

## ✨ 核心功能

- **一键保存**：点击扩展图标即可快速保存当前网页
- **智能去重**：自动检测并防止重复保存相同URL
- **标签管理**：支持多标签分类，便于组织和检索
- **项目分组**：将收藏按项目进行分类管理
- **备注支持**：可添加个人备注和页面摘要
- **离线队列**：网络断开时自动缓存，恢复后批量同步
- **右键菜单**：在任意页面右键快速保存
- **URL规范化**：自动清理URL中的无关参数
- **批量操作**：支持批量标记、删除和导出

## 🏗️ 系统架构

```
Chrome扩展 (前端)
    ↓ API调用
后端代理服务器
    ↓ 转发请求  
飞书开放平台API
    ↓ 数据存储
飞书多维表格
```

### 核心组件

- **background.js**：后台服务工作者，处理API调用和数据管理
- **popup.html/js**：用户界面，提供快速保存和详细设置
- **options.html/js**：配置页面，管理API设置和扩展选项

## 📋 安装配置步骤

### 第1步：创建飞书应用

1. 访问 [飞书开发者后台](https://open.feishu.cn/app)
2. 创建自建应用，记录 `App ID` 和 `App Secret`
3. 在应用权限中添加以下权限：
   - `bitable:app`
   - `bitable:app:readonly`

### 第2步：获取访问令牌

使用以下API获取 `tenant_access_token`：

```bash
curl -X POST "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal" \
-H "Content-Type: application/json" \
-d '{
  "app_id": "your_app_id",
  "app_secret": "your_app_secret"
}'
```

### 第3步：创建多维表格

创建飞书多维表格，包含以下字段：

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `url` | 单行文本 | 网页地址 |
| `title` | 单行文本 | 页面标题 |
| `notes` | 多行文本 | 备注信息 |
| `tags` | 多选 | 标签分类 |
| `project` | 单选 | 项目分组 |
| `created_time` | 日期时间 | 创建时间 |
| `last_updated` | 日期时间 | 最后更新 |
| `url_hash` | 单行文本 | URL哈希（用于去重） |

### 第4步：设置代理服务器

配置支持CORS的代理服务器，示例代码：

```javascript
// Node.js + Express 示例
app.use('/bitable/*', async (req, res) => {
  const feishuUrl = `https://open.feishu.cn/open-apis${req.path}`;
  
  const response = await fetch(feishuUrl, {
    method: req.method,
    headers: {
      'Authorization': req.headers.authorization,
      'Content-Type': 'application/json'
    },
    body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
  });
  
  const data = await response.json();
  res.json(data);
});
```

### 第5步：安装扩展

1. 下载或克隆此项目
2. 打开Chrome浏览器，访问 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目文件夹

### 第6步：配置扩展

1. 点击扩展图标，选择"扩展设置"
2. 填写以下配置信息：
   - **代理服务器地址**：如 `https://your-proxy-domain.com/`
   - **应用ID**：飞书应用的App ID
   - **应用密钥**：飞书应用的App Secret
   - **多维表格ID**：从表格URL中获取的tableId
   - **租户访问令牌**：API获取的token
3. 点击"测试连接"验证配置
4. 保存配置

## 🚀 使用方法

### 快速保存
- 点击浏览器工具栏中的扩展图标
- 在弹出窗口中点击"快速保存"

### 详细保存
- 点击扩展图标后选择"详细设置"
- 编辑标题、添加备注、设置标签和项目
- 点击"保存"

### 右键菜单
- 在任意页面右键选择"保存到飞书"
- 支持保存选中文本作为备注

### 快捷键
- `Ctrl + S`：快速保存当前页面

## 🔧 高级功能

### 离线队列
网络断开时，扩展会将数据保存到本地队列：
- 自动检测网络状态
- 恢复连接后批量同步
- 失败重试机制（最多3次）

### URL规范化
自动清理URL中的无关参数：
- 移除fragment（#后的内容）
- 规范化query参数
- 生成唯一哈希用于去重

### 数据去重
防止重复保存相同页面：
- 基于URL哈希进行去重检查
- 智能识别相同页面的不同URL变体

### 错误处理
完善的错误处理机制：
- API调用失败自动重试
- 详细的错误信息提示
- 网络问题时自动降级到离线模式

## 🔒 权限说明

扩展需要以下权限：

| 权限 | 用途 |
|------|------|
| `storage` | 存储配置信息和离线数据 |
| `tabs` | 获取当前标签页信息 |
| `scripting` | 注入内容脚本 |
| `contextMenus` | 添加右键菜单选项 |
| `notifications` | 显示保存状态通知 |
| `alarms` | 定时处理离线队列 |
| `activeTab` | 访问当前活动标签页 |

## 🛠️ 开发调试

### 本地调试
```bash
# 打包扩展
npm run build

# 在Chrome中加载扩展
# 1. 访问 chrome://extensions/
# 2. 开启开发者模式
# 3. 加载已解压的扩展程序
```

### 调试工具
- 使用Chrome DevTools调试popup和options页面
- 在 `chrome://extensions/` 中查看background script日志
- 使用 `chrome://storage-internals/` 检查存储数据

### 单元测试
```bash
# 运行测试（如果已配置）
npm test

# 验证URL规范化
npm run test:url-normalization

# 测试API连接
npm run test:api-connection
```

## 📝 常见问题

### Q: 提示"API配置不完整"怎么办？
A: 请检查扩展设置中的所有配置项是否已正确填写，特别是token是否已过期。

### Q: 保存失败怎么办？
A: 
1. 检查网络连接
2. 验证代理服务器是否正常运行
3. 确认飞书应用权限是否正确设置
4. 查看多维表格字段是否匹配

### Q: 如何批量导入现有书签？
A: 可以通过飞书多维表格的导入功能，将现有书签数据批量导入到表格中。

### Q: 扩展会收集我的个人数据吗？
A: 不会。所有数据都存储在您自己的飞书表格中，扩展不会向第三方发送任何数据。

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目！

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🔗 相关链接

- [飞书开放平台文档](https://open.feishu.cn/document/)
- [Chrome扩展开发文档](https://developer.chrome.com/docs/extensions/)
- [多维表格API文档](https://open.feishu.cn/document/ukTMukTMukTM/uUDN04SN0QjL1QDN/table-overview)

---

**享受高效的网页收藏体验！** 🎉