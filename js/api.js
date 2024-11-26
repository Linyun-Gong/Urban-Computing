// js/api.js
class Api {
    constructor() {
        this.API_CONFIG = {
            PROXY_URL: 'http://localhost:3000',
            DB_URL: 'http://localhost:3001'
        };
        this.CREDENTIALS = {
            username: 'dublincityapi',
            password: 'Xpa5vAQ9ki'
        };
    }

    async checkConnections() {
        console.log('Checking service connections...'); 
        const results = {
            proxy: false,
            database: false,
            errors: []
        };

        try {
            // 检查数据库连接
            const dbResponse = await fetch(`${this.API_CONFIG.DB_URL}/api/monitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (dbResponse.ok) {
                results.database = true;
                console.log('Database connection successful');
            } else {
                throw new Error(`Database responded with status: ${dbResponse.status}`);
            }
        } catch (error) {
            console.error('Database connection error:', error);
            results.errors.push(`Database service error: ${error.message}`);
        }

        try {
            // 检查代理服务连接
            const proxyResponse = await fetch(`${this.API_CONFIG.PROXY_URL}/api/monitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    username: this.CREDENTIALS.username,
                    password: this.CREDENTIALS.password
                })
            });
            
            if (proxyResponse.ok) {
                results.proxy = true;
                console.log('Proxy connection successful');
            } else {
                throw new Error(`Proxy responded with status: ${proxyResponse.status}`);
            }
        } catch (error) {
            console.error('Proxy connection error:', error);
            results.errors.push(`Proxy service error: ${error.message}`);
        }

        return results;
    }

    async getMonitors() {
        try {
            // 首先尝试从数据库获取
            try {
                const dbResponse = await fetch(`${this.API_CONFIG.DB_URL}/api/monitors`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (dbResponse.ok) {
                    const dbData = await dbResponse.json();
                    console.log('Monitors retrieved from database:', dbData);
                    return dbData.map(monitor => ({
                        id: monitor.monitor_id,
                        displayName: monitor.display_name,
                        location: monitor.location
                    }));
                }
            } catch (dbError) {
                console.log('Database fetch failed, falling back to proxy:', dbError);
            }

            // 如果数据库不可用，从代理获取
            console.log('Fetching monitors from proxy service...');
            const proxyResponse = await fetch(`${this.API_CONFIG.PROXY_URL}/api/monitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    username: this.CREDENTIALS.username,
                    password: this.CREDENTIALS.password
                })
            });

            if (!proxyResponse.ok) {
                throw new Error('Both database and proxy services are unavailable');
            }

            const proxyData = await proxyResponse.json();
            console.log('Monitors retrieved from proxy:', proxyData);
            return proxyData.map(monitor => ({
                id: monitor.id,
                displayName: monitor.name || monitor.id,
                location: monitor.location || 'Unknown'
            }));

        } catch (error) {
            console.error('Error fetching monitors:', error);
            throw error;
        }
    }

    async getData(monitorId, startTime, endTime) {
        try {
            console.log('Fetching data for monitor:', monitorId);
            const isRealtime = document.getElementById('dataType').value === 'realtime';
    
            const startUnix = Math.round(startTime.getTime() / 1000);
            const endUnix = Math.round(endTime.getTime() / 1000);
    
            console.log('Time range:', {
                start: startTime.toISOString(),
                end: endTime.toISOString(),
                startUnix,
                endUnix
            });
    
            let data;
            let source = 'unknown';
    
            try {
                if (!isRealtime) {
                    // 先从数据库获取数据
                    data = await this.fetchFromDatabase(monitorId, startUnix, endUnix);
                    source = 'database';
                }
            } catch (dbError) {
                console.log('Database fetch failed, trying proxy:', dbError);
            }
    
            if (!data) {
                // 如果数据库没有数据或是实时模式，从代理获取
                data = await this.fetchFromProxy(monitorId, startUnix, endUnix);
                source = 'proxy';
                
                // 如果从代理获取成功，异步保存到数据库
                if (data && data.length > 0) {
                    this.syncDataToDatabase(monitorId, data).catch(error => {
                        console.warn('Background sync to database failed:', error);
                    });
                }
            }
    
            if (!data || data.length === 0) {
                throw new Error(`No data available for the selected time range (source: ${source})`);
            }
    
            console.log(`Data retrieved from ${source}:`, {
                length: data.length,
                sample: data[0]
            });
    
            return this.standardizeData(data);
        } catch (error) {
            console.error('Error in getData:', error);
            throw error;
        }
    }

    async fetchFromProxy(monitorId, startUnix, endUnix) {
        try {
            const convertedMonitorId = monitorId.replace(/_/g, '.');
    
            console.log('Fetching from proxy:', {
                originalId: monitorId,
                convertedId: convertedMonitorId,
                startUnix,
                endUnix
            });
    
            const response = await fetch(`${this.API_CONFIG.PROXY_URL}/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    username: this.CREDENTIALS.username,
                    password: this.CREDENTIALS.password,
                    monitor: convertedMonitorId,
                    start: startUnix.toString(),
                    end: endUnix.toString()
                })
            });
    
            if (!response.ok) {
                throw new Error(`Proxy request failed: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Proxy response:', {
                monitorId: convertedMonitorId,
                dataLength: data?.length,
                sampleData: data?.[0]
            });
    
            return data;
        } catch (error) {
            console.error('Proxy fetch failed:', error);
            throw error;
        }
    }

    async fetchFromDatabase(monitorId, startUnix, endUnix) {
        try {
            console.log('Fetching from database:', {
                monitorId,
                startTime: new Date(startUnix * 1000).toISOString(),
                endTime: new Date(endUnix * 1000).toISOString()
            });
    
            const response = await fetch(`${this.API_CONFIG.DB_URL}/api/data/${monitorId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    startTime: startUnix,
                    endTime: endUnix,
                    realtime: false
                })
            });
    
            if (!response.ok) {
                throw new Error(`Database request failed: ${response.status}`);
            }
    
            const data = await response.json();
            console.log('Database response:', {
                monitorId,
                dataLength: data?.length,
                sampleData: data?.[0]
            });
    
            return data;
        } catch (error) {
            console.error('Database fetch failed:', error);
            throw error;
        }
    }

    async syncDataToDatabase(monitorId, data) {
        if (!data || data.length === 0) return;

        try {
            console.log('Syncing data to database:', {
                monitorId,
                dataLength: data.length,
                sampleData: data[0]
            });

            const transformedData = data.map(item => {
                const timestamp = item.datetime.replace(' ', 'T');
                return {
                    timestamp: new Date(timestamp).toISOString(),
                    laeq: this.parseNumericValue(item.laeq),
                    la10: this.parseNumericValue(item.la10),
                    la90: this.parseNumericValue(item.la90),
                    lafmax: this.parseNumericValue(item.lafmax),
                    lceq: this.parseNumericValue(item.lceq),
                    lcfmax: this.parseNumericValue(item.lcfmax),
                    lc10: this.parseNumericValue(item.lc10),
                    lc90: this.parseNumericValue(item.lc90)
                };
            });

            const response = await fetch(`${this.API_CONFIG.DB_URL}/api/data/${monitorId}/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ data: transformedData })
            });

            if (response.ok) {
                console.log(`Data successfully synced for monitor ${monitorId}`);
                
                // 更新 last_sync_time
                await fetch(`${this.API_CONFIG.DB_URL}/api/monitors/${monitorId}/sync`, {
                    method: 'POST'
                });
            } else {
                throw new Error(`Sync failed with status: ${response.status}`);
            }
        } catch (error) {
            console.error('Sync error:', error);
            throw error;
        }
    }

    async checkDatabaseConnection() {
        try {
            const response = await fetch(`${this.API_CONFIG.DB_URL}/api/db/status`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Database connection check failed:', error);
            throw error;
        }
    }

    standardizeData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received');
        }

        return data.map(item => {
            const timestamp = item.datetime.replace(' ', 'T');
            return {
                datetime: new Date(timestamp).toISOString(),
                laeq: this.parseNumericValue(item.laeq),
                la10: this.parseNumericValue(item.la10),
                la90: this.parseNumericValue(item.la90),
                lafmax: this.parseNumericValue(item.lafmax),
                lceq: this.parseNumericValue(item.lceq),
                lcfmax: this.parseNumericValue(item.lcfmax),
                lc10: this.parseNumericValue(item.lc10),
                lc90: this.parseNumericValue(item.lc90)
            };
        });
    }

    parseNumericValue(value) {
        if (value === null || value === undefined) return 0;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
}

export default new Api();