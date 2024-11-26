// chart.js
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

        // 如果图表已存在，更新数据而不是重新创建
        if (this.chart) {
            const datasets = this.createDatasets(data);
            const labels = data.map(item => new Date(item.datetime));

            this.chart.data.labels = labels;
            this.chart.data.datasets = datasets;

            // 更新统计信息
            this.addStatistics(data);

            // 重新计算Y轴范围
            const allValues = [];
            data.forEach(item => {
                if (item.monitors) {
                    item.monitors.forEach(monitor => {
                        if (monitor.laeq) allValues.push(monitor.laeq);
                    });
                } else {
                    if (item.laeq) allValues.push(item.laeq);
                    if (item.la10) allValues.push(item.la10);
                    if (item.la90) allValues.push(item.la90);
                }
            });

            const minValue = Math.min(...allValues);
            const maxValue = Math.max(...allValues);
            const padding = (maxValue - minValue) * 0.1;

            this.chart.options.scales.y.min = Math.max(0, Math.floor((minValue - padding) / 5) * 5);
            this.chart.options.scales.y.max = Math.ceil((maxValue + padding) / 5) * 5;

            this.chart.update('none'); // 使用 'none' 模式以提高性能
        } else {
            // 创建新图表
            const chartConfig = this.createChartConfig(data);
            this.chart = new Chart(canvas.getContext('2d'), chartConfig);
            this.addStatistics(data);
        }
    },

    /**
     * 创建图表配置
     */
    createChartConfig(data) {
        const labels = data.map(item => new Date(item.datetime));
        const datasets = this.createDatasets(data);

        // 计算Y轴范围
        const allValues = [];
        data.forEach(item => {
            if (item.monitors) {
                item.monitors.forEach(monitor => {
                    if (monitor.laeq) allValues.push(monitor.laeq);
                });
            } else {
                if (item.laeq) allValues.push(item.laeq);
                if (item.la10) allValues.push(item.la10);
                if (item.la90) allValues.push(item.la90);
            }
        });

        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);
        const padding = (maxValue - minValue) * 0.1;

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
                        type: 'time',
                        time: {
                            parser: 'YYYY-MM-DD HH:mm:ss',
                            tooltipFormat: 'MM/DD/YYYY, HH:mm',
                            displayFormats: {
                                millisecond: 'HH:mm:ss.SSS',
                                second: 'HH:mm:ss',
                                minute: 'HH:mm',
                                hour: 'MM/DD, HH:mm'
                            }
                        },
                        adapters: {
                            date: {
                                locale: 'en'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Noise Level (dB)'
                        },
                        min: Math.max(0, Math.floor((minValue - padding) / 5) * 5),
                        max: Math.ceil((maxValue + padding) / 5) * 5,
                        ticks: {
                            stepSize: 5
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(context) {
                                if (context[0]) {
                                    return moment(context[0].parsed.x).format('MM/DD/YYYY, HH:mm:ss');
                                }
                                return '';
                            }
                        }
                    }
                }
            }
        };
    },

    /**
     * 创建数据集
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
                            displayName: monitor.displayName || monitor.monitorId
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

        // 单个监控器数据处理
        return this.createDefaultDatasets(data);
    },

    /**
     * 创建默认数据集（单个监控器）
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
     * 添加统计信息
     */
    addStatistics(data) {
        const statsDiv = document.getElementById('chartStats');
        if (!statsDiv) return;

        statsDiv.style.display = 'block';
        const stats = this.calculateStatistics(data);
        
        // 获取监控器名称
        let monitorName = 'Monitor';
        if (data[0]?.monitors) {
            monitorName = data[0].monitors[0]?.displayName || 'Monitor';
        }

        statsDiv.innerHTML = `
            <h3>Statistics</h3>
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
    },

    /**
     * 计算统计数据
     */
    calculateStatistics(data) {
        const getValue = (arr, key) => arr.map(item => {
            if (item.monitors) {
                return Math.max(...item.monitors.map(m => m[key] || 0));
            }
            return item[key];
        }).filter(v => v != null);

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