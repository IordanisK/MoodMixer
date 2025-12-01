// frontend/src/api/client.ts
import axios, { AxiosRequestHeaders } from "axios";
import { Platform } from "react-native";
import { auth } from "../firebase";

const baseURL =
  Platform.OS === "android"
    ? "http://10.0.2.2:4000" // Android emulator
    : "http://127.0.0.1:4000"; // iOS simulator + Web

// If you later test on a real device, change baseURL to your machine IP:
// const baseURL = "http://192.168.xx.xx:4000";

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
