import mongoose from 'mongoose';
import fs from 'fs';

const uri = 'mongodb+srv://soltaninasro:tarajiste18486@cluster0.9zejq23.mongodb.net/test?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');
    
    // Competitions
    const CompetitionSchema = new mongoose.Schema({
      name: String,
      season: Number,
      startDate: Date,
      allowUpCategory: Boolean
    }, { collection: 'competitions' });
    const Competition = mongoose.model('Competition', CompetitionSchema);
    const competitions = await Competition.find().sort({ startDate: -1 }).limit(5).lean();
    
    // Categories
    const CategorySchema = new mongoose.Schema({
      abbreviation: String,
      gender: String,
      minAge: Number,
      maxAge: Number,
      type: String,
      isPara: Boolean
    }, { collection: 'categories' });
    const Category = mongoose.model('Category', CategorySchema);
    const categories = await Category.find({ type: 'national' }).lean();
    
    const result = {
      competitions,
      categories
    };
    
    fs.writeFileSync('d:/TRF-Portal/backend/debug_registration.json', JSON.stringify(result, null, 2));
    console.log('Results written to d:/TRF-Portal/backend/debug_registration.json');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
