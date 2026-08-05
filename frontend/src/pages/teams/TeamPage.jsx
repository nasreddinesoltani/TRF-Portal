import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import "../../public.css";

/**
 * Shared layout for the public "Teams" information pages
 * (VISA, Accommodation, Transportation, Accreditation, Boats & Equipments).
 *
 * Props:
 *  - title:    Page heading
 *  - eyebrow:  Small label above the title (defaults to "Teams")
 *  - children: Page body content
 */
const TeamPage = ({ title, eyebrow = "Teams", children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [title]);

  return (
    <div className="pub-page pub-page--doc">
      <div className="pub-ambient" />

      <section className="pub-doc" style={{ position: "relative", zIndex: 1 }}>
        <div className="pub-container">
          <button
            className="pub-doc__back"
            onClick={() => navigate("/")}
            type="button"
          >
            <ArrowLeft size={15} />
            Back to Home
          </button>

          <div className="pub-doc__eyebrow">{eyebrow}</div>
          <h1 className="pub-doc__title">{title}</h1>
          <div className="pub-doc__accent" />

          <div className="pub-doc__body">{children}</div>
        </div>
      </section>

      <footer className="pub-footer">
        <div className="pub-container">
          <p className="pub-footer__text">
            © {new Date().getFullYear()}{" "}
            <span className="pub-footer__brand">
              Tunisian Rowing Federation
            </span>
            . All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default TeamPage;
