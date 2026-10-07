import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout, { Protected } from "./components/ProtectedRoute";
import Onboarding from "./pages/Onboarding";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Today from "./pages/Today";
import CalendarPage from "./pages/CalendarPage";
import Articles from "./pages/Articles";
import ArticleDetail from "./pages/ArticleDetail";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

function RootRedirect() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  const onboardingDone = localStorage.getItem("onboarding_completed") === "true";

  if (!onboardingDone) return <Navigate to="/onboarding" replace />;
  if (isAuthenticated) return <Navigate to="/today" replace />;
  return <Landing />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<Layout />}>
              <Route
                path="/today"
                element={
                  <Protected>
                    <Today />
                  </Protected>
                }
              />
              <Route
                path="/calendar"
                element={
                  <Protected>
                    <CalendarPage />
                  </Protected>
                }
              />
              <Route path="/articles" element={<Articles />} />
              <Route path="/articles/:slug" element={<ArticleDetail />} />
              <Route
                path="/account"
                element={
                  <Protected>
                    <Account />
                  </Protected>
                }
              />
            </Route>

            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}