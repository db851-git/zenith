import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { auth, db } from "../../firebaseConfig";

// --- FORCE FIX: Use 'as any' to silence the strict type checker ---
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
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

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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

  const scheduleAlarm = async (task: Task) => {
    if (!task.startTime)
      return Alert.alert("No Time", "This task has no start time.");

    const triggerDate = new Date(task.startTime);
    const now = new Date();

    if (triggerDate < now) {
      return Alert.alert("Oops", "Cannot set alarm for a time in the past!");
    }

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "⏰ It's time!",
          body: `Start working on: ${task.title}`,
          sound: true,
        },
        // --- FORCE FIX: Silence the Date error ---
        trigger: triggerDate as any,
      });
      Alert.alert(
        "Alarm Set",
        `Notifying you at ${formatTime(task.startTime)}`,
      );
    } catch (e: any) {
      Alert.alert("Error", "Could not set alarm. " + e.message);
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
      <View style={styles.center}>
        <Text>Please Log In</Text>
      </View>
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
                          onPress={() => scheduleAlarm(task)}
                          style={styles.iconBtn}
                        >
                          <Ionicons
                            name="notifications-outline"
                            size={20}
                            color="#111827"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
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
});
