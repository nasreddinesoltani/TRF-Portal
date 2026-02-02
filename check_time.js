import { getSeasonYear } from './backend/Services/categoryAssignmentService.js';

console.log('Current Date:', new Date().toISOString());
console.log('Season Year:', getSeasonYear());
process.exit(0);
