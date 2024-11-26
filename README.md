# Noise Monitoring Dashboard
Noise Monitoring Dashboard is a web-based noise monitoring system that analyzes and visualizes data from 19 noise monitoring sites in Dublin, and can display historical and real-time data. The project involves front-end interface, back-end services, database management, and proxy server components.

## API called:
https://data.smartdublin.ie/dataset/sonitus

## Run Command：
### Run the proxy server
1. cd <project location>/noise-monitoring-proxy
2. node server.js

### Run the database server
The AWS RDS database is used here.
1. cd <project location>/db
2. node server.js

### Open the Web
open index.html
