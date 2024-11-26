/**
 * Utility functions module
 * Contains helper functions used throughout the application
 */
const utils = {
    /**
     * 格式化日期为API请求格式
     * @param {Date|string} date - 要格式化的日期
     * @returns {string} ISO格式的日期字符串
     */
    formatDate(date) {
        if (typeof date === 'string') {
            return new Date(date).toISOString();
        }
        return date.toISOString();
    },

    /**
     * 格式化日期为datetime-local输入格式
     * @param {Date} date - 要格式化的日期
     * @returns {string} 格式化的日期字符串
     */
    formatDateTimeLocal(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
    },

    /**
     * 通过ID获取元素，带错误处理
     * @param {string} id - 元素ID
     * @returns {HTMLElement} 找到的元素
     */
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.error(`Element not found: ${id}`);
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    },

    /**
     * 显示错误消息
     * @param {string} message - 错误消息
     * @param {number} [duration=5000] - 显示持续时间（毫秒）
     */
    showError(message, duration = 5000) {
        console.error('Error:', message);
        
        this.removeExistingError();

        const error = document.createElement('div');
        error.className = 'error-message fade-in';
        error.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠</span>
                <span class="error-text">${message}</span>
                <button class="error-close" title="Close">&times;</button>
            </div>
        `;

        document.body.appendChild(error);

        const closeButton = error.querySelector('.error-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.removeExistingError());
        }

        if (duration > 0) {
            setTimeout(() => {
                if (document.body.contains(error)) {
                    error.classList.add('fade-out');
                    setTimeout(() => this.removeExistingError(), 500);
                }
            }, duration);
        }
    },

    /**
     * 移除现有的错误消息
     */
    removeExistingError() {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
    },

    /**
     * 显示或隐藏加载指示器
     * @param {boolean} show - 是否显示
     * @param {string} [message='Loading...'] - 加载消息
     */
    showLoading(show, message = 'Loading...') {
        let loader = document.getElementById('loadingIndicator');
        
        if (!loader) {
            loader = document.createElement('div');
            loader.id = 'loadingIndicator';
            loader.className = 'loading-indicator';
            document.body.appendChild(loader);
        }

        if (show) {
            loader.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <div class="loading-message">${message}</div>
                </div>
            `;
            loader.classList.add('show');
        } else {
            loader.classList.remove('show');
        }
    },

    /**
     * 设置默认日期
     */
    setDefaultDates() {
        try {
            const now = new Date();
            const startTime = this.getElement('startTime');
            const endTime = this.getElement('endTime');
            
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            
            startTime.value = this.formatDateTimeLocal(yesterday);
            endTime.value = this.formatDateTimeLocal(now);

            // 设置最大值为当前时间
            endTime.max = this.formatDateTimeLocal(now);

            // 设置最小值为7天前
            const sevenDaysAgo = new Date(now);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            startTime.min = this.formatDateTimeLocal(sevenDaysAgo);
        } catch (error) {
            console.error('Error setting default dates:', error);
            this.showError('Failed to set default dates');
        }
    },

    /**
     * 验证时间范围
     * @param {Date} startTime - 开始时间
     * @param {Date} endTime - 结束时间
     * @param {number} [maxDays=7] - 最大天数
     * @returns {boolean} 是否有效
     */
    validateTimeRange(startTime, endTime, maxDays = 7) {
        const start = new Date(startTime);
        const end = new Date(endTime);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            this.showError('Invalid date format');
            return false;
        }

        if (start >= end) {
            this.showError('Start time must be before end time');
            return false;
        }

        const timeDiff = end - start;
        const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (dayDiff > maxDays) {
            this.showError(`Time range cannot exceed ${maxDays} days`);
            return false;
        }

        const now = new Date();
        if (end > now) {
            this.showError('End time cannot be in the future');
            return false;
        }

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        if (start < sevenDaysAgo) {
            this.showError('Start time cannot be more than 7 days ago');
            return false;
        }

        return true;
    },

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} wait - 等待时间（毫秒）
     * @returns {Function} 防抖处理后的函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * 格式化数字
     * @param {number} value - 要格式化的数字
     * @param {number} [decimals=1] - 小数位数
     * @returns {string} 格式化后的数字
     */
    formatNumber(value, decimals = 1) {
        if (!this.isValidNumber(value)) return '0';
        return Number(value).toFixed(decimals);
    },

    /**
     * 检查是否为有效数字
     * @param {any} value - 要检查的值
     * @returns {boolean} 是否为有效数字
     */
    isValidNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
    },

    /**
     * 生成唯一ID
     * @returns {string} 唯一ID
     */
    generateId() {
        return 'id_' + Math.random().toString(36).substr(2, 9);
    },

    /**
     * 格式化持续时间
     * @param {number} minutes - 分钟数
     * @returns {string} 格式化的持续时间
     */
    formatDuration(minutes) {
        if (minutes < 60) {
            return `${minutes} minutes`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours} hour${hours > 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} min` : ''}`;
    },

    /**
     * 显示提示消息
     * @param {string} message - 消息内容
     * @param {string} [type='info'] - 消息类型（'info', 'success', 'warning'）
     * @param {number} [duration=3000] - 显示持续时间
     */
    showMessage(message, type = 'info', duration = 3000) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message-toast ${type} fade-in`;
        messageDiv.textContent = message;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.classList.add('fade-out');
            setTimeout(() => messageDiv.remove(), 500);
        }, duration);
    },

    /**
     * 深度克隆对象
     * @param {Object} obj - 要克隆的对象
     * @returns {Object} 克隆后的对象
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            return Object.fromEntries(
                Object.entries(obj).map(([key, value]) => [key, this.deepClone(value)])
            );
        }
        return obj;
    }
};

export default utils;