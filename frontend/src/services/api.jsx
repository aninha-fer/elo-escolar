import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      error.code !== 'ERR_CANCELED'
      console.error('Erro de rede ou servidor indisponível.');
    }
    return Promise.reject(error);
  }
);