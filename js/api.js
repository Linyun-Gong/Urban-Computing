// app.js
import utils from './utils.js';
import api from './api.js';
import chartModule from './chart.js';

class NoiseMonitoringApp {
    constructor() {
        // 初始化类属性
        this.updateInterval = null;
        this.isLoading = false;
        this.currentMonitor = null;
        this.isRealtime = false;
        
        // 绑定方法到实例
        this.handleDataTypeChange = this.handleDataTypeChange.bind(this);
        this.handleMonitorChange = this.handleMonitorChange.bind(this);
        this.fetchAndDisplayData = this.fetchAndDisplayData.bind(this);
        this.validateTimeInputs = this.validateTimeInputs.bind(this);
    }

    async initialize() {
        try {
            utils.showLoading(true);
            await this.loadMonitors();
            this.setupEventListeners();
            utils.setDefaultDates();
            this.setupResizeHandler();
            this.checkUrlParams();
            console.log('Application initialized successfully');
        } catch (error) {
            console.error('Initialization error:', error);
            utils.showError(error.message);
        } finally {
            utils.showLoading(false);
        }
    }

    async loadMonitors() {
        try {
            const monitors = await api.getMonitors();
            const select = document.getElementById('monitor');
            
            // Clear existing options
            select.innerHTML = '<option value="">Select a monitor...</option>';
            
            // Add monitors
            monitors.forEach(monitor => {
                const option = document.createElement('option');
                option.value = monitor.id;
                option.textContent = monitor.displayName;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('Failed to load monitors:', error);
            utils.showError('Failed to load monitors: ' + error.message);
        }
    }

    setupEventListeners() {
        const elements = {
            dataType: document.getElementById('dataType'),
            fetchData: document.getElementById('fetchData'),
            monitor: document.getElementById('monitor'),
            startTime: document.getElementById('startTime'),
            endTime: document.getElementById('endTime')
        };

        // Verify all elements exist
        Object.entries(elements).forEach(([name, element]) => {
            if (!element) {
                throw new Error(`Element '${name}' not found`);
            }
        });

        elements.dataType.addEventListener('change', this.handleDataTypeChange);
        elements.fetchData.addEventListener('click', this.fetchAndDisplayData);
        elements.monitor.addEventListener('change', this.handleMonitorChange);
        elements.startTime.addEventListener('change', this.validateTimeInputs);
        elements.endTime.addEventListener('change', this.validateTimeInputs);

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.fetchAndDisplayData();
            }
        });
    }

    setupResizeHandler() {
        const debouncedResize = utils.debounce(() => {
            if (chartModule.chart) {
                chartModule.chart.resize();
            }
        }, 250);

        window.addEventListener('resize', debouncedResize);
    }

    handleDataTypeChange() {
        const dataTypeSelect = document.getElementById('dataType');
        const endTimeGroup = document.getElementById('endTimeGroup');
        
        this.isRealtime = dataTypeSelect.value === 'realtime';
        endTimeGroup.style.display = this.isRealtime ? 'none' : 'block';
        
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        this.updateUrlParameters();
    }

    handleMonitorChange() {
        const monitorSelect = document.getElementById('monitor');
        this.currentMonitor = monitorSelect.value;
        
        if (chartModule.chart) {
            chartModule.destroyChart();
        }

        this.updateUrlParameters();
    }

    validateTimeInputs() {
        const startTime = new Date(document.getElementById('startTime').value);
        const endTime = new Date(document.getElementById('endTime').value);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            utils.showError('Please enter valid dates');
            return false;
        }

        if (startTime >= endTime) {
            utils.showError('Start time must be before end time');
            return false;
        }

        return true;
    }

    async fetchAndDisplayData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            utils.showLoading(true);

            const monitor = document.getElementById('monitor').value;
            if (!monitor) {
                throw new Error('Please select a monitor');
            }

            const dataType = document.getElementById('dataType').value;
            const startTime = new Date(document.getElementById('startTime').value);
            const endTime = dataType === 'realtime' ? new Date() : new Date(document.getElementById('endTime').value);

            if (!this.validateTimeInputs()) {
                return;
            }

            // Clear existing update interval if any
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }

            await this.updateChartData(monitor, startTime, endTime);

            // Set up real-time updates if needed
            if (dataType === 'realtime') {
                this.updateInterval = setInterval(async () => {
                    const newEndTime = new Date();
                    await this.updateChartData(monitor, startTime, newEndTime);
                }, 5 * 60 * 1000); // Update every 5 minutes
            }

            this.updateUrlParameters();

        } catch (error) {
            console.error('Error fetching data:', error);
            utils.showError(error.message);
        } finally {
            this.isLoading = false;
            utils.showLoading(false);
        }
    }

    async updateChartData(monitor, startTime, endTime) {
        try {
            const data = await api.getData(monitor, startTime.toISOString(), endTime.toISOString());
            console.log('Received data:', data);

            if (!data || data.length === 0) {
                throw new Error('No data available for the selected time range');
            }

            chartModule.updateChart(data);
            this.updateDataInfo(startTime, endTime, data.length);

        } catch (error) {
            console.error('Error updating chart:', error);
            throw error;
        }
    }

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

        const chartContainer = document.getElementById('chart').parentElement;
        if (!document.getElementById('dataInfo')) {
            chartContainer.insertBefore(infoDiv, chartContainer.firstChild);
        }
    }

    updateUrlParameters() {
        const params = new URLSearchParams(window.location.search);
        
        if (this.currentMonitor) {
            params.set('monitor', this.currentMonitor);
        }
        
        params.set('type', this.isRealtime ? 'realtime' : 'historical');
        
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        window.history.replaceState({}, '', newUrl);
    }

    checkUrlParams() {
        const params = new URLSearchParams(window.location.search);
        
        const monitor = params.get('monitor');
        if (monitor) {
            const monitorSelect = document.getElementById('monitor');
            monitorSelect.value = monitor;
            this.currentMonitor = monitor;
        }

        const type = params.get('type');
        if (type) {
            const dataTypeSelect = document.getElementById('dataType');
            dataTypeSelect.value = type;
            this.handleDataTypeChange();
        }
    }
}

export default NoiseMonitoringApp;