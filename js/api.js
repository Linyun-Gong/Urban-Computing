// api.js
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

    /**
     * 检查服务连接状态
     */
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

    /**
     * 获取监控器列表
     */
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

    /**
     * 从数据库获取数据
     */
    async fetchFromDatabase(monitorIds, startTime, endTime) {
        const monitorIdsString = Array.isArray(monitorIds) ? monitorIds.join(',') : monitorIds;
        try {
            const response = await fetch(`${this.API_CONFIG.DB_URL}/api/data/${monitorIdsString}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    startTime,
                    endTime,
                    realtime: false
                })
            });

            if (!response.ok) {
                throw new Error(`Database request failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Database fetch failed:', error);
            throw error;
        }
    }

    /**
     * 从代理服务器获取数据
     */
    async fetchFromProxy(monitorId, startTime, endTime) {
        try {
            const response = await fetch(`${this.API_CONFIG.PROXY_URL}/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    username: this.CREDENTIALS.username,
                    password: this.CREDENTIALS.password,
                    monitor: monitorId.replace(/_/g, '.'),
                    start: startTime.toString(),
                    end: endTime.toString()
                })
            });

            if (!response.ok) {
                throw new Error(`Proxy request failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Proxy fetch failed:', error);
            throw error;
        }
    }
    /**
         * 获取单个或多个监控器的数据
         */
    async getData(monitorIds, startTime, endTime) {
        const monitors = Array.isArray(monitorIds) ? monitorIds : [monitorIds];
        
        if (monitors.length > 5) {
            throw new Error('Maximum 5 monitors can be selected');
        }

        try {
            const startUnix = Math.round(startTime.getTime() / 1000);
            const endUnix = Math.round(endTime.getTime() / 1000);

            // 获取监控器信息
            const monitorList = await this.getMonitors();
            const monitorInfo = new Map(
                monitorList.map(m => [m.id, m])
            );

            // 从数据库获取数据
            try {
                const monitorIdsString = monitors.join(',');
                const response = await fetch(`${this.API_CONFIG.DB_URL}/api/data/${monitorIdsString}`, {
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

                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        return data.map(item => ({
                            ...item,
                            monitors: item.monitors?.map(m => ({
                                ...m,
                                displayName: monitorInfo.get(m.monitorId)?.displayName
                            }))
                        }));
                    }
                }
            } catch (dbError) {
                console.log('Database fetch failed, trying proxy:', dbError);
            }

            // 如果数据库获取失败，从代理获取
            const dataPromises = monitors.map(monitorId =>
                this.fetchFromProxy(monitorId, startUnix, endUnix)
            );

            const allData = await Promise.all(dataPromises);
            
            // 处理和标准化数据，包含displayName
            return this.standardizeMultipleData(
                allData.map((data, index) => ({
                    data: data,
                    monitorId: monitors[index],
                    displayName: monitorInfo.get(monitors[index])?.displayName
                }))
            );

        } catch (error) {
            console.error('Error in getData:', error);
            throw error;
        }
    }

    /**
     * 标准化数据
     */
    standardizeData(data) {
        if (!Array.isArray(data)) {
            throw new Error('Invalid data format received');
        }

        // 处理单监控器数据
        if (!data[0]?.monitors) {
            return data.map(item => ({
                datetime: this.formatDateTime(item.datetime || item.timestamp),
                laeq: this.parseNumericValue(item.laeq),
                la10: this.parseNumericValue(item.la10),
                la90: this.parseNumericValue(item.la90),
                lafmax: this.parseNumericValue(item.lafmax),
                lceq: this.parseNumericValue(item.lceq),
                lcfmax: this.parseNumericValue(item.lcfmax),
                lc10: this.parseNumericValue(item.lc10),
                lc90: this.parseNumericValue(item.lc90)
            }));
        }

        // 处理多监控器数据
        return data;
    }

    /**
         * 标准化多个监控器的数据
         */
    standardizeMultipleData(data) {
        if (!data || !Array.isArray(data)) {
            throw new Error('Invalid data format received');
        }

        // 如果数据已经包含monitors数组，直接返回
        if (data[0]?.monitors) {
            return data;
        }

        // 获取所有时间点
        const timeSet = new Set();
        data.forEach(item => {
            timeSet.add(this.formatDateTime(item.datetime || item.timestamp));
        });

        const times = Array.from(timeSet).sort();

        // 为每个时间点整理数据
        return times.map(time => ({
            datetime: time,
            monitors: data.map((point, index) => {
                if (point.monitors) {
                    return point.monitors.find(m => 
                        this.formatDateTime(m.datetime || m.timestamp) === time
                    );
                }
                return {
                    laeq: this.parseNumericValue(point.laeq),
                    monitorId: point.monitorId,
                    displayName: point.displayName,
                    monitorIndex: index
                };
            }).filter(Boolean)
        }));
    }

    /**
     * 同步数据到数据库
     */
    async syncDataToDatabase(monitors, allData) {
        try {
            const syncPromises = monitors.map((monitorId, index) =>
                fetch(`${this.API_CONFIG.DB_URL}/api/data/${monitorId}/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ data: allData[index] })
                })
            );

            await Promise.all(syncPromises);
            console.log('Data synced successfully to database');
        } catch (error) {
            console.error('Error syncing data to database:', error);
            throw error;
        }
    }

    /**
     * 辅助方法：格式化日期时间
     */
    formatDateTime(datetime) {
        if (!datetime) return '';
        const date = new Date(datetime.replace(' ', 'T'));
        return date.toISOString().replace('T', ' ').split('.')[0];
    }

    /**
     * 辅助方法：解析数值
     */
    parseNumericValue(value) {
        if (value === null || value === undefined) return 0;
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
}

export default new Api();