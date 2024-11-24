/**
 * API configuration
 */
const apiConfig = {
    BASE_URL: 'http://localhost:3000',
    credentials: {
        username: 'dublincityapi',
        password: 'Xpa5vAQ9ki'
    }
};

/**
 * API handling module
 */
const api = {
    /**
     * Converts Date object to Unix timestamp (seconds)
     * @param {Date} date - Date object to convert
     * @returns {number} Unix timestamp in seconds
     */
    dateToUnixTimestamp(date) {
        return Math.floor(date.getTime() / 1000);
    },

    /**
     * Makes a POST request to the API
     * @param {string} endpoint - API endpoint
     * @param {Object} params - Request parameters
     * @returns {Promise<any>} Response data
     */
    async makeRequest(endpoint, params = {}) {
        try {
            const response = await fetch(`${apiConfig.BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    username: apiConfig.credentials.username,
                    password: apiConfig.credentials.password,
                    ...params
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error Response:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorText
                });
                throw new Error(`HTTP error! status: ${response.status}, ${errorText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Request failed:', error);
            throw error;
        }
    },

    /**
     * Fetches all available noise monitors from the API
     * @returns {Promise<Array>} Array of noise monitor objects
     */
    async getMonitors() {
        try {
            // console.log('Fetching monitors...');
            
            const data = await this.makeRequest('/api/monitors');
            // console.log('Raw monitors data:', data);

            const monitorsArray = Array.isArray(data) ? data : (data.monitors || []);
            const noiseMonitors = monitorsArray.filter(monitor => 
                monitor && 
                typeof monitor === 'object' && 
                monitor.label && 
                monitor.label.toLowerCase().includes('noise')
            );

            const validMonitors = noiseMonitors
                .map(monitor => ({
                    id: monitor.serial_number,
                    displayName: `${monitor.label} - ${monitor.location}`,
                    name: monitor.label,
                    location: monitor.location || 'Unknown',
                    latitude: monitor.latitude,
                    longitude: monitor.longitude,
                    lastCalibrated: monitor.last_calibrated,
                    ...monitor
                }))
                .sort((a, b) => String(a.name).localeCompare(String(b.name)));

            // console.log('Processed noise monitors:', validMonitors);
            return validMonitors;

        } catch (error) {
            console.error('Error fetching monitors:', error);
            throw new Error(`Failed to fetch monitors: ${error.message}`);
        }
    },

    /**
     * Fetches noise data for a specific monitor and time range
     * @param {string} monitorId - ID of the monitor
     * @param {string} startTime - ISO string of start time
     * @param {string} endTime - ISO string of end time
     * @returns {Promise<Array>} Array of noise data points
     */
    async getData(monitorId, startTime, endTime) {
        try {
            const startTimestamp = this.dateToUnixTimestamp(new Date(startTime));
            const endTimestamp = this.dateToUnixTimestamp(new Date(endTime));
            
            /*
            console.log('Requesting noise data:', {
                monitor: monitorId,
                start: startTimestamp,
                end: endTimestamp,
                startDate: new Date(startTime),
                endDate: new Date(endTime)
            });
            */

            const data = await this.makeRequest('/api/data', {
                monitor: monitorId,
                start: startTimestamp,
                end: endTimestamp
            });

            // console.log('Raw noise data:', data);
            const measurements = Array.isArray(data) ? data : (data.measurements || []);
            const validData = measurements
                .filter(item => (
                    item &&
                    typeof item === 'object' &&
                    !isNaN(item.value) &&
                    item.value >= 0 &&
                    item.timestamp
                ))
                .map(item => ({
                    timestamp: new Date(item.timestamp),
                    value: Number(item.value),
                    unit: item.unit || 'dB',
                    ...item
                }))
                .sort((a, b) => a.timestamp - b.timestamp);
            
            /*
            console.log('Processed noise data:', {
                totalPoints: validData.length,
                firstPoint: validData[0],
                lastPoint: validData[validData.length - 1]
            });
            */

            return validData;

        } catch (error) {
            console.error('Error fetching noise data:', error);
            throw new Error(`Failed to fetch noise data: ${error.message}`);
        }
    }
};

export default api;