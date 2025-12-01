// frontend/src/api/client.ts
import axios, { AxiosRequestHeaders } from "axios";
import { Platform } from "react-native";
import { auth } from "../firebase";

// Use environment variable for production, fallback to localhost for development
const getBaseURL = () => {
  // Check for environment variable (set during build)
  if (typeof process !== "undefined" && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  
  // Development URLs
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000"; // Android emulator
  }
  
  return "http://127.0.0.1:4000"; // iOS simulator + Web
};

const baseURL = getBaseURL();

const api = axios.create({ baseURL });

api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers = {
    ...(config.headers || {}),
    Authorization: `Bearer ${token}`,
  } as AxiosRequestHeaders;
  }
  return config;
});

export default api;
