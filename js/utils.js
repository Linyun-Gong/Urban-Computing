// js/utils.js

/**
 * Utility functions module
 * Contains helper functions used throughout the application
 */
const utils = {
    /**
     * Formats a date for API requests
     * @param {Date|string} date - Date to format
     * @returns {string} Formatted date string in ISO format
     */
    formatDate(date) {
        if (typeof date === 'string') {
            return new Date(date).toISOString();
        }
        return date.toISOString();
    },

    /**
     * Formats a date for datetime-local input
     * @param {Date} date - Date to format
     * @returns {string} Formatted date string for datetime-local input
     */
    formatDateTimeLocal(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
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
            console.error(`Element not found: ${id}`);
            throw new Error(`Element with id '${id}' not found`);
        }
        return element;
    },

    /**
     * Shows an error message to the user
     * @param {string} message - Error message to display
     * @param {number} [duration=5000] - Duration in ms to show the error
     */
    showError(message, duration = 5000) {
        console.error('Error:', message);
        
        // Remove existing error if present
        this.removeExistingError();

        // Create and show new error
        const error = document.createElement('div');
        error.className = 'error-message';
        error.innerHTML = `
            <div class="error-content">
                <span class="error-text">${message}</span>
                <button class="error-close">&times;</button>
            </div>
        `;

        // Add to document
        document.body.appendChild(error);

        // Add close button handler
        const closeButton = error.querySelector('.error-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.removeExistingError());
        }

        // Auto remove after duration if specified
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
     * Removes existing error message
     */
    removeExistingError() {
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }
    },

    /**
     * Shows or hides the loading indicator
     * @param {boolean} show - Whether to show or hide the loading indicator
     * @param {string} [message='Loading...'] - Custom loading message
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
                <div class="loading-spinner"></div>
                <div class="loading-message">${message}</div>
            `;
            loader.style.display = 'flex';
        } else {
            loader.style.display = 'none';
        }
    },

    /**
     * Sets default dates for the date inputs
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
        } catch (error) {
            console.error('Error setting default dates:', error);
            this.showError('Failed to set default dates');
        }
    },

    /**
     * Validates time range
     * @param {Date} startTime - Start time
     * @param {Date} endTime - End time
     * @param {number} [maxDays=7] - Maximum allowed days between dates
     * @returns {boolean} Whether the time range is valid
     */
    validateTimeRange(startTime, endTime, maxDays = 7) {
        // Convert to Date objects if strings
        const start = new Date(startTime);
        const end = new Date(endTime);

        // Check for invalid dates
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            this.showError('Invalid date format');
            return false;
        }

        // Check order
        if (start >= end) {
            this.showError('Start time must be before end time');
            return false;
        }

        // Check range
        const timeDiff = end - start;
        const dayDiff = timeDiff / (1000 * 60 * 60 * 24);
        
        if (dayDiff > maxDays) {
            this.showError(`Time range cannot exceed ${maxDays} days`);
            return false;
        }

        return true;
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
     * Formats a number with specified decimal places
     * @param {number} value - Number to format
     * @param {number} [decimals=1] - Number of decimal places
     * @returns {string} Formatted number
     */
    formatNumber(value, decimals = 1) {
        return Number(value).toFixed(decimals);
    },

    /**
     * Checks if a value is a valid number
     * @param {any} value - Value to check
     * @returns {boolean} Whether the value is a valid number
     */
    isValidNumber(value) {
        const num = parseFloat(value);
        return !isNaN(num) && isFinite(num);
    }
};

export default utils;