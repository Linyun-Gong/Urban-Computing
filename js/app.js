// js/app.js
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
            console.log('Initializing application...');
            utils.showLoading(true);
            
            // 检查服务连接状态
            const connectionStatus = await api.checkConnections();
            console.log('Connection status:', connectionStatus);
            
            if (!connectionStatus.database && !connectionStatus.proxy) {
                throw new Error('Neither database nor proxy service is available');
            }
    
            // 即使数据库不可用也继续加载monitors
            await this.loadMonitors();
            console.log('Monitors loaded successfully');
            
            this.setupEventListeners();
            utils.setDefaultDates();
            this.setupResizeHandler();
            this.checkUrlParams();
        } catch (error) {
            console.error('Initialization error:', error);
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
            
            if (monitors && monitors.length > 0) {
                // Add monitors
                monitors.forEach(monitor => {
                    const option = document.createElement('option');
                    option.value = monitor.id;
                    option.textContent = `${monitor.displayName} (${monitor.location})`; 
                    select.appendChild(option);
                });
            } else {
                throw new Error('No monitors available');
            }
        } catch (error) {
            console.error('Failed to load monitors:', error);
            throw error;
        }
    }
    
    /**
     * Sets up event listeners
     */
    setupEventListeners() {
        const dataTypeSelect = utils.getElement('dataType');
        const fetchButton = utils.getElement('fetchData');
        const monitorSelect = utils.getElement('monitor');
        const startTimeInput = utils.getElement('startTime');
        const endTimeInput = utils.getElement('endTime');

        dataTypeSelect.addEventListener('change', () => this.handleDataTypeChange());
        fetchButton.addEventListener('click', () => this.fetchAndDisplayData());
        monitorSelect.addEventListener('change', () => this.handleMonitorChange());
        startTimeInput.addEventListener('change', () => this.validateTimeInputs());
        endTimeInput.addEventListener('change', () => this.validateTimeInputs());

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

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

        if (startTime < sevenDaysAgo) {
            utils.showError('Data is only available for the last 7 days');
            return false;
        }

        if (endTime > now) {
            utils.showError('End time cannot be in the future');
            return false;
        }

        return true;
    }

    /**
     * Fetches and displays noise monitoring data
     */
    async fetchAndDisplayData() {
        try {
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

            console.log('Request parameters:', {
                monitor,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                dataType
            });

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

            if (dataType === 'historical') {
                this.updateInterval = setInterval(async () => {
                    const newEndTime = new Date();
                    const newStartTime = new Date(utils.getElement('startTime').value); // 使用原始开始时间
                    await this.updateChartData(monitor, newStartTime, newEndTime);
                }, 5 * 60 * 1000); // 每5分钟运行一次
            }
            

            this.updateUrlParameters();

        } catch (error) {
            console.error('Error in fetchAndDisplayData:', error);
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
            console.log('Updating chart data...');
            const data = await api.getData(monitor, startTime, endTime);
    
            if (!data || data.length === 0) {
                throw new Error('No data available for the selected time range');
            }
    
            console.log('Received data points:', data.length);
            chartModule.updateChart(data);
            this.updateDataInfo(startTime, endTime, data.length);
    
        } catch (error) {
            console.error('Error in updateChartData:', error);
            throw error;
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

    /**
     * Cleans up resources when closing
     */
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        if (chartModule.chart) {
            chartModule.destroyChart();
        }
    }
}

export default NoiseMonitoringApp;