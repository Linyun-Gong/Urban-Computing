// monitorDAO.js
import mysql from 'mysql2/promise';
import pool from './config.js';

class MonitorDAO {
    async getMonitors() {
        try {
            console.log('Fetching monitors from database...');
            const [rows] = await pool.query(
                'SELECT monitor_id, display_name, location, status FROM monitors WHERE status = "active" OR status IS NULL'
            );
            console.log(`Retrieved ${rows.length} monitors`);
            return rows.map(row => ({
                ...row,
                monitor_id: this.convertMonitorId(row.monitor_id, false)
            }));
        } catch (error) {
            console.error('Error fetching monitors:', error);
            throw error;
        }
    }


    async getMonitorTableName(monitorId) {
        try {
            console.log('Getting table name for monitor:', monitorId);
            const dbMonitorId = this.convertMonitorId(monitorId, true);
            const [rows] = await pool.query(
                'SELECT data_table_name FROM monitors WHERE monitor_id = ?',
                [dbMonitorId]
            );

            if (rows.length === 0) {
                throw new Error(`Monitor not found: ${monitorId}`);
            }

            return rows[0].data_table_name;
        } catch (error) {
            console.error('Error getting table name:', error);
            throw error;
        }
    }

    async initializeMonitorData(monitorId) {
        try {
            const tableName = await this.getMonitorTableName(monitorId);
            const [count] = await pool.query(`SELECT COUNT(*) as count FROM ${tableName}`);
            
            if (count[0].count === 0) {
                console.log(`Initializing data for monitor ${monitorId}...`);
                
                // 计算最近7天的时间范围
                const endTime = Math.floor(Date.now() / 1000);
                const startTime = endTime - (7 * 24 * 60 * 60);

                const proxyData = await this.fetchDataFromProxy(monitorId, startTime, endTime);
                
                if (proxyData && proxyData.length > 0) {
                    await this.saveData(monitorId, proxyData);
                    console.log(`Initialized ${proxyData.length} records for monitor ${monitorId}`);
                    return {
                        initialized: true,
                        recordCount: proxyData.length,
                        timeRange: { startTime, endTime }
                    };
                }
            }
            return {
                initialized: count[0].count > 0,
                recordCount: count[0].count
            };
        } catch (error) {
            console.error('Error initializing monitor data:', error);
            throw error;
        }
    }

    async fetchDataFromProxy(monitorId, startTime, endTime) {
        try {
            const proxyUrl = process.env.PROXY_URL || 'http://localhost:3000';
            const response = await fetch(`${proxyUrl}/api/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    monitor: this.convertMonitorId(monitorId, false),
                    start: startTime.toString(),
                    end: endTime.toString()
                })
            });

            if (!response.ok) {
                throw new Error(`Proxy request failed: ${response.status}`);
            }

            const data = await response.json();
            console.log(`Retrieved ${data.length} records from proxy for ${monitorId}`);
            return data;
        } catch (error) {
            console.error('Error fetching from proxy:', error);
            throw error;
        }
    }

    async checkAndInitializeData(monitorId) {
        try {
            const tableName = await this.getMonitorTableName(monitorId);
            const [result] = await pool.query(`
                SELECT 
                    COUNT(*) as count,
                    MAX(timestamp) as latest_record,
                    MIN(timestamp) as earliest_record
                FROM ${tableName}
            `);

            const status = {
                initialized: result[0].count > 0,
                recordCount: result[0].count,
                latestRecord: result[0].latest_record,
                earliestRecord: result[0].earliest_record
            };

            if (!status.initialized) {
                console.log(`No data found for ${monitorId}, initializing...`);
                const initResult = await this.initializeMonitorData(monitorId);
                return {
                    ...status,
                    ...initResult
                };
            }

            return status;
        } catch (error) {
            console.error('Error checking data status:', error);
            throw error;
        }
    }

    async getData(monitorId, startTime, endTime, isRealtime = false) {
        try {
            // 首先检查并初始化数据
            await this.checkAndInitializeData(monitorId);
            
            const tableName = await this.getMonitorTableName(monitorId);
            const startDate = new Date(startTime * 1000);
            const endDate = new Date(endTime * 1000);

            console.log('Fetching data:', {
                monitor: monitorId,
                start: startDate,
                end: endDate,
                isRealtime
            });

            let query, params;

            if (isRealtime) {
                query = `
                    SELECT * FROM ${tableName}
                    WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                    ORDER BY timestamp ASC
                `;
                params = [];
            } else {
                query = `
                    SELECT * FROM ${tableName}
                    WHERE timestamp BETWEEN ? AND ?
                    ORDER BY timestamp ASC
                `;
                params = [startDate, endDate];
            }

            const [rows] = await pool.query(query, params);

            // 如果没有数据，尝试从代理获取
            if (rows.length === 0) {
                console.log('No data in database, fetching from proxy...');
                const proxyData = await this.fetchDataFromProxy(monitorId, startTime, endTime);
                
                if (proxyData && proxyData.length > 0) {
                    await this.saveData(monitorId, proxyData);
                    return proxyData;
                }
            }

            return rows;
        } catch (error) {
            console.error('Error fetching data:', error);
            throw error;
        }
    }

    convertMonitorId(id, toDatabase = true) {
        return toDatabase ? id.replace(/\./g, '_') : id.replace(/_/g, '.');
    }

    async saveData(monitorId, data) {
        const connection = await pool.getConnection();
        try {
            const tableName = await this.getMonitorTableName(monitorId);
            
            console.log('Starting data save transaction:', {
                monitor: monitorId,
                dataPoints: data.length
            });

            await connection.beginTransaction();

            const query = `
                INSERT INTO ${tableName} 
                (timestamp, laeq, la10, la90, lafmax, lceq, lcfmax, lc10, lc90)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                laeq = VALUES(laeq),
                la10 = VALUES(la10),
                la90 = VALUES(la90),
                lafmax = VALUES(lafmax),
                lceq = VALUES(lceq),
                lcfmax = VALUES(lcfmax),
                lc10 = VALUES(lc10),
                lc90 = VALUES(lc90)
            `;

            let successCount = 0;
            for (const item of data) {
                try {
                    const timestamp = new Date(item.datetime.replace(' ', 'T'));
                    await connection.query(query, [
                        timestamp,
                        parseFloat(item.laeq),
                        parseFloat(item.la10),
                        parseFloat(item.la90),
                        parseFloat(item.lafmax),
                        parseFloat(item.lceq),
                        parseFloat(item.lcfmax),
                        parseFloat(item.lc10),
                        parseFloat(item.lc90)
                    ]);
                    successCount++;
                } catch (itemError) {
                    console.warn('Error saving data point:', {
                        error: itemError.message,
                        data: item
                    });
                }
            }

            await connection.commit();
            console.log(`Successfully saved ${successCount} of ${data.length} data points`);
            
            return {
                totalPoints: data.length,
                savedPoints: successCount
            };
        } catch (error) {
            await connection.rollback();
            console.error('Error saving data:', error);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getLatestData(monitorId) {
        try {
            const tableName = await this.getMonitorTableName(monitorId);
            
            const [rows] = await pool.query(
                `SELECT * FROM ${tableName}
                ORDER BY timestamp DESC
                LIMIT 1`
            );

            console.log('Latest data point:', rows[0]);
            return rows[0] || null;
        } catch (error) {
            console.error('Error fetching latest data:', error);
            throw error;
        }
    }

    async cleanOldData() {
        try {
            console.log('Starting old data cleanup...');
            const [monitors] = await pool.query(
                'SELECT monitor_id, data_table_name FROM monitors WHERE status = "active" OR status IS NULL'
            );

            const results = [];
            for (const monitor of monitors) {
                try {
                    const query = `
                        DELETE FROM ${monitor.data_table_name}
                        WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY)
                    `;
                    const [result] = await pool.query(query);
                    results.push({
                        monitorId: monitor.monitor_id,
                        deletedRows: result.affectedRows
                    });
                    console.log(`Cleaned ${result.affectedRows} rows for monitor ${monitor.monitor_id}`);
                } catch (monitorError) {
                    console.error(`Error cleaning data for monitor ${monitor.monitor_id}:`, monitorError);
                    results.push({
                        monitorId: monitor.monitor_id,
                        error: monitorError.message
                    });
                }
            }
            return results;
        } catch (error) {
            console.error('Error in cleanOldData:', error);
            throw error;
        }
    }

    async getDataStats(monitorId) {
        try {
            const tableName = await this.getMonitorTableName(monitorId);
            const [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total_records,
                    MIN(timestamp) as oldest_record,
                    MAX(timestamp) as newest_record,
                    AVG(laeq) as avg_laeq,
                    MAX(laeq) as max_laeq,
                    MIN(laeq) as min_laeq,
                    AVG(la10) as avg_la10,
                    AVG(la90) as avg_la90
                FROM ${tableName}
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            `);
            
            console.log('Data stats:', stats[0]);
            return stats[0];
        } catch (error) {
            console.error('Error getting data stats:', error);
            throw error;
        }
    }

    async updateMonitorSyncStatus(monitorId, status) {
        const connection = await pool.getConnection();
        try {
            await connection.query(`
                UPDATE monitors
                SET last_sync_time = NOW(), sync_status = ?
                WHERE monitor_id = ?
            `, [status, monitorId]);
        } finally {
            connection.release();
        }
    }
    
}

export default new MonitorDAO();