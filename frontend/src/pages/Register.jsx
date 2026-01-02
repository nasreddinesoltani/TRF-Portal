import { useNavigate } from "react-router-dom";
import RegistrationForm from "../components/RegistrationForm";
import { Button } from "../components/ui/button";

function Register() {
  const navigate = useNavigate();

  const handleUserAdded = () => {
    // Navigate back to dashboard after successful registration
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="mb-6">
        <Button variant="outline" onClick={() => navigate("/")}>
          ← Back to Dashboard
        </Button>
      </div>

      <div className="flex justify-center">
        <RegistrationForm onUserAdded={handleUserAdded} />
      </div>
    </div>
  );
}

export default Register;
