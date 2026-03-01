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
  FlatList,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { auth, db } from "../../firebaseConfig";

// --- CONFIG ---
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }) as any,
});

// --- TYPES ---
interface Item {
  id: string;
  type: "task" | "note";
  title: string;
  description?: string;
  category: string;
  priority: "High" | "Medium" | "Low";
  targetDate: string;
  status: string;
  userId: string;
  startTime?: string;
  createdAt: any;
}

export default function Index() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [activeTab, setActiveTab] = useState<"Tasks" | "Notes">("Tasks");
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Focus Mode
  const [focusModalVisible, setFocusModalVisible] = useState(false);
  const [focusItem, setFocusItem] = useState<Item | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);

  // --- 1. SETUP & DATA ---
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

  // --- 2. ACTIONS ---
  const handleAddPress = () => {
    // Navigate to Add Screen, passing the 'type' (task or note)
    router.push({
      pathname: "/add",
      params: { type: activeTab === "Tasks" ? "task" : "note" },
    });
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "Pending" ? "Completed" : "Pending";
    await updateDoc(doc(db, "tasks", id), { status: newStatus });
  };

  const deleteItem = async (id: string) => {
    await deleteDoc(doc(db, "tasks", id));
  };

  // --- 3. SWIPE ACTIONS ---
  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteItem(id)}
      >
        <Ionicons name="trash-outline" size={24} color="#fff" />
        <Text style={styles.actionText}>Delete</Text>
      </TouchableOpacity>
    );
  };

  const renderLeftActions = (id: string, status: string) => {
    return (
      <TouchableOpacity
        style={styles.completeAction}
        onPress={() => toggleStatus(id, status)}
      >
        <Ionicons name="checkmark-circle-outline" size={24} color="#fff" />
        <Text style={styles.actionText}>
          {status === "Pending" ? "Done" : "Undo"}
        </Text>
      </TouchableOpacity>
    );
  };

  // --- 4. HELPERS ---
  const getWeekDates = () => {
    const dates = [];
    const start = new Date();
    start.setDate(start.getDate() - 2);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const filteredItems = items.filter((i) => {
    // If Tab is Tasks -> Show only 'task' type (or undefined for old items)
    // If Tab is Notes -> Show only 'note' type
    const isNote = i.type === "note";

    if (activeTab === "Tasks") {
      if (isNote) return false; // Hide notes
      // Filter by Date for Tasks
      return (
        new Date(i.targetDate).toDateString() === selectedDate.toDateString()
      );
    } else {
      // Notes Tab
      return isNote; // Show all notes, ignore date
    }
  });

  // Sort: High priority first
  filteredItems.sort((a, b) => (a.priority === "High" ? -1 : 1));

  const stats = {
    pending: items.filter((i) => i.status === "Pending" && i.type !== "note")
      .length,
    completed: items.filter((i) => i.status === "Completed").length,
    notes: items.filter((i) => i.type === "note").length,
  };

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
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              <Text style={styles.greeting}>
                Hello, {user.displayName?.split(" ")[0] || "Deb"} 👋
              </Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <Image
                source={{
                  uri: user.photoURL || "https://via.placeholder.com/150",
                }}
                style={styles.avatar}
              />
            </TouchableOpacity>
          </View>

          {/* BENTO GRID */}
          <View style={styles.bentoGrid}>
            <View
              style={[
                styles.bentoCard,
                { backgroundColor: "#111827", flex: 1.2 },
              ]}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="flame" size={20} color="#fff" />
              </View>
              <Text style={styles.bentoNum}>{stats.completed}</Text>
              <Text style={styles.bentoLabel}>Tasks Crushed</Text>
            </View>
            <View
              style={[
                styles.bentoCard,
                {
                  backgroundColor: "#fff",
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "#e5e7eb",
                },
              ]}
            >
              <Ionicons name="documents-outline" size={24} color="#111827" />
              <Text style={[styles.bentoNum, { color: "#111827" }]}>
                {stats.notes}
              </Text>
              <Text style={styles.bentoLabel}>Ideas Saved</Text>
            </View>
          </View>

          {/* HORIZONTAL CALENDAR */}
          <View style={{ height: 90 }}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={getWeekDates()}
              keyExtractor={(item) => item.toISOString()}
              contentContainerStyle={{ paddingHorizontal: 5, gap: 10 }}
              renderItem={({ item }) => {
                const isSelected =
                  item.toDateString() === selectedDate.toDateString();
                return (
                  <TouchableOpacity
                    onPress={() => setSelectedDate(item)}
                    style={[
                      styles.datePill,
                      isSelected && styles.datePillActive,
                    ]}
                  >
                    <Text
                      style={[styles.dayText, isSelected && { color: "#fff" }]}
                    >
                      {item.toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <Text
                      style={[styles.dateNum, isSelected && { color: "#fff" }]}
                    >
                      {item.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
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
                Brain Notes
              </Text>
            </TouchableOpacity>
          </View>

          {/* LIST AREA WITH SWIPE */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {filteredItems.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={40} color="#d1d5db" />
                <Text style={{ color: "#9ca3af", marginTop: 10 }}>
                  {activeTab === "Tasks"
                    ? "No tasks for today."
                    : "No notes yet."}
                </Text>
              </View>
            ) : (
              filteredItems.map((item, index) => {
                const isHero =
                  index === 0 &&
                  item.priority === "High" &&
                  item.status === "Pending" &&
                  activeTab === "Tasks";

                // Hero Card (Tasks Only)
                if (isHero) {
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.heroCard}
                      onPress={() => {
                        setFocusItem(item);
                        setFocusModalVisible(true);
                      }}
                    >
                      <View
                        style={[
                          styles.heroGradient,
                          { backgroundColor: "#312e81" },
                        ]}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={styles.priorityBadge}>
                            <Text style={styles.priorityText}>
                              🔥 TOP PRIORITY
                            </Text>
                          </View>
                          <Ionicons name="play-circle" size={32} color="#fff" />
                        </View>
                        <Text style={styles.heroTitle}>{item.title}</Text>
                        <Text style={styles.heroSubtitle}>
                          Tap to enter Hyper-Focus mode
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                }

                // Standard Item
                return (
                  <Swipeable
                    key={item.id}
                    renderRightActions={() => renderRightActions(item.id)}
                    renderLeftActions={() =>
                      activeTab === "Tasks"
                        ? renderLeftActions(item.id, item.status)
                        : null
                    }
                  >
                    <View style={styles.itemRow}>
                      {activeTab === "Tasks" ? (
                        <TouchableOpacity
                          onPress={() => toggleStatus(item.id, item.status)}
                          style={[
                            styles.checkCircle,
                            item.status === "Completed" && {
                              backgroundColor: "#10b981",
                              borderColor: "#10b981",
                            },
                          ]}
                        >
                          {item.status === "Completed" && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </TouchableOpacity>
                      ) : (
                        // Note Icon for Notes
                        <View
                          style={[
                            styles.checkCircle,
                            { borderWidth: 0, backgroundColor: "#f3f4f6" },
                          ]}
                        >
                          <Ionicons
                            name="document-text"
                            size={14}
                            color="#6b7280"
                          />
                        </View>
                      )}

                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.itemTitle,
                            item.status === "Completed" && {
                              textDecorationLine: "line-through",
                              color: "#9ca3af",
                            },
                          ]}
                        >
                          {item.title}
                        </Text>
                        {item.description ? (
                          <Text style={styles.itemDesc} numberOfLines={1}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>

                      {/* Priority Dot (Tasks Only) */}
                      {activeTab === "Tasks" && (
                        <View
                          style={[
                            styles.dot,
                            {
                              backgroundColor:
                                item.priority === "High"
                                  ? "#ef4444"
                                  : item.priority === "Medium"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                            },
                          ]}
                        />
                      )}
                    </View>
                  </Swipeable>
                );
              })
            )}
          </ScrollView>
        </View>

        {/* --- FLOATING ACTION BUTTON (The Power Button) --- */}
        <TouchableOpacity style={styles.fab} onPress={handleAddPress}>
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>

        {/* FOCUS MODAL */}
        <Modal
          animationType="slide"
          visible={focusModalVisible}
          onRequestClose={() => setFocusModalVisible(false)}
        >
          <SafeAreaView style={styles.focusContainer}>
            <View style={{ alignItems: "flex-end", padding: 20 }}>
              <TouchableOpacity onPress={() => setFocusModalVisible(false)}>
                <Ionicons name="close-circle" size={40} color="#fff" />
              </TouchableOpacity>
            </View>
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#9ca3af", letterSpacing: 2 }}>
                FOCUS MODE
              </Text>
              <Text style={styles.focusTitle}>{focusItem?.title}</Text>
              <Text style={styles.timer}>
                {Math.floor(timerSeconds / 60)}:
                {(timerSeconds % 60).toString().padStart(2, "0")}
              </Text>
              <TouchableOpacity
                onPress={() => setIsActive(!isActive)}
                style={styles.playBtn}
              >
                <Ionicons
                  name={isActive ? "pause" : "play"}
                  size={40}
                  color="#000"
                />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// --- STYLES ---
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
  avatar: {
    width: 45,
    height: 45,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
  },
  bentoGrid: { flexDirection: "row", gap: 12, marginBottom: 25, height: 110 },
  bentoCard: { borderRadius: 20, padding: 15, justifyContent: "space-between" },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bentoNum: { fontSize: 32, fontWeight: "bold", color: "#fff", marginTop: 5 },
  bentoLabel: { fontSize: 12, color: "#9ca3af", fontWeight: "500" },
  datePill: {
    width: 55,
    height: 75,
    borderRadius: 28,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  datePillActive: {
    backgroundColor: "#111827",
    borderColor: "#111827",
    transform: [{ scale: 1.05 }],
  },
  dayText: { fontSize: 12, color: "#9ca3af", marginBottom: 4 },
  dateNum: { fontSize: 18, fontWeight: "700", color: "#111827" },
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
  heroCard: {
    marginBottom: 15,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#312e81",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  heroGradient: { padding: 20, height: 160, justifyContent: "space-between" },
  priorityBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  priorityText: { color: "#fca5a5", fontSize: 10, fontWeight: "800" },
  heroTitle: { color: "#fff", fontSize: 22, fontWeight: "bold", width: "90%" },
  heroSubtitle: { color: "#a5b4fc", fontSize: 12 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    marginBottom: 1,
    borderBottomWidth: 1,
    borderColor: "#f3f4f6",
    height: 80,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontSize: 16, fontWeight: "600", color: "#1f2937" },
  itemDesc: { fontSize: 12, color: "#9ca3af", marginTop: 2 },
  emptyState: { alignItems: "center", marginTop: 50 },

  // FOCUS MODAL
  focusContainer: { flex: 1, backgroundColor: "#000" },
  focusTitle: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 40,
    paddingHorizontal: 20,
  },
  timer: {
    color: "#fff",
    fontSize: 80,
    fontWeight: "200",
    fontVariant: ["tabular-nums"],
    marginBottom: 50,
  },
  playBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },

  // SWIPE
  deleteAction: {
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
  },
  completeAction: {
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "100%",
  },
  actionText: { color: "#fff", fontWeight: "600", fontSize: 12, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 10 },

  // FAB (The New Plus Button)
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
    zIndex: 100,
  },
});
