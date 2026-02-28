import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
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
  Vibration,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

// --- Notifications Setup ---
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }) as any,
});

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

const STORAGE_KEY = "@zenith_tasks_cache";

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tagline, setTagline] = useState("Let's be productive.");
  const [tasks, setTasks] = useState<Task[]>([]);

  // Auth State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  // Alarm Modal State
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // --- FOCUS MODE STATE ---
  const [focusModalVisible, setFocusModalVisible] = useState(false);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
  }, []);

  const handleAuth = async () => {
    if (!email || !password)
      return Alert.alert("Error", "Please fill in all fields");
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      Alert.alert("Authentication Failed", e.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimer = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes < 10 ? "0" : ""}${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

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
    async function requestPermissions() {
      await Notifications.requestPermissionsAsync();
    }
    requestPermissions();
  }, []);

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
        const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return timeA - timeB;
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

  // --- FOCUS MODE LOGIC ---
  const startFocusSession = (task: Task) => {
    setFocusTask(task);
    setTimerSeconds(25 * 60);
    setIsActive(false);
    setFocusModalVisible(true);
  };

  // NEW: Function to adjust time
  const adjustTime = (minutes: number) => {
    if (isActive) return; // Don't change if running
    setTimerSeconds((prev) => {
      const newTime = prev + minutes * 60;
      return newTime > 0 ? newTime : 60; // Minimum 1 minute
    });
  };

  const toggleTimer = () => {
    Vibration.vibrate(50);
    setIsActive(!isActive);
  };

  useEffect(() => {
    let interval: any = null;
    if (isActive && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0 && isActive) {
      setIsActive(false);
      Vibration.vibrate([0, 500, 200, 500]);
      Alert.alert("Great Job! 🎉", "You stayed focused!");
    }
    return () => clearInterval(interval);
  }, [isActive, timerSeconds]);

  // --- Alarm Logic ---
  const openAlarmOptions = (task: Task) => {
    if (!task.startTime)
      return Alert.alert("No Time", "This task has no start time.");
    setSelectedTask(task);
    setAlarmModalVisible(true);
  };

  const scheduleAlarm = async (minutesBefore: number) => {
    if (!selectedTask || !selectedTask.startTime) return;
    setAlarmModalVisible(false);

    const taskTime = new Date(selectedTask.startTime);
    const triggerDate = new Date(taskTime.getTime() - minutesBefore * 60000);
    const now = new Date();

    if (triggerDate <= now)
      return Alert.alert("Too Late", "That time has already passed!");

    const secondsUntilAlarm = Math.floor(
      (triggerDate.getTime() - now.getTime()) / 1000,
    );
    const safeSeconds = Math.max(secondsUntilAlarm, 2);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title:
            minutesBefore === 0
              ? "⏰ It's time!"
              : `⏰ Upcoming: ${selectedTask.title}`,
          body: `Start working on: ${selectedTask.title}`,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        } as any,
        trigger: {
          seconds: safeSeconds,
          channelId: "default",
          repeats: false,
        } as any,
      });
      const timeMsg =
        minutesBefore === 0 ? "at start time" : `${minutesBefore} min before`;
      Alert.alert("Alarm Set", `We'll notify you ${timeMsg}.`);
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
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.authContainer}
      >
        <View style={styles.authBox}>
          <Text style={styles.authTitle}>Zenith</Text>
          <Text style={styles.authSubtitle}>
            {isLoginMode ? "Welcome back!" : "Create your account"}
          </Text>
          <TextInput
            style={styles.authInput}
            placeholder="Email Address"
            placeholderTextColor="#9ca3af"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.authInput}
            placeholder="Password"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <TouchableOpacity style={styles.authButton} onPress={handleAuth}>
            {authLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.authButtonText}>
                {isLoginMode ? "Sign In" : "Sign Up"}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsLoginMode(!isLoginMode)}
            style={{ marginTop: 15 }}
          >
            <Text style={styles.switchText}>
              {isLoginMode
                ? "Don't have an account? Sign Up"
                : "Already have an account? Log In"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
            <Text style={styles.greeting}>Hi, {user.displayName || "Deb"}</Text>
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
                        {task.startTime && (
                          <View style={styles.timeRow}>
                            <Ionicons
                              name="time-outline"
                              size={12}
                              color="#6b7280"
                            />
                            <Text style={styles.timeText}>
                              {formatTime(task.startTime)} -{" "}
                              {formatTime(task.endTime)}
                            </Text>
                          </View>
                        )}
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

                      <View style={{ alignItems: "center", gap: 5 }}>
                        <TouchableOpacity
                          onPress={() => openAlarmOptions(task)}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="notifications-outline"
                            size={20}
                            color="#111827"
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          onPress={() => startFocusSession(task)}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="timer-outline"
                            size={20}
                            color="#059669"
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
                    </View>
                  );
                })}
              </View>
            ))
          )}
        </ScrollView>
      </View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={alarmModalVisible}
        onRequestClose={() => setAlarmModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Reminder</Text>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => scheduleAlarm(0)}
            >
              <Text style={styles.optionText}>At time of event</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => scheduleAlarm(15)}
            >
              <Text style={styles.optionText}>15 minutes before</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              onPress={() => scheduleAlarm(30)}
            >
              <Text style={styles.optionText}>30 minutes before</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, { borderBottomWidth: 0 }]}
              onPress={() => setAlarmModalVisible(false)}
            >
              <Text style={[styles.optionText, { color: "#ef4444" }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- NEW: FOCUS MODE MODAL WITH CONTROLS --- */}
      <Modal
        animationType="fade"
        transparent={false}
        visible={focusModalVisible}
        onRequestClose={() => setFocusModalVisible(false)}
      >
        <SafeAreaView style={styles.focusContainer}>
          <View style={styles.focusHeader}>
            <TouchableOpacity
              onPress={() => setFocusModalVisible(false)}
              style={styles.closeFocusBtn}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={styles.focusContent}>
            <Text style={styles.focusLabel}>FOCUSING ON</Text>
            <Text style={styles.focusTaskTitle}>{focusTask?.title}</Text>

            {/* TIMER DISPLAY WITH CONTROLS */}
            <View style={styles.timerWrapper}>
              {/* Minus Button (Only when paused) */}
              {!isActive && (
                <TouchableOpacity
                  onPress={() => adjustTime(-5)}
                  style={styles.adjustBtn}
                >
                  <Ionicons name="remove" size={30} color="#fff" />
                </TouchableOpacity>
              )}

              <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>

              {/* Plus Button (Only when paused) */}
              {!isActive && (
                <TouchableOpacity
                  onPress={() => adjustTime(5)}
                  style={styles.adjustBtn}
                >
                  <Ionicons name="add" size={30} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity style={styles.playPauseBtn} onPress={toggleTimer}>
              <Ionicons
                name={isActive ? "pause" : "play"}
                size={40}
                color="#111827"
              />
            </TouchableOpacity>

            <Text style={styles.focusHint}>
              {isActive ? "Keep going! You got this." : "Set your time & Start"}
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f9fafb",
  },
  authBox: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 5,
  },
  authSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 25,
  },
  authInput: {
    backgroundColor: "#f3f4f6",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    fontSize: 16,
    color: "#000000",
  },
  authButton: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 5,
  },
  authButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  switchText: { textAlign: "center", color: "#2563eb", fontWeight: "600" },
  container: { flex: 1, padding: 20 },
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
    marginBottom: 2,
  },
  taskDesc: { fontSize: 13, color: "#6b7280", marginBottom: 8, lineHeight: 18 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 6,
  },
  timeText: { fontSize: 12, color: "#6b7280", fontWeight: "500" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 5,
  },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    alignItems: "center",
  },
  optionText: { fontSize: 16, color: "#111827", fontWeight: "500" },

  // --- FOCUS MODE STYLES ---
  focusContainer: { flex: 1, backgroundColor: "#111827" },
  focusHeader: { padding: 20, alignItems: "flex-end" },
  closeFocusBtn: { padding: 10 },
  focusContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  focusLabel: {
    color: "#6b7280",
    fontSize: 14,
    letterSpacing: 2,
    fontWeight: "bold",
    marginBottom: 10,
  },
  focusTaskTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 40,
    paddingHorizontal: 20,
  },

  timerWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
    marginBottom: 50,
  },
  timerText: {
    color: "#fff",
    fontSize: 80,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
  },
  adjustBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },

  playPauseBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  focusHint: { color: "#9ca3af", fontSize: 16 },
});
