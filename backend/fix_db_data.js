import mongoose from 'mongoose';
import { ensureNationalCategoryForAthlete } from './Services/categoryAssignmentService.js';
import Athlete from './Models/athleteModel.js';

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
      const originalMemberships = athlete.memberships || [];
      const updatedMemberships = [];

      for (const m of originalMemberships) {
        const mObj = m.toObject ? m.toObject() : m;
        if (!mObj.season && mObj.startDate) {
          mObj.season = new Date(mObj.startDate).getFullYear();
          membershipsFixed++;
          athleteChanged = true;
        }
        updatedMemberships.push(mObj);
      }

      if (athleteChanged) {
        athlete.memberships = updatedMemberships;
        // Use markModified if needed, though replacing the array should work
        athlete.markModified('memberships');
      }

      // Re-calculate categories for 2025 and 2026
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
