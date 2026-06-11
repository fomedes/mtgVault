"use client";

import { CheckIcon, ClipboardIcon, DownloadIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CollectionExport({ disabled }: { disabled?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function fetchText(format: "text" | "mtgo"): Promise<string> {
    const res = await fetch(`/api/collection/export?format=${format}`);
    if (!res.ok) throw new Error("Export failed");
    return res.text();
  }

  async function handleCopy() {
    const text = await fetchText("text");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload(format: "text" | "mtgo") {
    const text = await fetchText(format);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `collection-${format}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={handleCopy}
      >
        {copied ? (
          <CheckIcon data-icon="inline-start" className="text-green-500" />
        ) : (
          <ClipboardIcon data-icon="inline-start" />
        )}
        {copied ? "Copied!" : "Copy list"}
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => handleDownload("text")}
      >
        <DownloadIcon data-icon="inline-start" />
        Text
      </Button>

      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => handleDownload("mtgo")}
      >
        <DownloadIcon data-icon="inline-start" />
        MTGO
      </Button>
    </div>
  );
}
