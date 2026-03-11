import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import React, { useEffect, useState } from "react";
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth } from "../../firebaseConfig";

export default function ProfileTab() {
  const router = useRouter();
  const user = auth.currentUser;

  const [name, setName] = useState(user?.displayName || "");
  const [isEditingName, setIsEditingName] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // --- LOAD LOCAL AVATAR ON STARTUP ---
  useEffect(() => {
    const loadAvatar = async () => {
      if (user) {
        // Look in the phone's local memory for an image linked to this user's ID
        const savedImageUri = await AsyncStorage.getItem(`avatar_${user.uid}`);
        if (savedImageUri) {
          setLocalAvatar(savedImageUri);
        }
      }
    };
    loadAvatar();
  }, [user]);

  // --- LOGOUT ---
  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // --- PASSWORD RESET ---
  const handleResetPassword = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert("Email Sent", "Check your inbox for a password reset link.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // --- UPDATE NAME (Saves to Firebase Auth) ---
  const handleSaveName = async () => {
    if (!user || !name.trim()) return;
    try {
      await updateProfile(user, { displayName: name });
      setIsEditingName(false);
      Alert.alert("Success", "Profile name updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // --- UPLOAD PROFILE PICTURE (Saves Locally) ---
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && user) {
      const imageUri = result.assets[0].uri;

      // 1. Update the screen immediately
      setLocalAvatar(imageUri);

      // 2. Save the image path to the phone's local storage
      await AsyncStorage.setItem(`avatar_${user.uid}`, imageUri);

      Alert.alert("Success", "Profile picture saved locally to this device!");
    }
  };

  // --- GUEST VIEW (If not logged in) ---
  if (!user) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <View style={styles.profileHeader}>
          <Ionicons name="person-circle-outline" size={100} color="#9ca3af" />
          <Text style={styles.userName}>Guest Account</Text>
          <Text style={{ color: "#6b7280", marginTop: 10 }}>
            Please log in to manage your profile.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.loginBtn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginBtnText}>Sign In / Sign Up</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // --- LOGGED IN VIEW ---
  return (
    <View style={styles.container}>
      <View style={styles.profileHeader}>
        {/* AVATAR SECTION */}
        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
          {localAvatar ? (
            <Image source={{ uri: localAvatar }} style={styles.avatarLarge} />
          ) : (
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>
                {user.displayName?.charAt(0).toUpperCase() || "U"}
              </Text>
            </View>
          )}
          <View style={styles.editIconBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* NAME SECTION */}
        {isEditingName ? (
          <View style={styles.editNameContainer}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TouchableOpacity onPress={handleSaveName} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.nameRow}>
            <Text style={styles.userName}>{user.displayName || "User"}</Text>
            <TouchableOpacity
              onPress={() => setIsEditingName(true)}
              style={styles.editNameIcon}
            >
              <Ionicons name="pencil" size={18} color="#6b7280" />
            </TouchableOpacity>
          </View>
        )}

        {/* EMAIL (Read Only) */}
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      <View style={styles.menuSection}>
        {/* RESET PASSWORD BUTTON */}
        <TouchableOpacity style={styles.menuItem} onPress={handleResetPassword}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="lock-closed-outline" size={24} color="#4b5563" />
            <Text style={styles.menuItemText}>Reset Password</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
        </TouchableOpacity>

        {/* LOGOUT BUTTON */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#ef4444" />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 20 },
  profileHeader: { alignItems: "center", marginTop: 40, marginBottom: 30 },

  avatarContainer: { position: "relative", marginBottom: 20 },
  avatarLarge: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: { color: "#fff", fontSize: 40, fontWeight: "bold" },
  editIconBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2563eb",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#f9fafb",
  },

  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  userName: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  editNameIcon: { marginLeft: 10, padding: 5 },

  editNameContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  nameInput: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    paddingVertical: 5,
    minWidth: 150,
    textAlign: "center",
  },
  saveBtn: {
    marginLeft: 10,
    backgroundColor: "#111827",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  saveBtnText: { color: "#fff", fontWeight: "bold", fontSize: 12 },

  userEmail: { fontSize: 16, color: "#6b7280" },

  menuSection: { marginTop: 20 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 1,
  },
  menuItemLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  menuItemText: { fontSize: 16, fontWeight: "600", color: "#374151" },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
    marginTop: 10,
  },
  logoutText: { color: "#ef4444", fontSize: 18, fontWeight: "bold" },

  loginBtn: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 30,
  },
  loginBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
