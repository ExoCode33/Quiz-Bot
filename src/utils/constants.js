// Tier colors for embeds
const TIER_COLORS = {
    1: '#FFFFFF',   // White
    2: '#4CAF50',   // Green
    3: '#2196F3',   // Blue
    4: '#9C27B0',   // Purple
    5: '#FFC107',   // Amber
    6: '#FF9800',   // Orange
    7: '#FF5722',   // Deep Orange
    8: '#F44336',   // Red
    9: '#E91E63',   // Pink
    10: '#FFD700'   // Gold
};

// Tier names
const TIER_NAMES = {
    1: 'Bronze Otaku',
    2: 'Silver Fan',
    3: 'Gold Enthusiast',
    4: 'Platinum Weeb',
    5: 'Diamond Expert',
    6: 'Master Otaku',
    7: 'Legendary Weeb',
    8: 'Mythical Expert',
    9: 'Divine Master',
    10: 'Ultimate Otaku'
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
    ANIME_KEYWORDS,
    BAD_KEYWORDS,
    ANIME_TITLES,
    FALLBACK_QUESTIONS
};
