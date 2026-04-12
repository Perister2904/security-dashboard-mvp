"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  LogOut,
  Moon,
  Shield,
  Sun,
  Target,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "next-themes";
import { SessionManager, type User } from "@/lib/auth";
import SOCPerformanceDashboard from "@/components/SOCPerformanceDashboard";
import AssetRiskPostureDashboard from "@/components/AssetRiskPostureDashboard";
import CEORiskSummary from "@/components/CEORiskSummary";

type Tab = "SOC Performance" | "Asset & Risk Posture" | "CEO Risk Summary";

function isExecutiveRole(role: string | undefined) {
  return role === "ceo" || role === "ciso" || role === "admin" || role === "CEO" || role === "CISO";
}

function getTabsForUser(user: User | null): Tab[] {
  if (!user) {
    return ["SOC Performance", "Asset & Risk Posture"];
  }

  return isExecutiveRole(user.role)
    ? ["SOC Performance", "Asset & Risk Posture", "CEO Risk Summary"]
    : ["SOC Performance", "Asset & Risk Posture"];
}

export default function Page() {
  const { theme, setTheme } = useTheme();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [tab, setTab] = useState<Tab>("SOC Performance");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const availableTabs = useMemo(() => getTabsForUser(currentUser), [currentUser]);

  useEffect(() => {
    setMounted(true);

    const initializeSession = async () => {
      const user = await SessionManager.validateSession();
      if (user) {
        setCurrentUser(user);
      }
    };

    void initializeSession();
  }, []);

  useEffect(() => {
    const syncAuthState = () => {
      setCurrentUser(SessionManager.getCurrentUser());
    };

    window.addEventListener("auth-state-changed", syncAuthState);
    return () => window.removeEventListener("auth-state-changed", syncAuthState);
  }, []);

  useEffect(() => {
    if (!availableTabs.includes(tab)) {
      setTab(availableTabs[0]);
    }
  }, [availableTabs, tab]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timer = window.setTimeout(() => setNotification(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notification]);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
  };

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) {
      showNotification("error", "Please enter both username/email and password.");
      return;
    }

    setIsLoading(true);

    try {
      const user = await SessionManager.loginAsync(loginEmail, loginPassword);

      if (!user) {
        showNotification("error", "Invalid credentials. Please try again.");
        return;
      }

      setCurrentUser(user);
      showNotification("success", `Welcome back, ${user.name}.`);
    } catch (error: any) {
      showNotification("error", error?.message || "Login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    SessionManager.logout();
    setCurrentUser(null);
    setLoginEmail("");
    setLoginPassword("");
    setTab("SOC Performance");
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <Shield className="mx-auto h-12 w-12 text-blue-600" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">Security Dashboard Access</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Sign in to access SOC, asset, risk, and executive security views.
            </p>
          </div>

          <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email or Username</label>
                <input
                  type="text"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  placeholder="Enter your username or email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        void handleLogin();
                      }
                    }}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 pr-10 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 mt-1 flex items-center pr-3 text-gray-500"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => void handleLogin()}
              disabled={isLoading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </button>

            <div className="rounded-lg bg-blue-50 p-4 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
              <div className="font-semibold">Backend Authentication</div>
              <div className="mt-1">Use your configured backend credentials. LDAP and local users are managed by the backend.</div>
            </div>

            {notification && (
              <div
                className={`rounded-lg border px-3 py-2 text-sm ${
                  notification.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {notification.message}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notification && (
        <div
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-lg border p-4 shadow-lg ${
            notification.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <header className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-blue-500" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-2xl font-bold text-transparent">
              Security Operations Dashboard
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              SOC performance, authenticated assets, risk posture, and executive visibility.
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
              Logged in as: {currentUser.name} ({currentUser.role}) - {currentUser.department}
            </p>
          </div>
        </div>

        <div className="header-actions flex flex-wrap items-center gap-2">
          <button className="btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {mounted ? theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        {availableTabs.map((item) => (
          <button
            key={item}
            className={`tab ${tab === item ? "tab-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item === "SOC Performance" && <Activity className="mr-1 h-4 w-4" />}
            {item === "Asset & Risk Posture" && <Target className="mr-1 h-4 w-4" />}
            {item === "CEO Risk Summary" && <TrendingUp className="mr-1 h-4 w-4" />}
            {item}
          </button>
        ))}
      </nav>

      <section className={tab === "SOC Performance" ? "space-y-6" : "hidden"} aria-hidden={tab !== "SOC Performance"}>
        <SOCPerformanceDashboard />
      </section>

      <section className={tab === "Asset & Risk Posture" ? "space-y-6" : "hidden"} aria-hidden={tab !== "Asset & Risk Posture"}>
        <AssetRiskPostureDashboard />
      </section>

      {isExecutiveRole(currentUser.role) && (
        <section className={tab === "CEO Risk Summary" ? "space-y-6" : "hidden"} aria-hidden={tab !== "CEO Risk Summary"}>
          <CEORiskSummary />
        </section>
      )}
    </div>
  );
}
