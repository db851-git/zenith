import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

interface Task {
  id: string;
  title: string;
  description?: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  customColor?: string;
  targetDate: string;
  status: string;
  userId: string;
  startTime?: string;
  endTime?: string;
  createdAt: any;
}

const BG_COLORS = [
  "#ffffff",
  "#fef2f2",
  "#f0fdf4",
  "#eff6ff",
  "#fff7ed",
  "#faf5ff",
];
const STORAGE_KEY = "@zenith_tasks_cache";

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tagline, setTagline] = useState("Let's be productive.");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Work");
  const [customCategory, setCustomCategory] = useState("");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [selectedBgColor, setSelectedBgColor] = useState(BG_COLORS[0]);
  const [targetDate, setTargetDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(
    new Date(new Date().getTime() + 60 * 60 * 1000),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);

  const saveTasksLocally = async (newTasks: Task[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newTasks));
    } catch (e) {}
  };

  const loadTasksLocally = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
      if (jsonValue != null) setTasks(JSON.parse(jsonValue));
    } catch (e) {}
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "High":
        return "#dc2626";
      case "Medium":
        return "#d97706";
      case "Low":
        return "#2563eb";
      default:
        return "#4b5563";
    }
  };

  const getCategoryDefaultBg = (cat: string) => {
    switch (cat) {
      case "Work":
        return "#eff6ff";
      case "Study":
        return "#fefce8";
      case "Personal":
        return "#f0fdf4";
      default:
        return "#ffffff";
    }
  };

  const getDayLabel = (dateString: string) => {
    if (!dateString) return "Inbox";
    const d = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dStr = d.toDateString();
    const tStr = today.toDateString();
    const tomStr = tomorrow.toDateString();
    if (dStr === tStr) return "Today";
    if (dStr === tomStr) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const groupedTasks = tasks.reduce((acc: any, task) => {
    const dateObj = new Date(task.targetDate);
    const key = task.targetDate ? dateObj.toISOString().split("T")[0] : "Inbox";
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const sortedDates = Object.keys(groupedTasks).sort();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (!currentUser) {
        setTasks([]);
        AsyncStorage.removeItem(STORAGE_KEY);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    loadTasksLocally();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((document) => {
        const data = document.data();
        taskList.push({
          id: document.id,
          title: data.title,
          description: data.description,
          category: data.category,
          priority: data.priority || "Medium",
          customColor: data.customColor,
          targetDate: data.targetDate || new Date().toISOString(),
          status: data.status,
          userId: data.userId,
          startTime: data.startTime,
          endTime: data.endTime,
          createdAt: data.createdAt,
        });
      });
      taskList.sort((a, b) => {
        const dateA = new Date(a.targetDate).getTime();
        const dateB = new Date(b.targetDate).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setTasks(taskList);
      saveTasksLocally(taskList);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubUser = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists() && docSnap.data().tagline)
        setTagline(docSnap.data().tagline);
    });
    return () => unsubUser();
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (auth.currentUser) setUser({ ...auth.currentUser });
    }, []),
  );

  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Error", "Please fill in all fields");
    try {
      if (isLoginMode) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      Alert.alert("Authentication Error", e.message);
    }
  };

  const openAddModal = () => {
    setEditingTaskId(null);
    setTitle("");
    setDescription("");
    setCategory("Work");
    setCustomCategory("");
    setPriority("Medium");
    setSelectedBgColor(BG_COLORS[0]);
    setTargetDate(new Date());
    setStartTime(new Date());
    setEndTime(new Date(new Date().getTime() + 60 * 60 * 1000));
    setModalVisible(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setSelectedBgColor(task.customColor || BG_COLORS[0]);
    if (task.targetDate) setTargetDate(new Date(task.targetDate));
    if (["Work", "Study", "Personal"].includes(task.category)) {
      setCategory(task.category);
      setCustomCategory("");
    } else {
      setCategory("Custom");
      setCustomCategory(task.category);
    }
    setStartTime(task.startTime ? new Date(task.startTime) : new Date());
    setEndTime(task.endTime ? new Date(task.endTime) : new Date());
    setModalVisible(true);
  };

  const saveTaskToCloud = async () => {
    if (!title.trim()) return Alert.alert("Error", "Please enter a title");
    const finalCategory =
      category === "Custom" ? customCategory.trim() || "Custom" : category;
    let finalBgColor = selectedBgColor;
    if (selectedBgColor === "#ffffff")
      finalBgColor = getCategoryDefaultBg(finalCategory);
    const taskData = {
      title,
      description,
      category: finalCategory,
      priority,
      customColor: finalBgColor,
      targetDate: targetDate.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      userId: user.uid,
    };
    try {
      if (editingTaskId)
        await updateDoc(doc(db, "tasks", editingTaskId), taskData);
      else
        await addDoc(collection(db, "tasks"), {
          ...taskData,
          status: "Pending",
          createdAt: new Date(),
        });
      setModalVisible(false);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    try {
      const newStatus = current === "Pending" ? "Completed" : "Pending";
      await updateDoc(doc(db, "tasks", id), { status: newStatus });
    } catch (e) {}
  };

  const deleteTask = (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDoc(doc(db, "tasks", id)),
      },
    ]);
  };

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loginContainer}>
          <Text style={styles.loginTitle}>Zenith</Text>
          <Text style={styles.loginSubtitle}>
            {isLoginMode ? "Sign in to sync" : "Create an account"}
          </Text>
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            placeholderTextColor="#9ca3af"
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
            <Text style={styles.authButtonText}>
              {isLoginMode ? "Log In" : "Sign Up"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)}>
            <Text style={styles.switchText}>
              {isLoginMode
                ? "New here? Create account"
                : "Have an account? Log in"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pendingCount = tasks.filter((t) => t.status === "Pending").length;
  const progress = tasks.length
    ? Math.round(((tasks.length - pendingCount) / tasks.length) * 100)
    : 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Hi, {user.displayName || "User"}
            </Text>
            <Text style={styles.subGreeting}>{tagline}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/profile")}>
            {user.photoURL ? (
              <Image
                source={{ uri: user.photoURL }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Progress</Text>
            <Text style={styles.statValue}>{progress}%</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Pending</Text>
            <Text style={styles.statValue}>{pendingCount}</Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
          {sortedDates.length === 0 ? (
            <Text
              style={{ textAlign: "center", marginTop: 40, color: "#9ca3af" }}
            >
              No tasks yet. Tap + to add one!
            </Text>
          ) : (
            sortedDates.map((dateKey) => (
              <View key={dateKey} style={{ marginBottom: 20 }}>
                <Text style={styles.dateHeader}>{getDayLabel(dateKey)}</Text>
                {groupedTasks[dateKey].map((task: Task) => {
                  const isDone = task.status === "Completed";
                  const bgColor = task.customColor || "#ffffff";
                  const priColor = getPriorityColor(task.priority);
                  return (
                    <View
                      key={task.id}
                      style={[
                        styles.taskCard,
                        {
                          backgroundColor: isDone ? "#f9fafb" : bgColor,
                          borderColor: "#e5e7eb",
                        },
                        isDone && { opacity: 0.6 },
                      ]}
                    >
                      <TouchableOpacity
                        style={[
                          styles.circle,
                          isDone && {
                            backgroundColor: "#111827",
                            borderColor: "#111827",
                          },
                        ]}
                        onPress={() => toggleStatus(task.id, task.status)}
                        activeOpacity={0.6}
                      >
                        {isDone && (
                          <Ionicons name="checkmark" size={14} color="#fff" />
                        )}
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                          }}
                        >
                          <Text
                            style={[
                              styles.taskTitle,
                              isDone && {
                                textDecorationLine: "line-through",
                                color: "#9ca3af",
                              },
                            ]}
                          >
                            {task.title}
                          </Text>
                        </View>
                        {task.description ? (
                          <Text style={styles.taskDesc} numberOfLines={2}>
                            {task.description}
                          </Text>
                        ) : null}
                        <View style={styles.metaRow}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: priColor,
                              marginRight: 8,
                            }}
                          >
                            {task.priority}
                          </Text>
                          <View style={styles.catBadge}>
                            <Text
                              style={{
                                fontSize: 10,
                                fontWeight: "600",
                                color: "#4b5563",
                              }}
                            >
                              {task.category}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => openEditModal(task)}
                        style={styles.iconBtn}
                      >
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#6b7280"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteTask(task.id)}
                        style={styles.iconBtn}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={styles.fab} onPress={openAddModal}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      </View>
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingTaskId ? "Edit Task" : "New Task"}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="Task Name"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 60 }]}
                placeholder="Details..."
                value={description}
                onChangeText={setDescription}
                multiline
                placeholderTextColor="#9ca3af"
              />
              <Text style={styles.label}>Date & Time</Text>
              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#4b5563" />
                  <Text style={{ fontSize: 16, color: "#111827" }}>
                    {targetDate.toDateString()}
                  </Text>
                </TouchableOpacity>
                <View style={styles.timeRow}>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={styles.timeLabel}>
                      {startTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                  <Text>-</Text>
                  <TouchableOpacity
                    style={styles.timeBtn}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={styles.timeLabel}>
                      {endTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {showDatePicker && (
                <DateTimePicker
                  value={targetDate}
                  mode="date"
                  onChange={(e, d) => {
                    setShowDatePicker(false);
                    if (d) setTargetDate(d);
                  }}
                />
              )}
              {showStartPicker && (
                <DateTimePicker
                  value={startTime}
                  mode="time"
                  onChange={(e, d) => {
                    setShowStartPicker(false);
                    if (d) setStartTime(d);
                  }}
                />
              )}
              {showEndPicker && (
                <DateTimePicker
                  value={endTime}
                  mode="time"
                  onChange={(e, d) => {
                    setShowEndPicker(false);
                    if (d) setEndTime(d);
                  }}
                />
              )}
              <Text style={styles.label}>Priority</Text>
              <View style={styles.catRow}>
                {["High", "Medium", "Low"].map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setPriority(p as any)}
                    style={[
                      styles.pill,
                      priority === p && {
                        backgroundColor: "#f3f4f6",
                        borderColor: "#111827",
                        borderWidth: 1,
                      },
                    ]}
                  >
                    <Text
                      style={{ color: getPriorityColor(p), fontWeight: "bold" }}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Category</Text>
              <View style={styles.catRow}>
                {["Work", "Study", "Personal", "Custom"].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[styles.pill, category === cat && styles.pillActive]}
                  >
                    <Text
                      style={{ color: category === cat ? "#fff" : "#4b5563" }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {category === "Custom" && (
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="Category Name..."
                  value={customCategory}
                  onChangeText={setCustomCategory}
                />
              )}
              <Text style={styles.label}>Custom Card Background</Text>
              <View style={styles.colorRow}>
                {BG_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      selectedBgColor === c && styles.colorSelected,
                    ]}
                    onPress={() => setSelectedBgColor(c)}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveTaskToCloud}
              >
                <Text style={styles.saveButtonText}>
                  {editingTaskId ? "Update Task" : "Save Task"}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, padding: 20 },
  loginContainer: { flex: 1, justifyContent: "center", padding: 20 },
  loginTitle: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  loginSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 30,
  },
  switchText: { textAlign: "center", color: "#2563eb", marginTop: 15 },
  header: {
    marginBottom: 20,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: { fontSize: 24, fontWeight: "bold", color: "#111827" },
  subGreeting: { color: "#6b7280", fontSize: 14 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    elevation: 2,
  },
  statLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 4,
  },
  dateHeader: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 10,
    marginTop: 10,
  },
  taskCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  taskTitle: {
    fontWeight: "600",
    fontSize: 16,
    color: "#111827",
    marginBottom: 4,
  },
  taskDesc: { fontSize: 13, color: "#6b7280", marginBottom: 8, lineHeight: 18 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  catBadge: {
    backgroundColor: "#fff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  iconBtn: { padding: 8 },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", color: "#111827" },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 6,
    marginTop: 15,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#f9fafb",
  },
  dateInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f9fafb",
  },
  timeRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  timeBtn: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  timeLabel: { fontSize: 14, fontWeight: "600", color: "#4b5563" },
  catRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  pillActive: { backgroundColor: "#111827" },
  colorRow: { flexDirection: "row", gap: 12 },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  colorSelected: { borderWidth: 3, borderColor: "#111827" },
  authButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  authButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  saveButton: {
    backgroundColor: "#111827",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 30,
    marginBottom: 40,
  },
  saveButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
