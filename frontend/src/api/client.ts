import axios from 'axios';

const defaultProdUrl = 'https://hospital-calcution.onrender.com';
const rawApiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? defaultProdUrl : '');
const baseURL = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/+$/, '')}/api`)
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

export default api;
