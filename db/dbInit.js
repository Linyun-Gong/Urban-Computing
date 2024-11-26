// db/dbInit.js
import pool from './config.js';

/**
 * 初始化数据库
 */
async function initializeDatabase() {
    try {
        // 测试连接
        const connection = await pool.getConnection();
        console.log('Database connection established');

        try {
            // 创建monitors表
            await connection.query(`
                CREATE TABLE IF NOT EXISTS monitors (
                    monitor_id VARCHAR(50) PRIMARY KEY,
                    display_name VARCHAR(100) NOT NULL,
                    location VARCHAR(100),
                    status VARCHAR(20) DEFAULT 'active',
                    data_table_name VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    last_sync_time TIMESTAMP NULL,
                    sync_status VARCHAR(20) DEFAULT NULL
                )
            `);

            // 获取现有的monitors
            const [monitors] = await connection.query(
                'SELECT monitor_id, data_table_name FROM monitors'
            );

            // 为每个monitor创建数据表
            for (const monitor of monitors) {
                await connection.query(`
                    CREATE TABLE IF NOT EXISTS monitors (
                        monitor_id VARCHAR(50) PRIMARY KEY,
                        display_name VARCHAR(100) NOT NULL,
                        location VARCHAR(100),
                        status VARCHAR(20) DEFAULT 'active',
                        data_table_name VARCHAR(50) NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        last_sync_time TIMESTAMP NULL,
                        sync_status VARCHAR(20) DEFAULT NULL
                    )
                `);
                
            }

            console.log('Database initialization completed successfully');
            return true;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Database initialization failed:', error);
        return false;
    }
}

/**
 * 检查数据库状态
 */
async function checkDatabaseStatus() {
    const connection = await pool.getConnection();
    try {
        const status = {
            connection: false,
            monitorsTable: false,
            monitorTables: [],
            errors: []
        };

        // 检查连接
        status.connection = true;

        // 检查monitors表
        const [monitorsTable] = await connection.query(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = DATABASE() 
            AND table_name = 'monitors'
        `);
        status.monitorsTable = monitorsTable[0].count > 0;

        if (status.monitorsTable) {
            // 检查monitors表中的记录
            const [monitors] = await connection.query(
                'SELECT monitor_id, data_table_name FROM monitors'
            );

            // 检查每个monitor的数据表
            for (const monitor of monitors) {
                try {
                    const [tableExists] = await connection.query(`
                        SELECT COUNT(*) as count,
                               (SELECT COUNT(*) FROM ${monitor.data_table_name}) as records
                        FROM information_schema.tables 
                        WHERE table_schema = DATABASE() 
                        AND table_name = ?
                    `, [monitor.data_table_name]);

                    status.monitorTables.push({
                        monitorId: monitor.monitor_id,
                        tableName: monitor.data_table_name,
                        exists: tableExists[0].count > 0,
                        recordCount: tableExists[0].records || 0
                    });
                } catch (error) {
                    status.errors.push(`Error checking table ${monitor.data_table_name}: ${error.message}`);
                }
            }
        }

        return status;

    } catch (error) {
        console.error('Database status check failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 检查数据同步状态
 */
async function checkDataSyncStatus() {
    const connection = await pool.getConnection();
    try {
        const [monitors] = await connection.query(
            'SELECT monitor_id, data_table_name FROM monitors'
        );
        
        const syncStatus = [];
        for (const monitor of monitors) {
            try {
                // 检查最新数据时间
                const [lastRecord] = await connection.query(`
                    SELECT 
                        COUNT(*) as total_records,
                        MIN(timestamp) as oldest_record,
                        MAX(timestamp) as latest_record,
                        (SELECT COUNT(*) FROM ${monitor.data_table_name} 
                         WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)) as recent_records
                    FROM ${monitor.data_table_name}
                `);

                // 检查同步状态
                const [syncInfo] = await connection.query(`
                    SELECT last_sync_time, sync_status
                    FROM monitors
                    WHERE monitor_id = ?
                `, [monitor.monitor_id]);

                syncStatus.push({
                    monitorId: monitor.monitor_id,
                    tableName: monitor.data_table_name,
                    totalRecords: lastRecord[0].total_records,
                    oldestRecord: lastRecord[0].oldest_record,
                    latestRecord: lastRecord[0].latest_record,
                    recentRecords: lastRecord[0].recent_records,
                    lastSyncTime: syncInfo[0]?.last_sync_time,
                    syncStatus: syncInfo[0]?.sync_status
                });
            } catch (error) {
                console.error(`Error checking sync status for monitor ${monitor.monitor_id}:`, error);
                syncStatus.push({
                    monitorId: monitor.monitor_id,
                    error: error.message
                });
            }
        }

        return syncStatus;

    } catch (error) {
        console.error('Sync status check failed:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * 更新监控器的同步状态
 */
async function updateMonitorSyncStatus(monitorId, status) {
    const connection = await pool.getConnection();
    try {
        await connection.query(`
            UPDATE monitors
            SET last_sync_time = NOW(),
                sync_status = ?,
                updated_at = NOW()
            WHERE monitor_id = ?
        `, [status, monitorId]);

        return true;
    } catch (error) {
        console.error('Error updating sync status:', error);
        throw error;
    } finally {
        connection.release();
    }
}

export {
    initializeDatabase,
    checkDatabaseStatus,
    checkDataSyncStatus,
    updateMonitorSyncStatus
};