import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Platform } from "react-native";
import { useAuth, AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import AuthScreen from "./screens/AuthScreen";
import RoomDetailScreen from "./screens/RoomDetailScreen";
import RoomListScreen from "./screens/RoomListScreen";

export type RootStackParamList = {
  Rooms: undefined;
  RoomDetail: { slug: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
  prefixes: Platform.OS === "web" ? ["/"] : [],
  config: {
    screens: {
      Rooms: "rooms",
      RoomDetail: "room/:slug",
    },
  },
};

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="Rooms" component={RoomListScreen} />
          <Stack.Screen
            name="RoomDetail"
            component={RoomDetailScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      ) : (
        // when not logged in, show auth screen
        <AuthScreen />
      )}
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </AuthProvider>
  );
}
