import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { addDoc, collection } from "firebase/firestore";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
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

const BG_COLORS = [
  "#ffffff",
  "#fef2f2",
  "#f0fdf4",
  "#eff6ff",
  "#fff7ed",
  "#faf5ff",
];

export default function AddTask() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
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

  const handleSave = async () => {
    if (!title.trim())
      return Alert.alert("Missing Info", "Please enter a task title");
    if (!auth.currentUser) return Alert.alert("Error", "You must be logged in");

    setLoading(true);
    const finalCategory =
      category === "Custom" ? customCategory.trim() || "Custom" : category;

    try {
      await addDoc(collection(db, "tasks"), {
        title,
        description,
        category: finalCategory,
        priority,
        customColor: selectedBgColor,
        targetDate: targetDate.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        userId: auth.currentUser.uid,
        status: "Pending",
        createdAt: new Date(),
      });

      // Reset form
      setTitle("");
      setDescription("");
      setCategory("Work");
      router.push("/(tabs)"); // Go back to Home
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#fff" }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.header}>New Schedule</Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          placeholder="What needs to be done?"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 80 }]}
          placeholder="Add details..."
          value={description}
          onChangeText={setDescription}
          multiline
          placeholderTextColor="#9ca3af"
        />

        <Text style={styles.label}>When?</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity
            style={styles.dateBtn}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={18} color="#4b5563" />
            <Text>{targetDate.toDateString()}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.timeRow}>
          <TouchableOpacity
            style={styles.timeBtn}
            onPress={() => setShowStartPicker(true)}
          >
            <Text style={styles.timeText}>
              {startTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>
          <Text style={{ color: "#9ca3af" }}>to</Text>
          <TouchableOpacity
            style={styles.timeBtn}
            onPress={() => setShowEndPicker(true)}
          >
            <Text style={styles.timeText}>
              {endTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Pickers (Hidden by default) */}
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
        <View style={styles.row}>
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
              <Text style={{ color: getPriorityColor(p), fontWeight: "bold" }}>
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.row}>
          {["Work", "Study", "Personal", "Custom"].map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.pill,
                category === cat && { backgroundColor: "#111827" },
              ]}
            >
              <Text style={{ color: category === cat ? "#fff" : "#4b5563" }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {category === "Custom" && (
          <TextInput
            style={[styles.input, { marginTop: 10 }]}
            placeholder="Enter Category..."
            value={customCategory}
            onChangeText={setCustomCategory}
          />
        )}

        <TouchableOpacity
          style={styles.saveBtn}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveText}>Create Schedule</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 50 },
  header: { fontSize: 28, fontWeight: "bold", marginBottom: 20, marginTop: 10 },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6b7280",
    marginTop: 20,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  dateRow: { marginBottom: 10 },
  dateBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  timeBtn: {
    flex: 1,
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  timeText: { fontWeight: "600" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  saveBtn: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 40,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  saveText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
