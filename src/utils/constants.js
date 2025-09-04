// src/utils/constants.js
const { FALLBACK_QUESTIONS } = require('./fallbackQuestions');

// Tier colors for embeds (Nico Robin theme - purples and scholarly colors)
const TIER_COLORS = {
    0: '#808080',
    1: '#E8E8E8',
    2: '#98D8C8',
    3: '#6FA8DC',
    4: '#8B7EC8',
    5: '#B19CD9',
    6: '#9A7BC2',
    7: '#7B6AAE',
    8: '#6B4E8D',
    9: '#5A3C7A',
    10: '#4A2B66'
};

// Rarity-based colors (more exciting for buffs)
const TIER_RARITY_COLORS = {
    0: '#808080',  // No Rarity
    1: '#FFFFFF',  // Common - White
    2: '#1EFF00',  // Uncommon - Green
    3: '#0099FF',  // Rare - Blue
    4: '#9933FF',  // Epic - Purple
    5: '#FF6600',  // Legendary - Orange
    6: '#FF6600',  // Legendary - Orange
    7: '#FF0040',  // Mythic - Red/Pink
    8: '#FF0040',  // Mythic - Red/Pink
    9: '#FFD700',  // Divine - Gold
    10: '#FFD700' // Divine - Gold
};

// Tier names (Nico Robin archaeological theme)
const TIER_NAMES = {
    0: 'No Ancient Knowledge',
    1: 'Novice Scholar',
    2: 'Apprentice Historian',
    3: 'Skilled Archaeologist',
    4: 'Expert Researcher',
    5: 'Master of Poneglyphs',
    6: 'Master of Poneglyphs',
    7: 'Devil Child Wisdom',
    8: 'Devil Child Wisdom',
    9: 'Ohara\'s Legacy',
    10: 'Ohara\'s Legacy'
};

// Rarity tiers (gaming-style rarities)
const TIER_RARITIES = {
    0: 'No Rarity',
    1: 'Common',
    2: 'Uncommon', 
    3: 'Rare',
    4: 'Epic',
    5: 'Legendary',
    6: 'Legendary',
    7: 'Mythic',
    8: 'Mythic',
    9: 'Divine',
    10: 'Divine'
};

// Tier emojis (scholarly and archaeological theme)
const TIER_EMOJIS = {
    0: '💀',
    1: '📖',
    2: '📚',
    3: '🔍',
    4: '📜',
    5: '🏺',
    6: '🏺',
    7: '🌸',
    8: '🌸',
    9: '🗿',
    10: '🗿'
};

// Nico Robin themed descriptions
const TIER_DESCRIPTIONS = {
    0: 'Even the greatest scholars started with a single page. Your journey to knowledge begins here.',
    1: 'Every book holds a treasure waiting to be discovered. You have taken your first steps into the world of knowledge.',
    2: 'History is written by those who seek to understand it. Your curiosity grows stronger with each page.',
    3: 'A true archaeologist reads between the lines of history. You are developing a keen eye for hidden truths.',
    4: 'Research is the art of finding answers to questions not yet asked. Your expertise is becoming evident.',
    5: 'The Poneglyphs hold the key to the world greatest mysteries. You have unlocked ancient wisdom.',
    6: 'Master of the ancient scripts, your knowledge rivals the scholars of Ohara. True mastery achieved.',
    7: 'The Devil Child wisdom flows through you - forbidden knowledge is yours to command. Exceptional understanding.',
    8: 'With the wisdom of the Devil Child, even the World Government fears your knowledge. Legendary insight.',
    9: 'You carry the legacy of Ohara - the light of knowledge that can never be extinguished. Divine wisdom.',
    10: 'Perfect understanding achieved - you embody the complete legacy of Ohara greatest scholar. Ultimate mastery!'
};

// Keywords that indicate anime content
const ANIME_KEYWORDS = [
    'anime', 'manga', 'character', 'protagonist', 'antagonist',
    'power', 'ability', 'technique', 'jutsu', 'devil fruit',
    'titan', 'demon', 'soul reaper', 'ninja', 'pirate',
    'hero', 'villain', 'quirk', 'stand', 'magic',
    'guild', 'crew', 'team', 'squad', 'organization',
    'sensei', 'senpai', 'kouhai', 'chan', 'kun', 'sama',
    'dojo', 'tournament', 'battle', 'fight', 'training'
];

// Keywords to avoid (production/technical questions)
const BAD_KEYWORDS = [
    'studio that animated', 'animation studio', 'produced by', 'directed by',
    'composed by', 'music by', 'soundtrack by', 'opening theme', 'ending theme',
    'manga author', 'mangaka', 'light novel author', 'creator of',
    'published by', 'serialized in', 'magazine', 'publisher',
    'network that aired', 'broadcast on', 'streaming platform',
    'budget', 'box office', 'sales figures', 'episode count of',
    'animation technique', 'art style', 'animation quality'
];

// Known anime titles for content validation
const ANIME_TITLES = [
    'naruto', 'one piece', 'bleach', 'dragon ball', 'attack on titan',
    'my hero academia', 'demon slayer', 'jujutsu kaisen', 'hunter x hunter',
    'fullmetal alchemist', 'death note', 'code geass', 'evangelion',
    'cowboy bebop', 'akira', 'spirited away', 'totoro', 'princess mononoke',
    'sailor moon', 'pokemon', 'digimon', 'yu-gi-oh', 'one punch man',
    'mob psycho', 'tokyo ghoul', 'parasyte', 'berserk', 'trigun',
    'fairy tail', 'black clover', 'fire force', 'chainsaw man',
    'assassination classroom', 'haikyuu', 'kuroko', 'food wars',
    'seven deadly sins', 'overlord', 're:zero', 'konosuba',
    'shield hero', 'slime', 'goblin slayer', 'made in abyss',
    'violet evergarden', 'your name', 'weathering with you', 'kimetsu no yaiba',
    'shingeki no kyojin', 'boku no hero academia', 'jojo', 'dragonball'
];

module.exports = {
    TIER_COLORS,
    TIER_RARITY_COLORS,
    TIER_NAMES,
    TIER_RARITIES,
    TIER_EMOJIS,
    TIER_DESCRIPTIONS,
    ANIME_KEYWORDS,
    BAD_KEYWORDS,
    ANIME_TITLES,
    FALLBACK_QUESTIONS
};
