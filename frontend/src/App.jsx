import { useState } from "react";
import Navbar from "./components/Navbar";
import UploadZone from "./components/UploadZone";
import LoadingSpinner from "./components/LoadingSpinner";
import ResultsView from "./components/ResultsView";
import HistoryTable from "./components/HistoryTable";
import "./index.css";

async function readApiResponse(res) {
  const raw = await res.text();

  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    return {
      error: `Server returned non-JSON response (HTTP ${res.status}).`,
      raw,
    };
  }
}

export default function App() {
  // View state
  const [view, setView] = useState("upload");

  const [resultData, setResultData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [error, setError] = useState(null);

  // Celery task status
  const [taskStatus, setTaskStatus] = useState("");
  const [taskProgress, setTaskProgress] = useState(0);

  /* ---------------- Poll Celery Task ---------------- */

  const startPolling = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await readApiResponse(res);

        if (!res.ok) {
          clearInterval(interval);
          throw new Error(data.error || "Task failed.");
        }

        switch (data.state) {
          case "PENDING":
            setTaskStatus("Waiting in queue...");
            setTaskProgress(0);
            break;

          case "PROGRESS":
            setTaskStatus(data.status);
            setTaskProgress(data.progress ?? 0);
            break;

          case "SUCCESS":
            clearInterval(interval);

            setTaskStatus("Completed");
            setTaskProgress(100);

            setResultData(data.result);
            setView("results");
            break;

          case "FAILURE":
            clearInterval(interval);

            setError(data.error || "Task failed.");
            setView("upload");
            break;

          default:
            break;
        }
      } catch (err) {
        clearInterval(interval);

        setError(err.message);
        setView("upload");
      }
    }, 1500);
  };

  /* ---------------- Upload File ---------------- */

  const handleUpload = async (file) => {
    setView("loading");

    setError(null);
    setResultData(null);

    setTaskStatus("Uploading file...");
    setTaskProgress(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await readApiResponse(res);

      if (!res.ok) {
        throw new Error(
          data.error ||
            `Upload failed (HTTP ${res.status}). Check if backend is running on port 5000.`
        );
      }

      startPolling(data.task_id);
    } catch (e) {
      setError(e.message);
      setView("upload");
    }
  };

  /* ---------------- Navigation ---------------- */

  const handleNavigate = async (destination) => {
    if (destination === "history") {
      try {
        const res = await fetch("/api/history");

        const data = await readApiResponse(res);

        if (!res.ok) {
          throw new Error(
            data.error || `Failed to load history (HTTP ${res.status}).`
          );
        }

        setHistoryData(data.runs || []);
        setView("history");
      } catch (e) {
        setError(
          e.message ||
            "Failed to load history — is the Flask server running?"
        );
        setView("upload");
      }
    } else {
      setView(destination);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
      }}
    >
      <Navbar view={view} onNavigate={handleNavigate} />

      <main>
        {view === "upload" && (
          <UploadZone
            onUpload={handleUpload}
            error={error}
          />
        )}

        {view === "loading" && (
          <LoadingSpinner
            status={taskStatus}
            progress={taskProgress}
          />
        )}

        {view === "results" && resultData && (
          <ResultsView
            data={resultData}
            onBack={() => setView("upload")}
          />
        )}

        {view === "history" && (
          <HistoryTable
            data={historyData}
            onBack={() => setView("upload")}
          />
        )}
      </main>
    </div>
  );
}