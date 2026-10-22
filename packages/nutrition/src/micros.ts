import { FOOD_BY_ID, type Food, type FoodCategory } from './foods'
import { matchFood } from './match'
import type { Meal, MealItem } from './meals'
import type { Sex } from './targets'

/*
 * Fibre, iron, calcium, vitamin B12 and vitamin D per 100 g as eaten.
 *
 * Every value is an APPROXIMATE estimate: a typical value per food category, overridden for
 * common foods with values from the ICMR-NIN Indian Food Composition Tables (IFCT 2017) and
 * USDA FoodData Central, adjusted for cooking water where the table lists raw ingredients.
 * Indian dairy is taken as unfortified (vitamin D ~0); US and plant milks as fortified.
 */

export type Micros = { fibre: number; iron: number; calcium: number; b12: number; vitD: number }
export type FoodGroup = 'cereal' | 'protein' | 'veg' | 'fruit' | 'dairy'

export const MICRO_KEYS: (keyof Micros)[] = ['fibre', 'iron', 'calcium', 'b12', 'vitD']

export const MICRO_INFO: Record<keyof Micros, { name: string; unit: 'g' | 'mg' | 'µg' }> = {
  fibre: { name: 'Fibre', unit: 'g' },
  iron: { name: 'Iron', unit: 'mg' },
  calcium: { name: 'Calcium', unit: 'mg' },
  b12: { name: 'Vitamin B12', unit: 'µg' },
  vitD: { name: 'Vitamin D', unit: 'µg' },
}

export const FOOD_GROUPS: FoodGroup[] = ['cereal', 'protein', 'veg', 'fruit', 'dairy']

export const GROUP_INFO: Record<FoodGroup, { name: string; tip: string }> = {
  cereal: { name: 'Cereals', tip: 'A roti or a katori of rice gives steady energy.' },
  protein: { name: 'Dal & protein', tip: 'A katori of dal, two eggs or some paneer covers this.' },
  veg: { name: 'Vegetables', tip: 'A katori of sabzi or a salad adds fibre and minerals.' },
  fruit: { name: 'Fruit', tip: 'A guava or a banana is an easy fruit for today.' },
  dairy: { name: 'Dairy', tip: 'A katori of dahi or a glass of milk adds calcium.' },
}

const ZERO_MICROS: Micros = { fibre: 0, iron: 0, calcium: 0, b12: 0, vitD: 0 }

/** [fibre g, iron mg, calcium mg, B12 µg, vitamin D µg] per 100 g. */
type M = [number, number, number, number, number]

const BY_CATEGORY: Record<FoodCategory, M> = {
  bread: [4, 2.2, 30, 0, 0],
  rice: [0.6, 0.3, 8, 0, 0],
  dal: [2.8, 1.4, 30, 0, 0],
  sabzi: [2.4, 0.9, 45, 0, 0],
  nonveg: [0.6, 1.1, 25, 0.5, 0.2],
  egg: [0.2, 1.4, 50, 0.9, 1.8],
  south: [1.4, 0.7, 20, 0, 0],
  snack: [2, 1.6, 35, 0, 0],
  sweet: [0.6, 0.6, 70, 0.1, 0],
  dairy: [0, 0.1, 120, 0.4, 0],
  drink: [0.1, 0.1, 15, 0, 0],
  fruit: [2.2, 0.4, 15, 0, 0],
  breakfast: [2, 1.4, 35, 0.1, 0],
  protein: [2, 2, 100, 0, 0],
  chinese: [1.3, 0.9, 25, 0.1, 0],
  asian: [1.2, 0.9, 30, 0.3, 0.3],
  mideast: [3.5, 1.6, 45, 0.2, 0],
  fastfood: [1.8, 1.9, 90, 0.5, 0.1],
  meal: [1.8, 1.2, 70, 0.3, 0.1],
  meat: [0, 1.2, 12, 0.8, 0.3],
  veg: [2.5, 0.8, 35, 0, 0],
}

const BY_ID: Record<string, M> = {
  // Breads
  roti: [4.9, 2.6, 30, 0, 0],
  phulka: [4.9, 2.6, 30, 0, 0],
  'ghee-roti': [4.4, 2.3, 27, 0, 0],
  paratha: [4, 2.1, 30, 0, 0],
  'aloo-paratha': [3, 1.4, 25, 0, 0],
  'gobi-paratha': [3.3, 1.5, 30, 0, 0],
  'paneer-paratha': [3, 1.6, 110, 0.2, 0],
  naan: [2.2, 1.6, 70, 0.1, 0],
  'butter-naan': [2.2, 1.6, 70, 0.1, 0],
  'white-bread': [2.4, 1.8, 40, 0, 0],
  'brown-bread': [6, 2.5, 60, 0, 0],
  'wholewheat-bread': [6, 2.5, 60, 0, 0],
  'bajra-roti': [6, 5, 30, 0, 0],
  'jowar-roti': [5, 2.5, 20, 0, 0],
  'makki-roti': [5, 1.5, 10, 0, 0],
  'missi-roti': [6, 3, 45, 0, 0],
  // Rice and plates
  'brown-rice': [1.8, 0.4, 10, 0, 0],
  khichdi: [2, 1, 20, 0, 0],
  'curd-rice': [0.4, 0.2, 60, 0.15, 0],
  'rajma-chawal': [3.6, 1.3, 30, 0, 0],
  'chole-chawal': [3.8, 1.4, 35, 0, 0],
  'dal-chawal': [1.8, 0.9, 18, 0, 0],
  'veg-pulao': [1.2, 0.6, 15, 0, 0],
  'veg-biryani': [1.5, 0.7, 25, 0, 0],
  'chicken-biryani': [0.8, 0.9, 20, 0.2, 0.1],
  'mutton-biryani': [0.8, 1.2, 20, 0.6, 0],
  quinoa: [2.8, 1.5, 17, 0, 0],
  'lemon-rice': [0.8, 0.4, 8, 0, 0],
  // Dals and pulses
  rajma: [6.4, 2.2, 45, 0, 0],
  chole: [7, 2.5, 50, 0, 0],
  'dal-makhani': [4, 1.8, 60, 0.05, 0],
  'dal-palak': [3.2, 2, 55, 0, 0],
  sambar: [2.5, 1.1, 35, 0, 0],
  rasam: [0.6, 0.5, 12, 0, 0],
  kadhi: [0.6, 0.4, 70, 0.15, 0],
  'black-beans': [8.7, 2.1, 27, 0, 0],
  chickpeas: [7.6, 2.9, 49, 0, 0],
  lentils: [7.9, 3.3, 19, 0, 0],
  // Sabzi and paneer
  'palak-paneer': [2, 2, 180, 0.3, 0],
  'matar-paneer': [2.6, 1, 150, 0.3, 0],
  'paneer-butter-masala': [1.2, 0.7, 170, 0.3, 0],
  'kadai-paneer': [1.6, 0.8, 170, 0.3, 0],
  'shahi-paneer': [1, 0.6, 170, 0.3, 0],
  'paneer-bhurji': [0.8, 0.6, 220, 0.4, 0],
  'malai-kofta': [1.5, 0.8, 90, 0.15, 0],
  bhindi: [3.2, 0.7, 80, 0, 0],
  'baingan-bharta': [3, 0.4, 15, 0, 0],
  'green-salad': [1.8, 0.6, 25, 0, 0],
  kachumber: [1.4, 0.4, 15, 0, 0],
  sprouts: [2, 1, 15, 0, 0],
  'soya-curry': [4, 3.2, 90, 0, 0],
  'methi-aloo': [2.6, 1.8, 70, 0, 0],
  'mushroom-masala': [1.6, 0.6, 10, 0.05, 0.2],
  lauki: [1, 0.3, 20, 0, 0],
  cabbage: [2, 0.4, 40, 0, 0],
  // Non-veg and eggs
  'fish-curry': [0.4, 0.8, 40, 1.6, 3],
  'fish-fry': [0.3, 0.9, 50, 2, 4],
  'mutton-curry': [0.6, 2.3, 20, 1.8, 0.1],
  keema: [0.8, 2.4, 25, 1.8, 0.1],
  'prawn-masala': [0.6, 1.2, 70, 1.1, 0.1],
  'chicken-breast': [0, 0.4, 6, 0.3, 0.1],
  'butter-chicken': [0.5, 0.9, 40, 0.3, 0.2],
  'boiled-egg': [0, 1.2, 50, 1.1, 2.2],
  'egg-white': [0, 0.1, 7, 0.1, 0],
  omelette: [0.2, 1.3, 55, 0.9, 1.8],
  // South Indian and breakfast
  idli: [1.5, 0.6, 15, 0, 0],
  dosa: [1.4, 0.8, 20, 0, 0],
  'ragi-dosa': [3.5, 1.5, 150, 0, 0],
  'coconut-chutney': [5, 0.9, 15, 0, 0],
  pesarattu: [3, 2, 30, 0, 0],
  'medu-vada': [2.5, 1.5, 30, 0, 0],
  'sambar-vada': [2.4, 1.2, 30, 0, 0],
  poha: [1.2, 1.8, 15, 0, 0],
  upma: [1.8, 0.8, 15, 0, 0],
  'besan-chilla': [3.2, 2.4, 40, 0, 0],
  'moong-chilla': [3, 1.9, 40, 0, 0],
  dalia: [2.5, 1, 15, 0, 0],
  oats: [1.7, 0.9, 9, 0, 0],
  oatmeal: [1.7, 0.9, 9, 0, 0],
  // Protein foods
  whey: [0, 0.5, 400, 1.5, 0],
  'whey-milk': [0, 0.2, 180, 0.6, 0],
  'soya-chunks': [13, 10, 350, 0, 0],
  tofu: [0.3, 5.4, 350, 0, 0],
  'peanut-butter': [6, 1.9, 49, 0, 0],
  'protein-bar': [5, 2.5, 200, 1, 0],
  // Snacks and nuts
  'roasted-chana': [16, 6, 58, 0, 0],
  makhana: [14.5, 1.4, 60, 0, 0],
  peanuts: [8.5, 4.6, 92, 0, 0],
  almonds: [12.5, 3.7, 269, 0, 0],
  walnuts: [6.7, 2.9, 98, 0, 0],
  cashews: [3.3, 6.7, 37, 0, 0],
  'mixed-nuts': [8, 3.7, 100, 0, 0],
  'peanut-chikki': [4, 2.5, 60, 0, 0],
  dhokla: [2.5, 1.6, 40, 0, 0],
  'potato-chips': [3.5, 1.2, 20, 0, 0],
  popcorn: [14, 3.2, 7, 0, 0],
  samosa: [2.5, 1.5, 25, 0, 0],
  momos: [1.5, 0.9, 20, 0.2, 0],
  // Sweets
  'dark-chocolate': [11, 12, 73, 0, 0],
  kheer: [0.2, 0.2, 120, 0.3, 0],
  rasmalai: [0, 0.2, 150, 0.4, 0],
  shrikhand: [0, 0.1, 110, 0.3, 0],
  'besan-ladoo': [3, 2, 30, 0, 0],
  'gajar-halwa': [1.8, 0.6, 110, 0.2, 0],
  'ice-cream': [0.7, 0.1, 128, 0.4, 0.2],
  honey: [0.2, 0.4, 6, 0, 0],
  jam: [1, 0.5, 20, 0, 0],
  // Dairy and fats
  dahi: [0, 0.1, 149, 0.4, 0],
  'greek-yogurt': [0, 0.1, 110, 0.75, 0],
  'greek-yogurt-plain': [0, 0.1, 110, 0.75, 0],
  raita: [0.4, 0.2, 120, 0.3, 0],
  lassi: [0, 0.05, 100, 0.3, 0],
  chaas: [0, 0.05, 60, 0.15, 0],
  milk: [0, 0.05, 120, 0.45, 0],
  'full-cream-milk': [0, 0.05, 120, 0.45, 0],
  'milk-2': [0, 0.03, 120, 0.5, 1.2],
  paneer: [0, 0.3, 480, 0.8, 0.1],
  'cottage-cheese': [0, 0.1, 83, 0.4, 0],
  cheddar: [0, 0.1, 710, 1.1, 0.6],
  mozzarella: [0, 0.4, 505, 2.3, 0.4],
  'cheese-slice': [0, 0.2, 600, 0.7, 0.3],
  'cream-cheese': [0, 0.1, 97, 0.2, 0],
  ghee: [0, 0, 0, 0, 0],
  butter: [0, 0, 24, 0.2, 0],
  'olive-oil': [0, 0.6, 1, 0, 0],
  mayonnaise: [0, 0.2, 8, 0.1, 0],
  // Drinks
  chai: [0, 0.1, 50, 0.15, 0],
  coffee: [0, 0.1, 50, 0.15, 0],
  latte: [0, 0.05, 110, 0.4, 0.6],
  cappuccino: [0, 0.05, 110, 0.4, 0.6],
  'black-coffee': [0, 0, 2, 0, 0],
  'green-tea': [0, 0, 0, 0, 0],
  'nimbu-pani': [0.1, 0, 5, 0, 0],
  'sugarcane-juice': [0, 0.4, 10, 0, 0],
  'coconut-water': [1.1, 0.3, 24, 0, 0],
  'mango-shake': [0.6, 0.1, 95, 0.3, 0],
  'banana-shake': [0.5, 0.2, 100, 0.35, 0],
  cola: [0, 0, 2, 0, 0],
  'almond-milk': [0.2, 0.3, 180, 0.6, 1],
  'soy-milk': [0.2, 0.4, 120, 0.9, 1.1],
  'oat-milk': [0.8, 0.2, 140, 0.5, 1],
  'orange-juice': [0.2, 0.2, 11, 0, 0],
  'apple-juice': [0.1, 0.1, 8, 0, 0],
  beer: [0, 0, 4, 0, 0],
  'red-wine': [0, 0.5, 8, 0, 0],
  'sports-drink': [0, 0, 0, 0, 0],
  'energy-drink': [0, 0, 5, 0.8, 0],
  'fruit-smoothie': [1, 0.3, 30, 0, 0],
  // Fruit
  guava: [5.4, 0.3, 18, 0, 0],
  banana: [2.6, 0.3, 5, 0, 0],
  apple: [2.4, 0.1, 6, 0, 0],
  mango: [1.6, 0.2, 11, 0, 0],
  orange: [2.4, 0.1, 40, 0, 0],
  papaya: [1.7, 0.25, 20, 0, 0],
  watermelon: [0.4, 0.2, 7, 0, 0],
  pomegranate: [4, 0.3, 10, 0, 0],
  chikoo: [5.3, 0.8, 21, 0, 0],
  dates: [8, 1, 64, 0, 0],
  avocado: [6.7, 0.6, 12, 0, 0],
  strawberries: [2, 0.4, 16, 0, 0],
  blueberries: [2.4, 0.3, 6, 0, 0],
  raspberries: [6.5, 0.7, 25, 0, 0],
  pear: [3.1, 0.2, 9, 0, 0],
  kiwi: [3, 0.3, 34, 0, 0],
  grapes: [0.9, 0.4, 10, 0, 0],
  // Meat and fish
  salmon: [0, 0.3, 12, 3.2, 13],
  cod: [0, 0.4, 14, 0.9, 1],
  tuna: [0, 1.3, 10, 2.2, 1.7],
  steak: [0, 2.6, 18, 2.6, 0.1],
  'beef-patty': [0, 2.6, 18, 2.6, 0.1],
  'pork-chop': [0, 0.9, 20, 0.6, 0.5],
  'lamb-chop': [0, 1.9, 17, 2.4, 0.1],
  shrimp: [0, 0.5, 70, 1.4, 0],
  'grilled-chicken': [0, 1, 15, 0.3, 0.1],
  'turkey-breast': [0, 0.7, 10, 0.6, 0.2],
  'chicken-thigh': [0, 1.1, 10, 0.4, 0.2],
  bacon: [0, 1.4, 11, 1.2, 0.3],
  sausage: [0, 1.2, 12, 1, 0.7],
  // Vegetables
  spinach: [2.2, 2.7, 99, 0, 0],
  broccoli: [3.3, 0.7, 40, 0, 0],
  carrot: [2.8, 0.3, 33, 0, 0],
  tomato: [1.2, 0.3, 10, 0, 0],
  cucumber: [0.5, 0.3, 16, 0, 0],
  'sweet-potato': [3.3, 0.7, 38, 0, 0],
  'baked-potato': [2.2, 1.1, 15, 0, 0],
  'corn-cob': [2.4, 0.5, 3, 0, 0],
  'mixed-veg': [3, 0.8, 30, 0, 0],
  // Asian and Middle Eastern
  'miso-soup': [0.4, 0.3, 15, 0, 0],
  edamame: [5.2, 2.3, 63, 0, 0],
  kimchi: [1.6, 0.5, 33, 0, 0],
  'sushi-salmon': [0.3, 0.4, 10, 1, 3],
  hummus: [6, 2.4, 38, 0, 0],
  falafel: [4.9, 3.4, 54, 0, 0],
  'lentil-soup': [3, 1.5, 20, 0, 0],
  tabbouleh: [2.5, 1, 30, 0, 0],
}

const GROUPS_BY_CATEGORY: Record<FoodCategory, FoodGroup[]> = {
  bread: ['cereal'],
  rice: ['cereal'],
  chinese: ['cereal'],
  dal: ['protein'],
  sabzi: ['veg'],
  nonveg: ['protein'],
  egg: ['protein'],
  south: ['cereal'],
  breakfast: ['cereal'],
  protein: ['protein'],
  snack: [],
  sweet: [],
  dairy: ['dairy'],
  drink: [],
  fruit: ['fruit'],
  meat: ['protein'],
  fastfood: ['cereal'],
  meal: ['cereal'],
  veg: ['veg'],
  asian: ['cereal'],
  mideast: ['protein'],
}

const CEREAL_PROTEIN: FoodGroup[] = ['cereal', 'protein']
const CEREAL_VEG: FoodGroup[] = ['cereal', 'veg']
const CEREAL_DAIRY: FoodGroup[] = ['cereal', 'dairy']
const VEG_DAIRY: FoodGroup[] = ['veg', 'dairy']
const DAIRY_PROTEIN: FoodGroup[] = ['dairy', 'protein']

const GROUPS_BY_ID: Record<string, FoodGroup[]> = {
  'aloo-paratha': CEREAL_VEG,
  'gobi-paratha': CEREAL_VEG,
  'methi-thepla': CEREAL_VEG,
  'paneer-paratha': CEREAL_DAIRY,
  'missi-roti': CEREAL_PROTEIN,
  'rajma-chawal': CEREAL_PROTEIN,
  'chole-chawal': CEREAL_PROTEIN,
  'dal-chawal': CEREAL_PROTEIN,
  khichdi: CEREAL_PROTEIN,
  'chicken-biryani': CEREAL_PROTEIN,
  'mutton-biryani': CEREAL_PROTEIN,
  'veg-pulao': CEREAL_VEG,
  'veg-biryani': CEREAL_VEG,
  'curd-rice': CEREAL_DAIRY,
  sambar: ['protein', 'veg'],
  'dal-palak': ['protein', 'veg'],
  kadhi: DAIRY_PROTEIN,
  'palak-paneer': VEG_DAIRY,
  'matar-paneer': VEG_DAIRY,
  'kadai-paneer': VEG_DAIRY,
  'malai-kofta': VEG_DAIRY,
  'paneer-butter-masala': DAIRY_PROTEIN,
  'shahi-paneer': DAIRY_PROTEIN,
  'paneer-bhurji': DAIRY_PROTEIN,
  'soya-curry': ['protein'],
  sprouts: ['protein'],
  'masala-dosa': CEREAL_VEG,
  'sambar-vada': ['protein'],
  pesarattu: ['protein'],
  'medu-vada': ['protein'],
  'coconut-chutney': [],
  poha: CEREAL_VEG,
  upma: CEREAL_VEG,
  'besan-chilla': ['protein'],
  'moong-chilla': ['protein'],
  'bread-omelette': CEREAL_PROTEIN,
  'veg-sandwich': CEREAL_VEG,
  'paneer-sandwich': CEREAL_DAIRY,
  'whey-milk': DAIRY_PROTEIN,
  'protein-bar': [],
  'roasted-chana': ['protein'],
  peanuts: ['protein'],
  almonds: ['protein'],
  walnuts: ['protein'],
  cashews: ['protein'],
  'mixed-nuts': ['protein'],
  dhokla: ['protein'],
  khandvi: ['protein'],
  'chole-bhature': CEREAL_PROTEIN,
  'pav-bhaji': CEREAL_VEG,
  'bhel-puri': ['cereal'],
  kheer: ['dairy'],
  rasmalai: ['dairy'],
  shrikhand: ['dairy'],
  ghee: [],
  butter: [],
  'olive-oil': [],
  mayonnaise: [],
  'cream-cheese': [],
  'mango-shake': ['fruit', 'dairy'],
  'banana-shake': ['fruit', 'dairy'],
  latte: ['dairy'],
  cappuccino: ['dairy'],
  'soy-milk': ['protein'],
  'fruit-smoothie': ['fruit'],
  cheeseburger: CEREAL_PROTEIN,
  hamburger: CEREAL_PROTEIN,
  'veggie-burger': CEREAL_VEG,
  fries: [],
  'fried-chicken': ['protein'],
  nuggets: ['protein'],
  'chicken-sandwich': CEREAL_PROTEIN,
  'fish-sandwich': CEREAL_PROTEIN,
  'turkey-sandwich': CEREAL_PROTEIN,
  'pizza-cheese': CEREAL_DAIRY,
  'pizza-pepperoni': CEREAL_DAIRY,
  'burrito-bowl': ['cereal', 'protein', 'veg'],
  'spaghetti-bolognese': CEREAL_PROTEIN,
  'mac-cheese': CEREAL_DAIRY,
  lasagna: CEREAL_DAIRY,
  ramen: CEREAL_PROTEIN,
  pho: CEREAL_PROTEIN,
  'pad-thai': CEREAL_PROTEIN,
  bibimbap: ['cereal', 'protein', 'veg'],
  kimchi: ['veg'],
  'miso-soup': [],
  edamame: ['protein'],
  'teriyaki-steak': ['protein'],
  'veg-tempura': ['veg'],
  'falafel-wrap': CEREAL_PROTEIN,
  tabbouleh: CEREAL_VEG,
  'baba-ganoush': ['veg'],
}

const toMicros = ([fibre, iron, calcium, b12, vitD]: M): Micros => ({
  fibre,
  iron,
  calcium,
  b12,
  vitD,
})

/** Approximate micronutrients per 100 g of a food. */
export const foodMicros = (food: Food): Micros =>
  toMicros(BY_ID[food.id] ?? BY_CATEGORY[food.category])

/** The food groups a food counts towards (a mixed dish can be in several). */
export const foodGroups = (food: Food): FoodGroup[] =>
  GROUPS_BY_ID[food.id] ?? GROUPS_BY_CATEGORY[food.category]

/** The table food behind a logged item: its id, or else a confident name match. */
export function itemFood(it: MealItem): Food | null {
  if (it.foodId) return FOOD_BY_ID[it.foodId] ?? null
  return matchFood(it.name, 0.75)?.food ?? null
}

/** Micronutrients in a logged item, or null when it matches no table food. */
export function itemMicros(it: MealItem): Micros | null {
  const food = itemFood(it)
  if (!food) return null
  const grams = it.unit === 'g' || it.unit === 'ml' ? it.qty : food.gramsPerUnit * it.qty
  const per = foodMicros(food)
  const out = { ...ZERO_MICROS }
  for (const k of MICRO_KEYS) out[k] = (per[k] * grams) / 100
  return out
}

export interface DayMicros {
  total: Micros
  /** Items with a table estimate, out of `items`. */
  estimated: number
  items: number
  /** Up to three item names per nutrient, largest contribution first. */
  top: Record<keyof Micros, string[]>
}

export function dayMicros(meals: Meal[]): DayMicros {
  const total = { ...ZERO_MICROS }
  const by: Record<keyof Micros, Map<string, number>> = {
    fibre: new Map(),
    iron: new Map(),
    calcium: new Map(),
    b12: new Map(),
    vitD: new Map(),
  }
  let items = 0
  let estimated = 0
  for (const m of meals)
    for (const it of m.items) {
      items++
      const mi = itemMicros(it)
      if (!mi) continue
      estimated++
      for (const k of MICRO_KEYS) {
        total[k] += mi[k]
        if (mi[k] > 0) by[k].set(it.name, (by[k].get(it.name) ?? 0) + mi[k])
      }
    }
  const top = Object.fromEntries(
    MICRO_KEYS.map((k) => [
      k,
      [...by[k]]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name),
    ]),
  ) as DayMicros['top']
  return { total, estimated, items, top }
}

/** Food groups eaten across these meals. */
export function dayGroups(meals: Meal[]): Set<FoodGroup> {
  const out = new Set<FoodGroup>()
  for (const m of meals)
    for (const it of m.items) {
      const food = itemFood(it)
      if (food) for (const g of foodGroups(food)) out.add(g)
    }
  return out
}

/**
 * Daily targets for adults from the ICMR-NIN 2020 Nutrient Requirements: iron RDA 19 mg (men)
 * and 29 mg (women), calcium 1000 mg, vitamin B12 2.5 µg, vitamin D 600 IU (15 µg), and dietary
 * fibre at 30 g per 2000 kcal, scaled to the day's calorie target.
 */
export function microTargets(sex: Sex, kcalTarget: number): Micros {
  return {
    fibre: Math.round((kcalTarget * 15) / 1000),
    iron: sex === 'female' ? 29 : 19,
    calcium: 1000,
    b12: 2.5,
    vitD: 15,
  }
}
