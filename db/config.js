// db/config.js
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

// 验证必要的环境变量
const requiredEnvVars = [
    'DB_HOST',
    'DB_USER', 
    'DB_PASSWORD',
    'DB_NAME',
];

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
    }
}

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10'),
    waitForConnections: true,
    connectTimeout: 10000,
    queueLimit: 0,
    timezone: '+00:00', // 使用UTC时间
    debug: process.env.DB_DEBUG === 'true' || false,
    multipleStatements: true, // 允许多条SQL语句
    dateStrings: [
        'DATE',
        'DATETIME'
    ]
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
export const testConnection = async () => {
    try {
        const connection = await pool.getConnection();
        console.log('Database connection successful');
        
        // 测试基本查询
        const [result] = await connection.query('SELECT 1');
        if (result[0]['1'] === 1) {
            console.log('Database query test successful');
        }

        connection.release();
        return true;
    } catch (error) {
        console.error('Database connection failed:', error);
        return false;
    }
};

// 健康检查函数
export const checkHealth = async () => {
    try {
        const connection = await pool.getConnection();
        const status = {
            connected: true,
            readyState: connection.connection.state,
            serverInfo: connection.connection.serverInfo,
            connectionId: connection.connection.connectionId,
            config: {
                host: dbConfig.host,
                port: dbConfig.port,
                database: dbConfig.database,
                user: dbConfig.user
            }
        };
        connection.release();
        return status;
    } catch (error) {
        return {
            connected: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// 关闭连接池
export const closePool = async () => {
    try {
        await pool.end();
        console.log('Connection pool closed successfully');
        return true;
    } catch (error) {
        console.error('Error closing connection pool:', error);
        return false;
    }
};

// 添加事件监听器
pool.on('connection', (connection) => {
    console.log('New database connection established');
    
    connection.on('error', (err) => {
        console.error('Database connection error:', err);
    });
});

pool.on('acquire', (connection) => {
    console.log('Connection %d acquired', connection.threadId);
});

pool.on('release', (connection) => {
    console.log('Connection %d released', connection.threadId);
});

pool.on('enqueue', () => {
    console.log('Waiting for available connection slot');
});

export default pool;