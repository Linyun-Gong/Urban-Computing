/**
 * Chart module
 * Handles all chart-related functionality
 */
const chartModule = {
    chart: null,

    /**
     * Updates or creates the chart with new data
     * @param {Array} data - Array of noise data points
     */
    updateChart(data) {
        // Extract main data (e.g., LAeq for noise levels)
        const laeqValues = data.map(item => item.laeq); // Use `laeq` as primary y-axis data
        const labels = data.map(item => new Date(item.datetime).toLocaleString()); // Use `datetime` as x-axis labels

        // Calculate Simple Moving Average (SMA) for trend line
        const smaValues = this.calculateSMA(laeqValues, 5); // Use window size of 5

        const chartData = {
            labels,
            datasets: [
                {
                    label: 'Noise Level (LAeq, dB)',
                    data: laeqValues,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.1,
                    fill: true,
                    pointRadius: 2,
                    pointHoverRadius: 5,
                    pointBackgroundColor: '#007bff',
                    pointHoverBackgroundColor: '#0056b3',
                    pointBorderColor: '#fff',
                    pointHoverBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverBorderWidth: 2
                },
                {
                    label: 'Trend Line (SMA)',
                    data: smaValues,
                    borderColor: '#ff0000',
                    borderDash: [5, 5], // Dashed line for trend
                    tension: 0.1,
                    pointRadius: 0, // No points for trend line
                    fill: false
                }
            ]
        };

        // Destroy existing chart if present
        if (this.chart) {
            this.chart.destroy();
        }

        // Create new chart
        const ctx = document.getElementById('chart').getContext('2d');
        this.chart = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 14
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function (context) {
                                return `Noise Level: ${context.raw?.toFixed(2)} dB`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'minute',
                            displayFormats: {
                                minute: 'MMM D, HH:mm'
                            }
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Noise Level (dB)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            }
                        },
                        grid: {
                            display: true,
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'linear'
                    }
                }
            }
        });

        // Add statistics to the chart
        this.addStatistics(data);
    },

    /**
     * Adds statistics to the chart (e.g., min, max, average)
     * @param {Array} data - Array of noise data points
     */
    addStatistics(data) {
        const values = data.map(item => item.laeq); // Use `laeq` for statistics
        const stats = {
            min: Math.min(...values).toFixed(1),
            max: Math.max(...values).toFixed(1),
            avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
        };

        const statsDiv = document.createElement('div');
        statsDiv.className = 'chart-statistics';
        statsDiv.innerHTML = `
            <div class="stat-item">
                <span class="stat-label">Min:</span>
                <span class="stat-value">${stats.min} dB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Max:</span>
                <span class="stat-value">${stats.max} dB</span>
            </div>
            <div class="stat-item">
                <span class="stat-label">Average:</span>
                <span class="stat-value">${stats.avg} dB</span>
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
     * Calculates Simple Moving Average (SMA)
     * @param {Array<number>} data - Data points
     * @param {number} windowSize - Window size for moving average
     * @returns {Array<number>} SMA values
     */
    calculateSMA(data, windowSize) {
        const sma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < windowSize - 1) {
                sma.push(null); // Not enough data points for the window
            } else {
                const windowData = data.slice(i - windowSize + 1, i + 1);
                const average = windowData.reduce((a, b) => a + b, 0) / windowSize;
                sma.push(average);
            }
        }
        return sma;
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
