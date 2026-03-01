import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter } from "expo-router";
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

export default function AddTask() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // Determine if we are adding a Task or a Note
  // Default to 'task' if not specified
  const type = params.type === "note" ? "note" : "task";
  const isTask = type === "task";

  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(isTask ? "Work" : "Idea");
  const [priority, setPriority] = useState("Medium");

  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(
    new Date(new Date().getTime() + 60 * 60 * 1000),
  );

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const categories = isTask
    ? ["Work", "Personal", "Study", "Health"]
    : ["Idea", "Journal", "Meeting", "Random"];

  const priorities = ["High", "Medium", "Low"];

  const handleCreate = async () => {
    if (!title.trim())
      return Alert.alert("Missing Info", "Please add a title!");
    if (!auth.currentUser) return Alert.alert("Error", "Login required.");

    setLoading(true);
    try {
      await addDoc(collection(db, "tasks"), {
        title,
        description,
        category,
        priority, // Notes still get a priority defaults, useful for sorting
        type, // CRITICAL: Saves as 'task' or 'note'
        targetDate: date.toISOString(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: "Pending",
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString(),
        customColor:
          priority === "High"
            ? "#fee2e2"
            : priority === "Medium"
              ? "#fef3c7"
              : "#dbeafe",
      });

      Alert.alert("Success", `${isTask ? "Task" : "Note"} created!`);
      router.back();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New {isTask ? "Task" : "Note"}</Text>
        </View>

        <View style={styles.formCard}>
          {/* Title */}
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder={isTask ? "What needs to be done?" : "Note Title..."}
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text style={styles.label}>{isTask ? "Description" : "Content"}</Text>
          <TextInput
            style={[styles.input, { height: 120, textAlignVertical: "top" }]}
            placeholder="Add details..."
            placeholderTextColor="#9ca3af"
            multiline
            value={description}
            onChangeText={setDescription}
          />

          {/* TASK ONLY FIELDS */}
          {isTask && (
            <>
              {/* Date */}
              <Text style={styles.label}>Date</Text>
              <TouchableOpacity
                style={styles.pickerBtn}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#4b5563" />
                <Text style={styles.pickerText}>{date.toDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  onChange={onDateChange}
                />
              )}

              {/* Time */}
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={styles.label}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.pickerBtn}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.pickerText}>
                      {startTime.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showStartTimePicker && (
                    <DateTimePicker
                      value={startTime}
                      mode="time"
                      onChange={(e, d) => {
                        setShowStartTimePicker(false);
                        if (d) setStartTime(d);
                      }}
                    />
                  )}
                </View>
              </View>

              {/* Priority */}
              <Text style={styles.label}>Priority</Text>
              <View style={styles.chipContainer}>
                {priorities.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[styles.chip, priority === p && styles.activeChip]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        priority === p && { color: "#fff" },
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Category */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipContainer}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, category === cat && styles.activeChip]}
                onPress={() => setCategory(cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    category === cat && { color: "#fff" },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Button */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createBtnText}>
                Save {isTask ? "Task" : "Note"}
              </Text>
            )}
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
    alignItems: "center",
    marginTop: 40,
    marginBottom: 20,
  },
  backBtn: { padding: 5, marginRight: 10 },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#111827" },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    marginBottom: 8,
    textTransform: "uppercase",
    marginTop: 15,
  },
  input: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    color: "#111827",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  pickerText: { marginLeft: 10, fontSize: 16, color: "#111827" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  activeChip: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { fontSize: 14, color: "#4b5563" },
  createBtn: {
    backgroundColor: "#111827",
    padding: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 30,
    marginBottom: 10,
  },
  createBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
});
