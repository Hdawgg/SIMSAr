// Every API call the React app makes, grouped by feature. Pages import from
// here instead of writing URLs inline, so the full API surface is in one file.
import api from './client';

const data = (promise) => promise.then((res) => res.data);

export const configApi = {
  get: () => data(api.get('/config')),
};

export const tradesApi = {
  // all=true includes inactive trades, so old jobs and workers still show a name.
  list: (params) => data(api.get('/trades', { params })),
};

export const authApi = {
  login: (body) => data(api.post('/auth/login', body)),
  register: (body) => data(api.post('/auth/register', body)),
  me: () => data(api.get('/auth/me')),
};

export const profileApi = {
  mine: () => data(api.get('/profile/me')),
  update: (body) => data(api.put('/profile/me', body)),
  public: (userId) => data(api.get(`/users/${userId}/profile`)),
  workers: (params) => data(api.get('/workers', { params })),
};

export const jobsApi = {
  list: (params) => data(api.get('/jobs', { params })),
  get: (id) => data(api.get(`/jobs/${id}`)),
  mine: () => data(api.get('/jobs/mine')),
  create: (body) => data(api.post('/jobs', body)),
  update: (id, body) => data(api.put(`/jobs/${id}`, body)),
  close: (id, reason) => data(api.patch(`/jobs/${id}/close`, { reason })),
  applications: (id) => data(api.get(`/jobs/${id}/applications`)),
  apply: (id, coverNote) => data(api.post(`/jobs/${id}/apply`, { coverNote })),
};

export const applicationsApi = {
  mine: () => data(api.get('/applications/mine')),
  accept: (id) => data(api.patch(`/applications/${id}/accept`)),
  reject: (id) => data(api.patch(`/applications/${id}/reject`)),
  start: (id) => data(api.patch(`/applications/${id}/start`)),
  done: (id) => data(api.patch(`/applications/${id}/done`)),
  complete: (id) => data(api.patch(`/applications/${id}/complete`)),
  cancel: (id) => data(api.patch(`/applications/${id}/cancel`)),
};

export const reviewsApi = {
  create: (body) => data(api.post('/reviews', body)),
  forUser: (userId) => data(api.get(`/reviews/user/${userId}`)),
};

export const checksApi = {
  submit: (body) => data(api.post('/background-checks', body)),
  mine: () => data(api.get('/background-checks/mine')),
};

export const itiApi = {
  // body is a FormData with the certificate fields and the file (certificateFile).
  submit: (formData) => data(api.post('/iti-certificates', formData)),
  mine: () => data(api.get('/iti-certificates/mine')),
  // The scan needs the login token, so it is fetched as a Blob rather than linked directly.
  file: (id) => data(api.get(`/iti-certificates/${id}/file`, { responseType: 'blob' })),
};

export const adminApi = {
  stats: () => data(api.get('/admin/stats')),
  users: (params) => data(api.get('/admin/users', { params })),
  setUserActive: (id, isActive) => data(api.patch(`/admin/users/${id}/status`, { isActive })),
  checks: (params) => data(api.get('/admin/background-checks', { params })),
  reviewCheck: (id, body) => data(api.patch(`/admin/background-checks/${id}`, body)),
  itiCertificates: (params) => data(api.get('/admin/iti-certificates', { params })),
  reviewIti: (id, body) => data(api.patch(`/admin/iti-certificates/${id}`, body)),
  trades: () => data(api.get('/admin/trades')),
  createTrade: (body) => data(api.post('/admin/trades', body)),
  updateTrade: (id, body) => data(api.patch(`/admin/trades/${id}`, body)),
  deleteTrade: (id) => data(api.delete(`/admin/trades/${id}`)),
  jobs: (params) => data(api.get('/admin/jobs', { params })),
  closeJob: (id, reason) => data(api.patch(`/admin/jobs/${id}/close`, { reason })),
  deleteJob: (id) => data(api.delete(`/admin/jobs/${id}`)),
};
