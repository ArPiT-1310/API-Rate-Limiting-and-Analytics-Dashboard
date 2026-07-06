import axiosInstance from './axiosInstance';

export const getProjectsApi = async () => {
  const response = await axiosInstance.get('/projects');
  return response.data;
};

export const getProjectByIdApi = async (id) => {
  const response = await axiosInstance.get(`/projects/${id}`);
  return response.data;
};

export const createProjectApi = async (projectData) => {
  const response = await axiosInstance.post('/projects', projectData);
  return response.data;
};

export const updateProjectApi = async (id, projectData) => {
  const response = await axiosInstance.patch(`/projects/${id}`, projectData);
  return response.data;
};

export const deleteProjectApi = async (id) => {
  const response = await axiosInstance.delete(`/projects/${id}`);
  return response.data;
};

export const regenerateApiKeyApi = async (id) => {
  const response = await axiosInstance.post(`/projects/${id}/regenerate-key`);
  return response.data;
};
