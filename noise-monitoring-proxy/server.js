// noise-monitoring-proxy/server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// API 配置
const API_CONFIG = {
    TARGET_API: 'https://data.smartdublin.ie/sonitus-api',
    CREDENTIALS: {
        username: 'dublincityapi',
        password: 'Xpa5vAQ9ki'
    }
};

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    if (Object.keys(req.body).length > 0) {
        console.log('Request body:', req.body);
    }
    next();
});

// 获取监控器列表
app.post('/api/monitors', async (req, res) => {
    try {
        console.log('Fetching monitors from Dublin API...');
        
        const response = await axios.post(
            `${API_CONFIG.TARGET_API}/api/monitors`, 
            new URLSearchParams({
                username: API_CONFIG.CREDENTIALS.username,
                password: API_CONFIG.CREDENTIALS.password
            }), 
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('Monitors response:', {
            count: response.data.length,
            sample: response.data[0]
        });

        res.json(response.data);
    } catch (error) {
        console.error('Monitors error:', {
            message: error.message,
            response: error.response?.data
        });
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// 获取监控数据
app.post('/api/data', async (req, res) => {
    try {
        const { monitor, start, end } = req.body;
        
        console.log('Data request:', {
            monitor,
            start,
            end
        });

        if (!monitor || !start || !end) {
            return res.status(400).json({
                error: 'Missing required parameters',
                required: ['monitor', 'start', 'end']
            });
        }
        
        const response = await axios.post(
            `${API_CONFIG.TARGET_API}/api/data`,
            new URLSearchParams({
                username: API_CONFIG.CREDENTIALS.username,
                password: API_CONFIG.CREDENTIALS.password,
                monitor,
                start,
                end
            }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        
        console.log('Data response:', {
            monitor,
            dataPoints: response.data.length,
            firstPoint: response.data[0],
            lastPoint: response.data[response.data.length - 1]
        });

        res.json(response.data);
    } catch (error) {
        console.error('Data error:', {
            message: error.message,
            response: error.response?.data
        });
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// 健康检查端点
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying requests to ${API_CONFIG.TARGET_API}`);
});

// 优雅退出处理
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});