"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { useFriendsAnimations } from "@/lib/animations/friends";

interface FriendCodeCardProps {
  friendCode: string;
}

/** Format raw 8-digit code as "XXXX-XXXX". */
function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function FriendCodeCard({ friendCode }: FriendCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const anim = useFriendsAnimations();

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text manually
    }
  }

  return (
    <motion.div
      variants={anim.codeReveal}
      initial="hidden"
      animate="visible"
      className="bg-card rounded-lg border p-5 space-y-3"
    >
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Your Friend Code
        </p>
        <p className="font-mono text-3xl font-bold tracking-widest text-primary">
          {formatCode(friendCode)}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Share this code with friends so they can send you a friend request.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="w-full sm:w-auto"
      >
        {copied ? "Copied!" : "Copy code"}
      </Button>
    </motion.div>
  );
}
