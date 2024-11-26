// js/app.js
import utils from './utils.js';
import api from './api.js';
import chartModule from './chart.js';

/**
 * Main application class
 * Handles the core application logic and state management
 */
class NoiseMonitoringApp {
    /**
     * Constructor
     * Initializes the application state and starts the application
     */
    constructor() {
        this.updateInterval = null;
        this.isLoading = false;
        this.selectedMonitors = [];
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
            
            select.innerHTML = '';
            
            if (monitors && monitors.length > 0) {
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

        // 添加快捷键支持
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
        const dataTypeSelect = utils.getElement('dataType');
        const endTimeGroup = utils.getElement('endTimeGroup');
        this.isRealtime = dataTypeSelect.value === 'realtime';
        
        endTimeGroup.style.display = this.isRealtime ? 'none' : 'block';
        
        if (this.isRealtime && this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.updateUrlParameters();
    }

    /**
     * Handles changes in monitor selection
     */
    handleMonitorChange() {
        const monitorSelect = utils.getElement('monitor');
        const selectedOptions = Array.from(monitorSelect.selectedOptions);
        
        // 限制最多选择5个监控器
        if (selectedOptions.length > 5) {
            utils.showError('Maximum 5 monitors can be selected');
            // 取消最后选择的选项
            monitorSelect.options[monitorSelect.options.length - 1].selected = false;
            return;
        }

        this.selectedMonitors = selectedOptions.map(option => option.value);
        
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
     * Fetches and displays data
     */
    async fetchAndDisplayData() {
        try {
            if (this.isLoading) return;
            this.isLoading = true;
            utils.showLoading(true);

            if (this.selectedMonitors.length === 0) {
                throw new Error('Please select at least one monitor');
            }

            const startTime = new Date(utils.getElement('startTime').value);
            const endTime = this.isRealtime ? 
                new Date() : 
                new Date(utils.getElement('endTime').value);

            console.log('Request parameters:', {
                monitors: this.selectedMonitors,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                isRealtime: this.isRealtime
            });

            if (!this.validateTimeInputs()) {
                return;
            }

            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            const data = await api.getData(
                this.selectedMonitors,
                startTime,
                endTime,
                { fusionType: 'concatenated' }
            );
            
            if (!data || data.length === 0) {
                throw new Error('No data available for the selected time range');
            }

            chartModule.updateChart(data);
            this.updateDataInfo(startTime, endTime, data.length);

            if (this.isRealtime) {
                this.setupDataUpdateInterval();
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
     * Sets up the data update interval
     */
    setupDataUpdateInterval() {
        this.updateInterval = setInterval(async () => {
            try {
                const newEndTime = new Date();
                const newStartTime = this.isRealtime ?
                    new Date(newEndTime - (60 * 60 * 1000)) : // 最近一小时
                    new Date(utils.getElement('startTime').value);
                
                const data = await api.getData(
                    this.selectedMonitors,
                    newStartTime,
                    newEndTime,
                    { fusionType: 'concatenated' }
                );
                
                if (data && data.length > 0) {
                    chartModule.updateChart(data);
                    this.updateDataInfo(newStartTime, newEndTime, data.length);
                }
            } catch (error) {
                console.error('Error in interval update:', error);
                clearInterval(this.updateInterval);
                this.updateInterval = null;
                utils.showError('Real-time update failed: ' + error.message);
            }
        }, 5 * 60 * 1000); // 每5分钟更新一次
    }

    /**
     * Updates the data information display
     */
    updateDataInfo(startTime, endTime, dataPoints) {
        const dataInfo = utils.getElement('dataInfo');
        
        dataInfo.style.display = 'block';
        dataInfo.innerHTML = `
            <div class="info-header">
                <h3>Data Overview</h3>
                <span class="mode-badge ${this.isRealtime ? 'realtime' : 'historical'}">
                    ${this.isRealtime ? 'Real-time' : 'Historical'} Mode
                </span>
            </div>
            <div class="info-content">
                <div>
                    <strong>Time Range:</strong>
                    <div>${startTime.toLocaleString()} - ${endTime.toLocaleString()}</div>
                </div>
                <div>
                    <strong>Data Points:</strong>
                    <div>${dataPoints}</div>
                </div>
                <div>
                    <strong>Monitors:</strong>
                    <div>${this.selectedMonitors.length} selected</div>
                </div>
                ${this.isRealtime ? `
                    <div>
                        <strong>Update Interval:</strong>
                        <div>Every 5 minutes</div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Updates URL parameters based on current selection
     */
    updateUrlParameters() {
        const params = new URLSearchParams();
        
        if (this.selectedMonitors.length > 0) {
            params.set('monitors', this.selectedMonitors.join(','));
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
        
        const monitors = params.get('monitors');
        if (monitors) {
            const monitorIds = monitors.split(',');
            const monitorSelect = utils.getElement('monitor');
            
            monitorIds.forEach(id => {
                const option = Array.from(monitorSelect.options).find(opt => opt.value === id);
                if (option) {
                    option.selected = true;
                }
            });
            
            this.selectedMonitors = monitorIds;
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