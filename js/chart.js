/**
 * Chart module for noise monitoring
 */
const chartModule = {
    chart: null,

    /**
     * Formats date for display
     * @param {string} datetime - Datetime string
     * @returns {string} Formatted datetime
     */
    formatDateTime(datetime) {
        const date = new Date(datetime);
        return date.toLocaleString();
    },

    /**
     * Updates or creates the chart with new data
     * @param {Array} data - Array of noise data points
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

        // Destroy existing chart if present
        this.destroyChart();

        // Process the data for multiple metrics
        const chartData = {
            labels: data.map(item => this.formatDateTime(item.datetime)),
            datasets: [
                {
                    label: 'LAeq (dB)',
                    data: data.map(item => item.laeq),
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    yAxisID: 'y'
                },
                {
                    label: 'LA10 (dB)',
                    data: data.map(item => item.la10),
                    borderColor: '#28a745',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: 'LA90 (dB)',
                    data: data.map(item => item.la90),
                    borderColor: '#dc3545',
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.1,
                    pointRadius: 0,
                    yAxisID: 'y'
                }
            ]
        };

        // Create new chart with simplified time handling
        this.chart = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
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
                        min: function(ctx) {
                            const values = data.map(item => Math.min(item.laeq, item.la90));
                            return Math.floor(Math.min(...values) / 10) * 10;
                        },
                        max: function(ctx) {
                            const values = data.map(item => Math.max(item.laeq, item.la10));
                            return Math.ceil(Math.max(...values) / 10) * 10;
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)} dB`;
                            }
                        }
                    }
                }
            }
        });

        // Add statistics
        this.addStatistics(data);
    },

    /**
     * Adds statistics to the chart
     * @param {Array} data - Array of noise data points
     */
    addStatistics(data) {
        const stats = {
            laeq: {
                min: Math.min(...data.map(item => item.laeq)).toFixed(1),
                max: Math.max(...data.map(item => item.laeq)).toFixed(1),
                avg: (data.reduce((sum, item) => sum + item.laeq, 0) / data.length).toFixed(1)
            },
            la10: {
                avg: (data.reduce((sum, item) => sum + item.la10, 0) / data.length).toFixed(1)
            },
            la90: {
                avg: (data.reduce((sum, item) => sum + item.la90, 0) / data.length).toFixed(1)
            }
        };

        const statsDiv = document.createElement('div');
        statsDiv.className = 'chart-statistics';
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">LAeq:</span>
                <span class="stat-value">Min: ${stats.laeq.min} dB / Avg: ${stats.laeq.avg} dB / Max: ${stats.laeq.max} dB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">LA10 Avg:</span>
                <span class="stat-value">${stats.la10.avg} dB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">LA90 Avg:</span>
                <span class="stat-value">${stats.la90.avg} dB</span>
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
     * Destroys the current chart instance
     */
    destroyChart() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
};

export default chartModule;