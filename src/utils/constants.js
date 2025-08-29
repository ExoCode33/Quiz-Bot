// Tier colors for embeds (One Piece theme)
const TIER_COLORS = {
    0: '#808080',   // No tier - Gray
    1: '#FFFFFF',   // Common - White
    2: '#4CAF50',   // Uncommon - Green
    3: '#2196F3',   // Rare - Blue
    4: '#9C27B0',   // Epic - Purple
    5: '#FFC107',   // Legendary - Gold
    6: '#FFC107',   // Legendary - Gold
    7: '#FF9800',   // Mythical - Orange
    8: '#FF9800',   // Mythical - Orange
    9: '#F44336',   // Divine - Red
    10: '#F44336'   // Divine - Red
};

// Tier names (One Piece theme) - Score-based mapping
const TIER_NAMES = {
    0: 'No Power',
    1: 'Common Buff',
    2: 'Uncommon Buff', 
    3: 'Rare Buff',
    4: 'Epic Buff',
    5: 'Legendary Buff',
    6: 'Legendary Buff',
    7: 'Mythical Buff',
    8: 'Mythical Buff',
    9: 'Divine Buff',
    10: 'Divine Buff'
};

// Tier emojis (matching score requirements)
const TIER_EMOJIS = {
    0: '💀',  // No power
    1: '⚪',  // Common
    2: '🟢',  // Uncommon
    3: '🔵',  // Rare
    4: '🟣',  // Epic
    5: '🟡',  // Legendary
    6: '🟡',  // Legendary
    7: '🟠',  // Mythical
    8: '🟠',  // Mythical
    9: '🔴',  // Divine
    10: '🔴' // Divine
};

// One Piece themed descriptions (score-based)
const TIER_DESCRIPTIONS = {
    0: 'Your journey ends here - even the greatest pirates face defeat sometimes',
    1: 'A common pirate\'s blessing - every legendary journey starts with a single step on the Grand Line',
    2: 'An uncommon surge of power flows through you - the sea recognizes your growing potential',
    3: 'A rare treasure of the Grand Line enhances your abilities - you\'re becoming a notable pirate',
    4: 'Epic power worthy of a Supernova pirate - your name begins to spread across the seas',
    5: 'Legendary might that rivals the Yonko themselves - the New World trembles at your presence',
    6: 'Legendary supremacy that shakes the very foundations of the Grand Line itself',
    7: 'Mythical transcendence beyond mortal limits - even the World Government takes notice',
    8: 'Mythical dominance that defies the heavens - you stand among the greatest pirates in history',
    9: 'Divine power that rivals the ancient weapons themselves - the entire world knows your name',
    10: 'Divine perfection - you\'ve achieved the pinnacle of pirate mastery, rivaling the Pirate King himself!'
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
        },
        {
            question: "What anime features a notebook that can kill people?",
            options: ["Death Note", "Code Geass", "Psycho-Pass", "Future Diary"],
            answer: "Death Note",
            difficulty: "Easy"
        },
        {
            question: "In Dragon Ball Z, what is Goku's Saiyan name?",
            options: ["Kakarot", "Vegeta", "Raditz", "Bardock"],
            answer: "Kakarot",
            difficulty: "Easy"
        },
        {
            question: "What is the name of the main character in Bleach?",
            options: ["Ichigo Kurosaki", "Rukia Kuchiki", "Uryu Ishida", "Chad Sado"],
            answer: "Ichigo Kurosaki",
            difficulty: "Easy"
        },
        {
            question: "In Attack on Titan, what do titans primarily eat?",
            options: ["Humans", "Animals", "Plants", "Nothing"],
            answer: "Humans",
            difficulty: "Easy"
        },
        {
            question: "In Demon Slayer, what breathing technique does Tanjiro use?",
            options: ["Water Breathing", "Fire Breathing", "Wind Breathing", "Stone Breathing"],
            answer: "Water Breathing",
            difficulty: "Easy"
        },
        {
            question: "What anime features giant humanoid creatures called Titans?",
            options: ["Attack on Titan", "Evangelion", "Code Geass", "Gundam"],
            answer: "Attack on Titan",
            difficulty: "Easy"
        },
        {
            question: "In which anime do characters have 'Quirks'?",
            options: ["My Hero Academia", "Naruto", "One Piece", "Bleach"],
            answer: "My Hero Academia",
            difficulty: "Easy"
        }
    ],
    Medium: [
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
        },
        {
            question: "In Demon Slayer, what is Tanjiro's family name?",
            options: ["Kamado", "Hashibira", "Agatsuma", "Shinazugawa"],
            answer: "Kamado",
            difficulty: "Medium"
        },
        {
            question: "In Fullmetal Alchemist, what do the Elric brothers seek?",
            options: ["Philosopher's Stone", "Dragon Balls", "Death Note", "Holy Grail"],
            answer: "Philosopher's Stone",
            difficulty: "Medium"
        },
        {
            question: "In One Punch Man, what is Saitama's hero rank initially?",
            options: ["Class C", "Class B", "Class A", "Class S"],
            answer: "Class C",
            difficulty: "Medium"
        },
        {
            question: "In Jujutsu Kaisen, what grade is Yuji Itadori initially classified as?",
            options: ["Grade 4", "Grade 3", "Grade 2", "Grade 1"],
            answer: "Grade 4",
            difficulty: "Medium"
        },
        {
            question: "In Tokyo Ghoul, what are the creatures that eat humans called?",
            options: ["Ghouls", "Titans", "Demons", "Hollows"],
            answer: "Ghouls",
            difficulty: "Medium"
        },
        {
            question: "In Hunter x Hunter, what is the name of the hunter exam arc?",
            options: ["Hunter Exam", "Yorknew City", "Greed Island", "Chimera Ant"],
            answer: "Hunter Exam",
            difficulty: "Medium"
        },
        {
            question: "In Seven Deadly Sins, what is Meliodas' sin?",
            options: ["Wrath", "Pride", "Greed", "Envy"],
            answer: "Wrath",
            difficulty: "Medium"
        },
        {
            question: "In Fire Force, what are the fire-powered beings called?",
            options: ["Infernals", "Pyromancers", "Fire Demons", "Flame Spirits"],
            answer: "Infernals",
            difficulty: "Medium"
        },
        {
            question: "In Black Clover, what is Asta's main trait?",
            options: ["No magic", "Fire magic", "Wind magic", "Water magic"],
            answer: "No magic",
            difficulty: "Medium"
        }
    ],
    Hard: [
        {
            question: "In One Piece, where do the Straw Hats first meet Brook?",
            options: ["Thriller Bark", "Sabaody Archipelago", "Water 7", "Enies Lobby"],
            answer: "Thriller Bark",
            difficulty: "Hard"
        },
        {
            question: "What is Roy Mustang's title in Fullmetal Alchemist?",
            options: ["Flame Alchemist", "Steel Alchemist", "State Alchemist", "Fire Colonel"],
            answer: "Flame Alchemist",
            difficulty: "Hard"
        },
        {
            question: "In Hunter x Hunter, what is Gon's father's name?",
            options: ["Ging Freecss", "Silva Zoldyck", "Isaac Netero", "Leorio Paradinight"],
            answer: "Ging Freecss",
            difficulty: "Hard"
        },
        {
            question: "What is the name of the school in Kill la Kill?",
            options: ["Honnouji Academy", "Kiryuin Academy", "Satsuki Academy", "Ryuko Academy"],
            answer: "Honnouji Academy",
            difficulty: "Hard"
        },
        {
            question: "In Jojo's Bizarre Adventure, what is Dio's stand called?",
            options: ["The World", "Star Platinum", "Crazy Diamond", "Gold Experience"],
            answer: "The World",
            difficulty: "Hard"
        },
        {
            question: "In Code Geass, what is Lelouch's Geass power?",
            options: ["Absolute Obedience", "Mind Reading", "Time Stop", "Precognition"],
            answer: "Absolute Obedience",
            difficulty: "Hard"
        },
        {
            question: "What is the name of Light's Shinigami in Death Note?",
            options: ["Ryuk", "Rem", "Misa", "Near"],
            answer: "Ryuk",
            difficulty: "Hard"
        },
        {
            question: "In Evangelion, what is the name of Shinji's father?",
            options: ["Gendo Ikari", "Ryoji Kaji", "Kozo Fuyutsuki", "Shigeru Aoba"],
            answer: "Gendo Ikari",
            difficulty: "Hard"
        },
        {
            question: "What is the real name of the character known as 'L' in Death Note?",
            options: ["L Lawliet", "Near", "Mello", "Watari"],
            answer: "L Lawliet",
            difficulty: "Hard"
        },
        {
            question: "In One Piece, what are the names of the three ancient weapons?",
            options: ["Pluton, Poseidon, Uranus", "Zeus, Hera, Poseidon", "Ares, Athena, Apollo", "Thor, Odin, Loki"],
            answer: "Pluton, Poseidon, Uranus",
            difficulty: "Hard"
        },
        {
            question: "In Steins;Gate, what is the name of the time machine?",
            options: ["Phone Microwave", "Time Machine", "D-Mail", "SERN"],
            answer: "Phone Microwave",
            difficulty: "Hard"
        },
        {
            question: "In Berserk, what is the name of Guts' sword?",
            options: ["Dragon Slayer", "Iron Reaver", "Demon Blade", "God Hand"],
            answer: "Dragon Slayer",
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
