import React from "react";
import TeamPage from "./TeamPage";

const ROOM_RATES = [
  // { label: "Triple Rooms (*)", price: "85 €" },
  { label: "Double Rooms (*)", price: "90 €" },
  { label: "Single Rooms (*)", price: "120 €" },
  { label: "Superior Single Rooms (*)", price: "150 €" },
];

const AccommodationPage = () => {
  return (
    <TeamPage title="Accommodation">
      <p className="pub-doc__lead">
        The OC has appointed the Hotel El Mouradi Gammarth as the official hotel
        for the events. The Hotel is located 18 km away and a 20-minute drive
        from the Lake of Tunis venue.
      </p>

      <p>
        All accommodation should be booked through the organizing committee.
        Please fill in the accommodation form or send your request to{" "}
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
          href="/documents/Hotel-Accommodation.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Hotel-Accommodation
        </a>
        .
      </p>

      <div className="pub-table-wrap" style={{ margin: "8px 0 16px" }}>
        <table className="pub-table">
          <thead>
            <tr>
              {ROOM_RATES.map((room) => (
                <th key={room.label}>{room.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {ROOM_RATES.map((room) => (
                <td
                  key={room.label}
                  className="col-time"
                  style={{ textAlign: "left" }}
                >
                  {room.price}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <p className="pub-doc__note">(*) Price per person per night</p>

      <h2 className="pub-doc__subtitle">Transport</h2>
      <p>
        Transport from and back the Tunis Carthage airport and Hotel El Mouradi
        Gammarth are included in the price of accommodation indicated above. (
        <a className="pub-doc__link" href="/teams/transportation">
          More information
        </a>
        )
      </p>
    </TeamPage>
  );
};

export default AccommodationPage;
