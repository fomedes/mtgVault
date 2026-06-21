"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "users" | "sets" | "whitelists";

interface UserRow {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  vaultCoins: number;
  isAllowlisted: boolean;
  lastLoginAt?: string;
}

interface SetRow {
  code: string;
  name: string;
  setType: string;
  enabled: boolean;
  boosterPrice: number;
  cardCount: number;
}

interface WhitelistEntry {
  email: string;
  status: "active" | "pending";
  addedBy: string;
  createdAt: string;
}

const labelClass = "text-muted-foreground text-xs font-medium uppercase tracking-wider";
const inputClass =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 w-24 rounded border px-2 py-1 text-sm outline-none focus-visible:ring-2";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sets, setSets] = useState<SetRow[]>([]);
  const [whitelists, setWhitelists] = useState<WhitelistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Grant VC state
  const [grantAmounts, setGrantAmounts] = useState<Record<string, string>>({});
  // Whitelist add state
  const [newEmail, setNewEmail] = useState("");
  const [isAddingWhitelist, setIsAddingWhitelist] = useState(false);

  function showFeedback(msg: string) {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/sets").then((r) => r.json()),
      fetch("/api/admin/allowlist").then((r) => r.json()),
    ]).then(([u, s, w]) => {
      setUsers((u as { users: UserRow[] }).users ?? []);
      setSets((s as { sets: SetRow[] }).sets ?? []);
      setWhitelists((w as { whitelists: WhitelistEntry[] }).whitelists ?? []);
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  async function grantVC(uid: string) {
    const amount = parseInt(grantAmounts[uid] ?? "0", 10);
    if (!amount || amount <= 0) return;
    const res = await fetch(`/api/admin/users/${uid}/wallet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    if (res.ok) {
      const data = (await res.json()) as { newBalance: number };
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, vaultCoins: data.newBalance } : u)),
      );
      setGrantAmounts((prev) => ({ ...prev, [uid]: "" }));
      showFeedback(`Granted ${amount} VC`);
    }
  }

  async function toggleAllowlist(uid: string, current: boolean) {
    const res = await fetch(`/api/admin/users/${uid}/allowlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowed: !current }),
    });
    if (res.ok) {
      setUsers((prev) =>
        prev.map((u) => (u.uid === uid ? { ...u, isAllowlisted: !current } : u)),
      );
      showFeedback(!current ? "Added to allowlist" : "Removed from allowlist");
    }
  }

  async function toggleSetEnabled(code: string, current: boolean) {
    const res = await fetch(`/api/admin/sets/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !current }),
    });
    if (res.ok) {
      setSets((prev) =>
        prev.map((s) => (s.code === code ? { ...s, enabled: !current } : s)),
      );
    }
  }

  async function updatePrice(code: string, price: number) {
    if (isNaN(price) || price < 0) return;
    const res = await fetch(`/api/admin/sets/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ boosterPrice: price }),
    });
    if (res.ok) {
      setSets((prev) =>
        prev.map((s) => (s.code === code ? { ...s, boosterPrice: price } : s)),
      );
      showFeedback("Price updated");
    }
  }

  async function addWhitelist() {
    if (!newEmail.trim()) return;
    setIsAddingWhitelist(true);
    try {
      const res = await fetch("/api/admin/allowlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });
      if (res.ok) {
        const entry = (await res.json()) as WhitelistEntry;
        setWhitelists((prev) => [...prev, entry]);
        setNewEmail("");
        showFeedback(`Added ${newEmail} to whitelist`);
      } else {
        const err = (await res.json()) as { error: string };
        if (err.error === "already_allowlisted") {
          showFeedback("Email already whitelisted");
        } else {
          showFeedback("Error adding whitelist");
        }
      }
    } finally {
      setIsAddingWhitelist(false);
    }
  }

  async function deleteWhitelist(email: string) {
    const res = await fetch("/api/admin/allowlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setWhitelists((prev) => prev.filter((w) => w.email !== email));
      showFeedback("Deleted from whitelist");
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
    );

  return (
    <div className="space-y-6">
      {feedback ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-400">
          {feedback}
        </div>
      ) : null}

      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        <button type="button" onClick={() => setTab("users")} className={tabClass(tab === "users")}>Users</button>
        <button type="button" onClick={() => setTab("sets")} className={tabClass(tab === "sets")}>Sets</button>
        <button type="button" onClick={() => setTab("whitelists")} className={tabClass(tab === "whitelists")}>Whitelists</button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : tab === "whitelists" ? (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="user@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addWhitelist()}
              className={cn(inputClass, "flex-1")}
            />
            <Button
              onClick={addWhitelist}
              disabled={!newEmail.trim() || isAddingWhitelist}
            >
              Add
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className={cn(labelClass, "pb-2 text-left")}>Email</th>
                  <th className={cn(labelClass, "pb-2 text-center")}>Status</th>
                  <th className={cn(labelClass, "pb-2 text-left")}>Added By</th>
                  <th className={cn(labelClass, "pb-2 text-center")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {whitelists.map((w) => (
                  <tr key={w.email} className="border-b last:border-0">
                    <td className="py-3 pr-4">{w.email}</td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          w.status === "active"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-yellow-500/15 text-yellow-400",
                        )}
                      >
                        {w.status === "active" ? "Active" : "Pending"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs">{w.addedBy}</td>
                    <td className="py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteWhitelist(w.email)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b">
                <th className={cn(labelClass, "pb-2 text-left")}>User</th>
                <th className={cn(labelClass, "pb-2 text-left")}>Role</th>
                <th className={cn(labelClass, "pb-2 text-right")}>VC</th>
                <th className={cn(labelClass, "pb-2 text-center")}>Allowlisted</th>
                <th className={cn(labelClass, "pb-2 text-left")}>Grant VC</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{u.displayName || u.email}</p>
                    <p className="text-muted-foreground text-xs">{u.email}</p>
                  </td>
                  <td className="py-3 pr-4 capitalize">{u.role}</td>
                  <td className="py-3 pr-4 text-right font-mono">{u.vaultCoins}</td>
                  <td className="py-3 pr-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleAllowlist(u.uid, u.isAllowlisted)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                        u.isAllowlisted
                          ? "bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400"
                          : "bg-red-500/15 text-red-400 hover:bg-green-500/15 hover:text-green-400",
                      )}
                    >
                      {u.isAllowlisted ? "Yes" : "No"}
                    </button>
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="10000"
                        placeholder="VC"
                        value={grantAmounts[u.uid] ?? ""}
                        onChange={(e) =>
                          setGrantAmounts((prev) => ({ ...prev, [u.uid]: e.target.value }))
                        }
                        className={inputClass}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => grantVC(u.uid)}
                        disabled={!grantAmounts[u.uid]}
                      >
                        Grant
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b">
                <th className={cn(labelClass, "pb-2 text-left")}>Set</th>
                <th className={cn(labelClass, "pb-2 text-right")}>Cards</th>
                <th className={cn(labelClass, "pb-2 text-center")}>Enabled</th>
                <th className={cn(labelClass, "pb-2 text-right")}>Price (VC)</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.code} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground text-xs uppercase">{s.code}</p>
                  </td>
                  <td className="py-3 pr-4 text-right font-mono">{s.cardCount}</td>
                  <td className="py-3 pr-4 text-center">
                    <button
                      type="button"
                      onClick={() => toggleSetEnabled(s.code, s.enabled)}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold transition-colors",
                        s.enabled
                          ? "bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400"
                          : "bg-muted text-muted-foreground hover:bg-green-500/15 hover:text-green-400",
                      )}
                    >
                      {s.enabled ? "On" : "Off"}
                    </button>
                  </td>
                  <td className="py-3 text-right">
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      defaultValue={s.boosterPrice}
                      onBlur={(e) => updatePrice(s.code, parseInt(e.target.value, 10))}
                      className={inputClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
