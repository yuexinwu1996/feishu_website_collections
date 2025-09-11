class PopupManager {
    constructor() {
        this.currentTab = null;
        this.tags = new Set();
        this.projects = new Set();
        this.attachments = [];
        this.isDetailedFormVisible = false;
        this.init();
    }

    async init() {
        await this.loadCurrentTab();
        this.setupEventListeners();
        this.loadRecentSaves();
    }

    async loadCurrentTab() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tab;
            
            document.getElementById('pageTitle').textContent = tab.title || '未知页面';
            document.getElementById('pageUrl').textContent = tab.url || '';
            document.getElementById('titleInput').value = tab.title || '';
        } catch (error) {
            console.error('获取当前标签页失败:', error);
            this.showStatus('获取页面信息失败', 'error');
        }
    }

    setupEventListeners() {
        document.getElementById('quickSaveBtn').addEventListener('click', () => {
            this.handleQuickSave();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            this.handleDetailedSave();
        });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.hideDetailedForm();
        });

        document.getElementById('toggleFormBtn').addEventListener('click', () => {
            this.toggleDetailedForm();
        });

        document.getElementById('openOptionsBtn').addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
            window.close();
        });

        document.getElementById('tagsInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                this.addTag();
            }
        });

        document.getElementById('tagsInput').addEventListener('blur', () => {
            this.addTag();
        });

        // 项目管理事件
        document.getElementById('projectInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                this.addProject();
            }
        });

        document.getElementById('projectInput').addEventListener('blur', () => {
            this.addProject();
        });

        // 文件上传事件
        document.getElementById('attachmentInput').addEventListener('change', (e) => {
            this.handleFileUpload(e);
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.isDetailedFormVisible) {
                    this.hideDetailedForm();
                } else {
                    window.close();
                }
            }
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                if (this.isDetailedFormVisible) {
                    this.handleDetailedSave();
                } else {
                    this.handleQuickSave();
                }
            }
        });
    }

    async handleQuickSave() {
        if (!this.currentTab) {
            this.showStatus('无法获取当前页面信息', 'error');
            return;
        }

        const saveBtn = document.getElementById('quickSaveBtn');
        this.setButtonLoading(saveBtn, true);

        try {
            // 读取页面选中文本，作为备注的默认值
            const selection = await this.getPageSelection();
            const bookmarkData = {
                url: this.currentTab.url,
                title: this.currentTab.title || '',
                notes: selection || '',
                tags: [],
                project: [],
                attachments: []
            };

            const result = await this.sendMessage('saveBookmark', bookmarkData);
            
            if (result.success) {
                if (result.offline) {
                    this.showStatus('暂时离线保存，将在网络恢复后同步', 'warning');
                } else {
                    this.showStatus('保存成功！', 'success');
                }
                setTimeout(() => {
                    window.close();
                }, 1500);
            } else {
                this.showStatus(result.error || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存失败:', error);
            this.showStatus('保存失败，请检查网络连接', 'error');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    async handleDetailedSave() {
        if (!this.currentTab) {
            this.showStatus('无法获取当前页面信息', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveBtn');
        this.setButtonLoading(saveBtn, true);

        try {
            const bookmarkData = {
                url: this.currentTab.url,
                title: document.getElementById('titleInput').value.trim() || this.currentTab.title,
                notes: document.getElementById('notesInput').value.trim(),
                tags: Array.from(this.tags),
                project: Array.from(this.projects || new Set()),
                attachments: this.attachments || []
            };

            if (!bookmarkData.title) {
                this.showStatus('请输入页面标题', 'error');
                return;
            }

            const result = await this.sendMessage('saveBookmark', bookmarkData);
            
            if (result.success) {
                if (result.offline) {
                    this.showStatus('暂时离线保存，将在网络恢复后同步', 'warning');
                } else {
                    this.showStatus('保存成功！', 'success');
                }
                setTimeout(() => {
                    window.close();
                }, 1500);
            } else {
                this.showStatus(result.error || '保存失败', 'error');
            }
        } catch (error) {
            console.error('保存失败:', error);
            this.showStatus('保存失败，请检查网络连接', 'error');
        } finally {
            this.setButtonLoading(saveBtn, false);
        }
    }

    toggleDetailedForm() {
        if (this.isDetailedFormVisible) {
            this.hideDetailedForm();
        } else {
            this.showDetailedForm();
        }
    }

    showDetailedForm() {
        document.getElementById('detailedForm').style.display = 'block';
        document.getElementById('toggleFormBtn').textContent = '简单模式';
        this.isDetailedFormVisible = true;
        
        document.getElementById('titleInput').focus();
        // 从页面读取选中文本，自动填充备注
        this.getPageSelection().then(text => {
            if (text) {
                document.getElementById('notesInput').value = text;
            }
        }).catch(() => {});
    }

    hideDetailedForm() {
        document.getElementById('detailedForm').style.display = 'none';
        document.getElementById('toggleFormBtn').textContent = '详细设置';
        this.isDetailedFormVisible = false;
        this.clearForm();
    }

    clearForm() {
        document.getElementById('notesInput').value = '';
        document.getElementById('tagsInput').value = '';
        document.getElementById('projectInput').value = '';
        this.tags.clear();
        this.projects.clear();
        this.attachments = [];
        this.updateTagsDisplay();
        this.updateProjectsDisplay();
        this.updateAttachmentsDisplay();
    }

    addTag() {
        const input = document.getElementById('tagsInput');
        const tagText = input.value.trim().replace(/,$/, '');
        
        if (tagText && !this.tags.has(tagText)) {
            this.tags.add(tagText);
            this.updateTagsDisplay();
            input.value = '';
        }
    }

    removeTag(tag) {
        this.tags.delete(tag);
        this.updateTagsDisplay();
    }

    updateTagsDisplay() {
        const container = document.getElementById('tagsContainer');
        container.innerHTML = '';
        
        this.tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'tag';
            tagElement.innerHTML = `
                ${this.escapeHtml(tag)}
                <span class="tag-remove" data-tag="${this.escapeHtml(tag)}">×</span>
            `;
            
            tagElement.querySelector('.tag-remove').addEventListener('click', (e) => {
                this.removeTag(e.target.dataset.tag);
            });
            
            container.appendChild(tagElement);
        });
    }

    addProject() {
        const input = document.getElementById('projectInput');
        const projectText = input.value.trim().replace(/,$/, '');
        
        if (projectText && !this.projects.has(projectText)) {
            this.projects.add(projectText);
            this.updateProjectsDisplay();
            input.value = '';
        }
    }

    removeProject(project) {
        this.projects.delete(project);
        this.updateProjectsDisplay();
    }

    updateProjectsDisplay() {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = '';
        
        this.projects.forEach(project => {
            const projectElement = document.createElement('span');
            projectElement.className = 'tag';
            projectElement.innerHTML = `
                ${this.escapeHtml(project)}
                <span class="tag-remove" data-project="${this.escapeHtml(project)}">×</span>
            `;
            
            projectElement.querySelector('.tag-remove').addEventListener('click', (e) => {
                this.removeProject(e.target.dataset.project);
            });
            
            container.appendChild(projectElement);
        });
    }

    handleFileUpload(event) {
        const files = Array.from(event.target.files);
        
        files.forEach(file => {
            // 文件大小限制为10MB
            if (file.size > 10 * 1024 * 1024) {
                this.showStatus(`文件 ${file.name} 超过10MB限制`, 'error');
                return;
            }
            
            // 检查是否已经添加过相同文件
            const existingFile = this.attachments.find(att => att.name === file.name && att.size === file.size);
            if (!existingFile) {
                this.attachments.push(file);
            }
        });
        
        this.updateAttachmentsDisplay();
        // 清空input，允许重复选择相同文件
        event.target.value = '';
    }

    removeAttachment(index) {
        this.attachments.splice(index, 1);
        this.updateAttachmentsDisplay();
    }

    updateAttachmentsDisplay() {
        const container = document.getElementById('attachmentsContainer');
        container.innerHTML = '';
        
        this.attachments.forEach((file, index) => {
            const fileElement = document.createElement('div');
            fileElement.className = 'attachment-item';
            
            const fileSize = (file.size / 1024).toFixed(1) + 'KB';
            
            fileElement.innerHTML = `
                <span class="attachment-name">${this.escapeHtml(file.name)}</span>
                <span class="attachment-size">(${fileSize})</span>
                <span class="attachment-remove" data-index="${index}">×</span>
            `;
            
            fileElement.querySelector('.attachment-remove').addEventListener('click', (e) => {
                this.removeAttachment(parseInt(e.target.dataset.index));
            });
            
            container.appendChild(fileElement);
        });
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
        
        setTimeout(() => {
            statusInfo.style.display = 'none';
        }, 5000);
    }

    async loadRecentSaves() {
        try {
            const result = await this.sendMessage('getBookmarks', { page: 1, pageSize: 5 });
            
            if (result.success && result.data?.items?.length > 0) {
                this.displayRecentSaves(result.data.items);
            }
        } catch (error) {
            console.error('获取最近保存失败:', error);
        }
    }

    displayRecentSaves(items) {
        const recentSaves = document.getElementById('recentSaves');
        const recentList = document.getElementById('recentList');
        
        recentList.innerHTML = '';
        
        items.forEach(item => {
            const recentItem = document.createElement('div');
            recentItem.className = 'recent-item';
            
            const createdTime = new Date(item.fields.创建时间).toLocaleDateString('zh-CN', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            recentItem.innerHTML = `
                <div class="title">${this.escapeHtml(item.fields.网站标题 || '未知标题')}</div>
                <div class="time">${createdTime}</div>
            `;
            
            recentItem.addEventListener('click', () => {
                chrome.tabs.create({ url: item.fields.网页链接 });
                window.close();
            });
            
            recentList.appendChild(recentItem);
        });
        
        recentSaves.style.display = 'block';
    }

    sendMessage(action, data = null) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ action, data }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async getPageSelection() {
        try {
            if (!this.currentTab?.id) return '';
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: this.currentTab.id },
                func: () => (window.getSelection ? window.getSelection().toString() : '')
            });
            const text = (result && result.result) ? String(result.result) : '';
            // 限制长度，避免超长备注
            return text.length > 1000 ? text.slice(0, 1000) : text;
        } catch (e) {
            return '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
