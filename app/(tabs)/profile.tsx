import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
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

  // Stats State
  const [completedCount, setCompletedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUser(currentUser);
      setDisplayName(currentUser.displayName || "");

      // 1. Listen to User Profile Changes (Tagline)
      const unsubUser = onSnapshot(
        doc(db, "users", currentUser.uid),
        (docSnap) => {
          if (docSnap.exists()) {
            setTagline(docSnap.data().tagline || "");
          }
        },
      );

      // 2. Listen to Task Changes (REAL-TIME STATS)
      const q = query(
        collection(db, "tasks"),
        where("userId", "==", currentUser.uid),
      );
      const unsubTasks = onSnapshot(q, (querySnapshot) => {
        let done = 0;
        let pending = 0;
        querySnapshot.forEach((doc) => {
          if (doc.data().status === "Completed") done++;
          else pending++;
        });
        setCompletedCount(done);
        setPendingCount(pending);
      });

      // Cleanup listeners when leaving the screen
      return () => {
        unsubUser();
        unsubTasks();
      };
    }
  }, []);

  // Calculate Level based on tasks
  const getLevel = () => {
    if (completedCount > 50) return { title: "Grandmaster", color: "#7c3aed" }; // Purple
    if (completedCount > 20) return { title: "Achiever", color: "#059669" }; // Green
    if (completedCount > 5) return { title: "Hustler", color: "#d97706" }; // Orange
    return { title: "Novice", color: "#6b7280" }; // Grey
  };

  const level = getLevel();

  const pickImage = async () => {
    if (!isEditing) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      updatePhoto(result.assets[0].uri);
    }
  };

  const updatePhoto = async (uri: string) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await updateProfile(auth.currentUser, { photoURL: uri });
      setUser({ ...auth.currentUser, photoURL: uri });
      Alert.alert("Success", "Profile photo updated!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = async () => {
    if (!auth.currentUser) return;
    Alert.alert("Remove Photo", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await updateProfile(auth.currentUser!, { photoURL: "" });
            setUser({ ...auth.currentUser, photoURL: "" });
          } catch (error: any) {
            Alert.alert("Error", error.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const toggleEditMode = async () => {
    if (isEditing) await saveProfile();
    else setIsEditing(true);
  };

  const saveProfile = async () => {
    if (!auth.currentUser) return;
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
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={toggleEditMode} style={styles.editBtn}>
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.editBtnText}>
                {isEditing ? "Save Done" : "Edit Profile"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
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
                <View style={styles.cameraIcon}>
                  <Ionicons name="camera" size={16} color="#fff" />
                </View>
              )}
            </TouchableOpacity>

            {isEditing && user?.photoURL && (
              <TouchableOpacity
                onPress={removePhoto}
                style={styles.removeTextBtn}
              >
                <Text
                  style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}
                >
                  Remove Photo
                </Text>
              </TouchableOpacity>
            )}

            {/* Level Badge */}
            <View style={[styles.levelBadge, { backgroundColor: level.color }]}>
              <Ionicons name="trophy" size={12} color="#fff" />
              <Text style={styles.levelText}>{level.title}</Text>
            </View>
          </View>

          {/* Productivity Stats Row */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{completedCount}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{pendingCount}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.dividerVertical} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{completedCount * 25}m</Text>
              <Text style={styles.statLabel}>Focus Time</Text>
            </View>
          </View>
        </View>

        {/* Info Form */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Account Details</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Display Name</Text>
            <TextInput
              style={[styles.input, isEditing ? styles.inputEditable : null]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your Name"
              editable={isEditing}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, { color: "#6b7280" }]}
              value={user?.email}
              editable={false}
            />
          </View>

          <View style={[styles.inputGroup, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Productivity Mantra</Text>
            <TextInput
              style={[styles.input, isEditing ? styles.inputEditable : null]}
              value={tagline}
              onChangeText={setTagline}
              placeholder="e.g. Stay Focused."
              editable={isEditing}
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Settings</Text>
        </View>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handlePasswordReset}
          >
            <View style={[styles.iconBox, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="key-outline" size={20} color="#2563eb" />
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 30,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#111827" },
  editBtn: {
    backgroundColor: "#111827",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  editBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarSection: { alignItems: "center", marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#111827",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
  },
  removeTextBtn: { marginTop: 10 },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 15,
    gap: 5,
  },
  levelText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
    textTransform: "uppercase",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 20,
  },
  statBox: { alignItems: "center" },
  statNumber: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  dividerVertical: { width: 1, backgroundColor: "#f3f4f6", height: "100%" },
  sectionTitleRow: { marginBottom: 10, paddingHorizontal: 5 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 15,
  },
  label: { fontSize: 12, fontWeight: "600", color: "#6b7280", marginBottom: 6 },
  input: { fontSize: 16, color: "#111827", paddingVertical: 5 },
  inputEditable: {
    backgroundColor: "#f9fafb",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  actionRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  actionText: { flex: 1, fontSize: 16, fontWeight: "500", color: "#111827" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 10 },
});
