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
import Dashboard from "./pages/Dashboard";
import Register from "./pages/Register";
import LoginPage from "./pages/Login";
import Analytics from "./pages/Analytics";
import ChangePassword from "./pages/ChangePassword";
import CreateAthlete from "./pages/CreateAthlete";
import Clubs from "./pages/Clubs";
import ClubDetail from "./pages/ClubDetail";
import ImportAthletes from "./pages/ImportAthletes";
import CategoryManagement from "./pages/CategoryManagement";
import BoatClassManagement from "./pages/BoatClassManagement";
import CompetitionManagement from "./pages/CompetitionManagement";
import CompetitionRaces from "./pages/CompetitionRaces";
import CompetitionRegistration from "./pages/CompetitionRegistration";
import CompetitionRankings from "./pages/CompetitionRankings";
import RankingSystemManagement from "./pages/RankingSystemManagement";
import BeachSprintCompetition from "./pages/BeachSprintCompetition";
import RaceDetail from "./pages/RaceDetail";

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
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
      </AuthProvider>
    </Router>
  );
}

export default App;
