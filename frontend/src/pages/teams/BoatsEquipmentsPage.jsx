import React from "react";
import TeamPage from "./TeamPage";

const BoatsEquipmentsPage = () => {
  return (
    <TeamPage title="Boats and Equipments">
      <div className="pub-doc__placeholder">
        <p>
          Information about boats and equipment (including boat leasing) for
          participating teams will be published here soon.
        </p>
        <p>
          For any enquiries in the meantime, please contact the Organizing
          Committee at{" "}
          <a className="pub-doc__link" href="mailto:ft.aviron@mjs.state.tn">
            ft.aviron@mjs.state.tn
          </a>
          .
        </p>
      </div>
    </TeamPage>
  );
};

export default BoatsEquipmentsPage;
