import mongoose from 'mongoose';

const uri = 'mongodb+srv://soltaninasro:tarajiste18486@cluster0.9zejq23.mongodb.net/test?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(uri);
    
    const Category = mongoose.model('Category', new mongoose.Schema({
        abbreviation: String,
        titles: Object
    }, { strict: false }));
    
    const BoatClass = mongoose.model('BoatClass', new mongoose.Schema({
        code: String,
        weightClass: String,
        names: Object
    }, { strict: false }));
    
    const Athlete = mongoose.model('Athlete', new mongoose.Schema({}, { strict: false }));
    
    const Entry = mongoose.model('CompetitionEntry', new mongoose.Schema({
        athlete: { type: mongoose.Schema.Types.ObjectId, ref: 'Athlete' },
        category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        boatClass: { type: mongoose.Schema.Types.ObjectId, ref: 'BoatClass' }
    }, { strict: false }));

    const athlete = await Athlete.findOne({ lastName: 'Krimi', firstName: 'Mohamed' });
    if (athlete) {
      const entries = await Entry.find({ athlete: athlete._id }).populate('category boatClass');
      console.log('Entries found:', entries.length);
      entries.forEach(entry => {
        console.log(`ENTRY ID: ${entry._id}`);
        console.log(`  Category: ${entry.category?.abbreviation}`);
        console.log(`  Boat Class: ${entry.boatClass?.code} (${entry.boatClass?.names?.en})`);
        console.log(`  Weight Class: ${entry.boatClass?.weightClass}`);
      });
    } else {
        console.log('Athlete not found');
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
