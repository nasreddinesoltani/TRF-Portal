import React from "react";
import TeamPage from "./TeamPage";

const TransportationPage = () => {
  return (
    <TeamPage title="Transportation">
      <p className="pub-doc__lead">Airport transfers</p>

      <p>
        An airport-hotel transfer service will be available for teams who booked
        their hotels via the Organizing Committee. This service must be booked
        in advance.
      </p>

      <p>
        Transport between the Tunis Carthage International Airport and Hotel El
        Mouradi Gammarth will be provided by the Organizing Committee from 22nd
        September until 5th October 2026.
      </p>

      <p>
        Please submit your request using the attached form (
        <a
          className="pub-doc__link"
          href="/documents/Tunis-Airport_Transport_Request.xlsx"
          target="_blank"
          rel="noreferrer"
        >
          Tunis-Airport_Transport_Request
        </a>{" "}
        ) no later than{" "}
        <strong className="pub-doc__highlight">September 1st, 2026</strong> at:{" "}
        <a className="pub-doc__link" href="mailto:ft.aviron@mjs.state.tn">
          ft.aviron@mjs.state.tn
        </a>{" "}
        and Cc to{" "}
        <a className="pub-doc__link" href="mailto:faysal.soula@gmail.com">
          faysal.soula@gmail.com
        </a>
        .
      </p>
    </TeamPage>
  );
};

export default TransportationPage;
