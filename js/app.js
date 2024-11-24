// 导入必要的模块
import utils from './utils.js';
import api from './api.js';
import chartModule from './chart.js';

/**
 * Main application class
 * Handles the core application logic and state management
 */
class NoiseMonitoringApp {
    constructor() {
        this.updateInterval = null;
        this.isLoading = false;
        this.currentMonitor = null;
        this.isRealtime = false;
        this.initialize();
    }

    /**
     * Initializes the application
     */
    async initialize() {
        try {
            utils.showLoading(true);
            await this.loadMonitors();
            this.setupEventListeners();
            utils.setDefaultDates();
            this.setupResizeHandler();
            this.checkUrlParams();
        } catch (error) {
            utils.showError(error.message);
        } finally {
            utils.showLoading(false);
        }
    }

    /**
     * Loads available monitors from the API
     */
    async loadMonitors() {
        try {
            const monitors = await api.getMonitors();
            const select = utils.getElement('monitor');
            
            // Clear existing options
            select.innerHTML = '<option value="">Select a monitor...</option>';
            
            // Add monitors with displayName
            monitors.forEach(monitor => {
                const option = document.createElement('option');
                option.value = monitor.id;
                option.textContent = monitor.displayName; 
                select.appendChild(option);
            });
        } catch (error) {
            utils.showError(`Failed to load monitors: ${error.message}`);
        }
    }

    /**
     * Sets up event listeners
     */
    setupEventListeners() {
        // Main control elements
        const dataTypeSelect = utils.getElement('dataType');
        const fetchButton = utils.getElement('fetchData');
        const monitorSelect = utils.getElement('monitor');
        const startTimeInput = utils.getElement('startTime');
        const endTimeInput = utils.getElement('endTime');

        // Event listeners for main controls
        dataTypeSelect.addEventListener('change', () => this.handleDataTypeChange());
        fetchButton.addEventListener('click', () => this.fetchAndDisplayData());
        monitorSelect.addEventListener('change', () => this.handleMonitorChange());
        
        // Time input validation
        startTimeInput.addEventListener('change', () => this.validateTimeInputs());
        endTimeInput.addEventListener('change', () => this.validateTimeInputs());

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.fetchAndDisplayData();
            }
        });
    }

    /**
     * Sets up window resize handler
     */
    setupResizeHandler() {
        const debouncedResize = utils.debounce(() => {
            if (chartModule.chart) {
                chartModule.chart.resize();
            }
        }, 250);

        window.addEventListener('resize', debouncedResize);
    }

    /**
     * Handles changes in the data type selector
     */
    handleDataTypeChange() {
        const isRealtime = utils.getElement('dataType').value === 'realtime';
        const endTimeGroup = utils.getElement('endTimeGroup');
        this.isRealtime = isRealtime;
        
        endTimeGroup.style.display = isRealtime ? 'none' : 'block';
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.updateUrlParameters();
    }

    /**
     * Handles changes in monitor selection
     */
    handleMonitorChange() {
        const monitorId = utils.getElement('monitor').value;
        this.currentMonitor = monitorId;
        
        if (chartModule.chart) {
            chartModule.destroyChart();
        }

        this.updateUrlParameters();
    }

    /**
     * Validates time input values
     */
    validateTimeInputs() {
        const startTime = new Date(utils.getElement('startTime').value);
        const endTime = new Date(utils.getElement('endTime').value);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            utils.showError('Please enter valid dates');
            return false;
        }

        if (startTime >= endTime) {
            utils.showError('Start time must be before end time');
            return false;
        }

        const timeDiff = endTime - startTime;
        const maxDiff = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        if (timeDiff > maxDiff) {
            utils.showError('Time range cannot exceed 7 days');
            return false;
        }

        return true;
    }

    /**
     * Fetches and displays noise monitoring data
     */
    async fetchAndDisplayData() {
        try {
            console.log('Request parameters:', {
                monitor,
                startTime: utils.formatDate(startTime),
                endTime: utils.formatDate(endTime)
            });
            if (this.isLoading) return;
            this.isLoading = true;
            utils.showLoading(true);

            const monitor = utils.getElement('monitor').value;
            if (!monitor) {
                throw new Error('Please select a monitor');
            }

            const dataType = utils.getElement('dataType').value;
            const startTime = new Date(utils.getElement('startTime').value);
            const endTime = dataType === 'realtime' ? new Date() : new Date(utils.getElement('endTime').value);

            if (!this.validateTimeInputs()) {
                return;
            }

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            await this.updateChartData(monitor, startTime, endTime);

            if (dataType === 'realtime') {
                this.updateInterval = setInterval(async () => {
                    const newEndTime = new Date();
                    await this.updateChartData(monitor, startTime, newEndTime);
                }, 5 * 60 * 1000); // Update every 5 minutes
            }

            this.updateUrlParameters();

        } catch (error) {
            utils.showError(error.message);
        } finally {
            this.isLoading = false;
            utils.showLoading(false);
        }
    }

    /**
     * Updates the chart with new data
     */
    async updateChartData(monitor, startTime, endTime) {
        try {
            const data = await api.getData(monitor, utils.formatDate(startTime), utils.formatDate(endTime));
    
            console.log('Raw API data:', data);
    
            // 验证数据有效性
            const validData = data.map(item => {
                if (!item.datetime || isNaN(item.laeq) || isNaN(item.la10) || isNaN(item.la90)) {
                    console.warn('Invalid data item:', item);
                    return null;
                }
    
                return {
                    datetime: new Date(item.datetime), // 转换为 Date 对象
                    laeq: parseFloat(item.laeq),
                    la10: parseFloat(item.la10),
                    la90: parseFloat(item.la90),
                    lafmax: parseFloat(item.lafmax),
                    lceq: parseFloat(item.lceq),
                    lcfmax: parseFloat(item.lcfmax),
                    lc10: parseFloat(item.lc10),
                    lc90: parseFloat(item.lc90),
                };
            }).filter(Boolean); // 过滤无效数据
    
            if (validData.length === 0) {
                utils.showError('No valid data points found');
                return;
            }
    
            console.log('Processed data:', validData);
            console.log('API Response Data:', data);
            console.log('Valid Data:', validData);

            chartModule.updateChart(validData);
            this.updateDataInfo(startTime, endTime, validData.length);
    
        } catch (error) {
            console.error('Error in updateChartData:', error);
            utils.showError(`Failed to update chart: ${error.message}`);
        }
    }
    

    /**
     * Updates the data information display
     */
    updateDataInfo(startTime, endTime, dataPoints) {
        const infoDiv = document.getElementById('dataInfo') || document.createElement('div');
        infoDiv.id = 'dataInfo';
        infoDiv.className = 'data-info';
        infoDiv.innerHTML = `
            <div class="info-content">
                <div>Time Range: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}</div>
                <div>Data Points: ${dataPoints}</div>
                <div>Update Mode: ${this.isRealtime ? 'Real-time' : 'Historical'}</div>
            </div>
        `;

        const chartContainer = utils.getElement('chart').parentElement;
        if (!document.getElementById('dataInfo')) {
            chartContainer.insertBefore(infoDiv, chartContainer.firstChild);
        }
    }

    /**
     * Updates URL parameters based on current selection
     */
    updateUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        
        if (this.currentMonitor) {
            params.set('monitor', this.currentMonitor);
        }
        
        params.set('type', this.isRealtime ? 'realtime' : 'historical');
        
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    /**
     * Checks URL parameters for initial state
     */
    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        const monitor = params.get('monitor');
        if (monitor) {
            const monitorSelect = utils.getElement('monitor');
            monitorSelect.value = monitor;
            this.currentMonitor = monitor;
        }

        const type = params.get('type');
        if (type) {
            const dataTypeSelect = utils.getElement('dataType');
            dataTypeSelect.value = type;
            this.handleDataTypeChange();
        }
    }
}

// Export the class
export default NoiseMonitoringApp;