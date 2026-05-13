import '../server/db/db';
import { db } from '../server/db/db';
import { weatherLocations } from '../shared/types/schema';

await db.insert(weatherLocations).values({
  name:      'Благовещенск',
  nameEn:    'Blagoveshchensk',
  country:   'Russia',
  latitude:  '50.29011',
  longitude: '127.52722',
  timezone:  'Asia/Yakutsk',
  sortOrder: 51,
  isActive:  true,
}).onConflictDoNothing();

console.log('Done.');
process.exit(0);
