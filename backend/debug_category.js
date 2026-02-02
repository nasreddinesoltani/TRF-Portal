import mongoose from 'mongoose';
import fs from 'fs';

const schema = new mongoose.Schema({
  abbreviation: String,
  titles: Object,
  gender: String,
  minAge: Number,
  maxAge: Number,
  isPara: Boolean,
  type: String,
  isActive: Boolean
}, { collection: 'categories' });

const Category = mongoose.model('Category', schema);

const AthleteSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  gender: String,
  birthDate: Date,
  categoryAssignments: Array
}, { collection: 'athletes' });
const Athlete = mongoose.model('Athlete', AthleteSchema);

const uri = 'mongodb+srv://soltaninasro:tarajiste18486@cluster0.9zejq23.mongodb.net/test?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    const docs = await Category.find({ type: 'national' }).lean();
    const specificDocs = await Category.find({ abbreviation: { $in: ['JW', 'JMIX', 'Jmix', 'JMix', 'JM'] } }).lean();
    const meriem = await Athlete.findOne({ firstName: /Meriem/i, lastName: /Bouchoucha/i }).lean();
    
    const result = {
      allAbbreviations: docs.map(d => d.abbreviation),
      specificDocs,
      meriem
    };
    
    fs.writeFileSync('d:/TRF-Portal/backend/debug_output.json', JSON.stringify(result, null, 2));
    console.log('Results written to d:/TRF-Portal/backend/debug_output.json');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
