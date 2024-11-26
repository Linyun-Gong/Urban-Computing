import NoiseMonitoringApp from './app.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, starting application...');
    window.app = new NoiseMonitoringApp();
});