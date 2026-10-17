import { CourseSyllabusData, MathSyllabusDay } from './recurring-planner';

export interface RawPhysicalScienceClassItem {
  class_num: number;
  week_num: number;
  unit: string;
  topic: string;
  activity?: string;
  supplies?: string[];
}

export const PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES: Record<string, string[]> = {
  'Data Collection': [
    '3 objects of different size and weight',
    'A pot of cool/cold water',
    'A pot of hot water',
    'A postage or food scale',
    'A tape measure and/or ruler',
    'A thermometer',
  ],
  'Making a Ball-and-Stick Diagram': [
    'Cotton balls, clay or marshmallows (or similar for the “balls”)',
    'Toothpicks, pipe cleaners, twigs or pencils (or similar for the “sticks”)',
    'Glue',
  ],
  'Periodic Table of Elements, Build a Box': [
    'Sheet of paper: can be plain white or colored',
    'Something to color with: Crayons, markers, colored pencils, watercolor paint, etc.',
  ],
  Oobleck: [
    'Cornstarch',
    'Water',
    'A glass mixing bowl',
    'A spoon (not a wooden one)',
    'Measuring cups',
  ],
  'Elephant Toothpaste': [
    'Liquid dish soap',
    'Hydrogen peroxide (3% or 6%; 6% will result in a bigger reaction)',
    'Dry yeast',
    'Empty plastic soda bottle',
    'Measuring cups and spoons',
    'Warm water',
    'Safety glasses',
    'A tray to catch the foam',
    'Bonus: food coloring',
  ],
  'Push, Pull, Gravity': [
    'A toy car',
    'A tennis ball (or other soft object you can throw and bounce on the floor)',
    'String',
    'A small wooden board or piece of sturdy cardboard (several inches wide and at least one foot long)',
  ],
  'Vectors in Sports': [
    'Something to draw with: can be a pen or pencil, or crayons, markers, etc.',
  ],
  'Friction and Ice': [
    'A baking sheet',
    'Water',
    'A freezer',
    'A wooden board at least 6 inches wide and 2 feet long',
    'The countertop and/or table top or floor/garage/driveway',
    'At least 3 random objects that are not round and so will slide—not roll—when pushed across three different surfaces',
  ],
  Buoyancy: [
    'Something large filled with water, like a bucket, sink, or bathtub',
    '3 random objects from around your home that can get wet',
  ],
  'Paper Airplanes': ['Paper'],
  'Light Bulb': ['A balloon', 'A CFL light bulb', 'A dark room'],
  Magnets: [
    'A magnet',
    'A nail',
    'A piece of wood',
    'An aluminum can',
    'A metal key',
    '1 random object',
  ],
  'Identifying Energy': [
    'Workbook and a pen or pencil (no additional materials needed)',
  ],
  'Telescope Practicum': ['Telescope or binoculars'],
  'Periodic Table of the Solar System': [
    'A piece of paper: regular letter size is fine, but legal or ledger size would be even better!',
    'Something to color with: Crayons, markers, colored pencils, watercolor paint, etc.',
  ],
  'Star Projector': [
    'A paper bag',
    'A needle (various gauges/thicknesses, if available)',
    'A flashlight',
    'A dark room',
  ],
  'Galaxy Shapes': [
    'Cardboard box',
    'Glitter',
    'Glue',
    'Something to write with',
    'Paper: black paper is best, but you can be creative with other colors!',
  ],
  'Constellation Connect the Dots': [
    'Your star projector (optional)',
    'Workbook and a pen or pencil',
  ],
};

export function getPhysicalScienceActivitySupplies(activityName?: string | null): string[] {
  if (!activityName || !activityName.trim()) return [];
  const clean = activityName.replace(/^Activity:\s*/i, '').trim();
  if (PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES[clean]) {
    return PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES[clean];
  }
  const withoutPart = clean.replace(/,\s*Part\s+\d+$/i, '').trim();
  if (PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES[withoutPart]) {
    return PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES[withoutPart];
  }
  const lower = withoutPart.toLowerCase();
  for (const [key, list] of Object.entries(PHYSICAL_SCIENCE_ACTIVITY_SUPPLIES)) {
    if (
      lower.includes(key.toLowerCase()) ||
      key.toLowerCase().includes(lower)
    ) {
      return list;
    }
  }
  return ['Workbook and a pen or pencil'];
}

export const PHYSICAL_SCIENCE_105_CLASSES: RawPhysicalScienceClassItem[] = [
  // WEEK 1 — INTRODUCTION
  {
    class_num: 1,
    week_num: 1,
    unit: 'Introduction',
    topic: 'Physical Science: Introduction, Part 1',
  },
  {
    class_num: 2,
    week_num: 1,
    unit: 'Introduction',
    topic: 'Physical Science: Introduction, Part 2',
  },
  {
    class_num: 3,
    week_num: 1,
    unit: 'Introduction',
    topic: 'Physical Science: Introduction, Part 3',
    activity: 'Data Collection',
  },

  // WEEK 2 — CHEMISTRY
  {
    class_num: 4,
    week_num: 2,
    unit: 'Chemistry',
    topic: 'Introduction',
  },
  {
    class_num: 5,
    week_num: 2,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Introduction',
  },
  {
    class_num: 6,
    week_num: 2,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Molecules',
    activity: 'Making a Ball-and-Stick Diagram',
  },

  // WEEK 3 — CHEMISTRY
  {
    class_num: 7,
    week_num: 3,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Introduction to Atoms',
  },
  {
    class_num: 8,
    week_num: 3,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Atoms',
  },
  {
    class_num: 9,
    week_num: 3,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Atoms and Charge',
  },

  // WEEK 4 — CHEMISTRY
  {
    class_num: 10,
    week_num: 4,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Atoms and Why They Don’t Fly Apart',
  },
  {
    class_num: 11,
    week_num: 4,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Building Matter From the Ground Up',
  },
  {
    class_num: 12,
    week_num: 4,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Elemental and Compound Matter',
  },

  // WEEK 5 — CHEMISTRY
  {
    class_num: 13,
    week_num: 5,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 1',
    activity: 'Periodic Table of Elements, Build a Box',
  },
  {
    class_num: 14,
    week_num: 5,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 2',
    activity: 'Periodic Table of Elements, Build a Box, Part 2',
  },
  {
    class_num: 15,
    week_num: 5,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 3',
  },

  // WEEK 6 — CHEMISTRY
  {
    class_num: 16,
    week_num: 6,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 4',
    activity: 'Periodic Table of Elements, Build a Box, Part 3',
  },
  {
    class_num: 17,
    week_num: 6,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 5',
  },
  {
    class_num: 18,
    week_num: 6,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 6',
    activity: 'Periodic Table of Elements, Build a Box, Part 4',
  },

  // WEEK 7 — CHEMISTRY
  {
    class_num: 19,
    week_num: 7,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 7',
    activity: 'Periodic Table of Elements, Build a Box, Part 5',
  },
  {
    class_num: 20,
    week_num: 7,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Periodic Table of Elements, Part 8',
    activity: 'Periodic Table of Elements, Build a Box, Part 6',
  },
  {
    class_num: 21,
    week_num: 7,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Review',
  },

  // WEEK 8 — CHEMISTRY
  {
    class_num: 22,
    week_num: 8,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Bonds, Part 1',
  },
  {
    class_num: 23,
    week_num: 8,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Bonds, Part 2',
  },
  {
    class_num: 24,
    week_num: 8,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, Bonds, Part 3',
  },

  // WEEK 9 — CHEMISTRY
  {
    class_num: 25,
    week_num: 9,
    unit: 'Chemistry',
    topic: 'Matter and How It’s Made, The Chemical Formula',
  },
  {
    class_num: 26,
    week_num: 9,
    unit: 'Chemistry',
    topic: 'States of Matter',
    activity: 'Oobleck',
  },
  {
    class_num: 27,
    week_num: 9,
    unit: 'Chemistry',
    topic: 'Physical Changes to Matter, Part 1',
  },

  // WEEK 10 — CHEMISTRY
  {
    class_num: 28,
    week_num: 10,
    unit: 'Chemistry',
    topic: 'Physical Changes to Matter, Part 2',
  },
  {
    class_num: 29,
    week_num: 10,
    unit: 'Chemistry',
    topic: 'Physical Changes to Matter, Part 3',
  },
  {
    class_num: 30,
    week_num: 10,
    unit: 'Chemistry',
    topic: 'Physical Changes to Matter, Part 4',
  },

  // WEEK 11 — CHEMISTRY
  {
    class_num: 31,
    week_num: 11,
    unit: 'Chemistry',
    topic: 'Chemical Changes in Matter, Part 1',
  },
  {
    class_num: 32,
    week_num: 11,
    unit: 'Chemistry',
    topic: 'Chemical Changes in Matter, Part 2',
  },
  {
    class_num: 33,
    week_num: 11,
    unit: 'Chemistry',
    topic: 'Chemical Changes in Matter, Part 3',
  },

  // WEEK 12 — CHEMISTRY
  {
    class_num: 34,
    week_num: 12,
    unit: 'Chemistry',
    topic: 'Chemical Changes in Matter, Signs of a Chemical Reaction',
    activity: 'Elephant Toothpaste',
  },
  {
    class_num: 35,
    week_num: 12,
    unit: 'Chemistry',
    topic: 'Review, Part 1',
  },
  {
    class_num: 36,
    week_num: 12,
    unit: 'Chemistry',
    topic: 'Review, Part 2',
  },

  // WEEK 13 — PHYSICS
  {
    class_num: 37,
    week_num: 13,
    unit: 'Physics',
    topic: 'Introduction',
  },
  {
    class_num: 38,
    week_num: 13,
    unit: 'Physics',
    topic: 'History, Part 1',
  },
  {
    class_num: 39,
    week_num: 13,
    unit: 'Physics',
    topic: 'History, Part 2',
  },

  // WEEK 14 — PHYSICS
  {
    class_num: 40,
    week_num: 14,
    unit: 'Physics',
    topic: 'Introduction to Forces, Part 1',
  },
  {
    class_num: 41,
    week_num: 14,
    unit: 'Physics',
    topic: 'Introduction to Forces, Part 2',
    activity: 'Push, Pull, Gravity',
  },
  {
    class_num: 42,
    week_num: 14,
    unit: 'Physics',
    topic: 'Gravity, Part 1',
  },

  // WEEK 15 — PHYSICS
  {
    class_num: 43,
    week_num: 15,
    unit: 'Physics',
    topic: 'Gravity, Part 2',
  },
  {
    class_num: 44,
    week_num: 15,
    unit: 'Physics',
    topic: 'Gravity, Part 3',
  },
  {
    class_num: 45,
    week_num: 15,
    unit: 'Physics',
    topic: 'Gravity, Part 4',
  },

  // WEEK 16 — PHYSICS
  {
    class_num: 46,
    week_num: 16,
    unit: 'Physics',
    topic: 'Vectors, Part 1',
  },
  {
    class_num: 47,
    week_num: 16,
    unit: 'Physics',
    topic: 'Vectors, Part 2',
    activity: 'Vectors in Sports',
  },
  {
    class_num: 48,
    week_num: 16,
    unit: 'Physics',
    topic: 'Vectors, Part 3',
  },

  // WEEK 17 — PHYSICS
  {
    class_num: 49,
    week_num: 17,
    unit: 'Physics',
    topic: 'Forces',
  },
  {
    class_num: 50,
    week_num: 17,
    unit: 'Physics',
    topic: 'Newton’s 3rd Law of Motion, Part 1',
  },
  {
    class_num: 51,
    week_num: 17,
    unit: 'Physics',
    topic: 'Newton’s 3rd Law of Motion, Part 2',
  },

  // WEEK 18 — PHYSICS
  {
    class_num: 52,
    week_num: 18,
    unit: 'Physics',
    topic: 'The Normal Force, Part 1',
  },
  {
    class_num: 53,
    week_num: 18,
    unit: 'Physics',
    topic: 'The Normal Force, Part 2',
  },
  {
    class_num: 54,
    week_num: 18,
    unit: 'Physics',
    topic: 'Tension Force, Part 1',
  },

  // WEEK 19 — PHYSICS
  {
    class_num: 55,
    week_num: 19,
    unit: 'Physics',
    topic: 'Tension Force, Part 2',
  },
  {
    class_num: 56,
    week_num: 19,
    unit: 'Physics',
    topic: 'Friction Force, Part 1',
  },
  {
    class_num: 57,
    week_num: 19,
    unit: 'Physics',
    topic: 'Friction Force, Part 2',
  },

  // WEEK 20 — PHYSICS
  {
    class_num: 58,
    week_num: 20,
    unit: 'Physics',
    topic: 'Friction Force, Part 3',
  },
  {
    class_num: 59,
    week_num: 20,
    unit: 'Physics',
    topic: 'Friction Force, Part 4',
  },
  {
    class_num: 60,
    week_num: 20,
    unit: 'Physics',
    topic: 'Friction Force, Part 5',
    activity: 'Friction and Ice',
  },

  // WEEK 21 — PHYSICS
  {
    class_num: 61,
    week_num: 21,
    unit: 'Physics',
    topic: 'Buoyancy Force, Part 1',
  },
  {
    class_num: 62,
    week_num: 21,
    unit: 'Physics',
    topic: 'Buoyancy Force, Part 2',
  },
  {
    class_num: 63,
    week_num: 21,
    unit: 'Physics',
    topic: 'Buoyancy Force, Part 3',
    activity: 'Buoyancy',
  },

  // WEEK 22 — PHYSICS
  {
    class_num: 64,
    week_num: 22,
    unit: 'Physics',
    topic: 'Lift Force, Part 1',
  },
  {
    class_num: 65,
    week_num: 22,
    unit: 'Physics',
    topic: 'Lift Force, Part 2',
    activity: 'Paper Airplanes',
  },
  {
    class_num: 66,
    week_num: 22,
    unit: 'Physics',
    topic: 'Drag and Thrust Forces',
  },

  // WEEK 23 — PHYSICS
  {
    class_num: 67,
    week_num: 23,
    unit: 'Physics',
    topic: 'Electrostatic Force, Part 1',
  },
  {
    class_num: 68,
    week_num: 23,
    unit: 'Physics',
    topic: 'Electrostatic Force, Part 2',
  },
  {
    class_num: 69,
    week_num: 23,
    unit: 'Physics',
    topic: 'Charge and Charge Transfer, Part 1',
  },

  // WEEK 24 — PHYSICS
  {
    class_num: 70,
    week_num: 24,
    unit: 'Physics',
    topic: 'Charge and Charge Transfer, Part 2',
  },
  {
    class_num: 71,
    week_num: 24,
    unit: 'Physics',
    topic: 'Charge and Charge Transfer, Part 3',
  },
  {
    class_num: 72,
    week_num: 24,
    unit: 'Physics',
    topic: 'The Flow of Electrons and Electricity',
    activity: 'Light Bulb',
  },

  // WEEK 25 — PHYSICS
  {
    class_num: 73,
    week_num: 25,
    unit: 'Physics',
    topic: 'Magnetism, Part 1',
  },
  {
    class_num: 74,
    week_num: 25,
    unit: 'Physics',
    topic: 'Magnetism, Part 2',
  },
  {
    class_num: 75,
    week_num: 25,
    unit: 'Physics',
    topic: 'Magnetism at the Atomic Level',
    activity: 'Magnets',
  },

  // WEEK 26 — PHYSICS
  {
    class_num: 76,
    week_num: 26,
    unit: 'Physics',
    topic: 'Energy, Introduction',
  },
  {
    class_num: 77,
    week_num: 26,
    unit: 'Physics',
    topic: 'Kinetic and Potential Energy, Part 1',
  },
  {
    class_num: 78,
    week_num: 26,
    unit: 'Physics',
    topic: 'Kinetic and Potential Energy, Part 2',
    activity: 'Identifying Energy',
  },

  // WEEK 27 — PHYSICS AND ASTRONOMY
  {
    class_num: 79,
    week_num: 27,
    unit: 'Physics and Astronomy',
    topic: 'Review, Part 1',
  },
  {
    class_num: 80,
    week_num: 27,
    unit: 'Physics and Astronomy',
    topic: 'Review, Part 2',
  },
  {
    class_num: 81,
    week_num: 27,
    unit: 'Physics and Astronomy',
    topic: 'Astronomy: Introduction',
  },

  // WEEK 28 — ASTRONOMY
  {
    class_num: 82,
    week_num: 28,
    unit: 'Astronomy',
    topic: 'History',
  },
  {
    class_num: 83,
    week_num: 28,
    unit: 'Astronomy',
    topic: 'God’s Creation',
  },
  {
    class_num: 84,
    week_num: 28,
    unit: 'Astronomy',
    topic: 'Solar System, Introduction',
  },

  // WEEK 29 — ASTRONOMY
  {
    class_num: 85,
    week_num: 29,
    unit: 'Astronomy',
    topic: 'Introduction, Telescopes, Part 1',
  },
  {
    class_num: 86,
    week_num: 29,
    unit: 'Astronomy',
    topic: 'Introduction, Telescopes, Part 2',
    activity: 'Telescope Practicum',
  },
  {
    class_num: 87,
    week_num: 29,
    unit: 'Astronomy',
    topic: 'The Solar System, Overview',
  },

  // WEEK 30 — ASTRONOMY
  {
    class_num: 88,
    week_num: 30,
    unit: 'Astronomy',
    topic: 'The Solar System, Scale and Distances, Part 1',
  },
  {
    class_num: 89,
    week_num: 30,
    unit: 'Astronomy',
    topic: 'The Solar System, Scale and Distances, Part 2',
  },
  {
    class_num: 90,
    week_num: 30,
    unit: 'Astronomy',
    topic: 'The Solar System, The Sun, Part 1',
    activity: 'Periodic Table of the Solar System, Part 1',
  },

  // WEEK 31 — ASTRONOMY
  {
    class_num: 91,
    week_num: 31,
    unit: 'Astronomy',
    topic: 'The Solar System, The Sun, Part 2',
  },
  {
    class_num: 92,
    week_num: 31,
    unit: 'Astronomy',
    topic: 'The Solar System, Planets, Part 1',
    activity: 'Periodic Table of the Solar System, Part 2',
  },
  {
    class_num: 93,
    week_num: 31,
    unit: 'Astronomy',
    topic: 'The Solar System, Planets, Part 2',
    activity: 'Periodic Table of the Solar System, Part 3',
  },

  // WEEK 32 — ASTRONOMY
  {
    class_num: 94,
    week_num: 32,
    unit: 'Astronomy',
    topic: 'The Solar System, Dwarf Planets, Comets and Asteroids',
    activity: 'Periodic Table of the Solar System, Part 4',
  },
  {
    class_num: 95,
    week_num: 32,
    unit: 'Astronomy',
    topic: 'Stars, Part 1',
  },
  {
    class_num: 96,
    week_num: 32,
    unit: 'Astronomy',
    topic: 'Stars, Part 2',
  },

  // WEEK 33 — ASTRONOMY
  {
    class_num: 97,
    week_num: 33,
    unit: 'Astronomy',
    topic: 'Stars, Part 3',
  },
  {
    class_num: 98,
    week_num: 33,
    unit: 'Astronomy',
    topic: 'Stars, Part 4',
    activity: 'Star Projector',
  },
  {
    class_num: 99,
    week_num: 33,
    unit: 'Astronomy',
    topic: 'Exoplanets, Binary Stars, Star Clusters, Brown Dwarfs',
  },

  // WEEK 34 — ASTRONOMY
  {
    class_num: 100,
    week_num: 34,
    unit: 'Astronomy',
    topic: 'Supernovas, Nebulas, Neutron Stars and Black Holes',
  },
  {
    class_num: 101,
    week_num: 34,
    unit: 'Astronomy',
    topic: 'Galaxies and Nebulas',
    activity: 'Galaxy Shapes',
  },
  {
    class_num: 102,
    week_num: 34,
    unit: 'Astronomy',
    topic: 'Constellations',
    activity: 'Constellation Connect the Dots',
  },

  // WEEK 35 — ASTRONOMY
  {
    class_num: 103,
    week_num: 35,
    unit: 'Astronomy',
    topic: 'Science and Origins, Part 1',
  },
  {
    class_num: 104,
    week_num: 35,
    unit: 'Astronomy',
    topic: 'Science and Origins, Part 2',
  },
  {
    class_num: 105,
    week_num: 35,
    unit: 'Astronomy',
    topic: 'Science and Origins, Part 3',
  },
];

export const PHYSICAL_SCIENCE_SYLLABUS_DAYS: MathSyllabusDay[] =
  PHYSICAL_SCIENCE_105_CLASSES.map((item) => {
    const supplies = item.activity
      ? item.supplies ?? getPhysicalScienceActivitySupplies(item.activity)
      : [];
    return {
      id: `phys-sci-class-${item.class_num}`,
      day_number: item.class_num,
      week_number: item.week_num,
      unit: item.unit,
      activity: item.activity || '',
      supplies: supplies.length > 0 ? supplies : undefined,
      semester: item.week_num <= 18 ? 1 : 2,
      workbook: item.activity ? `Activity: ${item.activity}` : '',
      textbook: `Week ${item.week_num} • ${item.unit}`,
      topic: item.topic,
      materials: supplies.length > 0 ? supplies.join(' • ') : item.activity || '',
      fast_facts: '',
      notes: item.activity ? `Activity: ${item.activity}` : '',
    };
  });

export const PHYSICAL_SCIENCE_COURSE_SYLLABUS: CourseSyllabusData = {
  id: 'physical-science-35-week',
  course_title: 'Physical Science (35-Week Schedule)',
  official_course_name: 'Physical Science',
  source_type: 'manual_upload',
  uploaded_file_name: 'Physical Science 35-Week Schedule.pdf',
  teacher_name: 'Mom',
  summary:
    '35-Week Physical Science curriculum (105 classes, 3 classes per week on Mon/Tue/Wed) covering Introduction (Week 1), Chemistry (Weeks 2–12), Physics (Weeks 13–26), Physics & Astronomy (Week 27), and Astronomy (Weeks 28–35) with hands-on lab activities and supply lists.',
  uploaded_at: '2026-10-16T18:00:00.000Z',
  days: PHYSICAL_SCIENCE_SYLLABUS_DAYS,
};
