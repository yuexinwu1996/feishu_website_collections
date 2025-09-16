class FeishuBookmarkExtension {
  constructor() {
    this.apiConfig = {
      proxyUrl: '',
      appId: '',
      appSecret: '',
      tableId: '',
      tenantAccessToken: ''
    };
    this.offlineQueue = [];
    this.init();
  }

  async init() {
    await this.loadConfig();
    this.setupContextMenu();
    this.setupMessageHandlers();
    this.setupAlarms();
    this.processOfflineQueue();
  }

  async loadConfig() {
    const result = await chrome.storage.sync.get([
      'proxyUrl', 'appId', 'appSecret', 'tableId', 'tenantAccessToken'
    ]);
    
    this.apiConfig = {
      proxyUrl: result.proxyUrl || '',
      appId: result.appId || '',
      appSecret: result.appSecret || '',
      tableId: result.tableId || '',
      tenantAccessToken: result.tenantAccessToken || ''
    };
  }

  setupContextMenu() {
    // 清理已存在的菜单，避免重复创建
    try { chrome.contextMenus.removeAll(); } catch (_) {}

    const items = [
      { id: 'savePage', title: '保存当前页面到飞书', contexts: ['page'] },
      { id: 'saveSelection', title: '保存选中文本为备注', contexts: ['selection'] },
      { id: 'saveLink', title: '保存此链接到飞书', contexts: ['link'] }
    ];

    items.forEach(item => chrome.contextMenus.create(item));

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      switch (info.menuItemId) {
        case 'savePage':
          this.saveCurrentPage(tab, '');
          break;
        case 'saveSelection':
          this.saveCurrentPage(tab, info.selectionText || '');
          break;
        case 'saveLink':
          this.saveLink(info, tab);
          break;
      }
    });
  }

  async saveLink(info, tab) {
    const url = info.linkUrl || tab?.url || '';
    const title = (info.selectionText && info.selectionText.trim()) || (tab?.title || '');
    const bookmarkData = {
      url: this.normalizeUrl(url),
      title,
      notes: `来自页面《${tab?.title || ''}》的链接`,
      tags: [],
      project: '',
      createdTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    try {
      const isDuplicate = await this.checkDuplicate(bookmarkData.url);
      if (isDuplicate) {
        this.showNotification('URL已存在', '该链接已经保存过了');
        return;
      }
      await this.saveToFeishu(bookmarkData);
      this.showNotification('保存成功', '链接已保存到飞书');
    } catch (error) {
      console.error('保存链接失败:', error);
      await this.addToOfflineQueue(bookmarkData);
      this.showNotification('暂时离线保存', '将在网络恢复后同步到飞书');
    }
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'saveBookmark':
          this.handleSaveBookmark(request.data, sendResponse);
          return true;
        case 'getConfig':
          sendResponse(this.apiConfig);
          return true;
        case 'updateConfig':
          this.updateConfig(request.config, sendResponse);
          return true;
        case 'getBookmarks':
          this.getBookmarks(request.params, sendResponse);
          return true;
        case 'deleteBookmark':
          this.deleteBookmark(request.recordId, sendResponse);
          return true;
      }
    });
  }

  setupAlarms() {
    chrome.alarms.create('processQueue', { periodInMinutes: 5 });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'processQueue') {
        this.processOfflineQueue();
      }
    });
  }

  async updateConfig(config, sendResponse) {
    try {
      await chrome.storage.sync.set(config);
      this.apiConfig = { ...this.apiConfig, ...config };
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async saveCurrentPage(tab, selectionText = '') {
    const bookmarkData = {
      url: this.normalizeUrl(tab.url),
      title: tab.title || '',
      notes: selectionText,
      tags: [],
      project: '',
      createdTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };

    try {
      const isDuplicate = await this.checkDuplicate(bookmarkData.url);
      if (isDuplicate) {
        this.showNotification('URL已存在', '该网页已经保存过了');
        return;
      }

      await this.saveToFeishu(bookmarkData);
      this.showNotification('保存成功', '网页已保存到飞书');
    } catch (error) {
      console.error('保存失败:', error);
      await this.addToOfflineQueue(bookmarkData);
      this.showNotification('暂时离线保存', '将在网络恢复后同步到飞书');
    }
  }

  async handleSaveBookmark(data, sendResponse) {
    console.log('[DEBUG] 开始保存书签:', data);
    const bookmarkData = {
      ...data,
      url: this.normalizeUrl(data.url),
      createdTime: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    
    try {
      console.log('[DEBUG] 处理后的书签数据:', bookmarkData);

      const isDuplicate = await this.checkDuplicate(bookmarkData.url);
      if (isDuplicate) {
        console.log('[DEBUG] 检测到重复URL:', bookmarkData.url);
        sendResponse({ success: false, error: 'URL已存在' });
        return;
      }

      console.log('[DEBUG] 开始调用飞书API保存');
      await this.saveToFeishu(bookmarkData);
      console.log('[DEBUG] 飞书API保存成功');
      sendResponse({ success: true });
    } catch (error) {
      console.error('[DEBUG] 保存失败:', error);
      await this.addToOfflineQueue(bookmarkData);
      console.log('[DEBUG] 已添加到离线队列');
      sendResponse({ success: true, offline: true });
    }
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // 移除 hash
      urlObj.hash = '';
      // 主机名小写，去掉默认端口
      urlObj.hostname = urlObj.hostname.toLowerCase();
      if ((urlObj.protocol === 'http:' && urlObj.port === '80') || (urlObj.protocol === 'https:' && urlObj.port === '443')) {
        urlObj.port = '';
      }

      // 过滤跟踪参数并按 key 排序
      const TRACK_PARAMS = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','yclid','spm','ref','ref_src']);
      const params = Array.from(urlObj.searchParams.entries())
        .filter(([k, v]) => v !== '' && !TRACK_PARAMS.has(k.toLowerCase()))
        .sort((a, b) => a[0].localeCompare(b[0]));

      urlObj.search = params.length ? '?' + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';

      // 去除结尾斜杠（保留根路径）
      let normalized = urlObj.toString();
      if (urlObj.pathname !== '/' ) {
        normalized = normalized.replace(/\/$/, '');
      }
      return normalized;
    } catch (error) {
      return url;
    }
  }

  async generateUrlHash(url) {
    // 使用 SHA-256，确保跨端一致性
    const data = new TextEncoder().encode(url);
    const digest = await crypto.subtle.digest('SHA-256', data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async checkDuplicate(url) {
    try {
      const response = await this.makeApiCall('POST', '/bitable/v1/apps/{appToken}/tables/{tableId}/records/search', {
        filter: {
          conjunction: 'and',
          conditions: [
            {
              field_name: '网页链接',
              operator: 'is',
              value: [url]
            }
          ]
        }
      });

      return response.data && response.data.items && response.data.items.length > 0;
    } catch (error) {
      console.error('检查重复URL失败:', error);
      return false;
    }
  }

  async saveToFeishu(bookmarkData) {
    let uploadedFiles = [];
    
    // 如果有附件，先上传文件
    if (bookmarkData.attachments && bookmarkData.attachments.length > 0) {
      try {
        uploadedFiles = await this.uploadFiles(bookmarkData.attachments);
      } catch (error) {
        console.warn('文件上传失败，将跳过附件:', error);
        // 文件上传失败不影响主记录的保存
      }
    }

    console.log('[DEBUG] 生成的字段数据:', {
      url: bookmarkData.url,
      title: bookmarkData.title,
      notes: bookmarkData.notes,
      tags: bookmarkData.tags,
      project: bookmarkData.project
    });

    const fields = {};
    
    // 只添加有值的字段
    if (bookmarkData.url) fields["网页链接"] = bookmarkData.url;
    if (bookmarkData.title) fields["网站标题"] = bookmarkData.title;
    if (bookmarkData.notes) fields["备注"] = bookmarkData.notes;
    if (bookmarkData.tags && bookmarkData.tags.length > 0) fields["分类标签"] = bookmarkData.tags;
    if (bookmarkData.project && bookmarkData.project.length > 0) {
      fields["关联项目"] = Array.isArray(bookmarkData.project) ? bookmarkData.project : [bookmarkData.project];
    }
    if (uploadedFiles && uploadedFiles.length > 0) fields["关联文件"] = uploadedFiles;
    if (bookmarkData.createdTime) fields["创建时间"] = bookmarkData.createdTime;
    if (bookmarkData.lastUpdated) fields["最后更新时间"] = bookmarkData.lastUpdated;

    const record = { fields };
    
    console.log('[DEBUG] 最终记录数据:', record);

    const response = await this.makeApiCall('POST', '/bitable/v1/apps/{appToken}/tables/{tableId}/records', {
      records: [record]
    });

    return response;
  }

  async uploadFiles(files) {
    if (!files || files.length === 0) return [];
    
    const uploadPromises = files.map(async (file) => {
      try {
        // 将File对象转换为base64或blob用于上传
        const formData = new FormData();
        formData.append('file', file);
        formData.append('file_name', file.name);
        
        // 调用飞书文件上传API
        const uploadResponse = await this.uploadSingleFile(formData);
        
        return {
          file_token: uploadResponse.data.file_token,
          name: file.name,
          size: file.size,
          type: file.type
        };
      } catch (error) {
        console.error(`文件 ${file.name} 上传失败:`, error);
        // 返回文件基本信息，但没有file_token
        return {
          name: file.name,
          size: file.size,
          type: file.type,
          upload_failed: true
        };
      }
    });
    
    return await Promise.all(uploadPromises);
  }

  async uploadSingleFile(formData) {
    const url = `${this.apiConfig.proxyUrl}/bitable/v1/apps/{appToken}/tables/{tableId}/records/upload_file`
      .replace('{appToken}', this.apiConfig.appId)
      .replace('{tableId}', this.apiConfig.tableId);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiConfig.tenantAccessToken}`
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      },
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`文件上传失败: ${response.status} ${errorText}`);
    }

    return await response.json();
  }

  async makeApiCall(method, endpoint, data = null) {
    if (!this.apiConfig.proxyUrl || !this.apiConfig.tenantAccessToken) {
      console.error('[DEBUG] API配置不完整:', {
        proxyUrl: !!this.apiConfig.proxyUrl,
        tenantAccessToken: !!this.apiConfig.tenantAccessToken,
        appId: !!this.apiConfig.appId,
        tableId: !!this.apiConfig.tableId
      });
      throw new Error('API配置不完整');
    }

    const url = `${this.apiConfig.proxyUrl}${endpoint}`
      .replace('{appToken}', this.apiConfig.appId)
      .replace('{tableId}', this.apiConfig.tableId);

    console.log('[DEBUG] API调用:', { method, url, data });

    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiConfig.tenantAccessToken}`,
        'Content-Type': 'application/json'
      }
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[DEBUG] API调用失败:', { status: response.status, errorText });
      throw new Error(`API调用失败: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('[DEBUG] API调用成功:', result);
    return result;
  }

  async addToOfflineQueue(bookmarkData) {
    const queueItem = {
      id: Date.now().toString(),
      data: bookmarkData,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.offlineQueue.push(queueItem);
    await chrome.storage.local.set({ offlineQueue: this.offlineQueue });
  }

  async processOfflineQueue() {
    const stored = await chrome.storage.local.get(['offlineQueue']);
    this.offlineQueue = stored.offlineQueue || [];

    if (this.offlineQueue.length === 0) return;

    const toProcess = [...this.offlineQueue];
    const successful = [];
    const failed = [];

    for (const item of toProcess) {
      try {
        await this.saveToFeishu(item.data);
        successful.push(item.id);
        console.log('离线数据同步成功:', item.data.title);
      } catch (error) {
        console.error('离线数据同步失败:', error);
        if (item.retryCount < 3) {
          item.retryCount++;
          failed.push(item);
        } else {
          console.log('放弃同步:', item.data.title);
        }
      }
    }

    this.offlineQueue = failed;
    await chrome.storage.local.set({ offlineQueue: this.offlineQueue });

    if (successful.length > 0) {
      this.showNotification('同步完成', `成功同步${successful.length}条离线数据`);
    }
  }

  async getBookmarks(params, sendResponse) {
    try {
      const { page = 1, pageSize = 20, search = '', tags = [] } = params;
      
      const conditions = [];
      if (search) {
        conditions.push({
          field_name: '网站标题',
          operator: 'contains',
          value: [search]
        });
      }
      
      if (tags && tags.length > 0) {
        conditions.push({
          field_name: '分类标签',
          operator: 'contains',
          value: tags
        });
      }

      const searchParams = {
        page_size: pageSize
      };

      if (page > 1) {
        searchParams.page_token = ((page - 1) * pageSize).toString();
      }

      if (conditions.length > 0) {
        searchParams.filter = { conjunction: 'and', conditions };
      }

      const response = await this.makeApiCall('POST', '/bitable/v1/apps/{appToken}/tables/{tableId}/records/search', searchParams);
      
      sendResponse({ success: true, data: response.data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  async deleteBookmark(recordId, sendResponse) {
    try {
      await this.makeApiCall('DELETE', `/bitable/v1/apps/{appToken}/tables/{tableId}/records/${recordId}`);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }

  showNotification(title, message) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message
    });
  }
}

const extension = new FeishuBookmarkExtension();
