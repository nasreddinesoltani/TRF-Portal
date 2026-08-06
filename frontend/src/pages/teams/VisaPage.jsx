import React from "react";
import TeamPage from "./TeamPage";

const VisaPage = () => {
  return (
    <TeamPage title="If you need a VISA for entry to Tunisia">
      <p className="pub-doc__lead">
        Teams who require an invitation in order to obtain visa for entry to
        Tunisia to attend the 2026 Tunisia Rowing Events 27 September to 4
        October 2026 must provide the following information for all team members
        including rowers, coaches, technical staff, etc. to the Organizing
        Committee:
      </p>

      <ol className="pub-doc__list">
        <li>Name</li>
        <li>Date of birth</li>
        <li>Passport number</li>
        <li>Passport expiry date</li>
        <li>Arrival and departure dates</li>
      </ol>

      <p>
        On receipt of our invitation you will need to make an appointment with
        the Tunisian Embassy in your country where the visas will normally be
        issued approximately two weeks later.
      </p>

      <p>
        Countries that have no Tunisian Consulate in their territory may apply
        for the visa at Tunis Carthage International airport on arrival and also
        requires for a guarantee letter for obtaining a visa in Tunis to present
        to the airline company for leaving their country.
      </p>

      <p>
        Please submit your request using the attached form (
        <a
          className="pub-doc__link"
          href="/documents/VISA_Form_Request.xlsx"
          target="_blank"
          rel="noreferrer"
        >
          VISA_Form_Request
        </a>
        ) no later than{" "}
        <strong className="pub-doc__highlight">August 24th, 2026</strong> at:{" "}
        <a className="pub-doc__link" href="mailto:ft.aviron@mjs.state.tn">
          ft.aviron@mjs.state.tn
        </a>{" "}
        and Cc to{" "}
        <a className="pub-doc__link" href="mailto:faysal.soula@gmail.com">
          faysal.soula@gmail.com
        </a>
      </p>

      <p>
        If you have any queries or need any further information please do not
        hesitate to contact us at{" "}
        <a className="pub-doc__link" href="mailto:ft.aviron@mjs.state.tn">
          ft.aviron@mjs.state.tn
        </a>
        .
      </p>
    </TeamPage>
  );
};

export default VisaPage;
