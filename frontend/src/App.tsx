import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth, AuthProvider } from "./context/AuthContext";
import AuthScreen from "./screens/AuthScreen";
import RoomDetailScreen from "./screens/RoomDetailScreen";
import RoomListScreen from "./screens/RoomListScreen";


export type RootStackParamList = {
  Rooms: undefined;
  RoomDetail: { roomId: string; roomName: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator>
          <Stack.Screen name="Rooms" component={RoomListScreen} />
          <Stack.Screen
            name="RoomDetail"
            component={RoomDetailScreen}
            options={({ route }) => ({ title: route.params.roomName })}
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
      <AppNavigator />
    </AuthProvider>
  );
}
