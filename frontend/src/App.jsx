import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";

// Lazy-loaded pages — each route gets its own chunk
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Register = lazy(() => import("./pages/Register"));
const LoginPage = lazy(() => import("./pages/Login"));
const PublicHome = lazy(() => import("./pages/PublicHome"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const CreateAthlete = lazy(() => import("./pages/CreateAthlete"));
const Clubs = lazy(() => import("./pages/Clubs"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const ImportAthletes = lazy(() => import("./pages/ImportAthletes"));
const CategoryManagement = lazy(() => import("./pages/CategoryManagement"));
const CountryManagement = lazy(() => import("./pages/CountryManagement"));
const BoatClassManagement = lazy(() => import("./pages/BoatClassManagement"));
const CompetitionManagement = lazy(
  () => import("./pages/CompetitionManagement"),
);
const CompetitionRaces = lazy(() => import("./pages/CompetitionRaces"));
const CompetitionRegistration = lazy(
  () => import("./pages/CompetitionRegistration"),
);
const CompetitionRankings = lazy(() => import("./pages/CompetitionRankings"));
const RankingSystemManagement = lazy(
  () => import("./pages/RankingSystemManagement"),
);
const BeachSprintCompetition = lazy(
  () => import("./pages/BeachSprintCompetition"),
);
const CompetitionDetail = lazy(() => import("./pages/CompetitionDetail"));
const RaceDetail = lazy(() => import("./pages/RaceDetail"));

function App() {
  return (
    <Router>
      <AuthProvider>
        <Navbar />
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
        <Suspense
          fallback={
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "60vh",
                fontSize: "1rem",
                color: "#888",
              }}
            >
              Loading…
            </div>
          }
        >
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<PublicHome />} />
            <Route path="/competition/:id" element={<CompetitionDetail />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <Analytics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clubs"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <Clubs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CategoryManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/boat-classes"
              element={
                <ProtectedRoute allowedRoles={["admin", "jury_president"]}>
                  <BoatClassManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "jury_president", "club_manager"]}
                >
                  <CompetitionManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:competitionId/races"
              element={
                <ProtectedRoute allowedRoles={["admin", "jury_president"]}>
                  <CompetitionRaces />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:competitionId/races/:raceId"
              element={
                <ProtectedRoute allowedRoles={["admin", "jury_president"]}>
                  <RaceDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:competitionId/rankings"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "jury_president", "club_manager"]}
                >
                  <CompetitionRankings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ranking-systems"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <RankingSystemManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/countries"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <CountryManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:competitionId/beach-sprint"
              element={
                <ProtectedRoute allowedRoles={["admin", "jury_president"]}>
                  <BeachSprintCompetition />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitions/:competitionId/register"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "jury_president", "club_manager"]}
                >
                  <CompetitionRegistration />
                </ProtectedRoute>
              }
            />
            <Route
              path="/clubs/:clubId"
              element={
                <ProtectedRoute
                  allowedRoles={["admin", "club_manager", "jury_president"]}
                >
                  <ClubDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/athletes/new"
              element={
                <ProtectedRoute allowedRoles={["admin", "club_manager"]}>
                  <CreateAthlete />
                </ProtectedRoute>
              }
            />
            <Route
              path="/athletes/import"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <ImportAthletes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </Router>
  );
}

export default App;
