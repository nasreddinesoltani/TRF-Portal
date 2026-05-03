
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/RowingTunisia';

async function check() {
  await mongoose.connect(dbURI);
  
  // Since we require commonJS, we will just query manually without loading the model
  const db = mongoose.connection.db;
  const entries = await db.collection('competitionentries').find({}).toArray();
  
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
  process.exit(0);
}
check().catch(console.error);

