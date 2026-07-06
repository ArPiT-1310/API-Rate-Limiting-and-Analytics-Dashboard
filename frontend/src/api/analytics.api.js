import axiosInstance from './axiosInstance';

export const getSummary = async (projectId, range) => {
  const response = await axiosInstance.get(`/projects/${projectId}/analytics/summary`, {
    params: { range },
  });
  return response.data;
};

export const getTimeseries = async (projectId, range) => {
  const response = await axiosInstance.get(`/projects/${projectId}/analytics/timeseries`, {
    params: { range },
  });
  return response.data;
};

export const getStatusBreakdown = async (projectId, range) => {
  const response = await axiosInstance.get(`/projects/${projectId}/analytics/status-breakdown`, {
    params: { range },
  });
  return response.data;
};

export const getLogs = async (projectId, page = 1, limit = 10) => {
  const response = await axiosInstance.get(`/projects/${projectId}/logs`, {
    params: { page, limit },
  });
  return response.data;
};
