import { Ionicons } from "@expo/vector-icons";
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
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { auth, db } from "../../firebaseConfig";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

interface Item {
  id: string;
  type: "task" | "note";
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

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // RENAME: "Notes" instead of "Brain Notes"
  const [activeTab, setActiveTab] = useState<"Tasks" | "Notes">("Tasks");
  const [alarmModalVisible, setAlarmModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Item | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setItems([]);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "tasks"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: Item[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data();
        list.push({ id: doc.id, ...d } as Item);
      });
      setItems(list);
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  // --- ACTIONS ---
  const handleAddPress = () => {
    // PASS THE CORRECT TYPE
    // If activeTab is 'Notes', we send type='note'
    const targetType = activeTab === "Notes" ? "note" : "task";

    router.push({
      pathname: "/add",
      params: { type: targetType },
    });
  };

  const handleEditPress = (item: Item) => {
    router.push({
      pathname: "/add",
      params: {
        id: item.id,
        type: item.type,
        title: item.title,
        description: item.description,
        category: item.category,
        priority: item.priority,
        targetDate: item.targetDate,
        startTime: item.startTime,
        endTime: item.endTime,
      },
    });
  };

  const toggleStatus = async (id: string, current: string) => {
    Vibration.vibrate(50);
    const newStatus = current === "Pending" ? "Completed" : "Pending";
    await updateDoc(doc(db, "tasks", id), { status: newStatus });
  };

  const deleteItem = async (id: string) => {
    Alert.alert("Delete", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteDoc(doc(db, "tasks", id)),
      },
    ]);
  };

  const openAlarmOptions = (task: Item) => {
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

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Reminder",
          body: selectedTask.title,
          sound: true,
        } as any,
        trigger: {
          seconds: Math.max(
            Math.floor((triggerDate.getTime() - now.getTime()) / 1000),
            2,
          ),
        } as any,
      });
      Alert.alert("Success", "Alarm set!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // --- SMART DATE HEADER (TODAY / TOMORROW) ---

  const formatDayDate = (isoString: string) => {
    const targetDate = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Bulletproof local timezone comparison
    if (targetDate.toDateString() === today.toDateString()) return "TODAY";
    if (targetDate.toDateString() === tomorrow.toDateString())
      return "TOMORROW";

    // Regular Format
    const dayNum = targetDate.getDate();
    const month = targetDate
      .toLocaleDateString("en-US", { month: "short" })
      .toUpperCase();
    const dayName = targetDate
      .toLocaleDateString("en-US", { weekday: "long" })
      .toUpperCase();
    return `${dayName}, ${month} ${dayNum}`;
  };

  const groupItemsByDate = (itemsToGroup: Item[]) => {
    const grouped: { [key: string]: Item[] } = {};

    itemsToGroup.forEach((item) => {
      const d = new Date(item.targetDate);
      const dateKey = d.toDateString();

      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(item);
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Sort: Today -> Tomorrow -> Future Dates -> Past Dates (at the bottom)
    return Object.keys(grouped)
      .sort((a, b) => {
        const timeA = new Date(a).getTime();
        const timeB = new Date(b).getTime();

        const isPastA = timeA < todayTime;
        const isPastB = timeB < todayTime;

        if (isPastA && !isPastB) return 1; // Push old dates down
        if (!isPastA && isPastB) return -1; // Keep new dates up

        return timeA - timeB; // Sort the rest normally
      })
      .map((dateKey) => ({
        title: formatDayDate(dateKey),
        data: grouped[dateKey],
      }));
  };

  const filteredItems = items.filter((i) => {
    const isNote = i.type === "note";
    return activeTab === "Tasks" ? !isNote : isNote;
  });

  // --- NEW: CALCULATE STATS FOR TODAY ONLY ---
  const todayStr = new Date().toDateString();
  const todaysTasks = items.filter(
    (i) =>
      i.type !== "note" && new Date(i.targetDate).toDateString() === todayStr,
  );

  const pendingCount = todaysTasks.filter((i) => i.status === "Pending").length;
  const totalTasks = todaysTasks.length;
  const progress = totalTasks
    ? Math.round(((totalTasks - pendingCount) / totalTasks) * 100)
    : 0;

  const groupedTasks =
    activeTab === "Tasks" ? groupItemsByDate(filteredItems) : null;
  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  if (!user)
    return (
      <View style={styles.center}>
        <Text>Please login via Profile</Text>
      </View>
    );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {/* HEADER */}
          {/* HEADER */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.dateText}>
                {new Date()
                  .toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                  .toUpperCase()}
              </Text>
              <Text style={styles.greeting}>
                Hello, {user.displayName?.split(" ")[0] || "Dev"} 👋
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/profile")}
              style={styles.profileBtn}
            >
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={28} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Progress</Text>
              <Text style={styles.statValue}>{progress}%</Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending</Text>
              <Text style={styles.statValue}>{pendingCount}</Text>
              <Text style={{ fontSize: 10, color: "#9ca3af" }}>
                Tasks remaining
              </Text>
            </View>
          </View>

          {/* TAB SWITCHER */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              onPress={() => setActiveTab("Tasks")}
              style={[styles.tab, activeTab === "Tasks" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Tasks" && styles.tabTextActive,
                ]}
              >
                My Tasks
              </Text>
            </TouchableOpacity>

            {/* RENAMED TO "NOTES" */}
            <TouchableOpacity
              onPress={() => setActiveTab("Notes")}
              style={[styles.tab, activeTab === "Notes" && styles.tabActive]}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "Notes" && styles.tabTextActive,
                ]}
              >
                Notes
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {activeTab === "Tasks" &&
              groupedTasks &&
              groupedTasks.map((group) => (
                <View key={group.title} style={{ marginBottom: 20 }}>
                  <Text style={styles.dateHeader}>{group.title}</Text>
                  {group.data.map((item) => (
                    <View
                      key={item.id}
                      style={[
                        styles.taskCard,
                        {
                          backgroundColor: "#fff",
                        } /* FIXED: Removed custom background color */,
                        item.status === "Completed" && { opacity: 0.4 },
                      ]}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "flex-start",
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => toggleStatus(item.id, item.status)}
                          style={[
                            styles.checkBox,
                            item.status === "Completed" && styles.checked,
                          ]}
                        >
                          {item.status === "Completed" && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </TouchableOpacity>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                          {/* FIXED: Title and Priority Row */}
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
                                item.status === "Completed" && {
                                  textDecorationLine: "line-through",
                                  opacity: 0.5,
                                },
                                { flex: 1, paddingRight: 10 },
                              ]}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                styles.priorityText,
                                item.priority === "High"
                                  ? { color: "#ef4444" }
                                  : item.priority === "Medium"
                                    ? { color: "#f59e0b" }
                                    : { color: "#3b82f6" },
                              ]}
                            >
                              {item.priority?.toUpperCase() || "MEDIUM"}
                            </Text>
                          </View>

                          {item.description ? (
                            <Text style={styles.taskDesc} numberOfLines={1}>
                              {item.description}
                            </Text>
                          ) : null}
                          {item.startTime && (
                            <View style={styles.metaRow}>
                              <Ionicons
                                name="time-outline"
                                size={12}
                                color="#4b5563"
                              />
                              <Text style={styles.metaText}>
                                {formatTime(item.startTime)} -{" "}
                                {formatTime(item.endTime)}
                              </Text>
                            </View>
                          )}
                          <View
                            style={[
                              styles.catBadge,
                              { backgroundColor: "rgba(255,255,255,0.6)" },
                            ]}
                          >
                            <Text style={styles.catText}>{item.category}</Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.actionRow}>
                        <TouchableOpacity
                          onPress={() => handleEditPress(item)}
                          style={styles.actionBtn}
                        >
                          <Ionicons name="pencil" size={18} color="#4b5563" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => openAlarmOptions(item)}
                          style={styles.actionBtn}
                        >
                          <Ionicons
                            name="notifications"
                            size={18}
                            color="#4b5563"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteItem(item.id)}
                          style={styles.actionBtn}
                        >
                          <Ionicons name="trash" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            {activeTab === "Notes" &&
              filteredItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleEditPress(item)}
                  style={styles.noteCard}
                >
                  <Text style={styles.taskTitle}>{item.title}</Text>
                  <Text style={styles.taskDesc}>{item.description}</Text>
                  <View style={styles.actionRow}>
                    <TouchableOpacity onPress={() => deleteItem(item.id)}>
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#ef4444"
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
          </ScrollView>
        </View>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleAddPress}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={32} color="#fff" />
        </TouchableOpacity>

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
                <Text style={styles.optionText}>At start time</Text>
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
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { flex: 1, padding: 20 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 10,
  },
  dateText: {
    color: "#6b7280",
    fontSize: 13,
    textTransform: "uppercase",
    fontWeight: "600",
  },
  greeting: { fontSize: 24, fontWeight: "800", color: "#111827" },
  profileBtn: { padding: 2 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#111827",
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  statLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600" },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 5,
  },
  progressBar: {
    height: 4,
    backgroundColor: "#f3f4f6",
    borderRadius: 2,
    marginTop: 10,
  },
  progressFill: { height: 4, backgroundColor: "#111827", borderRadius: 2 },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#e5e7eb",
    borderRadius: 15,
    padding: 4,
    marginBottom: 15,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 12 },
  tabActive: {
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: { fontSize: 14, fontWeight: "600", color: "#6b7280" },
  tabTextActive: { color: "#111827" },
  dateHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 10,
    marginTop: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  taskCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#4b5563",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checked: { backgroundColor: "#10b981", borderColor: "#10b981" },
  taskTitle: { fontSize: 16, fontWeight: "700", color: "#1f2937" },
  taskDesc: { fontSize: 13, color: "#4b5563", marginTop: 2 },
  priorityText: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  metaText: { fontSize: 12, color: "#4b5563", fontWeight: "500" },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  catText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1f2937",
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
    gap: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 10,
  },
  actionBtn: { padding: 4 },
  noteCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 65,
    height: 65,
    borderRadius: 32.5,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 8,
    zIndex: 9999,
  },
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyText: { color: "#9ca3af" },
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
});
