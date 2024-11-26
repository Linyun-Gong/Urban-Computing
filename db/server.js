// server.js
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { initializeDatabase, checkDatabaseStatus, checkDataSyncStatus } from './dbInit.js';
import monitorDAO from './monitorDAO.js';

const app = express();

// 中间件配置
app.use(cors({
    origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// 详细请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (Object.keys(req.body).length > 0) {
        console.log('Request body:', req.body);
    }
    next();
});

// 数据库健康检查中间件
const dbHealthCheck = async (req, res, next) => {
    if (req.path === '/api/health' || req.path === '/api/db/status') {
        return next();
    }
    
    try {
        const dbStatus = await checkDatabaseStatus();
        if (!dbStatus.connection || !dbStatus.monitorsTable) {
            throw new Error('Database is not available');
        }
        next();
    } catch (error) {
        console.error('Database health check failed:', error);
        res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database is currently unavailable',
            timestamp: new Date().toISOString()
        });
    }
};

app.use(dbHealthCheck);

// 错误处理中间件
const errorHandler = (err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        path: req.path,
        timestamp: new Date().toISOString()
    });
};

// 数据库状态检查
app.get('/api/db/status', async (req, res) => {
    try {
        const dbStatus = await checkDatabaseStatus();
        const syncStatus = await checkDataSyncStatus();
        
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            database: dbStatus,
            sync: syncStatus
        });
    } catch (error) {
        console.error('Status check failed:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// 获取监控器列表
app.post('/api/monitors', async (req, res) => {
    try {
        const monitors = await monitorDAO.getMonitors();
        console.log('Retrieved monitors:', monitors.length);
        res.json(monitors);
    } catch (error) {
        console.error('Error getting monitors:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取监控数据
app.post('/api/data/:monitorId', async (req, res) => {
    try {
        const { monitorId } = req.params;
        const { startTime, endTime, realtime } = req.body;
        
        console.log('Data request:', {
            monitorId,
            startTime,
            endTime,
            realtime
        });

        // 验证参数
        if (!startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required parameters: startTime and endTime'
            });
        }

        // 验证时间范围
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        if (startTime < sevenDaysAgo) {
            return res.status(400).json({
                error: 'Data is only available for the last 7 days'
            });
        }

        // 获取所有监控器的信息
        const monitors = await monitorDAO.getMonitors();

        // 处理多监控器数据请求
        if (monitorId.includes(',')) {
            const monitorIds = monitorId.split(',');
            
            // 限制最多选择5个监控器
            if (monitorIds.length > 5) {
                return res.status(400).json({
                    error: 'Maximum 5 monitors can be selected'
                });
            }

            // 获取选中监控器的完整信息
            const selectedMonitors = monitors.filter(m => 
                monitorIds.includes(m.monitor_id)
            );

            const dataPromises = selectedMonitors.map(monitor => 
                monitorDAO.getData(monitor.monitor_id, startTime, endTime, realtime === 'true')
            );

            const allData = await Promise.all(dataPromises);
            const formattedData = allData.map((data, index) => 
                data.map(item => ({
                    datetime: new Date(item.timestamp).toISOString().replace('T', ' ').split('.')[0],
                    laeq: Number(item.laeq),
                    la10: Number(item.la10),
                    la90: Number(item.la90),
                    lafmax: Number(item.lafmax),
                    lceq: Number(item.lceq),
                    lcfmax: Number(item.lcfmax),
                    lc10: Number(item.lc10),
                    lc90: Number(item.lc90)
                }))
            );

            const resultData = monitorDAO.concatenateData(formattedData, selectedMonitors);
            return res.json(resultData);
        }

        // 单个监控器数据处理
        const monitor = monitors.find(m => m.monitor_id === monitorId);
        if (!monitor) {
            return res.status(404).json({
                error: 'Monitor not found'
            });
        }

        const data = await monitorDAO.getData(
            monitorId,
            startTime,
            endTime,
            realtime === 'true'
        );

        if (!data || data.length === 0) {
            return res.status(404).json({
                error: 'No data available for the selected time range'
            });
        }

        const formattedData = data.map(item => ({
            datetime: new Date(item.timestamp).toISOString().replace('T', ' ').split('.')[0],
            laeq: Number(item.laeq),
            la10: Number(item.la10),
            la90: Number(item.la90),
            lafmax: Number(item.lafmax),
            lceq: Number(item.lceq),
            lcfmax: Number(item.lcfmax),
            lc10: Number(item.lc10),
            lc90: Number(item.lc90),
            monitorId: monitor.monitor_id,
            displayName: monitor.display_name
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).json({ error: error.message });
    }
});

// 初始化监控器数据
app.post('/api/data/:monitorId/initialize', async (req, res) => {
    try {
        const { monitorId } = req.params;
        const initResult = await monitorDAO.initializeMonitorData(monitorId);
        res.json(initResult);
    } catch (error) {
        console.error('Error initializing data:', error);
        res.status(500).json({ error: error.message });
    }
});

// 保存数据
app.post('/api/data/:monitorId/save', async (req, res) => {
    const maxRetries = 3;
    let retryCount = 0;

    while (retryCount < maxRetries) {
        try {
            const { monitorId } = req.params;
            const { data } = req.body;

            if (!Array.isArray(data)) {
                return res.status(400).json({ error: 'Invalid data format' });
            }

            console.log('Save request:', {
                monitorId,
                dataPoints: data.length,
                samplePoint: data[0]
            });

            const result = await monitorDAO.saveData(monitorId, data);
            res.json({
                success: true,
                message: 'Data saved successfully',
                count: data.length,
                result
            });
            return;
        } catch (error) {
            retryCount++;
            console.error(`Save attempt ${retryCount} failed:`, error);

            if (retryCount === maxRetries) {
                return res.status(500).json({
                    error: error.message,
                    attempts: retryCount
                });
            }

            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
    }
});

// 获取最新数据
app.post('/api/data/:monitorId/latest', async (req, res) => {
    try {
        const { monitorId } = req.params;
        const data = await monitorDAO.getLatestData(monitorId);

        if (!data) {
            return res.status(404).json({ error: 'No data available' });
        }

        // 获取监控器信息
        const monitors = await monitorDAO.getMonitors();
        const monitor = monitors.find(m => m.monitor_id === monitorId);

        const formattedData = {
            datetime: new Date(data.timestamp).toISOString().replace('T', ' ').split('.')[0],
            laeq: Number(data.laeq),
            la10: Number(data.la10),
            la90: Number(data.la90),
            lafmax: Number(data.lafmax),
            lceq: Number(data.lceq),
            lcfmax: Number(data.lcfmax),
            lc10: Number(data.lc10),
            lc90: Number(data.lc90),
            monitorId: monitor?.monitor_id,
            displayName: monitor?.display_name
        };

        res.json(formattedData);
    } catch (error) {
        console.error('Error getting latest data:', error);
        res.status(500).json({ error: error.message });
    }
});

// 获取数据统计
app.post('/api/stats/:monitorId', async (req, res) => {
    try {
        const { monitorId } = req.params;
        const stats = await monitorDAO.getDataStats(monitorId);
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

// 手动数据清理
app.post('/api/maintenance/cleanup', async (req, res) => {
    try {
        const results = await monitorDAO.cleanOldData();
        res.json({
            success: true,
            message: 'Cleanup completed successfully',
            results
        });
    } catch (error) {
        console.error('Error during cleanup:', error);
        res.status(500).json({ error: error.message });
    }
});

// 使用错误处理中间件
app.use(errorHandler);

// 启动服务器
const PORT = process.env.SERVER_PORT || 3001;
let server;

async function startServer() {
    try {
        // 初始化数据库
        const initResult = await initializeDatabase();
        if (!initResult) {
            console.error('Database initialization failed');
            process.exit(1);
        }

        // 检查数据库状态
        const dbStatus = await checkDatabaseStatus();
        console.log('Database status:', JSON.stringify(dbStatus, null, 2));

        // 检查数据同步状态
        const syncStatus = await checkDataSyncStatus();
        console.log('Data sync status:', JSON.stringify(syncStatus, null, 2));

        if (!dbStatus.connection || !dbStatus.monitorsTable) {
            console.error('Critical database issues found');
            process.exit(1);
        }

        server = app.listen(PORT, () => {
            console.log(`Database server running on port ${PORT}`);
        });

        // 设置定时清理任务
        setInterval(async () => {
            try {
                console.log('Starting periodic historical data sync...');
                const monitors = await monitorDAO.getMonitors();

                for (const monitor of monitors) {
                    const now = Math.floor(Date.now() / 1000);
                    const lastSyncTime = new Date(monitor.last_sync_time || 0).getTime() / 1000;
                    const startTime = lastSyncTime || now - (7 * 24 * 60 * 60);

                    console.log(`Syncing data for monitor: ${monitor.monitor_id}`);
                    const data = await monitorDAO.fetchDataFromProxy(monitor.monitor_id, startTime, now);

                    if (data && data.length > 0) {
                        await monitorDAO.saveData(monitor.monitor_id, data);
                        await monitorDAO.updateMonitorSyncStatus(monitor.monitor_id, 'synchronized');
                        console.log(`Synced ${data.length} records for monitor ${monitor.monitor_id}`);
                    }
                }
            } catch (error) {
                console.error('Periodic sync failed:', error);
            }
        }, 5 * 60 * 1000); // 每5分钟运行一次

    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

// 优雅退出处理
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    if (server) {
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

// 未捕获异常处理
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// 启动服务器
startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});

export default server;