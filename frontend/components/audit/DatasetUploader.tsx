"use client";

import { UploadCloud } from "lucide-react";
import { useCallback, useState } from "react";
import { ApiError, uploadDatasetFile } from "@/lib/api";
import type { UploadResponse } from "@/types/audit";
import { Button } from "@/components/ui/button";

export interface DatasetUploaderProps {
  onUploaded: (res: UploadResponse) => void;
}

/**
 * Drag-and-drop dataset uploader with validation and progress feedback.
 */
export function DatasetUploader({ onUploaded }: DatasetUploaderProps) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      setError(null);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!ext || !["csv", "json", "xlsx", "xls"].includes(ext)) {
        setError("Please upload CSV, JSON, or Excel.");
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        setError("Max file size is 100MB.");
        return;
      }
      setBusy(true);
      setProgress(10);
      try {
        // XMLHttpRequest could track real progress; fetch lacks upload progress in all browsers
        const res = await uploadDatasetFile(file);
        setProgress(100);
        onUploaded(res);
      } catch (e) {
        const msg = e instanceof ApiError ? e.body : "Upload failed";
        setError(msg);
      } finally {
        setBusy(false);
        setTimeout(() => setProgress(0), 400);
      }
    },
    [onUploaded],
  );

  return (
    <div
      className="liquid-glass rounded-2xl p-10 text-center"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        void handleFiles(e.dataTransfer.files);
      }}
      data-testid="dataset-uploader"
    >
      <UploadCloud className="mx-auto mb-3 h-10 w-10 text-white/40" />
      <div className="text-sm text-white/70">Drop your CSV or JSON here</div>
      <div className="mt-2 text-xs text-white/40">or browse files · Max 100MB</div>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="secondary" data-testid="dataset-browse">
          <label className="cursor-pointer">
            Browse files
            <input
              type="file"
              accept=".csv,.json,.xlsx,.xls"
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </label>
        </Button>
      </div>
      {busy ? (
        <div className="liquid-glass mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full" data-testid="upload-progress">
          <div
            className="h-full rounded-full bg-white/80 transition-all"
            style={{ width: `${Math.max(progress, 35)}%` }}
          />
        </div>
      ) : null}
      {error ? <div className="mt-3 text-sm text-red-300">{error}</div> : null}
    </div>
  );
}
