import axios from "axios";

// Get API base URL - works for both Vercel and local development
const getBaseURL = () => {
  if (import.meta.env.MODE === "development") {
    return import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  }
  return import.meta.env.VITE_API_URL || "/api";
};

const api = axios.create({ baseURL: getBaseURL() });

export const itemsAPI = {
  getAll:      (params)   => api.get("/items", { params }),
  getStats:    ()         => api.get("/items/stats"),
  getLogs:     ()         => api.get("/items/logs/recent"),
  create:      (data)     => api.post("/items", data),
  update:      (id, data) => api.put(`/items/${id}`, data),
  updateStock: (id, data) => api.patch(`/items/${id}/stock`, data),
  delete:      (id)       => api.delete(`/items/${id}`),
};

export const voiceAPI = {
  // Stock update (existing item)
  parse: (text, conversationHistory = []) =>
    api.post("/voice/parse", { text, conversationHistory }),

  // New item — understand one turn at a time
  understandItem: (text, currentData = {}) =>
    api.post("/voice/understand-item", { text, currentData }),

  // Legacy parseNewItem kept for backward compat
  parseNewItem: (text, conversationHistory = []) =>
    api.post("/voice/new-item", { text, conversationHistory }),
};

export const billAPI = {
  scan: (formData) => api.post("/bill/scan", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  }),
};

export const alertsAPI = {
  getAll:      ()     => api.get("/alerts"),
  sendSummary: (data) => api.post("/alerts/daily-summary", data),
  sendCustom:  (msg)  => api.post("/alerts/send", { message: msg }),
};

export const creditAPI = {
  list:        ()         => api.get("/credit"),
  addCustomer: (data)     => api.post("/credit/customers", data),
  parse:       (text)     => api.post("/credit/parse", { text }),
  entry:       (data)     => api.post("/credit/entry", data),
  logs:        (id)       => api.get(`/credit/logs/${id}`),
  remind:      (id)       => api.post(`/credit/remind/${id}`),
  settle:      (id)       => api.post(`/credit/settle/${id}`),
};

export const forecastAPI = {
  get:   ()     => api.get("/forecast"),
  draft: (data) => api.post("/forecast/draft", data),
  send:  (data) => api.post("/forecast/send", data),
};

export const botAPI = {
  simulate: (text) => api.post("/webhook/simulate", { text }),
};

export default api;