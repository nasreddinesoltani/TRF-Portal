import mongoose from 'mongoose';
import { ensureNationalCategoryForAthlete, getSeasonYear } from './backend/Services/categoryAssignmentService.js';
import Athlete from './backend/Models/athleteModel.js';
import Category from './backend/Models/categoryModel.js';

const uri = 'mongodb+srv://soltaninasro:tarajiste18486@cluster0.9zejq23.mongodb.net/test?retryWrites=true&w=majority';

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected to DB');

    const athletes = await Athlete.find();
    console.log(`Processing ${athletes.length} athletes...`);

    let membershipsFixed = 0;
    let categoriesUpdated = 0;
    const cache = {};

    for (const athlete of athletes) {
      let athleteChanged = false;

      // 1. Fix missing membership seasons
      if (Array.isArray(athlete.memberships)) {
        athlete.memberships.forEach(m => {
          if (!m.season && m.startDate) {
            m.season = new Date(m.startDate).getFullYear();
            athleteChanged = true;
            membershipsFixed++;
          }
        });
      }

      if (athleteChanged) {
        athlete.markModified('memberships');
      }

      // 2. Re-calculate categories for 2025 and 2026
      const seasons = [2025, 2026];
      for (const season of seasons) {
        const changed = await ensureNationalCategoryForAthlete(athlete, season, cache);
        if (changed) {
          categoriesUpdated++;
        }
      }

      if (athleteChanged) {
        await athlete.save();
      }
    }

    console.log(`Summary:`);
    console.log(`- Memberships fixed: ${membershipsFixed}`);
    console.log(`- Category assignments updated/fixed: ${categoriesUpdated}`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
