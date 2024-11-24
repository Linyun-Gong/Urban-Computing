const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();


app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const TARGET_API = 'https://data.smartdublin.ie/sonitus-api';

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.post('/api/monitors', async (req, res) => {
    try {
        console.log('Monitors request body:', req.body);
        
        const response = await axios.post(`${TARGET_API}/api/monitors`, req.body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('Monitors response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Monitors error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

app.post('/api/data', async (req, res) => {
    try {
        console.log('Data request body:', req.body);
        
        const response = await axios.post(`${TARGET_API}/api/data`, req.body, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        
        console.log('Data response:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Data error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
});

app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: error.message
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
    console.log(`Proxying requests to ${TARGET_API}`);
});