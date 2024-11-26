/**
 * Chart module for noise monitoring
 */
const chartModule = {
    chart: null,

    // 颜色配置
    colors: {
        single: {
            laeq: '#007bff',
            la10: '#28a745',
            la90: '#dc3545'
        },
        multiple: [
            { primary: '#007bff', secondary: 'rgba(0, 123, 255, 0.1)' },
            { primary: '#28a745', secondary: 'rgba(40, 167, 69, 0.1)' },
            { primary: '#dc3545', secondary: 'rgba(220, 53, 69, 0.1)' },
            { primary: '#ffc107', secondary: 'rgba(255, 193, 7, 0.1)' },
            { primary: '#6f42c1', secondary: 'rgba(111, 66, 193, 0.1)' }
        ]
    },

    /**
     * 格式化日期时间
     * @private
     */
    formatDateTime(datetime) {
        const date = new Date(datetime);
        return date.toLocaleString('en-US', {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
    },

    /**
     * 更新或创建图表
     * @param {Array} data - 噪声数据数组
     */
    updateChart(data) {
        if (!data || data.length === 0) {
            console.error('No data provided to updateChart');
            return;
        }

        const canvas = document.getElementById('chart');
        if (!canvas) {
            console.error('Chart canvas element not found');
            return;
        }

        this.destroyChart();

        const chartConfig = this.createChartConfig(data);
        this.chart = new Chart(canvas.getContext('2d'), chartConfig);
        this.addStatistics(data);
    },

    /**
     * 创建图表配置
     * @private
     */
    createChartConfig(data) {
        const labels = data.map(item => this.formatDateTime(item.datetime));
        const datasets = this.createDatasets(data);

        // 计算合适的Y轴范围
        const allValues = [];
        data.forEach(item => {
            if (item.monitors) {
                item.monitors.forEach(monitor => {
                    if (monitor.laeq) allValues.push(monitor.laeq);
                });
            } else if (item.laeq) {
                allValues.push(item.laeq);
            }
        });

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const padding = (maxValue - minValue) * 0.1; // 添加10%的padding

        return {
            type: 'line',
            data: {
                labels,
                datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxTicksLimit: 10,
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Noise Level (dB)'
                        },
                        // 设置合适的刻度范围
                        min: Math.max(0, minValue - padding),
                        max: maxValue + padding,
                        ticks: {
                            stepSize: 5 // 设置刻度间隔
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: (chart) => this.customLegendLabels(chart)
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                const value = context.parsed.y?.toFixed(1);
                                if (!value) return null;
                                return `${context.dataset.label}: ${value} dB`;
                            }
                        }
                    }
                }
            }
        };
    },

    /**
     * 创建数据集
     * @private
     */
    createDatasets(data) {
        // 检查是否是多监控器数据
        if (data[0]?.monitors) {
            const monitorDatasets = new Map();

            // 收集所有监控器的数据
            data.forEach(item => {
                item.monitors.forEach(monitor => {
                    if (!monitorDatasets.has(monitor.monitorId)) {
                        monitorDatasets.set(monitor.monitorId, {
                            data: Array(data.length).fill(null),
                            displayName: monitor.displayName || `Monitor ${monitor.monitorIndex + 1}`
                        });
                    }
                    const index = data.indexOf(item);
                    monitorDatasets.get(monitor.monitorId).data[index] = monitor.laeq;
                });
            });

            // 转换为数据集数组
            return Array.from(monitorDatasets.entries()).map(([monitorId, monitorData], index) => ({
                label: `${monitorData.displayName} LAeq (dB)`,
                data: monitorData.data,
                borderColor: this.colors.multiple[index].primary,
                backgroundColor: this.colors.multiple[index].secondary,
                fill: false,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            }));
        }

        // 单个监控器数据处理保持不变
        return this.createDefaultDatasets(data);
    },
    
    /**
     * 创建默认数据集（单个监控器）
     * @private
     */
    createDefaultDatasets(data) {
        return [
            {
                label: 'LAeq (dB)',
                data: data.map(item => item.laeq),
                borderColor: this.colors.single.laeq,
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            },
            {
                label: 'LA10 (dB)',
                data: data.map(item => item.la10),
                borderColor: this.colors.single.la10,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0
            },
            {
                label: 'LA90 (dB)',
                data: data.map(item => item.la90),
                borderColor: this.colors.single.la90,
                borderDash: [5, 5],
                fill: false,
                tension: 0.1,
                pointRadius: 0
            }
        ];
    },

    /**
     * 创建连接数据集
     * @private
     */
    createConcatenatedDatasets(data) {
        return [
            {
                label: 'Combined LAeq (dB)',
                data: data.map(item => item.laeq),
                borderColor: this.colors.multiple[0].primary,
                backgroundColor: this.colors.multiple[0].secondary,
                fill: true,
                tension: 0.1,
                pointRadius: 2,
                pointHoverRadius: 5
            }
        ];
    },


    /**
     * 创建工具提示回调
     * @private
     */
    createTooltipCallback(fusionType) {
        return function(context) {
            const value = context.parsed.y.toFixed(1);
            let label = `${context.dataset.label}: ${value} dB`;
            
            if (fusionType === 'weighted') {
                label += ' (Weighted Average)';
            } else if (fusionType === 'concatenated') {
                label += ' (Combined)';
            }

            return label;
        };
    },

    /**
     * 自定义图例标签
     * @private
     */
    customLegendLabels(chart) {
        const datasets = chart.data.datasets;
        return datasets.map((dataset, i) => ({
            text: dataset.label,
            fillStyle: dataset.backgroundColor,
            strokeStyle: dataset.borderColor,
            lineWidth: 2,
            hidden: !chart.isDatasetVisible(i),
            index: i
        }));
    },

    /**
     * 添加统计信息
     * @param {Array} data - 数据数组
     * @param {string} fusionType - 融合类型
     */
    addStatistics(data, fusionType) {
        const statsDiv = document.getElementById('chartStats') || document.createElement('div');
        statsDiv.id = 'chartStats';
        statsDiv.className = 'chart-statistics';

        const stats = this.calculateStatistics(data);
        const fusionLabel = fusionType !== 'none' ? ` (${fusionType})` : '';

        statsDiv.innerHTML = `
            <h3>Statistics${fusionLabel}</h3>
            <div class="stats-content">
                <div class="stat-group">
                    <h4>LAeq</h4>
                    <div class="stat-items">
                        <div class="stat-item">
                            <span class="stat-label">Minimum:</span>
                            <span class="stat-value">${stats.laeq.min.toFixed(1)} dB</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Average:</span>
                            <span class="stat-value">${stats.laeq.avg.toFixed(1)} dB</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Maximum:</span>
                            <span class="stat-value">${stats.laeq.max.toFixed(1)} dB</span>
                        </div>
                    </div>
                </div>
                <div class="stat-group">
                    <h4>Percentile Levels</h4>
                    <div class="stat-items">
                        <div class="stat-item">
                            <span class="stat-label">LA10 Average:</span>
                            <span class="stat-value">${stats.la10.avg.toFixed(1)} dB</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">LA90 Average:</span>
                            <span class="stat-value">${stats.la90.avg.toFixed(1)} dB</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const chartContainer = document.getElementById('chart').parentElement;
        const existingStats = chartContainer.querySelector('.chart-statistics');
        if (existingStats) {
            existingStats.remove();
        }
        chartContainer.appendChild(statsDiv);
    },

    /**
     * 计算统计数据
     * @private
     */
    calculateStatistics(data) {
        const getValue = (arr, key) => arr.map(item => item[key]).filter(v => v != null);
        const average = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

        const laeqValues = getValue(data, 'laeq');
        const la10Values = getValue(data, 'la10');
        const la90Values = getValue(data, 'la90');

        return {
            laeq: {
                min: Math.min(...laeqValues),
                max: Math.max(...laeqValues),
                avg: average(laeqValues)
            },
            la10: {
                avg: average(la10Values)
            },
            la90: {
                avg: average(la90Values)
            }
        };
    },

    /**
     * 销毁当前图表实例
     */
    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

export default chartModule;