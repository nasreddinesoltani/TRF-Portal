import mongoose from "mongoose";

const officialResultEntrySchema = new mongoose.Schema(
  {
    athlete: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Athlete",
      required: true,
    },
    club: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Club",
    },
    athleteName: {
      type: String,
      trim: true,
    },
    athleteNameAr: {
      type: String,
      trim: true,
    },
    clubName: {
      type: String,
      trim: true,
    },
    lane: {
      type: Number,
      min: 1,
    },
    sourceRace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompetitionRace",
    },
    sourceRaceName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ok", "dns", "dnf", "dsq", "abs"],
      default: "ok",
    },
    elapsedMs: {
      type: Number,
      min: 0,
    },
    finishPosition: {
      type: Number,
      min: 1,
    },
    rank: {
      type: Number,
      min: 1,
    },
    points: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  { _id: false },
);

const officialResultSchema = new mongoose.Schema(
  {
    competition: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    eventGroupId: {
      type: String,
      required: true,
      trim: true,
    },
    eventLabel: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      index: true,
    },
    boatClass: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoatClass",
      index: true,
    },
    raceIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "CompetitionRace",
      default: () => [],
    },
    rankingSystem: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RankingSystem",
      },
      code: {
        type: String,
        trim: true,
      },
      nameEn: {
        type: String,
        trim: true,
      },
    },
    pointTable: {
      type: Map,
      of: Number,
      default: () => new Map(),
    },
    entries: {
      type: [officialResultEntrySchema],
      default: () => [],
    },
    totalParticipants: {
      type: Number,
      default: 0,
      min: 0,
    },
    publishedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    revision: {
      type: Number,
      default: 1,
      min: 1,
    },
    locked: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

officialResultSchema.index(
  { competition: 1, eventGroupId: 1 },
  { unique: true, name: "competition_event_group_official_unique" },
);

const OfficialResult = mongoose.model("OfficialResult", officialResultSchema);

export default OfficialResult;
