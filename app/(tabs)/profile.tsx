import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

export default function Profile() {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [tagline, setTagline] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Always sync with the real auth user on load
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      setDisplayName(currentUser.displayName || "");

      const fetchUserData = async () => {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) setTagline(userDoc.data().tagline || "");
      };
      fetchUserData();
    }
  }, []);

  const pickImage = async () => {
    if (!isEditing) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      updatePhoto(result.assets[0].uri);
    }
  };

  const updatePhoto = async (uri: string) => {
    if (!auth.currentUser) return; // Use auth.currentUser directly
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { photoURL: uri });
      // Update local state to show change immediately
      setUser({ ...auth.currentUser, photoURL: uri });
      Alert.alert("Success", "Profile photo updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = async () => {
    if (!auth.currentUser) return; // Use auth.currentUser directly

    Alert.alert(
      "Remove Photo",
      "Are you sure you want to remove your profile picture?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              // Passing an empty string removes the photo in Firebase
              await updateProfile(auth.currentUser!, { photoURL: "" });
              // Update local state
              setUser({ ...auth.currentUser, photoURL: "" });
            } catch (error: any) {
              Alert.alert("Error", error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const toggleEditMode = async () => {
    if (isEditing) await saveProfile();
    else setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!auth.currentUser) return; // Use auth.currentUser directly
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { displayName: displayName });
      await setDoc(
        doc(db, "users", auth.currentUser.uid),
        {
          tagline: tagline,
          email: auth.currentUser.email,
        },
        { merge: true },
      );

      setIsEditing(false);
      Alert.alert("Saved", "Profile updated successfully.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      Alert.alert("Email Sent", `Reset link sent to ${user.email}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <ScrollView style={styles.container}>
        <Text style={styles.headerTitle}>My Profile</Text>

        <View style={styles.card}>
          {/* Header with EDIT / DONE Buttons */}
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={toggleEditMode} style={styles.textBtn}>
              {loading ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text
                  style={[
                    styles.btnText,
                    isEditing ? { color: "#059669" } : { color: "#2563eb" },
                  ]}
                >
                  {isEditing ? "Done" : "Edit"}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Profile Picture Section */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={pickImage}
              disabled={!isEditing}
              activeOpacity={isEditing ? 0.7 : 1}
            >
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={40} color="#9ca3af" />
                </View>
              )}

              {isEditing && (
                <View style={styles.editIcon}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {/* Helper Text and REMOVE Button */}
            {isEditing && (
              <View style={{ alignItems: "center", marginTop: 10 }}>
                <Text style={styles.changePhotoText}>Tap photo to change</Text>

                {/* Only show Remove button if a photo actually exists */}
                {user?.photoURL ? (
                  <TouchableOpacity
                    onPress={removePhoto}
                    style={styles.removeBtn}
                  >
                    <Text style={styles.removeBtnText}>Remove Photo</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>

          <Text style={styles.emailText}>{user?.email}</Text>

          {/* Input Fields */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={[
                styles.input,
                isEditing ? styles.inputEditable : styles.inputReadonly,
              ]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#9ca3af"
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>My Tagline</Text>
            <TextInput
              style={[
                styles.input,
                isEditing ? styles.inputEditable : styles.inputReadonly,
              ]}
              value={tagline}
              onChangeText={setTagline}
              placeholder="e.g. Let's be productive."
              placeholderTextColor="#9ca3af"
              editable={isEditing}
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handlePasswordReset}
          >
            <View style={styles.iconBox}>
              <Ionicons name="key-outline" size={20} color="#111827" />
            </View>
            <Text style={styles.actionText}>Reset Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <View style={[styles.iconBox, { backgroundColor: "#fee2e2" }]}>
              <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            </View>
            <Text style={[styles.actionText, { color: "#dc2626" }]}>
              Log Out
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb", padding: 20 },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 20,
    marginTop: 30,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: -10,
    zIndex: 10,
  },

  textBtn: { paddingVertical: 5, paddingHorizontal: 10 },
  btnText: { fontSize: 16, fontWeight: "600" },

  avatarContainer: { alignItems: "center", marginBottom: 15, marginTop: 0 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  editIcon: {
    position: "absolute",
    bottom: 35,
    right: 0,
    backgroundColor: "#111827",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
  },

  changePhotoText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
  removeBtn: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
  },
  removeBtnText: { fontSize: 12, color: "#dc2626", fontWeight: "700" },

  emailText: {
    textAlign: "center",
    color: "#6b7280",
    marginBottom: 25,
    fontSize: 14,
    marginTop: 10,
  },
  inputGroup: { marginBottom: 20 },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 16,
    color: "#111827",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  inputEditable: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  inputReadonly: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 0,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  actionText: { flex: 1, fontSize: 16, fontWeight: "500", color: "#111827" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 5 },
});
