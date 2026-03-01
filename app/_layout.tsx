import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* The Main Tabs (Home, Profile) */}
      <Stack.Screen name="(tabs)" />

      {/* The Add Screen (Now a Modal) */}
      <Stack.Screen
        name="add"
        options={{
          presentation: "modal", // Makes it slide up like a proper native app
          headerShown: false,
        }}
      />
    </Stack>
  );
}
