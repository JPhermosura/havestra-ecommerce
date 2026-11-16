import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import axios from "axios";

export interface User {
  id: string;
  email?: string;
  name: string;
  role?: "buyer" | "seller" | "admin";
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  zipCode?: string;
  // Farmer-specific fields
  isFarmer?: boolean;
  farmName?: string;
  farmSize?: string;
  farmLocation?: string;
  idType?: string;
  isIdVerified?: boolean;
  idVerificationStatus?: "not_submitted" | "pending" | "verified" | "pending_review" | "rejected";
  idNameConsistent?: boolean | null;
  latestReasonCode?: "blurry_image" | "name_mismatch" | "expired_document" | "unsupported_document" | "other" | null;
  latestReasonNote?: string | null;
  farmType?: string; // e.g., "Rice Farm", "Vegetable Farm", "Mixed Crops"
  certifications?: string[]; // e.g., ["Organic", "GAP Certified"]
  farmDescription?: string;
  farmImages?: string[];
  yearsOfExperience?: number;
  contactInfo?: {
    phone: string;
    whatsapp?: string;
    email: string;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<User>;
  register: (
    phone: string,
    password: string,
    name: string,
    role?: "buyer" | "seller",
    email?: string,
    farmName?: string,
    farmLocation?: string,
    idType?: string,
    idFrontImage?: File,
    idBackImage?: File,
    idConsent?: boolean,
    onUploadProgress?: (progress: number) => void
  ) => Promise<User>;
  logout: () => void;
  updateProfile: (profile: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TOKEN_KEY = "token";
const AUTH_USER_KEY = "user";

function normalizeRole(role: any): User["role"] {
  const rawRole = String(role ?? "buyer")
    .trim()
    .toLowerCase();
  if (rawRole === "seller" || rawRole === "buyer" || rawRole === "admin") {
    return rawRole as User["role"];
  }
  return "buyer";
}

function normalizeUser(userData: any): User {
  return {
    id: userData.id ?? userData._id ?? "",
    email: userData.email,
    name: userData.name,
    role: normalizeRole(userData.role),
    phone: userData.phone,
    address: userData.address,
    city: userData.city,
    country: userData.country,
    zipCode: userData.zipCode,
    isFarmer: userData.isFarmer,
    farmName: userData.farmName,
    farmSize: userData.farmSize,
    farmLocation: userData.farmLocation,
    idType: userData.idType,
    isIdVerified: userData.isIdVerified,
    idVerificationStatus: userData.idVerificationStatus ||
      (userData.isIdVerified ? "verified" : "not_submitted"),
    idNameConsistent: userData.idNameConsistent ?? null,
    latestReasonCode: userData.latestReasonCode ?? null,
    latestReasonNote: userData.latestReasonNote ?? null,
    farmType: userData.farmType,
    certifications: userData.certifications,
    farmDescription: userData.farmDescription,
    farmImages: userData.farmImages,
    yearsOfExperience: userData.yearsOfExperience,
    contactInfo: userData.contactInfo,
  };
}

function setAxiosAuthToken(token: string | null) {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
}

function getDashboardPath(role?: User["role"]) {
  if (role === "seller") return "/seller/dashboard";
  return "/buyer";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const authErrorHandled = useRef(false);

  // Load user from localStorage on mount and validate the token
  useEffect(() => {
    (async () => {
      for (const userKey of [AUTH_USER_KEY, "ecommerce_user"]) {
        const storedProfile = localStorage.getItem(userKey);
        if (!storedProfile) continue;
        try {
          const parsedProfile = JSON.parse(storedProfile);
          if (parsedProfile && typeof parsedProfile === "object") {
            delete parsedProfile.idFrontImage;
            delete parsedProfile.idBackImage;
            localStorage.setItem(userKey, JSON.stringify(parsedProfile));
          }
        } catch {
          console.warn("[Auth] Ignored malformed cached profile");
        }
      }

      const savedToken =
        localStorage.getItem(AUTH_TOKEN_KEY) ||
        localStorage.getItem("ecommerce_token") ||
        localStorage.getItem("auth_token");
      const savedUserJson =
        localStorage.getItem(AUTH_USER_KEY) ||
        localStorage.getItem("ecommerce_user");

      console.debug("[Auth] Initializing auth from storage", {
        savedToken: !!savedToken,
        savedUserJson: !!savedUserJson,
      });
      if (!savedToken) {
        console.debug("[Auth] No token found in storage");
        setIsLoading(false);
        return;
      }

      setToken(savedToken);
      setAxiosAuthToken(savedToken);

      try {
        const profileRes = await axios.get("/api/auth/profile");
        const profileUser = normalizeUser(profileRes.data);

        setUser(profileUser);
        setIsAuthenticated(true);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(profileUser));
      } catch (err) {
        const e: any = err;
        const responseStatus = e?.response?.status;
        console.warn("[Auth] Profile fetch failed", {
          status: responseStatus,
          url: e?.config?.url,
        });

        if (responseStatus === 401 || responseStatus === 403) {
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
          setAxiosAuthToken(null);
          localStorage.removeItem(AUTH_TOKEN_KEY);
          localStorage.removeItem(AUTH_USER_KEY);
          console.debug(
            "[Auth] Cleared invalid auth storage after failed profile validation"
          );
        }

        console.error("[Auth] Profile restoration failed", {
          errorName: e instanceof Error ? e.name : "Error",
        });
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    setIsAuthenticated(!!user);
    console.debug("[Auth] isAuthenticated set to", !!user);
  }, [user]);

  const createMockUser = (
    email: string,
    name: string,
    roleOverride?: "buyer" | "seller"
  ): User => {
    const normalizedEmail = String(email || "").toLowerCase();
    const isSeller = normalizedEmail.includes("seller") || normalizedEmail.includes("farmer");
    const role = roleOverride ?? (isSeller ? "seller" : "buyer");
    const isFarmer = role === "seller" || normalizedEmail.includes("farmer");

    return {
      id: Math.random().toString(36).substr(2, 9),
      email: email || undefined,
      name,
      role,
      isFarmer,
      farmName: isFarmer ? "Green Field Farm" : undefined,
      farmLocation: isFarmer ? "Rural Metro" : undefined,
    };
  };

  const login = async (
    phone: string,
    password: string,
    role?: "buyer" | "seller"
  ) => {
    if (isLoading) {
      console.debug(
        "[Auth] Login attempted while auth initialization is running"
      );
      throw new Error("Auth system is initializing");
    }

    setIsLoading(true);
    try {
      const response = await axios.post("/api/auth/login", { phone, password });

      const responseToken = response.data?.token;
      const userData = response.data?.user;
      if (!responseToken || !userData) {
        throw new Error("Login response missing token or user");
      }

      const normalizedRole = normalizeRole(userData.role);
      const normalizedUser: User = {
        ...userData,
        role: normalizedRole,
        isFarmer:
          userData.isFarmer ??
          (normalizedRole === "seller" ||
            String(userData.email || "").toLowerCase().includes("farmer")),
      };

      setAxiosAuthToken(responseToken);
      setToken(responseToken);
      setUser(normalizedUser);
      setIsAuthenticated(true);
      authErrorHandled.current = false;

      localStorage.setItem(AUTH_TOKEN_KEY, responseToken);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(normalizedUser));

      return normalizedUser;
    } catch (error: any) {
      let errorMessage = "Login failed. Please try again.";

      if (axios.isAxiosError(error)) {
        if (error.response?.data?.error) {
          errorMessage = String(error.response.data.error);
        } else if (error.code === "ECONNREFUSED" || error.message.includes("Network Error")) {
          errorMessage =
            "Unable to reach the authentication server. Make sure the backend is running on port 5000.";
        } else if (error.response?.status) {
          errorMessage = `Login failed (${error.response.status}). Please check your credentials and try again.`;
        } else if (error.message) {
          errorMessage = error.message;
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }

      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    phone: string,
    password: string,
    name: string,
    role?: "buyer" | "seller",
    email?: string,
    farmName?: string,
    farmLocation?: string,
    idType?: string,
    idFrontImage?: File,
    idBackImage?: File,
    idConsent?: boolean,
    onUploadProgress?: (progress: number) => void
  ) => {
    if (!phone || !password || !name) {
      throw new Error("Name, phone number, and password are required");
    }

    if (!/^09\d{9}$/.test(phone.trim())) {
      throw new Error("Phone number must start with 09 and contain 11 digits");
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    if (!idFrontImage || !idBackImage || !idConsent) {
      throw new Error("Both ID photos and consent are required.");
    }

    try {
      const formData = new FormData();
      formData.append("phone", phone.trim());
      formData.append("password", password);
      formData.append("name", name.trim());
      formData.append("role", role || "buyer");
      if (email?.trim()) formData.append("email", email.trim());
      if (farmName?.trim()) formData.append("farmName", farmName.trim());
      if (farmLocation?.trim()) formData.append("farmLocation", farmLocation.trim());
      formData.append("idType", idType?.trim() || "");
      formData.append("idConsent", "true");
      formData.append("idFront", idFrontImage);
      formData.append("idBack", idBackImage);

      const response = await axios.post("/api/auth/register", formData, {
        onUploadProgress: event => {
          if (event.total) onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
        },
      });
      const { user: userData } = response.data;

      const normalizedRole = normalizeRole(userData.role);
      const normalizedUser: User = {
        ...userData,
        role: normalizedRole,
        isFarmer:
          userData.isFarmer ??
          (normalizedRole === "seller" ||
            String(userData.email || "").toLowerCase().includes("farmer")),
      };

      return normalizedUser;
    } catch (error: any) {
      throw new Error(error.response?.data?.error || "Registration failed");
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    authErrorHandled.current = false;
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem("ecommerce_user");
    localStorage.removeItem("ecommerce_token");
    localStorage.removeItem("auth_token");
    setAxiosAuthToken(null);
    console.debug("[Auth] User logged out and storage cleared");
  };

  // Add axios interceptor to handle 401 errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        const status = error?.response?.status;
        const url = error?.config?.url;
        // Protected verification data is sensitive; clear the admin session if its token expires.
        if (status === 401 || status === 403) {
          if (
            url &&
            (url.includes("/api/auth/profile") ||
              url.includes("/api/login") ||
              url.includes("/api/register") ||
              (status === 401 && url.includes("/api/admin/verifications")))
          ) {
            if (!authErrorHandled.current) {
              authErrorHandled.current = true;
              console.warn("[Auth] Received an authorization error", { status, url });
              logout();
            }
          } else {
            console.warn("[Auth] A non-auth endpoint denied access", { status, url });
          }
        }
        // Log non-auth errors as well for tracing
        if (!status) {
          console.error("[Auth] Network request failed", { url });
        }
        return Promise.reject(error);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const updateProfile = (profile: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...profile };
      setUser(updatedUser);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated,
        isLoading,
        login,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Fail-safe: avoid crashing the entire app if provider is missing (HMR/circular import safe-guard)
    console.error(
      "useAuth must be used within AuthProvider — returning safe fallback"
    );
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      login: async () => {
        throw new Error("AuthProvider not initialized");
      },
      register: async () => {
        throw new Error("AuthProvider not initialized");
      },
      logout: () => {},
      updateProfile: () => {},
    } as AuthContextType;
  }
  return context;
}
