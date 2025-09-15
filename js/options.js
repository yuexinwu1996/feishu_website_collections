class OptionsManager {
    constructor() {
        this.config = {
            proxyUrl: '',
            appId: '',
            appSecret: '',
            tableId: '',
            tenantAccessToken: ''
        };
        this.init();
    }

    async init() {
        await this.loadConfig();
        this.setupEventListeners();
        this.populateForm();
    }

    async loadConfig() {
        try {
            const result = await chrome.storage.sync.get([
                'proxyUrl', 'appId', 'appSecret', 'tableId', 'tenantAccessToken'
            ]);
            
            this.config = {
                proxyUrl: result.proxyUrl || '',
                appId: result.appId || '',
                appSecret: result.appSecret || '',
                tableId: result.tableId || '',
                tenantAccessToken: result.tenantAccessToken || ''
            };
        } catch (error) {
            console.error('加载配置失败:', error);
            this.showStatus('加载配置失败', 'error');
        }
    }

    populateForm() {
        document.getElementById('proxyUrl').value = this.config.proxyUrl;
        document.getElementById('appId').value = this.config.appId;
        document.getElementById('appSecret').value = this.config.appSecret;
        document.getElementById('tableId').value = this.config.tableId;
        document.getElementById('tenantAccessToken').value = this.config.tenantAccessToken;
    }

    setupEventListeners() {
        document.getElementById('saveConfigBtn').addEventListener('click', () => {
            this.saveConfig();
        });

        document.getElementById('testConnectionBtn').addEventListener('click', () => {
            this.testConnection();
        });

        document.getElementById('resetConfigBtn').addEventListener('click', () => {
            this.resetConfig();
        });

        document.getElementById('exportConfigBtn').addEventListener('click', () => {
            this.exportConfig();
        });

        document.getElementById('importConfigBtn').addEventListener('click', () => {
            this.importConfig();
        });

        document.getElementById('importFileInput').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });

        const formInputs = document.querySelectorAll('.form-input');
        formInputs.forEach(input => {
            input.addEventListener('input', () => {
                this.validateInput(input);
            });

            input.addEventListener('blur', () => {
                this.validateInput(input);
            });
        });

        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                this.saveConfig();
            }
        });
    }

    validateInput(input) {
        const value = input.value.trim();
        let isValid = true;
        
        switch (input.id) {
            case 'proxyUrl':
                isValid = !value || this.isValidUrl(value);
                break;
            case 'appId':
                isValid = !value || /^cli_[a-z0-9]+$/i.test(value);
                break;
            case 'appSecret':
                isValid = !value || value.length >= 16;
                break;
            case 'tableId':
                isValid = !value || /^tbl[a-z0-9]+$/i.test(value);
                break;
            case 'tenantAccessToken':
                isValid = !value || /^t-[a-z0-9]+$/i.test(value);
                break;
        }
        
        if (isValid) {
            input.style.borderColor = '#e9ecef';
        } else {
            input.style.borderColor = '#dc3545';
        }
        
        return isValid;
    }

    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    async saveConfig() {
        const saveBtn = document.getElementById('saveConfigBtn');
        this.setButtonLoading(saveBtn, true);

        try {
            const formData = this.getFormData();
            
            if (!this.validateFormData(formData)) {
                this.showStatus('请填写所有必填项并检查格式是否正确', 'error');
                return;
            }

            await chrome.storage.sync.set(formData);
            this.config = { ...formData };
            
            await this.sendMessage('updateConfig', formData);
            
            this.showStatus('配置保存成功！', 'success');
        } catch (error) {
            console.error('保存配置失败:', error);
            this.showStatus('保存配置失败: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    getFormData() {
        return {
            proxyUrl: document.getElementById('proxyUrl').value.trim(),
            appId: document.getElementById('appId').value.trim(),
            appSecret: document.getElementById('appSecret').value.trim(),
            tableId: document.getElementById('tableId').value.trim(),
            tenantAccessToken: document.getElementById('tenantAccessToken').value.trim()
        };
    }

    validateFormData(data) {
        const required = ['proxyUrl', 'appId', 'appSecret', 'tableId', 'tenantAccessToken'];
        
        for (const field of required) {
            if (!data[field]) {
                document.getElementById(field).focus();
                return false;
            }
        }

        if (!this.isValidUrl(data.proxyUrl)) {
            document.getElementById('proxyUrl').focus();
            return false;
        }

        if (!data.appId.startsWith('cli_')) {
            document.getElementById('appId').focus();
            return false;
        }

        if (!data.tableId.startsWith('tbl')) {
            document.getElementById('tableId').focus();
            return false;
        }

        if (!data.tenantAccessToken.startsWith('t-')) {
            document.getElementById('tenantAccessToken').focus();
            return false;
        }

        return true;
    }

    async testConnection() {
        const testBtn = document.getElementById('testConnectionBtn');
        this.setButtonLoading(testBtn, true);

        try {
            const formData = this.getFormData();
            
            if (!this.validateFormData(formData)) {
                this.showStatus('请先完成配置填写', 'warning');
                return;
            }

            const result = await this.testApiConnection(formData);
            
            if (result.success) {
                this.showStatus('连接测试成功！API配置正确', 'success');
            } else {
                this.showStatus('连接测试失败: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('连接测试失败:', error);
            this.showStatus('连接测试失败: ' + error.message, 'error');
        } finally {
            this.setButtonLoading(testBtn, false);
        }
    }

    async testApiConnection(config) {
        try {
            const url = `${config.proxyUrl.replace(/\/+$/, '')}/bitable/v1/apps/${config.appId}/tables/${config.tableId}/fields`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${config.tenantAccessToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            
            if (data.code === 0) {
                return { success: true, data };
            } else {
                return { success: false, error: data.msg || '未知错误' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async resetConfig() {
        if (!confirm('确定要重置所有配置吗？此操作不可撤销。')) {
            return;
        }

        try {
            const emptyConfig = {
                proxyUrl: '',
                appId: '',
                appSecret: '',
                tableId: '',
                tenantAccessToken: ''
            };

            await chrome.storage.sync.set(emptyConfig);
            this.config = { ...emptyConfig };
            this.populateForm();
            
            await this.sendMessage('updateConfig', emptyConfig);
            
            this.showStatus('配置已重置', 'info');
        } catch (error) {
            console.error('重置配置失败:', error);
            this.showStatus('重置配置失败: ' + error.message, 'error');
        }
    }

    exportConfig() {
        try {
            const configToExport = { ...this.config };
            
            configToExport.appSecret = configToExport.appSecret ? '********' : '';
            configToExport.tenantAccessToken = configToExport.tenantAccessToken ? '********' : '';
            
            const dataStr = JSON.stringify(configToExport, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `feishu-extension-config-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showStatus('配置已导出（敏感信息已脱敏）', 'success');
        } catch (error) {
            console.error('导出配置失败:', error);
            this.showStatus('导出配置失败: ' + error.message, 'error');
        }
    }

    importConfig() {
        document.getElementById('importFileInput').click();
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedConfig = JSON.parse(text);
            
            const validKeys = ['proxyUrl', 'appId', 'appSecret', 'tableId', 'tenantAccessToken'];
            const filteredConfig = {};
            
            validKeys.forEach(key => {
                if (importedConfig[key] && importedConfig[key] !== '********') {
                    filteredConfig[key] = importedConfig[key];
                }
            });
            
            if (Object.keys(filteredConfig).length === 0) {
                this.showStatus('导入文件中没有找到有效的配置', 'warning');
                return;
            }
            
            const confirmMessage = `将导入以下配置项：\n${Object.keys(filteredConfig).join(', ')}\n\n确定要继续吗？`;
            if (!confirm(confirmMessage)) {
                return;
            }
            
            this.config = { ...this.config, ...filteredConfig };
            this.populateForm();
            
            this.showStatus('配置导入成功，请检查后保存', 'success');
        } catch (error) {
            console.error('导入配置失败:', error);
            this.showStatus('导入配置失败: ' + error.message, 'error');
        } finally {
            event.target.value = '';
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    showStatus(message, type = 'info') {
        const statusInfo = document.getElementById('statusInfo');
        const statusText = document.getElementById('statusText');
        
        statusText.textContent = message;
        statusInfo.className = `status-info ${type}`;
        statusInfo.style.display = 'block';
        
        statusInfo.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        setTimeout(() => {
            statusInfo.style.display = 'none';
        }, 5000);
    }

    sendMessage(action, data) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, config: data }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new OptionsManager();
});