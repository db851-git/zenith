import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    updateProfile,
} from "firebase/auth";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth } from "../firebaseConfig";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleAuth = async () => {
    if (!email || !password || (!isLogin && !name)) {
      return Alert.alert("Error", "Please fill in all fields");
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password,
        );
        await updateProfile(userCredential.user, { displayName: name });
      }
      // Go back to the main dashboard after successful login
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Auth Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
        <Ionicons name="close" size={28} color="#111827" />
      </TouchableOpacity>

      <View style={styles.formCard}>
        <Text style={styles.title}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </Text>
        <Text style={styles.subtitle}>
          {isLogin
            ? "Log in to sync your tasks and notes"
            : "Join us to start organizing your life"}
        </Text>

        {!isLogin && (
          <View style={styles.inputGroup}>
            <Ionicons
              name="person-outline"
              size={20}
              color="#6b7280"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={name}
              onChangeText={setName}
            />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Ionicons
            name="mail-outline"
            size={20}
            color="#6b7280"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputGroup}>
          <Ionicons
            name="lock-closed-outline"
            size={20}
            color="#6b7280"
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        <TouchableOpacity
          style={styles.mainBtn}
          onPress={handleAuth}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.mainBtnText}>
              {isLogin ? "Login" : "Sign Up"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setIsLogin(!isLogin)}
          style={styles.switchBtn}
        >
          <Text style={styles.switchText}>
            {isLogin
              ? "Don't have an account? Sign Up"
              : "Already have an account? Login"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    padding: 20,
  },
  closeBtn: { position: "absolute", top: 50, right: 20, zIndex: 10 },
  formCard: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
    marginTop: 5,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, height: 50, color: "#111827", fontWeight: "500" },
  mainBtn: {
    backgroundColor: "#111827",
    height: 55,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  mainBtnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  switchBtn: { marginTop: 20, alignItems: "center" },
  switchText: { color: "#4b5563", fontWeight: "500" },
});
