import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import {
  addDoc,
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
  FlatList,
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
  View
} from "react-native";
import { auth, db } from "../../firebaseConfig";

// --- CONFIG ---
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowBanner: true, // FIXED: Replaced shouldShowAlert
      shouldShowList: true, // FIXED: Replaced shouldShowAlert
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
  const [quickInput, setQuickInput] = useState("");

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

  // --- 2. LOGIC: BRAIN DUMP ---
  const handleBrainDump = async () => {
    if (!quickInput.trim()) return;
    if (!user)
      return Alert.alert("Login Required", "Please login to save items.");

    const text = quickInput.trim();
    const isNote =
      text.toLowerCase().startsWith("note:") || activeTab === "Notes";
    const finalTitle = isNote ? text.replace(/^note:\s*/i, "") : text;

    try {
      await addDoc(collection(db, "tasks"), {
        title: finalTitle,
        type: isNote ? "note" : "task",
        status: "Pending",
        priority: "Medium",
        category: "Inbox",
        targetDate: selectedDate.toISOString(),
        userId: user.uid,
        createdAt: new Date().toISOString(),
        startTime: new Date().toISOString(),
      });
      setQuickInput("");
      Vibration.vibrate(20);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "Pending" ? "Completed" : "Pending";
    await updateDoc(doc(db, "tasks", id), { status: newStatus });
  };

  // --- 3. RENDERING HELPERS ---
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
    const typeMatch =
      activeTab === "Tasks" ? i.type !== "note" : i.type === "note";
    const dateMatch =
      new Date(i.targetDate).toDateString() === selectedDate.toDateString();
    return typeMatch && (activeTab === "Notes" ? true : dateMatch);
  });

  filteredItems.sort((a, b) => (a.priority === "High" ? -1 : 1));

  const stats = {
    pending: items.filter((i) => i.status === "Pending" && i.type !== "note")
      .length,
    completed: items.filter((i) => i.status === "Completed").length,
    notes: items.filter((i) => i.type === "note").length,
  };

  // --- RENDER ---
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
                  style={[styles.datePill, isSelected && styles.datePillActive]}
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

        {/* LIST AREA */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 100 }}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="sparkles-outline" size={40} color="#d1d5db" />
              <Text style={{ color: "#9ca3af", marginTop: 10 }}>
                Nothing here. Brain dump below! 👇
              </Text>
            </View>
          ) : (
            filteredItems.map((item, index) => {
              const isHero =
                index === 0 &&
                item.priority === "High" &&
                item.status === "Pending" &&
                activeTab === "Tasks";

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
                    <LinearGradient
                      colors={["#1e1b4b", "#312e81"]}
                      style={styles.heroGradient}
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
                    </LinearGradient>
                  </TouchableOpacity>
                );
              }

              return (
                <View key={item.id} style={styles.itemRow}>
                  {activeTab === "Tasks" && (
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
                  <TouchableOpacity
                    onPress={() => deleteDoc(doc(db, "tasks", item.id))}
                    style={{ padding: 5 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* BRAIN DUMP BAR */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={10}
        >
          <View style={styles.brainDumpBar}>
            <TextInput
              style={styles.brainInput}
              placeholder={
                activeTab === "Tasks" ? "Add a task..." : "Capture an idea..."
              }
              placeholderTextColor="#9ca3af"
              value={quickInput}
              onChangeText={setQuickInput}
              onSubmitEditing={handleBrainDump}
            />
            <TouchableOpacity onPress={handleBrainDump} style={styles.sendBtn}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>

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
            style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
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
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
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
  brainDumpBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 30,
    padding: 5,
    paddingLeft: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  brainInput: { flex: 1, height: 50, fontSize: 16, color: "#111827" },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
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
});
