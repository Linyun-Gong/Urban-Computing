/**
 * Utility functions module
 * Contains helper functions used throughout the application
 */
const utils = {
    /**
     * Formats a date object to ISO string format
     * @param {Date} date - Date object to format
     * @returns {string} Formatted date string
     */
    formatDate(date) {
        return date.toISOString();
    },

    /**
     * Shows an error message to the user
     * @param {string} message - Error message to display
     * @param {number} [duration] - Duration in ms to show the error (optional)
     */
    showError(message, duration = 0) {
        const container = document.querySelector('.container');
        const existingError = container.querySelector('.error');
        
        if (existingError) {
            existingError.remove();
        }
        
        const error = document.createElement('div');
        error.className = 'error';
        error.textContent = message;
        container.appendChild(error);

        // Add shake animation
        error.style.animation = 'shake 0.5s';

        if (duration > 0) {
            setTimeout(() => {
                error.style.animation = 'fadeOut 0.5s';
                setTimeout(() => error.remove(), 500);
            }, duration);
        }
    },

    /**
     * Shows or hides the loading indicator
     * @param {boolean} show - Whether to show or hide the loading indicator
     */
    showLoading(show) {
        const loadingElement = document.getElementById('loadingIndicator');
        if (loadingElement) {
            loadingElement.style.display = show ? 'block' : 'none';
            if (show) {
                loadingElement.textContent = 'Loading data...';
            }
        }
    },

    /**
     * Gets an element by ID with error handling
     * @param {string} id - Element ID
     * @returns {HTMLElement} The found element
     * @throws {Error} If element is not found
     */
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    },

    /**
     * Sets default dates for the date inputs
     */
    setDefaultDates() {
        const now = new Date();
        const startTime = this.getElement('startTime');
        const endTime = this.getElement('endTime');
        
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        startTime.value = this.formatDateTimeLocal(yesterday);
        endTime.value = this.formatDateTimeLocal(now);
    },

    /**
     * Formats a date for datetime-local input
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string
     */
    formatDateTimeLocal(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
    },

    /**
     * Debounces a function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
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
     * Validates time range
     * @param {Date} startTime - Start time
     * @param {Date} endTime - End time
     * @returns {boolean} Whether the time range is valid
     */
    validateTimeRange(startTime, endTime) {
        if (startTime >= endTime) {
            this.showError('Start time must be before end time');
            return false;
        }

        const timeDiff = endTime - startTime;
        const maxDiff = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        if (timeDiff > maxDiff) {
            this.showError('Time range cannot exceed 7 days');
            return false;
        }

        return true;
    },

    formatDate(date) {
        if (typeof date === 'string') {
            // 如果是字符串格式，确保转换为正确的 ISO 格式
            return new Date(date).toISOString();
        }
        // 如果是 Date 对象，直接转换为 ISO 格式
        return date.toISOString();
    }
    
};

export default utils;