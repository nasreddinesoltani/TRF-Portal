
const mongoose = require('mongoose');
const CompetitionEntry = require('./backend/Models/competitionEntryModel.js');
async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/trf_portal', { useNewUrlParser: true, useUnifiedTopology: true }).catch(e => {
    return mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/RowingTunisia', { useNewUrlParser: true, useUnifiedTopology: true });
  });
  const entries = await CompetitionEntry.find({});
  let total = entries.length;
  let hasJourney = 0;
  let noJourney = 0;
  entries.forEach(e => {
    if (e.journeyIndex !== undefined && e.journeyIndex !== null) hasJourney++;
    else noJourney++;
  });
  console.log('Total entries:', total);
  console.log('With Journey:', hasJourney);
  console.log('Without Journey:', noJourney);
  if (noJourney > 0) {
    console.log('Sample without journey:', JSON.stringify(entries.find(e => e.journeyIndex == null)._id));
  }
  process.exit(0);
}
check().catch(console.error);

