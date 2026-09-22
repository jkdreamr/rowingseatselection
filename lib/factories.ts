import { createSeats, type Boat, type BoatClassId, type Session } from './types';
import { today } from './format';
import { uid } from './ids';

export function newBoat(index: number, classId: BoatClassId = '8+'): Boat {
  return {
    id: uid('boat'),
    classId,
    name: `Boat ${index}`,
    seats: createSeats(classId),
    coxswainId: null,
    coxPosition: 'stern',
    notes: '',
  };
}

export function newSession(date = today(), label = 'AM'): Session {
  const timestamp = new Date().toISOString();
  return {
    id: uid('session'),
    date,
    label,
    boats: [],
    notes: '',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
