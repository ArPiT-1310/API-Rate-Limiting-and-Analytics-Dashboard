import axios from 'axios';

let accessToken = null;
let logoutCallback = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const registerLogoutCallback = (cb) => {
  logoutCallback = cb;
};

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Check if error is 401 and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Attempt to refresh the access token
        const refreshBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await axios.post(
          `${refreshBaseUrl}/auth/refresh`,
          {},
          { withCredentials: true }
        );
        
        const newAccessToken = response.data.accessToken;
        setAccessToken(newAccessToken);
        
        // Update header in the original request and retry
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Notify the global callback if set to sync React state
        if (window.__updateAuthToken) {
          window.__updateAuthToken(newAccessToken);
        }
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // If refresh fails, clear token and log out the user
        setAccessToken(null);
        if (logoutCallback) {
          logoutCallback();
        }
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
