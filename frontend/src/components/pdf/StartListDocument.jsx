import React from "react";
import { Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";

// Register the Arabic font
Font.register({
  family: "Amiri",
  src: "https://raw.githubusercontent.com/google/fonts/main/ofl/amiri/Amiri-Regular.ttf",
});

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Amiri",
    fontSize: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottom: "1 solid #000",
    paddingBottom: 5,
  },
  headerLeft: {
    flexDirection: "column",
    alignItems: "flex-start",
  },
  headerRight: {
    flexDirection: "column",
    alignItems: "flex-end",
  },
  titleSection: {
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titleLeft: {
    width: "20%",
    alignItems: "flex-start",
  },
  titleCenter: {
    width: "60%",
    alignItems: "center",
  },
  titleRight: {
    width: "20%",
    alignItems: "flex-end",
  },
  eventNum: {
    fontSize: 14,
    fontWeight: "bold",
  },
  eventLabel: {
    fontSize: 8,
    marginTop: 5,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 3,
  },
  arabicTitle: {
    fontSize: 12,
    marginBottom: 5,
  },
  eventCode: {
    fontSize: 12,
  },
  raceInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingTop: 5,
    borderTop: "1 solid #000",
    fontSize: 10,
  },
  table: {
    display: "table",
    width: "auto",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #eee",
    minHeight: 25,
    alignItems: "center",
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottom: "1 solid #000",
    borderTop: "1 solid #000",
    backgroundColor: "#fff",
    height: 25,
    alignItems: "center",
  },
  colLane: {
    width: "10%",
  },
  colClub: {
    width: "15%",
  },
  colName: {
    width: "35%",
  },
  colLicense: {
    width: "20%",
  },
  colDob: {
    width: "20%",
  },
  tableCellHeader: {
    margin: 5,
    fontSize: 9,
    fontWeight: "bold",
  },
  tableCell: {
    margin: 5,
    fontSize: 9,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: "center",
    fontSize: 8,
    borderTop: "1 solid #ccc",
    paddingTop: 10,
  },
});

const StartListDocument = ({
  race,
  competition,
  category,
  boatClass,
  lanes,
  dateStr,
  eventNum = "1",
  eventCode = "Code",
}) => {
  const catTitle = category?.titles?.en || "Category";
  const boatName = boatClass?.names?.en || "Boat";
  const fullEventName = `${catTitle} ${boatName}`;

  const catTitleAr = category?.titles?.ar || "";
  const boatNameAr = boatClass?.names?.ar || "";
  const fullEventNameAr = `${boatNameAr} ${catTitleAr}`.trim();

  const raceName = race.name || `Race ${race.order}`;

  let startTimeStr = "00:00";
  if (race.startTime) {
    const d = new Date(race.startTime);
    const hours = d.getHours().toString().padStart(2, "0");
    const minutes = d.getMinutes().toString().padStart(2, "0");
    startTimeStr = `${hours}:${minutes}`;
  }

  // Resolve location string safely
  let locationStr = "Location";
  if (competition?.location) {
    if (typeof competition.location === "string") {
      locationStr = competition.location;
    } else if (typeof competition.location === "object") {
      locationStr =
        competition.location.city || competition.location.name || "Location";
    }
  } else if (competition?.venue) {
    if (typeof competition.venue === "string") {
      locationStr = competition.venue;
    } else if (typeof competition.venue === "object") {
      locationStr = competition.venue.name || "Location";
    }
  }

  return (
    <Page size="A4" style={styles.page}>
      {/* Header Info */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text>{locationStr}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text>{dateStr}</Text>
        </View>
      </View>

      {/* Titles */}
      <View style={styles.titleSection}>
        <View style={styles.titleLeft}>
          <Text style={styles.eventNum}>{eventNum}</Text>
          <Text style={styles.eventLabel}>(Event)</Text>
        </View>
        <View style={styles.titleCenter}>
          <Text style={styles.mainTitle}>Start List</Text>
          <Text style={styles.subTitle}>{fullEventName}</Text>
          {fullEventNameAr ? (
            <Text style={styles.arabicTitle}>{fullEventNameAr}</Text>
          ) : null}
        </View>
        <View style={styles.titleRight}>
          <Text style={styles.eventCode}>{eventCode}</Text>
        </View>
      </View>

      {/* Race Info Bar */}
      <View style={styles.raceInfo}>
        <Text>Start Time: {startTimeStr}</Text>
        <Text>As of {dateStr}</Text>
        <Text>{raceName}</Text>
      </View>

      {/* Table */}
      <View style={styles.table}>
        {/* Table Header */}
        <View style={styles.tableHeaderRow}>
          <View style={styles.colLane}>
            <Text style={styles.tableCellHeader}>Lane</Text>
          </View>
          <View style={styles.colClub}>
            <Text style={styles.tableCellHeader}>Club</Text>
          </View>
          <View style={styles.colName}>
            <Text style={styles.tableCellHeader}>Name</Text>
          </View>
          <View style={styles.colLicense}>
            <Text style={styles.tableCellHeader}>License</Text>
          </View>
          <View style={styles.colDob}>
            <Text style={styles.tableCellHeader}>DOB</Text>
          </View>
        </View>

        {/* Table Body */}
        {lanes.map((lane, index) => (
          <View style={styles.tableRow} key={index}>
            <View style={styles.colLane}>
              <Text style={styles.tableCell}>{lane.lane}</Text>
            </View>
            <View style={styles.colClub}>
              <Text style={styles.tableCell}>{lane.clubCode}</Text>
            </View>
            <View style={styles.colName}>
              <Text style={styles.tableCell}>{lane.athleteName}</Text>
            </View>
            <View style={styles.colLicense}>
              <Text style={styles.tableCell}>{lane.license}</Text>
            </View>
            <View style={styles.colDob}>
              <Text style={styles.tableCell}>{lane.dob}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text>
          Progression System: 1-2 to Final A, 3-4 to Final B, others eliminated.
        </Text>
      </View>
    </Page>
  );
};

export default StartListDocument;
