import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import React, { useRef, useState } from "react";
import {
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
import {
  RichEditor,
  RichToolbar,
  actions,
} from "react-native-pell-rich-editor";
import { auth, db } from "../firebaseConfig";

export default function AddNote() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const isEditing = !!params.id;

  const [title, setTitle] = useState((params.title as string) || "");
  const [descriptionHTML, setDescriptionHTML] = useState(
    (params.description as string) || "",
  );
  const richText = useRef<RichEditor>(null);

  const handleSave = async () => {
    if (!title.trim() || !descriptionHTML.trim()) {
      return Alert.alert("Hold up", "Please enter a title and some content.");
    }

    try {
      if (isEditing) {
        const noteRef = doc(db, "tasks", params.id as string);
        await updateDoc(noteRef, {
          title,
          description: descriptionHTML,
        });
      } else {
        await addDoc(collection(db, "tasks"), {
          userId: auth.currentUser?.uid,
          title,
          description: descriptionHTML,
          type: "note",
          targetDate: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          status: "pending",
        });
      }
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Error saving note", error.message);
    }
  };

  return (
    // Replaced SafeAreaView with a standard View using explicit padding
    <View style={styles.container}>
      {/* 1. TOP HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {isEditing ? "Edit Note" : "New Note"}
        </Text>

        <TouchableOpacity style={styles.headerSaveBtn} onPress={handleSave}>
          <Text style={styles.headerSaveBtnText}>
            {isEditing ? "Update" : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardContainer}
      >
        {/* 2. FORMATTING TOOLBAR (Moved above the title) */}
        <RichToolbar
          editor={richText}
          actions={[
            actions.undo,
            actions.redo,
            actions.setBold,
            actions.setItalic,
            actions.insertBulletsList,
            actions.insertOrderedList,
            actions.heading1,
          ]}
          style={styles.toolbar}
          iconTint="#4b5563"
          selectedIconTint="#111827"
        />

        {/* 3. TITLE INPUT */}
        <View style={styles.titleContainer}>
          <TextInput
            style={styles.titleInput}
            placeholder="Note Title..."
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* 4. NOTE EDITOR */}
        <ScrollView style={styles.editorContainer}>
          <RichEditor
            ref={richText}
            initialContentHTML={descriptionHTML}
            onChange={setDescriptionHTML}
            placeholder="Start typing your note here..."
            initialHeight={400}
            editorStyle={{ backgroundColor: "#fff", color: "#111827" }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    // ⚡️ THE FIX: Forces a 50px gap at the top so it clears the notification bar
    paddingTop: Platform.OS === "android" ? 45 : 55,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  backBtn: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  headerSaveBtn: {
    backgroundColor: "#111827",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerSaveBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  keyboardContainer: {
    flex: 1,
  },
  toolbar: {
    backgroundColor: "#f9fafb",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    elevation: 1, // Adds a tiny shadow below the toolbar on Android
  },
  titleContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 5,
  },
  titleInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    paddingBottom: 10,
  },
  editorContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
});
