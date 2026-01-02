import BoatClass from "../Models/boatClassModel.js";

export const DEFAULT_BOAT_CLASSES = [
  {
    code: "1X",
    discipline: "classic",
    names: {
      en: "Single Scull",
      fr: "Skiff",
      ar: "سكيف فردي",
    },
    crewSize: 1,
    sculling: true,
    coxswain: false,
    weightClass: "open",
  },
  {
    code: "2X",
    discipline: "classic",
    names: {
      en: "Double Scull",
      fr: "Deux de couple",
      ar: "زورق ثنائي مجداف مزدوج",
    },
    crewSize: 2,
    sculling: true,
    coxswain: false,
    weightClass: "open",
  },
  {
    code: "2-",
    discipline: "classic",
    names: {
      en: "Coxless Pair",
      fr: "Deux sans barreur",
      ar: "زورق ثنائي بدون ملاح",
    },
    crewSize: 2,
    sculling: false,
    coxswain: false,
    weightClass: "open",
  },
  {
    code: "2+",
    discipline: "classic",
    names: {
      en: "Coxed Pair",
      fr: "Deux avec barreur",
      ar: "زورق ثنائي مع ملاح",
    },
    crewSize: 3,
    sculling: false,
    coxswain: true,
    weightClass: "open",
  },
  {
    code: "4X",
    discipline: "classic",
    names: {
      en: "Quadruple Scull",
      fr: "Quatre de couple",
      ar: "زورق رباعي مجداف مزدوج",
    },
    crewSize: 4,
    sculling: true,
    coxswain: false,
    weightClass: "open",
  },
  {
    code: "4-",
    discipline: "classic",
    names: {
      en: "Coxless Four",
      fr: "Quatre sans barreur",
      ar: "زورق رباعي بدون ملاح",
    },
    crewSize: 4,
    sculling: false,
    coxswain: false,
    weightClass: "open",
  },
  {
    code: "4+",
    discipline: "classic",
    names: {
      en: "Coxed Four",
      fr: "Quatre avec barreur",
      ar: "زورق رباعي مع ملاح",
    },
    crewSize: 5,
    sculling: false,
    coxswain: true,
    weightClass: "open",
  },
  {
    code: "8+",
    discipline: "classic",
    names: {
      en: "Eight with Coxswain",
      fr: "Huit avec barreur",
      ar: "زورق ثماني مع ملاح",
    },
    crewSize: 9,
    sculling: false,
    coxswain: true,
    weightClass: "open",
  },
  {
    code: "LW1X",
    discipline: "classic",
    names: {
      en: "Lightweight Single Scull",
      fr: "Skiff poids léger",
      ar: "سكيف فردي خفيف الوزن",
    },
    crewSize: 1,
    sculling: true,
    weightClass: "lightweight",
  },
  {
    code: "LW2X",
    discipline: "classic",
    names: {
      en: "Lightweight Double Scull",
      fr: "Deux de couple poids léger",
      ar: "زورق ثنائي خفيف الوزن",
    },
    crewSize: 2,
    sculling: true,
    weightClass: "lightweight",
  },
  {
    code: "CW1X",
    discipline: "coastal",
    names: {
      en: "Coastal Women's Single",
      fr: "Solo côtier féminin",
      ar: "قارب ساحلي فردي سيدات",
    },
    crewSize: 1,
    sculling: true,
    weightClass: "open",
    tags: ["coastal"],
  },
  {
    code: "CM1X",
    discipline: "coastal",
    names: {
      en: "Coastal Men's Single",
      fr: "Solo côtier masculin",
      ar: "قارب ساحلي فردي رجال",
    },
    crewSize: 1,
    sculling: true,
    weightClass: "open",
    tags: ["coastal"],
  },
  {
    code: "CMIX2X",
    discipline: "coastal",
    names: {
      en: "Coastal Mixed Double",
      fr: "Double mixte côtier",
      ar: "قارب مزدوج ساحلي مختلط",
    },
    crewSize: 2,
    sculling: true,
    weightClass: "open",
    tags: ["coastal"],
  },
  {
    code: "C4X+",
    discipline: "coastal",
    names: {
      en: "Coastal Quad with Coxswain",
      fr: "Quatre de couple côtier avec barreur",
      ar: "قارب رباعي ساحلي مع ملاح",
    },
    crewSize: 5,
    sculling: true,
    coxswain: true,
    weightClass: "open",
    tags: ["coastal"],
  },
  // Note: Beach Sprint events use coastal boats (CM1x, CW1x, CMix2x) on beach courses
  // The discipline field on competitions distinguishes beach sprint from coastal rowing
  {
    code: "IR-1",
    discipline: "indoor",
    names: {
      en: "Individual Ergometer",
      fr: "Ergomètre individuel",
      ar: "إرجوميتر فردي",
    },
    crewSize: 1,
    relay: false,
    weightClass: "open",
    tags: ["indoor"],
  },
  {
    code: "IR-TEAM",
    discipline: "indoor",
    names: {
      en: "Team Ergometer Relay",
      fr: "Relais ergomètre par équipe",
      ar: "تتابع إرجوميتر جماعي",
    },
    crewSize: 4,
    relay: true,
    weightClass: "open",
    tags: ["indoor"],
  },
];

export const seedDefaultBoatClasses = async () => {
  for (const boatClass of DEFAULT_BOAT_CLASSES) {
    await BoatClass.findOneAndUpdate(
      { code: boatClass.code },
      {
        ...boatClass,
        allowedGenders: boatClass.allowedGenders || ["men", "women", "mixed"],
        isActive: true,
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );
  }
};
