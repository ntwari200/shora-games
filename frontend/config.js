// API Configuration for different environments
const getApiUrl = () => {
    // Check if we're on Render (production)
    if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('127.0.0.1')) {
        // Replace with your Render backend URL after deployment
        return 'https://shora-backend.onrender.com/api';
    }
    // Local development
    return 'http://localhost:5000/api';
};

const API_URL = getApiUrl();