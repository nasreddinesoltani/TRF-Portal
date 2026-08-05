import React from "react";
import TeamPage from "./TeamPage";

const AccreditationPage = () => {
  return (
    <TeamPage title="Accreditation">
      <p className="pub-doc__lead">
        The accreditation should be made through the organizing committee.
        Please fill in the accreditation form or send your request to{" "}
        <a className="pub-doc__link" href="mailto:ft.aviron@mjs.state.tn">
          ft.aviron@mjs.state.tn
        </a>{" "}
        and Cc to{" "}
        <a className="pub-doc__link" href="mailto:faysal.soula@gmail.com">
          faysal.soula@gmail.com
        </a>{" "}
        no later than{" "}
        <strong className="pub-doc__highlight">September 1st, 2026</strong>.
        Please submit your request using the attached form{" "}
        <a
          className="pub-doc__link"
          href="/documents/Accreditation_Application_Form.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Accreditation Application Form
        </a>
        .
      </p>
    </TeamPage>
  );
};

export default AccreditationPage;
