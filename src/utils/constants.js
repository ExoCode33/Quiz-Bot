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

// Fallback questions organized by difficulty
const FALLBACK_QUESTIONS = {
    Easy: [
        {
            question: "Who is the main protagonist of One Piece?",
            options: ["Monkey D. Luffy", "Roronoa Zoro", "Nami", "Sanji"],
            answer: "Monkey D. Luffy",
            difficulty: "Easy"
        },
        {
            question: "What is Nico Robin's Devil Fruit power called?",
            options: ["Hana Hana no Mi", "Gomu Gomu no Mi", "Mera Mera no Mi", "Hito Hito no Mi"],
            answer: "Hana Hana no Mi",
            difficulty: "Easy"
        },
        {
            question: "What is Luffy's Devil Fruit power?",
            options: ["Rubber abilities", "Fire powers", "Ice powers", "Lightning powers"],
            answer: "Rubber abilities",
            difficulty: "Easy"
        },
        {
            question: "In Naruto, what village is Naruto from?",
            options: ["Hidden Leaf Village", "Hidden Sand Village", "Hidden Mist Village", "Hidden Cloud Village"],
            answer: "Hidden Leaf Village",
            difficulty: "Easy"
        },
        {
            question: "What is the name of Luffy's pirate crew?",
            options: ["Straw Hat Pirates", "Red Hair Pirates", "Whitebeard Pirates", "Heart Pirates"],
            answer: "Straw Hat Pirates",
            difficulty: "Easy"
        },
        {
            question: "In My Hero Academia, what is Deku's real name?",
            options: ["Izuku Midoriya", "Katsuki Bakugo", "Shoto Todoroki", "Tenya Iida"],
            answer: "Izuku Midoriya",
            difficulty: "Easy"
        }
    ],
    Medium: [
        {
            question: "What is the name of Nico Robin's home island?",
            options: ["Ohara", "Alabasta", "Water 7", "Enies Lobby"],
            answer: "Ohara",
            difficulty: "Medium"
        },
        {
            question: "What is the name of the sea where most of One Piece takes place?",
            options: ["Grand Line", "East Blue", "West Blue", "Red Line"],
            answer: "Grand Line",
            difficulty: "Medium"
        },
        {
            question: "In Attack on Titan, what is Eren's Titan form called?",
            options: ["Attack Titan", "Colossal Titan", "Female Titan", "Beast Titan"],
            answer: "Attack Titan",
            difficulty: "Medium"
        },
        {
            question: "Who is known as 'Humanity's Strongest Soldier' in Attack on Titan?",
            options: ["Levi Ackerman", "Erwin Smith", "Mikasa Ackerman", "Eren Yeager"],
            answer: "Levi Ackerman",
            difficulty: "Medium"
        }
    ],
    Hard: [
        {
            question: "What are the ancient stones that Nico Robin can read called?",
            options: ["Poneglyphs", "Road Stones", "Ancient Tablets", "Historia Stones"],
            answer: "Poneglyphs",
            difficulty: "Hard"
        },
        {
            question: "Who was Nico Robin's mentor on Ohara?",
            options: ["Professor Clover", "Dr. Hiriluk", "Professor Oak", "Dr. Vegapunk"],
            answer: "Professor Clover",
            difficulty: "Hard"
        },
        {
            question: "In One Piece, where do the Straw Hats first meet Brook?",
            options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"],
            answer: "Thriller Bark",
            difficulty: "Hard"
        },
        {
            question: "In Hunter x Hunter, what is Gon's father's name?",
            options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"],
            answer: "Ging Freecss",
            difficulty: "Hard"
        }
    ]
};

module.exports = {
    TIER_COLORS,
    TIER_NAMES,
    TIER_EMOJIS,
    TIER_DESCRIPTIONS,
    ANIME_KEYWORDS,
    BAD_KEYWORDS,
    ANIME_TITLES,
    FALLBACK_QUESTIONS
};
